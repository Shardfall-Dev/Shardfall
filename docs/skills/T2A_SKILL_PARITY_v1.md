# Shardfall — T2A skill parity audit and implementation brief v1.0
Date: 2026-11-27. Audited v0.28.1 source on main (tree e059eb05e53f77dfb4050ac3711601abaaa64aaa). Design only; no runtime source changed or tests executed. Target: late-1999 T2A (including November 23 skill-management patch), not Renaissance/AoS or modern UO. Use original Shardfall assets/world and browser controls. Treat modern shard differences as explicit tuning decisions, not historical facts.

## Registry and migration
Current 41 entries = 20 unchanged, 19 rename/rework, 2 nonclassic. Target 49 = 20 + 19 + 10 missing. Canonical display labels and suggested canonical IDs (old -> new):
- spellcraft -> magery (Magery)
- focus -> evaluatingintelligence (Evaluating Intelligence)
- wardcraft -> resistingspells (Resisting Spells)
- venomcraft -> poisoning (Poisoning)
- concealment -> hiding (Hiding)
- shadowstep -> stealth (Stealth)
- search -> detectinghidden (Detecting Hidden)
- pickpocketing -> stealing (Stealing)
- lockwork -> lockpicking (Lockpicking)
- trapcraft -> removetrap (Remove Trap)
- taming -> animaltaming (Animal Taming)
- beasthandling -> animallore (Animal Lore)
- lullaby -> peacemaking (Peacemaking)
- discord -> enticement (Enticement, NOT later Discordance)
- woodcutting -> lumberjacking (Lumberjacking)
- smithing -> blacksmithy (Blacksmithy)
- fletching -> bowcraft (Bowcraft & Fletching)
- engineering -> tinkering (Tinkering)
- appraisal -> itemidentification (Item Identification)
Unchanged: Swordsmanship, Mace Fighting, Fencing, Archery, Wrestling, Tactics, Anatomy, Parrying, Healing, Meditation, Alchemy, Tracking, Veterinary, Musicianship, Provocation, Mining, Fishing, Carpentry, Tailoring, Cooking.
Add: Arms Lore (armslore), Begging (begging), Camping (camping), Cartography (cartography), Forensic Evaluation (forensicevaluation), Herding (herding), Inscription (inscription), Snooping (snooping), Spirit Speak (spiritspeak), Taste Identification (tasteidentification).
Remove Skinning and Foraging from skill allowance; retain corpse carving and plant gathering activities, material supply, tools and quest objectives. Retain all other crafting recipes/material tiers (including Shardfall-specific materials). Do not arbitrarily remove item/art/audio IDs because skill IDs change.

Use one authoritative registry, explicit skill metadata: passive/active, target mode, cooldown, dependencies, stat weights, implementation state, gain policy. Build a versioned idempotent save migration after existing combat/magery/equipment migrations: move values in integer tenths and locks, remap gain history, lowerRank, ally/NPC persisted skills, quest and profile references, and hotbar actions as applicable. Preserve removed-skill points and collisions in existing recoverable skillPool, no cap overflow or duplicate awarding; do not reset existing characters. Distinguish action IDs from skill IDs (e.g. audio bard.discord may remain). Ensure save/load works with old and current schema. Rebuild generated HTML using repository instructions.

## Critical code findings
1. src/rules.js:66–100 universal gain window abs(skill-difficulty)<40; same-target cap 3 attempts/600 s (even unsuccessful attempts); permanent recipe count taper. This blocks repeat practice and makes fixed-difficulty skills impossible to GM. src/game.js:257 Stealth diff 40 -> zero gain at 80; :699 Hiding diff 40 -> zero at 80; :708 Tracking diff 30 -> zero at 70; :833 Meditation diff 40 -> zero at 80, only rolls when mana reaches full; :1188 Detecting Hidden diff 45 -> zero at 85; :1193 Veterinary diff 40 -> zero at 80; :1201 Stealing diff 55 -> zero at 95; :1212 Appraisal diff 30 -> zero at 70; :2372 Animal Lore diff 30 or 55 -> cannot GM; :1215 repairs diff 30. Replace blanket gain with per-skill era-based difficulty or use-based gains, viable 0–100 routes, genuine attempt checks, appropriate cooldowns, no global three-attempt rule or permanent recipe penalty. If anti-abuse needed for future multiplayer, separate policy from progression, don't block normal repetition. Verify each skill has training targets/recipes through GM; tune rate for single player only as documented config.
2. src/rules.js:12–64 caps are 100 each skill, 700 aggregate, 225 stats and 100 each stat: keep. Current starts at 150 stats/min25 and starts with up to 100 skills, max50 each. Late T2A creation: verify selected patch's exact starting stat allocation from historical sources before replacing; UOSA examples suggest 80 total (60/10/10), not 150. Use up to three distinct allowed skills, 100 points, max50 each; exclude Stealth/Remove Trap. Add real vs displayed skill (stats influence applicable skills; base alone counts toward 700). Keep up/hold/down and GM titles; no character XP/level gates. game.js:1940–1943,1986–1987 currently universal trainer, first two lessons free, quadratic price and directly buy stats for 25g each. Replace with profession-specific NPC training up to 30 and appropriate era pricing; remove direct stat purchases, implement skill-use-linked stat gains and 225 cap per chosen patch. Preserve old character stats where valid, avoid unintended nerf. Stat lock/atrophy only per verified era rules.
3. src/magic.js:15,19,63,148,179,182 etc. existing Magery spellbook and 64 spells use old keys. Rename and preserve eight-circle book, reagents, mana, targeting and spell IDs. Evaluate Intelligence damage scaling plus active INT assessment; Magery casting success; Resisting Spells defensive checks. At line 148 resistance gain requires target player AND caster player; ordinary enemy spells don't trigger that gain through this path. Audit every NPC/monster offensive spell, reflected spell, trap and resistible effect; eligible resistance gain for incoming magic, not only self-casting. Do not grant resist for nonresistible effects. Add active/passive meditation per era, INT and armor interference, interruption rules and reachable gain. Current rules.js:293–294 passive max 3.2 mana/s plus flat 4 active before armor; historical reference maximum ~2/s. Recalibrate.
4. Combat rules.js:113–221 already uses weapon skill hit chance, tactics damage multiplier (0.5–1.5), anatomy 0–20% damage, shield parry and healing formula with 60/60 cure and 80/80 resurrection. Retain baseline; audit exact damage order, timing, gear, durability, healing eligible gain at high skill (game.js:637 gates on treatment probability 0<chance<1, normal heal guaranteed from 90). Compare actual late-1999 mechanics rather than mixing March 2000 secondary skill changes silently. Anatomy active and passive gain must follow selected historical patch; record any deliberate choice. Braced Guard is custom, not classic; remove from parity mode or make explicit optional extension. Verify axe weapon mapping (ordinary axes swords; war axe mace) and no later-era lumberjacking damage bonus.
5. game.js:691–704/257 Hiding currently grants free quiet steps even at zero Stealth; requires separate Stealth action after successful hide and 80 Hiding, armor difficulty, roughly 1 step/10 skill on success, reveal on running/invalid actions; no free walking on Hiding alone. Detecting Hidden target area/container, reveal actual hidden actors/traps; Tracking category/target selection (animals/monsters/NPCs/players when available) and updating directional marker. Remove Trap requires 50 real Lockpicking and Detecting Hidden; disarm container traps with failure risks, distinct from crafting/placing traps (Tinkering).
6. game.js:1175–1200 bard actions: Lullaby is single target 5s, Discord reduces stats 8s, Provocation auto-picks nearby monster for 8s. T2A Peacemaking interrupts combat in area, Enticement draws creature toward bard/distracts from guard position, Provocation requires explicit two-target selection and era duration/AI behavior, all check Musicianship and require instrument. Keep sounds, UI labels update.
7. game.js:1167–1193,2372 and rules.js:627–628: two pet slots, command success Animal Lore alone, Vet heals only by Vet (10+.35*v), no lore synergy or poison cure. Animal Taming creature-specific thresholds, timing, command/transfer/loyalty; Animal Lore active inspection (diet/condition) and contribution to control and vet. Vet with Animal Lore healing and 60/60 cure; check late-1999 patch before pet resurrection (do not import later rules). No historical pet-slot cap; for single-player simulation performance an explicit configurable safety limit is a deviation, not skill rule. Preserve NPC/pet AI and command event paths.
8. game.js:1172/1201–1204 stealing only small gold amount from smuggler. Snooping inspect NPC/other actor containers; Stealing selected item or random eligible item, weight, proximity, detection, notoriety/guards, cooldown, no duplicate items. Integrate with existing/future criminal and murder systems without making nonhostile civilians monsters. Poisoning use actual potion tier, skill success/failure, eligible food/weapons, poisoning not auto-guaranteed or generic all-weapon coating. Verify era-specific weapon poison rules before implementation.
9. game.js:1212 Appraisal only estimated price; Item Identification should reveal hidden item properties; Arms Lore separate condition/quality appraisal. Inscription recipe uses known spell, blank scroll, mana/reagents and skill/circle requirements as historically appropriate; preserve spell scroll use and economy.
10. Crafting/gathering: rules.js recipes and equipment.js plus game.js:2044–2280. Mining ore and smelting, Lumberjacking logs, Blacksmithy smith/repair, Carpentry woodwork, Tailoring cloth/leather, Bowcraft & Fletching bows/ammo, Tinkering tools/locks/traps, Alchemy potions, Cooking food, Fishing fish/treasure. Ensure tier progression has viable GM recipes/nodes, preserve material grades, station/tool/range, success/failure/material consumption and quality. No new separate crafting skill for smelting/woodworking. Retain original Shardfall world and materials.

## Missing skills acceptance
Arms Lore: use on weapons/armor for condition, quality, damage/protection descriptors. Begging: target NPC, skill/karma/purse/cooldown and response. Camping: kindling, campfire and bedroll, secure-camp state and logout behavior adapted to local save (not free teleport). Cartography: blank map and mapmaker tools; create maps and decode graded treasure maps with world marker, dig via Mining/tool and unlock chest. Forensic Evaluation: corpse identity/cause, killer evidence if available; recent lockpicker clues per era; no fabricated data. Herding: shepherd's crook, animal target then destination, movement AI. Inscription: scroll crafting as above. Snooping: see eligible pack contents, detection/guard integration. Spirit Speak: understand ghost speech, not later self-healing. Taste Identification: identify poison in food/drink/potions per era. Each must have actual action, success/failure, skill gain, NPC training as appropriate; mark pending until real implementation rather than pretending live.

## UI and templates
Skill panel alphabetic or classic categories, expandable, real/display toggle, skill value to 0.1, arrows, 700.0 total and base value, search, one tap skill action/target, short help, dependencies and pending badges; no clutter. Starting presets are editable suggestions, not hard classes. Example seven-GM dexer: Swordsmanship/Tactics/Anatomy/Healing/Parrying/Resisting Spells/Magery (custom tradeoff); tank mage: Magery/Evaluating Intelligence/Meditation/Resisting Spells/Wrestling/Swordsmanship/Tactics; bard: Magery/Evaluating Intelligence/Meditation/Resisting Spells/Musicianship/Provocation/Peacemaking; tamer: Animal Taming/Animal Lore/Veterinary/Magery/Meditation/Evaluating Intelligence/Resisting Spells; crafter: Mining/Blacksmithy/Lumberjacking/Carpentry/Tinkering/Tailoring/Bowcraft & Fletching. Check starter equipment and profiles, quests, tutorial, actions, tooltips, crafting and magic book labels. Preserve current UI improvements and don't revert concurrent changes.

## Execution phases
A. Registry, migration, UI labels, skill cap and regression tests (no broken references; new and old saves). B. Gain/stat and trainer subsystem, tests across skill values 0/30/50/80/90/99.9/100, cap transfer, hold/down, resource/recipe repeated training. C. Combat/magic and stealth/thief/bard/tamer corrections with mechanics tests. D. Missing skills, supporting content and economic loop; update active flags only with usable mechanics. Use separate commits, run existing build/test scripts plus new unit and browser smoke tests at each step. Final report list each of the 49 skills, status, actual mechanics, 0–100 path, deviations, tests and unresolved work. Keep simulation skill APIs deterministic and renderer-free for future multiplayer authority; no multiplayer implementation now.

## Reference links
- https://wiki.uosecondage.com/Category:Skills
- https://wiki.uosecondage.com/1999_Patch_Notes
- https://wiki.uosecondage.com/Ultima_Online:_The_Second_Age_Patch_Notes_for_11/23/1999
- https://wiki.uosecondage.com/Ultima_Online:_The_Second_Age_Patch_Notes_for_02/24/1999
- https://wiki.uosecondage.com/Ultima_Online:_The_Second_Age_Patch_Notes_for_03/28/1999
- https://wiki.uosecondage.com/Stealth
- https://wiki.uosecondage.com/Remove_Trap
- https://wiki.uosecondage.com/Animal_Taming
- https://wiki.uosecondage.com/Animal_Lore
- https://wiki.uosecondage.com/Enticement
- https://wiki.uosecondage.com/Peacemaking
- https://wiki.uosecondage.com/Provocation
- https://wiki.uosecondage.com/Meditation
- https://wiki.uosecondage.com/Healing
- https://wiki.uosecondage.com/Tactics
- https://wiki.uosecondage.com/Lumberjacking
- https://wiki.uosecondage.com/NPC_Trainers
- https://wiki.uosecondage.com/Getting_Started
UOSA is a reconstruction; historical patch notes take precedence where mechanics conflict. Do not claim exact parity for unverified formulas.
