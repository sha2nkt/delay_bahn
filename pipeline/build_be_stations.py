import argparse
import csv
import io
import json
import math
import re
import time
import unicodedata
from pathlib import Path

import httpx
from curl_cffi import requests as curl_requests

PROJECT_ROOT = Path(__file__).resolve().parent.parent
# Infrabel operating points (CC0): the PTCAR long name used in the punctuality files,
# its class (station, stopping point, junction, ...) and coordinates
PTCAR_URL = "https://opendata.infrabel.be/api/explore/v2.1/catalog/datasets/operationele-punten-van-het-netwerk/exports/json"
TRAINLINE_CSV = "https://raw.githubusercontent.com/trainline-eu/stations/master/stations.csv"
ORTE_URL = "https://www.bahn.de/web/api/reiseloesung/orte"

PASSENGER_CLASSES = {"Station", "Stopplaats"}
# lid strings carry WGS84 coordinates as micro-degrees: X=longitude, Y=latitude
XY_RE = re.compile(r"@X=(-?\d+)@Y=(-?\d+)@")


def norm(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Z0-9]", "", ascii_name.upper())


def metres(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    return 6371000 * math.hypot(
        math.radians(lat2 - lat1), math.radians(lon2 - lon1) * math.cos(math.radians(lat1))
    )


def ptcar_universe(url: str) -> dict[str, dict]:
    """Infrabel PTCAR long name (as the punctuality files spell it) -> coordinates,
    passenger stations and stopping points only: the files also list every junction
    and yard a train passes."""
    resp = httpx.get(url, timeout=120, follow_redirects=True)
    resp.raise_for_status()
    out = {}
    for p in resp.json():
        if p.get("classification") not in PASSENGER_CLASSES or not p.get("geo_point_2d"):
            continue
        out[p["longnamedutch"].upper()] = {
            "lat": p["geo_point_2d"]["lat"], "lon": p["geo_point_2d"]["lon"],
            "name": p.get("commerciallongnamefrench") or p["longnamedutch"],
        }
    return out


def trainline_seed() -> list[dict]:
    """Belgian stations with a DB id. Rows without a UIC are terminals and bus bays
    of a station that is listed separately ("Bruxelles-Midi Eurostar"), a few metres
    from it and with an id bahn.de never returns for a train leg."""
    resp = httpx.get(TRAINLINE_CSV, timeout=120, follow_redirects=True)
    resp.raise_for_status()
    seed = []
    for row in csv.DictReader(io.StringIO(resp.text), delimiter=";"):
        if row.get("country") == "BE" and row.get("db_id") and row.get("uic") and row.get("latitude"):
            seed.append({
                "eva": row["db_id"].rjust(8, "0"), "name": row["name"],
                "lat": float(row["latitude"]), "lon": float(row["longitude"]),
            })
    return seed


def match_seed(point: dict, ptcar_name: str, seed: list[dict], near: float, named: float) -> tuple[dict, float] | None:
    """Nearest trainline station: accepted within `near` metres on position alone
    (the two lists spell bilingual names differently: BRUSSEL-ZUID / Bruxelles-Midi),
    or within `named` metres when the names agree (platform vs. building coordinates)."""
    best = min(seed, key=lambda s: metres(point["lat"], point["lon"], s["lat"], s["lon"]))
    dist = metres(point["lat"], point["lon"], best["lat"], best["lon"])
    if dist <= near or (dist <= named and norm(best["name"]) == norm(ptcar_name)):
        return best, dist
    return None


def lookup_bahn_de(session, ptcar_name: str, point: dict, max_m: float) -> dict | None:
    """Resolve a stop the seed lacks via bahn.de; accept only a Belgian rail stop
    (extId 88...) that sits where Infrabel puts the operating point."""
    resp = session.get(ORTE_URL, params={"suchbegriff": ptcar_name.title(), "typ": "ALL", "limit": 8}, timeout=30)
    resp.raise_for_status()
    for r in resp.json():
        ext = str(r.get("extId") or "")
        m = XY_RE.search(r.get("id", ""))
        if not ext.startswith("88") or len(ext) != 7 or not m:
            continue
        if metres(point["lat"], point["lon"], int(m.group(2)) / 1e6, int(m.group(1)) / 1e6) <= max_m:
            return {"eva": ext.rjust(8, "0"), "name": r.get("name") or ptcar_name.title()}
    return None


def main():
    parser = argparse.ArgumentParser(description="Build the Infrabel operating-point-name -> bahn.de-EVA station crosswalk")
    parser.add_argument("--out", type=Path, default=PROJECT_ROOT / "config" / "be_stations.json", help="output JSON path")
    parser.add_argument("--ptcar-url", default=PTCAR_URL, help="Infrabel operating points JSON export")
    parser.add_argument("--near-m", type=float, default=300, help="seed match radius on position alone")
    parser.add_argument("--named-m", type=float, default=1500, help="seed match radius when the names agree")
    parser.add_argument("--sleep", type=float, default=0.7, help="seconds between bahn.de queries")
    parser.add_argument("--limit", type=int, default=None, help="max bahn.de lookups this run (resume later)")
    args = parser.parse_args()

    existing = json.loads(args.out.read_text()) if args.out.exists() else {}
    universe = ptcar_universe(args.ptcar_url)
    seed = trainline_seed()
    print(f"Infrabel passenger stops: {len(universe)}, trainline seed: {len(seed)}, existing: {len(existing)}")

    # Infrabel classes a station's yards and sidings ("OOSTENDE-BUNDEL A",
    # "LIERS-FAISCEAU") as stations too, and they sit within reach of the same seed
    # entry; one operating point per EVA, the nearest, so no stop is counted twice
    nearest: dict[str, tuple[float, str, dict]] = {}
    for name, point in universe.items():
        hit = match_seed(point, name, seed, args.near_m, args.named_m)
        if hit and (hit[0]["eva"] not in nearest or hit[1] < nearest[hit[0]["eva"]][0]):
            nearest[hit[0]["eva"]] = (hit[1], name, hit[0])
    taken = {entry["eva"] for entry in existing.values()}
    out = dict(existing)
    for eva, (_, name, station) in nearest.items():
        if name not in out and eva not in taken:
            out[name] = {"eva": eva, "name": station["name"]}
    shadowed = {n for n, p in universe.items() if n not in out and match_seed(p, n, seed, args.near_m, args.named_m)}

    missing = [n for n in universe if n not in out and n not in shadowed]
    print(f"{len(out)} mapped from the seed, {len(missing)} to resolve via bahn.de")
    session = curl_requests.Session(impersonate="chrome")
    session.headers["Accept-Language"] = "de"
    looked_up = mapped = 0
    for name in missing:
        if args.limit is not None and looked_up >= args.limit:
            print(f"--limit {args.limit} reached, run again to continue")
            break
        looked_up += 1
        try:
            hit = lookup_bahn_de(session, name, universe[name], args.named_m)
        except Exception as e:
            print(f"{name}: lookup failed ({e})")
            time.sleep(args.sleep)
            continue
        if hit and hit["eva"] not in {e["eva"] for e in out.values()}:
            out[name] = hit
            mapped += 1
        else:
            print(f"{name}: unresolved")
        time.sleep(args.sleep)
    print(f"bahn.de lookups: {looked_up}, newly mapped: {mapped}")

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(dict(sorted(out.items())), ensure_ascii=False, indent=1) + "\n")
    print(f"Saved {args.out}: {len(out)} of {len(universe)} passenger stops mapped")


if __name__ == "__main__":
    main()
