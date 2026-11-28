#!/bin/sh
# Assemble the game from src/.
#   ./build.sh 0.18            → Shardfall_v0.18.html          web build (small; sound and music load from assets/audio/web/)
#   ./build.sh 0.18 --offline  → Shardfall_v0.18_offline.html  one big file with every sound embedded, plays from disk; not committed
# The web build needs to be served (GitHub Pages, or `python3 -m http.server` in this folder): opened straight
# from disk the game runs but stays silent. After changing any sound, run tools/encode_web_audio.sh first.
# Order matters: rules (SF) → skill engine (SF.SK) → magery rules (SF.MAGERY) → equipment rules (SF.EQ) → attribute locks (SF.STATS) → character creation rules (SF.CREATION) → world simulation core (SIM) → sound pack + player (SFXA) → assets (opens the game block) → magery art → bestiary art → backpack icons → magic → Anniabreen (world, travel, stretch) → frontier (Southern Reach, camps, dungeon sites) → Living World runtime (clock, light, navigation, dev panel) → ecosystem (species, factions, populations) → town life (homes, routines, patrols, the travelling merchant) → NPC combat (townsfolk as combatants, guards fight back) → game → equipment UI (paper doll, backpack, tooltips) → HUD UI (item tooltip and popup, popup manager, target frame) → character creator UI → tail (closes the game block).
# src/bestiary-art.js is generated: python3 tools/embed_bestiary.py
# src/backpack-icons.js is generated: python3 tools/embed_backpack_icons.py
# src/equipment-art.js is generated: python3 tools/embed_equipment_art.py > src/equipment-art.js
# Painted Human Candidates v0.1 (experimental, ?dev&painted=strict): src/painted-art.js is generated (python3 tools/painted_candidates.py --embed); src/painted.js (SF.PAINTED) is pure; src/painted-render.js draws it before the layered renderer.
# Online play (Server Foundation v1): shared/protocol.js (SF_PROTOCOL, the realtime protocol shared with server/) and src/online.js (accounts, roster, alpha lobby) come right before the creator UI, which hooks them into the title screen.
# Equipment appearance: src/gear.js (SF.GEAR, after creation) and src/human-rig.js (HUMAN_RIG) are pure; src/gear-render.js draws them (after the equipment UI).
set -e
V="${1:?usage: ./build.sh <version> [--offline]}"
cd "$(dirname "$0")"
if [ "$2" = "--offline" ]; then OUT="Shardfall_v${V}_offline.html"; MODE=""; else OUT="Shardfall_v$V.html"; MODE="--hosted"; fi
python3 tools/embed_audio.py assets/audio $MODE > .sfx_embed.tmp
cat src/head.html src/rules.js src/skills.js src/magery.js src/equipment.js src/stats.js src/creation.js src/wardrobe.js src/gear.js src/human-rig.js src/painted-art.js src/painted.js src/world.js .sfx_embed.tmp src/audio.js src/assets.js src/magery-art.js src/bestiary-art.js src/backpack-icons.js src/equipment-art.js src/magic.js src/anniabreen.js src/frontier.js src/living.js src/ecology.js src/townlife.js src/npcfight.js src/game.js src/equipment-ui.js src/hud-ui.js src/gear-render.js src/painted-render.js shared/protocol.js src/online.js src/creation-ui.js src/tail.html > "$OUT"
rm -f .sfx_embed.tmp
echo "built $OUT ($(du -h "$OUT" | cut -f1))"
