# Living World phase 5, step 1 in the built game (Playwright + Chrome): NPCs as combatants.
# Every townsperson with a life gets a fighting profile; creatures target townsfolk outside protected ground through the shared
# resolver; inside protected ground nobody is targetable; guards leave their patrol to fight a creature attacking someone in their
# jurisdiction, and go back; a townsperson at 0 health is knocked down once (not killed) and gets up later; you cannot hurt
# townsfolk yet; health and knock-downs survive a reload; NPC gear never touches the player's uid counter; a seeded day of fights.
# usage: python3 tests/world-smoke/phase5.py Shardfall_v0.30.html [/path/to/chrome]   (also run by world-smoke/run.py)
import sys, json, os
from playwright.sync_api import sync_playwright
f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.30.html')
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
  pg.add_init_script(HOLD); pg.goto('file://' + f); pg.wait_for_timeout(400)
  return ctx, pg, errs
def new_char(pg, seed=None):
  pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(400)
  if seed is not None: pg.evaluate('(' + (SEED % seed) + ')(__SF)')
  pg.evaluate("o => __CC.quick(o)", {'name': 'Tess', 'template': 'advanced', 'stats': [45, 10, 25], 'skills': [['swordsmanship', 50], ['magery', 30], ['tactics', 20]]}); pg.wait_for_timeout(300)
J = lambda pg, js: pg.evaluate(js)
HELP = """() => { const S = __SF; window.__T = {
  L: () => S.LIFE.npcs, by: n => S.LIFE.npcs.find(e => e.name.startsWith(n)),
  run(sec, each) { const n = Math.round(sec / .05); for (let i = 0; i < n; i++) { S.update(.05); if (each && i % 10 === 0 && each(i * .05)) return i * .05; } return sec; },
  calm() { for (const m of S.ents) if (m.kind === 'mon') m.pacified = 1e12; },
  hideP() { S.P.hidden = true; S.P.stepBudget = 1e9; },
  clearNear(x, y, r) { for (const m of S.ents.slice()) if (m.kind === 'mon' && Math.hypot(m.x - x, m.y - y) < r) S.rmEnt(m); },
  /* a free spot just outside protected ground, within d of the town centre, with line of sight to it */
  edge(town, dmin, dmax) { const c = S.lifeTownGeo(town).center; for (let r = dmin; r <= dmax; r += 1) for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2, x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
      if (S.protAt(x, y) || !S.canStand({ kind: 'npc' }, x, y) || !S.canStand({ kind: 'mon' }, x + 1.2, y)) continue; let pr = 0; for (let j = 1; j < 9; j++) if (S.protAt(x + (c.x - x) * j / 40, y + (c.y - y) * j / 40)) { pr = 1; break; } if (pr) return { x, y }; } return null; },
  put(e, p) { e.x = p.x; e.y = p.y; e._px = e.x; e._py = e.y; e.nav = null; },
  hound(p, dx) { const P = S.P, ox = P.x, oy = P.y; P.x = p.x; P.y = p.y; const m = S.spawnMon('hound', dx || 1.2, 0); P.x = ox; P.y = oy; m.home = { x: m.x, y: m.y }; return m; } }; }"""

with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
  ctx, pg, errs = page(b); new_char(pg, seed=5); J(pg, HELP)

  # 0. a knock-down at simulation time 0 still counts (the time is kept apart from the flag)
  r = J(pg, """() => { const S = __SF, d = __T.by('Ysolde'), gt = S.GT; S.damageActor(d, 9999, 'phys', null); const a = [!!d.downed, d.hp]; S.update(.05); S.update(.05); return { gt, a, still: !!d.downed, up: S.npcUp(d) }; }""")
  check(r['a'] == [True, 0] and r['still'] and not r['up'], f"a townsperson knocked down at simulation time {r['gt']} stays down", r)

  # 1. profiles: everyone with a life can fight or be hurt; guards are armed and armoured; gear stays off the player's uid counter
  r = J(pg, """() => { const S = __SF, L = __T.L(); const g = L.filter(e => e.life.prof === 'guard'), t = S.LIFE.trader;
    const bad = L.filter(e => !e.name.startsWith('Ysolde') && (!S.npcCombatant(e) || !(e.hp > 0) || e.hp !== e.max || !e.sw)).map(e => e.name);   /* Ysolde was knocked down in check 0 */
    const gear = L.flatMap(e => Object.values(e.equip).filter(Boolean)); const P = S.P; const mine = [...P.pack.items, ...P.bank.items, ...Object.values(P.equip).filter(Boolean)];
    return { n: L.length, bad, guards: g.length, gw: [...new Set(g.map(e => e.equip.weapon && e.equip.weapon.id))], garmor: g.every(e => e.equip.chest && e.equip.chest.id === 'chain_tunic'), ghp: g[0].max, civhp: S.LIFE.npcs.find(e => e.life.prof === 'townsfolk').max,
      neg: gear.every(i => i.uid < 0), uniq: new Set(gear.map(i => i.uid)).size === gear.length, mineNeg: mine.some(i => i.uid < 0), trader: [t.equip.weapon.id, t.max],
      ids: L.every(e => e.actorId && e.actorId.startsWith('npc:')), stats: S.fighter(g[0]).atk }; }""")
  check(not r['bad'] and r['n'] >= 35, f"all {r['n']} townsfolk with a life have a fighting profile (all but the one knocked down at full health)", r)
  check(r['guards'] >= 8 and r['gw'] == ['glaive'] and r['garmor'] and r['ghp'] > r['civhp'] and r['stats'] == 90, f"{r['guards']} guards with halberds and chainmail (guard {r['ghp']} hp, townsperson {r['civhp']} hp, weapon skill {r['stats']})", r)
  check(r['neg'] and r['uniq'] and not r['mineNeg'] and r['ids'], 'NPC gear has its own negative uids, nothing in your pack, bank or equipment; actor ids unchanged', r)

  # 2. protected ground: inside a town nobody is a target; outside, a hostile creature picks a townsperson and hurts him through the shared resolver
  r = J(pg, """() => { const S = __SF, T = __T; T.hideP(); T.calm(); const e = T.by('Lise'), inside = { x: e.x, y: e.y };
    const prot = S.protAt(e.x, e.y); const m0 = T.hound(inside, 1.0); m0.pacified = 0; const inTown = S.ecoTargetable(m0, e); S.rmEnt(m0);
    const p = T.edge('vespar', 18, 60); if (!p) return { p: null }; T.clearNear(p.x, p.y, 30); T.put(e, p); e.life.thinkAt = S.GT + 1e9; e.life.goal = null;
    const m = T.hound(p, 1.3); const hits = [];
    const before = e.hp; let tgt = null; const un = S.WS.bus.on('ActorDamaged', d => { if (d.actor === e.actorId) hits.push(d.source); });
    T.run(8, () => { if (m.target === e) tgt = 1; return hits.length >= 2; }); un && un();
    return { prot, inTown, p, tgt, hits: [...new Set(hits)], mid: m.actorId, lost: before - e.hp, fled: e.life.needs.safety, helpSaid: !!(e.say && /Guard|Help|off me/.test(e.say.t)), mem: e.life.mem.recent(4).map(x => x.what) }; }""")
  check(r.get('prot') and r.get('inTown') is False, 'inside protected ground a townsperson is not a target for creatures', r)
  check(r.get('p') and r['tgt'] and r['hits'] == [r['mid']] and r['lost'] > 0, f"outside, a marsh hound targets the townsperson and its blows land through the shared damage entry ({r.get('lost')} damage)", r)
  check(r.get('fled', 0) >= .8 and 'attacked by' in r.get('mem', []), 'the hurt townsperson is frightened, remembers the attacker and calls for help', r)

  # 3. guards: a Vespar guard leaves the patrol to fight a creature attacking someone in the jurisdiction, kills it with the shared resolver, goes back
  r = J(pg, """() => { const S = __SF, T = __T; T.calm(); const vg = __T.L().filter(e => e.life.prof === 'guard' && e.life.town === 'vespar');
    const p = T.edge('vespar', 18, 60); T.clearNear(p.x, p.y, 30); const g = vg[0], v = T.by('Old Tomas'); T.put(v, p); v.life.thinkAt = S.GT + 1e9; v.life.goal = null;
    T.put(g, { x: p.x - 6 > 0 ? p.x : p.x, y: p.y }); for (let k = 0; k < 40; k++) { const a = k / 40 * Math.PI * 2, x = p.x + Math.cos(a) * 7, y = p.y + Math.sin(a) * 7; if (S.canStand(g, x, y) && S.los({ x, y }, p)) { T.put(g, { x, y }); break; } }
    for (const o of vg.slice(1)) o.life.thinkAt = S.GT + 1e9;
    const m = T.hound(p, 1.3); m.hp = m.max; const dmg = [], kills = [], started = [], ended = [];
    const u1 = S.WS.bus.on('ActorDamaged', d => { if (d.actor === m.actorId) dmg.push(d.source); }), u2 = S.WS.bus.on('ActorKilled', d => { if (d.actor === m.actorId) kills.push(d.killer); });
    const u3 = S.WS.bus.on('CombatStarted', d => { if (d.target === m.actorId) started.push(d.actor); }), u4 = S.WS.bus.on('CombatEnded', d => { if (d.actor === g.actorId) ended.push(d.detail && d.detail.outcome); });
    let foeAt = null; const t = T.run(60, s => { if (g.foe === m && foeAt === null) foeAt = s; return m.dead; });
    const after = T.run(4); [u1, u2, u3, u4].forEach(u => u && u());
    return { foeAt, t, dead: !!m.dead, dmgBy: [...new Set(dmg)], kills, gid: g.actorId, started, ended, foe: g.foe ? g.foe.name : null, doing: g.life.mind.why, gHp: [g.hp, g.max], vDown: !!v.downed, fights: S.NPCF.guardFights, gkills: S.NPCF.guardKills }; }""")
  check(r['foeAt'] is not None and r['foeAt'] < 3 and r['gid'] in r['started'], f"a guard {7} m away steps in within {r['foeAt']} s of a marsh hound attacking Old Tomas", r)
  check(r['dead'] and r['gid'] in r['dmgBy'] and r['kills'] == [r['gid']], f"the guard's halberd blows land through the shared resolver and he kills it ({r['t']} s); one ActorKilled", r)
  check(r['foe'] is None and 'won' in r['ended'] and 'patrol' in r['doing'], 'the guard reports the fight won and goes back to the patrol', r)

  # 4. knocked down once, not killed; creatures lose interest; up again after the down time; the player cannot hurt townsfolk
  r = J(pg, """() => { const S = __SF, T = __T; T.calm(); const e = T.by('Corin'), p = T.edge('vespar', 18, 60); T.clearNear(p.x, p.y, 30); T.put(e, p); e.life.thinkAt = S.GT + 1e9;
    const m = T.hound(p, 1.3); m.pacified = 0; m.target = e; m.state = 'chase'; const kills = [], downs = [];
    const u1 = S.WS.bus.on('ActorKilled', d => { if (d.actor === e.actorId) kills.push(1); }), u2 = S.WS.bus.on('CombatEnded', d => { if (d.actor === e.actorId) downs.push(d.detail && d.detail.outcome); });
    const hp0 = e.hp; S.damageActor(e, 5, 'phys', S.P); const playerHit = hp0 - e.hp;
    S.damageActor(e, 9999, 'phys', m); S.damageActor(e, 9999, 'phys', m); S.update(.05); S.update(.05);
    const st = { down: !!e.downed, hp: e.hp, mTarget: m.target === e, targetable: S.ecoTargetable(m, e), alive: !e.gone };
    T.run(S.NPC_DOWN_TIME - 5); const still = !!e.downed; T.run(7); [u1, u2].forEach(u => u && u());
    return { playerHit, st, kills: kills.length, downs, still, up: !e.downed, hp: [e.hp, e.max], downsN: S.NPCF.downs }; }""")
  check(r['playerHit'] == 0, 'you cannot hurt a townsperson yet (law and criminal flags come next)', r)
  check(r['st']['down'] and r['st']['hp'] == 0 and not r['st']['mTarget'] and r['st']['targetable'] is False and r['st']['alive'] and r['kills'] == 0 and r['downs'] == ['downed'], 'at 0 health a townsperson is knocked down exactly once (no death, no ActorKilled); the creature loses interest', r)
  check(r['still'] and r['up'] and round(r['hp'][1] / 3) <= r['hp'][0] < round(r['hp'][1] / 3) + 3, f"he stays down for the down time, then gets up with a third of his health ({round(r['hp'][0])}/{r['hp'][1]} two seconds later)", r)

  # 5. save and reload: hurt and knocked-down townsfolk stay that way, by actor id
  r = J(pg, """() => { const S = __SF, T = __T; const a = T.by('Lise'), c = T.by('Nell'); a.hp = 7; S.damageActor(c, 9999, 'phys', null); S.save(); return { a: a.actorId, c: c.actorId, down: !!c.downed }; }""")
  pg.reload(); pg.wait_for_timeout(500); pg.click('[data-c=cont]'); pg.wait_for_timeout(300); J(pg, HELP)
  r2 = J(pg, """() => { const S = __SF, T = __T; const a = T.by('Lise'), c = T.by('Nell'); const left = S.NPC_DOWN_TIME - (S.GT - c.downAt); return { a: [a.actorId, a.hp], c: [c.actorId, !!c.downed, c.hp], left }; }""")
  check(r2['a'] == [r['a'], 7] and r2['c'][0] == r['c'] and r2['c'][1] and r2['c'][2] == 0 and 0 < r2['left'] <= 60.1, 'a hurt townsperson keeps her health and a knocked-down one stays down for the time left, through a reload', [r, r2])

  # 6. a seeded game day with the ecosystem awake: fights happen, nobody stays down, no errors
  new_char(pg, seed=11); J(pg, HELP)
  r = J(pg, """() => { const S = __SF, T = __T; T.hideP(); S.WS.clock.setDayMinutes(S.GT, 24); const L = T.L(); let maxDown = 0, stuckDown = 0;
    T.run(24 * 60, () => { const now = S.GT; for (const e of L) if (e.downed && now - e.downAt > S.NPC_DOWN_TIME + 2) stuckDown++; maxDown = Math.max(maxDown, L.filter(e => e.downed).length); return false; });
    const nan = L.filter(e => !Number.isFinite(e.hp) || e.hp < 0 || e.hp > e.max).map(e => e.name);
    return { F: S.NPCF, maxDown, stuckDown, nan, inProt: L.filter(e => e.downed && S.protAt(e.x, e.y)).length, ferr: (S.FRAME_ERR || {}).n || 0 }; }""")
  check(r['stuckDown'] == 0 and not r['nan'], f"a full accelerated day: {r['F']['hitsTaken']} blows taken by townsfolk, {r['F']['downs']} knocked down, {r['F']['rises']} up again, {r['F']['guardFights']} guard fights ({r['F']['guardKills']} won); nobody stays down, health always valid", r)
  check(not errs, 'no page errors or console errors', errs[:5])
  b.close()
print('ALL PASS' if not fails else f'{fails} FAILED'); sys.exit(1 if fails else 0)
