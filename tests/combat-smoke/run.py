# Browser scenarios for the T2A combat and First Aid rework (issue #3). Needs Python Playwright + Chrome.
# usage: python3 tests/combat-smoke/run.py Shardfall_v0.18.html [/path/to/chrome] [old build for the save migration, e.g. main's Shardfall_v0.16.html]
import sys, json, os, subprocess
from playwright.sync_api import sync_playwright
here = os.path.dirname(os.path.abspath(__file__)); f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.18.html')
chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
PRE = open(os.path.join(here, 'prelude.js')).read()
SW = lambda d: {'sword': 'swordsmanship', 'battleaxe': 'swordsmanship', 'mace': 'macefighting', 'dagger': 'fencing', 'fists': 'wrestling', 'shortbow': 'archery', 'crossbow': 'archery'}
EXPECT = {
  'weapons.js': {'intervalsMatch': True, 'skills': SW(0), 'allDamaged': True, 'ammo': [17, 17], 'pvpOk': True},
  'archery.js': {'release': {'arrows': 9, 'inFlight': 1, 'hpBefore': True, 'hpAt09': True, 'hpAt11': True}, 'pursuit': {'moved': True, 'readyWhileMoving': True, 'arrowsWhileMoving': True, 'aimDelay': 0.5, 'oneArrow': True},
                 'moveInFlight': {'arrows': 1, 'noDamage': True, 'wide': True}, 'repeatTaps': 1, 'losRelease': {'fired': False, 'arrows': 0, 'ready': True}, 'rangeRelease': {'fired': False, 'arrows': 0},
                 'blocked': {'label': True, 'noDamage': True}, 'miss': {'label': True, 'blocked': False}, 'deadBefore': {'arrows': 1, 'log': 'Your target fell before the shot landed.'},
                 'empty': {'ready': True, 'warned': True}, 'xbowArrows': False, 'xbowBolt': [True, 2, 5], 'hxbowInterval': 7.5},
  'swaps.js': {'swapDuring': {'readyAfterEquip': False, 'wait': 1.25}, 'cycle': {'fistsReadyAfter': 1.5, 'glaiveSwungAt': 1.55, 'plainGlaive': 3.0},
               'readiness': {'readyBefore': True, 'keptOnRetarget': True, 'held': True, 'keptWhileHeld': True, 'swungWhileHeld': True}, 'prepBlocks': True},
  'mace.js': {'miss': {'stam': 55, 'cond': 100}, 'hit': {'stamLost': 3, 'cond': 97}, 'creatureStamLost': 3, 'sword': {'stamLost': 0, 'cond': 99.8}, 'toPlayer': {'lost': 23, 'expect': 23}},
  'firstaid.js': {'fullHp': {'spent': 0, 'log': 'You are not hurt.'}, 'self': {'spent': 1, 'dur': 15.0, 'kind': 'heal', 'doneEarly': False, 'healed': 43, 'log': 'You heal yourself for 43 HP.'},
                  'slips': {'healed': 35, 'log': 'You heal yourself for 35 HP (2 slips).'}, 'whileActive': {'stillBandaging': True, 'swung': True, 'done': True}, 'movedWhileBandaging': True,
                  'other': {'button': 'Bandage', 'dur': 5.0, 'healed': 43, 'log': 'You heal Wren for 43 HP.'}, 'outOfReach': {'healed': False, 'log': 'Wren moved out of reach; the bandage is wasted.'},
                  'changed': {'healed': True, 'log': 'Wren was poisoned before you finished; this bandage was for wounds.'},
                  'cure': {'dur': 6.0, 'low': {'cured': False, 'log': 'Curing poison needs 60 Healing and 60 Anatomy. The bandage does nothing.'}, 'at60': {'cured': True, 'hpSame': True, 'log': 'You cure Wren of poison.'}, 'fail60': 'You fail to cure the poison.', 'selfDur': 18.0, 'selfCured': True},
                  'ghost': {'ghost': True, 'body': True, 'armorOnBody': True, 'button': 'Resurrect', 'dur': 10.0, 'low': {'still': True, 'log': 'Resurrection needs 80 Healing and 80 Anatomy. The ghost stays a ghost.'}, 'fail80': True,
                            'res': {'alive': True, 'hp': 20, 'max': 80, 'armor': 'leather_tunic', 'weapon': 'sword', 'bodyGone': True}}},
}
def sub(exp, got, path=''):
  bad = []
  if isinstance(exp, dict):
    for k, v in exp.items(): bad += sub(v, (got or {}).get(k) if isinstance(got, dict) else None, path + '.' + k)
  elif isinstance(exp, float) and isinstance(got, (int, float)):
    if abs(exp - got) > .051: bad.append(f'{path}: expected {exp!r}, got {got!r}')
  elif exp != got: bad.append(f'{path}: expected {exp!r}, got {got!r}')
  return bad
def new_char(pg, prof='Glaive hybrid', name='Tess'):
  pg.goto('file://' + f); pg.wait_for_timeout(500); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(500)
  pg.evaluate("o => __CC.quick(o)", {'name': name, 'template': {'Glaive hybrid': 'swordsman', 'Mace dexer': 'maceman', 'Merchant smith': 'blacksmith'}.get(prof, 'swordsman')}); pg.wait_for_timeout(900)
  if prof == 'Glaive hybrid': pg.evaluate(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'legacy-profile.js')).read())
fails = 0; report = {}
with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
  for name, exp in EXPECT.items():
    errs = []; pg = b.new_page(viewport={'width': 844, 'height': 390}, is_mobile=True, has_touch=True)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    new_char(pg)
    src = open(os.path.join(here, name)).read().replace('(async () => {', '(async () => {\n' + PRE, 1)
    got = pg.evaluate(src); report[name] = got; bad = sub(exp, got) + [f'page error: {e}' for e in errs]
    print(('ok   ' if not bad else 'FAIL ') + name); [print('     ' + x) for x in bad]; fails += len(bad); pg.close()
  b.close()
open(os.path.join(os.environ.get('COMBAT_REPORT_DIR', '/tmp'), 'combat-smoke-report.json'), 'w').write(json.dumps(report, indent=1))
for extra in ['reload.py', 'playtest.py']:
  args = [sys.executable, os.path.join(here, extra), f, chrome] + sys.argv[3:4]
  r = subprocess.run(args, capture_output=True, text=True); print(r.stdout.strip() or r.stderr[-600:]); fails += r.returncode != 0
print('ALL PASS' if not fails else f'{fails} FAILED'); sys.exit(1 if fails else 0)
