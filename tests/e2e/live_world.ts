/* The built game against the real server World, without the database or Supabase: a developer harness for checking online
   gameplay in a real browser (desktop and phone), used for Server Economy v1.
   The page's WebSocket is replaced by a bridge to this process (Playwright exposeBinding), where the real World runs with
   the real terrain, creatures, rules and counters; the welcome is built like the gateway builds it. REST calls the online
   screens make (/api/config, /api/session) are answered with a signed-out stub, then the harness opens the lobby itself.
   Run: NODE_PATH=<global node_modules with playwright> tsx tests/e2e/live_world.ts [build.html] [--phone] [--shots dir]
   Not part of CI (CI runs the real stack in tests/e2e/online_flow.py); it needs Node Playwright and Google Chrome. */
import http = require('node:http');
import fs = require('node:fs');
import path = require('node:path');
import crypto = require('node:crypto');
import COL = require('../../shared/collision');
import MV = require('../../shared/movement');
import P = require('../../shared/protocol');
import adapter = require('../../shared/game-rules-adapter');
import { loadTerrain } from '../../server/src/world/terrain';
import { loadPopulation, worldClock } from '../../server/src/world/creatures';
import { loadEconomy } from '../../server/src/world/economy';
import { World, type Actor } from '../../server/src/world/world';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const args = process.argv.slice(2); const phone = args.includes('--phone');
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const build = args.find(a => a.endsWith('.html')) || fs.readdirSync(ROOT).filter(f => /^Shardfall_v[\d.]+\.html$/.test(f)).sort((a, b) => { const v = (f: string) => f.replace(/\D+/g, ' ').trim().split(' ').map(Number); const x = v(a), y = v(b); for (let i = 0; i < 4; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; }).pop()!;

const T = loadTerrain(ROOT); const R = adapter.load(); const SF = R.SF; const SIM = adapter.loadSim();
const world = new World(T, { creatures: { data: loadPopulation(ROOT, T), sim: SIM, clock: worldClock(SIM) }, combat: { SF }, economy: loadEconomy(ROOT, T.hash) });

/* one character, built by the server's own creation rules, standing by a keeper */
export function character(name: string, near: string) {
  const v = R.validateCreation({ name, look: SF.CREATION.defaultLook('male'), str: 45, dex: 25, int: 10, skills: [['swordsmanship', 50], ['tactics', 30], ['healing', 20]], town: 'quay' });
  if (!v.ok) throw new Error('creation: ' + v.errors.join('; '));
  const b = R.buildCharacter(v.value); const id = crypto.randomUUID();
  const items = b.items.map((i, k) => ({ id: crypto.randomUUID(), container: i.container, slot: i.slot, position: k, item_def: i.item_def, qty: i.qty, props: i.props }));
  const eco = loadEconomy(ROOT); const p = eco.posts.find(x => x.name === near)!; const s = COL.nearestStand(T.world, p.x, p.y + 1.2, 6)!;
  const snap = { id, realmId: 'anniabreen', name: b.name, body: b.body, appearance: b.appearance, stats: { str: b.str, dex: b.dex, int: b.int }, statLocks: b.statLocks, skills: b.skills, template: b.template,
    startingTown: b.startingTown, boundShrine: b.boundShrine, vitals: { hp: b.hp, stam: b.stam, mana: b.mana }, ghost: false, position: { map: 'anniabreen', town: 'quay', x: s.x, y: s.y }, hotbar: b.hotbar, title: R.title({ skills: b.skills }),
    items: items.map(i => ({ id: i.id, container: i.container, slot: i.slot, position: i.position, itemDef: i.item_def, name: R.itemName(i.item_def), qty: i.qty, props: i.props })) };
  const rc = R.characterFromRows({ name: b.name, str: b.str, dex: b.dex, int: b.int, skills: b.skills, stat_locks: b.statLocks, appearance: b.appearance }, items);
  return { snap, rc };
}

async function main() {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url || '/', 'http://x');
    if (u.pathname === '/api/config') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ providers: { google: false, apple: false }, realms: [{ id: 'anniabreen', name: 'Anniabreen' }] })); }
    if (u.pathname === '/api/session') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify({ authenticated: false })); }
    if (u.pathname.startsWith('/api/')) { res.statusCode = 404; return res.end('{}'); }
    const f = path.join(ROOT, decodeURIComponent(u.pathname === '/' ? '/' + build : u.pathname)); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end(); }
    res.setHeader('content-type', f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'); fs.createReadStream(f).pipe(res);
  });
  await new Promise<void>(r => srv.listen(0, '127.0.0.1', () => r())); const port = (srv.address() as any).port;
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext(phone ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' } : { viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage(); const errors: string[] = []; page.on('pageerror', (e: Error) => errors.push(e.message)); page.on('console', (m: any) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  const outbox: string[] = []; let seq = 0;
  const { snap, rc } = character('Tess', 'Gus, provisioner'); let actor: Actor | null = null;
  world.setSink((a, type, p) => { if (a === actor) outbox.push(P.encode(type, p, { seq: ++seq })); });
  world.onFlush(() => { if (!outbox.length) return; const batch = outbox.splice(0); page.evaluate((b: string[]) => { for (const t of b) (window as any).__wsRecv(t); }, batch).catch(() => {}); });
  await page.exposeBinding('__wsSend', (_src: any, text: string) => {
    const r = P.parseClient(text); if (!r.ok) { outbox.push(P.encode('error', { code: r.code, message: r.message }, { id: r.id, seq: ++seq })); return; }
    const m = r.msg, cid = snap.id;
    if (m.type === 'hello') {
      actor = world.add({ characterId: cid, accountId: 'acc', realmId: 'anniabreen', ctx: MV.ctxFor(SF, rc), stam: snap.vitals.stam, ch: rc, hp: snap.vitals.hp, mana: snap.vitals.mana, ghost: false, bound: snap.boundShrine,
        position: snap.position, info: { characterId: cid, name: snap.name, body: snap.body, appearance: snap.appearance, title: snap.title, town: snap.startingTown, equip: {} } }).actor;
      outbox.push(P.encode('welcome', { protocol: P.PROTOCOL_VERSION, tick: world.tick, tickMs: P.TICK_MS, serverAuthoritative: false, authoritative: { movement: true, creatures: true, combat: world.combatOn, items: world.combatOn, economy: world.economyOn }, clock: world.clockInfo(),
        notice: 'harness', resumed: false, character: snap, presence: [], world: { hash: T.hash, W: T.world.W, H: T.world.H, step: MV.STEP, viewRadius: world.viewRadius }, you: world.selfPayload(actor) }, { id: m.id, seq: ++seq }));
      world.sendInventory(cid); return;
    }
    let why: string | null = null;
    if (m.type === 'move') world.input(cid, m.p.inputs as any);
    else if (m.type === 'target') why = world.target(cid, m.p.nid as any);
    else if (m.type === 'item') why = world.item(cid, m.p as any);
    else if (m.type === 'counter') why = world.counter(cid, m.p as any);
    else if (m.type === 'resurrect') why = world.resurrect(cid, m.p.at as any);
    else if (m.type === 'ping') outbox.push(P.encode('pong', { t: m.p.t ?? null, tick: world.tick, serverTime: Date.now() }, { id: m.id, seq: ++seq }));
    if (why) outbox.push(P.encode('combat', { k: 'refused', what: m.type, reason: why }, { id: m.id, seq: ++seq }));
  });
  await page.addInitScript({ content: `window.__name = window.__name || (f => f);
    class BridgeSocket { constructor() { this.readyState = 0; window.__ws = this; setTimeout(() => { this.readyState = 1; this.onopen && this.onopen({}); }, 20); }
      send(t) { window.__wsSend(t); } close() { this.readyState = 3; } }
    BridgeSocket.OPEN = 1; BridgeSocket.CLOSED = 3; BridgeSocket.CONNECTING = 0; window.WebSocket = BridgeSocket;
    window.__wsRecv = t => { const w = window.__ws; if (w && w.onmessage) w.onmessage({ data: t }); };` });
  world.start();
  await page.goto(`http://127.0.0.1:${port}/`); await page.waitForSelector('[data-c=new]');
  await page.evaluate(async (ch: any) => { const O = (window as any).__ONLINE; await O.open(); const S = O.state; S.session = { authenticated: true, kind: 'full' }; S.roster = { characters: [ch], slots: 5 }; await O.click('on-play', { id: ch.id }); }, snap);
  try { await page.waitForFunction(() => !!(window as any).__ONLINE.world, null, { timeout: 15000 }); }
  catch (e) { console.error('did not enter the world:', await page.evaluate(() => { const S = (window as any).__ONLINE.state; return JSON.stringify({ view: S.view, err: S.err, lobby: S.lobby && { status: S.lobby.status, note: S.lobby.note } }); }), errors); throw e; }
  const result = await run(page, world, () => actor!, shots, phone);
  await browser.close(); srv.close(); world.stop();
  if (errors.length) { console.error('page errors:\n  ' + errors.slice(0, 8).join('\n  ')); process.exit(1); }
  console.log(JSON.stringify(result, null, 1)); console.log('ok   live client checks passed' + (phone ? ' (phone)' : ' (desktop)'));
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
function check(cond: any, what: string) { if (!cond) throw new Error('FAIL ' + what); console.log('ok   ' + what); }
/* the economy walk-through: a keeper in view, the shop panel, buying and selling with the real buttons, the bank */
async function run(page: any, w: World, me: () => Actor, shots: string | null, phone: boolean) {
  const shot = async (n: string) => { if (shots) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, (phone ? 'phone-' : 'desktop-') + n + '.png') }); } };
  await wait(1200);
  const gus = await page.evaluate(() => { const W = (window as any).__ONLINE.world; const e = [...W.remotes.values()].find((x: any) => x.kind === 'npc' && x.name === 'Gus, provisioner'); return e ? { nid: e.nid, role: e.role } : null; });
  check(gus && gus.role === 'provisioner', 'the provisioner is in view as a keeper');
  await shot('1-keeper');
  await page.evaluate((nid: number) => { const O = (window as any).__ONLINE; const e = O.world.remotes.get(nid); O.openCounter(e); }, gus.nid); await wait(400);
  check(await page.evaluate(() => !!document.querySelector('#panel:not([hidden]) [data-a=buy]')), 'tapping the provisioner opens the game’s shop panel with Buy buttons');
  await shot('2-shop');
  const g0 = SF.count(me().ch.pack, 'gold'), b0 = SF.count(me().ch.pack, 'bandage');
  await page.click('#panel [data-a=buy][data-id=bandage][data-n="10"]'); await wait(400);
  check(SF.count(me().ch.pack, 'gold') === g0 - SF.PRICES.bandage * 10 && SF.count(me().ch.pack, 'bandage') === b0 + 10, 'Buy ×10 bandages with the real button: the server charged the posted price');
  const clientGold = await page.evaluate(() => (window as any).__ONLINE.player.pack.items.filter((i: any) => i.id === 'gold').reduce((a: number, i: any) => a + i.qty, 0));
  check(clientGold === SF.count(me().ch.pack, 'gold'), 'the backpack in the client shows the server’s gold');
  await page.click('#panel [data-a=tab][data-t=sell]'); await wait(300);
  await shot('3-sell');
  const meat = me().ch.pack.items.find((i: any) => i.id === 'cookedmeat'); const g1 = SF.count(me().ch.pack, 'gold');
  const uid = await page.evaluate((sid: string) => { const it = (window as any).__ONLINE.player.pack.items.find((i: any) => i.sid === sid); return it && it.uid; }, meat.sid);
  await page.click(`#panel [data-a=sell][data-u="${uid}"]:not([data-all])`); await wait(400);
  check(SF.count(me().ch.pack, 'gold') === g1 + Math.max(1, Math.floor(SF.PRICES.cookedmeat * .4)), 'Sell 1 cooked meat with the real button: paid 40 % of the price');
  // the bank
  const odile = w.economyOn ? [...w.keepers.values()].find(k => k.post.name === 'Odile, banker')! : null; check(odile, 'the Quay banker exists');
  const s = COL.nearestStand(T.world, odile!.s.x, odile!.s.y + 1.2, 6)!; const a = me(); a.s.x = s.x; a.s.y = s.y; a.changed = true; a.inputs = []; (w as any).place(a);
  await page.evaluate((p: any) => { const W = (window as any).__ONLINE.world; W.ps.x = p.x; W.ps.y = p.y; W.pending = []; }, s); await wait(1200);
  await page.evaluate(() => { const O = (window as any).__ONLINE; const e = [...O.world.remotes.values()].find((x: any) => x.kind === 'npc' && x.name === 'Odile, banker'); O.openCounter(e); }); await wait(400);
  check(await page.evaluate(() => !!document.querySelector('#panel:not([hidden]) [data-a=depgold]')), 'tapping the banker opens the game’s bank panel');
  const gp = SF.count(a.ch.pack, 'gold');
  await page.click('#panel [data-a=depgold]'); await wait(400);
  check(SF.count(a.ch.pack, 'gold') === 0 && SF.count(a.ch.bank, 'gold') === gp, 'Deposit all gold: the server moved it to the bank');
  check(await page.evaluate(() => /Bank \(\d+ gold\)/.test(document.querySelector('#panel')!.textContent || '') && (document.querySelector('#panel')!.textContent || '').includes('Withdraw')), 'the bank panel lists the deposit with a Withdraw button');
  await shot('4-bank');
  await page.click('#panel [data-a=wd]'); await wait(400);
  check(SF.count(a.ch.pack, 'gold') === gp && SF.count(a.ch.bank, 'gold') === 0, 'Withdraw with the real button: the gold is back in the backpack');
  await page.click('#panel [data-a=depeq][data-s=weapon]'); await wait(400);
  check(a.ch.equip.weapon === null && a.ch.bank.items.some((i: any) => i.id === 'sword'), 'Deposit the worn sword: unequipped and banked on the server');
  check(await page.evaluate(() => !(window as any).__ONLINE.player.equip.weapon), 'the client’s paper doll follows');
  // walking away closes the counter
  a.s.x += 9; (w as any).place(a); await page.evaluate(() => { const W = (window as any).__ONLINE.world; W.ps.x += 9; }); await wait(600);
  check(await page.evaluate(() => document.querySelector('#panel')!.hasAttribute('hidden')), 'walking away from the counter closes it');
  return { gold: SF.count(a.ch.pack, 'gold'), bank: a.ch.bank.items.map((i: any) => i.id + '×' + i.qty) };
}

main().catch(e => { console.error(e); process.exit(1); });
