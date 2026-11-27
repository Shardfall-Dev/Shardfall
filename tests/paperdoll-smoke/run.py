# Browser checks for the classic paperdoll v1.0 (layered compositor, shared appearance, equipment window, creator portrait).
# usage: python3 tests/paperdoll-smoke/run.py Shardfall_v0.31.html [/path/to/chrome] [--shots DIR]
# Needs Python Playwright and Chrome. Screenshots go to $PD_SHOTS or --shots (default /tmp/pd-shots).
import sys, os, json
from playwright.sync_api import sync_playwright

args = sys.argv[1:]
shots = os.environ.get('PD_SHOTS', '/tmp/pd-shots')
if '--shots' in args: i = args.index('--shots'); shots = args[i + 1]; del args[i:i + 2]
f = os.path.abspath(args[0] if args else 'Shardfall_v0.31.html')
chrome = args[1] if len(args) > 1 else '/usr/bin/google-chrome'
os.makedirs(shots, exist_ok=True)
fails = []
def check(ok, msg, got=None):
    print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else f'  (got {json.dumps(got) if not isinstance(got, str) else got})'))
    if not ok: fails.append(msg)
J = lambda pg, js, a=None: pg.evaluate(js, a) if a is not None else pg.evaluate(js)

def boot(pg, errs, tpl='swordsman', name='Aldric', look=None):
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'ERR_' not in m.text and 'Failed to load resource' not in m.text else None)
    pg.goto('file://' + f); pg.wait_for_timeout(400); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(500)
    o = {'name': name, 'template': tpl}
    if look: o['look'] = look
    pg.evaluate("o => __CC.quick(o)", o); pg.wait_for_timeout(1200)

GIVE = """(ids) => { const S = __SF, SF = S.SF, P = S.P; const out = {}; for (const [id, o] of ids) { const it = SF.EQ.make(id, o || { origin: 'npc' }); SF.addItem(P.pack, it); out[id + (o && o.material ? ':' + o.material : '') + (o && o.sec ? '+' + o.sec : '')] = it.uid; } return out; }"""
KEY = "() => __SF.SF.LOOK.resolve(__SF.P).key"
IMGKEY = "() => { const i = document.querySelector('#eqwin img.pdoll'); return i && i.complete && i.naturalWidth ? i.dataset.key : null; }"
# pixel digest of a descriptor's rendering (and how many pixels differ between two)
HASH = """(o) => { const S = __SF, L = S.SF.LOOK; const c = S.PDOLL.render(L.resolve(o.a, o.opt)); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 2166136261, n = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3]) n++; h = Math.imul(h ^ (d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7 + d[i + 3]), 16777619); } return [h >>> 0, n]; }"""
DIFF = """(o) => { const S = __SF, L = S.SF.LOOK; const px = a => { const c = S.PDOLL.render(L.resolve(a)); return c.getContext('2d').getImageData(0, 0, c.width, c.height).data; };
  const x = px(o.a), y = px(o.b); let n = 0; for (let i = 0; i < x.length; i += 4) if (x[i] !== y[i] || x[i + 1] !== y[i + 1] || x[i + 2] !== y[i + 2] || x[i + 3] !== y[i + 3]) n++; return n; }"""
LOOK = lambda **k: dict({'body': 'male', 'skinTone': 'light', 'hairStyle': 'short', 'hairColor': 'darkbrown', 'facialHairStyle': 'none', 'facialHairColor': 'darkbrown', 'clothingColor': 'oatmeal', 'cloak': 'none'}, **k)
def actor(look=None, **eq):
    return {'look': look or LOOK(), 'equip': {s: (dict({'id': v}) if isinstance(v, str) else v) for s, v in eq.items()}}
# gallery: draws a list of descriptors side by side (with labels) into one PNG
GALLERY = """(o) => { const S = __SF, L = S.SF.LOOK, n = o.list.length, cols = Math.min(o.cols || 6, n), rows = Math.ceil(n / cols), w = 192, h = 256;
  const cv = document.createElement('canvas'); cv.width = cols * w; cv.height = rows * (h + 16); const g = cv.getContext('2d'); g.fillStyle = '#1a130e'; g.fillRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false;
  o.list.forEach((it, i) => { const x = (i % cols) * w, y = Math.floor(i / cols) * (h + 16); g.drawImage(S.PDOLL.render(L.resolve(it.a, it.opt)), x, y, w, h); g.fillStyle = '#e8d4a0'; g.font = '11px monospace'; g.fillText(it.label, x + 4, y + h + 12); });
  return cv.toDataURL(); }"""
import base64
def gallery(pg, name, items, cols=6):
    data = J(pg, GALLERY, {'list': items, 'cols': cols}); open(f'{shots}/{name}.png', 'wb').write(base64.b64decode(data.split(',')[1]))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
    # ================= creator portrait =================
    pg = b.new_page(viewport={'width': 1280, 'height': 720}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + f); pg.wait_for_timeout(400); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(500)
    if pg.is_visible('[data-c=new]'): pg.click('[data-c=new]'); pg.wait_for_timeout(400)
    J(pg, "() => { const SF = __SF.SF, o = SF.newItem; window.__made = 0; SF.newItem = (...a) => { window.__made++; return o(...a); }; }")
    def doll_sig(): return J(pg, "() => { const c = document.querySelector('#ccdoll'); if (!c) return null; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0, n = 0; for (let i = 0; i < d.length; i += 4) { if (d[i + 3]) n++; h = (h * 31 + d[i] + d[i + 1] * 7 + d[i + 2] * 13) >>> 0; } return [h, n]; }")
    s0 = doll_sig()
    check(s0 and s0[1] > 4000, 'the creator portrait is drawn by the paperdoll compositor', s0)
    seen = {s0[0]}
    for hs in ['long', 'ponytail', 'pageboy', 'receding', 'mohawk', 'bald']:
        pg.click(f'[data-k=hairStyle][data-v={hs}]'); pg.wait_for_timeout(120); seen.add(doll_sig()[0])
    check(len(seen) == 7, 'every male hairstyle changes the portrait', len(seen))
    pg.click('[data-k=facialHairStyle][data-v=vandyke]'); pg.wait_for_timeout(120); s1 = doll_sig()
    pg.click('[data-k=skinTone][data-v=deep]'); pg.wait_for_timeout(120); s2 = doll_sig()
    check(len({s0[0], s1[0], s2[0]}) == 3, 'facial hair and skin tone change the portrait')
    pg.screenshot(path=f'{shots}/01-creator-male.png')
    pg.click('[data-c=body][data-v=female]'); pg.wait_for_timeout(150)
    fem = set()
    for hs in ['short', 'long', 'ponytail', 'pageboy', 'buns', 'pigtails', 'bald']:
        pg.click(f'[data-k=hairStyle][data-v={hs}]'); pg.wait_for_timeout(120); fem.add(doll_sig()[0])
    check(len(fem) == 7, 'every female hairstyle changes the portrait', len(fem))
    pg.click('[data-k=hairStyle][data-v=pigtails]'); pg.wait_for_timeout(120)
    pg.screenshot(path=f'{shots}/02-creator-female.png')
    check(J(pg, 'window.__made') == 0, 'the portrait\'s preview equipment creates no items (nothing numbered, nothing saved)', J(pg, 'window.__made'))
    check(J(pg, "localStorage.length") == 0 or not J(pg, "Object.keys(localStorage).some(k => /save/i.test(k) && localStorage[k].includes('equip'))"), 'nothing is saved while drafting')
    check(not errs, 'creator: no page errors', errs[:3]); pg.close()

    # ================= desktop: the equipment window =================
    ctx = b.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page(); errs = []
    boot(pg, errs, 'swordsman')
    pg.keyboard.press('c'); pg.wait_for_timeout(400)
    check(pg.is_visible('#eqwin img.pdoll'), 'the equipment window shows the layered figure')
    check(J(pg, IMGKEY) == J(pg, KEY), 'the figure is the descriptor of P.look + P.equip (same key)')
    check(J(pg, "() => [...document.querySelectorAll('#eqwin img, #eqwin i')].every(e => !(e.src || e.style.backgroundImage || '').includes(SCOUT_SRC.slice(30, 90)))") if J(pg, "typeof SCOUT_SRC") == 'string' else True, 'the static SCOUT_SRC doll is gone from the window')
    nat = J(pg, "() => { const i = document.querySelector('#eqwin img.pdoll'); return [i.naturalWidth, i.naturalHeight]; }")
    check(nat == [384, 512], 'figure rendered at the 384×512 contract', nat)
    slots = J(pg, "() => [...document.querySelectorAll('#eqwin .eqs')].map(b => b.dataset.s)")
    check(len(slots) == 18 and set(slots) == set(J(pg, '__SF.EQ.SLOT_IDS')), 'all eighteen slots are still there', slots)
    worn0 = J(pg, "() => __SF.SF.LOOK.resolve(__SF.P).items.map(x => x.id)")
    check({'shirt', 'trousers', 'shoes', 'sword'} <= set(worn0), 'the starter kit is what the figure wears', worn0)
    pg.screenshot(path=f'{shots}/03-window-start.png')
    # equip by double-click: the figure changes at once; remove: it changes back exactly
    J(pg, "__SF.P.base.str = __SF.P.str = 100")
    uids = J(pg, f"({GIVE})([['plate_chest', {{ material: 'mithril' }}], ['great_helm', {{ material: 'valorite' }}], ['studded_leggings', {{ material: 'spined', sec: 'golden' }}], ['glaive'], ['heater_shield', {{ material: 'bronze' }}], ['boots', {{ material: 'horned' }}], ['cloak']])")
    k0 = J(pg, KEY); J(pg, "__SF.ACT.bag()"); pg.wait_for_timeout(250)
    pg.dblclick(f"#panel .bagcell[data-u='{uids['plate_chest:mithril']}']"); pg.wait_for_timeout(150)
    k1 = J(pg, KEY); check(k1 != k0 and J(pg, IMGKEY) == k1, 'double-click equip: the figure updates immediately', [k0[-60:], k1[-60:]])
    check(J(pg, "() => __SF.PDOLL.layersOf(__SF.SF.LOOK.resolve(__SF.P)).some(l => l.what === 'eq.plate_chest')"), 'the mithril plate chest layer is drawn')
    # drag onto a slot (mouse)
    def drag(src, dst):
        a = pg.locator(src).bounding_box(); t = pg.locator(dst).bounding_box()
        pg.mouse.move(a['x'] + a['width'] / 2, a['y'] + a['height'] / 2); pg.mouse.down(); pg.mouse.move(a['x'] + 30, a['y'] + 30, steps=4)
        pg.mouse.move(t['x'] + t['width'] / 2, t['y'] + t['height'] / 2, steps=8); pg.mouse.up(); pg.wait_for_timeout(200)
    drag(f"#panel .bagcell[data-u='{uids['great_helm:valorite']}']", "#eqwin .eqs[data-s=head]")
    check(J(pg, "__SF.P.equip.head && __SF.P.equip.head.id") == 'great_helm' and J(pg, IMGKEY) == J(pg, KEY), 'drag and drop onto the head slot: figure updated')
    check(J(pg, "() => __SF.SF.LOOK.resolve(__SF.P).hide.hair") == 'all', 'the great helm hides the hair')
    for k in ['studded_leggings:spined+golden', 'heater_shield:bronze', 'boots:horned', 'cloak']:
        pg.dblclick(f"#panel .bagcell[data-u='{uids[k]}']"); pg.wait_for_timeout(120)
    check(J(pg, IMGKEY) == J(pg, KEY), 'mixed armour: the figure follows every equip')
    pg.screenshot(path=f'{shots}/04-window-mixed.png')
    # tooltip and validation are unchanged
    pg.hover("#eqwin .eqs[data-s=chest]"); pg.wait_for_timeout(250)
    check(pg.is_visible('#itip') and 'Mithril' in pg.inner_text('#itip'), 'hovering a slot still shows the item tooltip')
    pg.mouse.move(700, 300); pg.wait_for_timeout(100)
    # two-handed: the glaive moves the shield back to the pack and the figure drops it
    J(pg, f"() => __SF.equipUid({uids['glaive']})"); pg.wait_for_timeout(200)     # the same validated path a double-click takes (the cell can sit under the window)
    two = J(pg, "() => ({ w: __SF.P.equip.weapon && __SF.P.equip.weapon.id, s: __SF.P.equip.shield, ghost: !!document.querySelector('#eqwin .eqs[data-s=shield].twohand'), off: __SF.PDOLL.layersOf(__SF.SF.LOOK.resolve(__SF.P)).some(l => l.layer === 'off') })")
    check(two['w'] == 'glaive' and not two['s'] and two['ghost'] and not two['off'], 'two-handed glaive: shield unequipped by the rules, 2H marker in the slot, no shield drawn', two)
    check(J(pg, IMGKEY) == J(pg, KEY), 'two-hand change: figure updated')
    pg.screenshot(path=f'{shots}/05-window-twohand.png')
    # removing by double-clicking a slot
    kb = J(pg, KEY); pg.dblclick("#eqwin .eqs[data-s=head]"); pg.wait_for_timeout(200)
    check(not J(pg, "__SF.P.equip.head") and J(pg, KEY) != kb and J(pg, IMGKEY) == J(pg, KEY), 'double-click remove: the helm leaves the figure at once')
    # the world sprite reads the same descriptor: a worn cloak item recolours the world cloak
    check(J(pg, "() => __SF.playerWorldLook().cloak") == J(pg, "() => __SF.SF.EQ.matColor('cloth')"), 'the world sprite takes its cloak from the worn cloak item')
    check(J(pg, "() => __SF.playerWorldLook().skinTone") == J(pg, "__SF.P.look.skinTone"), 'the world sprite takes skin from the same look')
    # missing art: an item with no paperdoll visual stays in its slot and is named, never drawn as something else
    J(pg, "() => { const SF = __SF.SF; SF.ITEMS.__test_hat = { id: '__test_hat', n: 'Test hat', kg: .1, slot: 'head', cat: 'armor', legacy: true }; __SF.P.equip.head = { uid: 999999, id: '__test_hat' }; __SF.renderEqWin(true); }")
    pg.wait_for_timeout(150)
    check(pg.is_visible('#eqwin .pdmiss') and 'Test hat' in pg.inner_text('#eqwin .pdmiss'), 'an item without paperdoll art shows the explicit missing-art note')
    pg.screenshot(path=f'{shots}/06-missing-art.png')
    J(pg, "() => { __SF.P.equip.head = null; delete __SF.SF.ITEMS.__test_hat; __SF.renderEqWin(true); }"); pg.wait_for_timeout(100)
    check(not pg.is_visible('#eqwin .pdmiss'), '…and the note goes away with the item')
    # save and reload: same look
    kS = J(pg, KEY); J(pg, "__SF.save()"); pg.reload(); pg.wait_for_timeout(600); pg.click('[data-c=cont]'); pg.wait_for_timeout(900)
    check(J(pg, KEY) == kS, 'save and reload: the identical appearance comes back', [kS[-50:], J(pg, KEY)[-50:]])
    if not pg.is_visible('#eqwin'): pg.keyboard.press('c'); pg.wait_for_timeout(300)
    check(J(pg, IMGKEY) == kS, 'after reload the window draws it')
    # cache and speed
    st = J(pg, "() => { const S = __SF, L = S.SF.LOOK; const t0 = performance.now(); for (let i = 0; i < 40; i++) S.PDOLL.render(L.resolve({ look: Object.assign(L.npcLook('n' + i), { cloak: 'teal' }), equip: {} })); return [S.PDOLL.cacheSize(), Math.round((performance.now() - t0) / 40), S.PDOLL.stats.ms]; }")
    check(st[0] <= 32, 'the figure cache stays bounded (≤ 32)', st)
    check(st[1] < 250, f'one figure composes in {st[1]} ms on average (cached afterwards; never in the render loop)', st)
    # ghost and corpse
    kL = J(pg, KEY)
    J(pg, "() => { __SF.P.hp = 1; __SF.damagePlayer(999, null, 'phys'); }"); pg.wait_for_timeout(400)
    gh = J(pg, "() => { const d = __SF.SF.LOOK.resolve(__SF.P); return { ghost: d.ghost, shown: d.items.filter(x => !x.hidden).map(x => x.id), cloak: d.cloak }; }")
    check(gh['ghost'] and set(gh['shown']) <= {'garment'} and gh['cloak'] is None, 'a ghost shows only the death robe', gh)
    if not pg.is_visible('#eqwin'): pg.keyboard.press('c'); pg.wait_for_timeout(300)
    check(J(pg, IMGKEY) == J(pg, KEY) and pg.is_visible('#eqwin .pdtag'), 'the window shows the ghost')
    pg.screenshot(path=f'{shots}/07-ghost.png')
    corpse = J(pg, "() => { const c = __SF.ents.find(e => e.kind === 'corpse' && e.mine); return c ? __SF.SF.LOOK.resolve(__SF.SF.LOOK.fromWire(c.look)).key : 'none'; }")
    check(corpse == 'none' or corpse.split('|')[-2] == kL.split('|')[-2], 'the corpse keeps the last worn appearance (or none on a protected road)', corpse[-60:])
    check(not errs, 'desktop: no page errors', errs[:3]); ctx.close()

    # ================= art galleries (the acceptance screenshots) =================
    pg = b.new_page(viewport={'width': 1280, 'height': 720}); errs = []; boot(pg, errs)
    LOOKS = [('male', h) for h in ['short', 'long', 'ponytail', 'pageboy', 'receding', 'mohawk', 'bald']] + [('female', h) for h in ['short', 'long', 'ponytail', 'pageboy', 'buns', 'pigtails', 'bald']]
    skins = ['porcelain', 'light', 'tan', 'olive', 'bronze', 'brown', 'deep']; hcols = ['black', 'darkbrown', 'brown', 'chestnut', 'auburn', 'red', 'blond', 'flaxen', 'grey', 'white']
    gallery(pg, '10-bodies-hair-skin', [{'a': actor(LOOK(body=bd, hairStyle=h, skinTone=skins[i % 7], hairColor=hcols[i % 10])), 'label': f'{bd[0]} {h} {skins[i % 7]}'} for i, (bd, h) in enumerate(LOOKS)], 7)
    gallery(pg, '11-beards', [{'a': actor(LOOK(facialHairStyle=fh, facialHairColor=hcols[i * 2 % 10], hairColor=hcols[i * 2 % 10])), 'label': fh} for i, fh in enumerate(['none', 'mustache', 'goatee', 'short', 'long', 'vandyke'])], 6)
    gallery(pg, '12-metals-same-piece', [{'a': actor(chest={'id': 'plate_chest', 'material': m}, arms={'id': 'plate_arms', 'material': m}, legs={'id': 'plate_leggings', 'material': m}, head={'id': 'plate_helm', 'material': m}, hands={'id': 'plate_gauntlets', 'material': m}), 'label': m} for m in ['iron', 'dull_copper', 'shadow_iron', 'copper', 'bronze', 'golden', 'agapite', 'verite', 'valorite', 'mithril']], 5)
    gallery(pg, '13-studded-hide-and-studs', [{'a': actor(LOOK(body='female', hairStyle='ponytail'), chest={'id': 'studded_tunic', 'material': h, 'sec': s}, arms={'id': 'studded_sleeves', 'material': h, 'sec': s}, legs={'id': 'studded_leggings', 'material': h, 'sec': s}, hands={'id': 'studded_gloves', 'material': h, 'sec': s}, neck={'id': 'studded_gorget', 'material': h, 'sec': s}), 'label': f'{h}+{s}'} for h, s in [('regular', 'iron'), ('regular', 'golden'), ('spined', 'iron'), ('spined', 'valorite'), ('barbed', 'copper'), ('dragon', 'mithril')]], 6)
    gallery(pg, '14-woods-bows-shields', [{'a': actor(weapon={'id': 'shortbow', 'material': w}) if i % 2 == 0 else actor(weapon='sword', shield={'id': 'wooden_shield', 'material': w}), 'label': w} for i, w in enumerate(['pine', 'oak', 'ash', 'yew', 'heartwood', 'bloodwood', 'frostwood'])], 7)
    WPN = ['sword', 'dagger', 'knife', 'kryss', 'mace', 'waraxe', 'hatchet', 'pickaxe', 'hammer', 'battleaxe', 'glaive', 'spear', 'shortbow', 'crossbow', 'heavycrossbow']
    gallery(pg, '15-weapons', [{'a': actor(shirt='shirt', trousers='trousers', feet='boots', weapon=w), 'label': w} for w in WPN], 8)
    SETS = [('cloth', dict(head='cloth_cap', robe='robe', hands='cloth_gloves', feet='shoes')), ('leather', dict(head='leather_cap', neck='leather_gorget', chest='leather_tunic', arms='leather_sleeves', hands='leather_gloves', legs='leather_leggings', feet='boots', belt='belt')),
      ('bone', dict(head='bone_helm', chest='bone_chest', arms='bone_arms', hands='bone_gloves', legs='bone_legs', feet='boots')), ('ringmail', dict(head='chain_coif', chest='ringmail_tunic', arms='ringmail_sleeves', hands='ringmail_gloves', legs='ringmail_leggings', feet='boots')),
      ('chain', dict(head='chain_coif', chest='chain_tunic', legs='chain_leggings', feet='boots', shirt='shirt')), ('dragon', dict(head='dragon_helm', chest='dragon_chest', arms='dragon_arms', hands='dragon_gloves', legs='dragon_legs', feet='boots')),
      ('tabard', dict(shirt='shirt', trousers='trousers', tunic='tabard', feet='boots', necklace='necklace', ring='ring', bracelet='bracelet')), ('helms', dict(head='bascinet')), ('open', dict(head='open_helm')), ('norse', dict(head='norse_helm')), ('closed', dict(head='closed_helm')), ('shields', dict(weapon='mace', shield='buckler'))]
    gallery(pg, '16-families-helms', [{'a': actor(LOOK(facialHairStyle='short', hairStyle='long'), **eqs), 'label': n} for n, eqs in SETS] + [{'a': actor(LOOK(body='female'), weapon='kryss', shield=s), 'label': s} for s in ['metal_shield', 'kite_shield', 'heater_shield']], 8)
    # pixel checks: materials change pixels, the drawing stays registered
    ir = actor(chest={'id': 'plate_chest', 'material': 'iron'}); va = actor(chest={'id': 'plate_chest', 'material': 'valorite'}); mi = actor(chest={'id': 'plate_chest', 'material': 'mithril'})
    h = [J(pg, HASH, {'a': a}) for a in (ir, va, mi)]
    check(len({x[0] for x in h}) == 3 and len({x[1] for x in h}) == 1, 'iron, valorite and mithril plate: different colours, identical silhouette', h)
    st1 = actor(chest={'id': 'studded_tunic', 'material': 'spined', 'sec': 'iron'}); st2 = actor(chest={'id': 'studded_tunic', 'material': 'spined', 'sec': 'golden'}); st3 = actor(chest={'id': 'studded_tunic', 'material': 'horned', 'sec': 'iron'})
    dS, dH = J(pg, DIFF, {'a': st1, 'b': st2}), J(pg, DIFF, {'a': st1, 'b': st3})
    check(0 < dS < dH / 4, f'studs recolour alone ({dS} px) without touching the leather ({dH} px when the hide changes)', [dS, dH])
    bo = [J(pg, HASH, {'a': actor(weapon={'id': 'shortbow', 'material': w})}) for w in ('oak', 'yew', 'frostwood')]
    check(len({x[0] for x in bo}) == 3 and len({x[1] for x in bo}) == 1, 'three woods: three bows of one shape', bo)
    unsup = J(pg, "() => __SF.SF.LOOK.wearables().filter(id => !__SF.PDOLL.supports(id))")
    check(unsup == [], 'the compositor draws every wearable item id', unsup)
    each = J(pg, "() => { const S = __SF, L = S.SF.LOOK, out = []; for (const id of L.wearables()) { const v = L.visualOf(id); const base = L.resolve({ look: S.SF.CREATION.defaultLook('male'), equip: {} }); const d = L.resolve({ look: S.SF.CREATION.defaultLook('male'), equip: { [v.slot]: { id } } }); const a = S.PDOLL.render(base).toDataURL(), b = S.PDOLL.render(d).toDataURL(); if (a === b) out.push(id); } return out; }")
    check(each == [], 'every wearable item visibly changes the figure on its own', each)
    # NPCs: one stable look per NPC, drawn through the same path
    npc = J(pg, "() => { const e = __SF.ents.find(x => x.kind === 'npc'); if (!e) return null; const a = __SF.npcLook(e), b = __SF.npcLook(e); return [a === b, a.cloak, Object.keys(e).includes('look')]; }")
    check(npc and npc[0] and npc[1].startswith('#') and not npc[2], 'human NPCs get a stable shared look (role colour kept as the cloak; nothing added to the saved entity)', npc)
    gallery(pg, '17-npcs', [{'a': {'look': J(pg, "s => __SF.SF.LOOK.npcLook(s, '#5a5a62')", f'npc-{i}'), 'equip': {'shirt': {'id': 'shirt'}, 'trousers': {'id': 'trousers'}, 'feet': {'id': 'shoes'}}}, 'label': f'npc-{i}'} for i in range(8)], 8)
    check(not errs, 'galleries: no page errors', errs[:3]); pg.close()

    # ================= phones =================
    for vw, vh, tag in [(844, 390, 'phone-landscape'), (390, 844, 'phone-portrait')]:
        ctx = b.new_context(viewport={'width': vw, 'height': vh}, has_touch=True, is_mobile=True, device_scale_factor=2); pg = ctx.new_page(); errs = []
        boot(pg, errs)
        if pg.is_visible('text=Play in portrait anyway'): pg.click('text=Play in portrait anyway'); pg.wait_for_timeout(300)
        J(pg, "() => { if (!__SF.SETTINGS || !__SF.SETTINGS.eqOpen) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' })); }"); pg.wait_for_timeout(300)
        if not pg.is_visible('#eqwin'): pg.keyboard.press('c'); pg.wait_for_timeout(300)
        r = J(pg, "() => { const r = document.querySelector('#eqwin').getBoundingClientRect(), f = document.querySelector('#eqwin img.pdoll').getBoundingClientRect(), x = document.querySelector('#eqwin .eqh .x').getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom, f.width, f.height, x.width, x.height]; }")
        check(r[0] >= 0 and r[1] >= 0 and r[2] <= vw + 1 and r[3] <= vh + 1, f'{tag}: the window fits on screen', r)
        check(r[4] >= 100 and abs(r[5] / r[4] - 4 / 3) < .02, f'{tag}: the whole figure is shown, 3:4, at least 100 px wide', r[4:6])
        check(r[6] >= 36 and r[7] >= 36, f'{tag}: the close button is a large touch target', r[6:8])
        check(J(pg, IMGKEY) == J(pg, KEY), f'{tag}: figure matches the character')
        pg.screenshot(path=f'{shots}/20-{tag}.png')
        check(not errs, f'{tag}: no page errors', errs[:3]); ctx.close()
    b.close()

print(f'\n{len(fails)} failed' if fails else '\nALL PASS'); print('screenshots in', shots)
sys.exit(1 if fails else 0)
