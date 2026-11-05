"""Every page's header logo is the small WebP with its size in the markup (no
layout shift while it loads); link previews keep the full-size PNG."""

import re

import pytest
from fastapi.testclient import TestClient

from app import main

PAGES = [
    "/", "/en/", "/entschaedigung", "/en/compensation",
    "/geschichten", "/stories", "/rangliste", "/leaderboard",
    "/login", "/meine-fahrten", "/en/my-trips", "/impressum.html",
    "/r/unsubscribe?token=nope",
]

HEADER_LOGO = re.compile(r'<a class="logo-link"[^>]*>\s*(<img[^>]*>)')


@pytest.fixture(scope="module")
def client():
    # no context manager: the lifespan would load the delays database
    return TestClient(main.app)


@pytest.mark.parametrize("path", PAGES)
def test_header_logo_is_the_webp_with_its_size(client, path):
    page = client.get(path).text
    logos = HEADER_LOGO.findall(page)
    assert logos, f"{path}: no header logo"
    for img in logos:
        assert re.search(r'src="/logo\.webp\?v=\d+"', img), img
        assert 'width="85"' in img and 'height="60"' in img, img


@pytest.mark.parametrize("path", PAGES)
def test_previews_keep_the_png(client, path):
    page = client.get(path).text
    for tag in re.findall(r'<meta (?:property="og:image"|name="twitter:image")[^>]*>', page):
        assert ".webp" not in tag, tag
    assert "logo.webp" not in " ".join(re.findall(r'<link rel="(?:image_src|apple-touch-icon)"[^>]*>', page))


def test_the_webp_is_served(client):
    r = client.get("/logo.webp?v=1")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/webp"
    assert len(r.content) < 30_000
