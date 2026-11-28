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
   Nothing a client sends sets a position, a speed or a stamina value. Combat, NPCs, items and the rest are not simulated here
   yet; they will arrive as further systems in this loop, one at a time. */
import P = require('../../../shared/protocol');
import COL = require('../../../shared/collision');
import MV = require('../../../shared/movement');
import type { Terrain } from './terrain';

export interface Input { s: number; x: number; y: number; w: number; r?: boolean }
export interface ActorInfo { characterId: string; name: string; body: string; appearance: any; title: string | null; town: string; equip: Record<string, any> }
export interface Actor {
  nid: number; characterId: string; accountId: string; realmId: string; info: ActorInfo;
  s: MV.MoveState; ctx: MV.MoveCtx; speed: number; changed: boolean;
  inputs: Input[]; lastSeq: number; credit: number; acked: number;
  viewing: boolean; known: Set<number>; cell: number; dirty: boolean; lastSentSelf: string;
}
export type Sink = (a: Actor, type: string, payload: object) => void;

const CELL = 16, LEAVE_MARGIN = 4, MAX_CREDIT = 3, SELF_KEEPALIVE_TICKS = 20;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export class World {
  tick = 0;
  private timer: NodeJS.Timeout | null = null;
  private flushers = new Set<() => void>();
  readonly actors = new Map<string, Actor>();
  private byNid = new Map<number, Actor>();
  private grid = new Map<number, Set<Actor>>();
  private nextNid = 1;
  private sink: Sink = () => {};
  readonly viewRadius: number;
  stats = { ticks: 0, overruns: 0, lastStepMs: 0, maxStepMs: 0, totalStepMs: 0, inputsApplied: 0, inputsDropped: 0, inputsLate: 0, actors: 0 };

  constructor(public terrain: Terrain | null, opts: { viewRadius?: number } = {}) { this.viewRadius = opts.viewRadius || P.VIEW_RADIUS; }

  start() { if (this.timer) return; let next = Date.now() + P.TICK_MS; const loop = () => { const t0 = performance.now(); this.step(); const dt = performance.now() - t0; this.stats.lastStepMs = dt; this.stats.totalStepMs += dt; if (dt > this.stats.maxStepMs) this.stats.maxStepMs = dt; if (dt > P.TICK_MS) this.stats.overruns++; next += P.TICK_MS; const wait = Math.max(0, next - Date.now()); if (wait === 0) next = Date.now(); this.timer = setTimeout(loop, wait); }; this.timer = setTimeout(loop, P.TICK_MS); }
  stop() { if (this.timer) clearTimeout(this.timer); this.timer = null; }
  onFlush(f: () => void) { this.flushers.add(f); return () => this.flushers.delete(f); }
  setSink(s: Sink) { this.sink = s; }
  /* no gameplay command other than movement has a server handler yet */
  submit(_cmd: { kind: string; characterId: string; payload: Record<string, unknown> }): boolean { return false; }

  private cellOf(x: number, y: number) { return Math.floor(y / CELL) * 4096 + Math.floor(x / CELL); }
  private place(a: Actor) {
    const c = this.cellOf(a.s.x, a.s.y); if (c === a.cell) return;
    const old = this.grid.get(a.cell); if (old) { old.delete(a); if (!old.size) this.grid.delete(a.cell); }
    let g = this.grid.get(c); if (!g) this.grid.set(c, g = new Set()); g.add(a); a.cell = c;
  }

  /* where a character enters: its saved position if it can stand there, else its town's spawn, else Saltmarsh Quay */
  resolvePosition(pos: any, town: string): { x: number; y: number; sect: number } {
    const t = this.terrain!; const sect = Number.isInteger(pos && pos.sect) ? pos.sect : 0;
    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) { const p = COL.nearestStand(t.world, pos.x, pos.y, 12); if (p) return { x: p.x, y: p.y, sect }; }
    const sp = t.spawns[town] || t.spawns.quay; const p = COL.nearestStand(t.world, sp.x, sp.y, 12) || t.spawns.quay;
    return { x: p.x, y: p.y, sect };
  }

  /* add(…) a character to the world (or return it if already there: a reconnect or a takeover) */
  add(o: { characterId: string; accountId: string; realmId: string; info: ActorInfo; position: any; stam: number; ctx: MV.MoveCtx }): { actor: Actor; resumed: boolean } {
    const had = this.actors.get(o.characterId);
    if (had) { had.viewing = true; had.known = new Set(); had.inputs = []; had.info = o.info; return { actor: had, resumed: true }; }
    const p = this.resolvePosition(o.position, o.info.town);
    const a: Actor = { nid: this.nextNid++, characterId: o.characterId, accountId: o.accountId, realmId: o.realmId, info: o.info,
      s: { x: p.x, y: p.y, sect: p.sect, stam: Math.min(o.stam, o.ctx.stamMax), lastDrain: -99, t: 0 }, ctx: o.ctx, speed: 0, changed: true,
      inputs: [], lastSeq: -1, credit: 0, acked: -1, viewing: true, known: new Set(), cell: -1, dirty: false, lastSentSelf: '' };
    this.actors.set(o.characterId, a); this.byNid.set(a.nid, a); this.place(a); this.stats.actors = this.actors.size;
    return { actor: a, resumed: false };
  }
  /* detach(): the connection dropped — the character stays where it is (reconnect grace), stops moving and receives nothing */
  detach(characterId: string) { const a = this.actors.get(characterId); if (a) { a.viewing = false; a.inputs = []; a.known = new Set(); } }
  /* remove(): the character leaves the world; everyone who could see it is told at the next tick */
  remove(characterId: string): Actor | null {
    const a = this.actors.get(characterId); if (!a) return null;
    this.actors.delete(characterId); this.byNid.delete(a.nid);
    const g = this.grid.get(a.cell); if (g) { g.delete(a); if (!g.size) this.grid.delete(a.cell); }
    for (const v of this.actors.values()) if (v.known.delete(a.nid) && v.viewing) this.sink(v, 'actor.leave', { nid: a.nid });
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
  enterPayload(a: Actor) { return { nid: a.nid, characterId: a.characterId, name: a.info.name, body: a.info.body, appearance: a.info.appearance, title: a.info.title, town: a.info.town, equip: a.info.equip, x: r3(a.s.x), y: r3(a.s.y), sect: a.s.sect ?? 0, speed: r3(a.speed) }; }
  selfPayload(a: Actor) { return { nid: a.nid, x: a.s.x, y: a.s.y, sect: a.s.sect ?? 0, stam: a.s.stam, stamMax: a.ctx.stamMax, ack: a.acked, t: a.s.t, ld: a.s.lastDrain }; }

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
        if (moved) { a.dirty = true; this.place(a); }
      }
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
        const self = this.selfPayload(v); const sig = `${self.x},${self.y},${self.sect},${Math.round(self.stam * 10)},${self.ack}`;
        if (moves.length || sig !== v.lastSentSelf || this.tick % SELF_KEEPALIVE_TICKS === 0) { v.lastSentSelf = sig; this.sink(v, 'state', { tick: this.tick, you: self, moves }); }
      }
    }
    // 3. send
    for (const f of this.flushers) try { f(); } catch (e) { console.error('flush failed', (e as Error).message); }
  }

  /* characters whose position changed since they were last saved */
  takeDirty(): Actor[] { const out: Actor[] = []; for (const a of this.actors.values()) if (a.dirty) { a.dirty = false; out.push(a); } return out; }
}
