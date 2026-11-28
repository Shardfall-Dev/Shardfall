# Export the game world for the server: tiles, wall / prop colliders, and every starting town's spawn, straight from the
# built game (the world is generated deterministically by src/game.js genWorld + anniabreen.js + frontier.js).
#   python3 tools/export-world.py [Shardfall_vX.html]          writes server/data/world.bin.gz and server/data/world.json
#   python3 tools/export-world.py --check [Shardfall_vX.html]  fails if the committed files no longer match the build
# Checks every time: the world is identical on two separate loads (determinism) and shared/collision.js canStand answers
# exactly like the game's canStand on 300 000 random points, around every collider and around every tree / rock / reed.
# Needs Python Playwright and Google Chrome (CHROME=path to override).
import asyncio, base64, glob, gzip, hashlib, json, os, re, sys, threading, http.server, functools
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_BIN = os.path.join(ROOT, 'server', 'data', 'world.bin.gz')
OUT_JSON = os.path.join(ROOT, 'server', 'data', 'world.json')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')

def latest_build():
    v = lambda f: [int(x) for x in re.sub(r'^.*Shardfall_v|\.html$', '', f).split('.')]
    files = [f for f in glob.glob(os.path.join(ROOT, 'Shardfall_v*.html')) if re.search(r'Shardfall_v[\d.]+\.html$', f)]
    return max(files, key=v)

def serve(port_holder):
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    h = functools.partial(Quiet, directory=ROOT)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), h); port_holder.append(srv.server_address[1]); srv.serve_forever()

EXPORT_JS = """async () => {
  const s = __ONLINE.worldSource(); const C = SF_COLLISION; const w = C.makeWorld(s);
  let seed = 20261128; const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  let n = 0, diff = 0; const ex = [];
  const cmp = (x, y) => { n++; if (s.gameStand(x, y) !== C.canStand(w, x, y)) { diff++; if (ex.length < 10) ex.push([x, y]); } };
  for (let i = 0; i < 300000; i++) cmp(rnd() * s.W, rnd() * s.H);
  for (const r of s.rects) for (let k = 0; k < 8; k++) cmp(r[0] - .5 + rnd() * (r[2] - r[0] + 1), r[1] - .5 + rnd() * (r[3] - r[1] + 1));
  let soft = 0; for (let i = 0; i < s.tiles.length && soft < 40000; i += 97) if (w.soft[s.tiles[i]]) { soft++; const x = i % s.W, y = (i - x) / s.W; for (let k = 0; k < 4; k++) cmp(x - .3 + rnd() * 1.6, y - .3 + rnd() * 1.6); }
  const spawns = s.townSpawns(); const bin = C.encode(w);
  let b64 = ''; for (let i = 0; i < bin.length; i += 0x8000) b64 += String.fromCharCode.apply(null, bin.subarray(i, i + 0x8000));
  return { W: s.W, H: s.H, rects: s.rects.length, hash: C.hash(w), compared: n, diff, ex, spawns, shrines: s.shrines, bin: btoa(b64) };
}"""

async def load(browser, url):
    ctx = await browser.new_context(); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.route(re.compile(r'^https?://(?!127\.0\.0\.1)'), lambda r: r.abort())   # the game makes no network calls it needs here
    await pg.goto(url); await pg.wait_for_selector('[data-c=new]')
    ok = await pg.evaluate("__CC.quick({name:'Cartographer', template:'swordsman', town:'quay'})")
    if not ok: raise SystemExit('the game did not start')
    r = await pg.evaluate(EXPORT_JS); await ctx.close()
    if errs: raise SystemExit('page errors: ' + '; '.join(errs[:3]))
    return r

async def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]; check = '--check' in sys.argv
    build = os.path.abspath(args[0]) if args else latest_build(); name = os.path.basename(build)
    ph = []; threading.Thread(target=serve, args=(ph,), daemon=True).start()
    while not ph: await asyncio.sleep(.05)
    url = f'http://127.0.0.1:{ph[0]}/{name}'
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        a = await load(b, url); c = await load(b, url); await b.close()
    if a['hash'] != c['hash'] or a['bin'] != c['bin']: raise SystemExit('FAIL the world differs between two loads: world generation is not deterministic')
    print(f"ok   deterministic world {a['W']}x{a['H']}, {a['rects']} colliders, hash {a['hash']}")
    if a['diff']: raise SystemExit(f"FAIL shared/collision.js disagrees with the game's canStand on {a['diff']} of {a['compared']} points, e.g. {a['ex'][:3]}")
    print(f"ok   shared/collision.js matches the game's canStand on all {a['compared']} sampled points")
    bad = [k for k, v in a['spawns'].items() if not v.get('ok')]
    if bad: raise SystemExit('FAIL towns without a spawn: ' + ', '.join(bad))
    raw = base64.b64decode(a['bin'])
    manifest = { 'format': 1, 'build': re.sub(r'^Shardfall_v|\.html$', '', name), 'hash': a['hash'], 'W': a['W'], 'H': a['H'], 'colliders': a['rects'],
                 'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw),
                 'spawns': { k: { 'x': v['spawn']['x'], 'y': v['spawn']['y'], 'bound': v['bound'] } for k, v in a['spawns'].items() },
                 'shrines': a['shrines'], 'note': 'Generated by tools/export-world.py from the game build. Do not edit by hand.' }
    if check:
        try: old = json.load(open(OUT_JSON))
        except FileNotFoundError: raise SystemExit('FAIL server/data/world.json is missing: run python3 tools/export-world.py')
        same = old.get('hash') == manifest['hash'] and old.get('sha256') == manifest['sha256'] and old.get('spawns') == manifest['spawns']
        if not same: raise SystemExit(f"FAIL the world in {name} (hash {manifest['hash']}) differs from server/data/world.json (hash {old.get('hash')}): run python3 tools/export-world.py and commit server/data/")
        with gzip.open(OUT_BIN, 'rb') as f:
            if hashlib.sha256(f.read()).hexdigest() != manifest['sha256']: raise SystemExit('FAIL server/data/world.bin.gz does not match server/data/world.json: re-export')
        print(f"ok   server/data matches {name}"); return
    os.makedirs(os.path.dirname(OUT_BIN), exist_ok=True)
    with gzip.GzipFile(OUT_BIN, 'wb', compresslevel=9, mtime=0) as f: f.write(raw)
    json.dump(manifest, open(OUT_JSON, 'w'), indent=2); open(OUT_JSON, 'a').write('\n')
    print(f"wrote server/data/world.bin.gz ({os.path.getsize(OUT_BIN)} bytes) and server/data/world.json for {name}")

asyncio.run(main())
