// Shared helpers for the Anniabreen scenarios: a walker that drives the real joystick input through update(),
// so the measured times and any collisions are what a player at full stick gets (no sprint).
const S = window.__SF, P = S.P, SF = S.SF, AO = 640; const out = {};
const lcg = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
S.setRng(lcg(7));
for (const e of S.ents.slice()) if (e.kind === 'mon') { e.gone = true; S.ents.splice(S.ents.indexOf(e), 1); }
for (const sp of S.SPAWNS) sp.next = 1e12;
const L = (x, y) => [x + AO, y];
const road = (pts, o) => pts.map(([x, y]) => [x + AO + (o === undefined ? 1.5 : o), y + (o === undefined ? 1.5 : o)]);
const step = sec => { for (let i = 0; i < Math.round(sec / .05); i++) S.update(.05); };
function tp(x, y) { P.x = x; P.y = y; S.JOY.on = false; S.update(.01); }
/* walk a list of global waypoints; returns seconds of game time, or where it got stuck */
function walk(pts, opt) {
  opt = opt || {}; let t = 0, i = 0, still = 0, lx = P.x, ly = P.y, path = 0; const dt = 1 / 20, maxT = opt.maxT || 300;
  while (i < pts.length) {
    const [tx, ty] = pts[i], dx = tx - P.x, dy = ty - P.y, d = Math.hypot(dx, dy);
    if (d < (i === pts.length - 1 ? (opt.reach || .45) : 1.1)) { i++; continue; }
    const ux = dx / d, uy = dy / d, jx = (ux - uy) * 16, jy = (ux + uy) * 8, m = Math.hypot(jx, jy);
    S.JOY.on = true; S.JOY.x0 = 400; S.JOY.y0 = 300; S.JOY.x = 400 + jx / m * 60; S.JOY.y = 300 + jy / m * 60;
    const bx = P.x, by = P.y; S.update(dt); t += dt; path += Math.hypot(P.x - bx, P.y - by); P.hp = SF.maxHp(P); P.stam = SF.maxStam(P);
    if (Math.hypot(P.x - lx, P.y - ly) > .6) { lx = P.x; ly = P.y; still = 0; } else if ((still += dt) > 2.5) { S.JOY.on = false; return { ok: false, t: +t.toFixed(1), stuck: [+(P.x - AO).toFixed(1), +P.y.toFixed(1)], wp: i }; }
    if (t > maxT) { S.JOY.on = false; return { ok: false, t, timeout: true }; }
  }
  S.JOY.on = false; S.update(dt); return { ok: true, t: +t.toFixed(1), tiles: Math.round(path) };
}
const npcNamed = n => S.ents.find(e => e.kind === 'npc' && e.name.startsWith(n));
function talkTo(n) { const e = npcNamed(n); if (!e) return 'no npc ' + n; P.sel = e; S.interact(); return e; }
const nearGate = id => S.ANN.gates.find(g => g.id === id);
const pos = () => [+(P.x - AO).toFixed(1), +P.y.toFixed(1)];
const posG = () => [+P.x.toFixed(1), +P.y.toFixed(1)];
