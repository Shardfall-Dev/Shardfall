# Reload during treatment (no lost or repeated application) and a real old save (made by main's v0.16 build) migrating once.
# usage: python3 reload.py NEW.html [chrome] [OLD.html]; without OLD the v0.16 build is taken from git main.
import sys, json, os, subprocess, tempfile
from playwright.sync_api import sync_playwright
new = os.path.abspath(sys.argv[1]); chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
old = sys.argv[3] if len(sys.argv) > 3 else None
if not old:
  old = os.path.join(tempfile.mkdtemp(), 'Shardfall_v0.16.html'); repo = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
  open(old, 'wb').write(subprocess.run(['git', '-C', repo, 'show', 'main:Shardfall_v0.16.html'], capture_output=True, check=True).stdout)
errs = []; bad = []; out = {}
def check(cond, msg):
  if not cond: bad.append(msg)
with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox']); ctx = b.new_context(viewport={'width': 844, 'height': 390}, is_mobile=True, has_touch=True)
  pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
  def cont(page, path):
    page.goto('file://' + path); page.wait_for_timeout(700); page.click('[data-c=cont]'); page.wait_for_timeout(900)
  # ---- reload during treatment
  pg.goto('file://' + new); pg.wait_for_timeout(500); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(500)
  pg.click('[data-c=prof][data-p="Glaive hybrid"]'); pg.fill('#ccn', 'Rel'); pg.click('[data-c=go]'); pg.wait_for_timeout(900)
  r1 = pg.evaluate("""() => { const S = __SF, P = S.P; P.skills.healing.v = 1000; P.skills.anatomy.v = 1000; P.hp = 20; S.setRng(() => 0); S.useSlot(0); for (let i = 0; i < 100; i++) S.update(.05); S.save();
    return { left: P.bandage.t1 - S.GT, bandages: S.SF.count(P.pack, 'bandage'), id: P.bandage.id }; }""")
  cont(pg, new)
  r2 = pg.evaluate("""() => { const S = __SF, P = S.P; const b = P.bandage; const o = { restored: !!b, self: b && b.self, left: b && Math.round((b.t1 - S.GT) * 10) / 10, bandages: S.SF.count(P.pack, 'bandage'), hp: Math.round(P.hp) };
    S.setRng(() => 0); for (let i = 0; i < 220; i++) S.update(.05); o.after = { done: !P.bandage, hp: Math.round(P.hp), bandDone: P.bandDone, bandages: S.SF.count(P.pack, 'bandage') }; return o; }""")
  cont(pg, new)
  r3 = pg.evaluate("() => { const P = __SF.P; return { pending: !!P.bandage, hp: Math.round(P.hp), bandages: __SF.SF.count(P.pack, 'bandage') }; }")
  # another patient across a reload: the application stays linked to Wren
  r4 = pg.evaluate("""() => { const S = __SF, P = S.P, w = S.allyOf(); w.x = P.x + 1; w.y = P.y; w.home = { x: w.x, y: w.y }; w.hp = 10; P.sel = w; S.firstAidOther(); S.update(.05); S.save(); return { pid: P.bandage && P.bandage.e === w }; }""")
  cont(pg, new)
  r5 = pg.evaluate("""() => { const S = __SF, P = S.P, w = S.allyOf(); const o = { linked: !!P.bandage && P.bandage.e === w, kind: P.bandage && P.bandage.kind }; const h = w.hp; S.setRng(() => 0); for (let i = 0; i < 110; i++) S.update(.05); o.healed = Math.round(w.hp - h) >= 43; return o; }""")
  out['reload'] = [r1, r2, r3, r4, r5]
  check(r2['restored'] and r2['self'] and r1['left'] - 2.5 <= r2['left'] <= r1['left'] + .01 and r2['bandages'] == r1['bandages'],   # the live game keeps running (and saves on unload) between our save and the reload
        'treatment restored after reload with its time left and no bandage refunded or spent')
  check(r2['after']['done'] and r2['after']['hp'] - r2['hp'] >= 43 and r2['after']['bandages'] == r1['bandages'], 'it completes once after the reload')
  check(not r3['pending'] and r3['hp'] == r2['after']['hp'] and r3['bandages'] == r1['bandages'], 'reloading after completion pays nothing again')
  check(r4['pid'] and r5['linked'] and r5['kind'] == 'heal' and r5['healed'], 'a treatment on Wren survives a reload and finishes on Wren')
  # ---- a real v0.16 save migrates once
  pg.goto('file://' + old); pg.wait_for_timeout(600); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(600)
  pg.click('[data-c=prof][data-p="Glaive hybrid"]'); pg.fill('#ccn', 'Oldie'); pg.click('[data-c=go]'); pg.wait_for_timeout(900)
  o1 = pg.evaluate("""() => { const S = __SF, P = S.P, SF = S.SF; P.skills.blades.v = 300; P.skills.shieldwork.v = 250; P.skills.shieldwork.lock = 'lower'; P.skills.medicine.v = 333; P.skills.brawling.v = 120; P.skills.knives.lock = 'hold'; P.skills.hammers.v = 44;
    P.equip.weapon.quality = 'exceptional'; P.equip.weapon.maker = 'Oldie'; P.equip.weapon.cond = 77; P.equip.armor = SF.newItem('chain', 1, { cond: 90, maxc: 100 });
    P.hotbar = [{ k: 'item', id: 'bandage' }, { k: 'spell', id: 'magery.05' }, { k: 'act', id: 'brace' }, { k: 'item', id: 'draught' }, null, { k: 'act', id: 'track' }, null, null, null]; S.save();
    const s = JSON.parse(localStorage.getItem('shardfall.save.v1')); const tot = Object.values(s.char.skills).reduce((a, x) => a + x.v, 0); return { v: s.v, total: tot, skills: Object.fromEntries(Object.entries(s.char.skills).filter(([k, x]) => x.v || x.lock !== 'raise')), raw: localStorage.getItem('shardfall.save.v1') }; }""")
  raw_old = o1.pop('raw'); localstorage_old_keys = pg.evaluate("Object.keys(localStorage)")
  cont(pg, new)
  n1 = pg.evaluate("""() => { const S = __SF, P = S.P; const sk = k => P.skills[k] && [P.skills[k].v, P.skills[k].lock]; return { sw: sk('swordsmanship'), parry: sk('parrying'), heal: sk('healing'), wrest: sk('wrestling'), mace: sk('macefighting'), fence: sk('fencing'), tac: sk('tactics'),
    pool: P.skillPool, total: S.SF.totalSkill(P), legacy: ['blades', 'polearms', 'hammers', 'knives', 'brawling', 'shieldwork', 'medicine'].filter(k => P.skills[k]), hot: P.hotbar.map(h => h && h.k + ':' + h.id),
    weapon: P.equip.weapon && [P.equip.weapon.id, P.equip.weapon.quality, P.equip.weapon.maker, P.equip.weapon.cond], armor: P.equip.armor && P.equip.armor.id, snap: localStorage.getItem('shardfall.save.v1.precombat'),
    savedV: JSON.parse(localStorage.getItem('shardfall.save.v1')).v, log: S.LOG.slice(-6).map(l => l.t) }; }""")
  snap = n1.pop('snap')
  pg.evaluate("__SF.save()"); cont(pg, new)
  n2 = pg.evaluate("""() => { const P = __SF.P; return { sw: P.skills.swordsmanship.v, pool: P.skillPool, total: __SF.SF.totalSkill(P), hot: P.hotbar.map(h => h && h.k + ':' + h.id), snapSame: localStorage.getItem('shardfall.save.v1.precombat') }; }""")
  pg.evaluate("() => { const S = __SF; S.openPanel('skills'); }"); pg.wait_for_timeout(300)
  shots = os.environ.get('COMBAT_SHOTS', '/tmp/combat-shots'); os.makedirs(shots, exist_ok=True); pg.screenshot(path=os.path.join(shots, 'migrated-skills.png'))
  out['migration'] = {'old': o1, 'new': n1, 'again': {k: v for k, v in n2.items() if k != 'snapSame'}}
  check(o1['v'] == 2, 'the old build wrote a v2 save')
  check(n1['sw'] == [500, 'raise'] and n1['pool'] == 300, 'Polearms 50.0 (glaive) beats Blades 30.0 on Swordsmanship; 30.0 recorded for redistribution')
  check(n1['parry'] == [250, 'lower'] and n1['heal'] == [333, 'raise'] and n1['wrest'] == [120, 'raise'] and n1['mace'] == [44, 'raise'] and n1['fence'] == [0, 'hold'] and n1['tac'] == [200, 'raise'], 'values and locks carried to Parrying, Healing, Wrestling, Mace Fighting, Fencing; Tactics untouched')
  check(n1['total'] + n1['pool'] == o1['total'] and not n1['legacy'], 'no points cloned or erased; legacy keys gone')
  check(n1['hot'][:4] == ['item:bandage', 'spell:magery.05', 'act:brace', 'item:draught'] and n1['hot'][5] == 'act:track' and 'act:bandother' in n1['hot'], 'hotbar bindings kept; Bandage other added to a free slot')
  check(n1['weapon'] == ['glaive', 'exceptional', 'Oldie', 77] and n1['armor'] == 'chain', 'equipment and crafted quality kept')
  snapc = json.loads(snap) if snap else {}
  check(snapc.get('v') == 2 and all(snapc['char']['skills'][k] == v for k, v in o1['skills'].items()) and n1['savedV'] >= 3, 'pre-migration snapshot preserved; save now v3 or later (v4 since Anniabreen)')
  check(n2['sw'] == 500 and n2['pool'] == 300 and n2['total'] == n1['total'] and n2['hot'] == n1['hot'] and n2['snapSame'] == snap, 'loading again is idempotent')
  b.close()
bad += [f'page error: {e}' for e in errs]
print(('ok   reload + migration: ' if not bad else 'FAIL reload + migration: ') + json.dumps(out)[:900] + (''.join('\n     ' + x for x in bad)))
sys.exit(1 if bad else 0)
