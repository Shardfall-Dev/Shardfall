// usage: node tests/magery.test.js Shardfall_v0.15.html — runs the rules module and the Magery module (SF.MAGERY) with no browser.
// Covers the pure delivery checks from docs/magery/Magery_Brief.txt; world behaviour is covered by the in-browser smoke run.
const fs = require('fs'); const path = require('path');
const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.15.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const rules = scripts.find(t => t.includes('SF.METALS')), magery = scripts.find(t => t.includes('SF.MAGERY = MG'));
const m = { exports: {} }; new Function('module', 'globalThis', rules)(m, {}); const SF = m.exports;
new Function('globalThis', magery)({ SF }); const MG = SF.MAGERY;
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', msg); };
const near = (a, b, msg) => eq(Math.abs(a - b) < 1e-9, true, `${msg} (${a} ≈ ${b})`);
const seq = arr => { let i = 0; return () => arr[i++ % arr.length]; };
const lo = () => 0, hi = () => .999999;

// data integrity
const doc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'magery', 'spells.json'), 'utf8'));
eq(JSON.stringify(MG.DATA), JSON.stringify(doc), 'embedded data matches docs/magery/spells.json');
eq(MG.SPELLS.length, 64, '64 spells'); eq(new Set(MG.SPELLS.map(s => s.id)).size, 64, 'unique stable ids');
eq([1, 2, 3, 4, 5, 6, 7, 8].map(c => MG.SPELLS.filter(s => s.circle === c).length), [8, 8, 8, 8, 8, 8, 8, 8], 'eight spells per circle');
eq(MG.SPELLS.every(s => s.atlas && s.atlas.length === 4 && s.art && s.classic && s.regs.length && s.regs.every(r => SF.ITEMS[r] && SF.ITEMS[r].cat === 'reagent')), true, 'icon, classic name and a nonempty reagent recipe on every record');
eq(MG.SPELLS.every(s => SF.ITEMS[s.scroll] && SF.ITEMS[s.scroll].spell === s.id), true, 'one scroll item per spell');
eq(SF.SPELLS === MG.SPELLS && SF.SPELL['magery.18'].n === 'Cinderball' && SF.SPELL.curtain.n === 'Sable Curtain' && SF.SPELL.curtain.legacy, true, 'classic book is the default; Sable Curtain stays addressable');
eq([MG.SPELL['magery.05'].regs.sort(), MG.SPELL['magery.18'].regs.sort(), MG.SPELL['magery.43'].regs.sort()], [['black_pearl', 'nightshade'], ['black_pearl', 'sulfurous_ash'], ['black_pearl', 'mandrake_root', 'sulfurous_ash']], '1998 recipes for Arcane Arrow, Cinderball, Delayed Explosion');
eq([1, 2, 3, 4, 5, 6, 7, 8].map(c => MG.SPELLS.find(s => s.circle === c && !s.summon).prep), [.5, .75, 1, 1.25, 1.5, 1.75, 2, 2.25], 'baseline preparation times');
eq([MG.SPELL['magery.33'].prep, MG.SPELL['magery.40'].prep, MG.SPELL['magery.58'].prep], [7.5, 7.5, 8.25], 'summons add 6 s');
eq(MG.SPELLS.filter(s => s.circle === 5).every(s => s.mp === 14), true, 'circle V costs 14 mana');

// success
near(MG.bookChance(MG.SPELL['magery.18'], 16.1), .02, 'book chance .02 at the gate');
near(MG.bookChance(MG.SPELL['magery.18'], 60.1), .99, 'circle III reaches .99 at 60.1');
eq(MG.bookChance(MG.SPELL['magery.18'], 16), 0, 'below the gate the book cast cannot start');
near(MG.bookChance(MG.SPELL['magery.49'], 76.1), .27, 'circle VII: .02 + .025 × (M − gate)');
near(MG.bookChance(MG.SPELL['magery.57'], 100), .5175, 'circle VIII at M=100 follows the brief: .52'); near(MG.bookChance(MG.SPELL['magery.57'], 200), .99, 'and caps at .99');
eq([MG.scrollGate(MG.SPELL['magery.05']), MG.scrollGate(MG.SPELL['magery.12']), MG.scrollGate(MG.SPELL['magery.18']), MG.scrollGate(MG.SPELL['magery.57'])], [0, 0, 1.1, 51.8], 'scroll gates: 0 for I–II, else the circle two lower');
near(MG.scrollChance(MG.SPELL['magery.42'], 40), .025 * (40 - 26.1), 'scroll chance .025 × (M − scrollGate)');
eq(MG.interruptCost(9), 5, 'interrupt costs half mana, rounded up');

// damage and resistance
near(MG.resistChance(6, 100, 100), .54, 'M=E=R=100, circle VI: 54% resist');
eq([MG.resolveHit({ mode: 'half_then_focus', base: 30, circle: 6, M: 100, E: 100, R: 100 }, hi).applied, MG.resolveHit({ mode: 'half_then_focus', base: 30, circle: 6, M: 100, E: 100, R: 100 }, lo).applied], [30, 15], 'raw 30 deals 30 or 15');
eq(MG.resolveHit({ mode: 'half_then_focus', base: 17, circle: 3, M: 70, E: 55, R: 55 }, hi).applied, 17, 'equal Focus and Wardcraft leave an unresisted hit unchanged');
eq([MG.rollBase('magery.18', 100, lo), MG.rollBase('magery.18', 100, hi)], [13, 18], 'Cinderball at M=100: 13 and 18');
eq([MG.rollBase('magery.18', 40, lo), MG.rollBase('magery.18', 40, hi)], [6, 11], 'Cinderball at M=40: 6–11');
eq([MG.rollBase('magery.29', 100, lo), MG.rollBase('magery.29', 100, hi)], [41, 50], 'Greater Mend 41–50 at M=100');
eq([MG.rollBase('magery.04', 100, lo), MG.rollBase('magery.04', 100, hi)], [11, 16], 'Lesser Mend 11–16 at M=100');
eq([MG.rollBase('magery.42', 0, lo), MG.rollBase('magery.42', 0, hi), MG.rollBase('magery.51', 0, lo), MG.rollBase('magery.51', 0, hi)], [5, 42, 8, 50], 'Aether Bolt 5–42, Flame Pillar 8–50');
let mb = MG.mindburst(100, 76); eq([mb.amount, mb.victim], [6, 'target'], 'Mindburst 100 vs 76 INT: 6 to the target');
eq([MG.resolveHit({ mode: 'half_only', base: 6, circle: 5, M: 100, E: 0, R: 100 }, lo).applied, MG.resolveHit({ mode: 'half_only', base: 6, circle: 5, M: 100, E: 0, R: 100 }, hi).applied], [3, 6], 'Mindburst resisted 3, unresisted 6, no Focus term');
mb = MG.mindburst(76, 100); eq(mb.victim, 'caster', 'reversed scores: the caster takes it'); eq(MG.mindburst(90, 90).amount, 0, 'equal scores: zero');
eq(MG.SPELL['magery.37'].reflect, false, 'Mindburst bypasses the mirror (charge survives)');
const rh = MG.reactiveHit(25, 10); eq([rh.left, rh.recoil, rh.through], [15, 2, 0], 'Rebounding Armor: pool 25 absorbs 10 → 15 left, returns 2');
eq(MG.splitPool(41, [{ id: 'b', dist: 1 }, { id: 'a', dist: 1 }, { id: 'c', dist: 1 }]).map(s => s.id + s.share), ['a14', 'b14', 'c13'], 'meteor pool 41 over three equidistant targets: 14, 14, 13 by stable id');
eq(MG.splitPool(41, []), [], 'no victims: the pool is discarded');
eq(91 - MG.earthshaker(91), 46, 'Earthshaker: 91 HP becomes 46'); eq(MG.earthshaker(1), 0, 'Earthshaker: 1 HP loses nothing');

// statuses
const mods = {}; MG.applyStatMod(mods, 'str', 8, 100); MG.applyStatMod(mods, 'str', -10, 100); eq(MG.statDelta(mods, 'str', 0), -2, '+8 STR and −10 STR combine to −2');
eq(MG.applyStatMod(mods, 'str', 5, 200), false, 'a weaker boon does not replace a stronger one'); eq(MG.applyStatMod(mods, 'str', 12, 50), true, 'a stronger boon supersedes');
eq([MG.effectiveStat(120, { str: { pos: { v: 10, until: 9 } } }, 'str', 0), MG.effectiveStat(5, { str: { neg: { v: -10, until: 9 } } }, 'str', 0)], [125, 1], 'effective stats clamp to [1, 125]');
near(MG.hexDuration(85, 100), 52.5, 'hex duration (20 + M) × (1 − .005R)'); eq(MG.A(85), 8, 'A = floor(M/10): 85.0 → 8');
near(MG.bindDuration(true, 100, 100), 1.4, 'player bind 1.4 s at 100 Wardcraft');
eq([MG.poisonTier(54.9), MG.poisonTier(55), MG.poisonTier(80)], [1, 2, 3], 'poison tiers by Spellcraft'); eq(MG.poisonOnResist(1), 0, 'resisted tier 1 → full resist');
near(MG.banishChance(100, 95, true), .65, 'Mass Banishment adds 10 points');
eq(MG.fieldTiles({ x: 0, y: -5 }, { x: 0, y: 0 }, 4).map(t => t.i), [-1, 0, 1, 2], 'four-tile wall occupies −1, 0, 1, 2');
eq(MG.fieldTiles({ x: -5, y: 0 }, { x: 0, y: 0 }, 3).map(t => [t.x, t.y]), [[0, -1], [0, 0], [0, 1]], 'wall snaps perpendicular to the cast');

// migration and learning
const legacy = MG.LEGACY_SPELL;
const old = { skills: { spellcraft: { v: 450 } }, hotbar: [{ k: 'spell', id: 'mend' }, { k: 'spell', id: 'curtain' }, { k: 'spell', id: 'ember' }, { k: 'item', id: 'bandage' }] };
let r = MG.migrateChar(old, legacy);
eq(old.hotbar.map(h => h.id), ['magery.04', 'curtain', 'magery.18', 'bandage'], 'hotbar keeps legacy-only Sable Curtain, maps genuine equivalents');
eq(r.book, ['magery.04', 'magery.05', 'magery.11', 'magery.18', 'magery.20', 'magery.22', 'magery.29', 'magery.48'], 'book holds starter pages and equivalents the save could already cast');
const snap = JSON.stringify(old); r = MG.migrateChar(old, legacy); eq([r.changed, JSON.stringify(old) === snap], [false, true], 'repeat migration is harmless');
eq(MG.translate('cinderseal'), 'magery.43', 'quest/hotbar translation service'); eq(MG.translate('saltstorm'), 'saltstorm', 'legacy-only ids pass through');
const pack = SF.newContainer('pack'); SF.addItem(pack, SF.newItem('spellbook', 1, { spells: ['magery.04'] })); SF.addItem(pack, SF.newItem('scroll.18', 2));
r = MG.learn(pack, 'scroll.18'); eq([r.ok, SF.count(pack, 'scroll.18'), [...MG.bookSpells(pack)]], [true, 1, ['magery.04', 'magery.18']], 'learning consumes one scroll once');
r = MG.learn(pack, 'scroll.18'); eq([r.ok, SF.count(pack, 'scroll.18')], [false, 1], 'a known spell does not eat another scroll');

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
