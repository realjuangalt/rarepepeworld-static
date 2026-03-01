#!/usr/bin/env python3
"""
Rebuild RarePepeDirectory_Series_Data.json from asset_metadata.json.

We treat asset_metadata.json as the canonical source of per-asset series
information and derive the old "series number → [asset names]" structure
from it. This lets us fix broken Series_Data files without recrawling RPD.

Usage:
  python build_series_from_metadata.py [--data-dir PATH]

  --data-dir  Directory containing asset_metadata.json and where the
              RarePepeDirectory_Series_Data.json output should be written
              (default: ../data relative to this script).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
  ap = argparse.ArgumentParser(
      description="Rebuild RarePepeDirectory_Series_Data.json from asset_metadata.json"
  )
  ap.add_argument(
      "--data-dir",
      type=Path,
      default=None,
      help="Data directory (default: ../data relative to this script)",
  )
  args = ap.parse_args()

  script_dir = Path(__file__).resolve().parent
  data_dir = args.data_dir or (script_dir / ".." / "data")
  data_dir = data_dir.resolve()

  meta_file = data_dir / "asset_metadata.json"
  series_file = data_dir / "RarePepeDirectory_Series_Data.json"

  if not meta_file.exists():
    raise SystemExit(f"Missing {meta_file}")

  raw = json.loads(meta_file.read_text(encoding="utf-8"))
  series_map: dict[str, list[str]] = {}

  for name, entry in raw.items():
    if name.startswith("_"):
      continue
    if not isinstance(entry, dict):
      continue
    series = entry.get("series")
    if series is None or series == "":
      continue
    # Normalise series key as string
    key = str(series)
    series_list = series_map.setdefault(key, [])
    series_list.append(name)

  # Sort names within each series and ensure all keys are strings
  for k in series_map:
    series_map[k] = sorted(series_map[k])

  # Optionally, keep series keys ordered numerically in the JSON
  ordered = {k: series_map[k] for k in sorted(series_map.keys(), key=lambda x: int(x))}

  series_file.write_text(json.dumps(ordered, indent=2, sort_keys=False), encoding="utf-8")
  print(f"Wrote {len(ordered)} series entries to {series_file}")


if __name__ == "__main__":
  main()

