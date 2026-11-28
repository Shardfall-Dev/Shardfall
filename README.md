# Shardfall

A T2A-era Ultima Online-style 2.5D isometric sandbox RPG for phones, built as a single-file web game.

## Play

**Online:** every merge to `main` runs all checks (`.github/workflows/ci.yml`) and, if they pass, publishes the newest build on GitHub Pages (`.github/workflows/pages.yml`): `https://shardfall-dev.github.io/Shardfall/`. The repository is public and Pages is enabled (source: GitHub Actions). On iPhone, Share → Add to Home Screen gives it an app icon.

**On your computer:** run `python3 -m http.server` in this folder and open `http://localhost:8000/Shardfall_v0.33.1.html`. The game loads its sound and music from `assets/audio/web/`, so it needs to be served like this; opened straight from disk it plays silently. For a single file that plays from disk with sound effects, build `./build.sh 0.33.1 --offline`.

**Developer panel:** add `?dev` to the address (for example `http://localhost:8000/Shardfall_v0.33.1.html?dev`) and press the small DEV button. It shows the world's live numbers (creatures by faction, regions, camps and what the ecosystem has been doing), lets you set the time, pause or fast-forward the simulation, send test travellers anywhere and inspect any actor you tap (a creature shows its faction, activity, what it decided and why, its senses, pack, camp and sound). Without `?dev` it does not exist.


Progress saves to the browser's local storage. If a save cannot be read, the start screen says why and offers to restore the last good save, export the save or delete it; nothing is overwritten silently (copies: `shardfall.save.v1.lastgood`, `.replaced`, `.damaged`). Open the game in one tab at a time: a second tab takes over saving, and a tab whose character was deleted or replaced in another tab stops saving instead of bringing it back. If the browser refuses to store the game (storage full or blocked), a **Not saved** notice stays on screen with **Export** (the current game as a file) and **Retry**; a new character is never shown as saved when it is not.

## Layout

- `src/head.html` — page markup and CSS (HUD, panels).
- `src/rules.js` — the pure rules module (`SF`): items, the 49-skill registry (`SF.SKILL_DEFS`), recipes, materials, crafting and repair math, and the Second Age combat and First Aid rules. No DOM.
- `src/skills.js` — the skill engine (`SF.SK`): the v8 skill migration, skill checks and gains, real and displayed values, stat gains, creation rules, trainers, every skill's rules (Meditation, Stealth, taming, bard songs, stealing, poisoning, locks and traps, the ten added skills), the content that gives each skill a road to 100.0, and `SK.routes` that proves it. No DOM.
- `src/wardrobe.js` — NPC wardrobe and faction appearance (`SF.WARDROBE`, pure, deterministic): regional guard uniforms by rank, civilian roles and palettes, activity states, hostile human variants. `src/gear-render.js` draws what it chooses.
- `src/stats.js` — attribute locks (`SF.STATS`): raise / hold / lower per stat, the lock command, save repair and tooltips. The gains themselves are in `src/skills.js` (`SK.statGain`), which honours the locks. No DOM.
- `src/creation.js` — the character creation rules (`SF.CREATION`): the shared validator (`validate`, used by the creator, boot and a future server), appearance allowlists, the twelve starting templates, the five starting towns, the skill-driven starter kit and the save conversion of appearances. No DOM.
- `src/equipment.js` — the equipment rules module (`SF.EQ`): 18 equipment slots, armor families and pieces, material variants (metals, hides, cloth, bone, dragon scale), body-region armor, weight units and carrying capacity, encumbrance, effective attributes, durability and repair risk, the validated item commands (`equipItem`, `unequipItem`, `moveItem`, `dropItem`, `pickupItem`, `splitStack`, `mergeStacks`, `craftItem`, `repairItem`), appearance data and the v0.24 → v0.25 save conversion. No DOM.
- `src/magery.js` — the Magery rules module (`SF.MAGERY`): the 64 spells (data from `docs/magery/spells.json`), success, resistance, damage, statuses, save migration. No DOM.
- `src/audio.js` — the Web Audio player for the sound pack (`SFXA`).
- `assets/audio/` — sound pack v1.0.0: `manifest.json` and mono WAV takes (the masters).
- `assets/audio/web/` — the small AAC copies the game loads (sound 2.1 MB, music 4.9 MB), made by `tools/encode_web_audio.sh` (needs ffmpeg). Re-run it after changing a sound.
- `assets/music/v1.0.0/` — the Saltmarsh soundtrack: five MIDI sources, MP3 renders and `soundtrack.json`.
- `src/assets.js` — embedded sprite sheets and art (data URIs; large, not meant for hand-editing).
- `src/magery-art.js` — the 64 spell signs as one embedded atlas.
- `src/bestiary-art.js` — the 17 bestiary sheets and one merged manifest, embedded (generated: `python3 tools/embed_bestiary.py` merges `assets/bestiary/Shardfall_Bestiary_v1.0.0.zip` (11 sheets) and `assets/bestiary/v1.1.0/` (6 sheets, draft01); it rejects duplicate creature ids, wrong sizes, missing alpha and empty cells).
- `assets/bestiary/v1.1.0/` — bestiary v1.1.0 draft01: boar, marsh hound, mud snapper, mire spider, red deer and brown hare, with `manifest.json`, `validation.json` and `README.txt`; extracted from `assets/bestiary/Shardfall_Bestiary_v1.1.0_draft01.zip`.
- `src/magic.js` — casting in the world: prepare → hold → release, targets, effects, fields, runes, summons, spellbook panel, hotbar signs.
- `src/backpack-icons.js` — backpack icon atlas v1.0.1 and its id → rect map, embedded (generated: `python3 tools/embed_backpack_icons.py` reads `assets/backpack-icons/v1.0.0/Shardfall_Backpack_Icons_v1.0.0.zip` and adds the seven PNGs in `assets/backpack-icons/v1.0.1/icons_64/`; the extension step needs Pillow).
- `src/anniabreen.js` — Anniabreen v1.0: the mainland, Vespar's river islands, Skara Bryn and Moonglen; towns, roads, the Mynoc mine, landmark art, ferries, boats, the public moongates and their map symbols. Since v0.23 it is drawn in its original frame and then stretched (`annStretch`: towns move whole, the wilds between them grow ×1.35; `annWarp` / `annUnwarp` convert).
- `src/frontier.js` — the world expansion (v0.23): the Southern Reach and the Long Causeway, Southwatch, eight camps and five sealed dungeon mouths, their art, zones and provisional camp spawners.
- `src/world.js` — the world simulation core (`SIM`): stable actor ids, archetypes and controllers, the structured event log, seeded streams, the fixed step, the world clock and light curve, A* and the travel graph. No DOM; tested in node like the rules.
- `src/living.js` — the Living World runtime in the game: the 50 ms step loop and interpolation, light and local lights, walkability, the travel graph from roads, piers, gates and stairs, the navigator (doors, stuck recovery) and the developer panel (`?dev`).
- `src/ecology.js` — the monster ecosystem (Living World phase 3): species profiles as data, factions, perception, decisions, roaming, packs, predator and prey, creature-against-creature fights, camp sorties, regional populations and persistent camps, graveyards that rise at night, creature sound, and the new procedural wildlife (deer, hares, bears).
- `src/townlife.js` — town life (Living World phase 4): homes, workplaces and daily schedules for Vespar and Mynoc, residents, resource workers gathering real ore, wood and fish, guard patrols and the night watch, the travelling merchant on the cart road, shop hours, fear of creatures and resuming the day after a load.
- `src/npcfight.js` — NPC combat (Living World phase 5, step 1): fighting profiles for townsfolk and guards, creatures targeting townsfolk outside protected ground, guards leaving their patrol to fight creatures in their jurisdiction, knock-downs and getting up, the NPC combat counters.
- `src/game.js` — the game: world generation, rendering, input, NPCs, quests, crafting UI, save/load, and the one physical-combat resolver every swing goes through.
- `src/creation-ui.js` — the title screen and the four-step character creator (identity and appearance, profession, stats and skills, town and review) with the live portrait and world-sprite preview; it starts the game loop.
- `src/equipment-ui.js` — the equipment UI: paper doll window, backpack (search, sorts, filters, split and merge, virtualized grid), item tooltips with comparison, drag and drop, context menu, the Armor crafting category.
- `src/hud-ui.js` — the HUD UI (v0.29): the delayed item tooltip, the item information popup with actions and drop confirmation, one popup manager (Escape order, outside taps never reach the world) and the compact target frame with its retention rules (`TARGET_RETAIN`).
- `src/tail.html` — closes the game script block and the page.
- `build.sh` — joins the parts into the game: `./build.sh 0.33.1` → `Shardfall_v0.33.1.html` (web build, about 11 MB); `./build.sh 0.33.1 --offline` → `Shardfall_v0.33.1_offline.html` (22 MB, every sound inside, not committed). Needs `python3`.
- `Shardfall_v0.33.1.html` — the current built game.
- `src/gear.js` — equipment appearance (`SF.GEAR`, pure, no DOM): one description of what a character looks like in its equipment, shared by the paper doll, the world sprite, NPCs and corpses: each piece's material channels (metal, wood, hide, cloth) from `SF.matOf` and `EQ.matColor`, stud metal, blade and handle, the occlusion rules (helmets and hair, two-handed weapons and the off hand), a stable appearance key, corpse snapshots, NPC presets and the clip → rig animation map.
- `src/human-rig.js` — the layered human rig (`HUMAN_RIG`, pure): the classic-humans-v2 body with the layered-armor-v1 armor painter, 112×100 cells, 8 directions, 29 animations, both bodies; builds draw lists that `src/gear-render.js` paints.
- `src/equipment-art.js` — Medieval Equipment Art v1 pieces and material masks, embedded (generated: `python3 tools/embed_equipment_art.py > src/equipment-art.js` reads `asset-packs/medieval-equipment-art-v1/Shardfall_Medieval_Equipment_Art_v1.zip`; needs Pillow).
- `src/gear-render.js` — the layered equipment renderer: the fitted paper doll with the painted pieces, per-channel recolouring through the masks, world strips from the rig, NPCs, corpses, caches, and the "New art" switch (off by default; `?gear=new` / `?gear=old`).
- `src/painted-art.js` — Painted Human Candidates v0.1, accepted cells only (generated: `python3 tools/painted_candidates.py --embed`; `--check` verifies it, `qa.json` and `missing.json` are current).
- `src/painted.js` — `SF.PAINTED` (pure): which human, state and direction has a validated painted frame. `src/painted-render.js` draws it before the layered renderer, developer flag only.
- `assets/humans/painted-candidates-v0.1/` — `review.json` (manual QA verdicts), `qa.json` (every frame, metrics, accepted/rejected and why), `missing.json` (art still needed). `docs/humans/PAINTED_CANDIDATES.md` explains them.
- `docs/art/SPRITES_PAPERDOLL_EQUIPMENT_GAPS.md` — what art is still missing for world sprites, the paper doll, icons and NPC outfits, in priority order.
- `docs/archive/superseded-renderers/` — docs, manifests and screenshots from the renderers v0.33 did not keep (#35, #36, #37, #39's rig, #40).
- `docs/equipment/RENDERING.md` — how equipment is drawn, the material channels, occlusion, caches, the review flag and the art still missing.
- `.github/workflows/pages.yml` — publishes the newest build to GitHub Pages as `index.html`, with the audio beside it.
- `docs/WORLD_SIMULATION_MASTER.md` — the Living World master roadmap (the full specification). `docs/WORLD_SIMULATION_PROGRESS.md` — what is built, phase by phase, the audit matrix, asset gaps and the next task.
- `docs/design/character-creation-v2.md` — the creation spec; `docs/design/character-creation-v2-status.md` — what v0.30 built, the decisions where the stat and skill designs disagreed, tuning, tests and the missing character art (`assets/character/missing-character-art.json`).
- `docs/Shardfall_Audio.md` — what plays when, the audio pipeline and sound-release versioning.
- `docs/Shardfall_Crafting_Guide.md` — the crafting design guide the build follows.
- `docs/equipment/STATUS.md` — equipment, paper doll, inventory and armor: the model, slots, families, materials, weight, UI, save conversion, approximations.
- `assets/equipment-icons/missing-icons.json` — the 67 icons the equipment pieces and new materials still need (ids, file names, 64×64, descriptions).
- `docs/skills/T2A_SKILL_PARITY_v1.md` — the skill audit and brief. `docs/skills/STATUS.md` — all 49 skills: state, mechanics, road to 100.0, deviations, migration, tests, gaps.
- `docs/combat/STATUS.md` — combat and First Aid: the rules, the weapon table, the save migration, sources and every approximation.
- `docs/magery/` — the Magery kit: brief (`Magery_Brief.txt`), illustrated book (`Shardfall_Spellbook.html`, `Spellbook.md`), `spells.json`, reference math, and `STATUS.md` (what is in, what differs, what is left).
- `tests/rules.test.js` — deterministic rules tests: `node tests/rules.test.js Shardfall_v0.33.1.html`
- `tests/equipment.test.js` — equipment rules tests (slots, layering, carrying capacity, Mithril, exceptional, two-handed, requirements, encumbrance, crafting variants, durability, repair risk, atomic rollback, split/merge, death, migration): `node tests/equipment.test.js Shardfall_v0.33.1.html`
- `tests/equipment-smoke/run.py` — paper doll in Chrome (C key, double-click, mouse and touch drag, drop validation, two-handed, context menu, tooltips and comparison, search/sort/filter, split/merge, 600 stacks, encumbrance and recovery, region mitigation, broken armor, meditation, window drag, Armor crafting, vendors, save/reload, v6 → v7 migration, phone): `python3 tests/equipment-smoke/run.py Shardfall_v0.33.1.html`
- `tests/creation.test.js` — character creation rules (every template, budgets, duplicates and aliases, names, appearance, kits, towns): `node tests/creation.test.js Shardfall_v0.33.1.html`
- `tests/stats.test.js` — attribute locks and the stat gains (raise / hold / lower, the 225 cap transfer from a Lower stat, the natural store): `node tests/stats.test.js Shardfall_v0.33.1.html`
- `tests/creation-smoke/run.py` — the creator in Chrome on desktop and three phone sizes, every template and town, first fights, casting, mining and smithing, natural gains, Continue, Replace, old v7 saves: `python3 tests/creation-smoke/run.py Shardfall_v0.33.1.html`
- `tests/magery.test.js` — Magery rules tests: `node tests/magery.test.js Shardfall_v0.33.1.html`
- `tests/combat.test.js` — combat and First Aid rules tests: `node tests/combat.test.js Shardfall_v0.33.1.html`
- `tests/magery-smoke/run.py` — in-browser Magery scenarios (Playwright + Chrome): `python3 tests/magery-smoke/run.py Shardfall_v0.33.1.html`
- `tests/combat-smoke/run.py` — in-browser combat, archery, First Aid, reload, old-save and phone play-test scenarios: `python3 tests/combat-smoke/run.py Shardfall_v0.33.1.html` (screenshots in `$COMBAT_SHOTS`, default `/tmp/combat-shots`)
- `tests/backpack-smoke/run.py` — in-browser backpack checks (saved character, three sorts, desktop hover, phone tap, actions after sorting): `python3 tests/backpack-smoke/run.py Shardfall_v0.33.1.html`
- `tests/backpack-smoke/panels.py` — the seven v1.0.1 icons everywhere items are listed (backpack tile, tooltip and tap card, Character, vendor buy and sell, loot, bank, crafting rows and inputs), weapon profiles unchanged, the wick still lights the Shore Beacon; desktop and two landscape phones: `python3 tests/backpack-smoke/panels.py Shardfall_v0.33.1.html`
- `tests/backpack-smoke/icons.py` — backpack icon checks (all 161 ids resolve, slot / tooltip / tap card use the same tile, stack counts readable after every sort, desktop and two landscape phones): `python3 tests/backpack-smoke/icons.py Shardfall_v0.33.1.html`
- `tests/ui-smoke/run.py` — the v0.29 inventory and target-frame checks in Chrome (no grid movement or scroll jump at the bottom of a 300-stack pack, 300 ms tooltip on screen, popup lines and actions, compare, equip, split, drop confirmation, Escape and outside taps, rapid inspection, listener count; frame hidden by default, size and position, 44 px close, pass-through body, monster / NPC / deposit / tree / corpse / ally, retention with hysteresis, despawn, kill, removed resource, travel, closing during combat, no idle rebuilds, save and reload; two landscape phones): `python3 tests/ui-smoke/run.py Shardfall_v0.33.1.html [chrome] [screenshot-dir]`
- `tests/sfx-smoke/run.py` — browser checks for sound, music, doors and footsteps (Playwright + Chrome; serves the web build on a local port): `python3 tests/sfx-smoke/run.py "$PWD/Shardfall_v0.33.1.html"`
- `tests/anniabreen-smoke/run.py` — Anniabreen walk-through (Playwright + Chrome): a scripted walker drives the joystick through the real update loop and times the routes; mine/smelt/bank, ferries, boats, moongates, doors, touch and mouse over a bridge, reload, save migration, phone map: `python3 tests/anniabreen-smoke/run.py Shardfall_v0.33.1.html [--shots DIR]`
- `tests/bestiary-smoke/run.py` — bestiary checks for all 17 sheets (geometry of every cell: alpha, no spill, feet on the pivot, real movement; sheets load and draw pixel-exact; 8 facings; walk / wind-up / impact / recover against the player; deer and hares fleeing and striking as pets; fallback to procedural art while a sheet decodes; a phone draw-cost check at 4x CPU slowdown; preview screenshots when the pack is extracted): `python3 tests/bestiary-smoke/run.py Shardfall_v0.33.1.html [chrome] [screenshot-dir]`
- `tests/inventory.test.js` — inventory conservation regressions (quantities, same-container moves, staged drops, audit and repair of duplicates): `node tests/inventory.test.js Shardfall_v0.33.1.html`
- `tests/stability-smoke/run.py` — save and reload in Chrome, phone and desktop: dropped piles, opened chests, spell preparation, poison, death, units conserved; damaged, truncated, future and broken saves, restore and export, two tabs, full storage: `python3 tests/stability-smoke/run.py Shardfall_v0.33.1.html`
- `tests/stability-smoke/durability.py` — v0.33.1 save durability in Chrome: creating a character while storage refuses writes or is blocked (the Not saved notice, Export, Retry; a replaced save is never lost), stale tabs never recreating a character deleted, replaced or cleared in another tab (also with a missed storage event), pets told to Stay waiting where they were left through a reload with their actor id, owner and loyalty, and older saves migrating: `python3 tests/stability-smoke/durability.py Shardfall_v0.33.1.html`
- `tests/check-build.py` — every script compiles, the committed build equals `./build.sh` output, audio, music and art manifests are complete: `python3 tests/check-build.py Shardfall_v0.33.1.html`
- `tests/soak/run.py` — long-duration world simulation (default 3 game days, save and reload half way): step and draw times, heap, actors, path queue, logs, audio caches, errors and failed asset requests: `python3 tests/soak/run.py Shardfall_v0.33.1.html [--days 3]`. CI runs one game day on every push (blocking on errors and growth; times are diagnostics in the uploaded report).
- `tests/world.test.js` — world simulation core tests: `node tests/world.test.js Shardfall_v0.33.1.html`
- `tests/world-smoke/run.py` — Living World checks in the built game: phase 1 (actor ids, controllers, shared damage, death once, bounded events, save/load identity, v4 → v5 migration, seeded determinism), then `phase2.py` (clock, light, travel graph, journeys by road, boat, moongate and stairs, doors, stuck recovery, search budget, live step rate, developer panel) and `expansion.py` (towns unchanged tile for tile, sites and camps, causeway and islands, long journeys, v0.22 → v0.23 save migration) and `phase3.py` (species profiles and factions, regional populations, predator and prey, creature-against-creature fights, timid wildlife, perception at night and in hiding, graveyards rising at night, persistent camps through a reload, packs, pursuit limits, camp patrols, the spatial index, and a seeded three-day run) and `phase5.py` (fighting profiles, creatures targeting townsfolk only outside protected ground, guards stepping in and returning to patrol, knock-down once and getting up, you cannot hurt townsfolk, health and knock-downs through a reload, a seeded day of fights) and `phase4.py` (homes, workplaces and schedules, a full accelerated day, shop hours, miners on real rock faces, guard patrols and the night watch, the travelling merchant, fear of creatures, crowds spreading out, resuming the day after a reload): `python3 tests/world-smoke/run.py Shardfall_v0.33.1.html`
- `tests/skills.test.js` — the skill system (registry, migration, gains, stats, creation, trainers, per-skill rules, every skill's road to 100.0; also runs `skills-gain.test.js` and `skills-mech.test.js`): `node tests/skills.test.js Shardfall_v0.33.1.html`
- `tests/skills-smoke/run.py` — skills in Chrome: creation, the Skills page, trainers, stat gain, a real v0.28.1 save migrating (required: the v0.28.1 build is read from the pinned commit `b362b46b440634b797b49f65d8ec07ca1acbede7`, fetched when missing; without it the check fails, it never skips), 30 skill scenarios (`scenarios.js`): `python3 tests/skills-smoke/run.py Shardfall_v0.33.1.html [chrome] [Shardfall_v0.28.1.html]`
- `tests/gear.test.js` — equipment appearance and rig tests (every item and weapon resolves, independent material channels, studs, blade/handle, two-handed off hand in all 29 animations × 8 directions, helmet hair, corpse snapshots, NPC presets, clip mapping): `node tests/gear.test.js Shardfall_v0.33.1.html`
- `tests/gear-smoke/run.py` — the layered renderer in Chrome (flag off leaves the previous renderer untouched; seven armor sets on both bodies through the real equip command; immediate doll and world updates; 8 directions × idle, walk, run, attack, casting; death, corpse and reload; persistence; NPCs, Wren and 70 actors with timings; backpack icons; phone): `python3 tests/gear-smoke/run.py Shardfall_v0.33.1.html [chrome] [--shots DIR]` (contact sheets and screenshots in `$GEAR_SHOTS`, default `/tmp/gear-shots`)
- `tests/painted.test.js` — painted candidates: embedded data equals the QA, no duplicated or borrowed frames, frame mapping, eligibility from real equipment, honest missing list: `node tests/painted.test.js Shardfall_v0.33.1.html`
- `tests/wardrobe.test.js` — the NPC wardrobe (data validation, determinism, regional uniforms, real equipment untouched, every piece resolves in SF.GEAR): `node tests/wardrobe.test.js Shardfall_v0.33.1.html`
- `tests/painted-smoke/run.py` — painted candidates in Chrome: flag off untouched, strict and bodies modes, fallbacks, equip/unequip, NPCs on the same path, save/reload, atlas preview, phone: `python3 tests/painted-smoke/run.py Shardfall_v0.33.1.html [chrome] [--shots DIR]`

## v0.33.1 — Stabilization (no new content, no balance changes)

Fixes from the verified v0.33 audit (`docs/audits/v0.33-stability-2026-11-28.md`); results and test runs in `docs/audits/v0.33.1-results.md`. Existing saves load unchanged (still save format 9; new fields are optional and older builds ignore them).

- **Character creation when browser storage fails.** A new character whose save is refused (storage full, or storage blocked as in some private modes) still starts, but a **Not saved** notice stays on screen with Export and Retry, and the log says so; the game retries every autosave and says when it is saved again. Replacing a character first copies the old save aside; if even that copy cannot be written, nothing changes and the creator says why.
- **Stale tabs.** A tab whose character was deleted, replaced or cleared in another tab stops saving instead of writing it back. Besides the browser's storage event, every save first checks that the stored save is still the one this tab wrote.
- **Pets told to Stay** wait where they were left through a save and reload, even far away, instead of reappearing beside you. Pets keep their actor id and gain an owner (the character id). Saves from before v0.33.1 put a staying pet back at the same spot; a spot that is no longer standable falls back beside you. Following pets behave as before.
- **Tests.** The intermittent target-frame combat check is fixed at its cause (the player could be killed by the boar inside the check window, which ends the boar's fight; nothing isolated the fixture from guards, other creatures or the real game loop). It now runs on clear ground at full health with every hit recorded by source, and guard AI and an arrow already in flight are checked separately. The hover-tooltip delay is timed inside the page. The real v0.28.1 save migration is required (pinned commit, fetched in CI). Browser suites block the Pages deploy again, a new durability suite runs, and CI runs a one-day soak.
- **Not changed:** gameplay, balance, guard and creature AI, content, art defaults.

## v0.33 — Everything merged: skills, creator, stat locks, living world, layered equipment art and NPC wardrobes

One build from the parallel work of #25–#41. Where two or more PRs built the same thing, one was kept and the others ported onto it.

- **Skills and stats (#34 base).** The 49 Second Age skills (#34). The new four-step creator (#33): looks, templates, five starting towns, a skill-driven starter kit. Stat locks (#32/#33). There is one stat engine: natural Strength, Dexterity and Intelligence rise with skill gains. Only a stat set to ▲ Raise grows. At 225, one point moves from a stat set to ▼ Lower, and with none set to Lower nothing changes. Creation uses the late-1999 limits: 80 attribute points (10–60 each) and three skills totalling 100 (50 max). The 65-point option from #33 was dropped.
- **Saves.** v8 is the skill reform and v9 adds looks, stat locks and a character id. Backups: `.pret2a`, `.prev8`. The v0.28.2 recovery screen (restore the last good save, export, delete) is now part of the new title screen.
- **Living World phase 5, step 1 (#31)**, and the v0.29.2 stabilization, popups, target frame and wildlife sheets (#25–#28, #30), are included.
- **Equipment art (#38).** The layered `SF.GEAR` renderer with the Medieval Equipment Art v1 pieces. It is still behind the "New art" toggle in the equipment window. #41's painted human candidates stay behind the developer flag.
- **NPC wardrobes (#39) on SF.GEAR.** Guards wear their region's uniform by rank. Townsfolk dress by role and palette, and change between work and off-duty clothes. Bandits, smugglers and the drowned captain have their own variants. All cosmetic. #39's separate procedural rig was not ported.
- **Superseded renderers (#35, #36, #37, #40).** Their code is not merged. Their art and docs are kept in `docs/archive/superseded-renderers/` and `assets/humans/painted-v2.1/`.
- **Not merged: #29 (v0.28.3).** It fixed the same audit findings as the v0.28.2 stabilization in a different way, and conflicts with it. The v0.28.2 fixes are the ones kept.
- **What is still missing** for sprites, the paper doll and equipment: `docs/art/SPRITES_PAPERDOLL_EQUIPMENT_GAPS.md`.


## v0.32.1 — Painted human candidates (developer flag only)

- **Nothing changes for players.** The new painted bodies are drawn only with `?dev&painted=strict` (or `?dev&painted=bodies`, a QA view) in the address, or from the **PAINTED** button next to DEV. The choice is not saved.
- **192 candidates checked, 101 accepted, 91 rejected.** The exact list and the reason for every rejection are in `assets/humans/painted-candidates-v0.1/qa.json`; the PAINTED button's atlas view crosses out each rejected frame and shows why on hover.
  - No frame facing south survived (each has dark background baked between the legs), and no frame facing north-east (each is really a side view with the face showing).
  - Rejected frames are left out of the game entirely. Nothing is mirrored, copied from another direction, duplicated or redrawn.
- **One path for everyone.** The player, Wren, townsfolk, guards and human enemies all go through the same check, using the same appearance and pose as the layered renderer. Body type follows character creation.
- **Strict mode draws a painted body only when it tells the truth:** the actor wears nothing (no armour, clothing or weapon overlays exist yet), and an accepted frame exists for that state and direction. In every other case the existing renderer draws the actor exactly as before. Running, weapon attacks, death, corpses, ghosts and tools always use the existing renderer.
- **Not shown by these bodies:** the hair, hair colour, skin tone and beard chosen in character creation (hair and skin are baked in). The paper doll is unchanged.
- `assets/humans/painted-candidates-v0.1/missing.json` lists the art still needed. Nothing in it is marked complete.

## v0.32 — Medieval equipment art (preview, off by default)

- **Layered equipment.** What you wear is now drawn piece by piece instead of as one recoloured traveller. Turn it on with **New art** in the paper doll's title bar (or add `?gear=new` to the address). The previous art stays the default until the new art has been reviewed.
  - **Paper doll:** a fitted male or female body wearing the new painted Medieval Equipment Art v1 pieces: armor of every family, helmets, robes, cloaks, boots, belts, shields and weapons.
  - **Materials are separate.** Each piece shows its own material: a valorite chest with mithril arms and iron legs, spined leather with golden studs, a verite blade on a pine grip, a bloodwood bow. Only that material's part of the painting changes, so trim, heraldry, buckles and bow strings keep their paint.
  - **In the world** you, Wren, townsfolk, guards and human enemies wear their gear in all eight directions and in every movement, combat, casting, gathering, bandaging and death animation.
  - **Townsfolk and guards** carry no equipment, so they wear outfits made of existing items. Those outfits are never added to any inventory or loot.
  - **Updates at once.** Equipping or removing an item changes the doll and the world sprite on the next frame.
  - **Corpses** keep the look their owner died in, including after a save and reload. What is looted is unchanged.
  - **Covering rules:** helmets trim or hide hair, closed helms hide the face, and a two-handed weapon hides the off hand in every pose.
- **No gameplay changes.** Items, slots, materials, weights, armor, combat, crafting and saves are as before. Saved corpses gain an optional `gear` field (appearance only), which older builds ignore.
- **Screenshots:** `docs/equipment/shots/`.
- **Still procedural in the world.** World sprites use the original articulated rig from the classic-humans-v2 and layered-armor-v1 packs, coloured from the real materials. The painted pieces are static and are not yet fitted to each animation frame. The art still missing is listed in `docs/equipment/RENDERING.md`.

## v0.30 — Townsfolk can be hurt, and guards fight back (Living World phase 5, step 1)

- **Outside protected ground, creatures may go after townsfolk.** Wolves, hounds, rats, spiders and the undead treat the merchant on the cart road, woodcutters at the edge of the woods and anyone else outside the town walls the way they treat you; inside protected ground everyone is still safe. Deer, hares and other wildlife leave people alone.
- **Townsfolk run and shout for the guards.** Someone who is hit drops what they are doing, runs for shelter and calls out; they remember what attacked them.
- **Guards fight back.** A guard who sees a creature attacking someone (a townsperson, the merchant, you or Wren) within his town's reach, or hears a cry for help nearby, leaves his patrol and fights it with his halberd. Guards wear chainmail and are strong fighters, but they use the same combat rules as you and can lose. He gives up when the creature runs out of the town's reach, and goes back to his patrol.
- **Knocked down, not killed.** A townsperson who loses all health falls and lies there for a minute, then gets up with a third of their health and goes home to recover. NPCs cannot die yet; that comes with corpses and looting later in phase 5.
- **You cannot hurt townsfolk yet.** Your blows and spells pass them by until the law arrives in the next step: criminal and murderer flags, and guards who come after you.
- Tap a townsperson to see their health bar once they are hurt, and *Knocked down* or *Fighting* in the target frame.
- A hurt or knocked-down townsperson stays that way through a save and reload.

## v0.30.0 — The Second Age skills

All 49 classic skills under their own names, with their own mechanics, a working way to train each to 100.0, stats that grow by use,
and old characters carried over point for point. Full status, sources and deviations: `docs/skills/STATUS.md`.

- **Skill gain fixed.** One classic check for every use: a difficulty window that teaches while the use is still a challenge. The old
  ±40 window, the three-uses-per-target limit and the recipe taper are gone. Every skill has a proven road from the trainer's 30.0 to 100.0.
- **49 skills.** Renamed and reworked: Magery, Evaluating Intelligence, Resisting Spells, Poisoning, Hiding, Stealth, Detecting Hidden,
  Stealing, Lockpicking, Remove Trap, Animal Taming, Animal Lore, Peacemaking, Enticement, Lumberjacking, Blacksmithy, Bowcraft &
  Fletching, Tinkering, Item Identification. Added: Arms Lore, Begging, Camping, Cartography, Forensic Evaluation, Herding, Inscription,
  Snooping, Spirit Speak, Taste Identification. Skinning and Foraging are activities now (no skill), their points kept in the skill pool.
- **The mechanics, not just names:** Hiding no longer walks for free (Stealth needs 80 Hiding, a step per 10 skill, armor matters);
  Meditation regenerates as in the Second Age (1/7 to 1 mana a second, the trance doubles it, metal and full hands block it); area
  Peacemaking, Enticement, two-target Provocation; creature-specific taming, control by Taming and Lore, feeding and loyalty; Veterinary
  with Animal Lore; stealing by weight with a chance of being noticed; four poison strengths; lockboxes and trapped boxes to practise
  on, trapped dungeon chests; creature spells you can resist; treasure maps, campfires, scrolls written from your spellbook, magic loot.
- **Stats grow by use** (225 total, atrophy at the cap); no one sells stats. **Creation:** 80 stat points (10–60), up to three skills.
- **Trainers:** each profession teaches its own skills to 30.0 at a gold per tenth (Lessons tab or a word with them).
- **Skills page:** the classic groups, search, real or displayed values, locks, one-tap Use, help and prerequisite badges.
- **Saves:** v7 → v8 once, with a backup; values, locks, gold, gear and the world are kept.
- New tests: `tests/skills.test.js` (+ `skills-gain`, `skills-mech`), `tests/skills-smoke/`.

## v0.30 — Character Creation v2.0

- **A new creator.** A title screen (Continue / New character) and four steps: Identity & Appearance, Starting Profession, Stats & Skills, Starting Town & Review. Dark wood, brass and parchment; works with mouse, keyboard and touch, from desktop down to a small phone held either way.
  - **Male or female**, skin tone, hairstyle, hair colour, facial hair, shirt colour and cloak. A live portrait shows every choice and the world sprite (turnable) shows your skin and cloak. Appearance never changes stats, gear, weight or combat. Female sprite sheets and hair, beard and clothing layers are not drawn yet: see *Missing art* below.
  - **Twelve editable templates** (Swordsman, Maceman, Fencer, Archer, Mage, Blacksmith, Carpenter, Rogue, Healer, Bard, Animal Tamer, Advanced). They only fill in numbers; change anything and you are Custom. There are no classes.
  - **Early Second Age start:** 65 attribute points (each 10–45) and 100 skill points over two or three different skills (each up to 50). Counters, sliders, ± buttons and typed values can never overspend. Every other skill starts at 0.0 and every lock at Raise.
  - **Five starting towns:** Saltmarsh Quay (the tutorial, recommended), Vespar, Mynoc, Skara Bryn and Moonglen. You start beside the town shrine with your soul bound there.
  - **A starter kit that follows your skills:** plain clothes, journal, food, 100 gold, 10 bandages, and a weapon or tool for each skill that uses one (a sword, mace, dagger or bow you are strong enough for, a buckler beside a one-handed weapon with Parrying, pickaxe, hatchet, tongs, sewing kit, rod, lockpicks, a lute, a first-circle spellbook with its reagents). Starter tools and clothes cannot be sold back.
  - The review lists everything before you begin; Begin stays disabled, with the reason, until the character is valid. Starting a new character over a saved one asks first, offers a download of the old save, and keeps a copy.
- **Attributes grow naturally.** Using skills raises Strength, Dexterity and Intelligence (up to 100 each, 225 together). Each attribute has a lock on the Character page and the paper doll: ▲ raise, ■ hold, ▼ lower; at 225 a gain takes a point from an attribute set to Lower. Trainers no longer sell attribute points.
- **Classic skill names everywhere:** Magery, Evaluating Intelligence, Resisting Spells, Hiding, Stealth, Detecting Hidden, Stealing, Lockpicking, Remove Trap, Animal Taming, Animal Lore, Peacemaking, Lumberjacking, Blacksmithy, Bowcraft & Fletching, Tinkering, Item Identification, Poisoning. Saved skill values are untouched.
- **Saves:** v8. Old characters keep their stats (even above the new creation limits), skills, items, position and quests, get attribute locks and a character id, and are never given a second kit. A copy of the v7 save is kept once.

### Missing art

Female sheets, an unhooded base body, and hair, facial hair, cloak and clothing layers for every clip and facing, plus front-view paper-doll bodies. Details: `docs/design/character-creation-v2-status.md`, list: `assets/character/missing-character-art.json`.

## v0.29.2 — Everything merged: stabilization (v0.28.2, #27) + backpack popups, target frame and wildlife sheets (v0.29.1, #28)

- One build with every open branch together; it replaces PRs #25, #26, #27, #28 and #29. Nothing new beyond what those builds contain.
- #29 (v0.28.3) fixed the same audit findings as #27 independently; this build keeps #27's fixes (recovery screen, CI, soak) and drops #29's duplicate code.

## v0.29.1 — Everything merged: backpack popups and target frame (v0.29, #25) + wildlife sheets (v0.28.2, #26)

- One build with both open branches together; it replaces PRs #25 and #26. Nothing new beyond what those two builds contain, described below.
- Also brings in the v0.28.1 stabilization audit (`docs/audits/v0.28.1-stabilization.md`).

## v0.29 — Backpack popups and a compact target frame

- **The backpack stays still.** Selecting an item no longer puts its card above the grid, so the grid never jumps or scrolls, even at the bottom of a large pack. The tiles, sorts, filters, stack counts, weight bar and the weight-only limit are unchanged.
- **Item tooltips and popups.**
  - Desktop: rest the pointer on an item for about 300 ms for a compact tooltip beside the cursor; it never runs off the screen and goes when you move away.
  - Click (or tap on a phone) for the item's popup beside the tile. It shows only what applies to that item: material, quality, weight, durability, damage or armor, weapon speed, required skill and Strength, magical properties, quantity and a short description where the item has one. Its buttons do what the old card did (Equip, Use, Split half, Split 1, Slot, Repair, Appraise, Drop), plus **Inspect** to compare with what you wear.
  - On phones the popup has 44 px buttons and never resizes or moves the backpack.
  - Close it with ×, Escape or a tap outside. A tap on the game world only closes it: you don't walk, target or attack.
  - **Dropping valuable things asks first:** anything worth 25 gold or more, or exceptional, rare, magical, marked or maker-signed items, from the popup, the right-click menu or the paper doll.
- **A compact target frame.**
  - Hidden until you pick something: tap or click a creature, person, deposit, tree, corpse or fishing water, or use Attack, Tab or Interact. Walking past things never opens it, and picking something else replaces it at once.
  - It sits at the top centre, about 248 px wide on desktop and 208 px on phones, as tall as its contents. The × is a 44 px button, and taps on the rest of the frame pass through to the world.
  - It shows what matters for each kind of target:
    - creatures: hostility, what they are doing and a health bar;
    - townsfolk: role, a quest mark and Talk, Trade or Bank;
    - deposits and trees: the wood or ore once surveyed, the skill needed, what is left, and Mine or Chop;
    - remains: Loot, and loot rights on bodies that have them.
    Rarer actions (Tame, bard songs, Pickpocket, Anatomy, Dismiss) sit behind **⋯**.
  - **It clears itself** when:
    - you go beyond the retention distance: 12 tiles for characters and creatures, 5 for resources and objects (`TARGET_RETAIN` in `src/hud-ui.js`);
    - the target despawns, dies with nothing left to loot, hides, or the resource is removed;
    - you travel (moongate, stairs, boat) or change level;
    - you press × or Escape.
    A one-tile margin and a short grace stop it flickering at the edge, and something picked from further away is kept while you walk to it. These are retention distances only: attack, spell and interaction ranges are unchanged.
  - **Closing it ends your armed swing** on that target, as the × always did. It never starts an attack, uses an item or stops anything else.
- **Escape** now closes, in order: the item popup or menu, then the open panel, then cancels a cast, aim, task or armed attack, and then clears the target.
- No change to items, statistics, combat, the world or the save. Open popups and the target are not saved.
- New test: `tests/ui-smoke/run.py`. The backpack, equipment and combat browser tests now use the popup, the delayed tooltip and the shorter frame buttons.

## v0.28.2 — Stabilization (no new gameplay)

Fixes from the v0.28.1 technical audit (`docs/audits/v0.28.1-stabilization.md`; results in `docs/audits/v0.28.2-results.md`). Combat, balance, world, graphics and item IDs are unchanged, and existing saves load as before.

- **Items can no longer be duplicated or destroyed by bad moves.** Moving, dropping and taking only accept whole quantities from 1 to the stack size; moving into the same container, splitting a single item or moving a damaged item is refused with nothing changed. A dropped item reaches the ground only after every check has passed, so it can never end up both on the ground and in your pack or bank.
- **What a save keeps.**
  - Items you drop stay on the ground through a reload, for the time they had left.
  - A chest you opened keeps what you left in it and stays open until it relocks; a reload no longer refills it.
  - A spell you were preparing when the game was saved counts as interrupted on load: the reagents or scroll come back and half the mana is spent, exactly as Cancel, once.
  - Poison carries on after a reload.
- **Damaged saves.** A save that cannot be read no longer stops the game or gets overwritten: the start screen explains, and offers the last good save, an export, or deleting it after a confirmation. Making a new character keeps a copy of the old save. A save with a repeated item or a fractional stack is repaired on load without losing anything. If the game is open in two tabs, only the newest one saves. A full browser storage is reported.
- **Steadier.** Bank, shop and trainer buttons check that you are still at the counter. An error in drawing no longer stops the world, and the reverse. Switching away from the game releases held keys and the stick. The sound player's memory stays capped.
- **Display.** The loot window and backpack show the same weight line (everything you carry against your limit), not the old 45-stack limit; dropped piles and chests no longer say "criminal to loot for NaN s".
- **Checks.** Every push runs all rules suites, build freshness, asset manifests and every browser suite; Pages deploys only after they pass. New tests: `tests/inventory.test.js`, `tests/stability-smoke/run.py`, `tests/check-build.py`, `tests/soak/run.py`.

## v0.28.2 — Wildlife sheets (bestiary v1.1.0 draft01)

- **Six creatures get painted, animated sprites** in place of their code-drawn stand-ins: the reed boar, marsh hound, mud snapper, mire spider, red deer and brown hare. Each has 8 facings with idle, walk, wind-up and impact poses, at the same size as before.
  - Their stats, behaviour, spawns, loot, sounds and attack timing are unchanged. Deer and hares still bolt from you.
  - The other procedural creatures (bear, wreck crab, ash wisp, bell sentinel, the Bellkeeper) and the scout-tinted ones (drowned captain, smuggler, bandit) keep their current look until their sheets are finished. The 11 v1.0 bestiary sheets and the rat and skeleton sheets are untouched.
- **Tamed creatures with sheets now show their strike** (impact, then recover) when they attack for you. Before, a tamed dire wolf kept walking while it bit.
- **No invisible creatures while sheets load.** A creature whose sheet has not decoded yet is drawn with its code-drawn art for that moment.
- **Polymorph forms** use a bestiary sheet when the form has one.

## v0.28.1 — Life around Vespar (fix)

- **The wilds between towns are no longer empty.** Before, any 150 m stretch of land that touched a town got only a pair of hares and a few deer, and one spawn point per kind for the whole stretch, so the roads out of Vespar felt dead.
  - Land bordering a town (outside the Saltmarsh starter slice) now has the classic town-edge pests and small hunters: rats, marsh hounds and boars, and mire spiders and snappers in the swamps. Their spawn points stand at least 28 m back from protected ground, and creatures still never enter towns or attack you inside them.
  - Outside the starter slice every group of wildlife now has two homes in its stretch instead of one. That is about 940 creatures at the start (was about 475). Forests also get boars, open plains away from towns marsh hound packs, and wild swamps mire spiders.
  - Within 60 m of Vespar's walls: about 33 creatures (was 16). The Saltmarsh starter area is unchanged.
- **Strollers stroll again.** Townsfolk who wander the market picked the same spot every time and so stood still after their first walk. Each stroll now picks a new spot.

## v0.28 — Every town keeps its own day (Living World phase 4, part 2)

- **Skara Bryn and Moonglen come alive too.**
  - Maeve's inn in Skara Bryn and Pell's inn in Moonglen open mid-morning and stay open until 1 in the morning.
  - The bowyer, the fletcher and Magister Orrin keep shop hours.
  - The archivist works days at the library. Astronomer Iska works nights at the observatory and sleeps through the morning.
  - Skara Bryn has no houses, so its people live in at their shops and the inn; the college people live in the college hall.
- **New residents:** Bryn the forester and Ysolde the herb gatherer in Skara Bryn, and two students, Tibbet and Mira, who study at the library and gather at the college in the evening. Bryn fells the woods around Skara Bryn and sells the wood to the fletcher.
- **Townsfolk remember you.** Talk to someone once and next time they greet you by name, as do shopkeepers at the counter. A closed shop apologises by name.
- **Memories last.** What townsfolk remember, how hungry and tired they are, what they carry and their purses are saved with your game, along with the town stores and where the travelling merchant is.
- **Steadier walking.** A townsperson who stops getting closer to where they are going for 6 seconds gives up that path. If they are close, they count as arrived; if not, they try a new path. Miners and woodcutters now sell their haul across the counter, so a crowded counter can't strand them.

## v0.27 — Towns come alive (Living World phase 4: living NPCs)

- **Vespar and Mynoc keep a daily rhythm** (all four towns since v0.28). Every shopkeeper has a home and a working day. The forgemistress wakes at 05:30 and is at the forge by 06:00. The tailor, the tinker, the supplier, the fishmonger and the mine stores open about 06:30. Everyone breaks for a meal at noon, gathers at the hall (Vespar) or the forge yard (Mynoc) in the evening, and goes home to sleep around 22:00. At night the shops are shut: knock and you are told when they open. **Banks, healers, the ferry, the boats and Saltmarsh Quay never close.**
- **New residents.**
  - In Vespar: Nell the fisherwoman, Garrick the dockhand, and townsfolk who stroll the market.
  - In Mynoc: two miners, Durn and Kessa, Fennick the woodcutter, and Mabry the cook.
- **Real work.** The miners take ore from the same rock faces in Mynoc Mine that you mine. They work the deep faces first, but a face they have worked needs time to refill. The woodcutter fells trees outside town and the fisherwoman fishes from the harbour. Each carries the haul to the mine stores or the fish hall and is paid for it.
- **Guards patrol** in all four Anniabreen towns, walking a round of doorways and the shrine. At night one guard per town keeps watch at the gate while the rest keep walking.
- **Tobin, the travelling merchant**, sells for an hour at the Mynoc market, then walks the cart road to Vespar's market and back, by day only. Catch him at either market. On the road he will only chat, and if he spots a wolf he hurries past.
- **Townsfolk notice danger.** A woodcutter who sees a wolf drops his axe and runs for shelter, remembers it, and goes back to work once it is safe. Talk to him later and he will warn you.
- **They remember and they need.** Each person has light needs (hunger, tiredness, company, safety) that bend the routine, and a short memory of recent encounters. The developer panel's inspector shows both, along with the schedule and why they are doing what they do.
- **A reload resumes the day.** Load at night and everyone is already at home, not walking back from their counters.
- Crowds spread out at the hall and at doorways, and people go through a door one at a time.

## v0.26 — everything merged: equipment (v0.25, #19), missing icons (v0.24.1, #18) and the monster ecosystem (#20)

- One build with the three open branches together. The equipment work and the monster ecosystem were both numbered v0.25; this build is v0.26 and replaces PRs #18, #19 and #20.
- Saves: the equipment save (v7) carries the ecosystem's `eco` block (camp clearances); v6 and older saves migrate as before.

## v0.26 — The living wilderness (Living World phase 3: the monster ecosystem)

- **Creatures live their own lives.** Every species has a profile: faction, habitat, waking hours, temperament, senses, territory, how far it will chase, what it hunts, whether it lives alone, in a pack or in a camp, and when it gives up a fight.
  - **Wolves hunt deer.** Packs move together behind a leader, chase down prey, and stay to feed on a kill. Hungry hunters track prey by scent; a fed one leaves the herds alone for a while.
  - **Deer and hares** are new, peaceful wildlife on the plains and in the woods. They graze and wander, bolt from wolves and from you, run together as a herd, and drift back home once it is quiet. **Bears** are new too: solitary, territorial and strong.
  - **Monsters fight each other.** Orcs, the undead, wolves, trolls and lizardmen each have their enemies. Skeletons attack anything living; orcs hunt wildlife and fight lizardmen and trolls. None of this needs the player. Killing a hostile creature is never a crime.
  - **Night changes things.** Skeletons are dormant by day and roam at night, and the graveyards fill with extra dead after dark that sink back to their graves at dawn. Wolves and hounds are dusk hunters with night vision. Most other creatures see only half as far at night, and deer and hares sleep in the small hours.
  - **Creatures see and hear, they do not know.** They notice what is in their sight (shorter at night, much shorter asleep) or what moves within earshot, and they call their kind for help. **Hiding works against all of them.**
  - **Pursuit limits.** A creature chases only so far from its ground, then walks home (along a real path when it is far).
- **Camps remember.** The eight camps and the dungeon-mouth guards are persistent populations. Orcs send patrols down their trail toward the road, and bandits go out to watch it. Clear a camp and it stays empty (through a reload too) for about 25 minutes, then members return one at a time until it is whole again.
- **A fuller world.** About 470 creatures at the start (was about 210), spread over ~100 habitat regions: forests, plains, mountains, swamps, graveyards, camps and dungeon levels. They spawn only out of sight (never within 22 m of you), never in towns, and no wolves, bears, trolls or orcs live in the Saltmarsh starter area. Distant idle creatures think at a quarter rate, so a simulation step still costs about half a millisecond.
- **Creature sound.** Every species with a sound plays it when it spots its prey or its enemy, attacks or dies. Dire wolves use the marsh hound's voice, bears the boar's and giant spiders the mire spider's (documented stand-ins). Nearby creatures call now and then, and at night you may hear wolves in the distance. Species with no sound yet stay silent rather than borrow a wrong one.
- **Developer panel (`?dev`):** creatures by faction, regions with counts and caps, every camp (alive / cap, cleared, recovering, on a sortie), ecosystem counters, a faction matrix, and per-creature decisions with their reasons. The perception overlay shows sight and hearing; the territory overlay shows territory and pursuit limit.
- The save gains a small `eco` block (camp clearances); older saves load unchanged.

## v0.25 — Equipment, paper doll, inventory and armor

- **Paper doll.** Press **C** (or Menu → **Equip**, or Character → **Paper doll**): a window you can drag and close, with your character in the middle and 18 slots around it. Head, neck, chest, arms, hands, legs, feet; main hand and off hand; cloak, ring, bracelet, necklace, belt; shirt, trousers, robe and tabard. A shirt can go under plate and a robe over it.
- **Handling gear.** You can:
  - drag between the backpack and the slots (on a phone, hold an item for a moment, then drag);
  - double-click or double-tap to put a piece on or take it off;
  - right-click, or long-press on a phone, for a menu.
  
  Two-handed weapons and bows clear the off hand. Strength requirements are checked. A failed change puts everything back.
- **Armor pieces.** Each piece is its own item, and you can mix families and materials freely:
  - cloth and leather;
  - studded leather, which uses rivets of any metal as studs;
  - bone;
  - ringmail, chainmail and platemail;
  - six metal helmets;
  - metal and wooden shields;
  - dragon scale (craftable, but there is no source of dragon scales yet).
  
  Each blow lands on one part of your body: torso, legs, arms, head, hands or neck. Only the armor on that part protects you. The **Armor rating** on the doll is what an average blow meets.
- **Materials.** Every metal makes every metal piece. **Mithril** is new: the lightest metal (a Mithril plate chest weighs 6.3 against 14 for iron). Valorite protects best. Leather pieces can be made from eight kinds of hide. Thick, wolf, spined, horned, troll and barbed hides come from skinning; bones come from skinning, skeletons and the Lich Lord.
- **Crafting.** The bench and the anvil have an **Armor** tab with families. Choose the material (and the stud metal for studded pieces) and see:
  - the chance of success and of exceptional work;
  - the finished weight, protection and durability;
  - the requirements.
  
  Exceptional pieces protect a little more, last longer and carry their crafter's name.
- **Durability and repair.** Armor wears where it is hit. A broken piece stops protecting but is never destroyed. A repair at a higher skill is less likely to lower the maximum durability.
- **Weight.** Weight is shown in weight units. You can carry 40 + 3.5 × Strength (215 at Strength 50), worn gear included. The backpack has no slot limit.
  - Above 75 %, sprinting costs more stamina.
  - Above 100 %, you are slower and cannot run.
  - Above 125 %, you cannot move until you drop something.
  
  Pickups and purchases that would overload you are refused.
- **Backpack.** Search, seven sorts, filters, split and merge stacks, and an encumbrance bar. A pack of hundreds of items still scrolls smoothly.
- **Tooltips everywhere.** Point at an item (tap on a phone) in the backpack, on the doll, in the crafting window, at a vendor, in loot or at the bank. The tooltip shows:
  - armor family, slot and material;
  - protection, weight, Strength, Dexterity and meditation;
  - durability, quality, crafter and value;
  - a green and red comparison with what you wear.
- **Vendors** sell the pieces in iron and plain leather. Old one-piece suits are no longer sold.
- **Saves move to v7.** A worn or stored v0.24 suit becomes its pieces. Material, quality, crafter and wear are kept. The old save is kept once as a backup.
- Details: `docs/equipment/STATUS.md`. Missing art: `assets/equipment-icons/missing-icons.json`. Your character's look in the world does not change with equipment yet.

## v0.24.1 — the seven missing inventory icons

- **Backpack icons v1.0.1.** The heavy crossbow, battle axe, mace, war axe, kryss, spear and the dry wick (the Quaywarden's *A Light for the Quay*, the storm-drowned Shore Beacon) now have painted icons instead of a category glyph. Every item in the game has its own icon.
  - The supplied 64 px PNGs (`assets/backpack-icons/v1.0.1/icons_64/`, branch `assets/missing-inventory-icons-v1.0.0`, commit `332a654`) are pasted into the atlas unchanged, in the free cells after the v1.0.0 icons; the atlas grows from 1024×640 to 1024×704. The 154 v1.0.0 tiles keep their place and every pixel.
  - `tools/embed_backpack_icons.py` builds the extended atlas and refuses to overwrite an icon that already exists.
- **Icons beside items everywhere.** The same atlas tile now sits in front of item rows on the Character panel (equipped gear), at vendors (buy and sell), in loot windows, at the bank and in crafting (recipe rows show what they make, inputs show what they use). Text, buttons and prices are as before.
- Item stats, prices, equip rules, crafting and quests are unchanged.
- New test: `tests/backpack-smoke/panels.py`.

## v0.24 — everything merged into one build

- One build with every open branch together: the world expansion (v0.23) with Living World phases 1–2 and Anniabreen v1.0, plus the two fixes made in parallel on v0.19:
  - **Gear menu fix (was v0.19.1, #14).** Menu → Gear opens the Character panel again; the weapon line shows the real Second Age swing time. A panel that fails to build now closes cleanly and gives the hotbars back.
  - **Backpack icons v1.0.0 (was v0.19.2, #15).** Backpack tiles, the desktop tooltip and the phone tap card show painted icons for 154 items; stack counts sit on a readable badge. Seven items with no painted icon yet kept their category glyph (heavy crossbow, battle axe, mace, war axe, kryss, spear, wick); they got theirs in v0.24.1.
- The Living World tests read the version from the build itself, and the save-migration test finds the v0.22 build by its commit, so they keep working after the old branches are merged and deleted.

## v0.23 — A bigger world: the Southern Reach, camps and dungeon mouths

- **Twice the land.** The world grew from about 1.9 to about 4 million tiles.
  - **Longer roads.** The four Anniabreen towns are exactly as they were, street for street, but the wilds between them are a third wider. Mynoc to Vespar by the cart road now takes about 104 seconds (was 78); the fork to Mynoc about 91 (was 67).
  - **The Southern Reach**, a new land across a strait, reached by the **Long Causeway** south of the forest fork:
    - **Southwatch** crossroads has a shrine to bind at and return to.
    - **Mirefen** is a swamp of pools and reeds.
    - The **Greyspine** range has cliffs and richer ore.
    - The **Ashen Barrows** is a field of old graves.
- **Eight camps** in the wilds, each marked on the map with a trail to the nearest road:
  - Cutpurse Hollow (road bandits)
  - Greywolf Den (dire wolves)
  - Silkwood (giant spiders)
  - Trollgate (trolls and an ettin)
  - Harpy Roost (harpies)
  - Kragmaw Camp (orcs, behind a palisade)
  - Scalemire (lizardmen and bog slimes)
  - Ashen Barrows (skeletons)

  Their creatures respawn for now. Persistent camp populations that patrol, defend and recover come with the next Living World phase.
- **Five dungeon mouths:** Hollowdeep, Wyrmhold, Liar's Keep, Sorrowstone and Gilt Maw. They are placed, lit and labelled; some are guarded. **They are sealed:** trying one tells you so. Their halls will be built one by one.
- **Saves move to v6.** A character, body, recall rune, shut door or worked ore face in Anniabreen moves with the map, and nobody loads inside a wall. The previous save is kept once as a backup.
- Starting the game takes a little longer (about 1.7 s on a desktop, was 1.0 s) because there is twice as much land to build.

## v0.22 — Living World, phase 2: clock, light and travel

- **The world clock.** A day now lasts two hours of play (five minutes an hour), with dawn, daylight, sunset, night and deep night. The clock under the minimap shows the time and a sun or moon. The time of day is saved; an older save keeps the hour it was at.
- **Day and night.** The light changes smoothly: a warm dawn, an orange-red sunset and a blue night that stays readable. Lamps, forges and fires glow, and doorways are lit after dark. Fire and magic in flight carry light. Dungeons stay dark at any hour. Night Sight now lifts most of the dark instead of turning night into day.
- **A steady simulation.** The world runs in fixed 50 ms steps whatever the frame rate, and movement is smoothed between steps on screen. While the game is hidden, the world waits.
- **Travel.** Characters can now find their way across the whole map:
  - Paths go around walls, trees and water and prefer roads.
  - Doors are opened and closed behind; creatures that cannot open doors stay out.
  - Journeys can include the ferry, the boats, the Quay packet, the moongates and the dungeon stairs.
  - A traveller who gets stuck tries again and, if there is no way, turns back.
  
  In this build only test travellers from the developer panel use it; townsfolk routines and roaming creatures build on it next.
- **Developer panel** behind `?dev` (above).
- New tests: `tests/world-smoke/phase2.py` (36 checks in Chrome) and 33 more node checks in `tests/world.test.js`.

## v0.21 — Living World, phase 1: actors and events

The first step of the Living World roadmap (`docs/WORLD_SIMULATION_MASTER.md`, progress in `docs/WORLD_SIMULATION_PROGRESS.md`). Groundwork only: play is unchanged.

- Every actor has a stable id that survives saving and loading: `player:p1`, `npc:odile-banker`, `npc:wren`, `mon:rat:42`. Creature numbers are never reused.
- Every actor has an archetype (player, civilian, merchant, guard, hireling, criminal, monster, animal, pet, summon) and a controller. The update loop drives actors through their controllers. A tamed creature keeps its id and becomes a pet.
- One damage entry for blows and spells, whoever deals or takes them. A creature, the player or Wren dies exactly once: one corpse, one loot roll.
- Important actions leave structured events with simulation time and actor ids: spawn, removal, damage, death, gathering and crafting. The log holds the newest 256.
- Dungeon chests and dungeon creature types are now the same in every session.
- Saves move to v5, an additive `sim` block. Older saves load unchanged, and an older build still reads a v5 save.
- New tests: `tests/world.test.js` (node) and `tests/world-smoke` (Chrome), including a seeded run that is identical step for step.

## v0.20 — Anniabreen v1.0

- A new world east of Saltmarsh, after classic Britannia's four towns, with original coastlines and streets:
  - **Mynoc** at the head of the valley under the northern ridge: the public forge's chimney is the first thing you see from the south road; smith, ore scales and a bank facing the anvil; miners' cottages to the west; the mine cut into the cliff with timber portal, cart siding and spoil heap, and a walkable first chamber of ore faces (grade 1 at the front, grade 2 at the back).
  - **Vespar** where the river splits into three channels: the road from Mynoc arrives on the west bank by a small cemetery; a stone bridge to Market Island (the bank opens onto the square), a timber bridge to Workshop Island (tailor, tinker, supplies), Customs Bridge to Customs Island (warehouses, fish hall, the harbour), a quay route back via a footbridge, and a footbridge to the east bank.
  - **Skara Bryn** split by a narrow channel: fields, stable, ranger hall and ferry landing on the mainland; inn, bank, bowyer and fletcher round an old tree on the island, an archery range behind, and an orchard with the moongate.
  - **Moonglen** across the water from Vespar: harbour, reagent seller and inn, the walled college (bank and mage by the south arch), library and observatory dome through the far arch, a herb-garden loop, and the moongate among three standing stones.
- Roads: forest road from Skara's landing to a signposted fork with a broken watchtower; north to Mynoc, east to Vespar; the ore-cart road Mynoc–Vespar past a waterwheel and **Miner's Cross** (sign: Mynoc Mine / Vespar Docks).
- Travel: the Skara ferry and the Vespar–Moonglen boat both work in both directions with one interaction; the **Quay packet** links Saltmarsh Quay and Vespar. Three public moongates (Miner's Cross, Skara Bryn, Moonglen): step in or Interact for a small picker (tap or click, Cancel); you step out on clear ground beside the gate, outside the radius that opens it.
- Walking times at normal speed, measured by the walk-through test: forge → first ore face 19 s · Mynoc forge → Vespar market by cart road 78 s · Skara landing → fork 48 s · fork → Mynoc 67 s · fork → Vespar 77 s · Moonglen harbour → college 24 s.
- Woods and rock fields are passable: trees, rock faces and shrubs block only at the trunk or boulder, Anniabreen woods keep at most one tree in each 3×3 patch, and Saltmarsh's woods and rock outcrops are thinned too.
- The minimap and the full map are both **north-up** with an N marker (the minimap used to be turned 45° to the view). The map shows towns, roads, river channels, ferry and boat routes, moongates and you; on a phone it shows the four town names and travel symbols first. **Fit** frames the land you are on, **World** shows both.
- New characters still start at Saltmarsh Quay; quests, NPCs, encounters and saves carry over. Saves move to v4 (tile-keyed node and survey records follow the wider grid).

## v0.19 — everything together

- One build with every finished feature branch: sound pack v1.0.0 (#2), online web build and area music (#8), audio handoff (#7), bestiary v1 art and creatures (#4, #6) and the graphical backpack (#5).
- Opened straight from disk, the game no longer tries to download sound (browsers refuse it and logged an error for every take); serve the folder or use the online link for sound.
- Second Age combat and First Aid (#9) is in. The sound pack is rewired to the new resolver: a swing or release sound on every attempt (yours, Wren's), one impact per landed blow (flesh, bone, armor, blunt for maces and fists, shield on a parry), a shield or armor sound when a blow is fully absorbed, the ward sound when a spell soaks it, and the bandage sound when an application starts. Wren's hits, fall and return have sound too.
- The backpack card now names the weapon's skill, speed, Strength and hands, and bandages offer Bandage self, Bandage other and Slot other.

## v0.18c — Second Age combat and First Aid (built in parallel, #9)
- Combat skills are now Swordsmanship, Mace Fighting, Fencing, Archery, Wrestling, Parrying and Healing. Each weapon uses its UO profile: real dice, speed, STR, hands; the pack names its skill.
- Hit chance is your weapon skill against the defender's; Tactics, Anatomy and Strength set damage; armor absorbs part of each blow; a shield parries at half your Parrying; player recipients take half. Maces and war hammers drain stamina and wear armor.
- Swing speed comes from the weapon and your current stamina (quarter-second ticks, 1.25–10 s). One swing timer: a ready swing survives a target change, an unequip or a held spell; equipping during recovery restarts it.
- Bows and crossbows reload while you move but need you to stand still to aim; one arrow or bolt per release; the shot lands a second later.
- First Aid: bandage yourself (15 s; poison 18 s) or another (5 s; poison 6 s; resurrection 10 s). Cure at 60/60, resurrect at 80/80. Blows make your fingers slip. The application is saved with the game.
- Wren, a sellsword at the plaza, follows you on request, fights by the same rules, and can be bandaged or brought back from a ghost.
- Old saves migrate once (snapshot in `shardfall.save.v1.precombat`); merged points wait on the Skills page. Details: `docs/combat/STATUS.md`.

## v0.18b — Bestiary v1 (built in parallel with the music v0.18)

- Eleven creatures from the bestiary pack are in the game data and renderer: orc, ettin, troll, lizardman, gargoyle, earth elemental, giant spider, dire wolf, harpy, slime and the Lich Lord (boss).
- Sprites follow the existing combat states: neutral when standing, the walk cycle while moving, the wind-up pose for the whole telegraph and the impact pose on the strike resolution, then recover. Facing is locked from the telegraph to the end of the swing.
- Sheets are drawn untouched (no outline, tint or alpha cut), so the Lich Lord's turquoise rim and gold glints show as painted.
- Not yet: spawn placement, balance (stats are provisional placeholders), dedicated death art. Corpses use the standard bones. To see one, run `__SF.spawnMon('lich_lord')` in the browser console.

## v0.18 — online play and music

- The game is now a small web page (3.7 MB instead of 22 MB) published on GitHub Pages. Sounds are separate small files (2.1 MB in all instead of 14 MB) that download quietly after the first tap.
- Music: the five Saltmarsh tracks play by area — town, shore, road, marsh, ruins — with a soft crossfade. Each track downloads only when you first reach its area. Menu → **Music on/off**, remembered.

## v0.17 — sound pack v1.0.0

- 107 recorded sound events replace the old synth beeps: weapons by family timed to the contact frame, distinct impacts (flesh, bone, armor, blunt, shield), creature alerts, wind-ups and deaths, magic, gathering, crafting, loot, UI, quests and sparse ambience.
- World sounds pan with the view, fade with distance and stay silent for hidden foes and rooms out of sight. Up to 14 voices; mute is remembered; audio starts from your first tap or key press and pauses in the background.
- Kit building doors now open and close (Interact, E or tap the door), block movement when closed, and are remembered in your save. Older saves load with every door open.
- Footsteps follow the surface: timber piers and floors, stone, grass, dirt, sand, mud and shallows. A cobbled quayside now joins the piers to the plaza road.

## v0.16 — Cancel cast

- A dedicated **✕ Cancel** button appears above the hotbar while a spell is being prepared or held, with the time left. During preparation it counts as an interruption (half the mana, reagents back); a held spell is let go unused, with the normal 0.35 s recovery. Esc does the same.

## v0.15 — Magery: the Eight Circles

- The 64 classic spells replace the launch book: Shardfall names and chants, 1998 reagent recipes, eight new reagent items, sign art in the book and on the hotbar.
- Spellbook item: learn a spell by adding its scroll; cast from a scroll for a two-circle easier check. Magic starters get 10.0 Spellcraft and Lesser Mend + Arcane Arrow.
- Tap a slot to prepare (mana and reagents reserved), the spell is held for 3 s, then tap a target to release. No automatic targeting; a wrong tap keeps the spell.
- Resistance uses the recipient's Wardcraft; damage follows the book's dice and Focus formula. Fields, runes and gates, summons, wards, hexes and boons work in the world.
- Old saves migrate once (snapshot in `shardfall.save.v1.premagery`): genuine equivalents move to the new book and hotbar; launch-only spells like Sable Curtain keep working from old bars.

## v0.14 — crafting guide, build step 1

- Nine metals and seven woods as materials; each coloured ore, ingot and log has its own item ID.
- Rocks and trees roll a regional specialty per generation, deplete and refill on a timer, and persist in the save. Survey reveals stock and, at the gate, the material.
- New crafting screen: category → recipe → full preview (inputs, metal, tool uses, success and exceptional odds, failure cost), batches of up to 20.
- Exceptional quality, metal durability and mass, 100-use work tools, guide repair formula.
- Quests: Dena's *A Vein by the Water* (Mining) and Mara's *Holdfast* (Blacksmithing), a Guilds journal tab, tracking arrow and map pins.
- v1 saves migrate to v2 automatically; the original is backed up to `shardfall.save.v1.backup`.

Next: guide steps 2–4 (full smith pattern table, woodworking and carpentry, order boards).
