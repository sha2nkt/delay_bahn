"""What happens to a mail after Brevo took it. The SMTP hand-off in mailer.py
only proves the relay accepted the message; a recipient's server can still
refuse it seconds later, and that verdict reaches us only through Brevo's
webhook. Without it a refused login code is invisible on both ends: the
visitor waits for a mail that will never come, and nothing pages anyone -
which is exactly how a month of web.de/GMX refusals went unnoticed in
September 2026 (delaybahn.com had landed on the Spamhaus DBL).

Two consumers:

- The login page. Each code request hands back an opaque ticket; the page
  polls /api/auth/email-code/status with it for a minute or so and, on a
  bounce, says why instead of leaving the visitor staring at an empty inbox.
- ntfy. Only patterns page: a provider-policy/blocklist refusal (always
  worth a look), or several refusals from one domain within the hour. A
  single typo'd or full mailbox is the visitor's business, not an incident.
  One cooldown covers all domains: a blocked sender domain is refused by a
  whole provider family at once (web.de, gmx.*, and every custom domain
  hosted at IONOS), and replaying September 2026 through per-domain
  cooldowns paged 99 times for that one incident.

Everything lives in memory, keyed by a hash of the address, and is dropped
after STATE_TTL: no part of a login touches this server's disk (see
auth._CODES), and a restart merely forgets which mails bounced in the last
half hour. A single uvicorn worker is assumed, as everywhere else in-process
state is kept.
"""

import hashlib
import hmac
import logging
import os
import re
import secrets
import threading
import time
from collections import Counter, deque

from app.config import env_int
from app.mailer import _alert

log = logging.getLogger(__name__)

# how long a ticket and an address's delivery state are kept - comfortably
# past auth.CODE_TTL_MINUTES, after which the code is useless anyway
STATE_TTL = 30 * 60

# Brevo's transactional webhook event names
_DELIVERED = {"delivered"}
_INVALID = {"hard_bounce", "invalid_email", "blocked"}  # blocked = Brevo's own suppression list
_SOFT = {"soft_bounce"}
_COMPLAINT = {"spam"}

_FULL = re.compile(r"out of storage|over ?quota|quota exceeded|mailbox (is )?full|\b[45]\.2\.2\b", re.I)
_GONE = re.compile(r"does not exist|no such user|unknown user|user unknown|\b5\.1\.1\b", re.I)
# refusals aimed at the sender rather than the recipient: one is enough to page
_POLICY = re.compile(r"policy|spamhaus|block ?list|black ?list|\bdbl\b|reputation|\b5\.7\.1\b", re.I)
_ADDRESS = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")

BOUNCE_ALERT_THRESHOLD = env_int("BOUNCE_ALERT_THRESHOLD", 3)
BOUNCE_ALERT_WINDOW = env_int("BOUNCE_ALERT_WINDOW", 3600)
BOUNCE_ALERT_COOLDOWN = env_int("BOUNCE_ALERT_COOLDOWN", 12 * 3600)

_lock = threading.Lock()
_tickets: dict[str, tuple[str, float]] = {}   # ticket -> (address key, issued at)
_state: dict[str, dict] = {}                  # address key -> {"state", "reason", "at"}
_refusals: deque = deque()                    # (monotonic time, domain) within the window
_last_page: float | None = None
_counts = {"delivered": 0, "invalid": 0, "full": 0, "rejected": 0, "complaints": 0}
_last_bounce: str | None = None


def enabled() -> bool:
    return bool(os.environ.get("BREVO_WEBHOOK_SECRET"))


def authorized(token: str | None) -> bool:
    secret = os.environ.get("BREVO_WEBHOOK_SECRET")
    return bool(secret and token) and hmac.compare_digest(token.encode(), secret.encode())


def _key(email: str) -> str:
    return hashlib.sha256(email.strip().lower().encode()).hexdigest()


def _prune(now: float) -> None:
    for ticket, (_, at) in list(_tickets.items()):
        if now - at > STATE_TTL:
            del _tickets[ticket]
    for key, entry in list(_state.items()):
        if now - entry["at"] > STATE_TTL:
            del _state[key]


def issue_ticket(email: str, fresh: bool = True) -> str:
    """The handle the page polls with. `fresh` = a new mail just went out, so
    the previous verdict for this address is forgotten; otherwise the ticket
    follows whatever mail is already on its way."""
    ticket = secrets.token_urlsafe(16)
    now = time.time()
    with _lock:
        _prune(now)
        key = _key(email)
        _tickets[ticket] = (key, now)
        if fresh or key not in _state:
            _state[key] = {"state": "pending", "reason": None, "at": now}
    return ticket


def ticket_status(ticket: str) -> dict:
    with _lock:
        held = _tickets.get(ticket)
        if held is None or time.time() - held[1] > STATE_TTL:
            return {"state": "unknown", "reason": None}
        entry = _state.get(held[0]) or {"state": "pending", "reason": None}
        return {"state": entry["state"], "reason": entry["reason"]}


def classify(event: str, reason: str) -> str | None:
    """The page-facing verdict for one webhook event: delivered, invalid
    (no such mailbox), full, rejected (the provider refused us), or None for
    events that change nothing (opens, clicks, deferrals Brevo retries)."""
    if event in _DELIVERED:
        return "delivered"
    if event in _INVALID:
        return "invalid"
    if event in _SOFT:
        # the wording beats the status code: relays send "5.2.2 ... does not exist"
        if _GONE.search(reason):
            return "invalid"
        if _FULL.search(reason):
            return "full"
        return "rejected"
    return None


def _scrub(reason: str) -> str:
    # bounce texts often quote the recipient; the push never carries one
    return _ADDRESS.sub("<address>", " ".join(reason.split()))[:300]


def _pattern_alert(domain: str, reason: str, tag: str) -> str | None:
    """Record one provider refusal; return the page to send, if any."""
    global _last_page
    now = time.monotonic()
    _refusals.append((now, domain))
    while _refusals and now - _refusals[0][0] > BOUNCE_ALERT_WINDOW:
        _refusals.popleft()
    if _last_page is not None and now - _last_page < BOUNCE_ALERT_COOLDOWN:
        return None
    by_domain = Counter(d for _, d in _refusals)
    policy = bool(_POLICY.search(reason))
    if not policy and by_domain[domain] < BOUNCE_ALERT_THRESHOLD:
        return None
    _last_page = now
    what = f" ({tag} mail)" if tag else ""
    domains = ", ".join(f"{d} x{n}" for d, n in by_domain.most_common(6))
    return (f"Mail refused by {domains} in the last {BOUNCE_ALERT_WINDOW // 60} min{what}. "
            f"{'Looks like a sender block - check blocklists (Spamhaus DBL). ' if policy else ''}"
            f"Reply: {_scrub(reason)} "
            f"(next alert at the earliest in {BOUNCE_ALERT_COOLDOWN // 3600} h)")


def handle_event(payload: dict) -> None:
    """One Brevo webhook call. Never raises on odd payloads - a webhook that
    errors is retried and eventually disabled by Brevo."""
    global _last_bounce
    event = str(payload.get("event") or "")
    email = str(payload.get("email") or "")
    reason = str(payload.get("reason") or "")
    tags = payload.get("tags") or ([payload["tag"]] if payload.get("tag") else [])
    tag = str(tags[0]) if tags else ""
    domain = email.rpartition("@")[2].lower()

    alert = None
    if event in _COMPLAINT:
        with _lock:
            _counts["complaints"] += 1
        alert = f"Spam complaint from a {domain} recipient ({tag or 'untagged'} mail)."
    verdict = classify(event, reason)
    if verdict is not None and email:
        now = time.time()
        with _lock:
            _counts[verdict] += 1
            key = _key(email)
            entry = _state.get(key)
            # only addresses with a live login ticket are tracked for the page;
            # a bounce never downgrades back to delivered
            if entry is not None and entry["state"] != "bounced":
                if verdict == "delivered":
                    entry.update(state="delivered", at=now)
                else:
                    entry.update(state="bounced", reason=verdict, at=now)
            if verdict != "delivered":
                _last_bounce = f"{verdict} {domain}: {_scrub(reason)}"[:300]
            if verdict == "rejected":
                alert = _pattern_alert(domain, reason, tag)
        if verdict != "delivered":
            log.info("mail %s: %s (%s)", verdict, domain, _scrub(reason))
    if alert:
        _alert(alert, priority="high")


def status() -> dict:
    """In-memory only - /health calls this."""
    with _lock:
        return {"webhook": enabled(), **_counts, "lastBounce": _last_bounce}
