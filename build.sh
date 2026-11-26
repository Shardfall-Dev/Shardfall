#!/bin/sh
# Assemble the single-file game from src/. Usage: ./build.sh 0.17  → Shardfall_v0.17.html
# Order matters: rules (SF) → magery rules (SF.MAGERY) → sound pack + player (SFXA) → assets (opens the game block) → magery art → magic → game.
# tools/embed_audio.py embeds assets/audio/ (manifest + WAVs) so the built file plays offline;
# a hosted build can serve assets/audio/ beside the page instead.
set -e
V="${1:?usage: ./build.sh <version>}"
cd "$(dirname "$0")"
python3 tools/embed_audio.py assets/audio > .sfx_embed.tmp
cat src/head.html src/rules.js src/magery.js .sfx_embed.tmp src/audio.js src/assets.js src/magery-art.js src/magic.js src/game.js > "Shardfall_v$V.html"
rm -f .sfx_embed.tmp
echo "built Shardfall_v$V.html"
