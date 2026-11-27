# Browser check for backpack icons v1.0.1 (v1.0.0 pack + the seven missing icons; needs Python Playwright + Chrome).
# usage: python3 tests/backpack-smoke/icons.py Shardfall_vX.html [/path/to/chrome]
# Every id in the pack's items.json must be a game item and render its own atlas tile in the slot, the hover
# tooltip and the tap card; stack counts must stay readable on top of the icons after each sort; desktop and phone.
import sys, os, json, re
from playwright.sync_api import sync_playwright

f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.19.2.html')
chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
html = open(f, encoding='utf8').read()
m = re.search(r'const BAG_ICONS = (\{.*?\});\n', html)
ICONS = json.loads(m.group(1)); RECT = ICONS['rect']; IDS = list(RECT)
fails = []
def check(ok, msg, got=None):
    print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else f'  (got {got!r})'))
    if not ok: fails.append(msg)

NEW = ['heavycrossbow', 'battleaxe', 'mace', 'waraxe', 'kryss', 'spear', 'wick']   # v1.0.1: the seven that had only a category glyph
N = len(IDS)
check(ICONS['version'] == '1.0.1' and N == 161 and all(i in RECT for i in NEW), 'embedded pack is v1.0.1 with 161 icons (154 + the seven missing)', (ICONS['version'], N))

FILL = """ids => { const S = __SF, P = S.P, SF = S.SF; P.pack.items.length = 0;
  ids.forEach((id, i) => SF.addItem(P.pack, SF.newItem(id, SF.ITEMS[id].stack ? 1 + (i * 37) % 250 : 1), { slots: 999, kg: 1e9 })); }"""
TILES = """() => [...document.querySelectorAll('#panel .bagcell')].map(c => { const i = c.querySelector('.bagico'), t = c.querySelector('.bagtip .bagico'), it = __SF.findU ? null : null;
  return { u: +c.dataset.u, icon: i && i.dataset.icon, pos: i && i.style.backgroundPosition, size: i && i.style.width, tip: t && t.dataset.icon, glyph: !!c.querySelector('.bagglyph') }; })"""
UID2ID = "() => Object.fromEntries(__SF.P.pack.items.map(i => [i.uid, i.id]))"
BADGES = """() => [...document.querySelectorAll('#panel .bagcell strong')].map(s => { s.parentElement.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(), c = s.parentElement.getBoundingClientRect(), cs = getComputedStyle(s);
  s.style.pointerEvents = 'auto'; const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); s.style.pointerEvents = '';  // the badge ignores taps; probe its stacking
  return { txt: s.textContent, inside: r.left >= c.left && r.right <= c.right && r.top >= c.top && r.bottom <= c.bottom, onTop: top === s, hit: top ? top.tagName + '.' + top.className : null, px: parseFloat(cs.fontSize), bg: cs.backgroundColor, w: r.width, scroll: s.scrollWidth <= Math.ceil(r.width) }; })"""

def start(pg, errs):
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + f); pg.wait_for_timeout(600)
    pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(600)
    pg.evaluate("o => __CC.quick(o)", {'name': 'Tess', 'template': 'mage'}); pg.wait_for_timeout(1200)

def batches(n):
    for i in range(0, len(IDS), n): yield IDS[i:i + n]

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
    # ---------- ids and atlas pixels ----------
    ctx = b.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page(); errs = []
    start(pg, errs)
    missing = pg.evaluate("ids => ids.filter(id => !__SF.SF.ITEMS[id])", IDS)
    check(not missing, f'all {N} icon ids are game item ids', missing)
    noicon = pg.evaluate("ids => Object.keys(__SF.SF.ITEMS).filter(id => !ids.includes(id))", IDS)
    print('     game items without a painted icon (category glyph):', noicon)
    check(not [i for i in NEW if i in noicon], 'the seven formerly missing items now have painted icons', [i for i in NEW if i in noicon])
    empty = pg.evaluate("""async ([src, rect]) => { const im = new Image(); im.src = src; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0); return Object.entries(rect).filter(([k, r]) => { const d = g.getImageData(...r).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 16) n++; return n < 40; }).map(e => e[0]); }""", [ICONS['src'], RECT])
    check(not empty, 'every rect crops a painted (non-empty) tile from the atlas', empty)
    loaded = pg.evaluate("() => { const e = document.createElement('i'); e.className = 'bagico'; document.body.appendChild(e); const u = getComputedStyle(e).backgroundImage; e.remove(); return u.startsWith('url(\"data:image/png'); }")
    check(loaded, 'atlas is applied once through the .bagico CSS rule')

    # ---------- every id renders in slot + tooltip + card (desktop) ----------
    seen, wrong = set(), []
    for chunk in batches(40):
        pg.evaluate(FILL, chunk); pg.evaluate("__SF.ACT.bag()"); pg.wait_for_timeout(120)
        u2i = pg.evaluate(UID2ID)
        for t in pg.evaluate(TILES):
            want = u2i[str(t['u'])]; r = RECT[want]; k = 40 / r[2]
            exp = f"{-r[0] * k:g}px {-r[1] * k:g}px".replace('-0px', '0px')
            pos = (t['pos'] or '').replace('-0px', '0px')
            if t['icon'] != want or t['tip'] != want or pos != exp or t['size'] != '40px': wrong.append((want, t))
            else: seen.add(want)
    check(not wrong, 'each slot and its tooltip show the icon matching the item id', wrong[:5])
    check(len(seen) == N, f'all {N} ids resolved to a rendered icon', N - len(seen))

    # hover and card on a mixed pack
    MIX = ['sword', 'heavycrossbow', 'kryss', 'wick', 'chain', 'bandage', 'draught', 'gold', 'reedash', 'pine', 'scroll.18', 'black_pearl', 'spellbook', 'arrow']
    pg.evaluate(FILL, MIX); pg.evaluate("__SF.ACT.bag()"); pg.wait_for_timeout(150)
    cell = lambda id: f'#panel .bagcell:has(.bagico[data-icon="{id}"])'
    pg.hover(cell('scroll.18')); pg.wait_for_timeout(120)
    tip = pg.eval_on_selector(cell('scroll.18') + ' .bagtip', "e => ({ d: getComputedStyle(e).display, i: e.querySelector('.bagico')?.dataset.icon, w: e.querySelector('.bagico')?.getBoundingClientRect().width, t: e.innerText })")
    check(tip['d'] == 'block' and tip['i'] == 'scroll.18' and round(tip['w']) == 56 and 'Cinderball' in tip['t'], 'desktop hover tooltip shows the same icon at 56 px', tip)
    pg.screenshot(path='/tmp/bag-icons-desktop-hover.png')
    pg.mouse.move(5, 5); pg.click(cell('sword')); pg.wait_for_timeout(120)
    card = pg.evaluate("() => { const c = document.querySelector('#panel .bagcard'); const i = c && c.querySelector('.baghead .bagico'); return c && { i: i && i.dataset.icon, title: c.querySelector('span').textContent, acts: c.querySelectorAll('button').length }; }")
    check(card and card['i'] == 'sword' and 'sword' in card['title'].lower() and card['acts'] > 0, 'click card shows the same icon with title and actions', card)
    pg.evaluate("() => { const SF = __SF.SF; SF.ITEMS.__noicon = { n: 'Test trinket', kg: .1, cat: 'tool' }; SF.addItem(__SF.P.pack, SF.newItem('__noicon', 1), { slots: 999, kg: 1e9 }); __SF.ACT.bag(); }"); pg.wait_for_timeout(100)
    gl = pg.evaluate("() => !!document.querySelector('#panel .bagcell .bagglyph')")
    pg.evaluate("() => { const P = __SF.P; P.pack.items = P.pack.items.filter(i => i.id !== '__noicon'); delete __SF.SF.ITEMS.__noicon; __SF.ACT.bag(); }")
    check(gl, 'item without a painted icon falls back to its category glyph')
    # badges after each sort
    for s in ['Category', 'Name', 'Quantity']:
        pg.click(f'#panel [data-a=bagsort][data-s="{s}"]'); pg.wait_for_timeout(120)
        bs = pg.evaluate(BADGES); bad = [x for x in bs if not (x['inside'] and x['onTop'] and x['px'] >= 12 and x['scroll'] and x['bg'] != 'rgba(0, 0, 0, 0)')]
        check(bs and not bad, f'{s} sort: stack counts sit on top of icons, inside the tile, ≥12 px, on a backing', bad[:3])
    qs = [int(x['txt']) for x in pg.evaluate(BADGES)]
    check(qs == sorted(qs, reverse=True), 'Quantity sort order intact with icons', qs)
    pg.evaluate(FILL, ['arrow']); pg.evaluate("() => { const it = __SF.P.pack.items[0]; it.qty = 9999; }"); pg.evaluate("__SF.ACT.bag()"); pg.wait_for_timeout(100)
    bs = pg.evaluate(BADGES)
    check(bs and bs[0]['txt'] == '9999' and bs[0]['inside'] and bs[0]['scroll'], 'a 4-digit stack count still fits the tile', bs)
    pg.evaluate(FILL, IDS[:45]); pg.evaluate("__SF.ACT.bag()"); pg.wait_for_timeout(150); pg.click('#panel [data-a=bagsort][data-s="Quantity"]'); pg.wait_for_timeout(100)
    pg.screenshot(path='/tmp/bag-icons-desktop.png')
    check(not errs, 'no page errors on desktop', errs); ctx.close()

    # ---------- phone ----------
    for vw, vh in [(844, 390), (667, 375)]:  # phones play in landscape (portrait shows the rotate prompt)
        ctx = b.new_context(viewport={'width': vw, 'height': vh}, has_touch=True, is_mobile=True, device_scale_factor=3); pg = ctx.new_page(); errs = []
        start(pg, errs)
        pg.evaluate(FILL, MIX); pg.evaluate("__SF.ACT.bag()"); pg.wait_for_timeout(200)
        pg.tap(cell('black_pearl')); pg.wait_for_timeout(150)
        card = pg.evaluate("() => { const c = document.querySelector('#panel .bagcard'); const i = c && c.querySelector('.baghead .bagico'); const r = c && c.getBoundingClientRect(); return c && { i: i && i.dataset.icon, l: r.left, r: r.right }; }")
        check(card and card['i'] == 'black_pearl' and card['l'] >= 0 and card['r'] <= vw, f'phone {vw}x{vh}: tap card shows the same icon and fits', card)
        check(pg.eval_on_selector(cell('black_pearl') + ' .bagtip', 'e => getComputedStyle(e).display') == 'none', f'phone {vw}x{vh}: no floating tooltip on tap')
        for s in ['Name', 'Quantity', 'Category']:
            pg.tap(f'#panel [data-a=bagsort][data-s="{s}"]'); pg.wait_for_timeout(120)
            bs = pg.evaluate(BADGES); bad = [x for x in bs if not (x['inside'] and x['onTop'] and x['px'] >= 12 and x['scroll'])]
            check(bs and not bad, f'phone {vw}x{vh} {s} sort: stack counts readable', bad[:3])
        check(pg.evaluate("() => document.querySelector('#panel .bagcard .baghead .bagico')?.dataset.icon") == 'black_pearl', f'phone {vw}x{vh}: selection and icon survive re-sorting')
        tiles = pg.eval_on_selector_all('#panel .bagcell', 'es => es.map(e => Math.round(e.getBoundingClientRect().height))')
        check(min(tiles) >= 44, f'phone {vw}x{vh}: tiles at least 44 px tall', tiles)
        pg.screenshot(path=f'/tmp/bag-icons-phone-{vw}x{vh}.png')
        check(not errs, f'phone {vw}x{vh}: no page errors', errs); ctx.close()
    b.close()
print('ALL PASS' if not fails else f'{len(fails)} FAILED'); sys.exit(1 if fails else 0)
