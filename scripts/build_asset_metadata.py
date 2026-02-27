#!/usr/bin/env python3
"""
Build asset_metadata.json as the single source of truth for pepe data across the site.

Merges:
  - rarepepe-supply.json   → issued, destroyed, circulating, divisible, note
  - RarePepeDirectory_Series_Data.json → series (number as string)
  - RarePepeDirectory_Links.json      → rpd_url
  - existing asset_metadata.json (seed) → artist, supply_cap (fallback when issued missing)

Output: data/asset_metadata.json with one object per asset. The site should load only
this file for supply, cap, artist, series, and RPD link.

Usage:
  python build_asset_metadata.py [--data-dir PATH] [--seed PATH]
  --data-dir   Directory for inputs and output (default: ../data)
  --seed       Path to existing asset_metadata for artist/supply_cap (default: data-dir/asset_metadata.json)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from datetime import datetime, timezone


def flatten_series(series_data: dict) -> list[str]:
    """Return sorted list of unique asset names from Series_Data."""
    names = set()
    for names_list in (series_data or {}).values():
        if isinstance(names_list, list):
            names.update(n for n in names_list if isinstance(n, str) and n.strip())
    return sorted(names)


def build_asset_to_series(series_data: dict) -> dict[str, str]:
    """Map asset name -> series number (string)."""
    out = {}
    for series_num, names_list in (series_data or {}).items():
        if series_num == "_meta" or not isinstance(names_list, list):
            continue
        for n in names_list:
            if isinstance(n, str) and n.strip():
                out[n.strip()] = str(series_num)
    return out


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Build asset_metadata.json from rarepepe-supply, Series_Data, Links, and seed"
    )
    ap.add_argument("--data-dir", type=Path, default=None, help="Data directory (default: ../data)")
    ap.add_argument("--seed", type=Path, default=None, help="Existing asset_metadata for artist/supply_cap (default: data-dir/asset_metadata.json)")
    args = ap.parse_args()

    script_dir = Path(__file__).resolve().parent
    data_dir = args.data_dir or (script_dir / ".." / "data")
    data_dir = data_dir.resolve()
    seed_path = args.seed or (data_dir / "asset_metadata.json")

    supply_file = data_dir / "rarepepe-supply.json"
    series_file = data_dir / "RarePepeDirectory_Series_Data.json"
    links_file = data_dir / "RarePepeDirectory_Links.json"
    out_file = data_dir / "asset_metadata.json"

    for f in (supply_file, series_file, links_file):
        if not f.exists():
            print(f"Missing {f}", file=sys.stderr)
            sys.exit(1)

    supply_raw = json.loads(supply_file.read_text(encoding="utf-8"))
    series_data = json.loads(series_file.read_text(encoding="utf-8"))
    links_data = json.loads(links_file.read_text(encoding="utf-8"))

    # Seed: existing asset_metadata for artist and supply_cap (only these keys)
    seed: dict = {}
    if seed_path.exists():
        try:
            raw = json.loads(seed_path.read_text(encoding="utf-8"))
            for k, v in raw.items():
                if k.startswith("_"):
                    continue
                if isinstance(v, dict):
                    seed[k] = {
                        "artist": v.get("artist"),
                        "supply_cap": v.get("supply_cap"),
                    }
        except Exception as e:
            print(f"Warning: could not load seed {seed_path}: {e}", file=sys.stderr)

    supply = {k: v for k, v in supply_raw.items() if not k.startswith("_") and isinstance(v, dict)}
    asset_to_series = build_asset_to_series(series_data)
    links = {k: v for k, v in links_data.items() if not k.startswith("_") and isinstance(v, str)}

    all_assets = sorted(set(flatten_series(series_data)) | set(supply.keys()) | set(links.keys()))

    result: dict = {}
    for asset in all_assets:
        entry: dict = {}
        s = supply.get(asset)
        if s:
            if s.get("issued") is not None and s.get("issued") != "":
                entry["issued"] = str(s["issued"])
            if s.get("destroyed") is not None:
                entry["destroyed"] = str(s["destroyed"])
            if s.get("circulating") is not None and s.get("circulating") != "":
                entry["circulating"] = str(s["circulating"])
            if "divisible" in s:
                entry["divisible"] = bool(s["divisible"])
            if s.get("note"):
                entry["note"] = str(s["note"])

        # supply_cap: display cap — use issued when available, else seed
        if entry.get("issued") and not entry.get("note"):
            try:
                entry["supply_cap"] = int(float(entry["issued"]))
            except (ValueError, TypeError):
                pass
        seed_entry = seed.get(asset)
        if seed_entry is not None:
            if entry.get("supply_cap") is None and seed_entry.get("supply_cap") is not None:
                sc = seed_entry["supply_cap"]
                if sc is not None and sc != "":
                    try:
                        entry["supply_cap"] = int(float(sc))
                    except (ValueError, TypeError):
                        entry["supply_cap"] = sc
            if seed_entry.get("artist") is not None and seed_entry.get("artist") != "":
                entry["artist"] = str(seed_entry["artist"])

        if asset in asset_to_series:
            entry["series"] = asset_to_series[asset]
        if asset in links and links[asset]:
            entry["rpd_url"] = links[asset]

        result[asset] = entry

    meta = {
        "description": "Single source of truth for pepe data. Built from rarepepe-supply.json, RarePepeDirectory_Series_Data.json, RarePepeDirectory_Links.json, and seed asset_metadata (artist/supply_cap).",
        "built": datetime.now(timezone.utc).isoformat()[:19] + "Z",
        "sources": [
            "rarepepe-supply.json (issued, destroyed, circulating, divisible, note)",
            "RarePepeDirectory_Series_Data.json (series)",
            "RarePepeDirectory_Links.json (rpd_url)",
            "asset_metadata.json seed (artist, supply_cap when issued missing)",
        ],
        "fields": {
            "issued": "Total minted (from TokenScan).",
            "destroyed": "Burned supply.",
            "circulating": "issued − destroyed.",
            "divisible": "Whether asset is divisible.",
            "note": "e.g. API missing.",
            "supply_cap": "Display cap (issued or manual fallback).",
            "artist": "Bitcoin/XCP issuer address (artist page link).",
            "series": "Rare Pepe series number.",
            "rpd_url": "Rare Pepe Directory URL.",
        },
    }
    out = {"_meta": meta, **result}

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)

    print(f"Wrote {len(result)} assets to {out_file}")


if __name__ == "__main__":
    main()
