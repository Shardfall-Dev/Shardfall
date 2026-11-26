<script>
/* Shardfall world simulation core (SIM) — Living World Phase 1 (docs/WORLD_SIMULATION_PROGRESS.md).
   Pure, renderer-free, network-free: no DOM, no Canvas, no timers, no Math.random. Runs in the browser (globalThis.SIM)
   and in node for tests (module.exports). The game (src/game.js) owns the entities; SIM gives them:
     · stable actor identifiers that survive save/load (and can later be shared by an authoritative server),
     · an archetype → controller → component schema, so input, NPC decisions and future network messages drive the same actor,
     · a bounded, structured event log stamped with simulation time,
     · seeded random streams whose state can be saved.
   Anything here must stay serialisable and independent of how an action was triggered (touch, mouse, AI or network). */
(function (root) {
'use strict';
const SIM = { VERSION: 1 };

/* ---------------- archetypes, controllers, optional components ----------------
   An archetype says what an actor is; its controller says what drives it. Components are optional: a rat has no
   notoriety, bank or spellbook. Controller names match the master spec §3; HirelingAI is the existing Wren sellsword. */
SIM.CONTROLLERS = ['PlayerController', 'CivilianAI', 'MerchantAI', 'GuardAI', 'AdventurerAI', 'HirelingAI', 'CriminalAI', 'MonsterAI', 'AnimalAI', 'PetAI', 'SummonAI', 'NetworkController'];
const HUMAN = ['identity', 'position', 'vitals', 'stats', 'skills', 'inventory', 'equipment', 'effects', 'combat', 'controller', 'notoriety'];
SIM.ARCHETYPES = {
  player:     { ctrl: 'PlayerController', comps: HUMAN.concat(['bank', 'magic', 'criminal']) },
  civilian:   { ctrl: 'CivilianAI',       comps: ['identity', 'position', 'vitals', 'controller', 'notoriety', 'home'] },
  merchant:   { ctrl: 'MerchantAI',       comps: ['identity', 'position', 'vitals', 'controller', 'notoriety', 'home', 'stock'] },
  guard:      { ctrl: 'GuardAI',          comps: ['identity', 'position', 'vitals', 'controller', 'notoriety', 'home', 'combat'] },
  adventurer: { ctrl: 'AdventurerAI',     comps: HUMAN.concat(['magic', 'criminal']) },
  hireling:   { ctrl: 'HirelingAI',       comps: HUMAN },
  criminal:   { ctrl: 'CriminalAI',       comps: ['identity', 'position', 'vitals', 'combat', 'controller', 'notoriety', 'inventory', 'home'] },
  monster:    { ctrl: 'MonsterAI',        comps: ['identity', 'position', 'vitals', 'combat', 'controller', 'home', 'loot'] },
  animal:     { ctrl: 'AnimalAI',         comps: ['identity', 'position', 'vitals', 'combat', 'controller', 'home', 'loot'] },
  pet:        { ctrl: 'PetAI',            comps: ['identity', 'position', 'vitals', 'combat', 'controller', 'owner'] },
  summon:     { ctrl: 'SummonAI',         comps: ['identity', 'position', 'vitals', 'combat', 'controller', 'owner'] } };
SIM.hasComponent = (archetype, comp) => !!(SIM.ARCHETYPES[archetype] && SIM.ARCHETYPES[archetype].comps.includes(comp));
SIM.controllerFor = archetype => (SIM.ARCHETYPES[archetype] || {}).ctrl || null;

/* ---------------- stable identifiers ----------------
   Unique named actors get a deterministic id from their name (npc:odile-banker); a second actor with the same name gets
   a numbered suffix in placement order (npc:quay-warden-2). Spawned actors take the next number from a persisted counter
   (mon:rat:42), so an id is never reused, even across sessions. */
SIM.slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
function newIds(state) {
  const st = Object.assign({ next: 1 }, state || {}); const used = new Set();
  return {
    named(prefix, name) { const base = prefix + ':' + SIM.slug(name); let id = base, k = 1; while (used.has(id)) id = base + '-' + (++k); used.add(id); return id; },
    seq(prefix) { let id; do id = prefix + ':' + (st.next++); while (used.has(id)); used.add(id); return id; },
    claim(id) { if (used.has(id)) return false; used.add(id); return true; },
    release(id) { used.delete(id); },
    has: id => used.has(id),
    save: () => ({ next: st.next }),
    get size() { return used.size; } };
}
SIM.newIds = newIds;

/* ---------------- registry: id → live actor ---------------- */
function newRegistry() {
  const m = new Map();
  return {
    add(id, e) { if (m.has(id) && m.get(id) !== e) throw new Error('duplicate actor id ' + id); m.set(id, e); },
    remove(id) { m.delete(id); },
    get: id => m.get(id) || null,
    has: id => m.has(id),
    ids: () => [...m.keys()],
    clear() { m.clear(); },
    get size() { return m.size; } };
}
SIM.newRegistry = newRegistry;

/* ---------------- structured events ----------------
   Every important gameplay action emits one record: { seq, t (simulation seconds), type, ...detail with actor ids }.
   Listeners see every event; only non-transient types are kept, in a ring of `cap` records, so the log never grows
   without bound. Movement is transient: it is never kept. */
SIM.EVENT_TYPES = ['ActorSpawned', 'ActorRemoved', 'ActorMoved', 'ActorDamaged', 'ActorHealed', 'ActorKilled', 'CombatStarted', 'CombatEnded',
  'ItemTransferred', 'ItemCrafted', 'CrimeCommitted', 'CrimeWitnessed', 'ResourceGathered', 'MerchantArrived', 'CampCleared', 'PopulationReplenished'];
SIM.TRANSIENT = { ActorMoved: 1 };
function newBus(opt) {
  opt = opt || {}; const cap = opt.cap || 256, clock = opt.clock || (() => 0), known = new Set(SIM.EVENT_TYPES);
  const ring = new Array(cap); let head = 0, n = 0, seq = 0; const subs = new Map(); const counts = {};
  const bus = {
    emit(type, detail) {
      if (!known.has(type)) throw new Error('unknown event type ' + type);
      const ev = Object.assign({ seq: ++seq, t: Math.round(clock() * 1000) / 1000, type }, detail || {});
      counts[type] = (counts[type] || 0) + 1;
      if (!SIM.TRANSIENT[type]) { ring[(head + n) % cap] = ev; if (n < cap) n++; else head = (head + 1) % cap; }
      for (const k of [type, '*']) { const a = subs.get(k); if (a) for (const fn of a.slice()) { try { fn(ev); } catch (e) { if (opt.onError) opt.onError(e); } } }
      return ev; },
    on(type, fn) { if (type !== '*' && !known.has(type)) throw new Error('unknown event type ' + type); let a = subs.get(type); if (!a) subs.set(type, a = []); a.push(fn); return () => { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; },
    recent(k, type) { const out = []; for (let i = n - 1; i >= 0 && (!k || out.length < k); i--) { const ev = ring[(head + i) % cap]; if (!type || ev.type === type) out.push(ev); } return out.reverse(); },
    counts: () => Object.assign({}, counts),
    clear() { head = 0; n = 0; for (const k in counts) delete counts[k]; },
    get size() { return n; }, get seq() { return seq; }, cap };
  return bus;
}
SIM.newBus = newBus;

/* ---------------- seeded random streams ----------------
   mulberry32, the same generator the world builder uses. A stream's state is one 32-bit integer, so it can be saved and
   resumed exactly. Named streams derive their seed from the world seed, so adding a stream never shifts another. */
SIM.hash32 = s => { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
function newRng(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  next.pick = arr => arr[Math.floor(next() * arr.length)];
  next.state = () => a; next.setState = s => { a = s >>> 0; };
  return next;
}
SIM.newRng = newRng;
SIM.stream = (worldSeed, name) => newRng((worldSeed ^ SIM.hash32(name)) >>> 0);

/* ---------------- one world's simulation state ----------------
   create({ clock, seed, ids }) → { ids, reg, bus, seed, adopt, drop, save }. `clock` returns simulation seconds.
   adopt(e, archetype, key) gives an entity its stable id (named when `key.name` is given, numbered otherwise) and its
   controller, and registers it. drop(e) unregisters it. A loaded save passes back what save() returned. */
SIM.create = function (opt) {
  opt = opt || {}; const saved = opt.saved || {};
  const W = { seed: (saved.seed !== undefined ? saved.seed : opt.seed !== undefined ? opt.seed : 1999) >>> 0 };
  W.ids = newIds(saved.ids); W.reg = newRegistry(); W.bus = newBus({ cap: opt.cap || 256, clock: opt.clock, onError: opt.onError });
  W.adopt = (e, archetype, key) => {
    if (!SIM.ARCHETYPES[archetype]) throw new Error('unknown archetype ' + archetype);
    key = key || {};
    if (!e.actorId) e.actorId = key.id && W.ids.claim(key.id) ? key.id : key.name ? W.ids.named(key.prefix || archetype, key.name) : W.ids.seq(key.prefix || archetype);
    e.archetype = archetype; e.ctrl = SIM.controllerFor(archetype); W.reg.add(e.actorId, e); return e.actorId; };
  W.drop = e => { if (e && e.actorId) W.reg.remove(e.actorId); };
  W.save = () => ({ v: SIM.VERSION, seed: W.seed, ids: W.ids.save() });
  return W;
};

/* ---------------- debug view of one actor (developer tools; no gameplay depends on it) ---------------- */
SIM.inspect = (e, extra) => {
  if (!e) return null; const a = e.archetype, has = c => SIM.hasComponent(a, c), r1 = v => Math.round(v * 100) / 100;
  const o = { actorId: e.actorId || null, name: e.name || null, archetype: a || null, controller: e.ctrl || null, kind: e.kind || 'player', type: e.type || e.role || null,
    pos: { x: r1(e.x), y: r1(e.y) }, state: e.state || null, target: e.target && e.target.actorId || null };
  if (has('vitals')) o.hp = [Math.round(e.hp), Math.round(e.max || 0)];
  if (has('home') && e.home) o.home = { x: r1(e.home.x), y: r1(e.home.y) };
  return Object.assign(o, extra || {});
};

if (typeof module !== 'undefined' && module.exports) module.exports = SIM; else root.SIM = SIM;
})(typeof globalThis !== 'undefined' ? globalThis : this);
</script>
