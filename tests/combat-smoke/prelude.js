// shared setup for the combat scenarios: an open spot, no wild creatures, deterministic helpers
const S = window.__SF, P = S.P, SF = S.SF; const out = {};
const step = (sec) => { for (let i = 0; i < Math.round(sec / .05); i++) S.update(.05); };
const lcg = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };   // mulberry32
const key = (k, down) => document.body.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k, bubbles: true }));
let spot = null; for (let k = 0; k < 2000 && !spot; k++) { const x = 120 + (k % 40) * 4, y = 230 + Math.floor(k / 40) * 2; let ok = true; for (let dx = -6; dx <= 6 && ok; dx++) for (let dy = -6; dy <= 6; dy++) if (S.BLK[S.tAt(x + dx, y + dy)] || S.tAt(x + dx, y + dy) === S.T.WA || S.protAt(x + dx, y + dy)) { ok = false; break; } if (ok) spot = [x, y]; }
if (!spot) throw new Error('no open wilderness spot for the combat scenarios'); P.x = spot[0] + .5; P.y = spot[1] + .5; out.spot = spot;
for (const e of S.ents.slice()) if (e.kind === 'mon') { e.gone = true; S.ents.splice(S.ents.indexOf(e), 1); }
for (const sp of S.SPAWNS || []) sp.next = 1e9;
let nid = 91000; const add = (type, dx, dy, hp) => { const d = S.MON[type]; const e = { kind: 'mon', type, name: d.n, x: P.x + dx, y: P.y + dy, hp: hp || d.hp, max: hp || d.hp, state: 'idle', home: { x: P.x + dx, y: P.y + dy }, sect: 0, ward: 0, id: nid++, speed: 0 }; S.ents.push(e); return e; };
const give = (id, n, extra) => { const it = SF.newItem(id, n || 1, extra || (SF.ITEMS[id].stack ? null : { cond: 100, maxc: 100, omax: 100 })); SF.addItem(P.pack, it); return it; };
const equip = id => { if (id === 'fists') { if (P.equip.weapon) S.ACT.uneq({ s: 'weapon' }); return; } const it = give(id); S.ACT.equip({ u: it.uid }); return it; };
const wren = S.allyOf(); const near = (a, b, e) => Math.abs(a - b) <= (e || .051);
P.base.str = P.str = 100; P.base.dex = P.dex = 100; P.stam = 100; P.base = { str: 100, dex: 100, int: P.int }; P.hp = SF.maxHp(P);
