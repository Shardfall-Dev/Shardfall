# Layered Armor Rendering v1.0 — implementation status (v0.31)

Source pack: `asset-packs/layered-armor-v1/` (procedural prototype on the `classic-humans-v2` rig: 112×100 cell, anchor 56,86,
8 directions, 29 animations). Branch `feature/layered-armor-v1`, cut from `main` (f6891d6).

## What is in

- **`src/human-rig.js` — `SF.HRIG` (pure, node-tested).** The pack's rig and armor painter, adapted to the game:
  - `resolveGear(equip)` reads the real item instances: `SF.ITEMS[id].fam` / `.slot`, the item's own material (`fixedMat`, else
    `SF.matOf`), the studded secondary metal (`it.sec`) and the broken flag. Colours come from `SF.EQ.matColor` only — the
    pack's palette snapshot is not used. Unknown ids are reported, never guessed.
  - `weaponOf(item)` maps all 16 `SF.WEAPONS` ids to an attack animation and a drawn shape; the two-handed flag comes from
    `SF.WEAPONS[id].two`.
  - `frameOps(o)` builds one frame as a compact draw list; `drawOps` paints it on a 2D canvas (the game), `frameSVG` /
    `stripSVG` turn it into SVG (tests, contact sheets, atlas export). Every limb segment carries its slot's armor and is
    depth-sorted for the direction and pose: legs, arms (near/far by facing), torso with chest, robe, tabard, gorget,
    necklace and belt, head with hair and helmet, cloak (behind facing south, over the back facing north), weapon, shield.
  - Each piece keeps its own palette: dark outlines, joint lines, directional highlights, trims and straps are separate
    colours; there is no whole-sprite recolour. Studs use the stud metal, not the leather tint. Broken pieces darken.
  - Helmets that cover the head (coif, closed, plate, great, bone, dragon) hide hair and face; caps, bascinet, open and norse
    helms keep the hair. Two-handed weapons never show a shield in any animation; the shield is visual only.
- **`src/human-render.js` — game glue.** One renderer for the player, Wren, townsfolk, guards, merchants, the travelling
  merchant and the human enemies (brine smuggler, road bandit, drowned captain). Monsters keep their sheets.
  - Player and ally: drawn from their real `equip`. Everyone without an inventory gets a cosmetic preset by role/profession
    (guards in plate with a halberd, healers and scholars in robes, bankers in tabards, outlaws in leather, smugglers in
    studded leather with dull-copper studs, the captain in shadow-iron chain…). Presets are appearance only and never enter
    a pack, loot table or save.
  - Character Creation v2 looks (`body`, `skinTone`, `hairStyle`, `hairColor`, `facialHairStyle`, `clothingColor`) are read
    through `SF.CREATION` when that module is present; without it the player is a default male figure. Townsfolk bodies
    follow their names (a fixed list of the game's female names; there is no gender field on NPCs yet).
  - Animation from simulation timestamps only: attack (the swing's `lunge`), hit (`hitT`), walk/run (speed, sprint),
    casting (`P.prep` / `P.held`, staff or one/two-hand gesture by circle), mining, woodcutting, fishing, smithing, skinning,
    bandaging, ready, idle; death and corpse on bodies.
  - **Cache:** one strip = one look × one animation × one direction (columns = frames), drawn with Canvas 2D in ~3 ms off the
    render loop by a small `setTimeout` job queue (≤4 ms per tick), alpha-snapped to hard pixel edges, kept in an LRU bounded
    by pixels (14 MP desktop, 8 MP on phones / ≤4 GB devices). Identical looks share strips; townsfolk use one of four faces
    per role and body so crowds share. Jobs nobody has asked for in 20 frames are dropped. Until a strip exists the actor
    keeps its previous strip (or the legacy sprite on first sight). Nothing is generated inside `render()`.
  - **Equip/unequip:** the look is recomputed from `SF.EQ.signature` (item uids + broken flags), so it changes only after
    the validated command succeeded; `eqChanged()` prewarms idle and walk in all eight directions.
  - **Corpses:** player, ally and human-enemy bodies snapshot the worn look at death (before the death transaction moves
    the gear) and play the death fall, then lie as a corpse. A body restored from a save is drawn from the wearables lying
    in it. The loot container is untouched.
  - **Paper doll:** the doll figure is the same resolved equipment, facing the viewer (`hrDollURL`), refreshed on change.
  - **Legacy renderer:** `?renderer=legacy` (remembered in `localStorage['shardfall.renderer']`); `?renderer=layered`
    switches back. Ghosts still use the legacy ghost sprite.

## Not changed

Item statistics, AR, weight, Strength/Dexterity requirements, durability, meditation, movement, crafting, loot, mithril
balance, save format (no new persisted fields), combat timing, monster sprites.

## Tests

- `node tests/layered-armor.test.js Shardfall_v0.31.html` — 82 checks: no item statistic changes; all 73 equipment, clothing, accessory, shield and weapon
  definitions drawable; every family; ten metals with `matColor`; all hides and woods; dragon scale and bone; independent
  studs; mixed set palettes keep skin and outlines; 2 bodies × 8 directions × 29 animations (3,376 frames) valid; halberd
  inside the cell; hair rules for 11 helmets; no shield with any two-hander in any animation; arms follow the swing; cloak
  order by facing; shared keys.
- `python3 tests/layered-smoke/run.py Shardfall_v0.31.html` — in the game: player/ally/townsfolk on one renderer, paper doll
  figure, refused equip does not change the look, mixed valorite/barbed/horned+golden-stud set, doll redraw, glaive displaces
  the shield, unequip, attack/hit/walk states, smuggler draws layered and leaves an armored body, rats untouched, player
  body keeps valorite plate, body after reload, save/load keeps the look, 120 armored NPCs turning and walking, budget,
  legacy flag both ways, phone landscape.
- `python3 tests/layered-smoke/sheets.py Shardfall_v0.31.html OUTDIR` — contact sheets for visual QA (families × bodies ×
  directions, ten metals, helmets, mixed sets, every animation, frame-by-frame cycles).

## Performance (headless Chrome, software GL, 1100×680)

| Scene | avg frame | p95 | strips | cache |
|---|---|---|---|---|
| legacy, 120 extra NPCs | 16.6 ms | 16.8 ms | — | — |
| layered, 120 NPCs standing | 16.6 ms | 16.8 ms | 86 | 3.9 MP |
| layered, 120 NPCs turning every 7 frames and walking | 16.7 ms | 16.8 ms | ~200 | 14 MP (cap) |

Strip build: 2.9 ms average, 10–15 ms worst (Canvas 2D). The first SVG-decoding version cost ~24 ms per strip and dropped
the stress scene to 45 ms frames; it was replaced by direct canvas drawing.

## Known visual issues (for the painted pass)

- Procedural shapes, not hand-painted UO pixels; the female body differs only in width and hair.
- East/west views are very narrow (the rig's side projection); weapons read better than bodies there.
- Corpses lie along the facing axis, so some directions look crouched rather than flat.
- Robe and cloak occlusion is a single plane: robes over a chest piece hide its sides only from the front; cloaks over
  shields in north views need a look.
- Jewelry is a few pixels (ring, bracelet, necklace); belts are a line.
- Townsfolk gender comes from a name list; NPCs have no gender field.
- Cloth items share the single `cloth` material colour; dye is a future channel and is not invented here.
- Ghosts keep the legacy ghost sprite.

## Future painted atlases

The renderer only needs, per look × animation × direction, a strip of 112×100 cells on the shared anchor. Painted per-slot
atlases with material masks can replace `drawStrip` (compose the slot layers in the same depth order, tint the primary and
secondary masks with `SF.EQ.matColor`) without touching the cache, the actor state machine, corpses or the paper doll.
