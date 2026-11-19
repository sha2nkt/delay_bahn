"""Reading a photographed ticket for the claim form.

The claim form at /antrag lives in the browser: a PDF ticket is parsed
there and never arrives here. A photo or a scan cannot be read that way, so
- only after the visitor ticked the consent for it - the page posts the image
and this hands it to a small vision model for the handful of fields the form
needs. The image is held in memory for the length of the call: it is not
written to disk, not logged, and nothing about the answer is kept.
"""

import base64
import binascii
import json
import logging
import os

import anthropic
import httpx2

from app.ratelimit import SlidingWindowLimiter

log = logging.getLogger("delaybahn.claim")

# a phone photo the page already scaled down to 1800 px stays far below this
IMAGE_MAX_BYTES = 3 * 1024 * 1024
# the JSON body around it: base64 adds a third
BODY_MAX_BYTES = 5 * 1024 * 1024
# per account: a few retries for a blurry photo, not a free OCR service
read_limiter = SlidingWindowLimiter(3, 60.0, 12, 24 * 3600.0)

_MAGIC = {"image/jpeg": b"\xff\xd8\xff", "image/png": b"\x89PNG\r\n\x1a\n"}

_SYSTEM = (
    "You read a photo or scan of a Deutsche Bahn train ticket and return the "
    "fields a passenger-rights claim form needs. Copy what is printed; never "
    "guess. A field that is not legible or not on the ticket is the empty "
    "string. The journey is the rail part only: ignore bus, tram and walking "
    "legs before or after it. Dates are YYYY-MM-DD, times are HH:MM (24 h). "
    "price is the total as printed, with a decimal comma, without the "
    "currency. trains lists the rail legs in travel order, comma separated, "
    "e.g. 'ICE 990, RE 19367'. name is the passenger or customer the "
    "document is made out to: the person's first and last name, without a "
    "title such as 'Dr.' and without a company or institute line. street, "
    "house, zip and city are that person's postal address when one is "
    "printed (never Deutsche Bahn's own address): house is the house "
    "number alone, street the street name without it. invoice is true when "
    "the document is an invoice for a ticket ('Rechnung', 'Rechnungsnummer', "
    "'Dieses Dokument berechtigt nicht zur Fahrt') and not the ticket "
    "itself. db says whether Deutsche Bahn issued the "
    "ticket: its logo, 'Deutsche Bahn', 'DB AG', bahn.de or an "
    "'Auftragsnummer' is printed on it. A ticket of another railway or "
    "seller (e.g. FlixTrain, SNCF, ÖBB, a transport association) is false. "
    "If the image is not a train ticket, db is false and every field empty."
)
_FIELDS = ["name", "street", "house", "zip", "city",
           "booking", "price", "date", "from", "to", "dep", "arr", "trains"]
_FORMAT = {
    "type": "json_schema",
    "schema": {
        "type": "object",
        "properties": {"db": {"type": "boolean"}, "invoice": {"type": "boolean"},
                       **{field: {"type": "string"} for field in _FIELDS}},
        "required": ["db", "invoice", *_FIELDS],
        "additionalProperties": False,
    },
}

_MAX_TOKENS = 4000

_client: anthropic.AsyncAnthropic | None = None


def enabled() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def decode_image(data_url: str) -> tuple[str, str]:
    """A base64 image data URL -> (mime, base64 payload), checked to be the
    JPEG or PNG it claims and within the size limit. Raises ValueError."""
    header, sep, payload = data_url.partition(",")
    if not sep or not header.startswith("data:") or not header.endswith(";base64"):
        raise ValueError("not a base64 data URL")
    mime = header[len("data:"):-len(";base64")]
    if mime not in _MAGIC:
        raise ValueError(f"unsupported image type {mime!r}")
    try:
        raw = base64.b64decode(payload, validate=True)
    except binascii.Error as exc:
        raise ValueError("broken base64 payload") from exc
    if len(raw) > IMAGE_MAX_BYTES:
        raise ValueError("image too large")
    if not raw.startswith(_MAGIC[mime]):
        raise ValueError("payload does not match its declared image type")
    return mime, payload


async def read_ticket(mime: str, payload: str) -> dict | None:
    """The ticket's fields as the model read them, every value a string and
    unreadable ones empty, plus `db`: whether it is a Deutsche Bahn ticket,
    the only kind the claim form handles. None when it could not be read."""
    global _client
    if _client is None:
        # a direct connection, as in app.translate: the SDK would otherwise
        # mount whatever proxy the process environment names
        _client = anthropic.AsyncAnthropic(
            max_retries=1, timeout=45.0,
            http_client=anthropic.DefaultAsyncHttpxClient(
                transport=httpx2.AsyncHTTPTransport(), trust_env=False
            ),
        )
    try:
        response = await _client.messages.create(
            model=os.environ.get("CLAIM_MODEL", "claude-haiku-5-5"),
            # the model thinks before it answers, and that counts against this
            # limit: 600 was spent on a dense page before any field was written
            max_tokens=_MAX_TOKENS,
            system=_SYSTEM,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image",
                     "source": {"type": "base64", "media_type": mime, "data": payload}},
                    {"type": "text", "text": "Read this ticket."},
                ],
            }],
            output_config={"format": _FORMAT, "effort": "low"},
        )
        if response.stop_reason in ("refusal", "max_tokens"):
            log.warning("ticket photo could not be read: stopped on %s", response.stop_reason)
            return None
        fields = json.loads(next(b.text for b in response.content if b.type == "text"))
    except (anthropic.APIError, ValueError, StopIteration) as exc:
        # the reason only: never the image, never what was read from it
        log.warning("ticket photo could not be read: %s", type(exc).__name__)
        return None
    return {"db": fields.get("db") is True, "invoice": fields.get("invoice") is True,
            **{field: str(fields.get(field, ""))[:120] for field in _FIELDS}}


async def close() -> None:
    if _client is not None:
        await _client.close()
