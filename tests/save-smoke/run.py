# Save round trips and damaged saves in the built game (needs Python Playwright + Chrome). v0.28.1 audit A03-A05.
# usage: python3 tests/save-smoke/run.py Shardfall_vX.html [/path/to/chrome]
#   1. dropped piles survive a reload with their items; units are conserved, no uid appears twice
#   2. an opened chest stays opened (same contents, same refill time) after a reload: no fresh loot from reloading
#   3. a spell saved mid-preparation is settled once on load as an interrupt (reagents back, half the mana spent)
#   4. poison survives a reload
#   5. damaged saves (no character, truncated JSON, a future version, a migration that throws) are reported, never
#      treated as "no save", never crash the page, and a copy is kept before a new character replaces them
import sys, os, json
from playwright.sync_api import sync_playwright

f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.28.3.html')
chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
fails = []
def check(ok, msg, got=None):
    print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else f'  (got {got!r})'))
    if not ok: fails.append(msg)

UNITS = """() => { const S = __SF, P = S.P, m = {}, uids = [], add = c => c.items.forEach(it => { m[it.id] = (m[it.id] || 0) + it.qty; uids.push(it.uid); });
  add(P.pack); add(P.bank); Object.values(P.equip).forEach(it => it && (m[it.id] = (m[it.id] || 0) + it.qty, uids.push(it.uid)));
  S.ents.filter(e => e.kind === 'corpse' && e.cont && !e.gone).forEach(e => add(e.cont));
  for (const c of S.CHESTS.values()) if (c.cont) add(c.cont);
  return { gold: m.gold || 0, ore: m.ore || 0, uids: uids.length, unique: new Set(uids).size }; }"""

def page(b):
    ctx = b.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + f); pg.wait_for_timeout(500)
    return ctx, pg, errs

def fresh(pg):
    pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(500)
    pg.click('[data-c=prof][data-p="Group healer"]'); pg.fill('#ccn', 'Tess'); pg.click('[data-c=go]'); pg.wait_for_timeout(900)

def put(pg, raw):   # leave the running game first (it saves on unload), then plant the save and open the start screen
    pg.reload(); pg.wait_for_timeout(400)
    pg.evaluate("s => { localStorage.clear(); localStorage.setItem('shardfall.save.v1', s); }", raw); pg.reload(); pg.wait_for_timeout(500)

def reload_continue(pg):
    pg.evaluate('__SF.save()'); pg.reload(); pg.wait_for_timeout(500); pg.click('[data-c=cont]'); pg.wait_for_timeout(900)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])

    # ---------- 1-4: round trips ----------
    ctx, pg, errs = page(b); fresh(pg)
    pg.evaluate("""() => { const S = __SF, P = S.P, SF = S.SF; SF.addItem(P.pack, SF.newItem('gold', 50)); SF.addItem(P.pack, SF.newItem('ore', 6)); S.save(); }""")
    before = pg.evaluate(UNITS)
    r = pg.evaluate("""() => { const S = __SF, P = S.P, g = P.pack.items.find(i => i.id === 'gold'), o = P.pack.items.find(i => i.id === 'ore');
      S.ACT.drop({ u: g.uid, q: 20 }); S.ACT.drop({ u: o.uid });
      const piles = S.ents.filter(e => e.pile && !e.gone); return { piles: piles.length, items: piles.reduce((a, e) => a + e.cont.items.length, 0) }; }""")
    check(r == {'piles': 1, 'items': 2}, 'two drops make one pile with two stacks', r)
    # 2: open a chest the way picking its lock does
    chest = pg.evaluate("""() => { const S = __SF, P = S.P, SF = S.SF; const [k, c] = [...S.CHESTS][0];
      c.open = true; c.refill = S.GT + 500; c.cont = SF.newContainer('chest'); c.cont.items.push(SF.newItem('gold', 7)); return { k, left: c.refill - S.GT }; }""")
    # 3: prepare First spell for real (book + reagents), save mid-preparation
    prep = pg.evaluate("""() => { const S = __SF, P = S.P, SF = S.SF; if (!P.pack.items.some(i => i.id === 'spellbook')) SF.addItem(P.pack, SF.newItem('spellbook', 1, { spells: ['magery.01'] }));
      else P.pack.items.find(i => i.id === 'spellbook').spells = (P.pack.items.find(i => i.id === 'spellbook').spells || []).concat(['magery.01']);
      SF.addItem(P.pack, SF.newItem('blood_moss', 3)); SF.addItem(P.pack, SF.newItem('nightshade', 3)); P.mana = 30; P.spellReadyAt = 0; P.armed = false;
      const bm = SF.count(P.pack, 'blood_moss'), ns = SF.count(P.pack, 'nightshade');
      S.castSlot('magery.01'); if (P.prep) P.prep.t1 = S.GT + 9999;   // keep it preparing until the save
      return { prep: !!P.prep, mana: P.mana, bm: bm - SF.count(P.pack, 'blood_moss'), ns: ns - SF.count(P.pack, 'nightshade'), bm0: bm }; }""")
    check(prep['prep'] and prep['mana'] == 26 and prep['bm'] == 1 and prep['ns'] == 1, 'preparing reserves 4 mana and one of each reagent', prep)
    # 4: poisoned
    pg.evaluate("() => { const S = __SF; S.P.poison = { tier: 2, ticks: 5, next: S.GT + 1.5 }; }")
    pg.evaluate("() => { __SF.P.mana = 26; }")   # no regeneration between here and the save
    reload_continue(pg)
    after = pg.evaluate(UNITS)
    check(after['gold'] == before['gold'] + 7 and after['ore'] == before['ore'], 'gold and ore conserved through the reload (pile included; chest gold counted)', [before, after])
    check(after['uids'] == after['unique'], 'no uid appears twice across pack, bank, equipment, piles, bodies and chests', after)
    r = pg.evaluate("() => __SF.ents.filter(e => e.pile && !e.gone).map(e => e.cont.items.map(i => i.id + ':' + i.qty).sort().join(','))")
    check(r == ['gold:20,ore:6'], 'the dropped pile is still there with its items', r)
    r = pg.evaluate("k => { const S = __SF, c = S.CHESTS.get(k); return { open: c.open, left: Math.round(c.refill - S.GT), items: c.cont && c.cont.items.map(i => i.id + ':' + i.qty) }; }", chest['k'])
    check(r['open'] and r['items'] == ['gold:7'] and 490 <= r['left'] <= 500, 'the opened chest is still open with the same contents and refill time', r)
    r = pg.evaluate("() => { const S = __SF, P = S.P, SF = S.SF; return { prep: !!P.prep, mana: P.mana, bm: SF.count(P.pack, 'blood_moss'), ns: SF.count(P.pack, 'nightshade'), esc: 'prepEscrow' in P }; }")
    check(r['prep'] is False and r['bm'] == prep['bm0'] and r['ns'] == prep['bm0'] and r['esc'] is False, 'after the reload the preparation is gone and the reagents are back', r)
    mana1 = r['mana']
    r = pg.evaluate("() => { const S = __SF, p = S.P.poison; return p && { tier: p.tier, ticks: p.ticks, nextIn: Math.round((p.next - S.GT) * 10) / 10 }; }")
    check(r is not None and r['tier'] == 2 and r['ticks'] == 5 and 0 <= r['nextIn'] <= 1.5, 'poison survives the reload', r)
    pg.evaluate("m => { __SF.P.mana = m; }", mana1); reload_continue(pg)
    r = pg.evaluate("() => { const S = __SF, P = S.P, SF = S.SF; return { mana: P.mana, bm: SF.count(P.pack, 'blood_moss') }; }")
    regen = r['mana'] - mana1   # the same reload with nothing in escrow: what regeneration alone adds
    check(abs((mana1 - 26) - regen - 2) < .3, 'half the reserved mana is spent, half returned (+2 on top of regeneration)', {'first': mana1 - 26, 'regen': regen})
    check(r['bm'] == prep['bm0'], 'a second reload does not refund again', r)
    check(not errs, 'no page errors in the round trips', errs)
    ctx.close()

    # ---------- 5: damaged saves ----------
    ctx, pg, errs = page(b); fresh(pg); pg.evaluate('__SF.save()')
    good = pg.evaluate("localStorage.getItem('shardfall.save.v1')")
    cases = {
        'no character': json.dumps({k: v for k, v in json.loads(good).items() if k != 'char'}),
        'truncated JSON': good[: len(good) // 2],
        'a future version': json.dumps(dict(json.loads(good), v=99)),
        'a character with no name': json.dumps(dict(json.loads(good), char=dict(json.loads(good)['char'], name=''))),
    }
    for label, raw in cases.items():
        put(pg, raw)
        r = pg.evaluate("() => ({ cont: !!document.querySelector('[data-c=cont]'), warn: (document.querySelector('#ccin .warn') || {}).textContent || '' })")
        check(not r['cont'] and 'could not be loaded' in r['warn'], f'{label}: reported on the start screen, no Continue button', r)
    # a new character over a damaged save keeps a copy of it
    pg.fill('#ccn', 'Rin'); pg.click('[data-c=go]'); pg.wait_for_timeout(900)
    r = pg.evaluate("() => ({ bad: localStorage.getItem('shardfall.save.v1.bad'), name: __SF.P && __SF.P.name })")
    check(r['bad'] is not None and r['name'] == 'Rin', 'creating a new character keeps the damaged save as .bad', {'name': r['name'], 'bad': bool(r['bad'])})
    # a save whose migration throws: not booted, reported, kept
    old = json.loads(good); old['v'] = 5; old['nodes'] = 'damaged'
    put(pg, json.dumps(old))
    pg.click('[data-c=cont]'); pg.wait_for_timeout(1500)
    r = pg.evaluate("() => ({ cont: !!document.querySelector('[data-c=cont]'), cc: !document.querySelector('#cc').hidden, warn: (document.querySelector('#ccin .warn') || {}).textContent || '', kept: localStorage.getItem('shardfall.save.v1') !== null, bad: localStorage.getItem('shardfall.save.v1.bad') !== null })")
    check(r['cc'] and not r['cont'] and 'brought up to date' in r['warn'] and r['kept'] and r['bad'], 'a migration that throws stops the boot, says so, and keeps the save', r)
    check(not errs, 'no page errors with damaged saves', errs)
    # an intact save still continues
    put(pg, good)
    r = pg.evaluate("() => !!document.querySelector('[data-c=cont]')"); check(r, 'an intact save still offers Continue')
    ctx.close(); b.close()

print(f'{len(fails)} FAILED' if fails else 'ALL PASS'); sys.exit(1 if fails else 0)
