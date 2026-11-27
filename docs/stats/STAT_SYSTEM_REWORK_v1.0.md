# Shardfall — T2A attribute system rework v1.0
Status: implementation specification (not implemented). Audit baseline: main, README v0.28.1. Recheck current HEAD before coding, particularly the parallel skill-name reform.
## Verified problems
- src/rules.js:12–22: 225 total and 100 individual already correct; creation 150/min 25, HP floor(50+STR/2) differ from Second Age. Carrying capacity 40+3.5*STR WU is existing intentional balance.
- src/rules.js:76–100: SF.tryGain exits on skill lock, GM, no skill increase or cap. Stat advancement must not depend on its success.
- src/rules.js:641: statTrainCost; src/game.js:1940–43 Attributes trainer tab, 1987 ACT.stat purchases +1/+5 for 25 gold each and checks effective P.str/dex/int instead of natural values.
- src/game.js:85 gain wrapper; newChar around 193; creation profiles and renderCC around 2440–2470; save v7 around 2425; migrateSave around 2299.
- src/magic.js:420–428 recomputeStats maintains P.base and P._eff but infers permanent changes from edits to effective P fields. Replace inference with explicit natural-stat mutation. save already overlays P.base into saved str/dex/int. src/equipment.js EQ.effective and EQ.refresh, src/equipment-ui.js eqStatsHtml, HUD/gear panels must be integrated.
## Target rules
Classless, no XP, stat points, level-ups, gold purchases, stat trainers, daily quests awarding stats or generic running/clicking gains. NPCs retain low-skill lessons (at most 30.0) and may explain attributes; buying skills never triggers stat gain. Delete statTrainCost and ACT.stat, not merely hide the button; replace trainer Attributes tab with information or remove. Keep free skill lessons and quest compatibility.
Natural STR, DEX, INT (Intelligence, not Intellect), integers 10–100 each and sum <=225. Starting total 80, each 10–60; use 1-point creation controls (optional +/-5 as secondary), centralized creation validation and update all presets, tooltips and tests. Example presets: glaive hybrid 35/20/25; venom 30/40/10; healer 20/10/50; archer 25/45/10; mace 35/35/10; smith 45/25/10. These are presets not classes. Existing 150-point characters retain their legitimate saved base stats; do not reset or deduct gold. Starter weapons/equipment, mob difficulty and quests need testing for fresh 80-point builds; provide appropriate low-requirement starter gear, not free stats.
T2A resources: max HP = effective STR, stamina = effective DEX after equipment penalties, mana = effective INT (floor each at 1). Existing 40+3.5*effective STR WU carry formula stays as Shardfall tuning; keep existing weapon damage/skill, swing delay, bandage and meditation math and verify they read the correct effective stat/resource. Do not double apply EQ dex or stat bonuses. Review STR requirements and armor invalidation after loss: existing equipped items below requirement should be safely unequipped into backpack (allow temporary overburden), or disabled with clear reason until usable; never destroy/drop items. Pick and test one consistent policy.
## Natural vs effective
One canonical base: P.base {str,dex,int} (or equivalent pure data with one migration). P.str/dex/int are computed compatibility fields with magical modifiers; equipment modifiers applied once through existing EQ. Never write directly to effective fields for progression. Base-only cap, locks and atrophy. Buffs/debuffs can temporarily change effective values outside 10–100 and sum 225, subject to existing magic limits; never grant permanent points. Replace recomputeStats delta inference. Recompute magic/EQ and clamp pools after mutation, no free healing/mana/stamina; ghost HP stays zero, living HP at least 1. No resurrection or full refill from gain. Recompute on gain, load, buff expiry and gear change; no stat checks per render or simulation tick.
## Stat locks and atrophy
Persist statLocks {str:'raise',dex:'raise',int:'raise'} with same enum raise/hold/lower as skills; defaults all raise. Show up arrow / lock / down arrow on each stat in Character/Paper Doll with accessible labels and touch targets. Only raise may gain, only lower may donate. Below 225 a lower stat does not decay. At 225, atomically transfer exactly one point from an eligible lower stat above 10 to the selected raise stat below 100; if none, reject without mutations. Deterministic donor: highest natural eligible lower stat; ties STR, DEX, INT. This explicit priority is Shardfall tuning. Locks are independent of skill locks, and no direct +/- after creation. Normal death does not erase stats. Future criminal/murderer stat loss separate explicit rule, not implemented here.
## Gain event contract
Pure SF stat rules (new src/stats.js if desired, wired to build.sh and Node tests; or in src/rules.js). Introduce tryStatGain(character, skillKey, context) -> structured result {gained, stat, lowered, reason, chance}. Use authoritative resolved gameplay events with actor id, unique action id, skill, difficulty, simulation time, source, validated target/recipe/node and injectable RNG. Call centrally from gain wrapper or committed-action dispatcher, independent of SF.tryGain result. A legal action that actually resolves may fail its skill roll and still qualify; canceled, impossible, targetless, no resource, invalid or duplicate actions never qualify. Inspect all gain callsites incl combat, magic, gathering, crafting, stealth, bards, veterinary, healing and passive resist/meditation. One stat roll maximum per resolved primary gameplay action; auxiliary skills (Tactics, Anatomy, Focus etc.) must not stack multiple stat rolls on same hit or cast; standalone real skill actions qualify. No pet/NPC/environment gains for player. No per-tick passive gains, status damage, menu clicks, trainer, trade, quest reward or corpse-open gains. Meditation checks only meaningful completed intervals while mana missing, not idle full mana; heal checks on real completed treatment of wound/poison/resurrection. Gathering/crafting use real finite nodes/materials. Reuse existing action validation and bounded anti-repeat design; do not call SF.tryGain twice or let it consume stat RNG stream.
Late T2A eligibility: skill must be Raise; GM at 100 can still train stats. Below GM at total skill cap 700, require an eligible other skill set Lower with points to atrophy (no skill point is consumed solely for a stat check). Held/lowered skills do not train stats in this selected late-T2A profile. If simultaneous skill gain transfers last donor tenth, evaluate eligibility using the pre-action state. No stat gain required to gain a skill.
### Explicitly tunable approximation (not asserted historical OSI formula)
Use global stat gain cooldown of 30 active simulation seconds after successful gain; no daily quota, no offline catch-up or debug accelerated time farming. For each eligible action choose one stat using positive primary/secondary weights after filtering locked, capped or blocked candidates. Initial chance per eligible action = 0.06*(1 - 0.75*(base-10)/90) clamped 0.015–0.06; chance declines with stat, not skill. Apply challenge factor (suggest 1 when appropriately challenging or valid GM use, 0.25 for trivial real use; invalid 0), bounded per-skill/target repeat penalty and a separate dedicated RNG. Choose from remaining eligible weights; if none return blocked. Cooldown and bounded dedup/repeat state persisted using active gameplay time; do not reset on reload. No infinite dummy or single stationary target exploit; do not inherit SF.tryGain's GM early return. Playtest with seeded sessions and adjust config, not hardcoded callsites. Aim noticeable progression while actually playing, not weeks of macroing; report measured gains/hour at low/mid/high stats and distinguish tuning from historical behavior.
## Skill-to-stat mapping
Primary/secondary baseline 75/25, one-stat 100; rows are proposed design weights, not historical numeric claims. Cover all current keys. Reconcile aliases with concurrent UO skill reform; use canonical IDs in runtime, not duplicate skill rows. New skills must explicitly declare mappings or reason for no mapping.
| Existing key | UO name or role | Primary | Secondary |
|---|---|---|---|
| swordsmanship | Swordsmanship | STR | DEX |
| macefighting | Mace Fighting | STR | DEX |
| fencing | Fencing | DEX | STR |
| archery | Archery | DEX | STR |
| wrestling | Wrestling | STR | DEX |
| tactics | Tactics | STR | DEX |
| anatomy | Anatomy | INT | STR |
| parrying | Parrying | DEX | STR |
| healing | Healing | DEX | INT |
| spellcraft | Magery | INT | — |
| focus | Evaluating Intelligence | INT | — |
| wardcraft | Resisting Spells | INT | STR |
| meditation | Meditation | INT | — |
| alchemy | Alchemy | INT | DEX |
| venomcraft | Poisoning | INT | DEX |
| concealment | Hiding | DEX | — |
| shadowstep | Stealth | DEX | — |
| search | Detecting Hidden | INT | DEX |
| tracking | Tracking | INT | DEX |
| pickpocketing | Stealing | DEX | — |
| lockwork | Lockpicking | DEX | INT |
| trapcraft | Remove Trap | DEX | INT |
| taming | Animal Taming | INT | STR |
| beasthandling | Animal Lore | INT | — |
| veterinary | Veterinary | INT | DEX |
| musicianship | Musicianship | DEX | INT |
| lullaby | Peacemaking | INT | DEX |
| discord | Discordance | INT | DEX |
| provocation | Provocation | INT | DEX |
| woodcutting | Lumberjacking | STR | DEX |
| mining | Mining | STR | — |
| foraging | Shardfall gathering | DEX | INT |
| skinning | Shardfall gathering | DEX | STR |
| fishing | Fishing | DEX | STR |
| smithing | Blacksmithy | STR | — |
| carpentry | Carpentry | STR | DEX |
| tailoring | Tailoring | DEX | INT |
| fletching | Bowcraft/Fletching | DEX | STR |
| engineering | Tinkering | DEX | INT |
| cooking | Cooking | INT | DEX |
| appraisal | Item Identification / Arms Lore role (audit) | INT | — |
Future classic examples: Camping STR/DEX/INT, Herding STR/INT, Spirit Speak INT, Snooping DEX, Inscription INT, Cartography INT, Arms Lore INT/STR. Map actual added canonical skills after skill audit.
## UI
Paper Doll/Character status: compact natural STR/DEX/INT rows with visible effective value if different, arrow/lock/down clickable cycle or accessible picker, total natural points e.g. 185/225, Health/Stamina/Mana current/max, weight, concise tooltips showing which skills train each stat. Skills panel optionally shows primary/secondary stat icons. Gain journal once per event: 'Your Strength has increased to 61.' At cap also show donor decrease. No spam from failed rolls or blocked locks; optional DEV diagnostics only. Refresh open panels without reset scroll or collapse. Phone touch >=44px controls and desktop accessible keyboard. UI actions only validate/set locks; never set permanent stat values.
## Save migration and future multiplayer
Advance save schema from v7 only if still current; integrate with migrateSave and preserve migration backup/UID/equipment/skills/quest/world. Legacy saved str/dex/int already natural if P.base existed; prefer valid explicit base if present, never treat active buff or eqDex as base. Preserve valid stats; deterministic repair malformed/overcap only, log repair. Default locks all raise, migration idempotent. Persist natural values, locks, cooldown/repeat metadata; effective stats and temporary equipment penalties recomputed, follow existing magic save policy. Keep single atomic save. Implement command/event validation in pure engine, no DOM or localStorage in rules; browser currently single player; later server authoritative, no client-supplied stat values, RNG, time, targets or action IDs trusted.
## Acceptance
- Unit tests for creation total 80/min10/max60, cap 225, per-stat 100/min10, integer validation, all lock permutations, no donor below minimum, atomic transfer, below-cap no decay, weighted rolls deterministic, blocked eligibility, GM/700 cap rules and duplicate action/cooldown persistence.
- Buff/curse active during gain and cap transfer, expiration and reload never double/lose permanent point; equipment dex only once; HP/mana/stamina clamp without refill, ghost unaffected; STR reduction equipment/weight policy without loss; no effect on existing damage math except corrected HP.
- Integration via actual mining, smithing, melee miss/hit, archery, healing, casting, resistance, meditation, stealth/bard etc. Verify trainer action cannot mutate stats or charge gold; skill lessons work. Invalid/canceled and repeated action protections; no multi-skill double rolls.
- Browser smoke desktop/mobile: creation presets playable, character locks visible and persistent, natural/effective values and cap accurate, quest progression, death/reload. Add tests/stats.test.js and tests/stats-smoke/run.py (follow repo patterns). Run existing rules/equipment/magery/combat and world tests and relevant smoke suites; record pass/fail, do not claim tests not run. Review README, build.sh and Pages workflow; version bump according to current HEAD, regenerate HTML, document changes and remaining approximations. Commit actual implementation separately; do not overwrite concurrent skill/UI work.
## Historical references
- https://wiki.uosecondage.com/Stats — resource equivalence, 225/100 caps and stat effects.
- https://wiki.uosecondage.com/Ultima_Online:_The_Second_Age_Patch_Notes_for_11/10/1998 — GM gains and atrophy at cap (archived notes).
- https://wiki.uosecondage.com/1999_Patch_Notes — late-era restrictions at skill cap.
- https://wiki.uosecondage.com/Begginers_Guide — 80 initial attribute points.
- https://wiki.uosecondage.com/Skill — NPC skills to 30 and natural advancement.
- https://uo.com/wiki/ultima-online-wiki/player/stats/skills-stats-and-attributes/ — later-era lock UI reference only; do not import later stat scrolls or gain formulas.
