#!/usr/bin/env python3
"""
Build rarepepe-supply.json: issued supply, destructions (burns), and circulating
supply per Rare Pepe asset from the TokenScan API. Counterparty allows destroying
supply via the protocol; we subtract destructions from issued to get circulating.

Data flow (minted / burn dynamics):
  - TokenScan GET /api/asset/{asset}  → current supply = circulating (API excludes destructions)
  - TokenScan GET /api/destructions/{asset} → sum(quantity) = destroyed
  - issued = circulating + destroyed  (original minted supply)
  - Optional rarepepe-supply-overrides.json merges in artist corrections

Run without --skip-destructions to fully populate issued/circulating/destroyed for
all assets. Use --delay to avoid rate limits (one request at a time per asset:
asset + destructions = 2 requests per asset).

Usage:
  python build_supply_data.py [--data-dir PATH] [--delay SEC] [--retries N] [--merge] [--skip-destructions]
  --data-dir           Directory for Series_Data, overrides, output (default: ../data)
  --delay              Seconds between API requests (default: 1.0)
  --retries            Retries per request on failure (default: 2)
  --merge              Only fetch assets missing issued (or with note "API missing"); merge into existing file
  --skip-destructions  Only fetch asset supply; set destroyed=0, circulating=issued (faster but incomplete)
  --limit N            Max assets to fetch (0 = all)

Requires: requests (pip install requests)
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from decimal import Decimal
from pathlib import Path
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    print("Install: pip install requests", file=sys.stderr)
    sys.exit(1)

TOKENSCAN_API = "https://tokenscan.io/api"
DEFAULT_DELAY = 1.0


def flatten_series(series_data: dict) -> list[str]:
    """Return sorted list of unique asset names from Series_Data."""
    names = set()
    for names_list in (series_data or {}).values():
        if isinstance(names_list, list):
            names.update(n for n in names_list if isinstance(n, str) and n.strip())
    return sorted(names)


def fetch_asset(asset: str, session: requests.Session, retries: int = 0) -> dict | None:
    """GET /api/asset/{asset}, return dict with supply, divisible or None."""
    url = f"{TOKENSCAN_API}/asset/{requests.utils.quote(asset)}"
    for attempt in range(retries + 1):
        try:
            r = session.get(url, timeout=15)
            if not r.ok:
                if attempt < retries:
                    time.sleep(2.0 * (attempt + 1))
                    continue
                return None
            data = r.json()
            if not isinstance(data, dict):
                return None
            return {
                "supply": data.get("supply"),
                "divisible": data.get("divisible", False),
            }
        except Exception:
            if attempt < retries:
                time.sleep(2.0 * (attempt + 1))
                continue
            return None
    return None


def fetch_destructions(asset: str, session: requests.Session, retries: int = 0) -> str:
    """GET /api/destructions/{asset}, return sum of valid destruction quantities."""
    url = f"{TOKENSCAN_API}/destructions/{requests.utils.quote(asset)}"
    for attempt in range(retries + 1):
        try:
            r = session.get(url, timeout=15)
            if not r.ok:
                if attempt < retries:
                    time.sleep(2.0 * (attempt + 1))
                    continue
                return "0"
            data = r.json()
            items = data.get("data") if isinstance(data, dict) else []
            if not isinstance(items, list):
                return "0"
            total = Decimal("0")
            for item in items:
                if item.get("status") != "valid":
                    continue
                qty = item.get("quantity")
                if qty is not None:
                    try:
                        total += Decimal(str(qty))
                    except Exception:
                        pass
            return str(total)
        except Exception:
            if attempt < retries:
                time.sleep(2.0 * (attempt + 1))
                continue
            return "0"


def compute_circulating(issued: str, destroyed: str, divisible: bool) -> str:
    """circulating = issued - destroyed. Preserve precision for divisible assets."""
    try:
        i = Decimal(str(issued))
        d = Decimal(str(destroyed))
        c = i - d
        if c < 0:
            c = Decimal("0")
        if divisible:
            return str(c)
        return str(int(c))
    except Exception:
        return str(issued)


def compute_issued(circulating: str, destroyed: str, divisible: bool) -> str:
    """issued = circulating + destroyed. TokenScan asset.supply is current (circulating)."""
    try:
        c = Decimal(str(circulating))
        d = Decimal(str(destroyed))
        i = c + d
        if divisible:
            return str(i)
        return str(int(i))
    except Exception:
        return str(circulating)


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Build rarepepe-supply.json from TokenScan (issued, destructions, circulating)"
    )
    ap.add_argument("--data-dir", type=Path, default=None, help="Data directory (default: ../data)")
    ap.add_argument("--delay", type=float, default=DEFAULT_DELAY, help="Delay between requests (seconds)")
    ap.add_argument("--retries", type=int, default=2, help="Retries per API request on failure (default: 2)")
    ap.add_argument(
        "--merge",
        action="store_true",
        help="Only fetch assets missing issued or with note 'API missing'; merge into existing rarepepe-supply.json",
    )
    ap.add_argument(
        "--skip-destructions",
        action="store_true",
        help="Do not fetch destructions; set destroyed=0, circulating=issued",
    )
    ap.add_argument("--limit", type=int, default=0, help="Max assets to fetch (0 = all)")
    args = ap.parse_args()

    script_dir = Path(__file__).resolve().parent
    data_dir = args.data_dir or (script_dir / ".." / "data")
    data_dir = data_dir.resolve()
    series_file = data_dir / "RarePepeDirectory_Series_Data.json"
    overrides_file = data_dir / "rarepepe-supply-overrides.json"
    out_file = data_dir / "rarepepe-supply.json"

    if not series_file.exists():
        print(f"Missing {series_file}", file=sys.stderr)
        sys.exit(1)

    overrides: dict = {}
    if overrides_file.exists():
        try:
            with open(overrides_file, encoding="utf-8") as f:
                raw = json.load(f)
            overrides = {
                k: v for k, v in raw.items()
                if isinstance(v, dict) and not k.startswith("_") and k != "_comment"
            }
        except Exception as e:
            print(f"Warning: could not load overrides: {e}", file=sys.stderr)

    with open(series_file, encoding="utf-8") as f:
        series_data = json.load(f)
    all_assets = flatten_series(series_data)
    if args.limit > 0:
        all_assets = all_assets[: args.limit]
        print(f"Limited to first {len(all_assets)} assets.")

    result: dict = {}
    assets_to_fetch: list[str] = all_assets
    if args.merge and out_file.exists():
        try:
            with open(out_file, encoding="utf-8") as f:
                existing = json.load(f)
            result = {k: v for k, v in existing.items() if k != "_meta" and isinstance(v, dict)}
            need_fetch = set()
            for a in all_assets:
                e = result.get(a)
                if e is None:
                    need_fetch.add(a)
                elif e.get("note") == "API missing" or e.get("issued") is None or e.get("issued") == "":
                    need_fetch.add(a)
            assets_to_fetch = sorted(need_fetch)
            print(f"Merge mode: {len(assets_to_fetch)} assets to re-fetch (missing or API missing), {len(result)} kept.")
        except Exception as e:
            print(f"Warning: could not load existing file for merge: {e}", file=sys.stderr)
            assets_to_fetch = all_assets

    if not assets_to_fetch and args.merge:
        print("Nothing to fetch. Exiting.")
        sys.exit(0)
    print(f"Polling TokenScan API for {len(assets_to_fetch)} assets (one request at a time, delay={args.delay}s, retries={args.retries})…")
    if overrides:
        print(f"  Applying {len(overrides)} overrides from rarepepe-supply-overrides.json")
    if not args.skip_destructions:
        print("  Fetching destructions so issued = circulating + destroyed.")

    session = requests.Session()
    session.headers["User-Agent"] = "RarePepeWorld-Supply/1.0 (static site data)"

    for i, asset in enumerate(assets_to_fetch, 1):
        if i % 50 == 0:
            print(f"  {i}/{len(assets_to_fetch)}…")
        ov = overrides.get(asset) or {}
        entry: dict = {}

        if "issued" in ov and ov.get("issued") is not None:
            entry["issued"] = str(ov["issued"])
            entry["divisible"] = ov.get("divisible", False)
        else:
            info = fetch_asset(asset, session, args.retries)
            time.sleep(args.delay)
            if info and info.get("supply") is not None:
                entry["circulating"] = str(info["supply"])
                entry["divisible"] = info.get("divisible", False)
            else:
                result[asset] = {"issued": None, "destroyed": "0", "circulating": None, "note": "API missing"}
                continue

        if "destroyed" in ov and ov.get("destroyed") is not None:
            entry["destroyed"] = str(ov["destroyed"])
        elif args.skip_destructions:
            entry["destroyed"] = "0"
        else:
            entry["destroyed"] = fetch_destructions(asset, session, args.retries)
            time.sleep(args.delay)

        if "circulating" in ov and ov.get("circulating") is not None:
            entry["circulating"] = str(ov["circulating"])
        if "issued" in entry:
            if "circulating" not in entry:
                entry["circulating"] = compute_circulating(
                    entry["issued"],
                    entry["destroyed"],
                    entry.get("divisible", False),
                )
        else:
            entry["issued"] = compute_issued(
                entry["circulating"],
                entry["destroyed"],
                entry.get("divisible", False),
            )

        if ov.get("note"):
            entry["note"] = str(ov["note"])
        result[asset] = entry

    for a in all_assets:
        if a not in result:
            result[a] = {"issued": None, "destroyed": "0", "circulating": None, "note": "API missing"}

    meta = {
        "source": "TokenScan API",
        "updated": datetime.now(timezone.utc).isoformat()[:19] + "Z",
        "overrides_applied": len(overrides) > 0,
        "skip_destructions": args.skip_destructions,
    }
    out = {"_meta": meta, **result}

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)

    print(f"Wrote {len(result)} assets to {out_file}")


if __name__ == "__main__":
    main()
