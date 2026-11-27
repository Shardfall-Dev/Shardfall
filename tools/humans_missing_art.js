// Writes assets/humans/missing-art.json: every painted sheet and layer the classic humans v2 renderer needs before the procedural
// rig can be retired. usage: node tools/humans_missing_art.js Shardfall_v0.30.html
const fs = require('fs'); const html = fs.readFileSync(process.argv[2], 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]); const g = {}, m = { exports: {} };
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.METALS')))(m, g); g.SF = m.exports;
for (const k of ['SF.MAGERY = MG', 'SF.EQ = EQ', 'SF.LOOK = LOOK', 'root.SFRIG = RIG']) new Function('module', 'globalThis', scripts.find(t => t.includes(k)))({}, g);
const L = g.SF.LOOK, R = g.SFRIG, A = R.ANIMATIONS;
// what the separate painted pack v1 (not in this repository) is documented to contain: 8-direction idle; walk and cast in 2 directions
const painted = { idle: { dirs: R.DIRECTIONS, frames: 1, note: 'one frame per direction, no breathing cycle; pack not in the repository' }, walk: { dirs: ['S', 'E'], frames: null }, cast1h: { dirs: ['S', 'E'], frames: null } };
const sheets = Object.keys(A).map(a => ({ id: a, frames: A[a], looped: R.LOOPED.includes(a), directions: 8, bodies: L.BODIES, totalFrames: A[a] * 16,
  painted: painted[a] ? `partial: ${painted[a].dirs.length} of 8 directions` + (painted[a].note ? ' (' + painted[a].note + ')' : '') : 'none' }));
const layers = {
  hair: L.HAIRSTYLES.filter(h => h !== 'bald'), facialHair: L.BEARDS.filter(b => b !== 'none'),
  armorFamilies: ['leather', 'studded', 'bone', 'ringmail', 'chain', 'plate', 'dragon'], armorRegions: ['torso', 'arms', 'legs', 'hands', 'neck'],
  garments: ['shirt/tunic', 'trousers', 'robe', 'cloak', 'tabard', 'apron', 'vest', 'hood', 'coat'],
  helmets: ['cap', 'leathercap', 'bonehelm', 'coif', 'openhelm', 'closedhelm', 'greathelm'], shields: ['buckler', 'round', 'kite', 'heater'],
  weapons: [...new Set(Object.values(L.WEAPON_ANIM).map(a => a.geom))].filter(g2 => g2 !== 'fist'), tools: ['pickaxe', 'hatchet', 'fishingpole', 'smithhammer'],
  futureWeapons: L.FUTURE_GEOMS };
const out = { version: '1.0.0', renderer: 'classic humans v2 (src/humans.js)', rig: R.VERSION, status: 'No painted frames are integrated. Every human is drawn by the procedural rig behind the feature flag.',
  cell: Object.assign({}, R.CELL, { note: 'rig cell; a painted atlas may use its own cell if it records its anchor' }), order: { directions: R.DIRECTIONS, atlas: 'columns = frames, rows = directions S..SE; one atlas per body' },
  sheets, totalFramesPerLayerSet: sheets.reduce((a, s) => a + s.totalFrames, 0), layers, tint: 'armor and shields are tinted by material colour (SF.EQ.matColor); cloth by the appearance clothing colour — paint them in neutral greys' };
fs.writeFileSync('assets/humans/missing-art.json', JSON.stringify(out, null, 1) + '\n'); console.log('wrote assets/humans/missing-art.json:', sheets.length, 'animations,', out.totalFramesPerLayerSet, 'frames per layer set');
