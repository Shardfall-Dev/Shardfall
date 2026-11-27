# Classic paperdoll v1.0 — status (Shardfall v0.31)

Spec: `docs/handoffs/paperdoll-v1.md`. This file records what v0.31 built, what it deliberately did not, and the exact art
still missing. The short version: **the paperdoll is a real layered compositor fed by one shared appearance record, and every
layer it draws today is original procedural art made in code. No painted production layer exists yet.**

## What is in

### One appearance record — `SF.LOOK` (`src/appearance.js`, pure, tested in node)

- `SF.LOOK.resolve(actor, opts)` reads only `actor.look` (Character Creation v2 ids) and `actor.equip` (the 18 `EQ.SLOTS`) and
  returns a plain descriptor: body, skin, hair, beard, clothing colour, cloak, and one entry per worn item with its exact item
  id, slot, visual key, primary material (`SF.matOf` → `EQ.matColor`, or the definition's `fixedMat`), secondary material (studs,
  `it.sec`), quality, broken flag and visibility. It never writes to the actor, never invents an item and never uses an item UID.
- `descriptor.key` is the cache key: the art revision (`SF.LOOK.REV`) plus every visual field. Two different items with the
  same id and material give the same key; a piece breaking, a stud metal, a hide or a look change gives a new one.
  `EQ.signature` (UID-based, used by game logic) is unchanged; the appearance hook in `eqTick` now fires on the visual key.
- Visibility rules: a two-handed weapon hides a shield left over from an old save (the rules already refuse to equip both);
  helmets hide hair and beards by design (`SF.LOOK.OCCLUDE`: caps and open helms leave hair below the brim, the coif leaves only
  a mustache, the five closed helms hide both); a ghost shows only the death robe; female looks never resolve a beard.
- **Who uses it:** the equipment window, the creator portrait (with the draft's starter kit as `opts.preview`, plain `{ id }`
  records that are never made, numbered or saved), the world sprite (`SF.LOOK.worldLook`: skin and cloak, the only two things the
  current traveller sheets can show; a worn cloak item now recolours the world cloak), human NPCs (`SF.LOOK.npcLook` /
  `SF.LOOK.forNpc`: a stable look per NPC id or name, role colour kept as the cloak, nothing added to saved entities) and the
  player's corpse (`look` on the corpse entity: the last worn appearance in wire form; visual only, the loot is the container).
- **Multiplayer:** `SF.LOOK.wire(actor)` is the compact form a server would send (the look ids and, per worn item, slot, id,
  material, studs, broken — about 200 bytes); `SF.LOOK.fromWire()` rebuilds an actor-shaped record that resolves to the identical
  descriptor. A client never needs its own copy of anyone's appearance state.

### The compositor — `PDOLL` (`src/paperdoll.js`, browser)

- Canvas contract: 384 × 512 RGBA, feet on y 496, drawn at 192 × 256 logical pixels and shown ×2 nearest-neighbour. Both bodies
  share the anchors in `SF.LOOK.ANCHORS` (head, shoulders, elbows, wrists, hands, hips, knees, ankles).
- Layer order (`SF.LOOK.ORDER`): cloak back, hair back, body, face, under-clothing, legs, footwear, torso, neck, arms, hands, outer
  robe/tabard, belt, jewellery, beard, hair front, headgear, cloak front, off hand, main hand; then the main-hand fingers are drawn
  again over the grip so weapons sit in the fist.
- **Material channels, not hue filters.** Each layer paints grey shading into channels — `p` (the item's material), `s` (studs),
  and fixed channels for parts that are not the item's material (wooden haft, leather grip, bow string, iron shield fittings,
  brass buckles and clasps, gems). Each channel is mapped onto a colour ramp built from the material's real colour
  (`SF.LOOK.ramp`: metals get seven steps with a specular top, hides, woods and cloth six matte steps). Iron, valorite and mithril
  plate are one drawing in three metals; studded leather tints its hide and its studs independently; bows, wooden shields and
  the buckler use their own wood.
- Every one of the 73 wearable item ids has its own drawing: 7 cloth, 9 leather, 5 studded, 5 bone, 4 ringmail, 3 chain, 5 plate,
  6 metal helmets, 5 dragon scale, the respawn robe, 5 shields, 3 jewellery pieces and 15 weapons and tools (every
  `SF.WEAPONS` profile that an item carries). Helmets, shields and weapons follow their in-world silhouettes (great helm's flat top
  and cross slits, the norse nasal, kite vs heater, glaive hook and spike, war hammer beak, double-bit battle axe, wavy kryss).
- Outlines: a 1 px inner outline per layer in each pixel's own darkened tone, and a dark silhouette line around the figure.
- Results are cached by descriptor key (least recently used, 32 figures); a figure composes in about 15–40 ms and is never drawn
  in the render loop.
- **Missing art:** an item with no visual (or one the painter cannot draw) stays in its real slot and is named under the figure
  ("No paperdoll art yet: …"). Nothing visually different is drawn in its place.

### The window (`src/equipment-ui.js`, `src/head.html`)

- The static `SCOUT_SRC` doll is gone from the window (the world sprite still uses those sheets as its documented fallback).
- Dark leather and wood frame with restrained bronze edges; name and skill title; AR and carried weight; full-body figure in the
  middle; square slots in the existing `EQ_LEFT` / `EQ_RIGHT` / `EQ_BOTTOM` places; a 40 px close button. Desktop: draggable as
  before. Phones (landscape and portrait): the whole figure, 3:4, fits with the slots; stats scroll inside the window.
- Unchanged: all 18 slots, drag and drop, double-click, right-click / long-press menu, tooltips and comparison, durability
  bars, the two-handed marker, equipment validation and every rule behind it.

## What is not in (and why)

- **Painted production layers.** None exist. The handoff's reference portraits (`Shardfall_Paperdoll_Art_v1.zip`) are not in the
  repository and were not available to this integration; they would be flattened references in any case, not layers.
  Every layer in `assets/character/paperdoll-v1/manifest.json` is marked `"source": "procedural"`.
- **Gear on the world sprite.** The world sprite is still the male hooded traveller, recoloured for skin and cloak. Female,
  unhooded, hair, beard, clothing and armour sprite layers are listed in `assets/character/missing-character-art.json`.
- **Clothing dye.** There is no dye field on items. The creator's "shirt colour" is applied to the shirt (that is what the
  creator offers); every other cloth piece shows its material colour. No dye field was invented.
- **Animation on the paperdoll.** One standing three-quarter-front pose; one-handed and two-handed weapons share it (long weapons
  are held planted at the side, bows upright).

## Validation

- `node tests/paperdoll.test.js Shardfall_v0.31.html` — coverage of every wearable and weapon, unique visual keys, the layer
  manifest in sync with the live registry (`node tools/paperdoll_manifest.js Shardfall_v0.31.html --check`), any layer marked
  painted verified as a real 384 × 512 RGBA PNG per body, the missing-art manifest (the seven v0.30 entries kept, every
  procedural layer accounted for, nothing marked done without verified files, unresolved entries listed), materials, studs,
  woods, two-handed, helmets, beards, keys, refused and successful equips, ghost and corpse, unknown items, wire round trip,
  world and NPC looks.
- `python3 tests/paperdoll-smoke/run.py Shardfall_v0.31.html` — the creator portrait (every hairstyle of both bodies, beards,
  skin; no items made), the window (descriptor key = figure key; equip by double-click and drag, remove, mixed armour,
  two-handed change, tooltips, missing-art note, save and reload, cache bound and speed, ghost, corpse), the compositor (every
  wearable changes the figure, metals share a silhouette, studs recolour alone, woods), NPCs, and two phone sizes. Screenshot
  galleries: bodies, hair and skin; beards; the ten metals on one suit; studded hides and studs; woods; all weapons; armour
  families, helmets and shields; NPCs.

## Missing art (exact)

From `assets/character/missing-character-art.json` v1.1.0 — all unresolved:

| Entry | Layers |
|---|---|
| `body_female`, `body_base_unhooded`, `layer_cloak`, `layer_hair`, `layer_facial_hair`, `layer_clothing`, `paperdoll_body` | the v0.30 world-sprite and portrait entries, unchanged |
| `paperdoll_painted_body` | `body.male`, `body.female`, `face.male`, `face.female` |
| `paperdoll_painted_hair` | 12: six styles per body (bald needs none) |
| `paperdoll_painted_beards` | 5: mustache, goatee, short, long, vandyke |
| `paperdoll_painted_cloak` | `cloak.look` (back and front parts) |
| `paperdoll_painted_gear` | 58: every worn piece, shield and jewellery id |
| `paperdoll_painted_weapons` | 15: every weapon and tool id |

## Replacing a procedural layer with painted art

1. Paint on the 384 × 512 canvas with the manifest anchors for that body (feet on 496). Grey shading only on tinted parts, with
   separate mask PNGs per channel if the piece has more than one (primary, secondary, fixed), alpha and outlines preserved.
2. Commit the PNGs under a new versioned folder (for example `assets/character/paperdoll-v1.1/`), set the layer's
   `source` to `painted` and `files` to `{ "male": …, "female": … }`, and bump `SF.LOOK.REV` so cached figures are redrawn.
3. Teach `src/paperdoll.js` to draw that layer id from its PNG channels instead of code (same order, same ramps).
4. `tests/paperdoll.test.js` then checks the files exist and are RGBA at the canvas size; mark the missing-art entry done only
   when all of its layers are painted.
