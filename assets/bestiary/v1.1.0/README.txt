SHARDFALL BESTIARY v1.1.0 — DRAFT 01

Six candidate sprite atlases (240 poses) normalized from generated art: boar, hound, snapper, spider, deer, hare. Original v1.0 assets are not included or replaced. Each sheet is RGBA 800x1280, 5x8 cells, 160x160, pivot (80,137). Images were segmented by connected component, cleaned, scaled using one factor per species and aligned. Technical geometry checked; in-engine visual quality, animation and actual walking/attacking alignment still need review. Some source poses touch edges; see validation.json.

Unfinished: bear, wreckcrab, wisp, sentinel, captain, bellkeeper, smuggler, bandit. No death frames are included. Do not treat this as a full release.

Extract at repository root on art/bestiary-v1.1.0. Integration instructions: docs/art/BESTIARY_V1_1_AUDIT.md on that branch. Keep current v1 ZIP intact. Use a merged manifest and update the embed tool before building. Keep old rendering fallback until all new sheets load. Do not change mechanics. Run tests and inspect at native scale.
