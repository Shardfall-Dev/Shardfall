// usage: node tests/wardrobe.test.js Shardfall_v0.31.html — the NPC wardrobe (SF.WARDROBE) and the human rig (SF.RIG) with no browser.
// Data validation, determinism, real-equipment fidelity, two-handed rules, cosmetic isolation and rig coverage.
const fs = require('fs'); const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.31.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const load = () => { const g = {}; const m = { exports: {} };
  new Function('module', 'globalThis', scripts.find(t => t.includes('SF.METALS')))(m, g); g.SF = m.exports;
  new Function('module', 'globalThis', scripts.find(t => t.includes('SF.MAGERY = MG')))({}, g);
  new Function('module', 'globalThis', scripts.find(t => t.includes('SF.EQ = EQ')))({}, g);
  new Function('module', 'globalThis', scripts.find(t => t.includes('SF.WARDROBE = W')))({}, g);
  new Function('module', 'globalThis', scripts.find(t => t.includes('.RIG = RIG')))({}, g); return g.SF; };
const SF = load(), W = SF.WARDROBE, R = SF.RIG, EQ = SF.EQ;
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a).slice(0, 400), '!=', JSON.stringify(b).slice(0, 400)); } else console.log('ok  ', msg); };

// ---- data
eq(W.validate(), [], 'wardrobe data validates: real item ids, material ids, dyes, slots, regions, roles, two-handed rules');
const src = scripts.find(t => t.includes('SF.WARDROBE = W')) + scripts.find(t => t.includes('.RIG = RIG'));
eq(/Math\.random\s*\(/.test(src), false, 'no Math.random anywhere in the wardrobe or the rig');
eq(Object.keys(W.REGIONS).sort(), ['moonglen', 'mynoc', 'saltmarsh', 'skara', 'vespar'], 'five regional factions');

// ---- the live roster (from the v0.31 build; tests/wardrobe-smoke re-checks against the running game)
const NPCS = JSON.parse(fs.readFileSync(__dirname + '/wardrobe-smoke/live-npcs.json', 'utf8'));
const res = NPCS.map(a => [a, W.resolve(a, { zone: a.zone, rosterIndex: a.rosterIndex || 0 })]);
eq(res.filter(([, D]) => !D).map(([a]) => a.actorId), [], 'every live human NPC resolves');
eq(res.filter(([, D]) => D.fallback).map(([a]) => a.actorId), [], 'no live NPC falls back to the generic villager');
eq(W.fallbackLog, [], 'nothing was logged as an unknown role');
const guards = res.filter(([a]) => a.role === 'guard');
const byReg = {}; for (const [a, D] of guards) (byReg[D.region] = byReg[D.region] || []).push(D);
eq(Object.keys(byReg).sort(), ['moonglen', 'mynoc', 'saltmarsh', 'skara', 'vespar'], 'every guard has a regional uniform');
for (const r in byReg) { const t = new Set(byReg[r].map(D => (D.pieces.tunic || D.pieces.cloak || D.pieces.head).dye)); eq([t.size, [...t][0]], [1, W.REGIONS[r].p], r + ' guards share one regional colour ' + W.REGIONS[r].p);
  eq(byReg[r].every(D => D.overlays.some(o => o.id === 'heraldry' && o.color === W.REGIONS[r].a)), true, r + ' guards share the heraldic accent'); }
eq(res.filter(([, D]) => D.source === 'cosmetic').length, NPCS.length - 1, 'NPCs without equipment wear cosmetic presets (disclosed as source "cosmetic")');
eq(new Set(res.map(([, D]) => D.body)).size, 2, 'both body types appear in the live population');
eq(res.find(([a]) => a.actorId === 'npc:sister-maud-healer')[1].body, 'female', 'bodies follow existing identities (Sister Maud)');
eq(res.find(([a]) => a.actorId === 'npc:quaywarden-brann')[1].rank, 'captain', 'the Quaywarden is the Saltmarsh captain');

// ---- determinism: same person after a reload (a fresh module) and across many calls
const SF2 = load(); const keys1 = res.map(([, D]) => D.key), keys2 = NPCS.map(a => SF2.WARDROBE.resolve(a, { zone: a.zone, rosterIndex: a.rosterIndex || 0 }).key);
eq(keys1, keys2, 'identical appearance from a freshly loaded module (save/load, travel)');
let same = true; for (let i = 0; i < 50; i++) for (const [a, D] of res.slice(0, 10)) if (W.resolve(a, { zone: a.zone, rosterIndex: a.rosterIndex || 0 }).key !== D.key) same = false;
eq(same, true, '50 repeated resolves give the same key');
const frozen = JSON.stringify(NPCS); NPCS.forEach(a => W.resolve(a, { zone: a.zone })); eq(JSON.stringify(NPCS), frozen, 'resolving never mutates the actor (no equip, no inventory, no stats added)');
const ids = new Set(res.map(([, D]) => D.key)); eq(ids.size > NPCS.length * .8, true, `individual appearances: ${ids.size} distinct looks for ${NPCS.length} people`);

// ---- activity wardrobe
const smith = { kind: 'npc', actorId: 'npc:brega-forgemistress', role: 'smith', town: 'mynoc', name: 'Brega, forgemistress', life: { prof: 'smith', doing: 'work' } };
const atWork = W.resolve(smith, {}), atHall = W.resolve(Object.assign({}, smith, { life: { prof: 'smith', doing: 'social' } }), {});
eq([atWork.state, atWork.prop, atWork.overlays.some(o => o.id === 'apron_long'), !!atWork.pieces.hands], ['work', 'smith_hammer', true, true], 'the smith at the forge: apron, gloves, hammer');
eq([atHall.state, atHall.prop, atHall.overlays.some(o => o.id === 'apron_long'), !!atHall.pieces.hands], ['off', null, false, false], 'the smith at the hall: no apron, no gloves, no hammer');
eq([atWork.body, atWork.skin, atWork.hair, atWork.palette.p], [atHall.body, atHall.skin, atHall.hair, atHall.palette.p], 'the same person and colours on and off duty');
const miner = { kind: 'npc', actorId: 'npc:durn-miner', role: 'resident', town: 'mynoc', name: 'Durn, miner', life: { prof: 'miner', doing: 'gather' } };
eq([W.resolve(miner, {}).prop, W.resolve(Object.assign({}, miner, { life: { prof: 'miner', doing: 'eat' } }), {}).prop], ['pickaxe', null], 'the miner stows the pickaxe at the inn');
const tob = { kind: 'npc', actorId: 'npc:tobin-travelling-merchant', role: 'trader', town: 'mynoc', name: 'Tobin', life: { prof: 'trader', doing: 'walk' } };
eq([!!W.resolve(tob, {}).pieces.cloak, !!W.resolve(Object.assign({}, tob, { life: { prof: 'trader', doing: 'trade' } }), {}).pieces.cloak], [true, false], 'the travelling merchant wears his cloak on the road');

// ---- real equipment: exactly what is worn; two-handed weapons hide the shield; uid is never the visual key
const mk = () => { const c = { kind: 'player', name: 'Tess', look: { body: 'female', skin: 'tan', hair: 'auburn', style: 'braid', beard: 'none' }, equip: {} }; for (const s of EQ.SLOT_IDS) c.equip[s] = null; return c; };
const p = mk(); p.equip.chest = EQ.make('plate_chest', { material: 'valorite' }); p.equip.weapon = SF.newItem('sword', 1, {}); p.equip.shield = EQ.make('heater_shield', { material: 'mithril' });
let D = W.resolve(p, {});
eq([D.source, D.pieces.chest.id, D.pieces.chest.material, D.weapon.id, D.shield && D.shield.material], ['equip', 'plate_chest', 'valorite', 'sword', 'mithril'], 'the player shows the real valorite plate, sword and mithril shield');
eq(Object.keys(D.pieces), ['chest'], 'nothing cosmetic is added to a character with equipment');
p.equip.weapon = SF.newItem('glaive', 1, {}); D = W.resolve(p, {}); eq(D.shield, null, 'a two-handed glaive hides the shield (EQ.twoHanded)');
const k1 = W.resolve(p, {}).key; p.equip.chest.uid = 999999; eq(W.resolve(p, {}).key, k1, 'the item uid is not part of the visual key');
p.equip.chest.material = 'mithril'; eq(W.resolve(p, {}).key !== k1, true, 'changing the material changes the visual key');
const g1 = R.resolveGear({ chest: { id: 'plate_chest', material: 'iron' } }, SF), g2 = R.resolveGear({ chest: { id: 'plate_chest', material: 'valorite' } }, SF);
eq([g1.chest.color, g2.chest.color], [EQ.matColor('iron'), EQ.matColor('valorite')], 'the rig takes live material colours from EQ.matColor');
eq(R.resolveGear({ chest: { id: 'plate_chest', material: 'iron', dye: '#ff0000' } }, SF).chest.color, EQ.matColor('iron'), 'a dye never recolours metal');
eq(R.resolveGear({ tunic: { id: 'tabard', dye: '#284663' } }, SF).tunic.color, '#284663', 'a dye colours cloth');
eq(R.resolveGear({ chest: { id: 'studded_tunic', material: 'regular', sec: 'verite' } }, SF).chest.secColor, EQ.matColor('verite'), 'studs take their own metal');

// ---- rig coverage: every wearable definition and weapon id, every direction, animation and body
const wear = EQ.DEFS.map(d => d.id).concat(['buckler', 'garment']);
eq(wear.filter(id => !R.DEFINITIONS[id]), [], 'every equipment definition (and the buckler and respawn tunic) has a rig layer');
eq(Object.keys(SF.WEAPONS).filter(w => !R.WEAPON_MAP[w]), [], 'every SF.WEAPONS id has a rig weapon shape and attack animation');
let frames = 0, bad = [];
for (const body of ['male', 'female']) for (const dir of R.DIRECTIONS) for (const ac in R.ANIMATIONS) for (let f = 0; f < R.ANIMATIONS[ac]; f += 3) {
  const o = R.fromDescriptor(atWork, { SF, body, direction: dir, action: ac, frame: f }); const s = R.frameSVG(o); frames++; if (!/^<svg [^>]*width="112" height="100"/.test(s) || !s.endsWith('</svg>') || /NaN|undefined/.test(s)) bad.push(body + dir + ac + f); }
eq(bad, [], frames + ' frames: both bodies × 8 directions × 29 animations draw clean SVG');
const helmed = W.resolve({ kind: 'npc', actorId: 'npc:t', role: 'guard', town: 'vespar' }, { rosterIndex: 0 });
eq(helmed.pieces.head.id, 'closed_helm', 'a Vespar sergeant wears the closed helm');
const sv = R.frameSVG(R.fromDescriptor(helmed, { SF, direction: 'S' })), bare = R.frameSVG(R.fromDescriptor(Object.assign({}, helmed, { pieces: Object.assign({}, helmed.pieces, { head: undefined }) }), { SF, direction: 'S' }));
eq(sv.includes(R.HAIR[helmed.hair]) || helmed.style === 'bald', false, 'a closed helm hides the hair');
eq(bare.includes(R.HAIR[helmed.hair]) || helmed.style === 'bald', true, 'without it the hair shows');

// ---- hostile humans
for (const t in W.MOB_ROLE) { const seen = new Set(); for (let i = 0; i < 60; i++) seen.add(W.resolve({ kind: 'mon', type: t, actorId: 'mon:' + t + ':' + i }, {}).variant); eq(seen.size, W.HOSTILE[W.MOB_ROLE[t]].variants.length, t + ': all ' + seen.size + ' garment variants occur'); }
eq(W.resolve({ kind: 'mon', type: 'orc', actorId: 'mon:orc:1' }, {}), null, 'non-human creatures keep their own art (no wardrobe)');
eq(W.resolve({ kind: 'mon', type: 'captain', actorId: 'mon:captain:1' }, {}).skin, 'drowned', 'the drowned captain keeps a drowned skin');

console.log(fails ? `${fails} FAILED` : 'all wardrobe tests passed'); process.exit(fails ? 1 : 0);
