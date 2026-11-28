# Server Movement v1 — walking together in Anniabreen

The second server phase, after [Server Foundation v1](SERVER_FOUNDATION_V1.md). Build **v0.37**.

Online characters now walk around the real world, drawn by the game's own renderer, and see each other moving. **The server
decides where everyone is.** Creatures, NPCs, combat, gathering, crafting, items and trading are still not online. The online
bar and the welcome message say so.

## What happens when you press Play

1. The roster's **Play** opens the WebSocket and says `hello` with the character.
2. The server adds the character to the world at its saved position. A new character starts at its town's spawn. If the
   saved spot is no longer standable, the nearest standable point is used.
3. The `welcome` carries the authoritative snapshot, your position (`you`) and the world's hash.
4. The client generates the game's world (`genWorld`), opens every door (doors are open online for now) and builds the
   collision world with `shared/collision.js`. If its hash differs from the server's, the page is out of date and says so.
5. Otherwise the game starts in **online mode** (`ONW`):
   - the offline `update()` is replaced by `onlineStep()` (src/online.js);
   - the local save is disabled (`save()` returns at once while online);
   - taps on the world do nothing;
   - only movement keys, Sprint and the map work. Other keys and HUD actions are held back with "Not available online yet".

## Authority: intents in, positions out

Every 50 ms step (the game's fixed step, and the server tick):

- **Client.** The stick or WASD becomes an *intent*: a direction, how far the stick is pushed (0–1) and sprint on or off. The
  intent gets a sequence number. The client predicts its result immediately with `shared/movement.js` and sends intents in
  pairs (`move`, up to 10 per message).
- **Server** (`server/src/world/world.ts`):
  - Each character consumes queued intents against an **input credit**. The credit refills by one per tick and is capped at 3,
    so a short network stall can catch up but nobody moves faster than real time.
  - Each intent is applied with the same `shared/movement.js` on the same collision: walk 4.1 m/s and sprint 5.3 m/s
    (× MOVE_SCALE 1.5), 60 % below a quarter push, armour speed and encumbrance from the shared rules, shallows at 80 %.
    The character slides along walls, sprinting costs stamina, and facing has the game's hysteresis.
  - A queue holds at most 10 intents; older and repeated sequence numbers are ignored.
  - A client cannot send a position, a speed, a stamina value or a teleport: those messages do not exist (`teleport` and
    `position` are refused as `not_authoritative`).
- **State.** The server sends `state` to each connected character every tick in which something changed, and at least once a
  second:
  - `you`: the authoritative position, stamina, the movement clock and `ack`, the last intent applied;
  - `moves`: the changed positions of the characters you can see.
- **Reconciliation.** The client drops acknowledged intents, starts from `you` and replays the rest. The rules and the
  collision are identical on both sides (`tools/export-world.py` proves the collision equal to the game's on 316 000 points),
  so the replay normally lands exactly where the prediction already was. The e2e test checks for zero corrections.
- **Others.** `actor.enter` brings a character's name, look and visible gear, plus its position. `state.moves` updates it,
  and `actor.leave` removes it. Other characters are drawn 120 ms in the past, interpolated between server positions.

## Interest management

The server places characters on a uniform grid of 16-tile cells:

- Characters within the view radius (40 tiles, `WORLD_VIEW_RADIUS`) are announced with `actor.enter`.
- They are dropped (`actor.leave`) beyond the radius plus 4 tiles, a margin against flicker at the edge.
- Only changed positions are sent, rounded to 1/1000 of a tile.
- Account ids are never sent.

## The world on the server

The world is generated deterministically by the game (`genWorld` + `anniabreen.js` + `frontier.js`). It is not reimplemented
on the server. Instead, `python3 tools/export-world.py` loads the built game in Chrome and exports what the server needs:
- tiles, 2620 × 1520;
- the blocking and "soft" tile tables;
- the 1 691 wall and prop colliders;
- every starting town's spawn.

The export is written to `server/data/world.bin.gz` (153 KB) with a manifest, `server/data/world.json`.

Each export also checks two things:
1. The world is identical on two separate loads (determinism).
2. `shared/collision.js` answers exactly like the game's `canStand` on 316 000 points: random ones, around every collider and
   around every tree, rock and reed.

CI runs `tools/export-world.py --check`. **A pull request that changes the map must re-run the export and commit
`server/data/`**; the check says so when it is forgotten. The server verifies the file's SHA-256 and world hash at start-up.

## Persistence

Positions (and stamina) are saved:
- every 30 s for the characters that moved;
- at once when a character leaves the world (sign-out, the 10 s reconnect grace running out, takeover by another character);
- for everyone when the server stops.

A reconnect within the grace period finds the character exactly where it was, because it never left the world.

## Protocol v2 (shared/protocol.js)

| Client → server | |
| --- | --- |
| `move { inputs: [{ s, x, y, w, r }] }` | 1–10 intents; `s` sequence number, `x,y` direction (normalised by the server), `w` push 0–1, `r` sprint |
| `hello`, `ping`, `resync` | as in v1 |

| Server → client | |
| --- | --- |
| `welcome { …, world: { hash, W, H, step, viewRadius }, you, authoritative: { movement: true, combat: false, items: false } }` | |
| `state { tick, you: { nid, x, y, sect, stam, stamMax, ack, t, ld }, moves: [[nid, x, y, sect, speed]] }` | |
| `actor.enter { nid, characterId, name, body, appearance, title, town, equip, x, y, sect, speed }` | |
| `actor.leave { nid }` | |

A v1 client is refused with `protocol_mismatch` (close 4005), and the page reload brings v2.

## Tests

- **Unit** (`tests/server/unit/movement.test.ts`):
  - the exported world and its spawns;
  - walk and sprint speeds equal to the game's;
  - stamina, the delay and regeneration;
  - 20 000 random steps from every town spawn, each ending standable;
  - clamping of intents; overweight characters not moving; facing;
  - the input credit (one per tick, catch-up of 3, queue bound, old sequence numbers ignored);
  - interest enter / leave.
- **Integration** (`tests/server/movement.test.ts`, the real gateway on the real stack):
  - the welcome world hash and spawn;
  - the server's position equal to a local replay of the acknowledged intents;
  - a flood of 120 intents unable to beat real time;
  - the harbour wall holding;
  - interest: a nearby character announced and its steps arriving, a distant one not announced, walking away dropping it;
  - persistence on reconnect within grace, on sign-out and sign-in, and on server shutdown.
- **Load** (`tests/server/load/bots.ts`, CI): 150 bots walk for 20 s, half crowded into Saltmarsh Quay. The run fails on
  average tick time, overruns or missing state messages, and prints bandwidth and memory.
- **Browser** (`tests/e2e/online_flow.py`): two accounts, desktop and phone-sized, enter the world and see each other. A walks
  with the keyboard. Every intent is acknowledged with zero prediction corrections, and B sees A exactly where the server put
  A. Leaving removes the character for the other player, and the offline save stays byte-identical.

## Limits and next steps

- **One server process.** Presence and the world live in memory.
- **No world interaction online yet:**
  - doors are always open online, and fields and traps are absent;
  - the walking animation for others is the tinted body sheet (or the layered gear art when that setting is on). Weapons
    drawn and combat poses come with combat.
- **Next:** server-owned creatures and NPCs in the world loop (with the same interest management), then combat, then items
  and the economy — one subsystem at a time.
