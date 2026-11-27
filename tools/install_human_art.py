#!/usr/bin/env python3
"""Install the painted classic-human runtime art and embed it in the build (docs/handoffs/classic-human-sprites-v2.1.md).

usage: python3 tools/install_human_art.py        (needs Pillow)

1. Checks the three ZIPs in asset-packs/classic-humans-v2/ against the SHA256 sums in the v2.1 handoff.
2. Reads only the runtime atlases + manifests (no source art, no preview HTML):
     Shardfall_Classic_Humans_v1.zip         classic_humans_idle_v1.png  (48×80 cells, anchor 24,76; rows male/female; 8 direction columns)
     Shardfall_Classic_Humans_Painted_v2.zip painted_walk_cast_SE_SW_v2.png (80×80 cells, anchor 40,76; 8 time columns; rows from manifest.json)
3. Normalises scale ONCE, offline: the idle figures are ~70 px tall, the walk/cast figures ~64 px. The idle cells are resampled by
   64/70 around their ground anchor (Lanczos, then a hard alpha threshold) so standing and walking are the same height in game.
   The originals stay untouched in the ZIPs.
4. Writes assets/humans/painted-v2.1/{idle.png, walkcast.png, manifest.json} and src/human-art.js (generated; do not edit).
Nothing is invented: every registry entry points at a painted cell that exists. Missing states are listed in the manifest.
"""
import base64, hashlib, io, json, os, sys, zipfile
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, 'asset-packs/classic-humans-v2')
OUT = os.path.join(ROOT, 'assets/humans/painted-v2.1')
SUMS = {'Shardfall_Classic_Humans_v1.zip': '4de842ab6768200dad349415fda8718bbdbf78a754cd4b599923c60d89b39711',
        'Shardfall_Classic_Humans_Painted_v2.zip': '7fcf0639c6c9ff58d7a13e2394b5ed4d00f96367c0560061ea31bc8cd1a9fed9'}
DIRS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']
TARGET_H = 64                     # walk/cast figure height (measured below), the common standing height

def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()
for f, s in SUMS.items():
    got = sha(os.path.join(PACK, f))
    if got != s: sys.exit(f'{f}: SHA256 {got} does not match the handoff ({s})')

z1 = zipfile.ZipFile(os.path.join(PACK, 'Shardfall_Classic_Humans_v1.zip'))
z2 = zipfile.ZipFile(os.path.join(PACK, 'Shardfall_Classic_Humans_Painted_v2.zip'))
m1 = json.loads(z1.read('classic_humans_idle_v1.json')); m2 = json.loads(z2.read('manifest.json'))
idle = Image.open(io.BytesIO(z1.read(m1['image']))).convert('RGBA')
wc = Image.open(io.BytesIO(z2.read(m2['atlas']))).convert('RGBA')
fw, fh, ax, ay = m1['frameWidth'], m1['frameHeight'], m1['anchor']['x'], m1['anchor']['y']
cw, ch = m2['cell']['width'], m2['cell']['height']; cax, cay = m2['cell']['anchor']
assert idle.size == (fw * len(m1['directions']), fh * len(m1['rows'])), idle.size
assert wc.size == (cw * m2['columns'], ch * len(m2['rows'])), wc.size
assert m1['directions'] == DIRS, m1['directions']

def height(im): b = im.getbbox(); return (b[3] - b[1]) if b else 0
ih = [height(idle.crop((c * fw, r * fh, c * fw + fw, r * fh + fh))) for r in range(2) for c in range(8)]
wh = [height(wc.crop((c * cw, r * ch, c * cw + cw, r * ch + ch))) for r in range(len(m2['rows'])) for c in range(m2['columns'])]
src_h = round(sum(ih) / len(ih)); tgt = round(sorted(wh)[len(wh) // 2]) or TARGET_H; k = tgt / src_h

out = Image.new('RGBA', idle.size)
for r in range(2):
    for c in range(8):
        cell = idle.crop((c * fw, r * fh, c * fw + fw, r * fh + fh))
        sm = cell.resize((round(fw * k), round(fh * k)), Image.LANCZOS)
        n = Image.new('RGBA', (fw, fh)); n.alpha_composite(sm, (ax - round(ax * k), ay - round(ay * k)))
        px = n.load()
        for y in range(fh):
            for x in range(fw):
                R, G, B, A = px[x, y]; px[x, y] = (R, G, B, 255) if A >= 110 else (0, 0, 0, 0)
        out.paste(n, (c * fw, r * fh))

os.makedirs(OUT, exist_ok=True)
buf = io.BytesIO(); out.save(buf, 'PNG', optimize=True); idle_png = buf.getvalue(); open(os.path.join(OUT, 'idle.png'), 'wb').write(idle_png)
buf = io.BytesIO(); wc.save(buf, 'PNG', optimize=True); wc_png = buf.getvalue(); open(os.path.join(OUT, 'walkcast.png'), 'wb').write(wc_png)

# the registry: one entry per painted (body, action, direction); frames are consecutive cells left to right
entries = []
for b, row in m1['rows'].items():
    for i, d in enumerate(DIRS):
        entries.append({'layer': 'body', 'body': b, 'action': 'idle', 'dir': d, 'atlas': 'idle', 'x': i * fw, 'y': row * fh, 'w': fw, 'h': fh, 'ax': ax, 'ay': ay, 'frames': 1})
for r, row in enumerate(m2['rows']):
    entries.append({'layer': 'body', 'body': row['body'], 'action': row['action'], 'dir': row['direction'], 'atlas': 'walkcast', 'x': 0, 'y': r * ch, 'w': cw, 'h': ch,
                    'ax': cax, 'ay': cay, 'frames': m2['columns'], 'mirroredFrom': 'SE' if row['direction'] == 'SW' else None})
painted = {(e['body'], e['action'], e['dir']) for e in entries}
missing = sorted(f'{b} {a} {d}' for b in ('male', 'female') for a in ('walk', 'cast') for d in DIRS if (b, a, d) not in painted)
man = {
    'version': '2.1.0', 'style': 'painted-v2', 'status': 'partial painted set — not a complete animation set',
    'provenance': {f: SUMS[f] for f in SUMS},
    'atlases': {'idle': {'file': 'idle.png', 'size': list(out.size), 'from': 'Shardfall_Classic_Humans_v1.zip:' + m1['image'], 'normalised': {'scale': round(k, 4), 'fromHeight': src_h, 'toHeight': tgt, 'method': 'Lanczos around the anchor, alpha >= 110 kept'}},
                'walkcast': {'file': 'walkcast.png', 'size': list(wc.size), 'from': 'Shardfall_Classic_Humans_Painted_v2.zip:' + m2['atlas'], 'normalised': None}},
    'bakedApparel': ['hair', 'shirt', 'trousers', 'feet', 'belt'],
    'bakedNote': 'The painted bodies have hair and plain clothes painted in. They are not naked or bald compositing bases; hair, skin and cloth cannot be changed without new layer art.',
    'entries': entries,
    'missing': {'walk/cast directions': missing,
                'actions with no painted art': ['run', 'ready', 'unarmed', 'slash1h', 'slash2h', 'chop1h', 'chop2h', 'blunt1h', 'blunt2h', 'thrust1h', 'thrust2h', 'polearm', 'staff', 'bow', 'crossbow', 'cast2h', 'caststaff', 'block', 'hit', 'death', 'corpse', 'mine', 'chopwood', 'smith', 'bandage', 'fish'],
                'layers with no painted art': ['base body (naked)', 'hair (all styles, front/back)', 'beard', 'skin tint masks', 'shirt', 'trousers', 'boots/shoes', 'every armour piece', 'robe', 'tabard', 'cloak', 'belt', 'jewelry', 'weapons', 'shields', 'hand sockets'],
                'style note': 'The SE/SW walk/cast frames are softer (anti-aliased, no dark outline, longer hair) than the idle frames; the art itself does not yet match between sets.'}}
json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
uri = lambda b: 'data:image/png;base64,' + base64.b64encode(b).decode()
js = ('<script>\n/* Shardfall painted classic humans v2.1: generated by tools/install_human_art.py from asset-packs/classic-humans-v2. Do not edit by hand. */\n'
      '(function (root) { const SF = root.SF || (root.SF = {}); SF.HUMAN_ART_DATA = ' + json.dumps({**man, 'src': {'idle': uri(idle_png), 'walkcast': uri(wc_png)}}, separators=(',', ':')) +
      ';\nif (typeof module !== "undefined" && module.exports) module.exports = SF.HUMAN_ART_DATA; })(typeof globalThis !== "undefined" ? globalThis : this);\n</script>\n')
open(os.path.join(ROOT, 'src/human-art.js'), 'w').write(js)
print(f'idle {src_h}px → {tgt}px (×{k:.3f}); {len(entries)} painted entries; {len(missing)} walk/cast directions missing; src/human-art.js {len(js) // 1024} KB')
