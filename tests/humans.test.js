// usage: node tests/humans.test.js Shardfall_v0.32.html — the layered human compositor (SF.HUMANART) and the painted art registry, no browser.
// Uses the real painted manifest plus SYNTHETIC test overlays (flat coloured shapes with tint masks) to prove the contract:
// independent pieces, per-piece materials, shared anchor/frame, per-direction order, occlusion, two-handed rules. The synthetic
// overlays exist only inside this test; they are not art and are never registered in the game.
const fs = require('fs'); const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.32.html', 'utf8');
const sc = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const g = {}, m = { exports: {} }; new Function('module', 'globalThis', sc.find(t => t.includes('SF.METALS')))(m, g); g.SF = m.exports;
for (const k of ['SF.MAGERY = MG', 'SF.EQ = EQ', 'SF.WARDROBE = W', '.RIG = RIG', 'SF.HUMANART = C', 'SF.HUMAN_ART_DATA =']) new Function('module', 'globalThis', sc.find(t => t.includes(k)))({}, g);
const SF = g.SF, C = SF.HUMANART, ART = SF.HUMAN_ART_DATA, EQ = SF.EQ, W = SF.WARDROBE;
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a).slice(0, 500), '!=', JSON.stringify(b).slice(0, 300)); } else console.log('ok  ', msg); };

// ---- the painted registry: exactly what was delivered, nothing more
const reg = C.fromManifest(ART);
eq(C.validate(reg), [], 'contract and painted registry validate (layers cover EQ.RENDER_LAYERS and every slot; entries fit the shared canvas)');
eq(reg.all.length, 24, '24 painted body entries: idle × 8 directions × 2 bodies, walk and cast × SE/SW × 2 bodies');
for (const b of C.BODIES) { eq(reg.actions(b, 'S'), ['idle'], b + ' S: idle only'); eq(reg.actions(b, 'SE').sort(), ['cast', 'idle', 'walk'], b + ' SE: idle, walk, cast'); }
eq(ART.missing['walk/cast directions'].length, 24, 'the manifest lists the 24 missing walk/cast direction rows');
eq(ART.atlases.idle.normalised.toHeight, 63, 'idle figures normalised to the walk height (one standing scale)');
eq(ART.provenance['Shardfall_Classic_Humans_v1.zip'], '4de842ab6768200dad349415fda8718bbdbf78a754cd4b599923c60d89b39711', 'provenance hash recorded');

// ---- actions and approved fallbacks (never a procedural frame)
eq(C.resolveAction(reg, 'male', 'walk', 'SE'), { action: 'walk', via: null }, 'painted walk SE');
eq(C.resolveAction(reg, 'female', 'walk', 'N'), { action: 'idle', via: 'bob', wanted: 'walk' }, 'walk N → painted idle with the step bob');
eq(C.resolveAction(reg, 'male', 'cast1h', 'SW'), { action: 'cast', via: null }, 'cast1h uses the painted cast (SW)');
eq(C.resolveAction(reg, 'male', 'slash1h', 'E'), { action: 'idle', via: 'lunge', wanted: 'slash1h' }, 'attacks → painted idle with the lunge nudge');
eq(C.resolveAction(reg, 'male', 'death', 'S'), null, 'death has no painted art and no fallback (the old corpse drawing is kept)');

// ---- direction order: cloak behind when facing the viewer, in front from behind; weapon hand near/far
eq([C.layerOf('cloak', 'S'), C.layerOf('cloak', 'N'), C.layerOf('weapon', 'SE'), C.layerOf('weapon', 'SW'), C.layerOf('shield', 'SW'), C.layerOf('weapon', 'N')], ['cloak_back', 'cloak_front', 'main', 'main_far', 'off', 'main_far'], 'per-direction cloak and hand depth');
const o = C.order('N'); eq(o.indexOf('cloak_front') > o.indexOf('torso') && o.indexOf('main_far') < o.indexOf('body'), true, 'from behind: cloak over the back, weapon behind the body');

// ---- synthetic overlays: one flat grey shape per piece, with a full primary mask (R=255). Each piece covers its own rows.
const IMG = { width: 64, data: new Uint8ClampedArray(64 * 64 * 4) }, MASK = { width: 64, data: new Uint8ClampedArray(64 * 64 * 4) };
const shape = (x0, y0, w, h, prim) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = (y * 64 + x) * 4; IMG.data.set([128, 128, 128, 255], i); MASK.data.set([prim ? 255 : 0, 0, 0, 255], i); } };
// a 16×32 synthetic body at (0,0) with anchor (8,30); pieces at other atlas spots, all with the same anchor
shape(0, 0, 16, 32, false);
const piece = (layer, key, ax) => { const x = 16 * (1 + reg.all.filter(e => e.atlas === 'test').length % 3), y = 32 * Math.floor((1 + reg.all.filter(e => e.atlas === 'test').length) / 4); return { layer, key, x, y }; };
const T = C.newRegistry();
const add = (layer, key, x, y, rows) => { shape(x, y + rows[0], 16, rows[1] - rows[0], true); for (const b of C.BODIES) for (const d of C.DIRECTIONS) T.add({ layer, key, body: b, action: 'idle', dir: d, atlas: 'test', x, y, w: 16, h: 32, ax: 8, ay: 30, frames: 1, mask: { atlas: 'test', x, y } }); };
for (const b of C.BODIES) for (const d of C.DIRECTIONS) T.add({ layer: 'body', key: 'body', body: b, action: 'idle', dir: d, atlas: 'test', x: 0, y: 0, w: 16, h: 32, ax: 8, ay: 30, frames: 1, baked: [] });
add('head', 'plate_helm', 16, 0, [0, 6]); add('torso', 'plate_chest', 32, 0, [8, 16]); add('hands', 'leather_gloves', 48, 0, [16, 19]); add('legs', 'chain_leggings', 0, 32, [20, 28]);
add('hair_front', 'hair:short', 16, 32, [0, 5]); add('off', 'heater_shield', 32, 32, [10, 14]); add('main', 'glaive', 48, 32, [2, 30]);
eq(C.validate(T), [], 'synthetic test registry validates against real item ids');
const pc = { id: 'x' }; const P0 = { kind: 'player', name: 'T', look: { body: 'male', skin: 'fair', hair: 'brown', style: 'short', beard: 'none' }, equip: {} }; for (const s of EQ.SLOT_IDS) P0.equip[s] = null;
P0.equip.chest = EQ.make('plate_chest', { material: 'valorite' }); P0.equip.hands = EQ.make('leather_gloves', { material: 'regular' }); P0.equip.legs = EQ.make('chain_leggings', { material: 'iron' }); P0.equip.head = EQ.make('plate_helm', { material: 'mithril' });
let D = W.resolve(P0, {});
let P = C.plan(T, D, 'idle', 'S');
eq(P.layers.map(l => l.key), ['body', 'chain_leggings', 'plate_chest', 'leather_gloves', 'plate_helm'], 'valorite plate chest + leather gloves + iron chain leggings + mithril helm: four independent layers in body order');
eq(P.layers.map(l => l.tint && l.tint.p), [null, EQ.matColor('iron'), EQ.matColor('valorite'), EQ.matColor('regular'), EQ.matColor('mithril')], 'each piece carries its own material colour');
eq([P.hidden.includes('hair_front'), P.layers.some(l => l.layer.startsWith('hair'))], [true, false], 'the plate helm hides the hair layer');
const px = (buf, y) => { const i = ((C.CANVAS.anchorY - 30 + y) * C.CANVAS.width + C.CANVAS.anchorX - 8 + 4) * 4; return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]; };
const ramp = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => Math.round(Math.min(255, v * (128 * .3 + 128 * .59 + 128 * .11) / 255 * 2))); };
const F = C.composeFrame(P, 0, { test: IMG }, { test: MASK });
const close = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 2);
eq([close(px(F, 10).slice(0, 3), ramp(EQ.matColor('valorite'))), close(px(F, 17).slice(0, 3), ramp(EQ.matColor('regular'))), close(px(F, 24).slice(0, 3), ramp(EQ.matColor('iron'))), close(px(F, 2).slice(0, 3), ramp(EQ.matColor('mithril')))], [true, true, true, true], 'pixels: chest valorite, gloves leather, legs iron, helm mithril — tinted by mask, not a whole-body recolour');
eq(px(F, 30).slice(0, 3), [128, 128, 128], 'the untinted body shows where no piece covers it');
eq(px(F, 10)[3], 255, 'all layers share one anchor: the chest lands on the body rows it was drawn for');
P0.equip.chest.material = 'iron'; D = W.resolve(P0, {}); const P2 = C.plan(T, D, 'idle', 'S'); eq(P2.key !== P.key && P2.layers.length === P.layers.length, true, 'changing one material changes the composite key, not the layer set');
P0.equip.head = null; D = W.resolve(P0, {}); eq(C.plan(T, D, 'idle', 'S').layers.some(l => l.key === 'hair:short'), true, 'without a helm the hair layer returns');
P0.equip.weapon = SF.newItem('glaive', 1, {}); P0.equip.shield = EQ.make('heater_shield', { material: 'iron' }); D = W.resolve(P0, {});
eq([C.plan(T, D, 'idle', 'S').layers.some(l => l.key === 'heater_shield'), C.plan(T, D, 'idle', 'S').layers.some(l => l.key === 'glaive')], [false, true], 'a two-handed glaive: shield not drawn');
const PN = C.plan(T, D, 'idle', 'N'); eq(PN.layers.findIndex(l => l.key === 'glaive') < PN.layers.findIndex(l => l.key === 'body'), true, 'facing north the glaive is drawn behind the body');

// ---- with the real (painted) registry: everything not painted is reported, nothing faked
const guard = W.resolve({ kind: 'npc', actorId: 'npc:vespar-watch', role: 'guard', town: 'vespar' }, {});
const PG = C.plan(reg, guard, 'walk', 'SE');
eq([PG.drawn, PG.layers.length, PG.missing.length >= 8], ['walk', 1, true], 'a Vespar guard in painted mode: painted body only; every armour piece reported missing');
eq(PG.missing.some(x => x.startsWith('chest chain_tunic')) && PG.missing.some(x => x.startsWith('weapon sword')), true, 'missing list names the real pieces');
const plain = W.resolve({ kind: 'player', name: 'X', look: { body: 'female' }, equip: { shirt: EQ.make('shirt'), trousers: EQ.make('trousers'), feet: EQ.make('boots', { material: 'regular' }) } }, {});
eq(C.plan(reg, plain, 'idle', 'S').missing, [], 'plain undyed clothes are covered by the painted body (nothing reported missing)');
eq(C.plan(reg, plain, 'idle', 'S').layers[0].entry.body, 'female', 'female body from look.body');

console.log(fails ? `${fails} FAILED` : 'all human compositor tests passed'); process.exit(fails ? 1 : 0);
