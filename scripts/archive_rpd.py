#!/usr/bin/env python3
"""
Archive Rare Pepe Directory (RPD): keep asset names, series (season), and links.
Optionally clone the site and download images (e.g. for a full rebuild).

Usage:
  python archive_rpd.py [--out-dir PATH] [--delay SEC] [--series-only] [--no-clone] [--no-images]

  --series-only  Only update series + links from listing pages (no per-asset fetch, no images).
                 Use when you already have images and only need series data. Fast.
  --out-dir      Base output dir (default: ../archive relative to script)
  --delay        Seconds between requests (default: 1.5)
  --no-clone     Skip saving HTML clone (full run only)
  --no-images    Skip downloading asset images (full run only)

Output (always):
  <out-dir>/rpd/RarePepeDirectory_Links.json
  <out-dir>/rpd/RarePepeDirectory_Series_Data.json
  Plus copies into <out-dir>/../data/ for the static site.

Output (full run only, when not --series-only):
  <out-dir>/rpd/rpd-index.json   Per-asset metadata
  <out-dir>/rpd/site/             Static clone (index, series-*, p/*.html)
  <out-dir>/pepes/               Downloaded images (only if not --no-images)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("Install: pip install requests beautifulsoup4", file=sys.stderr)
    sys.exit(1)

BASE = "http://rarepepedirectory.com"
USER_AGENT = "RarePepeWorld-Archive/1.0 (historical archival; +https://github.com)"
# Series 1–36 per RPD menu
SERIES_RANGE = range(1, 37)
DEFAULT_DELAY = 1.5


def get(url: str, session: requests.Session) -> requests.Response:
    return session.get(url, timeout=30)


def soup(html: str):
    return BeautifulSoup(html, "html.parser")


def discover_pepe_links_from_page(soup_page) -> list[tuple[str, str]]:
    """Returns list of (asset_name, href) for pepe links on this page. href is ?p=ID or full URL."""
    out = []
    seen_p: set[str] = set()
    main = soup_page.find("div", id="main")
    if not main:
        return out
    # RPD: each post is in <article> or <section>; h2.entry-title has name, link with ?p= is sibling (not inside h2)
    for block in main.find_all(["article", "section"]):
        h2 = block.find("h2", class_="entry-title")
        a = block.find("a", href=lambda h: h and "?p=" in str(h))
        if not a:
            continue
        href = a.get("href", "")
        if not ("?p=" in href or (urlparse(href).query and "p=" in urlparse(href).query)):
            continue
        pid = re.search(r"p=(\d+)", href)
        if pid and pid.group(1) in seen_p:
            continue
        if h2:
            name = (h2.get_text() or "").strip()
            if name and pid:
                seen_p.add(pid.group(1))
                out.append((name, href))
                continue
        # Fallback: parse name from link text "ASSET NAME: X AMOUNT" or "ASSETNAME: X"
        text = (a.get_text() or "").strip()
        m = re.search(r"ASSET\s*NAME:\s*([A-Za-z0-9]+)", text, re.I) or re.search(r"ASSETNAME:\s*([A-Za-z0-9]+)", text, re.I)
        if m and pid:
            seen_p.add(pid.group(1))
            out.append((m.group(1).upper(), href))
    # Category pages: links with ?p= and name from preceding heading or link text
    for a in main.find_all("a", href=True):
        href = a["href"]
        if "p=" not in href and "p=" not in (urlparse(href).query or ""):
            continue
        pid = re.search(r"p=(\d+)", href)
        if not pid or pid.group(1) in seen_p:
            continue
        name = None
        node = a.find_previous_sibling()
        if node and getattr(node, "name", None) in ("h1", "h2", "h3", "h4"):
            name = (node.get_text() or "").strip()
        if not name:
            node = a.find_previous()
            for _ in range(20):
                if node is None:
                    break
                if getattr(node, "name", None) in ("h1", "h2", "h3", "h4"):
                    name = (node.get_text() or "").strip()
                    break
                node = node.find_previous()
        if not name:
            text = (a.get_text() or "").strip()
            m = re.search(r"ASSET\s*NAME:\s*([A-Za-z0-9]+)", text, re.I) or re.search(r"ASSETNAME:\s*([A-Za-z0-9]+)", text, re.I)
            if m:
                name = m.group(1).upper()
        if name:
            seen_p.add(pid.group(1))
            out.append((name, href))
    return out


def discover_pagination_next(soup_page) -> str | None:
    """Next page URL (older posts). WordPress uses nav-previous for 'next' page."""
    nav = soup_page.find("div", class_="nav-previous")
    if not nav:
        return None
    a = nav.find("a", href=True)
    return a["href"] if a else None


def discover_category_series_map(session: requests.Session, delay: float) -> dict[int, int]:
    """
    RPD uses ?cat=ID for series (e.g. ?cat=6 = Series 1). Discover cat_id -> series_num.
    """
    cat_to_series: dict[int, int] = {}
    r = get(BASE + "/", session)
    r.raise_for_status()
    s = soup(r.text)
    cat_ids: set[int] = set()
    for a in s.find_all("a", href=True):
        m = re.search(r"[?&]cat=(\d+)", a["href"])
        if m:
            cat_ids.add(int(m.group(1)))
    if not cat_ids:
        # Fallback: probe ?cat=1 through ?cat=60 and parse title "Series N"
        cat_ids = set(range(1, 61))
    for cid in sorted(cat_ids):
        time.sleep(delay)
        try:
            r = get(f"{BASE}/?cat={cid}", session)
            if not r.ok:
                continue
            s = soup(r.text)
            title_el = s.find("title")
            if not title_el:
                continue
            t = (title_el.get_text() or "").strip()
            m = re.search(r"Series\s+(\d+)", t, re.I)
            if m:
                series_num = int(m.group(1))
                if 1 <= series_num <= 36:
                    cat_to_series[cid] = series_num
        except Exception:
            continue
    return cat_to_series


def discover_all_pepes(session: requests.Session, delay: float) -> tuple[dict[str, str], dict[str, int], dict[str, str]]:
    """
    Crawl homepage and all series pages; return (name_to_p, name_to_series, name_to_url).
    RPD uses ?cat=ID for series (not /series-N/).
    """
    name_to_p: dict[str, str] = {}
    name_to_series: dict[str, int] = {}
    name_to_url: dict[str, str] = {}

    def crawl_listing(url: str, series_num: int | None, label: str):
        page = 1
        while url:
            print(f"  [{label}] Fetching page {page}: {url}", flush=True)
            r = get(url, session)
            r.raise_for_status()
            s = soup(r.text)
            found = discover_pepe_links_from_page(s)
            for name, href in found:
                full_url = urljoin(BASE, href)
                parsed = urlparse(href)
                q = parsed.query
                if "p=" in q:
                    pid = re.search(r"p=(\d+)", q)
                    if pid:
                        p_id = pid.group(1)
                        name_to_p[name] = p_id
                        name_to_url[name] = full_url
                        if series_num is not None:
                            name_to_series[name] = series_num
            print(f"  [{label}] Page {page}: {len(found)} links (total unique so far: {len(name_to_p)})", flush=True)
            url = discover_pagination_next(s)
            if url:
                url = urljoin(BASE, url)
                page += 1
            time.sleep(delay)

    print("  Homepage...", flush=True)
    crawl_listing(BASE + "/", None, "Homepage")
    print("  Discovering series categories (?cat=)...", flush=True)
    cat_to_series = discover_category_series_map(session, delay)
    for cid, series_num in sorted(cat_to_series.items(), key=lambda x: x[1]):
        print(f"  Series {series_num} (cat={cid})...", flush=True)
        crawl_listing(f"{BASE}/?cat={cid}", series_num, f"Series {series_num}")

    return name_to_p, name_to_series, name_to_url


def parse_pepe_page(html: str, base_url: str) -> dict:
    """
    Parse a single pepe page (?p=ID). Return dict with asset_name, amount_issued,
    created, blockscan_url, prev_p, next_p, image_url, body_html (optional).
    """
    s = soup(html)
    data = {
        "asset_name": None,
        "amount_issued": None,
        "created": None,
        "blockscan_url": None,
        "prev_p": None,
        "next_p": None,
        "image_url": None,
        "image_local_path": None,
    }
    # Title: "ASSET NAME – Rare Pepe Directory" or similar
    title = s.find("title")
    if title:
        t = title.get_text()
        if "–" in t:
            data["asset_name"] = t.split("–")[0].strip()
        elif "-" in t:
            data["asset_name"] = t.split("-")[0].strip()
    # Content: "ASSET NAME: X AMOUNT ISSUED: N"
    main = s.find("div", id="main") or s.find("article") or s
    text = main.get_text() if main else ""
    amt = re.search(r"AMOUNT ISSUED:\s*(\d+)", text, re.I)
    if amt:
        data["amount_issued"] = int(amt.group(1))
    created = re.search(r"CREATED\s+([A-Za-z]+\s+\d{4})", text)
    if created:
        data["created"] = created.group(1).strip()
    # Blockscan link
    for a in (main or s).find_all("a", href=True):
        h = a["href"]
        if "blockscan.com" in h and "assetInfo" in h:
            data["blockscan_url"] = h
            break
    # Prev/Next (links to other ?p=)
    for a in (main or s).find_all("a", href=True):
        m = re.search(r"[?&]p=(\d+)", a["href"])
        if m:
            label = (a.get_text() or "").strip().upper()
            if "PREV" in label or "NEXT" in label:
                if "PREV" in label:
                    data["prev_p"] = m.group(1)
                else:
                    data["next_p"] = m.group(1)
    # First content image (the pepe art)
    for img in (main or s).find_all("img", src=True):
        src = img["src"]
        if "gravatar" in src or "avatar" in src or "logo" in src.lower():
            continue
        data["image_url"] = urljoin(base_url, src)
        break
    return data


def download_image(url: str, path: Path, session: requests.Session) -> bool:
    try:
        r = session.get(url, timeout=15, stream=True)
        r.raise_for_status()
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "wb") as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
        return True
    except Exception:
        return False


def rewrite_links_for_clone(html: str, base: str, page_type: str, p_id: str | None) -> str:
    """Rewrite href/src to local paths so the clone is browsable offline."""
    # Point to our saved structure: index.html, series-N/index.html, p/ID.html
    html = html.replace(f'href="{base}', 'href="')
    html = html.replace(f"href='{base}", "href='")
    html = html.replace(f'src="{base}', 'src="')
    html = html.replace(f"src='{base}", "src='")
    # ?p=ID -> p/ID.html
    html = re.sub(r'href="[^"]*\?p=(\d+)[^"]*"', r'href="p/\1.html"', html)
    html = re.sub(r"href='[^']*\?p=(\d+)[^']*'", r"href='p/\1.html'", html)
    # /series-N/ -> series-N/index.html
    html = re.sub(r'href="(/series-(\d+)/?)"', r'href="series-\2/index.html"', html)
    html = re.sub(r"href='(/series-(\d+)/?)'", r"href='series-\2/index.html'", html)
    # / -> index.html when on same level
    return html


def main():
    ap = argparse.ArgumentParser(description="Archive Rare Pepe Directory (series + links; optionally full clone)")
    ap.add_argument("--series-only", action="store_true", help="Only update series + links from listing pages (no per-asset fetch, no images)")
    ap.add_argument("--out-dir", type=Path, default=None, help="Output base dir (default: ../archive)")
    ap.add_argument("--delay", type=float, default=DEFAULT_DELAY, help="Delay between requests (seconds)")
    ap.add_argument("--no-clone", action="store_true", help="Do not save HTML clone (full run only)")
    ap.add_argument("--no-images", action="store_true", help="Do not download images (full run only)")
    args = ap.parse_args()

    script_dir = Path(__file__).resolve().parent
    out_base = args.out_dir or (script_dir / ".." / "archive").resolve()
    rpd_dir = out_base / "rpd"
    site_dir = rpd_dir / "site"
    pepes_dir = out_base / "pepes"
    data_dir = script_dir / ".." / "data"

    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT

    print("Discovering all pepe links from homepage and series categories...", flush=True)
    name_to_p, name_to_series, name_to_url = discover_all_pepes(session, args.delay)

    # Build series_data from discovery (series number -> sorted list of asset names)
    series_data: dict[str, list[str]] = {str(n): [] for n in SERIES_RANGE}
    for name, series_num in name_to_series.items():
        key = str(series_num)
        if name not in series_data[key]:
            series_data[key].append(name)
    for k in series_data:
        series_data[k] = sorted(series_data[k])

    if args.series_only:
        rpd_dir.mkdir(parents=True, exist_ok=True)
        links = dict(sorted(name_to_url.items()))
        (rpd_dir / "RarePepeDirectory_Links.json").write_text(
            json.dumps(links, indent=2, sort_keys=True), encoding="utf-8"
        )
        (rpd_dir / "RarePepeDirectory_Series_Data.json").write_text(
            json.dumps(series_data, indent=2, sort_keys=True), encoding="utf-8"
        )
        data_dir = data_dir.resolve()
        if data_dir.exists():
            import shutil
            shutil.copy(rpd_dir / "RarePepeDirectory_Links.json", data_dir / "RarePepeDirectory_Links.json")
            shutil.copy(rpd_dir / "RarePepeDirectory_Series_Data.json", data_dir / "RarePepeDirectory_Series_Data.json")
            print(f"Copied Links + Series JSON to {data_dir}", flush=True)
        print("Done (series-only). Run build_asset_metadata.py then build_series_from_metadata.py to update asset_metadata.", flush=True)
        return

    # Full run: dedupe by p_id and fetch each asset page
    p_to_name: dict[str, str] = {}
    for name, p_id in name_to_p.items():
        p_to_name[p_id] = name

    total = len(p_to_name)
    print(f"Discovery done: {total} unique assets ({len(name_to_series)} with series).", flush=True)
    print(f"Fetching each asset page (delay={args.delay}s)...", flush=True)

    # Reset series_data; we'll refill from name_to_series during fetch (for rpd_index row["series"])
    series_data = {str(n): [] for n in SERIES_RANGE}

    rpd_index = []
    links = {}
    start_time = time.time()
    sorted_items = sorted(p_to_name.items(), key=lambda x: int(x[0]))
    for idx, (p_id, asset_name) in enumerate(sorted_items, start=1):
        url = f"{BASE}/?p={p_id}"
        elapsed = time.time() - start_time
        eta = (elapsed / idx) * (total - idx) if idx > 0 else 0
        print(f"[{idx}/{total}] ({elapsed/60:.1f}m elapsed, ~{eta/60:.0f}m left) {asset_name}", flush=True)
        time.sleep(args.delay)
        try:
            r = get(url, session)
            r.raise_for_status()
        except Exception as e:
            print(f"  Error: {e}", file=sys.stderr, flush=True)
            continue
        row = parse_pepe_page(r.text, BASE)
        row["p_id"] = p_id
        row["rpd_url"] = url
        if not row["asset_name"]:
            row["asset_name"] = asset_name
        series_num = name_to_series.get(asset_name)
        if series_num is not None:
            row["series"] = series_num
            if row["asset_name"] not in series_data[str(series_num)]:
                series_data[str(series_num)].append(row["asset_name"])
        links[row["asset_name"]] = url
        rpd_index.append(row)

        # Clone: save HTML
        if not args.no_clone:
            site_dir.mkdir(parents=True, exist_ok=True)
            (site_dir / "p").mkdir(exist_ok=True)
            html = rewrite_links_for_clone(r.text, BASE, "pepe", p_id)
            (site_dir / "p" / f"{p_id}.html").write_text(html, encoding="utf-8")

        # Download image
        if not args.no_images and row.get("image_url"):
            ext = "jpg"
            if ".png" in row["image_url"].lower():
                ext = "png"
            elif ".gif" in row["image_url"].lower():
                ext = "gif"
            elif ".webp" in row["image_url"].lower():
                ext = "webp"
            safe_name = "".join(c for c in row["asset_name"] if c.isalnum() or c in "._-")
            img_path = pepes_dir / f"{safe_name}.{ext}"
            if download_image(row["image_url"], img_path, session):
                row["image_local_path"] = f"pepes/{safe_name}.{ext}"
                if idx % 25 == 0:
                    print(f"  (image saved: {safe_name}.{ext})", flush=True)
            time.sleep(args.delay)

    # Sort series lists
    for k in series_data:
        series_data[k] = sorted(series_data[k])

    rpd_dir.mkdir(parents=True, exist_ok=True)
    (rpd_dir / "rpd-index.json").write_text(
        json.dumps(rpd_index, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (rpd_dir / "RarePepeDirectory_Links.json").write_text(
        json.dumps(links, indent=2, sort_keys=True), encoding="utf-8"
    )
    (rpd_dir / "RarePepeDirectory_Series_Data.json").write_text(
        json.dumps(series_data, indent=2, sort_keys=True), encoding="utf-8"
    )

    # Copy to static site data dir
    data_dir = data_dir.resolve()
    if data_dir.exists():
        import shutil
        shutil.copy(rpd_dir / "RarePepeDirectory_Links.json", data_dir / "RarePepeDirectory_Links.json")
        shutil.copy(rpd_dir / "RarePepeDirectory_Series_Data.json", data_dir / "RarePepeDirectory_Series_Data.json")
        print(f"Copied Links + Series JSON to {data_dir}", flush=True)

    # Clone homepage and series listing pages
    if not args.no_clone:
        print("Cloning homepage and series index pages...", flush=True)
        time.sleep(args.delay)
        r = get(BASE + "/", session)
        if r.ok:
            html = rewrite_links_for_clone(r.text, BASE, "index", None)
            (site_dir / "index.html").write_text(html, encoding="utf-8")
            print("  Saved site/index.html", flush=True)
        for n in SERIES_RANGE:
            time.sleep(args.delay)
            r = get(f"{BASE}/series-{n}/", session)
            if r.ok:
                (site_dir / f"series-{n}").mkdir(exist_ok=True)
                html = rewrite_links_for_clone(r.text, BASE, "series", str(n))
                (site_dir / f"series-{n}" / "index.html").write_text(html, encoding="utf-8")
                print(f"  Saved site/series-{n}/index.html", flush=True)

    elapsed_total = time.time() - start_time
    print("Done.", flush=True)
    print(f"  Total time: {elapsed_total/60:.1f} minutes", flush=True)
    print(f"  rpd-index: {rpd_dir / 'rpd-index.json'}", flush=True)
    print(f"  Links/Series: {rpd_dir}", flush=True)
    print(f"  Site clone: {site_dir}", flush=True)
    print(f"  Images: {pepes_dir}", flush=True)


if __name__ == "__main__":
    main()
