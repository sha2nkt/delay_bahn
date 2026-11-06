"""DELAYBAHN_MAP=off: the public site runs without the map's routes and loops
and /health carries the map process's share, fetched from it."""
import asyncio

import httpx

from app import main


class _Stub(httpx.AsyncClient):
    def __init__(self, *a, **k):
        super().__init__(*a, **k, transport=httpx.MockTransport(self._reply))

    @staticmethod
    def _reply(req):
        assert req.url == httpx.URL("http://127.0.0.1:8010/health")
        return httpx.Response(200, json={"ok": True, "rows": 1, "fleet": {"trips": 5}, "traffic": {"ticks": 2},
                                         "trainLive": {}, "alarms": {}, "basemap": {}, "auth": {"x": 1}})


def test_health_merges_the_map_process_when_the_map_is_off(monkeypatch):
    monkeypatch.setattr(main, "MAP_MODE", "off")
    monkeypatch.setattr(main.httpx, "AsyncClient", _Stub)
    got = asyncio.run(main._map_health())
    assert got["map"] == "ok" and got["fleet"] == {"trips": 5} and got["traffic"] == {"ticks": 2}
    assert "auth" not in got and "rows" not in got, "only the map's keys are taken"


def test_an_unreachable_map_process_is_named_not_fatal(monkeypatch):
    monkeypatch.setattr(main, "MAP_MODE", "off")
    monkeypatch.setattr(main, "MAP_URL", "http://127.0.0.1:1")
    got = asyncio.run(main._map_health())
    assert got["map"].startswith("unreachable")


def test_inline_mode_adds_nothing_remote(monkeypatch):
    monkeypatch.setattr(main, "MAP_MODE", "inline")
    assert asyncio.run(main._map_health()) == {}
