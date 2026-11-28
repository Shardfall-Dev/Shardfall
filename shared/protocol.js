/* Shardfall realtime protocol v1 — one definition for the game server (server/src/realtime) and the browser client
   (src/online.js; build.sh puts this file into the game). Pure, no DOM, no network: UMD (CommonJS in node, SF_PROTOCOL in
   the browser).
   Envelope (JSON text frames): { v: PROTOCOL_VERSION, type, id?, seq?, p }
     v     protocol version; a mismatch is refused with 'protocol_mismatch'
     type  message type (below)
     id    client request id (1–64 chars), echoed on the reply
     seq   server → client: a per-connection sequence number, +1 per message, so the client can detect a gap and resync
     p     payload object
   v2 (Server Movement v1): the server simulates walking. The client sends movement *intents* (move: a direction, how far the
   stick is pushed, sprint) for each 50 ms step; the server applies at most one per tick per character with the game's own
   speeds and collision (shared/movement.js, shared/collision.js) and answers with authoritative positions (state) for the
   characters near you (interest management: actor.enter / actor.leave). Messages that would make the client authoritative over
   anything else (combat, items, gold, skills, stats) are still refused with 'not_authoritative'. */
(function (root, factory) {
  const P = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = P; else root.SF_PROTOCOL = P;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const P = {};
  P.PROTOCOL_VERSION = 2;
  P.MAX_MESSAGE_BYTES = 16 * 1024;     // a single frame, client → server
  P.TICK_MS = 50;                      // the server tick: the same 50 ms fixed step as the game's world simulation (src/world.js)
  P.HEARTBEAT_MS = 15000;              // the server pings; a connection that misses two heartbeats is closed
  P.RECONNECT_GRACE_MS = 10000;        // a dropped character stays present this long, so a quick reconnect is not a leave + join
  P.MAX_INPUTS = 10;                   // movement intents per move message (0.5 s of 50 ms steps)
  P.INPUT_QUEUE = 10;                  // intents the server holds per character; older ones are dropped beyond that
  P.VIEW_RADIUS = 40;                  // tiles: characters closer than this are sent to you
  P.CLOSE = { NORMAL: 1000, GOING_AWAY: 1001, POLICY: 1008, TOO_BIG: 1009, TRY_LATER: 1013,
    UNAUTHORIZED: 4001, FORBIDDEN: 4003, TAKEN_OVER: 4004, PROTOCOL: 4005, RATE_LIMIT: 4008, SESSION_ENDED: 4010 };

  P.CLIENT = ['hello', 'ping', 'resync', 'move'];
  P.SERVER = ['welcome', 'snapshot', 'presence.join', 'presence.leave', 'pong', 'error', 'kicked', 'state', 'actor.enter', 'actor.leave'];
  P.RESERVED = ['teleport', 'position', 'attack', 'cast', 'use', 'equip', 'unequip', 'pickup', 'drop', 'trade', 'gold', 'skill', 'stat', 'inventory', 'damage', 'craft', 'loot', 'say'];

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  P.isUuid = s => typeof s === 'string' && UUID.test(s);
  const isObj = o => !!o && typeof o === 'object' && !Array.isArray(o);
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const onlyKeys = (o, keys) => Object.keys(o).every(k => keys.includes(k));

  /* payload validators for client messages: each returns null when valid, else a short reason */
  const V = {
    hello: p => !onlyKeys(p, ['characterId', 'lastSeq']) ? 'unexpected field' : !P.isUuid(p.characterId) ? 'characterId must be a UUID'
      : has(p, 'lastSeq') && !(Number.isSafeInteger(p.lastSeq) && p.lastSeq >= 0) ? 'lastSeq must be a whole number' : null,
    ping: p => !onlyKeys(p, ['t']) ? 'unexpected field' : has(p, 't') && !(typeof p.t === 'number' && Number.isFinite(p.t)) ? 't must be a number' : null,
    resync: p => !onlyKeys(p, []) ? 'unexpected field' : null,
    move: p => {
      if (!onlyKeys(p, ['inputs']) || !Array.isArray(p.inputs)) return 'inputs must be an array';
      if (p.inputs.length < 1 || p.inputs.length > P.MAX_INPUTS) return 'between 1 and ' + P.MAX_INPUTS + ' inputs';
      for (const i of p.inputs) {
        if (!isObj(i) || !onlyKeys(i, ['s', 'x', 'y', 'w', 'r'])) return 'bad input';
        if (!(Number.isSafeInteger(i.s) && i.s >= 0 && i.s < 2 ** 31)) return 'input s must be a sequence number';
        for (const k of ['x', 'y']) if (!(typeof i[k] === 'number' && Number.isFinite(i[k]) && Math.abs(i[k]) <= 1.5)) return 'input ' + k + ' must be a direction component';
        if (!(typeof i.w === 'number' && i.w >= 0 && i.w <= 1)) return 'input w must be 0–1';
        if (has(i, 'r') && typeof i.r !== 'boolean') return 'input r must be a boolean';
      }
      return null;
    } };

  /* parseClient(text) → { ok: true, msg } or { ok: false, code, message, id? }. Never throws. */
  P.parseClient = text => {
    if (typeof text !== 'string') return { ok: false, code: 'bad_frame', message: 'text frames only' };
    if (text.length > P.MAX_MESSAGE_BYTES) return { ok: false, code: 'too_big', message: 'message too large' };
    let m; try { m = JSON.parse(text); } catch (e) { return { ok: false, code: 'bad_json', message: 'not JSON' }; }
    if (!isObj(m)) return { ok: false, code: 'bad_envelope', message: 'envelope must be an object' };
    const id = typeof m.id === 'string' && m.id.length >= 1 && m.id.length <= 64 ? m.id : undefined;
    if (has(m, 'id') && id === undefined) return { ok: false, code: 'bad_envelope', message: 'id must be a string of 1–64 characters' };
    if (m.v !== P.PROTOCOL_VERSION) return { ok: false, code: 'protocol_mismatch', message: 'protocol version ' + P.PROTOCOL_VERSION + ' required', id };
    if (!onlyKeys(m, ['v', 'type', 'id', 'p'])) return { ok: false, code: 'bad_envelope', message: 'unexpected envelope field', id };
    if (typeof m.type !== 'string') return { ok: false, code: 'bad_envelope', message: 'type missing', id };
    if (P.RESERVED.includes(m.type)) return { ok: false, code: 'not_authoritative', message: m.type + ' is not accepted from clients in this phase', id };
    if (!P.CLIENT.includes(m.type)) return { ok: false, code: 'unknown_type', message: 'unknown message type', id };
    const p = has(m, 'p') ? m.p : {};
    if (!isObj(p)) return { ok: false, code: 'bad_payload', message: 'payload must be an object', id };
    const why = V[m.type](p); if (why) return { ok: false, code: 'bad_payload', message: why, id };
    return { ok: true, msg: { type: m.type, id, p } };
  };

  /* encode(type, payload, opts) → JSON text. opts: { id, seq } */
  P.encode = (type, payload, opts) => {
    const o = opts || {}; const m = { v: P.PROTOCOL_VERSION, type, p: payload || {} };
    if (o.id !== undefined) m.id = o.id; if (o.seq !== undefined) m.seq = o.seq;
    return JSON.stringify(m);
  };

  /* parseServer(text) → { ok, msg } — the client's check of what the server sent */
  P.parseServer = text => {
    let m; try { m = JSON.parse(text); } catch (e) { return { ok: false, code: 'bad_json' }; }
    if (!isObj(m) || m.v !== P.PROTOCOL_VERSION || typeof m.type !== 'string' || !P.SERVER.includes(m.type) || !isObj(m.p)) return { ok: false, code: 'bad_envelope' };
    if (has(m, 'seq') && !Number.isSafeInteger(m.seq)) return { ok: false, code: 'bad_envelope' };
    return { ok: true, msg: m };
  };

  /* presence entry: the public face of a connected character (no account id, no email) */
  P.presenceOf = c => ({ characterId: c.id, name: c.name, body: c.body, appearance: c.appearance, town: c.startingTown || c.town, title: c.title || null });
  return P;
});
