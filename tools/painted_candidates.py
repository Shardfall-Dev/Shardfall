#!/usr/bin/env python3
"""Painted Human Candidates v0.1: validate the pack and embed only the accepted frames.

usage:
  python3 tools/painted_candidates.py            # QA: writes assets/humans/painted-candidates-v0.1/qa.json and missing.json
  python3 tools/painted_candidates.py --embed    # QA, then writes src/painted-art.js (accepted cells only)
  python3 tools/painted_candidates.py --check    # fails if qa.json, missing.json or src/painted-art.js are out of date

Reads asset-packs/painted-human-candidates-v0.1/Shardfall_Painted_Candidates_v0.1.zip in memory (nothing is extracted) and checks
its SHA-256 against the handoff. Automatic checks run on every cell; assets/humans/painted-candidates-v0.1/review.json holds the
manual verdicts (facing, pose, cropping, borderline background remnants). Rejected cells are cleared to transparent in the
embedded sheets, so the game can never draw them. No frame is duplicated, mirrored, interpolated or repainted. Needs Pillow.
"""
import sys, os, io, json, base64, hashlib, zipfile, fnmatch, statistics

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIP = os.path.join(ROOT, 'asset-packs/painted-human-candidates-v0.1/Shardfall_Painted_Candidates_v0.1.zip')
SHA = '17b1b497dd80dbb87f6c1ea0b5a679d13aa1f6dcd0984f9fccc54a1a0d95c7b1'
OUT = os.path.join(ROOT, 'assets/humans/painted-candidates-v0.1')
ART = os.path.join(ROOT, 'src/painted-art.js')
BODIES = ['male', 'female']
ACTIONS = ['Idle', 'Walk', 'Cast', 'Unarmed_Attack']
ROWS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']
CELL, FX, FY, NF = 128, 64, 106, 3
# thresholds (documented in docs/humans/PAINTED_CANDIDATES.md)
DARK_REJECT = 10      # near-black pixels (max channel < 48) in the leg band y 66..106: baked background between or behind the legs
SPECK_REJECT = 3      # near-black pixels (max channel < 35) on the ground band y 100..106: stray specks at the feet
ISLAND_REJECT = 4     # detached opaque islands of at least this many pixels
FEET_ROW = (104, 105) # the lowest opaque row must sit on the anchor line (anchor y 106 is the first empty row)


def main():
    from PIL import Image
    mode = sys.argv[1] if len(sys.argv) > 1 else ''
    raw = open(ZIP, 'rb').read()
    sha = hashlib.sha256(raw).hexdigest()
    if sha != SHA: sys.exit(f'archive SHA-256 {sha} does not match the handoff ({SHA})')
    z = zipfile.ZipFile(io.BytesIO(raw))
    names = set(z.namelist())
    review = json.load(open(os.path.join(OUT, 'review.json')))
    pack_manifest = json.loads(z.read('manifest.json'))
    if pack_manifest.get('cell') != [CELL, CELL] or pack_manifest.get('feetAnchor') != [FX, FY] or pack_manifest.get('rowOrder') != ROWS or pack_manifest.get('framesPerDirection') != NF:
        sys.exit('pack manifest no longer matches the atlas contract (cell, feet anchor, row order, frames per direction)')

    def rv(table, key):
        for pat, why in review.get(table, {}).items():
            if fnmatch.fnmatchcase(key, pat): return why
        return None

    frames, sheets, seen = {}, {}, {}
    for b in BODIES:
        for a in ACTIONS:
            sh = Image.open(io.BytesIO(z.read(f'{b}/{a}.png')))
            if sh.size != (NF * CELL, len(ROWS) * CELL): sys.exit(f'{b}/{a}.png is {sh.size}, expected {(NF * CELL, len(ROWS) * CELL)}')
            sh = sh.convert('RGBA'); sheets[(b, a)] = sh
            for ri, d in enumerate(ROWS):
                for f in range(NF):
                    key = f'{b}/{a}/{d}/{f:02d}'
                    c = sh.crop((f * CELL, ri * CELL, f * CELL + CELL, ri * CELL + CELL)); px = c.load()
                    rej, warn, m = [], [], {}
                    loose = f'{b}/{a}/{d}/{f:02d}.png'
                    if loose not in names: rej.append('missing loose PNG ' + loose)
                    elif Image.open(io.BytesIO(z.read(loose))).convert('RGBA').tobytes() != c.tobytes(): rej.append('loose PNG differs from the sheet cell')
                    bb = c.getchannel('A').getbbox()
                    if not bb: rej.append('empty cell'); frames[key] = dict(status='rejected', reasons=rej, warnings=warn, metrics=m); continue
                    m['bbox'] = list(bb)
                    if bb[0] == 0 or bb[1] == 0 or bb[2] == CELL or bb[3] == CELL: rej.append('figure touches the cell edge (cropped)')
                    bottom = bb[3] - 1; m['feetRow'] = bottom
                    if not FEET_ROW[0] <= bottom <= FEET_ROW[1]: rej.append(f'feet not on the anchor line (lowest row {bottom}, expected {FEET_ROW[1]})')
                    semi = dark = speck = 0; xs = []
                    for y in range(CELL):
                        for x in range(CELL):
                            r, g, bl, al = px[x, y]
                            if not al: continue
                            if al < 255: semi += 1
                            mx = max(r, g, bl)
                            if 66 <= y < FY and mx < 48: dark += 1
                            if 100 <= y < FY and mx < 35: speck += 1
                            if al > 128 and y >= bottom - 5: xs.append(x)
                    fx = sum(xs) / len(xs); m.update(semiAlpha=semi, darkLegBand=dark, footSpecks=speck, feetX=round(fx, 1))
                    # detached islands (4-connected)
                    seenpx, comps = set(), []
                    for y in range(CELL):
                        for x in range(CELL):
                            if px[x, y][3] and (x, y) not in seenpx:
                                st = [(x, y)]; seenpx.add((x, y)); n = 0
                                while st:
                                    u, v = st.pop(); n += 1
                                    for q in ((u + 1, v), (u - 1, v), (u, v + 1), (u, v - 1)):
                                        if 0 <= q[0] < CELL and 0 <= q[1] < CELL and q not in seenpx and px[q][3]: seenpx.add(q); st.append(q)
                                comps.append(n)
                    comps.sort(reverse=True); m['islands'] = comps[1:]
                    if any(n >= ISLAND_REJECT for n in comps[1:]): rej.append(f'detached alpha island ({max(comps[1:])} px)')
                    elif comps[1:]: warn.append(f'{len(comps) - 1} stray pixel(s) detached from the figure')
                    if semi: warn.append(f'{semi} semi-transparent pixels')
                    if dark >= DARK_REJECT and not rv('accept_despite_metric', key): rej.append(f'baked dark background remnant in the leg band ({dark} px)')
                    if speck >= SPECK_REJECT: rej.append(f'stray dark specks at the feet ({speck} px)')
                    elif speck: warn.append(f'{speck} dark speck pixel(s) at the feet')
                    if abs(fx - FX) > 8: warn.append(f'feet centre {fx:.1f} is {fx - FX:+.1f} px from the anchor x')
                    h = hashlib.sha256(c.tobytes()).hexdigest()
                    if h in seen: rej.append('duplicate of ' + seen[h])
                    else: seen[h] = key
                    why = rv('reject', key)
                    if why: rej.append(why)
                    for pat, w in review.get('warnings', {}).items():
                        pats = [pat]
                        if '{' in pat: pre, rest = pat.split('{', 1); opts, post = rest.split('}', 1); pats = [pre + o + post for o in opts.split(',')]
                        if any(fnmatch.fnmatchcase(key, p) or fnmatch.fnmatchcase(key, p + '/*') for p in pats): warn.append(w)
                    frames[key] = dict(status='rejected' if rej else 'accepted', reasons=rej, warnings=warn, metrics=m)
    # per-row consistency warnings: foot registration jitter and figure height between candidates of one direction
    for b in BODIES:
        for a in ACTIONS:
            for d in ROWS:
                ks = [f'{b}/{a}/{d}/{f:02d}' for f in range(NF)]
                acc = [k for k in ks if frames[k]['status'] == 'accepted']
                if len(acc) > 1:
                    fx = [frames[k]['metrics']['feetX'] for k in acc]; tops = [frames[k]['metrics']['bbox'][1] for k in acc]
                    if max(fx) - min(fx) > 5: [frames[k]['warnings'].append(f'foot registration differs by {max(fx) - min(fx):.1f} px across this direction') for k in acc]
                    if max(tops) - min(tops) > 5: [frames[k]['warnings'].append(f'head height differs by {max(tops) - min(tops)} px across this direction') for k in acc]

    accepted = {b: {a: {d: [f for f in range(NF) if frames[f'{b}/{a}/{d}/{f:02d}']['status'] == 'accepted'] for d in ROWS} for a in ACTIONS} for b in BODIES}
    n_acc = sum(1 for v in frames.values() if v['status'] == 'accepted')
    reasons = {}
    for v in frames.values():
        for r in v['reasons']:
            k = r.split(':')[0] if ':' in r else r.split(' (')[0]; reasons[k] = reasons.get(k, 0) + 1
    qa = {
        'pack': 'Shardfall_Painted_Candidates_v0.1', 'archiveSha256': SHA, 'status': 'experimental; accepted frames are usable behind the developer flag only',
        'contract': {'cell': [CELL, CELL], 'feetAnchor': [FX, FY], 'rowOrder': ROWS, 'framesPerDirection': NF, 'sameAs': 'Saltmarsh Scout animation sheets (src/game.js drawPlayerAnim)'},
        'thresholds': {'darkLegBandReject': DARK_REJECT, 'footSpeckReject': SPECK_REJECT, 'islandRejectPx': ISLAND_REJECT, 'feetRow': list(FEET_ROW)},
        'summary': {'frames': len(frames), 'accepted': n_acc, 'rejected': len(frames) - n_acc, 'rejectReasons': dict(sorted(reasons.items(), key=lambda kv: -kv[1])),
                    'directionsWithNoAcceptedFrame': sorted(f'{b}/{a}/{d}' for b in BODIES for a in ACTIONS for d in ROWS if not accepted[b][a][d])},
        'accepted': accepted, 'frames': frames,
    }
    missing = build_missing(accepted)
    write(os.path.join(OUT, 'qa.json'), json.dumps(qa, indent=1) + '\n', mode)
    write(os.path.join(OUT, 'missing.json'), json.dumps(missing, indent=1) + '\n', mode)
    print(f'{len(frames)} frames: {n_acc} accepted, {len(frames) - n_acc} rejected')
    if mode in ('--embed', '--check'): write(ART, embed(sheets, accepted, frames, qa), mode)


def build_missing(accepted):
    """Machine-readable list of what this pack does NOT provide. Nothing here is marked complete."""
    gaps = []
    for b in BODIES:
        for a in ACTIONS:
            for d in ROWS:
                n = len(accepted[b][a][d])
                if n == 0: gaps.append({'body': b, 'action': a, 'dir': d, 'need': 'a validated frame set (every candidate rejected)'})
    return {
        'pack': 'Shardfall_Painted_Candidates_v0.1',
        'note': 'Generated by tools/painted_candidates.py. Lists art that is genuinely missing; the game falls back to the existing renderer for every item here.',
        'directionGaps': gaps,
        'incompleteCycles': {'reason': 'three candidate poses per direction; none is a complete cycle', 'have': '0-3 accepted poses per body/action/direction',
                             'need': {'Idle': 4, 'Walk': 8, 'Cast': 'CastPrepare 6 + CastHold 4 + CastRelease', 'Unarmed_Attack': 8}},
        'missingActions': ['run', 'ready / combat stance', 'hit', 'death', 'corpse', 'ghost', 'CastPrepare / CastHold / CastRelease (Cast is unsplit)',
                           'every weapon attack family (slash, chop, blunt, thrust 1h/2h, polearm, staff, bow, crossbow)', 'shield block',
                           'mining, woodcutting, fishing, smithing, crafting, bandaging'],
        'missingLayers': ['clean base body without baked hair (hair is baked in)', 'isolated hair styles and colours', 'beards', 'skin-tone masks',
                          'underwear / shirt / trousers / shoes as clothing layers', 'every armour slot overlay (head, neck, torso, arms, hands, legs, feet)',
                          'robe / tabard / cloak overlays with per-direction occlusion', 'weapon overlays and hand sockets', 'shield overlays',
                          'tint masks for material colours', 'paperdoll portrait art matching these bodies'],
        'complete': [],
    }


def embed(sheets, accepted, frames, qa):
    from PIL import Image
    out = {}
    for (b, a), sh in sheets.items():
        clean = Image.new('RGBA', sh.size, (0, 0, 0, 0))
        for ri, d in enumerate(ROWS):
            for f in accepted[b][a][d]:
                box = (f * CELL, ri * CELL, f * CELL + CELL, ri * CELL + CELL); clean.paste(sh.crop(box), box[:2])
        buf = io.BytesIO(); clean.save(buf, 'PNG', optimize=True)
        out[f'{b}/{a}'] = 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
    meta = {'version': '0.1', 'archiveSha256': SHA, 'cell': CELL, 'anchor': [FX, FY], 'rows': ROWS, 'frames': NF, 'accepted': accepted,
            'counts': {'accepted': qa['summary']['accepted'], 'rejected': qa['summary']['rejected']},
            'rejected': {k: v['reasons'] for k, v in frames.items() if v['status'] == 'rejected'}}
    return ('<script>\n/* Painted Human Candidates v0.1 — generated by tools/painted_candidates.py --embed from\n'
            '   asset-packs/painted-human-candidates-v0.1/Shardfall_Painted_Candidates_v0.1.zip. Do not edit by hand.\n'
            '   Only cells accepted by the QA in assets/humans/painted-candidates-v0.1/qa.json are present; rejected cells are transparent.\n'
            '   Experimental art, drawn only behind the developer flag (src/painted-render.js). */\n'
            '(function (root) { root.PAINTED_ART = ' + json.dumps(dict(meta, sheets=out), separators=(',', ':')) + '; })(typeof globalThis !== "undefined" ? globalThis : this);\n</script>\n')


def write(path, text, mode):
    if mode == '--check':
        cur = open(path).read() if os.path.exists(path) else None
        if cur != text: sys.exit(f'{os.path.relpath(path, ROOT)} is out of date: run python3 tools/painted_candidates.py --embed')
        return
    with open(path, 'w') as fh: fh.write(text)


if __name__ == '__main__':
    main()
