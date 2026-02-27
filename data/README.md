# Static site data

## Files

- **asset_metadata.json** — **Primary source of truth** for pepe data. Built by `scripts/build_asset_metadata.py` from the sources below. Contains per-asset: issued, destroyed, circulating, divisible, note, supply_cap, artist, series, rpd_url. The site loads only this file for supply, cap, artist, series, and RPD link.
- **rarepepe-supply.json** — Input for the asset_metadata build. From `scripts/build_supply_data.py` (TokenScan API). Supplies issued, destroyed, circulating, divisible, note.
- **rarepepe-supply-overrides.json** — Optional: artist corrections. Add entries here and re-run `build_supply_data.py`, then re-run `build_asset_metadata.py` to refresh asset_metadata.json.
- **RarePepeDirectory_Series_Data.json** — Series number → list of asset names. From `scripts/archive_rpd.py`. Consumed by `build_asset_metadata.py` for the `series` field.
- **RarePepeDirectory_Links.json** — Asset name → Rare Pepe Directory URL. From `scripts/archive_rpd.py`. Consumed by `build_asset_metadata.py` for the `rpd_url` field.

## Build order

1. `build_supply_data.py` — Fetches TokenScan API → **rarepepe-supply.json**
2. `build_asset_metadata.py` — Merges rarepepe-supply + Series_Data + Links + existing asset_metadata (seed for artist/supply_cap) → **asset_metadata.json**

To add or fix **artist** or **supply_cap** (when TokenScan has no data): edit **asset_metadata.json** manually for those assets, then re-run `build_asset_metadata.py` with that file as seed (default). The script preserves artist and uses seed supply_cap when issued is missing.

## Supply data (issued, burns, circulating)

- **Issued** = total supply minted on-chain (from TokenScan).
- **Destructions** = Counterparty burns; we sum TokenScan `/api/destructions/{asset}`.
- **Circulating** = issued − destroyed. Stored in asset_metadata.json; site uses it for “Owns X of Y” and supply display.

**Reference:** [pepe.wtf](https://pepe.wtf/) for manual verification. To correct supply: add to `rarepepe-supply-overrides.json`, re-run `build_supply_data.py`, then `build_asset_metadata.py`.

Assets with no legible name (e.g. numeric IDs like `A14439212225401773150`) are not official Rare Pepes; the address page shows only legible-name assets in the main grid and links to TokenScan for “other” holdings.
