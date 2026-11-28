/* Load test for the world loop: N bot players walk at random — half crowded into Saltmarsh Quay (everyone sees everyone: the
   worst case for interest management), half spread over the other towns — sending intents the way the client does.
   The bots' accounts and sessions are written straight into the test database (no Supabase Auth round trips); everything else
   is the real server: HTTP character creation, the WebSocket gateway, the world tick.
   usage: BOTS=150 DURATION=20 node --import tsx tests/server/load/bots.ts   (needs server/dev/docker-compose.yml) */
import crypto = require('node:crypto');
import WebSocket = require('ws');
import { startServer, creation } from '../helpers';
import P = require('../../../shared/protocol');

const N = +(process.env.BOTS || 150), DURATION = +(process.env.DURATION || 20);
const LIMITS = { avgStepMs: +(process.env.MAX_AVG_STEP_MS || 15), overrunShare: 0.02 };

(async () => {
  const srv = await startServer({ PROVIDER_RECHECK_MINUTES: '1440', LOG_LEVEL: 'error' });
  const sessions = srv.app.sessions; const towns = ['vespar', 'mynoc', 'skara', 'moonglen'];
  const bots: { ws: WebSocket; id: string; seq: number; bytes: number; states: number; enters: number; dir: number; welcomed: boolean }[] = [];
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const user = { id: crypto.randomUUID(), email: `bot${i}@load.test`, app_metadata: { provider: 'email' }, user_metadata: { display_name: 'Bot ' + i } };
    const s = await sessions.create({ access_token: 'load-test', refresh_token: 'load-test', expires_in: 86400, user } as any);
    const name = 'Bot' + crypto.randomBytes(4).toString('hex').replace(/\d/g, d => 'abcdefghij'[+d]).slice(0, 8);
    const town = i % 2 ? towns[i % towns.length] : 'quay';
    const r = await srv.app.chars.create(s.accountId, 'anniabreen', creation(name, { town }), null);
    bots.push({ ws: null as any, id: r.character.id, seq: 0, bytes: 0, states: 0, enters: 0, dir: Math.random() * 6.28, welcomed: false });
    const b = bots[bots.length - 1];
    b.ws = new WebSocket(srv.base.replace('http', 'ws') + '/ws', { headers: { origin: srv.origin, cookie: 'sf_session=' + s.token } });
    b.ws.on('open', () => b.ws.send(JSON.stringify({ v: P.PROTOCOL_VERSION, type: 'hello', p: { characterId: b.id } })));
    b.ws.on('message', (d: any) => { b.bytes += d.length; const m = JSON.parse(String(d)); if (m.type === 'welcome') b.welcomed = true; else if (m.type === 'state') b.states++; else if (m.type === 'actor.enter') b.enters++; });
    b.ws.on('error', () => {});
  }
  const setupS = (Date.now() - t0) / 1000;
  for (let k = 0; k < 100 && bots.some(b => !b.welcomed); k++) await new Promise(r => setTimeout(r, 100));
  const w = srv.app.world; const base = { ...w.stats }; const s0 = Date.now();
  const timer = setInterval(() => {
    for (const b of bots) {
      if (b.ws.readyState !== 1) continue; if (Math.random() < .05) b.dir += (Math.random() - .5) * 2;
      const inputs = [0, 1].map(() => ({ s: b.seq++, x: Math.cos(b.dir), y: Math.sin(b.dir), w: 1, r: Math.random() < .3 }));
      b.ws.send(JSON.stringify({ v: P.PROTOCOL_VERSION, type: 'move', p: { inputs } }));
    }
  }, 100);
  await new Promise(r => setTimeout(r, DURATION * 1000)); clearInterval(timer);
  const el = (Date.now() - s0) / 1000, st = w.stats, ticks = st.ticks - base.ticks;
  const out = { bots: N, welcomed: bots.filter(b => b.welcomed).length, setupSeconds: +setupS.toFixed(1), seconds: +el.toFixed(1), ticks, ticksPerSecond: +(ticks / el).toFixed(1),
    avgStepMs: +((st.totalStepMs - base.totalStepMs) / ticks).toFixed(3), maxStepMs: +st.maxStepMs.toFixed(2), overruns: st.overruns - base.overruns,
    inputsApplied: st.inputsApplied - base.inputsApplied, inputsDropped: st.inputsDropped - base.inputsDropped,
    statesPerBotPerSecond: +(bots.reduce((a, b) => a + b.states, 0) / N / el).toFixed(1), kBPerBotPerSecond: +(bots.reduce((a, b) => a + b.bytes, 0) / N / el / 1024).toFixed(1),
    avgVisibleEnters: +(bots.reduce((a, b) => a + b.enters, 0) / N).toFixed(1), creatures: st.creatures, creaturesActive: st.creaturesActive,
    avgCreatureMs: +((st.creatureMs - base.creatureMs) / ticks).toFixed(3), memoryMB: Math.round(process.memoryUsage().rss / 1048576) };
  console.log(JSON.stringify(out, null, 2));
  for (const b of bots) b.ws.close();
  await srv.close();
  const fails: string[] = [];
  if (out.welcomed < N) fails.push(`${N - out.welcomed} bots never got a welcome`);
  if (out.creatures < 300) fails.push(`only ${out.creatures} creatures in the world`);
  if (out.avgStepMs > LIMITS.avgStepMs) fails.push(`average tick ${out.avgStepMs} ms > ${LIMITS.avgStepMs} ms`);
  if (out.overruns > ticks * LIMITS.overrunShare) fails.push(`${out.overruns} of ${ticks} ticks overran 50 ms`);
  const expected = N * 20 * el; if (out.inputsApplied < expected * 0.9) fails.push(`only ${out.inputsApplied} of about ${Math.round(expected)} intents applied`);
  if (bots.some(b => b.states < el)) fails.push('a bot received fewer than one state message per second');
  if (fails.length) { console.error('FAIL ' + fails.join('; ')); process.exit(1); }
  console.log('ALL PASS'); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
