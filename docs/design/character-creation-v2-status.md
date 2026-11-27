# Character Creation v2.0 — implementation status (v0.30)

Spec: `docs/design/character-creation-v2.md` (branch `design/character-creation-v2`, 8823d08). Reconciled with
`docs/stats/STAT_SYSTEM_REWORK_v1.0.md` (main) and `docs/skills/T2A_SKILL_PARITY_v1.md` (branch `design/t2a-skill-parity-v1`, b362b46).

## Merge status found before implementation (2026-11-27)

| Source | State | What this build takes from it |
|---|---|---|
| Stat System Rework v1.0 (main, 8fec0af) | design only, not implemented | natural stats in `P.base`, locks, 225 atrophy, gain contract, skill→stat weights, removal of stat purchases |
| T2A skill parity v1 (branch, b362b46) | design only, not merged | canonical UO display names and canonical ids as aliases; creation exclusions (Stealth, Remove Trap) |
| Open PRs #25–#29 (v0.28.2 – v0.29.1) | open, not merged | none; this branch is cut from main. Expect conflicts in `src/game.js` and the build file name when they merge. |

## Decisions where the documents disagree

- **Starting attributes: 65 points, each 10–45** (the user's brief and the creation spec, after the original Second Age manual).
  The stat rework proposed 80 (10–60); 65 wins. Progression caps stay 225 total and 100 each.
- **Derived pools unchanged.** Health stays `50 + STR / 2`, stamina `DEX` (after equipment), mana `INT`, carrying capacity
  `40 + 3.5 × STR` WU (`SF.maxHp` / `maxStam` / `maxMana` / `carryCap`). The rework's HP = STR is a balance change for its own
  PR; the creator only reads the shared helpers, so it follows automatically.
- **Skill names, not skill keys.** Every skill now shows its canonical UO name (Magery, Evaluating Intelligence, Resisting
  Spells, Hiding, Stealing, Lockpicking, Blacksmithy, Lumberjacking, Bowcraft & Fletching, Tinkering, Item Identification, …).
  The runtime keys in saves, recipes, spells and quests are unchanged: moving them is phase A of the skill parity work.
  `SF.SKILL_CANON` maps each canonical id to its key and `SF.skillKey` resolves a key, canonical id or display name, so the
  validator rejects alias duplicates (Magery + spellcraft) before anything is merged.
- **Discord** is labelled Discordance, the skill its current mechanic resembles; T2A's Enticement is not built. It, Stealth,
  Remove Trap, Foraging and Skinning cannot be starting skills (`SF.SKILL_NOCREATE` gives the reason shown in the skill guide).
- **Two free trainer lessons stay** for new characters: they are skill lessons, and trainer policy belongs to the skill
  parity work. Attribute purchases are gone (`SF.statTrainCost` and the trainer's buy buttons are deleted).

## What is in

- `src/creation.js` (`SF.CREATION`, pure, node-tested): appearance allowlists, twelve templates, five starting towns,
  `validate(payload)` (the one validator: the UI, `boot()` and a future server), `progression`, the skill-driven `kit` and
  `applyKit`, `normalizeLook` for saves, `preview` from the shared formulas.
- `src/stats.js` (`SF.STATS`, pure, node-tested): natural attribute gains from resolved skill use, locks (raise / hold / lower),
  the 225 atomic transfer from the highest Lower stat, cooldown, a persisted RNG stream separate from skill gains, migration.
- `src/creation-ui.js`: title screen (Continue / New character) and the four-step wizard: Identity & Appearance →
  Starting Profession → Stats & Skills → Starting Town & Review. Live portrait and world-sprite preview (turnable), budget
  counters, sliders, ± buttons and typed values that can never overspend, template warning before overwriting edits, skill
  guide with search, inline errors with Fix links, disabled Begin with the reason, explicit Replace consent and a download of
  the old save, a kept `.replaced` copy, double-submit guard.
- Game: `newChar` / `starterKit` / `boot` take the validated value; the town spawn and shrine binding are set before the world
  populates; the Quay tutorial hint appears only at the Quay; save v8 (`migrateV8`, idempotent, `.prev7` backup); stat locks on
  the Character page and the paper doll; the trainer's Attributes tab only explains; recolouring of skin and cloak on the
  traveller sprite and the paper doll.
- Gain hook: `gain()` calls `statRoll` once per resolved action (action id = step time); Tactics and Anatomy on a hit and
  Anatomy on a bandage pass `aux: true`. A held or lowered skill trains no stats; at 700.0 below GM another skill must be Lower.

## Tuning (Shardfall choices, not OSI formulas)

Chance per fitting action 4% at 10 falling to 1% at 100; trivial or repeated use counts ¼; one success per 45 s of active play.
Measured by `tests/stats.test.js` with one mining swing every 3 s: about 25 points/hour at STR 30, 19 at 60, 11 at 90.
A Strength point given up at the cap moves gear above the new requirement to the backpack (never dropped).

## Tests

- `node tests/creation.test.js Shardfall_v0.30.html` — every template; 45/10/10, 10/10/45; 64/66, 46/9; 50/50/0, 50/49/1,
  51; fractional / NaN / Infinity; duplicates and alias duplicates; unknown, `__proto__`, barred skills; names; appearance;
  male = female mechanics; tenths once; kits for every template and low-Strength edges; weight; towns.
- `node tests/stats.test.js Shardfall_v0.30.html` — no purchase price; weights for every skill; migration; locks; cooldown;
  one roll per action; auxiliary checks; GM and 700 cap rules; 225 transfer and no-donor case; no decay below 225; base vs buff;
  seeded determinism through save/load; trivial use; measured rates.
- `python3 tests/creation-smoke/run.py Shardfall_v0.30.html` — the wizard in Chrome on desktop, 844×390, 667×375 and 390×844
  (touch): budgets, duplicates, template warning, review, double submit, Continue without a second kit, Replace consent and
  download, refused creations leave the save untouched, all twelve templates, all five towns, a Swordsman kills a rat and
  bandages, a natural Strength gain from a real swing, a Mage casts Magic Arrow, a Blacksmith mines, smelts and forges in
  Mynoc, a v7 save with 150-point stats continues unchanged.

### Results on this build (2026-11-27)

Node: rules 33, equipment 91, magery 57, combat 79, world 140, creation 227, stats 36 — all pass. Chrome (Playwright):
creation-smoke 126 checks, equipment-smoke, backpack-smoke (run, panels, icons), magery-smoke (incl. migration),
sfx-smoke 48/48, bestiary-smoke, anniabreen-smoke, world-smoke (phase 1–4 and the v0.22 save migration) — all pass.
combat-smoke passes every scenario; its `reload.py` old-save case reads `main:Shardfall_v0.16.html` from git, which no longer
exists on main (it failed the same way before this change).

Older smoke suites were written against the old 150-point profiles. They now create characters through `__CC.quick` (the
creator's real commit path) and, where their timings or spell lists assumed the old numbers, restore them with a named fixture
(`tests/combat-smoke/legacy-profile.js`, the Group healer numbers in `tests/magery-smoke/run.py`, `OLDSTATS` in
`tests/sfx-smoke/run.py`). Fixtures that set Strength now set the natural value (`P.base.str = P.str = …`), because effective
attributes are always derived from it.

## Missing graphical assets

The creator never claims art that does not exist. Without these, the world sprite and paper doll show the traveller sheet
recoloured for skin tone and cloak, and the creator's portrait (an original procedural figure) shows everything else.
The machine-readable list is `assets/character/missing-character-art.json`.

1. **Female body sheets** — all 25 animation clips (Idle, Walk, the cast clips, Ready / Walk / Attack for Unarmed, Dagger,
   Sword, Hammer, Glaive, Shortbow, Crossbow) and the 8-facing idle atlas, same 128 px cells, feet anchor (64, 106), row order
   S, SW, W, NW, N, NE, E, SE, frame counts and timing as the male traveller.
2. **An unhooded / cloakless base body** (male and female) — the current traveller has the hood and cloak painted in, so hair
   cannot show and "No cloak" works only on the portrait.
3. **Hair layers** per style (short, long, ponytail, pageboy, receding, mohawk, buns, pigtails) for every clip and facing,
   drawn in a neutral grey ramp for runtime tinting.
4. **Facial hair layers** (mustache, goatee, short beard, long beard, vandyke), same format.
5. **Clothing layers** (shirt, trousers; a skirt if one is added as an item) in a neutral ramp for dye colours.
6. **Paper-doll body art** (front view, male and female, about 96×192) to replace the procedural portrait and the cropped
   traveller cell in the equipment window.
   *v0.31:* the portrait and the equipment window now share the layered paperdoll (`docs/equipment/PAPERDOLL.md`) on a
   384×512 contract that supersedes the 96×192 suggestion; its layers are still procedural, so this entry stays open, and the
   painted paperdoll layers are listed one by one in `assets/character/missing-character-art.json` v1.1.0.
