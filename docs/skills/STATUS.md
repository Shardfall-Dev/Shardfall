# Shardfall skills — Second Age parity status (v0.30.0)

Implements `docs/skills/T2A_SKILL_PARITY_v1.md` (audit of v0.28.1). Branch `feature/t2a-skill-system`.
Code: registry `src/rules.js` (`SF.SKILL_DEFS`), engine and per-skill rules `src/skills.js` (`SF.SK`, pure, renderer-free, rng injected),
the world side `src/game.js` (abilities, tasks, panels) and `src/magic.js` (Magery, Resisting Spells, Evaluating Intelligence).

Sources: wiki.uosecondage.com (Meditation, Stealth, Animal Taming, Animal Lore, Provocation, NPC Trainers) and the RunUO pre-AoS
skill code as a reconstruction of the classic checks. UOSA is itself a reconstruction; where neither gives a number, the value is a
**Shardfall choice** and is marked so below. Nothing here claims exact OSI parity for an unverified formula.

## What changed for every skill

- **One check.** Every use is a check against a window `[min, max]` in skill points (RunUO `CheckSkill`): below `min` it cannot
  succeed and teaches nothing; at or above `max` it cannot fail and teaches nothing; between, success is `(value − min) / (max − min)`.
  An eligible use teaches with chance `((100 − real)/100 + (1 − chance) × (success ? .5 : .2)) / 2`, never below 1%; under 10.0 real
  every eligible use teaches 0.1–0.4. Uses that roll their own success (a swing's hit chance, a resist roll) feed that chance in.
- **Gone:** the blanket `|skill − difficulty| < 40` window, the three-uses-per-target-in-ten-minutes rule (even for failures) and the
  permanent per-recipe taper. Repetition trains. `SF.SK.POLICY.antiMacro` is a separate hook for a future server, **off**.
- **Real and displayed.** Real (trained) skill counts toward 700.0, gates prerequisites (Stealth's 80 Hiding, Remove Trap's 50/50,
  First Aid's 60/60 and 80/80, Veterinary's 60/60) and is what trainers and the migration move. Displayed skill adds a stat lift of at
  most 5.0 points (stat 100, skill 0), fading to 0 at 100.0 — **Shardfall choice** for the size. The Skills page toggles the two.
- **Caps kept:** 100.0 per skill, 700.0 total, 100 per stat, 225 stats. At 700.0 a gain is paid by a skill set to Lower (atomic).
- **Stats grow by use.** Each gain event may raise the stats its skill leans on (chance weight / 33.3 per stat, RunUO-style weights —
  a reconstruction); at 225 a gain in one stat lowers another (Second Age atrophy; no stat locks in this era; never below 10). No one
  sells stats any more.
- **Creation:** 80 stat points, each 10–60; up to three skills worth 100, at most 50 each; Stealth and Remove Trap cannot be chosen.
  80/10–60 follows UOSA's examples; the exact late-1999 figure is **not independently verified**. Eight editable starting ideas, no classes.
- **Trainers:** each profession teaches its own skills up to 30.0 at 1 gold per 0.1 (reconstruction of the classic offer; a smaller
  purse buys a shorter lesson). Mapping from the UOSA trainer table onto Shardfall's people (deviations: the innkeeper teaches the
  bardic skills, the bowyer also teaches Carpentry and Lumberjacking, the camp fence Mags is the thieves' guildmaster). Old saves keep any
  free lessons they had; new characters start with none.
- **Migration (save v8):** see "Migration" below.

## The 49 skills

State: **live** = real mechanics in this build. Road: how the skill trains from the trainer's 30.0 to 100.0 in this build (proved for every
skill by `tests/skills-mech.test.js` — `SF.SK.routes` lists the windows, `roadTo100` finds no gap, a simulated walk reaches 100.0).

| Skill | State | Mechanics in this build | Road to 100.0 | Deviations / notes |
|---|---|---|---|---|
| Alchemy | live | Potions at a still; success, failure loss and quality as before; new lesser/greater/deadly poison and greater healing | deadly poison (diff 100) teaches to 136 | — |
| Anatomy | live | +0–20% weapon damage, bandage healing; active study of a target | every hit [0,100]; study [0,100] | — |
| Animal Lore | live | Study: health, STR/DEX (exact from 76), armor, diet, tamable level, pet mood; 20% of control; Veterinary | study [0,110] | — |
| Item Identification | live | Names hidden magic (ruin…vanquishing, accuracy, defense), maker, poison, fair price | [0,100] | magic loot is new content |
| Arms Lore | live | Condition, quality, damage or protection words; exact numbers from 76; poison charges | [0,100] | no combat bonus (none in T2A) |
| Parrying | live | Shield block chance skill/2 % | every parry roll (chance never 100%) | Braced Guard (custom) is an extension, **off** |
| Begging | live | Coins from what a townsperson carries, once per 10 min each | [0,100] | no karma system yet |
| Blacksmithy | live | Smithing and metal repair (repair difficulty from wear, RunUO) | plate/dragon and rare metals to 136 | — |
| Bowcraft & Fletching | live | Bows, crossbows (new), heavy crossbows (new), arrows, bolts (new); bows are wood-primary | heavy crossbow (92) and rare woods | — |
| Peacemaking | live | Area song: every creature in range (8 + skill/15 classic tiles ×1.5 m) stops fighting for 6 + skill/10 s; an attack breaks it | ±25 around the hardest creature present; [0,100] on an empty field | duration and range scale: **Shardfall choice** |
| Camping | live | Kindling (cut from a tree with a blade, or bought) → campfire on the fire-pit tile = cooking station for 2 min; 30 s beside it secures the camp; a bedroll makes camp (saves; you wake there) | [0,100] | logout protection adapted to a local save; no travel |
| Carpentry | live | Shields, crook (new), repairs of wooden gear | wooden shield in rare woods to 136 | — |
| Cartography | live | Local/city/sea/world maps (mapmaker's pen, blank maps); treasure maps 1–5 decode to a map pin; a Mining dig raises a locked, trapped chest with guardians, gold, magic gear | treasure map level 5 [70,130] | map grades have no reading use yet (trade goods) |
| Cooking | live | Meat, fish, fish stew, marsh pie, Saltmarsh feast (new) | feast (88) to 124 | — |
| Detecting Hidden | live | Range skill/10 (+1); opposed rolls vs hidden creatures, snares, chest traps | [0,100] | creature hiding = its `hide` or diff × 0.8: **Shardfall choice** |
| Enticement | live | A creature leaves what it was doing and walks to the bard, then lingers | ±25 around the creature | duration 20 s: **Shardfall choice**. Not Discordance (later era) |
| Evaluating Intelligence | live | Spell damage scaling (as before); active read of a mind (exact from 76) | damage spells and reads [0,100] | — |
| Healing | live | First Aid as before (15 s self, 5 s other, cure 60/60, res 80/80) | every treatment [0,120] (a sure heal still teaches) | was capped near 90 before |
| Fishing | live | Rod, water tiers | fish [0,100] | no special fishing treasure yet |
| Forensic Evaluation | live | A body: what it was, how long dead, who killed it (from 50); a forced chest or box: when, and who (from 40) | [0,100] | RunUO starts at 30–40; [0,100] keeps the road open from 0. Only the player picks locks so far |
| Herding | live | Crook, an animal, a spot: it walks there | ±25 around the animal (dire wolf, bear, snapper reach 100) | works on hostile animals too |
| Hiding | live | 0–100 check, 10 s delay; **no free steps** — moving reveals you unless you use Stealth; attacking, casting, most skills reveal | [0,100] | — |
| Provocation | live | Choose the first creature, then the second; both must be in range; success: they fight for 30 s; failure: both turn on you | ±25 around the harder one | duration: **Shardfall choice** |
| Inscription | live | One recipe per Magery spell (64): spell in your book, blank scroll, its reagents, its mana each attempt; circle sets the odds | circle VIII (diff 95) to 131 | difficulty curve: **Shardfall choice** |
| Lockpicking | live | Dungeon chests (window lock − 10 … + 40), tinker's lockboxes (lock = maker's skill, relockable) | lockboxes and tier III chests | — |
| Magery | live | Casting as before (spells.json success, reagents, mana, targeting) | circle windows (avg ±20): circle VIII to 120 | — |
| Resisting Spells | live | Halves resistible spell damage; taught by every resistible spell that reaches you, up to its circle's ceiling (RunUO) | circles VII–VIII (ceiling 120/130) | creature spells: the ash wisp's fire (IV) and the Lich Lord's bolt (VI); other creature attacks stay physical |
| Tactics | live | Damage ×(0.5 + Tactics/100) as before | every hit [0,100] | — |
| Snooping | live | Look into a pack (unhides you); the pack panel steals chosen items | [0,100] | being noticed is not a crime (as in T2A) |
| Musicianship | live | Every bardic song is a Musicianship check first; Play a tune | [0,120] | — |
| Poisoning | live | Four strengths onto a bladed/piercing weapon (18/16/14/12 charges) or food; the potion is used either way | deadly [80,120] | NPCs do not eat; poisoned food is a trap for yourself or for trade |
| Archery | live | As before | hit chance vs a defender of 50+ | — |
| Spirit Speak | live | For 60 + skill s you understand the dead: Wren's ghost, graveyard whispers at night | [0,100] | no self-healing (later era) |
| Stealing | live | Random item (target the person) or a chosen item (from a snooped pack); weight windows ×10 −22.5/+27.5, at most 10 weight units; noticed with chance (150 − skill)/150 | items up to 10 weight | criminal flag for 2 min and a `CrimeCommitted` event; guards warn but do not pursue (law: Living World phase 5) |
| Tailoring | live | Cloth, leather, studded, bone; bandages | bone chest / rare hides | — |
| Animal Taming | live | Creature minimums (UOSA where creatures match: boar 35, dire wolf 83.1; others placed between), window to +25, anger on failure, loyalty and feeding, going wild | dire wolf (83.1) and mud snapper (77.1) | single roll after 4 s; creatures hold still while tamed; at most 5 tamed pets — **Shardfall deviation** (no cap in T2A) |
| Taste Identification | live | Poison in food and potions, by strength | [0,100] | — |
| Tinkering | live | Lockpicks, repair kits, snare kits, lockbox, trapped box, pens, sextant, spyglass, clockwork (new) | clockwork (95) to 131 | — |
| Tracking | live | Choose animals, monsters or people, then one: an arrow follows until the trail goes cold (range (10 + skill/10) classic tiles × 2.5 m) | [0,100] | world-scale factor: **Shardfall choice** |
| Veterinary | live | Bandages heal a pet by Vet + Lore; cure poison at 60/60 (real) | [0,120] | no pet resurrection (not in late 1999) |
| Swordsmanship | live | As before; hatchet, battle axe, halberd, knife are swords; war axe is a mace | hit chance vs a defender of 50+ | no Lumberjacking damage bonus (later era) |
| Mace Fighting | live | As before (stamina drain, armor wear) | as above | — |
| Fencing | live | As before | as above | — |
| Wrestling | live | As before | as above | — |
| Lumberjacking | live | Logs; rare woods from their gates | pine [0,100]; rare woods gate ±40 | renamed from Woodcutting |
| Mining | live | Ore, smelting, coloured ores; digging treasure | iron [0,100]; coloured ores gate ±40 | — |
| Meditation | live | Passive 1 mana/7 s … 1 mana/s by INT, Meditation and armor; trance doubles it (max 2/s); metal armor (interference ≥ .10) or anything in hand blocks the trance; the check follows how empty you are | gains between 90 − skill and 120 − skill % mana (UOSA) | — |
| Stealth | live | Hidden, 80 real Hiding: steps = skill/10; window −20 + 2 AR … 80 + 2 AR; more than 18 AR cannot move hidden; failure reveals | 10–16 AR carries it to 100 | — |
| Remove Trap | live | 50 real Lockpicking and Detecting Hidden; snares, chest traps (power 40/70; Detecting Hidden finds them), trapped practice boxes (power = maker's Tinkering, re-armable) | traps up to power 100 | failure sets the trap off 30% of the time: **Shardfall choice** |

Removed as skills, kept as activities: **Skinning** (carving a body takes any blade and no skill; hides, meat, sinew and bone unchanged)
and **Foraging** (picking reagents takes no skill; patch grades still yield more).

## Migration (save v7 → v8)

`SF.SK.migrateSkills` runs once (`t2aMig`), after the combat (v3) and equipment (v7) migrations, with a pre-migration copy kept in
`localStorage['shardfall.save.v1.pret2a']`:
- the 19 renamed skills move in integer tenths with their locks (Spellcraft → Magery, Spell Focus → Evaluating Intelligence, Wardcraft →
  Resisting Spells, Venomcraft → Poisoning, Concealment → Hiding, Shadowstep → Stealth, Search → Detecting Hidden, Pickpocketing →
  Stealing, Lockwork → Lockpicking, Trapcraft → Remove Trap, Taming → Animal Taming, Beast Handling → Animal Lore, Lullaby → Peacemaking,
  Discord → Enticement, Woodcutting → Lumberjacking, Smithing → Blacksmithy, Fletching → Bowcraft & Fletching, Engineering → Tinkering,
  Appraisal → Item Identification);
- Skinning and Foraging points (and any collision's lower value) go to the existing recoverable skill pool, placed 1.0 at a time on the
  Skills page — never past 100.0 or 700.0; nothing is created or lost (`sum after + pool = sum before`, tested);
- gain history, Lower ranking, hotbar actions (lullaby → peace, discord → entice, pick → steal, coat → poison, search → detect) and the
  companion's skills follow; the permanent recipe taper record is dropped;
- equipment, items (including the old venom vial, now the regular poison potion), stats, gold, quests and the world are untouched.
Tested with a real save written by the v0.28.1 build (`tests/skills-smoke/run.py`) and with the v0.16 save chain (`tests/combat-smoke`).

## Tests

- `node tests/skills.test.js Shardfall_v0.30.0.html` — registry, migration (`skills.test.js`), checks/gains/stats/creation/trainers and
  GM recipes (`skills-gain.test.js`), per-skill rules, every skill's road to 100.0 and a simulated walk (`skills-mech.test.js`).
- `python3 tests/skills-smoke/run.py Shardfall_v0.30.0.html [chrome] [Shardfall_v0.28.1.html]` — creation, the Skills page, trainers,
  natural stat gain, a real v0.28.1 save migrating, and 30 in-game scenarios (`scenarios.js`), one per reworked or added skill.
- Every earlier node and browser suite still passes (fixtures adjusted only where the 80-point creation stats matter, plus two flaky
  checks made deterministic; see the commits).

## Not finished / honest gaps

- Formulas marked **Shardfall choice** above are tuning, not verified history.
- Law: stealing and failed snooping make you gray and say so; guards do not chase you yet (Living World phase 5).
- No karma or fame, so Begging and thieving cost no reputation.
- Taming is one roll after 4 s rather than the classic several rounds; owner counts (harder retames) are not modeled.
- Map grades (local/city/sea/world) are trade goods only; there is no map-reading use.
- Fishing has no special treasure catches.
- Unidentified magic items show their plain name until identified (no "magic kryss" label).
- Only two creature attacks are spells; creatures do not yet cast from the Magery book at you.
- Single-player: player-versus-player parts of skills (detecting stealthers, snooping other players) wait for multiplayer; the rules
  functions take any actor and an rng, so a server can run them.
