// usage: node tests/world.test.js Shardfall_v0.21.html — runs the world simulation core (SIM, src/world.js) with no browser.
// Living World Phase 1: stable actor ids, archetype → controller → components, the bounded event log, seeded streams, save state.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.21.html', 'utf8');
const src = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(t => t.includes('SIM.VERSION'));
const m = { exports: {} }; new Function('module', 'globalThis', src)(m, {}); const SIM = m.exports;
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', msg); };
const throws = (fn, msg) => { let t = false; try { fn(); } catch (e) { t = true; } eq(t, true, msg); };

// ---- identifiers
let ids = SIM.newIds();
eq([ids.named('npc', 'Odile, banker'), ids.named('npc', 'Quay warden'), ids.named('npc', 'Quay warden'), ids.named('npc', 'Quay warden')],
  ['npc:odile-banker', 'npc:quay-warden', 'npc:quay-warden-2', 'npc:quay-warden-3'], 'named ids are slugs; repeats get a suffix in placement order');
eq(SIM.slug('Sister Maud, healer'), 'sister-maud-healer', 'slug');
eq(SIM.slug('Ünä Ëlm'), 'una-elm', 'slug folds accents');
eq([ids.seq('mon:rat'), ids.seq('mon:rat'), ids.seq('mon:boar')], ['mon:rat:1', 'mon:rat:2', 'mon:boar:3'], 'spawned ids number from one counter');
const st = ids.save(); eq(st, { next: 4 }, 'only the counter is saved');
const ids2 = SIM.newIds(st); eq(ids2.seq('mon:rat'), 'mon:rat:4', 'a restored counter never reuses a number');
eq([ids2.claim('player:p1'), ids2.claim('player:p1')], [true, false], 'claim is exclusive');
let all = new Set(); const big = SIM.newIds(); for (let i = 0; i < 5000; i++) all.add(i % 2 ? big.seq('mon:x') : big.named('npc', 'same name'));
eq(all.size, 5000, '5000 mixed ids are unique');

// ---- registry
const reg = SIM.newRegistry(); const a = {}, b = {};
reg.add('x', a); reg.add('x', a); eq(reg.size, 1, 're-adding the same actor is idempotent');
throws(() => reg.add('x', b), 'a second actor with the same id is rejected');
reg.remove('x'); eq([reg.has('x'), reg.get('x')], [false, null], 'removed');

// ---- archetypes, controllers, components
for (const [k, v] of Object.entries(SIM.ARCHETYPES)) eq(SIM.CONTROLLERS.includes(v.ctrl), true, `archetype ${k} → known controller ${v.ctrl}`);
eq(['MonsterAI', 'AnimalAI', 'PetAI', 'SummonAI', 'GuardAI', 'MerchantAI', 'CivilianAI', 'PlayerController'].map(c => SIM.CONTROLLERS.includes(c)), Array(8).fill(true), 'spec controllers present');
eq(SIM.CONTROLLERS.includes('NetworkController'), true, 'a future network controller slots into the same list');
eq([SIM.hasComponent('animal', 'notoriety'), SIM.hasComponent('animal', 'bank'), SIM.hasComponent('animal', 'magic'), SIM.hasComponent('animal', 'vitals')], [false, false, false, true], 'wildlife carries no notoriety, bank or spellbook');
eq([SIM.hasComponent('player', 'bank'), SIM.hasComponent('player', 'notoriety'), SIM.hasComponent('adventurer', 'magic')], [true, true, true], 'players and adventurers carry the full set');
eq(SIM.controllerFor('nonsense'), null, 'unknown archetype has no controller');

// ---- events
let now = 0; const bus = SIM.newBus({ cap: 8, clock: () => now });
throws(() => bus.emit('ActorTeleported', {}), 'unknown event types are rejected');
throws(() => bus.on('Nope', () => { }), 'unknown subscriptions are rejected');
const seen = []; const off = bus.on('ActorDamaged', e => seen.push(e.amount)); let all2 = 0; bus.on('*', () => all2++);
now = 1.23456; const ev = bus.emit('ActorDamaged', { actor: 'mon:rat:1', source: 'player:p1', amount: 7 });
eq([ev.seq, ev.t, ev.type, ev.actor, ev.source], [1, 1.235, 'ActorDamaged', 'mon:rat:1', 'player:p1'], 'events carry seq, simulation time, type and actor ids');
bus.emit('ActorMoved', { actor: 'mon:rat:1' }); eq([bus.size, all2], [1, 2], 'movement reaches listeners but is never kept');
for (let i = 0; i < 20; i++) bus.emit('ActorDamaged', { amount: i });
eq(bus.size, 8, 'the kept log is bounded by its cap');
eq(bus.recent().map(e => e.amount), [12, 13, 14, 15, 16, 17, 18, 19], 'the ring keeps the newest records, oldest first');
eq(bus.recent(2).map(e => e.amount), [18, 19], 'recent(k)');
off(); bus.emit('ActorDamaged', { amount: 99 }); eq(seen.length, 21, 'unsubscribed');
eq(bus.counts().ActorDamaged, 22, 'per-type counts include every emission');
const bad = SIM.newBus({ onError: () => { } }); bad.on('*', () => { throw new Error('x'); }); eq(bad.emit('ActorKilled', {}).type, 'ActorKilled', 'a failing listener does not break emission');

// ---- seeded streams
const r1 = SIM.newRng(42), r2 = SIM.newRng(42); const s1 = Array.from({ length: 50 }, r1), s2 = Array.from({ length: 50 }, r2);
eq(s1, s2, 'same seed, same sequence'); eq(s1.every(v => v >= 0 && v < 1), true, 'values in [0, 1)');
const mid = r1.state(), next5 = Array.from({ length: 5 }, r1); const r3 = SIM.newRng(0); r3.setState(mid); eq(Array.from({ length: 5 }, r3), next5, 'a saved state resumes exactly');
const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const g = mulberry(1999), h = SIM.newRng(1999); eq(Array.from({ length: 20 }, g), Array.from({ length: 20 }, h), 'the same generator as the world builder (mulberry32)');
const sa = SIM.stream(1999, 'population'), sb = SIM.stream(1999, 'economy'), sa2 = SIM.stream(1999, 'population');
eq([sa() === sa2(), sa() !== sb()], [true, true], 'named streams are stable and independent');
let rr = SIM.newRng(7), hist = Array(6).fill(0); for (let i = 0; i < 6000; i++) hist[rr.int(1, 6) - 1]++; eq(hist.every(c => c > 850 && c < 1150), true, 'int(1, 6) is roughly uniform');

// ---- one world: adopt, save, restore
now = 0; let Wd = SIM.create({ clock: () => now, seed: 77 });
const pl = {}, g1 = { name: 'Quay warden' }, g2 = { name: 'Quay warden' }, rat = { type: 'rat' };
Wd.adopt(pl, 'player', { id: 'player:p1' }); Wd.adopt(g1, 'guard', { prefix: 'npc', name: g1.name }); Wd.adopt(g2, 'guard', { prefix: 'npc', name: g2.name }); Wd.adopt(rat, 'animal', { prefix: 'mon:rat' });
eq([pl.actorId, g1.actorId, g2.actorId, rat.actorId], ['player:p1', 'npc:quay-warden', 'npc:quay-warden-2', 'mon:rat:1'], 'adopt assigns stable ids');
eq([pl.ctrl, g1.ctrl, rat.ctrl, rat.archetype], ['PlayerController', 'GuardAI', 'AnimalAI', 'animal'], 'adopt assigns the controller');
eq(Wd.adopt(rat, 'animal'), 'mon:rat:1', 're-adopting keeps the id');
throws(() => Wd.adopt({}, 'dragonlord'), 'unknown archetype rejected');
Wd.drop(rat); eq(Wd.reg.has('mon:rat:1'), false, 'drop unregisters');
const saved = JSON.parse(JSON.stringify(Wd.save())); eq(saved, { v: 2, seed: 77, ids: { next: 2 }, clock: { dayMinutes: 120, offset: 9 } }, 'world save state is small and serialisable');
const Wr = SIM.create({ saved, seed: 5 }); const p2 = {}, gg1 = {}, gg2 = {}, rat2 = {};
Wr.adopt(p2, 'player', { id: 'player:p1' }); Wr.adopt(gg1, 'guard', { prefix: 'npc', name: 'Quay warden' }); Wr.adopt(gg2, 'guard', { prefix: 'npc', name: 'Quay warden' }); Wr.adopt(rat2, 'animal', { prefix: 'mon:rat' });
eq([Wr.seed, p2.actorId, gg1.actorId, gg2.actorId, rat2.actorId], [77, 'player:p1', 'npc:quay-warden', 'npc:quay-warden-2', 'mon:rat:2'], 'after a reload: same seed, same named ids, the counter continues');

// ---- inspection (debug only)
const ins = SIM.inspect({ actorId: 'mon:rat:9', archetype: 'animal', ctrl: 'AnimalAI', kind: 'mon', type: 'rat', x: 1.234, y: 2, hp: 5, max: 20, state: 'chase', home: { x: 1, y: 1 }, target: { actorId: 'player:p1' } });
eq([ins.actorId, ins.controller, ins.hp, ins.target, ins.pos], ['mon:rat:9', 'AnimalAI', [5, 20], 'player:p1', { x: 1.23, y: 2 }], 'inspect shows id, controller, vitals and target id');
eq(SIM.inspect(null), null, 'inspect(null)');
eq(JSON.stringify(ins).length < 400, true, 'inspection is plain data');


// ================= Phase 2: fixed step, clock, light, search, travel graph =================
// ---- fixed step
let st2 = SIM.newStepper({ step: .05, maxSteps: 5 }), ticks = 0; const tick = () => ticks++;
eq(st2.advance(.016, tick).steps, 0, 'less than a step: nothing runs');
let rs = 0; for (let i = 0; i < 60; i++) rs += st2.advance(1 / 60, tick).steps; eq([rs, ticks], [20, 20], '60 frames of 1/60 s run exactly 20 steps of 50 ms');
st2.reset(); const a2 = st2.advance(.025, tick); eq(a2.alpha > .4 && a2.alpha < .6, true, 'alpha reports the remainder for interpolation (' + a2.alpha.toFixed(2) + ')');
st2.reset(); ticks = 0; const big2 = st2.advance(3, tick); eq([big2.steps, ticks, big2.dropped > 2.6], [5, 5, true], 'a 3 s stall runs at most 5 steps and drops the rest');
let st3 = SIM.newStepper({ step: .05 }), f1 = 0, f2 = 0; const frames = [.016, .017, .033, .05, .001, .1, .02]; for (const d of frames) st3.advance(d, () => f1++);
const st4 = SIM.newStepper({ step: .05 }); st4.advance(frames.reduce((a, b) => a + b, 0), () => f2++); eq(f1, f2, 'the number of steps depends on elapsed time, not on how frames were sliced');

// ---- clock
let ck = SIM.newClock(); eq([SIM.fmtHour(ck.hourAt(0)), ck.dayMinutes, ck.secondsPerHour()], ['09:00', 120, 300], 'a new world starts at 09:00 on a 120-minute day (5 real minutes per hour)');
eq(SIM.fmtHour(ck.hourAt(300)), '10:00', 'one hour = 300 simulation seconds');
eq([ck.hourAt(7200) === ck.hourAt(0), ck.dayAt(0), ck.dayAt(7200)], [true, 1, 2], 'a full day is 7200 s; the day counter advances');
eq(['00:00', '04:59', '05:00', '06:59', '07:00', '16:59', '17:00', '18:59', '19:00', '23:59'].map(t => { const [h, m] = t.split(':').map(Number); return SIM.periodOf(h + m / 60); }),
  ['deepnight', 'deepnight', 'dawn', 'dawn', 'day', 'day', 'sunset', 'sunset', 'night', 'night'], 'periods: deep night, dawn, daylight, sunset, night (§5 table)');
ck.setHour(5000, 21.5); eq([SIM.fmtHour(ck.hourAt(5000)), ck.periodAt(5000)], ['21:30', 'night'], 'set the time without moving simulation time');
eq(SIM.fmtHour(ck.hourAt(5000 + 300)), '22:30', 'and it keeps running from there');
const ck2 = SIM.newClock(JSON.parse(JSON.stringify(ck.save()))); eq(SIM.fmtHour(ck2.hourAt(5300)), '22:30', 'the clock survives save and load');
ck2.setDayMinutes(5300, 24); eq([SIM.fmtHour(ck2.hourAt(5300)), SIM.fmtHour(ck2.hourAt(5360))], ['22:30', '23:30'], 'changing the day length keeps the current hour');

// ---- light
const L = h => SIM.lightAt(h); let maxD = 0, maxStep = 0, prev = L(0).dark; for (let m = 1; m <= 1440; m++) { const d = L(m / 60).dark; maxD = Math.max(maxD, d); maxStep = Math.max(maxStep, Math.abs(d - prev)); prev = d; }
eq([L(12).dark, L(9).dark, +L(1).dark.toFixed(2), maxD <= .62], [0, 0, .62, true], 'noon is clear; deep night at most .62 so the world stays readable');
eq(maxStep < .02, true, 'no jump larger than .02 between consecutive minutes (smooth transitions)');
const warm = c => c[0] > c[2] + 20; eq([warm(L(6.4).col), warm(L(17.8).col), L(1).col[2] > L(1).col[0]], [true, true, true], 'dawn and sunset are warm, night is blue');
eq([L(5.6).dark > L(6.6).dark, L(18).dark < L(19.5).dark], [true, true], 'brightening at dawn, darkening through sunset');

// ---- grid search
const grid = rows => ({ W: rows[0].length, H: rows.length, pass: (x, y) => y >= 0 && x >= 0 && y < rows.length && x < rows[0].length && rows[y][x] !== '#' });
let gm = grid(['..........', '.########.', '.#......#.', '.#.####.#.', '...#..#...', '.###..####', '..........']);
let fp = SIM.findPath({ sx: 0, sy: 0, gx: 4, gy: 4, passable: gm.pass, maxNodes: 1000 });
eq([fp.status, fp.path[0], fp.path[fp.path.length - 1]], ['found', [0, 0], [4, 4]], 'A* finds a way through a maze');
eq(fp.path.every(([x, y]) => gm.pass(x, y)), true, 'every step is on open ground');
eq(fp.path.every((p, i) => !i || Math.max(Math.abs(p[0] - fp.path[i - 1][0]), Math.abs(p[1] - fp.path[i - 1][1])) === 1), true, 'steps are neighbours');
let corner = grid(['.#', '#.']); eq(SIM.findPath({ sx: 0, sy: 0, gx: 1, gy: 1, passable: corner.pass }).status, 'failed', 'no cutting between two blocked corners');
let walled = grid(['..#..', '..#..', '..#..']); const wf = SIM.findPath({ sx: 0, sy: 0, gx: 4, gy: 0, passable: walled.pass }); eq([wf.status, wf.reason], ['failed', 'unreachable'], 'unreachable goal reported');
const open = (x, y) => x >= 0 && y >= 0 && x < 200 && y < 200; const bud = SIM.findPath({ sx: 0, sy: 0, gx: 199, gy: 199, passable: (x, y) => open(x, y) && !(x === 100 && y < 199), maxNodes: 300 });
eq([bud.status, bud.reason, bud.expanded <= 300], ['failed', 'budget', true], 'the node budget is honoured');
const sl = SIM.newSearch({ sx: 0, sy: 0, gx: 60, gy: 0, passable: (x, y) => open(x, y) && !(x === 30 && y < 40) }); let slices = 0; while (sl.step(50) === 'running') slices++;
eq([sl.status, slices > 3], ['found', true], 'a search can run in slices across ticks (' + slices + ' slices)');
const roadCost = (x, y) => y === 5 ? .6 : 1; const rp = SIM.findPath({ sx: 0, sy: 0, gx: 40, gy: 0, passable: open, cost: roadCost, minCost: .6 });
eq(rp.path.some(([, y]) => y === 5), true, 'cheaper road tiles pull the route onto the road');
const gr = SIM.findPath({ sx: 0, sy: 0, gx: 4, gy: 4, passable: (x, y) => open(x, y) && !(x === 4 && y === 4), goalR: 1.5 }); eq([gr.status, Math.hypot(gr.path.at(-1)[0] - 4, gr.path.at(-1)[1] - 4) <= 1.5], ['found', true], 'a blocked goal is reached within goalR');
const lineClear = (ax, ay, bx, by) => { const n = Math.ceil(Math.hypot(bx - ax, by - ay) * 4); for (let i = 0; i <= n; i++) if (!gm.pass(Math.round(ax + (bx - ax) * i / n), Math.round(ay + (by - ay) * i / n))) return false; return true; };
const sm = SIM.smoothPath(fp.path, lineClear); eq([sm.length < fp.path.length, sm[0], sm.at(-1)], [true, [0, 0], [4, 4]], 'smoothing keeps the ends and drops straight runs (' + fp.path.length + ' → ' + sm.length + ')');
eq(sm.every((p, i) => !i || lineClear(sm[i - 1][0], sm[i - 1][1], p[0], p[1])), true, 'every smoothed leg is clear');

// ---- travel graph
const NG = SIM.newNavGraph(); NG.addNode('a', { x: 0, y: 0 }); NG.addNode('b', { x: 10, y: 0 }); NG.addNode('c', { x: 20, y: 0 }); NG.addNode('d', { x: 500, y: 0 }); NG.addNode('e', { x: 510, y: 0 });
NG.addEdge('a', 'b'); NG.addEdge('b', 'c'); NG.addEdge('c', 'd', { kind: 'travel', cost: 30, via: 'gate' }); NG.addEdge('d', 'e'); NG.addEdge('a', 'e', { cost: 1000 });
const rt = NG.route('a', 'e'); eq([rt.cost, rt.legs.map(l => l.to), rt.legs.map(l => l.kind)], [60, ['b', 'c', 'd', 'e'], ['walk', 'walk', 'travel', 'walk']], 'Dijkstra prefers the gate over the long walk');
eq(NG.route('e', 'a').legs.map(l => l.to), ['d', 'c', 'b', 'a'], 'edges run both ways');
NG.addNode('z', { x: 9, y: 9 }); eq(NG.route('a', 'z'), null, 'no route to an isolated node');
eq(NG.nearest(498, 3).id, 'd', 'nearest node');
const lru = SIM.newLRU(2); lru.set(1, 'a'); lru.set(2, 'b'); lru.get(1); lru.set(3, 'c'); eq([lru.get(1), lru.get(2), lru.get(3), lru.size], ['a', undefined, 'c', 2], 'LRU evicts the least recently used');
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
