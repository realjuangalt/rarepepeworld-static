#!/usr/bin/env python3
"""
Build rarepepe-supply.json: issued supply, destructions (burns), and circulating
supply per Rare Pepe asset from the TokenScan API. Counterparty allows destroying
supply via the protocol; we subtract destructions from issued to get circulating.

Data flow:
  - TokenScan GET /api/asset/{asset}  → issued supply, divisible
  - TokenScan GET /api/destructions/{asset} → sum(quantity) = destroyed
  - circulating = issued - destroyed
  - Optional rarepepe-supply-overrides.json merges in artist corrections

Reference: pepe.wtf has good Rare Pepe data for manual verification.
Overrides: when an artist tells us something is wrong, add an entry to
  data/rarepepe-supply-overrides.json and re-run this script.

Usage:
  python build_supply_data.py [--data-dir PATH] [--delay SEC] [--skip-destructions]
  --data-dir         Directory for Series_Data, overrides, output (default: ../data)
  --delay            Seconds between API requests (default: 1.0)
  --skip-destructions  Only fetch issued supply, set destroyed=0, circulating=issued

Requires: requests (pip install requests)
"""

from __future__ import annotations

import argparse
import json
import sys
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


def fetch_asset(asset: str, session: requests.Session) -> dict | None:
    """GET /api/asset/{asset}, return dict with supply, divisible or None."""
    url = f"{TOKENSCAN_API}/asset/{requests.utils.quote(asset)}"
    try:
        r = session.get(url, timeout=15)
        if not r.ok:
            return None
        data = r.json()
        if not isinstance(data, dict):
            return None
        return {
            "supply": data.get("supply"),
            "divisible": data.get("divisible", False),
        }
    except Exception:
        return None


def fetch_destructions(asset: str, session: requests.Session) -> str:
    """GET /api/destructions/{asset}, return sum of valid destruction quantities."""
    url = f"{TOKENSCAN_API}/destructions/{requests.utils.quote(asset)}"
    try:
        r = session.get(url, timeout=15)
        if not r.ok:
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


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Build rarepepe-supply.json from TokenScan (issued, destructions, circulating)"
    )
    ap.add_argument("--data-dir", type=Path, default=None, help="Data directory (default: ../data)")
    ap.add_argument("--delay", type=float, default=DEFAULT_DELAY, help="Delay between requests (seconds)")
    ap.add_argument(
        "--skip-destructions",
        action="store_true",
        help="Do not fetch destructions; set destroyed=0, circulating=issued",
    )
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
    assets = flatten_series(series_data)
    print(f"Found {len(assets)} Rare Pepe assets. Polling TokenScan API…")
    if overrides:
        print(f"  Applying {len(overrides)} overrides from rarepepe-supply-overrides.json")

    session = requests.Session()
    session.headers["User-Agent"] = "RarePepeWorld-Supply/1.0 (static site data)"

    result: dict = {}
    for i, asset in enumerate(assets, 1):
        if i % 50 == 0:
            print(f"  {i}/{len(assets)}…")
        ov = overrides.get(asset) or {}
        entry: dict = {}

        if "issued" in ov and ov.get("issued") is not None:
            entry["issued"] = str(ov["issued"])
            entry["divisible"] = ov.get("divisible", False)
        else:
            info = fetch_asset(asset, session)
            time.sleep(args.delay)
            if info and info.get("supply") is not None:
                entry["issued"] = str(info["supply"])
                entry["divisible"] = info.get("divisible", False)
            else:
                result[asset] = {"issued": None, "destroyed": "0", "circulating": None, "note": "API missing"}
                continue

        if "destroyed" in ov and ov.get("destroyed") is not None:
            entry["destroyed"] = str(ov["destroyed"])
        elif args.skip_destructions:
            entry["destroyed"] = "0"
        else:
            entry["destroyed"] = fetch_destructions(asset, session)
            time.sleep(args.delay)

        if "circulating" in ov and ov.get("circulating") is not None:
            entry["circulating"] = str(ov["circulating"])
        else:
            entry["circulating"] = compute_circulating(
                entry["issued"],
                entry["destroyed"],
                entry.get("divisible", False),
            )

        if ov.get("note"):
            entry["note"] = str(ov["note"])
        result[asset] = entry

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
