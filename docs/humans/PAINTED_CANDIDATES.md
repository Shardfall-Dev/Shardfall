# Painted Human Candidates v0.1 — integration status

**Status: experimental, developer flag only. Not approved for production.** Nothing changes for players without `?dev`.

Source: `asset-packs/painted-human-candidates-v0.1/Shardfall_Painted_Candidates_v0.1.zip` (SHA-256 `17b1b497…c7b1`, checked by the tool), handed off in `CLAUDE_HANDOFF.md` on `art/painted-human-candidates-v0.1`. Integrated on top of #38 (`SF.GEAR`, the layered human rig and Medieval Equipment Art), as chosen on 2026-11-27.

## Atlas contract

The pack matches the existing Saltmarsh Scout animation sheets exactly: 128×128 cells, feet anchor (64,106), rows S SW W NW N NE E SE, drawn 1:1 with nearest-neighbour. So the painted body stands on the same ground point and at the same scale as today's player sprite. Each sheet is 3 columns (candidate poses) × 8 rows.

## How it is wired

| file | what it does |
|---|---|
| `tools/painted_candidates.py` | reads the ZIP in memory, checks the hash and manifest, runs the automatic checks, merges `review.json`, writes `qa.json` and `missing.json`; `--embed` writes `src/painted-art.js`; `--check` fails if any of them is stale |
| `assets/humans/painted-candidates-v0.1/review.json` | the manual verdicts (facing, pose, cropping, borderline background remnants) with a reason for each |
| `assets/humans/painted-candidates-v0.1/qa.json` | every one of the 192 frames: status, reasons, warnings and metrics (bbox, feet row and x, dark pixels, specks, islands) |
| `assets/humans/painted-candidates-v0.1/missing.json` | the art still needed (directions with no accepted frame, missing actions, missing layers). `complete` is empty on purpose |
| `src/painted-art.js` | generated: the 8 sheets with **only accepted cells** (rejected cells are transparent), the accepted map and the rejection reasons |
| `src/painted.js` | `SF.PAINTED`, pure: `eligible(R, mode)`, `frame(body, rigAction, rigFrame, dir)`, `coverage()` |
| `src/painted-render.js` | `drawPaintedActor` (called in `drawEnt` before the layered renderer), the PAINTED developer button, inspector and atlas preview |

**One path for every human.** The player, Wren, townsfolk, guards and human enemies all call `drawPaintedActor`. It uses the same appearance (`gearOfActor` → `SF.GEAR.resolve`: real equipment for the player and Wren, cosmetic presets for NPCs) and the same pose (`gearPose`: the player's clip, or an NPC's state) as the layered renderer. Body type comes from character creation. If it returns false, the actor is drawn by whatever drew it before (the layered renderer with `?gear=new`, otherwise the Scout sprite).

**Rig action → painted action:** `idle` → Idle, `walk` → Walk, `unarmed` → Unarmed_Attack, `cast1h` / `cast2h` / `caststaff` → Cast (unsplit). Every other state has no painted art and falls back: run, ready, hit, death, corpse, ghost, every weapon attack, block, mining, woodcutting, fishing, smithing, bandaging.

**Frames:** the rig frame maps proportionally onto the accepted poses in their original order, so with three accepted poses a walk steps 0,0,0,1,1,1,2,2. With fewer accepted poses, fewer play. A direction with none falls back. Nothing is mirrored, borrowed from a neighbouring direction, duplicated in the data or interpolated.

## Flags

- `?dev&painted=strict` (or `painted=1`): painted body only when the actor wears nothing **and** an accepted frame exists for that state and direction. No equipment, clothing, hair or weapon overlays exist for these bodies, so any worn item keeps the actor on the existing renderer. In practice, that means a stripped player or Wren. NPC presets always carry gear.
- `?dev&painted=bodies`: a QA view to judge scale, anchor and facing in the world. It draws the bare painted body **even when gear is worn**, so it hides equipment on purpose. It is never a gameplay mode.
- `?painted=…` without `?dev` does nothing. The PAINTED button next to DEV switches mode (not saved) and shows why you are or are not drawn painted, the fallback counts and the atlas preview (rejected cells crossed out; hover a cell for its verdict).

Saves, items, stats, combat timing, casting, the paper doll and character creation are untouched. Nothing new is written to saves.

## QA rules

Automatic (every frame): the loose PNG equals the sheet cell; the figure doesn't touch the cell edge; the lowest opaque row is 105 (feet on the anchor); no detached alpha island of 4 px or more; fewer than 10 near-black pixels (max channel < 48) in the leg band y 66–105 (baked background); fewer than 3 near-black specks on the ground band y 100–105; no duplicate cells. Warnings (not rejections): semi-transparent pixels, 1–2 specks, feet centre more than 8 px off the anchor, foot or head registration differing by more than 5 px between candidates of one direction.

Manual (`review.json`, 4× zoom): facing, pose, cropping, and a visual call on borderline background counts (3 accepted despite the metric where it came from leg shading; 3 rejected under the threshold where the remnant is visible at 1×).

## Result: 101 accepted, 91 rejected

Reasons (a frame can have several): baked dark background 59 · wrong facing 31 · background visible under the threshold 3 · no attack pose 3 · specks at the feet 1 · cropped head 1 · detached island 1.

**bold** = accepted, ~~struck~~ = rejected (bg = baked background, facing, pose, crop, island, specks).

| body / action | S | SW | W | NW | N | NE | E | SE | accepted |
|---|---|---|---|---|---|---|---|---|---|
| male Idle | ~~0~~ bg<br>~~1~~ bg<br>~~2~~ bg | **0**<br>**1**<br>**2** | ~~0~~ bg<br>~~1~~ bg<br>**2** | ~~0~~ bg<br>~~1~~ bg<br>~~2~~ bg | ~~0~~ bg<br>~~1~~ bg<br>~~2~~ bg | ~~0~~ bg/facing<br>~~1~~ bg/facing<br>~~2~~ facing | ~~0~~ bg<br>~~1~~ bg<br>~~2~~ bg | **0**<br>**1**<br>~~2~~ bg | 6/24 |
| male Walk | ~~0~~ bg<br>~~1~~ bg<br>~~2~~ bg | **0**<br>**1**<br>**2** | **0**<br>**1**<br>~~2~~ bg | ~~0~~ facing<br>~~1~~ bg/facing<br>~~2~~ facing | ~~0~~ bg<br>~~1~~ bg<br>~~2~~ bg | ~~0~~ facing<br>~~1~~ facing<br>~~2~~ facing | **0**<br>**1**<br>**2** | **0**<br>**1**<br>**2** | 11/24 |
| male Cast | ~~0~~ bg<br>~~1~~ bg<br>~~2~~ bg | **0**<br>**1**<br>**2** | **0**<br>**1**<br>**2** | **0**<br>**1**<br>**2** | ~~0~~ bg<br>**1**<br>**2** | ~~0~~ facing<br>~~1~~ bg/facing/specks<br>~~2~~ facing | **0**<br>~~1~~ bg<br>~~2~~ crop | **0**<br>~~1~~ island<br>**2** | 14/24 |
| male Unarmed_Attack | ~~0~~ bg<br>~~1~~ bg<br>~~2~~ bg | **0**<br>**1**<br>**2** | **0**<br>**1**<br>**2** | ~~0~~ facing<br>~~1~~ bg<br>~~2~~ bg | ~~0~~ bg<br>~~1~~ bg<br>~~2~~ bg | ~~0~~ facing<br>~~1~~ facing<br>~~2~~ facing | **0**<br>**1**<br>**2** | **0**<br>**1**<br>**2** | 12/24 |
| female Idle | ~~0~~ bg<br>~~1~~ bg<br>~~2~~ bg | ~~0~~ bg(visual)<br>~~1~~ bg<br>**2** | **0**<br>**1**<br>**2** | **0**<br>~~1~~ bg<br>**2** | ~~0~~ bg<br>~~1~~ bg<br>~~2~~ bg | ~~0~~ facing<br>~~1~~ facing<br>~~2~~ facing | **0**<br>**1**<br>~~2~~ bg(visual) | **0**<br>**1**<br>~~2~~ bg | 10/24 |
| female Walk | ~~0~~ bg<br>~~1~~ bg<br>~~2~~ bg | **0**<br>**1**<br>**2** | **0**<br>**1**<br>**2** | **0**<br>**1**<br>**2** | **0**<br>~~1~~ bg(visual)<br>~~2~~ bg | ~~0~~ facing<br>~~1~~ facing<br>~~2~~ facing | **0**<br>**1**<br>**2** | **0**<br>**1**<br>**2** | 16/24 |
| female Cast | ~~0~~ bg<br>~~1~~ bg<br>~~2~~ bg | **0**<br>**1**<br>**2** | **0**<br>**1**<br>**2** | **0**<br>**1**<br>**2** | **0**<br>**1**<br>**2** | ~~0~~ facing<br>~~1~~ facing<br>~~2~~ facing | **0**<br>**1**<br>**2** | **0**<br>**1**<br>**2** | 18/24 |
| female Unarmed_Attack | ~~0~~ bg/pose<br>~~1~~ bg/pose<br>~~2~~ bg/pose | **0**<br>**1**<br>**2** | **0**<br>**1**<br>**2** | ~~0~~ facing<br>~~1~~ facing<br>~~2~~ facing | ~~0~~ bg<br>**1**<br>**2** | ~~0~~ facing<br>~~1~~ facing<br>~~2~~ facing | **0**<br>**1**<br>**2** | **0**<br>**1**<br>**2** | 14/24 |

### What that means in the game
- **No body has an accepted frame facing S, in any action.** S is the most common facing, so even in strict mode a bare character flips between painted and existing art as it turns.
- **No body has an accepted frame facing NE.** Every NE row is a right-facing profile with the face showing.
- Male Idle has only SW, W and SE. Male Walk has SW, W, E and SE. Female Cast is the most complete (7 directions).
- Male Cast and Unarmed_Attack look almost identical. Female Unarmed_Attack S shows no strike.
- Idle side views are painted mid-stride.

## Remaining art work (see `missing.json`)

1. **Re-export the S and NE rows** for every body and action: S without the background between the legs, NE as a real back three-quarter view. Then male Idle N/NW/E, male Walk N/NW (wrong facing), and male Unarmed N/NW.
2. **Full cycles:** Idle 4, Walk 8, run 8, Unarmed 8, and Cast split into CastPrepare / CastHold / CastRelease. Three candidates per direction are not cycles.
3. **Clean base bodies** without baked hair, plus isolated hair styles and colours, beards and skin-tone masks, so character-creation choices can show.
4. **Overlays aligned to these exact poses:** underwear/shirt/trousers/shoes, every armour slot, robe/tabard/cloak with per-direction occlusion, weapons with hand sockets, shields, and tint masks for material colours. Until they exist, strict mode cannot show any clothed or armed character.
5. Death, corpse, hit, ready, ghost, weapon attacks and tool animations.
6. Paperdoll portrait art matching these bodies (the paper doll still uses #38's fitted doll).

## Tests

- `node tests/painted.test.js Shardfall_v0.32.1.html`: embedded data equals the QA; no duplicated, borrowed or mirrored frames; frame mapping; eligibility from real equipment; NPC presets on the same rule; missing list honest.
- `python3 tests/painted-smoke/run.py Shardfall_v0.32.1.html`: flag off untouched (also `?painted` without `?dev`); strict mode on a bare player (painted where accepted, fallback facing S/N, run, tunic equipped); NPCs fall back; nothing saved; reload; bodies mode on a female character and 58 NPCs; atlas preview and rejection reasons; phone.
- `python3 tools/painted_candidates.py --check` keeps the generated files honest.
