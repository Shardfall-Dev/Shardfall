// usage: node tests/creation.test.js Shardfall_v0.31.html — character creation rules (SF.CREATION) with no browser
const fs = require('fs'); const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.31.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const g = {}; const m = { exports: {} };
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.METALS')))(m, g); g.SF = m.exports;
for (const mark of ['SF.MAGERY = MG', 'SF.EQ = EQ', 'SF.STATS = ST', 'SF.CREATION = CR']) new Function('module', 'globalThis', scripts.find(t => t.includes(mark)))({}, g);
const SF = g.SF, CR = SF.CREATION, EQ = SF.EQ;
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', msg); };
const srt = o => Object.keys(o).sort().reduce((a, k) => (a[k] = o[k], a), {});
const look = (o) => Object.assign(CR.defaultLook('male'), o || {});
const base = (o) => Object.assign({ name: 'Tess', look: look(), str: 35, dex: 20, int: 10, skills: [['swordsmanship', 50], ['tactics', 30], ['healing', 20]], town: 'quay' }, o || {});
const V = o => CR.validate(base(o));

// caps and constants
eq([SF.CREATE_STATS, SF.CREATE_STAT_MIN, SF.CREATE_STAT_MAX, SF.CREATE_SKILLS, SF.CREATE_SKILL_MAX, SF.STAT_CAP, SF.STAT_MAX, SF.SKILL_CAP, SF.SKILL_MAX], [65, 10, 45, 100, 50, 225, 100, 7000, 1000], 'creation 65/10–45, 100/50; caps 225/100, 700.0/100.0');
// every template is valid as is, and stays a template
for (const t of CR.TEMPLATES) {
  if (t.advanced) { eq(V({ str: t.s[0], dex: t.s[1], int: t.s[2], skills: CR.template(t.id).skills }).ok, false, 'Advanced needs your own skills'); continue; }
  const a = CR.template(t.id); const r = V({ str: a.stats[0], dex: a.stats[1], int: a.stats[2], skills: a.skills, town: t.town });
  eq([r.ok, r.errors, r.value && r.value.template, CR.templateIssues(t.id)], [true, [], t.id, []], 'template ' + t.n + ' valid');
  eq(a.stats.reduce((x, y) => x + y, 0), 65, t.n + ' stats sum 65'); eq(a.skills.reduce((x, y) => x + y[1], 0), 100, t.n + ' skills sum 100');
}
eq(CR.template('healer').skills.map(s => s[0]).filter(Boolean), ['healing', 'anatomy', 'spellcraft'], 'Healing is one canonical skill (no First Aid duplicate)');
// attribute rules
eq(V({ str: 45, dex: 10, int: 10 }).ok, true, '45/10/10 legal'); eq(V({ str: 10, dex: 10, int: 45 }).ok, true, '10/10/45 legal');
eq(V({ str: 44, dex: 10, int: 10 }).ok, false, 'total 64 invalid'); eq(V({ str: 45, dex: 11, int: 10 }).ok, false, 'total 66 invalid');
eq(V({ str: 46, dex: 10, int: 9 }).ok, false, '46 and 9 invalid'); eq(V({ str: 46, dex: 9, int: 10 }).ok, false, '46 / 9 invalid');
eq(V({ str: 25.5, dex: 19.5, int: 20 }).ok, false, 'fractional stats invalid');
for (const bad of [NaN, Infinity, -Infinity, '35', null, undefined, {}]) eq(V({ str: bad }).ok, false, 'stat ' + String(bad) + ' rejected');
// skill rules
eq(V({ skills: [['swordsmanship', 50], ['tactics', 50]] }).ok, true, '50/50/0 valid');
eq(V({ skills: [['swordsmanship', 50], ['tactics', 49], ['healing', 1]] }).ok, true, '50/49/1 valid');
eq(V({ skills: [['swordsmanship', 40], ['tactics', 30], ['healing', 30]] }).ok, true, '40/30/30 valid');
eq(V({ skills: [['swordsmanship', 51], ['tactics', 49]] }).ok, false, '51 invalid');
eq(V({ skills: [['swordsmanship', 50], ['tactics', 49]] }).ok, false, 'total 99 invalid');
eq(V({ skills: [['swordsmanship', 50], ['tactics', 30], ['healing', 21]] }).ok, false, 'total 101 invalid');
eq(V({ skills: [['swordsmanship', 50], ['tactics', 29.5], ['healing', 20.5]] }).ok, false, 'fractional skill points invalid');
eq(V({ skills: [['swordsmanship', 100]] }).ok, false, 'one skill of 100 invalid');
eq(V({ skills: [['swordsmanship', 50], ['tactics', 25], ['healing', 25], ['anatomy', 0]] }).ok, false, 'four rows invalid');
eq(V({ skills: [['swordsmanship', 50], ['swordsmanship', 30], ['healing', 20]] }).ok, false, 'duplicate skill rejected');
eq(V({ skills: [['spellcraft', 50], ['magery', 30], ['healing', 20]] }).ok, false, 'alias duplicate (Magery = spellcraft) rejected');
eq(V({ skills: [['Magery', 50], ['evaluatingintelligence', 30], ['Meditation', 20]] }).ok, true, 'canonical names resolve');
eq(V({ skills: [['Magery', 50], ['evaluatingintelligence', 30], ['Meditation', 20]] }).value.skills, { spellcraft: 50, focus: 30, meditation: 20 }, 'canonical ids resolve to runtime keys');
eq(V({ skills: { swordsmanship: 50, tactics: 50 } }).ok, true, 'object form accepted');
eq(V({ skills: [['firstaid', 50], ['tactics', 50]] }).ok, false, 'unknown skill rejected');
eq(V({ skills: [['shadowstep', 50], ['concealment', 50]] }).ok, false, 'Stealth cannot start');
eq(V({ skills: [['trapcraft', 50], ['lockwork', 50]] }).ok, false, 'Remove Trap cannot start');
eq(V({ skills: [['__proto__', 50], ['tactics', 50]] }).ok, false, '__proto__ rejected');
eq(V({ skills: [['constructor', 50], ['tactics', 50]] }).ok, false, 'constructor rejected');
eq(V({ skills: [['swordsmanship', NaN], ['tactics', 50]] }).ok, false, 'NaN points rejected');
eq(V({ skills: [['swordsmanship', -10], ['tactics', 60], ['healing', 50]] }).ok, false, 'negative points rejected');
eq(V({ skills: 'swordsmanship' }).ok, false, 'malformed skills rejected');
for (const k of CR.CREATABLE) eq(!!(SF.SKILL[k].live && !SF.SKILL_NOCREATE[k]), true, 'creatable ' + SF.SKILL[k].n + ' is implemented');
eq(CR.CREATABLE.includes('shadowstep') || CR.CREATABLE.includes('trapcraft') || CR.CREATABLE.includes('discord'), false, 'no Stealth, Remove Trap or Discordance in the picker');
// canonical names
eq(['spellcraft', 'focus', 'wardcraft', 'concealment', 'smithing', 'woodcutting', 'pickpocketing', 'appraisal'].map(k => SF.SKILL[k].n), ['Magery', 'Evaluating Intelligence', 'Resisting Spells', 'Hiding', 'Blacksmithy', 'Lumberjacking', 'Stealing', 'Item Identification'], 'canonical UO display names');
eq([SF.skillKey('Spellcraft'), SF.skillKey('magery'), SF.skillKey('Bowcraft & Fletching'), SF.skillKey('Hiding'), SF.skillKey('nope'), SF.skillKey(7)], ['spellcraft', 'spellcraft', 'fletching', 'concealment', null, null], 'skillKey resolves runtime keys, canonical ids and names');
// names
for (const [n, ok] of [['Tess', true], ['  Tess  ', true], ['O\'Brien', true], ['Anne-Marie', true], ['Łucja', true], ['T', false], ['', false], ['   ', false], ['12', false], ['A'.repeat(17), false], ['<b>x</b>', false], ['Te\u0000ss', false], ['Tess\n', false]]) eq(V({ name: n }).ok, ok, 'name ' + JSON.stringify(n) + (ok ? ' allowed' : ' rejected'));
eq(V({ name: '  Ser   Tess ' }).value.name, 'Ser Tess', 'name trimmed and spaces collapsed');
// appearance
eq(V({ look: CR.defaultLook('female') }).ok, true, 'female default valid');
eq(V({ look: Object.assign(CR.defaultLook('female'), { facialHairStyle: 'long' }) }).ok, false, 'female with a beard rejected');
eq(V({ look: look({ hairStyle: 'buns' }) }).ok, false, 'male with a female-only style rejected');
eq(V({ look: look({ skinTone: '#ffffff' }) }).ok, false, 'free colour rejected');
eq(V({ look: null }).ok, false, 'missing look rejected');
eq(V({ town: 'atlantis' }).ok, false, 'unknown town rejected');
eq(srt(CR.normalizeLook({ cloak: '#8a2a2a' })), srt(Object.assign(CR.defaultLook('male'), { cloak: 'crimson' })), 'legacy cloak hex → id');
eq(CR.normalizeLook({ cloak: null, mystery: 3 }).mystery, 3, 'unknown appearance fields kept');
eq(srt(CR.normalizeLook(CR.normalizeLook({ body: 'female', facialHairStyle: 'long' }))), srt(CR.defaultLook('female')), 'normalize idempotent, female beard cleared');
// male and female: identical mechanics
{ const a = V({ look: CR.defaultLook('male') }).value, b = V({ look: CR.defaultLook('female') }).value;
  eq([CR.progression(a, 1), CR.kit(a)], [CR.progression(b, 1), CR.kit(b)], 'male and female get the same stats, skills and kit'); }
// progression block: tenths once, others zero, locks raise
{ const v = V({ skills: [['swordsmanship', 50], ['tactics', 49], ['healing', 1]] }).value, p = CR.progression(v, 7);
  eq([p.skills.swordsmanship.v, p.skills.tactics.v, p.skills.healing.v], [500, 490, 10], 'skills stored in tenths once (no double scaling)');
  eq(Object.keys(p.skills).filter(k => !['swordsmanship', 'tactics', 'healing'].includes(k)).every(k => p.skills[k].v === 0), true, 'every other skill 0.0');
  eq(Object.values(p.skills).every(s => s.lock === 'raise'), true, 'skill locks Raise'); eq(p.statLocks, { str: 'raise', dex: 'raise', int: 'raise' }, 'attribute locks Raise'); }
// starter kits: every template and the low-strength edges, legal weapons, never overloaded
const mkCh = v => { const p = CR.progression(v, 1); const c = Object.assign({ id: 'p1', pack: SF.newContainer('pack', 'p1'), equip: {} }, p); for (const s of EQ.SLOT_IDS) c.equip[s] = null; return c; };
for (const t of CR.TEMPLATES.filter(t => !t.advanced)) {
  const a = CR.template(t.id), v = V({ str: a.stats[0], dex: a.stats[1], int: a.stats[2], skills: a.skills }).value, c = mkCh(v), mf = CR.kit(v), r = CR.applyKit(c, mf);
  const w = c.equip.weapon; const fam = w && SF.weaponOf(w);
  eq([r.ok, r.stage], [true, 0], `${t.n}: kit not overloaded (${r.weight.toFixed(1)} / ${r.cap.toFixed(1)} WU)`);
  eq(Object.values(c.equip).filter(Boolean).every(it => EQ.strReq(it) <= c.str), true, t.n + ': everything worn meets its Strength requirement');
  eq(!(c.equip.shield && fam && fam.two), true, t.n + ': no shield with a two-handed weapon');
  eq(new Set(c.pack.items.filter(i => !SF.ITEMS[i.id].stack).map(i => i.id)).size, c.pack.items.filter(i => !SF.ITEMS[i.id].stack).length, t.n + ': tools not duplicated');
  eq(c.pack.items.concat(Object.values(c.equip).filter(Boolean)).filter(i => !SF.ITEMS[i.id].stack).every(i => i.starter), true, t.n + ': non-stacking starter items flagged');
  eq(c.hotbar.filter(Boolean).every(h => h.k !== 'spell' || (c.pack.items.find(i => i.id === 'spellbook') || { spells: [] }).spells.includes(h.id)), true, t.n + ': hotbar spells are in the book');
}
{ const kit = id => { const a = CR.template(id); const v = V({ str: a.stats[0], dex: a.stats[1], int: a.stats[2], skills: a.skills }).value; const c = mkCh(v); CR.applyKit(c, CR.kit(v)); return c; };
  const sw = kit('swordsman'); eq([sw.equip.weapon && sw.equip.weapon.id, SF.count(sw.pack, 'gold'), SF.count(sw.pack, 'bandage')], ['sword', 100, 10], 'Swordsman: sword, 100 gold, 10 bandages');
  const ar = kit('archer'); eq([ar.equip.weapon.id, SF.count(ar.pack, 'arrow')], ['shortbow', 50], 'Archer: bow and 50 arrows');
  const mg = kit('mage'); const book = mg.pack.items.find(i => i.id === 'spellbook'); eq([!!book, book && book.spells, mg.equip.weapon], [true, SF.MAGERY.STARTER, null], 'Mage: spellbook with the first-circle starters, no weapon');
  eq(Object.keys(SF.MAGERY.REAGENTS).filter(r => SF.count(mg.pack, r) > 0).sort(), ['black_pearl', 'garlic', 'ginseng', 'nightshade', 'spider_silk'].filter(r => SF.MAGERY.STARTER.some(id => SF.MAGERY.SPELLS.find(s => s.id === id).regs.includes(r))).sort(), 'Mage: only the reagents the starter spells use');
  const bs = kit('blacksmith'); eq([SF.count(bs.pack, 'pickaxe'), SF.count(bs.pack, 'tongs'), bs.equip.weapon], [1, 1, null], 'Blacksmith: pickaxe and tongs, no weapon');
  const cp = kit('carpenter'); eq([SF.count(cp.pack, 'hatchet'), SF.count(cp.pack, 'knife')], [1, 1], 'Carpenter: hatchet and knife');
  const rg = kit('rogue'); eq([SF.count(rg.pack, 'lockpick'), rg.equip.weapon], [5, null], 'Rogue: lockpicks, no weapon');
  const bd = kit('bard'); eq(SF.count(bd.pack, 'lute'), 1, 'Bard: lute'); const tm = kit('tamer'); eq(tm.equip.weapon, null, 'Tamer: no weapon');
  const lo = V({ str: 10, dex: 45, int: 10, skills: [['macefighting', 50], ['parrying', 50]] }).value; const lc = mkCh(lo); const lm = CR.kit(lo); CR.applyKit(lc, lm);
  eq([lc.equip.weapon, lc.equip.shield, lm.notes.length], [null, null, 1], 'Mace at 10 Strength: no unusable mace, no shield, a note');
  const sp = V({ str: 20, dex: 35, int: 10, skills: [['swordsmanship', 50], ['parrying', 50]] }).value; const sc = mkCh(sp); CR.applyKit(sc, CR.kit(sp));
  eq([sc.equip.weapon.id, sc.equip.shield && sc.equip.shield.id], ['knife', 'buckler'], 'Swordsmanship at 20 Strength: the light knife, with a buckler');
  const wr = V({ str: 10, dex: 10, int: 45, skills: [['wrestling', 50], ['cooking', 50]] }).value; const wc = mkCh(wr); const res = CR.applyKit(wc, CR.kit(wr)); eq([res.ok, wc.equip.weapon], [true, null], 'non-combat 10 Strength start is legal and unloaded');
  const two = V({ str: 45, dex: 10, int: 10, skills: [['woodcutting', 50], ['swordsmanship', 50]] }).value; const tc = mkCh(two); CR.applyKit(tc, CR.kit(two)); eq([tc.equip.weapon.id, SF.count(tc.pack, 'hatchet')], ['sword', 1], 'Lumberjack swordsman: sword worn, hatchet packed');
}
// towns
{ const world = { shrines: [{ id: 'vespar', x: 100, y: 100 }], npcs: [{ role: 'banker', town: 'vespar' }, { role: 'healer', town: 'vespar' }], stand: () => true };
  eq(CR.townReady('quay', world), { ok: true, spawn: { x: 92.5, y: 304.5 }, bound: 'quay' }, 'Quay is always ready at the verified plaza spawn');
  eq(CR.townReady('vespar', world).ok, true, 'Vespar ready with shrine, bank and healer');
  eq(CR.townReady('mynoc', world).ok, false, 'a town without its shrine is not ready');
  eq(CR.townReady('vespar', Object.assign({}, world, { stand: () => false })).reason, 'spawn blocked', 'a blocked spawn is not ready'); }
// derived preview uses the shared rules
eq(CR.preview([35, 20, 10]), { hp: SF.maxHp({ str: 35 }), stam: SF.maxStam({ dex: 20 }), mana: SF.maxMana({ int: 10 }), carry: SF.carryCap({ str: 35 }) }, 'preview from SF.maxHp / maxStam / maxMana / carryCap');
eq(SF.validateCreation({}).length > 0, true, 'SF.validateCreation delegates');
{ const v = V().value, c = mkCh(v); eq(CR.title(c), 'Apprentice Swordsman', 'title from the highest real skill (50.0 Swordsmanship)'); c.skills.mining.v = 905; eq(CR.title(c), 'Master Miner', 'title follows what was raised, not the template');
  const z = mkCh(v); for (const k in z.skills) z.skills[k].v = 0; eq(CR.title(z), 'Neophyte', 'no skill: Neophyte'); }

console.log(fails ? `${fails} FAILED` : 'all creation tests passed'); process.exit(fails ? 1 : 0);
