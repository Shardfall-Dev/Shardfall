# Anniabreen v1.0 browser checks (Playwright + Chrome): a scripted playthrough with measured walking times,
# touch and mouse movement over a bridge, the moongate picker by tap and click, saved position after reload,
# the v3 → v4 save migration, and phone-size map captures.
# usage: python3 tests/anniabreen-smoke/run.py Shardfall_v0.20.html [/path/to/chrome] [--shots DIR]
import sys, json, os
from playwright.sync_api import sync_playwright
here = os.path.dirname(os.path.abspath(__file__)); f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('--') else 'Shardfall_v0.20.html')
chrome = next((a for a in sys.argv[2:] if a.startswith('/') and 'chrome' in a), '/usr/bin/google-chrome')
shots = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None
WALK = open(os.path.join(here, 'walker.js')).read(); PLAY = open(os.path.join(here, 'playthrough.js')).read()
fails = []
def check(c, msg):
  print(('PASS ' if c else 'FAIL ') + msg)
  if not c: fails.append(msg)
def new_char(pg, prof='Merchant smith'):
  pg.goto('file://' + f); pg.wait_for_timeout(400); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(400)
  pg.click(f'[data-c=prof][data-p="{prof}"]'); pg.fill('#ccn', 'Tess'); pg.click('[data-c=go]'); pg.wait_for_timeout(1200)
def run(pg, body): return pg.evaluate('() => {' + WALK + body + '; return out; }')
with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
  pg = b.new_page(viewport={'width': 1280, 'height': 720}); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'net::' not in m.text else None)
  new_char(pg); o = run(pg, PLAY); print(json.dumps(o, indent=1))
  W = lambda k: o[k]['ok'] if isinstance(o.get(k), dict) and 'ok' in o[k] else False
  rng = lambda k, a, b: W(k) and a <= o[k]['t'] <= b
  check(o['start']['zone'] == 'quay' and o['start']['quaywarden'], 'new characters still start at Saltmarsh Quay with the Quaywarden')
  check(o['packetOut']['zone'] == 'vespar', 'Quay packet sails to Vespar')
  for k in ['route1', 'route2', 'eastBank']: check(W(k), f'Vespar walk {k} completes (bridges and quay passable)')
  check(o['inVesparBank'], 'route 1 ends inside the Vespar bank through its door')
  check(rng('forgeToMarket', 60, 90), f"Mynoc forge → Vespar market by cart road 60–90 s (got {o['forgeToMarket']})")
  check(rng('marketToForge', 60, 90), f"Vespar market → Mynoc forge 60–90 s (got {o['marketToForge']})")
  check(o['forgeToOre']['ok'] and 15 <= o['forgeToOre']['t'] <= 25, f"forge → first ore face 15–25 s (got {o['forgeToOre']})")
  check(o['mined'] >= 3, f"mined ore at the first face ({o['mined']})"); check(W('oreToForge'), 'walked back to the forge')
  check(o['smelted'] >= 1, 'smelted an iron bar at the Mynoc forge'); check(W('forgeToBank') and o['bankPanel'] == 'bank' and o['deposited'] >= 1, 'deposited the bar at the Mynoc bank')
  check(rng('landingToFork', 38, 52), f"Skara landing → forest fork about 45 s (got {o['landingToFork']})")
  check(rng('forkToForge', 60, 90), f"fork → Mynoc 60–90 s (got {o['forkToForge']})"); check(rng('forkToVespar', 60, 90), f"fork → Vespar 60–90 s (got {o['forkToVespar']})")
  check(W('forgeToFork') and W('forkToLanding'), 'Mynoc → fork → Skara landing walks complete')
  check(o['ferryOut'][0] < 182 and o['ferryBack'][0] > 184 and o['ferryOut2'][0] < 182, f"Skara ferry works both ways ({o['ferryOut']} {o['ferryBack']})")
  check(W('pierToTree') and W('toOrchardGate'), 'island walk: jetty → old tree → orchard gate')
  check(o['pickerOpens'] == 'mgpick' and o['cancelled']['panel'] is None, 'stepping into a gate opens the picker; Cancel closes it and you stay')
  check(o['reopens'] == 'mgpick', 'leaving and re-entering the gate opens the picker again')
  check(o['gateArrive']['zone'] == 'moonglen' and o['gateArrive']['distFromGate'] > 1.9 and o['noReopen'], f"gate lands on clear ground beside Moonglen's gate without reopening ({o['gateArrive']})")
  check(rng('harborToCourt', 20, 30), f"Moonglen harbor → college courtyard 20–30 s (got {o['harborToCourt']})")
  check(W('gateToCourt') and W('courtToObservatory') and W('loopToHarbor'), 'Moonglen: gate → courtyard, far arch → observatory, herb-garden loop → harbour')
  check(o['boatBack']['zone'] == 'vespar' and o['packetHome']['at'][0] < 60 and abs(o['packetHome']['at'][1] - 288.6) < .2, 'boat Moonglen → Vespar and packet Vespar → Quay pier')
  check(o['packetAgain'][0] > 1000 and o['boatOut'][1] > 760, 'packet Quay → Vespar and boat Vespar → Moonglen')
  check(o['mgPicker'] == 'mgpick' and o['atCross']['zone'] in ('vale', 'fields') and o['crossNoReopen'], f"Moonglen gate → Miner's Cross ({o['atCross']})")
  check(o['crossSign'] == ['↖ Mynoc Mine', 'Vespar Docks ↘'], 'Miner’s Cross sign reads Mynoc Mine / Vespar Docks')
  check(o['crossPicker'] == 'mgpick' and o['atSkara']['zone'] == 'skara', 'Interact at Miner’s Cross opens the picker; Skara Bryn gate lands in the orchard')
  # saved position after reload
  pg.evaluate('() => { const S = __SF, P = S.P; P.x = 905.5 + 640; P.y = 597.5; S.save(); }'); pg.reload(); pg.wait_for_timeout(500); pg.click('[data-c=cont]'); pg.wait_for_timeout(900)
  r = pg.evaluate('() => [__SF.P.x - 640, __SF.P.y, __SF.zoneAt(Math.floor(__SF.P.x), Math.floor(__SF.P.y))]'); check(abs(r[0] - 905.5) < .01 and abs(r[1] - 597.5) < .01 and r[2] == 'vespar', f'position saved and restored in Vespar after reload {r}')
  # v3 save migration: tile-keyed node and survey records move to the wider grid
  m = pg.evaluate('''() => { const S = __SF; const k = 281 * 600 + 74; const s = { v: 3, char: { cx: { survey: { [k]: { gen: 1, id: 'iron' } } } }, nodes: [[k, 1, 'iron', 3, 8, 0]] };
    S.migrateSave(s, null); return [s.v, s.nodes[0][0], Object.keys(s.char.cx.survey)[0], 281 * S.GW + 74]; }''')
  check(m[0] == 4 and m[1] == m[3] and int(m[2]) == m[3], f'v3 saves migrate node and survey keys to the wider grid {m}')
  if shots:
    for name, (x, y) in {'vespar_bridges': (939, 586), 'mynoc_yard': (563, 303), 'mine_chamber': (615, 214), 'skara_ferry': (184, 644), 'moonglen_court': (1265, 640), 'moonglen_gate': (1205, 607), 'forest_fork': (482, 686), 'miners_cross': (679, 398), 'observatory': (1264, 450), 'waterwheel': (731, 445)}.items():
      pg.evaluate(f'() => {{ __SF.P.x = {x} + 640.5; __SF.P.y = {y} + .5; __SF.update(.01); }}'); pg.wait_for_timeout(300); pg.screenshot(path=os.path.join(shots, name + '.png'))
  check(not errs, 'no page errors ' + '; '.join(errs[:3]))
  pg.close()
  # phone: touch-drag across Vespar's stone bridge, mouse-drag back; tap the moongate picker; map at phone size
  ctx = b.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True, device_scale_factor=2); pg = ctx.new_page()
  new_char(pg); pg.evaluate('() => { const S = __SF; for (const sp of S.SPAWNS) sp.next = 1e12; S.P.x = 862.5 + 640; S.P.y = 591.5; S.update(.01); }')
  cdp = ctx.new_cdp_session(pg)
  def touch_drag(x0, y0, dx, dy, ms):
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y0}]})
    for i in range(1, 6): cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 + dx * i / 5, 'y': y0 + dy * i / 5}]})
    pg.wait_for_timeout(ms); cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
  x0 = pg.evaluate('() => __SF.P.x - 640'); touch_drag(150, 250, 54, 27, 5200); x1 = pg.evaluate('() => [__SF.P.x - 640, __SF.P.y]')
  check(x0 < 864 and x1[0] > 892, f'touch stick carries the player east across the stone bridge ({x0:.1f} → {x1[0]:.1f}, y {x1[1]:.1f})')
  pg.mouse.move(150, 250); pg.mouse.down(); pg.mouse.move(96, 223, steps=5); pg.wait_for_timeout(5200); pg.mouse.up(); x2 = pg.evaluate('() => __SF.P.x - 640')
  check(x2 < 864, f'mouse-drag stick carries the player back west over the bridge ({x2:.1f})')
  pg.evaluate('() => { const S = __SF, g = S.ANN.gates[0]; S.P.x = g.x; S.P.y = g.y; S.update(.05); S.update(.05); }'); pg.wait_for_timeout(200)
  btns = pg.locator('#panel [data-a=mgto]'); check(btns.count() == 2, 'moongate picker lists the two other gates')
  if shots: pg.screenshot(path=os.path.join(shots, 'phone_picker.png'))
  btns.nth(0).tap(); pg.wait_for_timeout(200); z = pg.evaluate('() => __SF.zoneAt(Math.floor(__SF.P.x), Math.floor(__SF.P.y))'); check(z == 'skara', f'tapping a destination travels ({z})')
  pg.evaluate('() => { __SF.ACT.map(); }'); pg.wait_for_timeout(400)
  if shots: pg.screenshot(path=os.path.join(shots, 'phone_map.png'))
  pg.click('#mapScr [data-a=mapall]'); pg.wait_for_timeout(200)
  if shots: pg.screenshot(path=os.path.join(shots, 'phone_map_world.png'))
  pg.click('#mapScr [data-a=scrclose]'); pg.wait_for_timeout(200); check(pg.evaluate('() => __SF.SCREEN') is None and pg.is_hidden('#mapScr'), 'closing the map restores the game view')
  b.close()
print('ALL PASS' if not fails else f'{len(fails)} FAILED'); sys.exit(1 if fails else 0)
