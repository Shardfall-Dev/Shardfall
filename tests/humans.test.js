// usage: node tests/humans.test.js Shardfall_v0.30.html — classic humans v2: appearance (SF.LOOK) and the rig (SFRIG), no browser
const fs = require('fs'); const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.30.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const g = {}; const m = { exports: {} };
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.METALS')))(m, g); g.SF = m.exports;
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.MAGERY = MG')))({}, g);
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.EQ = EQ')))({}, g);
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.LOOK = LOOK')))({}, g);
new Function('module', 'globalThis', scripts.find(t => t.includes('root.SFRIG = RIG')))({}, g);
const SF = g.SF, EQ = SF.EQ, L = SF.LOOK, RIG = g.SFRIG;
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', msg); };
const yes = (c, msg, info) => eq(!!c, true, msg + (c ? '' : ' ' + JSON.stringify(info || '')));

// ---- options: the counts the brief asks for
eq([L.BODIES.length, L.HAIRSTYLES.length, Object.keys(L.HAIR).length, Object.keys(L.SKIN).length, Object.keys(L.CLOTH).length, L.BEARDS.length], [2, 8, 7, 5, 12, 5], 'two bodies, 8 hairstyles, 7 hair colours, 5 skin tones, 12 clothing colours, facial hair (none + 4)');

// ---- every weapon in SF.WEAPONS maps to a rig animation family and a drawn geometry; grips follow SF.WEAPONS[id].two
eq(L.unmapped(), [], 'every SF.WEAPONS id has an animation mapping (' + Object.keys(SF.WEAPONS).length + ' weapons)');
for (const id of Object.keys(SF.WEAPONS)) { const a = L.weaponAnim(id); yes(a && RIG.ANIMATIONS[a.family] > 1, `${id} → ${a && a.family} (${a && a.geom}) is a rig animation`); }
eq(Object.keys(SF.WEAPONS).filter(id => SF.WEAPONS[id].two).filter(id => id !== 'pickaxe').every(id => L.twoHandedGeom(L.weaponAnim(id).geom)), true, 'every two-handed weapon draws as a two-handed geometry (hides the shield)');
eq(['sword', 'mace', 'waraxe', 'dagger', 'kryss', 'knife'].some(id => L.twoHandedGeom(L.weaponAnim(id).geom)), false, 'one-handed weapons keep the shield');
const fams = new Set(Object.values(L.WEAPON_ANIM).map(a => a.family));
for (const f of ['unarmed', 'slash1h', 'chop1h', 'chop2h', 'blunt1h', 'blunt2h', 'thrust1h', 'thrust2h', 'polearm', 'bow', 'crossbow', 'hcrossbow']) yes(fams.has(f), 'a current weapon uses the ' + f + ' motion');
for (const f of ['slash2h', 'staff', 'cast1h', 'cast2h', 'caststaff', 'block', 'mine', 'chopwood', 'smith', 'fish', 'hit', 'death', 'corpse', 'run', 'walk', 'idle', 'ready']) yes(RIG.ANIMATIONS[f], 'the rig has the ' + f + ' animation');
eq([L.toolAnim('mining').family, L.toolAnim('lumberjacking').family, L.toolAnim('fishing').family, L.craftAnim('forge').family, L.craftAnim('loom').family], ['mine', 'chopwood', 'fish', 'smith', 'craft'], 'gathering and crafting motions');
eq([L.castGesture({ circle: 1 }), L.castGesture({ circle: 4 }), L.castGesture({ circle: 5 }), L.castGesture({ circle: 2 }, 'staff')], ['cast1h', 'cast1h', 'cast2h', 'caststaff'], 'casting gestures: one hand (circles 1–4), two hands (5–8), staff');
// distinct motions: the weapon hand at the contact frame differs between families
const contact = fam => JSON.stringify(RIG.pose(fam, .6, { weapon: 'sword' }).hands[1].map(x => Math.round(x)));
const sigs = ['unarmed', 'slash1h', 'slash2h', 'chop1h', 'chop2h', 'blunt1h', 'blunt2h', 'thrust1h', 'thrust2h', 'polearm', 'staff', 'bow', 'crossbow', 'hcrossbow'].map(contact);
eq(new Set(sigs).size, sigs.length, 'each weapon family has its own contact pose (' + sigs.length + ' families)');

// ---- the saved appearance: normalize is the one migration path
const old = { cloak: '#8a2a2a' }, n1 = L.normalize(old, 'Aldric'), n2 = L.normalize(old, 'Aldric');
eq(n1, n2, 'an old save (look = { cloak }) gets the same appearance on every load (seeded by the name, never rerolled)');
eq(n1.cloak, '#8a2a2a', 'the legacy cloak colour is kept');
eq(L.check(n1), '', 'the migrated look is valid');
eq(L.normalize(n1, 'Someone else'), n1, 'normalize is idempotent and ignores the seed once a look is complete');
const custom = { body: 'female', skin: 'deep', hair: 'braid', hairColor: 'auburn', beard: 'full', cloth: 'teal', extra: 42 };
const nc = L.normalize(custom, 'x'); eq([nc.body, nc.skin, nc.hair, nc.hairColor, nc.beard, nc.cloth, nc.extra], ['female', 'deep', 'braid', 'auburn', 'none', 'teal', 42], 'valid fields kept, unknown fields kept, a female body has no beard');
eq([L.check({}), L.check(Object.assign({}, n1, { hair: 'mohawk' })), L.check(Object.assign({}, nc, { beard: 'full' }))], ['unknown body', 'unknown hairstyle', 'facial hair is for the male body'], 'check rejects unknown values');
eq(L.random('seed-1'), L.random('seed-1'), 'randomize is deterministic for a seed');
const rs = new Set(); for (let i = 0; i < 40; i++) rs.add(JSON.stringify(L.random('r' + i))); yes(rs.size >= 38, 'randomize gives varied looks', rs.size);

// ---- NPCs: persistent, profession-appropriate, varied
const a1 = L.npcLook({ seed: 'Quay warden|guard#1', name: 'Quay warden', role: 'guard', town: 'quay' }), a2 = L.npcLook({ seed: 'Quay warden|guard#1', name: 'Quay warden', role: 'guard', town: 'quay' });
eq(a1, a2, 'the same NPC seed gives the same look (reload, leaving the area)');
const guards = []; for (let i = 1; i <= 5; i++) guards.push(L.figKey(L.figure(L.npcLook({ seed: 'Quay warden|guard#' + i, name: 'Quay warden', role: 'guard', town: 'quay' }), null)));
eq(new Set(guards).size, 5, 'five identical "Quay warden" guards get five different faces');
const gf = L.figure(a1, null); eq([gf.torso, !!gf.tabard, gf.helm, gf.weapon], ['chain', true, 'openhelm', 'halberd'], 'guards wear chain, a tabard in town colours, a helm and carry a halberd');
eq(L.figure(L.npcLook({ seed: 's', name: 'Harl, smith', role: 'smith' }), null).apron != null, true, 'blacksmiths wear a leather apron');
eq(L.figure(L.npcLook({ seed: 'm', name: 'Magister Orrin', role: 'mage' }), null).torso, 'robe', 'mages wear robes');
eq(L.figure(L.npcLook({ seed: 'h', name: 'Sister Maud, healer', role: 'healer' }), null).torso, 'robe', 'healers wear robes');
eq(L.npcLook({ seed: 'h', name: 'Sister Maud, healer', role: 'healer' }).body, 'female', 'gender comes from the NPC definition (Sister Maud)');
eq(L.npcLook({ seed: 'b', name: 'Brother Lune, healer', role: 'healer' }).body, 'male', '… and Brother Lune');
eq(['bandit', 'smuggler', 'captain'].every(L.isHumanMon) && !['orc', 'lizardman', 'rat', 'boar', 'skeleton', 'lich_lord', 'troll', 'ettin', 'gargoyle', 'harpy'].some(L.isHumanMon), true, 'only human creatures use the human renderer; monsters keep their art');
for (const [role, prof] of [['miner', 'miner'], ['resident', 'fisher'], ['resident', 'woodcutter'], ['provisioner'], ['resident', 'townsfolk'], ['boat'], ['outlaw'], ['trainer'], ['innkeeper'], ['scholar']]) {
  const look = L.npcLook({ seed: role + prof, name: 'X', role, prof }); yes(L.PRESETS[look.preset], `${role}${prof ? '/' + prof : ''} → ${look.preset}`); }

// ---- equipment shows on the figure in material colours; two-handed hides the shield
const ch = { equip: {} }; for (const s of EQ.SLOT_IDS) ch.equip[s] = null;
ch.equip.chest = EQ.make('plate_chest', { material: 'iron' }); ch.equip.head = EQ.make('closed_helm'); ch.equip.legs = EQ.make('chain_leggings'); ch.equip.cloak = EQ.make('cloak'); ch.equip.shield = EQ.make('kite_shield'); ch.equip.weapon = SF.newItem('sword', 1);
let f = L.figure(n1, ch);
eq([f.torso, f.helm, f.legs, !!f.cloak, f.shield, f.weapon], ['plate', 'closedhelm', 'chain', true, 'kite', 'sword'], 'plate chest, closed helm, chain legs, cloak, kite shield and sword all show');
eq(f.torsoCol, EQ.matColor(SF.matOf(ch.equip.chest)), 'armor takes its crafting material colour (EQ.matColor)');
ch.equip.weapon = SF.newItem('glaive', 1); f = L.figure(n1, ch); eq([f.weapon, f.shield], ['halberd', null], 'a two-handed weapon hides the incompatible shield (visual only)');
ch.equip.chest = EQ.make('leather_tunic', { material: 'spined' }); f = L.figure(n1, ch); eq([f.torso, f.torsoCol], ['leather', EQ.HIDES.spined.col], 'spined leather shows in its hide colour');
ch.equip.robe = EQ.make('robe'); f = L.figure(n1, ch); eq(f.robe, L.CLOTH[n1.cloth], 'cloth garments take the character’s clothing colour');
eq(L.figKey(f) === L.figKey(L.figure(n1, ch)), true, 'the figure key is stable for the same look and gear');

// ---- visual animation priority: death > hit/interrupt > attack/cast/tool > ready > move > idle
const st = s => L.state(Object.assign({ now: 10 }, s)).action;
eq(st({ dead: true, deadAt: 9.9, attack: { family: 'slash1h', t0: 9.9, tc: 10 } }), 'death', 'death beats everything');
eq(st({ dead: true, deadAt: 5 }), 'corpse', 'then the corpse');
eq(st({ interruptAt: 9.9, cast: { gesture: 'cast1h', phase: 'prep', t0: 9, t1: 11 } }), 'hit', 'a simulation interruption shows the flinch over the cast');
eq(st({ hitAt: 9.9, attack: { family: 'slash1h', t0: 9.95, tc: 10.1 } }), 'slash1h', 'a hit does not cancel a swing that the simulation did not interrupt');
eq(st({ hitAt: 9.9 }), 'hit', 'a hit with nothing else going on shows the flinch');
eq(st({ attack: { family: 'thrust2h', t0: 9.9, tc: 10.05 }, moving: true }), 'thrust2h', 'attack beats movement');
eq(st({ cast: { gesture: 'cast2h', phase: 'hold' }, moving: true }), 'cast2h', 'cast beats movement');
eq(st({ tool: { family: 'mine' }, ready: true }), 'mine', 'tool beats ready');
eq(st({ ready: true, moving: true, running: true }), 'run', 'running beats ready');
eq(st({ ready: true }), 'ready', 'ready beats idle');
eq(st({}), 'idle', 'idle');
const at = L.state({ now: 10, attack: { family: 'slash1h', t0: 9.88, tc: 10, rec: .4 } }); eq(Math.abs(at.t - L.CONTACT) < 1e-9, true, 'the contact pose lands on the simulation contact time');

// ---- the rig: every frame of every action, both bodies, 8 directions, stays inside its cell; the ground anchor is between the feet
const num = s => [...s.matchAll(/(?:x1|x2|cx)="(-?[\d.]+)"|(?:y1|y2|cy)="(-?[\d.]+)"/g)];
let worst = { x0: 999, x1: -999, y0: 999, y1: -999 }, frames = 0, worstAt = '';
// realistic combinations: each attack with the weapons that use it, tools with their tool, everything else with every carried weapon
const byFam = {}; for (const id in L.WEAPON_ANIM) { const a = L.WEAPON_ANIM[id]; (byFam[a.family] = byFam[a.family] || []).push(a.geom); }
for (const g2 in L.FUTURE_FAMILY) (byFam[L.FUTURE_FAMILY[g2]] = byFam[L.FUTURE_FAMILY[g2]] || []).push(g2);
const TOOLS = { mine: ['pickaxe'], chopwood: ['hatchet'], fish: ['fishingpole'], smith: ['smithhammer'], craft: [null], bandage: [null] };
const ALL = [null].concat(Object.values(L.WEAPON_ANIM).map(a => a.geom), L.FUTURE_GEOMS);
const heavy = L.figure(n1, Object.assign({}, ch, { equip: Object.assign({}, ch.equip, { robe: null, weapon: null }) }));
heavy.shield = 'kite'; heavy.cloak = '#333333';
for (const body of ['male', 'female']) for (const ac of Object.keys(RIG.ANIMATIONS)) for (let d = 0; d < 8; d++) for (const wp of (TOOLS[ac] || byFam[ac] || ALL)) {
  const fig = Object.assign({}, heavy, { body, weapon: wp }); for (let k = 0; k < RIG.ANIMATIONS[ac]; k++) { const s = RIG.frameSVG(fig, { action: ac, frame: k, direction: d }); frames++;
    const pts = [...s.matchAll(/points="([^"]+)"/g)].flatMap(p => p[1].split(' ').map(q => q.split(',').map(Number)));
    for (const m2 of num(s)) { if (m2[1] != null) pts.push([+m2[1], 50]); else pts.push([50, +m2[2]]); }
    for (const [x, y] of pts) { if (x < worst.x0 || x > worst.x1 || y < worst.y0 || y > worst.y1) worstAt = ac + '/' + wp + '/' + d; worst.x0 = Math.min(worst.x0, x); worst.x1 = Math.max(worst.x1, x); worst.y0 = Math.min(worst.y0, y); worst.y1 = Math.max(worst.y1, y); } } }
yes(worst.x0 >= 0 && worst.x1 <= RIG.CELL.width && worst.y0 >= 0 && worst.y1 <= RIG.CELL.height, `${frames} frames (both bodies, 8 directions, every action with its weapons) stay inside the ${RIG.CELL.width}×${RIG.CELL.height} cell`, Object.assign(worst, { worstAt }));
const idle = RIG.pose('idle', 0, {}); const sb = Object.assign({}, heavy, { weapon: 'sword', shield: 'kite' }); eq([Math.round((idle.feet[0][0] + idle.feet[1][0]) / 2), Math.round((idle.feet[0][1] + idle.feet[1][1]) / 2), idle.feet[0][2]], [0, 0, 1], 'the ground anchor sits between the feet');
for (const ac of Object.keys(RIG.ANIMATIONS)) { const n = RIG.ANIMATIONS[ac]; const outs = new Set(); for (let k = 0; k < n; k++) outs.add(RIG.frameSVG(sb, { action: ac, frame: k, direction: 1 })); if (n > 1) yes(outs.size > 1, ac + ': its frames differ (a real animation, not a held pose)'); }
eq(RIG.frameAt('walk', null, 0) !== RIG.frameAt('walk', null, .25), true, 'looped actions advance with time');
eq([RIG.frameAt('slash1h', 0), RIG.frameAt('slash1h', 1)], [0, 7], 'one-shot actions run first to last frame over t');
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
