# Equipment, paper doll, inventory and armor — status (v0.25)

Spec: *Shardfall — Equipment, Paper Doll, Inventory & Armor System v1.0*. Rules in `src/equipment.js` (`SF.EQ`, no DOM, tested in node);
UI in `src/equipment-ui.js`; integration in `src/game.js`. All numbers are tuning data in `SF.EQ` / `SF.CARRY` / `SF.REPAIR`.

## Model

- **Definitions vs instances.** `SF.ITEMS[id]` is the template (family, slot, weight, Strength, Dexterity, meditation, base value,
  appearance). An instance is `{ uid, id, qty, material, sec, quality, cond, maxc, omax, kgMul, creatorId, creatorName, origin }`.
  One definition serves every material: `plate_chest` + `mithril` is a Mithril plate chest.
- **One canonical record.** An item lives in exactly one place: a container's `items` or one `equip` slot. `SF.EQ.audit` checks
  that every uid is unique across pack, bank, equipment and given containers; every command runs it before committing.
- **Commands** (`SF.EQ.*`): `equipItem`, `unequipItem`, `moveItem`, `dropItem`, `pickupItem`, `splitStack`, `mergeStacks`,
  `craftItem`, `repairItem`. Each takes plain arguments and returns `{ ok, reason, … }`. `EQ.tx` snapshots pack and equipment and
  restores the same objects and quantities on any failure or exception. UI code calls these, never the arrays.

## Slots

`head neck chest arms hands legs feet` (armor) · `weapon` = main hand, `shield` = off hand · `cloak ring bracelet necklace belt`
(accessories) · `shirt trousers robe tunic` (clothing layers). The old keys `weapon` / `shield` were kept; `armor` is gone.
Reserved, not shown: `mount quiver hair beard cosmetic` (`EQ.FUTURE_SLOTS`).

Two-handed weapons (halberd, battle axe, war hammer, hatchet, spear, bows, crossbows) take both hands: equipping one sends the
shield to the pack, equipping a shield sends the two-hander to the pack. The off-hand slot shows the occupancy.

## Armor

| Family | Skill | Full-suit AR | Meditation (full suit) | Pieces |
|---|---|---|---|---|
| Cloth | Tailoring | 2 | 0 | cap, shirt, trousers, robe, cloak, gloves, tabard |
| Leather | Tailoring | 12 | 0 | cap, gorget, tunic, sleeves, gloves, leggings (+ boots, shoes, belt) |
| Studded leather | Tailoring | 16 | 10 % | gorget, tunic, sleeves, gloves, leggings |
| Bone | Tailoring | 22 | 15 % | helmet, chest, arms, gloves, leggings |
| Ringmail | Blacksmithing | 20 | 15 % | tunic, sleeves, gloves, leggings |
| Chainmail | Blacksmithing | 23 | 20 % | coif, tunic, leggings |
| Platemail | Blacksmithing | 30 | 35 % | gorget, chest, arms, gauntlets, leggings |
| Helmets | Blacksmithing | 18–32 (each) | 2–6 % (each) | bascinet, open, norse, closed, plate, great helm |
| Dragon scale | Blacksmithing | 35 | 25 % | helm, chest, arms, gloves, leggings (no vendor, no source yet) |
| Shields | Carpentry / Blacksmithing | AR 7–18 | 0 | buckler, wooden, metal, kite, heater |

- **Coverage.** A blow lands on one region: torso 40 %, legs 20 %, arms 15 %, head 15 %, hands 7 %, neck 3 % (`EQ.REGIONS`).
  The region's AR is the strongest worn piece over it (layers never add: a shirt under plate adds nothing). Unprotected regions
  take the blow bare. A piece's **protection** (tooltip) is region AR × its coverage; the doll's **Armor rating** is
  Σ region share × region AR — a summary of what a blow expects, not a second reduction.
- **Combat.** `applyBlow` picks the region, then the existing `SF.mitigate` (shield parry → armor absorbs 50–100 % of AR → player
  halving) runs once. The struck piece takes the wear (0.2 per blow; maces half the absorbed amount). No second damage system.
- **Materials.** Metals reuse `SF.METAL` (ores, ingots, smelting, mining and smithing gates); armor multipliers are
  `EQ.METAL_ARMOR` (spec §8 table). **Mithril** was added as the tenth metal: mine/smelt 100, smith 98, rare in grade-3 regions.
  A Mithril plate chest weighs 6.3 (iron 14 × 0.45) and keeps the platemail meditation penalty. Hides: regular, thick, wolf,
  spined, horned, troll, barbed, dragon (`EQ.HIDES`: weight, protection, durability, value, Tailoring gate, colour, future
  resistance). Studded pieces store the hide as `material` and the stud metal (rivets) as `sec`.
- **Quality.** Normal ×1; exceptional ×1.08 protection, ×1.10 durability, ×1.5 value, crafter shown; poor ×0.92 / ×0.85.
- **Durability.** Base 25 (cloth) – 60 (dragon) × material × quality. Under 20 %: −15 % and a warning; at 0: no protection, flagged
  on the doll, never destroyed. Repairs: Blacksmithing (metal), Tailoring (cloth, leather, studded, bone), Carpentry (wood).
  Each repair risks 3 % of the original maximum: `SF.repairRisk(skill)` = 1.2 − skill/100, between 20 % and 100 %.

## Weight and capacity

Items keep their authored mass; the game shows **weight units** (`SF.WU` = 2.5 per kg; armor pieces are authored in weight
units). Capacity = 40 + 3.5 × Strength (75 / 127.5 / 215 / 302.5 / 390 at 10 / 25 / 50 / 75 / 100). Total = backpack (nested
containers included) + everything worn; moving gear between them never changes it. No slot limit.

| Load | Effect |
|---|---|
| ≤ 75 % | normal |
| 75–100 % | sprinting costs 1.5× stamina |
| 100–125 % | speed ×0.6, no running |
| > 125 % | cannot move until something is dropped |

Pickups and purchases that would pass 100 % are refused. Strength loss, quest rewards or harvest can overload a character; nothing
is ever destroyed (a full harvest still drops to the ground as before) and dropping always works.

## Effective attributes

`EQ.effective(ch)` derives Strength, Dexterity (base + piece modifiers), Intelligence, meditation interference, movement slowdown
and AR from base values and what is worn. Only the transient `ch.eqDex` is written (stamina cap); it is recomputed on every HUD
refresh and never saved, so loading cannot stack it.

## UI

- **Paper doll** (C, Menu → Equip, Character → Paper doll): draggable, closable, position and open state remembered; character art
  in the middle, 18 slots with icons, durability bars and empty silhouettes, a slot card on tap, statistics at the bottom.
  On narrow screens the backpack moves beside it.
- **Interaction:** drag between backpack and slots (mouse: press and move; touch: hold 0.4 s, then move), drop on the figure to
  auto-slot, double-click / double-tap to equip or remove, right-click or long-press for a menu (equip, remove, split, merge,
  repair, drop). Invalid slots and Strength requirements are refused with a message.
- **Backpack:** search, sort (category, name, quantity, weight, material, quality, value), filters, split and merge, encumbrance
  bar. Above 240 stacks only the rows near the scroll position are in the page (tested with 600+).
- **Tooltips:** one builder for backpack, doll, crafting result, vendor, loot and bank rows (hover on desktop, tap on touch), with
  a comparison against the worn piece (green better, red worse; less weight counts as better).
- **Crafting:** an **Armor** category with sub-families at the bench (cloth, leather, studded, bone, wooden shield) and the anvil
  (ringmail, chainmail, platemail, helmets, shields, dragon scale, accessories). Material picker (and stud metal), skill gates,
  success and exceptional odds, resulting weight, expected protection, durability, requirements.

## Persistence, appearance, death

- Save v7. `migrateV7` converts the v0.24 one-slot suits — worn, in the pack, bank, ally and corpses — into pieces (plate → gorget,
  chest, arms, gauntlets, leggings; chain → coif, tunic, leggings; leather → six pieces; cloth gambeson → shirt + trousers),
  keeping material, quality, crafter and the worn fraction; the chest piece keeps the suit's uid. A snapshot is kept once in
  `shardfall.save.v1.prev6`. Idempotent (`eqMig`).
- Appearance: every definition carries `look` (asset id, render layer, tint, bodies, 8 directions, animations). `EQ.appearance(ch)`
  returns ordered layers; a change emits `AppearanceChanged` to the world event log and a `sf:appearance` DOM event. The world sprite
  does not change in V1.
- Death: `SF.deathTransaction` moves the real instances into the corpse (material, durability, quality, crafter, uid kept). A
  future `blessed` flag keeps an item; nothing is blessed by default. No new item-loss rule was added.

## Sources of items

Vendors sell iron / regular pieces only (smith: ringmail, chainmail, platemail, helmets, metal shields; tailor and provisioner:
cloth and leather). Skinning yields thick (boar, snapper), wolf (dire wolf), spined (lizardman), horned (ettin), troll and barbed
(gargoyle) hides and bones; skeletons and the Lich Lord drop bones. Dragon hide and scales have no source yet.

## Approximations and known limits

- Weapons keep the crafting guide's metal mass/durability (`SF.METAL.mass/dur`); armor uses the spec's table (`EQ.METAL_ARMOR`).
  Golden is heavier for armor (1.30) but lighter for weapons (0.80).
- Feet, cloak, belt and jewelry cover no hit region; accessories have no statistics in V1.
- Effective Dexterity changes the stamina cap only; Dexterity-based hit or swing formulas are untouched.
- Material tint on painted icons is a colour chip, not a recolour. 67 icons are missing: `assets/equipment-icons/missing-icons.json`.
- Creature AR and creature damage are unchanged; armor values fell (plate 40 → 30, chain 28 → 23, leather 13 → 12 per region), so
  a fully armored player takes somewhat more damage than in v0.24.
