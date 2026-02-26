# Rare Pepe Wiki (per-card)

One Markdown file per Rare Pepe asset. Each card has a page at `wiki.html?asset=ASSETNAME` that loads `wiki/ASSETNAME.md` from this repo. **Artists and collectors can submit pull requests** to add or edit a card’s wiki file.

## Sources

Content is adapted from community wikis where applicable:

- **[Book of Kek](https://wiki.pepe.wtf/)** (pepe.wtf) — [Famous Rare Pepe Cards](https://wiki.pepe.wtf/chapter-2-the-rare-pepe-project/the-rare-pepe-blockchain-project/famous-rare-pepe-cards), [Series & Card Specific Lore](https://wiki.pepe.wtf/chapter-2-the-rare-pepe-project/the-rare-pepe-blockchain-project/series-and-card-specific-lore). Credit: Pepe Inc., Subterranean, and contributors. The full Book of Kek ([source repo](https://github.com/thepepeinc/book-of-kek)) is integrated on this site and viewable at **Book of Kek** (link in the footer).
- **Rare Pepe Directory** — Official list of 1,774 cards across 36 series (submissions closed 2018).

We do not copy the Book of Kek verbatim; we use it as reference and attribute where we adapt. Artists are encouraged to add or correct lore for their own cards.

## How to add or edit a card

1. **One file per asset** — Filename must be the asset name + `.md`, e.g. `RAREPEPE.md`, `PEPECASH.md`. Use the exact Counterparty asset name (usually UPPERCASE).
2. **Use [TEMPLATE.md](TEMPLATE.md)** as a starting point for a new card.
3. **Open a pull request** — Edit or create `wiki/ASSETNAME.md` in your fork and open a PR to this repo. Maintainers will review.
4. **No images in repo** — Link to images hosted elsewhere (e.g. Rare Pepe Directory, pepe.wtf, IPFS) rather than committing large binaries.

## File format

Plain Markdown. First heading is the card title (e.g. `# RAREPEPE`). You can include series, supply, artist, lore, and links. No frontmatter required.

## Index

The wiki index is built from `data/RarePepeDirectory_Series_Data.json`. Every card in that list can have a wiki page; if `wiki/ASSETNAME.md` exists, it is shown when users open `wiki.html?asset=ASSETNAME`.
