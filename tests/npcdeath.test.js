// usage: node tests/npcdeath.test.js Shardfall_v0.39.html — the pure NPC death and NPC crime rules (src/world.js, Living World phase 5 step 4).
// Who comes back and when (npcdReturns, npcdReady), the purse on a body (npcdPurse), saved bodies (npcdBodyRows: no duplicates,
// no unknown owners, no expired bodies, no unknown items), the outlaws' archetypes and roster, whom a cutthroat preys on (crimPrey)
// and which body a thief robs (crimBody).
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.39.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const src = scripts.find(t => t.includes('SIM.VERSION'));
const m = { exports: {} }; new Function('module', 'globalThis', src)(m, {}); const SIM = m.exports;
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', msg); };
const C = SIM.NPCD_CFG;

// ---- who comes back
eq(['townsfolk', 'miner', 'guard', 'shop', 'trader'].every(p => SIM.npcdReturns(p, C)), true, "policy 'return': everyone comes back");
const none = Object.assign({}, C, { policy: 'none' });
eq(['townsfolk', 'miner', 'fisher', 'student', 'dockhand'].map(p => SIM.npcdReturns(p, none)), [false, false, false, false, false], "policy 'none': ordinary residents stay dead");
eq(['guard', 'trader', 'shop', 'smith', 'innkeeper', 'scholar'].every(p => SIM.npcdReturns(p, none)), true, "policy 'none': shops, guards and the merchant still come back (no service is ever lost)");
eq(C.back, 600, 'back after ten minutes by default');

// ---- when
eq(SIM.npcdReady(C.back - 1, false, C), false, 'not before the time');
eq(SIM.npcdReady(C.back, false, C), true, 'at the time, when nobody watches the spot');
eq(SIM.npcdReady(C.back + 10, true, C), false, 'watched: it waits');
eq(SIM.npcdReady(C.back + C.unseen, true, C), true, 'watched, but the extra time has run out: it happens anyway');

// ---- the purse
eq(SIM.npcdPurse('trader', 120, .3, C), 120, 'someone who keeps a purse carries exactly that');
eq(SIM.npcdPurse('townsfolk', 0, .9, C), 0, 'an empty purse stays empty');
const g = [0, .5, .999].map(r => SIM.npcdPurse('guard', undefined, r, C));
eq(g.every(v => v >= C.purse.guard[0] && v <= C.purse.guard[1]) && g[0] === C.purse.guard[0], true, `a guard without a purse rolls in his range: ${g}`);
eq(SIM.npcdPurse('nobody-knows', undefined, 0, C), C.purse.default[0], 'an unknown profession uses the default range');

// ---- saved bodies
const ok = id => ['npc:a', 'npc:b'].includes(id), item = it => ['gold', 'shirt'].includes(it.id);
const rows = [
  { owner: 'npc:a', key: 'npc:a@10.00', x: 1, y: 2, left: 300, diedAgo: 20, items: [{ id: 'gold', qty: 5, uid: 9 }, { id: 'nonsense', qty: 1, uid: 10 }] },
  { owner: 'npc:a', key: 'npc:a@10.00', x: 1, y: 2, left: 300, items: [] },        // the same body twice
  { owner: 'npc:z', key: 'npc:z@1.00', x: 1, y: 2, left: 300, items: [] },         // nobody of that name
  { owner: 'npc:b', key: 'npc:b@2.00', x: 1, y: 2, left: 0, items: [] },           // decayed
  { owner: 'npc:b', key: 'npc:b@3.00', x: NaN, y: 2, left: 50, items: [] },        // broken
  { owner: 'npc:b', key: 'npc:b@4.00', x: 5, y: 6, left: 50, items: 'x' },         // broken items
  null,
  { owner: 'npc:a', key: 'npc:a@99.00', x: 3, y: 4, left: 10, items: [{ id: 'shirt', qty: 1, uid: 11 }] }];   // a second death of the same person: its own body
const res = SIM.npcdBodyRows(rows, { validOwner: ok, validItem: item });
eq(res.rows.map(r => r.key), ['npc:a@10.00', 'npc:a@99.00'], 'bodies restore once each, keyed by owner and time of death');
eq(res.rows[0].items.map(i => i.id), ['gold'], 'items that do not exist are dropped, the rest kept');
eq(res.dropped, { duplicate: 1, owner: 1, number: 2, items: 1, shape: 1 }, 'every bad row is dropped and counted');
eq(SIM.npcdBodyRows(undefined, { validOwner: ok, validItem: item }).rows, [], 'no bodies in an older save');

// ---- the outlaws
eq(SIM.CRIM_ROSTER.map(r => [r[1], r[2], SIM.ADV_STYLES[r[1]].crim]), [['cutthroat', 'camp', 'murderer'], ['cutpurse', 'camp', 'thief']], 'two outlaws, a murderer and a thief, living at the camp');
for (const r of SIM.CRIM_ROSTER) { const D = SIM.ADV_STYLES[r[1]]; eq(Object.values(D.skills).reduce((a, b) => a + b, 0) <= 700 && D.str + D.dex + D.int <= 225, true, `${r[1]}: within the skill and stat caps`); }
eq(SIM.ADV_ROSTER.some(r => SIM.ADV_STYLES[r[1]].crim), false, 'none of the six adventurers is an outlaw');
eq(SIM.EVENT_TYPES.includes('ActorReturned'), true, 'ActorReturned is a registered event type');

// ---- whom a cutthroat preys on
const P = SIM.CRIM_CFG;
eq(SIM.crimPrey([{ id: 'a', dist: 5, ratio: .5, guarded: false, hpF: 1 }, { id: 'b', dist: 5, ratio: .3, guarded: false, hpF: 1 }], P).id, 'b', 'the weakest');
eq(SIM.crimPrey([{ id: 'a', dist: 5, ratio: .3, guarded: true, hpF: 1 }], P), null, 'never where a guard is near');
eq(SIM.crimPrey([{ id: 'a', dist: 5, ratio: P.preyRatio, guarded: false, hpF: 1 }], P), null, 'never someone as strong as he expects to beat');
eq(SIM.crimPrey([{ id: 'a', dist: 15, ratio: .4, guarded: false, hpF: 1 }, { id: 'b', dist: 2, ratio: .4, guarded: false, hpF: 1 }], P).id, 'b', 'equal strength: the nearer');
eq(SIM.crimPrey([{ id: 'a', dist: 5, ratio: .4, guarded: false, hpF: 1 }, { id: 'b', dist: 5, ratio: .4, guarded: false, hpF: .3 }], P).id, 'b', 'equal otherwise: the hurt one');
eq(SIM.crimPrey([], P), null, 'nobody: no prey');

// ---- which body a thief robs
eq(SIM.crimBody([{ key: 'a', dist: 9, items: 2, guarded: false }, { key: 'b', dist: 3, items: 1, guarded: false }], P).key, 'b', 'the nearest body worth robbing');
eq(SIM.crimBody([{ key: 'a', dist: 3, items: 0, guarded: false }], P), null, 'not an empty one');
eq(SIM.crimBody([{ key: 'a', dist: 3, items: 4, guarded: true }], P), null, 'not under a guard\'s eyes');
eq(SIM.crimBody([{ key: 'a', dist: P.bodySight + 1, items: 4, guarded: false }], P), null, 'not out of sight');

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
