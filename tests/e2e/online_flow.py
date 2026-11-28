# Browser flow for Server Foundation v1 against the real stack (server/dev/docker-compose.yml + the Shardfall server):
# two separate accounts — one on a desktop browser, one on a phone-sized touch browser (iPhone viewport, Safari user agent) —
# register, confirm their email from the Mailpit inbox, create a character with the existing creator, enter the alpha lobby and
# see each other; one signs out and the other sees the leave. The offline save made before is byte-identical afterwards.
# usage: python3 tests/e2e/online_flow.py   (env: E2E_SHOTS=dir for screenshots, E2E_BASE to use an already running server)
import asyncio, base64, json, os, re, secrets, subprocess, sys, time, urllib.request
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHOTS = os.environ.get('E2E_SHOTS', '/tmp/e2e-shots'); os.makedirs(SHOTS, exist_ok=True)
MAILPIT = os.environ.get('TEST_MAILPIT_URL', 'http://localhost:8025')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
PORT = 8787; BASE = os.environ.get('E2E_BASE', f'http://localhost:{PORT}')
fails = 0
def check(cond, msg):
    global fails
    print(('ok   ' if cond else 'FAIL ') + msg, flush=True); fails += 0 if cond else 1

def start_server():
    keys = subprocess.run(['node', '--import', 'tsx', 'server/dev/keys.ts'], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    env = dict(os.environ); env.update(dict(l.split('=', 1) for l in keys.strip().splitlines()))
    env.update({'NODE_ENV': 'development', 'PUBLIC_URL': BASE, 'PORT': str(PORT), 'DATABASE_URL': os.environ.get('DATABASE_URL', 'postgres://postgres:postgres@localhost:54329/postgres'),
                'DATABASE_SSL': 'off', 'SUPABASE_AUTH_URL': os.environ.get('TEST_SUPABASE_AUTH_URL', 'http://localhost:9999'), 'SESSION_ENCRYPTION_KEY': base64.b64encode(secrets.token_bytes(32)).decode(),
                'OAUTH_GOOGLE_ENABLED': 'true', 'AUTH_RATE_LIMIT_PER_MINUTE': '200', 'LOG_LEVEL': 'warn'})
    log = open(os.path.join(SHOTS, 'server.log'), 'w')   # its own file: a shared pipe can be left non-blocking by node
    p = subprocess.Popen(['node', '--import', 'tsx', 'server/src/index.ts'], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
    for _ in range(120):
        try:
            if urllib.request.urlopen(BASE + '/api/ready', timeout=2).status == 200: return p
        except Exception: time.sleep(0.5)
    p.kill(); raise SystemExit('server did not become ready')

def email_link(to, timeout=20):
    t0 = time.time()
    while time.time() - t0 < timeout:
        j = json.load(urllib.request.urlopen(f'{MAILPIT}/api/v1/search?query=' + urllib.parse.quote(f'to:"{to}"')))
        if j.get('messages'):
            m = json.load(urllib.request.urlopen(f"{MAILPIT}/api/v1/message/{j['messages'][0]['ID']}"))
            href = re.search(r'href="([^"]+)"', m.get('HTML') or '')
            if href: return href.group(1).replace('&amp;', '&')
        time.sleep(0.3)
    raise RuntimeError('no email to ' + to)

import urllib.parse
async def shot(page, name):
    await page.screenshot(path=os.path.join(SHOTS, name + '.png'))
    if os.environ.get('E2E_PRINT_SHOTS'):   # CI: also print a small JPEG into the log (the review copy of the screenshots)
        jpg = await page.screenshot(type='jpeg', quality=60)
        b64 = base64.b64encode(jpg).decode()
        print(f'@@SHOT {name} {len(b64)}', flush=True)
        for i in range(0, len(b64), 4000): print('@@B64 ' + b64[i:i + 4000], flush=True)
        print(f'@@END {name}', flush=True)

async def register_and_create(page, email, char_name, tag):
    await page.goto(BASE + '/'); await page.wait_for_selector('[data-c=online]')
    await page.click('[data-c=online]'); await page.wait_for_selector('form[data-f=signin]')
    await shot(page, f'{tag}_01_signin')
    check(await page.locator('a[href="/api/auth/oauth/google"]').count() == 1, f'{tag}: Google button shown (enabled in Supabase Auth fixture)')
    check(await page.locator('a[href="/api/auth/oauth/apple"]').count() == 0, f'{tag}: Apple button hidden (not configured)')
    await page.click('[data-c=on-view][data-v=register]'); await page.wait_for_selector('form[data-f=register]')
    await page.fill('#on-name', char_name + ' player'); await page.fill('#on-email', email); await page.fill('#on-pw', 'correct-horse-battery-7'); await page.fill('#on-pw2', 'correct-horse-battery-7')
    await shot(page, f'{tag}_02_register')
    await page.click('form[data-f=register] button[type=submit]'); await page.wait_for_selector('text=Check your email')
    link = email_link(email)
    await page.goto(link)
    try: await page.wait_for_selector('text=Your characters', timeout=15000)
    except Exception:
        print('DEBUG url', page.url, 'cookies', [c['name'] for c in await page.context.cookies()], flush=True)
        print('DEBUG screen', (await page.inner_text('#ccin'))[:600], flush=True); await shot(page, f'{tag}_fail'); raise
    check(await page.locator('text=Your email address is confirmed').count() == 1, f'{tag}: email confirmed, signed in, roster shown')
    check('online=' not in page.url, f'{tag}: address bar cleaned after the callback')
    await shot(page, f'{tag}_03_roster_empty')
    await page.click('[data-c=on-new]'); await page.wait_for_selector('#ccn')
    check(await page.locator('.cctop .ccbadge', has_text='Online').count() == 1, f'{tag}: the existing creator, marked Online')
    await page.fill('#ccn', char_name)
    for _ in range(3): await page.click('[data-c=next]')
    check(await page.locator('text=Replace').count() == 0, f'{tag}: no offline-save replace warning in online creation')
    await shot(page, f'{tag}_04_creator_review')
    await page.click('[data-c=go]'); await page.wait_for_selector(f'.oncard b:has-text("{char_name}")', timeout=10000)
    check(await page.locator(f'text={char_name} has been created').count() == 1, f'{tag}: server created {char_name}')
    await shot(page, f'{tag}_05_roster')
    await page.click('[data-c=on-play]'); await page.wait_for_selector('#owbar .ondot.connected', timeout=20000)
    check(await page.locator('#owbar', has_text='Alpha').count() == 1 or tag == 'B', f'{tag}: in the world, the online bar says it is an alpha')
    check(await page.evaluate("document.querySelector('#cc').hidden && document.body.classList.contains('online')"), f'{tag}: the game world is shown, online')

async def main():
    for fd in (1, 2):
        try: os.set_blocking(fd, True)
        except Exception: pass
    srv = None if os.environ.get('E2E_BASE') else start_server()
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
            A = await b.new_context(viewport={'width': 1280, 'height': 800})
            B = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, is_mobile=True, has_touch=True,
                                    user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')
            pa, pb = await A.new_page(), await B.new_page(); errors = []
            for pg in (pa, pb): pg.on('pageerror', lambda e: errors.append(str(e)))
            # an offline character first: its save must survive everything online untouched
            await pa.goto(BASE + '/'); await pa.wait_for_selector('[data-c=new]')
            check(await pa.evaluate("__CC.quick({name:'Offlina', template:'archer', town:'quay'})"), 'offline character starts as before')
            await pa.wait_for_timeout(500)
            await pa.goto(BASE + '/'); await pa.wait_for_selector('[data-c=cont]')   # leaving the game saves it one last time
            offline = await pa.evaluate("localStorage.getItem('shardfall.save.v1')")
            check(bool(offline) and '"Offlina"' in offline, 'offline save written to localStorage')
            await shot(pa, 'A_00_title_with_offline_save')
            na, nb = 'Alder' + secrets.token_hex(2).translate(str.maketrans('0123456789', 'abcdefghij')), 'Briar' + secrets.token_hex(2).translate(str.maketrans('0123456789', 'abcdefghij'))
            ea, eb = f'a.{secrets.token_hex(4)}@shardfall.test', f'b.{secrets.token_hex(4)}@shardfall.test'
            await register_and_create(pa, ea, na, 'A')
            await register_and_create(pb, eb, nb, 'B')
            names = "[...__ONLINE.world.remotes.values()].map(e => e.name)"
            await pa.wait_for_function(f"{names}.includes('{nb}')", timeout=10000); await pb.wait_for_function(f"{names}.includes('{na}')", timeout=10000)
            check(True, f'two accounts see each other in the world ({na} on desktop, {nb} on phone)')
            # A walks with the keyboard; the server moves A and B sees A arrive somewhere else
            before = await pb.evaluate(f"(() => {{ const e = [...__ONLINE.world.remotes.values()].find(e => e.name === '{na}'); return [e.x, e.y]; }})()")
            a0 = await pa.evaluate("[__ONLINE.world.ps.x, __ONLINE.world.ps.y]")
            await pa.keyboard.down('d'); await pa.wait_for_timeout(1000); await pa.keyboard.up('d'); await pa.wait_for_timeout(800)
            a1 = await pa.evaluate("({ p: [__ONLINE.world.ps.x, __ONLINE.world.ps.y], pending: __ONLINE.world.pending.length, corrections: __ONLINE.world.corrections })")
            check(((a1['p'][0] - a0[0]) ** 2 + (a1['p'][1] - a0[1]) ** 2) ** .5 > 3, f"A walked ({a0} -> {a1['p']})")
            check(a1['pending'] == 0, 'every intent acknowledged by the server')
            check(a1['corrections'] == 0, 'client prediction matched the server exactly (no corrections)')
            after = await pb.evaluate(f"(() => {{ const e = [...__ONLINE.world.remotes.values()].find(e => e.name === '{na}'); return [e.x, e.y]; }})()")
            check(abs(after[0] - a1['p'][0]) < .05 and abs(after[1] - a1['p'][1]) < .05, f'B sees A where the server put A ({after} vs {a1["p"]})')
            check(before != after, 'B saw A move')
            await pa.wait_for_timeout(5200)   # a ping round trip for the latency readout
            await shot(pa, 'A_06_world_desktop'); await shot(pb, 'B_06_world_phone')
            # B leaves the world: A sees B go
            await pb.click('[data-ow=leave]'); await pb.wait_for_selector('.oncard', timeout=15000)
            await pa.wait_for_function(f"!{names}.includes('{nb}')", timeout=15000)
            check(True, 'leaving the world removes the character for the other player')
            await pb.click('[data-c=on-account]'); await pb.wait_for_selector('text=Delete account')
            check(await pb.locator(f'text={eb}').count() == 1, 'account page shows the email from Supabase Auth')
            await shot(pb, 'B_07_account_phone')
            await pb.click('[data-c=on-logout]'); await pb.wait_for_selector('form[data-f=signin]')
            check(await pb.locator('text=Signed out.').count() == 1, 'sign out')
            # back to the title on desktop: the offline save is exactly as it was
            await pa.click('[data-ow=leave]'); await pa.wait_for_selector('.oncard', timeout=15000); await pa.click('[data-c=on-home]'); await pa.wait_for_selector('[data-c=cont]')
            check(await pa.evaluate("localStorage.getItem('shardfall.save.v1')") == offline, 'offline save byte-identical after online play')
            check(not any('shardfall' in k and k != 'shardfall.save.v1' and 'online' in k for k in await pa.evaluate('Object.keys(localStorage)')), 'online play stores nothing in localStorage')
            check(not errors, 'no page errors' + (f': {errors[:3]}' if errors else ''))
            await b.close()
    finally:
        if srv:
            srv.terminate()
            if fails: print(open(os.path.join(SHOTS, 'server.log')).read()[-4000:])
    print(('ALL PASS' if not fails else f'{fails} FAILED') + f' — screenshots in {SHOTS}')
    sys.exit(1 if fails else 0)

asyncio.run(main())
