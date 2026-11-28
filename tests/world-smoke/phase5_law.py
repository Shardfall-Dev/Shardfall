# Living World phase 5, step 2 in the built game (Playwright + Chrome): criminality and murder (master spec §19).
# Notoriety on names and the target frame; arming on an innocent asks twice; a swing at an innocent is an unlawful aggression record
# and makes you grey for 120 s; witnesses remember, flee and call the guards; guards fight you inside their jurisdiction through the
# shared resolver and give up when you hide or the flag runs out; self-defence is lawful; theft is a crime; witnesses refuse to talk;
# an innocent killed by you reports a murder, once per death (v0.34–v0.38: per knock-down); five long-term counts make you red, guards attack a murderer
# on sight and townsfolk refuse him; counts and flags survive a reload; an NPC who kills you unlawfully can be reported from the
# ghost window; fighting creatures is never a crime.
# usage: python3 tests/world-smoke/phase5_law.py Shardfall_v0.34.html [/path/to/chrome]   (also run by world-smoke/run.py)
import sys, json, os
from playwright.sync_api import sync_playwright
f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.34.html')
chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
HOLD = "window.__rafHold = true; { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => window.__rafHold ? (window.__rafCb = cb, 0) : raf(cb); }"
SEED = "S => { let a = %d >>> 0; S.setRng(() => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }); }"
fails = 0
def check(ok, msg, got=None):
  global fails
  print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else '  got: ' + json.dumps(got)[:1200])); fails += 0 if ok else 1
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
  L: () => S.LIFE.npcs, by: n => S.LIFE.npcs.find(e => e.name.startsWith(n)), guards: town => S.LIFE.npcs.filter(e => e.life.prof === 'guard' && e.life.town === town),
  god: false,   /* keep you alive through guard fights (out-of-combat regeneration clamps a raised hp back to the maximum) */
  run(sec, each) { const n = Math.round(sec / .05); for (let i = 0; i < n; i++) { if (this.god && !S.P.ghost) S.P.hp = Math.max(S.P.hp, 400); S.update(.05); if (each && i % 4 === 0 && each(i * .05)) return i * .05; } return sec; },
  calm() { for (const m of S.ents) if (m.kind === 'mon') m.pacified = 1e12; },
  put(e, p) { e.x = p.x; e.y = p.y; e._px = e.x; e._py = e.y; e.nav = null; },
  /* a standing spot near (x, y), from r0 outwards */
  spot(x, y, r0, ex) { for (let r = r0 || 0; r < r0 + 12; r += .5) for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (S.canStand({ kind: 'npc' }, px, py) && S.canStand({ kind: 'npc' }, px + .9, py) && S.los({ x, y }, { x: px, y: py }) && !(ex || []).some(o => Math.hypot(o.x - px, o.y - py) < .8)) return { x: px, y: py }; } return null; },
  /* everyone else of that town's guards sent far away; the chosen guard d m from the victim; you beside the victim */
  stage(town, victim, d) { const G = S.lifeTownGeo(town).center, gs = this.guards(town), g = gs[0], c = this.spot(G.x, G.y, 0); this.put(victim, c);
    for (const o of S.LIFE.npcs) if (o !== victim && o !== g && Math.hypot(o.x - c.x, o.y - c.y) < 30) this.put(o, { x: c.x + 400, y: c.y + 400 });
    const gp = this.spot(c.x, c.y, d, [c]); this.put(g, gp); g.foe = null; const pp = this.spot(c.x, c.y, .9, [c, gp]); this.put(S.P, pp); S.P.sel = victim; return { g, c }; },
  swing(t) { const P = S.P; P.sw.ready = true; P.sw.next = 0; return S.swingAt(P, t); },
  ev(type, since) { return S.WS.bus.recent ? S.WS.bus.recent().filter(r => r.type === type && r.seq > (since || 0)) : []; },
  seq() { const r = S.WS.bus.recent(); return r.length ? r[r.length - 1].seq : 0; },
  logHas(s) { return S.LOG.some(l => l.t.includes(s)); } }; }"""

with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
  ctx, pg, errs = page(b); new_char(pg, seed=3); J(pg, HELP)
  bus = J(pg, "() => Object.keys(__SF.WS.bus)")
  if 'recent' not in bus: print('note: bus keys', bus)

  # 1. everyone starts innocent: blue names; the camp fence stays red; creatures have no notoriety
  r = J(pg, """() => { const S = __SF; const L = S.LIFE.npcs, mags = S.ents.find(e => e.role === 'outlaw'), rat = S.ents.find(e => e.kind === 'mon');
    S.refreshHud(); return { P: S.notoOf(S.P), all: L.every(e => S.notoOf(e) === 'innocent'), col: [S.notoColor(S.P), S.notoColor(L[0])], mags: mags && S.notoOf(mags), rat: rat ? S.notoOf(rat) : null, pname: document.querySelector('#pname').textContent }; }""")
  check(r['P'] == 'innocent' and r['all'] and r['col'] == ['#5aa8ff', '#5aa8ff'] and r['mags'] == 'murderer' and r['rat'] is None and r['pname'] == 'Tess', 'you and every townsperson start innocent (blue); the outlaw fence is red; creatures have no notoriety', r)

  # 2. arming on an innocent asks twice; aim assist never picks a person
  r = J(pg, """() => { const S = __SF, T = __T; T.calm(); const e = T.by('Old Tomas'); T.stage('vespar', e, 40); S.P.armed = false;
    S.toggleArm(); const first = S.P.armed, warned = T.logHas('is a crime'); S.toggleArm(); const second = S.P.armed; S.P.armed = false;
    S.P.sel = null; for (const m of S.ents.slice()) if (m.kind === 'mon' && S.dist(m, S.P) < 20) S.rmEnt(m); S.toggleArm(); const auto = [S.P.armed, S.P.sel && S.P.sel.name];
    return { first, warned, second, auto, crim: S.notoOf(S.P) }; }""")
  check(not r['first'] and r['warned'] and r['second'] and r['crim'] == 'innocent', 'Attack on an innocent warns first and arms only on the second press; arming alone is no crime', r)
  check(r['auto'] == [False, None], 'with nothing selected, Attack never picks a townsperson', r)

  # 3. a swing at an innocent: unlawful aggression record, grey for 120 s, the victim flees and remembers, witnesses, a guard comes
  r = J(pg, """() => { const S = __SF, T = __T; T.god = true; const e = T.by('Old Tomas'), { g } = T.stage('vespar', e, 9), w = T.by('Lise'); T.put(w, T.spot(e.x, e.y, 4, [e, g, S.P])); const s0 = T.seq();
    const swung = T.swing(e); const ag = T.ev('AggressionRecorded', s0), cr = T.ev('CrimeCommitted', s0), wit = T.ev('CrimeWitnessed', s0); S.refreshHud();
    const out = { swung, ag: ag.map(a => [a.actor, a.target, a.detail.lawful, a.detail.region]), cr: cr.map(c => c.crime), noto: S.notoOf(S.P), left: Math.round(S.LAW.flagLeft('player:p1', S.GT)),
      pname: [document.querySelector('#pname').textContent, document.querySelector('#pname').style.color], fear: e.life.needs.safety, mem: e.life.mem.knows('saw a crime by', 'player:p1'), wmem: w.life.mem.knows('saw a crime by', 'player:p1'),
      wit: wit.map(x => x.actor), gfoe0: g.foe === S.P, logged: T.logHas('You attack Old Tomas, an innocent') };
    let hitAt = null; T.run(12, t => { const d = T.ev('ActorDamaged', s0).find(x => x.actor === 'player:p1' && x.source === g.actorId); if (d && hitAt === null) hitAt = t; return hitAt !== null; });
    out.gfoe = g.foe === S.P; out.hitAt = hitAt; out.gag = T.ev('AggressionRecorded', s0).filter(a => a.actor === g.actorId).map(a => a.detail.lawful); out.cs = T.ev('CombatStarted', s0).filter(c => c.actor === g.actorId && c.target === 'player:p1').length; return out; }""")
  check(r['swung'] and r['ag'][:1] == [['player:p1', 'npc:old-tomas', False, 'vespar']] and r['cr'] == ['assault'] and r['logged'], 'a swing at an innocent is an unlawful aggression record (region vespar) and a crime', r)
  check(r['noto'] == 'criminal' and r['left'] == 120 and 'criminal 120 s' in r['pname'][0] and r['pname'][1] in ('rgb(184, 184, 184)',), 'you are grey for 120 s, shown on your name with the time left', r)
  check(r['fear'] == 1 and r['mem'] and r['wmem'] and 'npc:lise-weaver' in r['wit'] and 'npc:old-tomas' in r['wit'], 'the victim flees and remembers; a bystander in sight witnesses it (CrimeWitnessed)', r)
  check(r['gfoe0'] or r['gfoe'], 'a guard in his jurisdiction comes for you (CombatStarted against you)', r)
  check(r['hitAt'] is not None and r['gag'] and all(r['gag']), f"the guard's blows land on you through the shared resolver after {r['hitAt']} s; his aggression is lawful", r)

  # 4. hiding breaks the chase; when the flag runs out you are innocent again and guards leave you alone
  r = J(pg, """() => { const S = __SF, T = __T; const g = T.guards('vespar')[0]; const s0 = T.seq(); S.P.hidden = true; S.P.stepBudget = 1e9; T.run(1); const gave = [g.foe === S.P, T.ev('CombatEnded', s0).filter(c => c.actor === g.actorId).map(c => c.detail.outcome)];
    S.P.hidden = false; T.run(125); const noto = S.notoOf(S.P), ch = T.ev('NotorietyChanged', s0).map(c => c.detail.from + '>' + c.detail.to);
    T.put(g, T.spot(S.P.x, S.P.y, 3, [S.P])); g.foe = null; T.run(3); return { gave, noto, ch, pardon: T.logHas('no longer a criminal'), after: g.foe === S.P, target: S.lawGuardTarget(g, S.P) }; }""")
  check(not r['gave'][0] and r['gave'][1][:1] == ['lost sight'], 'when you hide, the guard loses you and goes back to the patrol', r)
  check(r['noto'] == 'innocent' and 'criminal>innocent' in r['ch'] and r['pardon'] and not r['after'] and not r['target'], 'after 120 s you are innocent again (NotorietyChanged, a log line) and a guard beside you leaves you alone', r)

  # 5. self-defence: someone who attacked you may be fought back lawfully, without the warning
  r = J(pg, """() => { const S = __SF, T = __T; const e = T.by('Corin'); T.stage('vespar', e, 40); S.LAW.aggress(e.actorId, 'player:p1', S.GT); S.P.armed = false; S.P.sel = e; S.toggleArm();
    const armed = S.P.armed; S.P.armed = false; const s0 = T.seq(); T.swing(e); const ag = T.ev('AggressionRecorded', s0); return { armed, noto: S.notoOf(S.P), ag: ag.map(a => [a.detail.lawful, a.detail.selfDefence]) }; }""")
  check(r['armed'] and r['noto'] == 'innocent' and r['ag'] == [[True, True]], 'hitting back at someone who attacked you is lawful self-defence: no warning, no flag', r)

  # 6. theft is a crime; witnesses and victims will not talk to you for a while
  r = J(pg, """() => { const S = __SF, T = __T; const e = T.by('Merrin'); T.stage('vespar', e, 40); S.lawLoad(null); const s0 = T.seq(); S.lawCrime(S.P, e, 'theft');
    const out = { noto: S.notoOf(S.P), cr: T.ev('CrimeCommitted', s0).map(c => c.crime), refuse: S.lawRefuses(e), said: e.say && e.say.t, shop: S.PANEL || null };
    S.talk(e); out.panel = S.PANEL || null; return out; }""")
  check(r['noto'] == 'criminal' and r['cr'] == ['theft'] and r['refuse'] and r['said'] and r['panel'] is None, f"caught stealing makes you a criminal; the victim refuses to trade (\"{r['said']}\")", r)

  # 7. murder: an innocent killed by you reports it, once; five long-term counts make you red
  r = J(pg, """() => { const S = __SF, T = __T; S.lawLoad(null); T.run(.1); const names = ['Old Tomas', 'Lise', 'Corin', 'Nell', 'Garrick']; const s0 = T.seq(); const res = [];
    for (const n of names) { const e = T.by(n); T.stage('vespar', e, 40); T.swing(e); S.damageActor(e, 9999, 'phys', S.P); S.damageActor(e, 9999, 'phys', S.P); res.push([!!e.gone, S.LAW.counts('player:p1', S.GT).long]); }
    const rep = T.ev('MurderReported', s0).map(m => [m.actor, m.target, m.detail.long]); S.refreshHud();
    return { res, rep, noto: S.notoOf(S.P), red: T.logHas('now known as a murderer'), first: T.logHas('Old Tomas reports you for murder'), pname: [document.querySelector('#pname').textContent, document.querySelector('#pname').style.color] }; }""")
  check(r['res'] == [[True, 1], [True, 2], [True, 3], [True, 4], [True, 5]] and len(r['rep']) == 5 and r['rep'][0][:2] == ['npc:old-tomas', 'player:p1'] and r['first'], 'each innocent you kill reports one murder (double killing blows on one death count once)', r)
  check(r['noto'] == 'murderer' and r['red'] and r['pname'][0] == 'Tess · murderer' and r['pname'][1] == 'rgb(255, 90, 72)', 'the fifth long-term count makes you red: a log line and a red name', r)

  # 8. a murderer: guards attack on sight once the criminal flag is long gone; townsfolk refuse to deal
  r = J(pg, """() => { const S = __SF, T = __T; T.run(130); const crim = S.LAW.flagged('player:p1', S.GT); const e = T.by('Adda'); const { g } = T.stage('vespar', e, 6); S.P.sel = null; const s0 = T.seq();
    T.run(3, () => g.foe === S.P); const cs = T.ev('CombatStarted', s0).filter(c => c.actor === g.actorId).map(c => c.detail.why); const refuse = S.lawRefuses(e);
    return { crim, noto: S.notoOf(S.P), foe: g.foe === S.P, cs, refuse }; }""")
  check(not r['crim'] and r['noto'] == 'murderer' and r['foe'] and r['cs'] == ['a murderer in town'] and r['refuse'], 'with no criminal flag left a murderer is still attacked on sight by guards and refused by townsfolk', r)

  # 9. counts, records and red survive a reload
  J(pg, "() => { __SF.P.hidden = true; for (const g of __T.guards('vespar')) g.foe = null; __SF.save(); }")
  pg.reload(); pg.wait_for_timeout(500); pg.click('[data-c=cont]'); pg.wait_for_timeout(300); J(pg, HELP)
  r = J(pg, """() => { const S = __SF; return { noto: S.notoOf(S.P), c: S.LAW.counts('player:p1', S.GT), stats: S.LAW.stats.murders }; }""")
  check(r['noto'] == 'murderer' and r['c'] == {'short': 5, 'long': 5} and r['stats'] == 5, 'murder counts and red survive save and reload', r)

  r = J(pg, "() => !!__SF.P.ghost"); check(r is False, 'you were kept alive through the guard fights above (test harness)', r)

  # 10. creatures: fighting and killing them is never a crime
  new_char(pg, seed=4); J(pg, HELP)
  r = J(pg, """() => { const S = __SF, T = __T; const s0 = T.seq(); const m = S.spawnMon('rat', 1.0, 0); m.pacified = 0; T.swing(m); S.damageActor(m, 999, 'phys', S.P);
    return { noto: S.notoOf(S.P), ag: T.ev('AggressionRecorded', s0).length, cr: T.ev('CrimeCommitted', s0).length, dead: !!m._killed }; }""")
  check(r['noto'] == 'innocent' and r['ag'] == 0 and r['cr'] == 0 and r['dead'], 'killing a creature records no aggression and no crime', r)

  # 11. killed unlawfully by an NPC: the ghost window offers a report, which counts once
  r = J(pg, """() => { const S = __SF, T = __T; const g = T.guards('vespar')[0], e = T.by('Old Tomas'); T.stage('vespar', e, 3); S.LAW.aggress(g.actorId, 'player:p1', S.GT); const s0 = T.seq();
    S.damageActor(S.P, 99999, 'phys', g); S.refreshHud(); const btn = document.querySelector('#ghost [data-a=report]'); const vis = !btn.hidden, txt = btn.textContent;
    btn.click(); S.refreshHud(); return { ghost: S.P.ghost, vis, txt, after: !document.querySelector('#ghost [data-a=report]').hidden, c: S.LAW.counts(g.actorId, S.GT), rep: T.ev('MurderReported', s0).map(m => [m.actor, m.target]), again: S.lawReport() }; }""")
  check(r['ghost'] and r['vis'] and r['txt'] == 'Report murder by Vespar watch' and not r['after'] and r['c']['long'] == 1 and r['rep'] == [['player:p1', 'npc:vespar-watch']] and r['again'] is False, 'an unlawful killer can be reported once from the ghost window', r)

  check(not errs, 'no page errors or console errors', errs[:5])
  b.close()
print('ALL PASS' if not fails else f'{fails} FAILED'); sys.exit(1 if fails else 0)
