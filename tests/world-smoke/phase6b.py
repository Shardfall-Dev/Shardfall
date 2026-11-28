# Living World phase 6, step 2 in the built game (Playwright + Chrome): world-state persistence and phone drawing (master spec §20, §25, §26).
# Creature remains keep their loot, carving state and time left through a save and reload (no second loot roll, no duplicate, the
# uid counter stays ahead, expired remains are not saved, older saves load); the travelling merchant carries real cargo on the road,
# saved with him, on his body if he dies, sold when he arrives; phones draw at most a budget of back-buffer pixels (?bb=full keeps
# the old divisor), the desktop is unchanged, and screen and world coordinates still agree.
# usage: python3 tests/world-smoke/phase6b.py Shardfall_v0.43.html [/path/to/chrome]   (also run by world-smoke/run.py)
import sys, json, os
from playwright.sync_api import sync_playwright
f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.43.html')
chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
HOLD = "window.__rafHold = true; { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => window.__rafHold ? (window.__rafCb = cb, 0) : raf(cb); }"
SEED = "S => { let a = %d >>> 0; S.setRng(() => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }); }"
fails = 0
def check(ok, msg, got=None):
  global fails
  print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else '  got: ' + json.dumps(got)[:1200])); fails += 0 if ok else 1
def page(b, q='?tiers=off'):   # whole-world rules wherever the player stands; tiers are on for the long run at the end
  ctx = b.new_context(viewport={'width': 844, 'height': 390}); pg = ctx.new_page(); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
  pg.add_init_script(HOLD); pg.goto('file://' + f + q); pg.wait_for_timeout(400)
  return ctx, pg, errs
def new_char(pg, seed=5):
  pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(400)
  pg.evaluate('(' + (SEED % seed) + ')(__SF)'); pg.evaluate("o => __CC.quick(o)", {'name': 'Tess', 'template': 'advanced', 'stats': [45, 10, 25], 'skills': [['swordsmanship', 50], ['magery', 30], ['tactics', 20]]}); pg.wait_for_timeout(300)
def cont(pg, seed=5):
  pg.reload(); pg.wait_for_timeout(400); pg.evaluate('(' + (SEED % seed) + ')(__SF)'); pg.click('[data-c=cont]'); pg.wait_for_timeout(400)
J = lambda pg, js, arg=None: pg.evaluate(js, arg)
HELP = """() => { const S = __SF; window.__T = {
  god: false,
  run(sec, until) { const n = Math.round(sec / .05); for (let i = 0; i < n; i++) { if (this.god && !S.P.ghost) S.P.hp = Math.max(S.P.hp, 400); S.update(.05); if (until && i % 4 === 0 && until()) return i * .05; } return sec; },
  A: n => S.ADV.list.find(e => e.name.startsWith(n)),
  calm() { for (const m of S.ents) if (m.kind === 'mon') m.pacified = 1e12; },
  put(e, p) { e.x = p.x; e.y = p.y; e._px = e.x; e._py = e.y; e.nav = null; },
  /* open wild ground near (x, y): standable around, not protected, not in a dungeon */
  wild(x, y) { for (let r = 0; r < 60; r += 1) for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, px = Math.floor(x + Math.cos(a) * r) + .5, py = Math.floor(y + Math.sin(a) * r) + .5;
      if (S.protAt(px, py) || S.levelAt(Math.floor(px), Math.floor(py))) continue; let ok = true; for (const [dx, dy] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3], [6, 0], [2, 2]]) if (!S.canStand({ kind: 'npc' }, px + dx, py + dy) || S.protAt(px + dx, py + dy)) ok = false;
      if (ok) return { x: px, y: py }; } return null; },
  /* one adventurer on stage at p; the others kept in their towns and not thinking; every creature lulled */
  stage(e, p) { this.calm(); S.WS.clock.setHour(S.GT, 12);   // daylight: cautious adventurers would otherwise head home at night for (const o of S.ADV.list) if (o !== e) { o.adv.thinkAt = 1e12; o.adv.mode = 'town'; o.foe = null; o.nav = null; }
    this.put(e, p); e.foe = null; e.adv.mode = 'hunt'; e.adv.ground = { x: p.x, y: p.y }; e.adv.groundAt = S.GT; e.adv.thinkAt = 0; e.adv.tend = null; e.adv.prep = null; return e; },
  mon(type, p, dx, dy) { const P = S.P, o = [P.x, P.y]; P.x = p.x; P.y = p.y; const m = S.spawnMon(type, dx, dy || 0); P.x = o[0]; P.y = o[1]; m.home = { x: m.x, y: m.y }; m.pacified = 0; return m; },
  uids(e) { return [...Object.values(e.equip).filter(Boolean), ...e.pack.items].filter(it => it.id !== 'garment' && it.id !== 'journal').map(it => it.uid).sort((a, b) => a - b); },
  ev(type, since, pred) { return S.WS.bus.recent().filter(r => r.type === type && r.seq > (since || 0) && (!pred || pred(r))); },
  seq() { const r = S.WS.bus.recent(); return r.length ? r[r.length - 1].seq : 0; } }; }"""



with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
  ctx, pg, errs = page(b); new_char(pg); J(pg, HELP)

  # 1. remains through a reload: the same loot (nothing rolled again), the carving state, the time left
  r = J(pg, """() => { const S = __SF, T = __T, P = S.P; T.calm(); const near = S.ents.filter(m => m.kind === 'mon' && !m.gone && m.hp > 0 && !m.quest && m.sp).sort((a, b) => S.dist(a, P) - S.dist(b, P)).slice(0, 6);
    for (const m of near) S.killMon(m, P); const rem = S.ents.filter(c => c.kind === 'corpse' && c.mon && !c.gone);
    const a = rem.find(c => c.cont.items.length > 1) || rem[0]; const took = a.cont.items[0]; a.cont.items.splice(0, 1); const sk = rem.find(c => !c.skinned && c !== a); if (sk) sk.skinned = true;
    const old = rem.find(c => c !== a && c !== sk); if (old) old.expires = S.GT - 1;
    const snap = S.ents.filter(c => c.kind === 'corpse' && c.mon && !c.gone && c.expires > S.GT).map(c => [c.mon, Math.round(c.x * 10) / 10, Math.round(c.y * 10) / 10, c.cont.items.map(i => i.id + ':' + i.qty + ':' + i.uid).sort().join(','), !!c.skinned, Math.round(c.expires - S.GT)]).sort();
    S.save(); const sv = JSON.parse(localStorage.getItem('shardfall.save.v1')), uids = sv.remains.flatMap(r => r.items.map(i => i.uid));
    return { n: near.length, snap, rows: sv.remains.length, uidOk: sv.uid > Math.max(0, ...uids), expiredOut: old ? !sv.remains.some(x => x.x === Math.round(old.x * 10) / 10 && x.y === Math.round(old.y * 10) / 10 && x.type === old.mon) : true, skinned: !!sk } }""")
  cont(pg); J(pg, HELP)
  r2 = J(pg, """() => { const S = __SF; return { snap: S.ents.filter(c => c.kind === 'corpse' && c.mon && !c.gone && c.expires > S.GT).map(c => [c.mon, Math.round(c.x * 10) / 10, Math.round(c.y * 10) / 10, c.cont.items.map(i => i.id + ':' + i.qty + ':' + i.uid).sort().join(','), !!c.skinned, Math.round(c.expires - S.GT)]).sort(), restored: S.REMAINS.restored, dropped: S.REMAINS.dropped } }""")
  strip = lambda s: [x[:5] for x in s]
  check(r['n'] >= 4 and r['rows'] == len(r['snap']) and r['expiredOut'] and r['uidOk'], f"the save holds every remains still lying there ({r['rows']}), not the expired one; the uid counter stays ahead of their items", r)
  check(strip(r2['snap']) == strip(r['snap']) and all(abs(a[5] - b[5]) <= 2 for a, b in zip(r2['snap'], r['snap'])) and r2['restored'] == r['rows'] and not r2['dropped'], 'after the reload the same remains lie in the same places with exactly the same items (the one taken stays taken, nothing rolled again), carved ones stay carved, with their time left', [r['snap'][:3], r2['snap'][:3], r2['dropped']])
  # an older save: no remains block → loads without them, and a broken row is dropped and counted
  J(pg, """() => { const S = __SF; S.save(); const sv = JSON.parse(localStorage.getItem('shardfall.save.v1')); sv.remains = [{ key: 'x', type: 'nonsense', x: 1, y: 1, left: 9, items: [] }, ...sv.remains.slice(0, 1), sv.remains[0]]; localStorage.setItem('shardfall.save.v1', JSON.stringify(sv)); }""")
  cont(pg); J(pg, HELP)
  r = J(pg, "() => ({ restored: __SF.REMAINS.restored, dropped: __SF.REMAINS.dropped })")
  check(r['restored'] == 1 and r['dropped'] == {'species': 1, 'duplicate': 1}, 'bad remains rows are dropped and counted, never duplicated', r)
  J(pg, """() => { const S = __SF; S.save(); const sv = JSON.parse(localStorage.getItem('shardfall.save.v1')); delete sv.remains; localStorage.setItem('shardfall.save.v1', JSON.stringify(sv)); }""")
  cont(pg); J(pg, HELP)
  r = J(pg, "() => ({ restored: __SF.REMAINS.restored, n: __SF.ents.filter(c => c.kind === 'corpse' && c.mon && !c.gone).length })")
  check(r['restored'] == 0 and r['n'] == 0, 'a save from before v0.43 (no remains) loads without them', r)

  # 2. the merchant's cargo: real goods on the road, saved with him, on his body if he falls, sold when he arrives
  r = J(pg, """() => { const S = __SF, T = __T, t = S.LIFE.trader, L = t.life; S.WS.clock.setHour(S.GT, 9); L.phase = 'selling'; L.until = S.GT - 1; L.thinkAt = 0; T.run(1.5, () => L.phase === 'travel');
    const cargo = (L.cargo || []).map(i => [i.id, i.qty, i.uid]); S.save(); const sv = JSON.parse(localStorage.getItem('shardfall.save.v1'));
    return { phase: L.phase, cargo, saved: (sv.life.trader.cargo || []).map(i => i.uid), uidOk: sv.uid > Math.max(0, ...cargo.map(c => c[2])) } }""")
  check(r['phase'] == 'travel' and 0 < len(r['cargo']) <= 6 and all(c[2] > 0 for c in r['cargo']) and r['saved'] == [c[2] for c in r['cargo']] and r['uidOk'], f"setting out, Tobin loads real goods on his cart: {[c[0] + ' x' + str(c[1]) for c in r['cargo']]}; they are saved with him", r)
  cont(pg); J(pg, HELP)
  r2 = J(pg, """() => { const S = __SF, t = S.LIFE.trader, L = t.life, cargo = (L.cargo || []).map(i => [i.id, i.qty, i.uid]); const uids = cargo.map(c => c[2]);
    S.damageActor(t, 9999, 'phys', null); const body = S.ents.find(c => c.npcBody === t.actorId && !c.gone); const onBody = body ? body.cont.items.filter(i => uids.includes(i.uid)).length : 0;
    return { cargo, onBody, left: (L.cargo || []).length } }""")
  check(r2['cargo'] == r['cargo'] and r2['onBody'] == len(r['cargo']) and r2['left'] == 0, 'after a reload he still carries the same goods; killed on the road, every piece of cargo is on his body (the same items)', [r['cargo'], r2])
  r = J(pg, """() => { const S = __SF, t = S.LIFE.trader, L = t.life; S.npcdReturn(t, t.home); L.cargo = [SF.newItem('hatchet', 2)]; const g0 = L.gold; S.traderUnload(t); return { g: L.gold - g0, left: L.cargo.length } }""")
  check(r['g'] > 0 and r['left'] == 0, f"arriving, he sells his cargo at the market (+{r['g']} gold) and the cart is empty", r)
  check(not errs, 'no page errors', errs[:5]); ctx.close()

  # 3. phones draw at most a budget of back-buffer pixels; ?bb=full and the desktop keep the old whole-number divisor
  def phone(q, dpr, w=390, h=844):
    c = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dpr, is_mobile=True, has_touch=True); pp = c.new_page(); e2 = []; pp.on('pageerror', lambda e: e2.append(str(e)))
    pp.add_init_script(HOLD); pp.goto('file://' + f + q); pp.wait_for_timeout(400); new_char(pp)
    out = pp.evaluate("""() => { const S = __SF; S.render(); const P = S.P, o = S.__SF ? null : null; const sc = S.screenOf(P); return { DP: S.DP, px: S.LB.width * S.LB.height, cx: sc.x, cy: sc.y, vw: innerWidth, vh: innerHeight } }""")
    c.close(); return out, e2
  r, e2 = phone('', 2); r1, e3 = phone('?bb=full', 2); r3, e4 = phone('', 3)
  check(1.4 < r['DP'] and r['px'] <= 605000 and r1['DP'] == 1, f"a pixel-ratio-2 phone draws {r['px']} back-buffer pixels (divisor {r['DP']:.2f}); ?bb=full keeps the old divisor 1 ({r1['px']} pixels)", [r, r1])
  check(r3['DP'] >= 2 and r3['px'] <= 605000, f"a pixel-ratio-3 phone: divisor {r3['DP']:.2f}, {r3['px']} pixels", r3)
  check(all(abs(x['cx'] - x['vw'] / 2) < 4 and abs(x['cy'] - x['vh'] / 2) < 60 for x in (r, r1, r3)), 'the player is drawn at the middle of the screen at every divisor (screen and world coordinates agree)', [r, r1, r3])
  check(not (e2 or e3 or e4), 'no page errors on the phones', (e2 + e3 + e4)[:5])
  c = b.new_context(viewport={'width': 1280, 'height': 720}); pp = c.new_page(); pp.add_init_script(HOLD); pp.goto('file://' + f); pp.wait_for_timeout(400); new_char(pp)
  r = pp.evaluate("() => ({ DP: __SF.DP })"); c.close()
  check(r['DP'] == 1, 'the desktop keeps its divisor (1 at 1280 × 720)', r)
  b.close()
print('ALL PASS' if not fails else f'{fails} FAILED'); sys.exit(1 if fails else 0)
