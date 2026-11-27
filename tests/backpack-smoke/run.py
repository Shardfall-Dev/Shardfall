# Browser smoke run for the graphical backpack (needs Python Playwright + Chrome).
# usage: python3 tests/backpack-smoke/run.py Shardfall_vX.html [/path/to/chrome]
# Creates a character, fills the pack, saves, reloads and continues the saved character,
# then checks the three sorts, desktop hover stats, phone tap-to-inspect and item actions after sorting.
# v0.29: the inline card became the item popup (#ipop) and the per-tile tooltip the shared delayed tooltip (#itip).
import sys, os, json
from playwright.sync_api import sync_playwright

f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.16.html')
chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
fails = []
def check(ok, msg, got=None):
    print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else f'  (got {got!r})'))
    if not ok: fails.append(msg)

FILL = """() => { const S = __SF, P = S.P, SF = S.SF; P.pack.items.length = 0; P.base.str = P.str = 60;   // fixture: strong enough for the sword and the chain tunic (v0.30 templates start at 65 points)
  for (const [id, q] of [['sword',1],['chain_tunic',1],['bandage',5],['draught',3],['cookedmeat',2],['reedash',12],['pine',4],['gold',40]]) SF.addItem(P.pack, SF.newItem(id, q));
  S.save(); }"""
NAMES = "() => [...document.querySelectorAll('#panel .bagcell small')].map(e => e.textContent)"
GROUPS = "() => [...document.querySelectorAll('#panel .baggroup')].map(e => e.textContent)"
CARD = "() => { const c = document.querySelector('#ipop'); return c && !c.hidden ? { title: c.querySelector('.tiptitle').textContent, acts: [...c.querySelectorAll('.acts button')].map(b => b.textContent) } : null; }"
cell = lambda name: f'#panel .bagcell:has(small:text-is("{name}"))'
sortb = lambda s: f'#panel [data-a=bagsort][data-s="{s}"]'
cardbtn = lambda label: f'#ipop .acts button:text-is("{label}")'
pack = lambda pg: pg.evaluate("() => Object.fromEntries(__SF.P.pack.items.map(i => [i.id, i.qty]))")

SAVE = {}
def start(pg, errs, fresh):
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + f); pg.wait_for_timeout(600)
    if not fresh:  # each browser context has its own storage: bring the saved character over
        pg.evaluate("s => { localStorage.clear(); localStorage.setItem('shardfall.save.v1', s); }", SAVE['raw']); pg.reload(); pg.wait_for_timeout(600)
    if fresh:
        pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(600)
        pg.evaluate("o => __CC.quick(o)", {'name': 'Tess', 'template': 'mage'}); pg.wait_for_timeout(1000)
        pg.evaluate("__SF.P.str = 60; if (__SF.P.base) __SF.P.base.str = 60; __SF.save()")   # v0.30 healers start at STR 20; the sword and chain tunic below want more
        pg.evaluate(FILL); pg.reload(); pg.wait_for_timeout(600)
    pg.click('[data-c=cont]'); pg.wait_for_timeout(900)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
    # ---------- desktop ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page(); errs = []
    start(pg, errs, True)
    got = pack(pg)
    check(got == {'sword': 1, 'chain_tunic': 1, 'bandage': 5, 'draught': 3, 'cookedmeat': 2, 'reedash': 12, 'pine': 4, 'gold': 40}, 'saved character reloads with its pack', got)
    pg.evaluate("__SF.ACT.bag()"); pg.wait_for_timeout(200)
    check(pg.inner_text('#panel .ph b') == 'Backpack', 'backpack panel opens')
    check(pg.evaluate("document.querySelectorAll('body').length") == 1, 'single <body> in built page')
    # sorts
    check(pg.get_attribute(sortb('Category'), 'class').split()[-1] == 'on', 'Category is the default sort')
    cat = pg.evaluate(NAMES); groups = pg.evaluate(GROUPS)
    check(groups == ['Armor', 'Coin', 'Food', 'Medic', 'Potion', 'Reagent', 'Timber', 'Weapon'], 'Category sort: groups in order', groups)
    check(cat == ['Iron chainmail tunic', 'Gold', 'Roast meat', 'Bandage', 'Healing draught', 'Reed ash', 'Pine log', 'Iron Quay sword'], 'Category sort: tiles in order', cat)
    pg.click(sortb('Name')); pg.wait_for_timeout(100)
    nm = pg.evaluate(NAMES)
    check(nm == sorted(nm, key=str.lower) and len(nm) == 8 and pg.evaluate(GROUPS) == [], 'Name sort: alphabetical, no group headers', nm)
    pg.click(sortb('Quantity')); pg.wait_for_timeout(100)
    qt = pg.evaluate("() => [...document.querySelectorAll('#panel .bagcell')].map(c => +(c.querySelector('strong')?.textContent || 1))")
    check(qt == sorted(qt, reverse=True) and qt[0] == 40, 'Quantity sort: largest stacks first', qt)
    check(pg.get_attribute(sortb('Quantity'), 'class').split()[-1] == 'on', 'active sort button is highlighted')
    # hover stats
    tipvis = lambda: pg.evaluate("() => !document.querySelector('#itip').hidden")
    check(not tipvis(), 'tooltip hidden before hover')
    pg.hover(cell('Iron Quay sword')); pg.wait_for_timeout(420)
    tip = pg.inner_text('#itip')
    check(tipvis() and 'Damage' in tip and 'Speed' in tip and 'Weight' in tip, 'desktop hover shows weapon stats (damage, speed, weight units)', tip)
    pg.hover(cell('Iron chainmail tunic')); pg.wait_for_timeout(420)
    check('Armor protection' in pg.inner_text('#itip') and 'Chainmail' in pg.inner_text('#itip') and 'Iron Quay sword' not in pg.inner_text('#itip'), 'hover moves to armor stats')
    pg.mouse.move(5, 5)
    # actions after sorting (Quantity sort still active)
    pg.click(cell('Healing draught')); pg.wait_for_timeout(100)
    card = pg.evaluate(CARD)
    check(card and card['title'] == '3 × Healing draught' and 'Use' in card['acts'] and 'Drop' in card['acts'], 'click pins draught card with actions', card)
    pg.evaluate("__SF.P.hp = 5"); pg.click(cardbtn('Use')); pg.wait_for_timeout(100)
    check(pack(pg).get('draught') == 2 and pg.evaluate(CARD)['title'] == '2 × Healing draught', 'Use after Quantity sort consumes the selected stack', pack(pg))
    pg.click(sortb('Name')); pg.wait_for_timeout(100)
    pg.click(cell('Iron Quay sword')); pg.click(cardbtn('Equip')); pg.wait_for_timeout(100)
    check(pg.evaluate("__SF.P.equip.weapon && __SF.P.equip.weapon.id") == 'sword' and 'sword' not in pack(pg), 'Equip after Name sort equips the sword')
    check(pg.evaluate(CARD) is None, 'card closes when the item leaves the pack')
    pg.click(sortb('Category')); pg.wait_for_timeout(100)
    pg.click(cell('Pine log')); pg.click(cardbtn('Drop')); pg.wait_for_timeout(100)
    check('pine' not in pack(pg) and pack(pg).get('reedash') == 12, 'Drop after Category sort drops only the pine', pack(pg))
    pg.click(cell('Bandage')); pg.click(cardbtn('Slot')); pg.wait_for_timeout(100)
    check(pg.evaluate("__SF.PANEL") == 'assign' and 'Bandage' in pg.inner_text('#panel'), 'Slot opens hotbar assignment for the bandage')
    pg.evaluate("__SF.ACT.bag()"); pg.wait_for_timeout(100)
    pg.click(cell('Iron chainmail tunic')); pg.click(cardbtn('Identify')); pg.wait_for_timeout(100)
    check(not errs, 'Identify (Item Identification) runs without errors', errs)
    pg.evaluate("__SF.ACT.bag()"); pg.click(cell('Roast meat')); pg.click(cell('Roast meat')); pg.wait_for_timeout(100)
    check(pg.evaluate(CARD) is None, 'clicking the selected tile again closes the card')
    pg.evaluate("__SF.save()"); SAVE['raw'] = pg.evaluate("localStorage.getItem('shardfall.save.v1')")
    check(not errs, 'no page errors on desktop', errs); ctx.close()

    # ---------- phone ----------
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True, device_scale_factor=3); pg = ctx.new_page(); errs = []
    start(pg, errs, False)
    check(pg.evaluate("__SF.P.equip.weapon && __SF.P.equip.weapon.id") == 'sword' and pack(pg).get('draught') == 2, 'phone continues the same saved character')
    pg.evaluate("__SF.ACT.bag()"); pg.wait_for_timeout(200)
    check(pg.evaluate("matchMedia('(hover:hover)').matches") is False, 'phone context has no hover')
    pg.tap(cell('Iron chainmail tunic')); pg.wait_for_timeout(150)
    card = pg.evaluate(CARD)
    check(card and card['title'] == 'Iron chainmail tunic' and 'Equip' in card['acts'], 'tap pins armor card', card)
    check(pg.evaluate("document.querySelector('#itip').hidden"), 'no floating tooltip on phone tap')
    box = pg.eval_on_selector('#ipop', 'e => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.width]; }')
    check(box[0] >= 0 and box[1] <= 844, 'card fits phone width', box)
    tiles = pg.eval_on_selector_all('#panel .bagcell', 'es => es.map(e => Math.round(e.getBoundingClientRect().height))')
    check(min(tiles) >= 44, 'tiles are at least 44 px tall', tiles)
    pg.screenshot(path='/tmp/backpack-phone.png')
    pg.tap('#ipop .ipx'); pg.wait_for_timeout(100)   # v0.29: the popup may cover the sort bar on a small phone; its × closes it
    check(pg.evaluate(CARD) is None, 'the popup × closes it')
    pg.tap(sortb('Quantity')); pg.wait_for_timeout(100)
    pg.tap(cell('Iron chainmail tunic')); pg.wait_for_timeout(100)
    check(pg.evaluate(CARD)['title'] == 'Iron chainmail tunic', 'after re-sorting the tile opens its own popup')
    pg.tap(cardbtn('Equip')); pg.wait_for_timeout(100)
    check(pg.evaluate("__SF.P.equip.chest && __SF.P.equip.chest.id") == 'chain_tunic', 'tap Equip after sort equips the armor')
    pg.tap(cell('Bandage')); pg.wait_for_timeout(100); pg.evaluate("__SF.P.hp = 5"); pg.tap(cardbtn('Bandage self')); pg.wait_for_timeout(300)
    check(not errs, 'tap Bandage self on bandage runs without errors', errs)
    pg.tap(cell('Gold')); pg.wait_for_timeout(100); pg.tap('#ipop .ipx'); pg.wait_for_timeout(100)
    check(pg.evaluate(CARD) is None, 'the × closes the popup')
    pg.evaluate("__SF.save()"); SAVE['raw'] = pg.evaluate("localStorage.getItem('shardfall.save.v1')")
    check(not errs, 'no page errors on phone', errs); ctx.close()

    # desktop screenshot
    ctx = b.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page(); errs = []
    start(pg, errs, False); pg.evaluate("__SF.ACT.bag()"); pg.wait_for_timeout(200); pg.hover(cell('Healing draught')); pg.wait_for_timeout(150)
    pg.screenshot(path='/tmp/backpack-desktop.png'); ctx.close()
    b.close()
print('ALL PASS' if not fails else f'{len(fails)} FAILED'); sys.exit(1 if fails else 0)
