# Shardfall

A T2A-era Ultima Online-style 2.5D isometric sandbox RPG for phones, built as a single-file web game.

## Play

Open `Shardfall_v0.14.html` in a browser (phone or desktop). Everything — code, art and audio — is inside that one file. Progress saves to the browser's local storage.

## Layout

- `Shardfall_v0.14.html` — the current build. The first `<script>` is the pure rules module (`SF`: items, skills, recipes, crafting math); the last `<script>` is the game (world, UI, quests, save/load).
- `docs/Shardfall_Crafting_Guide.md` — the crafting design guide the build follows.
- `tests/rules.test.js` — deterministic rules tests: `node tests/rules.test.js Shardfall_v0.14.html`

## v0.14 — crafting guide, build step 1

- Nine metals and seven woods as materials; each coloured ore, ingot and log has its own item ID.
- Rocks and trees roll a regional specialty per generation, deplete and refill on a timer, and persist in the save. Survey reveals stock and, at the gate, the material.
- New crafting screen: category → recipe → full preview (inputs, metal, tool uses, success and exceptional odds, failure cost), batches of up to 20.
- Exceptional quality, metal durability and mass, 100-use work tools, guide repair formula.
- Quests: Dena's *A Vein by the Water* (Mining) and Mara's *Holdfast* (Blacksmithing), a Guilds journal tab, tracking arrow and map pins.
- v1 saves migrate to v2 automatically; the original is backed up to `shardfall.save.v1.backup`.

Next: guide steps 2–4 (full smith pattern table, woodworking and carpentry, order boards).
