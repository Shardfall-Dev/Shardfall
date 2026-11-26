# Shardfall

A T2A-era Ultima Online-style 2.5D isometric sandbox RPG for phones, built as a single-file web game.

## Play

Open `Shardfall_v0.18.html` in a browser (phone or desktop). Everything — code, art and audio — is inside that one file. Progress saves to the browser's local storage.

## Layout

- `src/head.html` — page markup and CSS (HUD, panels).
- `src/rules.js` — the pure rules module (`SF`): items, skills, recipes, materials, crafting and repair math. No DOM.
- `src/magery.js` — the Magery rules module (`SF.MAGERY`): the 64 spells (data from `docs/magery/spells.json`), success, resistance, damage, statuses, save migration. No DOM.
- `src/assets.js` — embedded sprite sheets and art (data URIs; large, not meant for hand-editing).
- `src/magery-art.js` — the 64 spell signs as one embedded atlas.
- `src/bestiary-art.js` — the 11 bestiary v1 sheets and their manifest, embedded (generated: `python3 tools/embed_bestiary.py` reads `assets/bestiary/Shardfall_Bestiary_v1.0.0.zip`).
- `src/magic.js` — casting in the world: prepare → hold → release, targets, effects, fields, runes, summons, spellbook panel, hotbar signs.
- `src/game.js` — the game: world generation, rendering, input, NPCs, quests, crafting UI, save/load.
- `build.sh` — joins the parts into one playable file: `./build.sh 0.17` → `Shardfall_v0.17.html`.
- `Shardfall_v0.18.html` — the current built game.
- `docs/Shardfall_Crafting_Guide.md` — the crafting design guide the build follows.
- `docs/magery/` — the Magery kit: brief (`Magery_Brief.txt`), illustrated book (`Shardfall_Spellbook.html`, `Spellbook.md`), `spells.json`, reference math, and `STATUS.md` (what is in, what differs, what is left).
- `tests/rules.test.js` — deterministic rules tests: `node tests/rules.test.js Shardfall_v0.18.html`
- `tests/magery.test.js` — Magery rules tests: `node tests/magery.test.js Shardfall_v0.18.html`
- `tests/magery-smoke/run.py` — in-browser Magery scenarios (Playwright + Chrome): `python3 tests/magery-smoke/run.py Shardfall_v0.18.html`
- `tests/bestiary-smoke/run.py` — bestiary checks in the built game (sheets load, pixel-exact cells, 8 facings, walk / wind-up / impact against the player; preview screenshots when the pack is extracted): `python3 tests/bestiary-smoke/run.py Shardfall_v0.18.html [chrome] [screenshot-dir]`

## v0.18 — Bestiary v1

- Eleven creatures from the bestiary pack are in the game data and renderer: orc, ettin, troll, lizardman, gargoyle, earth elemental, giant spider, dire wolf, harpy, slime and the Lich Lord (boss).
- Sprites follow the existing combat states: neutral when standing, the walk cycle while moving, the wind-up pose for the whole telegraph and the impact pose on the strike resolution, then recover. Facing is locked from the telegraph to the end of the swing.
- Sheets are drawn untouched (no outline, tint or alpha cut), so the Lich Lord's turquoise rim and gold glints show as painted.
- Not yet: spawn placement, balance (stats are provisional placeholders), dedicated death art. Corpses use the standard bones. To see one, run `__SF.spawnMon('lich_lord')` in the browser console.
- Version note: v0.17 is the sound pack branch; whichever lands second rebuilds the HTML from `src/`.

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
