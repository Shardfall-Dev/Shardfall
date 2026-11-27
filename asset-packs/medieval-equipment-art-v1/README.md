# Shardfall Medieval Equipment Art v1.0.0 — integration handoff

Status: original generated medieval equipment artwork, static only. The companion ZIP (Shardfall_Medieval_Equipment_Art_v1.zip) was created locally; binary files are NOT present in this commit. Import the ZIP contents into this directory before integration. Do not treat this README as evidence of uploaded PNGs or completed game integration.

## Pack
- master.png: transparent original art sheet, 1536 × 1024.
- pieces/: 97 transparent PNG pieces (69 base IDs and 28 separate image-left/image-right arm and glove components).
- masks/: matching RGBA masks, R = primary material weight, G = secondary material weight, B = fixed remainder, A = source alpha.
- manifest.json: item IDs, material channels, art paths, crop geometry, dimensions, and palette snapshot.
- preview.html: standalone offline static recolor preview.
- README.md inside ZIP: further asset notes.
- Families: leather, studded, ringmail, chain, plate, bone, dragon scale, helmets, robes/cloaks, boots, belts, shields, sword, axe, warhammer, mace, spear, staff, bow and crossbow. *_concept means not a confirmed gameplay ID. More equipment remains missing (e.g. distinct gorgets, jewelry, many weapons, body-specific overlays).

## Integration
1. Inspect src/equipment.js, src/rules.js, actor rendering, paperdoll, corpse/saves, build pipeline and asset-packs/classic-humans-v2 and layered-armor-v1. Current gameplay item definitions, material IDs, EQ.matColor, EQ.appearance and two-handed flags are authoritative. Do not change balance, weights, item identity, crafting, or save semantics.
2. Use the PNGs as static references/inventory art only after confirming exact IDs and existing icon compatibility. Do not overwrite approved existing icons without visual comparison. Masks are automatically estimated; hand-correct material boundaries, straps, studs, edges, cloth trim, heraldry and handles. Use original alpha. Recolor only selected primary/secondary channels via luminance-preserving material ramps, never a CSS hue filter over the whole character. Per-slot material resolution: plate uses metal, leather uses hide, studded uses hide + separate metal, bows use wood, mixed weapons use separate metal and wood. Use live EQ.matColor; preview palettes are snapshots.
3. Produce a fitted paperdoll body for each sex with independent per-slot overlays, including hair occlusion, layered clothing, weapon/offhand, shield, jewelry and proper shared anchor. The static gear atlas has no anatomical fit, independent torso shoulders, or pose alignment and must not be pasted as a runtime character sprite.
4. For world art, match classic-humans-v2 (112x100 cells, anchor 56,86, 8 directions, 29 animations) or explicitly version a migration after clipping tests. Fit separate near/far limb, hand, leg, torso, head, weapon and shield overlays to the exact body pose and frame. No full character redraw for material variants. Preserve direction-specific ordering and equip/unequip on actual game state. Both paperdoll and world use the same item/material keys. Corpses retain snapshot appearance.
5. Keep procedural rig as fallback until final painted overlays exist. Cache recolored/composited assets outside render loop. Test mixed iron/valorite/mithril, different hides, bloodwood bow, independently colored studs, both body types, 8 directions, every animation, NPCs, save/load, combat, and two-handed/offhand suppression. Explicitly report missing definitions and missing frame art. Do not claim production animation completion before visual QA and actual integration.
6. No gameplay changes are part of this asset pack. The locally generated crops and mask dimensions were checked; live game integration, hand-authored masks and browser visual QA remain outstanding.
