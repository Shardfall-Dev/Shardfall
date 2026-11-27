# Equipment rendering (v0.32) — Medieval Equipment Art v1 and the layered renderer

Status: **integrated behind a review flag, off by default.** The previous renderer is unchanged and stays the default until the new art passes visual review. Turn it on with **New art** in the paper doll's title bar (saved in settings), or for one visit with `?gear=new`. `?gear=old` forces it off.

## What draws what

| View | Source of the look | Art |
|---|---|---|
| Paper doll | `SF.GEAR.ofChar(P)`: the real equipment | Painted Medieval Equipment Art v1 pieces, recoloured per material channel through their masks, on a fitted male or female body |
| World: player, Wren | `SF.GEAR.resolve(equip, look)`: the real equipment | Layered human rig (classic-humans-v2 body + layered-armor-v1 painter), every piece on its own moving segment |
| World: townsfolk, guards, human enemies | `SF.GEAR.PRESETS`: cosmetic outfits of real item ids (never in any inventory, never loot) | Same rig |
| Corpses | `SF.GEAR.snapshot()`, taken before the death transaction moves the items | Same rig, death animation, then the corpse pose |
| Backpack and slot icons | The item | Its existing painted icon. Only items without one show their painted piece (when the flag is on) |

All four read **one** resolver (`src/gear.js`, pure and node-tested). Nothing in the renderer changes items, slots, materials, weights, armor, combat, crafting or save semantics. Saved corpses gain an optional `gear` field (appearance only), which older builds ignore.

## Material channels

Every piece has up to two recolourable channels and fixed paint:

- **Armor.** The piece's material (`SF.matOf`, or `fixedMat` for cloth, bone and dragon scale). Studded leather adds its stud metal (`it.sec`) as a separate channel.
- **Weapons.** The blade or head metal and the grip or shaft wood are separate channels. A crafted weapon records one material. The other channel keeps its default (pine grip on a smithed sword, iron fittings on a bow) unless the item has `sec`.
- **Shields.** Wood or metal body. A wooden shield's boss is its metal channel.
- **Cloth.** Robes, shirts, tabards and caps take the wearer's clothing colour. The cloak takes the wearer's cloak colour (Character Creation v2). No dye field is added.

Colours always come from the live `EQ.matColor`, never from the packs' palette snapshots.

**Paper doll recolouring.** Mask R = primary weight, G = secondary weight, B = fixed. A material colour is mapped onto the mean brightness of that channel's pixels, keeping the painted light and shade (luminance-preserving ramp). Pixels outside the channel keep their paint. Where the art already shows a material (iron, regular leather, pine), the painting is kept exactly. Nothing ever recolours the whole figure.

**Mask corrections** (`tools/embed_equipment_art.py`; per-piece pixel counts are written into `GEAR_ART.item[id].fixedPx`). The pack's masks were estimated automatically. These rules move pixels from the primary channel to fixed paint:

- metal pieces: saturated paint (heraldry, leather straps, grips);
- hide, cloth and wood pieces: bright, unsaturated metal (buckles, rivets, bow strings);
- cloth pieces: gold embroidery and trim.

The largest corrections were on the heater shield (708 px), robes (364–951 px) and great helm (624 px). Hand review of straps, studs and heraldry is still recommended (see "Still to do").

## Occlusion (shared by doll, world and corpse)

- A **two-handed** weapon (`SF.WEAPONS[wpn].two`) hides the off hand in every animation state, even if an old save left a shield in the slot.
- **Head pieces** (`SF.GEAR.HEAD_COVER`): caps, bascinet, open and norse helms trim hair (no long hair, braids or buns). A coif hides hair. Closed, plate, great, bone and dragon helms hide hair and the face (beard). On the doll, the painted dark interior of open-faced helmets is cut away so the face shows.
- The **robe** is drawn over torso armor. The **cloak** is behind the body facing the viewer and over it facing away.
- **Death and corpse** poses facing straight S or N turn one step diagonal: a fall toward or away from the camera foreshortens into a squat upright shape.

## Paper doll fit

The body is drawn from the silhouettes of the leather pieces: arms and hands in skin, trousers, shoes, and an undyed shirt in the clothing colour. Every armor family therefore lands on the anatomy it was painted for. The head, face, hair and beard are drawn to match the painted shading.

Anchors are in master-sheet units (`DOLL_PLACE` in `src/gear-render.js`): chest top 93, sleeves 104, gloves 216, belt centre 233, leggings 236, boots bottom 470, helmet bottom 98 (coif 110). The robe (352 tall) and cloak (362) are scaled up because they are drawn small in the sheet. Weapons go in the right hand (the viewer's left) and shields on the left arm.

The female body uses the same anchors, with narrower shoulders, arms, hands and belt (×0.88–0.93) and a smaller head. The pack has no separate female-painted pieces: the same painting is fitted to each body.

## World sprites and caching

- Rig contract: 112×100 cells, anchor (56,86), rows S SW W NW N NE E SE, 29 animations, drawn ×1.22 to match the previous sprites' size.
- The player's animation clip maps to rig actions through `SF.GEAR.fromClip`: walk and run by speed, ready, the attack for the weapon (`SF.GEAR.WEAPON_RIG` covers all 16 weapon ids), cast1h, cast2h or caststaff by what is in the hands. Gathering maps to mine, chopwood or fish, and bandaging to bandage. Death plays the death animation, then the corpse pose. The ghost is the rig with the ghost tint.
- **Cache.** One canvas per appearance × animation × direction, least recently used first out, bounded at 12 Mpx (about 48 MB of canvas; a phone-safe ceiling). A frame spends at most about 4 ms building new strips. The player and corpses are always built at once, so an equip change shows on the next frame. Any other actor whose strip is not ready uses an already-cached strip, or the previous sprite for that frame.
- **Measured** (headless Chrome, software rendering, about 70 humans on screen, direction changes forcing rebuilds): 24.6 ms per update+render with the layered renderer against 15.0 ms with the previous one. the cache held 313 strips (14 Mpx) before the limit was lowered to 12 Mpx; building all 313 took 340 ms in total, about 1.1 ms each.

## Still to do (the art is not finished)

**Gameplay items with no painted piece** (`SF.GEAR.missingArt()`; the doll draws nothing for them, the world rig draws its procedural shape):

- weapons: battleaxe, dagger, glaive (halberd), hatchet, heavycrossbow, knife, kryss, pickaxe;
- shields: buckler (the most common starter shield);
- clothing: cloth_cap, cloth_gloves, shirt, trousers, shoes, tabard;
- neck pieces: leather_gorget, studded_gorget, plate_gorget;
- jewelry: ring, bracelet, necklace.

**Pieces in the pack with no gameplay item** (kept, not mapped, no new items created): chain_sleeves_concept, chain_gloves_concept, kettle_helm_concept, heraldic_shield_concept, cloak and robe colour concepts, studded_boots_concept, fur_boots_concept, plate_boots_concept, studded_belt_concept, belt_heavy_concept, pouch_concept, staff. Chainmail sleeves and gloves do not exist as gameplay items; ringmail fills those slots.

**World art.** The world sprites are still the procedural rig. The painted pieces are static and must not be pasted onto the moving body (the pack's README says so too). Final world art needs a painted pass:

- per slot, per frame, near/far limb overlays for 2 bodies × 8 directions × 29 animations;
- the same anchor and canvas, with primary/secondary/fixed masks.

The rig's side views (W, E) are narrow, a limitation of the prototype body.

**Masks.** Hand-check the automatic masks (straps, studs, cloth trim, heraldry, handles) before final release.

**Review.** Visual sign-off of the doll on both bodies, the world sprites in every direction, crowds and corpses. Turn the flag on by default only after that.

## Files

- `src/gear.js`: `SF.GEAR` (resolve, piece, materials, occlusion, key, snapshot/restore, presets, npcLook, fromClip, missingArt).
- `src/human-rig.js`: `HUMAN_RIG` (frameOps → draw list, drawOps, toSVG).
- `src/equipment-art.js`: generated by `tools/embed_equipment_art.py` from `asset-packs/medieval-equipment-art-v1/Shardfall_Medieval_Equipment_Art_v1.zip`.
- `src/gear-render.js`: flag, recolouring, doll, world strips, poses, corpses, icons; test access at `__GEAR`.
- Hooks: `drawEnt` and `drawCorpse`, `playerDies` / `allyDies` / `killMon` (snapshots), and corpse save/load in `src/game.js`; doll, toggle and icons in `src/equipment-ui.js`.
- Tests: `tests/gear.test.js` (node) and `tests/gear-smoke/run.py` (Chrome; writes the rig contact sheet and doll screenshots).

## Screenshots (from `tests/gear-smoke/run.py`)

- `docs/equipment/shots/paperdoll-male.jpg`, `paperdoll-female.jpg`: starter clothes, then mixed plate (valorite, mithril, spined/golden studs, verite sword, agapite heater), horned leather with a bloodwood bow, studded with stud metals, chain/ringmail with a halberd (off hand hidden), bone and dragon, a robe with a closed mithril helm, and golden great helm with iron plate.
- `world-rig-contact-sheet.jpg`: 18 animations (rows) × 8 directions for the male then the female body (columns), mixed plate set.
- `world-crowd.jpg`: about 70 townsfolk, guards and travellers on the layered rig. `corpse.jpg`: a corpse in its last gear with the ghost beside it. `phone.jpg`: the doll on an 844×390 phone.
