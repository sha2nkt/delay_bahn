#!/bin/bash
# Cron watchdog for delaybahn.com: alerts via ntfy on state changes, and keeps
# re-paging while an upstream block stays unresolved (see check 2).
# Runs on ps083, outside the Hetzner box, so it catches server, tunnel and app
# failures alike. curl -4 because ps083 advertises broken IPv6.
#
# Three independent checks:
#   1. DOWN: /health unreachable / non-200, and still so on a retry
#      DOWN_RETRY_SECONDS later. A restart (deploy or the daily pipeline) also
#      answers 502, for about 95 s while the timetables are restored, and used
#      to page every time the cron landed in it. So before paging, the server
#      is asked over ssh how long the delaybahn unit has been up: started less
#      than RESTART_GRACE seconds ago (or mid stop/start) is a restart, and the
#      check keeps retrying, DOWN_RETRIES tries in all, until it answers.
#      Anything else - up for longer and still failing, failed, stopped, or no
#      answer over ssh - pages at once, on the old 30 s timing. The whole run
#      stays under the 5-min cron period (6 tries of at most 20 s, 150 s of
#      waiting, 12 s for the ssh).
#   2. UPSTREAM BLOCKED: bahn.de (Akamai) hard-blocking the server IP, detected
#      from /health's own counters: upstream_403 rising while upstream_200 stays
#      flat. During the 2026-08-19 OPS_BLOCKED incident the app stayed healthy
#      (circuit breaker + stale cache) and /health stayed 200, so neither the
#      systemd OnFailure hooks nor the old status-code check ever fired.
#      A block is not self-healing (it needs an IP move), so unlike check 1 it
#      keeps re-paging every BLOCK_REMIND_SECONDS until 200s return, carrying
#      the elapsed duration so the reminders read as one ongoing incident.
#   3. GREY MAP: the all-trains map's German dots turn grey (timetable only)
#      when the realtime feed stops matching our trips. /health fleet.rtTrips is
#      ~3,900 by day; on 2026-10-03 a gtfs.de timetable release with renumbered
#      trips dropped it to ~300 for hours, unnoticed. Alerts after
#      GREY_WINDOWS consecutive windows of rtTrips < GREY_MIN_TRIPS or a feed
#      read older than 10 min, 07-22 Berlin only (few trains run at night), and
#      once more on recovery. A restart's rebuild (rtTrips 0 for ~5 min) stays
#      under the window count.
#   4. COUNTRY MISSING: a country with zero trains on the live map. /health
#      stays green when the map breaks: on 2026-10-23/24 every /api/fleet
#      answered 500 for ~10 h and again for an hour, unnoticed. Asks /api/fleet
#      for all of Europe, as the page does, counts trains per country (the
#      countries come from /health's fleet block), and alerts per country after
#      EMPTY_WINDOWS consecutive windows at zero - an /api/fleet error counts as
#      zero everywhere - and once more on recovery. Around the clock; the window
#      count covers a restart's rebuild (Austria took 11 min on 2026-10-24).
#
# Testing: DRY_RUN=1 prints alerts instead of sending; HEALTH_FILE=<path>
# feeds the detector a canned /health body instead of hitting the network
# (FLEET_FILE likewise for /api/fleet);
# BLOCK_REMIND_SECONDS=0 makes every window re-page so the reminder path can
# be exercised without waiting.
#
# This repo copy is the canonical source; the installed copy is separate so
# branch switches in the dev checkout never change what cron runs. Install:
#   mkdir -p ~/.config/delaybahn
#   printf %s '<ntfy-topic>' > ~/.config/delaybahn/ntfy-topic
#   chmod 600 ~/.config/delaybahn/ntfy-topic
#   cp scripts/delaybahn-watchdog.sh ~/.local/bin/delaybahn-watchdog.sh
#   crontab: */5 * * * * $HOME/.local/bin/delaybahn-watchdog.sh
# An ntfy topic is a bearer secret: anyone who knows the name can read every
# alert and post convincing fake ones. This repo is public, so the topic is NOT
# stored here — put it in ~/.config/delaybahn/ntfy-topic (chmod 600) or pass
# NTFY_TOPIC in the environment.
TOPIC=${NTFY_TOPIC:-$(cat "${HOME}/.config/delaybahn/ntfy-topic" 2>/dev/null)}
STATE="${HOME}/.local/state/delaybahn-watchdog"
UPSTATE="${HOME}/.local/state/delaybahn-watchdog-upstream.json"
GREYSTATE="${HOME}/.local/state/delaybahn-watchdog-grey.json"
GREY_MIN_TRIPS=${GREY_MIN_TRIPS:-1500}
GREY_WINDOWS=${GREY_WINDOWS:-3}
EMPTYSTATE="${HOME}/.local/state/delaybahn-watchdog-empty.json"
EMPTY_WINDOWS=${EMPTY_WINDOWS:-4}
# how often an unresolved block re-pages; rounds up to the 5-min cron period
BLOCK_REMIND_SECONDS=${BLOCK_REMIND_SECONDS:-600}
DOWN_RETRIES=${DOWN_RETRIES:-5}
DOWN_RETRY_SECONDS=${DOWN_RETRY_SECONDS:-30}
RESTART_GRACE=${RESTART_GRACE:-180}
HEALTH_URL=${HEALTH_URL:-https://delaybahn.com/health}
# for tests: another unit to ask about, another ntfy server, a marker in the title
SERVICE_UNIT=${SERVICE_UNIT:-delaybahn}
NTFY_URL=${NTFY_URL:-https://ntfy.sh}
ALERT_PREFIX=${ALERT_PREFIX:-}
# ssh alias, resolved in ~/.ssh/config — the origin IP is deliberately not
# recorded here: delaybahn.com is fronted by a Cloudflare tunnel, and naming
# the origin in a public repo would hand out a way around it
SERVER="delaybahn_hetzner3"
mkdir -p "$(dirname "$STATE")"

notify() {  # $1 title, $2 priority, $3 tags, $4 body
  if [ -n "$DRY_RUN" ]; then
    echo "NOTIFY [$2] $1 :: $4"
  elif [ -z "$TOPIC" ]; then
    # loud rather than silent: a watchdog that cannot page is worse than no
    # watchdog, because it still looks installed. cron mails stderr, and the
    # non-zero exit shows up in any job-level monitoring.
    echo "delaybahn-watchdog: no ntfy topic configured (~/.config/delaybahn/ntfy-topic or NTFY_TOPIC); DROPPED alert: $1 :: $4" >&2
    exit 78   # EX_CONFIG
  else
    # -f: a page ntfy refused counts as not sent, so the caller can try again
    curl -4 -s -f -m 10 -d "$4" -H "Title: $ALERT_PREFIX$1" -H "Priority: $2" -H "Tags: $3" \
      "$NTFY_URL/$TOPIC" >/dev/null
  fi
}

# ---------------------------------------------------------------- fetch
if [ -n "$HEALTH_FILE" ]; then
  body=$(cat "$HEALTH_FILE" 2>/dev/null); code=200
else
  # one request per try: the status code rides behind the body on its own line
  probe() {
    local out
    out=$(curl -4 -s --max-time 20 -w '\n%{http_code}' "$HEALTH_URL")
    code=${out##*$'\n'}
    body=${out%$'\n'*}
  }
  # "<ActiveState> <seconds since the unit became active>", empty when the
  # server does not answer; SERVICE_STATE stands in for the ssh in tests
  service_state() {
    if [ -n "${SERVICE_STATE+x}" ]; then echo "$SERVICE_STATE"; return; fi
    timeout 12 ssh -o BatchMode=yes -o ConnectTimeout=8 "root@$SERVER" \
      "u=$SERVICE_UNIT;"' s=$(systemctl show "$u" -p ActiveState --value); t=$(systemctl show "$u" -p ActiveEnterTimestampMonotonic --value); echo "$s $(( $(cut -d. -f1 /proc/uptime) - t / 1000000 ))"' 2>/dev/null
  }
  probe
  # one retry rides out transient network/DNS flakes on this box
  why=""; restarting=""
  if [ "$code" != "200" ]; then
    sleep "$DOWN_RETRY_SECONDS"
    probe
  fi
  if [ "$code" != "200" ]; then
    read -r unit age <<<"$(service_state)"
    case "$unit" in
      activating|deactivating|reloading) restarting=1 ;;
      # an age that is not a plain number is no evidence of a restart
      active) case "$age" in ''|*[!0-9]*) ;; *) [ "$age" -lt "$RESTART_GRACE" ] && restarting=1 ;; esac ;;
    esac
    if [ -n "$restarting" ]; then
      tries=1
      while [ "$code" != "200" ] && [ "$tries" -lt "$DOWN_RETRIES" ]; do
        sleep "$DOWN_RETRY_SECONDS"
        tries=$((tries + 1))
        probe
      done
      why="the service was restarted and has not come back after $((DOWN_RETRIES * DOWN_RETRY_SECONDS)) s"
    elif [ -z "$unit" ]; then
      why="the server does not answer over ssh either"
    elif [ "$unit" = "active" ]; then
      why="the service has been running for ${age} s, so this is not a restart"
    else
      why="the service is $unit"
    fi
  fi
fi

# ---------------------------------------------------------------- check 1: down
prev=$(cat "$STATE" 2>/dev/null || echo up)
if [ "$code" = "200" ]; then
  if [ "$prev" = "down" ]; then
    notify "delaybahn recovered" default white_check_mark \
      "delaybahn.com is back up (HTTP $code)."
  fi
  echo up > "$STATE"
else
  # "down" is only recorded once the page has gone out: a page ntfy did not
  # take leaves the state as it was, and the next run pages again
  if [ "$prev" = "down" ] || notify "delaybahn.com DOWN" urgent rotating_light \
      "delaybahn.com health check failed (HTTP $code): ${why:-no detail}. Check: ssh $SERVER 'systemctl status delaybahn cloudflared-delaybahn'"; then
    echo down > "$STATE"
  else
    echo "delaybahn-watchdog: the DOWN page could not be sent; retrying on the next run" >&2
  fi
  exit 0   # counters unavailable; nothing for check 2 to do
fi

# ------------------------------------------------- check 2: upstream hard block
# the body is handed over via the environment: python3 - reads its *program*
# from stdin, so piping the JSON in as well would silently starve json.load
verdict=$(HEALTH_BODY="$body" REMIND="$BLOCK_REMIND_SECONDS" python3 - "$UPSTATE" <<'PY'
import json, os, sys, time

state_path = sys.argv[1]
remind = int(os.environ.get("REMIND", "600"))
try:
    c = json.loads(os.environ["HEALTH_BODY"]).get("upstream", {}).get("counters", {})
except Exception:
    sys.exit(0)                     # odd body; availability is check 1's job
cur403, cur200 = c.get("upstream_403", 0), c.get("upstream_200", 0)

st = {}
if os.path.exists(state_path):
    try: st = json.load(open(state_path))
    except Exception: st = {}
prev403, prev200 = st.get("c403"), st.get("c200")
streak, blocked = st.get("streak", 0), st.get("blocked", False)
now = time.time()
# a state file written before reminders existed has neither key; anchoring both
# to now costs at most one reminder interval of silence, where defaulting to 0
# would fire a "blocked for 20323 min" reminder on the very first run
since = st.get("since") or now
last = st.get("last_alert") or now

if prev403 is not None:
    # counters reset when the app restarts (daily pipeline restart): a decrease
    # means they started over, so the current value IS the delta since restart
    d403 = cur403 if cur403 < prev403 else cur403 - prev403
    d200 = cur200 if cur200 < prev200 else cur200 - prev200
    bad  = d403 >= 3  and d200 == 0     # 403s and not a single success
    hard = d403 >= 20 and d200 == 0     # unambiguous, alert without waiting
    streak = streak + 1 if bad else 0
    if (streak >= 2 or hard) and not blocked:
        blocked, since, last = True, now, now
        print(f"BLOCKED {d403}")
    elif blocked and d200 > 0:
        blocked = False
        print(f"RECOVERED {d200}")
    elif blocked and now - last >= remind - 60:
        # Still blocked, still zero successes. The 60s of slack absorbs cron
        # jitter: without it a 600s reminder measured against a 300s cron that
        # fired a second late would slip to the third window, i.e. 15 min.
        # Deliberately also fires when d403 is 0 (no traffic, so no evidence
        # either way) — the block is unresolved until 200s actually return.
        last = now
        print(f"STILL {d403} {int((now - since) // 60)}")

json.dump({"c403": cur403, "c200": cur200, "streak": streak, "blocked": blocked,
           "since": since, "last_alert": last}, open(state_path, "w"))
PY
)

# The app's own fingerprint self-heal (app/profile_heal.py), reported from
# /health upstream.profiles as one 🧬 line under every block page.
cffi=$(HEALTH_BODY="$body" python3 - <<'PY'
import json, os
try:
    p = json.loads(os.environ["HEALTH_BODY"])["upstream"]["profiles"]
except Exception:
    raise SystemExit(0)   # a build without the self-heal
ver, sw, up = p.get("curlCffi"), p.get("sweep") or {}, p.get("upgrade") or {}
fmt = lambda names: ", ".join(names) or "none"
if p.get("upgradePending"):
    line = (f"curl_cffi {ver}: none of the {sw.get('tried')} profiles tried passes; "
            "upgrading curl_cffi now")
elif up and up.get("at", "") >= sw.get("at", ""):
    r = up.get("result")
    if r == "upgraded":
        line = (f"curl_cffi upgraded {up['from']} -> {up['to']}, now using {fmt(up['working'])}. "
                "uv.lock on the server changed: commit it to the repo")
    elif r == "upgraded-none":
        line = (f"curl_cffi upgraded {up['from']} -> {up['to']}, but none of its "
                f"{up.get('tried')} profiles passes either (kept; uv.lock on the server changed)")
    elif r == "newest":
        line = (f"curl_cffi profile update didn't work: none of the {sw.get('tried')} profiles in "
                f"{up['from']} passes and it is already the newest release")
    else:
        line = (f"curl_cffi upgrade failed ({r}): "
                f"{up.get('detail') or 'see journalctl -u delaybahn-cffi-upgrade'}")
elif sw.get("result") == "adopted":
    line = (f"curl_cffi {ver}: switched to {fmt(sw['working'])} "
            f"({len(sw['working'])} of {sw.get('tried')} tried pass)")
elif sw.get("result") == "none":
    line = f"curl_cffi {ver}: none of the {sw.get('tried')} profiles tried passes; upgrade requested"
else:
    line = f"curl_cffi {ver}: no profile sweep yet (active: {fmt(p.get('active', []))})"
print("\U0001F9EC " + line)
PY
)
cffi=${cffi:+$'\n\n'$cffi}

case "$verdict" in
  BLOCKED*)
    d403=${verdict#BLOCKED }
    notify "bahn.de is HARD-BLOCKING delaybahn" urgent "no_entry,rotating_light" \
      "Akamai is returning 403 to every bahn.de API call from the server IP ($d403 blocked, 0 succeeded in the last watchdog window). The site stays up on cached data but live journey search is dead. This is IP-scoped (same as 2026-08-19): verify with the curl-cffi probe from another IP, then plan an IP move. Check: curl -s https://delaybahn.com/health | python3 -m json.tool$cffi" ;;
  STILL*)
    read -r d403 mins <<<"${verdict#STILL }"
    notify "bahn.de STILL blocking delaybahn (${mins}m)" urgent "no_entry,rotating_light" \
      "Akamai has been 403ing every bahn.de API call from the server IP for ${mins} min ($d403 blocked, 0 succeeded in the last window). Live journey search is still dead; the site is serving cached data only. This does not clear on its own — it needs an IP move. Check: curl -s https://delaybahn.com/health | python3 -m json.tool$cffi" ;;
  RECOVERED*)
    notify "bahn.de unblocked delaybahn" default white_check_mark \
      "Upstream 200s are flowing again (${verdict#RECOVERED } in the last window). The Akamai block has lifted.$cffi" ;;
esac

# ------------------------------------------------------- check 3: grey map
grey=$(HEALTH_BODY="$body" MIN="$GREY_MIN_TRIPS" WINDOWS="$GREY_WINDOWS" python3 - "$GREYSTATE" <<'PY'
import json, os, sys
from datetime import datetime
from zoneinfo import ZoneInfo

state_path = sys.argv[1]
try:
    f = json.loads(os.environ["HEALTH_BODY"]).get("fleet")
except Exception:
    sys.exit(0)
if not f:
    sys.exit(0)                     # map not installed on this build
st = {}
if os.path.exists(state_path):
    try: st = json.load(open(state_path))
    except Exception: st = {}
streak, alerted = st.get("streak", 0), st.get("alerted", False)
trips, age = f.get("rtTrips", 0), f.get("liveAgeSeconds")
hour = datetime.now(ZoneInfo("Europe/Berlin")).hour
bad = trips < int(os.environ["MIN"]) or age is None or age > 600
if alerted and not bad:
    alerted, streak = False, 0
    print(f"RECOVERED {trips}")
elif 7 <= hour < 22:
    streak = streak + 1 if bad else 0
    if streak >= int(os.environ["WINDOWS"]) and not alerted:
        alerted = True
        print(f"GREY {trips} {age if age is not None else 'none'} {f.get('feedAgeHours')}")
else:
    streak = 0
json.dump({"streak": streak, "alerted": alerted}, open(state_path, "w"))
PY
)

case "$grey" in
  GREY*)
    read -r trips age feedh <<<"${grey#GREY }"
    notify "delaybahn map dots grey" high "world_map,warning" \
      "$trips German trips match the realtime feed (alert below $GREY_MIN_TRIPS, normal ~3,900 by day); last feed read ${age}s ago, timetable ${feedh}h old. Likely a gtfs.de timetable release not yet loaded, or the realtime feed down. Check: curl -s https://delaybahn.com/health | python3 -m json.tool (fleet)" ;;
  RECOVERED*)
    notify "delaybahn map live again" default white_check_mark \
      "${grey#RECOVERED } German trips match the realtime feed again." ;;
esac

# ------------------------------------------------- check 4: country missing
# the snapshot (~1 MB by day) goes over as a file: past 128 KB an environment
# variable fails exec with "Argument list too long"
if [ -n "$FLEET_FILE" ]; then
  fleet_file=$FLEET_FILE; fcode=200
else
  ts=$(date +%s)
  fleet_file=$(mktemp)
  trap 'rm -f "$fleet_file"' EXIT
  fcode=$(curl -4 -s -o "$fleet_file" -w '%{http_code}' --max-time 90 \
    "https://delaybahn.com/api/fleet?bbox=-5,36,25,60&from=$((ts - 30))&to=$((ts + 180))&simple=1&regional=1")
fi
empty=$(HEALTH_BODY="$body" FCODE="$fcode" WINDOWS="$EMPTY_WINDOWS" python3 - "$EMPTYSTATE" "$fleet_file" <<'PY'
import json, os, sys
from collections import Counter

state_path = sys.argv[1]
try:
    f = json.loads(os.environ["HEALTH_BODY"]).get("fleet")
except Exception:
    sys.exit(0)
if not f:
    sys.exit(0)                     # map not installed on this build
countries = ["de"] + [k for k, v in f.items() if isinstance(v, dict) and "liveAgeSeconds" in v]
counts, err = Counter(), None
if os.environ["FCODE"] != "200":
    err = f"/api/fleet HTTP {os.environ['FCODE']}"
else:
    try:
        counts = Counter(t.get("cc") or "de" for t in json.load(open(sys.argv[2]))["trains"])
    except Exception:
        err = "/api/fleet unreadable"
st = {}
if os.path.exists(state_path):
    try: st = json.load(open(state_path))
    except Exception: st = {}
# one alert per check, naming every country that crossed: a broken /api/fleet
# empties all of them at once
gone, back = [], []
for cc in countries:
    c = st.get(cc, {"streak": 0, "alerted": False})
    n = counts.get(cc, 0)
    if n:
        if c["alerted"]:
            back.append(f"{cc.upper()} {n}")
        c = {"streak": 0, "alerted": False}
    else:
        c["streak"] += 1
        if c["streak"] >= int(os.environ["WINDOWS"]) and not c["alerted"]:
            c["alerted"] = True
            gone.append(cc.upper())
    st[cc] = c
json.dump(st, open(state_path, "w"))
if gone:
    print(f"EMPTY {','.join(gone)} {err or 'zero trains in the response'}")
if back:
    print(f"RECOVERED {', '.join(back)}")
PY
)

while read -r kind rest; do
  case "$kind" in
    EMPTY)
      read -r names why <<<"$rest"
      notify "delaybahn map: no ${names//,/, } trains" high "world_map,warning" \
        "The live map has shown zero trains for ${names//,/, } in $EMPTY_WINDOWS checks in a row (~$((EMPTY_WINDOWS * 5)) min): $why. Check: ssh $SERVER 'journalctl -u delaybahn --since -20min | grep -E \"Error|Traceback\"' and curl -s https://delaybahn.com/health | python3 -m json.tool (fleet)" ;;
    RECOVERED)
      notify "delaybahn map: trains back" default white_check_mark \
        "On the live map again: $rest trains." ;;
  esac
done <<<"$empty"
