# Living World phase 5, step 3 in the built game (Playwright + Chrome): NPC adventurers and NPC spellcasting (master spec §8, §18, §20).
# Six named adventurers with stable ids, real equipment and the AdventurerAI controller; they hunt, fight through the shared resolver,
# loot their own kills, learn from use; bandages (with slips) and draughts by the player's rules; mages and healers cast through Magery
# (book chance, mana, reagents, interruption); flight when hurt; selling, repairing, restocking and banking in town; death by the player's
# rules (a body with everything tradeable, a ghost that finds a healer, reclaiming the body, nothing duplicated) and a new kit from the
# bank when the body is gone; the law (attacking one is a crime, killing one a murder, looting its body a crime; self-defence); saving
# and reloading everything; older saves; the replace and none policies; ?adv=off; tiers.
# usage: python3 tests/world-smoke/phase5_adv.py Shardfall_v0.36.html [/path/to/chrome]   (also run by world-smoke/run.py)
import sys, json, os
from playwright.sync_api import sync_playwright
f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.36.html')
chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
HOLD = "window.__rafHold = true; { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = cb => window.__rafHold ? (window.__rafCb = cb, 0) : raf(cb); }"
SEED = "S => { let a = %d >>> 0; S.setRng(() => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }); }"
fails = 0
def check(ok, msg, got=None):
  global fails
  print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else '  got: ' + json.dumps(got)[:1200])); fails += 0 if ok else 1
def page(b, q='?tiers=off&crim=off'):   # whole-world rules wherever the player stands; tiers are checked once at the end. crim=off: the outlaws (v0.39) have their own suite, phase5_death.py
  ctx = b.new_context(viewport={'width': 844, 'height': 390}); pg = ctx.new_page(); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
  pg.add_init_script(HOLD); pg.goto('file://' + f + q); pg.wait_for_timeout(400)
  return ctx, pg, errs
def new_char(pg, seed=5):
  pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(400)
  pg.evaluate('(' + (SEED % seed) + ')(__SF)'); pg.evaluate("o => __CC.quick(o)", {'name': 'Tess', 'template': 'advanced', 'stats': [45, 10, 25], 'skills': [['swordsmanship', 50], ['magery', 30], ['tactics', 20]]}); pg.wait_for_timeout(300)
def cont(pg, seed=5):
  pg.reload(); pg.wait_for_timeout(400); pg.evaluate('(' + (SEED % seed) + ')(__SF)'); pg.click('[data-c=cont]'); pg.wait_for_timeout(400)
J = lambda pg, js: pg.evaluate(js)
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

  # 1. six persistent adventurers: stable ids, the AdventurerAI controller, innocent, the adventurers' faction, real kits
  r = J(pg, """() => { const S = __SF, L = S.ADV.list;
    return { n: L.length, ids: L.map(e => e.actorId), arch: L.every(e => e.archetype === 'adventurer' && e.ctrl === 'AdventurerAI'), reg: L.every(e => S.WS.reg.get(e.actorId) === e),
      noto: L.every(e => S.notoOf(e) === 'innocent'), fac: L.every(e => S.factionOf(e) === 'adventurers'),
      kits: L.map(e => [e.adv.key, e.equip.weapon ? e.equip.weapon.id : null, e.equip.weapon ? e.equip.weapon.uid > 0 : true, SF.count(e.pack, 'bandage'), SF.count(e.pack, 'spellbook'), Math.round(e.skills[e.adv.key === 'mage' ? 'magery' : 'tactics'].v / 10)]),
      home: L.every(e => Math.hypot(e.x - S.lifeTownGeo(e.adv.town).center.x, e.y - S.lifeTownGeo(e.adv.town).center.y) < 40) } }""")
  check(r['n'] == 6 and r['ids'][:3] == ['npc:aldric-sellsword', 'npc:brenna-mace-fighter', 'npc:corvin-fencer'] and r['arch'] and r['reg'], 'six adventurers with stable ids from their names, registered, driven by AdventurerAI', r)
  check(r['noto'] and r['fac'] and r['home'], 'all innocent (blue), of the adventurers faction, starting in their home towns', r)
  check([k[1] for k in r['kits']] == ['sword', 'mace', 'kryss', 'shortbow', None, 'mace'] and all(k[2] for k in r['kits']) and r['kits'][4][4] == 1 and r['kits'][4][5] == 72, 'real equipment with real item ids; a spellbook for the mage; skills from the archetype', r['kits'])

  # 2. left alone they hunt: fights through the shared resolver, kills, lawful looting of their own kills, learning from use
  s0 = J(pg, '() => __T.seq()')
  r = J(pg, """() => { const S = __SF, s0 = __T.seq(); __T.run(150); const ids = new Set(S.ADV.list.map(e => e.actorId));
    const dmg = __T.ev('ActorDamaged', s0, e => ids.has(e.source)), took = __T.ev('ActorDamaged', s0, e => ids.has(e.actor)), loot = __T.ev('CorpseLooted', s0, e => ids.has(e.actor));
    return { modes: S.ADV.list.map(e => e.adv.mode), kills: S.ADV.list.map(e => e.adv.rec.kills), dmg: dmg.length, took: took.length, loot: loot.length, lawful: loot.every(e => e.detail.lawful), gains: S.ADV.stats.gains,
      out: S.ADV.list.filter(e => Math.hypot(e.x - S.lifeTownGeo(e.adv.town).center.x, e.y - S.lifeTownGeo(e.adv.town).center.y) > 30).length } }""")
  check(r['out'] >= 3 and sum(1 for k in r['kills'] if k > 0) >= 3, f"they go out hunting: kills {r['kills']}, modes {r['modes']}", r)
  check(r['dmg'] > 10 and r['took'] > 0, f"blows both ways go through the shared damage entry ({r['dmg']} dealt, {r['took']} taken)", r)
  check(r['loot'] > 0 and r['lawful'] and r['gains'] > 0, f"they loot their own kills ({r['loot']} bodies, all lawful) and learn from use ({r['gains']} skill gains)", r)

  # 3. First Aid by the player's rules: a bandage after the delay; a blow makes the fingers slip; a draught when low
  r = J(pg, """() => { const S = __SF, T = __T, e = T.stage(T.A('Aldric'), T.wild(S.lifeTownGeo('vespar').center.x + 70, S.lifeTownGeo('vespar').center.y)); e.hp = Math.round(e.max * .5);
    const b0 = SF.count(e.pack, 'bandage'), s0 = T.seq(); T.run(.2); const started = !!e.adv.tend, kind = e.adv.tend && e.adv.tend.kind;
    const rat = T.mon('rat', e, 1.2); S.damageActor(e, 2, 'phys', rat); const slips = e.adv.tend ? e.adv.tend.slips : -1; S.rmEnt(rat); e.foe = null;
    T.run(18); const healed = T.ev('ActorHealed', s0, x => x.actor === e.actorId && x.detail.how === 'bandage').length;
    e.hp = Math.round(e.max * .3); e.adv.tend = { kind: 'heal', t1: S.GT + 99, slips: 0 }; const d0 = SF.count(e.pack, 'draught'), s1 = T.seq(); T.run(.3);
    const drank = T.ev('ActorHealed', s1, x => x.actor === e.actorId && x.detail.how === 'draught').length, cd = e.adv.potAt - S.GT;
    return { started, kind, used: b0 - SF.count(e.pack, 'bandage'), slips, healed, drank, d: d0 - SF.count(e.pack, 'draught'), cd } }""")
  check(r['started'] and r['kind'] == 'heal' and r['used'] >= 1 and r['slips'] == 1, 'hurt, it starts a bandage (one spent at the start) and a blow makes its fingers slip', r)
  check(r['healed'] >= 1, 'the bandage heals when its delay is done', r)
  check(r['drank'] == 1 and r['d'] == 1 and r['cd'] > 10, 'below 40 % it drinks a healing draught, then waits out the cooldown', r)

  # 4. Magery: a mage casts at a creature with the book chance, mana and one of each reagent; damage to the caster interrupts it
  r = J(pg, """() => { const S = __SF, T = __T, MG = SF.MAGERY, e = T.stage(T.A('Elsbeth'), T.wild(S.lifeTownGeo('moonglen').center.x + 60, S.lifeTownGeo('moonglen').center.y));
    e.mana = e.int; for (const k of Object.keys(MG.REAGENTS)) advGive(e, k, 10); const regs = () => Object.keys(MG.REAGENTS).reduce((a, k) => a + SF.count(e.pack, k), 0), r0 = regs(), s0 = T.seq(); const m = T.mon('hound', e, 6); m.target = e; m.state = 'chase'; m.chaseKind = 'attack';
    T.run(25, () => T.ev('ActorDamaged', s0, x => x.source === e.actorId && x.kind === 'spell').length >= 2);
    const casts = T.ev('SpellCast', s0, x => x.actor === e.actorId), hits = T.ev('ActorDamaged', s0, x => x.source === e.actorId && x.kind === 'spell');
    if (!m.gone) S.rmEnt(m); e.foe = null; e.adv.prep = null; T.run(2);
    const m2 = T.mon('hound', e, 6); e.mana = e.int; e.adv.castReady = 0; const before = { mana: e.mana, regs: regs() };
    const ok = advCast(e, 'magery.18', m2); const reserved = { mana: e.mana, regs: regs() }; S.damageActor(e, 1, 'phys', m2); const after = { mana: e.mana, regs: regs(), prep: !!e.adv.prep };
    S.rmEnt(m2); e.foe = null;
    return { casts: casts.map(c => c.spell), hits: hits.length, used: r0 - regs(), manaUsed: e.int - 0, ok, before, reserved, after, cost: MG.interruptCost(MG.SPELL['magery.18'].mp) } }""")
  check(len(r['casts']) >= 2 and r['hits'] >= 2 and r['used'] >= 2 * 2, f"the mage casts {r['casts']} at the hound: spell damage lands ({r['hits']} hits) and reagents are spent ({r['used']})", r)
  check(r['ok'] and r['reserved']['regs'] == r['before']['regs'] - 2 and r['reserved']['mana'] == r['before']['mana'] - 9, 'casting reserves the mana and one of each reagent', r)
  check(not r['after']['prep'] and r['after']['regs'] == r['before']['regs'] and r['after']['mana'] == r['before']['mana'] - r['cost'], 'a blow interrupts it: the reagents come back and half the mana is spent, as for you', r)

  # 5. a healer heals itself with Magery when hurt
  r = J(pg, """() => { const S = __SF, T = __T, e = T.stage(T.A('Fenwick'), T.wild(S.lifeTownGeo('vespar').center.x - 70, S.lifeTownGeo('vespar').center.y)); e.hp = Math.round(e.max * .4); e.mana = e.int;
    SF.removeQty(e.pack, 'bandage', SF.count(e.pack, 'bandage')); e.adv.castReady = 0; const h0 = e.hp, s0 = T.seq(); T.run(6, () => T.ev('ActorHealed', s0, x => x.actor === e.actorId && /^magery/.test(x.detail.how)).length);
    const c = T.ev('SpellCast', s0, x => x.actor === e.actorId); advGive(e, 'bandage', 12);
    return { casts: c.map(x => [x.spell, x.target === e.actorId]), rose: e.hp - h0 } }""")
  check(r['casts'] and r['casts'][0][1] and r['casts'][0][0] in ('magery.29', 'magery.04') and r['rose'] > 0, f"the healer casts {r['casts'][:1]} on itself and its health rises by {r['rose']}", r)

  # 6. badly hurt and outmatched it runs for town
  r = J(pg, """() => { const S = __SF, T = __T, e = T.stage(T.A('Corvin'), T.wild(S.lifeTownGeo('skara').center.x + 70, S.lifeTownGeo('skara').center.y)); e.hp = Math.round(e.max * .2);
    SF.removeQty(e.pack, 'draught', SF.count(e.pack, 'draught')); const w = T.mon('dire_wolf', e, 2); w.target = e; w.state = 'chase'; w.chaseKind = 'attack'; e.adv.thinkAt = 0; T.run(2);
    const mode = e.adv.mode, goal = e.nav && e.nav.goal && e.nav.goal.name; S.rmEnt(w); return { mode, goal, why: e.adv.why, flees: S.ADV.stats.flees } }""")
  check(r['mode'] == 'flee' and r['goal'] == 'safety', 'badly hurt with a dire wolf on it, it flees toward town', r)

  # 7. in town: sells loot, repairs, restocks and banks
  r = J(pg, """() => { const S = __SF, T = __T, e = T.A('Brenna'), G = S.lifeTownGeo(e.adv.town); T.stage(e, G.center); T.put(e, { x: G.center.x, y: G.center.y + 2 }); e.adv.mode = 'town'; e.adv.thinkAt = 1e12; e.adv.spot = null;
    advGive(e, 'ironbar', 6); e.equip.weapon.cond = Math.round(e.equip.weapon.maxc * .4); SF.removeQty(e.pack, 'bandage', SF.count(e.pack, 'bandage') - 2); SF.removeQty(e.pack, 'gold', SF.count(e.pack, 'gold')); advGive(e, 'gold', 300); e.adv.bank = 100;
    const s0 = T.seq(); T.run(40); return { iron: SF.count(e.pack, 'ironbar'), cond: [e.equip.weapon.cond, e.equip.weapon.maxc], band: SF.count(e.pack, 'bandage'), purse: SF.count(e.pack, 'gold'), bank: e.adv.bank,
      ev: T.ev('ItemTransferred', s0, x => x.actor === e.actorId).map(x => x.detail.what) } }""")
  check(r['iron'] == 0 and 'sold loot' in r['ev'], 'it sells its loot at the market', r)
  check(r['cond'][0] == r['cond'][1] and r['band'] >= 12 and 'bought supplies' in r['ev'], 'it repairs its weapon and buys bandages back up to stock', r)
  check(r['purse'] <= 80 and r['bank'] > 100, 'it keeps a little gold in its pack and banks the rest', r)

  # 8. death by the player's rules: one body with everything tradeable, a ghost, a healer, the body reclaimed, nothing duplicated
  r = J(pg, """() => { const S = __SF, T = __T, e = T.A('Aldric'), G = S.lifeTownGeo(e.adv.town); for (const o of S.ADV.list) o.adv.thinkAt = o === e ? 0 : 1e12; S.WS.clock.setHour(S.GT, 9); e.hp = e.max;
    for (const m of S.ents) if (m.kind === 'mon') m.pacified = 0;   // he walks out to a hunting ground of his own (so the spot is reachable), then dies there
    T.run(200, () => Math.hypot(e.x - G.center.x, e.y - G.center.y) > 40 && e.adv.mode === 'hunt' && !e.nav); T.calm(); e.foe = null; e.hp = e.max;
    const before = T.uids(e), s0 = T.seq(), w = T.mon('dire_wolf', e, 1.5); window.__ids = {}; for (const it of [...Object.values(e.equip).filter(Boolean), ...e.pack.items]) __ids[it.uid] = it.id; w.target = e; w.state = 'chase';
    S.damageActor(e, 9999, 'phys', w); advDies(e, w); S.damageActor(e, 50, 'phys', w);
    const bodies = S.ents.filter(c => c.advBody === e.actorId && !c.gone), body = bodies[0], inBody = body ? body.cont.items.map(i => i.uid).sort((a, b) => a - b) : [];
    const kept = T.uids(e), wolfOn = w.target === e; S.rmEnt(w);
    return { ghost: e.ghost, up: S.npcUp(e), bodies: bodies.length, same: JSON.stringify(inBody.filter(u => before.includes(u))) === JSON.stringify(before), kept, wolfOn,
      killed: T.ev('ActorKilled', s0, x => x.actor === e.actorId).length, mode: e.adv.mode, garment: e.equip.tunic ? e.equip.tunic.id : null, before } }""")
  check(r['ghost'] and not r['up'] and r['bodies'] == 1 and r['killed'] == 1 and not r['wolfOn'], 'killed: a ghost, one body and one ActorKilled even when struck again; creatures let go', r)
  check(r['same'] and r['kept'] == [], 'every tradeable item it carried is on the body, none left on the ghost', r)
  r = J(pg, """() => { const S = __SF, T = __T, e = T.A('Aldric'), s0 = T.seq(), r0 = S.ADV.stats.rises; let how = null; const off = S.WS.bus.on('ActorResurrected', x => { if (x.actor === e.actorId) how = x.detail.how; }); const t = T.run(480, () => !e.ghost && !S.ents.some(c => c.advBody === e.actorId && !c.gone));   // it may fight on the way back; done when the body is reclaimed
    const body = S.ents.filter(c => c.advBody === e.actorId && !c.gone).length, now = T.uids(e);
    const before = Object.keys(__ids).map(Number).filter(u => __ids[u] !== 'garment' && __ids[u] !== 'journal'), missing = before.filter(u => !now.includes(u)).map(u => __ids[u]), extra = now.filter(u => !before.includes(u));
    return { t, ghost: e.ghost, mode: e.adv.mode, hpF: e.hp / e.max, rose: S.ADV.stats.rises > r0 ? [how || T.ev('ActorResurrected', s0, x => x.actor === e.actorId).map(x => x.detail.how)[0] || 'by ?'] : [], body, missing, extra, dup: now.length !== new Set(now).size, weapon: e.equip.weapon && e.equip.weapon.id, reclaimed: S.ADV.stats.reclaimed } }""")
  check(not r['ghost'] and bool(r['rose']) and r['rose'][0].startswith('by '), f"the ghost finds a healer and comes back ({r['rose']}, after {r['t']:.0f} s)", r)
  check(r['body'] == 0 and not r['extra'] and all(m in ('draught', 'bandage') for m in r['missing']) and not r['dup'] and r['weapon'] == 'sword', f"it walks back to its body and takes everything back: the same items, nothing duplicated (used up since: {r['missing']})", {k: r[k] for k in ('body', 'dup', 'weapon', 'mode', 'missing', 'extra')})

  # 9. a body that is gone: the gear is lost and it buys a new kit from the bank
  r = J(pg, """() => { const S = __SF, T = __T, e = T.stage(T.A('Brenna'), T.wild(S.lifeTownGeo('mynoc').center.x + 60, S.lifeTownGeo('mynoc').center.y)); e.adv.bank = 2000;
    const w = T.mon('rat', e, 1.5); S.damageActor(e, 9999, 'phys', w); S.rmEnt(w); const body = S.ents.find(c => c.advBody === e.actorId && !c.gone); const lostUids = body.cont.items.map(i => i.uid); S.rmEnt(body);
    advResurrect(e, 'test'); const mode = e.adv.mode; const G = S.lifeTownGeo(e.adv.town); T.put(e, { x: G.center.x, y: G.center.y + 2 }); e.adv.thinkAt = 0; T.run(60);
    const now = T.uids(e); return { mode, weapon: e.equip.weapon && e.equip.weapon.id, chest: e.equip.chest && e.equip.chest.id, bank: e.adv.bank, fresh: now.every(u => !lostUids.includes(u)), lost: S.ADV.stats.lost } }""")
  check(r['mode'] == 'return' and r['weapon'] == 'mace' and r['chest'] == 'chain_tunic' and r['bank'] < 2000 and r['fresh'], 'its body gone, it buys a new kit from the bank (new items, never the lost ones)', r)
  check(not errs, 'no page errors', errs[:5]); ctx.close()

  # 10. the law: attacking an adventurer is a crime and it fights back in self-defence; killing it is a murder; looting its body a crime
  ctx, pg, errs = page(b); new_char(pg); J(pg, HELP)
  r = J(pg, """() => { const S = __SF, T = __T, e = T.stage(T.A('Dara'), T.wild(S.lifeTownGeo('skara').center.x + 70, S.lifeTownGeo('skara').center.y)); T.god = true;
    T.put(S.P, { x: e.x + 1, y: e.y }); S.P.sel = e; const s0 = T.seq(); S.P.sw.ready = true; S.P.sw.next = 0; S.swingAt(S.P, e);
    const noto = S.notoOf(S.P); T.run(15, () => T.ev('AggressionRecorded', s0, x => x.actor === e.actorId && x.target === S.P.actorId).length >= 2);
    const back = T.ev('AggressionRecorded', s0, x => x.actor === e.actorId && x.target === S.P.actorId && x.detail.lawful && x.detail.selfDefence).length, foe = e.foe === S.P;
    S.damageActor(e, 9999, 'phys', S.P); const murder = T.ev('MurderReported', s0, x => x.actor === e.actorId && x.target === S.P.actorId).length;
    return { noto, foe, back, murder, ghost: e.ghost } }""")
  check(r['noto'] == 'criminal', 'swinging at an innocent adventurer makes you a criminal', r)
  check(r['foe'] and r['back'] > 0, 'it fights back, recorded as lawful self-defence', r)
  check(r['ghost'] and r['murder'] == 1, 'killing it reports a murder: its self-defence gave you no right over it', r)
  r = J(pg, """() => { const S = __SF, T = __T, e = T.A('Dara'), c = S.ents.find(x => x.advBody === e.actorId && !x.gone); S.LAW.prune(1e9);
    const s0 = T.seq(); T.put(S.P, { x: c.x + .5, y: c.y }); S.P.lootOpen = c; const it = c.cont.items.find(i => i.id === 'arrow') || c.cont.items[0]; S.ACT.take({ u: it.uid });
    const crimes = T.ev('CrimeCommitted', s0, x => x.crime === 'looting' && x.victim === e.actorId).length; S.P.lootOpen = null;
    return { crimes, label: SF.lootStatus(c.cont, S.P.actorId, S.GT).label } }""")
  check(r['crimes'] == 1 and 'criminal to loot' in r['label'], 'taking from its body inside the loot-rights window is a crime (looting)', r)
  check(not errs, 'no page errors', errs[:5]); ctx.close()

  # 11. saved whole and restored: positions, vitals, skills, bank, every item, the ghost and its body; ids never duplicated
  ctx, pg, errs = page(b); new_char(pg); J(pg, HELP)
  a = J(pg, """() => { const S = __SF, T = __T; T.run(60); const e = T.A('Corvin'); e.adv.bank = 777; const w = T.mon('rat', e, 1.5); S.damageActor(e, 9999, 'phys', w); S.rmEnt(w); T.run(1); S.save();
    const sv = JSON.parse(localStorage.getItem('shardfall.save.v1'));
    return { pos: S.ADV.list.map(e => [e.x, e.y]), list: S.ADV.list.map(e => [e.actorId, e.ghost, Math.round(Object.values(e.skills).reduce((s, k) => s + k.v, 0)), e.adv.bank, T.uids(e).join(','), e.adv.rec.kills]),
      body: S.ents.filter(c => c.advBody && !c.gone).map(c => [c.advBody, c.cont.items.map(i => i.uid).sort((a, b) => a - b).join(',')]), hasAdv: !!(sv.adv && sv.adv.list.length === 6), uid: sv.uid } }""")
  cont(pg); J(pg, HELP)
  b2 = J(pg, """() => { const S = __SF, T = __T, live = S.ents.filter(e => !e.gone && e.kind !== 'corpse'), ids = live.map(e => e.actorId);
    return { pos: S.ADV.list.map(e => [e.x, e.y]), list: S.ADV.list.map(e => [e.actorId, e.ghost, Math.round(Object.values(e.skills).reduce((s, k) => s + k.v, 0)), e.adv.bank, T.uids(e).join(','), e.adv.rec.kills]),
      body: S.ents.filter(c => c.advBody && !c.gone).map(c => [c.advBody, c.cont.items.map(i => i.uid).sort((a, b) => a - b).join(',')]), uniq: new Set(ids).size === ids.length, reg: S.WS.reg.size === live.length, newUid: SF.newItem('bandage', 1).uid } }""")
  check(a['hasAdv'] and b2['list'] == a['list'] and all(abs(p[0] - q[0]) <= .06 and abs(p[1] - q[1]) <= .06 for p, q in zip(a['pos'], b2['pos'])), 'every adventurer comes back as saved: position, ghost, skills, bank, items, record', {'before': a['list'][:2], 'after': b2['list'][:2], 'pos': [a['pos'][:2], b2['pos'][:2]]})
  check(b2['body'] == a['body'] and len(a['body']) == 1 and b2['uniq'] and b2['reg'], 'the ghost\'s body and everything on it is restored; every actor id once', {'a': a['body'], 'b': b2['body']})
  check(b2['newUid'] >= a['uid'], 'new items never reuse an adventurer item\'s uid after the reload', [b2['newUid'], a['uid']])
  # an older save (no adv block) boots with the six adventurers fresh
  J(pg, '() => __SF.save()'); pg.reload(); pg.wait_for_timeout(400)   # edit the save from the title screen, where nothing runs that could save over it
  J(pg, """() => { const sv = JSON.parse(localStorage.getItem('shardfall.save.v1')); delete sv.adv; localStorage.setItem('shardfall.save.v1', JSON.stringify(sv)); return true; }""")
  pg.evaluate('(' + (SEED % 5) + ')(__SF)'); pg.click('[data-c=cont]'); pg.wait_for_timeout(400); J(pg, HELP)
  r = J(pg, "() => ({ n: __SF.ADV.list.length, ghosts: __SF.ADV.list.filter(e => e.ghost).length, bank: __SF.ADV.list.map(e => e.adv.bank) })")
  check(r['n'] == 6 and r['ghosts'] == 0 and all(x == 150 for x in r['bank']), 'a save from before v0.36 starts with the six adventurers fresh', r)
  check(not errs, 'no page errors after reloads', errs[:5]); ctx.close()

  # 12. resurrection policies: 'replace' brings a successor of the same calling; 'none' is final and stays final after a reload
  ctx, pg, errs = page(b); new_char(pg); J(pg, HELP)
  r = J(pg, """() => { const S = __SF, T = __T, C = S.ADV.cfg, r0 = C.res, ra = C.replaceAfter; C.res = 'replace'; C.replaceAfter = 30;
    const e = T.stage(T.A('Corvin'), T.wild(S.lifeTownGeo('skara').center.x + 70, S.lifeTownGeo('skara').center.y)), id = e.actorId; S.damageActor(e, 9999, 'phys', null); advDies(e, null);
    T.run(25); const goneNow = !S.ADV.list.includes(e) && !S.WS.reg.get(id); T.run(35); const succ = S.ADV.list.find(x => /, fencer$/.test(x.name) && x !== e);
    C.res = 'none'; const d = T.A('Dara'), did = d.actorId; advDies(d, null); T.run(25); const dGone = !S.ADV.list.includes(d); C.res = r0; C.replaceAfter = ra; S.save();
    return { goneNow, succ: succ ? [succ.name, succ.actorId, succ.archetype, succ.adv.town] : null, dGone, did, n: S.ADV.list.length } }""")
  check(r['goneNow'] and r['succ'] and r['succ'][0].startswith('Garet') and r['succ'][2] == 'adventurer' and r['succ'][3] == 'mynoc', f"'replace': the ghost leaves and a successor arrives in town ({r['succ']})", r)
  check(r['dGone'] and r['n'] == 5, "'none': the dead adventurer is gone for good", r)
  cont(pg)
  r2 = J(pg, "o => ({ n: __SF.ADV.list.length, has: __SF.ADV.list.some(e => e.actorId === o), garet: __SF.ADV.list.some(e => e.name.startsWith('Garet')) })".replace('o =>', '() =>').replace('=== o', '=== "' + r['did'] + '"'))
  check(r2['n'] == 5 and not r2['has'] and r2['garet'], 'after a reload the successor is still there and the dead stay dead', r2)
  check(not errs, 'no page errors', errs[:5]); ctx.close()

  # 13. ?adv=off leaves them out; with tiers on an adventurer is never distant
  ctx, pg, errs = page(b, '?adv=off'); new_char(pg)
  r = J(pg, "() => ({ n: __SF.ADV.list.length, npc: __SF.ents.filter(e => e.role === 'adventurer').length })")
  check(r['n'] == 0 and r['npc'] == 0, '?adv=off: no adventurers', r); ctx.close()
  ctx, pg, errs = page(b, '?crim=off'); new_char(pg); J(pg, HELP)
  r = J(pg, """() => { const S = __SF; __T.run(30); const tiers = S.ADV.list.map(e => e.tier), orig = S.CONTROL.AdventurerAI; let ms = 0;
    S.CONTROL.AdventurerAI = (e, dt) => { const t = performance.now(); orig(e, dt); ms += performance.now() - t; }; const t0 = performance.now(); __T.run(150); const all = performance.now() - t0; S.CONTROL.AdventurerAI = orig;
    return { tiers, adv: ms / 3000, step: all / 3000 } }""")
  check(all(t in ('A', 'B') for t in r['tiers']), f"with tiers on, adventurers are never distant: {r['tiers']}", r)
  check(r['adv'] < .3, f"their controllers cost {r['adv']:.3f} ms per step for all six ({r['step']:.2f} ms the whole step; their long searches run in the background lane)", r)
  check(not errs, 'no page errors', errs[:5]); ctx.close()
  b.close()
print('ALL PASS' if not fails else f'{fails} FAILED'); sys.exit(1 if fails else 0)
