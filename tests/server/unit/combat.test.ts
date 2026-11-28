/* Server Combat v1: the swing and the blow on the game's rules, and fights in the world loop — arming, the swing timer, reach,
   creatures' telegraph → strike → recover, damage, death as a ghost, resurrection, regeneration, learning. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path = require('node:path');
import COL = require('../../../shared/collision');
import MV = require('../../../shared/movement');
import P = require('../../../shared/protocol');
import adapter = require('../../../shared/game-rules-adapter');
import { loadTerrain } from '../../../server/src/world/terrain';
import { loadPopulation, worldClock, CLOCK_EPOCH_MS, type Creature } from '../../../server/src/world/creatures';
import { playerSwing, creatureBlow, weaponOf, monT2A, swingDelay } from '../../../server/src/world/combat';
import { World, COMBAT, type Actor } from '../../../server/src/world/world';

const ROOT = path.join(__dirname, '..', '..', '..');
const T = loadTerrain(ROOT); const DATA = loadPopulation(ROOT, T); const SIM = adapter.loadSim();
const R = adapter.load(); const SF = R.SF; const CR = SF.CREATION;
function fighter(skills: [string, number][] = [['swordsmanship', 50], ['tactics', 30], ['healing', 20]], stats = { str: 45, dex: 25, int: 10 }) {
  const v = R.validateCreation({ name: 'Tess', look: CR.defaultLook('male'), ...stats, skills, town: 'quay' }); assert.ok(v.ok, JSON.stringify(v.errors)); const b = R.buildCharacter(v.value);
  return R.characterFromRows({ name: b.name, str: b.str, dex: b.dex, int: b.int, skills: b.skills, stat_locks: b.statLocks, appearance: b.appearance }, b.items.map((i, n) => Object.assign({ id: 'i' + n }, i)));
}
const lcg = (seed: number) => () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const at = (hour: number) => () => CLOCK_EPOCH_MS + (((hour - 9) % 24 + 24) % 24) * 300_000;
function world(hour = 12) {
  const w = new World(T, { creatures: { data: DATA, sim: SIM, clock: worldClock(SIM, at(hour)), seed: 5 }, combat: { SF, seed: 9 } });
  const out: [Actor, string, any][] = []; w.setSink((a, t, p) => out.push([a, t, p])); return { w, out };
}
const stand = (x: number, y: number) => COL.canStand(T.world, x, y) && !(DATA.ground[Math.floor(y) * T.world.W + Math.floor(x)] & 1);
function openPatch(r: number) {
  for (let y = 400; y < 1400; y += 7) for (let x = 700; x < 2500; x += 9) { let ok = true; for (let k = 0; k < 24 && ok; k++) { const a = k / 24 * 6.283; for (const d of [r * .33, r * .66, r]) ok = ok && stand(x + Math.cos(a) * d, y + Math.sin(a) * d); } if (ok) return { x, y }; }
  throw new Error('no open patch');
}
function join(w: World, name: string, x: number, y: number, ch = fighter(), extra: any = {}) {
  return w.add({ characterId: name, accountId: 'acc-' + name, realmId: 'realm', info: { characterId: name, name, body: 'male', appearance: {}, title: null, town: 'quay', equip: {} }, position: { x, y }, stam: SF.maxStam(ch), ctx: MV.ctxFor(SF, ch), ch, bound: 'quay', ...extra }).actor;
}
const pop = (w: World) => w.populations.get('realm')!;
const keyOf = (type: string) => DATA.spawners.find(o => o.type === type)!.key;
const events = (out: [Actor, string, any][], who: Actor) => out.filter(m => m[0] === who && m[1] === 'combat').map(m => m[2]);

test('protocol v4: target and resurrect are the only new client messages; swings, damage and loot stay refused', () => {
  const ok = (type: string, p: any) => P.parseClient(JSON.stringify({ v: P.PROTOCOL_VERSION, type, p }));
  assert.equal(P.PROTOCOL_VERSION, 4);
  assert.ok(ok('target', { nid: 12 }).ok); assert.ok(ok('target', { nid: null }).ok);
  for (const bad of [{}, { nid: 0 }, { nid: -3 }, { nid: 1.5 }, { nid: '7' }, { nid: 3, dmg: 99 }]) assert.equal(ok('target', bad).ok, false, JSON.stringify(bad));
  assert.ok(ok('resurrect', { at: 'shrine' }).ok); assert.ok(ok('resurrect', { at: 'bound' }).ok); assert.equal(ok('resurrect', { at: 'anywhere' }).ok, false);
  for (const type of ['attack', 'damage', 'loot', 'skill', 'stat']) { const r = ok(type, { nid: 1 }) as any; assert.equal(r.ok, false); assert.equal(r.code, 'not_authoritative'); }
});

test('a swing follows the game’s rules: hit chance SF.hitChance(weapon skill, creature defence), damage from the dice, Tactics, Anatomy, Strength and the creature’s armour', () => {
  const ch = fighter(); const d = DATA.species.boar; const { w } = weaponOf(SF, ch);
  assert.equal(w.skill, 'swordsmanship', 'the kit armed a swordsman with a blade');
  const expect = SF.hitChance(SF.SK.value(ch, 'swordsmanship'), d.def);
  const rng = lcg(42); let hits = 0, n = 4000, dmg = 0, maxD = 0;
  for (let i = 0; i < n; i++) { const c = JSON.parse(JSON.stringify(ch)); const r = playerSwing(SF, c, d, 0, rng, i, 'x'); if (r.hit) { hits++; dmg += r.dmg; maxD = Math.max(maxD, r.dmg); } }
  assert.ok(Math.abs(hits / n - expect) < .03, `hit rate ${(hits / n).toFixed(3)} vs ${expect.toFixed(3)}`);
  const scale = SF.damageScale({ tactics: SF.SK.value(ch, 'tactics'), anatomy: SF.SK.value(ch, 'anatomy'), str: ch.str });
  const top = (w.dice[0] * w.dice[1] + (w.dice[2] || 0)) * scale;
  assert.ok(maxD <= Math.round(top) + 1, `never above the dice × scale (${maxD} vs ${top.toFixed(1)})`);
  assert.ok(dmg / hits < top - monT2A(d).ar / 2 + 1, 'armour takes its share');
});

test('a creature’s blow follows the game’s rules: its damage range, the struck region’s armour, a shield parry, halved for a player', () => {
  const naked = fighter(); for (const s of Object.keys(naked.equip)) naked.equip[s] = null;
  const d = DATA.species.hound, rng = lcg(7); let hits = 0, sum = 0, n = 4000;
  for (let i = 0; i < n; i++) { const r = creatureBlow(SF, d, naked, rng, i, 'x'); if (r.hit) { hits++; sum += r.dmg; } }
  const expectHit = SF.hitChance(d.atk, SF.SK.value(naked, 'wrestling'));
  assert.ok(Math.abs(hits / n - expectHit) < .03, `hit rate ${(hits / n).toFixed(3)} vs ${expectHit.toFixed(3)}`);
  const mid = (d.dmg![0] + d.dmg![1]) / 2 / 2; assert.ok(Math.abs(sum / hits - mid) < 1, `an unarmoured player takes half the creature's damage: ${(sum / hits).toFixed(2)} vs ${mid}`);
  const armoured = fighter(); armoured.equip.shield = SF.newItem('buckler', 1, { cond: 100, maxc: 100 }); armoured.skills.parrying.v = 800;
  let parried = 0, learnt = 0; for (let i = 0; i < 2000; i++) { const r = creatureBlow(SF, d, armoured, rng, i, 'x'); if (r.parried) parried++; if (r.learned.some(l => l.skill === 'parrying')) learnt++; }
  assert.ok(parried > 0, 'a shield parries'); assert.ok(armoured.skills.parrying.v >= 800, 'parrying can only rise');
});

test('a character armed on a creature swings on the swing timer, only in reach, and the creature fights back', () => {
  const { w, out } = world(12); const o = openPatch(12); const a = join(w, 'Blade', o.x, o.y); pop(w).clear();
  const boar = pop(w).spawnAt(keyOf('boar'), o.x + 6, o.y)!; assert.ok(boar);
  assert.equal(w.target('Blade', boar.nid), null); assert.equal(a.armed, boar.nid);
  for (let i = 0; i < 40; i++) w.step();
  assert.equal(events(out, a).filter(e => e.a === a.nid && (e.k === 'hit' || e.k === 'miss')).length, 0, 'out of reach: no swing, still armed'); assert.equal(a.armed, boar.nid);
  // walk up to it
  let s = 0; for (let i = 0; i < 200 && Math.hypot(boar.s.x - a.s.x, boar.s.y - a.s.y) > 1.2; i++) { const dx = boar.s.x - a.s.x, dy = boar.s.y - a.s.y, l = Math.hypot(dx, dy); w.input('Blade', [{ s: s++, x: dx / l, y: dy / l, w: 1 }]); w.step(); }
  out.length = 0; const t0 = w.now; for (let i = 0; i < 200; i++) w.step(); const span = w.now - t0;
  const swings = events(out, a).filter(e => e.a === a.nid && (e.k === 'hit' || e.k === 'miss'));
  const delay = swingDelay(SF, a.ch, a.s.stam);
  assert.ok(swings.length >= 1, 'swung'); assert.ok(swings.length <= Math.floor(span / delay) + 1, `${swings.length} swings in ${span} s at ${delay} s each`);
  assert.ok(events(out, a).some(e => e.a === boar.nid && e.k === 'tele') || boar.state === 'flee' || boar.dead, 'the boar winds up against its attacker (or ran, or died)');
});

test('blows hurt: a creature’s strike lands after its wind-up, health falls, and at 0 the character is a ghost that creatures ignore', () => {
  const { w, out } = world(20); const o = openPatch(12); const naked = fighter([['magery', 50], ['evaluatingintelligence', 30], ['meditation', 20]], { str: 10, dex: 10, int: 60 });
  for (const s of Object.keys(naked.equip)) naked.equip[s] = null;
  const a = join(w, 'Frail', o.x, o.y, naked); pop(w).clear(); const hp0 = a.hp;
  const wolf = pop(w).spawnAt(keyOf('dire_wolf'), o.x + 3, o.y)!;
  let tele = -1, firstHit = -1;
  for (let i = 0; i < 4000 && !a.ghost; i++) { w.step(); for (const e of events(out, a)) { if (e.a === wolf.nid && e.k === 'tele' && tele < 0) tele = w.now; if (e.a === wolf.nid && e.k === 'hit' && firstHit < 0) firstHit = w.now; } out.length = 0; }
  assert.ok(tele >= 0 && firstHit > tele, 'the wind-up comes before the hit'); assert.ok(firstHit - tele >= (DATA.species.dire_wolf.tele || 0) - 1e-9, 'not before its wind-up time');
  assert.ok(a.ghost, 'died'); assert.equal(a.hp, 0); assert.equal(a.armed, 0); assert.equal(a.ctx.ghost, true, 'a ghost cannot sprint (movement context)'); assert.ok(hp0 > 0);
  for (let i = 0; i < 200; i++) w.step();
  assert.ok(!['stalk', 'tele', 'rec'].includes(wolf.state), 'the wolf leaves a ghost alone: ' + wolf.state);
  assert.equal(w.target('Frail', wolf.nid), 'You cannot fight now.');
});

test('resurrection: at a shrine within reach, or back at the bound shrine after the wait, at 25 % health', () => {
  const { w } = world(12); const o = openPatch(12); const a = join(w, 'Spirit', o.x, o.y, fighter(), { ghost: true, hp: 0 });
  assert.ok(a.ghost); assert.equal(a.hp, 0);
  assert.match(w.resurrect('Spirit', 'shrine')!, /shrine/);
  assert.match(w.resurrect('Spirit', 'bound')!, /Wait/);
  for (let i = 0; i < COMBAT.ghostReturn / MV.STEP + 2; i++) w.step();
  assert.equal(w.resurrect('Spirit', 'bound'), null); assert.equal(a.ghost, false); assert.equal(a.ctx.ghost, false);
  const sh = T.shrines.find(s => s.id === 'quay')!; assert.ok(Math.hypot(a.s.x - sh.x - .5, a.s.y - sh.y - .5) < 4, 'at the bound shrine');
  assert.equal(a.hp, Math.ceil(SF.maxHp(a.ch) * .25));
  // die again beside a shrine: restored on the spot
  const b = join(w, 'Pilgrim', sh.x + .5 + 1, sh.y + .5 + 1, fighter(), { ghost: true, hp: 0 });
  assert.equal(w.resurrect('Pilgrim', 'shrine'), null); assert.equal(b.ghost, false); assert.equal(w.resurrect('Pilgrim', 'shrine'), 'You are alive.');
});

test('health comes back slowly out of combat (the game’s unfed rate), never in combat', () => {
  const { w } = world(12); const o = openPatch(12); const a = join(w, 'Rest', o.x, o.y, fighter(), { hp: 20 }); pop(w).clear();
  for (let i = 0; i < 200; i++) w.step();   // 10 s out of combat
  assert.ok(a.hp > 20 && a.hp <= 20 + COMBAT.regenPerSec * 10 + 1e-9, 'regenerated ' + a.hp);
  a.lastCombat = w.now; const h = a.hp; for (let i = 0; i < 40; i++) w.step(); assert.equal(a.hp, h, 'not while in combat');
});

test('fighting teaches by the game’s rules and kills once: the creature dies, its spawner gets a vacancy, the attacker stands down', () => {
  const { w, out } = world(12); const o = openPatch(12); const ch = fighter([['swordsmanship', 50], ['tactics', 50]], { str: 60, dex: 10, int: 10 });
  const a = join(w, 'Slayer', o.x, o.y, ch); pop(w).clear();
  const before = { sw: ch.skills.swordsmanship.v, ta: ch.skills.tactics.v };
  let kills = 0, gains = 0;
  for (let round = 0; round < 6; round++) {
    const hare = pop(w).spawnAt(keyOf('hare'), a.s.x + .9, a.s.y)!; if (!hare) continue; const sp = hare.sp, n0 = sp.n;
    hare.state = 'tele'; hare.st = 1e9;   // hold it still for the test: a hare would bolt
    assert.equal(w.target('Slayer', hare.nid), null);
    for (let i = 0; i < 1200 && !hare.dead; i++) { hare.state = 'tele'; hare.s.x = a.s.x + .9; hare.s.y = a.s.y; w.step(); }
    if (hare.dead) { kills++; assert.equal(sp.n, n0 - 1, 'a vacancy'); assert.equal(pop(w).byNid.has(hare.nid), false); assert.equal(a.armed, 0, 'stood down');
      const deaths = events(out, a).filter(e => e.k === 'death' && e.t === hare.nid); assert.equal(deaths.length, 1, 'dies once'); }
    gains += out.filter(m => m[0] === a && m[1] === 'gain').length; out.length = 0;
  }
  assert.ok(kills >= 4, 'kills ' + kills); assert.ok(gains > 0, 'learned something');
  assert.ok(ch.skills.swordsmanship.v >= before.sw && ch.skills.tactics.v >= before.ta, 'skills never fall from fighting');
  assert.ok(ch.skills.swordsmanship.v > before.sw || ch.skills.tactics.v > before.ta, 'some skill rose');
  assert.ok(a.dirty, 'saved at the next save');
});

test('arming is validated: unknown creatures, bows (no arrows online yet) and ghosts are refused; null stands down', () => {
  const { w } = world(12); const o = openPatch(12); const ch = fighter(); const a = join(w, 'Picky', o.x, o.y, ch); pop(w).clear();
  assert.equal(w.target('Picky', 999999), 'No valid target.'); assert.equal(w.target('Picky', a.nid), 'No valid target.', 'not another character (no PvP in v1)');
  const deer = pop(w).spawnAt(keyOf('deer'), o.x + 3, o.y)!;
  ch.equip.weapon = SF.newItem('shortbow', 1, { cond: 100, maxc: 100 }); assert.match(w.target('Picky', deer.nid)!, /arrows/);
  ch.equip.weapon = null; assert.equal(w.target('Picky', deer.nid), null, 'fists are fine'); assert.equal(w.target('Picky', null), null); assert.equal(a.armed, 0);
  assert.equal(w.target('Nobody', deer.nid), 'Combat is not available.');
});
