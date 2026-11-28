# Phone performance profile (Living World phase 6, master spec §25: "measure performance before increasing population budgets").
# Runs the built game in Chrome with a phone screen (390 × 844 portrait and 844 × 390 landscape, device pixel ratio 3, touch) and
# the CPU slowed down through the DevTools protocol (4× ≈ a mid-range phone, 6× ≈ an older one, against this machine), at Saltmarsh
# Quay and in Vespar, by day and at night, with the simulation tiers on and off (?tiers=off). For each case it measures:
#   · the simulation step (__SF.simStep(0.05), mean and p95), · one frame's draw (__SF.render(), mean and p95),
#   · the real frame rate of the running loop over 4 s, · actors per tier, · the JS heap and the save size.
# It is a measurement, not a gate: it fails only on page errors, or if a step at 4× ever averages more than the 50 ms it simulates.
# Timing depends on the machine; the numbers in docs/WORLD_SIMULATION_PROGRESS.md say where they were taken.
# usage: python3 tests/perf/phone.py Shardfall_v0.35.html [--quick] [--report /tmp/phone.json]
import functools, http.server, json, os, sys, threading
from playwright.sync_api import sync_playwright
args = sys.argv[1:]; path = os.path.abspath(args[0]); quick = '--quick' in args
report = args[args.index('--report') + 1] if '--report' in args else '/tmp/shardfall-phone.json'
class Quiet(http.server.SimpleHTTPRequestHandler):
  def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=os.path.dirname(path))); threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = 'http://127.0.0.1:%d/%s' % (srv.server_address[1], os.path.basename(path))
fails = 0
def check(ok, msg, got=None):
  global fails
  print(('ok   ' if ok else 'FAIL ') + msg + ('' if ok or got is None else '  got: ' + json.dumps(got)[:600])); fails += 0 if ok else 1

MEASURE = """async ([steps, draws]) => { const S = __SF, q = a => { a.sort((x, y) => x - y); return { mean: a.reduce((x, y) => x + y, 0) / a.length, p95: a[Math.floor(a.length * .95)] }; };
  const st = []; for (let i = 0; i < steps; i++) { const t0 = performance.now(); S.simStep(.05); st.push(performance.now() - t0); if (i % 50 === 49) await new Promise(r => setTimeout(r, 0)); }
  const dr = []; for (let i = 0; i < draws; i++) { const t0 = performance.now(); S.render(); dr.push(performance.now() - t0); }
  let kb = 0; try { kb = (localStorage.getItem('shardfall.save.v1') || '').length / 1024; } catch (e) { }
  return { step: q(st), draw: q(dr), perTier: S.TIER.on ? S.TIER.last : null, actors: S.ents.filter(e => !e.gone && e.kind !== 'corpse').length,
    heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, saveKB: Math.round(kb) }; }"""
FPS = """() => new Promise(res => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); })"""
PLACES = {'quay': [92.5, 304.5], 'vespar': None}
rows = []
with sync_playwright() as p:
  b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--enable-precise-memory-info'])
  screens = [('portrait', 390, 844)] if quick else [('portrait', 390, 844), ('landscape', 844, 390)]
  for rate in ([4] if quick else [4, 6]):
    for scr, w, h in screens:
      for tiers in ('on', 'off'):
        ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=3, is_mobile=True, has_touch=True); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL + ('' if tiers == 'on' else '?tiers=off')); pg.wait_for_timeout(600)
        pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_timeout(600); pg.evaluate("o => __CC.quick(o)", {'name': 'Tess'}); pg.wait_for_timeout(800)
        cdp = ctx.new_cdp_session(pg); cdp.send('Emulation.setCPUThrottlingRate', {'rate': rate})
        for place in (['quay'] if quick else ['quay', 'vespar']):
          for hour in (12, 0):
            pg.evaluate("""([pl, h]) => { const S = __SF, P = S.P; if (pl === 'quay') { P.x = 92.5; P.y = 304.5; } else { const G = S.lifeTownGeo('vespar'); P.x = G.center.x; P.y = G.center.y + 4; }
              if (!S.canStand(P, P.x, P.y)) for (let r = 1; r < 10; r++) if (S.canStand(P, P.x + r, P.y)) { P.x += r; break; } S.WS.clock.setHour(S.GT, h); }""", [place, hour])
            m = pg.evaluate(MEASURE, [200 if quick else 400, 30 if quick else 60]); fps = pg.evaluate(FPS)
            row = dict(cpu=rate, screen=scr, tiers=tiers, place=place, hour=hour, fps=round(fps, 1), **m); rows.append(row)
            print(f"{rate}× {scr:9} tiers {tiers:3} {place:6} {'noon ' if hour == 12 else 'night'}  step {m['step']['mean']:.2f} ms (p95 {m['step']['p95']:.2f})  draw {m['draw']['mean']:.1f} ms (p95 {m['draw']['p95']:.1f})  {fps:.0f} fps  actors {m['actors']} A/B/C {m['perTier']}  heap {m['heapMB']} MB")
        check(not errs, f'{rate}× {scr} tiers {tiers}: no page errors', errs[:3])
        ctx.close()
  b.close()
json.dump(rows, open(report, 'w'), indent=1); print('report:', report)
for r in rows:
  if r['cpu'] == 4 and r['step']['mean'] > 50: check(False, f"a step at 4× must cost less than the 50 ms it simulates", r)
on = [r['step']['mean'] for r in rows if r['tiers'] == 'on']; off = [r['step']['mean'] for r in rows if r['tiers'] == 'off']
if on and off: print(f"simulation step, mean over all cases: tiers on {sum(on) / len(on):.2f} ms, off {sum(off) / len(off):.2f} ms")
print(fails and f'{fails} FAILED' or 'ALL PASS'); sys.exit(1 if fails else 0)
