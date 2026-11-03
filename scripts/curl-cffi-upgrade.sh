#!/bin/bash
# Upgrade curl_cffi after the app found no installed profile that bahn.de
# accepts (app/profile_heal.py drops data/curl_cffi_upgrade.request).
# Runs as root from delaybahn-cffi-upgrade.service, started by the .path unit.
#
#   1. uv lock --upgrade-package curl-cffi: the bump lands in uv.lock, so the
#      next deploy's `uv sync --frozen` keeps it (deploy.sh stashes and restores
#      the server-side edit around its pull until it is committed upstream)
#   2. uv sync --frozen + the private map package, exactly as deploy.sh does
#   3. sweep the new release out of process; restart delaybahn only when one of
#      its profiles passes, since a restart costs ~75 s of 502s and the cache
#   4. write data/curl_cffi_upgrade.json, which the app and the watchdog report
#
# Install (root, on the server):
#   cp scripts/delaybahn-cffi-upgrade.{path,service} /etc/systemd/system/
#   systemctl daemon-reload && systemctl enable --now delaybahn-cffi-upgrade.path
#
# REPO, MAP, APP_USER, BACKUP_DIR and RESTART are overridable so the whole
# flow can be rehearsed against a sandbox copy without root.
set -u
REPO=${REPO:-/home/stripathi/Documents/code_local/db_delay_predictor}
MAP=${MAP:-/home/stripathi/delaybahn-map}
APP_USER=${APP_USER:-stripathi}
BACKUP_DIR=${BACKUP_DIR:-/root}
RESTART=${RESTART:-systemctl restart delaybahn}
REQ=$REPO/data/curl_cffi_upgrade.request
OUT=$REPO/data/curl_cffi_upgrade.json
# the .path unit re-fires for as long as the request exists, so it always goes
trap 'rm -f "$REQ"' EXIT

as_app() {
  if [ "$(id -un)" = "$APP_USER" ]; then bash -c "cd $REPO && $1"
  else sudo -u "$APP_USER" -H bash -c "cd $REPO && $1"; fi
}

report() {  # $1 result, $2 from, $3 to, $4 detail; sweep JSON in $SWEEP
  python3 - "$OUT" "$@" <<'PY'
import json, os, sys
from datetime import datetime, timezone
out, result, old, new, detail = sys.argv[1:]
raw = os.environ.get("SWEEP", "").strip()
sweep = json.loads(raw) if raw else {}
json.dump({"at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "result": result, "from": old, "to": new, "tried": sweep.get("tried"),
           "of": sweep.get("of"), "working": sweep.get("working", []), "detail": detail},
          open(out + ".tmp", "w"))
os.chmod(out + ".tmp", 0o644)
os.replace(out + ".tmp", out)
PY
  echo "curl_cffi upgrade: $1 ($2 -> $3) $4"
}

locked() {
  python3 -c 'import sys, tomllib
print(next(p["version"] for p in tomllib.load(open(sys.argv[1], "rb"))["package"]
           if p["name"] == "curl-cffi"))' "$REPO/uv.lock"
}

old=$(locked)
cp "$REPO/uv.lock" $BACKUP_DIR/uv.lock.before-cffi-upgrade
if ! as_app "uv lock -q --upgrade-package curl-cffi"; then
  report error "$old" "$old" "uv lock failed"; exit 1
fi
new=$(locked)
if [ "$new" = "$old" ]; then
  report newest "$old" "$old" "no newer curl_cffi release"; exit 0
fi

if ! as_app "uv sync -q --frozen && { [ ! -d $MAP ] || uv pip install -q -e $MAP; }"; then
  cp $BACKUP_DIR/uv.lock.before-cffi-upgrade "$REPO/uv.lock"
  as_app "uv sync -q --frozen && { [ ! -d $MAP ] || uv pip install -q -e $MAP; }"
  report error "$old" "$new" "uv sync failed, rolled back to $old"; exit 1
fi

sweep=$(as_app ".venv/bin/python -m app.profile_heal sweep" | tail -1)
if printf %s "$sweep" | grep -q '"result": "adopted"'; then
  SWEEP=$sweep report upgraded "$old" "$new" ""
  $RESTART
else
  # kept: newer is no worse, and it is what the next restart would want
  SWEEP=$sweep report upgraded-none "$old" "$new" ""
fi
