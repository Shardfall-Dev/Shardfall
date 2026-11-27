// usage: node tools/paperdoll_manifest.js Shardfall_v0.31.html [--check]
// Writes assets/character/paperdoll-v1/manifest.json from SF.LOOK.manifest() (the live item registry), or with --check
// exits 1 if the committed file is out of date. The manifest is the contract painted layers must meet (canvas, anchors, ids).
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.31.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const g = {}, m = { exports: {} };
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.METALS')))(m, g); g.SF = m.exports;
for (const mark of ['SF.MAGERY = MG', 'SF.EQ = EQ', 'SF.STATS = ST', 'SF.CREATION = CR', 'SF.LOOK = L']) new Function('module', 'globalThis', scripts.find(t => t.includes(mark)))({}, g);
const out = path.join(__dirname, '..', 'assets', 'character', 'paperdoll-v1', 'manifest.json');
const text = JSON.stringify(g.SF.LOOK.manifest(), null, 1) + '\n';
if (process.argv.includes('--check')) { const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : ''; if (cur !== text) { console.log('paperdoll manifest is out of date: run node tools/paperdoll_manifest.js'); process.exit(1); } console.log('paperdoll manifest up to date'); }
else { fs.writeFileSync(out, text); console.log('wrote', out, g.SF.LOOK.manifest().layers.length, 'layers'); }
