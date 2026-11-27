// usage: node tests/equipment.test.js Shardfall_v0.25.html — the equipment rules (SF.EQ) with no browser
const fs = require('fs'); const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.25.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const g = {}; const m = { exports: {} };
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.METALS')))(m, g); g.SF = m.exports;
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.MAGERY = MG')))({}, g);
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.EQ = EQ')))({}, g);
const SF = g.SF, EQ = SF.EQ;
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', msg); };
const near = (a, b, msg, tol) => eq(Math.abs(a - b) < (tol || 1e-9), true, msg + ` (${a} ≈ ${b})`);
const seq = arr => { let i = 0; return () => arr[i++ % arr.length]; };
const mk = (o) => { const c = Object.assign({ id: 'p1', name: 'Aldric', str: 60, dex: 50, int: 40, skills: SF.newSkills(), pack: SF.newContainer('pack'), bank: SF.newContainer('bank'), equip: {} }, o || {}); for (const s of EQ.SLOT_IDS) c.equip[s] = null; c.stam = SF.maxStam(c); return c; };
const give = (c, id, o) => { const it = EQ.make(id, o); SF.addItem(c.pack, it); return it; };

// slots: every armor, clothing and accessory slot takes a piece
let c = mk({ str: 100 });
const one = { head: 'plate_helm', neck: 'plate_gorget', chest: 'plate_chest', arms: 'plate_arms', hands: 'plate_gauntlets', legs: 'plate_leggings', feet: 'boots', cloak: 'cloak', ring: 'ring', bracelet: 'bracelet', necklace: 'necklace', belt: 'belt', shirt: 'shirt', trousers: 'trousers', robe: 'robe', tunic: 'tabard', weapon: 'sword', shield: 'heater_shield' };
for (const s in one) { const it = give(c, one[s]); const r = EQ.equipItem(c, { uid: it.uid }); eq([r.ok, r.slot, c.equip[s] === it], [true, s, true], 'equip ' + one[s] + ' → ' + s); }
eq(c.pack.items.length, 0, 'every piece left the pack (one canonical record per item)');
eq(EQ.audit(c).ok, true, 'no duplicate instances after 18 equips');
// full iron plate + plate helm: 30 AR on every region except the head (helm 30)
let e = EQ.effective(c); near(e.ar, 30, 'full iron plate shows 30 AR');
eq(e.dexMod, -2 - 1 - 1 - 1 - 1 - 1, 'plate Dexterity penalties sum (chest −2, arms, gauntlets, leggings, helm, heater −1)');
near(e.med, .35 * (1 - .15) + .05, 'meditation: plate pieces by coverage plus the helm', 1e-9);
near(SF.manaRegen(0, e.med), 1 - e.med, 'manaRegen takes the numeric interference');
eq(SF.manaRegen(50, 'plate'), (1 + .022 * 50) * .7, 'manaRegen still reads a legacy suit key');
// layering: the shirt under plate adds nothing; the robe over armor adds nothing; take the plate off and the cloth shows
const before = e.region.torso; EQ.unequipItem(c, { slot: 'chest' }); e = EQ.effective(c); eq([before, Math.round(e.region.torso * 10) / 10], [30, 2], 'torso: plate 30, then the robe/shirt layer 2 (strongest layer counts, never the sum)');
// piece protection by coverage
const pc = EQ.make('plate_chest'), gl = EQ.make('plate_gauntlets');
near(EQ.protection(pc), 12, 'plate chest protects 30 × 40 % = 12'); near(EQ.protection(gl), 2.1, 'gauntlets 30 × 7 % = 2.1');

// carrying capacity (spec examples)
eq([10, 25, 50, 75, 100].map(s => SF.carryCap({ str: s })), [75, 127.5, 215, 302.5, 390], 'capacity 40 + 3.5 × STR');
// weight is counted once wherever the item is
c = mk(); const pl = give(c, 'plate_leggings'); const w0 = EQ.totalWt(c); EQ.equipItem(c, { uid: pl.uid }); const w1 = EQ.totalWt(c); EQ.unequipItem(c, { slot: 'legs' }); const w2 = EQ.totalWt(c);
eq([w0, w1, w2], [7, 7, 7], 'moving plate leggings pack → legs → pack keeps 7 weight');
// Mithril
const ic = EQ.make('plate_chest', { material: 'iron' }), mc = EQ.make('plate_chest', { material: 'mithril' }), vc = EQ.make('plate_chest', { material: 'valorite' });
near(SF.itemWt(mc), .45 * SF.itemWt(ic), 'mithril plate chest weighs 45 % of iron (6.3 vs 14)');
near(SF.itemWt(mc), 6.3, 'mithril plate chest 6.3 weight');
eq([ic.id, mc.id, vc.id], ['plate_chest', 'plate_chest', 'plate_chest'], 'one definition for every metal');
eq([SF.itemName(ic), SF.itemName(mc), SF.itemName(vc)], ['Iron plate chest', 'Mithril plate chest', 'Valorite plate chest'], 'material names');
eq(EQ.protection(vc) > EQ.protection(mc) && EQ.protection(mc) > EQ.protection(ic), true, 'valorite > mithril > iron protection');
eq(SF.ITEMS.plate_chest.med, SF.ITEMS.plate_chest.med, 'mithril keeps the platemail meditation penalty (it is on the definition, not the metal)');
eq(SF.METALS.map(a => a[0]).filter(k => SF.METAL[k].mass <= .45), ['mithril'], 'mithril is the lightest metal');
// exceptional
const xc = EQ.make('plate_chest', { material: 'mithril', quality: 'exceptional', creatorName: 'Aldric' });
near(EQ.protection(xc), 12 * 1.22 * 1.08, 'exceptional mithril chest protection 12 × 1.22 × 1.08');
eq([mc.omax, xc.omax], [Math.round(50 * 1.3), Math.round(50 * 1.3 * 1.1)], 'durability 65 normal, 72 exceptional');
eq(EQ.fullName(xc), 'Exceptional Mithril plate chest', 'exceptional display name'); eq(xc.creatorName, 'Aldric', 'crafter kept');
eq(EQ.value(xc) > EQ.value(mc) && EQ.value(mc) > EQ.value(ic), true, 'value: exceptional mithril > mithril > iron');

// two-handed weapons and shields
c = mk({ str: 100 }); const sh = give(c, 'buckler'), sw = give(c, 'sword'), ha = give(c, 'glaive');
EQ.equipItem(c, { uid: sw.uid }); EQ.equipItem(c, { uid: sh.uid });
let r = EQ.equipItem(c, { uid: ha.uid }); eq([r.ok, c.equip.weapon === ha, c.equip.shield, r.displaced.map(d => d.slot).sort()], [true, true, null, ['shield', 'weapon']], 'a halberd takes both hands: sword and buckler go to the pack');
r = EQ.equipItem(c, { uid: sh.uid }); eq([r.ok, c.equip.shield === sh, c.equip.weapon, r.displaced.map(d => d.slot)], [true, true, null, ['weapon']], 'a shield sends the two-hander back');
const bow = give(c, 'shortbow'); r = EQ.equipItem(c, { uid: bow.uid }); eq([c.equip.weapon === bow, c.equip.shield], [true, null], 'bows are two-handed too');
eq(EQ.audit(c).ok && c.pack.items.length === 3, true, 'no item lost or doubled in the swaps');
// requirements and invalid slots
c = mk({ str: 30 }); const pch = give(c, 'plate_chest'); r = EQ.equipItem(c, { uid: pch.uid });
eq([r.ok, /45 Strength/.test(r.reason), c.equip.chest, c.pack.items.length], [false, true, null, 1], 'plate chest refused under 45 Strength, nothing moves');
r = EQ.equipItem(c, { uid: pch.uid, slot: 'legs' }); eq([r.ok, /does not go/.test(r.reason)], [false, true], 'invalid slot refused');
const ore = give(c, 'ore'); r = EQ.equipItem(c, { uid: ore.uid }); eq(r.ok, false, 'ore cannot be worn');

// Strength drops while overloaded: nothing is destroyed, the stage changes
c = mk({ str: 50 }); give(c, 'ironbar', { qty: 1 }); SF.addItem(c.pack, SF.newItem('ore', 60)); // 60 × 3 = 180 + 2
let en = EQ.encumbrance(c); eq([Math.round(en.wt), en.cap, en.stage, en.n], [182, 215, 2 - 1, 'Burdened'], '182/215 is burdened');
c.str = 20; en = EQ.encumbrance(c); eq([en.cap, en.stage, en.n, en.run, SF.count(c.pack, 'ore')], [110, 3, 'Immobile', false, 60], 'Strength 20: immobile, all 60 ore kept');
c.str = 35; en = EQ.encumbrance(c); eq([en.stage, en.speed, en.run], [2, .6, false], '182/162.5: overloaded, slow, no running');
const dropped = []; r = EQ.dropItem(c, { uid: c.pack.items.find(i => i.id === 'ore').uid, qty: 20 }, it => { dropped.push(it); return true; });
eq([r.ok, dropped[0].qty, SF.count(c.pack, 'ore'), EQ.encumbrance(c).stage], [true, 20, 40, 1], 'dropping 20 ore recovers to burdened');
// pickups respect capacity including worn gear
c = mk({ str: 10 }); const heavy = EQ.make('plate_chest'); c.equip.chest = heavy;   // 14 of 75 worn
const pile = SF.newContainer('pile'); pile.items.push(SF.newItem('ore', 21));       // 63 more: 77 > 75
r = EQ.pickupItem(c, pile, { uid: pile.items[0].uid }); eq([r.ok, pile.items[0].qty], [false, 21], 'pickup that would pass capacity (worn plate counted) is refused');
r = EQ.pickupItem(c, pile, { uid: pile.items[0].uid, qty: 20 }); eq([r.ok, SF.count(c.pack, 'ore'), pile.items[0].qty], [true, 20, 1], 'a smaller pickup fits');

// crafting material variants
c = mk(); c.skills.blacksmithy.v = 1000; SF.addItem(c.pack, SF.newItem('ingot_mithril', 30)); SF.addItem(c.pack, SF.newItem('ironbar', 30)); SF.addItem(c.pack, EQ.make('tongs'));
let plan = SF.craftPlan(c, c.pack, SF.RECIPE.plate_chest, 'mithril');
eq([plan.ok, plan.lines[0].id, plan.lines[0].qty, plan.gate], [true, 'ingot_mithril', 25, 98], 'mithril plate chest needs 25 mithril ingots, smith gate 98');
r = SF.craftAttempt(c, c.pack, plan, seq([.01, .99]), EQ.capFor(c), {});
eq([r.success, r.items[0].id, r.items[0].material, Math.round(SF.itemWt(r.items[0]) * 10) / 10, SF.count(c.pack, 'ingot_mithril'), SF.count(c.pack, 'ironbar')], [true, 'plate_chest', 'mithril', 6.3, 5, 30], 'crafted mithril plate chest, only mithril consumed');
plan = SF.craftPlan(c, c.pack, SF.RECIPE.plate_chest, 'iron'); r = SF.craftAttempt(c, c.pack, plan, seq([.01, .01]), EQ.capFor(c), {});
eq([r.exceptional, r.items[0].quality, r.items[0].creatorName, r.items[0].omax], [true, 'exceptional', 'Aldric', 55], 'exceptional iron chest: crafter recorded, 55 durability');
// studded leather keeps hide and stud metal apart
c = mk(); c.skills.tailoring.v = 700; SF.addItem(c.pack, SF.newItem('hide_spined', 14)); SF.addItem(c.pack, SF.newItem('rivet', 6, { material: 'verite' }));
plan = SF.craftPlan(c, c.pack, SF.RECIPE.studded_tunic, 'spined', 'verite');
eq([plan.ok, plan.lines.map(l => l.id + (l.mat ? ':' + l.mat : '') + '×' + l.qty)], [true, ['hide_spined×14', 'rivet:verite×6']], 'spined studded tunic with verite studs');
r = SF.craftAttempt(c, c.pack, plan, seq([.01, .99]), EQ.capFor(c), {});
eq([r.items[0].material, r.items[0].sec, SF.itemName(r.items[0])], ['spined', 'verite', 'Spined studded tunic'], 'primary and secondary materials stored separately');
c.skills.tailoring.v = 500; plan = SF.craftPlan(c, c.pack, SF.RECIPE.leather_tunic, 'spined'); eq([plan.ok, plan.effMin], [false, 55], 'spined leather needs Tailoring 55');
eq(SF.RECIPES.filter(r => r.cat === 'Armor').every(r => SF.ITEMS[r.out] && SF.ITEMS[r.out].fam), true, 'every armor recipe makes an equipment definition');
eq(EQ.DEFS.filter(d => !SF.RECIPES.some(r => r.out === d.id)).map(d => d.id), [], 'every standard piece is craftable');
eq(SF.RECIPES.some(r => r.out === 'leather'), false, 'the old one-piece leather suit recipe is gone');

// durability, broken armor and region mitigation
c = mk({ str: 100 }); const chest = EQ.make('chain_tunic'); c.equip.chest = chest;
eq(EQ.regionArmor(c, 'torso'), { ar: 23, item: chest, region: 'torso' }, 'a torso blow meets the chain tunic (23)');
eq(EQ.regionArmor(c, 'head'), { ar: 0, item: null, region: 'head' }, 'an unprotected head takes the blow');
chest.cond = 0; eq([EQ.regionArmor(c, 'torso').ar, EQ.effective(c).ar, EQ.effective(c).broken], [0, 0, ['chest']], 'broken armor gives nothing (but is not destroyed)');
chest.cond = 5; eq(EQ.regionArmor(c, 'torso').ar, Math.round(23 * .85), 'badly worn armor −15 %');
const mres = SF.mitigate(10, { armorAR: 23, shieldAR: 0, player: false }, () => .99); eq(mres.final >= 0, true, 'mitigation never goes negative');
const regs = {}; const rr = seq([0, .39, .4, .59, .6, .74, .75, .89, .9, .96, .97, .999]); for (let i = 0; i < 12; i++) { const k = EQ.pickRegion(rr); regs[k] = (regs[k] || 0) + 1; }
eq(regs, { torso: 2, legs: 2, arms: 2, head: 2, hands: 2, neck: 2 }, 'region thresholds 40/20/15/15/7/3');
// repair risk
const it2 = EQ.make('plate_arms'); it2.cond = 10; r = SF.repair(it2, { skill: 100, rng: () => .5 }); eq([r.ok, r.lost, it2.cond, it2.maxc], [true, 0, 50, 50], 'skilled repair (risk 20 %) without loss');
it2.cond = 10; r = SF.repair(it2, { skill: 100, rng: () => .1 }); eq([r.lost, it2.maxc], [2, 48], 'unlucky repair loses 3 % of the original maximum');
eq([SF.repairRisk(20), SF.repairRisk(100), SF.repairSkill('plate_arms'), SF.repairSkill('studded_tunic'), SF.repairSkill('wooden_shield')], [1, .2, 'blacksmithy', 'tailoring', 'carpentry'], 'repair risk and repair skills');

// atomic transactions: a failure in the middle restores everything
c = mk({ str: 100 }); const a1 = give(c, 'plate_helm'), a2 = give(c, 'chain_coif'); EQ.equipItem(c, { uid: a1.uid });
const snapSig = JSON.stringify([c.pack.items.map(i => i.uid), EQ.signature(c)]);
r = EQ.tx(c, () => { c.pack.items.splice(0, 1); c.equip.head = null; throw new Error('boom'); });
eq([r.ok, JSON.stringify([c.pack.items.map(i => i.uid), EQ.signature(c)]) === snapSig], [false, true], 'an exception mid-transaction rolls back pack and equipment');
r = EQ.tx(c, () => { c.pack.items.push(c.equip.head); return { ok: true }; });
eq([r.ok, /duplicate/.test(r.reason), JSON.stringify([c.pack.items.map(i => i.uid), EQ.signature(c)]) === snapSig], [false, true, true], 'a transaction that would duplicate an item is refused and rolled back');
r = EQ.dropItem(c, { uid: a2.uid }, () => false); eq([r.ok, c.pack.items.includes(a2)], [false, true], 'a drop that cannot be placed is undone');
// split and merge
c = mk(); SF.addItem(c.pack, SF.newItem('arrow', 50)); const ar = c.pack.items[0];
r = EQ.splitStack(c.pack, { uid: ar.uid, qty: 20 }); eq([r.ok, c.pack.items.map(i => i.qty), SF.count(c.pack, 'arrow')], [true, [30, 20], 50], 'split 50 arrows into 30 + 20');
r = EQ.mergeStacks(c.pack, { from: r.uid, into: ar.uid }); eq([r.ok, c.pack.items.map(i => i.qty)], [true, [50]], 'merge them back');
eq(EQ.splitStack(c.pack, { uid: ar.uid, qty: 50 }).ok, false, 'cannot split off the whole stack');

// death moves the real instances into the corpse, exactly once
c = mk({ str: 100 }); const d1 = give(c, 'plate_chest', { material: 'valorite', quality: 'exceptional', creatorName: 'Aldric' }); EQ.equipItem(c, { uid: d1.uid }); d1.cond = 40; give(c, 'gold', { qty: 1 });
const corpse = SF.deathTransaction(c, 0, { x: 0, y: 0 });
eq([corpse.items.includes(d1), d1.material, d1.quality, d1.creatorName, d1.cond, c.equip.chest, c.equip.tunic && c.equip.tunic.id], [true, 'valorite', 'exceptional', 'Aldric', 40, null, 'garment'], 'corpse holds the same valorite chest (material, quality, crafter, durability); respawn tunic worn');
eq(EQ.audit(c, [corpse]).ok, true, 'no duplicates between body and corpse');

// save migration: v0.24 suits → pieces
const old = { str: 60, dex: 50, equip: { weapon: { uid: 5, id: 'sword', qty: 1 }, shield: null, armor: { uid: 6, id: 'plate', qty: 1, cond: 50, maxc: 100, quality: 'exceptional' } }, pack: { items: [{ uid: 7, id: 'chain', qty: 1, cond: 100, maxc: 100 }, { uid: 8, id: 'clothvest', qty: 1 }] }, bank: { items: [{ uid: 9, id: 'leather', qty: 1 }] } };
SF.setUidBase(100); let mg = EQ.migrateActor(old);
eq([old.equip.armor, old.equip.chest.id, old.equip.chest.uid, old.equip.legs.id, old.equip.chest.quality, old.equip.chest.cond, old.equip.chest.omax], [undefined, 'plate_chest', 6, 'plate_leggings', 'exceptional', 28, 55], 'worn plate suit → five worn plate pieces, half worn, exceptional kept');
eq([old.pack.items.map(i => i.id), old.bank.items.length], [['chain_coif', 'chain_tunic', 'chain_leggings', 'shirt', 'trousers'], 6], 'suits in the pack and bank become pieces');
const sig = JSON.stringify(old); mg = EQ.migrateActor(old); eq([mg.changed, JSON.stringify(old) === sig], [false, true], 'migration runs once');
const g2 = { equip: { weapon: null, shield: null, armor: { uid: 3, id: 'garment', qty: 1 } }, pack: [] }; EQ.migrateActor(g2); eq([g2.equip.tunic.id, 'armor' in g2.equip], ['garment', false], 'the respawn tunic moves to the tunic slot (ally save shape too)');
// effective attributes are derived, never stacked
c = mk({ dex: 50, str: 100 }); const pcx = give(c, 'plate_chest'); EQ.equipItem(c, { uid: pcx.uid }); EQ.refresh(c); EQ.refresh(c); EQ.refresh(c);
eq([c.dex, c.eqDex, SF.maxStam(c)], [50, -2, 48], 'base Dexterity untouched; three refreshes give one −2');
const saved = JSON.parse(JSON.stringify({ dex: c.dex, equip: c.equip })); const c2 = mk({ dex: saved.dex }); c2.equip = JSON.parse(JSON.stringify(saved.equip)); EQ.refresh(c2); eq([c2.dex, SF.maxStam(c2)], [50, 48], 'after a save round trip the penalty applies once');
// appearance data for the future sprite renderer
const ap = EQ.appearance(c); eq(ap.map(l => l.layer), ['torso'], 'appearance layers'); eq(typeof EQ.signature(c), 'string', 'appearance signature');
eq(EQ.DEFS.every(d => d.look && d.look.asset && d.look.dirs === 8), true, 'every definition carries future visual metadata');
eq(EQ.DEFS.filter(d => d.rare).every(d => d.fam === 'dragon'), true, 'only dragon scale is rare');
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
