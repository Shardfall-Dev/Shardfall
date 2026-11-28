"""Shardfall 3D → sprite packer, pipeline v1.0.0 (plain Python 3 + Pillow; no Blender needed).

Takes the frames sf_render.py wrote (render_out/<layer>/<action>/<DIR>/<NN>.png and .mask.png at cell × supersample),
scales them to the game cell, optionally adds the 1 px dark outline of the painted style, packs one sheet per layer and
action (columns = frames, rows = S SW W NW N NE E SE), checks them, and writes a versioned ZIP with a manifest:

    python3 tools/sprites3d/sf_pack.py render_out [--out DIR] [--no-zip]

Checks (failures are listed in the manifest and the exit code is 1):
  * every frame exists, has the cell size and real transparency;
  * body: the feet sit on the anchor row (±2 px) and near the anchor column, the figure height is steady in each action
    (±3 px) and matches figure_px (±10 %);
  * layers: every action and direction has some pixels (a piece can hide in single frames, not in a whole direction);
  * masks: every opaque pixel of a layer has a material weight."""
import json, os, sys, zipfile
from PIL import Image, ImageFilter, ImageChops

DIRS = ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']


def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def downscale(im, size, kind):
    """colour: premultiplied-alpha Lanczos (no dark fringes); mask: box filter (weights stay weights)"""
    if im.size == tuple(size): return im
    if kind == 'mask': return im.resize(size, Image.BOX)
    r, g, b, a = im.split(); a_f = a
    pre = Image.merge('RGB', [ImageChops.multiply(ch, a_f) for ch in (r, g, b)])
    pre_s = pre.resize(size, Image.LANCZOS); a_s = a.resize(size, Image.LANCZOS)
    px, pa = pre_s.load(), a_s.load(); out = Image.new('RGBA', size); po = out.load()
    for y in range(size[1]):
        for x in range(size[0]):
            al = pa[x, y]
            if al == 0: po[x, y] = (0, 0, 0, 0); continue
            c = px[x, y]; po[x, y] = (min(255, c[0] * 255 // al), min(255, c[1] * 255 // al), min(255, c[2] * 255 // al), al)
    return out


def harden(im, cut):
    """pixel-art alpha: below cut → transparent, above → opaque (cut 0 keeps soft edges)"""
    if not cut: return im
    a = im.getchannel('A').point(lambda v: 255 if v >= cut else 0); im = im.copy(); im.putalpha(a); return im


def outline(im, colour):
    """a 1 px outline just outside the silhouette (4-neighbour), in the painted style's dark brown"""
    a = im.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
    grown = a.filter(ImageFilter.MaxFilter(3))
    ring = ImageChops.subtract(grown, a)
    # keep the ring 4-connected only (MaxFilter(3) also grows diagonals, which reads as a heavy line)
    w, h = a.size; ap, rp = a.load(), ring.load(); out = im.copy(); po = out.load(); r, g, b = colour
    for y in range(h):
        for x in range(w):
            if not rp[x, y]: continue
            if (x > 0 and ap[x - 1, y]) or (x < w - 1 and ap[x + 1, y]) or (y > 0 and ap[x, y - 1]) or (y < h - 1 and ap[x, y + 1]):
                po[x, y] = (r, g, b, 255)
    return out


def bbox_alpha(im, cut=128):
    return im.getchannel('A').point(lambda v: 255 if v >= cut else 0).getbbox()


def main():
    argv = sys.argv[1:]
    if not argv: raise SystemExit(__doc__)
    src = argv[0]; out = argv[argv.index('--out') + 1] if '--out' in argv else os.path.join(src, '..', 'pack')
    meta = json.load(open(os.path.join(src, 'render.json'))); c = meta['config']
    cell = tuple(c['cell']); ax, ay = c['anchor']; fig = c['figure_px']
    name = c.get('pack_name', 'Shardfall_Human3D'); ver = c.get('version', '0.1.0')
    oc = c.get('outline', '#1c140e'); cut = c.get('alpha_cut', 0)
    os.makedirs(out, exist_ok=True); problems = []; man = {'pack': name, 'version': ver, 'pipeline': '1.0.0', 'contract': {'cell': list(cell), 'anchor': [ax, ay], 'rows': DIRS,
        'masks': 'R primary, G secondary, B fixed, A = the layer alpha'}, 'layers': {}}
    for L in c['layers']:
        lid = L['id']; entry = {'slot': L.get('slot'), 'items': L.get('items', []), 'z': L.get('z', 0), 'actions': {}}
        for A in c['actions']:
            an, n = A['name'], A['frames']
            sheet = Image.new('RGBA', (cell[0] * n, cell[1] * 8)); msheet = Image.new('RGBA', sheet.size); has_mask = False
            heights = []
            for r, d in enumerate(DIRS):
                any_px = False
                for f in range(n):
                    p = os.path.join(src, lid, an, d, '%02d.png' % f)
                    if not os.path.exists(p): problems.append(f'{lid}/{an}/{d}/{f:02d}: missing'); continue
                    im = Image.open(p).convert('RGBA')
                    if im.size[0] * cell[1] != im.size[1] * cell[0]: problems.append(f'{lid}/{an}/{d}/{f:02d}: size {im.size} is not the cell shape'); continue
                    im = harden(downscale(im, cell, 'color'), cut)
                    if oc: im = outline(im, hexrgb(oc))
                    sheet.alpha_composite(im, (f * cell[0], r * cell[1]))
                    bb = bbox_alpha(im)
                    if bb: any_px = True
                    if lid == 'body' and bb:
                        feet, top = bb[3] - 1 - (1 if oc else 0), bb[1] + (1 if oc else 0)
                        heights.append(feet - top + 1)
                        if abs(feet - ay) > 2: problems.append(f'body/{an}/{d}/{f:02d}: feet on row {feet}, anchor row is {ay}')
                        cx = (bb[0] + bb[2]) / 2
                        if abs(cx - ax) > cell[0] * .2: problems.append(f'body/{an}/{d}/{f:02d}: figure centre x {cx:.0f}, anchor x is {ax}')
                    mp = p[:-4] + '.mask.png'
                    if os.path.exists(mp):
                        has_mask = True; m = downscale(Image.open(mp).convert('RGBA'), cell, 'mask'); m.putalpha(im.getchannel('A'))
                        mpx, apx = m.load(), im.getchannel('A').load(); bad = 0
                        for y in range(cell[1]):
                            for x in range(cell[0]):
                                if apx[x, y] >= 128 and sum(mpx[x, y][:3]) == 0: bad += 1
                        if bad > cell[0] * cell[1] * .01: problems.append(f'{lid}/{an}/{d}/{f:02d}: {bad} opaque pixels have no material weight')
                        msheet.alpha_composite(m, (f * cell[0], r * cell[1]))
                if not any_px: problems.append(f'{lid}/{an}/{d}: empty in every frame')
            if lid == 'body' and heights:
                if max(heights) - min(heights) > 3 + (2 if an.lower() not in ('idle', 'walk') else 0): problems.append(f'body/{an}: figure height varies {min(heights)}–{max(heights)} px')
                if an.lower() == 'idle' and abs(sum(heights) / len(heights) - fig) > fig * .1: problems.append(f'body/{an}: figure {sum(heights) / len(heights):.0f} px tall, figure_px is {fig}')
            os.makedirs(os.path.join(out, lid), exist_ok=True)
            sp = f'{lid}/{an}.png'; sheet.save(os.path.join(out, sp))
            ent = {'frames': n, 'loop': A.get('loop', True), 'fps': A.get('fps', 8), 'sheet': sp}
            if has_mask: mpth = f'{lid}/{an}.mask.png'; msheet.save(os.path.join(out, mpth)); ent['mask'] = mpth
            entry['actions'][an] = ent
        man['layers'][lid] = entry
    # preview: every layer composited in z order, first frame of each action, 8 directions
    order = sorted(c['layers'], key=lambda L: L.get('z', 0))
    rows = c['actions']; pv = Image.new('RGBA', (cell[0] * 8, cell[1] * len(rows)), (48, 44, 40, 255))
    for ri, A in enumerate(rows):
        for L in order:
            sh = Image.open(os.path.join(out, L['id'], A['name'] + '.png'))
            for r in range(8): pv.alpha_composite(sh.crop((0, r * cell[1], cell[0], (r + 1) * cell[1])), (r * cell[0], ri * cell[1]))
    pv.save(os.path.join(out, 'preview.png'))
    man['checks'] = {'ok': not problems, 'problems': problems[:500], 'count': len(problems)}
    json.dump(man, open(os.path.join(out, 'manifest.json'), 'w'), indent=1)
    if '--no-zip' not in argv:
        zp = os.path.join(out, f'{name}_v{ver}.zip')
        with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as z:
            for root, _, files in os.walk(out):
                for fn in files:
                    if fn.endswith('.zip'): continue
                    full = os.path.join(root, fn); z.write(full, os.path.join(f'{name}_v{ver}', os.path.relpath(full, out)))
        print('sf_pack: wrote', zp)
    print('sf_pack: %d layer(s), %d action(s); %s' % (len(c['layers']), len(c['actions']), 'all checks pass' if not problems else '%d problem(s), first: %s' % (len(problems), problems[0])))
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()
