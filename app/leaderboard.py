"""Country punctuality leaderboard: every country in the delay table ranked over
the last day, 7 days and 30 days of the data window, once over every train and
once over long-distance trains only.

One aggregate over the whole table (grouped by country, day and whether the
train is a long-distance product) feeds all three periods and the per-day trend
series of both rankings, and is computed once per data version: the nightly
pipeline swaps the table and restarts the app, so the result only changes across
restarts. Served by /api/leaderboard, drawn by static/leaderboard.js.
"""

import threading
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from . import delays

# padded-eva prefix -> ISO 3166-1 alpha-2; the merge's country partition
# (pipeline/merge_delays.py SOURCES) keyed the same way
COUNTRIES = {"80": "DE", "81": "AT", "83": "IT", "84": "NL", "85": "CH", "87": "FR"}

PERIODS = {"day": 1, "week": 7, "month": 30}

# the long-distance products per country, as each source spells train_type: the
# trains that run well over 100 km end to end (ICE/IC/EC and their night, Railjet,
# TGV/Ouigo, Intercity equivalents). Regional, suburban and InterRegio products
# stay out, so the long-distance table compares the same tier of train everywhere.
LONG_DISTANCE = {
    "80": ("ICE", "IC", "EC", "ECE", "NJ", "EN", "RJ", "RJX", "TGV", "FLX", "D"),
    "81": ("RJ", "RJX", "IC", "ICE", "EC", "NJ", "EN", "D"),
    "83": ("IC", "ICN", "EC", "EN"),
    "84": ("IC", "ICD", "ICE", "ECD", "ECC", "EST", "NJ"),
    "85": ("IC", "EC", "ICE", "TGV", "RJX", "RJ", "NJ"),
    "87": ("OUI", "OGO", "IC", "ICN", "LYR", "ICE"),
}

# DB's own punctuality definition: an arrival less than 6 minutes late is on time.
# One threshold for every country, so the ranking compares like with like.
ON_TIME_MAX_MIN = 6

# a country with fewer observed arrivals than this in a period is listed but not
# ranked: a poller outage must not crown a country on a handful of stops
MIN_STOPS = {"day": 300, "week": 1000, "month": 2000}

BERLIN = ZoneInfo("Europe/Berlin")

_lock = threading.Lock()
_cached: dict | None = None
_cached_key: tuple | None = None

_LONG_DISTANCE_SQL = "CASE substr(eva, 2, 2) " + " ".join(
    f"WHEN '{cc}' THEN train_type IN ({', '.join(repr(t) for t in types)})"
    for cc, types in LONG_DISTANCE.items()
) + " ELSE false END"

_DAILY_SQL = f"""
    SELECT substr(eva, 2, 2) AS cc,
           CAST(arrival_planned_time AS DATE) AS day,
           long_distance,
           count(*) AS total,
           count(*) FILTER (WHERE coalesce(is_canceled, false)) AS cancelled,
           count(*) FILTER (WHERE observed) AS observed,
           count(*) FILTER (WHERE observed AND arr_delay < {ON_TIME_MAX_MIN}) AS on_time,
           coalesce(sum(greatest(arr_delay, 0)) FILTER (WHERE observed), 0) AS delay_sum
    FROM (
        SELECT eva, arrival_planned_time, is_canceled,
               NOT coalesce(is_canceled, false) AND arrival_change_time IS NOT NULL AS observed,
               date_diff('minute', arrival_planned_time, arrival_change_time) AS arr_delay,
               coalesce({_LONG_DISTANCE_SQL}, false) AS long_distance
        FROM delays
        WHERE arrival_planned_time IS NOT NULL
    )
    WHERE cc IN ({", ".join(f"'{p}'" for p in COUNTRIES)})
    GROUP BY 1, 2, 3
    ORDER BY 1, 2, 3
"""


def _daily_rows() -> list[tuple]:
    # a cursor is a second connection onto the same database: safe to drive from
    # a worker thread while the request handlers keep using the main one
    cur = delays.cursor()
    try:
        return cur.execute(_DAILY_SQL).fetchall()
    finally:
        cur.close()


def split_rows(rows: list[tuple]) -> tuple[list[tuple], list[tuple]]:
    """(all trains, long-distance trains) daily rows from the (cc, day, long_distance,
    total, cancelled, observed, on_time, delay_sum) aggregate: the first sums both
    flags back into one row per country and day, the second keeps the flagged ones."""
    every: dict[tuple, list] = {}
    long_distance = []
    for cc, day, is_long, *counts in rows:
        acc = every.setdefault((cc, day), [0] * len(counts))
        for i, v in enumerate(counts):
            acc[i] += v
        if is_long:
            long_distance.append((cc, day, *counts))
    return [(cc, day, *counts) for (cc, day), counts in every.items()], long_distance


def _aggregate(rows: list[dict]) -> dict:
    total = sum(r["total"] for r in rows)
    observed = sum(r["observed"] for r in rows)
    on_time = sum(r["on_time"] for r in rows)
    delay_sum = sum(r["delay_sum"] for r in rows)
    cancelled = sum(r["cancelled"] for r in rows)
    return {
        "stops": total,
        "observed": observed,
        "punctuality": round(100 * on_time / observed, 1) if observed else None,
        "avgDelay": round(delay_sum / observed, 1) if observed else None,
        "cancelled": round(100 * cancelled / total, 2) if total else None,
        "days": len(rows),
    }


def rank(entries: list[dict], min_stops: int) -> list[dict]:
    """Order countries best first: highest punctuality, ties broken by the lower
    average delay. Countries under `min_stops` observed arrivals keep their
    numbers but get no rank, and sort after the ranked ones by name."""
    ranked = sorted(
        (e for e in entries if e["observed"] >= min_stops and e["punctuality"] is not None),
        key=lambda e: (-e["punctuality"], e["avgDelay"], e["code"]),
    )
    unranked = sorted(
        (e for e in entries if not (e["observed"] >= min_stops and e["punctuality"] is not None)),
        key=lambda e: e["code"],
    )
    for i, e in enumerate(ranked, 1):
        e["rank"] = i
    for e in unranked:
        e["rank"] = None
    return ranked + unranked


def _tables(daily: list[tuple], as_of: date) -> tuple[dict, dict]:
    """(periods, series) for one set of (cc, day, total, cancelled, observed, on_time,
    delay_sum) rows."""
    by_country: dict[str, list[dict]] = {}
    for cc, day, total, cancelled, observed, on_time, delay_sum in daily:
        code = COUNTRIES.get(cc)
        if code is None:
            continue
        by_country.setdefault(code, []).append({
            "day": day, "total": total, "cancelled": cancelled, "observed": observed,
            "on_time": on_time, "delay_sum": delay_sum,
        })

    periods = {}
    for name, length in PERIODS.items():
        start = as_of - timedelta(days=length - 1)
        entries = []
        for code, rows in by_country.items():
            inside = [r for r in rows if start <= r["day"] <= as_of]
            # a country with nothing in this period stays listed, unranked, with
            # empty numbers: a source that stopped must show as a gap, not vanish
            entries.append({"code": code, **_aggregate(inside)})
        periods[name] = {
            "from": start.isoformat(),
            "to": as_of.isoformat(),
            "days": length,
            "minStops": MIN_STOPS[name],
            "countries": rank(entries, MIN_STOPS[name]),
        }

    series = {}
    for code, rows in by_country.items():
        series[code] = [
            {
                "day": r["day"].isoformat(),
                "punctuality": round(100 * r["on_time"] / r["observed"], 1) if r["observed"] else None,
                "avgDelay": round(r["delay_sum"] / r["observed"], 1) if r["observed"] else None,
                "observed": r["observed"],
            }
            for r in rows
        ]
    return periods, series


def build(daily: list[tuple], as_of: date, generated_at: datetime | None = None,
          long_distance: list[tuple] | None = None) -> dict:
    """The leaderboard document from (cc, day, total, cancelled, observed, on_time,
    delay_sum) rows, plus the same ranking over the `long_distance` rows under
    "longDistance"; split out from the query so it can be tested on fixtures."""
    periods, series = _tables(daily, as_of)
    ld_periods, ld_series = _tables(long_distance or [], as_of)
    return {
        "asOf": as_of.isoformat(),
        "generatedAt": (generated_at or datetime.now(BERLIN)).isoformat(timespec="seconds"),
        "onTimeMaxMin": ON_TIME_MAX_MIN,
        "periods": periods,
        "series": series,
        "longDistance": {"periods": ld_periods, "series": ld_series},
    }


def _empty() -> dict:
    periods = {
        name: {"from": None, "to": None, "days": length, "minStops": MIN_STOPS[name], "countries": []}
        for name, length in PERIODS.items()
    }
    return {
        "asOf": None,
        "generatedAt": datetime.now(BERLIN).isoformat(timespec="seconds"),
        "onTimeMaxMin": ON_TIME_MAX_MIN,
        "periods": periods,
        "series": {},
        "longDistance": {"periods": periods, "series": {}},
    }


def get() -> dict:
    """The leaderboard for the currently loaded data, computed on first use and
    reused until the data window moves (which only happens across restarts).
    Blocking: run it off the event loop."""
    global _cached, _cached_key
    key = delays.coverage()
    if _cached is not None and _cached_key == key:
        return _cached
    with _lock:
        if _cached is not None and _cached_key == key:
            return _cached
        _min_day, max_day = key
        if max_day:
            every, long_distance = split_rows(_daily_rows())
            result = build(every, max_day, long_distance=long_distance)
        else:
            result = _empty()
        _cached, _cached_key = result, key
        return result
