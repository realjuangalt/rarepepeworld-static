#!/usr/bin/env python3
"""
Create minimal wiki stub .md files for every Rare Pepe asset that doesn't have one.
Run from static-site: python3 scripts/create_wiki_stubs.py
"""
import json
import os

DATA_PATH = "data/RarePepeDirectory_Series_Data.json"
WIKI_DIR = "wiki"

def main():
    with open(DATA_PATH) as f:
        data = json.load(f)
    existing = {f.replace(".md", "") for f in os.listdir(WIKI_DIR)
                if f.endswith(".md") and f not in ("README.md", "TEMPLATE.md", "WIKI-PLAN.md")}
    created = 0
    for series in sorted(data.keys(), key=int):
        for asset in data[series]:
            if asset in existing:
                continue
            path = os.path.join(WIKI_DIR, f"{asset}.md")
            stub = f"""# {asset}

**Series:** {series}
**Supply:** —

## Lore

No wiki content yet. See [pepe.wtf](https://pepe.wtf/asset/{asset}) or [TokenScan](https://tokenscan.io/asset/{asset}). To add lore, open a pull request—see [wiki/README.md](README.md).
"""
            with open(path, "w") as f:
                f.write(stub)
            created += 1
            if created <= 5 or created % 200 == 0:
                print(f"Created {path} ({created} so far)")
    print(f"Done. Created {created} stub wiki pages.")

if __name__ == "__main__":
    main()
