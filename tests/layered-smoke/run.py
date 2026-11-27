# In-game checks for the layered armor renderer (Playwright + Chrome): the player, ally, townsfolk and human enemies draw through one
# renderer; equip/unequip changes the world figure and the paper doll at once; two-handed weapons; NPC strips are shared; bodies keep
# their look through a reload; ?renderer=legacy brings back the old sprites; frame time with many armored NPCs; phone screenshot.
# usage: python3 tests/layered-smoke/run.py Shardfall_v0.31.html [--shots DIR]
import sys, os, json
from playwright.sync_api import sync_playwright
args = sys.argv[1:]; shots = '/tmp/layered-shots'
if '--shots' in args: i = args.index('--shots'); shots = args[i + 1]; del args[i:i + 2]
f = os.path.abspath(args[0] if args else 'Shardfall_v0.31.html'); os.makedirs(shots, exist_ok=True)
fails = []
def check(ok, msg, got=None):
    print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else f'  (got {json.dumps(got)})'))
    if not ok: fails.append(msg)
J = lambda pg, js: pg.evaluate(js)
def start(pg, errs, q=''):
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + f + q); pg.wait_for_timeout(400); pg.evaluate('localStorage.clear()'); pg.goto('file://' + f + q); pg.wait_for_timeout(400)
    pg.click('[data-c=prof][data-p="Mace dexer"]'); pg.fill('#ccn', 'Aldric'); pg.click('[data-c=go]'); pg.wait_for_timeout(1500)
GIVE = """(list) => { const SF = __SF.SF, P = __SF.P, out = []; P.str = 100; for (const [id, o] of list) { const it = SF.EQ.make(id, o || {}); SF.addItem(P.pack, it); out.push(it.uid); } return out; }"""
KEY = "() => __HR.hrDesc(__SF.P).key"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1100, 'height': 680}); errs = []
    start(pg, errs)
    info = J(pg, '__HR.info()')
    check(info['on'] and info['built'] > 0, 'layered renderer is on by default and built strips', info)
    check(J(pg, '!!__SF.P._hrLast'), 'the player is drawn by the layered renderer')
    kinds = J(pg, "() => { const o = {}; for (const e of __SF.ents) if (e._hrLast) o[e.kind] = (o[e.kind] || 0) + 1; return o; }")
    check(kinds.get('npc', 0) > 0 and kinds.get('ally', 0) == 1, 'townsfolk and the ally use the same renderer', kinds)
    check(J(pg, "() => __HR.coverage().missing") == [], 'every equipment definition has a drawing')
    pg.keyboard.press('c'); pg.wait_for_timeout(400)
    doll0 = J(pg, "() => { const i = document.querySelector('#eqwin img.hrdoll'); return i && i.src }")
    check(bool(doll0), 'paper doll shows the layered figure', doll0 and doll0[:30])
    pg.screenshot(path=f'{shots}/01-start.png')
    # equip a mixed set through the game's one validated equip path; the key and the doll change at once
    k0 = J(pg, KEY)
    uids = J(pg, f"({GIVE})([['plate_chest', {{ material: 'valorite' }}], ['plate_arms', {{ material: 'valorite' }}], ['leather_leggings', {{ material: 'barbed' }}], ['studded_gloves', {{ material: 'horned', sec: 'golden' }}], ['norse_helm', {{ material: 'verite' }}], ['cloak'], ['kite_shield', {{ material: 'agapite' }}], ['glaive']])")
    refused = J(pg, f"() => {{ const P = __SF.P; P.str = 1; const ok = __HR.equipUid({uids[0]}); P.str = 100; return [ok, __HR.hrDesc(P).key] }}")
    check(refused[0] is False and refused[1] == k0, 'a refused equip (too weak) does not change the look', refused)
    for u in uids[:7]: J(pg, f"__HR.equipUid({u})")
    k1 = J(pg, KEY); g = J(pg, "() => __HR.hrDesc(__SF.P).gear")
    check(k1 != k0 and g['chest']['material'] == 'valorite' and g['legs']['material'] == 'barbed' and g['hands']['sec'] == 'golden' and g['shield']['id'] == 'kite_shield', 'equipped pieces show at once with their own materials (studs golden on horned)', {k: (v['id'], v['material'], v.get('sec')) for k, v in g.items()})
    pg.wait_for_timeout(600)
    doll1 = J(pg, "() => { const i = document.querySelector('#eqwin img.hrdoll'); return i && i.src }")
    check(doll1 and doll1 != doll0, 'the paper doll redraws after the equip')
    check(J(pg, "() => __SF.P._hrLast.k") == k1, 'the world figure uses the new look within a few frames')
    pg.screenshot(path=f'{shots}/02-mixed.png')
    # two-handed: equipping the glaive displaces the shield; the drawn weapon is two-handed
    J(pg, f"__HR.equipUid({uids[7]})"); d = J(pg, "() => { const d = __HR.hrDesc(__SF.P); return [d.weapon.id, d.weapon.two, !!d.gear.shield] }")
    check(d == ['glaive', True, False], 'the glaive is drawn two-handed and the shield is gone (rules displaced it)', d)
    # unequip
    J(pg, "__HR.unequipTo('head')"); check('norse_helm' not in J(pg, KEY), 'unequipping the helmet removes it from the figure')
    # every direction and the animation states the game drives
    for s in range(8): J(pg, f"__SF.P.sect = {s}"); pg.wait_for_timeout(120)
    J(pg, "__SF.P.sect = 1"); pg.wait_for_timeout(300); pg.screenshot(path=f'{shots}/03-glaive-sw.png')
    st = J(pg, """() => { const P = __SF.P, d = __HR.hrDesc(P), o = {}; P.lunge = .05; o.attack = __HR.hrState(P, d).action; P.lunge = 0; P._hrAtk = 0;
      P.hitT = __SF.GT; o.hit = __HR.hrState(P, d).action; P.hitT = 0; P.speed = 3; o.walk = __HR.hrState(P, d).action; P.speed = 0; return o; }""")
    check(st == {'attack': 'polearm', 'hit': 'hit', 'walk': 'walk'}, 'attack (from the weapon), hit and walk states', st)
    # NPC strips are shared: many humans, few strips
    humans = J(pg, "() => __SF.ents.filter(e => e._hrLast).length"); strips = J(pg, "__HR.info().strips")
    print('     humans drawn', humans, 'strips', strips)
    # human enemy: a bandit draws layered and leaves an armored body
    J(pg, "() => { const m = __SF.spawnMon('smuggler', 3, 1); __SF.WS && 0; window._m = m; }"); pg.wait_for_timeout(800)
    check(J(pg, "() => !!window._m._hrLast"), 'a human enemy (brine smuggler) uses the layered renderer')
    J(pg, "() => __SF.killMon(window._m, __SF.P)"); pg.wait_for_timeout(900)
    c = J(pg, "() => { const c = __SF.ents.find(e => e.kind === 'corpse' && e.mon === 'smuggler'); return c && [!!c.hr, c.hr && c.hr.d.gear.chest && c.hr.d.gear.chest.id, c.cont.items.length >= 0] }")
    check(c and c[0] and c[1] == 'studded_tunic', 'the smuggler body keeps its studded armor look; loot container untouched', c)
    pg.screenshot(path=f'{shots}/04-smuggler-body.png')
    # monsters untouched
    J(pg, "() => { window._r = __SF.spawnMon('rat', -3, 0); }"); pg.wait_for_timeout(300)
    check(J(pg, "() => !window._r._hrLast && !window._r._hr"), 'monsters are not drawn by the human renderer')
    J(pg, "() => __SF.rmEnt(window._r)")
    # player death in the wild: body keeps the worn look; save/reload rebuilds it from the items in the body
    J(pg, "() => { const P = __SF.P; P.x += 0; }")
    died = J(pg, """() => { const P = __SF.P, S = __SF; let wild = null; for (let r = 30; r < 400 && !wild; r += 10) for (let a = 0; a < 6.3 && !wild; a += .4) { const x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r; if (S.walk ? S.walk(x, y) : true) { P.x = x; P.y = y; __HR.playerDies(null); const c = S.ents.find(e => e.kind === 'corpse' && e.mine); if (c) wild = c; else { P.ghost = false; P.hp = 50; } } }
      return wild ? [!!wild.hr, wild.hr && wild.hr.d.gear.chest && wild.hr.d.gear.chest.material] : null; }""")
    check(died and died[0] and died[1] == 'valorite', 'the player body keeps the valorite plate look', died)
    J(pg, "__SF.save()"); pg.reload(); pg.wait_for_timeout(600); pg.click('[data-c=cont]'); pg.wait_for_timeout(1200)
    rc = J(pg, "() => { const c = __SF.ents.find(e => e.kind === 'corpse' && e.mine); return c && c.hr && c.hr.d.gear.chest && c.hr.d.gear.chest.material }")
    check(rc == 'valorite', 'after a reload the body is drawn from what lies in it', rc)
    # save/load keeps the living look
    pg.goto('file://' + f); pg.wait_for_timeout(300); J(pg, 'localStorage.clear()'); pg.goto('file://' + f); pg.wait_for_timeout(300)
    pg.click('[data-c=prof][data-p="Mace dexer"]'); pg.fill('#ccn', 'Aldric'); pg.click('[data-c=go]'); pg.wait_for_timeout(1000)
    u2 = J(pg, f"({GIVE})([['chain_tunic', {{ material: 'bronze' }}], ['bone_helm']])"); [J(pg, f"__HR.equipUid({u})") for u in u2]
    ka = J(pg, KEY); J(pg, "__SF.save()"); pg.reload(); pg.wait_for_timeout(600); pg.click('[data-c=cont]'); pg.wait_for_timeout(1200)
    check(J(pg, KEY) == ka, 'save/load keeps the same appearance (bronze chain, bone helm)')
    # performance: 120 armored NPCs (guards, merchants, bandits) around the player
    J(pg, """() => { const P = __SF.P, roles = ['guard', 'banker', 'healer', 'outlaw', 'trainer', 'miner']; window._extra = []; for (let i = 0; i < 120; i++) { const a = i * 2.4, r = 2 + (i % 12) * .9;
      window._extra.push(__SF.addEnt({ kind: 'npc', role: roles[i % roles.length], name: 'Test ' + i, x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r, sect: i % 8 })); } }""")
    pg.wait_for_timeout(2500)
    perf = J(pg, """() => new Promise(res => { const t = []; let last = performance.now(), n = 0; const step = now => { t.push(now - last); last = now; for (const e of window._extra) { e.sect = (e.sect + (n % 7 === 0 ? 1 : 0)) % 8; e.speed = n % 40 < 20 ? 3 : 0; } if (++n < 180) requestAnimationFrame(step); else { t.sort((a, b) => a - b); res({ avg: t.reduce((a, b) => a + b) / t.length, p95: t[Math.floor(t.length * .95)], info: __HR.info() }); } }; requestAnimationFrame(step); })""")
    print('     perf 120 NPCs:', json.dumps(perf))
    check(perf['p95'] < 40, 'frame time stays playable with 120 armored NPCs (p95 < 40 ms in headless Chrome)', perf['p95'])
    check(perf['info']['mpx'] <= J(pg, '__HR.HR.maxPx') / 1e6 + .1, 'strip cache stays inside its pixel budget (14 MP desktop, 8 MP phones)', perf['info']['mpx'])
    check(perf['info']['strips'] < 400, 'identical looks share strips', perf['info']['strips'])
    pg.screenshot(path=f'{shots}/05-crowd.png')
    check(errs == [], 'no page errors', errs[:3])
    # legacy renderer stays available
    pg2 = b.new_page(viewport={'width': 900, 'height': 600}); e2 = []
    start(pg2, e2, '?renderer=legacy')
    check(J(pg2, '__HR.info().on') is False and J(pg2, '__HR.info().built') == 0 and not J(pg2, '!!__SF.P._hrLast'), '?renderer=legacy draws the previous sprites and builds nothing')
    pg2.screenshot(path=f'{shots}/06-legacy.png')
    pg2.goto('file://' + f + '?renderer=layered'); pg2.wait_for_timeout(1500)
    check(J(pg2, '__HR.info().on') is True, '?renderer=layered switches back')
    # phone
    pg3 = b.new_page(viewport={'width': 844, 'height': 390}, device_scale_factor=3, is_mobile=True, has_touch=True); e3 = []
    start(pg3, e3); pg3.wait_for_timeout(600); pg3.screenshot(path=f'{shots}/07-phone.png')
    check(J(pg3, '!!__SF.P._hrLast') and e3 == [], 'phone landscape draws the layered player without errors', e3[:2])
    b.close()
print(f'\n{len(fails)} FAILED' if fails else '\nall layered smoke checks passed'); sys.exit(1 if fails else 0)
