/* The world loop — the reserved server tick. It runs at the game's own fixed step (50 ms, shared/protocol.js TICK_MS, the same
   step src/world.js simulates with). In this phase the world simulates nothing: it keeps the tick count, applies queued commands
   at the tick boundary and flushes outgoing events once per tick. Movement, combat, NPCs, crafting and trade will be added as
   command handlers here, one subsystem at a time, each server-authoritative. */
import P = require('../../../shared/protocol');

export interface Command { kind: string; characterId: string; payload: Record<string, unknown>; receivedTick: number }
export type CommandHandler = (cmd: Command, world: World) => void;

export class World {
  tick = 0;
  private timer: NodeJS.Timeout | null = null;
  private commands: Command[] = [];
  private handlers = new Map<string, CommandHandler>();       // empty in this phase: no gameplay command is accepted yet
  private flushers = new Set<() => void>();
  readonly maxCommandsPerTick = 2000;
  stats = { ticks: 0, overruns: 0, lastStepMs: 0, commandsDropped: 0 };

  start() { if (this.timer) return; let next = Date.now() + P.TICK_MS; const loop = () => { const t0 = Date.now(); this.step(); const dt = Date.now() - t0; this.stats.lastStepMs = dt; if (dt > P.TICK_MS) this.stats.overruns++; next += P.TICK_MS; const wait = Math.max(0, next - Date.now()); if (wait === 0) next = Date.now(); this.timer = setTimeout(loop, wait); }; this.timer = setTimeout(loop, P.TICK_MS); }
  stop() { if (this.timer) clearTimeout(this.timer); this.timer = null; }
  onFlush(f: () => void) { this.flushers.add(f); return () => this.flushers.delete(f); }
  register(kind: string, h: CommandHandler) { this.handlers.set(kind, h); }
  /* queue a command for the next tick; refuses kinds that have no server handler (nothing client-authoritative slips through) */
  submit(cmd: Omit<Command, 'receivedTick'>): boolean {
    if (!this.handlers.has(cmd.kind)) return false;
    if (this.commands.length >= this.maxCommandsPerTick) { this.stats.commandsDropped++; return false; }
    this.commands.push(Object.assign({ receivedTick: this.tick }, cmd)); return true;
  }
  step() {
    this.tick++; this.stats.ticks++;
    const q = this.commands; this.commands = [];
    for (const c of q) { const h = this.handlers.get(c.kind); if (h) try { h(c, this); } catch (e) { console.error('command failed', c.kind, (e as Error).message); } }
    for (const f of this.flushers) try { f(); } catch (e) { console.error('flush failed', (e as Error).message); }
  }
}
