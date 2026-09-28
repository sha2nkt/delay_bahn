"""On-demand delay lookup straight from the DB Timetables API (IRIS).

The nightly pipeline stores IRIS `fchg` change times; this module reads the same
values live, so a journey finished minutes ago answers with exactly the number
tomorrow's parquet will hold. Covers only what IRIS still reports (a few hours
back) - anything older stays the parquet's job.

Two calls per station are needed: `plan` maps (train number, planned time) to the
IRIS stop id, `fchg` carries the change times keyed by that id.
"""

import asyncio
import logging
import os
import re
import time
from collections import OrderedDict
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
from lxml import etree

log = logging.getLogger(__name__)

BASE_URL = "https://apis.deutschebahn.com/db-api-marketplace/apis/timetables/v1"
# IRIS timestamps are Europe/Berlin local, like the parquet's
BERLIN = ZoneInfo("Europe/Berlin")

# a published plan hour never changes; change messages keep arriving while a train runs
PLAN_TTL = 6 * 3600
FCHG_TTL = 60
CACHE_MAX = 2048
CONCURRENCY = 10
# ceiling on API calls one search may trigger; legs left unresolved render as pending
MAX_CALLS_PER_WARM = 150
# a stop this close to the hour boundary may be filed under either hour
BOUNDARY_MIN = 5
# planned times from bahn.de and from IRIS can differ by a rounding minute
MATCH_TOLERANCE_MIN = 2

_client: httpx.AsyncClient | None = None
_sem: asyncio.Semaphore | None = None

# key -> (expires_at, task, started_at); the task is shared so concurrent searches
# over the same station ride one upstream request, as in bahn_api
_cache: OrderedDict[tuple, tuple[float, "asyncio.Task", float]] = OrderedDict()
# key -> (last task that succeeded, when it was requested): what reads see while
# the entry above is being refreshed or has just failed
_last_ok: dict[tuple, tuple["asyncio.Task", float]] = {}

# The marketplace key allows 60 calls a minute, shared by every caller in this
# process (past-journey searches, the live train poller). Every response names
# what is left; a 429 names how long to wait. Both are kept so callers with
# optional work can stand back before the quota is gone.
QUOTA_PER_MINUTE = 60
_quota_remaining: int | None = None
_quota_seen_at = 0.0
_quota_blocked_until = 0.0
metrics = {"calls": 0, "quota_429": 0, "errors": 0}


class QuotaExceeded(Exception):
    """The marketplace key's per-minute quota is spent."""


def quota() -> dict:
    """For /health: what the last response said was left, and any active block."""
    now = time.monotonic()
    return {
        "remaining": _quota_remaining,
        "blockedFor": max(0, round(_quota_blocked_until - now)),
        "counters": dict(metrics),
    }


def quota_available(reserve: int) -> bool:
    """True when optional work may draw on the quota: no 429 block is active and,
    as far as the last response knew, more than `reserve` calls are left. The
    remaining count is trusted for the rest of its minute, then forgotten."""
    now = time.monotonic()
    if not configured() or now < _quota_blocked_until:
        return False
    if _quota_remaining is None or now - _quota_seen_at > 60:
        return True
    return _quota_remaining > reserve


def _load_dotenv() -> None:
    """Local dev convenience; in production systemd passes the credentials in."""
    env_file = Path(__file__).resolve().parent.parent / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        key, _, value = line.partition("=")
        key = key.strip()
        if key and not key.startswith("#") and key not in os.environ:
            os.environ[key] = value.strip().strip("'\"")


_load_dotenv()


def configured() -> bool:
    return bool(os.environ.get("DB_API_KEY") and os.environ.get("DB_CLIENT_ID"))


def _iris_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%y%m%d%H%M")
    except ValueError:
        return None


def _session() -> httpx.AsyncClient:
    global _client, _sem
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=BASE_URL,
            timeout=10,
            headers={
                "DB-Api-Key": os.environ["DB_API_KEY"],
                "DB-Client-Id": os.environ["DB_CLIENT_ID"],
                "Accept": "application/xml",
            },
        )
        _sem = asyncio.Semaphore(CONCURRENCY)
    return _client


async def close() -> None:
    global _client, _sem
    if _client is not None:
        await _client.aclose()
    _client, _sem = None, None
    _cache.clear()
    _last_ok.clear()


def _note_quota(resp: httpx.Response) -> None:
    global _quota_remaining, _quota_seen_at, _quota_blocked_until
    metrics["calls"] += 1
    # "name=default,59;" - the count left in the current minute
    m = re.search(r"(\d+)\s*;?\s*$", resp.headers.get("x-ratelimit-remaining", ""))
    if m:
        _quota_remaining, _quota_seen_at = int(m.group(1)), time.monotonic()
    if resp.status_code == 429:
        metrics["quota_429"] += 1
        retry = resp.headers.get("retry-after")
        wait = float(retry) if retry and retry.replace(".", "", 1).isdigit() else 60.0
        _quota_blocked_until = time.monotonic() + max(1.0, min(wait, 300.0))
        _quota_remaining = 0
        log.warning("live_delays: quota exceeded, pausing IRIS calls for %.0fs", wait)


async def _get_xml(path: str):
    if time.monotonic() < _quota_blocked_until:
        raise QuotaExceeded("IRIS quota spent")
    client = _session()  # also creates the semaphore, so do it before acquiring
    async with _sem:
        resp = await client.get(path)
    _note_quota(resp)
    if resp.status_code == 429:
        raise QuotaExceeded("IRIS quota spent")
    if 400 <= resp.status_code < 500:
        # station or hour unknown to IRIS (404, or 400 for a foreign station such
        # as Messina on an IC that shares a German number): no data, not an
        # error, and asking again would not change the answer
        if resp.status_code != 404:
            metrics["errors"] += 1
        return etree.Element("timetable")
    resp.raise_for_status()
    return etree.fromstring(resp.content)


async def _fetch_plan(eva: str, day: str, hour: int) -> list[dict]:
    """Planned stops at one station in one hour: train number and planned times per stop id."""
    root = await _get_xml(f"/plan/{eva}/{day}/{hour:02d}")
    stops = []
    for s in root.findall("s"):
        tl = s.find("tl")
        if tl is None or not s.get("id"):
            continue
        ar, dp = s.find("ar"), s.find("dp")
        # line label ("S5"), normalized the same way as the delays-table key: bahn.de
        # sends it as fahrtNr for German S-Bahn legs, so the lookup matches on it
        raw_line = (ar.get("l") if ar is not None else None) or (dp.get("l") if dp is not None else None)
        line = raw_line.replace(" ", "") if raw_line else None
        if line and line.isdigit() and tl.get("c") == "S":
            line = "S" + line  # a few networks report bare digits in IRIS l
        stops.append({
            "id": s.get("id"),
            "train": (tl.get("n") or "").lstrip("0"),
            "category": (tl.get("c") or "").upper() or None,
            "line": line,
            "ar_pt": _iris_dt(ar.get("pt") if ar is not None else None),
            "dp_pt": _iris_dt(dp.get("pt") if dp is not None else None),
            # the planned path onward, station names separated by "|": what tells
            # two trains of one category leaving in the same minute apart
            "ppth": (dp.get("ppth") if dp is not None else None) or None,
        })
    return stops


async def _fetch_fchg(eva: str) -> dict[str, dict]:
    """All known changes at one station, keyed by IRIS stop id."""
    root = await _get_xml(f"/fchg/{eva}")
    changes = {}
    for s in root.findall("s"):
        if not s.get("id"):
            continue
        ar, dp = s.find("ar"), s.find("dp")
        ar_clt = ar.get("clt") if ar is not None else None
        dp_clt = dp.get("clt") if dp is not None else None
        # a changed platform is announced on either event; the departure's wins
        platform = ((dp.get("cp") if dp is not None else None)
                    or (ar.get("cp") if ar is not None else None))
        # latest delay-cause message (<m t="d" c="43"/>) anywhere on the stop;
        # ts is yymmddhhmm, so string comparison orders chronologically
        reason, reason_ts = None, ""
        for m in s.iter("m"):
            code = m.get("c")
            if m.get("t") == "d" and code and code.isdigit() and (m.get("ts") or "") >= reason_ts:
                reason, reason_ts = int(code), m.get("ts") or ""
        changes[s.get("id")] = {
            "ar_ct": _iris_dt(ar.get("ct") if ar is not None else None),
            "dp_ct": _iris_dt(dp.get("ct") if dp is not None else None),
            "canceled": bool(ar_clt or dp_clt),
            "reason": reason,
            "platform": platform,
        }
    return changes


def _task(key: tuple, ttl: int, coro_factory) -> "asyncio.Task":
    task, _ = _ensure(key, ttl, coro_factory)
    return task


def _ensure(key: tuple, ttl: int, coro_factory) -> tuple["asyncio.Task", bool]:
    """The cached task for `key`, starting a fresh one when the entry is missing
    or past its TTL. The flag says whether a call was actually put on the wire."""
    hit = _cache.get(key)
    if hit and (time.monotonic() < hit[0] or not hit[1].done()):
        _cache.move_to_end(key)
        return hit[1], False

    task = asyncio.ensure_future(coro_factory())
    started = time.monotonic()
    _cache[key] = (started, task, started)
    _cache.move_to_end(key)
    while len(_cache) > CACHE_MAX:
        old_key, _ = _cache.popitem(last=False)
        _last_ok.pop(old_key, None)

    def settle(done: "asyncio.Task") -> None:
        if done.cancelled() or done.exception() is not None:
            # a transient API error must not be served for the whole TTL
            entry = _cache.get(key)
            if entry and entry[1] is done:
                del _cache[key]
            return
        # the answer stands until the next one lands, refresh in flight or not
        _last_ok[key] = (done, started)
        entry = _cache.get(key)
        if entry and entry[1] is done:
            _cache[key] = (started + ttl, done, started)

    task.add_done_callback(settle)
    return task, True


def _plan_hours(planned: datetime) -> list[tuple[str, int]]:
    """Hour buckets a stop may be filed under, nearest first."""
    day = planned.strftime("%y%m%d")
    hours = [(day, planned.hour)]
    if planned.minute >= 60 - BOUNDARY_MIN:
        nxt = planned + timedelta(hours=1)
        hours.append((nxt.strftime("%y%m%d"), nxt.hour))
    elif planned.minute < BOUNDARY_MIN:
        prev = planned - timedelta(hours=1)
        hours.append((prev.strftime("%y%m%d"), prev.hour))
    return hours


async def warm(stops: set[tuple[str, datetime]]) -> None:
    """Prefetch everything the sync lookups below will need for one search.

    `stops` is the set of (padded eva, planned local time) the itineraries touch.
    Failures are swallowed: an unresolved leg reads as unknown, never as an error.
    """
    if not configured() or not stops:
        return
    keys = []
    for eva, planned in stops:
        keys.append(("fchg", eva))
        for day, hour in _plan_hours(planned):
            keys.append(("plan", eva, day, hour))

    seen, tasks = set(), []
    for key in keys:
        if key in seen:
            continue
        seen.add(key)
        if len(tasks) >= MAX_CALLS_PER_WARM:
            log.warning("live_delays: warm capped at %d calls, %d keys dropped",
                        MAX_CALLS_PER_WARM, len(set(keys)) - len(tasks))
            break
        if key[0] == "fchg":
            tasks.append(_task(key, FCHG_TTL, lambda e=key[1]: _fetch_fchg(e)))
        else:
            _, eva, day, hour = key
            tasks.append(_task(key, PLAN_TTL, lambda e=eva, d=day, h=hour: _fetch_plan(e, d, h)))

    results = await asyncio.gather(*tasks, return_exceptions=True)
    errors = [r for r in results if isinstance(r, BaseException)]
    if errors:
        log.warning("live_delays: %d/%d calls failed, first: %r", len(errors), len(results), errors[0])


def _settled(key: tuple) -> tuple["asyncio.Task", float] | None:
    """The newest successful task for `key` and when it was requested: the cache
    entry if it has landed, else the previous answer while a refresh is in flight."""
    hit = _cache.get(key)
    if hit and hit[1].done() and not hit[1].cancelled() and hit[1].exception() is None:
        return hit[1], hit[2]
    return _last_ok.get(key)


def _ready(key: tuple):
    """Result of an already-warmed call, or None if missing, pending or failed."""
    hit = _settled(key)
    return hit[0].result() if hit else None


def fetched_at(key: tuple) -> float | None:
    """Monotonic time the ready result for `key` was requested, or None."""
    hit = _settled(key)
    return hit[1] if hit else None


def stop_keys(eva_padded: str, planned: list[datetime]) -> tuple[tuple, list[tuple]]:
    """The cache keys one stop's live state needs: its station's change feed and
    the plan hours its planned times fall in."""
    plans = []
    for p in planned:
        for day, hour in _plan_hours(p):
            key = ("plan", eva_padded, day, hour)
            if key not in plans:
                plans.append(key)
    return ("fchg", eva_padded), plans


def ensure_key(key: tuple) -> tuple["asyncio.Task", bool]:
    """Start (or reuse) the fetch for a key made by stop_keys."""
    if key[0] == "fchg":
        return _ensure(key, FCHG_TTL, lambda e=key[1]: _fetch_fchg(e))
    _, eva, day, hour = key
    return _ensure(key, PLAN_TTL, lambda e=eva, d=day, h=hour: _fetch_plan(e, d, h))


def _plan_stop(train_number: str, eva_padded: str, planned: datetime, kind: str) -> tuple | None:
    """(stop id, IRIS planned time) of `train_number`'s stop at the station, from the
    warmed plan; None if the plan is not ready or does not list the train."""
    pt_key = "ar_pt" if kind == "ar" else "dp_pt"
    # bahn.de sends a line label ("S5") instead of a run number only for DE S-Bahn;
    # numeric keys stay on pure run-number matching so an RB with IRIS l="26" can't
    # false-match a leg whose fahrtNr is "26" (and CH keys, always digits, stay put)
    by_line = not train_number.isdigit()
    best = None
    for day, hour in _plan_hours(planned):
        for stop in _ready(("plan", eva_padded, day, hour)) or ():
            hit = stop["train"] == train_number or (by_line and stop.get("line") == train_number)
            if not hit or stop[pt_key] is None:
                continue
            off = abs((stop[pt_key] - planned).total_seconds()) / 60
            if off <= MATCH_TOLERANCE_MIN and (best is None or off < best[0]):
                best = (off, stop["id"], stop[pt_key])
    return best[1:] if best else None


def change_by_id(eva_padded: str, stop_id: str) -> dict | None:
    """The live state of one stop known by its IRIS id - trip, origin departure and
    stop index - which needs only the station's change feed, no plan hour. None
    while the feed is not in the cache; an empty change means as planned."""
    started = fetched_at(("fchg", eva_padded))
    if started is None:
        return None
    change = (_ready(("fchg", eva_padded)) or {}).get(stop_id) or {}
    return {
        "arrival": change.get("ar_ct"),
        "departure": change.get("dp_ct"),
        "cancelled": bool(change.get("canceled")),
        "platform": change.get("platform"),
        "age": time.monotonic() - started,
    }


def stop_live(train_number: str, eva_padded: str, planned_arrival: datetime | None,
              planned_departure: datetime | None) -> dict | None:
    """The live state of one train's stop for the map: changed times (None where
    IRIS reports no change, i.e. as planned), cancellation, platform, and how
    old the station's change feed is. None while the plan or the feed for the
    station is not in the cache yet, or when IRIS does not list the train there."""
    if not configured():
        return None
    train_number = train_number.lstrip("0")
    found = None
    if planned_arrival is not None:
        found = _plan_stop(train_number, eva_padded, planned_arrival, "ar")
    if found is None and planned_departure is not None:
        found = _plan_stop(train_number, eva_padded, planned_departure, "dp")
    if found is None:
        return None
    started = fetched_at(("fchg", eva_padded))
    if started is None:
        return None
    change = (_ready(("fchg", eva_padded)) or {}).get(found[0]) or {}
    return {
        "id": found[0],
        "arrival": change.get("ar_ct"),
        "departure": change.get("dp_ct"),
        "cancelled": bool(change.get("canceled")),
        "platform": change.get("platform"),
        "age": time.monotonic() - started,
    }


def _lookup(train_number: str, eva_padded: str, planned: datetime, kind: str) -> dict | None:
    """Delay of one train's arrival/departure at one station, from warmed IRIS data."""
    if not configured():
        return None
    found = _plan_stop(train_number.lstrip("0"), eva_padded, planned, kind)
    if found is None:
        return None  # IRIS doesn't know this stop (yet): unknown, not on time
    stop_id, stop_pt = found

    changes = _ready(("fchg", eva_padded))
    if changes is None:
        return None
    change = changes.get(stop_id)
    reason = change["reason"] if change else None
    if change and change["canceled"]:
        return {"delayMin": None, "canceled": True, "reason": reason}  # known ahead of time, and a fact
    ct = (change["ar_ct"] if kind == "ar" else change["dp_ct"]) if change else None
    # "no change reported" means on time only once the stop is behind us; for one
    # still ahead it is a prognosis, and claiming punctuality would be wrong
    if (ct or stop_pt) > datetime.now(BERLIN).replace(tzinfo=None):
        return None
    if ct is None:
        return {"delayMin": 0, "canceled": False, "reason": reason}
    # measure against IRIS's own planned time, exactly as the parquet build does
    return {"delayMin": round((ct - stop_pt).total_seconds() / 60), "canceled": False, "reason": reason}


def leg_delay_on_date(train_number: str, eva_padded: str, planned_arrival_local: datetime) -> dict | None:
    return _lookup(train_number, eva_padded, planned_arrival_local, "ar")


def leg_departure_on_date(train_number: str, eva_padded: str, planned_departure_local: datetime) -> dict | None:
    return _lookup(train_number, eva_padded, planned_departure_local, "dp")
