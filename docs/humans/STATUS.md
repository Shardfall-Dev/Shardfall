# Classic humans v2 — status (v0.30)

Handoffs: `docs/handoffs/classic-human-sprites-v1.md`, `docs/handoffs/classic-human-sprites-v2.md`. Source pack (unchanged): `asset-packs/classic-humans-v2/`.

**Short version.** Every human in the game — the player, Wren, townsfolk, guards, merchants, trainers, travellers, bandits, smugglers and the drowned captain — can now be drawn by one renderer with one appearance model, eight directions, both bodies and a separate animation for every weapon family, casting gesture, gathering and crafting motion. It is **behind a feature flag and off by default**, because the art it draws is the procedural prototype rig, not painted Ultima Online-style sprites. **No painted animation frames exist yet** (the painted v1 pack is not in the repository, and it only ever had idle in 8 directions plus walk/cast in 2). The visual rework is therefore **not finished**: see *Missing art* below. Nothing in combat, Magery, skills, stats, movement, collision, targeting, loot or saves changed.

## Turning it on

| How | Effect |
| --- | --- |
| `?humans=v2` in the address (e.g. `…/Shardfall_v0.30.html?humans=v2`) | on for this page load |
| `?humans=old` | off for this page load (overrides the setting) |
| Menu → *Classic humans v2: on/off*, or the checkbox on the character creation screen | stored in `shardfall.settings` (`humansV2`) |

With the flag off the game draws exactly as v0.29.2 (the Saltmarsh scout sprites). Appearance data is created and migrated either way, so turning the flag on later needs no new character.

## What is in

**Files**

| File | What |
| --- | --- |
| `src/looks.js` | `SF.LOOK` — pure, node-tested: appearance options, `normalize` (the one migration path), `check`, seeded `random`, weapon → animation map, tools, casting gestures, profession presets, seeded NPC looks, `figure` (look + visible equipment → render description), `state` (animation priority) |
| `src/human-rig.js` | `SFRIG` — the articulated rig ported from the pack's v2.0 module and extended to v2.1 (below). Pure SVG strings, no DOM |
| `src/humans.js` | the in-game renderer: flag, NPC seeds, figure cache, simulation → animation state, strip cache and build queue, world drawing, corpses, creator preview, paper doll |
| `src/game.js`, `src/magic.js`, `src/equipment-ui.js`, `src/head.html` | small hooks only (listed under *Changed code*) |
| `tests/humans.test.js`, `tests/humans-smoke/run.py` | node and browser suites (both in CI) |
| `tools/humans_missing_art.js` → `assets/humans/missing-art.json` | the painted art still needed, machine-readable |
| `docs/humans/shots/` | weapons, NPC roster, world, creator, paper doll, death |

**Rig v2.1 (extends the pack's v2.0)**
- Cell 144 × 144, ground anchor (72, 112) — same scale as v2.0 (112 × 100, anchor 56, 86); the extra margin stops overhead polearms and fallen bodies being clipped. A node test checks that every frame of every action, in both bodies and all 8 directions, with every weapon that uses it, stays inside the cell.
- Layers drawn from the equipment: leather, studded, bone, ringmail, chain, plate and dragon on torso, arms and legs (with ring/stud/plate patterns), gloves, boots, gorget, robe, tabard, apron, vest, coat, cloak, hood, seven helmet shapes (cap, leather cap, bone, coif, open, closed, great helm) and four shields (buckler, round, kite, heater). Armor and shields take their crafting material colour from `EQ.matColor` via `EQ.appearance`; cloth garments take the character's clothing colour.
- Motions: separate keyframed animations (wind-up, peak, contact at ~60 %, follow-through) for wrestling, one- and two-handed slash, one- and two-handed chop (axes), one- and two-handed blunt (mace, war hammer), one- and two-handed thrust (daggers/fencing, spear), polearm, staff, bow, crossbow, heavy crossbow (braced, heavier recoil), shield block, three casting gestures (one hand, two hands, staff), hit, death and corpse, mining, woodcutting, smithing, generic crafting, bandaging and fishing; idle breathing, walk and run with stride, carry and ready poses (long weapons upright, two-handed axes shouldered, bows in the off hand, crossbows at the hip). A node test checks that every weapon family has its own contact pose.
- Female and male bodies differ in shoulders, hips, head and hair defaults; mechanics are identical (tested).

**Weapons (all 16 ids in `SF.WEAPONS`, from the item registry, never by name)** — `LOOK.unmapped()` must be empty; the node test fails otherwise.

| id | animation | drawn as | grip (from `SF.WEAPONS[id].two`) |
| --- | --- | --- | --- |
| unarmed | unarmed (wrestling) | fists | — |
| sword | slash1h | sword | one hand |
| knife | slash1h | knife | one hand |
| glaive | polearm | halberd | two hands |
| battleaxe | chop2h | battle axe | two hands |
| hatchet | chop2h (woodcutting: chopwood) | hatchet | two hands |
| pickaxe | chop1h (mining: mine) | pickaxe | one hand |
| waraxe | chop1h | axe | one hand |
| mace | blunt1h | mace | one hand |
| hammer | blunt2h | war hammer | two hands |
| dagger | thrust1h | dagger | one hand |
| kryss | thrust1h | kryss | one hand |
| spear | thrust2h | spear | two hands |
| shortbow | bow | bow | two hands |
| crossbow | crossbow | crossbow | two hands |
| heavycrossbow | hcrossbow | heavy crossbow | two hands |

Two-handed weapons hide an equipped shield (visual only; the equipment rules already decide what may be held). The rig can also draw greatsword, broadsword, katana, rapier, double axe, maul, club, short spear, bardiche, staff, quarterstaff, longbow and wand (`LOOK.FUTURE_GEOMS`) for items that do not exist yet; staves get the staff attack and staff casting.

**Animation state (visual only, from simulation facts)** — priority death > hit/interrupt > attack / cast / tool > ready > run / walk > idle (`LOOK.state`, node-tested).
- Attack: the combat resolver's swing (`swingAt` stamps `_hswing`); the contact pose lands 0.12 s after the swing event (the swing resolves instantly in the simulation, so this is visual lag only). Creatures: the existing telegraph (`tele`) is the wind-up, `strike` the contact, `rec` the follow-through.
- Cast: `P.prep` (prepare), `P.held` (hold), the `CastRelease` event (release). Gesture by circle: 1–4 one hand, 5–8 two hands; a staff in hand → staff gesture. Spell effects stay in `src/magic.js`; timing, mana, reagents, targeting and interruption stay in Magery.
- Hit/interrupt: the flinch shows when the simulation interrupted something (`interruptPrep` stamps `_hbreak`; an interrupted task stamps `_htaskbreak`), or on a hit when nothing else is playing. A parried blow shows the shield block.
- Tool: gathering task by skill (mining → pickaxe, lumberjacking → hatchet, fishing → pole), crafting batch by station (forge/anvil → smithing, else crafting), bandaging. Townsfolk: miners, woodcutters and fishers gathering, smiths at work.
- Death: the player's, Wren's and a human creature's corpse plays the fall from the corpse's creation time, then lies in the look it died in (snapshot taken before the death transaction). The corpse visual never touches the container or the loot.

**Character creation** — the existing creator (stats, skills, profiles, cloak) is unchanged; appearance is added beside it: male/female, rotatable preview (◀ ▶, eight directions) with Idle / Walk / Run / Ready / Attack / Cast / Cast (two hands), 5 skin tones, 8 hairstyles, 7 hair colours, facial hair (none, stubble, goatee, short, full; disabled for the female body), 12 clothing colours, Randomize. The look is saved in `char.look` `{ v, body, skin, hair, hairColor, beard, cloth, cloak }`. The creator still uses the old 150-point / Glaive-hybrid allocation; `docs/design/character-creation-v2.md` (branch `design/character-creation-v2`) is a design only, not implemented — the appearance block is self-contained (`ccAppearanceHtml`, `ccLookAction`) so it can move into that wizard unchanged.

**Saves** — no save version bump. `LOOK.normalize(look, name)` runs on every load and on creation: valid fields are kept, unknown fields are kept, the legacy cloak colour is kept, missing fields are filled from a seed of the character name (the same on every load — never rerolled) and written back. Tested on an old `{ cloak }` look loaded twice.

**NPCs** — `humAssignSeeds()` gives every NPC a seed at world population (name + role + ordinal, so five identical "Quay warden"s get five faces). The look is derived from the seed, not stored, so it is identical after leaving the area and after every reload (tested: 72 of 72). Gender comes from the existing NPC names and titles (Sister/Brother, -woman/-man, known names); unnamed guards take it from the seed. Presets: guard (chain, open helm, town-colour tabard, halberd), quaywarden (plate, closed helm, sword and heater), ranger, blacksmith (leather apron, bare arms), miner (apron, cap), lumberjack, merchant (vest), banker, mage (hooded robe, staff), healer, priest, scribe, sailor (striped), farmer, villager, innkeeper (white apron), trainer (studded, sword and buckler), bandit (leather and hood, dagger/sword/war axe/mace/knife), smuggler, drowned captain (pale skin, coat and cloak), sellsword (Wren, from her real equipment), student. Work tools appear only while working.

**Monsters** — unchanged. Only `bandit`, `smuggler` and `captain` (`LOOK.isHumanMon`) use the human renderer; every other creature keeps its bestiary / sheet / procedural art (tested: no human strips are built for orcs, rats, skeletons, lizardmen or trolls).

**Rendering and performance** — rendering never touches the simulation (multiplayer-ready: the renderer only reads entity state). Strips (one figure × action × direction) are rasterised once from SVG at native size (×1.1 the rig), trimmed per frame, and kept in an LRU cache bounded at 7 megapixels (~28 MB); the queue starts at most 2 strips per frame with 4 in flight, and decoded strips are rasterised and packed in `humPump` within a 4 ms per-frame budget — never inside the draw call; nearest-neighbour drawing at integer positions; same ground anchor, depth sort (`x + y`), collision, targeting and interaction distances as before. While a strip is building the same figure's idle is drawn, then, only on a human's very first frames, the old sprite. Measured in headless Chrome (software rendering, 1280 × 720) in a town square with 7 humans in view: 77 strips, 0.59 MP, render 10–12 ms per frame, median frame 16–17 ms, p95 21–24 ms; generating a strip's SVG takes about 1 ms, rasterising and packing it up to ~7 ms (spread over frames by the budget).

## Missing art (blocks calling the rework finished)

- **Painted frames: none integrated.** `assets/humans/missing-art.json` lists them: 31 animations (227 frames per direction), 8 directions, 2 bodies → 3,632 frames per layer set, plus layers: 7 hairstyles, 4 beards, 7 armor families × 5 regions, 9 garments, 7 helmets, 4 shields, 15 weapons, 4 tools (and 13 future weapons). Paint armor/shields in neutral greys: the game tints them by material.
- The painted v1 pack (`Shardfall_Classic_Humans_v1.zip`: idle 8 directions, walk and cast in 2) is **not in the repository**; it cannot be integrated without mixing styles anyway (the handoff forbids a mixed release).
- **Manga assets were not removed.** `SCOUT_SRC`, `ANIM_CLIPS` (src/assets.js) and the scout drawing code are still referenced by the flag-off path, the creator header and the paper doll fallback. Remove them only when the painted set ships and the flag is retired.

## Known issues and limits

- Prototype look: flat-shaded vector figures; side views (W/E) read thin; the female body differs only subtly; capes are simple panels; faces are dots. This is why the flag stays off.
- Player attacks show their wind-up after the swing event (0.12 s), because the simulation resolves a swing at once; creatures use their real telegraph.
- Bows and crossbows: the arrow/bolt projectile still starts from the actor's position (`src/game.js` `EFX` 'proj'), not the hand socket.
- The ally's casting and gathering are not animated (she does neither in the simulation).
- NPCs added after population (developer travellers) get a seed from name + role, so identical dev travellers share a face.
- Sleeping NPCs indoors are drawn standing (the simulation has no lying-down state to read).
- First sight of a new human can show one frame of the old sprite while its idle strips build (flag on only).

## Changed code (hooks)

- `src/game.js`: `drawEnt` asks `drawHuman` first for humans; `drawCorpse` asks `drawHumanCorpse`; `render` runs the build queue; `swingAt` stamps `_hswing`; `noHarmSound` stamps `_hblock` on a parry; an interrupted task stamps `_htaskbreak`; corpses of the player, Wren and slain creatures get `t0`, `sect` and the death look (`hfig`); `populate` assigns NPC seeds; `newChar` and loading normalise `look`; the creator gets the appearance block and the flag; the Menu gets the toggle; `__SF.HUMANS` for tests.
- `src/magic.js`: `interruptPrep` stamps `_hbreak`.
- `src/equipment-ui.js`: the paper doll shows the same figure when the flag is on.
- `build.sh`: `src/looks.js` and `src/human-rig.js` after `src/equipment.js`; `src/humans.js` before `src/game.js`.

## Tests

- `node tests/humans.test.js Shardfall_v0.30.html` — options, all weapons mapped, grips, distinct motions, gestures, normalize/migration/idempotence/validation, seeded NPC looks, presets, gender, human-vs-monster, equipment layers and material colours, two-handed hides shield, animation priority and contact timing, frame bounds (every action × both bodies × 8 directions × its weapons), anchor, real animations.
- `python3 tests/humans-smoke/run.py Shardfall_v0.30.html` — flag off draws as before; creator (body, hair, colours, rotation, preview, beard disabled for female; stats and skills unchanged); both bodies × 8 directions on the same anchor; all 16 weapons (family, shape, shield); a real swing; one- and two-handed casting, release, mana still spent, interruption flinch; walk, run, stick walking, mining, woodcutting, ready, idle; 72 NPCs with distinct, persistent, profession-appropriate looks, both genders, talking still works; plate/helm/cloak and the paper doll; monsters untouched; bandit corpse keeps its look; NPC and player looks identical after reload; old-save migration stable; death, corpse and ghost; cache budget and frame time in a busy square; phone creator layout and play. Screenshots in `$HUMAN_SHOTS` (default `/tmp/humans-shots`).

## Regression run (v0.30)

All browser suites from `.github/workflows/ci.yml` were run twice in Chrome: once on the build as committed (flag off) and once on a copy with the flag forced on. Both pass except two checks that are flaky on v0.29.2 too and fail at random with the flag on or off: `sfx-smoke` "keyboard E closes once" (an ambient `world.hearth` cue lands in the door's sound window) and `combat-smoke` phone play-test (the player is sometimes killed by the 120 HP rat in the bow step before the Wren step; it also compared a float duration with `== 5`, now `abs(dur - 5) < 1e-6`).
