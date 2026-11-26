# Shardfall • The Eight Circles

64 classic Magery spell roles for the browser game. The original words are reference data. Use the Shardfall chant over the caster. All formula symbols and historical qualifications are defined below.

## Casting

M is Spellcraft on a 0–100 scale. Each spell consumes one of every listed reagent and its circle’s mana cost. Cast from a scroll to skip the reagents and use a two-circle easier skill check. Prepare with free hands, hold for up to 3 seconds, then release at a valid target. The next cast can begin 0.35 seconds after release.

## Resistance

For a standard damaging hit, the greater of R/5 and R − ((M−20)/5 + 5 × circle) is the percent chance to resist, clamped to 0–100%. R is the recipient’s Wardcraft. A resist halves the base roll. Multiply by 1 + (Spell Focus−R)/200 when Focus is lower than R, or by 1 + (Spell Focus−R)/500 otherwise. Round down once. At equal skills of 100, a 30-point Circle VI hit becomes 15 on a resist, with a 54% resist chance.

## Timing a burst

Release Delayed Explosion at 0.00 s. Its seal bursts at 2.00 s. If you begin Aether Bolt after the 0.35 s recovery, the bolt releases at 2.10 s and hits at 3.10 s. Two successful casts cost 40 mana altogether. Inflict Harm instead deals damage the instant you release it.

## Stats and wards

A = floor(Spellcraft/10). A caster with 85.0 Spellcraft changes each listed stat by 8. Strongest boon and strongest hex apply per attribute. A larger mana or HP ceiling gives room to recover. Mirror Ward consumes one targeted hostile spell. Rebounding Armor answers a melee hit. Mindburst bypasses both.

## Fields and summons

Dispel Field cuts a single segment, so a mage can open a route through a wall without clearing the whole bridge. Banish Summon targets one conjured creature. Summons consume control slots even when they cannot be commanded, and their owner is accountable for their attacks.

## Historical scope

The 1998 playguide supplies the spell identities, spoken words and reagents. UO Second Age reconstructions supply selected timing and formula evidence. Each card identifies numerical tuning where evidence is incomplete. Shardfall retains its own control limits, poison ticks, pet slots and travel rules.

## Circle I

### magery.01 · Stumble (Clumsy)

4 MP · 0.50 s preparation · 0.00 s release-to-effect · minimum Spellcraft 1.1.
Classic words: Uus Jux. Shardfall chant: Rise Snare.
Target: Living target. Range: 9 m. Reagents (one each): Blood Moss, Nightshade.
Effect: −DEX by A.
A boot catches on a spectral cord. Lower the victim's stamina ceiling for the hex duration. Sprint pressure matters most against an already tired runner.
A = floor(Spellcraft/10). Duration = (20 + floor(M)) × (1 − 0.005 × Wardcraft) seconds.
Wardcraft shortens the effect. Mirror eligible.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Clumsy)

### magery.02 · Conjure Rations (Create Food)

4 MP · 0.50 s preparation · 0.00 s release-to-effect · minimum Spellcraft 1.1.
Classic words: In Mani Ylem. Shardfall chant: Shape Blood Stone.
Target: Self. Range: 0 m. Reagents (one each): Garlic, Ginseng, Mandrake Root.
Effect: 1 ration.
A warm travel loaf, smoked fish or wheel of soft cheese appears in the pack with equal odds. Each feeds one normal hunger unit. A full pack leaves the cast held until space becomes available.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Create_Food)

### magery.03 · Cloud Mind (Feeblemind)

4 MP · 0.50 s preparation · 0.00 s release-to-effect · minimum Spellcraft 1.1.
Classic words: Rel Wis. Shardfall chant: Turn Mind.
Target: Living target. Range: 9 m. Reagents (one each): Nightshade, Ginseng.
Effect: −INT by A.
A crack of violet light crosses the brow. Recalculate the mana cap immediately. Mana lost to the lower cap stays spent when the hex expires.
A = floor(Spellcraft/10). Duration = (20 + floor(M)) × (1 − 0.005 × Wardcraft) seconds.
Wardcraft shortens the effect. Mirror eligible.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Feeblemin)

### magery.04 · Lesser Mend (Heal)

4 MP · 0.50 s preparation · 0.00 s release-to-effect · minimum Spellcraft 1.1.
Classic words: In Mani. Shardfall chant: Shape Blood.
Target: Living target or self. Range: 9 m. Reagents (one each): Garlic, Ginseng, Spider Silk.
Effect: floor(M/10) + 1d6 HP.
Close a shallow wound with a flash in the caster's palm. At grandmaster skill this restores 11–16 HP. Healing can land through poison, but the next poison tick still occurs.

No standard spell-resistance roll. Bypasses Mirror Ward.
Historical reconstruction for the healing formula. Target HP caps constrain the number actually healed.
References: [Classic behavior](https://wiki.uosecondage.com/Heal) · [Archived Heal formula and era variations](https://forums.uosecondage.com/viewtopic.php?p=99107)

### magery.05 · Arcane Arrow (Magic Arrow)

4 MP · 0.50 s preparation · 1.00 s release-to-effect · minimum Spellcraft 1.1.
Classic words: In Por Ylem. Shardfall chant: Shape Pass Stone.
Target: Living target. Range: 9 m. Reagents (one each): Black Pearl, Nightshade.
Effect: 1d4 HP • 1–4 base.
An ember leaves the fingertips as a thin, bright arrow. Its one-second travel window makes it useful for timing pressure against an enemy cast or drawing out a mirror ward.

Resist can halve the hit. Spell Focus and Wardcraft then modify it. Mirror eligible.
Classic spell behavior. The base dice are a Shardfall reconstruction. The archived measurements below cover several of these spells.
References: [Classic behavior](https://wiki.uosecondage.com/Magic_Arrow) · [Stratics resistance equations and Test Center measurements, preserved by UOSA](https://wiki.uosecondage.com/Resisting_Spells) · [UOSA impact timing by spell](https://forums.uosecondage.com/viewtopic.php?p=27571)

### magery.06 · Night Sight (Night Sight)

4 MP · 0.50 s preparation · 0.00 s release-to-effect · minimum Spellcraft 1.1.
Classic words: In Lor. Shardfall chant: Shape Light.
Target: Living target or self. Range: 9 m. Reagents (one each): Spider Silk, Sulfurous Ash.
Effect: 120 + 3M seconds.
A crescent appears over the eye. Lift the darkness overlay for this character alone. Night Sight reveals terrain and visible creatures. Hidden actors still require detection.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Nightsight)

### magery.07 · Rebounding Armor (Reactive Armor)

4 MP · 0.50 s preparation · 0.00 s release-to-effect · minimum Spellcraft 1.1.
Classic words: Flam Sanct. Shardfall chant: Flame Ward.
Target: Self. Range: 0 m. Reagents (one each): Garlic, Spider Silk, Sulfurous Ash.
Effect: Pool of 5 + floor(M/5) HP.
A bronze shell catches incoming melee blows. On each landed melee hit absorb up to the remaining pool or the incoming physical damage, whichever is smaller. Return one fifth of the absorbed amount, rounded down, to the attacker. Spells and arrows bypass the shell.
Expires after 120 s or when the pool empties. A 10-point absorbed blow returns 2 HP of damage.
No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Reactive_Armour)

### magery.08 · Sap Strength (Weaken)

4 MP · 0.50 s preparation · 0.00 s release-to-effect · minimum Spellcraft 1.1.
Classic words: Des Mani. Shardfall chant: Fade Blood.
Target: Living target. Range: 9 m. Reagents (one each): Garlic, Nightshade.
Effect: −STR by A.
The victim's weapon arm sags. Recalculate carrying capacity and max HP immediately. A suddenly overweight victim can still walk. The lower HP cap cannot directly kill a living target.
A = floor(Spellcraft/10). Duration = (20 + floor(M)) × (1 − 0.005 × Wardcraft) seconds.
Wardcraft shortens the effect. Mirror eligible.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Weaken)

## Circle II

### magery.09 · Fleet Agility (Agility)

6 MP · 0.75 s preparation · 0.00 s release-to-effect · minimum Spellcraft 6.1.
Classic words: Ex Uus. Shardfall chant: Free Rise.
Target: Living target or self. Range: 9 m. Reagents (one each): Blood Moss, Mandrake Root.
Effect: +DEX by A.
Wing marks climb the ankles. Raise the stamina ceiling. A runner with an empty stamina bar still needs time to recover stamina.
A = floor(Spellcraft/10). Duration = 20 + floor(M) seconds.
No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Agility)

### magery.10 · Fox Cunning (Cunning)

6 MP · 0.75 s preparation · 0.00 s release-to-effect · minimum Spellcraft 6.1.
Classic words: Uus Wis. Shardfall chant: Rise Mind.
Target: Living target or self. Range: 9 m. Reagents (one each): Nightshade, Mandrake Root.
Effect: +INT by A.
A fox sigil glimmers behind the eyes. Increase maximum mana and provide room to regenerate. Casting and removing the boon cannot manufacture mana.
A = floor(Spellcraft/10). Duration = 20 + floor(M) seconds.
No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Cunning)

### magery.11 · Cure Venom (Cure)

6 MP · 0.75 s preparation · 0.00 s release-to-effect · minimum Spellcraft 6.1.
Classic words: An Nox. Shardfall chant: Break Venom.
Target: Living target or self. Range: 9 m. Reagents (one each): Garlic, Ginseng.
Effect: 1 poison status • success check.
A green drop turns clear. Roll clamp(0.05,1.00,0.70 + M/200 − 0.20 × (tier−1)). Success removes the entire active poison and its pending ticks. Failure leaves its tick schedule intact.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Cure)

### magery.12 · Inflict Harm (Harm)

6 MP · 0.75 s preparation · 0.00 s release-to-effect · minimum Spellcraft 6.1.
Classic words: An Mani. Shardfall chant: Break Blood.
Target: Living target. Range: 9 m. Reagents (one each): Nightshade, Spider Silk.
Effect: 2d4 HP • 2–8 base.
Three spectral cuts open at release. With zero impact delay this can interrupt a Greater Mend that has already started. The damage roll is the same at every permitted distance.

Resist can halve the hit. Spell Focus and Wardcraft then modify it. Mirror eligible.
Classic spell behavior. The base dice are a Shardfall reconstruction. The archived measurements below cover several of these spells.
References: [Classic behavior](https://wiki.uosecondage.com/Harm) · [Stratics resistance equations and Test Center measurements, preserved by UOSA](https://wiki.uosecondage.com/Resisting_Spells) · [UOSA impact timing by spell](https://forums.uosecondage.com/viewtopic.php?p=27571)

### magery.13 · Rune Trap (Magic Trap)

6 MP · 0.75 s preparation · 0.00 s release-to-effect · minimum Spellcraft 6.1.
Classic words: In Jux. Shardfall chant: Shape Snare.
Target: Accessible container or trappable door. Range: 9 m. Reagents (one each): Garlic, Spider Silk, Sulfurous Ash.
Effect: 2d4 HP on trigger • 2–8 base.
Burn a single spark into a latch. The next successful open releases it, consumes the charge and resolves damage against the opener. A trapped pouch can break the owner's paralysis. A remote activation springs it at the latch.

Resist can halve the hit. Spell Focus and Wardcraft then modify it. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Magic_Trap) · [UOSA Patch 117 · door triggers and resistible second-circle traps](https://forums.uosecondage.com/viewtopic.php?t=11217)

### magery.14 · Unravel Trap (Magic Untrap)

6 MP · 0.75 s preparation · 0.00 s release-to-effect · minimum Spellcraft 6.1.
Classic words: An Jux. Shardfall chant: Break Snare.
Target: Accessible container or trappable door. Range: 9 m. Reagents (one each): Blood Moss, Sulfurous Ash.
Effect: Remove 1 rune trap.
Pull the spark from a latch without triggering it. The container stays closed and its lock state persists. Mechanical seals and ordinary lockpicks have their own rules.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Magic_Untrap)

### magery.15 · Ward of Protection (Protection)

6 MP · 0.75 s preparation · 0.00 s release-to-effect · minimum Spellcraft 6.1.
Classic words: Uus Sanct. Shardfall chant: Rise Ward.
Target: Living target or self. Range: 9 m. Reagents (one each): Garlic, Ginseng, Sulfurous Ash.
Effect: +floor(M/5) armor rating.
A shield of light overlays the target's mail. Add the bonus to the existing physical armor calculation for the boon duration. The spell adds no equipment mass or meditation penalty.
Duration = 20 + floor(M) seconds. Repeated wards use the same armor-bonus channel.
No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Protection)

### magery.16 · Giant Strength (Strength)

6 MP · 0.75 s preparation · 0.00 s release-to-effect · minimum Spellcraft 6.1.
Classic words: Uus Mani. Shardfall chant: Rise Blood.
Target: Living target or self. Range: 9 m. Reagents (one each): Mandrake Root, Nightshade.
Effect: +STR by A.
A fist-shaped mark grants strength, carrying capacity and a larger health ceiling. Existing wounds remain. Recalculate current encumbrance when the boon ends.
A = floor(Spellcraft/10). Duration = 20 + floor(M) seconds.
No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Strength_%28Spell%29)

## Circle III

### magery.17 · Threefold Blessing (Bless)

9 MP · 1.00 s preparation · 0.00 s release-to-effect · minimum Spellcraft 16.1.
Classic words: Rel Sanct. Shardfall chant: Turn Ward.
Target: Living target or self. Range: 9 m. Reagents (one each): Mandrake Root, Garlic.
Effect: +A to STR, DEX and INT.
Three lights settle on the shoulders and brow. Apply the three stat channels independently so an existing strength buff cannot be counted twice.
A = floor(Spellcraft/10). Duration = 20 + floor(M) seconds.
No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Bless)

### magery.18 · Cinderball (Fireball)

9 MP · 1.00 s preparation · 1.00 s release-to-effect · minimum Spellcraft 16.1.
Classic words: Vas Flam. Shardfall chant: Deep Flame.
Target: Living target. Range: 9 m. Reagents (one each): Black Pearl, Sulfurous Ash.
Effect: floor(M/8) + 1d6 HP.
A round ember travels from hand to target. At M=40 it deals 6–11 base, at M=100 it deals 13–18. The impact happens one second after release even at close range.

Resist can halve the hit. Spell Focus and Wardcraft then modify it. Mirror eligible.
Era-shard Fireball formula. At 100 Spellcraft the base range is 13–18. The archived Test Center sample below used a different test build.
References: [Classic behavior](https://wiki.uosecondage.com/Fireball) · [Stratics resistance equations and Test Center measurements, preserved by UOSA](https://wiki.uosecondage.com/Resisting_Spells) · [UOSA administrator · Fireball scaling](https://forums.uosecondage.com/viewtopic.php?t=803) · [UOSA impact timing by spell](https://forums.uosecondage.com/viewtopic.php?p=27571)

### magery.19 · Arcane Lock (Magic Lock)

9 MP · 1.00 s preparation · 0.00 s release-to-effect · minimum Spellcraft 16.1.
Classic words: An Por. Shardfall chant: Break Pass.
Target: Owned lockable container. Range: 9 m. Reagents (one each): Blood Moss, Garlic, Sulfurous Ash.
Effect: Lock difficulty = floor(M).
Trace a seal across an unlocked box. Record its opening difficulty and its prior lock state. The owner can use the matching key where one exists. A successful Open Seal or Lockwork check also opens it.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Magic_Lock)

### magery.20 · Inflict Poison (Poison)

9 MP · 1.00 s preparation · 0.00 s release-to-effect · minimum Spellcraft 16.1.
Classic words: In Nox. Shardfall chant: Shape Venom.
Target: Living target. Range: 9 m. Reagents (one each): Nightshade.
Effect: 2, 3 or 4 HP per tick × 4.
A fang mark blooms green. Use tier 1 at M below 55, tier 2 at 55–79.9, tier 3 at 80+. First tick at 2 s. Cure can remove it before any damage lands.
Four ticks at 2, 4, 6 and 8 s deal 8, 12 or 16 HP total if uncured. A successful resistance roll reduces the incoming tier by one.
A resist reduces the incoming poison tier by one. Mirror eligible.
Shardfall three-tier poison. The UOSA reconstruction uses percentage damage and documents regular-to-greater spell poison.
References: [Classic behavior](https://wiki.uosecondage.com/Poison) · [UOSA poison damage timing and percentage model](https://forums.uosecondage.com/viewtopic.php?t=9282) · [UOSA spell poison tiers, Patch 117](https://forums.uosecondage.com/viewtopic.php?t=11217)

### magery.21 · Far Hand (Telekinesis)

9 MP · 1.00 s preparation · 0.00 s release-to-effect · minimum Spellcraft 16.1.
Classic words: Ort Por Ylem. Shardfall chant: Spark Pass Stone.
Target: Visible usable object. Range: 9 m. Reagents (one each): Blood Moss, Mandrake Root.
Effect: 1 remote activation.
A translucent hand pulls a lever, touches a chest latch or opens an unlocked door. Dispatch one normal use at the object's position. Remote opening springs a trap but cannot collect inventory from a distance.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Telekinesis)

### magery.22 · Blink Step (Teleport)

9 MP · 1.00 s preparation · 0.00 s release-to-effect · minimum Spellcraft 16.1.
Classic words: Rel Por. Shardfall chant: Turn Pass.
Target: Visible ground. Range: 9 m. Reagents (one each): Blood Moss, Mandrake Root.
Effect: Up to 9 m.
The caster folds into a thin slit of light and appears on the selected tile. Permit short crossings of open water to visible legal ground. Occupied cells, sealed interiors and blocked sightlines reject release.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Teleport)

### magery.23 · Open Seal (Unlock)

9 MP · 1.00 s preparation · 0.00 s release-to-effect · minimum Spellcraft 16.1.
Classic words: Ex Por. Shardfall chant: Free Pass.
Target: Accessible locked container. Range: 9 m. Reagents (one each): Blood Moss, Sulfurous Ash.
Effect: 1 lock check.
Undo a magical lock when M ≥ stored difficulty. A level-one treasure chest requires M ≥ 40, a level-two chest M ≥ 70. A successful unlock leaves any trap armed. Keys and house permissions remain authoritative.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Unlock)

### magery.24 · Wall of Stone (Wall of Stone)

9 MP · 1.00 s preparation · 0.00 s release-to-effect · minimum Spellcraft 16.1.
Classic words: In Sanct Ylem. Shardfall chant: Shape Ward Stone.
Target: Visible ground. Range: 9 m. Reagents (one each): Blood Moss, Garlic.
Effect: 3 segments × 1 tile • 10 s.
Three stone blocks rise perpendicular to the cast direction. They block walking, ordinary projectiles and sight. Dispel Field can open a single segment while the rest keeps holding the passage.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Wall_of_Stone)

## Circle IV

### magery.25 · Circle of Cure (Arch Cure)

11 MP · 1.25 s preparation · 0.00 s release-to-effect · minimum Spellcraft 26.1.
Classic words: Vas An Nox. Shardfall chant: Deep Break Venom.
Target: Ground or living anchor. Range: 9 m. Reagents (one each): Garlic, Ginseng, Mandrake Root.
Effect: Cure in a 2-tile radius.
The antidote ring checks each living recipient once. Use the Cure Venom success probability with a +0.20 bonus before the cap. A nearby ally can be cured even if another ally resists treatment or is already healthy.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Arch_Cure)

### magery.26 · Circle of Protection (Arch Protection)

11 MP · 1.25 s preparation · 0.00 s release-to-effect · minimum Spellcraft 26.1.
Classic words: Vas Uus Sanct. Shardfall chant: Deep Rise Ward.
Target: Ground or living anchor. Range: 9 m. Reagents (one each): Garlic, Ginseng, Mandrake Root, Sulfurous Ash.
Effect: +floor(M/5) armor in 3 tiles.
Linked shields appear around everyone inside the pulse. Apply Ward of Protection at the caster's strength to each affected actor. Overlapping pulses refresh the same armor effect.
Duration = 20 + floor(M) seconds. Repeated wards use the same armor-bonus channel.
No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Arch_Protection)

### magery.27 · Threefold Curse (Curse)

11 MP · 1.25 s preparation · 0.00 s release-to-effect · minimum Spellcraft 26.1.
Classic words: Des Sanct. Shardfall chant: Fade Ward.
Target: Living target. Range: 9 m. Reagents (one each): Garlic, Nightshade, Sulfurous Ash.
Effect: −A to STR, DEX and INT.
A claw closes around three points of light. Reduce the three attributes together and update their derived ceilings. A stronger existing hex on a single stat keeps its magnitude.
A = floor(Spellcraft/10). Duration = (20 + floor(M)) × (1 − 0.005 × Wardcraft) seconds.
Wardcraft shortens the effect. Mirror eligible.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Curse)

### magery.28 · Wall of Flame (Fire Field)

11 MP · 1.25 s preparation · 0.00 s release-to-effect · minimum Spellcraft 26.1.
Classic words: In Flam Grav. Shardfall chant: Shape Flame Tide.
Target: Visible ground. Range: 9 m. Reagents (one each): Black Pearl, Spider Silk, Sulfurous Ash.
Effect: 4 segments • 2 HP per pulse.
A waist-high line of flame cuts across the path. A creature entering or staying on a burning segment takes one pulse per second at most from this cast. Duration is 4 + floor(M/4) seconds. A resist halves a pulse.

Resist can halve the HP damage. Spell Focus adds no multiplier. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Fire_Field)

### magery.29 · Greater Mend (Greater Heal)

11 MP · 1.25 s preparation · 0.00 s release-to-effect · minimum Spellcraft 26.1.
Classic words: In Vas Mani. Shardfall chant: Shape Deep Blood.
Target: Living target or self. Range: 9 m. Reagents (one each): Garlic, Ginseng, Mandrake Root, Spider Silk.
Effect: floor(0.4M) + 1d10 HP.
The caster gathers light in both hands before releasing it into one patient. Restores 41–50 HP at grandmaster skill. A quick Inflict Harm during preparation can deny this large heal.

No standard spell-resistance roll. Bypasses Mirror Ward.
Historical reconstruction for the healing formula. Target HP caps constrain the number actually healed.
References: [Classic behavior](https://wiki.uosecondage.com/Greater_Heal) · [Greater Heal formula](https://forums.uosecondage.com/viewtopic.php?t=4600)

### magery.30 · Forked Lightning (Lightning)

11 MP · 1.25 s preparation · 1.00 s release-to-effect · minimum Spellcraft 26.1.
Classic words: Por Ort Grav. Shardfall chant: Pass Spark Tide.
Target: Living target. Range: 9 m. Reagents (one each): Black Pearl, Mandrake Root, Sulfurous Ash.
Effect: 3d8 HP • 3–24 base.
A white fork outlines the target, then strikes from above one second after release. It hits one creature. The branches are a visual cue and do not jump to adjacent actors.

Resist can halve the hit. Spell Focus and Wardcraft then modify it. Mirror eligible.
Classic spell behavior. The base dice are a Shardfall reconstruction. The archived measurements below cover several of these spells.
References: [Classic behavior](https://wiki.uosecondage.com/Lightning) · [Stratics resistance equations and Test Center measurements, preserved by UOSA](https://wiki.uosecondage.com/Resisting_Spells) · [UOSA impact timing by spell](https://forums.uosecondage.com/viewtopic.php?p=27571)

### magery.31 · Drain Mana (Mana Drain)

11 MP · 1.25 s preparation · 0.00 s release-to-effect · minimum Spellcraft 26.1.
Classic words: Ort Rel. Shardfall chant: Spark Turn.
Target: Living target. Range: 9 m. Reagents (one each): Black Pearl, Mandrake Root, Spider Silk.
Effect: Remove up to floor(M/2) MP.
An inverted chalice spills violet sparks. A successful resist negates the drain. Otherwise remove the lesser of current mana and the drain amount. The caster receives none of the removed mana.
A successful resistance roll negates the mana effect. No HP damage.
A resist negates the effect. Mirror eligible.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Mana_Drain)

### magery.32 · Rune Recall (Recall)

11 MP · 1.25 s preparation · 0.00 s release-to-effect · minimum Spellcraft 26.1.
Classic words: Kal Ort Por. Shardfall chant: Call Spark Pass.
Target: Owned marked rune. Range: 0 m. Reagents (one each): Black Pearl, Blood Moss, Mandrake Root.
Effect: Move caster to bound coordinates.
The rune pulls its bearer to its saved location. Check the origin, destination, encumbrance and 25 s PvP travel lock on release. The rune stays in the pack and can be used again.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Recall)

## Circle V

### magery.33 · Spirit Blades (Blade Spirits)

14 MP · 7.50 s preparation · 0.00 s release-to-effect · minimum Spellcraft 36.1.
Classic words: In Jux Hur Ylem. Shardfall chant: Shape Snare Wind Stone.
Target: Visible ground. Range: 9 m. Reagents (one each): Black Pearl, Mandrake Root, Nightshade.
Effect: 6–12 melee HP per landed hit.
Three blades orbit an unseen core. They hunt high-Tactics fighters in reach, including allies or the caster. The summoner is responsible for their attacks. Scatter, leave their reach or banish them.
65 HP · 2 control slots · banish difficulty 65. Melee deals 6–12 every 1.8 s on a landed hit. Expires after 90 seconds.
No standard spell-resistance roll. Bypasses Mirror Ward.
The summon and its control type come from the classic book. Creature HP, attacks, slots, duration and targeting tie-breakers are Shardfall tuning.
References: [Classic behavior](https://wiki.uosecondage.com/Blade_Spirits)

### magery.34 · Dispel Field (Dispel Field)

14 MP · 1.50 s preparation · 0.00 s release-to-effect · minimum Spellcraft 36.1.
Classic words: An Grav. Shardfall chant: Break Tide.
Target: Field segment or gate mouth. Range: 9 m. Reagents (one each): Black Pearl, Garlic, Spider Silk, Sulfurous Ash.
Effect: Remove 1 segment or 1 entrance.
Touch a single tile of a magical wall or field to open a gap. Targeting a conjured gate closes that entrance to new arrivals. The surviving mouth can still deliver travelers to the legal endpoint until expiry.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Dispel_Field)

### magery.35 · Veiled Identity (Incognito)

14 MP · 1.50 s preparation · 0.00 s release-to-effect · minimum Spellcraft 36.1.
Classic words: Kal In Ex. Shardfall chant: Call Shape Free.
Target: Self. Range: 0 m. Reagents (one each): Blood Moss, Garlic, Nightshade.
Effect: 60 + floor(M) seconds.
Borrow a temporary local name, face and hair color. This changes the public appearance. Guild relation, criminal flags, ownership and murder attribution continue to use the underlying character.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Incognito)

### magery.36 · Mirror Ward (Magic Reflection)

14 MP · 1.50 s preparation · 0.00 s release-to-effect · minimum Spellcraft 36.1.
Classic words: In Jux Sanct. Shardfall chant: Shape Snare Ward.
Target: Self. Range: 0 m. Reagents (one each): Garlic, Mandrake Root, Spider Silk.
Effect: Reflect 1 eligible targeted spell.
A glass shield turns the next eligible hostile spell onto its caster. Check when the incoming spell is released. Even a cheap Arcane Arrow spends the charge. A second mirror cannot bounce it back again. Lasts until used, dispelled by an applicable rule, or death.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Magic_Reflection)

### magery.37 · Mindburst (Mind Blast)

14 MP · 1.50 s preparation · 1.00 s release-to-effect · minimum Spellcraft 36.1.
Classic words: Por Corp Wis. Shardfall chant: Pass Shade Mind.
Target: Living target. Range: 9 m. Reagents (one each): Black Pearl, Mandrake Root, Nightshade, Sulfurous Ash.
Effect: floor(abs(INT difference)/4) HP.
Compare both effective Intellect scores at release. The less intelligent actor takes the blast, even when that is the caster. Equal scores produce zero. A resist halves damage. Mirror Ward remains charged.

Resist can halve the HP damage. Spell Focus adds no multiplier. Bypasses Mirror Ward.
UOSA reconstruction gives one quarter of the Intellect difference against the less intelligent actor. The target-selection rule also appears in the 1998 Prima guide.
References: [Classic behavior](https://wiki.uosecondage.com/Mind_Blast) · [UOSA historian · T2A Mind Blast formula and resist](https://forums.uosecondage.com/viewtopic.php?p=374456) · [UOSA impact timing by spell](https://forums.uosecondage.com/viewtopic.php?p=27571)

### magery.38 · Paralyzing Bind (Paralyze)

14 MP · 1.50 s preparation · 0.00 s release-to-effect · minimum Spellcraft 36.1.
Classic words: An Ex Por. Shardfall chant: Break Free Pass.
Target: Living target. Range: 9 m. Reagents (one each): Garlic, Mandrake Root, Spider Silk.
Effect: Root for up to 2 s PvP.
Teal bands pin the feet. A landed damage event breaks the bind, including a triggered pouch. Rooted players may still use items or cast. Duration and immunity follow the control rules.
Player duration = 2 × (1 − 0.003 × Wardcraft) seconds, 1.4 s at 100 Wardcraft. Ordinary creature duration = (4 + 0.08M) × the same multiplier. Breaking free starts 6 s of control immunity.
Wardcraft shortens the effect. Mirror eligible.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Paralyze)

### magery.39 · Wall of Venom (Poison Field)

14 MP · 1.50 s preparation · 0.00 s release-to-effect · minimum Spellcraft 36.1.
Classic words: In Nox Grav. Shardfall chant: Shape Venom Tide.
Target: Visible ground. Range: 9 m. Reagents (one each): Black Pearl, Nightshade, Spider Silk.
Effect: 4 segments • same poison as Inflict Poison.
Four plumes mark dangerous ground for 3 + floor(0.4M) seconds. Apply the caster's poison tier on contact. Walking along the wall cannot stack poison or restart its first tick.
Four ticks at 2, 4, 6 and 8 s deal 8, 12 or 16 HP total if uncured. A successful resistance roll reduces the incoming tier by one.
A resist reduces the incoming poison tier by one. Bypasses Mirror Ward.
Shardfall three-tier poison. The UOSA reconstruction uses percentage damage and documents regular-to-greater spell poison.
References: [Classic behavior](https://wiki.uosecondage.com/Poison_Field) · [UOSA poison damage timing and percentage model](https://forums.uosecondage.com/viewtopic.php?t=9282) · [UOSA spell poison tiers, Patch 117](https://forums.uosecondage.com/viewtopic.php?t=11217)

### magery.40 · Call Creature (Summon Creature)

14 MP · 7.50 s preparation · 0.00 s release-to-effect · minimum Spellcraft 36.1.
Classic words: Kal Xen. Shardfall chant: Call Beast.
Target: Adjacent free ground. Range: 2 m. Reagents (one each): Blood Moss, Mandrake Root, Spider Silk.
Effect: 3–7 melee HP per landed hit.
Draw a reed boar or marsh hound with equal odds. It follows and accepts stay, follow and attack orders. Use its conjured stat block even when its visual is shared with a wild animal.
45 HP · 1 control slot · banish difficulty 40. Melee deals 3–7 every 1.8 s on a landed hit. Lasts floor(4 × M) seconds.
No standard spell-resistance roll. Bypasses Mirror Ward.
The summon and its control type come from the classic book. Creature HP, attacks, slots, duration and targeting tie-breakers are Shardfall tuning.
References: [Classic behavior](https://wiki.uosecondage.com/Summon_Creature)

## Circle VI

### magery.41 · Banish Summon (Dispel)

20 MP · 1.75 s preparation · 0.00 s release-to-effect · minimum Spellcraft 51.8.
Classic words: An Ort. Shardfall chant: Break Spark.
Target: Summoned creature. Range: 9 m. Reagents (one each): Garlic, Mandrake Root, Sulfurous Ash.
Effect: 1 banishment check.
Pull a conjured creature back through its summoning ring. On success remove it and release its occupied slots in the same tick. Wild creatures and ordinary tamed pets are ineligible.
Banish chance = clamp(5%,95%,50% + (M − creature difficulty) percentage points).
Uses the summon’s banishment difficulty. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Dispel)

### magery.42 · Aether Bolt (Energy Bolt)

20 MP · 1.75 s preparation · 1.00 s release-to-effect · minimum Spellcraft 51.8.
Classic words: Corp Por. Shardfall chant: Shade Pass.
Target: Living target. Range: 9 m. Reagents (one each): Black Pearl, Nightshade.
Effect: 5–42 base HP.
A narrow lance of teal light follows the marked target and lands one second after release. It costs the same as Delayed Explosion but has a shorter fuse. Each impact rolls its own damage and resistance.

Resist can halve the hit. Spell Focus and Wardcraft then modify it. Mirror eligible.
UOSA reports 5–42 base. Shardfall rolls 5d8 + 1d3 − 1 to reproduce those endpoints. The original live probability distribution is unverified.
References: [Classic behavior](https://wiki.uosecondage.com/Energy_Bolt) · [Stratics resistance equations and Test Center measurements, preserved by UOSA](https://wiki.uosecondage.com/Resisting_Spells) · [UOSA administrator · Energy Bolt endpoints and uncertainty over roll distribution](https://forums.uosecondage.com/viewtopic.php?p=99403) · [UOSA impact timing by spell](https://forums.uosecondage.com/viewtopic.php?p=27571)

### magery.43 · Delayed Explosion (Explosion)

20 MP · 1.75 s preparation · 2.00 s release-to-effect · minimum Spellcraft 51.8.
Classic words: Vas Ort Flam. Shardfall chant: Deep Spark Flame.
Target: Living target. Range: 9 m. Reagents (one each): Black Pearl, Mandrake Root, Sulfurous Ash.
Effect: 5–42 base HP after 2 s.
A visible star tightens around one target, then bursts two seconds after release. Nearby creatures take no splash. The caster can already be preparing Aether Bolt when the seal goes off.

Resist can halve the hit. Spell Focus and Wardcraft then modify it. Mirror eligible.
Two-second fuse and a single recipient follow the classic spell. Shardfall uses the same 5–42 base range and dice as Aether Bolt. Compare the period observations below.
References: [Classic behavior](https://wiki.uosecondage.com/Explosion) · [Stratics resistance equations and Test Center measurements, preserved by UOSA](https://wiki.uosecondage.com/Resisting_Spells) · [UOSA administrator · Energy Bolt endpoints and uncertainty over roll distribution](https://forums.uosecondage.com/viewtopic.php?p=99403) · [UOSA impact timing by spell](https://forums.uosecondage.com/viewtopic.php?p=27571)

### magery.44 · Veil of Invisibility (Invisibility)

20 MP · 1.75 s preparation · 0.00 s release-to-effect · minimum Spellcraft 51.8.
Classic words: An Lor Xen. Shardfall chant: Break Light Beast.
Target: Living target or self. Range: 9 m. Reagents (one each): Blood Moss, Nightshade.
Effect: floor(1.2M) seconds.
The target fades from view. Movement, attack, casting, item use, incoming positive damage or a successful Reveal ends the veil. Committed hostile projectiles still resolve.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Invisibility)

### magery.45 · Mark Rune (Mark)

20 MP · 1.75 s preparation · 0.00 s release-to-effect · minimum Spellcraft 51.8.
Classic words: Kal Por Ylem. Shardfall chant: Call Pass Stone.
Target: Owned blank or marked rune. Range: 0 m. Reagents (one each): Black Pearl, Blood Moss, Mandrake Root.
Effect: Bind or overwrite 1 location.
Score the current map, coordinates and elevation into the stone. The owner confirms overwriting an existing mark. Preview the region name before accepting. Reject private or travel-forbidden cells.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Mark)

### magery.46 · Mass Malison (Mass Curse)

20 MP · 1.75 s preparation · 0.00 s release-to-effect · minimum Spellcraft 51.8.
Classic words: Vas Des Sanct. Shardfall chant: Deep Fade Ward.
Target: Ground or living anchor. Range: 9 m. Reagents (one each): Garlic, Mandrake Root, Nightshade, Sulfurous Ash.
Effect: −A to all three stats in 2 tiles.
A ring of skull marks flashes around the anchor. Apply Threefold Curse separately to each eligible victim in the radius. Each victim has its own duration and aggression record.
A = floor(Spellcraft/10). Duration = (20 + floor(M)) × (1 − 0.005 × Wardcraft) seconds.
Wardcraft shortens the effect. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Mass_Curse)

### magery.47 · Wall of Paralysis (Paralyze Field)

20 MP · 1.75 s preparation · 0.00 s release-to-effect · minimum Spellcraft 51.8.
Classic words: In Ex Grav. Shardfall chant: Shape Free Tide.
Target: Visible ground. Range: 9 m. Reagents (one each): Black Pearl, Ginseng, Spider Silk.
Effect: 4 segments • root on contact.
Linked loops occupy the path for 3 + floor(M/3) seconds. Each actor is rooted once per entry, subject to control immunity. Standing on a segment after the bind ends cannot immediately reapply it.
Player duration = 2 × (1 − 0.003 × Wardcraft) seconds, 1.4 s at 100 Wardcraft. Ordinary creature duration = (4 + 0.08M) × the same multiplier. Breaking free starts 6 s of control immunity.
Wardcraft shortens the effect. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Paralyze_Field)

### magery.48 · Unveil (Reveal)

20 MP · 1.75 s preparation · 0.00 s release-to-effect · minimum Spellcraft 51.8.
Classic words: Wis Quas. Shardfall chant: Mind Veil.
Target: Ground or living anchor. Range: 9 m. Reagents (one each): Blood Moss, Sulfurous Ash.
Effect: Sweep a 3-tile radius.
A pale eye opens above the target point. Magical invisibility ends automatically. For ordinary hiding, roll clamp(.05,.95,.5 + (M + Search − Concealment − Shadowstep)/200) per hidden actor.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Reveal)

## Circle VII

### magery.49 · Chain Lightning (Chain Lightning)

40 MP · 2.00 s preparation · 1.00 s release-to-effect · minimum Spellcraft 66.1.
Classic words: Vas Ort Grav. Shardfall chant: Deep Spark Tide.
Target: Ground or living anchor. Range: 9 m. Reagents (one each): Black Pearl, Blood Moss, Mandrake Root, Sulfurous Ash.
Effect: 6d8 HP shared • 6–48 base.
Lightning connects creatures within two tiles of the anchor. Roll one pool and split it among eligible bodies before individual resistance. Each body is struck once, regardless of the branching animation.

Resist can halve the hit. Spell Focus and Wardcraft then modify it. Bypasses Mirror Ward.
Classic spell behavior. The base dice are a Shardfall reconstruction. The archived measurements below cover several of these spells.
References: [Classic behavior](https://wiki.uosecondage.com/Chain_Lightning) · [UOSA impact timing by spell](https://forums.uosecondage.com/viewtopic.php?p=27571)

### magery.50 · Wall of Aether (Energy Field)

40 MP · 2.00 s preparation · 0.00 s release-to-effect · minimum Spellcraft 66.1.
Classic words: In Sanct Grav. Shardfall chant: Shape Ward Tide.
Target: Visible ground. Range: 9 m. Reagents (one each): Black Pearl, Mandrake Root, Spider Silk, Sulfurous Ash.
Effect: 5 segments • 2 + floor(0.28M) s.
A tall, luminous grille bars movement. Characters can see and aim through it, creating a different choke from Wall of Stone. Dispel Field tears out one segment.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Energy_Field)

### magery.51 · Flame Pillar (Flamestrike)

40 MP · 2.00 s preparation · 1.00 s release-to-effect · minimum Spellcraft 66.1.
Classic words: Kal Vas Flam. Shardfall chant: Call Deep Flame.
Target: Living target. Range: 9 m. Reagents (one each): Spider Silk, Sulfurous Ash.
Effect: 6d8 + 2 HP • 8–50 base.
A bright ring appears beneath one victim before a column of fire rises. The pillar lands one second after release. Its footprint is a warning for that victim and does not define a splash radius.

Resist can halve the hit. Spell Focus and Wardcraft then modify it. Bypasses Mirror Ward.
Classic spell behavior. The base dice are a Shardfall reconstruction. The archived measurements below cover several of these spells.
References: [Classic behavior](https://wiki.uosecondage.com/Flamestrike) · [Stratics resistance equations and Test Center measurements, preserved by UOSA](https://wiki.uosecondage.com/Resisting_Spells) · [UOSA impact timing by spell](https://forums.uosecondage.com/viewtopic.php?p=27571)

### magery.52 · Rune Gate (Gate Travel)

40 MP · 2.00 s preparation · 0.00 s release-to-effect · minimum Spellcraft 66.1.
Classic words: Vas Rel Por. Shardfall chant: Deep Turn Pass.
Target: Owned marked rune. Range: 0 m. Reagents (one each): Black Pearl, Mandrake Root, Sulfurous Ash.
Effect: Two public gate mouths • 30 s.
Link the caster's location to the rune's coordinates. A deliberate step into either mouth transfers the traveler to the other endpoint. Eligibility is checked separately for every traveler, including followers.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Gate_Travel)

### magery.53 · Mana Siphon (Mana Vampire)

40 MP · 2.00 s preparation · 0.00 s release-to-effect · minimum Spellcraft 66.1.
Classic words: Ort Sanct. Shardfall chant: Spark Ward.
Target: Living target. Range: 9 m. Reagents (one each): Black Pearl, Blood Moss, Mandrake Root, Spider Silk.
Effect: Transfer up to floor(M) MP.
Draw mana through a thin thread. A resist negates the transfer. Otherwise move the smallest of the target's current mana, the caster's empty capacity and the spell amount. A mirror reverses the direction.
A successful resistance roll negates the mana effect. No HP damage.
A resist negates the effect. Mirror eligible.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Mana_Vampire)

### magery.54 · Mass Banishment (Mass Dispel)

40 MP · 2.00 s preparation · 0.00 s release-to-effect · minimum Spellcraft 66.1.
Classic words: Vas An Ort. Shardfall chant: Deep Break Spark.
Target: Ground or living anchor. Range: 9 m. Reagents (one each): Black Pearl, Garlic, Mandrake Root, Sulfurous Ash.
Effect: Banish summons in a 3-tile radius.
A widening ripple tears at every summoned creature in range. Roll each creature's banishment check separately with a +0.10 chance bonus. A resistant daemon can survive a pulse that removes a weaker animal.
Banish chance = clamp(5%,95%,50% + (M − creature difficulty) percentage points + 10 percentage points).
Uses the summon’s banishment difficulty. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Mass_Dispel)

### magery.55 · Meteor Shower (Meteor Swarm)

40 MP · 2.00 s preparation · 1.00 s release-to-effect · minimum Spellcraft 66.1.
Classic words: Flam Kal Des Ylem. Shardfall chant: Flame Call Fade Stone.
Target: Ground or living anchor. Range: 9 m. Reagents (one each): Blood Moss, Spider Silk, Mandrake Root, Sulfurous Ash.
Effect: 6d8 HP shared • 6–48 base.
Several flaming stones rain into a two-tile radius. Roll once for the entire cast. Two victims split the pool, making the spell strongest against an isolated target. Visual meteors never multiply one victim's damage.

Resist can halve the hit. Spell Focus and Wardcraft then modify it. Bypasses Mirror Ward.
Classic spell behavior. The base dice are a Shardfall reconstruction. The archived measurements below cover several of these spells.
References: [Classic behavior](https://wiki.uosecondage.com/Meteor_Swarm) · [UOSA impact timing by spell](https://forums.uosecondage.com/viewtopic.php?p=27571)

### magery.56 · Borrowed Form (Polymorph)

40 MP · 2.00 s preparation · 0.00 s release-to-effect · minimum Spellcraft 66.1.
Classic words: Vas Ylem Rel. Shardfall chant: Deep Stone Turn.
Target: Self. Range: 0 m. Reagents (one each): Blood Moss, Mandrake Root, Spider Silk.
Effect: 60 + floor(M) seconds.
Choose marsh hound, reed boar or dock rat. Change sprite, portrait and voice cues. Equipment, collision footprint, combat stats and existing notoriety remain those of the caster. Recast to choose a new shape.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Polymorph)

## Circle VIII

### magery.57 · Earthshaker (Earthquake)

50 MP · 2.25 s preparation · 1.00 s release-to-effect · minimum Spellcraft 80.1.
Classic words: In Vas Por. Shardfall chant: Shape Deep Pass.
Target: Self-centered radius. Range: 0 m. Reagents (one each): Blood Moss, Ginseng, Mandrake Root, Sulfurous Ash.
Effect: floor(current HP / 2) per victim.
The floor cracks outward to eight tiles. Each victim loses half of its own current HP, rounded down. A 90 HP target loses 45 and a 1 HP target loses zero. Escaping line of effect before impact avoids the wave.

No standard spell-resistance roll. Bypasses Mirror Ward.
UOSA describes an eight-tile wave for half a target’s health. Shardfall uses current HP, floors fractions and checks line of effect.
References: [Classic behavior](https://wiki.uosecondage.com/Earthquake) · [UOSA impact timing by spell](https://forums.uosecondage.com/viewtopic.php?p=27571)

### magery.58 · Aether Vortex (Energy Vortex)

50 MP · 8.25 s preparation · 0.00 s release-to-effect · minimum Spellcraft 80.1.
Classic words: Vas Corp Por. Shardfall chant: Deep Shade Pass.
Target: Visible ground. Range: 9 m. Reagents (one each): Black Pearl, Blood Moss, Mandrake Root, Nightshade.
Effect: 10–18 melee HP per landed hit.
A teal vortex seeks the most intelligent nearby creature. Its landed strikes can poison. It can turn on its summoner. Its attacks continue until it expires, is defeated or is banished.
90 HP · 2 control slots · banish difficulty 85. Melee deals 10–18 every 1.6 s on a landed hit. Expires after 90 seconds. Each landed melee strike has a 25% chance to apply tier-two poison.
No standard spell-resistance roll. Bypasses Mirror Ward.
The summon and its control type come from the classic book. Creature HP, attacks, slots, duration and targeting tie-breakers are Shardfall tuning.
References: [Classic behavior](https://wiki.uosecondage.com/Energy_Vortex)

### magery.59 · Restore Life (Resurrection)

50 MP · 2.25 s preparation · 0.00 s release-to-effect · minimum Spellcraft 80.1.
Classic words: An Corp. Shardfall chant: Break Shade.
Target: Player ghost within 2 m. Range: 2 m. Reagents (one each): Blood Moss, Garlic, Ginseng.
Effect: Revive at 25% HP, stamina and mana.
Offer the ghost a return to life. Acceptance within ten seconds rechecks ghost state, range and jurisdiction. Restore resources only once. The equipment and gold on the corpse stay where they fell.

No standard spell-resistance roll. Bypasses Mirror Ward.
Classic spell role and 1998 reagent recipe. Detailed status, duration, targeting and world-interaction choices are Shardfall settings unless a source is specified.
References: [Classic behavior](https://wiki.uosecondage.com/Resurrection)

### magery.60 · Call Air Elemental (Summon Air Elemental)

50 MP · 8.25 s preparation · 0.00 s release-to-effect · minimum Spellcraft 80.1.
Classic words: Kal Vas Xen Hur. Shardfall chant: Call Deep Beast Wind.
Target: Adjacent free ground. Range: 2 m. Reagents (one each): Blood Moss, Mandrake Root, Spider Silk.
Effect: 4–8 melee or 7–12 ranged HP.
An airborne face of spray and wind circles its target. It favors ranged gusts while enemies are out of reach and claws in melee when cornered.
70 HP · 2 control slots · banish difficulty 70. Melee deals 4–8 every 1.6 s on a landed hit. Ranged deals 7–12 up to 7 tiles away, every 3 s. Lasts floor(4 × M) seconds.
No standard spell-resistance roll. Bypasses Mirror Ward.
The summon and its control type come from the classic book. Creature HP, attacks, slots, duration and targeting tie-breakers are Shardfall tuning.
References: [Classic behavior](https://wiki.uosecondage.com/Summon_Air_Elemental)

### magery.61 · Call Abyssal Daemon (Summon Daemon)

50 MP · 8.25 s preparation · 0.00 s release-to-effect · minimum Spellcraft 80.1.
Classic words: Kal Vas Xen Corp. Shardfall chant: Call Deep Beast Shade.
Target: Adjacent free ground. Range: 2 m. Reagents (one each): Blood Moss, Mandrake Root, Spider Silk, Sulfurous Ash.
Effect: 10–17 melee or 9–15 ranged HP.
A horned silhouette steps out of the ring. It is the hardest ordinary summon to banish and combines heavy melee with a slower ranged attack. It occupies the owner's full control allowance.
140 HP · 2 control slots · banish difficulty 95. Melee deals 10–17 every 2.2 s on a landed hit. Ranged deals 9–15 up to 6 tiles away, every 4 s. Lasts floor(4 × M) seconds.
No standard spell-resistance roll. Bypasses Mirror Ward.
The summon and its control type come from the classic book. Creature HP, attacks, slots, duration and targeting tie-breakers are Shardfall tuning.
References: [Classic behavior](https://wiki.uosecondage.com/Summon_Daemon)

### magery.62 · Call Earth Elemental (Summon Earth Elemental)

50 MP · 8.25 s preparation · 0.00 s release-to-effect · minimum Spellcraft 80.1.
Classic words: Kal Vas Xen Ylem. Shardfall chant: Call Deep Beast Stone.
Target: Adjacent free ground. Range: 2 m. Reagents (one each): Blood Moss, Mandrake Root, Spider Silk.
Effect: 10–16 melee HP per landed hit.
A stone guardian advances on foot. High health and a slow crushing swing make it useful in a narrow passage. Mobile foes can stay outside its melee reach.
160 HP · 2 control slots · banish difficulty 75. Melee deals 10–16 every 2.4 s on a landed hit. Lasts floor(4 × M) seconds.
No standard spell-resistance roll. Bypasses Mirror Ward.
The summon and its control type come from the classic book. Creature HP, attacks, slots, duration and targeting tie-breakers are Shardfall tuning.
References: [Classic behavior](https://wiki.uosecondage.com/Summon_Earth_Elemental)

### magery.63 · Call Fire Elemental (Summon Fire Elemental)

50 MP · 8.25 s preparation · 0.00 s release-to-effect · minimum Spellcraft 80.1.
Classic words: Kal Vas Xen Flam. Shardfall chant: Call Deep Beast Flame.
Target: Adjacent free ground. Range: 2 m. Reagents (one each): Blood Moss, Mandrake Root, Spider Silk, Sulfurous Ash.
Effect: 6–10 melee or 10–16 ranged HP.
A walking flame reaches past the front line with fire bolts. Close enemies can force it to use its lighter melee strike instead.
85 HP · 2 control slots · banish difficulty 80. Melee deals 6–10 every 1.8 s on a landed hit. Ranged deals 10–16 up to 7 tiles away, every 3.2 s. Lasts floor(4 × M) seconds.
No standard spell-resistance roll. Bypasses Mirror Ward.
The summon and its control type come from the classic book. Creature HP, attacks, slots, duration and targeting tie-breakers are Shardfall tuning.
References: [Classic behavior](https://wiki.uosecondage.com/Summon_Fire_Elemental)

### magery.64 · Call Water Elemental (Summon Water Elemental)

50 MP · 8.25 s preparation · 0.00 s release-to-effect · minimum Spellcraft 80.1.
Classic words: Kal Vas Xen An Flam. Shardfall chant: Call Deep Beast Break Flame.
Target: Adjacent free ground. Range: 2 m. Reagents (one each): Blood Moss, Mandrake Root, Spider Silk.
Effect: 7–11 melee or 7–12 ranged HP.
A cresting figure can fight at the bank or throw a jet of water across a channel. Its balanced ranged and melee attacks are independent of the caster's Spell Focus.
105 HP · 2 control slots · banish difficulty 75. Melee deals 7–11 every 1.9 s on a landed hit. Ranged deals 7–12 up to 6 tiles away, every 3 s. Lasts floor(4 × M) seconds.
No standard spell-resistance roll. Bypasses Mirror Ward.
The summon and its control type come from the classic book. Creature HP, attacks, slots, duration and targeting tie-breakers are Shardfall tuning.
References: [Classic behavior](https://wiki.uosecondage.com/Summon_Water_Elemental)

## Measured historical damage

Historic Stratics Test Center observations at 100 Magery, 100 Evaluating Intelligence against 100 Resisting Spells. Fifteen casts per spell; values include resisted hits and predate finalized resistance changes. These are observed results, not theoretical endpoints or balancing requirements.

| UO spell | Observed min | Observed max | Mean |
|---|---:|---:|---:|
| Fireball | 6 | 17 | 9.1 |
| Lightning | 1 | 21 | 10.4 |
| Explosion | 7 | 42 | 25.5 |
| Energy Bolt | 10 | 42 | 21.2 |
| Flamestrike | 12 | 49 | 29.2 |

## Sources

- [1998 Origin playguide, chapter 9 · roster, words and reagent recipes](https://www.mocagh.org/origin/uosecondage-alt-manual.pdf)
- [UO Second Age spell index and individual behavior notes](https://wiki.uosecondage.com/Category:Spells)
- [UO Second Age cast timing comparison · baseline and summoning delay](https://forums.uosecondage.com/viewtopic.php?t=5302)
- [UO Second Age Magery · cast thresholds and scrolls](https://wiki.uosecondage.com/Magery)
- [Stratics resistance equations and Test Center measurements, preserved by UOSA](https://wiki.uosecondage.com/Resisting_Spells)
- [UOSA administrator · Fireball scaling](https://forums.uosecondage.com/viewtopic.php?t=803)
- [UOSA administrator · Energy Bolt endpoints and uncertainty over roll distribution](https://forums.uosecondage.com/viewtopic.php?p=99403)
- [UOSA historian · T2A Mind Blast formula and resist](https://forums.uosecondage.com/viewtopic.php?p=374456)
- [Archived Heal formula and era variations](https://forums.uosecondage.com/viewtopic.php?p=99107)
- [Greater Heal formula](https://forums.uosecondage.com/viewtopic.php?t=4600)
- [UOSA impact timing by spell](https://forums.uosecondage.com/viewtopic.php?p=27571)
- [UOSA Patch 117 · door triggers and resistible second-circle traps](https://forums.uosecondage.com/viewtopic.php?t=11217)
- [Official Publish 13, August 2001 · later changes to damage, Harm range and reagents](https://uo.com/wiki/ultima-online-wiki/technical/previous-publishes/2001-2/2001-publish-13-19th-august/)
- [UOSA poison damage timing and percentage model](https://forums.uosecondage.com/viewtopic.php?t=9282)
- [UOSA spell poison tiers, Patch 117](https://forums.uosecondage.com/viewtopic.php?t=11217)
