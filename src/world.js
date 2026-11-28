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
const SIM = { VERSION: 2 };   // 2: the world clock joins the saved state

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
  'ItemTransferred', 'ItemCrafted', 'CrimeCommitted', 'CrimeWitnessed', 'ResourceGathered', 'MerchantArrived', 'CampCleared', 'PopulationReplenished', 'AppearanceChanged',
  'StatChanged', 'CharacterCreated', 'AggressionRecorded', 'MurderReported', 'NotorietyChanged', 'SpellCast', 'ActorResurrected', 'CorpseLooted', 'ActorReturned'];   // ActorReturned: v0.39 a dead townsperson back home (phase 5 step 4);   // SpellCast, ActorResurrected, CorpseLooted: v0.36 NPC adventurers (phase 5 step 3); AggressionRecorded … NotorietyChanged: v0.34 law (phase 5 step 2); AppearanceChanged: v0.25 equipment, for the future layered sprites; StatChanged, CharacterCreated: v0.30 natural attributes and creation
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
  W.clock = SIM.newClock(saved.clock, opt.clockCfg);
  W.save = () => ({ v: SIM.VERSION, seed: W.seed, ids: W.ids.save(), clock: W.clock.save() });
  return W;
};

/* ---------------- fixed simulation step (Phase 2) ----------------
   advance(realSeconds, fn) runs fn(step) as many whole steps as the accumulated time allows, at most maxSteps per call
   (a long stall is dropped, not replayed), and returns { steps, alpha, dropped } where alpha in [0, 1) is how far the
   renderer is between the last two steps. Simulation never depends on the frame rate. */
SIM.newStepper = opt => {
  opt = opt || {}; const step = opt.step || .05, maxSteps = opt.maxSteps || 5; let acc = 0;
  return { step, maxSteps,
    advance(dt, fn) { if (!(dt > 0)) dt = 0; acc += dt; let n = 0; while (acc >= step - 1e-9 && n < maxSteps) { acc -= step; n++; fn(step); } let dropped = 0; if (acc >= step) { dropped = acc - acc % step; acc %= step; } return { steps: n, alpha: Math.min(.999, Math.max(0, acc / step)), dropped }; },
    reset() { acc = 0; }, get acc() { return acc; } };
};

/* ---------------- the world clock (Phase 2, master spec §5) ----------------
   Time of day is a pure function of simulation seconds: hour = (t · 24 / day length + offset) mod 24. The offset is the
   only clock state; setting the time moves it, so simulation time itself never jumps. Real time while the game is closed
   does not count (simulation seconds only advance while the game runs). */
SIM.CLOCK = { dayMinutes: 120, startHour: 9 };
SIM.PERIODS = [['deepnight', 0, 5], ['dawn', 5, 7], ['day', 7, 17], ['sunset', 17, 19], ['night', 19, 24]];
SIM.periodOf = h => { h = ((h % 24) + 24) % 24; for (const [n, a, b] of SIM.PERIODS) if (h >= a && h < b) return n; return 'deepnight'; };
SIM.newClock = (saved, cfg) => {
  cfg = Object.assign({}, SIM.CLOCK, cfg || {}); saved = saved || {};
  const c = { dayMinutes: saved.dayMinutes || cfg.dayMinutes, offset: saved.offset !== undefined ? saved.offset : cfg.startHour };
  const perSec = () => 24 / (c.dayMinutes * 60);
  return {
    hourAt: t => (((t * perSec() + c.offset) % 24) + 24) % 24,
    dayAt: t => Math.floor((t * perSec() + c.offset) / 24) + 1,
    periodAt(t) { return SIM.periodOf(this.hourAt(t)); },
    setHour(t, h) { c.offset = (((h - t * perSec()) % 24) + 24) % 24; },              // move the clock, not the simulation
    setDayMinutes(t, m) { const h = this.hourAt(t); c.dayMinutes = m; this.setHour(t, h); },
    secondsPerHour: () => c.dayMinutes * 60 / 24,
    save: () => ({ dayMinutes: c.dayMinutes, offset: c.offset }),
    get dayMinutes() { return c.dayMinutes; } };
};
SIM.fmtHour = h => { const m = Math.floor(((h % 24) + 24) % 24 * 60 + 1e-6) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

/* outdoor light by hour (§6): `dark` is the overlay opacity (night stays readable, at most .62), `col` its colour.
   Key frames give a cool blue night, a warm dawn and an orange-red sunset; values between them blend smoothly. */
SIM.LIGHT_KEYS = [[0, .62, [8, 12, 40]], [4.6, .62, [8, 12, 40]], [5.6, .42, [44, 26, 46]], [6.4, .24, [150, 80, 26]], [7.4, 0, [150, 96, 40]], [16.6, 0, [170, 80, 20]],
  [17.6, .22, [190, 84, 14]], [18.5, .34, [150, 44, 24]], [19.4, .5, [24, 16, 52]], [20.5, .62, [8, 12, 40]], [24, .62, [8, 12, 40]]];
SIM.lightAt = h => {
  h = ((h % 24) + 24) % 24; const K = SIM.LIGHT_KEYS; let i = 0; while (i < K.length - 2 && h >= K[i + 1][0]) i++;
  const [h0, d0, c0] = K[i], [h1, d1, c1] = K[i + 1], k = h1 > h0 ? (h - h0) / (h1 - h0) : 0, s = k * k * (3 - 2 * k), mix = (a, b) => a + (b - a) * s;
  return { dark: mix(d0, d1), col: [0, 1, 2].map(j => Math.round(mix(c0[j], c1[j]))), period: SIM.periodOf(h) };
};

/* ---------------- grid search (Phase 2, §14) ----------------
   newSearch({ sx, sy, gx, gy, passable(x, y), canStep(x, y, nx, ny), cost(x, y) ≥ minCost, minCost, maxNodes, goalR, bounds }) is an A* over
   tiles, 8-connected, with no corner cutting. It runs in slices: step(budget) expands at most `budget` nodes and returns
   'running', 'found' or 'failed' (reason 'budget' when maxNodes is spent, 'unreachable' when the open set empties).
   The start tile is always accepted (an actor may stand against a trunk); the goal is reached within goalR tiles. */
function heap() { const a = []; return { push(f, k) { a.push([f, k]); let i = a.length - 1; while (i) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } },
  pop() { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; },
  get size() { return a.length; } }; }
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
SIM.newSearch = o => {
  const KW = 1 << 16, key = (x, y) => y * KW + x, minC = o.minCost || 1, maxNodes = o.maxNodes || 20000, goalR = o.goalR || 0, b = o.bounds;
  const cost = o.cost || (() => 1), pass = o.passable;
  const oct = (x, y) => { const dx = Math.abs(x - o.gx), dy = Math.abs(y - o.gy); return (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy)) * minC; };
  const g = new Map(), par = new Map(), closed = new Set(), open = heap(); const k0 = key(o.sx, o.sy); g.set(k0, 0); open.push(oct(o.sx, o.sy), k0);
  const s = { status: 'running', path: null, expanded: 0, reason: null };
  const inB = (x, y) => !b || (x >= b[0] && y >= b[1] && x <= b[2] && y <= b[3]);
  s.step = budget => {
    if (s.status !== 'running') return s.status; let n = 0;
    while (open.size && n < budget) {
      const [, k] = open.pop(); if (closed.has(k)) continue; closed.add(k); n++; s.expanded++;
      const x = k % KW, y = (k - x) / KW;
      if (Math.hypot(x - o.gx, y - o.gy) <= goalR + 1e-9) { const path = []; let c = k; while (c !== undefined) { const cx = c % KW; path.push([cx, (c - cx) / KW]); c = par.get(c); } s.path = path.reverse(); s.status = 'found'; return s.status; }
      if (s.expanded >= maxNodes) { s.status = 'failed'; s.reason = 'budget'; return s.status; }
      const gk = g.get(k);
      for (const [dx, dy, len] of DIRS) {
        const nx = x + dx, ny = y + dy; if (!inB(nx, ny) || !pass(nx, ny)) continue;
        if (dx && dy && (!pass(x + dx, y) || !pass(x, y + dy))) continue;           // no squeezing between two blocked corners
        if (o.canStep && !o.canStep(x, y, nx, ny)) continue;                          // walls and doors that lie on tile edges
        const nk = key(nx, ny); if (closed.has(nk)) continue; const ng = gk + len * Math.max(minC, cost(nx, ny));
        if (ng < (g.has(nk) ? g.get(nk) : Infinity)) { g.set(nk, ng); par.set(nk, k); open.push(ng + oct(nx, ny), nk); }
      }
    }
    if (!open.size && s.status === 'running') { s.status = 'failed'; s.reason = 'unreachable'; }
    return s.status; };
  return s;
};
SIM.findPath = o => { const s = SIM.newSearch(o); s.step(Infinity); return s; };
/* string-pull a tile path into few waypoints: keep a corner only where the straight line to a later point is not clear */
SIM.smoothPath = (path, clear) => {
  if (!path || path.length < 3) return path ? path.slice() : []; const out = [path[0]]; let i = 0;
  while (i < path.length - 1) { let j = path.length - 1; while (j > i + 1 && !clear(path[i][0], path[i][1], path[j][0], path[j][1])) j--; out.push(path[j]); i = j; }
  return out;
};

/* ---------------- the travel graph (§14): regional waypoints for long journeys ----------------
   Nodes are towns, road points, junctions, gates, piers and stairs. 'walk' edges are followed with local paths;
   'travel' edges (ferry, boat, moongate, stairs) move an actor across in one action. route() is Dijkstra. */
SIM.newNavGraph = () => {
  const nodes = new Map(), adj = new Map();
  const G = {
    addNode(id, n) { nodes.set(id, Object.assign({ id }, n)); if (!adj.has(id)) adj.set(id, []); return id; },
    addEdge(a, b, e) { e = e || {}; if (!nodes.has(a) || !nodes.has(b) || a === b) return; const A = nodes.get(a), B = nodes.get(b);
      const c = e.cost !== undefined ? e.cost : Math.hypot(A.x - B.x, A.y - B.y), kind = e.kind || 'walk';
      if (!adj.get(a).some(x => x.to === b && x.kind === kind)) adj.get(a).push({ to: b, cost: c, kind, via: e.via || null });
      if (!e.oneWay && !adj.get(b).some(x => x.to === a && x.kind === kind)) adj.get(b).push({ to: a, cost: c, kind, via: e.via || null }); },
    node: id => nodes.get(id) || null, edges: id => adj.get(id) || [], ids: () => [...nodes.keys()],
    get size() { return nodes.size; },
    nearest(x, y, pred) { let best = null, bd = Infinity; for (const n of nodes.values()) { if (pred && !pred(n)) continue; const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n; } } return best; },
    route(from, to) {
      if (!nodes.has(from) || !nodes.has(to)) return null; const dist = new Map([[from, 0]]), prev = new Map(), h = heap(); h.push(0, from); const done = new Set();
      while (h.size) { const [d, id] = h.pop(); if (done.has(id)) continue; done.add(id); if (id === to) break;
        for (const e of adj.get(id)) { const nd = d + e.cost; if (nd < (dist.has(e.to) ? dist.get(e.to) : Infinity)) { dist.set(e.to, nd); prev.set(e.to, { from: id, e }); h.push(nd, e.to); } } }
      if (!dist.has(to)) return null; const legs = []; let c = to; while (c !== from) { const p = prev.get(c); legs.push({ from: p.from, to: c, kind: p.e.kind, via: p.e.via }); c = p.from; }
      return { cost: dist.get(to), legs: legs.reverse() }; } };
  return G;
};

/* a small least-recently-used cache (paths between tiles) */
SIM.newLRU = cap => { const m = new Map(); return { get(k) { if (!m.has(k)) return undefined; const v = m.get(k); m.delete(k); m.set(k, v); return v; },
  set(k, v) { if (m.has(k)) m.delete(k); m.set(k, v); if (m.size > cap) m.delete(m.keys().next().value); }, clear() { m.clear(); }, get size() { return m.size; } }; };

/* ================= Phase 3: the monster ecosystem (master spec §9–13, §15–16) =================
   Pure parts only: the faction table, perception, activity hours, decisions with commitment, a spatial index and camp
   population bookkeeping. The game (src/ecology.js) owns the species profiles and drives the creatures with these. */

/* ---------------- factions and relationships (§11) ----------------
   Five levels. Same faction is friendly unless a pair says otherwise; an unlisted pair is neutral. Relationships are
   symmetric. Faction hostility is not a crime: law (notoriety, guards) is evaluated separately in phase 5. Predation is a
   species matter (a profile's prey list), not a faction level: wolves hunt deer without wildlife being "hostile". */
SIM.RELATIONS = ['hostile', 'suspicious', 'neutral', 'friendly', 'allied'];
SIM.HUMANS = ['adventurers', 'citizens', 'guards', 'merchants', 'criminals', 'murderers'];
SIM.FACTION_LIST = SIM.HUMANS.concat(['orcs', 'goblins', 'undead', 'predators', 'wildlife', 'vermin', 'arachnids', 'lizardfolk', 'giants', 'harpies', 'elementals', 'constructs', 'oozes', 'dragons']);
SIM.NOT_LIVING = ['undead', 'elementals', 'constructs'];
SIM.FACTION_RULES = (() => {
  const H = SIM.HUMANS, r = [];
  const all = (f, others, rel) => { for (const o of others) if (o !== f) r.push([f, o, rel]); };
  r.push(['guards', 'citizens', 'allied'], ['guards', 'merchants', 'allied'], ['citizens', 'merchants', 'allied'],
    ['adventurers', 'citizens', 'friendly'], ['adventurers', 'guards', 'friendly'], ['adventurers', 'merchants', 'friendly'],
    ['guards', 'criminals', 'hostile'], ['guards', 'murderers', 'hostile'], ['citizens', 'criminals', 'suspicious'], ['merchants', 'criminals', 'suspicious'],
    ['citizens', 'murderers', 'suspicious'], ['merchants', 'murderers', 'suspicious'], ['adventurers', 'criminals', 'hostile'], ['adventurers', 'murderers', 'suspicious'],
    ['criminals', 'murderers', 'friendly'], ['orcs', 'goblins', 'friendly'], ['orcs', 'lizardfolk', 'hostile'], ['orcs', 'giants', 'hostile'], ['orcs', 'predators', 'hostile'],
    ['predators', 'predators', 'neutral'], ['wildlife', 'wildlife', 'neutral'], ['lizardfolk', 'giants', 'suspicious']);
  for (const f of ['orcs', 'goblins', 'predators', 'vermin', 'arachnids', 'lizardfolk', 'giants', 'harpies', 'elementals', 'constructs', 'oozes', 'dragons']) all(f, H, 'hostile');
  all('undead', SIM.FACTION_LIST.filter(f => !SIM.NOT_LIVING.includes(f)), 'hostile');   // undead against every living thing
  all('dragons', SIM.FACTION_LIST.filter(f => f !== 'dragons'), 'hostile');              // dragons against intruders
  return r; })();
SIM.newFactions = (rules, opt) => {
  opt = opt || {}; const m = new Map(), lv = SIM.RELATIONS, self = opt.self || 'friendly', names = new Set(opt.names || SIM.FACTION_LIST);
  const key = (a, b) => a < b ? a + '|' + b : b + '|' + a;
  const F = {
    set(a, b, rel) { if (!lv.includes(rel)) throw new Error('unknown relationship ' + rel); names.add(a); names.add(b); m.set(key(a, b), rel); },
    rel(a, b) { if (!a || !b) return 'neutral'; const k = m.get(key(a, b)); return k || (a === b ? self : 'neutral'); },
    level: (a, b) => lv.indexOf(F.rel(a, b)) - 2,      // -2 hostile … +2 allied
    hostile: (a, b) => F.rel(a, b) === 'hostile',
    friendly: (a, b) => F.level(a, b) >= 1,
    names: () => [...names],
    matrix() { const n = [...names], o = {}; for (const a of n) { o[a] = {}; for (const b of n) o[a][b] = F.rel(a, b); } return o; } };
  for (const [a, b, rel] of rules || []) F.set(a, b, rel);
  return F;
};

/* ---------------- activity hours (§9) ----------------
   day: active by daylight, resting at night, asleep in the small hours. night: the reverse (undead are dormant, not asleep,
   by day). dusk: crepuscular hunters, active from sunset through dawn. always: never rests. */
SIM.ACTIVITY = {
  day:    { dawn: 'active', day: 'active', sunset: 'active', night: 'rest', deepnight: 'sleep' },
  night:  { dawn: 'rest', day: 'rest', sunset: 'active', night: 'active', deepnight: 'active' },
  dusk:   { dawn: 'active', day: 'rest', sunset: 'active', night: 'active', deepnight: 'active' },
  always: { dawn: 'active', day: 'active', sunset: 'active', night: 'active', deepnight: 'active' } };
SIM.activityOf = (hours, period) => (SIM.ACTIVITY[hours] || SIM.ACTIVITY.always)[period] || 'active';

/* ---------------- perception (§13) ----------------
   senseRange(p, c): p = { sight, hear, nightVision 0..1 }, c = { dark 0..1, activity, alert }. Darkness shortens sight for
   creatures without night vision (to half at full night), sleep cuts it hard and resting a little; an alerted creature
   (recently hurt or called) sees a little further. detect(p, c, d, o): o = { los, moving, noisy, hidden } → 'seen' | 'heard' | null.
   A hidden target is never seen or heard from range; only something standing almost on top of it can stumble over it. */
SIM.SENSE = { nightCut: .5, darkRef: .62, sleep: .3, rest: .8, alert: 1.25, stumble: 1.2 };
SIM.senseRange = (p, c) => {
  c = c || {}; const S = SIM.SENSE, dk = Math.min(1, Math.max(0, (c.dark || 0) / S.darkRef));
  let sight = p.sight * (1 - dk * (1 - (p.nightVision || 0)) * S.nightCut), hear = p.hear || 0;
  const k = c.activity === 'sleep' ? S.sleep : c.activity === 'rest' ? S.rest : 1; sight *= k; hear *= c.activity === 'sleep' ? .5 : 1;
  if (c.alert) { sight *= S.alert; hear *= S.alert; }
  return { sight, hear };
};
SIM.detect = (p, c, d, o) => {
  o = o || {}; if (o.hidden) return d <= SIM.SENSE.stumble ? 'seen' : null;
  const r = SIM.senseRange(p, c);
  if (d <= r.sight && o.los) return 'seen';
  if (d <= r.hear && (o.moving || o.noisy)) return 'heard';
  return null;
};

/* ---------------- decisions with commitment and hysteresis (§12) ----------------
   decide(mem, options, t, cfg): options = [{ act, score, why, force }]. The current act is kept while it is still offered
   and its commitment time has not run out; after that a different act must beat it by `margin`. A forced option (death,
   a fresh wound when cowardly) overrides commitment. mem is the actor's own plain record: { act, at, score, why }.
   An act that is no longer offered (impossible) is dropped at once and the best remaining option is chosen. */
SIM.decide = (mem, options, t, cfg) => {
  cfg = cfg || {}; const commit = cfg.commit !== undefined ? cfg.commit : 2, margin = cfg.margin !== undefined ? cfg.margin : .15;
  let best = null; for (const o of options) if (!best || o.score > best.score) best = o;
  if (!best) { mem.act = null; mem.why = 'nothing to do'; return null; }
  const forced = options.find(o => o.force && o.act !== mem.act);
  const cur = mem.act ? options.find(o => o.act === mem.act) : null;
  let pick = best;
  if (forced) pick = forced;
  else if (cur && best.act !== cur.act && (t - (mem.at || 0) < commit || best.score < cur.score + margin)) pick = cur;
  if (pick.act !== mem.act) { mem.act = pick.act; mem.at = t; mem.switches = (mem.switches || 0) + 1; }
  mem.score = pick.score; mem.why = pick.why || pick.act; return pick;
};

/* ---------------- spatial index (§25, pulled into phase 3) ----------------
   A uniform hash grid of `cell`-metre squares. add/move/remove keep an entity in one cell (its key is stored on it as _gk);
   query(x, y, r, fn) visits every entity within r. Replaces the all-against-all scans. */
SIM.newGrid = (cell) => {
  cell = cell || 8; const cells = new Map(); let n = 0;
  const key = (x, y) => (Math.floor(x / cell) & 0xffff) * 65536 + (Math.floor(y / cell) & 0xffff);
  const G = {
    cell,
    add(e) { if (e._gk !== undefined) return G.move(e); const k = key(e.x, e.y); let s = cells.get(k); if (!s) cells.set(k, s = []); s.push(e); e._gk = k; n++; },
    remove(e) { if (e._gk === undefined) return; const s = cells.get(e._gk); if (s) { const i = s.indexOf(e); if (i >= 0) { s[i] = s[s.length - 1]; s.pop(); n--; } if (!s.length) cells.delete(e._gk); } e._gk = undefined; },
    move(e) { if (e._gk === undefined) return G.add(e); const k = key(e.x, e.y); if (k === e._gk) return; G.remove(e); G.add(e); },
    query(x, y, r, fn) { const x0 = Math.floor((x - r) / cell), x1 = Math.floor((x + r) / cell), y0 = Math.floor((y - r) / cell), y1 = Math.floor((y + r) / cell), r2 = r * r;
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { const s = cells.get((cx & 0xffff) * 65536 + (cy & 0xffff)); if (!s) continue;
        for (let i = 0; i < s.length; i++) { const e = s[i], dx = e.x - x, dy = e.y - y; if (dx * dx + dy * dy <= r2) fn(e); } } },
    near(x, y, r) { const out = []; G.query(x, y, r, e => out.push(e)); return out; },
    clear() { for (const s of cells.values()) for (const e of s) e._gk = undefined; cells.clear(); n = 0; },
    get size() { return n; }, get cells() { return cells.size; } };
  return G;
};

/* ---------------- camp populations (§16) ----------------
   newCamp({ id, cap, recover, trickle }, saved): a camp is populated up to cap. When its last member dies after it had been
   populated, it is cleared: the time is recorded and nothing returns for `recover` seconds; then one member returns every
   `trickle` seconds until the camp is full again. Essential content never goes extinct: recovery always ends. Only the
   clearance record is saved; members are counted live. */
SIM.newCamp = (def, saved) => {
  saved = saved || {}; const C = { id: def.id, cap: def.cap, recover: def.recover || 1200, trickle: def.trickle || 90,
    alive: 0, ever: !!saved.ever, cleared: !!saved.cleared, clearedAt: saved.clearedAt ?? null, nextAt: saved.nextAt ?? 0, clears: saved.clears || 0 };
  C.recovering = t => C.cleared && t >= C.clearedAt + C.recover;
  C.canSpawn = t => { if (C.alive >= C.cap) return false; if (!C.cleared) return true; return C.recovering(t) && t >= C.nextAt; };
  C.spawned = t => { C.alive++; C.ever = true; let ev = null; if (C.cleared) { ev = 'recovering'; C.nextAt = t + C.trickle; if (C.alive >= C.cap) { C.cleared = false; ev = 'recovered'; } } return ev; };   // every return after a clearance is a replenishment
  C.died = t => { C.alive = Math.max(0, C.alive - 1); if (C.alive === 0 && C.ever && !C.cleared) { C.cleared = true; C.clearedAt = t; C.nextAt = t + C.recover; C.clears++; return 'cleared'; } return null; };
  C.removed = () => { C.alive = Math.max(0, C.alive - 1); };           // a member left without dying (unloaded, tamed): no clearance
  C.save = () => ({ ever: C.ever, cleared: C.cleared, clearedAt: C.clearedAt, nextAt: C.nextAt, clears: C.clears });
  return C;
};

/* ================= Phase 4: living NPCs (master spec §7) =================
   Pure parts: daily schedules on the world clock, lightweight needs, and a short memory of significant encounters. The game
   (src/townlife.js) owns homes, workplaces, professions and the controllers that walk townsfolk through their day. */

/* ---------------- daily schedules ----------------
   A schedule is a list of blocks [fromHour, toHour, act, place] covering the day; a block may wrap midnight (22 → 5.5).
   scheduleAt(blocks, hour) → { act, place, from, to, i }. Schedules are preferences: the controller may override them
   (danger, hunger, exhaustion). validSchedule checks that the blocks cover all 24 hours without overlap. */
const inBlock = (h, a, b) => a <= b ? h >= a && h < b : h >= a || h < b;
SIM.scheduleAt = (blocks, hour) => {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 0; i < blocks.length; i++) { const [a, b, act, place] = blocks[i]; if (inBlock(h, a, b)) return { act, place, from: a, to: b, i }; }
  return null;
};
SIM.validSchedule = blocks => {
  const len = ([a, b]) => ((b - a) % 24 + 24) % 24 || 24; let tot = 0; for (const bl of blocks) tot += len(bl);
  if (Math.abs(tot - 24) > 1e-6) return false;
  for (let k = 0; k < 96; k++) { const h = k / 4 + .01; if (blocks.filter(([a, b]) => inBlock(h, a, b)).length !== 1) return false; }
  return true;
};
/* hours until the next block starts (for leaving early enough to arrive on time) */
SIM.hoursUntil = (from, to) => ((to - from) % 24 + 24) % 24;

/* ---------------- needs (§7: hunger, fatigue, safety, wealth, work, social) ----------------
   Values run 0 (satisfied) … 1 (urgent). They rise with game hours and fall while the matching activity runs. Kept small on
   purpose: they bend the schedule (an early meal, an early night, a visit to the hall), they never replace it. Safety is not
   a slow need: it is set by what the NPC perceives and decays within minutes. */
SIM.NEEDS = {
  hunger:  { rise: 1 / 9,  fall: { eat: 3, social: .8 } },             // a full meal every ~9 hours; the evening gathering is supper
  fatigue: { rise: 1 / 17, fall: { sleep: 1 / 6 } },                   // ~17 waking hours; six hours of sleep restore it
  social:  { rise: 1 / 20, fall: { social: 1.2, eat: .4 } },
  work:    { rise: 1 / 16, fall: { work: .5, gather: .5, trade: .5, patrol: .5, watch: .5 } },
  safety:  { rise: 0, decay: 6 } };                                    // set on fright, falls back over ~10 game minutes
SIM.newNeeds = saved => Object.assign({ hunger: .2, fatigue: .1, social: .3, work: .3, safety: 0, wealth: .5 }, saved || {});
SIM.needsTick = (n, hours, act) => {
  for (const k of ['hunger', 'fatigue', 'social', 'work']) {
    const d = SIM.NEEDS[k], fall = d.fall[act] || 0, rise = act === 'sleep' && k !== 'fatigue' ? d.rise * .3 : d.rise;
    n[k] = Math.min(1, Math.max(0, n[k] + (rise - fall) * hours));
  }
  n.safety = Math.max(0, n.safety - SIM.NEEDS.safety.decay * hours);
  return n;
};
SIM.frighten = (n, amount) => { n.safety = Math.min(1, Math.max(n.safety, amount)); return n; };
SIM.urgentNeed = n => { let best = null, v = .8; for (const k of ['safety', 'fatigue', 'hunger']) if (n[k] >= v) { v = n[k]; best = k; } return best; };

/* ---------------- memory of significant encounters ----------------
   A small ring per NPC: { t, what, who, where }. Repeats of the same thing with the same actor within `merge` seconds update
   the newest record instead of adding one, so memory stays meaningful and bounded. */
SIM.newMemory = (cap, saved) => {
  cap = cap || 8; const list = (saved || []).slice(-cap);
  return {
    note(t, what, who, where, merge) { const last = list[list.length - 1]; if (last && last.what === what && last.who === (who || null) && t - last.t < (merge ?? 60)) { last.t = t; last.n = (last.n || 1) + 1; return last; }
      const r = { t, what, who: who || null, where: where || null }; list.push(r); if (list.length > cap) list.shift(); return r; },
    recent: k => list.slice(-(k || cap)), knows: (what, who) => list.some(r => r.what === what && (!who || r.who === who)),
    save: () => list.map(r => Object.assign({}, r)), get size() { return list.length; } };
};

/* ================= Phase 5 step 2: law — notoriety, aggression, criminal flags and murder counts (master spec §19) =================
   Pure and deterministic: actors are ids, time is simulation seconds (it only runs while the game runs, so "active time").
   · Notoriety: innocent (blue), criminal (grey, a timed flag), murderer (red: `red` or more long-term counts). Wildlife and
     monsters have no notoriety at all (SIM.hasComponent(…, 'notoriety')); the game never asks for one.
   · Aggression records { attacker, victim, owner, victimOwner, t, region, lawful, selfDefence, expires }. Attacking an innocent is lawful only
     with a right over them: they attacked you (or your pet / summon) first and that record has not expired. Attacking a
     criminal or a murderer is always lawful. A pet's or summon's attack is the owner's responsibility.
   · An unlawful attack, a theft or another crime sets the criminal flag on the responsible actor for `criminal` seconds.
   · A murder (an innocent killed by someone with no right over them) adds one count to the killer, once per victim death
     (the caller names the death with a key). Each count stays short-term for `shortDecay` and long-term for `longDecay`. */
SIM.LAW_DEFAULTS = { criminal: 120, aggression: 120, shortDecay: 8 * 3600, longDecay: 40 * 3600, red: 5, maxRecords: 96, maxDeaths: 256 };
SIM.NOTORIETY = { innocent: 'blue', criminal: 'grey', murderer: 'red', ally: 'green', enemy: 'orange' };
SIM.newLaw = (saved, cfg) => {
  const C = Object.assign({}, SIM.LAW_DEFAULTS, cfg || {}); saved = saved || {};
  let recs = (saved.recs || []).map(r => Object.assign({}, r)); const flags = Object.assign({}, saved.flags || {}), counts = {}, deaths = (saved.deaths || []).slice(-C.maxDeaths);
  for (const k in saved.counts || {}) counts[k] = saved.counts[k].filter(Number.isFinite).slice(-64);
  const stats = Object.assign({ aggressions: 0, unlawful: 0, crimes: 0, murders: 0, reports: 0 }, saved.stats || {});
  const fin = v => Number.isFinite(v) ? v : 0;
  const L = {
    cfg: C, stats,
    flagged: (id, t) => fin(flags[id]) > t,
    flagLeft: (id, t) => Math.max(0, fin(flags[id]) - t),
    counts(id, t) { const c = counts[id] || []; return { short: c.filter(x => t - x < C.shortDecay).length, long: c.filter(x => t - x < C.longDecay).length }; },
    notoriety(id, t) { if (L.counts(id, t).long >= C.red) return 'murderer'; return L.flagged(id, t) ? 'criminal' : 'innocent'; },
    /* does `a` have a right over `v` right now? (v attacked a, or a's pet or summon, and that record has not expired). A record of v
       fighting back in self-defence gives the aggressor no right (v0.36): an innocent who defends itself stays protected, as in UO. */
    rights(a, v, t) { return recs.some(r => !r.selfDefence && (r.attacker === v || r.owner === v) && (r.victim === a || r.victimOwner === a) && t < r.expires); },
    lawfulAttack(a, v, t, owner) { const who = owner || a; return L.notoriety(v, t) !== 'innocent' || L.rights(who, v, t) || (!!owner && L.rights(a, v, t)); },
    /* record an attack; o: { owner, victimOwner, region, human } — human:false (a creature) is never a crime. Returns { rec, crime, fresh }. */
    aggress(a, v, t, o) {
      o = o || {}; if (!a || !v || a === v) return null; const owner = o.owner && o.owner !== a ? o.owner : null, who = owner || a;
      const lawful = o.human === false || L.lawfulAttack(a, v, t, owner), selfDefence = o.human !== false && L.rights(who, v, t);
      let rec = recs.find(r => r.attacker === a && r.victim === v && t < r.expires), fresh = !rec;
      if (rec) { rec.expires = t + C.aggression; rec.t = t; if (!lawful && rec.lawful) { rec.lawful = false; fresh = true; } }
      else { rec = { attacker: a, victim: v, owner, victimOwner: o.victimOwner || null, t, region: o.region || null, lawful, selfDefence, expires: t + C.aggression }; recs.push(rec); if (recs.length > C.maxRecords) recs.shift(); }
      stats.aggressions += fresh ? 1 : 0;
      if (!lawful) { if (fresh) stats.unlawful++; flags[who] = Math.max(fin(flags[who]), t + C.criminal); }
      return { rec, crime: !lawful, fresh };
    },
    crime(id, t, what) { if (!id) return false; flags[id] = Math.max(fin(flags[id]), t + C.criminal); stats.crimes++; return true; },
    /* would killing `v` be a murder by `k` (or k's owner) right now? */
    isMurder(k, v, t, owner) { return !!k && !!v && k !== v && !L.lawfulAttack(k, v, t, owner); },
    /* count a murder once per victim death (key). Returns { counted, short, long, red } — red: this count made them a murderer. */
    murder(k, v, t, key, owner) {
      if (!key || deaths.includes(key)) return { counted: false, dup: true };
      if (!L.isMurder(k, v, t, owner)) { deaths.push(key); if (deaths.length > C.maxDeaths) deaths.shift(); return { counted: false }; }
      return L.count(owner || k, t, key);
    },
    /* add one count for a death already judged a murder (a report); once per key */
    count(who, t, key) {
      if (!who || !key || deaths.includes(key)) return { counted: false, dup: true }; deaths.push(key); if (deaths.length > C.maxDeaths) deaths.shift();
      const was = L.notoriety(who, t); (counts[who] = counts[who] || []).push(t); if (counts[who].length > 64) counts[who].shift(); stats.murders++;
      return Object.assign({ counted: true, red: was !== 'murderer' && L.notoriety(who, t) === 'murderer' }, L.counts(who, t));
    },
    reported() { stats.reports++; },
    records: id => recs.filter(r => !id || r.attacker === id || r.victim === id || r.owner === id).map(r => Object.assign({}, r)),
    /* drop what has expired; counts older than the long-term decay are gone for good */
    prune(t) { recs = recs.filter(r => t < r.expires); for (const k in flags) if (!(flags[k] > t)) delete flags[k]; for (const k in counts) { counts[k] = counts[k].filter(x => t - x < C.longDecay); if (!counts[k].length) delete counts[k]; } },
    clear(id) { delete flags[id]; delete counts[id]; recs = recs.filter(r => r.attacker !== id && r.victim !== id); },
    save(t) { if (Number.isFinite(t)) L.prune(t); return { v: 1, recs: recs.map(r => Object.assign({}, r)), flags: Object.assign({}, flags), counts: JSON.parse(JSON.stringify(counts)), deaths: deaths.slice(), stats: Object.assign({}, stats) }; } };
  return L;
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

/* ================= Phase 6: simulation tiers and world-state persistence (master spec §25–26) =================
   Tiers. Every actor away from the player gets one of three levels of detail:
     A — local: every 50 ms step (full movement, collision, combat, perception, animation, sound).
     B — regional: one step in `bEvery`, with the skipped time handed over (reduced decisions, coarser movement, never drawn).
     C — distant: not stepped at all. Creatures hold where they are; townsfolk follow their schedule abstractly and are
         placed where the day has taken them when they come back into range (src/tiers.js). Populations, camps, the clock
         and saving carry on for the whole world.
   Radius A follows the camera (§25: "adjusted to actual camera scale"): it is never smaller than the farthest corner of the
   screen plus a margin, so nothing on screen ever runs at the reduced rate. A small hysteresis keeps an actor on the
   boundary from flipping tier every step. Pure: the game measures the screen and distances. */
SIM.TIER = { A: 40, B: 120, gapB: 60, margin: 8, hyst: 6, bEvery: 4 };
/* the distance in metres from the player to the farthest visible corner, for a screen of halfW × halfH world pixels and the
   isometric projection SX = (x − y)·hw, SY = (x + y)·hh */
SIM.viewRadius = (halfW, halfH, hw, hh) => { const a = halfW / (hw || 32), b = halfH / (hh || 16); return Math.sqrt((a * a + b * b) / 2); };
SIM.tierRadii = (viewR, cfg) => { cfg = cfg || SIM.TIER; const a = Math.max(cfg.A, (viewR || 0) + cfg.margin); return { a, b: Math.max(cfg.B, a + cfg.gapB) }; };
SIM.tierOf = (d, prev, radii, hyst) => {
  const h = hyst === undefined ? SIM.TIER.hyst : hyst;
  if (d <= radii.a + (prev === 'A' ? h : 0)) return 'A';
  if (d <= radii.b + (prev === 'A' || prev === 'B' ? h : 0)) return 'B';
  return 'C';
};
/* is this the step an actor of this tier runs? Tier B actors are staggered by id so a quarter of them run each step */
SIM.tierDue = (tier, stepN, id, every) => tier === 'A' ? true : tier === 'B' ? ((stepN + (id | 0)) % (every || SIM.TIER.bEvery)) === 0 : false;

/* Population persistence. Spawned creatures are saved one by one (§26: regional populations, actor identity), as compact
   rows, so a region the player thinned out stays thin after a reload and every creature keeps its id:
     [actorId, type, spawnerKey, x, y, hp, homeX, homeY, packId, flags, purse, fedAgo]   flags: 1 pack leader · 2 hidden
   unpackCreatures validates rows before anything is spawned from them: unknown species or spawners, broken numbers, a
   repeated id and more creatures than a spawner can hold are dropped (and counted), never duplicated. */
SIM.POP_VERSION = 1;
const r1 = v => Math.round(v * 10) / 10;
SIM.packCreatures = list => list.map(c => [c.id, c.type, c.sp, r1(c.x), r1(c.y), Math.max(1, Math.round(c.hp)), r1(c.hx), r1(c.hy), c.pack | 0, (c.lead ? 1 : 0) | (c.hidden ? 2 : 0), c.purse | 0, Math.max(0, Math.round(c.fedAgo || 0))]);
SIM.unpackCreatures = (rows, o) => {
  const out = [], seen = new Set(), per = new Map(); let dropped = 0; const why = {};
  const drop = k => { dropped++; why[k] = (why[k] || 0) + 1; };
  const fin = v => typeof v === 'number' && Number.isFinite(v);
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!Array.isArray(r) || r.length < 8) { drop('shape'); continue; }
    const [id, type, sp, x, y, hp, hx, hy, pack, flags, purse, fedAgo] = r;
    if (typeof id !== 'string' || !id) { drop('id'); continue; }
    if (seen.has(id)) { drop('duplicate'); continue; }
    if (!o.validType(type)) { drop('species'); continue; }
    const cap = o.capOf(sp); if (!cap) { drop('spawner'); continue; }
    if (![x, y, hp, hx, hy].every(fin)) { drop('number'); continue; }
    if ((per.get(sp) || 0) >= cap) { drop('over cap'); continue; }
    seen.add(id); per.set(sp, (per.get(sp) || 0) + 1);
    const max = o.maxHp(type);
    out.push({ id, type, sp, x, y, hp: Math.min(max, Math.max(1, hp)), hx, hy, pack: fin(pack) ? pack | 0 : 0, lead: !!((flags | 0) & 1), hidden: !!((flags | 0) & 2), purse: fin(purse) ? Math.max(0, purse | 0) : 0, fedAgo: fin(fedAgo) ? Math.max(0, fedAgo) : 0 });
  }
  return { list: out, dropped, why };
};

/* ---------------- NPC adventurers (§8, Living World phase 5 step 3) ----------------
   Simulated players: named, persistent, with the same skills, items, combat, First Aid, Magery and death rules as you. The
   game side is src/adventurers.js; here are the data and the pure decisions it asks for, so they can be tested in node.
   Skills are UO values (0–100) on the existing 49-skill registry: no parallel skill system. */
SIM.ADV_VERSION = 1;
SIM.ADV_CFG = {
  res: 'healer',          // resurrection policy: 'healer' (the ghost walks to a healer, returns at 25 %), 'replace' (a successor takes the place), 'none' (death is final)
  ghostWait: 240,         // seconds a ghost may take to reach a healer before one finds it
  replaceAfter: 600,      // 'replace': seconds before the successor arrives in town
  fleeAt: .3,             // health fraction that sends a brave (courage 1) adventurer running; cautious ones run earlier (×(1.6 − courage))
  bandageAt: .7, potionAt: .4, healSpellAt: .6,
  returnValue: 300,       // loot worth this much (gold and goods at shop price) sends them home to sell and bank
  stock: { bandage: 12, draught: 2, arrow: 80, reagent: 10 },   // what they buy up to in town
  short: { bandage: 2, arrow: 12, reagent: 3 },                 // below this they go home to restock
  repairBelow: .55,       // worst piece at this fraction of its durability: repair in town
  hunt: { min: 30, max: 180 }, sight: 14, leash: 24, searchFor: 40, grounds: 4,
  dayStart: 6, nightAt: 21 };
/* archetypes from the spec's list, mapped onto existing skills, weapons and armour. courage 0–1; style picks the combat routine */
SIM.ADV_STYLES = {
  swordsman: { style: 'melee', str: 80, dex: 65, int: 35, skills: { swordsmanship: 72, tactics: 70, anatomy: 62, healing: 62, parrying: 55, resistingspells: 35, wrestling: 40 },
    weapon: 'sword', shield: 'buckler', wear: ['leather_cap', 'ringmail_tunic', 'ringmail_sleeves', 'ringmail_gloves', 'ringmail_leggings', 'boots', 'shirt', 'trousers'], kit: { bandage: 12, draught: 1 }, cloth: 'navy' },
  macer:     { style: 'melee', str: 85, dex: 55, int: 30, skills: { macefighting: 72, tactics: 72, anatomy: 60, healing: 60, parrying: 40, resistingspells: 40, wrestling: 45 },
    weapon: 'mace', shield: 'metal_shield', wear: ['chain_coif', 'chain_tunic', 'chain_leggings', 'leather_gloves', 'boots', 'shirt', 'trousers'], kit: { bandage: 12, draught: 1 }, cloth: 'wine' },
  fencer:    { style: 'melee', str: 65, dex: 85, int: 35, skills: { fencing: 72, tactics: 68, anatomy: 58, healing: 58, resistingspells: 30, wrestling: 40, hiding: 30 },
    weapon: 'kryss', shield: null, wear: ['leather_cap', 'studded_tunic', 'studded_sleeves', 'studded_gloves', 'studded_leggings', 'boots', 'shirt', 'trousers'], kit: { bandage: 12, draught: 1 }, cloth: 'forest' },
  archer:    { style: 'archer', str: 65, dex: 85, int: 35, skills: { archery: 72, tactics: 68, anatomy: 55, healing: 55, resistingspells: 30, wrestling: 35, tracking: 40 },
    weapon: 'shortbow', shield: null, wear: ['leather_cap', 'leather_tunic', 'leather_sleeves', 'leather_gloves', 'leather_leggings', 'boots', 'shirt', 'trousers'], kit: { bandage: 10, arrow: 80, draught: 1 }, cloth: 'forest' },
  mage:      { style: 'mage', str: 45, dex: 35, int: 90, skills: { magery: 72, evaluatingintelligence: 65, meditation: 60, resistingspells: 55, wrestling: 45, inscription: 30 },
    weapon: null, shield: null, wear: ['robe', 'shoes', 'shirt', 'trousers'], kit: { reagent: 15, draught: 1, spellbook: 1 }, cloth: 'plum',
    spells: ['magery.42', 'magery.30', 'magery.18', 'magery.05', 'magery.29', 'magery.04', 'magery.11', 'magery.15'] },
  healer:    { style: 'healer', str: 60, dex: 45, int: 75, skills: { magery: 58, healing: 70, anatomy: 65, macefighting: 50, tactics: 50, meditation: 45, resistingspells: 45, evaluatingintelligence: 40 },
    weapon: 'mace', shield: 'buckler', wear: ['leather_cap', 'leather_tunic', 'leather_sleeves', 'leather_leggings', 'boots', 'robe', 'shirt', 'trousers'], kit: { bandage: 12, reagent: 15, draught: 1, spellbook: 1 }, cloth: 'oatmeal',
    spells: ['magery.29', 'magery.04', 'magery.11', 'magery.15', 'magery.18', 'magery.05'] } };
/* the first adventurers: name (the part after the comma is what the target frame shows), archetype, home town, courage, body.
   Nobody starts in Skara Bryn: the town stands in its woods and few hunting grounds around it can be walked to (they may still move there) */
SIM.ADV_ROSTER = [
  ['Aldric, sellsword', 'swordsman', 'vespar', .75, 'male'], ['Brenna, mace fighter', 'macer', 'mynoc', .85, 'female'], ['Corvin, fencer', 'fencer', 'mynoc', .6, 'male'],
  ['Dara, archer', 'archer', 'moonglen', .5, 'female'], ['Elsbeth, mage', 'mage', 'moonglen', .55, 'female'], ['Fenwick, healer', 'healer', 'vespar', .45, 'male']];
SIM.ADV_SUCCESSORS = ['Garet', 'Hild', 'Isolde', 'Joss', 'Kael', 'Lysa', 'Merrick', 'Nessa', 'Orrin', 'Pell', 'Quinn', 'Rowan'];

/* what to do next (the strategic layer, re-decided about once a second). s: plain numbers, no actors:
     { hpF, manaF, style, courage, inTown, night, bandages, draughts, arrows, reagents, value, worst, foe: { ratio } | null, cur, skip }
   skip: { shop, repair } — errands it just tried and could not pay for: it goes out with what it has instead of waiting forever.
   Returns { act, why[] }: 'flee' (run for town), 'town' (rest, sell, bank, restock, repair), 'return' (walk home), 'hunt'. */
SIM.advNeeds = (s, cfg) => {
  cfg = cfg || SIM.ADV_CFG; const why = [], skip = s.skip || {};
  const caster = s.style === 'mage' || s.style === 'healer', canHeal = s.bandages > 0 || s.draughts > 0 || (caster && s.reagents > 0);
  if (s.hpF < .5 && !canHeal) why.push('hurt and out of healing');
  if (!skip.shop && s.style !== 'mage' && s.bandages < cfg.short.bandage) why.push('low on bandages');
  if (!skip.shop && s.style === 'archer' && s.arrows < cfg.short.arrow) why.push('low on arrows');
  if (!skip.shop && caster && s.reagents < cfg.short.reagent) why.push('low on reagents');
  if (s.value >= cfg.returnValue) why.push('pack full of loot');
  if (!skip.repair && s.worst < cfg.repairBelow) why.push('gear needs repair');
  if (s.night && s.courage < .8) why.push('night is falling');
  return why;
};
SIM.advChoose = (s, cfg) => {
  cfg = cfg || SIM.ADV_CFG;
  if (s.foe) {
    const fleeAt = cfg.fleeAt * (1.6 - s.courage), outmatched = s.foe.ratio > 1.4 + s.courage * 2.2;
    if (s.hpF < fleeAt || outmatched) return { act: 'flee', why: [s.hpF < fleeAt ? 'badly hurt' : 'outmatched'] };
    return { act: 'fight', why: ['in a fight'] };
  }
  const need = SIM.advNeeds(s, cfg);
  if (s.inTown) {
    const town = [], skip = s.skip || {};
    if (s.hpF < .95 || (s.manaF !== null && s.manaF < .9)) town.push('resting');
    if (s.value > 0) town.push('selling loot');
    if (s.worst < .95 && !skip.repair) town.push('repairs');
    if (!skip.shop) {
      if (s.bandages < cfg.stock.bandage * .75 && s.style !== 'mage') town.push('buying bandages');
      if (s.style === 'archer' && s.arrows < cfg.stock.arrow * .75) town.push('buying arrows');
      if ((s.style === 'mage' || s.style === 'healer') && s.reagents < cfg.stock.reagent * .75) town.push('buying reagents'); }
    if (s.night && s.courage < .8) town.push('waiting for daylight');
    return town.length ? { act: 'town', why: town } : { act: 'hunt', why: ['rested and stocked'] };
  }
  if (need.length) return { act: 'return', why: need };
  return { act: 'hunt', why: [s.cur === 'hunt' ? 'still hunting' : 'setting out'] };
};
/* which creature to fight (§18: threat, distance, vulnerability, faction). cands: [{ id, dist, hpF, ratio, onMe, onFriend, hostile }] */
SIM.advTarget = (cands, courage, sight) => {
  let best = null, bs = -1e9;
  for (const c of cands) {
    if (!c.onMe && c.ratio > 1 + courage * 2) continue;                 // never start a fight it expects to lose
    const s = (c.onMe ? .8 : 0) + (c.onFriend ? .35 : 0) + (c.hostile ? .15 : 0) + .6 * (1 - Math.min(1, c.dist / (sight || 14))) + .3 * (1 - c.hpF) - .4 * Math.max(0, c.ratio - 1);
    if (s > bs || (s === bs && best && String(c.id) < String(best.id))) { bs = s; best = c; }
  }
  return best;
};
/* which spell, if any. s: { style, M, mana, hpF, poisoned, foe: { dist } | null, has(id) → reagents in the pack, chance(id) → book chance }
   Healing first (self), then the strongest attack it is likely to cast; mages fight with spells, healers mostly heal. */
SIM.advSpell = (s, spells, info) => {
  const ok = id => spells.includes(id) && info(id) && s.mana >= info(id).mp && s.has(id) && s.chance(id) >= .5;
  const heal = big => big && ok('magery.29') ? { id: 'magery.29', self: true } : ok('magery.04') ? { id: 'magery.04', self: true } : ok('magery.29') ? { id: 'magery.29', self: true } : null;
  if (s.poisoned && ok('magery.11')) return { id: 'magery.11', self: true };
  if (!s.foe) return s.hpF < .95 ? heal(s.hpF < .5) : null;               // between fights: top up
  // in a fight a mage keeps casting at its foe and heals only when it must; a healer heals sooner
  if (s.hpF < (s.style === 'healer' ? SIM.ADV_CFG.healSpellAt : .4)) { const h = heal(s.hpF < .5); if (h) return h; }
  if (s.foe.dist > 9) return null;
  if (!s.warded && ok('magery.15') && s.style === 'healer') return { id: 'magery.15', self: true };
  const attacks = s.style === 'mage' ? ['magery.42', 'magery.30', 'magery.18', 'magery.05'] : ['magery.18', 'magery.05'];
  if (s.style === 'healer' && s.mana < 25) return null;                    // a healer keeps its mana for healing
  for (const id of attacks) if (ok(id)) return { id, self: false };
  return null;
};
/* what to buy, in priority order, within the purse. have: { id: qty }, prices: { id: gold }, reagents: [ids] */
SIM.advShopping = (style, have, gold, prices, reagents, cfg) => {
  cfg = cfg || SIM.ADV_CFG; const out = []; let left = Math.max(0, gold | 0);
  const want = (id, target) => { const p = prices[id]; if (!(p > 0)) return; const n = Math.min(Math.max(0, target - (have[id] || 0)), Math.floor(left / p)); if (n > 0) { out.push({ id, qty: n, cost: n * p }); left -= n * p; } };
  if (style !== 'mage') want('bandage', cfg.stock.bandage);
  if (style === 'archer') want('arrow', cfg.stock.arrow);
  if (style === 'mage' || style === 'healer') for (const r of reagents) want(r, cfg.stock.reagent);
  want('draught', cfg.stock.draught);
  return { buys: out, left };
};
/* the resurrection policy for a dead adventurer */
SIM.advAfterDeath = cfg => { const p = (cfg || SIM.ADV_CFG).res; return p === 'replace' || p === 'none' ? p : 'healer'; };

/* ---------------- Phase 6 step 2: world-state persistence of remains and cargo, the phone back buffer ----------------
   Creature remains keep their loot through a reload (§20: "corpse contents resetting after loading" is not allowed, and a reload
   must not roll the loot again). Rows: [{ key, type, x, y, left, items, skinned, killer, killKind, advKill, sect, gear }].
   One row per key, known species and items only, never an expired body. Returns { rows, dropped }. */
SIM.remainsRows = (rows, o) => {
  const out = [], seen = new Set(), dropped = {}; const drop = k => { dropped[k] = (dropped[k] || 0) + 1; };
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r !== 'object') { drop('shape'); continue; }
    if (typeof r.key !== 'string' || !r.key || seen.has(r.key)) { drop('duplicate'); continue; }
    if (typeof r.type !== 'string' || !o.validType(r.type)) { drop('species'); continue; }
    if (![r.x, r.y, r.left].every(Number.isFinite) || r.left <= 0) { drop('number'); continue; }
    if (!Array.isArray(r.items)) { drop('items'); continue; }
    seen.add(r.key); out.push(Object.assign({}, r, { items: r.items.filter(it => it && o.validItem(it)), skinned: !!r.skinned }));
    if (o.max && out.length >= o.max) break;
  }
  return { rows: out, dropped };
};
/* the travelling merchant's cargo for one leg: goods from his stock list, the dearest first, up to `value` gold at shop prices.
   rnd() in [0, 1) picks the quantities. Returns [{ id, qty }] */
SIM.traderCargo = (stock, prices, rnd, value) => {
  value = value || 160; const ids = stock.filter(id => prices[id] > 0).sort((a, b) => prices[b] - prices[a] || (a < b ? -1 : 1)), out = []; let left = value;
  for (const id of ids) { if (out.length >= 6 || left <= 0) break; const p = prices[id], n = Math.min(Math.floor(left / p), 1 + Math.floor(rnd() * Math.max(1, Math.floor(40 / p)))); if (n > 0) { out.push({ id, qty: n }); left -= n * p; } }
  return out;
};
/* the back buffer's divisor. The world is drawn into a buffer of (screen pixels / d) and scaled up; d = zoom × pixel ratio would keep
   the view the same on every screen, but whole numbers keep pixel art crisp. Desktop and small-ratio screens keep the whole number
   (as before). On a phone, if that buffer would hold more than `budget` pixels, d grows to fit the budget (never below the ideal):
   fewer pixels to draw, and the view is closer to the intended zoom (a pixel-ratio-2 phone used to round 1.4 down to 1). */
SIM.backBuffer = (cssW, cssH, dpr, zoom, o) => {
  o = o || {}; const ideal = zoom * dpr, d0 = Math.max(1, Math.round(ideal)), px = cssW * cssH * dpr * dpr;
  if (!o.phone || !(o.budget > 0) || px / (d0 * d0) <= o.budget) return d0;
  return Math.sqrt(px / o.budget);   // > d0, since the whole number was over budget
};

/* ---------------- NPC death and NPC crime (§19, §20; Living World phase 5 step 4) ----------------
   Townsfolk and guards die at 0 health instead of being knocked down: one death transaction, a body holding what they really
   wore and carried, loot rights, murder reports. Then, like UO's vendors, they come back after a while (the same person, so
   shops, quests and schedules keep working). The game side is src/npcdeath.js; these are the data and pure decisions. */
SIM.NPCD_VERSION = 1;
SIM.NPCD_CFG = {
  policy: 'return',     // 'return': everyone comes back after `back` seconds; 'none': only the people the town cannot do without come back
  back: 600,            // seconds dead before a townsperson is back at home
  unseen: 120,          // extra seconds a return may wait for nobody to be watching the spot (after that it happens anyway)
  purse: { guard: [15, 40], shop: [20, 60], smith: [20, 60], innkeeper: [25, 70], scholar: [10, 30], astronomer: [10, 30], default: [3, 20] } };
/* professions the towns cannot do without: shops, guards, the travelling merchant */
SIM.NPCD_ESSENTIAL = { guard: 1, trader: 1, shop: 1, smith: 1, innkeeper: 1, scholar: 1, astronomer: 1 };
SIM.npcdReturns = (prof, cfg) => (cfg || SIM.NPCD_CFG).policy !== 'none' || !!SIM.NPCD_ESSENTIAL[prof];
/* pocket gold on a townsperson's body: their own purse when they keep one (life.gold), else a roll in the profession's range */
SIM.npcdPurse = (prof, own, rnd, cfg) => {
  if (Number.isFinite(own) && own >= 0) return Math.floor(own);
  const P = (cfg || SIM.NPCD_CFG).purse, r = P[prof] || P.default; return r[0] + Math.floor((typeof rnd === 'number' ? rnd : .5) * (r[1] - r[0] + 1));
};
/* may a dead townsperson come back now? waited: seconds dead; seen: someone would watch it appear at home */
SIM.npcdReady = (waited, seen, cfg) => { cfg = cfg || SIM.NPCD_CFG; return waited >= cfg.back && (!seen || waited >= cfg.back + cfg.unseen); };
/* saved bodies: [{ owner, key, x, y, left, diedAgo, items, gear }] → the rows to restore. One row per key (owner@time of death),
   only known owners, only items that exist, never an expired body. Returns { rows, dropped } */
SIM.npcdBodyRows = (rows, o) => {
  const out = [], seen = new Set(), dropped = {}; const drop = k => { dropped[k] = (dropped[k] || 0) + 1; };
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r !== 'object') { drop('shape'); continue; }
    if (typeof r.owner !== 'string' || !o.validOwner(r.owner)) { drop('owner'); continue; }
    const key = typeof r.key === 'string' && r.key ? r.key : null; if (!key || seen.has(key)) { drop('duplicate'); continue; }
    if (![r.x, r.y, r.left].every(Number.isFinite) || r.left <= 0) { drop('number'); continue; }
    if (!Array.isArray(r.items)) { drop('items'); continue; }
    seen.add(key); out.push(Object.assign({}, r, { items: r.items.filter(it => it && o.validItem(it)) }));
  }
  return { rows: out, dropped };
};

/* NPC criminals (§19: "criminal NPCs may loot illegally and receive consequences"). Two outlaws on the adventurer controller,
   living at the outlaw camp: a cutthroat who preys on lone people in the wild (murder) and a cutpurse who loots bodies it has no
   right to (crime). Both obey the same law as you: grey or red, guards and witnesses react, anyone may fight them lawfully. */
SIM.CRIM_CFG = { preyRatio: .8, preyOnPlayer: true, crimeGap: 240, bodySight: 18, guardWary: 16, sight: 16 };
Object.assign(SIM.ADV_STYLES, {
  cutthroat: { style: 'melee', crim: 'murderer', str: 85, dex: 70, int: 30, skills: { swordsmanship: 75, tactics: 75, anatomy: 60, healing: 50, parrying: 45, hiding: 40, wrestling: 45 },
    weapon: 'sword', shield: null, wear: ['leather_cap', 'studded_tunic', 'leather_gloves', 'leather_leggings', 'boots', 'cloak', 'shirt', 'trousers'], kit: { bandage: 10, draught: 1 }, cloth: 'charcoal' },
  cutpurse:  { style: 'melee', crim: 'thief', str: 60, dex: 85, int: 45, skills: { fencing: 62, tactics: 55, hiding: 60, stealing: 60, snooping: 55, lockpicking: 40, healing: 40, wrestling: 40 },
    weapon: 'dagger', shield: null, wear: ['leather_cap', 'leather_tunic', 'leather_leggings', 'shoes', 'cloak', 'shirt', 'trousers'], kit: { bandage: 8, draught: 1 }, cloth: 'ochre' } });
SIM.CRIM_ROSTER = [['Vesk, cutthroat', 'cutthroat', 'camp', .9, 'male'], ['Mott, cutpurse', 'cutpurse', 'camp', .45, 'male']];
/* whom a cutthroat attacks. cands: [{ id, dist, ratio (their strength / its own), guarded (a guard or the law is near), hpF }].
   The weakest, nearest person it expects to beat, never where a guard would see it. */
SIM.crimPrey = (cands, cfg) => {
  cfg = cfg || SIM.CRIM_CFG; let best = null, bs = -1e9;
  for (const c of cands) {
    if (c.guarded || !(c.ratio < cfg.preyRatio)) continue;
    const s = (1 - c.ratio) + .5 * (1 - Math.min(1, c.dist / cfg.sight)) + .3 * (1 - (c.hpF ?? 1));
    if (s > bs || (s === bs && best && String(c.id) < String(best.id))) { bs = s; best = c; }
  }
  return best;
};
/* which body a criminal loots. cands: [{ key, dist, lawful (it has the right), items (worth taking), guarded }] — a thief takes what it
   has no right to as readily as what it does, but not under a guard's eyes; it ignores bodies with nothing worth carrying */
SIM.crimBody = (cands, cfg) => {
  cfg = cfg || SIM.CRIM_CFG; let best = null;
  for (const c of cands) { if (c.guarded || !(c.items > 0) || c.dist > cfg.bodySight) continue; if (!best || c.dist < best.dist || (c.dist === best.dist && String(c.key) < String(best.key))) best = c; }
  return best;
};

if (typeof module !== 'undefined' && module.exports) module.exports = SIM; else root.SIM = SIM;
})(typeof globalThis !== 'undefined' ? globalThis : this);
</script>
