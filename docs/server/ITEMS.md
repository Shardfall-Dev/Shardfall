# Server Items v1 — the online world's items are the server's (alpha)

The fifth server phase, after [Server Combat v1](COMBAT.md). Build **v0.44** (v0.43 is Living World phase 6 step 2, #61).

Online, every character's backpack, worn equipment and bank are held by the server, and every change to them goes through the
game's own validated item commands. Creatures leave remains with their loot, a character who dies leaves a body, dropped items make
piles, weapons and armour wear in fights, and bows spend arrows. A client only names an item by its server id and asks.

## What runs where

| | Server (`server/src/world/items.ts`, `world.ts`) | Client (`src/online.js`) |
| --- | --- | --- |
| Inventory | Each character's items from `game.items`, with the rules' session uid and the persistent id (UUID); changed only by the commands below | Rebuilt from every `inv` message, keeping the same client uid for the same item so the panels stay put |
| Equip / unequip | `SF.EQ.equipItem` / `unequipItem` (slots, two-handed and shield rules, Strength) | The game's own paths (button, double-click, drag, paper doll) end in `owEquip` / `owUnequip` |
| Drop | `SF.EQ.dropItem` (whole or part of a stack, tradeable items only) into a pile at your feet (one pile per spot), 10 minutes | The backpack's Drop |
| Take | `SF.EQ.pickupItem` (`SF.transfer` with the carrying-capacity check) from remains within 2.2 tiles | Tap the remains beside you, then Take / Half / Take all in the game's loot panel |
| Split / merge | `SF.EQ.splitStack`, `mergeStacks`, `mergeAll` inside the backpack | The backpack's split, merge and drag-onto-a-stack |
| Creature remains | Its species' loot table (each entry's range, gear made with a wear state) and purse, rolled by the server; 4 minutes (bosses 10) | The game's remains art and twinkle |
| A character's body | `SF.deathTransaction` away from protected ground (garment and journal stay); 12 minutes; only its owner can take from it | The game's body; "only its owner" when someone else taps it |
| Wear | A hit wears the weapon (25 / durability), a blow the armour piece it struck (0.2), a parry the shield (0.3); at 0 it breaks | "… breaks!" in the log |
| Arrows | Arming with a bow needs its ammunition; stand still 0.5 s to aim; one arrow per release; the shot lands 1 s later if you have not moved and the target is still in range and sight | The bow animation, the arrow in flight, "wide" / "blocked" |
| Others | A changed look is sent to everyone in view | Other players' worn pieces update |

## Saving and safety

- After every command the character's items are saved **at once**: one transaction replaces the character's rows with exactly
  what the world holds (`Characters.saveInventory`). Wear and spent arrows are saved with the next periodic save (30 s), on
  leaving and on shutdown.
- All item saves in the server run in **one queue, in the order the changes happened**, with the rows taken at the moment of
  the change. An item that passes from one character to another (an owner looting their body back, a pile picked up) is
  therefore always written to its latest holder last, and a row moves by its id (`on conflict (id)`) rather than being copied.
- Identities: every item has a persistent id; a split-off stack, a death garment or loot gets a fresh one; any duplicate id is
  replaced before saving. Units are conserved by the shared rules' audited transfers (tested).
- After every (re)join the server sends the live inventory, because the welcome's snapshot comes from the database and can
  trail memory by up to one periodic save.
- **Not saved:** remains, piles and their contents (the ground). A server restart clears the ground, as creatures repopulate.
  Items in your backpack, worn and in the bank are always saved.

## Protocol v5

| Client → server | |
| --- | --- |
| `item { op: 'equip', item, slot? }` · `{ op: 'unequip', slot }` · `{ op: 'drop', item, qty? }` | your items |
| `item { op: 'take', from, item, qty? }` · `{ op: 'takeall', from }` | from remains (`from` is their nid) |
| `item { op: 'split', item, qty }` · `{ op: 'merge', item, into }` · `{ op: 'mergeall' }` | inside the backpack |

`item` and `into` are server ids (UUIDs); nothing else is accepted (no uids, owners, gold or quantities beyond the stack). A
refusal comes back as `combat { k: 'refused', what: 'item', reason }` with the request id.

| Server → client | |
| --- | --- |
| `inv { pack, equip, bank }` | your inventory (bank: how many stacks) after every change and after joining |
| `actor.enter { kind: 'remains', nid, x, y, name, mon, pile, owner, ownerName, left, items }` | remains in view |
| `remains { nid, items }` | their new contents |
| `combat { k: 'look', t, equip }` · `{ k: 'broke', item, itemDef }` · `{ k: 'shot' \| 'wide' \| 'blocked', a, t }` | a changed look, a broken piece, arrows |

## Not online yet

Banks (the bank is held and saved, but there is no banker online), shops and vendors, crafting and repairing, using items
(bandages, potions, food), skinning remains, treasure maps and magic loot from bosses, trading between players, and looting
another character's body (there is no criminal system online, so it is not possible rather than a crime).

## Tests

- **Unit** (`tests/server/unit/items.test.ts`, 12 tests): protocol v5 shapes; identities and saved rows; equip / unequip with
  the inventory, the immediate save and the look for others; drop into one pile per spot, viewers' updates, reach, take-all
  conserving every unit, emptied piles, untradeable items; split and merge, the weight limit on taking; a creature killed online
  leaving remains from its loot table for its killer; `rollLoot` against the tables; a death body with the tradeable
  belongings, ghosts and others refused, the owner taking everything back; death on protected ground; decay times; wear and
  breaking; arrows (needed to arm, one per release, landing a second later, standing down when spent).
- **Integration** (`tests/server/items.test.ts`, the real gateway and database): the live inventory after the welcome; equip and
  unequip saved at once; a drop seen by another character and taken by them — one row, moved to the finder, never twice;
  forged messages (someone else's item, unknown ids, bad shapes) refused and the other character's rows untouched.
- **Client, live**: the built game against the real server `World` (a test harness with a minimal WebSocket), desktop and phone:
  drop through the backpack action, the pile appearing, opening it and Take all with the real button, unequip / equip through
  the game's own equip paths, killing a bandit with Space, its remains with loot, looting it with the gold matching the server,
  B opening the backpack, no page errors. Screenshots: [shots-items/](shots-items/).

## Next

Banks, vendors and the economy online (buying and selling against server prices, gold as server items) — done in v0.45,
[ECONOMY.md](ECONOMY.md) — then crafting and gathering on the server, then magic.
