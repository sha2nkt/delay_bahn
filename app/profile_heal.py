"""Self-heal for a wholesale Akamai block of our curl_cffi fingerprints.

When every profile in bahn_api.PROFILES has been refused (UpstreamBlocked), the
installed curl_cffi's other profiles are tried, one search each, and the first
few that pass replace PROFILES. If none passes, the app asks for a curl_cffi
upgrade by dropping a request file; delaybahn-cffi-upgrade.path on the server
runs scripts/curl-cffi-upgrade.sh, which bumps uv.lock, syncs the venv, sweeps
the new release out of process (`python -m app.profile_heal sweep`) and
restarts the app only when that release has a profile that passes.

Akamai lists fingerprints one at a time (chrome on 2026-07-23, every chrome and
firefox profile on 2026-11-03 while safari 18+ passed), so a block of the
configured profiles often leaves others in the same library working.

Everything /health shows lives in memory; files are read at startup and by the
background task only.
"""

import asyncio
import json
import logging
import re
import sys
import time
import typing
from datetime import datetime, timezone
from pathlib import Path

import curl_cffi

from app import bahn_api
from app.config import env_int

log = logging.getLogger(__name__)

DATA = Path(__file__).resolve().parent.parent / "data"
STATE = DATA / "bahn_profiles.json"
UPGRADE_REQUEST = DATA / "curl_cffi_upgrade.request"
UPGRADE_RESULT = DATA / "curl_cffi_upgrade.json"

# a sweep is ~50 searches against a site that is refusing us; once per block
# and then at this interval while it lasts
SWEEP_INTERVAL = env_int("BAHN_PROFILE_SWEEP_INTERVAL_SECONDS", 1800)
# enough spares for the 403 rotation; stopping early keeps the sweep short
SWEEP_KEEP = 3
SWEEP_SPACING = 1.0
# the upgrade script needs well under a minute; past this it is presumed dead
UPGRADE_WAIT = 1200
UPGRADE_POLL = 15

_task: asyncio.Task | None = None
_last_started: float | None = None
_sweep: dict | None = None
_upgrade: dict | None = None
_pending = False


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _undot(name: str) -> str:
    return re.sub(r"(?<=\d)_(?=\d)", "", name)


def _newest_first(name: str) -> int:
    m = re.search(r"\d+", name)
    return -int(m.group()) if m else 0


def available_profiles() -> list[str]:
    """One name per fingerprint the installed curl_cffi can impersonate."""
    try:
        from curl_cffi.fingerprints import FingerprintManager  # 0.17+
        names = [row["name"] for row in FingerprintManager.list_fingerprints()]
    except ImportError:
        from curl_cffi.requests.impersonate import REAL_TARGET_MAP, BrowserTypeLiteral
        names = [n for n in typing.get_args(BrowserTypeLiteral) if n not in REAL_TARGET_MAP]
    known = set(names)
    # before 0.16 the list also carried dotted aliases (safari18_0 = safari180)
    unique = {n for n in names if _undot(n) == n or _undot(n) not in known}
    return sorted(unique, key=lambda n: (_newest_first(n), n))


async def sweep() -> dict:
    """Probe the installed profiles, newest first, until SWEEP_KEEP pass."""
    candidates = available_profiles()
    working: list[str] = []
    tried = 0
    for name in candidates:
        if len(working) >= SWEEP_KEEP:
            break
        tried += 1
        outcome = await bahn_api.probe_profile(name)
        if outcome in (200, 201):
            working.append(name)
        await asyncio.sleep(SWEEP_SPACING)
    return {"at": _now(), "curlCffi": curl_cffi.__version__, "tried": tried,
            "of": len(candidates), "working": working,
            "result": "adopted" if working else "none"}


def _save(result: dict) -> None:
    state = {"curlCffi": result["curlCffi"], "sweep": result}
    if result["working"]:
        state["profiles"] = result["working"]
    tmp = STATE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2))
    tmp.replace(STATE)


def on_block() -> None:
    """bahn_api's UpstreamBlocked hook: start a sweep unless one ran recently."""
    global _task, _last_started
    if _task is not None and not _task.done():
        return
    now = time.monotonic()
    if _last_started is not None and now - _last_started < SWEEP_INTERVAL:
        return
    _last_started = now
    _task = asyncio.ensure_future(_heal())


async def _heal() -> None:
    global _sweep, _pending
    log.warning("bahn.de blocked every configured profile (%s); sweeping curl_cffi %s",
                ", ".join(bahn_api.PROFILES), curl_cffi.__version__)
    try:
        result = await sweep()
    except Exception:
        log.exception("profile sweep failed")
        return
    _sweep = result
    await asyncio.to_thread(_save, result)
    if result["working"]:
        bahn_api.adopt_profiles(result["working"], "profile sweep")
        return
    log.warning("no curl_cffi %s profile passes (%d tried); requesting an upgrade",
                result["curlCffi"], result["tried"])
    requested = datetime.now(timezone.utc)
    await asyncio.to_thread(UPGRADE_REQUEST.write_text, json.dumps(
        {"at": requested.isoformat(timespec="seconds"), "from": result["curlCffi"]}))
    _pending = True
    try:
        await _await_upgrade(requested.timestamp())
    finally:
        _pending = False


async def _await_upgrade(since: float) -> None:
    """Pick up the upgrade script's verdict. An upgrade that found a working
    profile restarts the app, so this only ever sees the other outcomes."""
    global _upgrade
    deadline = time.monotonic() + UPGRADE_WAIT
    while time.monotonic() < deadline:
        await asyncio.sleep(UPGRADE_POLL)
        try:
            if UPGRADE_RESULT.stat().st_mtime >= since:
                _upgrade = json.loads(await asyncio.to_thread(UPGRADE_RESULT.read_text))
                return
        except (OSError, ValueError):
            continue
    _upgrade = {"at": _now(), "result": "timeout"}
    log.warning("curl_cffi upgrade request got no answer in %ds", UPGRADE_WAIT)


def restore() -> None:
    """Startup: re-apply a sweep's profiles saved for this curl_cffi version,
    and drop configured names the installed release no longer knows (0.16
    removed the dotted aliases)."""
    global _sweep, _upgrade
    available = set(available_profiles())
    known = [p for p in bahn_api.PROFILES if p in available]
    if known != bahn_api.PROFILES and known:
        bahn_api.adopt_profiles(known, "unknown names dropped")
    try:
        state = json.loads(STATE.read_text())
    except (OSError, ValueError):
        state = {}
    if state.get("curlCffi") == curl_cffi.__version__:
        _sweep = state.get("sweep")
        saved = state.get("profiles") or []
        if saved and all(p in available for p in saved):
            bahn_api.adopt_profiles(saved, "restored from the last sweep")
    try:
        _upgrade = json.loads(UPGRADE_RESULT.read_text())
    except (OSError, ValueError):
        pass


def status() -> dict:
    return {"curlCffi": curl_cffi.__version__, "active": list(bahn_api.PROFILES),
            "sweep": _sweep, "upgrade": _upgrade, "upgradePending": _pending}


async def _cli_sweep() -> int:
    try:
        result = await sweep()
        _save(result)
    finally:
        await bahn_api.close()
    print(json.dumps(result))
    return 0 if result["working"] else 1


if __name__ == "__main__":
    # run by scripts/curl-cffi-upgrade.sh against a freshly upgraded venv
    if sys.argv[1:] != ["sweep"]:
        sys.exit("usage: python -m app.profile_heal sweep")
    logging.basicConfig(level=logging.WARNING)
    sys.exit(asyncio.run(_cli_sweep()))
