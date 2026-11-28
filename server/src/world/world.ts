/* The world loop — server-authoritative movement (Server Movement v1).
   Every 50 ms tick (shared/protocol.js TICK_MS, the game's own fixed step):
   1. each character in the world consumes its queued movement intents — at most one per tick on average (an input credit
      that refills by one per tick, capped at 3 so a short network stall can catch up but never outrun real time) — and moves
      with shared/movement.js on the game's collision (shared/collision.js, server/data/world.bin.gz);
   2. interest management: a uniform grid (CELL tiles) finds who is within the view radius of each connected character;
      newcomers are announced (actor.enter), those beyond the radius plus a margin are dropped (actor.leave), and the
      positions that changed this tick are sent (state), together with your own authoritative position and the last of
      your intents the server has applied (ack), which the client uses to reconcile its prediction;
   3. the flushers send the queued messages.
   Since Server Creatures v1, step 1b runs the creatures (server/src/world/creatures.ts): one population per realm, created
   when the realm's first character enters, filled from the game's spawners; creatures share the interest grid, so they are
   announced, moved and dropped exactly like characters (actor.enter carries kind 'creature').
   Since Server Combat v1, step 1a runs the characters' fights (server/src/world/combat.ts on the shared rules): a character arms
   on a creature (target), and whenever its swing timer is ready and the creature is in reach and sight it swings; creatures strike
   back from their own loop. Health, death (a ghost), resurrection at a shrine, regeneration and the skills and stats learned in a
   fight are the server's; 'combat' events go to everyone in view.
   Since Server Items v1 the characters' items are the server's too (item commands on the shared SF.EQ rules), and remains
   (creature loot, a dead character's body, dropped piles) are bodies in the interest grid (actor.enter kind 'remains').
   Since Server Economy v1 the offline game's bankers and shopkeepers keep their posts online (server/src/world/economy.ts):
   they are bodies in the interest grid (actor.enter kind 'npc'), and every purchase, sale, deposit and withdrawal at their
   counters is a counter command checked by the server with the game's own rules and price list.
   Nothing a client sends sets a position, a speed or a stamina value. Combat, NPCs, items and the rest are not simulated here
   yet; they will arrive as further systems in this loop, one at a time. */
import P = require('../../../shared/protocol');
import COL = require('../../../shared/collision');
import MV = require('../../../shared/movement');
import type { Terrain } from './terrain';
import { Population, type Creature, type CreatureHost, type PopulationData, type Clock } from './creatures';
import type { SimApi } from '../../../shared/game-rules-adapter';
import { playerSwing, creatureBlow, weaponOf, type Learned } from './combat';
import { ITEMS, stamp, allItems, findSid, inventoryOf, publicItem, rollLoot, wornOf, type Remains } from './items';
import { buy, sell, deposit, depositGold, depositWorn, withdraw, stockOf, offersFor, type EconomyData, type Keeper, type Result } from './economy';

export interface Input { s: number; x: number; y: number; w: number; r?: boolean }
export interface ActorInfo { characterId: string; name: string; body: string; appearance: any; title: string | null; town: string; equip: Record<string, any> }
export interface Actor {
  kind: 'player'; nid: number; characterId: string; accountId: string; realmId: string; info: ActorInfo;
  s: MV.MoveState; ctx: MV.MoveCtx; speed: number; changed: boolean;
  inputs: Input[]; lastSeq: number; credit: number; acked: number;
  viewing: boolean; known: Set<number>; cell: number; dirty: boolean; lastSentSelf: string;
  /* combat (null ch: no combat for this character, e.g. a world without rules) */
  ch: any | null; hp: number; mana: number; ghost: boolean; ghostAt: number; bound: string | null;
  sw: { t: number; ready: boolean }; armed: number; lastCombat: number;
  movedAt: number; invDirty: boolean;
}
export interface Shot { a: Actor; nid: number; at: number; x0: number; y0: number; reach: number; r: ReturnType<typeof playerSwing> }
export interface CombatOpts { SF: any; seed?: number }
export const COMBAT = { inCombat: 6, regenPerSec: .1, shrineReach: 2.5, ghostReturn: 12 };   // game.js inCombat, the unfed regeneration, nearestRes reach, ghostret wait
export type Sink = (a: Actor, type: string, payload: object) => void;
/* anything with a place in the interest grid: a character or a creature */
export type Body = Actor | Creature | Remains | Keeper;
export interface CounterCmd { op: string; at: number; itemDef?: string; item?: string; slot?: string; qty?: number }
/* one completed counter transaction (the gateway logs it) */
export interface Trade { characterId: string; op: string; keeper: string; itemDef?: string; qty?: number; gold?: number }
export interface CreatureOpts { data: PopulationData; sim: SimApi; clock: Clock; seed?: number }

const CELL = 16, LEAVE_MARGIN = 4, MAX_CREDIT = 3, SELF_KEEPALIVE_TICKS = 20;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export class World {
  tick = 0;
  private timer: NodeJS.Timeout | null = null;
  private flushers = new Set<() => void>();
  readonly actors = new Map<string, Actor>();
  private byNid = new Map<number, Actor>();
  private grid = new Map<number, Set<Body>>();
  readonly populations = new Map<string, Population>();
  readonly remains = new Map<number, Remains>();
  private shots: Shot[] = [];
  /* the counters (Server Economy v1): keepers by nid, and which realms have theirs */
  readonly keepers = new Map<number, Keeper>();
  private keeperRealms = new Set<string>();
  private eco: EconomyData | null = null;
  onTrade: (t: Trade) => void = () => {};
  /* called when a character's items changed and must be saved now (the gateway writes them) */
  onInventory: (a: Actor) => void = () => {};
  private creatureOpts: CreatureOpts | null;
  private host: CreatureHost;
  private SF: any = null;
  private crng: () => number = () => .5;
  private nextNid = 1;
  private sink: Sink = () => {};
  readonly viewRadius: number;
  stats = { ticks: 0, overruns: 0, lastStepMs: 0, maxStepMs: 0, totalStepMs: 0, inputsApplied: 0, inputsDropped: 0, inputsLate: 0, actors: 0, creatures: 0, creaturesActive: 0, creatureMs: 0 };

  constructor(public terrain: Terrain | null, opts: { viewRadius?: number; creatures?: CreatureOpts | null; combat?: CombatOpts | null; economy?: EconomyData | null } = {}) {
    this.viewRadius = opts.viewRadius || P.VIEW_RADIUS; this.creatureOpts = opts.creatures || null;
    if (opts.economy && opts.combat) this.eco = opts.economy;
    if (opts.combat && opts.creatures) { this.SF = opts.combat.SF; this.crng = opts.creatures.sim.stream(opts.combat.seed ?? 2026, 'combat'); }
    const each = (realmId: string, x: number, y: number, r: number, fn: (b: Body) => void) => {
      const span = Math.ceil(r / CELL), cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), r2 = r * r;
      for (let gy = cy - span; gy <= cy + span; gy++) for (let gx = cx - span; gx <= cx + span; gx++) {
        const g = this.grid.get(gy * 4096 + gx); if (!g) continue;
        for (const o of g) if (o.realmId === realmId && (o.s.x - x) ** 2 + (o.s.y - y) ** 2 <= r2) fn(o);
      }
    };
    this.host = {
      nextNid: () => this.nextNid++,
      place: c => this.place(c),
      unplace: c => this.unplace(c),
      playersNear: (realm, x, y, r, fn) => each(realm, x, y, r, b => { if (b.kind === 'player') fn(b); }),
      playerByNid: nid => { const a = this.byNid.get(nid); return a && a.kind === 'player' ? a : null; },
      creaturesNear: (realm, x, y, r, fn) => each(realm, x, y, r, b => { if (b.kind === 'creature') fn(b); }),
      activeCreatures: (realm, r, fn) => {   // every creature in a grid cell within r of one of the realm's characters, once
        const span = Math.ceil(r / CELL), cells = new Set<number>();
        for (const a of this.actors.values()) { if (a.realmId !== realm) continue; const cx = Math.floor(a.s.x / CELL), cy = Math.floor(a.s.y / CELL); for (let gy = cy - span; gy <= cy + span; gy++) for (let gx = cx - span; gx <= cx + span; gx++) cells.add(gy * 4096 + gx); }
        const list: Creature[] = []; for (const k of cells) { const g = this.grid.get(k); if (g) for (const o of g) if (o.kind === 'creature' && o.realmId === realm) list.push(o); }
        for (const c of list) fn(c);
      },
      creatureStrikes: (c, nid) => this.creatureHits(c, nid),
      event: (realm, x, y, payload) => this.event(realm, x, y, payload) };
  }

  start() { if (this.timer) return; let next = Date.now() + P.TICK_MS; const loop = () => { const t0 = performance.now(); this.step(); const dt = performance.now() - t0; this.stats.lastStepMs = dt; this.stats.totalStepMs += dt; if (dt > this.stats.maxStepMs) this.stats.maxStepMs = dt; if (dt > P.TICK_MS) this.stats.overruns++; next += P.TICK_MS; const wait = Math.max(0, next - Date.now()); if (wait === 0) next = Date.now(); this.timer = setTimeout(loop, wait); }; this.timer = setTimeout(loop, P.TICK_MS); }
  stop() { if (this.timer) clearTimeout(this.timer); this.timer = null; }
  onFlush(f: () => void) { this.flushers.add(f); return () => this.flushers.delete(f); }
  setSink(s: Sink) { this.sink = s; }
  /* no gameplay command other than movement has a server handler yet */
  submit(_cmd: { kind: string; characterId: string; payload: Record<string, unknown> }): boolean { return false; }

  private cellOf(x: number, y: number) { return Math.floor(y / CELL) * 4096 + Math.floor(x / CELL); }
  private place(a: Body) {
    const c = this.cellOf(a.s.x, a.s.y); if (c === a.cell) return;
    const old = this.grid.get(a.cell); if (old) { old.delete(a); if (!old.size) this.grid.delete(a.cell); }
    let g = this.grid.get(c); if (!g) this.grid.set(c, g = new Set()); g.add(a); a.cell = c;
  }
  /* take a body out of the grid; everyone who could see it is told at once (a creature that sinks, a character that leaves) */
  private unplace(b: Body) {
    const g = this.grid.get(b.cell); if (g) { g.delete(b); if (!g.size) this.grid.delete(b.cell); } b.cell = -1;
    for (const v of this.actors.values()) if (v.known.delete(b.nid) && v.viewing) this.sink(v, 'actor.leave', { nid: b.nid });
  }
  /* the creatures of a realm, made (and filled from the spawners) when its first character enters */
  population(realmId: string): Population | null {
    if (!this.creatureOpts || !this.terrain) return null;
    let p = this.populations.get(realmId);
    if (!p) { const o = this.creatureOpts; p = new Population(realmId, this.terrain, o.data, o.sim, o.clock, this.host, o.seed); this.populations.set(realmId, p); p.fill(); this.stats.creatures = this.creatureCount(); }
    return p;
  }
  creatureCount() { let n = 0; for (const p of this.populations.values()) n += p.creatures.size; return n; }
  /* the time of day everyone shares (null without creatures) */
  clockInfo() { const c = this.creatureOpts && this.creatureOpts.clock; return c ? { hour: Math.round(c.hour() * 1000) / 1000, dayMinutes: c.dayMinutes, period: c.period() } : null; }

  /* where a character enters: its saved position if it can stand there, else its town's spawn, else Saltmarsh Quay */
  resolvePosition(pos: any, town: string): { x: number; y: number; sect: number } {
    const t = this.terrain!; const sect = Number.isInteger(pos && pos.sect) ? pos.sect : 0;
    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) { const p = COL.nearestStand(t.world, pos.x, pos.y, 12); if (p) return { x: p.x, y: p.y, sect }; }
    const sp = t.spawns[town] || t.spawns.quay; const p = COL.nearestStand(t.world, sp.x, sp.y, 12) || t.spawns.quay;
    return { x: p.x, y: p.y, sect };
  }

  /* add(…) a character to the world (or return it if already there: a reconnect or a takeover) */
  add(o: { characterId: string; accountId: string; realmId: string; info: ActorInfo; position: any; stam: number; ctx: MV.MoveCtx; ch?: any; hp?: number; mana?: number; ghost?: boolean; bound?: string | null }): { actor: Actor; resumed: boolean } {
    const had = this.actors.get(o.characterId);
    if (had) { had.viewing = true; had.known = new Set(); had.inputs = []; had.info = o.info; return { actor: had, resumed: true }; }
    const p = this.resolvePosition(o.position, o.info.town);
    const a: Actor = { kind: 'player', nid: this.nextNid++, characterId: o.characterId, accountId: o.accountId, realmId: o.realmId, info: o.info,
      s: { x: p.x, y: p.y, sect: p.sect, stam: Math.min(o.stam, o.ctx.stamMax), lastDrain: -99, t: 0 }, ctx: o.ctx, speed: 0, changed: true,
      inputs: [], lastSeq: -1, credit: 0, acked: -1, viewing: true, known: new Set(), cell: -1, dirty: false, lastSentSelf: '',
      ch: this.SF && o.ch ? o.ch : null, hp: 0, mana: o.mana ?? 0, ghost: !!o.ghost, ghostAt: this.now, bound: o.bound ?? null, sw: { t: -1e9, ready: true }, armed: 0, lastCombat: -99, movedAt: -99, invDirty: false };
    if (a.ch) stamp(this.SF, allItems(a.ch));
    if (a.ch) { const mx = this.SF.maxHp(a.ch); a.hp = Math.min(mx, Math.max(a.ghost ? 0 : 1, o.hp ?? mx)); if (a.ghost) { a.hp = 0; a.ctx = Object.assign({}, a.ctx, { ghost: true }); } }
    this.actors.set(o.characterId, a); this.byNid.set(a.nid, a); this.place(a); this.stats.actors = this.actors.size;
    this.population(o.realmId);   // the realm's creatures, filled out of this first character's sight
    this.placeKeepers(o.realmId);   // the realm's bankers and shopkeepers at their posts
    return { actor: a, resumed: false };
  }
  /* detach(): the connection dropped — the character stays where it is (reconnect grace), stops moving and receives nothing */
  detach(characterId: string) { const a = this.actors.get(characterId); if (a) { a.viewing = false; a.inputs = []; a.known = new Set(); } }
  /* remove(): the character leaves the world; everyone who could see it is told at the next tick */
  remove(characterId: string): Actor | null {
    const a = this.actors.get(characterId); if (!a) return null;
    this.actors.delete(characterId); this.byNid.delete(a.nid);
    this.unplace(a);
    this.stats.actors = this.actors.size;
    return a;
  }
  /* input(): queue movement intents for a character. Older and repeated sequence numbers are ignored; the queue is bounded. */
  input(characterId: string, inputs: Input[]): number {
    const a = this.actors.get(characterId); if (!a || !a.viewing) return 0;
    let n = 0; const last = a.inputs.length ? a.inputs[a.inputs.length - 1].s : a.lastSeq;
    let hi = last;
    for (const i of inputs) { if (i.s <= hi) { this.stats.inputsLate++; continue; } hi = i.s; a.inputs.push(i); n++; }
    while (a.inputs.length > P.INPUT_QUEUE) { a.inputs.shift(); this.stats.inputsDropped++; }
    return n;
  }
  setCtx(characterId: string, ctx: MV.MoveCtx) { const a = this.actors.get(characterId); if (a) { a.ctx = ctx; a.s.stam = Math.min(a.s.stam, ctx.stamMax); } }
  /* the public face of an actor for actor.enter */
  enterPayload(b: Body) { return b.kind === 'creature' ? this.creaturePayload(b) : b.kind === 'remains' ? this.remainsPayload(b) : b.kind === 'npc' ? this.keeperPayload(b) : this.playerPayload(b); }
  keeperPayload(k: Keeper) { return { kind: 'npc', nid: k.nid, x: r3(k.s.x), y: r3(k.s.y), sect: 0, role: k.post.role, name: k.post.name, counter: k.post.kind, town: k.post.town }; }
  remainsPayload(r: Remains) { return { kind: 'remains', nid: r.nid, x: r3(r.s.x), y: r3(r.s.y), sect: r.s.sect, name: r.name, mon: r.mon, pile: r.pile, owner: r.owner, ownerName: r.ownerName, left: Math.max(0, Math.round(r.expires - this.now)), items: r.cont.items.map(publicItem) }; }
  creaturePayload(c: Creature) { return { kind: 'creature', nid: c.nid, type: c.type, name: c.d.n, x: r3(c.s.x), y: r3(c.s.y), sect: c.s.sect, speed: r3(c.speed), hp: c.hp, max: c.max }; }
  playerPayload(a: Actor) { return { kind: 'player', nid: a.nid, characterId: a.characterId, name: a.info.name, body: a.info.body, appearance: a.info.appearance, title: a.info.title, town: a.info.town, equip: a.info.equip, x: r3(a.s.x), y: r3(a.s.y), sect: a.s.sect ?? 0, speed: r3(a.speed) }; }
  selfPayload(a: Actor) { return { nid: a.nid, x: a.s.x, y: a.s.y, sect: a.s.sect ?? 0, stam: a.s.stam, stamMax: a.ctx.stamMax, ack: a.acked, t: a.s.t, ld: a.s.lastDrain,
    hp: Math.ceil(a.hp), hpMax: a.ch ? this.SF.maxHp(a.ch) : 0, ghost: a.ghost, armed: a.armed }; }

  step() {
    this.tick++; this.stats.ticks++;
    const t = this.terrain;
    if (t) {
      // 1. movement
      const zero = { x: 0, y: 0, want: 0, sprint: false };
      for (const a of this.actors.values()) {
        a.credit = Math.min(MAX_CREDIT, a.credit + 1);
        const x0 = a.s.x, y0 = a.s.y, s0 = a.s.sect; let moved = 0, steps = 0;
        while (a.inputs.length && a.credit >= 1) {
          const i = a.inputs.shift()!; a.credit -= 1; steps++;
          const r = MV.step(t.world, a.s, { x: i.x, y: i.y, want: i.w, sprint: !!i.r }, a.ctx, COL);
          moved += r.moved; a.lastSeq = i.s; a.acked = i.s; this.stats.inputsApplied++;
        }
        if (!steps) MV.step(t.world, a.s, zero, a.ctx, COL);   // standing still: stamina recovers
        a.speed = moved / (P.TICK_MS / 1000);
        a.changed = a.s.x !== x0 || a.s.y !== y0 || a.s.sect !== s0 || (a.speed === 0) !== (moved === 0);
        if (moved) { a.dirty = true; a.movedAt = this.now; this.place(a); }
      }
      // 1a. characters fight; arrows in flight land; remains decay
      if (this.SF) { for (const a of this.actors.values()) this.fightStep(a); this.shotsStep(); if (this.tick % 20 === 0) this.decayStep(); }
      // 1b. creatures
      if (this.populations.size) { const c0 = performance.now(); let act = 0; for (const p of this.populations.values()) { p.step(); act += p.stats.active; } this.stats.creaturesActive = act; this.stats.creatures = this.creatureCount(); this.stats.creatureMs += performance.now() - c0; }
      // 2. interest management and state
      const R = this.viewRadius, R2 = R * R, L2 = (R + LEAVE_MARGIN) ** 2, span = Math.ceil((R + LEAVE_MARGIN) / CELL);
      for (const v of this.actors.values()) {
        if (!v.viewing) continue;
        const cx = Math.floor(v.s.x / CELL), cy = Math.floor(v.s.y / CELL); const near = new Set<number>(); const moves: number[][] = [];
        for (let gy = cy - span; gy <= cy + span; gy++) for (let gx = cx - span; gx <= cx + span; gx++) {
          const g = this.grid.get(gy * 4096 + gx); if (!g) continue;
          for (const o of g) {
            if (o === v || o.realmId !== v.realmId) continue;
            const d2 = (o.s.x - v.s.x) ** 2 + (o.s.y - v.s.y) ** 2;
            if (v.known.has(o.nid)) { if (d2 <= L2) { near.add(o.nid); if (o.changed) moves.push([o.nid, r3(o.s.x), r3(o.s.y), o.s.sect ?? 0, r3(o.speed)]); } }
            else if (d2 <= R2) { near.add(o.nid); v.known.add(o.nid); this.sink(v, 'actor.enter', this.enterPayload(o)); }
          }
        }
        for (const nid of [...v.known]) if (!near.has(nid)) { v.known.delete(nid); this.sink(v, 'actor.leave', { nid }); }
        const self = this.selfPayload(v); const sig = `${self.x},${self.y},${self.sect},${Math.round(self.stam * 10)},${self.ack},${self.hp},${self.ghost},${self.armed}`;
        if (moves.length || sig !== v.lastSentSelf || this.tick % SELF_KEEPALIVE_TICKS === 0) { v.lastSentSelf = sig; this.sink(v, 'state', { tick: this.tick, you: self, moves }); }
      }
    }
    // 3. send
    for (const f of this.flushers) try { f(); } catch (e) { console.error('flush failed', (e as Error).message); }
  }

  get now() { return this.tick * MV.STEP; }
  get combatOn() { return !!this.SF; }
  get economyOn() { return !!(this.SF && this.eco); }
  /* a 'combat' event for everyone viewing within the view radius of a point */
  event(realmId: string, x: number, y: number, payload: object) {
    const r2 = this.viewRadius * this.viewRadius;
    for (const v of this.actors.values()) if (v.viewing && v.realmId === realmId && (v.s.x - x) ** 2 + (v.s.y - y) ** 2 <= r2) this.sink(v, 'combat', payload);
  }
  private creatureOf(a: Actor, nid: number) { const p = this.populations.get(a.realmId); const c = p && p.byNid.get(nid); return c && !c.dead ? { p: p!, c } : null; }
  /* target(): arm on a creature (nid) or stand down (null). Returns a refusal reason or null. */
  target(characterId: string, nid: number | null): string | null {
    const a = this.actors.get(characterId); if (!a || !a.ch) return 'Combat is not available.';
    if (nid === null) { a.armed = 0; return null; }
    if (a.ghost) return 'You cannot fight now.';
    if (!this.creatureOf(a, nid)) return 'No valid target.';
    const w = weaponOf(this.SF, a.ch).w; if (w.ammo && !this.SF.count(a.ch.pack, w.ammo)) return 'You have no ' + w.ammo + 's.';
    a.armed = nid; return null;
  }
  /* one tick of a character's fight (game.js attackTick → swingAt): the swing timer runs; an armed character swings when ready, in reach and in sight */
  private fightStep(a: Actor) {
    if (!a.ch) return; const now = this.now, SF = this.SF;
    if (a.ghost) return;
    if (now - a.lastCombat >= COMBAT.inCombat) { const mx = SF.maxHp(a.ch); if (a.hp < mx) { const before = Math.ceil(a.hp); a.hp = Math.min(mx, a.hp + COMBAT.regenPerSec * MV.STEP); if (Math.ceil(a.hp) !== before) a.dirty = true; } }
    const w = weaponOf(SF, a.ch).w; SF.swingTick(a.sw, now, a.s.stam, w);
    if (!a.armed) return;
    const t = this.creatureOf(a, a.armed);
    if (!t) { a.armed = 0; return; }
    const { p, c } = t, dd = Math.hypot(c.s.x - a.s.x, c.s.y - a.s.y);
    if (!a.sw.ready || dd > w.reach + .05 || !p.los(a.s.x, a.s.y, c.s.x, c.s.y)) return;   // out of reach or sight: stays armed, the swing waits
    if (w.ammo) {   // game.js swingAt for a bow: stand still to aim, one projectile per release, hit or miss
      if (this.now - a.movedAt < SF.ARCHERY.aim) return;
      if (!SF.count(a.ch.pack, w.ammo)) { a.armed = 0; this.sink(a, 'combat', { k: 'refused', what: 'shot', reason: 'You have no ' + w.ammo + 's.' }); return; }
      SF.removeQty(a.ch.pack, w.ammo, 1); this.inventoryChanged(a, false);
    }
    SF.swingSpend(a.sw, now); a.lastCombat = now;
    const dx = c.s.x - a.s.x, dy = c.s.y - a.s.y, l = Math.hypot(dx, dy) || 1; a.s.sect = MV.facing(a.s.sect, dx / l, dy / l) ?? a.s.sect; a.changed = true;
    const r = playerSwing(SF, a.ch, c.d, c.ward, this.crng, now, 'c' + c.nid);
    this.learned(a, r.learned); this.wornOut(a, r.worn, r.broke);
    if (w.ammo) {   // the arrow lands a second later (SF.ARCHERY.flight)
      this.event(a.realmId, a.s.x, a.s.y, { k: 'shot', a: a.nid, t: c.nid, w: w.fam || 'Bow', flight: SF.ARCHERY.flight });
      this.shots.push({ a, nid: c.nid, at: now + SF.ARCHERY.flight, x0: a.s.x, y0: a.s.y, reach: w.reach, r }); return;
    }
    this.resolveSwing(a, p, c, r, w.fam || 'Unarmed');
  }
  private resolveSwing(a: Actor, p: Population, c: Creature, r: ReturnType<typeof playerSwing>, fam: string) {
    if (r.ward) c.ward = Math.max(0, c.ward - r.ward);
    const hpAfter = Math.max(0, c.hp - r.dmg);
    this.event(a.realmId, c.s.x, c.s.y, { k: r.hit ? 'hit' : 'miss', a: a.nid, t: c.nid, dmg: r.dmg, ward: r.ward || undefined, hp: hpAfter, max: c.max, w: fam });
    if (r.hit && hpAfter <= 0) this.event(a.realmId, c.s.x, c.s.y, { k: 'death', t: c.nid, by: a.nid, name: c.d.n });
    const x = c.s.x, y = c.s.y, sect = c.s.sect, d = c.d, type = c.type;
    const killed = p.hurt(c, r.hit ? r.dmg : 0, a);
    if (killed) { if (a.armed === c.nid) a.armed = 0; this.creatureRemains(a.realmId, type, d, x, y, sect, a.info.name); }
  }
  /* arrows land (game.js arrowLands): the archer must not have moved, the target must still be alive, in range and in sight */
  private shotsStep() {
    if (!this.shots.length) return; const now = this.now, keep: Shot[] = [];
    for (const sh of this.shots) {
      if (sh.at > now) { keep.push(sh); continue; }
      const a = sh.a; if (!this.actors.has(a.characterId) || a.ghost) continue;
      const t = this.creatureOf(a, sh.nid); if (!t) continue;
      const { p, c } = t;
      if (Math.hypot(a.s.x - sh.x0, a.s.y - sh.y0) > this.SF.ARCHERY.drift) { this.event(a.realmId, c.s.x, c.s.y, { k: 'wide', a: a.nid, t: c.nid }); continue; }
      if (Math.hypot(c.s.x - a.s.x, c.s.y - a.s.y) > sh.reach + .5 || !p.los(a.s.x, a.s.y, c.s.x, c.s.y)) { this.event(a.realmId, c.s.x, c.s.y, { k: 'blocked', a: a.nid, t: c.nid }); continue; }
      this.resolveSwing(a, p, c, sh.r, 'Bow');
    }
    this.shots = keep;
  }
  /* a creature's blow lands (or misses) on a character */
  private creatureHits(c: Creature, nid: number) {
    const a = this.byNid.get(nid); if (!a || a.kind !== 'player' || !a.ch || a.ghost) return;
    const r = creatureBlow(this.SF, c.d, a.ch, this.crng, this.now, 'c' + c.nid);
    a.lastCombat = this.now;
    const hpAfter = Math.max(0, Math.ceil(a.hp - r.dmg));
    this.event(a.realmId, a.s.x, a.s.y, { k: !r.hit ? 'miss' : r.parried ? 'parry' : 'hit', a: c.nid, t: a.nid, dmg: r.dmg, hp: hpAfter, region: r.region || undefined });
    if (r.hit && r.dmg > 0) this.damagePlayer(a, r.dmg, c.d.n);
    this.learned(a, r.learned); this.wornOut(a, r.worn, r.broke);
  }
  private damagePlayer(a: Actor, dmg: number, by: string) {
    if (a.ghost || dmg <= 0) return; a.hp -= dmg; a.lastCombat = this.now; a.dirty = true;
    if (a.hp <= 0) this.die(a, by);
  }
  /* death (game.js playerDies): a ghost, once. Online the belongings stay with the character until items are server-owned. */
  private die(a: Actor, by: string) {
    if (a.ghost) return; a.hp = 0; a.ghost = true; a.ghostAt = this.now; a.armed = 0; a.dirty = true;
    a.ctx = Object.assign({}, a.ctx, { ghost: true });
    this.event(a.realmId, a.s.x, a.s.y, { k: 'death', t: a.nid, name: a.info.name, by });
    // game.js playerDies: away from protected ground the tradeable belongings stay on the body (SF.deathTransaction)
    const pop = this.populations.get(a.realmId);
    if (!(pop && pop.prot(a.s.x, a.s.y))) {
      const corpse = this.SF.deathTransaction(a.ch, this.now, { x: a.s.x, y: a.s.y });
      this.addRemains(a.realmId, { name: a.info.name + "'s body", items: corpse.items, x: a.s.x, y: a.s.y, sect: a.s.sect ?? 0, life: this.SF.CORPSE_LIFE, owner: a.characterId, ownerName: a.info.name });
      this.inventoryChanged(a, true);
    }
  }
  /* resurrect(): at a shrine within reach ('shrine'), or back at the bound shrine after the wait ('bound') — game.js interact / ghostret → resurrect */
  resurrect(characterId: string, at: 'shrine' | 'bound'): string | null {
    const a = this.actors.get(characterId); if (!a || !a.ch || !this.terrain) return 'Not available.';
    if (!a.ghost) return 'You are alive.';
    const shrines = this.terrain.shrines.map(s => ({ id: s.id, x: s.x + .5, y: s.y + .5 }));
    if (at === 'shrine') {
      const near = shrines.some(s => Math.hypot(s.x - a.s.x, s.y - a.s.y) <= COMBAT.shrineReach);
      if (!near) return 'Walk to a shrine to be restored.';
    } else {
      if (this.now - a.ghostAt < COMBAT.ghostReturn) return 'Wait a moment before returning.';
      const s = shrines.find(z => z.id === a.bound) || shrines[0]; if (!s) return 'No shrine.';
      const q = COL.nearestStand(this.terrain.world, s.x, s.y + 1.2, 12) || { x: s.x, y: s.y + 1.2 };
      a.s.x = q.x; a.s.y = q.y; a.inputs = []; a.changed = true; this.place(a);
    }
    const SF = this.SF; a.ghost = false; a.ctx = Object.assign({}, a.ctx, { ghost: false });
    a.hp = Math.ceil(SF.maxHp(a.ch) * .25); a.s.stam = Math.ceil(SF.maxStam(a.ch) * .2); a.mana = Math.ceil(SF.maxMana(a.ch) * .2); a.dirty = true; a.lastCombat = -99;
    this.event(a.realmId, a.s.x, a.s.y, { k: 'res', t: a.nid, name: a.info.name });
    return null;
  }
  /* skills and stats learned in a fight: told to the character, saved, and the movement context follows a changed Dexterity */
  private learned(a: Actor, list: Learned[]) {
    if (!list.length) return; a.dirty = true; let stat = false;
    for (const l of list) { if (l.stat) stat = true; this.sink(a, 'gain', l.stat ? { skill: l.skill, value: l.value, stat: l.stat, statValue: a.ch[l.stat] } : { skill: l.skill, value: l.value }); }
    if (stat) { const g = a.ctx.ghost; a.ctx = Object.assign(MV.ctxFor(this.SF, a.ch), { ghost: g }); }
  }
  /* ---------- items (Server Items v1) ---------- */
  private addRemains(realmId: string, o: { name: string; items: any[]; x: number; y: number; sect: number; life: number; mon?: string | null; owner?: string | null; ownerName?: string | null; pile?: boolean; killer?: string | null }) {
    stamp(this.SF, o.items);
    const r: Remains = { kind: 'remains', nid: this.nextNid++, realmId, s: { x: o.x, y: o.y, sect: o.sect }, speed: 0, changed: false, cell: -1,
      cont: { cid: 'r' + this.nextNid, kind: o.pile ? 'pile' : 'corpse', items: o.items, ver: 0 }, name: o.name, mon: o.mon ?? null, owner: o.owner ?? null, ownerName: o.ownerName ?? null,
      expires: this.now + o.life, pile: !!o.pile, killer: o.killer ?? null };
    this.remains.set(r.nid, r); this.place(r); return r;
  }
  private creatureRemains(realmId: string, type: string, d: any, x: number, y: number, sect: number, killer: string) {
    const items = rollLoot(this.SF, d, this.crng);
    this.addRemains(realmId, { name: d.n + ' remains', items, x, y, sect, life: d.boss ? ITEMS.bossCorpseLife : ITEMS.corpseLife, mon: type, killer });
  }
  private removeRemains(r: Remains) { this.remains.delete(r.nid); this.unplace(r); }
  private decayStep() { const now = this.now; for (const r of [...this.remains.values()]) if (now >= r.expires || (r.pile && !r.cont.items.length)) this.removeRemains(r); }
  /* the remains' contents changed: everyone in view gets the new list; an emptied pile goes */
  private remainsChanged(r: Remains) {
    r.cont.ver++;
    if (r.pile && !r.cont.items.length) { this.removeRemains(r); return; }
    const r2 = this.viewRadius * this.viewRadius;
    for (const v of this.actors.values()) if (v.viewing && v.realmId === r.realmId && v.known.has(r.nid) && (v.s.x - r.s.x) ** 2 + (v.s.y - r.s.y) ** 2 <= r2) this.sink(v, 'remains', { nid: r.nid, items: r.cont.items.map(publicItem) });
  }
  /* after any change to a character's items: identities fixed, movement follows the weight, the owner gets the new inventory,
     others see the new look if a worn piece changed, and the items are saved (now, or with the next save for wear and arrows) */
  inventoryChanged(a: Actor, now: boolean, lookChanged = false) {
    stamp(this.SF, allItems(a.ch));
    const g = a.ctx.ghost; a.ctx = Object.assign(MV.ctxFor(this.SF, a.ch), { ghost: g }); a.s.stam = Math.min(a.s.stam, a.ctx.stamMax);
    this.sink(a, 'inv', inventoryOf(a.ch));
    if (lookChanged) { a.info = Object.assign({}, a.info, { equip: wornOf(a.ch) }); this.event(a.realmId, a.s.x, a.s.y, { k: 'look', t: a.nid, equip: a.info.equip }); }
    if (now) { a.invDirty = false; this.onInventory(a); } else a.invDirty = true;
  }
  private wornOut(a: Actor, worn: boolean, broke: any[]) {
    if (!worn) return; a.invDirty = true;
    if (broke.length) { for (const it of broke) this.sink(a, 'combat', { k: 'broke', t: a.nid, item: it.sid, itemDef: it.id }); this.inventoryChanged(a, true, true); }
  }
  /* item(): one item command from a character, validated by the shared rules. Returns a refusal reason or null. */
  item(characterId: string, cmd: { op: string; item?: string; into?: string; slot?: string; qty?: number; from?: number }): string | null {
    const a = this.actors.get(characterId); if (!a || !a.ch) return 'Items are not available.';
    const SF = this.SF, EQ = SF.EQ, ch = a.ch, cap1 = (r: any) => { const m = String(r && r.reason || 'not possible'); return m.charAt(0).toUpperCase() + m.slice(1) + '.'; };
    if (a.ghost) return 'Ghosts cannot handle items.';
    const own = (sid?: string) => sid ? findSid(allItems(ch), sid) : null;
    const remainsNear = () => {
      const r = cmd.from !== undefined ? this.remains.get(cmd.from) : undefined;
      if (!r || r.realmId !== a.realmId) return { err: 'Those remains are gone.' };
      if (Math.hypot(r.s.x - a.s.x, r.s.y - a.s.y) > ITEMS.reach) return { err: 'Move within 2 m.' };
      if (r.owner && r.owner !== a.characterId) return { err: `That is ${r.ownerName || 'someone'}'s body; only they can take from it.` };
      return { r };
    };
    switch (cmd.op) {
      case 'equip': {
        const it = own(cmd.item); if (!it) return 'That item is gone.';
        const r = EQ.equipItem(ch, { uid: it.uid, slot: cmd.slot }); if (!r.ok) return cap1(r);
        this.inventoryChanged(a, true, true); return null;
      }
      case 'unequip': {
        if (!cmd.slot || !EQ.SLOT[cmd.slot]) return 'No such slot.';
        const r = EQ.unequipItem(ch, { slot: cmd.slot }); if (!r.ok) return cap1(r);
        this.inventoryChanged(a, true, true); return null;
      }
      case 'drop': {
        const it = own(cmd.item); if (!it) return 'That item is gone.'; const worn = Object.values(ch.equip).includes(it);
        let pile: Remains | null = null;
        for (const r of this.remains.values()) if (r.pile && r.realmId === a.realmId && Math.hypot(r.s.x - a.s.x, r.s.y - a.s.y) < ITEMS.pileJoin) { pile = r; break; }
        const res = EQ.dropItem(ch, { uid: it.uid, qty: cmd.qty }, (out: any) => {
          if (pile) { pile.cont.items.push(out); pile.expires = this.now + ITEMS.pileLife; }
          else pile = this.addRemains(a.realmId, { name: 'dropped items', items: [out], x: a.s.x, y: a.s.y, sect: 0, life: ITEMS.pileLife, pile: true });
          return true;
        });
        if (!res.ok) return cap1(res);
        stamp(this.SF, pile!.cont.items, new Set(allItems(ch).map((i: any) => i.sid)));   // a split-off stack gets its own id
        this.inventoryChanged(a, true, worn); this.remainsChanged(pile!); return null;
      }
      case 'take': case 'takeall': {
        const n = remainsNear(); if (n.err) return n.err; const r = n.r!;
        const list = cmd.op === 'takeall' ? r.cont.items.slice() : [findSid(r.cont.items, cmd.item || '')].filter(Boolean);
        if (!list.length) return cmd.op === 'takeall' ? 'Nothing left to take.' : 'That item is gone.';
        let took = 0, why = '';
        for (const it of list) {
          const q = cmd.op === 'take' && cmd.qty !== undefined ? cmd.qty : it.qty;
          const res = EQ.pickupItem(ch, r.cont, { uid: it.uid, qty: q }); if (!res.ok) { why = cap1(res); break; } took++;
        }
        if (took) { this.inventoryChanged(a, true); this.remainsChanged(r); }
        return took ? (why && cmd.op === 'takeall' ? 'Stopped: ' + why : null) : why || 'Not possible.';
      }
      case 'split': {
        const it = own(cmd.item); if (!it || !ch.pack.items.includes(it)) return 'That item is not in your backpack.';
        const r = EQ.splitStack(ch.pack, { uid: it.uid, qty: cmd.qty }); if (!r.ok) return cap1(r);
        this.inventoryChanged(a, true); return null;
      }
      case 'merge': {
        const f = own(cmd.item), t = own(cmd.into); if (!f || !t) return 'That item is gone.';
        const r = EQ.mergeStacks(ch.pack, { from: f.uid, into: t.uid }); if (!r.ok) return cap1(r);
        this.inventoryChanged(a, true); return null;
      }
      case 'mergeall': { const n = EQ.mergeAll(ch.pack); if (n) this.inventoryChanged(a, true); return n ? null : 'Nothing to merge.'; }
      default: return 'Unknown item command.';
    }
  }
  /* ---------- counters (Server Economy v1) ---------- */
  placeKeepers(realmId: string) {
    if (!this.eco || this.keeperRealms.has(realmId)) return; this.keeperRealms.add(realmId);
    for (const post of this.eco.posts) {
      const k: Keeper = { kind: 'npc', nid: this.nextNid++, realmId, s: { x: post.x, y: post.y, sect: 0 }, speed: 0, changed: false, cell: -1, post };
      this.keepers.set(k.nid, k); this.place(k);
    }
  }
  /* what the character sees at a keeper's counter: a shop's stock and what it would pay for each backpack item, or the bank */
  counterView(a: Actor, k: Keeper) {
    const SF = this.SF, base = { nid: k.nid, kind: k.post.kind, role: k.post.role, name: k.post.name };
    if (k.post.kind === 'bank') return Object.assign(base, { bank: a.ch.bank.items.map(publicItem), gold: SF.count(a.ch.bank, 'gold') });
    return Object.assign(base, { stock: stockOf(SF, this.eco!, k.post), offers: offersFor(SF, this.eco!, a.ch), gold: SF.count(a.ch.pack, 'gold') });
  }
  /* counter(): one counter command — open, buy, sell, deposit, depositgold, depositworn, withdraw — at the keeper 'at'.
     The live situation is checked every time (game.js atCounter): alive, the keeper exists in this realm, within reach, and
     the right kind of counter. Returns a refusal reason or null; on success the inventory is saved and the counter redrawn. */
  counter(characterId: string, cmd: CounterCmd): string | null {
    const a = this.actors.get(characterId); if (!a || !a.ch || !this.eco) return 'Counters are not available.';
    if (a.ghost) return 'The keeper cannot see you.';
    const k = this.keepers.get(cmd.at); if (!k || k.realmId !== a.realmId) return 'There is no one at that counter.';
    if (Math.hypot(k.s.x - a.s.x, k.s.y - a.s.y) > this.eco.reach + .5) return 'You are no longer at the counter.';
    const SF = this.SF, ch = a.ch, post = k.post;
    const bankOnly = ['deposit', 'depositgold', 'depositworn', 'withdraw'], shopOnly = ['buy', 'sell'];
    if (bankOnly.includes(cmd.op) && post.kind !== 'bank') return 'This keeper keeps no bank.';
    if (shopOnly.includes(cmd.op) && post.kind !== 'shop') return 'This keeper does not trade.';
    let r: Result, look = false; const pack = (sid?: string) => sid ? findSid(ch.pack.items, sid) : null;
    switch (cmd.op) {
      case 'open': this.sink(a, 'counter', this.counterView(a, k)); return null;
      case 'buy': r = buy(SF, this.eco, ch, post, cmd.itemDef || '', cmd.qty ?? 1); break;
      case 'sell': { const it = pack(cmd.item); r = it ? sell(SF, this.eco, ch, post, it, cmd.qty) : { ok: false, reason: 'That item is not in your backpack.' }; break; }
      case 'deposit': { const it = pack(cmd.item); r = it ? deposit(SF, ch, it) : { ok: false, reason: 'That item is not in your backpack.' }; break; }
      case 'depositgold': r = depositGold(SF, ch); break;
      case 'depositworn': r = depositWorn(SF, ch, cmd.slot || ''); look = r.ok; break;
      case 'withdraw': { const it = cmd.item ? findSid(ch.bank.items, cmd.item) : null; r = withdraw(SF, ch, it); break; }
      default: return 'Unknown counter command.';
    }
    if (!r.ok) return r.reason;
    this.inventoryChanged(a, true, look);
    this.sink(a, 'counter', this.counterView(a, k));
    this.onTrade({ characterId, op: cmd.op, keeper: post.key, itemDef: cmd.itemDef, qty: cmd.qty, gold: r.gold });
    return null;
  }
  /* the live inventory for a character that just (re)joined: the welcome's snapshot comes from the database, which can trail memory */
  sendInventory(characterId: string) { const a = this.actors.get(characterId); if (a && a.ch) this.sink(a, 'inv', inventoryOf(a.ch)); }
  /* characters whose items changed through wear or arrows since they were last saved */
  takeInvDirty(): Actor[] { const out: Actor[] = []; for (const a of this.actors.values()) if (a.invDirty) { a.invDirty = false; out.push(a); } return out; }
  /* characters whose position changed since they were last saved */
  takeDirty(): Actor[] { const out: Actor[] = []; for (const a of this.actors.values()) if (a.dirty) { a.dirty = false; out.push(a); } return out; }
}
