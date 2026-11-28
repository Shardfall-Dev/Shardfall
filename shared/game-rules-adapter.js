'use strict';
/* Shardfall game-rules adapter (server side) — loads the game's own pure rules modules from src/ (the same files build.sh puts
   into the browser game) and exposes the few operations the server needs. No rule is re-implemented here:
     - creation validation is SF.CREATION.validate (80 stat points 10–60, three skills totalling 100, max 50, five towns,
       appearance allowlists, the name policy),
     - the starting progression is SF.CREATION.progression, the kit is SF.CREATION.kit + SF.CREATION.applyKit,
     - vitals are SF.maxHp / maxStam / maxMana, slots are SF.EQ.SLOT_IDS.
   The modules are evaluated once, in one isolated vm context, exactly as tests/creation.test.js evaluates them from the build.
   They are pure (no DOM, no network); src/rules.js holds a module-level item uid counter, which only numbers items while a
   character is being assembled — every persisted item gets a server-owned UUID from the database. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src');
// load order is build.sh's: rules → skills → magery → equipment → stats → creation
const MODULES = ['rules.js', 'skills.js', 'magery.js', 'equipment.js', 'stats.js', 'creation.js'];

let cached = null;
function load(srcDir) {
  if (cached && !srcDir) return cached;
  const dir = srcDir || SRC;
  const ctx = vm.createContext({ console, Math, Date, JSON, Object, Array, Number, String, Set, Map, WeakMap, Symbol, Error, TypeError, RangeError });
  ctx.globalThis = ctx;
  for (const f of MODULES) {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    const code = raw.replace(/^\s*<script>\s*/, '').replace(/<\/script>\s*$/, '');
    // rules.js exports through module.exports when it sees one; give it a module so SF is captured, then publish it globally
    const mod = { exports: {} };
    ctx.module = f === 'rules.js' ? mod : undefined;
    vm.runInContext(code, ctx, { filename: 'src/' + f });
    if (f === 'rules.js') ctx.SF = mod.exports;
  }
  delete ctx.module;
  const SF = ctx.SF;
  if (!SF || !SF.CREATION || !SF.EQ || !SF.SK || !SF.STATS || !SF.MAGERY) throw new Error('game rules did not load');
  const api = makeApi(SF);
  if (!srcDir) cached = api;
  return api;
}

function makeApi(SF) {
  const CR = SF.CREATION, EQ = SF.EQ;
  const RULES_VERSION = { creation: CR.VERSION, skills: SF.SK.MIGRATION, equipment: EQ.MIGRATION, combat: SF.COMBAT_MIGRATION };
  const ITEM_PROP_DENY = new Set(['uid', 'id', 'qty', '__proto__', 'constructor', 'prototype']);

  /* the canonical name key: what names are unique by within a realm (case-insensitive, spaces collapsed, NFC) */
  const nameKey = name => CR.cleanName(name).normalize('NFC').toLocaleLowerCase('en');

  /* validateCreation(payload) → SF.CREATION.validate's result. The payload is untrusted: only the creation choices are read
     (name, look, str, dex, int, skills, town). Anything else the client sends — gold, items, skill values, stats above the
     creation rules — is not part of the creation payload and is never read. */
  function validateCreation(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return CR.validate(null);
    const p = { name: payload.name, look: payload.look, str: payload.str, dex: payload.dex, int: payload.int, skills: payload.skills, town: payload.town };
    return CR.validate(p);
  }

  /* itemRecord(it) → { item_def, qty, props } for an item made by the rules (props: every other field, JSON-clean) */
  function itemRecord(it) {
    const props = {};
    for (const k of Object.keys(it)) if (!ITEM_PROP_DENY.has(k)) props[k] = it[k];
    return { item_def: it.id, qty: it.qty || 1, props: JSON.parse(JSON.stringify(props)) };
  }

  /* buildCharacter(value) → the complete initial state for a validated creation (value = validateCreation(p).value).
     Server-generated: progression, starter kit, vitals, spawn. Returns plain JSON-safe data plus the item records. */
  function buildCharacter(v) {
    const prog = CR.progression({ str: v.str, dex: v.dex, int: v.int, skills: v.skills });
    const equip = {}; for (const s of EQ.SLOT_IDS) equip[s] = null;
    const ch = { kind: 'player', name: v.name, str: prog.str, dex: prog.dex, int: prog.int, skills: prog.skills, statLocks: prog.statLocks,
      pack: SF.newContainer('pack', 'p1'), bank: SF.newContainer('bank', 'p1'), equip, look: Object.assign({}, v.look), hotbar: [null, null, null, null] };
    const manifest = CR.kit(v);
    const kit = CR.applyKit(ch, manifest);
    const town = CR.TOWN[v.town];
    // Saltmarsh Quay has a fixed, verified spawn. The other towns spawn beside their shrine, whose tile is placed by the game's
    // world generation (not yet run on the server): the position keeps the town and shrine until server-owned movement lands.
    const position = v.town === 'quay' ? { map: 'anniabreen', town: 'quay', x: 92.5, y: 304.5 } : { map: 'anniabreen', town: v.town, shrine: town.shrine, x: null, y: null };
    const items = [];
    let pos = 0;
    for (const s of EQ.SLOT_IDS) { const it = ch.equip[s]; if (it) items.push(Object.assign({ container: 'equip', slot: s, position: 0 }, itemRecord(it))); }
    for (const it of ch.pack.items) items.push(Object.assign({ container: 'pack', slot: null, position: pos++ }, itemRecord(it)));
    return {
      name: v.name, nameKey: nameKey(v.name), body: v.look.body, appearance: Object.assign({}, v.look),
      str: prog.str, dex: prog.dex, int: prog.int, statLocks: prog.statLocks, skills: JSON.parse(JSON.stringify(prog.skills)),
      template: v.template, startingTown: v.town, boundShrine: town.shrine,
      hp: SF.maxHp(ch), stam: SF.maxStam(ch), mana: SF.maxMana(ch),
      position, hotbar: ch.hotbar.slice(), spells: manifest.spells.slice(), kitNotes: manifest.notes.slice(), kit,
      rulesVersion: Object.assign({}, RULES_VERSION), items };
  }

  /* checkStoredItem(row) → null when an item record read back from the database still fits the rules (a known item id, a
     whole positive quantity, a single unit for anything that does not stack, a real equipment slot), else the reason. */
  function checkStoredItem(row) {
    const d = SF.ITEMS[row.item_def]; if (!d) return 'unknown item';
    if (!Number.isSafeInteger(row.qty) || row.qty < 1) return 'bad quantity';
    if (!d.stack && row.qty !== 1) return 'stacked non-stackable';
    if (row.container === 'equip' && !EQ.SLOT[row.slot]) return 'bad slot';
    return null;
  }

  /* characterFromRows(row, items) — a rules-shaped character (str / dex / int, skills, equip, pack, bank) rebuilt from the
     database, for the shared rules that need one (stamina, carrying weight, armour speed). Items come back as the rules' own
     item objects ({ id, qty, …props }), each tagged with its server UUID. */
  function characterFromRows(r, items) {
    const equip = {}; for (const sl of EQ.SLOT_IDS) equip[sl] = null;
    const pack = SF.newContainer('pack', 'p1'), bank = SF.newContainer('bank', 'p1');
    for (const it of items || []) {
      const o = Object.assign({}, it.props || {}, { id: it.item_def, qty: it.qty, sid: it.id });
      if (it.container === 'equip' && EQ.SLOT[it.slot]) equip[it.slot] = o; else if (it.container === 'bank') bank.items.push(o); else pack.items.push(o);
    }
    return { kind: 'player', name: r.name, str: r.str, dex: r.dex, int: r.int, skills: r.skills, statLocks: r.stat_locks, equip, pack, bank, look: r.appearance, ghost: false };
  }

  /* public creation options for the client (allowlists the server will accept) */
  const creationOptions = () => ({ statPoints: SF.CREATE_STATS, statMin: SF.CREATE_STAT_MIN, statMax: SF.CREATE_STAT_MAX, skillPoints: SF.CREATE_SKILLS,
    skillMax: SF.CREATE_SKILL_MAX, skillSlots: SF.CREATE_SKILL_SLOTS, creatable: CR.CREATABLE.slice(), towns: CR.TOWNS.map(t => ({ id: t.id, name: t.n })),
    nameMin: CR.NAME_MIN, nameMax: CR.NAME_MAX });

  return { SF, RULES_VERSION, nameKey, validateCreation, buildCharacter, checkStoredItem, creationOptions, characterFromRows,
    itemName: id => (SF.ITEMS[id] ? SF.itemName({ id }) : id), townName: id => (CR.TOWN[id] ? CR.TOWN[id].n : id), title: ch => CR.title(ch) };
}

/* loadSim() — the world simulation core (src/world.js, SIM): pure, no DOM, no timers, no Math.random. The server uses its world
   clock, light, factions, perception and seeded random streams for the creatures (Server Creatures v1), so a creature online
   reads the time of day, sees and decides by the same rules as offline. */
let simCached = null;
function loadSim(srcDir) {
  if (simCached && !srcDir) return simCached;
  const raw = fs.readFileSync(path.join(srcDir || SRC, 'world.js'), 'utf8');
  const code = raw.replace(/^\s*<script>\s*/, '').replace(/<\/script>\s*$/, '');
  const mod = { exports: {} };
  const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map, WeakMap, Symbol, Error, TypeError, RangeError, Uint32Array, Int32Array, Float64Array, module: mod });
  ctx.globalThis = ctx;
  vm.runInContext(code, ctx, { filename: 'src/world.js' });
  const SIM = mod.exports;
  for (const k of ['newClock', 'lightAt', 'activityOf', 'senseRange', 'detect', 'newFactions', 'FACTION_RULES', 'stream']) if (!SIM[k]) throw new Error('src/world.js: SIM.' + k + ' missing');
  if (!srcDir) simCached = SIM;
  return SIM;
}

module.exports = { load, loadSim };
