/* The realtime gateway — authenticated WebSocket connections, the realm presence list and the bridge to the world loop
   (server-authoritative movement, server/src/world/world.ts).
   Upgrade: same-origin cookie session (no token in the URL), Origin must be allowed, the session must be a full one.
   Policy:
   - one live connection per character: a second connection for the same character takes over and the first is closed (4004);
   - one active character per account per realm: joining with another character of the same account takes over too;
   - a dropped connection keeps the character present for RECONNECT_GRACE_MS, so reconnecting is seamless (no leave + join);
   - sign-out, password change, account or character deletion close the affected connections at once (4010);
   - heartbeat every HEARTBEAT_MS; per-connection rate limit, payload limit (MAX_MESSAGE_BYTES) and bounded send queue;
   - outgoing events are batched and flushed on the world tick (50 ms);
   - movement: the client sends intents (move); the world applies them and the positions it computes are the only ones sent;
     positions are saved every 30 s, when a character leaves the world and when the server stops;
   - nothing else the client sends can change game state: combat, items, gold, skills and stats are refused. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import type { Config } from '../config';
import P = require('../../../shared/protocol');
import { originAllowed, requestOrigin } from '../auth/guard';
import type { Sessions } from '../auth/sessions';
import type { Characters } from '../characters/service';
import type { World, Actor } from '../world/world';
import { rowsOf } from '../world/items';
import MV = require('../../../shared/movement');

interface Conn {
  id: number; socket: WebSocket; sessionId: string; sessionToken: string; accountId: string; characterId: string | null; realmId: string | null;
  seq: number; alive: boolean; tokens: number; lastRefill: number; violations: number; outbox: string[]; closed: boolean; noGrace: boolean; log: any;
}
interface Entry { characterId: string; accountId: string; realmId: string; conn: Conn | null; info: ReturnType<typeof P.presenceOf>; graceTimer: NodeJS.Timeout | null }

/* what a character visibly wears (item ids and their look-relevant fields), for others to draw it */
const wornOf = (ch: any) => { const o: Record<string, any> = {}; for (const i of ch.items || []) if (i.container === 'equip' && i.slot) o[i.slot] = Object.assign({}, i.props, { id: i.itemDef }); return o; };
const BUCKET = 40, REFILL_PER_S = 20, MAX_OUTBOX = 512, MAX_BUFFERED = 1 << 20, SESSION_CHECK_MS = 30_000, SAVE_MS = 30_000;
const NOTICE = 'Walking, creatures, combat and items are server-authoritative: the server decides where everyone is, what the wildlife does, every blow and every item. Trading, crafting, banks and shops are not online yet.';

export class Gateway {
  private conns = new Set<Conn>();
  private presence = new Map<string, Entry>();
  private nextId = 1;
  private heartbeat: NodeJS.Timeout | null = null;
  private sessionCheck: NodeJS.Timeout | null = null;
  private saver: NodeJS.Timeout | null = null;
  private stopping = false;
  counters = { opened: 0, closed: 0, rejectedUpgrades: 0, takeovers: 0, reconnects: 0, refused: 0 };

  constructor(private cfg: Config, private sessions: Sessions, private chars: Characters, private world: World, private log: any) {
    world.onFlush(() => this.flush());
    world.setSink((a: Actor, type: string, payload: object) => { const e = this.presence.get(a.characterId); if (e && e.conn) this.send(e.conn, type, payload); });
    world.onInventory = (a: Actor) => { void this.saveItems(a); };
  }
  /* save a character's items (Server Items v1). The rows are taken now, and every save in the server runs in one queue, in the
     order the changes happened: an item handed from one character to another (a body looted by its owner, a pile picked up) is
     always written to its latest holder last. A failed save is retried with the next change or the next periodic save. */
  private itemQueue: Promise<void> = Promise.resolve();
  private saveItems(a: Actor) {
    if (!a.ch || this.stopping) return this.itemQueue;
    const id = a.characterId, rows = rowsOf(a.ch);
    this.itemQueue = this.itemQueue.then(() => this.chars.saveInventory(id, rows)).then(() => undefined, e => { a.invDirty = true; this.log.error({ err: (e as Error).message, character: id }, 'saving items failed'); });
    return this.itemQueue;
  }
  /* save positions (never blocks the tick; failures are logged and retried at the next save) */
  private persist(list: Actor[]) {
    if (!list.length || this.stopping) return Promise.resolve();
    for (const a of list) if (a.invDirty) { a.invDirty = false; void this.saveItems(a); }
    return this.chars.savePositions(list.map(a => ({ id: a.characterId, x: a.s.x, y: a.s.y, sect: a.s.sect ?? 0, town: a.info.town, stam: a.s.stam,
      combat: a.ch ? { hp: Math.ceil(a.hp), mana: Math.round(a.mana), ghost: a.ghost, skills: a.ch.skills, str: a.ch.str, dex: a.ch.dex, int: a.ch.int } : undefined })))
      .then(() => undefined, e => { for (const a of list) a.dirty = true; this.log.error({ err: (e as Error).message }, 'saving positions failed'); });
  }

  register(app: FastifyInstance) {
    app.get('/ws', {
      websocket: true,
      preValidation: async (req: FastifyRequest, reply: FastifyReply) => {
        if (!originAllowed(this.cfg, requestOrigin(req))) { this.counters.rejectedUpgrades++; return reply.code(403).send({ error: { code: 'bad_origin', message: 'Origin not allowed.' } }); }
        const s = await this.sessions.lookup(req.cookies[this.cfg.cookiePrefix + 'sf_session']);
        if (!s || s.kind !== 'full' || (await this.sessions.recheck(s)) !== 'ok') { this.counters.rejectedUpgrades++; return reply.code(401).send({ error: { code: 'not_signed_in', message: 'Please sign in.' } }); }
        req.sess = s; req.sessToken = req.cookies[this.cfg.cookiePrefix + 'sf_session'];
      },
    } as any, (socket: WebSocket, req: FastifyRequest) => this.open(socket, req));
    this.heartbeat = setInterval(() => this.beat(), P.HEARTBEAT_MS);
    this.sessionCheck = setInterval(() => { this.checkSessions().catch(e => this.log.error({ err: e.message }, 'session check failed')); }, SESSION_CHECK_MS);
    this.saver = setInterval(() => { for (const a of this.world.takeInvDirty()) void this.saveItems(a); void this.persist(this.world.takeDirty()); }, SAVE_MS);
  }

  private open(socket: WebSocket, req: FastifyRequest) {
    const c: Conn = { id: this.nextId++, socket, sessionId: req.sess!.id, sessionToken: req.sessToken!, accountId: req.sess!.account_id, characterId: null, realmId: null,
      seq: 0, alive: true, tokens: BUCKET, lastRefill: Date.now(), violations: 0, outbox: [], closed: false, noGrace: false, log: this.log.child({ conn: 0 }) };
    c.log = this.log.child({ conn: c.id, account: c.accountId });
    this.conns.add(c); this.counters.opened++; c.log.info('ws open');
    socket.on('pong', () => { c.alive = true; });
    socket.on('message', (data: any, isBinary: boolean) => { this.onMessage(c, data, isBinary).catch(e => { c.log.error({ err: (e as Error).message }, 'ws message failed'); this.error(c, 'server_error', 'Something went wrong.'); }); });
    socket.on('close', (code: number) => this.onClose(c, code));
    socket.on('error', (e: Error) => c.log.warn({ err: e.message }, 'ws error'));
  }

  private take(c: Conn) { const now = Date.now(); c.tokens = Math.min(BUCKET, c.tokens + (now - c.lastRefill) / 1000 * REFILL_PER_S); c.lastRefill = now; if (c.tokens < 1) return false; c.tokens -= 1; return true; }

  private async onMessage(c: Conn, data: any, isBinary: boolean) {
    if (c.closed) return;
    if (!this.take(c)) { this.error(c, 'rate_limited', 'Too many messages.'); if (++c.violations > 5) this.close(c, P.CLOSE.RATE_LIMIT, 'rate limit', true); return; }
    if (isBinary) { this.error(c, 'bad_frame', 'Text frames only.'); if (++c.violations > 5) this.close(c, P.CLOSE.PROTOCOL, 'protocol', true); return; }
    const r = P.parseClient(data.toString('utf8'));
    if (!r.ok) {
      this.counters.refused++; this.error(c, r.code, r.message, r.id);
      if (r.code === 'protocol_mismatch') return this.close(c, P.CLOSE.PROTOCOL, 'protocol version', true);
      if (r.code !== 'not_authoritative' && ++c.violations > 5) this.close(c, P.CLOSE.PROTOCOL, 'protocol', true);
      return;
    }
    const m = r.msg;
    if (m.type === 'ping') return this.send(c, 'pong', { t: m.p.t ?? null, tick: this.world.tick, serverTime: Date.now() }, m.id, true);
    if (m.type === 'hello') return this.hello(c, m.p.characterId, m.id);
    if (!c.characterId) return this.error(c, 'hello_first', 'Say hello with a character first.', m.id);
    if (m.type === 'move') { this.world.input(c.characterId, m.p.inputs as any); return; }
    if (m.type === 'target' || m.type === 'resurrect' || m.type === 'item') {
      const why = m.type === 'target' ? this.world.target(c.characterId, m.p.nid as number | null) : m.type === 'item' ? this.world.item(c.characterId, m.p as any) : this.world.resurrect(c.characterId, m.p.at as 'shrine' | 'bound');
      if (why) this.send(c, 'combat', { k: 'refused', what: m.type, reason: why }, m.id, true);
      return;
    }
    if (m.type === 'resync') { const ch = await this.chars.snapshot(c.accountId, c.characterId); if (!ch) return this.close(c, P.CLOSE.FORBIDDEN, 'character gone', true); return this.send(c, 'snapshot', { tick: this.world.tick, character: ch, presence: this.others(c) }, m.id); }
  }

  private async hello(c: Conn, characterId: string, reqId?: string) {
    if (c.characterId) return this.error(c, 'already_joined', 'This connection already plays a character.', reqId);
    const ch = await this.chars.snapshot(c.accountId, characterId);
    if (!ch) { this.error(c, 'not_found', 'Character not found.', reqId); return this.close(c, P.CLOSE.FORBIDDEN, 'not your character', true); }
    if (c.closed) return;
    // one character per account per realm: another character of this account in the same realm is taken over
    for (const e of [...this.presence.values()]) if (e.accountId === c.accountId && e.realmId === ch.realmId && e.characterId !== characterId) {
      if (e.conn) { e.conn.noGrace = true; this.kick(e.conn, 'another_character'); }
      this.removeEntry(e);
    }
    let e = this.presence.get(characterId); let resumed = false;
    const info = P.presenceOf({ id: ch.id, name: ch.name, body: ch.body, appearance: ch.appearance, startingTown: ch.startingTown, title: ch.title });
    if (e) {
      if (e.graceTimer) { clearTimeout(e.graceTimer); e.graceTimer = null; resumed = true; this.counters.reconnects++; }
      if (e.conn && e.conn !== c) { this.counters.takeovers++; const old = e.conn; e.conn = null; this.kick(old, 'taken_over'); resumed = true; }
      e.conn = c; e.info = info;
    } else {
      e = { characterId, accountId: c.accountId, realmId: ch.realmId, conn: c, info, graceTimer: null };
      this.presence.set(characterId, e);
      this.broadcast(ch.realmId, 'presence.join', { character: info }, characterId);
    }
    c.characterId = characterId; c.realmId = ch.realmId;
    const rc = this.chars.rulesCharacter(ch); const ctx = MV.ctxFor(this.chars.SF, rc);
    const { actor, resumed: inWorld } = this.world.add({ characterId, accountId: c.accountId, realmId: ch.realmId, ctx, stam: ch.vitals.stam,
      ch: rc, hp: ch.vitals.hp, mana: ch.vitals.mana, ghost: !!ch.ghost, bound: ch.boundShrine,
      position: ch.position, info: { characterId, name: ch.name, body: ch.body, appearance: ch.appearance, title: ch.title, town: ch.startingTown, equip: wornOf(ch) } });
    const t = this.world.terrain!;
    this.send(c, 'welcome', { protocol: P.PROTOCOL_VERSION, tick: this.world.tick, tickMs: P.TICK_MS, serverAuthoritative: false, authoritative: { movement: true, creatures: !!this.world.clockInfo(), combat: this.world.combatOn, items: this.world.combatOn }, clock: this.world.clockInfo(),
      notice: NOTICE, resumed: resumed || inWorld, character: ch, presence: this.others(c),
      world: { hash: t.hash, W: t.world.W, H: t.world.H, step: MV.STEP, viewRadius: this.world.viewRadius }, you: this.world.selfPayload(actor) }, reqId, true);
    this.world.sendInventory(characterId);   // after the welcome: the live items (Server Items v1)
    c.log.info({ character: characterId, resumed }, 'joined lobby');
    this.chars.markPlayed(characterId).catch(() => {});
  }

  private others(c: Conn) { return [...this.presence.values()].filter(e => e.realmId === c.realmId && e.characterId !== c.characterId).map(e => Object.assign({ connected: !!e.conn }, e.info)); }

  private onClose(c: Conn, code: number) {
    if (c.closed && !this.conns.has(c)) return;
    c.closed = true; this.conns.delete(c); this.counters.closed++;
    c.log.info({ code }, 'ws closed');
    const e = c.characterId ? this.presence.get(c.characterId) : null;
    if (!e || e.conn !== c) return;                        // taken over, or never joined
    e.conn = null;
    if (c.noGrace) return this.removeEntry(e);
    this.world.detach(e.characterId);
    e.graceTimer = setTimeout(() => { e.graceTimer = null; if (!e.conn) this.removeEntry(e); }, P.RECONNECT_GRACE_MS);
  }

  private removeEntry(e: Entry) {
    if (e.graceTimer) clearTimeout(e.graceTimer);
    if (this.presence.get(e.characterId) !== e) return;
    this.presence.delete(e.characterId);
    const a = this.world.remove(e.characterId); if (a) { if (a.ch) void this.saveItems(a); void this.persist([a]); }
    this.broadcast(e.realmId, 'presence.leave', { characterId: e.characterId }, e.characterId);
  }

  private broadcast(realmId: string, type: string, payload: object, except?: string) {
    for (const e of this.presence.values()) if (e.realmId === realmId && e.conn && e.characterId !== except) this.send(e.conn, type, payload);
  }

  /* queue a message for the next tick flush (now = true sends at once: replies, welcome, kicks) */
  private send(c: Conn, type: string, payload: object, id?: string, now = false) {
    if (c.closed) return;
    const text = P.encode(type, payload, { id, seq: ++c.seq });
    if (now) return this.write(c, text);
    if (c.outbox.length >= MAX_OUTBOX) { c.log.warn('send queue full'); return this.close(c, P.CLOSE.TRY_LATER, 'slow consumer', false); }
    c.outbox.push(text);
  }
  private write(c: Conn, text: string) {
    if (c.closed || c.socket.readyState !== 1) return;
    if (c.socket.bufferedAmount > MAX_BUFFERED) { c.log.warn('socket buffer full'); return this.close(c, P.CLOSE.TRY_LATER, 'slow consumer', false); }
    c.socket.send(text);
  }
  private flush() { for (const c of this.conns) { if (!c.outbox.length) continue; const q = c.outbox; c.outbox = []; for (const t of q) this.write(c, t); } }
  private error(c: Conn, code: string, message: string, id?: string) { this.send(c, 'error', { code, message }, id, true); }
  private kick(c: Conn, reason: string) { this.send(c, 'kicked', { reason }, undefined, true); this.close(c, P.CLOSE.TAKEN_OVER, reason, false); }
  private close(c: Conn, code: number, reason: string, noGrace: boolean) {
    if (c.closed) return; if (noGrace) c.noGrace = true;
    this.flushOne(c); try { c.socket.close(code, reason.slice(0, 100)); } catch { /* already closing */ }
    setTimeout(() => { if (c.socket.readyState !== 3) c.socket.terminate(); }, 2000).unref();
  }
  private flushOne(c: Conn) { const q = c.outbox; c.outbox = []; for (const t of q) this.write(c, t); }

  private beat() { for (const c of this.conns) { if (!c.alive) { c.log.info('heartbeat missed'); c.socket.terminate(); continue; } c.alive = false; try { c.socket.ping(); } catch { /* closing */ } } }
  private async checkSessions() { for (const c of [...this.conns]) { const s = await this.sessions.lookup(c.sessionToken); if (!s) this.endConn(c, 'session_ended'); } }
  private endConn(c: Conn, reason: string) { this.send(c, 'kicked', { reason }, undefined, true); this.close(c, P.CLOSE.SESSION_ENDED, reason, true); }

  /* hooks for the HTTP side */
  closeSessions(ids: string[]) { const set = new Set(ids); for (const c of [...this.conns]) if (set.has(c.sessionId)) this.endConn(c, 'session_ended'); }
  closeAccount(accountId: string) { for (const c of [...this.conns]) if (c.accountId === accountId) this.endConn(c, 'account_closed'); }
  closeCharacter(characterId: string) {
    for (const c of [...this.conns]) if (c.characterId === characterId) this.endConn(c, 'character_deleted');
    const e = this.presence.get(characterId); if (e && !e.conn) this.removeEntry(e);
  }
  stats() { return { connections: this.conns.size, present: this.presence.size, inWorld: this.world.actors.size, tick: this.world.tick, ...this.counters }; }
  /* stop: tell everyone, close every connection, and save where every character stands */
  async shutdown() {
    if (this.heartbeat) clearInterval(this.heartbeat); if (this.sessionCheck) clearInterval(this.sessionCheck); if (this.saver) clearInterval(this.saver);
    for (const a of this.world.actors.values()) if (a.ch) void this.saveItems(a);
    await this.persist([...this.world.actors.values()]); await this.itemQueue; this.stopping = true;   // everything is saved; late socket closes save nothing more
    for (const e of this.presence.values()) if (e.graceTimer) clearTimeout(e.graceTimer);
    for (const c of [...this.conns]) { c.noGrace = true; this.send(c, 'kicked', { reason: 'server_restart' }, undefined, true); try { c.socket.close(P.CLOSE.GOING_AWAY, 'server restart'); } catch { /* */ } }
  }
}
