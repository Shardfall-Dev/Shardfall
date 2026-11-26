<!-- Living World master roadmap. Saved verbatim from the specification supplied on 2026-11-26; the text below this note is unchanged.
This is the roadmap, not a work order: phases are built one at a time, and docs/WORLD_SIMULATION_PROGRESS.md records what is actually done.
Repository conventions that differ from the text: the docs live at docs/WORLD_SIMULATION_MASTER.md and docs/WORLD_SIMULATION_PROGRESS.md (the §32 living-world/ file names map onto these two files), and spec phases A–G are numbered 1–7 in the progress file. -->

SHARDFALL — THE LIVING WORLD EXPANSION

Master Development Specification v1.0

Repository: https://github.com/Shardfall-Dev/Shardfall

Project: Shardfall

Platform: Browser-based, mobile-first and desktop-compatible, 2.5D isometric sandbox RPG.

Development direction: Single-player now, multiplayer-ready architecture for the future.

Inspirations:

* Ultima Online T2A — combat, skills, professions, magic, criminality, full loot and freedom.
* Kenshi — autonomous inhabitants, faction relationships, roaming groups and emergent conflicts.
* Gothic — believable NPC routines, workplaces, sleeping, eating and travelling.
* Ragnarok Online — graphical atmosphere, character sprites and visual presentation.

⸻

1. PRIMARY OBJECTIVE

The current world feels too empty and static.

We have character sprites, monster sprites, animations, environmental graphics, sound effects, music, combat, crafting, spells and world-building foundations.

These systems must now be connected into a living, breathing world.

The player must NOT be the centre of every event.

NPCs and monsters must exist independently, travel, fight, gather resources, trade, sleep, hunt, flee, defend themselves, investigate disturbances, react to danger and interact with other inhabitants.

If the player stands still for 30 minutes, meaningful activity should continue around them.

If the player enters a forest, they might encounter:

* A pack of wolves hunting deer.
* A travelling merchant being attacked by bandits.
* An adventurer fighting skeletons.
* A wounded warrior returning to town.
* An orc patrol travelling towards its encampment.
* A hunter carrying animal hides.
* A guard escorting a merchant.
* An undead creature wandering away from a graveyard after dark.

These should be real simulation events, not merely decorative animations or random scripted scenes.

We want a sandbox that is enjoyable even without multiplayer.

⸻

2. NON-NEGOTIABLE DEVELOPMENT RULES

Before changing anything:

1. Inspect the latest GitHub repository.
2. Identify the latest playable version.
3. Read the README and existing documentation.
4. Understand the current world map, coordinate system, collision system, rendering, actor structures, combat, Magery, crafting and persistence.
5. Inventory all existing graphics, animations, sounds and music.
6. Identify what has already been implemented.
7. Reuse existing systems and assets wherever possible.

Do not overwrite completed work.

Do not recreate the map.

Do not remove existing quests.

Do not redesign the UI unnecessarily.

Do not replace the existing 64-spell Magery system.

Do not break existing character saves without providing migration.

Do not introduce Unity, Unreal Engine or another game engine.

Do not introduce a mandatory external AI service.

Do not implement multiplayer networking yet.

Keep the existing browser-based playable build and build process.

The entire simulation must be capable of working locally without an internet connection after the game assets have loaded.

Create a new development branch for this expansion.

Increment the game version appropriately after inspecting the current version.

⸻

3. UNIVERSAL ACTOR ARCHITECTURE

The current player-centric architecture must gradually become actor-centric.

Create a shared Actor structure supporting:

* Human-controlled characters.
* Civilian NPCs.
* Merchants.
* Town guards.
* Adventurers.
* Criminals.
* Murderers.
* Monsters.
* Wild animals.
* Domestic animals.
* Tamed creatures.
* Summoned creatures.

Every actor must have a stable unique identifier.

An actor may contain the following components where applicable:

* Identity and name.
* Species.
* Faction.
* Position and map level.
* Home location.
* Current destination.
* Movement state.
* Health.
* Stamina.
* Mana.
* Strength.
* Dexterity.
* Intelligence.
* Skills.
* Inventory.
* Equipment.
* Active effects.
* Combat state.
* AI controller.
* Relationships.
* Notoriety.
* Criminal records.
* Current task.
* Persistent state.

Do not force unnecessary components onto simple wildlife.

A rabbit does not need a spellbook, banking account or human criminal record.

Use common interfaces and optional components.

Controller separation

An actor receives commands from a controller.

Controller types:

* PlayerController.
* CivilianAI.
* MerchantAI.
* GuardAI.
* AdventurerAI.
* CriminalAI.
* MonsterAI.
* AnimalAI.
* PetAI.
* SummonAI.

In the future, a NetworkController should be capable of controlling an actor using the same interfaces.

The simulation must not depend on whether an action originated from a mouse, touchscreen, NPC decision or future network message.

Shared action services

Create or adapt shared services for:

* Movement.
* Target selection.
* Melee attacks.
* Ranged attacks.
* Spellcasting.
* Damage.
* Healing.
* Bandaging.
* Resource gathering.
* Crafting.
* Item transfer.
* Equipment.
* Looting.
* Death.
* Resurrection.
* Trading.
* Criminality.

Avoid duplicating separate combat formulas for players and NPCs.

An NPC swordsman should use the same relevant weapon rules as a human-controlled swordsman.

An NPC mage should use our existing Magery spell definitions, appropriate skills, mana, reagents and casting restrictions.

Monsters may have species-specific attacks and abilities, but they must still use the common damage and combat pipeline.

⸻

4. SIMULATION ARCHITECTURE

Separate the following responsibilities:

* Game simulation.
* Rendering.
* User input.
* AI decisions.
* World data.
* Audio.
* Persistence.

Use a configurable fixed simulation timestep, initially targeting 50 milliseconds, while keeping rendering independent.

Do not tie movement speed, damage, resource regeneration or AI behaviour to the rendering frame rate.

Use simulation time rather than arbitrary browser timers for important gameplay events.

Use a seeded random number generator where reproducibility is useful.

All important gameplay actions should produce structured events.

Example event types:

* ActorSpawned.
* ActorMoved.
* ActorDamaged.
* ActorHealed.
* ActorKilled.
* CombatStarted.
* CombatEnded.
* ItemTransferred.
* ItemCrafted.
* CrimeCommitted.
* CrimeWitnessed.
* ResourceGathered.
* MerchantArrived.
* CampCleared.
* PopulationReplenished.

Events should contain relevant actor IDs, location, simulation timestamp and action details.

These events can later support multiplayer replication, debugging, reputation, quests and dynamic rumours.

Avoid recording every insignificant movement event permanently.

⸻

5. PERSISTENT WORLD CLOCK

Implement a global world clock.

Initial configurable setting:

* One in-game day equals 120 real-world minutes.
* One in-game hour equals five real-world minutes.
* A complete 24-hour cycle.
* Smooth transitions between dawn, daylight, sunset and night.

Suggested periods:

Time	Period
00:00–05:00	Deep night
05:00–07:00	Dawn
07:00–17:00	Daylight
17:00–19:00	Sunset
19:00–00:00	Night

Expose the current world time in the UI without covering the game world.

The world clock must persist through saving and loading.

Initially pause simulation when the game is closed or suspended.

Do not punish players with deaths, lost property or massive economic changes while they are offline.

Offline progression may become an optional feature in a later version.

⸻

6. DAY AND NIGHT VISUAL SYSTEM

Implement gradual ambient lighting changes.

Morning:

* Warm light.
* Increasing visibility.
* Increased civilian activity.

Daytime:

* Normal environment colours.
* Maximum general visibility.

Evening:

* Warm orange and red lighting.
* Gradual darkening.

Night:

* Dark blue atmospheric lighting.
* Reduced visibility without making the game unreadable.
* Illuminated windows.
* Street lanterns.
* Campfires.
* Torches.
* Glowing magical effects.

Add local light sources using an efficient Canvas-compatible implementation.

Light-emitting objects may include:

* Torches.
* Lanterns.
* Campfires.
* Forges.
* Candles.
* Magical objects.
* Fire spells.
* Glowing creatures.

Preserve and integrate our existing Night Sight spell.

Night Sight must meaningfully improve visibility without necessarily turning night into full daylight.

Dungeon lighting should be independent of outdoor daytime where appropriate.

Night must affect the gameplay world, not only its colour.

⸻

7. NPC LIFE SIMULATION

Important NPCs must be persistent individuals rather than anonymous decoration.

Each important NPC should have:

* Unique name.
* Profession.
* Faction.
* Home.
* Workplace.
* Daily schedule.
* Skills.
* Equipment.
* Inventory.
* Gold.
* Personality.
* Current goals.
* Relationship with other factions.
* Memory of significant recent encounters.

Do not simulate excessively detailed human needs that add no meaningful gameplay.

Start with lightweight systems for:

* Hunger.
* Fatigue.
* Safety.
* Wealth.
* Work.
* Social activity.

NPC needs should influence decisions, but the simulation must remain stable and understandable.

Example daily schedule

A blacksmith:

05:30 — Wakes up.

06:00 — Leaves home.

06:30 — Arrives at the forge.

07:00 — Begins smithing.

12:00 — Takes a break.

13:00 — Returns to the forge.

17:30 — Stops production.

18:00 — Visits the tavern or purchases supplies.

20:00 — Returns home.

22:00 — Sleeps.

Schedules are preferences, not absolute scripts.

If the town is attacked, the blacksmith should abandon the routine and seek safety.

If the blacksmith lacks iron, they should attempt to purchase it rather than producing infinite weapons from nothing.

Important NPC categories

Town civilians

Walk through streets, visit markets, enter buildings, eat, rest and communicate.

Miners

Travel to mines, gather ore, carry resources, return to town, sell ore and purchase replacement tools.

Lumberjacks

Travel to forests, gather wood, avoid dangerous predators and return to settlements.

Blacksmiths

Purchase metals, manufacture equipment, repair items and sell goods.

Carpenters

Purchase wood, manufacture furniture, weapons, shields and tools where supported.

Fishermen

Travel to suitable coastlines and rivers, fish and sell their catch.

Farmers

Work near settlements, tend crops and domestic animals.

Merchants

Travel between settlements, transport goods, buy low and sell high using controlled regional prices.

Healers

Treat injured NPCs and provide resurrection services where supported.

Tavern keepers

Serve travellers, provide food and allow taverns to become natural social gathering locations.

Stablemasters

Manage mounts and animals when the relevant systems are available.

Mages

Purchase reagents, use magic, travel, explore and defend themselves.

Adventurers

Behave similarly to simulated human players.

Criminals

Commit theft and unlawful attacks when opportunities arise, react to witnesses and avoid guards.

Murderers

Operate from wilderness hideouts and outlaw settlements, hunt vulnerable targets, loot defeated actors and retreat from dangerous encounters.

⸻

8. NPC ADVENTURERS — SIMULATED PLAYERS

This is one of the most important parts of the expansion.

Introduce NPC adventurers who behave like other players in an MMORPG.

They should have different equipment, skills, wealth and preferred activities.

Example archetypes:

* Swordsman.
* Mace fighter.
* Fencer.
* Archer.
* Mage.
* Tank mage.
* Healer.
* Animal tamer.
* Bard.
* Treasure hunter.
* Merchant.
* Craftsman.
* Thief.
* Murderer.

Map these archetypes to existing skills until the planned combat and skill rework is completed.

Do not invent a separate parallel skill system.

NPC adventurers should be capable of:

* Purchasing equipment.
* Equipping weapons and armour.
* Training skills.
* Gathering resources.
* Visiting dungeons.
* Fighting monsters.
* Using bandages.
* Drinking potions.
* Casting spells.
* Looting corpses legally or illegally.
* Banking valuables.
* Repairing equipment.
* Returning to safety.
* Travelling between cities.
* Fleeing stronger opponents.

Important NPC adventurers should have persistent identities and meaningful progression.

Do not respawn a fresh copy every time the player enters an area.

Provide configurable resurrection or replacement policies for persistent NPCs.

A defeated NPC adventurer should lose appropriate equipment under the same death and loot rules that apply to the player.

Do not allow resurrection to duplicate equipment.

⸻

9. MONSTER ECOSYSTEM

The wilderness must no longer consist exclusively of fixed enemies waiting for the player.

Create species-specific behaviour profiles.

Each species should define:

* Habitat.
* Faction.
* Preferred activity hours.
* Aggression.
* Courage.
* Intelligence.
* Movement speed.
* Detection range.
* Hearing or disturbance sensitivity.
* Territory size.
* Preferred prey.
* Natural enemies.
* Social behaviour.
* Group size.
* Hunting behaviour.
* Retreat conditions.
* Special abilities.
* Population limits.
* Respawn rules.
* Loot table.
* Animation mapping.
* Audio mapping.

Use data-driven configuration rather than hardcoding every species into a single giant AI function.

Inspect existing sprites and audio before defining the initial creature roster.

Do not create invisible or broken monsters when assets are missing.

Use explicitly documented temporary fallbacks where necessary.

⸻

10. MONSTER BEHAVIOUR PROFILES

Rats

* Small territory.
* Scavenging behaviour.
* Mostly found near docks, sewers, ruins and settlements.
* Wander around their habitat.
* Flee larger threats when appropriate.
* May attack weak targets or defend their territory.

Wolves

* Travel in packs.
* Hunt suitable prey.
* Coordinate simple group movement.
* Investigate disturbances.
* Become more active during dusk and night.
* Defend territory.
* Retreat when badly wounded where appropriate.

Bears

* Mostly solitary.
* Territorial.
* Wander through forests.
* Hunt or forage.
* Become aggressive when threatened.
* May retreat from overwhelming danger.

Deer and rabbits

* Passive wildlife.
* Graze and wander.
* Flee predators.
* Flee approaching hostile actors.
* Return to suitable habitats after danger disappears.

Boars

* Forage in forests.
* Territorial.
* May charge threats.
* Prefer suitable woodland habitats.

Skeletons

* Very limited intelligence.
* Wander through graveyards and ruins.
* Attack living creatures.
* Do not require food.
* Do not behave like frightened animals.
* Increased surface activity at night.

Zombies

* Slow movement.
* Low intelligence.
* Persistent aggression.
* Wander in groups near undead habitats.
* Detect and pursue nearby living targets.

Liches

* Intelligent undead.
* Use appropriate existing spells.
* Command or summon lesser undead where supported.
* Prioritize dangerous enemies.
* Maintain distance when appropriate.
* Defend crypts and ruins.

Orcs

* Social monsters.
* Live in camps.
* Patrol territory.
* Travel in groups.
* Defend allies.
* Attack travellers.
* Hunt wildlife.
* Return to their encampments.

Orc roles may include:

* Scout.
* Warrior.
* Archer.
* Captain.
* Shaman.

Orc shamans should use appropriate Magery abilities rather than introducing a separate incompatible magic system.

Goblins

* Smaller groups.
* Opportunistic attacks.
* Increased willingness to flee.
* Prefer ambushes and numerical superiority.
* May cooperate with compatible monster factions.

Trolls and ettins

* Territorial.
* Occupy forests, mountain passes and caves.
* Strong melee attacks.
* Usually solitary or in small groups.
* Defend nearby habitats.

Harpies

* Occupy cliffs and caverns.
* Roam within territories.
* Attack intruders.
* Defend nests.

Elementals

* Remain associated with suitable environments.
* Earth elementals near mines and caves.
* Fire elementals near volcanic or magical locations.
* Water elementals near water and appropriate dungeons.
* Use suitable elemental abilities.

Dragons and drakes

* Occupy lairs.
* Defend territories.
* Hunt suitable prey.
* Use powerful melee and ranged abilities.
* Prefer dangerous wilderness and deeper dungeons.
* Occasionally leave their lairs where appropriate.
* Rarely enter beginner areas.
* Do not spawn randomly in safe starter locations.

Bandits

Bandits are intelligent humanoid actors.

They should:

* Maintain hideouts.
* Scout roads.
* Attack vulnerable travellers.
* Fight guards.
* Steal appropriate loot.
* Return to hideouts.
* Rest and recover.
* Retreat when overwhelmed.
* Use equipment and consumables.
* Accumulate supplies within controlled limits.

Bandits should participate in the criminality system where applicable.

Bosses

Preserve our special boss presentation and shiny outlines.

Bosses should have distinct territories, attacks and rewards.

They should be rare enough to remain meaningful.

Do not convert every monster encounter into a boss fight.

⸻

11. FACTION RELATIONSHIPS

Create a configurable relationship system.

Initial factions may include:

* Citizens.
* Town guards.
* Lawful adventurers.
* Merchants.
* Criminal groups.
* Murderers.
* Orcs.
* Goblins.
* Undead.
* Predators.
* Passive wildlife.
* Dragons.
* Elementals.

Relationships should support:

* Allied.
* Friendly.
* Neutral.
* Suspicious.
* Hostile.

Not all monsters are allies.

Example relationships:

Faction A	Faction B	Relationship
Guards	Citizens	Allied
Guards	Bandits	Hostile
Orcs	Humans	Hostile
Orcs	Goblins	Friendly
Undead	Living creatures	Hostile
Wolves	Deer	Predator/prey
Bandits	Merchants	Hostile when attacking
Adventurers	Monsters	Species-dependent
Dragons	Intruders	Hostile

Faction hostility must not automatically imply a criminal offence.

Killing a lawful civilian is fundamentally different from killing a hostile skeleton.

Species relationships, individual notoriety and local law must be evaluated separately.

NPCs must be able to fight other NPCs.

Monsters must be able to fight other monsters.

The player must not be required to initiate these encounters.

⸻

12. AI DECISION ENGINE

Use lightweight utility AI combined with behavioural state machines.

No mandatory LLM integration.

No API calls for individual movement decisions.

Each AI actor should periodically evaluate available actions.

Possible states:

* Idle.
* Wander.
* Patrol.
* Travel.
* Work.
* Gather.
* Craft.
* Trade.
* Eat.
* Rest.
* Sleep.
* Socialize.
* Investigate.
* Hunt.
* Follow.
* Escort.
* Chase.
* Attack.
* Cast.
* Heal.
* Flee.
* Hide.
* Loot.
* Regroup.
* ReturnHome.
* SeekSafety.
* Dead.

Decisions should consider:

* Current health.
* Stamina.
* Mana.
* Threat level.
* Available equipment.
* Nearby enemies.
* Nearby allies.
* Distance to objectives.
* Time of day.
* Personality.
* Faction.
* Current task.
* Available supplies.
* Recent damage.
* Whether retreat is possible.

Personality variables

Suggested configurable values from 0 to 1:

* Courage.
* Aggression.
* Greed.
* Sociability.
* Loyalty.
* Caution.
* Curiosity.

Personality should create meaningful variation.

A brave adventurer may continue fighting when a cautious adventurer would retreat.

A greedy bandit may prioritize a valuable cargo.

A merchant should normally prefer escape over combat.

Decision stability

Implement action commitment, cooldowns and hysteresis.

NPCs must not switch between fighting, fleeing, healing and travelling several times per second.

Avoid oscillating movement.

Avoid actors repeatedly selecting impossible actions.

If a goal cannot be completed, the AI should select a sensible alternative.

Expose decision reasons in debug mode.

⸻

13. PERCEPTION AND AWARENESS

NPCs and monsters must not be omniscient.

Use spatial queries and existing line-of-sight checks.

Perception may include:

* Vision radius.
* Line of sight.
* Nearby sounds.
* Recent attackers.
* Nearby allies calling for help.
* Visible corpses.
* Dangerous areas.
* Known destinations.

Sleeping creatures should have reduced awareness.

Night should reduce visibility for species without appropriate night vision.

Nocturnal creatures may retain better awareness.

A hidden player should not be automatically detected by every nearby monster.

Integrate existing Hiding, Stealth, Tracking and detection mechanics.

Aggression should respond to actual perceived events rather than global knowledge.

⸻

14. PATHFINDING AND MOVEMENT

Implement reliable navigation using existing map coordinates and collision data.

Support:

* Roads.
* Buildings.
* Doors.
* Bridges.
* Forests.
* Town entrances.
* Dungeon entrances.
* Stairs.
* Different dungeon levels.
* Moongates where appropriate.
* Water restrictions.
* Species-specific movement restrictions.

Use A* or another suitable local pathfinding algorithm.

For long journeys, create a hierarchical navigation graph between:

* Cities.
* Villages.
* Road junctions.
* Mines.
* Dungeons.
* Ports.
* Camps.
* Other significant landmarks.

Long-distance travel should use regional waypoints, with local pathfinding near obstacles.

Do not calculate a complete continent-wide tile path every frame.

Cache useful paths.

Stagger pathfinding requests.

Limit expensive searches per simulation update.

Implement recovery when an actor becomes stuck.

NPCs must not walk through walls, water or locked doors.

Monsters should not follow players across the entire continent without valid reasons.

Use territory and pursuit limits appropriate to each creature.

Avoid excessive crowding around doors, merchants and narrow passages.

⸻

15. WORLD POPULATION SYSTEM

Create regional population definitions.

Regions should include:

* Major cities.
* Small villages.
* Forests.
* Mountains.
* Plains.
* Swamps.
* Coastlines.
* Graveyards.
* Orc camps.
* Bandit camps.
* Caves.
* Dungeons.

Suggested initial population budgets:

Region	Population range
Major city	25–40 NPCs
Small settlement	8–15 NPCs
Forest region	25–45 creatures
Graveyard	12–25 undead
Monster camp	10–20 monsters
Mountain region	15–30 creatures
Dungeon level	20–40 creatures
Roads	5–12 travellers or roaming creatures per suitable segment

These are provisional balancing values, not mandatory fixed numbers.

Adjust them according to actual region size, visual density and measured mobile performance.

Start with fewer populations in the first milestone.

The long-term objective is to support hundreds of actors across Anniabreen.

Spawning rules

* Spawn creatures inside appropriate habitats.
* Validate walkable positions.
* Respect existing region boundaries.
* Avoid spawning on top of actors.
* Avoid visible pop-in.
* Avoid infinite spawning.
* Avoid spawning dangerous monsters in starter locations.
* Use regional population caps.
* Keep existing unique NPCs unique.
* Preserve cleared areas for meaningful periods.
* Prevent re-entry into a region from resetting its entire population.

Spawned actors should become real simulation entities.

Do not create fake enemies that exist only while rendered.

⸻

16. MONSTER CAMPS AND TERRITORIES

Create persistent camp definitions.

Examples:

* Orc encampment.
* Bandit hideout.
* Wolf den.
* Undead graveyard.
* Goblin cave.
* Dragon lair.

A camp may contain:

* Home territory.
* Patrol routes.
* Population.
* Leadership.
* Defensive positions.
* Supplies.
* Treasure storage.
* Respawn or recovery conditions.

Orcs should leave their camp to patrol, hunt and attack nearby threats.

Bandits should travel to roads and return with stolen goods.

Wolves should travel between hunting grounds and their den.

Undead should roam around graveyards more actively at night.

When a camp is cleared:

* Record the clearance.
* Preserve the result.
* Do not instantly regenerate the camp.
* Allow gradual recovery or controlled repopulation.
* Prevent permanent extinction of essential content.

Do not attempt a scientifically accurate ecosystem.

We want believable gameplay with controlled population management.

⸻

17. DUNGEON SIMULATION

Use the newly developed Anniabreen dungeon network.

Include original Shardfall equivalents inspired by classic UO dungeon themes such as Despise, Destard, Deceit, Shame and Covetous.

Every dungeon level should have:

* Appropriate creature species.
* Population limits.
* Territories.
* Patrol routes.
* Locked chests.
* Safe or relatively quiet areas where appropriate.
* Dangerous deeper areas.
* Creature-specific loot.
* Rare encounters.

Dungeon monsters should move between rooms where suitable.

NPC adventurers should be able to enter dungeons independently.

They may:

* Explore.
* Fight monsters.
* Loot.
* Heal.
* Retreat.
* Die.
* Return to town.

Dungeon populations should not reset merely because the player leaves and returns.

Keep bosses associated with suitable chambers or territories.

Prevent off-screen adventurers from continuously removing all valuable gameplay opportunities.

Use controlled population recovery and bounded activity.

⸻

18. COMBAT BETWEEN ACTORS

Extend existing combat so any eligible actor can attack any other valid target.

Support:

* Player versus monster.
* Player versus NPC.
* NPC versus monster.
* NPC versus NPC.
* Monster versus monster.
* Guard versus criminal.
* Guard versus invading monster.
* Pet versus enemy.
* Summon versus enemy.

All relevant attacks must use shared combat resolution.

Maintain existing combat balance initially.

The upcoming dedicated UO combat rework can replace formulas later without requiring a second AI rewrite.

NPCs should support:

* Weapon attacks.
* Archery.
* Spellcasting.
* Healing.
* Bandaging.
* Potions.
* Retreat.
* Target changes.
* Group assistance.

Monsters should use their appropriate abilities.

NPCs and intelligent creatures should prioritize targets based on threat, distance, vulnerability and faction.

Prevent attacks on dead or invalid actors.

Prevent duplicated damage events.

Preserve existing player combat controls and animations.

⸻

19. CRIMINALITY AND MURDER SYSTEM

Implement a UO-inspired criminality system that works entirely in single-player.

Every eligible humanoid actor can be:

* Blue: innocent.
* Grey: criminal.
* Red: murderer.
* Green: ally or guildmate where relevant.
* Orange: legal enemy where relevant.

Display notoriety through name colours and suitable UI indicators.

Do not classify every hostile creature as a murderer.

Aggression records

Record:

* Attacker ID.
* Victim ID.
* Time.
* Region.
* Whether the attack was lawful.
* Self-defence rights.
* Expiration of aggression rights.
* Related pet or summon owner.

The system must distinguish initiating aggression from defending against it.

Criminal acts

Examples:

* Unlawful attack against an innocent person.
* Theft from an innocent person.
* Illegal corpse looting.
* Unlawful assistance to offenders where configured.
* Other prohibited actions defined by local law.

Use configurable criminal flag durations.

Initial proposed duration: 120 seconds of active simulation time.

Murder counts

Implement:

* Short-term murder counts.
* Long-term murder counts.
* Murder reporting.
* Decay based on active simulation time.
* Configurable thresholds.
* Persistent records.

Use classic UO-inspired initial defaults:

* Five active long-term murder counts make a character red.
* Short-term count decay: eight active hours.
* Long-term count decay: 40 active hours.

These are balancing targets and must be configurable for single-player testing.

NPC victims should be capable of reporting eligible murders automatically according to the defined reporting rules.

The player should have an appropriate murder-reporting interface after dying to unlawful aggression.

Do not award multiple murder counts for the same victim death.

Guarded regions

The map must identify guarded jurisdictions.

Inside a guarded region:

* Guards patrol.
* Witnesses can call for guards.
* Guards respond to valid crimes.
* Guards pursue criminals.
* Innocent actors may flee or seek assistance.
* Murderers face appropriate restrictions.
* Ordinary wildlife does not trigger inappropriate legal penalties.

Outside guarded regions:

* Guards normally do not intervene.
* Wilderness remains dangerous.
* Players can fight criminals or become criminals themselves.
* Full-loot rules apply according to configured region policies.

Preserve starter-area protection until an explicit design decision changes it.

Witnesses

Civilian witnesses should react to crimes they actually perceive.

Possible reactions:

* Call for help.
* Flee.
* Alert guards.
* Defend themselves.
* Assist allies.
* Remember the offender.

Witness behaviour should supplement deterministic notoriety rules, not make them inconsistent.

⸻

20. CORPSES, DEATH AND LOOT

Extend the existing death transaction.

When an eligible actor dies:

1. Resolve death exactly once.
2. Stop movement and combat.
3. Cancel invalid actions.
4. Create an appropriate corpse.
5. Transfer eligible items into the corpse.
6. Preserve ownership and looting rights.
7. Record killer and responsible actors.
8. Apply criminality consequences if required.
9. Begin corpse decay.
10. Update regional population state.

Use existing dead-body sprites and blood effects where available.

Use suitable corpse graphics for different species.

Human corpses should contain actual eligible inventory and equipment.

Monsters should use appropriate loot rules without generating repeated rewards through reloads or duplicate death events.

NPCs should be able to loot corpses when their AI permits it.

Lawful NPCs should respect applicable ownership rules.

Criminal NPCs may loot illegally and receive consequences.

Do not allow:

* Duplicate loot.
* Multiple death transactions.
* Infinite item regeneration.
* Repeated boss rewards from the same corpse.
* Corpse contents resetting after loading.

Handle existing blessed, protected or non-transferable item policies consistently.

⸻

21. DYNAMIC ECONOMY FOUNDATIONS

Do not build an unnecessarily complicated financial simulator in the first milestone.

However, NPC work must eventually produce real resources and items.

Example economic chain:

Miner gathers ore.

Miner sells ore to blacksmith.

Blacksmith purchases ore.

Blacksmith smelts and crafts weapons.

Merchant purchases weapons.

Merchant transports weapons to another settlement.

Adventurer purchases a weapon.

Adventurer uses the weapon against monsters.

Equipment becomes damaged, lost or destroyed.

Demand for replacement equipment increases.

Use controlled mechanisms for:

* NPC gold budgets.
* Merchant stock.
* Resource production.
* Regional price differences.
* Resource regeneration.
* Equipment durability.
* Food supplies.
* Emergency minimum stock.

Initially keep dynamic prices within sensible configurable bounds around baseline prices.

Prevent economic collapse.

Prevent unlimited NPC wealth generation.

Important items must remain available to the player.

Travelling merchants should physically travel through the world when near the player.

Their cargo should be persistent and transferable.

Do not generate a second merchant and second cargo merely because the player changes regions.

⸻

22. EMERGENT WORLD EVENTS

Create systems capable of producing unscripted encounters.

Examples:

Caravan attack

A merchant travels between cities.

A bandit patrol detects the merchant.

Bandits attack.

The merchant attempts to escape or calls for help.

Nearby guards or adventurers may intervene.

The player can intervene, ignore the battle or interact with the aftermath.

Graveyard disturbance

Night falls.

Undead activity increases.

Skeletons travel towards nearby roads.

Adventurers or guards may encounter them.

The player may join the battle.

Predator hunting

Wolves detect deer.

The pack pursues prey.

Deer attempt to escape.

Hunters may encounter the pack.

Orc patrol

A group leaves its camp.

It follows a patrol route.

It encounters hostile actors.

Survivors return to the camp or regroup.

Dungeon expedition

Two NPC adventurers purchase supplies.

They travel to a dungeon.

They enter, fight and collect loot.

One becomes injured.

They retreat towards town.

These encounters should emerge from actor decisions and world state.

Do not simply spawn a fake battle beside the player at regular intervals.

Introduce larger scripted world events only after the underlying simulation is stable.

⸻

23. SOUND AND AMBIENCE

We already have monster sound assets.

Inspect the repository and integrate all suitable existing assets.

Create an audio manager supporting:

* Music.
* Environmental ambience.
* Footsteps.
* Monster idle sounds.
* Monster detection sounds.
* Monster combat sounds.
* Monster death sounds.
* NPC activity sounds.
* Weapon impacts.
* Magic sounds.
* Building activity.
* Weather ambience where available.

Positional audio

Use distance-based attenuation.

Where supported, use stereo positioning based on the creature’s position relative to the camera.

Distant monsters should sound quieter.

Nearby monsters should sound clearer.

Dungeon walls and closed doors may reduce sound where practical.

Monster sound rules

* Idle sounds occur at randomized intervals.
* Do not play every monster sound simultaneously.
* Use appropriate attack sounds during combat.
* Play death sounds once.
* Avoid repetitive growling every few seconds.
* Do not play distant sounds at full volume.
* Avoid abrupt audio transitions when entering a region.

Environmental sound profiles

Forest:
Birds, insects, wind, wolves and wildlife.

Graveyard:
Wind, distant groans and undead sounds.

Dungeon:
Dripping water, echoes, growls and occasional combat.

Town:
Footsteps, blacksmith hammers and civilian activity.

Coast:
Waves, wind and seabirds.

Night:
Owls, insects, distant howling and reduced civilian activity.

Orc camp:
Grunts, movement, campfire and appropriate existing sounds.

Audio controls

Provide independent volume settings:

* Master.
* Music.
* Ambient.
* Combat.
* Monsters.
* Footsteps.

Reduce overly loud walking sounds.

Preserve browser audio activation requirements.

Stop or suspend appropriate audio when the browser is hidden.

Limit simultaneous sound sources.

Avoid decoding or loading the same sound repeatedly.

Maintain version numbers for modified audio assets or audio packages.

⸻

24. ANIMATION INTEGRATION

Reuse existing sprite atlases.

Create consistent animation states:

* Idle.
* Walk.
* Run.
* Attack.
* Cast.
* Hit reaction.
* Death.
* Work.
* Sleep.
* Eat.
* Gather.
* Other supported species-specific actions.

Preserve existing directional animation conventions.

NPCs and monsters should face their movement direction.

Combatants should face their current target where appropriate.

Use the correct weapon animation.

Death animations must transition correctly into corpse sprites.

Do not invent animation frames that do not exist.

If a specific animation is unavailable:

1. Use a sensible existing fallback.
2. Document the missing animation.
3. Add it to the asset backlog.

Do not block the entire simulation because one creature lacks a sleeping animation.

⸻

25. PERFORMANCE AND SIMULATION DETAIL

This is a mobile-first game.

We cannot run full animation, pathfinding and complex AI for every actor on the entire continent simultaneously.

Implement three simulation levels.

Tier A — local simulation

Actors near the player:

* Full movement.
* Collision.
* Combat.
* Spellcasting.
* Animation.
* Audio.
* Detailed perception.
* Detailed interactions.

Suggested starting radius: approximately 40 world tiles, adjusted to actual camera scale.

Tier B — regional simulation

Actors outside the immediate visible area but within nearby regions:

* Reduced AI decision frequency.
* Simplified movement.
* Coarser pathfinding.
* Simplified routine updates.
* Appropriate combat resolution.
* No unnecessary rendering.
* No audible distant sound sources.

Tier C — distant world simulation

Actors in distant regions:

* Abstract travel.
* Daily schedules.
* Population management.
* Controlled economic transactions.
* Bounded encounter resolution.
* Persistent state.

Do not animate or pathfind every distant actor.

When an actor returns to detailed simulation, reconstruct its position and state consistently.

Prevent duplicated actors, items and rewards during simulation tier transitions.

Important persistent actors must retain their identities.

Use:

* Spatial indexing.
* Chunk-based world queries.
* AI scheduling.
* Cached navigation.
* Object reuse where helpful.
* Rendering culling.
* Audio culling.
* Bounded event queues.
* Pathfinding budgets.

Avoid quadratic all-against-all actor checks.

Avoid every NPC checking every other NPC each frame.

Target smooth desktop gameplay and a stable mobile experience.

Measure performance before increasing population budgets.

⸻

26. SAVE AND LOAD SYSTEM

Extend existing persistence carefully.

Persist:

* World clock.
* Simulation time.
* Important NPC identities.
* Actor positions or travel progress.
* Health and active states.
* Skills.
* Equipment.
* Inventories.
* Gold.
* Notoriety.
* Murder counts.
* Significant aggression records.
* Regional populations.
* Cleared camps.
* Resource node states.
* Corpse contents and remaining lifetime.
* Merchant cargo.
* Significant world events.
* Relevant persistent random state.

Use stable references between actors and objects.

Do not serialize DOM elements, Canvas objects, functions or transient rendering data.

Use versioned save schemas.

Provide migration from the current save format.

Keep a backup before migration.

Do not silently delete existing characters.

Inspect browser storage limitations.

If the expanded world becomes too large for reliable localStorage persistence, evaluate IndexedDB and preserve compatibility with the current save system.

Save transactions must not duplicate or destroy valuable items.

The same save loaded twice should produce consistent initial world state.

⸻

27. DEBUG AND DEVELOPMENT TOOLS

Add a developer-only debug interface.

It should be disabled by default.

Include:

* Current game version.
* Simulation tick rate.
* FPS.
* Active actor count.
* Visible actor count.
* Regional actor count.
* Distant actor count.
* NPC count.
* Monster count.
* Current world time.
* Pathfinding queue size.
* Average AI decision time.
* Recent important world events.
* Audio source count.
* Save size.
* Last save result.

Allow inspection of individual actors.

Actor inspection should display:

* Actor ID.
* Name.
* Species.
* Faction.
* Current AI state.
* Current goal.
* Health.
* Stamina.
* Mana.
* Position.
* Destination.
* Target.
* Territory.
* Last decision reason.
* Inventory where relevant.
* Criminal status.

Developer controls:

* Set time of day.
* Advance simulation time in a controlled manner.
* Toggle day/night.
* Pause simulation.
* Spawn test actors.
* Inspect paths.
* Show territories.
* Show faction relationships.
* Show perception ranges.
* Show collision information.
* Display population counts.

Developer actions must not be accessible accidentally during normal play.

⸻

28. INITIAL IMPLEMENTATION MILESTONE

Do not attempt the entire expansion in one uncontrolled rewrite.

The first playable milestone should include:

* Two populated settlements.
* One connecting road.
* One forest.
* One graveyard.
* One hostile monster camp.
* One existing dungeon entrance.

Suggested initial population:

* 12–20 civilians.
* Four guards.
* Two travelling merchants.
* Two resource workers.
* Three NPC adventurers.
* One NPC mage.
* Three to six bandits.
* A small pack of wolves.
* Passive wildlife.
* A group of skeletons.
* An orc patrol and camp population, if appropriate assets exist.

Reuse existing sprites through original colour or equipment variations where suitable.

Demonstrate the following working scenarios:

1. A civilian leaves home and walks to work.
2. A merchant travels between settlements.
3. A miner gathers actual resources.
4. A guard patrols the town.
5. Wolves pursue wildlife.
6. Skeletons increase their activity at night.
7. An adventurer fights a monster.
8. Two hostile monster factions fight each other.
9. A wounded actor retreats.
10. A defeated creature produces loot.
11. An NPC commits a criminal act.
12. Guards respond to a valid crime.
13. World time and actor state survive saving and loading.
14. The existing player can still fight, craft and cast spells normally.

⸻

29. DEVELOPMENT SEQUENCE

Implement in the following order.

Phase A — Audit and architecture

* Inspect the repository.
* Identify existing systems.
* Create an implementation matrix.
* Introduce shared actor IDs and action interfaces.
* Preserve existing gameplay.
* Establish deterministic simulation tests.

Phase B — Clock and navigation

* Persistent world clock.
* Day/night lighting.
* Basic pathfinding.
* Navigation graph.
* Door and obstacle handling.
* Debug controls.

Phase C — Population and monster ecosystem

* Regional populations.
* Habitat definitions.
* Species profiles.
* Roaming monsters.
* Passive wildlife.
* Territories.
* Predator/prey behaviour.
* Monster faction combat.
* Existing monster audio integration.

Phase D — Living NPCs

* Persistent named NPCs.
* Homes and workplaces.
* Daily schedules.
* Merchants travelling.
* Guards patrolling.
* Resource workers.
* Basic autonomous adventurers.

Phase E — Shared combat and law

* NPC versus NPC combat.
* NPC versus monster combat.
* Monster versus monster combat.
* Actor death and looting.
* Shared spellcasting.
* Criminal flags.
* Murder counts.
* Guard responses.
* Witness reactions.

Phase F — Persistence and optimization

* Persistent world state.
* Save migration.
* Simulation tiers.
* Spatial indexing.
* Mobile performance profiling.
* Regression tests.

Phase G — Emergent gameplay

* Merchant ambushes.
* Dungeon expeditions.
* Camp patrols.
* NPC healing and recovery.
* Basic economic transactions.
* Dynamic encounters.

Complete and test each phase before expanding the next.

Keep the game playable after every version increment.

⸻

30. REQUIRED TESTING

Add automated tests where practical.

Required test areas:

Actor tests

* Unique actor IDs.
* Valid state transitions.
* Actor creation and removal.
* Valid target selection.
* Controller-independent actions.

Movement tests

* No walking through walls.
* No walking across unsupported water.
* Valid dungeon transitions.
* Stuck-path recovery.
* Long-distance navigation.

Combat tests

* Player attacks monster.
* NPC attacks monster.
* Monster attacks NPC.
* Monster attacks another monster.
* Correct damage resolution.
* Death occurs exactly once.
* Valid healing.
* Correct spell resource consumption.

Criminality tests

* Unlawful aggression creates a criminal record.
* Lawful self-defence does not create an inappropriate criminal record.
* Murder counts increase correctly.
* Duplicate murder reports are rejected.
* Criminal flags expire.
* Guards respond within their jurisdiction.
* Pet and summon responsibility is attributed correctly.

Persistence tests

* Save/load preserves world time.
* Save/load preserves actor identity.
* Merchant cargo is not duplicated.
* Corpse loot is not duplicated.
* Cleared camps do not instantly respawn.
* Actor transitions between simulation tiers do not duplicate entities.
* Existing saves migrate correctly.

Long-running simulation tests

Run accelerated, seeded simulations covering multiple in-game days.

Check for:

* Population explosion.
* Species extinction.
* Infinite loot.
* Infinite gold generation.
* NPCs permanently stuck.
* Broken schedules.
* Unbounded event logs.
* Excessive memory growth.
* Invalid actor references.
* Excessive CPU usage.

Use existing automated test infrastructure wherever possible.

Do not mark untested functionality as complete.

⸻

31. DEFINITION OF SUCCESS

The expansion is successful when:

The player enters a town and sees inhabitants moving independently.

The blacksmith is working.

The merchant is preparing for travel.

The guards are patrolling.

The town changes naturally between day and night.

The player enters a forest and finds creatures wandering through believable habitats.

Wolves hunt wildlife.

Orcs travel in patrols.

Adventurers fight monsters.

Bandits attack travellers.

Guards respond to crimes.

Corpses remain after battles.

Actors loot, recover and continue their activities.

The world does not reset merely because the player walks away.

The player’s existing combat, skills, crafting and magic continue functioning.

The simulation remains playable on mobile devices.

The game feels like a living MMORPG even though only one real human is playing.

⸻

32. GITHUB DELIVERABLES

Create or update suitable documentation, including:

* docs/living-world/MASTER_SPEC.md
* docs/living-world/IMPLEMENTATION_STATUS.md
* docs/living-world/ACTOR_ARCHITECTURE.md
* docs/living-world/AI_BEHAVIOUR.md
* docs/living-world/POPULATION_CONFIG.md
* docs/living-world/ASSET_BACKLOG.md
* docs/living-world/PERFORMANCE.md

Adapt filenames to existing repository conventions if necessary.

Maintain a clear distinction between:

* Implemented.
* Tested.
* Partially implemented.
* Planned.
* Blocked.

Update the README.

Increment the playable build version.

Provide the latest playable HTML build.

Commit source code and relevant documentation.

Use small, meaningful commits.

Do not commit duplicate copies of large assets unnecessarily.

Do not merge unfinished or broken work into the main branch.

At the end of each implementation session, report:

* Current version.
* Completed features.
* Modified files.
* Tests executed.
* Test results.
* Known bugs.
* Performance findings.
* Remaining work.
* Exact next implementation task.

⸻

33. FINAL INSTRUCTIONS

You are responsible for implementing this expansion, not merely describing it.

Inspect the actual repository and begin with the first unfinished development phase.

Use the existing project architecture wherever it remains suitable.

Do not request approval for every minor technical decision.

Make reasonable engineering decisions, document them and continue.

However, do not perform irreversible destructive changes to existing saves, assets or working systems.

Prioritize a functioning, populated world over unnecessary complexity.

Do not spend the entire development session writing documentation without implementing a playable improvement.

If the entire expansion exceeds the current context capacity, complete the current testable phase, commit the work, update IMPLEMENTATION_STATUS.md and prepare a compact continuation prompt for the next Claude conversation.

The master specification should remain in the repository so subsequent conversations do not require the entire project history.

SHARDFALL MUST BECOME A LIVING WORLD, NOT AN EMPTY MAP WITH A PLAYER CHARACTER.

Begin development.