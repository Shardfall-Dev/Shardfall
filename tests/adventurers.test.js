// usage: node tests/adventurers.test.js Shardfall_v0.36.html — the pure NPC adventurer decisions (src/world.js, Living World phase 5 step 3).
// Roster and archetypes map onto existing skills and items; what to do next (advChoose); which creature to fight (advTarget);
// which spell (advSpell); what to buy (advShopping); the resurrection policy (advAfterDeath).
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.36.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const src = scripts.find(t => t.includes('SIM.VERSION'));
const m = { exports: {} }; new Function('module', 'globalThis', src)(m, {}); const SIM = m.exports;
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', msg); };
const C = SIM.ADV_CFG;

// ---- data: the archetypes use real skill keys; the roster is unique and names its calling after the comma
const SKILLS = ['alchemy', 'anatomy', 'animallore', 'animaltaming', 'archery', 'armslore', 'begging', 'blacksmithy', 'bowcraft', 'camping', 'carpentry', 'cartography', 'cooking', 'detectinghidden', 'enticement', 'evaluatingintelligence', 'fencing', 'fishing', 'forensicevaluation', 'healing', 'herding', 'hiding', 'inscription', 'itemidentification', 'lockpicking', 'lumberjacking', 'macefighting', 'magery', 'meditation', 'mining', 'musicianship', 'parrying', 'peacemaking', 'poisoning', 'provocation', 'removetrap', 'resistingspells', 'snooping', 'spiritspeak', 'stealing', 'stealth', 'swordsmanship', 'tactics', 'tailoring', 'tasteidentification', 'tinkering', 'tracking', 'veterinary', 'wrestling'];
for (const [k, D] of Object.entries(SIM.ADV_STYLES)) {
  eq(Object.keys(D.skills).every(s => SKILLS.includes(s)), true, `${k}: every skill is on the existing registry`);
  eq(Object.values(D.skills).reduce((a, b) => a + b, 0) <= 700, true, `${k}: within the 700 skill cap`);
  eq(D.str + D.dex + D.int <= 225, true, `${k}: within the 225 stat cap`);
}
eq(new Set(SIM.ADV_ROSTER.map(r => r[0])).size, SIM.ADV_ROSTER.length, 'roster names are unique (stable ids come from them)');
eq(SIM.ADV_ROSTER.every(r => SIM.ADV_STYLES[r[1]] && ['vespar', 'mynoc', 'skara', 'moonglen'].includes(r[2]) && r[3] > 0 && r[3] <= 1 && /, /.test(r[0])), true, 'every roster entry: a known archetype, an Anniabreen town, courage in (0, 1], a calling');
eq(new Set(SIM.ADV_ROSTER.map(r => SIM.ADV_STYLES[r[1]].style)).size, 4, 'four fighting styles: melee, archer, mage, healer');
eq(SIM.controllerFor('adventurer'), 'AdventurerAI', 'the adventurer archetype is driven by AdventurerAI');
eq(['SpellCast', 'ActorResurrected', 'CorpseLooted'].every(t => SIM.EVENT_TYPES.includes(t)), true, 'new event types are registered');

// ---- advChoose
const base = { hpF: 1, manaF: null, style: 'melee', courage: .6, inTown: false, night: false, bandages: 12, draughts: 1, arrows: 0, reagents: 0, value: 0, worst: 1, foe: null, cur: 'hunt' };
const S = o => Object.assign({}, base, o);
eq(SIM.advChoose(S({})).act, 'hunt', 'healthy and stocked in the wild: hunt');
eq(SIM.advChoose(S({ foe: { ratio: .8 } })).act, 'fight', 'a fair foe: fight');
eq(SIM.advChoose(S({ foe: { ratio: .8 }, hpF: .25 })).act, 'flee', 'badly hurt in a fight: flee');
eq([SIM.advChoose(S({ foe: { ratio: .8 }, hpF: .36, courage: .3 })).act, SIM.advChoose(S({ foe: { ratio: .8 }, hpF: .36, courage: 1 })).act], ['flee', 'fight'], 'courage decides how early: the cautious run at 36 %, the brave stand');
eq(SIM.advChoose(S({ foe: { ratio: 5 } })).act, 'flee', 'outmatched: flee');
eq(SIM.advChoose(S({ bandages: 1 })).why, ['low on bandages'], 'out of bandages: go home to restock');
eq(SIM.advChoose(S({ bandages: 1 })).act, 'return', '... by walking home');
eq(SIM.advChoose(S({ value: 400 })).why, ['pack full of loot'], 'a full pack: go home to sell and bank');
eq(SIM.advChoose(S({ worst: .3 })).why, ['gear needs repair'], 'worn gear: home to repair');
eq(SIM.advChoose(S({ night: true, courage: .5 })).why, ['night is falling'], 'cautious adventurers head home at night');
eq(SIM.advChoose(S({ night: true, courage: .9 })).act, 'hunt', 'brave ones hunt on');
eq(SIM.advChoose(S({ style: 'archer', arrows: 5, bandages: 12 })).why, ['low on arrows'], 'an archer needs arrows');
eq(SIM.advChoose(S({ style: 'mage', reagents: 1, bandages: 0, manaF: 1 })).why, ['low on reagents'], 'a mage needs reagents, not bandages');
eq(SIM.advChoose(S({ hpF: .4, bandages: 0, draughts: 0 })).why.includes('hurt and out of healing'), true, 'hurt with nothing to heal with: home');
eq(SIM.advChoose(S({ inTown: true, hpF: .6 })).act, 'town', 'in town and hurt: rest');
eq(SIM.advChoose(S({ inTown: true, value: 50, bandages: 3 })).why, ['selling loot', 'buying bandages'], 'in town: sell and restock');
eq(SIM.advChoose(S({ inTown: true })).act, 'hunt', 'in town, rested and stocked: out again');
eq(SIM.advChoose(S({ inTown: true, night: true, courage: .5 })).why, ['waiting for daylight'], 'the cautious wait for daylight in town');
eq(SIM.advChoose(S({ inTown: true, bandages: 3, skip: { shop: true } })).act, 'hunt', 'it cannot pay for bandages: it goes out with what it has instead of waiting forever');
eq(SIM.advChoose(S({ bandages: 1, skip: { shop: true } })).act, 'hunt', '... and does not turn back for them');

// ---- advTarget
const t = SIM.advTarget([{ id: 'a', dist: 10, hpF: 1, ratio: .5 }, { id: 'b', dist: 4, hpF: 1, ratio: .5 }], .6, 14);
eq(t.id, 'b', 'the nearer of two equal foes');
eq(SIM.advTarget([{ id: 'a', dist: 4, hpF: 1, ratio: .5 }, { id: 'b', dist: 9, hpF: 1, ratio: .5, onMe: true }], .6, 14).id, 'b', 'whatever is attacking it comes first');
eq(SIM.advTarget([{ id: 'a', dist: 6, hpF: 1, ratio: .5 }, { id: 'b', dist: 6, hpF: .2, ratio: .5 }], .6, 14).id, 'b', 'a wounded foe is preferred');
eq(SIM.advTarget([{ id: 'a', dist: 6, hpF: 1, ratio: .5 }, { id: 'b', dist: 6, hpF: 1, ratio: .5, onFriend: true }], .6, 14).id, 'b', 'it helps someone under attack');
eq(SIM.advTarget([{ id: 'a', dist: 3, hpF: 1, ratio: 4 }], .6, 14), null, 'it never starts a fight it expects to lose');
eq(SIM.advTarget([{ id: 'a', dist: 3, hpF: 1, ratio: 4, onMe: true }], .6, 14).id, 'a', '... but defends itself');
eq(SIM.advTarget([{ id: 'b', dist: 5, hpF: 1, ratio: .5 }, { id: 'a', dist: 5, hpF: 1, ratio: .5 }], .6, 14).id, 'a', 'ties break by id (deterministic)');

// ---- advSpell
const SP = { 'magery.04': { mp: 4 }, 'magery.05': { mp: 4 }, 'magery.11': { mp: 6 }, 'magery.15': { mp: 6 }, 'magery.18': { mp: 9 }, 'magery.29': { mp: 11 }, 'magery.30': { mp: 11 }, 'magery.42': { mp: 20 } };
const mage = SIM.ADV_STYLES.mage.spells, healer = SIM.ADV_STYLES.healer.spells, info = id => SP[id];
const sp = o => Object.assign({ style: 'mage', M: 72, mana: 80, hpF: 1, poisoned: false, warded: false, foe: { dist: 6 }, has: () => true, chance: () => .9 }, o);
eq(SIM.advSpell(sp({}), mage, info), { id: 'magery.42', self: false }, 'a mage opens with its strongest bolt it can cast');
eq(SIM.advSpell(sp({ mana: 15 }), mage, info), { id: 'magery.30', self: false }, 'short of mana: a cheaper spell');
eq(SIM.advSpell(sp({ chance: id => id === 'magery.42' ? .3 : .9 }), mage, info), { id: 'magery.30', self: false }, 'a spell it would likely fizzle is skipped');
eq(SIM.advSpell(sp({ has: id => id !== 'magery.42' && id !== 'magery.30' }), mage, info), { id: 'magery.18', self: false }, 'no reagents for a spell: the next one');
eq(SIM.advSpell(sp({ hpF: .3 }), mage, info), { id: 'magery.29', self: true }, 'badly hurt in a fight: Greater Heal on itself first');
eq(SIM.advSpell(sp({ hpF: .55 }), mage, info), { id: 'magery.42', self: false }, 'a mage that is only hurt keeps attacking (no heal loop)');
eq(SIM.advSpell(sp({ hpF: .55, style: 'healer', M: 58, warded: true }), healer, info), { id: 'magery.04', self: true }, 'a healer heals sooner');
eq(SIM.advSpell(sp({ hpF: .7, foe: null }), mage, info), { id: 'magery.04', self: true }, 'no foe and hurt: Heal');
eq(SIM.advSpell(sp({ poisoned: true }), mage, info), { id: 'magery.11', self: true }, 'poisoned: Cure first');
eq(SIM.advSpell(sp({ foe: { dist: 12 } }), mage, info), null, 'out of spell range: nothing');
eq(SIM.advSpell(sp({ foe: null, hpF: .9 }), mage, info), { id: 'magery.04', self: true }, 'after a fight: tops itself up');
eq(SIM.advSpell(sp({ style: 'healer', M: 58 }), healer, info), { id: 'magery.15', self: true }, 'a healer wards itself before fighting');
eq(SIM.advSpell(sp({ style: 'healer', M: 58, warded: true, mana: 20 }), healer, info), null, 'a healer keeps its mana for healing');

// ---- advShopping
const prices = { bandage: 2, arrow: 1, draught: 25, black_pearl: 5, garlic: 3 };
let sh = SIM.advShopping('melee', { bandage: 4, draught: 2 }, 100, prices, [], C);
eq(sh.buys, [{ id: 'bandage', qty: 8, cost: 16 }], 'a fighter tops up bandages to its stock');
sh = SIM.advShopping('archer', { bandage: 12, arrow: 10, draught: 0 }, 60, prices, [], C);
eq([sh.buys.map(b => b.id + ':' + b.qty), sh.left], [['arrow:60'], 0], 'an archer buys arrows first, within the purse');
sh = SIM.advShopping('mage', { black_pearl: 1, garlic: 9, draught: 2 }, 1000, prices, ['black_pearl', 'garlic'], C);
eq(sh.buys.map(b => b.id + ':' + b.qty), ['black_pearl:' + (C.stock.reagent - 1), 'garlic:' + (C.stock.reagent - 9)], 'a mage buys its reagents up to stock, no bandages');
eq(SIM.advShopping('melee', { bandage: 0 }, 0, prices, [], C).buys, [], 'no money: nothing');

// ---- policy
eq([SIM.advAfterDeath({ res: 'healer' }), SIM.advAfterDeath({ res: 'replace' }), SIM.advAfterDeath({ res: 'none' }), SIM.advAfterDeath({ res: 'bogus' })], ['healer', 'replace', 'none', 'healer'], 'resurrection policies, healer by default');

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
