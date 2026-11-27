import sys, json
from playwright.sync_api import sync_playwright
f = sys.argv[1]; errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=(sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'), args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1280, 'height': 720})
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto('file://' + f); pg.wait_for_timeout(600); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(600)
    pg.click('[data-c=prof][data-p="Group healer"]'); pg.fill('#ccn', 'Old'); pg.click('[data-c=go]'); pg.wait_for_timeout(800)
    pg.evaluate("""() => { const s = JSON.parse(localStorage.getItem('shardfall.save.v1')); const c = s.char;
      c.pack.items = c.pack.items.filter(i => !['spellbook','rune','black_pearl','blood_moss','garlic','ginseng','mandrake_root','nightshade','spider_silk','sulfurous_ash'].includes(i.id));
      c.pack.items.push({ uid: 9001, id: 'reedash', qty: 12 }); delete c.magery; s.v = 7; delete c.t2aMig; delete c.skills.magery; c.skills.spellcraft = { v: 450, lock: 'raise' };
      c.hotbar = [{ k: 'item', id: 'bandage' }, { k: 'spell', id: 'mend' }, { k: 'spell', id: 'curtain' }, { k: 'spell', id: 'cinderseal' }, null, null, null, null, null];
      localStorage.setItem('shardfall.save.v1', JSON.stringify(s)); localStorage.removeItem('shardfall.save.v1.premagery'); Storage.prototype.setItem = function () {}; }""")
    pg.reload(); pg.wait_for_timeout(800); pg.click('[data-c=cont]'); pg.wait_for_timeout(800)
    r1 = pg.evaluate("""() => { const S = __SF, P = S.P; return { hot: P.hotbar.slice(0,4).map(h => h && h.id), book: P.pack.items.filter(i => i.id === 'spellbook').map(i => i.spells), backup: !!localStorage.getItem('shardfall.save.v1.premagery'), reedash: S.SF.count(P.pack, 'reedash'), labels: [...document.querySelectorAll('.slot b')].map(b => b.textContent) }; }""")
    pg.evaluate("__SF.save()"); pg.reload(); pg.wait_for_timeout(800); pg.click('[data-c=cont]'); pg.wait_for_timeout(800)
    r2 = pg.evaluate("""() => { const P = __SF.P; return { hot: P.hotbar.slice(0,4).map(h => h && h.id), books: P.pack.items.filter(i => i.id === 'spellbook').length }; }""")
    # curtain still castable from old bar
    r3 = pg.evaluate("""() => { const S = __SF, P = S.P; S.SF.addItem(P.pack, S.SF.newItem('shelldust', 5)); S.SF.addItem(P.pack, S.SF.newItem('marshroot', 5)); S.SF.addItem(P.pack, S.SF.newItem('blacksalt', 5)); P.skills.magery.v = 800; P.mana = 60; S.setRng(() => .01); S.castSlot('curtain'); for (let i = 0; i < 30; i++) S.update(.05); const held = P.held && P.held.sp.id; const ok = S.releaseHeld({ x: P.x + 2, y: P.y }); S.setRng(null); return { held, ok, log: S.LOG.slice(-3).map(l => l.t) }; }""")
    # death clears buffs
    r4 = pg.evaluate("""() => { const S = __SF, P = S.P, MG = S.SF.MAGERY; P.mg.mods = { str: { pos: { v: 5, until: S.GT + 99 } } }; P.mg.night = S.GT + 99; S.update(.05); const s1 = P.str; S.damagePlayer(9999, null, 'phys'); S.update(.05); return { buffed: s1, after: P.str, base: P.base.str, night: !!P.mg.night }; }""")
    b.close()
    ok = r1['hot'] == ['bandage', 'magery.04', 'curtain', 'magery.43'] and r1['backup'] and r1['reedash'] == 12 and 'magery.18' in r1['book'][0] and r2 == {'hot': r1['hot'], 'books': 1} and r3['ok'] and r4['after'] == r4['base'] and not r4['night'] and not errs
    print(('ok   migration: ' if ok else 'FAIL migration: ') + json.dumps([r1, r2, r3, r4]) + (' errors ' + str(errs) if errs else '')); sys.exit(0 if ok else 1)
