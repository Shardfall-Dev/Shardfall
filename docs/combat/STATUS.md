# Combat and First Aid — UO Second Age rules (issue #3)

> v0.30.0: skill gains for every combat skill now come from the classic check (`docs/skills/STATUS.md`): weapon skills learn from the swing's own hit chance, Tactics and Anatomy from every hit, Parrying from every block roll, Healing from every treatment up to 100.0. Braced Guard is an explicit Shardfall extension, switched off in parity mode.

Build: `Shardfall_v0.18.html`. Rules live in `src/rules.js` (pure, tested in node); the world adapter is the
"physical combat" block in `src/game.js`. Every physical blow — your touch or keyboard attack, the ally, pets,
summons and creatures — goes through one path: `swingAt` / `strikeOne` → `applyBlow` → `SF.rawDamage` → `SF.mitigate`.
Spell damage and poison ticks keep their own paths.

## Skills

| Old (≤ v0.16) | Now | Notes |
|---|---|---|
| Blades | Swordsmanship | swords, axes, glaive (halberd), hatchet, skinning knife, pickaxe |
| Hammers | Mace Fighting | mace, war hammer, war axe (the UO exception) |
| Knives | Fencing | dagger, kryss, spear |
| Archery | Archery | bow (arrows), crossbow and heavy crossbow (bolts) |
| Brawling | Wrestling | unarmed attack and defence |
| Shieldwork | Parrying | shield check, Braced Guard needs Parrying 50 |
| Field Medicine | Healing | First Aid / Bandage |
| Polearms | — | merged; see migration |

## Weapons (UOSA wiki "Weapons" table)

| Item (Shardfall name) | Profile | Skill | Dice | Speed | STR | Hands | Ref. HP |
|---|---|---|---|---|---|---|---|
| Quay sword | Longsword | Swordsmanship | 2d15+3 | 35 | 25 | 1 | 90 |
| Glaive | Halberd | Swordsmanship | 2d23+3 | 25 | 45 | 2 | 80 |
| Battle axe (new) | Battle Axe | Swordsmanship | 2d17+4 | 30 | 40 | 2 | 80 |
| Hatchet (tool) | Hatchet | Swordsmanship | 1d16+1 | 40 | 15 | 2 | 80 |
| Skinning knife (tool) | Skinning Knife | Swordsmanship | 1d10 | 40 | 5 | 1 | 40 |
| Pickaxe (tool) | Pickaxe | Swordsmanship | 1d15 | 35 | 25 | 1 | 60 |
| War hammer | War Hammer | Mace Fighting | 7d5+1 | 31 | 40 | 2 | 110 |
| Mace (new) | Mace | Mace Fighting | 6d5+2 | 30 | 20 | 1 | 70 |
| War axe (new) | War Axe | Mace Fighting | 6d4+3 | 40 | 35 | 1 | 80 |
| Dagger | Dagger | Fencing | 3d5 | 55 | 1 | 1 | 50 |
| Kryss (new) | Kryss | Fencing | 1d26+2 | 53 | 10 | 1 | 90 |
| Spear (new) | Spear | Fencing | 2d18 | 46 | 30 | 2 | 80 |
| Shortbow | Bow | Archery | 4d9+5 | 20 | 20 | 2 | 60 |
| Crossbow | Crossbow | Archery | 5d8+3 | 18 | 30 | 2 | 80 |
| Heavy crossbow (new) | Heavy Crossbow | Archery | 5d10+6 | 10 | 40 | 2 | 100 |
| (none) | Fists | Wrestling | 1d8 | 50 | — | — | — |

Item IDs are unchanged; tools stay tools (an equipped hatchet still chops, an equipped knife still skins).
New weapons are sold by Harl (smith) and Pell (bowyer), and drop from the captain, the bell sentinel and deep chests.
The pack and character screens show each weapon's skill.

## Resolving a blow

1. **Legal?** Alive attacker and target, reach (melee 1.5 m, bows 10 m), line of sight, swing ready. If not, nothing is spent.
2. **Hit** = clamp((attack + 50) / (2 × (defence + 50)), 0, 1). The defender uses the skill of the weapon in hand (Wrestling unarmed).
   Creatures supply `atk`/`def` ratings. Tactics, Anatomy and armor never enter it.
3. **Damage**: roll the real dice → ±4 for exceptional/below-average quality → × (0.50 + Tactics/100 + Anatomy/500 + STR/500)
   → × weapon condition (100 % at full, ~50 % near 0) → shield parry (chance Parrying/2 %, absorbs 50–100 % of the shield's AR)
   → armor absorbs 50–100 % of its AR → halved if the recipient is a player (you or Wren) → rounded half-up, minimum 0.
   Order and end-rounding follow the UOSA damage-formula thread (t=42652).
4. **Bashing weapons** (mace, war hammer): a hit drains 3–5 stamina and wears the armor that absorbed it by half the absorbed amount. A miss does neither.
5. **Swing timer**: 15000 / ((stamina + 100) × speed) s, floored to 0.25 s, within 1.25–10 s. Stamina 100: mace 2.50, bow 3.75, heavy crossbow 7.50.
   One readiness state per fighter: once ready it stays ready through unequipping, a new target or a held spell. Equipping during recovery
   restarts the timer for the new weapon (no free swing per equip); a ready swing carries over, so T2A weapon cycling works.
   A ready melee hit lands on the tick it is in reach; the animation only presents it.
6. **Archery**: the reload runs while you move, but a shot needs 0.5 s standing still. Range, sight and ammunition are checked at release;
   exactly one arrow or bolt is spent per release. Damage lands 1 s later if you have not moved and the target is still alive, in range and in sight
   ("blocked" or "wide" otherwise; the arrow stays spent).

## First Aid

| Patient | Self | Other | Outcome |
|---|---:|---:|---|
| Wounded | 15 s | 5 s | success (Healing + 10) %, −2 % per slip; heal floor(3 + Ana/5 + Heal/5) … floor(10 + Ana/5 + Heal/2), −4 per slip, min 1, capped at missing HP |
| Poisoned | 18 s | 6 s | needs 60/60; 80 % at threshold, +0.5 % per point above, −2 % per slip; poison only |
| Ghost | — | 10 s | needs 80/80; 25 % at threshold, +2 % per point above, −2 % per slip |

The bandage is spent only after validation (patient, state, reach, not at full HP). One application at a time, linked to its patient until it
finishes; completion re-checks life state and reach (2 m) and never pays out another treatment. Blows to the healer slip; the timer runs on.
The application is saved with the game: a reload resumes it once, and a finished one is never repeated. Bandage self: hotbar slot, the pack,
`B`, or the self target. Bandage other: tap Wren or a player ghost and press **Bandage …**, or the **Bandage other** hotbar action. Pets stay on Veterinary.

**Wren**, a quay sellsword by the plaza, is the local combatant fixture: player-like (half damage), fights with the same rules, follows on request,
falls to a ghost with an owned body, accepts bandage or spell resurrection, and otherwise is restored by a healer after 3 minutes and walks back for her gear.

## Save migration (v2 → v3, once)

Skill keys rename with their values and locks. Polearms goes to the equipped legacy polearm's family (the glaive → Swordsmanship), defaulting to
Swordsmanship. On a collision the higher value stays and the lower goes to a **reform pool** shown on the Skills page, placed 1.0 at a time,
never past 100.0 or the 700.0 total — points are never cloned or dropped. Gain history and lower-order follow the rename. Hotbar entries, equipment,
crafted quality and condition are untouched; a **Bandage other** action is added to a free slot. The untouched save is kept once in
`shardfall.save.v1.precombat`. A second load changes nothing.

## Approximations and Shardfall choices

| Topic | Choice | Why |
|---|---|---|
| Hit location | Since v0.25 every blow picks a body region (torso 40 %, legs 20 %, arms 15 %, head 15 %, hands 7 %, neck 3 %) and meets the strongest piece worn there; full-suit AR: cloth 2, leather 12, studded 16, ringmail 20, bone 22, chain 23, plate 30, dragon 35; helmets 18–32; shields 7–18 (buckler 7). See `docs/equipment/STATUS.md`. (v0.18–v0.24: one body piece, cloth 3, leather 13, chain 28, plate 40.) | Region odds and AR values are Shardfall tuning |
| Range units | 1 UO tile = 1 world metre (as in `docs/magery/spells.json`). Melee reach 1.5 m (adjacent tile incl. diagonal + slack); bows 10 m. | |
| Archery aim time | 0.5 s standing still. UOSA posts range from "stop for ~300 ms" to "2 s" (1999 era). | Sources disagree |
| Archery flight | Damage 1 s after release (UOSA patch notes); moving > 0.3 m before impact spoils the shot. | |
| Bashing effects | Only the mace and war hammer drain stamina and wear armor; the war axe uses Mace Fighting but is an axe (RunUO `BaseAxe`), so it does not. | Mace-family wording vs. the war axe exception |
| Parry absorption | A successful parry absorbs 50–100 % of the shield's AR (same roll as armor). UOSA's Parrying page gives the chance, not the amount. | Unsourced amount |
| Braced Guard | Kept (Shardfall ability): +12 points of parry chance for 0.8 s. | Not in T2A |
| Weapon durability | Reference HP sets the wear per landed hit on Shardfall's 100-point condition scale (25 / HP per hit); repair and breakage unchanged. | Keeps crafting/repair math |
| Creature numbers | Natural AR = 40 % of the old armor value; creature damage ranges doubled so the player half-damage step leaves PvE threat near v0.16 (pets and provoked creatures now hit about twice as hard, as UO creature-vs-creature damage was not halved). Creature STR/DEX: from HP and speed. Winded creatures recover slower by the same stamina term. | Creatures had no T2A stats |
| Heal success | (Healing + 10) %, −2 % per slip (RunUO pre-AoS; matches UOSA posts that GM-range healers never fail). | UOSA wiki silent |
| Slips | Any blow (not poison ticks) is one slip: −4 HP per slip (UOSA admin), −2 % chance. No 26-damage threshold (that is 2003). Dex-based delays (Feb 2000 patch) not used; the issue fixes 15/5 s. | |
| Cure/res above threshold | Cure +0.5 %/point to 100 % at 100/100; res +2 %/point to 65 % at 100/100. | Only threshold values are sourced |
| Gains | Weapon skill on every legal attempt; Tactics and Anatomy on a landed blow; Parrying on each shield check; Healing and Anatomy only when the treatment's chance was between 0 and 1. | |
| Melee timer while moving | Melee timer runs while moving (pre-April 2000). | |

## Sources

- wiki.uosecondage.com: Weapons, Category:Weapon_Skills, Tactics, Parrying, Healing, Insta_Hit, 2000 Patch Notes
- forums.uosecondage.com: t=42668 (swing table, caps), t=13143 (tick flooring), t=42652 (damage order, end rounding), t=24145 (archery, condition), t=2152 (archery 1 s delay), t=882 (4 HP per slip), t=9833 (damage halving)
