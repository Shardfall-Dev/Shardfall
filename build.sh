#!/bin/sh
# Assemble the game from src/.
#   ./build.sh 0.18            → Shardfall_v0.18.html          web build (small; sound and music load from assets/audio/web/)
#   ./build.sh 0.18 --offline  → Shardfall_v0.18_offline.html  one big file with every sound embedded, plays from disk; not committed
# The web build needs to be served (GitHub Pages, or `python3 -m http.server` in this folder): opened straight
# from disk the game runs but stays silent. After changing any sound, run tools/encode_web_audio.sh first.
# Order matters: rules (SF) → magery rules (SF.MAGERY) → world simulation core (SIM) → sound pack + player (SFXA) → assets (opens the game block) → magery art → bestiary art → backpack icons → magic → Anniabreen (world, travel, stretch) → frontier (Southern Reach, camps, dungeon sites) → Living World runtime (clock, light, navigation, dev panel) → ecosystem (species, factions, populations) → game.
# src/bestiary-art.js is generated: python3 tools/embed_bestiary.py
# src/backpack-icons.js is generated: python3 tools/embed_backpack_icons.py
set -e
V="${1:?usage: ./build.sh <version> [--offline]}"
cd "$(dirname "$0")"
if [ "$2" = "--offline" ]; then OUT="Shardfall_v${V}_offline.html"; MODE=""; else OUT="Shardfall_v$V.html"; MODE="--hosted"; fi
python3 tools/embed_audio.py assets/audio $MODE > .sfx_embed.tmp
cat src/head.html src/rules.js src/magery.js src/world.js .sfx_embed.tmp src/audio.js src/assets.js src/magery-art.js src/bestiary-art.js src/backpack-icons.js src/magic.js src/anniabreen.js src/frontier.js src/living.js src/ecology.js src/game.js > "$OUT"
rm -f .sfx_embed.tmp
echo "built $OUT ($(du -h "$OUT" | cut -f1))"
