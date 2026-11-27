# Sprites, paper doll and equipment: what is left (v0.33)

The status after the v0.33 merge (branch `integration/v0.33`), with one renderer for player, NPC and corpse appearance: `SF.GEAR` (#38, `src/gear.js`, `src/gear-render.js`). NPC clothing comes from `SF.WARDROBE` (#39, `src/wardrobe.js`) and is drawn by `SF.GEAR`. Machine-readable sources are listed beside each section, so this file can be checked against the build.

## Where each kind of art stands

| Area | In the game now | Shown by default? |
|---|---|---|
| Paper doll (equipment window) | Medieval Equipment Art v1: painted pieces fitted to male and female bodies, recoloured per material through masks | No: behind the "New art" toggle in the equipment window |
| World humans (walking, fighting) | The layered rig in `src/human-rig.js`: 2 bodies × 8 directions × 29 animations, drawn procedurally and coloured from the real equipment and materials | No: same toggle |
| NPC outfits | Wardrobe v1: regional guard uniforms by rank, 34 civilian roles, 3 hostile human types, palettes, work and off-duty states | No: same toggle (old sprites otherwise) |
| Painted world humans | Painted Human Candidates v0.1: 101 of 192 frames accepted, no complete cycle | No: developer flag only |
| Backpack icons | Painted atlas v1.0.1 (161 ids). 44 of the 67 equipment ids with no icon borrow their paper-doll piece when the toggle is on | Painted atlas: yes |
| Corpses | The owner's last appearance, then the death pose | With the toggle |

So nothing new is shown by default. Shipping it takes the art below, then one visual sign-off. After that, `setGearArt` becomes the default.

## 1. Paper doll: 21 items with no painted piece

Source: `SF.GEAR.missingArt()`; also `docs/equipment/RENDERING.md`. On the doll these draw nothing. In the world the rig draws its procedural shape.

- **Weapons (8):** battleaxe, dagger, glaive (halberd), hatchet, heavycrossbow, knife, kryss, pickaxe
- **Shield (1):** buckler, the most common starter shield
- **Clothing (6):** cloth_cap, cloth_gloves, shirt, trousers, shoes, tabard. Every new character wears the shirt, trousers and shoes, so these come first.
- **Neck (3):** leather_gorget, studded_gorget, plate_gorget
- **Jewelry (3):** ring, bracelet, necklace

Use the same master-sheet format as the Medieval Equipment Art v1 pack: a transparent piece, a matching material mask, and the anchors in `DOLL_PLACE` (`src/gear-render.js`). Use neutral tones so the masks can recolour them.

**Also missing:** a painted front-view body for the doll, male and female, about 96×192, matched to those anchors (`assets/character/missing-character-art.json` → `paperdoll_body`). Hair and beard layers for the doll are missing too (§4).

**Pieces in the pack with no game item** (kept, unused): chain_sleeves, chain_gloves, kettle_helm, heraldic_shield, studded/fur/plate boots, studded and heavy belts, pouch, staff. To use them, the item has to be added to the game first.

## 2. Backpack icons: 23 with no painted tile

Source: `assets/equipment-icons/missing-icons.json` (67 listed), less the 44 that the paper-doll pieces cover. Format: 64×64, transparent, in the style of `assets/backpack-icons/v1.0.0`. Embed them with `python3 tools/embed_backpack_icons.py`.

- **Clothing, neck and jewelry (12):** cloth_cap, shirt, trousers, cloth_gloves, tabard, shoes, leather_gorget, studded_gorget, plate_gorget, ring, bracelet, necklace. Paint these with §1 and use the same painting for both.
- **Materials (11):** ore_mithril, ingot_mithril, hide_thick, hide_spined, hide_horned, hide_barbed, hide_wolf, hide_troll, hide_dragon, bone, dragonscale

The 44 borrowed icons only show while the toggle is on. Once the toggle becomes the default, they are covered too.

## 3. World sprites (the largest job)

Contract: `asset-packs/classic-humans-v2/` (the rig) and `docs/equipment/RENDERING.md`. Cells are 112×100 with the feet anchor at (56, 86). Rows run S, SW, W, NW, N, NE, E, SE.

The procedural rig already plays every animation with real equipment and materials, so the game is playable with it. What is missing is painted art. The painted equipment pieces are static and must not be pasted onto a moving body. A painted world needs a layered set:

- **Base bodies** (male and female) with no baked hair, cloak, shirt or trousers. 211 frames per direction per body for the full 29-animation set, so 3,376 frames in all. A first release can stop at about 9 animations: idle 4, walk 8, run 8, ready 4, one swing 8, cast 8, hit 4, death 8 and corpse 1. That is 53 frames per direction per body, or 848 frames.
- **Per-slot overlays** on the same canvas and anchor, with near-limb and far-limb parts and primary, secondary and fixed masks: head, neck, torso, arms, hands, legs, feet, robe, tabard, cloak, weapon and shield.
- **Hair, beard and skin:** hair styles and beards as tintable layers, plus skin-tone masks.

What the painted candidates v0.1 pack still lacks (`assets/humans/painted-candidates-v0.1/missing.json`):
- 25 direction gaps where every candidate was rejected. Male: Idle S/NW/N/NE/E, Walk S/NW/N/NE, Cast S/NE, Unarmed S/NW/N/NE. Female: Idle S/N/NE, Walk S/NE, Cast S/NE, Unarmed S/NW/NE.
- No complete cycle: at most 3 poses per direction, where idle needs 4, walk needs 8 and unarmed attack needs 8.
- 10 missing actions: run, ready, hit, death, corpse, ghost, the split cast (prepare, hold, release), every weapon attack family, shield block, and the work animations (mining, woodcutting, fishing, smithing, crafting, bandaging).
- 11 missing layers: a clean base body, hair, beards, skin masks, clothing layers, armour slot overlays, robe/tabard/cloak overlays, weapon overlays with hand sockets, shield overlays, tint masks, and doll portraits that match.

The painted candidates bake in hair and clothing. That makes them a style reference, not a base to build on.

## 4. Creator looks with no art yet

Source: `assets/character/missing-character-art.json`. The creator stores these looks, and the layered rig draws them procedurally, but no painted art exists for:

- the female traveller body (every clip)
- male and female bodies without the painted hood and cloak
- the cloak (with raised hood) as its own tintable layer
- 8 hair styles (short, long, ponytail, pageboy, receding, mohawk, buns, pigtails) and 5 facial-hair styles
- shirt and trousers as tintable layers

## 5. NPC wardrobe extras SF.GEAR does not draw yet

Source: `SF.WARDROBE.OVERLAYS` and `SF.WARDROBE.PROPS`. #39 drew these on its own procedural rig, which was not ported. On SF.GEAR they are skipped, and townsfolk still wear the right pieces and colours.

- **16 overlays:** apron_long, apron_short, vest, skirt, dress, straw_hat, hood, headscarf, sash, pouch, mantle, trim, crest, heraldry, bracer, wear. Of these, the regional **heraldry** on guard tabards matters most.
- **6 overlays never made:** hood_down, measuring_tape, bedroll, quiver, sleepwear, embroidery
- **12 work props:** smith_hammer, tongs, pickaxe, hatchet, fishing_rod, tankard, book, staff, basket, lantern, bow, knife
- **11 props never made:** saw, hoe, crook, bread, sewing_kit, vial, bandage, rope, pouch_goods, holy_symbol, reagent_pouch

**Code to-do:** add an overlay pass to `src/gear-render.js`, the same layer order the wardrobe uses, so these show once art exists. Until then, a procedural shape could stand in.

## 6. Checks before the art goes live

- Hand-check the automatic masks (straps, studs, cloth trim, heraldry, handles), as `RENDERING.md` notes.
- Sign off the doll on both bodies, the world sprites in every direction, crowds, corpses, and phone sizes.
- Then make the toggle the default, and keep the old sprites one release longer as a fallback.

## Suggested order for the next art requests

1. Paper-doll pieces and icons for the 12 clothing, neck and jewelry items (§1, §2). This one batch fixes both the doll and the backpack for every new character.
2. The 9 weapon and shield doll pieces (§1).
3. Paper-doll base bodies, male and female (§1), plus hair and beard layers for the doll (§4).
4. The 11 material icons (§2).
5. A sign-off pass, then turn on the new art by default (§6).
6. World: a clean male base body in the 9-animation set, as one test direction first (S), then all 8. After that, the female body, then the overlays (§3).
7. Wardrobe heraldry and aprons (§5), plus the code to draw overlays.
