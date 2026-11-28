# v0.33.1 save durability checks in the built game (Playwright + Chrome), from the v0.33 stability audit (docs/audits/v0.33-stability-2026-11-28.md):
#   - creating a character while browser storage fails (writes refused, or storage not readable at all): the game says the
#     character is not saved, the previous save is untouched, Export gives the unsaved character as a file, Retry saves it once
#     storage works again; replacing a save whose copy cannot be written changes nothing
#   - a stale tab never brings back a character that was deleted, replaced or cleared in another tab (storage event and the
#     check before every write, which also covers a missed event)
#   - pets: a pet told to stay waits where it was left through a reload (also far from you), keeps its actor id, owner, name,
#     loyalty and order; a following pet appears beside you; a save from before v0.33.1 (offsets only) migrates to the same spot
# usage: python3 tests/stability-smoke/durability.py Shardfall_vX.html [chrome]
import json, os, sys
from playwright.sync_api import sync_playwright
f = os.path.abspath(sys.argv[1]); chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
URL = 'file://' + f; KEY = 'shardfall.save.v1'; fails = 0
def check(cond, msg, info=None):
  global fails
  if cond: print('ok  ', msg)
  else: fails += 1; print('FAIL', msg, json.dumps(info)[:600] if info is not None else '')
J = lambda pg, js, *a: pg.evaluate(js, *a)
OPTS = {'name': 'Dura', 'template': 'advanced', 'stats': [35, 10, 35], 'skills': [['animaltaming', 50], ['animallore', 30], ['magery', 20]]}
LOGHAS = "re => __SF.LOG.some(l => new RegExp(re).test(l.t || l.text || l.m || (Array.isArray(l) ? l[0] : '') || ''))"
FAIL_SET = "() => { window.__origSet = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; }"
STEP = "n => { for (let i = 0; i < n; i++) __SF.update(.05); }"
HEAL_SET = "() => { if (window.__origSet) Storage.prototype.setItem = window.__origSet; }"

def page(ctx):
  pg = ctx.new_page(); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
  return pg, errs
def blank(pg):
  pg.goto(URL); pg.wait_for_timeout(300); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_selector('[data-c=new]')
def create(pg, name='Dura', replace=True):
  return J(pg, "o => __CC.quick(o)", dict(OPTS, name=name, replace=replace))
def cont(pg):
  pg.goto(URL); pg.wait_for_selector('[data-c=cont]', timeout=8000); pg.click('[data-c=cont]'); pg.wait_for_function('window.__SF && __SF.P')
def stored(pg): return J(pg, f"() => localStorage.getItem('{KEY}')")
def unsaved_shown(pg): return J(pg, "() => { const e = document.getElementById('unsaved'); return !!e && !e.hidden; }")

with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])

  # ================= creation while storage refuses writes =================
  ctx = b.new_context(viewport={'width': 1280, 'height': 720}, accept_downloads=True); pg, errs = page(ctx)
  blank(pg); J(pg, FAIL_SET)
  ok = create(pg, 'Nosave')
  check(ok is True and J(pg, '!!(window.__SF && __SF.P)'), 'storage full: the new character still starts (the game runs)')
  check(J(pg, '__SF.SAVE.unsaved') is True and unsaved_shown(pg), 'storage full: the "Not saved" notice is shown, not a silent success')
  check(J(pg, LOGHAS, 'has not been saved'), 'storage full: the log says the new character has not been saved')
  J(pg, HEAL_SET); check(stored(pg) is None, 'storage full: nothing was written', stored(pg))
  with pg.expect_download() as dl: pg.click('#unsaved [data-a=saveexport]')
  path = dl.value.path(); exp = json.load(open(path))
  check(exp.get('char', {}).get('name') == 'Nosave' and exp.get('v') == 9, 'Export gives the unsaved character as a save file', exp.get('char', {}).get('name'))
  pg.click('#unsaved [data-a=saveretry]'); pg.wait_for_timeout(100)
  s = stored(pg)
  check(s is not None and json.loads(s)['char']['name'] == 'Nosave' and not unsaved_shown(pg) and J(pg, LOGHAS, 'saved again'), 'Retry once storage works: the character is saved and the notice goes away')
  pg.reload(); pg.wait_for_selector('[data-c=cont]', timeout=8000)
  check(J(pg, "() => document.body.innerText.includes('Nosave')"), 'after Retry the character is offered on the title screen')

  # ---- replacing a save while storage refuses writes: the old save survives untouched ----
  old = stored(pg); pg.reload(); pg.wait_for_selector('[data-c=new]'); J(pg, FAIL_SET)
  ok = create(pg, 'Second')
  J(pg, HEAL_SET)
  check(ok is False and not J(pg, '!!(window.__SF && __SF.P)'), 'replace while storage is full: the copy of the old save cannot be written, so creation stops')
  check(stored(pg) == old, 'replace while storage is full: the old save is untouched')
  check(J(pg, "() => /could not be copied aside/.test(document.body.innerText)"), 'replace while storage is full: the creator says why and that nothing changed')
  # copy works but the new save fails: the old save stays the stored one, the new character runs unsaved
  pg.reload(); pg.wait_for_selector('[data-c=new]')
  J(pg, "() => { const o = Storage.prototype.setItem; window.__origSet = o; Storage.prototype.setItem = function (k, v) { if (k === 'shardfall.save.v1') throw new DOMException('full', 'QuotaExceededError'); return o.call(this, k, v); }; }")
  ok = create(pg, 'Third'); J(pg, HEAL_SET)
  check(ok is True and stored(pg) == old and J(pg, "() => localStorage.getItem('shardfall.save.v1.replaced')") == old and unsaved_shown(pg), 'replace, copy written but the save refused: old save kept (and its copy), new character marked unsaved')
  check(not errs, 'creation with failing storage: no page errors', errs[:5])
  ctx.close()

  # ================= storage not available at all (blocked: every access throws) =================
  ctx = b.new_context(viewport={'width': 844, 'height': 390}, is_mobile=True, has_touch=True, device_scale_factor=2); pg, errs = page(ctx)
  ctx.add_init_script("Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });")
  pg.goto(URL); pg.wait_for_selector('[data-c=new]', timeout=8000)
  ok = create(pg, 'Blocked')
  check(ok is True and J(pg, '!!(window.__SF && __SF.P)') and unsaved_shown(pg), 'storage blocked (phone): the character starts and is marked not saved', [ok, unsaved_shown(pg)])
  J(pg, STEP, 400)
  check(J(pg, '__SF.SAVE.unsaved') is True and not errs, 'storage blocked: autosaves keep failing quietly, no page errors', errs[:5])
  ctx.close()

  # ================= stale tabs =================
  ctx = b.new_context(viewport={'width': 1280, 'height': 720}); pgA, errA = page(ctx)
  blank(pgA); create(pgA, 'Alpha'); pgA.wait_for_function('window.__SF && __SF.P')
  check(J(pgA, '__SF.save()') is True, 'tab A saves normally')
  # deletion from the title screen of tab B
  pgB, errB = page(ctx); pgB.goto(URL); pgB.wait_for_selector('[data-c=cont]')
  pgB.on('dialog', lambda d: d.accept())
  J(pgB, "() => { const b = document.querySelector('[data-c=savedel]'); if (b) b.click(); else localStorage.removeItem('shardfall.save.v1'); }"); pgA.wait_for_timeout(300)
  check(stored(pgB) is None, 'tab B deleted the saved character')
  r = J(pgA, "() => [__SF.save(), __SF.saveLocked]")
  check(r == [False, True] and stored(pgA) is None, 'tab A (stale) does not recreate the deleted character', [r, stored(pgA) is not None])
  J(pgA, STEP, 400); check(stored(pgA) is None, 'tab A autosaves for 20 s: the deleted character stays deleted')
  check(J(pgA, LOGHAS, 'deleted in another tab'), 'tab A says why it stopped saving')
  pgA.close(); pgB.close()
  # replacement in tab B
  pgA, errA = page(ctx); blank(pgA); create(pgA, 'Alpha'); pgA.wait_for_function('window.__SF && __SF.P')
  pgB, errB = page(ctx); pgB.goto(URL); pgB.wait_for_selector('[data-c=new]'); create(pgB, 'Beta'); pgB.wait_for_function('window.__SF && __SF.P'); pgA.wait_for_timeout(300)
  r = J(pgA, "() => [__SF.save(), __SF.saveLocked]"); s = stored(pgA)
  check(r == [False, True] and s and json.loads(s)['char']['name'] == 'Beta', 'a new character made in tab B is not overwritten by tab A', [r, s and json.loads(s)['char']['name']])
  check(J(pgB, '__SF.save()') is True, 'tab B keeps saving')
  pgA.close(); pgB.close()
  # a missed storage event: the check before writing still catches the deletion
  pgA, errA = page(ctx); blank(pgA); create(pgA, 'Gamma'); pgA.wait_for_function('window.__SF && __SF.P')
  J(pgA, "() => { window.__skip = true; addEventListener('storage', e => { if (window.__skip) e.stopImmediatePropagation(); }, true); }")
  J(pgA, "() => localStorage.removeItem('shardfall.save.v1')")   # same-tab removal: no storage event reaches this tab, as if it were missed
  check(J(pgA, '__SF.save()') is False and stored(pgA) is None, 'without a storage event, the write-time check still refuses to recreate a deleted save')
  pgA.close()
  # cleared storage in another tab
  pgA, errA = page(ctx); blank(pgA); create(pgA, 'Delta'); pgA.wait_for_function('window.__SF && __SF.P')
  pgB, errB = page(ctx); pgB.goto(URL); pgB.wait_for_selector('#cc'); J(pgB, 'localStorage.clear()'); pgA.wait_for_timeout(300)
  check(J(pgA, '__SF.save()') is False and stored(pgA) is None, 'storage cleared in another tab: the stale tab stops saving')
  # same-tab continuation still works normally after a reload
  pgA.reload(); pgA.wait_for_selector('[data-c=new]'); create(pgA, 'Echo'); pgA.wait_for_function('window.__SF && __SF.P')
  check(J(pgA, '__SF.save()') is True and json.loads(stored(pgA))['char']['name'] == 'Echo', 'a reloaded tab creates and saves normally')
  check(not errA and not errB, 'stale tabs: no page errors', (errA + errB)[:5])
  ctx.close()

  # ================= pets: stay position, identity, migration =================
  ctx = b.new_context(viewport={'width': 1280, 'height': 720}); pg, errs = page(ctx)
  blank(pg); create(pg, 'Petra'); pg.wait_for_function('window.__SF && __SF.P')
  MAKE = """([type, dx, dy, order, name]) => { const S = __SF, P = S.P; const m = S.spawnMon(type, dx, dy); if (m.sp) { m.sp.n--; m.sp = null; }
    const L = S.SF.SK.LOYALTY; m.kind = 'pet'; m.order = order; m.slots = 1; m.loyal = L.max - 2; m.fedAt = S.GT - 2 * L.step - 1; m.name = name; m.state = ''; m.target = null; m.hidden = false; S.simAdopt(m); return m.actorId; }"""
  sid = J(pg, MAKE, ['rat', 3, 0, 'stay', 'Stayer']); fid = J(pg, MAKE, ['rat', -1.5, 0, 'follow', 'Follower'])
  # walk the player far away (40 tiles) on standable ground, leaving the staying pet behind
  far = J(pg, """() => { const S = __SF, P = S.P, st = S.ents.find(e => e.name === 'Stayer'); const at = [st.x, st.y];
    for (let r = 30; r < 80; r += 2) for (let a = 0; a < 16; a++) { const x = P.x + Math.cos(a / 8 * Math.PI) * r, y = P.y + Math.sin(a / 8 * Math.PI) * r; if (S.canStand(P, x, y)) { P.x = x; P.y = y; return { at, p: [x, y] }; } } return null; }""")
  check(far is not None, 'found ground 30+ tiles away to walk to')
  J(pg, "() => { const f = __SF.ents.find(e => e.name === 'Follower'); f.x = __SF.P.x - .8; f.y = __SF.P.y + .8; }")   # a follower keeps up
  J(pg, STEP, 20)
  before = J(pg, "() => __SF.ents.filter(e => e.kind === 'pet').map(e => ({ n: e.name, x: e.x, y: e.y, id: e.actorId, o: e.order, l: e.loyal }))")
  st0 = [x for x in before if x['n'] == 'Stayer'][0]
  check(abs(st0['x'] - far['at'][0]) < .05 and abs(st0['y'] - far['at'][1]) < .05, 'a staying pet does not follow (or teleport) when you walk 30+ tiles away', [st0, far])
  check(J(pg, '__SF.save()') is True, 'saved with one staying and one following pet')
  sv = json.loads(stored(pg)); pets = {x['name']: x for x in sv['pets']}
  check(set(pets) == {'Stayer', 'Follower'} and all(k in pets['Stayer'] for k in ('x', 'y', 'aid', 'owner', 'dx', 'dy')) and pets['Stayer']['owner'] == sv['char']['charId'], 'the save keeps each pet\'s position, actor id and owner (offsets kept for older builds)', pets.get('Stayer'))
  cont(pg)
  after = {e['n']: e for e in J(pg, "() => __SF.ents.filter(e => e.kind === 'pet').map(e => ({ n: e.name, x: e.x, y: e.y, id: e.actorId, o: e.order, l: e.loyal, owner: e.owner }))")}
  pp = J(pg, '[__SF.P.x, __SF.P.y]')
  st = after.get('Stayer'); fo = after.get('Follower')
  check(st and abs(st['x'] - st0['x']) < .01 and abs(st['y'] - st0['y']) < .01 and st['o'] == 'stay', 'after reload the staying pet is where it was left, not snapped beside you', [st, st0])
  check(st and st['id'] == sid and fo and fo['id'] == fid, 'both pets keep their actor ids through the reload', [sid, fid, st and st['id'], fo and fo['id']])
  check(st and st['l'] == J(pg, '__SF.SF.SK.LOYALTY.max - 2') and st['owner'] == sv['char']['charId'], 'loyalty and owner survive the reload', st)
  check(fo and abs(fo['x'] - pp[0]) < 2 and abs(fo['y'] - pp[1]) < 2 and fo['o'] == 'follow', 'the following pet appears beside you', [fo, pp])
  J(pg, STEP, 100)
  st2 = J(pg, "() => { const e = __SF.ents.find(e => e.name === 'Stayer'); return [e.x, e.y]; }")
  check(abs(st2[0] - st0['x']) < .05 and abs(st2[1] - st0['y']) < .05, 'the staying pet keeps waiting after the reload (5 s of play)', st2)
  # a save from before v0.33.1: offsets only
  o = json.loads(stored(pg))
  for pt in o['pets']: [pt.pop(k, None) for k in ('x', 'y', 'aid', 'owner')]
  for pt in o['pets']:
    if pt['name'] == 'Stayer': pt['dx'] = st0['x'] - o['char']['x']; pt['dy'] = st0['y'] - o['char']['y']
  pg.goto(URL); pg.wait_for_selector('#cc'); J(pg, "v => localStorage.setItem('shardfall.save.v1', v)", json.dumps(o)); cont(pg)
  mig = {e['n']: e for e in J(pg, "() => __SF.ents.filter(e => e.kind === 'pet').map(e => ({ n: e.name, x: e.x, y: e.y, o: e.order, owner: e.owner }))")}
  check('Stayer' in mig and abs(mig['Stayer']['x'] - st0['x']) < .01 and abs(mig['Stayer']['y'] - st0['y']) < .01, 'an older save (offsets only) puts the staying pet back where it was left', mig.get('Stayer'))
  check('Follower' in mig and mig['Follower']['o'] == 'follow' and mig['Stayer']['owner'] == o['char']['charId'], 'an older save: the follower follows and both gain an owner', mig)
  # a staying pet whose spot is no longer standable (or off the map) falls back beside you
  o2 = json.loads(stored(pg))
  for pt in o2['pets']:
    if pt['name'] == 'Stayer': pt['x'] = -50; pt['y'] = 1e9
  pg.goto(URL); pg.wait_for_selector('#cc'); J(pg, "v => localStorage.setItem('shardfall.save.v1', v)", json.dumps(o2)); cont(pg)
  bad = J(pg, "() => { const e = __SF.ents.find(e => e.name === 'Stayer'); return e && [e.x - __SF.P.x, e.y - __SF.P.y, __SF.canStand(e, e.x, e.y)]; }")
  check(bad and abs(bad[0]) < 13 and abs(bad[1]) < 13, 'an invalid saved stay position falls back beside you (never off the map)', bad)
  check(not errs, 'pets: no page errors', errs[:5])
  ctx.close(); b.close()
print(fails and f'{fails} FAILED' or 'ALL PASS'); sys.exit(1 if fails else 0)
