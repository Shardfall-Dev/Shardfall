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
  'ItemTransferred', 'ItemCrafted', 'CrimeCommitted', 'CrimeWitnessed', 'ResourceGathered', 'MerchantArrived', 'CampCleared', 'PopulationReplenished', 'AppearanceChanged'];   // AppearanceChanged: v0.25 equipment, for the future layered sprites
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
