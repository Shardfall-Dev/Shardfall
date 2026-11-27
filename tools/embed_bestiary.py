#!/usr/bin/env python3
"""Embed the bestiary packs into the single-file build.

usage: python3 tools/embed_bestiary.py [PACK ...] [-o src/bestiary-art.js]

Each PACK is either a versioned ZIP (manifest at assets/bestiary/v1/ or assets/bestiary/v<version>/ inside it)
or a directory holding manifest.json and the atlases. With no PACK the default set is used:
  assets/bestiary/Shardfall_Bestiary_v1.0.0.zip   (the original eleven sheets, unchanged)
  assets/bestiary/v1.1.0                           (draft01: boar, hound, snapper, spider, deer, hare)

The packs are merged into one manifest. Every pack must share the frame, rows, columns and animations of the
first one; a creature id may appear in only one pack. Each PNG must be a 5x8 grid of manifest-sized cells with
an alpha channel; when Pillow is installed every one of the 40 cells must also hold visible pixels.
Writes src/bestiary-art.js:
  const BESTIARY = { version, packs, frame, rows, columns, animations, mobs, src: { id: dataURI } };
mobs[i].pack names the pack version the sheet came from. The PNG bytes are embedded unchanged, so alpha,
the Lich Lord's rim and its glints stay as painted. Output is deterministic for the same inputs.
"""
import base64, io, json, os, struct, sys, zipfile

DEFAULT_PACKS = ['assets/bestiary/Shardfall_Bestiary_v1.0.0.zip', 'assets/bestiary/v1.1.0']
SHARED = ('frame', 'rows', 'columns', 'animations')


def png_info(b):
    if b[:8] != b'\x89PNG\r\n\x1a\n' or b[12:16] != b'IHDR':
        return None
    w, h = struct.unpack('>II', b[16:24])
    return w, h, b[25]  # colour type


class Pack:
    def __init__(self, path):
        self.path, self.name = path, os.path.basename(path.rstrip('/'))
        if os.path.isdir(path):
            self.z, self.base = None, path
            self.man = json.load(open(os.path.join(path, 'manifest.json')))
        else:
            self.z = zipfile.ZipFile(path)
            names = [n for n in self.z.namelist() if n.startswith('assets/bestiary/') and n.endswith('/manifest.json')]
            if len(names) != 1:
                raise SystemExit(f'{path}: expected one assets/bestiary/*/manifest.json, found {names}')
            self.base = names[0][:-len('manifest.json')]
            self.man = json.loads(self.z.read(names[0]))

    def read(self, atlas):
        if '/' in atlas or '\\' in atlas or atlas.startswith('.'):
            raise SystemExit(f'{self.name}: atlas name {atlas!r} must be a plain file name')
        return self.z.read(self.base + atlas) if self.z else open(os.path.join(self.base, atlas), 'rb').read()


def cell_check(b, fw, fh, cols, rows):
    try:
        from PIL import Image
    except ImportError:
        return None
    a = Image.open(io.BytesIO(b)).convert('RGBA').getchannel('A')
    return [(r, c) for r in range(rows) for c in range(cols) if a.crop((c * fw, r * fh, c * fw + fw, r * fh + fh)).getbbox() is None]


def main(argv):
    out, packs = 'src/bestiary-art.js', []
    it = iter(argv)
    for a in it:
        if a in ('-o', '--out'):
            out = next(it)
        elif a.endswith('.js'):
            out = a   # old call form: embed_bestiary.py ZIP OUT
        else:
            packs.append(a)
    packs = [Pack(p) for p in (packs or DEFAULT_PACKS)]
    first = packs[0].man
    merged = {k: first[k] for k in SHARED}
    fw, fh = first['frame']['width'], first['frame']['height']
    cols, rows = len(first['columns']), len(first['rows'])
    mobs, src, bad, owner, cellcheck = [], {}, [], {}, True
    for pk in packs:
        m = pk.man
        for k in SHARED:
            if m.get(k) != first[k]:
                bad.append(f'{pk.name}: "{k}" differs from {packs[0].name}')
        for mob in m['mobs']:
            id = mob['id']
            if id in owner:
                bad.append(f'{pk.name}: duplicate creature id "{id}" (already in {owner[id]})'); continue
            owner[id] = pk.name
            try:
                b = pk.read(mob['atlas'])
            except (KeyError, FileNotFoundError):
                bad.append(f'{pk.name}: {id}: atlas {mob["atlas"]} missing'); continue
            info = png_info(b)
            if not info:
                bad.append(f'{pk.name}: {id}: not a PNG'); continue
            w, h, ct = info
            if (w, h) != (fw * cols, fh * rows):
                bad.append(f'{pk.name}: {id}: {w}x{h}, expected {fw * cols}x{fh * rows}')
            if ct not in (4, 6) and not (ct == 3 and b'tRNS' in b):
                bad.append(f'{pk.name}: {id}: no alpha channel')
            empty = cell_check(b, fw, fh, cols, rows) if (w, h) == (fw * cols, fh * rows) else []
            if empty is None:
                cellcheck = False
            elif empty:
                bad.append(f'{pk.name}: {id}: empty cells (row, col) {empty[:6]}')
            mobs.append(dict(mob, pack=m['version']))
            src[id] = 'data:image/png;base64,' + base64.b64encode(b).decode()
    if bad:
        raise SystemExit('bestiary pack rejected:\n  ' + '\n  '.join(bad))
    versions = [p.man['version'] for p in packs]
    data = {'version': '+'.join(versions), 'packs': versions, **merged, 'mobs': mobs, 'src': src}
    with open(out, 'w') as f:
        f.write('/* Shardfall bestiary %s: generated by tools/embed_bestiary.py from %s. Do not edit by hand. */\n'
                % (' + '.join('v' + v for v in versions), ', '.join(p.name for p in packs)))
        f.write('const BESTIARY=' + json.dumps(data, separators=(',', ':')) + ';\n')
    print(f"wrote {out}: {len(src)} sheets from {len(packs)} packs ({', '.join(versions)})"
          + ('' if cellcheck else '; Pillow missing, per-cell check skipped'))


if __name__ == '__main__':
    main(sys.argv[1:])
