#!/usr/bin/env python3
"""Painted human art backlog: what Painted Human Candidates v0.1 actually covers.

usage:
  python3 tools/painted_backlog.py                 # writes assets/humans/painted-candidates-v0.1/backlog.json
  python3 tools/painted_backlog.py --v2 PATH       # also compares against Shardfall_Classic_Humans_Painted_v2.zip
                                                   # (asset-packs/classic-humans-v2/ on main) and records the result
  python3 tools/painted_backlog.py --check         # fails if backlog.json is out of date

Measures the v0.1 pack (read in memory, SHA-256 checked) against the painted-art backlog: the missing list of classic humans
v2.1 (docs/humans/STATUS.md on PR #40), which is the backlog this pack was drawn for. Every item gets one status:
  exists    usable as delivered (nothing in this backlog is)
  partial   some genuine art exists, but not the full requirement (says exactly what is there)
  mirrored  covered only by a mirror or duplicate of another direction or frame
  missing   no art
Facts are measured, not assumed: accepted frames come from qa.json (tools/painted_candidates.py), mirrors and duplicates from a
pixel test, figure heights and edge treatment from the alpha channel. Item ids come from the game data (SF.EQ.DEFS, SF.ITEMS).
Needs Pillow and numpy.
"""
import sys, os, io, json, hashlib, zipfile
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIP = os.path.join(ROOT, 'asset-packs/painted-human-candidates-v0.1/Shardfall_Painted_Candidates_v0.1.zip')
SHA = '17b1b497dd80dbb87f6c1ea0b5a679d13aa1f6dcd0984f9fccc54a1a0d95c7b1'
V2SHA = '7fcf0639c6c9ff58d7a13e2394b5ed4d00f96367c0560061ea31bc8cd1a9fed9'
OUT = os.path.join(ROOT, 'assets/humans/painted-candidates-v0.1')
BODIES = ['male', 'female']
ACTIONS = ['Idle', 'Walk', 'Cast', 'Unarmed_Attack']
ROWS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']
CELL = 128
# a pair is a mirror/duplicate when the silhouettes overlap almost completely and the colours agree
DUP_IOU, DUP_DIFF = 0.95, 8.0

# The backlog as handed over (classic humans v2.1 status) and the game data it refers to
RUN_AND_OTHER = ['run', 'ready']
WEAPON_ATTACKS = ['unarmed', 'slash1h', 'slash2h', 'chop1h', 'chop2h', 'blunt1h', 'blunt2h', 'thrust1h', 'thrust2h',
                  'polearm', 'staff', 'bow', 'crossbow']
CASTS = ['cast2h', 'caststaff']
REACTIONS = ['block', 'hit', 'death', 'corpse']
WORK = ['mine', 'chopwood', 'smith', 'fish', 'bandage']
HAIR = ['short', 'long', 'ponytail', 'pageboy', 'receding', 'mohawk', 'buns', 'pigtails']   # CR.HAIR_STYLES minus bald
BEARDS = ['stubble', 'goatee', 'short', 'full']                                               # human-rig BEARD shapes
CLOTHING = ['shirt', 'trousers', 'shoes', 'boots', 'belt', 'robe', 'tabard', 'cloak (front and back)', 'cloth_cap',
            'cloth_gloves']
# SF.EQ.DEFS (56) in definition order, plus the pine buckler; checked against the build by tests/painted.test.js
EQUIPMENT = ['cloth_cap', 'shirt', 'trousers', 'robe', 'cloak', 'cloth_gloves', 'tabard', 'leather_cap', 'leather_gorget',
    'leather_tunic', 'leather_sleeves', 'leather_gloves', 'leather_leggings', 'boots', 'shoes', 'belt', 'studded_gorget',
    'studded_tunic', 'studded_sleeves', 'studded_gloves', 'studded_leggings', 'bone_helm', 'bone_chest', 'bone_arms',
    'bone_gloves', 'bone_legs', 'ringmail_tunic', 'ringmail_sleeves', 'ringmail_gloves', 'ringmail_leggings', 'chain_coif',
    'chain_tunic', 'chain_leggings', 'plate_gorget', 'plate_chest', 'plate_arms', 'plate_gauntlets', 'plate_leggings',
    'bascinet', 'open_helm', 'norse_helm', 'closed_helm', 'plate_helm', 'great_helm', 'dragon_helm', 'dragon_chest',
    'dragon_arms', 'dragon_gloves', 'dragon_legs', 'wooden_shield', 'metal_shield', 'kite_shield', 'heater_shield', 'ring',
    'bracelet', 'necklace']
EXTRA_EQUIPMENT = ['buckler']
# SF.ITEMS with slot 'weapon' (15); 'unarmed' has no shape
WEAPONS = ['hatchet', 'pickaxe', 'knife', 'dagger', 'sword', 'hammer', 'glaive', 'shortbow', 'crossbow', 'heavycrossbow',
           'battleaxe', 'mace', 'waraxe', 'kryss', 'spear']
OTHER_DIRS = ['S', 'W', 'NW', 'N', 'NE', 'E']


def load_cells():
    raw = open(ZIP, 'rb').read()
    if hashlib.sha256(raw).hexdigest() != SHA: sys.exit('candidate ZIP SHA-256 does not match the handoff')
    z = zipfile.ZipFile(io.BytesIO(raw))
    cells = {}
    for b in BODIES:
        for a in ACTIONS:
            im = np.asarray(Image.open(io.BytesIO(z.read(f'{b}/{a}.png'))).convert('RGBA')).astype(np.int16)
            for r, d in enumerate(ROWS):
                for c in range(3):
                    cells[(b, a, d, c)] = im[r*CELL:(r+1)*CELL, c*CELL:(c+1)*CELL]
    return cells


def crop(a):
    ys, xs = np.nonzero(a[..., 3] > 32)
    return a[ys.min():ys.max()+1, xs.min():xs.max()+1]


def same(x, y):
    """Compare two figures aligned at the bottom-left of their bounding boxes: (alpha IoU, mean RGB diff on the overlap)."""
    h, w = max(x.shape[0], y.shape[0]), max(x.shape[1], y.shape[1])
    def pad(a):
        o = np.zeros((h, w, 4), np.int16); o[h-a.shape[0]:, :a.shape[1]] = a; return o
    x, y = pad(x), pad(y)
    ax, ay = x[..., 3] > 32, y[..., 3] > 32
    both = ax & ay
    iou = both.sum() / max(1, (ax | ay).sum())
    diff = float(np.abs(x[..., :3] - y[..., :3])[both].mean()) if both.any() else 255.0
    return float(iou), diff


def edge_stats(a):
    al = a[..., 3]; op = al > 32
    p = np.pad(op, 1)
    inner = op & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    edge = op & ~inner
    lum = 0.299*a[..., 0] + 0.587*a[..., 1] + 0.114*a[..., 2]
    return dict(height=int(np.ptp(np.nonzero(op)[0]) + 1), softAlpha=float(((al > 0) & (al < 255)).sum() / max(1, (al > 0).sum())),
                darkOutline=float((lum[edge] < 60).mean()))


def summarise(stats):
    hs = [s['height'] for s in stats]
    return dict(heightMedian=float(np.median(hs)), heightRange=[min(hs), max(hs)],
                softAlphaShare=round(float(np.mean([s['softAlpha'] for s in stats])), 3),
                darkOutlineShare=round(float(np.mean([s['darkOutline'] for s in stats])), 3))


def duplicates(cells):
    """Every pair of v0.1 frames that is a mirror (flipped) or a plain copy of another, within the pack."""
    crops = {k: crop(v) for k, v in cells.items()}
    keys = sorted(crops)
    found = []
    for i, k in enumerate(keys):
        for k2 in keys[i:]:
            if k2[0] != k[0]: continue   # male vs female are different paintings by construction
            for rel, other in (('mirror', crops[k2][:, ::-1]), ('copy', crops[k2])):
                if rel == 'copy' and k2 == k: continue
                iou, diff = same(crops[k], other)
                if iou >= DUP_IOU and diff <= DUP_DIFF:
                    found.append(dict(frame='/'.join(map(str, k)), of='/'.join(map(str, k2)), relation=rel,
                                      iou=round(iou, 3), diff=round(diff, 2)))
    # closest mirror pair in each body/action, so the margin to the threshold is on record
    closest = {}
    for b in BODIES:
        for a in ACTIONS:
            best = (0, 0, None)
            for d in ROWS:
                for d2 in ROWS:
                    for c in range(3):
                        for c2 in range(3):
                            if (d, c) == (d2, c2): continue
                            iou, diff = same(crops[(b, a, d, c)], crops[(b, a, d2, c2)][:, ::-1])
                            if iou > best[0]: best = (iou, diff, f'{d}/{c} ~ flip({d2}/{c2})')
            closest[f'{b}/{a}'] = dict(pair=best[2], iou=round(best[0], 3), diff=round(best[1], 2))
    return found, closest


def compare_v2(cells, path):
    raw = open(path, 'rb').read()
    if hashlib.sha256(raw).hexdigest() != V2SHA: sys.exit('classic humans painted v2 ZIP SHA-256 does not match')
    z = zipfile.ZipFile(io.BytesIO(raw))
    wc = np.asarray(Image.open(io.BytesIO(z.read('painted_walk_cast_SE_SW_v2.png'))).convert('RGBA')).astype(np.int16)
    rows = [(r['body'], r['action'], r['direction']) for r in json.loads(z.read('manifest.json'))['rows']]
    idle = np.asarray(Image.open(io.BytesIO(z.read('classic_humans_idle_v1.png'))).convert('RGBA')).astype(np.int16)

    def norm(a, h=60, w=48):
        im = Image.fromarray(crop(a).astype(np.uint8), 'RGBA')
        im = im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)
        out = Image.new('RGBA', (max(w, im.width), h)); out.paste(im, ((out.width - im.width)//2, 0))
        return np.asarray(out).astype(np.int16)

    v2 = {}
    for r, key in enumerate(rows):
        for f in range(8):
            v2[(*key, f)] = wc[r*80:(r+1)*80, f*80:(f+1)*80]
    v2n = {k: norm(v) for k, v in v2.items()}
    best = (0, None, None)
    for k, a in cells.items():
        if k[1] not in ('Walk', 'Cast'): continue
        na = norm(a)
        for k2, b2 in v2n.items():
            for rel, o in (('plain', b2), ('flip', b2[:, ::-1])):
                iou, _ = same(na, o)
                if iou > best[0]: best = (iou, '/'.join(map(str, k)), f"{rel} {'/'.join(map(str, k2))}")
    # raw crops, no resampling: the same test the in-pack mirror check uses, so this also calibrates it
    sw_vs_se = [same(crop(v2[(b, a, 'SW', f)]), crop(v2[(b, a, 'SE', f)])[:, ::-1]) for b in BODIES for a in ('walk', 'cast') for f in range(8)]
    se, sw = [], []
    for k, v in v2.items(): (se if k[2] == 'SE' else sw).append(edge_stats(v))
    idles = [edge_stats(idle[r*80:(r+1)*80, c*48:(c+1)*48]) for r in range(idle.shape[0]//80) for c in range(idle.shape[1]//48)
             if (idle[r*80:(r+1)*80, c*48:(c+1)*48, 3] > 32).any()]
    return dict(
        source='asset-packs/classic-humans-v2/Shardfall_Classic_Humans_Painted_v2.zip (main), SHA-256 ' + V2SHA,
        v2SWisMirrorOfSE=dict(frames=len(sw_vs_se), minIoU=round(min(s[0] for s in sw_vs_se), 3),
                              maxDiff=round(max(s[1] for s in sw_vs_se), 2),
                              note='every v2 SW walk/cast frame is exactly the flipped SE frame: the handedness swap reported '
                                   'in the v2.1 status. It also shows the mirror check catches a real mirror (IoU 1, diff 0).'),
        v01CopiedFromV2=dict(bestIoU=round(best[0], 3), v01=best[1], v2=best[2],
                             note='no v0.1 walk/cast frame is a copy or mirror of v2 art (a copy scores 1.0; similar upright '
                                  'poses score about 0.8)'),
        styleV2=dict(idleV1=summarise(idles), walkCastSE=summarise(se), walkCastSWmirrored=summarise(sw)))


def status_dirs(qa, body, action, dirs):
    out = {}
    for d in dirs:
        n = sum(1 for c in range(3) if qa[(body, action, d, c)])
        out[d] = dict(status='partial' if n else 'missing', acceptedCandidatePoses=n,
                      note=f'{n} accepted candidate pose(s), not a cycle' if n else 'all 3 candidates rejected')
    return out


def build(v2_section):
    cells = load_cells()
    qa_doc = json.load(open(os.path.join(OUT, 'qa.json')))
    qa = {}
    for name, f in qa_doc['frames'].items():   # 'male/Idle/S/00'
        b, a, d, c = name.split('/')
        qa[(b, a, d, int(c))] = f['status'] == 'accepted'
    assert len(qa) == 192, len(qa)
    dups, closest = duplicates(cells)
    style = {f'{b}/{a}': summarise([edge_stats(cells[(b, a, d, c)]) for d in ROWS for c in range(3)])
             for b in BODIES for a in ACTIONS}
    every = lambda ids, why: {i: dict(status='missing', note=why) for i in ids}
    acts = lambda names: {n: dict(status='missing', directions=8, bodies=BODIES) for n in names}
    walkcast = {f'{b} {a.lower()}': status_dirs(qa, b, a, OTHER_DIRS) for b in BODIES for a in ('Walk', 'Cast')}
    def sw_entry(b, a):
        hit = [d for d in dups if d['frame'].startswith(f'{b}/{a}/SW/') or d['of'].startswith(f'{b}/{a}/SW/')]
        e = status_dirs(qa, b, a, ['SW'])['SW']
        if hit: return dict(e, status='mirrored', mirror=True, note='mirror or duplicate of another frame', pairs=hit)
        return dict(e, mirror=False, note='painted separately in v0.1 (pixel test: not a flipped SE or any other frame); '
                                          'candidate poses, not the 8-frame cycle')
    sw = {f'{b} {a.lower()}': sw_entry(b, a) for b in BODIES for a in ('Walk', 'Cast')}
    unarmed = {b: status_dirs(qa, b, 'Unarmed_Attack', ROWS) for b in BODIES}
    attacks = acts(WEAPON_ATTACKS[1:])
    attacks['unarmed'] = dict(status='partial', note='Unarmed_Attack candidates; see perDirection. Not an 8-frame strike.',
                              perDirection=unarmed)
    heights = {k: v['heightMedian'] for k, v in style.items()}
    items = [
        dict(id='walk-cast-other-directions', ask='Walking and casting in the other 6 directions (S W NW N NE E)',
             status='partial', detail=walkcast),
        dict(id='true-sw', ask='A real south-west walk and cast (the v2 SW is a mirrored SE with swapped hands)',
             status='partial', detail=sw),
        dict(id='run', ask='Running', status='missing', detail=acts(['run'])),
        dict(id='weapon-attacks', ask='All 13 weapon attacks', status='partial',
             note='only unarmed has candidate art; the 12 weapon attacks have none', detail=attacks),
        dict(id='two-handed-staff-casting', ask='Two-handed and staff casting', status='missing', detail=acts(CASTS),
             note='Cast is one unsplit candidate pose set; not CastPrepare/Hold/Release and not two-handed or staff'),
        dict(id='block-hit-death-corpse', ask='Block, hit, death, corpse', status='missing', detail=acts(REACTIONS)),
        dict(id='gathering-crafting', ask='Gathering and crafting actions', status='missing', detail=acts(WORK)),
        dict(id='base-bodies', ask='Base bodies without painted-in clothes or hair, plus skin colour masks', status='partial',
             detail=dict(clothes=dict(status='partial', note='v0.1 bodies wear only a loincloth (and a bandeau on the female); '
                                      'no shirt, trousers or shoes are painted in'),
                         hair=dict(status='missing', note='hair is painted into every v0.1 frame'),
                         skinMasks=dict(status='missing'))),
        dict(id='hair', ask='8 hairstyles (front and back)', status='missing', detail=every(HAIR, 'front and back layers, every frame')),
        dict(id='beards', ask='4 beards', status='missing', detail=every(BEARDS, 'every frame')),
        dict(id='clothing', ask='Clothing layers with colour masks', status='missing', detail=every(CLOTHING, 'layer + dye mask')),
        dict(id='equipment', ask='A separate layer for each of the 56 equipment pieces plus the buckler, with material masks',
             status='missing', detail=every(EQUIPMENT + EXTRA_EQUIPMENT, 'layer + material mask, every frame')),
        dict(id='weapons', ask='15 weapon shapes with hand positions for every frame', status='missing',
             detail=every(WEAPONS, 'shape + per-frame hand socket')),
        dict(id='paperdoll', ask='Paperdoll portrait layers', status='missing',
             note='no portrait art for these bodies; the paper doll keeps its current art'),
        dict(id='one-style', ask='Repaint to one matching style', status='missing',
             note='v0.1 is a third style: hard alpha and no dark outline in every sheet, so it matches neither v2 idle '
                  '(dark outline) nor v2 walk/cast (soft edges). Its own figure heights also differ between actions '
                  f"(male idle {heights['male/Idle']:.0f} px vs walk {heights['male/Walk']:.0f} px; female unarmed "
                  f"{heights['female/Unarmed_Attack']:.0f} px vs cast {heights['female/Cast']:.0f} px), and hair is drawn "
                  'differently from the v2 sets.'),
    ]
    acc = sum(qa.values())
    return dict(
        pack='Shardfall_Painted_Candidates_v0.1',
        generatedBy='tools/painted_backlog.py',
        statuses=dict(exists='usable as delivered', partial='some genuine art, not the full requirement',
                      mirrored='covered only by a mirror or duplicate', missing='no art'),
        summary=dict(frames=192, accepted=acc, rejected=192 - acc, mirroredOrDuplicatedInPack=len(dups),
                     itemsExist=sum(i['status'] == 'exists' for i in items),
                     itemsPartial=sum(i['status'] == 'partial' for i in items),
                     itemsMirrored=sum(i['status'] == 'mirrored' for i in items),
                     itemsMissing=sum(i['status'] == 'missing' for i in items)),
        mirrorCheck=dict(rule=f'silhouette IoU >= {DUP_IOU} and mean RGB diff <= {DUP_DIFF} after flipping (mirror) or as is (copy)',
                         found=dups, closestMirrorPerSheet=closest),
        styleV01=style,
        crossPack=v2_section,
        backlog=items,
        fallbacks=[
            dict(what='every state, direction and body with no accepted v0.1 frame', uses='the existing renderer',
                 where='src/painted-render.js drawPaintedActor returns false'),
            dict(what='Cast for cast2h / caststaff', uses='the unsplit v0.1 Cast candidates (same as cast1h)',
                 temporary=True, note='not two-handed or staff art'),
            dict(what='any worn item', uses='the existing renderer (strict mode)', note='no overlays exist for these bodies'),
        ])


def main():
    args = sys.argv[1:]
    path = os.path.join(OUT, 'backlog.json')
    old = json.load(open(path)) if os.path.exists(path) else {}
    v2_section = compare_v2(load_cells(), args[args.index('--v2') + 1]) if '--v2' in args else old.get('crossPack')
    text = json.dumps(build(v2_section), indent=1) + '\n'
    if '--check' in args:
        if not os.path.exists(path) or open(path).read() != text: sys.exit('backlog.json is out of date: run tools/painted_backlog.py')
        print('backlog.json up to date'); return
    open(path, 'w').write(text)
    print('wrote', os.path.relpath(path, ROOT))


if __name__ == '__main__':
    main()
