# v0.28.2 stabilization checks in the built game (Playwright + Chrome): what a save keeps and how a bad save is handled.
# Audit v0.28.1 A03 (dropped piles, opened chests), A04 (spell preparation, poison), A05 (malformed, truncated, future, damaged
# and repaired saves, last good backup, export, two tabs), A06 (loot panel weight) and inventory conservation across reloads and death.
# usage: python3 tests/stability-smoke/run.py Shardfall_v0.28.2.html [chrome]
import json, os, sys
from playwright.sync_api import sync_playwright
f = os.path.abspath(sys.argv[1]); chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
URL = 'file://' + f; fails = 0
def check(cond, msg, info=None):
  global fails
  if cond: print('ok  ', msg)
  else: fails += 1; print('FAIL', msg, json.dumps(info)[:600] if info is not None else '')
J = lambda pg, js: pg.evaluate(js)

# units across every container a save holds; uid duplicates and bad quantities anywhere
UNITS = """() => { const S = __SF, P = S.P, u = {}, uids = [], bad = []; const see = it => { if (!it) return; uids.push(it.uid); if (!Number.isSafeInteger(it.qty) || it.qty < 1) bad.push(it.uid); u[it.id] = (u[it.id] || 0) + it.qty; (it.items || []).forEach(see); };
  P.pack.items.forEach(see); P.bank.items.forEach(see); Object.values(P.equip).forEach(see);
  for (const e of S.ents) if (e.kind === 'corpse' && !e.gone && (e.mine || e.pile) && e.cont) e.cont.items.forEach(see);
  for (const c of S.CHESTS.values()) if (c.open && c.cont) c.cont.items.forEach(see);
  const o = {}; for (const k of Object.keys(u).sort()) o[k] = u[k]; return { units: o, dupUid: uids.length - new Set(uids).size, bad }; }"""

def page(b, mobile):
  ctx = b.new_context(viewport={'width': 844, 'height': 390}, is_mobile=True, has_touch=True, device_scale_factor=2) if mobile else b.new_context(viewport={'width': 1280, 'height': 720})
  pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
  return ctx, pg, errs
def fresh(pg, name='Stab'):
  pg.goto(URL); pg.wait_for_timeout(300); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_selector('[data-c=go]')
  pg.fill('#ccn', name); pg.click('[data-c=go]'); pg.wait_for_function('window.__SF && __SF.P')
def put(pg, val):
  pg.goto(URL); pg.wait_for_selector('#cc'); pg.evaluate("(v) => localStorage.setItem('shardfall.save.v1', v)", val); pg.reload()
def cont(pg):
  pg.goto(URL); pg.wait_for_selector('[data-c=cont]', timeout=8000); pg.click('[data-c=cont]'); pg.wait_for_function('window.__SF && __SF.P')

with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
  for mobile in (True, False):
    tag = 'phone' if mobile else 'desktop'
    ctx, pg, errs = page(b, mobile); fresh(pg)

    # ---- A03: a dropped pile survives a reload with its time left; it is not duplicated
    r = J(pg, """() => { const S = __SF, P = S.P, SF = S.SF; SF.addItem(P.pack, SF.newItem('ironbar', 5)); const it = P.pack.items.find(i => i.id === 'ironbar'); S.ACT.drop({ u: it.uid, ok: 1 });   /* confirmed: v0.29 asks before dropping valuables */
      const pile = S.ents.find(e => e.pile && !e.gone); S.save(); return { ok: !!pile, n: pile && SF.count(pile.cont, 'ironbar'), left: pile && pile.expires - S.GT, inPack: SF.count(P.pack, 'ironbar'), x: pile && pile.x, y: pile && pile.y }; }""")
    before = J(pg, UNITS)
    cont(pg)
    r2 = J(pg, """() => { const S = __SF, SF = S.SF; const piles = S.ents.filter(e => e.pile && !e.gone); const pile = piles[0]; return { piles: piles.length, n: pile && SF.count(pile.cont, 'ironbar'), left: pile && pile.expires - S.GT, x: pile && pile.x, y: pile && pile.y, inPack: SF.count(S.P.pack, 'ironbar') }; }""")
    check(r['ok'] and r2['piles'] == 1 and r2['n'] == 5 and r2['inPack'] == 0 and abs(r2['x'] - r['x']) < 1e-6 and 0 < r2['left'] <= r['left'] + .01, f'[{tag}] a dropped pile survives a reload, once, with its time left', [r, r2])
    after = J(pg, UNITS)
    check(after == before and after['dupUid'] == 0 and not after['bad'], f'[{tag}] units conserved across the reload (pack, bank, equipment, piles)', [before, after])

    # ---- A03: an opened chest keeps its remaining contents and its relock time; a reload does not refill it
    r = J(pg, """() => { const S = __SF, P = S.P, SF = S.SF; const [k, c] = [...S.CHESTS.entries()][0]; c.open = true; c.refill = S.GT + 600; c.cont = SF.newContainer('chest'); c.cont.items.push(SF.newItem('gold', 50), SF.newItem('bandage', 3));
      P.x = c.x + .5; P.y = c.y + 1.4; P.lootOpen = { kind: 'chest', x: c.x + .5, y: c.y + .5, cont: c.cont, name: 'chest', expires: c.refill }; const g0 = SF.count(P.pack, 'gold');
      S.ACT.take({ u: c.cont.items.find(i => i.id === 'gold').uid }); S.closePanel(); S.save(); return { k, taken: SF.count(P.pack, 'gold') - g0, left: c.refill - S.GT, remain: c.cont.items.map(i => i.id + ':' + i.qty) }; }""")
    cont(pg)
    r2 = pg.evaluate("""(k) => { const S = __SF, c = S.CHESTS.get(k); return c ? { open: c.open, left: c.refill - S.GT, remain: c.cont ? c.cont.items.map(i => i.id + ':' + i.qty) : null } : { open: false, missing: true }; }""", r['k'])
    check(r['taken'] == 50 and r2['open'] and r2['remain'] == ['bandage:3'] and 0 < r2['left'] <= r['left'] + .01, f'[{tag}] an opened chest keeps what is left and its relock time through a reload', [r, r2])

    # ---- A04: a spell being prepared is interrupted by the reload exactly once (scroll back, half the mana spent)
    r = J(pg, """() => { const S = __SF, P = S.P, SF = S.SF; const sp = SF.SPELL['magery.01']; P.skills.spellcraft.v = 1000; SF.addItem(P.pack, SF.newItem(sp.scroll, 1)); P.mana = 30; P.spellReadyAt = 0;
      const sc0 = SF.count(P.pack, sp.scroll); S.castSlot('magery.01', { scroll: true }); const o = { prep: !!P.prep, sc0, sc1: SF.count(P.pack, sp.scroll), mana: P.mana, mp: sp.mp }; S.save(); return o; }""")
    cont(pg)
    r2 = J(pg, """() => { const S = __SF, P = S.P, SF = S.SF, sp = SF.SPELL['magery.01']; return { prep: !!P.prep, held: !!P.held, sc: SF.count(P.pack, sp.scroll), mana: P.mana }; }""")
    cost = (r['mp'] + 1) // 2
    check(r['prep'] and r['sc1'] == r['sc0'] - 1 and not r2['prep'] and not r2['held'] and r2['sc'] == r['sc0'] and r['mana'] + r['mp'] - cost - .01 <= r2['mana'] < r['mana'] + r['mp'] - cost + 1.5,
          f'[{tag}] a preparation saved mid-cast is interrupted on load: scroll back, {cost} mana spent', [r, r2])
    J(pg, '__SF.save()'); cont(pg)
    r3 = J(pg, """() => { const S = __SF, P = S.P, SF = S.SF, sp = SF.SPELL['magery.01']; return { sc: SF.count(P.pack, sp.scroll), mana: P.mana, prep: !!P.prep }; }""")
    check(r3['sc'] == r2['sc'] and not r3['prep'] and r3['mana'] < r2['mana'] + 1.5, f'[{tag}] the refund happens once, not again on the next reload', [r2, r3])

    # ---- A04: poison resumes after a reload
    r = J(pg, """() => { const S = __SF, P = S.P; P.hp = S.SF.maxHp(P); P.poison = { tier: 1, ticks: 4, next: S.GT + 1.5 }; S.save(); return true; }""")
    cont(pg)
    r2 = J(pg, "() => { const p = __SF.P.poison; return p && { tier: p.tier, ticks: p.ticks, nextIn: p.next - __SF.GT }; }")
    check(r2 and r2['tier'] == 1 and 3 <= r2['ticks'] <= 4 and r2['nextIn'] <= 1.5, f'[{tag}] poison resumes after a reload', r2)
    J(pg, "() => { __SF.P.poison = null; __SF.save(); }")

    # ---- death: body and its contents survive a reload; units conserved
    before = J(pg, UNITS)
    J(pg, "() => { const S = __SF; S.damagePlayer(99999, null, 'phys'); S.save(); }")
    mid = J(pg, UNITS); cont(pg); after = J(pg, UNITS)
    body = J(pg, "() => __SF.ents.filter(e => e.mine && !e.gone).length")
    check(body == 1 and after['units'] == mid['units'] and after['dupUid'] == 0 and not after['bad'], f'[{tag}] after death the body reloads once with everything on it', [mid, after])

    # ---- A06: the loot panel shows total carried weight against the carrying limit, not the old 45-stack pack limit
    h = J(pg, """() => { const S = __SF, P = S.P, SF = S.SF; P.ghost = false; P.hp = SF.maxHp(P); const pile = SF.newContainer('pile'); pile.items.push(SF.newItem('gold', 3));
      const e = S.addEnt({ kind: 'corpse', pile: true, name: 'dropped items', x: P.x, y: P.y, cont: pile, expires: S.GT + 60 }); P.lootOpen = e; S.openPanel('loot'); const t = document.querySelector('#panel').innerText; const tw = SF.EQ.totalWt(P), cw = SF.EQ.capWt(P); S.closePanel(); return { t, tw, cw }; }""")
    check('/ 45' not in h['t'] and ('/ %d' % round(h['cw'])) in h['t'], f'[{tag}] loot panel shows weight against the carrying limit', h)

    check(not errs, f'[{tag}] no page or console errors in the save/reload run', errs[:5])
    ctx.close()

  # ---- A05: damaged saves never crash the start screen and are never silently overwritten
  ctx, pg, errs = page(b, True); fresh(pg, 'Good'); J(pg, '__SF.save()')
  cont(pg); lastgood = J(pg, "() => !!localStorage.getItem('shardfall.save.v1.lastgood')")
  check(lastgood, 'a successful load keeps the save as the last good one')
  cases = [('missing character', '{"v":7}'), ('truncated', None), ('future version', 'FUTURE'), ('not an object', '[1,2,3]'), ('bad numbers', 'BADNUM'), ('empty object', '{}')]
  for name, val in cases:
    raw = J(pg, "() => localStorage.getItem('shardfall.save.v1.lastgood')")
    if val is None: val = raw[:len(raw) // 2]
    elif val == 'FUTURE': o = json.loads(raw); o['v'] = 99; val = json.dumps(o)
    elif val == 'BADNUM': o = json.loads(raw); o['char']['x'] = None; val = json.dumps(o)
    errs.clear(); put(pg, val); pg.wait_for_selector('#ccrecover', timeout=6000)
    st = J(pg, """() => ({ cont: !!document.querySelector('[data-c=cont]'), restore: !!document.querySelector('[data-c=restore]'), export: !!document.querySelector('[data-c=export]'), go: !!document.querySelector('[data-c=go]'), kept: localStorage.getItem('shardfall.save.v1') })""")
    check(not st['cont'] and st['restore'] and st['export'] and st['go'] and st['kept'] == val and not [e for e in errs if 'save could not' not in e], f'save {name}: recovery shown, stored save untouched, no crash', [st['cont'], st['restore'], errs[:3]])
  # restore the last good save from the recovery screen
  pg.click('[data-c=restore]'); pg.wait_for_selector('[data-c=cont]'); pg.click('[data-c=cont]'); pg.wait_for_function('window.__SF && __SF.P')
  check(J(pg, '__SF.P.name') == 'Good' and J(pg, "() => !!localStorage.getItem('shardfall.save.v1.damaged')"), 'restore brings back the last good save and keeps the damaged one aside')
  # a new character over a damaged save keeps a copy of it
  put(pg, '{oops'); pg.wait_for_selector('#ccrecover'); pg.fill('#ccn', 'Newer'); pg.click('[data-c=go]'); pg.wait_for_function('window.__SF && __SF.P')
  check(J(pg, "() => localStorage.getItem('shardfall.save.v1.damaged')") == '{oops' and J(pg, '__SF.P.name') == 'Newer', 'a new character over a damaged save keeps the damaged save aside')
  # a save that fails after migration does not boot into broken data
  raw = J(pg, "() => { __SF.save(); return localStorage.getItem('shardfall.save.v1'); }"); o = json.loads(raw); o['char']['equip'] = 5
  errs.clear(); put(pg, json.dumps(o)); pg.wait_for_selector('[data-c=cont]'); pg.click('[data-c=cont]'); pg.wait_for_selector('#ccrecover', timeout=6000)
  check(J(pg, '!!(window.__SF && __SF.P)') is False and J(pg, "() => localStorage.getItem('shardfall.save.v1')") == json.dumps(o), 'a save whose equipment is broken returns to the recovery screen and stays untouched')
  # duplicate uids and fractional stacks in a stored save are repaired without losing items
  put(pg, raw); pg.wait_for_selector('[data-c=cont]'); pg.click('[data-c=cont]'); pg.wait_for_function('window.__SF && __SF.P')
  r = J(pg, """() => { const S = __SF, P = S.P, SF = S.SF; const g = SF.newItem('gold', 10); P.pack.items.push(g); P.bank.items.push(Object.assign({}, g)); P.pack.items.push({ uid: g.uid + 100000, id: 'arrow', qty: 2.5 }); S.save(); return SF.count(P.pack, 'gold') + SF.count(P.bank, 'gold'); }""")
  cont(pg); u = J(pg, UNITS); g = J(pg, "() => __SF.SF.count(__SF.P.pack, 'gold') + __SF.SF.count(__SF.P.bank, 'gold')")
  check(u['dupUid'] == 0 and not u['bad'] and g == r and J(pg, "() => __SF.SF.count(__SF.P.pack, 'arrow')") >= 2, 'a save with a repeated uid and a fractional stack loads repaired, nothing lost', [u, g, r])
  # two tabs: the older tab stops saving when the newer one writes
  pg2 = ctx.new_page(); pg2.goto(URL); pg2.wait_for_selector('[data-c=cont]'); pg2.click('[data-c=cont]'); pg2.wait_for_function('window.__SF && __SF.P'); J(pg2, '__SF.save()'); pg.wait_for_timeout(300)
  check(J(pg, '__SF.save()') is False and J(pg2, '__SF.save()') is True, 'with two tabs open, only the newest one keeps saving')
  pg2.close()
  # storage full: save reports failure once, the game keeps running
  r = J(pg, """() => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('full', 'QuotaExceededError'); }; const a = __SF.save(); Storage.prototype.setItem = orig; return { a, warned: __SF.LOG.some(l => /could not be saved/.test(l.t || l.text || l[0] || '')) || document.body.innerText.includes('could not be saved') }; }""")
  check(r['a'] is False, 'a full storage makes save() fail cleanly', r)
  check(not [e for e in errs if 'save could not' not in e and 'save failed' not in e], 'no page errors in the recovery run', errs[:5])
  ctx.close(); b.close()
print(fails and f'{fails} FAILED' or 'ALL PASS'); sys.exit(1 if fails else 0)
