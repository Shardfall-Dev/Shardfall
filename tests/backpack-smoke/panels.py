# Browser check for the seven icons added in backpack icons v1.0.1 (needs Python Playwright + Chrome).
# usage: python3 tests/backpack-smoke/panels.py Shardfall_vX.html [/path/to/chrome] [screenshot-dir]
# For heavy crossbow, battle axe, mace, war axe, kryss, spear and the dry wick, every place the game lists an item shows
# the item's own atlas tile: backpack tile, desktop hover tooltip, tap card, Character (equipment), vendor buy and sell,
# loot, bank and crafting. The weapons keep their stats and equip rules; the wick still drives A Light for the Quay.
# Desktop and two landscape phones.
import sys, os, json, re
from playwright.sync_api import sync_playwright

f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.24.1.html')
chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
shots = sys.argv[3] if len(sys.argv) > 3 else os.environ.get('BAG_SHOTS', '/tmp/bag-panels')
os.makedirs(shots, exist_ok=True)
html = open(f, encoding='utf8').read()
ICONS = json.loads(re.search(r'const BAG_ICONS = (\{.*?\});\n', html).group(1)); RECT = ICONS['rect']
NEW = ['heavycrossbow', 'battleaxe', 'mace', 'waraxe', 'kryss', 'spear', 'wick']
WEAPONS = NEW[:-1]
fails = []
def check(ok, msg, got=None):
    print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else f'  (got {got!r})'))
    if not ok: fails.append(msg)

check(all(i in RECT for i in NEW), 'all seven ids are in the embedded atlas map', [i for i in NEW if i not in RECT])

def start(pg, errs):
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + f); pg.wait_for_timeout(600)
    pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(600)
    pg.click('[data-c=prof][data-p="Group healer"]'); pg.fill('#ccn', 'Tess'); pg.click('[data-c=go]'); pg.wait_for_timeout(1200)
    pg.evaluate("() => { const P = __SF.P; P.str = 100; P.pack.items.length = 0; }")   # strong enough for every weapon, empty pack

FILL = """ids => { const S = __SF, P = S.P, SF = S.SF; P.pack.items.length = 0;
  ids.forEach(id => SF.addItem(P.pack, SF.newItem(id, 1), { slots: 999, kg: 1e9 })); }"""
# which item ids the open panel shows icons for, and whether each icon element is the expected atlas tile at the expected size
ICONS_IN = """sel => [...document.querySelectorAll(sel)].map(i => { const r = i.getBoundingClientRect(); return { id: i.dataset.icon, w: Math.round(r.width), h: Math.round(r.height), pos: i.style.backgroundPosition, vis: r.width > 0 && getComputedStyle(i).backgroundImage.startsWith('url("data:image/png') }; })"""
def pos_for(id, size):
    r = RECT[id]; k = size / r[2]
    return f"{-r[0] * k:g}px {-r[1] * k:g}px".replace('-0px', '0px')
def icons_ok(got, ids, size, where):
    by = {}
    for g in got: by.setdefault(g['id'], g)
    miss = [i for i in ids if i not in by]
    bad = [(i, by[i]) for i in ids if i in by and not (by[i]['w'] == size and by[i]['h'] == size and by[i]['vis'] and (by[i]['pos'] or '').replace('-0px', '0px') == pos_for(i, size))]
    check(not miss and not bad, f'{where}: {len(ids)} icons, each its own tile at {size} px', (miss, bad[:2]))

def run(pg, tag, phone):
    # ---------- backpack: tile, tooltip (desktop) or tap card (phone) ----------
    pg.evaluate(FILL, NEW); pg.evaluate("__SF.ACT.bag()"); pg.wait_for_timeout(150)
    icons_ok(pg.evaluate(ICONS_IN, '#panel .bagcell > .bagico'), NEW, 40, f'{tag} backpack tiles')
    check(not pg.evaluate("() => document.querySelector('#panel .bagcell > .bagglyph')"), f'{tag} backpack: no category glyph left for the seven')
    cell = lambda id: f'#panel .bagcell:has(> .bagico[data-icon="{id}"])'
    for id in NEW:
        if phone:
            pg.tap(cell(id)); pg.wait_for_timeout(100)
            c = pg.evaluate("() => { const c = document.querySelector('#panel .bagcard'); return c && { i: c.querySelector('.baghead .bagico')?.dataset.icon, t: c.innerText }; }")
            check(c and c['i'] == id, f'{tag} tap card for {id} shows its icon', c)
            pg.tap(cell(id)); pg.wait_for_timeout(80)   # deselect
        else:
            pg.hover(cell(id)); pg.wait_for_timeout(100)
            t = pg.eval_on_selector(cell(id) + ' .bagtip', "e => ({ d: getComputedStyle(e).display, i: e.querySelector('.bagico')?.dataset.icon, w: Math.round(e.querySelector('.bagico')?.getBoundingClientRect().width), t: e.innerText })")
            want = 'Base damage' if id in WEAPONS else 'Quest'
            check(t['d'] == 'block' and t['i'] == id and t['w'] == 56 and want in t['t'], f'{tag} hover tooltip for {id}: icon at 56 px, stats intact', t)
    if not phone: pg.hover(cell('wick')); pg.wait_for_timeout(80)
    else: pg.tap(cell('heavycrossbow')); pg.wait_for_timeout(100)
    pg.screenshot(path=f'{shots}/{tag}-backpack.png')
    if phone: pg.tap(cell('heavycrossbow')); pg.wait_for_timeout(80)
    pg.mouse.move(2, 2)

    # ---------- equipment: each weapon equips, keeps its stats, and shows its icon on the Character panel ----------
    for id in WEAPONS:
        pg.evaluate(FILL, [id])
        r = pg.evaluate("""id => { const S = __SF, P = S.P, SF = S.SF, it = P.pack.items[0]; S.ACT.equip({ u: it.uid });
          const w = SF.WEAPONS[SF.ITEMS[id].wpn], cur = S.W; S.openPanel('gear');
          const i = document.querySelector('#panel .row > .bagico[data-icon="' + id + '"]');
          return { eq: P.equip.weapon && P.equip.weapon.id, same: cur === w, n: w && w.n, icon: !!i, w: i && Math.round(i.getBoundingClientRect().width) }; }""", id)
        check(r['eq'] == id and r['same'] and r['icon'] and r['w'] == 28, f'{tag} equipment: {id} equips with its own weapon profile and shows its icon', r)
        if id == 'heavycrossbow': pg.screenshot(path=f'{shots}/{tag}-equipment.png')
    pg.evaluate("() => { const S = __SF; if (S.P.equip.weapon) S.ACT.uneq({ s: 'weapon' }); }")

    # ---------- vendors: Harl (smith) and the workshop sell the weapons; selling shows the icon too ----------
    for role, ids in [('smith', ['kryss', 'spear', 'battleaxe', 'mace', 'waraxe']), ('workshop', ['heavycrossbow'])]:
        ok = pg.evaluate("""role => { const S = __SF, P = S.P, n = S.ents.find(e => e.kind === 'npc' && e.role === role); if (!n) return false;
          P.x = n.x + 1; P.y = n.y; P.talkTo = n; S.openPanel('shop', 'buy'); return true; }""", role)
        check(ok, f'{tag} found a {role} vendor')
        icons_ok(pg.evaluate(ICONS_IN, '#panel .row > .bagico'), ids, 28, f'{tag} {role} buy list')
        if role == 'smith': pg.screenshot(path=f'{shots}/{tag}-vendor-buy.png')
    pg.evaluate(FILL, NEW); pg.evaluate("() => __SF.ACT.tab({ t: 'sell' })"); pg.wait_for_timeout(80)
    icons_ok(pg.evaluate(ICONS_IN, '#panel .row > .bagico'), WEAPONS, 28, f'{tag} vendor sell list')
    check(not pg.evaluate("() => document.querySelector('#panel .row > .bagico[data-icon=wick]')"), f'{tag} vendor sell list: the quest wick still cannot be sold')
    pg.screenshot(path=f'{shots}/{tag}-vendor-sell.png')
    pg.evaluate("() => { __SF.P.talkTo = null; }")

    # ---------- loot: a body holding the seven; taking one moves it with its icon into the pack ----------
    r = pg.evaluate("""ids => { const S = __SF, P = S.P, SF = S.SF; P.pack.items.length = 0; const cont = SF.newContainer('corpse'); cont.diedAt = S.GT - 999; cont.expires = S.GT + 600;
      ids.forEach(id => cont.items.push(SF.newItem(id, 1))); const c = S.addEnt({ kind: 'corpse', name: 'test remains', t0: S.GT, x: P.x + .5, y: P.y, cont, expires: S.GT + 600, skinned: true });
      P.lootOpen = c; S.openPanel('loot'); return !!document.querySelector('#panel'); }""", NEW)
    icons_ok(pg.evaluate(ICONS_IN, '#panel .row > .bagico'), NEW, 28, f'{tag} loot window')
    pg.screenshot(path=f'{shots}/{tag}-loot.png')
    took = pg.evaluate("""() => { const S = __SF, c = S.P.lootOpen, it = c.cont.items.find(i => i.id === 'kryss'); S.ACT.take({ u: it.uid }); S.ACT.bag();
      return { pack: S.P.pack.items.map(i => i.id), icon: !!document.querySelector('#panel .bagcell > .bagico[data-icon=kryss]') }; }""")
    check('kryss' in took['pack'] and took['icon'], f'{tag} loot: a taken kryss lands in the pack with its icon', took)
    pg.evaluate("() => { const S = __SF; S.P.lootOpen.expires = 0; S.P.lootOpen = null; }")

    # ---------- bank ----------
    pg.evaluate("""ids => { const S = __SF, P = S.P, SF = S.SF; P.bank.items.length = 0; ids.forEach(id => SF.addItem(P.bank, SF.newItem(id, 1), { slots: 999, kg: 1e9 })); S.openPanel('bank'); }""", NEW)
    icons_ok(pg.evaluate(ICONS_IN, '#panel .row > .bagico'), NEW, 28, f'{tag} bank')
    pg.evaluate("() => { __SF.P.bank.items.length = 0; }")

    # ---------- crafting: recipe rows and inputs show their outputs' and inputs' tiles; none of the seven is craftable ----------
    makes = pg.evaluate("ids => __SF.SF.RECIPES.filter(r => ids.includes(r.out)).map(r => r.id)", NEW)
    check(makes == [], f'{tag} crafting: no recipe makes the seven (they come from vendors and the Quaywarden), as before', makes)
    for st in ['anvil', 'bench']:
        pg.evaluate("st => { const S = __SF; const b = S.STATIONS.find(s => s.k === st); S.P.x = b.x + .5; S.P.y = b.y + 1.5; S.interact(); }", st)
        pg.wait_for_timeout(120)
        rows = pg.evaluate("""() => [...document.querySelectorAll('#panel .crow')].map(c => ({ r: c.dataset.r, out: __SF.SF.RECIPE[c.dataset.r].out, i: c.querySelector(':scope > .bagico, :scope > .bagglyph')?.dataset.icon || (c.querySelector(':scope > .bagglyph') ? 'glyph' : null) }))""")
        bad = [x for x in rows if not (x['i'] == x['out'] or (x['i'] == 'glyph' and x['out'] not in RECT))]
        check(rows and not bad, f'{tag} crafting at the {st}: each recipe row shows its output\'s tile', (len(rows), bad[:3]))
        if rows:
            pg.click(f'#panel .crow[data-r="{rows[0]["r"]}"]'); pg.wait_for_timeout(100)
            ins = pg.evaluate("() => [...document.querySelectorAll('#panel .pb > .row > .bagico, #panel .pb > .row > .bagglyph')].length")
            check(ins > 0, f'{tag} crafting detail at the {st}: input lines carry icons', ins)
            pg.screenshot(path=f'{shots}/{tag}-crafting-{st}.png')
        pg.evaluate("() => __SF.ACT.close && __SF.ACT.close()")

    # ---------- the wick: A Light for the Quay ----------
    q = pg.evaluate("""() => { const S = __SF, P = S.P, SF = S.SF; P.pack.items.length = 0; const Q = S.Q; Q.beacon = 0; delete Q.crabDead;
      S.ACT.qaccept(); const got = SF.count(P.pack, 'wick'); S.ACT.bag();
      const icon = !!document.querySelector('#panel .bagcell > .bagico[data-icon=wick]');
      Q.crabDead = true; P.x = S.LM.beacon.x + 1.5; P.y = S.LM.beacon.y + .5; S.interact();
      return { got, icon, beacon: Q.beacon, left: SF.count(P.pack, 'wick'), cat: SF.ITEMS.wick.cat, trade: !!SF.ITEMS.wick.trade }; }""")
    check(q['got'] == 1 and q['icon'], f'{tag} storm beacon quest: accepting gives the dry wick, shown with its icon', q)
    check(q['beacon'] == 2 and q['left'] == 0 and q['cat'] == 'quest' and not q['trade'], f'{tag} storm beacon quest: lighting the beacon still uses up the wick', q)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page(); errs = []
    start(pg, errs); run(pg, 'desktop', False)
    check(not errs, 'no page errors on desktop', errs); ctx.close()
    for vw, vh in [(844, 390), (667, 375)]:
        ctx = b.new_context(viewport={'width': vw, 'height': vh}, has_touch=True, is_mobile=True, device_scale_factor=3); pg = ctx.new_page(); errs = []
        start(pg, errs); run(pg, f'phone-{vw}x{vh}', True)
        check(not errs, f'phone {vw}x{vh}: no page errors', errs); ctx.close()
    b.close()
print('ALL PASS' if not fails else f'{len(fails)} FAILED'); sys.exit(1 if fails else 0)
