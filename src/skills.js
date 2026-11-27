<script>
/* Shardfall skill engine (SF.SK) — pure, renderer-free, network-free, deterministic when given an rng.
   The Second Age skill system: the 49-skill registry lives in src/rules.js (SF.SKILL_DEFS); this module holds the save
   migration to it, the skill checks and gains, stat gains, real and displayed values, trainers and the per-skill rules.
   Design and audit: docs/skills/T2A_SKILL_PARITY_v1.md. Status of every skill: docs/skills/STATUS.md.
   Runs in the browser (after rules.js, extends globalThis.SF) and in node for tests. */
(function (SF) {
'use strict';
const SK = {};
const clamp = SF.clamp;

/* ================= Phase A: migration to the 49-skill registry (save v8) ================= */
SK.MIGRATION = 1;
// old Shardfall id → classic id (19 renamed or reworked skills). Values move in integer tenths with their locks.
SK.RENAME = { spellcraft: 'magery', focus: 'evaluatingintelligence', wardcraft: 'resistingspells', venomcraft: 'poisoning', concealment: 'hiding',
  shadowstep: 'stealth', search: 'detectinghidden', pickpocketing: 'stealing', lockwork: 'lockpicking', trapcraft: 'removetrap', taming: 'animaltaming',
  beasthandling: 'animallore', lullaby: 'peacemaking', discord: 'enticement', woodcutting: 'lumberjacking', smithing: 'blacksmithy', fletching: 'bowcraft',
  engineering: 'tinkering', appraisal: 'itemidentification' };
// skills that are no longer skills: their trained points go to the recoverable pool; the activities stay (carving, foraging)
SK.REMOVED = ['skinning', 'foraging'];
// hotbar and ability ids that changed with the skills (sound ids such as bard.discord stay as they are)
SK.ACTION_RENAME = { lullaby: 'peace', discord: 'entice', pick: 'steal', coat: 'poison', search: 'detect' };
SK.mapKey = k => SK.RENAME[k] || k;

/* migrate one skill holder (the player or a saved companion). Idempotent: a second run changes nothing. Conserves every tenth:
   (sum after) + (points moved to the pool) === (sum before). Never pushes a skill past 100.0 or the total past 700.0. */
SK.migrateSkills = (c, opt) => {
  opt = opt || {};
  if (!c || !c.skills || (c.t2aMig || 0) >= SK.MIGRATION) return { changed: false };
  const sk = c.skills, sum = o => Object.values(o).reduce((a, s) => a + ((s && s.v) || 0), 0), before = sum(sk);
  const out = { changed: true, moved: [], pooled: [], displaced: 0 };
  for (const old of Object.keys(sk)) {
    const s = sk[old];
    if (SK.REMOVED.includes(old)) { delete sk[old]; const v = (s && s.v) || 0; if (v) { out.pooled.push({ from: old, v }); out.displaced += v; } continue; }
    const to = SK.RENAME[old]; if (!to) continue;
    delete sk[old]; out.moved.push(old + '→' + to);
    const cur = sk[to], v = (s && s.v) || 0;
    if (!cur) { sk[to] = { v, lock: (s && s.lock) || 'raise' }; continue; }
    const keep = Math.max(v, cur.v || 0), lo = Math.min(v, cur.v || 0);   // a collision keeps the higher value; the other goes to the pool
    sk[to] = v > (cur.v || 0) ? { v, lock: (s && s.lock) || 'raise' } : cur; out.pooled.push({ from: old, to, v: lo, kept: keep }); out.displaced += lo;
  }
  for (const k of Object.keys(sk)) if (!SF.SKILL[k]) { const v = (sk[k] && sk[k].v) || 0; delete sk[k]; if (v) { out.pooled.push({ from: k, v }); out.displaced += v; } }   // anything unknown is kept as pool points
  for (const k of Object.keys(SF.SKILL)) if (!sk[k]) sk[k] = { v: 0, lock: 'raise' };
  for (const k in sk) { const s = sk[k]; s.v = Math.max(0, Math.min(SF.SKILL_MAX, Math.round(s.v || 0))); if (!['raise', 'hold', 'lower'].includes(s.lock)) s.lock = 'raise'; }
  if (opt.pool !== false) c.skillPool = (c.skillPool || 0) + out.displaced;
  if (c.gainLog) { const g = {}; for (const key in c.gainLog) { const i = key.indexOf('|'), k0 = i < 0 ? key : key.slice(0, i); if (SK.REMOVED.includes(k0)) continue; const nk = SK.mapKey(k0) + (i < 0 ? '' : key.slice(i)); g[nk] = (g[nk] || []).concat(c.gainLog[key]); } c.gainLog = g; }
  if (Array.isArray(c.lowerRank)) c.lowerRank = [...new Set(c.lowerRank.filter(k => !SK.REMOVED.includes(k)).map(SK.mapKey).filter(k => SF.SKILL[k]))];
  if (Array.isArray(c.hotbar)) c.hotbar = c.hotbar.map(h => h && h.k === 'act' && SK.ACTION_RENAME[h.id] ? Object.assign({}, h, { id: SK.ACTION_RENAME[h.id] }) : h);
  delete c.recipeN;                      // the permanent per-recipe taper is gone (phase B)
  c.t2aMig = SK.MIGRATION;
  out.total = sum(sk); out.conserved = out.total + out.displaced === before;
  return out;
};

if (typeof module !== 'undefined' && module.exports) module.exports = SK;
SF.SK = SK;
})(typeof SF !== 'undefined' ? SF : globalThis.SF);
</script>
