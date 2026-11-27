<script>
/* Shardfall attribute module (SF.STATS) — natural STR, DEX and INT in the Second Age (T2A) manner.
   Pure, renderer-free, network-free: no DOM, no localStorage, no clock of its own. Runs in the browser after the rules module (SF)
   and in node for tests. Specification: docs/stats/STAT_SYSTEM_REWORK_v1.0.md. Status and approximations: docs/stats/STATUS.md.

   The model
   - ch.base = { str, dex, int } holds the natural (permanent) attributes, integers 10–100 that sum to at most 225. It is the only
     permanent value. ch.str / ch.dex / ch.int are computed from it (magic boons and hexes on top); equipment modifiers are applied
     once, by SF.EQ, on top of those (eqDex). Nothing outside this module writes ch.base after creation.
   - ch.statState holds the stat locks (raise / hold / lower), the gain cooldown, a bounded repeat log, a bounded log of resolved
     action ids and the state of the stat module's own random stream. It is saved with the character.
   - Stats rise only from real skill use: one roll at most per resolved gameplay action (SF.STATS.tryStatGain). Gold, trainers,
     quests, levels and experience never raise them. At 225 a point moves from a stat set to Lower to the stat being raised.

   What is historical and what is tuning
   - Historical (T2A, see the spec's references): 80 starting points, 10–60 each at creation; 10 minimum and 100 maximum per stat;
     225 total; Health = Strength, Stamina = Dexterity, Mana = Intelligence; gains come from using skills; stats can be locked and
     atrophy happens only at the cap; Grandmasters still train stats; at the 700 skill cap only skills that can still change train them.
   - Shardfall tuning (marked TUNING below): every number in ST.CFG, the skill weights in ST.MAP, the donor order at the cap. */
(function (root) {
'use strict';
const SF = root.SF; if (!SF) throw new Error('stats.js needs the rules module (SF) first');
const ST = {};
const clamp = SF.clamp;

ST.KEYS = ['str', 'dex', 'int'];
ST.NAME = { str: 'Strength', dex: 'Dexterity', int: 'Intelligence' };
ST.ABBR = { str: 'STR', dex: 'DEX', int: 'INT' };
ST.MIN = SF.STAT_MIN; ST.MAX = SF.STAT_MAX; ST.CAP = SF.STAT_CAP;
ST.CREATE_TOTAL = SF.CREATE_STATS; ST.CREATE_MIN = SF.CREATE_STAT_MIN; ST.CREATE_MAX = SF.CREATE_STAT_MAX;
ST.LOCKS = ['raise', 'hold', 'lower'];
ST.VERSION = 1;                         // statState layout
ST.MIGRATION = 1;                       // save conversion marker (char.statMig)

/* TUNING. Explicitly not a historical OSI formula (spec §"Explicitly tunable approximation"). Adjust here, never at a callsite. */
ST.CFG = {
  cooldown: 30,          // active simulation seconds after a successful gain before the next can happen
  base: 0.06,            // chance per eligible action at stat 10 …
  slope: 0.75,           // … falling linearly by 75 % of that towards stat 100
  min: 0.015, max: 0.06, // clamp of the per-action chance
  window: 25,            // challenge: a use whose difficulty is at least (skill − window) counts as appropriately challenging
  trivial: 0.25,         // challenge factor for trivial but real use
  repeatWindow: 600,     // seconds the repeat log looks back
  repeatFreeTarget: 8,   // uses of one and the same target or node inside the window before its penalty starts
  repeatFreeSkill: 20,   // uses of the same skill (any target) inside the window before the skill-wide penalty starts
  repeatStep: 0.08,      // each further use takes this off the factor …
  repeatFloorTarget: 0,  // … down to 0 for one and the same target or node (no stationary-target exploit)
  repeatFloorSkill: 0.25,// … down to 0.25 for the same skill on varied targets
  recentMax: 96,         // bounded repeat log
  seenMax: 64,           // bounded resolved-action log (duplicate protection)
  meditateEvery: 10,     // seconds of active meditation that make one stat-check interval …
  meditateMin: 2         // … if it restored at least this much mana while mana was missing
};

/* skill → stat weights. Baseline primary/secondary 75/25, a single stat 100. Rows are design weights (spec table), not historical
   numbers. Keys are the runtime skill ids of this build; ST.ALIAS maps the canonical ids planned by the T2A skill parity reform
   (docs/skills/T2A_SKILL_PARITY_v1.md on design/t2a-skill-parity-v1) onto the same rows, so the rename needs no second table. */
const W = (p, s) => s ? { [p]: 75, [s]: 25 } : { [p]: 100 };
ST.MAP = {
  swordsmanship: W('str', 'dex'), macefighting: W('str', 'dex'), fencing: W('dex', 'str'), archery: W('dex', 'str'),
  wrestling: W('str', 'dex'), tactics: W('str', 'dex'), anatomy: W('int', 'str'), parrying: W('dex', 'str'),
  healing: W('dex', 'int'), spellcraft: W('int'), focus: W('int'), wardcraft: W('int', 'str'), meditation: W('int'),
  alchemy: W('int', 'dex'), venomcraft: W('int', 'dex'), concealment: W('dex'), shadowstep: W('dex'),
  search: W('int', 'dex'), tracking: W('int', 'dex'), pickpocketing: W('dex'), lockwork: W('dex', 'int'), trapcraft: W('dex', 'int'),
  taming: W('int', 'str'), beasthandling: W('int'), veterinary: W('int', 'dex'),
  musicianship: W('dex', 'int'), lullaby: W('int', 'dex'), discord: W('int', 'dex'), provocation: W('int', 'dex'),
  woodcutting: W('str', 'dex'), mining: W('str'), foraging: W('dex', 'int'), skinning: W('dex', 'str'), fishing: W('dex', 'str'),
  smithing: W('str'), carpentry: W('str', 'dex'), tailoring: W('dex', 'int'), fletching: W('dex', 'str'), engineering: W('dex', 'int'),
  cooking: W('int', 'dex'), appraisal: W('int'),
  // classic skills the parity reform will add (not live in this build): mapped now so they work the day they land
  armslore: W('int', 'str'), begging: W('dex', 'int'), camping: { str: 34, dex: 33, int: 33 }, cartography: W('int'), forensicevaluation: W('int'),
  herding: W('str', 'int'), inscription: W('int'), snooping: W('dex'), spiritspeak: W('int'), tasteidentification: W('int')
};
// planned canonical id → runtime id of this build (one row each; the reform flips them into the runtime keys)
ST.ALIAS = {
  magery: 'spellcraft', evaluatingintelligence: 'focus', resistingspells: 'wardcraft', poisoning: 'venomcraft', hiding: 'concealment',
  stealth: 'shadowstep', detectinghidden: 'search', stealing: 'pickpocketing', lockpicking: 'lockwork', removetrap: 'trapcraft',
  animaltaming: 'taming', animallore: 'beasthandling', peacemaking: 'lullaby', enticement: 'discord', lumberjacking: 'woodcutting',
  blacksmithy: 'smithing', bowcraft: 'fletching', tinkering: 'engineering', itemidentification: 'appraisal'
};
// a skill deliberately without stat weights must say why here (none today)
ST.NO_MAP = {};
ST.weights = key => ST.MAP[key] || (ST.ALIAS[key] && ST.MAP[ST.ALIAS[key]]) || null;
/* which skills train a stat (for tooltips): [{k, w}] sorted by weight then name, runtime keys only */
ST.trainedBy = stat => Object.keys(ST.MAP).filter(k => SF.SKILL[k] && ST.MAP[k][stat]).map(k => ({ k, w: ST.MAP[k][stat] })).sort((a, b) => b.w - a.w || (a.k < b.k ? -1 : 1));

/* ---------------- the dedicated random stream (mulberry32, like SIM's): its whole state is one integer in statState ---------------- */
const draw = st => { let a = (st.seed = ((st.seed >>> 0) + 0x6D2B79F5) >>> 0); let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
ST.seedFrom = s => { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

/* ---------------- state ---------------- */
ST.newState = seed => ({ v: ST.VERSION, locks: { str: 'raise', dex: 'raise', int: 'raise' }, last: -1e9, seed: (seed >>> 0) || 1, recent: [], seen: [], gains: 0 });
const isInt = v => Number.isInteger(v);
ST.total = ch => ST.KEYS.reduce((a, k) => a + ch.base[k], 0);
/* give a character its natural attributes and state; `from` = explicit natural values (creation or a save) */
ST.init = (ch, from, seed) => {
  const src = from || ch.base || ch;
  ch.base = { str: src.str, dex: src.dex, int: src.int };
  ch.statState = ST.cleanState(ch.statState, seed !== undefined ? seed : ST.seedFrom((ch.name || '') + '|' + (ch.id || 'p1')));
  return ch;
};
/* a saved state brought back to shape: unknown fields dropped, malformed ones reset (idempotent) */
ST.cleanState = (s, seed) => {
  const o = ST.newState(seed);
  if (!s || typeof s !== 'object') return o;
  if (s.locks) for (const k of ST.KEYS) if (ST.LOCKS.includes(s.locks[k])) o.locks[k] = s.locks[k];
  if (Number.isFinite(s.last)) o.last = s.last;
  if (Number.isFinite(s.seed) && s.seed >>> 0) o.seed = s.seed >>> 0;
  if (Array.isArray(s.recent)) o.recent = s.recent.filter(r => Array.isArray(r) && typeof r[0] === 'string' && Number.isFinite(r[1])).slice(-ST.CFG.recentMax);
  if (Array.isArray(s.seen)) o.seen = s.seen.filter(a => typeof a === 'string').slice(-ST.CFG.seenMax);
  if (isInt(s.gains) && s.gains >= 0) o.gains = s.gains;
  return o;
};

/* ---------------- creation ---------------- */
ST.validateCreation = o => SF.validateStats(o);   // one rule set: src/rules.js
/* the creation +/- control: returns the new value or null when the step would break the rules */
ST.createStep = (vals, i, d) => { const nv = vals[i] + d, tot = vals.reduce((a, b) => a + b, 0) + d; return isInt(nv) && nv >= ST.CREATE_MIN && nv <= ST.CREATE_MAX && tot <= ST.CREATE_TOTAL ? nv : null; };

/* ---------------- invariants and repair (load and migration) ---------------- */
ST.valid = b => !!b && ST.KEYS.every(k => isInt(b[k]) && b[k] >= ST.MIN && b[k] <= ST.MAX) && ST.KEYS.reduce((a, k) => a + b[k], 0) <= ST.CAP;
/* deterministic repair of malformed natural values: non-numbers → 10, round, clamp 10–100, then take any excess over 225 from the
   highest stat (ties STR, DEX, INT) one point at a time. Returns { base, repairs: [text] }. Valid input comes back unchanged. */
ST.repair = b => {
  const out = {}, repairs = [];
  for (const k of ST.KEYS) {
    let v = b && b[k];
    if (typeof v === 'string' && v.trim() !== '') v = Number(v);
    if (!Number.isFinite(v)) { repairs.push(`${ST.ABBR[k]} was ${JSON.stringify(b && b[k])}; set to ${ST.MIN}`); v = ST.MIN; }
    const r = clamp(ST.MIN, ST.MAX, Math.round(v)); if (r !== v) repairs.push(`${ST.ABBR[k]} ${v} → ${r}`); out[k] = r;
  }
  let over = ST.KEYS.reduce((a, k) => a + out[k], 0) - ST.CAP;
  if (over > 0) { const before = Object.assign({}, out); while (over > 0) { const k = ST.KEYS.slice().sort((a, c) => out[c] - out[a] || ST.KEYS.indexOf(a) - ST.KEYS.indexOf(c)).find(x => out[x] > ST.MIN); if (!k) break; out[k]--; over--; } repairs.push(`total over ${ST.CAP}: ${ST.KEYS.map(k => before[k]).join('/')} → ${ST.KEYS.map(k => out[k]).join('/')}`); }
  return { base: out, repairs };
};
/* save conversion (char.statMig): the saved str/dex/int are natural values (save() has always written P.base over them). An explicit
   valid `base` wins. Effective values, buffs and eqDex are never taken as natural. Existing 150-point characters keep their points:
   nothing is reset, deducted or refunded. Idempotent. Returns { changed, repairs }. */
ST.migrateChar = (c, seed) => {
  if (!c) return { changed: false, repairs: [] };
  if ((c.statMig || 0) >= ST.MIGRATION && ST.valid(c.base) && c.statState) { c.statState = ST.cleanState(c.statState, seed); return { changed: false, repairs: [] }; }
  const src = ST.valid(c.base) ? c.base : { str: c.str, dex: c.dex, int: c.int };
  const r = ST.repair(src);
  c.base = r.base; Object.assign(c, r.base);
  c.statState = ST.cleanState(c.statState, seed !== undefined ? seed : ST.seedFrom((c.name || '') + '|stats'));
  c.statMig = ST.MIGRATION;
  return { changed: true, repairs: r.repairs };
};

/* ---------------- locks (the only stat command a player sends after creation) ---------------- */
ST.setLock = (ch, stat, mode) => {
  if (!ST.KEYS.includes(stat)) return { ok: false, reason: 'unknown attribute' };
  if (!ST.LOCKS.includes(mode)) return { ok: false, reason: 'unknown lock' };
  ch.statState.locks[stat] = mode; return { ok: true, stat, mode };
};
ST.nextLock = m => m === 'raise' ? 'hold' : m === 'hold' ? 'lower' : 'raise';
ST.cycleLock = (ch, stat) => ST.KEYS.includes(stat) ? ST.setLock(ch, stat, ST.nextLock(ch.statState.locks[stat])) : { ok: false, reason: 'unknown attribute' };

/* ---------------- eligibility ---------------- */
/* the donor at the cap: the highest natural stat set to Lower above 10 (ties STR, DEX, INT; TUNING), never the stat being raised */
ST.donor = (ch, target) => {
  let best = null;
  for (const k of ST.KEYS) { if (k === target || ch.statState.locks[k] !== 'lower' || ch.base[k] <= ST.MIN) continue; if (!best || ch.base[k] > ch.base[best]) best = k; }
  return best;
};
/* can this stat take a point now? */
ST.canRaise = (ch, k) => {
  if (ch.statState.locks[k] !== 'raise') return { ok: false, reason: ch.statState.locks[k] === 'hold' ? 'held' : 'set to lower' };
  if (ch.base[k] >= ST.MAX) return { ok: false, reason: 'at 100' };
  if (ST.total(ch) >= ST.CAP && !ST.donor(ch, k)) return { ok: false, reason: 'at 225 with no stat set to lower' };
  return { ok: true };
};
/* late T2A: only a skill set to Raise trains stats; a Grandmaster still does; below GM at the 700 cap there must be another skill set
   to Lower with points to give (nothing is taken from it for the stat check). `pre` is the skill state before the action. */
ST.skillEligible = (ch, key, pre) => {
  const s = pre || (ch.skills && ch.skills[key]);
  if (!s || !ST.weights(key)) return { ok: false, reason: 'skill trains no attribute' };
  if (s.lock !== 'raise') return { ok: false, reason: 'skill is not set to Raise' };
  if (s.v >= SF.SKILL_MAX) return { ok: true, gm: true };
  const total = pre && Number.isFinite(pre.total) ? pre.total : SF.totalSkill(ch);
  if (total >= SF.SKILL_CAP) {
    const hasDonor = pre && pre.donor !== undefined ? pre.donor : Object.keys(ch.skills).some(k => k !== key && ch.skills[k].lock === 'lower' && ch.skills[k].v > 0);
    if (!hasDonor) return { ok: false, reason: 'skill cap reached with no skill set to Lower' };
  }
  return { ok: true };
};
/* snapshot of the skill state for a stat check taken before the action's own skill gain runs */
ST.skillSnapshot = (ch, key) => { const s = ch.skills && ch.skills[key]; if (!s) return null; return { v: s.v, lock: s.lock, total: SF.totalSkill(ch), donor: Object.keys(ch.skills).some(k => k !== key && ch.skills[k].lock === 'lower' && ch.skills[k].v > 0) }; };

/* ---------------- the per-action chance ---------------- */
ST.chanceFor = base => clamp(ST.CFG.min, ST.CFG.max, ST.CFG.base * (1 - ST.CFG.slope * (base - ST.MIN) / (ST.MAX - ST.MIN)));
/* 1 when the use was appropriately challenging (or the caller says so), CFG.trivial when trivial; skill in points 0–100 */
ST.challenge = (skill, diff) => !Number.isFinite(diff) ? 1 : diff >= skill - ST.CFG.window ? 1 : ST.CFG.trivial;
ST.repeatFactor = (st, key, target, now) => {
  const lo = now - ST.CFG.repeatWindow, ks = key + '|', kt = target ? key + '|' + target : null;
  let nSkill = 0, nTarget = 0;
  for (const [k, t] of st.recent) { if (t < lo || t > now) continue; if (k === kt) nTarget++; if (k.startsWith(ks)) nSkill++; }
  const f = (n, free, floor) => Math.max(floor, 1 - Math.max(0, n - free) * ST.CFG.repeatStep);
  return Math.min(f(nSkill, ST.CFG.repeatFreeSkill, ST.CFG.repeatFloorSkill), kt ? f(nTarget, ST.CFG.repeatFreeTarget, ST.CFG.repeatFloorTarget) : 1);
};

/* ---------------- the gain event ----------------
   tryStatGain(ch, skillKey, ctx) for one resolved, legal gameplay action by this character.
   ctx = { action: unique action id (string, required), now: active simulation seconds (required), actor: actor id,
           diff: difficulty, skill: skill points before the action (0–100, defaults to the current value), pre: skill snapshot,
           challenge: explicit factor 0–1 (overrides diff), target: stable target / node key for the repeat penalty,
           valid: false for an action that did not resolve (cancelled, impossible, no target or resource), rng: test override }
   Returns { gained, stat, value, lowered, lowerValue, reason, chance }. Never throws, never touches skills, never refills pools.
   Every evaluated action id is remembered (bounded): the same id never rolls twice. */
ST.tryStatGain = (ch, key, ctx) => {
  ctx = ctx || {}; const st = ch.statState; const res = (reason, o) => Object.assign({ gained: false, reason }, o || {});
  if (!st || !ST.valid(ch.base)) return res('no natural attributes');
  if (typeof ctx.action !== 'string' || !ctx.action) return res('no action id');
  if (!Number.isFinite(ctx.now)) return res('no time');
  if (st.seen.includes(ctx.action)) return res('duplicate action');
  st.seen.push(ctx.action); if (st.seen.length > ST.CFG.seenMax) st.seen.splice(0, st.seen.length - ST.CFG.seenMax);
  if (ctx.valid === false) return res('action did not resolve');
  const el = ST.skillEligible(ch, key, ctx.pre); if (!el.ok) return res(el.reason);
  if (ctx.now - st.last < ST.CFG.cooldown && ctx.now >= st.last) return res('cooldown');
  const wts = ST.weights(key), cand = ST.KEYS.filter(k => wts[k] > 0 && ST.canRaise(ch, k).ok);
  // the repeat log counts every eligible attempt, gain or not
  st.recent.push([key + '|' + (ctx.target || ''), ctx.now]); if (st.recent.length > ST.CFG.recentMax) st.recent.splice(0, st.recent.length - ST.CFG.recentMax);
  if (!cand.length) return res('blocked: no attribute can rise');
  const rng = ctx.rng || (() => draw(st));
  const skill = Number.isFinite(ctx.skill) ? ctx.skill : (ctx.pre ? ctx.pre.v : ch.skills[key].v) / 10;
  const chal = Number.isFinite(ctx.challenge) ? clamp(0, 1, ctx.challenge) : ST.challenge(skill, ctx.diff);
  const rep = ST.repeatFactor(st, key, ctx.target, ctx.now - 1e-9);   // the attempt just logged does not count against itself
  // pick the stat first (weights among the stats that can still rise), then roll for it
  const tw = cand.reduce((a, k) => a + wts[k], 0); let x = rng() * tw, stat = cand[cand.length - 1];
  for (const k of cand) { x -= wts[k]; if (x < 0) { stat = k; break; } }
  const chance = ST.chanceFor(ch.base[stat]) * chal * rep;
  if (!(chance > 0)) return res(chal ? 'repeated too often' : 'too easy', { stat, chance: 0 });
  if (rng() >= chance) return res('no gain', { stat, chance });
  // commit: a point below the cap, or an atomic one-point transfer at the cap
  let lowered = null;
  if (ST.total(ch) >= ST.CAP) { lowered = ST.donor(ch, stat); if (!lowered) return res('blocked: no attribute can rise', { stat, chance }); ch.base[lowered] -= 1; }
  ch.base[stat] += 1; st.last = ctx.now; st.gains++;
  return { gained: true, stat, value: ch.base[stat], lowered, lowerValue: lowered ? ch.base[lowered] : undefined, reason: 'gained', chance };
};

/* ---------------- derived values (the rules module reads these; see SF.maxHp etc.) ---------------- */
/* effective attribute = natural + magic (the magic module passes its delta; MG keeps its own 1–125 clamp) */
ST.effective = (ch, deltaOf) => { const o = {}; for (const k of ST.KEYS) o[k] = ch.base[k] + (deltaOf ? deltaOf(k) : 0); return o; };
/* pools after any change of their maxima: never refilled, clamped down; a living character keeps at least 1 HP, a ghost stays at 0 */
ST.clampPools = ch => {
  ch.hp = Math.min(ch.hp, SF.maxHp(ch)); if (ch.ghost) ch.hp = 0; else ch.hp = Math.max(1, ch.hp);
  ch.stam = Math.min(ch.stam, SF.maxStam(ch)); ch.mana = Math.min(ch.mana, SF.maxMana(ch));
};
/* Strength-requirement policy after a permanent Strength loss (atrophy at the cap): every worn piece whose requirement is now above the
   character's Strength goes into the backpack through the validated unequip command. Nothing is dropped or destroyed; the pack may
   end up overweight (encumbrance then slows you as usual). A temporary hex never triggers this. Returns the moved items. */
ST.enforceStrength = ch => {
  const EQ = SF.EQ, out = []; if (!EQ || !ch.equip) return out;
  for (const s of EQ.SLOT_IDS) { const it = ch.equip[s]; if (!it) continue; const need = EQ.strReq(it); if (need > ch.str) { const r = EQ.unequipItem(ch, { slot: s }); if (r.ok) out.push({ slot: s, item: it, need }); } }
  return out;
};

/* text */
ST.gainText = r => r && r.gained ? `Your ${ST.NAME[r.stat]} has increased to ${r.value}.` + (r.lowered ? ` Your ${ST.NAME[r.lowered]} has decreased to ${r.lowerValue}.` : '') : '';
ST.lockGlyph = m => m === 'raise' ? '▲' : m === 'hold' ? '■' : '▼';
ST.lockLabel = m => m === 'raise' ? 'Raise' : m === 'hold' ? 'Locked' : 'Lower';

SF.STATS = ST;
if (typeof module !== 'undefined' && module.exports) module.exports = ST;
})(typeof globalThis !== 'undefined' ? globalThis : this);
</script>
