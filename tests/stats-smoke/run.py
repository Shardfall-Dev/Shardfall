# Browser checks for the T2A attribute system (docs/stats/STAT_SYSTEM_REWORK_v1.0.md). Needs Python Playwright + Chrome.
# usage: python3 tests/stats-smoke/run.py Shardfall_v0.30.html [/path/to/chrome]
# Creation (80 points, 1-point and 5-point controls, every preset playable), the Character page and paper doll (natural and effective
# values, the 225 total, lock buttons that cycle, persist and are big enough to tap), real gameplay paths through the stat contract
# (play.js), the v7 → v8 save conversion of a 150-point character, death and reload, and a phone pass.
import sys, os, json
from playwright.sync_api import sync_playwright

here = os.path.dirname(os.path.abspath(__file__))
f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.30.html')
chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
fails = []
def check(ok, msg, got=None):
    print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else f'  (got {got!r})'))
    if not ok: fails.append(msg)

PRESETS = {'Glaive hybrid': [35, 20, 25], 'Venom skirmisher': [30, 40, 10], 'Group healer': [20, 10, 50], 'Archer scout': [25, 45, 10], 'Mace dexer': [35, 35, 10], 'Merchant smith': [45, 25, 10]}
STATE = "() => { const P = __SF.P, SF = __SF.SF; const w = P.equip.weapon; return { base: P.base, eff: [P.str, P.dex, P.int], max: [SF.maxHp(P), SF.maxStam(P), SF.maxMana(P)], hp: P.hp, locks: P.statState.locks, weapon: w && w.id, wreq: w ? SF.EQ.strReq(w) : 0, gold: SF.count(P.pack, 'gold'), skills: SF.totalSkill(P) }; }"
CCVALS = "() => [...document.querySelectorAll('#cc .stat b')].map(b => +b.textContent)"

def fresh(pg, errs):
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + f); pg.wait_for_timeout(500); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(600)

def create(pg, prof, name='Tess'):
    pg.click(f'[data-c=prof][data-p="{prof}"]'); pg.fill('#ccn', name); pg.click('[data-c=go]'); pg.wait_for_timeout(900)

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
    # ---------- creation, desktop ----------
    pg = b.new_page(viewport={'width': 1280, 'height': 800}); errs = []; fresh(pg, errs)
    note = pg.inner_text('#cc label:has-text("Attributes")')
    check('80 / 80' in note and '10–60' in note, 'creation shows 80 points, 10–60 each', note)
    check(pg.evaluate(CCVALS) == PRESETS['Glaive hybrid'], 'default preset is 35/20/25', pg.evaluate(CCVALS))
    check(pg.locator('#cc .stat >> nth=0').locator('button').count() == 4, 'four controls per attribute (−5, −1, +1, +5)')
    check(pg.is_disabled('#cc [data-c=st][data-i="0"][data-d="1"]'), '+1 disabled at 80 points')
    pg.click('#cc [data-c=st][data-i="0"][data-d="-1"]'); pg.wait_for_timeout(50)
    check(pg.evaluate(CCVALS) == [34, 20, 25] and '1 points left' in pg.inner_text('#cc'), '−1 lowers by one point and shows what is left', pg.evaluate(CCVALS))
    pg.fill('#ccn', 'Tess'); pg.click('[data-c=go]'); pg.wait_for_timeout(200)
    check('Spend exactly 80' in pg.inner_text('#ccerr'), 'cannot start with 79 points', pg.inner_text('#ccerr'))
    pg.click('#cc [data-c=st][data-i="2"][data-d="1"]'); pg.wait_for_timeout(50)
    for _ in range(8): pg.click('#cc [data-c=st][data-i="2"][data-d="5"]', force=True)
    check(pg.evaluate(CCVALS) == [34, 20, 26], '+5 never passes 80 (or 60)', pg.evaluate(CCVALS))
    for _ in range(4): pg.click('#cc [data-c=st][data-i="1"][data-d="-5"]', force=True)
    check(pg.evaluate(CCVALS)[1] == 10, '−5 never goes below 10', pg.evaluate(CCVALS))
    tips = pg.evaluate("[...document.querySelectorAll('#cc .stat')].map(e => e.title)")
    check(all('grows while you use' in t for t in tips) and 'Mining' in tips[0], 'attribute tooltips name the skills that train them', tips[0][:90])
    pg.close()

    # ---------- every preset is playable ----------
    for prof, vals in PRESETS.items():
        pg = b.new_page(viewport={'width': 1280, 'height': 800}); errs = []; fresh(pg, errs); create(pg, prof)
        st = pg.evaluate(STATE)
        ok = st['base'] == dict(zip(['str', 'dex', 'int'], vals)) and st['max'] == [max(1, vals[0]), max(1, vals[1]), max(1, vals[2])] and st['hp'] == vals[0] and st['wreq'] <= st['eff'][0] and not errs
        check(ok, f'{prof}: {vals} natural, Health/Stamina/Mana = STR/DEX/INT, starter weapon {st["weapon"]} wearable', (st, errs))
        pg.evaluate("__SF.ACT.gear()"); pg.wait_for_timeout(150)
        check(pg.locator('#panel .attrs [data-a=slock]').count() == 3 and f'{sum(vals)} / 225' in pg.inner_text('#panel .attrs'), f'{prof}: Character page shows the attributes, total {sum(vals)} / 225 and three locks')
        if prof in ('Glaive hybrid', 'Venom skirmisher', 'Mace dexer', 'Archer scout'):
            # a fresh 80-point fighter in its starter leather beats a dock rat (non-fighters lose a bare-handed fight on main too)
            r = pg.evaluate("""() => { const S = __SF, P = S.P; const d = S.MON.rat; const e = { kind: 'mon', type: 'rat', name: d.n, x: P.x + 1, y: P.y, hp: d.hp, max: d.hp, state: 'chase', target: P, home: { x: P.x, y: P.y }, sect: 0, ward: 0, id: 95000, speed: 0 }; S.ents.push(e); P.armed = true; P.sel = e;
              for (let i = 0; i < 1200 && !e.dead && !P.ghost; i++) S.update(.05); return { ratDead: !!e.dead || e.hp <= 0, ghost: !!P.ghost, hp: Math.round(P.hp) }; }""")
            check(not r['ghost'] and r['ratDead'], f'{prof}: fresh 80-point fighter beats a dock rat ({r})')
        pg.close()

    # ---------- locks: Character page, paper doll, persistence ----------
    pg = b.new_page(viewport={'width': 1280, 'height': 800}); errs = []; fresh(pg, errs); create(pg, 'Group healer')
    pg.evaluate("__SF.ACT.gear()"); pg.wait_for_timeout(150)
    lk = '#panel .attrs [data-a=slock][data-k=str]'
    check(pg.get_attribute(lk, 'aria-label').startswith('Strength is set to Raise'), 'lock button has an accessible label', pg.get_attribute(lk, 'aria-label'))
    pg.click(lk); pg.wait_for_timeout(100); pg.click('#panel .attrs [data-a=slock][data-k=dex]'); pg.click('#panel .attrs [data-a=slock][data-k=dex]'); pg.wait_for_timeout(100)
    check(pg.evaluate("__SF.P.statState.locks") == {'str': 'hold', 'dex': 'lower', 'int': 'raise'}, 'tapping cycles Raise → Locked → Lower')
    check(pg.inner_text(lk) == '■' and pg.inner_text('#panel .attrs [data-a=slock][data-k=dex]') == '▼', 'glyphs ■ and ▼ shown')
    base0 = pg.evaluate("JSON.stringify(__SF.P.base)")
    check(base0 == '{"str":20,"dex":10,"int":50}', 'locks never change values', base0)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100); pg.keyboard.press('c'); pg.wait_for_timeout(300)
    check(pg.locator('#eqwin .attrs [data-a=slock]').count() == 3, 'paper doll shows the attribute locks too')
    pg.click('#eqwin .attrs [data-a=slock][data-k=int]'); pg.wait_for_timeout(100)
    check(pg.evaluate("__SF.P.statState.locks.int") == 'hold', 'paper doll lock works')
    # keyboard: focus the button and press Enter
    pg.focus('#eqwin .attrs [data-a=slock][data-k=int]'); pg.keyboard.press('Enter'); pg.wait_for_timeout(100)
    check(pg.evaluate("__SF.P.statState.locks.int") == 'lower', 'lock reachable from the keyboard')
    pg.evaluate("__SF.P.mg.mods = {}; __SF.SF.MAGERY.applyStatMod(__SF.P.mg.mods, 'int', 7, __SF.GT + 99); __SF.recomputeStats(); __SF.ACT.gear()"); pg.wait_for_timeout(150)
    check('57 with magic' in pg.inner_text('#panel .attrs') and '50' in pg.inner_text('#panel .attrs'), 'natural 50 and effective 57 both shown while a boon lasts', pg.inner_text('#panel .attrs'))
    pg.evaluate("__SF.save()"); raw = pg.evaluate("localStorage.getItem('shardfall.save.v1')"); sv = json.loads(raw)
    check(sv['v'] == 8 and sv['char']['base'] == {'str': 20, 'dex': 10, 'int': 50} and sv['char']['int'] == 50 and sv['char']['statState']['locks'] == {'str': 'hold', 'dex': 'lower', 'int': 'lower'}, 'save v8 stores natural values (not the boon) and the locks', (sv['v'], sv['char'].get('base'), sv['char']['int']))
    pg.reload(); pg.wait_for_timeout(600); pg.click('[data-c=cont]'); pg.wait_for_timeout(900)
    st = pg.evaluate(STATE)
    check(st['locks'] == {'str': 'hold', 'dex': 'lower', 'int': 'lower'} and st['base'] == {'str': 20, 'dex': 10, 'int': 50} and st['eff'] == [20, 10, 50], 'locks and natural values survive a reload; the boon does not', st)
    # death and reload keep attributes
    pg.evaluate("__SF.damagePlayer(9999, null, 'phys')"); pg.wait_for_timeout(100)
    st = pg.evaluate(STATE); check(pg.evaluate("__SF.P.ghost") and st['base'] == {'str': 20, 'dex': 10, 'int': 50} and st['hp'] == 0, 'death keeps natural attributes; the ghost has 0 HP', st)
    pg.evaluate("__SF.save()"); pg.reload(); pg.wait_for_timeout(600); pg.click('[data-c=cont]'); pg.wait_for_timeout(900)
    st = pg.evaluate(STATE); check(st['base'] == {'str': 20, 'dex': 10, 'int': 50} and st['hp'] == 0, 'a ghost reloads as a ghost with its attributes', st)
    check(not errs, 'no page errors (creation, locks, reload)', errs)
    pg.close()

    # ---------- gameplay paths (play.js) ----------
    pg = b.new_page(viewport={'width': 1280, 'height': 800}); errs = []; fresh(pg, errs); create(pg, 'Glaive hybrid')
    got = pg.evaluate(open(os.path.join(here, 'play.js')).read())
    print('     ' + json.dumps(got)[:1500])
    check(got['miss']['rolls'] == ['swordsmanship'] and got['miss']['total'] == 1, 'melee miss: one roll (weapon skill), one point', got['miss'])
    check(got['hit']['rolls'] == ['swordsmanship'] and got['hit']['total'] == 1 and got['hit']['ratHurt'], 'melee hit: one roll — Tactics and Anatomy add none', got['hit'])
    check(got['noRefill'], 'a Strength gain does not heal')
    check(got['journal'] >= 2, 'journal line "Your … has increased to N."', got['journal'])
    check(got['sharedAction'] == 1, 'two skills on one action id: one roll', got['sharedAction'])
    check(got['archery']['fired'] and got['archery']['rolls'] == ['archery'], 'archery release: one roll', got['archery'])
    check(got['mining']['rolls'] == ['mining'] and got['mining']['total'] == 1, 'mining stroke at a finite face: one roll, one point', got['mining'])
    check(got['smithing']['rolls'] == ['smithing'], 'smithing attempt at the anvil: one roll', got['smithing'])
    check(got['healing']['rolls'] == ['healing'], 'bandage treatment: one roll on Healing, Anatomy auxiliary', got['healing'])
    check(got['castSelf']['rolls'] == ['spellcraft'], 'self cast: one roll (Spellcraft), Wardcraft auxiliary', got['castSelf'])
    check(got['castFoe']['held'] and got['castFoe']['rolls'] == ['spellcraft'], 'damage spell: one roll, Spell Focus auxiliary', got['castFoe'])
    check(got['meditation']['rolls'] == ['meditation'], 'a meditation interval that restored missing mana: one roll', got['meditation'])
    check(got['meditateFull'] == 0, 'meditating at full mana: no roll', got['meditateFull'])
    check(got['hiding']['rolls'] == ['concealment'], 'hiding near a creature: one roll', got['hiding'])
    check(got['bardFail'] == ['provocation'] and got['bardOk'] == ['provocation'], 'bard song: one roll on the bard skill, failed or not (Musicianship auxiliary)', (got['bardFail'], got['bardOk']))
    t = got['trainer']; check(t['skill'] == 300 and t['base'] and t['rolls'] == 0 and t['gold'] and t['noStatAction'], 'trainer lesson: skill to 30, no attribute change, no stat purchase command', t)
    check(got['trainerTab']['buttons'] == 0 and got['trainerTab']['text'], 'trainer Attributes tab explains, sells nothing', got['trainerTab'])
    check(got['devAdvance'] == 0, 'no gain while the developer panel fast-forwards time')
    tr = got['transfer']; check(tr['base'] == {'str': 99, 'dex': 100, 'int': 26} and tr['total'] == 225 and len(tr['log']) == 1 and 'Strength has decreased to 99' in tr['log'][0], 'at 225: STR (Lower) gives a point to INT, one journal line naming both', tr)
    sp = got['strPolicy']; check(sp['equipped'] and sp['str'] == sp['need'] - 1 and not sp['worn'] and sp['inPack'] and sp['msg'], 'Strength below a worn piece\'s requirement: it goes into the backpack, with a message', sp)
    bf = got['buff']; check(bf['afterGain'] == [41, 51] and bf['expired'] == [41, 41], 'gain during a Strength boon: +1 natural, the boon expires cleanly', bf)
    gh = got['ghost']; check(gh['ghost'] and gh['rolls'] == 0 and gh['base'] and gh['hp'] == 0, 'a ghost does not train', gh)
    check(not errs, 'no page errors (gameplay paths)', errs)
    pg.close()

    # ---------- v7 → v8: a 150-point character from before the rework ----------
    pg = b.new_page(viewport={'width': 1280, 'height': 800}); errs = []; fresh(pg, errs); create(pg, 'Mace dexer', 'Oldtimer')
    pg.evaluate("""() => { const S = __SF, P = S.P, SF = S.SF; SF.addItem(P.pack, SF.newItem('gold', 350)); P.skills.mining.v = 420; S.save();
      const s = JSON.parse(localStorage.getItem('shardfall.save.v1')); s.v = 7; const c = s.char; delete c.base; delete c.statState; delete c.statMig; c.str = 60; c.dex = 60; c.int = 30; c.hp = 90;
      localStorage.setItem('shardfall.save.v1', JSON.stringify(s)); const o = localStorage.setItem.bind(localStorage); localStorage.setItem = (k, v) => k === 'shardfall.save.v1' ? undefined : o(k, v); }""")   # the page's own save on unload must not overwrite the injected v7 save
    pg.reload(); pg.wait_for_timeout(600); pg.click('[data-c=cont]'); pg.wait_for_timeout(900)
    st = pg.evaluate(STATE)
    check(st['base'] == {'str': 60, 'dex': 60, 'int': 30} and st['locks'] == {'str': 'raise', 'dex': 'raise', 'int': 'raise'}, 'legacy 150-point character keeps 60/60/30; locks Raise', st)
    check(st['gold'] == 500 and st['skills'] == 1420, 'no gold deducted or refunded, skills kept', (st['gold'], st['skills']))
    check(st['max'][0] == 60 and st['hp'] == 60, 'Health now equals Strength; 90 HP clamps to 60 (no refill above)', (st['max'], st['hp']))
    check(pg.evaluate("!!localStorage.getItem('shardfall.save.v1.prev7')") and pg.evaluate("JSON.parse(localStorage.getItem('shardfall.save.v1')).v") == 8, 'v7 snapshot kept once; save now v8')
    check(pg.evaluate("__SF.LOG.some(l => /Attributes now follow the Second Age/.test(l.t))"), 'the player is told once what changed')
    pg.evaluate("__SF.save()"); pg.reload(); pg.wait_for_timeout(600); pg.click('[data-c=cont]'); pg.wait_for_timeout(900)
    check(pg.evaluate(STATE)['base'] == {'str': 60, 'dex': 60, 'int': 30} and not pg.evaluate("__SF.LOG.some(l => /Attributes now follow the Second Age/.test(l.t))"), 'idempotent: the next load changes nothing and says nothing')
    # malformed attributes are repaired, never crash
    pg.evaluate("""() => { const s = JSON.parse(localStorage.getItem('shardfall.save.v1')); s.v = 7; delete s.char.base; delete s.char.statMig; s.char.str = 140; s.char.dex = 'x'; s.char.int = 99; localStorage.setItem('shardfall.save.v1', JSON.stringify(s)); const o = localStorage.setItem.bind(localStorage); localStorage.setItem = (k, v) => k === 'shardfall.save.v1' ? undefined : o(k, v); }""")
    pg.reload(); pg.wait_for_timeout(600); pg.click('[data-c=cont]'); pg.wait_for_timeout(900)
    st = pg.evaluate(STATE); check(st['base'] == {'str': 100, 'dex': 10, 'int': 99}, 'malformed save repaired deterministically (140 → 100, "x" → 10)', st['base'])
    check(not errs, 'no page errors (migration)', errs)
    pg.close()

    # ---------- phone ----------
    pg = b.new_page(viewport={'width': 844, 'height': 390}, is_mobile=True, has_touch=True); errs = []; fresh(pg, errs)
    pg.tap('[data-c=prof][data-p="Archer scout"]'); pg.wait_for_timeout(100)
    check(pg.evaluate(CCVALS) == [25, 45, 10], 'phone: preset by tap')
    bx = pg.locator('#cc [data-c=st][data-i="0"][data-d="-1"]').bounding_box()
    check(bx['width'] >= 44 and bx['height'] >= 44, 'phone: creation controls at least 44 px', bx)
    pg.fill('#ccn', 'Pip'); pg.tap('[data-c=go]'); pg.wait_for_timeout(900)
    pg.evaluate("__SF.ACT.gear()"); pg.wait_for_timeout(150)
    bx = pg.locator('#panel .attrs [data-a=slock][data-k=dex]').bounding_box()
    check(bx['width'] >= 44 and bx['height'] >= 44, 'phone: lock buttons at least 44 px', bx)
    pg.tap('#panel .attrs [data-a=slock][data-k=dex]'); pg.wait_for_timeout(100)
    check(pg.evaluate("__SF.P.statState.locks.dex") == 'hold', 'phone: tap cycles the lock')
    sc = pg.evaluate("document.querySelector('#panel .pb').scrollTop = 40, document.querySelector('#panel .pb').scrollTop")
    pg.tap('#panel .attrs [data-a=slock][data-k=dex]'); pg.wait_for_timeout(100)
    check(pg.evaluate("document.querySelector('#panel .pb').scrollTop") == sc, 'the panel keeps its scroll position when a lock changes')
    check(not errs, 'no page errors (phone)', errs)
    pg.close()
    b.close()
print('ALL PASS' if not fails else f'{len(fails)} FAILED'); sys.exit(1 if fails else 0)
