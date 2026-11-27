# Shardfall

A T2A-era Ultima Online-style 2.5D isometric sandbox RPG for phones, built as a single-file web game.

## Play

**Online:** every merge to `main` publishes the newest build on GitHub Pages (`.github/workflows/pages.yml`; one-time setup: Settings → Pages → Source: GitHub Actions. Pages on a private repository needs a paid GitHub plan, and the site itself is public): `https://shardfall-dev.github.io/Shardfall/`. On iPhone, Share → Add to Home Screen gives it an app icon.

**On your computer:** run `python3 -m http.server` in this folder and open `http://localhost:8000/Shardfall_v0.30.html`. The game loads its sound and music from `assets/audio/web/`, so it needs to be served like this; opened straight from disk it plays silently. For a single file that plays from disk with sound effects, build `./build.sh 0.30 --offline`.

**Developer panel:** add `?dev` to the address (for example `http://localhost:8000/Shardfall_v0.30.html?dev`) and press the small DEV button. It shows the world's live numbers (creatures by faction, regions, camps and what the ecosystem has been doing), lets you set the time, pause or fast-forward the simulation, send test travellers anywhere and inspect any actor you tap (a creature shows its faction, activity, what it decided and why, its senses, pack, camp and sound). Without `?dev` it does not exist.

Progress saves to the browser's local storage.

## Layout

- `src/head.html` — page markup and CSS (HUD, panels).
- `src/rules.js` — the pure rules module (`SF`): items, skills, recipes, materials, crafting and repair math, and the Second Age combat and First Aid rules. No DOM.
- `src/stats.js` — the attribute progression module (`SF.STATS`): natural Strength, Dexterity and Intelligence grow by using skills; locks (raise / hold / lower), the 225 cap transfer, the skill → attribute weights, the gain cooldown and its own random stream. No DOM.
- `src/creation.js` — the character creation rules (`SF.CREATION`): the shared validator (`validate`, used by the creator, boot and a future server), appearance allowlists, the twelve starting templates, the five starting towns, the skill-driven starter kit and the save conversion of appearances. No DOM.
- `src/equipment.js` — the equipment rules module (`SF.EQ`): 18 equipment slots, armor families and pieces, material variants (metals, hides, cloth, bone, dragon scale), body-region armor, weight units and carrying capacity, encumbrance, effective attributes, durability and repair risk, the validated item commands (`equipItem`, `unequipItem`, `moveItem`, `dropItem`, `pickupItem`, `splitStack`, `mergeStacks`, `craftItem`, `repairItem`), appearance data and the v0.24 → v0.25 save conversion. No DOM.
- `src/magery.js` — the Magery rules module (`SF.MAGERY`): the 64 spells (data from `docs/magery/spells.json`), success, resistance, damage, statuses, save migration. No DOM.
- `src/audio.js` — the Web Audio player for the sound pack (`SFXA`).
- `assets/audio/` — sound pack v1.0.0: `manifest.json` and mono WAV takes (the masters).
- `assets/audio/web/` — the small AAC copies the game loads (sound 2.1 MB, music 4.9 MB), made by `tools/encode_web_audio.sh` (needs ffmpeg). Re-run it after changing a sound.
- `assets/music/v1.0.0/` — the Saltmarsh soundtrack: five MIDI sources, MP3 renders and `soundtrack.json`.
- `src/assets.js` — embedded sprite sheets and art (data URIs; large, not meant for hand-editing).
- `src/magery-art.js` — the 64 spell signs as one embedded atlas.
- `src/bestiary-art.js` — the 11 bestiary v1 sheets and their manifest, embedded (generated: `python3 tools/embed_bestiary.py` reads `assets/bestiary/Shardfall_Bestiary_v1.0.0.zip`).
- `src/magic.js` — casting in the world: prepare → hold → release, targets, effects, fields, runes, summons, spellbook panel, hotbar signs.
- `src/backpack-icons.js` — backpack icon atlas v1.0.1 and its id → rect map, embedded (generated: `python3 tools/embed_backpack_icons.py` reads `assets/backpack-icons/v1.0.0/Shardfall_Backpack_Icons_v1.0.0.zip` and adds the seven PNGs in `assets/backpack-icons/v1.0.1/icons_64/`; the extension step needs Pillow).
- `src/anniabreen.js` — Anniabreen v1.0: the mainland, Vespar's river islands, Skara Bryn and Moonglen; towns, roads, the Mynoc mine, landmark art, ferries, boats, the public moongates and their map symbols. Since v0.23 it is drawn in its original frame and then stretched (`annStretch`: towns move whole, the wilds between them grow ×1.35; `annWarp` / `annUnwarp` convert).
- `src/frontier.js` — the world expansion (v0.23): the Southern Reach and the Long Causeway, Southwatch, eight camps and five sealed dungeon mouths, their art, zones and provisional camp spawners.
- `src/world.js` — the world simulation core (`SIM`): stable actor ids, archetypes and controllers, the structured event log, seeded streams, the fixed step, the world clock and light curve, A* and the travel graph. No DOM; tested in node like the rules.
- `src/living.js` — the Living World runtime in the game: the 50 ms step loop and interpolation, light and local lights, walkability, the travel graph from roads, piers, gates and stairs, the navigator (doors, stuck recovery) and the developer panel (`?dev`).
- `src/ecology.js` — the monster ecosystem (Living World phase 3): species profiles as data, factions, perception, decisions, roaming, packs, predator and prey, creature-against-creature fights, camp sorties, regional populations and persistent camps, graveyards that rise at night, creature sound, and the new procedural wildlife (deer, hares, bears).
- `src/townlife.js` — town life (Living World phase 4): homes, workplaces and daily schedules for Vespar and Mynoc, residents, resource workers gathering real ore, wood and fish, guard patrols and the night watch, the travelling merchant on the cart road, shop hours, fear of creatures and resuming the day after a load.
- `src/game.js` — the game: world generation, rendering, input, NPCs, quests, crafting UI, save/load, and the one physical-combat resolver every swing goes through.
- `src/creation-ui.js` — the title screen and the four-step character creator (identity and appearance, profession, stats and skills, town and review) with the live portrait and world-sprite preview; it starts the game loop.
- `src/equipment-ui.js` — the equipment UI: paper doll window, backpack (search, sorts, filters, split and merge, virtualized grid), item tooltips with comparison, drag and drop, context menu, the Armor crafting category.
- `src/tail.html` — closes the game script block and the page.
- `build.sh` — joins the parts into the game: `./build.sh 0.30` → `Shardfall_v0.30.html` (web build, 7.1 MB); `./build.sh 0.30 --offline` → `Shardfall_v0.30_offline.html` (22 MB, every sound inside, not committed). Needs `python3`.
- `Shardfall_v0.30.html` — the current built game.
- `.github/workflows/pages.yml` — publishes the newest build to GitHub Pages as `index.html`, with the audio beside it.
- `docs/WORLD_SIMULATION_MASTER.md` — the Living World master roadmap (the full specification). `docs/WORLD_SIMULATION_PROGRESS.md` — what is built, phase by phase, the audit matrix, asset gaps and the next task.
- `docs/design/character-creation-v2.md` — the creation spec; `docs/design/character-creation-v2-status.md` — what v0.30 built, the decisions where the stat and skill designs disagreed, tuning, tests and the missing character art (`assets/character/missing-character-art.json`).
- `docs/Shardfall_Audio.md` — what plays when, the audio pipeline and sound-release versioning.
- `docs/Shardfall_Crafting_Guide.md` — the crafting design guide the build follows.
- `docs/equipment/STATUS.md` — equipment, paper doll, inventory and armor: the model, slots, families, materials, weight, UI, save conversion, approximations.
- `assets/equipment-icons/missing-icons.json` — the 67 icons the equipment pieces and new materials still need (ids, file names, 64×64, descriptions).
- `docs/combat/STATUS.md` — combat and First Aid: the rules, the weapon table, the save migration, sources and every approximation.
- `docs/magery/` — the Magery kit: brief (`Magery_Brief.txt`), illustrated book (`Shardfall_Spellbook.html`, `Spellbook.md`), `spells.json`, reference math, and `STATUS.md` (what is in, what differs, what is left).
- `tests/rules.test.js` — deterministic rules tests: `node tests/rules.test.js Shardfall_v0.30.html`
- `tests/equipment.test.js` — equipment rules tests (slots, layering, carrying capacity, Mithril, exceptional, two-handed, requirements, encumbrance, crafting variants, durability, repair risk, atomic rollback, split/merge, death, migration): `node tests/equipment.test.js Shardfall_v0.30.html`
- `tests/equipment-smoke/run.py` — paper doll in Chrome (C key, double-click, mouse and touch drag, drop validation, two-handed, context menu, tooltips and comparison, search/sort/filter, split/merge, 600 stacks, encumbrance and recovery, region mitigation, broken armor, meditation, window drag, Armor crafting, vendors, save/reload, v6 → v7 migration, phone): `python3 tests/equipment-smoke/run.py Shardfall_v0.30.html`
- `tests/creation.test.js` — character creation rules (every template, budgets, duplicates and aliases, names, appearance, kits, towns): `node tests/creation.test.js Shardfall_v0.30.html`
- `tests/stats.test.js` — attribute progression rules (locks, cap transfer, cooldown, eligibility, determinism, measured rates): `node tests/stats.test.js Shardfall_v0.30.html`
- `tests/creation-smoke/run.py` — the creator in Chrome on desktop and three phone sizes, every template and town, first fights, casting, mining and smithing, natural gains, Continue, Replace, old v7 saves: `python3 tests/creation-smoke/run.py Shardfall_v0.30.html`
- `tests/magery.test.js` — Magery rules tests: `node tests/magery.test.js Shardfall_v0.30.html`
- `tests/combat.test.js` — combat and First Aid rules tests: `node tests/combat.test.js Shardfall_v0.30.html`
- `tests/magery-smoke/run.py` — in-browser Magery scenarios (Playwright + Chrome): `python3 tests/magery-smoke/run.py Shardfall_v0.30.html`
- `tests/combat-smoke/run.py` — in-browser combat, archery, First Aid, reload, old-save and phone play-test scenarios: `python3 tests/combat-smoke/run.py Shardfall_v0.30.html` (screenshots in `$COMBAT_SHOTS`, default `/tmp/combat-shots`)
- `tests/backpack-smoke/run.py` — in-browser backpack checks (saved character, three sorts, desktop hover, phone tap, actions after sorting): `python3 tests/backpack-smoke/run.py Shardfall_v0.30.html`
- `tests/backpack-smoke/panels.py` — the seven v1.0.1 icons everywhere items are listed (backpack tile, tooltip and tap card, Character, vendor buy and sell, loot, bank, crafting rows and inputs), weapon profiles unchanged, the wick still lights the Shore Beacon; desktop and two landscape phones: `python3 tests/backpack-smoke/panels.py Shardfall_v0.30.html`
- `tests/backpack-smoke/icons.py` — backpack icon checks (all 161 ids resolve, slot / tooltip / tap card use the same tile, stack counts readable after every sort, desktop and two landscape phones): `python3 tests/backpack-smoke/icons.py Shardfall_v0.30.html`
- `tests/sfx-smoke/run.py` — browser checks for sound, music, doors and footsteps (Playwright + Chrome; serves the web build on a local port): `python3 tests/sfx-smoke/run.py "$PWD/Shardfall_v0.30.html"`
- `tests/anniabreen-smoke/run.py` — Anniabreen walk-through (Playwright + Chrome): a scripted walker drives the joystick through the real update loop and times the routes; mine/smelt/bank, ferries, boats, moongates, doors, touch and mouse over a bridge, reload, save migration, phone map: `python3 tests/anniabreen-smoke/run.py Shardfall_v0.30.html [--shots DIR]`
- `tests/bestiary-smoke/run.py` — bestiary checks in the built game (sheets load, pixel-exact cells, 8 facings, walk / wind-up / impact against the player; preview screenshots when the pack is extracted): `python3 tests/bestiary-smoke/run.py Shardfall_v0.30.html [chrome] [screenshot-dir]`
- `tests/world.test.js` — world simulation core tests: `node tests/world.test.js Shardfall_v0.30.html`
- `tests/world-smoke/run.py` — Living World checks in the built game: phase 1 (actor ids, controllers, shared damage, death once, bounded events, save/load identity, v4 → v5 migration, seeded determinism), then `phase2.py` (clock, light, travel graph, journeys by road, boat, moongate and stairs, doors, stuck recovery, search budget, live step rate, developer panel) and `expansion.py` (towns unchanged tile for tile, sites and camps, causeway and islands, long journeys, v0.22 → v0.23 save migration) and `phase3.py` (species profiles and factions, regional populations, predator and prey, creature-against-creature fights, timid wildlife, perception at night and in hiding, graveyards rising at night, persistent camps through a reload, packs, pursuit limits, camp patrols, the spatial index, and a seeded three-day run) and `phase4.py` (homes, workplaces and schedules, a full accelerated day, shop hours, miners on real rock faces, guard patrols and the night watch, the travelling merchant, fear of creatures, crowds spreading out, resuming the day after a reload): `python3 tests/world-smoke/run.py Shardfall_v0.30.html`

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

## v0.18 — online play and music

- The game is now a small web page (3.7 MB instead of 22 MB) published on GitHub Pages. Sounds are separate small files (2.1 MB in all instead of 14 MB) that download quietly after the first tap.
- Music: the five Saltmarsh tracks play by area — town, shore, road, marsh, ruins — with a soft crossfade. Each track downloads only when you first reach its area. Menu → **Music on/off**, remembered.

## v0.17 — sound pack v1.0.0

- 107 recorded sound events replace the old synth beeps: weapons by family timed to the contact frame, distinct impacts (flesh, bone, armor, blunt, shield), creature alerts, wind-ups and deaths, magic, gathering, crafting, loot, UI, quests and sparse ambience.
- World sounds pan with the view, fade with distance and stay silent for hidden foes and rooms out of sight. Up to 14 voices; mute is remembered; audio starts from your first tap or key press and pauses in the background.
- Kit building doors now open and close (Interact, E or tap the door), block movement when closed, and are remembered in your save. Older saves load with every door open.
- Footsteps follow the surface: timber piers and floors, stone, grass, dirt, sand, mud and shallows. A cobbled quayside now joins the piers to the plaza road.

## v0.18b — Bestiary v1 (built in parallel with the music v0.18)

- Eleven creatures from the bestiary pack are in the game data and renderer: orc, ettin, troll, lizardman, gargoyle, earth elemental, giant spider, dire wolf, harpy, slime and the Lich Lord (boss).
- Sprites follow the existing combat states: neutral when standing, the walk cycle while moving, the wind-up pose for the whole telegraph and the impact pose on the strike resolution, then recover. Facing is locked from the telegraph to the end of the swing.
- Sheets are drawn untouched (no outline, tint or alpha cut), so the Lich Lord's turquoise rim and gold glints show as painted.
- Not yet: spawn placement, balance (stats are provisional placeholders), dedicated death art. Corpses use the standard bones. To see one, run `__SF.spawnMon('lich_lord')` in the browser console.

## v0.18c — Second Age combat and First Aid (built in parallel, #9)
- Combat skills are now Swordsmanship, Mace Fighting, Fencing, Archery, Wrestling, Parrying and Healing. Each weapon uses its UO profile: real dice, speed, STR, hands; the pack names its skill.
- Hit chance is your weapon skill against the defender's; Tactics, Anatomy and Strength set damage; armor absorbs part of each blow; a shield parries at half your Parrying; player recipients take half. Maces and war hammers drain stamina and wear armor.
- Swing speed comes from the weapon and your current stamina (quarter-second ticks, 1.25–10 s). One swing timer: a ready swing survives a target change, an unequip or a held spell; equipping during recovery restarts it.
- Bows and crossbows reload while you move but need you to stand still to aim; one arrow or bolt per release; the shot lands a second later.
- First Aid: bandage yourself (15 s; poison 18 s) or another (5 s; poison 6 s; resurrection 10 s). Cure at 60/60, resurrect at 80/80. Blows make your fingers slip. The application is saved with the game.
- Wren, a sellsword at the plaza, follows you on request, fights by the same rules, and can be bandaged or brought back from a ghost.
- Old saves migrate once (snapshot in `shardfall.save.v1.precombat`); merged points wait on the Skills page. Details: `docs/combat/STATUS.md`.

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
