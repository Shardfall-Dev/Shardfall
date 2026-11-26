# Living World — implementation progress

The roadmap is `docs/WORLD_SIMULATION_MASTER.md` (the full specification, unchanged). This file records what is actually built, how it was tested, and what comes next. Update it at the end of every phase.

**Status words:** **Tested** — implemented and covered by an automated test that passes. **Implemented** — in the build, checked by hand only. **Partial** — some of the item is in; the rest is listed. **Planned** — not started. **Blocked** — waiting on something named.

**Current build:** v0.21 (`Shardfall_v0.21.html`), branch `feature/living-world-phase1`. It is stacked on `feature/anniabreen-map` (v0.20, PR #11), which is stacked on `integration/v0.19` (PR #10). `main` is still at v0.16. Merge in that order.

---

## Phases

The spec's development sequence (§29, phases A–G) is numbered 1–7 here. Each phase must leave the game playable and pass every existing suite before the next starts.

| # | Spec | Phase | Depends on | Status |
|---|---|---|---|---|
| 1 | A | Audit and architecture: actor ids, archetypes and controllers, shared damage entry, structured events, seeded streams, deterministic tests | — | **Tested** (v0.21) |
| 2 | B | Clock and navigation: fixed 50 ms simulation step, persistent world clock (120 min day), day/night lighting and local lights, A* plus a waypoint graph, doors, stuck recovery, developer debug panel | 1 | Planned |
| 3 | C | Population and monster ecosystem: regions and habitats, species profiles as data, roaming, territories, predator/prey, monster-vs-monster factions, creature audio | 1, 2 | Planned |
| 4 | D | Living NPCs: named townsfolk with homes, workplaces and schedules; guards patrolling; merchants travelling; resource workers; basic adventurers | 1, 2, 3 (factions) | Planned |
| 5 | E | Shared combat and law: NPC-vs-NPC and NPC-vs-monster combat, NPC spellcasting through Magery, actor death and looting, criminal flags, murder counts, guards, witnesses | 1, 3, 4 | Planned |
| 6 | F | Persistence and optimisation: world-state save (regions, camps, corpses, cargo), simulation tiers A/B/C, spatial index, mobile profiling, regression tests | 1–5 | Planned |
| 7 | G | Emergent gameplay: merchant ambushes, dungeon expeditions, camp patrols, NPC healing and recovery, basic economy, encounters | 1–6 | Planned |

Spatial indexing (phase 6 in the spec) is needed earlier: phase 3 adds dozens of roaming actors with perception, and `aiMon` already checks every entity against every other for push-apart (see Performance). Plan to pull a chunk index into phase 3.

---

## Phase 1 — Audit and architecture (v0.21) — **Tested**

### What was built

- **`src/world.js` — the world simulation core (`SIM`).** A pure module: no DOM, no Canvas, no timers, no `Math.random`. It runs in the browser and in Node, like `src/rules.js`. Its parts:
  - **Stable actor ids.** Named actors get an id from their name: `npc:odile-banker`, and in placement order `npc:quay-warden`, `npc:quay-warden-2`. The player is `player:p1` and Wren is `npc:wren`. Spawned actors draw from one counter: `mon:rat:42`, `pet:boar:57`, `summon:x:60`. The counter is saved, so a number is never reused across sessions. Ids are strings, so a future server can issue the same ones.
  - **Archetypes, controllers and optional components (§3).** The 11 archetypes are player, civilian, merchant, guard, adventurer, hireling, criminal, monster, animal, pet and summon. Each maps to one controller from the spec's list (PlayerController, CivilianAI, MerchantAI, GuardAI, AdventurerAI, CriminalAI, MonsterAI, AnimalAI, PetAI, SummonAI). The list also has HirelingAI for Wren and NetworkController reserved for multiplayer. Components are optional per archetype: wildlife has no notoriety, bank or magic.
  - **Registry.** Maps id → live actor and rejects two different actors with the same id.
  - **Structured events (§4).** Each record holds `{ seq, t, type, …actor ids, location, detail }`, with `t` in simulation seconds. Types are restricted to the spec's list. The log keeps a ring of the newest 256 records. `ActorMoved` reaches listeners but is never kept. Per-type counts are tracked, and a failing listener cannot break an emission.
  - **Seeded streams.** mulberry32, the same generator as the world builder, with a saveable state. Named streams derive from the world seed, so adding a stream never shifts another.
  - **`SIM.inspect(actor)`.** A plain-data debug view: id, archetype, controller, position, state, target id, health and home.
- **Wired into the game (`src/game.js`) without changing behaviour:**
  - **Ids on spawn.** `addEnt` adopts every new actor (id, archetype, controller) and emits `ActorSpawned`. `rmEnt` unregisters it and emits `ActorRemoved`. Corpses and dropped piles are world objects, not actors.
  - **Controller dispatch.** The update loop asks each actor's controller to tick, replacing the old `kind` if/else chain. MonsterAI, AnimalAI and CriminalAI run the existing creature AI unchanged. PetAI and SummonAI run `petTick`, and HirelingAI runs `allyTick`. The player's controller is the existing input path. Civilians, merchants and guards have no tick yet and stand at their posts, as before.
    - The controller is re-derived when an actor changes kind, so a tamed creature keeps its id and becomes a PetAI pet.
  - **Classification as data.** `SPECIES_CLASS` sorts creatures: rat, boar, hound, snapper, wreck crab, both spiders and the dire wolf are animals; the brine smuggler is a criminal; the rest are monsters. NPC roles map to guard, merchant (every shop role, bankers) or civilian.
  - **One damage entry, `damageActor(target, amount, kind, source)`.** Every landed blow (`applyBlow`) and every spell (`hurt` in `src/magic.js`) now go through it to the player, the hireling or a creature. The numbers are unchanged.
  - **Death exactly once.**
    - `killMon` ignores a second call, so there is one corpse and one loot roll.
    - `playerDies` and `allyDies` ignore an actor that is already a ghost.
    - Each death emits a single `ActorKilled`.
  - **Events at the chokepoints.** `ActorDamaged` (player, hireling, creatures), `ActorKilled`, `ResourceGathered` (mining and woodcutting strokes, foraging, fishing) and `ItemCrafted`.
  - **Save v5.** It adds `sim: { v, seed, ids: { next } }`. Migration from v4 is additive: nothing existing changes, and an old build still reads a v5 save, so no snapshot is kept.
  - **Seeded dungeons.** Dungeon chest placement and dungeon spawn types used `Math.random()` and the unseeded game generator, so they changed on every load. They now use their own seeded stream. The map's own generator sequence is untouched, so the map is byte-identical.
  - **Developer hooks only.** `__SF.WS`, `SIM`, `inspect`, `archetypeOf`, `damageActor`, `CONTROL`. There is no in-game debug panel yet; that is phase 2.
- **Page title** fixed: it still read v0.19. It now reads v0.21.

### Tests

- `node tests/world.test.js Shardfall_v0.21.html`, 53 checks:
  - Id format, uniqueness over 5000 ids, the counter resuming after a save, exclusive claims.
  - The registry rejecting duplicates.
  - Every archetype → a known controller; optional components.
  - Event type validation, timestamps, the bounded ring, transient movement, unsubscribe, counts, listener errors.
  - Seeded streams: reproducible, resumable from a saved state, identical to the world builder's mulberry32, independent named streams.
  - World save/restore; inspection.
- `python3 tests/world-smoke/run.py Shardfall_v0.21.html`, 23 checks in Chrome:
  1. 212 actors at boot, each with a unique registered id, controller and archetype; named ids as above.
  2. An idle boar wanders under AnimalAI. Merchants stay put. A creature turned into a pet keeps its id and follows the player.
  3. Damage and death:
     - Creature → player and creature → creature both go through the shared entry, with ids in the events.
     - Three killing blows on one creature give one `ActorKilled`, one corpse and one `ActorRemoved`.
  4. Over 300 simulated seconds and 1,500+ events, the log stays at its 256-record cap and holds the newest.
  5. Save → reload → continue:
     - The 59 townsfolk and Wren keep their ids.
     - Creatures spawned after the reload never reuse a number.
     - The save is v5 with the seed and counter.
  6. A v4 save migrates additively, boots, plays and saves as v5.
  7. Determinism:
     - Seed 42 run twice gives identical positions, health, states and event logs for all 212 entities after 2,400 steps (120 s).
     - Seed 7 differs.
     - Dungeon chests and spawn types are the same in every session.
  8. The real animation loop (render, HUD, minimap) runs the new dispatch with no errors.
- **Regression.** Every existing suite was run on v0.21 and on v0.20 in the same container:

| Suite | v0.20 | v0.21 |
|---|---|---|
| `rules.test.js`, `magery.test.js`, `combat.test.js` | all pass | all pass |
| `magery-smoke` | pass | pass (failed once: random fizzle, see below; then 3/3 on each build) |
| `combat-smoke` | 6 scenarios pass; `playtest.py` fails | same: 6 pass; `playtest.py` fails at the same line |
| `backpack-smoke` | 32/32 | 32/32 |
| `bestiary-smoke` | all pass | 123/123 |
| `anniabreen-smoke` | 37/37 | 37/37; same walking times to 0.1 s |
| `sfx-smoke` | 48/48 | 48/48 |

  One expected test update: `anniabreen-smoke` checked that a v3 save migrates to exactly v4. It now accepts v4 or later, since migration continues to v5. The node and survey key checks are unchanged.

### Decisions

- **No fixed timestep yet.** The 50 ms step (§4) would make creature movement visibly stutter at 60 fps without render interpolation, so it moves to phase 2 together with interpolation. The tests already drive `update(0.05)`.
- **Controllers wrap the existing code.** No AI was rewritten; phase 3 replaces the MonsterAI/AnimalAI ticks with species profiles behind the same names.
- **Wren is a HirelingAI actor.** She is a scripted sellsword, not an autonomous adventurer. She can become an AdventurerAI in phase 4 without changing her id.
- **Monsters are not yet saved individually.** They respawn on load as before; the id counter only guarantees fresh numbers. World-state persistence is phase 6.
- **The global `R` remains the gameplay generator.** Moving each system onto its own named stream happens as each system is rebuilt (population in phase 3, economy in phase 7).

### Known issues (not introduced here)

- **combat-smoke `playtest.py` fails on v0.20 and v0.21 alike.** A phone tap on "Bandage Wren" times out because the HUD re-renders the button every 120 ms, so Playwright never sees it "stable".
- **sfx-smoke "a whiff" is flaky on v0.19/v0.20.** This is noted in PR #11.
- **magery-smoke `migration.py` can fail at random.** Its Sable Curtain step casts once with the unseeded generator, so a fizzle fails it. It was seen once in 7 runs; the build makes no difference.

---

## Implementation matrix (audit of v0.20 against the spec)

| Spec § | Area | What exists in v0.20 | Status after phase 1 | Next |
|---|---|---|---|---|
| 2 | Rules: no engine, offline, saves migrate | Single-file web build via `build.sh`. Works offline after load (`--offline` build embeds audio). Saves v1→v4 with snapshots. | Respected; save v5 | — |
| 3 | Actor architecture | `ents[]` of plain objects keyed by `kind` (`mon`, `npc`, `pet`, `ally`, `corpse`); player `P` separate; numeric per-session ids | **Tested:** stable ids, archetypes, controllers, optional components | Phase 4 adds civilian/guard/merchant ticks |
| 3 | Shared action services | One physical resolver (`swingAt`/`strikeOne` → `applyBlow`) for player, Wren, pets, creatures. Magery in `magic.js`. Bandaging, gathering, crafting are player-only. | **Tested:** shared damage entry `damageActor`, death once | Movement, gather, craft, loot and trade for any actor: phases 4–5 |
| 4 | Simulation/render separation, timestep, events, seeded RNG | `update(dt)` with frame dt (capped 0.1 s); `render()` separate; `R` swappable (`setRng`); world gen seeded (`mulberry(1999)`); no event log | **Tested:** events, seeded streams, deterministic test harness. Fixed step: **Planned** (phase 2) | Phase 2 |
| 5 | World clock | `hourOfDay()` = `(GT/60 + 9) % 24`: a 24-minute day, starting at 09:00. `GT` is saved, so time already persists. HUD clock exists. | Planned | Phase 2: 120-minute day, periods, setting |
| 6 | Day/night visuals | `darkness()` overlay with radial holes for the player, `LIGHTS` and blasts. Night Sight sets darkness to 0. Dungeons fixed at 0.8. | Planned | Phase 2: tinted dawn/sunset, local lights, Night Sight partial |
| 7 | NPC life | 58 static NPCs (Saltmarsh + Anniabreen towns), roles, shops, dialogue lines; no movement or schedules | Classified (civilian/merchant/guard) | Phase 4 |
| 8 | NPC adventurers | Wren: one hireling with skills, equipment, bandaging, ghost/resurrection, follow/wait | Classified (hireling) | Phase 4 |
| 9–10 | Monster ecosystem | `MON` table (23 types) with aggro, leash, speed, loot, skin; `SPAWNS` point spawners with caps and respawn timers; `aiMon` idle/chase/telegraph/strike/recover/return | Classified (animal/monster/criminal), dispatched by controller | Phase 3: profiles, habitats, activity hours |
| 11 | Factions | None; creatures target only the player, pets or Wren (or a provoked creature) | Planned | Phase 3 (species), phase 5 (law) |
| 12 | Utility AI + state machines | `aiMon` state machine; no utility scoring, personality or hysteresis | Planned | Phase 3–4 |
| 13 | Perception | Aggro radius + `los()`; hidden player ignored; no hearing, sleep or night vision | Planned | Phase 3 |
| 14 | Pathfinding | None: straight-line steering with a sidestep (`moveBy`); doors, bridges, stairs and moongates exist | Planned | Phase 2 |
| 15 | Population | `SPAWNS` point spawners: Saltmarsh, Anniabreen (8: boars, rats, a cemetery pair of skeletons, hounds, snappers, spiders) and dungeon rooms; bestiary creatures have stats but no spawns | Planned | Phase 3 |
| 16 | Camps | Ashfen outlaw camp (static vendors, smugglers spawner) | Planned | Phase 3 |
| 17 | Dungeons | Sunken Bell, 3 levels, seeded rooms, Bellkeeper boss, chests, stairs; Mynoc mine first chamber | Dungeon spawns/chests now deterministic | Phase 3; the spec's Anniabreen dungeon network is not in the repo yet (**Blocked** on that work) |
| 18 | Combat between actors | Creatures ↔ player/pets/Wren; provoked creature ↔ creature | Shared entry **Tested** | Phase 5 |
| 19 | Criminality | Protected zones (`PROT`, guarded towns); theft/pickpocket and snooping exist for the player; no notoriety | Planned | Phase 5 |
| 20 | Corpses, death, loot | `SF.deathTransaction` for player and Wren, creature corpses with loot rolls, decay timers, skinning, the player's corpse saved | Death once **Tested** | Phase 5 (NPC looting), phase 6 (persist all corpses) |
| 21 | Economy | Shops with fixed prices, resource nodes deplete/refill and persist, crafting consumes materials | Planned | Phase 7 |
| 23 | Sound | `SFXA` Web Audio player: buses, positional pan, priorities, area music, ambience per zone, footsteps by surface; volume/mute settings | Untouched | Phase 3 (creature idle/alert); separate volume buses: phase 3 |
| 24 | Animation | Player: 8-direction walk/attack clips per weapon family. Rat and skeleton sheets. 11 bestiary sheets (walk, wind-up, impact; no death, cast, sleep). Other creatures procedural. | Untouched | Backlog below |
| 25 | Performance tiers | Whole-world update each frame; render culls to the viewport | Measured (below) | Phase 6; spatial index in phase 3 |
| 26 | Persistence | localStorage, one key, ~JSON; snapshots for v2/v3/premagery; nodes, player, pets, Wren, the player's corpses, door states | v5 (`sim`) **Tested** | Phase 6 |
| 27 | Debug tools | `window.__SF` test hooks; no panel | Hooks extended | Phase 2 panel |
| 28 | First milestone | Two Anniabreen towns + road + forest + cemetery exist as map; nothing lives there yet | Planned | Phases 2–5 |

### Conflicts and risks found in the audit

- **Base branch.** The newest playable work is two unmerged PRs deep (#10 → #11). This branch adds a third. If #11 changes, rebase this onto it; the changes touch few lines outside `src/world.js`.
- **Time scale.** The current 24-minute day becomes the spec's 120-minute day in phase 2. That changes when night falls for existing players; the clock setting is configurable.
- **Night Sight.** It removes darkness entirely today; the spec asks for partial. This is a behaviour change to agree on in phase 2.
- **Ids versus ally `aid`.** Wren's `aid: 'wren'` (bandage links, body ownership) is kept as is. Her actor id is `npc:wren`.
- **Quadratic push-apart.** `aiMon` checks every entity against every other for push-apart. With 212 entities this is fine; at the spec's hundreds it is not. A spatial index is needed in phase 3.
- **Anniabreen is thinly populated.** The spec's milestone names Anniabreen places (graveyard, forest, dungeon). The map has 8 simple spawners, no camps and no dungeon network yet.

---

## Asset inventory (for the population and animation phases)

- **Player:** one 8-direction atlas with walk and attack clips for Sword, Glaive, Hammer, Dagger, Unarmed, Shortbow and Crossbow. NPCs reuse it with tinted cloaks (`scoutSheet`). There are no death, cast, sleep or work clips; deaths cut to a corpse sprite.
- **Creature sheets:** rat and skeleton (`MON_SHEETS`).
- **Bestiary v1:** 11 sheets of 160×160 cells in 8 facings, with idle, walk, wind-up and impact. No death, sleep or cast frames. The creatures are orc, ettin, troll, lizardman, gargoyle, earth elemental, giant spider, dire wolf, harpy, slime and the Lich Lord (boss).
- **Procedural creatures:** boar, marsh hound, mud snapper, wreck crab, mire spider, ash wisp, bell sentinel, drowned captain and the Bellkeeper.
- **Sound pack v1.0.0:** 107 events.
  - Creature sounds exist for rat, skeleton and hound (alert, attack, death), plus attack-only takes for boar, crab, spider and wisp.
  - Ambience: surf, wind, rain, hearth, gull, marsh, drip, bell and beacon.
  - Footsteps on 7 surfaces.
- **Music:** five Saltmarsh tracks, mapped to zones.
- **Gaps for the spec's roster (asset backlog):**
  - Deer, rabbits, bears, bandits as their own look, zombies, dragons/drakes, fire and water elementals, goblins.
  - Death animations for everything.
  - Sleep/eat/work clips for townsfolk.
  - Owl, insect, howl and groan ambience.
  - Creature idle sounds.
  - Until art exists, reuse is documented per species in phase 3, for example dire wolf for wolves and tinted scouts for bandits. Missing creatures are not spawned invisibly.

---

## Performance (desktop Chrome, this container, 212 entities, Saltmarsh Quay)

| Build | `update(0.05)` | `render()` |
|---|---|---|
| v0.20 | 0.79 ms | 4.6 ms |
| v0.21 | 0.80 ms | 4.8 ms |

Average of 3 runs × 4000 updates and 200 renders. The difference is within run-to-run noise. Phone figures are not measured yet (phase 6).

---

## Next task (phase 2, first step)

Introduce the fixed 50 ms simulation step with render interpolation for actor positions. Then move the world clock to a configurable 120-minute day with the spec's periods, persisted in `sim`.

Keep `tests/world-smoke` determinism green, and add clock tests: save/load keeps the time, and periods change at the right hours.
