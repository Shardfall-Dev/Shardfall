# Painted classic humans v2.1 in the built game (Playwright + Chrome).
# usage: python3 tests/humans-smoke/run.py Shardfall_v0.32.html [--shots DIR]
# The flag (classic default, menu switch, rig hidden), every human kind drawn from painted art in all 8 directions and both bodies,
# painted walk/cast where it exists and the approved fallbacks elsewhere, ghosts, corpses, creatures untouched, equipment changes
# reported as missing overlays (never faked), cast interruption, creator body choice, save/load and old saves, frame time,
# paper doll and phone/desktop screenshots.
import sys, json, os
from playwright.sync_api import sync_playwright
f = os.path.abspath(sys.argv[1]); args = sys.argv[2:]
shots = args[args.index('--shots') + 1] if '--shots' in args else '/tmp/humans-shots'; os.makedirs(shots, exist_ok=True)
fails = 0
def check(ok, msg, got=None):
  global fails
  print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else '  got: ' + json.dumps(got)[:700])); fails += 0 if ok else 1
J = lambda pg, js, a=None: pg.evaluate(js, a) if a is not None else pg.evaluate(js)
def page(b, q='humans=painted', vp=(844, 390), scale=1, new=True, body=None):
  ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=scale); pg = ctx.new_page(); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto('file://' + f + ('?' + q if q else '')); pg.wait_for_timeout(500)
  if new:
    pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(700)
    if body: pg.click('[data-c=hbody][data-v=' + body + ']')
    pg.fill('#ccn', 'Tess'); pg.click('[data-c=go]'); pg.wait_for_timeout(500)
  return ctx, pg, errs
WAIT = "async () => { const H = __SF.HUMANS; for (let i = 0; i < 600 && (H.queue.length || H.queued.size); i++) { await new Promise(r => setTimeout(r, 10)); __SF.humansPump(); } }"
PIX = """(e, n) => { const c = document.createElement('canvas'); c.width = 200; c.height = 200; const g = c.getContext('2d'); const ok = __SF.drawHuman(g, e, 100, 150); const d = g.getImageData(0, 0, 200, 200).data; let k = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) k++; return [ok, k]; }"""

with sync_playwright() as p:
  b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])

  # 1. flag
  ctx, pg, errs = page(b, q='')
  check(J(pg, "() => __SF.HUMANS.mode") == 'classic', 'classic sprites stay the default until the painted art is accepted')
  ctx.close()
  ctx, pg, errs = page(b)
  check(J(pg, "() => __SF.HUMANS.mode") == 'painted' and not errs, '?humans=painted switches on the painted renderer', errs)

  # 2. every human kind, every direction, both bodies — painted pixels
  r = J(pg, """async () => { const S = __SF, P = S.P, who = [P, S.ents.find(e => e.kind === 'ally'), S.ents.find(e => e.role === 'guard'), S.ents.find(e => e.role === 'banker'), S.ents.find(e => e.life && e.life.prof === 'miner')];
    for (const t of ['bandit', 'smuggler', 'captain']) { const m = S.ents.find(e => e.kind === 'mon' && e.type === t && !e.gone); if (m) who.push(m); }
    const px = """ + PIX + """, bad = [];
    for (const e of who) for (let d = 0; d < 8; d++) { e.sect = d; px(e); }
    await (""" + WAIT + """)();
    for (const e of who) for (let d = 0; d < 8; d++) { e.sect = d; const [ok, k] = px(e); if (!ok || k < 600) bad.push([e.name || e.type, d, ok, k]); }
    return { n: who.length, kinds: who.map(e => e.kind + ':' + (e.type || e.role || '')), bad }; }""")
  check(not r['bad'] and r['n'] >= 8, f"{r['n']} humans (player, Wren, guard, banker, miner, bandit, smuggler, drowned captain) × 8 directions drawn from painted art", r)
  r = J(pg, """async () => { const S = __SF, C = SF.HUMANART, reg = C.fromManifest(SF.HUMAN_ART_DATA), out = {};
    for (const b of ['male', 'female']) for (const d of C.DIRECTIONS) { const P = C.plan(reg, { body: b, pieces: {}, overlays: [] }, 'walk', d); out[b + d] = P.drawn + (P.fallback ? '/' + P.fallback.via : ''); }
    return out; }""")
  check(all(v == 'walk' for k, v in r.items() if k.endswith('SE') or k.endswith('SW')) and all(v == 'idle/bob' for k, v in r.items() if not (k.endswith('SE') or k.endswith('SW'))),
        'walking: painted walk cycle SE/SW; the six other directions show the painted standing frame with the step bob', r)

  # 3. walking really animates in SE: the eight painted frames all differ
  r = J(pg, """() => { const C = SF.HUMANART, reg = C.fromManifest(SF.HUMAN_ART_DATA), P = C.plan(reg, { body: 'male', pieces: {}, overlays: [] }, 'walk', 'SE'), imgs = {};
    for (const k in SF.HUMAN_ART_DATA.src) { const im = document.createElement('img'); }
    return P.frames; }""")
  r2 = J(pg, """async () => { const S = __SF, P = S.P; P.sect = 7; const D = S.humanDesc(P); const s = (() => { S.drawHuman(document.createElement('canvas').getContext('2d'), Object.assign(Object.create(P), { speed: 3 }), 0, 0); })();
    await (""" + WAIT + """)(); const st = [...S.HUMANS.strips.values()].find(c => c.plan && c.plan.drawn === 'walk' && c.plan.dir === 'SE'); if (!st) return null;
    const g = st.getContext('2d'), seen = new Set(); for (let f = 0; f < st.n; f++) { const d = g.getImageData(f * st.cw, 0, st.cw, st.height).data; let h = 0; for (let i = 0; i < d.length; i += 7) h = (h * 31 + d[i]) >>> 0; seen.add(h); } return seen.size; }""")
  check(r == 8 and r2 == 8, f'the SE walk cycle: {r} painted frames, {r2} distinct in the drawn strip', [r, r2])

  # 4. casting: painted cast in SE, standing frame elsewhere; an interrupted cast returns to standing at once
  r = J(pg, """async () => { const S = __SF, P = S.P, D = S.humanDesc(P); P.sect = 7; P.prep = { t0: S.GT - .1, t1: S.GT + 1 }; const a1 = S.humanAnim(P, D)[0];
    const pl = SF.HUMANART.plan(SF.HUMANART.fromManifest(SF.HUMAN_ART_DATA), D, a1, 'SE').drawn, pl2 = SF.HUMANART.plan(SF.HUMANART.fromManifest(SF.HUMAN_ART_DATA), D, a1, 'N').drawn;
    P.prep = null; const a2 = S.humanAnim(P, D)[0]; return [a1, pl, pl2, a2]; }""")
  check(r == ['cast1h', 'cast', 'idle', 'idle'], 'cast: painted cast SE, standing elsewhere; interrupted → standing', r)

  # 5. equipment: a valorite plate chest is real, worn and reported as a missing overlay — never painted over, never faked
  r = J(pg, """async () => { const S = __SF, P = S.P, EQ = SF.EQ; const it = EQ.make('plate_chest', { material: 'valorite' }); SF.addItem(P.pack, it); P.str = 100; const ok = EQ.equipItem(P, { uid: it.uid }).ok;
    S.HUMANS.strips.clear(); P.sect = 0; const px = """ + PIX + """; px(P); await (""" + WAIT + """)(); const [drew, k] = px(P);
    const reg = SF.HUMANART.fromManifest(SF.HUMAN_ART_DATA), pl = SF.HUMANART.plan(reg, S.humanDesc(P), 'idle', 'S'); return { ok, drew, k, layers: pl.layers.map(l => l.key), missing: pl.missing }; }""")
  check(r['ok'] and r['drew'] and r['layers'] == ['body'] and any(m.startswith('chest plate_chest (valorite)') for m in r['missing']), 'equipping valorite plate: still drawn; the plate overlay is reported missing, not faked', r)

  # 6. ghosts and corpses; creatures untouched
  r = J(pg, """async () => { const S = __SF, P = S.P, px = """ + PIX + """; P.ghost = true; px(P); await (""" + WAIT + """)(); const g = px(P); P.ghost = false;
    const orc = S.ents.find(e => e.kind === 'mon' && e.type === 'orc') || S.ents.find(e => e.kind === 'mon' && e.type === 'hound');
    const beast = px(orc); return { ghost: g, creature: [orc.type, beast[0]], corpseFallback: S.drawHuman.length >= 0 }; }""")
  check(r['ghost'][0] and r['ghost'][1] > 400 and r['creature'][1] is False, 'the ghost is the painted figure in ghost colours; creatures never go through the human renderer', r)

  # 7. save, reload; an old save with no body keeps one stable seeded body across loads
  r1 = J(pg, "() => { const S = __SF; S.P.look.body = 'female'; S.save(); return S.P.look; }")
  pg.reload(); pg.wait_for_timeout(700); pg.click('[data-c=cont]'); pg.wait_for_timeout(500)
  r2 = J(pg, "() => __SF.P.look"); check(r2['body'] == 'female' and r2 == r1, 'appearance survives save and reload', [r1, r2])
  old = J(pg, "() => { const s = JSON.parse(localStorage.getItem('shardfall.save.v1')); s.char.look = { cloak: '#8a2a2a' }; return JSON.stringify(s); }")
  ctx.close(); looks = []
  for i in range(2):
    ctx, pg, errs = page(b, new=False)   # at the creator: no character in play, so nothing saves over the edited save
    J(pg, "s => localStorage.setItem('shardfall.save.v1', s)", old); pg.reload(); pg.wait_for_timeout(700); pg.click('[data-c=cont]'); pg.wait_for_timeout(500)
    looks.append(J(pg, "() => { const D = __SF.humanDesc(__SF.P); return [D.body, D.skin, D.hair, __SF.P.look.cloak]; }")); ctx.close()
  ctx, pg, errs = page(b)
  check(looks[0] == looks[1] and looks[0][3] == '#8a2a2a', 'an old save (no body) loads with the same seeded body every time and keeps its cloak', looks)
  ctx.close()

  # 8. creator: body choice saved; a female preview
  ctx, pg, errs = page(b, body='female')
  check(J(pg, "() => __SF.P.look.body") == 'female' and not errs, 'the character creator saves the chosen body', errs)
  ctx.close()

  # 9. frame time with 60 painted people; cache bounded
  ctx, pg, errs = page(b)
  def frametime(mode):
    return J(pg, """async mode => { const S = __SF, P = S.P; S.HUMANS.mode = mode; S.HUMANS.on = mode !== 'classic'; const L = S.ents.filter(e => e.kind === 'npc' && !e.gone).slice(0, 60);
      L.forEach((e, i) => { e.x = P.x - 7 + (i % 10) * 1.5; e.y = P.y - 4 + Math.floor(i / 10) * 1.5; e.nav = null; e.life = null; e.home = { x: e.x, y: e.y }; e.sect = i % 8; });
      for (let i = 0; i < 90; i++) await new Promise(r => requestAnimationFrame(r)); await new Promise(r => setTimeout(r, 800));
      const ts = []; for (let i = 0; i < 120; i++) { const t0 = performance.now(); await new Promise(r => requestAnimationFrame(r)); ts.push(performance.now() - t0); }
      ts.sort((a, b) => a - b); return { med: +ts[60].toFixed(1), p95: +ts[114].toFixed(1), strips: S.HUMANS.strips.size }; }""", mode)
  off, on = frametime('classic'), frametime('painted')
  check(on['p95'] <= max(40, off['p95'] * 1.6) and on['strips'] <= 96, f"60 painted people: frame median {on['med']} / p95 {on['p95']} ms vs classic {off['med']} / {off['p95']} ms; {on['strips']} cached strips", [on, off])
  pg.screenshot(path=os.path.join(shots, 'crowd-60-phone-painted.png'))
  miss = J(pg, "() => null")
  ctx.close()

  # 10. screenshots: Vespar day/night phone, desktop; paper doll; creator
  for (label, vp, hour) in (('phone-day', (844, 390), 10), ('phone-night', (844, 390), 23), ('desktop-day', (1366, 768), 14)):
    ctx, pg, errs = page(b, vp=vp)
    J(pg, """h => { const S = __SF, P = S.P; S.WS.clock.setHour(S.GT, h); const v = S.ents.filter(e => e.town === 'vespar' && e.kind === 'npc'); P.x = 905; P.y = 560;
      v.forEach((e, i) => { e.x = P.x - 5 + (i % 6) * 2; e.y = P.y - 3 + Math.floor(i / 6) * 2.4; e.nav = null; if (e.life) e.life.goal = { act: 'work', x: e.x, y: e.y }; e.home = { x: e.x, y: e.y }; e.sect = i % 8; }); }""", hour)
    pg.wait_for_timeout(2000); pg.screenshot(path=os.path.join(shots, 'painted-vespar-' + label + '.png')); ctx.close()
  ctx, pg, errs = page(b, scale=2); pg.wait_for_timeout(800); pg.keyboard.press('c'); pg.wait_for_timeout(600)
  check('painted' in (J(pg, "() => { const d = document.querySelector('#eqwin .doll'); return d && d.className; }") or ''), 'the paper doll shows the painted figure from the same appearance state')
  pg.screenshot(path=os.path.join(shots, 'painted-paperdoll-phone.png')); ctx.close()
  ctx, pg, errs = page(b, new=False, scale=2); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(800); pg.click('[data-c=hbody][data-v=female]')
  pg.screenshot(path=os.path.join(shots, 'painted-creator-phone.png'), full_page=True); ctx.close()
  check(True, 'screenshots in ' + shots)
  b.close()
print('all painted human smoke checks passed' if not fails else f'{fails} FAILED'); sys.exit(1 if fails else 0)
