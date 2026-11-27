/* ================= TOWN LIFE (Living World phase 4, v0.27; master spec §7, §14) =================
   Named townsfolk with homes, workplaces and daily routines on the world clock, guards on patrol, a travelling merchant on
   the cart road, and resource workers who gather real ore, wood and fish. The pure parts are in src/world.js (SIM.scheduleAt,
   needs, memory); this file decides where everyone is and walks them there on the phase 2 navigator.
     · Vespar and Mynoc live fully: their shopkeepers keep hours, go home at night, eat and meet at the hall or the yard,
       and new residents (miners, a woodcutter, a fisherwoman, a dockhand, townsfolk) live there with them.
     · Guards in all four Anniabreen towns patrol between doors and the shrine; at night one per town stands watch at its post.
     · Bankers, healers, ferry and boat crews and the Saltmarsh Quay keep their posts around the clock: the services the
       player relies on (bank, resurrection, travel) never close.
   Schedules are preferences: danger sends townsfolk indoors, hunger brings a meal forward, exhaustion an early night.
   NPCs are placed where their schedule says when the world loads, so a reload resumes the day instead of resetting it. */

const LIFE = { npcs: [], towns: {}, stock: {}, fields: {}, trader: null, thinkMs: 0, events: { arrivals: 0, frights: 0, trades: 0, strokes: 0 } };
const LIFE_TOWNS = { vespar: 1, mynoc: 1, skara: 1, moonglen: 1 };   // since v0.28 all four Anniabreen towns live
const LIFE_SHOP_ROLES = { tailor: 1, tinker: 1, provisioner: 1, fishmonger: 1, smith: 1, miner: 1, innkeeper: 1, workshop: 1, fletcher: 1, mage: 1, reagents: 1 };
const LIFE_ROLE_PROF = { smith: 'smith', innkeeper: 'innkeeper', scholar: 'scholar' };   // every other shop role keeps shop hours; scholars keep college hours
/* [from, to, act, place]; places: home, work, hall (eat and meet), market (wander), field (gather), buyer (sell the haul) */
const LIFE_SCHED = {
  shop:       [[22, 5.5, 'sleep', 'home'], [5.5, 6.5, 'home', 'home'], [6.5, 12, 'work', 'work'], [12, 13, 'eat', 'hall'], [13, 18, 'work', 'work'], [18, 20.5, 'social', 'hall'], [20.5, 22, 'home', 'home']],
  smith:      [[22, 5.5, 'sleep', 'home'], [5.5, 6, 'home', 'home'], [6, 12, 'work', 'work'], [12, 13, 'eat', 'hall'], [13, 17.5, 'work', 'work'], [17.5, 20, 'social', 'hall'], [20, 22, 'home', 'home']],   // the spec's blacksmith day
  miner:      [[21, 5, 'sleep', 'home'], [5, 5.5, 'home', 'home'], [5.5, 12, 'gather', 'field'], [12, 13, 'eat', 'hall'], [13, 16.5, 'gather', 'field'], [16.5, 17.5, 'trade', 'buyer'], [17.5, 20, 'social', 'hall'], [20, 21, 'home', 'home']],
  fisher:     [[21, 4.5, 'sleep', 'home'], [4.5, 5, 'home', 'home'], [5, 11, 'gather', 'field'], [11, 12, 'trade', 'buyer'], [12, 13, 'eat', 'hall'], [13, 16, 'gather', 'field'], [16, 17, 'trade', 'buyer'], [17, 20, 'social', 'hall'], [20, 21, 'home', 'home']],
  dockhand:   [[22, 6, 'sleep', 'home'], [6, 7, 'home', 'home'], [7, 12, 'work', 'work'], [12, 13, 'eat', 'hall'], [13, 17, 'work', 'work'], [17, 20, 'social', 'hall'], [20, 22, 'home', 'home']],
  townsfolk:  [[22, 6.5, 'sleep', 'home'], [6.5, 8, 'home', 'home'], [8, 11, 'wander', 'market'], [11, 13, 'eat', 'hall'], [13, 16, 'wander', 'market'], [16, 19, 'social', 'hall'], [19, 22, 'home', 'home']] };
LIFE_SCHED.woodcutter = LIFE_SCHED.miner;
Object.assign(LIFE_SCHED, {
  innkeeper:  [[1, 8.5, 'sleep', 'home'], [8.5, 9.5, 'home', 'home'], [9.5, 1, 'work', 'work']],                                   // the inn keeps late hours; the innkeeper lives in
  scholar:    [[23, 7, 'sleep', 'home'], [7, 8, 'home', 'home'], [8, 12, 'work', 'work'], [12, 13, 'eat', 'hall'], [13, 18, 'work', 'work'], [18, 21, 'social', 'hall'], [21, 23, 'home', 'home']],
  astronomer: [[6, 14, 'sleep', 'home'], [14, 15, 'home', 'home'], [15, 18, 'social', 'hall'], [18, 19, 'eat', 'hall'], [19, 6, 'work', 'work']],   // the stars are a night shift
  student:    [[23, 7, 'sleep', 'home'], [7, 8, 'home', 'home'], [8, 12, 'study', 'study'], [12, 13, 'eat', 'hall'], [13, 17, 'study', 'study'], [17, 21, 'social', 'hall'], [21, 23, 'home', 'home']] });
const LIFE_BUYERS = { ore: ['miner'], pine: ['miner', 'fletcher', 'workshop'], fish: ['fishmonger', 'innkeeper'] };
/* new residents: name, profession, town (global positions come from the town's buildings at boot) */
const LIFE_RESIDENTS = [
  ['Nell, fisherwoman', 'fisher', 'vespar'], ['Garrick, dockhand', 'dockhand', 'vespar'], ['Lise, weaver', 'townsfolk', 'vespar'], ['Old Tomas', 'townsfolk', 'vespar'], ['Corin, carter', 'townsfolk', 'vespar'],
  ['Durn, miner', 'miner', 'mynoc'], ['Kessa, miner', 'miner', 'mynoc'], ['Fennick, woodcutter', 'woodcutter', 'mynoc'], ['Mabry, cook', 'townsfolk', 'mynoc'],
  ['Bryn, forester', 'woodcutter', 'skara'], ['Ysolde, herb gatherer', 'townsfolk', 'skara'],
  ['Tibbet, student', 'student', 'moonglen'], ['Mira, student', 'student', 'moonglen']];
const LIFE_LINES = {
  sleep: ['Zzz…'], home: ['Home at last.', 'Mind the door.'], work: ['Busy, busy.', 'Another day at it.'], eat: ['Smells good today.', 'Pass the bread.'],
  social: ['Did you hear about the wolves on the cart road?', 'Fine evening.', 'The college folk were in again.', 'Trade is slow this week.', 'Ore prices are up, they say.'],
  study: ['Shh, I\'m reading.', 'Exams on the conjunction next week.'], wander: ['Just looking.', 'Fresh fish at Old Cray\'s.', 'Lovely day for it.'], gather: ['Hard work, this.', 'Good seam here.'], trade: ['Mind the scales.'], shelter: ['Get inside! Something is out there!'] };
const LIFE_COL = { student: '#4a3a6a', fisher: '#3a5a7a', dockhand: '#5a4a3a', townsfolk: '#6a5a4a', miner: '#4a4a52', woodcutter: '#3a5a32', trader: '#7a5a1a', weaver: '#6a3a5a' };
const LIFE_ITEM = { miner: 'ore', woodcutter: 'pine', fisher: 'fish' };
const LIFE_CARRY = 8;

/* ---------- town geometry: homes, halls, markets, fields, buyers ---------- */
const lifeZone = (x, y) => zoneAt(Math.floor(x), Math.floor(y));
function lifeOutside(b) {   // a point just outside a building's door
  for (const d of DOORS) if (d.x >= b.x && d.x < b.x + b.w && (Math.abs(d.y - b.y) < .6 || Math.abs(d.y - b.y - b.h) < .6)) { const s = Math.abs(d.y - b.y) < .6 ? -1 : 1; return { x: d.x + .5, y: d.y + s * 1.4 }; }
  return { x: b.cx, y: b.y + b.h + 1.4 };
}
function lifeTownGeo(id) {
  if (LIFE.towns[id]) return LIFE.towns[id];
  const blds = KBUILD.filter(b => lifeZone(b.cx, b.cy) === id), sh = SHRINES.find(s => s.id === id), t = ANN.towns.find(t => t.id === id);
  const center = sh ? { x: sh.x + .5, y: sh.y + 2 } : { x: t.x, y: t.y };
  const homes = blds.filter(b => b.role === 'house' || b.role === 'cottage');
  const hallB = blds.find(b => /_hall$|_inn$/.test(b.role));
  const G = { id, blds, homes, center, hall: hallB ? { x: hallB.cx, y: hallB.cy, b: hallB, r: Math.max(1.2, Math.min(hallB.w, hallB.h) / 2 - .9) } : { x: center.x, y: center.y + 3, r: 3 },
    market: { x: center.x, y: center.y, r: 9 }, guards: [], patrol: [] };
  // patrol: the shrine and a ring of doors, ordered around the town centre
  const pts = blds.map(lifeOutside).filter(p => canStand({ kind: 'npc' }, p.x, p.y)).sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x));
  const step = Math.max(1, Math.floor(pts.length / 5)); G.patrol = [center].concat(pts.filter((_, i) => i % step === 0).slice(0, 5));
  return LIFE.towns[id] = G;
}
/* a free spot near a place: crowds spread out instead of stacking on one tile (§14) */
function lifeSpot(e, c, r, salt) {   // salt: a different spot each call (a stroller's next stop), not the same first free one
  let best = null, bd = -1; salt = salt || 0;
  for (let k = 0; k < 10; k++) { const a = (k / 10 + (e.id % 7) * .13 + salt * .381) * Math.PI * 2, rr = r * (.4 + .6 * ((k * 7 + e.id + salt * 3) % 10) / 10), x = c.x + Math.cos(a) * rr, y = c.y + Math.sin(a) * rr;
    if (!canStand({ kind: 'npc' }, x, y)) continue; let near = 9; for (const o of LIFE.npcs) if (o !== e && !o.gone && o.life.goal && o.life.goal.x !== undefined) near = Math.min(near, Math.hypot(o.life.goal.x - x, o.life.goal.y - y));
    if (near > bd) { bd = near; best = { x, y }; } if (near > 1.4) break; }
  return best || { x: c.x, y: c.y };
}
/* resource fields: a stocked rock face in the mine, a stocked tree beyond the houses, a place on the harbour pier */
function lifeField(e) {
  const L = e.life, G = lifeTownGeo(L.town);
  if (L.prof === 'fisher') { const cap = ents.find(o => o.kind === 'npc' && o.role === 'boat' && o.town === 'vespar'); const base = cap ? { x: cap.x - 4, y: cap.y } : G.center; return lifeSpot(e, base, 2.5); }
  const want = L.prof === 'miner' ? T.RK : T.TR, from = L.prof === 'miner' ? (L.mineFrom || (L.mineFrom = lifeMineMouth(G))) : G.center;
  const key = L.town + ':' + L.prof, tiles = LIFE.fields[key] || (LIFE.fields[key] = (() => {   // every candidate node once: rock faces in the mine, trees beyond the houses
    const out = []; for (let y = Math.floor(from.y) - 70; y <= from.y + 70; y++) for (let x = Math.floor(from.x) - 70; x <= from.x + 70; x++) {
      if (tAt(x, y) !== want) continue; if (L.prof === 'woodcutter' && Math.hypot(x - from.x, y - from.y) < 18) continue; if (L.prof === 'miner' && lifeZone(x, y) !== 'mine') continue;   // woodcutters leave the trees in the heart of town alone (Skara Bryn stands in its woods)
      for (const [ox, oy] of [[0, 1.6], [1.6, 0], [-.6, .5], [.5, -.6], [0, -.6], [-.6, 0]]) { const sx = x + .5 + ox, sy = y + .5 + oy; if (canStand({ kind: 'npc' }, sx, sy)) { out.push({ x: sx, y: sy, nx: x, ny: y, d: Math.hypot(sx - from.x, sy - from.y) }); break; } } }
    return out.sort((a, b) => L.prof === 'miner' ? b.d - a.d : a.d - b.d); })());   // miners work the deep faces first, leaving the ones by the entrance to visitors; woodcutters the nearest trees
  const taken = new Set(LIFE.npcs.filter(o => o !== e && o.life.goal && o.life.goal.nx !== undefined).map(o => o.life.goal.ny * W + o.life.goal.nx));
  let best = null; for (const t of tiles) { if (taken.has(t.ny * W + t.nx)) continue; if (nodeStock(t.nx, t.ny).n <= 0) continue; best = { x: t.x, y: t.y, nx: t.nx, ny: t.ny }; break; }
  return best || lifeSpot(e, G.center, 4);
}
function lifeMineMouth(G) { const t = ents.find(o => o.kind === 'npc' && o.role === 'miner' && o.town === 'mynoc'); return t ? { x: t.x + 14, y: t.y - 10 } : G.center; }
function lifeBuyer(e) {
  const L = e.life, roles = LIFE_BUYERS[LIFE_ITEM[L.prof]] || ['miner'], b = ents.find(o => o.kind === 'npc' && roles.includes(o.role) && o.town === L.town);
  if (!b) return lifeSpot(e, lifeTownGeo(L.town).center, 3); const p = lifeSpot(e, b.life ? b.life.work : b, 1.6); p.near = b; return p;   // trading happens across the counter: within reach of the buyer counts
}
function lifePlace(e, place) {
  const L = e.life, G = lifeTownGeo(L.town);
  switch (place) {
    case 'home': return L.home;
    case 'work': return L.work;
    case 'hall': return lifeSpot(e, G.hall, G.hall.r);
    case 'market': return lifeSpot(e, G.market, G.market.r);
    case 'field': return lifeField(e);
    case 'buyer': return lifeBuyer(e);
    case 'study': { const G = lifeTownGeo(L.town), lib = G.blds.find(b => b.role === 'moon_library') || G.hall.b; return lib ? lifeSpot(e, { x: lib.cx, y: lib.cy }, Math.max(1.2, Math.min(lib.w, lib.h) / 2 - .9)) : lifeSpot(e, G.center, 4); }
    case 'shelter': { const hd = Math.hypot(L.home.x - e.x, L.home.y - e.y); if (hd < 45) return L.home; let best = null, bd = 1e9; for (const b of G.blds) { const d = Math.hypot(b.cx - e.x, b.cy - e.y); if (d < bd) { bd = d; best = b; } } return best ? { x: best.cx, y: best.cy } : G.center; }
  }
  return L.home;
}

/* ---------- population: give the scheduled townsfolk a life, add the residents, place everyone where the clock says ---------- */
function lifePopulate(npc) {
  LIFE.npcs.length = 0; LIFE.towns = {}; LIFE.fields = {}; LIFE.stock = { vespar: { fish: 0 }, mynoc: { ore: 0, pine: 0 }, skara: { pine: 0 }, moonglen: {} };
  for (const id in LIFE_TOWNS) lifeTownGeo(id);
  const homeUse = new Map();
  const homeFor = (town, i, live) => { const G = LIFE.towns[town]; const pool = G.homes.length ? G.homes : live ? [live] : G.hall.b ? [G.hall.b] : []; if (!pool.length) return { x: G.center.x, y: G.center.y };   // no houses (Skara Bryn, the college): they live in at their work or the hall
    const b = pool[i % pool.length]; const n = homeUse.get(b) || 0; homeUse.set(b, n + 1);
    const p = { x: b.cx - 1.2 + (n % 3) * 1.2, y: b.cy - .6 + Math.floor(n / 3) * 1.1, b }; if (!canStand({ kind: 'npc' }, p.x, p.y)) { p.x = b.cx; p.y = b.cy; } return p; };
  let hi = 0;
  for (const e of ents) if (e.kind === 'npc' && LIFE_TOWNS[e.town] && (LIFE_SHOP_ROLES[e.role] || LIFE_ROLE_PROF[e.role])) {
    const prof = /^Astronomer/.test(e.name) ? 'astronomer' : LIFE_ROLE_PROF[e.role] || 'shop', wb = insideBuild(e.x, e.y);
    lifeAdopt(e, prof, e.town, homeFor(e.town, hi++, wb && wb.role !== 'house' && wb.role !== 'cottage' ? wb : null), { x: e.x, y: e.y }); }
  for (const [name, prof, town] of LIFE_RESIDENTS) {
    const G = LIFE.towns[town], home = homeFor(town, hi++, prof === 'student' ? G.blds.find(b => b.role === 'college_hall') : null), e = npc('resident', name, home.x, home.y); e.town = town;
    let work = null; if (prof === 'dockhand') { const wh = G.blds.filter(b => b.role === 'warehouse'); work = wh.length ? lifeOutside(wh[0]) : G.center; }
    lifeAdopt(e, prof, town, home, work || { x: G.center.x, y: G.center.y });
  }
  // guards of the four Anniabreen towns patrol; the first of each town keeps watch at its post by night
  for (const e of ents) if (e.kind === 'npc' && e.role === 'guard' && e.town && ANN.towns.some(t => t.id === e.town)) {
    const G = lifeTownGeo(e.town); e.life = { prof: 'guard', town: e.town, post: { x: e.x, y: e.y }, watch: !G.guards.length, wp: G.guards.length * 2, needs: SIM.newNeeds(), mem: SIM.newMemory(8), mind: {}, goal: null, thinkAt: 0 };
    e.home = { x: e.x, y: e.y }; G.guards.push(e); LIFE.npcs.push(e); }
  // the travelling merchant: Mynoc yard ↔ Vespar market by the cart road
  if (!SHOPS.trader) SHOPS.trader = ['bandage', 'cookedmeat', 'lanternoil', 'arrow', 'bolt', 'cloth', 'vial', 'pine', 'ironbar', 'hatchet', 'pickaxe', 'rod'].filter(id => SF.ITEMS[id] && SF.PRICES[id] !== undefined);
  { const G = LIFE.towns.mynoc, p = lifeSpot({ id: 77 }, G.market, 5), e = npc('trader', 'Tobin, travelling merchant', p.x, p.y); e.town = 'mynoc';
    e.life = { prof: 'trader', town: 'mynoc', needs: SIM.newNeeds(), mem: SIM.newMemory(8), mind: {}, goal: null, thinkAt: 0, phase: 'selling', until: 0, route: ['mynoc', 'vespar'], legs: 0, gold: 120 }; e.home = { x: p.x, y: p.y }; LIFE.trader = e; LIFE.npcs.push(e); }
  for (const e of LIFE.npcs) { npcArm(e); lifeResume(e); }   // phase 5: everyone with a life can be hurt and (guards) fight back
}
function lifeAdopt(e, prof, town, home, work) {
  e.life = { prof, town, home, work, sched: LIFE_SCHED[prof], needs: SIM.newNeeds(), mem: SIM.newMemory(8), mind: {}, goal: null, thinkAt: 0, carry: 0, gold: 20 + (e.id % 7) * 5, doing: 'idle' };
  e.home = { x: home.x, y: home.y }; LIFE.npcs.push(e);
}
/* after a load (or at boot): stand where the schedule says right now, not where the day started */
function lifeResume(e) {
  const L = e.life; L.goal = null; L.thinkAt = 0; e.nav = null;
  if (L.prof === 'guard') { const p = L.watch && lifeNight() ? L.post : lifeTownGeo(L.town).patrol[L.wp % lifeTownGeo(L.town).patrol.length]; lifeTeleport(e, p); return; }
  if (L.prof === 'trader') return;
  const b = SIM.scheduleAt(L.sched, hourOfDay()); if (!b) return; const p = lifePlace(e, b.place); lifeTeleport(e, p);
  L.goal = { act: b.act, place: b.place, x: p.x, y: p.y, key: b.act + '@' + b.place + '#' + b.i }; L.doing = b.act; L.mind.act = L.goal.key; L.mind.at = GT; L.mind.why = 'schedule: ' + b.act;
}
function lifeTeleport(e, p) { if (p && canStand(e, p.x, p.y)) { e.x = p.x; e.y = p.y; e._px = e.x; e._py = e.y; } }
const lifeNight = () => { const h = hourOfDay(); return h >= 19 || h < 6; };

/* ---------- the controller: civilians, merchants and guards with a life (others keep the phase 2 behaviour) ---------- */
function lifeTick(e, dt) {
  const L = e.life; if (!L || e.dev) return townTick(e, dt);
  if (npcCombatTick(e, dt)) return;   // knocked down, or a guard in a fight (src/npcfight.js)
  L.needs = SIM.needsTick(L.needs, dt / WS.clock.secondsPerHour(), e.nav && e.nav.state === 'moving' ? 'walk' : L.doing);
  if (GT >= L.thinkAt) { const t0 = DEV.on ? performance.now() : 0; L.thinkAt = GT + .9 + (e.id % 10) * .02; if (L.prof === 'guard') guardThink(e); else if (L.prof === 'trader') traderThink(e); else lifeThink(e); if (DEV.on) LIFE.thinkMs += performance.now() - t0; }
  if (e.nav && e.nav.state === 'moving') {
    const gd = L.goal ? Math.hypot(L.goal.x - e.x, L.goal.y - e.y) : 0;
    if (!L.wd || gd < L.wd.d - .3 || (e.nav.job && e.nav.job.status === 'running')) L.wd = { d: gd, t: GT };   // a path still being searched is not a stall
    else if (GT - L.wd.t > 6 && L.goal) {   // watchdog: a journey that has got no closer for 6 s ends here; close enough counts as there, otherwise try again
      L.wd = null; e.nav = null; if (Math.hypot(L.goal.x - e.x, L.goal.y - e.y) < 4.5) { L.goal.x = e.x; L.goal.y = e.y; } else { L.retryAt = GT + 2; lifeGo(e, L.goal); } return; }
    navStep(e, dt * (L.hurry ? 1.35 : 1)); lifeSeparate(e); return; }
  if (e.nav && e.nav.state === 'failed' && L.goal && GT > (L.retryAt || 0)) { L.retryAt = GT + 5; lifeGo(e, L.goal); }
  e.speed = 0; if (L.prof !== 'trader') lifeDo(e, dt); lifeSeparate(e);
}
function lifeGo(e, g, o) {
  if (Math.hypot(g.x - e.x, g.y - e.y) < .5) { e.nav = null; return; }
  navTo(e, g.x, g.y, Object.assign({ direct: true, doors: true, speed: SF.WALK * .55, name: g.act || g.place, maxNodes: 120000 }, o || {}));
}
/* danger: a hostile creature the NPC can see (§7: abandon the routine and seek safety) */
function lifeDanger(e, r) {
  let th = null, bd = r; ECOS.grid.query(e.x, e.y, r, c => { if (c.kind !== 'mon' || c.gone || c.dead || c.pacified > GT) return; if (!ecoEnemy(c, e) && !ECO_FACTIONS.hostile(ecoP(c.type).f, factionOf(e))) return; const d = dist(c, e); if (d < bd && los(e, c)) { bd = d; th = c; } });
  return th;
}
function lifeThink(e) {
  const L = e.life, h = hourOfDay(), b = SIM.scheduleAt(L.sched, h), opts = [];
  if (b) opts.push({ act: b.act + '@' + b.place + '#' + b.i, a: b.act, place: b.place, score: .5, why: 'schedule: ' + b.act + ' (' + SIM.fmtHour(b.from) + '–' + SIM.fmtHour(b.to) + ')' });
  const th = lifeDanger(e, 12);
  if (th) { if (L.needs.safety < .5) { LIFE.events.frights++; L.mem.note(GT, 'fled from', aidOf(th), { x: Math.round(e.x), y: Math.round(e.y) }, 120); say(e, pick(LIFE_LINES.shelter)); } SIM.frighten(L.needs, 1); }
  if (L.needs.safety > .3) opts.push({ act: 'shelter', a: 'shelter', place: 'shelter', score: 1 + L.needs.safety, force: true, why: 'danger: ' + (th ? th.name : 'still shaken') });
  if (L.needs.hunger > .85 && b && b.act !== 'sleep' && b.act !== 'eat') opts.push({ act: 'eat@hall', a: 'eat', place: 'hall', score: .5 + L.needs.hunger * .3, why: 'hungry (' + Math.round(L.needs.hunger * 100) + '%)' });
  if (L.needs.fatigue > .92 && b && b.act !== 'sleep') opts.push({ act: 'sleep@home', a: 'sleep', place: 'home', score: .6 + L.needs.fatigue * .3, why: 'exhausted' });
  if (L.carry >= LIFE_CARRY && b && b.act === 'gather') opts.push({ act: 'trade@buyer', a: 'trade', place: 'buyer', score: .75, why: 'hands full (' + L.carry + ' ' + LIFE_ITEM[L.prof] + ')' });
  const pick1 = SIM.decide(L.mind, opts, GT, { commit: 20, margin: .15 }); if (!pick1) return;
  if (!L.goal || L.goal.key !== pick1.act || (pick1.a === 'shelter' && !L.goal)) {
    const p = lifePlace(e, pick1.place); L.goal = { act: pick1.a, place: pick1.place, x: p.x, y: p.y, key: pick1.act, nx: p.nx, ny: p.ny, near: p.near }; L.doing = 'walk'; lifeGo(e, L.goal); }
}
/* doing the act once there */
function lifeDo(e, dt) {
  const L = e.life, g = L.goal; if (!g) return; const gd = Math.hypot(g.x - e.x, g.y - e.y), there = gd < 1.2 || (gd < 2.6 && e.nav && e.nav.state === 'done') || (g.near && !g.near.gone && dist(e, g.near) < 3.2);   // a journey that ends a step short (behind a counter) still counts as arrived
  if (!there) { if (!e.nav || e.nav.state !== 'moving') { if (!e.nav || e.nav.state === 'done') lifeGo(e, g); } return; }
  L.doing = g.act;
  if (g.act === 'sleep') { if (P && dist(e, P) < 14 && GT > (L.zAt || 0)) { L.zAt = GT + 7; say(e, 'Zzz…'); } return; }
  if (g.act === 'wander' && GT > (L.wAt || 0)) { L.wAt = GT + 12 + (e.id % 9) * 2; const G = lifeTownGeo(L.town), p = lifeSpot(e, G.market, G.market.r, L.wn = (L.wn || 0) + 1); g.x = p.x; g.y = p.y; lifeGo(e, g); return; }
  if (g.act === 'gather') return lifeGather(e, dt);
  if (g.act === 'trade' && L.carry > 0) return lifeSell(e);
  if (g.act === 'social' || g.act === 'eat') { if (GT > (L.chatAt || 0)) { L.chatAt = GT + 25 + (e.id % 13) * 3; const o = LIFE.npcs.find(o => o !== e && !o.gone && o.life.goal && o.life.doing === g.act && dist(o, e) < 3.5);
      if (o) { faceToward(e, o.x, o.y); if (P && dist(e, P) < 16) say(e, pick(LIFE_LINES[g.act])); L.mem.note(GT, 'talked with', aidOf(o), null, 900); } } }
}
/* resource workers take real strokes from real nodes (the same stock the player mines), carry the haul and sell it in town */
function lifeGather(e, dt) {
  const L = e.life, g = L.goal; if (GT < (L.strokeAt || 0)) return; L.strokeAt = GT + 6;
  if (L.carry >= LIFE_CARRY) return; e.lunge = .001;
  if (L.prof === 'fisher') { L.casts = (L.casts || 0) + 1; if (L.casts % 2 === 0) {   // every other cast lands a fish (deterministic)
    L.carry++; LIFE.events.strokes++; simEmit('ResourceGathered', { actor: aidOf(e), skill: 'fishing', item: 'fish', qty: 1, x: e.x, y: e.y }); } return; }
  if (g.nx === undefined) { const f = lifeField(e); Object.assign(g, f); return lifeGo(e, g); }
  const st = nodeStock(g.nx, g.ny); if (st.n <= 0) { const f = lifeField(e); Object.assign(g, f); g.nx = f.nx; g.ny = f.ny; return lifeGo(e, g); }
  st.n--; if (st.n <= 0) st.t = GT + 300; L.carry++; LIFE.events.strokes++;
  faceToward(e, g.nx + .5, g.ny + .5); sndAt(L.prof === 'miner' ? 'gather.mine' : 'gather.chop', e, { gain: .4, key: 'npcgather' + e.id });
  simEmit('ResourceGathered', { actor: aidOf(e), skill: L.prof === 'miner' ? 'mining' : 'lumberjacking', item: LIFE_ITEM[L.prof], qty: 1, node: g.ny * W + g.nx, x: g.nx, y: g.ny });
}
function lifeSell(e) {
  const L = e.life, item = LIFE_ITEM[L.prof], q = L.carry, pay = q * (SF.PRICES[item] || 2);
  L.carry = 0; L.gold += pay; LIFE.stock[L.town][item] = (LIFE.stock[L.town][item] || 0) + q; LIFE.events.trades++;
  L.mem.note(GT, 'sold ' + q + ' ' + item, null, null, 0); simEmit('ItemTransferred', { actor: aidOf(e), item, qty: q, detail: { to: L.town + ' stores', gold: pay } });
}
function lifeSeparate(e) { ECOS.grid.query(e.x, e.y, .55, o => { if (o === e || o.kind !== 'npc' || o.gone) return; const dx = e.x - o.x, dy = e.y - o.y, l = Math.hypot(dx, dy); if (l > 0 && l < .55) moveBy(e, dx / l * .02, dy / l * .02); }); }

/* guards: patrol the town's doors and shrine by day; at night the watch stands at its post (gate) and the rest keep walking */
function guardThink(e) {
  const L = e.life, G = lifeTownGeo(L.town);
  if (L.watch && lifeNight()) { if (!L.goal || L.goal.act !== 'watch') { L.goal = { act: 'watch', place: 'post', x: L.post.x, y: L.post.y }; L.mind.why = 'night watch at the post'; lifeGo(e, L.goal); } else if (!e.nav || e.nav.state !== 'moving') L.doing = 'watch'; return; }
  if (!L.goal || L.goal.act === 'watch') { const p = G.patrol[L.wp % G.patrol.length]; L.goal = { act: 'patrol', x: p.x, y: p.y, wait: 0 }; L.mind.why = 'patrolling (' + (L.wp % G.patrol.length + 1) + '/' + G.patrol.length + ')'; lifeGo(e, L.goal); return; }
  const there = Math.hypot(L.goal.x - e.x, L.goal.y - e.y) < 1.4;
  if (there) { L.doing = 'patrol'; if (!L.goal.wait) L.goal.wait = GT + 6 + (e.id % 5) * 1.5; if (GT > L.goal.wait) { L.wp++; const p = G.patrol[L.wp % G.patrol.length]; L.goal = { act: 'patrol', x: p.x, y: p.y, wait: 0 }; L.mind.why = 'patrolling (' + (L.wp % G.patrol.length + 1) + '/' + G.patrol.length + ')'; lifeGo(e, L.goal); } }
  else if (!e.nav || e.nav.state !== 'moving') lifeGo(e, L.goal);
  const th = lifeDanger(e, 10); if (th && !L.mem.knows('saw', aidOf(th))) L.mem.note(GT, 'saw', aidOf(th), { x: Math.round(th.x), y: Math.round(th.y) });   // law and fighting back: phase 5
}
/* the travelling merchant: sells at a market for an in-game hour, then takes the cart road to the other town by day; hurries when
   something hostile is in sight on the road; stays in town overnight */
function traderThink(e) {
  const L = e.life, h = hourOfDay();
  if (L.phase === 'selling') { L.doing = lifeNight() ? 'sleep' : h >= 12 && h < 13 ? 'eat' : 'trade';   // overnight at the inn; a midday meal if (!L.until) L.until = GT + WS.clock.secondsPerHour();
    L.mind.why = 'selling at ' + (L.town === 'mynoc' ? 'Mynoc' : 'Vespar') + ' market';
    if (GT > L.until && h >= 6 && h < 17) { L.phase = 'travel'; const to = L.route[(L.route.indexOf(L.town) + 1) % L.route.length], G = lifeTownGeo(to), p = lifeSpot(e, G.market, 5); L.dest = to; L.goal = { act: 'travel', x: p.x, y: p.y };
      L.mem.note(GT, 'set out for ' + to, null, null, 0); lifeGo(e, L.goal, { maxNodes: 400000, speed: SF.WALK * .6 }); say(e, 'On to ' + (to === 'vespar' ? 'Vespar' : 'Mynoc') + '!'); }
    return; }
  L.doing = 'walk'; L.mind.why = 'on the road to ' + (L.dest === 'vespar' ? 'Vespar' : 'Mynoc');
  const th = lifeDanger(e, 14); L.hurry = !!th; if (th) { if (L.needs.safety < .5) { LIFE.events.frights++; L.mem.note(GT, 'hurried past', aidOf(th), { x: Math.round(e.x), y: Math.round(e.y) }, 120); } SIM.frighten(L.needs, 1); L.mind.why = 'hurrying past a ' + th.name; }
  if (e.nav && e.nav.state === 'failed' && GT > (L.retryAt || 0)) { L.retryAt = GT + 8; lifeGo(e, L.goal, { maxNodes: 400000, speed: SF.WALK * .6 }); }
  if (Math.hypot(L.goal.x - e.x, L.goal.y - e.y) < 1.5) { L.phase = 'selling'; L.town = L.dest; e.town = L.dest; L.until = GT + WS.clock.secondsPerHour(); L.legs++; L.hurry = false; e.nav = null; L.goal = null; L.needs.hunger = .1;   /* a meal at the market inn */ LIFE.events.arrivals++;
    L.mem.note(GT, 'arrived in ' + L.dest, null, null, 0); simEmit('MerchantArrived', { actor: aidOf(e), town: L.dest, x: e.x, y: e.y }); say(e, 'Fresh goods from the road!'); }
}

/* ---------- talking to someone with a life ---------- */
function lifeTalk(n) {
  const L = n.life; if (!L || P.ghost) return false;
  if (n.downed) { log(n.name.split(',')[0] + ' lies wounded and cannot talk.', '#b6a68a'); return true; }
  if (L.prof === 'trader') { if (L.phase === 'selling') return false; say(n, 'On the road to ' + (L.dest === 'vespar' ? 'Vespar' : 'Mynoc') + '. Find me at the market there.'); return true; }
  if (L.prof === 'guard') return false;
  if (L.doing === 'sleep' && L.goal && L.goal.act === 'sleep') { say(n, 'Zzz…'); log(n.name.split(',')[0] + ' is asleep.', '#b6a68a'); return true; }
  const met = L.mem.knows('talked with', aidOf(P)), first = (P.name || 'friend').split(' ')[0]; L.mem.note(GT, 'talked with', aidOf(P), null, 600);
  const atWork = L.work && Math.hypot(n.x - L.work.x, n.y - L.work.y) < 3;
  if (LIFE_SHOP_ROLES[n.role] || LIFE_ROLE_PROF[n.role]) { if (atWork) { if (met && GT > (L.greetAt || 0)) { L.greetAt = GT + 120; say(n, pick(['Back again, ' + first + '?', 'Good to see you, ' + first + '.', 'Ah, ' + first + '. What will it be?'])); } return false; }
    if (!LIFE_SHOP_ROLES[n.role]) { say(n, (met ? first + '! ' : '') + pick(LIFE_LINES[L.doing] || LIFE_LINES.wander)); return true; }
    const open = L.sched.find(bl => bl[2] === 'work'); say(n, `${met ? 'Sorry, ' + first + ', the' : 'The'} shop is shut just now. I open at ${SIM.fmtHour(open[0])}.`); return true; }
  const rec = L.mem.recent(4).reverse().find(r => r.what === 'fled from' || r.what === 'saw');
  say(n, (met ? pick(['Hello again, ', 'Oh, ', 'Good day, ']) + first + '. ' : '') + (rec ? 'Careful out there. I saw something nasty earlier.' : pick(LIFE_LINES[L.doing] || LIFE_LINES.wander))); return true;
}
function lifeInspect(e) {
  const L = e && e.life; if (!L) return {};
  const b = L.sched ? SIM.scheduleAt(L.sched, hourOfDay()) : null, n = L.needs, r2 = v => Math.round(v * 100) / 100;
  return { profession: L.prof + ' · ' + L.town, schedule: b ? b.act + ' at ' + b.place + ' until ' + SIM.fmtHour(b.to) : (L.prof === 'trader' ? L.phase : L.watch && lifeNight() ? 'night watch' : 'patrol'),
    doing: L.doing, decision: L.mind && L.mind.why || '—', needs: { hunger: r2(n.hunger), fatigue: r2(n.fatigue), social: r2(n.social), safety: r2(n.safety) },
    home: L.home ? Math.round(L.home.x) + ',' + Math.round(L.home.y) : null, work: L.work ? Math.round(L.work.x) + ',' + Math.round(L.work.y) : null,
    carry: L.carry !== undefined && LIFE_ITEM[L.prof] ? L.carry + ' ' + LIFE_ITEM[L.prof] : null, gold: L.gold ?? null,
    memory: L.mem.recent(4).map(m => SIM.fmtHour(WS.clock.hourAt(m.t)) + ' ' + m.what + (m.who ? ' ' + m.who : '') + (m.n > 1 ? ' ×' + m.n : '')) };
}
function lifeDev() {
  const by = {}; for (const e of LIFE.npcs) if (!e.gone) { const k = e.life.doing || 'idle'; by[k] = (by[k] || 0) + 1; }
  const t = LIFE.trader && LIFE.trader.life;
  return `town life: ${LIFE.npcs.length} with routines · ${Object.entries(by).map(([k, v]) => k + ' ' + v).join(', ')}<br>
  trader: ${t ? t.phase + (t.phase === 'travel' ? ' → ' + t.dest : ' at ' + t.town) + ', trips ' + t.legs : '—'} · stores: ${Object.entries(LIFE.stock).map(([k, s]) => k + ' ' + Object.entries(s).map(([i, q]) => q + ' ' + i).join('/')).join(', ')} · frights ${LIFE.events.frights} · strokes ${LIFE.events.strokes} · sales ${LIFE.events.trades}`;
}

/* ---------- save: what townsfolk carry with them (needs, memory, haul, purse), the stores, and the trader's road ----------
   Positions are not saved: a load places everyone where the clock says (lifeResume). */
function lifeSave() {
  const npcs = {}; for (const e of LIFE.npcs) { if (!e.actorId || e.gone) continue; const L = e.life; npcs[e.actorId] = { needs: L.needs, mem: L.mem.save(), carry: L.carry || 0, gold: L.gold ?? null }; const f = npcSave(e); if (f) npcs[e.actorId].fight = f; }
  const t = LIFE.trader && LIFE.trader.life; return { v: 1, npcs, stock: LIFE.stock, trader: t ? { town: t.town, legs: t.legs, gold: t.gold } : null };
}
function lifeLoad(saved) {
  if (!saved || !saved.npcs) return;
  for (const e of LIFE.npcs) { const r = e.actorId && saved.npcs[e.actorId]; if (!r) continue; const L = e.life; L.needs = SIM.newNeeds(r.needs); L.mem = SIM.newMemory(8, r.mem); if (r.carry !== undefined) L.carry = r.carry; if (r.gold !== null && r.gold !== undefined) L.gold = r.gold; if (r.fight) npcLoad(e, r.fight); }
  if (saved.stock) for (const k in saved.stock) LIFE.stock[k] = Object.assign(LIFE.stock[k] || {}, saved.stock[k]);
  const t = LIFE.trader; if (t && saved.trader && LIFE.towns[saved.trader.town]) { const L = t.life, G = LIFE.towns[saved.trader.town], p = lifeSpot(t, G.market, 5); L.town = t.town = saved.trader.town; L.legs = saved.trader.legs || 0; L.gold = saved.trader.gold ?? L.gold; L.phase = 'selling'; L.until = 0; lifeTeleport(t, p); t.home = { x: p.x, y: p.y }; }
}
