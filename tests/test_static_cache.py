"""Static files with a ?v= buster are cached for a year; without one, and the
HTML documents, they keep their short or revalidated caching."""

from fastapi.testclient import TestClient

from app import main


def client():
    # no context manager: the lifespan would load the delays DuckDB
    return TestClient(main.app)


def test_versioned_asset_is_immutable():
    res = client().get("/style.css?v=140")
    assert res.status_code == 200
    assert res.headers["cache-control"] == main.IMMUTABLE


def test_unversioned_asset_keeps_default_caching():
    res = client().get("/style.css")
    assert res.status_code == 200
    assert "immutable" not in res.headers.get("cache-control", "")


def test_html_document_stays_no_cache_even_with_a_query():
    res = client().get("/impressum.html?v=3")
    assert res.headers["cache-control"] == "no-cache"


def test_versioned_304_is_immutable_too():
    c = client()
    first = c.get("/logo.webp?v=1")
    res = c.get("/logo.webp?v=1", headers={"If-None-Match": first.headers["etag"]})
    assert res.status_code == 304
    assert res.headers["cache-control"] == main.IMMUTABLE
