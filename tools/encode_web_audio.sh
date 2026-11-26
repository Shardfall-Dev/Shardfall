#!/bin/sh
# Make the small web copies of the sound pack and soundtrack that the hosted game loads.
#   assets/audio/sfx/*.wav           -> assets/audio/web/sfx/*.m4a    (AAC, mono, 48 kb/s)
#   assets/music/v1.0.0/MP3/*.mp3    -> assets/audio/web/music/*.m4a  (AAC, stereo, 96 kb/s)
# The WAVs and MP3s stay the masters; browsers that cannot play AAC fall back to them.
# Re-run after changing any sound: ./tools/encode_web_audio.sh   (needs ffmpeg)
set -e
cd "$(dirname "$0")/.."
out=assets/audio/web
mkdir -p "$out/sfx" "$out/music"
for f in assets/audio/sfx/*.wav; do
  n=$(basename "$f" .wav)
  ffmpeg -nostdin -loglevel error -y -i "$f" -map_metadata -1 -ac 1 -c:a aac -b:a 48k "$out/sfx/$n.m4a"
done
for f in assets/music/v1.0.0/MP3/*.mp3; do
  n=$(basename "$f" .mp3)
  ffmpeg -nostdin -loglevel error -y -i "$f" -map_metadata -1 -vn -ac 2 -c:a aac -b:a 96k "$out/music/$n.m4a"
done
echo "sfx:   $(ls "$out/sfx" | wc -l) files, $(du -sh "$out/sfx" | cut -f1)"
echo "music: $(ls "$out/music" | wc -l) files, $(du -sh "$out/music" | cut -f1)"
