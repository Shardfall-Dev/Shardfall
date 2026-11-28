# Server Combat v1 — every blow decided by the server (alpha)

The fourth server phase, after [Server Creatures v1](CREATURES.md). Build **v0.42**.

Online, characters and creatures now fight, and the server decides every blow by the game's own rules. A client can only say
which creature it wants to fight (or stop fighting) and, as a ghost, ask to be restored. It never sends a swing, a hit, damage,
a skill or a stat.

## What runs where

| | Server | Client (`src/online.js`) |
| --- | --- | --- |
| Arming | `target { nid }` → `World.target`: a living creature in your realm, not as a ghost, not with a bow | Attack button or Space: the selected creature, else the nearest one in sight; again to stand down; × on the target frame |
| Swings | The swing timer (`SF.swingTick` at your stamina and weapon), reach + 0.05, line of sight, then `combat.ts playerSwing` | The attack animation, swing sound, swing timer on the Attack button, damage floaters |
| Creature blows | Telegraph (species wind-up) → strike if still in reach (+0.35) and sight → `combat.ts creatureBlow` → recover | The wind-up ring and bestiary wind-up/impact poses, damage floaters, hurt voice |
| Health | Server-owned; regenerates out of combat (6 s) at the game's unfed rate (0.1/s); saved | HUD from `state.you.hp` / `hpMax` |
| Death | Once: a ghost (no sprint), disarmed, ignored by creatures; belongings stay with you online (no corpse until items are server-owned) | The game's ghost panel, the arrow to the nearest shrine, the ghost look |
| Resurrection | `resurrect { at: 'shrine' }` within 2.5 tiles of a shrine, or `{ at: 'bound' }` after 12 s (to your bound shrine); 25 % health, 20 % stamina and mana | "Restore at shrine" in the online bar when at a shrine; the ghost panel's Return button |
| Learning | The weapon skill from the hit chance, Tactics and Anatomy on a hit, Parrying from a parry; stats rise with them (`SF.SK.use` / `SF.SK.check`, stat locks respected); saved | Gains in the log, as offline |

## The rules (`server/src/world/combat.ts`, the game's `fighter` / `swingAt` / `strikeOne` / `applyBlow`)

- Hit chance `SF.hitChance(attack, defence)`: a character attacks and defends with its weapon skill (`SF.SK.value`, with the
  small stat lift and a magic weapon's accuracy); a creature with its species' `atk` / `def`.
- Damage, stage 1 `SF.rawDamage`: a character rolls its weapon's dice (magic damage, quality, condition) × the Tactics /
  Anatomy / Strength scale; a creature rolls its species' damage range (the game's doubled values) at scale 1.
- A creature's ward soaks a blow first (the bell sentinel).
- Stage 2 `SF.mitigate`: a struck character's shield may parry (Parrying / 2 %), the armour on one body region picked by
  `SF.EQ.pickRegion` absorbs 50–100 % of its rating, and the blow is halved for a player; a creature's natural armour
  (`monT2A`) absorbs.
- A creature that is struck turns on its attacker with its pack; timid animals bolt; a creature with a retreat rule runs once
  when badly hurt; one that gets home unhurt for 8 s heals. A creature at 0 dies once, leaves its spawner a vacancy (refilled at
  the species' pace) and its attacker stands down.
- Random numbers come from a seeded server stream (`SIM.stream`).

The creature data the rules need (atk, def, dmg, tele, rec, armour, ward, reach, ranged, keep) is exported from the build into
`server/data/population.json` with the rest of the species, so it is the offline game's live values.

## Not online yet (documented, next)

- **Items:** no corpses or loot, no gold, no item wear (weapons, shields and armour do not lose condition online), no
  ammunition — bows and crossbows are refused when arming.
- No magic online (spells, creature spells, poison, wards on characters); the ash wisp and other ranged creatures strike at their
  reach like melee; bosses' special attacks are not online.
- No PvP and no criminal system online; only creatures can be fought.
- Healers and First Aid are not online; ghosts are restored at shrines.

## Protocol v4

| Client → server | |
| --- | --- |
| `target { nid }` / `target { nid: null }` | arm on a creature / stand down; a refusal comes back as `combat { k: 'refused', reason }` with your request id |
| `resurrect { at: 'shrine' \| 'bound' }` | as a ghost |

| Server → client | |
| --- | --- |
| `combat { k: 'tele', a, t, dur }` | a creature winds up |
| `combat { k: 'hit' \| 'miss' \| 'parry', a, t, dmg, hp, max?, region?, w? }` | a swing or a blow and the target's health after it |
| `combat { k: 'whiff', a, t }` | a creature's blow that found nobody in reach |
| `combat { k: 'death', t, by, name }` / `combat { k: 'res', t, name }` | a death (creature or character) / a character restored |
| `gain { skill, value }` / `gain { skill, value, stat, statValue }` | what you learned (only to you) |
| `state.you { …, hp, hpMax, ghost, armed }` | your health, ghost and target |

`attack`, `damage`, `loot`, `skill`, `stat` and the rest are still refused as `not_authoritative`.

## Persistence

Health, mana, the ghost flag, skills and stats are saved with the position (every 30 s, on leaving, on shutdown) in one batch
statement. One migration: `supabase/migrations/20261128000002_server_combat_v1.sql` adds `game.characters.ghost`.

## Tests

- **Unit** (`tests/server/unit/combat.test.ts`, 9 tests): protocol v4; a swing's hit rate against `SF.hitChance` over 4 000
  swings and its damage bounds; a creature blow's hit rate, the halving for an unarmoured player, shield parries; arming, the
  swing timer cadence and reach; a creature's wind-up before its hit, death as a ghost that creatures ignore and cannot fight;
  resurrection at a shrine and at the bound shrine after the wait, at 25 %; regeneration out of combat only; learning and a
  creature dying once with a vacancy; arming refusals (unknown, another character, a bow, no character).
- **Integration** (`tests/server/combat.test.ts`, the real gateway and database): refusals with reasons; arming on a creature in
  view and the server's swing; a ghost loaded from the database, refused fights, the resurrection rules; blows, damage and loot
  still refused from clients.
- **Client**: a recording of a real server fight at night (a swordsman armed on a hound pack, until death) replayed into the
  built game, desktop and phone sizes, no page errors. Screenshots: [shots-combat/](shots-combat/).

## Next

Items and loot on the server: corpses (creatures' loot tables and the player's death transaction), picking up, the backpack and
equipment as server-owned state, item wear, ammunition — then magic.
