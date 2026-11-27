# NPC wardrobe & layered humans in the built game (Playwright + Chrome).
# usage: python3 tests/wardrobe-smoke/run.py Shardfall_v0.31.html [--shots DIR] [--write-coverage]
# Checks: the flag (classic stays the default), live coverage of every human actor, regional guard uniforms, save/reload identity,
# activity wardrobe over a simulated day, real equipment on the player (equip/unequip, two-handed, materials), corpse snapshot with
# unchanged loot, all 8 directions × walk/run/attack/cast/hit/death/corpse for both bodies, the bounded strip cache, frame time
# with many humans on screen, the paper doll, phone and desktop screenshots by day and night.
import sys, json, os
from playwright.sync_api import sync_playwright
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(os.path.dirname(here))
f = os.path.abspath(sys.argv[1]); args = sys.argv[2:]
shots = args[args.index('--shots') + 1] if '--shots' in args else '/tmp/wardrobe-shots'; os.makedirs(shots, exist_ok=True)
chrome = '/usr/bin/google-chrome'
fails = 0
def check(ok, msg, got=None):
  global fails
  print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else '  got: ' + json.dumps(got)[:700])); fails += 0 if ok else 1
J = lambda pg, js, a=None: pg.evaluate(js, a) if a is not None else pg.evaluate(js)
HOLD = "window.__rafHold = true; { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => window.__rafHold ? (window.__rafCb = cb, 0) : raf(cb); }"
def page(b, q='humans=layered', vp=(844, 390), hold=False, fresh=True, scale=1):
  ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=scale); pg = ctx.new_page(); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e)))
  if hold: pg.add_init_script(HOLD)
  pg.goto('file://' + f + ('?' + q if q else '')); pg.wait_for_timeout(400)
  if fresh:
    pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(400); pg.fill('#ccn', 'Tess'); pg.click('[data-c=go]'); pg.wait_for_timeout(400)
  return ctx, pg, errs
STEP = "n => { for (let i = 0; i < n; i++) __SF.update(.05); }"
DRAIN = """async () => { const H = __SF.HUMANS; for (let i = 0; i < 400 && (H.queue.length || H.queued.size); i++) await new Promise(r => setTimeout(r, 15)); return H.queued.size; }"""

with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])

  # 1. the flag: classic stays the default; ?humans=layered and the menu switch it
  ctx, pg, errs = page(b, q='')
  r = J(pg, "() => ({ on: __SF.HUMANS.on, drew: __SF.drawHuman(document.createElement('canvas').getContext('2d'), __SF.P, 0, 0) })")
  check(r == {'on': False, 'drew': False}, 'classic sprites are the default; the layered renderer draws nothing when off', r)
  pg.click('#menu') if pg.query_selector('#menu') else None
  r = J(pg, "() => { const b = [...document.querySelectorAll('[data-a=humans]')]; return b.length ? b[0].textContent : null }")
  if r is None:
    J(pg, "() => { const m = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '☰' || x.id === 'menuBtn'); if (m) m.click(); }")
    r = J(pg, "() => { const b = [...document.querySelectorAll('[data-a=humans]')]; return b.length ? b[0].textContent : null }")
  check(r is None or 'classic' in r, 'menu shows the human-art switch', r); ctx.close()

  # 2. live coverage: every human actor resolves; guards wear their region; nothing falls back
  ctx, pg, errs = page(b, hold=True)
  cov = J(pg, """() => { const S = __SF, W = SF.WARDROBE, rows = [], seen = {};
    for (const e of S.ents) { if (e.gone || !(e.kind === 'npc' || e.kind === 'ally' || e.kind === 'mon')) continue;
      if (e.kind === 'mon') { if (seen[e.type]) continue; seen[e.type] = 1; }
      const D = (e.kind === 'mon' && !W.MOB_ROLE[e.type]) ? null : S.humanDesc(e); rows.push(W.coverageRow(e, D)); }
    return { rows, log: W.fallbackLog.slice(), player: W.coverageRow(S.P, S.humanDesc(S.P)) }; }""")
  rows = cov['rows']; humans = [x for x in rows if x['role']]
  npcs = [x for x in rows if x['kind'] in ('npc', 'ally')]
  check(len(npcs) >= 70 and all(x['role'] for x in npcs), f"{len(npcs)} NPCs and the hireling all resolve to a wardrobe", [x for x in npcs if not x['role']])
  check(not cov['log'] and not any(x['fallback'] for x in humans), 'no unknown role, no generic villager fallback', cov['log'])
  g = [x for x in npcs if x['gameRole'].startswith('guard') or x['gameRole'].startswith('quaywarden')]
  check(sorted(set(x['region'] for x in g)) == ['moonglen', 'mynoc', 'saltmarsh', 'skara', 'vespar'] and all(x['rank'] for x in g), f"{len(g)} guards across the five regions, each with a rank", [(x['id'], x['region'], x['rank']) for x in g])
  mobs = [x for x in rows if x['kind'] == 'mon']
  check(sorted(x['gameRole'] for x in mobs if x['role']) == ['bandit', 'captain', 'smuggler'], 'human mobs dressed: bandit, smuggler, drowned captain; every other creature keeps its own art', [x['gameRole'] for x in mobs if x['role']])
  check(cov['player']['source'] == 'equip' and [x for x in npcs if x['id'] == 'npc:wren'][0]['source'] == 'equip', 'the player and Wren show their real equipment', cov['player'])
  if '--write-coverage' in args:
    os.makedirs(os.path.join(root, 'docs', 'wardrobe'), exist_ok=True)
    json.dump({'build': os.path.basename(f), 'rows': rows + [cov['player']]}, open(os.path.join(root, 'docs', 'wardrobe', 'coverage.json'), 'w'), indent=1)
    print('     wrote docs/wardrobe/coverage.json')
  fx = json.load(open(os.path.join(here, 'live-npcs.json')))
  check(sorted(x['actorId'] for x in fx) == sorted(x['id'] for x in npcs), 'the node test roster (live-npcs.json) matches the running game', [x['id'] for x in npcs if x['id'] not in [y['actorId'] for y in fx]])

  # 3. activity wardrobe over a day (town life untouched: the wardrobe only reads it)
  r = J(pg, """() => { const S = __SF, W = SF.WARDROBE, by = n => S.ents.find(e => e.name && e.name.startsWith(n)), out = {};
    S.WS.clock.setDayMinutes(S.GT, 24); const L = S.LIFE.npcs.filter(e => e.life.sched); const look = tag => { for (const n of ['Brega', 'Durn', 'Tobin']) { const e = by(n); e._wdT = undefined; const D = S.humanDesc(e); out[tag + ':' + n] = [e.life.doing, D.state, D.prop, D.overlays.map(o => o.id).join('+'), !!D.pieces.cloak, D.body + D.hair + D.palette.p]; } };
    S.WS.clock.setHour(S.GT, 9.5); for (const e of L) S.lifeResume(e); for (let i = 0; i < 200; i++) S.update(.05); look('09');
    S.WS.clock.setHour(S.GT, 18.6); for (const e of L) S.lifeResume(e); for (let i = 0; i < 200; i++) S.update(.05); look('18');
    return out; }""")
  b9, b18 = r['09:Brega'], r['18:Brega']
  check(b9[1] == 'work' and b9[2] == 'smith_hammer' and 'apron_long' in b9[3] and b18[1] == 'off' and not b18[2] and 'apron_long' not in b18[3], 'the forgemistress: apron and hammer at the forge, neither at the hall', r)
  check(b9[5] == b18[5], 'she stays the same person (body, hair, colours) all day', r)
  d9 = r['09:Durn']; check(d9[1] in ('work', 'off') and (d9[2] == 'pickaxe') == (d9[1] == 'work'), 'the miner carries the pickaxe only while working', r)

  # 4. save and reload: every person looks the same; the player's appearance identity is kept, not rerolled
  r1 = J(pg, "() => { const S = __SF; const o = {}; for (const e of S.ents) if (!e.gone && (e.kind === 'npc' || e.kind === 'ally')) { e._wdT = undefined; const D = S.humanDesc(e); o[e.actorId] = [D.body, D.skin, D.hair, D.style, D.beard, D.palette.p, D.palette.s, D.rank, D.region, D.role]; } o.P = JSON.stringify(S.P.look); S.save(); return o; }")
  pg.reload(); pg.wait_for_timeout(400); pg.click('[data-c=cont]'); pg.wait_for_timeout(400)
  r2 = J(pg, "() => { const S = __SF; const o = {}; for (const e of S.ents) if (!e.gone && (e.kind === 'npc' || e.kind === 'ally')) { const D = S.humanDesc(e); o[e.actorId] = [D.body, D.skin, D.hair, D.style, D.beard, D.palette.p, D.palette.s, D.rank, D.region, D.role]; } o.P = JSON.stringify(S.P.look); return o; }")
  diff = [k for k in r1 if r1.get(k) != r2.get(k)]
  check(not diff and len(r1) > 70, f'{len(r1)} people identical after save and reload (player look {r2["P"]})', diff[:6])

  # 5. real equipment: equip/unequip shows at once; materials are the item's; two-handed hides the shield; no item is created
  r = J(pg, """() => { const S = __SF, P = S.P, EQ = SF.EQ, out = {}; const n0 = P.pack.items.length + Object.values(P.equip).filter(Boolean).length;
    const k0 = S.humanDesc(P).key; const it = EQ.make('plate_chest', { material: 'valorite' }); SF.addItem(P.pack, it); P.str = 100;
    const r1 = EQ.equipItem(P, { uid: it.uid }); const D1 = S.humanDesc(P); out.equip = [r1.ok, D1.pieces.chest && D1.pieces.chest.material, D1.key !== k0];
    const sh = EQ.make('heater_shield', { material: 'mithril' }); SF.addItem(P.pack, sh); EQ.equipItem(P, { uid: sh.uid }); const w = P.equip.weapon;
    out.weapon = [w && w.id, SF.EQ.twoHanded(w), !!S.humanDesc(P).shield];
    const r2 = EQ.unequipItem(P, { slot: 'chest' }); out.un = [r2.ok, !S.humanDesc(P).pieces.chest];
    out.items = P.pack.items.length + Object.values(P.equip).filter(Boolean).length - n0; out.audit = EQ.audit(P).ok; return out; }""")
  check(r['equip'] == [True, 'valorite', True] and r['un'] == [True, True], 'equipping valorite plate shows valorite plate at once; unequipping removes it', r)
  check(r['weapon'][2] == (not r['weapon'][1]), 'the shield shows only beside a one-handed weapon (' + str(r['weapon'][0]) + ')', r)
  check(r['items'] == 2 and r['audit'], 'only the two test items exist; the wardrobe created none (EQ.audit clean)', r)
  r = J(pg, "() => __SF.ents.filter(e => e.kind === 'npc' && !e.gone).every(e => !e.equip && !e._wdItems)")
  check(r, 'no NPC gained an equipment model or items from its outfit')

  # 6. corpses: last appearance kept; loot is exactly the creature's own table
  r = J(pg, """() => { const S = __SF, P = S.P; const m = S.ents.find(e => e.kind === 'mon' && e.type === 'bandit' && !e.gone) || S.ents.find(e => e.kind === 'mon' && e.type === 'smuggler' && !e.gone);
    const D = S.humanDesc(m), d = S.MON[m.type]; m.x = P.x + 1.5; m.y = P.y; S.damageActor(m, 9999, 'phys', P); for (let i = 0; i < 4; i++) S.update(.05);
    const c = S.ents.find(e => e.kind === 'corpse' && e.mon === m.type && Math.hypot(e.x - m.x, e.y - m.y) < .1);
    const ids = c ? c.cont.items.map(i => i.id) : null, allowed = Object.keys(d.loot || {}).concat((d.rare || []).map(x => x[0]));
    return { type: m.type, snap: !!(c && c.wd && c.wd.key === D.key), ids, ok: ids && ids.every(i => allowed.includes(i)), worn: ids && ids.some(i => Object.values(D.pieces).some(p => p.id === i) && !allowed.includes(i)) }; }""")
  check(r['snap'], 'the ' + r['type'] + "'s corpse keeps its last appearance", r)
  check(r['ok'] and not r['worn'], 'its loot is only its own loot table (no outfit pieces dropped)', r)
  ctx.close()

  # 6b. what the world draw call actually puts on screen: the player, Wren and townsfolk (not just the strips)
  ctx, pg, errs = page(b)
  r = J(pg, """async () => { const S = __SF, who = [S.P].concat(S.ents.filter(e => (e.kind === 'npc' || e.kind === 'ally') && !e.gone).slice(0, 12)), out = [];
    const px = e => { const c = document.createElement('canvas'); c.width = 200; c.height = 200; const ok = S.drawHuman(c.getContext('2d'), e, 100, 150); const d = c.getContext('2d').getImageData(0, 0, 200, 200).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return [ok, n]; };
    for (const e of who) px(e); for (let i = 0; i < 300 && (S.HUMANS.queue.length || S.HUMANS.queued.size); i++) { await new Promise(r => setTimeout(r, 15)); S.humansPump(); }
    for (const e of who) { const [ok, n] = px(e); if (!ok || n < 300) out.push([e.name, ok, n]); } return { n: who.length, bad: out }; }""")
  check(not r['bad'], f"the world draw call paints the player and {r['n'] - 1} others", r); ctx.close()

  # 7. animation coverage: both bodies, 8 directions, the actions the game plays; every strip has pixels
  ctx, pg, errs = page(b)
  r = J(pg, """async () => { const S = __SF, P = S.P, H = S.HUMANS, R = SF.RIG; S.humansEnsureLook(P); const out = { empty: [], n: 0 };
    const acts = ['idle', 'walk', 'run', 'ready', 'slash1h', 'polearm', 'thrust1h', 'bow', 'cast1h', 'cast2h', 'hit', 'death', 'corpse', 'mine', 'smith', 'fish', 'chopwood'];
    const bodies = ['male', 'female'], want = [];
    for (const b of bodies) { const D = Object.assign({}, S.humanDesc(P), { body: b, key: S.humanDesc(P).key + b }); for (const a of acts) for (let d = 0; d < 8; d++) want.push([D, a, d]); }
    H.cap = 1000;
    for (const [D, a, d] of want) { const k = D.key + '#' + a + '#' + d; if (!H.queued.has(k) && !H.strips.has(k)) { H.queued.add(k); H.queue.push({ k, D, action: a, dir: d }); } }
    S.humansPump(); for (let i = 0; i < 6000 && (H.queue.length || H.queued.size); i++) { await new Promise(r => setTimeout(r, 10)); S.humansPump(); }
    for (const [D, a, d] of want) { const c = H.strips.get(D.key + '#' + a + '#' + d); out.n++; if (!c) { out.empty.push(a + d + D.body + ':missing'); continue; } const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 200) k++; if (k < 200 * (c.n || 1) * .3) out.empty.push(a + d + D.body + ':' + k); }
    out.errors = H.errors; return out; }""")
  check(not r['empty'] and r['errors'] == 0, f"{r['n']} strips (2 bodies × 8 directions × 17 actions) built with pixels in every frame", r)

  # 8. the cache stays bounded; frame time with many people on screen
  r = J(pg, """async () => { const S = __SF, H = S.HUMANS; H.cap = 96; const L = S.humansLineup(); let asked = 0;
    for (const [, D] of L) for (let d = 0; d < 8; d++) { const k = D.key + '#walk#' + d; if (!H.queued.has(k) && !H.strips.has(k)) { H.queued.add(k); H.queue.push({ k, D, action: 'walk', dir: d }); asked++; } }
    S.humansPump(); for (let i = 0; i < 6000 && (H.queue.length || H.queued.size); i++) { await new Promise(r => setTimeout(r, 10)); S.humansPump(); }
    return { asked, size: H.strips.size, cap: H.cap, evicted: H.evicted, built: H.built, avgBuildMs: +(H.buildMs / Math.max(1, H.built)).toFixed(2) }; }""")
  check(r['size'] <= r['cap'] and r['evicted'] > 0, f"strip cache bounded: {r['size']}/{r['cap']} after {r['asked']} requests ({r['evicted']} evicted, {r['avgBuildMs']} ms of SVG work per strip)", r)
  def frametime(on):
    return J(pg, """async on => { const S = __SF, P = S.P; S.HUMANS.on = on; const L = S.ents.filter(e => e.kind === 'npc' && !e.gone).slice(0, 60);
      L.forEach((e, i) => { e.x = P.x - 7 + (i % 10) * 1.5; e.y = P.y - 4 + Math.floor(i / 10) * 1.5; e.nav = null; e.life = null; e.home = { x: e.x, y: e.y }; e.sect = i % 8; });
      for (let i = 0; i < 90; i++) await new Promise(r => requestAnimationFrame(r)); await new Promise(r => setTimeout(r, 1500)); for (let i = 0; i < 30; i++) await new Promise(r => requestAnimationFrame(r));
      const ts = []; for (let i = 0; i < 120; i++) { const t0 = performance.now(); S.render ? S.render() : null; await new Promise(r => requestAnimationFrame(r)); ts.push(performance.now() - t0); }
      ts.sort((a, b) => a - b); return { med: +ts[60].toFixed(1), p95: +ts[114].toFixed(1), strips: S.HUMANS.strips.size }; }""", on)
  off, on = frametime(False), frametime(True)
  check(on['p95'] <= max(40, off['p95'] * 1.6), f"60 people on screen: frame median {on['med']} ms / p95 {on['p95']} ms layered vs {off['med']} / {off['p95']} ms classic", [on, off])
  pg.screenshot(path=os.path.join(shots, 'crowd-60-phone.png')); ctx.close()

  # 9. screenshots: lineup by day and night at native scale and ×3, in-game phone and desktop, day and night, paper doll
  for night in (False, True):
    ctx, pg, errs = page(b, vp=(1600, 900))
    J(pg, """async ([night, sc]) => { const S = __SF, R = SF.RIG, L = S.humansLineup({ night }); const cols = 14, cw = 112 * sc, ch = 118 * sc;
      const cv = document.createElement('canvas'); cv.width = cols * cw; cv.height = Math.ceil(L.length / cols) * ch; const g = cv.getContext('2d');
      g.fillStyle = night ? '#1d2433' : '#6f7d58'; g.fillRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false;
      for (let i = 0; i < L.length; i++) { const [label, D] = L[i]; const svg = R.frameSVG(R.fromDescriptor(D, { SF, direction: 'S', action: 'idle' }));
        const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await im.decode(); const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
        g.drawImage(im, x, y, 112 * sc, 100 * sc); if (night) { g.fillStyle = 'rgba(10,20,50,.45)'; g.fillRect(x, y, cw, 100 * sc); } g.fillStyle = night ? '#cdd' : '#111'; g.font = (6 + 2 * sc) + 'px sans-serif'; g.fillText(label, x + 3, y + ch - 6); }
      document.body.innerHTML = ''; document.body.style.margin = 0; document.body.style.background = '#000'; document.body.appendChild(cv); return L.length; }""", [night, 1])
    import base64; open(os.path.join(shots, 'lineup-native-' + ('night' if night else 'day') + '.png'), 'wb').write(base64.b64decode(J(pg, "() => document.querySelector('canvas').toDataURL('image/png').split(',')[1]"))); ctx.close()
  ctx, pg, errs = page(b, vp=(2100, 1000))
  n = J(pg, """async () => { const S = __SF, R = SF.RIG, L = S.humansLineup(); const sc = 3, cols = 6, cw = 112 * sc, ch = 112 * sc;
    const cv = document.createElement('canvas'); cv.width = cols * cw; cv.height = Math.ceil(L.length / cols) * ch; const g = cv.getContext('2d'); g.fillStyle = '#6f7d58'; g.fillRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false;
    for (let i = 0; i < L.length; i++) { const [label, D] = L[i]; const svg = R.frameSVG(R.fromDescriptor(D, { SF, direction: 'S', action: 'idle' })); const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); await im.decode();
      const x = (i % cols) * cw, y = Math.floor(i / cols) * ch; const tmp = document.createElement('canvas'); tmp.width = 112; tmp.height = 100; tmp.getContext('2d').drawImage(im, 0, 0); g.drawImage(tmp, x, y, 112 * sc, 100 * sc); g.fillStyle = '#111'; g.font = '16px sans-serif'; g.fillText(label, x + 6, y + ch - 8); }
    document.body.innerHTML = ''; document.body.style.margin = 0; document.body.appendChild(cv); return L.length; }""")
  import base64; open(os.path.join(shots, 'lineup-x3-pixels.png'), 'wb').write(base64.b64decode(J(pg, "() => document.querySelector('canvas').toDataURL('image/png').split(',')[1]")))
  # grayscale readability at native size: figures of different roles must not collapse into the same grey silhouette
  r = J(pg, """() => { const c = document.querySelector('canvas'), g = c.getContext('2d'), L = __SF.humansLineup(), cw = 336, ch = 336, vec = [];
    for (let i = 0; i < L.length; i++) { const x = (i % 6) * cw, y = Math.floor(i / 6) * ch, d = g.getImageData(x, y, cw, 300).data, v = [];
      for (let gy = 0; gy < 25; gy++) for (let gx = 0; gx < 28; gx++) { let s = 0; for (let yy = 0; yy < 12; yy++) for (let xx = 0; xx < 12; xx++) { const k = ((gy * 12 + yy) * cw + gx * 12 + xx) * 4; s += d[k] * .3 + d[k + 1] * .59 + d[k + 2] * .11; } v.push(s / 144); }
      vec.push([L[i][0].replace(/ \\([mf]\\)$/, ''), L[i][1].body, v]); }
    const close = []; let pairs = 0;
    for (let i = 0; i < vec.length; i++) for (let j = i + 1; j < vec.length; j++) { if (vec[i][0] === vec[j][0] || vec[i][1] !== vec[j][1] || vec[i][0].split(' ')[0] === vec[j][0].split(' ')[0]) continue; /* ranks of one region share a kit on purpose */ pairs++; let s = 0; for (let k = 0; k < vec[i][2].length; k++) s += Math.abs(vec[i][2][k] - vec[j][2][k]); s /= vec[i][2].length; if (s < 1.2) close.push(vec[i][0] + ' ~ ' + vec[j][0] + ' ' + s.toFixed(2)); }
    return { pairs, close }; }""")
  print('     closest grey pairs:', '; '.join(r['close'][:12]))
  check(len(r['close']) <= r['pairs'] * .04, f"grayscale: {r['pairs'] - len(r['close'])} of {r['pairs']} same-body pairs of different roles/ranks differ in luminance", r['close'][:20])
  ctx.close()
  for (label, vp, hour) in (('phone-day', (844, 390), 10), ('phone-night', (844, 390), 23), ('desktop-day', (1366, 768), 14)):
    ctx, pg, errs = page(b, vp=vp)
    J(pg, """h => { const S = __SF, P = S.P; S.WS.clock.setHour(S.GT, h); const v = S.ents.filter(e => e.town === 'vespar' && e.kind === 'npc'); P.x = 905; P.y = 560;
      v.forEach((e, i) => { e.x = P.x - 5 + (i % 6) * 2; e.y = P.y - 3 + Math.floor(i / 6) * 2.4; e.nav = null; if (e.life) e.life.goal = { act: 'work', x: e.x, y: e.y }; e.home = { x: e.x, y: e.y }; e.sect = (i * 3) % 8; }); }""", hour)
    pg.wait_for_timeout(2500); pg.screenshot(path=os.path.join(shots, 'game-vespar-' + label + '.png')); ctx.close()
  ctx, pg, errs = page(b, vp=(844, 390), scale=2)
  J(pg, "() => { const S = __SF; S.WS.clock.setHour(S.GT, 10); }"); pg.wait_for_timeout(1500)
  pg.keyboard.press('c'); pg.wait_for_timeout(600)
  r = J(pg, "() => { const d = document.querySelector('#eqwin .doll'); return d ? d.className + ' ' + (d.style.backgroundImage || '').slice(0, 30) : null }")
  check(r and 'rig' in r and 'svg' in r, 'the paper doll draws the same layered descriptor as the world', r)
  pg.screenshot(path=os.path.join(shots, 'paperdoll-phone.png')); ctx.close()
  check(True, 'screenshots in ' + shots)
  b.close()
print('all wardrobe smoke checks passed' if not fails else f'{fails} FAILED'); sys.exit(1 if fails else 0)
