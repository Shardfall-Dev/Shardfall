# Browser checks for the Second Age skill system (v0.30): creation, the Skills page, trainers, natural stat gain, a real v0.28.1 save
# migrating to the 49 skills, and (scenarios.js) each skill's action in the live game.
# usage: python3 tests/skills-smoke/run.py Shardfall_v0.30.0.html [chrome] [OLD_v0.28.1.html]
# Without OLD the v0.28.1 build is read from git (main or the commit that added it).
import sys, json, os, subprocess, tempfile
from playwright.sync_api import sync_playwright
here = os.path.dirname(os.path.abspath(__file__)); repo = os.path.dirname(os.path.dirname(here))
new = os.path.abspath(sys.argv[1]); chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
old = sys.argv[3] if len(sys.argv) > 3 else None
if not old:
  old = os.path.join(tempfile.mkdtemp(), 'Shardfall_v0.28.1.html')
  for ref in ['main', 'HEAD~1', 'b362b46']:
    r = subprocess.run(['git', '-C', repo, 'show', ref + ':Shardfall_v0.28.1.html'], capture_output=True)
    if r.returncode == 0: open(old, 'wb').write(r.stdout); break
fails = 0
def check(cond, msg, extra=None):
  global fails
  if cond: print('ok  ', msg)
  else: fails += 1; print('FAIL', msg, json.dumps(extra)[:900] if extra is not None else '')
SCEN = os.path.join(here, 'scenarios.js')
with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
  pg = b.new_page(viewport={'width': 1280, 'height': 720}); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
  J = lambda js, arg=None: pg.evaluate(js, arg) if arg is not None else pg.evaluate(js)
  # ---------- creation: 80 stat points, 10–60, up to three skills ----------
  pg.goto('file://' + new); pg.wait_for_timeout(500); J('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(600)
  pg.click('[data-c=new]'); pg.fill('#ccn', 'Tess'); pg.click('[data-c=next]'); pg.click('[data-c=next]'); pg.wait_for_selector('[data-c=stv]')
  lab = J("() => document.querySelector('#ccin').textContent")
  check('of 80' in lab and J("[__SF.SF.CREATE_STATS, __SF.SF.CREATE_STAT_MIN, __SF.SF.CREATE_STAT_MAX]") == [80, 10, 60], 'creation asks for 80 stat points, each 10–60', lab[:200])
  opts = J("() => [...document.querySelector('[data-c=sk]').options].map(o => o.value)")
  check('stealth' not in opts and 'removetrap' not in opts and 'magery' in opts and len(opts) >= 35, 'Stealth and Remove Trap are not offered as starting skills', opts)
  for _ in range(30): pg.click('[data-c=st][data-i="0"][data-d="1"]')
  st = J("__CC.draft.stats")
  check(max(st) <= 60 and sum(st) <= 80, 'the stat buttons stop at 60 and 80 in all', st)
  pg.evaluate("o => __CC.quick(o)", {'name': 'Tess', 'template': 'tamer'}); pg.wait_for_timeout(900)
  c0 = J("() => { const P = __SF.P; return { s: [P.str, P.dex, P.int], k: ['animaltaming', 'animallore', 'veterinary'].map(k => P.skills[k].v), n: Object.keys(P.skills).length, gold: __SF.SF.count(P.pack, 'gold'), free: P.freeLessons }; }")
  check(c0 == {'s': [30, 20, 30], 'k': [500, 300, 200], 'n': 49, 'gold': 100, 'free': 0}, 'the Animal Tamer template makes a 30/20/30 character with 50/30/20 and 49 skills', c0)
  # ---------- the Skills page ----------
  J("() => __SF.openPanel('skills')"); pg.wait_for_timeout(150)
  pan = J("() => ({ rows: document.querySelectorAll('#panel .pb .row').length, groups: [...document.querySelectorAll('#panel .skgrp')].map(b => b.textContent.trim().replace(/ [0-9.]+$/, '')), total: document.querySelector('#panel .note').textContent })")
  check(pan['rows'] == 49 and len(pan['groups']) == 7 and 'Real total 100.0 / 700.0' in pan['total'], 'Skills page: 49 skills in the 7 classic groups, real total 100.0 / 700.0', pan)
  pg.fill('#skq', 'tam'); pg.wait_for_timeout(150)
  srch = J("() => ({ rows: [...document.querySelectorAll('#panel .pb .row .nm')].map(e => e.firstChild.textContent.trim()), focus: document.activeElement && document.activeElement.id })")
  check('Animal Taming' in srch['rows'] and len(srch['rows']) <= 4 and srch['focus'] == 'skq', 'search narrows the list and keeps the cursor in the box', srch)
  pg.fill('#skq', ''); pg.wait_for_timeout(100)
  vals = J("() => { const v = () => [...document.querySelectorAll('#panel .pb .row')].find(r => r.textContent.startsWith('Animal Lore')).querySelector('.v').textContent; const a = v(); __SF.ACT.skview(); const b = v(); __SF.ACT.skview(); return [a, b]; }")
  check(vals[0] != vals[1] and vals[1] == '30.0', 'real / displayed toggle: Animal Lore shows a stat-lifted value and real 30.0', vals)
  grp = J("() => { __SF.ACT.skgrp({ g: 'combat' }); const n = document.querySelectorAll('#panel .pb .row').length; __SF.ACT.skgrp({ g: 'combat' }); return [n, document.querySelectorAll('#panel .pb .row').length]; }")
  check(grp == [42, 49], 'a group folds and unfolds', grp)
  lk = J("() => { __SF.ACT.lock({ k: 'tactics' }); const a = __SF.P.skills.tactics.lock; __SF.ACT.lock({ k: 'tactics' }); const b = __SF.P.skills.tactics.lock; __SF.ACT.lock({ k: 'tactics' }); return [a, b, __SF.P.skills.tactics.lock]; }")
  check(lk == ['hold', 'lower', 'raise'], 'locks cycle raise → hold → lower → raise', lk)
  use = J("() => [...document.querySelectorAll('#panel [data-a=skuse]')].map(b => b.dataset.k)")
  check('animaltaming' in use and 'hiding' in use and 'tactics' not in use, 'active skills have a one-tap Use button, passive ones do not', use)
  J("() => __SF.closePanel()")
  # ---------- trainers: Master Vey teaches combat to 30 at a gold per tenth; no stats for sale ----------
  tr = J("""() => { const S = __SF, P = S.P; const v = S.ents.find(e => e.role === 'trainer'); P.x = v.x + 1; P.y = v.y; S.talk(v); const html = document.querySelector('#panel').innerHTML;
    const g0 = S.SF.count(P.pack, 'gold'); S.ACT.train({ k: 'tactics' }); const t1 = P.skills.tactics.v, g1 = S.SF.count(P.pack, 'gold');
    S.SF.addItem(P.pack, S.SF.newItem('gold', 500)); S.ACT.train({ k: 'tactics' }); const t2 = P.skills.tactics.v; S.ACT.train({ k: 'magery' });
    return { panel: S.PANEL, stats: /Attribute/.test(html), skills: [...document.querySelectorAll('#panel .row .nm')].map(e => e.firstChild.textContent.trim()), g0, t1, g1, t2, gold: S.SF.count(P.pack, 'gold'), magery: P.skills.magery.v }; }""")
  check(tr['panel'] == 'trainer' and not tr['stats'] and 'Tactics' in tr['skills'] and 'Magery' not in tr['skills'], 'Master Vey offers combat lessons and no attributes', tr)
  check(tr['t1'] == 150 and tr['g1'] == 0 and tr['t2'] == 300 and tr['gold'] == 500 - 150 and tr['magery'] == 0, '150 gold buys Tactics 15.0; more gold finishes it at 30.0; he will not teach Magery', tr)
  mage = J("""() => { const S = __SF, P = S.P; const m = S.ents.find(e => e.role === 'mage'); if (!m) return null; P.x = m.x + 1; P.y = m.y; S.talk(m); S.ACT.tab({ t: 'learn' }); return { panel: S.PANEL, rows: [...document.querySelectorAll('#panel .row .nm')].map(e => e.firstChild.textContent.trim()) }; }""")
  check(mage and 'Magery' in mage['rows'] and 'Meditation' in mage['rows'], 'Magister Orrin has a Lessons tab for the magic skills', mage)
  J("() => __SF.closePanel()")
  # ---------- natural stat gain ----------
  sg = J("""() => { const S = __SF, P = S.P; const s0 = P.str; let n = 0; for (let i = 0; i < 4000 && P.str === s0; i++) { S.skillCheck('tactics', 0, 100); n++; } return { s0, s1: P.str, n, log: S.LOG.filter(l => /Strength rises/.test(l.t)).length }; }""")
  check(sg['s1'] == sg['s0'] + 1 and sg['log'] >= 1, 'training Tactics raises Strength by use and says so', sg)
  # ---------- a real v0.28.1 save migrates to the 49 skills ----------
  if os.path.exists(old):
    pg.goto('file://' + old); pg.wait_for_timeout(600); J('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(600)
    pg.evaluate("o => __CC.quick(o)", {'name': 'Oldie', 'template': 'advanced', 'stats': [20, 10, 50], 'skills': [['magery', 50], ['healing', 30], ['meditation', 20]]}); pg.wait_for_timeout(900)
    o = J("""() => { const S = __SF, P = S.P; Object.assign(P.skills, { spellcraft: { v: 452, lock: 'raise' }, focus: { v: 311, lock: 'hold' }, skinning: { v: 205, lock: 'raise' }, foraging: { v: 77, lock: 'lower' }, smithing: { v: 640, lock: 'raise' }, concealment: { v: 123, lock: 'lower' }, taming: { v: 88, lock: 'raise' } });
      P.hotbar[4] = { k: 'act', id: 'lullaby' }; P.hotbar[5] = { k: 'act', id: 'pick' }; P.lowerRank = ['foraging', 'concealment']; S.save(); const s = JSON.parse(localStorage.getItem('shardfall.save.v1'));
      return { v: s.v, sum: Object.values(s.char.skills).reduce((a, x) => a + x.v, 0), n: Object.keys(s.char.skills).length, pool: s.char.skillPool || 0, gold: S.SF.count(P.pack, 'gold'), str: P.str }; }""")
    check(o['v'] == 7 and o['n'] == 41, 'the old build wrote a v7 save with 41 skills', o)
    pg.goto('file://' + new); pg.wait_for_timeout(700); pg.click('[data-c=cont]'); pg.wait_for_timeout(1000)
    n = J("""() => { const S = __SF, P = S.P; const sk = P.skills; return { n: Object.keys(sk).length, magery: [sk.magery.v, sk.magery.lock], eval: [sk.evaluatingintelligence.v, sk.evaluatingintelligence.lock], smith: sk.blacksmithy.v, hiding: [sk.hiding.v, sk.hiding.lock], taming: sk.animaltaming.v,
      pool: P.skillPool, sum: S.SF.totalSkill(P), hot: [P.hotbar[4] && P.hotbar[4].id, P.hotbar[5] && P.hotbar[5].id], low: P.lowerRank, gold: S.SF.count(P.pack, 'gold'), str: P.str, backup: !!localStorage.getItem('shardfall.save.v1.pret2a'),
      log: S.LOG.filter(l => /Second Age|retired|activities now/.test(l.t)).map(l => l.t) }; }""")
    check(n['n'] == 49 and n['magery'] == [452, 'raise'] and n['eval'] == [311, 'hold'] and n['smith'] == 640 and n['hiding'] == [123, 'lower'] and n['taming'] == 88, 'every trained value and lock moved to its classic skill', n)
    check(n['pool'] == o['pool'] + 205 + 77 and n['sum'] + 205 + 77 == o['sum'], 'Skinning and Foraging points wait in the pool; nothing lost, nothing created', n)
    check(n['hot'] == ['peace', 'steal'] and n['low'] == ['hiding'] and n['gold'] == o['gold'] and n['str'] == o['str'] and n['backup'], 'hotbar, lower ranking, gold and stats kept; the old save is backed up once', n)
    check(len(n['log']) >= 1, 'the player is told what changed', n['log'])
    J("() => __SF.openPanel('skills')"); pool = J("() => /Skill reform/.test(document.querySelector('#panel').textContent)")
    pl = J("() => { const S = __SF, P = S.P; const p0 = P.skillPool, s0 = P.skills.camping.v; S.ACT.pool({ k: 'camping' }); return [p0 - P.skillPool, P.skills.camping.v - s0]; }")
    check(pool and pl == [10, 10], 'pool points can be placed on any skill, 1.0 at a time', pl)
    J("() => __SF.closePanel()")
    J("() => __SF.save()"); pg.reload(); pg.wait_for_timeout(700); pg.click('[data-c=cont]'); pg.wait_for_timeout(900)
    again = J("() => ({ n: Object.keys(__SF.P.skills).length, magery: __SF.P.skills.magery.v, sum: __SF.SF.totalSkill(__SF.P), pool: __SF.P.skillPool })")
    check(again['n'] == 49 and again['magery'] == 452 and again['sum'] + again['pool'] == n['sum'] + n['pool'], 'saving and loading again changes nothing', again)
  else: print('skip v0.28.1 save migration (no old build found)')
  # ---------- each skill's action in the live game ----------
  if os.path.exists(SCEN):
    pg.goto('file://' + new); pg.wait_for_timeout(500); J('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(600)
    pg.evaluate("o => __CC.quick(o)", {'name': 'Ada', 'template': 'advanced', 'stats': [45, 10, 25], 'skills': [['swordsmanship', 50], ['magery', 30], ['tactics', 20]]}); pg.wait_for_timeout(900)
    res = pg.evaluate(open(SCEN).read())
    for name, r in res.items(): check(r.get('ok'), 'scenario ' + name, r)
  check(not errs, 'no page errors', errs[:5])
  b.close()
print(f'{fails} FAILED' if fails else 'ALL PASS'); sys.exit(1 if fails else 0)
