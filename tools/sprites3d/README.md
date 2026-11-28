# 3D → sprites (pipeline v1.0.0)

Human characters and their armour come from a 3D model rendered into 2D frames, so every direction and every frame matches by construction. (Painted classic RPG art was often made this way too.) Each armour piece is rendered as its **own layer** on the same canvas, with a material mask, so the game can stack any mix of gear and recolour it per material: one plate render covers iron, valorite, mithril and every other metal.

```
Blender scene (.blend)  →  sf_render.py (in Blender)  →  render_out/  →  sf_pack.py  →  Shardfall_Human3D_vX.zip  →  the game
```

The output contract is the one the painted human path already uses: **128×128 cells, feet at (64, 106)**, rows **S SW W NW N NE E SE**, one sheet per layer and action (columns = frames), and masks with R = primary material, G = secondary, B = fixed.

## What you need

- **Blender 4.2 or newer** (free, blender.org). Your RTX 4090 renders a full set in minutes.
- **A rigged human with animations.** The easy source is **Mixamo** (free with an Adobe account):
  - Character: pick one, or upload your own model and let Mixamo rig it. Download as FBX Binary, **With Skin**.
  - Animations, on the same character: download each as FBX, **Without Skin**, with **In Place** ticked (very important for walking). To start: *Breathing Idle* and *Walking*. Later: an attack, *Hit Reaction*, *Dying*, a casting animation.
- **Armour as 3D pieces.** Plate is easiest because it is rigid (no bending). It can come from an asset store, Sketchfab (check the licence), a medieval armour kit, or an AI 3D-model generator working from a reference image. One mesh per game slot: chest, arms, gauntlets, leggings, helmet.

## Set up the scene (once)

1. **New scene**, delete the default cube, camera and light. The script makes its own camera and lights.
2. **File → Import → FBX:** the character (With Skin). It comes in facing −Y (towards Blender's front view), which the script calls "S". If yours faces another way, set `facing_offset_deg`.
3. **Import each animation FBX**, then in the Action editor (Dope Sheet → Action Editor) rename its action to `Idle`, `Walk`, … matching `config.json`. Click the **shield icon (Fake User)** on each action so it survives. Then delete the extra armatures the animation imports bring in; keep only the actions. All actions must play on the one armature.
4. **Collections, one per layer** (Outliner → right-click → New Collection), named exactly like the layer ids in `config.json`:
   - `body`: the character mesh(es). Plain clothes or underwear only, **no hair** for now (hair will become its own layer).
   - `plate_chest`, `plate_arms`, `plate_gauntlets`, `plate_legs`, `plate_helm`: one armour piece each.
   - **Do not put the armature inside a layer collection** (leave it in the scene collection).
5. **Fit each rigid armour piece** over the body in the **rest pose** (Armature → Pose → Rest Position). Then give it a custom property (Object properties → Custom Properties → New): `sf_bone` = the bone it follows. Mixamo bone names: `mixamorig:Spine2` (chest), `mixamorig:Head` (helm), `mixamorig:LeftArm` / `mixamorig:RightArm` (upper arms), `mixamorig:LeftForeArm` / `mixamorig:RightForeArm`, `mixamorig:LeftHand` / `mixamorig:RightHand` (gauntlets), `mixamorig:LeftUpLeg` / `mixamorig:LeftLeg` (thigh / shin, the same on the right), `mixamorig:LeftFoot`. Split pieces that span two bones (a sleeve over the upper arm and forearm) into two objects. The script parents them for you.
   - **Bending pieces** (cloth, leather, chain, a robe): select the piece, then the body, *Object → Parent → With Automatic Weights*, or *Data Transfer → Vertex Groups* from the body. No `sf_bone` needed.
6. **Material masks (optional):** a material's custom property `sf` = `primary` (the main metal, hide or cloth, which is the default), `secondary` (studs, trim, a bow's string), or `fixed` (gems, rope, anything that never recolours). Paint the armour in a **neutral grey steel**; the game recolours it per material.
7. **Save** the .blend, and put `config.json` beside it (copy `config.example.json`, then edit the armature name and actions).

## Render

```
blender -b knight.blend -P tools/sprites3d/sf_render.py -- --config config.json --preview
```

`--preview` renders one frame per action and direction, which is the quick check. Look in `render_out/body/Walk/S/00.png`: the feet should touch the bottom area, the figure about 72 px tall in a 256 px image (2× supersampling). Then run it without `--preview` for the full set. Other options: `--only body,plate_chest`, `--actions Walk`, `--dirs S,E`, `--no-masks`.

On Windows the command is `"C:\Program Files\Blender Foundation\Blender 4.2\blender.exe" -b knight.blend -P ...`.

## Pack and check

```
python3 tools/sprites3d/sf_pack.py render_out
```

This needs Python with Pillow. Or skip it: **zip `render_out` and give it to Claude**, who packs it, checks it and wires it into the game.

`sf_pack` scales the frames to 128×128, adds the 1 px dark outline of the painted style, packs one sheet per layer and action with matching mask sheets, writes `manifest.json`, `preview.png` and `Shardfall_Human3D_v<version>.zip`, and checks:
- the feet sit on the anchor row;
- the figure height stays steady and matches `figure_px`;
- no frames are missing;
- every armour pixel has a material weight.

Problems are listed in the manifest, and the exit code is 1.

## Settings (`config.json`)

| key | meaning |
|---|---|
| `cell`, `anchor` | the game contract, 128×128 with the feet at (64, 106). Keep these. |
| `figure_px`, `figure_height_m` | how tall a figure of that height is in pixels (72 px matches the painted sets) |
| `elevation_deg` | camera height. 30° matches the game's 2:1 isometric ground. |
| `supersample` | renders at 2× and scales down for clean edges |
| `outline`, `alpha_cut` | the painted-style outline colour (null for none); `alpha_cut` 110 makes hard pixel-art edges |
| `layers[].holdout` | what hides this layer. Default: armour is hidden behind the body (the far arm's gauntlet behind the torso), and the body hides nothing. |
| `layers[].slot`, `items`, `z` | the game slot, the item ids it draws, and the draw order |
| `actions[].frames`, `loop`, `range`, `fps` | frames sampled evenly over the action (or `range: [start, end]`), playback speed |

## First test (the plan)

1. One body, Idle (4 frames) and Walk (8 frames), 8 directions.
2. The plate set as 5 layers on top.
3. Pack it, check it, and look at it in the game behind the developer flag.

If it holds up, the next steps are the other armour families, clothes, hair styles, weapons, the female body and more animations, each as its own layer.

## Files

- `sf_render.py`: the Blender script (camera, lights, holdouts, mask pass, directions, frame sampling, rigid attach)
- `sf_pack.py`: the packer and checker (Python 3 + Pillow)
- `config.example.json`: the first test's config
- `test_pack.py`: tests for the packer with synthetic frames (`python3 tools/sprites3d/test_pack.py`)
