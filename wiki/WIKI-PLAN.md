# Rare Pepe Wiki — Plan & Sources

## Goal

A **static, GitHub-based wiki** where each of the 1,774 Rare Pepe cards can have one Markdown file. Artists and collectors submit **pull requests** to add or update a card’s page. No server; the site fetches `wiki/ASSETNAME.md` and renders it with [marked.js](https://marked.js.org/) on the **wiki** page.

## Existing Rare Pepe wikis (research)

1. **[Book of Kek](https://wiki.pepe.wtf/)** (pepe.wtf)  
   - **Repo:** [thepepeinc/book-of-kek](https://github.com/thepepeinc/book-of-kek) (GitBook).  
   - **Content:** [Famous Rare Pepe Cards](https://wiki.pepe.wtf/chapter-2-the-rare-pepe-project/the-rare-pepe-blockchain-project/famous-rare-pepe-cards) (notable cards with lore), [Series & Card Specific Lore](https://wiki.pepe.wtf/chapter-2-the-rare-pepe-project/the-rare-pepe-blockchain-project/series-and-card-specific-lore) (per-series pages with card write-ups).  
   - **Contrib:** “BoK Edit Request” to wiki@pepe.wtf or follow their how-to.  
   - **Use:** We use as reference and attribute; we do not copy verbatim. Seed a few cards (e.g. RAREPEPE, PEPECASH, LORDKEK) from Famous Rare Pepe Cards and Series 1 lore.

2. **Rare Pepe Directory**  
   - Official list of cards and submission rules; no narrative wiki. We use it for the **canonical list** of assets (Series data) to build the wiki index.

3. **Wikipedia — Rare Pepe**  
   - High-level article; no per-card pages. Useful for project history only.

## Content strategy

- **One file per asset:** `wiki/ASSETNAME.md` (exact Counterparty asset name).  
- **Format:** Plain Markdown; first heading = card title. Optional: series, supply, artist, lore, links.  
- **Sources:** Where we adapt from Book of Kek, we add a short attribution line (e.g. *Adapted from Book of Kek (pepe.wtf).*).  
- **New/empty cards:** If a card has no file, the wiki viewer shows “No wiki page yet” and points to the template and README so anyone can add `wiki/ASSETNAME.md` via PR.  
- **Duplication:** We don’t mirror the whole Book of Kek (they organize by series). We duplicate only what we need for a **per-card** wiki and invite artists to fill in the rest.

## Implementation (done)

- **`wiki/` folder:** README (sources + how to contribute), TEMPLATE.md, and seed files: RAREPEPE.md, PEPECASH.md, LORDKEK.md (from Book of Kek).  
- **`wiki.html`:** Query `?asset=ASSETNAME` → fetch `wiki/ASSETNAME.md` (same origin), render with marked.js, show in content box. If 404 → show “No wiki yet” + link to template/README. No `?asset` → show **index** (all cards by series from `data/RarePepeDirectory_Series_Data.json`).  
- **`js/wiki.js`:** Fetches md, calls `marked.parse()`, fills `#wiki-content`; index mode builds list from Series data.  
- **Pepe detail page:** Wiki link (📖) next to RPD and TokenScan → `wiki.html?asset=ASSET`.  
- **Footer:** “Wiki” link added on index and key pages.

## How artists contribute

1. Fork the repo.  
2. Add or edit `wiki/ASSETNAME.md` (use `wiki/TEMPLATE.md` for new cards).  
3. Open a pull request.  
4. Maintainers review and merge.  
5. After deploy (e.g. GitHub Pages), the card’s wiki page updates.

No backend, no wiki engine — just Markdown in the repo and a static viewer.
