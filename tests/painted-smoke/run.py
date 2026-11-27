# Browser checks for Painted Human Candidates v0.1 behind the developer flag (src/painted.js, src/painted-render.js).
# usage: python3 tests/painted-smoke/run.py Shardfall_v0.32.1.html [/path/to/chrome] [--shots DIR]
# Needs Python Playwright and Chrome. Screenshots go to $PAINTED_SHOTS or --shots (default /tmp/painted-shots).
import sys, os, json
from playwright.sync_api import sync_playwright

args = sys.argv[1:]
shots = os.environ.get('PAINTED_SHOTS', '/tmp/painted-shots')
if '--shots' in args: i = args.index('--shots'); shots = args[i + 1]; del args[i:i + 2]
f = os.path.abspath(args[0] if args else 'Shardfall_v0.32.1.html')
chrome = args[1] if len(args) > 1 else '/usr/bin/google-chrome'
os.makedirs(shots, exist_ok=True)
fails = []
def check(ok, msg, got=None):
    print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else f'  (got {json.dumps(got) if not isinstance(got, str) else got})'))
    if not ok: fails.append(msg)
J = lambda pg, js, a=None: pg.evaluate(js, a) if a is not None else pg.evaluate(js)
FRAME = "(() => { __SF.update(.05); __SF.render(); })()"
STRIP = "(() => { const S = __SF, P = S.P, SF = S.SF; for (const s of SF.EQ.SLOT_IDS) if (P.equip[s]) S.ACT.uneq({ s }); return SF.EQ.SLOT_IDS.filter(s => P.equip[s]).map(s => P.equip[s].id); })()"
WEAR = "(id) => { const S = __SF, P = S.P, SF = S.SF, EQ = SF.EQ; const it = EQ.make(id, {}); SF.addItem(P.pack, it); return EQ.equipItem(P, { uid: it.uid }).ok; }"
def frames(pg, n=6):
    for _ in range(n): J(pg, FRAME)

def start(b, query, body='male', w=1280, h=800, touch=False):
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'ERR_' not in m.text and 'Failed to load resource' not in m.text else None)
    pg.goto('file://' + f + query); pg.wait_for_timeout(300); pg.evaluate('localStorage.clear()'); pg.reload()
    pg.wait_for_selector('[data-c=new]')
    J(pg, "(b) => __CC.quick({ name: 'Tess Vane', look: __SF.SF.CREATION.defaultLook(b) })", body)
    pg.wait_for_function('window.__SF && __SF.P'); frames(pg, 3)
    return ctx, pg, errs
def player_shot(pg, name):
    xy = J(pg, "(() => { const c = document.querySelector('canvas').getBoundingClientRect(); return [c.width / 2, c.height / 2]; })()")
    pg.screenshot(path=f'{shots}/{name}', clip={'x': max(0, xy[0] - 160), 'y': max(0, xy[1] - 170), 'width': 320, 'height': 240})

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox', '--mute-audio'])

    # ---- off: no flag, and ?painted without ?dev, change nothing
    for q in ['', '?painted=strict']:
        ctx, pg, errs = start(b, q)
        J(pg, STRIP); J(pg, "__SF.P.sect = 1"); frames(pg)
        st = J(pg, "({ mode: __PAINTED.state.mode, drawn: __PAINTED.state.stats.drawn, btn: !!document.getElementById('pntb') })")
        check(st == {'mode': 'off', 'drawn': 0, 'btn': False}, f'flag off ({q or "no query"}): no painted frame drawn and no developer button', st)
        check(not errs, f'flag off ({q or "no query"}): no page errors', errs)
        ctx.close()

    # ---- strict, male: bare body draws painted where an accepted frame exists, falls back everywhere else
    ctx, pg, errs = start(b, '?dev&painted=strict')
    check(J(pg, "__PAINTED.state.mode") == 'strict', '?dev&painted=strict turns the strict mode on')
    pg.wait_for_function('__PAINTED.state.ready === 8')
    w = J(pg, "__PAINTED.why(__SF.P)")
    check(not w['ok'] and any('overlay missing' in r for r in w['reasons']), 'starter kit worn → existing renderer, reason given', w['reasons'][:2])
    left = J(pg, STRIP); check(left == [], 'all equipment removed through the real command', left)
    J(pg, "__SF.P.sect = 1; __SF.P.speed = 0"); frames(pg)
    w = J(pg, "__PAINTED.why(__SF.P)")
    check(w['ok'] and w['fr']['action'] == 'Idle' and w['fr']['row'] == 1, 'bare player facing SW, standing → painted Idle SW', w)
    d0 = J(pg, "__PAINTED.state.stats.drawn"); frames(pg); check(J(pg, "__PAINTED.state.stats.drawn") > d0, 'the painted frame is actually drawn each frame')
    player_shot(pg, 'male-idle-SW-painted.png')
    J(pg, "__SF.P.sect = 0"); frames(pg)
    w = J(pg, "__PAINTED.why(__SF.P)")
    check(not w['ok'] and 'facing S' in w['reasons'][0], 'facing S (all candidates rejected) → existing renderer, no borrowed frame', w['reasons'])
    player_shot(pg, 'male-idle-S-fallback.png')
    J(pg, "__SF.P.sect = 4"); w = J(pg, "__PAINTED.why(__SF.P)"); check(not w['ok'], 'male idle N (rejected) falls back', w['reasons'])
    # walking: the pose comes from the same clip mapping the layered renderer uses
    w = J(pg, "(() => { const P = __SF.P; P.sect = 6; P.once = null; P.prep = null; P.speed = 3; const w = __PAINTED.why(P); P.speed = 0; return w; })()")
    check(w['ok'] and w['act'] == 'walk' and w['fr']['action'] == 'Walk', 'moving player facing E → painted Walk E', w)
    w = J(pg, "(() => { const P = __SF.P; P.speed = 8; const w = __PAINTED.why(P); P.speed = 0; return w; })()")
    check(not w['ok'] and "'run'" in w['reasons'][0], 'running → existing renderer (no painted run)', w.get('reasons'))
    J(pg, "__SF.P.speed = 0")
    # equipment change takes effect on the next frame
    check(J(pg, WEAR, 'leather_tunic'), 'equip a tunic through the real command')
    frames(pg, 2); w = J(pg, "__PAINTED.why(__SF.P)")
    check(not w['ok'] and any('chest' in r for r in w['reasons']), 'with the tunic on, the player goes back to the existing renderer at once', w['reasons'])
    # NPCs use the same path; their presets carry gear, so strict keeps them on the existing renderer
    npc = J(pg, "(() => { const n = __SF.ents.filter(e => e.kind === 'npc'); return { n: n.length, painted: n.filter(e => __PAINTED.why(e).ok).length, why: n.length ? __PAINTED.why(n[0]).reasons[0] : '' }; })()")
    check(npc['n'] > 0 and npc['painted'] == 0 and 'overlay missing' in npc['why'], 'strict: NPCs in their presets go through the same rule and fall back', npc)
    # paper doll and save stay as they were
    sv = J(pg, "(() => { __SF.save(); return Object.keys(localStorage).map(k => localStorage.getItem(k)).join('').includes('painted'); })()")
    check(sv is False, 'nothing painted is written to the save')
    J(pg, STRIP); J(pg, "__SF.P.sect = 2")
    J(pg, "__SF.save()"); pg.reload(); pg.wait_for_selector('[data-c=cont]'); pg.click('[data-c=cont]'); pg.wait_for_function('window.__SF && __SF.P'); frames(pg, 4)
    check(J(pg, "__PAINTED.state.mode") == 'strict' and J(pg, "__SF.SF.EQ.SLOT_IDS.filter(s => __SF.P.equip[s]).length") == 0, 'reload: flag from the address, equipment state as saved')
    check(not errs, 'strict: no page errors', errs)
    ctx.close()

    # ---- bodies (QA) mode, female: gear ignored on purpose; NPCs drawn through the same function
    ctx, pg, errs = start(b, '?dev&painted=bodies', body='female')
    pg.wait_for_function('__PAINTED.state.ready === 8')
    J(pg, "__SF.P.sect = 7"); frames(pg)
    w = J(pg, "__PAINTED.why(__SF.P)")
    check(w['ok'] and w['body'] == 'female' and w['fr']['row'] == 7, 'bodies mode: female from character creation, SE, drawn despite the starter kit', w)
    n = J(pg, "(() => { const n = __SF.ents.filter(e => e.kind === 'npc'); n.forEach((e, i) => { e.sect = 1 + (i % 3); }); return n.filter(e => __PAINTED.why(e).ok).length; })()")
    check(n > 0, f'bodies mode: NPCs facing SW/W/NW drawn with the painted bodies ({n})')
    frames(pg); player_shot(pg, 'female-bodies-SE.png')
    # developer panel and atlas preview
    pg.click('#pntb'); pg.wait_for_timeout(100)
    check('Painted Human Candidates' in J(pg, "document.getElementById('pnts').textContent"), 'PAINTED button opens the panel')
    pg.click('[data-pa="female/Walk"]'); pg.wait_for_timeout(100)
    sz = J(pg, "(() => { const c = document.getElementById('pntcanvas'); return c ? [c.width, c.height] : null; })()")
    check(sz == [384, 1024], 'atlas preview shows the female Walk sheet at 1:1', sz)
    pg.locator('#pntcanvas').hover(position={'x': 192 * pg.locator('#pntcanvas').bounding_box()['width'] / 384, 'y': 5 * 128 + 60})
    tip = J(pg, "document.querySelector('#pnta div').textContent")
    check('NE' in tip and 'REJECTED' in tip and 'facing' in tip, 'hovering a rejected cell shows its QA reason', tip)
    pg.screenshot(path=f'{shots}/atlas-preview.png')
    pg.click('[data-pm="off"]'); frames(pg)
    check(not J(pg, "__PAINTED.why(__SF.P)")['ok'] and J(pg, "__PAINTED.state.mode") == 'off', 'the panel turns the mode off again')
    check(not errs, 'bodies: no page errors', errs)
    ctx.close()

    # ---- phone, landscape: panel fits
    ctx, pg, errs = start(b, '?dev&painted=strict', w=844, h=390, touch=True)
    pg.click('#pntb'); pg.wait_for_timeout(100)
    bb = pg.locator('#pntp').bounding_box(); check(bb['x'] >= 0 and bb['x'] + bb['width'] <= 844, 'phone: panel fits the width', bb)
    check(not errs, 'phone: no page errors', errs)
    ctx.close(); b.close()

print(f'\n{len(fails)} FAILED' if fails else '\nALL PASS'); sys.exit(1 if fails else 0)
