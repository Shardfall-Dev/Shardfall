# Bestiary v1.1.0 — audited replacement plan

Baseline: main e059eb05e53f77dfb4050ac3711601abaaa64aaa (v0.28.1). This is an art-only branch; no gameplay code or existing sprites are replaced by this document.

## Current roster
Source: src/game.js MON and drawEnt; src/ecology.js ECO; src/frontier.js bandit; assets/bestiary/v1/manifest.json; docs/WORLD_SIMULATION_PROGRESS.md asset inventory.

Keep existing dedicated sheets: rat, skeleton (MON_SHEETS); orc, ettin, troll, lizardman, gargoyle, earth_elemental, giant_spider, dire_wolf, harpy, slime, lich_lord (BESTIARY v1). The rat profile in ECO says procedural but the renderer checks MSI; fix the stale metadata after confirming MON_SHEETS actually loads.

Replace 11 procedural sprites and 3 scout recolours, in this order:
| ID | Name | Current | Art direction |
|---|---|---|---|
| boar | Reed boar | procedural | Dark coarse bristles, brown tusked wild boar, low head |
| hound | Marsh hound | procedural | Lean dark gray-green wet-furred feral dog |
| snapper | Mud snapper | procedural | Mossy olive armored snapping turtle |
| spider | Mire spider | procedural | Small dark brown-purple spider, eight jointed legs |
| deer | Red deer | procedural | Russet stag, restrained branching antlers |
| hare | Brown hare | procedural | Small brown hare, long ears, hopping gait |
| bear | Brown bear | procedural | Heavy shaggy brown bear |
| wreckcrab | Wreck crab | procedural | Rust red-brown crab, barnacled claws |
| wisp | Ash wisp | procedural | Ember-orange smoky floating elemental, limited glow |
| sentinel | Bell sentinel | procedural | Tarnished bronze and weathered iron guardian, bell-shaped armor |
| captain | Drowned captain | scout recolour | Undead sea captain, faded teal coat, rusted cutlass, waterlogged bones |
| bellkeeper | The Bellkeeper | procedural boss | Large ancient bronze bell-headed construct, restrained golden rim like Lich Lord |
| smuggler | Brine smuggler | scout recolour | Weathered salt-stained leather and burgundy sash, short blade |
| bandit | Road bandit | scout recolour | Brown leather hood and rough asymmetrical mail, worn sword |

Future roster (not current MON IDs, separate ticket): zombie, dragon, drake, fire elemental, water elemental, goblin. No additions to spawns or balance in this art branch.

## Existing sheet contract
Use original hand-painted, pixel-dithered 2.5D isometric dark fantasy sprite appearance; match assets/bestiary/v1/orc.png. Transparent PNG, no baked ground shadow, no text or guides. 800×1280 (5×8 cells at 160×160), pivot (80,137), rows S SW W NW N NE E SE. Columns stepA, neutral, stepB, windup, impact. Keep existing scale, consistent top-left light, restrained palette, real silhouettes, discrete directional poses. Use game camera facings, not compass world axes. Movement and strike must remain visibly different, no sprite cutoffs or cell spill. Aim for MON.h rendered height with explicit artScale if necessary; don't change combat size/reach. Use distinct death/corpse art in an optional separate sheet, not a generic skeleton pile. No new boss aura except Bellkeeper.

## Integration instructions
- Place reviewed PNGs and a manifest in versioned assets/bestiary/v1.1.0/; preserve original v1.0.0 ZIP and assets. Update tools/embed_bestiary.py to accept a versioned manifest and generate a merged BESTIARY from the old and new packs, reject duplicate IDs and invalid dimensions/alpha. Keep generated src/bestiary-art.js reproducible.
- In drawEnt prefer a loaded dedicated bestiary sheet over MON.scout without deleting scout flags (these also affect gameplay such as taming); if a sheet fails or is still loading, actually fall back rather than returning an invisible actor. Existing MSI sheets continue to work. Use bestiary sheets for polymorph/forms where applicable; drawForm currently only checks MSI, then procedural art.
- Preserve faction, spawn, AI, loot, stats, saves, sound, attack timing, telegraph and latched facing. Do not mix in the ongoing code audit changes. Update ECO art metadata truthfully.
- Existing bestiary-smoke test expects every manifest mob to strike player; extend coverage carefully for timid wildlife and ranged creatures (do not change their AI just to satisfy test). Test all 40 cells, alpha, row order, anchor, actual movement, contact and recovery; verify all three scout-replacement creatures render with new art. Extend corpse rendering/test independently if death sheets are added.
- Build a new version after integration (coordinate version number with latest main); run bestiary, world, combat, magery and mobile smoke tests. Review a lineup at actual native in-game scale before merging.

## Status
Draft01 (boar, hound, snapper, spider, deer, hare) integrated in v0.28.2; see BESTIARY_V1_1_DRAFT01.md. The other eight replacements are still open. Do not promote generated drafts into the build until grid, alpha, facing, and animation quality pass visual and technical QA.
