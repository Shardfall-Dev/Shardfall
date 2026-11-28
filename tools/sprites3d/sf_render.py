"""Shardfall 3D → sprite renderer (Blender 4.2+), pipeline v1.0.0.

Renders a rigged 3D character into Shardfall sprite frames: every layer (body, each armour piece, weapon ...) on its own
transparent canvas, in 8 directions, for every animation, plus a material mask per frame (R = primary material, G = secondary,
B = fixed). tools/sprites3d/sf_pack.py then packs the frames into sheets, checks them and writes the manifest the game reads.

Run (from the folder that holds your .blend and config):
    blender -b character.blend -P /path/to/tools/sprites3d/sf_render.py -- --config config.json
Options after "--":  --config FILE   (required)
                     --only LAYER[,LAYER]   render only these layers
                     --actions NAME[,NAME]  render only these animations
                     --dirs S,SW,...        render only these directions
                     --no-masks             skip the mask pass
                     --preview              one frame per action and direction (a quick check)

How the .blend must be organised (see tools/sprites3d/README.md):
  * One armature (the rig). Every mesh of the character is a child of it (or of a bone, for rigid armour).
  * One top-level collection per layer, named exactly like the layer ids in the config ("body", "plate_chest", ...).
  * Each animation is a Blender action on the armature (Mixamo: one FBX per animation, imported and renamed).
  * Optional per material (or per object) custom property  sf = "primary" | "secondary" | "fixed"  (default primary).

The camera, lights and render settings are created by this script; nothing in your scene is overwritten except the
armature's rotation and action while rendering (restored at the end)."""
import bpy, json, math, os, sys
from mathutils import Vector

DIRS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']
# rotation of the character about Z for each direction, degrees. S = facing the camera (Blender -Y); positive = counter-clockwise
DIR_DEG = {'S': 0, 'SW': -45, 'W': -90, 'NW': -135, 'N': 180, 'NE': 135, 'E': 90, 'SE': 45}


def args():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    o = {'config': None, 'only': None, 'actions': None, 'dirs': None, 'masks': True, 'preview': False}
    i = 0
    while i < len(a):
        k = a[i]
        if k == '--config': o['config'] = a[i + 1]; i += 1
        elif k == '--only': o['only'] = a[i + 1].split(','); i += 1
        elif k == '--actions': o['actions'] = a[i + 1].split(','); i += 1
        elif k == '--dirs': o['dirs'] = a[i + 1].split(','); i += 1
        elif k == '--no-masks': o['masks'] = False
        elif k == '--preview': o['preview'] = True
        i += 1
    if not o['config']: raise SystemExit('sf_render: --config FILE is required')
    return o


def load_config(path):
    c = json.load(open(path))
    c.setdefault('cell', [128, 128]); c.setdefault('anchor', [64, 106]); c.setdefault('supersample', 2)
    c.setdefault('elevation_deg', 30.0)          # 30° above the horizon = the game's 2:1 isometric ground
    c.setdefault('figure_height_m', 1.8); c.setdefault('figure_px', 72)
    c.setdefault('facing_offset_deg', 0.0)       # if your rig does not face -Y in rest pose
    c.setdefault('out', 'render_out'); c.setdefault('engine', 'eevee')
    # sun_dir: the direction the sunlight travels in camera-facing world space (x right, y away from the camera, z up);
    # the default comes from the screen's top left and a little in front, like the painted art
    c.setdefault('light', {'sun_dir': [1.0, 0.6, -1.2], 'strength': 3.5, 'fill': 0.6})
    for L in c['layers']: L.setdefault('holdout', [] if L['id'] == 'body' else ['body'])
    for A in c['actions']: A.setdefault('loop', True)
    base = os.path.dirname(os.path.abspath(path)); c['out'] = os.path.join(base, c['out'])
    return c


def find_layer_collection(lc, name):
    if lc.name == name: return lc
    for ch in lc.children:
        r = find_layer_collection(ch, name)
        if r: return r
    return None


def armature(c):
    if c.get('armature'): return bpy.data.objects[c['armature']]
    arms = [o for o in bpy.data.objects if o.type == 'ARMATURE']
    if len(arms) != 1: raise SystemExit('sf_render: set "armature" in the config (found %d armatures)' % len(arms))
    return arms[0]


def set_engine(scene, want):
    items = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
    order = ['BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE'] if want == 'eevee' else ['CYCLES']
    for e in order:
        if e in items: scene.render.engine = e; return e
    scene.render.engine = items[0]; return items[0]


def setup_scene(c):
    sc = bpy.context.scene
    eng = set_engine(sc, c['engine'])
    r = sc.render; k = c['supersample']
    r.resolution_x, r.resolution_y = c['cell'][0] * k, c['cell'][1] * k; r.resolution_percentage = 100
    r.film_transparent = True; r.image_settings.file_format = 'PNG'; r.image_settings.color_mode = 'RGBA'; r.image_settings.color_depth = '8'
    r.filter_size = 0.75
    try: sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
    except Exception: pass
    if eng == 'CYCLES': sc.cycles.samples = 64
    # camera: orthographic, from the south, looking down at elevation_deg; the world origin (the feet) lands on the anchor
    cam = bpy.data.objects.get('SF_Camera')
    if not cam:
        cam = bpy.data.objects.new('SF_Camera', bpy.data.cameras.new('SF_Camera')); sc.collection.objects.link(cam)
    e = math.radians(c['elevation_deg']); d = 20.0
    cam.location = (0.0, -d * math.cos(e), d * math.sin(e)); cam.rotation_euler = (math.radians(90) - e, 0.0, 0.0)
    cd = cam.data; cd.type = 'ORTHO'; cd.clip_start = 0.1; cd.clip_end = 100
    # a standing figure of figure_height_m projects to height*cos(e) on screen; scale so it is figure_px tall in the cell
    px_per_m = c['figure_px'] / (c['figure_height_m'] * math.cos(e))
    cd.ortho_scale = c['cell'][0] / px_per_m; cd.sensor_fit = 'HORIZONTAL'
    cd.shift_x = (c['anchor'][0] - c['cell'][0] / 2) / c['cell'][0] * -1.0
    cd.shift_y = (c['anchor'][1] - c['cell'][1] / 2) / c['cell'][0]
    sc.camera = cam
    # light: a sun from the screen's top left (fixed to the camera, so every direction is lit the same way), plus a soft fill
    sun = bpy.data.objects.get('SF_Sun')
    if not sun:
        sun = bpy.data.objects.new('SF_Sun', bpy.data.lights.new('SF_Sun', 'SUN')); sc.collection.objects.link(sun)
    L = c['light']
    sun.rotation_euler = Vector(L['sun_dir']).normalized().to_track_quat('-Z', 'Y').to_euler(); sun.data.energy = L['strength']
    fill = bpy.data.objects.get('SF_Fill')
    if not fill:
        fill = bpy.data.objects.new('SF_Fill', bpy.data.lights.new('SF_Fill', 'SUN')); sc.collection.objects.link(fill)
    fill.rotation_euler = Vector((0.3, 1.0, -0.4)).to_track_quat('-Z', 'Y').to_euler(); fill.data.energy = L['fill']
    return sc


def layer_objects(sc, name):
    col = bpy.data.collections.get(name)
    if not col: raise SystemExit('sf_render: no collection named "%s" (one per layer id)' % name)
    return [o for o in col.all_objects if o.type in ('MESH', 'CURVE', 'SURFACE', 'META', 'FONT')]


def show_only(sc, c, layer):
    """the layer renders; collections in its holdout list render as holdouts (they hide what is behind them); others are off"""
    vl = sc.view_layers[0]
    for L in c['layers']:
        lc = find_layer_collection(vl.layer_collection, L['id'])
        if not lc: raise SystemExit('sf_render: no collection named "%s"' % L['id'])
        on = L['id'] == layer['id'] or L['id'] in layer['holdout']
        lc.exclude = not on; lc.holdout = L['id'] in layer['holdout']


MASK_COL = {'primary': (1, 0, 0, 1), 'secondary': (0, 1, 0, 1), 'fixed': (0, 0, 1, 1)}


def mask_material(kind):
    name = 'SF_MASK_' + kind
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = MASK_COL[kind]; em.inputs['Strength'].default_value = 1.0
    out = nt.nodes.new('ShaderNodeOutputMaterial'); nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return m


def swap_to_masks(objs):
    saved = []
    for o in objs:
        if not hasattr(o.data, 'materials'): continue
        mats = list(o.data.materials); saved.append((o, mats))
        okind = o.get('sf')
        if not mats: o.data.materials.append(mask_material(okind or 'primary')); continue
        for i, m in enumerate(mats):
            kind = okind or (m.get('sf') if m else None) or 'primary'
            o.data.materials[i] = mask_material(kind if kind in MASK_COL else 'primary')
    return saved


def restore(saved):
    for o, mats in saved:
        o.data.materials.clear()
        for m in mats: o.data.materials.append(m)


def set_action(arm, action_name):
    act = bpy.data.actions.get(action_name)
    if not act: raise SystemExit('sf_render: no action "%s" (rename your imported animations to the config names)' % action_name)
    if not arm.animation_data: arm.animation_data_create()
    arm.animation_data.action = act
    if hasattr(arm.animation_data, 'action_slot') and getattr(act, 'slots', None):
        try: arm.animation_data.action_slot = act.slots[0]
        except Exception: pass
    return act


def frame_times(act, A):
    s, e = (A['range'] if A.get('range') else act.frame_range)
    n = A['frames']
    if n == 1: return [s]
    step = (e - s) / n if A['loop'] else (e - s) / (n - 1)   # a loop never repeats its first pose as its last frame
    return [s + i * step for i in range(n)]


def attach_rigid(arm):
    """rigid armour: any object with the custom property sf_bone = "<bone name>" is parented to that bone, in the rest pose,
    keeping exactly where you placed it. Plate, helmets, gauntlets, shields and weapons are rigid; cloth and leather that must
    bend need skin weights instead (README: "Bending pieces")."""
    pp = arm.data.pose_position; arm.data.pose_position = 'REST'; bpy.context.view_layer.update(); n = 0
    try:
        for o in bpy.data.objects:
            b = o.get('sf_bone')
            if not b or (o.parent == arm and o.parent_type == 'BONE' and o.parent_bone == b): continue
            if b not in arm.data.bones: raise SystemExit('sf_render: %s: no bone "%s" in %s' % (o.name, b, arm.name))
            mw = o.matrix_world.copy(); o.parent = arm; o.parent_type = 'BONE'; o.parent_bone = b
            bpy.context.view_layer.update(); o.matrix_world = mw; n += 1
    finally:
        arm.data.pose_position = pp; bpy.context.view_layer.update()
    if n: print('sf_render: attached %d rigid piece(s) to bones' % n)


def render_to(sc, path):
    os.makedirs(os.path.dirname(path), exist_ok=True); sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main():
    o = args(); c = load_config(o['config']); sc = setup_scene(c); arm = armature(c)
    attach_rigid(arm)
    rot0, act0 = arm.rotation_euler.copy(), (arm.animation_data.action if arm.animation_data else None)
    layers = [L for L in c['layers'] if not o['only'] or L['id'] in o['only']]
    actions = [A for A in c['actions'] if not o['actions'] or A['name'] in o['actions']]
    dirs = [d for d in DIRS if not o['dirs'] or d in o['dirs']]
    total = 0
    try:
        for L in layers:
            show_only(sc, c, L); objs = layer_objects(sc, L['id'])
            for A in actions:
                act = set_action(arm, A.get('action', A['name']))
                times = frame_times(act, A)
                if o['preview']: times = times[:1]
                for d in dirs:
                    arm.rotation_euler = rot0.copy(); arm.rotation_euler.z = rot0.z + math.radians(DIR_DEG[d] + c['facing_offset_deg'])
                    for fi, t in enumerate(times):
                        sc.frame_set(int(math.floor(t)), subframe=t - math.floor(t))
                        base = os.path.join(c['out'], L['id'], A['name'], d, '%02d' % fi)
                        render_to(sc, base + '.png'); total += 1
                        if o['masks'] and L.get('masks', L['id'] != 'body'):
                            saved = swap_to_masks(objs)
                            try: render_to(sc, base + '.mask.png')
                            finally: restore(saved)
                print('sf_render: %s / %s done' % (L['id'], A['name']), flush=True)
    finally:
        arm.rotation_euler = rot0
        if arm.animation_data: arm.animation_data.action = act0
    json.dump({'pipeline': '1.0.0', 'config': c, 'frames': total}, open(os.path.join(c['out'], 'render.json'), 'w'), indent=1)
    print('sf_render: %d frames in %s. Next: python3 tools/sprites3d/sf_pack.py %s' % (total, c['out'], c['out']))


if __name__ == '__main__':
    main()
