# Living World phase 2 in the built game (Playwright + Chrome): the fixed 50 ms step, the world clock, light, navigation
# (travel graph, A*, doors, stairs, boats, moongates, stuck recovery, the search budget) and the developer panel.
# usage: python3 tests/world-smoke/phase2.py Shardfall_v0.23.html [/path/to/chrome]   (run.py calls it too)
import sys, json, os
from playwright.sync_api import sync_playwright
f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.23.html'); chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
import re; VERSION = re.search(r'<title>Shardfall v([0-9.]+)</title>', open(f, encoding='utf-8', errors='ignore').read(4000)).group(1)   # the panel shows the build's own version
HOLD = "window.__rafHold = true; { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => window.__rafHold ? 0 : raf(cb); }"
fails = 0
def check(ok, msg, got=None):
  global fails
  print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else '  got: ' + json.dumps(got)[:700])); fails += 0 if ok else 1
def page(b, hold=True, q=''):
  ctx = b.new_context(viewport={'width': 844, 'height': 390}); pg = ctx.new_page(); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
  if hold: pg.add_init_script(HOLD)
  pg.goto('file://' + f + q); pg.wait_for_timeout(400); return ctx, pg, errs
def new_char(pg):
  pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(400); pg.evaluate("o => __CC.quick(o)", {'name': 'Tess'}); pg.wait_for_timeout(300)
J = lambda pg, js: pg.evaluate(js)
CALM = "for (const m of S.ents) if (m.kind === 'mon') m.pacified = 1e9;"   # creatures leave travellers alone (combat between actors is phase 5)

with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
  ctx, pg, errs = page(b); new_char(pg)

  # 1. the world clock
  r = J(pg, """() => { const S = __SF, C = S.WS.clock, fmt = h => S.SIM.fmtHour(h), out = { start: fmt(S.hourOfDay()), period: C.periodAt(S.GT), min: C.dayMinutes, hud: document.querySelector('#clock').textContent };
    const g0 = S.GT; for (let i = 0; i < 6000; i++) S.update(.05); out.after = fmt(S.hourOfDay()); out.ran = Math.round(S.GT - g0);
    C.setHour(S.GT, 22); out.set = fmt(S.hourOfDay()); out.night = C.periodAt(S.GT); S.refreshHud(); out.hud2 = document.querySelector('#clock').textContent; return out; }""")
  check(r['start'] == '09:00' and r['period'] == 'day' and r['min'] == 120 and r['hud'].endswith('09:00'), 'a new world starts at 09:00 on a 120-minute day; the HUD shows it', r)
  check(r['ran'] == 300 and r['after'] == '10:00', 'five simulated minutes are one in-game hour', r)
  check(r['set'] == '22:00' and r['night'] == 'night' and r['hud2'] == '☾ 22:00', 'setting the time moves the clock; the HUD shows night', r)
  pg.evaluate('__SF.save()'); pg.reload(); pg.wait_for_timeout(400); pg.click('[data-c=cont]'); pg.wait_for_timeout(300)
  r = J(pg, "() => ({ h: __SF.SIM.fmtHour(__SF.hourOfDay()), v: JSON.parse(localStorage.getItem('shardfall.save.v1')).sim.clock })")
  check(r['h'] == '22:00' and r['v']['dayMinutes'] == 120, 'the time of day survives save and reload', r)
  r = J(pg, """() => { const s = JSON.parse(localStorage.getItem('shardfall.save.v1')); delete s.sim.clock; s.gt = 600; localStorage.setItem('shardfall.save.v1', JSON.stringify(s)); Storage.prototype.setItem = function () { }; return (600 / 60 + 9) % 24; }   // no save-on-unload may overwrite it""")
  pg.reload(); pg.wait_for_timeout(400); pg.click('[data-c=cont]'); pg.wait_for_timeout(300)
  r2 = J(pg, "() => __SF.SIM.fmtHour(__SF.hourOfDay())")
  check(r2 == '19:00', 'a save from before the clock keeps the hour it was at (old 24-minute day → 19:00)', r2)

  # 2. light: night is darker but readable, dawn and dusk are warm, dungeons keep their own dark, Night Sight helps without turning night to day
  r = J(pg, """() => { const S = __SF, C = S.WS.clock, P = S.P, at = h => { C.setHour(S.GT, h); const l = S.lightNow(); return [+l.dark.toFixed(2), l.col]; };
    const out = { noon: at(12), dawn: at(6.3), dusk: at(18), night: at(23) };
    S.render(); P.mg = P.mg || {}; P.mg.night = S.GT + 99; out.nightSight = at(23)[0]; P.mg.night = 0;
    const x0 = P.x, y0 = P.y, st = S.STAIRS[0]; P.x = st.to.x; P.y = st.to.y; C.setHour(S.GT, 12); out.dungeon = +S.lightNow().dark.toFixed(2); S.render(); P.x = x0; P.y = y0; S.render(); return out; }""")
  check(r['noon'][0] == 0 and r['night'][0] == .62 and r['night'][1][2] > r['night'][1][0], 'noon is clear; night .62, blue', r)
  check(r['dawn'][1][0] > r['dawn'][1][2] and r['dusk'][1][0] > r['dusk'][1][2] and 0 < r['dawn'][0] < .62 and 0 < r['dusk'][0] < .62, 'dawn and sunset are warm and half-dark', r)
  check(0 < r['nightSight'] < .25, 'Night Sight lifts most of the dark but not all of it', r)
  check(r['dungeon'] == .8, 'a dungeon is dark at noon', r)
  check(not errs, 'renders by day, at night, with Night Sight and in a dungeon without errors', errs[:5])

  # 3. travel: the graph links every named place, every walk link is walkable, and real journeys arrive
  r = J(pg, """() => { const S = __SF, G = S.navGraph(), q = S.navPlaces().find(p => p.name === 'Saltmarsh Quay'); const bad = [], seen = new Set(); let n = 0;
    for (const id of G.ids()) for (const e of G.edges(id)) { if (e.kind !== 'walk') continue; const k = [id, e.to].sort().join('|'); if (seen.has(k)) continue; seen.add(k); n++;
      const a = G.node(id), c = G.node(e.to), j = S.navRequest(Math.floor(a.x), Math.floor(a.y), Math.floor(c.x), Math.floor(c.y), { doors: true }, true); while (j.status === 'running') S.navTick(); if (j.status !== 'found') bad.push([a.name || id, c.name || e.to]); }
    const places = S.navPlaces(); return { nodes: G.size, places: places.length, edges: n, bad, unreach: places.filter(p => !G.route(q.id, p.id)).map(p => p.name),
      kinds: [...new Set(places.map(p => p.kind))].sort(), travel: [...new Set(G.ids().flatMap(id => G.edges(id).filter(e => e.kind === 'travel').map(e => e.via)))].sort() }; }""")
  check(r['places'] >= 20 and not r['unreach'], f"{r['places']} named places, every one reachable from Saltmarsh Quay", r)
  check(not r['bad'] and r['edges'] > 100, f"all {r['edges']} walk links pass a real path search", r)
  check(r['travel'] == ['boat', 'ferry', 'moongate', 'packet', 'stairs'], 'travel links: ferry, boats, packet, moongates, dungeon stairs', r)
  ctx.close()

  def trip(dest, budget_s=900, extra=''):
    ctx, pg, errs = page(b); new_char(pg)
    r = J(pg, """() => { const S = __SF; """ + CALM + extra + """ const pl = S.navPlaces().find(p => p.name === %s); const e = S.devTraveller(pl.id); let i = 0, maxStuck = 0, maxSpent = 0;
      for (; i < %d * 20; i++) { S.simStep(.05); maxStuck = Math.max(maxStuck, e.nav.stuck || 0); maxSpent = Math.max(maxSpent, S.NAV.spent); if (e.nav.state !== 'moving') break; }
      return { state: e.nav.state, reason: e.nav.reason || e.nav.why || null, home: !!e.nav.home, t: Math.round(i / 20), d: +Math.hypot(e.x - pl.x, e.y - pl.y).toFixed(1), legs: e.nav.legs.map(l => l.kind === 'travel' ? l.via : 'walk').filter((k, i, a) => k !== 'walk' || a[i - 1] !== 'walk').join(' '), maxStuck, maxSpent, budget: S.NAV.budget,
        lvl: S.levelAt(Math.floor(e.x), Math.floor(e.y)) }; }""" % (json.dumps(dest), budget_s))
    ctx.close(); return r, errs
  for dest, via in [('Brine Crossroads', None), ('Shore Beacon', None), ('Mynoc', 'packet'), ('Moonglen', 'boat'), ('Skara Bryn', 'moongate')]:
    r, e = trip(dest)
    check(r['state'] == 'done' and not r['home'] and r['d'] < 2.5 and (via is None or via in r['legs']) and not e, f"traveller from the Quay reaches {dest} in {r['t']} s ({r['legs']})", {'r': r, 'errs': e[:3]})
    check(r['maxSpent'] <= r['budget'], f"  …with path searches inside the per-step budget (max {r['maxSpent']} of {r['budget']} nodes)", r)

  # 4. dungeon stairs, doors (opened, closed behind; refused to creatures that cannot open them) and stuck recovery
  ctx, pg, errs = page(b); new_char(pg)
  r = J(pg, """() => { const S = __SF, P = S.P, out = {}; """ + CALM + """
    const st = S.STAIRS[0], e = S.devTraveller(S.navPlaces()[0].id); S.navTo(e, st.to.x + 1.5, st.to.y + 1.5, { name: 'Sunken Bell' }); let i = 0; for (; i < 20 * 600; i++) { S.simStep(.05); if (e.nav.state !== 'moving') break; }
    out.dungeon = { state: e.nav.state, lvl: S.levelAt(Math.floor(e.x), Math.floor(e.y)), stairs: e.nav.legs.some(l => l.via === 'stairs'), t: Math.round(i / 20) };
    const pairs = S.DOORS.filter(d => Math.hypot(d.x - P.x, d.y - P.y) < 40).map(d => ({ d, b: S.KBUILD.find(b => Math.abs(d.x + .5 - (b.x + b.w / 2)) < b.w / 2 + 1.5 && Math.abs(d.y - (b.y + b.h / 2)) < b.h / 2 + 1.5) })).filter(o => o.b);
    const { d, b } = pairs[0], inside = { x: b.x + b.w / 2, y: b.y + b.h / 2 }, dx = d.x + .5 - inside.x, dy = d.y - inside.y, l = Math.hypot(dx, dy), outside = { x: d.x + .5 + dx / l * 3, y: d.y + dy / l * 3 };
    S.setDoor(d, false);
    const a = S.devTraveller(S.navPlaces()[0].id); a.x = outside.x; a.y = outside.y; S.navTo(a, inside.x, inside.y, { name: 'indoors' }); let opened = false;
    for (let k = 0; k < 20 * 60; k++) { S.simStep(.05); if (d.open) opened = true; if (a.nav.state !== 'moving') break; } for (let k = 0; k < 60; k++) S.simStep(.05);
    out.door = { state: a.nav.state, opened, closedAfter: !d.open, inside: !!S.insideBuild(a.x, a.y), saved: P.cx.doors[d.key] === 0 };
    const c = S.devTraveller(S.navPlaces()[0].id); c.x = outside.x; c.y = outside.y; S.navTo(c, inside.x, inside.y, { name: 'indoors', doors: false }); for (let k = 0; k < 20 * 30; k++) { S.simStep(.05); if (c.nav.state !== 'moving') break; }
    out.noDoors = { state: c.nav.state, reason: c.nav.reason, stillClosed: !d.open, outside: !S.insideBuild(c.x, c.y) };
    S.setDoor(d, false); const ns = Math.abs(dy) >= Math.abs(dx), sides = ns ? [[b.x + b.w + 1.5, inside.y], [b.x - 1.5, inside.y]] : [[inside.x, b.y + b.h + 1.5], [inside.x, b.y - 1.5]];
    const side = sides.find(([x, y]) => S.canStand(P, x, y)); const s2 = S.devTraveller(S.navPlaces()[0].id); s2.x = side[0]; s2.y = side[1]; S.navTo(s2, inside.x, inside.y, { name: 'indoors' });
    for (let k = 0; k < 20 * 10 && !s2.nav.wp; k++) S.simStep(.05);
    s2.nav.wp = [[s2.x, s2.y], [inside.x, inside.y]]; s2.nav.wi = 1;   // a bad route: straight through the side wall
    let maxStuck = 0; for (let k = 0; k < 20 * 90; k++) { S.simStep(.05); maxStuck = Math.max(maxStuck, s2.nav.stuck || 0); if (s2.nav.state !== 'moving') break; }
    out.stuck = { state: s2.nav.state, inside: !!S.insideBuild(s2.x, s2.y), maxStuck, side };
    return out; }""")
  check(r['dungeon']['state'] == 'done' and r['dungeon']['lvl'] == 1 and r['dungeon']['stairs'], f"a traveller walks to the Sunken Bell and down the stairs ({r['dungeon']['t']} s)", r['dungeon'])
  check(r['door'] == {'state': 'done', 'opened': True, 'closedAfter': True, 'inside': True, 'saved': True}, 'a traveller opens a closed door, goes in and closes it behind', r['door'])
  check(r['noDoors']['state'] == 'failed' and r['noDoors']['reason'] == 'unreachable' and r['noDoors']['stillClosed'] and r['noDoors']['outside'], 'an actor that cannot open doors never walks through a closed one', r['noDoors'])
  check(r['stuck']['state'] == 'done' and r['stuck']['inside'] and r['stuck']['maxStuck'] >= 2, 'stuck on a wall: it re-plans and still arrives', r['stuck'])
  check(not errs, 'no page errors in travel scenarios', errs[:5])

  # 5. many requests at once: searches wait their turn, each step stays inside the budget, the queue drains
  r = J(pg, """() => { const S = __SF; """ + CALM + """ const pl = S.navPlaces(); for (let i = 0; i < 12; i++) S.devTraveller(pl[(i * 5) % pl.length].id);
    let maxSpent = 0, maxQ = 0, i = 0; for (; i < 400; i++) { S.simStep(.05); maxSpent = Math.max(maxSpent, S.NAV.spent); maxQ = Math.max(maxQ, S.NAV.jobs.length); }
    return { maxSpent, maxQ, q: S.NAV.jobs.length, budget: S.NAV.budget, moving: S.ents.filter(e => e.dev && e.nav.state === 'moving').length }; }""")
  check(r['maxSpent'] <= r['budget'] and r['q'] == 0, f"12 travellers at once: at most {r['maxSpent']} search nodes per step, queue peaked at {r['maxQ']} and drained", r)
  ctx.close()

  # 6. the fixed step in the live loop: 20 steps per simulated second, real time drives it
  ctx, pg, errs = page(b, hold=False); new_char(pg)
  r = J(pg, "() => new Promise(res => { const S = __SF, g0 = S.GT, t0 = performance.now(); setTimeout(() => { const dt = (performance.now() - t0) / 1000, dg = S.GT - g0; res({ dt, dg, steps: Math.round(dg / .05), frac: Math.abs(dg / .05 - Math.round(dg / .05)), alpha: S.ALPHA }); }, 3000); })")
  check(abs(r['dg'] - r['dt']) < .35 and r['frac'] < 1e-6 and 0 <= r['alpha'] < 1, f"live loop: {r['dg']:.2f} s simulated in {r['dt']:.2f} s, in whole 50 ms steps", r)
  check(not errs and J(pg, "() => !document.getElementById('devb')"), 'no developer panel without ?dev; no errors', errs[:5]); ctx.close()

  # 7. the developer panel (?dev): stats, time controls, pause, spawning, inspection
  ctx, pg, errs = page(b, hold=False, q='?dev'); new_char(pg); pg.wait_for_timeout(1500); pg.click('#devb'); pg.wait_for_timeout(500)
  txt = pg.inner_text('#devp')
  check(all(k in txt for k in ['Shardfall v' + VERSION, 'sim 20 Hz', 'actors ', 'NPCs ', 'creatures ', 'time ', 'paths: queue', 'AI ', 'audio voices', 'save ', 'last save', 'recent events', 'factions']), 'the panel shows version, rates, counts, time, paths, AI cost, audio, save and events', txt[:500])
  pg.click('[data-dev=hour][data-h="0"]'); pg.wait_for_timeout(200); h = J(pg, "() => __SF.SIM.fmtHour(__SF.hourOfDay())")
  check(h.startswith('00:0'), 'Midnight button sets the clock', h)
  pg.click('[data-dev=pause]'); g1 = J(pg, '() => __SF.GT'); pg.wait_for_timeout(800); g2 = J(pg, '() => __SF.GT'); pg.click('[data-dev=pause]'); pg.wait_for_timeout(500); g3 = J(pg, '() => __SF.GT')
  check(g1 == g2 and g3 > g2, 'Pause stops the simulation, Resume restarts it', [g1, g2, g3])
  pg.select_option('#devdest', label='Brine Crossroads'); pg.click('[data-dev=spawn]'); pg.wait_for_timeout(1500); pg.evaluate("() => __SF.DEV.open && 0"); pg.wait_for_timeout(400)
  r = J(pg, "() => { const e = __SF.P.sel; return e && { dev: e.dev, goal: e.nav.goal.name, state: e.nav.state, panel: document.getElementById('devp').innerText.includes('Traveller') } }")
  check(r and r['dev'] and r['goal'] == 'Brine Crossroads' and r['state'] == 'moving' and r['panel'], 'Spawn traveller starts a journey and the panel inspects it', r)
  for k in ['perception', 'territory', 'collision']: pg.check(f'[data-show={k}]')
  pg.wait_for_timeout(600); pg.click('[data-dev=adv][data-s="60"]'); pg.wait_for_timeout(2500)
  check(not errs, 'overlays and Run +1 min work without errors', errs[:5]); ctx.close()
  b.close()
print('ALL PASS' if not fails else f'{fails} FAILED'); sys.exit(1 if fails else 0)
