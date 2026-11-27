# Attributes (STR, DEX, INT) — status, v0.30

Implements `docs/stats/STAT_SYSTEM_REWORK_v1.0.md` (specification commit `8fec0af`). Code: `src/stats.js` (pure rules, `SF.STATS`),
`src/rules.js` (pools, creation check), the stat wiring in `src/game.js` (gain wrapper, `statRoll`, creation, Character page, trainer,
save v8), `src/magic.js` (`recomputeStats`) and `src/equipment-ui.js` (paper doll). Tests: `tests/stats.test.js`, `tests/stats-smoke/`.

## What changed for the player

- **No purchased attributes.** The trainer's Attributes tab now explains how attributes grow and sells nothing. `SF.statTrainCost` and
  the `stat` purchase command are gone (deleted, not hidden). Skill lessons to 30 are unchanged, including the two free lessons.
- **Creation: 80 points, each 10–60** (T2A). One-point controls with ±5 as a secondary control; the six presets are the spec examples:
  Glaive hybrid 35/20/25, Venom skirmisher 30/40/10, Group healer 20/10/50, Archer scout 25/45/10, Mace dexer 35/35/10, Merchant smith
  45/25/10. Presets are editable suggestions, not classes.
- **Health = Strength, Stamina = Dexterity (after armor penalties), Mana = Intelligence** (effective values, each at least 1). Carrying
  capacity keeps Shardfall's 40 + 3.5 × STR weight units. Weapon damage, swing delay, bandage and meditation math are unchanged and read
  the same effective values as before.
- **Natural growth.** Using a skill can raise one of the attributes that skill trains, one point at a time, up to 100 each and 225 in all.
- **Locks.** Character page and paper doll: each attribute has a ▲ / ■ / ▼ button (Raise / Locked / Lower; 44 px; labelled for screen
  readers; reachable by keyboard). Only ▲ can rise. At 225 a point moves from a ▼ attribute above 10 to the ▲ one; below 225 nothing decays.
- **Journal.** One line per gain: “Your Strength has increased to 61.” At the cap the same line names the donor. Failed rolls and blocked
  locks are silent (the developer panel, `?dev`, lists every attribute check on the Skills page).
- **Starter gear.** Every new character starts in plain leather (cap, gorget, tunic, sleeves, gloves, leggings: no Strength requirement,
  no meditation penalty). A starter weapon whose Strength requirement the character does not meet is replaced by a lighter one of the same
  skill (the 35-STR Glaive hybrid gets the sword; the halberd needs 45) or put in the pack.

## The model (natural vs effective)

- `P.base = { str, dex, int }` is the only permanent value: integers 10–100, total ≤ 225. It changes only in `SF.STATS.tryStatGain`
  (a gain or the transfer at the cap), at creation (`SF.STATS.init`) and in the save conversion (`SF.STATS.migrateChar`).
- `P.str / P.dex / P.int` are computed by `recomputeStats()` = natural + magic (`MG.effectiveStat`, which keeps Magery's own 1–125 clamp).
  Equipment applies only the armor Dexterity penalty, once, through `SF.EQ.refresh` (`eqDex`). Items grant no attribute bonuses.
- The old `recomputeStats` inferred permanent changes from writes to `P.str` etc. That inference is removed.
- `recomputeStats` runs on a gain, on load, when a boon or hex starts or ends, on death, and after gear changes (via `EQ.refresh`); not per
  frame. Pools clamp down and never refill; a living character keeps at least 1 HP, a ghost stays at 0.
- `P.statState` = `{ v, locks, last, seed, recent, seen, gains }`: locks, the time of the last gain (active simulation seconds, `GT`),
  a bounded repeat log, a bounded log of resolved action ids, and the state of the module's own random stream. Saved with the character.

## The gain event

`SF.STATS.tryStatGain(ch, skillKey, ctx)` → `{ gained, stat, value, lowered, lowerValue, reason, chance }`, for one resolved, legal action.
`ctx` = `{ action, now, actor, diff, target, valid, challenge, pre, rng }`. No DOM, no storage, no clock, no `Math.random`; the same input
gives the same output, so a future server can run it and accept nothing but the action from a client.

Order: valid ids and time → duplicate action (every evaluated id is remembered) → `valid: false` → skill eligibility (pre-action state) →
cooldown → repeat log → candidates → weighted pick of one stat → roll for that stat → commit.

- **Eligibility (late T2A profile).** The skill must be set to Raise. A Grandmaster (100.0) still trains attributes (this does not inherit
  `SF.tryGain`'s “skill is at 100” exit). Below 100 at the 700.0 skill cap another skill must be set to Lower with points to give; the stat
  check consumes no skill point. Held or lowered skills never train attributes. Eligibility uses the skill state before the action.
- **One roll per action.** The game's `gain(key, diff, ctx)` wrapper calls `statRoll` before `SF.tryGain`, independent of its result, on
  a separate random stream. Auxiliary skills pass `aux: true` and never roll; skills that share one action pass the same `act` id.

### Every call site

| Action | Primary (rolls) | Auxiliary (no roll) | Repeat key |
|---|---|---|---|
| Melee swing or bow / crossbow release, hit or miss (`swingAt`) | weapon skill | Tactics, Anatomy on the blow | the foe |
| Being struck while holding a shield | Parrying | — | the attacker |
| Bandage treatment completed (`finishFirstAid`): heal, cure, resurrect | Healing (also when the skill gain is gated off at 90+) | Anatomy | the patient |
| Active Anatomy check | Anatomy | — | the target |
| Cast resolved (`prepTick`), fizzle or not | Spellcraft (Magery) | Spell Focus (Eval Int) on damage, Wardcraft on self-cast | the spell |
| Meditation: each completed 10 s interval that restored ≥ 2 missing mana; completing to full | Meditation | — | — |
| Hiding near creatures; each quiet step near creatures | Concealment; Shadowstep | — | — |
| Tracking (only when something was found), Search, Taming, Veterinary, Pickpocketing, coating with venom, disarming, lockpicking, appraising, repairing | that skill | — | target where there is one |
| Mining / lumberjacking stroke at a finite node; foraging, fishing; skinning a corpse | that skill | — | the node / corpse |
| Crafting attempt with materials consumed | the recipe's skill | — | the recipe |
| Bard song (`TASKS.bard`), succeeded or faltered | the bard skill | Musicianship | the creature |
| Pet command (one command to several pets = one action) | Animal Lore | — | the pet |

Never: trainer lessons, purchases, quests and rewards, menu clicks, opening a corpse, pets or NPCs, status damage ticks, per-tick passive
regeneration, idle meditation at full mana, a ghost, or time fast-forwarded by the developer panel.

Not changed here (skill-system work, see “Coordination”): incoming enemy spells still do not train Wardcraft (only the player's own
self-cast does), Tracking/Hiding/Stealth/Detecting Hidden keep their current skill-gain difficulty windows.

## Tuning (Shardfall, not a historical OSI formula)

All in `SF.STATS.CFG`; change the config, never a call site.

| Value | Setting |
|---|---|
| Chance per eligible action | 0.06 × (1 − 0.75 × (stat − 10) / 90), clamped 1.5–6 % (6 % at 10, 1.5 % at 100) — falls with the stat, not the skill |
| Challenge factor | 1 when the difficulty is at least (skill − 25), or no difficulty is given; 0.25 when trivial |
| Cooldown | 30 active simulation seconds after a gain (persisted; no offline catch-up; no daily quota) |
| Repeat penalty, same target or node | free for 8 uses in 10 min, then −0.08 per use down to 0 (no stationary-target farming) |
| Repeat penalty, same skill on any target | free for 20 uses in 10 min, then −0.08 per use down to 0.25 |
| Donor at 225 | the highest natural ▼ stat above 10; ties STR, DEX, INT |
| Meditation interval | 10 s, at least 2 mana restored while mana was missing |

### Measured (seeded, `tests/stats.test.js` and a 20-hour model run of the pure module)

Gains per hour of Strength from Mining at a constant stat level, varied nodes, appropriately difficult:

| Action every | stat 25 | stat 55 | stat 90 |
|---|---|---|---|
| 2 s | 20.3 | 15.6 | 8.6 |
| 3 s | 14.6 | 11.6 | 6.0 |
| 5 s | 8.8 | 7.1 | 4.1 |
| 10 s | 5.0 | 4.0 | 2.3 |
| 30 s | 6.7 | 4.7 | 2.3 |

Trivial targets give about a quarter of that; three nodes in rotation give almost nothing. From the 80-point Glaive hybrid start, an action
every 3 s across four skills reaches a natural total of 120 after 2.2 hours of play, 160 after 4.1, 200 after 7.0 and 225 after 9.0.
Noticeable while playing, not weeks of macroing. This is tuning; historical servers differed and the numbers are expected to be adjusted
after playtests.

## Strength requirements after a loss

Policy: when a natural Strength point is given away at the cap, every worn piece whose requirement is now above the character's Strength is
moved to the backpack through the validated `EQ.unequipItem` command, with a journal line. Nothing is dropped or destroyed; the pack may
become overweight and encumbrance applies as usual. A temporary hex (Sap Strength, Threefold Curse) never unequips anything; equipping
still checks current Strength. Death does not touch attributes.

## Saves

- Schema v7 → **v8** (`migrateV8` in `src/game.js`, after the combat, Anniabreen, Living World, expansion and equipment conversions). The
  old save is kept once as `shardfall.save.v1.prev7`.
- The saved `str/dex/int` have always been natural values (save wrote `P.base` over them), so they become `char.base` unchanged. A valid
  explicit `base` wins; active boons and `eqDex` are never taken as natural. **Existing 150-point characters keep every point**; nothing is
  reset, deducted or refunded. Malformed values are repaired deterministically (non-numbers → 10, round, clamp 10–100, excess over 225 taken
  from the highest stat) and the repair is logged to the console. Locks default to Raise. Idempotent (`char.statMig`).
- v8 writes `char.base`, `char.statState`, `char.statMig`, and still writes the natural values into `str/dex/int` for older readers.
  Magic boons are not saved (unchanged policy). One atomic `localStorage` write, as before.
- Health of existing characters drops to Strength (for example 60 STR: 90 → 60 maximum). Current Health clamps; nothing is refilled.

## Coordination with the skill reform

The T2A skill parity reform (`design/t2a-skill-parity-v1`, `docs/skills/T2A_SKILL_PARITY_v1.md`) is design only; this build still uses
the 41 runtime skill ids. `SF.STATS.MAP` is keyed by those ids, and `SF.STATS.ALIAS` maps the planned canonical ids (magery,
evaluatingintelligence, resistingspells, … itemidentification) onto the same rows, so `SF.STATS.weights('magery')` already works and the
rename needs no second table. The ten classic skills the reform will add (Arms Lore, Begging, Camping, Cartography, Forensic Evaluation,
Herding, Inscription, Snooping, Spirit Speak, Taste Identification) are mapped in advance. A test fails if a runtime skill has no mapping
(or no reason in `SF.STATS.NO_MAP`). When the reform lands: rename the MAP keys, turn ALIAS around for old ids, keep `statRoll` call sites.

## Balance check for fresh 80-point characters (6 seeded fights each, fighting until one side dies, no bandaging)

| Preset | dock rat, v0.28.1 → v0.30 | reed boar, v0.28.1 → v0.30 (with starter leather) |
|---|---|---|
| Glaive hybrid | 6/6 → 6/6 | 5/6 → 4/6 |
| Venom skirmisher | 6/6 → 6/6 | 5/6 → 3/6 |
| Mace dexer | — | 6/6 → 5/6 |
| Archer scout | — | 5/6 → 5/6 |

Without the leather the boar results were 1/6, 0/6, 4/6, 1/6. Non-fighting presets lose a bare-handed fight against a rat on both builds.
Fresh characters are somewhat weaker against boars and marsh hounds than before (T2A starts are weak by design); the starter quests are
mining and smithing and are unaffected. Worth a playtest: if early fights feel too hard, raise starter gear or soften the starter area's
boars and hounds, not attributes.

## Tests

- `node tests/stats.test.js Shardfall_v0.30.html` — creation (80, 10–60, integers, presets, ±1/±5), derived pools, chance curve, challenge,
  caps, every lock permutation below and at the cap, donor rules, atomic transfer, below-cap no decay, 40 000 random actions keep the
  invariants, eligibility (hold/lower, GM, 700 cap, pre-action state, no skill point consumed), action contract (ids, time, invalid,
  duplicates, cooldown and dedup surviving save/reload, bounded logs), repeat penalty and the stationary-target case, deterministic seeded
  stream independent of `Math.random`, 75/25 weighting, boons and hexes during gains and the cap transfer, pool clamping (no refill, ghost
  0, living ≥ 1), the Strength policy, save migration (150-point character, repairs, explicit base, idempotence), the skill map and
  aliases, and gains-per-hour.
- `python3 tests/stats-smoke/run.py Shardfall_v0.30.html` — creation UI on desktop and phone, every preset playable (wearable starter
  weapon, Health = STR, fighters beat a rat), Character page and paper doll locks (cycle, keyboard, 44 px, scroll kept), natural and
  effective values during a boon, save v8 and reload, death and reload, and real gameplay paths (melee miss and hit, archery, mining,
  smithing, bandaging, two casts, meditation interval and idle, hiding, bard success and failure, trainer lesson, developer fast-forward,
  the cap transfer, the Strength policy, a boon during a gain, a ghost), and the v7 → v8 conversion of a 150-point character.
- Existing suites: see the pull request for the run of this build. Fixtures that wrote `P.str/dex/int` directly now set `P.base` and call
  `recomputeStats()`; First Aid expectations for Wren follow Health = Strength (60 STR → 60 HP); the combat play-test swaps back to the
  sword (the Glaive hybrid's starter weapon now).
