# Medieval Clothing Pack v1.0.0
Original pose-driven vector artwork extending the existing Shardfall layered armor prototype. Not a completed painted asset set. No game runtime files modified.
## Use
Serve repository root with `python3 -m http.server`; open `/asset-packs/medieval-clothing-v1/preview.html`. Choose role, region, body, direction, action, armour and material. World and paperdoll share one descriptor; export composite PNG or SVG atlas, and paperdoll PNG. Run `node asset-packs/medieval-clothing-v1/test.mjs` (structural checks, not visual QA). 
## Claude handoff
Read docs/handoffs/npc-costume-design-v1.md, paperdoll-v1.md, classic-human-sprites-v2.md, docs/equipment/STATUS.md, current AGENTS and README. Use this branch as a reviewable source pack; do not activate by default. Import views.mjs and use existing equipment and appearance records; never create inventory entries for cosmetic presets. Apply actual item weapon/secondary materials and two-handed legality from SF; this pack inherits prototype weapon geometry and does NOT finish its material channels. Unknown roles/factions are explicit flags. Resolve live role aliases before enabling. Use appearanceKey as an example only: add actual SF resolved colors, revision and complete appearance fields for cache keys. Cache native PNGs outside the frame loop, bounded and lazy. 
## Art integration gate
Validate all garment combinations and all eight directions, both bodies, all 29 actions including death/corpse, paperdoll crop, actual equipment and shields, mobile/desktop. Existing prototype has imperfect depth and occlusion; review against painted references. Do not label scaled SVG paperdoll as finished painted artwork. Do not replace good existing painted assets or mark missing-character-art entries done. For production, author independent transparent painted layers and material masks on the actual registered rig, separate paperdoll geometry, and replace prototypes only after review. No stat, damage, loot, AI, schedule or item-rule changes. 
## Files
wardrobe.mjs: semantic role recipes, dyes, five regional crests, pose-local garment geometry.
world-rig.mjs: fork of existing armor rig with garment paint phases.
views.mjs: shared world and doll render APIs, appearance cache-key prototype.
preview.html: animated art studio with atlas exports.
manifest.json: format and limits. test.mjs: structural test suite, run before integration.
