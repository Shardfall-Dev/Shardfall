# NPC wardrobe & faction appearance v1.0 — status

Build **v0.31** (branch `feature/npc-wardrobe-v1`, from `design/npc-costumes-v1` = `main` + the design spec).
Spec: `docs/handoffs/npc-costume-design-v1.md`. Coverage matrix: `docs/wardrobe/COVERAGE.md` (generated from the running game).
Missing art: `docs/wardrobe/missing-art.json` (generated).

## What it is, in one paragraph

Every human in the game — the player, Wren, all 72 townsfolk and guards, and the three human mob types (road bandit, brine smuggler,
drowned captain) — now resolves to one **appearance descriptor** (`SF.WARDROBE.resolve`) that the world renderer, corpses and the paper
doll all draw with one **layered human rig** (`SF.RIG`). Guards wear their region's colours, heraldry and a rank; civilians wear their
profession; hostile humans get 2–3 garment variants each; everyone keeps the same face, hair, body and colours for good, and work
clothes and tools come and go with the town-life schedule. **The rig is procedural prototype art** (shapes drawn in code from the
classic-humans-v2 and layered-armor-v1 packs). It is behind a flag; the painted Saltmarsh Scout stays the default.

## Turning it on

- Menu → **Human art: classic / layered (prototype)** (saved in settings), or open the game with `?humans=layered` (`?humans=classic` forces it off).
- With it on, the menu also has **Body: male / female** for your own character (until Character Creation v2 gives a real choice).
- `?dev` → tap anyone: the inspector shows their wardrobe role, region, rank, outfit state, whether the outfit is **real equipment** or a
  **cosmetic preset — not equipment, not loot**, and which art is missing.

## Files

| File | What |
|---|---|
| `src/wardrobe.js` | `SF.WARDROBE` — pure data and resolver (no DOM, no `Math.random`): dyes, the five regional factions, guard uniforms × 4 ranks, 34 civilian recipes, 10 hostile presets, overlay/prop registry with art status, explicit live-id mappings, the stable identity generator, activity → outfit state, validator, coverage rows. Runs in node. |
| `src/humanrig.js` | `SF.RIG` — classic-humans-v2 rig + layered-armor-v1 painter ported into the fragment build, plus: hex colours, per-piece cloth dye (cloth only — never metal), drowned skin, buckler and respawn tunic layers, cosmetic overlays and props, `fromDescriptor`. Runs in node. |
| `src/humans.js` | In-game renderer: flag, descriptor cache, animation state from the simulation, strip builder (time-budgeted queue, bounded LRU), corpse snapshot, paper doll source, dev inspector, QA lineup. |
| `src/game.js`, `src/equipment-ui.js`, `src/living.js`, `src/head.html` | Hooks only: one `drawHuman` call before the classic sprite, `wd` snapshot on human corpses, the menu switch, the paper doll image, the inspector line, `__SF` test handles. |
| `tests/wardrobe.test.js`, `tests/wardrobe-smoke/run.py`, `tests/wardrobe-smoke/live-npcs.json` | Node and browser tests (below). |
| `tools/wardrobe_report.py` | Regenerates `COVERAGE.md` and `missing-art.json`. |

## Rules it keeps (by construction and by test)

- **No duplicated systems.** NPCs and mobs have no equipment model; their outfits are cosmetic presets made of real item ids with real
  material ids, marked `source: 'cosmetic'`, never added to any container, corpse or loot roll, and they grant no armour. The resolver
  never mutates the actor. Loot tables, AI, combat, skills, prices and saves are untouched (the only new saved data is the player's own
  `look.body/skin/hair/style/beard/wv`, set once).
- **Real equipment wins.** The player and Wren show exactly what they wear (`actor.equip`, `SF.matOf`, `EQ.matColor`, `it.sec`); a
  successful equip/unequip shows on the next frame; `EQ.twoHanded` hides the shield; item uid is never part of the visual key.
- **Deterministic.** Appearance comes from the stable actor id (`npc:odile-banker` …) + `SEED_REV`, never from `Math.random`, never per
  frame. Identical after save/load and travel (tested on all 74 people). Changing `SEED_REV` is the only way to reshuffle.
- **Bodies follow existing identities.** NPCs have no gender field, so `ACTOR_BODY` records the body implied by each name or title
  (Sister, Brother, forgemistress, ferryman…); unnamed guards are seeded. Both bodies appear in every eligible role; no profession or
  protection depends on body.
- **Activity, not simulation.** The wardrobe only reads `e.life.doing/goal`: at work → apron, gloves, work prop and work gesture
  (smith, mine, chop, fish); hall/market/home → none; the travelling merchant's cloak on the road. Guards are always on duty (the
  schedule has no off-duty time yet). Sleep has no nightwear art, so sleepers wear their off-duty clothes.
- **Crime status is not clothing.** Wardrobe never feeds the justice/faction logic.

## Guard uniforms

| Region | Colours (primary / secondary / accent) | Heraldry (device colour) | Patrol kit | Arms (by roster order) |
|---|---|---|---|---|
| Mynoc | #BD913D ochre / #514033 / #858B8E | crossed hammers | chainmail tunic and leggings, open helm, ochre tabard | mace + metal shield |
| Vespar | #284663 navy / #D6D1BD / #858F99 | river and bridge | chain tunic, plate arms and gauntlets, chain leggings, bascinet, navy tabard | sword + heater shield, or spear |
| Skara Bryn | #3E573A forest / #786746 / #49382A | oak leaf and arrow | studded leather, leather cap, short green cloak | shortbow, or sword |
| Moonglen | #514269 violet / #C8C5D0 / #777E8C | crescent | chainmail, coif, violet tabard | glaive (two-handed, no shield) |
| Saltmarsh Quay | #783D37 faded red / #655443 / #85827A | anchor | ringmail tunic and sleeves, leather leggings, bascinet, red tabard | spear, or sword + wooden shield |

Ranks: **recruit** (lighter armour, a cloth cap in the regional colour), **patrol** (the kit above), **sergeant** (better helm, trim),
**captain** (plate or regional equivalent, regional cloak, trim, crest). Roster order inside a region gives sergeant, patrol, patrol,
recruit, …; Quaywarden Brann is the Saltmarsh captain. All metal is iron — no rare metal is implied by rank, and the accent dye is cloth only.

## Tests actually run on v0.31

- `node tests/wardrobe.test.js Shardfall_v0.31.html` — **all pass** (data validation; no `Math.random`; all live NPCs resolve, none fall
  back; five regions share one colour and heraldry each; save/reload identity from a fresh module; resolver does not mutate actors;
  activity changes; real equipment, materials, dye isolation, studs; two-handed; every equipment definition and every `SF.WEAPONS` id
  has a rig layer; 2 bodies × 8 directions × 29 animations draw clean SVG; closed helm hides hair; all hostile variants occur;
  non-human creatures get no wardrobe).
- `python3 tests/wardrobe-smoke/run.py Shardfall_v0.31.html` — **all pass**: classic is the default; menu switch; live coverage (73 NPCs
  + Wren + player + 3 human mobs); a simulated day (apron/hammer at the forge, not at the hall; same person all day; miner's pickaxe);
  74 people identical after save and reload; valorite plate equip/unequip shows at once, no items created (`EQ.audit` clean); no NPC
  gains equipment; a bandit's corpse keeps its look and drops only its own loot table; the world draw call paints the player and 12
  others; 272 strips (2 bodies × 8 directions × 17 actions incl. walk, run, attacks, cast, hit, death, corpse, mine, smith, fish,
  chop) all have pixels; strip cache stays at 96/96 after 768 requests; 60 people on a phone screen: frame median ≈16 ms / p95 ≈23 ms
  layered vs ≈17 / ≈23 ms classic (headless Chrome, 844×390); grayscale check; paper doll uses the same descriptor; screenshots.
- Existing suites on v0.31: `rules`, `equipment`, `magery`, `combat`, `world` node tests — **ALL PASS**. Browser suites: below.

Screenshots (from the smoke test): `docs/wardrobe/screenshots/` — native-size lineup by day and night, ×3 pixel lineup, Vespar on a phone
by day and night and on a desktop, the paper doll, and 60 people on one phone screen.

Browser suites re-run on v0.31 in this environment (classic default): world-smoke (142 ok), equipment-smoke (67 ok), bestiary-smoke
(123 ok), backpack-smoke (32 ok), magery-smoke — all pass. combat-smoke stopped at its old-save scenario because it reads
`main:Shardfall_v0.16.html` from git history, which a shallow clone does not have; its first 5 checks passed.

## Known limits (honest list)

- Skara Bryn guards read mostly as natural leather: their spec kit is studded leather with a short green cloak, and from the front the
  cloak hangs behind the body, so their regional green shows mainly from the back and on the recruit's cap.

- **All of it is procedural prototype art.** Nothing here is the painted UO-style production atlas. The heraldic devices are a few
  coloured pixels; the actual symbols are not drawn at native scale.
- The `medieval-equipment-art-v1` PNGs and the paperdoll portrait ZIP are **not in the repository** (their READMEs say so), so neither
  could be integrated. The paper doll shows the rig's front view instead of the old Scout image when the flag is on.
- Grayscale: different regions' guards differ by colour first; in pure grey some region/rank pairs come close (listed by the smoke test).
- Seven props used by live NPCs have no art at all (hoe, holy symbol, goods in hand, reagent pouch, rope, sewing kit, vial); those NPCs
  simply hold nothing. Nightwear, quiver, bedroll, hood-down, measuring tape and embroidery are also missing.
- Mobs have no weapon item, so each human mob type shows one cosmetic weapon shape (bandit sword, smuggler dagger, captain sword);
  their variants differ in cloth and wear only, never in armour class, because they share one rule set.
- Ghosts (player and Wren) still use the classic ghost sprite. A player corpse restored from a save (no snapshot) uses the old corpse drawing.
- No lantern is shown at night: the rule (night watch, free hand) exists, but no current guard has a free hand.
- The player's body/hair are seeded from the name until Character Creation v2 (branch `feature/character-creation-v2`) supplies a choice;
  `resolve` already reads `look.body/skin/hair/style/beard`, so that branch only needs to save those fields.

## Remaining artwork requirements (for the painted pass)

Per the rig contract (112×100 cells, anchor 56,86, 8 directions, 29 animations, both bodies), with primary/secondary/fixed material masks:
1. Painted base bodies (male/female), all skin tones, all 8 hairstyles front/back with helmet occlusion, 5 beards.
2. Painted per-slot armour/clothing layers for every live definition (cloth, leather, studded, bone, ringmail, chain, plate, helmets ×6,
   dragon, shields ×5, boots/shoes, belt, robe, tabard, cloak front/back, jewelry) — see `asset-packs/layered-armor-v1/manifest.json`.
3. The cosmetic overlays in `missing-art.json → needs_painted_layer`: aprons (long/short), vest, skirt, dress, straw hat, hood, headscarf,
   sash, pouch, mantle, rank trim, officer crest, bracer, wear/dirt, and **five heraldic devices** (crossed hammers, river and bridge,
   oak leaf and arrow, crescent, anchor) for tabard, shield and cloak at native scale.
4. The props in `missing-art.json → no_art.props` (hoe, holy symbol, goods/pouch, reagent pouch, rope, sewing kit, vial, saw, crook,
   bread, bandage) and the painted versions of the procedural ones (smith hammer, tongs, pickaxe, hatchet, rod, tankard, book, staff,
   basket, lantern, bow, knife).
5. Nightwear, quiver, bedroll, hood-down, measuring tape, embroidery.
6. The paperdoll layer set (384×512, `docs/handoffs/paperdoll-v1.md`) and the medieval equipment PNG pack committed into the repo.
