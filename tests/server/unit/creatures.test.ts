/* Server Creatures v1: the exported population, the world clock, spawning, footing, senses and choices, tiers, interest. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path = require('node:path');
import COL = require('../../../shared/collision');
import MV = require('../../../shared/movement');
import adapter = require('../../../shared/game-rules-adapter');
import { loadTerrain } from '../../../server/src/world/terrain';
import { loadPopulation, worldClock, CLOCK_EPOCH_MS, ACTIVE_RADIUS, type Creature } from '../../../server/src/world/creatures';
import { World, type Actor } from '../../../server/src/world/world';

const ROOT = path.join(__dirname, '..', '..', '..');
const T = loadTerrain(ROOT); const DATA = loadPopulation(ROOT, T); const SIM = adapter.loadSim();
const R = adapter.load(); const SF = R.SF; const CR = SF.CREATION;
const ch = () => { const v = R.validateCreation({ name: 'Tess', look: CR.defaultLook('male'), str: 45, dex: 25, int: 10, skills: [['swordsmanship', 50], ['tactics', 30], ['healing', 20]], town: 'quay' }); const b = R.buildCharacter(v.value);
  return R.characterFromRows({ name: b.name, str: b.str, dex: b.dex, int: b.int, skills: b.skills, stat_locks: b.statLocks, appearance: b.appearance }, b.items.map((i, n) => Object.assign({ id: 'i' + n }, i))); };
const ctx = MV.ctxFor(SF, ch());
const at = (hour: number) => () => CLOCK_EPOCH_MS + (((hour - 9) % 24 + 24) % 24) * 300_000;   // 120-minute day: 300 s per game hour
const info = (name: string) => ({ characterId: name, name, body: 'male', appearance: {}, title: null, town: 'quay', equip: {} });
function world(hour = 12, seed = 1999) {
  const w = new World(T, { creatures: { data: DATA, sim: SIM, clock: worldClock(SIM, at(hour)), seed } });
  const out: [Actor, string, any][] = []; w.setSink((a, t, p) => out.push([a, t, p])); return { w, out };
}
const join = (w: World, name: string, x: number, y: number) => w.add({ characterId: name, accountId: 'acc-' + name, realmId: 'realm', info: info(name), position: { x, y }, stam: ctx.stamMax, ctx }).actor;
const pop = (w: World) => w.populations.get('realm')!;
const dist = (a: { s: { x: number; y: number } }, b: { s: { x: number; y: number } }) => Math.hypot(a.s.x - b.s.x, a.s.y - b.s.y);
/* a creature-standable open patch at least `r` tiles around, away from protected ground, found by search so the test follows the map */
const stand = (x: number, y: number) => COL.canStand(T.world, x, y) && !(DATA.ground[Math.floor(y) * T.world.W + Math.floor(x)] & 1);
const sees = (ax: number, ay: number, bx: number, by: number) => { const n = Math.ceil(Math.hypot(bx - ax, by - ay) / .25); for (let i = 1; i < n; i++) if (DATA.sightBlock[COL.tileAt(T.world, Math.floor(ax + (bx - ax) * i / n), Math.floor(ay + (by - ay) * i / n))]) return false; return true; };
function openPatch(_w: World | null, r: number, from = [700, 400]) {
  for (let y = from[1]; y < 1400; y += 7) for (let x = from[0]; x < 2500; x += 9) {
    let ok = true; for (let k = 0; k < 24 && ok; k++) { const a = k / 24 * 6.283; for (const d of [r * .33, r * .66, r]) ok = ok && stand(x + Math.cos(a) * d, y + Math.sin(a) * d); }
    if (ok && sees(x - r, y, x + r, y) && sees(x, y - r, x, y + r)) return { x, y };
  }
  throw new Error('no open patch');
}
const keyOf = (type: string) => { const s = DATA.spawners.find(o => o.type === type); assert.ok(s, 'a ' + type + ' spawner exists'); return s!.key; };

test('the exported population matches the world: species, spawners, ground mask and sight-blocking tiles', () => {
  assert.equal(DATA.world, T.hash); assert.equal(DATA.ground.length, T.world.W * T.world.H);
  assert.ok(DATA.spawners.length > 300, 'spawners: ' + DATA.spawners.length);
  for (const s of DATA.spawners) { const d = DATA.species[s.type]; assert.ok(d && d.speed > 0 && d.hp > 0 && d.aggro > 0 && d.leash > 0, s.key); assert.ok(s.max >= 1 && s.r > 0, s.key); }
  for (const t of ['hare', 'deer', 'boar', 'hound', 'dire_wolf', 'rat', 'skeleton']) assert.ok(DATA.species[t], t);
  assert.equal(DATA.species.hare.temper, 'timid'); assert.equal(DATA.species.hound.temper, 'hostile'); assert.equal(DATA.species.boar.temper, 'territorial');
  assert.ok(new Set(DATA.spawners.map(s => s.key)).size === DATA.spawners.length, 'spawner keys are unique');
  let prot = 0; for (const v of DATA.ground) if (v & 1) prot++; assert.ok(prot > 1000, 'protected ground exists');
  const spawn = T.spawns.quay; assert.equal(DATA.ground[Math.floor(spawn.y) * T.world.W + Math.floor(spawn.x)] & 1, 1, 'Saltmarsh Quay is protected ground');
  assert.ok(DATA.sightBlock.some(v => v === 1), 'some tiles block sight');
});

test('the world clock: one time of day for everyone from the wall clock, a 120-minute day, the game’s periods and light', () => {
  const c9 = worldClock(SIM, () => CLOCK_EPOCH_MS); assert.equal(c9.hour(), 9); assert.equal(c9.period(), 'day'); assert.equal(c9.dayMinutes, 120);
  const cDay = worldClock(SIM, () => CLOCK_EPOCH_MS + 7_200_000); assert.ok(Math.abs(cDay.hour() - 9) < 1e-9, 'a full game day later it is 09:00 again');
  assert.equal(worldClock(SIM, at(23)).period(), 'night'); assert.equal(worldClock(SIM, at(2)).period(), 'deepnight'); assert.equal(worldClock(SIM, at(18)).period(), 'sunset');
  assert.ok(worldClock(SIM, at(23)).dark() > worldClock(SIM, at(12)).dark(), 'night is darker than noon');
});

test('the first character fills the realm: every creature on creature-standable open ground, within its spawner’s cap, out of the player’s close sight', () => {
  const { w } = world(); const a = join(w, 'Fill', 330, 300); const p = pop(w);
  assert.ok(p.creatures.size > 600, 'creatures: ' + p.creatures.size); assert.equal(w.stats.creatures, p.creatures.size);
  const per = new Map<string, number>();
  for (const c of p.creatures) {
    assert.ok(p.stand(c.s.x, c.s.y), c.type + ' stands'); assert.equal(p.prot(c.s.x, c.s.y), false, c.type + ' not on protected ground');
    per.set(c.sp.key, (per.get(c.sp.key) || 0) + 1); assert.equal(c.hp, c.max); assert.equal(c.hp, DATA.species[c.type].hp);
  }
  for (const s of p.spawners) { assert.equal(per.get(s.key) || 0, s.n, s.key); assert.ok(s.n <= Math.max(s.max, s.nightMax || 0), s.key); }
  for (const c of p.creatures) if (!c.sp.boss) assert.ok(dist(c, a) >= 12 - 1e-9 || c.leader, `${c.type} spawned ${dist(c, a).toFixed(1)} tiles from the player`);
  const nids = new Set([...p.creatures].map(c => c.nid)); assert.equal(nids.size, p.creatures.size); assert.ok(!nids.has(a.nid), 'creatures and characters share one id space');
});

test('creatures only walk where the game lets them: two minutes of life around a walking player never leaves creature footing', () => {
  const { w } = world(); const a = join(w, 'Walker', 330, 300); const p = pop(w);
  for (let i = 0; i < 2400; i++) { if (i % 2 === 0) w.input('Walker', [{ s: i, x: Math.cos(i / 300), y: Math.sin(i / 300), w: 1 }]); w.step(); }
  for (const c of p.creatures) { assert.ok(p.stand(c.s.x, c.s.y), `${c.type} at ${c.s.x},${c.s.y}`); assert.ok(Number.isInteger(c.s.sect) && c.s.sect >= 0 && c.s.sect < 8); }
  assert.ok(p.stats.thinks > 1000, 'creatures near the player thought: ' + p.stats.thinks);
  assert.ok(a.s.x !== 330 || a.s.y !== 300);
});

test('tiers: creatures far from every player wait unchanged; near ones live', () => {
  const { w } = world(); join(w, 'Here', 330, 300); const p = pop(w);
  const before = new Map([...p.creatures].map(c => [c, `${c.s.x},${c.s.y}`]));
  for (let i = 0; i < 600; i++) w.step();
  let farMoved = 0, nearMoved = 0;
  for (const c of p.creatures) { const moved = before.has(c) && before.get(c) !== `${c.s.x},${c.s.y}`; const d = Math.hypot(c.s.x - 330, c.s.y - 300);
    if (d > ACTIVE_RADIUS + 32) { if (moved) farMoved++; } else if (moved) nearMoved++; }
  assert.equal(farMoved, 0, 'nothing beyond the active radius moved'); assert.ok(nearMoved > 0, 'something near the player moved');
  assert.ok(p.stats.active > 0 && p.stats.active < p.creatures.size / 4, 'active ' + p.stats.active);
});

test('a timid hare bolts from a player who comes close, then calms down and goes home', () => {
  const { w } = world(12); const o = openPatch(w, 14); const a = join(w, 'Startle', o.x + 4, o.y); const p = pop(w); p.clear();
  const hare = p.spawnAt(keyOf('hare'), o.x, o.y)!; assert.ok(hare);
  for (let i = 0; i < 30; i++) w.step();
  assert.equal(hare.state, 'flee', hare.why); assert.ok(dist(hare, a) > 4.5, 'it ran away: ' + dist(hare, a).toFixed(2));
  assert.ok(hare.speed > DATA.species.hare.speed, 'at a run (game units): ' + hare.speed);
  join(w, 'Watcher', o.x - 30, o.y); w.remove('Startle');   // someone farther off keeps the place alive (tiers) without scaring it
  for (let i = 0; i < 1200 && (hare.state as string) !== 'idle'; i++) w.step();
  assert.equal(hare.state, 'idle'); assert.ok(Math.hypot(hare.s.x - o.x, hare.s.y - o.y) < 1.3, 'back home');
});

test('a hostile hound stalks a player it sees, closes to striking distance, and gives up past its leash (a world without combat: its blows land on nobody)', () => {
  const { w } = world(20); const o = openPatch(w, 14); const a = join(w, 'Prey', o.x + 6, o.y); const p = pop(w); p.clear();
  const hound = p.spawnAt(keyOf('hound'), o.x, o.y)!; const d = DATA.species.hound;
  for (let i = 0; i < 80; i++) w.step();
  assert.ok(['stalk', 'tele', 'rec'].includes(hound.state), hound.state + ': ' + hound.why); assert.equal(hound.target, a.nid);
  assert.ok(dist(hound, a) <= (d.reach || 1.2) * .9 + .2, 'closed to striking distance: ' + dist(hound, a).toFixed(2));
  for (let i = 0; i < 40; i++) w.step(); assert.ok(dist(hound, a) >= .5, 'holds, does not walk through the player');
  assert.equal(hound.hp, hound.max);
  // the player walks away: past the leash the hound turns back for home
  let s = 0; for (let i = 0; i < 1600 && ['stalk', 'tele', 'rec'].includes(hound.state); i++) { if (i % 1 === 0) w.input('Prey', [{ s: s++, x: 1, y: 0, w: 1, r: true }]); w.step(); }
  assert.ok(!['stalk', 'tele', 'rec'].includes(hound.state), 'gave up'); assert.ok(Math.hypot(hound.s.x - o.x, hound.s.y - o.y) <= (d.pur || d.leash) + 1, 'never farther from home than its pursuit limit');
});

test('protected ground is safe: a player standing in town is never stalked, and a creature never follows onto it', () => {
  const { w } = world(20); const q = T.spawns.quay; const a = join(w, 'Townie', q.x, q.y); const p = pop(w); p.clear();
  let spot: { x: number; y: number } | null = null;   // the nearest open ground outside the protected area, west-east search from the spawn
  for (let r = 4; r < 60 && !spot; r += .5) for (let k = 0; k < 32 && !spot; k++) { const x = q.x + Math.cos(k / 32 * 6.283) * r, y = q.y + Math.sin(k / 32 * 6.283) * r; if (p.stand(x, y) && p.los(x, y, q.x, q.y)) spot = { x, y }; }
  assert.ok(spot, 'open ground near the quay'); const rat = p.spawnAt(keyOf('rat'), spot!.x, spot!.y)!;
  for (let i = 0; i < 400; i++) { w.step(); assert.equal(p.prot(rat.s.x, rat.s.y), false); }
  assert.notEqual(rat.state, 'stalk', 'nobody stalks a player on protected ground');
  assert.equal(p.prot(a.s.x, a.s.y), true);
});

test('interest: creatures near a player are announced as creatures with their species and health, move in state, and leave when out of range', () => {
  const { w, out } = world(12); const o = openPatch(w, 14); join(w, 'Eyes', o.x, o.y); const p = pop(w); p.clear();
  const near = p.spawnAt(keyOf('deer'), o.x + 8, o.y)!; const far = p.spawnAt(keyOf('deer'), o.x + 8, o.y)!;
  far.s.x = Math.min(T.world.W - 5, o.x + 120); far.home = { ...far.s }; // placed far away by hand (still on its own ground or not: it never moves while dormant)
  out.length = 0; for (let i = 0; i < 4; i++) w.step();
  const enters = out.filter(m => m[1] === 'actor.enter').map(m => m[2]);
  const e = enters.find(x => x.nid === near.nid); assert.ok(e, 'the near deer is announced');
  assert.deepEqual({ kind: e.kind, type: e.type, name: e.name, hp: e.hp, max: e.max }, { kind: 'creature', type: 'deer', name: DATA.species.deer.n, hp: DATA.species.deer.hp, max: DATA.species.deer.hp });
  assert.equal(enters.some(x => x.nid === far.nid), false, 'the far one is not');
  assert.deepEqual(Object.keys(e).sort(), ['hp', 'kind', 'max', 'name', 'nid', 'sect', 'speed', 'type', 'x', 'y'], 'only the public face, no server internals');
  const sid = near.nid; out.length = 0; near.s.x += 0.01; near.changed = true;
  w.step(); assert.ok(out.some(m => m[1] === 'state'), 'state sent');
  near.s.x = o.x + 80; w.step(); w.step(); assert.ok(out.some(m => m[1] === 'actor.leave' && m[2].nid === sid), 'leaving the radius drops it');
});

test('graveyards: extra dead rise at night and sink at dawn out of sight', () => {
  const g = DATA.spawners.find(s => s.nightMax && s.nightMax > s.max); assert.ok(g, 'a graveyard spawner');
  const night = world(23); join(night.w, 'Night', 330, 300); const sn = pop(night.w).spawners.find(s => s.key === g!.key)!;
  const day = world(12); join(day.w, 'Day', 330, 300); const sd = pop(day.w).spawners.find(s => s.key === g!.key)!;
  assert.ok(sn.n > sd.n || sn.n === sn.nightMax, `night ${sn.n} vs day ${sd.n} (caps ${g!.max}/${g!.nightMax})`); assert.ok(sd.n <= g!.max);
});

test('the same realm, seed and inputs give the same creatures (determinism)', () => {
  const run = () => { const { w } = world(12, 77); join(w, 'Det', 330, 300); for (let i = 0; i < 400; i++) { if (i % 2 === 0) w.input('Det', [{ s: i, x: 1, y: 0, w: 1 }]); w.step(); } return [...pop(w).creatures].map(c => `${c.type}:${c.s.x.toFixed(6)},${c.s.y.toFixed(6)}:${c.state}`).sort().join('|'); };
  assert.equal(run(), run());
});

test('without creatures configured the world is the movement world: no population, no clock', () => {
  const w = new World(T, {}); w.add({ characterId: 'x', accountId: 'a', realmId: 'realm', info: info('x'), position: { x: 330, y: 300 }, stam: ctx.stamMax, ctx });
  assert.equal(w.populations.size, 0); assert.equal(w.clockInfo(), null); w.step();
});

test('a creature step is cheap: 120 players spread over the map, one tick under 8 ms on average', () => {
  const { w } = world(12); const pts: [number, number][] = []; const p0 = (join(w, 'P0', 330, 300), pop(w));
  for (let i = 1; i < 120; i++) { const sp = DATA.spawners[(i * 37) % DATA.spawners.length]; const q = COL.nearestStand(T.world, sp.x, sp.y, 12); if (q) pts.push([q.x, q.y]); }
  pts.forEach(([x, y], i) => join(w, 'P' + (i + 1), x, y));
  const t0 = performance.now(); for (let i = 0; i < 200; i++) w.step(); const avg = (performance.now() - t0) / 200;
  assert.ok(avg < 8, 'average tick ' + avg.toFixed(2) + ' ms with ' + p0.creatures.size + ' creatures, ' + w.stats.creaturesActive + ' active');
});
