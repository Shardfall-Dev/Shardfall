<script>
/* Shardfall attribute progression (SF.STATS) — natural Strength, Dexterity and Intelligence grow by using skills.
   Pure, renderer-free, network-free: runs in the browser after the rules module and in node for tests (tests/stats.test.js).
   Design: docs/stats/STAT_SYSTEM_REWORK_v1.0.md, reconciled with docs/design/character-creation-v2.md (65-point start).
   Rules (Second Age): no stat points, purchases, trainers or levels. Natural stats are integers 10–100, at most 225 together.
   Each stat has a lock (raise / hold / lower, like skills). Below 225 nothing decays; at 225 a gain moves exactly one point
   from a stat set to Lower. Natural values live in ch.base when it exists (the magic module's natural block), else on ch.
   Everything marked TUNING is a Shardfall choice, not a claimed OSI formula; see docs/stats/STATUS.md. */
(function (root) {
'use strict';
const SF = root.SF; if (!SF) throw new Error('stats.js needs the rules module (SF) first');
const ST = {};
const clamp = SF.clamp;
ST.KEYS = ['str', 'dex', 'int'];
ST.NAME = { str: 'Strength', dex: 'Dexterity', int: 'Intelligence' };
ST.ABBR = { str: 'STR', dex: 'DEX', int: 'INT' };
ST.LOCKS = ['raise', 'hold', 'lower'];
// TUNING: one success per 45 s of active play at most; chance per fitting action falls with the stat (4% at 10 → 1% at 100);
// trivial use counts a quarter. About 12–30 points per hour of steady work (tests/stats.test.js prints the measured rates).
ST.CFG = { cooldown: 45, chanceHi: .04, chanceLo: .01, fall: .75, trivial: .25 };
/* skill → stat weights (primary 75 / secondary 25, single-stat skills 100). Design table in STAT_SYSTEM_REWORK_v1.0.md;
   keys are the runtime skill keys (display names are the canonical UO names in SF.SKILL). */
const W = (a, b) => { const o = {}; if (b) { o[a] = 75; o[b] = 25; } else o[a] = 100; return o; };
ST.WEIGHTS = {
  swordsmanship: W('str', 'dex'), macefighting: W('str', 'dex'), fencing: W('dex', 'str'), archery: W('dex', 'str'), wrestling: W('str', 'dex'),
  tactics: W('str', 'dex'), anatomy: W('int', 'str'), parrying: W('dex', 'str'), healing: W('dex', 'int'),
  spellcraft: W('int'), focus: W('int'), wardcraft: W('int', 'str'), meditation: W('int'), alchemy: W('int', 'dex'), venomcraft: W('int', 'dex'),
  concealment: W('dex'), shadowstep: W('dex'), search: W('int', 'dex'), tracking: W('int', 'dex'), pickpocketing: W('dex'), lockwork: W('dex', 'int'),
  trapcraft: W('dex', 'int'), taming: W('int', 'str'), beasthandling: W('int'), veterinary: W('int', 'dex'), musicianship: W('dex', 'int'),
  lullaby: W('int', 'dex'), discord: W('int', 'dex'), provocation: W('int', 'dex'), woodcutting: W('str', 'dex'), mining: W('str'),
  foraging: W('dex', 'int'), skinning: W('dex', 'str'), fishing: W('dex', 'str'), smithing: W('str'), carpentry: W('str', 'dex'),
  tailoring: W('dex', 'int'), fletching: W('dex', 'str'), engineering: W('dex', 'int'), cooking: W('int', 'dex'), appraisal: W('int') };
// which stats each skill trains, for tooltips: { str: ['Swordsmanship', ...], ... }
ST.trainedBy = s => SF.SKILLS.filter(([k]) => ST.WEIGHTS[k] && ST.WEIGHTS[k][s]).map(([, n]) => n);

ST.natural = ch => ch.base || ch;                                 // the object holding natural str/dex/int
ST.values = ch => { const b = ST.natural(ch); return { str: b.str, dex: b.dex, int: b.int }; };
ST.total = ch => { const b = ST.natural(ch); return b.str + b.dex + b.int; };
ST.chance = v => clamp(ST.CFG.chanceLo, ST.CFG.chanceHi, ST.CFG.chanceHi * (1 - ST.CFG.fall * (v - SF.STAT_MIN) / (SF.STAT_MAX - SF.STAT_MIN)));
ST.newLocks = () => ({ str: 'raise', dex: 'raise', int: 'raise' });
ST.newState = seed => ({ cd: 0, seed: (seed >>> 0) || 0x2f6b1d3, last: null, n: 0 });
ST.cycleLock = l => ST.LOCKS[(ST.LOCKS.indexOf(l) + 1) % 3] || 'raise';
// a separate, persisted random stream (mulberry32) so stat rolls never consume or disturb the skill-gain RNG
ST.rand = st => { let t = (st.seed = (st.seed + 0x6D2B79F5) >>> 0); t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/* setLock: the only stat command the UI has after creation. Never changes a value. */
ST.setLock = (ch, s, lock) => {
  if (!ST.KEYS.includes(s) || !ST.LOCKS.includes(lock)) return { ok: false, reason: 'invalid lock' };
  ch.statLocks = ch.statLocks || ST.newLocks(); ch.statLocks[s] = lock; return { ok: true };
};

/* migrateChar: add locks and gain state to an older character, repair malformed values. Idempotent. Legitimate stats are kept
   as they are, even above the creation limits (old 150-point characters keep their points). Returns the list of repairs. */
ST.migrateChar = ch => {
  const fixes = [];
  if (!ch.statLocks || typeof ch.statLocks !== 'object') { ch.statLocks = ST.newLocks(); fixes.push('locks'); }
  for (const s of ST.KEYS) if (!ST.LOCKS.includes(ch.statLocks[s])) { ch.statLocks[s] = 'raise'; fixes.push('lock ' + s); }
  const g = ch.statGain;
  if (!g || typeof g !== 'object' || !Number.isFinite(g.cd) || !Number.isFinite(g.seed)) { ch.statGain = ST.newState(g && g.seed); fixes.push('gain state'); }
  const b = ST.natural(ch);
  for (const s of ST.KEYS) { const v = b[s]; if (!Number.isFinite(v)) { b[s] = SF.STAT_MIN; fixes.push(s + ' was ' + v); } else if (!Number.isInteger(v) || v < SF.STAT_MIN || v > SF.STAT_MAX) { b[s] = clamp(SF.STAT_MIN, SF.STAT_MAX, Math.round(v)); fixes.push(s + ' ' + v + ' → ' + b[s]); } }
  while (b.str + b.dex + b.int > SF.STAT_CAP) { const k = ST.KEYS.slice().sort((x, y) => b[y] - b[x])[0]; b[k]--; if (fixes.indexOf('over cap') < 0) fixes.push('over cap'); }
  return fixes;
};

/* eligible(ch, key): may this skill's use train stats right now? (late Second Age profile)
   The skill must be set to Raise. A Grandmaster (100.0) still trains stats. Below 100 at the 700.0 skill cap another skill
   must be set to Lower with points to give, as a skill gain would need. Held or lowered skills never train stats. */
ST.eligible = (ch, key) => {
  const s = ch.skills && ch.skills[key]; if (!s || !ST.WEIGHTS[key]) return { ok: false, reason: 'no attribute for this skill' };
  if (s.lock !== 'raise') return { ok: false, reason: 'skill is not set to Raise' };
  if (s.v < SF.SKILL_MAX && SF.totalSkill(ch) >= SF.SKILL_CAP && !Object.keys(ch.skills).some(k => k !== key && ch.skills[k].lock === 'lower' && ch.skills[k].v > 0))
    return { ok: false, reason: 'skill cap reached and no skill set to Lower' };
  return { ok: true };
};
// the stat that gives a point at the cap: the highest natural stat set to Lower above 10; ties go Strength, Dexterity, Intelligence (TUNING)
ST.donor = (ch, not) => { const b = ST.natural(ch), L = ch.statLocks || {}; let best = null; for (const s of ST.KEYS) if (s !== not && L[s] === 'lower' && b[s] > SF.STAT_MIN && (!best || b[s] > b[best])) best = s; return best; };

/* tryStatGain(ch, key, ctx) → { gained, stat, value, lowered, lowValue, chance, reason }
   One call per resolved gameplay action of skill `key`. ctx: { now: active play seconds, action: id of the resolved action
   (one roll per action; auxiliary skill checks on the same action pass aux: true), challenge: 1 (a real, fitting use or a
   Grandmaster's use), TUNING .25 (trivial use or the same target over and over), 0 (invalid: never rolls) }.
   Mutates only the natural stats (ch.base or ch), ch.statGain (cooldown, last action, random stream). */
ST.tryStatGain = (ch, key, ctx) => {
  ctx = ctx || {}; const now = Number.isFinite(ctx.now) ? ctx.now : 0;
  if (ctx.aux) return { gained: false, reason: 'auxiliary check' };
  if (!ch.statGain || !ch.statLocks) ST.migrateChar(ch);
  const st = ch.statGain;
  if (ctx.action !== undefined && ctx.action !== null) { if (st.last === ctx.action) return { gained: false, reason: 'one attribute roll per action' }; st.last = ctx.action; }
  const el = ST.eligible(ch, key); if (!el.ok) return { gained: false, reason: el.reason };
  const challenge = Number.isFinite(ctx.challenge) ? clamp(0, 1, ctx.challenge) : 1;
  if (challenge <= 0) return { gained: false, reason: 'no challenge' };
  if (now < st.cd) return { gained: false, reason: 'attribute gain cooling down' };
  const b = ST.natural(ch), L = ch.statLocks, w = ST.WEIGHTS[key], atCap = b.str + b.dex + b.int >= SF.STAT_CAP;
  const cand = ST.KEYS.filter(s => w[s] > 0 && L[s] === 'raise' && b[s] < SF.STAT_MAX && (!atCap || ST.donor(ch, s)));
  if (!cand.length) return { gained: false, reason: atCap ? 'attribute cap 225: set an attribute to Lower' : 'no attribute can rise' };
  let tot = 0; for (const s of cand) tot += w[s]; let pick = ST.rand(st) * tot, stat = cand[cand.length - 1];
  for (const s of cand) { pick -= w[s]; if (pick < 0) { stat = s; break; } }
  const chance = ST.chance(b[stat]) * challenge;
  if (ST.rand(st) >= chance) return { gained: false, stat, chance, reason: 'no gain this time' };
  let lowered = null;
  if (atCap) { lowered = ST.donor(ch, stat); if (!lowered) return { gained: false, stat, chance, reason: 'attribute cap 225: set an attribute to Lower' }; b[lowered] -= 1; }
  b[stat] += 1; st.cd = now + ST.CFG.cooldown; st.n = (st.n || 0) + 1;
  return { gained: true, stat, value: b[stat], lowered, lowValue: lowered ? b[lowered] : undefined, chance };
};
/* message(r): the journal line for a gain, or null */
ST.message = r => r && r.gained ? `Your ${ST.NAME[r.stat]} has increased to ${r.value}.` + (r.lowered ? ` Your ${ST.NAME[r.lowered]} has decreased to ${r.lowValue}.` : '') : null;

SF.STATS = ST;
})(typeof globalThis !== 'undefined' ? globalThis : this);
</script>
