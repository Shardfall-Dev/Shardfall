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

/* ================= Phase B: skill checks, gains, stats, real and displayed values, trainers ================= */
/* Real (base) skill is what was trained: it alone counts toward the 700.0 cap, gates prerequisites (Stealth needs 80 real Hiding)
   and is what trainers and the migration move. The displayed (effective) skill adds a small lift from the stats each skill leans on,
   fading to nothing at 100.0. Reconstruction: classic clients separated real and modified values; the size of the stat lift here
   (at most SK.STAT_BONUS points, at stat 100 and skill 0) is a Shardfall tuning choice, not a verified patch value. */
SK.STAT_BONUS = 5;
SK.base = (ch, k) => ch && ch.skills && ch.skills[k] ? ch.skills[k].v / 10 : 0;
SK.bonusTenths = (ch, k) => {
  const d = SF.SKILL[k], s = ch && ch.skills && ch.skills[k]; if (!d || !s) return 0;
  const w = d.bonus, tw = w.str + w.dex + w.int; if (!tw) return 0;
  const avg = ((ch.str || 0) * w.str + (ch.dex || 0) * w.dex + (ch.int || 0) * w.int) / tw;
  return Math.max(0, Math.floor(SK.STAT_BONUS * 10 * clamp(0, 100, avg) / 100 * (1 - s.v / SF.SKILL_MAX) + 1e-9));
};
SK.value = (ch, k) => { const s = ch && ch.skills && ch.skills[k]; if (!s) return (ch && ch.sk && ch.sk[k]) || 0; return Math.min(SF.SKILL_MAX, s.v + SK.bonusTenths(ch, k)) / 10; };
SF.sv = SK.value;                                   // every rules caller (crafting plans, …) uses the displayed value

/* ---------- gains (RunUO-style reconstruction of the classic check; docs/skills/STATUS.md) ----------
   A use is checked against a window [min, max] in skill points: below min the attempt cannot succeed and teaches nothing; at or
   above max it cannot fail and teaches nothing ("no challenge"); between, the success chance is (value − min) / (max − min).
   An eligible use teaches with chance gc = ((cap − real)/cap + (1 − chance) × (success ? .5 : .2)) / 2 × rate, never below 1%.
   Under 10.0 real every eligible use teaches 0.1–0.4. No same-target limit and no recipe taper: repetition is how you train.
   SK.POLICY is a separate, switched-off anti-automation hook for a future multiplayer server; progression never depends on it. */
SK.GAIN = { rate: 1, floor: .01, fastBelow: 100 };   // rate: single-player tuning multiplier (documented config, 1 = reference)
SK.POLICY = { antiMacro: false, window: 600, max: 3 };
SK.windowChance = (value, min, max) => value < min ? 0 : value >= max ? 1 : (value - min) / (max - min);
SK.gainChance = (real10, chance, success) => Math.max(SK.GAIN.floor, ((SF.SKILL_MAX - real10) / SF.SKILL_MAX + (1 - chance) * (success ? .5 : .2)) / 2 * SK.GAIN.rate);
/* learn from one eligible use. Returns { gained, amount, lowered, stat, reason }. ctx = { rng, now, target } */
SK.learn = (ch, key, chance, success, ctx) => {
  ctx = ctx || {}; const rng = ctx.rng || Math.random, s = ch.skills && ch.skills[key], out = { gained: false, chance, success };
  if (!s) { out.reason = 'unknown skill'; return out; }
  if (s.lock !== 'raise') { out.reason = s.lock === 'hold' ? 'skill is on Hold' : 'skill is set to Lower'; return out; }
  if (SK.POLICY.antiMacro && ctx.target) {               // off by default; a future server may switch it on
    ch.gainLog = ch.gainLog || {}; const k = key + '|' + ctx.target, L = (ch.gainLog[k] || []).filter(t => ctx.now - t < SK.POLICY.window);
    if (L.length >= SK.POLICY.max) { ch.gainLog[k] = L; out.reason = 'anti-automation limit'; return out; } L.push(ctx.now); ch.gainLog[k] = L;
  }
  const gc = SK.gainChance(s.v, chance, success); out.gc = gc;
  if (!(s.v < SK.GAIN.fastBelow || rng() < gc)) { out.reason = 'no gain this time'; return out; }
  // the gain event: the skill rises if it can, and the stats may rise with it (stats can still rise at 100.0 or at the 700 cap)
  if (s.v < SF.SKILL_MAX) {
    let amt = s.v < SK.GAIN.fastBelow ? 1 + Math.floor(rng() * 4) : 1; amt = Math.min(amt, SF.SKILL_MAX - s.v);
    if (SF.totalSkill(ch) + amt > SF.SKILL_CAP) {
      const order = (ch.lowerRank || []).concat(Object.keys(ch.skills));
      const dn = order.find(k => k !== key && ch.skills[k] && ch.skills[k].lock === 'lower' && ch.skills[k].v > 0);
      if (!dn) { out.reason = 'skill cap 700 reached: set a skill to Lower'; amt = 0; }
      else { amt = Math.min(amt, ch.skills[dn].v, SF.SKILL_CAP - SF.totalSkill(ch) + ch.skills[dn].v); ch.skills[dn].v -= amt; out.lowered = dn; }   // an atomic transfer
    }
    if (amt > 0) { s.v += amt; out.gained = true; out.amount = amt; out.value = s.v; }
  } else out.reason = 'skill is at 100';
  const st = SK.statGain(ctx.stats || ch, key, rng); if (st) out.stat = st;   // ctx.stats: the unbuffed stats when temporary effects are active
  return out;
};
/* a check against a window: rolls success, then learns if the use was a challenge. Returns { success, chance, learn } */
SK.check = (ch, key, min, max, ctx) => {
  ctx = ctx || {}; const rng = ctx.rng || Math.random, v = SK.value(ch, key), chance = SK.windowChance(v, min, max);
  if (v < min) return { success: false, chance: 0, learn: { gained: false, reason: 'too difficult to learn from' } };   // at exactly min the attempt fails but still teaches
  if (chance >= 1) return { success: true, chance: 1, learn: { gained: false, reason: 'too easy to learn from' } };
  const success = rng() < chance; return { success, chance, learn: SK.learn(ch, key, chance, success, ctx) };
};
/* learning when the action decided success itself (a swing's hit chance, a resist roll …), still bounded by an optional window */
SK.use = (ch, key, chance, success, ctx, win) => {
  if (win) { const w = SK.windowChance(SK.value(ch, key), win[0], win[1]); if (w <= 0 || w >= 1) return { gained: false, reason: w <= 0 ? 'too difficult to learn from' : 'too easy to learn from' }; }
  if (!(chance >= 0)) return { gained: false, reason: 'too difficult to learn from' };
  if (chance >= 1) return { gained: false, reason: 'too easy to learn from' };
  return SK.learn(ch, key, chance, success, ctx);
};

/* ---------- natural attribute progression ----------
   Each gain event may raise the stats its skill leans on: chance weight / 33.3 per stat (SF.SKILL[k].gain). A stat stops at 100;
   at the 225 total a gain in one stat lowers another (Second Age atrophy, no stat locks in this era). Stats never fall below 10. */
SK.STAT_DIV = 33.3;
SK.statTotal = ch => (ch.str || 0) + (ch.dex || 0) + (ch.int || 0);
SK.statGain = (ch, key, rng) => {
  const d = SF.SKILL[key]; if (!d) return null;
  for (const st of ['str', 'dex', 'int']) { const w = d.gain[st]; if (w > 0 && rng() < w / SK.STAT_DIV) { const r = SK.raiseStat(ch, st, rng); if (r) return r; } }
  return null;
};
SK.raiseStat = (ch, st, rng) => {
  if ((ch[st] || 0) >= SF.STAT_MAX) return null;
  let lowered = null;
  if (SK.statTotal(ch) + 1 > SF.STAT_CAP) {
    const others = ['str', 'dex', 'int'].filter(o => o !== st && (ch[o] || 0) > SF.STAT_MIN); if (!others.length) return null;
    lowered = others[Math.floor(rng() * others.length)]; ch[lowered]--;
  }
  ch[st] = (ch[st] || 0) + 1; return { stat: st, value: ch[st], lowered };
};

/* ---------- character creation (late 1999): 80 stat points, each 10–60; up to three different skills, 100 points, at most 50 each ----------
   Source: UOSA examples (60/10/10 style spreads); Stealth and Remove Trap cannot be starting skills (they need trained prerequisites). */
SK.CREATE = { stats: 80, statMin: 10, statMax: 60, skills: 100, skillMax: 50, count: 3, banned: ['stealth', 'removetrap'] };
SK.validateCreation = o => {
  const e = [], C = SK.CREATE, st = [o.str, o.dex, o.int];
  if (st.some(v => !Number.isInteger(v))) e.push('Stats must be whole numbers.');
  if (st.reduce((a, b) => a + b, 0) !== C.stats) e.push(`Spend exactly ${C.stats} stat points.`);
  if (st.some(v => v < C.statMin || v > C.statMax)) e.push(`Each stat must be between ${C.statMin} and ${C.statMax}.`);
  const sk = Object.entries(o.skills || {}).filter(([, v]) => v > 0);
  if (sk.length > C.count) e.push(`Choose at most ${C.count} starting skills.`);
  if (sk.reduce((a, [, v]) => a + v, 0) > C.skills) e.push(`Starting skills may total at most ${C.skills}.`);
  if (sk.some(([k, v]) => !SF.SKILL[k] || v > C.skillMax || !Number.isInteger(v))) e.push(`Each starting skill is at most ${C.skillMax}.`);
  if (sk.some(([k]) => C.banned.includes(k))) e.push('Stealth and Remove Trap cannot be starting skills.');
  return e;
};
SF.validateCreation = SK.validateCreation;
Object.assign(SF, { CREATE_STATS: SK.CREATE.stats, CREATE_STAT_MIN: SK.CREATE.statMin });

/* ---------- NPC trainers ----------
   Townsfolk teach their profession's skills (UOSA NPC trainer table, mapped onto Shardfall's people), up to 30.0, at one gold per
   0.1 point taught (reconstruction of the classic "the price is …" offer; a smaller purse buys a shorter lesson). No one sells stats. */
SK.TRAIN_CAP = 300;   // tenths
SK.TRAIN_PRICE = 1;   // gold per tenth
SK.TRAINERS = {
  trainer: ['swordsmanship', 'macefighting', 'fencing', 'wrestling', 'tactics', 'parrying', 'archery'],
  guard: ['swordsmanship', 'macefighting', 'fencing', 'wrestling', 'tactics', 'parrying'],
  smith: ['blacksmithy', 'armslore', 'mining'], miner: ['mining'], tailor: ['tailoring'], tinker: ['tinkering'], fishmonger: ['fishing'],
  workshop: ['bowcraft', 'carpentry', 'lumberjacking'], fletcher: ['bowcraft'],
  apothecary: ['alchemy', 'tasteidentification'], reagents: ['alchemy', 'tasteidentification'],
  healer: ['anatomy', 'healing', 'forensicevaluation', 'spiritspeak'],
  mage: ['magery', 'meditation', 'inscription', 'evaluatingintelligence', 'resistingspells'],
  ranger: ['archery', 'camping', 'tracking', 'detectinghidden', 'tactics'],
  stable: ['animaltaming', 'animallore', 'veterinary', 'herding'],
  scholar: ['cartography', 'itemidentification', 'inscription'],
  innkeeper: ['cooking', 'musicianship', 'peacemaking', 'provocation', 'enticement'],
  provisioner: ['camping', 'cooking'],
  outlaw: ['hiding', 'stealth', 'stealing', 'snooping', 'lockpicking', 'poisoning', 'removetrap', 'detectinghidden', 'begging', 'fencing'] };
SK.REQUIRES = { stealth: [['hiding', 80]], removetrap: [['lockpicking', 50], ['detectinghidden', 50]] };   // real skill
SK.meetsReq = (ch, k) => (SK.REQUIRES[k] || []).every(([r, n]) => SK.base(ch, r) >= n);
SK.reqText = k => (SK.REQUIRES[k] || []).map(([r, n]) => `${n} ${SF.SKILL[r].n}`).join(' and ');
/* what a trainer can teach this character in one lesson: tenths and price; gold limits the lesson */
SK.trainQuote = (ch, k, gold, free) => {
  const s = ch.skills[k]; if (!s) return { ok: false, reason: 'unknown skill' };
  if (s.lock !== 'raise') return { ok: false, reason: 'Set that skill to raise first.' };
  if (s.v >= SK.TRAIN_CAP) return { ok: false, reason: 'You already know all I can teach.' };
  if (!SK.meetsReq(ch, k)) return { ok: false, reason: `First learn ${SK.reqText(k)}.` };
  let n = SK.TRAIN_CAP - s.v; n = Math.min(n, SF.SKILL_CAP - SF.totalSkill(ch));
  if (n <= 0) return { ok: false, reason: 'That would pass the 700 cap.' };
  if (!free) n = Math.min(n, Math.floor(gold / SK.TRAIN_PRICE));
  if (n <= 0) return { ok: false, reason: 'You cannot afford even a short lesson.' };
  return { ok: true, tenths: n, price: free ? 0 : n * SK.TRAIN_PRICE, to: s.v + n, full: s.v + n >= SK.TRAIN_CAP };
};
SK.train = (ch, k, gold, free) => { const q = SK.trainQuote(ch, k, gold, free); if (!q.ok) return q; ch.skills[k].v += q.tenths; return q; };

/* ---------- difficulty windows for common uses ---------- */
SK.CRAFT_WINDOW = diff => [diff - 44, diff + 36];            // matches SF.craftChance (.55 at diff, 0 at −44, 1 at +36)
SK.repairDiff = (cond, max) => 125 * clamp(0, 1, (max - cond) / Math.max(1, max)) - 25;   // RunUO GetRepairDifficulty in skill points
SK.HARVEST = { common: [0, 100], rare: g => [g - 40, g + 40] }; // ordinary ore/logs/fish teach to 100; coloured materials from their gate − 40 to + 40
SK.magCircleWindow = circle => { const avg = (100 / 7) * (circle - 1); return [avg - 20, avg + 20]; };   // circle 1 −20…20 … circle 8 80…120
SK.resistMaxFor = circle => circle * 10 + (1 + Math.floor((circle - 1) / 6)) * 25;   // resist teaches only below this for a spell of that circle

/* ================= Phase C: rules for the reworked skills (pure; the game wires them in src/game.js) ================= */
/* Meditation (UOSA "Guide to Meditation"): passive regeneration from 1 mana / 7 s (full plate, or 0 INT and 0 skill) to 1 mana / s
   (cloth, 100 INT, 100 Meditation); active meditation doubles it, at most 2 mana / s. Metal armor (interference ≥ .10, the studded
   tunic and anything heavier) or a weapon or shield in hand stops active meditation. Starting it is a skill check whose difficulty
   follows how empty you are: it teaches between (90 − skill) % and (120 − skill) % mana. */
SK.EXT = { bracedGuard: false };   // Shardfall additions that are not Second Age skills; off in parity mode
SK.MED = { min: 1 / 7, max: 1, activeCap: 2, armorFull: .35, armorBlocks: .10, delay: 5 };
SK.manaRegen = (int, med, interference, active) => {
  const f = clamp(0, 1, 1 - (interference || 0) / SK.MED.armorFull), r = SK.MED.min + (SK.MED.max - SK.MED.min) * clamp(0, 1, ((int || 0) + (med || 0)) / 200) * f;
  return active ? Math.min(SK.MED.activeCap, 2 * r) : r;
};
SK.medWindow = manaPct => { const d = 100 - manaPct; return [d - 10, d + 20]; };
/* Hiding and Stealth (UOSA Stealth): hiding is a check across 0–100; walking while hidden reveals you unless you use Stealth, which
   needs 80 real Hiding and grants one step per 10 points of Stealth. Armor makes Stealth harder (the "optimal AR" table: cloth
   teaches to about 85, 14–16 AR to 100); above 18 AR you cannot move hidden at all. */
SK.STEALTH = { maxAR: 18, needHiding: 80, stepLen: .8 };
SK.stealthWindow = ar => { const top = 85 + Math.max(0, ar || 0); return [top - 50, top]; };
SK.stealthSteps = s => Math.max(1, Math.floor(s / 10));
/* Detecting Hidden: range skill/10 tiles (at least 1); each hidden thing in range is an opposed roll, each side ±10 */
SK.detectRadius = s => 1 + s / 10;
SK.detectBeats = (det, hide, rng) => det + Math.floor(rng() * 21) - 10 >= hide + Math.floor(rng() * 21) - 10;
/* Tracking: classic range 10 + skill/10 tiles; Shardfall's terrain is drawn at about 2.5 m per classic tile for this purpose */
SK.trackRange = s => (10 + s / 10) * 2.5;
SK.TRACK_KINDS = { animals: 'Animals', monsters: 'Monsters', people: 'People' };
/* Animal Taming (UOSA table where a Shardfall creature matches a classic one; the rest are placed between them) */
SK.TAME_MIN = { hare: 0, rat: 0, deer: 23.6, hound: 35.1, boar: 35, wreckcrab: 41.1, bear: 59.1, spider: 59.1, giant_spider: 71.1, snapper: 77.1, dire_wolf: 83.1 };
SK.tameWindow = min => [min - 25, min + 25];      // you need the minimum to try; it teaches up to 25 points past it
/* control: creatures needing 45 or less obey anyone; harder ones check 80% Taming + 20% Animal Lore against their minimum
   (RunUO's pre-AoS weighting: 70% at par, ±0.6 / 1.4 points per tenth above / below, 20–99%), minus 1% per loyalty step lost */
SK.controlChance = (taming, lore, min, loyalty) => {
  if (min <= 45) return 1;
  const w = (4 * taming + lore) / 5, d = w - min; let c = .70 + (d > 0 ? d * .06 : d * .14);
  c = clamp(.20, .99, c) - (SK.LOYALTY.max - (loyalty === undefined ? SK.LOYALTY.max : loyalty)) * .01; return clamp(0, 1, c);
};
/* pets must be fed: loyalty falls a step every 10 minutes and a meal of the right kind restores it; at 0 the pet goes wild */
SK.LOYALTY = { max: 10, step: 600, labels: ['confused', 'extremely unhappy', 'rather unhappy', 'unhappy', 'somewhat content', 'content', 'happy', 'rather happy', 'very happy', 'extremely happy', 'wonderfully happy'] };
SK.DIET = { hare: 'veg', deer: 'veg', boar: 'veg', rat: 'any', bear: 'any', hound: 'meat', dire_wolf: 'meat', snapper: 'fish', wreckcrab: 'fish', spider: 'meat', giant_spider: 'meat' };
SK.FOOD = { meat: ['meat', 'cookedmeat'], fish: ['fish', 'cookedfish'], veg: ['marshroot', 'travelloaf'], any: ['meat', 'cookedmeat', 'fish', 'cookedfish', 'marshroot', 'travelloaf', 'softcheese'] };
SK.PET_LIMIT = 5;   // Shardfall deviation: the Second Age had no follower cap; a single-player simulation keeps at most five tamed pets
/* Veterinary: bandages on pets heal like First Aid with Veterinary and Animal Lore; poison is cured from 60 / 60 (real). No pet
   resurrection by bandage in this era. */
SK.vetRange = (vet, lore) => SF.healRange(vet, lore);
SK.vetChance = vet => clamp(0, 1, (vet + 10) / 100);
SK.vetCureChance = (vet, lore) => vet < 60 || lore < 60 ? 0 : clamp(0, 1, .80 + (Math.min(vet, lore) - 60) / 200);
/* the bard: every song is a Musicianship check (0–120), then the bardic skill against the creature's difficulty (±25).
   Range 8 + skill/15 classic tiles (Shardfall: ×1.5 m). Peacemaking is the Second Age area song (targeted peace came later). */
SK.BARD = { musicWin: [0, 120], range: s => (8 + s / 15) * 1.5, peaceFor: s => 6 + s / 10, enticeFor: 20, provokeFor: 30, delay: 10, failDelay: 5 };
SK.bardWindow = diff => [diff - 25, diff + 25];
/* Stealing (RunUO pre-AoS): weight up to 10 stones; check window from weight ×10 − 22.5 to +27.5; independently, a thief with
   skill s is noticed with chance (150 − s) / 150. A stack yields up to skill/10 ÷ unit weight. Weights: Shardfall weight units. */
SK.STEAL = { maxStones: 10, range: 1.5, delay: 10 };
SK.stealWindow = stones => { const w = Math.ceil(stones) * 10; return [w - 22.5, w + 27.5]; };
SK.caughtChance = s => clamp(0, 1, (150 - s) / 150);
/* Poisoning: the potion's strength sets the window (lesser 0–60, regular 30–70, greater 50–90, deadly 80–120); a bladed or
   piercing weapon takes 18 / 16 / 14 / 12 charges; food holds it until eaten. The potion is used either way. */
SK.POISON_WIN = { 1: [0, 60], 2: [30, 70], 3: [50, 90], 4: [80, 120] };
SK.poisonCharges = lvl => 20 - 2 * lvl;
/* Lockpicking (RunUO lock levels): a lock of difficulty d teaches from d − 10 to d + 40. Remove Trap: a trap of power p teaches from p
   to p + 30 and needs 50 real Lockpicking and 50 real Detecting Hidden. */
SK.lockWindow = d => [d - 10, d + 40];
SK.trapWindow = p => [p, p + 30];
/* Evaluating Intelligence and Animal Lore: what the skill lets you read. Coarse words sharpen into numbers with skill. */
SK.INT_WORDS = ['slightly less intelligent than a rock', 'fairly stupid', 'not the brightest', 'about average', 'moderately intelligent', 'very intelligent', 'extraordinarily intelligent', 'like a formidable intellect', 'like a definite genius', 'superhumanly intelligent'];
SK.intWord = v => SK.INT_WORDS[Math.min(SK.INT_WORDS.length - 1, Math.floor(clamp(0, 99.9, v) / 10))];
SK.readExact = s => s >= 76;   // classic: exact figures show from about 76

/* ================= supporting content: items and recipes that give every skill a road to 100.0 =================
   Recipes keep the existing crafting rules (SF.craftPlan): difficulty, success, failure loss, quality. New items use existing
   materials (wood, metal, hides, reagents, fish, meat). Item and recipe ids are new; no existing id changes meaning. */
const ITEM = (id, o) => { SF.ITEMS[id] = Object.assign({ id, trade: true }, o); };
const PRICE = o => Object.assign(SF.PRICES, o);
// alchemy: four strengths of poison (the old Mire venom vial is the regular one) and a greater healing draught
SF.ITEMS.venom.n = 'Poison potion'; SF.ITEMS.venom.poisonLvl = 2;
ITEM('poison_lesser', { n: 'Lesser poison potion', kg: .2, stack: 1, cat: 'potion', poisonLvl: 1 });
ITEM('poison_greater', { n: 'Greater poison potion', kg: .2, stack: 1, cat: 'potion', poisonLvl: 3 });
ITEM('poison_deadly', { n: 'Deadly poison potion', kg: .2, stack: 1, cat: 'potion', poisonLvl: 4 });
ITEM('greater_draught', { n: 'Greater healing draught', kg: .3, stack: 1, cat: 'potion', use: 'consume' });
SF.CONSUMABLES.greater_draught = { n: 'Greater healing draught', heal: 40, cd: 16, fam: 'heal' };
// cooking: meals from fish, meat and marshroot
ITEM('fishstew', { n: 'Fish stew', kg: .5, stack: 1, cat: 'food', use: 'eat' });
ITEM('meatpie', { n: 'Marsh pie', kg: .5, stack: 1, cat: 'food', use: 'eat' });
ITEM('feast', { n: 'Saltmarsh feast', kg: 1.2, stack: 1, cat: 'food', use: 'eat' });
// tinkering: practice boxes for Lockpicking and Remove Trap, instruments of the trade, and tools for the new skills
ITEM('lockbox', { n: 'Tinker\'s lockbox', kg: 3, cat: 'tool', lockable: true });
ITEM('trapbox', { n: 'Trapped practice box', kg: 3, cat: 'tool', trappable: true });
ITEM('sextant', { n: 'Sextant', kg: 1, stack: 1, cat: 'tool' });
ITEM('spyglass', { n: 'Spyglass', kg: 1, stack: 1, cat: 'tool' });
ITEM('clockwork', { n: 'Clockwork movement', kg: 1.5, stack: 1, cat: 'tool' });
ITEM('mappen', { n: 'Mapmaker\'s pen', kg: .1, cat: 'tool', tool: 'cartography' });
ITEM('scribepen', { n: 'Scribe\'s pen', kg: .1, cat: 'tool', tool: 'inscription' });
// carpentry: the shepherd's crook (Herding)
ITEM('crook', { n: 'Shepherd\'s crook', kg: 2, cat: 'tool', tool: 'herding' });
// cartography and inscription stock, camping supplies
ITEM('blankmap', { n: 'Blank map', kg: .05, stack: 1, cat: 'scroll' });
ITEM('map_local', { n: 'Local map', kg: .05, stack: 1, cat: 'scroll' });
ITEM('map_city', { n: 'City map', kg: .05, stack: 1, cat: 'scroll' });
ITEM('map_sea', { n: 'Sea chart', kg: .05, stack: 1, cat: 'scroll' });
ITEM('map_world', { n: 'World map', kg: .05, stack: 1, cat: 'scroll' });
ITEM('blankscroll', { n: 'Blank scroll', kg: .05, stack: 1, cat: 'scroll' });
ITEM('kindling', { n: 'Kindling', kg: .5, stack: 1, cat: 'timber' });
ITEM('bedroll', { n: 'Bedroll', kg: 2, cat: 'tool' });
PRICE({ poison_lesser: 12, poison_greater: 45, poison_deadly: 90, greater_draught: 60, fishstew: 12, meatpie: 18, feast: 45, lockbox: 40, trapbox: 45, sextant: 70, spyglass: 90, clockwork: 140,
  mappen: 10, scribepen: 10, crook: 15, blankmap: 4, map_local: 18, map_city: 35, map_sea: 60, map_world: 110, blankscroll: 3, kindling: 2, bedroll: 25 });
const RX = o => SF.RECIPES.push(o);
RX({ id: 'poison_lesser', out: 'poison_lesser', qty: 1, skill: 'alchemy', min: 0, diff: 15, station: 'still', inputs: { blacksalt: 1, vial: 1 } });
SF.RECIPE.venom && Object.assign(SF.RECIPES.find(r => r.id === 'venom'), { name: 'Poison potion', min: 15, diff: 35 });
RX({ id: 'poison_greater', out: 'poison_greater', qty: 1, skill: 'alchemy', min: 55, diff: 70, station: 'still', inputs: { blacksalt: 2, marshroot: 1, vial: 1 } });
RX({ id: 'poison_deadly', out: 'poison_deadly', qty: 1, skill: 'alchemy', min: 90, diff: 100, station: 'still', inputs: { blacksalt: 3, nightshade: 2, vial: 1 } });
RX({ id: 'greater_draught', out: 'greater_draught', qty: 1, skill: 'alchemy', min: 55, diff: 75, station: 'still', inputs: { shelldust: 2, marshroot: 2, ginseng: 1, vial: 1 } });
RX({ id: 'fishstew', out: 'fishstew', qty: 1, skill: 'cooking', min: 25, diff: 45, station: 'fire', inputs: { fish: 2, marshroot: 1 } });
RX({ id: 'meatpie', out: 'meatpie', qty: 1, skill: 'cooking', min: 45, diff: 65, station: 'fire', inputs: { meat: 2, marshroot: 1, travelloaf: 1 } });
RX({ id: 'feast', out: 'feast', qty: 1, skill: 'cooking', min: 70, diff: 88, station: 'fire', inputs: { meat: 2, fish: 2, softcheese: 1, travelloaf: 1 } });
RX({ id: 'bolts', name: 'Bolts', out: 'bolt', qty: 20, skill: 'bowcraft', min: 0, diff: 20, station: 'bench', tool: 'knife', inputs: { pine: 1, ironshard: 1 } });
RX({ id: 'crossbow', name: 'Crossbow', out: 'crossbow', qty: 1, skill: 'bowcraft', min: 60, station: 'bench', tool: 'knife', prim: 'wood', defMat: 'pine', diff: 75, lines: [{ form: 'log', qty: 7 }, { item: 'sinew', qty: 2 }] });
RX({ id: 'heavycrossbow', name: 'Heavy crossbow', out: 'heavycrossbow', qty: 1, skill: 'bowcraft', min: 80, station: 'bench', tool: 'knife', prim: 'wood', defMat: 'pine', diff: 92, lines: [{ form: 'log', qty: 10 }, { item: 'sinew', qty: 3 }] });
RX({ id: 'lockbox', name: 'Tinker\'s lockbox', out: 'lockbox', qty: 1, skill: 'tinkering', min: 20, diff: 45, station: 'bench', tool: 'tongs', inputs: { ironbar: 2, pine: 2 } });
RX({ id: 'trapbox', name: 'Trapped practice box', out: 'trapbox', qty: 1, skill: 'tinkering', min: 30, diff: 55, station: 'bench', tool: 'tongs', inputs: { ironbar: 2, pine: 2, ironshard: 3 } });
RX({ id: 'mappen', name: 'Mapmaker\'s pen', out: 'mappen', qty: 1, skill: 'tinkering', min: 0, diff: 20, station: 'bench', tool: 'tongs', inputs: { ironshard: 2 } });
RX({ id: 'scribepen', name: 'Scribe\'s pen', out: 'scribepen', qty: 1, skill: 'tinkering', min: 0, diff: 20, station: 'bench', tool: 'tongs', inputs: { ironshard: 2 } });
RX({ id: 'sextant', name: 'Sextant', out: 'sextant', qty: 1, skill: 'tinkering', min: 50, diff: 70, station: 'bench', tool: 'tongs', inputs: { ironbar: 3, ironshard: 2 } });
RX({ id: 'spyglass', name: 'Spyglass', out: 'spyglass', qty: 1, skill: 'tinkering', min: 65, diff: 82, station: 'bench', tool: 'tongs', inputs: { ironbar: 2, bellshard: 1, ironshard: 2 } });
RX({ id: 'clockwork', name: 'Clockwork movement', out: 'clockwork', qty: 1, skill: 'tinkering', min: 80, diff: 95, station: 'bench', tool: 'tongs', inputs: { ironbar: 4, bellshard: 2, ironshard: 4 } });
RX({ id: 'crook', name: 'Shepherd\'s crook', out: 'crook', qty: 1, skill: 'carpentry', min: 0, diff: 20, station: 'bench', tool: 'knife', inputs: { pine: 3 } });
// the shortbow becomes a wood-primary recipe like the crossbows, so rarer woods make harder, better bows
{ const sb = SF.RECIPES.find(r => r.id === 'shortbow'); Object.assign(sb, { name: 'Bow', prim: 'wood', defMat: 'pine', lines: [{ form: 'log', qty: 4 }, { item: 'sinew', qty: 1 }] }); delete sb.inputs; }
SF.reindexRecipes();

if (typeof module !== 'undefined' && module.exports) module.exports = SK;
SF.SK = SK;
})(typeof SF !== 'undefined' ? SF : globalThis.SF);
</script>
