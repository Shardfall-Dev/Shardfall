# Server Creatures v1 — the wildlife lives on the server (alpha)

The third server phase, after [Server Movement v1](MOVEMENT.md). Build **v0.41**.

Online, the creatures of Anniabreen are now simulated by the server: one population per realm, the same for every player,
spawned from the game's own spawners, keeping the game's day and night, roaming, bolting, and stalking players. Nobody is
attacked yet: **combat is the next phase**. Every online screen still says that combat, items and trading are not online.

## What runs where

| | Server (`server/src/world/creatures.ts`) | Client (`src/online.js`) |
| --- | --- | --- |
| Population | Spawners from `server/data/population.json`, filled when a realm's first character enters, refilled at each species' respawn pace, out of every player's sight | — |
| Time of day | One world clock from the wall clock (`SIM.newClock`, a 120-minute day, 09:00 at 2026-11-28 00:00 UTC) | Set from the welcome (`clock`), so the light and the HUD clock match the server |
| Life | Roaming by activity hours, packs and herds behind their leader, senses, fleeing, stalking, returning home | Draws creatures with the game's own art (bestiary sheets, legacy sheets, procedural), interpolated 120 ms behind like other players |
| Trust | Everything | Nothing: a client cannot send anything about creatures (`attack`, `damage`, `loot` … are refused as `not_authoritative`) |

## The data: exported from the build

`tools/export-world.py` now also writes:

- `server/data/population.json` — the species (movement and temperament: name, size, health, speed, sight, leash, reach;
  faction, activity hours, temper, hearing, territory, pursuit limit, flight distance, social group, respawn time, courage,
  night vision; from `MON` in `src/game.js` and the ecosystem profiles in `src/ecology.js`), the **417 spawners** the offline
  game builds (Anniabreen, the stretch, frontier camps and the ecosystem's habitat regions; not those inside the Sunken Bell
  levels, which nobody can reach online yet, nor quest spawners), and the tiles that block sight.
- `server/data/ground.bin.gz` — one byte per tile: bit 1 protected (town) ground, bit 2 no spawning (blocking tiles, water,
  bridges, stairs, shallows, camp zones), exactly the tests `ecoSpot` and `canStand({ kind: 'mon' })` make offline.

It checks that the population is identical on two loads, and that creature footing on the server (shared collision plus the
protected bit) answers exactly like the game's `canStand({ kind: 'mon' })` on 102 000 points, half of them around spawners.
CI runs `tools/export-world.py --check`, so the server's creatures can never drift from the build.

## Behaviour (the offline rules, for the part that exists before combat)

Every 50 ms tick, after players move (`World.step` 1b):

- **Tiers.** Only creatures in grid cells within 56 tiles of a character live (think and move); the rest wait unchanged. With
  one player that is a few dozen creatures out of ~890.
- **Idle** (`ecoIdle`): by the species' hours a creature is active, resting or asleep; it roams inside its territory around its
  home at 35 % (resting 22 %) of its speed, pausing between waypoints; pack and herd members follow their leader.
- **Senses** (`ecoThink`, every ~0.45 s): sight is the creature's aggro radius, shortened by darkness unless it has night vision,
  cut by sleep (`SIM.senseRange`); a player is seen in line of sight on the game's sight-blocking tiles, or heard when moving
  within hearing range (`SIM.detect`).
- **Flee**: a timid animal (hare, deer) bolts from a player inside its flight distance, its herd with it; prey tires after its
  first three seconds; when safe it walks home.
- **Stalk**: a hostile creature (by `SIM` faction rules against the adventurers' faction) or a territorial one (inside its aggro
  radius) goes after a player it perceives, with its pack. It closes to striking distance (90 % of its reach) and **holds and
  faces** the player. It gives up and walks home when the player is farther from home than the species' pursuit limit, out of
  leash or sight, or on protected ground. Creatures never set foot on protected ground, so towns and roads stay safe.
- **Graveyards** raise extra dead at night (the spawners' night caps) and let them sink at dawn out of everyone's sight.
- Creatures are pushed gently apart (`ecoSeparate`) and use the game's creature step: axis-separated slide, a sidestep when
  blocked, `MOVE_SCALE`, the game's 8-way facing.
- Random choices use a seeded stream per realm (`SIM.stream`), so the same seed and inputs give the same creatures (tested).

Simplified for now (documented, and natural to finish with combat): creatures do not fight each other, hunt prey, feed, go on
camp sorties or weigh courage against a player's strength; camps do not stay cleared (nothing dies online yet); creatures are not
saved — a server restart repopulates the world, as a reload ends fights offline.

## Protocol v3

| Server → client | |
| --- | --- |
| `welcome { …, authoritative: { movement: true, creatures: true, combat: false, items: false }, clock: { hour, dayMinutes, period } }` | |
| `actor.enter { kind: 'player', nid, characterId, name, … }` | a character, as in v2 |
| `actor.enter { kind: 'creature', nid, type, name, x, y, sect, speed, hp, max }` | a creature; nothing else about it is sent |
| `state { …, moves: [[nid, x, y, sect, speed]] }` | characters and creatures alike |
| `actor.leave { nid }` | out of range, or sank at dawn |

Clients still send only `hello`, `ping`, `resync` and `move`. A v2 client is refused with `protocol_mismatch` and the reload
brings v3. `WORLD_CREATURES=false` turns creatures off (diagnosis only); the welcome then says `creatures: false`.

## Tests

- **Unit** (`tests/server/unit/creatures.test.ts`, 13 tests): the exported population against the world; the world clock
  (periods, a full day, light); the boot fill (every creature on creature footing, off protected ground, within its spawner's
  cap, 12+ tiles from the first player, one id space with characters); two minutes of life around a walking player never
  leaving creature footing; tiers (nothing far away moves); a hare bolting and going home; a hound stalking to striking
  distance, holding without harm, and giving up within its pursuit limit; protected ground never stalked or entered; interest
  (creatures announced with only their public face, moves in state, leave out of range); graveyards at night; determinism;
  the world without creatures; 120 players spread over the map under 8 ms a tick.
- **Integration** (`tests/server/creatures.test.ts`, the real gateway): the welcome's clock and authority flags; a character
  in the wilds told about creatures from the exported population at full health, their steps in state, and creature messages
  from the client refused.
- **Load** (`tests/server/load/bots.ts`): the 150 bots now share the world with the creatures; the run reports creature counts
  and creature time per tick, and fails if the world is not populated.
- **Client**: a recording of the real server `World` (a player in the wilds by day and beside hounds at night) replayed into the
  built game through a stubbed WebSocket, desktop and phone sizes, no page errors. Screenshots: [shots-creatures/](shots-creatures/).

## Limits and next steps

- **Next: combat.** The stalk becomes the game's telegraph → strike → recover against players (`aiMon`), with health, damage,
  death and corpses on the server, then players attacking creatures (server-validated swings and spells), then loot and items.
- NPCs (townsfolk, guards, merchants, adventurers) come after combat, on the same population and interest machinery.
- One server process: creatures, presence and the world live in memory.
