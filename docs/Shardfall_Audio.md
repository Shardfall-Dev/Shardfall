# Shardfall audio

Sound pack **v1.0.0** (107 events, 249 takes), integrated in game build **v0.17**.

## Files

- `assets/audio/manifest.json` — event IDs → alternative takes (paths relative to `assets/audio/`) and linear mix gain. `releaseVersion` is the pack version.
- `assets/audio/sfx/*.wav` — mono 16-bit PCM, 32 kHz. Each WAV already contains every timed layer of the sound (a door's handle, bolt and hinge are one file).
- The MIDI performances, `Shardfall_Foley_v1.0.0.sf2` SoundFont, key map and preview MP3 ship with the pack ZIP for editing only. They are not in the game or the repo. To edit, open a `.mid` in a sampler/DAW with that SoundFont, bank 0, keeping the programs and channels in the file (a generic bank plays different sounds).

## Build

`./build.sh 0.17` runs `tools/embed_audio.py`, which embeds the manifest and every WAV (base64, keyed by the exact manifest path) into the HTML, plus each take's loudest-moment offset (`peak`) and length (`dur`). The built file plays offline. A hosted build can drop `SFX_DATA` and serve `assets/audio/` beside the page; `src/audio.js` then fetches the same paths.

## Runtime

- `src/audio.js` (`window.SFXA`) — the engine: one shared AudioContext, master gain 0.70 × manifest gain, SFX / ambience / music buses, lazy decode once per take with a cache, a new BufferSource per playback, 14 voices with priority stealing (UI › strikes, danger cues and doors › actions › footsteps › ambience), audio-only randomness and no repeated take per emitter. Unlocks from the first trusted pointer, touch or key anywhere on the page (HUD included). Mute fades the master immediately and cancels pending sounds; backgrounding suspends the context and drops pending sounds; a sound whose take decodes after its moment is dropped.
- `src/game.js`, sound section — what plays where. World sounds pan by screen X, fade with distance and cull at 18 m (28 m for blasts, the boss bell, Saltstorm, the beacon and the bell landmark). Hidden creatures, other dungeon levels and rooms out of sight make no sound.

## What triggers what

| Area | Cues |
|---|---|
| Weapons | `weapon.draw`/`weapon.stow` on committed draw/stow; `swing.*` by weapon family, scheduled so the loudest moment lands on the contact frame (`P.swing.t1`); `bow.release`/`crossbow.release` at ammo use |
| Impacts | one owner (`hitSound`): `hit.bone` drowned skeletons, `hit.armor` shells and plate (snapper, wreck crab, sentinel, captain, Bellkeeper; the player in chain/plate), `hit.blunt` hammer or fists on soft targets, else `hit.flesh`; `block.shield` on a resolved shield block. Whiffs, spells, poison ticks and area damage make no impact sound |
| Player | `player.hurt` (rate-limited; quieter for poison), `player.death` instead of hurt on a lethal blow, `player.revive` |
| Creatures | `<species>.alert` entering aggro on the player, `<species>.attack` on the telegraph (else `combat.warn`), `rat.death`/`skeleton.death` in `killMon`; `boss.bell` on the Bellkeeper's slam telegraph, `combat.blast` for the slam and cinder flasks |
| Doors | the six kit doors toggle with Interact, E or a tap on the leaf: `door.wood.open`/`close` once per real change. Iron doors, locked, knock and gate chain are reserved |
| Chests, locks, traps | `lock.pick` at the attempt, `door.unlock` on success, `chest.open` as the lid opens (reopening an open chest's panel is `ui.open`), `trap.set`, `trap.spring`. `chest.close` is reserved |
| Footsteps | two per Walk-clip cycle; deck and floor first (boardwalk and timber floors wood, flagstone stone), then the ground (cobble stone, grass, dirt, sand, mud, shallow water). Softer while hidden; none while idle, blocked or a ghost |
| Magic | `magic.prepare` on reaching held, `magic.fizzle` on fizzle or interruption, `magic.release` at launch of travelling spells, element at the target or ground point (see `SPELL_SND`) |
| Work | `gather.mine`/`chop`/`forage` per stroke (yield or not), `fish.cast`/`fish.catch`, `skin.cut`, `craft.*` by recipe skill and station per resolved attempt, `craft.fail` on failure |
| Inventory and UI | `loot.rummage` opening a corpse, one `loot.coin` per gold transfer (Take All aggregates), `item.equip`/`drink`/`bandage`/`eat`, `ui.open`/`close`/`page` on deliberate panel changes only, `skill.gain` (≤ 1 per 1.5 s), bard songs, `quest.accept`/`complete`, `world.beacon` |
| Ambience | sparse one-shots: surf and gulls by the water, drips underground, hearth near fires and forges, marsh in the wetlands, wind on the headland and in the pines, the bell near the Sunken Bell (not again while you stand still). Rain is reserved until there is weather |

## Versioning sound releases

Every sound release gets `vMAJOR.MINOR.PATCH`, carried in the ZIP, every audio filename, the MIDI, SoundFont, preview and handoff. The take number stays separate (`door.wood.open_01_v1.0.0.wav`). Update `releaseVersion` and every asset path in the manifest together; keep compatible event IDs stable. Patch = fixes, minor = added sounds, major = breaking event changes.
