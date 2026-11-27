// usage: node tests/paperdoll.test.js Shardfall_v0.31.html — Paperdoll v1.0: the appearance descriptor (SF.LOOK), art coverage,
// the layer manifest and the missing-art manifest, with no browser. The compositor itself is checked in tests/paperdoll-smoke.
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.31.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const g = {}, m = { exports: {} };
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.METALS')))(m, g); g.SF = m.exports;
for (const mark of ['SF.MAGERY = MG', 'SF.EQ = EQ', 'SF.STATS = ST', 'SF.CREATION = CR', 'SF.LOOK = L']) new Function('module', 'globalThis', scripts.find(t => t.includes(mark)))({}, g);
const SF = g.SF, EQ = SF.EQ, CR = SF.CREATION, L = SF.LOOK, ROOT = path.join(__dirname, '..');
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', msg); };
const yes = (v, msg) => eq(!!v, true, msg);
const mk = o => { const c = Object.assign({ id: 'p1', name: 'Aldric', str: 100, dex: 50, int: 40, skills: SF.newSkills(), pack: SF.newContainer('pack'), bank: SF.newContainer('bank'), equip: {}, look: CR.defaultLook('male') }, o || {}); for (const s of EQ.SLOT_IDS) if (!(s in c.equip)) c.equip[s] = null; return c; };
const wear = (c, id, o) => { const it = EQ.make(id, o); SF.addItem(c.pack, it); const r = EQ.equipItem(c, { uid: it.uid }); return [r, it]; };
const R = (a, o) => L.resolve(a, o), item = (d, s) => d.items.find(x => x.slot === s);

/* ---------------- coverage: one visual per live wearable and weapon ---------------- */
const W = L.wearables();
eq(W.filter(id => !L.visualOf(id)), [], 'every live wearable item id has a paperdoll visual');
eq(W.length, 73, '73 wearable item ids (58 worn pieces and shields, 15 weapons and tools)');
const wpnIds = Object.keys(SF.WEAPONS).filter(k => k !== 'unarmed');
eq(wpnIds.filter(w => !W.some(id => SF.ITEMS[id].wpn === w)), [], 'every SF.WEAPONS profile (bar unarmed) has a wearable item and so a visual');
eq(W.filter(id => SF.ITEMS[id].legacy), [], 'legacy one-piece suits are not wearable visuals');
eq(new Set(W.map(id => L.visualOf(id).key)).size, W.length, 'visual keys are unique: each item id draws its own picture');
eq(W.filter(id => L.visualOf(id).slot !== SF.ITEMS[id].slot), [], 'every visual sits in its item\'s real slot');
eq(EQ.SLOT_IDS.filter(s => !L.SLOT_LAYER[s]), [], 'all 18 equipment slots map to a paperdoll layer');
for (const b of CR.BODIES) eq(CR.hairFor(b.id).filter(h => h.id !== 'bald' && !L.BODY_PARTS().includes('hair.' + b.id + '.' + h.id)).map(h => h.id), [], b.id + ': every creator hairstyle has a hair layer');
eq(CR.FACIAL.filter(f => f.id !== 'none' && !L.BODY_PARTS().includes('beard.male.' + f.id)).map(f => f.id), [], 'every creator facial hair style has a beard layer');

/* ---------------- the layer manifest (assets/character/paperdoll-v1/manifest.json) ---------------- */
const MF = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/character/paperdoll-v1/manifest.json'), 'utf8'));
eq(MF, JSON.parse(JSON.stringify(L.manifest())), 'the committed layer manifest matches the live registry (node tools/paperdoll_manifest.js)');
eq([MF.canvas.width, MF.canvas.height, MF.canvas.baseline, MF.canvas.format], [384, 512, 496, 'RGBA PNG'], 'canvas contract: 384×512 RGBA, feet at 496');
eq(MF.layers.filter(l => l.item && (!SF.ITEMS[l.item] || SF.ITEMS[l.item].slot !== l.slot)).map(l => l.id), [], 'every item layer names a real item id in its real slot');
eq(['male', 'female'].map(b => MF.anchors[b].foot * MF.canvas.scale), [496, 496], 'both bodies stand on the same baseline');
// a painted layer must be real: an RGBA PNG on the canvas size, one per body it claims
const pngInfo = f => { const b = fs.readFileSync(f); if (b.readUInt32BE(0) !== 0x89504e47 || b.toString('ascii', 12, 16) !== 'IHDR') return null; return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), depth: b[24], colour: b[25] }; };
const painted = MF.layers.filter(l => l.source === 'painted'), proc = MF.layers.filter(l => l.source === 'procedural');
const badPng = []; for (const l of painted) for (const b of l.bodies) { const f = l.files && l.files[b] && path.join(ROOT, l.files[b]); const i = f && fs.existsSync(f) && pngInfo(f);
  if (!i || i.w !== MF.canvas.width || i.h !== MF.canvas.height || i.colour !== 6) badPng.push(l.id + '/' + b); }
eq(badPng, [], `painted layers verified against real RGBA PNGs (${painted.length} painted, ${proc.length} procedural)`);
eq(MF.layers.filter(l => !['procedural', 'painted'].includes(l.source)).map(l => l.id), [], 'every layer is honestly labelled procedural or painted');

/* ---------------- the missing-art manifest (assets/character/missing-character-art.json) ---------------- */
const MA = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/character/missing-character-art.json'), 'utf8'));
const ORIGINAL = ['body_female', 'body_base_unhooded', 'layer_cloak', 'layer_hair', 'layer_facial_hair', 'layer_clothing', 'paperdoll_body'];
eq(ORIGINAL.filter(id => !MA.missing.some(e => e.id === id)), [], 'the seven v0.30 entries are all still listed');
const ids = new Set(MF.layers.map(l => l.id));
eq(MA.missing.filter(e => e.layers).flatMap(e => e.layers.filter(id => !ids.has(id)).map(id => e.id + ':' + id)), [], 'every paperdoll entry names real manifest layers');
const coveredGear = new Set(MA.missing.filter(e => e.layers).flatMap(e => e.layers));
eq(MF.layers.filter(l => !coveredGear.has(l.id)).map(l => l.id), [], 'every procedural layer is accounted for by a missing-art entry');
// an entry may be marked resolved only when every layer it lists is painted and its PNGs verified above
const resolvedBad = MA.missing.filter(e => (e.done || e.resolved) && (!e.layers || e.layers.some(id => (MF.layers.find(l => l.id === id) || {}).source !== 'painted'))).map(e => e.id);
eq(resolvedBad, [], 'no missing-art entry is marked done without verified painted files');
const open = MA.missing.filter(e => !(e.done || e.resolved));
console.log(`     unresolved missing-art entries (${open.length}): ${open.map(e => e.id + (e.layers ? ` [${e.layers.length}]` : '')).join(', ')}`);

/* ---------------- the descriptor ---------------- */
let c = mk(); let d = R(c);
eq([d.body, d.skin.id, d.hair.style, d.beard.style, d.items.length, d.cloak && d.cloak.source], ['male', 'light', 'short', 'none', 0, 'look'], 'a naked default character: body, skin, hair, no items, the creator cloak');
const snap = JSON.stringify(c); wear(c, 'plate_chest', { material: 'valorite' }); const before = JSON.stringify(c); R(c); R(c, { preview: { weapon: { id: 'sword' } } }); eq(JSON.stringify(c), before, 'resolve() never writes to the actor');
yes(snap !== before, '(the equip itself did change the actor)');
// materials: the same piece in three metals is one drawing in three metals
const metals = ['iron', 'valorite', 'mithril'].map(mt => { const a = mk(); wear(a, 'plate_chest', { material: mt }); return item(R(a), 'chest'); });
eq(metals.map(x => x.visual), ['eq.plate_chest', 'eq.plate_chest', 'eq.plate_chest'], 'iron, valorite and mithril plate share the plate chest drawing');
eq(metals.map(x => x.matHex), ['iron', 'valorite', 'mithril'].map(EQ.matColor), '…and carry their own metal colours from EQ.matColor');
eq(new Set(['iron', 'dull_copper', 'shadow_iron', 'copper', 'bronze', 'golden', 'agapite', 'verite', 'valorite', 'mithril'].map(mt => L.rampFor(mt).join())).size, 10, 'all ten metals have distinct ramps');
eq(new Set(Object.keys(EQ.HIDES).map(h => L.rampFor(h).join())).size, Object.keys(EQ.HIDES).length, 'every hide has a distinct ramp');
eq(new Set(Object.keys(SF.WOOD).map(w => L.rampFor(w).join())).size, Object.keys(SF.WOOD).length, 'every wood has a distinct ramp');
eq([L.rampFor('iron').length, L.rampFor('regular').length, L.rampFor('pine').length], [7, 6, 6], 'metal ramps carry a specular step; hide and wood stay matte');
// studded leather: hide and studs tint independently
const st = (hide, sec) => { const a = mk(); wear(a, 'studded_tunic', { material: hide, sec }); return R(a); };
const s1 = st('spined', 'iron'), s2 = st('spined', 'golden'), s3 = st('horned', 'golden');
eq([item(s1, 'chest').matHex === item(s2, 'chest').matHex, item(s1, 'chest').secHex === item(s2, 'chest').secHex, s1.key === s2.key], [true, false, false], 'changing only the studs changes the stud colour and the key, not the leather');
eq([item(s2, 'chest').secHex === item(s3, 'chest').secHex, item(s2, 'chest').matHex === item(s3, 'chest').matHex], [true, false], 'changing only the hide changes the leather, not the studs');
eq(item(R((() => { const a = mk(); wear(a, 'leather_tunic', { material: 'barbed' }); return a; })()), 'chest').sec, null, 'plain leather has no stud channel');
// woods
const bow = (w) => { const a = mk(); a.equip.weapon = SF.newItem('shortbow', 1, w ? { material: w } : null); return item(R(a), 'weapon'); };
eq([bow().mat, bow('yew').mat, bow('frostwood').matKind], ['pine', 'yew', 'wood'], 'bows draw their limbs in their own wood (pine when the item has none)');
const sh = (id, o) => { const a = mk({ str: 100 }); wear(a, id, o); return item(R(a), 'shield'); };
eq([sh('wooden_shield', { material: 'oak' }).matKind, sh('wooden_shield', { material: 'heartwood' }).mat, sh('heater_shield', { material: 'verite' }).matKind, sh('buckler').mat], ['wood', 'heartwood', 'metal', 'pine'], 'shields: wood bodies in their wood, metal shields in their metal, the pine buckler in pine');
yes(L.visualOf('wooden_shield').fixed.includes('metal') && L.visualOf('sword').fixed.join() === 'wood,leather' && L.visualOf('shortbow').fixed.join() === 'string,leather', 'fixed channels: iron fittings on wood shields, haft and grip on metal weapons, string and grip on bows');
// two-handed: a stale save holding both never shows the shield
c = mk(); c.equip.weapon = SF.newItem('glaive', 1); c.equip.shield = EQ.make('kite_shield'); d = R(c);
eq([item(d, 'shield').hidden, d.hide.offhand, item(d, 'weapon').two], [true, true, true], 'a two-handed weapon hides the off hand (visual only; slots untouched)');
yes(c.equip.shield, '…and the shield stays in its slot');
c = mk({ str: 100 }); wear(c, 'sword'); const [rs] = wear(c, 'heater_shield'); d = R(c); eq([rs.ok, item(d, 'shield').hidden], [true, false], 'a one-handed sword shows its shield');
// helmets and hair
const hd = id => { const a = mk({ str: 100, look: Object.assign(CR.defaultLook('male'), { hairStyle: 'long', facialHairStyle: 'long' }) }); wear(a, id); return R(a).hide; };
eq([hd('great_helm'), hd('open_helm'), hd('chain_coif'), hd('cloth_cap')], [{ hair: 'all', beard: 'none', offhand: false }, { hair: 'top', beard: 'all', offhand: false }, { hair: 'all', beard: 'mustache', offhand: false }, { hair: 'top', beard: 'all', offhand: false }], 'helmets hide hair and beards by their design (closed face, open face, coif, cap)');
eq(['closed_helm', 'plate_helm', 'great_helm', 'bone_helm', 'dragon_helm'].map(id => L.OCCLUDE[id].beard), ['none', 'none', 'none', 'none', 'none'], 'every full helm hides the beard');
eq(SF.EQ.DEFS.filter(x => x.slot === 'head' && !L.OCCLUDE[x.id]).map(x => x.id), [], 'every helmet has an occlusion rule');
// female characters never show a beard, even from an old or forged look
eq(R(mk({ look: Object.assign(CR.defaultLook('female'), { facialHairStyle: 'long' }) })).beard.style, 'none', 'a female look never resolves a beard');
// the key: visual fields only
const twin = () => { const a = mk(); wear(a, 'chain_tunic', { material: 'bronze' }); return R(a).key; };
eq(twin(), twin(), 'two different items (different UIDs) with the same id and material give the same key');
c = mk(); const [, ch] = wear(c, 'chain_tunic'); const k0 = R(c).key; ch.cond = 0; eq(R(c).key !== k0, true, 'a piece breaking changes the key (cracks are drawn)');
yes(!R(c).key.includes(String(ch.uid) + ':') && !/\buid\b/.test(R(c).key), 'the key never carries an item UID');
c = mk(); const k1 = R(c).key; c.look.hairColor = 'red'; eq(R(c).key !== k1, true, 'a look change changes the key');
eq(R(c).rev, L.REV, 'the art revision is part of every descriptor');
// equipping and removing: the key changes exactly with successful commands
c = mk({ str: 10 }); let k = R(c).key; const [bad] = wear(c, 'plate_chest'); eq([bad.ok, R(c).key === k], [false, true], 'a refused equip (too weak) leaves the look unchanged');
c = mk({ str: 100 }); k = R(c).key; wear(c, 'plate_chest'); const k2 = R(c).key; yes(k2 !== k, 'a successful equip changes the look at once');
EQ.unequipItem(c, { slot: 'chest' }); eq(R(c).key, k, 'removing it restores the previous look exactly');
// ghost and corpse
c = mk(); wear(c, 'plate_chest'); c.equip.tunic = SF.newItem('garment', 1); c.ghost = true; d = R(c);
eq([d.ghost, d.items.filter(x => !x.hidden).map(x => x.id), d.cloak], [true, ['garment'], null], 'a ghost shows only the death robe, no cloak');
eq(R(c, { corpse: true }).items.filter(x => !x.hidden).length, 2, 'a corpse snapshot keeps the worn look (resolved with corpse:true)');
// unknown items: listed, never drawn as something else
c = mk(); SF.ITEMS.__test_hat = { id: '__test_hat', n: 'Test hat', slot: 'head', cat: 'armor' }; c.equip.head = { id: '__test_hat' };
SF.ITEMS.__test_hat.legacy = true; d = R(c); eq([d.missing, d.items.length], [[{ slot: 'head', id: '__test_hat' }], 0], 'an item with no visual is reported missing and not drawn');
yes(d.key.endsWith('head:__test_hat'), '…and it is part of the key'); delete SF.ITEMS.__test_hat;
// one record for every renderer and the network
c = mk({ str: 100, look: Object.assign(CR.defaultLook('male'), { facialHairStyle: 'vandyke', hairColor: 'blond', skinTone: 'olive', cloak: 'crimson' }) });
wear(c, 'studded_tunic', { material: 'horned', sec: 'valorite' }); wear(c, 'norse_helm', { material: 'agapite' }); wear(c, 'wooden_shield', { material: 'yew' }); wear(c, 'sword', { material: 'verite' });
const w = JSON.parse(JSON.stringify(L.wire(c))); eq(R(L.fromWire(w)).key, R(c).key, 'wire() → JSON → fromWire() resolves to the identical descriptor');
yes(JSON.stringify(w).length < 400, `the wire form is compact (${JSON.stringify(w).length} bytes)`);
eq(L.worldLook(R(c)), { body: 'male', skinTone: 'olive', cloak: 'crimson' }, 'the world sprite takes skin and cloak from the same descriptor');
wear(c, 'cloak'); eq(L.worldLook(R(c)).cloak, EQ.matColor('cloth'), 'a worn cloak item recolours the world cloak');
const n1 = L.npcLook('guard-7', '#5a5a62'), n2 = L.npcLook('guard-7', '#5a5a62');
eq([JSON.stringify(n1) === JSON.stringify(n2), n1.cloak, CR.checkLook(Object.assign({}, n1, { cloak: 'teal' }))], [true, '#5a5a62', []], 'NPC looks are stable per seed, keep the role colour and use creator ids');
eq(R({ look: n1, equip: {} }).cloak.hex, '#5a5a62', 'an NPC resolves through the same descriptor');
eq(L.forNpc({ id: 'bandit-2', roleHex: '#3a2a22', equip: { weapon: { id: 'dagger' } } }).items.map(x => x.id), ['dagger'], 'an NPC with real equipment resolves that equipment');
// combat, crafting, inventory untouched: the descriptor is the only new state and is never saved
yes(!('appearance' in mk()) && !scripts.find(t => t.includes('SF.LOOK = L')).includes('localStorage'), 'SF.LOOK keeps no state and writes no save');

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
