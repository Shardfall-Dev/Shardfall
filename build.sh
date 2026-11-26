#!/bin/sh
# Assemble the single-file game from src/. Usage: ./build.sh 0.15  → Shardfall_v0.15.html
# Order matters: rules (SF) → magery rules (SF.MAGERY) → assets (opens the game block) → magery art → bestiary art → magic → game.
# src/bestiary-art.js is generated: python3 tools/embed_bestiary.py
set -e
V="${1:?usage: ./build.sh <version>}"
cd "$(dirname "$0")"
cat src/head.html src/rules.js src/magery.js src/assets.js src/magery-art.js src/bestiary-art.js src/magic.js src/game.js > "Shardfall_v$V.html"
echo "built Shardfall_v$V.html"
