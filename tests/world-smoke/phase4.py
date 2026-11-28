# Living World phase 4 in the built game (Playwright + Chrome): living NPCs.
# Homes, workplaces and daily schedules for Vespar and Mynoc, residents, shop hours, resource workers taking real strokes,
# guard patrols and the night watch, the travelling merchant on the cart road, fear of creatures, resuming the day after a
# reload, crowds spreading out, and a full accelerated day with no one stuck.
# usage: python3 tests/world-smoke/phase4.py Shardfall_v0.28.html [/path/to/chrome]   (also run by world-smoke/run.py)
import sys, json, os
from playwright.sync_api import sync_playwright
f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.28.html')
chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
HOLD = "window.__rafHold = true; { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => window.__rafHold ? (window.__rafCb = cb, 0) : raf(cb); }"
SEED = "S => { let a = %d >>> 0; S.setRng(() => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }); }"
fails = 0
def check(ok, msg, got=None):
  global fails
  print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else '  got: ' + json.dumps(got)[:900])); fails += 0 if ok else 1
def page(b):
  ctx = b.new_context(viewport={'width': 844, 'height': 390}); pg = ctx.new_page(); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
  pg.add_init_script(HOLD); pg.goto('file://' + f + '?tiers=off');   # these scenarios test the whole world's rules wherever the player stands; tiers are tested in phase6.py
  pg.wait_for_timeout(400)
  return ctx, pg, errs
def new_char(pg, seed=None):
  pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(400)
  if seed is not None: pg.evaluate('(' + (SEED % seed) + ')(__SF)')
  pg.evaluate("o => __CC.quick(o)", {'name': 'Tess'}); pg.wait_for_timeout(300)
J = lambda pg, js: pg.evaluate(js)
HELP = """() => { const S = __SF; window.__T = {
  L: () => S.LIFE.npcs, by: n => S.LIFE.npcs.find(e => e.name.startsWith(n)),
  hour(h) { S.WS.clock.setHour(S.GT, h); },
  run(sec, each) { const n = Math.round(sec / .05); for (let i = 0; i < n; i++) { S.update(.05); if (each && i % 20 === 0 && each(i * .05)) return i * .05; } return sec; },
  calm() { for (const m of S.ents) if (m.kind === 'mon') m.pacified = 1e12; S.P.hidden = true; S.P.stepBudget = 1e9; },
  inside(e, b) { return b && e.x > b.x && e.x < b.x + b.w && e.y > b.y && e.y < b.y + b.h; },
  sched: e => e.life.sched ? S.SIM.scheduleAt(e.life.sched, S.hourOfDay()) : null }; }"""

with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
  ctx, pg, errs = page(b); new_char(pg, seed=4); J(pg, HELP)

  # 1. who lives where: homes, workplaces, schedules, residents
  r = J(pg, """() => { const S = __SF, T = __T, L = T.L(), by = {}; for (const e of L) by[e.life.prof] = (by[e.life.prof] || 0) + 1;
    const sch = L.filter(e => e.life.sched); const bad = sch.filter(e => !e.life.home || !e.life.home.b || S.zoneAt(Math.floor(e.life.home.b.cx), Math.floor(e.life.home.b.cy)) !== e.life.town || !e.life.work).map(e => e.name);
    const valid = Object.entries(S.LIFE_SCHED).filter(([k, s]) => !S.SIM.validSchedule(s)).map(([k]) => k);
    const res = S.ents.filter(e => e.kind === 'npc' && e.role === 'resident').map(e => [e.name, e.actorId, e.archetype]);
    const fixed = ['banker', 'healer', 'boat', 'packet', 'ferry', 'quaywarden'].every(r => S.ents.filter(e => e.role === r).every(e => !e.life));
    return { n: L.length, by, bad, valid, res, fixed, trader: [S.LIFE.trader.actorId, S.LIFE.trader.archetype] }; }""")
  check(r['n'] >= 35 and r['by'].get('guard', 0) >= 8 and r['by'].get('shop', 0) + r['by'].get('smith', 0) >= 9 and r['by'].get('miner') == 2 and r['by'].get('innkeeper') == 2 and r['by'].get('astronomer') == 1 and r['by'].get('student') == 2, f"{r['n']} townsfolk with lives: {r['by']}", r)
  check(not r['bad'] and not r['valid'], 'every scheduled townsperson has a home inside a house of their own town and a workplace; every schedule covers the day', r)
  check(len(r['res']) == 13 and all(x[1].startswith('npc:') and x[2] == 'civilian' for x in r['res']) and r['trader'] == ['npc:tobin-travelling-merchant', 'merchant'], 'thirteen named residents and the travelling merchant have stable ids and archetypes', r['res'])
  check(r['fixed'], 'bankers, healers, ferry and boat crews and the Quaywarden keep their posts (no routine)', r)

  # 2. a full accelerated day: the right place at the right time, nobody stuck
  r = J(pg, """() => { const S = __SF, T = __T, L = T.L(); T.calm(); S.WS.clock.setDayMinutes(S.GT, 24); T.hour(8.9); for (const e of L) S.lifeResume(e);
    const sch = L.filter(e => e.life.sched), samples = {}, failed = new Set(), late = {}, away_ = {};
    const at = (e, k) => { const d = Math.hypot(e.x - e.life.goal.x, e.y - e.life.goal.y); return d < 1.6 || (d < 2.6 && e.nav && e.nav.state === 'done') || (e.life.goal.near && S.dist(e, e.life.goal.near) < 3.2); };   /* the game's own arrival rule */
    const look = tag => { samples[tag] = { shopsAtWork: sch.filter(e => e.life.prof === 'shop' || e.life.prof === 'smith' || e.life.prof === 'innkeeper').filter(e => Math.hypot(e.x - e.life.work.x, e.y - e.life.work.y) < 1.6).length,
      asleepHome: sch.filter(e => e.life.doing === 'sleep' && (T.inside(e, e.life.home.b) || Math.hypot(e.x - e.life.home.x, e.y - e.life.home.y) < 2.6)).length, eating: sch.filter(e => e.life.doing === 'eat').length, social: sch.filter(e => e.life.doing === 'social').length,
      gathering: sch.filter(e => e.life.doing === 'gather').length, working: sch.filter(e => e.life.goal && ['gather', 'trade'].includes(e.life.goal.act)).length, shopN: sch.filter(e => e.life.prof === 'shop' || e.life.prof === 'smith' || e.life.prof === 'innkeeper').length, astro: sch.filter(e => e.life.prof === 'astronomer').map(e => e.life.doing + (e.life.doing === 'sleep' && T.inside(e, e.life.home.b) ? '@home' : ''))[0], n: sch.length - sch.filter(e => e.life.prof === 'astronomer').length }; };
    let lastH = -1; const tags = { 10: 'h10', 12.6: 'h1236', 19: 'h19', 23.5: 'h2330', 3: 'h03' };
    T.run(24 * 60 + 30, () => { const h = S.hourOfDay(); for (const k in tags) if (!samples[tags[k]] && h >= +k && h < +k + .2) look(tags[k]); for (const e of L) if (e.nav && e.nav.state === 'failed') failed.add(e.name);
      for (const e of sch) { const away = e.life.goal && !at(e) && !(e.nav && e.nav.state === 'moving'); away_[e.name] = away ? (away_[e.name] || 0) + 1 : 0; if (away_[e.name] > (late[e.name] || 0)) late[e.name] = away_[e.name]; } return false; });   // stranded: neither there nor on the way
    const needsOk = L.every(e => ['hunger', 'fatigue', 'social', 'safety'].every(k => e.life.needs[k] >= 0 && e.life.needs[k] <= 1)), memOk = L.every(e => e.life.mem.size <= 8);
    return { samples, failed: [...failed], late, needsOk, memOk, ev: S.LIFE.events, stock: S.LIFE.stock }; }""")
  s = r['samples']
  check(s['h10']['shopsAtWork'] == s['h10']['shopN'] and s['h10']['working'] == 5 and s['h10']['astro'] == 'sleep@home', f"10:00 — all {s['h10']['shopN']} shopkeepers and innkeepers at their counters, the astronomer asleep after her night shift; the miners, woodcutters and the fisherwoman at work ({s['h10']['gathering']} at their field, the rest walking a load to town or back)", s['h10'])
  check(s['h1236']['eating'] >= 12, f"12:36 — {s['h1236']['eating']} townsfolk at their midday meal in the hall or the yard", s['h1236'])
  check(s['h19']['social'] >= 14, f"19:00 — {s['h19']['social']} townsfolk meeting at the hall and the yard", s['h19'])
  check(s['h03']['asleepHome'] == s['h03']['n'] and s['h2330']['asleepHome'] >= s['h2330']['n'] - 2 and s['h2330']['astro'] == 'work' and not s['h03']['astro'].startswith('sleep'), f"03:00 — all {s['h03']['n']} asleep in their own homes (at 23:30 all but the two innkeepers), while the astronomer is up through the night at the observatory", s)
  check(not r['failed'] and max(r['late'].values() or [0]) <= 10, 'over the whole day no journey failed and nobody was stranded away from where their schedule wanted them', r)
  check(r['needsOk'] and r['memOk'], 'needs stay between 0 and 1; memories stay bounded', r)
  check(r['stock']['mynoc']['ore'] > 0 and r['stock']['mynoc']['pine'] > 0 and r['stock']['vespar']['fish'] > 0 and r['stock']['skara']['pine'] > 0, f"the day's work reached the stores: {r['stock']}", r)

  # 3. shop hours: open at the counter by day, shut at night; the bank and the healer never close
  r = J(pg, """() => { const S = __SF, T = __T, m = T.by('Merrin'), bk = S.ents.find(e => e.role === 'banker' && e.town === 'vespar'), out = {};
    T.hour(9.5); S.lifeResume(m); S.closeScreen && S.closeScreen(); S.P.ghost = false; S.P.x = m.x + 1; S.P.y = m.y; S.talk(m); out.day = S.PANEL; S.closePanel();
    T.hour(23.4); S.lifeResume(m); S.P.x = m.x + 1; S.P.y = m.y; const n0 = S.LOG.length; S.talk(m); out.night = S.PANEL; out.nightLog = S.LOG.slice(n0).map(l => l.t); out.asleep = m.life.doing;
    S.P.x = bk.x + 1; S.P.y = bk.y; S.talk(bk); out.bank = S.PANEL; S.closePanel(); return out; }""")
  check(r['day'] == 'shop' and r['night'] != 'shop' and r['asleep'] == 'sleep' and any('asleep' in t for t in r['nightLog']), 'Merrin sells at her counter at 09:30; at 23:24 she is asleep at home and the shop does not open', r)
  check(r['bank'] == 'bank', 'the Vespar bank still opens at night', r)

  # 4. resource workers take real strokes from real nodes and sell the haul
  r = J(pg, """() => { const S = __SF, T = __T, d = T.by('Durn'); S.WS.clock.setDayMinutes(S.GT, 120); T.hour(6); d.life.carry = 0; d.life.needs = S.SIM.newNeeds(); S.lifeResume(d); const g0 = d.life.gold, s0 = S.LIFE.stock.mynoc.ore;
    const ev = []; const off = S.WS.bus.on('ResourceGathered', e => { if (e.actor === d.actorId) ev.push(e); });
    T.run(80, () => ev.length >= 3); const n = ev[0] && ev[0].node, nx = n % S.GW, ny = Math.floor(n / S.GW), st = ev[0] && S.RES.get(n);
    const sold0 = d.life.mem.size; d.life.carry = 8; T.run(400, () => d.life.carry === 0); off();
    return { node: ev[0] ? [nx, ny] : null, tile: ev[0] && S.tAt(nx, ny) === S.T.RK, zone: ev[0] && S.zoneAt(nx, ny), stock: st && [st.n, st.max], ev: ev.length, item: ev[0] && ev[0].item, sold: d.life.carry === 0, gold: d.life.gold - g0, stores: S.LIFE.stock.mynoc.ore - s0, mem: d.life.mem.recent(2).map(m => m.what) }; }""")
  check(r['tile'] and r['zone'] == 'mine' and r['stock'] and r['stock'][0] < r['stock'][1] and r['ev'] >= 3 and r['item'] == 'ore', f"a miner takes strokes from a real rock face in Mynoc Mine (stock {r['stock']}), each a ResourceGathered event", r)
  check(r['sold'] and r['gold'] > 0 and r['stores'] >= 8 and any('sold' in m for m in r['mem']), f"with full hands he carries the ore to the mine stores and is paid {r['gold']} gold", r)

  # 5. guards patrol by day and keep the night watch at their post
  r = J(pg, """() => { const S = __SF, T = __T, gs = T.L().filter(e => e.life.prof === 'guard' && e.life.town === 'vespar'); S.WS.clock.setDayMinutes(S.GT, 24); T.hour(9); for (const e of gs) S.lifeResume(e);
    const seen = gs.map(() => new Set()); T.run(300, () => { gs.forEach((g, i) => { if (g.life.doing === 'patrol' && (!g.nav || g.nav.state !== 'moving')) seen[i].add(g.life.wp % S.lifeTownGeo('vespar').patrol.length); }); return false; });
    T.hour(0.5); T.run(90); const w = gs.find(g => g.life.watch);
    return { pts: seen.map(s => s.size), route: S.lifeTownGeo('vespar').patrol.length, watch: w && Math.hypot(w.x - w.life.post.x, w.y - w.life.post.y), watchDoing: w && w.life.doing, others: gs.filter(g => !g.life.watch).map(g => g.life.doing) }; }""")
  check(min(r['pts']) >= 3, f"Vespar's watch walks its {r['route']}-point patrol round by day (each guard visited {r['pts']} points)", r)
  check(r['watch'] is not None and r['watch'] < 1.6 and r['watchDoing'] == 'watch' and all(d == 'patrol' for d in r['others']), 'at night one guard stands watch at the post; the others keep patrolling', r)

  # 6. the travelling merchant crosses to Vespar by day, announces his arrival, sells there and comes back
  r = J(pg, """() => { const S = __SF, T = __T, t = S.LIFE.trader, L = t.life; S.WS.clock.setDayMinutes(S.GT, 120); T.hour(8); L.until = S.GT + 1; const seq0 = S.WS.bus.recent(1)[0].seq; const out = { from: L.town };
    T.run(3, () => L.phase === 'travel'); out.left = L.phase; S.P.x = t.x + 1; S.P.y = t.y; const n0 = S.LOG.length; S.talk(t); out.roadPanel = S.PANEL; S.closePanel();
    const dt = T.run(900, () => L.phase === 'selling'); out.secs = Math.round(dt); out.town = L.town; out.ev = S.WS.bus.recent(256).filter(e => e.type === 'MerchantArrived' && e.seq > seq0).map(e => e.town);
    S.P.x = t.x + 1; S.P.y = t.y; S.talk(t); out.shop = S.PANEL; S.closePanel(); out.zone = S.zoneAt(Math.floor(t.x), Math.floor(t.y)); out.graph = !!S.NAV.graph;
    T.hour(20); L.until = S.GT; T.run(5); out.night = L.phase; return out; }""")
  to = 'vespar' if r['from'] == 'mynoc' else 'mynoc'
  check(r['left'] == 'travel' and r['town'] == to and r['ev'] == [to] and r['zone'] == to, f"Tobin leaves {r['from'].title()}, walks the cart road and reaches {to.title()}'s market in {r['secs']} s, with a MerchantArrived event", r)
  check(r['roadPanel'] != 'shop' and r['shop'] == 'shop' and r['night'] == 'selling' and not r['graph'], 'on the road he only talks; at the market his shop opens; he does not set out after dark; no travel graph was built', r)

  # 7. danger: a woodcutter who sees a wolf drops his work and runs for shelter, remembers it, and goes back once it is gone
  r = J(pg, """() => { const S = __SF, T = __T, w = T.by('Fennick'); T.hour(9); w.life.carry = 0; S.lifeResume(w); T.run(10); const d = S.MON.dire_wolf;
    const wolf = S.addEnt({ kind: 'mon', type: 'dire_wolf', name: d.n, x: w.x + 6, y: w.y, hp: d.hp, max: d.hp, state: 'idle', home: { x: w.x + 6, y: w.y }, sect: 0, ward: 0 });
    T.run(3, () => w.life.goal && w.life.goal.act === 'shelter'); const out = { act: w.life.goal && w.life.goal.act, why: w.life.mind.why, safety: w.life.needs.safety, mem: w.life.mem.recent(1)[0] };
    S.rmEnt(wolf); T.run(240, () => w.life.goal && w.life.goal.act === 'gather'); out.back = w.life.goal && w.life.goal.act; return out; }""")
  check(r['act'] == 'shelter' and r['safety'] > .5 and r['mem'] and r['mem']['what'] == 'fled from' and 'dire_wolf' in (r['mem']['who'] or ''), f"Fennick sees a wolf, abandons his work and heads for shelter ({r['why']}), and remembers it", r)
  check(r['back'] == 'gather', 'once the wolf is gone and the fright fades he goes back to the woods', r)

  # 8. crowds spread out: the evening gathering uses separate spots
  r = J(pg, """() => { const S = __SF, T = __T, L = T.L().filter(e => e.life.sched); S.WS.clock.setDayMinutes(S.GT, 120); T.hour(18.8); for (const e of L) S.lifeResume(e); T.run(30);
    const soc = L.filter(e => e.life.doing === 'social'); let minD = 99; for (let i = 0; i < soc.length; i++) for (let j = i + 1; j < soc.length; j++) minD = Math.min(minD, Math.hypot(soc[i].x - soc[j].x, soc[i].y - soc[j].y)); return { n: soc.length, minD }; }""")
  check(r['n'] >= 10 and r['minD'] > .5, f"{r['n']} townsfolk at the evening gathering stand apart (closest pair {r['minD']:.2f} m)", r)
  check(not errs, 'no page errors in the town scenarios', errs[:5])

  # 8b. the inn keeps late hours; townsfolk remember you
  r = J(pg, """() => { const S = __SF, T = __T, m = T.by('Maeve'), l = T.by('Lise'), out = {};
    T.hour(23.5); S.lifeResume(m); S.P.x = m.x + 1; S.P.y = m.y; S.talk(m); out.inn = S.PANEL; S.closePanel();
    T.hour(9); S.lifeResume(l); S.P.x = l.x + 1; S.P.y = l.y; S.talk(l); const s1 = (l.say || {}).t || l.sayT || ''; S.update(.05); S.talk(l); out.mem = l.life.mem.knows('talked with', S.P.actorId);
    out.second = JSON.stringify(l.say || l.bubble || null); return out; }""")
  check(r['inn'] == 'shop', "Maeve's inn is open at 23:30", r)
  check(r['mem'] and 'Tess' in r['second'], 'Lise remembers talking with you and greets you by name the next time', r)

  # 9. a reload resumes the day: at night everyone is at home at once, not walking back from their counters
  J(pg, "() => { __T.hour(23.5); __SF.save(); }"); pg.reload(); pg.wait_for_timeout(400); pg.click('[data-c=cont]'); pg.wait_for_timeout(400); J(pg, HELP)
  r = J(pg, """() => { const S = __SF, T = __T, L = T.L().filter(e => e.life.sched && e.life.prof !== 'astronomer' && e.life.prof !== 'innkeeper'); return { h: S.hourOfDay(), home: L.filter(e => T.inside(e, e.life.home.b)).length, n: L.length, ids: L.map(e => e.actorId).filter(Boolean).length, lise: T.by('Lise').life.mem.knows('talked with', S.P.actorId), stores: S.LIFE.stock.mynoc.ore }; }""")
  check(r['h'] > 23 and r['home'] == r['n'] == r['ids'], f"after a reload at {r['h']:.1f} h all {r['n']} are home immediately, with the same ids", r)
  check(r['lise'] and r['stores'] > 0, 'memories and the town stores survive the reload', r)

  # 10. cost
  r = J(pg, """() => { const S = __SF; S.update(.05); const t = performance.now(); for (let i = 0; i < 2000; i++) S.update(.05); return { ms: (performance.now() - t) / 2000 }; }""")
  check(r['ms'] < 3, f"{r['ms']:.2f} ms per simulation step with town life running", r)
  check(not errs, 'no page errors after the reload', errs[:5])
  ctx.close(); b.close()
print('ALL PASS' if not fails else f'{fails} FAILED'); sys.exit(1 if fails else 0)
