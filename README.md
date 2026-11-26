# Shardfall

A T2A-era Ultima Online-style 2.5D isometric sandbox RPG for phones, built as a single-file web game.

## Play

Open `Shardfall_v0.18.html` in a browser (phone or desktop). Everything — code, art and audio — is inside that one file. Progress saves to the browser's local storage.

## Layout

- `src/head.html` — page markup and CSS (HUD, panels).
- `src/rules.js` — the pure rules module (`SF`): items, skills, recipes, materials, crafting and repair math, and the Second Age combat and First Aid rules. No DOM.
- `src/magery.js` — the Magery rules module (`SF.MAGERY`): the 64 spells (data from `docs/magery/spells.json`), success, resistance, damage, statuses, save migration. No DOM.
- `src/assets.js` — embedded sprite sheets and art (data URIs; large, not meant for hand-editing).
- `src/magery-art.js` — the 64 spell signs as one embedded atlas.
- `src/magic.js` — casting in the world: prepare → hold → release, targets, effects, fields, runes, summons, spellbook panel, hotbar signs.
- `src/game.js` — the game: world generation, rendering, input, NPCs, quests, crafting UI, save/load, and the one physical-combat resolver every swing goes through.
- `build.sh` — joins the parts into one playable file: `./build.sh 0.18` → `Shardfall_v0.18.html`.
- `Shardfall_v0.18.html` — the current built game.
- `docs/Shardfall_Crafting_Guide.md` — the crafting design guide the build follows.
- `docs/combat/STATUS.md` — combat and First Aid: the rules, the weapon table, the save migration, sources and every approximation.
- `docs/magery/` — the Magery kit: brief (`Magery_Brief.txt`), illustrated book (`Shardfall_Spellbook.html`, `Spellbook.md`), `spells.json`, reference math, and `STATUS.md` (what is in, what differs, what is left).
- `tests/rules.test.js` — deterministic rules tests: `node tests/rules.test.js Shardfall_v0.18.html`
- `tests/magery.test.js` — Magery rules tests: `node tests/magery.test.js Shardfall_v0.18.html`
- `tests/combat.test.js` — combat and First Aid rules tests: `node tests/combat.test.js Shardfall_v0.18.html`
- `tests/magery-smoke/run.py` — in-browser Magery scenarios (Playwright + Chrome): `python3 tests/magery-smoke/run.py Shardfall_v0.18.html`
- `tests/combat-smoke/run.py` — in-browser combat, archery, First Aid, reload, old-save and phone play-test scenarios: `python3 tests/combat-smoke/run.py Shardfall_v0.18.html` (screenshots in `$COMBAT_SHOTS`, default `/tmp/combat-shots`)

## v0.18 — Second Age combat and First Aid

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
