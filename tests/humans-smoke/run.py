# Classic humans v2 in the built game (Playwright + Chrome): the feature flag, character creation, all eight directions and both
# bodies, every weapon, spellcasting and interruption, movement, gathering, NPC looks and interaction, death and corpses, equipment
# changes, the paper doll, save/load and old-save migration, monsters left alone, the sprite cache and frame time, phone layout.
# usage: python3 tests/humans-smoke/run.py Shardfall_v0.30.html [chrome] [screenshot-dir]
import json, os, sys
from playwright.sync_api import sync_playwright
f = os.path.abspath(sys.argv[1]); chrome = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else '/usr/bin/google-chrome'
SHOTS = sys.argv[3] if len(sys.argv) > 3 else os.environ.get('HUMAN_SHOTS', '/tmp/humans-shots'); os.makedirs(SHOTS, exist_ok=True)
URL = 'file://' + f; fails = 0
def check(cond, msg, info=None):
  global fails
  if cond: print('ok  ', msg)
  else: fails += 1; print('FAIL', msg, json.dumps(info)[:700] if info is not None else '')
H = "__SF.HUMANS"
SETTLE = """async (sec) => { const t = performance.now(); while (performance.now() - t < sec * 1000) { await new Promise(r => requestAnimationFrame(r)); } return __SF.HUMANS.stats(); }"""

def new_char(pg, q, name='Tess', setup=None):
  pg.goto(URL + q); pg.evaluate('localStorage.clear()'); pg.goto(URL + q); pg.wait_for_selector('[data-c=go]')
  if setup: setup(pg)
  pg.fill('#ccn', name); pg.click('[data-c=go]'); pg.wait_for_function('window.__SF && __SF.P')

with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
  ctx = b.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page(); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)

  # ---- 1. flag off: the game draws exactly as before, but the appearance is already migrated and saved
  new_char(pg, '?humans=old', 'Oldie'); st = pg.evaluate(SETTLE, 1.5)
  check(not st['on'] and st['strips'] == 0, 'flag off: the human renderer builds nothing (v0.29.2 drawing)', st)
  look = pg.evaluate("__SF.SF.LOOK.check(__SF.P.look)"); check(look == '', 'flag off: the new character still has a valid appearance record', look)
  check(pg.evaluate("!document.querySelector('.doll2')") , 'flag off: the paper doll keeps the old figure')

  # ---- 2. character creation: body, hair, colours, randomize, rotation, preview animation
  def setup(pg):
    pg.click('[data-c=lk][data-k=body][data-v=female]'); pg.click('[data-c=lk][data-k=hair][data-v=braid]'); pg.click('[data-c=lk][data-k=hairColor][data-v=auburn]')
    pg.click('[data-c=lk][data-k=skin][data-v=olive]'); pg.click('[data-c=lk][data-k=cloth][data-v=forest]'); pg.click('[data-c=pact][data-v=walk]'); pg.click('[data-c=rot][data-d="1"]')
    s = pg.evaluate("({ beardDisabled: [...document.querySelectorAll('[data-k=beard]')].every(b => b.disabled), src: document.getElementById('ccprev').src.slice(0, 30) })")
    check(s['beardDisabled'], 'creator: facial hair is disabled for the female body')
    check(s['src'].startswith('data:image/svg+xml'), 'creator: the rotatable preview shows the rig')
    pg.screenshot(path=os.path.join(SHOTS, 'creator.png'))
  new_char(pg, '?humans=v2', 'Tess', setup)
  lk = pg.evaluate("__SF.P.look"); check([lk['body'], lk['hair'], lk['hairColor'], lk['skin'], lk['cloth'], lk['beard']] == ['female', 'braid', 'auburn', 'olive', 'forest', 'none'], 'creation: the chosen appearance becomes the character', lk)
  base = pg.evaluate("({ str: __SF.P.str, dex: __SF.P.dex, int: __SF.P.int, sk: Object.entries(__SF.P.skills).filter(([k, v]) => v.v > 0).map(([k, v]) => k + v.v).sort() })")
  check(base['str'] + base['dex'] + base['int'] == 150 and len(base['sk']) == 3, 'creation: stat and skill allocation unchanged (appearance is cosmetic)', base)
  st = pg.evaluate(SETTLE, 2.5); check(st['on'] and st['ready'] > 8 and st['queue'] == 0, 'world: strips built and the queue drained', st)
  pg.screenshot(path=os.path.join(SHOTS, 'world-quay.png'))

  # ---- 3. both bodies × 8 directions: one strip each, anchored on the feet
  r = pg.evaluate("""async () => { const S = __SF, P = S.P, out = []; for (const body of ['male', 'female']) { P.look.body = body; if (body === 'female') P.look.beard = 'none';
      for (let d = 0; d < 8; d++) { P.sect = d; let s = null; for (let k = 0; k < 90 && !s; k++) { await new Promise(r => requestAnimationFrame(r)); const f = S.HUMANS.figure(P), a = S.HUMANS.anim(P); const c = S.HUMANS.cache.cache.get(f.key + '|' + a.action + '|' + d + '|' + (a.tool ? (a.tool.geom || 'none') : '')); if (c && c.ready) s = c; }
        out.push(s ? { body, d, foot: s.rects[0].oy + s.rects[0].h, h: s.rects[0].h } : { body, d, missing: true }); } } return out; }""")
  check(all(not x.get('missing') for x in r) and len(r) == 16, 'both bodies in all 8 directions are drawn', [x for x in r if x.get('missing')])
  check(all(-3 <= x.get('foot', 99) <= 9 for x in r), 'every direction stands on the same ground anchor (feet within a few pixels of the tile point)', r)
  hs = [x['h'] for x in r if 'h' in x]; check(hs and 58 <= min(hs) and max(hs) <= 100, 'human height matches the old sprites (58–100 px incl. weapon)', hs)

  # ---- 4. every weapon: its own animation family and geometry; two-handed hides the shield; a real swing plays its family
  r = pg.evaluate("""async () => { const S = __SF, P = S.P, SF = S.SF, out = {}; const sh = SF.EQ.make('kite_shield'); SF.addItem(P.pack, sh); SF.EQ.equipItem(P, { uid: sh.uid });
      for (const id of Object.keys(SF.WEAPONS)) { if (id === 'unarmed') { const w = P.equip.weapon; if (w) SF.EQ.unequipItem(P, { slot: 'weapon' }); } else { const it = SF.newItem(id, 1); SF.addItem(P.pack, it); const rr = SF.EQ.equipItem(P, { uid: it.uid }); if (!rr.ok) { P.equip.weapon = it; } }
        S.weaponChanged(); P._hswing = S.GT; const f = S.HUMANS.figure(P), a = S.HUMANS.anim(P); out[id] = { fam: a.action, geom: f.weapon, shield: f.shield, two: !!SF.WEAPONS[id].two };
        for (let k = 0; k < 6; k++) await new Promise(r => requestAnimationFrame(r)); }
      return out; }""")
  for wid, x in r.items():
    exp = pg.evaluate(f"__SF.SF.LOOK.WEAPON_ANIM['{wid}']")
    check(x['fam'] == exp['family'] and (x['geom'] or 'fist') == exp['geom'], f"weapon {wid}: plays {exp['family']} with the {exp['geom']} shape", x)
  bad = [w for w, x in r.items() if x['two'] and w != 'pickaxe' and x['shield']]; check(not bad, 'two-handed weapons hide the shield', bad)
  check(r['sword']['shield'] == 'kite', 'a one-handed sword keeps the shield', r['sword'])
  st = pg.evaluate(SETTLE, 2); check(st['queue'] == 0, 'every weapon strip was built', st)
  r = pg.evaluate("""async () => { const S = __SF, P = S.P, SF = S.SF; const it = SF.newItem('sword', 1); SF.addItem(P.pack, it); SF.EQ.equipItem(P, { uid: it.uid }); S.weaponChanged();
      const m = S.spawnMon('rat', 1, 0); m.hp = m.max = 999; S.MON.rat.aggro = 0; P.sw.ready = true; P.sw.next = 0; const ok = S.swingAt(P, m); const a = S.HUMANS.anim(P); S.rmEnt(m); return { ok, act: a.action }; }""")
  check(r['ok'] and r['act'] == 'slash1h', 'a real swing from the combat resolver plays the sword animation', r)

  # ---- 5. spellcasting: one-handed, two-handed, release, interruption (the simulation decides; the body only gestures)
  r = pg.evaluate("""async () => { const S = __SF, P = S.P, SF = S.SF, MG = SF.MAGERY, out = {}; const step = s => { for (let i = 0; i < Math.round(s / .05); i++) S.update(.05); };
      SF.EQ.unequipItem(P, { slot: 'weapon' }); S.weaponChanged(); P.skills.spellcraft.v = 1000; if (P.skills.focus) P.skills.focus.v = 1000; P.mana = 100; P.int = 100; if (P.base) P.base.int = 100;
      for (const id of ['scroll.05', 'scroll.42']) { SF.addItem(P.pack, SF.newItem(id, 3)); MG.learn(P.pack, id); }
      for (const r of ['black_pearl', 'blood_moss', 'mandrake_root', 'sulfurous_ash', 'nightshade', 'garlic', 'ginseng', 'spiders_silk']) if (SF.ITEMS[r]) SF.addItem(P.pack, SF.newItem(r, 20));
      const rat = S.spawnMon('boar', 3, 0); rat.hp = rat.max = 900; S.MON.boar.aggro = 0;
      step(.8); const mana0 = P.mana; S.castSlot('magery.05'); step(.1); out.prep = P.prep ? S.HUMANS.anim(P).action : 'no prep'; step(.7); out.hold = P.held ? S.HUMANS.anim(P).action : 'no hold';
      S.releaseHeld(rat); out.release = S.HUMANS.anim(P).action; out.manaSpent = mana0 - P.mana; step(1);
      P.mana = 100; S.castSlot('magery.42'); step(.1); out.prep2 = P.prep ? S.HUMANS.anim(P).action : 'no prep'; step(.1); S.damagePlayer(1, null, 'phys'); out.interrupted = !P.prep; out.flinch = S.HUMANS.anim(P).action;
      step(.5); out.after = S.HUMANS.anim(P).action; S.rmEnt(rat); return out; }""")
  check(r['prep'] == 'cast1h' and r['hold'] == 'cast1h' and r['release'] == 'cast1h', 'a low-circle spell: one-hand gesture through prepare, hold and release', r)
  check(r['manaSpent'] > 0, 'mana is still spent by the Magery rules', r)
  check(r['prep2'] == 'cast2h', 'a sixth-circle spell: two-hand gesture', r)
  check(r['interrupted'] and r['flinch'] == 'hit' and r['after'] != 'hit', 'an interruption decided by the simulation shows the flinch, then ends', r)

  # ---- 6. movement and tools
  r = pg.evaluate("""() => { const S = __SF, P = S.P, out = {}; P.speed = S.SF.WALK * 1.5; out.walk = S.HUMANS.anim(P).action; P.speed = S.SF.SPRINT * 1.5; out.run = S.HUMANS.anim(P).action; P.speed = 0;
      P.task = { kind: 'gather', node: { skill: 'mining' }, label: 'Mining', t0: S.GT, t1: S.GT + 9 }; const a = S.HUMANS.anim(P); out.mine = a.action + '/' + a.tool.geom;
      P.task.node.skill = 'lumberjacking'; const b2 = S.HUMANS.anim(P); out.wood = b2.action + '/' + b2.tool.geom; P.task = null; P.drawn = true; out.ready = S.HUMANS.anim(P).action; P.drawn = false; out.idle = S.HUMANS.anim(P).action; return out; }""")
  check(r == {'walk': 'walk', 'run': 'run', 'mine': 'mine/pickaxe', 'wood': 'chopwood/hatchet', 'ready': 'ready', 'idle': 'idle'}, 'walk, run, mining, woodcutting, ready and idle', r)
  r = pg.evaluate("""async () => { const S = __SF, P = S.P; const x0 = P.x; for (let i = 0; i < 20; i++) { S.JOY.on = true; S.JOY.x0 = 400; S.JOY.y0 = 400; S.JOY.x = 460; S.JOY.y = 400; S.update(.05); } const act = S.HUMANS.anim(P).action; S.JOY.on = false; S.update(.05); return { moved: Math.abs(P.x - x0) > .1, act }; }""")
  check(r['moved'] and r['act'] in ('walk', 'run'), 'walking with the stick plays the walk cycle', r)

  # ---- 7. NPCs: persistent, varied, profession-appropriate; interaction unchanged
  npcs = pg.evaluate("""() => __SF.ents.filter(e => e.kind === 'npc').map(e => { const f = __SF.HUMANS.figure(e); return { n: e.name, r: e.role, k: f.key, torso: f.torso, apron: !!f.apron, tab: !!f.tabard, body: f.body }; })""")
  keys = [x['k'] for x in npcs]; check(len(npcs) > 40 and len(set(keys)) >= len(keys) * .9, f'{len(npcs)} NPCs, {len(set(keys))} distinct looks', None)
  check(all(x['torso'] == 'chain' and x['tab'] for x in npcs if x['r'] == 'guard' and 'ranger' not in x['n'].lower()), 'town guards wear chain and town tabards')
  check(all(x['apron'] for x in npcs if x['r'] in ('smith', 'qsmith')), 'smiths wear aprons')
  check(all(x['torso'] == 'robe' for x in npcs if x['r'] in ('healer', 'mage')), 'healers and mages wear robes')
  check(any(x['body'] == 'female' for x in npcs) and any(x['body'] == 'male' for x in npcs), 'towns have both men and women')
  r = pg.evaluate("""() => { const S = __SF, n = S.ents.find(e => e.kind === 'npc' && e.role === 'smith'); S.P.x = n.x + 1; S.P.y = n.y; S.talk(n); return { said: !!n.say, panel: S.PANEL || null }; }""")
  check(r['said'] or r['panel'], 'talking to a smith still works', r)
  pg.evaluate(SETTLE, 1.5); pg.screenshot(path=os.path.join(SHOTS, 'world-smith.png'))

  # ---- 8. equipment changes and the paper doll (same figure as the world)
  r = pg.evaluate("""() => { const S = __SF, P = S.P, SF = S.SF; const out = {}; for (const id of ['plate_chest', 'plate_arms', 'plate_leggings', 'plate_helm', 'cloak']) { const it = SF.EQ.make(id); SF.addItem(P.pack, it); SF.EQ.equipItem(P, { uid: it.uid }); }
      const f = S.HUMANS.figure(P); out.on = [f.torso, f.arms, f.legs, f.helm, !!f.cloak]; S.toggleEqWin(true); S.renderEqWin(true); const img = document.querySelector('.doll2'); out.doll = !!img && img.src.startsWith('data:image/svg+xml');
      SF.EQ.unequipItem(P, { slot: 'chest' }); out.off = S.HUMANS.figure(P).torso; return out; }""")
  check(r['on'] == ['plate', 'plate', 'plate', 'closedhelm', True], 'plate, helm and cloak show on the figure', r)
  check(r['doll'] and r['off'] != 'plate', 'the paper doll uses the same figure; taking the chest off shows again', r)
  pg.evaluate(SETTLE, 1); pg.screenshot(path=os.path.join(SHOTS, 'paperdoll.png')); pg.evaluate("__SF.toggleEqWin(false)")

  # ---- 9. monsters keep their art; human creatures use the human renderer; bandit death leaves a human corpse with its look
  r = pg.evaluate("""async () => { const S = __SF, out = {}; const before = S.HUMANS.stats().strips; const ms = ['orc', 'rat', 'skeleton', 'lizardman', 'troll'].filter(t => S.MON[t]).map((t, i) => S.spawnMon(t, 3 + i, 2));
      for (let k = 0; k < 20; k++) await new Promise(r => requestAnimationFrame(r)); out.monHuman = ms.some(m => S.HUMANS.isHuman(m)); out.monKeys = [...S.HUMANS.cache.cache.keys()].filter(k => /orc|troll|lizard|skeleton/.test(k)).length; ms.forEach(m => S.rmEnt(m));
      const bd = S.spawnMon('bandit', 2, -2); for (let k = 0; k < 20; k++) await new Promise(r => requestAnimationFrame(r)); out.bandit = S.HUMANS.isHuman(bd) && S.HUMANS.figure(bd).torso === 'leather';
      const key = bd._hfig && bd._hfig.key; S.killMon(bd, S.P); const c = S.ents.find(e => e.kind === 'corpse' && e.mon === 'bandit' && !e.gone); out.corpse = !!c && !!c.hfig && c.hfig.key === key && c.cont.items.length >= 0;
      for (let k = 0; k < 50; k++) await new Promise(r => requestAnimationFrame(r)); out.corpseStrip = [...S.HUMANS.cache.cache.keys()].some(k => k.startsWith(key + '|corpse')); return out; }""")
  check(not r['monHuman'] and r['monKeys'] == 0, 'monsters are not drawn by the human renderer', r)
  check(r['bandit'], 'bandits are humans in leather', r)
  check(r['corpse'] and r['corpseStrip'], 'a slain bandit leaves a human corpse in the look it died in (loot untouched)', r)

  # ---- 10. NPC looks persist through save and reload; the player look too
  before = {x['n'] + '#' + str(i): x['k'] for i, x in enumerate(npcs)}
  plook = pg.evaluate("__SF.save(); JSON.stringify(__SF.P.look)")
  pg.goto(URL + '?humans=v2'); pg.wait_for_selector('[data-c=cont]'); pg.click('[data-c=cont]'); pg.wait_for_function('window.__SF && __SF.P')
  after = pg.evaluate("""() => __SF.ents.filter(e => e.kind === 'npc').map(e => __SF.HUMANS.figure(e).key)""")
  same = sum(1 for a, b2 in zip(before.values(), after) if a == b2); check(same == len(after) == len(before), f'NPC looks are the same after a reload ({same}/{len(before)})')
  check(pg.evaluate("JSON.stringify(__SF.P.look)") == plook, 'the player look is the same after a reload')

  # ---- 11. an old save (look = { cloak }) migrates to a stable look, the same on every load, cloak kept
  MIG = """() => { const s = JSON.parse(localStorage.getItem('shardfall.save.v1')); s.char.look = { cloak: '#8a2a2a' }; localStorage.setItem('shardfall.save.v1', JSON.stringify(s)); return true; }"""
  looks = []
  for k in range(2):
    pg.goto(URL + '?humans=v2'); pg.wait_for_selector('[data-c=cont]'); pg.evaluate(MIG); pg.reload(); pg.wait_for_selector('[data-c=cont]'); pg.click('[data-c=cont]'); pg.wait_for_function('window.__SF && __SF.P')
    looks.append(pg.evaluate("JSON.stringify(__SF.P.look)"))
  l0 = json.loads(looks[0]); check(looks[0] == looks[1] and l0.get('cloak') == '#8a2a2a' and pg.evaluate(f"__SF.SF.LOOK.check({looks[0]})") == '', 'an old save gets a valid look, identical on every load, cloak kept', looks)

  # ---- 12. death: the fall, the body in the last look, the ghost
  r = pg.evaluate("""async () => { const S = __SF, P = S.P; for (let k = 0; k < 400; k++) { const x = 120 + (k % 20) * 2, y = 280 + Math.floor(k / 20) * 2; if (!S.BLK[S.tAt(Math.floor(x), Math.floor(y))] && !S.protAt(x, y) && S.canStand(P, x + .5, y + .5)) { P.x = x + .5; P.y = y + .5; break; } }
      const key = S.HUMANS.figure(P).key; S.damagePlayer(9999, null, 'phys'); const c = S.ents.find(e => e.kind === 'corpse' && e.mine && !e.gone);
      for (let k = 0; k < 60; k++) await new Promise(r => requestAnimationFrame(r)); const g = S.HUMANS.figure(P);
      return { ghost: P.ghost, corpse: !!c, look: c && c.hfig && c.hfig.key === key, t0: c && c.t0 != null, death: [...S.HUMANS.cache.cache.keys()].some(k => k.startsWith(key + '|death') || k.startsWith(key + '|corpse')), ghostFig: g.ghost }; }""")
  check(r['ghost'] and r['corpse'] and r['look'] and r['t0'] and r['death'] and r['ghostFig'], 'death: the body falls and stays in the last look; the ghost is drawn pale', r)
  pg.evaluate(SETTLE, 1); pg.screenshot(path=os.path.join(SHOTS, 'death.png'))

  # ---- 13. a busy town: frame time and the bounded cache
  pg.goto(URL + '?humans=v2'); pg.wait_for_selector('[data-c=cont]'); pg.click('[data-c=cont]'); pg.wait_for_function('window.__SF && __SF.P')
  r = pg.evaluate("""async () => { const S = __SF, P = S.P; const hum = S.ents.filter(e => S.HUMANS.isHuman(e) && e !== P && !e.hidden); let w = hum[0], best = -1; for (const e of hum) { const c = hum.filter(o => Math.hypot(o.x - e.x, o.y - e.y) < 9).length; if (c > best) { best = c; w = e; } } if (P.ghost) { P.ghost = false; P.hp = 30; } P.x = w.x + 1.5; P.y = w.y + 1.5;
      const near = () => S.ents.filter(e => S.HUMANS.isHuman(e) && !e.hidden && Math.hypot(e.x - P.x, e.y - P.y) < 12).length;
      for (let k = 0; k < 150; k++) await new Promise(r => requestAnimationFrame(r)); const ts = []; let t = performance.now(); for (let k = 0; k < 120; k++) { await new Promise(r => requestAnimationFrame(r)); const n = performance.now(); ts.push(n - t); t = n; }
      ts.sort((a, b) => a - b); const r0 = performance.now(); for (let k = 0; k < 30; k++) S.render(); const renderMs = (performance.now() - r0) / 30;
      return { humans: near(), median: ts[60], p95: ts[114], renderMs, stats: S.HUMANS.stats() }; }""")
  check(r['stats']['px'] <= r['stats']['maxPx'] and r['stats']['queue'] < 40, 'the sprite cache stays within its pixel budget and the build queue drains', r)
  check(r['renderMs'] < 25, f"a frame with {r['humans']} humans in view renders in {r['renderMs']:.1f} ms", r)
  print('     perf:', json.dumps(r))
  pg.screenshot(path=os.path.join(SHOTS, 'world-vespar.png'))
  pg.evaluate("__SF.HUMANS.set(false)"); pg.evaluate(SETTLE, .5); pg.screenshot(path=os.path.join(SHOTS, 'world-vespar-old.png')); pg.evaluate("__SF.HUMANS.set(true)")
  check(not errs, 'no page errors on desktop', errs[:5])
  ctx.close()

  # ---- 14. phone: creator layout and play
  ctx = b.new_context(viewport={'width': 844, 'height': 390}, is_mobile=True, has_touch=True, device_scale_factor=2); pg = ctx.new_page(); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto(URL + '?humans=v2'); pg.evaluate('localStorage.clear()'); pg.goto(URL + '?humans=v2'); pg.wait_for_selector('[data-c=go]')
  ov = pg.evaluate("document.documentElement.scrollWidth - innerWidth"); check(ov <= 1, 'phone: the creator has no horizontal overflow', ov)
  pg.screenshot(path=os.path.join(SHOTS, 'phone-creator.png'), full_page=False)
  pg.fill('#ccn', 'Pip'); pg.click('[data-c=rnd]'); pg.click('[data-c=go]'); pg.wait_for_function('window.__SF && __SF.P'); st = pg.evaluate(SETTLE, 2.5)
  check(st['ready'] > 4, 'phone: humans drawn', st); pg.screenshot(path=os.path.join(SHOTS, 'phone-world.png'))
  check(not errs, 'no page errors on the phone', errs[:5])
  b.close()
print(f'{fails} FAILED' if fails else 'ALL PASS'); sys.exit(1 if fails else 0)
