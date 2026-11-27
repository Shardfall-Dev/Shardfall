<script>
/* Shardfall attribute locks and repair (SF.STATS) — docs/stats/STAT_SYSTEM_REWORK_v1.0.md.
   Pure, renderer-free: runs in the browser after the rules and skill modules, and in node for tests (tests/stats.test.js).
   One stat engine: natural STR/DEX/INT rise from skill gains in src/skills.js (SK.statGain, weight / 33.3 per stat, the
   skill's own SF.SKILL[k].gain weights). This module adds what the spec asks on top: a raise / hold / lower lock per stat
   (only Raise gains; at the 225 total exactly one point moves from a stat set to Lower, else nothing happens), the lock
   command, the save repair and the tooltips. No stat purchases, trainers or levels. */
(function (root) {
'use strict';
const SF = root.SF; if (!SF || !SF.SK) throw new Error('stats.js needs the rules (SF) and skill (SF.SK) modules first');
const ST = {};
ST.KEYS = ['str', 'dex', 'int'];
ST.NAME = { str: 'Strength', dex: 'Dexterity', int: 'Intelligence' };
ST.ABBR = { str: 'STR', dex: 'DEX', int: 'INT' };
ST.LOCKS = ['raise', 'hold', 'lower'];
ST.natural = ch => ch.base || ch;                                 // the object holding natural str/dex/int (src/magic.js keeps buffs on top)
ST.values = ch => { const b = ST.natural(ch); return { str: b.str, dex: b.dex, int: b.int }; };
ST.total = ch => { const b = ST.natural(ch); return b.str + b.dex + b.int; };
ST.newLocks = () => ({ str: 'raise', dex: 'raise', int: 'raise' });
ST.cycleLock = l => ST.LOCKS[(ST.LOCKS.indexOf(l) + 1) % 3] || 'raise';
// which skills train each stat, for tooltips: { str: ['Swordsmanship', ...], ... }
ST.trainedBy = s => Object.values(SF.SKILL).filter(d => d.gain && d.gain[s] > 0).map(d => d.n);

/* setLock: the only stat command the UI has after creation. Never changes a value. */
ST.setLock = (ch, s, lock) => {
  if (!ST.KEYS.includes(s) || !ST.LOCKS.includes(lock)) return { ok: false, reason: 'invalid lock' };
  ch.statLocks = ch.statLocks || ST.newLocks(); ch.statLocks[s] = lock; return { ok: true };
};
ST.donor = SF.SK.statDonor;

/* migrateChar: add locks to an older character and repair malformed values. Idempotent. Legitimate stats are kept even above
   the creation limits (old characters keep their points). Returns the list of repairs. */
ST.migrateChar = ch => {
  const fixes = [];
  if (!ch.statLocks || typeof ch.statLocks !== 'object') { ch.statLocks = ST.newLocks(); fixes.push('locks'); }
  for (const s of ST.KEYS) if (!ST.LOCKS.includes(ch.statLocks[s])) { ch.statLocks[s] = 'raise'; fixes.push('lock ' + s); }
  const b = ST.natural(ch);
  for (const s of ST.KEYS) { const v = b[s]; if (!Number.isFinite(v)) { b[s] = SF.STAT_MIN; fixes.push(s + ' was ' + v); } else if (!Number.isInteger(v) || v < SF.STAT_MIN || v > SF.STAT_MAX) { b[s] = SF.clamp(SF.STAT_MIN, SF.STAT_MAX, Math.round(v)); fixes.push(s + ' ' + v + ' → ' + b[s]); } }
  while (b.str + b.dex + b.int > SF.STAT_CAP) { const k = ST.KEYS.slice().sort((x, y) => b[y] - b[x])[0]; b[k]--; if (fixes.indexOf('over cap') < 0) fixes.push('over cap'); }
  return fixes;
};
/* message(r): the journal line for a gain from SK.statGain, or null */
ST.message = r => r ? `Your ${ST.NAME[r.stat]} has increased to ${r.value}.` + (r.lowered ? ` Your ${ST.NAME[r.lowered]} has decreased to ${r.lowValue}.` : '') : null;

SF.STATS = ST;
})(typeof globalThis !== 'undefined' ? globalThis : this);
</script>
