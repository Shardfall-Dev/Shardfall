"""Browser smoke test for the sound integration (headless Chrome via Playwright).
Usage: python3 tests/sfx-smoke/run.py "$PWD/Shardfall_v0.18.html"   (needs: pip install playwright; a Chrome at /usr/bin/google-chrome)
The offline build (…_offline.html, sounds embedded) runs from disk with the network off. The web build loads its
sounds from assets/audio/web/, so it is served from the file's folder on a local port instead, as GitHub Pages would."""
import functools, http.server, json, os, sys, threading
from playwright.sync_api import sync_playwright

_path = os.path.abspath(sys.argv[1])
with open(_path, encoding='utf-8') as _f: OFFLINE = 'var SFX_DATA' in _f.read()
if OFFLINE: HTML = 'file://' + _path
else:
    class _Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    _h = functools.partial(_Quiet, directory=os.path.dirname(_path))
    _srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), _h); threading.Thread(target=_srv.serve_forever, daemon=True).start()
    HTML = 'http://127.0.0.1:%d/%s' % (_srv.server_address[1], os.path.basename(_path))
RESULTS = []
def check(name, ok, detail=''):
    RESULTS.append((name, bool(ok))); print(('PASS ' if ok else 'FAIL ') + name + (('  ' + json.dumps(detail, default=str)[:400]) if detail != '' else ''), flush=True)

HOOK = """(() => { if (window.__played) return; window.__played = []; window.__tries = [];
const orig = SFXA.play.bind(SFXA);
SFXA.play = (ev, o) => { const r = orig(ev, o); window.__tries.push(ev); if (r) window.__played.push(ev); return r; }; })()"""
J = lambda page, js, arg=None: page.evaluate(js, arg) if arg is not None else page.evaluate(js)
def played(page): return J(page, "window.__played.slice()")
def clear(page): J(page, "window.__played.length = 0; window.__tries.length = 0")
def stick(page, jx, jy, ms):
    J(page, "([x, y]) => { const J = __SF.JOY; J.on = true; J.x0 = 0; J.y0 = 0; J.x = x; J.y = y; }", [jx, jy]); page.wait_for_timeout(ms)
    J(page, "(() => { __SF.JOY.on = false; })()"); page.wait_for_timeout(60)
# stick vectors that move along one world axis (screen x = (wx - wy) * 32, y = (wx + wy) * 16)
PLUS_Y, MINUS_Y, PLUS_X = (-80, 40), (80, -40), (80, 40)
def tp(page, x, y): J(page, "([x, y]) => { const P = __SF.P; P.x = x; P.y = y; P.sel = null; P.armed = false; P.task = null; }", [x, y])

# fixture: the timings below were tuned on the old 150-point profile (55 / 45 / 50); v0.30 characters start at 65 points,
# so swing and cast timing would differ. The sound checks are about which cue plays, not about attributes.
OLDSTATS = "(() => { const P = __SF.P; Object.assign(P.base, { str: 55, dex: 45, int: 50 }); P.str = 55; P.dex = 45; P.int = 50; P.stam = 45; P.mana = 50; P.hp = __SF.SF.maxHp(P); })()"
def create(page, name, keyboard=False):
    # the real creator (v0.30): title → New character → name → Next ×3 → Begin; by keyboard or by mouse
    page.goto(HTML); page.wait_for_selector('[data-c=new]')
    if keyboard:
        page.focus('[data-c=new]'); page.keyboard.press('Enter'); page.wait_for_selector('#ccn'); page.focus('#ccn'); page.keyboard.type(name); page.keyboard.press('Enter')
        for _ in range(2): page.wait_for_selector('[data-c=next]'); page.focus('[data-c=next]'); page.keyboard.press('Enter')
        if page.locator('[data-c=replace]').count(): page.focus('[data-c=replace]'); page.keyboard.press('Space')
        page.wait_for_selector('[data-c=go]:not([disabled])'); page.focus('[data-c=go]'); page.keyboard.press('Enter')
    else:
        page.click('[data-c=new]'); page.fill('#ccn', name)
        for _ in range(3): page.click('[data-c=next]')
        if page.locator('[data-c=replace]').count(): page.check('[data-c=replace]')
        page.click('[data-c=go]')
    page.wait_for_function('window.__SF && __SF.P'); J(page, HOOK); J(page, OLDSTATS)

with sync_playwright() as pw:
    br = pw.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--mute-audio'])

    # ---------- mobile: first gesture is a HUD tap ----------
    ctx = br.new_context(viewport={'width': 844, 'height': 390}, has_touch=True, is_mobile=True, device_scale_factor=2); ctx.set_offline(OFFLINE)
    page = ctx.new_page(); errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
    page.goto(HTML); page.wait_for_selector('[data-c=new]')
    st0 = J(page, "SFXA.ctx ? SFXA.ctx.state : 'none'")
    J(page, "__CC.quick({ name: 'Mobi' })")             # no gesture yet: the first touch is the HUD tap below
    page.wait_for_function('window.__SF && __SF.P'); J(page, HOOK); J(page, OLDSTATS)
    if J(page, "!document.querySelector('#rot').hidden"): J(page, "document.querySelector('#rot').hidden = true")
    page.tap('#b-run'); page.wait_for_timeout(1200)
    st = J(page, "SFXA.ctx && SFXA.ctx.state")
    check('mobile: audio starts from a HUD tap', st == 'running', f'{st0} -> {st}')
    check('unlock warms one take each of steps, weapons, doors, rat, skeleton', J(page, "SFXA.stats.decoded") >= 18, J(page, "SFXA.stats"))
    check('no page errors on mobile', not errs, errs[:3]); ctx.close()

    # ---------- desktop, keyboard-only ----------
    ctx = br.new_context(viewport={'width': 1280, 'height': 720}); ctx.set_offline(OFFLINE)
    page = ctx.new_page(); errs = []; page.on('pageerror', lambda e: errs.append(str(e)))
    create(page, 'Keya', keyboard=True); page.wait_for_timeout(300)
    check('keyboard-only startup unlocks audio', J(page, "SFXA.ctx && SFXA.ctx.state") == 'running', J(page, "SFXA.ctx && SFXA.ctx.state"))
    page.wait_for_timeout(600)

    # ---------- doors ----------
    door = J(page, """(() => { const S = __SF, b = S.BUILD.find(b => b.role === 'smith'), d = S.DOORS.find(d => d.x > b.x && d.x < b.x + b.w && (d.y === b.y || d.y === b.y + b.h)); return { x: d.x, y: d.y, n: S.DOORS.filter(d => d.x < 600 && d.y < 600).length, open: d.open, id: d.leaf.id }; })()""")
    D = "__SF.DOORS.find(d => d.x === %d && d.y === %d)" % (door['x'], door['y'])
    check('six kit doors registered at the Quay, open by default', door['n'] == 6 and door['open'] and door['id'] == 'door_open_left_x', door)
    tp(page, door['x'] + .5, door['y'] + 1.1); page.wait_for_timeout(100); clear(page)
    page.keyboard.press('e'); page.keyboard.press('e'); page.wait_for_timeout(150)
    s1 = J(page, f"[{D}.open, {D}.leaf.id]")
    check('keyboard E closes once; the immediate repeat is debounced', s1 == [False, 'door_closed_x'] and played(page) == ['door.wood.close'], [s1, played(page)])
    page.wait_for_timeout(500); clear(page); page.click('#b-int'); page.wait_for_timeout(150)
    check('HUD Interact reopens with door.wood.open and the original open sprite', J(page, f"[{D}.open, {D}.leaf.id]") == [True, 'door_open_left_x'] and [e for e in played(page) if not e.startswith('world.')] == ['door.wood.open'], played(page))
    page.wait_for_timeout(500); clear(page)
    tap = J(page, f"(() => {{ const d = {D}, C = __SF.CAM; const wx = (d.x + .5 - d.y) * 32, wy = (d.x + .5 + d.y) * 16 - 30; return [(wx - C.x) / C.f, (wy - C.y) / C.f]; }})()")
    page.mouse.click(tap[0], tap[1]); page.wait_for_timeout(550); page.mouse.click(tap[0], tap[1]); page.wait_for_timeout(150)
    check('touch/click on the leaf: second close and open, one cue each', played(page) == ['door.wood.close', 'door.wood.open'], played(page))
    # walk through the open doorway
    tp(page, door['x'] + .5, door['y'] + 1.4); page.wait_for_timeout(100); clear(page)
    stick(page, *MINUS_Y, 600); y1 = J(page, "__SF.P.y"); pl = played(page)
    check('walking through the open doorway: steps only, no door sound', y1 < door['y'] - .4 and pl and all(e.startswith('step.') for e in pl), [round(y1, 2), pl])
    # close behind, walk back into it
    tp(page, door['x'] + .5, door['y'] - .9); page.wait_for_timeout(500); page.keyboard.press('e'); page.wait_for_timeout(500)
    tp(page, door['x'] + .5, door['y'] - 1.3); clear(page)
    stick(page, *PLUS_Y, 900); yb = J(page, "__SF.P.y")
    check('the closed leaf stops the player', yb < door['y'] - .2 and J(page, f"!{D}.open"), round(yb, 3))
    page.keyboard.press('e'); page.wait_for_timeout(500)
    tp(page, door['x'] + .5, door['y']); clear(page); page.keyboard.press('e'); page.wait_for_timeout(150)
    check('refuses to close on an actor in the doorway', J(page, f"{D}.open") and not [e for e in played(page) if not e.startswith('world.')], played(page))   # random ambience may land here
    tp(page, door['x'] + .5, door['y'] + 1.1); page.wait_for_timeout(500); page.keyboard.press('e'); page.wait_for_timeout(100); J(page, "__SF.save()")
    saved = J(page, "JSON.parse(localStorage.getItem('shardfall.save.v1')).char.cx.doors")
    check('door state stored by location in the save', saved == {f"{door['x']},{door['y']}": 0}, saved)
    # door next to a vendor: the vendor stands inside; from the doorstep outside the door wins, beside the vendor the vendor wins
    npc = J(page, "(() => { const n = __SF.ents.find(e => e.role === 'provisioner'); return [n.x, n.y]; })()")
    tp(page, npc[0], npc[1] + .7); J(page, "__SF.P.sel = null"); page.wait_for_timeout(500); clear(page); page.keyboard.press('e'); page.wait_for_timeout(150)
    check('beside the vendor, Interact talks instead of toggling the door', J(page, "__SF.PANEL") == 'shop' and not [e for e in played(page) if e.startswith('door')], [J(page, "__SF.PANEL"), played(page)])
    page.keyboard.press('Escape'); page.wait_for_timeout(100)
    tp(page, door['x'] + .5, door['y'] + 1.1); page.wait_for_timeout(500); page.keyboard.press('e'); page.wait_for_timeout(100)   # leave it open

    # ---------- footsteps: pier -> quay stone -> dirt, then a wall ----------
    surf = J(page, "(() => { const S = __SF; return [S.surfaceStep(45.5, 288.5), S.surfaceStep(92.5, 300.5), S.surfaceStep(110.5, 314.5), S.surfaceStep(75.5, 290.5), S.surfaceStep(67.5, 271.5), S.surfaceStep(81.5, 325.5)]; })()")
    check('surfaces: boardwalk wood, cobble stone, ring dirt, grass, flagstone floor, timber floor', surf == ['step.wood', 'step.stone', 'step.dirt', 'step.grass', 'step.stone', 'step.wood'], surf)
    tp(page, 52.5, 288.5); page.wait_for_timeout(200); clear(page)
    stick(page, *PLUS_X, 2200); x2 = J(page, "__SF.P.x"); pl = played(page)
    order = [e for i, e in enumerate(pl) if i == 0 or pl[i - 1] != e]
    check('walking off the timber pier onto stone changes the footstep', order[:2] == ['step.wood', 'step.stone'] or order[:1] == ['step.wood'] and 'step.stone' in order, [round(x2, 1), order, len(pl)])
    tp(page, 108.5, 314.5); page.wait_for_timeout(200); clear(page); stick(page, *PLUS_X, 500)
    check('…and on the dirt ring', 'step.dirt' in played(page), played(page))
    n_moves = J(page, "(() => { const P = __SF.P; return [P.x, P.y]; })()")
    tp(page, door['x'] + 2.5, door['y'] + .5); page.wait_for_timeout(200); stick(page, *MINUS_Y, 500); clear(page)
    p0 = J(page, "[__SF.P.x, __SF.P.y]"); stick(page, *MINUS_Y, 900); p1 = J(page, "[__SF.P.x, __SF.P.y]")
    check('holding against a wall: no footsteps', abs(p1[1] - p0[1]) < .05 and not played(page), [p0, p1, played(page)])
    clear(page); page.wait_for_timeout(700)
    check('standing idle: no footsteps', not [e for e in played(page) if e.startswith('step')], played(page))

    # ---------- combat ----------
    J(page, """(() => { const S = __SF, P = S.P, SF = S.SF; P.equip.weapon = SF.newItem('sword', 1); P.skills.swordsmanship.v = 1000; P.skills.tactics.v = 1000; P.drawn = false; P.hp = 999; P.dex = 100; P.stam = 100; })()""")
    def purge(*keep): J(page, "ks => { for (const e of __SF.ents) if (e.kind === 'mon' && !ks.includes(e.id)) e.gone = true; for (let i = __SF.ents.length - 1; i >= 0; i--) if (__SF.ents[i].gone) __SF.ents.splice(i, 1); }", list(keep))
    def spawn(t, x, y, extra=''):
        return J(page, f"""(() => {{ const S = __SF, d = S.MON['{t}']; const m = S.addEnt({{ kind: 'mon', type: '{t}', name: d.n, x: {x}, y: {y}, hp: d.hp, max: d.hp, state: 'idle', home: {{ x: {x}, y: {y} }}, sect: 0, ward: 0, purse: 0 }}); {extra}; return m.id; }})()""")
    # wilderness west of the gate so creatures aggro
    J(page, "(() => { for (const e of __SF.ents) if (e.kind === 'mon') e.gone = true; for (let i = __SF.ents.length - 1; i >= 0; i--) if (__SF.ents[i].gone) __SF.ents.splice(i, 1); })()")
    tp(page, 300.5, 296.5); page.wait_for_timeout(300)
    purge(); clear(page); J(page, "__SF.setRng(() => .999)"); rid = spawn('rat', 301.5, 296.5, "m.rooted = __SF.GT + 999")   # misses from the start: the whiff below must hear no impact
    page.wait_for_timeout(1200)
    J(page, "__SF.setRng(() => .999); __SF.P.skills.swordsmanship.v = 500")   # T2A hit chance caps at 100 %: at 100.0 vs a rat every swing lands, so whiff at 50.0
    R = f"__SF.ents.find(e => e.id === {rid})"
    J(page, f"(() => {{ __SF.P.sel = {R}; __SF.toggleArm(); }})()"); page.wait_for_timeout(900); J(page, "__SF.P.armed = false")
    pl = played(page)
    check('rat alerts on aggro', 'rat.alert' in pl, pl)
    # the rooted rat may still strike the player in this window: its blow plays hit.* with player.hurt, which is not an impact of our swing
    check('a whiff: draw, then the swing alone (no impact)', 'weapon.draw' in pl and 'swing.sword' in pl and len([e for e in pl if e.startswith('hit.')]) <= pl.count('player.hurt'), pl)
    tele = J(page, "window.__tries.filter(e => /attack|warn/.test(e))")
    check('rat telegraph plays its attack cue (distinct from the strike)', 'rat.attack' in pl, tele)
    J(page, "__SF.setRng(() => 0); __SF.P.skills.swordsmanship.v = 1000"); page.wait_for_timeout(1500); clear(page)
    J(page, f"(() => {{ const m = {R}; m.hp = 1; __SF.P.sel = m; __SF.toggleArm(); }})()"); page.wait_for_timeout(1000); J(page, "__SF.P.armed = false")
    pl = played(page)
    check('killing a rat: swing, flesh impact, species death', 'swing.sword' in pl and 'hit.flesh' in pl and 'rat.death' in pl and 'hit.bone' not in pl, pl)
    # loot that rat
    clear(page); J(page, "(() => { const c = __SF.ents.find(e => e.kind === 'corpse' && e.mon === 'rat'); __SF.P.x = c.x + .5; __SF.P.y = c.y; __SF.openCorpse(c); })()"); page.wait_for_timeout(700)
    J(page, "__SF.ACT.takeall()"); page.wait_for_timeout(150)
    pl = played(page)
    check('opening the corpse rummages; Take All gives one coin cue', pl.count('loot.rummage') == 1 and pl.count('loot.coin') == 1, pl)
    J(page, "__SF.ACT.close()")
    # skeleton
    purge(); sid = spawn('skeleton', 301.6, 296.5, "m.rooted = __SF.GT + 999; m.pacified = __SF.GT + 999"); S_ = f"__SF.ents.find(e => e.id === {sid})"
    tp(page, 300.5, 296.5); page.wait_for_timeout(300); clear(page)
    J(page, f"(() => {{ const m = {S_}; m.hp = 1; __SF.P.sel = m; __SF.toggleArm(); }})()"); purge(sid); page.wait_for_timeout(1000); J(page, "__SF.P.armed = false")
    pl = played(page)
    check('striking a skeleton: hit.bone and skeleton.death (not flesh)', 'hit.bone' in pl and 'skeleton.death' in pl and 'hit.flesh' not in pl, pl)
    # ranged
    purge(); bid = spawn('boar', 306.5, 296.5, "m.rooted = __SF.GT + 999; m.pacified = __SF.GT + 999"); clear(page)
    J(page, f"""(() => {{ const S = __SF, P = S.P, SF = S.SF; P.equip.weapon = SF.newItem('shortbow', 1); SF.addItem(P.pack, SF.newItem('arrow', 20)); P.skills.archery.v = 1000; P.drawn = false; S.weaponChanged(); P.sw.ready = true; P.movedAt = -99; const m = S.ents.find(e => e.id === {bid}); m.hp = 999; P.sel = m; S.toggleArm(); }})()""")   # T2A archery: a ready swing, standing still, the arrow lands 1 s after release
    page.wait_for_timeout(1750); J(page, "__SF.P.armed = false"); page.wait_for_timeout(300)
    pl = played(page)
    check('shooting from range: bow.release at the shot, flesh impact on arrival', 'bow.release' in pl and 'hit.flesh' in pl and pl.index('bow.release') < pl.index('hit.flesh') and not [e for e in pl if e.startswith('swing')], pl)
    # spell kill
    J(page, f"""(() => {{ const S = __SF, P = S.P, SF = S.SF, MG = SF.MAGERY; P.skills.magery.v = 1000; P.skills.evaluatingintelligence.v = 1000; P.mana = 999; if (!SF.count(P.pack, 'spellbook')) SF.addItem(P.pack, SF.newItem('spellbook', 1)); SF.addItem(P.pack, SF.newItem('scroll.18', 1)); MG.learn(P.pack, 'scroll.18'); for (const r of SF.SPELL['magery.18'].regs) SF.addItem(P.pack, SF.newItem(r, 30)); const m = S.ents.find(e => e.id === {bid}); m.hp = 2; m.pacified = S.GT + 999; m.state = 'idle'; m.target = null; P.sel = m; P.spellReadyAt = 0; }})()"""); purge(bid)
    clear(page); J(page, "__SF.castSlot('magery.18')"); page.wait_for_timeout(2600)
    held = J(page, "!!__SF.P.held"); pl1 = [e for e in played(page) if e.startswith('magic.')]
    J(page, "__SF.castSlot('magery.18')"); page.wait_for_timeout(1500); pl = [e for e in played(page) if e.startswith('magic.') or e.startswith('hit.')]
    check('cast (Cinderball): quiet while preparing, magic.prepare on reaching held', held and pl1 == ['magic.prepare'], pl1)
    check('release launches (magic.release) and the fire lands on the target', 'magic.release' in pl and 'magic.fire' in pl and pl.index('magic.release') < pl.index('magic.fire') and 'hit.flesh' not in pl[len(pl1):], pl)
    b2 = spawn('boar', 306.5, 296.5, "m.rooted = __SF.GT + 999; m.pacified = __SF.GT + 999"); purge(b2); clear(page); J(page, "(() => { __SF.P.spellReadyAt = 0; __SF.castSlot('magery.18'); })()"); page.wait_for_timeout(300); J(page, "__SF.ACT.cancel()"); page.wait_for_timeout(2500)
    pl = played(page)
    check('cancelled cast: one fizzle, no prepare or effect', pl == ['magic.fizzle'], pl)
    # poison tick is not a blow
    clear(page); J(page, "(() => { const P = __SF.P; P.hp = 999; P.poison = { tier: 1, ticks: 2, next: __SF.GT }; })()"); page.wait_for_timeout(1500)
    pl = played(page)
    check('poison ticks: no impact sound', not [e for e in pl if e.startswith('hit.')], pl)
    # player death and revive
    clear(page); J(page, "(() => { __SF.P.hp = 1; __SF.damagePlayer(5, null, 'phys'); })()"); page.wait_for_timeout(200)
    pl = played(page)
    check('lethal blow: player.death instead of player.hurt', 'player.death' in pl and 'player.hurt' not in pl, pl)
    clear(page); J(page, "(() => { const S = __SF, s = S.SHRINES[0]; S.P.x = s.x + .5; S.P.y = s.y + 1.5; })()"); page.wait_for_timeout(300); clear(page); page.keyboard.press('e'); page.wait_for_timeout(200)
    check('resurrection plays player.revive', 'player.revive' in played(page), played(page))

    # ---------- gathering and crafting ----------
    J(page, "(() => { const S = __SF, P = S.P, SF = S.SF; P.hp = 999; SF.addItem(P.pack, SF.newItem('pickaxe', 1)); P.skills.mining.v = 1000; P.skills.blacksmithy.v = 1000; })()")
    rock = J(page, "__SF.QUAY_ROCKS[0]"); tp(page, rock[0] + .5, rock[1] + 1.4); page.wait_for_timeout(200); clear(page)
    J(page, f"(() => {{ const S = __SF; S.startGather(S.nodeAt({rock[0]}, {rock[1]})); }})()"); page.wait_for_timeout(300)
    stick(page, *PLUS_X, 300); page.wait_for_timeout(2500)
    check('interrupted gather: no work cue', not [e for e in played(page) if e.startswith('gather')], played(page))
    tp(page, rock[0] + .5, rock[1] + 1.4); page.wait_for_timeout(200); clear(page)
    J(page, f"(() => {{ const S = __SF, n = S.nodeAt({rock[0]}, {rock[1]}); S.P.sel = n; S.startGather(n); }})()"); page.wait_for_timeout(3500); J(page, "__SF.P.sel = null; __SF.P.task = null")
    check('a finished stroke at a rock: gather.mine', 'gather.mine' in played(page), played(page))
    fg = J(page, "(() => { const s = __SF.STATIONS.find(s => s.k === 'forge'); return [s.x, s.y]; })()")
    tp(page, fg[0] + .5, fg[1] + 1.5); J(page, "(() => { const S = __SF; S.SF.addItem(S.P.pack, S.SF.newItem('ore', 30)); S.setRng(() => 0); })()"); page.wait_for_timeout(200); clear(page)
    J(page, "__SF.startCraft('ironbar', 1)"); page.wait_for_timeout(3500)
    pl = played(page)
    check('successful smelt: craft.smelt', 'craft.smelt' in pl and 'craft.fail' not in pl, pl)
    clear(page); J(page, "(() => { __SF.setRng(() => .999); __SF.startCraft('ironbar', 1); })()"); page.wait_for_timeout(3500)
    pl = played(page)
    check('failed attempt: craft.fail only', 'craft.fail' in pl and 'craft.smelt' not in pl and not [e for e in pl if e.startswith('craft') and e != 'craft.fail'], pl)
    J(page, "__SF.setRng(null)")

    # ---------- starter quest ----------
    clear(page); J(page, "(() => { const S = __SF; S.Q.beacon = 0; S.ACT.qaccept(); S.Q.beacon = 2; S.ACT.qturn(); })()"); page.wait_for_timeout(200)
    check('starter quest: accept and reward cues on the stage changes', [e for e in played(page) if not e.startswith('world.')] == ['quest.accept', 'quest.complete'], played(page))   # random ambience may fall in the window

    # ---------- concurrency, concealment, zone change ----------
    clear(page); J(page, "(() => { for (let i = 0; i < 30; i++) SFXA.play('hit.flesh', { key: 'x' + i }); })()"); vs = J(page, "SFXA.stats.voices")
    check('never more than 14 voices', vs <= 14, vs)
    page.wait_for_timeout(600)
    hid = J(page, """(() => { const S = __SF, P = S.P; const m = S.addEnt({ kind: 'mon', type: 'smuggler', name: 'x', x: P.x + 2, y: P.y, hp: 9, max: 9, state: 'idle', home: { x: P.x + 2, y: P.y }, sect: 0, hidden: true }); const r = SFXA.play('combat.warn', { pos: m, ent: m }); m.gone = true; return r === null; })()""")
    far = J(page, "(() => { const P = __SF.P; return SFXA.play('hit.flesh', { pos: { x: P.x + 25, y: P.y } }) === null && SFXA.play('combat.blast', { pos: { x: P.x + 25, y: P.y } }) !== null; })()")
    check('hidden foes are silent; interaction range 18, large impacts 28', hid and far, [hid, far])
    J(page, "(() => { const P = __SF.P; SFXA.play('chest.open', { pos: { x: P.x, y: P.y }, delay: 2 }); })()"); before = J(page, "SFXA.stats.pending")
    tp(page, 300.5, 296.5); page.wait_for_timeout(300)
    check('zone change cancels pending sounds', before >= 1 and J(page, "SFXA.stats.pending") == 0, [before, J(page, "SFXA.stats.pending")])
    clear(page); J(page, "(() => { const S = __SF, P = S.P; P.x = 40.5; P.y = 300.5; })()"); page.wait_for_timeout(300)
    J(page, "(() => { for (let i = 0; i < 40; i++) __SF.update(1); })()"); amb = [e for e in played(page) if e.startswith('world.')]
    check('quayside ambience: sparse surf and gulls', amb and set(amb) <= {'world.surf', 'world.gull'}, amb)

    # ---------- mute, background ----------
    clear(page); J(page, "__SF.ACT.mute()"); page.wait_for_timeout(250)
    m1 = J(page, "[SFXA.muted, JSON.parse(localStorage.getItem('shardfall.settings')).muted, SFXA.play('ui.open') === null, SFXA.stats.voices]")
    check('mute: persisted, silent, voices stopped', m1 == [True, True, True, 0], m1)
    J(page, "__SF.ACT.mute()"); page.wait_for_timeout(100)
    check('unmute plays again', J(page, "SFXA.play('ui.open') !== null"))
    J(page, "(() => { const P = __SF.P; SFXA.play('chest.open', { pos: { x: P.x, y: P.y }, delay: 2 }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); })()")
    page.wait_for_timeout(300); bg = J(page, "[SFXA.ctx.state, SFXA.stats.pending, SFXA.play('ui.open') === null]")
    J(page, "(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); })()")
    page.wait_for_timeout(400); page.mouse.click(5, 5); page.wait_for_timeout(300); fgs = J(page, "SFXA.ctx.state")
    check('backgrounding suspends and drops pending; foreground resumes', bg == ['suspended', 0, True] and fgs == 'running', [bg, fgs])
    # ---------- music: one track per area, crossfaded, can be switched off ----------
    if OFFLINE:   # the offline file has no soundtrack to fetch: it must stay quiet without errors
        page.wait_for_timeout(1500); check('offline build: no music, no errors', J(page, "SFXA.musicNow") is None)
    else:
        tp(page, 92.5, 304.5); page.wait_for_function("SFXA.musicNow === '01-saltmarsh-home'", timeout=15000)
        check('music: the Quay plays Saltmarsh Home', J(page, "SFXA.musicNow") == '01-saltmarsh-home')
        far = J(page, """(() => { const S = __SF; for (let y = 120; y < 480; y += 4) for (let x = 380; x < 500; x += 4) if (S.zoneAt(x, y) === 'ashfen' && !S.blockedAt?.(x + .5, y + .5)) return [x + .5, y + .5]; return null; })()""")
        tp(page, far[0], far[1]); page.wait_for_timeout(1500)
        held = J(page, "SFXA.musicNow")
        page.wait_for_function("SFXA.musicNow === '03-mist-on-the-causeway'", timeout=15000)
        check('music: the marsh switches to Mist on the Causeway after a short stay', held == '01-saltmarsh-home', held)
        J(page, "__SF.ACT.music()"); page.wait_for_timeout(200)
        check('music: menu toggle turns it off and remembers', J(page, "[SFXA.musicNow, JSON.parse(localStorage.getItem('shardfall.settings')).music]") == [None, False])
        J(page, "__SF.ACT.music()"); page.wait_for_function("SFXA.musicNow === '03-mist-on-the-causeway'", timeout=15000)
    check('no page errors on desktop', not errs, errs[:3])

    # ---------- older save without door state ----------
    J(page, "__SF.save()"); raw = J(page, "localStorage.getItem('shardfall.save.v1')")
    old = json.loads(raw); old['char']['cx'].pop('doors', None); old['char']['cx'].pop('mark', None)
    J(page, "s => localStorage.setItem('shardfall.save.v1', s)", json.dumps(old))
    page2 = ctx.new_page(); errs2 = []; page2.on('pageerror', lambda e: errs2.append(str(e)))
    page2.goto(HTML); page2.wait_for_selector('[data-c=cont]'); page2.click('[data-c=cont]'); page2.wait_for_function('window.__SF && __SF.P')
    check('older save without door state loads; every door open', J(page2, "__SF.DOORS.every(d => d.open)") and not errs2, errs2[:3])
    ctx.close(); br.close()
print(json.dumps({'pass': sum(r[1] for r in RESULTS), 'fail': sum(not r[1] for r in RESULTS)}))
sys.exit(1 if any(not r[1] for r in RESULTS) else 0)
