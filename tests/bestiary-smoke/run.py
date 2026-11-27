# Bestiary browser smoke run (needs Python Playwright + Chrome).
# usage: python3 tests/bestiary-smoke/run.py Shardfall_v0.18.html [/path/to/chrome] [screenshot-dir]
# Checks, in the built single-file game: all sheets decode at 800x1280, cells draw pixel-exact (Lich Lord rim intact),
# the attack row matches each of the eight approach directions, and live chase → wind-up → impact → recover poses.
# Covers the merged set: v1.0.0 (11 sheets, read from its ZIP) and v1.1.0 draft01 (6 sheets in assets/bestiary/v1.1.0/).
# Sheet geometry: 40 non-empty cells, no cell spill, feet on the pivot, walk / strike frames that actually move.
# Timid wildlife (deer, hare) never attacks the player, so it is checked fleeing (walk cycle, row turned away) and as a
# tamed pet striking (impact → recover, latched row, damage through combat). A sheet that has not decoded falls back to
# procedural art. Phone: a 844x390 touch viewport at 4x CPU slowdown renders a crowd of the new creatures in budget.
# If assets/bestiary/v1/*.png are extracted next to preview.html, it also screenshots the preview for every facing.
import sys, json, os, io, zipfile
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(os.path.dirname(here))
f = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.18.html')
chrome = sys.argv[2] if len(sys.argv) > 2 else '/usr/bin/google-chrome'
shots = sys.argv[3] if len(sys.argv) > 3 else None
PACKS = ['assets/bestiary/v1/manifest.json', 'assets/bestiary/v1.1.0/manifest.json']   # the merged set the build embeds
mans = [json.load(open(os.path.join(root, q))) for q in PACKS]; man = mans[0]
ids = [m['id'] for mm in mans for m in mm['mobs']]; NEW = [m['id'] for m in mans[1]['mobs']]
A = man['animations']; ci = A['attack']['contactIndex']
fails = []
def check(name, ok, detail=''):
  print(('ok   ' if ok else 'FAIL ') + name + (('  ' + detail) if detail and not ok else '')); ok or fails.append(name)

# --- sheet geometry, straight from the packs (v1.0.0 from its ZIP, v1.1.0 from assets/bestiary/v1.1.0/) ---
def sheet_bytes(pack, atlas):
  if pack == 0:
    with zipfile.ZipFile(os.path.join(root, 'assets/bestiary/Shardfall_Bestiary_v1.0.0.zip')) as z: return z.read('assets/bestiary/v1/' + atlas)
  return open(os.path.join(root, 'assets/bestiary/v1.1.0', atlas), 'rb').read()
FW, FH = man['frame']['width'], man['frame']['height']; PX, PY = man['frame']['pivot']
for k, mm in enumerate(mans):
  for k2 in ('frame', 'rows', 'columns', 'animations'):
    check(f'pack {mm["version"]}: {k2} matches v1.0.0', mm[k2] == man[k2])
  for mob in mm['mobs']:
    im = Image.open(io.BytesIO(sheet_bytes(k, mob['atlas']))); id = mob['id']
    check(f'{id}: sheet has an alpha channel', im.mode == 'RGBA' or (im.mode == 'P' and 'transparency' in im.info), im.mode); im = im.convert('RGBA'); a = im.getchannel('A')
    cells = [[im.crop((c * FW, r * FH, c * FW + FW, r * FH + FH)) for c in range(5)] for r in range(8)]
    bbs = [[cells[r][c].getchannel('A').getbbox() for c in range(5)] for r in range(8)]
    flat = [b for row in bbs for b in row]
    check(f'{id}: 40 non-empty cells', all(flat), str(sum(1 for b in flat if not b)))
    if not all(flat): continue
    check(f'{id}: no cell touches its border (no spill or cut-off)', all(b[0] > 0 and b[1] > 0 and b[2] < FW and b[3] < FH for b in flat))
    feet = [b[3] for b in flat]; cx = [(b[0] + b[2]) / 2 for b in flat]
    check(f'{id}: feet on the pivot line (y {PY}±3)', all(abs(f - PY) <= 3 for f in feet), f'{min(feet)}..{max(feet)}')
    check(f'{id}: centred on the pivot (x {PX}±6)', all(abs(x - PX) <= 6 for x in cx), f'{min(cx)}..{max(cx)}')
    moving = all(ImageChops.difference(cells[r][0], cells[r][1]).getbbox() and ImageChops.difference(cells[r][2], cells[r][1]).getbbox() for r in range(8))
    striking = all(ImageChops.difference(cells[r][3], cells[r][4]).getbbox() for r in range(8))
    check(f'{id}: walk steps differ from neutral in all 8 rows', bool(moving)); check(f'{id}: wind-up and impact differ in all 8 rows', bool(striking))
with sync_playwright() as p:
  b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
  errs = []; pg = b.new_page(viewport={'width': 1280, 'height': 720}); pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto('file://' + f); pg.wait_for_timeout(600); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(600)
  pg.evaluate("o => __CC.quick(o)", {'name': 'Tess', 'template': 'mage'}); pg.wait_for_timeout(1200)
  out = pg.evaluate(open(os.path.join(here, 'scenario.js')).read())
  W, H = man['frame']['width'] * len(man['columns']), man['frame']['height'] * len(man['rows'])
  check('game embeds exactly the merged pack set', sorted(m['id'] for m in pg.evaluate('window.__SF.BESTIARY.mobs')) == sorted(ids))
  check('timid wildlife among the new sheets is deer and hare', sorted(out['timidIds']) == ['deer', 'hare'], str(out['timidIds']))
  for id in ids:
    check(f'{id}: sheet loads {W}x{H}', out['loaded'].get(id) == [W, H], str(out['loaded'].get(id)))
    px = out['pixelExact'][id]; check(f'{id}: 40 cells draw pixel-exact', px['cells'] == 40 and px['diffBytes'] == 0, str(px))
    if id in out['timidIds']:
      t = out['timid'][id]
      check(f'{id}: bolts from the player (AI unchanged: timid)', t['fled'])
      check(f'{id}: fleeing plays walk columns', t['fleeCols'] == sorted(set(A['walk']['frames'])), str(t['fleeCols']))
      check(f'{id}: fleeing row faces away from the player (85% of frames)', t['fleeFrames'] > 20 and t['away'] >= .85 * t['fleeFrames'], f"{t['away']}/{t['fleeFrames']} " + json.dumps(t.get('awayFail')))
      check(f'{id}: as a pet, impact column on its strike', t['impactCol'] == A['attack']['frames'][ci], str(t['impactCol']))
      check(f'{id}: as a pet, recover column after impact', t['recoverCol'] == A['attack']['frames'][ci + 1], str(t['recoverCol']))
      check(f'{id}: as a pet, facing locked through the strike', t['rowLocked'])
      check(f'{id}: as a pet, strikes resolve through combat', t['petStrikes'] > 0, f"{t['petStrikes']} strikes, {t['petHits']} drew blood")
      check(f'{id}: drawn by the in-game renderer', t['drawn'])
      continue
    check(f'{id}: attack row follows all 8 approach directions', out['facing'][id] == list(range(8)), str(out['facing'][id]))
    c = out['combat'][id]
    check(f'{id}: idle uses neutral column', c['idleCol'] == A['idle']['frames'][0], str(c['idleCol']))
    check(f'{id}: chase plays walk columns', c['walkCols'] == sorted(set(A['walk']['frames'])), str(c['walkCols']))
    check(f'{id}: wind-up column during telegraph', c['windupCol'] == A['attack']['frames'][ci - 1], str(c['windupCol']))
    check(f'{id}: impact column on strike resolution', c['struck'] and c['impactCol'] == A['attack']['frames'][ci], str(c))
    check(f'{id}: recover column after impact', c['recoverCol'] == A['attack']['frames'][ci + 1], str(c['recoverCol']))
    check(f'{id}: facing locked through the attack', c['rowLocked'], json.dumps(c.get('lockFail')))
    check(f'{id}: drawn by the in-game renderer', c['drawn'])
    check(f'{id}: strikes land on the player through combat', c['hpEvents'] > 0 and not c.get('died'), str(c['hpEvents']))
  fb = out['fallback']; check(f"{fb['id']}: undecoded sheet falls back to procedural art", fb['threw'] is None and not fb['poseSet'], str(fb))
  check('Lich Lord turquoise rim present', out['lichRim']['teal'] > 50, str(out['lichRim']))
  print('     strikes / hits on the player per creature:', {k: f"{v.get('strikes', 0)}/{v['hpEvents']}" for k, v in out['combat'].items()}, 'pets (strikes/hits on a rat):', {k: f"{v['petStrikes']}/{v['petHits']}" for k, v in out['timid'].items()})
  if shots:
    os.makedirs(shots, exist_ok=True)
    # in-game line-up: every creature around the player, mixed facings and poses
    pg.evaluate('''() => { const S = window.__SF, P = S.P; for (const e of S.ents) if (e.kind === 'mon') e.gone = true;
      S.BESTIARY.mobs.forEach((m, i) => { const a = i / S.BESTIARY.mobs.length * Math.PI * 2; const e = S.spawnMon(m.id, Math.cos(a) * 5, Math.sin(a) * 5); e.sect = i % 8; e.state = 'idle';
        if (i % 3 === 1) { e.state = 'tele'; e.st = S.GT; e.atkRow = e.sect; e.mode = 'melee'; } if (i % 3 === 2) e.impactT = S.GT; });
      S.MON.lich_lord.aggro = 0; for (const e of S.ents) if (e.kind === 'mon') { e.aiOff = true; } S.render(); }''')
    pg.screenshot(path=os.path.join(shots, 'ingame-lineup.png'))
    # in-game walking: one creature chasing the player across frames
    for k, id in enumerate(['orc', 'lich_lord'] + NEW):
      pg.evaluate(f'''() => {{ const S = window.__SF, P = S.P; for (const e of S.ents) if (e.kind === 'mon') e.gone = true; const m = window.__shot = S.spawnMon('{id}', -3, -4); m.target = P; m.state = 'chase';
        for (let i = 0; i < 14; i++) {{ P.hp = 1e6; S.update(.02); P.hp = S.SF.maxHp(P); }} S.render(); }}''')
      pg.screenshot(path=os.path.join(shots, f'ingame-walk-{id}.png'))
      pg.evaluate('''() => { const S = window.__SF, P = S.P; const m = window.__shot; for (let i = 0; i < 200 && m.state !== 'tele'; i++) { P.hp = 1e6; S.update(.02); P.hp = S.SF.maxHp(P); } S.render(); }''')
      pg.screenshot(path=os.path.join(shots, f'ingame-windup-{id}.png'))
  check('no page errors', not errs, '; '.join(errs[:3]))
  pg.close()

  # phone: a landscape touch viewport at 4x CPU slowdown; a crowd of the six new creatures on screen, walking and striking.
  # Render time with the sheets is compared with the same crowd drawn by the procedural art it replaces.
  ctx = b.new_context(viewport={'width': 844, 'height': 390}, device_scale_factor=3, is_mobile=True, has_touch=True)
  ph = ctx.new_page(); perrs = []; ph.on('pageerror', lambda e: perrs.append(str(e)))
  ph.goto('file://' + f); ph.wait_for_timeout(600); ph.evaluate('localStorage.clear()'); ph.reload(); ph.wait_for_timeout(600)
  ph.evaluate("o => __CC.quick(o)", {'name': 'Tess', 'template': 'advanced', 'stats': [20, 10, 50], 'skills': [['magery', 50], ['healing', 30], ['meditation', 20]]}); ph.wait_for_timeout(1200)
  cdp = ctx.new_cdp_session(ph); cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
  perf = ph.evaluate("""async (NEW) => { const S = window.__SF, P = S.P; for (let i = 0; i < 100 && NEW.some(id => !S.BSI[id]); i++) await new Promise(r => setTimeout(r, 50));
    for (const e of S.ents) if (e.kind === 'mon') e.gone = true; const crowd = [];
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2, r = 2.5 + (i % 3) * 1.5, m = S.spawnMon(NEW[i % NEW.length], Math.cos(a) * r, Math.sin(a) * r); m.sect = i % 8; m.speed = i % 2 ? 4 : 0; if (i % 4 === 3) m.impactT = S.GT; crowd.push(m); }
    S.render(); const drawn = crowd.filter(m => m.pose).length;
    // the crowd's own draw cost, the same calls drawEnt makes: a sheet cell, or the cached procedural sprite it replaces
    const cv = document.createElement('canvas'); cv.width = 844 * 3; cv.height = 390 * 3; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; const F = S.BESTIARY.frame;
    const sheet = () => { for (const m of crowd) { const p = S.bestiaryPose(m), s = S.MON[m.type].artScale || 1; g.drawImage(S.BSI[m.type], p.col * F.width, p.row * F.height, F.width, F.height, 400 - F.pivot[0] * s, 300 - F.pivot[1] * s, F.width * s, F.height * s); } };
    const proc = () => { for (const m of crowd) { const sp = S.beastSprite(m); g.drawImage(sp, 400 - sp.ox, 300 - sp.oy); } };
    const bench = fn => { fn(); const runs = []; for (let k = 0; k < 7; k++) { const t0 = performance.now(); for (let i = 0; i < 40; i++) fn(); runs.push((performance.now() - t0) / 40); } return runs.sort((x, y) => x - y)[3]; };
    const r = { drawn, sheets: bench(sheet), proc: bench(proc) };
    const frames = []; for (let k = 0; k < 30; k++) { const t0 = performance.now(); S.render(); frames.push(performance.now() - t0); } r.frame = frames.sort((x, y) => x - y)[15];
    for (const m of crowd) m.gone = true; return r; }""", NEW)
  cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
  print(f"     phone, 4x CPU slowdown: 24 creatures draw in {perf['sheets']:.2f} ms from sheets vs {perf['proc']:.2f} ms procedural; whole frame (median) {perf['frame']:.1f} ms")
  check('phone: all 24 crowd creatures drawn from sheets', perf['drawn'] == 24, str(perf['drawn']))
  check('phone: 24 sheet creatures draw in at most 3 ms at 4x slowdown', perf['sheets'] <= 3, f"{perf['sheets']:.2f} ms")
  check('phone: sheets draw no slower than 2x the procedural art', perf['sheets'] <= 2 * perf['proc'] + .3, f"{perf['sheets']:.2f} vs {perf['proc']:.2f} ms")
  if shots:
    ph.evaluate("""(NEW) => { const S = window.__SF; for (const e of S.ents) if (e.kind === 'mon') e.gone = true;
      NEW.forEach((id, i) => { const m = S.spawnMon(id, -3 + i * 1.3, 1.5 - (i % 2)); m.sect = 7; }); S.render(); }""", NEW)
    ph.screenshot(path=os.path.join(shots, 'phone-new-wildlife.png'))
  check('phone: no page errors', not perrs, '; '.join(perrs[:3]))
  ctx.close()
  prev = os.path.join(root, 'assets/bestiary/v1/preview.html')
  if os.path.exists(os.path.join(root, 'assets/bestiary/v1/ettin.png')):
    pg = b.new_page(viewport={'width': 1110, 'height': 760}); perr = []; pg.on('pageerror', lambda e: perr.append(str(e)))
    pg.goto('file://' + prev); pg.wait_for_timeout(800)
    missing = pg.evaluate("[...document.querySelectorAll('figcaption')].filter(c => c.textContent.includes('unavailable')).length")
    check('preview: all 11 sheets available', missing == 0, f'{missing} missing')
    for act in ['Walk', 'Attack']:
      for d, name in enumerate(man['rows']):
        pg.select_option('#dir', str(d)); pg.select_option('#act', act); pg.wait_for_timeout(260)
        if shots: pg.screenshot(path=os.path.join(shots, f'preview-{act.lower()}-{d}-{name}.png'), full_page=True)
    check('preview: no page errors', not perr, '; '.join(perr[:3]))
  else: print('skip preview (extract assets/bestiary/Shardfall_Bestiary_v1.0.0.zip at the repo root first)')
  b.close()
print('ALL PASS' if not fails else f'{len(fails)} FAILED'); sys.exit(1 if fails else 0)
