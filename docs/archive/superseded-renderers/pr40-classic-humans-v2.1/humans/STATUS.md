# Classic human visual rework v2.1 — status

Build **v0.32**, branch `feature/classic-humans-v2.1`. It is stacked on `feature/npc-wardrobe-v1` (PR #39) and includes current `main`
with the three ZIPs. Handoff: `docs/handoffs/classic-human-sprites-v2.1.md`. Contract: `docs/humans/CONTRACT.md`.

## Verdict on the artwork

**The painted art is NOT finished, and the game does not claim it is.** The delivered painted set covers about 2% of the frames the
animation contract needs: 80 painted body frames, 32 of them mirrors, against 3,376 per layer for 29 actions × 8 directions × 2 bodies.
It also contains **no** separate hair, clothing, armour, weapon, shield or base-body layers; hair and plain clothes are painted into the
bodies. So the painted mode shows everyone as one of the same two people (a man and a woman in linen), and worn equipment cannot show
yet. That is why the classic sprites remain the default and the painted renderer is behind the flag.

## What is in v0.32

| Area | State |
|---|---|
| Asset install | `tools/install_human_art.py` checks the handoff SHA256s and installs only the runtime atlases to `assets/humans/painted-v2.1/`, with a combined manifest. It embeds them as `src/human-art.js`. Source art and preview HTML stay in the ZIPs. |
| Scale | Idle figures (69 px) were resampled once, offline, to the walk/cast height (63 px) around the ground anchor, so standing and walking match. The originals are untouched. Painted figures are 63 px against the old Scout's 67 px, drawn 1:1, nearest-neighbour. |
| Compositor | `src/compositor.js`: the layer registry, per-direction draw order, near/far hands, cloak front/back, helmet/hood occlusion, mask-based luminance-preserving tints per piece, and one shared canvas and anchor. It is pure and node-tested with synthetic overlays: valorite plate chest + leather gloves + iron chain leggings + mithril helm compose as four independent pieces, each in its own material colour. |
| Renderer | Menu → *Human art: classic / painted (partial set)*, or `?humans=painted`. One renderer for the player, Wren, NPCs, bandits, smugglers and the drowned captain. Creatures are untouched. Composited strips are cached in a bounded LRU and built off the draw call. `?humans=rig` keeps the procedural rig for animation development only; it is not in the menu. |
| Animation | Painted idle in 8 directions, painted walk and cast in SE and SW. Everything else uses the approved fallbacks in the contract (standing frame + step bob or strike lunge; old corpse drawing for death). Ghosts are the painted figure in ghost colours. An interrupted cast returns to standing at once. |
| NPC variety | The wardrobe (PR #39) still resolves every person's role, region, rank, colours and outfit, but painted mode **cannot show any of it** without layer art. Body type is the only visible difference. The `?dev` inspector lists each person's missing overlays. |
| Character creator | In painted mode: male/female body with a turnable painted preview. Hairstyle, hair colour, beard, skin and clothing colours are listed as "coming with the layered art" and become selectable automatically once their layers are registered. New characters also get a stable seeded identity for those options. Skills and stats are untouched. |
| Paper doll | Same appearance state as the world. No portrait-specific paperdoll art exists, so it shows the painted front frame at an exact 2× (interim). |
| Saves | No format change. `look.body/skin/hair/style/beard/wv` are saved. Old saves without them get the same seeded values on every load (tested). |
| Weapons | `SF.WEAPONS` re-audited on current main: the same 16 ids (sword, glaive, battleaxe, hatchet, knife, pickaxe, hammer, mace, waraxe, dagger, kryss, spear, shortbow, crossbow, heavycrossbow, unarmed). All 16 map to rig animations. **None** has painted art. |

## Exactly what is missing (painted art)

1. **Body animation frames** (per body, male and female):
   - walk and cast in S, W, NW, N, NE, E (24 rows; listed in the manifest);
   - a true painted SW (the current SW is mirrored SE, which swaps handedness);
   - run, ready;
   - all 13 weapon attacks (unarmed, slash1h/2h, chop1h/2h, blunt1h/2h, thrust1h/2h, polearm, staff, bow, crossbow) × 8 directions;
   - cast2h, caststaff;
   - block, hit, death, corpse;
   - gathering and crafting: mine, chopwood, smith, fish, bandage.
2. **Base bodies without clothes or hair:** male and female, every action above, plus skin-tone tint masks.
3. **Hair layers:** the 8 styles (bald excepted) × front/back × every frame; **beards** (stubble, goatee, short, full).
4. **Clothing layers with dye masks:** shirt, trousers, shoes, boots, belt, robe, tabard, cloak (front and back parts), cloth cap,
   cloth gloves; plus the wardrobe overlays (aprons, vest, skirt, dress, hats, hood, headscarf, sash, pouch, mantle, rank trim, crest,
   heraldic devices).
5. **Armour layers with primary/secondary/fixed masks**, one per item id for all 56 equipment definitions plus the buckler:
   - leather, studded, bone, ringmail, chain, plate and dragon pieces, the 6 helmets;
   - the 5 shields, jewelry.
6. **Weapons:** 15 weapon shapes plus the cosmetic NPC props, with **hand sockets** per frame (grip and projectile origin).
7. **Paperdoll portrait layers** (384×512) for the same pieces.
8. **One consistent style:** the walk/cast set is softer (anti-aliased, no dark outline, longer hair) than the idle set and should be
   repainted to match before release.

Machine-readable lists: `assets/humans/painted-v2.1/manifest.json` (`missing`) and `docs/wardrobe/missing-art.json`.

## Tests run on v0.32

- `node tests/humans.test.js`: all pass (contract, registry, fallbacks, direction order, synthetic mixed-armour composition with
  per-piece tints, helmet occlusion, two-handed shield rule, missing overlays reported, not faked).
- `python3 tests/humans-smoke/run.py`: all pass. It covers:
  - the flag;
  - 8 human kinds × 8 directions drawn from painted art;
  - walk/cast mapping and 8 distinct SE walk frames;
  - cast interruption;
  - plate equip reported missing;
  - ghosts, and creatures not routed through the human renderer;
  - save/load and an old save;
  - creator body choice;
  - 60 painted people (frame median ≈17 ms vs ≈17 ms classic);
  - paper doll, plus phone/desktop day/night screenshots.
- Existing node tests (`rules`, `equipment`, `magery`, `combat`, `world`, `wardrobe`): all pass. Browser suites: see the PR.
