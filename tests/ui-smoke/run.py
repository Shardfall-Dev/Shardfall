# Browser checks for the v0.29 inventory and target-frame rework (Python Playwright + Chrome).
# usage: python3 tests/ui-smoke/run.py Shardfall_vX.html [/path/to/chrome] [screenshot-dir]
# Backpack: no inline card, selection never moves or scrolls the grid (also at the bottom of a 300-stack pack), 300 ms hover
# tooltip kept on screen, click popup with relevant lines and actions, compare, equip, split, drop confirmation, Escape and
# outside-click close without reaching the world, rapid inspection, no listener build-up, phone popup with 44 px buttons.
# Target frame: hidden by default and when walking past, compact top-centre size, 44 px close, pass-through body,
# monster / NPC / deposit / tree / corpse / ally contents, replacement, retention distance with hysteresis, despawn, kill,
# depleted resource, travel, Escape order, closing during combat, no per-frame rebuilds, save and reload unchanged.
import sys, os, json
from playwright.sync_api import sync_playwright

f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.29.html')
chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
shots = sys.argv[3] if len(sys.argv) > 3 else os.environ.get('UI_SHOTS', '/tmp/ui-shots')
os.makedirs(shots, exist_ok=True)
fails = []
def check(ok, msg, got=None):
    print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else f'  (got {got!r})'))
    if not ok: fails.append(msg)

FILL = """n => { const S = __SF, P = S.P, SF = S.SF; P.pack.items.length = 0;
  for (const [id, q] of [['sword',1],['chain_tunic',1],['bandage',5],['draught',3],['pine',4],['gold',40],['reedash',12]]) P.pack.items.push(SF.newItem(id, q));
  for (let i = 0; i < n; i++) P.pack.items.push(SF.newItem('knife', 1));   // many separate stacks: a long, virtualized backpack
  S.save(); }"""
cell = lambda name: f'#panel .bagcell:has(small:text-is("{name}"))'
pack = lambda pg: pg.evaluate("() => { const o = {}; for (const i of __SF.P.pack.items) o[i.id] = (o[i.id] || 0) + i.qty; return o; }")
IPOP = "() => { const e = document.querySelector('#ipop'); return e && !e.hidden ? { t: e.querySelector('.tiptitle')?.textContent, kv: [...e.querySelectorAll('.tipkv span:nth-child(odd)')].map(s => s.textContent), acts: [...e.querySelectorAll('.acts button')].map(b => b.textContent), txt: e.innerText } : null; }"
TGT = "() => { const e = document.querySelector('#tgt'); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(), x = e.querySelector('.tf-x').getBoundingClientRect(); return { n: e.querySelector('.tf-n').textContent, sub: e.querySelector('.tf-sub').textContent, acts: [...e.querySelectorAll('.tf-acts button')].map(b => b.textContent), chips: [...e.querySelectorAll('.tf-chip')].map(b => b.textContent), w: r.width, h: r.height, cx: r.left + r.width / 2, top: r.top, xw: x.width, xh: x.height, hp: !!e.querySelector('.tf-hp') }; }"
STEP = "n => { for (let i = 0; i < n; i++) { __SF.update(.05); __SF.refreshHud(); } }"
HOLD = "([D, n]) => { const S = __SF, m = S.P.sel; for (let i = 0; i < n; i++) { if (S.P.sel === m) { S.P.x = m.x - D; S.P.y = m.y; } S.update(.05); S.refreshHud(); } }"   # keeps the player D tiles from a wandering creature
PLACE = "([dx, dy]) => { const P = __SF.P; P.x += dx; P.y += dy; }"

def start(pg, errs, n=0):
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'fonts.g' not in m.text else None)
    pg.goto('file://' + f); pg.wait_for_timeout(500)
    pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(500)
    pg.click('[data-c=prof][data-p="Group healer"]'); pg.fill('#ccn', 'Tess'); pg.click('[data-c=go]'); pg.wait_for_timeout(900)
    pg.evaluate(FILL, n); pg.reload(); pg.wait_for_timeout(500)
    pg.click('[data-c=cont]'); pg.wait_for_timeout(800)
    pg.evaluate("() => { __SF.P.str = 100; __SF.P.stam = 100; }")

def grid_state(pg):
    return pg.evaluate("() => { const pb = document.querySelector('#panel .pb'), v = pb.querySelector('.bagv'), first = pb.querySelector('.bagcell'); return { st: Math.round(pb.scrollTop), vh: v.offsetHeight, top: Math.round(v.getBoundingClientRect().top), cell: first ? Math.round(first.getBoundingClientRect().top) : null, pw: Math.round(document.querySelector('#panel').getBoundingClientRect().width), ph: Math.round(document.querySelector('#panel').getBoundingClientRect().height), card: !!document.querySelector('#panel .bagcard') }; }")

def listeners(pg, cdp):
    out = {}
    for tgt in ['document', 'window']:
        o = cdp.send('Runtime.evaluate', {'expression': tgt})['result']['objectId']
        ls = cdp.send('DOMDebugger.getEventListeners', {'objectId': o})['listeners']
        out[tgt] = len(ls)
    return out

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
    # ================= desktop =================
    ctx = b.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page(); errs = []
    cdp = ctx.new_cdp_session(pg)
    start(pg, errs, 300)
    save0 = json.loads(pg.evaluate("() => localStorage.getItem('shardfall.save.v1')"))
    check(pg.evaluate("() => document.querySelector('#tgt').hidden") is True, 'target frame hidden by default')
    pg.evaluate("__SF.ACT.bag()"); pg.wait_for_timeout(250)
    check(pg.evaluate("() => document.querySelectorAll('#panel .bagtip').length") == 0, 'no per-tile tooltip copies in the backpack')
    # ---- selecting at the bottom of a large backpack ----
    pg.evaluate("() => { const pb = document.querySelector('#panel .pb'); pb.scrollTop = pb.scrollHeight; }"); pg.wait_for_timeout(250)
    g0 = grid_state(pg)
    check(g0['st'] > 2000, 'large backpack scrolled to the bottom', g0['st'])
    last = pg.evaluate("() => { const c = [...document.querySelectorAll('#panel .bagcell')]; const r = c[c.length - 1].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }")
    lastname = pg.evaluate("() => { const c = [...document.querySelectorAll('#panel .bagcell')]; return c[c.length - 1].querySelector('small').textContent; }")
    pg.mouse.click(*last); pg.wait_for_timeout(200)
    g1 = grid_state(pg)
    check(g1 == g0, 'selecting the last tile keeps scroll, grid position, panel size (no inline card)', [g0, g1])
    pop = pg.evaluate(IPOP)
    check(pop is not None and pop['t'] == lastname, 'click opens the item popup for that tile', pop)
    check(pg.evaluate("() => document.querySelector('#panel .bagcell[aria-pressed=true]') !== null"), 'selected tile is highlighted')
    box = pg.evaluate("() => { const r = document.querySelector('#ipop').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }")
    check(box[0] >= 0 and box[1] >= 0 and box[2] <= 1280 and box[3] <= 720, 'popup stays on screen beside a bottom-corner tile', box)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    check(pg.evaluate(IPOP) is None and pg.evaluate("__SF.PANEL") == 'bag', 'Escape closes the popup only (backpack stays open)')
    check(grid_state(pg) == g0 and pg.evaluate("__SF.bagUid") is None, 'closing restores no scroll jump and clears the selection', grid_state(pg))
    # ---- rapid inspection ----
    tiles = pg.evaluate("() => [...document.querySelectorAll('#panel .bagcell')].slice(-12).map(c => { const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })")
    for t in tiles: pg.mouse.click(*t)
    pg.wait_for_timeout(150)
    check(pg.evaluate("() => [document.querySelectorAll('#ipop:not([hidden])').length, __SF.UIPOP.stack.length, document.querySelectorAll('#itip:not([hidden])').length]") == [1, 1, 0] and grid_state(pg) == g0, 'rapid inspection: one popup, one stack entry, no tooltip, grid unchanged')
    pg.keyboard.press('Escape')
    L0 = listeners(pg, cdp)
    for t in tiles * 4: pg.mouse.click(*t); pg.keyboard.press('Escape')
    pg.mouse.move(*tiles[0]); pg.wait_for_timeout(400); pg.mouse.move(5, 5)
    L1 = listeners(pg, cdp)
    check(L0 == L1, 'no event listener build-up after 48 open/close cycles', [L0, L1])
    # ---- hover tooltip ----
    pg.evaluate("() => { const pb = document.querySelector('#panel .pb'); pb.scrollTop = 0; }"); pg.wait_for_timeout(200)
    pg.click('#panel [data-a=bagsort][data-s="Name"]'); pg.wait_for_timeout(150)
    bb = pg.locator(cell('Iron Quay sword')).bounding_box(); r = [bb['x'] + 20, bb['y'] + 20]
    pg.mouse.move(*r); pg.wait_for_timeout(120)
    check(pg.evaluate("document.querySelector('#itip').hidden") is True, 'no tooltip before the hover delay')
    pg.wait_for_timeout(350)
    tip = pg.evaluate("() => { const e = document.querySelector('#itip'); return e.hidden ? null : e.innerText; }")
    check(tip is not None and 'Damage' in tip and 'Speed' in tip and 'Weight' in tip, 'about 300 ms of hover shows the weapon tooltip', tip)
    pg.mouse.move(r[0] + 6, r[1] + 3); pg.wait_for_timeout(50)
    trect = pg.evaluate("() => { const e = document.querySelector('#itip').getBoundingClientRect(); return [e.left, e.top]; }")
    check(abs(trect[0] - (r[0] + 6 + 16)) < 3, 'tooltip follows the cursor', trect)
    pg.mouse.move(5, 5); pg.wait_for_timeout(80)
    check(pg.evaluate("document.querySelector('#itip').hidden") is True, 'moving away hides the tooltip')
    # edge: tile at the far right / bottom: tooltip kept inside the screen
    pg.evaluate("() => { const pb = document.querySelector('#panel .pb'); pb.scrollTop = pb.scrollHeight; }"); pg.wait_for_timeout(200)
    pg.mouse.move(*last); pg.wait_for_timeout(420)
    tb = pg.evaluate("() => { const e = document.querySelector('#itip'); const r = e.getBoundingClientRect(); return e.hidden ? null : [r.left, r.top, r.right, r.bottom]; }")
    check(tb is not None and tb[0] >= 0 and tb[1] >= 0 and tb[2] <= 1280 and tb[3] <= 720, 'tooltip never leaves the screen', tb)
    pg.mouse.click(*last); pg.wait_for_timeout(100)
    check(pg.evaluate("document.querySelector('#itip').hidden") is True and pg.evaluate(IPOP) is not None, 'opening the popup replaces the tooltip (no duplicates)')
    pg.keyboard.press('Escape'); pg.mouse.move(5, 5)
    pg.evaluate("() => { const pb = document.querySelector('#panel .pb'); pb.scrollTop = 0; }"); pg.wait_for_timeout(200)
    # ---- popup contents: relevant lines only ----
    pg.click(cell('Pine log')); pg.wait_for_timeout(120)
    pop = pg.evaluate(IPOP)
    check(pop and 'Weight' in pop['kv'] and not any(k in pop['kv'] for k in ['Damage', 'Armor protection', 'Durability', 'Quality', 'Speed']), 'a log shows no weapon or armor lines', pop and pop['kv'])
    pg.click(cell('Healing draught')); pg.wait_for_timeout(120)
    pop = pg.evaluate(IPOP)
    check(pop and pop['t'] == '3 × Healing draught' and 'Restores 24 hit points.' in pop['txt'] and 'Use' in pop['acts'] and 'Split half' in pop['acts'] and 'Split 1' in pop['acts'], 'consumable: quantity, description, Use and Split', pop)
    pg.evaluate("__SF.P.hp = 5"); pg.click('#ipop button:text-is("Use")'); pg.wait_for_timeout(150)
    check(pack(pg).get('draught') == 2 and pg.evaluate(IPOP)['t'] == '2 × Healing draught', 'Use updates the open popup', pg.evaluate(IPOP))
    pg.click(cell('Bandage')); pg.wait_for_timeout(100); pg.click('#ipop button:text-is("Split 1")'); pg.wait_for_timeout(150)
    check(pg.evaluate("() => __SF.P.pack.items.filter(i => i.id === 'bandage').map(i => i.qty).sort()") == [1, 4], 'Split 1 splits the stack', pg.evaluate("() => __SF.P.pack.items.filter(i => i.id === 'bandage').map(i => i.qty)"))
    # ---- compare and equip ----
    pg.click(cell('Iron chainmail tunic')); pg.wait_for_timeout(120)
    pop = pg.evaluate(IPOP)
    check(pop and all(k in pop['kv'] for k in ['Armor family', 'Material', 'Armor protection', 'Weight', 'Quality']) and ('Durability' in pop['kv']) == pg.evaluate("() => __SF.P.pack.items.find(i => i.id === 'chain_tunic').cond !== undefined") and 'Equip' in pop['acts'] and 'Inspect' in pop['acts'], 'armor popup: family, material, protection, weight, quality (durability only when tracked), Equip, Inspect', pop)
    pg.click('#ipop button:text-is("Inspect")'); pg.wait_for_timeout(100)
    check('protection' in pg.inner_text('#ipop .cmp') and 'vs' in pg.inner_text('#ipop .cmp'), 'Inspect compares with what is worn', pg.inner_text('#ipop .cmp'))
    pg.click('#ipop button:text-is("Equip")'); pg.wait_for_timeout(150)
    check(pg.evaluate("() => __SF.P.equip.chest && __SF.P.equip.chest.id") == 'chain_tunic' and pg.evaluate(IPOP) is None, 'Equip wears the tunic and closes the popup')
    pg.click(cell('Iron Quay sword')); pg.wait_for_timeout(100); pg.click('#ipop button:text-is("Inspect")'); pg.wait_for_timeout(80)
    check('avg damage' in pg.inner_text('#ipop .cmp'), 'weapon compare shows damage against the hand that holds it', pg.inner_text('#ipop .cmp'))
    pg.click('#ipop button:text-is("Equip")'); pg.wait_for_timeout(150)
    check(pg.evaluate("() => __SF.P.equip.weapon && __SF.P.equip.weapon.id") == 'sword', 'Equip wields the sword')
    # double-click still equips straight from the grid
    pg.evaluate("() => { __SF.P.pack.items.push(__SF.SF.newItem('chain_tunic', 1)); }"); pg.evaluate("__SF.ACT.bag()"); pg.wait_for_timeout(120)
    pg.dblclick(cell('Iron chainmail tunic')); pg.wait_for_timeout(200)
    check(pg.evaluate("() => __SF.P.pack.items.filter(i => i.id === 'chain_tunic').length") == 1 and pg.evaluate(IPOP) is None, 'double-click equips (swapping the worn tunic back) and leaves no popup')
    # ---- drop: valuable asks, cheap does not ----
    pg.click(cell('Gold')); pg.wait_for_timeout(100); pg.click('#ipop button:text-is("Drop")'); pg.wait_for_timeout(100)
    check(pack(pg).get('gold') == 40 and pg.is_visible('#ipop .ipconfirm'), 'dropping 40 gold asks for confirmation')
    pg.click('#ipop button:text-is("Keep")'); pg.wait_for_timeout(80)
    check(pack(pg).get('gold') == 40 and not pg.is_visible('#ipop .ipconfirm'), 'Keep cancels the drop')
    pg.click('#ipop button:text-is("Drop")'); pg.wait_for_timeout(80); pg.click('#ipop button:text-is("Drop it")'); pg.wait_for_timeout(150)
    check('gold' not in pack(pg) and pg.evaluate(IPOP) is None, 'confirmed drop removes the gold and closes the popup')
    pg.click(cell('Pine log')); pg.wait_for_timeout(100); pg.click('#ipop button:text-is("Drop")'); pg.wait_for_timeout(150)
    check('pine' not in pack(pg), 'a cheap log drops without asking')
    pg.click(cell('Iron chainmail tunic'), button='right'); pg.wait_for_timeout(100); pg.click('#ctxm button:text-is("Drop")'); pg.wait_for_timeout(100)
    check(pg.is_visible('#ipop .ipconfirm') and pg.evaluate("document.querySelector('#ctxm').hidden") is True, 'context-menu drop of armor also asks')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(80)
    check(pack(pg).get('chain_tunic') == 1, 'Escape on the confirmation keeps the item')
    # ---- outside click: closes, never reaches the world ----
    pg.click(cell('Reed ash')); pg.wait_for_timeout(100)
    pg.click('#panel .ph [data-a=close]'); pg.wait_for_timeout(50)
    check(pg.evaluate(IPOP) is None, 'closing the backpack closes its popup')
    pg.evaluate("__SF.ACT.bag()"); pg.wait_for_timeout(100); pg.click(cell('Reed ash')); pg.wait_for_timeout(100)
    m = pg.evaluate("""() => { for (const [dx, dy] of [[-5, 5], [-6, 0], [0, 6], [5, -5], [-4, -4]]) { const m = __SF.spawnMon('rat', dx, dy); m.state = 'idle'; m.pacified = 1e9; const s = __SF.screenOf(m);
        if (document.elementFromPoint(s.x, s.y - 10) === document.querySelector('#c')) return s; __SF.rmEnt(m); } return null; }""")
    px = pg.evaluate("() => [__SF.P.x, __SF.P.y]")
    check(m is not None, 'found a creature on open ground beside the backpack')
    pg.mouse.click(m['x'], m['y'] - 10); pg.wait_for_timeout(150)
    got = [pg.evaluate(IPOP) is None, pg.evaluate("__SF.P.sel && __SF.P.sel.name"), pg.evaluate("() => [__SF.P.x, __SF.P.y]") == px]
    check(got == [True, None, True], 'outside tap on the world closes the popup without selecting or moving (no click-through)', got)
    pg.mouse.click(m['x'], m['y'] - 10); pg.wait_for_timeout(150)
    check(pg.evaluate("__SF.P.sel && __SF.P.sel.name") == 'dock rat', 'with no popup open, the same tap selects the creature')
    pg.evaluate("() => { __SF.P.sel = null; for (const e of __SF.ents.slice()) if (e.kind === 'mon') __SF.rmEnt(e); }")
    pg.evaluate("__SF.closePanel()")
    errs_bag = list(errs)

    # ================= target frame =================
    pg.evaluate("() => { const S = __SF; for (const e of S.ents.slice()) if (e.kind === 'mon') S.rmEnt(e); S.P.sel = null; S.P.armed = false; }")
    rat = "() => __SF.ents.find(e => e.kind === 'mon' && e.type === 'rat' && !e.gone)"
    pg.evaluate("() => { const m = __SF.spawnMon('rat', 3, 0); m.state = 'idle'; m.pacified = 1e9; }")
    pg.evaluate(PLACE, [0, 0]); pg.evaluate(STEP, 10)
    check(pg.evaluate(TGT) is None, 'walking near a creature does not open the frame')
    sc = pg.evaluate(f"() => __SF.screenOf(({rat})())")
    pg.evaluate("([x, y]) => __SF.tapWorld(x, y - 12)", [sc['x'], sc['y']]); pg.evaluate(STEP, 1)
    t = pg.evaluate(TGT)
    check(t and t['n'] == 'dock rat' and t['hp'], 'tapping a creature opens the frame with name and health bar', t)
    check(t and 220 <= t['w'] <= 260 and abs(t['cx'] - 640) < 2 and t['top'] < 40, 'desktop frame: 220–260 px wide, top centre', t)
    check(t and t['xw'] >= 44 and t['xh'] >= 44, 'close button is at least 44 × 44', t)
    check(t and t['h'] <= 110, 'frame height stays compact', t and t['h'])
    under = pg.evaluate("() => { const r = document.querySelector('#tgt .tf-sub').getBoundingClientRect(); return document.elementFromPoint(r.left + 4, r.top + r.height / 2).id; }")
    check(under == 'c', 'the frame body lets taps through to the world; only its buttons take input', under)
    pg.screenshot(path=os.path.join(shots, 'desktop-target-rat.png'))
    # hostility and combat status
    pg.evaluate(f"() => {{ const m = ({rat})(); m.pacified = 0; m.state = 'chase'; m.target = __SF.P; }}"); pg.evaluate("() => __SF.refreshHud()")
    t = pg.evaluate(TGT)
    check(t and 'Hostile' in t['sub'] and 'after you' in t['sub'], 'hostile creature: hostility and combat state', t and t['sub'])
    # no rebuilds while nothing changes
    pg.evaluate(f"() => {{ const m = ({rat})(); m.state = 'idle'; m.target = null; m.pacified = 1e9; __SF.refreshHud(); window.__mut = 0; new MutationObserver(l => window.__mut += l.length).observe(document.querySelector('#tgt'), {{ childList: true, subtree: true, characterData: true }}); }}")
    pg.wait_for_timeout(1500)
    check(pg.evaluate("window.__mut") == 0, 'unchanged target: no DOM writes over 1.5 s of game loop', pg.evaluate("window.__mut"))
    # replacing the target
    npc = pg.evaluate("() => { const S = __SF, P = S.P; const n = S.ents.filter(e => e.kind === 'npc' && !e.gone).sort((a, b) => S.dist(a, P) - S.dist(b, P))[0]; S.P.sel = n; S.refreshHud(); return n.name; }")
    t = pg.evaluate(TGT)
    check(t and t['n'] == npc.split(', ')[0] and t['acts'] and t['acts'][0] in ('Talk', 'Trade', 'Bank'), 'selecting an NPC replaces the target: name, role, interaction', [npc, t])
    check(t and t['sub'].split(' · ')[0] != '', 'NPC role or profession shown', t and t['sub'])
    pg.screenshot(path=os.path.join(shots, 'desktop-target-npc.png'))
    # mining deposit and tree
    node = pg.evaluate("""() => { const S = __SF, P = S.P; for (const [k, lbl] of [['mining', 'rock'], ['woodcutting', 'tree']]) {}
      const find = sk => { for (let r = 1; r < 40; r++) for (let dx = -r; dx <= r; dx++) for (const dy of [-r, r]) { const n = S.nodeAt(Math.floor(P.x) + dx, Math.floor(P.y) + dy); if (n && n.skill === sk) return n; } return null; };
      const rock = find('mining'), tree = find('woodcutting'); window.__rock = rock; window.__tree = tree; return [!!rock, !!tree]; }""")
    check(node == [True, True], 'found a rock face and a tree near the start')
    pg.evaluate("() => { const S = __SF, r = window.__rock; S.P.x = r.x + .5 - 2; S.P.y = r.y + .5; S.P.sel = S.nodeAt(r.x, r.y); S.refreshHud(); }")
    t = pg.evaluate(TGT)
    check(t and t['n'] == 'Mining deposit' and 'Mining' in t['sub'] and 'Mine' in t['acts'] and 'Survey' in t['acts'], 'mining deposit: name, skill, Mine and Survey', t)
    pg.evaluate(PLACE, [-3.6, 0]); pg.evaluate(STEP, 20)
    check(pg.evaluate(TGT) is not None, 'deposit kept just past 5 tiles (hysteresis)')
    pg.evaluate(PLACE, [-1, 0]); pg.evaluate(STEP, 4)
    check(pg.evaluate(TGT) is not None, 'deposit kept for the short grace beyond the edge (no flicker)')
    pg.evaluate(STEP, 20)
    check(pg.evaluate(TGT) is None and pg.evaluate("__SF.TGT.reason") == 'distance', 'walking beyond the resource retention distance clears it', pg.evaluate("__SF.TGT.reason"))
    pg.evaluate("() => { const S = __SF, t = window.__tree; S.P.x = t.x + .5 - 9; S.P.y = t.y + .5; S.P.sel = S.nodeAt(t.x, t.y); S.refreshHud(); }")
    t = pg.evaluate(TGT)
    check(t and t['n'].lower().endswith('tree') and 'Chop' in t['acts'] and 'Woodcutting' in t['sub'], 'tree picked from 9 tiles: wood type, skill, Chop', t)
    pg.evaluate(PLACE, [4, 0]); pg.evaluate(STEP, 30); pg.evaluate(PLACE, [-0.8, 0]); pg.evaluate(STEP, 30)
    check(pg.evaluate(TGT) is not None, 'after walking up to it, a small step back keeps it (limit closes in to 5 + 1)')
    pg.evaluate("() => { const S = __SF, t = window.__tree; S.tSet(t.x, t.y, S.T.GR !== undefined ? S.T.GR : 0); }"); pg.evaluate(STEP, 1)
    check(pg.evaluate(TGT) is None and pg.evaluate("__SF.TGT.reason") == 'depleted', 'a resource removed from the map clears the frame', pg.evaluate("__SF.TGT.reason"))
    # creature retention, despawn, travel
    pg.evaluate(f"() => {{ const S = __SF, m = ({rat})(); S.P.x = m.x - 8; S.P.y = m.y; S.P.sel = m; S.refreshHud(); }}")
    pg.evaluate(HOLD, [10, 4]); pg.evaluate(HOLD, [12.6, 30])
    check(pg.evaluate(TGT) is not None, 'creature kept at 12.6 tiles (inside the slack)')
    pg.evaluate(HOLD, [13.4, 6])
    check(pg.evaluate(TGT) is not None, 'creature kept briefly at 13.4 tiles (grace, no flicker)')
    pg.evaluate(HOLD, [12.5, 6]); pg.evaluate(HOLD, [13.4, 10]); pg.evaluate(HOLD, [12.5, 6]); pg.evaluate(HOLD, [13.4, 10])
    check(pg.evaluate(TGT) is not None, 'pacing across the edge never clears it (grace resets inside)')
    pg.evaluate(HOLD, [13.6, 30])
    check(pg.evaluate(TGT) is None and pg.evaluate("__SF.TGT.reason") == 'distance', 'creature cleared beyond 13 tiles after the grace')
    pg.evaluate(f"() => {{ const S = __SF, m = ({rat})(); S.P.x = m.x - 3; S.P.y = m.y; S.P.sel = m; S.refreshHud(); S.rmEnt(m); }}"); pg.evaluate(STEP, 1)
    check(pg.evaluate(TGT) is None and pg.evaluate("__SF.P.sel") is None and pg.evaluate("__SF.TGT.reason") == 'gone', 'a despawned creature clears the frame (no stale reference)')
    pg.evaluate("() => { const m = __SF.spawnMon('rat', 3, 0); m.pacified = 1e9; __SF.P.sel = m; __SF.refreshHud(); }")
    pg.evaluate(PLACE, [30, 0]); pg.evaluate(STEP, 1)
    check(pg.evaluate(TGT) is None and pg.evaluate("__SF.TGT.reason") == 'travel', 'travelling far at once (moongate, stairs, boat) clears it')
    # killing the selected monster
    pg.evaluate("() => { const S = __SF; const m = S.spawnMon('rat', 1.2, 0); m.pacified = 1e9; S.P.sel = m; S.refreshHud(); window.__k = m; }")
    pg.evaluate("() => { const S = __SF; S.damageMon(window.__k, 999, 'phys', S.P); }"); pg.evaluate(STEP, 2)
    t = pg.evaluate(TGT)
    check(pg.evaluate("__SF.P.sel !== window.__k") and (t is None or 'Loot' in t['acts']), 'killing the target never leaves the dead creature selected; its remains offer Loot', t)
    if t: pg.screenshot(path=os.path.join(shots, 'desktop-target-corpse.png'))
    check(t is None or not any('NaN' in c for c in t['chips'] + [t['sub']]), 'creature remains: no meaningless loot-rights line', t)
    # closing during combat
    pg.evaluate("() => { const S = __SF; const m = S.spawnMon('boar', 1.2, 0); m.state = 'chase'; m.target = S.P; S.P.sel = m; window.__b = m; S.toggleArm(); S.refreshHud(); }")
    check(pg.evaluate("__SF.P.armed") is True and 'Attacking' in ' '.join(pg.evaluate(TGT)['chips']), 'armed attack shows on the frame')
    hp0 = pg.evaluate("window.__b.hp")
    pg.click('#tgt .tf-x'); pg.wait_for_timeout(50)
    check(pg.evaluate("[__SF.P.armed, __SF.P.sel]") == [False, None] and pg.evaluate(TGT) is None, 'closing the frame during combat clears the target and stops the armed swing')
    pg.evaluate(STEP, 40)
    check(pg.evaluate("window.__b.hp") == hp0 and pg.evaluate("window.__b.target === __SF.P"), 'no attack after closing; the creature keeps its own fight (unchanged AI)')
    # Escape order: popup first, then cancel, then target
    pg.evaluate("() => { __SF.P.sel = window.__b; __SF.toggleArm(); __SF.refreshHud(); __SF.ACT.bag(); }"); pg.wait_for_timeout(100)
    pg.click('#panel .bagcell >> nth=0'); pg.wait_for_timeout(80)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(50)
    check(pg.evaluate(IPOP) is None and pg.evaluate("__SF.PANEL") == 'bag' and pg.evaluate("__SF.P.sel === window.__b"), 'Escape 1: closes the item popup only')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(50)
    check(pg.evaluate("__SF.PANEL") is None and pg.evaluate("__SF.P.sel === window.__b"), 'Escape 2: closes the backpack, target kept')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(50)
    check(pg.evaluate("__SF.P.armed") is False and pg.evaluate("__SF.P.sel === window.__b"), 'Escape 3: disarms the attack, target kept')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(50)
    check(pg.evaluate("__SF.P.sel") is None and pg.evaluate(TGT) is None, 'Escape 4: clears the target')
    pg.evaluate("() => __SF.rmEnt(window.__b)")
    # ally and self
    pg.evaluate("() => { const S = __SF; const a = S.allyOf && S.allyOf(); if (a) { S.P.x = a.x - 2; S.P.y = a.y; S.P.sel = a; } S.refreshHud(); }")
    t = pg.evaluate(TGT)
    check(t is None or ('Ally' in t['sub'] and any(a in t['acts'] for a in ['Bandage', 'Cure', 'Resurrect'])), 'ally: status and Bandage', t)
    # save / load unchanged by the UI
    pg.evaluate("() => { __SF.P.sel = null; __SF.save(); }")
    s1 = json.loads(pg.evaluate("() => localStorage.getItem('shardfall.save.v1')"))
    extra = set(s1['char'].keys()) - set(save0['char'].keys())
    check(sorted(s1.keys()) == sorted(save0.keys()) and set(save0['char'].keys()) <= set(s1['char'].keys()) and not any(k.lower() in ('sel', 'armed', 'ipop', 'tgt', 'uipop', 'baguid') for k in s1['char']), 'save layout unchanged: no UI or selection state written', extra)
    before = pack(pg); eq = pg.evaluate("() => Object.fromEntries(Object.entries(__SF.P.equip).filter(([k, v]) => v).map(([k, v]) => [k, v.id]))")
    pg.reload(); pg.wait_for_timeout(600); pg.click('[data-c=cont]'); pg.wait_for_timeout(800)
    check(pack(pg) == before and pg.evaluate("() => Object.fromEntries(Object.entries(__SF.P.equip).filter(([k, v]) => v).map(([k, v]) => [k, v.id]))") == eq, 'save and reload keeps the pack and worn items', [before, pack(pg)])
    check(pg.evaluate(TGT) is None and pg.evaluate(IPOP) is None, 'after loading: no frame, no popup')
    check(not errs, 'desktop: no page errors', errs[:5])
    ctx.close()

    # ================= phones (landscape) =================
    for vw, vh in [(844, 390), (667, 375)]:
        ctx = b.new_context(viewport={'width': vw, 'height': vh}, has_touch=True, is_mobile=True, device_scale_factor=2); pg = ctx.new_page(); errs = []
        start(pg, errs, 40)
        pg.evaluate("__SF.ACT.bag()"); pg.wait_for_timeout(250)
        pg.evaluate("() => { const pb = document.querySelector('#panel .pb'); pb.scrollTop = pb.scrollHeight; }"); pg.wait_for_timeout(150)
        g0 = grid_state(pg)
        lastc = pg.evaluate("() => { const c = [...document.querySelectorAll('#panel .bagcell')]; const r = c[c.length - 1].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }")
        pg.touchscreen.tap(*lastc); pg.wait_for_timeout(200)
        pop = pg.evaluate(IPOP)
        check(pop is not None and grid_state(pg) == g0, f'phone {vw}x{vh}: tap opens the popup, backpack does not move or resize', [g0, grid_state(pg)])
        bt = pg.evaluate("() => [...document.querySelectorAll('#ipop button')].map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })")
        check(bt and all(w >= 44 and h >= 44 for w, h in bt), f'phone {vw}x{vh}: popup buttons are at least 44 px', bt)
        box = pg.evaluate("() => { const r = document.querySelector('#ipop').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }")
        check(box[0] >= 0 and box[1] >= 0 and box[2] <= vw and box[3] <= vh, f'phone {vw}x{vh}: popup fits the screen', box)
        check(pg.evaluate("document.querySelector('#itip').hidden") is True, f'phone {vw}x{vh}: no hover tooltip on tap')
        pg.screenshot(path=os.path.join(shots, f'phone-{vw}-popup.png'))
        pg.touchscreen.tap(*pg.evaluate("() => { const r = document.querySelector('#panel .ph b').getBoundingClientRect(); return [r.left + 5, r.top + 5]; }")); pg.wait_for_timeout(150)
        check(pg.evaluate(IPOP) is None and pg.evaluate("__SF.PANEL") == 'bag', f'phone {vw}x{vh}: tapping outside closes the popup')
        pg.touchscreen.tap(*lastc); pg.wait_for_timeout(150); pg.tap('#ipop .ipx'); pg.wait_for_timeout(120)
        check(pg.evaluate(IPOP) is None, f'phone {vw}x{vh}: close button closes the popup')
        pg.evaluate("__SF.closePanel()")
        pg.evaluate("() => { const S = __SF; for (const e of S.ents.slice()) if (e.kind === 'mon') S.rmEnt(e); const m = S.spawnMon('rat', 3, 0); m.pacified = 1e9; S.refreshHud(); window.__r = m; }")
        sc = pg.evaluate("() => __SF.screenOf(window.__r)")
        pg.touchscreen.tap(sc['x'], sc['y'] - 12); pg.wait_for_timeout(200)
        t = pg.evaluate(TGT)
        check(t and t['n'] == 'dock rat' and 180 <= t['w'] <= 220 and t['xw'] >= 44, f'phone {vw}x{vh}: tap selects; frame 180–220 px, 44 px close', t)
        meb = pg.evaluate("() => document.querySelector('#me').getBoundingClientRect().right"); tgl = pg.evaluate("() => document.querySelector('#tgt').getBoundingClientRect().left")
        trr = pg.evaluate("() => document.querySelector('#tgt').getBoundingClientRect().right"); topl = pg.evaluate("() => document.querySelector('#topr').getBoundingClientRect().left")
        check(tgl > meb and trr < topl, f'phone {vw}x{vh}: frame sits between the status panel and the minimap', [meb, tgl, trr, topl])
        pg.screenshot(path=os.path.join(shots, f'phone-{vw}-target.png'))
        x = pg.evaluate("() => { const r = document.querySelector('#tgt .tf-x').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }")
        pxy = pg.evaluate("() => [__SF.P.x, __SF.P.y, window.__r.hp]")
        pg.touchscreen.tap(*x); pg.wait_for_timeout(200)
        check(pg.evaluate(TGT) is None and pg.evaluate("() => [__SF.P.x, __SF.P.y, window.__r.hp]") == pxy, f'phone {vw}x{vh}: tapping × closes without moving or attacking')
        check(not errs, f'phone {vw}x{vh}: no page errors', errs[:5])
        ctx.close()
    b.close()
print(f'\n{len(fails)} failure(s)' if fails else '\nall ui-smoke checks passed')
sys.exit(1 if fails else 0)
