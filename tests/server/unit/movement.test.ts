/* Movement: shared/movement.js + shared/collision.js on the exported game world, and the world loop's rules (credit, interest). */
import test from 'node:test';
import assert from 'node:assert/strict';
import path = require('node:path');
import COL = require('../../../shared/collision');
import MV = require('../../../shared/movement');
import adapter = require('../../../shared/game-rules-adapter');
import { loadTerrain } from '../../../server/src/world/terrain';
import { World, type Actor } from '../../../server/src/world/world';

const ROOT = path.join(__dirname, '..', '..', '..');
const T = loadTerrain(ROOT); const W = T.world;
const R = adapter.load(); const SF = R.SF; const CR = SF.CREATION;
const ch = () => { const v = R.validateCreation({ name: 'Tess', look: CR.defaultLook('male'), str: 45, dex: 25, int: 10, skills: [['swordsmanship', 50], ['tactics', 30], ['healing', 20]], town: 'quay' }); const b = R.buildCharacter(v.value);
  return R.characterFromRows({ name: b.name, str: b.str, dex: b.dex, int: b.int, skills: b.skills, stat_locks: b.statLocks, appearance: b.appearance }, b.items.map((i, n) => Object.assign({ id: 'i' + n }, i))); };
const ctx = MV.ctxFor(SF, ch());
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;
/* a straight east-west strip of open ground (found by search, so the test follows the map) */
function openStrip(len: number) { for (let y = 300; y < 1400; y += 3) for (let x = 700; x < 2500; x += 5) { let ok = true; for (let k = 0; k <= len * 4 && ok; k++) ok = COL.canStand(W, x + k / 4, y + .5) && COL.tileAt(W, Math.floor(x + k / 4), Math.floor(y + .5)) !== MV.SHALLOWS; if (ok) return { x, y: y + .5 }; } throw new Error('no open strip'); }

test('the exported world loads, matches its manifest, and every town spawn is standable', () => {
  assert.equal(W.W, 2620); assert.equal(W.H, 1520); assert.match(T.hash, /^[0-9a-f]{8}$/);
  for (const [town, s] of Object.entries(T.spawns)) assert.ok(COL.canStand(W, s.x, s.y), town);
  assert.equal(COL.canStand(W, -5, -5), false, 'outside the map is water');
  assert.equal(COL.hash(COL.decode(COL.encode(W))), T.hash, 'encode/decode round trip');
});

test('walk and sprint speeds are the game’s: 4.1 and 5.3 m/s × 1.5 tiles per metre', () => {
  const p = openStrip(9); const s = { x: p.x, y: p.y, stam: ctx.stamMax, sect: 0, t: 0, lastDrain: -99 };
  for (let i = 0; i < 20; i++) MV.step(W, s, { x: 1, y: 0, want: 1 }, ctx, COL);
  assert.ok(near(s.x - p.x, 4.1 * 1.5 * (1 - ctx.armourSpd) * ctx.enc.speed, 1e-9), 'walked ' + (s.x - p.x));
  const q = { x: p.x, y: p.y, stam: ctx.stamMax, sect: 0, t: 0, lastDrain: -99 };
  for (let i = 0; i < 20; i++) MV.step(W, q, { x: 1, y: 0, want: 1, sprint: true }, ctx, COL);
  assert.ok(near(q.x - p.x, 5.3 * 1.5 * (1 - ctx.armourSpd) * ctx.enc.speed, 1e-9), 'sprinted ' + (q.x - p.x));
  assert.ok(near(q.stam, ctx.stamMax - SF.SPRINT_DRAIN * ctx.enc.stam * 1, 1e-9), 'one second of sprint drains SPRINT_DRAIN');
  const g = { x: p.x, y: p.y, stam: ctx.stamMax, sect: 0, t: 0 }; for (let i = 0; i < 20; i++) MV.step(W, g, { x: 1, y: 0, want: .2 }, ctx, COL);
  assert.ok(near(g.x - p.x, 4.1 * 1.5 * .6 * (1 - ctx.armourSpd) * ctx.enc.speed, 1e-9), 'a light push walks at 60 %');
});

test('no stamina, no sprint; stamina comes back after the delay', () => {
  const p = openStrip(9); const s = { x: p.x, y: p.y, stam: 0, sect: 0, t: 0, lastDrain: 0 };
  for (let i = 0; i < 10; i++) MV.step(W, s, { x: 1, y: 0, want: 1, sprint: true }, ctx, COL);
  assert.ok(near(s.x - p.x, 4.1 * 1.5 * .5 * (1 - ctx.armourSpd) * ctx.enc.speed, 1e-9), 'walks, does not sprint');
  assert.equal(s.stam, 0, 'no regeneration within the delay');
  for (let i = 0; i < 20; i++) MV.step(W, s, { x: 0, y: 0, want: 0 }, ctx, COL);
  assert.ok(s.stam > 0, 'regenerating after the delay');
});

test('walls, water and trees cannot be crossed: every step ends where a body can stand', () => {
  let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const town of Object.keys(T.spawns)) {
    const sp = T.spawns[town]; const s = { x: sp.x, y: sp.y, stam: ctx.stamMax, sect: 0, t: 0 };
    for (let i = 0; i < 4000; i++) { const a = Math.floor(i / 40) * 2.4 + rnd(); MV.step(W, s, { x: Math.cos(a), y: Math.sin(a), want: 1, sprint: rnd() < .5 }, ctx, COL); assert.ok(COL.canStand(W, s.x, s.y), town + ' step ' + i); }
  }
});

test('intents are only intents: bad numbers stop, long vectors are cut to unit length', () => {
  assert.deepEqual(MV.cleanInput({ x: NaN, y: 1, want: 1 }), { x: 0, y: 0, want: 0, sprint: false });
  assert.deepEqual(MV.cleanInput({ x: 1000, y: 0, want: 50 }), { x: 1, y: 0, want: 1, sprint: false });
  assert.deepEqual(MV.cleanInput(null), { x: 0, y: 0, want: 0, sprint: false });
});

test('too heavy to move: no movement at all', () => {
  const c = ch(); c.pack.items.push({ id: 'ore', qty: 100000 }); const heavy = MV.ctxFor(SF, c);
  assert.equal(heavy.enc.speed, 0); const p = openStrip(3); const s = { x: p.x, y: p.y, stam: 10, sect: 0, t: 0 };
  MV.step(W, s, { x: 1, y: 0, want: 1 }, heavy, COL); assert.equal(s.x, p.x);
});

test('facing follows the game: 8 sectors, kept within 27.5°', () => {
  assert.equal(MV.facing(undefined, 1, 1), 0); assert.equal(MV.facing(0, .1, .1), 0, 'too slow to turn');
  assert.equal(MV.facing(0, 1, .7), 0, 'within the hysteresis');
  assert.equal(MV.facing(0, -1, -1), 4);
});

function world(radius = 40) { const w = new World(T, { viewRadius: radius }); const out: [Actor, string, any][] = []; w.setSink((a, t, p) => out.push([a, t, p])); return { w, out }; }
const info = (n: string) => ({ characterId: n, name: n, body: 'male', appearance: {}, title: null, town: 'quay', equip: {} });
const add = (w: World, id: string, x: number, y: number) => w.add({ characterId: id, accountId: 'acc-' + id, realmId: 'anniabreen', info: info(id), position: { x, y }, stam: 50, ctx }).actor;

test('at most one intent per tick on average; a short stall may catch up three; a flood is dropped', () => {
  const { w } = world(); const p = openStrip(12); const a = add(w, 'a', p.x, p.y);
  w.input('a', Array.from({ length: 10 }, (_, i) => ({ s: i, x: 1, y: 0, w: 1 }))); w.step();
  assert.equal(a.acked, 0, 'one intent in the first tick');
  for (let i = 0; i < 5; i++) w.step();   // the queue drains at one per tick (credit catches up to 3 at most)
  const x6 = a.s.x; assert.ok(a.acked >= 5 && a.acked <= 8);
  const before = w.stats.inputsDropped; w.input('a', Array.from({ length: 30 }, (_, i) => ({ s: 100 + i, x: 1, y: 0, w: 1 }))); assert.ok(w.stats.inputsDropped > before, 'queue bounded');
  w.input('a', [{ s: 3, x: -1, y: 0, w: 1 }]); assert.ok(w.stats.inputsLate > 0, 'old sequence numbers are ignored');
  for (let i = 0; i < 40; i++) w.step();
  const walked = a.s.x - p.x; const max = 4.1 * 1.5 * .05 * (w.stats.ticks);
  assert.ok(walked <= max + 1e-9, `never faster than real time: ${walked} ≤ ${max}`); assert.ok(a.s.x > x6);
});

test('interest: near characters are announced, far ones are not, and leaving the radius drops them', () => {
  const { w, out } = world(10); const p = openStrip(12);
  const a = add(w, 'a', p.x, p.y), b = add(w, 'b', p.x + 5, p.y), c = add(w, 'c', p.x + 200, p.y);
  w.step();
  const enters = (v: Actor) => out.filter(([x, t]) => x === v && t === 'actor.enter').map(([, , q]) => q.characterId);
  assert.deepEqual(enters(a), ['b']); assert.deepEqual(enters(b), ['a']); assert.deepEqual(enters(c), []);
  const st = out.filter(([x, t]) => x === a && t === 'state').pop()![2]; assert.equal(st.you.nid, a.nid); assert.ok(Number.isFinite(st.you.x));
  out.length = 0; b.s.x = p.x + 30; b.dirty = true; (w as any).place(b); w.step();
  assert.ok(out.some(([x, t, q]) => x === a && t === 'actor.leave' && q.nid === b.nid));
  out.length = 0; w.remove('a'); assert.equal(out.length, 0, 'b no longer knew a');
});
