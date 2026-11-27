# Magery integration — status (v0.16)

> v0.30.0: the magic skills now carry their classic names — Spellcraft is **Magery**, Spell Focus is **Evaluating Intelligence**, Wardcraft is **Resisting Spells** (see `docs/skills/STATUS.md`). Formulas below are unchanged; Magery gains now follow circle windows, and resistible creature spells also teach Resisting Spells.

Source brief: `Magery_Brief.txt`. Book: `Shardfall_Spellbook.html` / `Spellbook.md`. Data: `spells.json` (embedded verbatim in `src/magery.js`; `tests/magery.test.js` checks they match).

## Where the code lives

- `src/magery.js` — pure rules (`SF.MAGERY`): spell records, book/scroll success, resistance and Focus, dice, area split, stat channels, durations, field geometry, banish, cure, poison tiers, save migration, learning. Also adds the reagent, scroll, spellbook, rune and ration items.
- `src/magic.js` — the game side: prepare → hold → release, target adapters, effects, fields, runes and gates, summons, statuses, drawing, spellbook panel, hotbar signs (drag, “Assign to slot”, long-press).
- `src/game.js` — only small hooks (collision/sight for walls, damage interrupts and bind breaks, Rebounding Armor, hexed creature blows, Ward of Protection armor, chest traps, night sight, polymorph and summon drawing, HUD chips, save/boot).

## Implemented

- All 64 records, eight per circle, stable IDs `magery.01`–`magery.64`, sign art from the atlas in the book and on the hotbar.
- Book success per the brief (I–VI linear to .99; VII–VIII `.02 + .025 × (M − gate)`), scroll gates and chance, 3 s hold, 350 ms recovery, reserve-at-start ledger (interrupt: half mana rounded up, items back; fizzle: everything spent), 0.3 m drift, 70% walk for Lesser Mend and Arcane Arrow, any positive damage interrupts.
- Cancel cast: a dedicated button (and Esc) during prep or hold. Prep → interruption ledger; hold → let go unused (charge already spent), 350 ms recovery.
- Target chosen at release, never automatically. A wrong tap keeps the spell and names the required target. Adapters: living, self/friend, ground, ground-or-anchor, adjacent ground, chest, field segment/gate mouth, rune (panel), summon.
- Resistance with the recipient's Wardcraft, `half_then_focus`, `half_only`, `negates`, `poison_tier`, `duration`, `banish_check`; one roll per actor per impact; impacts deduplicated by event ID; committed hits follow the recipient and die with it or on a level change.
- Direct hits with per-spell impact delays (Delayed Explosion 2 s, bolt/fireball/lightning/pillar 1 s), Mindburst with backfire, shared pools (Chain Lightning, Meteor Shower), Earthshaker, poison with replace rules, cure/area cure, heals.
- Stat boons and hexes (one strongest positive and negative per stat, algebraic, clamped 1–125, pools clamp down, never refill), Ward of Protection / Circle of Protection, Rebounding Armor, Mirror Ward (one bounce), Night Sight, Veil of Invisibility, Veiled Identity, Borrowed Form (hound, boar, rat).
- Paralyzing Bind with player/creature durations, bosses immune, break on any damage including poison, 6 s shared control immunity.
- Fields: Wall of Stone (blocks walking and sight), Wall of Aether (blocks walking), Wall of Flame (one pulse per second per cast, entry pulses), Wall of Venom (one attempt per entry + one 2 s retry), Wall of Paralysis (once per entry, respects immunity). Cardinal snapping, even-length indices, wall clipping, no solid segments on occupied tiles, shrines or stairs. Dispel Field removes one segment or closes one gate mouth.
- Runes: blank runes sold by the apothecary; Mark (with overwrite confirmation and region preview), Rune Recall, Rune Gate (two mouths, 30 s, explicit step-through confirm, 1 s debounce, followers that qualify travel). Rejections: overweight, rooted, ghost, travel lock, blocked destination.
- Chests: Rune Trap (springs on the next open; uses the trapper's M/E and the opener's R), Unravel Trap, Open Seal (tier 1 needs 40, tier 2 needs 70), Far Hand (remote latch use; a remote spring harms no one beyond one tile). Arcane Lock rejects world chests (no owned containers yet).
- Summons with the record's stat block, control slots, controlled duration `floor(4M)` / 90 s wild, Spirit Blades (highest Tactics) and Aether Vortex (highest Intellect, 25% tier-2 poison) choosing targets including the owner, single attack timer for melee/ranged, ranged hits resisted `half_only` with the summoner's M. Banish Summon / Mass Banishment.
- Save migration (snapshot `shardfall.save.v1.premagery`, idempotent): genuine equivalents into a spellbook and the hotbar; legacy-only spells (Sable Curtain, Saltstorm, …) stay addressable and castable from old bars. `SF.MAGERY.translate()` is the single mapping service.
- Reagents: sold at the apothecary (plus circle I–III scrolls, spellbook, runes) and the outlaw camp (circle IV–V scrolls); some creatures drop reagents; the Bellkeeper drops a Flame Pillar scroll.

## Shardfall choices and tuning (not OSI values)

- Creature Wardcraft = difficulty − 15 (0–100) and creature Intellect = 20 + 0.6 × difficulty unless a template sets `wardcraft` / `int`.
- A strength hex scales a creature's blows by (1 + Δ/100); a dexterity hex lowers its attack skill by Δ.
- Open Seal on a tier-0 chest needs 20. Summon NPC attack skill is 60.
- Circle VIII at 100 Spellcraft succeeds 52% of the time from a book (the brief's formula); scrolls or more skill headroom are the way up.

## Not done yet / next

- Restore Life needs other players: the ghost adapter exists, but no second actor in the offline slice. Needs the two-actor test fixture or server replication.
- Arcane Lock needs owned containers (house chests). Trappable doors and pouches are not in the world yet, so Rune Trap / Far Hand use dungeon chests.
- Statuses (boons, hexes, wards, fields, gates, summons) are not saved across reloads; only the migration marker and base attributes are.
- No practice-ring rules, PvP aggression records, burst ceiling or outlaw multiplier in the offline slice; those belong to the combat service.
- Fixed 50 ms simulation ticks: durations round up to 50 ms, but the frame loop still advances by the frame delta.
- Creatures do not cast spells yet, so Mirror Ward only matters against your own reflected spells.
