# Scripts

## build_supply_data.py — Rare Pepe supply caps (issued, destructions, circulating)

Builds `data/rarepepe-supply.json` by **polling the TokenScan API** for each Rare Pepe asset:

1. **Issued supply** — `GET /api/asset/{asset}` → `supply`, `divisible`
2. **Destructions (burns)** — `GET /api/destructions/{asset}` → sum of `quantity` (Counterparty’s official way to destroy supply)
3. **Circulating** — issued − destroyed (used as “Y” in “Owns X of Y” on the address page)

**Reference:** [pepe.wtf](https://pepe.wtf/) has good Rare Pepe data; use it to spot-check. When an **artist reports an error**, add an entry to `data/rarepepe-supply-overrides.json` (issued / destroyed / circulating / note) and re-run this script to merge overrides with API data.

### Run

From `static-site/scripts/`:

```bash
python build_supply_data.py
```

Options:

- `--data-dir PATH` — Directory with `RarePepeDirectory_Series_Data.json` and (optional) `rarepepe-supply-overrides.json`; writes `rarepepe-supply.json` there (default: `../data`).
- `--delay SEC` — Seconds between API requests (default: 1.0).
- `--skip-destructions` — Only fetch issued supply; set destroyed=0 and circulating=issued (faster run).

Output format: `rarepepe-supply.json` contains `_meta` (source, updated, overrides_applied) and per-asset `{ "issued", "destroyed", "circulating", "divisible?", "note?" }`. The address page uses `circulating` (or legacy string supply) for display.

---

## archive_rpd.py — Full RPD archive + site clone

Systematically downloads **every asset** from [Rare Pepe Directory](http://rarepepedirectory.com/), keeps **asset names** and **series (season)** data, and **clones the site** for historical/archival use.

### Setup

```bash
pip install -r requirements.txt
```

### Run

From this directory (`static-site/scripts/`):

```bash
python archive_rpd.py
```

Options:

- `--out-dir PATH` — Base output directory (default: `../archive`).
- `--delay SEC` — Seconds between requests (default: 1.5). Be polite to the host.
- `--no-clone` — Skip saving HTML clone; only fetch metadata and images.
- `--no-images` — Skip downloading asset images.

### Output layout

```
archive/
├── rpd/
│   ├── rpd-index.json              # Every asset: name, amount_issued, series, created, blockscan, image path
│   ├── RarePepeDirectory_Links.json # asset_name → RPD URL
│   ├── RarePepeDirectory_Series_Data.json  # series number → [asset names]
│   └── site/                       # Static clone
│       ├── index.html              # Homepage
│       ├── series-1/index.html … series-36/index.html
│       └── p/
│           ├── 161.html            # ?p=161
│           └── …
└── pepes/                          # Images by asset name
    ├── BANEPEPE.jpg
    └── …
```

Links in the saved HTML are rewritten so the clone is **browsable offline** (e.g. `?p=161` → `p/161.html`).

The script also copies `RarePepeDirectory_Links.json` and `RarePepeDirectory_Series_Data.json` into `../data/` for the static site.

### Notes

- RPD has **Series 1–36** in the menu; the script crawls all of them plus the homepage.
- Pagination on listing pages is followed so every pepe link is discovered.
- This is for **archival/historical** use; run occasionally to refresh the snapshot.
