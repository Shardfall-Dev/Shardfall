# Browser smoke run for the Magery integration (needs Python Playwright + Chrome).
# usage: python3 tests/magery-smoke/run.py Shardfall_v0.16.html [/path/to/chrome]
import sys, json, os, subprocess
from playwright.sync_api import sync_playwright
here = os.path.dirname(os.path.abspath(__file__)); f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.16.html')
chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
EXPECT = {
  'casting.js': {'held': 'magery.05', 'release': True, 'learn': True, 'held2': 'magery.18', 'expired': True, 'burst': {'hits': [2, 3.1]}},
  'spells.js': {'mind': 14, 'quake': {'b2': 46, 'self': True}, 'meteor': [11, 11, 11], 'reactiveAfter': {'pool': 15, 'houndLost': 2, 'playerLost': 0}, 'firePulsesWithinSecond': 2,
                'dispel': {'midBlocked': True, 'passAfterDispel': True}, 'immune': True, 'rebindWhileImmune': False, 'banished': True, 'creatureExpired': True, 'recall': True,
                'overweightRejected': True, 'gatePanel': 'mgate', 'invis': True, 'invisAfterMove': False, 'night': True, 'form': 'boar', 'armed': True, 'remoteSpent': True, 'opened': True, 'savedHot': {'k': 'spell', 'id': 'magery.42'}},
  'cancel.js': {'hiddenIdle': True, 'prepGone': True, 'reserved': 4, 'prepLedger': {'pearlsBack': True, 'refundOnCancel': 2}, 'held': True, 'heldGone': True, 'recovering': True, 'holdLedger': {'pearls': True, 'refundOnCancel': 0}, 'escCleared': True},
  'targeting.js': {'keptAfterMiss': True, 'releasedOnTap': True, 'scrollInterrupt': {'after': {'scroll': 1, 'manaLost': 3}}, 'scrollHeld': 'magery.12', 'scrollLeft': 0},
}
def sub(exp, got, path=''):
  bad = []
  if isinstance(exp, dict):
    for k, v in exp.items(): bad += sub(v, (got or {}).get(k), path + '.' + k)
  elif exp != got: bad.append(f'{path}: expected {exp!r}, got {got!r}')
  return bad
fails = 0
with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
  for name, exp in EXPECT.items():
    errs = []; pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + f); pg.wait_for_timeout(600); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(600)
    pg.click('[data-c=prof][data-p="Group healer"]'); pg.fill('#ccn', 'Tess'); pg.click('[data-c=go]'); pg.wait_for_timeout(1200)
    out = pg.evaluate(open(os.path.join(here, name)).read()); bad = sub(exp, out) + [f'page error: {e}' for e in errs]
    print(('ok   ' if not bad else 'FAIL ') + name); [print('     ' + x) for x in bad]; fails += len(bad); pg.close()
  b.close()
r = subprocess.run([sys.executable, os.path.join(here, 'migration.py'), f, chrome], capture_output=True, text=True); print((r.stdout.strip() or r.stderr[-400:])[:300]); fails += r.returncode != 0
print('ALL PASS' if not fails else f'{fails} FAILED'); sys.exit(1 if fails else 0)
