# Shardfall — Classic human sprite migration v1

Repository: https://github.com/Shardfall-Dev/Shardfall

Replace the existing manga/anime human character visuals with original, grounded late-1990s isometric medieval RPG artwork inspired by classic Ultima Online. Keep all existing monster art and gameplay intact. Inspect the current asset layout, player/NPC renderer, animation controller, and character creation before changing any code.

## Provided assets
The separate Shardfall_Classic_Humans_v1.zip contains original source art, cleaned PNG atlases and JSON manifests. The primary atlas is classic_humans_idle_v1.png (384×160 px, 8 columns × 2 rows, frame size 48×80 px). Top row male, bottom row female. Direction columns are screen-space S, SW, W, NW, N, NE, E, SE. Foot anchor is (24,76) measured from cell top-left; compact alternate is 256×128, 32×64 cells, anchor (16,60). Choose one atlas consistently and use nearest-neighbor rendering. The generated images are idle references only; no actual movement or attack frames are included.

## Implementation
- Extract/copy the atlas and manifest into the existing asset structure; do not assume paths or overwrite monster files. Select sprite by character body type and projected facing; support old saves by defaulting missing body type to the existing appearance/default male.
- Use the same human body renderer for the player, merchants, guards, villagers, trainers and hostile humans. Preserve identity, AI, quests, interactions, movement, collision, targeting, depth sorting, combat timing, skills, stats, equipment and inventory.
- Integrate both bodies into character creation and paperdoll preview without changing skill or stat allocation. Male/female appearance must confer no gameplay advantage.
- Match the human scale to the existing world tiles and monsters, preserve ground anchor, interpolate movement independently of animation and disable texture smoothing where appropriate.
- Use muted earthy colors, adult human proportions, small natural heads, realistic clothing, consistent lighting and transparent backgrounds. No manga faces, giant heads, modern clothes, oversized weapons or outlines.
- Build role-specific variants for guards, blacksmiths, miners, farmers, healers, merchants, mages, sailors and bandits. Use a reusable layer-ready model for future hair, clothing, armor and weapons. Until layered art is available, do not draw incorrect equipment or promise equipment visuals.
- Prepare actual eight-direction walking/running, combat-ready stance, unarmed and weapon attacks (one-handed, two-handed, ranged), casting, hit reactions, death, corpse, gathering and crafting frames for both bodies. Existing animation logic may be retained, but do not claim idle frames are full animations. Temporarily use stable idle fallback for any missing state; do not distort or slide limbs to fake finished animation.
- Use atlas metadata, async preloading, deterministic animation timing and shared sprite state; no per-NPC image duplication. Keep rendering separate from simulation and save data for eventual multiplayer.
- Audit old manga asset references before removing unused art. Do not remove any still referenced asset. Test all eight directions, anchors, movement, combat and death, character creation, NPC interaction, save/load, old saves, paperdoll and monster regressions on desktop and mobile.

Commit only tested changes and report exact files, asset paths, missing animations and any blockers. Keep original artwork and the handoff separate from unrelated gameplay changes.
