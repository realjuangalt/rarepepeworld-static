#!/usr/bin/env python3
"""
Extract per-card lore from Book of Kek series markdown files and update stub wiki pages.

Reads book-of-kek/.../series-and-card-specific-lore/series-*.md, parses
"## Series N, Card M - ASSETNAME" sections, and if wiki/ASSETNAME.md is a stub
(references "No wiki content yet"), replaces the Lore section with the extracted
paragraphs and adds Book of Kek attribution.

Usage:
  python bok_to_wiki.py [--book-dir PATH] [--wiki-dir PATH] [--dry-run]
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path


BOK_SERIES_GLOB = "chapter-2-the-rare-pepe-project/the-rare-pepe-blockchain-project/series-and-card-specific-lore/series-*.md"
ATTRIBUTION = "\n\n*Adapted from [Book of Kek](https://wiki.pepe.wtf/) (pepe.wtf).*"


def find_bok_series(book_dir: Path) -> list[Path]:
    base = book_dir / "chapter-2-the-rare-pepe-project/the-rare-pepe-blockchain-project/series-and-card-specific-lore"
    if not base.exists():
        return []
    return sorted(base.glob("series-*.md"))


def strip_gitbook(text: str) -> str:
    # Remove {% ... %} blocks
    text = re.sub(r"\{%[^%]*%\}", "", text)
    text = text.lstrip("\\\n ")
    # Remove image lines ![...](...) or <figure>...</figure>
    text = re.sub(r"!\[[^\]]*\]\([^)]+\)", "", text)
    text = re.sub(r"<figure>.*?</figure>", "", text, flags=re.DOTALL)
    text = re.sub(r"!\[.*?\]\(.*?\)", "", text)
    # Collapse multiple newlines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def parse_series_md(path: Path) -> list[tuple[str, str, str]]:
    """Return list of (asset_name, card_label, lore_text)."""
    try:
        content = path.read_text(encoding="utf-8")
    except Exception:
        return []
    # Split by ## Series N, Card M - ASSETNAME
    pattern = re.compile(r"^##\s+Series\s+\d+,\s+Card\s+\d+\s*-\s*([A-Z0-9]+)\s*$", re.MULTILINE)
    parts = pattern.split(content)
    if len(parts) < 2:
        return []
    # parts[0] is intro; then [asset1, body1, asset2, body2, ...]
    result = []
    for i in range(1, len(parts) - 1, 2):
        asset = parts[i].strip()
        body = parts[i + 1].strip()
        # Body runs until next ## or end
        next_h2 = body.find("\n## ")
        if next_h2 != -1:
            body = body[:next_h2]
        body = strip_gitbook(body)
        if not asset or not body or len(body) < 20:
            continue
        # First line often repeats "Series N, Card M - ASSET ..."; use rest as lore
        lines = body.split("\n")
        lore_lines = []
        for line in lines:
            if re.match(r"^\s*\*\*Series\s+\d+", line) or re.match(r"^Series\s+\d+", line):
                continue
            lore_lines.append(line)
        lore = "\n".join(lore_lines).strip()
        if len(lore) < 30:
            lore = body
        result.append((asset, f"Series {path.stem.replace('series-', '')}", lore))
    return result


def is_stub(wiki_content: str) -> bool:
    return "No wiki content yet" in wiki_content or (
        "## Lore" in wiki_content
        and "No wiki content yet" in wiki_content.split("## Lore", 1)[-1]
    )


def update_wiki_lore(wiki_path: Path, asset: str, lore: str) -> bool:
    try:
        content = wiki_path.read_text(encoding="utf-8")
    except Exception:
        return False
    if not is_stub(content):
        return False
    lore_block = lore + ATTRIBUTION
    if "## Lore" not in content:
        content = content.rstrip() + "\n\n## Lore\n\n" + lore_block + "\n"
    else:
        # Replace content between ## Lore and next ## or end
        match = re.search(r"\n## Lore\n\n", content)
        if not match:
            return False
        start = match.end()
        next_section = re.search(r"\n## (?![Lore])", content[start:])
        end = start + next_section.start() if next_section else len(content)
        content = content[:start] + lore_block + "\n" + content[end:]
    wiki_path.write_text(content, encoding="utf-8")
    return True


def main() -> None:
    ap = argparse.ArgumentParser(description="Extract BoK series lore into stub wiki pages")
    ap.add_argument("--book-dir", type=Path, default=None, help="Book of Kek root (default: ../book-of-kek)")
    ap.add_argument("--wiki-dir", type=Path, default=None, help="Wiki directory (default: ../wiki)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    script_dir = Path(__file__).resolve().parent
    book_dir = args.book_dir or (script_dir / ".." / "book-of-kek")
    wiki_dir = args.wiki_dir or (script_dir / ".." / "wiki")
    book_dir = book_dir.resolve()
    wiki_dir = wiki_dir.resolve()

    if not book_dir.exists():
        print(f"Book of Kek dir not found: {book_dir}")
        print("Run scripts/fetch_book_of_kek.sh first.")
        return

    series_files = find_bok_series(book_dir)
    print(f"Found {len(series_files)} series files in Book of Kek.")

    updated = 0
    for path in series_files:
        for asset, card_label, lore in parse_series_md(path):
            wiki_path = wiki_dir / f"{asset}.md"
            if not wiki_path.exists():
                continue
            if args.dry_run:
                if is_stub(wiki_path.read_text(encoding="utf-8")):
                    print(f"  Would update {asset}.md from {path.name}")
                    updated += 1
            else:
                if update_wiki_lore(wiki_path, asset, lore):
                    print(f"  Updated {asset}.md from {path.name}")
                    updated += 1

    print(f"{'Would update' if args.dry_run else 'Updated'} {updated} wiki pages from Book of Kek.")


if __name__ == "__main__":
    main()
