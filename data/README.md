# Static site data

## Files

- **RarePepeDirectory_Links.json** — Asset name → Rare Pepe Directory URL. From `scripts/archive_rpd.py`.
- **RarePepeDirectory_Series_Data.json** — Series number → list of asset names. From `scripts/archive_rpd.py`.
- **rarepepe-supply.json** — Per-asset supply caps (issued, destroyed, circulating). From `scripts/build_supply_data.py` (TokenScan API). Used on the address page for “Owns X of Y” (Y = circulating supply).
- **rarepepe-supply-overrides.json** — Optional: artist corrections. When someone reports wrong supply, add an entry here and re-run `build_supply_data.py` to merge with API data.

## Supply data (issued, burns, circulating)

- **Issued** = total supply minted on-chain (from TokenScan `/api/asset/{asset}`).
- **Destructions** = Counterparty’s official way to destroy supply; we poll TokenScan `/api/destructions/{asset}` and sum `quantity` for that asset.
- **Circulating** = issued − destroyed. This is what we show as the “supply cap” (Y) on the address page.

**Reference:** [pepe.wtf](https://pepe.wtf/) has good Rare Pepe data for manual verification. We build our file from the API and optionally apply overrides; if an artist tells us something is wrong, add it to `rarepepe-supply-overrides.json` and re-run the build script.

Assets with no legible name (e.g. numeric IDs like `A14439212225401773150`) are not official Rare Pepes; the address page shows only legible-name assets in the main grid and links to TokenScan for “other” holdings.
