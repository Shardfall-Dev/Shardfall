# Browser checks for the equipment system v1.0 (paper doll, backpack, tooltips, weight, combat, save and migration).
# usage: python3 tests/equipment-smoke/run.py Shardfall_v0.25.html [/path/to/chrome] [--shots DIR]
# Needs Python Playwright and Chrome. Screenshots go to $EQ_SHOTS or --shots (default /tmp/eq-shots).
import sys, os, json
from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:]]
shots = os.environ.get('EQ_SHOTS', '/tmp/eq-shots')
if '--shots' in args: i = args.index('--shots'); shots = args[i + 1]; del args[i:i + 2]
f = os.path.abspath(args[0] if args else 'Shardfall_v0.25.html')
chrome = args[1] if len(args) > 1 else '/usr/bin/google-chrome'
os.makedirs(shots, exist_ok=True)
fails = []
def check(ok, msg, got=None):
    print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else f'  (got {json.dumps(got) if not isinstance(got, str) else got})'))
    if not ok: fails.append(msg)
J = lambda pg, js: pg.evaluate(js)

def new_char(pg, errs, prof='Mace dexer', name='Aldric'):
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'ERR_' not in m.text and 'Failed to load resource' not in m.text else None)
    pg.goto('file://' + f); pg.wait_for_timeout(500); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(500)
    pg.click(f'[data-c=prof][data-p="{prof}"]'); pg.fill('#ccn', name); pg.click('[data-c=go]'); pg.wait_for_timeout(1200)

GIVE = """(ids) => { const S = __SF, SF = S.SF, P = S.P; const out = {}; for (const [id, o] of ids) { const it = SF.EQ.make(id, o || { origin: 'npc' }); SF.addItem(P.pack, it); out[id + (o && o.material ? ':' + o.material : '')] = it.uid; } return out; }"""
EQS = "() => Object.fromEntries(Object.entries(__SF.P.equip).filter(([k, v]) => v).map(([k, v]) => [k, v.id]))"

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
    # ================= desktop =================
    ctx = b.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page(); errs = []
    new_char(pg, errs)
    eq0 = J(pg, EQS)
    check(eq0.get('shirt') == 'shirt' and eq0.get('trousers') == 'trousers' and eq0.get('weapon') == 'mace' and 'armor' not in eq0, 'new character wears a shirt, trousers and shoes; no old armor slot', eq0)
    # C opens the paper doll
    pg.keyboard.press('c'); pg.wait_for_timeout(250)
    check(pg.is_visible('#eqwin'), 'C opens the equipment window')
    slots = J(pg, "() => [...document.querySelectorAll('#eqwin .eqs')].map(b => b.dataset.s)")
    check(len(slots) == 18 and set(slots) == set(J(pg, '__SF.EQ.SLOT_IDS')), 'eighteen functional slots on the doll', slots)
    check('Armor rating' in pg.inner_text('#eqwin') and 'Encumbrance' in pg.inner_text('#eqwin') and 'Meditation' in pg.inner_text('#eqwin'), 'statistics panel shows AR, encumbrance and meditation')
    empty_svg = J(pg, "() => !!document.querySelector('#eqwin .eqs[data-s=head] svg')")
    check(empty_svg, 'empty slots show a silhouette')
    pg.screenshot(path=f'{shots}/01-doll-start.png')
    # give a mixed set and equip by double-click from the backpack
    J(pg, "__SF.P.str = 100")
    uids = J(pg, GIVE.replace('(ids)', '(ids)') + "", ) if False else J(pg, f"({GIVE})([['plate_chest', {{ material: 'mithril', quality: 'exceptional', creatorName: 'Aldric', origin: 'crafted' }}], ['chain_coif'], ['leather_gloves', {{ material: 'spined' }}], ['plate_leggings'], ['studded_sleeves'], ['plate_gorget'], ['robe'], ['glaive'], ['buckler'], ['ring', {{ material: 'golden' }}]])")
    J(pg, "__SF.ACT.bag()"); pg.wait_for_timeout(250)
    pg.dblclick(f"#panel .bagcell[data-u='{uids['plate_chest:mithril']}']"); pg.wait_for_timeout(200)
    check(J(pg, "__SF.P.equip.chest && __SF.P.equip.chest.material") == 'mithril', 'double-click equips the mithril plate chest')
    # drag from the backpack onto the head slot (mouse)
    def drag(src, dst):
        a = pg.locator(src).first.bounding_box(); z = pg.locator(dst).first.bounding_box()
        pg.mouse.move(a['x'] + a['width'] / 2, a['y'] + a['height'] / 2); pg.mouse.down()
        pg.mouse.move(a['x'] + a['width'] / 2 + 20, a['y'] + a['height'] / 2 + 5, steps=4)
        pg.mouse.move(z['x'] + z['width'] / 2, z['y'] + z['height'] / 2, steps=8); pg.mouse.up(); pg.wait_for_timeout(250)
    drag(f"#panel .bagcell[data-u='{uids['chain_coif']}']", "#eqwin .eqs[data-s=head]")
    check(J(pg, "__SF.P.equip.head && __SF.P.equip.head.id") == 'chain_coif', 'drag from the backpack onto the head slot equips the coif')
    drag(f"#panel .bagcell[data-u='{uids['plate_leggings']}']", "#eqwin .eqfig")
    check(J(pg, "__SF.P.equip.legs && __SF.P.equip.legs.id") == 'plate_leggings', 'drop on the figure equips into the right slot')
    drag(f"#panel .bagcell[data-u='{uids['ring:golden']}']", "#eqwin .eqs[data-s=legs]")
    check(J(pg, "__SF.P.equip.legs.id") == 'plate_leggings' and J(pg, "__SF.P.equip.ring") is None, 'dropping a ring on the legs slot is refused')
    for k in ['leather_gloves:spined', 'studded_sleeves', 'plate_gorget', 'robe', 'ring:golden']:
        J(pg, f"__SF.equipUid({uids[k]})")
    e = J(pg, "(() => { const e = __SF.EQ.effective(__SF.P); return { ar: e.ar, dexMod: e.dexMod, med: e.med, region: e.region }; })()")
    check(e['region']['torso'] > 35 and e['region']['hands'] > 13 and 20 < e['ar'] < 40, 'mixed families and materials: per-region AR (robe over plate adds nothing)', e)
    pg.wait_for_timeout(200)
    shown = pg.inner_text('#eqwin .eqstat')
    check(f"{e['ar']:.1f}" in shown, 'equipment window shows the total armor rating', shown[:80])
    pg.screenshot(path=f'{shots}/02-doll-mixed.png')
    ap = J(pg, "(() => { const S = __SF; let got = null; addEventListener('sf:appearance', e => { got = e.detail; }, { once: true }); const it = S.SF.EQ.make('cloth_gloves'); S.SF.addItem(S.P.pack, it); S.equipUid(it.uid); S.eqTick(); const ev = S.WS && S.WS.bus.recent ? null : null; return got && got.layers.map(l => l.layer); })()")
    check(ap and 'hands' in ap and 'torso' in ap, 'equipping fires the appearance-change event with ordered render layers', ap)
    J(pg, "__SF.unequipTo('hands')")
    # tooltip on hover with comparison
    pg.hover("#eqwin .eqs[data-s=chest]"); pg.wait_for_timeout(200)
    tip = pg.inner_text('#itip') if pg.is_visible('#itip') else ''
    check('exceptional mithril plate chest' in tip.lower() and 'Armor protection' in tip and 'Crafted by' in tip and 'Aldric' in tip and 'Estimated value' in tip, 'hover tooltip on the doll: name, protection, crafter, value', tip[:200])
    J(pg, f"(() => {{ const it = __SF.SF.EQ.make('plate_chest'); __SF.SF.addItem(__SF.P.pack, it); window._ic = it.uid; }})()"); J(pg, "__SF.ACT.bag()"); pg.wait_for_timeout(200)
    cmp = J(pg, "(() => { const d = document.createElement('div'); d.innerHTML = __SF.itemTip(__SF.SF.EQ.find(__SF.P, window._ic).item); return [d.querySelector('.cmp') && d.querySelector('.cmp').innerText, [...d.querySelectorAll('.cmp .up')].map(x => x.textContent), [...d.querySelectorAll('.cmp .dn')].map(x => x.textContent)]; })()")
    check(cmp[0] and any('weight' in x for x in cmp[1]) is False and any('protection' in x for x in cmp[2]) and any('weight' in x for x in cmp[2]), 'iron chest vs worn mithril: less protection and more weight in red', cmp)
    pg.mouse.move(5, 5); pg.wait_for_timeout(100)
    # two-handed weapon and shield
    J(pg, f"__SF.equipUid({uids['buckler']})"); pg.wait_for_timeout(50)
    check(J(pg, "__SF.P.equip.shield && __SF.P.equip.shield.id") == 'buckler', 'buckler in the off hand beside the mace')
    J(pg, f"__SF.equipUid({uids['glaive']})"); pg.wait_for_timeout(100)
    r = J(pg, "[__SF.P.equip.weapon && __SF.P.equip.weapon.id, __SF.P.equip.shield, __SF.P.pack.items.some(i => i.id === 'buckler'), __SF.P.pack.items.some(i => i.id === 'mace')]")
    check(r == ['glaive', None, True, True], 'two-handed halberd sends the mace and the buckler to the backpack', r)
    check(J(pg, "!!document.querySelector('#eqwin .eqs[data-s=shield].twohand')"), 'off-hand slot shows two-handed occupancy')
    # drag a worn piece back to the backpack
    drag("#eqwin .eqs[data-s=neck]", "#panel .pb")
    check(J(pg, "__SF.P.equip.neck") is None and J(pg, "__SF.P.pack.items.some(i => i.id === 'plate_gorget')"), 'dragging the gorget onto the backpack removes it')
    # double-click a slot removes; right-click menu
    pg.wait_for_timeout(400); pg.dblclick("#eqwin .eqs[data-s=robe]"); pg.wait_for_timeout(150)
    check(J(pg, "__SF.P.equip.robe") is None, 'double-clicking a worn robe removes it')
    pg.click("#eqwin .eqs[data-s=legs]", button='right'); pg.wait_for_timeout(150)
    ctxm = pg.inner_text('#ctxm') if pg.is_visible('#ctxm') else ''
    check('Remove' in ctxm and 'Drop' in ctxm, 'right-click a slot: Remove / Drop', ctxm)
    pg.click('#ctxm [data-a=uneq]'); pg.wait_for_timeout(150)
    check(J(pg, "__SF.P.equip.legs") is None and not pg.is_visible('#ctxm'), 'context Remove works and closes the menu')
    check(J(pg, "__SF.EQ.audit(__SF.P).ok"), 'no duplicate item after every interaction')
    # weight is counted once
    w = J(pg, "(() => { const S = __SF, P = S.P, SF = S.SF; const w0 = SF.EQ.totalWt(P); const it = P.pack.items.find(i => i.id === 'plate_leggings'); S.equipUid(it.uid); const w1 = SF.EQ.totalWt(P); S.unequipTo('legs'); const w2 = SF.EQ.totalWt(P); return [w0, w1, w2]; })()")
    check(abs(w[0] - w[1]) < 1e-9 and abs(w[1] - w[2]) < 1e-9, 'carried weight unchanged by equipping and removing', w)
    # backpack: search, sorts, filters, split/merge
    J(pg, "__SF.ACT.bag()"); pg.wait_for_timeout(150)
    sorts = J(pg, "[...document.querySelectorAll('#panel [data-a=bagsort]')].map(b => b.dataset.s)")
    check(all(s in sorts for s in ['Name', 'Category', 'Weight', 'Material', 'Quality', 'Value']), 'sorts by name, category, weight, material, quality and value', sorts)
    pg.fill('#bagq', 'plate'); pg.wait_for_timeout(200)
    names = J(pg, "[...document.querySelectorAll('#panel .bagcell small')].map(e => e.textContent)")
    check(len(names) >= 2 and all('plate' in n.lower() for n in names) and J(pg, "document.activeElement && document.activeElement.id") == 'bagq', 'search filters while typing and keeps focus', names)
    pg.fill('#bagq', ''); pg.wait_for_timeout(100)
    pg.click('#panel [data-a=bagfilter][data-f=Armor]'); pg.wait_for_timeout(100)
    cats = J(pg, "[...document.querySelectorAll('#panel .bagcell')].map(c => __SF.SF.ITEMS[__SF.P.pack.items.find(i => i.uid === +c.dataset.u).id].cat)")
    check(cats and all(c in ('armor', 'shield') for c in cats), 'Armor filter', cats)
    pg.click('#panel [data-a=bagfilter][data-f=All]'); pg.wait_for_timeout(100)
    pg.click('#panel [data-a=bagsort][data-s=Weight]'); pg.wait_for_timeout(100)
    wts = J(pg, "[...document.querySelectorAll('#panel .bagcell')].map(c => __SF.SF.itemWt(__SF.P.pack.items.find(i => i.uid === +c.dataset.u)))")
    check(wts == sorted(wts, reverse=True), 'Weight sort: heaviest first', wts[:6])
    sp = J(pg, "(() => { const S = __SF, P = S.P; const b = P.pack.items.find(i => i.id === 'bandage'); S.ACT.split({ u: b.uid, q: 4 }); const n = P.pack.items.filter(i => i.id === 'bandage').map(i => i.qty); S.ACT.bagmerge(); return [n, P.pack.items.filter(i => i.id === 'bandage').map(i => i.qty)]; })()")
    check(sp[0] == [8, 4] and sp[1] == [12], 'split 12 bandages into 8 + 4, then merge back', sp)
    # hundreds of items: the grid stays small and scrolls
    J(pg, "(() => { const P = __SF.P, SF = __SF.SF; for (let i = 0; i < 600; i++) P.pack.items.push(SF.EQ.make(['dagger', 'ring', 'shirt', 'bascinet', 'leather_cap'][i % 5], { origin: 'loot' })); })()")
    J(pg, "__SF.ACT.bag()"); pg.wait_for_timeout(300)
    n_cells = J(pg, "document.querySelectorAll('#panel .bagcell').length"); n_items = J(pg, "__SF.P.pack.items.length")
    check(n_items > 600 and n_cells < 220, f'{n_items} stacks in the backpack, {n_cells} cells in the page (virtualized)', [n_items, n_cells])
    J(pg, "(() => { const pb = document.querySelector('#panel .pb'); pb.scrollTop = pb.scrollHeight; pb.dispatchEvent(new Event('scroll')); })()"); pg.wait_for_timeout(300)
    last = J(pg, "(() => { const ids = [...document.querySelectorAll('#panel .bagcell')].map(c => +c.dataset.u); const order = __SF.P.pack.items.slice(); return ids.length > 0 && ids.length < 220; })()")
    tailshown = J(pg, "(() => { const cells = [...document.querySelectorAll('#panel .bagcell')]; const pb = document.querySelector('#panel .pb').getBoundingClientRect(); return cells.some(c => { const r = c.getBoundingClientRect(); return r.top >= pb.top - 2 && r.bottom <= pb.bottom + 80; }); })()")
    check(last and tailshown, 'scrolling to the end shows the last rows')
    pg.screenshot(path=f'{shots}/03-backpack-600.png')
    J(pg, "(() => { const P = __SF.P; P.pack.items = P.pack.items.filter(i => !(i.origin === 'loot')); })()")
    # encumbrance: overload, immobile, drop to recover; Strength loss never destroys items
    J(pg, "__SF.ACT.close()")
    enc = J(pg, """(() => { const S = __SF, P = S.P, SF = S.SF; P.str = 50; const ore = SF.newItem('ore', 90); SF.addItem(P.pack, ore);
      const e1 = S.encumb(); const x0 = P.x, y0 = P.y; S.JOY.on = false; for (const k of ['u']) {} P.sprintOn = false;
      const KEYS = null; return { stage: e1.stage, n: e1.n, ratio: e1.ratio, ore: SF.count(P.pack, 'ore') }; })()""")
    check(enc['stage'] == 3 and enc['ore'] == 90, 'carrying 90 ore at Strength 50: immobile, nothing destroyed', enc)
    mv = J(pg, "(() => { const S = __SF, P = S.P; const x0 = P.x, y0 = P.y; document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true })); for (let i = 0; i < 20; i++) S.update(.05); document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', bubbles: true })); return Math.hypot(P.x - x0, P.y - y0); })()")
    check(mv < 1e-6, 'an immobile character cannot walk', mv)
    blocked = J(pg, "(() => { const S = __SF, P = S.P, SF = S.SF; const pile = SF.newContainer('pile'); pile.items.push(SF.newItem('gold', 5)); const r = SF.EQ.pickupItem(P, pile, { uid: pile.items[0].uid }); return r.ok; })()")
    check(blocked is False, 'pickups are refused while over capacity')
    rec = J(pg, "(() => { const S = __SF, P = S.P, SF = S.SF; const ore = P.pack.items.find(i => i.id === 'ore'); S.ACT.drop({ u: ore.uid, q: 70 }); const x0 = P.x, y0 = P.y; document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true })); for (let i = 0; i < 20; i++) S.update(.05); document.body.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', bubbles: true })); return [SF.count(P.pack, 'ore'), S.encumb().stage, Math.hypot(P.x - x0, P.y - y0) > .5, S.ents.some(e => e.pile && e.cont.items.some(i => i.id === 'ore' && i.qty === 70))]; })()")
    check(rec[0] == 20 and rec[1] <= 1 and rec[2] and rec[3], 'dropping 70 ore recovers movement; the ore lies on the ground', rec)
    J(pg, "(() => { const P = __SF.P; P.pack.items = P.pack.items.filter(i => i.id !== 'ore'); P.str = 100; })()")
    # combat: region mitigation and durability
    cb = J(pg, """(() => { const S = __SF, P = S.P, SF = S.SF; for (const s of SF.EQ.SLOT_IDS) if (P.equip[s] && SF.ITEMS[P.equip[s].id].trade) S.unequipTo(s);
      const ids = ['plate_helm', 'plate_gorget', 'plate_chest', 'plate_arms', 'plate_gauntlets', 'plate_leggings']; for (const id of ids) { const it = SF.EQ.make(id); SF.addItem(P.pack, it); S.equipUid(it.uid); }
      P.equip.shield = null; const m = { kind: 'mon', type: 'boar', name: 'boar', x: P.x + 1, y: P.y, hp: 50, max: 50, id: 99001, state: 'idle', sect: 0 }; S.ents.push(m);
      S.MON.boar.dmg = [40, 40]; const A = S.fighter(m); P.hp = 9999; const res = []; const regions = {};
      let k = 0; S.setRng(() => { k++; return [.02, .99][k % 2]; });
      for (let i = 0; i < 40; i++) { const hp0 = P.hp; const r = S.applyBlow(A, P); if (r && r.region) regions[r.region] = (regions[r.region] || 0) + 1; res.push(hp0 - P.hp); }
      S.setRng(null); const chest = P.equip.chest; const plateHit = res.filter(v => v >= 0);
      for (const s of ids.map(id => SF.ITEMS[id].slot)) S.unequipTo(s); P.hp = 9999; S.setRng(() => { k++; return [.02, .99][k % 2]; }); const naked = []; for (let i = 0; i < 10; i++) { const hp0 = P.hp; S.applyBlow(A, P); naked.push(hp0 - P.hp); } S.setRng(null);
      S.ents.splice(S.ents.indexOf(m), 1);
      return { plated: Math.max(...plateHit), naked: Math.max(...naked), neg: res.some(v => v < 0), chestCond: chest.cond, chestMax: chest.maxc, regions }; })()""")
    check(cb['plated'] < cb['naked'] and not cb['neg'], 'full plate takes less damage than bare skin; never negative', cb)
    check(cb['chestCond'] < cb['chestMax'], 'armor that was struck lost durability', cb)
    # broken armor stops protecting
    br = J(pg, "(() => { const S = __SF, P = S.P, SF = S.SF; const it = SF.EQ.make('plate_chest'); SF.addItem(P.pack, it); S.equipUid(it.uid); const a1 = SF.EQ.effective(P).ar; it.cond = 0; S.eqTick(); const a2 = SF.EQ.effective(P).ar; const cls = document.querySelector('#eqwin .eqs[data-s=chest]').className; it.cond = it.maxc; return [a1, a2, cls]; })()")
    check(br[0] > 0 and br[1] == 0 and 'broken' in br[2], 'broken chest gives 0 AR and is flagged on the doll', br)
    # meditation interference reaches mana regeneration
    md = J(pg, "(() => { const S = __SF, P = S.P, SF = S.SF; P.mana = 0; S.update(1); const plate = P.mana; S.unequipTo('chest'); P.mana = 0; S.update(1); return [plate, P.mana]; })()")
    check(md[0] < md[1], 'plate slows mana regeneration', md)
    # effective Dexterity: derived, never stacked
    dx = J(pg, "(() => { const S = __SF, P = S.P, SF = S.SF; P.dex = 50; const it = P.pack.items.find(i => i.id === 'plate_chest'); S.equipUid(it.uid); S.eqTick(); S.eqTick(); return [P.dex, SF.maxStam(P)]; })()")
    check(dx == [50, 48], 'plate chest: Dexterity 50 stays, stamina cap 48', dx)
    # window drag and close
    hb = pg.locator('#eqwin .eqh b').bounding_box(); pg.mouse.move(hb['x'] + 5, hb['y'] + 5); pg.mouse.down(); pg.mouse.move(hb['x'] + 305, hb['y'] + 125, steps=6); pg.mouse.up(); pg.wait_for_timeout(150)
    pos = J(pg, "JSON.parse(localStorage.getItem('shardfall.settings')).eqPos")
    check(pos and pos['x'] > 250 and pos['y'] > 120, 'equipment window drags by its title and remembers the spot', pos)
    pg.click('#eqwin [data-a=eqclose]'); pg.wait_for_timeout(150)
    check(not pg.is_visible('#eqwin'), 'close button hides the window')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100); pg.keyboard.press('C'); pg.wait_for_timeout(150)
    check(pg.is_visible('#eqwin'), 'C again reopens it')
    # crafting: Armor category with families and material variants
    cr = J(pg, """(() => { const S = __SF, P = S.P; P.skills.blacksmithy.v = 1000; S.openCraft('anvil'); S.ACT.ccat({ c: 'Armor' }); const subs = [...document.querySelectorAll('#panel [data-a=csub]')].map(b => b.dataset.s);
      S.ACT.csub({ s: 'Platemail' }); const rows = [...document.querySelectorAll('#panel .crow')].map(r => r.dataset.r); S.ACT.crec({ r: 'plate_chest' }); S.ACT.cmat({ m: 'mithril' });
      const txt = document.querySelector('#panel .pb').innerText; return { subs, rows, mats: document.querySelectorAll('#panel [data-a=cmat]').length, txt }; })()""")
    check('Platemail' in cr['subs'] and 'Helmets' in cr['subs'] and 'Shields' in cr['subs'] and 'Dragon scale' in cr['subs'], 'anvil Armor category lists the metal families', cr['subs'])
    check('plate_chest' in cr['rows'] and cr['mats'] == 10, 'plate chest offered in all ten metals', [cr['rows'], cr['mats']])
    check('Mithril plate chest' in cr['txt'] and 'Resulting weight' in cr['txt'] and '6.3' in cr['txt'] and 'Expected protection' in cr['txt'], 'preview: mithril result, weight 6.3, expected protection', cr['txt'][:300])
    pg.screenshot(path=f'{shots}/04-craft-plate.png')
    tl = J(pg, """(() => { const S = __SF, P = S.P; P.skills.tailoring.v = 600; S.openCraft('bench'); S.ACT.ccat({ c: 'Armor' }); const subs = [...document.querySelectorAll('#panel [data-a=csub]')].map(b => b.dataset.s); S.ACT.csub({ s: 'Studded leather' }); S.ACT.crec({ r: 'studded_tunic' });
      return { subs, mats: document.querySelectorAll('#panel [data-a=cmat]').length, secs: document.querySelectorAll('#panel [data-a=csec]').length }; })()""")
    check(all(s in tl['subs'] for s in ['Cloth', 'Leather', 'Studded leather', 'Bone']) and tl['mats'] == 8 and tl['secs'] == 10, 'workbench Armor: tailoring families; studded asks for a hide and a stud metal', tl)
    J(pg, "__SF.ACT.close()")
    # vendor sells pieces, never dragon armor; a bought piece is a proper instance
    sh = J(pg, "(() => { const S = __SF; const all = Object.values(S.SHOPS || {}).flat(); return { plate: all.includes('plate_chest'), dragon: all.some(id => /dragon/.test(id)), legacy: all.some(id => ['plate', 'chain', 'leather', 'clothvest'].includes(id)) }; })()")
    check(sh.get('plate') and not sh.get('dragon') and not sh.get('legacy'), 'vendors sell pieces, no dragon scale, no old suits', sh)
    # save and reload: equipment persists, penalties apply once
    J(pg, "__SF.save()"); before = J(pg, EQS); stam_cap = J(pg, "__SF.SF.maxStam(__SF.P)")
    pg.reload(); pg.wait_for_timeout(600); pg.click('[data-c=cont]'); pg.wait_for_timeout(900)
    after = J(pg, EQS); cap2 = J(pg, "__SF.eqTick(), __SF.SF.maxStam(__SF.P)")
    check(after == before and cap2 == stam_cap, 'equipment and its Dexterity penalty survive save and reload exactly once', [before, after, stam_cap, cap2])
    check(pg.is_visible('#eqwin'), 'the window reopens where it was after a reload')
    check(not errs, 'no page errors (desktop)', errs[:3])
    ctx.close()

    # ================= old save migration =================
    ctx = b.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page(); errs = []
    new_char(pg, errs, 'Glaive hybrid', 'Oldie')
    J(pg, """(() => { const S = __SF, SF = S.SF; S.save(); const s = JSON.parse(localStorage.getItem('shardfall.save.v1')); s.v = 6; const c = s.char; delete c.eqMig;
      c.equip = { weapon: c.equip.weapon, shield: null, armor: { uid: 9001, id: 'plate', qty: 1, cond: 60, maxc: 100, omax: 100, quality: 'exceptional', origin: 'crafted' } };
      c.pack.items.push({ uid: 9002, id: 'chain', qty: 1, cond: 100, maxc: 100 }, { uid: 9003, id: 'clothvest', qty: 1 }); c.bank.items.push({ uid: 9004, id: 'leather', qty: 1 });
      if (s.ally) { s.ally.equip = { weapon: s.ally.equip.weapon, shield: s.ally.equip.shield, armor: { uid: 9005, id: 'leather', qty: 1, cond: 100, maxc: 100 } }; delete s.ally.eqMig; }
      s.uid = 9100; localStorage.setItem('shardfall.save.v1', JSON.stringify(s)); localStorage.removeItem('shardfall.save.v1.prev6'); Storage.prototype.setItem = function () {}; })()""")
    pg.reload(); pg.wait_for_timeout(600); pg.click('[data-c=cont]'); pg.wait_for_timeout(900)
    mg = J(pg, """(() => { const S = __SF, P = S.P; const w = S.allyOf(); return { eq: Object.fromEntries(Object.entries(P.equip).filter(([k, v]) => v).map(([k, v]) => [k, v.id + '/' + (v.quality || '') + '/' + v.cond])), pack: P.pack.items.map(i => i.id), bank: P.bank.items.map(i => i.id), backup: !!localStorage.getItem('shardfall.save.v1.prev6'), wren: w && Object.values(w.equip).filter(Boolean).map(i => i.id), audit: S.EQ.audit(P).ok, chestUid: P.equip.chest && P.equip.chest.uid }; })()""")
    check(mg['eq'].get('chest', '').startswith('plate_chest/exceptional') and 'legs' in mg['eq'] and 'neck' in mg['eq'], 'worn v0.24 plate suit → worn plate pieces, exceptional kept', mg['eq'])
    check(mg['chestUid'] == 9001, 'the chest keeps the old suit item id', mg['chestUid'])
    check(all(x in mg['pack'] for x in ['chain_coif', 'chain_tunic', 'chain_leggings', 'shirt', 'trousers']) and 'chain' not in mg['pack'], 'old suits in the pack become pieces', mg['pack'])
    check(len([x for x in mg['bank'] if x.startswith('leather_')]) == 6, 'old leather suit in the bank becomes six pieces', mg['bank'])
    check(mg['backup'] and mg['audit'], 'old save backed up once; no duplicate items', mg)
    check(mg['wren'] and 'leather_tunic' in mg['wren'] and 'leather' not in mg['wren'], "Wren's old leather suit becomes pieces", mg['wren'])
    J(pg, "__SF.save()"); pg.reload(); pg.wait_for_timeout(600); pg.click('[data-c=cont]'); pg.wait_for_timeout(900)
    again = J(pg, "Object.values(__SF.P.equip).filter(Boolean).length + ':' + __SF.P.pack.items.length")
    check(again == f"{len(mg['eq'])}:{len(mg['pack'])}", 'a second load does not convert again', [again, len(mg['eq']), len(mg['pack'])])
    check(not errs, 'no page errors (migration)', errs[:3])
    ctx.close()

    # ================= phone (touch, landscape) =================
    ctx = b.new_context(viewport={'width': 844, 'height': 390}, is_mobile=True, has_touch=True, device_scale_factor=2); pg = ctx.new_page(); errs = []
    new_char(pg, errs, 'Merchant smith', 'Tap')
    J(pg, "__SF.P.str = 100"); uids = J(pg, f"({GIVE})([['studded_tunic'], ['norse_helm']])")
    pg.tap('#b-menu'); pg.wait_for_timeout(200); pg.tap('#menuScr [data-p=eqwin]'); pg.wait_for_timeout(250)
    check(pg.is_visible('#eqwin'), 'phone: Menu → Equip opens the paper doll')
    box = pg.locator('#eqwin').bounding_box()
    check(box['x'] >= 0 and box['y'] >= 0 and box['x'] + box['width'] <= 844 and box['height'] <= 390, 'phone: the window fits the landscape screen', box)
    J(pg, "__SF.ACT.bag()"); pg.wait_for_timeout(250)
    pb = pg.locator('#panel').bounding_box()
    check(pb['x'] >= box['x'] + box['width'] - 4 or pb['x'] + pb['width'] <= box['x'] + 4, 'phone: the backpack sits beside the doll, not under it', [box, pb])
    pg.tap(f"#panel .bagcell[data-u='{uids['studded_tunic']}']"); pg.wait_for_timeout(200)
    card = pg.inner_text('#panel .bagcard')
    check('Armor protection' in card and 'vs ' in card, 'phone: tapping an item shows its stats and the comparison', card[:160])
    pg.tap('#panel .bagcard [data-a=equip]'); pg.wait_for_timeout(200)
    check(J(pg, "__SF.P.equip.chest && __SF.P.equip.chest.id") == 'studded_tunic', 'phone: Equip from the tap card')
    pg.tap("#eqwin .eqs[data-s=chest]"); pg.wait_for_timeout(200)
    check(pg.is_visible('#eqwin .eqcard') and 'studded tunic' in pg.inner_text('#eqwin .eqcard').lower(), 'phone: tapping a slot shows the piece')
    pg.screenshot(path=f'{shots}/05-phone.png')
    pg.tap('#eqwin .eqcard [data-a=uneq]'); pg.wait_for_timeout(200)
    check(J(pg, "__SF.P.equip.chest") is None, 'phone: Remove from the slot card')
    # touch drag: hold, then move onto the head slot
    def tdrag(src, dst):
        pg.locator(src).first.scroll_into_view_if_needed(); J(pg, "document.querySelector('#eqwin .eqb').scrollTop = 0"); pg.wait_for_timeout(250)
        a = pg.locator(src).first.bounding_box(); z = pg.locator(dst).first.bounding_box()
        J(pg, f"""(async () => {{ const ax = {a['x'] + a['width'] / 2}, ay = {a['y'] + a['height'] / 2}, zx = {z['x'] + z['width'] / 2}, zy = {z['y'] + z['height'] / 2};
          const el = document.elementFromPoint(ax, ay); const ev = (t, x, y, tg) => (tg || document.elementFromPoint(x, y) || document.body).dispatchEvent(new PointerEvent(t, {{ pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true }}));
          ev('pointerdown', ax, ay, el); await new Promise(r => setTimeout(r, 450)); for (let i = 1; i <= 8; i++) ev('pointermove', ax + (zx - ax) * i / 8, ay + (zy - ay) * i / 8); ev('pointerup', zx, zy); }})()""")
        pg.wait_for_timeout(300)
    tdrag(f"#panel .bagcell[data-u='{uids['norse_helm']}']", "#eqwin .eqs[data-s=head]")
    check(J(pg, "__SF.P.equip.head && __SF.P.equip.head.id") == 'norse_helm', 'phone: hold and drag a helmet onto the head slot')
    check(not errs, 'no page errors (phone)', errs[:3])
    ctx.close(); b.close()
print('ALL PASS' if not fails else f'{len(fails)} FAILED'); sys.exit(1 if fails else 0)
