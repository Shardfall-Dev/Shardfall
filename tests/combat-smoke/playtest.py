# Phone play-test (844×390 landscape, touch input, the real-time game loop): a starter-area fight, self-bandaging, buying and
# using a bow with arrows, swapping weapons mid-fight, and treating Wren. Screenshots go to $COMBAT_SHOTS (default /tmp/combat-shots).
import sys, json, os
from playwright.sync_api import sync_playwright
f = os.path.abspath(sys.argv[1]); chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
shots = os.environ.get('COMBAT_SHOTS', '/tmp/combat-shots'); os.makedirs(shots, exist_ok=True)
errs, bad, out = [], [], {}
def check(c, m):
  if not c: bad.append(m)
with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
  pg = b.new_page(viewport={'width': 844, 'height': 390}, device_scale_factor=2, is_mobile=True, has_touch=True)
  pg.on('pageerror', lambda e: errs.append(str(e)))
  ev = lambda js: pg.evaluate(js)
  def tap_sel(sel):
    pg.locator(sel).first.tap(); pg.wait_for_timeout(250)          # a touch tap (scrolled into view when needed)
  def tap_ent(js_ent):
    xy = ev(f"(() => {{ const e = {js_ent}; return e ? __SF.screenOf(e) : null; }})()"); pg.touchscreen.tap(xy['x'], xy['y'] - 18); pg.wait_for_timeout(250); return xy
  def shot(n): pg.screenshot(path=os.path.join(shots, n))
  pg.goto('file://' + f); pg.wait_for_timeout(500); ev('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(600)
  tap_sel('[data-c=prof][data-p="Glaive hybrid"]'); pg.fill('#ccn', 'Pip'); tap_sel('[data-c=go]'); pg.wait_for_timeout(1200)
  # walk to the rat warren north-west of the Quay (a teleport stands in for the walk), let it populate
  ev("""() => { const S = __SF, P = S.P; for (let r = 0; r < 30; r++) for (let k = 0; k < 24; k++) { const x = 84 + Math.cos(k / 24 * 6.28) * r, y = 258 + Math.sin(k / 24 * 6.28) * r; if (!S.BLK[S.tAt(Math.floor(x), Math.floor(y))] && S.tAt(Math.floor(x), Math.floor(y)) !== S.T.WA && !S.protAt(Math.floor(x), Math.floor(y))) { P.x = Math.floor(x) + .5; P.y = Math.floor(y) + .5; return; } } }""")
  pg.wait_for_timeout(1500)
  rat = "__SF.ents.filter(e => e.kind === 'mon' && e.type === 'rat' && !e.gone).sort((a, b) => Math.hypot(a.x - __SF.P.x, a.y - __SF.P.y) - Math.hypot(b.x - __SF.P.x, b.y - __SF.P.y))[0]"
  ev(f"() => {{ const r = {rat}; if (r) {{ r.x = __SF.P.x + 3; r.y = __SF.P.y + 1; }} }}"); pg.wait_for_timeout(300)
  tap_ent(rat); tapped = ev("() => __SF.P.sel && __SF.P.sel.type")      # a moving rat can slip the tap; Attack then picks the nearest one in sight
  tap_sel('#b-atk'); sel = ev("() => __SF.P.armed && __SF.P.sel && __SF.P.sel.type"); pg.wait_for_timeout(2200); shot('1-starter-fight.png')
  # follow the rat Attack actually armed on (the nearest rat can change while they move), for up to 20 s of swings
  for _ in range(40):
    if ev("() => __SF.LOG.some(l => /You slay the dock rat/.test(l.t)) || !__SF.P.armed"): break
    pg.wait_for_timeout(500)
  out['fight'] = ev("() => ({ slain: __SF.LOG.some(l => /You slay the dock rat/.test(l.t)), swung: __SF.P.sw.t > 0, hp: Math.round(__SF.P.hp), log: __SF.LOG.filter(l => /slay|miss|Swordsmanship|Tactics|absorbed/.test(l.t)).slice(-4).map(l => l.t) })")
  out['fight']['tapped'] = tapped; out['fight']['armedOn'] = sel
  check('rat' in (tapped, sel) and out['fight']['swung'] and out['fight']['slain'], 'starter fight: tapped a rat (or Attack picked one), the glaive killed it (a halberd can one-shot a rat before we look)')
  # self-bandage from the hotbar
  ev("() => { const P = __SF.P; P.armed = false; P.hp = Math.min(P.hp, 30); }"); pg.wait_for_timeout(200)
  hp0 = ev("() => __SF.P.hp"); b0 = ev("() => __SF.SF.count(__SF.P.pack, 'bandage')")
  tap_sel('.slot[data-i="0"]'); pg.wait_for_timeout(1500); shot('2-self-bandage.png')
  out['selfBand'] = ev("() => ({ active: !!__SF.P.bandage, kind: __SF.P.bandage && __SF.P.bandage.kind, label: document.querySelector('.slot[data-i=\"0\"] b').textContent })")
  pg.wait_for_timeout(14500)
  out['selfBand']['after'] = ev(f"() => ({{ done: !__SF.P.bandage, bandages: {b0} - __SF.SF.count(__SF.P.pack, 'bandage'), log: __SF.LOG.filter(l => /bandage|heal yourself|bleeding|slip/i.test(l.t)).slice(-2).map(l => l.t) }})")
  check(out['selfBand']['active'] and out['selfBand']['after']['done'] and out['selfBand']['after']['bandages'] == 1, 'self-bandage: one tap on the hotbar, one bandage, 15 s, a result line')
  # buy a bow and arrows at Pell's, equip from the pack, shoot a rat
  ev("() => { const S = __SF, P = S.P; const n = S.ents.find(e => e.role === 'workshop'); P.x = n.x + 1; P.y = n.y + 1; P.talkTo = n; S.openPanel('shop'); }"); pg.wait_for_timeout(400)
  tap_sel('[data-a=buy][data-id=shortbow]'); tap_sel('[data-a=buy][data-id=arrow][data-n="10"]'); shot('3-bowyer.png')
  tap_sel('[data-a=close]'); tap_sel('[data-a=hudmenu]'); tap_sel('[data-a=mgo][data-p=bag]'); pg.wait_for_timeout(300)
  pg.locator('.bagcell', has_text='Shortbow').first.tap(); pg.wait_for_timeout(200); pg.locator('#panel .bagcard [data-a=equip]').first.tap(); pg.wait_for_timeout(300); tap_sel('[data-a=close]')
  out['bow'] = ev("() => ({ weapon: __SF.W.n, arrows: __SF.SF.count(__SF.P.pack, 'arrow') })")
  ev("""() => { const S = __SF, P = S.P; P.x = 84.5; P.y = 262.5; for (let r = 0; r < 30; r++) for (let k = 0; k < 24; k++) { const x = 84 + Math.cos(k / 24 * 6.28) * r, y = 258 + Math.sin(k / 24 * 6.28) * r; if (!S.BLK[S.tAt(Math.floor(x), Math.floor(y))] && S.tAt(Math.floor(x), Math.floor(y)) !== S.T.WA && !S.protAt(Math.floor(x), Math.floor(y))) { P.x = Math.floor(x) + .5; P.y = Math.floor(y) + .5; return; } } }""")
  pg.wait_for_timeout(1200)
  ev(f"() => {{ const r = {rat}; if (r) {{ r.x = __SF.P.x + 6; r.y = __SF.P.y + 2; r.hp = r.max = 120; }} }}"); pg.wait_for_timeout(200)
  tap_ent(rat); tap_sel('#b-atk'); pg.wait_for_timeout(600); shot('4-bow-aim.png'); pg.wait_for_timeout(4300); shot('5-bow-reload.png')
  out['bow']['after'] = ev("() => ({ arrows: __SF.SF.count(__SF.P.pack, 'arrow'), shotsLogged: __SF.LOG.filter(l => /Archery/.test(l.t)).length })")
  check(out['bow']['weapon'] == 'Bow' and out['bow']['arrows'] == 10 and 1 <= 10 - out['bow']['after']['arrows'] <= 3, 'bought a shortbow and 10 arrows, equipped from the pack, each release spends one arrow')
  # swap to the glaive mid-fight from the pack
  tap_sel('[data-a=hudmenu]'); tap_sel('[data-a=mgo][data-p=bag]'); pg.wait_for_timeout(300)
  pg.locator('.bagcell', has_text='glaive').first.tap(); pg.wait_for_timeout(200); pg.locator('#panel .bagcard [data-a=equip]').first.tap(); pg.wait_for_timeout(300); tap_sel('[data-a=close]')
  out['swap'] = ev("() => ({ weapon: __SF.W.n, ready: __SF.P.sw.ready, armed: __SF.P.armed, arrowsKept: __SF.SF.count(__SF.P.pack, 'arrow') })")
  pg.wait_for_timeout(3500); shot('6-swap-glaive.png')
  check(out['swap']['weapon'] == 'Halberd', 'swapped back to the glaive mid-fight from the pack')
  # treat another patient: Wren at the Quay
  ev("() => { const S = __SF, P = S.P, w = S.allyOf(); P.skills.healing.v = 900; P.skills.anatomy.v = 600; P.armed = false; P.sel = null; P.x = w.x - 1.2; P.y = w.y; w.hp = Math.min(w.hp, 40); }"); pg.wait_for_timeout(800)
  tap_ent("__SF.allyOf()"); pg.wait_for_timeout(300); shot('7-wren-target.png')
  btn = ev("() => (document.querySelector('#tgt [data-a=bandother]') || {}).textContent")
  wh = ev("() => __SF.allyOf().hp"); tap_sel('#tgt [data-a=bandother]'); pg.wait_for_timeout(1200); shot('8-bandage-wren.png')
  out['other'] = ev("() => ({ active: !!__SF.P.bandage, patient: __SF.P.bandage && __SF.P.bandage.e.name, dur: __SF.P.bandage && __SF.P.bandage.t1 - __SF.P.bandage.t0 })")
  pg.wait_for_timeout(4500)
  out['other']['after'] = ev(f"() => ({{ hpGain: Math.round(__SF.allyOf().hp - {wh}), log: __SF.LOG.filter(l => /Wren/.test(l.t)).slice(-1).map(l => l.t) }})"); out['other']['button'] = btn
  check(btn == 'Bandage Wren' and out['other']['active'] and out['other']['patient'] == 'Wren' and out['other']['dur'] == 5 and out['other']['after']['hpGain'] >= 33 and 'You heal Wren for' in ''.join(out['other']['after']['log']), 'tapped Wren, pressed Bandage Wren (as a 90/60 healer): a 5 s application that heals her')
  # ask Wren to follow and fight together
  tap_sel('#tgt [data-a=allycmd]'); out['follow'] = ev("() => __SF.allyOf().order")
  check(out['follow'] == 'follow', 'Wren follows on request')
  shot('9-wren-follows.png')
  b.close()
bad += [f'page error: {e}' for e in errs]
print(('ok   phone play-test: ' if not bad else 'FAIL phone play-test: ') + json.dumps(out)[:1400] + ''.join('\n     ' + x for x in bad)); sys.exit(1 if bad else 0)
