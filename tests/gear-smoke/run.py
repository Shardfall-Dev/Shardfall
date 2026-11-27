# Browser checks for the layered equipment renderer (src/gear.js, src/human-rig.js, src/gear-render.js) and Medieval Equipment Art v1.
# usage: python3 tests/gear-smoke/run.py Shardfall_v0.32.html [/path/to/chrome] [--shots DIR]
# Needs Python Playwright and Chrome. Screenshots and contact sheets go to $GEAR_SHOTS or --shots (default /tmp/gear-shots).
import sys, os, json, base64, time
from playwright.sync_api import sync_playwright

args = sys.argv[1:]
shots = os.environ.get('GEAR_SHOTS', '/tmp/gear-shots')
if '--shots' in args: i = args.index('--shots'); shots = args[i + 1]; del args[i:i + 2]
f = os.path.abspath(args[0] if args else 'Shardfall_v0.32.html')
chrome = args[1] if len(args) > 1 else '/usr/bin/google-chrome'
os.makedirs(shots, exist_ok=True)
fails = []
def check(ok, msg, got=None):
    print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else f'  (got {json.dumps(got) if not isinstance(got, str) else got})'))
    if not ok: fails.append(msg)
J = lambda pg, js, a=None: pg.evaluate(js, a) if a is not None else pg.evaluate(js)
def shot_el(pg, sel, path):   # the window re-renders with the live game, so shoot its box rather than a held element
    bb = J(pg, f"(() => {{ const r = document.querySelector('{sel}').getBoundingClientRect(); return {{ x: r.x, y: r.y, width: r.width, height: r.height }}; }})()")
    pg.screenshot(path=path, clip=bb)
def png(pg, js, name):
    url = J(pg, js)
    with open(f'{shots}/{name}', 'wb') as fh: fh.write(base64.b64decode(url.split(',', 1)[1]))

# equip a list of [id, {material, sec}] through the real UI command (ACT.equip → equipUid → the validated SF.EQ command)
EQUIP = """(o) => { const S = __SF, P = S.P, SF = S.SF, EQ = SF.EQ; P.str = 100; P.dex = 80;
  for (const s of EQ.SLOT_IDS) if (P.equip[s] && SF.ITEMS[P.equip[s].id].trade) S.ACT.uneq({ s });
  for (const [id, m] of o) { const d = SF.ITEMS[id]; const it = d.fam ? EQ.make(id, m || {}) : SF.newItem(id, 1, Object.assign({ cond: 100, maxc: 100, omax: 100 }, m || {})); SF.addItem(P.pack, it); S.ACT.equip({ u: it.uid }); }
  return EQ.SLOT_IDS.filter(s => P.equip[s]).map(s => P.equip[s].id); }"""
KEY = "SF.GEAR.ofChar(__SF.P).key".replace('SF.GEAR', '__SF.SF.GEAR')
FRAME = "(() => { __SF.update(.05); __SF.render(); })()"
SETS = {
    'mixed-plate': [['plate_chest', {'material': 'valorite'}], ['plate_arms', {'material': 'mithril'}], ['studded_leggings', {'material': 'spined', 'sec': 'golden'}], ['plate_gauntlets', {}], ['boots', {}], ['norse_helm', {'material': 'bronze'}], ['sword', {'material': 'verite'}], ['heater_shield', {'material': 'agapite'}], ['cloak', {}], ['belt', {}]],
    'leather': [['leather_cap', {'material': 'horned'}], ['leather_tunic', {'material': 'horned'}], ['leather_sleeves', {'material': 'horned'}], ['leather_gloves', {'material': 'horned'}], ['leather_leggings', {'material': 'horned'}], ['boots', {'material': 'thick'}], ['shortbow', {'material': 'bloodwood'}]],
    'studded': [['studded_tunic', {'material': 'barbed', 'sec': 'valorite'}], ['studded_sleeves', {'material': 'regular', 'sec': 'golden'}], ['studded_gloves', {'material': 'troll', 'sec': 'copper'}], ['studded_leggings', {'material': 'regular', 'sec': 'iron'}], ['bascinet', {'material': 'shadow_iron'}], ['mace', {'material': 'golden'}], ['wooden_shield', {'material': 'frostwood'}]],
    'chain': [['chain_coif', {'material': 'dull_copper'}], ['chain_tunic', {'material': 'dull_copper'}], ['ringmail_sleeves', {'material': 'iron'}], ['ringmail_gloves', {}], ['chain_leggings', {'material': 'copper'}], ['boots', {}], ['glaive', {}]],
    'bone-dragon': [['bone_helm', {}], ['dragon_chest', {}], ['bone_arms', {}], ['dragon_gloves', {}], ['bone_legs', {}], ['boots', {'material': 'dragon'}], ['hammer', {'material': 'valorite'}]],
    'mage': [['robe', {}], ['cloak', {}], ['boots', {}], ['belt', {'material': 'barbed'}], ['closed_helm', {'material': 'mithril'}], ['crossbow', {'material': 'heartwood'}]],
    'plate-great': [['great_helm', {'material': 'golden'}], ['plate_chest', {'material': 'iron'}], ['plate_arms', {'material': 'iron'}], ['plate_gauntlets', {'material': 'iron'}], ['plate_leggings', {'material': 'iron'}], ['boots', {}], ['waraxe', {}], ['kite_shield', {'material': 'shadow_iron'}]],
}

def start(b, body='male', gear='new', w=1280, h=800, touch=False, look=None, clear=True):
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'ERR_' not in m.text and 'Failed to load resource' not in m.text else None)
    pg.goto('file://' + f + ('?gear=' + gear if gear else '')); pg.wait_for_timeout(300)
    if clear: pg.evaluate('localStorage.clear()'); pg.reload()
    pg.wait_for_selector('[data-c=new]')
    lk = dict(look or {}); J(pg, "(o) => __CC.quick({ name: 'Tess Vane', look: Object.assign(__SF.SF.CREATION.defaultLook(o.body), o.look) })", {'body': body, 'look': lk})
    pg.wait_for_function('window.__SF && __SF.P && window.__GEAR && __GEAR.art.ready'); J(pg, FRAME)
    return ctx, pg, errs

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox', '--mute-audio'])

    # ================= flag off: the previous renderer is untouched =================
    ctx, pg, errs = start(b, gear=None)
    check(J(pg, "!__GEAR.on()"), 'the new art is off by default (previous renderer stays the default)')
    for _ in range(10): J(pg, FRAME)
    check(J(pg, "__GEAR.strips.stats.built") == 0 and J(pg, "__GEAR.strips.strips.size") == 0, 'flag off: no layered strips are built or drawn')
    J(pg, "__SF.ACT.eqwin()"); pg.wait_for_timeout(150)
    check(J(pg, "!!document.querySelector('#eqwin .doll') && !document.querySelector('#eqwin .gdoll')"), 'flag off: the paper doll shows the previous figure')
    pg.click('[data-a=gearart]'); pg.wait_for_timeout(200)
    check(J(pg, "__GEAR.on() && JSON.parse(localStorage.getItem('shardfall.settings')).gearArt === true"), '"New art" turns it on and remembers it')
    check(J(pg, "!!document.querySelector('#eqwin .gdoll') && document.querySelector('[data-a=gearart]').getAttribute('aria-pressed') === 'true'"), 'the paper doll switches to the new art at once')
    pg.click('[data-a=gearart]'); pg.wait_for_timeout(150)
    check(J(pg, "!__GEAR.on() && !!document.querySelector('#eqwin .doll')"), '…and back')
    check(not errs, 'no page errors (flag off)', errs[:3]); ctx.close()

    # ================= both bodies: paper dolls for every set, world sprites =================
    for body in ['male', 'female']:
        look = {'hairStyle': 'long', 'hairColor': 'auburn', 'skinTone': 'tan'} if body == 'female' else {'hairStyle': 'short', 'facialHairStyle': 'short', 'skinTone': 'bronze'}
        ctx, pg, errs = start(b, body, look=look)
        J(pg, "__SF.ACT.eqwin()"); pg.wait_for_timeout(150)
        shot_el(pg, '#eqwin .eqfig', f'{shots}/doll-{body}-starter.png')
        check(J(pg, "__GEAR.doll(__SF.P) && __GEAR.doll(__SF.P).canvas.width") == 210, f'{body}: the fitted paper doll is drawn')
        prev = J(pg, KEY)
        for name, items in SETS.items():
            got = J(pg, EQUIP, items)
            want = [i[0] for i in items]
            if name == 'chain': want = [x for x in want]   # all fit one slot each
            check(sorted(got) == sorted(want), f'{body} {name}: every piece equipped through the real command', got)
            k = J(pg, KEY); src = J(pg, "document.querySelector('#eqwin .gdoll') && document.querySelector('#eqwin .gdoll').src")
            check(k != prev and src and J(pg, "__GEAR.doll(__SF.P).key") == k, f'{body} {name}: the paper doll updates immediately on equip'); prev = k
            J(pg, FRAME)
            check(J(pg, "(() => { const A = __GEAR.of(__SF.P); return __GEAR.strips.strips.has(A.R.key + '#' + __GEAR.pose(__SF.P, A)[0] + '#' + (__SF.P.sect || 0)); })()"), f'{body} {name}: the world sprite is drawn with the new look in the same frame')
            # independent material channels match the live material colours
            ch = J(pg, "(() => { const SF = __SF.SF, EQ = SF.EQ, R = SF.GEAR.ofChar(__SF.P); return Object.values(R.slots).every(p => { const it = __SF.P.equip[p.slot], m = SF.ITEMS[p.id].fixedMat || SF.matOf(it); return !m || SF.ITEMS[p.id].fixedMat === 'cloth' || p.hex[SF.GEAR.kindOf(m)] === EQ.matColor(m) || p.hex.fixed === EQ.matColor(m); }); })()")
            check(ch, f'{body} {name}: every piece shows its own material colour (EQ.matColor)')
            shot_el(pg, '#eqwin .eqfig', f'{shots}/doll-{body}-{name}.png')
        # the occlusion the doll and world share
        J(pg, EQUIP, SETS['chain']); check(J(pg, "__SF.SF.GEAR.ofChar(__SF.P).occ.offhand") is False, f'{body}: halberd hides the off hand')
        J(pg, EQUIP, SETS['mage']); occ = J(pg, "__SF.SF.GEAR.ofChar(__SF.P).occ"); check(occ['hair'] == 'none' and occ['face'] is False and occ['robe'], f'{body}: closed helm hides hair and face; robe recorded', occ)
        # unequip updates at once too
        k = J(pg, KEY); J(pg, "__SF.ACT.uneq({ s: 'head' })"); check(J(pg, KEY) != k and J(pg, "__GEAR.doll(__SF.P).key") == J(pg, KEY), f'{body}: removing the helmet updates the doll at once')
        # eight directions × movement, combat and casting, in the live game
        J(pg, EQUIP, SETS['mixed-plate']); bad = []
        for d in range(8):
            for state, js in [('idle', "P.speed = 0; P.once = null; P.prep = null"), ('walk', "P.speed = 3"), ('run', "P.speed = 7"),
                              ('attack', "P.speed = 0; P.once = { clip: 'Sword_Attack', t0: __SF.GT - .1, tc: __SF.GT + .05 }"),
                              ('cast', "P.once = null; P.prep = { sp: __SF.SF.MAGERY.SPELLS[0], t0: __SF.GT - .2, t1: __SF.GT + .6 }")]:
                pose = J(pg, f"(() => {{ const P = __SF.P; P.sect = {d}; {js}; const A = __GEAR.of(P), r = __GEAR.pose(P, A); __SF.render(); const ok = __GEAR.strips.strips.has(A.R.key + '#' + r[0] + '#' + {d}); P.prep = null; P.once = null; P.speed = 0; return [r[0], r[1], ok]; }})()")
                expect = {'idle': ['idle'], 'walk': ['walk'], 'run': ['run'], 'attack': ['slash1h'], 'cast': ['cast1h']}[state]
                if pose[0] not in expect or not pose[2]: bad.append([d, state, pose])
        check(not bad, f'{body}: 8 directions × idle, walk, run, sword attack and casting all draw the right animation', bad[:4])
        # world close-ups in all eight directions
        J(pg, "__SF.P.speed = 0")
        sc = J(pg, "__SF.screenOf(__SF.P)")
        for d in [0, 2, 4, 6]:
            J(pg, f"(() => {{ __SF.P.sect = {d}; __SF.render(); }})()")
            pg.screenshot(path=f'{shots}/world-{body}-dir{d}.png', clip={'x': sc['x'] - 90, 'y': sc['y'] - 120, 'width': 180, 'height': 150})
        check(not errs, f'no page errors ({body})', errs[:3]); ctx.close()

    # ================= contact sheet: every animation × direction for a mixed set, both bodies (visual QA) =================
    ctx, pg, errs = start(b)
    J(pg, EQUIP, SETS['mixed-plate'])
    png(pg, """(() => { const R = __SF.SF.GEAR.ofChar(__SF.P), RIG = HUMAN_RIG, acts = ['idle', 'walk', 'run', 'ready', 'slash1h', 'thrust2h', 'blunt2h', 'polearm', 'bow', 'crossbow', 'cast1h', 'cast2h', 'caststaff', 'block', 'hit', 'death', 'corpse', 'bandage'];
      const k = 2, W = 112, H = 100, c = document.createElement('canvas'); c.width = 16 * W * k / 2; c.height = acts.length * H * k / 2; const g = c.getContext('2d'); g.fillStyle = '#3a3f36'; g.fillRect(0, 0, c.width, c.height); g.scale(k / 2, k / 2);
      acts.forEach((a, row) => { for (let col = 0; col < 16; col++) { const body = col < 8 ? 'male' : 'female', n = RIG.ANIMATIONS[a]; const ops = RIG.frameOps(Object.assign({ gear: Object.assign({}, R, { body }), dir: col % 8, action: a, frame: Math.min(n - 1, Math.floor(n * .55)), weaponRig: __SF.SF.GEAR.WEAPON_RIG }, { skin: '#b9875c', hair: '#7c401e', cloth: '#a89878', style: 'long' })); RIG.drawOps(g, ops, col * W, row * H); } });
      return c.toDataURL(); })()""", 'rig-contact-sheet.png')
    print('     contact sheet: rig-contact-sheet.png (rows: 18 animations; columns: 8 male then 8 female directions)')

    # ================= death, corpse appearance, save and reload =================
    J(pg, "(() => { const S = __SF, P = S.P; for (let r = 4; r < 80; r++) for (let a = 0; a < 16; a++) { const x = P.x + Math.cos(a / 16 * 6.283) * r, y = P.y + Math.sin(a / 16 * 6.283) * r; if (S.canStand(P, x, y) && !S.protAt(x, y)) { P.x = x; P.y = y; return; } } })()")
    J(pg, FRAME)
    pre = J(pg, KEY); J(pg, "__SF.damagePlayer(99999, null)"); J(pg, FRAME)
    co = J(pg, "(() => { const c = __SF.ents.find(e => e.kind === 'corpse' && e.mine && !e.gone); return c ? { key: c.gear && c.gear.key, n: c.cont.items.length, frozen: Object.isFrozen(c.gear), eq: Object.values(__SF.P.equip).filter(Boolean).map(i => i.id) } : null; })()")
    check(co and co['key'] == pre and co['frozen'] and co['n'] > 0, 'death: the corpse keeps the exact look the player died in; the items are in the corpse (loot unchanged)', co)
    for t in [.1, .3, .5, .9]:
        J(pg, f"(() => {{ for (let i = 0; i < 2; i++) __SF.update(.05); __SF.render(); }})()")
    HAS = "(() => { const c = __SF.ents.find(e => e.kind === 'corpse' && e.mine); return __GEAR.strips.strips.has(c.gear.key + '#death#' + (c.sect || 0)) && __GEAR.strips.strips.has(c.gear.key + '#corpse#' + (c.sect || 0)); })()"
    for _ in range(60):   # strips are built within a per-frame budget: on a slow runner give it a few more frames
        if J(pg, HAS): break
        J(pg, "(() => { __SF.update(.05); __SF.render(); })()"); pg.wait_for_timeout(50)
    check(J(pg, HAS), 'the corpse falls in the death animation, then lies in the corpse pose')
    J(pg, "(() => { __SF.P.x += 3; __SF.render(); })()")   # the ghost steps aside for the picture
    sc = J(pg, "(() => { const c = __SF.ents.find(e => e.kind === 'corpse' && e.mine); return __SF.screenOf(c); })()")
    pg.screenshot(path=f'{shots}/corpse.png', clip={'x': sc['x'] - 100, 'y': sc['y'] - 90, 'width': 200, 'height': 130})
    check(J(pg, "__SF.P.ghost && __GEAR.pose(__SF.P, __GEAR.of(__SF.P))[0] === 'idle'"), 'the ghost is drawn with the rig (ghost tint, no gear)')
    J(pg, "__SF.save()"); pg.reload(); pg.wait_for_selector('[data-c=cont]'); pg.click('[data-c=cont]'); pg.wait_for_function('window.__SF && __SF.P'); J(pg, FRAME)
    check(J(pg, "(() => { const c = __SF.ents.find(e => e.kind === 'corpse' && e.mine && !e.gone); return !!c && !!c.gear && c.gear.key; })()") == pre, 'save and reload: the corpse keeps its appearance')
    check(not errs, 'no page errors (death)', errs[:3]); ctx.close()

    # ================= equipment persistence through save and reload =================
    ctx, pg, errs = start(b, 'female', look={'hairStyle': 'buns'})
    J(pg, EQUIP, SETS['studded']); k = J(pg, KEY)
    J(pg, "__SF.save()"); pg.reload(); pg.wait_for_selector('[data-c=cont]'); pg.click('[data-c=cont]'); pg.wait_for_function('window.__SF && __SF.P && __GEAR.art.ready'); J(pg, FRAME)
    check(J(pg, KEY) == k, 'reload: the same equipment, materials and stud metals give the same appearance')
    J(pg, "__SF.ACT.eqwin()"); pg.wait_for_timeout(150); check(J(pg, "!!document.querySelector('#eqwin .gdoll')"), 'reload: the new art setting and the doll come back')

    # ================= NPCs, Wren and many actors =================
    J(pg, FRAME)
    npc = J(pg, "(() => { const S = __SF; const out = { guards: 0, guardTwo: 0, drawn: 0, wren: null }; for (const e of S.ents) { const A = e.kind === 'npc' && (e._wdA || e._gA); if (A) { out.drawn++; if (e._wdA) out.wardrobe = (out.wardrobe || 0) + 1; if (e.role === 'guard') { out.guards++; if (A.R.occ.offhand === false) out.guardTwo++; } } } const a = S.allyOf(); if (a) { const A = __GEAR.of(a); out.wren = [A.R.slots.weapon && A.R.slots.weapon.id, A.R.slots.shield && A.R.slots.shield.id, A.R.body]; } return out; })()")
    check(npc['drawn'] > 0, 'townsfolk near the player are drawn with the layered rig', npc)
    check(npc.get('wardrobe', 0) == npc['drawn'], 'their clothes come from the NPC wardrobe (#39) on SF.GEAR', npc)
    check(npc['wren'] and npc['wren'][0] == 'sword', "Wren is drawn from her real equipment", npc['wren'])
    J(pg, "(() => { const S = __SF, P = S.P, roles = ['guard', 'smith', 'healer', 'banker', 'trainer', 'outlaw', 'traveller', 'apothecary']; for (let i = 0; i < 60; i++) { const a = i / 60 * 6.283, r = 2 + (i % 6); S.addEnt({ kind: 'npc', role: roles[i % roles.length], name: 'Extra ' + i, x: P.x + Math.cos(a) * r, y: P.y + Math.sin(a) * r * .6, sect: i % 8, speed: i % 3 ? 3 : 0 }); } })()")
    for _ in range(40): J(pg, FRAME)
    t0 = time.time(); J(pg, "(() => { for (let i = 0; i < 60; i++) { for (const e of __SF.ents) if (e.name && e.name.startsWith('Extra') ) { e.sect = (e.sect + (i % 7 === 0)) % 8; } __SF.update(.05); __SF.render(); } })()"); on_ms = (time.time() - t0) * 1000 / 60
    st = J(pg, "({ px: __GEAR.strips.px, max: __GEAR.strips.MAX_PX, n: __GEAR.strips.strips.size, stats: __GEAR.strips.stats })")
    J(pg, "__GEAR.set(false)"); t0 = time.time(); J(pg, "(() => { for (let i = 0; i < 60; i++) { __SF.update(.05); __SF.render(); } })()"); off_ms = (time.time() - t0) * 1000 / 60; J(pg, "__GEAR.set(true)")
    print(f'     performance with ~70 humans on screen: {on_ms:.1f} ms per update+render with the layered renderer, {off_ms:.1f} ms with the previous one; {st["n"]} cached strips, {st["px"] / 1e6:.1f} of {st["max"] / 1e6:.0f} Mpx; built {st["stats"]["built"]} in {st["stats"]["ms"]:.0f} ms total')
    check(st['px'] <= st['max'], 'the strip cache stays within its pixel budget', st)
    check(on_ms < max(40, off_ms * 3), 'many NPCs stay within budget (cached strips, no per-frame rebuilds)', [on_ms, off_ms])
    for _ in range(40): J(pg, FRAME)
    sc = J(pg, "__SF.screenOf(__SF.P)"); pg.screenshot(path=f'{shots}/crowd.png', clip={'x': sc['x'] - 260, 'y': sc['y'] - 200, 'width': 520, 'height': 330})
    # bag icons for items with no painted icon of their own
    J(pg, "(() => { const S = __SF, it = S.SF.EQ.make('bone_helm'); S.SF.addItem(S.P.pack, it); })()")
    J(pg, "__SF.openPanel('bag')"); pg.wait_for_timeout(200)
    check(J(pg, "!!document.querySelector('.gearico[data-icon=bone_helm]')"), 'the backpack shows the painted art for an item with no icon of its own')
    check(not errs, 'no page errors (persistence, NPCs)', errs[:3]); ctx.close()

    # ================= phone =================
    ctx, pg, errs = start(b, 'female', w=844, h=390, touch=True)
    J(pg, EQUIP, SETS['mixed-plate']); J(pg, "__SF.ACT.eqwin()"); pg.wait_for_timeout(200)
    check(J(pg, "(() => { const e = document.querySelector('#eqwin'), d = document.querySelector('#eqwin .gdoll'); return !!d && e.scrollWidth <= e.clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; })()"), 'phone (844×390): the new doll fits without horizontal overflow')
    pg.screenshot(path=f'{shots}/phone.png')
    check(not errs, 'no page errors (phone)', errs[:3]); ctx.close()
    b.close()

print(f'\nscreenshots in {shots}')
print(f'\n{len(fails)} FAILED' if fails else '\nall gear-smoke checks passed'); sys.exit(1 if fails else 0)
