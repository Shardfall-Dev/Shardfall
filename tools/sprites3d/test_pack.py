"""Tests for sf_pack.py with synthetic frames (no Blender): python3 tools/sprites3d/test_pack.py"""
import json, os, subprocess, sys, tempfile
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); DIRS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']
fails = 0
def check(ok, msg):
    global fails; print(('ok   ' if ok else 'FAIL ') + msg); fails += 0 if ok else 1

def fake_render(root, feet_off=0, bob=0, drop_dir=None):
    k = 2; cell = (128, 128); c = {'cell': list(cell), 'anchor': [64, 106], 'supersample': k, 'figure_px': 72, 'figure_height_m': 1.8, 'pack_name': 'Test_Human3D', 'version': '0.0.1',
        'layers': [{'id': 'body'}, {'id': 'plate_chest', 'slot': 'chest', 'items': ['plate_chest'], 'z': 4, 'holdout': ['body']}],
        'actions': [{'name': 'Idle', 'frames': 4}, {'name': 'Walk', 'frames': 8}]}
    for L in c['layers']:
        for A in c['actions']:
            for d in DIRS:
                for f in range(A['frames']):
                    if L['id'] == 'plate_chest' and d == drop_dir: continue
                    im = Image.new('RGBA', (cell[0] * k, cell[1] * k)); dr = ImageDraw.Draw(im); y0 = (106 + feet_off) * k + k - 1; b = (f % 2) * bob * k
                    if L['id'] == 'body': dr.rounded_rectangle([54 * k, y0 - 72 * k + 1 - b, 74 * k, y0], 8 * k, fill=(200, 150, 120, 255))   # bob: a frame that stretches taller
                    else: dr.rectangle([55 * k, y0 - 56 * k, 73 * k, y0 - 32 * k], fill=(140, 140, 135, 255))
                    p = os.path.join(root, L['id'], A['name'], d, '%02d.png' % f); os.makedirs(os.path.dirname(p), exist_ok=True); im.save(p)
                    if L['id'] != 'body':
                        m = Image.new('RGBA', im.size); ImageDraw.Draw(m).rectangle([55 * k, y0 - 56 * k, 73 * k, y0 - 32 * k], fill=(255, 0, 0, 255)); m.save(p[:-4] + '.mask.png')
    json.dump({'pipeline': '1.0.0', 'config': c}, open(os.path.join(root, 'render.json'), 'w'))

def run(root, out):
    r = subprocess.run([sys.executable, os.path.join(HERE, 'sf_pack.py'), root, '--out', out], capture_output=True, text=True)
    return r.returncode, json.load(open(os.path.join(out, 'manifest.json')))

with tempfile.TemporaryDirectory() as t:
    src, out = os.path.join(t, 'r'), os.path.join(t, 'p'); fake_render(src); rc, m = run(src, out)
    check(rc == 0 and m['checks']['ok'], 'a clean render packs with every check passing ' + str(m['checks']['problems'][:2]))
    sh = Image.open(os.path.join(out, 'body', 'Walk.png')); check(sh.size == (128 * 8, 128 * 8), 'Walk sheet is 8 frames × 8 directions of 128 px')
    check(m['layers']['plate_chest']['actions']['Idle'].get('mask') == 'plate_chest/Idle.mask.png' and m['layers']['plate_chest']['slot'] == 'chest', 'armour layer has its mask sheet and game slot')
    fr = sh.crop((0, 0, 128, 128)); bb = fr.getchannel('A').point(lambda v: 255 if v >= 128 else 0).getbbox()
    check(bb[3] - 1 == 107 and bb[1] == 106 - 72, 'feet sit on the anchor row with a 1 px outline below (bbox %s)' % (bb,))
    check(fr.getpixel((64, 107))[:3] == (0x1c, 0x14, 0x0e), 'the outline is the painted style dark brown')
    check(os.path.exists(os.path.join(out, 'preview.png')) and os.path.exists(os.path.join(out, 'Test_Human3D_v0.0.1.zip')), 'preview and versioned ZIP written')
with tempfile.TemporaryDirectory() as t:
    src, out = os.path.join(t, 'r'), os.path.join(t, 'p'); fake_render(src, feet_off=6); rc, m = run(src, out)
    check(rc == 1 and any('feet on row' in p for p in m['checks']['problems']), 'feet off the anchor are reported')
with tempfile.TemporaryDirectory() as t:
    src, out = os.path.join(t, 'r'), os.path.join(t, 'p'); fake_render(src, bob=6); rc, m = run(src, out)
    check(rc == 1 and any('height varies' in p for p in m['checks']['problems']), 'an unsteady figure height is reported')
with tempfile.TemporaryDirectory() as t:
    src, out = os.path.join(t, 'r'), os.path.join(t, 'p'); fake_render(src, drop_dir='NE'); rc, m = run(src, out)
    check(rc == 1 and any('plate_chest/Idle/NE/00: missing' in p for p in m['checks']['problems']), 'missing frames are reported')
print('all sprites3d pack tests passed' if not fails else '%d FAILED' % fails); sys.exit(1 if fails else 0)
