# Rare Pepe World — Static Site (GitHub-hosted)

This folder is the **static-site attempt** for Rare Pepe World: an **HTML + CSS + JavaScript only** site that can be hosted on **GitHub Pages for free**, pulls **live blockchain data from third-party APIs**, and bundles an **archive of Rare Pepe Directory (RPD) data** and optional graphic assets in the repo.

**Hosting**: GitHub Pages only — **no server**. If we need API keys or accounts (e.g. for rate limits), we use them in a static-friendly way (e.g. build-time in GitHub Actions, not a running backend). See [RESOURCES.md](RESOURCES.md) for key links and constraints.

---

## 1. Deep review: RarePepeWorld.com (fanpage app)

### 1.1 What the current app is

- **Stack**: Python 3.10, Flask, Gunicorn, MySQL, optional Counterparty RPC (Bitcoin/Counterparty node).
- **Purpose**: Block-explorer–style site for **Rare Pepe NFTs** on the Counterparty protocol: browse assets, dispensers, orders, holders, addresses, and artists.
- **Location**: `../RarePepeWorld.com/` (app entry `rpw/app.py`, templates in `rpw/templates/`, static in `rpw/static/`).

### 1.2 Data sources (current)

| Source | Role | Used for |
|--------|------|----------|
| **MySQL** | Primary store | Assets (name, supply, series, image filename, RarePepeDirectory URL), dispensers, holdings, orders, prices (BTC/XCP/PEPECASH), ad_slots, ad_queue, addresses (burn list). |
| **Counterparty RPC** | Optional live node | `get_asset_info`, `get_holders`, `get_dispensers`, `get_orders`, `get_running_info`, `get_messages` (block events). |
| **TokenScan API** | Public HTTP API | Same kind of data as RPC: asset, holders, dispensers, orders, issuances, network (block height). Base URL: https://tokenscan.io/api. |
| **RarePepeWallet feed** | Pepe list | `https://rarepepewallet.com/feed` — list of asset names (cacheable to file). |
| **BTCPayServer** | Payments | Invoices and webhook for “Advertise” (pay to feature a Pepe). |
| **Static/local files** | Config & metadata | `RarePepeDirectory_Links.json`, `RarePepeDirectory_Series_Data.json`, `faq.xml`, `burn_addresses.txt`, SQL snapshots. |

So the app **can** run off **Bitcoin/Counterparty node data** (RPC + DB populated from it) or use **TokenScan API** as an alternative; the static site uses TokenScan only.

### 1.3 Main routes and pages

- **`/`** — Index: featured Pepes + “Latest Dispensers” or “Random Pepes” grid.
- **`/<pepe_name>/`** — Pepe detail: image, supply, series, dispensers table, XCP/PEPECASH order books, holders.
- **`/<address>/`** — Address page: holdings (assets held at that address).
- **`/artist/<address>/`** — Artist page: assets issued by that address.
- **`/search/`** (POST) → **`/search/<query>/`** — Search by Pepe name or redirect to address/Pepe if exact match.
- **`/faq/`**, **`/advertise/`**, **`/invoice/`**, **`/B28vk/`** (webhook), **`/invoice_result/`**, 404, error.

### 1.4 Templates and UI

- **Base**: `base.html` — title, OpenGraph, Bootstrap 4, jQuery, search form, footer (FAQ, email, Twitter, copyright).
- **Content**: `index.html`, `pepe.html`, `address.html`, `search.html`, `faq.html`, `advertise.html`, `paid.html`, `404.html`, `error.html`.
- **Macros**: `macros.html` — featured Pepes, latest dispensers grid, pepe listing, dispensers table, order book, etc.
- **Static**: CSS in `rpw/static/css/` (custom, bootstrap, magnific-popup, etc.), JS in `rpw/static/js/` (copy, magnific-popup, btc price clipboard, autocomplete, analytics). Pepe images and QR codes are **symlinks** to external dirs (not in repo; ~1GB+ images).

### 1.5 What the static site can and cannot do

- **Can do (with third-party APIs)**  
  - **TokenScan API** (https://tokenscan.io/api): asset info, holders, dispensers, orders (order book), issuances, network/block, balances. No auth; CORS may apply.  
  - **RarePepeWallet feed** or a **static JSON** list of Pepe names (e.g. from `RarePepeDirectory_Series_Data.json` + links) for “all Pepes” / search without a DB.  
  - **Archive of Rare Pepe graphics** in this repo under something like `static-site/archive/` or `assets/pepes/` — whatever fits GitHub size limits; we can host a curated set and reference it from the static pages.

- **Cannot do (without a backend)**  
  - BTCPayServer webhook (`/B28vk/`), invoice creation, or “Advertise” flow that updates a DB or ad queue. We can still link out to an external “Advertise” or payment page.  
  - Server-side search redirect (exact address/Pepe → URL); we can do the same with client-side routing or hash-based URLs.  
  - Dynamic QR generation for dispenser addresses (we could pre-generate or link to a third-party QR service).  
  - Any feature that depends on MySQL or Counterparty RPC (we replace those with TokenScan API + static JSON where needed).

---

## 2. Static site plan

### 2.1 Goals

- **HTML + CSS + JS only** — no server runtime; deploy to GitHub Pages (or similar).
- **Live data** from **TokenScan API** (https://tokenscan.io/api); optional: RarePepeWallet feed or other public endpoints.
- **Archive** of Rare Pepe graphic assets in the repo, served as part of the static site (subset if needed to keep repo size reasonable).

### 2.2 Data strategy

- **Primary API**: **TokenScan** (https://tokenscan.io/api)  
  - Asset: `GET /api/asset/{asset}`  
  - Holders: `GET /api/holders/{asset}`  
  - Dispensers: `GET /api/dispensers/{asset}`  
  - Order book: `GET /api/market/{asset}/{quote}/orderbook` (e.g. XCP, PEPECASH)  
  - Network: `GET /api/network`  
  - Address balances: `GET /api/balances/{address}`  
  - Issuances: `GET /api/issuances/{address}` (or by asset/block)  
  See [TokenScan API](https://tokenscan.io/api) for full reference.

- **Pepe list / search**:  
  - Use the **RPD archive**: we archive all Rare Pepe Directory data (see [archive/RPD-ARCHIVE-PLAN.md](archive/RPD-ARCHIVE-PLAN.md)). Static files `data/RarePepeDirectory_Links.json` and `data/RarePepeDirectory_Series_Data.json` are already in this folder; optional `rpd-index.json` will hold per-pepe metadata.  
  - Option B: RarePepeWallet feed or other public list if we need a fallback.

- **Images**:  
  - Prefer **archive in repo** under e.g. `static-site/archive/pepes/` or `assets/pepes/` (filenames can match asset names or a mapping file).  
  - Fallback: link to RarePepeDirectory or TokenScan/IPFS if the API exposes image URLs (to be checked).

### 2.3 Pages to implement (static)

| Page | Data | Notes |
|------|------|--------|
| **Index** | TokenScan (e.g. latest dispensers) or static “featured” + random from pepe list | Mirror “Latest Dispensers” or “Random Pepes” from current index. |
| **Pepe detail** | TokenScan: asset, holders, orderbook | Single HTML shell; JS fetches by asset name (from path or query). |
| **Address** | TokenScan: balances for address | Single HTML shell; JS fetches by address. |
| **Artist** | TokenScan: issuances for address | Same as address but filtered to “issued” assets. |
| **Search** | Static pepe list + optional TokenScan | Client-side filter; exact match redirects to pepe or address page. |
| **FAQ** | Static HTML or JSON | Copy from `faq.xml` → HTML or small JSON. |
| **Wiki** | One Markdown file per card in `wiki/` | Artists submit PRs to add/edit; content from Book of Kek and community. |
| **Advertise** | Static HTML + link to external payment | No webhook; just CTA and link. |
| **404** | Static | Simple 404.html. |

Routing can be hash-based (`index.html#/pepe/PEPECASH`) or separate `pepe.html?asset=...`, `address.html?address=...` to avoid server config.

### 2.4 Archive of Rare Pepe data and assets

- **RPD data archive**: We archive **all Rare Pepe Directory data** (see [archive/RPD-ARCHIVE-PLAN.md](archive/RPD-ARCHIVE-PLAN.md)): index of every pepe page (name, amount issued, date, links), plus the existing Links and Series JSON. No runtime dependency on RPD.
- **Graphic assets**: **Location** `archive/pepes/` — a curated set of Pepe images (from RPD crawl or original packs, respecting rights). Naming by asset (e.g. `PEPECASH.png`) so the app can resolve images without a DB. Repo size: start small; document how to add more.

### 2.5 CORS and API limits

- If TokenScan blocks or limits browser requests, options: CORS proxy in development; or a serverless proxy (e.g. Cloudflare Worker) that forwards to TokenScan. For a first version we assume the API is usable from the browser.

---

## 3. Folder structure (target)

```
static-site/
├── README.md                 # This file (review + plan)
├── index.html                # Home + hash routing or entry to other pages
├── pepe.html                 # Pepe detail (or single-page with #/pepe/NAME)
├── address.html              # Address / artist holdings
├── search.html               # Search results
├── faq.html                  # FAQ (static)
├── advertise.html            # Advertise CTA + external link
├── 404.html                  # Not found
├── css/
│   └── style.css             # Custom styles (Bootstrap optional, via CDN)
├── js/
│   ├── app.js                # Index: load data/, render featured + random cards
│   ├── pepe.js               # Pepe detail: TokenScan asset + RPD link
│   ├── search.js             # Search: filter from data/, redirect on exact match
│   └── address.js            # Address: TokenScan balances
├── RESOURCES.md              # Key links: Counterparty, TokenScan, RPD; GitHub Pages only
├── data/                     # Static JSON (RPD archive data)
│   ├── RarePepeDirectory_Links.json
│   ├── RarePepeDirectory_Series_Data.json
│   └── rpd-index.json        # (optional) Full RPD per-pepe metadata
└── archive/                  # RPD archive plan + Rare Pepe assets
    ├── RPD-ARCHIVE-PLAN.md   # How we archive all RPD data
    └── pepes/                # Images by asset name (curated set)
```

---

## 4. Next steps

1. **TokenScan API** — Endpoints (asset, dispensers, holders, orderbook) and response shape documented at https://tokenscan.io/api.
2. **Index** — Header, title, search box, “Featured” + “Random Pepes” loaded via JS from static JSON (images from archive).
3. **Implement `app.js`** — Fetch one asset and one dispenser list; render cards in the index and a simple pepe detail view.
4. **Copy or adapt CSS** from `RarePepeWorld.com/rpw/static/css/` and optionally Bootstrap from CDN.
5. **Populate `archive/`** — Add a few sample Pepe images and document where the full set comes from (e.g. RarePepeDirectory, original site assets).
6. **Add `pepe.html` + address + search + FAQ** as needed, with shared JS for API and rendering.
7. **Build the RPD archive**: Run the crawler (see [archive/RPD-ARCHIVE-PLAN.md](archive/RPD-ARCHIVE-PLAN.md)); commit `rpd-index.json` and any updated data; optionally mirror images to `archive/pepes/`.

**Key resources**: [RESOURCES.md](RESOURCES.md) — Counterparty (https://counterparty.io/docs/api/), TokenScan (https://tokenscan.io/api), Rare Pepe Directory (http://rarepepedirectory.com/), and the rule: **GitHub Pages only, no server**.

---

## 5. Run locally

Fetching `data/*.json` and TokenScan API from the browser requires a real origin (no `file://`). From the repo root:

```bash
cd static-site
python -m http.server 8080
```

Then open **http://localhost:8080**. For GitHub Pages, push the `static-site/` contents to a branch and enable Pages on that branch (or use a `docs/` or root with the same structure).
