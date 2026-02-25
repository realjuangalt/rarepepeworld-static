# Rare Pepe Directory — Archive plan

We need an **archive of all Rare Pepe Directory (RPD) data** so the static site can work without depending on http://rarepepedirectory.com/ being available. This document describes RPD’s structure and how to archive it.

---

## 1. What RPD is

- **URL**: http://rarepepedirectory.com/
- **Content**: Catalog of Rare Pepe assets (Counterparty) with asset name, amount issued, creation date, and links to blockscan. Some pages may include images.
- **Structure**:
  - **Homepage**: Paginated list of recent Pepes (each entry: name + link to `?p=<id>`).
  - **Series pages**: e.g. `http://rarepepedirectory.com/series-1/`, `series-2/`, … Same list format, optionally paginated (`?paged=2`).
  - **Pepe page**: `http://rarepepedirectory.com/?p=<id>`. Contains:
    - Title: `ASSET NAME – Rare Pepe Directory`
    - Line: `ASSET NAME: <NAME> AMOUNT ISSUED: <N>`
    - Optional: `CREATED <month> <year>`
    - Link to blockscan: `http://blockscan.com/assetInfo/<NAME>`
    - Prev/Next links to adjacent Pepes.

---

## 2. What we already have (in repo)

- **RarePepeDirectory_Links.json** — Maps asset name → RPD URL (`?p=...`). Stored in `RarePepeWorld.com/rpw/static/data/` and copied into `static-site/data/` for the static build.
- **RarePepeDirectory_Series_Data.json** — Maps series number (string) → list of asset names. Same locations.

These give us **name ↔ URL** and **series → names**. What we still want from a full archive:

- **Per-pepe metadata**: amount issued, created date, blockscan URL, RPD post id (`p`).
- **Images**: If RPD pages embed image URLs, capture them so we can optionally mirror images into `archive/pepes/` (or reference them).
- **Completeness**: Ensure we have every RPD pepe (including any not in the existing JSON files) by crawling homepage and series pages.

---

## 3. Archive contents (target)

| Output | Description | Location |
|--------|-------------|----------|
| **rpd-index.json** | Full index: for each RPD `?p=ID`, asset name, amount_issued, series (season), created, blockscan_url, prev/next id, image_url, image_local_path. | `archive/rpd/rpd-index.json` |
| **RarePepeDirectory_Links.json** | asset_name → RPD URL; updated by crawl. | `archive/rpd/` and copied to `data/` |
| **RarePepeDirectory_Series_Data.json** | series number (1–36) → [asset names]; updated by crawl. | `archive/rpd/` and copied to `data/` |
| **Site clone** | Static HTML mirror: index, series-1…36, and every `?p=ID` page with links rewritten for offline browsing. | `archive/rpd/site/` (index.html, series-N/index.html, p/ID.html) |
| **Images** | Downloaded asset images keyed by asset name. | `archive/pepes/` |

---

## 4. How to build the archive

### Scripted crawl (implemented)

Run the archiver from the repo:

```bash
cd static-site/scripts
pip install -r requirements.txt
python archive_rpd.py
```

- **Script**: `static-site/scripts/archive_rpd.py`
- **Discover**: Homepage (paginated) + Series 1–36 (each paginated). Collect every `?p=ID` link and asset name; record series (season) from which series page the asset was found.
- **Fetch each pepe page**: Parse asset name, amount issued, created date, blockscan link, prev/next, image URL. Save HTML to `archive/rpd/site/p/ID.html` with links rewritten for offline browsing. Download image to `archive/pepes/<ASSET>.<ext>`.
- **Output**: `rpd-index.json`, `RarePepeDirectory_Links.json`, `RarePepeDirectory_Series_Data.json` in `archive/rpd/`; copies of Links + Series in `static-site/data/`. Full site clone under `archive/rpd/site/` (index, series-N, p/*.html).
- **Politeness**: Configurable delay (default 1.5 s); User-Agent identifies archival bot.
- **No server**: Run locally or in GitHub Actions; commit the output.

---

## 5. Using the archive in the static site

- **Pepe list / search**: Use `data/RarePepeDirectory_Series_Data.json` + `data/RarePepeDirectory_Links.json` (and optionally `rpd-index.json`) to drive “all Pepes”, series browse, and search — no live RPD request.
- **Pepe detail**: For “amount issued” and “created” we can show from `rpd-index.json`; for live supply and dispensers we use XChain API.
- **Images**: Prefer `archive/pepes/<ASSET>.<ext>`; fallback to RPD or blockscan if we don’t have the image and policy allows linking.

---

## 6. Next steps

1. **Run the archiver**: `python static-site/scripts/archive_rpd.py` (see `static-site/scripts/README.md`).
2. **Commit**: Add `archive/rpd/`, `archive/pepes/`, and updated `data/RarePepeDirectory_*.json`.
3. **Optional**: Schedule a periodic run (e.g. GitHub Actions monthly) to refresh the snapshot.

Once the archive is in place, the static site can rely on it and only call **XChain** (and any other allowed APIs) for live blockchain data — no dependency on RPD being up at request time.
