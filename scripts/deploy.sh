#!/usr/bin/env bash
# Deploy delaybahn.com: pull main on the Hetzner box, restart the service, verify.
# This is the only command Claude Code is pre-approved to run against the server
# (settings.local.json allows exactly "bash scripts/deploy.sh"), so every remote
# action must live in this reviewed, version-controlled file.
set -euo pipefail

# Homepage latency on the box itself, so a deploy that stalls the event loop
# shows up as numbers next to the numbers from before it (2026-11-05: France
# was rolled back once on a stall that was already there, and re-shipped once
# on a check taken before its warm-up was over). The "after" sample starts
# 15 min after the restart, when the warm-up is done, and lands in a file:
#   bash scripts/deploy.sh --after
# prints it next to the "before" one.
SAMPLE='sample() { for i in $(seq "$1"); do curl -s -o /dev/null -w "%{time_total}\n" http://127.0.0.1:8000/; sleep "$2"; done \
  | sort -n | awk "{a[NR]=\$1} END {n=0; for (i=1; i<=NR; i++) if (a[i]>3) n++; \
  printf \"%d samples: median %.3f s, p90 %.3f s, worst %.3f s, over 3 s: %d\\n\", NR, a[int(NR*0.5)+1], a[int(NR*0.9)+1], a[NR], n}"; }'
if [ "${1:-}" = "--after" ]; then
  ssh root@delaybahn_hetzner3 'cat /var/tmp/delaybahn-latency.txt 2>/dev/null || echo "no sample yet"'
  exit 0
fi
echo "latency before (1 min):"
ssh root@delaybahn_hetzner3 "$SAMPLE; { echo \"before \$(date -u +%H:%M): \$(sample 20 3)\"; } | tee /var/tmp/delaybahn-latency.txt"

ssh root@delaybahn_hetzner3 'sudo -u stripathi -i bash -s' <<'EOF'
set -euo pipefail
cd /home/stripathi/Documents/code_local/db_delay_predictor
STASHED=
git diff --quiet && git diff --cached --quiet || { git stash push -m deploy-$(date +%s) && STASHED=1; }
git pull --no-rebase --no-edit https://github.com/sha2nkt/delay_bahn.git main
# The DE pipeline step reaches into the deutsche-bahn-data submodule for
# scripts.create_monthly_data_release (pipeline/fchg_parse.py puts it on sys.path).
# A plain `git pull` moves the gitlink but never checks the submodule out, and a
# clone made without --recurse-submodules leaves the directory empty altogether --
# which is how the German build died at import on every nightly run from
# 2026-08-19 to 08-25 while the other five countries kept /health and the row
# count green. No-op once the submodule is already at the recorded commit.
git submodule update --init --recursive
# Fail the deploy rather than hand the 05:30 timer a checkout whose DE step will
# crash: the whole point of this incident was that the breakage was silent.
test -f deutsche-bahn-data/scripts/create_monthly_data_release.py || {
  echo "deploy aborted: deutsche-bahn-data submodule is empty after update" >&2
  exit 1
}
if [ -n "$STASHED" ]; then git stash pop; fi
# Dependencies before the restart, never after: a commit that adds one (and
# `set -e` here) must abort the deploy rather than restart into an app whose
# imports fail. A no-op when the lockfile hasn't moved.
uv sync --frozen
# The live train map is a private package (deploy-key clone at ~/delaybahn-map).
# uv sync prunes what the lockfile does not name, so it is re-installed after
# every sync; a box without the clone runs the site without the map.
if [ -d ~/delaybahn-map ]; then
  git -C ~/delaybahn-map pull --ff-only
  uv pip install -q -e ~/delaybahn-map
fi
echo "deployed: $(git log --oneline -1)"
EOF

ssh root@delaybahn_hetzner3 'systemctl restart delaybahn && systemctl is-active delaybahn'
# -4: this dev box (ps083) has broken IPv6; the check must go through Cloudflare.
# --retry rides out the restart race (502 until uvicorn binds, about 80 s with
# four countries' timetables restored); -f turns a health check that still
# fails after that into a nonzero exit instead of a silent pass.
curl -4 -sS -f --retry 30 --retry-delay 5 --max-time 20 https://delaybahn.com/health
echo
# The "after" sample, detached on the box: 15 min of warm-up, then 4 min of samples.
ssh root@delaybahn_hetzner3 "setsid nohup bash -c '$SAMPLE; sleep 900; echo \"after  \$(date -u +%H:%M): \$(sample 40 6)\" >> /var/tmp/delaybahn-latency.txt' >/dev/null 2>&1 &"
echo "latency after the warm-up: bash scripts/deploy.sh --after (from $(date -u -d '+19 min' +%H:%M) UTC)"
