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
const saved = JSON.parse(JSON.stringify(Wd.save())); eq(saved, { v: 1, seed: 77, ids: { next: 2 } }, 'world save state is small and serialisable');
const Wr = SIM.create({ saved, seed: 5 }); const p2 = {}, gg1 = {}, gg2 = {}, rat2 = {};
Wr.adopt(p2, 'player', { id: 'player:p1' }); Wr.adopt(gg1, 'guard', { prefix: 'npc', name: 'Quay warden' }); Wr.adopt(gg2, 'guard', { prefix: 'npc', name: 'Quay warden' }); Wr.adopt(rat2, 'animal', { prefix: 'mon:rat' });
eq([Wr.seed, p2.actorId, gg1.actorId, gg2.actorId, rat2.actorId], [77, 'player:p1', 'npc:quay-warden', 'npc:quay-warden-2', 'mon:rat:2'], 'after a reload: same seed, same named ids, the counter continues');

// ---- inspection (debug only)
const ins = SIM.inspect({ actorId: 'mon:rat:9', archetype: 'animal', ctrl: 'AnimalAI', kind: 'mon', type: 'rat', x: 1.234, y: 2, hp: 5, max: 20, state: 'chase', home: { x: 1, y: 1 }, target: { actorId: 'player:p1' } });
eq([ins.actorId, ins.controller, ins.hp, ins.target, ins.pos], ['mon:rat:9', 'AnimalAI', [5, 20], 'player:p1', { x: 1.23, y: 2 }], 'inspect shows id, controller, vitals and target id');
eq(SIM.inspect(null), null, 'inspect(null)');
eq(JSON.stringify(ins).length < 400, true, 'inspection is plain data');

console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
