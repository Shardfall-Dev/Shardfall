# Shardfall

A T2A-era Ultima Online-style 2.5D isometric sandbox RPG for phones, built as a single-file web game.

## Play

**Online:** every merge to `main` publishes the newest build on GitHub Pages (`.github/workflows/pages.yml`; one-time setup: Settings → Pages → Source: GitHub Actions. Pages on a private repository needs a paid GitHub plan, and the site itself is public): `https://shardfall-dev.github.io/Shardfall/`. On iPhone, Share → Add to Home Screen gives it an app icon.

**On your computer:** run `python3 -m http.server` in this folder and open `http://localhost:8000/Shardfall_v0.19.html`. The game loads its sound and music from `assets/audio/web/`, so it needs to be served like this; opened straight from disk it plays silently. For a single file that plays from disk with sound effects, build `./build.sh 0.19 --offline`.

Progress saves to the browser's local storage.

## Layout

- `src/head.html` — page markup and CSS (HUD, panels).
- `src/rules.js` — the pure rules module (`SF`): items, skills, recipes, materials, crafting and repair math. No DOM.
- `src/magery.js` — the Magery rules module (`SF.MAGERY`): the 64 spells (data from `docs/magery/spells.json`), success, resistance, damage, statuses, save migration. No DOM.
- `src/audio.js` — the Web Audio player for the sound pack (`SFXA`).
- `assets/audio/` — sound pack v1.0.0: `manifest.json` and mono WAV takes (the masters).
- `assets/audio/web/` — the small AAC copies the game loads (sound 2.1 MB, music 4.9 MB), made by `tools/encode_web_audio.sh` (needs ffmpeg). Re-run it after changing a sound.
- `assets/music/v1.0.0/` — the Saltmarsh soundtrack: five MIDI sources, MP3 renders and `soundtrack.json`.
- `src/assets.js` — embedded sprite sheets and art (data URIs; large, not meant for hand-editing).
- `src/magery-art.js` — the 64 spell signs as one embedded atlas.
- `src/bestiary-art.js` — the 11 bestiary v1 sheets and their manifest, embedded (generated: `python3 tools/embed_bestiary.py` reads `assets/bestiary/Shardfall_Bestiary_v1.0.0.zip`).
- `src/magic.js` — casting in the world: prepare → hold → release, targets, effects, fields, runes, summons, spellbook panel, hotbar signs.
- `src/game.js` — the game: world generation, rendering, input, NPCs, quests, crafting UI, save/load.
- `build.sh` — joins the parts into the game: `./build.sh 0.19` → `Shardfall_v0.19.html` (web build, 5.8 MB); `./build.sh 0.19 --offline` → `Shardfall_v0.19_offline.html` (22 MB, every sound inside, not committed). Needs `python3`.
- `Shardfall_v0.19.html` — the current built game.
- `.github/workflows/pages.yml` — publishes the newest build to GitHub Pages as `index.html`, with the audio beside it.
- `docs/Shardfall_Audio.md` — what plays when, the audio pipeline and sound-release versioning.
- `docs/Shardfall_Crafting_Guide.md` — the crafting design guide the build follows.
- `docs/magery/` — the Magery kit: brief (`Magery_Brief.txt`), illustrated book (`Shardfall_Spellbook.html`, `Spellbook.md`), `spells.json`, reference math, and `STATUS.md` (what is in, what differs, what is left).
- `tests/rules.test.js` — deterministic rules tests: `node tests/rules.test.js Shardfall_v0.19.html`
- `tests/magery.test.js` — Magery rules tests: `node tests/magery.test.js Shardfall_v0.19.html`
- `tests/magery-smoke/run.py` — in-browser Magery scenarios (Playwright + Chrome): `python3 tests/magery-smoke/run.py Shardfall_v0.19.html`
- `tests/backpack-smoke/run.py` — in-browser backpack checks (saved character, three sorts, desktop hover, phone tap, actions after sorting): `python3 tests/backpack-smoke/run.py Shardfall_v0.19.html`
- `tests/sfx-smoke/run.py` — browser checks for sound, music, doors and footsteps (Playwright + Chrome; serves the web build on a local port): `python3 tests/sfx-smoke/run.py "$PWD/Shardfall_v0.19.html"`
- `tests/bestiary-smoke/run.py` — bestiary checks in the built game (sheets load, pixel-exact cells, 8 facings, walk / wind-up / impact against the player; preview screenshots when the pack is extracted): `python3 tests/bestiary-smoke/run.py Shardfall_v0.19.html [chrome] [screenshot-dir]`

## v0.19 — everything together

- One build with every finished feature branch: sound pack v1.0.0 (#2), online web build and area music (#8), audio handoff (#7), bestiary v1 art and creatures (#4, #6) and the graphical backpack (#5).
- Opened straight from disk, the game no longer tries to download sound (browsers refuse it and logged an error for every take); serve the folder or use the online link for sound.
- Not in yet: the T2A physical combat and First Aid rework (`feature/t2a-combat-first-aid`) — it rewrites the swing code the sound pack hooks into and has no pull request yet.

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
