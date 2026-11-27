# Browser checks for Character Creation v2.0 (src/creation-ui.js, src/creation.js, src/stats.js).
# usage: python3 tests/creation-smoke/run.py Shardfall_v0.30.html [/path/to/chrome] [--shots DIR]
# Needs Python Playwright and Chrome. Screenshots go to $CC_SHOTS or --shots (default /tmp/cc-shots).
import sys, os, json
from playwright.sync_api import sync_playwright

args = sys.argv[1:]
shots = os.environ.get('CC_SHOTS', '/tmp/cc-shots')
if '--shots' in args: i = args.index('--shots'); shots = args[i + 1]; del args[i:i + 2]
f = os.path.abspath(args[0] if args else 'Shardfall_v0.30.html')
chrome = args[1] if len(args) > 1 else '/usr/bin/google-chrome'
os.makedirs(shots, exist_ok=True)
fails = []
def check(ok, msg, got=None):
    print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else f'  (got {json.dumps(got) if not isinstance(got, str) else got})'))
    if not ok: fails.append(msg)
J = lambda pg, js, a=None: pg.evaluate(js, a) if a is not None else pg.evaluate(js)
STEP = "(sec) => { for (let i = 0; i < Math.round(sec / .05); i++) __SF.update(.05); }"

def page(b, w=1280, h=720, touch=False):
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'ERR_' not in m.text and 'Failed to load resource' not in m.text else None)
    pg.goto('file://' + f); pg.wait_for_timeout(400); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_selector('[data-c=new]'); pg.wait_for_timeout(300)
    return ctx, pg, errs
def no_overflow(pg):
    return J(pg, "() => document.documentElement.scrollWidth <= innerWidth + 1 && [...document.querySelectorAll('#ccin, #ccmain, .ccprev, .ccnav')].every(e => e.scrollWidth <= e.clientWidth + 1)")
def nav_visible(pg):
    return J(pg, "() => { const n = document.querySelector('.ccnav'); if (!n) return false; const r = n.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 0; }")
def quick(pg, o): return J(pg, "o => __CC.quick(o)", o)
P = lambda pg, js: J(pg, f"(() => {{ const S = __SF, P = S.P, SF = S.SF; return {js}; }})()")

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox', '--mute-audio'])

    # ================= desktop wizard =================
    ctx, pg, errs = page(b)
    check(J(pg, "!document.querySelector('[data-c=cont]') && !!document.querySelector('[data-c=new]')"), 'title: no save → only New character')
    check(J(pg, "!window.__SF.P && __SF.ents.length === 0"), 'no world exists behind the title screen')
    pg.screenshot(path=f'{shots}/d0-title.png')
    pg.click('[data-c=new]'); pg.wait_for_selector('#ccn')
    check(J(pg, "document.activeElement && document.activeElement.id") == 'ccn', 'the name field has focus')
    pg.click('[data-c=next]'); pg.wait_for_timeout(100)
    check(J(pg, "__CC.draft.step") == 0 and 'Enter a name' in pg.inner_text('#ccn-err'), 'Next with no name stays and says why', pg.inner_text('#ccn-err'))
    pg.fill('#ccn', '<b>x'); check('letters' in pg.inner_text('#ccn-err'), 'markup in a name is refused inline')
    pg.fill('#ccn', 'Tess Vane')
    pg.click('[data-c=body][data-v=female]'); pg.wait_for_timeout(100)
    check(J(pg, "!document.querySelector('[data-k=facialHairStyle]') && !!document.querySelector('[data-k=hairStyle][data-v=buns]') && !document.querySelector('[data-k=hairStyle][data-v=mohawk]')"), 'female: no facial hair, female hairstyles offered')
    for k, v in [('hairStyle', 'buns'), ('hairColor', 'auburn'), ('skinTone', 'brown'), ('clothingColor', 'forest'), ('cloak', 'royal')]: pg.click(f'[data-c=look][data-k={k}][data-v={v}]')
    check(J(pg, "document.querySelector('[data-k=cloak][data-v=royal]').getAttribute('aria-checked')") == 'true', 'swatches report their state (aria-checked)')
    check(J(pg, "(() => { const c = document.querySelector('#ccdoll'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; })()") > 3000, 'portrait drawn')
    pg.wait_for_timeout(400); check(J(pg, "(() => { const c = document.querySelector('#ccsprite'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; })()") > 300, 'world sprite preview drawn')
    pg.click('[data-c=face][data-d="1"]'); check(J(pg, "__CC.draft.facing") == 1, 'the sprite preview turns')
    check(no_overflow(pg), 'desktop: no horizontal overflow (identity)')
    pg.screenshot(path=f'{shots}/d1-identity.png')
    pg.click('[data-c=next]'); pg.wait_for_selector('[data-c=tpl]')
    tpls = J(pg, "[...document.querySelectorAll('[data-c=tpl]')].map(b => b.dataset.t)")
    check(len(tpls) == 12 and 'swordsman' in tpls and 'advanced' in tpls, 'twelve templates incl. Advanced', tpls)
    pg.click('[data-c=tpl][data-t=archer]'); check(J(pg, "__CC.draft.stats") == [30, 40, 10], 'Archer fills 30/40/10')
    check(J(pg, "__CC.draft.town") == 'quay', 'a template never changes the town')
    pg.screenshot(path=f'{shots}/d2-profession.png')
    pg.click('[data-c=next]'); pg.wait_for_selector('[data-c=stv]')
    # budget: + at 0 left does nothing; − then + on another moves a point
    pg.click('[data-c=st][data-i="0"][data-d="1"]'); check(J(pg, "__CC.draft.stats") == [30, 40, 10], '+ with no points left does nothing')
    pg.click('[data-c=st][data-i="1"][data-d="-1"]'); pg.click('[data-c=st][data-i="0"][data-d="1"]'); check(J(pg, "__CC.draft.stats") == [31, 39, 10], '− frees a point, + spends it')
    check('Custom' in pg.inner_text('#ccmain h2'), 'an edit marks the numbers Custom')
    pg.fill('[data-c=stn][data-i="2"]', '99'); pg.press('[data-c=stn][data-i="2"]', 'Tab'); check(J(pg, "__CC.draft.stats") == [31, 39, 10], 'typed 99 is clamped to what the budget allows')
    J(pg, "(() => { const r = document.querySelector('[data-c=stv][data-i=\"2\"]'); r.value = 60; r.dispatchEvent(new Event('input', { bubbles: true })); })()")
    check(J(pg, "__CC.draft.stats") == [31, 39, 10], 'slider dragged to 60 stays inside the 80-point budget')
    pg.click('[data-c=st][data-i="1"][data-d="-1"]'); J(pg, "(() => { const r = document.querySelector('[data-c=stv][data-i=\"2\"]'); r.value = 60; r.dispatchEvent(new Event('input', { bubbles: true })); })()")
    check(J(pg, "__CC.draft.stats") == [31, 38, 11], 'slider takes only the free point')
    check(pg.inner_text('#ccstleft').startswith('0 of 80'), 'points-left counter live', pg.inner_text('#ccstleft'))
    # duplicate skill refused atomically
    before = J(pg, "__CC.draft.skills")
    J(pg, "(() => { const s = document.querySelector('[data-c=sk][data-i=\"1\"]'); s.value = 'archery'; s.dispatchEvent(new Event('change', { bubbles: true })); })()")
    check(J(pg, "__CC.draft.skills") == before, 'choosing a skill already in another row is refused, nothing changes')
    check(J(pg, "document.querySelector('[data-c=sk][data-i=\"1\"] option[value=archery]').disabled"), 'a chosen skill is disabled in the other rows')
    check(J(pg, "!document.querySelector('[data-c=sk] option[value=stealth]') && !document.querySelector('[data-c=sk] option[value=removetrap]')"), 'Stealth and Remove Trap are not offered')
    check(J(pg, "[...document.querySelectorAll('[data-c=sk][data-i=\"0\"] option')].some(o => o.textContent === 'Magery') && ![...document.querySelectorAll('[data-c=sk] option')].some(o => /Spellcraft|Concealment|Smithing/.test(o.textContent))"), 'canonical UO names in the picker')
    pg.select_option('[data-c=sk][data-i="2"]', 'healing'); check(J(pg, "__CC.draft.skills[2]") == ['healing', 20], 'swapping a skill keeps its points')
    J(pg, "(() => { const r = document.querySelector('[data-c=kvv][data-i=\"0\"]'); r.value = 50; r.dispatchEvent(new Event('input', { bubbles: true })); })()")
    check(J(pg, "__CC.draft.skills[0][1]") == 50 and pg.inner_text('#ccskleft').startswith('0 of 100'), 'skill slider at the budget')
    pg.click('summary'); pg.fill('#ccgq', 'lock'); check('Lockpicking' in pg.inner_text('#ccglist') and 'Mining' not in pg.inner_text('#ccglist'), 'skill guide search')
    pg.screenshot(path=f'{shots}/d3-stats.png')
    # template warning after edits
    pg.click('[data-c=step][data-s="1"]'); pg.click('[data-c=tpl][data-t=mage]'); pg.wait_for_selector('[data-c=tplok]')
    pg.click('[data-c=tplno]'); check(J(pg, "__CC.draft.edited") and J(pg, "__CC.draft.stats") == [31, 38, 11], 'Keep mine keeps the edited numbers')
    pg.click('[data-c=tpl][data-t=swordsman]'); pg.click('[data-c=tplok]'); check(J(pg, "__CC.draft.stats") == [45, 25, 10] and J(pg, "__CC.draft.name") == 'Tess Vane' and J(pg, "__CC.draft.look.hairStyle") == 'buns', 'Replace loads the template, name and look kept')
    pg.click('[data-c=step][data-s="3"]'); pg.wait_for_selector('[data-c=go]')
    check(not J(pg, "document.querySelector('[data-c=go]').disabled"), 'valid draft: Begin enabled')
    check('sword' in pg.inner_text('#ccmain') and '100 Gold' in pg.inner_text('#ccmain') and '10 Bandage' in pg.inner_text('#ccmain'), 'review lists the starting kit', pg.inner_text('#ccmain')[-400:])
    pg.screenshot(path=f'{shots}/d4-review.png')
    # invalid → disabled with a reason; fix returns
    pg.click('[data-c=step][data-s="0"]'); pg.fill('#ccn', ''); pg.click('[data-c=step][data-s="3"]')
    check(J(pg, "document.querySelector('[data-c=go]').disabled") and 'Enter a name' in pg.inner_text('#ccerrs'), 'invalid: Begin disabled, reason listed')
    pg.click('[data-c=fix][data-f=name]'); check(J(pg, "__CC.draft.step") == 0, 'Fix jumps to the step'); pg.fill('#ccn', 'Tess Vane'); pg.click('[data-c=step][data-s="3"]')
    # double submit → exactly one character and one kit
    J(pg, "(() => { const b = document.querySelector('[data-c=go]'); b.click(); b.click(); __CC.quick && 0; })()"); pg.wait_for_timeout(800)
    st = P(pg, "({ name: P.name, look: P.look, base: P.base, sk: Object.fromEntries(Object.entries(P.skills).filter(([k, v]) => v.v).map(([k, v]) => [k, v.v])), zero: Object.values(P.skills).filter(s => !s.v).length, locks: [...new Set(Object.values(P.skills).map(s => s.lock))], sl: P.statLocks, gold: SF.count(P.pack, 'gold'), w: P.equip.weapon && P.equip.weapon.id, books: P.pack.items.filter(i => i.id === 'journal').length, bound: P.bound, id: P.charId })")
    check(st['name'] == 'Tess Vane' and st['look']['body'] == 'female' and st['look']['hairStyle'] == 'buns' and st['look']['cloak'] == 'royal', 'created with the chosen name and look', st['look'])
    check(st['base'] == {'str': 45, 'dex': 25, 'int': 10}, '45/25/10 natural', st['base'])
    check(st['sk'] == {'swordsmanship': 500, 'tactics': 300, 'healing': 200} and st['zero'] == 46, 'skills 50.0/30.0/20.0 in tenths, 46 others at 0.0', st['sk'])
    check(st['locks'] == ['raise'] and st['sl'] == {'str': 'raise', 'dex': 'raise', 'int': 'raise'}, 'all skill and attribute locks Raise')
    check(st['gold'] == 100 and st['books'] == 1 and st['w'] == 'sword', 'one starter kit (100 gold, one journal, sword) after a double click', st)
    check(bool(st['id']), 'a stable character id')
    pg.screenshot(path=f'{shots}/d5-world.png')
    # character page: natural stats, locks, no stat purchase
    J(pg, "__SF.openPanel('gear')"); pg.wait_for_timeout(100)
    check('Intelligence' in pg.inner_text('#panel') and '/ 225' in pg.inner_text('#panel') and 'Intellect' not in pg.inner_text('#panel'), 'Character page: Intelligence, total / 225')
    pg.click('#panel [data-a=statlock][data-k=str]'); check(P(pg, "P.statLocks.str") == 'hold' and P(pg, "P.base.str") == 45, 'tapping a lock cycles it and never changes the value')
    pg.click('#panel [data-a=statlock][data-k=str]'); pg.click('#panel [data-a=statlock][data-k=str]'); check(P(pg, "P.statLocks.str") == 'raise', 'lock cycles raise → hold → lower → raise')
    J(pg, "__SF.closePanel()")
    check(P(pg, "typeof S.ACT.stat") == 'undefined' and P(pg, "typeof SF.statTrainCost") == 'undefined', 'no attribute purchase command or price exists')
    J(pg, "(() => { __SF.P.talkTo = null; })()")
    # reload → Continue; nothing regranted, nothing reset
    J(pg, "__SF.save()"); pg.reload(); pg.wait_for_selector('[data-c=cont]')
    check('Tess Vane' in pg.inner_text('[data-c=cont]'), 'title: Continue as the saved hero')
    pg.click('[data-c=cont]'); pg.wait_for_function('window.__SF && __SF.P')
    st2 = P(pg, "({ gold: SF.count(P.pack, 'gold'), base: P.base, look: P.look, j: P.pack.items.filter(i => i.id === 'journal').length, sk: P.skills.swordsmanship.v })")
    check(st2['gold'] == 100 and st2['j'] == 1 and st2['base'] == {'str': 45, 'dex': 25, 'int': 10} and st2['look']['hairStyle'] == 'buns' and st2['sk'] == 500, 'Continue: no second kit, stats, skills and look kept', st2)
    # replacing needs explicit consent; a refused creation never touches the save
    pg.reload(); pg.wait_for_selector('[data-c=new]'); raw0 = J(pg, "localStorage.getItem('shardfall.save.v1')")
    pg.click('[data-c=new]'); pg.fill('#ccn', 'Second'); pg.click('[data-c=step][data-s="3"]'); pg.wait_for_selector('[data-c=go]')
    check(J(pg, "document.querySelector('[data-c=go]').disabled") and 'Replace' in pg.inner_text('#ccmain'), 'with a save, Begin waits for “Replace”')
    check(pg.locator('[data-c=export]').count() == 1, 'the old save can be downloaded first')
    with pg.expect_download() as dl: pg.click('[data-c=export]')
    check(dl.value.suggested_filename.startswith('Shardfall_Tess'), 'download names the old hero', dl.value.suggested_filename)
    check(J(pg, "__CC.quick({ name: 'Bad', stats: [50, 10, 5], replace: true })") is False and J(pg, "localStorage.getItem('shardfall.save.v1')") == raw0 and J(pg, "!__SF.P"), 'an invalid creation is refused and the old save is untouched')
    check(J(pg, "__CC.quick({ name: 'Bad', skills: [['spellcraft', 50], ['magery', 50]], replace: true })") is False, 'alias duplicate refused at boot')
    pg.reload(); pg.wait_for_selector('[data-c=new]')
    pg.click('[data-c=new]'); pg.fill('#ccn', 'Second'); pg.click('[data-c=step][data-s="3"]'); pg.check('[data-c=replace]')
    check(not J(pg, "document.querySelector('[data-c=go]').disabled"), 'ticking Replace enables Begin')
    pg.click('[data-c=go]'); pg.wait_for_function('window.__SF && __SF.P')
    check(P(pg, "P.name") == 'Second' and J(pg, "localStorage.getItem('shardfall.save.v1.replaced')") == raw0, 'replaced; a copy of the old save is kept')
    check(not errs, 'no page errors (desktop wizard)', errs[:3])
    ctx.close()

    # ================= every template: kit, gear legality, load =================
    MAP = {'swordsman': 'sword', 'maceman': 'mace', 'fencer': 'dagger', 'archer': 'shortbow', 'mage': None, 'blacksmith': None, 'carpenter': None, 'rogue': None, 'healer': None, 'bard': None, 'tamer': None}
    for t, w in MAP.items():
        ctx, pg, errs = page(b); ok = quick(pg, {'name': 'Tess', 'template': t, 'replace': True})
        r = P(pg, "({ w: P.equip.weapon && P.equip.weapon.id, legal: Object.values(P.equip).filter(Boolean).every(i => SF.EQ.strReq(i) <= P.str), st: SF.EQ.encumbrance(P).stage, tot: SF.totalSkill(P), stats: P.base.str + P.base.dex + P.base.int, hb: P.hotbar.filter(Boolean).map(h => h.id), book: (P.pack.items.find(i => i.id === 'spellbook') || {}).spells, tools: P.pack.items.filter(i => SF.WORK_TOOLS[i.id] || ['lute', 'lockpick'].includes(i.id)).map(i => i.id) })")
        check(ok and r['w'] == w and r['legal'] and r['st'] == 0 and r['tot'] == 1000 and r['stats'] == 80, f'{t}: weapon {w}, legal, unencumbered, 100.0 skills, 80 stats', r)
        if t in ('mage', 'healer'): check(r['book'] == ['magery.04', 'magery.05'] and 'magery.05' in r['hb'], f'{t}: first-circle spellbook on the hotbar', r)
        if t == 'blacksmith': check('pickaxe' in r['tools'] and 'tongs' in r['tools'], 'blacksmith: pickaxe and tongs', r)
        if t == 'bard': check('lute' in r['tools'], 'bard: lute', r)
        if t == 'rogue': check('lockpick' in r['tools'] and 'hide' in r['hb'], 'rogue: lockpicks, Hide on the hotbar', r)
        check(not errs, f'{t}: no page errors', errs[:3]); ctx.close()

    # ================= starting towns =================
    for town in ['quay', 'vespar', 'mynoc', 'skara', 'moonglen']:
        ctx, pg, errs = page(b); ok = quick(pg, {'name': 'Tess', 'template': 'swordsman', 'town': town})
        r = P(pg, "(() => { const sh = S.SHRINES.find(s => s.id === P.bound); return { bound: P.bound, d: sh ? Math.hypot(sh.x + .5 - P.x, sh.y + .5 - P.y) : 99, stand: S.canStand(P, P.x, P.y), prot: !!S.protAt(P.x, P.y), zone: S.zoneAt(Math.floor(P.x), Math.floor(P.y)), town: P.created.town, wren: S.LOG.some(l => /Wren/.test(l.t)) }; })()")
        J(pg, "(" + STEP + ")(3)"); hp = P(pg, "[P.hp, SF.maxHp(P)]")
        check(ok and r['bound'] == town and r['d'] < (5 if town == 'quay' else 3) and r['stand'] and r['prot'] and r['town'] == town, f'{town}: spawn beside its shrine, standable, protected, soul bound there', r)
        check(r['wren'] == (town == 'quay'), f"{town}: the Quay's Wren hint only at the Quay", r)
        check(hp[0] == hp[1], f'{town}: safe for the first seconds', hp)
        pg.screenshot(path=f'{shots}/town-{town}.png'); check(not errs, f'{town}: no page errors', errs[:3]); ctx.close()

    # ================= play: a warrior fights a rat and bandages =================
    ctx, pg, errs = page(b); quick(pg, {'name': 'Tess', 'template': 'swordsman'})
    r = J(pg, """(() => { const S = __SF, P = S.P, SF = S.SF; const step = (sec) => { for (let i = 0; i < Math.round(sec / .05); i++) S.update(.05); };
      for (let k = 0; k < 200; k++) { const x = 120 + (k % 20) * 2, y = 280 + Math.floor(k / 20) * 2; if (!S.BLK[S.tAt(Math.floor(x), Math.floor(y))] && !S.protAt(x, y)) { P.x = x + .5; P.y = y + .5; break; } }
      const rat = S.spawnMon('rat', 1.2, 0); P.sel = rat; P.armed = true; let t = 0; while (!rat.dead && t < 60) { step(.5); t += .5; P.sel = rat; P.armed = true; }
      P.armed = false; P.hp = Math.max(1, SF.maxHp(P) - 20); const hp0 = P.hp; S.firstAid(P); step(9); return { killed: !!rat.dead, t, healed: P.hp > hp0, band: SF.count(P.pack, 'bandage') }; })()""")
    check(r['killed'] and r['healed'] and r['band'] == 9, 'a new Swordsman kills a rat and bandages himself', r)
    # a natural attribute gain from a real swing (src/skills.js SK.statGain): with the roll forced low the next skill gain also raises a stat
    r = J(pg, """(() => { const S = __SF, P = S.P, SF = S.SF; const step = (sec) => { for (let i = 0; i < Math.round(sec / .05); i++) S.update(.05); };
      const b0 = Object.assign({}, P.base), sum = b => b.str + b.dex + b.int; const rat = S.spawnMon('rat', 1.2, 0); rat.hp = rat.max = 400; S.setRng(() => 0);
      let t = 0; while (sum(P.base) === sum(b0) && t < 20) { step(.25); t += .25; P.sel = rat; P.armed = true; rat.hp = Math.max(rat.hp, 100); }
      S.setRng(null); P.armed = false; rat.hp = 0; S.killMon && S.killMon(rat);
      return { gained: sum(P.base) > sum(b0), b0, b1: P.base, msg: S.LOG.filter(l => /rises to/.test(l.t)).map(l => l.t), eff: [P.str, P.dex] }; })()""")
    check(r['gained'] and sum(r['b1'].values()) == sum(r['b0'].values()) + 1 and any('rises to' in m for m in r['msg']) and r['eff'] == [r['b1']['str'], r['b1']['dex']], 'fighting raises Strength or Dexterity naturally, with a journal line', r)
    check(not errs, 'no page errors (warrior)', errs[:3]); ctx.close()

    # ================= play: a mage casts =================
    ctx, pg, errs = page(b); quick(pg, {'name': 'Tess', 'template': 'mage'})
    r = J(pg, """(() => { const S = __SF, P = S.P, SF = S.SF; const step = (sec) => { for (let i = 0; i < Math.round(sec / .05); i++) S.update(.05); };
      for (let k = 0; k < 200; k++) { const x = 120 + (k % 20) * 2, y = 280 + Math.floor(k / 20) * 2; if (!S.BLK[S.tAt(Math.floor(x), Math.floor(y))] && !S.protAt(x, y)) { P.x = x + .5; P.y = y + .5; break; } }
      const rat = S.spawnMon('rat', 4, 0); rat.hp = rat.max = 200; S.setRng(() => .2); const m0 = P.mana, p0 = SF.count(P.pack, 'black_pearl');
      S.castSlot('magery.05'); step(1.05); const ok = S.releaseHeld(rat); const hp0 = rat.hp; step(1.2); S.setRng(null); return { ok, dmg: hp0 - rat.hp, mana: m0 - P.mana, pearl: p0 - SF.count(P.pack, 'black_pearl') }; })()""")
    check(r['ok'] and r['dmg'] > 0 and r['mana'] > 0 and r['pearl'] == 1, 'a new Mage casts Magic Arrow from the starting book and reagents', r)
    check(not errs, 'no page errors (mage)', errs[:3]); ctx.close()

    # ================= play: a smith mines, smelts and forges in Mynoc =================
    ctx, pg, errs = page(b); quick(pg, {'name': 'Tess', 'template': 'blacksmith', 'town': 'mynoc'})
    r = J(pg, """(() => { const S = __SF, P = S.P, SF = S.SF; const step = (sec) => { for (let i = 0; i < Math.round(sec / .05); i++) S.update(.05); }; S.setRng(() => .1);
      const FG = S.annWarp(556.5, 291.9); let face = null, fd = 1e9; for (let y = S.ANN.mine.y0 - 1; y <= S.ANN.mine.y1 + 1; y++) for (let x = S.ANN.mine.x0 - 1; x <= S.ANN.mine.x1 + 1; x++) if (S.tAt(x, y) === S.T.RK) { let spot = null; for (const [dx, dy] of [[1.3, 0], [-1.3, 0], [0, 1.3], [0, -1.3]]) if (S.canStand(P, x + .5 + dx, y + .5 + dy)) { spot = [x + .5 + dx, y + .5 + dy]; break; } if (spot) { const d = Math.hypot(x - FG[0], y - FG[1]); if (d < fd) { fd = d; face = { x, y, spot }; } } }
      P.x = face.spot[0]; P.y = face.spot[1]; const node = { kind: 'node', x: face.x, y: face.y, t: S.T.RK, skill: 'mining', name: 'rock face' }; P.sel = node;
      for (let k = 0; k < 40 && SF.count(P.pack, 'ore') < 6; k++) { if (!P.task) S.startGather(node); step(2.2); }
      const ore = SF.count(P.pack, 'ore'); P.x = FG[0]; P.y = FG[1]; P.sel = null;
      for (let k = 0; k < 8 && SF.count(P.pack, 'ironbar') < 3; k++) { S.startCraft('ironbar', 1); step(4); }
      const bars = SF.count(P.pack, 'ironbar'); const rec = SF.RECIPES.filter(r => r.skill === 'smithing' && r.min <= 50 && !/bar|ingot/.test(r.out)).sort((a, b) => a.min - b.min);
      let made = null; for (const r of rec) { const p = SF.craftPlan(P, P.pack, r); if (p.ok) { const n0 = P.pack.items.length; S.startCraft(r.id, 1); step(6); made = r.out; break; } }
      S.setRng(null); return { ore, bars, made, items: P.pack.items.map(i => i.id) }; })()""")
    check(r['ore'] >= 3 and r['bars'] >= 1 and r['made'], 'a new Blacksmith mines ore, smelts bars and forges an item in Mynoc', r)
    check(not errs, 'no page errors (smith)', errs[:3]); ctx.close()

    # ================= an old v7 save continues untouched =================
    ctx, pg, errs = page(b); quick(pg, {'name': 'Oldie', 'template': 'swordsman'}); J(pg, "__SF.save()")
    raw = J(pg, """(() => { const s = JSON.parse(localStorage.getItem('shardfall.save.v1')); s.v = 7; const c = s.char; delete c.statLocks; delete c.statGain; delete c.charId; delete c.created;
      c.look = { cloak: '#8a2a2a' }; c.str = 60; c.dex = 50; c.int = 40; c.skills.swordsmanship.v = 873; c.skills.tactics.lock = 'lower'; c.pack.items.find(i => i.id === 'gold').qty = 4321; return JSON.stringify(s); })()""")
    pg.close(); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))   # the running game saves when its page closes; inject after that
    pg.goto('file://' + f); pg.wait_for_selector('[data-c=new]'); J(pg, "r => { localStorage.clear(); localStorage.setItem('shardfall.save.v1', r); }", raw)
    pg.reload(); pg.wait_for_selector('[data-c=cont]'); pg.click('[data-c=cont]'); pg.wait_for_function('window.__SF && __SF.P'); pg.wait_for_timeout(300)
    r = P(pg, "({ base: P.base, eff: [P.str, P.dex, P.int], sk: P.skills.swordsmanship.v, tl: P.skills.tactics.lock, gold: SF.count(P.pack, 'gold'), look: P.look, sl: P.statLocks, id: !!P.charId, prev: !!localStorage.getItem('shardfall.save.v1.prev8'), w: P.equip.weapon && P.equip.weapon.id })")
    check(r['base'] == {'str': 60, 'dex': 50, 'int': 40} and r['eff'] == [60, 50, 40], 'old 150-point stats kept, not clamped to creation limits', r)
    check(r['sk'] == 873 and r['tl'] == 'lower' and r['gold'] == 4321 and r['w'] == 'sword', 'skills, locks, gold and gear kept; no kit regranted', r)
    check(r['look']['cloak'] == 'crimson' and r['look']['body'] == 'male' and r['sl'] == {'str': 'raise', 'dex': 'raise', 'int': 'raise'} and r['id'] and r['prev'], 'v7 → v9: skills reformed, look normalized (cloak colour → id), locks added, id given, backup kept', r)
    J(pg, "__SF.save()"); v = J(pg, "JSON.parse(localStorage.getItem('shardfall.save.v1')).v"); check(v == 9, 'saved as v9', v)
    pg.reload(); pg.wait_for_selector('[data-c=cont]'); pg.click('[data-c=cont]'); pg.wait_for_function('window.__SF && __SF.P')
    check(P(pg, "[P.base.str, P.skills.swordsmanship.v, SF.count(P.pack, 'gold')]") == [60, 873, 4321], 'migration idempotent across a second load')
    J(pg, "__SF.P.talkTo = { name: 'Master Vey', x: __SF.P.x, y: __SF.P.y, role: 'trainer' }; window.PTAB = 'stats'");
    check(not errs, 'no page errors (old save)', errs[:3]); ctx.close()

    # ================= phones =================
    for (w, h, tag) in [(844, 390, 'phone-landscape'), (667, 375, 'small-landscape'), (390, 844, 'phone-portrait')]:
        ctx, pg, errs = page(b, w, h, True)
        pg.tap('[data-c=new]'); pg.wait_for_selector('#ccn'); pg.fill('#ccn', 'Mobi')
        okall = True
        for s in range(4):
            pg.wait_for_timeout(150); o = no_overflow(pg); v = nav_visible(pg); okall = okall and o and v
            if not (o and v): print('   ', tag, 'step', s, 'overflow ok', o, 'nav visible', v)
            pg.screenshot(path=f'{shots}/{tag}-{s}.png')
            if s == 0: pg.locator('[data-c=look][data-k=skinTone][data-v=tan]').tap()
            if s == 1: pg.locator('[data-c=tpl][data-t=fencer]').scroll_into_view_if_needed(); pg.locator('[data-c=tpl][data-t=fencer]').tap()
            if s == 2: pg.locator('[data-c=kv][data-i="2"][data-d="-1"]').tap(); pg.locator('[data-c=kv][data-i="1"][data-d="1"]').tap()
            if s < 3: pg.locator('[data-c=next]').tap()
        check(okall, f'{tag}: every step fits the width, navigation always on screen')
        sz = J(pg, "[...document.querySelectorAll('#ccin button:not([disabled])')].filter(b => b.offsetParent).map(b => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); })")
        check(min(sz) >= 30, f'{tag}: touch targets at least 30 px (most 44)', min(sz))
        pg.locator('[data-c=go]').tap(); pg.wait_for_function('window.__SF && __SF.P')
        r = P(pg, "({ s: [P.base.str, P.base.dex, P.base.int], sk: [P.skills.fencing.v, P.skills.tactics.v, P.skills.healing.v], skin: P.look.skinTone, w: P.equip.weapon && P.equip.weapon.id })")
        check(r == {'s': [25, 30, 10], 'sk': [500, 310, 190], 'skin': 'tan', 'w': 'dagger'}, f'{tag}: created by touch', r)
        check(not errs, f'{tag}: no page errors', errs[:3]); ctx.close()
    b.close()

print('ALL PASS' if not fails else f'{len(fails)} FAILED'); sys.exit(1 if fails else 0)
