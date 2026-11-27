# Living World — implementation progress

The roadmap is `docs/WORLD_SIMULATION_MASTER.md` (the full specification, unchanged). This file records what is actually built, how it was tested, and what comes next. Update it at the end of every phase.

**Status words:** **Tested** — implemented and covered by an automated test that passes. **Implemented** — in the build, checked by hand only. **Partial** — some of the item is in; the rest is listed. **Planned** — not started. **Blocked** — waiting on something named.

**Current build:** v0.26 (`Shardfall_v0.26.html`), branch `integration/v0.26`: phase 3 (`feature/living-world-phase3`, #20, built as v0.25) merged with the equipment and paper doll work (#19, also v0.25, which already contains the missing icons v0.24.1, #18). One PR from `integration/v0.26` replaces #18, #19 and #20; phase 4 branches from it.

---

## Phases

The spec's development sequence (§29, phases A–G) is numbered 1–7 here. Each phase must leave the game playable and pass every existing suite before the next starts.

| # | Spec | Phase | Depends on | Status |
|---|---|---|---|---|
| 1 | A | Audit and architecture: actor ids, archetypes and controllers, shared damage entry, structured events, seeded streams, deterministic tests | — | **Tested** (v0.21) |
| 2 | B | Clock and navigation: fixed 50 ms simulation step, persistent world clock (120 min day), day/night lighting and local lights, A* plus a waypoint graph, doors, stuck recovery, developer debug panel | 1 | **Tested** (v0.22) |
| 2½ | — | **World expansion** (asked for between phases 2 and 3): Anniabreen stretched ×1.35 between rigid towns, the Southern Reach, 8 camps, 5 sealed dungeon mouths, world 2620 × 1520 | 2 | **Tested** (v0.23) |
| 3 | C | Population and monster ecosystem: regions and habitats, species profiles as data, roaming, territories, predator/prey, monster-vs-monster factions, creature audio | 1, 2 | **Tested** (v0.25) |
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
- **Wolves are the bestiary's dire wolves; deer, hares and bears are drawn in code** until sheets exist.
- **Creatures respawn on load as before; camp clearance is the one thing saved now.** Saving every creature is phase 6 (§26).
- **The quarter-rate tier for distant idle creatures** is a stopgap so the larger population costs less than the old one did. Phase 6 replaces it with the spec's tiers A/B/C.

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

## Implementation matrix (audit of v0.20 against the spec)

| Spec § | Area | What exists in v0.20 | Status (latest phase) | Next |
|---|---|---|---|---|
| 2 | Rules: no engine, offline, saves migrate | Single-file web build via `build.sh`. Works offline after load (`--offline` build embeds audio). Saves v1→v4 with snapshots. | Respected; save v5 | — |
| 3 | Actor architecture | `ents[]` of plain objects keyed by `kind` (`mon`, `npc`, `pet`, `ally`, `corpse`); player `P` separate; numeric per-session ids | **Tested:** stable ids, archetypes, controllers, optional components | Phase 4 adds civilian/guard/merchant ticks |
| 3 | Shared action services | One physical resolver (`swingAt`/`strikeOne` → `applyBlow`) for player, Wren, pets, creatures. Magery in `magic.js`. Bandaging, gathering, crafting are player-only. | **Tested:** shared damage entry `damageActor`, death once | Movement, gather, craft, loot and trade for any actor: phases 4–5 |
| 4 | Simulation/render separation, timestep, events, seeded RNG | `update(dt)` with frame dt (capped 0.1 s); `render()` separate; `R` swappable (`setRng`); world gen seeded (`mulberry(1999)`); no event log | **Tested:** events, seeded streams, deterministic harness (phase 1); fixed 50 ms step with interpolation (phase 2) | — |
| 5 | World clock | `hourOfDay()` = `(GT/60 + 9) % 24`: a 24-minute day, starting at 09:00. `GT` is saved, so time already persists. HUD clock exists. | **Tested** (phase 2): 120-minute day, periods, saved, HUD | Offline progression stays off (spec) |
| 6 | Day/night visuals | `darkness()` overlay with radial holes for the player, `LIGHTS` and blasts. Night Sight sets darkness to 0. Dungeons fixed at 0.8. | **Tested** (phase 2): tinted periods, local lights and glow, partial Night Sight, dungeons apart | Torch items and spell light radii when those exist; night gameplay in phase 3 |
| 7 | NPC life | 58 static NPCs (Saltmarsh + Anniabreen towns), roles, shops, dialogue lines; no movement or schedules | Classified (civilian/merchant/guard) | Phase 4 |
| 8 | NPC adventurers | Wren: one hireling with skills, equipment, bandaging, ghost/resurrection, follow/wait | Classified (hireling) | Phase 4 |
| 9–10 | Monster ecosystem | `MON` table (23 types) with aggro, leash, speed, loot, skin; `SPAWNS` point spawners with caps and respawn timers; `aiMon` idle/chase/telegraph/strike/recover/return | **Tested** (phase 3): 27 species profiles as data, temperaments, hours, prey, packs and herds, retreat, feeding; deer, hares and bears added | Goblins, zombies, dragons when art exists; orc roles and lich commands with NPC Magery (phase 5) |
| 11 | Factions | None; creatures target only the player, pets or Wren (or a provoked creature) | **Tested** (phase 3): 20 factions, five levels, symmetric table; creatures fight creatures; hostility is not a crime | Law and notoriety: phase 5 |
| 12 | Utility AI + state machines | `aiMon` state machine; no utility scoring, personality or hysteresis | **Tested** (phase 3) for creatures: scored options, commitment, hysteresis, forced retreat, reasons in the inspector | Townsfolk and adventurers: phase 4 |
| 13 | Perception | Aggro radius + `los()`; hidden player ignored; no hearing, sleep or night vision | **Tested** (phase 3): sight, hearing, night vision, sleep and rest, alertness, hidden targets, calls for help, scent for hungry hunters | Visible corpses and dangerous areas: phases 5 and 7 |
| 14 | Pathfinding | None: straight-line steering with a sidestep (`moveBy`); doors, bridges, stairs and moongates exist | **Tested** (phase 2): A* + travel graph, doors, stairs, boats, gates, stuck recovery, budget; (phase 3) creatures: pursuit limits, walks home and sorties in legs of at most 50 m, never the travel graph | Crowding at doors in phase 4 |
| 15 | Population | `SPAWNS` point spawners: Saltmarsh, Anniabreen (8: boars, rats, a cemetery pair of skeletons, hounds, snappers, spiders) and dungeon rooms; bestiary creatures have stats but no spawns | **Tested** (phase 3): ~100 regions by habitat, wildlife by habitat from a seeded stream, spawning out of sight on valid ground, profile respawn pace, regional caps, nothing dangerous in the starter slice | Persistence of individual creatures: phase 6 |
| 16 | Camps | Ashfen outlaw camp (static vendors, smugglers spawner) | **Tested** (phase 3): 8 camps and 2 guarded mouths as persistent populations; clearance saved, gradual recovery; orc patrols, bandit road watches, wolf hunting trips | Supplies, treasure, leadership: phases 5 and 7 |
| 17 | Dungeons | Sunken Bell, 3 levels, seeded rooms, Bellkeeper boss, chests, stairs; Mynoc mine first chamber | **Partial** (v0.23): 5 sealed mouths placed and reachable; interiors **Planned** | One step per dungeon interior |
| 18 | Combat between actors | Creatures ↔ player/pets/Wren; provoked creature ↔ creature | Shared entry **Tested** | Phase 5 |
| 19 | Criminality | Protected zones (`PROT`, guarded towns); theft/pickpocket and snooping exist for the player; no notoriety | Planned | Phase 5 |
| 20 | Corpses, death, loot | `SF.deathTransaction` for player and Wren, creature corpses with loot rolls, decay timers, skinning, the player's corpse saved | Death once **Tested** | Phase 5 (NPC looting), phase 6 (persist all corpses) |
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
- **Procedural creatures:** boar, marsh hound, mud snapper, wreck crab, mire spider, ash wisp, bell sentinel, drowned captain and the Bellkeeper; since v0.25 also red deer, brown hare and brown bear (stand-ins until sheets exist).
- **Sound pack v1.0.0:** 107 events.
  - Creature sounds exist for rat, skeleton and hound (alert, attack, death), plus attack-only takes for boar, crab, spider and wisp.
  - Ambience: surf, wind, rain, hearth, gull, marsh, drip, bell and beacon.
  - Footsteps on 7 surfaces.
- **Music:** five Saltmarsh tracks, mapped to zones.
- **Gaps for the spec's roster (asset backlog):**
  - Sheets for deer, hares and bears (drawn in code for now); bandits as their own look; zombies, dragons/drakes, fire and water elementals, goblins.
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

- Each figure is the average of 3 runs of 4,000 updates and 200 renders.
- **v0.23 update cost.** It rose from 0.80 to 1.20 ms per step. This is the creature push-apart in `aiMon`, which compares every entity with every other: with 256 entities instead of 212 that is 1.46× the pairs, which matches the measurement. It is still far inside the 50 ms step, but it is the first sign of the quadratic cost the audit flagged. The phase 3 spatial index removes it.
- **v0.23 start-up:** 1.66 s to enter the world (was 1.0 s); about 72 MB of heap (was about 31 MB).
- Night costs the full-screen tint plus the cached light sprites. Before the sprites were cached it was 7.9 ms.
- **Path searches** are capped at 3,000 nodes per step. Twelve travellers starting at once stay under the cap, and their whole journeys cost about 0.7 ms per step on average.
- **The travel graph** is built once, in about 250 ms.
- **v0.25 update cost.** It fell from 1.21 to 0.49 ms per step although there are more than twice as many actors. Push-apart, perception and calls for help go through the spatial index, and idle creatures more than 80 m away think at a quarter rate. Near a busy camp everything runs at full rate; the seeded three-day run averaged about 0.5 ms per step.
- **v0.25 start-up:** 1.92 s to enter the world (v0.24 measured again: 1.65 s). The habitat survey and the larger first population add about 0.3 s. Heap after start: about 52 MB (v0.24: about 49 MB in the same run).
- **Phones are not measured yet.** That is phase 6, but the night pass and the graph build are the two numbers to watch.

## Next task (phase 4, first step)

Living NPCs (§7–8), using the actor, decision, perception and index pieces built for creatures:

1. Homes and workplaces for the named townsfolk of one town first (Vespar or Mynoc), and a daily schedule on the world clock: sleep, work, eat, socialise, go home. Each townsperson walks on the navigator and opens doors.
2. Guards patrolling their town on a route, and standing watch at the gates at night.
3. A merchant travelling between two towns by road, so creatures and bandits can meet travellers.
4. Crowding at doors and merchants (§14).

The faction table already has citizens, guards and merchants; law, notoriety and guards responding to crimes stay in phase 5.
