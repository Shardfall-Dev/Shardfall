// usage: node tests/skills.test.js Shardfall_v0.30.0.html — the Second Age skill system (SF.SK, src/skills.js) with no browser
const fs = require('fs'); const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.30.0.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const g = {}; const m = { exports: {} };
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.METALS')))(m, g); g.SF = m.exports;
new Function('module', 'globalThis', 'SF', scripts.find(t => t.includes('SF.SK = SK')))({}, g, g.SF);
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.MAGERY = MG')))({}, g);
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.EQ = EQ')))({}, g);
const SF = g.SF, SK = SF.SK; SK.addInscription();
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', msg); };
const near = (a, b, msg, tol) => eq(Math.abs(a - b) < (tol || 1e-9), true, msg + ` (${a} ≈ ${b})`);
const seq = arr => { let i = 0; return () => arr[i++ % arr.length]; };
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
module.exports = { SF, SK, eq, near, seq, mulberry, get fails() { return fails; }, set fails(v) { fails = v; } };
const T = module.exports;

/* ===== Phase A: the registry ===== */
const CLASSIC = ['Alchemy', 'Anatomy', 'Animal Lore', 'Item Identification', 'Arms Lore', 'Parrying', 'Begging', 'Blacksmithy', 'Bowcraft & Fletching', 'Peacemaking',
  'Camping', 'Carpentry', 'Cartography', 'Cooking', 'Detecting Hidden', 'Enticement', 'Evaluating Intelligence', 'Healing', 'Fishing', 'Forensic Evaluation', 'Herding',
  'Hiding', 'Provocation', 'Inscription', 'Lockpicking', 'Magery', 'Resisting Spells', 'Tactics', 'Snooping', 'Musicianship', 'Poisoning', 'Archery', 'Spirit Speak',
  'Stealing', 'Tailoring', 'Animal Taming', 'Taste Identification', 'Tinkering', 'Tracking', 'Veterinary', 'Swordsmanship', 'Mace Fighting', 'Fencing', 'Wrestling',
  'Lumberjacking', 'Mining', 'Meditation', 'Stealth', 'Remove Trap'];
eq(SF.SKILL_DEFS.length, 49, '49 skills');
eq(SF.SKILL_DEFS.map(d => d[1]), CLASSIC, 'the classic names, in the classic skill-id order');
eq(new Set(SF.SKILL_DEFS.map(d => d[0])).size, 49, 'ids are unique');
eq(SF.SKILLS.length, 49, 'tuple view has 49 rows'); eq(SF.SKILLS.map(s => s[1]).slice(0, 3), ['Alchemy', 'Anatomy', 'Animal Lore'], 'tuple view is alphabetical');
eq(Object.keys(SF.newSkills()).length, 49, 'a new character has every skill at 0');
eq(['skinning', 'foraging', 'spellcraft', 'focus', 'smithing'].map(k => !!SF.SKILL[k]), [false, false, false, false, false], 'no old or removed ids remain');
eq(SF.SKILL_DEFS.every(d => SF.SKILL_GROUPS.some(gr => gr[0] === d[2])), true, 'every skill is in a classic group');
eq(SF.SKILL_DEFS.every(d => d[6].every(k => SF.SKILL[k])), true, 'dependencies name real skills');
eq([SF.SKILL_MAX, SF.SKILL_CAP, SF.STAT_CAP, SF.STAT_MAX], [1000, 7000, 225, 100], 'caps: 100.0 per skill, 700.0 total, 225 stats, 100 per stat');
eq(SF.RECIPES.every(r => SF.SKILL[r.skill]), true, 'every recipe names a real skill');
eq(Object.keys(SF.ITEMS).filter(k => SF.ITEMS[k].repair && !SF.SKILL[SF.ITEMS[k].repair]), [], 'every repair skill is real');
eq(['shortbow', 'arrows'].map(k => SF.RECIPE[k].skill), ['bowcraft', 'bowcraft'], 'bows and arrows are Bowcraft & Fletching');
eq([SF.repairSkill('plate_arms'), SF.repairSkill('shortbow'), SF.repairSkill('buckler')], ['blacksmithy', 'bowcraft', 'carpentry'], 'repair skills renamed');

/* ===== Phase A: save migration ===== */
const OLD41 = ['swordsmanship', 'macefighting', 'fencing', 'archery', 'wrestling', 'tactics', 'anatomy', 'parrying', 'healing', 'spellcraft', 'focus', 'wardcraft', 'meditation', 'alchemy',
  'venomcraft', 'concealment', 'shadowstep', 'search', 'tracking', 'pickpocketing', 'lockwork', 'trapcraft', 'taming', 'beasthandling', 'veterinary', 'musicianship', 'lullaby', 'discord',
  'provocation', 'woodcutting', 'mining', 'foraging', 'skinning', 'fishing', 'smithing', 'carpentry', 'tailoring', 'fletching', 'engineering', 'cooking', 'appraisal'];
eq(OLD41.length, 41, 'the v0.28 registry had 41 skills');
const oldChar = () => { const sk = {}; OLD41.forEach((k, i) => sk[k] = { v: (i * 37) % 160, lock: ['raise', 'hold', 'lower'][i % 3] }); sk.skinning.v = 123; sk.foraging.v = 45; sk.spellcraft.v = 1000; sk.smithing.v = 987;
  return { name: 'Old', skills: sk, skillPool: 30, lowerRank: ['woodcutting', 'skinning', 'tactics'], gainLog: { 'smithing|node:1,2': [5], 'skinning': [3], 'tactics|mon:9': [1] }, recipeN: { dagger: 40 },
    hotbar: [{ k: 'act', id: 'lullaby' }, { k: 'act', id: 'pick' }, { k: 'spell', id: 'magery.04' }, { k: 'act', id: 'search' }, { k: 'act', id: 'coat' }, { k: 'act', id: 'discord' }, { k: 'act', id: 'hide' }, null] }; };
let c = oldChar(); const before = Object.values(c.skills).reduce((a, s) => a + s.v, 0), locks = { spellcraft: c.skills.spellcraft.lock, smithing: c.skills.smithing.lock, concealment: c.skills.concealment.lock };
let r = SK.migrateSkills(c);
eq(Object.keys(c.skills).sort(), Object.keys(SF.SKILL).sort(), 'after migration the character has exactly the 49 skills');
eq([c.skills.magery.v, c.skills.blacksmithy.v, c.skills.magery.lock, c.skills.blacksmithy.lock, c.skills.hiding.lock], [1000, 987, locks.spellcraft, locks.smithing, locks.concealment], 'values and locks move in tenths');
eq([c.skillPool, r.displaced], [30 + 123 + 45, 168], 'Skinning and Foraging points wait in the recoverable pool');
eq(r.conserved, true, 'every tenth is accounted for'); eq(Object.values(c.skills).reduce((a, s) => a + s.v, 0) + 168, before, 'sum after + pooled = sum before');
eq(c.lowerRank, ['lumberjacking', 'tactics'], 'lower ranking follows the renames and drops removed skills');
eq(Object.keys(c.gainLog).sort(), ['blacksmithy|node:1,2', 'tactics|mon:9'], 'gain history remapped');
eq(c.recipeN, undefined, 'the permanent recipe taper record is dropped');
eq(c.hotbar.map(h => h && h.id), ['peace', 'steal', 'magery.04', 'detect', 'poison', 'entice', 'hide', null], 'hotbar actions follow the skills');
for (const k of ['armslore', 'begging', 'camping', 'cartography', 'forensicevaluation', 'herding', 'inscription', 'snooping', 'spiritspeak', 'tasteidentification']) if (c.skills[k].v !== 0) eq(k, 'zero', 'new skill starts at 0');
eq(SK.migrateSkills(c).changed, false, 'a second run is a no-op'); const snap = JSON.stringify(c); SK.migrateSkills(c); eq(JSON.stringify(c), snap, 'and changes nothing');
// collision: a save that somehow already holds a classic id keeps the higher value, the lower goes to the pool
c = { skills: { spellcraft: { v: 300, lock: 'raise' }, magery: { v: 500, lock: 'hold' } } }; r = SK.migrateSkills(c);
eq([c.skills.magery.v, c.skills.magery.lock, c.skillPool, r.conserved], [500, 'hold', 300, true], 'collision keeps 50.0, pools 30.0');
// cap: a 700.0 character stays at or under 700.0
c = { skills: {} }; let left = 7000; for (const k of OLD41) { const v = Math.min(1000, left); c.skills[k] = { v, lock: 'raise' }; left -= v; } r = SK.migrateSkills(c);
eq(SF.totalSkill(c) <= SF.SKILL_CAP && r.conserved, true, 'a capped character never passes 700.0');
// a companion's skills migrate without a pool
const ally = { skills: { swordsmanship: { v: 550, lock: 'raise' }, tactics: { v: 550, lock: 'raise' } } }; SK.migrateSkills(ally, { pool: false });
eq([ally.skills.swordsmanship.v, ally.skillPool, Object.keys(ally.skills).length], [550, undefined, 49], 'companion skills migrate, no pool');
// the combat reform (v3) still runs first on very old saves, then this one
c = { skills: { blades: { v: 400, lock: 'raise' }, spellcraft: { v: 200, lock: 'raise' }, skinning: { v: 50, lock: 'raise' } }, equip: {} };
SF.migrateCombatSkills(c); SK.migrateSkills(c);
eq([c.skills.swordsmanship.v, c.skills.magery.v, c.skillPool, Object.keys(c.skills).length], [400, 200, 50, 49], 'v2 → v3 → v8 chain');

if (require.main === module) {
  for (const f of ['skills-gain.test.js', 'skills-mech.test.js']) { const p = __dirname + '/' + f; if (fs.existsSync(p)) require(p); }
  console.log(T.fails ? T.fails + ' FAILED' : 'ALL PASS'); process.exit(T.fails ? 1 : 0);
}
