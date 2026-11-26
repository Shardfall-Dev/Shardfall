#!/bin/sh
# Assemble the single-file game from src/. Usage: ./build.sh 0.15  → Shardfall_v0.15.html
set -e
V="${1:?usage: ./build.sh <version>}"
cd "$(dirname "$0")"
cat src/head.html src/rules.js src/assets.js src/game.js > "Shardfall_v$V.html"
echo "built Shardfall_v$V.html"
