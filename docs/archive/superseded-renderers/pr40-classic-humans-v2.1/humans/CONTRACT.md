# Human atlas contract v1.0 (layered human sprites)

Implemented by `src/compositor.js` (`SF.HUMANART`). Applies to every human: the player, Wren, townsfolk, guards and human mobs.
Creatures are not part of it and keep their own sheets.

This is the contract painted art must meet to drop in. The registry is data; when a new layer is registered (by
`tools/install_human_art.py` or its successor) it is drawn, tinted and ordered automatically. Nothing in the code is specific to one
piece of art.

## Frame, anchor, directions, bodies, actions

- **Shared canvas:** 96 × 92 px, ground anchor **(48, 86)**. Every layer entry carries its own cell size and anchor `(ax, ay)` and
  is placed so its anchor lands on the canvas anchor. All layers of one frame share body type, action, direction and frame index.
- **Directions** (screen-facing, the game's sector order): `S SW W NW N NE E SE`.
- **Bodies:** `male`, `female`.
- **Actions** (the animation contract, from the rig): `idle walk run ready unarmed slash1h slash2h chop1h chop2h blunt1h blunt2h
  thrust1h thrust2h polearm staff bow crossbow cast1h cast2h caststaff block hit death corpse mine chopwood smith bandage fish`.
  The painted v2 `cast` rows serve `cast1h`.
- **Animation priority** (visual only, from simulation state): death > hit > attack / cast / tool > ready > walk / run > idle.
  Combat timing, cast times and hits remain authoritative in the simulation; frames follow them.

## Layers

Back to front for a figure facing the viewer:

`cloak_back · main_far · off_far · hair_back · body · under · legs · feet · torso · neck · arms · hands · outer · belt · beard · hair_front · head · cloak_front · main · off`

- **Equipment slots map through the existing `EQ.SLOT_LAYER`:** shirt/trousers → under, legs, feet, chest → torso, arms, hands,
  robe/tabard → outer, head, cloak, weapon → main, shield → off. Neck and belt get their own layers. Jewelry has no layer yet.
  `validate()` fails if `EQ.RENDER_LAYERS` or any slot loses its mapping.
- **Per-direction order** (`order(dir)`):
  - Seen from behind (N, NE, NW), the cloak moves to `cloak_front` and the back hair is drawn over the torso.
  - Each hand is near or far by direction: the main hand is near for S, SE, E, NE and far for SW, W, NW, N; the off hand is the
    mirror. A far hand's weapon or shield is drawn behind the body.
- **Occlusion:**
  - Full helms (closed, plate, great, bone, dragon) hide `hair_front`, `hair_back` and `beard`.
  - Open helms and caps hide `hair_front`.
  - A hood hides both hair layers.
  - A two-handed weapon (`EQ.twoHanded`) never shows a shield (the wardrobe resolver drops it).
- **Hand sockets:** an entry may carry `socket: [[x, y] per frame]`, the grip point for weapons and the projectile origin. No painted
  sockets exist yet.

## Registry entry

```
{ layer, key, body, action, dir, atlas, x, y, w, h, ax, ay, frames, mask?: { atlas, x, y }, socket?, baked?, style }
```

- **`key`:**
  - `'body'` for bodies.
  - The real **item id** for equipment (`plate_chest`, `leather_gloves`, `sword`) — one entry per piece, never a suit.
  - `hair:<style>` / `beard:<style>` for hair.
- **`frames`:** consecutive cells to the right of `(x, y)`.
- **`mask`:** the same cells in a mask atlas. R = primary material weight, G = secondary (studs, trims), B = fixed (never tinted),
  A = coverage.
  - Tinting is luminance-preserving per channel. Colours come from the item instance: `EQ.matColor(SF.matOf(item))`, `item.sec`,
    or a cloth dye from the wardrobe. It is never a whole-sprite recolour; a dye never touches metal.
- **`baked`:** apparel painted into a body. The v2.1 painted bodies bake hair, shirt, trousers, feet and belt. Undyed basic clothes
  are therefore covered by the body, and everything else is reported missing.

## Fallbacks while art is missing (approved, never procedural)

- **walk / run:** the painted standing frame with the classic step bob (what the old atlas did).
- **Weapon attacks:** the painted standing frame with the existing strike lunge.
- **cast2h / caststaff:** painted cast if present, otherwise standing.
- **hit, block, tools:** standing.
- **death / corpse:** the previous corpse drawing is kept.
- **Ghosts:** the painted figure in the existing ghost colours.

The procedural rig (`src/humanrig.js`, `?humans=rig`) is for animation-contract development only and is never mixed with painted art.

## Paper doll and character creator

Both read the same appearance state (`look` plus `actor.equip` through `SF.WARDROBE.resolve`). Two interim measures:

- No portrait-specific paperdoll art exists yet (`docs/handoffs/paperdoll-v1.md`, 384×512), so the doll shows the painted
  front-facing frame at an exact 2×.
- The creator shows only the options that have registered art (`availability()`); the rest are listed as pending.
