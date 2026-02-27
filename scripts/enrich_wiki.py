#!/usr/bin/env python3
"""
Enrich wiki stub pages with supply and series from data files.

- data/rarepepe-supply.json  → **Supply:** X/Y or divisible (circulating Z)
- data/RarePepeDirectory_Series_Data.json → **Series:** N

Only updates lines that are placeholders (**Supply:** — or **Series:** —) or
stub pages that contain "No wiki content yet". Does not overwrite existing
lore or custom Supply/Series.

Usage:
  python enrich_wiki.py [--wiki-dir PATH] [--data-dir PATH] [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


def load_supply(data_dir: Path) -> dict[str, dict]:
    p = data_dir / "rarepepe-supply.json"
    if not p.exists():
        return {}
    with open(p, encoding="utf-8") as f:
        raw = json.load(f)
    return {
        k: v for k, v in raw.items()
        if isinstance(v, dict) and not k.startswith("_")
    }


def load_series_map(data_dir: Path) -> dict[str, str]:
    p = data_dir / "RarePepeDirectory_Series_Data.json"
    if not p.exists():
        return {}
    with open(p, encoding="utf-8") as f:
        data = json.load(f)
    out = {}
    for series, names in (data or {}).items():
        if isinstance(names, list):
            for name in names:
                if isinstance(name, str) and name.strip():
                    out[name.strip()] = str(series)
    return out


def format_supply(entry: dict) -> str | None:
    issued = entry.get("issued")
    if issued is None:
        return None
    circulating = entry.get("circulating") or issued
    divisible = entry.get("divisible", False)
    if divisible:
        return f"Divisible (circulating {circulating})"
    return f"{circulating}/{issued}"


def update_md(content: str, asset: str, supply_str: str | None, series_str: str | None) -> str | None:
    changed = False
    lines = content.split("\n")

    for i, line in enumerate(lines):
        if supply_str and re.match(r"^\s*\*\*Supply:\*\*\s*—\s*$", line):
            lines[i] = f"**Supply:** {supply_str}"
            changed = True
        elif series_str and re.match(r"^\s*\*\*Series:\*\*\s*—\s*$", line):
            lines[i] = f"**Series:** {series_str}"
            changed = True
        elif series_str and re.match(r"^\s*\*\*Series:\*\*\s*$", line):
            lines[i] = f"**Series:** {series_str}"
            changed = True

    if not changed:
        return None
    return "\n".join(lines)


def is_stub(content: str) -> bool:
    return "No wiki content yet" in content or "**Supply:** —" in content


def main() -> None:
    ap = argparse.ArgumentParser(description="Enrich wiki stubs with supply and series from data")
    ap.add_argument("--wiki-dir", type=Path, default=None, help="Wiki directory (default: ../wiki)")
    ap.add_argument("--data-dir", type=Path, default=None, help="Data directory (default: ../data)")
    ap.add_argument("--dry-run", action="store_true", help="Do not write files")
    args = ap.parse_args()

    script_dir = Path(__file__).resolve().parent
    wiki_dir = args.wiki_dir or (script_dir / ".." / "wiki")
    data_dir = args.data_dir or (script_dir / ".." / "data")
    wiki_dir = wiki_dir.resolve()
    data_dir = data_dir.resolve()

    supply_by_asset = load_supply(data_dir)
    series_by_asset = load_series_map(data_dir)
    skip = {"README.md", "TEMPLATE.md", "WIKI-PLAN.md"}

    updated = 0
    for path in sorted(wiki_dir.glob("*.md")):
        if path.name in skip:
            continue
        asset = path.stem
        try:
            content = path.read_text(encoding="utf-8")
        except Exception:
            continue
        supply_str = None
        if asset in supply_by_asset:
            supply_str = format_supply(supply_by_asset[asset])
        series_str = series_by_asset.get(asset)

        new_content = update_md(content, asset, supply_str, series_str)
        if new_content is not None:
            if not args.dry_run:
                path.write_text(new_content, encoding="utf-8")
            updated += 1
            if updated <= 10:
                print(f"  {path.name}: supply={supply_str!r}, series={series_str!r}")

    print(f"Updated {updated} wiki pages." if not args.dry_run else f"Would update {updated} wiki pages (dry run).")


if __name__ == "__main__":
    main()
