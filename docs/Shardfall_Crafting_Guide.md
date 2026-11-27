# Shardfall • The Quay Trades
## Crafting design and implementation brief for Claude

**Build target:** the existing browser game, mobile landscape first. **Priority:** Blacksmithing, supported by Mining, Woodworking and Carpentry. **Deliverable for the implementer:** a playable progression from a character with an empty pack in Saltmarsh Quay to a named Grandmaster maker with repeat customers. All recipe costs, odds, weights and rewards below are proposed Shardfall defaults unless identified as existing or as a UO reference.

### Start here, Claude

Inspect the latest game source before editing. In the supplied standalone build, the integration points are `SF.ITEMS`, `SF.RECIPES`, `SF.RECIPE`, `SF.craft`, `startCraft/finishCraft`, `startGather/finishGather`, `nodeStock`, `TASKS.repair`, the station panel, `journalPanel`, and `save/loadSave`. Use the editable source of the current build and regenerate its standalone HTML if the project already has a build step. Extend the existing registries and inventory functions. All four trades must work from ordinary taps in the game. The implementation order and release checks are at the end.

**First playable scene.** Beside the public forge, smith Mara asks for rivets to fasten a loose mooring ring. The player borrows a pick, strikes a marked iron outcrop, returns with three ore, smelts one bar and forges eight rivets. Mara takes four. The remaining four can become hinges for a carpenter's sea chest. This introduces extraction, refining, quantity, leftover stock and another player's demand before asking the player to make a weapon. Failure is recoverable at every step. A player who buys a bar can go straight to the anvil.

## 1. What a profession owns

| Profession on screen | Existing skill key | Trains on | Things another player wants |
|---|---|---|---|
| Mining | mining | Extract ore and smelt colored ore | Named ore and ingots, prospecting information |
| Woodworking | woodcutting | Fell trees, saw logs, shape stock and prepare specialist timber | Boards, handles, staves, beams and seasoned stock |
| Carpentry | carpentry | Assemble finished wooden goods at a bench, repair wooden equipment | Bows, shields, instruments, storage, furniture, building kits and workstations |
| Blacksmithing | smithing | Smelt ordinary iron using the existing recipe, forge fittings and equipment, repair metal equipment | Fittings, weapons, shields, chain, plate, commissions and maintenance |

These are four profession journals. Keep the existing numeric skill values. Fletching owns arrows, bolts and strings. Engineering owns finished tools, lock mechanisms and repair kits. A smith can buy handles and make tool heads to sell to an engineer. A carpenter can buy boards, hinges and locks. Each quest checks only its own profession. In offline solo play, a smith pursuing the rare-metal commissions can train Mining to obtain the same ingots a multiplayer specialist buys from miners. The one-click iron-smelting recipe remains available to a novice with Smithing 0. Mining journal credit for smelting iron is an objective event, not a second skill roll.

**UO lineage.** UO supplies the nine metal names, seven wood types, hands-on gathering, colored materials, smith's tools, maker identity, repair and bulk-order idea. UO treats Lumberjacking, Carpentry and Bowcraft/Fletching as distinct skills. Shardfall folds milling into its existing Woodcutting track and keeps its existing Carpentry bows. Special woods and bulk orders draw on later UO systems, alongside Shardfall's T2A-inspired full-loot economy. The local quests, item costs, material effects and town layout below are original Shardfall design. Official references are at the end.

## 2. Materials and gates

Use **Iron as the entry metal**. Dull Copper and Copper are different resources; Shadow Iron sits between them. Golden ingots always use the material key `golden`. The game's `gold` remains currency. Bronze is a minable vein here, as in UO. Bell-bronze shards from monsters remain the existing separate item.

### Metals

Skill values below are display points out of 100. The Mining column follows UO's published discovery thresholds. The Smith column is Shardfall's threshold to work the ingot. Metal appearance applies to fittings and finished goods. Mechanical properties apply only to finished wearable equipment whose primary material is metal.

| Material ID | Display | Mine & smelt | Smith | Color cue | Original max durability multiplier | Carried/equipped item mass multiplier |
|---|---|---:|---:|---|---:|---:|
| iron | Iron | 0 | 0 | Weathered grey | 1.00 | 1.00 |
| dull_copper | Dull Copper | 65 | 40 | Matte brown | 1.15 | 1.00 |
| shadow_iron | Shadow Iron | 70 | 45 | Charcoal | 1.25 | 1.08 |
| copper | Copper | 75 | 50 | Burnished red | 1.10 | 0.90 |
| bronze | Bronze | 80 | 60 | Warm ochre | 1.30 | 1.05 |
| golden | Golden | 85 | 65 | Bright gold | 1.05 | 0.80 |
| agapite | Agapite | 90 | 75 | Dusty rose | 1.35 | 1.00 |
| verite | Verite | 95 | 85 | Green | 1.20 | 0.82 |
| valorite | Valorite | 99 | 95 | Blue steel | 1.45 | 0.95 |

Example choices matter in a full-loot game. A traveling fighter might buy Golden chain for its weight. A smith supplying a guild that returns to town infrequently might offer Agapite for a longer repair life. Valorite gives a distinctive finish and a long service life. An iron blade and a Valorite blade of the same pattern and quality use the same damage profile.

### Woods

Discovery and board-making gates follow the later UO wood ladder. The lower finished-work thresholds follow UO's distinction between harvesting a wood and using supplied stock. Common Wood is represented by the game's Pine. Heartwood, Bloodwood and Frostwood are three peers at Grandmaster gathering skill.

| Material ID | Display | Fell / mill | Finished work | Color cue | Durability multiplier | Finished mass multiplier |
|---|---|---:|---:|---|---:|---:|
| pine | Common Wood (Pine) | 0 | 0 | Pale honey | 1.00 | 1.00 |
| oak | Oak | 65 | 65 | Brown grain | 1.25 | 1.08 |
| ash | Ash | 80 | 75 | Straw-grey | 1.10 | 0.88 |
| yew | Yew | 95 | 85 | Russet | 1.30 | 0.98 |
| heartwood | Heartwood | 100 | 95 | Violet grain | 1.45 | 1.08 |
| bloodwood | Bloodwood | 100 | 95 | Oxblood red | 1.35 | 0.95 |
| frostwood | Frostwood | 100 | 95 | Icy blue | 1.15 | 0.78 |

Woodworking uses the fell/mill gate for all its same-species conversion recipes. Carpentry uses the finished-work gate. Fletching ammunition remains material-neutral and uses the common inputs listed below. Wood mass and durability apply to finished wooden equipment. Placed goods use the finish visually; a Frostwood door has the same collision and access rules as a pine one. For furniture deeds, use mass 1 kg regardless of species. Store the wood name in text as well as showing the color.

## 3. Mining and woodland play

**Interaction.** Select a rock face or tree, inspect, then use Pickaxe or Hatchet within 2 m with a clear path on the same floor. One stroke takes 2 s. Holding the gather action may repeat at that one node until release, movement, interruption, depletion, capacity or tool break. Changing selection ends the repeat. Show remaining stock as Fresh / Worked / Nearly empty, with exact stock after a successful survey. Static decorative trees have no target marker. Exhaustion changes the art to a spent seam or stump without changing collision.

**World placement.** Keep the existing regional grade minimums (0/30/55/80) and difficulties (15/45/70/85). Mark a few accessible outcrops and trees near the Quay forge and bench as permanent common training *locations*. They exhaust normally. Give the protected area at least four nodes of each kind. Reuse Pinewatch Woods, Brine Crossroads, Ashfen and the Sunken Bell where those tags exist. For new named sites below, place markers on walkable, reachable terrain in those regions. The public map can show a resource region and the last vein personally surveyed; it never publishes a live rare-node alarm.

| Region table | Typical location | Successful strokes of stock | Refill after empty | Ore specialty rolls, % per refill | Wood specialty rolls, % per refill |
|---|---|---:|---:|---|---|
| G0, protected | Quay outcrops and nursery | 8 | 2 min | Iron 100 | Pine 100 |
| G1, outskirts | Brine Roads / Pinewatch edge | 10 | 5 min | Iron 52, Dull Copper 22, Shadow Iron 14, Copper 12 | Pine 70, Oak 30 |
| G2, frontier | Ashfen cut / Pinewatch interior | 12 | 8 min | Iron 24, Dull Copper 12, Shadow Iron 12, Copper 18, Bronze 16, Golden 10, Agapite 8 | Pine 30, Oak 30, Ash 25, Yew 15 |
| G3, contested | Sunken Bell seams / Ashfen old grove | 16 | 12 min | Iron 10, Copper 10, Bronze 14, Golden 16, Agapite 22, Verite 20, Valorite 8 | Pine 8, Oak 8, Ash 14, Yew 22, Heartwood 16, Bloodwood 16, Frostwood 16 |

A node holds one rolled specialty for its whole generation. Roll once on creation or depletion/refill. Partial nodes retain stock across saves. On a valid stroke, roll the existing gather check against regional difficulty. A success yields **3 ore** or **2 logs** and takes one stock. At or above the named material gate, roll 50% to produce that specialty instead of common; use common for a common node or a gatherer below the material gate. An eligible low-skill miner can therefore work the frontier before finding colored ore. Failure yields nothing and spends one tool use, no stock. If capacity cannot fit the chosen yield, commit nothing. Preserve the existing 12% mining by-product chance for two iron shards; if only the optional side yield would overflow, omit it and state that the shards fell away. The fixed common training outcrops use the same yield.

**Survey / read the grain.** With the relevant tool, examine a fresh or worked node within 2 m for 2 s. Requires regional access. At sufficient material skill reveal its material, stock and map pin; below that gate show “unidentified seam” or “unfamiliar grain.” No cost, no skill gain for inspection, one objective credit per distinct node generation. Remove stale survey labels on refill. Training comes from committed harvest and refining. For gather skill gains use the greater of region difficulty and accessible specialty gate on specialist yields. This permits training through 99 to 100 before finding GM woods. For Mining training, work Quay iron at 0–30, rotate G1 faces at 30–55, G2 at 55–80, then G3 through GM. Smelting colored ore adds training opportunities whenever the material gate is met.

**Reliable quest specimens.** Place a named quest seam or tree for each exact wilderness material required by a journal objective. Use the specified region and normal channel, danger, eligibility and specialty chance. The commissioned specimen's specialty is fixed. Share stock with other players, renew after the normal timer, show the refill timer to a waiting quest holder. These fixtures prevent a quest from depending on a lucky sequence of world rerolls. Their specialty applies only for a holder of the active matching quest and only until that character's required harvest count is met. Other uses of that node produce common material. Store a permanent per-character allowance of qualifying specialty units for each such quest stage; abandoning cannot renew it. Excess units beyond the allowance are common. A lost specimen can be replaced through general veins, other players or a market purchase for delivery. Discovery progress persists through death.

**Refining.** At a forge, 3 homogeneous ore → 1 ingot. Common iron uses the existing Smithing recipe and difficulty 15; colored smelting uses Mining, its material gate and difficulty equal to that gate. At a sawbench or portable saw, 1 log → 1 board of the same wood (0.45 kg per board); the mill recipe uses Woodworking. Smelting and milling take 1.5 s per recipe. Failure consumes the normal 25% rounded up. Keep ore at 1.2 kg and ingots at 0.8 kg across metals; all logs weigh 1.5 kg. Tints on ordinary resource stacks have no additional weight effect.

**Tool supply.** Public provisioner sells a pickaxe (24g), hatchet (20g), tongs (15g), knife (8g), new saw (12g), plane (12g), mallet (12g) and repair kit (30g). Tradeable work tools start with 100 uses, one use per resolved gather/craft attempt that requires that tool. Wear tools individually. Existing skinning/combat actions keep their existing wear rules. Stations without a tool requirement do not charge uses. Permanent public benches include a fixed saw for milling only. Each guild desk lends its basic tools while nearby through the first quest: a loan is a station/marked-node interaction permission, gives no saleable item, and works again if the player fails. Each journeyperson can also take one 5g sweeping job per 60 seconds at the Quay for recovery capital (one cap shared across guilds). Supplies for introductory quests are detailed in §8.

## 4. Craft resolution, quality and progression

1. Select recipe → primary material → quantity. Preview exact inputs, owned and missing quantities, skill and material gates, tool uses, station, success %, exceptional % per attempt, weight and output. Default to ordinary material; a batch retains the selected grade. Never substitute a player's rare stock for common.
2. At start and completion require a living actor, a matching accessible station within 2 m, same floor, line of sight, usable tool, learned pattern where applicable, exact ingredients, free action slot and legal pack capacity after the exchange. A portable conversion explicitly permits the field. Movement, damage that interrupts work, closing a batch, disconnect or death cancels unresolved attempts. Each completed item stays completed. No silent bank withdrawals.
3. Effective minimum is the greater of recipe minimum and the selected material's working gate. For assembly with named primary components, every such component must match the selected material. Default recipe difficulty is min(100, effective minimum + 15). For existing recipes keep their authored difficulty on the ordinary material; for another material use max(existing difficulty, min(100, material gate + 15)). For colored smelting use the refining rule in §3. Craft success probability is the existing clamp(0.10, 0.98, 0.55 + (skill − difficulty) / 80). Check the minimum first. All displayed skills in these formulas are in whole-point units with a decimal, never raw tenths.
4. On ordinary recipe failure, lose ceil(0.25 × required) of **each** ingredient, spend one tool use and grant no output. A failed final assembly can cost a finished component; show the exact losses in the preview. On success debit all ingredients and credit the output in one commit. Invalid or interrupted action costs zero. Resolve batch entries serially, cap at 20, stop on rejected preconditions or explicit cancellation. Quality and success are separate rolls for each entry. Bulk quantities refer to attempts.
5. Equipment and finished instruments can be **exceptional**. On success roll conditional exceptional chance = clamp(0, 0.45, (skill − effective minimum − 10) / 100 + (skill == 100 ? 0.20 : 0)). Components, deeds, materials, ammo and tools have ordinary quality. At skill 100 an exceptional equippable or instrument can bear a visible maker's mark if toggled. Store creator ID on every finished equipment item even if the visible signature is disabled; store the displayed name at creation. Grandmaster signatures survive trade, death and repair.
6. Equipment base original max condition is 100. Set originalMax = round(100 × material durability × (exceptional ? 1.10 : 1)); new currentMax and currentCondition start at originalMax. Round positive halves upward. Exceptional weapons gain 4% on base damage before the existing final damage rounding. Exceptional armor and shields gain durability only. Material adds zero damage and zero armor rating. Same-family normal vs exceptional raw damage variance from crafting stays under the project's 6% ceiling. Retain the existing below-20%-condition penalty; compute condition ratio against currentMax. Defer extra item procs or combat bonuses.
7. Reuse skill gains, Raise/Hold/Lower and the 700.0 total cap. Each cost-bearing resolved action can call the owning skill's gain function once. Gain chance before its taper is clamp(.04,.30,.24−.0018×skill) × max(0,1−abs(skill−difficulty)/40); gain +0.1. Reuse the existing repeat-recipe taper and per-node limit. For new recipes key the taper by pattern family, independent of chosen material or batch button. Survey, packing, unpacking, deed placement and salvage award no skill. Do not train a second skill when a different profession made an input.

**Worked smith roll.** Smithing 80, Copper sword. Recipe minimum 20, Copper gate 50. Effective minimum 50, difficulty 65, success 73.75%. Exceptional conditional chance 20%. The preview shows 14.75% exceptional per attempt. Success costs 3 Copper ingots + 1 strap; failure costs 1 Copper ingot + 1 strap. A normal sword starts at 110/110, an exceptional one at 121/121. The metal stamp stays Copper after a repair or a trade.

## 5. Blacksmithing • primary profession

**Bench layout.** Smelt at the forge. Forge finished metal at the anvil with tongs and an active forge within 2 m of the anvil. Position the Quay stations so a walkable work tile meets both player and station constraints. The repair tab uses the same smithing work tile. Each station lists its work family. Show an “anvil needs a nearby forge” hint in invalid layouts. Ring the anvil once per resolved attempt. Reserve long animations for the end of a major commission; regular craft time is 1.5 s for fittings, 2 s for weapons/shields and 3 s for armor or suit assembly.

**Catalogue notation.** Each row is one recipe pattern; quantity follows ×. M = ingot of selected metal, B = board of selected wood. Unqualified handles, staves, beams and boards in a *metal-primary* recipe may be any single species per component line and convey no second bonus. Straps, sinew and cloth have their existing IDs. Hardware in a *wood-primary* recipe may be any one metal per line, except orders that explicitly specify hardware. Choose one material per line in the preview. All outputs default to one. Fixed-iron rows explicitly say iron. Ordinary “sword”, “dagger”, “hammer”, “glaive”, “chain” and “plate” resolve to existing item families/IDs.

| Forge pattern | Smith min | Inputs per attempt | Output and purpose |
|---|---:|---|---|
| Cut iron shards | 0 | 1 iron ingot | Iron shard ×6; existing Fletching and Engineering supply |
| Mooring rivets | 0 | 1 M | Rivet ×8; hinges, shields, hull work |
| Nail strip | 0 | 1 M | Nail ×12; furniture and building kits |
| Hinge pair | 10 | 1 M + 4 matching rivets | Hinge ×2; doors and storage |
| Dagger | 10 | 1 M + 1 strap | One-handed dagger; cheap replacement |
| Tool head | 15 | 2 M | Blank tool head; sells to engineers |
| Quay sword | 20 | 3 M + 1 strap | One-handed sword, shield compatible |
| Shield boss | 20 | 1 M | Shield boss; round shields |
| Metal buckler | 25 | 2 M + 1 strap | Metal shield; separate ID from wooden buckler |
| Ring blanks | 25 | 1 M | Ring blank ×6; chain assembly |
| Short spear | 30 | 2 M + 1 stave | Two-handed polearm; use glaive profile initially |
| Smith's mace | 35 | 3 M + 1 handle | One-handed hammer-family weapon |
| Bearded axe | 40 | 4 M + 1 handle + 1 strap | Two-handed Blades weapon; sword hit profile |
| Chain coif | 40 | 6 matching ring blanks + 1 strap | Commission or suit component |
| Heater shield | 45 | 4 M + 1 boss of matching metal + 1 strap | Metal shield; normal Shieldwork rules |
| War hammer | 50 | 5 M + 1 handle + 1 strap | Existing hammer family and handedness |
| Chain sleeves | 50 | 12 matching ring blanks + 1 strap | Commission or suit component; one pair |
| Chain leggings | 55 | 18 matching ring blanks + 2 straps | Commission or suit component |
| Chain tunic | 60 | 24 matching ring blanks + 2 straps | Commission or suit component |
| Assemble chain harness | 60 | Coif + sleeves + leggings + tunic, all same metal | Existing chain armor item; body slot |
| Glaive | 65 | 5 M + 1 stave + 2 matching rivets | Existing two-handed glaive |
| Plate gorget | 65 | 2 M + 1 strap | Neck component |
| Plate gauntlets | 70 | 3 M + 1 strap | Hand component; one pair |
| Bascinet | 70 | 4 M + 1 strap | Head component |
| Plate arms | 75 | 4 M + 2 straps | Arm component; one pair |
| Plate legs | 80 | 6 M + 2 straps | Leg component; one pair |
| Plate cuirass | 85 | 8 M + 2 straps | Torso component |
| Assemble plate harness | 90 | Gorget + gauntlets + bascinet + arms + legs + cuirass, all same metal | Existing plate armor item; body slot |
| Harbor bell casting | 90 | 10 M + 4 matching rivets | Tradeable bell casting for the carpenter's signal bell |
| Breakwater greatblade | 95 | 8 M + 2 straps + 1 handle | Two-handed sword, GM commission pattern; see S5 |

All metal components carry their metal ID, including single-input ring-blank items and multi-piece suit inputs. They cannot be equipped independently in the current one-armor-slot build. The complete chain/plate item activates the existing armor profile and penalties. A suit rolls quality only at final assembly. Loose armor components have no exceptional roll. Give distinct finished metal shields the current shield block profile. As initial tuning use base masses of 1.8 kg for a metal buckler, 3.3 kg for a heater, 2.4 kg for a spear, 2.8 kg for a mace, 3.2 kg for an axe and 4 kg for a greatblade. Existing items retain base family masses. The greatblade uses the existing two-handed glaive damage, timing and reach, with Blades accuracy and no shield. For new two-handers use a data flag enforced by equip, combat and UI.

**Cost of an order.** Before failures, one chain harness takes 60 blanks = 10 ingots and six straps. One plate harness takes 27 ingots and nine straps. A smith filling a six-piece plate contract should deliver the loose pieces. A fighter buying wearable plate needs the final assembled harness. The order screen must distinguish these two even when the metal matches.

**Repair service.** Choose an owned or explicitly offered item, preview condition, kit cost and projected maximum. Match Smithing to metal equipment and Carpentry to wooden equipment. Keep existing skill routing for other items. Use one Engineering repair kit per valid attempt, at forge/anvil for metal or bench for wood. Use existing repair check (difficulty 30). Successful repair sets currentMax = previousMax − ceil(0.03 × originalMax), then restores condition to currentMax. Reject before spending a kit if the prospective ceiling is below ceil(0.40 × originalMax), the item is already at full currentMax, the actor lacks the kit, or ownership/range changed. On a valid rolled failure spend the kit and leave the item untouched. A broken item stays repairable if the next ceiling qualifies. The owner can hand the item to a smith through existing trade; an in-place service uses owner confirmation displaying the exact item UID, fee and resulting ceiling, with one atomic settlement. Use ordinary trade for the first offline build. Never mutate bank or vendor stock through a repair panel.

**Smelt down.** At a forge with tongs, a smith meeting the metal working gate may confirm salvage of one personally held, unequipped crafted metal weapon/shield/harness or metal component. Return floor(0.40 × direct-and-embedded ingot basis × currentCondition/originalMax) of its recorded primary metal. Undamaged components use ratio 1. Destroy the item and all nonmetal inputs. Reject zero-return salvage with a preview. For stack outputs allocate fractional ingot basis by units, sum before flooring the selected quantity. Use conserved fractions, e.g. 1 rivet is 1/8 ingot; a hinge is (1 + 4/8)/2 = 0.75 ingot. A chain tunic has 4 ingots of basis. A fresh plate harness returns at most 10. Exclude NPC, starter, unknown-origin and monster loot from salvage; such items still work in combat and can be repaired. This keeps merchant purchases and legacy saves from creating untracked rare metal.

**Smith training route.** Train to 30 with one of the character's starter lessons, or start with rivets and iron shards. At 30–50 make tool heads, spears, maces, coifs and shields. At 50–70 fill chain-piece orders and make glaives. At 70–90 make plate components and fill a set order. At 90–100 assemble suits and cast bells; a character can reach GM using iron. Buying ore, commissioned parts or repair kits from other players is a valid smith build. Rotating customer orders helps overcome repeated-pattern training taper.

## 6. Woodworking • tree to saleable stock

A woodworker can live by visiting named groves, milling on site to save weight, or bringing prepared stock to smiths and carpenters. At the timber rack show a log, its board equivalent and the recipes it supplies. Mark raw, rough and finished stock with different silhouettes. Board yield is always one per log; no grade upgrades by combining common wood.

| Woodworking pattern | Min | Tool, place | Inputs | Output and buyer |
|---|---:|---|---|---|
| Saw boards | 0 | Saw in field or public mill | 1 selected log | 1 B; general trade |
| Whittle handle | 5 | Knife, field | 1 B | Handle ×1; smith or engineer |
| Split pegs | 10 | Knife, field | 1 B | Peg ×8; carpenter |
| Shape stave | 20 | Plane, bench | 2 B | Stave ×1; bowyer or smith |
| Cut slats | 30 | Saw, bench | 2 B | Slat ×4; crates and shutters |
| Square beam | 40 | Saw, bench | 4 B | Beam ×1; building timber |
| Plane panel | 50 | Plane, bench | 3 B + 2 matching pegs | Panel ×1; doors and chests |
| Cure stock | 60 | Public drying rack | 3 B + 1 resin | Seasoned board ×2; precision joinery |
| Laminate stave | 75 | Plane, bench | 2 matching seasoned boards + 1 sinew | Laminated stave ×1; ranged trade |
| Scarf ship timber | 85 | Plane, bench | 2 matching beams + 1 resin | Ship timber ×1; gangways |
| Dress master spar | 95 | Plane, bench | 1 matching ship timber + 2 matching seasoned boards | Master spar ×1; harbor order or signal bell |

Use the §4 chance and fail loss for these rows. For dry stock use a 4 s attended rack action, with resin representing the paid curing treatment; no offline waiting mechanic. Ordinary outputs inherit species and stack by form/species. Use initial masses of handle .25, peg .03, stave .70, slat .16, beam 1.5, panel 1.1, seasoned board .40, laminated stave .8, ship timber 2.8 and master spar 3.2 kg. Public saw, bench and drying rack are separate tagged interactions in the same yard.

**Training route.** Pinework spans every recipe minimum. Use handles/pegs to 30, beams/panels to 60, cured stock to 75, laminated staves and ship timbers to 95, then master spars through 100. Alternate craft and gathering when convenient. At 65 visit the Oak stands, at 80 Ash, at 95 Yew. Once at 100 all three old-growth species are accessible. A craftsperson at Carpentry 95 can buy their boards earlier.

## 7. Carpentry • finished items and structures

Work at a bench. Use mallet unless a row names the existing knife. B, pegs, beams, panels, staves, slats and spars in a wood-primary recipe all match the selected species. Purchased metal fittings and consumables are valid. A basic shortbow uses four logs of the selected species, and a wooden buckler uses three; existing pine recipes keep their exact costs. The skill gate for purchased high-grade wood is §2's finished-work gate.

| Carpentry pattern | Min | Inputs | Finished behavior |
|---|---:|---|---|
| Dock stool | 0 | 2 B + 2 pegs | Placeable seat, 1×1 |
| Shipping crate | 10 | 3 B + 4 nails | Empty placeable container, 6 stacks |
| Shortbow | 15 | 4 logs + 1 sinew; knife | Existing shortbow; consumes arrows |
| Wooden buckler | 20 | 3 logs + 1 strap; knife | Existing shield; wood-primary |
| Bench seat | 25 | 3 B + 1 beam + 4 pegs | Two-seat prop, 2×1 |
| Round shield | 30 | 4 B + 1 metal boss + 1 strap | Shield, base mass 2.4 kg |
| Shutters | 35 | 4 slats + 2 hinges | 1×1 wall socket, toggles open/closed |
| Sea chest | 40 | 2 panels + 2 hinges + 4 nails | 12-stack storage, follows plot access |
| Writing table | 45 | 1 panel + 4 B + 4 pegs | 2×1 table, placement and decoration |
| Reed lute | 45 | 3 B + 2 sinew + 1 resin | Existing bard instrument; normal bard cooldowns |
| Fence section | 50 | 1 beam + 4 slats + 4 nails | 2×1 boundary, snaps to plot grid |
| Cottage door | 55 | 2 panels + 2 hinges + 1 latch | Functional door on an authorized doorway |
| Crossbow | 60 | 1 laminated stave + 2 B + 1 trigger + 1 string | Existing crossbow; consumes bolts |
| Locking sea chest | 65 | 2 panels + 2 hinges + 1 lock + 4 nails | 16 stacks, plot permissions and lock |
| Dock gangway | 70 | 2 ship timbers + 4 B + 8 rivets | 3×1 approved gangway socket |
| Shipwright's bench | 75 | 2 beams + 2 panels + 8 nails | 2×1 station deed; ordinary bench actions |
| Longbow | 80 | 2 laminated staves + 1 string + 1 strap | Two-handed shortbow profile, base mass 1.4 kg |
| Smithy fittings stand | 85 | 2 beams + 1 panel + 1 anvil block | 2×2 anvil station deed; needs a nearby forge |
| Signal bell assembly | 90 | 1 master spar + 1 bell casting + 8 rivets | 2×2 bell deed; tap to ring, 10 s local sound cooldown |
| Mariner's chart cabinet | 95 | 3 panels + 2 seasoned boards + 2 hinges + 1 lock | 2×1, 20-stack cabinet; signature commissioning design |

**Upstream items.** Public provisioner stocks common pine/iron and consumables at the existing ordinary prices plus resin 3g, string 3g, peg 1g, strap 3g, hinge 4g, nail 1g, rivet 1g, handle 3g, boss 10g, latch 6g, trigger 12g, lock 14g, anvil block 50g. Stock common boards at 3g, slats at 2g, beam at 12g, panel at 12g and common stave at 7g. Keep a starter stock of 40 per commodity, refresh back to 40 every 15 minutes. Shop repairs/kits and basic tools remain accessible even when that commodity stock runs out. NPCs sell no special wood, colored ingots or capstone components. Put each material's producing profession beside the price in the recipe details.

| Supporting pattern | Skill/min | Inputs → output | Station / tool |
|---|---|---|---|
| Twist string | Fletching 0 | 2 sinew → 2 strings | Bench / knife |
| Arrow bundle | Fletching 10 | 1 pine log + 1 iron shard → 20 arrows | Bench / knife, existing |
| Bolt bundle | Fletching 20 | 1 pine board + 2 iron shards → 12 bolts | Bench / knife |
| Door latch | Engineering 10 | 2 iron shards → 1 latch | Anvil / tongs |
| Fit tool | Engineering 20 | 1 tool head + 1 handle + 1 strap → choose a basic pickaxe, hatchet, saw, plane or mallet | Bench / knife |
| Trigger | Engineering 30 | 4 iron shards + 1 sinew → 1 trigger | Bench / knife |
| Lock | Engineering 45 | 1 iron ingot + 2 iron shards → 1 lock | Bench / knife |
| Anvil block | Blacksmithing 65 | 10 iron ingots → 1 anvil block | Anvil / tongs |

For resale of new items use §9. Keep existing Engineering repair kits, Tailoring strap production and Skinning sinew. Add resin as an optional 15% side drop on a successful tree stroke (one resin, mass .05 kg, omit when only the side drop overflows). Smiths may accept mixed cosmetic head materials on tool commissions only if the order explicitly allows them. Engineering tools remain ordinary and use the same 100 charges.

**Placement and storage.** Craft furniture and structures as tradeable packed deeds. Display a translucent rotated footprint, green/red validity with a text reason, and confirm placement. Validate ownership/plot permission, empty cells, wall/socket type, collision, level, door swing, bank and resource-node clearance and a traversable route to the plot entrance. Reject placement on public routes. Reserve a small Quay guild demonstration plot with marked sockets for C1/C3/C4/C5 and a shared gangway beside it. Quest placement deposits the item permanently into that project, records one contribution and shows the completed prop to that player. Provide the same demo path in offline play without buying a house. Outside the demonstration, packing an item requires owner permissions and an empty container. A chest has exactly one contents container, including across reloads. Apply existing bank/lease access and full-loot rules; a carried deed or portable container goes onto the corpse. No nested storage deeds with contents, instant field shelters, or blocking the public dock.

**Training route.** Stools and crates to 25, shields and shutters to 40, chests/tables/doors to 60, crossbows and lockable containers to 75, workstations and longbows to 90, bells and chart cabinets to 100. Use pine for practice. A guild might order a matching suite in Heartwood, while a traveling archer requests a lighter Frostwood bow.

## 8. Four guild questlines

The four mentors work within walking distance of the Quay bank. Give each mentor the profession icon, role and one line explaining what they buy. Players may start any or all four paths immediately. Each path is linear; later quests require the preceding turn-in and the listed skill. Do not gate the existing beacon quest or wilderness access on these. Unless specified, a reward is ordinary carried gold plus any named entitlement; full packs get a pending NPC claim with no duplicated reward. Titles and learned patterns are permanent character entitlements.

**Objective vocabulary.** Harvest, survey, smelt, mill, make, repair and install observe the named player's committed actions **after acceptance**. For a make-and-deliver objective, count the action and require the matching quantity at hand-in. Stolen progress cannot be claimed through a trade window. Deliver-only objectives accept traded goods. When a quest explicitly requires a self-made piece, the item UID must carry the creator ID. Stackable progress uses the action counter plus the material/quantity in the pack. No second debit for materials consumed by a repair, installation or assembly. Each row is one quest. All can be completed solo through ordinary play.

### Mining • Dena, assaymaster at the public forge

| ID / skill | Commission | Objective sequence | Reward |
|---|---|---|---|
| M1 / 0 | **A Vein by the Water.** “That dark line above the tide is iron. Bring up enough for one bar.” | Borrow pick permission; harvest 3 iron ore at the marked Quay face; smelt 1 iron ingot; show the ingot, keep it. | 12g; pins for quarry and forge |
| M2 / 30 | **A Map That Pays.** Dena's old map marks three faces as one deposit. | Survey 3 distinct G1 rock faces at the Brine Crossroads, then return. Discovered common or unidentified seams both count. | 25g; surveyor title |
| M3 / 75 | **Three Shades of Copper.** The assay shelf has three empty trays. | Harvest 3 Dull Copper ore, 3 Shadow Iron ore and 3 Copper ore; deliver 3 of each. Three marked G1 seams support the objective. | 60g; assay shelf display and permanent material journal entries |
| M4 / 90 | **Fire at the Assay House.** A shipment needs certified mid-grade stock. | Smelt 1 Bronze, 1 Golden and 1 Agapite ingot; deliver the three. Mark G2 sample seams, each permitting 3 specialty ore; general veins replenish losses. | 90g; gilded pick cosmetic |
| M5 / 99 | **Blue in the Bell.** “If the rock shows blue, bank the first bar before you come looking for the second.” | Survey the marked G3 Verite and Valorite faces. Harvest 3 Verite ore and 3 Valorite ore; deliver 1 Verite and 1 Valorite ingot. | 140g; Deep Assayer title; unlock mining guild orders |

### Woodworking • Elin, timber scaler at the sawyard

| ID / skill | Commission | Objective sequence | Reward |
|---|---|---|---|
| W1 / 0 | **Read the End Grain.** Two boards are missing from the rack. | Borrow hatchet at the nursery; harvest 2 pine logs; mill 2 pine boards at the fixed saw; hand in both. | 12g; sawyard map pin |
| W2 / 30 | **Straight Stock.** Bent handles keep coming back from the forge. | Make 2 pine handles and 1 pine stave; deliver all three to the smith, report to Elin. | 30g; timber scaler's apron cosmetic |
| W3 / 65 | **Oak for the Pilings.** The high-water line has split two pilings. | Survey the named G1 Oak stand, harvest 4 Oak logs, make 1 Oak beam and deliver it. | 55g; oak-grain maker vignette in journal |
| W4 / 95 | **Spring and Memory.** A bowyer wants to compare two different grains. | Mill 3 Ash and 3 Yew boards; cure each species into seasoned boards; deliver 2 seasoned boards of each. Mark an Ash and a Yew tree in G2, 3 specialty logs each. | 90g; woodworker's rack cosmetic |
| W5 / 100 | **Three Trees, Three Rings.** Finish the guild's reference rack. | Survey the three named G3 old-growth trees; mill 1 Heartwood, 1 Bloodwood and 1 Frostwood board; deliver the three boards. Each tree permits 1 specialty log. | 140g; Keeper of the Grove title; unlock timber orders |

### Carpentry • Oren, joiner at the guild demonstration plot

| ID / skill | Commission | Objective sequence | Reward |
|---|---|---|---|
| C1 / 0 | **A Seat for the Ferryman.** The ferryman has been eating his supper standing up. | Make 1 pine dock stool and install it in the marked 1×1 spot. Turn in by speaking to Oren. | 15g; permission to preview demonstration sockets |
| C2 / 30 | **A Shield for the Runner.** The ferry runner needs a shield before crossing Brine Road. | Make 1 pine round shield with any metal boss; deliver the self-made shield. | 35g; commission board preview |
| C3 / 55 | **A Door That Clears the Tide.** A door is catching on a swollen frame. | Make 1 pine cottage door with 2 hinges and 1 latch; rotate to match the marked east-facing jamb; install, open and close successfully. | 65g; tide-mark finish cosmetic |
| C4 / 75 | **The Broken Gangway.** Two beam ends no longer span the landing. | Source 2 pine ship timbers from a worker, supplier order (see below) or the market. Make the pine gangway. Install it at the Quay demo socket; walk across to Oren's survey post. | 95g; dockwright title |
| C5 / 95 | **Sound the Change of Watch.** The old bell cracked in the storm. | Take delivery of a casting and a master spar, make 1 signal bell assembly of any wood, install it and ring it before returning. | 150g; Master Joiner title; chart cabinet design; unlock carpentry orders |

### Blacksmithing • Mara, quay smith beside the anvil

| ID / skill | Commission | Objective sequence | Reward |
|---|---|---|---|
| S1 / 0 | **Holdfast.** “The next tide will pull that ring out. I need four good iron rivets.” | Source 1 iron bar; make 8 iron rivets; deliver 4. If arriving empty, follow Mara's optional pick → outcrop → forge route. The player keeps the other four. | 15g; supply ledger and first anvil pin |
| S2 / 20 | **An Edge for Brine Road.** The new watch hand needs a replacement that will fit the old scabbard. | Forge an iron Quay sword and deliver that self-made sword. Mara then releases the stamped, worn practice sword for S3. | 35g; entitlement to S3 practice piece |
| S3 / 40 | **Leave Enough Metal.** “Read me what the blade will take before you mend it.” | Inspect the issue sword (iron, normal, originalMax 100, currentMax 100, current 32). Repair it and show 97/97. Hand it back. | 50g; smith's touchmark cosmetic |
| S4 / 65 | **A Fitting Harness.** One watchman, four chain parcels. | Make coif, sleeves, leggings and tunic in one selected metal. Assemble the four into a chain harness and deliver the self-made suit. Iron qualifies. | 85g; unlock small smith orders |
| S5 / 90 | **Six Pieces for the Watch.** Outfit the plate rack before the harbor inspection. | Accept a special set deed. Deliver one of each loose plate component in matching Bronze; partial fills persist. Source 27 Bronze ingots and 9 straps before failures. Return the filled deed. | 130g; Breakwater greatblade pattern; unlock large smith orders |
| S6 / 100 | **The Blue Signature.** “Smiths will recognize your work long after this watch ends.” | Make 1 exceptional Valorite Breakwater greatblade with the maker's mark enabled. Show it to Mara; **keep the blade**. Provide a preview of the full odds before forging. | 200g; Grandmaster of the Quay title; signed inspection entry |

**Quest logistics.** C1 provides a project-only bin of pine boards and pegs plus the station mallet; refresh failed inputs on request. Outputs from that bin are usable only at the demo socket, have zero resale/salvage and cannot enter trade or other orders. S1 shares M1's marked pick permission until S1 is complete, and Mara supplies tongs at her anvil. S3 loans one training kit per attempt and reissues the same worn practice piece if lost; invalidate its previous serial on reissue. The kit/piece only work together at Mara's station, have zero transfer or salvage value and cannot generate skill gain. Close the loan on completion. All real gear, specialty materials, purchased tools and quest rewards in the pack follow ordinary corpse rules.

For solo access to advanced dependencies, the guild desk always offers **made-to-order inputs** against player-supplied raw stock and a fee. It can return any Woodworking intermediate or ordinary metal fitting/casting needed for these quests. Expand the exact recipe tree down to raw logs/ingots and shop consumables; quote and consume the full no-failure bill plus 5g per intermediate recipe execution. Return the ordered intermediate(s) atomically, with no skill gain, creator credit or salvage provenance. Accept a caller's already-made intermediates if explicitly selected. For example, a pine ship timber requires 8 pine logs and 1 resin if starting raw (8 board, 2 beam, 1 timber recipe executions = 55g). W4/S5/S6 still require personally executing their named craft steps. Rare metal/wood must always be supplied by a player. Marked sites offer sample material; on any refining or crafting failure the player may return to the ordinary resource field or buy replacements. Nominal quest requirements and bills of materials exclude failure losses.

## 9. Life after Grandmaster • orders and the economy

**Public contract board.** Show customer, item and form, accepted material, quantity, minimum quality, remaining delivery, reward and expiry. Filter by “can make”, “I have inputs” and “nearby station”. Give paid commissions an actual buyer and a finite demand budget. Hand-in consumes the goods. Never sell them back through the same board.

| Issuer | Example repeatable | Eligibility and reward |
|---|---|---|
| Dena | 6 Verite ingots for a guild stockpile | M5 complete, Mining ≥95. Tradeable inputs allowed; 3 miner seals |
| Elin | 4 Ash beams or 2 Frostwood ship timbers | W5 complete, relevant skill gate; 3 timber seals |
| Oren | 2 matching Oak sea chests for a new lease | C5 complete, Carpentry ≥65. Check species and empty packed state; 3 joiner seals |
| Mara, small deed | 10, 15 or 20 iron daggers; high-grade variant asks for Copper exceptional daggers | S4 complete; verify material and individual quality. Pay 2 seals for ordinary or 4 for exceptional |
| Mara, large deed | Six small plate-part lines, each requiring 10 matching pieces of a single named metal | S5 complete; each line matches one loose part, quantity and material. Ordinary-only parts; 12 smith seals |

Use up to three deterministic offers per board per character per six hours of world time; a refresh preserves accepted work. Accept one active repeatable per guild. Offer materials/recipe only when the character meets the relevant working gate and pattern license. Contracts last 72 hours from acceptance. Show a warning before depositing a partial delivery: surrendered goods are consumed and expiry or abandonment forfeits that progress. Fulfillment may use multiple visits. On the last visit award the stated seals and mark complete once. Seal shop per guild: 6 for a journal border, 12 for the guild apron appearance, 24 for a guild sign deed. Cosmetics carry no gathering, combat or pricing bonus. Main story has no time limit. One-off quests only pay gold; for repeatables the quoted seals are the full NPC reward. Players negotiate gold for private orders.

**Player commission.** In multiplayer, the buyer posts exact item/material/quality/quantity, maker requirement if desired, deadline and funded price. Hold the full quoted gold in escrow; an eligible delivery transfers the goods to the buyer's claim container and gold to the seller together. Cancel only the unfilled quantity and return its unspent gold. If taking partial fills, specify a whole-number price per unit at posting. A claim container only accepts fulfilled orders, has finite slots reserved when posting, and is collected at the board. Offline release may use guild orders as the active board tab and reserve player orders for a server-backed trade service.

**Prices, replacement and sinks.** Preserve existing ordinary vendor prices. For newly added goods cap NPC buyback at 20% of the cheapest ordinary NPC input replacement value, rounded down; ignore rare-material and exceptional premiums at NPCs. For composite goods compute this from the cheaper available buy-or-make bill including supplier fees when that route is cheaper; no buyback on unpriced or loan/quest goods. Wear scales resale by remaining condition ratio; a worn consumable tool uses remainingCharges/100. Recheck existing buy/sell pairs for positive vendor-only cycles when adding new recipes, especially bulk nails, iron shards and arrows. Players can pay a premium for scarce species, durability, signed equipment and fulfilled orders. Log ore/log extraction, refine losses, gear made/lost/repaired/salvaged, contract sinks, and time to a replacement iron kit. Target the project's ≤12-minute basic-kit rebuild with ordinary skills and a reachable common node circuit. Treat it as a playtest measure.

## 10. Browser implementation contract

**Item identity.** Add explicit material IDs, separate from `q` (legacy gathering grade), `quality` (normal/exceptional) and gold currency. Raw material stacks key by item/form + material + applicable existing stack metadata. For compatibility map missing material on `ore/ironbar/ironshard` to iron and on `pine` to pine. Keep the existing `ore`, `ironbar`, and `pine` IDs for their current ordinary forms; use distinct colored/resource IDs or a checked predicate everywhere, so an old `SF.count(pack,'ironbar')` cannot consume Valorite. Existing compatibility recipes and vendor prices stay reachable. Extend count, remove, split, merge, transfer, shop sale, equip, death, bank, inspection, rendering, trade and quest checks together. Metadata needs to survive a split/merge or corpse round trip. Currency can never satisfy a Golden ingot predicate.

**Data shapes.** Keep definitions separate from instances. Add equivalent fields to the current JS objects and use the existing IDs on actual game items. As an example, this smith intent can produce either normal or exceptional equipment:
```json
{
  "pattern": {"id":"sword","skill":"smithing","min":20,"diff":35,"station":"anvil","tool":"tongs","inputs":[{"form":"ingot","material":"selected","qty":3},{"item":"strap","qty":1}],"output":{"item":"sword","qty":1,"primary":"selected"},"qualityRoll":true},
  "intent": {"requestId":"demo-001","patternId":"sword","primary":"copper","quantity":1,"stationId":"quay-anvil","expectedPackVersion":17},
  "exampleOutput": {"id":"sword","uid":813,"material":"copper","quality":"exceptional","creatorId":"player-7","maker":null,"origin":"crafted","originalMax":121,"maxc":121,"cond":121,"salvageBasis":{"metal":"copper","numerator":3,"denominator":1}}
}
```

**World state.** Node key = map/floor + tile + node type. Persist generation, specialty, stock, refill timestamp and quest allowances. Placeables retain object UID, footprint, rotation, plot permissions, linked container and component material. Quest records track per-character state, counted event IDs, accepted material, deliveries and unique reward issuance. A recipe learned once survives death. Outputs may hold a visible signature only if eligible; ordinary inspection can always expose material and condition.

**Save migration.** The inspected standalone build writes `shardfall.save.v1`, with an explicit allowlist of character fields, a single beacon quest record, corpses, pets and a UID high-water value. Extend the saved payload and load a v1 fixture; keep `quest.beacon` and any existing wick, quests, pets, banks, corpse contents, location and settings. Add profession quests as a sibling dictionary, additive to the beacon journal. Existing normal wearable items default to originalMax 100 (or an explicitly larger known original), keep old current/max condition, and set unknown provenance. A saved grade-3 ordinary iron stack stays ordinary iron; preserve grade when legacy callers inspect it. Add unique IDs/charge state to existing eligible tools without overwriting equipment IDs. Preserve high-water marks for items in demo projects, orders and storage too. Migrate once and back up the original save at first successful migration. A save quota failure leaves the previous committed state usable and warns the player.

**Action authority.** Offline, commit from one copied snapshot and persist before acknowledging or playing success audio. The live server owns the corresponding stock, clock, recipe/RNG, item UIDs, range, inventory version and ledger. Route every step through a single action result, including gathering, craft, repair, salvage, order fill and reward claim. Use one unique event ID per committed batch entry. Reject a stale command or replay its recorded result. The game already has delayed callbacks for repeated gather/craft; guard those with a cancel token and current session/actor/station/selection. Reconnect never repeats the last completed roll. Add recipe definitions before building `SF.RECIPE` or rebuild its index after registration.

**Armory and display.** Resolve “Copper Quay sword” and “Pine buckler” from a material and a neutral base name. Avoid labels like “Copper Iron sword”. Add neutral form labels to inventory, inspection, order and death messages. Material tint affects only the material pixels; silhouette, UI rarity and hostility colors stay legible. New crafting symbols can use simple original pixel art consistent with the scout, rats, skeletons and quay environment. No external game assets are required.

**Compact mobile interaction.** Inspecting an object shows a short world label and one action. The recipe browser is an explicitly opened side sheet; opening a station never permanently fills the HUD. Use category chips, one scrollable list, and a detail view with Back, chosen material, have/need counts and Make 1/5/custom. A caretaker arrow points to the selected journal objective or a known station. Preserve joystick/action space when the sheet is collapsed, use safe-area insets and touch controls of at least 44 CSS px. On a narrow landscape device allow category → recipe → detail drill-down. Movement or entering combat closes the crafting detail and stops any unresolved batch. Use text plus an icon for grade, failure, worn tool and law boundary.

## 11. Build sequence and acceptance checks

| Delivery step | Play it through before advancing |
|---|---|
| 1 • Existing save and first anvil | Snapshot a populated v1 save. Add material-aware stock, metallurgy preview and M1/S1. From spawn tap outcrop → forge → anvil → Mara. Then load v1 again and complete the old beacon quest. |
| 2 • Full smith loop | Add all ores and smith patterns, quality/mark, repair, recycling and smith commissions. Make and sell a suit through the normal vendor or trade flow; test skilling from 90 to GM using ordinary iron. |
| 3 • Woods and the joiner | Add wood tables, stock forms, carpentry catalogue, upstream parts, supplier orders and demonstration sockets. Craft, place, use and pack a chest, then complete W1–W5 and C1–C5. |
| 4 • Economy and persistence | Exercise all 21 authored quests, repeatable orders, zero-money recovery, death mid-batch and reloads on a real phone-sized viewport. Wire multiplayer actions to the authority when available. |

**Deterministic verification cases.** Supply an injectable RNG and clock. Test both the shared crafting rules and at least one browser tap-through for each profession. The flags `window.__SF` exposes are useful for fixtures; the normal UI must also pass.

| Case | Required observation |
|---|---|
| Thresholds and units | 64.9 Mining cannot obtain Dull Copper; 65.0 can. At 74.9 no ordinary Copper discovery; at 75.0 eligible. 98.9 Mining cannot discover Valorite, 99.0 can. At 99.9 Woodworking no GM wood; 100.0 eligible for all three. A 95 Carpenter can use purchased Frostwood boards. |
| Training at 0 | With empty pockets and zero starting craft skills, M1, W1, C1 and S1 have a first action and a repeatable recovery after one forced failure. Each first turn-in gives exactly one reward. |
| Ordinary compatibility | Pine shortbow consumes four pine logs and one sinew; arrows consume one pine log and one iron shard for 20; iron sword consumes three iron bars and one strap. Existing cheap recipes, field skills and armor equip remain usable. |
| Metals and fail loss | Force Copper sword success, failure and exceptional with the §4 fixture. A pack containing two Copper plus one Golden ingot cannot make it. A cancelled wind-up consumes zero. Verify maker hidden at 80 skill. |
| Work tiles and death | A forge alone can smelt; an isolated anvil cannot forge. Begin a batch of five, finish two, then move, die or disconnect during number three. Exactly two outputs and two committed costs; after death check the corpse and bank. |
| Final stock race | Two players hit a 1-stock vein. At most one receives ore and decrements it. Reload before respawn; it stays depleted. After refill, pin expires and stock regenerates once. |
| Plate and salvage | 27 same-metal ingots + 9 straps suffice for a six-component set on forced successes. Assemble from six distinct pieces. Reject mixed-metal or missing-slot sets. A pristine normally crafted harness melts to 10 ingots; smelting twice returns nothing on the second request. |
| Repair | Ordinary 32/100 → 97/97 at first success. Exceptional Copper 32/121 → 117/117. Reject a repair from 42 max on an original-100 item before kit debit because 39 is below 40. Reject full-condition items. |
| Quest and deed | Show-only S6 leaves the blade in the player's pack. S5 accepts a bronze gorget once and rejects a duplicate slot, a complete harness or iron part. Reconnecting after a reward or repeated last-click cannot pay twice. |
| Wood consistency | Mill a Bloodwood log; all resulting boards and matching stock retain Bloodwood after banking, death and trade. A pine panel cannot combine with a Frostwood panel for a same-species door. No furniture placement can create a second container. |
| Progression and orders | At the 700.0 cap, no Lower skill means no gain. Skill gains never exceed +0.1 per committed action. Contract fills debit exact quantity. A request repeated after expiry or completion cannot create another seal. |
| Shelf space and layouts | Full pack where the craft exchange frees enough room succeeds; insufficient post-exchange capacity costs nothing. A 667×375 and an 844×390 viewport can choose material, craft, close, walk and reopen the journal without hidden buttons. |
| Existing content and risk | The beacon path, starter quest map marker and combat controls still work. Carried real materials and a signed weapon drop on death under existing area rules. Old banked items, craft maker, pet and corpse inventories survive migration. |

**Economy playtest:** time one novice replacing an iron dagger, one journeyperson making chain, one GM fulfilling a blue blade commission, and one carpenter restocking a lost bow. Record attempts, material burned, travel time and causes of interruption. Example endgame expectation: at Smithing 100 on S6, difficulty 100 gives 55% success; the conditional exceptional chance is 15%, or **8.25% per attempt** with the mark enabled. This averages about 12.1 attempts per signed blade over many commissions. Show the probability directly; do not imply a guaranteed result after twelve. Tune after playtests from these observed costs.

## Official UO references

Use these to check terminology and inspiration. Use the Shardfall tables above for game behavior.

- Metal discovery thresholds, colored veins and separate smelting outcomes. [UO • Mining](https://uo.com/wiki/ultima-online-wiki/skills/mining/)
- The seven wood types and their gathering thresholds. [UO • Lumberjacking](https://uo.com/wiki/ultima-online-wiki/skills/lumberjacking/)
- Separate skill thresholds for finding, milling and crafting with the special woods. [UO • Publish 58](https://uo.com/wiki/ultima-online-wiki/technical/previous-publishes/2009-2/publish-58-19th-march/)
- Smith training, tools, crafting interface and orders. [UO • Blacksmithing](https://uo.com/wiki/ultima-online-wiki/skills/blacksmithing/)
- Deeded furnishings, cross-trade inputs and professional tools. [UO • Carpentry](https://uo.com/wiki/ultima-online-wiki/skills/carpentry/)
- The separate bow/ammunition profession that informs Shardfall's two existing skills. [UO • Bowcraft and Fletching](https://uo.com/wiki/ultima-online-wiki/skills/bowcraft-and-fletching/)
- Historical small and large smith orders, matching material, quality and quantities. [UO • Publish 14](https://uo.com/wiki/ultima-online-wiki/technical/previous-publishes/2001-2/2001-publish-14-14th-november/)

## Addendum (v0.25): armor, Mithril and hides

The equipment system adds an **Armor** category to the bench (Tailoring: cloth, leather, studded leather, bone; Carpentry: wooden
shield) and the anvil (Blacksmithing: ringmail, chainmail, platemail, helmets, metal shields, dragon scale, accessories). Recipes are
generated from one definition per piece and the shared material registries, so every metal makes every metal piece and every hide
every leather piece. **Mithril** joins the metals (mine and smelt 100, smith 98; grade-3 regions only, weight 3 in 100): the lightest
metal (armor weight ×0.45). Leather comes in eight hides with their own Tailoring gates (thick 30, wolf 40, spined 55, horned 65,
troll 70, barbed 80, dragon 95). Armor multipliers, gates and repairs: `docs/equipment/STATUS.md`.
