#!/bin/sh
# Assemble the game from src/.
#   ./build.sh 0.18            → Shardfall_v0.18.html          web build (small; sound and music load from assets/audio/web/)
#   ./build.sh 0.18 --offline  → Shardfall_v0.18_offline.html  one big file with every sound embedded, plays from disk; not committed
# The web build needs to be served (GitHub Pages, or `python3 -m http.server` in this folder): opened straight
# from disk the game runs but stays silent. After changing any sound, run tools/encode_web_audio.sh first.
# Order matters: rules (SF) → magery rules (SF.MAGERY) → sound pack + player (SFXA) → assets (opens the game block) → magery art → magic → game.
set -e
V="${1:?usage: ./build.sh <version> [--offline]}"
cd "$(dirname "$0")"
if [ "$2" = "--offline" ]; then OUT="Shardfall_v${V}_offline.html"; MODE=""; else OUT="Shardfall_v$V.html"; MODE="--hosted"; fi
python3 tools/embed_audio.py assets/audio $MODE > .sfx_embed.tmp
cat src/head.html src/rules.js src/magery.js .sfx_embed.tmp src/audio.js src/assets.js src/magery-art.js src/magic.js src/game.js > "$OUT"
rm -f .sfx_embed.tmp
echo "built $OUT ($(du -h "$OUT" | cut -f1))"
