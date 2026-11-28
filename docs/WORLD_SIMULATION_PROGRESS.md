# Living World — implementation progress

The roadmap is `docs/WORLD_SIMULATION_MASTER.md` (the full specification, unchanged). This file records what is actually built, how it was tested, and what comes next. Update it at the end of every phase.

**Status words:** **Tested** — implemented and covered by an automated test that passes. **Implemented** — in the build, checked by hand only. **Partial** — some of the item is in; the rest is listed. **Planned** — not started. **Blocked** — waiting on something named.

**Current build:** v0.39 (`Shardfall_v0.39.html`), branch `feature/living-world-phase5d`, on main at v0.37 (v0.33.1 + v0.34–v0.36 + Server Foundation v1). v0.38 is the server movement work in #57, built in parallel. Phase 5, step 4: NPC death, bodies and looting, and the first NPC outlaws. Phase 5 is complete.

---

## Phases

The spec's development sequence (§29, phases A–G) is numbered 1–7 here. Each phase must leave the game playable and pass every existing suite before the next starts.

| # | Spec | Phase | Depends on | Status |
|---|---|---|---|---|
| 1 | A | Audit and architecture: actor ids, archetypes and controllers, shared damage entry, structured events, seeded streams, deterministic tests | — | **Tested** (v0.21) |
| 2 | B | Clock and navigation: fixed 50 ms simulation step, persistent world clock (120 min day), day/night lighting and local lights, A* plus a waypoint graph, doors, stuck recovery, developer debug panel | 1 | **Tested** (v0.22) |
| 2½ | — | **World expansion** (asked for between phases 2 and 3): Anniabreen stretched ×1.35 between rigid towns, the Southern Reach, 8 camps, 5 sealed dungeon mouths, world 2620 × 1520 | 2 | **Tested** (v0.23) |
| 3 | C | Population and monster ecosystem: regions and habitats, species profiles as data, roaming, territories, predator/prey, monster-vs-monster factions, creature audio | 1, 2 | **Tested** (v0.25) |
| 4 | D | Living NPCs: named townsfolk with homes, workplaces and schedules; guards patrolling; merchants travelling; resource workers; basic adventurers | 1, 2, 3 (factions) | **Tested** (v0.27); adventurers moved to phase 5, which gives NPCs combat |
| 5 | E | Shared combat and law: NPC-vs-NPC and NPC-vs-monster combat, NPC spellcasting through Magery, actor death and looting, criminal flags, murder counts, guards, witnesses | 1, 3, 4 | **Tested**: step 1 (NPCs as combatants, guards fight creatures, v0.30); step 2 (notoriety, aggression, criminal flags, witnesses, guards against you, murder counts, v0.34); step 3 (NPC adventurers and NPC Magery, v0.36); step 4 (NPC death, bodies, looting crimes, the first NPC outlaws, v0.39) |
| 6 | F | Persistence and optimisation: world-state save (regions, camps, corpses, cargo), simulation tiers A/B/C, spatial index, mobile profiling, regression tests | 1–5 | **Partial**: step 1 (tiers A/B/C, the population saved creature by creature, phone profiling, tier and persistence tests) **Tested** (v0.35, built alongside phase 5 step 2); corpses, cargo and NPC-adventurer state wait for phase 5 steps 3–4 |
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
- **magery-smoke `cancel.js` can fail the same way.** Its cast is also unseeded; seen once during the phase 2 run. It held 10/10 when repeated on both builds.

---

## Phase 2 — Clock and navigation (v0.22) — **Tested**

### What was built

- **Fixed 50 ms simulation step (§4).**
  - The game loop now runs `update()` in whole 50 ms steps from an accumulator (`SIM.newStepper`): at most 5 per frame, and a longer stall is dropped rather than replayed.
  - Rendering is separate. It blends each actor's position between the last two steps and draws with a render clock that trails the simulation by the same fraction, so nothing on screen is ahead of the simulation.
  - When the tab is hidden the world pauses. On return the accumulator restarts, so there is no catch-up burst.
- **World clock (§5).**
  - `SIM.newClock`: one in-game day lasts 120 real minutes, one hour 5 minutes, configurable.
  - The periods follow the spec table: deep night 00–05, dawn 05–07, daylight 07–17, sunset 17–19, night 19–24.
  - Time of day is a pure function of simulation time plus one saved offset. Setting the time moves the offset and never jumps simulation time.
  - The clock is saved in the `sim` block (SIM state v2), and older saves keep the hour they were at.
  - The HUD clock under the minimap shows a sun, moon or half-moon glyph and the time; its tooltip names the period and day.
- **Day and night (§6).**
  - `SIM.lightAt(hour)` gives smooth key frames: clear daylight, warm orange dawn, orange-red sunset, and a blue night at most 62 % dark so the game stays readable.
  - Local lights cut through the dark and add a warm glow that grows with the darkness: street lamps, forges, anvils, the camp fire, lit doorways after dusk, glowing creatures (wisps), fire and magic projectiles, and blasts.
  - Light shapes are cached sprites, not per-frame gradients. Night drawing costs about 5.8 ms on desktop against about 4.3 ms by day; see Performance.
  - Dungeons keep their own darkness at any hour.
  - **Night Sight** now lifts about two thirds of the dark and widens your light, instead of turning night into day (spec §6).
- **Navigation (§14).**
  - **Walkability.** A tile is walkable if a body of the player's radius can stand at its centre (cached). Each tile-to-tile step is also swept against the real colliders and cached per direction, because walls and doors are 0.15 m strips on tile edges that a centre test cannot see.
  - **Search.** `SIM.newSearch` is an A* that runs in slices: 8 directions, no corner cutting, road and bridge tiles cheaper so routes follow roads. Waypoints are then smoothed.
  - **Search budget.** At most 3,000 search nodes per 50 ms step across all actors, oldest request first. Finished paths are cached (an LRU of 256), and the cache is invalidated when any door changes.
  - **The travel graph**, built on first use in about 250 ms on desktop:
    - Nodes are road points every 25 tiles (merged where roads meet), the four Anniabreen towns, Saltmarsh Quay, its seven landmarks, every ferry, boat and packet pier, the three public moongates and the dungeon stairs.
    - A link is made only if a real path search confirms it, so none crosses a channel. Named places in water, such as the ford, are reached at their nearest dry tile.
    - Long journeys run Dijkstra over the graph, then local paths leg by leg. Boats, the ferry, moongates and stairs are taken as one action.
  - **Doors.** Humanoid travellers open a closed door, pass and close it behind them, which also keeps the saved door state right. An actor that may not open doors never paths through a closed one.
  - **Stuck recovery.** Progress is distance gained toward the current waypoint, so sliding along a wall does not count:
    - 1.5 s without gain: sidestep.
    - Twice: plan again from where it stands.
    - Four times: give up and let the controller choose. A traveller goes home once.
    - A search that has not answered in 8 s also gives up.
  - **Species rules.** The search accepts a flag that keeps an actor out of protected towns, ready for creatures in phase 3. Water is impassable to everyone; no swimmers exist yet.
- **Townsfolk controllers.** CivilianAI, MerchantAI and GuardAI now follow a travel goal when one is set. Existing townsfolk have none and stand at their posts as before; daily routines are phase 4.
- **Developer panel (§27).** Only with `?dev` in the address; there is no way to open it in normal play. A small DEV button opens it.
  - **Live stats:**
    - Version, simulation rate and real steps per second, FPS.
    - Actors (all and visible). Regional and distant counts wait for the simulation tiers (phase 6).
    - NPC and creature counts by archetype.
    - Time, day, period, day length and light level.
    - Path queue, cache, searches, failures and cache hits.
    - Average controller time per step, audio voices.
    - Save size and last save result.
    - Recent events.
    - Factions are shown as "none yet": they arrive in phase 3.
  - **Controls:** Dawn, Noon, Dusk and Midnight; ±1 h; Day/night; Pause/Resume; Step; Run +1 min and +10 min (a slice per frame); Save now; spawn a test traveller to any named place; remove travellers.
  - **Inspector:** tap an actor to see its id, archetype, controller, position, state and target, health, home, goal and current leg, territory and criminal status.
  - **Overlays:** paths, perception radius, territory (home and leash) and collision around the player.

### Tests

- `node tests/world.test.js`, 86 checks. New in phase 2:
  - The stepper: whole steps, alpha, stall handling, and frame-slicing independence.
  - The clock: start time, hour length, all ten period boundaries, setting the time, save/load, changing the day length.
  - The light curve: noon, night cap, no jump over .02 per minute, warm dawn and dusk, blue night.
  - A*: the maze, steps on open ground only, no corner cutting, unreachable goals, the node budget, sliced runs, road preference, a blocked goal, smoothing.
  - The travel graph: Dijkstra preferring a gate, two-way edges, isolated nodes, nearest node; the LRU.
- `python3 tests/world-smoke/phase2.py` (called by `world-smoke/run.py`), 36 checks in Chrome:
  1. **Clock:** 09:00 on a 120-minute day, shown in the HUD. 5 simulated minutes make one hour. Setting 22:00 shows night. The time survives a reload, and a save from before the clock keeps its old hour.
  2. **Light:** noon clear; night .62 and blue; dawn and dusk warm and half dark; Night Sight between 0 and .25; a dungeon .8 at noon; drawing works in every case.
  3. **Graph:** 21 named places all reachable from the Quay; all 153 walk links pass a real search; the travel kinds are ferry, boat, packet, moongate and stairs.
  4. **Journeys from Saltmarsh Quay,** each keeping searches within the 3,000-node budget:
     - Brine Crossroads: 47 s.
     - Shore Beacon: 25 s.
     - Mynoc: 109 s, by packet boat and the cart road.
     - Moonglen: 79 s, packet then boat.
     - Skara Bryn: 89 s, packet then moongate.
  5. **Stairs and doors:**
     - Down the stairs into the Sunken Bell: 72 s.
     - A closed door is opened, used and closed behind (and saved).
     - An actor that cannot open doors is refused, and the door stays shut.
     - A route forced through a wall re-plans and still arrives.
  6. **Load:** 12 travellers at once stay inside the per-step budget, and the queue drains.
  7. **Live loop:** 3.00 s of real time gives 3.00 s simulated, in whole 50 ms steps. There is no DEV button without `?dev`.
  8. **Panel:** all the listed stats; Midnight; Pause and Resume; spawning and inspecting a traveller; overlays and Run +1 min without errors.
- **Phase 1 checks.** `world-smoke/run.py` still passes on v0.22, including the seeded run that is identical step for step, which now includes the path searches.
- **Regression.** Every suite on v0.22, compared with the v0.20 baseline from phase 1:

| Suite | v0.20 | v0.22 |
|---|---|---|
| rules / magery / combat / world (node) | pass | pass |
| magery-smoke | pass | failed once (`cancel.js` and `migration.py`: unseeded fizzles); then passed twice in a row; `cancel.js` alone held 10/10 on v0.21 and v0.22 |
| combat-smoke | 6 pass, `playtest.py` fails | same: 6 pass, `playtest.py` fails at line 66 |
| backpack-smoke | 32/32 | 32/32 |
| bestiary-smoke | 123/123 | 123/123 |
| anniabreen-smoke | 37/37 | 37/37; the same walking times to 0.1 s |
| sfx-smoke | 48/48 | 48/48 |
| world-smoke (phase 1 + phase 2) | — | 23 + 36 checks, all pass |

### Decisions

- **Old saves keep their hour.** The 24-minute day becomes the spec's 120-minute day, which changes when night falls for existing characters.
- **Night Sight no longer makes night into day,** as the spec asks (§6). It still clearly helps.
- **Only test travellers move in this phase.** The townsfolk controllers can follow goals; routines, merchants on the road and guards on patrol are phase 4, and creatures using paths come with territories in phase 3.
- **"Night must affect the gameplay world" (§6)** is limited to light in this phase. Perception at night, nocturnal creatures and undead activity are phase 3, where perception is built.
- **Graph build timing.** The travel graph is built on first use (about 250 ms desktop), not at boot, so starting the game is not slower. Phase 3 will build it during population setup.

## World expansion (v0.23) — **Tested**

Requested on 2026-11-26: bigger distances, more camps, and places for dungeons. Three decisions were confirmed:

- **Both** stretch Anniabreen and add new lands. This knowingly goes beyond the spec's "do not recreate the map"; the towns themselves are untouched.
- Make the world **about twice** its area.
- Place **dungeon sites now and build the interiors later**.

### What was built

- **The world** is 2620 × 1520 tiles (3.98 M), up from 2100 × 900 (1.89 M). Saltmarsh is unchanged.
- **Anniabreen stretched, towns untouched (`annStretch` in `src/anniabreen.js`).**
  - The v1.0 map is still drawn exactly as before, in its original frame.
  - Every town (Mynoc with its mine, Vespar, Skara Bryn and its landing, Moonglen), the forest fork and Miner's Cross then move as rigid blocks by whole tiles.
  - The wilderness between them stretches ×1.35 by an inverse-distance blend. It was checked fold-free before use: the smallest local area factor is 0.92 and the largest 3.2.
  - Terrain is resampled; roads and the river are carved again along their stretched lines, outside the towns only. Woods are thinned again, outside the towns only.
  - Everything the towns placed moves with them: pieces, colliders, doors, buildings, lights, stations, shrines, zones, NPC posts, signs, gates, piers and protection.
  - `annWarp` / `annUnwarp` convert between the v1.0 frame and the new world. Zone rules written for v1.0 still run on the v1.0 coordinates.
  - **Proof:** all six town zones are tile-for-tile identical to v0.22, and their buildings, doors, townsfolk, stations and gates match.
- **The Southern Reach (`src/frontier.js`)** is new land across a strait, reached on foot by the **Long Causeway** from the forest fork.
  - **Southwatch** crossroads has a shrine to bind at and return to, a lamp and a signpost.
  - Roads run west to **Mirefen** (swamp: shallows, reeds), east past the **Greyspine** (cliffs and grade-2 ore) to **Kragmaw**, and south to the **Ashen Barrows** (a grave field).
- **Eight camps,** each with cleared ground, a trail over land to a road or a town edge (never across water, never through a town), art and a *provisional* spawner on existing creatures:

| Camp | Where | Creatures |
|---|---|---|
| Cutpurse Hollow | Westwood | road bandits (the smuggler's rules, own look) |
| Greywolf Den | north woods | dire wolves |
| Silkwood | east of the vale | giant spiders |
| Trollgate | west ridge | trolls and an ettin |
| Harpy Roost | Moonglen's east cliffs | harpies |
| Kragmaw Camp | Reach hills, palisade with two gates | orcs |
| Scalemire | Mirefen | lizardmen and bog slimes |
| Ashen Barrows | Reach | skeletons |

- **Five dungeon mouths,** original names on the spec's themes:

| Mouth | Theme | Where | Guards |
|---|---|---|---|
| Hollowdeep | Despise | Northern Ridge | an earth elemental |
| Wyrmhold | Destard | Greyspine | gargoyles |
| Liar's Keep | Deceit | a ruined tower on Moonglen's north tip | — |
| Sorrowstone | Shame | a crypt in Mirefen | — |
| Gilt Maw | Covetous | the cliffs north-east of Vespar | — |

  Each mouth is lit and labelled on the map. Trying it says plainly that it is sealed and opens in a later version. **No interior exists yet.**
- **Travel.**
  - The travel graph includes every site. Long links are laid along their verified paths in legs of at most 35 tiles.
  - Every graph node and search end snaps to open ground, because stretched road points can sit a tile off the carved road.
  - All 35 named places are reachable from Saltmarsh Quay, and all ~490 walk links pass a real search.
  - The graph builds in about 0.85 s on first use.
- **Save v6.** Anything saved at an Anniabreen position follows the stretch:
  - the character, bodies, Wren and her body, map pins and marked recall runes;
  - shut doors, and town resource-node and survey records;
  - wilderness node records are dropped, because that ground was redrawn.

  The v0.22 save is kept once as `shardfall.save.v1.prev5`. A character that would load inside something is nudged to the nearest open ground.
- **Walking times now** (Anniabreen test, full stick, no sprint):

| Route | v0.22 | v0.23 |
|---|---|---|
| Mynoc → Vespar by cart road | 78 s | 104 s |
| Skara landing → fork | 48 s | 66 s |
| Fork → Mynoc | 67 s | 91 s |
| Fork → Vespar | 77 s | 104 s |

  - All walks inside towns are unchanged to 0.1 s.
  - Developer travellers from Saltmarsh Quay: Kragmaw 285 s, Sorrowstone 278 s, Hollowdeep 201 s, Liar's Keep 117 s (packet + boat).

### Tests

- `python3 tests/world-smoke/expansion.py` (called by `world-smoke/run.py`), 22 checks:
  - World size; towns identical to the `towns_v022.json` reference.
  - The sites, their zones and trails; camp creatures appear; a sealed mouth says so.
  - The causeway is walkable; Moonglen is still an island; all places are reachable.
  - Four long journeys arrive.
  - A real v0.22 save made in Vespar migrates, with its rune, ore face and shut door.
- `tests/anniabreen-smoke` now places its v1.0 points through the game's own warp. Its travel-time ranges are raised to the new distances. Every walk completes, and the town walks match v0.22 exactly.
- The phase 1 and 2 checks accept the new save version. The full regression is in the table below.

### Costs and limits

- **Starting the game is slower and uses more memory** (desktop): 1.7 s instead of 1.0 s, and about 72 MB of heap instead of about 31 MB, because there is twice as much land. Phones are not measured; this joins the night pass and graph build on the phase 6 list. Caching the generated world is the obvious remedy (it is deterministic).
- **Camp spawners are provisional.** They respawn like the old point spawners. Phase 3 turns camps into persistent populations with territories, patrols and recovery after clearing.
- **Dungeon interiors:** none yet; each needs its own step.
- **Missing art and sound.** Bandits use a tinted scout; there are no goblin, drake or dragon creatures. Tents, campfire, totem, huts, webs, bones, cave, crypt and keep are drawn in code in the kit's palette. Asset backlog: dragon and drake art, goblins, cave ambience.

## Phase 3 — Population and monster ecosystem (v0.25) — **Tested**

### What was built

- **Pure core in `src/world.js` (tested in node):**
  - **Factions (§11).** `SIM.newFactions(SIM.FACTION_RULES)` gives five levels: allied, friendly, neutral, suspicious, hostile. Relationships are symmetric, same faction is friendly and an unlisted pair is neutral.
    - The 20 factions are the spec's 13 plus vermin, arachnids, lizardfolk, giants, harpies, constructs and oozes.
    - Some rules: guards–citizens allied, guards–criminals hostile, orcs–goblins friendly, orcs against every human faction and against lizardfolk, giants and predators. The undead are against everything living, dragons against everything.
    - **Predation is not a faction level.** A profile's prey list decides it, so wolves hunt deer without wildlife being "hostile".
    - **Faction hostility is never a crime.** Law (notoriety, guards, witnesses) is phase 5 and is evaluated separately.
  - **Activity hours (§9).** `SIM.activityOf(hours, period)` returns active, rest or sleep.
    - *day*: rests at night and sleeps 00–05.
    - *night*: the undead, dormant by day.
    - *dusk*: wolves and hounds, active from sunset to dawn.
    - *always*.
  - **Perception (§13).** `SIM.senseRange` and `SIM.detect` work from sight, hearing and night vision.
    - Full night halves sight for a creature with no night vision. A wolf keeps 95 %.
    - Sleep cuts sight to 30 % and hearing to half; rest cuts sight to 80 %. An alerted creature (recently hurt or called) senses 25 % further.
    - *Seen* needs line of sight. *Heard* needs the target to move or fight within hearing.
    - A hidden target is never detected from range, only stumbled over within 1.2 m.
  - **Decisions with commitment and hysteresis (§12).** `SIM.decide(mem, options, t)`.
    - The current act is kept for its commitment time (1.8 s). After that a rival must beat it by a margin (0.15).
    - An act that is no longer possible is dropped at once. A forced option (badly wounded) overrides commitment.
    - Every choice keeps its reason for the debug view.
  - **Spatial index.** `SIM.newGrid(8)` is a hash grid of 8 m cells with add, move, remove and radius queries. It replaces every all-against-all scan: creature push-apart, perception and calls for help.
  - **Camp populations (§16).** `SIM.newCamp`.
    - When the last member dies, the camp is cleared and the time is recorded. Nothing returns for its recovery time; then one member (or pair) returns per trickle interval until it is whole.
    - A member that leaves alive (tamed, sunk into its grave) never counts as a clearance.
    - Only the clearance record is saved.
- **The ecosystem in the game (`src/ecology.js`):**
  - **Species profiles as data (§9–10).** There are 27 profiles, one for every creature in `MON`. Each holds faction, habitats, hours, temperament, aggression, courage, intelligence, night vision, hearing, territory, pursuit limit, prey, social pattern, group size, retreat rule, flight distance, call radius, how long a meal lasts, respawn time, art source and sound set (with a note where a stand-in or silence is used).
    - **Sight is each creature's existing aggro radius**, so by day a creature notices the player exactly as far away as before.
    - Temperaments: *hostile* attacks its faction enemies on sight; *territorial* (boar, bear, snapper, crab, troll, ettin) attacks anything unfriendly within its aggro radius; *timid* (deer, hare) never starts a fight and flees.
  - **New wildlife.** These are drawn in code in the kit's palette, like the boar and the hound, and listed in the asset backlog:
    - red deer (herds of 2–4),
    - brown hare,
    - brown bear (solitary, territorial, hunts deer and hares, retreats at 15 %).
  - **Think (`ecoThink`, every ~0.5 s, staggered by id).** The creature asks the spatial index what is within its senses, then scores its options: attack an enemy, hunt prey (only when hungry), flee a threat, or carry on.
    - **Threats:** a predator that eats it; for timid creatures, anything not of their kind inside the flight distance. A creature with a retreat rule also flees a fight it cannot win and runs when badly wounded.
    - **Commitment:** it commits through `SIM.decide`, and the chase keeps its target's last known position.
    - **Calls for help:** its own kind or camp within the call radius join the fight, and a herd bolts together.
  - **Idle (`ecoIdle`):**
    - It roams inside its territory while active and stays close to home while resting. Undead roam 1.6× wider at night. Creatures sleep in their hours.
    - A predator stays at its kill to feed for 12–20 s, then is sated for 5–10 minutes.
    - **Packs and herds** follow a leader. A follower far behind catches up on the navigator, and when the leader chases, the pack joins in.
  - **Hunting.** A hungry hunter tracks prey by scent within its hearing. It may run twice its normal pursuit limit, puts on a 25 % burst, and keeps after fleeing creature prey through its wind-up (a pounce).
    - Fleeing prey sprints for 3 s, then tires to 70 %.
    - None of this applies against the player, who can still sidestep a telegraph.
  - **Pursuit limits (§14).** A creature gives up beyond its pursuit limit from its home (or from where its sortie fight started). A creature that is far from home walks back on the navigator, in legs of at most 50 m. Creature trips never build the continent travel graph.
  - **Populations (§15):**
    - **Wilderness regions by habitat.** The world is divided into 150-tile cells. Each cell is classified from its own tiles as forest, plains, swamp or mountain and gets a wildlife mix from the seeded stream `population`, so the map is byte-identical. Predators never appear in the Saltmarsh starter slice or in a cell with protected ground.
    - **Regions for the existing spawners:** camps, graveyards, dungeon levels and the old wilderness points.
    - **Spawning** happens only inside the habitat, on walkable, unprotected ground of the right level, with nobody standing there. It never happens within 22 m of the player (12 m at boot), so there is no pop-in.
    - **Respawn** follows each profile's pace instead of a flat 6–12 s. Regional caps are the sums of their spawners' caps.
  - **Camps (§16):**
    - The eight camps and the two guarded dungeon mouths are persistent: cleared stays cleared for 25 minutes (15 for mouths), then members return 75 s apart. The clearance survives a reload.
    - **Sorties:** orcs patrol 45 m down their trail toward the road and back; bandits go to the road, hide and watch for 45 s, then return; wolf packs at the den hunt 30–60 m out. Patrols stay on task (no hunting on the way) but break off to fight an enemy.
  - **Graveyards rise at night.** The Ashen Barrows and the other skeleton spawners hold 1.5× their daytime dead from sunset to dawn. At dawn the extra dead walk back to their graves and sink out of sight, never in view of the player.
  - **Creature-against-creature combat** uses the same states and the same resolver as before, so a wolf's bite on a deer is the same blow as a wolf's bite on you. A kill by a creature leaves an ordinary corpse with loot, and the log mentions it only when it happens near you.
  - **A first simulation tier.** An idle creature more than 80 m from the player (Manhattan distance) thinks and moves at a quarter rate. Creatures that are fighting, fleeing, on a sortie or following a sortie always run at full rate. Phase 6 formalises tiers A/B/C.
  - **Sound (§23):**
    - **Detection:** a creature's alert plays when it first targets prey or an enemy. A creature spotting the player plays its alert as before.
    - **Calls and howls:** a nearby idle creature calls rarely, at 30 % gain, at most one call every 4 s anywhere. At night a wolf or hound may howl within 55 m, at most one howl every 25 s.
    - **Stand-ins (documented):** dire wolf uses the marsh hound's takes, bear the boar's, giant spider the mire spider's.
    - **Silent species:** deer, hares, slimes, orcs, lizardmen, harpies, trolls, ettins, gargoyles, elementals and humanoid bandits. They stay silent rather than borrow a wrong sound.
    - The timing of idle sounds uses its own audio-only random stream, so sound never changes the simulation.
  - **Developer panel (`?dev`):**
    - Creatures by faction; regions by kind with counts and caps; every camp (alive / cap, cleared with time left, recovering, on a sortie).
    - Ecosystem counters: hunts, creature fights, flights, deaths, sorties, camps cleared, dead sunk, think cost.
    - A faction matrix toggle.
    - The inspector adds a creature's faction, temperament, activity, current decision and its reason, senses and how many actors it perceives, hunger, pack and leader, camp, region, art source and sound mapping.
    - The perception overlay draws sight and hearing as they are now (night and sleep included); the territory overlay draws territory and pursuit limit.
- **Changed in the existing game:**
  - `killMon` only says "You slay…" and selects the corpse when the player, a pet or Wren made the kill.
  - A tamed creature leaves its spawner and camp cleanly.
  - `rmEnt` keeps the index and the spawner counts right.
  - `navTo` builds the travel graph only for long journeys.
  - **Save:** a small `eco` block holds the camp clearances. The save version stays 6 because the change is additive: older saves load unchanged and older builds ignore the block.
- **Not in this phase (stays planned):**
  - Goblins, zombies, dragons and drakes (no art).
  - Orc roles (scout, archer, captain, shaman) and Lich commands, which need Magery for NPCs (phase 5).
  - Bandits stealing cargo and stockpiling supplies (phases 5 and 7).
  - Separate volume sliders (Master, Music, Ambient, Combat, Monsters, Footsteps) and environment ambience profiles (birds, insects, owls, groans): there are no takes for most of them yet.
  - Individual creatures are still not saved: they respawn on load, except that cleared camps stay cleared. Full world-state persistence is phase 6.

### Tests

- `node tests/world.test.js`, 126 checks (40 new):
  - Factions: the spec's example pairs, undead against the living, dragons against all, levels, rejection of unknown relationships, a symmetric matrix, all of the spec's initial factions.
  - Activity hours for day, night and dusk creatures.
  - Perception: night with and without night vision, sleep, rest and alert, seen versus heard, hidden targets.
  - Decisions: best choice, commitment, hysteresis, impossible acts dropped, forced acts, no oscillation between two noisy close options over 60 s, reasons kept.
  - The spatial index: exact against brute force before and after moving 300 of 600 entities; exact removal.
  - Camps: fill to cap, no clearance from losses or live departures, clearance on the last death, recovery time, save and load, trickle, recovery always ends.
- `python3 tests/world-smoke/phase3.py` (called by `world-smoke/run.py`), 34 checks in Chrome. It is seeded, so every scenario plays out the same way each run.
  1. **Data:** all 27 creature types have a full profile. Every sound mapping points at real takes, and stand-ins and silences are documented. The faction of each actor kind is right.
  2. **Populations:** 104 regions (forests, plains, mountains, swamps, camps, graveyards, dungeon levels).
     - 475 creatures at boot, among them 94 deer, 137 hares, 30 wolves and 15 bears.
     - No spawner is over its cap, and every creature stands on walkable, unprotected ground.
     - No predators in the Saltmarsh slice.
  3. **Predator and prey:** a wolf pack kills a deer with no player involved. The herd bolts together, the killer feeds, and the deer never fight back.
  4. **Factions at war:** orcs and skeletons fight on their own; no crime is recorded; each creature changes its mind at most a few times.
  5. **Timid wildlife:** a deer bolts from the approaching player at once, runs about 30 m, never attacks, and returns home once the player is gone.
  6. **Perception:**
     - A boar notices you at 4 m at noon, but not at midnight.
     - A wolf sees you at 7 m in the dark.
     - A hidden player is not detected by an orc 3 m away; an unhidden one is.
     - A hare asleep at 02:00 senses 1.8 m against 9 m by day.
  7. **Graveyards:** 11 dead by day, 17 at night (the cap). At dawn the extra dead sink back. Skeletons are dormant by day and active at night.
  8. **Packs:** hurting one wolf brings the whole pack after you.
  9. **Pursuit:** a boar gives up 20.3 m from home (limit 20 m) and walks back.
  10. **Camps:** Kragmaw Camp full (6/6) is cleared with one `CampCleared` event.
      - Forced spawners do not refill it, and neither does a reload.
      - After its recovery time it refills 2 → 4 → 6 and is whole again.
  11. **Sorties:** an orc patrol of two goes about 45 m out, waits and heads home, or breaks off to fight. The travel graph is never built by creatures.
  12. **Spatial index:** it holds every live actor and answers 30 radius queries exactly.
  13. **Seeded multi-day run:** three in-game days on a 6-minute day (21,600 steps).
      - The population stays steady: 535 → 547 actors, peak 583, no spawner ever over its cap.
      - No species dies out.
      - The event log stays bounded, there are no stale targets, and every live id is unique and registered.
      - The ecosystem was busy: 14 hunts, 204 creature fights, 101 deaths.
      - About 0.5 ms per step, with no heap growth.
- **Regression.** Every suite was run on v0.25 and on v0.24 in the same container:

| Suite | v0.24 | v0.25 |
|---|---|---|
| `rules.test.js`, `magery.test.js`, `combat.test.js` | all pass | all pass |
| `world.test.js` | 86 pass (the 40 new checks need phase 3) | 126/126 |
| magery-smoke | `migration.py` failed once (unseeded fizzle, known) | pass |
| combat-smoke | 5 scenarios and the phone play-test pass; the old-save step cannot run (`main:Shardfall_v0.16.html` is not in a shallow clone) | the same |
| backpack-smoke | 32/32 | 32/32 |
| backpack icons | 31/31 | 31/31 |
| bestiary-smoke | 123/123 | 123/123 |
| anniabreen-smoke | all pass | all pass; all 19 timed routes identical to v0.24 to 0.1 s |
| sfx-smoke | 48/48 three times, 47/48 twice ("a whiff": a rat's first strike lands inside the window, known since v0.19) | 48/48 four times, 47/48 twice (the same check) |
| world-smoke (phase 1, phase 2, expansion) | all pass | all pass |
| world-smoke phase 3 | — | 34/34 (three full runs on the final build) |

  - **Test updates during the phase:** none of the old suites needed changing.
  - **Bugs found and fixed while testing:**
    - A creature lost the target it had just chosen for one step (a stale local variable in `aiMon`), so the first creature to decide in a pack turned back at once.
    - Creature journeys home built the whole travel graph, freezing the first frames for 3 s; they now use local paths only.
    - Cautious rats ran from the player in the starter fight; only species with a retreat rule are cautious now.
    - Roam targets drawn on a disc walked creatures off when tests fix the random generator; they are now drawn like the old wander.

### Decisions

- **A creature notices the player exactly as far away by day as before.** Sight is its existing aggro radius. Night, sleep and Hiding now shorten it, as the spec asks.
- **Rats, boars and the other old creatures still stand and fight the player.** Only species with a retreat rule (wolves, hounds, bears, bandits) decline a fight they cannot win or run when badly wounded. Deer and hares always flee.
- **The pounce and the prey's tiring apply only between creatures.** Telegraphs against the player are unchanged, so a player can still sidestep any creature's wind-up.
- **Wolves are the bestiary's dire wolves; bears are drawn in code** until a sheet exists (deer and hares have bestiary v1.1.0 sheets since v0.28.2).
- **Creatures respawn on load as before; camp clearance is the one thing saved now.** Saving every creature is phase 6 (§26).
- **The quarter-rate tier for distant idle creatures** is a stopgap so the larger population costs less than the old one did. Phase 6 replaces it with the spec's tiers A/B/C.

## Phase 5, step 4 — NPC death, bodies and looting, the first NPC outlaws (v0.39) — **Tested**

Branch `feature/living-world-phase5d`, on main at v0.37. This finishes phase 5.

### What was built

- **Death instead of knock-down** (`src/npcdeath.js` `npcDies`, called by `damageNpc` at 0 health). This covers townsfolk with a life, shopkeepers, guards and the travelling merchant, following the spec's death transaction (§20):
  1. Resolved once (a second killing blow does nothing).
  2. Movement, combat, errands and poison stop, and nobody keeps targeting the body.
  3. One `ActorKilled` event.
  4. `lawDowned` judges the killer, unchanged: an innocent killed unlawfully reports one murder, keyed by the time of death.
  5. Their negative-uid outfit becomes real items, together with a purse (their own `life.gold`, else a roll by profession, `SIM.npcdPurse`).
  6. `SF.deathTransaction` puts everything on a body (`npcBody`, owner = their actor id, 90 s loot rights, 12 min decay) drawn with their look.
  7. They leave `ents` and the registry.
- **Coming back**, as UO's vendors did. The same object (same id, name, home, shop and quests) is back at home after `NPCD.cfg.back` (600 s), with a fresh outfit (`npcArm`) and full health; `ActorReturned` is emitted. If you are watching the spot, the return waits up to `unseen` (120 s) more. Policy `'none'` keeps ordinary residents dead; shops, guards, the merchant, scholars and the innkeeper always return (`SIM.NPCD_ESSENTIAL`).
- **Looting crimes, one rule for every body** (`npcdLooted`): your body, an adventurer's, a townsperson's. Taking from an innocent's body inside its loot-rights window is a crime (`lawCrime(…, 'looting')`), for you and for NPCs, at most once per 10 s per looter. Take all now counts too; before this, it did not call the check.
- **The first NPC outlaws** (§19: "criminal NPCs may loot illegally and receive consequences"). Two archetypes on the adventurer controller (`SIM.ADV_STYLES.cutthroat / cutpurse`, roster `SIM.CRIM_ROSTER`) live at the Ashfen outlaw camp (`advGeo('camp')`, outside every jurisdiction, with its healer, fence and strongbox):
  - **Vesk, cutthroat** (`crimPreyFor`, `SIM.crimPrey`): at most once every `crimeGap` (240 s), and only when healthy, he attacks the weakest person in sight that he expects to beat (strength ratio < 0.8). Candidates are townsfolk (never guards), adventurers and you (`CRIM.cfg.preyOnPlayer`), and only outside every jurisdiction and protected ground, with no guard within 16 m. Each innocent he kills is a murder count against him: five make him red.
  - **Mott, cutpurse** (`crimBodyFor`, `SIM.crimBody`): robs the nearest fresh body worth robbing that he has not robbed yet, never under a guard's eyes. Both outlaws rob bodies.
  - **The law applies to them unchanged.** `lawGuardTarget` accepts NPC adventurers who are grey or red. Guards look for them as they look for creatures and for you (`lawOutlawSeen`). Witnesses react through `lawWitness`. Adventurers fight back while the law gives them the right (`advProvoked`). Attacking a grey or red outlaw is lawful. If Vesk kills you, the ghost window offers the murder report, using the path built in step 2.
  - **Everyday life** is the adventurer's: hunting around the camp, selling to the fence, banking in the strongbox, the camp healer when dead, and their bodies under the same rules.
- **Saved** in the life block's `npcd` (additive; the save version is unchanged): who is dead and for how long, and every NPC body with its items, time left and look. Rows are validated (`SIM.npcdBodyRows`: one per owner and time of death, known owners and items only, never an expired body). The save's uid counter counts the bodies' items. A knock-down saved by v0.30–v0.38 loads standing at a third of their health.
- **Also fixed:** adventurers and outlaws walk the last few metres to a body directly, instead of waiting for a background path search.

### Tests

- `node tests/npcdeath.test.js` (new, in CI): who comes back and when, purses, saved body rows, the outlaw archetypes and roster, whom a cutthroat preys on, which body a thief robs.
- `python3 tests/world-smoke/phase5_death.py` (new, called by `world-smoke/run.py`), 29 checks in Chrome:
  - death once with a body of real items and a purse, and one murder;
  - a creature kill is no murder; Take and Take all are crimes inside 90 s, and nothing is a crime after;
  - the return home, also when watched; the `'none'` policy; a guard's real glaive on his body;
  - the dead and their bodies through a reload, with the same uids and the uid counter ahead; an older save;
  - the two outlaws: Vesk preys, murders and robs; never inside a jurisdiction; guards against red and grey outlaws; you may attack a grey one lawfully; an adventurer fights back; Mott robs a body and every unit is accounted for; Vesk preys on a weak you and the report is offered;
  - `?crim=off`; 30 accelerated minutes with tiers on, with nobody late, lost or duplicated.
- `phase5.py` and `phase5_law.py` now test deaths where they tested knock-downs (a death at time 0, one death with one body, the return, the dead through a reload, a seeded day where nobody stays dead past their time, murders by killing). `phase5_adv.py` runs with `?crim=off` so its roster checks stay about the six.

### Decisions

- **Everyone dies, everyone comes back.** Permanent death of named shopkeepers would break the game, and a knock-down that never kills does not match the spec's full-loot law. UO's answer was vendor respawn: the same person back after a while. `'none'` is there for a harsher world.
- **Townsfolk die inside towns too.** Only you (and now outlaws) can hurt them there, and the law already makes that expensive.
- **The victim still reports at once.** A dead NPC reports its own murder, as in UO. Witness-only reporting is not needed while every victim can report.
- **Outlaws live at the camp, not in town.** They sell, bank and heal there, so red outlaws are never forced into a guarded town.
- **Vesk preys on you as well.** That is the UO wilderness, and the reason to travel with care. `CRIM.cfg.preyOnPlayer = false` turns it off. He only picks people he expects to beat and never near guards, so a fresh character near town is safe.

### Not done yet

- NPC theft from packs (snooping and stealing from you or townsfolk), more outlaw archetypes, outlaw gangs, bounties.
- Creature corpses and merchant cargo through a reload (phase 6 step 2; NPC bodies are saved now).
- Blessed or insured items: the field exists, and nothing sets it yet.

## Phase 5, step 3 — NPC adventurers and NPC spellcasting (v0.36) — **Tested**

Built on `feature/living-world-phase6a` (v0.35, which already carries v0.34's law), so it uses the tiers and the law as they are. Master spec §8 (NPC adventurers — simulated players), §18 (NPC weapon attacks, archery, spellcasting, bandaging, potions, retreat, target changes, group assistance) and §20 for the adventurers' own deaths.

### What was built

- **Pure decisions in `src/world.js`** (tested in node, `tests/adventurers.test.js`):
  - `SIM.ADV_STYLES`: six archetypes from the spec's list (swordsman, mace fighter, fencer, archer, mage, healer) mapped onto the existing 49-skill registry, existing weapons and armour, a kit, a cloth colour and (casters) a spell list. No parallel skill system: every value is a UO skill on `SF.newSkills()`, inside the 700 skill and 225 stat caps.
  - `SIM.ADV_ROSTER`: Aldric (sellsword, Vespar), Brenna (mace fighter, Mynoc), Corvin (fencer, Mynoc), Dara (archer, Moonglen), Elsbeth (mage, Moonglen), Fenwick (healer, Vespar), each with a courage from 0.45 to 0.85.
  - `SIM.advChoose`: the strategic layer, about once a second. It returns `fight`, `flee` (hurt below `fleeAt × (1.6 − courage)`, or outmatched by `1.4 + 2.2 × courage`), `return` (out of bandages, arrows or reagents, hurt with nothing to heal with, a pack worth 300 gold, gear below 55 %, nightfall for the cautious), `town` (rest, sell, repair, restock; the cautious wait for daylight) or `hunt`. Errands it cannot pay for are skipped instead of waited on forever (`skip`).
  - `SIM.advTarget`: which creature, by threat (attacking it, attacking someone else), distance, vulnerability (wounded) and faction; it never starts a fight it expects to lose but always defends itself; ties break by id.
  - `SIM.advSpell`: Cure when poisoned; in a fight a mage keeps attacking (Energy Bolt → Lightning → Fireball → Magic Arrow, the strongest it will likely cast) and heals only below 40 %, a healer heals below 60 %, wards itself with Protection and keeps 25 mana for healing; between fights both top up with Heal or Greater Heal.
  - `SIM.advShopping` (what to buy within the purse, in priority order) and `SIM.advAfterDeath` (the resurrection policy).
  - Three event types: `SpellCast`, `ActorResurrected`, `CorpseLooted`.
- **`src/adventurers.js`** (new, built after `src/law.js`): the `AdventurerAI` controller.
  - **Actors.** Adventurers are people (`kind: 'npc'`, role `adventurer`, archetype `adventurer`), so everything built for people applies: the shared resolver, notoriety, witnesses, guards defending them, creatures targeting them by faction (`adventurers`, like you). Ids come from their names (`npc:aldric-sellsword`). Their items are real items with real uids (`SF.newItem` / `SF.EQ.fields`), so they can end up on a body and in your pack.
  - **Fighting.** Melee walks in and swings (`swingAt`); the archer stops to aim, uses arrows from its pack and gives ground when a creature closes in; the mage keeps 2–8 m away and wrestles only when cornered. They help you only when you are below 60 % health (your fights are yours) and never claim a creature you have hit. Ten seconds without a blow either way ends a fight it cannot reach (water, a wall, a creature that fled); it leaves that creature alone for a minute.
  - **Learning.** Every swing teaches its weapon skill by the player's rule (the hit chance is the challenge, `SF.SK.use`), each landed blow Tactics and Anatomy, parries Parrying, bandages Healing and Anatomy, casts Magery (in the circle's window) and Evaluating Intelligence, resisted spells Resisting Spells. Stats rise with them.
  - **First Aid and draughts.** Below 70 % (or poisoned, with 60/60) it applies a bandage with `SF.firstAidCheck` / `SF.firstAidResolve`: the same delays (15 s on yourself at these skills), slips when struck, the bandage spent at the start, the treatment re-checked at the end. Below 40 % it drinks a healing draught, then waits out its 16 s cooldown.
  - **Magery.** The book chance (`SF.MAGERY.bookChance`), the spell's mana and one of each reagent from the pack are reserved at the start of the cast; the cast time is the spell's; a blow interrupts it (reagents back, half the mana spent, `SF.MAGERY.interruptCost`, as for you). Direct spells fly with the spell's delivery delay and roll `SF.MAGERY.resolveHit` against the recipient's Resisting Spells with the caster's Evaluating Intelligence; heals, Cure and Protection use the same rolls as yours. A failed roll fizzles. Mana regenerates with Meditation (`SF.SK.manaRegen`), faster resting in town.
  - **The day.** Hunt → fight → loot → return → town → hunt. Hunting grounds are picked from living, non-boss creatures 30–180 m from its town that it can handle (creature difficulty ≤ its best skill + 5), preferring game that fights back, away from grounds other adventurers work, and never within 50 m of you (§17: off-screen adventurers must not strip the world). It searches each ground for 40 s, tries up to four, and remembers places it could not find a way to for half an hour. Twice without game in ten minutes, or every third trip with even odds, it moves on to another town (§8: travelling between cities).
  - **Looting.** Only its own kills (lawful): gold, its supplies and small goods worth at least 2 gold, within 60 kg. Bodies of creatures you damaged are never claimed.
  - **In town.** One errand every 2.5 s at the market: sell loot at half price, repair worn pieces (40 % of the price for the missing durability), buy back missing kit pieces, restock (`SIM.advShopping`), bank everything above 60 gold in the pocket. It rests until healed. The cautious sleep at the hall until 06:00.
  - **Death (§8, §20).** `SF.deathTransaction` moves everything tradeable onto one body (the snapshot of its look is taken first); creatures let go; the ghost cannot be targeted. Policy `ADV.cfg.res`:
    - `healer` (default): the ghost walks to the nearest healer and returns at 25 % health (after 240 s a healer finds it), walks back to its body and takes everything back. A body that is gone (decayed or looted) or out of reach for 150 s means the gear is lost: it buys a new kit from the bank.
    - `replace`: the ghost leaves the world; 600 s later a successor of the same calling (Garet, Hild, …) arrives in town.
    - `none`: death is final.
    Items only move, so resurrection never duplicates equipment.
  - **The law.** Adventurers are innocent. Attacking one is a crime (a swing that misses counts); it fights back while the law gives it the right, and the guards come for you. Killing one reports a murder. Taking from its body inside the loot-rights window (`SF.lootStatus`, 90 s) is a crime, logged as looting.
  - **Talking** gives a line about what it is doing; criminals and murderers get turned away.
  - **Saving.** The save's new `adv` block (additive; the save version is unchanged) holds every adventurer by id: position, vitals, stats, skills, equipment, pack, bank, record, poison, ghost state and its body with what is on it, plus the successors on their way and the ids gone for good. Their item uids count towards the save's uid counter. A save from before v0.36 starts with the six fresh. Positions are kept (they are individuals, not schedules).
  - **Cost and navigation.** Their journeys are single local searches sliced over steps, like the travelling merchant's, never the continent travel graph (its first build stalled the live loop for 3.5 s in this container). Tiers: never below B, like the guards. Measured on a fresh world in this container: 0.75 ms per step with them against 0.48 without (tiers on), 2.83 against 2.38 (tiers off). `?adv=off` leaves them out.
  - **Developer panel and inspector** show their mode and reasons, ground, vitals, top skills, purse, bank, supplies, record, what they are casting or tending; the panel adds a line of totals. The target frame shows their calling and what they are doing (and Ghost).
- **Small fixes in shared code:**
  - **Law core:** a record of someone fighting back in self-defence no longer gives the aggressor a right over them (`SIM.newLaw().rights`). Before, an innocent who defended itself became lawful prey for the one who attacked it. This is the UO rule and what the v0.34 doc describes ("they attacked you first").
  - **Wear messages:** only your own gear reports "badly worn" or "broken" in your log (`wear(it, amt, quiet)`); guards' and adventurers' armour used to write to it.

### Tests

- `node tests/adventurers.test.js Shardfall_v0.36.html` (new, in CI): roster and archetypes on the real skill registry and caps; every `advChoose` branch (fight, flee by courage, outmatched, each reason to go home, each town errand, waiting for daylight, unaffordable errands skipped); target choice (nearest, attacker first, wounded, helping, never a losing fight, self-defence, deterministic ties); spell choice (strongest likely spell, mana, chance, reagents, heal thresholds, Cure, range, the healer's ward and mana reserve); shopping; policies.
- `python3 tests/world-smoke/phase5_adv.py Shardfall_v0.36.html` (new; `world-smoke/run.py` runs it), 40 checks in Chrome: the roster at boot; 150 s of hunting (kills, both directions through the shared damage entry, lawful looting, skill gains); a bandage with a slip and a draught; the mage's casts, reservation and interruption; the healer healing itself; flight; the town errands; a death with one body and nothing left on the ghost, the ghost finding a healer and the body reclaimed with the same item uids; a lost body and a new kit from the bank; the law (crime, self-defence, murder, looting); save and reload of everything including a ghost and its body; an older save; the replace and none policies across a reload; `?adv=off`; tiers.
- Existing tests updated for the new rules: `phase6.py` exempts adventurers (never below B) from the distant-tier check, as it already did for the guards and the merchant. `phase3.py` and `phase4.py` (the ecosystem and town life on their own, with `?tiers=off`) now also open with `adv=off`: adventurers hunt those creatures and would change what they measure.
- `tests/soak/run.py --days 1` with adventurers: all checks pass (heap, actors, path queue and cache, logs bounded; no errors).
- **Regression in this container.** Every node suite and `check-build.py` pass, and every browser suite in the CI list passes except two timing checks with `?tiers=off`: phase 3's three-day "under 3 ms per step" (3.5 ms) and phase 4's "under 3 ms with town life" (3.7 ms). Both fail the same way on the unchanged v0.35 build in the same container (3.51 ms and 3.02 ms), so the machine is slower today than when v0.35 was measured; they now run with `adv=off`, so adventurers are not in those numbers.
- **Navigation:** adventurers' searches use a new background lane in `navTick` (`o.low`): it runs after the main queue with what is left of the step's budget, at most 800 nodes. Without it, a long adventurer search held up the creatures' and townsfolk's paths (phase 3's predator, return-home and leash scenarios failed); with it they pass.

### Decisions

- **Adventurers die like you, townsfolk are still knocked down.** The spec asks for adventurers to "lose appropriate equipment under the same death and loot rules that apply to the player", and those rules exist (Wren uses them). Townsfolk death, their corpses and looting stay in step 4.
- **Lawful only.** The thief and murderer archetypes need NPC crime (an NPC attacking you or a townsperson unlawfully, theft); that is step 4 / phase 7. Adventurers never start a fight with a person.
- **No dungeons yet.** The dungeon mouths are sealed until their interiors are built; adventurers hunt the wilds.
- **Economy as a ledger.** They buy and sell at shop prices without changing shop stock, like the townsfolk's hauls; prices and supply are phase 7.
- **Nobody starts in Skara Bryn**: few grounds around it can be walked to through its woods. They may still move there, and leave again if they find nothing.

### Not done yet

- Gathering resources, training at trainers, crafting and treasure hunting (archetypes from the spec's list that need those loops for NPCs).
- Pets for the animal tamer, songs for the bard.
- Recall and gates for long trips; boats.
- Adventurers fighting each other or grouping up.

## Phase 6, step 1 — Simulation tiers, the population saved, phone profiling (v0.35) — **Tested**

Built on a branch of its own (`feature/living-world-phase6a`) while phase 5 step 2 (criminality, v0.34) was being built elsewhere, then merged onto it. It touches neither law nor combat, adds its save data inside the existing `eco` block (the save version is unchanged), and leaves corpses, merchant cargo and NPC adventurers to phase 5 steps 3–4.

### What was built

- **Simulation tiers A/B/C (§25)**, replacing the phase 3 stopgap (idle creatures beyond 80 m thought at a quarter rate).
  - Pure rules in `src/world.js`: `SIM.TIER` (A 40 m, B 120 m, B at least A + 60 m, 6 m hysteresis, B runs one step in four), `SIM.viewRadius`, `SIM.tierRadii`, `SIM.tierOf`, `SIM.tierDue`.
  - **`src/tiers.js`** (new, built between NPC combat and the game). `tierStep(e, dt)` runs inside the controller dispatch in `update()` and returns the time the controller should simulate this step:
    - **A, local:** every step, as before. Radius A follows the camera: it is never smaller than the distance to the screen's farthest corner (with the renderer's culling margins) plus 8 m, so nothing on screen ever runs at a reduced rate. On a phone that is the 40 m minimum; on a 2560 × 1440 desktop it grows to 56 m.
    - **B, regional:** one step in four, staggered by id, with the skipped time handed over (at most 0.5 s at once).
    - **C, distant:** not stepped. A creature holds where it is; its spawner, camp and region books, the clock, populations and saving carry on for the whole world. A townsperson's day goes on abstractly: when it comes back into range its needs catch up on the hours it missed and it stands where its schedule has taken it (`lifeResume`, the rule used after a load). If that spot is near the player, it walks there instead, so nobody appears on screen.
    - **Always A:** the player, pets, summons, Wren, quest creatures, developer travellers, and anyone busy. A creature is busy when it is fighting, chasing, fleeing, hurt, poisoned, on a camp sortie or following one. An NPC is busy when it is knocked down, fighting, hurt or poisoned. A fight never runs at a reduced rate.
    - **Never below B:** the guards, who must answer a fight in their town, and the travelling merchant, whose journey is the content.
    - An actor's id, state and position never change on a tier change except by that schedule rule, so nothing is duplicated or lost.
  - The developer panel's tier line (left as "phase 6" in v0.22) now shows actors per tier, the radii and the wake-ups. `?tiers=off` runs every actor every step, for comparison.
- **The population is saved creature by creature (§26: regional populations, actor identity).**
  - Every creature a spawner made is one compact row in `eco.pop` (`SIM.packCreatures`): id, species, spawner, position, health, home, pack and leader, hidden, purse, last meal. About 80 bytes each: 923 creatures took 73 KB of an 86 KB save. Browser storage allows about 5 MB, so localStorage is still enough and IndexedDB is not needed yet.
  - Spawners get a stable key from species and position (`ecoSpawnKeys`), independent of the order they are built in.
  - On load, `populate()` calls `ecoRestore()` instead of the boot fill. The rows are validated first (`SIM.unpackCreatures`): an unknown species or spawner, a broken number, a repeated id or more creatures than a spawner holds are dropped and counted, never duplicated. Each creature comes back with its own id (`restoreId` → `WS.adopt` claims it), its pack and leader, and counted back into its spawner and camp. A creature whose ground is no longer walkable goes back to its spawner.
  - A region the player thinned out stays thin: vacancies refill at each spawner's own pace, out of sight, as always, not all at once on load.
  - Creatures in a fight are saved where they stand, calm (a reload ends fights, as before). Pets, summons and quest creatures keep their own save paths.
  - A save from before v0.35 has no rows and boots with a fresh population, as before. Older builds ignore the rows.
- **Phone profiling** (`tests/perf/phone.py`, a measurement, not a CI gate): phone screens (390 × 844 portrait and 844 × 390 landscape, device pixel ratio 3, touch), CPU slowed 4× and 6× through the DevTools protocol, Saltmarsh Quay and Vespar, noon and night, tiers on and off. Results under Performance.

### Tests

- `node tests/persist.test.js Shardfall_v0.35.html` (new, in CI), 27 checks. Tier radii from the screen; tier by distance; hysteresis at both boundaries (a walk out and back changes tier exactly four times; wobbling on a boundary never flips); B runs one step in four for every id, spread evenly. Population rows: the row format, a JSON round trip, stable re-packing, every kind of bad row dropped and counted, health clamped, 2000 rows for one spawner restoring only its capacity, the size of 1000 rows.
- `python3 tests/world-smoke/phase6.py Shardfall_v0.35.html` (new; `world-smoke/run.py` runs it), in Chrome at phone size:
  1. Tiers by distance (at the Quay: about 14 local, 38 regional, 966 distant); radius A covers the screen plus the margin; guards and the merchant never go distant; Wren is always local; a distant creature in a fight runs every step and drops back when calm.
  2. On a 2560 × 1440 screen radius A grows to 56 m.
  3. A distant boar holds for 10 s; with the player 60 m away it roams again. The player visits six places across the world: at every stop each actor is registered once, every spawner and camp count matches its live creatures, and no named actor is lost (about 200 wake-ups).
  4. Vespar's townsfolk, distant while you are at the Quay, wake when you come within regional range at noon: they stand where the noon schedule took them (all placed out of view), with six hours of needs caught up. Arriving in the middle of town at dusk, those whose evening place is near you set off on foot instead. The town carries on with every book straight.
  5. Persistence. One wild region is cleared and 25 creatures wounded, then the game is saved and reloaded:
     - all 923 creatures are back with the same ids, species, positions and health;
     - the cleared region is still empty;
     - 171 packs keep their members and leaders, and every camp keeps its count;
     - the books are straight and nothing is dropped;
     - vacancies refill gradually, and five minutes later the books are still straight;
     - the same save loaded twice gives the same creatures.
  6. A save with four bad rows (a repeated id, an unknown species, an unknown spawner, a broken number) drops exactly those. A save from before v0.35 boots with a fresh population.
  7. Cost on a seeded world at the Quay: 0.41 ms per step with tiers, 2.26 ms without (desktop, this container).
- **Long run** (`tests/soak/run.py`, 3 game days with tiers on, the player moved between towns, camps and the wilds, saved and reloaded half way, so the population went through a restore): all checks pass. Step mean 0.43 ms (worst hourly p95 1.1 ms; earlier soaks without tiers ran around 1.3–1.8 ms). Actors stay at 1,020–1,027 (945–951 creatures). The heap does not grow (first quarter 87 MB, last 85 MB). Path queue, cache, log and effects stay bounded. No page errors (the only failures are Google Fonts requests this machine cannot reach).
- **Regression on v0.35** (phase 6 merged onto v0.34). Every node suite and `check-build.py` pass. Every browser suite in the CI list passes in this container: world-smoke has 209 ok, including phase 5's law suite with tiers on and phase 6's 31 checks.
  - creation-smoke failed once, then passed 2/2 reruns. The check "fighting raises Strength or Dexterity naturally" counts every "rises to" line in the journal, including one the scenario before it may write after its unseeded rat fight. That is a test flake, not a tiers issue.
- Existing scenarios that test whole-world rules wherever the player stands (`world-smoke` phases 3, 4 and 5: three-day ecosystem runs, a whole town's day watched from the Quay, guards fighting in Vespar while the player is elsewhere) now open with `?tiers=off`. What they test runs at full rate around the player, where tier A changes nothing. Phase 1's wandering boar is now picked inside regional range, and its reload check now expects saved creatures to keep their ids while new ones take fresh numbers.

### Decisions

- **Distant creatures hold rather than move abstractly.** Their idle roaming is invisible, and their hunger, camp and sortie timers run on world time, so nothing piles up. Distant predator and prey encounters, and fights between camps, wait for phase 7's bounded encounter resolution.
- **Townsfolk follow the schedule, not their path.** A townsperson coming back into range is placed by the clock, as after a load, which is cheap and always consistent.
- **Guards and the merchant are never distant.** There are only ten of them, and they are the ones whose absence a player would notice.
- **Tier A is the screen, not a fixed radius**, so a big monitor never shows stepped movement.
- **No save version bump.** The creature rows are additive inside `eco` (v2), like the camp clearances in v0.25. This also keeps phase 6 clear of phase 5 step 2's save changes.
- **Corpses, cargo and NPC adventurer state** are left for when phase 5 steps 3–4 create them. Player corpses and dropped piles were already saved.

### Not done yet (phase 6)

- World-state save of NPC corpses and merchant cargo (after phase 5 steps 3–4); significant world events in the save.
- Rendering on phones: see Performance. The simulation is no longer the cost; drawing is.
- Tier C encounter resolution for creatures (phase 7 overlaps).

## Phase 5, step 2 — Criminality and murder (v0.34) — **Tested**

### What was built

- **The pure law core, `SIM.newLaw` (`src/world.js`)**, deterministic and tested in node. Actors are ids and time is simulation seconds, which only run while the game runs, so every duration is *active* time.
  - **Notoriety** (`notoriety(id, t)`): innocent (blue), criminal (grey: a timed flag), murderer (red: five or more long-term counts). Green and orange are reserved in `SIM.NOTORIETY` for guilds and legal enemies.
  - **Aggression records** `{ attacker, victim, owner, victimOwner, t, region, lawful, selfDefence, expires }`. Repeated swings refresh one record. An attack is lawful when the victim is grey or red, or when the attacker has a **right** over the victim: the victim attacked them (or their pet or summon) and that record has not expired (120 s). A pet's or summon's unlawful attack flags its owner.
  - **Crimes**: an unlawful attack or `crime(id, t, what)` (theft) sets the criminal flag for 120 s (`LAW_DEFAULTS.criminal`).
  - **Murder counts**: `murder(killer, victim, t, key)` counts only if the killer had no right over an innocent victim, and only once per death key. A count is short-term for 8 h and long-term for 40 h (`shortDecay`, `longDecay`); `red` (5) long-term counts make a murderer. `count()` adds a count for a death judged earlier (a report).
  - Save and load (expired records dropped, damaged values cleaned), `prune`, counters. Every number is in `SIM.LAW_DEFAULTS` and can be overridden per law (`SIM.newLaw(saved, cfg)`).
- **`src/law.js`** (new, after NPC combat) connects it to the game:
  - **Who has notoriety:** you and the 37 townsfolk with a life. The camp fence (outlaw role) stays red, as the target frame already showed. Creatures, pets and Wren have none.
  - **Every swing at a person** (`swingAt`, before the hit roll, after legality and ammunition) records aggression; `damageNpc` records it again for any other path. `AggressionRecorded`, `CrimeCommitted`, `CrimeWitnessed`, `MurderReported` and `NotorietyChanged` events carry actor ids.
  - **Theft:** the existing `crime()` (Stealing caught in the act) now goes through the law. Quay folk, who have no life yet, still only shout.
  - **Witnesses:** a townsperson up and within 14 m in sight of the offender (and always the victim) remembers "saw a crime by", flees (the phase 4 danger response) and shouts; one cry brings the two nearest free guards (`npcCallGuards`, now for you as well as creatures). Victims and witnesses refuse to talk or trade with you for 10 minutes (`lawRefuses`, called first in `talk`).
  - **Guards against you:** `guardFightTick` treats you like a creature when the law allows it (`lawGuardTarget`: you are grey or red, or you attacked that guard). He engages when he sees you inside his jurisdiction (16 m, line of sight) or is called, fights with the shared resolver, and stops with `CombatEnded` `won` (you died), `lost sight` (hidden, out of sight 6 s, out of the jurisdiction) or `pardoned` (your flag ran out and you are not red).
  - **Murder:** until step 4 gives townsfolk real death, an NPC knocked down by someone with no right over them reports a murder at once (`lawDowned`; key = actor id + time of the fall, so two killing blows on one fall count once).
  - **Murderers:** guards attack them on sight in town even with no criminal flag; every townsperson with a life refuses them. Long-term counts fade after 40 hours of play, and red with them.
  - **Murder reports for you:** if an NPC kills you with no right over you, the ghost window shows *Report murder by …*; it counts once. No NPC can do that yet (guards only attack lawfully); the path is tested by staging the record.
  - **UI:** names over heads and the target frame use notoriety colours; the target frame adds *Criminal* / *Murderer* and *⚔ Attacking* chips. Your name under the portrait turns grey with the seconds left (*Tess · criminal 87 s*) or red (*Tess · murderer*). **Attack** on an innocent warns and arms only on a second press within 4 s; aim assist never picks a person. The help page has a Law paragraph.
  - **Developer panel:** a law line (your notoriety, counts, records, aggressions, crimes, murders, reports, witnesses, refusals, pardons); inspecting an actor shows its notoriety and counts.
- **Saved** in the life block as `law` (records, flags, counts, handled deaths, counters), additive; the save version is unchanged. A new character starts with a clean record. A pending ghost report is saved with the character.

### Tests

- `node tests/world.test.js Shardfall_v0.34.html`: 29 new law checks (defaults, flags and their expiry, merged records, self-defence and its expiry, pets and owners, theft, murder once per death, no murder in self-defence or of a criminal, red at five, short and long decay, reports, save and load, damaged saves, event types).
- `python3 tests/world-smoke/phase5_law.py Shardfall_v0.34.html` (also run by `world-smoke/run.py`), 20 checks in Chrome at phone size:
  1. Everyone starts innocent and blue; the fence is red; creatures have no notoriety.
  2. Attack on an innocent warns, then arms on the second press; arming alone is no crime; aim assist never picks a person.
  3. A swing at Old Tomas is an unlawful record (region Vespar) and a crime; you are grey for 120 s with the time on your name; he flees and remembers; Lise, 4 m away, witnesses it; a guard comes and his lawful blows land on you (about 1.2 s).
  4. Hiding: the guard reports `lost sight` and returns to the patrol. After 120 s you are innocent again (event and log line) and a guard beside you leaves you alone.
  5. Hitting back at someone who attacked you: no warning, lawful self-defence, no flag.
  6. Caught stealing from Merrin: criminal; she refuses to trade.
  7. Five innocents knocked down: five reports, one count each even with two killing blows; red, with a log line and a red name.
  8. 130 s later (no flag left) a guard still attacks the murderer on sight (`a murderer in town`) and a shopkeeper refuses.
  9. Counts and red survive save and reload.
  10. Killing a rat records no aggression and no crime.
  11. Killed unlawfully by a guard (staged): the ghost window offers the report, it counts once and the button goes.
- `tests/world-smoke/phase5.py` check 4 now expects your blow to reach the townsperson (it asserted the old "you cannot hurt townsfolk").
- Regression on v0.34: `check-build.py`, all 12 node suites and all 16 browser suites of CI pass (world-smoke 178 ok, including phase5_law.py).

### Decisions

- **A knock-down is the death, for now.** Murder counts need deaths, and townsfolk only fall until step 4. When they can die, `lawDowned` moves to the death transaction unchanged.
- **Attacks on townsfolk are allowed inside towns.** Protected ground still keeps creatures from targeting anyone and keeps your gear on death; it never made you immune to the law. Guards answer only inside a town's jurisdiction (60 m of its centre).
- **Only townsfolk with a life can be attacked.** The Quay wardens, healers and other placed NPCs have no fighting profile yet.
- **Spells and pets do not reach townsfolk yet.** Spell targeting (`isLiving` in `src/magic.js`) and the pet *attack* order still accept creatures only, so an area spell cannot make you a criminal by accident. The law already handles owners (`owner` on the record) for when they do.
- **Guards are strong, not instant.** They fight criminals with the shared rules (halberd, 90 skill, 147 hp); a guard you attacked first may be fought back lawfully (his attack gives you no new flag).
- **The victim reports at once.** Every melee victim saw the attacker; witness-based reporting for deaths with no living victim comes with real death in step 4.

## Phase 5, step 1 — NPCs as combatants (v0.30) — **Tested**

### What was built

- **`src/npcfight.js`** (new, built between town life and the game). Everyone with a life (37 townsfolk: shopkeepers, residents, students, the travelling merchant and 9 guards) gets a fighting profile when the towns are populated (`npcArm`):
  - Profiles are data (`NPC_FIGHT`): guards have Strength 85, Swordsmanship and Tactics 90, a halberd and chainmail (coif, tunic, leggings), 1.6× normal health (147); miners carry a pickaxe, woodcutters a hatchet, the merchant a dagger; everyone else fights bare-handed in shirt and trousers (67 health).
  - NPCs fight like Wren: `fighter()` treats them as player-like, so weapon dice, skills, body-region armor, parrying, swing timer and stamina are the existing Second Age rules, unchanged.
  - NPC gear takes negative uids (`npcItem`), so it never touches the player's uid counter and is never in a player container. It is rebuilt at load and not saved.
- **Creatures may target townsfolk** (`ecoTargetable`): outside protected ground, an NPC that is up is a target under the same faction rules the player is (predators, vermin, arachnids, undead … are hostile to citizens, merchants and guards; wildlife stays neutral). Inside protected ground nobody is a target, as before; a creature after an NPC who reaches protected ground gives up (`aiMon`).
- **One damage entry.** `damageActor` sends NPCs to `damageNpc`: health, the `ActorDamaged` event with source id, floater, impact sound. Creature venom poisons NPCs and ticks like Wren's.
- **Townsfolk run.** A hit townsperson drops the routine at once and shelters (phase 4's danger response), shouts for the guards, and remembers "attacked by" the creature; the merchant hurries on.
- **Guards fight back** (`guardFightTick`):
  - Twice a second each guard looks for a creature that is fighting a person (a townsperson, the merchant, you or Wren) within 16 m, in sight and within 60 m of the town centre (the jurisdiction), or a hostile creature right beside him.
  - A cry for help reaches the two nearest free guards within 30 m (48 m for the victim's own town).
  - He leaves the patrol, walks up, swings his halberd through `swingAt`, and gives up when the creature leaves the jurisdiction (+12 m slack), has been out of sight for 6 s, or he is below 20 % health. Then he returns to the patrol.
  - `CombatStarted` and `CombatEnded` (`won`, `withdrew`, `lost sight`) are emitted with actor ids.
- **Knocked down, not killed.** At 0 health an NPC falls (drawn lying down), exactly once; `CombatEnded` with outcome `downed`, no `ActorKilled`. Creatures lose interest. After 60 s (`NPC_DOWN_TIME`) they get up with a third of their health and go home to recover; health then comes back over about four minutes. Real NPC death, corpses and looting are step 4.
- **You cannot hurt townsfolk yet.** Blows and spells from you, Wren, pets and summons do nothing to NPCs until the law (criminal flags, murder counts, guards against you) exists in step 2. The Attack button still only arms on creatures.
- **Saved:** an NPC's health and the time left on a knock-down, by actor id, in the `life` block (additive; save version unchanged).
- **UI:** the target frame shows a hurt NPC's health bar, *Knocked down* and *⚔ Fighting*. Talking to a knocked-down NPC says they cannot talk. The developer panel has a line of NPC combat counters (`NPCF`).

### Tests

`tests/world-smoke/phase5.py` (also run by `world-smoke/run.py`), 16 checks in Chrome at phone size:

0. A townsperson knocked down at simulation time 0 stays down (found while testing: the knock-down time was the flag, so a fall at second 0 read as "not down"; the flag and the time are now separate).
1. All 37 townsfolk with a life have a profile at full health; 9 guards with halberds and chainmail (147 hp against 67 for a townsperson, weapon skill 90); NPC gear has unique negative uids, none in the player's containers; actor ids unchanged.
2. Inside protected ground a townsperson is not a target. Just outside Vespar a marsh hound targets a townsperson and its blows land through the shared entry; she is frightened, remembers the attacker and shouts for the guards.
3. A Vespar guard 7 m away steps in within 0.5 s of a marsh hound attacking Old Tomas, kills it with his halberd through the shared resolver (one `ActorKilled`, killer = the guard), reports `won` and returns to the patrol.
4. You cannot hurt a townsperson. At 0 health he is knocked down exactly once (two killing blows: one `downed`, no `ActorKilled`), the creature loses interest, he stays down for the down time and gets up with a third of his health.
5. Through a reload, a hurt townsperson keeps her health and a knocked-down one stays down for the time left.
6. A seeded accelerated game day with the ecosystem awake: nobody stays down past the down time, health always valid, no page or console errors.

Regression on v0.30: every node suite, `check-build.py` and every browser suite pass (world-smoke 158 ok, including phase 3's seeded three-day run; magery-smoke and sfx-smoke each failed once in the first full run on their known intermittent checks — a random fizzle and the door-close debounce — and passed on two reruns). Step cost rose about 0.1 ms (townsfolk are now in creature perception and guards scan twice a second).

### Decisions

- **Knock-down instead of death** for now: killing named shopkeepers, bankers' neighbours or the merchant needs a decision about permanent loss, replacements and corpse looting (step 4).
- **The player cannot harm NPCs** until step 2 adds unlawful aggression; otherwise a stray area spell would hurt townsfolk with no consequence.
- **Guards fight with the shared rules, not UO's instant-kill guards.** A guard is a strong fighter, not invulnerable; town protection still comes from protected ground.
- **Natural fights near towns are rare.** Hostile spawns stand 28 m back from protected ground and most townsfolk stay inside it, so in a seeded day a townsperson is attacked only now and then, mostly the merchant on the cart road and workers at the edges. Making the edges more dangerous is a balance choice left for later.

## Phase 4, part 2 (v0.28) — **Tested**

### What was built

- **All four Anniabreen towns live** (`LIFE_TOWNS`).
  - **New schedules (all valid over 24 h):**
    - *innkeeper*: open 09:30–01:00, living in at the inn.
    - *scholar*: library days, the inn in the evening.
    - *astronomer*: works 19:00–06:00 at the observatory, sleeps 06:00–14:00.
    - *student*: studies at the library, gathers in the evening.
  - **Live-in homes.** A town with no houses gives its people a home in their own workplace (Skara Bryn's shops and inn, Moonglen's inn and observatory) or in the hall (the college hall for students).
  - **Four new residents:** Bryn the forester and Ysolde the herb gatherer in Skara Bryn; Tibbet and Mira, students in Moonglen. Woodcutters leave the trees within 18 tiles of the town centre alone, so Skara Bryn's forester works the woods around the village.
  - **Buyers by product.** Ore goes to the mine stores; wood to the mine stores, the fletcher or the bowyer; fish to the fishmonger or the innkeeper. A sale happens within 3.2 m of the buyer, across the counter.
- **Memory of the player.** Talking to someone writes "talked with" you into their memory. After that, residents greet you by name, shopkeepers at their counter greet you (at most every two minutes), and a closed shop apologises by name.
- **Saved NPC state (`life` block in the save; save version unchanged, the change is additive).**
  - Saved: each townsperson's needs, memory, carried goods and purse; the town stores; the travelling merchant's town, trips and purse.
  - Positions are not saved: the schedule still places everyone on load.
- **Journey watchdog.** A townsperson whose journey has got no closer to its goal for 6 s gives up that path: within 4.5 m it counts as arrived, otherwise it tries again. A path still being searched is never counted as a stall.

### Tests

`phase4.py` now has 28 checks:
- 39 townsfolk with lives, including 2 innkeepers, the astronomer and 2 students; 13 residents.
- **The accelerated day:**
  - 10:00: all 12 shopkeepers and innkeepers at their counters, the astronomer asleep, five workers at work.
  - 03:00: all 26 day-folk asleep at home, while the astronomer is up through the night.
  - The stores receive ore, fish and wood from Mynoc and from Skara Bryn.
- Maeve's inn is open at 23:30.
- Lise greets you by name the second time you talk to her.
- After a reload, memories and stores are still there.

**Regression on v0.28:**
- Node: rules, equipment, magery, combat and world (140) all pass.
- Browser: equipment 67/67, backpack panels 97/97, backpack 32/32, icons 32/32, bestiary 123/123, magery-smoke, anniabreen-smoke, world-smoke 142/142.
- sfx 47/48: only the known "a whiff" flake.
- Combat-smoke: every scenario passes. The phone play-test timed out once on the "Bandage Wren" button and passed on both re-runs. The old-save step needs `main:Shardfall_v0.16.html`, which a shallow clone does not have.

**Performance:** 0.80 ms per step (v0.27: 0.67 ms), render 4.2 ms by day and 5.5 ms at night, start-up 2.28 s, heap about 67 MB.

### Integration (v0.26)

v0.26 merges phase 3 with the equipment and paper doll work (#19, which already contains the missing icons, #18). Both branches had been numbered v0.25.

- **Conflicts resolved:** `build.sh` (both new modules in the build order), `src/game.js` (the equipment v7 save carries the `eco` block, and `__SF` exposes both sets of hooks) and the README.
- **Fixed while re-testing the merged build:**
  - A patrol whose leader died left its camp unable to send another.
  - A camp whose members were all busy hunting waited 200 s before trying again; it now retries after 30 s.
  - Risen skeletons that could not reach their grave never sank at dawn; they now sink after 45 s, still out of sight.
  - Patrol legs now have time limits.
- **Every suite on v0.26:**
  - Node: rules, equipment, magery, combat and world all pass.
  - Browser: equipment-smoke 67/67, backpack panels 97/97, backpack 32/32, icons 32/32, bestiary 123/123, magery-smoke, anniabreen-smoke, sfx 48/48, and world-smoke 113/113 (phase 3 three more times).
  - Combat-smoke: as before, its old-save step needs `main:Shardfall_v0.16.html`, which a shallow clone does not have.

## Phase 4 — Living NPCs (v0.27) — **Tested**

### What was built

- **Pure core in `src/world.js` (tested in node):**
  - **Daily schedules.** `SIM.scheduleAt(blocks, hour)` looks up a block; blocks are `[from, to, act, place]` and may wrap midnight. `SIM.validSchedule` checks that the blocks cover all 24 hours with no overlap. `SIM.hoursUntil` measures the gap between two clock times.
  - **Needs (§7).** These are kept lightweight: hunger, fatigue, social and work run from 0 to 1. They rise with game hours and fall while the matching activity runs.
    - Hunger fills in about 9 waking hours; a midday meal resets it, and the evening gathering serves as supper.
    - Fatigue builds over about 17 waking hours; six hours of sleep restore it.
    - Safety is set by fright and fades within minutes.
    - `SIM.urgentNeed` picks the need to act on.
  - **Memory.** `SIM.newMemory` is a small ring of significant encounters (who, what, where, when). A repeat with the same actor updates the newest record, so the ring stays meaningful and bounded. It can be saved.
- **Town life in the game (`src/townlife.js`):**
  - **Scope.** Vespar and Mynoc live fully (the spec asks to start with one town). In all four Anniabreen towns the guards patrol. Bankers, healers, ferry and boat crews and Saltmarsh Quay keep their posts around the clock, so the bank, resurrection and travel never close.
  - **Homes and workplaces.** Each scheduled townsperson lives in a house or cottage of their own town; several may share one, each with a spot of their own. Their workplace is their old post, so trading happens exactly where it did before.
  - **Professions and schedules (all valid over 24 hours):**
    - *shop*: tailor, tinker, supplies, fishmonger, mine stores.
    - *smith*: the forgemistress, on the spec's blacksmith day: up 05:30, forge 06:00–12:00 and 13:00–17:30, the yard 17:30–20:00, home, asleep at 22:00.
    - *miner*, *woodcutter*, *fisher*: gather, carry the haul to the buyer, eat, gather, sell, meet, sleep.
    - *dockhand*.
    - *townsfolk*: home, market, hall.
  - **Residents (9 named, stable ids, civilians).**
    - Vespar: Nell the fisherwoman, Garrick the dockhand, Lise, Old Tomas and Corin.
    - Mynoc: the miners Durn and Kessa, Fennick the woodcutter, and Mabry the cook.
  - **Places:**
    - home; work; the hall for meals and the evening (Vespar's hall, Mynoc's forge yard); the market for strolling.
    - The field: a stocked rock face in Mynoc Mine, a stocked tree outside town, or a spot on Vespar's harbour pier.
    - The buyer: the mine stores, or the fish hall.
    - Shelter.
  - **The controller (CivilianAI, MerchantAI and GuardAI now run `lifeTick`).** Every ~1 s each townsperson scores its options and commits through `SIM.decide` (20 s commitment):
    - the schedule block;
    - shelter, when a hostile creature is in sight within 12 m (forced; the fright and the creature go into memory);
    - an early meal when hungry, an early night when exhausted, a trip to the buyer with full hands.
    - **Walking.** Journeys use the phase 2 navigator as one local search, sliced over steps and never the travel graph (`navTo(..., { direct: true })`). Townsfolk open and close doors.
  - **Real resources.** A miner's stroke takes one unit from the same node stock the player mines (`nodeStock`), so a face they work refills on the usual timer. A worker carries up to 8, sells them at the stores for the normal price, and the town's stores record the haul. Every stroke emits a `ResourceGathered` event and every sale an `ItemTransferred` event.
  - **Guards** walk a round through the shrine and doorways ringed around the town centre, pausing at each. From 19:00 to 06:00 the first guard of each town stands watch at its post. They note the creatures they see; responding is phase 5.
  - **Tobin, the travelling merchant.** He sells for one in-game hour at a market, then crosses to the other town by the cart road, setting out only between 06:00 and 17:00.
    - On the road he only talks. If a hostile creature is within 14 m he hurries (35 % faster) and remembers it.
    - Arriving emits `MerchantArrived`. He spends the night at the market town.
    - His route is one sliced local search of up to 400,000 nodes, so even the long trip never builds the travel graph.
  - **Shop hours.** At the counter in working hours, a shopkeeper trades as before. Asleep, they say so. Elsewhere, they tell you when the shop opens. Residents answer with what they are doing, or with a warning if they recently saw something dangerous.
  - **Resuming.** At boot and after a load every townsperson is placed where the clock says they should be, so the day resumes instead of restarting. Individual NPC state (needs, memory, carried goods) is not saved yet; that is phase 6.
  - **Crowding (§14).**
    - Meal, evening and market spots are chosen to avoid other townsfolk.
    - At a doorway the later walker waits up to 1.2 s for the earlier one.
    - Townsfolk push apart through the spatial index.
  - **Developer panel.** A town-life line shows who is doing what, the trader's state and trips, the town stores, frights, strokes and sales. The inspector adds profession, schedule block, what they are doing, the decision and its reason, needs, home, workplace, carried goods, gold and recent memory.

### Tests

- `node tests/world.test.js`, 140 checks (14 new):
  - The spec's blacksmith day is valid, and a gap or an overlap is rejected.
  - Block lookup, including blocks that wrap midnight.
  - Needs rise, fall and stay within bounds; a fright makes safety urgent and fades.
  - Memory merges repeats, keeps the newest records, and survives save and load.
- `python3 tests/world-smoke/phase4.py` (called by `world-smoke/run.py`), 25 checks in Chrome:
  1. **Population:** 25 townsfolk with lives (6 shopkeepers, 9 residents, 9 guards, the trader). Every home is a house in the right town and every schedule is valid. Ids and archetypes are stable, and service NPCs have no routine.
  2. **A full accelerated day:**
     - 10:00: all six shopkeepers at their counters and the four workers at work.
     - 12:36: 13 at the midday meal. 19:00: 14 at the evening gathering.
     - 23:30 and 03:00: all 15 asleep in their own homes.
     - No journey failed and nobody was stranded. Needs and memories stay bounded. The stores received ore, wood and fish.
  3. **Shop hours:** Merrin sells at 09:30. At 23:24 she is asleep and the shop does not open. The bank opens at night.
  4. **Resource workers:** a miner takes strokes from a real rock face in Mynoc Mine (its stock falls; miners work the deepest faces first), and with full hands carries the ore to the stores and is paid.
  5. **Guards:** each Vespar guard walks the whole six-point round by day. At night one stands watch at the post while the others patrol.
  6. **Trader:** Tobin crosses between the towns by the cart road (about 3 minutes) and raises a `MerchantArrived` event. His shop opens only at the market, he does not set out after dark, and no travel graph is built.
  7. **Danger:** Fennick sees a wolf, heads for shelter and remembers it; once the wolf is gone and the fright fades he goes back to work.
  8. **Crowds:** 15 townsfolk at the evening gathering stand at least 0.5 m apart.
  9. **Reload:** after a reload at 23:30 all 15 are at home at once, with the same ids.
  10. **Cost:** under 1 ms per simulation step.

- **Regression.** Every suite on v0.27:
  - Node: rules 33, equipment 91, magery 57, combat 79 and world 140 checks, all passing.
  - Browser: equipment-smoke 67/67, backpack panels 97/97, backpack 32/32, icons 32/32, bestiary 123/123, magery-smoke, sfx 48/48, and world-smoke 139/139 (phases 1–4 and the expansion).
  - anniabreen-smoke passes, and all its timed walks match v0.26.
  - Combat-smoke: all scenarios pass, and the phone play-test passes on a re-run (the first run lost a random bandage roll). Its old-save step needs `main:Shardfall_v0.16.html`, which a shallow clone does not have.
  - **One test change was needed:** the first anniabreen-smoke run found the face nearest the Mynoc forge already mined out by the new miners. Miners now work the deepest faces first and leave the ones by the entrance to visitors.
- **Performance** (desktop, Saltmarsh Quay, average of 3): `update(0.05)` 0.67 ms (v0.26: 0.54 ms), render by day 3.8 ms and at night 5.0 ms, start-up 2.15 s (unchanged), heap after start about 65 MB (v0.26: about 51 MB; town geometry, node lists and 25 actors with schedules).

### Decisions

- **Two towns live fully; the others only patrol.** The spec asks to start with one town. Skara Bryn and Moonglen are the next step, using the same data.
- **Services never close.** Bank, healers, travel crews and Saltmarsh Quay keep their posts, so no player is ever stuck at night without a bank or a resurrection.
- **Shops keep hours.** This is the one deliberate gameplay change: trading at night now means waiting for the morning or going to a town without routines. Banks are unaffected.
- **Townsfolk cannot be hurt yet.** Creatures do not target NPCs, so fear is about reaction (shelter, hurrying, memory). Combat between NPCs and creatures, and NPC adventurers, are phase 5.
- **The stores are a ledger.** The haul is recorded, but shops still sell from fixed stock. Prices and supply come with the economy in phase 7.

## Implementation matrix (audit of v0.20 against the spec)

| Spec § | Area | What exists in v0.20 | Status (latest phase) | Next |
|---|---|---|---|---|
| 2 | Rules: no engine, offline, saves migrate | Single-file web build via `build.sh`. Works offline after load (`--offline` build embeds audio). Saves v1→v4 with snapshots. | Respected; save v5 | — |
| 3 | Actor architecture | `ents[]` of plain objects keyed by `kind` (`mon`, `npc`, `pet`, `ally`, `corpse`); player `P` separate; numeric per-session ids | **Tested:** stable ids, archetypes, controllers, optional components | Phase 4 adds civilian/guard/merchant ticks |
| 3 | Shared action services | One physical resolver (`swingAt`/`strikeOne` → `applyBlow`) for player, Wren, pets, creatures. Magery in `magic.js`. Bandaging, gathering, crafting are player-only. | **Tested:** shared damage entry `damageActor`, death once | Movement, gather, craft, loot and trade for any actor: phases 4–5 |
| 4 | Simulation/render separation, timestep, events, seeded RNG | `update(dt)` with frame dt (capped 0.1 s); `render()` separate; `R` swappable (`setRng`); world gen seeded (`mulberry(1999)`); no event log | **Tested:** events, seeded streams, deterministic harness (phase 1); fixed 50 ms step with interpolation (phase 2) | — |
| 5 | World clock | `hourOfDay()` = `(GT/60 + 9) % 24`: a 24-minute day, starting at 09:00. `GT` is saved, so time already persists. HUD clock exists. | **Tested** (phase 2): 120-minute day, periods, saved, HUD | Offline progression stays off (spec) |
| 6 | Day/night visuals | `darkness()` overlay with radial holes for the player, `LIGHTS` and blasts. Night Sight sets darkness to 0. Dungeons fixed at 0.8. | **Tested** (phase 2): tinted periods, local lights and glow, partial Night Sight, dungeons apart | Torch items and spell light radii when those exist; night gameplay in phase 3 |
| 7 | NPC life | 58 static NPCs (Saltmarsh + Anniabreen towns), roles, shops, dialogue lines; no movement or schedules | **Tested** (phase 4; all four towns since v0.28, with memory of the player and saved state): homes, workplaces, schedules, needs, memory, nine residents, resource workers on real nodes, shop hours, shelter from danger; guard patrols in all four towns; a travelling merchant | Saltmarsh Quay residents; the economy behind the stores (phase 7) |
| 8 | NPC adventurers | Wren: one hireling with skills, equipment, bandaging, ghost/resurrection, follow/wait | **Tested** (v0.36): six persistent adventurers (swordsman, mace fighter, fencer, archer, mage, healer) that hunt, fight, loot, bank, repair, restock, flee, travel between towns, die by the player's rules and come back (v0.39) two outlaws: a cutthroat and a cutpurse | Gathering, training, crafting, tamers, bardsers |
| 9–10 | Monster ecosystem | `MON` table (23 types) with aggro, leash, speed, loot, skin; `SPAWNS` point spawners with caps and respawn timers; `aiMon` idle/chase/telegraph/strike/recover/return | **Tested** (phase 3): 27 species profiles as data, temperaments, hours, prey, packs and herds, retreat, feeding; deer, hares and bears added | Goblins, zombies, dragons when art exists; orc roles and lich commands with NPC Magery (phase 5) |
| 11 | Factions | None; creatures target only the player, pets or Wren (or a provoked creature) | **Tested** (phase 3): 20 factions, five levels, symmetric table; creatures fight creatures; hostility is not a crime | Law and notoriety: phase 5 |
| 12 | Utility AI + state machines | `aiMon` state machine; no utility scoring, personality or hysteresis | **Tested** (phase 3) for creatures: scored options, commitment, hysteresis, forced retreat, reasons in the inspector | Townsfolk and adventurers: phase 4 |
| 13 | Perception | Aggro radius + `los()`; hidden player ignored; no hearing, sleep or night vision | **Tested** (phase 3): sight, hearing, night vision, sleep and rest, alertness, hidden targets, calls for help, scent for hungry hunters | Visible corpses and dangerous areas: phases 5 and 7 |
| 14 | Pathfinding | None: straight-line steering with a sidestep (`moveBy`); doors, bridges, stairs and moongates exist | **Tested** (phase 2): A* + travel graph, doors, stairs, boats, gates, stuck recovery, budget; (phase 3) creatures: pursuit limits, walks home and sorties in legs of at most 50 m, never the travel graph | Crowding at doors in phase 4 |
| 15 | Population | `SPAWNS` point spawners: Saltmarsh, Anniabreen (8: boars, rats, a cemetery pair of skeletons, hounds, snappers, spiders) and dungeon rooms; bestiary creatures have stats but no spawns | **Tested** (phase 3): ~100 regions by habitat, wildlife by habitat from a seeded stream, spawning out of sight on valid ground, profile respawn pace, regional caps, nothing dangerous in the starter slice | Persistence of individual creatures: phase 6 |
| 16 | Camps | Ashfen outlaw camp (static vendors, smugglers spawner) | **Tested** (phase 3): 8 camps and 2 guarded mouths as persistent populations; clearance saved, gradual recovery; orc patrols, bandit road watches, wolf hunting trips | Supplies, treasure, leadership: phases 5 and 7 |
| 17 | Dungeons | Sunken Bell, 3 levels, seeded rooms, Bellkeeper boss, chests, stairs; Mynoc mine first chamber | **Partial** (v0.23): 5 sealed mouths placed and reachable; interiors **Planned** | One step per dungeon interior |
| 18 | Combat between actors | Creatures ↔ player/pets/Wren; provoked creature ↔ creature | Shared entry **Tested** | Phase 5 |
| 19 | Criminality | Protected zones (`PROT`, guarded towns); theft/pickpocket and snooping exist for the player; no notoriety | **Tested** (v0.34): notoriety, aggression records with self-defence and expiry, criminal flag, theft, witnesses, guards in jurisdiction, murder counts with decay and reports, red restrictions. (v0.39): illegal looting for you and NPCs; NPC criminals (a cutthroat and a cutpurse) under the same law; guards fight grey and red NPCs | Green and orange (guilds); NPC theft from packs; more outlaws (phase 7) |
| 20 | Corpses, death, loot | `SF.deathTransaction` for player and Wren, creature corpses with loot rolls, decay timers, skinning, the player's corpse saved | **Tested** (v0.39): townsfolk, guards and the merchant die once with a body of real items and loot rights; NPCs loot lawfully (adventurers, their own kills) and unlawfully (outlaws) with consequences; NPC bodies saved with their contents and time left | Blessed items have a field but nothing sets it; creature corpses are not saved (phase 6 step 2) |
| 21 | Economy | Shops with fixed prices, resource nodes deplete/refill and persist, crafting consumes materials | Planned | Phase 7 |
| 23 | Sound | `SFXA` Web Audio player: buses, positional pan, priorities, area music, ambience per zone, footsteps by surface; volume/mute settings | **Implemented** (phase 3): alert on first sight of prey or enemy for every species with takes, documented stand-ins, rare idle calls, night howls; silent where no take exists | Separate volume sliders and environment profiles (birds, insects, owls, groans) when takes exist |
| 24 | Animation | Player: 8-direction walk/attack clips per weapon family. Rat and skeleton sheets. 11 bestiary sheets (walk, wind-up, impact; no death, cast, sleep). Other creatures procedural. | Untouched | Backlog below |
| 25 | Performance tiers | Whole-world update each frame; render culls to the viewport | **Partial** (phase 3): spatial index; distant idle creatures at a quarter rate | Tiers A/B/C, phones: phase 6 |
| 26 | Persistence | localStorage, one key, ~JSON; snapshots for v2/v3/premagery; nodes, player, pets, Wren, the player's corpses, door states | v5 (`sim`) **Tested** | Phase 6 |
| 27 | Debug tools | `window.__SF` test hooks; no panel | **Tested** (phase 2): `?dev` panel, inspector, controls, overlays; (phase 3) factions, regions, camps, ecosystem counters, decision reasons | Tier counts in phase 6 |
| 28 | First milestone | Two Anniabreen towns + road + forest + cemetery exist as map; nothing lives there yet | Planned | Phases 2–5 |

### Conflicts and risks found in the audit

- **Base branch.** The newest playable work is two unmerged PRs deep (#10 → #11). This branch adds a third. If #11 changes, rebase this onto it; the changes touch few lines outside `src/world.js`.
- **Time scale (resolved in phase 2).** The day is now 120 minutes as specified. Old saves keep their hour; the length is one setting (`SIM.CLOCK.dayMinutes`).
- **Night Sight (resolved in phase 2).** It is now partial, per the spec.
- **Ids versus ally `aid`.** Wren's `aid: 'wren'` (bandage links, body ownership) is kept as is. Her actor id is `npc:wren`.
- **Quadratic push-apart.** `aiMon` checks every entity against every other for push-apart. With 212 entities this is fine; at the spec's hundreds it is not. A spatial index is needed in phase 3.
- **Anniabreen was thinly populated** (v0.20). Since v0.23 it has camps and dungeon mouths; the populations behind them are phase 3.

---

## Asset inventory (for the population and animation phases)

- **Player:** one 8-direction atlas with walk and attack clips for Sword, Glaive, Hammer, Dagger, Unarmed, Shortbow and Crossbow. NPCs reuse it with tinted cloaks (`scoutSheet`). There are no death, cast, sleep or work clips; deaths cut to a corpse sprite.
- **Creature sheets:** rat and skeleton (`MON_SHEETS`).
- **Bestiary v1:** 11 sheets of 160×160 cells in 8 facings, with idle, walk, wind-up and impact. No death, sleep or cast frames. The creatures are orc, ettin, troll, lizardman, gargoyle, earth elemental, giant spider, dire wolf, harpy, slime and the Lich Lord (boss).
- **Bestiary v1.1.0 draft01 (v0.28.2):** 6 more sheets on the same grid and animations: reed boar, marsh hound, mud snapper, mire spider, red deer and brown hare. No death frames. `tools/embed_bestiary.py` merges both packs into one manifest.
- **Procedural creatures:** wreck crab, ash wisp, bell sentinel and the Bellkeeper, and brown bear (since v0.25). The drowned captain, brine smuggler and road bandit are tinted scouts. Boar, marsh hound, mud snapper, mire spider, red deer and brown hare moved to bestiary sheets in v0.28.2; their procedural art remains as the fallback while a sheet decodes.
- **Sound pack v1.0.0:** 107 events.
  - Creature sounds exist for rat, skeleton and hound (alert, attack, death), plus attack-only takes for boar, crab, spider and wisp.
  - Ambience: surf, wind, rain, hearth, gull, marsh, drip, bell and beacon.
  - Footsteps on 7 surfaces.
- **Music:** five Saltmarsh tracks, mapped to zones.
- **Gaps for the spec's roster (asset backlog):**
  - Bestiary v1.1.0, remaining sheets: bear, wreck crab, ash wisp, bell sentinel, drowned captain, the Bellkeeper, brine smuggler and road bandit (see `docs/art/BESTIARY_V1_1_AUDIT.md`). Later roster: zombies, dragons/drakes, fire and water elementals, goblins.
  - Death animations for everything.
  - Sleep/eat/work clips for townsfolk.
  - Owl, insect, howl and groan ambience.
  - Creature idle sounds (alert takes are used softly for now). Takes for dire wolf, bear and giant spider (stand-ins now), and for deer, orcs, lizardmen, harpies, trolls, ettins, gargoyles, elementals and slimes (silent now).
  - Until art exists, reuse is documented per species in the profiles (`ECO` in `src/ecology.js`: `art`, `snd`, `sndNote`): dire wolf for wolves, tinted scouts for bandits. Missing creatures are not spawned invisibly.

---

## Performance (desktop Chrome, this container, Saltmarsh Quay)

| Build | `update(0.05)` | `render()` by day | `render()` at night |
|---|---|---|---|
| v0.20 | 0.79 ms | 4.6 ms | — |
| v0.21 | 0.80 ms | 4.8 ms | — |
| v0.22 | 0.80 ms | 4.3 ms | 5.8 ms |
| v0.23 (256 entities) | 1.20 ms | 4.0 ms | 5.4 ms |
| v0.24 (256 entities, measured again for phase 3) | 1.21 ms | 3.5 ms | 4.6 ms |
| v0.25 (554 entities, 475 creatures) | 0.49 ms | 3.7 ms | 4.7 ms |
| v0.26 (556 entities, measured again for phase 4) | 0.54 ms | 4.0 ms | 4.7 ms |
| v0.27 (564 entities, 25 with routines) | 0.67 ms | 3.8 ms | 5.0 ms |
| v0.28.1 (≈1,020 entities, ≈945 creatures; update only, one run of 1,000 steps after boot, v0.28 in the same run: 1.04 ms) | 1.84 ms | — | — |
| v0.30 (≈1,050 entities; update only, 3 runs of 2,000 steps after 400 warm-up steps; v0.29.2 in the same run: 1.28 ms) | 1.39 ms | — | — |

| v0.35, tiers on (≈1,020 entities; seeded, 2,000 steps after 400 at the Quay; phase6.py) | 0.41 ms | — | — |
| v0.35, `?tiers=off` (the same run) | 2.26 ms | — | — |

- Each figure is the average of 3 runs of 4,000 updates and 200 renders.
- **v0.23 update cost.** It rose from 0.80 to 1.20 ms per step. This is the creature push-apart in `aiMon`, which compares every entity with every other: with 256 entities instead of 212 that is 1.46× the pairs, which matches the measurement. It is still far inside the 50 ms step, but it is the first sign of the quadratic cost the audit flagged. The phase 3 spatial index removes it.
- **v0.23 start-up:** 1.66 s to enter the world (was 1.0 s); about 72 MB of heap (was about 31 MB).
- Night costs the full-screen tint plus the cached light sprites. Before the sprites were cached it was 7.9 ms.
- **Path searches** are capped at 3,000 nodes per step. Twelve travellers starting at once stay under the cap, and their whole journeys cost about 0.7 ms per step on average.
- **The travel graph** is built once, in about 250 ms.
- **v0.25 update cost.** It fell from 1.21 to 0.49 ms per step although there are more than twice as many actors. Push-apart, perception and calls for help go through the spatial index, and idle creatures more than 80 m away think at a quarter rate. Near a busy camp everything runs at full rate; the seeded three-day run averaged about 0.5 ms per step.
- **v0.25 start-up:** 1.92 s to enter the world (v0.24 measured again: 1.65 s). The habitat survey and the larger first population add about 0.3 s. Heap after start: about 52 MB (v0.24: about 49 MB in the same run).
- **Phones (v0.35, `tests/perf/phone.py`).** These are emulated phones: Chrome in this container at device pixel ratio 3, with the CPU slowed down 4× and 6× through the DevTools protocol. There is no GPU here, so drawing is done in software and costs more than on a real phone. Each figure is the mean over Saltmarsh Quay and Vespar at noon and at night; p95 is the worst case seen.

| CPU | Screen | Step, tiers on | Step, tiers off | Draw | Frame rate |
|---|---|---|---|---|---|
| 4× | portrait 390 × 844 | 2.7 ms (p95 ≤ 8.8) | 11.8 ms (p95 ≤ 33) | 46–62 ms | 11–18 fps |
| 4× | landscape 844 × 390 | 2.7 ms (p95 ≤ 13.5) | 10.5 ms (p95 ≤ 30) | 50–64 ms | 12–18 fps |
| 6× | portrait | 3.8 ms (p95 ≤ 18.6) | 16.1 ms (p95 ≤ 41) | 68–103 ms | 6–13 fps |
| 6× | landscape | 3.6 ms (p95 ≤ 13.6) | 15.9 ms (p95 ≤ 47) | 76–102 ms | 6–11 fps |

  - **The simulation is now cheap on a phone.** With tiers, a 50 ms step costs about 3 ms even at 6×; without them it cost 10–17 ms, with spikes to 47 ms.
  - **Drawing is now the cost**, and it depends on how many pixels the back buffer has. The back buffer is the screen divided by `DP = round(ZOOM × devicePixelRatio)`. At the default zoom 0.7, a pixel-ratio-3 phone draws at ⅔ resolution (DP 2). A pixel-ratio-2 phone draws at full resolution (DP 1), which has the most pixels of the three.
  - Drawing one portrait frame at 4× costs 18 ms at pixel ratio 1, 73 ms at ratio 2 and 49 ms at ratio 3 (noon; 25, 95 and 69 ms at night).
  - Next step for phones: choose DP from a budget of back-buffer pixels instead of from the pixel ratio alone, then measure on a real device. The night tint and the light pass are the next numbers to watch.
  - Heap: 61–76 MB with tiers, 69–105 MB without. The save is about 86 KB.

## Next task

Phase 5 is complete. Next is phase 6 step 2 (below), then phase 7 (emergent gameplay: merchant ambushes, dungeon expeditions, camp patrols, a basic economy).

## Next in phase 6 (step 2)

1. Save creature corpses with their contents and remaining lifetime, and merchant cargo, through the same validated-rows path (no duplicates on load). NPC adventurers (v0.36, the `adv` block) and townsfolk bodies (v0.39, the life block's `npcd`) are already saved.
2. Phone drawing: pick the back-buffer divisor from a pixel budget (see Performance), then profile on a real phone.
3. A seeded long-run check with tiers on (the soak), added to the browser suites with the spec's long-running checks: no population explosion or extinction, no infinite loot or gold, no stuck NPCs, a bounded event log and memory.
