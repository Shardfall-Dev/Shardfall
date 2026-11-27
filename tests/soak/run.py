# Long-duration world simulation soak in the built game (Playwright + Chrome, served over HTTP like GitHub Pages).
# Runs the real fixed 50 ms simulation for N game days (default 3; a day is 120 game minutes) while the player is moved between
# towns, camps and the wilds, saves and reloads half way, and samples: simulation step time (mean, p95, worst per game hour),
# draw time, JS heap, actor population, path-search queue and cache, the event log, effects, audio caches, console errors,
# page errors and failed asset requests. Writes a JSON report and fails on unbounded growth, errors or failed requests.
# usage: python3 tests/soak/run.py Shardfall_vX.html [--days 3] [--report /tmp/soak.json]
import functools, http.server, json, os, sys, threading, time
from playwright.sync_api import sync_playwright
args = sys.argv[1:]; path = os.path.abspath(args[0]); days = float(args[args.index('--days') + 1]) if '--days' in args else 3.0
report = args[args.index('--report') + 1] if '--report' in args else '/tmp/shardfall-soak.json'
root = os.path.dirname(path)
class Quiet(http.server.SimpleHTTPRequestHandler):
  def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=root)); threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:%d/%s' % (srv.server_address[1], os.path.basename(path))
fails = 0
def check(cond, msg, info=None):
  global fails
  print(('ok   ' if cond else 'FAIL ') + msg + ('' if cond or info is None else '  ' + json.dumps(info)[:500])); fails += 0 if cond else 1

SAMPLE = """() => { const S = __SF, P = S.P; const nav = S.NAV, a = window.SFXA && SFXA.stats;
  return { gt: S.GT, hour: S.hourOfDay ? S.hourOfDay(S.GT) : null, ents: S.ents.length, mons: S.ents.filter(e => e.kind === 'mon' && !e.gone).length, npcs: S.ents.filter(e => e.kind === 'npc' && !e.gone).length,
    corpses: S.ents.filter(e => e.kind === 'corpse' && !e.gone).length, gone: S.ents.filter(e => e.gone).length, fx: S.FX.length, efx: S.EFX ? S.EFX.length : 0, traps: S.TRAPS.length,
    navJobs: nav.jobs.length, navCache: nav.cache.size !== undefined ? nav.cache.size : (nav.cache.map ? nav.cache.map.size : -1), navSearches: nav.searches, navFailed: nav.failed,
    log: S.LOG.length, events: S.WS && S.WS.events ? (S.WS.events.length !== undefined ? S.WS.events.length : -1) : -1, audio: a || null,
    heap: performance.memory ? performance.memory.usedJSHeapSize : null, frameErr: S.FRAME_ERR ? S.FRAME_ERR.n : 0, hp: P.hp, ghost: !!P.ghost }; }"""
# run the real simulation for `secs` game seconds in 50 ms steps, timing every step (the browser's own frame loop is paused meanwhile)
RUN = """async ([secs, chunk]) => { const S = __SF; const steps = Math.round(secs / .05), times = []; let done = 0;
  while (done < steps) { const n = Math.min(chunk, steps - done); for (let i = 0; i < n; i++) { const t0 = performance.now(); S.simStep(.05); times.push(performance.now() - t0); } done += n; await new Promise(r => setTimeout(r, 0)); }
  times.sort((a, b) => a - b); const sum = times.reduce((a, b) => a + b, 0); return { steps, mean: sum / steps, p95: times[Math.floor(steps * .95)], p99: times[Math.floor(steps * .99)], max: times[steps - 1] }; }"""
DRAW = """() => { const S = __SF, t = []; for (let i = 0; i < 60; i++) { const t0 = performance.now(); S.render(); t.push(performance.now() - t0); } t.sort((a, b) => a - b); return { mean: t.reduce((a, b) => a + b, 0) / t.length, p95: t[56], max: t[59] }; }"""
PLACES = ["() => { const P = __SF.P; P.x = 92.5; P.y = 304.5; }"]   # Saltmarsh Quay; the others come from the game's own travel places

with sync_playwright() as p:
  b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--enable-precise-memory-info', '--js-flags=--expose-gc'])
  ctx = b.new_context(viewport={'width': 1280, 'height': 720}); pg = ctx.new_page()
  errs, failed = [], []
  pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
  pg.on('console', lambda m: errs.append('console.error: ' + m.text) if m.type == 'error' else None)
  pg.on('requestfailed', lambda r: failed.append(r.url + ' ' + str(r.failure)))
  pg.on('response', lambda r: failed.append(r.url + ' HTTP %d' % r.status) if r.status >= 400 else None)
  pg.goto(URL); pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_selector('[data-c=go]'); pg.fill('#ccn', 'Soak'); pg.click('[data-c=go]'); pg.wait_for_function('window.__SF && __SF.P')
  pg.mouse.click(640, 360)   # a first gesture so the audio unlocks and starts loading like a real session
  pg.wait_for_timeout(1500)
  places = pg.evaluate("() => { try { return __SF.navPlaces().filter(p => p && Number.isFinite(p.x)).map(p => ({ name: p.name, x: p.x, y: p.y })).slice(0, 40); } catch (e) { return []; } }")
  print('travel places:', len(places))
  hours = int(round(days * 24)); per_hour = 120 * 60 / 24   # game seconds per in-game hour (a day lasts 120 minutes)
  samples = []; t_start = time.time(); gc = "() => { if (window.gc) gc(); }"
  pg.evaluate(gc); base = pg.evaluate(SAMPLE); samples.append({'h': 0, 's': base})
  for h in range(1, hours + 1):
    if places:   # move between places so different regions spawn, think and path
      pl = places[(h * 7) % len(places)]
      pg.evaluate("(pl) => { const S = __SF, P = S.P; for (let r = 0; r < 8; r++) for (let a = 0; a < 8; a++) { const x = pl.x + Math.cos(a) * r, y = pl.y + Math.sin(a) * r; if (S.canStand(P, x, y)) { P.x = x; P.y = y; return; } } }", pl)
    pg.evaluate("() => { const P = __SF.P; if (P.ghost || P.hp < 30) { P.ghost = false; P.hp = __SF.SF.maxHp(P); } }")   # keep the observer alive: this is a world soak, not a combat test
    st = pg.evaluate(RUN, [per_hour, 400])
    if h % 6 == 0: pg.evaluate(gc)
    s = pg.evaluate(SAMPLE); dr = pg.evaluate(DRAW) if h % 4 == 0 else None
    samples.append({'h': h, 'step': st, 'draw': dr, 's': s})
    print('h%-3d gt=%7.0f ents=%4d mons=%4d npcs=%3d corpses=%3d nav=%d/%s log=%d heap=%.1fMB step mean=%.3f p95=%.3f max=%.1f ms%s' % (h, s['gt'], s['ents'], s['mons'], s['npcs'], s['corpses'], s['navJobs'], s['navCache'], s['log'], (s['heap'] or 0) / 1048576, st['mean'], st['p95'], st['max'], ' draw p95=%.2f' % dr['p95'] if dr else ''), flush=True)
    if h == hours // 2:   # save and reload half way: the world resumes from the save
      size = pg.evaluate("() => { __SF.save(); return localStorage.getItem('shardfall.save.v1').length; }")
      pg.goto(URL); pg.wait_for_selector('[data-c=cont]'); pg.click('[data-c=cont]'); pg.wait_for_function('window.__SF && __SF.P'); pg.wait_for_timeout(800)
      samples.append({'h': h, 'reload': True, 'saveBytes': size, 's': pg.evaluate(SAMPLE)}); print('  reloaded; save %d KB' % (size // 1024))
  # background and foreground: the world waits while hidden, and held input is released
  # (a real hidden tab also stops requestAnimationFrame, which pauses the world; a synthetic event cannot, so only the handlers are checked)
  bg = pg.evaluate("""async () => { const S = __SF; S.JOY.on = true; S.P.sprintOn = false; const t0 = JSON.parse(localStorage.getItem('shardfall.save.v1')).savedAt; await new Promise(r => setTimeout(r, 20));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
    const joyAfterHide = S.JOY.on, saved = JSON.parse(localStorage.getItem('shardfall.save.v1')).savedAt > t0;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
    S.JOY.on = true; window.dispatchEvent(new Event('blur')); const joyAfterBlur = S.JOY.on; delete document.hidden; return { joyAfterHide, joyAfterBlur, savedOnHide: saved }; }""")
  # the page's own loop for 5 real seconds: frame-to-frame times
  fr = pg.evaluate("""() => new Promise(res => { const t = []; let last = performance.now(); const f = now => { t.push(now - last); last = now; if (t.length < 300) requestAnimationFrame(f); else { t.sort((a, b) => a - b); res({ frames: t.length, mean: t.reduce((a, b) => a + b, 0) / t.length, p95: t[Math.floor(t.length * .95)], max: t[t.length - 1] }); } }; requestAnimationFrame(f); })""")
  pg.evaluate(gc); end = pg.evaluate(SAMPLE); wall = time.time() - t_start
  b.close()

# ---- verdicts
run = [x for x in samples if 'step' in x]
first_q = run[: max(1, len(run) // 4)]; last_q = run[-max(1, len(run) // 4):]
avg = lambda xs, k: sum(x['s'][k] for x in xs) / len(xs)
heap0 = samples[0]['s']['heap']; heaps = [x['s']['heap'] for x in run if x['s']['heap']]
step_mean = sum(x['step']['mean'] for x in run) / len(run); step_p95 = max(x['step']['p95'] for x in run); step_max = max(x['step']['max'] for x in run)
draws = [x['draw'] for x in run if x.get('draw')]
out = {'days': days, 'gameHours': hours, 'wallSeconds': round(wall), 'stepMeanMs': step_mean, 'stepP95WorstHourMs': step_p95, 'stepMaxMs': step_max,
       'drawP95Ms': max(d['p95'] for d in draws) if draws else None, 'frameLoop': fr, 'heapStartMB': heap0 and heap0 / 1048576, 'heapEndMB': end['heap'] and end['heap'] / 1048576,
       'heapFirstQuarterMB': sum(heaps[:len(heaps)//4 or 1]) / (len(heaps)//4 or 1) / 1048576 if heaps else None, 'heapLastQuarterMB': sum(heaps[-(len(heaps)//4 or 1):]) / (len(heaps)//4 or 1) / 1048576 if heaps else None,
       'entsFirstQuarter': avg(first_q, 'ents'), 'entsLastQuarter': avg(last_q, 'ents'), 'navJobsMax': max(x['s']['navJobs'] for x in run), 'navCacheMax': max(x['s']['navCache'] for x in run),
       'logMax': max(x['s']['log'] for x in run), 'fxMax': max(x['s']['fx'] for x in run), 'audioEnd': end['audio'], 'background': bg, 'errors': errs[:20], 'errorCount': len(errs), 'failedRequests': failed[:20], 'samples': samples}
json.dump(out, open(report, 'w'), indent=1)
print(json.dumps({k: v for k, v in out.items() if k != 'samples'}, indent=1))
local = [f for f in failed if f.startswith('http://127.0.0.1')]; external = sorted({f.split('?')[0] for f in failed if not f.startswith('http://127.0.0.1')})
real_errs = [e for e in errs if not (e.startswith('console.error: Failed to load resource') and not local)]
if external: print('note: external requests that failed (network of this machine, not game assets):', external)
check(not real_errs, f'no page or console errors over {hours} game hours', real_errs[:5])
check(not local, 'no failed game asset requests (sounds, music, art)', local[:5])
check(end['frameErr'] == 0, 'no frame-loop errors', end['frameErr'])
check(out['heapLastQuarterMB'] is None or out['heapLastQuarterMB'] < out['heapFirstQuarterMB'] * 1.5 + 20, 'JS heap does not keep growing (last quarter vs first quarter)', [out['heapFirstQuarterMB'], out['heapLastQuarterMB']])
check(out['entsLastQuarter'] < out['entsFirstQuarter'] * 1.3 + 50, 'actor population stays bounded', [out['entsFirstQuarter'], out['entsLastQuarter']])
check(out['navJobsMax'] < 200 and out['navCacheMax'] <= 256, 'path-search queue and cache stay bounded', [out['navJobsMax'], out['navCacheMax']])
check(out['logMax'] <= 400 and out['fxMax'] < 2000, 'message log and effect lists stay bounded', [out['logMax'], out['fxMax']])
check(not bg['joyAfterHide'] and not bg['joyAfterBlur'] and bg['savedOnHide'], 'hiding the game saves and releases held input; so does losing focus', bg)
check(end['audio'] is None or end['audio'].get('lastTake', 0) <= 512, 'audio take memory stays capped', end['audio'])
print(fails and f'{fails} FAILED' or 'ALL PASS'); sys.exit(1 if fails else 0)
