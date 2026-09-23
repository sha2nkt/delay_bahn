import argparse
import json
import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import duckdb
import httpx

PROJECT_ROOT = Path(__file__).resolve().parent.parent
API = "https://opendata.infrabel.be/api/explore/v2.1/catalog/datasets"
# yesterday's raw punctuality records; the dataset is replaced every morning and
# never holds more than that one day
D1_CSV = f"{API}/ruwe-gegevens-van-stiptheid-d-1/exports/csv?delimiter=%3B"
# index of the monthly raw files (mois "YYYY-MM" -> link_to_data), published around
# the 5th of the following month: the only way back to a day the D-1 pull missed
MONTH_INDEX = f"{API}/stiptheid-gegevens-maandelijksebestanden/exports/json"


def download(url: str, dest: Path):
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    with httpx.stream("GET", url, timeout=600, follow_redirects=True) as resp:
        resp.raise_for_status()
        with open(tmp, "wb") as f:
            for chunk in resp.iter_bytes(1 << 20):
                f.write(chunk)
    os.replace(tmp, dest)


def month_urls() -> dict[str, str]:
    resp = httpx.get(MONTH_INDEX, timeout=60, follow_redirects=True)
    resp.raise_for_status()
    return {r["mois"]: r["link_to_data"] for r in resp.json() if r.get("mois") and r.get("link_to_data")}


def load_raw(con: duckdb.DuckDBPyConnection, raw_csv: Path, stations: dict) -> list[date]:
    """Stage one Infrabel raw file (D-1 export or monthly file; same columns, other
    date spelling) as table `stops` in the site's delay schema. Returns the operating
    days it holds."""
    con.execute("CREATE OR REPLACE TABLE cw (ptcar VARCHAR, eva VARCHAR, name VARCHAR)")
    con.executemany("INSERT INTO cw VALUES (?, ?, ?)", [(k, v["eva"], v["name"]) for k, v in stations.items()])
    con.execute(f"CREATE OR REPLACE TABLE raw AS SELECT * FROM read_csv('{raw_csv}', header=true, all_varchar=true)")
    columns = {c.lower() for c in con.sql("SELECT * FROM raw LIMIT 0").columns}
    # The files list every operating point a train runs through. The monthly files
    # mark a passage in the planned/actual operation codes (P = passage, D = through
    # run; '=' is a stop). The D-1 export drops those columns; there a passage is one
    # timestamp, so planned and actual arrival both equal their departure (agrees with
    # the codes on 99.8 % of the August 2026 rows).
    if "op1_cod" in columns:
        passage = ("(OP1_COD IN ('P', 'D') OR THOP1_COD IN ('P', 'D'))"
                   " AND coalesce(OP1_COD, '') != '=' AND coalesce(THOP1_COD, '') != '='")
    else:
        passage = "PLANNED_TIME_ARR = PLANNED_TIME_DEP AND REAL_TIME_ARR = REAL_TIME_DEP"

    def ts(kind: str, side: str) -> str:
        joined = f"{kind}_DATE_{side} || ' ' || {kind}_TIME_{side}"
        return f"COALESCE(try_strptime({joined}, '%Y-%m-%d %H:%M:%S'), try_strptime({joined}, '%d%b%Y %H:%M:%S'))"

    con.execute(f"""
        CREATE OR REPLACE TABLE stops AS
        SELECT
            cw.name AS station_name,
            CAST(NULL AS VARCHAR) AS xml_station_name,
            cw.eva AS eva,
            ltrim(TRAIN_NO, '0') AS train_number,
            CAST(RELATION AS VARCHAR) AS line_number,
            CAST(NULL AS VARCHAR) AS final_destination_station,
            CAST(date_diff('minute', arr_plan, arr_real) AS INTEGER) AS delay_in_min,
            COALESCE(dep_real, arr_real, dep_plan, arr_plan) AS time,
            -- the raw files hold trains that ran; Infrabel publishes cancellations
            -- only as monthly totals
            false AS is_canceled,
            regexp_extract(RELATION, '^([A-Z]+)', 1) AS train_type,
            TRAIN_NO || ':' || strftime(op_day, '%Y-%m-%d') AS train_line_ride_id,
            CAST(NULL AS INTEGER) AS train_line_station_num,
            arr_plan AS arrival_planned_time,
            arr_real AS arrival_change_time,
            dep_plan AS departure_planned_time,
            dep_real AS departure_change_time,
            'BE:' || TRAIN_NO || ':' || strftime(op_day, '%Y-%m-%d') || ':' || cw.eva AS id,
            op_day
        FROM (
            SELECT *,
                CAST(COALESCE(try_strptime(DATDEP, '%Y-%m-%d'), try_strptime(DATDEP, '%d%b%Y')) AS DATE) AS op_day,
                {ts('PLANNED', 'ARR')} AS arr_plan, {ts('REAL', 'ARR')} AS arr_real,
                {ts('PLANNED', 'DEP')} AS dep_plan, {ts('REAL', 'DEP')} AS dep_real
            FROM raw
        ) r
        JOIN cw ON cw.ptcar = r.PTCAR_LG_NM_NL
        WHERE arr_plan IS NOT NULL AND arr_real IS NOT NULL AND op_day IS NOT NULL
          AND NOT coalesce({passage}, false)
    """)
    return [row[0] for row in con.sql("SELECT DISTINCT op_day FROM stops ORDER BY 1").fetchall()]


def write_day(con: duckdb.DuckDBPyConnection, day: date, out_parquet: Path) -> int:
    tmp = out_parquet.with_suffix(".parquet.tmp")
    con.execute(f"COPY (SELECT * EXCLUDE (op_day) FROM stops WHERE op_day = DATE '{day}') TO '{tmp}' (FORMAT PARQUET)")
    os.replace(tmp, out_parquet)
    return con.sql(f"SELECT count(*) FROM '{out_parquet}'").fetchone()[0]


def prune_old_days(days_dir: Path, cutoff: date):
    for f in sorted(days_dir.glob("*.parquet")):
        try:
            d = date.fromisoformat(f.stem)
        except ValueError:
            continue
        if d < cutoff:
            f.unlink()
            print(f"Pruned old BE day {d}")


def build_from(con, url: str, raw_csv: Path, stations: dict, missing: set[date], days_dir: Path) -> int:
    """Download one raw file and write every still-missing day it holds."""
    try:
        download(url, raw_csv)
        held = load_raw(con, raw_csv, stations)
        for d in held:
            if d in missing:
                rows = write_day(con, d, days_dir / f"{d}.parquet")
                missing.discard(d)
                print(f"{d}: {rows:_} train-stop rows")
        return 0
    except Exception as e:  # keep going; one bad file shouldn't kill the catch-up
        print(f"{url}: FAILED ({e})", file=sys.stderr)
        return 1
    finally:
        raw_csv.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description="Download Infrabel raw punctuality data and build per-day Belgian delay parquets")
    parser.add_argument("--days", type=int, default=31, help="days of data to keep current (default: 31)")
    parser.add_argument("--end-date", type=lambda s: date.fromisoformat(s), default=None, help="last day of the window, YYYY-MM-DD (default: yesterday in Europe/Berlin)")
    parser.add_argument("--data-dir", type=Path, default=PROJECT_ROOT / "data", help="base data directory")
    parser.add_argument("--stations", type=Path, default=PROJECT_ROOT / "config" / "be_stations.json", help="operating-point-name -> EVA crosswalk (build_be_stations.py)")
    parser.add_argument("--force", action="store_true", help="rebuild days whose parquet already exists")
    args = parser.parse_args()

    end_date = args.end_date or (datetime.now(ZoneInfo("Europe/Berlin")).date() - timedelta(days=1))
    wanted = [end_date - timedelta(days=d) for d in range(args.days)]
    raw_dir = args.data_dir / "be" / "raw"
    days_dir = args.data_dir / "be" / "days"
    days_dir.mkdir(parents=True, exist_ok=True)

    missing = {d for d in wanted if args.force or not (days_dir / f"{d}.parquet").exists()}
    if not missing:
        print("All BE day files up to date")
        prune_old_days(days_dir, end_date - timedelta(days=40))
        return

    stations = json.loads(args.stations.read_text())
    con = duckdb.connect()
    print(f"{len(missing)} day(s) to build")
    failures = build_from(con, D1_CSV, raw_dir / "d1.csv", stations, missing, days_dir)

    # whatever D-1 did not cover: a first fill, or a day the nightly pull missed
    months = sorted({d.strftime("%Y-%m") for d in missing})
    published = month_urls() if months else {}
    for month in months:
        if month not in published:
            print(f"{month}: monthly file not published yet, {sum(1 for d in missing if d.strftime('%Y-%m') == month)} day(s) stay open")
            continue
        print(f"{month}: downloading monthly file ...", flush=True)
        failures += build_from(con, published[month], raw_dir / f"{month}.csv", stations, missing, days_dir)

    prune_old_days(days_dir, end_date - timedelta(days=40))
    if failures:
        sys.exit(f"{failures} source file(s) failed")


if __name__ == "__main__":
    main()
