# Living World phase 3 in the built game (Playwright + Chrome): the monster ecosystem.
# Species profiles and factions, regional populations, predator and prey, monster-against-monster fights, timid wildlife,
# perception (night, sleep, Hiding), graveyards rising at night, persistent camps that stay cleared and recover, packs and
# calls for help, pursuit limits, camp sorties, the spatial index, creature sound mapping, and a seeded multi-day run.
# usage: python3 tests/world-smoke/phase3.py Shardfall_v0.25.html [/path/to/chrome]   (also run by world-smoke/run.py)
# The animation loop is held; every step is driven through __SF.update(0.05). Scenarios clear the creatures around a spot,
# stop the spawners and place exactly the creatures they need; the player is hidden unless the scenario is about the player.
import sys, json, os, re
from playwright.sync_api import sync_playwright
f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.25.html')
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
# shared scenario helpers, installed on window.__T
HELP = """() => { const S = __SF; window.__T = {
  open(r) { for (const s of S.SPAWNS) if (s.eco && s.biome === 'plains' && S.levelAt(Math.floor(s.x), Math.floor(s.y)) === 0 && s.x > 700) {
      for (let k = 0; k < 30; k++) { const x = Math.floor(s.x) + (k % 6) * 4 - 10, y = Math.floor(s.y) + Math.floor(k / 6) * 4 - 10; let ok = true;
        for (let dy = -r; dy <= r && ok; dy += 1) for (let dx = -r; dx <= r && ok; dx += 1) if (!S.canStand({ kind: 'mon' }, x + dx + .5, y + dy + .5) || S.protAt(x + dx, y + dy)) ok = false;
        if (ok) return [x + .5, y + .5]; } } return null; },
  clear() { for (const s of S.SPAWNS) s.next = 1e12; for (const e of S.ents.slice()) if (e.kind === 'mon' || e.kind === 'corpse') S.rmEnt(e); },
  put(type, x, y, o) { const d = S.MON[type]; const m = S.addEnt(Object.assign({ kind: 'mon', type, name: d.n, x, y, hp: d.hp, max: d.hp, state: 'idle', home: { x, y }, sect: 0, ward: 0, fedAt: -1e9 }, o || {})); return m; },
  pack(ms) { for (const m of ms) { m.leader = ms[0]; m.ownLeader = ms[0]; m.packId = 9000 + ms[0].id; } S.ECOS.packs.set(9000 + ms[0].id, ms.slice()); },
  hour(h) { S.WS.clock.setHour(S.GT, h); S.update(.05); for (let i = 0; i < 12; i++) S.update(.05); },
  run(sec, stop) { const n = Math.round(sec / .05); for (let i = 0; i < n; i++) { S.update(.05); if (stop && i % 10 === 0 && stop()) return i * .05; } return sec; },
  hide(x, y) { const P = S.P; P.x = x; P.y = y; P.hidden = true; P.stepBudget = 1e9; P.speed = 0; },
  ev(type, since) { return S.WS.bus.recent(256).filter(e => e.type === type && e.seq > (since || 0)); },
  seq() { const r = S.WS.bus.recent(1); return r.length ? r[0].seq : 0; } }; }"""

with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
  ctx, pg, errs = page(b); new_char(pg, seed=5); J(pg, HELP)   # seeded: every scenario below plays out the same way each run

  # 1. species profiles, factions and sound mapping are data
  r = J(pg, """() => { const S = __SF, need = ['f', 'hab', 'hours', 'temper', 'agg', 'cour', 'int', 'nv', 'hear', 'terr', 'social', 'grp', 'resp', 'art'];
    const missing = Object.keys(S.MON).filter(k => !S.ECO[k] || need.some(f => S.ECO[k][f] === undefined));
    const badSnd = Object.keys(S.MON).filter(k => { const c = S.CRE[k]; return c && !['alert', 'attack', 'death'].some(e => window.SFXA.has(c + '.' + e)); });
    const silent = Object.keys(S.MON).filter(k => !S.CRE[k] && !S.ECO[k].sndNote && S.ECO[k].snd !== null);
    const F = S.ECO_FACTIONS; return { n: Object.keys(S.MON).length, missing, badSnd, silent, standIn: ['dire_wolf', 'bear', 'giant_spider'].map(k => [k, S.CRE[k], !!S.ECO[k].sndNote]),
      fac: [F.rel('guards', 'citizens'), F.rel('guards', 'criminals'), F.rel('orcs', 'goblins'), F.rel('undead', 'wildlife'), F.rel('predators', 'wildlife'), F.rel('orcs', 'adventurers')],
      factionOf: [S.factionOf(S.P), S.factionOf(S.allyOf()), S.factionOf(S.ents.find(e => e.role === 'guard')), S.factionOf(S.ents.find(e => e.role === 'banker')), S.factionOf(S.ents.find(e => e.type === 'skeleton'))] }; }""")
  check(not r['missing'], f"all {r['n']} creature types have a full species profile (faction, habitat, hours, temperament, senses, territory, social, respawn, art)", r)
  check(not r['badSnd'] and not r['silent'] and all(x[1] and x[2] for x in r['standIn']), 'every sound mapping points at real takes; stand-ins and silent species are documented in the profile', r)
  check(r['fac'] == ['allied', 'hostile', 'friendly', 'hostile', 'neutral', 'hostile'] and r['factionOf'] == ['adventurers', 'adventurers', 'guards', 'merchants', 'undead'], 'faction table and faction of each actor kind', r)

  # 2. regional populations at boot: habitats, caps, valid ground, the new wildlife
  r = J(pg, """() => { const S = __SF, rc = S.ecoRegionCounts(), kinds = {}; for (const k in rc) kinds[rc[k].kind] = (kinds[rc[k].kind] || 0) + 1;
    const mons = S.ents.filter(e => e.kind === 'mon'), by = {}; for (const m of mons) by[m.type] = (by[m.type] || 0) + 1;
    const over = S.SPAWNS.filter(s => s.n > Math.max(s.max, s.nightMax || 0)).length, bad = mons.filter(m => !S.canStand(m, m.x, m.y) || S.protAt(m.x, m.y)).map(m => [m.type, m.x, m.y]);
    const starter = mons.filter(m => m.x < 600 && m.y < 600 && ['dire_wolf', 'bear', 'troll', 'orc'].includes(m.type)).length;
    return { kinds, by, total: mons.length, over, bad: bad.slice(0, 5), nbad: bad.length, starter, regs: Object.keys(rc).length }; }""")
  check(all(r['kinds'].get(k, 0) > 0 for k in ['forest', 'plains', 'mountain', 'swamp', 'camp', 'graveyard', 'dungeon level']), f"{r['regs']} population regions by habitat: forests, plains, mountains, swamps, camps, graveyards, dungeon levels", r['kinds'])
  check(all(r['by'].get(k, 0) > 5 for k in ['deer', 'hare', 'dire_wolf', 'bear']) and r['over'] == 0, f"{r['total']} creatures at boot, new wildlife among them (deer {r['by'].get('deer')}, hares {r['by'].get('hare')}, wolves {r['by'].get('dire_wolf')}, bears {r['by'].get('bear')}); no spawner over its cap", r)
  check(r['nbad'] == 0 and r['starter'] == 0, 'every creature stands on walkable, unprotected ground; no wolves, bears, trolls or orcs in the Saltmarsh starter slice', r)

  # 3. predator and prey: a wolf pack hunts deer; the herd bolts; the killer feeds; the player is not involved
  r = J(pg, """() => { const S = __SF, T = __T; T.clear(); const [x, y] = T.open(9); T.hide(x + 30, y); T.hour(18);
    const wolves = [0, 1, 2].map(i => T.put('dire_wolf', x - 7 + i, y + (i % 2))); T.pack(wolves);
    const deer = [0, 1, 2].map(i => T.put('deer', x + 3 + i, y - 1 + i)); T.pack(deer); const s0 = T.seq(), f0 = S.ECOS.flees;
    let fled = 0; const t = T.run(180, () => { fled = Math.max(fled, deer.filter(d => d.state === 'flee').length); return T.ev('ActorKilled', s0).some(e => e.species === 'deer'); });
    const k = T.ev('ActorKilled', s0).filter(e => e.species === 'deer'), killer = k.length && S.ents.find(e => e.actorId === k[0].killer);
    for (let i = 0; i < 20; i++) S.update(.05);
    return { t, kills: k.length, killer: killer && killer.type, fed: !!(killer && (killer.feed || S.GT - killer.fedAt < 30)), fled, flees: S.ECOS.flees - f0, wolfDead: wolves.filter(w => w.dead).length,
      started: T.ev('CombatStarted', s0).filter(e => /dire_wolf/.test(e.actor) && /deer/.test(e.target)).length, playerHit: T.ev('ActorDamaged', s0).filter(e => e.actor === 'player:p1').length }; }""")
  check(r['kills'] >= 1 and r['killer'] == 'dire_wolf' and r['started'] >= 1, f"a wolf pack hunts the deer and kills one in {r['t']:.1f} s, with no player involved", r)
  check(r['fled'] >= 2 and r['flees'] >= 2 and r['fed'] and r['wolfDead'] == 0 and r['playerHit'] == 0, 'the herd bolts together; the killer stays to feed; the deer never fight back', r)

  # 4. hostile factions fight each other: orcs and the risen dead
  r = J(pg, """() => { const S = __SF, T = __T; T.clear(); const [x, y] = T.open(9); T.hide(x + 30, y); T.hour(0);
    const orcs = [T.put('orc', x - 4, y), T.put('orc', x - 4, y + 1.5)], sk = [T.put('skeleton', x + 4, y), T.put('skeleton', x + 4, y + 1.5)]; const s0 = T.seq();
    const t = T.run(150, () => T.ev('ActorKilled', s0).length >= 1); const k = T.ev('ActorKilled', s0);
    const sw = Math.max(...orcs.concat(sk).map(m => (m.mind && m.mind.switches) || 0));
    return { t, kills: k.map(e => [e.species, (e.killer || '').split(':')[1]]), crimes: (S.WS.bus.counts().CrimeCommitted || 0), sw, started: T.ev('CombatStarted', s0).length }; }""")
  check(len(r['kills']) >= 1 and all(a != b for a, b in r['kills']) and r['started'] >= 2, f"orcs and skeletons fight on their own: first death after {r['t']:.1f} s ({r['kills']})", r)
  check(r['crimes'] == 0 and r['sw'] <= 8, f"faction hostility is not a crime; decisions stay committed (at most {r['sw']} changes of mind per creature)", r)

  # 5. timid wildlife flees the player and comes back when it is gone
  r = J(pg, """() => { const S = __SF, T = __T, P = S.P; T.clear(); const [x, y] = T.open(9); T.hour(10); P.hidden = false; P.x = x; P.y = y;
    const d = T.put('deer', x + 5, y); const d0 = 5; P.speed = 3; const s0 = T.seq();
    const t = T.run(4, () => d.state === 'flee'); T.run(3); const far = Math.hypot(d.x - P.x, d.y - P.y);
    P.x = x - 80; P.y = y; P.speed = 0; const back = T.run(90, () => d.state === 'idle' && Math.hypot(d.x - d.home.x, d.y - d.home.y) < 3);
    return { t, far, back, state: d.state, hit: T.ev('ActorDamaged', s0).length, why: d.mind && d.mind.why }; }""")
  check(r['t'] < 2 and r['far'] > 9 and r['hit'] == 0, f"a deer bolts from the approaching player within {r['t']:.2f} s and runs to {r['far']:.1f} m; it never attacks", r)
  check(r['back'] < 90, f"with the danger gone it returns to its home ground ({r['back']:.0f} s)", r)

  # 6. perception: night shortens sight for creatures without night vision; wolves keep it; Hiding works; sleep dulls
  r = J(pg, """() => { const S = __SF, T = __T, P = S.P; const [x, y] = T.open(9); const out = {};
    const probe = (type, dd, h, hidden) => { T.clear(); T.hour(h); P.hidden = !!hidden; P.stepBudget = 1e9; P.x = x; P.y = y; P.speed = 0; const m = T.put(type, x + dd, y); m.thinkAt = 0; const eng = () => m.target === P && ['chase', 'tele', 'strike', 'rec'].includes(m.state); T.run(2.5, eng); const r = eng(); S.rmEnt(m); return r; };
    out.boarDay = probe('boar', 4, 12); out.boarNight = probe('boar', 4, 0); out.wolfNight = probe('dire_wolf', 7, 0); out.orcHidden = probe('orc', 3, 12, true); out.orcSeen = probe('orc', 3, 12);
    const h = T.put('hare', x + 50, y); T.hour(2); const sleep = S.ecoActivity(h); const rs = window.SIM.senseRange(S.ecoSenseOf(h), S.ecoSenseCtx(h)).sight; T.hour(10); const rd = window.SIM.senseRange(S.ecoSenseOf(h), S.ecoSenseCtx(h)).sight;
    Object.assign(out, { sleep, rs: +rs.toFixed(2), rd: +rd.toFixed(2) }); P.hidden = true; return out; }""")
  check(r['boarDay'] and not r['boarNight'] and r['wolfNight'], 'a boar notices you at 4 m by day but not at midnight; a wolf still sees you at 7 m in the dark', r)
  check(not r['orcHidden'] and r['orcSeen'], 'a hidden player is not detected by an orc 3 m away; an unhidden one is', r)
  check(r['sleep'] == 'sleep' and r['rs'] < r['rd'] * .5, f"a hare asleep at 02:00 sees {r['rs']} m against {r['rd']} m by day", r)

  # 7. graveyards rise at night and the extra dead sink back at dawn, out of sight
  r = J(pg, """() => { const S = __SF, T = __T, P = S.P; T.clear(); const sp = S.SPAWNS.filter(s => s.nightMax); for (const s of sp) s.n = 0;
    P.x = 300; P.y = 300; P.hidden = true; const cnt = () => S.ents.filter(e => e.kind === 'mon' && e.sp && e.sp.nightMax).length, cap = k => sp.reduce((a, s) => a + s[k], 0);
    T.hour(12); for (let i = 0; i < 30; i++) { for (const s of sp) s.next = 0; S.spawnTick(); } const day = cnt();
    T.hour(23); for (let i = 0; i < 30; i++) { for (const s of sp) s.next = 0; S.spawnTick(); } const night = cnt();
    const act = S.ecoActivity(S.ents.find(e => e.type === 'skeleton')); T.hour(9); const sunk0 = S.ECOS.sunk; for (const s of sp) s.next = 1e12; T.run(240, () => cnt() <= day);
    return { day, night, dayCap: cap('max'), nightCap: cap('nightMax'), after: cnt(), sunk: S.ECOS.sunk - sunk0, act, dayAct: S.ecoActivity(S.ents.find(e => e.type === 'skeleton') || { type: 'skeleton' }) }; }""")
  check(0 < r['day'] <= r['dayCap'] and r['night'] > r['dayCap'] and r['night'] <= r['nightCap'], f"graveyards hold {r['day']} dead by day and rise to {r['night']} at night (cap {r['nightCap']})", r)
  check(r['after'] <= r['day'] and r['sunk'] > 0 and r['act'] == 'active' and r['dayAct'] == 'rest', f"at dawn {r['sunk']} of the risen sink back to their graves; skeletons are dormant by day, active at night", r)

  # 8. packs keep together and answer a call for help
  r = J(pg, """() => { const S = __SF, T = __T, P = S.P; T.clear(); const [x, y] = T.open(9); T.hour(20); P.hidden = false; P.x = x + 11; P.y = y;
    const w = [0, 1, 2].map(i => T.put('dire_wolf', x - 4 + i * 1.2, y - 2 + i)); T.pack(w); for (const m of w) m.pacified = S.GT + 3; T.run(3);
    S.damageActor(w[0], 2, 'phys', P); const t = T.run(3, () => w.every(m => m.target === P));
    return { t, targets: w.map(m => m.target === P), why: w[2].mind && w[2].mind.why }; }""")
  check(r['targets'] == [True, True, True], f"hurting one wolf brings the whole pack after you ({r['why']})", r)

  # 9. pursuit limits: a boar chases off its ground and gives up, then goes home
  r = J(pg, """() => { const S = __SF, T = __T, P = S.P; T.clear(); const [x, y] = T.open(9); T.hour(12); P.hidden = false; P.ghost = false; P.hp = 9999; P.x = x + 3; P.y = y;
    const m = T.put('boar', x, y); T.run(1.5, () => m.state === 'chase'); let gave = null, maxHome = 0;
    for (let i = 0; i < 1200 && gave === null; i++) { P.x += .17; S.update(.05); maxHome = Math.max(maxHome, Math.hypot(m.x - m.home.x, m.y - m.home.y)); if (m.state === 'return') gave = Math.hypot(m.x - m.home.x, m.y - m.home.y); }
    P.x = x + 200; const home = T.run(60, () => m.state === 'idle'); P.hp = S.SF.maxHp(P);
    return { gave, maxHome, leash: S.MON.boar.leash, home, homeD: Math.hypot(m.x - m.home.x, m.y - m.home.y) }; }""")
  check(r['gave'] is not None and r['maxHome'] <= r['leash'] + 1.5 and r['home'] < 60 and r['homeD'] < 2, f"a boar gives up {r['gave']:.1f} m from home (limit {r['leash']} m) and walks back" if r['gave'] else 'a boar gives up the chase', r)

  # 10. persistent camps: cleared stays cleared (through a reload), recovers gradually, never extinct
  r = J(pg, """() => { const S = __SF, T = __T, P = S.P; P.x = 300; P.y = 300; P.hidden = true; const c = S.ECOS.camps.get('kragmaw'); const sp = S.SPAWNS.filter(s => s.camp === c);
    for (let i = 0; i < 20 && c.alive < c.cap; i++) { for (const s of sp) s.next = 0; S.spawnTick(); }
    const full = c.alive, s0 = T.seq(); for (const m of S.ents.filter(e => e.kind === 'mon' && e.sp && e.sp.camp === c)) S.killMon(m, P);
    const ev = T.ev('CampCleared', s0); for (let i = 0; i < 30; i++) { for (const s of sp) s.next = 0; S.spawnTick(); S.update(.05); }
    return { full, cap: c.cap, cleared: c.cleared, ev: ev.length, camp: ev[0] && ev[0].camp, after: S.ents.filter(e => e.kind === 'mon' && e.sp && e.sp.camp === c).length, saved: S.save() }; }""")
  check(r['full'] == r['cap'] and r['cleared'] and r['ev'] == 1 and r['camp'] == 'kragmaw', f"Kragmaw Camp full ({r['full']}/{r['cap']}), then cleared: one CampCleared event", r)
  check(r['after'] == 0, 'a cleared camp does not respawn, even when its spawners are forced', r)
  pg.reload(); pg.wait_for_timeout(400); pg.click('[data-c=cont]'); pg.wait_for_timeout(400); J(pg, HELP)
  r = J(pg, """() => { const S = __SF, T = __T, c = S.ECOS.camps.get('kragmaw'), sp = S.SPAWNS.filter(s => s.camp === c);
    const boot = S.ents.filter(e => e.kind === 'mon' && e.sp && e.sp.camp === c).length; for (let i = 0; i < 20; i++) { for (const s of sp) s.next = 0; S.spawnTick(); S.update(.05); }
    const after = S.ents.filter(e => e.kind === 'mon' && e.sp && e.sp.camp === c).length; const oc = S.ECOS.camps.get('cutpurse'), osp = S.SPAWNS.filter(s => s.camp === oc); for (let i = 0; i < 20; i++) { for (const s of osp) s.next = 0; S.spawnTick(); } const other = oc.alive;   // since phase 6 the save brings back the creatures it had; the others refill at their spawners' pace (forced here)
    c.clearedAt = S.GT - c.recover - 1; c.nextAt = 0; const r0 = S.ECOS.replenished; const steps = [];
    for (let k = 0; k < 6; k++) { for (let i = 0; i < 5; i++) { for (const s of sp) s.next = 0; S.spawnTick(); } steps.push(c.alive); c.nextAt = S.GT; for (let i = 0; i < Math.ceil(c.trickle / .05); i++) S.update(.05); }
    return { boot, after, cleared0: true, other, steps, cap: c.cap, cleared: c.cleared, repl: S.ECOS.replenished - r0 }; }""")
  check(r['boot'] == 0 and r['after'] == 0 and r['other'] > 0, 'after a reload the cleared camp is still empty (other camps populate as usual)', r)
  check(r['steps'][0] <= 2 and r['steps'] == sorted(r['steps']) and r['steps'][-1] == r['cap'] and not r['cleared'] and r['repl'] >= 2, f"after its recovery time it fills back gradually {r['steps']} and is whole again", r)

  # 11. camp sorties: an orc patrol walks down its trail toward the road and back on the navigator
  r = J(pg, """() => { const S = __SF, T = __T, P = S.P; P.x = 300; P.y = 300; P.hidden = true; T.hour(12); const c = S.ECOS.camps.get('kragmaw'); for (const m of S.ents) if (m.kind === 'mon' && m.sp && m.sp.camp === c) { m.state = 'idle'; m.target = null; m.fedAt = S.GT; }   /* fed: they set out on patrol instead of hunting */
    c.sortieAt = 0; c.sortie = null; let endState = null, L = null, maxOut = 0, phases = new Set(), followers = 0; const s0 = S.ECOS.sorties;
    for (let i = 0; i < 9000; i++) { S.update(.05); if (!L && c.sortie) { L = c.sortie; followers = S.ents.filter(o => o.leader === L && o !== L).length; } if (L) { if (L.sortie) phases.add(L.sortie.phase); maxOut = Math.max(maxOut, Math.hypot(L.x - L.home.x, L.y - L.home.y)); if (L.gone) { endState = 'killed:' + L.state; break; } if (!L.sortie && phases.size) { endState = L.state + ':' + (L.chaseKind || '-'); break; } } }
    return { started: S.ECOS.sorties - s0, phases: [...phases], maxOut: +maxOut.toFixed(1), back: L && Math.hypot(L.x - L.home.x, L.y - L.home.y), followers, endState, graph: !!S.NAV.graph, diag: L && [L.state, L.pacified, L.hidden, !!L.feed, L.nav && L.nav.state, L.nav && L.nav.reason, L.sortie && L.sortie.phase, !!L.leader && L.leader !== L] }; }""")
  done = 'wait' in r['phases'] and 'back' in r['phases']; met = not done and r['endState'] and not r['endState'].startswith('idle')
  check(r['started'] >= 1 and r['maxOut'] > 15 and r['followers'] >= 1 and (done or met), f"an orc patrol of {r['followers'] + 1} leaves Kragmaw, goes {r['maxOut']} m out, " + ("looks around and heads home" if done else f"and breaks off to fight ({r['endState']})"), r)
  check(not r['graph'], 'creature trips never build the continent travel graph (short local paths only)', r)

  # 12. the spatial index matches the world and replaces the all-pairs scans
  r = J(pg, """() => { const S = __SF, G = S.ECOS.grid; S.update(.05); const live = S.ents.filter(e => !e.gone && e.kind !== 'corpse');
    let same = true; for (let k = 0; k < 30; k++) { const e = live[(k * 37) % live.length], r = 3 + (k % 5) * 6; const a = G.near(e.x, e.y, r).filter(o => !o.gone).length, b = live.filter(o => Math.hypot(o.x - e.x, o.y - e.y) <= r).length; if (a !== b) same = false; }
    return { size: G.size, live: live.length, same }; }""")
  check(r['same'] and abs(r['size'] - r['live']) <= 2, f"the spatial index holds {r['size']} of {r['live']} live actors and answers radius queries exactly", r)
  check(not errs, 'no page errors in the ecosystem scenarios', errs[:5])
  ctx.close()

  # 13. a seeded multi-day run: no population explosion or extinction, bounded log, no stale references, steady cost
  ctx, pg, errs = page(b); new_char(pg, seed=11); J(pg, HELP)
  r = J(pg, """() => { const S = __SF, P = S.P; S.WS.clock.setDayMinutes(S.GT, 6); P.hidden = true; P.stepBudget = 1e9; P.hp = 1e6;
    const species = t => S.ents.filter(e => e.kind === 'mon' && e.type === t).length, sp0 = {}; for (const t of ['deer', 'hare', 'dire_wolf', 'bear', 'orc', 'skeleton', 'boar']) sp0[t] = species(t);
    const n0 = S.ents.length, heap0 = performance.memory ? performance.memory.usedJSHeapSize : 0; let maxN = 0, maxOver = 0, t0 = performance.now(), steps = 0, minSp = {};
    for (let i = 0; i < 21600; i++) { S.update(.05); steps++; if (i % 600 === 0) { P.hidden = true; P.hp = 1e6; maxN = Math.max(maxN, S.ents.length); for (const s of S.SPAWNS) maxOver = Math.max(maxOver, s.n - Math.max(s.max, s.nightMax || 0)); for (const t in sp0) minSp[t] = Math.min(minSp[t] ?? 1e9, species(t)); } }
    const ms = (performance.now() - t0) / steps, sp1 = {}; for (const t in sp0) sp1[t] = species(t);
    const stale = S.ents.filter(e => e.kind === 'mon' && ((e.target && (e.target.gone || e.target.dead)) || (e.threat && e.threat.gone && e.state === 'flee'))).length;
    const ids = S.ents.filter(e => !e.gone && e.actorId), uniq = new Set(ids.map(e => e.actorId)).size;
    return { days: S.WS.clock.dayAt(S.GT) - 1, n0, n1: S.ents.length, maxN, maxOver, sp0, sp1, minSp, ms: +ms.toFixed(3), log: S.WS.bus.size, stale, uniq, ids: ids.length, reg: S.WS.reg.size,
      heap: heap0 ? Math.round((performance.memory.usedJSHeapSize - heap0) / 1048576) : null, kills: S.ECOS.kills, hunts: S.ECOS.hunts, mvm: S.ECOS.mvm, q: S.NAV.jobs.length, counts: S.WS.bus.counts() }; }""")
  check(r['days'] >= 3 and r['maxOver'] <= 0 and r['maxN'] < r['n0'] * 1.25, f"{r['days']} in-game days (seeded, accelerated): {r['n0']} → {r['n1']} actors, peak {r['maxN']}, no spawner ever over its cap", r)
  check(all(r['sp1'][t] > 0 for t in r['sp1']), f"no species dies out: {r['sp1']} (lowest {r['minSp']})", r)
  check(r['log'] <= 256 and r['stale'] == 0 and r['uniq'] == r['ids'] == r['reg'] and r['q'] < 40, f"event log bounded ({r['log']}), no stale targets, every live actor id unique and registered", r)
  check(r['kills'] > 0 and r['hunts'] > 0 and r['mvm'] > 0, f"the ecosystem was busy: {r['hunts']} hunts, {r['mvm']} creature fights, {r['kills']} deaths", r)
  check(r['ms'] < 3 and (r['heap'] is None or r['heap'] < 60), f"{r['ms']} ms per simulation step on average over the run; heap growth {r['heap']} MB", r)
  check(not errs, 'no page errors in the long run', errs[:5])
  ctx.close(); b.close()
print('ALL PASS' if not fails else f'{fails} FAILED'); sys.exit(1 if fails else 0)
