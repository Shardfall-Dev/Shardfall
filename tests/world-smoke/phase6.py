# Living World phase 6 (v0.35) in the built game: simulation tiers A/B/C and world-state persistence of the population.
# usage: python3 tests/world-smoke/phase6.py Shardfall_v0.35.html [/path/to/chrome]   (run.py runs it after the other phases)
# The animation loop is held; the test drives __SF.update(0.05).
import sys, json, os
from playwright.sync_api import sync_playwright
f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.35.html')
chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
HOLD = "window.__rafHold = true; { const raf = window.requestAnimationFrame.bind(window); window.__raf = raf; window.requestAnimationFrame = cb => window.__rafHold ? (window.__rafCb = cb, 0) : raf(cb); }"
SEED = "S => { let a = %d >>> 0; S.setRng(() => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }); }"
fails = 0
def check(ok, msg, got=None):
  global fails
  print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else '  got: ' + json.dumps(got)[:900])); fails += 0 if ok else 1
def page(b, q='', vp=(844, 390)):
  ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}); pg = ctx.new_page(); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
  pg.add_init_script(HOLD); pg.goto('file://' + f + q); pg.wait_for_timeout(400)
  return ctx, pg, errs
def new_char(pg, seed=7):
  pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(400)
  pg.evaluate('(' + (SEED % seed) + ')(__SF)'); pg.evaluate("o => __CC.quick(o)", {'name': 'Tess'}); pg.wait_for_timeout(300)
def put_save(pg, js, raw):   # write a save from the title screen, where nothing is running that could save over it
  pg.reload(); pg.wait_for_timeout(400); pg.evaluate(js, raw)
def cont(pg, seed=7):
  pg.reload(); pg.wait_for_timeout(400); pg.evaluate('(' + (SEED % seed) + ')(__SF)'); pg.click('[data-c=cont]'); pg.wait_for_timeout(400)
J = lambda pg, js, a=None: pg.evaluate(js, a) if a is not None else pg.evaluate(js)
# helpers inside the page: run n steps; the world's bookkeeping (registry, spawner counts, camp counts) checked against the live actors
HELP = """() => { window.__T = { run(n) { for (let i = 0; i < n; i++) __SF.update(.05); },
  books() { const S = __SF, live = S.ents.filter(e => !e.gone && e.kind !== 'corpse'), ids = live.map(e => e.actorId);
    const per = new Map(); for (const e of live) if (e.kind === 'mon' && e.sp) per.set(e.sp, (per.get(e.sp) || 0) + 1);
    let spBad = 0; for (const s of S.SPAWNS) if ((per.get(s) || 0) !== s.n) spBad++;
    let campBad = 0; for (const c of S.ECOS.camps.values()) { const n = live.filter(e => e.kind === 'mon' && e.sp && e.sp.camp === c).length; if (n !== c.alive) campBad++; }
    return { n: live.length, uniq: new Set(ids).size, reg: S.WS.reg.size, spBad, campBad, mons: live.filter(e => e.kind === 'mon').length }; },
  pop() { return __SF.ents.filter(e => e.kind === 'mon' && e.sp && !e.gone).map(e => [e.actorId, e.type, Math.round(e.x * 10) / 10, Math.round(e.y * 10) / 10, Math.round(e.hp)]).sort((a, b) => a[0] < b[0] ? -1 : 1); } }; }"""

with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])

  # 1. tiers by distance; radius A follows the screen; fixed and busy actors stay local; guards and the merchant never go distant
  ctx, pg, errs = page(b); new_char(pg); J(pg, HELP)
  r = J(pg, """() => { const S = __SF, P = S.P; __T.run(40); const R = S.TIER.radii, live = S.ents.filter(e => !e.gone && e.kind !== 'corpse' && e !== P);
    const d = e => Math.hypot(e.x - P.x, e.y - P.y); let wrongA = 0, wrongC = 0, guardC = 0;
    for (const e of live) { if (!e.tier) continue; const busy = S.tierBusy(e) || ['pet', 'summon', 'hireling'].includes(e.archetype) || e.quest;
      if (d(e) < R.a - 1 && e.tier !== 'A') wrongA++; if (!busy && d(e) > R.b + 7 && e.tier !== 'C' && e.archetype !== 'guard' && e.archetype !== 'adventurer' && e !== S.LIFE.trader) wrongC++; if (e.archetype === 'guard' && e.tier === 'C') guardC++; }
    return { R, view: S.TIER.view, last: S.TIER.last, wrongA, wrongC, guardC, wren: S.allyOf().tier, trader: S.LIFE.trader && S.LIFE.trader.tier, total: live.length }; }""")
  check(r['wrongA'] == 0 and r['wrongC'] == 0, f"tiers by distance: local {r['last']['A']}, regional {r['last']['B']}, distant {r['last']['C']} (A ≤ {r['R']['a']:.0f} m, B ≤ {r['R']['b']:.0f} m)", r)
  check(r['R']['a'] >= r['view'] + 8 and r['R']['a'] >= 40 and r['R']['b'] >= r['R']['a'] + 60, f"radius A covers the whole screen ({r['view']:.1f} m to the farthest corner) plus a margin", r)
  check(r['guardC'] == 0 and r['trader'] in ('A', 'B') and r['wren'] == 'A', 'guards and the travelling merchant never go distant; Wren is always local', r)
  r = J(pg, """() => { const S = __SF, P = S.P; const far = S.ents.filter(e => e.kind === 'mon' && !e.gone && e.sp && e.tier === 'C'); const m = far[0], o = far[1];
    m.target = o; m.state = 'chase'; __T.run(2); const t1 = m.tier; m.target = null; m.state = 'idle'; m.hp = m.max; __T.run(2); return { busy: t1, calm: m.tier }; }""")
  check(r['busy'] == 'A' and r['calm'] == 'C', 'a distant creature in a fight runs every step (tier A) and drops back to distant when calm', r)
  check(not errs, 'no page errors', errs[:5]); ctx.close()

  # 2. a bigger screen widens tier A (2560 × 1440, zoom as shipped)
  ctx, pg, errs = page(b, vp=(2560, 1440)); new_char(pg); J(pg, HELP)
  r = J(pg, "() => { __T.run(25); return { R: __SF.TIER.radii, view: __SF.TIER.view }; }")
  check(r['R']['a'] > 40 and r['R']['a'] >= r['view'] + 8, f"on a 2560 × 1440 screen radius A grows to {r['R']['a']:.0f} m (farthest corner {r['view']:.0f} m)", r)
  ctx.close()

  # 3. distant creatures hold; coming back into range they carry on. Moving across the world never duplicates or loses an actor
  ctx, pg, errs = page(b); new_char(pg); J(pg, HELP)
  r = J(pg, """() => { const S = __SF, P = S.P; __T.run(20); const m = S.ents.find(e => e.kind === 'mon' && !e.gone && e.sp && e.tier === 'C' && ['deer', 'hare', 'boar'].includes(e.type));
    const p0 = [m.x, m.y]; __T.run(200); const held = Math.hypot(m.x - p0[0], m.y - p0[1]);
    const home = [P.x, P.y]; P.hidden = true; P.x = m.x + 60; P.y = m.y; let moved = 0, path = 0; m.wt = 0;   // the player 60 m away: the creature is regional
    for (let i = 0; i < 600; i++) { const a = [m.x, m.y]; S.update(.05); path += Math.hypot(m.x - a[0], m.y - a[1]); }
    const books0 = __T.books(); P.x = home[0]; P.y = home[1]; return { type: m.type, held, path, tier: m.tier, books0 }; }""")
  check(r['held'] == 0, f"a distant {r['type']} holds where it is for 10 s (moved {r['held']:.2f} m)", r)
  check(r['path'] > .3 and r['tier'] in ('A', 'B'), f"with the player 60 m away it is regional again and roams on ({r['path']:.1f} m in 30 s)", r)
  r = J(pg, """() => { const S = __SF, P = S.P; const b0 = __T.books(); const ids0 = new Set(S.ents.filter(e => !e.gone && e.kind !== 'corpse').map(e => e.actorId));
    const stops = [[1875, 840], [2300, 600], [900, 1300], [300, 300], [1500, 1100], [96, 300]]; const seen = [];
    for (const [x, y] of stops) { P.x = x + .5; P.y = y + .5; for (let i = 0; i < 160; i++) S.update(.05); seen.push(Object.assign({ at: [x, y] }, __T.books(), { tiers: S.TIER.last })); }
    const named = S.ents.filter(e => !e.gone && e.kind !== 'corpse').map(e => e.actorId), lostNamed = [...ids0].filter(i => i.startsWith('npc:') && !named.includes(i));
    return { b0, seen, lostNamed, woke: S.TIER.woke }; }""")
  bad = [s for s in r['seen'] if not (s['n'] == s['uniq'] == s['reg'] and s['spBad'] == 0 and s['campBad'] == 0)]
  check(not bad and r['b0']['n'] == r['b0']['reg'], f"across six stops ({', '.join(str(s['tiers']['A']) + '/' + str(s['tiers']['B']) + '/' + str(s['tiers']['C']) for s in r['seen'])} A/B/C) every actor is registered once and every spawner and camp count matches its live creatures", bad or r['seen'][:2])
  check(not r['lostNamed'] and r['woke'] > 50, f"no named townsperson lost; {r['woke']} actors woke from distant without a duplicate", r['lostNamed'][:5])
  check(not errs, 'no page errors', errs[:5]); ctx.close()

  # 4. townsfolk out of range follow their day abstractly: arriving in Vespar at noon, they stand where the schedule has taken them,
  #    their needs caught up, and nobody appears on screen: anyone whose place is near the player walks there
  ctx, pg, errs = page(b); new_char(pg); J(pg, HELP)
  r = J(pg, """() => { const S = __SF, P = S.P; S.WS.clock.setHour(S.GT, 6.2); __T.run(60);
    const vs = S.LIFE.npcs.filter(e => e.life.town === 'vespar' && e.life.prof !== 'guard' && e.life.prof !== 'trader'); const tiers0 = vs.map(e => e.tier);
    const hunger0 = vs.map(e => e.life.needs.hunger); S.WS.clock.setHour(S.GT, 12.2); for (const e of vs) e.tierAt = S.GT - 6 * S.WS.clock.secondsPerHour();   // six game hours away
    const pos0 = new Map(vs.map(e => [e, [e.x, e.y]])); const G = S.lifeTownGeo('vespar'); P.hidden = true;
    for (const [dx, dy] of [[70, 0], [-70, 0], [0, 70], [0, -70], [50, 50]]) { if (S.canStand(P, G.center.x + dx, G.center.y + dy)) { P.x = G.center.x + dx; P.y = G.center.y + dy; break; } }   // regional range of the town: close enough to wake it, the town itself off screen
    const w0 = S.TIER.woke, pl0 = S.TIER.placed, wk0 = S.TIER.walked; S.update(.05); const R = S.TIER.radii;
    let popIn = 0, moved = 0, onSched = 0; for (const e of vs) { const [x, y] = pos0.get(e), jump = Math.hypot(e.x - x, e.y - y); if (jump > 1) { moved++; if (Math.hypot(e.x - P.x, e.y - P.y) <= R.a) popIn++; }
      const b = S.SIM.scheduleAt(e.life.sched, 12.2); if (e.life.goal && e.life.goal.place === b.place) onSched++; }
    return { n: vs.length, tiers0: [...new Set(tiers0)], woke: S.TIER.woke - w0, placed: S.TIER.placed - pl0, walked: S.TIER.walked - wk0, popIn, moved, onSched,
      hungerUp: vs.filter((e, i) => e.life.needs.hunger > hunger0[i] + .2).length }; }""")
  check(r['tiers0'] == ['C'] and r['woke'] >= r['n'] and r['n'] >= 6, f"{r['n']} Vespar townsfolk were distant while you were at the Quay and all woke when you came within regional range", r)
  check(r['popIn'] == 0 and r['placed'] > 0 and r['moved'] == r['placed'], f"{r['placed']} were placed where the noon schedule took them (out of view), {r['walked']} near you walk there; none appeared on screen", r)
  check(r['onSched'] >= r['placed'] and r['hungerUp'] >= r['n'] // 2, f"their goals follow the noon schedule ({r['onSched']}/{r['n']}) and six hours of needs caught up ({r['hungerUp']} hungrier)", r)
  r = J(pg, """() => { const S = __SF, P = S.P, G = S.lifeTownGeo('vespar'); P.x = 96; P.y = 300; __T.run(40); S.WS.clock.setHour(S.GT, 19.2);
    const vs = S.LIFE.npcs.filter(e => e.life.town === 'vespar' && e.life.prof !== 'guard' && e.life.prof !== 'trader'), pos0 = new Map(vs.map(e => [e, [e.x, e.y]]));
    P.x = G.center.x; P.y = G.center.y; const wk0 = S.TIER.walked; S.update(.05); let popIn = 0; for (const e of vs) { const [x, y] = pos0.get(e); if (Math.hypot(e.x - x, e.y - y) > 1 && Math.hypot(e.x - P.x, e.y - P.y) <= S.TIER.radii.a) popIn++; }
    __T.run(200); return { walked: S.TIER.walked - wk0, popIn, going: vs.filter(e => e.nav || e.life.goal).length, n: vs.length }; }""")
  check(r['walked'] > 0 and r['popIn'] == 0 and r['going'] > 0, f"arriving in the middle of town at dusk: {r['walked']} townsfolk whose evening place is near you set off on foot instead of appearing there", r)
  r = J(pg, "() => { __T.run(400); return __T.books(); }")
  check(r['n'] == r['uniq'] == r['reg'] and r['spBad'] == 0, 'the town carries on after the wake-up with every book straight', r)
  check(not errs, 'no page errors', errs[:5]); ctx.close()

  # 5. persistence: every spawned creature comes back with its id, species, position and health; a thinned region stays thin;
  #    camps keep their counts; packs keep their leader; the same save loaded twice gives the same world
  ctx, pg, errs = page(b); new_char(pg); J(pg, HELP)
  r = J(pg, """() => { const S = __SF, P = S.P; __T.run(100); const C = S.ECOS.camps;
    const reg = (() => { const c = {}; for (const e of S.ents) if (e.kind === 'mon' && e.sp && !e.gone) c[e.sp.region] = (c[e.sp.region] || 0) + 1; return Object.entries(c).filter(([k]) => k.startsWith('wild:')).sort((a, b) => b[1] - a[1])[0]; })();
    const victims = S.ents.filter(e => e.kind === 'mon' && e.sp && !e.gone && e.sp.region === reg[0]); for (const m of victims) S.killMon(m, P);
    for (const e of S.ents.filter(e => e.kind === 'mon' && e.sp && !e.gone).slice(0, 25)) e.hp = Math.max(1, Math.round(e.max / 2));
    const packs = {}; for (const e of S.ents) if (e.kind === 'mon' && e.packId && !e.gone) { const k = e.packId; packs[k] = packs[k] || { n: 0, lead: null, ids: [] }; packs[k].n++; packs[k].ids.push(e.actorId); if (e.leader === e) packs[k].lead = e.actorId; }
    const camps = {}; for (const [k, c] of C) camps[k] = c.alive; S.save(); const raw = localStorage.getItem('shardfall.save.v1'); const sv = JSON.parse(raw);
    return { region: reg[0], killed: victims.length, pop: __T.pop(), packs: Object.values(packs).map(p => [p.lead, p.ids.sort()]).sort(), camps, rows: sv.eco.pop.mons.length, kb: raw.length / 1024, ecoKB: JSON.stringify(sv.eco).length / 1024, v: sv.v, books: __T.books() }; }""")
  check(r['killed'] > 0 and r['rows'] == len(r['pop']), f"the save holds all {r['rows']} spawned creatures ({r['ecoKB']:.0f} KB of a {r['kb']:.0f} KB save; browser storage allows about 5 MB)", {k: r[k] for k in ('killed', 'rows', 'kb')})
  check(r['kb'] < 1024, 'the whole save stays well under 1 MB', r['kb'])
  before = r
  cont(pg); J(pg, HELP)
  r = J(pg, """reg => { const S = __SF; const C = S.ECOS.camps; const packs = {}; for (const e of S.ents) if (e.kind === 'mon' && e.packId && !e.gone) { const k = e.packId; packs[k] = packs[k] || { lead: null, ids: [] }; packs[k].ids.push(e.actorId); if (e.leader === e) packs[k].lead = e.actorId; }
    const camps = {}; for (const [k, c] of C) camps[k] = c.alive; return { pop: __T.pop(), regionNow: S.ents.filter(e => e.kind === 'mon' && e.sp && !e.gone && e.sp.region === reg).length, packs: Object.values(packs).map(p => [p.lead, p.ids.sort()]).sort(), camps, restored: S.ECO_POP.restored, dropped: S.ECO_POP.dropped, books: __T.books() }; }""", before['region'])
  check(r['pop'] == before['pop'], f"after the reload all {len(r['pop'])} creatures are back with the same ids, species, positions and health", {'a': len(before['pop']), 'b': len(r['pop']), 'diff': [x for x in r['pop'] if x not in before['pop']][:3]})
  check(r['regionNow'] == 0, f"the region you cleared ({before['region']}, {before['killed']} creatures) is still empty right after the reload", r['regionNow'])
  check(r['packs'] == before['packs'] and r['camps'] == before['camps'], f"{len(r['packs'])} packs keep their members and leaders; every camp keeps its count", {'camps': [before['camps'], r['camps']]})
  check(r['books']['n'] == r['books']['reg'] == r['books']['uniq'] and r['books']['spBad'] == 0 and r['books']['campBad'] == 0 and r['dropped'] == 0, 'spawner, camp and registry books are straight after the load; nothing was dropped', r['books'])
  r = J(pg, "() => { const S = __SF, s = S.SPAWNS.filter(s => s.region && s.n < s.max), soon = s.filter(x => x.next <= S.GT + 1).length; __T.run(20 * 60 * 5); const reg = S.ents.filter(e => e.kind === 'mon' && e.sp && !e.gone).length; return { vacant: s.length, soon, books: __T.books() }; }")
  check(r['soon'] == 0 and r['vacant'] > 0, f"{r['vacant']} spawners with vacancies refill at their own pace, not all at once on load", r)
  check(r['books']['spBad'] == 0 and r['books']['n'] == r['books']['reg'], 'five minutes later the books are still straight', r['books'])
  # the same save loaded twice
  first = J(pg, "() => { __SF.save(); return localStorage.getItem('shardfall.save.v1'); }")
  cont(pg); J(pg, HELP); a = J(pg, '() => __T.pop()')
  put_save(pg, "raw => localStorage.setItem('shardfall.save.v1', raw)", first); cont(pg); J(pg, HELP); b2 = J(pg, '() => __T.pop()')
  check(a == b2 and len(a) > 300, f'the same save loaded twice gives the same {len(a)} creatures', {'a': len(a), 'b': len(b2)})
  check(not errs, 'no page errors', errs[:5])

  # 6. damaged or foreign rows never duplicate a creature; an older save (no rows) fills the world fresh as before
  put_save(pg, """raw => { const s = JSON.parse(raw), m = s.eco.pop.mons; m.push(m[0].slice(), ['mon:wyrm:999999', 'no-such-creature', m[0][2], 1, 1, 5, 1, 1, 0, 0, 0, 0], ['mon:rat:999998', 'rat', 'nowhere@0,0', 1, 1, 5, 1, 1, 0, 0, 0, 0], ['mon:rat:999997', 'rat', m[0][2], 'x', 1, 5, 1, 1, 0, 0, 0, 0]);
    localStorage.setItem('shardfall.save.v1', JSON.stringify(s)); return m.length; }""", first)
  cont(pg); J(pg, HELP)
  r = J(pg, "() => ({ dropped: __SF.ECO_POP.dropped, why: __SF.ECO_POP.why, books: __T.books(), n: __T.pop().length })")
  check(r['dropped'] == 4 and r['why'].get('duplicate') == 1 and r['n'] == len(a) and r['books']['n'] == r['books']['uniq'] == r['books']['reg'], f"four bad rows (a repeated id, an unknown species, an unknown spawner, a broken number) are dropped: {json.dumps(r['why'])}", r)
  put_save(pg, "raw => { const s = JSON.parse(raw); delete s.eco.pop; s.eco.v = 1; localStorage.setItem('shardfall.save.v1', JSON.stringify(s)); }", first)
  cont(pg); J(pg, HELP)
  r = J(pg, "() => ({ n: __T.pop().length, restored: __SF.ECO_POP.restored, ids: __T.pop().filter(x => +x[0].split(':').pop() > 0).length, books: __T.books(), max: Math.max(...__T.pop().map(x => +x[0].split(':').pop())) })", )
  check(r['n'] > 500 and r['restored'] == 0 and r['books']['spBad'] == 0, f"a save from before v0.35 (no creature rows) boots with a fresh population of {r['n']}", r)
  check(not errs, 'no page errors', errs[:5]); ctx.close()

  # 7. cost: tiers on against ?tiers=off on the same seeded world (desktop, this machine)
  out = {}
  for q in ('', '?tiers=off'):
    ctx, pg, errs = page(b, q); new_char(pg, 42); J(pg, HELP)
    out[q or 'on'] = J(pg, """() => { __T.run(400); const t0 = performance.now(); __T.run(2000); return (performance.now() - t0) / 2000; }""")
    ctx.close()
  check(out['on'] < out['?tiers=off'], f"update per 50 ms step: {out['on']:.3f} ms with tiers, {out['?tiers=off']:.3f} ms without", out)
  b.close()
print(fails and f'{fails} FAILED' or 'ALL PASS'); sys.exit(1 if fails else 0)
