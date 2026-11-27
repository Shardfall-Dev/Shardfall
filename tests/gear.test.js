// usage: node tests/gear.test.js Shardfall_v0.32.html — the shared equipment appearance (SF.GEAR) and the layered human rig, no browser
const fs = require('fs'); const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.32.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const g = {}; const m = { exports: {} };
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.METALS')))(m, g); g.SF = m.exports;
for (const mark of ['SF.MAGERY = MG', 'SF.EQ = EQ', 'SF.STATS = ST', 'SF.CREATION = CR', 'SF.GEAR = GEAR', 'root.HUMAN_RIG = RIG']) new Function('module', 'globalThis', scripts.find(t => t.includes(mark)))({}, g);
const SF = g.SF, EQ = SF.EQ, GEAR = SF.GEAR, RIG = g.HUMAN_RIG, CR = SF.CREATION;
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', msg); };
const mk = o => { const c = Object.assign({ id: 'p1', name: 'Aldric', str: 100, dex: 50, int: 40, skills: SF.newSkills(), pack: SF.newContainer('pack'), bank: SF.newContainer('bank'), equip: {}, look: CR.defaultLook('male') }, o || {}); for (const s of EQ.SLOT_IDS) c.equip[s] = null; c.stam = SF.maxStam(c); return c; };
// crafted weapons record their material (SF.craftOutputs); EQ.make does that only for armor pieces
const wear = (c, id, o) => { const it = SF.ITEMS[id].fam || !(o && o.material) ? EQ.make(id, o) : SF.newItem(id, 1, { cond: 100, maxc: 100, omax: 100, material: o.material }); SF.addItem(c.pack, it); const r = EQ.equipItem(c, { uid: it.uid }); if (!r.ok) throw new Error('equip ' + id + ': ' + r.reason); return it; };
const col = mm => EQ.matColor(mm);

// ---- coverage: every wearable item and every weapon resolves; every weapon has a rig animation
const wearable = Object.keys(SF.ITEMS).filter(id => { const d = SF.ITEMS[id]; return d.trade && !d.legacy && ((d.slot && EQ.SLOT[d.slot]) || d.wpn); });
const bad = wearable.filter(id => { const d = SF.ITEMS[id], p = GEAR.piece(d.slot || 'weapon', { id, uid: 'x' }, CR.defaultLook('male')); return !p || !/^#[0-9a-f]{6}$/i.test(p.color); });
eq(bad, [], `all ${wearable.length} wearable items resolve to a piece with a colour`);
eq(Object.keys(SF.WEAPONS).filter(k => !GEAR.WEAPON_RIG[k]), [], 'every SF.WEAPONS id has a rig attack animation and geometry');
eq(Object.values(GEAR.WEAPON_RIG).every(([a]) => RIG.ANIMATIONS[a]), true, 'every mapped attack animation exists in the rig');
eq(Object.keys(GEAR.ART).filter(id => !SF.ITEMS[id]), [], 'the art map names only existing item ids (no new gameplay items)');

// ---- independent material channels on a mixed set
let c = mk();
wear(c, 'plate_chest', { material: 'valorite' }); wear(c, 'plate_arms', { material: 'mithril' }); wear(c, 'plate_leggings', { material: 'iron' });
wear(c, 'studded_gloves', { material: 'spined', sec: 'golden' }); wear(c, 'leather_cap', { material: 'horned' }); wear(c, 'sword', { material: 'verite' });
let R = GEAR.ofChar(c), S = R.slots;
eq([S.chest.color, S.arms.color, S.legs.color], [col('valorite'), col('mithril'), col('iron')], 'each plate piece shows its own metal (valorite chest, mithril arms, iron legs)');
eq([S.hands.color, S.hands.secColor], [col('spined'), col('golden')], 'studded gloves: spined leather and golden studs are separate channels');
eq(S.head.color, col('horned'), 'leather cap shows horned leather');
eq([S.weapon.hex.metal, S.weapon.hex.wood], [col('verite'), col('pine')], 'sword: verite blade and pine grip are independent');
const k0 = R.key; c.equip.hands.sec = 'iron'; eq(GEAR.ofChar(c).key !== k0 && GEAR.ofChar(c).slots.hands.color === col('spined'), true, 'changing only the stud metal changes the look key, not the leather colour');
c.equip.hands.sec = 'golden';
eq(GEAR.ofChar(c).key, k0, 'the key is stable for the same equipment');

// ---- weapons: bows are wood with iron fittings; a bloodwood bow
c = mk(); wear(c, 'shortbow', { material: 'bloodwood' }); S = GEAR.ofChar(c).slots;
eq([S.weapon.primKind, S.weapon.color, S.weapon.hex.metal], ['wood', col('bloodwood'), col('iron')], 'bloodwood bow: wood channel bloodwood, metal fittings iron');
c = mk(); wear(c, 'crossbow', { material: 'yew' }); eq(GEAR.ofChar(c).slots.weapon.hex.wood, col('yew'), 'crossbow stock in yew');

// ---- two-handed weapons hide the off hand in every state
c = mk(); wear(c, 'glaive'); R = GEAR.ofChar(c); eq(R.occ.offhand, false, 'halberd (two-handed): off hand hidden');
c.equip.shield = EQ.make('heater_shield'); eq(GEAR.ofChar(c).occ.offhand, false, 'even with a shield left in the slot by an old save');
c = mk(); wear(c, 'sword'); wear(c, 'heater_shield', { material: 'agapite' }); R = GEAR.ofChar(c); eq([R.occ.offhand, R.slots.shield.color], [true, col('agapite')], 'one-handed sword: agapite heater shield shown');
eq(GEAR.twoHanded({ id: 'hatchet' }), true, 'the hatchet is two-handed in the existing rules');

// ---- helmets: hair and face
const occOf = id => { const cc = mk(); if (id) wear(cc, id); const o = GEAR.ofChar(cc).occ; return [o.hair, o.face]; };
eq([occOf(null), occOf('leather_cap'), occOf('chain_coif'), occOf('plate_helm'), occOf('great_helm')], [['all', true], ['trim', true], ['none', true], ['none', false], ['none', false]], 'hair and face under no helmet, cap, coif, plate helm, great helm');
eq(EQ.SLOT_IDS.filter(s => s === 'head').length && Object.keys(SF.ITEMS).filter(id => SF.ITEMS[id].slot === 'head' && SF.ITEMS[id].trade && !GEAR.HEAD_COVER[id]), [], 'every head piece has an occlusion rule');

// ---- cloth wears the character's colours
c = mk({ look: Object.assign(CR.defaultLook('female'), { clothingColor: 'wine', cloak: 'royal' }) }); wear(c, 'robe'); wear(c, 'cloak');
S = GEAR.ofChar(c).slots; eq([S.robe.color, S.cloak.color], ['#6b2531', '#2a3a8a'], 'robe in the chosen clothing colour, cloak in the chosen cloak colour');
eq(GEAR.ofChar(c).body, 'female', 'female body from the look');

// ---- the renderer reads only: no item or slot changes
c = mk(); const pl = wear(c, 'plate_chest', { material: 'bronze' }); const before = JSON.stringify(c.equip); for (let i = 0; i < 5; i++) GEAR.ofChar(c); GEAR.snapshot(c);
eq([JSON.stringify(c.equip) === before, EQ.audit(c).ok, c.equip.chest === pl], [true, true, true], 'resolving and snapshotting change nothing (same item instance, audit clean)');

// ---- corpses keep the look they died in
c = mk(); wear(c, 'chain_tunic', { material: 'copper' }); wear(c, 'norse_helm', { material: 'golden' }); wear(c, 'spear');
const snap = GEAR.snapshot(c), keySnap = snap.key; const body = SF.deathTransaction(c, 100, { x: 1, y: 1 });
eq([Object.isFrozen(snap.slots.chest), snap.slots.chest.color, GEAR.ofChar(c).slots.chest], [true, col('copper'), undefined], 'snapshot is frozen and survives the death transaction (items moved to the corpse)');
eq(body.items.some(it => it.id === 'chain_tunic'), true, 'loot unchanged: the tunic is in the corpse container');
const back = GEAR.restore(JSON.parse(JSON.stringify(snap))); eq([back.key, back.slots.head.id, back.occ.offhand], [keySnap, 'norse_helm', false], 'a saved snapshot restores the same appearance');
eq(GEAR.restore({ v: 9 }), null, 'a malformed snapshot is refused (the old corpse art is used)');

// ---- NPC presets: real item ids only, deterministic looks
for (const k in GEAR.PRESETS) { const e = GEAR.PRESETS[k](); const ids = Object.values(e).map(i => i.id); if (ids.some(id => !SF.ITEMS[id])) { fails++; console.log('FAIL preset', k, ids); } }
console.log('ok   every NPC preset uses existing item ids'); eq(GEAR.npcLook('guard-7'), GEAR.npcLook('guard-7'), 'an NPC seed always gives the same look');
eq(CR.checkLook(GEAR.npcLook('x1')).length, 0, 'generated NPC looks pass the creation validator');

// ---- animation translation: every painted clip maps to a rig action
const clips = ['Idle', 'Walk', 'CastPrepare', 'CastHold', 'CastRelease', 'Dagger_Ready', 'Dagger_Walk', 'Sword_Ready', 'Sword_Walk', 'Hammer_Ready', 'Hammer_Walk', 'Glaive_Ready', 'Glaive_Walk', 'Shortbow_Ready', 'Shortbow_Walk', 'Crossbow_Ready', 'Crossbow_Walk', 'Unarmed_Ready', 'Unarmed_Attack', 'Dagger_Attack', 'Sword_Attack', 'Hammer_Attack', 'Glaive_Attack', 'Shortbow_Attack', 'Crossbow_Attack'];
const badClip = []; for (const k of clips) for (const w of Object.keys(SF.WEAPONS)) for (let f = 0; f < 10; f++) { const [a, fr] = GEAR.fromClip(k, f, w, 3); if (!RIG.ANIMATIONS[a] || fr < 0 || fr >= RIG.ANIMATIONS[a]) badClip.push(k + '/' + w + '/' + f); }
eq(badClip, [], 'every clip × weapon × frame maps to a valid rig action and frame');
eq([GEAR.fromClip('Sword_Attack', 4, 'glaive')[0], GEAR.fromClip('CastPrepare', 0, 'spear')[0], GEAR.fromClip('CastPrepare', 0, 'sword')[0], GEAR.fromClip('Walk', 0, 'sword', 7)[0]], ['polearm', 'caststaff', 'cast1h', 'run'], 'attack follows the weapon, casting follows the hands, speed picks run');

// ---- the rig: every animation, direction and body draws; occlusion holds in every pose
const L = { skin: '#d0a080', hair: '#123456', beardHex: '#123456', cloth: '#a89878', style: 'long', beard: 'short' };
c = mk(); for (const [id, o] of [['plate_chest', { material: 'valorite' }], ['plate_arms', {}], ['plate_leggings', {}], ['plate_gauntlets', {}], ['boots', {}], ['sword', { material: 'mithril' }], ['heater_shield', { material: 'golden' }], ['cloak', {}]]) wear(c, id, o);
R = GEAR.ofChar(c); let n = 0, empty = 0; const shieldHex = col('golden');
let shieldInTwoHand = 0, shieldShown = 0;
for (const body of ['male', 'female']) for (const a in RIG.ANIMATIONS) for (let d = 0; d < 8; d++) for (let f = 0; f < RIG.ANIMATIONS[a]; f++) {
  const ops = RIG.frameOps(Object.assign({ gear: Object.assign({}, R, { body }), dir: d, action: a, frame: f, weaponRig: GEAR.WEAPON_RIG }, L)); n++; if (!ops.length) empty++;
  if (a === 'idle' && ops.includes(shieldHex)) shieldShown++;
}
eq(empty, 0, `${n} frames (2 bodies × 29 animations × 8 directions) all draw`);
eq(shieldShown, 2 * 8 * 4, 'the one-handed set shows its shield in every idle frame');
c.equip.weapon = EQ.make('glaive'); R = GEAR.ofChar(c);
for (const a in RIG.ANIMATIONS) for (let d = 0; d < 8; d++) { const ops = RIG.frameOps(Object.assign({ gear: R, dir: d, action: a, frame: 2, weaponRig: GEAR.WEAPON_RIG }, L)); if (ops.includes(shieldHex)) shieldInTwoHand++; }
eq(shieldInTwoHand, 0, 'with a two-handed weapon the shield is hidden in all 29 animations × 8 directions');
const hairIn = id => { const cc = mk(); if (id) wear(cc, id); return RIG.frameOps(Object.assign({ gear: GEAR.ofChar(cc), dir: 0, action: 'walk', frame: 3, weaponRig: GEAR.WEAPON_RIG }, L)).split('#123456').length - 1; };
const [h0, hCap, hPlate] = [hairIn(null), hairIn('leather_cap'), hairIn('plate_helm')];
eq([h0 > hCap, hCap > 0, hPlate], [true, true, 0], `hair: full (${h0} shapes), trimmed under a cap (${hCap}), none under a plate helm (beard hidden too)`);
c = mk(); wear(c, 'studded_tunic', { material: 'barbed', sec: 'valorite' });
const st = RIG.frameOps(Object.assign({ gear: GEAR.ofChar(c), dir: 0, action: 'idle', frame: 0, weaponRig: GEAR.WEAPON_RIG }, L));
eq([st.includes(col('barbed')), st.includes(col('valorite'))], [true, true], 'studded tunic draws barbed leather and valorite studs separately');
eq(RIG.frameOps(Object.assign({ gear: R, dir: 3, action: 'slash1h', frame: 4, weaponRig: GEAR.WEAPON_RIG }, L)), RIG.frameOps(Object.assign({ gear: R, dir: 3, action: 'slash1h', frame: 4, weaponRig: GEAR.WEAPON_RIG }, L)), 'frames are deterministic (safe to cache)');
eq(RIG.toSVG('E 1 2 3 4 #ffffff;').startsWith('<svg'), true, 'draw lists convert to SVG for previews');

console.log('\nart still missing for:', GEAR.missingArt().join(', '));
console.log(fails ? `\n${fails} FAILED` : '\nall gear tests passed'); process.exit(fails ? 1 : 0);
