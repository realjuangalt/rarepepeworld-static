# Key resources & APIs

Central list of **official links** for the static site: docs, APIs, and the Rare Pepe Directory. Hosting is **GitHub Pages only** — no server. Some APIs may be outdated or require keys; we use them only from the static site (browser or, if needed, GitHub Actions for build-time data).

---

## Counterparty

| Resource | URL |
|----------|-----|
| Main site | https://counterparty.io/ |
| Docs | https://counterparty.io/docs/ |
| Protocol specification | https://counterparty.io/docs/protocol_specification/ |
| **API** | https://counterparty.io/docs/api/ |

Counterparty runs on Bitcoin; the API is typically used via a **self-hosted node** (RPC). For a static site we rely on **TokenScan API** (and optionally other public APIs) instead of running a node.

---

## TokenScan (explorer & API)

| Resource | URL |
|----------|-----|
| **TokenScan** (site + explorer) | https://tokenscan.io/ |
| **TokenScan API** (data) | https://tokenscan.io/api |

**TokenScan** is the Counterparty block explorer. The static site uses the **TokenScan API** for all live data: asset info, holders, balances, issuances, orderbook (`/api/asset/`, `/api/holders/`, `/api/balances/`, `/api/issuances/`, `/api/market/{asset}/{quote}/orderbook`). Explorer links point to TokenScan (e.g. [address](https://tokenscan.io/address/1DevGw4eJWtGZWNjQXagEVnP3XGXH4o6dT)). No auth; rate limits or CORS may apply.

---

## Rare Pepe Directory (RPD)

| Resource | URL |
|----------|-----|
| **Rare Pepe Directory** | http://rarepepedirectory.com/ |

RPD is a **website** (not a REST API). We are building an **archive of its data** in this repo so the static site can work without depending on RPD being up. See [archive/RPD-ARCHIVE-PLAN.md](archive/RPD-ARCHIVE-PLAN.md) for what we archive and how.

---

## Hosting: GitHub Pages only

- **Goal**: Host the static site on **GitHub Pages** for free. No server to run.
- **Stack**: HTML, CSS, and JavaScript only. Live data from **TokenScan API**; Counterparty docs for reference.
- **API keys**: If any service requires an API key or account, we use it only in a **static-friendly** way, e.g.:
  - **Build-time**: GitHub Actions can run a script that fetches data and writes JSON into the repo; Pages serves the result. No runtime server.
  - **Client-side**: If an API allows browser requests with a key (and CORS), we can use it from the frontend. Keys would live in repo or GitHub secrets and be baked into the built output only if safe (e.g. public read-only keys).
- **No server**: We do not run a backend, proxy server, or persistent process. Optional use of **GitHub Actions** (e.g. scheduled job to refresh RPD archive or API caches) is fine — that’s not “running a server” for the site.

---

## Quick reference

- **Counterparty API (node)**: https://counterparty.io/docs/api/
- **TokenScan API**: https://tokenscan.io/api
- **RPD (archive source)**: http://rarepepedirectory.com/
- **Static site plan**: [README.md](README.md)
- **RPD archive plan**: [archive/RPD-ARCHIVE-PLAN.md](archive/RPD-ARCHIVE-PLAN.md)
