# Superseded human and equipment renderers (kept for reference)

Five parallel pull requests each built their own way to draw humans and equipment. v0.33 keeps one: the layered `SF.GEAR` renderer from #38 (`src/gear.js`, `src/gear-render.js`, `src/human-rig.js`). The rest was handled like this:

| PR | What it built | What happened in v0.33 |
|---|---|---|
| #35 layered-armor-v1 | `human-render.js` / `human-rig.js` armor painter | Its asset pack was already on main and #38 builds on it. Its status doc is kept here. |
| #36 classic-humans-v2 | One human renderer for all weapons, procedural | Code not merged. Its status, missing-art list and screenshots are kept here. |
| #37 paperdoll-v1 | `paperdoll.js` compositor and `appearance.js` | Code not merged (#38's doll replaces it). Its paper-doll manifest and design doc are kept here. |
| #39 npc-wardrobe-v1 | `wardrobe.js` + its own procedural rig `humanrig.js` / `humans.js` | `src/wardrobe.js` is merged and now drawn by SF.GEAR. The rig is not merged, and its screenshots are kept here. |
| #40 classic-humans-v2.1 | Painted compositor over #39 | Code not merged. Its painted atlases are kept in `assets/humans/painted-v2.1/`, and its contract, status and screenshots here. |
| #41 painted candidates v0.1 | Painted frames behind the developer flag | Merged (`src/painted*.js`). |

These docs describe code that is not in the game. They are reference only. What is still needed is in `docs/art/SPRITES_PAPERDOLL_EQUIPMENT_GAPS.md`.
