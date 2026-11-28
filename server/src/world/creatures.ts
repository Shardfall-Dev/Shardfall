/* Server Creatures v1 — the wildlife and monsters of Anniabreen, owned by the server.
   What runs here is the offline game's creature life (src/ecology.js ecoIdle / ecoThink / spawnTick and src/game.js aiMon), for
   the part that exists online before combat does:
     · population: the game's own spawners (server/data/population.json, exported from the build by tools/export-world.py) fill
       at their own pace (the species' respawn time), out of every player's sight, on open ground, never on protected (town)
       ground; packs and herds spawn together behind a leader; graveyards raise extra dead at night and let them sink at dawn;
     · the world clock: one time of day for everyone, from the wall clock (src/world.js SIM.newClock: a 120-minute day), so day
       and night creatures keep their hours;
     · idle life: roaming inside the territory by activity hours (active, resting, asleep), packs following their leader;
     · senses and choices (every ~0.45 s): sight and hearing by the rules (SIM.senseRange / SIM.detect: darkness, night vision,
       sleep), line of sight on the game's own sight-blocking tiles; timid animals bolt from players who come too close;
       hostile and territorial creatures (SIM factions) notice players and stalk them — chase to striking distance and hold —
       until the player leaves the pursuit limit, the leash or their sight, then walk home; nobody is attacked: combat is the
       next server phase, and when it arrives the stalk becomes the game's telegraph and strike;
     · tiers: only creatures near a player think and move (the cells within ACTIVE_RADIUS of someone); the rest wait unchanged.
   Movement is the game's creature step: the axis-separated slide on the shared collision plus protected ground, with the
   sidestep when blocked, MOVE_SCALE and the game's 8-way facing. Creatures are not saved: a server restart repopulates the world
   from the spawners, as a reload ends fights offline. Nothing a client sends reaches this file. */
import fs = require('node:fs');
import path = require('node:path');
import zlib = require('node:zlib');
import crypto = require('node:crypto');
import COL = require('../../../shared/collision');
import MV = require('../../../shared/movement');
import type { SimApi, SimClock, SimFactions } from '../../../shared/game-rules-adapter';
import type { Terrain } from './terrain';

export interface Species {
  n: string; size: number; hp: number; speed: number; aggro: number; leash: number; reach?: number;
  f?: string; hours?: string; temper?: string; hear?: number; terr?: number; pur?: number; flight?: number; social?: string; grp?: number[];
  resp?: number; cour?: number; nv?: number; night?: boolean; flee?: number; boss?: boolean;
}
export interface SpawnerDef { key: string; type: string; x: number; y: number; r: number; max: number; nightMax?: number; pack?: number; region?: string; camp?: string; boss?: boolean; delay?: number }
export interface PopulationData { build: string; world: string; species: Record<string, Species>; spawners: SpawnerDef[]; sightBlock: Uint8Array; ground: Uint8Array; W: number; H: number }

export function loadPopulation(repoRoot: string, terrain: Terrain): PopulationData {
  const dir = path.join(repoRoot, 'server', 'data');
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'population.json'), 'utf8'));
  const ground = zlib.gunzipSync(fs.readFileSync(path.join(dir, 'ground.bin.gz')));
  if (crypto.createHash('sha256').update(ground).digest('hex') !== m.groundSha256) throw new Error('server/data/ground.bin.gz does not match population.json — run python3 tools/export-world.py');
  if (m.world !== terrain.hash) throw new Error(`population.json was exported for world ${m.world}, the terrain is ${terrain.hash} — run python3 tools/export-world.py`);
  if (ground.length !== terrain.world.W * terrain.world.H) throw new Error('ground mask size differs from the world');
  for (const s of m.spawners) if (!m.species[s.type]) throw new Error('spawner ' + s.key + ': unknown species ' + s.type);
  const sightBlock = new Uint8Array(64); for (const t of m.sightBlock) sightBlock[t] = 1;
  return { build: m.build, world: m.world, species: m.species, spawners: m.spawners, sightBlock, ground: new Uint8Array(ground), W: terrain.world.W, H: terrain.world.H };
}

/* what the creature system needs from the world loop */
export interface PlayerView { nid: number; s: { x: number; y: number }; speed: number }
export interface CreatureHost {
  nextNid(): number;
  place(c: Creature): void;
  unplace(c: Creature): void;
  playersNear(realmId: string, x: number, y: number, r: number, fn: (p: PlayerView) => void): void;
  playerByNid(nid: number): PlayerView | null;
  creaturesNear(realmId: string, x: number, y: number, r: number, fn: (c: Creature) => void): void;
  activeCreatures(realmId: string, r: number, fn: (c: Creature) => void): void;
}

export type CreatureState = 'idle' | 'stalk' | 'flee' | 'return';
export interface Creature {
  kind: 'creature'; nid: number; realmId: string; type: string; sp: Spawner; d: Species;
  s: { x: number; y: number; sect: number }; home: { x: number; y: number };
  hp: number; max: number; speed: number; changed: boolean; cell: number;
  state: CreatureState; act: string; target: number; threat: number; fleeUntil: number; fleeT0: number;
  wx: number; wy: number; wt: number; wStuck: number; thinkAt: number; leader: Creature | null; seenAt: number; why: string;
}
interface Spawner extends SpawnerDef { n: number; next: number }

const STEP = MV.STEP, MOVE_SCALE = MV.MOVE_SCALE;
export const ACTIVE_RADIUS = 56;          // tiles: creatures this close to a player live; farther ones wait (src/tiers.js A/B tiers, simplified)
const SPAWN_GAP = 22, BOOT_GAP = 12;      // no spawning within this distance of a player (ecology.js ECO_SPAWN_GAP)
const SINK_GAP = 18;                      // extra night dead sink only this far from everyone
const THINK_TICKS = 9;                    // ~0.45 s between looks (ecoThink)
const SPAWN_EVERY = 20;                   // spawners are checked once a second
const PLAYER_FACTION = 'adventurers';

/* the world clock: hour of day from wall-clock seconds since EPOCH, by SIM.newClock (a 120-minute day, 09:00 at the epoch) */
export const CLOCK_EPOCH_MS = Date.UTC(2026, 10, 28);
export interface Clock { hour(): number; period(): string; dark(): number; dayMinutes: number }
export function worldClock(SIM: SimApi, now: () => number = Date.now): Clock {
  const c: SimClock = SIM.newClock({ dayMinutes: SIM.CLOCK.dayMinutes, offset: SIM.CLOCK.startHour });
  const t = () => (now() - CLOCK_EPOCH_MS) / 1000;
  return { hour: () => c.hourAt(t()), period: () => c.periodAt(t()), dark: () => SIM.lightAt(c.hourAt(t())).dark, dayMinutes: c.dayMinutes };
}
const isNight = (period: string) => period === 'night' || period === 'deepnight' || period === 'sunset';

export class Population {
  readonly creatures = new Set<Creature>();
  readonly spawners: Spawner[];
  private rng: () => number;
  private factions: SimFactions;
  private t = 0;           // simulation seconds since this population started
  private ticks = 0;
  stats = { spawned: 0, sunk: 0, active: 0, thinks: 0, stalking: 0, fleeing: 0 };

  constructor(readonly realmId: string, private terrain: Terrain, private data: PopulationData, private SIM: SimApi, private clock: Clock, private host: CreatureHost, seed = 1999) {
    this.rng = SIM.stream(seed, 'creatures:' + realmId);
    this.factions = SIM.newFactions(SIM.FACTION_RULES);
    this.spawners = data.spawners.map(s => Object.assign({}, s, { n: 0, next: 0 }));
  }

  /* footing: the shared collision plus protected ground (game.js canStand for kind 'mon') */
  stand(x: number, y: number) {
    if (!COL.canStand(this.terrain.world, x, y)) return false;
    const fx = Math.floor(x), fy = Math.floor(y); return !(this.data.ground[fy * this.data.W + fx] & 1);
  }
  prot(x: number, y: number) { const fx = Math.floor(x), fy = Math.floor(y); return fx >= 0 && fy >= 0 && fx < this.data.W && fy < this.data.H && (this.data.ground[fy * this.data.W + fx] & 1) === 1; }
  private noSpawn(x: number, y: number) { const fx = Math.floor(x), fy = Math.floor(y); return fx < 0 || fy < 0 || fx >= this.data.W || fy >= this.data.H || (this.data.ground[fy * this.data.W + fx] & 3) !== 0; }
  /* game.js los: no sight-blocking tile on the line, sampled every quarter tile */
  los(ax: number, ay: number, bx: number, by: number) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / .25), w = this.terrain.world;
    for (let i = 1; i < n; i++) { const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n; if (this.data.sightBlock[COL.tileAt(w, Math.floor(x), Math.floor(y))]) return false; }
    return true;
  }
  private moveBy(c: Creature, dx: number, dy: number) {
    let moved = 0;
    if (dx && this.stand(c.s.x + dx, c.s.y)) { c.s.x += dx; moved += Math.abs(dx); }
    if (dy && this.stand(c.s.x, c.s.y + dy)) { c.s.y += dy; moved += Math.abs(dy); }
    return moved;
  }
  /* aiMon's step: toward (or away from) a point at a fraction of the species' speed, sidestepping when blocked */
  private stepTo(c: Creature, tx: number, ty: number, spd: number, away = false) {
    let dx = tx - c.s.x, dy = ty - c.s.y; if (away) { dx = -dx; dy = -dy; }
    const l = Math.hypot(dx, dy); if (l < .05) return 0;
    const s = Math.min(away ? Infinity : l, spd * MOVE_SCALE * STEP);
    let mv = this.moveBy(c, dx / l * s, dy / l * s); if (mv < s * .3) mv += this.moveBy(c, -dy / l * s, dx / l * s);
    c.speed = Math.max(c.speed, mv / STEP); c.s.sect = MV.facing(c.s.sect, dx / l, dy / l) ?? c.s.sect;
    return mv;
  }
  private face(c: Creature, tx: number, ty: number) { const dx = tx - c.s.x, dy = ty - c.s.y, l = Math.hypot(dx, dy); if (l > .05) c.s.sect = MV.facing(c.s.sect, dx / l, dy / l) ?? c.s.sect; }

  private activity(c: Creature, period: string) { return this.SIM.activityOf(c.d.hours || 'always', period); }
  /* would this creature go after a player? (ecology.js ecoEnemy against the adventurers' faction) */
  enemyOfPlayers(d: Species) {
    if (d.temper === 'timid' || d.temper === 'passive') return false;
    const f = d.f || 'wildlife';
    if (d.temper === 'territorial') return !this.factions.friendly(f, PLAYER_FACTION) && f !== PLAYER_FACTION;
    return this.factions.hostile(f, PLAYER_FACTION);
  }

  /* ---------- spawning (ecology.js spawnTick / ecoSpot) ---------- */
  private spot(s: Spawner, boot: boolean): [number, number] | null {
    for (let k = 0; k < 14; k++) {
      const x = s.x + (this.rng() - .5) * 2 * s.r, y = s.y + (this.rng() - .5) * 2 * s.r;
      if (this.noSpawn(x, y) || !this.stand(x, y)) continue;
      const gap = s.boss ? 4 : boot ? BOOT_GAP : SPAWN_GAP; let seen = false;
      this.host.playersNear(this.realmId, x, y, gap, () => { seen = true; }); if (seen) continue;
      let crowd = false; this.host.creaturesNear(this.realmId, x, y, 1.2, () => { crowd = true; }); if (crowd) continue;
      return [x, y];
    }
    return null;
  }
  spawnTick(boot = false) {
    const night = isNight(this.clock.period());
    for (const s of this.spawners) {
      const cap = night && s.nightMax ? s.nightMax : s.max;
      if (s.n >= cap || (!boot && this.t < s.next)) continue;
      const d = this.data.species[s.type];
      s.next = this.t + (s.delay || ((d.resp || 90) * (.6 + this.rng() * .8)));
      const at = this.spot(s, boot); if (!at) continue; const [x, y] = at;
      const n = Math.min(s.pack || 1, cap - s.n); let leader: Creature | null = null;
      for (let i = 0; i < n; i++) {
        const px = x + i * .8, py = y + i * .5, ok = this.stand(px, py);
        const c: Creature = { kind: 'creature', nid: this.host.nextNid(), realmId: this.realmId, type: s.type, sp: s, d,
          s: { x: ok ? px : x, y: ok ? py : y, sect: Math.floor(this.rng() * 8) }, home: { x, y }, hp: d.hp, max: d.hp, speed: 0, changed: true, cell: -1,
          state: 'idle', act: 'idle', target: 0, threat: 0, fleeUntil: 0, fleeT0: 0, wx: x, wy: y, wt: 0, wStuck: 0, thinkAt: 0, leader, seenAt: -99, why: '' };
        if (!leader && n > 1) leader = c;
        this.creatures.add(c); this.host.place(c); s.n++; this.stats.spawned++;
      }
    }
  }
  /* one creature of a spawner's species at a given point (tests, and later game-master tools); null if it cannot stand there */
  spawnAt(key: string, x: number, y: number): Creature | null {
    const s = this.spawners.find(o => o.key === key); if (!s || !this.stand(x, y)) return null; const d = this.data.species[s.type];
    const c: Creature = { kind: 'creature', nid: this.host.nextNid(), realmId: this.realmId, type: s.type, sp: s, d, s: { x, y, sect: 0 }, home: { x, y }, hp: d.hp, max: d.hp, speed: 0, changed: true, cell: -1,
      state: 'idle', act: 'idle', target: 0, threat: 0, fleeUntil: 0, fleeT0: 0, wx: x, wy: y, wt: 0, wStuck: 0, thinkAt: 0, leader: null, seenAt: -99, why: '' };
    this.creatures.add(c); this.host.place(c); s.n++; return c;
  }
  clear() { for (const c of [...this.creatures]) this.remove(c); }
  /* boot: fill every spawner (the game's boot fill), a few passes so packs and crowded spawners settle */
  fill() { for (let k = 0; k < 4; k++) this.spawnTick(true); }
  private remove(c: Creature) { this.creatures.delete(c); c.sp.n--; this.host.unplace(c); for (const o of this.creatures) if (o.leader === c) o.leader = null; }
  /* at dawn the extra dead that rose for the night sink, out of everyone's sight (ecoSinkTick) */
  private sinkTick() {
    if (isNight(this.clock.period())) return;
    for (const s of this.spawners) {
      if (!s.nightMax || s.n <= s.max) continue;
      for (const c of this.creatures) {
        if (c.sp !== s || c.state !== 'idle') continue;
        let seen = false; this.host.playersNear(this.realmId, c.s.x, c.s.y, SINK_GAP, () => { seen = true; }); if (seen) continue;
        this.remove(c); this.stats.sunk++; break;
      }
    }
  }

  /* ---------- one 50 ms tick ---------- */
  step() {
    this.t += STEP; this.ticks++;
    if (this.ticks % SPAWN_EVERY === 0) { this.spawnTick(false); this.sinkTick(); }
    const period = this.clock.period(), dark = this.clock.dark();
    let active = 0;
    this.host.activeCreatures(this.realmId, ACTIVE_RADIUS, c => {
      active++; const x0 = c.s.x, y0 = c.s.y, sp0 = c.speed, sect0 = c.s.sect; c.speed = 0;
      if (this.t >= c.thinkAt) { c.thinkAt = this.t + THINK_TICKS * STEP + (c.nid % 10) * .01; this.think(c, period, dark); this.stats.thinks++; }
      this.act(c, period);
      this.separate(c);
      c.changed = c.s.x !== x0 || c.s.y !== y0 || c.s.sect !== sect0 || (c.speed === 0) !== (sp0 === 0);
      if (c.s.x !== x0 || c.s.y !== y0) this.host.place(c);
    });
    this.stats.active = active;
  }

  /* creatures do not stand inside each other: a gentle push apart (ecology.js ecoSeparate) */
  private separate(c: Creature) {
    this.host.creaturesNear(this.realmId, c.s.x, c.s.y, .7, o => {
      if (o === c) return; const dx = c.s.x - o.s.x, dy = c.s.y - o.s.y, l = Math.hypot(dx, dy);
      if (l > 1e-6 && l < .7) this.moveBy(c, dx / l * .02, dy / l * .02); else if (l <= 1e-6) this.moveBy(c, (c.nid % 2 ? .02 : -.02), 0);
    });
  }
  /* look, listen, choose (ecoThink, for players: flee, stalk, or carry on) */
  private think(c: Creature, period: string, dark: number) {
    const d = c.d, act = this.activity(c, period);
    const sense = { sight: d.aggro, hear: d.hear || d.aggro * .6, nightVision: d.nv || 0 };
    const ctx = { dark, activity: act, alert: this.t - c.seenAt < 8 };
    const rng = this.SIM.senseRange(sense, ctx); const reach = Math.max(rng.sight, rng.hear, d.flight || 0) + .5;
    const enemy = this.enemyOfPlayers(d); let fleeFrom: PlayerView | null = null, fleeD = Infinity, chase: PlayerView | null = null, chaseD = Infinity;
    this.host.playersNear(this.realmId, c.s.x, c.s.y, reach, p => {
      const dd = Math.hypot(p.s.x - c.s.x, p.s.y - c.s.y);
      const sensed = this.SIM.detect(sense, ctx, dd, { los: dd <= rng.sight && this.los(c.s.x, c.s.y, p.s.x, p.s.y), moving: p.speed > 1.2, noisy: false, hidden: false });
      if (!sensed) return; c.seenAt = this.t;
      if (d.temper === 'timid' && dd < (d.flight || 6) && dd < fleeD) { fleeFrom = p; fleeD = dd; }
      if (enemy && !this.prot(p.s.x, p.s.y) && !(d.temper === 'territorial' && dd > d.aggro * (act === 'sleep' ? .5 : 1)) && dd < chaseD) { chase = p; chaseD = dd; }
    });
    if (fleeFrom) { const p = fleeFrom as PlayerView; if (c.state !== 'flee') { c.fleeT0 = this.t; c.fleeUntil = this.t + 5 + this.rng() * 3; } c.state = 'flee'; c.threat = p.nid; c.target = 0; c.why = 'startled by a player'; this.callPack(c, null); return; }
    if (chase && (c.state === 'idle' || c.state === 'return' || c.state === 'stalk')) { const p = chase as PlayerView; c.state = 'stalk'; c.target = p.nid; c.why = d.temper === 'territorial' ? 'defends its ground' : 'enemy in sight'; this.callPack(c, p); }
  }
  /* a pack or herd acts together: followers take up their leader's quarry or flight (ecoIdle's leader rule) */
  private callPack(c: Creature, p: PlayerView | null) {
    const L = c.leader || c;
    for (const o of this.creatures) {
      if (o === c || (o.leader !== L && o !== L)) continue;
      if (p && o.state !== 'flee') { o.state = 'stalk'; o.target = p.nid; o.why = 'with its pack'; }
      else if (!p && c.state === 'flee' && o.state === 'idle') { o.state = 'flee'; o.threat = c.threat; o.fleeT0 = this.t; o.fleeUntil = this.t + 5 + this.rng() * 3; o.why = 'its herd bolted'; }
    }
  }

  private act(c: Creature, period: string) {
    const d = c.d, homeD = Math.hypot(c.s.x - c.home.x, c.s.y - c.home.y);
    switch (c.state) {
      case 'stalk': {
        const p = this.host.playerByNid(c.target);
        const pursuit = d.pur || d.leash;
        if (!p || homeD > pursuit || this.prot(p.s.x, p.s.y)) { c.state = 'return'; c.target = 0; c.why = !p ? 'lost its quarry' : homeD > pursuit ? 'too far from home' : 'its quarry reached safe ground'; break; }
        const dd = Math.hypot(p.s.x - c.s.x, p.s.y - c.s.y);
        if (!(dd < d.leash) || !this.los(c.s.x, c.s.y, p.s.x, p.s.y)) { c.state = 'return'; c.target = 0; c.why = 'lost sight'; break; }
        const hold = (d.reach || 1.2) * .9;
        if (dd > hold) this.stepTo(c, p.s.x, p.s.y, d.speed); else this.face(c, p.s.x, p.s.y);   // at striking distance: holds and faces (no attack before server combat)
        c.act = 'stalking'; break;
      }
      case 'flee': {
        const p = this.host.playerByNid(c.threat); const safe = (d.flight || 6) + 6;
        const dd = p ? Math.hypot(p.s.x - c.s.x, p.s.y - c.s.y) : Infinity;
        if (!p || (this.t > c.fleeUntil && dd > safe) || dd > safe * 1.8) { c.state = 'return'; c.threat = 0; c.why = 'safe again'; break; }
        const x0 = c.s.x, y0 = c.s.y;
        this.stepTo(c, p.s.x, p.s.y, d.speed * (d.temper === 'timid' ? (this.t - c.fleeT0 < 3 ? 1 : .7) : .85), true);   // prey tires after its first sprint
        if (Math.hypot(c.s.x - x0, c.s.y - y0) < .01) this.stepTo(c, c.home.x, c.home.y, d.speed);                          // cornered: break for home
        c.act = 'fleeing'; break;
      }
      case 'return': {
        if (homeD < 1.2) { c.state = 'idle'; c.act = 'idle'; c.why = ''; break; }
        const x0 = c.s.x, y0 = c.s.y; this.stepTo(c, c.home.x, c.home.y, d.speed);
        if (Math.hypot(c.s.x - x0, c.s.y - y0) < .002) { c.wStuck += STEP; if (c.wStuck > 4) { c.home = { x: c.s.x, y: c.s.y }; c.wStuck = 0; } }   // cannot get home from here: this is home now
        c.act = 'returning'; break;
      }
      default: this.idle(c, period);
    }
  }
  /* ecoIdle: follow the leader, sleep, or roam the territory by activity hours */
  private idle(c: Creature, period: string) {
    const d = c.d, act = this.activity(c, period); const L = c.leader;
    if (L && this.creatures.has(L)) {
      const ox = ((c.nid % 3) - 1) * 1.6, oy = 1.4 + (c.nid % 2) * .8, gx = L.s.x + ox, gy = L.s.y + oy, dd = Math.hypot(gx - c.s.x, gy - c.s.y);
      if (dd > 1.2) this.stepTo(c, gx, gy, d.speed * (dd > 5 ? .75 : .4)); c.act = 'following'; return;
    }
    if (act === 'sleep') { c.act = 'asleep'; return; }
    const rad = (d.terr || 12) * (act === 'active' ? 1 : .3) * (d.night && act === 'active' ? 1.6 : 1);
    if (!c.wt || this.t > c.wt || c.wStuck > 2) {
      c.wt = this.t + (act === 'active' ? 4 + this.rng() * 8 : 9 + this.rng() * 12); c.wStuck = 0;
      let ok = false;
      for (let k = 0; k < 6 && !ok; k++) { const x = c.home.x + (this.rng() - .5) * 2 * rad, y = c.home.y + (this.rng() - .5) * 2 * rad; if (this.stand(x, y)) { c.wx = x; c.wy = y; ok = true; } }
      if (!ok) { c.wx = c.s.x; c.wy = c.s.y; }
    }
    const dd = Math.hypot(c.wx - c.s.x, c.wy - c.s.y);
    if (dd > .4) { const x0 = c.s.x, y0 = c.s.y; this.stepTo(c, c.wx, c.wy, d.speed * (act === 'active' ? .35 : .22)); if (Math.hypot(c.s.x - x0, c.s.y - y0) < .002) c.wStuck += STEP; c.act = act === 'active' ? 'roaming' : 'resting'; }
    else c.act = act === 'active' ? 'idle' : 'resting';
  }

  count() { let stalking = 0, fleeing = 0; for (const c of this.creatures) { if (c.state === 'stalk') stalking++; else if (c.state === 'flee') fleeing++; } this.stats.stalking = stalking; this.stats.fleeing = fleeing; return this.creatures.size; }
}
