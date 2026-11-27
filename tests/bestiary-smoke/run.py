# Bestiary browser smoke run (needs Python Playwright + Chrome).
# usage: python3 tests/bestiary-smoke/run.py Shardfall_v0.18.html [/path/to/chrome] [screenshot-dir]
# Checks, in the built single-file game: all sheets decode at 800x1280, cells draw pixel-exact (Lich Lord rim intact),
# the attack row matches each of the eight approach directions, and live chase → wind-up → impact → recover poses.
# If assets/bestiary/v1/*.png are extracted next to preview.html, it also screenshots the preview for every facing.
import sys, json, os
from playwright.sync_api import sync_playwright
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(os.path.dirname(here))
f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.18.html')
chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
shots = sys.argv[3] if len(sys.argv) > 3 else None
man = json.load(open(os.path.join(root, 'assets/bestiary/v1/manifest.json'))); ids = [m['id'] for m in man['mobs']]
A = man['animations']; ci = A['attack']['contactIndex']
fails = []
def check(name, ok, detail=''):
  print(('ok   ' if ok else 'FAIL ') + name + (('  ' + detail) if detail and not ok else '')); ok or fails.append(name)
with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
  errs = []; pg = b.new_page(viewport={'width': 1280, 'height': 720}); pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto('file://' + f); pg.wait_for_timeout(600); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(600)
  pg.evaluate("o => __CC.quick(o)", {'name': 'Tess', 'template': 'mage'}); pg.wait_for_timeout(1200)
  out = pg.evaluate(open(os.path.join(here, 'scenario.js')).read())
  W, H = man['frame']['width'] * len(man['columns']), man['frame']['height'] * len(man['rows'])
  for id in ids:
    check(f'{id}: sheet loads {W}x{H}', out['loaded'].get(id) == [W, H], str(out['loaded'].get(id)))
    px = out['pixelExact'][id]; check(f'{id}: 40 cells draw pixel-exact', px['cells'] == 40 and px['diffBytes'] == 0, str(px))
    check(f'{id}: attack row follows all 8 approach directions', out['facing'][id] == list(range(8)), str(out['facing'][id]))
    c = out['combat'][id]
    check(f'{id}: idle uses neutral column', c['idleCol'] == A['idle']['frames'][0], str(c['idleCol']))
    check(f'{id}: chase plays walk columns', c['walkCols'] == sorted(set(A['walk']['frames'])), str(c['walkCols']))
    check(f'{id}: wind-up column during telegraph', c['windupCol'] == A['attack']['frames'][ci - 1], str(c['windupCol']))
    check(f'{id}: impact column on strike resolution', c['struck'] and c['impactCol'] == A['attack']['frames'][ci], str(c))
    check(f'{id}: recover column after impact', c['recoverCol'] == A['attack']['frames'][ci + 1], str(c['recoverCol']))
    check(f'{id}: facing locked through the attack', c['rowLocked'], json.dumps(c.get('lockFail')))
    check(f'{id}: drawn by the in-game renderer', c['drawn'])
    check(f'{id}: strikes land on the player through combat', c['hpEvents'] > 0 and not c.get('died'), str(c['hpEvents']))
  check('Lich Lord turquoise rim present', out['lichRim']['teal'] > 50, str(out['lichRim']))
  print('     strikes / hits on the player per creature:', {k: f"{v.get('strikes', 0)}/{v['hpEvents']}" for k, v in out['combat'].items()})
  if shots:
    os.makedirs(shots, exist_ok=True)
    # in-game line-up: every creature around the player, mixed facings and poses
    pg.evaluate('''() => { const S = window.__SF, P = S.P; for (const e of S.ents) if (e.kind === 'mon') e.gone = true;
      S.BESTIARY.mobs.forEach((m, i) => { const a = i / 11 * Math.PI * 2; const e = S.spawnMon(m.id, Math.cos(a) * 4.2, Math.sin(a) * 4.2); e.sect = i % 8; e.state = 'idle';
        if (i % 3 === 1) { e.state = 'tele'; e.st = S.GT; e.atkRow = e.sect; e.mode = 'melee'; } if (i % 3 === 2) e.impactT = S.GT; });
      S.MON.lich_lord.aggro = 0; for (const e of S.ents) if (e.kind === 'mon') { e.aiOff = true; } S.render(); }''')
    pg.screenshot(path=os.path.join(shots, 'ingame-lineup.png'))
    # in-game walking: one creature chasing the player across frames
    for k, id in enumerate(['orc', 'lich_lord']):
      pg.evaluate(f'''() => {{ const S = window.__SF, P = S.P; for (const e of S.ents) if (e.kind === 'mon') e.gone = true; const m = window.__shot = S.spawnMon('{id}', -3, -4); m.target = P; m.state = 'chase';
        for (let i = 0; i < 14; i++) {{ P.hp = 1e6; S.update(.02); P.hp = S.SF.maxHp(P); }} S.render(); }}''')
      pg.screenshot(path=os.path.join(shots, f'ingame-walk-{id}.png'))
      pg.evaluate('''() => { const S = window.__SF, P = S.P; const m = window.__shot; for (let i = 0; i < 200 && m.state !== 'tele'; i++) { P.hp = 1e6; S.update(.02); P.hp = S.SF.maxHp(P); } S.render(); }''')
      pg.screenshot(path=os.path.join(shots, f'ingame-windup-{id}.png'))
  check('no page errors', not errs, '; '.join(errs[:3]))
  pg.close()
  prev = os.path.join(root, 'assets/bestiary/v1/preview.html')
  if os.path.exists(os.path.join(root, 'assets/bestiary/v1/ettin.png')):
    pg = b.new_page(viewport={'width': 1110, 'height': 760}); perr = []; pg.on('pageerror', lambda e: perr.append(str(e)))
    pg.goto('file://' + prev); pg.wait_for_timeout(800)
    missing = pg.evaluate("[...document.querySelectorAll('figcaption')].filter(c => c.textContent.includes('unavailable')).length")
    check('preview: all 11 sheets available', missing == 0, f'{missing} missing')
    for act in ['Walk', 'Attack']:
      for d, name in enumerate(man['rows']):
        pg.select_option('#dir', str(d)); pg.select_option('#act', act); pg.wait_for_timeout(260)
        if shots: pg.screenshot(path=os.path.join(shots, f'preview-{act.lower()}-{d}-{name}.png'), full_page=True)
    check('preview: no page errors', not perr, '; '.join(perr[:3]))
  else: print('skip preview (extract assets/bestiary/Shardfall_Bestiary_v1.0.0.zip at the repo root first)')
  b.close()
print('ALL PASS' if not fails else f'{len(fails)} FAILED'); sys.exit(1 if fails else 0)
