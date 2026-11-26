# Shardfall · Saltmarsh soundtrack

Five original cues for the browser game, composed and arranged for a late-1990s General MIDI sound.

| Cue | Scene | Instrumentation |
| --- | --- | --- |
| Saltmarsh Home | Arrival and safe village streets | Harp, pan flute, strings and soft bassoon |
| Lanterns on the Quay | Dockside trading and evening bustle | Nylon guitar, flute, clarinet and quiet pizzicato |
| Mist on the Causeway | Marsh exploration in low light | Harp, recorder, strings and English horn |
| The Empty Watch | Ruins and the skeleton approach | Harp, oboe, cello and distant tubular bells |
| Beyond the Tidegate | Leaving the island hub and finding the road | Harp, piccolo, strings and a restrained French horn |

## Web integration

Use the stereo MP3 files in `MP3/` and the matching paths in `soundtrack.json`. Start music after the player's first interaction, using the game's existing audio manager and a separate music volume. Use one active cue at a time and crossfade briefly when changing areas.

Every MP3 is a full loop. For a continuous loop, decode with Web Audio, set `loop = true`, and loop from 0 to the decoded buffer's duration. The JSON also supplies reference duration and sample count before decoding. An HTML audio element with `loop` works for simpler playback where a device-dependent seam is acceptable.

`MIDI/` contains editable type-1 General MIDI files with tempo, five instrument tracks and explicit `LOOP_START` and `LOOP_END` markers. MIDI playback needs a synthesizer. Each MP3 is a render of its matching arrangement.
