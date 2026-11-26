# Living World Phase 1 in the built game (Playwright + Chrome): stable actor ids, controller dispatch, the shared damage entry,
# death exactly once, bounded events, save/load identity, the v4 → v5 save migration and seeded determinism.
# usage: python3 tests/world-smoke/run.py Shardfall_v0.21.html [/path/to/chrome]
# The animation loop is held (requestAnimationFrame is stubbed before the page runs) so every step is driven by the test
# through __SF.update(0.05); one scenario releases it and lets the real loop run.
import sys, json, os
from playwright.sync_api import sync_playwright
here = os.path.dirname(os.path.abspath(__file__)); f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.21.html')
chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
HOLD = "window.__rafHold = true; { const raf = window.requestAnimationFrame.bind(window); window.__raf = raf; window.requestAnimationFrame = cb => window.__rafHold ? (window.__rafCb = cb, 0) : raf(cb); }"
SEED = "S => { let a = %d >>> 0; S.setRng(() => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }); }"
fails = 0
def check(ok, msg, got=None):
  global fails
  print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else '  got: ' + json.dumps(got)[:600])); fails += 0 if ok else 1
def page(b, hold=True, seed=None, fresh=True, cont=False):
  ctx = b.new_context(viewport={'width': 844, 'height': 390}); pg = ctx.new_page(); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
  if hold: pg.add_init_script(HOLD)
  pg.goto('file://' + f); pg.wait_for_timeout(400)
  return ctx, pg, errs
def new_char(pg, seed=None):
  pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(400)
  if seed is not None: pg.evaluate('(' + (SEED % seed) + ')(__SF)')
  pg.fill('#ccn', 'Tess'); pg.click('[data-c=go]'); pg.wait_for_timeout(300)
J = lambda pg, js: pg.evaluate(js)

with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])

  # 1. every actor has one stable id, an archetype and a controller; corpses are not actors
  ctx, pg, errs = page(b); new_char(pg)
  r = J(pg, """() => { const S = __SF; const acts = S.ents.filter(e => !e.gone && e.kind !== 'corpse'); const ids = acts.map(e => e.actorId);
    const by = {}; for (const e of acts) by[e.archetype] = (by[e.archetype] || 0) + 1;
    return { n: acts.length, withId: ids.filter(Boolean).length, uniq: new Set(ids).size, reg: S.WS.reg.size, by, ctrlOk: acts.every(e => S.SIM.CONTROLLERS.includes(e.ctrl)),
      player: S.P.actorId, wren: S.allyOf().actorId, guards: acts.filter(e => e.role === 'guard').map(e => e.actorId).slice(0, 3), banker: S.ents.find(e => e.role === 'banker').actorId,
      mons: acts.filter(e => e.kind === 'mon').every(e => /^mon:[a-z_]+:\\d+$/.test(e.actorId)), spawned: S.WS.bus.counts().ActorSpawned } }""")
  check(r['n'] > 100 and r['withId'] == r['n'] == r['uniq'] == r['reg'], f"{r['n']} actors, each with a unique registered id", r)
  check(r['ctrlOk'] and r['player'] == 'player:p1' and r['wren'] == 'npc:wren' and r['banker'] == 'npc:odile-banker' and r['guards'][:2] == ['npc:quay-warden', 'npc:quay-warden-2'], 'named ids and controllers', r)
  check(r['mons'] and r['spawned'] == r['n'], 'spawned creatures take numbered ids; one ActorSpawned each', r)
  check(set(r['by']) >= {'player', 'merchant', 'civilian', 'guard', 'animal', 'monster', 'criminal', 'hireling'}, 'archetypes: ' + json.dumps(r['by']), r)

  # 2. controller dispatch drives the same behaviour as before; townsfolk stay put; taming re-derives the controller and keeps the id
  r = J(pg, """() => { const S = __SF, P = S.P; const far = e => Math.hypot(e.x - P.x, e.y - P.y) > 40;
    const m = S.ents.find(e => e.kind === 'mon' && e.type === 'boar' && far(e)); const n = S.ents.find(e => e.role === 'smith');
    const m0 = [m.x, m.y], n0 = [n.x, n.y]; m.state = 'idle'; m.wt = 0; for (let i = 0; i < 200; i++) S.update(.05);
    const moved = Math.hypot(m.x - m0[0], m.y - m0[1]) > .2, npcStill = n.x === n0[0] && n.y === n0[1];
    const r2 = S.ents.find(e => e.kind === 'mon' && e.type === 'rat'); const id = r2.actorId; r2.x = P.x + 3; r2.y = P.y; r2.kind = 'pet'; r2.order = 'follow'; if (r2.sp) { r2.sp.n--; r2.sp = null; } r2.target = null;
    const d0 = Math.hypot(r2.x - P.x, r2.y - P.y); for (let i = 0; i < 40; i++) S.update(.05);
    const out = { moved, npcStill, monCtl: m.ctrl, npcCtl: n.ctrl, npcTick: !!S.CONTROL[n.ctrl], tamed: [r2.actorId === id, r2.archetype, r2.ctrl], followed: Math.hypot(r2.x - P.x, r2.y - P.y) < d0 };
    S.ents.splice(S.ents.indexOf(r2), 1); r2.gone = true; return out; }""")
  check(r['moved'] and r['monCtl'] == 'AnimalAI', 'an idle boar wanders under its controller', r)
  check(r['npcStill'] and r['npcCtl'] == 'MerchantAI' and not r['npcTick'], 'merchants have no tick yet and stay at their posts', r)
  check(r['tamed'] == [True, 'pet', 'PetAI'] and r['followed'], 'a tamed creature keeps its id, becomes a pet and follows', r)

  # 3. the shared damage entry and death exactly once (player ← creature, creature ← creature, creature killed twice)
  r = J(pg, """() => { const S = __SF, P = S.P, bus = S.WS.bus; P.hp = 60;
    const near = S.ents.filter(e => e.kind === 'mon' && !e.gone && e.type === 'boar'); const a = near[0], v = near[1];
    const k0 = bus.counts().ActorKilled || 0, c0 = S.ents.filter(e => e.kind === 'corpse').length;
    S.damageActor(P, 5, 'phys', a); const pe = bus.recent(1)[0];
    const hp0 = v.hp; S.damageActor(v, 7, 'phys', a); const me = bus.recent(1)[0];
    S.setRng(() => 0); v.hp = 999; v.max = 999; const hp1 = v.hp; S.strikeOne(a, v); const struck = hp1 - v.hp; S.setRng(null);
    v.hp = 3; S.damageActor(v, 50, 'phys', P); S.damageActor(v, 50, 'phys', P); S.killMon(v, P);
    const corpses = S.ents.filter(e => e.kind === 'corpse'); const k1 = bus.counts().ActorKilled;
    return { playerHp: P.hp, pe: [pe.type, pe.actor, pe.source, pe.amount], monHit: [hp0 - 0, me.type, me.actor === v.actorId, me.source === a.actorId], struck,
      killed: k1 - k0, newCorpses: corpses.length - c0, corpseIsActor: corpses.some(c => c.actorId), removed: bus.recent(20).filter(e => e.type === 'ActorRemoved' && e.actor === v.actorId).length,
      reg: S.WS.reg.has(v.actorId) } }""")
  check(r['playerHp'] == 55 and r['pe'][0] == 'ActorDamaged' and r['pe'][1] == 'player:p1' and r['pe'][2].startswith('mon:boar:') and r['pe'][3] == 5, 'creature → player through damageActor, with ids', r)
  check(r['monHit'][1:] == ['ActorDamaged', True, True] and r['struck'] > 0, 'creature → creature: the shared resolver lands a blow', r)
  check(r['killed'] == 1 and r['newCorpses'] == 1 and not r['corpseIsActor'] and r['removed'] == 1 and not r['reg'], 'three killing blows: one death, one corpse, one removal', r)

  # 4. the event log stays bounded over a long run
  r = J(pg, """() => { const S = __SF, b = S.WS.bus, s0 = b.seq; const m = S.ents.find(e => e.kind === 'mon' && !e.gone && e.type === 'boar'); m.hp = m.max = 1e9;
    for (let i = 0; i < 6000; i++) { S.update(.05); if (i % 4 === 0) S.damageActor(m, 1, 'poison', null); }
    return { size: b.size, cap: b.cap, emitted: b.seq - s0, gt: Math.round(S.GT), oldest: b.recent()[0].seq, newest: b.recent(1)[0].seq } }""")
  check(r['emitted'] > 1500 and r['size'] == r['cap'] and r['newest'] - r['oldest'] == r['cap'] - 1, f"{r['gt']} s and {r['emitted']} events later the log holds the newest {r['size']}/{r['cap']}", r)
  check(not errs, 'no page errors', errs[:5])

  # 5. save → reload → continue: the same named ids, the counter continues, save v5
  r1 = J(pg, """() => { const S = __SF; const named = S.ents.filter(e => e.kind === 'npc' || e.kind === 'ally').map(e => e.actorId).sort();
    const nums = S.ents.filter(e => e.kind === 'mon').map(e => +e.actorId.split(':').pop()); S.save(); const sv = JSON.parse(localStorage.getItem('shardfall.save.v1'));
    return { named, maxNum: Math.max(...nums), v: sv.v, sim: sv.sim } }""")
  pg.reload(); pg.wait_for_timeout(400); pg.click('[data-c=cont]'); pg.wait_for_timeout(300)
  r2 = J(pg, """() => { const S = __SF; const named = S.ents.filter(e => e.kind === 'npc' || e.kind === 'ally').map(e => e.actorId).sort();
    const nums = S.ents.filter(e => e.kind === 'mon').map(e => +e.actorId.split(':').pop()); return { named, minNum: Math.min(...nums), player: S.P.actorId, seed: S.WS.seed } }""")
  check(r1['v'] == 5 and r1['sim'] and r1['sim']['seed'] == 1999 and r1['sim']['ids']['next'] > r1['maxNum'], 'save v5 carries the world seed and id counter', r1)
  check(r2['named'] == r1['named'] and r2['player'] == 'player:p1', f"{len(r2['named'])} townsfolk and Wren keep their ids across a reload", {'a': r1['named'][:5], 'b': r2['named'][:5]})
  check(r2['minNum'] > r1['maxNum'], 'creatures spawned after the reload never reuse an id', [r1['maxNum'], r2['minNum']])

  # 6. a v4 save (Anniabreen build) migrates to v5 and plays on
  r = J(pg, """() => { const S = __SF; const s = JSON.parse(localStorage.getItem('shardfall.save.v1')); s.v = 4; delete s.sim; const keep = JSON.stringify(s.char.pack);
    localStorage.setItem('shardfall.save.v1', JSON.stringify(s)); const m = S.migrateSave(JSON.parse(JSON.stringify(s)), null); return { v: m.v, sim: m.sim, packSame: JSON.stringify(m.char.pack) === keep } }""")
  pg.reload(); pg.wait_for_timeout(400); pg.click('[data-c=cont]'); pg.wait_for_timeout(300)
  r2 = J(pg, """() => { const S = __SF; for (let i = 0; i < 100; i++) S.update(.05); S.save(); const sv = JSON.parse(localStorage.getItem('shardfall.save.v1'));
    return { v: sv.v, seed: S.WS.seed, player: S.P.actorId, n: S.WS.reg.size } }""")
  check(r['v'] == 5 and r['sim'] is None and r['packSame'], 'v4 → v5 migration is additive', r)
  check(r2['v'] == 5 and r2['seed'] == 1999 and r2['player'] == 'player:p1' and r2['n'] > 100, 'a migrated character boots, plays and saves as v5', r2)
  check(not errs, 'no page errors after reloads', errs[:5]); ctx.close()

  # 7. seeded determinism: the same seed and the same inputs give the same world, step for step
  def run(seed):
    ctx, pg, errs = page(b); new_char(pg, seed)
    h = J(pg, """() => { const S = __SF; for (let i = 0; i < 2400; i++) S.update(.05);
      const st = S.ents.filter(e => !e.gone).map(e => [e.actorId || e.kind, +e.x.toFixed(5), +e.y.toFixed(5), Math.round(e.hp || 0), e.state || '']);
      return { st, counts: S.WS.bus.counts(), log: S.WS.bus.recent(40).map(e => e.type + ':' + (e.actor || '')), chests: [...S.CHESTS.keys()].sort((a, b) => a - b).join(','),
        dun: S.SPAWNS.filter(s => S.levelAt(Math.floor(s.x), Math.floor(s.y))).map(s => s.type).join(',') } }""")
    ctx.close(); return h, errs
  a, ea = run(42); b2, eb = run(42); c, ec = run(7)
  check(a == b2, f"seed 42 twice: {len(a['st'])} entities identical after 120 simulated seconds", {k: a[k] == b2[k] for k in a})
  check(a['st'] != c['st'], 'a different seed gives a different world')
  check(a['chests'] == c['chests'] and a['dun'] == c['dun'] and len(a['dun']) > 20, 'dungeon chests and dungeon spawn types no longer change from session to session')
  check(not (ea or eb or ec), 'no page errors in the seeded runs', (ea + eb + ec)[:5])

  # 8. the real animation loop runs the same code without errors (render, HUD, minimap)
  ctx, pg, errs = page(b, hold=False); new_char(pg); pg.wait_for_timeout(4000)
  r = J(pg, "() => ({ gt: __SF.GT, n: __SF.WS.reg.size, sz: __SF.WS.bus.size })")
  check(r['gt'] > 2 and r['n'] > 100 and not errs, 'the live loop runs with the new dispatch', {'r': r, 'errs': errs[:5]}); ctx.close()
  b.close()
print('ALL PASS' if not fails else f'{fails} FAILED'); sys.exit(1 if fails else 0)
