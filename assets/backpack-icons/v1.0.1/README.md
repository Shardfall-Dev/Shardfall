# Backpack icons v1.0.1 — the seven missing inventory icons

Seven 64 × 64 PNGs (24-colour indexed, transparent) for items that had no painted icon in v1.0.0:

| File | Item id | Item |
|---|---|---|
| `icons_64/heavycrossbow.png` | `heavycrossbow` | Heavy crossbow |
| `icons_64/battleaxe.png` | `battleaxe` | Battle axe |
| `icons_64/mace.png` | `mace` | Mace |
| `icons_64/waraxe.png` | `waraxe` | War axe |
| `icons_64/kryss.png` | `kryss` | Kryss |
| `icons_64/spear.png` | `spear` | Spear |
| `icons_64/wick.png` | `wick` | Dry wick (quest item: *A Light for the Quay*, the Shore Beacon) |

Source: branch `assets/missing-inventory-icons-v1.0.0`, commit `332a654f2fdacf1b9de45e1251c4bd3c4fdd8876`. `missing-icons.json` holds the same PNGs as base64 (byte-identical to the files).

`python3 tools/embed_backpack_icons.py` reads the v1.0.0 ZIP, pastes these files unchanged into the next free 64 px cells and writes `src/backpack-icons.js` (version 1.0.1, 161 icons, atlas 1024 × 704). The v1.0.0 tiles keep their rectangles and pixels. Needs Pillow for this step. Then `./build.sh <version>`.
