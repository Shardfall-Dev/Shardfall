# Living World phase 5, step 4 in the built game (Playwright + Chrome): NPC death, bodies and looting, and the first NPC criminals
# (master spec §19, §20). Townsfolk, shopkeepers and guards die once at 0 health (ActorKilled, a murder report when unlawful), leaving
# a body with what they really wore and carried as real items, under the player's loot rules (looting an innocent inside the 90 s
# window is a crime, Take and Take all alike); the same person comes back home after the configured time, unseen if possible; the
# 'none' policy keeps residents dead but never a service; the dead and their bodies survive a reload exactly (no duplicate, the uid
# counter stays ahead); older saves load. The outlaws of the Ashfen camp: a cutthroat who preys on weaker people alone in the wild
# (never near guards; you included), a cutpurse who robs bodies; both become grey or red by the ordinary law, guards fight them in
# their jurisdiction, adventurers fight back, attacking them is lawful once they are grey; ?crim=off; a long accelerated run.
# usage: python3 tests/world-smoke/phase5_death.py Shardfall_v0.39.html [/path/to/chrome]   (also run by world-smoke/run.py)
import sys, json, os
from playwright.sync_api import sync_playwright
f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.39.html')
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


EXTRA = """() => { const S = __SF, T = __T;
  T.N = n => S.npcdById(S.LIFE.npcs.find(e => e.name.startsWith(n)).actorId);
  T.freeze = e => { if (e.life) { e.life.thinkAt = 1e12; e.life.goal = null; } e.nav = null; };
  T.body = id => S.ents.filter(c => c.kind === 'corpse' && !c.gone && (c.npcBody === id || c.advBody === id));
  T.far = () => { const c = S.lifeTownGeo('moonglen').center; T.put(S.P, T.wild(c.x + 90, c.y + 40)); };
  /* a quiet patch of wild near the camp: no guard for miles, nobody watching */
  T.spot = () => { const c = S.advGeo('camp').center; return T.wild(c.x + 34, c.y + 18); };
  T.vesk = () => T.A('Vesk'); T.mott = () => T.A('Mott'); }"""

with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
  ctx, pg, errs = page(b); new_char(pg); J(pg, HELP); J(pg, EXTRA)

  # 1. the death transaction: once, a body with real items and a purse, a murder report, out of the world
  r = J(pg, """() => { const S = __SF, T = __T, e = T.N('Lise'), id = e.actorId; T.calm(); T.put(S.P, { x: e.x + 1, y: e.y }); S.P.sel = e;
    const s0 = T.seq(), hp0 = e.max; S.damageActor(e, 9999, 'phys', S.P); S.damageActor(e, 9999, 'phys', S.P); S.update(.05);
    const bodies = T.body(id), c = bodies[0], items = c ? c.cont.items.map(it => [it.id, it.qty, it.uid]) : [];
    return { bodies: bodies.length, items, uniq: new Set(items.map(i => i[2])).size === items.length, real: items.every(i => i[2] > 0), killed: T.ev('ActorKilled', s0, x => x.actor === id).length,
      reports: T.ev('MurderReported', s0, x => x.actor === id).length, counts: S.LAW.counts(S.P.actorId, S.GT), gone: e.gone && !S.ents.includes(e) && !S.WS.reg.get(id), dead: S.NPCD.dead.includes(e),
      sel: S.P.sel === e, owner: c && c.cont.owner === id, expires: c && Math.round(c.expires - S.GT), name: c && c.name } }""")
  check(r['bodies'] == 1 and r['killed'] == 1 and r['gone'] and r['dead'] and not r['sel'], 'a townsperson at 0 health dies exactly once (two killing blows, one ActorKilled, one body) and leaves the world', r)
  check(r['real'] and r['uniq'] and any(i[0] == 'gold' and i[1] > 0 for i in r['items']) and any(i[0] == 'shirt' for i in r['items']) and r['owner'] and 700 <= r['expires'] <= 720, f"the body holds what she wore and her purse as real items, owned by her, decaying in 12 min: {r['items']}", r)
  check(r['reports'] == 1 and r['counts']['long'] == 1, 'killing an innocent is reported as one murder', r)

  # 2. killed by a creature: no murder; looting the body inside 90 s is a crime (Take and Take all); afterwards it is open to all
  r = J(pg, """() => { const S = __SF, T = __T, e = T.N('Nell'), id = e.actorId, m = S.ents.find(o => o.kind === 'mon' && !o.gone && o.hp > 0 && o.type === 'dire_wolf') || S.ents.find(o => o.kind === 'mon' && !o.gone && o.hp > 0); const n0 = S.LAW.counts(S.P.actorId, S.GT).long, s0 = T.seq();
    S.LAW.clear(S.P.actorId); S.damageActor(e, 9999, 'phys', m); const c = T.body(id)[0]; T.put(S.P, { x: c.x + .5, y: c.y }); S.P.lootOpen = c;
    const noMurder = T.ev('MurderReported', s0, x => x.actor === id).length === 0; const it = c.cont.items.find(i => i.id === 'gold'); S.ACT.take({ u: it.uid });
    const crimes = T.ev('CrimeCommitted', s0, x => x.crime === 'looting' && x.victim === id).length, noto = S.notoOf(S.P), mine = SF.count(S.P.pack, 'gold');
    S.LAW.clear(S.P.actorId); const f = T.N('Garrick'), fid = f.actorId; S.damageActor(f, 9999, 'phys', m); const c2 = T.body(fid)[0]; T.put(S.P, { x: c2.x + .5, y: c2.y }); S.P.lootOpen = c2; const s1 = T.seq(); S.ACT.takeall();
    const crimes2 = T.ev('CrimeCommitted', s1, x => x.crime === 'looting' && x.victim === fid).length, empty = c2.cont.items.length;
    S.LAW.clear(S.P.actorId); const g = T.N('Old Tomas'), gid = g.actorId; S.damageActor(g, 9999, 'phys', m); const c3 = T.body(gid)[0]; c3.cont.diedAt -= 95; T.put(S.P, { x: c3.x + .5, y: c3.y }); S.P.lootOpen = c3; const s2 = T.seq(); S.ACT.takeall();
    const crimes3 = T.ev('CrimeCommitted', s2).length; S.P.lootOpen = null; S.LAW.clear(S.P.actorId);
    return { noMurder, crimes, noto, mine, crimes2, empty, crimes3, after: S.notoOf(S.P) } }""")
  check(r['noMurder'] and r['crimes'] == 1 and r['noto'] == 'criminal' and r['mine'] > 0, 'killed by a creature: no murder; taking her gold inside the loot-rights window is a crime (grey)', r)
  check(r['crimes2'] == 1 and r['empty'] == 0, "Take all on an innocent's fresh body is a crime too (it used to slip through)", r)
  check(r['crimes3'] == 0, 'after 90 s the body is open to all: no crime', r)

  # 3. back home after the configured time, the same person with a fresh outfit; not where you watch, unless it takes too long
  r = J(pg, """() => { const S = __SF, T = __T, e = T.N('Lise'), id = e.actorId, C = S.NPCD.cfg; T.far(); const s0 = T.seq();
    T.run(C.back - 20); const early = !e.gone; T.run(30, () => !e.gone);
    return { early, back: !e.gone && S.ents.includes(e) && S.WS.reg.get(id) === e, ev: T.ev('ActorReturned', s0, x => x.actor === id).length, hp: [e.hp, e.max], up: S.npcUp(e), weapon: Object.values(e.equip).filter(Boolean).every(it => it.uid < 0),
      home: Math.round(Math.hypot(e.x - e.home.x, e.y - e.home.y)), dead: S.NPCD.dead.map(x => x.name), name: e.name } }""")
  check(not r['early'] and r['back'] and r['ev'] == 1 and r['hp'][0] == r['hp'][1] and r['up'] and r['weapon'] and r['home'] < 6, 'ten minutes later she is back at home, the same person (same id), full health, a fresh outfit that is not loot', r)
  r = J(pg, """() => { const S = __SF, T = __T, e = T.N('Corin'), C = S.NPCD.cfg; S.damageActor(e, 9999, 'phys', null); T.put(S.P, { x: e.home.x + 2, y: e.home.y }); S.P.hp = 999;
    T.run(C.back + 5); const watched = e.gone; T.run(C.unseen + 5, () => !e.gone); return { watched, back: !e.gone } }""")
  check(r['watched'] and r['back'], 'while you stand at his door he waits, then comes back anyway when the extra time runs out', r)

  # 4. policy 'none': residents stay dead; services (a guard, a shopkeeper) still come back
  r = J(pg, """() => { const S = __SF, T = __T, C = S.NPCD.cfg, p0 = C.policy; C.policy = 'none'; T.far();
    const res = T.N('Mabry'), gd = S.LIFE.npcs.find(e => e.life.prof === 'guard' && e.life.town === 'mynoc' && !e.gone), sh = S.LIFE.npcs.find(e => e.life.prof === 'shop' && !e.gone);
    for (const e of [res, gd, sh]) S.damageActor(e, 9999, 'phys', null); const gw = gd.equip.weapon; const gb = T.body(gd.actorId)[0];
    T.run(C.back + C.unseen + 5); C.policy = p0; return { res: res.gone, gd: !gd.gone, sh: !sh.gone, glaive: gb && gb.cont.items.some(it => it.id === 'glaive' && it.uid > 0) } }""")
  check(r['res'] and r['gd'] and r['sh'], "policy 'none': the resident stays dead, the guard and the shopkeeper come back", r)
  check(r['glaive'], 'a dead guard leaves his real glaive on his body', r)

  # 5. save and reload: the dead stay dead for the time left, their bodies come back exactly once with the same items
  r = J(pg, """() => { const S = __SF, T = __T; const e = T.N('Kessa'), id = e.actorId; S.damageActor(e, 9999, 'phys', null); T.run(30); const c = T.body(id)[0];
    const items = c.cont.items.map(it => it.uid).sort((a, b) => a - b); S.save(); const sv = JSON.parse(localStorage.getItem('shardfall.save.v1'));
    return { id, items, left: Math.round(c.expires - S.GT), uid: sv.uid, npcd: !!(sv.life && sv.life.npcd), dead: sv.life.npcd.dead.map(d => d.id), mabry: T.N('Mabry').actorId } }""")
  cont(pg); J(pg, HELP); J(pg, EXTRA)
  r2 = J(pg, """o => { const S = __SF, T = __T, e = S.npcdById(o.id), bodies = T.body(o.id), c = bodies[0];
    return { gone: e.gone, dead: S.NPCD.dead.includes(e), left: S.NPCD.cfg.back - Math.round(S.GT - e.npcDead.at), bodies: bodies.length, items: c ? c.cont.items.map(it => it.uid).sort((a, b) => a - b) : [], bleft: c && Math.round(c.expires - S.GT),
      mabry: S.npcdById(o.mabry).gone, inEnts: S.ents.includes(e) } }""", r)
  check(r['npcd'] and r2['gone'] and r2['dead'] and not r2['inEnts'] and 560 <= r2['left'] <= 575 and r2['mabry'], f"after a reload the dead are still dead with their time left ({r2['left']} s), the 'none' resident too", [r, r2])
  check(r2['bodies'] == 1 and r2['items'] == r['items'] and abs(r2['bleft'] - r['left']) <= 2 and r['uid'] > max(r['items']), "the body comes back once with exactly the same items; the save's uid counter stays ahead of them", [r, r2])
  # an older save (v0.33–v0.38): no npcd block, a townsperson knocked down → loads standing
  J(pg, """() => { const S = __SF, T = __T, e = T.N('Bryn'); e.hp = 5; S.save(); const sv = JSON.parse(localStorage.getItem('shardfall.save.v1')); delete sv.life.npcd; sv.life.npcs[e.actorId].fight = { hp: 0, down: 30 };
    for (const c of sv.corpses || []) c.left = 0; localStorage.setItem('shardfall.save.v1', JSON.stringify(sv)); }""")
  cont(pg); J(pg, HELP); J(pg, EXTRA)
  r = J(pg, "() => { const S = __SF, T = __T, e = T.N('Bryn'), k = T.N('Kessa'); return { up: S.npcUp(e), hp: e.hp, kessa: !k.gone, dead: S.NPCD.dead.length } }")
  check(r['up'] and r['hp'] >= 1 and r['kessa'] and r['dead'] == 0, 'an older save loads: a knocked-down townsperson is up again, nobody is dead', r)
  check(not errs, 'no page errors after reloads', errs[:5]); ctx.close()

  # 6. the outlaws: two, at the Ashfen camp, on the adventurer controller, innocent until they act
  ctx, pg, errs = page(b); new_char(pg); J(pg, HELP); J(pg, EXTRA)
  r = J(pg, """() => { const S = __SF, L = S.ADV.list.filter(e => e.adv.crim), c = S.advGeo('camp').center;
    return { ids: L.map(e => e.actorId), crim: L.map(e => e.adv.crim), ctrl: L.every(e => e.ctrl === 'AdventurerAI' && S.WS.reg.get(e.actorId) === e), noto: L.map(e => S.notoOf(e)),
      home: L.every(e => Math.hypot(e.x - c.x, e.y - c.y) < 20), wild: S.lawRegion(c.x, c.y), weapons: L.map(e => e.equip.weapon && e.equip.weapon.id), all: S.ADV.list.length } }""")
  check(r['ids'] == ['npc:vesk-cutthroat', 'npc:mott-cutpurse'] and r['crim'] == ['murderer', 'thief'] and r['ctrl'] and r['all'] == 8, 'two outlaws with stable ids on the adventurer controller, beside the six adventurers', r)
  check(r['noto'] == ['innocent', 'innocent'] and r['home'] and r['wild'] == 'wild' and r['weapons'] == ['sword', 'dagger'], 'they live at the Ashfen camp (outside every jurisdiction) and are innocent until they act', r)

  # 7. the cutthroat preys on a weaker person alone in the wild: an unlawful attack, a murder, then he robs the body (a crime)
  r = J(pg, """() => { const S = __SF, T = __T, v = T.vesk(), p = T.spot(), m = T.N('Mabry'), mid = m.actorId; T.stage(v, p); T.freeze(m); T.put(m, { x: p.x + 4, y: p.y }); T.far(); v.adv.nextCrime = 0;
    const s0 = T.seq(); T.run(60, () => m.gone); const started = T.ev('CombatStarted', s0, x => x.actor === v.actorId && x.target === mid && x.detail && x.detail.why === 'preying').length;
    const killed = m.gone, counts = S.LAW.counts(v.actorId, S.GT), murder = T.ev('MurderReported', s0, x => x.actor === mid && x.target === v.actorId).length;
    T.run(20, () => T.ev('CorpseLooted', s0, x => x.actor === v.actorId).length > 0); const robbed = T.ev('CrimeCommitted', s0, x => x.actor === v.actorId && x.crime === 'looting' && x.victim === mid).length;
    const unlawful = T.ev('AggressionRecorded', s0, x => x.actor === v.actorId && x.target === mid && !x.detail.lawful).length;
    return { started, killed, counts, murder, robbed, unlawful, noto: S.notoOf(v), gold: SF.count(v.pack, 'gold') } }""")
  check(r['started'] == 1 and r['unlawful'] >= 1 and r['killed'], 'Vesk picks a lone townsperson in the wild and attacks: an unlawful aggression, and she dies', r)
  check(r['murder'] == 1 and r['counts']['long'] == 1 and r['robbed'] == 1 and r['noto'] == 'criminal', 'her death is one murder count against him, and robbing her body is a crime (he is grey)', r)
  r = J(pg, """() => { const S = __SF, T = __T, v = T.vesk(), g = S.lifeTownGeo('vespar'), p = { x: g.center.x + 6, y: g.center.y + 3 }; S.LAW.clear(v.actorId); T.stage(v, p);
    const t = S.LIFE.npcs.find(e => e.life.prof === 'townsfolk' && e.life.town === 'vespar' && !e.gone); T.freeze(t); T.put(t, { x: p.x + 3, y: p.y }); v.adv.nextCrime = 0; const pick = S.crimPreyFor(v); return { pick: pick ? pick.c.name : null } }""")
  check(r['pick'] is None, "never inside a town's jurisdiction, where the guards are", r)

  # 8. guards fight grey and red outlaws inside their jurisdiction; adventurers fight back; attacking a grey outlaw is lawful
  r = J(pg, """() => { const S = __SF, T = __T, v = T.vesk(), G = S.lifeTownGeo('vespar'), g = S.LIFE.npcs.find(e => e.life.prof === 'guard' && e.life.town === 'vespar' && !e.gone);
    for (let i = 0; i < 5; i++) S.LAW.count(v.actorId, S.GT, 'test@' + i); const red = S.notoOf(v); T.stage(v, { x: G.center.x + 3, y: G.center.y + 2 }); v.adv.thinkAt = 1e12; v.adv.mode = 'town'; T.put(g, { x: G.center.x - 3, y: G.center.y + 2 }); g.foe = null;
    T.run(3, () => g.foe === v); const onSight = g.foe === v; g.foe = null; S.LAW.clear(v.actorId); T.put(v, T.spot());
    const mt = T.mott(); S.LAW.crime(mt.actorId, S.GT, 'looting'); T.stage(mt, { x: G.center.x + 3, y: G.center.y + 2 }); mt.adv.thinkAt = 1e12; mt.adv.mode = 'town'; T.run(3, () => g.foe === mt); const grey = g.foe === mt;
    const s0 = T.seq(); S.swingAt(S.P, mt); const lawful = T.ev('AggressionRecorded', s0, x => x.actor === S.P.actorId && x.target === mt.actorId).every(x => x.detail.lawful); const pc = S.notoOf(S.P);
    g.foe = null; S.LAW.clear(mt.actorId); T.put(mt, T.spot());
    const a = T.A('Aldric'), p = T.spot(); T.stage(a, p); a.adv.thinkAt = 0; T.put(v, { x: p.x + 1.2, y: p.y }); v.foe = a; v.adv.mode = 'fight'; v.adv.thinkAt = 1e12; S.swingAt(v, a); T.run(1); const back = a.foe === v;
    v.foe = null; a.foe = null; S.LAW.clear(v.actorId); return { red, onSight, grey, lawful, pc, back } }""")
  check(r['red'] == 'murderer' and r['onSight'], 'a red outlaw in town: the guard attacks him on sight', r)
  check(r['grey'], 'a grey outlaw (a looter) in town: the guard comes for him', r)
  check(r['lawful'] and r['pc'] == 'innocent', 'you may attack a grey outlaw lawfully: no crime, you stay blue', r)
  check(r['back'], 'an adventurer attacked by the cutthroat fights back', r)

  # 9. the cutpurse robs a fresh body he has no right to (a crime), taking the items themselves: nothing is duplicated
  r = J(pg, """() => { const S = __SF, T = __T, mt = T.mott(), p = T.spot(), e = T.N('Durn'), id = e.actorId; T.freeze(e); T.put(e, { x: p.x + 5, y: p.y }); S.damageActor(e, 9999, 'phys', null);
    const c = T.body(id)[0], before = c.cont.items.map(it => it.uid), U = () => JSON.stringify(Object.entries(SF.unitsOf([mt.pack, c.cont])).sort()), u0 = U(); if (mt.ghost) S.advResurrect(mt, 'test'); for (const g of S.LIFE.npcs) if (g.foe === mt) g.foe = null; mt.hp = mt.max; T.stage(mt, p); T.far(); const v = T.vesk(), cc = S.advGeo('camp').center; T.put(v, T.wild(cc.x - 70, cc.y)); v.foe = null; v.adv.mode = 'town'; v.adv.thinkAt = 1e12;   /* Vesk robs bodies too: out of the way */ const s0 = T.seq(); T.run(30, () => c.cont.items.length === 0 || T.ev('CorpseLooted', s0, x => x.actor === mt.actorId).length > 0);
    const took = before.filter(u => !c.cont.items.some(it => it.uid === u)), inPack = U() === u0, crime = T.ev('CrimeCommitted', s0, x => x.actor === mt.actorId && x.crime === 'looting' && x.victim === id).length;
    return { took: took.length, inPack, crime, noto: S.notoOf(mt) } }""")
  check(r['took'] > 0 and r['inPack'] and r['crime'] == 1 and r['noto'] == 'criminal', f"Mott robs Durn's fresh body: {r['took']} items move into his pack (every unit accounted for, nothing duplicated), a crime, and he is grey", r)

  # 10. the cutthroat preys on you too when you are alone in the wild and weak: an unlawful attack; dying to him offers a report
  r = J(pg, """() => { const S = __SF, T = __T, v = T.vesk(), p = T.spot(); S.LAW.clear(v.actorId); T.stage(v, { x: p.x + 4, y: p.y }); T.put(S.P, p); S.P.hp = 20; v.adv.nextCrime = 0; T.god = false;
    const s0 = T.seq(); T.run(90, () => S.P.ghost); const atk = T.ev('AggressionRecorded', s0, x => x.actor === v.actorId && x.target === S.P.actorId && !x.detail.lawful).length;
    return { atk, ghost: S.P.ghost, report: S.P.report ? S.P.report.killer : null } }""")
  check(r['atk'] >= 1 and r['ghost'] and r['report'] == 'npc:vesk-cutthroat', 'alone and weak in the wild, Vesk attacks you; when he kills you the ghost may report him for murder', r)
  check(not errs, 'no page errors', errs[:5]); ctx.close()

  # 11. ?crim=off: no outlaws, the six adventurers as before
  ctx, pg, errs = page(b, '?crim=off'); new_char(pg)
  r = J(pg, "() => ({ n: __SF.ADV.list.length, crim: __SF.ADV.list.filter(e => e.adv.crim).length })")
  check(r['n'] == 6 and r['crim'] == 0, '?crim=off: no outlaws', r); ctx.close()

  # 12. a long accelerated run with tiers on: people die and come back on time, nobody is lost or duplicated, no errors
  ctx, pg, errs = page(b, ''); new_char(pg); J(pg, HELP); J(pg, EXTRA)
  r = J(pg, """() => { const S = __SF, T = __T, C = S.NPCD.cfg, ids = S.LIFE.npcs.map(e => e.actorId); T.god = true; let late = 0, nan = false;
    for (let k = 0; k < 6; k++) { const live = S.LIFE.npcs.filter(e => !e.gone && e.life.prof !== 'guard'); S.damageActor(live[(k * 7) % live.length], 9999, 'phys', null); }
    T.run(30 * 60, () => { for (const e of S.NPCD.dead) if (S.GT - e.npcDead.at > C.back + C.unseen + 3) late++; for (const e of S.LIFE.npcs) if (!e.gone && !Number.isFinite(e.hp)) nan = true; return false; });
    const reg = S.LIFE.npcs.filter(e => !e.gone).every(e => S.WS.reg.get(e.actorId) === e), dup = new Set(S.ents.filter(e => e.actorId).map(e => e.actorId)).size !== S.ents.filter(e => e.actorId).length;
    return { deaths: S.NPCD.stats.deaths, back: S.NPCD.stats.returns, dead: S.NPCD.dead.length, late, nan, reg, dup, same: S.LIFE.npcs.length === ids.length, outlaws: S.CRIM.stats } }""")
  check(r['deaths'] >= 6 and r['back'] >= 6 and r['late'] == 0 and not r['nan'] and r['reg'] and not r['dup'] and r['same'], f"30 accelerated minutes with tiers on: {r['deaths']} deaths, {r['back']} returns, nobody late, lost or duplicated (outlaws: {r['outlaws']})", r)
  check(not errs, 'no page errors', errs[:5]); ctx.close()
  b.close()
print('ALL PASS' if not fails else f'{fails} FAILED'); sys.exit(1 if fails else 0)
