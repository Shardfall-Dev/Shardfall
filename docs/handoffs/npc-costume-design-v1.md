# Shardfall NPC wardrobe & faction design v1.0
Status: proposed art direction and implementation specification, not finished sprite art or a game-code change.
Scope: all humanoid NPCs and hostile humanoids; nonhuman variants only where anatomy-specific existing art supports them.
References in this repo: docs/handoffs/classic-human-sprites-v2.md, docs/handoffs/paperdoll-v1.md, docs/equipment/STATUS.md, asset-packs/classic-humans-v2, asset-packs/layered-armor-v1, asset-packs/medieval-equipment-art-v1, src/anniabreen.js, src/townlife.js, src/living.js, src/equipment.js, src/rules.js.
## Art direction
Original classic late-1990s isometric RPG art: grounded medieval fantasy, realistic anatomy, visible layered silhouettes, muted natural dyes, hand-painted texture, top-left lighting and consistent scale. No copied UO assets, anime, giant weapons, plastic gradients or luminous ordinary cloth. Two main colors and one accent per outfit; metal and natural leather are independent. Distinguish roles by silhouette first, color second. Use both body types across eligible roles, no gender-locked professions or protection differences. Same item shape in world and paperdoll. Design at native sprite scale, not just enlarged portraits.
## Factions and regional palette (proposed; base sRGB dye colors, not full-sprite filters)
| Region / ID | Primary | Secondary | Accent | Heraldry | Uniform |
|---|---|---|---|---|---|
| Mynoc / mynoc | #BD913D ochre | #514033 brown | #858B8E iron | crossed hammers | chain tunic, leggings, open helm, ochre tabard, mace or legal shield/weapon combination |
| Vespar / vespar | #284663 navy | #D6D1BD ivory | #858F99 steel | river and bridge | plate/chain mix, navy tabard, sword + shield or spear alone |
| Skara Bryn / skara | #3E573A forest | #786746 muted tan | #49382A leather | oak leaf and arrow | studded leather, short green cloak, bow or sword |
| Moonglen / moonglen | #514269 violet | #C8C5D0 ivory | #777E8C silver-grey | crescent | chain/plate for guards, violet tabard; robe and staff for actual caster roles |
| Saltmarsh / existing local zone ID | #783D37 faded red | #655443 brown | #85827A weathered iron | anchor | ringmail/leather, faded red tabard, spear or sword + wooden shield |
Colors for cloth/heraldry only unless actual material is the corresponding color. Do not make silver-grey dye grant silver material stats. Use approved symbols as separate cloth/shield overlays; no inventory duplication.
Guard rank: recruit leather/ring with simple cap; patrol standard kit; sergeant upgraded headgear, restrained trim; captain plate or regional equivalent plus distinct cloak and crest. Keep 1-2 recognizable faction accents in every variant. Archer, infantry, caster uniforms differ by role but share colors. Guard uniform is not proof of law status: use existing faction/justice logic. Off-duty guards wear civilian clothing if schedule supports, and never lose authority or equipment by a purely cosmetic switch.
## Civilian wardrobe recipes
These are semantic recipes, not assertions that assets or item IDs exist. Resolve against authoritative registries; cosmetic aprons, skirts, bags, hoods, hats, props and crests may need art. Never silently substitute unrelated gear or create stats.
| Role | Outfit / silhouette | Colors | Work prop (only while appropriate) |
|---|---|---|---|
| Blacksmith / armorer / weaponsmith | rolled sleeves, thick leather apron, gloves, heavy boots | charcoal, russet, linen | hammer or tongs |
| Miner | short coarse tunic, leather vest, cap, rugged boots | stone grey, ochre, brown | pickaxe |
| Carpenter / lumberjack | shirt, canvas or leather apron, sturdy trousers, belt | pine brown, cream, moss | saw if supported / hatchet |
| Fletcher / bowyer | fitted vest, forearm bracer, cloth shirt | olive, tan, brown | bow or arrows |
| Tinker | short apron, utility belt, cap | clay, grey, tan | tongs or tool |
| Tailor / weaver | tidy shirt or dress, long textile apron, measuring tape only if art exists | plum, sage, muted blue | sewing kit |
| Tanner / leatherworker | heavy apron, rough shirt, boots | dark brown, ochre | knife |
| Fisher / fishmonger | rolled sleeves, short apron or wool cap, practical boots | slate, sea green, cream | rod or fish basket |
| Sailor / ferryman / dockworker | loose linen, belt, short vest, headscarf if supported | faded navy, sand, brown | rope or cargo (cosmetic) |
| Farmer / shepherd | rough tunic, straw hat if available, work shoes | oatmeal, dirt brown, moss | hoe / crook only if supported |
| Baker / cook | pale apron, head covering, plain tunic | linen, warm grey, tan | bread or utensil |
| Innkeeper / tavern staff | waistcoat or dress, clean apron, rolled sleeves | burgundy, cream, brown | tankard |
| Merchant / provisioner | fine wool tunic, waistcoat, belt pouch | subdued blue, rust, cream | goods/pouch |
| Banker / wealthy trader | long fine robe or coat, discreet embroidery, polished shoes | navy, wine, gold-brown accent | ledger |
| Healer / herbalist / alchemist | long pale linen or sage robe, satchel | ivory, sage, muted teal | bandage, vial, herbs |
| Reagent vendor | practical robe, pouch belt | olive, grey, brown | reagent pouch |
| Mage / scholar / scribe | long robe, mantle, bare head or hood | violet, blue, stone | staff or book |
| Priest / monk | simple long robe and cord belt | ivory, ochre, brown | book or symbol |
| Ranger / hunter | fitted leather, weathered cloak, rugged boots | forest green, tan | bow, knife |
| Traveller / adventurer | mixed cloth/leather, cloak, bedroll only if art | region-specific muted tones | actual held gear |
| Villager / laborer | simple shirt/tunic, trousers or skirt, worn shoes | oatmeal, rust, dusty blue | role-dependent |
| Noble / official | tailored long coat/robe, fine cloth trim, simple jewelry | wine, indigo, ivory | none |
| Beggar / refugee | patched wool, frayed cloak, worn footwear | faded tan, charcoal | none |
| Prisoner / captive | plain coarse clothing, no armor unless actual equip | dull linen, grey | none |
Use current spawn role identifiers (ANN_SHOPS includes miner, tailor, tinker, fishmonger, innkeeper, fletcher, ranger, reagents, mage); enumerate ALL live NPC definitions incl Saltmarsh and roaming encounters, explicitly map aliases and record unknown roles. Generic villager fallback must be visibly logged.
## Hostile human wardrobe
- Roadside bandit: patchy brown leather, rough tunic, rusty iron weapon, faded rust scarf optional; avoid uniformity.
- Bandit archer: green-brown cloth, studded bracers, short cloak, actual bow; no shield with two-hand bow.
- Highwayman: dark grey cloak, narrow leather silhouette, dagger/sword only if actually wielded. Not all hostile characters must be hooded.
- Marauder / brigand veteran: mixed ringmail and leather, old plate pieces, scarlet cloth scrap; material matches actual items.
- Bandit chief: better maintained mixed armor, broad burgundy mantle, distinctive shield or two-handed weapon; no mandatory rare metal.
- Pirate / smuggler: sea-worn leather, striped or plain sash if supported, bandana, boots, sword/axe appropriate to encounter.
- Deserter / mercenary: mixed armor, faded or removed heraldry, visible non-uniform kit.
- Cultist / necromancer: soot-black or plum robe, muted bone-white trim, staff where actual spellcaster; no automatic glow.
- Rogue mage: worn ash-blue or plum robe, short mantle, actual focus/staff.
- Skeleton warrior/archer, zombie, undead knight: anatomy-specific overlays only when art exists; torn cloth or rusty armor, not human skin layers.
- Orc/goblin humanoids: coarse wraps, rough leather, scavenged metal if supported by species rig; no stretched human gear. Beast/animal/elemental/dragon assets remain unchanged except separately authored species-specific cosmetic variants. Boss accents only from existing approved boss presentation, not implied by rare materials.
Map only currently existing mob IDs. Do not spawn new mobs, change skills, damage, loot tables or AI just to show a costume.
## Clothing layers and materials
Reuse registered body, skin, hair, beard, shirt, trousers, tunic/tabard, robe, cloak, belt, armor regions, boots, headgear, held weapon, shield. Required new cosmetic modules (audit first): work apron short/long, vest, dress/skirt, cap/headscarf, hood down/up, sash, heraldry, pouches, wear overlays and props. Cosmetic overlays do not occupy functional slots unless a real item is defined in a separate approved task. Masks for fabric dye vs metal/hide/wood/secondary studs; use actual SF.EQ/SF.matOf material colors and actual item instance material/sec; do not recolor the whole person. Helm hides hair by mask, cloak split back/front, apron does not cover plate incorrectly, shield respects EQ.twoHanded. Respect existing world and paperdoll manifest canvas/anchors, 8 directions, all actions and both bodies. Keep 112x100 rig and 384x512 paperdoll proposals subject to actual manifest. No fake complete atlases.
## Identity / wardrobe resolver
Implement a pure data-driven resolver, shared by world NPC/player renderer and paperdoll, not parallel inventory. Example conceptual fields: presetId, roleId, regionId, factionId, rankId, stable actorId, appearanceSeed, body, skin, hair, beard, clothDyes, cosmeticOverlayIds, equippedItemRefs, currentActivity, outfitState, assetRevision. Use existing actor identity and saved appearance; seeded stable choice using actorId/world seed and explicit wardrobe version, never Math.random per frame. Curated weighted variants: 3-5 clothing palettes per civilian role, 2-4 garments/condition combinations per hostile role; guard rank/faction colors locked. Hair, skin, beard and gender diverse independent of hostility or wealth. Save resolved choices or stable seed/version; migration retains existing identity and gear; don't overwrite player selection. Quality/condition overlays use subtle dirt, fading, patches and rust where appropriate, independent of stats; no racial or class stereotypes.
Equipment is actual actor.equip when supported. If an NPC lacks equip model, separate cosmetic-only preview from mechanically equipped gear, and disclose; do not manufacture loot or give invisible protection. Preserve existing loot generation; future real equipment loot requires separate economy approval. NPC death/corpse uses last resolved appearance, no item duplication. Crime status remains existing gameplay/UI signal, never derived from wardrobe.
## Living world wardrobe
If current schedule system supports it: blacksmith wears apron at forge, loses work prop when off duty; miner stows pickaxe when visiting inn; guard carries duty weapon during patrol, lantern at night only as cosmetic when hand is free; traveler wears cloak outdoors. Use existing schedule/activity transitions, no changes to simulation. Persist personal colors/identity across work/home/travel/sleep, use separate sleep clothing only if appropriate assets exist; avoid random changes each interaction. NPCs do not magically conjure tools into loot. Cache resolved variants by actual visual signature + asset revision, bounded LRU, no per-frame regeneration; lazy load and keep existing fallback documented.
## Implementation sequence for Claude
1. Fetch latest main and this design branch. Read AGENTS.md, README.md, existing handoffs and manifests. Inspect NPC/mob spawn registries, role aliases, equipment definitions, renderer, animation, paperdoll and schedule state. Produce coverage matrix: NPC/mob ID, region, role, outfit preset, asset availability, fallback. No code change until dependency gaps are identified.
2. Add versioned data-driven wardrobe presets, palette and rank data using project conventions. Add validator: real item IDs, material IDs, palette formats, valid slots, two-hand constraints, valid region/role references, stable seed. No duplicate combat/inventory state.
3. Integrate with shared resolver and existing renderer behind a flag where the layered system is ready. Implement first five city guards and civilian blacksmith, miner, innkeeper, merchant, mage, ranger, bandit variants. Missing art must stay explicitly missing; use documented existing fallback, not an unrelated fake item. Preserve procedural prototypes separately from painted art.
4. Add remaining current roles and anatomy-appropriate mobs, then activity wardrobe and weather optional only after baseline passes. Do not add gameplay rules for visual changes.
5. Build using current README/build.sh. Add automated coverage and determinism tests; verify reload/migration, no item loss or new drops, two-handed weapon/shield, same item material across world/doll, all eight directions, walk/run/attack/cast/death, day/night, phone and desktop. Screenshot lineup in daylight/night and actual game scale; test multiple NPCs and cache bounds. Keep old fallback until approved. Report tests actually run, missing assets and paths; commit in named branch or PR. Do not claim painted assets exist when they do not.
## Acceptance
Every current human NPC and human mob resolves a documented preset or explicit missing mapping; every guard from a city shares heraldry and colors; visually distinct roles remain readable at native size and grayscale; identical person after save/load and travel; actual equipment matches visible equipment when art exists; no stat, combat, AI, economy, loot or inventory regression. No new standalone sprite per color, NPC name, or material. No unlicensed reference art in the game. This is a specification only: production art and runtime integration remain separate deliverables.
