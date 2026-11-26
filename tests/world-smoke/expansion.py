# World expansion (v0.23) in the built game (Playwright + Chrome): the stretched Anniabreen keeps every town exactly as it was,
# the Southern Reach, camps and sealed dungeon mouths are in place and reachable, islands stay islands, and v0.22 saves move with the map.
# usage: python3 tests/world-smoke/expansion.py Shardfall_v0.23.html [/path/to/chrome]   (run.py calls it too)
import sys, json, os, subprocess, tempfile, time
from playwright.sync_api import sync_playwright
here = os.path.dirname(os.path.abspath(__file__)); f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.23.html'); chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
REF = json.load(open(os.path.join(here, 'towns_v022.json')))
HOLD = "window.__rafHold = true; { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => window.__rafHold ? 0 : raf(cb); }"
fails = 0
def check(ok, msg, got=None):
  global fails
  print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else '  got: ' + json.dumps(got)[:700])); fails += 0 if ok else 1
def page(b, url=None):
  ctx = b.new_context(viewport={'width': 844, 'height': 390}); pg = ctx.new_page(); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
  pg.add_init_script(HOLD); pg.goto('file://' + (url or f)); pg.wait_for_timeout(400); return ctx, pg, errs
def new_char(pg):
  pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(400); pg.fill('#ccn', 'Tess')
  return pg.evaluate("() => { const t0 = performance.now(); document.querySelector('[data-c=go]').click(); return performance.now() - t0; }")
J = lambda pg, js: pg.evaluate(js)
CALM = "for (const m of S.ents) if (m.kind === 'mon') m.pacified = 1e9;"

with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
  ctx, pg, errs = page(b); boot = new_char(pg)

  # 1. a bigger world; every Anniabreen town exactly as it was in v0.22
  r = J(pg, """() => { const S = __SF, ann = x => x >= 640, zs = {}, tiles = {};
    for (const z of S.ANN.zones) { zs[z.id] = [z.x1 - z.x0, z.y1 - z.y0]; const h = {}; for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0; x <= z.x1; x++) { const t = S.tAt(x, y); h[t] = (h[t] || 0) + 1; } tiles[z.id] = h; }
    return { W: S.GW, H: S.GH, zones: zs, tiles, builds: S.KBUILD.filter(b => ann(b.x)).length, doors: S.DOORS.filter(d => ann(d.x)).length, npcs: S.ANN.npcs.length, stations: S.STATIONS.filter(s => ann(s.x)).length, gates: S.ANN.gates.length,
      towns: S.ANN.towns.map(t => t.n + '@' + Math.round(t.x) + ',' + Math.round(t.y)) }; }""")
  check(r['W'] * r['H'] > 3.8e6 and r['W'] * r['H'] < 4.2e6, f"the world is {r['W']} × {r['H']} tiles, about twice v0.22's 2100 × 900", r['towns'])
  check(r['zones'] == REF['zones'] and [r[k] for k in ['builds', 'doors', 'npcs', 'stations', 'gates']] == [REF[k] for k in ['builds', 'doors', 'npcs', 'stations', 'gates']], 'towns keep their size, buildings, doors, townsfolk, stations and moongates', r)
  check(all(r['tiles'][z] == REF['tiles'][z] for z in REF['tiles']), 'every town is tile-for-tile the same as in v0.22 (moved by whole tiles)', {z: r['tiles'][z] == REF['tiles'][z] for z in REF['tiles']})
  check(boot < 6000, f'a new character enters the bigger world in {boot / 1000:.2f} s (desktop)', boot)

  # 2. camps, dungeon mouths and Southwatch
  r = J(pg, """() => { const S = __SF, F = S.FRONT; return { sites: F.sites.map(s => [s.id, s.k, s.n, S.zoneAt(s.x, s.y), s.trail]),
    spawners: S.SPAWNS.filter(s => s.site).map(s => [s.site, s.type, s.max]), shrine: S.SHRINES.find(s => s.id === 'southwatch'), ak: (() => { const s = S.SHRINES.find(s => s.id === 'southwatch'); return s && S.tAt(s.x, s.y) === S.T.AK; })(),
    labels: S.ANN.labels.filter(l => F.sites.some(s => s.n === l.n)).length, bounds: S.ANN_BOUNDS }; }""")
  kinds = [s[1] for s in r['sites']]
  check(kinds.count('camp') == 8 and kinds.count('dungeon') == 5 and kinds.count('outpost') == 1, '8 camps, 5 dungeon mouths and the Southwatch outpost', r['sites'])
  check(all(s[3] == 'site_' + s[0] or (s[1] == 'outpost' and s[3] == 'site_southwatch') for s in r['sites']), 'each site is its own named zone', [s[:4] for s in r['sites']])
  check(all(s[4] > 0 for s in r['sites'] if s[1] != 'outpost'), 'every camp and mouth has a trail to a road or town', [[s[0], s[4]] for s in r['sites']])
  check(len(r['spawners']) >= 10 and r['shrine'] and r['ak'] and r['labels'] >= 13 and r['bounds'][3] > 1450, 'camps have spawners, Southwatch has a shrine, sites are labelled on the map', r)
  r = J(pg, """() => { const S = __SF, P = S.P; for (let i = 0; i < 40; i++) { for (const sp of S.SPAWNS) sp.next = 0; S.update(.05); }
    const by = {}; for (const e of S.ents) if (e.kind === 'mon' && e.sp && e.sp.site) by[e.sp.site + ':' + e.type] = (by[e.sp.site + ':' + e.type] || 0) + 1; return by; }""")
  check(r.get('kragmaw:orc', 0) >= 4 and r.get('cutpurse:bandit', 0) >= 3 and r.get('barrows:skeleton', 0) >= 4 and r.get('scalemire:lizardman', 0) >= 3, 'camp creatures appear: orcs at Kragmaw, bandits at Cutpurse Hollow, skeletons in the Barrows, lizardmen at Scalemire', r)
  r = J(pg, """() => { const S = __SF, P = S.P, s = S.FRONT.sites.find(s => s.id === 'wyrmhold'); P.x = s.x + .5; P.y = s.y + 2; S.update(.01); const x0 = P.x, y0 = P.y; S.interact(); return { log: S.LOG.slice(-1)[0].t, moved: P.x !== x0 || P.y !== y0, zone: S.zoneAt(Math.floor(P.x), Math.floor(P.y)) }; }""")
  check('Wyrmhold' in r['log'] and 'sealed' in r['log'] and not r['moved'], "trying a dungeon mouth says plainly it is sealed for now", r)
  check(not errs, 'no page errors so far', errs[:5])

  # 3. land and water: the Reach is reached on foot over the causeway; Moonglen is still an island
  r = J(pg, """() => { const S = __SF, G = S.navGraph(); const sw = S.FRONT.sites.find(s => s.id === 'southwatch'), fork = S.annWarp(481, 681);
    const walk = (a, b) => { const j = S.navRequest(Math.floor(a[0]), Math.floor(a[1]), Math.floor(b[0]), Math.floor(b[1]), { doors: true, maxNodes: 400000 }, true); while (j.status === 'running') S.navTick(); return j.status; };
    const mg = S.ANN.towns.find(t => t.n === 'Moonglen'), vs = S.ANN.towns.find(t => t.n === 'Vespar');
    const places = S.navPlaces(), q = places.find(p => p.name === 'Saltmarsh Quay');
    return { causeway: walk(fork, [sw.x, sw.y]), moonglenOnFoot: walk([vs.x, vs.y], [mg.x, mg.y]), places: places.length, unreach: places.filter(p => !G.route(q.id, p.id)).map(p => p.name), zone: (c => S.zoneAt(c.x + 1, Math.floor((c.y0 + c.y1) / 2)))(S.FRONT.causeway), causewayLen: S.FRONT.causeway.y1 - S.FRONT.causeway.y0 }; }""")
  check(r['causeway'] == 'found' and r['zone'] == 'causeway', f"the Long Causeway ({r['causewayLen']} tiles) joins the forest fork to Southwatch on foot", r)
  check(r['moonglenOnFoot'] != 'found', 'Moonglen still needs the boat or a moongate (no land bridge)', r)
  check(r['places'] >= 33 and not r['unreach'], f"all {r['places']} named places can be reached from Saltmarsh Quay", r)
  ctx.close()

  # 4. real journeys into the new wilds
  def trip(dest, secs):
    ctx, pg, errs = page(b); new_char(pg)
    r = J(pg, """() => { const S = __SF; """ + CALM + """ const pl = S.navPlaces().find(p => p.name === %s); const e = S.devTraveller(pl.id); let i = 0;
      for (; i < %d * 20; i++) { S.simStep(.05); if (i %% 200 === 0) for (const m of S.ents) if (m.kind === 'mon') m.pacified = 1e9; if (e.nav.state !== 'moving') break; }
      return { state: e.nav.state, home: !!e.nav.home, why: e.nav.why || e.nav.reason || null, t: Math.round(i / 20), d: +Math.hypot(e.x - pl.x, e.y - pl.y).toFixed(1), legs: e.nav.legs.filter(l => l.kind === 'travel').map(l => l.via).join(' ') }; }""" % (json.dumps(dest), secs))
    ctx.close(); return r, errs
  for dest, via in [('Kragmaw Camp', 'packet'), ("Liar's Keep", 'boat'), ('Hollowdeep', 'packet'), ('Sorrowstone', 'packet')]:
    r, e = trip(dest, 1500)
    check(r['state'] == 'done' and not r['home'] and r['d'] < 3 and via in r['legs'] and not e, f"a traveller from Saltmarsh Quay reaches {dest} in {r['t']} s ({r['legs']})", {'r': r, 'errs': e[:3]})

  # 5. a v0.22 save made in Vespar, with a rune marked in Mynoc, a worked Mynoc ore face and a shut Vespar door, moves with the map
  old = os.path.join(tempfile.mkdtemp(), 'Shardfall_v0.22.html'); repo = os.path.dirname(os.path.dirname(here))
  open(old, 'wb').write(subprocess.run(['git', '-C', repo, 'show', 'feature/living-world-phase2:Shardfall_v0.22.html'], capture_output=True, check=True).stdout)
  ctx, pg, errs = page(b, old); new_char(pg)
  raw = J(pg, """() => { const S = __SF, P = S.P; P.x = 903.5 + 640; P.y = 579.5; const rune = S.SF.newItem('rune', 1); rune.mark = { x: 556.5 + 640, y: 296, name: 'Mynoc' }; S.SF.addItem(P.pack, rune);
    S.RES.set(219 * S.GW + 611 + 640, { gen: 1, n: 2, max: 8, t: 0 }); const d = S.DOORS.find(d => d.x > 1450 && d.x < 1700 && d.y > 560 && d.y < 620); S.setDoor(d, false); S.save(); return localStorage.getItem('shardfall.save.v1'); }""")
  ctx.close(); ctx, pg, errs = page(b); pg.evaluate("r => { localStorage.clear(); localStorage.setItem('shardfall.save.v1', r); }", raw); pg.reload(); pg.wait_for_timeout(400); pg.click('[data-c=cont]'); pg.wait_for_timeout(400)
  r = J(pg, """() => { const S = __SF, P = S.P, rune = P.pack.items.find(i => i.id === 'rune' && i.mark); S.save(); const sv = JSON.parse(localStorage.getItem('shardfall.save.v1')); const [fx, fy] = S.annWarp(611, 219);
    return { v: sv.v, zone: S.zoneAt(Math.floor(P.x), Math.floor(P.y)), stand: S.canStand(P, P.x, P.y), runeZone: S.zoneAt(Math.floor(rune.mark.x), Math.floor(rune.mark.y)), node: sv.nodes.some(n => n[0] === Math.round(fy) * S.GW + Math.round(fx)),
      shut: S.DOORS.filter(d => !d.open).length, shutKey: Object.keys(P.cx.doors), shutZone: (() => { const k = Object.keys(P.cx.doors)[0]; if (!k) return null; const [x, y] = k.split(',').map(Number); return S.zoneAt(x, y); })(), prev: !!localStorage.getItem('shardfall.save.v1.prev5') }; }""")
  check(r['v'] == 6 and r['zone'] == 'vespar' and r['stand'], 'a v0.22 character standing in Vespar loads standing in Vespar (save v6)', r)
  check(r['runeZone'] == 'mynoc' and r['node'] and r['shut'] == 1 and r['shutZone'] == 'vespar' and r['prev'], 'a rune still points at Mynoc, the Mynoc ore face and the shut Vespar door carry over, the old save is kept', r)
  check(not errs, 'no page errors after the migration', errs[:5]); ctx.close()
  b.close()
print('ALL PASS' if not fails else f'{fails} FAILED'); sys.exit(1 if fails else 0)
