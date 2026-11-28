# Server Economy v1 — banks and shops online, on the server (alpha)

The sixth server phase, after [Server Items v1](ITEMS.md). Build **v0.45**.

Online, the offline game's bankers and shopkeepers keep their posts, and every purchase, sale, deposit and withdrawal is decided
by the server with the game's own counter rules and price list. A client never sends a price or an amount of gold: it names what
it wants (a kind of item from the shop's stock, or one of its own items by server id) and the keeper it stands beside.

## What runs where

| | Server (`server/src/world/economy.ts`, `world.ts`) | Client (`src/online.js`) |
| --- | --- | --- |
| Keepers | The 24 bankers and shopkeepers of the build at the posts they keep (`server/data/economy.json`); bodies in the interest grid, one set per realm, announced with `actor.enter` kind `npc` | Drawn like the offline townsfolk, with their name |
| Opening | Within 4 tiles (+0.5 for latency), alive, the keeper in your realm (`game.js atCounter`) | Tap a keeper beside you; the game's own bank or shop panel opens |
| Buy | Only that shop's stock (`SHOPS`), a whole quantity up to 100, one at a time for anything that does not stack; price `SF.PRICES × quantity` from the gold in your backpack; the goods must fit your carrying capacity (`SF.addItem` with `SF.EQ.capFor`); gear made with `SF.EQ.make` | Buy / ×10 in the shop panel |
| Sell | Any tradeable backpack item except gold and starter gear, to any shop, at 40 % of its price (a work tool by its uses left), at least 1 gold each (`game.js ACT.sell`) | Sell 1 / All in the shop panel |
| Bank | One account at every bank: deposit a backpack item, all gold, or a worn piece (unequipped first); withdraw within your carrying capacity (`SF.transfer`) | The bank panel's Deposit, Deposit all gold, Withdraw |
| After a change | The inventory is saved at once (Server Items v1), the new inventory and the redrawn counter are sent, others see a changed look, the transaction is logged | The panel redraws from the server's answer |
| Walking away | Every command re-checks the reach | The panel closes beyond the reach |

Gold is an item like any other (id `gold`, a server id, a saved row). Buying removes units from your stacks; selling adds a new
stack; the bank moves stacks. Only buying and selling change how much gold exists, by exactly the posted prices (tested).

## The counters come from the build

`tools/export-world.py` loads the built game and exports `server/data/economy.json` (`src/online.js onEconomySource`):

- **posts** — every NPC whose role keeps a bank (`banker`, `campbank`) or a shop (a role in `SHOPS`), at its home: the Quay
  (Odile, Gus, Harl, Pell, Sorrel), the camp strongbox and the fence, Mynoc, Vespar, Skara Bryn (with the ranger captain) and
  Moonglen. The travelling merchant has no post and stays offline-only for now.
- **shops** — what each kind of shop sells, after every addition the game makes (`ANN_SHOPS`, the tinker and outlaw extras).
- **prices** — the build's `SF.PRICES`. The unit test checks that the server's rules price every item exactly the same.

`--check` fails when the build's counters, stock or prices differ from the committed file, as for the world and the creatures.

## Protocol v6

| Client → server | |
| --- | --- |
| `counter { op: 'open', at }` | open the counter of the keeper `at` (its nid) |
| `counter { op: 'buy', at, itemDef, qty? }` | buy from that shop's stock |
| `counter { op: 'sell', at, item, qty? }` | sell one of your backpack items (server id) |
| `counter { op: 'deposit', at, item }` · `{ op: 'depositgold', at }` · `{ op: 'depositworn', at, slot }` | bank |
| `counter { op: 'withdraw', at, item }` | an item from your bank (server id) |

Nothing else is accepted: no price, no gold, no owner, no keeper by name. A refusal comes back as
`combat { k: 'refused', what: 'counter', reason }` with the request id. `trade` (between players) stays reserved.

| Server → client | |
| --- | --- |
| `actor.enter { kind: 'npc', nid, x, y, sect, role, name, counter: 'bank' \| 'shop', town }` | a keeper in view |
| `counter { nid, kind: 'shop', role, name, stock: [{ itemDef, price, stack }], offers: { itemId: price }, gold }` | a shop: its stock and what it pays for each of your backpack items |
| `counter { nid, kind: 'bank', role, name, bank: [items], gold }` | your bank |
| `inv { … }` | your inventory, after every change (Server Items v1) |

`welcome.authoritative.economy` is true when the server runs the counters.

## Not online yet

Trading between players, crafting and repairing (the smith's repair, kits), lessons from trainers (the shop panel's Lessons tab
answers "not available online yet"), using items, the travelling merchant, shop hours and keepers who move, sleep or die (the
offline Living World keeps them; online they stand at their posts), stock limits and dynamic prices (the offline game has none
either), and an economy ledger in the database (transactions are written to the server log for now).

## Tests

- **Unit** (`tests/server/unit/economy.test.ts`, 9 tests): protocol v6 shapes (no price, gold or unknown fields; `trade`
  reserved); the exported counters (every bank and the named shops present, stock that exists, the server's prices equal to the
  build's, a world-hash mismatch refused); keepers announced in view, standing still, one set per realm; a shop's view and
  buying (gold charged at the posted price, the goods added with server ids, saved at once, logged); refusals (not sold here,
  unknown, more than one non-stacking item, over 100, without the gold, beyond the carrying capacity — and a refusal changes
  and saves nothing); selling (40 %, worn tools by uses, gold and starter gear refused, quantities, offers); the bank (all gold,
  an item, a worn piece with the look for others, saved rows, units conserved, withdraw, the same account at another bank,
  withdraw beyond capacity refused); the counter re-checked (reach, the kind of keeper, a ghost, another realm, unknown keepers,
  a world without the economy); gold conservation.
- **Integration** (`tests/server/economy.test.ts`, the real gateway and database, run in CI): the keeper in view, buying and
  selling saved to `game.items` at once at the posted prices; gold deposited into the `bank` container, still there after a
  reconnect, withdrawn; forged messages (a price, gold, unknown ops, negative quantities) refused as bad payloads, someone else's
  item, goods the shop does not sell and unknown keepers refused, no gold moved.
- **Client, live** (`tests/e2e/live_world.ts`): the built game against the real server `World` in Chrome, desktop and phone:
  the provisioner in view, tapping him opens the shop panel, Buy ×10 with the real button charges the posted price and the
  client's backpack shows the server's gold, Sell 1 pays 40 %, the banker's panel, Deposit all gold, Withdraw, depositing the
  worn sword (the paper doll follows), walking away closes the counter, no page errors. Screenshots: [shots-economy/](shots-economy/).

## Next

Lessons from trainers and repairs at the smith (both counter commands on the shared rules), then crafting and gathering on the
server, then player-to-player trading (a two-sided, server-held exchange), then magic.
