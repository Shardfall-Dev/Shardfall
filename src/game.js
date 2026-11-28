/* ================= GAME: actors, intents, combat, magic, gathering, crafting, death ================= */
const MON = {
  rat:   { n: 'dock rat',    col: '#7a6a62', size: .7,  h: 34, hp: 20, atk: 22, def: 20, dmg: [3, 6],  reach: 1.15, tele: .45, rec: 1.3,  speed: 3.6, aggro: 6,   leash: 16, armor: 4,  diff: 15, loot: { gold: [2, 9] }, skin: { hide: [1, 1] } },
  boar:  { n: 'reed boar',   col: '#6e4c34', size: 1.15, h: 46, hp: 55, atk: 40, def: 38, dmg: [8, 12], reach: 1.4,  tele: .8,  rec: 1.9,  speed: 4.5, aggro: 4.5, leash: 20, armor: 14, diff: 40, loot: { gold: [0, 4] }, skin: { hide_thick: [3, 3], sinew: [1, 2], meat: [2, 2] } },
  hound: { n: 'marsh hound', col: '#5c645a', size: 1,   h: 46, hp: 46, atk: 58, def: 55, dmg: [6, 9],  reach: 1.3,  tele: .42, rec: 1.05, speed: 4.6, aggro: 9,   leash: 26, armor: 10, diff: 60, loot: { gold: [3, 14], reedash: [0, 2] }, skin: { hide: [2, 2], sinew: [2, 2], meat: [1, 1] } } };
Object.assign(MON.rat, { tame: 25, bite: .2 }); Object.assign(MON.boar, { tame: 55, bite: .5 }); Object.assign(MON.hound, { tame: 55, bite: .45 });
Object.assign(MON, {
  snapper:   { n: 'mud snapper', col: '#5e5a38', size: 1.05, h: 34, hp: 60, atk: 45, def: 50, dmg: [9, 14], reach: 1.2, tele: .7, rec: 1.6, speed: 2.8, aggro: 4, leash: 14, armor: 30, diff: 50, tame: 80, strong: 1, bite: .6, loot: { shelldust: [1, 3] }, skin: { hide_thick: [2, 2], meat: [2, 3] } },
  spider:    { n: 'mire spider', col: '#2a2630', size: .95, h: 30, hp: 40, atk: 55, def: 50, dmg: [5, 8], reach: 1.2, tele: .5, rec: 1.1, speed: 4.3, aggro: 7, leash: 20, armor: 8, diff: 55, poison: [1, .35], tame: 80, strong: 1, bite: .5, loot: { silk: [2, 4], marshroot: [0, 2] }, skin: { sinew: [1, 2] } },
  smuggler:  { n: 'brine smuggler', scout: '#6a2a2a', size: 1, h: 66, hp: 60, atk: 55, def: 55, dmg: [7, 11], reach: 1.3, tele: .35, rec: .95, speed: 4.2, aggro: 7, leash: 22, armor: 20, diff: 55, hideChance: .5, purse: [10, 30], loot: { gold: [8, 25], bandage: [0, 3], lockpick: [0, 2], arrow: [0, 8] } },
  wisp:      { n: 'ash wisp', col: '#ff8a30', size: .8, h: 40, hp: 30, atk: 60, def: 45, dmg: [9, 13], reach: 7, tele: .8, rec: 1.6, speed: 3.4, aggro: 9, leash: 18, armor: 0, diff: 60, ranged: 1, keep: 4, loot: { reedash: [2, 4], lanternoil: [1, 2] } },
  sentinel:  { n: 'bell sentinel', col: '#7a6a48', size: 1.3, h: 70, hp: 120, atk: 65, def: 70, dmg: [12, 18], reach: 1.6, tele: 1.1, rec: 2.2, speed: 3.2, aggro: 6, leash: 16, armor: 40, diff: 75, ward: 20, loot: { ironbar: [1, 3], bellshard: [0, 1], gold: [10, 30] }, rare: [['mace', .2], ['waraxe', .1]] },
  captain:   { n: 'drowned captain', scout: '#1e4a5a', size: 1.1, h: 70, hp: 160, atk: 75, def: 75, dmg: [14, 20], reach: 1.6, tele: .6, rec: 1.3, speed: 4.0, aggro: 8, leash: 20, armor: 25, diff: 85, loot: { gold: [60, 120], bellshard: [1, 2], draught: [0, 2] }, rare: [['chain_tunic', .25], ['glaive', .2], ['crossbow', .15], ['heavycrossbow', .1]] },
  bellkeeper:{ n: 'the Bellkeeper', col: '#8a6a30', size: 2.2, h: 120, hp: 450, atk: 80, def: 80, dmg: [18, 26], reach: 2.6, tele: 1.4, rec: 2.0, speed: 2.6, aggro: 12, leash: 14, armor: 35, diff: 95, boss: 1, aoe: 2.6, ward: 40, wardEvery: 20, ranged2: { dmg: [12, 18], range: 9, tele: 1.0 }, loot: { gold: [300, 500], bellshard: [3, 6], blacksalt: [4, 8] }, rare: [['plate_chest', .5], ['plate_leggings', .35], ['great_helm', .2], ['glaive', .3]] } });
/* Bestiary v1 creatures (art: src/bestiary-art.js). Stats are provisional placeholders on the existing tiers; spawn placement and balance are separate work, so none are in SPAWNS yet. h = sprite height in px. */
Object.assign(MON, {
  slime:           { n: 'bog slime',       size: .8,  h: 42,  hp: 35,  atk: 35, def: 25, dmg: [4, 7],   reach: 1.1, tele: .7,  rec: 1.4, speed: 2.2, aggro: 5,  leash: 14, armor: 2,  diff: 30, poison: [1, .25], loot: { gold: [0, 6], marshroot: [0, 2] } },
  dire_wolf:       { n: 'dire wolf',       size: 1.05, h: 70, hp: 70,  atk: 65, def: 60, dmg: [8, 12],  reach: 1.3, tele: .45, rec: 1.1, speed: 4.8, aggro: 10, leash: 26, armor: 12, diff: 65, loot: { gold: [0, 6] }, skin: { hide_wolf: [2, 3], sinew: [2, 2], meat: [2, 2], bone: [1, 2] } },
  giant_spider:    { n: 'giant spider',    size: 1.2, h: 66,  hp: 75,  atk: 62, def: 55, dmg: [8, 12],  reach: 1.3, tele: .55, rec: 1.2, speed: 4.2, aggro: 7,  leash: 20, armor: 12, diff: 65, poison: [2, .35], loot: { silk: [3, 6] }, skin: { sinew: [1, 2] } },
  orc:             { n: 'orc',             size: 1.05, h: 82, hp: 80,  atk: 60, def: 55, dmg: [9, 14],  reach: 1.4, tele: .6,  rec: 1.3, speed: 4.0, aggro: 8,  leash: 22, armor: 22, diff: 60, loot: { gold: [10, 30], bandage: [0, 2] } },
  lizardman:       { n: 'lizardman',       size: 1,   h: 92,  hp: 75,  atk: 62, def: 60, dmg: [8, 13],  reach: 1.6, tele: .55, rec: 1.2, speed: 4.3, aggro: 8,  leash: 22, armor: 18, diff: 60, loot: { gold: [8, 24] }, skin: { hide_spined: [2, 3] } },
  harpy:           { n: 'harpy',           size: 1.05, h: 84, hp: 65,  atk: 60, def: 62, dmg: [7, 11],  reach: 1.3, tele: .5,  rec: 1.1, speed: 4.8, aggro: 9,  leash: 24, armor: 8,  diff: 60, loot: { gold: [5, 20] }, skin: { meat: [1, 2] } },
  gargoyle:        { n: 'gargoyle',        size: 1.2, h: 78,  hp: 110, atk: 68, def: 68, dmg: [11, 16], reach: 1.4, tele: .75, rec: 1.6, speed: 3.8, aggro: 8,  leash: 18, armor: 36, diff: 72, loot: { gold: [20, 50], ironbar: [0, 2] }, skin: { hide_barbed: [1, 3] } },
  troll:           { n: 'troll',           size: 1.4, h: 96,  hp: 160, atk: 70, def: 60, dmg: [14, 20], reach: 1.6, tele: .9,  rec: 1.8, speed: 3.6, aggro: 7,  leash: 18, armor: 24, diff: 78, loot: { gold: [25, 60] }, skin: { hide_troll: [4, 5], meat: [3, 4], bone: [2, 3] } },
  ettin:           { n: 'ettin',           size: 1.5, h: 94,  hp: 190, atk: 72, def: 62, dmg: [15, 22], reach: 1.7, tele: 1.0, rec: 2.0, speed: 3.4, aggro: 7,  leash: 18, armor: 26, diff: 80, loot: { gold: [30, 70] }, skin: { hide_horned: [2, 4], bone: [2, 4] } },
  earth_elemental: { n: 'earth elemental', size: 1.5, h: 100, hp: 220, atk: 70, def: 70, dmg: [14, 21], reach: 1.6, tele: 1.1, rec: 2.1, speed: 2.6, aggro: 6,  leash: 14, armor: 45, diff: 82, loot: { gold: [10, 40], ironbar: [1, 4] } },
  lich_lord:       { n: 'the Lich Lord',   size: 1.6, h: 106, hp: 520, atk: 85, def: 82, dmg: [16, 24], reach: 1.8, tele: 1.0, rec: 1.7, speed: 3.0, aggro: 12, leash: 16, armor: 30, diff: 95, boss: 1, fallLine: 'The cold light leaves its eyes.', ranged2: { dmg: [13, 19], range: 9, tele: 1.0 }, loot: { gold: [300, 500], bellshard: [2, 4], blacksalt: [3, 6], bone: [6, 10] }, rare: [['plate_chest', .4]] } });
Object.assign(MON.wisp, { magic: 4 }); MON.lich_lord.ranged2.magic = 6;   // the wisp's fire and the Lich Lord's bolt are spells (circles 4 and 6) for Resisting Spells
const SPAWNS = [
  { type: 'rat', x: 80, y: 246, r: 18, max: 5 }, { type: 'rat', x: 80, y: 356, r: 18, max: 5 }, { type: 'rat', x: 150, y: 300, r: 16, max: 4 },
  { type: 'boar', x: 215, y: 300, r: 42, max: 9 }, { type: 'boar', x: 290, y: 250, r: 40, max: 7 }, { type: 'boar', x: 300, y: 350, r: 36, max: 6 },
  { type: 'snapper', x: 455, y: 345, r: 26, max: 5 }, { type: 'spider', x: 505, y: 255, r: 26, max: 5 }, { type: 'wisp', x: 440, y: 300, r: 30, max: 4 },
  { type: 'smuggler', x: 232, y: 284, r: 7, max: 2 }, { type: 'smuggler', x: 318, y: 308, r: 7, max: 2 }, { type: 'smuggler', x: 395, y: 282, r: 7, max: 2 },
  { type: 'hound', x: 420, y: 330, r: 34, max: 7, pack: 2 }, { type: 'hound', x: 440, y: 250, r: 34, max: 7, pack: 2 }, { type: 'hound', x: 520, y: 320, r: 30, max: 5, pack: 3 }];
for (const s of SPAWNS) { s.n = 0; s.next = 0; }
const $ = s => document.querySelector(s);
let ONW = null;   /* online world session (src/online.js): set while playing online; the offline game never sets it */
let R = Math.random; const rnd = (a, b) => a + Math.floor(R() * (b - a + 1)), pick = a => a[Math.floor(R() * a.length)];
const cl = (v, a, b) => v < a ? a : v > b ? b : v;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f1 = v => (v / 10).toFixed(1);
let MOVE_SCALE = 1.5; /* presentation tuning: spec speeds are m/s; this maps them onto the island's tile scale. Player and creatures scale together. */
let GT = 0, P = null, AIM = null, TRACKS = null, NID = 1;
const ents = [], FX = [], EFX = [], LOG = [], SKLOG = [];
const JOY = { on: false, x0: 0, y0: 0, x: 0, y: 0, sprint: false };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sv = k => SF.SK.value(P, k);            // displayed skill (real + a small stat lift): what every check uses
const svReal = k => SF.SK.base(P, k);        // real skill: prerequisites, trainers, the 700 cap
/* ---------- Living World Phase 1: every actor has a stable id, an archetype and a controller (src/world.js, docs/WORLD_SIMULATION_PROGRESS.md) ----------
   WS is this world's SIM state, made at boot. Corpses and piles are world objects, not actors. Species classes are data; an unlisted creature is a monster. */
let WS = null;
const SPECIES_CLASS = { rat: 'animal', boar: 'animal', hound: 'animal', snapper: 'animal', wreckcrab: 'animal', spider: 'animal', giant_spider: 'animal', dire_wolf: 'animal', smuggler: 'criminal' };
const MERCHANT_ROLES = { banker: 1, campbank: 1 };
function archetypeOf(e) {
  if (e === P) return 'player';
  switch (e.kind) {
    case 'npc': return e.role === 'guard' ? 'guard' : e.role === 'adventurer' ? 'adventurer' : MERCHANT_ROLES[e.role] || SHOPS[e.role] ? 'merchant' : 'civilian';
    case 'ally': return 'hireling';
    case 'pet': return e.summon || !e.type ? 'summon' : 'pet';
    case 'mon': return SPECIES_CLASS[e.type] || 'monster';
  }
  return null;
}
function idKey(e, a) {
  if (a === 'player') return { id: 'player:' + (e.id || 'p1') };
  if (a === 'hireling') return { prefix: 'npc', name: e.aid || e.name };
  if (e.kind === 'npc') return { prefix: 'npc', name: e.name };
  if (e.restoreId) return { id: e.restoreId, prefix: 'mon:' + (e.type || 'x') };   // a saved creature keeps its id (phase 6)
  const prefix = (e.kind === 'pet' ? (a === 'summon' ? 'summon' : 'pet') : 'mon') + ':' + (e.type || 'x');
  if (e.kind === 'pet' && e.savedAid) { const id = e.savedAid; delete e.savedAid; return { id, prefix }; }   // a loaded pet keeps its actor id (v0.33.1); a taken id falls back to a new one
  return { prefix };
}
/* give an entity its id and controller; re-derive the controller when it changes kind (a tamed creature keeps its id) */
function simAdopt(e) {
  if (!WS || !e || e.gone) return null; const a = archetypeOf(e); if (!a) return null;
  if (!e.actorId) { WS.adopt(e, a, idKey(e, a)); simEmit('ActorSpawned', { actor: e.actorId, archetype: a, species: e.type || e.role || null, x: e.x, y: e.y }); }
  else if (e.archetype !== a) { e.archetype = a; e.ctrl = SIM.controllerFor(a); }
  return e.ctrl;
}
function simEmit(type, d) { if (!WS) return null; try { return WS.bus.emit(type, d); } catch (err) { console.error(err); return null; } }
const aidOf = e => e ? e === P ? (P.actorId || 'player') : e.actorId || null : null;
const addEnt = o => { o.id = NID++; o.speed = 0; ents.push(o); simAdopt(o); return o; };
const rmEnt = e => { const i = ents.indexOf(e); if (i >= 0) ents.splice(i, 1); e.gone = true; if (e._gk !== undefined) ECOS.grid.remove(e); if (e.kind === 'mon' && e.sp && !e.dead) ecoLeft(e); if (WS && e.actorId && WS.reg.get(e.actorId) === e) { WS.drop(e); simEmit('ActorRemoved', { actor: e.actorId, dead: !!e.dead }); } };
const alive = e => e && !e.gone && !e.dead;
/* people carry their notoriety colour (src/law.js) */
function relColor(e) { if (e === P || e.kind === 'npc') return notoColor(e); if (e.kind === 'pet' || e.kind === 'ally') return '#5aa8ff'; if (e.kind === 'mon') return MON[e.type].boss ? '#ff9a40' : '#c0c0c0'; return '#d8d0c0'; }

/* ---------- log ---------- */
function log(t, c, kind) { LOG.push({ t, c: c || '#e8e2d2', at: GT, kind: kind || 'sys' }); if (LOG.length > 300) LOG.shift(); renderLog(); }
function floater(x, y, t, c) { FX.push({ k: 'txt', x, y, t, c, t0: GT, dur: 1.1 }); }
function say(e, t) { e.say = { t, until: GT + 3 }; }
/* ---------- skill checks (src/skills.js, SF.SK): every use goes through one of these and lands in the skill log ---------- */
const STAT_NAME = { str: 'Strength', dex: 'Dexterity', int: 'Intelligence' };
function noteLearn(key, r) {
  if (!r) return r;
  SKLOG.push({ k: key, at: GT, r: r.gained ? `+${f1(r.amount)} → ${f1(P.skills[key].v)}` + (r.lowered ? ` (−${f1(r.amount)} ${SF.SKILL[r.lowered].n})` : '') : r.reason || '' }); if (SKLOG.length > 80) SKLOG.shift();
  if (r.gained) { log(`${SF.SKILL[key].n} +${f1(r.amount)} (${f1(P.skills[key].v)})`, '#7fd4ff', 'skill'); if (GT - SND.gainAt > 1.5) { SND.gainAt = GT; snd('skill.gain'); } }
  if (r.stat && P.base && typeof recomputeStats === 'function') recomputeStats();
  if (r.stat) { log(`Your ${STAT_NAME[r.stat.stat]} rises to ${r.stat.value}.` + (r.stat.lowered ? ` Your ${STAT_NAME[r.stat.lowered]} falls to ${(P.base || P)[r.stat.lowered]} (it is set to Lower, and 225 is the most anyone can hold).` : ''), '#ffe08a', 'skill');
    simEmit('StatChanged', { actor: aidOf(P), stat: r.stat.stat, value: r.stat.value, lowered: r.stat.lowered || null, skill: key });
    if (r.stat.lowered === 'str') strDropped(); eqChanged(); }
  return r;
}
/* a Strength point given up at the 225 cap can leave worn gear above the requirement: it goes back to the backpack, never dropped */
function strDropped() { for (const sl of SF.EQ.SLOT_IDS) { const it = P.equip[sl]; if (it && SF.EQ.strReq(it) > P.str && unequipTo(sl)) log(`${iname(it)} is too heavy for your Strength now; you put it in your backpack.`, '#ffb070'); } }
const skCtx = ctx => Object.assign({ rng: R, now: GT, stats: P.base || P, locks: P.statLocks }, ctx || {});   // stat gains land on the unbuffed stats (src/magic.js keeps buffs on top)
/* a use checked against a difficulty window [min, max] in skill points: returns whether it succeeded; teaches when it was a challenge */
function skillCheck(key, min, max, ctx) { const r = SF.SK.check(P, key, min, max, skCtx(ctx)); noteLearn(key, r.learn); return r.success; }
/* the action rolled its own success with chance `chance`; teach from it (optionally only inside a window) */
function skillUse(key, chance, success, ctx, win) { return noteLearn(key, SF.SK.use(P, key, chance, success, skCtx(ctx), win)); }
/* interim shape for uses reworked in later phases: a difficulty d teaches across d − 50 … d + 50 */
function gain(key, diff, ctx) { const v = sv(key), ch = SF.SK.windowChance(v, diff - 50, diff + 50); return skillUse(key, ch, true, ctx); }

/* ---------- sound: src/audio.js (SFXA) plays the sound pack; this section decides what plays and where ---------- */
let AC = null, muted = false;   // AC is SFXA's shared AudioContext once a gesture unlocks it; muted persists in SETTINGS
const SND = { gainAt: -9, hurtAt: -9, stepAcc: 0, zone: null, ambNext: 0, ambPos: null, grp: {}, musWant: undefined, musAt: 0, musFirst: 0 };
const snd = (ev, o) => SFXA.play(ev, o);                                                     // UI and the player's own sounds: centred
const sndAt = (ev, at, o) => SFXA.play(ev, Object.assign({ pos: { x: at.x, y: at.y }, ent: at.kind ? at : null, key: at.id }, o || {}));
const sndOnce = (k, cd) => { if (GT < (SND.grp[k] || 0)) return false; SND.grp[k] = GT + cd; return true; };   // group cooldown
/* a world sound is heard only near the player, never from hidden foes, other levels or rooms out of sight */
SFXA.where = (p, e) => {
  if (!P) return null; const d = Math.hypot(p.x - P.x, p.y - P.y);
  if (e && e !== P && e.hidden) return null;
  const lv = levelAt(Math.floor(P.x), Math.floor(P.y)); if (lv !== levelAt(Math.floor(p.x), Math.floor(p.y))) return null;
  if (d > 5 && (lv || (e && e.kind === 'mon')) && !los(P, p)) return null;
  const sx = (SX(p.x, p.y) - SX(P.x, P.y)) / CAM.f; let pan = cl(sx / Math.max(160, VW * .5), -1, 1) * .85; if (d < 2) pan *= d / 2;
  return { d, pan };
};
SFXA.onUnlock(ctx => { AC = ctx; SFXA.warm(['step.stone', 'step.wood', 'step.grass', 'step.dirt', 'step.sand', 'swing.sword', 'swing.dagger', 'swing.glaive', 'swing.hammer', 'swing.unarmed', 'hit.flesh', 'hit.bone', 'door.wood.open', 'door.wood.close', 'rat.alert', 'rat.attack', 'rat.death', 'skeleton.alert', 'skeleton.attack', 'skeleton.death']); });
const ARMORED = { snapper: 1, wreckcrab: 1, sentinel: 1, bellkeeper: 1, captain: 1 };   // shell or plate
const CRE = { rat: 'rat', skeleton: 'skeleton', hound: 'hound', boar: 'boar', wreckcrab: 'crab', snapper: 'crab', spider: 'spider', wisp: 'wisp' };
function hurtVoice(g) { if (GT - SND.hurtAt < .8) return; SND.hurtAt = GT; snd('player.hurt', { gain: g }); }
/* one impact owner for every blow: hx = { w: weapon, area, quiet, blocked } */
function hitSound(t, kind, src, hx, lethal) {
  hx = hx || {}; const me = t === P;
  if (kind === 'spell') { if (me && !lethal) hurtVoice(.8); return; }   // spells sound at their own effect
  if (kind === 'poison') { if (me && !lethal) hurtVoice(.45); return; }  // a tick is not a blow
  if (!hx.quiet && !hx.area) {
    let ev = 'hit.flesh';
    if (hx.blocked) ev = 'block.shield';
    else if (me) ev = metalTorso(P) ? 'hit.armor' : 'hit.flesh';
    else if (t.type === 'skeleton') ev = 'hit.bone';
    else if (ARMORED[t.type]) ev = 'hit.armor';
    else if (hx.w && (hx.w.fam === 'Hammer' || hx.w.fam === 'Unarmed')) ev = 'hit.blunt';
    if (me) snd(ev, { key: 'impP' }); else sndAt(ev, t, { key: 'imp' + t.id });
  }
  if (me && !lethal) hurtVoice(hx.area ? .8 : 1);
}
function swingSound(s) {
  const fam = s.w.fam; if (s.w.ammo) return;   // bows sound at release
  s.snd = snd('swing.' + fam.toLowerCase(), { key: 'P', peakIn: s.t1 - GT, late: .05, valid: () => P.swing === s || s.resolved });
}
/* creature cues: alert on entering aggro on the player, attack-specific wind-up on the telegraph */
function monSound(m, s0) {
  const sp = CRE[m.type], s = m.state, d = MON[m.type];
  if ((s0 === 'idle' || s0 === 'return') && (s === 'chase' || s === 'tele') && m.target === P && sp && SFXA.has(sp + '.alert')) sndAt(sp + '.alert', m);
  if (s === 'tele' && s0 !== 'tele') { const ev = d.boss && m.mode === 'aoe' ? 'boss.bell' : m.mode !== 'r2' && sp && SFXA.has(sp + '.attack') ? sp + '.attack' : 'combat.warn'; sndAt(ev, m); }
}
function surfaceStep(px, py) {
  const x = Math.floor(px), y = Math.floor(py), t = tAt(x, y);
  if (t === T.BR) return 'step.wood';                                    // timber boardwalk over water
  const b = insideBuildTile(x, y); if (b && b.floor) return b.floor === 'floor_timber' ? 'step.wood' : 'step.stone';
  if (t === T.FL) return 'step.wood'; if (t === T.CF || t === T.SD || t === T.SU) return 'step.stone';
  const g = envGroundId(t, x, y, 0) || '';
  return /shallow|water/.test(g) ? 'step.water' : /cobble/.test(g) ? 'step.stone' : /sand/.test(g) ? 'step.sand' : /mud/.test(g) ? 'step.mud' : /dirt/.test(g) ? 'step.dirt' : 'step.grass';
}
/* footfalls follow the Walk clip: two per 8-frame cycle at its speed-scaled frame rate (presentation only, not stepBudget) */
function stepSound(m) {
  if (P.ghost) { SND.stepAcc = 0; return; }
  const sp = Math.max(.5, P.speed), stride = sp * 4 / (12 * Math.min(1.4, Math.max(.7, sp / 5)));
  SND.stepAcc += m; if (SND.stepAcc < stride) return; SND.stepAcc %= stride;
  snd(surfaceStep(P.x, P.y), { key: 'P', gain: P.hidden ? .4 : 1 });
}
const CRAFT_SND = { tailoring: 'craft.stitch', carpentry: 'craft.saw', bowcraft: 'craft.fletch', alchemy: 'craft.alchemy', cooking: 'craft.cook', tinkering: 'craft.tinker', inscription: 'craft.stitch', cartography: 'craft.stitch' };
function craftSound(r, ok) { if (!sndOnce('craft', .5)) return; snd(!ok ? 'craft.fail' : recipeCat(r) === 'Smelt' ? 'craft.smelt' : CRAFT_SND[r.skill] || (r.station === 'anvil' ? 'craft.smith' : 'craft.saw')); }
/* spell effects sound at the target or ground point: by spell where it has a clear voice, else by effect, else magic.release */
const SPELL_SND = { mend: 'magic.heal', gmend: 'magic.heal', cleanse: 'magic.heal', stoneveil: 'magic.ward', step: 'magic.blink', lantern: 'magic.blink', siltbind: 'magic.root', venom: 'magic.poison', hex: 'magic.hex', unweave: 'magic.dispel', reedling: 'magic.summon', ember: 'magic.fire', cinderseal: 'magic.fire', bellfire: 'magic.fire', saltstorm: 'magic.storm', tidelance: 'magic.frost',
  'magery.18': 'magic.fire', 'magery.28': 'magic.fire', 'magery.51': 'magic.fire', 'magery.30': 'magic.storm', 'magery.49': 'magic.storm', 'magery.55': 'magic.storm', 'magery.43': 'combat.blast', 'magery.37': 'magic.hex', 'magery.23': 'door.unlock', 'magery.14': 'magic.dispel', 'magery.24': 'magic.ward', 'magery.50': 'magic.ward' };
const EFFECT_SND = { heal: 'magic.heal', armor_boon: 'magic.ward', area_armor_boon: 'magic.ward', melee_ward: 'magic.ward', spell_ward: 'magic.ward', movement: 'magic.blink', travel: 'magic.blink', control: 'magic.root', control_field: 'magic.root', poison: 'magic.poison', poison_field: 'magic.poison', stat_penalty: 'magic.hex', stat_penalty_area: 'magic.hex', dispel: 'magic.dispel', area_dispel: 'magic.dispel', field_removal: 'magic.dispel', summon: 'magic.summon' };
const DELIVERED = { direct: 1, delayed_hit: 1, conditional_hit: 1, poison: 1, shared_damage: 1, area_percent_hit: 1, cleanse: 1, area_cleanse: 1 };   // these sound where and when they land
const spellSnd = (sp, at) => sndAt(SPELL_SND[sp.id] || EFFECT_SND[sp.effect] || 'magic.release', at, { key: 'spell' });
/* soundtrack by area (assets/music/v1.0.0): the town, the shore, the open road, the marsh, the ruins.
   A new area's track starts after a few seconds there, so walking along a border does not flip it back and forth. */
const ZONE_MUSIC = { quay: '01-saltmarsh-home', homes: '01-saltmarsh-home', beacon: '02-lanterns-on-the-quay', safe: '05-beyond-the-tidegate', roads: '05-beyond-the-tidegate', cross: '05-beyond-the-tidegate', pine: '05-beyond-the-tidegate',
  ford: '03-mist-on-the-causeway', silt: '03-mist-on-the-causeway', ashfen: '03-mist-on-the-causeway', camp: '03-mist-on-the-causeway', wreck: '03-mist-on-the-causeway',
  bell: '04-the-empty-watch', bell1: '04-the-empty-watch', bell2: '04-the-empty-watch', bell3: '04-the-empty-watch' };
Object.assign(ZONE_MUSIC, ANN_ZONE_MUSIC);
function musicTick(z) {
  const want = P.ghost ? null : ZONE_MUSIC[z] || null;
  if (want !== SND.musWant) { SND.musWant = want; SND.musAt = GT + (SFXA.musicNow || SND.musFirst ? 3 : 0); SND.musFirst = 1; }
  if (GT >= SND.musAt) SFXA.music(SND.musWant);
}
/* per frame: drop cancelled scheduled sounds, clear stale ones on a zone change, schedule sparse ambience */
function sndTick() {
  SFXA.tick(); if (!P) return;
  const x = Math.floor(P.x), y = Math.floor(P.y), z = zoneAt(x, y);
  musicTick(z);
  if (z !== SND.zone) { if (SND.zone !== null) SFXA.cancelPending(); SND.zone = z; SND.ambNext = GT + 2; }
  if (GT < SND.ambNext || !AC) return; const r = SFXA.rand; SND.ambNext = GT + 4 + r() * 6;
  const near = (test, rad) => { for (let k = 0; k < 28; k++) { const a = r() * 6.283, d = 3 + r() * rad, tx = Math.floor(P.x + Math.cos(a) * d), ty = Math.floor(P.y + Math.sin(a) * d); if (test(tAt(tx, ty), tx, ty)) return { x: tx + .5, y: ty + .5 }; } return null; };
  const still = SND.ambPos && Math.hypot(P.x - SND.ambPos.x, P.y - SND.ambPos.y) < 4, opts = [], lv = levelAt(x, y);
  if (lv) { const p = near(t => t === T.CF, 12); if (p) opts.push(['world.drip', p, 3]); }
  else {
    const fire = STATIONS.find(s => (s.k === 'fire' || s.k === 'forge') && Math.hypot(s.x + .5 - P.x, s.y + .5 - P.y) < 7); if (fire) opts.push(['world.hearth', { x: fire.x + .5, y: fire.y + .5 }, 4]);
    const wa = near(t => t === T.WA, 13); if (wa) { opts.push(['world.surf', wa, 2]); if (z === 'quay' || z === 'beacon' || z === 'wreck') opts.push(['world.gull', { x: wa.x + (r() - .5) * 6, y: wa.y + (r() - .5) * 6 }, 1]); }
    if (z === 'ashfen' || z === 'silt' || z === 'ford' || z === 'camp') { const m = near(t => t === T.SH || t === T.RB || t === T.MR, 10); if (m) opts.push(['world.marsh', m, 2]); }
    if (z === 'beacon' || z === 'pine') opts.push(['world.wind', { x: P.x + (r() - .5) * 8, y: P.y + (r() - .5) * 8 }, 1]);
    if (z === 'bell' && !still) opts.push(['world.bell', { x: ZONES.bell.cx + .5, y: ZONES.bell.cy + .5 }, 1, 1]);   // landmark: not again while you stand still
  }
  if (!opts.length) return; let tot = 0; for (const o of opts) tot += o[2]; let k = r() * tot, o = opts[0]; for (const c of opts) { k -= c[2]; if (k <= 0) { o = c; break; } }
  if (SFXA.play(o[0], { pos: o[1], amb: true, key: 'amb' }) && o[3]) SND.ambPos = { x: P.x, y: P.y };
}

/* ---------- player ---------- */
/* newChar(o): the player object. A new character comes from a validated creation (SF.CREATION.validate → value): its skill
   points become tenths once (SF.CREATION.progression), every other skill starts at 0.0, every lock at Raise. A loaded character
   passes skills: {} and its saved fields are laid over this. */
function newChar(o) {
  const c = { kind: 'player', pid: 'p1', name: o.name, x: 92.5, y: 304.5, sect: 0, str: o.str, dex: o.dex, int: o.int, skills: SF.newSkills(), pack: SF.newContainer('pack', 'p1'), bank: SF.newContainer('bank', 'p1'), equip: emptyEquip(), eqMig: SF.EQ.MIGRATION, look: o.look || {}, bound: 'quay', freeLessons: 0, hotbar: [null, null, null, null], sw: SF.newSwing(), combatMig: SF.COMBAT_MIGRATION, t2aMig: SF.SK.MIGRATION };
  c.id = 'p1'; Object.assign(c, SF.CREATION.progression({ str: o.str, dex: o.dex, int: o.int, skills: o.skills || {} }, (Math.random() * 4294967296) >>> 0));
  c.hp = SF.maxHp(c); c.stam = SF.maxStam(c); c.mana = SF.maxMana(c); return c;
}
/* the starter kit (SF.CREATION.kit / applyKit): granted once, only for a committed new character */
function starterKit(v) {
  const r = SF.CREATION.applyKit(P, SF.CREATION.kit(v)); for (const n of SF.CREATION.kit(v).notes) log(n, '#ffb070');
  if (!r.ok) console.warn('starter kit over the light load', r);
}
/* equipment and weight (src/equipment.js, SF.EQ). Weight is shown in weight units (SF.WU per authored kg); worn gear counts. */
const emptyEquip = () => { const e = {}; for (const s of SF.EQ.SLOT_IDS) e[s] = null; return e; };
const cap = () => SF.EQ.capFor(P);
const carryWt = () => SF.EQ.totalWt(P);
const encumb = () => SF.EQ.encumbrance(P);
const overweight = () => encumb().ratio > 1 + 1e-9;
const metalTorso = a => { const it = a.equip && (a.equip.chest || a.equip.robe); const d = it && SF.ITEMS[it.id]; return !!(d && d.fam && ['ringmail', 'chain', 'plate', 'dragon'].includes(d.fam)); };
const fmtWt = v => (Math.round(v * 10) / 10).toFixed(1);
/* the one carried-weight line every panel shows: everything carried and worn against the carrying limit, in weight units */
const carriedText = () => { const en = encumb(); return `${fmtWt(en.wt)} / ${fmtWt(en.cap)} weight`; };
function wear(it, amt, quiet) { if (!it || !SF.WEARABLE(it.id)) return; if (it.cond === undefined) { it.cond = 100; it.maxc = 100; } const before = it.cond; it.cond = Math.max(0, it.cond - amt); if (quiet) return; const lim = .2 * (it.maxc || 100); if (before >= lim && it.cond < lim) log(SF.itemName(it) + ' is badly worn (−15%). Repair it soon.', '#ffb070'); if (before > 0 && it.cond <= 0) log(SF.itemName(it) + ' has broken and gives no benefit.', '#ff6a5a'); }
const inCombat = () => GT - (P.lastCombat || -99) < 6;
function give(id, q, extra) { const r = SF.addItem(P.pack, SF.newItem(id, q, extra), cap()); if (!r.ok) { log('Your pack is full: ' + r.reason + '. ' + SF.ITEMS[id].n + ' left on the ground.', '#ffb070'); dropPile(SF.newItem(id, q, extra)); } return r.ok; }
function dropPile(it) { let c = ents.find(e => e.kind === 'corpse' && e.pile && Math.hypot(e.x - P.x, e.y - P.y) < 1); if (!c) { const cont = SF.newContainer('pile'); c = addEnt({ kind: 'corpse', pile: true, name: 'dropped items', x: P.x, y: P.y, cont, expires: GT + 600 }); } c.cont.items.push(it); }

/* ---------- movement ---------- */
/* trees, rock faces and shrubs block only at the trunk or boulder (v0.20), so a walker can thread a wood or a rock field */
const SOFT = new Float32Array(64);
function canStand(e, x, y) { const r = .26; if (colBlocked(x, y, r)) return false; if (FIELDS.length && fieldBlocks(x, y)) return false; for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) { const t = tAt(Math.floor(x + ox), Math.floor(y + oy)); if (BLK[t] && !SOFT[t]) return false; }
  const fx = Math.floor(x), fy = Math.floor(y); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const h = SOFT[tAt(fx + dx, fy + dy)]; if (h && Math.abs(x - fx - dx - .5) < h + r && Math.abs(y - fy - dy - .5) < h + r) return false; }
  if (e.kind === 'mon' && !e.quest && protAt(x, y)) return false; return true; }
function moveBy(e, dx, dy) { let moved = 0; if (canStand(e, e.x + dx, e.y)) { e.x += dx; moved += Math.abs(dx); } if (canStand(e, e.x, e.y + dy)) { e.y += dy; moved += Math.abs(dy); } return moved; }
function los(a, b) { const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / .25); for (let i = 1; i < n; i++) { const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n; if (LOSB[tAt(Math.floor(x), Math.floor(y))]) return false; if (FIELDS.length && fieldBlocksSight(x, y)) return false; for (const f of EFX) if (f.k === 'cloud' && Math.hypot(x - f.x, y - f.y) < f.r && !(Math.hypot(a.x - f.x, a.y - f.y) < f.r && Math.hypot(b.x - f.x, b.y - f.y) < f.r)) return false; } return true; }
function moveIntent() {
  let vx = 0, vy = 0, want = 0;
  if (JOY.on && !P.dead) { const jx = JOY.x - JOY.x0, jy = JOY.y - JOY.y0, m = Math.hypot(jx, jy); if (m > 10) { const tx = jx / HW + jy / HH, ty = jy / HH - jx / HW, tm = Math.hypot(tx, ty); vx = tx / tm; vy = ty / tm; want = Math.min(1, m / 56); JOY.sprint = !!P.sprintOn || (SETTINGS.stickSprint && m > 70); } }
  else if (KEYS.any) { const sx = (KEYS.r ? 1 : 0) - (KEYS.l ? 1 : 0), sy = (KEYS.d ? 1 : 0) - (KEYS.u ? 1 : 0); if (sx || sy) { const tx = sx / HW + sy / HH, ty = sy / HH - sx / HW, tm = Math.hypot(tx, ty); vx = tx / tm; vy = ty / tm; want = 1; JOY.sprint = !!KEYS.shift || !!P.sprintOn; } }
  return { vx, vy, want, sprint: JOY.sprint && want > 0 && !P.ghost };
}
function playerMove(dt) {
  const mi = moveIntent(), vx = mi.vx, vy = mi.vy, want = mi.want;
  let sprint = mi.sprint;
  const enc = encumb(); if (sprint && (P.stam <= 0 || !enc.run || P.prep)) sprint = false;
  if (enc.speed <= 0 && want > 0 && GT - (P.immobileMsg || -99) > 4) { P.immobileMsg = GT; log('You carry too much to move. Drop something.', '#ffb070'); }
  if (P.hidden && sprint) reveal('You sprint and are revealed.');
  let sp = (sprint ? SF.SPRINT : SF.WALK) * (want > .25 ? 1 : .6) * MOVE_SCALE;
  sp *= (1 - SF.EQ.effective(P).spd) * enc.speed;
  if (tAt(Math.floor(P.x), Math.floor(P.y)) === T.SH) sp *= .8;
  if (P.prep && P.prep.sp.walk) sp = Math.min(sp, SF.WALK * MOVE_SCALE * P.prep.sp.walk);
  if (P.rooted > GT) sp = 0; if (P.slowUntil > GT) sp *= 1 - SF.TRAP.slow;
  if (P.opening) sp = 0;
  const dx = vx * sp * dt, dy = vy * sp * dt; const moved = (dx || dy) ? moveBy(P, dx, dy) : 0;
  P.speed = moved / Math.max(dt, 1e-6); updateFacing(P, vx * want, vy * want);
  if (sprint && moved > 0) { P.stam = Math.max(0, P.stam - SF.SPRINT_DRAIN * enc.stam * dt); P.lastDrain = GT; if (P.stam <= 0 && P.sprintOn) { P.sprintOn = false; log('Out of stamina. Sprint off.', '#ffb070'); } }
  if (moved > 0) onPlayerMoved(moved);
}
function onPlayerMoved(m) {
  stepSound(m);
  P.movedAt = GT;                                                                     // archery: the shot needs SF.ARCHERY.aim s standing still
  if (P.meditating) { P.meditating = null; log('You stop meditating.'); }
  if (P.prep && !P.prep.sp.walk && Math.hypot(P.x - P.prep.x0, P.y - P.prep.y0) > SF.PREP_DRIFT) interruptPrep('You moved and lost your spell preparation.');
  if (P.task && P.task.still && Math.hypot(P.x - P.task.x0, P.y - P.task.y0) > .5) { log(P.task.label + ' interrupted by movement.'); P.task = null; }
  if (P.hidden) { P.stepAcc = (P.stepAcc || 0) + m; while (P.stepAcc >= SF.SK.STEALTH.stepLen) { P.stepAcc -= SF.SK.STEALTH.stepLen; P.stepBudget--; if (P.stepBudget < 0) { reveal(P.stealthUsed ? 'You run out of quiet steps and are revealed.' : 'You move and are revealed. (Stealth lets a hidden thief walk.)'); break; } } }
  if (P.lootOpen && dist(P.lootOpen, P) > 3) { closePanel(); P.lootOpen = null; }
  if (P.batch && Math.hypot(P.x - P.batch.x0, P.y - P.batch.y0) > .5) stopBatch('You moved; the batch stops.');
  if (PANEL === 'craft' && CUI && Math.hypot(P.x - CUI.x0, P.y - CUI.y0) > .5) closePanel();
}

/* ---------- damage & death ---------- */
function damagePlayer(amt, src, kind, hx) {
  if (P.ghost || amt <= 0) return; P.lastCombat = GT; P.lastHit = GT;
  if (P.veil && P.veil.until > GT && kind === 'phys') { const a = Math.min(P.veil.left, amt.raw || 0); P.veil.left -= a; }
  P.hp -= amt; simEmit('ActorDamaged', { actor: aidOf(P), source: aidOf(src), amount: amt, kind: kind || 'phys', x: P.x, y: P.y }); floater(P.x, P.y, '-' + amt, '#ff6a5a'); hitSound(P, kind, src, hx, P.hp <= 0);
  if (P.prep) interruptPrep(kind === 'poison' ? 'Poison breaks your concentration.' : 'Your preparation is interrupted!');
  if (P.rooted > GT) P.rooted = 0;
  if (P.bandage && kind !== 'poison') slipBandage(src);                               // a blow makes the healer's fingers slip; the timer runs on
  if (P.task && P.task.kind === 'vet' && kind !== 'poison') { P.task.t1 += .25; }
  else if (P.task && P.task.kind !== 'vet') { log(P.task.label + ' interrupted.'); P.task = null; }
  if (P.meditating) { P.meditating = null; log('Your meditation is broken.'); }
  if (P.batch || PANEL === 'craft') stopBatch(P.batch ? 'Combat stops your work.' : '');
  if (P.hidden && src && dist(src, P) <= 1) reveal('You are discovered!');
  if (P.hp <= 0) playerDies(src);
}
function playerDies(src) {
  if (P.ghost) return;                                                                            // death resolves exactly once
  simEmit('ActorKilled', { actor: aidOf(P), killer: aidOf(src), x: P.x, y: P.y }); lawPlayerDied(src);   // an unlawful killer can be reported from the ghost window
  P.hp = 0; P.ghost = true; P.ghostAt = GT; P.armed = false; P.sel = null; P.prep = null; P.held = null; P.task = null; if (P.bandage) { P.bandDone = P.bandage.id; P.bandage = null; } P.hidden = false; P.poison = null; P.meditating = null; AIM = null; P.batch = null; if (PANEL === 'craft') closePanel();
  const protectedRoad = protAt(P.x, P.y);
  if (!protectedRoad) { const look = SF.GEAR.snapshot(P), corpse = SF.deathTransaction(P, GT, { x: P.x, y: P.y });   // the look is taken before the items move
  addEnt({ kind: 'corpse', mine: true, name: 'your body', x: P.x, y: P.y, cont: corpse, expires: corpse.expires, gear: look, t0: GT, sect: P.sect || 0 }); }
  for (const e of ents) if (e.target === P) { e.target = null; e.state = 'return'; }
  log(`You have died${src ? ' to a ' + (src.name || 'foe') : ''}. ${protectedRoad ? 'Your belongings stay with you on this protected road.' : 'Your tradeable belongings stay on your body for 12 minutes.'}`, '#ff6a5a'); SFXA.cancelPending(); snd('player.death');
  save(); refreshHud(); renderPanel();
}
function nearestRes() { let best = null, bd = 1e9; for (const s of SHRINES) { const d = Math.hypot(s.x + .5 - P.x, s.y + .5 - P.y); if (d < bd) { bd = d; best = { x: s.x + .5, y: s.y + .5, n: s.n } } } for (const e of ents) if (e.kind === 'npc' && e.role === 'healer') { const d = dist(e, P); if (d < bd) { bd = d; best = { x: e.x, y: e.y, n: 'healer' } } } return best; }
function resurrect(where) {
  if (!P.ghost) return; if (where) { P.x = where.x; P.y = where.y + 1.2; }
  P.ghost = false; P.report = null; P.hp = Math.ceil(SF.maxHp(P) * .25); P.stam = Math.ceil(SF.maxStam(P) * .2); P.mana = Math.ceil(SF.maxMana(P) * .2);
  FX.push({ k: 'ring', x: P.x, y: P.y, c: '#fff2b0', t0: GT, dur: .8 }); log('You are restored to life at 25% health. Your body still holds your belongings.', '#ffe08a'); snd('player.revive'); save(); refreshHud();
}

/* ---------- physical combat: one resolver for every swing and shot (UO Second Age rules, issue #3) ----------
   Touch, keyboard, auto-attack, the ally, pets, summons and creatures all go through swingAt / strikeOne → applyBlow.
   The rules (hit chance, dice, damage stages, swing timer, archery) live in src/rules.js; this block adapts them to actors. */
const isAlly = e => !!e && e.kind === 'ally';
const isPlayerLike = e => e === P || isAlly(e);
const fighterAlive = e => !!e && (e === P ? !P.ghost : isAlly(e) ? !e.ghost && !e.gone : e.kind === 'npc' ? npcUp(e) : alive(e));   // townsfolk fight only with a profile (phase 5) and not while knocked down
const skOf = (a, k) => a === P ? sv(k) : a.skills && a.skills[k] ? a.skills[k].v / 10 : 0;
let SHOTID = 0;
/* creature numbers the T2A rules need: natural armor rating, strength and dexterity (tuning, see docs/combat/STATUS.md) */
function monT2A(d) { if (!d._t2a) d._t2a = { ar: d.ar !== undefined ? d.ar : Math.round((d.armor || 0) * .4), str: d.str || cl(d.hp, 10, 100), dex: d.dex || cl(Math.round((d.speed || 3) * 20), 10, 100) }; return d._t2a; }
function weaponOfActor(a) {
  const it = a.equip && a.equip.weapon; if (!it) return SF.WEAPONS.unarmed;
  if (it.cond !== undefined && it.cond <= 0) return SF.WEAPONS.unarmed;                // a broken weapon fights as fists
  return SF.weaponOf(it) || SF.WEAPONS.unarmed;
}
const wDef = () => weaponOfActor(P);
const weaponLabel = a => { const w = weaponOfActor(a), it = a.equip && a.equip.weapon; return w === SF.WEAPONS.unarmed ? (it ? SF.itemName(it) + ' (broken)' : 'Fists') : SF.itemName(it); };
/* everything a blow needs from one side, read fresh for every swing */
function fighter(a) {
  if (isPlayerLike(a) || npcCombatant(a)) {   // townsfolk fight like Wren: weapon, skills and worn armor (src/npcfight.js)
    const w = weaponOfActor(a), it = w === SF.WEAPONS.unarmed ? null : a.equip.weapon, sh = a.equip.shield;
    // armor is resolved per blow on the struck body region (applyBlow → regionHit); armorAR here is the expected summary for display
    return { a, player: true, w, it, atk: skOf(a, w.skill) + SF.SK.magicAcc(it), def: skOf(a, w.skill), tactics: skOf(a, 'tactics'), anatomy: skOf(a, 'anatomy'), str: a.str,
      armorAR: Math.round(SF.EQ.effective(a).ar) + magicArmor(a), armorItem: null, regions: true,
      shieldAR: sh && SF.ITEMS[sh.id].slot === 'shield' ? Math.round(SF.EQ.shieldAR(sh)) : 0, shieldItem: sh, parry: skOf(a, 'parrying'), braced: a.braced > GT,
      diff: Math.max(10, Math.round(skOf(a, w.skill))) };
  }
  if (a.summon) { const s = a.summon; return { a, player: false, w: { id: 'summon', reach: (s.melee && s.melee[3]) || 1.3 }, atk: ACC, def: 30, range: s.melee ? [s.melee[0], s.melee[1]] : [1, 2], scale: 1, armorAR: 0, shieldAR: 0, diff: 40 }; }
  const d = MON[a.type] || { def: 30, atk: 50, armor: 10, dmg: [4, 7], reach: 1.1, diff: 30, hp: 30 }, x = monT2A(d);
  return { a, player: false, w: { id: 'natural', reach: d.reach }, atk: (d.atk || 40) + (a.kind === 'mon' ? monAcc(a) : 0), def: d.def || 30, range: d.dmg, scale: 1,
    armorAR: Math.round(x.ar * (a.discordUntil > GT ? 1 - SF.BARD.discord : 1)) + magicArmor(a), shieldAR: 0, diff: d.diff || 30 };
}
const armorVal = () => fighter(P).armorAR;
const defRating = () => sv(wDef().skill);
function stamOf(a) { return a === P || isAlly(a) ? a.stam : a.stam !== undefined ? a.stam : monT2A(MON[a.type] || {}).dex; }
function drainStam(a, n) { if (a === P || isAlly(a)) a.stam = Math.max(0, a.stam - n); else if (a.type) { const x = monT2A(MON[a.type]); a.stam = Math.max(0, (a.stam !== undefined ? a.stam : x.dex) - n); } }
/* legality is checked before anything is spent: a bad target, range or sight never costs a swing or an arrow */
function legalAttack(a, t, w) {
  if (!fighterAlive(a)) return 'You cannot fight now.'; if (!fighterAlive(t) || t === a) return 'No valid target.';
  if (t.hidden && t !== P) return 'You cannot see it.';
  if (dist(a, t) > w.reach + .05) return 'Out of reach.'; if (!los(a, t)) return 'No line of sight.';
  return null;
}
function provoke(t, a) { if (t.kind !== 'mon' || !alive(t)) return; t.lastHitBy = a; if (!t.target) { t.target = a; if (t.state === 'idle') t.state = 'chase'; } t.hidden = false; }
function missFx(t, a) { floater(t.x, t.y, t === P ? 'dodge' : 'miss', '#c8c8c8'); }   // a whiff: the swing sound alone
/* sound for a swing or a release, at the attacker; misses get this alone, impacts come from hitSound */
function swingSound(a, w) {
  const ev = w.ammo ? (w.ammo === 'bolt' ? 'crossbow.release' : 'bow.release') : 'swing.' + (w.fam || 'Unarmed').toLowerCase();
  if (!SFXA.has(ev)) return; if (a === P) snd(ev, { key: 'P' }); else sndAt(ev, a, { key: 'sw' + a.id });
}
/* a blow that does no harm still makes a sound: a shield parry or armor that takes it all */
function noHarmSound(t, parried) { const ev = parried ? 'block.shield' : 'hit.armor'; if (t === P) snd(ev, { gain: .5, key: 'impP' }); else sndAt(ev, t, { gain: .5, key: 'imp' + t.id }); }
const wardSound = t => { if (sndOnce('veil' + (t.id || 'P'), .6)) { if (t === P) snd('magic.ward', { gain: .6 }); else sndAt('magic.ward', t, { gain: .6 }); } };
/* the shared damage entry: a swing, a shot, a spell or a creature's blow reaches any actor (player, hireling, creature, pet) through here */
function damageActor(t, amt, kind, src, hx) { if (t === P) return damagePlayer(amt, src === P ? null : src, kind, hx); if (isAlly(t)) return damageAlly(t, amt, src, kind, hx); if (t && t.kind === 'npc') return damageNpc(t, amt, kind, src, hx); return damageMon(t, amt, kind, src, hx); }
/* one landed blow. A = attacker view (taken at the swing or the release), t = recipient. Returns the stage record. */
function applyBlow(A, t, opt) {
  opt = opt || {}; if (!fighterAlive(t)) return null; const a = A.a, D = fighter(t);
  const raw = SF.rawDamage(A.player ? { dice: A.w.dice, bonus: SF.SK.magicDmg(A.it), quality: A.it && A.it.quality, cond: A.it && A.it.cond, maxc: A.it && A.it.maxc, tactics: A.tactics, anatomy: A.anatomy, str: A.str } : { range: A.range, scale: A.scale }, R);
  let v = raw.value;
  if (!A.player && a.kind === 'mon') { v = monRaw(a, v); if (a.hexUntil > GT) v *= .88; }   // strength hex/boon and Dampening Hex on the striker
  if (t === P && !opt.ranged && a !== P) { v = meleeWard(a, v); if (v <= 0) { wardSound(t); return { raw, final: 0, warded: true }; } }   // Rebounding Armor
  if (t === P && P.veil && P.veil.until > GT && P.veil.left > 0) { const s = Math.min(P.veil.left, v); P.veil.left -= s; v -= s; if (s) floater(P.x, P.y, 'veil ' + Math.round(s), '#c8b890'); if (v <= 0) { wardSound(t); return { raw, final: 0, warded: true }; } }
  if (D.regions) { const rg = SF.EQ.regionArmor(t, SF.EQ.pickRegion(R)); D.armorAR = rg.ar + magicArmor(t); D.armorItem = rg.item; D.region = rg.region; }   // one body region per blow; unprotected regions take it bare
  const m = SF.mitigate(v, { parry: D.parry, braced: D.braced, shieldAR: D.shieldAR, armorAR: D.armorAR, player: D.player, mace: !!(A.w && A.w.mace) }, R); m.region = D.region;
  // side effects, each once: parry check and shield wear, armor wear (mace: half what it absorbed), weapon wear, stamina drain, gains
  if (D.shieldAR > 0) { if (t === P) skillUse('parrying', m.parryChance, m.parried); else if (t.adv) advLearn(t, 'parrying', m.parryChance, m.parried); if (m.parried) { wear(D.shieldItem, .3, t !== P); floater(t.x, t.y, 'parry', '#cfe8ff'); } }
  if (D.armorItem) { if (A.w && A.w.mace) { if (m.armorWear > 0) wear(D.armorItem, m.armorWear, t !== P); } else wear(D.armorItem, .2, t !== P); }   // quiet: only your own gear reports wear in the log
  if (A.w && A.w.mace) drainStam(t, rnd(SF.MACE_STAM[0], SF.MACE_STAM[1]));
  if (a.adv) { advCheck(a, 'tactics'); advCheck(a, 'anatomy'); if (A.it && A.w.hp) wear(A.it, 25 / A.w.hp, true); }
  if (a === P) { skillCheck('tactics', 0, 100); skillCheck('anatomy', 0, 100); if (A.it && A.w.hp) wear(A.it, 25 / A.w.hp);
    const it = A.it; if (it && it.venom && it.venom.charges > 0 && !A.w.ammo) { it.venom.charges--; applyPoison(t, it.venom.tier); if (!it.venom.charges) { delete it.venom; log('The venom on your weapon is spent.'); } } }
  m.raw = raw;
  if (m.final <= 0) { floater(t.x, t.y, m.parried ? 'parried' : 'absorbed', '#c8c8c8'); noHarmSound(t, m.parried); return m; }
  const hx = { w: A.w, area: !!opt.area, blocked: !!m.parried };
  damageActor(t, m.final, 'phys', a, hx);
  if (!A.player && a.kind === 'mon') { const d = MON[a.type]; if (d && d.poison && R() < d.poison[1] && !(t === P && P.poisonImmune > GT)) applyPoison(t, d.poison[0]); }
  return m;
}
/* a ready, legal swing (or bow release) by the player or the ally. Returns false when nothing was spent. */
function swingAt(a, t) {
  const w = weaponOfActor(a); if (!a.sw || !a.sw.ready) return false;
  if (legalAttack(a, t, w)) return false;
  if (w.ammo) {
    if (GT - (a.movedAt || -99) < SF.ARCHERY.aim) return false;                         // stop to aim: the timer ran while moving, the shot waits
    const pack = a.pack; if (!SF.count(pack, w.ammo)) { if (a === P && (!P.ammoWarn || GT > P.ammoWarn)) { P.ammoWarn = GT + 3; log('You have no ' + w.ammo + 's.', '#ffb070'); } return false; }
    SF.removeQty(pack, w.ammo, 1);                                                     // exactly one projectile per release, hit or miss
  }
  if (lawHuman(t)) lawAggress(a, t);                                                   // every swing at a person is an aggression record (src/law.js)
  if (t.adv) advProvoked(t, a);                                                         // an adventurer answers the swing, hit or miss (src/adventurers.js)
  if (a === P && P.hidden) reveal('You attack and are revealed.');
  if (a === P && !P.drawn && !w.ammo && w.fam !== 'Unarmed') snd('weapon.draw', { key: 'Pdraw', gain: .7 });
  SF.swingSpend(a.sw, GT); a.lastCombat = GT; if (a === P) { P.lastCombat = GT; P.drawn = true; P.drawing = 0; }
  faceToward(a, t.x, t.y); const A = fighter(a), D = fighter(t);
  const chance = SF.hitChance(A.atk, D.def), hit = R() < chance;
  if (a === P) skillUse(w.skill, chance, hit);                                            // the hit chance is the challenge: a sure hit teaches nothing
  else if (a.adv) advLearn(a, w.skill, chance, hit);                                     // NPC adventurers learn by the same rule (src/adventurers.js)
  if (a === P) { playOnce((w.fam || 'Unarmed') + '_Attack', 0); P.lunge = .001; } else a.lunge = .001;
  provoke(t, a); swingSound(a, w);
  if (w.ammo) { const s = { id: ++SHOTID, a, t, w, A, hit, x0: a.x, y0: a.y, at: GT + SF.ARCHERY.flight }; a.shots = (a.shots || 0) + 1;
    EFX.push({ k: 'proj', x: a.x, y: a.y, tx: t.x, ty: t.y, t0: GT, t1: s.at, col: '#e8dcc0', at: s.at, fn: () => arrowLands(s) }); return true; }
  FX.push({ k: 'slash', x: t.x, y: t.y, t0: GT, dur: .2 });
  if (hit) applyBlow(A, t); else missFx(t, a);
  return true;
}
/* the arrow lands one second after release: the archer must not have moved, the target must still be alive, in range and in sight */
function arrowLands(s) {
  const a = s.a, t = s.t; a.shots = Math.max(0, (a.shots || 1) - 1);
  if (!fighterAlive(t)) { if (a === P) log('Your target fell before the shot landed.', '#a8a8a8'); return; }
  if (Math.hypot(a.x - s.x0, a.y - s.y0) > SF.ARCHERY.drift) { floater(t.x, t.y, 'wide', '#c8c8c8'); if (a === P) log('You moved while the shot was in the air; it goes wide.', '#a8a8a8'); return; }
  if (dist(a, t) > s.w.reach + .5 || !los(a, t)) { floater(t.x, t.y, 'blocked', '#c8c8c8'); if (a === P) log('Your shot is blocked.', '#a8a8a8'); return; }
  if (!s.hit) return missFx(t, a);
  applyBlow(s.A, t, { ranged: true });
}

/* ---------- player attack (armed basic attack: never moves, never acquires) ---------- */
/* aim assist on an explicit press: nearest living creature that is on screen and in line of sight */
function nearestVisibleEnemy(maxD) {
  let best = null, bd = maxD || 15;
  for (const e of ents) { if (e.kind !== 'mon' || !alive(e) || e.hidden) continue; const d = dist(e, P); if (d >= bd || !los(P, e)) continue;
    const sx = (SX(e.x, e.y) - CAM.x) / CAM.f, sy = (SY(e.x, e.y) - CAM.y) / CAM.f; if (sx < 0 || sy < 0 || sx > VW || sy > VH) continue; bd = d; best = e; }
  return best;
}
/* a selected townsperson stays the target; aim assist only ever picks creatures */
function autoTarget() { if (P.sel && (P.sel.kind === 'mon' && alive(P.sel) || npcUp(P.sel))) return P.sel; const t = nearestVisibleEnemy(); if (t) { P.sel = t; t.nameUntil = GT + 3; } return t; }
function toggleArm() {
  if (P.ghost) return;
  if (P.armed) { P.armed = false; log('Attack disarmed.'); return; }
  const t = autoTarget();
  if (!t) { log('No creature in sight to attack.', '#ffb070'); return; }
  if (t.kind === 'npc' && notoOf(t) === 'innocent' && !LAW.rights(aidOf(P), aidOf(t), GT)) {   // attacking an innocent is a crime: ask once
    if (!(P.armConfirm && P.armConfirm.t === t && GT < P.armConfirm.until)) { P.armConfirm = { t, until: GT + 4 }; log(`Attacking ${t.name.split(',')[0]} is a crime: you will be a criminal and the guards will come. Press Attack again to do it.`, '#ffb070'); return; }
  }
  P.armConfirm = null; P.armed = true; log('Attack armed on ' + t.name + '.');
}
/* presentation-only one-shot clip; simulation timing stays authoritative */
function playOnce(clip, contactIn) { P.once = { clip, t0: GT, tc: GT + (contactIn || 0) }; }
function stowWeapon() { if (!P.drawn) return 0; if (wDef().fam !== 'Unarmed') snd('weapon.stow', { key: 'P' }); P.drawn = false; P.drawing = 0; return SF.SWAP_TIME; }
function weaponChanged() { SF.swingEquip(P.sw, GT, P.stam, wDef()); P.drawn = false; }
function attackTick() {
  SF.swingTick(P.sw, GT, P.stam, wDef());
  if (!P.armed || P.ghost) return; const t = P.sel;
  if (!fighterAlive(t) || (t.kind !== 'mon' && !npcUp(t)) || t.hidden) { P.armed = false; return; }
  if (P.prep || P.opening || P.braced > GT) return;
  swingAt(P, t);
}

function damageMon(m, amt, kind, src, hx) {
  if (isAlly(m)) return damageAlly(m, amt, src, kind, hx);
  if (!alive(m)) return; src = src || P; m.hitT = GT; m.lastHurt = GT; if (m.pacified > GT && src === P) m.pacified = 0;   // an attack breaks Peacemaking and Enticement
  if (m.ward > 0 && kind !== 'poison') { const a = Math.min(m.ward, amt); m.ward -= a; amt -= a; floater(m.x, m.y, 'ward ' + a, '#e8d090'); if (m.ward <= 0) floater(m.x, m.y, 'ward broken', '#e8d090'); if (amt <= 0) { if (sndOnce('ward' + m.id, .6)) sndAt('magic.ward', m, { gain: .6 }); return; } }
  m.hp -= amt; simEmit('ActorDamaged', { actor: aidOf(m), source: aidOf(src), amount: amt, kind: kind || 'phys', x: m.x, y: m.y }); floater(m.x, m.y, String(amt), kind === 'spell' ? '#c8a0ff' : kind === 'poison' ? '#7be07b' : '#ffd27a'); hitSound(m, kind, src, hx, m.hp <= 0); if (src === P || (src && (src.kind === 'pet' || src.kind === 'ally'))) { P.lastCombat = GT; m.pHit = GT; }   // pHit: you had a hand in it, so no adventurer claims the body
  m.pacified = 0; if (m.rooted > GT) m.rooted = 0;
  if (m.hidden) m.hidden = false;
  if (!m.target || m.target === P && src && (src.kind === 'pet' || src.kind === 'ally') && R() < .3 || (m.provoked && m.provoked < GT)) { m.target = src.kind ? src : P; m.chaseKind = 'attack'; m.provoked = 0; m.state = m.state === 'idle' || m.state === 'return' ? 'chase' : m.state; }
  if (m.hp > 0) ecoHurt(m, src);
  if (m.hp <= 0) killMon(m, src);
}

function killMon(m, src) {
  if (m._killed) return; m._killed = true;                                                       // death resolves exactly once: one corpse, one loot roll
  simEmit('ActorKilled', { actor: aidOf(m), killer: aidOf(src), species: m.type || null, x: m.x, y: m.y });
  if (CRE[m.type] && SFXA.has(CRE[m.type] + '.death')) sndAt(CRE[m.type] + '.death', m, { prio: 4 });
  m.dead = true; rmEnt(m); ecoDied(m, src); if (m.sp) m.sp.n--; const d = MON[m.type]; const mine = src === P || (src && (src.kind === 'pet' || src.kind === 'ally'));
  if (m.kind === 'pet') { log((m.name || d.n) + ' has died.', '#ff6a5a'); return; }
  if (m.quest) questCrabKilled();
  const cont = SF.newContainer('corpse'); if (m.pack2) cont.items.push(...m.pack2.items); else for (const k in d.loot) { const q = rnd(d.loot[k][0], d.loot[k][1]); if (q > 0) cont.items.push(lootItem(k, q, 100)); }   // a pack that was snooped or robbed is what the body holds: nothing stolen comes back
  for (const [id, ch] of d.rare || []) if (R() < ch) cont.items.push(magicLoot(lootItem(id, 1, rnd(60, 100)), d.boss ? 5 : 3, d.boss ? 1 : .35));
  if ((d.boss || d.diff >= 75) && R() < (d.boss ? 1 : .15)) cont.items.push(newTreasureMap(d.boss ? 4 + (R() < .5 ? 1 : 0) : 1 + Math.floor(R() * 3)));   // treasure maps from strong foes
  if (m.purse) cont.items.push(SF.newItem('gold', m.purse));
  const corpse = addEnt({ kind: 'corpse', mon: m.type, sect: m.sect || 0, t0: GT, killer: src ? (src === P ? P.name : src.name || (MON[src.type] || {}).n || null) : null, killKind: src && src.kind, name: d.n + ' remains', x: m.x, y: m.y, cont, expires: GT + (d.boss ? 600 : 240), skinned: !d.skin, gear: d.scout ? gearSnapOf(m) : null });
  if (corpse && src && src.adv && !m.pHit) { corpse.advKill = src.actorId; src.adv.rec.kills++; ADV.stats.kills++; }   // its own kill: it may loot it (src/adventurers.js)
  if (corpse && (P.sel === m || src === P) && mine) { P.sel = corpse; if (!P.lootHinted) { P.lootHinted = true; log('Tap the bones (or press Interact) beside them to loot.', '#ffe08a'); } }
  for (const e of ents) if (e.target === m) { e.target = null; if (e.kind === 'mon') e.state = 'return'; }
  if (P.sel === m) { P.sel = mine ? null : corpse; P.armed = false; }
  if (mine) { log((d.boss ? 'You have felled ' : 'You slay the ') + d.n + '.', '#ffe08a'); if (d.boss) { say(P, d.fallLine || 'The bell falls silent.'); } }
  else if (src && src.kind === 'mon' && dist(m, P) < 22) log(`A ${MON[src.type].n} kills a ${d.n}.`, '#b6a68a');
  else if (src && src.kind === 'npc' && dist(m, P) < 22) log(`${(src.name || 'A guard').split(',')[0]} kills the ${d.n}.`, '#b6a68a');   // guards fight back (phase 5)   // creatures fight each other (Living World phase 3)
}

/* ---------- monsters: telegraph → committed strike → recovery ---------- */
function aiMon(m, dt) {
  const d = MON[m.type], pr = ecoP(m.type); m.speed = 0; let t = m.target;
  if (t && (t.gone || t.dead || t.ghost || (t === P && (P.ghost || P.hidden)) || (t.kind === 'npc' && !ecoTargetable(m, t)) || (m.provoked && GT > m.provoked && t.kind === 'mon' && !ecoEnemy(m, t)))) { m.target = t = null; m.provoked = 0; if (m.state !== 'idle' && m.state !== 'flee') m.state = 'return'; }
  const seeP = () => !(m.pacified > GT) && ecoSeesPlayer(m);   // perception (Living World phase 3): night, sleep and Hiding count; only enemies and territorial creatures
  let anchor, home, hunting, pursuit; const frame = () => { anchor = m.anchor || m.home; home = Math.hypot(m.x - anchor.x, m.y - anchor.y); hunting = m.chaseKind === 'hunt'; pursuit = (pr.pur || d.leash) * (hunting ? 2 : 1); }; frame();   // a hunt may run further than a territorial chase
  const step = (tx, ty, spd, away) => { if (m.rooted > GT) return; let dx = tx - m.x, dy = ty - m.y; if (away) { dx = -dx; dy = -dy; } const l = Math.hypot(dx, dy); if (l < .05) return; const s = Math.min(l, spd * MOVE_SCALE * (m.slowUntil > GT ? .75 : 1) * dt); const mv = moveBy(m, dx / l * s, dy / l * s); if (mv < s * .3) moveBy(m, -dy / l * s, dx / l * s); m.speed = mv / dt; updateFacing(m, dx, dy); };
  if (d.ward && d.wardEvery && GT > (m.wardAt || 0) && m.state === 'chase') { m.wardAt = GT + d.wardEvery; m.ward = d.ward; say(m, '*the bell hums: ward*'); }
  if (m.taming > GT && m.target !== P) { m.state = 'idle'; return; }   // a creature being tamed holds still for the attempt (Shardfall: timid wildlife would otherwise bolt)
  if (m.lured) { if (GT > m.lured.until || m.lastHurt > m.lured.t0) m.lured = null; else { m.target = null; m.state = 'idle'; const dl = Math.hypot(m.lured.x - m.x, m.lured.y - m.y); if (dl > 1.6) step(m.lured.x, m.lured.y, d.speed * .7); else if (!m.lured.arrived) m.lured.arrived = m.lured.until = Math.min(m.lured.until, GT + 5); return; } }   // Enticement: drawn to the bard, then lingers
  if (m.hidden && dist(m, P) < 2.4 && !P.ghost && !P.hidden && ecoEnemy(m, P)) { m.hidden = false; m.target = P; m.state = 'tele'; m.st = GT; if (m.sortie) ecoSortieEnd(m); say(m, 'Ambush!'); }
  if (m.state !== 'tele' && m.state !== 'strike') { ecoThink(m); t = m.target; frame(); }   // the decision may have chosen a new target
  switch (m.state) {
    case 'idle': if (m.hidden && !m.sortie) break; if (seeP()) { m.target = P; m.state = 'chase'; if (m.sortie) ecoSortieEnd(m); m.anchor = m.anchor || { x: m.x, y: m.y }; break; } if (m.pacified > GT) break; ecoIdle(m, dt, step); break;
    case 'chase': {
      if (m.sortie) ecoSortieEnd(m);
      if (m.pacified > GT) { m.state = 'idle'; m.target = null; break; }
      if (!t || home > pursuit || (t === P && !(dist(m, P) < d.leash && los(m, P))) || (t !== P && dist(m, t) > Math.max(d.leash, 14) * (hunting ? 1.3 : 1))) { m.state = 'return'; m.target = null; break; }
      const dd = dist(m, t); const far = d.ranged2 && dd > d.reach + .5 && dd <= d.ranged2.range;
      if (d.ranged && dd < (d.keep || 0) - .5) { step(t.x, t.y, d.speed, true); break; }
      if (far && GT > (m.r2At || 0) && los(m, t)) { m.state = 'tele'; m.st = GT; m.mode = 'r2'; m.aim = { x: t.x, y: t.y }; faceToward(m, t.x, t.y); break; }
      if (dd <= d.reach * .92 && (!d.ranged || los(m, t))) { m.state = 'tele'; m.st = GT; m.mode = d.aoe ? 'aoe' : d.ranged ? 'shot' : 'melee'; m.aim = { x: t.x, y: t.y }; faceToward(m, t.x, t.y); }
      else step(t.x, t.y, d.speed * (hunting ? 1.25 : 1));   // a hunting predator puts on a burst
    } break;
    case 'tele': { const tt = m.mode === 'r2' ? d.ranged2.tele : d.tele; if (t && m.mode !== 'aoe') faceToward(m, t.x, t.y);
      if (hunting && t && t.kind === 'mon' && m.mode === 'melee' && dist(m, t) > d.reach * .6) { step(t.x, t.y, d.speed * 1.25); faceToward(m, t.x, t.y); }   /* a pounce: a hunter keeps after fleeing prey through its wind-up (creature prey only; the player can still sidestep a telegraph) */ if (m.atkSt !== m.st) { m.atkSt = m.st; m.atkRow = m.sect || 0; } if (GT - m.st >= tt) { m.state = 'strike'; m.st = GT; m.impactT = GT; monStrike(m, t); } } break;
    case 'strike': if (GT - m.st > .15) { m.state = 'rec'; m.st = GT; } break;
    case 'rec': if (GT - m.st >= d.rec * (monT2A(d).dex + 100) / (stamOf(m) + 100)) m.state = m.target ? 'chase' : 'return'; break;   // a winded creature recovers slower (same stamina term as the swing formula)
    case 'flee': {   // run from a threat until it is out of sight or the scare wears off, then go home (§10: retreat, return to habitat)
      const th = m.threat, gone = !th || th.gone || th.dead || th.ghost, dd = gone ? 99 : dist(m, th), safe = Math.max(d.aggro * 1.4, (pr.flight || 6) * 1.6);
      if (gone || (GT > m.fleeUntil && dd > safe) || dd > safe * 1.8) { m.state = 'return'; m.threat = null; m.fleeT0 = 0; if (m.mind) m.mind.act = null; break; }
      if (!m.fleeT0 || GT - m.fleeT0 > 20) m.fleeT0 = GT; const x0 = m.x, y0 = m.y; step(th.x, th.y, d.speed * (pr.temper === 'timid' ? (GT - m.fleeT0 < 3 ? 1 : .7) : .85), true);   // prey tires after its first sprint
      if (Math.hypot(m.x - x0, m.y - y0) < .01 * dt * 60) step(m.home.x, m.home.y, d.speed);   // cornered: break for home
    } break;
    case 'return': {
      const hd = Math.hypot(m.x - m.home.x, m.y - m.home.y), hurtLately = GT - (m.hitT ?? -99) < 4;
      if (hd > 20) { if (!m.nav || m.nav.goal.name !== 'home' || m.nav.state === 'failed') { if (!m.nav || m.nav.state !== 'failed' || GT > (m.navRetry || 0)) { const k = hd > 55 ? 50 / hd : 1, g = k < 1 ? navSnap(Math.floor(m.x + (m.home.x - m.x) * k), Math.floor(m.y + (m.home.y - m.y) * k), 4).map(v => v + .5) : [m.home.x, m.home.y]; ecoNav(m, g[0], g[1], { doors: false, avoidProt: true, speed: d.speed * .8, name: 'home' }); m.navRetry = GT + 6; /* legs of at most 50 m: never a continent-wide path */ } } if (m.nav && m.nav.state === 'moving') navStep(m, dt); else { if (m.nav && m.nav.state === 'done') m.nav = null; step(m.home.x, m.home.y, d.speed); } }
      else { m.nav = null; step(m.home.x, m.home.y, d.speed); }
      if (!hurtLately) m.hp = Math.min(m.max, m.hp + m.max * .15 * dt);
      if (hd < 1.2) { m.state = 'idle'; m.anchor = null; m.chaseKind = null; m.fleeDone = false; m.nav = null; if (!hurtLately) m.hp = m.max; if (d.hideChance && R() < d.hideChance) m.hidden = true; }
      if (seeP() && Math.hypot(m.x - m.home.x, m.y - m.home.y) < d.leash * .6) { m.target = P; m.state = 'chase'; m.nav = null; } } break;
  }
  ecoSeparate(m);
}
/* resolve a committed creature attack against whatever it targets: the player, a pet, or a provoked creature */
function monStrike(m, t) {
  const d = MON[m.type]; if (!t || t.gone || t.dead) return;
  if (m.mode === 'aoe') { FX.push({ k: 'boom', x: m.x, y: m.y, r: d.aoe, t0: GT, dur: .5 }); sndAt('combat.blast', m); for (const v of [P, ...ents.filter(e => e.kind === 'pet' || (isAlly(e) && !e.ghost))]) { if (v === P && (P.ghost || P.hidden)) continue; if (Math.hypot(v.x - m.x, v.y - m.y) <= d.aoe) strikeOne(m, v, d.dmg, false, true); } return; }
  if (m.mode === 'shot' || m.mode === 'r2') { const r = m.mode === 'r2' ? d.ranged2 : d; if (m.mode === 'r2') m.r2At = GT + 5; const aim = m.aim, tt = Math.hypot(aim.x - m.x, aim.y - m.y) / 14; EFX.push({ k: 'proj', x: m.x, y: m.y, tx: aim.x, ty: aim.y, t0: GT, t1: GT + tt, col: d.boss ? '#ffd070' : '#ff8a30', big: 1, at: GT + tt, fn: () => { if (alive(m) || true) { const hitT = Math.hypot(t.x - aim.x, t.y - aim.y) < 1.1 && !(t === P && (P.ghost || P.hidden)); if (hitT) { if (r.magic) magicStrike(m, t, r.dmg, r.magic); else strikeOne(m, t, r.dmg, true); } else floater(aim.x, aim.y, 'dodged', '#c8c8c8'); } } }); return; }
  const dd = dist(m, t); if (dd > d.reach + .35 || !los(m, t)) return;
  strikeOne(m, t, d.dmg);
}
/* a creature's spell (the ash wisp's fire, the Lich Lord's bolt): no armor, no parry; Resisting Spells halves it and is taught by it,
   up to the ceiling the spell's circle allows (src/skills.js SK.resistMaxFor). Players take half creature damage, as with blows. */
function magicStrike(m, t, dmgR, circle) {
  if (!fighterAlive(t) || (t === P && P.hidden)) return; let dmg = rnd(dmgR[0], dmgR[1]);
  if (t === P) { const ch = SF.MAGERY.resistChance(circle, monDiff(m), sv('resistingspells')); if (ch > 0 && svReal('resistingspells') < SF.SK.resistMaxFor(circle)) skillCheck('resistingspells', 0, 120);
    const res = R() < ch; dmg = Math.max(1, Math.round(dmg / 2 * (res ? .5 : 1))); if (res) floater(P.x, P.y, 'resisted', '#c8a0ff'); log(`The ${MON[m.type].n}'s spell strikes you: ${dmg}${res ? ' (resisted)' : ''}.`, '#ff9a8a', 'combat'); }
  damageActor(t, dmg, 'spell', m);
}
function strikeOne(m, t, dmgR, ranged, area) {
  if (!fighterAlive(t) || (t === P && P.hidden)) return;
  const A = fighter(m); if (dmgR) A.range = dmgR;
  const D = fighter(t);
  if (R() >= SF.hitChance(A.atk, D.def)) { missFx(t, m); return; }
  applyBlow(A, t, { ranged: !!ranged, area: !!area });
}

/* ---------- the ally: Wren, a quay sellsword. A local combatant fixture that fights with the same rules, can be bandaged, dies to a ghost and returns ---------- */
const ALLY_POST = { x: 97.5, y: 308.5 };
function makeAlly(sv0) {
  const a = addEnt({ kind: 'ally', aid: 'wren', name: 'Wren', x: ALLY_POST.x, y: ALLY_POST.y, sect: 2, str: 60, dex: 55, int: 30, skills: SF.newSkills(), pack: SF.newContainer('pack', 'wren'), order: 'wait', sw: SF.newSwing() });
  for (const [k, v] of [['swordsmanship', 55], ['tactics', 55], ['anatomy', 40], ['parrying', 40], ['wrestling', 30]]) a.skills[k].v = v * 10;
  a.equip = { weapon: SF.newItem('sword', 1, { cond: 100, maxc: 100, omax: 100 }), shield: SF.newItem('buckler', 1, { cond: 100, maxc: 100, omax: 100 }), }; Object.assign(a.equip, emptyEquip(), { weapon: a.equip.weapon, shield: a.equip.shield }); for (const id of ['leather_cap', 'leather_gorget', 'leather_tunic', 'leather_sleeves', 'leather_gloves', 'leather_leggings', 'shirt', 'trousers', 'boots']) { const it = SF.EQ.make(id, { origin: 'npc' }); a.equip[SF.ITEMS[id].slot] = it; } a.eqMig = SF.EQ.MIGRATION;
  a.max = SF.maxHp(a); a.hp = Math.round(a.max * .55); a.stam = a.dex;          // she starts nursing a wound
  if (sv0) { for (const k of ['x', 'y', 'hp', 'stam', 'ghost', 'ghostAt', 'order', 'poison', 'skills']) if (sv0[k] !== undefined) a[k] = sv0[k]; if (sv0.equip) a.equip = Object.assign(emptyEquip(), sv0.equip); if (sv0.pack) a.pack.items = sv0.pack; if (a.ghost && Number.isFinite(sv0.ghostLeft)) a.ghostAt = GT - (SF.ALLY_GHOST_WAIT - sv0.ghostLeft); }
  if (!canStand(a, a.x, a.y)) { a.x = ALLY_POST.x; a.y = ALLY_POST.y; }
  return a;
}
SF.ALLY_GHOST_WAIT = 180;
const allyOf = () => ents.find(e => isAlly(e) && !e.gone);
function damageAlly(a, amt, src, kind, hx) {
  if (!isAlly(a) || a.ghost || amt <= 0) return; a.hp -= amt; a.lastHit = GT; a.lastCombat = GT; simEmit('ActorDamaged', { actor: aidOf(a), source: aidOf(src), amount: amt, kind: kind || 'phys', x: a.x, y: a.y });
  floater(a.x, a.y, '-' + amt, kind === 'poison' ? '#7be07b' : '#ff8a6a'); hitSound(a, kind, src, hx, a.hp <= 0);
  if (src && src.kind === 'mon' && alive(src) && !a.foe) a.foe = src;
  if (a.hp <= 0) allyDies(a, src);
}
function allyDies(a, src) {
  if (a.ghost) return;                                                                            // death resolves exactly once
  simEmit('ActorKilled', { actor: aidOf(a), killer: aidOf(src), x: a.x, y: a.y });
  a.hp = 0; a.ghost = true; a.ghostAt = GT; a.poison = null; a.foe = null; a.reviveOffer = null;
  const look = gearSnapOf(a), body = SF.deathTransaction(a, GT, { x: a.x, y: a.y }); body.owner = a.aid;
  addEnt({ kind: 'corpse', allyBody: a.aid, name: a.name + "'s body", x: a.x, y: a.y, cont: body, expires: body.expires, gear: look, t0: GT, sect: a.sect || 0 });
  for (const e of ents) if (e.target === a) { e.target = null; if (e.kind === 'mon') e.state = 'return'; }
  log(`${a.name} has fallen${src && src.name ? ' to a ' + src.name : ''}. Her ghost waits by her body; bandages (Healing and Anatomy 80) or a resurrection spell can bring her back.`, '#ff8a6a'); sndAt('player.death', a, { gain: .8 });
}
/* back to life at 25 % health (the shared resurrection rule); the owner takes her gear back from her own body if it is in reach */
function allyResurrect(a, how, where) {
  if (!a.ghost) return; if (where) { a.x = where.x; a.y = where.y; }
  a.ghost = false; a.hp = Math.ceil(a.max * .25); a.stam = Math.ceil(a.dex * .2); a.reviveOffer = null;
  allyReclaim(a, 3);
  FX.push({ k: 'ring', x: a.x, y: a.y, c: '#fff2b0', t0: GT, dur: .8 }); log(`${a.name} returns to life (${how}).`, '#ffe08a'); sndAt('player.revive', a);
}
function allyReclaim(a, reach) {
  const body = ents.find(e => e.allyBody === a.aid && !e.gone); if (!body || dist(body, a) > reach) return !!body;
  for (const it of body.cont.items.slice()) { const s = SF.ITEMS[it.id].slot; if (s && (!a.equip[s] || a.equip[s].id === 'garment')) { if (a.equip[s]) a.pack.items.push(a.equip[s]); a.equip[s] = it; } else a.pack.items.push(it); }
  body.cont.items = []; rmEnt(body); if (P.lootOpen === body) { closePanel(); P.lootOpen = null; } say(a, 'Got my gear back.'); return false;
}
function allyStep(a, tx, ty, dt) { const dx = tx - a.x, dy = ty - a.y, l = Math.hypot(dx, dy); if (l < .05) { a.speed = 0; return; } const s = Math.min(l, SF.WALK * MOVE_SCALE * dt), mv = moveBy(a, dx / l * s, dy / l * s); if (mv < s * .3) moveBy(a, -dy / l * s, dx / l * s); a.speed = mv / Math.max(dt, 1e-6); if (mv > 0) a.movedAt = GT; updateFacing(a, dx, dy); }
function allyTick(a, dt) {
  if (a.lunge) { a.lunge += dt / .2; if (a.lunge >= 1) a.lunge = 0; }
  if (a.ghost) { a.speed = 0;
    if (a.reviveOffer && a.reviveOffer.until > GT) return allyResurrect(a, 'a resurrection spell');
    if (GT - a.ghostAt > SF.ALLY_GHOST_WAIT) { const h = ents.find(e => e.kind === 'npc' && e.role === 'healer'); allyResurrect(a, 'restored by ' + (h ? h.name : 'a healer'), h ? { x: h.x + .8, y: h.y + .8 } : ALLY_POST); a.order = 'wait'; }
    return; }
  if (a.poison && GT >= a.poison.next) { a.poison.next = GT + SF.POISON_GAP; damageAlly(a, SF.POISON[a.poison.tier], null, 'poison'); if (a.poison && --a.poison.ticks <= 0) a.poison = null; if (a.ghost) return; }
  const fight = GT - (a.lastCombat || -99) < 6;
  if (GT - (a.lastHit || -99) > .75) a.stam = Math.min(a.dex, a.stam + (fight ? SF.STAM_REGEN_COMBAT : SF.STAM_REGEN) * dt);
  if (!fight && !a.poison) a.hp = Math.min(a.max, a.hp + .1 * dt);
  SF.swingTick(a.sw, GT, a.stam, weaponOfActor(a));
  // choose a foe: whatever she is already fighting, else (following) your armed target or anything after you or her
  let t = a.foe && alive(a.foe) && a.foe.kind === 'mon' && !a.foe.hidden && dist(a, a.foe) < 14 ? a.foe : null;
  if (!t && a.order === 'follow') { if (P.armed && P.sel && P.sel.kind === 'mon' && alive(P.sel) && dist(P.sel, a) < 10) t = P.sel;
    else t = ents.filter(e => e.kind === 'mon' && alive(e) && !e.hidden && (e.target === P || e.target === a) && dist(e, a) < 8).sort((x, y) => dist(x, a) - dist(y, a))[0] || null; }
  if (!t && a.order === 'wait') t = ents.filter(e => e.kind === 'mon' && alive(e) && e.target === a && dist(e, a) < 6)[0] || null;
  a.foe = t;
  if (!t) { const b = ents.find(e => e.allyBody === a.aid && !e.gone); if (b) { if (dist(a, b) > 1.2) allyStep(a, b.x, b.y, dt); else allyReclaim(a, 1.5); return; } }
  if (t) { const w = weaponOfActor(a); if (dist(a, t) > w.reach * .9 || !los(a, t)) allyStep(a, t.x, t.y, dt); else { a.speed = 0; faceToward(a, t.x, t.y); swingAt(a, t); } return; }
  if (a.order === 'follow' && !P.ghost) { if (dist(a, P) > 1.8) allyStep(a, P.x - .9, P.y + .9, dt); else a.speed = 0; if (dist(a, P) > 30) { a.x = P.x - .8; a.y = P.y + .8; } }
  else if (a.order === 'wait' && a.home && Math.hypot(a.home.x - a.x, a.home.y - a.y) > .6) allyStep(a, a.home.x, a.home.y, dt); else a.speed = 0;
}
function allyCommand(c) {
  const a = P.sel && isAlly(P.sel) ? P.sel : allyOf(); if (!a || a.ghost) return;
  if (c === 'follow') { a.order = 'follow'; say(a, 'Right behind you.'); }
  else { a.order = 'wait'; a.home = { x: a.x, y: a.y }; a.foe = null; say(a, 'I will hold here.'); }
}
function allySave() { const a = allyOf(); if (!a) return null; return { x: a.x, y: a.y, hp: a.hp, stam: a.stam, ghost: !!a.ghost, ghostLeft: a.ghost ? Math.max(0, SF.ALLY_GHOST_WAIT - (GT - a.ghostAt)) : undefined, order: a.order, poison: a.poison || null, skills: a.skills, equip: a.equip, pack: a.pack.items,
  body: (() => { const b = ents.find(e => e.allyBody === a.aid && !e.gone); return b ? { x: b.x, y: b.y, items: b.cont.items, left: b.expires - GT, diedAgo: GT - b.cont.diedAt } : null; })() }; }
/* spawnTick (populations, camps, regions) lives in src/ecology.js since Living World phase 3 */
/* ---------- magic: prepare → hold → release lives in src/magic.js (castSlot, prepTick, releaseHeld, interruptPrep, TIMERS/at) ---------- */

/* ---------- abilities: bandage, consumables, hide, track, meditate ---------- */
/* ---------- First Aid: Healing with bandages (UO Second Age delays and thresholds, issue #3) ----------
   One application at a time, linked to its healer and patient from the first tap to completion. The bandage is spent only after
   validation; completion re-checks life state and reach and never pays out a different treatment. Damage to the healer slips. */
const FA_WORD = { heal: 'bandage', cure: 'cure', res: 'resurrection' };
function patientState(e) {
  if (e === P) return { ghost: !!P.ghost, poisoned: !!P.poison, hp: P.hp, max: SF.maxHp(P), isPlayer: true };
  if (isAlly(e) && !e.gone) return { ghost: !!e.ghost, poisoned: !!e.poison, hp: e.hp, max: e.max, isPlayer: true };
  if (e && e.kind === 'pet') return { pet: true };
  return null;
}
const patientName = e => e === P ? 'yourself' : e.name;
function firstAid(e) {
  if (P.ghost) return log('Ghosts cannot apply bandages.', '#ffb070');
  e = e || P; const self = e === P, st = patientState(e);
  if (!st) return log('Bandages treat you, an ally or a player ghost. Select one first.', '#ffb070');
  const c = SF.firstAidCheck(st, { self, dist: self ? 0 : dist(P, e), bandages: SF.count(P.pack, 'bandage'), busy: !!P.bandage });
  if (!c.ok) return log(c.reason, '#ffb070');
  if (!self && !los(P, e)) return log('You cannot reach your patient from here.', '#ffb070');
  SF.removeQty(P.pack, 'bandage', 1); snd('item.bandage', { key: 'P' }); P.bandSeq = (P.bandSeq || 0) + 1;
  P.bandage = { id: P.bandSeq, e, kind: c.kind, self, t0: GT, t1: GT + c.time, slips: 0 };
  log(`You begin applying a ${FA_WORD[c.kind]} to ${patientName(e)} (${c.time} s).`, '#9fe0a8');
  save();
}
function firstAidOther() {
  const s = P.sel; if (s && s !== P && patientState(s)) return firstAid(s);
  const near = ents.filter(e => isAlly(e) && !e.gone && dist(e, P) <= SF.FIRST_AID.range).sort((a, b) => dist(a, P) - dist(b, P))[0];
  if (near) { P.sel = near; return firstAid(near); }
  log('Tap an ally or a player ghost, then press Bandage other.', '#ffb070');
}
function slipBandage(src) { if (!P.bandage) return; P.bandage.slips++; floater(P.x, P.y, 'fingers slip', '#ffcf7a'); if (P.bandage.slips === 1) log('Your fingers slip!', '#ffcf7a'); }
function finishFirstAid() {
  const b = P.bandage; P.bandage = null; P.bandDone = b.id; const e = b.e, who = patientName(e);
  const st = e && !e.gone ? patientState(e) : null;
  const out = (m, c) => { log(m, c || '#ffb070'); save(); return m; };
  if (!st) return out('Your patient is gone; the bandage is wasted.');
  if (!b.self && (dist(P, e) > SF.FIRST_AID.range || !los(P, e))) { floater(P.x, P.y, 'out of reach', '#ffb070'); return out(`${cap1(who)} moved out of reach; the ${FA_WORD[b.kind]} is wasted.`); }
  const now = SF.firstAidKind(st);
  if (now !== b.kind) return out(b.kind === 'res' ? `${cap1(who)} is no longer a ghost.` : now === 'res' ? `${cap1(who)} died before you finished.` : now === 'cure' ? `${cap1(who)} was poisoned before you finished; this bandage was for wounds.` : now === 'heal' ? `The poison is already gone; this bandage was for poison.` : `${cap1(who)} no longer needs treatment.`);
  const real = b.kind !== 'heal', heal = real ? svReal('healing') : sv('healing'), ana = real ? svReal('anatomy') : sv('anatomy');   // cure and resurrection: the 60/60 and 80/80 thresholds read real skill
  const r = SF.firstAidResolve({ kind: b.kind, heal, ana, slips: b.slips, missing: st.max - st.hp }, R);
  if (r.chance > 0) { skillCheck('healing', 0, 120); skillCheck('anatomy', 0, 120); }    // each real treatment teaches (a sure heal still teaches up to 100.0); one the healer cannot attempt does not
  const sl = b.slips ? ` (${b.slips} slip${b.slips > 1 ? 's' : ''})` : '';
  if (b.kind === 'heal') {
    if (!r.success) { floater(e.x, e.y, 'no effect', '#c8c8c8'); return out(`You fail to stop the bleeding${sl}.`); }
    e.hp = Math.min(st.max, e.hp + r.amount); floater(e.x, e.y, '+' + r.amount, '#7ee08a'); FX.push({ k: 'heal', x: e.x, y: e.y, t0: GT, dur: .8 });
    return out(r.note === 'barely' ? `You apply the bandage, but it barely helps${sl}.` : `You heal ${who === 'yourself' ? 'yourself' : who} for ${r.amount} HP${sl}.`, '#7ee08a');
  }
  if (b.kind === 'cure') {
    if (r.note === 'unskilled') return out('Curing poison needs 60 Healing and 60 Anatomy. The bandage does nothing.');
    if (!r.success) { floater(e.x, e.y, 'cure fails', '#c8c8c8'); return out(`You fail to cure the poison${sl}.`); }
    e.poison = null; if (e === P) P.poisonImmune = GT + 1; floater(e.x, e.y, 'cured', '#7ee08a'); return out(`You cure ${who === 'yourself' ? 'yourself' : who} of poison${sl}.`, '#7ee08a');
  }
  if (r.note === 'unskilled') return out('Resurrection needs 80 Healing and 80 Anatomy. The ghost stays a ghost.');
  if (!r.success) { floater(e.x, e.y, 'fails', '#c8c8c8'); return out(`You fail to bring ${who} back${sl}.`); }
  allyResurrect(e, 'your bandages'); save(); return 'res';
}
function bandageTick() {
  const b = P.bandage; if (!b) return;
  if (P.ghost) { P.bandage = null; return; }
  if (GT >= b.t1) finishFirstAid();
}
/* persisted with the save so a reload can neither lose nor repeat an application */
function bandageSave() { const b = P.bandage; if (!b) return null; return { id: b.id, pid: b.self ? 'P' : b.e.aid, kind: b.kind, self: b.self, left: Math.max(0, b.t1 - GT), dur: b.t1 - b.t0, slips: b.slips }; }
function bandageLoad(s) {
  if (!s || s.id <= (P.bandDone || 0)) return;                                       // already completed before this save: never twice
  const e = s.pid === 'P' ? P : ents.find(x => isAlly(x) && x.aid === s.pid); if (!e) { P.bandDone = s.id; return; }
  P.bandage = { id: s.id, e, kind: s.kind, self: s.self, t0: GT - (s.dur - s.left), t1: GT + s.left, slips: s.slips || 0 };
}
/* active Anatomy: a read of a living target's strength and dexterity, and stamina from 80 */
function anatomyCheck() {
  const t = P.sel; if (!t || !(t === P || fighterAlive(t)) || !(t === P || t.kind === 'mon' || t.kind === 'pet' || isAlly(t))) return log('Select a living creature or person for Anatomy.', '#ffb070');
  if (t !== P && (dist(t, P) > 8 || !los(P, t))) return log('Move closer to study them.', '#ffb070');
  const d = t.type ? MON[t.type] : null, x = d ? monT2A(d) : null;
  const tv = t === P || isAlly(t) ? { str: t.str, dex: t.dex, stam: t.stam, maxStam: t.dex } : { str: x.str, dex: x.dex, stam: stamOf(t), maxStam: x.dex };
  skillCheck('anatomy', 0, 100); const ana = sv('anatomy');
  const r = SF.anatomyRead(ana, tv);
  log(`${t === P ? 'You look' : cap1(t.name || 'it') + ' looks'} ${r.strWord} (STR ${r.str[0]}–${r.str[1]}) and ${r.dexWord} (DEX ${r.dex[0]}–${r.dex[1]})${r.stam ? `, stamina ${r.stam[0]}/${r.stam[1]}` : ''}.`, '#e8d8b0');
}
function useConsumable(id) {
  const c = SF.CONSUMABLES[id]; if (P.ghost) return; if (!SF.count(P.pack, id)) return log('You have no ' + SF.ITEMS[id].n.toLowerCase() + '.', '#ffb070');
  P.cd = P.cd || {}; if (GT < (P.consumeGap || 0)) return log('Too soon after your last consumable.');
  if (GT < (P.cd[c.fam] || 0)) return log(c.n + ' is on cooldown (' + Math.ceil(P.cd[c.fam] - GT) + ' s).');
  if (id === 'cinder') { AIM = { kind: 'flask', r: c.radius, range: 9, fn: pt => throwFlask(pt) }; log('Tap the ground to throw the cinder flask.'); return; }
  SF.removeQty(P.pack, id, 1); P.consumeGap = GT + SF.CONSUME_GAP; P.cd[c.fam] = GT + c.cd; snd('item.drink', { key: 'P' });
  if (c.heal) { const b = P.hp; P.hp = Math.min(SF.maxHp(P), P.hp + c.heal); floater(P.x, P.y, '+' + Math.round(P.hp - b), '#7ee08a'); }
  if (c.stam) P.stam = Math.min(SF.maxStam(P), P.stam + c.stam); if (c.mana) P.mana = Math.min(SF.maxMana(P), P.mana + c.mana); if (c.cure && P.poison) { P.poison = null; log('The antidote clears the poison.'); }
}
function throwFlask(pt) {
  if (Math.hypot(pt.x - P.x, pt.y - P.y) > 9) return log('Too far to throw.'); AIM = null; const c = SF.CONSUMABLES.cinder;
  SF.removeQty(P.pack, 'cinder', 1); P.consumeGap = GT + SF.CONSUME_GAP; P.cd.flask = GT + c.cd;
  const f = { k: 'flask', sx: P.x, sy: P.y, x: pt.x, y: pt.y, r: c.radius, t0: GT, until: GT + c.fuse + .5 }; EFX.push(f);
  at(c.fuse, () => { FX.push({ k: 'boom', x: pt.x, y: pt.y, r: c.radius, t0: GT, dur: .5 }); sndAt('combat.blast', pt); const dmg = c.blast + Math.round(5 * sv('alchemy') / 100); for (const m of ents.slice()) if (m.kind === 'mon' && alive(m) && Math.hypot(m.x - pt.x, m.y - pt.y) <= c.radius) damageMon(m, dmg, 'phys', P, { area: 1 }); if (Math.hypot(P.x - pt.x, P.y - pt.y) <= c.radius) damagePlayer(Math.round(dmg / 2), null, 'phys', { area: 1 }); });
}
function eat(id, uid) { const pz = uid ? findU(P.pack, uid) : P.pack.items.find(i => i.id === id && !i.poison) || P.pack.items.find(i => i.id === id); if (!pz) return; const lvl = pz.poison || 0; if (pz.qty > 1) { pz.qty--; P.pack.ver++; } else { P.pack.items.splice(P.pack.items.indexOf(pz), 1); P.pack.ver++; }
  if (lvl) { applyPoison(P, Math.min(4, lvl)); log('The food tastes strange…', '#7be07b'); } snd('item.eat', { key: 'P' }); P.fed = GT + 300; log('You eat. Out of combat you recover health faster for 5 minutes.', '#7ee08a'); }
function hide() {
  if (P.ghost || P.hidden) return; if (cdLeft('hide') > 0) return log('You must wait to perform another action (' + Math.ceil(cdLeft('hide')) + ' s).');
  if (ents.some(e => e.kind === 'mon' && alive(e) && e.target === P && dist(e, P) <= 2 && los(e, P))) return log('You can\'t seem to hide right now.', '#ffb070');
  if (P.meditating) { P.meditating = null; log('You lose your focus.'); }
  P.task = { kind: 'hide', label: 'Hiding', t0: GT, t1: GT + .7, still: true, x0: P.x, y0: P.y };
}
function finishHide() {
  skillDelay('hide', 10); const ok = skillCheck('hiding', 0, 100);       // Hiding: a check across 0–100 (classic), 10 s between attempts
  if (!ok) return log('You can\'t seem to hide here.', '#a8a8a8');
  P.hidden = true; P.stepBudget = 0; P.stepAcc = 0; P.stealthUsed = false; log('You have hidden yourself well. Moving reveals you unless you use Stealth; attacking, casting and most skills reveal you.', '#9fd0ff');
  for (const m of ents) if (m.target === P) { m.target = null; m.state = 'return'; }
}
function reveal(msg) { if (!P.hidden) return; P.hidden = false; P.stepBudget = 0; log(msg || 'You are revealed.', '#ffb070'); }
/* Tracking: choose animals, monsters or people, then one of them; an arrow follows that trail until it goes cold */
function track() { if (P.ghost) return; if (cdLeft('track') > 0) return log('You must wait to track again (' + Math.ceil(cdLeft('track')) + ' s).'); openPanel('track'); }
function trackKind(e) { if (e.kind === 'npc' || isAlly(e)) return 'people'; if (e.kind !== 'mon' || !alive(e)) return null; return SPECIES_CLASS[e.type] === 'animal' ? 'animals' : HUMANOID[e.type] ? 'people' : 'monsters'; }
function trackList(kind) { const range = SF.SK.trackRange(sv('tracking')); return ents.filter(e => e !== P && !e.gone && trackKind(e) === kind && dist(e, P) <= range).sort((a, b) => dist(a, P) - dist(b, P)).slice(0, 8); }
function trackStart(kind) {
  skillDelay('track', 10); useAbilityReveal('track');
  if (!skillCheck('tracking', 0, 100)) { closePanel(); return log('You see no evidence of those in the area.', '#a8a8a8'); }
  TRACKUI = { kind, list: trackList(kind) }; if (!TRACKUI.list.length) { closePanel(); return log('You see no evidence of those in the area.'); } renderPanel();
}
function trackFollow(e) { P.trackT = { e, until: GT + 90, range: SF.SK.trackRange(sv('tracking')) * 1.5 }; closePanel(); log(`You find the trail of ${e.name || (MON[e.type] || {}).n || 'someone'}.`, '#9fd0ff'); trackUpdate(); }
function trackUpdate() {
  const t = P.trackT; if (!t) { if (TRACKS && TRACKS.follow) TRACKS = null; return; }
  const e = t.e, d = !e.gone && !e.dead ? dist(e, P) : 1e9;
  if (d > t.range || GT > t.until) { P.trackT = null; TRACKS = null; return log('The trail goes cold.', '#a8a8a8'); }
  const sx = (e.x - P.x) - (e.y - P.y), sy = ((e.x - P.x) + (e.y - P.y)) * .5, a = Math.atan2(sy, sx) * 180 / Math.PI;
  TRACKS = { follow: true, until: GT + 1, list: [{ bearing: a + 90, label: `${e.name || (MON[e.type] || {}).n} · ${Math.round(d)} m` }] };
}
let TRACKUI = null;
/* Meditation: passive regeneration always; active meditation is a check against how empty you are (see SF.SK.manaRegen) */
function meditate() {
  if (P.ghost) return; if (P.mana >= SF.maxMana(P)) return log('You are at peace.');
  if (cdLeft('meditate') > 0) return log('You must wait to meditate again (' + Math.ceil(cdLeft('meditate')) + ' s).');
  if (GT - (P.lastHit || -99) < SF.MEDITATE_DELAY) return log('You cannot focus your concentration under fire.', '#ffb070');
  if (P.equip.weapon || P.equip.shield) return log('You cannot meditate with anything in your hands.', '#ffb070');
  skillDelay('meditate', SF.SK.MED.delay); useAbilityReveal('meditate');
  const pct = P.mana / SF.maxMana(P) * 100, w = SF.SK.medWindow(pct);
  if (!skillCheck('meditation', w[0], w[1])) return log('You cannot focus your concentration.', '#a8a8a8');
  if (SF.EQ.effective(P).med >= SF.SK.MED.armorBlocks) return log('Regenerative forces cannot penetrate your armor.', '#ffb070');
  P.meditating = { t0: GT, gained: 0 }; log('You enter a meditative trance. Moving or acting stops it.', '#9fd0ff');
}
function useSlot(i) {
  const s = P.hotbar[i]; if (!s) { openPanel('bag'); return; }
  if (s.k === 'spell') return castSlot(s.id);
  if (s.k === 'act' && ABIL[s.id]) return ABIL[s.id].fn();
  if (s.k === 'act') return ({ hide, track, meditate, brace: () => { if (!SF.SK.EXT.bracedGuard) return log('Braced Guard is a Shardfall extension, switched off in Second Age parity mode.', '#ffb070'); if (!P.equip.shield) return log('You need a shield.'); if (sv('parrying') < 50) return log('Braced Guard needs Parrying 50.'); if (P.stam < 6) return log('Too tired.'); P.stam -= 6; P.braced = GT + .8; } }[s.id] || (() => { }))();
  if (s.k === 'item') { if (s.id === 'bandage') return firstAid(P); if (SF.CONSUMABLES[s.id]) return useConsumable(s.id); if (SF.ITEMS[s.id].use === 'eat') return eat(s.id); }
}
function slotLabel(s) { if (!s) return ['+', 'empty']; if (s.k === 'spell') return [SF.SPELL[s.id].n, SF.SPELL[s.id].mp + ' mp']; if (s.k === 'act') return [ABIL[s.id] ? ABIL[s.id].n : { hide: 'Hide', track: 'Track', meditate: 'Meditate', brace: 'Brace' }[s.id], ABIL[s.id] && ABIL[s.id].cd && P.cdA && P.cdA[s.id] > GT ? Math.ceil(P.cdA[s.id] - GT) + 's' : '']; return [s.id === 'bandage' ? 'Bandage self' : SF.ITEMS[s.id].n.replace('Healing draught', 'Draught'), '×' + SF.count(P.pack, s.id)]; }

/* ---------- world interaction: gather, skin, fish, loot, NPCs, shrines, stations ---------- */
function nodeAt(x, y) { const t = tAt(x, y); return NODE[t] ? { kind: 'node', x, y, t, skill: NODE[t], name: NODE_NAME[t] } : null; }
function nearestStation(kinds) { let best = null, bd = 9; for (const s of STATIONS) if (kinds.includes(s.k)) { const d = Math.hypot(s.x + .5 - P.x, s.y + .5 - P.y); if (d < bd) { bd = d; best = s; } } return bd <= 2.2 ? best : null; }
function interact() {
  if (AIM) { AIM = null; return; }
  if (P.ghost) { const r = nearestRes(); if (r && Math.hypot(r.x - P.x, r.y - P.y) <= 2.5) return resurrect(); return log('Walk to a shrine or healer to be restored. Follow the golden arrow.'); }
  if (nearBeacon()) return useBeacon();
  if (annInteract()) return;
  const dr = nearDoor(); if (dr && !nearerThanDoor(doorDist(dr))) return useDoor(dr);
  if (interactExtra()) return;
  const sel = P.sel;
  if (sel && sel.kind === 'corpse' && dist(sel, P) <= 2) return openCorpse(sel);
  if (sel && sel.kind === 'npc' && dist(sel, P) <= 2.5) return talk(sel);
  if (sel && sel.kind === 'node') { const d = Math.hypot(sel.x + .5 - P.x, sel.y + .5 - P.y); if (d <= (sel.skill === 'fishing' ? 8 : 2)) return startGather(sel); }   // out of reach: fall through to what is next to you
  // nearest thing in reach
  const near = ents.filter(e => !e.gone && ((e.kind === 'corpse' && dist(e, P) <= 2) || (e.kind === 'npc' && dist(e, P) <= 2.5))).sort((a, b) => dist(a, P) - dist(b, P))[0];
  const stn0 = nearestStation(['forge', 'anvil', 'bench', 'still', 'fire']);
  if (near && !(stn0 && near.kind === 'npc' && Math.hypot(stn0.x + .5 - P.x, stn0.y + .5 - P.y) < dist(near, P))) { P.sel = near; return near.kind === 'corpse' ? openCorpse(near) : talk(near); }
  for (const s of SHRINES) if (Math.hypot(s.x + .5 - P.x, s.y + .5 - P.y) <= 2.2) { P.bound = s.id; log('Your soul is bound to the ' + s.n + '.', '#ffe08a'); return; }
  const st = nearestStation(['forge', 'anvil', 'bench', 'still', 'fire']); if (st) return openCraft(st.k);
  for (let r = 1; r <= 2; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const n = nodeAt(Math.floor(P.x) + dx, Math.floor(P.y) + dy); if (n && n.skill !== 'fishing' && Math.hypot(n.x + .5 - P.x, n.y + .5 - P.y) <= 2) { P.sel = n; return startGather(n); } }
  for (let r = 1; r <= 7; r++) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, x = Math.floor(P.x + Math.cos(a) * r), y = Math.floor(P.y + Math.sin(a) * r); if (tAt(x, y) === T.WA && SF.count(P.pack, 'rod')) { const n = { kind: 'node', x, y, t: T.WA, skill: 'fishing', name: 'fishing water' }; P.sel = n; return startGather(n); } }
  if (sel && sel.kind === 'node') return log('Move closer to the ' + (sel.skill === 'mining' || sel.skill === 'lumberjacking' ? nodeLabel(sel) : sel.name) + '.');
  log('Nothing to interact with here.');
}
/* is something other than the door the more likely intent? explicit selection in reach, or anything usable nearer */
function nearerThanDoor(dd) {
  const sel = P.sel; if (sel && ((sel.kind === 'corpse' && dist(sel, P) <= 2) || (sel.kind === 'npc' && dist(sel, P) <= 2.5) || (sel.kind === 'node' && Math.hypot(sel.x + .5 - P.x, sel.y + .5 - P.y) <= 2))) return true;
  for (const e of ents) if (!e.gone && ((e.kind === 'corpse' && dist(e, P) <= 2) || (e.kind === 'npc' && dist(e, P) <= 2.5)) && dist(e, P) <= dd) return true;   // ties go to the person or object
  for (const c of CHESTS.values()) { const d = Math.hypot(c.x + .5 - P.x, c.y + .5 - P.y); if (d <= 2 && d <= dd) return true; }
  for (const st of STATIONS) { const d = Math.hypot(st.x + .5 - P.x, st.y + .5 - P.y); if (d <= 2.2 && d <= dd) return true; }
  return false;
}
function startGather(n) {
  if (P.ghost) return; const tl = gatherTool(n);
  if (!tl.ok) return log('You need a ' + SF.ITEMS[tl.id].n.toLowerCase() + '.', '#ffb070');
  if (n.skill !== 'fishing') { const tier = nodeTier(n.x, n.y), nm = nodeLabel(n); if (n.skill !== 'forage' && sv(n.skill) < SF.NODE_TIER_MIN[tier]) return log(`This ${nm} is grade ${tier + 1}; it needs ${SF.SKILL[n.skill].n} ${SF.NODE_TIER_MIN[tier]}.`, '#ffb070'); if (nodeStock(n.x, n.y).n <= 0) return log('This ' + nm + ' is exhausted for now.'); }
  if (overweight()) return log('You are carrying too much.', '#ffb070');
  P.task = { kind: 'gather', node: n, label: n.skill === 'forage' ? 'Foraging' : SF.SKILL[n.skill].n, t0: GT, t1: GT + SF.GATHER_TIME[n.skill], still: true, x0: P.x, y0: P.y }; faceToward(P, n.x + .5, n.y + .5);
  if (n.skill === 'fishing') snd('fish.cast', { key: 'P' });   // the committed cast
}
function fishCheck(diff) { const ch = SF.opposed(sv('fishing'), diff), ok = R() < ch; skillUse('fishing', ch, ok, null, SF.SK.HARVEST.common); return ok; }
function finishGather(n) {
  if (n.skill === 'mining' || n.skill === 'lumberjacking') return finishStroke(n);
  const sk = n.skill, tier = sk === 'fishing' ? (Math.hypot(n.x - 92, n.y - 300) < 120 ? 0 : 1) : nodeTier(n.x, n.y), diff = SF.NODE_TIER_DIFF[tier];
  if (sk === 'fishing') { const rod = findTool('rod'); if (!rod) return log('You need a fishing rod.', '#ffb070'); if (spendTool(rod)) log('Your fishing rod snaps.', '#ff6a5a'); }
  if (sk === 'fishing' && !fishCheck(diff)) { log('Nothing bites.'); return again(); }   // forage: picking reagents takes no skill in the Second Age
  if (sk === 'fishing') { give('fish', 1, tier ? { q: tier } : null); simEmit('ResourceGathered', { actor: aidOf(P), skill: sk, item: 'fish', qty: 1, x: n.x, y: n.y }); log('You land a brine perch.'); snd('fish.catch', { key: 'P' }); return again(); }
  const st = nodeStock(n.x, n.y); st.n--; if (st.n <= 0) st.t = GT + 300;
  const out = NODE_OUT[n.t]; const q = sk === 'forage' ? 1 + (tier >= 2 ? 1 : 0) : 1; give(out, q, tier ? { q: tier } : null); simEmit('ResourceGathered', { actor: aidOf(P), skill: sk, item: out, qty: q, node: n.y * W + n.x, x: n.x, y: n.y });
  if (sk === 'mining' && R() < .12) give('ironshard', 2);
  log(`You gather ${q} ${SF.ITEMS[out].n.toLowerCase()}${tier ? ' (grade ' + (tier + 1) + ')' : ''}.`); sndAt('gather.forage', { x: n.x + .5, y: n.y + .5 });
  if (st.n <= 0) { log('The ' + n.name + ' is exhausted.'); return; }
  again();
  function again() { at(.15, () => { if (!P.task && !P.ghost && P.sel === n && Math.hypot(n.x + .5 - P.x, n.y + .5 - P.y) <= (sk === 'fishing' ? 8 : 2) && !overweight() && P.speed < .1) startGather(n); }); }
}
/* carving a corpse: any blade does it and it takes no skill (the Second Age had no Skinning skill); hides, meat, sinew and bone as before */
const carveBlade = () => { const w = P.equip.weapon && SF.weaponOf(P.equip.weapon); return (findTool('knife') || SF.count(P.pack, 'knife') || SF.count(P.pack, 'dagger') || (w && (w.skill === 'swordsmanship' || w.skill === 'fencing'))) ? true : false; };
function skin(c) {
  if (!carveBlade()) return log('You need a blade to carve with: a skinning knife, a dagger or an edged weapon in hand.', '#ffb070'); if (c.skinned) return log('Already carved.');
  P.task = { kind: 'skin', corpse: c, label: 'Carving', t0: GT, t1: GT + SF.GATHER_TIME.carve, still: true, x0: P.x, y0: P.y };
}
function finishSkin(c) {
  const d = MON[c.mon]; c.skinned = true; sndAt('skin.cut', c);
  for (const k in d.skin) { const q = rnd(d.skin[k][0], d.skin[k][1]); if (q) give(k, q); } log('You carve the ' + d.n + '.'); renderPanel();
}
function openCorpse(c) {
  if (P.ghost) return; if (dist(c, P) > 2) return log('Move within 2 m.'); if (!los(P, c)) return log('No line of sight.');
  P.opening = GT + .35; at(.35, () => { P.opening = 0; if (!c.gone && dist(c, P) <= 3) { P.lootOpen = c; openPanel('loot'); sndAt('loot.rummage', c); } });
}
function talk(n) { if (lawRefuses(n)) return; if (advTalk(n)) return; if (n.dev) return say(n, n.nav && n.nav.state === 'moving' ? 'On my way to ' + (n.nav.goal.name || 'somewhere') + '.' : 'Just passing through.'); if (!P.ghost && teachesHere(n)) { P.talkTo = n; return openPanel('trainer'); } if (lifeTalk(n)) return; if (annTalk(n)) return; if (n.role === 'assay' || n.role === 'qsmith') { if (P.ghost) return; P.talkTo = n; return openPanel('guild'); } if (n.role === 'quaywarden') { if (P.ghost) return resurrect(); P.talkTo = n; return openPanel('quest'); } if (n.role === 'healer' || n.role === 'guard') { if (P.ghost) return resurrect(); say(n, n.role === 'guard' ? 'Keep the peace inside the Quay.' : 'Rest easy. Bind at the shrine if you travel.'); return; } P.talkTo = n; openPanel(n.role === 'banker' || n.role === 'campbank' ? 'bank' : n.role === 'trainer' ? 'trainer' : 'shop'); }

/* ---------- world population ---------- */
function populate() {
  const B = r => BUILD.find(b => b.role === r);
  const npc = (role, name, x, y) => addEnt({ kind: 'npc', role, name, x, y, sect: 0 });
  npc('banker', 'Odile, banker', B('banker').cx, B('banker').cy + 1.5); npc('smith', 'Harl, smith', B('smith').cx + 2, B('smith').cy + 1.5);
  npc('trainer', 'Master Vey, trainer', B('trainer').cx, B('trainer').cy + 1); npc('workshop', 'Pell, bowyer', B('workshop').cx, B('workshop').cy - 1.5);
  npc('apothecary', 'Sorrel, apothecary', B('apothecary').cx, B('apothecary').cy - 1.5); npc('provisioner', 'Gus, provisioner', B('provisioner').cx, B('provisioner').cy - 1.5);
  npc('qsmith', 'Mara, quay smith', B('smith').x + 6.6, B('smith').y + 1.6); npc('assay', 'Dena, assaymaster', 81.5, 283.5);
  npc('healer', 'Sister Maud, healer', 94.5, 302.5); npc('quaywarden', 'Quaywarden Brann', 98.5, 305.5);
  for (const [x, y] of [[129.5, 297.5], [129.5, 303.5], [116.5, 260.5], [116.5, 340.5], [55.5, 285.5]]) npc('guard', 'Quay warden', x, y);
  const c = ZONES.camp; npc('healer', 'Old Fenna, camp healer', c.cx + 2.5, c.cy + 1.5); npc('campbank', 'Crow, camp strongbox', c.cx - 3.5, c.cy - 3.5); npc('outlaw', 'Mags, fence', c.cx + 3.5, c.cy - 3.5);
  annPopulate(npc);
  lifePopulate(npc); advPopulate(npc);   // advPopulate: the NPC adventurers (v0.36, src/adventurers.js)   // Living World phase 4: homes, workplaces, routines, residents, guard patrols, the travelling merchant (src/townlife.js)
  if (!ecoRestore()) for (let i = 0; i < 12; i++) { for (const s of SPAWNS) s.next = 0; spawnTick(true); }   // a save with its creatures brings them back (phase 6); otherwise the world fills fresh
}
const SHOPS = { provisioner: ['hatchet', 'pickaxe', 'knife', 'rod', 'tongs', 'sewkit', 'cloth', 'vial', 'bandage', 'lanternoil', 'cookedmeat', 'shirt', 'trousers', 'shoes', 'cloak', 'lute', 'lockpick', 'repairkit'], smith: ['dagger', 'kryss', 'spear', 'sword', 'battleaxe', 'glaive', 'mace', 'waraxe', 'hammer', 'ironbar', 'ringmail_tunic', 'ringmail_sleeves', 'ringmail_gloves', 'ringmail_leggings', 'chain_coif', 'chain_tunic', 'chain_leggings', 'plate_gorget', 'plate_chest', 'plate_arms', 'plate_gauntlets', 'plate_leggings', 'bascinet', 'open_helm', 'closed_helm', 'plate_helm', 'buckler', 'metal_shield', 'kite_shield'], workshop: ['shortbow', 'crossbow', 'heavycrossbow', 'arrow', 'bolt', 'pine', 'buckler', 'wooden_shield', 'strap', 'trapkit', 'repairkit'], apothecary: ['reedash', 'shelldust', 'marshroot', 'lanternoil', 'blacksalt', 'vial', 'draught', 'antidote', 'manatonic', 'stamtonic', 'cinder'], outlaw: ['bandage', 'draught', 'arrow', 'cookedmeat', 'cloth', 'vial', 'reedash', 'marshroot', 'knife', 'dagger', 'lockpick', 'venom', 'trapkit'] };
Object.assign(SHOPS, ANN_SHOPS);
/* v0.30 skill supplies: kindling and bedrolls, blank maps and scrolls, pens, crooks, poisons and the practice boxes */
for (const [role, ids] of [['provisioner', ['kindling', 'bedroll', 'crook', 'blankmap']], ['scholar', ['blankmap', 'mappen', 'blankscroll', 'scribepen']], ['mage', ['blankscroll', 'scribepen']], ['reagents', ['blankscroll']],
  ['tinker', ['mappen', 'scribepen', 'lockbox', 'trapbox', 'lockpick']], ['apothecary', ['poison_lesser', 'venom']], ['outlaw', ['lockpick', 'poison_lesser', 'venom']]]) if (SHOPS[role]) for (const id of ids) if (!SHOPS[role].includes(id)) SHOPS[role].push(id);
SF.SK.addInscription();   // one Inscription recipe per Magery spell (needs src/magery.js, loaded before the game)

/* ---------- main tick ---------- */
let spawnT = 0, saveT = 0;
function update(dt) {
  if (ONW) return onlineStep(dt);
  GT += dt;
  for (let i = TIMERS.length - 1; i >= 0; i--) if (GT >= TIMERS[i].t) { const t = TIMERS.splice(i, 1)[0]; try { t.fn(); } catch (e) { console.error(e); } }
  for (let i = EFX.length - 1; i >= 0; i--) { const f = EFX[i]; if (f.at && GT >= f.at) { f.at = 0; try { f.fn && f.fn(); } catch (e) { console.error(e); } if (f.k !== 'flask') { EFX.splice(i, 1); continue; } } if (f.until && GT > f.until) EFX.splice(i, 1); else if (f.k === 'proj' && GT > f.t1 + .05) EFX.splice(i, 1); }
  for (let i = FX.length - 1; i >= 0; i--) if (GT - FX[i].t0 > FX[i].dur) FX.splice(i, 1);
  if (!P) return;
  magicTick(dt);
  playerMove(dt); if (P.lunge) { P.lunge += dt / .2; if (P.lunge >= 1) P.lunge = 0; }
  if (!P.ghost) {
    attackTick(); prepTick(); bandageTick();
    if (P.task && GT >= P.task.t1) { const t = P.task; P.task = null; ({ hide: finishHide, gather: () => finishGather(t.node), skin: () => finishSkin(t.corpse), craft: () => finishCraft(t), ...TASKS }[t.kind] || (() => { }))(t); }
    worldTick(dt); questTick(); annTick(dt);
    // stamina
    const sMax = SF.maxStam(P); if (GT - (P.lastDrain || -9) > SF.STAM_DELAY) P.stam = Math.min(sMax, P.stam + (inCombat() ? SF.STAM_REGEN_COMBAT : SF.STAM_REGEN) * dt);
    // mana
    const medI = SF.EQ.effective(P).med, mr = SF.SK.manaRegen(P.int, sv('meditation'), medI, !!(P.meditating && GT - P.meditating.t0 > SF.MEDITATE_SETTLE));   // Second Age regeneration (src/skills.js)
    const mb = P.mana; P.mana = Math.min(SF.maxMana(P), P.mana + mr * dt); if (P.meditating) { P.meditating.gained += P.mana - mb; if (P.mana >= SF.maxMana(P)) { P.meditating = null; log('You are at peace.'); } }
    trackUpdate(); petLoyaltyTick(); campTick(); spiritTick();
    // health: slow out-of-combat recovery, faster when fed
    if (!inCombat() && !P.poison) P.hp = Math.min(SF.maxHp(P), P.hp + (P.fed > GT ? 1 : .1) * dt);
    if (P.poison && GT >= P.poison.next) { P.poison.next = GT + SF.POISON_GAP; damagePlayer(SF.POISON[P.poison.tier], null, 'poison'); if (P.poison && --P.poison.ticks <= 0) P.poison = null; }
  }
  lawTick(); advWorldTick(); npcdTick(); navTick(); ecoTick(); const aiT0 = DEV.on ? performance.now() : 0;
  for (const e of ents.slice()) {                                    // every actor is driven by its controller; corpses are objects that decay
    if (e.gone || e === P) continue;
    if (e.kind === 'corpse') { if (GT > e.expires) { if (e.mine) log('Your body has crumbled to dust, and everything on it is gone.', '#ff6a5a'); rmEnt(e); if (P.lootOpen === e) { closePanel(); P.lootOpen = null; } } continue; }
    const tick = CONTROL[WS ? simAdopt(e) : SIM.controllerFor(archetypeOf(e))]; if (tick) { const td = tierStep(e, dt); if (td) tick(e, td); }   // simulation tiers A/B/C (src/tiers.js)
  }
  if (DEV.on) DEV.aiMs = DEV.aiMs * .95 + (performance.now() - aiT0) * .05;
  sndTick();
  if (GT - spawnT > 1) { spawnT = GT; spawnTick(); }
  if (GT - saveT > 15) { saveT = GT; save(); }   // save() reports a failure itself, once until a save succeeds again
}
/* controllers (master spec §3). The player's controller is the input code above (playerMove, attackTick, prepTick); creatures run
   monsterTick and the ecosystem (ecology.js); townsfolk, merchants and guards follow their routines in townlife.js (lifeTick). */
function monsterTick(e, dt) {
  if (e.stam !== undefined && GT - (e.hitT || -9) > .75) e.stam = Math.min(monT2A(MON[e.type]).dex, e.stam + 3 * dt); const s0 = e.state; aiMon(e, dt); if (e.state !== s0) monSound(e, s0); ecoSoundTick(e);
  if (e.poison && GT >= e.poison.next) { e.poison.next = GT + SF.POISON_GAP; damageMon(e, SF.POISON[e.poison.tier], 'poison'); if (e.poison && --e.poison.ticks <= 0) e.poison = null; }
}
const CONTROL = { CivilianAI: (e, dt) => lifeTick(e, dt), MerchantAI: (e, dt) => lifeTick(e, dt), GuardAI: (e, dt) => lifeTick(e, dt), MonsterAI: monsterTick, AnimalAI: monsterTick, CriminalAI: monsterTick, PetAI: (e, dt) => petTick(e, dt), SummonAI: (e, dt) => petTick(e, dt), HirelingAI: (e, dt) => allyTick(e, dt), AdventurerAI: (e, dt) => advTick(e, dt) };   // AdventurerAI: v0.36 (src/adventurers.js)
function petTick(p, dt) {
  if (p.summon) return summonTick(p, dt);
  if (p.until && GT > p.until) { rmEnt(p); log('The Reedling sinks back into the reeds.'); return; }
  const d = MON[p.type] || { speed: 5, reach: 1.1, rec: 1.4, atk: 50, dmg: [4, 7] };
  const t = p.order === 'attack' && alive(p.tgt) && p.tgt.kind === 'mon' ? p.tgt : null; if (p.order === 'attack' && !t) p.order = 'follow';
  const goal = t || (p.order === 'stay' ? null : { x: P.x - .8, y: P.y + .8 });
  if (goal) { const dd = Math.hypot(goal.x - p.x, goal.y - p.y); const far = Math.hypot(P.x - p.x, P.y - p.y);
    if (!t && far > 24) { p.x = P.x - .8; p.y = P.y + .8; }
    if (dd > (t ? d.reach * .9 : .8)) { const s = Math.min(dd, d.speed * MOVE_SCALE * dt); moveBy(p, (goal.x - p.x) / dd * s, (goal.y - p.y) / dd * s); p.speed = s / dt; updateFacing(p, goal.x - p.x, goal.y - p.y); } else p.speed = 0; }
  else p.speed = 0;
  if (t && dist(p, t) <= d.reach + .2 && los(p, t) && GT > (p.ready || 0)) { p.ready = GT + d.rec + .4; p.state = 'strike'; p.atkRow = p.sect || 0; p.impactT = GT; at(.15, () => p.state = ''); strikeOne(p, t); }   // atkRow / impactT only drive the bestiary impact → recover pose
  if (p.hp < p.max && !inCombat()) p.hp = Math.min(p.max, p.hp + .5 * dt);
}

/* ================= WORLD: the island slice ================= */
const W = 2620, H = 1520, SW = 600;   // v0.23: Saltmarsh keeps its 600×600 slice at the origin; Anniabreen (stretched) lies east of it (src/anniabreen.js), the new lands south (src/frontier.js)
const T = { G: 0, TR: 1, WA: 2, RK: 3, SA: 4, RD: 5, FL: 6, WL: 7, DI: 8, SH: 9, FG: 10, AN: 11, BR: 12, DR: 13, AK: 14, LP: 15, BN: 16, ST: 17, FP: 18, RB: 19, SB: 20, HB: 21, SC: 22, FN: 23, BL: 24, MR: 25, SD: 26, SU: 27, CH: 28, CF: 29 };
const BLK = new Uint8Array(64); for (const t of [T.TR, T.WA, T.RK, T.WL, T.FG, T.AN, T.AK, T.LP, T.BN, T.ST, T.FP, T.FN, T.BL, T.MR, T.CH]) BLK[t] = 1;
const LOSB = new Uint8Array(64); SOFT[T.TR] = .2; SOFT[T.RK] = .22; SOFT[T.MR] = .16; for (const t of [T.WL, T.RK, T.FG, T.BL]) LOSB[t] = 1;     // trees and reeds are foliage: no LOS block
const NODE = { [T.TR]: 'lumberjacking', [T.RK]: 'mining', [T.RB]: 'forage', [T.SB]: 'forage', [T.HB]: 'forage', [T.SC]: 'forage' };   // forage: reagent picking, an activity with no skill (T2A)
const NODE_OUT = { [T.TR]: 'pine', [T.RK]: 'ore', [T.RB]: 'reedash', [T.SB]: 'shelldust', [T.HB]: 'marshroot', [T.SC]: 'blacksalt' };
const NODE_NAME = { [T.TR]: 'tree', [T.RK]: 'rock face', [T.RB]: 'reed bed', [T.SB]: 'shell bank', [T.HB]: 'marshroot clump', [T.SC]: 'salt crust' };
const map = new Uint8Array(W * H);
const tAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? T.WA : map[y * W + x];
const tSet = (x, y, t) => { if (x >= 0 && y >= 0 && x < W && y < H) map[y * W + x] = t; };
const blockedAt = (fx, fy) => BLK[tAt(Math.floor(fx), Math.floor(fy))] === 1;
const ZONES = {
  quay: { n: 'Saltmarsh Quay', x0: 56, y0: 262, x1: 128, y1: 338, guarded: true },
  camp: { n: 'Ashfen outlaw camp', cx: 472, cy: 290, r: 13 },
  bell: { n: 'Sunken Bell', cx: 360, cy: 172, r: 12 },
  homes: { n: 'Homestead Belt (leases in M3)', x0: 230, y0: 80, x1: 420, y1: 128 } };
const LEVELS = [{ id: 1, x0: 6, y0: 6 }, { id: 2, x0: 506, y0: 6 }, { id: 3, x0: 6, y0: 506 }], LV = 90;
function levelAt(x, y) { for (const L of LEVELS) if (x >= L.x0 && x < L.x0 + LV && y >= L.y0 && y < L.y0 + LV) return L.id; return 0; }
function zoneAt(x, y) {
  if (x >= SW || y >= SW) return annZone(x, y);
  const lv = levelAt(x, y); if (lv) return 'bell' + lv;
  const q = ZONES.quay; if (x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1) return 'quay';
  if (protAt(x, y)) return Math.hypot(x - LM.beacon.x, y - LM.beacon.y) < 12 ? 'beacon' : 'safe';
  if (Math.hypot(x - LM.cross.x, y - LM.cross.y) < 16) return 'cross';
  if (Math.abs(x - riverX(y)) < 10 && Math.abs(y - 300) < 14) return 'ford';
  if (Math.hypot(x - LM.wreck.x, y - LM.wreck.y) < 24) return 'wreck';
  if (Math.hypot(x - ZONES.camp.cx, y - ZONES.camp.cy) < ZONES.camp.r + 2) return 'camp';
  if (Math.hypot(x - ZONES.bell.cx, y - ZONES.bell.cy) < ZONES.bell.r + 4) return 'bell';
  if (Math.hypot(x - LM.pine.x, y - LM.pine.y) < 50) return 'pine';
  if (x > 400 && y > 370) return 'silt';
  const h = ZONES.homes; if (x >= h.x0 && x <= h.x1 && y >= h.y0 && y <= h.y1) return 'homes';
  if (x > 375) return 'ashfen';
  return 'roads';
}
const ZONE_NAME = { bell1: 'Sunken Bell · upper vault', bell2: 'Sunken Bell · drowned nave', bell3: 'Sunken Bell · bell chamber', quay: 'Saltmarsh Quay · protected', beacon: 'Shore Beacon · protected', safe: 'Protected road', cross: 'Brine Crossroads · wilderness', ford: 'Reedwater Ford · wilderness', wreck: 'Wreck Strand · wilderness', pine: 'Pinewatch Woods · wilderness', silt: 'Siltmarsh · wilderness', camp: 'Ashfen outlaw camp · unguarded', bell: 'Sunken Bell · sealed', homes: 'Homestead Belt', ashfen: 'Ashfen · wilderness', roads: 'Brine Roads · wilderness' };
Object.assign(ZONE_NAME, ANN_ZONE_NAME);
/* node tier by distance from the Quay: 0 (diff 15), 1 (45), 2 (70), rare 3 (85) */
function nodeTier(x, y) {
  if (isQuayNode(x, y)) return 0;
  if (x >= SW) return annTier(x, y);
  const h = hash(x, y); if (h % 41 === 0) return 3;
  const z = zoneAt(x, y); const lv = levelAt(x, y); if (lv) return Math.min(3, lv); if (z === 'ashfen' || z === 'camp') return 2;
  const d = Math.hypot(x - 92, y - 300); return d < 110 ? 0 : 1;
}
const SHRINES = [{ id: 'quay', n: 'Quay shrine', x: 92, y: 300 }, { id: 'camp', n: 'Ashfen shrine', x: 472, y: 290 }];
const BUILD = [], LIGHTS = [], STATIONS = [];
function mulberry(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(x, y) { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; }
function genWorld() {
  const r = mulberry(1999);
  const noise = cell => { const gw = Math.ceil(SW / cell) + 2, g = []; for (let i = 0; i < gw * gw; i++) g.push(r()); const s = t => t * t * (3 - 2 * t); return (x, y) => { const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy), u = s(fx - ix), v = s(fy - iy), a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1]; return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }; };
  const nCoast = noise(40), nFor = noise(14), nFor2 = noise(5), nRock = noise(11), nMarsh = noise(9), nMarsh2 = noise(4);
  map.fill(T.WA);
  for (let y = 0; y < SW; y++) for (let x = 0; x < SW; x++) {
    const dx = (x - 305) / 255, dy = (y - 300) / 235, d = Math.hypot(dx, dy) + (nCoast(x, y) - .5) * .22;
    let t = T.G;
    if (d > 1) t = T.WA; else if (d > .955) t = T.SA;
    else {
      const f = nFor(x, y) * .7 + nFor2(x, y) * .3;
      if (x > 378) {   // Ashfen wetlands
        const m = nMarsh(x, y) * .7 + nMarsh2(x, y) * .3;
        if (m < .28) t = T.WA; else if (m < .45) t = T.SH; else if (m > .7 && r() < .5) t = T.RB; else if (r() < .02) t = T.HB; else if (r() < .012) t = T.MR; else if (m > .6 && m < .64 && r() < .4) t = T.SC; else t = T.G;
      } else if (nRock(x, y) > .74 && x > 150) t = T.RK;
      else if (f > .58 && r() < .78) t = T.TR; else if (r() < .015) t = T.TR;
    }
    map[y * W + x] = t;
  }
  // shell banks along beaches
  for (let y = 1; y < SW - 1; y++) for (let x = 1; x < SW - 1; x++) if (map[y * W + x] === T.SA && r() < .04) map[y * W + x] = T.SB;
  const disc = (cx, cy, rad, fn) => { for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) { const d = Math.hypot(x - cx, y - cy) / rad; if (d <= 1) fn(x, y, d); } };
  // Lantern Quay
  const q = ZONES.quay;
  for (let y = q.y0 - 4; y <= q.y1 + 4; y++) for (let x = q.x0 - 14; x <= q.x1 + 4; x++) { if (x < q.x0 - 2) tSet(x, y, y >= 284 && y <= 316 ? T.WA : (tAt(x, y) === T.WA ? T.WA : T.SA)); else tSet(x, y, T.G); }
  for (let x = q.x0; x <= q.x1; x++) { if (x < 116 || x > 120) tSet(x, q.y0, T.FN); if (x < 116 || x > 120) tSet(x, q.y1, T.FN); }
  for (let y = q.y0; y <= q.y1; y++) { if (y < 298 || y > 302) tSet(q.x1, y, T.FN); if (y < 282 || y > 318) tSet(q.x0, y, T.FN); }
  // docks
  for (const py of [288, 289, 311, 312]) for (let x = 36; x < q.x0; x++) tSet(x, py, T.BR);
  for (let y = 288; y <= 312; y++) for (const px of [36, 37]) tSet(px, y, T.BR);
  for (let y = 286; y <= 314; y++) for (const px of [q.x0, q.x0 + 1]) tSet(px, y, T.RD);   // cobbled quayside where the piers land (v0.17)
  const carve = (pts, w, tile) => { for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]; const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let k = 0; k <= n; k++) { const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n); for (let oy = 0; oy < w; oy++) for (let ox = 0; ox < w; ox++) { const t = tAt(x + ox, y + oy); if ([T.FL, T.DR, T.AK, T.WL].includes(t)) continue; if (t === T.FN) { tSet(x + ox, y + oy, tile); continue; } tSet(x + ox, y + oy, t === T.WA || t === T.BR ? T.BR : (t === T.SH ? T.BR : tile)); } } } };
  // plaza and town roads
  disc(92, 300, 7, (x, y) => tSet(x, y, T.RD));
  carve([[q.x0, 299], [q.x1 + 1, 299]], 3, T.RD); carve([[117, q.y0], [117, q.y1 + 1]], 3, T.RD); carve([[92, 300], [92, q.y0 + 3]], 2, T.RD); carve([[92, 300], [92, q.y1 - 3]], 2, T.RD);
  const bld = (x, y, w, h, doorSide, role, mat) => {
    const d = 4, yy0 = doorSide === 'S' ? y + h - d : y; const b = kitBuilding(x, yy0, w, d, doorSide, mat, role); const dx = x + (w >> 1);
    const step = doorSide === 'S' ? 1 : -1; for (let k = 0; k < 30; k++) { const yy = (doorSide === 'S' ? yy0 + d : yy0 - 1) + k * step, t = tAt(dx, yy); if (t === T.RD || t === T.WL || t === T.FN || t === T.FL) break; tSet(dx, yy, T.RD); tSet(dx + 1, yy, T.RD); }
  };
  bld(62, 266, 11, 9, 'S', 'banker', 'stone'); bld(76, 266, 12, 9, 'S', 'smith', 'stone'); bld(96, 266, 12, 9, 'S', 'trainer', 'stone');
  bld(62, 324, 11, 9, 'N', 'workshop', 'timber'); bld(76, 324, 11, 9, 'N', 'apothecary', 'timber'); bld(96, 324, 12, 9, 'N', 'provisioner', 'timber');
  const B = r => BUILD.find(b => b.role === r);
  { const b = B('smith'); tSet(b.x + 2, b.y + 1, T.FG); tSet(b.x + 4, b.y + 1, T.AN); STATIONS.push({ k: 'forge', x: b.x + 2, y: b.y + 1 }, { k: 'anvil', x: b.x + 4, y: b.y + 1 }); }
  { const b = B('workshop'); tSet(b.x + 2, b.y + 2, T.BN); tSet(b.x + 7, b.y + 2, T.BN); STATIONS.push({ k: 'bench', x: b.x + 2, y: b.y + 2 }, { k: 'bench', x: b.x + 7, y: b.y + 2 }); }
  { const b = B('apothecary'); tSet(b.x + 2, b.y + 2, T.ST); STATIONS.push({ k: 'still', x: b.x + 2, y: b.y + 2 }); tSet(b.x + 8, b.y + 2, T.FP); STATIONS.push({ k: 'fire', x: b.x + 8, y: b.y + 2 }); }
  tSet(92, 300, T.AK);
  for (const [x, y] of [[86, 294], [98, 294], [86, 306], [98, 306], [116, 294], [116, 306], [127, 296], [127, 304]]) { if (!BLK[tAt(x, y)]) tSet(x, y, T.LP); }
  // practice ring marker (M2) — dirt circle
  disc(110, 314, 4, (x, y, d) => { if (tAt(x, y) === T.G) tSet(x, y, d > .8 ? T.FN : T.DI); }); tSet(106, 314, T.DI); tSet(114, 314, T.DI);
  // Brine Roads: quick road and two slower cover trails
  genBrine(r, carve, disc); dressQuay();
  // thin forests: kit trees have wide canopies
  // v0.20: a quarter of the trees and few boulders stay (Pinewatch included); with trunk-only collision, woods and rock fields are walkable
  for (let y = 0; y < SW; y++) for (let x = 0; x < SW; x++) { const t = map[y * W + x]; if ((t !== T.TR && t !== T.RK) || levelAt(x, y)) continue; const h = hash(x, y);
    if (t === T.TR ? h % 4 !== 0 : (h % 3 !== 0 || hash(x + 1, y) % 2 === 0 || hash(x, y + 1) % 2 === 0 && (x + y) % 2)) map[y * W + x] = t === T.TR && hash(x + 7, y) % 17 === 0 ? T.MR : T.G; }
  // ruins along the road: poor sight lines
  for (const [cx, cy] of [[232, 284], [318, 308], [270, 318], [395, 282]]) for (let i = 0; i < 16; i++) { const x = cx + Math.floor(r() * 9) - 4, y = cy + Math.floor(r() * 7) - 3; if (tAt(x, y) === T.G || tAt(x, y) === T.TR) tSet(x, y, T.WL); }
  // Ashfen outlaw camp
  const c = ZONES.camp; disc(c.cx, c.cy, c.r, (x, y, d) => tSet(x, y, d > .9 ? T.FN : T.DI));
  for (let k = -1; k <= 1; k++) { tSet(c.cx - c.r, c.cy + k, T.DI); tSet(c.cx - c.r + 1, c.cy + k, T.DI); tSet(c.cx + c.r, c.cy + k, T.DI); tSet(c.cx + c.r - 1, c.cy + k, T.DI); }
  carve([[459, 290], [c.cx - c.r + 2, 290]], 3, T.RD);
  tSet(c.cx, c.cy, T.AK); tSet(c.cx + 5, c.cy + 4, T.FP); STATIONS.push({ k: 'fire', x: c.cx + 5, y: c.cy + 4 }); tSet(c.cx - 5, c.cy + 5, T.BN); STATIONS.push({ k: 'bench', x: c.cx - 5, y: c.cy + 5 });
  LIGHTS.push({ x: c.cx + 5, y: c.cy + 4, r: 6 });
  // Sunken Bell ruin: the bell is the way down; a second hatch opens in north Ashfen
  const b = ZONES.bell; disc(b.cx, b.cy, b.r, (x, y, d) => tSet(x, y, d > .82 ? (r() < .7 ? T.WL : T.DI) : T.DI)); tSet(b.cx, b.cy, T.SD); tSet(b.cx + 1, b.cy - 1, T.BL); for (let k = 0; k < 3; k++) tSet(b.cx - b.r + k, b.cy, T.DI);
  disc(432, 216, 3.5, (x, y) => tSet(x, y, T.DI)); tSet(432, 216, T.SD); carve([[432, 219], [432, 250], [440, 276]], 1, T.DI);
  genDungeon(r, carve);
  for (const [x, y] of [[234, 288], [320, 304], [397, 279]]) placeChest(x, y, 0);
  placeChest(470, 300, 1); placeChest(362, 168, 0);
  // Homestead Belt lease plots (decor)
  for (let px = 240; px < 410; px += 26) for (const py of [88, 108]) for (let i = 0; i < 14; i++) for (let j = 0; j < 12; j++) { if (tAt(px + i, py + j) === T.WA) continue; const e = i === 0 || j === 0 || i === 13 || j === 11; if (e && !(i === 6 || i === 7)) tSet(px + i, py + j, T.FN); else if (!e) tSet(px + i, py + j, T.G); }
  placeQuayNodes();
  genAnniabreen(carve, disc); genFrontier(carve, disc);
  ecoGenerate();   // Living World phase 3: habitat regions, wildlife spawners, camps (own seeded stream: the map is unchanged)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = map[y * W + x]; if (t === T.LP) LIGHTS.push({ x, y, r: 5 }); if (t === T.FG) LIGHTS.push({ x, y, r: 4 }); if (t === T.AK) LIGHTS.push({ x, y, r: 4 }); }
}
const RES = new Map();

/* ---- Sunken Bell: three levels with two surface exits ---- */
const STAIRS = [], CHESTS = new Map(), VOID = new Uint8Array(W * H);
/* dungeon chests of the second and third tier are trapped half the time (power 40 / 70): Detecting Hidden finds it, Remove Trap clears it */
function chestTrapRoll(c) { c.trap = c.tier >= 1 && R() < .5 ? [0, 40, 70][c.tier] : 0; c.trapSeen = false; return c; }
function placeChest(x, y, tier) { for (let k = 0; k < 8; k++) { const xx = x + (k % 3) - 1, yy = y + Math.floor(k / 3) - 1; const t = tAt(xx, yy); if (!BLK[t] && t !== T.WA && t !== T.SD && t !== T.SU) { tSet(xx, yy, T.CH); CHESTS.set(yy * W + xx, chestTrapRoll({ x: xx, y: yy, tier, open: false, refill: 0 })); return; } } }
function genDungeon(r, carve) {
  const rooms = {};
  for (const L of LEVELS) {
    for (let y = L.y0; y < L.y0 + LV; y++) for (let x = L.x0; x < L.x0 + LV; x++) tSet(x, y, T.WL);
    const R2 = []; let tries = 0;
    while (R2.length < 9 && tries++ < 400) { const w = 8 + Math.floor(r() * 8), h = 7 + Math.floor(r() * 7), x = L.x0 + 3 + Math.floor(r() * (LV - w - 6)), y = L.y0 + 3 + Math.floor(r() * (LV - h - 6)); if (R2.some(o => x < o.x + o.w + 3 && x + w + 3 > o.x && y < o.y + o.h + 3 && y + h + 3 > o.y)) continue; R2.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) }); }
    if (L.id === 3) { const bx = L.x0 + 50, by = L.y0 + 50; R2.push({ x: bx, y: by, w: 20, h: 18, cx: bx + 10, cy: by + 9, boss: true }); }
    R2.sort((a, b) => (a.cx + a.cy) - (b.cx + b.cy));
    for (const o of R2) for (let y = o.y; y < o.y + o.h; y++) for (let x = o.x; x < o.x + o.w; x++) tSet(x, y, T.CF);
    for (let i = 0; i < R2.length - 1; i++) { const a = R2[i], b = R2[i + 1]; for (const [x, y] of lpath(a.cx, a.cy, b.cx, b.cy)) for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (tAt(x + ox, y + oy) === T.WL) tSet(x + ox, y + oy, T.CF); }
    for (const o of R2) { tSet(o.x + 1, o.y + 1, T.LP); if (r() < .5) tSet(o.x + o.w - 2, o.y + o.h - 2, T.LP); if (!o.boss && r() < .45) for (let k = 0; k < 3; k++) { const x = o.x + 1 + Math.floor(r() * (o.w - 2)), y = o.y + 1 + Math.floor(r() * (o.h - 2)); if (tAt(x, y) === T.CF) tSet(x, y, T.RK); } }
    rooms[L.id] = R2;
  }
  for (const L of LEVELS) for (let y = L.y0; y < L.y0 + LV; y++) for (let x = L.x0; x < L.x0 + LV; x++) { if (tAt(x, y) !== T.WL) continue; let near = false; for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) { const t = tAt(x + dx, y + dy); if (t !== T.WL) { near = true; break; } } if (!near) VOID[y * W + x] = 1; }
  const link = (ax, ay, bx, by) => { STAIRS.push({ x: ax, y: ay, to: { x: bx + .5, y: by + 1.6 } }); };
  const st = (o, t) => { const x = o.cx, y = o.cy; tSet(x, y, t); return [x, y]; };
  const L1 = rooms[1], L2 = rooms[2], L3 = rooms[3];
  const e1 = st(L1[0], T.SU), e2 = st(L1[L1.length - 1], T.SU), d1 = st(L1[Math.floor(L1.length / 2)], T.SD);
  const u2 = st(L2[0], T.SU), d2 = st(L2[L2.length - 1], T.SD), u3 = st(L3[0], T.SU);
  link(360, 172, e1[0], e1[1]); link(e1[0], e1[1], 360, 172); link(432, 216, e2[0], e2[1]); link(e2[0], e2[1], 432, 216);
  link(d1[0], d1[1], u2[0], u2[1]); link(u2[0], u2[1], d1[0], d1[1]); link(d2[0], d2[1], u3[0], u3[1]); link(u3[0], u3[1], d2[0], d2[1]);
  const mk = (o, type, max, extra) => SPAWNS.push(Object.assign({ type, x: o.cx + .5, y: o.cy + .5, r: Math.min(o.w, o.h) / 2 - 1, max, n: 0, next: 0 }, extra || {}));
  const rc = mulberry(2027), rpick = a => a[Math.floor(rc() * a.length)];   // dungeon spawn types and chests: their own seeded stream (Living World Phase 1), the same in every session; the map stream r is untouched
  L1.forEach((o, i) => { if (i === 0 || i === L1.length - 1) return; mk(o, rpick(['spider', 'smuggler', 'skeleton', 'skeleton']), 2); if (rc() < .5) placeChest(o.x + 2, o.y + o.h - 2, i % 2 ? 1 : 0); });
  L2.forEach((o, i) => { if (i === 0) return; mk(o, rpick(['wisp', 'sentinel', 'skeleton']), 2); if (rc() < .5) placeChest(o.x + 2, o.y + o.h - 2, 1); });
  L3.forEach((o, i) => { if (i === 0) return; if (o.boss) { mk(o, 'bellkeeper', 1, { r: 1, delay: 600, boss: true }); placeChest(o.x + 2, o.y + 2, 2); placeChest(o.x + o.w - 3, o.y + 2, 2); return; } mk(o, rpick(['sentinel', 'captain', 'wisp']), i % 3 === 0 ? 1 : 2); if (rc() < .5) placeChest(o.x + 2, o.y + o.h - 2, 2); });
}
function lpath(x0, y0, x1, y1) { const out = []; let x = x0, y = y0; while (x !== x1) { out.push([x, y]); x += Math.sign(x1 - x); } while (y !== y1) { out.push([x, y]); y += Math.sign(y1 - y); } out.push([x, y]); return out; }

/* ================= ENVIRONMENT KIT: Saltmarsh art, modular buildings, edge colliders ================= */
// ENV_ATLAS {cat: dataURI}; ENV_SPR {id: [cat, ax, ay, w, h, px, py]} come from build.py (environment_manifest.json)
const ENVI = {}; let ENVOK = false;
{ let n = 0; const cats = Object.keys(ENV_ATLAS); for (const c of cats) { const im = new Image(); im.onload = () => { ENVI[c] = im; if (++n === cats.length) ENVOK = true; }; im.src = ENV_ATLAS[c]; } }
const HPX = 39.19;   // screen px per world unit of height
function envDraw(g, id, wx, wy, h, alpha) {
  const s = ENV_SPR[id]; if (!s) return; const im = ENVI[s[0]]; if (!im) return;
  const X = Math.round(SX(wx, wy) - s[5]), Y = Math.round(SY(wx, wy) - (h || 0) * HPX - s[6]);
  if (alpha !== undefined && alpha < 1) { const a = g.globalAlpha; g.globalAlpha = a * alpha; g.drawImage(im, s[1], s[2], s[3], s[4], X, Y, s[3], s[4]); g.globalAlpha = a; }
  else g.drawImage(im, s[1], s[2], s[3], s[4], X, Y, s[3], s[4]);
}
/* ---- edge colliders (walls, props) bucketed per tile ---- */
const ECOL = new Map();
function addCol(x0, y0, x1, y1) { const r = [x0, y0, x1, y1]; for (let y = Math.floor(y0 - .5); y <= Math.floor(y1 + .5); y++) for (let x = Math.floor(x0 - .5); x <= Math.floor(x1 + .5); x++) { const k = y * W + x; let a = ECOL.get(k); if (!a) ECOL.set(k, a = []); a.push(r); } }
function colBlocked(x, y, r) { const k = Math.floor(y) * W + Math.floor(x), a = ECOL.get(k); if (a) for (const c of a) if (x + r > c[0] && x - r < c[2] && y + r > c[1] && y - r < c[3]) return true;
  const ds = DOORK.get(k); if (ds) for (const d of ds) { const c = d.col; if (!d.open && x + r > c[0] && x - r < c[2] && y + r > c[1] && y - r < c[3]) return true; } return false; }
function addSprCol(id, ax, ay) { const m = ENV_COL[id]; if (m) for (const c of m) addCol(ax + c[0], ay + c[1], ax + c[2], ay + c[3]); }
/* ---- placed pieces bucketed per tile; each has its own sort depth ---- */
const PIECES = new Map();
function place(id, x, y, o) { o = o || {}; const p = { id, x, y, h: o.h || 0, d: o.d !== undefined ? o.d : x + y, grp: o.grp || null, near: !!o.near, roof: !!o.roof }; const bx = o.bx !== undefined ? o.bx : x, by = o.by !== undefined ? o.by : y; const k = Math.floor(by) * W + Math.floor(bx); let a = PIECES.get(k); if (!a) PIECES.set(k, a = []); a.push(p); if (o.col) addSprCol(id, x, y); return p; }
const KBUILD = [];
/* ---- doors: each kit doorway keeps its placed leaf. Open by default (older saves have no door state); a closed
   leaf swaps to door_closed_x and adds its own edge collider. The frame's side colliders never change. ---- */
const DOORS = [], DOORK = new Map();
function regDoor(x, y, leaf, mat) {
  const m = ENV_COL.door_closed_x[0], d = { x, y, key: x + ',' + y, leaf, openId: leaf.id, mat, open: true, cd: 0, col: [x + m[0], y + m[1], x + m[2], y + m[3]] };
  for (let ty = Math.floor(d.col[1] - .5); ty <= Math.floor(d.col[3] + .5); ty++) for (let tx = Math.floor(d.col[0] - .5); tx <= Math.floor(d.col[2] + .5); tx++) { const k = ty * W + tx; let a = DOORK.get(k); if (!a) DOORK.set(k, a = []); a.push(d); }
  DOORS.push(d); return d;
}
function setDoor(d, open) { if (d.open !== open) NAV.epoch++; d.open = open; d.leaf.id = open ? d.openId : 'door_closed_x'; if (P && P.cx) { P.cx.doors = P.cx.doors || {}; if (open) delete P.cx.doors[d.key]; else P.cx.doors[d.key] = 0; } }
function applyDoorState() { const st = (P.cx && P.cx.doors) || {}; for (const d of DOORS) setDoor(d, st[d.key] !== 0); }
const doorDist = d => Math.hypot(d.x + .5 - P.x, d.y - P.y);
function nearDoor(r) { let best = null, bd = r || 1.6; for (const d of DOORS) { const dd = doorDist(d); if (dd < bd) { bd = dd; best = d; } } return best; }
/* one toggle per accepted action; repeats within the debounce are swallowed; never closes on an actor */
function useDoor(d) {
  if (GT < d.cd) return; d.cd = GT + .45;
  if (d.open) { const c = d.col, r = .3; if (ents.some(e => !e.gone && e.kind !== 'corpse' && !(e === P && P.ghost) && e.x + r > c[0] && e.x - r < c[2] && e.y + r > c[1] && e.y - r < c[3])) return log('Something is standing in the doorway.', '#ffb070'); }
  setDoor(d, !d.open); sndAt(d.open ? 'door.' + d.mat + '.open' : 'door.' + d.mat + '.close', { x: d.x + .1, y: d.y }, { key: 'door' + d.key });
}
/* which door, if any, a screen tap lands on: the leaf stands about one storey above its edge */
function doorAtScreen(wx, wy) { for (const d of DOORS) { const X = SX(d.x + .5, d.y), Y = SY(d.x + .5, d.y); if (Math.abs(wx - X) < 22 && wy < Y + 8 && wy > Y - 76) return d; } return null; }
/* A modular building: floor cells [x, x+w) × [y, y+d) with d even; walls on grid edges; gabled roof pairs along X; door on the south or north edge */
function kitBuilding(x, y, w, d, doorSide, mat, role) {
  const wall = mat === 'stone' ? 'saltstone' : 'timber', B = { x, y, w, h: d, role, cx: x + w / 2, cy: y + d / 2, kit: true };
  const doorX = x + (w >> 1), doorY = doorSide === 'S' ? y + d : y;
  for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) tSet(x + i, y + j, T.FL);
  B.floor = mat === 'stone' ? 'floor_flagstone' : 'floor_timber';
  const grp = B; const near = (ex, ey, axis) => axis === 'x' ? ey === y + d : ex === x + w;
  for (let i = 0; i < w; i++) for (const ey of [y, y + d]) {
    const isDoor = ey === doorY && x + i === doorX; const win = !isDoor && (i % 3 === 1);
    const id = isDoor ? `wall_${wall}_doorframe_x` : win ? `wall_${wall}_window_x` : `wall_${wall}_x`;
    place(id, x + i, ey, { d: x + i + .5 + ey, grp, near: near(x + i, ey, 'x'), col: true });
    if (isDoor) { regDoor(x + i, ey, place(doorSide === 'S' ? 'door_open_left_x' : 'door_open_right_x', x + i, ey, { d: x + i + .52 + ey, grp, near: near(x + i, ey, 'x') }), 'wood'); if (doorSide === 'S') { place('foundation_step_x', x + i, ey, { d: x + i + ey + .3 }); place('lantern_wall_lit', x + i + .88, ey + .12, { h: 1.58, d: x + i + ey + 1.05, grp, near: true }); LIGHTS.push({ x: x + i + 1, y: ey + .3, r: 4 }); } }
  }
  for (let j = 0; j < d; j++) for (const ex of [x, x + w]) { const win = j % 2 === 1; place(`wall_${wall}_${win ? 'window_' : ''}z`, ex, y + j, { d: ex + y + j + .5, grp, near: near(ex, y + j, 'z'), col: true }); }
  for (const [cx, cy] of [[x, y], [x + w, y], [x, y + d], [x + w, y + d]]) place(`corner_${wall}`, cx, cy, { d: cx + cy + .02, grp, near: cx === x + w || cy === y + d, col: true });
  // roof: gabled pairs along X, back to front; drawn as one group just behind the front corner
  const roof = []; for (let z = y; z < y + d; z += 2) { for (let i = 0; i < w; i++) { roof.push(['roof_far_x', x + i, z]); roof.push(['roof_near_x', x + i, z + 1]); } roof.push(['gable_far_x', x, z], ['gable_near_x', x, z + 1], ['gable_far_x', x + w, z], ['gable_near_x', x + w, z + 1]); }
  if (mat === 'stone') roof.push(['chimney_saltstone', x + .45, y + .8]);
  B.roof = roof; place('__roof', x, y, { d: x + w + y + d - .4, grp, roof: true, bx: x + (w >> 1), by: y + (d >> 1) });
  KBUILD.push(B); BUILD.push(B); return B;
}
function insideBuild(px, py) { for (const b of KBUILD) if (px > b.x && px < b.x + b.w && py > b.y && py < b.y + b.h) return b; return null; }
/* ---- ground mapping ---- */
const VAR = h => (h % 7 === 0 ? 2 : h % 5 === 0 ? 3 : 1);
function envGroundId(t, x, y, wf) {
  const h = hash(x, y);
  switch (t) {
    case T.G: case T.TR: case T.RK: case T.BS: case T.BC: return 'ground_grass_' + VAR(h);
    case T.DI: case T.BL: case T.CH: case T.FP: return 'ground_dirt_' + VAR(h);
    case T.RD: case T.AK: case T.LP: case T.SBR: return 'ground_cobble_' + VAR(h);
    case T.GV: return 'ground_grass_' + VAR(h);
    case T.CP: return 'ground_dirt_' + VAR(h);
    case T.SA: case T.SB: case T.SC: return 'ground_sand_' + VAR(h);
    case T.HB: return 'ground_mud_' + VAR(h);
    case T.MR: case T.RB: return 'ground_mud_' + VAR(h);
    case T.SH: return 'ground_water_shallow_' + (h % 3 + 1);
    case T.WA: case T.BR: return 'ground_water_' + (h % 3 + 1);
    case T.FL: case T.DR: case T.FG: case T.AN: case T.BN: case T.ST: case T.FN: return insideBuildTile(x, y) ? 'ground_cobble_1' : 'ground_grass_1';
  }
  return null;
}
function insideBuildTile(x, y) { for (const b of KBUILD) if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return b; return null; }
const isWet = t => t === T.WA || t === T.SH || t === T.BR || t === T.SBR;
/* overlays drawn after the whole ground pass: shorelines, floors, decks */
function envOverlay(g, t, x, y) {
  if (t === T.FL || t === T.DR || t === T.FG || t === T.AN || t === T.BN || t === T.ST) { const b = insideBuildTile(x, y); if (b) return envDraw(g, b.floor, x, y); }
  if (t === T.BR) { const ax = tAt(x - 1, y) === T.BR || tAt(x + 1, y) === T.BR, az = tAt(x, y - 1) === T.BR || tAt(x, y + 1) === T.BR; envDraw(g, ax && !az ? 'boardwalk_straight_x' : az && !ax ? 'boardwalk_straight_z' : 'pier_platform', x, y); return; }
  if (t === T.SB || t === T.SC) { const X = Math.round(SX(x + .5, y + .5)), Y = Math.round(SY(x + .5, y + .5)), h = hash(x, y); g.fillStyle = t === T.SB ? '#efe6d2' : '#f4f4f0'; for (let k = 0; k < 6; k++) g.fillRect(X - 12 + ((h >> (k * 3)) % 24), Y - 5 + ((h >> (k * 2 + 1)) % 10), t === T.SB ? 3 : 4, 2); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(X - 4, Y + 2, 8, 1); }
  if (!isWet(t) && levelAt(x, y) === 0) { const m = (isWet(tAt(x - 1, y)) ? 1 : 0) | (isWet(tAt(x + 1, y)) ? 2 : 0) | (isWet(tAt(x, y - 1)) ? 4 : 0) | (isWet(tAt(x, y + 1)) ? 8 : 0); if (m) envDraw(g, 'shore_sand_' + String(m).padStart(2, '0'), x, y); }
}
/* ---- tall tiles drawn with kit sprites ---- */
function envTall(g, t, x, y) {
  const h = hash(x, y), cx = x + .5, cy = y + .5;
  if (t === T.TR) { const o = RES.get(y * W + x); if (o && o.n <= 0) { envDraw(g, 'stump_cut', cx, cy); return true; } const z = zoneAt(x, y); const pool = z === 'pine' || z === 'homes' ? ['tree_salt_pine', 'tree_salt_pine', 'tree_salt_pine', 'tree_autumn_birch'] : z === 'ashfen' || z === 'silt' || z === 'camp' ? ['tree_dead_snag', 'tree_marsh_oak', 'tree_dead_snag'] : ['tree_salt_pine', 'tree_marsh_oak', 'tree_salt_pine', 'tree_autumn_birch', 'tree_salt_pine']; envDraw(g, pool[h % pool.length], cx + ((h >> 4) % 5 - 2) * .05, cy); return true; }
  if (t === T.RK) { const o = RES.get(y * W + x), sv0 = P && P.cx && o && P.cx.survey[y * W + x]; envDraw(g, 'boulder_moss', cx, cy); if (o && o.n <= 0) { g.fillStyle = 'rgba(30,28,26,.55)'; g.fillRect(Math.round(SX(cx, cy)) - 10, Math.round(SY(cx, cy)) - 20, 20, 3); return true; } if (isQuayNode(x, y)) { g.fillStyle = '#ffd23a'; g.fillRect(Math.round(SX(cx, cy)) + 9, Math.round(SY(cx, cy)) - 30, 2, 12); g.fillRect(Math.round(SX(cx, cy)) + 11, Math.round(SY(cx, cy)) - 30, 6, 4); } g.fillStyle = sv0 && sv0.gen === o.gen && sv0.id ? SF.METAL[sv0.id].col : '#b08a50'; g.fillRect(Math.round(SX(cx, cy)) - 6, Math.round(SY(cx, cy)) - 18, 3, 2); g.fillRect(Math.round(SX(cx, cy)) + 4, Math.round(SY(cx, cy)) - 12, 2, 2); return true; }
  if (t === T.RB) { envDraw(g, 'reeds_salt', cx - .15, cy); envDraw(g, 'reeds_salt', cx + .2, cy + .15); return true; }
  if (t === T.MR) { envDraw(g, 'shrub_marsh', cx, cy); return true; }
  if (t === T.HB) { envDraw(g, 'shrub_marsh', cx, cy); g.fillStyle = '#c8e070'; g.fillRect(Math.round(SX(cx, cy)) - 2, Math.round(SY(cx, cy)) - 20, 3, 3); return true; }
  if (t === T.LP) { envDraw(g, 'lantern_post', cx, cy); return true; }
  if (t === T.CH && !levelAt(x, y)) { envDraw(g, 'chest_iron', cx, cy); return true; }
  if (t === T.FN) { const fx = tAt(x - 1, y) === T.FN || tAt(x + 1, y) === T.FN, fz = tAt(x, y - 1) === T.FN || tAt(x, y + 1) === T.FN, stone = insideQuayBox(x, y);
    const k = stone ? 'stone' : 'wood'; if (fx) envDraw(g, `fence_${k}_x`, x, cy); if (fz) envDraw(g, `fence_${k}_z`, cx, y); envDraw(g, `fence_${k}_post`, cx, cy); return true; }
  return false;
}
function insideQuayBox(x, y) { const q = ZONES.quay; return x >= q.x0 - 1 && x <= q.x1 + 1 && y >= q.y0 - 1 && y <= q.y1 + 1; }
function drawPiece(g, p) {
  if (p.draw) return p.draw(g, p);
  const inB = P && insideBuild(P.x, P.y);
  if (p.roof) { const a = inB === p.grp ? .12 : 1; for (const [id, x, y] of p.grp.roof) envDraw(g, id, x, y, 0, a); return; }
  envDraw(g, p.id, p.x, p.y, p.h, p.near && inB === p.grp ? .35 : 1);
}
/* ---- town dressing: props with small colliders ---- */
function dressQuay() {
  const prop = (id, x, y) => place(id, x, y, { col: true });
  for (const [x, y] of [[40.5, 286.6], [44.5, 286.7], [50.4, 290.3], [40.6, 313.4], [47.3, 310.3]]) prop((x * 7 | 0) % 2 ? 'barrel_dock' : 'crate_shipping', x, y);
  for (const [x, y] of [[38.2, 287.3], [38.3, 312.4], [55.6, 289.6], [55.6, 310.6]]) prop('bollards_rope', x, y);
  for (const [x, y] of [[36.1, 288.1], [36.1, 313.9], [56.9, 288.1], [56.9, 313.9], [36.1, 300.5]]) place('dock_piling', x, y);
  place('net_fishing', 45.2, 289.4); place('net_fishing', 49.6, 311.6);
  place('sign_pier', 58.5, 295.5, { col: true });
  place('awning_market', 104.5, 318.6); prop('barrel_dock', 102.6, 319.2); prop('crate_shipping', 107.2, 318.9);
  prop('barrel_dock', 74.6, 276.6); prop('crate_shipping', 89.4, 276.6); prop('barrel_dock', 60.6, 322.6);
  place('stump_cut', 121.4, 318.4, { col: true }); place('shrub_marsh', 60.5, 300.5); place('shrub_marsh', 124.5, 284.5);
}

/* ================= CONTENT (M3 offline): dungeon travel, chests, traps, pets, bard, stealth, theft, venom, appraisal, repair ================= */
const TRAPS = [];
/* ================= skills in the world: every active skill's real action (rules: src/skills.js SF.SK; status: docs/skills/STATUS.md) =================
   One usage delay per skill (P.cdA), checks through skillCheck/skillUse, targets by selection or by a tap after a prompt (pickTarget). */
const SKD = SF.SK;
const ITEM_SKILL = {};   // item-target skills (Arms Lore, Taste Identification, treasure maps) register here; itemSkill() dispatches
const cdLeft = id => Math.max(0, ((P.cdA || {})[id] || 0) - GT);
function skillDelay(id, s) { P.cdA = P.cdA || {}; P.cdA[id] = GT + s; }
const hasInstrument = () => SF.count(P.pack, 'lute') > 0;
const monDiff = m => (MON[m.type] && MON[m.type].diff) || 30;
const HUMANOID = { smuggler: 1, bandit: 1, captain: 1, orc: 1, lizardman: 1 };          // creatures that carry a pack worth snooping
const isAnimal = m => m && m.kind === 'mon' && SPECIES_CLASS[m.type] === 'animal';
const packOwner = e => e && !e.gone && ((e.kind === 'mon' && alive(e) && HUMANOID[e.type]) || (e.kind === 'npc' && e.role !== 'guard' && !e.dev));
/* a prompt for a creature or person: uses the current selection when it fits, otherwise waits for the next tap (15 s, Escape cancels) */
function pickTarget(prompt, ok, fn, useSel) {
  if (useSel !== false && P.sel && ok(P.sel)) return fn(P.sel);
  PICKT = { prompt, ok, fn, until: GT + 15 }; log(prompt, '#9fd0ff');
}
function pickTap(hits) {
  if (!PICKT) return false; if (GT > PICKT.until) { PICKT = null; return false; }
  const e = hits.find(PICKT.ok); if (!e) { log('That is not a valid target. ' + PICKT.prompt, '#ffb070'); return true; }
  const f = PICKT.fn; PICKT = null; P.sel = e; f(e); return true;
}
const inReach = (e, r) => { if (dist(e, P) > r) { log(`Move within ${Math.round(r * 10) / 10} m.`, '#ffb070'); return false; } if (!los(P, e)) { log('No line of sight.', '#ffb070'); return false; } return true; };
// ---- pets: tamed creatures and summons. Summons keep their Magery control slots; tamed pets have no classic cap (a safety limit here)
const petSlotsUsed = () => ents.filter(e => e.kind === 'pet' && !e.gone).reduce((a, p) => a + (p.slots || 1), 0);
const tamedPets = () => ents.filter(e => e.kind === 'pet' && !e.gone && e.type && !e.summon);
const tameMin = type => SKD.TAME_MIN[type] !== undefined ? SKD.TAME_MIN[type] : null;
const loyaltyWord = p => SKD.LOYALTY.labels[Math.max(0, Math.min(10, Math.round(p.loyal === undefined ? 10 : p.loyal)))];
function cdReady(id, cd) { P.cdA = P.cdA || {}; if (GT < (P.cdA[id] || 0)) { log((ABIL[id] ? ABIL[id].n : cap1(id)) + ' is not ready (' + Math.ceil(P.cdA[id] - GT) + ' s).'); return false; } if (cd) P.cdA[id] = GT + cd; return true; }
function selMon(range, needAware) {
  const t = P.sel; if (!t || t.kind !== 'mon' || !alive(t)) { const a = autoTarget(); if (!a) { log('Select a creature first.', '#ffb070'); return null; } }
  const m = P.sel; if (range && dist(m, P) > range) { log('Move within ' + range + ' m.', '#ffb070'); return null; } if (!los(P, m)) { log('No line of sight.', '#ffb070'); return null; } return m;
}
/* actions that reveal a hidden player (the classic rule: using most skills unhides you; Hiding, Stealth, Detect, Snooping-unhides, Stealing do not) */
const KEEPS_HIDDEN = { stealth: 1, detect: 1, steal: 1, track: 1, hide: 1 };
function useAbilityReveal(id) { if (P.hidden && !KEEPS_HIDDEN[id]) reveal('You use a skill and are revealed.'); }
const ABIL = {
  bandother: { n: 'Bandage other', fn: () => firstAidOther() },
  anatomy: { n: 'Anatomy', cd: 1, fn: () => { if (cdReady('anatomy', 1)) anatomyCheck(); } },
  stealth: { n: 'Stealth', cd: 10, fn: () => stealthUse() },
  detect: { n: 'Detect Hidden', cd: 10, fn: () => { if (P.ghost || !cdReady('detect', 10)) return; P.task = { kind: 'search', label: 'Searching', t0: GT, t1: GT + SF.SEARCH.wind, still: true, x0: P.x, y0: P.y }; } },
  tame: { n: 'Animal Taming', cd: 10, fn: () => pickTarget('Tap the creature you want to tame.', e => e.kind === 'mon' && alive(e), tameStart) },
  lore: { n: 'Animal Lore', cd: 1, fn: () => pickTarget('Tap a creature to study.', e => (e.kind === 'mon' || e.kind === 'pet') && alive(e) && !!e.type, loreUse) },
  vet: { n: 'Veterinary', fn: () => pickTarget('Tap the pet to treat.', e => e.kind === 'pet' && !e.gone && !!e.type, vetStart) },
  feed: { n: 'Feed pet', fn: () => pickTarget('Tap the pet to feed.', e => e.kind === 'pet' && !e.gone && !!e.type, feedPet) },
  play: { n: 'Musicianship', cd: 5, fn: () => playMusic() },
  peace: { n: 'Peacemaking', cd: SKD.BARD.delay, fn: () => peaceUse() },
  entice: { n: 'Enticement', cd: SKD.BARD.delay, fn: () => pickTarget('Tap the creature to lure.', e => e.kind === 'mon' && alive(e), enticeUse) },
  provoke: { n: 'Provocation', cd: SKD.BARD.delay, fn: () => provokeStart() },
  steal: { n: 'Stealing', cd: SKD.STEAL.delay, fn: () => pickTarget('Tap the person or creature to steal from (or steal from a pack you have snooped).', packOwner, e => stealStart(e, null)) },
  poison: { n: 'Poisoning', fn: () => { P.talkTo = null; openPanel('poison'); } },
  picklock: { n: 'Lockpicking', fn: () => lockUse() },
  untrap: { n: 'Remove Trap', cd: 10, fn: () => untrapUse() },
  evalint: { n: 'Evaluating Intelligence', cd: 1, fn: () => pickTarget('Tap a creature or person to judge.', e => (e.kind === 'mon' || e.kind === 'pet' || e.kind === 'npc' || isAlly(e)) && !e.gone, evalUse) },
  trap: { n: 'Set snare', fn: () => { if (!SF.count(P.pack, 'trapkit')) return log('You need a snare kit (Tinkering makes them).', '#ffb070'); if (TRAPS.filter(t => t.owner === 'P').length >= SF.TRAP.max) return log('You already have two snares set.', '#ffb070'); if (TRAPS.some(t => Math.hypot(t.x - P.x, t.y - P.y) < SF.TRAP.spacing)) return log('Snares must be at least 4 m apart.', '#ffb070'); P.task = { kind: 'trap', label: 'Setting snare', t0: GT, t1: GT + SF.TRAP.place, still: true, x0: P.x, y0: P.y }; } } };

/* ---- Hiding and Stealth ---- */
function stealthUse() {
  if (P.ghost) return; if (!P.hidden) return log('You must be hidden to use Stealth.', '#ffb070');
  if (svReal('hiding') < SKD.STEALTH.needHiding) return log(`Stealth needs ${SKD.STEALTH.needHiding} real Hiding.`, '#ffb070');
  const ar = SF.EQ.effective(P).ar; if (ar > SKD.STEALTH.maxAR) return log('You could not hope to move quietly wearing this much armor.', '#ffb070');
  if (!cdReady('stealth', 10)) return;
  const w = SKD.stealthWindow(ar);
  if (skillCheck('stealth', w[0], w[1])) { P.stepBudget = SKD.stealthSteps(sv('stealth')); P.stepAcc = 0; P.stealthUsed = true; log(`You begin to move quietly: ${P.stepBudget} step${P.stepBudget > 1 ? 's' : ''}.`, '#9fd0ff'); }
  else reveal('You fail to move quietly and are revealed.');
}
/* ---- Animal Taming ---- */
function tameStart(m) {
  const d = MON[m.type], min = tameMin(m.type);
  if (min === null || d.boss || d.scout) return log('That creature cannot be tamed.', '#ffb070');
  if (!inReach(m, SF.TAME.range)) return;
  if (sv('animaltaming') < min) return log(`You have no chance of taming this creature (${d.n}: ${min.toFixed(1)}).`, '#ffb070');
  if (m.target === P && m.state !== 'idle') return log('The animal is too angry to continue taming.', '#ffb070');
  if (tamedPets().length >= SKD.PET_LIMIT) return log(`You already keep ${SKD.PET_LIMIT} pets (a limit of this world, not of the old one).`, '#ffb070');
  if (!cdReady('tame', 10)) return;
  m.taming = GT + SF.TAME.time + .5; P.task = { kind: 'tame', m, label: 'Taming ' + d.n, t0: GT, t1: GT + SF.TAME.time, still: true, x0: P.x, y0: P.y }; say(P, pick(['I always wanted a ' + d.n + ' like you.', 'Good ' + d.n + '.', 'Here ' + d.n + '.', 'I won\'t hurt you.']));
}
/* ---- Animal Lore ---- */
function loreUse(m) {
  if (!cdReady('lore', 1) || !inReach(m, 8)) return; const d = MON[m.type], ok = skillCheck('animallore', 0, 110);
  if (!ok) return log('You can\'t think of anything you know offhand.', '#a8a8a8');
  const x = monT2A(d), exact = SKD.readExact(sv('animallore')), r = v => exact ? Math.round(v) : Math.round(v / 10) * 10 + '±5';
  const diet = { meat: 'eats meat', fish: 'eats fish', veg: 'grazes on plants', any: 'eats anything' }[SKD.DIET[m.type]] || 'cannot be fed';
  const min = tameMin(m.type);
  log(`${cap1(m.name || d.n)}: health ${Math.round(m.hp)}/${m.max || d.hp}, STR ${r(x.str)}, DEX ${r(x.dex)}, armor ${d.armor}; ${diet}; ${min === null ? 'cannot be tamed' : 'tamable from ' + min.toFixed(1)}${m.kind === 'pet' ? '; seems ' + loyaltyWord(m) : ''}.`, '#e8d8b0');
}
/* ---- Veterinary: bandage a pet ---- */
function vetStart(p) {
  if (!inReach(p, SF.VET.range + .3)) return; if (!SF.count(P.pack, 'bandage')) return log('You need a bandage.', '#ffb070');
  const poisoned = !!p.poison; if (!poisoned && p.hp >= p.max) return log('That pet is not hurt.');
  SF.removeQty(P.pack, 'bandage', 1); P.task = { kind: 'vet', p, cure: poisoned, label: (poisoned ? 'Curing ' : 'Treating ') + p.name, t0: GT, t1: GT + SF.VET.time };
}
function feedPet(p) {
  if (!inReach(p, 2.5)) return; const diet = SKD.DIET[p.type]; if (!diet) return log(cap1(p.name) + ' will not eat.', '#ffb070');
  const food = SKD.FOOD[diet].find(id => SF.count(P.pack, id)); if (!food) return log(`${cap1(p.name)} ${{ meat: 'wants meat', fish: 'wants fish', veg: 'wants greens or bread', any: 'is hungry' }[diet]}.`, '#ffb070');
  SF.removeQty(P.pack, food, 1); p.loyal = SKD.LOYALTY.max; p.fedAt = GT; floater(p.x, p.y, 'munch', '#7ee08a'); log(`${cap1(p.name)} eats the ${SF.ITEMS[food].n.toLowerCase()} and looks ${loyaltyWord(p)}.`, '#7ee08a');
}
/* ---- the bard ---- */
function bardReady(id) {
  if (!hasInstrument()) { log('You need an instrument (a reed lute from the provisioner).', '#ffb070'); return false; }
  if (GT < (P.bardReady || 0)) { log('You are still playing.', '#ffb070'); return false; }
  return true;
}
const music = () => skillCheck('musicianship', SKD.BARD.musicWin[0], SKD.BARD.musicWin[1]);
function bardFail(id) { skillDelay(id, SKD.BARD.failDelay); }
function playMusic() {
  if (!bardReady('play') || !cdReady('play', 5)) return; useAbilityReveal('play');
  snd('bard.lullaby', { key: 'P', gain: .6 }); if (music()) log('You play a pleasant tune.', '#c8e0ff'); else log('You play poorly, and there is no effect.', '#a8a8a8');
}
function peaceUse() {
  if (!bardReady('peace') || !cdReady('peace', SKD.BARD.delay)) return; useAbilityReveal('peace'); P.bardReady = GT + 1;
  const rad = SKD.BARD.range(sv('peacemaking')), near = ents.filter(e => e.kind === 'mon' && alive(e) && dist(e, P) <= rad && !MON[e.type].boss);
  const diff = near.length ? Math.max(...near.map(monDiff)) : null;
  snd('bard.lullaby', { key: 'P' });
  if (!music()) { bardFail('peace'); return log('You play poorly, and there is no effect.', '#a8a8a8'); }
  const ok = diff === null ? skillCheck('peacemaking', 0, 100) : skillCheck('peacemaking', ...SKD.bardWindow(diff));
  if (!ok) { bardFail('peace'); return log('You attempt to calm everyone, but fail.', '#ffb070'); }
  const until = GT + SKD.BARD.peaceFor(sv('peacemaking'));
  for (const m of near) { m.pacified = until; m.target = null; m.provoked = 0; if (m.state !== 'flee') m.state = 'idle'; floater(m.x, m.y, 'calmed', '#9fd0ff'); }
  for (const e of ents) if (e.kind === 'pet' && e.order === 'attack') e.order = 'follow';
  P.armed = false; FX.push({ k: 'ring', x: P.x, y: P.y, c: '#9fd0ff', t0: GT, dur: 1 });
  log(near.length ? `You play hypnotic music, calming ${near.length} creature${near.length > 1 ? 's' : ''} around you.` : 'You play hypnotic music. All is calm.', '#9fd0ff');
}
function enticeUse(m) {
  if (MON[m.type].boss) return log(cap1(MON[m.type].n) + ' cannot be swayed by music.', '#ffb070');
  if (!bardReady('entice') || !inReach(m, SKD.BARD.range(sv('enticement'))) || !cdReady('entice', SKD.BARD.delay)) return; useAbilityReveal('entice'); P.bardReady = GT + 1;
  snd('bard.discord', { key: 'P' });
  if (!music()) { bardFail('entice'); return log('You play poorly, and there is no effect.', '#a8a8a8'); }
  if (!skillCheck('enticement', ...SKD.bardWindow(monDiff(m)))) { bardFail('entice'); log('Your music fails to attract the creature, and it notices you.', '#ffb070'); if (!m.target && ecoEnemy(m, P)) { m.target = P; m.state = 'chase'; } return; }
  m.lured = { x: P.x, y: P.y, t0: GT, until: GT + SKD.BARD.enticeFor }; m.target = null; m.state = 'idle'; floater(m.x, m.y, 'enticed', '#c8e0ff'); log(`The ${MON[m.type].n} is drawn to your music.`, '#c8e0ff');
}
function provokeStart() {
  if (!bardReady('provoke')) return; if (cdLeft('provoke') > 0) return log('Provocation is not ready (' + Math.ceil(cdLeft('provoke')) + ' s).');
  const ok = e => e.kind === 'mon' && alive(e) && !MON[e.type].boss;
  pickTarget('Tap the creature to provoke.', ok, a => {
    if (!inReach(a, SKD.BARD.range(sv('provocation')))) return;
    pickTarget(`Tap the creature to set the ${MON[a.type].n} against.`, e => ok(e) && e !== a, b => provokeUse(a, b), false);
  }, false);
}
function provokeUse(a, b) {
  if (!alive(a) || !alive(b)) return; if (dist(a, b) > SKD.BARD.range(sv('provocation'))) return log('Those two are too far apart.', '#ffb070');
  if (!cdReady('provoke', SKD.BARD.delay)) return; useAbilityReveal('provoke'); P.bardReady = GT + 1; snd('bard.provoke', { key: 'P' });
  if (!music()) { bardFail('provoke'); return log('You play poorly, and there is no effect.', '#a8a8a8'); }
  if (!skillCheck('provocation', ...SKD.bardWindow(Math.max(monDiff(a), monDiff(b))))) {
    bardFail('provoke'); log('Your music fails to incite enough anger. They turn on you!', '#ff8a6a');
    for (const m of [a, b]) { m.target = P; m.state = 'chase'; m.pacified = 0; } return;
  }
  const until = GT + SKD.BARD.provokeFor;
  a.target = b; a.provoked = until; a.state = 'chase'; a.pacified = 0; b.target = a; b.provoked = until; b.state = 'chase'; b.pacified = 0;
  floater(a.x, a.y, 'provoked!', '#ff9a6a'); log(`You play your music and the ${MON[a.type].n} turns on the ${MON[b.type].n}.`, '#ff9a6a');
}
/* ---- Evaluating Intelligence ---- */
function evalUse(t) {
  if (!cdReady('evalint', 1) || !inReach(t, 8)) return; if (!skillCheck('evaluatingintelligence', 0, 100)) return log('You cannot judge their mental abilities.', '#a8a8a8');
  const iv = t === P ? P.int : t.kind === 'npc' ? 40 : isAlly(t) ? t.int : intOf(t), mx = t.kind === 'mon' || t.kind === 'pet' ? iv : iv, exact = SKD.readExact(sv('evaluatingintelligence'));
  log(`${cap1(t.name || (MON[t.type] || {}).n || 'They')} ${t.kind === 'npc' || isAlly(t) ? 'look' : 'looks'} ${SKD.intWord(iv)}${exact ? ` (INT ${Math.round(iv)}, mana about ${Math.round(mx)})` : ''}.`, '#e8d8b0');
}
/* ---- Lockpicking and Remove Trap: dungeon chests, tinker's lockboxes and trapped practice boxes ---- */
const nearChest = () => [...CHESTS.values()].find(c => Math.hypot(c.x + .5 - P.x, c.y + .5 - P.y) <= 2);
function lockUse(item) {
  if (!SF.count(P.pack, 'lockpick')) return log('You need lockpicks.', '#ffb070');
  const c = item ? null : nearChest(), box = item || (!c && P.pack.items.find(i => i.id === 'lockbox' && i.locked));
  if (c && !c.open) { P.task = { kind: 'lock', chest: c, label: 'Picking lock', t0: GT, t1: GT + SF.LOCK_TIME, still: true, x0: P.x, y0: P.y }; sndAt('lock.pick', { x: c.x + .5, y: c.y + .5 }); return; }
  if (box) { if (!box.locked) return log('That box is not locked. Lock it first.', '#ffb070'); P.task = { kind: 'lock', box, label: 'Picking lock', t0: GT, t1: GT + SF.LOCK_TIME, still: true, x0: P.x, y0: P.y }; snd('lock.pick', { key: 'P' }); return; }
  log('Stand at a locked chest, or carry a locked tinker\'s lockbox.', '#ffb070');
}
function untrapUse(item) {
  if (svReal('lockpicking') < 50 || svReal('detectinghidden') < 50) return log('Remove Trap needs 50 real Lockpicking and 50 real Detecting Hidden.', '#ffb070');
  const c = item ? null : nearChest(), sn = !item && TRAPS.find(t => !t.hidden && t.owner !== 'P' && Math.hypot(t.x - P.x, t.y - P.y) <= 2), box = item || (!c && !sn && P.pack.items.find(i => i.id === 'trapbox' && i.armed));
  if (!cdReady('untrap', 10)) return;
  if (c && c.trap && !c.open) { if (!c.trapSeen) return log('You see no trap on this chest. (Detecting Hidden may find one.)', '#ffb070'); P.task = { kind: 'disarm', chest: c, label: 'Disarming', t0: GT, t1: GT + 2, still: true, x0: P.x, y0: P.y }; return; }
  if (sn) { P.task = { kind: 'disarm', trap: sn, label: 'Disarming', t0: GT, t1: GT + SF.TRAP.place, still: true, x0: P.x, y0: P.y }; return; }
  if (box) { if (!box.armed) return log('That box is not armed. Arm it first.', '#ffb070'); P.task = { kind: 'disarm', box, label: 'Disarming', t0: GT, t1: GT + 2, still: true, x0: P.x, y0: P.y }; return; }
  P.cdA.untrap = 0; log('There is no known trap here.', '#ffb070');
}
/* ---- Stealing (and Snooping's open pack, phase D) ---- */
function npcPack(e) {
  if (e.pack2) return e.pack2; const rng = mulberry(hash(e.id * 977 + (e.actorId ? e.actorId.length : 0), 41)), c = SF.newContainer('pack', e.actorId || e.id), add = (id, a, b) => { const q = a + Math.floor(rng() * (b - a + 1)); if (q > 0) c.items.push(SF.newItem(id, q, SF.ITEMS[id].stack ? null : { cond: 100 })); };
  if (e.kind === 'mon') { const d = MON[e.type]; for (const k in d.loot) add(k, d.loot[k][0], d.loot[k][1]); if (e.purse) { c.items.push(SF.newItem('gold', e.purse)); e.purse = 0; } }
  else { add('gold', 3, 25); const role = { apothecary: ['vial', 'marshroot'], reagents: ['blacksalt', 'shelldust'], mage: ['blankscroll', 'black_pearl'], smith: ['ironshard', 'rivet'], tinker: ['lockpick', 'ironshard'], provisioner: ['bandage', 'travelloaf'], fishmonger: ['fish', 'fish'], healer: ['bandage', 'bandage'], innkeeper: ['cookedmeat', 'softcheese'], tailor: ['cloth', 'strap'], scholar: ['blankmap', 'blankscroll'] }[e.role] || ['travelloaf', 'softcheese'];
    add(role[0], 1, 4); add(role[1], 0, 3); if (rng() < .3) add('bandage', 1, 3); }
  return (e.pack2 = c);
}
function stealStart(e, it) {
  if (!inReach(e, SKD.STEAL.range)) return; if (e.kind === 'mon' && e.target === P) return log('They are watching you too closely.', '#ffb070');
  if (!cdReady('steal', SKD.STEAL.delay)) return;
  P.task = { kind: 'steal', e, uid: it ? it.uid : null, label: 'Stealing', t0: GT, t1: GT + 1, still: true, x0: P.x, y0: P.y };
}
function crime(victim, what) {   // the law (src/law.js): the criminal flag, witnesses, the guards
  lawCrime(P, victim, what);
  if (victim.kind === 'npc' && !victim.life) { say(victim, pick(['Thief!', 'Guards! A thief!', 'Stop, thief!'])); const g = ents.find(o => o.kind === 'npc' && o.role === 'guard' && !o.life && dist(o, P) < 18); if (g) say(g, 'You there! Keep your hands to yourself.'); }   // Quay folk have no life yet: they only shout
}
/* ---- Poisoning (the panel lists potions × targets) ---- */
const poisonPotions = () => P.pack.items.filter(i => SF.ITEMS[i.id].poisonLvl);
const poisonableWeapon = () => { const w = P.equip.weapon, d = w && SF.weaponOf(w); return d && !d.ammo && (d.skill === 'swordsmanship' || d.skill === 'fencing') ? w : null; };
function poisonApply(potUid, target) {
  const pot = findU(P.pack, potUid); if (!pot) return; const lvl = SF.ITEMS[pot.id].poisonLvl, w = SKD.POISON_WIN[lvl];
  let tgt = null; if (target === 'weapon') tgt = poisonableWeapon(); else tgt = findU(P.pack, +target);
  if (!tgt) return log(target === 'weapon' ? 'Only a bladed or piercing weapon in hand can carry poison.' : 'That food is gone.', '#ffb070');
  closePanel(); useAbilityReveal('poison');
  P.task = { kind: 'poison', pot: pot.id, lvl, target, tuid: tgt.uid, win: w, label: 'Applying poison', t0: GT, t1: GT + 2, still: true, x0: P.x, y0: P.y };
}

const TASKS = {
  search: () => { const det = sv('detectinghidden'), ok = skillCheck('detectinghidden', 0, 100), r = SKD.detectRadius(det); let found = 0;
    if (ok) {
      for (const m of ents) if (m.kind === 'mon' && m.hidden && dist(m, P) <= r && SKD.detectBeats(det, MON[m.type].hide || monDiff(m) * .8, R)) { m.hidden = false; found++; floater(m.x, m.y, 'found!', '#ffe08a'); }
      for (const t of TRAPS) if (t.hidden && Math.hypot(t.x - P.x, t.y - P.y) <= r && SKD.detectBeats(det, t.diff, R)) { t.hidden = false; found++; }
      for (const c of CHESTS.values()) if (c.trap && !c.trapSeen && !c.open && Math.hypot(c.x + .5 - P.x, c.y + .5 - P.y) <= r && SKD.detectBeats(det, c.trap, R)) { c.trapSeen = true; found++; floater(c.x + .5, c.y + .5, 'trapped!', '#ffe08a'); }
    }
    log(found ? `You uncover ${found} hidden thing${found > 1 ? 's' : ''}.` : ok ? 'You can see nothing hidden there.' : 'You fail to see anything hidden.', found ? '#ffe08a' : undefined); FX.push({ k: 'ring', x: P.x, y: P.y, c: '#ffe08a', t0: GT, dur: .8, r }); },
  tame: t => { const m = t.m, d = MON[m.type], min = tameMin(m.type); if (!alive(m) || dist(m, P) > SF.TAME.range + .5) return log('You are too far away to continue taming.');
    if (m.target === P && m.state === 'chase') return log('The animal is too angry to continue taming.', '#ffb070');
    if (skillCheck('animaltaming', ...SKD.tameWindow(min))) { m.kind = 'pet'; if (m.sp) { m.sp.n--; if (m.sp.camp) m.sp.camp.removed(); m.sp = null; } if (m.sortie) ecoSortieEnd(m); m.leader = null; m.order = 'follow'; m.slots = 1; m.loyal = SKD.LOYALTY.max; m.fedAt = GT; m.name = 'your ' + d.n; m.state = ''; m.target = null; m.hidden = false; m.lured = null; for (const e of ents) if (e.target === m) { e.target = null; e.state = 'return'; } P.sel = m; simAdopt(m); log(`It seems to accept you as master.`, '#7ee08a'); }
    else { log('You fail to tame the creature.'); if (R() < d.bite) { m.target = P; m.state = 'chase'; log('You seem to anger the beast!', '#ff8a6a'); } } },
  vet: t => { const p = t.p; if (p.gone || dist(p, P) > SF.VET.range + .3) return log('You did not stay close enough to your patient.');
    const vet = sv('veterinary'), lore = sv('animallore');
    if (t.cure) { const ch = SKD.vetCureChance(svReal('veterinary'), svReal('animallore')); skillCheck('veterinary', 0, 120); skillCheck('animallore', 0, 120); if (!ch) return log('Curing a pet needs 60 Veterinary and 60 Animal Lore.', '#ffb070'); if (R() < ch) { p.poison = null; floater(p.x, p.y, 'cured', '#7ee08a'); log(`You cure ${p.name}.`, '#7ee08a'); } else log('You fail to cure the poison.'); return; }
    skillCheck('veterinary', 0, 120); skillCheck('animallore', 0, 120);
    if (R() >= SKD.vetChance(vet)) return log('You fail to stop the bleeding.');
    const [lo, hi] = SKD.vetRange(vet, lore), b = p.hp; p.hp = Math.min(p.max, p.hp + lo + Math.floor(R() * (hi - lo + 1))); floater(p.x, p.y, '+' + Math.round(p.hp - b), '#7ee08a'); log(`You treat ${p.name} for ${Math.round(p.hp - b)}.`, '#7ee08a'); },
  steal: t => { const e = t.e; if (e.gone || (e.kind === 'mon' && !alive(e)) || dist(e, P) > SKD.STEAL.range + .3) return log('Your mark slips away.');
    const pack = npcPack(e), items = pack.items.filter(i => SF.ITEMS[i.id].trade);
    const it = t.uid ? items.find(i => i.uid === t.uid) : items[Math.floor(R() * items.length)];
    if (!it) return log(t.uid ? 'That is no longer there.' : 'Their pack is empty.');
    const unitW = SF.itemKg({ id: it.id, qty: 1 }) * SF.WU; let qty = 1;
    if (SF.ITEMS[it.id].stack && it.qty > 1) { const mx = Math.max(1, Math.min(it.qty, Math.floor((sv('stealing') / 10) / Math.max(unitW, 1e-6)))); qty = 1 + Math.floor(R() * mx); }
    const stones = unitW * qty; if (stones > SKD.STEAL.maxStones) return log('That is too heavy to steal.', '#ffb070');
    const ok = skillCheck('stealing', ...SKD.stealWindow(stones)), caught = R() < SKD.caughtChance(sv('stealing'));
    if (ok) { const take = qty === it.qty ? it : Object.assign({}, it, { uid: undefined, qty }); const nw = take === it ? it : SF.newItem(it.id, qty, Object.fromEntries(Object.entries(it).filter(([k]) => !['uid', 'id', 'qty'].includes(k))));
      const r = SF.addItem(P.pack, nw, cap()); if (!r.ok) return log(r.reason, '#ffb070'); if (take === it) pack.items.splice(pack.items.indexOf(it), 1); else it.qty -= qty; pack.ver++;
      log(`You steal ${qty > 1 ? qty + ' × ' : ''}${SF.itemName(nw).toLowerCase()}.`, '#ffe08a'); snd('loot.coin', { gain: .5 }); }
    else log('You fail to steal the item.', '#ffb070');
    if (caught) { reveal('You are noticed stealing!'); if (e.kind === 'mon') { e.hidden = false; e.target = P; e.state = 'chase'; say(e, 'Thief!'); } else crime(e, 'theft'); }
    if (PANEL === 'snoop') renderPanel(); },
  poison: t => { if (!SF.removeQty(P.pack, t.pot, 1)) return; give('vial', 1);
    const ok = skillCheck('poisoning', t.win[0], t.win[1]);
    if (!ok) return log('You fail to apply a sufficient dose of poison.', '#ffb070');
    if (t.target === 'weapon') { const w = poisonableWeapon(); if (!w || w.uid !== t.tuid) return log('Your weapon is no longer in hand; the dose is wasted.'); w.venom = { tier: t.lvl, charges: SKD.poisonCharges(t.lvl) }; log(`You apply the poison. Your weapon carries it for ${w.venom.charges} hits.`, '#7be07b'); }
    else { const f = findU(P.pack, t.tuid); if (!f) return; if (f.qty > 1) { f.qty--; P.pack.ver++; SF.addItem(P.pack, SF.newItem(f.id, 1, { poison: t.lvl, cond: 100 })); } else f.poison = t.lvl; log('You apply the poison to the food.', '#7be07b'); } },
  trap: () => { SF.removeQty(P.pack, 'trapkit', 1); snd('trap.set', { key: 'P' }); TRAPS.push({ x: P.x, y: P.y, owner: 'P', hidden: false, armedAt: GT + SF.TRAP.arm, until: GT + SF.TRAP.life, diff: 40 }); log('Snare set. It arms in a second and lasts 3 minutes.'); },
  disarm: t => {
    const pw = t.trap ? t.trap.diff : t.chest ? t.chest.trap : t.box ? t.box.power : 0, ok = skillCheck('removetrap', ...SKD.trapWindow(pw));
    if (ok) { if (t.trap) { TRAPS.splice(TRAPS.indexOf(t.trap), 1); give('ironshard', 1); log('You disarm the snare and salvage a shard.'); } else if (t.chest) { t.chest.trap = 0; t.chest.trapSeen = false; log('You successfully render the trap harmless.', '#7ee08a'); } else { t.box.armed = false; P.pack.ver++; log('You disarm the practice box.', '#7ee08a'); } return; }
    if (R() < .3) { if (t.trap) { TRAPS.splice(TRAPS.indexOf(t.trap), 1); springOnPlayer(); } else if (t.chest) springChestTrap(t.chest); else { t.box.armed = false; P.pack.ver++; springBox(t.box); } }
    else log('You fail to safely remove the trap.', '#ffb070'); },
  lock: t => {
    if (t.chest) { const c = t.chest, diff = SF.CHEST_DIFF[c.tier];
      if (skillCheck('lockpicking', ...SKD.lockWindow(diff))) { c.open = true; c.picked = { by: P.name, at: GT }; c.refill = GT + 600; c.cont = c.treasure ? treasureLoot(c) : chestLoot(c.tier); if (c.treasure && P.cx.tchest) P.cx.tchest.opened = true; log('The lock quickly yields to your skill.', '#ffe08a'); sndAt('door.unlock', { x: c.x + .5, y: c.y + .5 }); if (c.trap) springChestTrap(c); openChest(c, true); }
      else { if (R() < .3) { SF.removeQty(P.pack, 'lockpick', 1); log('You broke the lockpick.'); } else log('You are unable to pick the lock.'); } return; }
    const b = t.box; if (!b || !findU(P.pack, b.uid)) return;
    if (skillCheck('lockpicking', ...SKD.lockWindow(b.lockLvl || 20))) { b.locked = false; b.picked = { by: P.name, at: GT }; P.pack.ver++; log('The lock quickly yields to your skill.', '#ffe08a'); snd('door.unlock', { key: 'P' }); }
    else { if (R() < .3) { SF.removeQty(P.pack, 'lockpick', 1); log('You broke the lockpick.'); } else log('You are unable to pick the lock.'); } },
  appraise: t => { const it = t.item, d = SF.ITEMS[it.id], p = SF.PRICES[it.id] || 1; const ok = skillCheck('itemidentification', 0, 100);
    if (!ok) return log('You are not certain…', '#a8a8a8'); const err = (1 - sv('itemidentification') / 100) * .5;
    if (it.unid) { delete it.unid; P.pack.ver++; }
    const lo = Math.max(1, Math.round(p * .4 * (1 - err))), hi = Math.round(p * 1.2 * (1 + err));
    log(`${SF.itemName(it)}${it.quality === 'exceptional' ? ' (exceptional)' : ''}${it.magic ? ' — ' + magicName(it) : ''}: ${it.maker ? 'made by ' + it.maker + ', ' : ''}${it.poison ? 'tainted with poison, ' : ''}worth about ${lo}–${hi} gold${d.trade ? '' : ', cannot be traded'}.`, '#e8d8b0'); },
  repair: t => { const it = t.item, k = SF.repairSkill(it.id); const rp = SF.repairPlan(it); if (!rp.ok) return log(cap1(rp.reason), '#ffb070'); if (!SF.removeQty(P.pack, 'repairkit', 1)) return log('You need a repair kit.');
    const rd = SF.SK.repairDiff(it.cond === undefined ? 100 : it.cond, it.maxc || 100);   // a badly worn piece is harder to mend (−25 … 100)
    if (skillCheck(k, rd - 25, rd + 25)) { const r = SF.EQ.repairItem(P, { uid: it.uid, skill: sv(k), rng: R }); log(r.ok ? `Repaired to ${r.maxc}/${r.maxc}.` + (r.lost ? ` The maximum drops by ${r.lost}.` : ' The maximum holds.') : r.reason, r.ok ? '#7ee08a' : '#ffb070'); } else log('The repair fails and the kit is used up.', '#ffb070'); renderPanel(); } };
const magicName = it => it.magic ? ({ dmg: ['', 'ruin', 'might', 'force', 'power', 'vanquishing'], acc: ['', 'accurate', 'surpassingly accurate', 'eminently accurate', 'exceedingly accurate', 'supremely accurate'], def: ['', 'defense', 'guarding', 'hardening', 'fortification', 'invulnerability'] }[it.magic.k] || [])[it.magic.l] || 'magic' : '';
/* chest traps (dungeon chests of the second and third tier): a poison needle or an explosion when the lid opens untouched */
function springChestTrap(c) { const p = c.trap; c.trap = 0; c.trapSeen = false; snd('trap.spring', { key: 'P' }); if (R() < .5) { damagePlayer(Math.round(p / 4), null, 'phys', { quiet: 1 }); log('The chest explodes in your face!', '#ff8a6a'); FX.push({ k: 'boom', x: c.x + .5, y: c.y + .5, r: .8, t0: GT, dur: .5 }); } else { applyPoison(P, p >= 70 ? 3 : 2); log('A poison needle pricks your finger!', '#7be07b'); } }
function springBox(b) { snd('trap.spring', { key: 'P' }); damagePlayer(Math.max(2, Math.round((b.power || 20) / 10)), null, 'phys', { quiet: 1 }); log('The practice box snaps shut on your fingers!', '#ff8a6a'); }
/* ================= the ten skills Shardfall lacked (Phase D): Arms Lore, Begging, Camping, Cartography, Forensic Evaluation,
   Herding, Inscription, Snooping, Spirit Speak, Taste Identification; plus magic loot for Item Identification ================= */
/* magic loot: some rare drops and the best chest finds carry a hidden property (SK.rollMagic); Item Identification names it */
function magicLoot(it, lvlMax, chance) { if (!it || R() >= chance) return it; const m = SKD.rollMagic(it.id, lvlMax, R); if (m) { it.magic = m; it.unid = true; } return it; }
/* a treasure map points at open, walkable wilderness away from towns (deterministic from the map's own seed) */
function newTreasureMap(lvl) {
  const it = SF.newItem('tmap', 1, { level: lvl, seed: Math.floor(R() * 1e9) }); const rng = mulberry(it.seed);
  for (let k = 0; k < 400; k++) { const x = Math.floor(rng() * W), y = Math.floor(rng() * H); if (BLK[tAt(x, y)] || tAt(x, y) === T.WA || protAt(x + .5, y + .5) || levelAt(x, y) || !canStand(P, x + .5, y + .5)) continue; it.tx = x; it.ty = y; break; }
  if (it.tx === undefined) { it.tx = 300; it.ty = 300; } return it;
}
Object.assign(ABIL, {
  armslore: { n: 'Arms Lore', cd: 1, fn: () => { const w = P.equip.weapon || P.equip.chest; if (w) return itemSkill('armslore', w.uid, true); log('Choose a weapon or piece of armor in your backpack (Arms Lore).'); openPanel('bag'); } },
  itemid: { n: 'Item Identification', fn: () => { log('Choose an item in your backpack and press Identify.'); openPanel('bag'); } },
  taste: { n: 'Taste Identification', cd: 1, fn: () => { log('Choose food, drink or a potion in your backpack and press Taste.'); openPanel('bag'); } },
  beg: { n: 'Begging', cd: SKD.BEG.delay, fn: () => pickTarget('Tap the person to beg from.', e => e.kind === 'npc' && e.role !== 'guard' && !e.dev && !e.gone, begUse) },
  camp: { n: 'Camping', fn: () => campUse() },
  forensic: { n: 'Forensic Evaluation', cd: 1, fn: () => forensicUse() },
  herd: { n: 'Herding', cd: 1, fn: () => { if (!SF.count(P.pack, 'crook')) return log('You need a shepherd\'s crook (Carpentry makes them).', '#ffb070'); pickTarget('Tap the animal to herd.', e => isAnimal(e), herdPick); } },
  snoop: { n: 'Snooping', cd: 1, fn: () => pickTarget('Tap the person or creature whose pack you want to look into.', packOwner, snoopUse) },
  spirit: { n: 'Spirit Speak', cd: 10, fn: () => spiritUse() },
  draw: { n: 'Cartography', fn: () => openCraft('map') },
  scribe: { n: 'Inscription', fn: () => { SF.SK.addInscription(); openCraft('scribe'); } },
  dig: { n: 'Dig for treasure', fn: () => digUse() } });
/* ---- Arms Lore and Taste Identification (item targets) ---- */
ITEM_SKILL.armslore = it => {
  const d = SF.ITEMS[it.id], w = SF.weaponOf(it); if (!w && !(d.slot && d.slot !== 'weapon' && d.cat !== 'jewelry')) return log('That is neither a weapon nor armor.', '#ffb070');
  if (!cdReady('armslore', 1)) return; useAbilityReveal('armslore'); if (!skillCheck('armslore', 0, 100)) return log('You are not certain…', '#a8a8a8');
  const s = sv('armslore'), exact = SKD.readExact(s), max = it.maxc || it.omax || 100;
  let msg = `${SF.itemName(it)} ${SKD.conditionWord(it.cond, max)}${s >= 50 && it.cond !== undefined ? ` (${Math.round(it.cond)}/${max})` : ''}`;
  if (it.quality === 'exceptional') msg += ', and is of exceptional quality';
  if (w) { const avg = (w.dmg[0] + w.dmg[1]) / 2 + SKD.magicDmg(it); msg += `. It ${SKD.dmgWord(avg)}${exact ? ` (${w.dmg[0]}–${w.dmg[1]}${SKD.magicDmg(it) ? ' +' + SKD.magicDmg(it) : ''})` : ''}`; if (it.venom) msg += `. It is coated with poison (${it.venom.charges} uses)`; }
  else { const ar = SF.EQ.regionAR(it); msg += `. It ${SKD.arWord(ar)}${exact ? ` (AR ${Math.round(ar)})` : ''}`; }
  log(msg + '.', '#e8d8b0');
};
ITEM_SKILL.taste = it => {
  const d = SF.ITEMS[it.id]; if (!(d.use === 'eat' || d.cat === 'potion' || d.cat === 'food')) return log('You cannot taste that.', '#ffb070');
  if (!cdReady('taste', 1)) return; useAbilityReveal('taste'); if (!skillCheck('tasteidentification', 0, 100)) return log('You cannot discern anything about this.', '#a8a8a8');
  it.tasted = true; P.pack.ver++;
  const p = it.poison || d.poisonLvl || 0, word = ['', 'lesser', 'regular', 'greater', 'deadly'][p];
  log(p ? `It is ${d.poisonLvl ? 'a' : 'tainted with'} ${word} poison${d.poisonLvl ? ' potion' : ''}.` : d.cat === 'potion' ? `It is ${SF.ITEMS[it.id].n.toLowerCase()}, and safe.` : 'You detect nothing unusual.', p ? '#7be07b' : '#e8d8b0');
};
/* ---- Begging ---- */
function begUse(n) {
  if (!inReach(n, SKD.BEG.range) || !cdReady('beg', SKD.BEG.delay)) return; useAbilityReveal('beg');
  if (GT < (n.begAt || 0)) return say(n, pick(['I have already given thee something.', 'Away with thee!', 'Not again.']));
  say(P, pick(['Spare some gold, kind soul?', 'Any coin for a poor wanderer?', 'Please, a few coppers…']));
  const pack = npcPack(n), purse = SF.count(pack, 'gold');
  if (!skillCheck('begging', 0, 100) || !purse) { n.begAt = GT + 60; return say(n, pick(['I have nothing for thee.', 'Go find work!', 'Not today.'])); }
  const g = SKD.begAmount(sv('begging'), purse, R); SF.removeQty(pack, 'gold', g); give('gold', g); n.begAt = GT + SKD.BEG.perPerson;
  say(n, pick(['Here, take this.', 'Bless thee.', 'Get thee some bread.'])); log(`${n.name.split(',')[0]} gives you ${g} gold.`, '#ffe08a');
}
/* ---- Camping: kindling, campfires, secure camps ---- */
const CAMPS = [];
function campUse() {
  const fire = CAMPS.find(c => Math.hypot(c.x - P.x, c.y - P.y) <= SKD.CAMP.range);
  if (fire && fire.secureAt <= GT && SF.count(P.pack, 'bedroll')) return makeCamp(fire);
  if (fire && fire.secureAt <= GT) return log('Your camp is secure. With a bedroll you could make camp here.', '#9fd0ff');
  if (fire) return log(`Stay by your fire a little longer (${Math.ceil(fire.secureAt - GT)} s) and the camp will be secure.`);
  if (SF.count(P.pack, 'kindling')) return lightKindling();
  const tree = nearTree(); if (tree && carveBlade()) { P.task = { kind: 'kindling', label: 'Cutting kindling', t0: GT, t1: GT + 1.5, still: true, x0: P.x, y0: P.y }; return; }
  log('You need kindling: cut some from a tree with a blade, or buy it from a provisioner.', '#ffb070');
}
function nearTree() { for (let r = 1; r <= 2; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = Math.floor(P.x) + dx, y = Math.floor(P.y) + dy; if (tAt(x, y) === T.TR) return { x, y }; } return null; }
function lightKindling() {
  if (levelAt(Math.floor(P.x), Math.floor(P.y))) return log('You cannot light a fire here.', '#ffb070');
  const spot = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([dx, dy]) => [Math.floor(P.x) + dx, Math.floor(P.y) + dy]).find(([x, y]) => !BLK[tAt(x, y)] && tAt(x, y) !== T.WA && !STATIONS.some(s => s.x === x && s.y === y) && !CHESTS.has(y * W + x));
  if (!spot) return log('There is no room for a fire here.', '#ffb070'); const [fx, fy] = spot;
  useAbilityReveal('camp'); SF.removeQty(P.pack, 'kindling', 1);
  if (!skillCheck('camping', 0, 100)) return log('You fail to ignite the campfire.', '#a8a8a8');
  const c = { x: fx + .5, y: fy + .5, t0: GT, until: GT + SKD.CAMP.life, secureAt: GT + SKD.CAMP.secureAfter, under: tAt(fx, fy), st: { k: 'fire', x: fx, y: fy, camp: true } };
  tSet(fx, fy, T.FP); CAMPS.push(c); STATIONS.push(c.st); sndAt('world.hearth', c, { gain: .6 });   // the existing fire-pit tile is the campfire
  log('The kindling catches. You can cook here; stay close and the camp will be secure.', '#ffd090');
}
function makeCamp(c) { P.camp = { x: P.x, y: P.y, at: GT }; save(); log('You feel it would be safe to rest here. You make camp; the game is saved and you will wake here.', '#9fd0ff'); }
function campTick() {
  for (let i = CAMPS.length - 1; i >= 0; i--) { const c = CAMPS[i];
    if (Math.hypot(c.x - P.x, c.y - P.y) > SKD.CAMP.range && c.secureAt > GT) c.secureAt = GT + SKD.CAMP.secureAfter;   // you must stay by it for the camp to become secure
    if (!c.said && c.secureAt <= GT && Math.hypot(c.x - P.x, c.y - P.y) <= SKD.CAMP.range) { c.said = 1; log('Your camp is now secure.', '#9fd0ff'); }
    if (GT > c.until) { CAMPS.splice(i, 1); const k = STATIONS.indexOf(c.st); if (k >= 0) STATIONS.splice(k, 1); if (tAt(c.st.x, c.st.y) === T.FP) tSet(c.st.x, c.st.y, c.under); log('Your campfire dies down.', '#a8a8a8'); } }
}
/* ---- Cartography: drawing maps is crafting (station: anywhere, a mapmaker's pen); treasure maps decode, then you dig ---- */
ITEM_SKILL.decode = it => {
  if (it.decoded) return log(`The map shows a spot near ${it.tx}, ${it.ty}. It is pinned on your map.`);
  if (!SF.count(P.pack, 'mappen')) return log('You need a mapmaker\'s pen to decode a map.', '#ffb070');
  const w = SKD.tmapWindow(it.level || 1); if (sv('cartography') < w[0]) return log(`You cannot make anything of this level ${it.level} map yet.`, '#ffb070');
  useAbilityReveal('draw'); if (!skillCheck('cartography', w[0], w[1])) return log('You fail to make anything of the map.', '#a8a8a8');
  it.decoded = true; P.pack.ver++; P.cx.pins = P.cx.pins || []; P.cx.pins.push({ k: 'tmap:' + it.uid, n: `Treasure (level ${it.level})`, x: it.tx, y: it.ty }); log(`You decode the map: treasure lies near ${it.tx}, ${it.ty}. It is pinned on your map.`, '#ffe08a');
};
function digUse() {
  const it = P.pack.items.find(i => i.id === 'tmap' && i.decoded && !i.dug && Math.hypot(i.tx + .5 - P.x, i.ty + .5 - P.y) <= 3);
  if (!it) return log('You are not near the spot on any decoded map.', '#ffb070');
  if (!SF.count(P.pack, 'pickaxe') && !(P.equip.weapon && P.equip.weapon.id === 'pickaxe')) return log('You need a pickaxe to dig.', '#ffb070');
  P.task = { kind: 'dig', map: it, label: 'Digging', t0: GT, t1: GT + 3, still: true, x0: P.x, y0: P.y };
}
function treasureUp(it) {
  const lvl = it.level || 1, tier = lvl >= 3 ? 2 : 1, x = it.tx, y = it.ty; it.dug = true; P.pack.ver++;
  const under = tAt(x, y); tSet(x, y, T.CH); const c = { x, y, tier, open: false, refill: 0, treasure: lvl, under, trap: [0, 30, 45, 60, 75, 90][lvl], trapSeen: false };
  CHESTS.set(y * W + x, c); P.cx.tchest = { x, y, tier, lvl, under };
  for (const g of SKD.TMAP_GUARDS[lvl]) { const m = spawnMon(g, x - P.x + (R() - .5) * 4, y - P.y + (R() - .5) * 4); if (m) { m.target = P; m.state = 'chase'; } }
  log('You dig up a treasure chest! Its guardians rise to defend it.', '#ffe08a'); sndAt('gather.mine', { x: x + .5, y: y + .5 });
}
function treasureLoot(c) { const cont = chestLoot(c.tier), g = SKD.TMAP_GOLD[c.treasure]; cont.items.push(SF.newItem('gold', rnd(g[0], g[1]))); for (let i = 0; i < c.treasure; i++) { const id = pick(['kryss', 'battleaxe', 'spear', 'mace', 'waraxe', 'chain_tunic', 'plate_arms', 'kite_shield', 'closed_helm']); const it = lootItem(id, 1, rnd(70, 100)); magicLoot(it, c.treasure, .8); cont.items.push(it); }
  if (R() < .3) cont.items.push(newTreasureMap(Math.min(5, c.treasure + 1))); return cont; }
/* ---- Forensic Evaluation ---- */
function forensicUse() {
  if (!cdReady('forensic', 1)) return;
  const body = P.sel && P.sel.kind === 'corpse' && dist(P.sel, P) <= 3 ? P.sel : ents.filter(e => e.kind === 'corpse' && !e.gone && dist(e, P) <= 3).sort((a, b) => dist(a, P) - dist(b, P))[0];
  const chest = !body && nearChest(), box = !body && !chest && P.pack.items.find(i => i.id === 'lockbox' && i.picked);
  if (!body && !(chest && chest.picked) && !box) return log('Examine a body, or a chest or box whose lock was forced.', '#ffb070');
  useAbilityReveal('forensic'); if (!skillCheck('forensicevaluation', 0, 100)) return log('You cannot determine anything useful.', '#a8a8a8');
  const s = sv('forensicevaluation'), ago = t => { const m = Math.max(1, Math.round((GT - t) / 60)); return m + ' minute' + (m > 1 ? 's' : '') + ' ago'; };
  if (body) { const who = body.mine ? 'you' : body.name.replace(/ remains$/, ''); log(`These are the remains of ${who}, dead about ${ago(body.t0 || body.cont && body.cont.diedAt || GT)}.` + (s >= 50 ? (body.killer ? ` ${body.killer === P.name ? 'You' : cap1(body.killer)} killed ${body.mine ? 'you' : 'it'}.` : ' You find no sign of who killed it.') : ' You cannot tell who did it.'), '#e8d8b0'); return; }
  const p = (chest && chest.picked) || box.picked; log(`The lock was forced ${ago(p.at)}${s >= 40 ? ` by ${p.by === P.name ? 'you' : p.by}` : ''}.`, '#e8d8b0');
}
/* ---- Herding ---- */
function herdPick(m) {
  if (!inReach(m, SKD.HERD.range)) return;
  AIM = { range: SKD.HERD.dest, r: .6, ok: true, fn: pt => { AIM = null; herdUse(m, pt); }, pt: null, herd: true }; log('Tap where the animal should go.', '#9fd0ff');
}
function herdUse(m, pt) {
  if (!alive(m) || !cdReady('herd', 1)) return; useAbilityReveal('herd'); const d = tameMin(m.type) !== null ? tameMin(m.type) : monDiff(m);
  if (!skillCheck('herding', ...SKD.herdWindow(d))) return log('You don\'t seem to be able to persuade that to move.', '#a8a8a8');
  m.lured = { x: pt.x, y: pt.y, t0: GT, until: GT + SKD.HERD.walk }; m.target = null; m.state = 'idle'; floater(m.x, m.y, 'herded', '#c8e0ff'); log(`The ${MON[m.type].n} is herded toward the spot.`, '#c8e0ff');
}
/* ---- Snooping ---- */
let SNOOP = null;
function snoopUse(e) {
  if (!inReach(e, SKD.STEAL.range) || !cdReady('snoop', 1)) return;
  if (P.hidden) reveal('You reveal yourself as you reach for their pack.');   // snooping unhides (UOSA)
  if (!skillCheck('snooping', 0, 100)) { log('You fail to peek into the container.', '#ffb070');
    if (e.kind === 'npc') say(e, pick(['Keep thy hands to thyself!', 'What dost thou think thou art doing?'])); else if (!e.target) { e.target = P; e.state = 'chase'; } return; }
  SNOOP = e; npcPack(e); openPanel('snoop');
}
/* ---- Spirit Speak ---- */
function spiritUse() {
  if (!cdReady('spirit', 10)) return; useAbilityReveal('spirit');
  if (!skillCheck('spiritspeak', 0, 100)) return log('You fail to contact the netherworld.', '#a8a8a8');
  P.spiritUntil = GT + SKD.spiritFor(sv('spiritspeak')); log('You establish a connection to the netherworld.', '#c8b0ff');
}
const GHOST_LINES = ['I was a fisher here, before the bell rang for me.', 'Dig where the reeds grow thin, by the old cairn…', 'Tell my brother I kept the ring.', 'The Bellkeeper does not sleep.', 'Do not trust the drowned captain\'s maps.', 'Bandage your wounds before the night comes.'];
function ghostSpeech(e, line) { if (P.spiritUntil > GT || P.ghost) say(e, line); else say(e, pick(['OOooOOoo', 'oOOoooO', 'OOoo… oOOo'])); }
function spiritTick() {
  const al = allyOf(); if (al && al.ghost && dist(al, P) < 12 && GT > (al.ghostSay || 0)) { al.ghostSay = GT + 14; ghostSpeech(al, pick(['Take me to a healer, or bandage me back.', 'It is so cold here…', 'Do not leave me behind.'])); }
  const hr = hourOfDay(); if (P.spiritUntil > GT && GT > (P.whisperAt || 0) && (hr < 5 || hr > 21)) {
    const g = ECOS && ECOS.regions ? [...ECOS.regions.values()].find(r => r.kind === 'graveyard' && Math.hypot(r.x - P.x, r.y - P.y) < 18) : null;
    if (g && P.spiritUntil > GT && GT > (P.whisperAt || 0)) { P.whisperAt = GT + 25; log('A spirit whispers: “' + pick(GHOST_LINES) + '”', '#c8b0ff'); }
  }
}
TASKS.kindling = () => { give('kindling', 1); log('You cut some kindling.'); };
TASKS.dig = t => { const it = t.map; const w = SKD.digWindow(it.level || 1);
  if (!skillCheck('mining', w[0], w[1])) return log('You dig, but find nothing yet. Keep digging.', '#a8a8a8'); treasureUp(it); };
/* a found item: gear arrives as a proper instance (material, durability), worn to pct % of its maximum */
function lootItem(id, q, pct) { if (SF.EQ.isGear(id)) { const it = SF.EQ.make(id, { origin: 'loot' }); if (it.omax) it.cond = Math.max(1, Math.round(it.omax * pct / 100)); return it; } return SF.newItem(id, q, SF.WEARABLE(id) ? { cond: pct, maxc: 100 } : null); }
function chestLoot(tier) { const c = SF.newContainer('chest'); const add = (id, a, b) => { const q = rnd(a, b); if (q > 0) c.items.push(lootItem(id, q, rnd(70, 100))); };
  if (tier === 0) { add('gold', 15, 40); add('bandage', 2, 5); add(pick(Object.values(SF.REAGENT)), 2, 5); }
  if (tier === 1) { add('gold', 40, 90); add('draught', 0, 1); add('ironbar', 1, 2); add('lockpick', 1, 3); add(pick(Object.values(SF.REAGENT)), 3, 6); }
  if (tier === 2) { add('gold', 100, 200); add('bellshard', 1, 2); add('draught', 1, 2); if (R() < .35) add(pick(['chain_tunic', 'glaive', 'crossbow', 'studded_tunic', 'kryss', 'battleaxe', 'spear', 'norse_helm', 'kite_shield', 'ringmail_leggings']), 1, 1); for (const it of c.items) magicLoot(it, 3, .5); if (R() < .2) c.items.push(newTreasureMap(1 + Math.floor(R() * 2))); }
  return c; }
/* fresh: the lid actually opens; otherwise this only reopens the loot panel of an open chest (UI only) */
function openChest(c, fresh) { springRuneTrap(c, false); P.lootOpen = { kind: 'chest', x: c.x + .5, y: c.y + .5, cont: c.cont, name: 'chest', expires: c.refill }; openPanel('loot'); if (fresh) sndAt('chest.open', P.lootOpen, { delay: .3 }); else snd('ui.open'); }
function springOnPlayer() { snd('trap.spring', { key: 'P' }); damagePlayer(SF.TRAP.dmg, null, 'phys', { quiet: 1 }); P.slowUntil = GT + SF.TRAP.slowFor; log('A snare bites your leg! Slowed.', '#ff8a6a'); }
function interactExtra() {
  // chests
  for (const c of CHESTS.values()) { if (Math.hypot(c.x + .5 - P.x, c.y + .5 - P.y) > 2) continue;
    if (c.open && GT > c.refill) { if (c.treasure) { CHESTS.delete(c.y * W + c.x); tSet(c.x, c.y, c.under); P.cx.tchest = null; continue; } c.open = false; c.cont = null; chestTrapRoll(c); }
    if (!c.open && c.trap && !SF.count(P.pack, 'lockpick') && c.trapSeen) { log(`A locked and trapped chest (trap ${c.trap}). Remove Trap, then pick the lock.`, '#ffb070'); return true; }
    if (c.open) { openChest(c); return true; }
    if (!SF.count(P.pack, 'lockpick')) { log(`A locked chest (difficulty ${SF.CHEST_DIFF[c.tier]}). You need lockpicks.`, '#ffb070'); return true; }
    P.task = { kind: 'lock', chest: c, label: 'Picking lock', t0: GT, t1: GT + SF.LOCK_TIME, still: true, x0: P.x, y0: P.y }; sndAt('lock.pick', { x: c.x + .5, y: c.y + .5 }); return true; }
  // revealed snares
  const tr = TRAPS.find(t => !t.hidden && t.owner !== 'P' && Math.hypot(t.x - P.x, t.y - P.y) <= 2);
  if (tr) { P.task = { kind: 'disarm', trap: tr, label: 'Disarming', t0: GT, t1: GT + SF.TRAP.place, still: true, x0: P.x, y0: P.y }; return true; }
  return false;
}
function worldTick(dt) {
  // stairs between the surface and the Sunken Bell levels
  const tx = Math.floor(P.x), ty = Math.floor(P.y), t = tAt(tx, ty);
  if ((t === T.SD || t === T.SU) && GT > (P.stairCd || 0)) { const s = STAIRS.find(o => o.x === tx && o.y === ty); if (s) { P.stairCd = GT + 1.5; P.x = s.to.x; P.y = s.to.y; for (const p of ents) if (p.kind === 'pet') { p.x = P.x - .6; p.y = P.y + .6; } P.armed = false; P.sel = null; FX.push({ k: 'puff', x: P.x, y: P.y, t0: GT, dur: .5 }); log((ZONE_NAME[zoneAt(Math.floor(P.x), Math.floor(P.y))] || 'You climb out') + '.', '#ffe08a'); } }
  // snares
  for (let i = TRAPS.length - 1; i >= 0; i--) { const tr = TRAPS[i]; if (tr.until && GT > tr.until) { TRAPS.splice(i, 1); continue; } if (GT < (tr.armedAt || 0)) continue;
    if (tr.owner !== 'P' && !P.ghost && Math.hypot(tr.x - P.x, tr.y - P.y) < .6) { TRAPS.splice(i, 1); springOnPlayer(); continue; }
    if (tr.owner === 'P') for (const m of ents) if (m.kind === 'mon' && alive(m) && Math.hypot(tr.x - m.x, tr.y - m.y) < .7) { TRAPS.splice(i, 1); m.slowUntil = GT + SF.TRAP.slowFor; floater(m.x, m.y, 'snared', '#e8d090'); sndAt('trap.spring', tr); damageMon(m, SF.TRAP.dmg, 'phys', P, { quiet: 1 }); break; } }
}
function seedTraps() { for (const [cx, cy] of [[232, 288], [318, 304], [395, 284], [300, 288], [360, 178]]) for (let k = 0; k < 2; k++) { const x = cx + (R() - .5) * 8, y = cy + (R() - .5) * 6; if (!BLK[tAt(Math.floor(x), Math.floor(y))]) TRAPS.push({ x, y, owner: 'world', hidden: true, armedAt: 0, until: 0, diff: 40 }); } }

/* ================= BRINE ROADS: landmarks, protected roads, starter quest, area map ================= */
const LM = {
  quay:   { n: 'Saltmarsh Quay',  x: 92,  y: 300 },
  beacon: { n: 'Shore Beacon',    x: 134, y: 164 },
  gate:   { n: 'Brine Road Gate', x: 245, y: 376 },
  cross:  { n: 'Brine Crossroads', x: 300, y: 300 },
  pine:   { n: 'Pinewatch Woods', x: 300, y: 165 },
  ford:   { n: 'Reedwater Ford',  x: 420, y: 300 },
  silt:   { n: 'Siltmarsh',       x: 448, y: 420 },
  wreck:  { n: 'Wreck Strand',    x: 540, y: 330 } };
const ROUTE = {
  lantern: [[118, 262], [121, 236], [126, 208], [130, 184], [134, 170]],
  brine: [[128, 300], [168, 318], [208, 348], [245, 376]],
  brine2: [[245, 376], [272, 346], [300, 300]] };
const PROT = new Uint8Array(W * H);
const protAt = (x, y) => x >= 0 && y >= 0 && x < W && y < H && PROT[Math.floor(y) * W + Math.floor(x)] === 1;
const riverX = y => 420 + Math.round(7 * Math.sin(y / 23));
T.BC = 30; T.BS = 31; BLK[T.BC] = 1; BLK[T.BS] = 1;
/* Anniabreen tiles (v0.20): cliff, stone bridge deck, grave, crop rows */
T.CL = 32; T.SBR = 33; T.GV = 34; T.CP = 35; BLK[T.CL] = 1; LOSB[T.CL] = 1; BLK[T.GV] = 1;
const QUEST_CRAB = { x: LM.beacon.x + 4.5, y: LM.beacon.y + 4.5 };

function genBrine(r, carve, disc) {
  const L = LM;
  // river with one crossable ford
  for (let y = 130; y < 560; y++) { const rx = riverX(y); for (let x = rx - 4; x <= rx + 4; x++) { const t = tAt(x, y); if (t === T.WA && Math.abs(x - rx) > 1) continue; tSet(x, y, Math.abs(x - rx) <= 1 ? T.WA : T.SH); } }
  // roads
  carve(ROUTE.lantern, 2, T.RD); carve(ROUTE.brine, 3, T.RD); carve(ROUTE.brine2, 3, T.RD);
  disc(L.cross.x, L.cross.y, 6, (x, y) => tSet(x, y, T.RD)); tSet(L.cross.x + 6, L.cross.y - 6, T.LP);
  L.ford.x = riverX(300);
  carve([[300, 300], [360, 298], [L.ford.x - 6, 300]], 3, T.RD); carve([[L.ford.x + 5, 298], [459, 290]], 3, T.RD);
  for (let y = 296; y <= 304; y++) for (let x = L.ford.x - 5; x <= L.ford.x + 5; x++) tSet(x, y, T.SH);
  // Pinewatch Woods: dense pines, a loop trail, and a trail down to the ford
  disc(L.pine.x, L.pine.y, 46, (x, y) => { if (tAt(x, y) === T.G && r() < .5) tSet(x, y, T.TR); });
  const ring = []; for (let k = 0; k <= 20; k++) { const a = k / 20 * Math.PI * 2; ring.push([Math.round(L.pine.x + Math.cos(a) * 27), Math.round(L.pine.y + Math.sin(a) * 24)]); }
  carve(ring, 2, T.DI); carve([[300, 294], [300, 250], [300, 165]], 2, T.DI); disc(L.pine.x, L.pine.y, 4, (x, y) => tSet(x, y, T.DI));
  carve([[327, 168], [352, 205], [382, 248], [L.ford.x - 5, 295]], 2, T.DI);
  // Siltmarsh and Wreck Strand trails
  carve([[L.ford.x + 5, 304], [436, 350], [448, 398], [448, 420]], 2, T.DI);
  carve([[448, 420], [492, 398], [522, 364], [537, 336]], 2, T.DI);
  carve([[L.ford.x + 5, 296], [450, 262], [500, 244], [532, 274], [540, 322]], 2, T.DI);
  disc(L.silt.x, L.silt.y, 5, (x, y) => tSet(x, y, T.DI));
  disc(L.wreck.x, L.wreck.y, 13, (x, y) => { const t = tAt(x, y); if (t !== T.WA) tSet(x, y, r() < .06 ? T.SB : T.SA); });
  for (const [wx, wy, len] of [[542, 320, 9], [534, 338, 7]]) for (let i = 0; i < len; i++) { if (i % 3 !== 1) { tSet(wx + i, wy, T.WL); tSet(wx + i, wy + 3, T.WL); } tSet(wx + i, wy + 1, T.FL); tSet(wx + i, wy + 2, T.FL); }
  // Shore Beacon headland
  disc(L.beacon.x, L.beacon.y, 9, (x, y, d) => tSet(x, y, d < .5 ? T.DI : d > .85 ? T.SA : T.G)); tSet(L.beacon.x, L.beacon.y, T.BC);
  // protected area: the Quay, Lantern Road, the beacon headland, and Brine Road up to the gate
  const q = ZONES.quay; for (let y = q.y0; y <= q.y1; y++) for (let x = q.x0; x <= q.x1; x++) PROT[y * W + x] = 1;
  const along = (pts, fn) => { for (let i = 0; i < pts.length - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2); for (let k = 0; k <= n; k++) fn(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, x1 - x0, y1 - y0, k, i); } };
  const mark = (cx, cy, rad) => { for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) if (Math.hypot(x + .5 - cx, y + .5 - cy) <= rad && x >= 0 && y >= 0 && x < W && y < H) PROT[y * W + x] = 1; };
  along(ROUTE.lantern, (x, y) => mark(x + 1, y + 1, 5)); along(ROUTE.brine, (x, y) => mark(x + 1.5, y + 1.5, 5)); mark(L.beacon.x + .5, L.beacon.y + .5, 11);
  const g = L.gate, p = ROUTE.brine[ROUTE.brine.length - 2], dl = Math.hypot(g.x - p[0], g.y - p[1]), dx = (g.x - p[0]) / dl, dy = (g.y - p[1]) / dl; L.gate.dx = dx; L.gate.dy = dy;
  for (let y = g.y - 9; y <= g.y + 9; y++) for (let x = g.x - 9; x <= g.x + 9; x++) if ((x + .5 - g.x - 1.5) * dx + (y + .5 - g.y - 1.5) * dy > 0) PROT[y * W + x] = 0;
  // gate pillars and lamps across the road at the boundary
  for (const s of [-1, 1]) { const ox = -dy * s, oy = dx * s; const at = k => [Math.round(g.x + 1.5 + ox * k), Math.round(g.y + 1.5 + oy * k)]; const [lx, ly] = at(3.6); tSet(lx, ly, T.LP); for (const k of [4.8, 5.8]) { const [wx, wy] = at(k); tSet(wx, wy, T.WL); } }
  // boundary stones along the protected roads
  const stone = (x, y) => { x = Math.round(x); y = Math.round(y); const t = tAt(x, y); if (t === T.G || t === T.SA || t === T.TR || t === T.DI) tSet(x, y, T.BS); };
  for (const route of [ROUTE.lantern, ROUTE.brine]) along(route, (x, y, ddx, ddy, k) => { if (k % 14 !== 7) return; const l = Math.hypot(ddx, ddy); const nx = -ddy / l, ny = ddx / l; stone(x + 1 + nx * 5.2, y + 1 + ny * 5.2); stone(x + 1 - nx * 5.2, y + 1 - ny * 5.2); });
}

/* ---------- starter quest: A Light for the Quay ---------- */
SF.ITEMS.wick = { n: 'Dry wick', kg: .05, stack: 1, cat: 'quest' };
MON.wreckcrab = { n: 'wreck crab', col: '#c0502a', size: .9, h: 28, hp: 34, atk: 35, def: 30, dmg: [3, 6], reach: 1.2, tele: .6, rec: 1.4, speed: 2.4, aggro: 6, leash: 9, armor: 15, diff: 30, loot: { shelldust: [1, 2], gold: [2, 6] }, skin: { meat: [1, 1] } };
MON.skeleton = { n: 'drowned skeleton', col: '#c8b890', size: 1, h: 60, hp: 55, atk: 58, def: 50, dmg: [7, 11], reach: 1.3, tele: .5, rec: 1.1, speed: 3.6, aggro: 7, leash: 18, armor: 12, diff: 55, loot: { gold: [4, 16], bellshard: [0, 1], bone: [2, 5] } };
SPAWNS.push({ type: 'skeleton', x: 540, y: 330, r: 11, max: 3, n: 0, next: 0 });
// T2A halves damage to players at the end of a blow; creature damage ranges double so PvE threat stays near v0.16 (tuning)
for (const k in MON) { const d = MON[k]; if (d._x2) continue; d._x2 = 1; d.dmg = d.dmg.map(v => v * 2); if (d.ranged2) d.ranged2.dmg = d.ranged2.dmg.map(v => v * 2); }
const Q = () => P.quest || (P.quest = { beacon: 0 });
const hasWick = () => SF.count(P.pack, 'wick') > 0;
const crabAlive = () => ents.find(e => e.kind === 'mon' && e.quest && !e.gone && e.hp > 0);
function questObjective() { return guildObjective() || beaconObjective(); }
function beaconObjective() {
  const s = Q().beacon;
  if (s === 0) return { t: 'Speak to the Quaywarden', at: QW() };
  if (s === 1) { if (!hasWick()) return { t: 'Get a new wick from the Quaywarden', at: QW() }; return { t: !Q().crabDead ? 'Defeat the wreck crab at the Shore Beacon' : 'Light the Shore Beacon', at: LM.beacon }; }
  if (s === 2) return { t: 'Return to the Quaywarden', at: QW() };
  if (s === 3) return { t: 'Head east to Brine Road Gate', at: LM.gate };
  return null;
}
function QW() { return ents.find(e => e.role === 'quaywarden') || { x: 97, y: 303 }; }
function questTick() {
  const q = Q(); if (!P || P.ghost) return;
  if (q.beacon === 1 && !q.crabDead && !crabAlive()) { const d = MON.wreckcrab; addEnt({ kind: 'mon', type: 'wreckcrab', quest: true, name: d.n, x: QUEST_CRAB.x, y: QUEST_CRAB.y, hp: d.hp, max: d.hp, state: 'idle', home: { x: QUEST_CRAB.x, y: QUEST_CRAB.y }, sect: 0, ward: 0, purse: 0 }); }
  if (q.beacon === 3 && !protAt(P.x, P.y) && Math.hypot(P.x - LM.gate.x, P.y - LM.gate.y) < 14) { q.beacon = 4; log('You pass Brine Road Gate. Full-loot wilderness rules apply out here: die and everything you carry stays on your body.', '#ff9a6a'); save(); }
}
function questCrabKilled() { Q().crabDead = true; log('The wreck crab scuttles no more. Interact with the beacon to light it.', '#ffe08a'); save(); }
function nearBeacon() { return Math.hypot(P.x - LM.beacon.x - .5, P.y - LM.beacon.y - .5) <= 2.4; }
function useBeacon() {
  const q = Q();
  if (q.beacon >= 2) return log('The Shore Beacon burns bright over the water.');
  if (q.beacon === 0) return log('A cold beacon, its wick drowned by the storm. The Quaywarden may want it lit.');
  if (!q.crabDead) return log('The wreck crab will not let you near. Defeat it first.', '#ffb070');
  if (!hasWick()) return log('You need a dry wick. The Quaywarden can spare another.', '#ffb070');
  SF.removeQty(P.pack, 'wick', 1); q.beacon = 2; FX.push({ k: 'puff', x: LM.beacon.x + .5, y: LM.beacon.y + .5, t0: GT, dur: 1 }); sndAt('world.beacon', { x: LM.beacon.x + .5, y: LM.beacon.y + .5 });
  log('The beacon catches and roars to life. Return to the Quaywarden.', '#ffe08a'); save();
}
const QW_TEXT = '“The last storm put out our shore beacon. Take this wick up Lantern Road, light the beacon, and come back. Stick to the road. Beyond the boundary stones, you’re on your own.”';
function questPanel() {
  const s = Q().beacon; let body = '', btns = '';
  if (s === 0) { body = `<p>${QW_TEXT}</p>`; btns = btn('qaccept', 'Accept: A Light for the Quay', null, 'ac'); }
  else if (s === 1) { body = hasWick() ? '<p>“The beacon stands at the end of Lantern Road, north along the coast. Mind the crabs.”</p>' : '<p>“Lost the wick? Here, I keep spares.”</p>'; if (!hasWick()) btns = btn('qwick', 'Take a new wick', null, 'ac'); }
  else if (s === 2) { body = '<p>“I saw it from the docks. Good work. Take these for the road.”</p>'; btns = btn('qturn', 'Claim reward', null, 'ac'); }
  else body = '<p>“Brine Road runs east to the gate. Past the gate pillars the guards can’t help you: whatever you carry stays on your body if you fall. Bank what you can’t afford to lose.”</p>';
  return ['Quaywarden Brann', body + `<div class="row">${btns}</div>`];
}
function journalPanel() {
  const tab = PTAB || (Object.keys(gqAll()).length || Q().beacon >= 3 ? 'guilds' : 'quay'); const tabs = `<div class="tabs">${btn('jtab', 'Guilds', { t: 'guilds' }, tab === 'guilds' ? 'ac' : '')}${btn('jtab', 'A Light for the Quay', { t: 'quay' }, tab === 'quay' ? 'ac' : '')}</div>`;
  if (tab === 'guilds') return ['Journal', tabs + guildJournal()];
  const s = Q().beacon, o = beaconObjective();
  const steps = ['Speak to the Quaywarden', 'Take the wick up Lantern Road and light the Shore Beacon', 'Return to the Quaywarden', 'Done'];
  return ['Journal', tabs + `<h3>A Light for the Quay</h3><p class="dim">${QW_TEXT}</p><ol>${steps.map((t, i) => `<li style="${i < Math.min(s, 3) ? 'opacity:.5;text-decoration:line-through' : i === Math.min(s, 3) ? 'color:#ffe08a' : ''}">${t}</li>`).join('')}</ol>${o ? `<p><b>Now:</b> ${o.t}</p>` : '<p>Quest complete. The Brine Roads are open to you.</p>'}<p class="dim">Protected: the Quay, Lantern Road, the beacon headland, and Brine Road up to the gate. Everywhere else is full-loot wilderness.</p><div class="row">${btn('map', 'Open map')}</div>`];
}

/* ---------- screens: menu and area map ---------- */
let SCREEN = null;
function openScreen(k) {
  closePanel(); SCREEN = k; resetInput();
  document.body.classList.add('scr-open'); $('#menuScr').hidden = k !== 'menu'; $('#mapScr').hidden = k !== 'map';
  if (k === 'map') { sizeMap(); mapFit(); drawMap(); }
}
function closeScreen() { SCREEN = null; document.body.classList.remove('scr-open'); $('#menuScr').hidden = true; $('#mapScr').hidden = true; }
const MV = { s: 1, ox: 0, oy: 0 }; let mapBase = null, mapProt = null;
function buildMapImgs() {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(miniImg, 0, 0); g.fillStyle = '#1e5a96';
  for (const L of LEVELS) g.fillRect(L.x0, L.y0, LV, LV); mapBase = c;
  const p = document.createElement('canvas'); p.width = W; p.height = H; const pg = p.getContext('2d'); const id = pg.createImageData(W, H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const i = y * W + x; if (!PROT[i]) continue; const edge = !PROT[i - 1] || !PROT[i + 1] || !PROT[i - W] || !PROT[i + W]; const o = i * 4; if (edge) { id.data[o] = 255; id.data[o + 1] = 70; id.data[o + 2] = 50; id.data[o + 3] = 255; } else { id.data[o] = 255; id.data[o + 1] = 214; id.data[o + 2] = 100; id.data[o + 3] = 60; } }
  pg.putImageData(id, 0, 0); mapProt = p;
}
function sizeMap() { const c = $('#mapc'), r = c.getBoundingClientRect(); c.width = Math.round(r.width * DPR); c.height = Math.round(r.height * DPR); }
/* Fit frames the land you are on (Saltmarsh or Anniabreen); World shows both */
function mapFit(all) { const c = $('#mapc'); const b = all ? [0, 0, W, H] : P && (P.x >= SW || P.y >= SW) ? ANN_BOUNDS : [35, 40, 575, 560]; const bw = b[2] - b[0], bh = b[3] - b[1];
  MV.s = Math.min(c.width / bw, c.height / bh); MV.ox = (b[0] + b[2]) / 2 - c.width / 2 / MV.s; MV.oy = (b[1] + b[3]) / 2 - c.height / 2 / MV.s; }
function drawMap() {
  const c = $('#mapc'); if (!c || !P) return; if (!mapBase) buildMapImgs(); const g = c.getContext('2d'), s = MV.s;
  const X = x => (x - MV.ox) * s, Y = y => (y - MV.oy) * s;
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#1e5a96'; g.fillRect(0, 0, c.width, c.height); g.imageSmoothingEnabled = false;
  g.drawImage(mapBase, X(0), Y(0), W * s, H * s); g.drawImage(mapProt, X(0), Y(0), W * s, H * s);
  const f = Math.max(11, Math.min(16, 4 + s * 3)) * DPR / 1.6 + 4;
  g.textAlign = 'center'; g.lineJoin = 'round'; g.font = `600 ${f}px ${PXF}`; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.85)';
  const small = c.width < 700 * DPR || s < 1.1;   // phone or zoomed out: towns and travel symbols first
  if (!small || s > 1.6) for (const k in LM) { const m = LM[k]; const x = X(m.x), y = Y(m.y); g.fillStyle = '#ffe9b0'; g.beginPath(); g.arc(x, y, 3 * DPR, 0, 7); g.fill(); g.strokeText(m.n, x, y - 7 * DPR); g.fillText(m.n, x, y - 7 * DPR); }
  else { const x = X(LM.quay.x), y = Y(LM.quay.y); g.font = `bold ${f * 1.15}px ${PXF}`; g.fillStyle = '#ffe9b0'; g.strokeText('Saltmarsh Quay', x, y - 8 * DPR); g.fillText('Saltmarsh Quay', x, y - 8 * DPR); g.font = `600 ${f}px ${PXF}`; }
  annMapDraw(g, X, Y, s, f, small);
  // gate boundary label
  { const x = X(LM.gate.x + 6), y = Y(LM.gate.y + 9); g.font = `${f * .8}px ${PXF}`; g.fillStyle = '#ff8a6a'; g.strokeText('full-loot beyond', x, y + 10 * DPR); g.fillText('full-loot beyond', x, y + 10 * DPR); }
  // pins from the guilds and the last vein surveyed
  for (const pn of (P.cx.pins || []).concat(P.cx.vein ? [{ n: 'Surveyed: ' + P.cx.vein.n, x: P.cx.vein.x, y: P.cx.vein.y }] : [])) { const x = X(pn.x + .5), y = Y(pn.y + .5); g.font = `${f * .8}px ${PXF}`; g.fillStyle = '#9fe0dc'; g.beginPath(); g.arc(x, y, 2.5 * DPR, 0, 7); g.fill(); g.strokeText(pn.n, x, y + 12 * DPR); g.fillText(pn.n, x, y + 12 * DPR); }
  // quest marker
  const o = questObjective(); if (o && o.at) { const x = X(o.at.x + .5), y = Y(o.at.y + .5), b = Math.sin(GT * 5) * 3 * DPR; g.font = `bold ${f * 1.6}px ${PXF}`; g.fillStyle = '#ffd23a'; g.strokeText('!', x, y - 10 * DPR + b); g.fillText('!', x, y - 10 * DPR + b); }
  // player arrow: screen-space facing converted to world heading
  const [ux, uy] = headingOf(P);
  const px = X(P.x), py = Y(P.y), R2 = 9 * DPR; g.fillStyle = '#ffffff'; g.strokeStyle = '#000'; g.lineWidth = 2 * DPR;
  g.beginPath(); g.moveTo(px + ux * R2, py + uy * R2); g.lineTo(px - ux * R2 * .7 - uy * R2 * .6, py - uy * R2 * .7 + ux * R2 * .6); g.lineTo(px - ux * R2 * .3, py - uy * R2 * .3); g.lineTo(px - ux * R2 * .7 + uy * R2 * .6, py - uy * R2 * .7 - ux * R2 * .6); g.closePath(); g.stroke(); g.fill();
  if (levelAt(Math.floor(P.x), Math.floor(P.y))) { g.font = `${f}px ${PXF}`; g.fillStyle = '#fff'; g.fillText('You are underground', c.width / 2, c.height - 20 * DPR); }
  compassN(g, c.width - 26 * DPR, 26 * DPR, 18 * DPR);
}
{ const ptrs = new Map(); let last = null;
  const mc = () => $('#mapc');
  const st = () => { const v = [...ptrs.values()]; if (v.length === 1) return { x: v[0].x, y: v[0].y, d: 0 }; const [a, b] = v; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }; };
  addEventListener('DOMContentLoaded', () => { });
  setTimeout(() => { const c = mc(); if (!c) return;
    c.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); c.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX * DPR, y: e.clientY * DPR }); last = st(); });
    c.addEventListener('pointermove', e => { if (!ptrs.has(e.pointerId)) return; e.preventDefault(); ptrs.set(e.pointerId, { x: e.clientX * DPR, y: e.clientY * DPR }); const n = st();
      if (last) { if (n.d && last.d) { const k = n.d / last.d, wx = n.x / MV.s + MV.ox, wy = n.y / MV.s + MV.oy; MV.s = Math.max(.4, Math.min(14, MV.s * k)); MV.ox = wx - n.x / MV.s; MV.oy = wy - n.y / MV.s; } MV.ox -= (n.x - last.x) / MV.s; MV.oy -= (n.y - last.y) / MV.s; }
      last = n; drawMap(); });
    const up = e => { ptrs.delete(e.pointerId); last = ptrs.size ? st() : null; }; c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', e => { e.preventDefault(); const k = e.deltaY < 0 ? 1.15 : 1 / 1.15, x = e.offsetX * DPR, y = e.offsetY * DPR, wx = x / MV.s + MV.ox, wy = y / MV.s + MV.oy; MV.s = Math.max(.4, Math.min(14, MV.s * k)); MV.ox = wx - x / MV.s; MV.oy = wy - y / MV.s; drawMap(); }, { passive: false });
  }, 0); }

/* ---------- contextual HUD buttons ---------- */
function canInteract() {
  if (P.ghost) { const r = nearestRes(); return !!(r && Math.hypot(r.x - P.x, r.y - P.y) <= 2.5); }
  if (nearBeacon() || nearDoor() || annCanInteract()) return true;
  for (const e of ents) { if (e === P || e.gone || e.hidden) continue; const d = Math.hypot(e.x - P.x, e.y - P.y); if ((e.kind === 'npc' && d <= 2.5) || (e.kind === 'corpse' && d <= 2) || (e.kind === 'pet' && d <= 1.5 && false)) return true; }
  for (const c of CHESTS.values()) if (Math.hypot(c.x + .5 - P.x, c.y + .5 - P.y) <= 2) return true;
  for (const s of STATIONS) if (Math.hypot(s.x + .5 - P.x, s.y + .5 - P.y) <= 2) return true;
  const sel = P.sel; if (sel && sel.kind === 'node') return true;
  const fx = Math.floor(P.x), fy = Math.floor(P.y); for (let y = fy - 1; y <= fy + 1; y++) for (let x = fx - 1; x <= fx + 1; x++) { const t = tAt(x, y); if (NODE[t] || t === T.SD || t === T.SU) return true; if (t === T.WA && SF.count(P.pack, 'rod')) return true; }
  return false;
}
function questMarkers(g, S) {
  const o = questObjective(); const mk = (wx, wy, ch, h) => { const [x, y] = S(wx, wy); const yy = y - h / CAM.f - 14 + Math.sin(GT * 4) * 3; g.font = `bold 22px ${PXF}`; g.lineWidth = 4; g.strokeStyle = '#000'; g.strokeText(ch, x, yy); g.fillStyle = '#ffd23a'; g.fillText(ch, x, yy); };
  const s = Q().beacon, qw = ents.find(e => e.role === 'quaywarden');
  if (qw && (s === 0 || s === 2 || (s === 1 && !hasWick()))) mk(qw.x, qw.y, s === 2 ? '?' : '!', 80);
  if (s === 1 && hasWick()) mk(LM.beacon.x + .5, LM.beacon.y + .5, '!', 70);
  for (const G of GUILDS) { if (!G.npc) continue; const n = npcBy(G.npc); if (!n) continue; const id = G.q[0], q = gq(id); if (q.s === 'none' && sv(GQD[id].skill) >= GQD[id].min) mk(n.x, n.y, '!', 80); else if (gqReady(id) || (q.s === 'done' && q.pending)) mk(n.x, n.y, '?', 80); }
  if (o && o.id && o.at && !o.at.kind && !P.ghost) { mk(o.at.x + .5, o.at.y + .5, '!', 54);
    const [tx, ty] = S(o.at.x + .5, o.at.y + .5), [px, py] = S(P.x, P.y), d = Math.hypot(o.at.x + .5 - P.x, o.at.y + .5 - P.y), on = tx > 40 && tx < VW - 40 && ty > 70 && ty < VH - 70;
    if (!on && d > 4) { const a = Math.atan2(ty - py, tx - px), rad = Math.min(VW, VH) * .34, cx = VW / 2 + Math.cos(a) * rad, cy = VH / 2 + Math.sin(a) * rad; g.save(); g.translate(cx, cy); g.rotate(a); g.fillStyle = '#ffd23a'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(18, 0); g.lineTo(-10, -12); g.lineTo(-4, 0); g.lineTo(-10, 12); g.closePath(); g.fill(); g.stroke(); g.restore(); g.font = `bold 12px ${PXF}`; g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(Math.round(d) + ' m', cx, cy + 26); g.fillStyle = '#ffd23a'; g.fillText(Math.round(d) + ' m', cx, cy + 26); } }
  else if (o && o.id && o.at && o.at.kind === 'npc' && !P.ghost) { const n = o.at, d = dist(n, P), [tx, ty] = S(n.x, n.y), [px, py] = S(P.x, P.y), on = tx > 40 && tx < VW - 40 && ty > 70 && ty < VH - 70;
    if (!on && d > 4) { const a = Math.atan2(ty - py, tx - px), rad = Math.min(VW, VH) * .34, cx = VW / 2 + Math.cos(a) * rad, cy = VH / 2 + Math.sin(a) * rad; g.save(); g.translate(cx, cy); g.rotate(a); g.fillStyle = '#ffd23a'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(18, 0); g.lineTo(-10, -12); g.lineTo(-4, 0); g.lineTo(-10, 12); g.closePath(); g.fill(); g.stroke(); g.restore(); g.font = `bold 12px ${PXF}`; g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(n.name.split(',')[0] + ' · ' + Math.round(d) + ' m', cx, cy + 26); g.fillStyle = '#ffd23a'; g.fillText(n.name.split(',')[0] + ' · ' + Math.round(d) + ' m', cx, cy + 26); } }
}

/* ================= RENDERING: low-res isometric buffer, fixed camera (yaw 45°, ~2:1 pitch) ================= */
const cv = $('#c'), mctx = cv.getContext('2d'); let ctx = null;
let VW = 1, VH = 1, DPR = 1, ZOOM = .7, DP = 2; const ZOOMS = [.5, .7, 1, 1.3];
const HW = 32, HH = 16, TW = 64, TH = 32;
const SX = (x, y) => (x - y) * HW, SY = (x, y) => (x + y) * HH;          // continuous world (m) -> world px
const LB = document.createElement('canvas'), lbx = LB.getContext('2d'); ctx = lbx;
const lc = document.createElement('canvas'), lctx = lc.getContext('2d');
let CAM = { x: 0, y: 0, f: 1 };
function resize() {
  DPR = Math.min(3, window.devicePixelRatio || 1); VW = innerWidth; VH = innerHeight; cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  DP = Math.max(1, Math.round(ZOOM * DPR)); LB.width = Math.ceil(cv.width / DP); LB.height = Math.ceil(cv.height / DP); lc.width = LB.width; lc.height = LB.height;
  document.body.classList.toggle('portrait', VH > VW);
}
/* ---- tiles ---- */
const TC = {}, TT = 32;
function mk(fn) { const c = document.createElement('canvas'); c.width = c.height = TT; const g = c.getContext('2d'); fn(g); return c; }
function dia(sq) { const c = document.createElement('canvas'); c.width = 68; c.height = 36; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.setTransform(34 / TT, 18 / TT, -34 / TT, 18 / TT, 34, 0); g.drawImage(sq, 0, 0); return c; }
function spk(g, base, cols, n) { g.fillStyle = base; g.fillRect(0, 0, TT, TT); for (let i = 0; i < n; i++) { g.fillStyle = pick(cols); g.fillRect(rnd(0, TT - 1), rnd(0, TT - 1), 1, 1); } }
function buildTiles() {
  const v = 4, D = a => a.map(c => dia(c)), V = f => D([...Array(v)].map(() => mk(f)));
  TC.g = V(g => { spk(g, '#4a8a3c', ['#56984a', '#3f7a34', '#5fa452', '#467f39'], 150); for (let i = 0; i < 5; i++) { g.fillStyle = '#6cb45c'; g.fillRect(rnd(2, 28), rnd(2, 28), 1, 2); } if (R() < .3) { g.fillStyle = pick(['#f0d860', '#e8a0c0', '#ffffff']); g.fillRect(rnd(3, 28), rnd(3, 28), 1, 1); } });
  TC.sa = V(g => spk(g, '#d8c08a', ['#e6d2a2', '#c4a874', '#d0b680'], 110));
  TC.di = V(g => spk(g, '#7c5c3c', ['#8a6a48', '#684a2e', '#74563a'], 130));
  TC.rd = V(g => { g.fillStyle = '#6a665e'; g.fillRect(0, 0, TT, TT); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = pick(['#a6a094', '#928c80', '#b4ae9e', '#9a9488']); g.fillRect(x * 4 + (y % 2) * 2, y * 4, 3, 3); } });
  TC.fl = V(g => { for (let y = 0; y < 8; y++) { g.fillStyle = pick(['#a06a3a', '#925e32', '#ac7642']); g.fillRect(0, y * 4, TT, 3); g.fillStyle = '#5a3418'; g.fillRect(0, y * 4 + 3, TT, 1); g.fillRect(rnd(2, 29), y * 4, 1, 3); } });
  TC.rk = V(g => spk(g, '#6e6862', ['#7c766e', '#5c5650', '#86807a'], 120));
  TC.sh = [0, 1, 2].map(f => V(g => { spk(g, '#4a6e58', ['#56806a', '#3e5e4a', '#5a7a5c'], 90); g.fillStyle = 'rgba(120,180,200,.35)'; for (let i = 0; i < 4; i++) g.fillRect((rnd(0, 26) + f * 5) % TT, rnd(0, 30), rnd(3, 6), 1); }));
  TC.wa = [0, 1, 2].map(f => V(g => { g.fillStyle = '#1e5a96'; g.fillRect(0, 0, TT, TT); g.fillStyle = '#2a6eb0'; for (let i = 0; i < 6; i++) g.fillRect(rnd(0, 26), (i * 5 + f * 2) % TT, rnd(3, 6), 1); g.fillStyle = '#9ccaf0'; for (let i = 0; i < 2; i++) g.fillRect((f * 9 + rnd(0, 20)) % TT, (f * 5 + i * 13 + 7) % TT, 2, 1); }));
  TC.br = D([mk(g => { g.fillStyle = '#1e5a96'; g.fillRect(0, 0, TT, TT); for (let x = 0; x < 8; x++) { g.fillStyle = pick(['#9a6a3c', '#8a5c30']); g.fillRect(x * 4, 0, 3, TT); g.fillStyle = '#4e2e14'; g.fillRect(x * 4 + 3, 0, 1, TT); } })]);
  TC.dr = D([mk(g => { g.fillStyle = '#a06a3a'; g.fillRect(0, 0, TT, TT); g.fillStyle = '#4a2810'; g.fillRect(4, 4, 24, 24); g.fillStyle = '#e8c040'; g.fillRect(20, 14, 3, 3); })]);
  TC.sb = V(g => { spk(g, '#d8c08a', ['#e6d2a2', '#c4a874'], 80); for (let i = 0; i < 7; i++) { g.fillStyle = pick(['#f4ece0', '#e8c8c0', '#d0d8e0']); const x = rnd(4, 26), y = rnd(4, 26); g.fillRect(x, y, 3, 2); g.fillStyle = '#9a8a78'; g.fillRect(x, y + 2, 3, 1); } });
  TC.sc = V(g => { spk(g, '#6a5e52', ['#7a6e60'], 60); for (let i = 0; i < 30; i++) { g.fillStyle = pick(['#e8e4dc', '#cfc8bc', '#2e2a28']); g.fillRect(rnd(4, 27), rnd(4, 27), 2, 1); } });
  TC.cf = V(g => { spk(g, '#3a3632', ['#46423c', '#2e2a26', '#4e4840'], 140); for (let i = 0; i < 3; i++) { g.fillStyle = '#5a554e'; g.fillRect(rnd(2, 26), rnd(2, 26), 4, 3); } });
  TC.sd = D([mk(g => { g.fillStyle = '#1a1612'; g.fillRect(0, 0, TT, TT); for (let i = 0; i < 6; i++) { g.fillStyle = shade('#7a6e60', -i * 14); g.fillRect(2 + i * 2, 2 + i * 4, TT - 4 - i * 4, 3); } })]);
  TC.su = D([mk(g => { g.fillStyle = '#4a443c'; g.fillRect(0, 0, TT, TT); for (let i = 0; i < 6; i++) { g.fillStyle = shade('#9a8e7e', -(5 - i) * 10); g.fillRect(2, 2 + i * 5, TT - 4, 3); } g.fillStyle = '#ffd678'; g.fillRect(14, 14, 4, 4); })]);
  TC.hb = V(g => { spk(g, '#4a6e48', ['#56805a', '#3e5e40'], 80); for (let i = 0; i < 6; i++) { const x = rnd(6, 24), y = rnd(6, 24); g.fillStyle = '#8a4a2a'; g.fillRect(x, y, 2, 3); g.fillStyle = '#7ac050'; g.fillRect(x - 1, y - 2, 4, 2); } });
}
function ground(t, x, y, wf) {
  const h = hash(x, y) & 3;
  switch (t) { case T.WA: return TC.wa[wf][h]; case T.SH: case T.RB: case T.MR: return TC.sh[wf][h]; case T.SA: return TC.sa[h]; case T.SB: return TC.sb[h]; case T.SC: return TC.sc[h]; case T.HB: return TC.hb[h];
    case T.DI: case T.BL: return TC.di[h]; case T.CF: return TC.cf[h]; case T.SD: return TC.sd[0]; case T.SU: return TC.su[0]; case T.CH: return levelAt(x, y) ? TC.cf[h] : TC.di[h]; case T.RD: case T.AK: case T.LP: return TC.rd[h]; case T.FL: case T.FG: case T.AN: case T.WL: case T.BN: case T.ST: return TC.fl[h]; case T.RK: case T.CL: return TC.rk[h]; case T.SBR: return TC.rd[h]; case T.CP: return TC.di[h]; case T.BR: return TC.br[0]; case T.DR: return TC.dr[0]; case T.FP: return TC.di[h]; default: return TC.g[h]; }
}
function poly(g, pts) { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill(); }
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function block(g, x, y, h, top, lf, rf) { const tx = SX(x, y), ty = SY(x, y); const Tt = [tx, ty], Rr = [tx + HW, ty + HH], B = [tx, ty + TH], L = [tx - HW, ty + HH];
  g.fillStyle = lf; poly(g, [L, B, [B[0], B[1] - h], [L[0], L[1] - h]]); g.fillStyle = rf; poly(g, [B, Rr, [Rr[0], Rr[1] - h], [B[0], B[1] - h]]);
  g.fillStyle = top; poly(g, [[Tt[0], Tt[1] - h], [Rr[0], Rr[1] - h], [B[0], B[1] - h], [L[0], L[1] - h]]); return { T: Tt, Rr, B, L }; }
function inFront(x, y) { if (!P) return false; const d = (x + y + 1) - (P.x + P.y), s = Math.abs((x - y) - (P.x - P.y)); return d > 0 && d <= 5 && s <= d + 1.5; }
function shade(hex, amt) { const n = parseInt(hex.slice(1), 16); const r = cl((n >> 16) + amt, 0, 255), gg = cl((n >> 8 & 255) + amt, 0, 255), b = cl((n & 255) + amt, 0, 255); return `rgb(${r},${gg},${b})`; }
function drawTall(t, x, y) {
  const g = ctx, h = hash(x, y), cx = SX(x + .5, y + .5), cy = SY(x + .5, y + .5); g.save();
  if ((t === T.WL || t === T.TR || t === T.RK || t === T.MR || t === T.CL) && inFront(x, y)) g.globalAlpha = .4;
  if (t === T.TR) {   // pine
    const s = .85 + (h % 5) * .06, st = nodeStock(x, y).n <= 0; g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(cx + 6, cy + 2, 20 * s, 8 * s, 0, 0, 7); g.fill();
    g.fillStyle = '#4e331b'; g.fillRect(cx - 3, cy - (st ? 10 : 22), 6, st ? 11 : 23);
    if (st) { g.fillStyle = '#c8a070'; g.beginPath(); g.ellipse(cx, cy - 10, 3, 1.5, 0, 0, 7); g.fill(); g.restore(); return; }
    const cols = h % 3 === 0 ? ['#1c4a2a', '#286036', '#3a7a46'] : ['#1f5230', '#2c6a3a', '#43884e'];
    for (let i = 0; i < 4; i++) { const w = (26 - i * 5) * s, yy = cy - 18 * s - i * 13 * s; g.fillStyle = cols[0]; poly(g, [[cx - w, yy], [cx + w, yy], [cx, yy - 22 * s]]); g.fillStyle = cols[1]; poly(g, [[cx - w * .8, yy - 2], [cx + w * .1, yy - 2], [cx, yy - 20 * s]]); g.fillStyle = cols[2]; g.fillRect(cx - w * .5, yy - 6 * s, 3, 2); }
  } else if (t === T.MR) { g.strokeStyle = '#3a3028'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 1, cy - 34); g.moveTo(cx, cy - 20); g.lineTo(cx - 10, cy - 30); g.moveTo(cx + 1, cy - 28); g.lineTo(cx + 10, cy - 40); g.stroke(); }
  else if (t === T.WL) { const Hh = 38, p = block(g, x, y, Hh, '#b4ac9c', '#8a8274', '#6a625a'); g.strokeStyle = 'rgba(40,30,24,.5)'; g.lineWidth = 1.5; for (let i = 1; i < 4; i++) { const o = Hh * i / 4; g.beginPath(); g.moveTo(p.L[0], p.L[1] - o); g.lineTo(p.B[0], p.B[1] - o); g.lineTo(p.Rr[0], p.Rr[1] - o); g.stroke(); } }
  else if (t === T.FN) { const p = block(g, x, y, 10, '#9a7448', '#7a5634', '#5e4028'); g.fillStyle = '#6a4a2a'; g.fillRect(cx - 2, cy - 22, 4, 18); }
  else if (t === T.RK) { const Hh = 16 + (h % 5) * 7, p = block(g, x, y, Hh, ['#7e766c', '#746c64', '#888076'][h % 3], '#5e5850', '#48423c'); const ax = p.T[0] + ((h >> 3) % 24 - 12), ay = p.T[1] + HH - Hh - 10 - ((h >> 6) % 12); g.fillStyle = '#8e867c'; poly(g, [[p.L[0], p.L[1] - Hh], [ax, ay], [p.B[0], p.B[1] - Hh]]); g.fillStyle = '#66605a'; poly(g, [[ax, ay], [p.Rr[0], p.Rr[1] - Hh], [p.B[0], p.B[1] - Hh]]);
    if (nodeTier(x, y) >= 0 && nodeStock(x, y).n > 0 && h % 3 === 0) { g.fillStyle = ['#c87850', '#d0a050', '#a0c0e0', '#e0d070'][nodeTier(x, y)]; g.fillRect(ax - 4, ay + 8, 3, 2); g.fillRect(ax + 3, ay + 12, 2, 2); } }
  else if (t === T.RB) { if (nodeStock(x, y).n > 0) for (let i = 0; i < 9; i++) { const ox = ((h >> i) % 26) - 13, oy = ((h >> (i + 3)) % 10) - 5, ht = 14 + (h >> (i * 2)) % 10; g.strokeStyle = i % 2 ? '#8aa040' : '#6a8a30'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + ox, cy + oy); g.lineTo(cx + ox + 2, cy + oy - ht); g.stroke(); g.fillStyle = '#6a4a28'; g.fillRect(cx + ox + 1, cy + oy - ht - 4, 3, 5); } }
  else if (t === T.FG) { const p = block(g, x, y, 24, '#3a1e16', '#8a4030', '#62301e'); const fl = Math.sin(GT * 11 + x) * .5 + .5, mx = (p.L[0] + p.B[0]) / 2, my = (p.L[1] + p.B[1]) / 2 - 12; g.fillStyle = '#1a0d08'; poly(g, [[mx - 10, my - 2], [mx + 8, my + 7], [mx + 8, my + 16], [mx - 10, my + 7]]); g.fillStyle = `rgb(255,${120 + fl * 90 | 0},40)`; poly(g, [[mx - 7, my + 3], [mx + 5, my + 9], [mx + 5, my + 14], [mx - 7, my + 8]]); }
  else if (t === T.AN) { g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(cx, cy, 16, 6, 0, 0, 7); g.fill(); g.fillStyle = '#3a3d42'; g.fillRect(cx - 6, cy - 16, 12, 16); g.fillStyle = '#585c62'; poly(g, [[cx - 18, cy - 22], [cx + 16, cy - 22], [cx + 12, cy - 15], [cx - 12, cy - 15]]); g.fillStyle = '#80858c'; g.fillRect(cx - 16, cy - 22, 30, 2); }
  else if (t === T.BN) { const p = block(g, x, y, 14, '#b07c44', '#8a5c30', '#6a4422'); g.fillStyle = '#d8d0c0'; g.fillRect(p.T[0] - 8, p.T[1] + 8 - 14, 10, 3); g.fillStyle = '#5a5a60'; g.fillRect(p.T[0] + 4, p.T[1] + 12 - 14, 6, 2); }
  else if (t === T.ST) { const p = block(g, x, y, 12, '#8a6a4a', '#6a4e34', '#523a26'); g.fillStyle = '#7ab0c0'; g.beginPath(); g.arc(cx - 4, cy - 22, 6, 0, 7); g.fill(); g.fillStyle = '#c8e8f0'; g.fillRect(cx - 6, cy - 26, 2, 2); g.strokeStyle = '#a07040'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx + 2, cy - 24); g.lineTo(cx + 12, cy - 30); g.stroke(); }
  else if (t === T.FP) { g.fillStyle = '#3a3028'; g.beginPath(); g.ellipse(cx, cy, 14, 6, 0, 0, 7); g.fill(); g.fillStyle = '#7a7068'; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; g.fillRect(cx + Math.cos(a) * 12 - 2, cy + Math.sin(a) * 5 - 2, 4, 3); } const f = Math.sin(GT * 12 + x); g.fillStyle = '#ff7a1a'; g.beginPath(); g.moveTo(cx - 8, cy); g.quadraticCurveTo(cx, cy - 22 - f * 4, cx + 8, cy); g.fill(); g.fillStyle = '#ffd34a'; g.beginPath(); g.moveTo(cx - 4, cy); g.quadraticCurveTo(cx, cy - 11 + f * 2, cx + 4, cy); g.fill(); }
  else if (t === 30) { // Shore Beacon: stone tower with an iron fire basket
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx, cy, 16, 7, 0, 0, 7); g.fill(); block(g, x, y, 10, '#8a8478', '#6e685e', '#58524a');
    g.fillStyle = '#8e8878'; poly(g, [[cx - 9, cy - 8], [cx + 9, cy - 8], [cx + 6, cy - 54], [cx - 6, cy - 54]]); g.fillStyle = '#6e685e'; poly(g, [[cx + 1, cy - 8], [cx + 9, cy - 8], [cx + 6, cy - 54], [cx + 1, cy - 54]]);
    g.fillStyle = '#2a2420'; g.fillRect(cx - 9, cy - 62, 18, 8); g.fillStyle = '#4a4038'; g.fillRect(cx - 10, cy - 64, 20, 3);
    if (P && P.quest && P.quest.beacon >= 2) { const fl = Math.sin(GT * 12) * 2; g.fillStyle = '#ff7a20'; poly(g, [[cx - 8, cy - 63], [cx + 8, cy - 63], [cx + 2, cy - 82 + fl], [cx - 3, cy - 76]]); g.fillStyle = '#ffe070'; poly(g, [[cx - 4, cy - 63], [cx + 4, cy - 63], [cx, cy - 74 - fl]]); g.fillStyle = 'rgba(255,180,60,.18)'; g.beginPath(); g.arc(cx, cy - 70, 26, 0, 7); g.fill(); }
  }
  else if (t === 31) { // boundary stone
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx, cy, 7, 3, 0, 0, 7); g.fill(); g.fillStyle = '#a8a090'; poly(g, [[cx - 5, cy], [cx + 5, cy], [cx + 4, cy - 16], [cx, cy - 19], [cx - 4, cy - 16]]); g.fillStyle = '#86806e'; poly(g, [[cx + 1, cy], [cx + 5, cy], [cx + 4, cy - 16], [cx + 1, cy - 18]]); g.fillStyle = '#d0503a'; g.fillRect(cx - 2, cy - 12, 3, 5);
  }
  else if (t === T.AK) { // shrine: lantern obelisk (original design)
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx, cy, 16, 7, 0, 0, 7); g.fill(); const p = block(g, x, y, 8, '#9a9488', '#7a746a', '#5e5850');
    g.fillStyle = '#c8c0b0'; poly(g, [[cx - 7, cy - 6], [cx + 7, cy - 6], [cx + 4, cy - 46], [cx - 4, cy - 46]]); g.fillStyle = '#a49c8e'; poly(g, [[cx + 1, cy - 6], [cx + 7, cy - 6], [cx + 4, cy - 46], [cx + 1, cy - 46]]);
    const gl = .6 + .4 * Math.sin(GT * 3); g.fillStyle = `rgba(255,214,120,${gl})`; g.fillRect(cx - 5, cy - 58, 10, 10); g.fillStyle = '#5a5040'; g.fillRect(cx - 7, cy - 60, 14, 2); g.fillRect(cx - 7, cy - 48, 14, 2); }
  else if (t === T.LP) { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx, cy, 9, 4, 0, 0, 7); g.fill(); g.fillStyle = '#2a2522'; g.fillRect(cx - 2, cy - 44, 4, 44); g.fillStyle = '#ffd27a'; g.fillRect(cx - 6, cy - 56, 12, 12); g.strokeStyle = '#2a2522'; g.lineWidth = 2; g.strokeRect(cx - 6, cy - 56, 12, 12); }
  else if (t === T.CH) { const c = CHESTS.get(y * W + x); const p = block(g, x, y, 14, c && c.open ? '#3a2a18' : '#8a5a2a', '#6a4220', '#4e3016'); g.fillStyle = '#c8a040'; g.fillRect(cx - 2, cy - 12, 4, 5); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(p.L[0] + 4, p.L[1] - 9, 22, 2); }
  else if (t === T.CL || t === T.GV || t === T.CP) drawAnnTile(g, t, x, y, h, cx, cy);
  else if (t === T.BL) { g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx, cy, 22, 9, 0, 0, 7); g.fill(); g.fillStyle = '#5a6a5a'; g.beginPath(); g.moveTo(cx - 20, cy - 4); g.quadraticCurveTo(cx - 18, cy - 40, cx, cy - 44); g.quadraticCurveTo(cx + 18, cy - 40, cx + 20, cy - 4); g.closePath(); g.fill(); g.fillStyle = '#7a8a6a'; g.fillRect(cx - 12, cy - 36, 6, 20); g.fillStyle = '#2a3a2a'; g.fillRect(cx - 4, cy - 10, 8, 8); }
  g.restore();
}
const TALL = new Uint8Array(64); for (const t of [30, 31, T.CL, T.GV, T.CP, T.HB, T.CH, T.TR, T.WL, T.RK, T.FG, T.AN, T.AK, T.LP, T.BN, T.ST, T.FP, T.RB, T.FN, T.BL, T.MR]) TALL[t] = 1;

/* ---- Saltmarsh Scout atlas: screen-direction sectors, feet at (48,86) ---- */
const SCOUT = { img: null, cache: new Map(), cell: 96, fx: 48, fy: 86 };
const SECT_ANG = [90, 135, 180, 225, 270, 315, 0, 45];   // atlas order S, SW, W, NW, N, NE, E, SE (screen angles, y down)
function loadScout(src) { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); SCOUT.img = c; }; im.src = src; }
function angDiff(a, b) { let d = ((a - b) % 360 + 540) % 360 - 180; return Math.abs(d); }
/* quantise projected movement into 8 sectors with 5° hysteresis; keep last facing below a speed threshold */
function updateFacing(e, vx, vy) {
  const sp = Math.hypot(vx, vy); if (sp < .35) return;
  const sx = vx - vy, sy = (vx + vy) * .5; let ang = Math.atan2(sy, sx) * 180 / Math.PI; if (ang < 0) ang += 360;
  if (e.sect !== undefined && angDiff(ang, SECT_ANG[e.sect]) <= 22.5 + 5) return;
  e.sect = ((Math.round((ang - 90) / 45) % 8) + 8) % 8;
}
function faceToward(e, tx, ty) { const vx = tx - e.x, vy = ty - e.y; const s = e.sect; e.sect = undefined; updateFacing(e, vx, vy); if (e.sect === undefined) e.sect = s || 0; }
function hexHsl(h) { const n = parseInt(h.slice(1), 16); let r = (n >> 16) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let H = 0, S = 0, L = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; S = L > .5 ? d / (2 - mx - mn) : d / (mx + mn); H = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; H *= 60; } return [H, S, L]; }
function hsl2rgb(h, s, l) { h /= 360; const f = (p, q, t) => { t < 0 && (t += 1); t > 1 && (t -= 1); return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; if (!s) return [l, l, l]; const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; return [f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)]; }
/* ---- appearance on the traveller sprite (Character Creation v2): skin tone and cloak colour are recoloured from the drawn
   sheets. Each sheet gets a class mask once (1 skin, 2 cloak); each look a cached copy. Hair, beards, clothing colours and female
   sheets are not drawn yet, so the world sprite shows only these two (docs/design/character-creation-v2-status.md). ---- */
const TINT = { prep: new Map(), out: new Map() };
function rgbHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let H = 0, S = 0; const L = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; S = L > .5 ? d / (2 - mx - mn) : d / (mx + mn); H = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; } return [H, S, L]; }
function tintPrep(src) {
  let p = TINT.prep.get(src); if (p) return p; const w = src.width, h = src.height, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, w, h), a = d.data, n = w * h, cls = new Uint8Array(n), hsl = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { if (!a[i * 4 + 3]) continue; const [H, S, L] = rgbHsl(a[i * 4], a[i * 4 + 1], a[i * 4 + 2]); hsl[i * 3] = H; hsl[i * 3 + 1] = S; hsl[i * 3 + 2] = L;
    if (H > 150 && H < 220 && S > .1) cls[i] = 2; else if (H >= 10 && H <= 40 && S >= .25 && S <= .85 && L >= .52) cls[i] = 1; }
  p = { w, h, d, cls, hsl }; TINT.prep.set(src, p); return p;
}
function tinted(src, look, tag) {
  if (!src || !look || typeof look !== 'object') return src; const ck = SF.CREATION.cloakHex(look), sk = SF.CREATION.skinHex(look); if (!ck && !sk) return src;
  const key = tag + '|' + (ck || '') + '|' + (sk || ''); let c = TINT.out.get(key); if (c) return c;
  const p = tintPrep(src); c = document.createElement('canvas'); c.width = p.w; c.height = p.h; const g = c.getContext('2d'); const d = g.createImageData(p.w, p.h), a = d.data; a.set(p.d.data);
  const C = ck && hexHsl(ck), K = sk && hexHsl(sk);
  for (let i = 0, n = p.w * p.h; i < n; i++) { const k = p.cls[i]; if (!k) continue; const S = p.hsl[i * 3 + 1], L = p.hsl[i * 3 + 2]; let rgb = null;
    if (k === 2 && C) rgb = hsl2rgb(C[0], Math.min(1, S * .5 + C[1] * .7), cl(L * (.5 + C[2]), 0, 1));
    else if (k === 1 && K) rgb = hsl2rgb(K[0], cl(S * K[1] / .5, 0, 1), cl(L * K[2] / .66, 0, 1));
    if (rgb) { a[i * 4] = rgb[0] * 255; a[i * 4 + 1] = rgb[1] * 255; a[i * 4 + 2] = rgb[2] * 255; } }
  g.putImageData(d, 0, 0); if (TINT.out.size > 120) TINT.out.clear(); TINT.out.set(key, c); return c;
}
function scoutSheet(col) {
  if (!SCOUT.img) return null; if (col && typeof col === 'object') return tinted(SCOUT.img, col, 'atlas'); const key = col || 'orig'; let c = SCOUT.cache.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = SCOUT.img.width; c.height = SCOUT.img.height; const g = c.getContext('2d'); g.drawImage(SCOUT.img, 0, 0);
  if (col === 'ghost') { const d = g.getImageData(0, 0, c.width, c.height), a = d.data; for (let i = 0; i < a.length; i += 4) { if (!a[i + 3]) continue; const l = (a[i] + a[i + 1] + a[i + 2]) / 3; a[i] = l * .7 + 60; a[i + 1] = l * .8 + 80; a[i + 2] = l + 110; a[i + 3] = 150; } g.putImageData(d, 0, 0); }
  else if (col) { const [th, ts, tl] = hexHsl(col); const d = g.getImageData(0, 0, c.width, c.height), a = d.data; for (let i = 0; i < a.length; i += 4) { if (!a[i + 3]) continue; const [h, s, l] = hexHsl('#' + ((1 << 24) | (a[i] << 16) | (a[i + 1] << 8) | a[i + 2]).toString(16).slice(1)); if (h > 150 && h < 220 && s > .1) { const rgb = hsl2rgb(th, Math.min(1, s * .5 + ts * .7), cl(l * (.5 + tl * 1.0), 0, 1)); a[i] = rgb[0] * 255; a[i + 1] = rgb[1] * 255; a[i + 2] = rgb[2] * 255; } } g.putImageData(d, 0, 0); }
  SCOUT.cache.set(key, c); return c;
}
/* ---- Saltmarsh Scout animation sheets (player): rows S,SW,W,NW,N,NE,E,SE; 128px cells; feet at (64,106) ---- */
const ANIM = { img: {}, ghost: {} };
for (const k in ANIM_CLIPS) { const im = new Image(); im.onload = () => { ANIM.img[k] = im; }; im.src = ANIM_CLIPS[k].src; }
function animSheet(k, ghost) { const im = ANIM.img[k]; if (!im || !ghost) return im; let c = ANIM.ghost[k]; if (c) return c; c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, c.width, c.height), a = d.data; for (let i = 0; i < a.length; i += 4) { if (!a[i + 3]) continue; const l = (a[i] + a[i + 1] + a[i + 2]) / 3; a[i] = l * .7 + 60; a[i + 1] = l * .8 + 80; a[i + 2] = l + 110; a[i + 3] = 150; } g.putImageData(d, 0, 0); ANIM.ghost[k] = c; return c; }
function weaponFam() { return wDef().fam; }
function playerClip() {
  const fam = weaponFam(), held = P.drawn || P.drawing;
  if (P.once) { const c = ANIM_CLIPS[P.once.clip]; if (c) { const mk = c.mk || 0; let f = GT < P.once.tc ? Math.floor(mk * (GT - P.once.t0) / Math.max(.01, P.once.tc - P.once.t0)) : mk + Math.floor((GT - P.once.tc) * 15); if (f < c.n) return [P.once.clip, Math.max(0, f)]; } P.once = null; }
  if (P.prep && GT >= P.prep.t0) return ['CastPrepare', Math.min(5, Math.floor(6 * (GT - P.prep.t0) / Math.max(.05, P.prep.t1 - P.prep.t0)))];
  const mv = P.speed > .3;
  if (P.held && !held) return ['CastHold', Math.floor(GT * 8) % 4];
  if (mv) { const k = held && fam !== 'Unarmed' ? fam + '_Walk' : 'Walk'; return [k, Math.floor(GT * 12 * Math.min(1.4, Math.max(.7, P.speed / 5))) % 8]; }
  if (held) return [fam + '_Ready', 0];
  return [P.armed ? 'Unarmed_Ready' : 'Idle', 0];
}
function drawPlayerAnim(g, e, x, y, col) {
  if (P.ghost) { const im = animSheet('Walk', true); if (!im) return false; const f = e.speed > .3 ? Math.floor(GT * 12) % 8 : 0; g.drawImage(im, f * 128, (e.sect || 0) * 128, 128, 128, Math.round(x - 64), Math.round(y - 106), 128, 128); return true; }
  const [k, f] = playerClip(); const im = tinted(animSheet(k), P.look, k); if (!im) return false;
  g.imageSmoothingEnabled = false; g.drawImage(im, f * 128, (e.sect || 0) * 128, 128, 128, Math.round(x - 64), Math.round(y - 106), 128, 128); return true;
}
function drawScout(g, e, x, y, col) {
  if (e === P && drawPlayerAnim(g, e, x, y, col)) return;
  const sh = scoutSheet(col); if (!sh) return; const s = e.sect || 0, cx = (s % 4) * 96, cy = Math.floor(s / 4) * 96;
  const mv = e.speed > .3; const bob = mv ? (Math.floor(GT * 8) % 2) : 0;   // presentation-only step bob (idle atlas only)
  let ox = 0, oy = -bob; if (e.lunge) { const k = Math.sin(e.lunge * Math.PI) * 4; const a = SECT_ANG[s] * Math.PI / 180; ox += Math.cos(a) * k; oy += Math.sin(a) * k * .5; }
  g.imageSmoothingEnabled = false; g.drawImage(sh, cx, cy, 96, 96, Math.round(x - SCOUT.fx + ox), Math.round(y - SCOUT.fy + oy), 96, 96);
}
/* ---- creatures: vector art baked to hard pixels with an outline ---- */
const SPR = new Map();
function outlined(src, col) { const o = document.createElement('canvas'); o.width = src.width + 2; o.height = src.height + 2; const g = o.getContext('2d'); const s = document.createElement('canvas'); s.width = src.width; s.height = src.height; const sg = s.getContext('2d'); sg.drawImage(src, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = col || 'rgba(20,12,16,.95)'; sg.fillRect(0, 0, s.width, s.height); for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) g.drawImage(s, dx, dy); g.drawImage(src, 1, 1); return o; }
function pixelize(c) { const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), a = d.data; for (let i = 0; i < a.length; i += 4) { if (a[i + 3] < 110) { a[i + 3] = 0; continue; } a[i + 3] = 255; for (let k = 0; k < 3; k++) a[i + k] = Math.min(255, Math.round(a[i + k] / 16) * 16); } g.putImageData(d, 0, 0); return c; }
function beastArt(g, type, fr, atk) {
  const ph = [0, 1, 0, -1][fr], c = MON[type].col;
  const leg = (x, y, l, o) => { g.strokeStyle = shade(c, -35); g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + ph * 2 * o, y + l); g.stroke(); };
  if (type === 'rat') { g.strokeStyle = '#c89a90'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-9, -6); g.quadraticCurveTo(-18, -2, -22, -8 + ph * 2); g.stroke(); leg(-5, -6, 6, 1); leg(5, -6, 6, -1); g.fillStyle = c; g.beginPath(); g.ellipse(0, -9, 11, 6, 0, 0, 7); g.fill(); g.fillStyle = shade(c, 25); g.beginPath(); g.ellipse(-2, -12, 7, 2.5, 0, 0, 7); g.fill(); g.fillStyle = c; g.beginPath(); g.ellipse(12 + atk * 3, -10, 6, 4.5, 0, 0, 7); g.fill(); g.fillStyle = '#e0a0a0'; g.beginPath(); g.arc(10 + atk * 3, -15, 2.5, 0, 7); g.fill(); g.fillStyle = '#111'; g.fillRect(14 + atk * 3, -12, 2, 2); g.fillStyle = '#f0e0d0'; g.fillRect(17 + atk * 3, -8, 2, 2); }
  if (type === 'boar') { leg(-11, -10, 10, 1); leg(-5, -10, 10, -1); leg(6, -10, 10, -1); leg(12, -10, 10, 1); g.fillStyle = c; g.beginPath(); g.ellipse(0, -16, 17, 10, 0, 0, 7); g.fill(); g.fillStyle = shade(c, -25); for (let i = -12; i < 10; i += 3) g.fillRect(i, -27 + Math.abs(i) * .1, 2, 5); g.fillStyle = c; g.beginPath(); g.ellipse(18 + atk * 4, -14 + atk * 2, 9, 7, 0, 0, 7); g.fill(); g.fillStyle = shade(c, -40); g.beginPath(); g.ellipse(25 + atk * 4, -11 + atk * 2, 3.5, 3, 0, 0, 7); g.fill(); g.fillStyle = '#f0ead8'; g.fillRect(22 + atk * 4, -9 + atk * 2, 4, 2); g.fillRect(23 + atk * 4, -11 + atk * 2, 2, 3); g.fillStyle = '#111'; g.fillRect(19 + atk * 4, -17 + atk * 2, 2, 2); g.fillStyle = shade(c, -20); g.beginPath(); g.moveTo(14 + atk * 4, -20); g.lineTo(16 + atk * 4, -26); g.lineTo(19 + atk * 4, -20); g.fill(); }
  if (type === 'wreckcrab') { for (const s2 of [-1, 1]) for (let k = 0; k < 3; k++) { g.strokeStyle = shade(c, -40); g.lineWidth = 2; g.beginPath(); g.moveTo(s2 * 6, -7 + k * 2); g.lineTo(s2 * (13 + ph), -3 + k * 2); g.lineTo(s2 * 15, 1 + k); g.stroke(); }
    g.fillStyle = c; g.beginPath(); g.ellipse(0, -9, 11, 7, 0, 0, 7); g.fill(); g.fillStyle = shade(c, 25); g.beginPath(); g.ellipse(-2, -11, 7, 3, 0, 0, 7); g.fill();
    for (const s2 of [-1, 1]) { g.fillStyle = shade(c, -10); g.beginPath(); g.ellipse(s2 * 12, -16 - atk * 3, 5, 4, s2 * .5, 0, 7); g.fill(); g.fillStyle = '#111'; g.fillRect(s2 * 3 - 1, -17, 2, 3); } }
  if (type === 'snapper') { leg(-10, -6, 6, 1); leg(10, -6, 6, -1); g.fillStyle = shade(c, -25); g.beginPath(); g.ellipse(0, -9, 17, 9, 0, 0, 7); g.fill(); g.fillStyle = c; g.beginPath(); g.ellipse(0, -12, 15, 8, 0, 0, 7); g.fill(); g.strokeStyle = shade(c, -45); g.lineWidth = 1.5; for (const [a, b] of [[-8, -14], [0, -17], [8, -14]]) { g.beginPath(); g.ellipse(a, b, 4, 3, 0, 0, 7); g.stroke(); } g.fillStyle = '#7a8a50'; g.beginPath(); g.ellipse(18 + atk * 5, -8, 6, 4.5, 0, 0, 7); g.fill(); g.fillStyle = '#111'; g.fillRect(20 + atk * 5, -10, 2, 2); g.fillStyle = '#e8e0c0'; if (atk) g.fillRect(23 + atk * 5, -7, 3, 2); }
  if (type === 'spider') { g.strokeStyle = shade(c, 15); g.lineWidth = 2; for (let i = 0; i < 4; i++) { const a = -.9 + i * .6, o = i % 2 ? ph : -ph; g.beginPath(); g.moveTo(0, -9); g.lineTo(Math.cos(a) * 11, -15 + i * 3); g.lineTo(Math.cos(a) * 17, -1 + o * 2); g.moveTo(0, -9); g.lineTo(-Math.cos(a) * 11, -15 + i * 3); g.lineTo(-Math.cos(a) * 17, -1 - o * 2); g.stroke(); } g.fillStyle = c; g.beginPath(); g.ellipse(-5, -10, 9, 7, 0, 0, 7); g.fill(); g.fillStyle = '#5a8a3a'; g.fillRect(-9, -13, 7, 2); g.fillRect(-7, -9, 4, 2); g.fillStyle = c; g.beginPath(); g.arc(6 + atk * 3, -10, 5, 0, 7); g.fill(); g.fillStyle = '#9cff6a'; g.fillRect(8 + atk * 3, -12, 2, 2); g.fillRect(10 + atk * 3, -11, 1.5, 1.5); }
  if (type === 'wisp') { const f = Math.sin(fr * 1.6) * 2; g.fillStyle = 'rgba(255,140,40,.35)'; g.beginPath(); g.arc(0, -22 + f, 13, 0, 7); g.fill(); g.fillStyle = '#ff8a30'; g.beginPath(); g.moveTo(-7, -16 + f); g.quadraticCurveTo(0, -40 + f - atk * 4, 7, -16 + f); g.quadraticCurveTo(0, -8 + f, -7, -16 + f); g.fill(); g.fillStyle = '#ffe08a'; g.beginPath(); g.arc(0, -19 + f, 4, 0, 7); g.fill(); g.fillStyle = '#5a2010'; g.fillRect(-2, -21 + f, 1.5, 2); g.fillRect(1, -21 + f, 1.5, 2); }
  if (type === 'sentinel') { g.fillStyle = shade(c, -30); g.fillRect(-9, -12, 7, 12 + ph); g.fillRect(2, -12, 7, 12 - ph); g.fillStyle = c; g.fillRect(-13, -40, 26, 30); g.fillStyle = shade(c, 30); g.fillRect(-13, -40, 26, 4); g.fillStyle = shade(c, -20); g.fillRect(-19, -38 + atk * 6, 7, 22); g.fillRect(12, -38 - atk * 10, 7, 22); g.fillStyle = '#b8903a'; g.beginPath(); g.moveTo(-8, -40); g.quadraticCurveTo(0, -58, 8, -40); g.closePath(); g.fill(); g.fillStyle = '#ffd060'; g.fillRect(-4, -33, 8, 3); }
  if (type === 'bellkeeper') { g.fillStyle = shade(c, -35); g.fillRect(-14, -14, 10, 14 + ph); g.fillRect(4, -14, 10, 14 - ph); g.fillStyle = c; g.beginPath(); g.moveTo(-26, -14); g.quadraticCurveTo(-24, -60, 0, -66); g.quadraticCurveTo(24, -60, 26, -14); g.closePath(); g.fill(); g.fillStyle = shade(c, 35); g.beginPath(); g.moveTo(-18, -20); g.quadraticCurveTo(-16, -54, -4, -60); g.lineTo(-8, -20); g.fill(); g.fillStyle = shade(c, -45); g.fillRect(-26, -18, 52, 5); g.fillStyle = '#3a2a10'; g.beginPath(); g.arc(0, -10 + atk * 4, 6, 0, 7); g.fill(); g.fillStyle = '#ffcc40'; g.fillRect(-10, -44, 6, 4); g.fillRect(4, -44, 6, 4); g.fillStyle = shade(c, -20); g.fillRect(-36, -50 + atk * 12, 10, 30); g.fillRect(26, -50 - atk * 14, 10, 30); }
  if (type === 'hound') { g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.moveTo(-13, -16); g.quadraticCurveTo(-22, -20, -24, -12 + ph); g.stroke(); leg(-9, -11, 11, 1); leg(-4, -11, 11, -1); leg(6, -11, 11, -1); leg(11, -11, 11, 1); g.fillStyle = c; g.beginPath(); g.ellipse(0, -16, 15, 7, 0, 0, 7); g.fill(); g.fillStyle = shade(c, 30); g.beginPath(); g.ellipse(-2, -20, 10, 3, 0, 0, 7); g.fill(); g.fillStyle = shade(c, -30); for (let i = -10; i < 8; i += 4) g.fillRect(i, -15, 2, 4); g.fillStyle = c; g.beginPath(); g.ellipse(17 + atk * 4, -21 + atk * 3, 7, 5.5, -.2, 0, 7); g.fill(); g.beginPath(); g.ellipse(23 + atk * 4, -19 + atk * 3, 5, 3, 0, 0, 7); g.fill(); g.fillStyle = shade(c, -30); g.beginPath(); g.moveTo(13 + atk * 4, -25); g.lineTo(15 + atk * 4, -32); g.lineTo(18 + atk * 4, -25); g.fill(); g.fillStyle = '#ffd24a'; g.fillRect(19 + atk * 4, -23 + atk * 3, 2, 2); if (atk) { g.fillStyle = '#fff'; g.fillRect(24 + atk * 4, -17 + atk * 3, 3, 2); } }
}
/* Living World phase 3 wildlife (src/ecology.js): drawn in code in the kit's palette until sheets exist (asset backlog) */
function wildArt(g, type, fr, atk) {
  const ph = [0, 1, 0, -1][fr], c = MON[type].col;
  const leg = (x, y, l, o, w) => { g.strokeStyle = shade(c, -40); g.lineWidth = w || 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + ph * 2.5 * o, y + l); g.stroke(); };
  if (type === 'deer') { leg(-10, -18, 18, 1); leg(-6, -18, 18, -1); leg(7, -18, 18, -1); leg(11, -18, 18, 1);
    g.fillStyle = c; g.beginPath(); g.ellipse(0, -22, 15, 7.5, 0, 0, 7); g.fill(); g.fillStyle = '#efe2c8'; g.beginPath(); g.ellipse(-14, -23, 3, 3.5, 0, 0, 7); g.fill();
    g.fillStyle = shade(c, 22); g.beginPath(); g.ellipse(1, -26, 10, 3, 0, 0, 7); g.fill(); g.fillStyle = shade(c, -15); for (const [x, y] of [[-6, -21], [-1, -24], [4, -21]]) g.fillRect(x, y, 2, 2);
    g.fillStyle = c; g.beginPath(); g.moveTo(10, -26); g.lineTo(16 + atk * 2, -38); g.lineTo(21 + atk * 2, -36); g.lineTo(15, -22); g.fill(); g.beginPath(); g.ellipse(20 + atk * 3, -38, 6, 3.6, -.3, 0, 7); g.fill();
    g.fillStyle = '#111'; g.fillRect(21 + atk * 3, -40, 2, 2); g.fillRect(25 + atk * 3, -37, 2, 1.5);
    g.strokeStyle = '#d8c8a0'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(18, -41); g.lineTo(15, -50); g.moveTo(16, -46); g.lineTo(11, -49); g.moveTo(21, -41); g.lineTo(24, -51); g.moveTo(23, -47); g.lineTo(28, -49); g.stroke(); }
  if (type === 'hare') { const hop = Math.abs(ph) * 3; g.fillStyle = shade(c, -20); g.beginPath(); g.ellipse(-6, -4 - hop * .3, 5, 3, 0, 0, 7); g.fill();
    g.fillStyle = c; g.beginPath(); g.ellipse(0, -8 - hop, 9, 6, 0, 0, 7); g.fill(); g.fillStyle = '#f0e8dc'; g.beginPath(); g.arc(-9, -9 - hop, 2.6, 0, 7); g.fill();
    g.fillStyle = c; g.beginPath(); g.ellipse(8, -12 - hop, 4.5, 4, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(6, -21 - hop, 1.8, 6, -.2, 0, 7); g.fill(); g.beginPath(); g.ellipse(9, -21 - hop, 1.8, 6, .15, 0, 7); g.fill();
    g.fillStyle = '#d8a8a0'; g.fillRect(6, -24 - hop, 1, 4); g.fillStyle = '#111'; g.fillRect(10, -14 - hop, 1.6, 1.6); }
  if (type === 'bear') { leg(-12, -14, 13, 1, 5); leg(-5, -14, 13, -1, 5); leg(7, -14, 13, -1, 5); leg(13, -14, 13, 1, 5);
    g.fillStyle = c; g.beginPath(); g.ellipse(0, -22, 20, 13, 0, 0, 7); g.fill(); g.fillStyle = shade(c, 18); g.beginPath(); g.ellipse(-3, -29, 13, 4, 0, 0, 7); g.fill();
    g.fillStyle = shade(c, -18); g.beginPath(); g.ellipse(-4, -33, 9, 5, 0, 0, 7); g.fill();
    g.fillStyle = c; g.beginPath(); g.ellipse(20 + atk * 5, -24 + atk * 2, 9.5, 8, 0, 0, 7); g.fill(); g.beginPath(); g.arc(15 + atk * 5, -32 + atk * 2, 3, 0, 7); g.arc(23 + atk * 5, -32 + atk * 2, 3, 0, 7); g.fill();
    g.fillStyle = '#c8a880'; g.beginPath(); g.ellipse(27 + atk * 5, -21 + atk * 2, 4.5, 3.5, 0, 0, 7); g.fill(); g.fillStyle = '#111'; g.fillRect(29 + atk * 5, -23 + atk * 2, 2.5, 2); g.fillRect(21 + atk * 5, -27 + atk * 2, 2, 2);
    if (atk) { g.fillStyle = '#f0ead8'; g.fillRect(26 + atk * 5, -18 + atk * 2, 4, 2); } }
}
function beastSprite(e) {
  const mv = e.speed > .3, fr = mv ? Math.floor(GT * 9) % 4 : 0, atk = e.state === 'strike' ? 1 : 0, face = (SECT_ANG[e.sect || 0] > 90 && SECT_ANG[e.sect || 0] < 270) ? -1 : 1;
  const k = e.type + fr + atk + face; let s = SPR.get(k); if (s) return s;
  const dm = { bellkeeper: [180, 150, 90, 140], sentinel: [100, 100, 50, 92], bear: [100, 84, 46, 72], deer: [80, 84, 40, 76] }[e.type] || [72, 60, 36, 54];
  const c = document.createElement('canvas'); c.width = dm[0]; c.height = dm[1]; const g = c.getContext('2d'); g.translate(dm[2], dm[3]); g.scale(face * 1.25, 1.25); if (e.type === 'deer' || e.type === 'hare' || e.type === 'bear') wildArt(g, e.type, fr, atk); else beastArt(g, e.type, fr, atk);
  s = outlined(pixelize(c)); s.ox = dm[2] + 1; s.oy = dm[3] + 1; SPR.set(k, s); return s;
}
const ADV_COL = { navy: '#2a3a6a', wine: '#6a2a32', forest: '#2f5a32', plum: '#5a2a6a', oatmeal: '#8a7a5a', charcoal: '#2e2e30', ochre: '#7a5a22' };   // charcoal, ochre: the outlaws (v0.39)
const NPC_COL = { traveller: '#3a6a5a', assay: '#4a6a7a', qsmith: '#7a3a22', banker: '#2a3a8a', smith: '#6a4a2a', trainer: '#8a2a2a', workshop: '#6a6a2a', apothecary: '#5a2a6a', provisioner: '#8a6a2a', guard: '#5a5a62', healer: '#d8d0c0', outlaw: '#3a2a22' };
/* ---- 8-direction creature sheets: rows S,SW,W,NW,N,NE,E,SE; cols 0-3 walk, 4 wind-up, 5 strike, 6 hit, 7 dead ---- */
const MSI = {}; for (const k in MON_SHEETS) { const im = new Image(); im.onload = () => { MSI[k] = im; }; im.src = MON_SHEETS[k].src; }
function sheetFrame(e) {
  if (e.state === 'tele') return 4; if (e.state === 'strike' || (e.state === 'rec' && GT - (e.st || 0) < .25)) return 5;
  if (e.hitT && GT - e.hitT < .16) return 6; if (e.speed > .3) return Math.floor(GT * 9 + e.id) % 4; return 0;
}
function drawSheet(g, type, row, col, x, y) { const im = MSI[type], m = MON_SHEETS[type]; if (!im) return false; g.imageSmoothingEnabled = false; g.drawImage(im, col * m.cw, (row || 0) * m.ch, m.cw, m.ch, Math.round(x - m.fx), Math.round(y - m.fy + 2), m.cw, m.ch); return true; }
/* ---- Bestiary sheets, v1.0.0 + v1.1.0 merged (src/bestiary-art.js): 160 px cells, rows S..SE, cols stepA, neutral, stepB, wind-up, impact; pivot from the manifest.
   Poses follow the simulation: 'tele' shows wind-up, the strike event (impactT) starts the impact → recover timing, movement plays the walk cycle.
   Facing is latched for the whole attack. Drawn unprocessed (no outline, tint or alpha threshold) so baked rims and glints survive. ---- */
const BSI = {}; for (const k in BESTIARY.src) { const im = new Image(); im.onload = () => { BSI[k] = im; }; im.onerror = () => console.warn('bestiary sheet failed to load:', k); im.src = BESTIARY.src[k]; }
const BA = BESTIARY.animations, BWALK = BA.walk.durationMs.reduce((a, b) => a + b, 0);
function bestiaryPose(e) {
  const atk = BA.attack, ci = atk.contactIndex, row = e.sect || 0;
  if (e.state === 'tele') return { row: e.atkSt === e.st ? e.atkRow : row, col: atk.frames[ci - 1], ph: 'windup' };
  if (e.impactT != null) { let ms = (GT - e.impactT) * 1000; for (let i = ci; i < atk.frames.length; i++) { if (ms < atk.durationMs[i]) return { row: e.atkRow ?? row, col: atk.frames[i], ph: i === ci ? 'impact' : 'recover' }; ms -= atk.durationMs[i]; } }
  if (e.speed > .3) { let ms = (GT * 1000 + (e.id || 0) * 37) % BWALK; for (let i = 0; i < BA.walk.frames.length; i++) { if (ms < BA.walk.durationMs[i]) return { row, col: BA.walk.frames[i], ph: 'walk' }; ms -= BA.walk.durationMs[i]; } }
  return { row, col: BA.idle.frames[0], ph: 'idle' };
}
function drawBestiary(g, e, x, y) {
  const im = BSI[e.type]; if (!im) return false; const F = BESTIARY.frame, s = MON[e.type].artScale || 1, p = bestiaryPose(e); e.pose = p;
  g.imageSmoothingEnabled = false; g.drawImage(im, p.col * F.width, p.row * F.height, F.width, F.height, Math.round(x - F.pivot[0] * s), Math.round(y - F.pivot[1] * s), Math.round(F.width * s), Math.round(F.height * s));
  if (e.rooted > GT) { g.fillStyle = 'rgba(120,90,50,.6)'; g.fillRect(x - 12, y - 4, 24, 4); }
  return true;
}
function drawEnt(e) {
  const x = SX(e.x, e.y), y = SY(e.x, e.y), g = ctx; g.save();
  if (e.hidden && e === P) g.globalAlpha = .45;
  const big = (e.kind === 'mon' || e.kind === 'pet') && e.type ? MON[e.type].size : 1;
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x + 1, y, 13 * big, 6 * big, 0, 0, 7); g.fill();
  if (e.kind === 'mon' && e.state === 'tele') { const d = MON[e.type], tt = e.mode === 'r2' ? d.ranged2.tele : d.tele, p = cl((GT - e.st) / tt, 0, 1); g.strokeStyle = `rgba(255,60,40,${.5 + p * .5})`; g.lineWidth = 2;
    if ((e.mode === 'shot' || e.mode === 'r2') && e.aim) { const ax = SX(e.aim.x, e.aim.y), ay = SY(e.aim.x, e.aim.y); g.beginPath(); g.ellipse(ax, ay, 26, 13, 0, 0, 7); g.stroke(); g.fillStyle = `rgba(255,60,40,${p * .35})`; g.beginPath(); g.ellipse(ax, ay, 26 * p, 13 * p, 0, 0, 7); g.fill(); }
    else { const rr = (e.mode === 'aoe' ? d.aoe : d.reach) * HW * 1.2; g.beginPath(); g.ellipse(x, y, rr, rr / 2, 0, 0, 7); g.stroke(); g.fillStyle = `rgba(255,60,40,${p * .25})`; g.beginPath(); g.ellipse(x, y, rr * p, rr * p / 2, 0, 0, 7); g.fill(); } }
  if (e.ward > 0) { g.strokeStyle = 'rgba(255,220,120,.8)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y - 20 * big, 22 * big, 30 * big, 0, 0, 7); g.stroke(); }
  if (e.kind === 'pet') { g.strokeStyle = '#5aa8ff'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y, 14 * big, 7 * big, 0, 0, 7); g.stroke(); }
  if (P.sel === e && !P.ghost) { g.strokeStyle = relColor(e); g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, 20 * big, 10 * big, 0, 0, 7); g.stroke(); }
  if (e.kind === 'player' && drawForm(g, e, x, y)) { }
  else if (drawPaintedActor(g, e, x, y)) { }                                         // Painted Human Candidates v0.1, developer flag only (src/painted-render.js)
  else if (drawGearActor(g, e, x, y)) { }                                            // layered equipment renderer (src/gear-render.js), when on
  else if (e.kind === 'remote') drawRemote(g, e, x, y);                              // another player, online (src/online.js)
  else if (e.kind === 'player') drawScout(g, e, x, y, P.ghost ? 'ghost' : P.look);
  else if (e.kind === 'ally') { if (e.ghost) g.globalAlpha = .75; drawScout(g, e, x, y, e.ghost ? 'ghost' : '#2f7a46'); }
  else if (e.kind === 'npc' && e.downed) { g.save(); g.globalAlpha = .85; g.translate(x, y - 4); g.rotate(-1.4); g.translate(-x, -y); drawScout(g, e, x, y, NPC_COL[e.role] || (e.life && LIFE_COL[e.life.prof]) || '#5a5a5a'); g.restore(); }   // knocked down (phase 5)
  else if (e.kind === 'npc' && e.adv) { if (e.ghost) g.globalAlpha = .75; drawScout(g, e, x, y, e.ghost ? 'ghost' : ADV_COL[e.adv.D.cloth] || '#5a5a5a'); }   // NPC adventurers (v0.36)
  else if (e.kind === 'npc') drawScout(g, e, x, y, NPC_COL[e.role] || (e.life && LIFE_COL[e.life.prof]) || '#5a5a5a');
  // creature art, best first: a decoded bestiary sheet, a legacy MON_SHEETS sheet, the scout tint, then procedural art.
  // A sheet that is still decoding (or failed to load) falls through, so a creature is never drawn invisible.
  else if ((e.kind === 'mon' || (e.kind === 'pet' && e.type)) && BSI[e.type] && drawBestiary(g, e, x, y)) { }
  else if ((e.kind === 'mon' || (e.kind === 'pet' && e.type)) && MSI[e.type]) { drawSheet(g, e.type, e.sect, sheetFrame(e), x, y); }
  else if (e.kind === 'mon' && MON[e.type].scout) drawScout(g, e, x, y, MON[e.type].scout);
  else if (e.kind === 'mon' || (e.kind === 'pet' && e.type)) { const s = beastSprite(e); g.imageSmoothingEnabled = false; g.drawImage(s, Math.round(x - s.ox), Math.round(y - s.oy)); if (e.rooted > GT) { g.fillStyle = 'rgba(120,90,50,.6)'; g.fillRect(x - 12, y - 4, 24, 4); } }
  else if (e.summon) drawSummon(g, e, x, y);
  else if (e.kind === 'pet') { g.globalAlpha = .85; g.fillStyle = '#7ab060'; g.beginPath(); g.ellipse(x, y - 14, 8, 12, 0, 0, 7); g.fill(); g.fillStyle = '#c8e890'; g.fillRect(x - 4, y - 20, 2, 2); g.fillRect(x + 2, y - 20, 2, 2); g.strokeStyle = '#5a8a40'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 6, y - 24); g.lineTo(x - 10, y - 36); g.moveTo(x + 5, y - 24); g.lineTo(x + 9, y - 38); g.stroke(); }
  g.restore();
}
function drawCorpse(e) {
  if (e.gear && drawGearCorpse(e)) return;                                           // the owner's last appearance (src/gear-render.js)
  const g = ctx, x = SX(e.x, e.y), y = SY(e.x, e.y);
  if (e.mon && MSI[e.mon]) { drawSheet(g, e.mon, e.sect, GT - (e.t0 || 0) < .3 ? 6 : 7, x, y); if (e.cont && e.cont.items.length) { const tw = (Math.sin(GT * 5 + e.x) + 1) / 2; g.fillStyle = `rgba(255,224,120,${.4 + .6 * tw})`; g.fillRect(Math.round(x + 9), Math.round(y - 12), 2, 2); } return; }
  if (e.mon) { const s = Math.max(.8, Math.min(2, MON[e.mon].size || 1)), px = (a, b, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x + a * s), Math.round(y + b * s), Math.ceil(w * s), Math.ceil(h * s)); };
    g.fillStyle = 'rgba(110,10,10,.4)'; g.beginPath(); g.ellipse(x, y, 13 * s, 5 * s, 0, 0, 7); g.fill();
    const B = '#e8e0c8', D = '#9a9078', K = '#2a2018';
    for (let k = -5; k <= 5; k++) { px(k - 1, -1 - Math.round(k * .45), 2, 2, B); px(k - 1, -2 + Math.round(k * .45), 2, 2, B); }
    px(-7, -4, 2, 2, B); px(4, -5, 2, 2, B); px(-7, 1, 2, 2, B); px(4, 2, 2, 2, B);
    px(-3, -10, 7, 5, B); px(-2, -11, 5, 1, B); px(-2, -5, 5, 2, D); px(-2, -8, 2, 2, K); px(1, -8, 2, 2, K); px(0, -5, 1, 1, K);
    if (e.cont && e.cont.items.length) { const tw = (Math.sin(GT * 5 + e.x) + 1) / 2; g.fillStyle = `rgba(255,224,120,${.4 + .6 * tw})`; g.fillRect(Math.round(x + 7 * s), Math.round(y - 12 * s), 2, 2); g.fillRect(Math.round(x + 7 * s) - 2, Math.round(y - 12 * s), 6, 1 > 0 ? 1 : 0); }
    if (e.skinned && MON[e.mon].skin) px(-1, 1, 3, 2, '#a04030'); return; }
  g.fillStyle = 'rgba(120,0,0,.35)'; g.beginPath(); g.ellipse(x + 3, y + 2, 15, 6, 0, 0, 7); g.fill();
  g.save(); g.translate(x, y - 3); g.scale(1, .5); g.rotate(-1.4); g.fillStyle = '#2a4a48'; g.fillRect(-7, -12, 14, 20); g.fillStyle = '#d8a880'; g.beginPath(); g.arc(0, -16, 6, 0, 7); g.fill(); g.fillStyle = '#6a4a2a'; g.fillRect(-6, 8, 5, 10); g.fillRect(1, 8, 5, 10); g.restore();
  if (e.mine) { g.fillStyle = '#f0c94a'; g.fillRect(x - 2, y - 30 + Math.sin(GT * 4) * 3, 4, 10); g.beginPath(); g.moveTo(x - 6, y - 20 + Math.sin(GT * 4) * 3); g.lineTo(x + 6, y - 20 + Math.sin(GT * 4) * 3); g.lineTo(x, y - 13 + Math.sin(GT * 4) * 3); g.fill(); }
}
function drawEffects() {
  const g = ctx; drawMagicFx(g);
  for (const tr of TRAPS) { if (tr.hidden) continue; const X = SX(tr.x, tr.y), Y = SY(tr.x, tr.y); g.strokeStyle = tr.owner === 'P' ? '#8ac0ff' : '#c8c8c8'; g.lineWidth = 2; g.beginPath(); g.ellipse(X, Y, 9, 4.5, 0, 0, 7); g.stroke(); g.fillStyle = '#9a9a9a'; for (let i = -2; i <= 2; i++) g.fillRect(X + i * 3 - 1, Y - 4, 2, 4); }
  for (const f of EFX) {
    const X = SX(f.x, f.y), Y = SY(f.x, f.y);
    if (f.k === 'groundwarn') { const p = cl((GT - f.t0) / (f.at - f.t0), 0, 1); g.strokeStyle = 'rgba(255,220,120,.9)'; g.lineWidth = 2; g.beginPath(); g.ellipse(X, Y, f.r * HW * 1.41, f.r * HH * 1.41, 0, 0, 7); g.stroke(); g.fillStyle = `rgba(255,200,80,${.15 + p * .3})`; g.fill(); }
    if (f.k === 'cloud') { g.fillStyle = 'rgba(20,16,30,.7)'; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(X + Math.cos(i + GT) * f.r * 18, Y - 10 + Math.sin(i * 2 + GT) * f.r * 6, f.r * 14, f.r * 9, 0, 0, 7); g.fill(); } }
    if (f.k === 'root') { g.strokeStyle = 'rgba(140,110,60,.8)'; g.lineWidth = 2; g.beginPath(); g.ellipse(X, Y, f.r * HW * 1.41, f.r * HH * 1.41, 0, 0, 7); g.stroke(); }
    if (f.k === 'mark' && f.e && !f.e.gone) { const ex = SX(f.e.x, f.e.y), ey = SY(f.e.x, f.e.y) - 52; g.fillStyle = f.col || '#ff7a30'; g.save(); g.translate(ex, ey); g.rotate(GT * 3); g.fillRect(-5, -5, 10, 10); g.restore(); }
    if (f.k === 'proj') { const p = cl((GT - f.t0) / (f.t1 - f.t0), 0, 1); const ax = SX(f.x, f.y), ay = SY(f.x, f.y) - 30, bx = SX(f.tx, f.ty), by = SY(f.tx, f.ty) - 30; g.fillStyle = f.col; g.beginPath(); g.arc(ax + (bx - ax) * p, ay + (by - ay) * p - Math.sin(p * Math.PI) * (f.arc || 0), f.big ? 4 : 2, 0, 7); g.fill(); }
    if (f.k === 'flask') { const p = cl((GT - f.t0) / .5, 0, 1); const ax = SX(f.sx, f.sy), ay = SY(f.sx, f.sy) - 30; g.fillStyle = '#c05020'; g.beginPath(); g.arc(ax + (X - ax) * p, ay + (Y - ay) * p - Math.sin(p * Math.PI) * 30, 3, 0, 7); g.fill(); if (p >= 1) { g.strokeStyle = 'rgba(255,120,40,.9)'; g.beginPath(); g.ellipse(X, Y, f.r * HW * 1.41, f.r * HH * 1.41, 0, 0, 7); g.stroke(); } }
  }
  for (const f of FX) {
    const p = (GT - f.t0) / f.dur, X = SX(f.x, f.y), Y = SY(f.x, f.y);
    if (f.k === 'ring') { g.strokeStyle = f.c; g.globalAlpha = 1 - p; g.lineWidth = 2; g.beginPath(); g.ellipse(X, Y, 8 + p * 28, 4 + p * 14, 0, 0, 7); g.stroke(); g.globalAlpha = 1; }
    if (f.k === 'boom') { g.fillStyle = `rgba(255,${150 - p * 100 | 0},40,${1 - p})`; g.beginPath(); g.ellipse(X, Y - 8, (f.r || 1.5) * 30 * (.4 + p), (f.r || 1.5) * 15 * (.4 + p), 0, 0, 7); g.fill(); }
    if (f.k === 'puff') { g.fillStyle = `rgba(210,210,230,${(1 - p) * .6})`; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(X + Math.cos(i * 1.3) * p * 16, Y - 24 - p * 18, 5 + p * 5, 0, 7); g.fill(); } }
    if (f.k === 'slash') { g.strokeStyle = `rgba(255,255,255,${1 - p})`; g.lineWidth = 2; g.beginPath(); g.arc(X, Y - 24, 14, -1 + p, .6 + p); g.stroke(); }
    if (f.k === 'heal') { g.fillStyle = `rgba(120,240,140,${1 - p})`; for (let i = 0; i < 4; i++) g.fillRect(X - 10 + i * 6, Y - 30 - p * 24 - i * 3, 3, 3); }
    if (f.k === 'bolt') { g.strokeStyle = `rgba(200,230,255,${1 - p})`; g.lineWidth = 2; g.beginPath(); let x = X, y = Y - 160; g.moveTo(x, y); while (y < Y - 8) { x += rnd(-8, 8); y += 18; g.lineTo(x, y); } g.stroke(); }
  }
}
function hourOfDay() { return WS ? WS.clock.hourAt(GT) : (GT / 60 + 9) % 24; }   // the world clock (src/world.js, src/living.js)
function darkness() { return lightNow().dark; }   // kept for callers; the light model is lightNow() in src/living.js
const PXF = '"Pixelify Sans", ui-monospace, monospace';
function render() {
  if (!P) return; const LW = LB.width, LH = LB.height, vw = LW, vh = LH;
  let camX = SX(P.x, P.y) - vw / 2, camY = SY(P.x, P.y) - 34 - vh / 2; camX = Math.round(camX); camY = Math.round(camY); CAM.x = camX; CAM.y = camY; CAM.f = DPR / DP;
  const inDun = levelAt(Math.floor(P.x), Math.floor(P.y)); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = inDun ? '#000' : '#0a1a30'; ctx.fillRect(0, 0, LW, LH); ctx.setTransform(1, 0, 0, 1, -camX, -camY); ctx.imageSmoothingEnabled = false;
  const inv = (sx, sy) => [(sx / HW + sy / HH) / 2, (sy / HH - sx / HW) / 2]; const cs = [inv(camX, camY), inv(camX + vw, camY), inv(camX, camY + vh), inv(camX + vw, camY + vh)];
  const x0 = Math.floor(Math.min(...cs.map(c => c[0]))) - 2, x1 = Math.ceil(Math.max(...cs.map(c => c[0]))) + 4, y0 = Math.floor(Math.min(...cs.map(c => c[1]))) - 2, y1 = Math.ceil(Math.max(...cs.map(c => c[1]))) + 4;
  const wf = Math.floor(GT * 2) % 3, vis = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const X = SX(x, y), Y = SY(x, y); if (X < camX - TW || X > camX + vw + TW || Y < camY - TH || Y > camY + vh + 120) continue; if (inDun && VOID[y * W + x]) continue; const t = tAt(x, y); if (Y < camY + vh + TH) { const gid = ENVOK && !inDun ? envGroundId(t, x, y, wf) : null; if (gid) envDraw(ctx, gid, x, y); else ctx.drawImage(ground(t, x, y, wf), X - 34, Y - 2); } if (TALL[t]) vis.push({ d: x + y + 1, x, y, t }); const pc = !inDun && PIECES.get(y * W + x); if (pc) for (const p of pc) vis.push({ d: p.d, p }); }
  if (ENVOK && !inDun) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const X = SX(x, y), Y = SY(x, y); if (X < camX - TW || X > camX + vw + TW || Y < camY - TH || Y > camY + vh + TH) continue; envOverlay(ctx, tAt(x, y), x, y); }
  for (const e of ents) if (e.kind === 'corpse' && !e.gone) drawCorpse(e);
  for (const e of ents) { if (e.kind === 'corpse' || e.gone) continue; if (e.hidden && e !== P) continue; const X = SX(e.x, e.y), Y = SY(e.x, e.y); if (X < camX - 100 || X > camX + vw + 100 || Y < camY - 20 || Y > camY + vh + 120) continue; vis.push({ d: e.x + e.y, e }); }
  vis.sort((a, b) => a.d - b.d); for (const v of vis) { if (v.e) drawEnt(v.e); else if (v.p) drawPiece(ctx, v.p); else { const kit = ENVOK && !inDun; if (kit && v.t === T.TR && inFront(v.x, v.y)) ctx.globalAlpha = .45; if (!(kit && envTall(ctx, v.t, v.x, v.y))) drawTall(v.t, v.x, v.y); ctx.globalAlpha = 1; } }
  drawEffects();
  drawLight(LW, LH, camX, camY); devDraw(camX, camY);
  mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.imageSmoothingEnabled = false; mctx.drawImage(LB, 0, 0, LW * DP, LH * DP);
  drawOverlay(camX, camY);
}
/* crisp text overlay in CSS pixels. Ghosts get no names, health or enemy information (§4). */
function drawOverlay(camX, camY) {
  const g = mctx; g.setTransform(DPR, 0, 0, DPR, 0, 0); const S = (wx, wy) => [(SX(wx, wy) - camX) / CAM.f, (SY(wx, wy) - camY) / CAM.f]; g.textAlign = 'center';
  const [px, py] = S(P.x, P.y);
  annOverlay(g, S);
  if (!P.ghost) for (const e of ents) {
    if (e.gone || e === P || e.hidden) continue; const isC = e.kind === 'corpse';
    const hgt = isC ? 18 : e.type && MON[e.type] ? MON[e.type].h : 74; const [x, top] = S(e.x, e.y); const yy = top - hgt / CAM.f * 1 - 6;
    if (x < -150 || x > VW + 150 || yy < -40 || yy > VH + 40) continue;
    const show = e === P.sel || (e.kind === 'npc' || e.kind === 'ally') && Math.hypot(e.x - P.x, e.y - P.y) < 7 || (isC && (e.mine || e.allyBody)) || e.kind === 'remote';
    if ((e.kind === 'mon' || e.kind === 'pet' || (e.kind === 'ally' && !e.ghost)) && e.hp < e.max) { const w = 34, f = cl(e.hp / e.max, 0, 1); g.fillStyle = '#000'; g.fillRect(x - w / 2 - 1, yy - 1, w + 2, 6); g.fillStyle = f > .5 ? '#5fd068' : f > .25 ? '#f0c040' : '#f04848'; g.fillRect(x - w / 2, yy, w * f, 4); }
    if (e.kind === 'mon' && e.state === 'tele') { g.font = `bold 18px ${PXF}`; g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText('!', x, yy - 8); g.fillStyle = '#ff5040'; g.fillText('!', x, yy - 8); }
    if (show) { g.font = `13px ${PXF}`; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,10,.9)'; const nm = e.name; g.strokeText(nm, x, yy - (e.kind === 'mon' && e.state === 'tele' ? 26 : 6)); g.fillStyle = isC ? '#d8d0c0' : relColor(e); g.fillText(nm, x, yy - (e.kind === 'mon' && e.state === 'tele' ? 26 : 6)); }
    if (e.say && e.say.until > GT) { g.font = `13px ${PXF}`; const ty = yy - 24; const tw = g.measureText(e.say.t).width + 12; g.fillStyle = 'rgba(14,20,36,.88)'; g.fillRect(x - tw / 2, ty - 13, tw, 18); g.strokeStyle = '#c8a860'; g.lineWidth = 1; g.strokeRect(x - tw / 2 + .5, ty - 12.5, tw - 1, 17); g.fillStyle = '#f2ecdc'; g.fillText(e.say.t, x, ty); }
  }
  for (const f of FX) { if (f.k !== 'txt') continue; const p = (GT - f.t0) / f.dur; const [x, y] = S(f.x, f.y); g.font = `bold 15px ${PXF}`; g.globalAlpha = 1 - p * p; g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(f.t, x, y - 80 - p * 26); g.fillStyle = f.c; g.fillText(f.t, x, y - 80 - p * 26); g.globalAlpha = 1; }
  questMarkers(g, S);
  // ground-aim reticle preview
  if (AIM && AIM.pt) { const [x, y] = S(AIM.pt.x, AIM.pt.y); const ok = AIM.ok; g.strokeStyle = ok ? '#ffe08a' : '#ff5050'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, AIM.r * HW * 1.41 / CAM.f, AIM.r * HH * 1.41 / CAM.f, 0, 0, 7); g.stroke(); g.setLineDash([4, 4]); g.beginPath(); g.ellipse(px, py, AIM.range * HW * 1.41 / CAM.f, AIM.range * HH * 1.41 / CAM.f, 0, 0, 7); g.stroke(); g.setLineDash([]); }
  // action bars under the player
  const bar = (lbl, p, col, row) => { const y = py + 14 + row * 20; g.fillStyle = 'rgba(10,14,30,.88)'; g.fillRect(px - 52, y, 104, 16); g.strokeStyle = '#c8a860'; g.lineWidth = 1; g.strokeRect(px - 51.5, y + .5, 103, 15); g.fillStyle = col; g.fillRect(px - 50, y + 11, 100 * cl(p, 0, 1), 3); g.font = `11px ${PXF}`; g.fillStyle = '#fff'; g.fillText(lbl, px, y + 10); };
  let row = 0;
  if (P.prep) bar((P.prep.sp.legacy ? 'Preparing ' : '“' + P.prep.sp.chant + '” · ') + P.prep.sp.n, (GT - P.prep.t0) / (P.prep.t1 - P.prep.t0), '#b070ff', row++);
  if (P.held) bar('Holding ' + P.held.sp.n + ' · tap slot to release', 1, '#ffd060', row++);
  if (P.bandage) { const b = P.bandage; bar(`${{ heal: 'Bandaging', cure: 'Curing', res: 'Resurrecting' }[b.kind]} ${b.self ? 'self' : b.e.name} · ${Math.max(0, b.t1 - GT).toFixed(1)} s${b.slips ? ' · slips ' + b.slips : ''}`, (GT - b.t0) / (b.t1 - b.t0), '#7ee08a', row++); }
  { const w = wDef(); if (P.armed && w.ammo && !P.ghost) { const left = SF.swingLeft(P.sw, GT, P.stam, w), still = GT - (P.movedAt || -99); bar(left > 0 ? `Reloading ${left.toFixed(1)} s` : still < SF.ARCHERY.aim ? 'Stop to aim' : 'Aimed', left > 0 ? 1 - left / SF.swingDelay(P.stam, w.speed) : Math.min(1, still / SF.ARCHERY.aim), '#ffb060', row++); } }
  if (P.task) bar(P.task.label, (GT - P.task.t0) / (P.task.t1 - P.task.t0), '#6ec6ff', row++);
  if (P.ghost) { g.fillStyle = 'rgba(40,50,80,.28)'; g.fillRect(0, 0, VW, VH); const r = nearestRes(); if (r) { const [tx, ty] = S(r.x, r.y); const d = Math.round(Math.hypot(r.x - P.x, r.y - P.y)); const a = Math.atan2(ty - py, tx - px); const rad = Math.min(VW, VH) * .32, cx = VW / 2 + Math.cos(a) * rad, cy = VH / 2 + Math.sin(a) * rad; const on = tx > 30 && tx < VW - 30 && ty > 60 && ty < VH - 60;
      if (on) { g.save(); g.translate(tx, ty - 90 - 6 * Math.sin(GT * 5)); g.fillStyle = '#f0c94a'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 14); g.lineTo(-11, -2); g.lineTo(-4, -2); g.lineTo(-4, -14); g.lineTo(4, -14); g.lineTo(4, -2); g.lineTo(11, -2); g.closePath(); g.fill(); g.stroke(); g.restore(); }
      if (d > 2) { const pul = 1 + .12 * Math.sin(GT * 6); g.save(); g.translate(cx, cy); g.rotate(a); g.scale(pul, pul); g.fillStyle = '#f0c94a'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(22, 0); g.lineTo(-12, -15); g.lineTo(-5, 0); g.lineTo(-12, 15); g.closePath(); g.fill(); g.stroke(); g.restore(); g.font = `bold 13px ${PXF}`; g.lineWidth = 3; g.strokeStyle = '#000'; const lb = r.n + ' · ' + d + ' m'; g.strokeText(lb, cx, cy + 32); g.fillStyle = '#f0c94a'; g.fillText(lb, cx, cy + 32); } } }
  if (TRACKS && TRACKS.until > GT) for (const t of TRACKS.list) { const a = (t.bearing - 90) * Math.PI / 180, rad = Math.min(VW, VH) * .38, cx = VW / 2 + Math.cos(a) * rad, cy = VH / 2 + Math.sin(a) * rad * .8; g.fillStyle = 'rgba(110,198,255,.9)'; g.font = `12px ${PXF}`; g.fillText(t.label, cx, cy); }
  if (JOY.on) { g.globalAlpha = .45; g.strokeStyle = '#c8a860'; g.lineWidth = 2; g.beginPath(); g.arc(JOY.x0, JOY.y0, 56, 0, 7); g.stroke(); const vx = JOY.x - JOY.x0, vy = JOY.y - JOY.y0, m = Math.min(56, Math.hypot(vx, vy)) / (Math.hypot(vx, vy) || 1); g.fillStyle = JOY.sprint ? '#ffd060' : '#6ec6ff'; g.beginPath(); g.arc(JOY.x0 + vx * m, JOY.y0 + vy * m, 20, 0, 7); g.fill(); g.globalAlpha = 1; }
}
let miniImg = null, miniCtx = null;
function buildMini() { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); const id = g.createImageData(W, H); const col = { 30: [255, 190, 80], 31: [220, 80, 60], [T.G]: [74, 138, 60], [T.TR]: [30, 80, 44], [T.WA]: [30, 90, 150], [T.RK]: [110, 104, 98], [T.SA]: [216, 192, 138], [T.RD]: [150, 144, 132], [T.FL]: [160, 106, 58], [T.WL]: [180, 172, 156], [T.DI]: [124, 92, 60], [T.SH]: [74, 110, 88], [T.FG]: [200, 90, 40], [T.AN]: [60, 60, 60], [T.BR]: [154, 106, 60], [T.DR]: [74, 40, 16], [T.AK]: [255, 214, 120], [T.LP]: [255, 210, 122], [T.BN]: [176, 124, 68], [T.ST]: [138, 106, 74], [T.FP]: [255, 120, 30], [T.RB]: [138, 160, 64], [T.SB]: [240, 230, 210], [T.HB]: [122, 192, 80], [T.SC]: [220, 216, 206], [T.FN]: [154, 116, 72], [T.BL]: [90, 106, 90], [T.MR]: [58, 48, 40], [T.CL]: [92, 84, 76], [T.CF]: [70, 64, 58], [T.SBR]: [196, 188, 170], [T.GV]: [120, 130, 110], [T.CP]: [150, 130, 70] };
  for (let i = 0; i < W * H; i++) { const c3 = col[map[i]] || [0, 0, 0]; id.data[i * 4] = c3[0]; id.data[i * 4 + 1] = c3[1]; id.data[i * 4 + 2] = c3[2]; id.data[i * 4 + 3] = 255; } g.putImageData(id, 0, 0); miniImg = c; miniCtx = $('#mini').getContext('2d'); }
function drawMini() {
  if (!miniCtx || !P) return; const s = 180, sc = 2.2, g = miniCtx; g.save(); g.clearRect(0, 0, s, s); g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, 7); g.clip(); g.fillStyle = '#0a1a30'; g.fillRect(0, 0, s, s); g.imageSmoothingEnabled = false;
  g.translate(s / 2, s / 2); g.scale(sc, sc); g.drawImage(miniImg, -P.x, -P.y);   // north-up, the same way round as the full map (v0.20)
  annMiniDraw(g);
  if (!P.ghost) for (const e of ents) { if (e.gone || e === P || e.hidden) continue; if (e.kind !== 'mon' && e.kind !== 'npc' && e.kind !== 'ally' && !(e.kind === 'corpse' && e.mine)) continue; const dx = e.x - P.x, dy = e.y - P.y; if (Math.abs(dx) > 45 || Math.abs(dy) > 45) continue; g.fillStyle = e.kind === 'corpse' ? '#f0c94a' : relColor(e); g.fillRect(dx - 1, dy - 1, 2, 2); }
  for (const sh of SHRINES) { g.fillStyle = '#ffd678'; g.fillRect(sh.x - P.x - 2, sh.y - P.y - 2, 4, 4); }
  g.restore(); g.strokeStyle = '#c8a860'; g.lineWidth = 3; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 1.5, 0, 7); g.stroke();
  const [ux, uy] = headingOf(P); g.save(); g.translate(s / 2, s / 2); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(ux * 9, uy * 9); g.lineTo(-ux * 6 - uy * 6, -uy * 6 + ux * 6); g.lineTo(-ux * 2, -uy * 2); g.lineTo(-ux * 6 + uy * 6, -uy * 6 - ux * 6); g.closePath(); g.stroke(); g.fill(); g.restore();
  compassN(g, s / 2, 13, 11);
}
/* the player's facing as a world (map) direction; screen sectors are isometric */
function headingOf(e) { const a = SECT_ANG[e.sect || 0] * Math.PI / 180, hx = (Math.cos(a) + 2 * Math.sin(a)) / 2, hy = (2 * Math.sin(a) - Math.cos(a)) / 2, hl = Math.hypot(hx, hy) || 1; return [hx / hl, hy / hl]; }
function compassN(g, x, y, f) { g.save(); g.font = `bold ${f}px ${PXF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(10,20,40,.85)'; g.beginPath(); g.arc(x, y, f * .85, 0, 7); g.fill(); g.strokeStyle = '#c8a860'; g.lineWidth = Math.max(1, f / 8); g.stroke(); g.fillStyle = '#ffe9b0'; g.fillText('N', x, y + 1); g.restore(); }

/* ================= UI: HUD, panels, touch input, creation, persistence ================= */
const KEYS = {}; const SETTINGS = { mirror: false, stickSprint: false };
try { Object.assign(SETTINGS, JSON.parse(localStorage.getItem('shardfall.settings') || '{}')); } catch (e) { }
const saveSettings = () => { try { localStorage.setItem('shardfall.settings', JSON.stringify(SETTINGS)); } catch (e) { } };
muted = !!SETTINGS.muted; SFXA.setMuted(muted);   // mute persists with the other settings
SFXA.musicOn = SETTINGS.music !== false;           // music on unless turned off in the menu

/* ---------- HUD ---------- */
function bar(id, v, m, lbl) { const el = $(id); el.querySelector('i').style.width = cl(v / m * 100, 0, 100) + '%'; el.querySelector('span').textContent = lbl + ' ' + Math.floor(v) + '/' + m; }
function refreshHud() {
  if (!P) return; eqTick(); bar('#hp', P.hp, SF.maxHp(P), 'HP'); bar('#sp', P.stam, SF.maxStam(P), 'ST'); bar('#mp', P.mana, SF.maxMana(P), 'MP');
  { const pn = $('#pname'), tag = P.name + (P.ghost ? ' · ghost' : lawNameTag()); if (pn.textContent !== tag) pn.textContent = tag; pn.style.color = P.ghost ? '' : notoColor(P); }   // your notoriety: blue, grey (criminal, with the time left) or red
  const chips = []; if (P.hidden) chips.push(`hidden ${Math.max(0, P.stepBudget)} steps`); if (P.poison) chips.push('poisoned'); if (P.skillPool > 0) chips.push(f1(P.skillPool) + ' skill points to place'); if (P.meditating) chips.push('meditating'); if (P.veil && P.veil.until > GT && P.veil.left > 0) chips.push('stoneveil ' + Math.round(P.veil.left)); if (P.fed > GT) chips.push('fed'); { const en = encumb(); if (en.stage) chips.push(en.n.toLowerCase()); } if (inCombat() && !P.ghost) chips.push('in combat'); if (!P.ghost) chips.push(...magicChips());
  $('#chips').textContent = chips.join(' · ');
  $('#zone').textContent = ZONE_NAME[zoneAt(Math.floor(P.x), Math.floor(P.y))] || '';
  { const ck = $('#clock'); ck.textContent = clockText(); ck.title = PERIOD_NAME[SIM.periodOf(hourOfDay())] + ' · day ' + (WS ? WS.clock.dayAt(GT) : 1); }
  const sb = $('#b-run'); sb.classList.toggle('on', !!P.sprintOn); sb.textContent = P.sprintOn ? 'Sprint on' : 'Sprint';
  const ab = $('#b-atk'); ab.classList.toggle('on', !!P.armed); ab.querySelector('b').textContent = P.armed ? 'Armed' : 'Attack'; { const w = wDef(), left = SF.swingLeft(P.sw, GT, P.stam, w); ab.querySelector('small').textContent = weaponLabel(P) + (left > 0 ? ' · ' + left.toFixed(1) + ' s' : ' · ready'); }
  P.hbPage = P.hbPage || 0; $('#b-page').textContent = 'Bar ' + (P.hbPage + 1) + '/3';
  document.querySelectorAll('.slot').forEach((b, i0) => { const i = i0 + P.hbPage * 3; const s = P.hotbar[i]; const [a, c] = slotLabel(s); b.querySelector('b').textContent = a; b.querySelector('small').textContent = c; const held = s && s.k === 'spell' && P.held && P.held.sp.id === s.id, prep = s && s.k === 'spell' && P.prep && P.prep.sp.id === s.id; b.classList.toggle('held', !!held); b.classList.toggle('prep', !!prep); let cd = 0; if (s && s.k === 'item' && SF.CONSUMABLES[s.id] && P.cd) cd = Math.max(0, (P.cd[SF.CONSUMABLES[s.id].fam] || 0) - GT); b.querySelector('em').textContent = cd ? Math.ceil(cd) : ''; }); magicSlots();
  const g = $('#ghost'); g.hidden = !P.ghost;
  if (P.ghost) { const left = 12 - (GT - P.ghostAt); const s = SHRINES.find(z => z.id === P.bound); const body = ents.find(e => e.mine && !e.gone); g.querySelector('p').textContent = (body ? `Your body is ${Math.round(dist(body, P))} m away, crumbling in ${Math.ceil((body.expires - GT) / 60)} min. ` : '') + 'Walk to a shrine or healer, or return to your bound shrine.'; const b = g.querySelector('button'); b.disabled = left > 0; b.textContent = left > 0 ? `Return to ${s.n} in ${Math.ceil(left)} s` : `Return to ${s.n} now`;  const rb = g.querySelector('[data-a=report]'); rb.hidden = !P.report; if (P.report) rb.textContent = 'Report murder by ' + P.report.name; }
  $('#b-int').hidden = !canInteract(); $('#b-cancel').hidden = !((AIM && !P.held) || P.task);
  const o = questObjective(), ob = $('#obj'); ob.hidden = !o; if (o) ob.querySelector('span').textContent = o.t;
  document.body.classList.toggle('pan-open', !!PANEL && !['loot', 'picker', 'quest'].includes(PANEL));
  if (SCREEN === 'map') drawMap();
  renderTarget();
}
function renderTarget() {
  const el = $('#tgt'), t = P.sel; if (!t || t.gone || P.ghost) { el.hidden = true; return; } el.hidden = false; let body = '', btns = '';
  if (t === P) { body = `<b>${esc(P.name)}</b> <span class="note">self · heals and bandages land here</span>`; btns = btn('useitem', 'Bandage self', { id: 'bandage' }) + btn('abil', 'Anatomy', { id: 'anatomy' }); }
  else if (t.kind === 'ally') { const f = t.ghost ? 0 : cl(t.hp / t.max, 0, 1); body = `<span class="badge neu">●</span><b>${esc(t.name)}</b> <span class="note">${t.ghost ? 'ghost · waiting to be resurrected' : (t.poison ? 'poisoned · ' : '') + Math.ceil(t.hp) + '/' + t.max + ' HP · ' + (t.order === 'follow' ? 'following' : 'holding')} · ${dist(t, P).toFixed(1)} m</span>${t.ghost ? '' : `<div class="bar sm"><i style="width:${f * 100}%;background:${f > .5 ? '#5fd068' : '#f0c040'}"></i></div>`}`;
    btns = btn('bandother', t.ghost ? 'Bandage: resurrect ' + esc(t.name) : t.poison ? 'Bandage: cure ' + esc(t.name) : 'Bandage ' + esc(t.name), {}, 'ac') + (t.ghost ? '' : btn('allycmd', t.order === 'follow' ? 'Hold here' : 'Follow me', { c: t.order === 'follow' ? 'wait' : 'follow' }) + btn('abil', 'Anatomy', { id: 'anatomy' })); }
  else if (t.kind === 'mon') { const f = cl(t.hp / t.max, 0, 1), d = MON[t.type]; const st = { idle: 'calm', chase: 'hostile', tele: 'winding up!', strike: 'striking', rec: 'recovering', return: 'leashing back' }[t.state];
    body = `<span class="badge att" title="attackable">◆</span><b>${esc(t.name)}</b> <span class="note">${st} · ${dist(t, P).toFixed(1)} m</span><div class="bar sm"><i style="width:${f * 100}%;background:${f > .5 ? '#5fd068' : f > .25 ? '#f0c040' : '#f04848'}"></i></div>`;
    const d2 = MON[t.type]; if (ents.some(e => e.kind === 'pet' && !e.gone)) btns += btn('petcmd', 'Pets attack', { c: 'attack' }, 'on'); if (tameMin(t.type) !== null && !d2.boss) btns += btn('abil', 'Tame', { id: 'tame' }) + btn('abil', 'Lore', { id: 'lore' }); if (isAnimal(t) && SF.count(P.pack, 'crook')) btns += btn('abil', 'Herd', { id: 'herd' }); if (SF.count(P.pack, 'lute') && !d2.boss) btns += btn('abil', 'Entice', { id: 'entice' }) + btn('abil', 'Provoke', { id: 'provoke' }); if (packOwner(t) && t.target !== P) btns += btn('abil', 'Snoop', { id: 'snoop' }) + btn('abil', 'Steal', { id: 'steal' }); btns += btn('abil', 'Anatomy', { id: 'anatomy' }); if (t.ward > 0) body += ` <span class="note">ward ${t.ward}</span>`; }
  else if (t.kind === 'pet') { const f = cl(t.hp / t.max, 0, 1); body = `<span class="badge neu">●</span><b>${esc(t.name)}</b> <span class="note">${t.order}${t.type ? ' · ' + loyaltyWord(t) : ''}</span><div class="bar sm"><i style="width:${f * 100}%;background:#5fd068"></i></div>`; btns = btn('petcmd', 'Follow', { c: 'follow' }) + btn('petcmd', 'Stay', { c: 'stay' }) + (t.type ? btn('abil', 'Treat', { id: 'vet' }) + btn('abil', 'Feed', { id: 'feed' }) : '') + btn('petcmd', 'Dismiss', { c: 'dismiss' }); }
  else if (t.kind === 'npc') { body = `<span class="badge neu" title="neutral">●</span><b>${esc(t.name)}</b>`; btns = `<button class="btn sm ac" data-a="interact">Talk</button>` + (packOwner(t) ? btn('abil', 'Beg', { id: 'beg' }) + btn('abil', 'Snoop', { id: 'snoop' }) + btn('abil', 'Steal', { id: 'steal' }) : ''); }
  else if (t.kind === 'corpse') { const ls = t.cont && Number.isFinite(t.cont.diedAt) ? SF.lootStatus(t.cont, P.id, GT) : { label: '' }; body = `<b>${esc(t.name)}</b> <span class="note">${t.mine ? ls.label + ' · ' : ''}${t.cont ? t.cont.items.length + ' stacks' : ''} · ${dist(t, P).toFixed(1)} m</span>`; btns = `<button class="btn sm ac" data-a="interact">Open</button>${t.mon && !t.skinned ? '<button class="btn sm" data-a="skin">Carve</button>' : ''}${btn('abil', 'Examine', { id: 'forensic' })}`; }
  else if (t.kind === 'node') { const tier = t.skill === 'fishing' ? 0 : nodeTier(t.x, t.y), rw = t.skill === 'mining' || t.skill === 'lumberjacking'; const st = t.skill === 'fishing' ? '' : ' · ' + (rw ? nodeNote(t) : `${nodeStock(t.x, t.y).n} left`) + (isQuayNode(t.x, t.y) ? ' · training' : ''); body = `<b>${esc(cap1(rw ? nodeLabel(t) : t.name))}</b> <span class="note">${t.skill === 'forage' ? 'reagents · grade ' + (tier + 1) : SF.SKILL[t.skill].n + ' · grade ' + (tier + 1) + ' (needs ' + SF.NODE_TIER_MIN[tier] + ')'}${st} · ${Math.hypot(t.x + .5 - P.x, t.y + .5 - P.y).toFixed(1)} m</span>`; btns = `<button class="btn sm ac" data-a="interact">Gather</button>` + (rw ? `<button class="btn sm" data-a="survey">${t.skill === 'mining' ? 'Survey' : 'Read grain'}</button>` : ''); }
  const html = `<div class="trow">${body}<button class="x" data-a="desel" aria-label="Clear target">×</button></div>${btns ? '<div class="acts">' + btns + '</div>' : ''}`; if (el._h !== html) { el.innerHTML = html; el._h = html; }
}
const cap1 = s => s[0].toUpperCase() + s.slice(1);
function renderLog() { const el = $('#log'); if (!el) return; el.innerHTML = LOG.filter(l => GT - l.at < 12).slice(-6).map(l => `<div style="color:${l.c}">${esc(l.t)}</div>`).join(''); }

/* ---------- panels ---------- */
let PANEL = null, PTAB = null, ASSIGN = null;
function resetInput() { PT = null; JOY.on = false; JOY.sprint = false; for (const key in KEYS) KEYS[key] = 0; }
addEventListener('blur', resetInput);
function openPanel(k, tab) { resetInput(); PANEL = k; PTAB = tab || null; renderPanel(true); }
function closePanel() { PANEL = null; const el = $('#panel'); el.hidden = true; el._h = ''; if (P) P.lootOpen = null; }
const btn = (a, label, data, cls) => `<button class="btn sm ${cls || ''}" data-a="${a}"${Object.entries(data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}>${label}</button>`;
const iname = it => (it.qty > 1 ? it.qty + ' × ' : '') + SF.itemName(it) + (it.q ? ` (grade ${it.q + 1})` : '') + (it.quality === 'exceptional' ? ' · exceptional' : '') + (it.maker ? ` · by ${it.maker}` : '') + (SF.WORK_TOOLS[it.id] && !SF.ITEMS[it.id].stack ? ` · ${SF.toolUses(it)} uses` : '') + (it.cond !== undefined && SF.WEARABLE(it.id) ? ` · ${Math.round(it.cond)}/${it.maxc || 100}${it.cond <= 0 ? ' broken' : it.cond < .2 * (it.maxc || 100) ? ' worn' : ''}` : '') + (it.venom ? ` · venom ×${it.venom.charges}` : '') + (SF.weaponOf(it) ? ` · ${SF.weaponSkillName(it)}` : '');
function renderPanel(top) {
  if (!PANEL || !P) return; const el = $('#panel'); let r = null; try { r = PANELS[PANEL] && PANELS[PANEL](); } catch (e) { console.error(e); }   // a panel that fails to build closes cleanly instead of leaving the HUD hidden
  if (!r) { closePanel(); return; }
  const html = `<div class="ph"><b>${esc(r[0])}</b><button class="x" data-a="close" aria-label="Close">×</button></div><div class="pb">${r[1]}</div>`; if (!top && el._h === html && !el.hidden) return;
  const sb = el.querySelector('.pb'); const st = sb && !top ? sb.scrollTop : 0; el.innerHTML = html; el._h = html; el.hidden = false; el.querySelector('.pb').scrollTop = st;
}
let bagSort = 'Category', bagUid = null;
const bagSymbols = { weapon:'⚔', shield:'⛨', armor:'♜', coin:'◉', ore:'◆', metal:'▰', timber:'▥', reagent:'✧', potion:'⚗', tool:'⚒', food:'❧', medic:'✚', ammo:'➶', cloth:'▧' };
/* Backpack icons v1.0.1 (src/backpack-icons.js): one atlas, looked up by the item's id; the atlas is set once as a CSS background
   so each tile only carries its offset. Items without a painted icon keep the category glyph. */
{ const st = document.createElement('style'); st.textContent = '.bagico{background-image:url(' + BAG_ICONS.src + ')}'; document.head.appendChild(st); }
function bagIcon(it, size) {
  const r = BAG_ICONS.rect[it.id];
  if (!r) return '<i class="bagglyph" aria-hidden="true" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * .6) + 'px">' + (bagSymbols[SF.ITEMS[it.id].cat] || '◇') + '</i>';
  const k = size / r[2];
  return '<i class="bagico" aria-hidden="true" data-icon="' + esc(it.id) + '" style="width:' + size + 'px;height:' + size + 'px;background-size:' + BAG_ICONS.w * k + 'px ' + BAG_ICONS.h * k + 'px;background-position:' + -r[0] * k + 'px ' + -r[1] * k + 'px"></i>';
}

// the same atlas tile, small, in front of item rows elsewhere (Character, loot, bank, shops, crafting)
const rowIcon = it => SF.ITEMS[it.id] ? bagIcon(it, 28) : '';

function bagStats(it) {
  const def = SF.ITEMS[it.id], weapon = SF.WEAPONS[def.wpn];
  const lines = [iname(it), cap1(def.cat || 'item') + ' · ' + SF.itemKg(it).toFixed(2) + ' kg'];
  if (weapon) { lines.push('Base damage ' + weapon.dmg.join('–') + ' · Reach ' + weapon.reach + ' m'); lines.push(SF.SKILL[weapon.skill].n + ' · speed ' + weapon.speed + ' · STR ' + weapon.str + (weapon.two ? ' · two-handed' : '')); }
  if (def.armor && SF.ARMOR[def.armor] !== undefined) lines.push('Base armor ' + SF.ARMOR[def.armor]);
  if (!def.trade) lines.push('Protected');
  return '<div class="baghead">' + bagIcon(it, 56) + '<span>' + esc(lines[0]) + '</span></div>' + lines.slice(1).map(line => '<span>' + esc(line) + '</span>').join('');
}

function itemSkill(k, u, worn) {
  const it = findU(P.pack, u) || (worn ? Object.values(P.equip).find(x => x && x.uid === u) : null); if (!it) return; closePanel();
  if (k === 'picklock') return lockUse(it);
  if (k === 'untrap') return untrapUse(it);
  if (k === 'lockup') { it.locked = true; it.lockLvl = it.lockLvl || 20; P.pack.ver++; snd('door.unlock', { key: 'P', gain: .5 }); return log(`You lock the box (lock ${it.lockLvl}).`); }
  if (k === 'arm') { it.armed = true; it.power = it.power || 20; P.pack.ver++; return log(`You arm the box's trap (power ${it.power}).`); }
  if (ITEM_SKILL[k]) return ITEM_SKILL[k](it);
}
function bagActions(it) {
  const d = SF.ITEMS[it.id]; let a = '';
  if (d.slot) a += btn('equip', 'Equip', { u: it.uid });
  if (d.use === 'consume') a += btn('useitem', 'Use', { id: it.id });
  if (d.use === 'bandage') a += btn('useitem', 'Bandage self', { id: it.id }) + btn('bandother', 'Bandage other', {});
  if (d.use === 'eat') a += btn('useitem', 'Eat', { id: it.id });
  if (d.use || SF.CONSUMABLES[it.id]) a += btn('assign', 'Slot', { k: 'item', id: it.id });
  if (d.use === 'bandage') a += btn('assign', 'Slot other', { k: 'act', id: 'bandother' });
  if (SF.WEARABLE(it.id) && (it.cond !== undefined && it.cond < (it.maxc || 100))) a += btn('repair', 'Repair', { u: it.uid });
  a += magicItemActions(it);
  a += btn('appraise', 'Identify', { u: it.uid });
  if (it.id === 'lockbox') a += it.locked ? btn('skitem', 'Pick lock', { k: 'picklock', u: it.uid }) : btn('skitem', 'Lock', { k: 'lockup', u: it.uid });
  if (it.id === 'trapbox') a += it.armed ? btn('skitem', 'Remove trap', { k: 'untrap', u: it.uid }) : btn('skitem', 'Arm', { k: 'arm', u: it.uid });
  if (d.poisonLvl) a += btn('abil', 'Poison…', { id: 'poison' });
  if (SF.weaponOf(it) || (d.slot && d.slot !== 'weapon' && d.cat !== 'jewelry')) a += btn('skitem', 'Arms Lore', { k: 'armslore', u: it.uid });
  if (d.use === 'eat' || d.cat === 'potion') a += btn('skitem', 'Taste', { k: 'taste', u: it.uid });
  if (it.id === 'tmap') a += btn('skitem', it.decoded ? 'Where?' : 'Decode', { k: 'decode', u: it.uid }) + (it.decoded && !it.dug ? btn('abil', 'Dig', { id: 'dig' }) : '');
  if (it.id === 'kindling') a += btn('abil', 'Light', { id: 'camp' });
  if (d.trade) a += btn('drop', 'Drop', { u: it.uid });
  return a;
}
/* ---------- the Skills page: classic groups, real or displayed values to 0.1, locks, search, one-tap use, help, prerequisites ---------- */
const SKUI = { real: false, q: '', closed: {} };
let PICKT = null;   // a pending creature/item target for a skill (src: pickTarget)
// skill → ability id for the one-tap Use button (abilities live in ABIL, or are the hide/track/meditate built-ins)
const SKILL_ABIL = { anatomy: 'anatomy', hiding: 'hide', tracking: 'track', meditation: 'meditate', detectinghidden: 'detect', animaltaming: 'tame', veterinary: 'vet',
  peacemaking: 'peace', enticement: 'entice', provocation: 'provoke', stealing: 'steal', poisoning: 'poison', stealth: 'stealth', animallore: 'lore', evaluatingintelligence: 'evalint',
  itemidentification: 'itemid', armslore: 'armslore', musicianship: 'play', begging: 'beg', camping: 'camp', forensicevaluation: 'forensic', herding: 'herd', snooping: 'snoop',
  spiritspeak: 'spirit', tasteidentification: 'taste', lockpicking: 'picklock', removetrap: 'untrap', cartography: 'draw', inscription: 'scribe' };
const ABIL_LIST = [['bandother', 'Bandage other (Healing: an ally or a player ghost)'], ['anatomy', 'Anatomy'], ['evalint', 'Evaluating Intelligence'], ['hide', 'Hiding'], ['stealth', 'Stealth (while hidden, 80 Hiding)'],
  ['detect', 'Detecting Hidden'], ['track', 'Tracking'], ['meditate', 'Meditation'], ['tame', 'Animal Taming'], ['lore', 'Animal Lore'], ['vet', 'Veterinary'], ['feed', 'Feed a pet'], ['herd', 'Herding (crook)'],
  ['play', 'Musicianship'], ['peace', 'Peacemaking'], ['entice', 'Enticement'], ['provoke', 'Provocation'], ['snoop', 'Snooping'], ['steal', 'Stealing'], ['poison', 'Poisoning'], ['picklock', 'Lockpicking'],
  ['untrap', 'Remove Trap'], ['beg', 'Begging'], ['camp', 'Camping'], ['forensic', 'Forensic Evaluation'], ['spirit', 'Spirit Speak'], ['armslore', 'Arms Lore'], ['itemid', 'Item Identification'], ['taste', 'Taste Identification'],
  ['trap', 'Set a snare (a tinker\'s snare kit)']];
function useAbility(id) { if (ABIL[id]) return ABIL[id].fn(); const f = { hide, track, meditate }[id]; if (f) return f(); }
function skillsPanel() {
  const tot = SF.totalSkill(P), q = SKUI.q.trim().toLowerCase();
  let h = `<div class="sktop"><input id="skq" type="search" placeholder="Search skills" value="${esc(SKUI.q)}" autocomplete="off" aria-label="Search skills">${btn('skview', SKUI.real ? 'Showing real' : 'Showing displayed')}</div>`;
  h += `<div class="note">Real total ${f1(tot)} / 700.0 · ▲ raise · ■ hold · ▼ lower (gives points back at the cap). ${SKUI.real ? 'Real values: what you trained.' : 'Displayed values include a small lift from your stats; the real value counts toward 700.'}</div>`;
  if (P.skillPool > 0) h += `<div class="sec">Skill reform</div><p class="note">${f1(P.skillPool)} trained points from skills that merged or were retired are waiting. Tap +1.0 on a skill to place them (never past 100.0 or the 700.0 total).</p>`;
  for (const [g, gn] of SF.SKILL_GROUPS) {
    const rows = SF.SKILLS.filter(sk => sk[2] === g && (!q || sk[1].toLowerCase().includes(q) || (SF.SKILL_TIP[sk[0]] || '').toLowerCase().includes(q)));
    if (!rows.length) continue; const sum = rows.reduce((a, sk) => a + P.skills[sk[0]].v, 0), shut = SKUI.closed[g] && !q;
    h += `<button class="skgrp" data-a="skgrp" data-g="${g}" aria-expanded="${!shut}">${shut ? '▸' : '▾'} ${gn} <span class="note">${f1(sum)}</span></button>`;
    if (shut) continue;
    for (const [k, n] of rows) {
      const s = P.skills[k], D = SF.SKILL[k], lk = s.lock === 'raise' ? '▲' : s.lock === 'hold' ? '■' : '▼', v = SKUI.real ? s.v / 10 : sv(k), ab = SKILL_ABIL[k];
      const badge = D.state === 'pending' ? ' <span class="badge pend">pending</span>' : D.state === 'partial' ? ' <span class="badge part">partial</span>' : '';
      const req = SF.SK.REQUIRES[k] && !SF.SK.meetsReq(P, k) ? ` <span class="badge req">needs ${esc(SF.SK.reqText(k))}</span>` : '';
      h += `<div class="row ${D.live ? '' : 'na'}" title="${esc(D.help)}"><span class="nm">${n}${badge}${req}<br><span class="note">${esc(D.help)}</span></span><span class="v">${v.toFixed(1)}</span>${P.skillPool > 0 && s.v < SF.SKILL_MAX ? btn('pool', '+1.0', { k }) : ''}${D.live && ab && (ABIL[ab] || ['hide', 'track', 'meditate'].includes(ab)) ? btn('skuse', 'Use', { k }) : ''}${btn('lock', lk, { k })}</div>`;
    }
  }
  h += '<div class="sec">Recent skill checks</div>' + (SKLOG.slice(-14).reverse().map(l => `<div class="note">${SF.SKILL[l.k].n}: ${esc(l.r)}</div>`).join('') || '<p class="note">None yet.</p>');
  return ['Skills', h];
}
document.addEventListener('input', e => { if (e.target && e.target.id === 'skq') { SKUI.q = e.target.value; renderPanel(); } });
/* ---------- NPC trainers (src/skills.js SK.TRAINERS): each profession teaches its own skills up to 30.0 at 1 gold per 0.1 ---------- */
const trainerRole = n => n && n.role;
const teachesHere = n => !!(SF.SK.TRAINERS[trainerRole(n)] && !SHOPS[n.role] && !(n.life && n.life.doing === 'sleep'));
function trainerRows(n) {
  const gold = SF.count(P.pack, 'gold'), free = P.freeLessons > 0; let h = `<p class="note">I can teach these up to 30.0, at one gold for each tenth of a point. A lighter purse buys a shorter lesson. Skills on Hold or Lower cannot be taught.${free ? ` You still have ${P.freeLessons} free lesson${P.freeLessons > 1 ? 's' : ''} from before.` : ''}</p>`;
  for (const k of SF.SK.TRAINERS[trainerRole(n)] || []) {
    const s = P.skills[k], q = SF.SK.trainQuote(P, k, gold, free);
    h += `<div class="row"><span class="nm">${SF.SKILL[k].n} <span class="note">${f1(s.v)}${q.ok ? ' → ' + f1(q.to) : ''}</span>${q.ok ? '' : `<br><span class="note">${esc(q.reason)}</span>`}</span><span class="v">${q.ok ? (q.price ? q.price + ' gp' : 'free') : ''}</span>${q.ok ? btn('train', 'Learn', { k }) : ''}</div>`;
  }
  return h;
}
function trainerPanel() { const n = P.talkTo; if (!n || dist(n, P) > 4) return null; return [n.name, `<div class="note" style="text-align:right">${SF.count(P.pack, 'gold')} gold</div>` + trainerRows(n)]; }
/* natural attributes with their locks (src/stats.js). Effective values (spells, equipment) show beside when they differ. */
function statRowsHtml() { const b = SF.STATS.natural(P), L = P.statLocks || SF.STATS.newLocks(), sym = { raise: '▲', hold: '■', lower: '▼' };
  return SF.STATS.KEYS.map(k => { const eff = k === 'dex' ? P.dex + (P.eqDex || 0) : P[k]; const tip = SF.STATS.NAME[k] + ' is trained by ' + SF.STATS.trainedBy(k).join(', ');
    return `<span title="${esc(tip)}">${SF.STATS.NAME[k]}</span><span><button class="lk lk-${L[k]}" data-a="statlock" data-k="${k}" aria-label="${SF.STATS.NAME[k]} lock: ${L[k]} (tap to change)" title="${L[k]}">${sym[L[k]]}</button> ${b[k]}${eff !== b[k] ? ` <span class="note">(${eff} now)</span>` : ''}</span>`; }).join(''); }
const PANELS = {
  gear: () => { let h = `<div class="kv"><span>Title</span><span>${esc(SF.CREATION.title(P))}</span>${statRowsHtml()}<span>Attribute total</span><span>${SF.STATS.total(P)} / ${SF.STAT_CAP}</span><span>Health</span><span>${Math.floor(P.hp)} / ${SF.maxHp(P)}</span><span>Stamina</span><span>${Math.floor(P.stam)} / ${SF.maxStam(P)}</span><span>Mana</span><span>${Math.floor(P.mana)} / ${SF.maxMana(P)}</span><span>Armor rating</span><span>${armorVal()}</span><span>Carried</span><span>${fmtWt(carryWt())} / ${fmtWt(SF.carryCap(P))} · ${encumb().n}</span><span>Weapon</span><span>${wDef().fam} · ${wDef().dmg.join('–')} · reach ${wDef().reach} m · swing every ${SF.swingDelay(P.stam, wDef().speed).toFixed(2)} s</span><span>Bound shrine</span><span>${SHRINES.find(s => s.id === P.bound).n}</span><span>Skills</span><span>${f1(SF.totalSkill(P))} / 700.0</span></div><div class="sec">Equipped ${btn('eqwin', 'Paper doll (C)', {}, 'ac')}</div>`;
    for (const s of SF.EQ.SLOT_IDS) { const it = P.equip[s]; if (!it && !['weapon', 'shield', 'chest'].includes(s)) continue; h += `<div class="row"><span class="v" style="width:5.5em">${SF.EQ.SLOT[s].n}</span>${it ? rowIcon(it) : ''}<span class="nm">${it ? esc(iname(it)) : '<span class="note">empty</span>'}</span>${it && SF.WEARABLE(it.id) && it.cond !== undefined && it.cond < (it.maxc || 100) ? btn('repair', 'Repair', { u: it.uid }) : ''}${it && SF.ITEMS[it.id].trade ? btn('uneq', 'Remove', { s }) : ''}</div>`; }
    return ['Character', h + '<p class="note">Attributes grow as you use your skills (up to 100 each, 225 together). ▲ raise · ■ hold · ▼ lower: only a Raise attribute grows, and at 225 a gain takes a point from an attribute set to Lower.</p>']; },
  skills: () => skillsPanel(),
  spells: () => spellbookPanel(),
  abilities: () => ['Abilities', `<p class="note">Use now or put an action on a hotbar slot. Every skill with a use is here; the Skills page has the same Use buttons.</p>` + ABIL_LIST.filter(([id]) => ABIL[id] || ['hide', 'track', 'meditate'].includes(id)).map(([id, n]) => `<div class="row"><span class="nm">${n}${cdLeft(id) > 0 ? ` <span class="note">${Math.ceil(cdLeft(id))} s</span>` : ''}</span>${btn('abil', 'Use', { id })}${btn('assign', 'Slot', { k: 'act', id })}</div>`).join('')],
  snoop: () => { const e = SNOOP; if (!e || e.gone || dist(e, P) > SF.SK.STEAL.range + .5) { SNOOP = null; return null; } const pack = npcPack(e);
    return [`${cap1(e.name || (MON[e.type] || {}).n)}'s pack`, '<p class="note">You peek inside. Stealing an item takes a moment, and you may be noticed.</p>' + (pack.items.map(it => `<div class="row">${rowIcon(it)}<span class="nm">${esc(SF.itemName(it))}${it.qty > 1 ? ' ×' + it.qty : ''}</span><span class="v">${(SF.itemKg({ id: it.id, qty: 1 }) * SF.WU).toFixed(1)} wt</span>${SF.ITEMS[it.id].trade ? btn('stealit', 'Steal', { u: it.uid }) : ''}</div>`).join('') || '<p class="note">Empty.</p>')]; },
  track: () => { const n = sv('tracking'); let h = `<p class="note">Range about ${Math.round(SF.SK.trackRange(n))} m. Choose what to look for, then whose trail to follow.</p><div class="grid2">${Object.entries(SF.SK.TRACK_KINDS).map(([k, l]) => btn('trackk', l, { k }, TRACKUI && TRACKUI.kind === k ? 'ac' : '')).join('')}</div>`;
    if (TRACKUI) h += TRACKUI.list.filter(e => !e.gone).map((e, i) => `<div class="row"><span class="nm">${esc(cap1(e.name || (MON[e.type] || {}).n || 'someone'))}</span><span class="v">${Math.round(dist(e, P))} m</span>${btn('trackf', 'Follow', { i })}</div>`).join('');
    return ['Tracking', h]; },
  poison: () => { const pots = poisonPotions(), w = poisonableWeapon(), foods = P.pack.items.filter(i => SF.ITEMS[i.id].use === 'eat' && !i.poison);
    if (!pots.length) return ['Poisoning', '<p class="note">You have no poison potions. Alchemy makes them at a still (lesser, regular, greater, deadly).</p>'];
    let h = '<p class="note">Choose a poison and what to apply it to: a bladed or piercing weapon in hand, or food. The potion is used whether or not you succeed.</p>';
    for (const p of pots) { const lvl = SF.ITEMS[p.id].poisonLvl, win = SF.SK.POISON_WIN[lvl]; h += `<div class="sec">${esc(SF.ITEMS[p.id].n)} ×${p.qty} <span class="note">Poisoning ${win[0]}–${win[1]}</span></div><div class="row">`;
      h += w ? btn('poisonapply', 'On ' + esc(SF.itemName(w)), { u: p.uid, t: 'weapon' }) : '<span class="note">No bladed or piercing weapon in hand.</span>';
      for (const f of foods.slice(0, 4)) h += btn('poisonapply', 'On ' + esc(SF.ITEMS[f.id].n), { u: p.uid, t: f.uid }); h += '</div>'; }
    return ['Poisoning', h]; },
  assign: () => ['Choose a slot', `<p class="note">Assign ${esc(ASSIGN.k === 'spell' ? SF.SPELL[ASSIGN.id].n : ASSIGN.k === 'item' ? SF.ITEMS[ASSIGN.id].n : (ABIL[ASSIGN.id] ? ABIL[ASSIGN.id].n : ASSIGN.id))} to:</p><div class="grid2">${P.hotbar.map((_, i) => btn('setslot', 'Bar ' + (1 + Math.floor(i / 3)) + ' · ' + (i % 3 + 1) + ': ' + esc(slotLabel(P.hotbar[i])[0]), { i })).join('')}</div>`],
  loot: () => { const c = P.lootOpen; if (!c || c.gone) return null; const ls = c.cont && Number.isFinite(c.cont.diedAt) ? SF.lootStatus(c.cont, P.id, GT) : { label: '' }; let h = `<div class="note">${c.mine ? 'Your body · ' : ''}${ls.label ? esc(ls.label) + ' · ' : ''}${c.kind === 'chest' ? 'relocks' : 'crumbles'} in ${Math.ceil((c.expires - GT) / 60)} min · carrying ${carriedText()}</div>`;
    if (!c.cont.items.length) h += '<p class="note">Empty.</p>'; else h += btn('takeall', 'Take all', {}, 'ac');
    for (const it of c.cont.items) h += `<div class="row">${rowIcon(it)}<span class="nm">${esc(iname(it))}</span>${btn('take', 'Take', { u: it.uid })}${it.qty > 1 ? btn('take', 'Half', { u: it.uid, half: 1 }) : ''}</div>`;
    if (c.mon && !c.skinned) h += '<p>' + btn('skin', 'Carve the remains', {}) + '</p>';
    return [cap1(c.name), h]; },
  bank: () => { let h = `<div class="note">Bank storage is safe when you die. One account at every bank: the Quay, Mynoc, Vespar, Skara Bryn, Moonglen and the camp strongbox.</div>${btn('depgold', 'Deposit all gold', {}, 'ac')}<div class="sec">Bank (${SF.count(P.bank, 'gold')} gold)</div>`;
    if (!P.bank.items.length) h += '<p class="note">Empty.</p>'; for (const it of P.bank.items) h += `<div class="row">${rowIcon(it)}<span class="nm">${esc(iname(it))}</span>${btn('wd', 'Withdraw', { u: it.uid })}</div>`;
    h += '<div class="sec">Pack</div>'; for (const it of P.pack.items) if (SF.ITEMS[it.id].trade) h += `<div class="row">${rowIcon(it)}<span class="nm">${esc(iname(it))}</span>${btn('dep', 'Deposit', { u: it.uid })}</div>`;
    for (const s of SF.EQ.SLOT_IDS) { const it = P.equip[s]; if (it && SF.ITEMS[it.id].trade) h += `<div class="row">${rowIcon(it)}<span class="nm">${esc(iname(it))} <span class="note">worn</span></span>${btn('depeq', 'Deposit', { s })}</div>`; }
    return [P.talkTo ? P.talkTo.name : 'Bank', h]; },
  shop: () => { const n = P.talkTo; if (!n || dist(n, P) > 4) return null; const stock = SHOPS[n.role] || []; const tab = PTAB || 'buy'; let h = `<div class="tabs">${btn('tab', 'Buy', { t: 'buy' }, tab === 'buy' ? 'ac' : '')}${btn('tab', 'Sell', { t: 'sell' }, tab === 'sell' ? 'ac' : '')}${SF.SK.TRAINERS[n.role] ? btn('tab', 'Lessons', { t: 'learn' }, tab === 'learn' ? 'ac' : '') : ''}<span class="note" style="margin-left:auto">${SF.count(P.pack, 'gold')} gold</span></div>`;
    if (tab === 'learn') h += trainerRows(n);
    else if (tab === 'buy') for (const id of stock) { const p = SF.PRICES[id]; const st = SF.ITEMS[id].stack; h += `<div class="row">${rowIcon({ id })}<span class="nm">${esc(SF.itemName({ id, qty: 1 }))}</span><span class="v">${p} gp</span>${btn('buy', 'Buy', { id, n: 1 })}${st ? btn('buy', '×10', { id, n: 10 }) : ''}</div>`; }
    else for (const it of P.pack.items) { if (!SF.ITEMS[it.id].trade || it.id === 'gold') continue; const p = Math.max(1, Math.floor((SF.PRICES[it.id] || 1) * .4)); h += `<div class="row">${rowIcon(it)}<span class="nm">${esc(iname(it))}</span><span class="v">${p} gp ea</span>${btn('sell', 'Sell 1', { u: it.uid })}${it.qty > 1 ? btn('sell', 'All', { u: it.uid, all: 1 }) : ''}</div>`; }
    return [n.name, h]; },
  trainer: () => trainerPanel(),
  log: () => ['Combat and system log', LOG.slice(-150).reverse().map(l => `<div style="color:${l.c};padding:2px 0">${esc(l.t)}</div>`).join('')],
  picker: () => ['Which one?', PICK.map((e, i) => `<div class="row"><span class="nm">${esc(e.name)}</span><span class="v">${dist(e, P).toFixed(1)} m</span>${btn('pick', 'Select', { i })}</div>`).join('')],
  menu: () => ['Menu', `<div class="grid2">${btn('open', 'Abilities', { p: 'abilities' })}${btn('open', 'Log', { p: 'log' })}${btn('zoom', 'Zoom ×' + ZOOM)}${btn('mirror', SETTINGS.mirror ? 'Right-handed layout' : 'Left-handed layout')}${btn('sprintt', SETTINGS.stickSprint ? 'Stick sprint: on (push far)' : 'Stick sprint: off (button only)')}${btn('mute', muted ? 'Sound off' : 'Sound on')}${btn('music', SFXA.musicOn ? 'Music on' : 'Music off')}${btn('savenow', 'Save now')}${btn('open', 'How to play', { p: 'help' })}</div><p class="note" style="margin-top:12px">Shardfall web slice · offline M1. ${btn('wipe', 'Delete character', {}, 'on')}</p>`],
  quest: () => questPanel(), journal: () => journalPanel(),
  help: () => ['How to play', `<p><b>Move</b> with the floating stick on the left. Press <b>Sprint</b> to run faster; it drains 7 stamina a second and switches off when you run out. Tapping the world never moves you.</p><p><b>Target</b> by tapping a creature, person, corpse or resource, or press <b>Target</b> to cycle nearby creatures. Tap your portrait to target yourself.</p><p><b>Attack</b> arms your basic attack on the selected creature or person; with nothing selected it picks the nearest creature you can see (never a person). Enemy spells do the same. You swing whenever it is in reach and your weapon is ready. It never chases, picks targets, casts or loots for you. <b>Cancel</b> disarms and stops actions.</p><p><b>Combat</b> follows the Second Age rules: your weapon skill against the defender's sets the hit chance; Tactics, Anatomy and Strength set the damage; armor absorbs part of each blow; a shield parries with half your Parrying as a percent. Swing speed comes from the weapon and your current stamina. Bows and crossbows reload while you move, but you must stand still to aim, and the shot lands a second later.</p><p><b>First Aid</b>: the bandage slot treats you (15 s; poison 18 s). Tap an ally or a ghost and press <b>Bandage</b> to treat them (5 s; poison 6 s; resurrection 10 s at 80 Healing and Anatomy). Being hit makes your fingers slip and the bandage heal less. Wren, a sellsword by the plaza, will follow you if asked.</p><p><b>Spells</b>: tap a spell slot to prepare (stand still), it is then held for 3 s; tap a target or tap the slot again to release. Ground spells need a tap on the ground. Casting stows your weapon.</p><p><b>Interact</b> gathers, opens bodies and chests, disarms revealed snares, talks and uses stations in reach. Stairs in the Sunken Bell ruin and the north Ashfen hatch lead down three levels to the Bellkeeper.</p><p><b>Menu → Abilities</b> holds every skill you can use: Detect Hidden, Animal Taming, pet care, the bardic skills, Stealing, Poisoning and more. <b>Bar</b> cycles through three pages of three slots.</p><p><b>Law</b>: your name is blue while innocent, grey while a criminal and red as a murderer. Attacking an innocent townsperson (press Attack twice to confirm) or being caught stealing makes you a criminal for two minutes: witnesses shout for the guards, and guards fight criminals and murderers inside their town. Anyone who attacks you first may be fought back lawfully. Killing an innocent is reported as a murder; five murders within 40 hours of play make you red, and townsfolk will not deal with you. The dead leave a body with what they carried: taking from an innocent's body in its first 90 seconds is a crime too. Townsfolk who die are back home ten minutes later. Beware the outlaws of the Ashfen camp: a cutthroat who preys on lone travellers in the wild, and a cutpurse who robs the dead. Once they are grey or red, anyone may fight them.</p><p><b>Death</b> in the wilderness leaves tradeable gear on your body for 12 minutes. On protected roads you keep your gear. Walk to a shrine or healer, or wait 12 s to return to your bound shrine. Bank what you cannot afford to lose.</p><p><b>Crafting</b>: Interact at the forge, anvil, bench, still or fire. Pick a category, then a recipe: the detail shows every input, the metal, your odds and what a failure costs before you commit. Mining and Blacksmithy mentors stand by the public forge.</p><p><b>Skills</b> are the 49 of the Second Age. They rise from real use while the task is still a challenge for you, to 100 each and 700 in all; set one to Lower to make room at the cap. Your Strength, Dexterity and Intelligence grow with the skills that use them (225 in all). Townsfolk teach their trades up to 30 for a gold piece a tenth.</p><p class="note">Keyboard: WASD/arrows move, Shift sprints, Space attack, E interact, B bandage self, 1–3 current bar slots, Tab target, Esc cancel.</p>`] };
let PICK = [];
function uiOpen(k) { openPanel(k); snd('ui.open'); }   // deliberate panel changes only, never on re-render

/* ---------- actions ---------- */
const findU = (c, u) => c.items.find(it => it.uid === +u);
const ACT = {
  bagsort: d => { bagSort = d.s; renderPanel(); },
  baginspect: d => { bagUid = bagUid === d.u ? null : d.u; renderPanel(); },
  close: () => { closePanel(); snd('ui.close'); }, open: d => uiOpen(d.p), bag: () => uiOpen('bag'), gear: () => uiOpen('gear'), skills: () => uiOpen('skills'), spells: () => uiOpen('spells'), menu: () => uiOpen('menu'), logp: () => uiOpen('log'),
  hudmenu: () => { openScreen('menu'); snd('ui.open'); }, map: () => { openScreen('map'); snd('ui.open'); }, scrclose: () => { closeScreen(); snd('ui.close'); }, mapfit: () => { mapFit(); drawMap(); }, mapall: () => { mapFit(true); drawMap(); }, journal: () => { closeScreen(); uiOpen('journal'); },
  mgo: d => { closeScreen(); ACT[d.p](); },
  qaccept: () => { if (Q().beacon !== 0) return; Q().beacon = 1; snd('quest.accept'); SF.addItem(P.pack, SF.newItem('wick', 1)); log('Quest accepted: A Light for the Quay. You receive a dry wick.', '#ffe08a'); say(P.talkTo || QW(), 'Lantern Road, north. Stick to the road.'); closePanel(); save(); },
  qwick: () => { if (Q().beacon !== 1 || hasWick()) return; SF.addItem(P.pack, SF.newItem('wick', 1)); log('The Quaywarden hands you another wick.', '#ffe08a'); closePanel(); save(); },
  qturn: () => { if (Q().beacon !== 2) return; Q().beacon = 3; snd('quest.complete'); SF.addItem(P.pack, SF.newItem('bandage', 5)); SF.addItem(P.pack, SF.newItem('gold', 40)); log('Quest complete: A Light for the Quay. +5 bandages, +40 gold.', '#7ee08a'); log('Brine Road runs east to the gate. Past the gate pillars, full-loot wilderness rules begin.', '#ffb070'); closePanel(); save(); },
  atk: toggleArm, interact, bandother: () => firstAidOther(), allycmd: d => allyCommand(d.c),
  pool: d => { const n = SF.assignPool(P, d.k, 10); if (n) { log(`${SF.SKILL[d.k].n} +${f1(n)} from the skill reform (${f1(P.skillPool)} left).`, '#7fd4ff'); save(); } else log('That skill or your total is at its cap.', '#ffb070'); renderPanel(); }, cancel: () => { P.armed = false; if (P.prep || P.held) cancelCast(); AIM = null; if (PICKT) { PICKT = null; log("Targeting cancelled."); } P.batch = null; if (P.task) { log(P.task.label + ' cancelled.'); P.task = null; } P.meditating = null; },
  cycle: () => { const L = ents.filter(e => e.kind === 'mon' && alive(e) && dist(e, P) < 16 && los(P, e)).sort((a, b) => dist(a, P) - dist(b, P)); if (!L.length) return log('No creatures in sight.'); const i = L.indexOf(P.sel); P.sel = L[(i + 1) % L.length]; },
  slot: d => useSlot(+d.i + (P.hbPage || 0) * 3), page: () => { P.hbPage = ((P.hbPage || 0) + 1) % 3; },
  abil: d => { useAbility(d.id); },
  trackk: d => trackStart(d.k), trackf: d => { const e = TRACKUI && TRACKUI.list[+d.i]; if (e) trackFollow(e); },
  poisonapply: d => poisonApply(+d.u, d.t),
  stealit: d => { const e = SNOOP; if (!e) return; const it = npcPack(e).items.find(i => i.uid === +d.u); if (it) stealStart(e, it); },
  skitem: d => itemSkill(d.k, +d.u), petcmd: d => petCommand(d.c), appraise: d => { const it = findU(P.pack, d.u); if (!it) return; closePanel(); P.task = { kind: 'appraise', item: it, label: 'Appraising', t0: GT, t1: GT + SF.APPRAISE_TIME, still: true, x0: P.x, y0: P.y }; },
  repair: d => { const it = findU(P.pack, d.u) || Object.values(P.equip).find(e => e && e.uid === +d.u); if (!it) return; const k = SF.repairSkill(it.id); const st = nearestStation(k === 'blacksmithy' ? ['anvil', 'forge'] : ['bench']); if (!st) return log(k === 'blacksmithy' ? 'Repair metal at the smithy anvil.' : 'Repair this at a workbench.', '#ffb070'); if (!SF.count(P.pack, 'repairkit')) return log('You need a repair kit.', '#ffb070'); const rp = SF.repairPlan(it); if (!rp.ok) return log(cap1(rp.reason), '#ffb070'); P.task = { kind: 'repair', item: it, label: 'Repairing', t0: GT, t1: GT + SF.CRAFT_TIME, still: true, x0: P.x, y0: P.y }; }, self: () => { P.sel = P; if (P.held && SF.SPELL[P.held.sp.id].t === 'ally') releaseHeld(P); },
  desel: () => { P.sel = null; P.armed = false; }, report: () => { lawReport(); refreshHud(); }, ghostret: () => { if (GT - P.ghostAt >= 12) { const s = SHRINES.find(z => z.id === P.bound); resurrect({ x: s.x + .5, y: s.y + .5 }); } },
  equip: d => { equipUid(d.u, d.slot); renderPanel(); },
  uneq: d => { unequipTo(d.s); renderPanel(); }, useitem: d => { const def = SF.ITEMS[d.id]; if (d.id === 'bandage') firstAid(P); else if (def.use === 'eat') eat(d.id); else useConsumable(d.id); renderPanel(); },
  drop: d => { const r = SF.EQ.dropItem(P, { uid: d.u, qty: d.q ? +d.q : undefined }, it => { dropPile(it); return true; }); if (!r.ok) log(cap1(r.reason) + '.', '#ffb070'); else { if (r.from !== 'pack' && r.from === 'weapon') weaponChanged(); snd('loot.rummage'); bagUid = null; eqChanged(); } renderPanel(); },
  assign: d => { ASSIGN = { k: d.k, id: d.id }; openPanel('assign'); }, setslot: d => { P.hotbar[+d.i] = ASSIGN; closePanel(); },
  lock: d => { const s = P.skills[d.k]; s.lock = s.lock === 'raise' ? 'hold' : s.lock === 'hold' ? 'lower' : 'raise'; renderPanel(); },
  cast: d => { closePanel(); castSlot(d.s); },
  take: d => { const c = P.lootOpen; if (!c || dist(c, P) > 2) return log('Move within 2 m.'); const it = findU(c.cont, d.u); if (!it) return; const r = SF.EQ.pickupItem(P, c.cont, { uid: it.uid, qty: d.half ? Math.ceil(it.qty / 2) : it.qty }); if (!r.ok) log(r.reason, '#ffb070'); else { if (it.id === 'gold') snd('loot.coin'); npcdLooted(c, P); /* a person's body: robbing an innocent inside its loot-rights window is a crime (src/npcdeath.js) */ } renderPanel(); if (c.mine || c.pile || c.kind === 'chest') save(); },
  takeall: () => { const c = P.lootOpen; if (!c || dist(c, P) > 2) return; let n = 0, gold = 0; for (const it of c.cont.items.slice()) { const r = SF.EQ.pickupItem(P, c.cont, { uid: it.uid, qty: it.qty }); if (r.ok) { n++; if (it.id === 'gold') gold++; } else { log('Stopped: ' + r.reason, '#ffb070'); break; } } if (n) { snd(gold ? 'loot.coin' : 'loot.rummage'); npcdLooted(c, P); } /* one cue for the whole transfer; Take all is looting too (v0.39) */ renderPanel(); if (c.mine) save(); },
  skin: () => { const c = P.lootOpen || P.sel; if (c && c.mon && dist(c, P) <= 2) skin(c); else log('Stand by the remains.'); },
  depgold: () => { let g = 0; for (const it of P.pack.items.filter(i => i.id === 'gold')) if (SF.transfer(P.pack, P.bank, it.uid, it.qty).ok) g++; if (g) snd('loot.coin'); save(); renderPanel(); },
  dep: d => { const it = findU(P.pack, d.u); if (it) SF.transfer(P.pack, P.bank, it.uid, it.qty); save(); renderPanel(); },
  depeq: d => { const r = SF.EQ.unequipItem(P, { slot: d.s }); if (!r.ok) return; SF.transfer(P.pack, P.bank, r.uid); if (d.s === 'weapon') weaponChanged(); save(); renderPanel(); },
  wd: d => { const it = findU(P.bank, d.u); if (!it) return; const r = SF.transfer(P.bank, P.pack, it.uid, it.qty, { cap: cap() }); if (!r.ok) log(r.reason, '#ffb070'); save(); renderPanel(); },
  tab: d => { PTAB = d.t; renderPanel(true); snd('ui.page'); },
  buy: d => { const p = SF.PRICES[d.id] * +d.n; if (SF.count(P.pack, 'gold') < p) return log('Not enough gold.', '#ffb070'); const it = SF.EQ.isGear(d.id) || (SF.WEARABLE(d.id) && !SF.ITEMS[d.id].stack) ? SF.EQ.make(d.id, { origin: 'npc' }) : SF.newItem(d.id, +d.n, SF.ITEMS[d.id].stack ? null : { cond: 100 }); const r = SF.addItem(P.pack, it, cap()); if (!r.ok) return log(r.reason, '#ffb070'); SF.removeQty(P.pack, 'gold', p); snd('loot.coin'); renderPanel(); },
  statlock: d => { const k = d.k; if (!SF.STATS.KEYS.includes(k)) return; const cur = (P.statLocks || SF.STATS.newLocks())[k]; SF.STATS.setLock(P, k, SF.STATS.cycleLock(cur)); save(); eqChanged(); renderPanel(); },
  sell: d => { const it = findU(P.pack, d.u); if (!it) return; if (it.starter) return log('Merchants do not buy back starter gear.', '#ffb070'); const n = d.all ? it.qty : 1, g = Math.max(1, Math.floor((SF.PRICES[it.id] || 1) * .4 * (SF.WORK_TOOLS[it.id] && !SF.ITEMS[it.id].stack ? SF.toolUses(it) / SF.TOOL_USES : 1))) * n; it.qty -= n; if (it.qty <= 0) P.pack.items.splice(P.pack.items.indexOf(it), 1); P.pack.ver++; SF.addItem(P.pack, SF.newItem('gold', g)); snd('loot.coin'); renderPanel(); },
  train: d => { const n = P.talkTo; if (!n || dist(n, P) > 4 || !(SF.SK.TRAINERS[trainerRole(n)] || []).includes(d.k)) return log('Speak to a teacher of that skill.', '#ffb070');
    const free = P.freeLessons > 0, q = SF.SK.train(P, d.k, SF.count(P.pack, 'gold'), free); if (!q.ok) return log(q.reason, '#ffb070');
    if (q.price) SF.removeQty(P.pack, 'gold', q.price); else P.freeLessons--;
    say(n, q.full ? 'That is all I can teach thee.' : 'That is all thy gold will buy.'); log(`${n.name.split(',')[0]} teaches you ${SF.SKILL[d.k].n}: ${f1(q.to - q.tenths)} → ${f1(q.to)}${q.price ? ' for ' + q.price + ' gold' : ' (a free lesson)'}.`, '#7fd4ff'); snd('loot.coin'); save(); renderPanel(); },
  skgrp: d => { SKUI.closed[d.g] = !SKUI.closed[d.g]; renderPanel(); },
  skview: () => { SKUI.real = !SKUI.real; renderPanel(); },
  skuse: d => { const id = SKILL_ABIL[d.k]; if (!id) return; closePanel(); useAbility(id); },
  craft: d => { startCraft(d.r, +(d.n || 1)); },
  pick: d => { P.sel = PICK[+d.i]; closePanel(); },
  petatk: () => petCommand('attack'),
  zoom: () => { ZOOM = ZOOMS[(ZOOMS.indexOf(ZOOM) + 1) % ZOOMS.length]; resize(); renderPanel(); }, mirror: () => { SETTINGS.mirror = !SETTINGS.mirror; document.body.classList.toggle('mirror', SETTINGS.mirror); saveSettings(); renderPanel(); },
  sprintt: () => { SETTINGS.stickSprint = !SETTINGS.stickSprint; saveSettings(); renderPanel(); }, sprint: () => { if (P.ghost) return; if (!P.sprintOn && P.stam < 5) return log('Too tired to sprint.', '#ffb070'); P.sprintOn = !P.sprintOn; }, mute: () => { muted = !muted; SETTINGS.muted = muted; saveSettings(); SFXA.setMuted(muted); renderPanel(); }, music: () => { SFXA.musicOn = !SFXA.musicOn; SETTINGS.music = SFXA.musicOn; saveSettings(); renderPanel(); }, savenow: () => { log(save() ? 'Saved.' : 'Save failed. Check browser storage.'); },
  wipe: () => { const el = $('#panel .pb'); if (!el.querySelector('[data-a=wipe2]')) el.insertAdjacentHTML('beforeend', '<p>Delete this character for good? ' + btn('wipe2', 'Yes, delete', {}, 'on') + '</p>'); }, wipe2: () => { try { localStorage.removeItem(SAVEKEY); deletingSave = true; } catch (e) { return log('Could not delete the saved character.'); } location.reload(); },
  rotok: () => { $('#rot').hidden = true; ROTOK = true; },
  saveretry: () => { saveFailShown = false; if (!save() && !saveLocked) log('Still not saved: browser storage is full or blocked.', '#ff6a5a'); }, saveexport: () => saveExportNow() };
let ROTOK = false;
/* counter actions re-check the live situation, not just that a button was drawn: alive, the right panel still open, the same
   keeper still there and within reach, and for a purchase a whole quantity of something this keeper sells. */
const COUNTER_ACT = { depgold: 'bank', dep: 'bank', depeq: 'bank', wd: 'bank', buy: 'shop', sell: 'shop', train: 'trainer' };
function atCounter(kind) { const n = P && P.talkTo; if (!n || !P || P.ghost || PANEL !== kind || n.gone || dist(n, P) > 4) return false;
  return kind === 'bank' ? !!MERCHANT_ROLES[n.role] : kind === 'trainer' ? n.role === 'trainer' : !!SHOPS[n.role]; }
for (const k in COUNTER_ACT) { const fn = ACT[k]; ACT[k] = d => { d = d || {};
  if (!atCounter(COUNTER_ACT[k])) { log('You are no longer at the counter.', '#ffb070'); closePanel(); return; }
  if (k === 'buy' && (!SF.validQty(+d.n) || !(SHOPS[P.talkTo.role] || []).includes(d.id))) return log('That is not for sale here.', '#ffb070');
  return fn(d); }; }

/* ================= THE QUAY TRADES (crafting guide build step 1): nodes, survey, crafting preview, Dena and Mara ================= */
/* ---------- Quay training nodes: permanent common locations in the protected Quay ---------- */
const QUAY_ROCKS = [[74, 281], [77, 281], [74, 284], [77, 284]];
const QUAY_TREES = [[106, 281], [109, 281], [106, 284], [109, 284]];
const QUAY_NODE = new Set();
function placeQuayNodes() {
  for (const [x, y] of QUAY_ROCKS) { tSet(x, y, T.RK); QUAY_NODE.add(y * W + x); }
  for (const [x, y] of QUAY_TREES) { tSet(x, y, T.TR); QUAY_NODE.add(y * W + x); }
}
const isQuayNode = (x, y) => QUAY_NODE.has(y * W + x);
const anvilHasForge = a => STATIONS.some(s => s.k === 'forge' && Math.hypot(s.x - a.x, s.y - a.y) <= 2.01);
/* the station a recipe needs, in reach; null with a reason otherwise */
function craftStation(r) {
  if (r.station === 'any') { if (r.insc) { const sp = SF.MAGERY.SPELL[r.insc]; if (!SF.MAGERY.bookSpells(P.pack).has(r.insc)) return { st: null, why: 'That spell is not in your spellbook.', short: 'not in your book' }; if (P.mana < sp.mp) return { st: null, why: `You need ${sp.mp} mana to scribe it.`, short: sp.mp + ' mana' }; } return { st: { k: 'any', x: Math.floor(P.x), y: Math.floor(P.y) } }; }
  if (r.station === 'anvil') { const a = nearestStation(['anvil']); if (!a) return { st: null, why: 'Move next to an anvil.' }; if (!anvilHasForge(a)) return { st: null, why: 'This anvil needs a forge burning within 2 m.' }; return { st: a }; }
  const s = nearestStation([r.station]); return s ? { st: s } : { st: null, why: 'Move next to the ' + ({ forge: 'forge', bench: 'workbench', still: 'alchemy still', fire: 'cooking fire' }[r.station] || r.station) + '.' };
}
const QUAY_ANVIL = () => STATIONS.find(s => s.k === 'anvil');
const QUAY_FORGE = () => STATIONS.find(s => s.k === 'forge');

/* ---------- node generations (§3): one specialty per generation, stock and refill from the region table ---------- */
function nodeRegion(x, y) { return SF.REGIONS[nodeTier(x, y)]; }
function newNode(x, y, kind, gen) {
  if (kind === 'mining' || kind === 'lumberjacking') { const reg = nodeRegion(x, y); const tab = kind === 'mining' ? reg.ore : reg.wood; return { gen, n: reg.stock, max: reg.stock, t: 0, spec: SF.rollTable(tab, R) }; }
  const n = 6 + (hash(x, y) % 6); return { gen, n, max: n, t: 0 };
}
function nodeStock(x, y) {
  const k = y * W + x; let o = RES.get(k);
  if (o && o.n <= 0 && GT > o.t) { o = newNode(x, y, NODE[tAt(x, y)], (o.gen || 0) + 1); RES.set(k, o); }
  if (!o) { o = newNode(x, y, NODE[tAt(x, y)], 1); RES.set(k, o); }
  return o;
}
const surveyOf = (x, y) => { const s = P.cx.survey[y * W + x], o = RES.get(y * W + x); return s && o && s.gen === o.gen ? s : null; };
function nodeLabel(n) {
  if (n.skill !== 'mining' && n.skill !== 'lumberjacking') return n.name;
  const sv0 = surveyOf(n.x, n.y); const seam = n.skill === 'mining';
  if (!sv0) return seam ? 'rock face' : 'tree';
  if (!sv0.id) return seam ? 'unidentified seam' : 'unfamiliar grain';
  return seam ? SF.METAL[sv0.id].n + ' seam' : SF.WOOD[sv0.id].short + ' tree';
}
function nodeNote(n) {
  const st = nodeStock(n.x, n.y), sv0 = surveyOf(n.x, n.y);
  return (sv0 ? `${st.n}/${st.max} strokes` : SF.stockLabel(st.n, st.max)) + (st.n <= 0 ? ` · refills in ${Math.max(1, Math.ceil((st.t - GT) / 60))} min` : '');
}
/* tool or a guild loan at the marked Quay faces */
/* a work tool in the pack or in your hand (a hatchet can be wielded and still chop) */
function findTool(id) { const it = SF.findTool(P.pack, id); if (it) return it; const w = P.equip.weapon; return w && w.id === id && SF.toolUses(w) > 0 ? w : null; }
function spendTool(it) { if (P.equip.weapon === it) { it.uses = SF.toolUses(it) - 1; if (it.uses <= 0) { P.equip.weapon = null; weaponChanged(); return true; } return false; } return SF.spendTool(P.pack, it); }
function gatherTool(n) {
  const id = { lumberjacking: 'hatchet', mining: 'pickaxe', fishing: 'rod' }[n.skill]; if (!id) return { ok: true };
  const it = findTool(id); if (it) return { ok: true, it, id };
  if (n.skill === 'mining' && isQuayNode(n.x, n.y) && pickLoan()) return { ok: true, loan: 'Dena\'s pick', id };
  return { ok: false, id };
}
const pickLoan = () => gq('M1').s === 'active' || gq('S1').s === 'active';
const tongsLoan = st => gq('S1').s === 'active' && st && st === QUAY_ANVIL();

/* one resolved stroke at a rock face or tree */
function finishStroke(n) {
  const sk = n.skill, tier = nodeTier(n.x, n.y), diff = SF.NODE_TIER_DIFF[tier], st = nodeStock(n.x, n.y), nm = nodeLabel(n);
  if (st.n <= 0) return log('This ' + nm + ' is exhausted for now.');
  const tl = gatherTool(n); if (!tl.ok) return log('You need a ' + SF.ITEMS[tl.id].n.toLowerCase() + '.', '#ffb070');
  const s = sv(sk), hch = SF.opposed(s, diff), hit = R() < hch;
  let win = SF.SK.HARVEST.common;
  if (hit) {
    const mat = SF.strokeMaterial(sk, st.spec, s, R), id = sk === 'mining' ? SF.oreId(mat) : SF.logId(mat), q = SF.STROKE_YIELD[sk];
    const add = SF.addItem(P.pack, SF.newItem(id, q), cap());
    if (!add.ok) { log(`No room for ${q} ${SF.ITEMS[id].n.toLowerCase()}: ${add.reason}. Nothing was taken.`, '#ffb070'); return; }   // commit nothing
    if (mat !== SF.commonOf(sk)) win = SF.SK.HARVEST.rare(SF.gateFor(sk, mat));   // a coloured ore or rare wood teaches from its gate − 40
    st.n--; if (st.n <= 0) st.t = GT + nodeRegion(n.x, n.y).refill;
    log(`You ${sk === 'mining' ? 'break loose' : 'fell'} ${q} ${SF.ITEMS[id].n.toLowerCase()}${mat !== SF.commonOf(sk) ? '!' : '.'}`, mat !== SF.commonOf(sk) ? '#ffe08a' : undefined);
    if (sk === 'mining' && R() < .12) { const r2 = SF.addItem(P.pack, SF.newItem('ironshard', 2), cap()); if (r2.ok) log('Two iron shards come away with it.'); else log('Two iron shards fell away: no room.', '#a8a8a8'); }
    questEvent({ type: 'harvest', skill: sk, mat, qty: q, quay: isQuayNode(n.x, n.y) }); simEmit('ResourceGathered', { actor: aidOf(P), skill: sk, item: id, qty: q, node: n.y * W + n.x, x: n.x, y: n.y });
  } else log({ lumberjacking: 'You chop but get nothing usable.', mining: 'You break loose rock but no ore.' }[sk]);
  sndAt(sk === 'mining' ? 'gather.mine' : 'gather.chop', { x: n.x + .5, y: n.y + .5 }); skillUse(sk, hch, hit, null, win);
  if (tl.it && spendTool(tl.it)) log('Your ' + SF.ITEMS[tl.id].n.toLowerCase() + ' breaks.', '#ff6a5a');
  if (st.n <= 0) { log('The ' + nm + ' is exhausted.'); return; }
  at(.15, () => { if (!P.task && !P.ghost && P.sel === n && Math.hypot(n.x + .5 - P.x, n.y + .5 - P.y) <= 2 && !overweight() && P.speed < .1) startGather(n); });
}
/* survey / read the grain: 2 s, needs the tool, no cost, no skill gain */
function startSurvey(n) {
  if (P.ghost || !n || (n.skill !== 'mining' && n.skill !== 'lumberjacking')) return;
  if (Math.hypot(n.x + .5 - P.x, n.y + .5 - P.y) > 2) return log('Move within 2 m.');
  const tl = gatherTool(n); if (!tl.ok) return log('Surveying needs a ' + SF.ITEMS[tl.id].n.toLowerCase() + '.', '#ffb070');
  const tier = nodeTier(n.x, n.y); if (sv(n.skill) < SF.NODE_TIER_MIN[tier]) return log(`This ground needs ${SF.SKILL[n.skill].n} ${SF.NODE_TIER_MIN[tier]}.`, '#ffb070');
  if (nodeStock(n.x, n.y).n <= 0) return log('Nothing left to read here until it refills.');
  P.task = { kind: 'survey', node: n, label: n.skill === 'mining' ? 'Surveying' : 'Reading the grain', t0: GT, t1: GT + 2, still: true, x0: P.x, y0: P.y }; faceToward(P, n.x + .5, n.y + .5);
}
TASKS.survey = t => {
  const n = t.node, st = nodeStock(n.x, n.y), k = n.y * W + n.x, gateOk = sv(n.skill) >= SF.gateFor(n.skill, st.spec);
  P.cx.survey[k] = { gen: st.gen, id: gateOk ? st.spec : null };
  const nm = nodeLabel(n); if (gateOk) P.cx.vein = { x: n.x, y: n.y, n: cap1(nm) };
  log(gateOk ? `${cap1(nm)}: ${st.n} of ${st.max} strokes left.` : `An ${nm}: ${st.n} of ${st.max} strokes left. You cannot yet tell what it holds.`, '#e8d8b0');
  questEvent({ type: 'survey', skill: n.skill, key: k, gen: st.gen, tier: nodeTier(n.x, n.y) });
};

/* ---------- guild quests (§8): a sibling dictionary beside quest.beacon ---------- */
const GUILDS = [
  { k: 'mining', n: 'Mining', npc: 'assay', who: 'Dena, assaymaster', buys: 'Buys named ore and ingots, and pays for prospecting.', q: ['M1'] },
  { k: 'smithing', n: 'Blacksmithing', npc: 'qsmith', who: 'Mara, quay smith', buys: 'Buys fittings and arms, and orders repairs.', q: ['S1'] },
  { k: 'woodworking', n: 'Woodworking', who: 'Elin, timber scaler', buys: 'Buys boards, handles and seasoned stock.', later: true },
  { k: 'carpentry', n: 'Carpentry', who: 'Oren, joiner', buys: 'Buys furniture, shields and building kits.', later: true }];
const GQD = {
  M1: { id: 'M1', guild: 'mining', npc: 'assay', skill: 'mining', min: 0, n: 'A Vein by the Water',
    say: '“That dark line above the tide is iron. Bring up enough for one bar.”',
    steps: [
      { t: 'Mine 3 iron ore at a marked Quay face (Dena lends a pick there)', short: 'Mine iron ore at the marked faces', need: 3, ev: e => e.type === 'harvest' && e.skill === 'mining' && e.mat === 'iron' && e.quay ? e.qty : 0, at: () => markedFace() },
      { t: 'Smelt 1 iron bar at the public forge', short: 'Smelt an iron bar', need: 1, ev: e => e.type === 'smelt' && e.mat === 'iron' ? e.qty : 0, at: () => QUAY_FORGE() },
      { t: 'Show Dena an iron bar (you keep it)', short: 'Show Dena your bar', show: () => SF.count(P.pack, 'ironbar') >= 1, at: () => npcBy('assay') }],
    reward: { gold: 12, pins: ['quarry', 'forge'] }, done: '“Good clean bar. Keep it — the first one is always yours. Mara pays for rivets, if you want to see it worked.”',
    next: 'A Map That Pays (Mining 30) opens in a later build.' },
  S1: { id: 'S1', guild: 'smithing', npc: 'qsmith', skill: 'blacksmithy', min: 0, n: 'Holdfast',
    say: '“The next tide will pull that ring out. I need four good iron rivets.”',
    steps: [
      { t: 'Get 1 iron bar: Harl sells them, or mine 3 ore at a marked Quay face and smelt it', short: 'Get an iron bar', have: () => SF.count(P.pack, 'ironbar') >= 1, at: () => SF.count(P.pack, 'ore') >= 3 ? QUAY_FORGE() : markedFace() },
      { t: 'Forge 8 iron rivets at the anvil (Mara lends tongs there)', short: 'Forge iron rivets', need: 8, ev: e => e.type === 'make' && e.out === 'rivet' && e.mat === 'iron' ? e.qty : 0, at: () => QUAY_ANVIL() },
      { t: 'Give Mara 4 iron rivets (keep the other four)', short: 'Give Mara 4 rivets', deliver: { id: 'rivet', mat: 'iron', n: 4 }, at: () => npcBy('qsmith') }],
    reward: { gold: 15, pins: ['anvil'], ledger: true }, done: '“That will hold. Keep the other four — a carpenter will want them for hinges. Here is my supply ledger.”',
    next: 'An Edge for Brine Road (Blacksmithy 20) opens in a later build.' } };
function gqAll() { const q = Q(); return q.guild || (q.guild = {}); }
function gq(id) { const g = gqAll(); return g[id] || { s: 'none' }; }
const npcBy = role => ents.find(e => e.kind === 'npc' && e.role === role);
const markedFace = () => { const [x, y] = QUAY_ROCKS[1]; return { x, y }; };
/* step completion. Counter steps observe committed actions after acceptance. */
function stepDone(d, q, i) {
  const s = d.steps[i];
  if (s.need) return (q.p[i] || 0) >= s.need;
  if (s.have) return s.have() || d.steps.slice(i + 1).some((s2, j) => s2.need && (q.p[i + 1 + j] || 0) > 0);
  if (s.show) return s.show();
  if (s.deliver) return SF.countMat(P.pack, s.deliver.id, s.deliver.mat) >= s.deliver.n;
  return false;
}
function gqStep(id) { const d = GQD[id], q = gq(id); if (q.s !== 'active') return -1; for (let i = 0; i < d.steps.length; i++) if (!stepDone(d, q, i)) return i; return d.steps.length; }
const gqReady = id => gq(id).s === 'active' && gqStep(id) >= GQD[id].steps.length;
function questEvent(e) {
  P.cx.eid = (P.cx.eid || 0) + 1; e.eid = P.cx.eid;
  for (const id in GQD) { const q = gq(id); if (q.s !== 'active') continue; const d = GQD[id]; let moved = false;
    d.steps.forEach((s, i) => { if (!s.ev) return; const add = s.ev(e); if (!add) return; const before = q.p[i] || 0; q.p[i] = Math.min(s.need, before + add); if (q.p[i] !== before) { moved = true; if (q.p[i] >= s.need && before < s.need) log(`${d.n}: ${s.t.replace(/ \(.*\)$/, '')} — done.`, '#ffe08a'); } });
    if (moved && gqReady(id)) log(`${d.n}: return to ${GUILDS.find(g => g.k === d.guild).who.split(',')[0]}.`, '#ffe08a'); }
}
function gqAccept(id) {
  const d = GQD[id]; if (gq(id).s !== 'none') return; if (sv(d.skill) < d.min) return log(`Needs ${SF.SKILL[d.skill].n} ${d.min}.`, '#ffb070');
  gqAll()[id] = { s: 'active', p: [], at: GT }; P.cx.track = id; snd('quest.accept');
  log(`Quest accepted: ${d.n}.`, '#ffe08a'); if (id === 'M1' || id === 'S1') log('You may use the guild pick at the marked Quay faces' + (id === 'S1' ? ', and Mara\'s tongs at her anvil.' : '.'), '#b6a68a');
  save(); renderPanel(true);
}
function gqClaim(id) {
  const d = GQD[id], q = gq(id); if (q.s !== 'active' || !gqReady(id)) return;
  for (const s of d.steps) if (s.deliver && !SF.removeMat(P.pack, s.deliver.id, s.deliver.mat, s.deliver.n)) return log('You no longer have what she asked for.', '#ffb070');
  q.s = 'done'; q.doneAt = GT; q.pending = d.reward.gold;     // mark complete before paying: one reward only
  for (const p of d.reward.pins || []) addPin(p);
  if (d.reward.ledger) P.cx.ledger = true;
  if (P.cx.track === id) P.cx.track = null;
  log(`Quest complete: ${d.n}. +${d.reward.gold} gold.`, '#7ee08a'); snd('quest.complete'); payPending(id, true); save(); renderPanel(true);
}
function payPending(id, quiet) { const q = gq(id); if (!q.pending) return; const r = SF.addItem(P.pack, SF.newItem('gold', q.pending), cap()); if (r.ok) { q.pending = 0; if (!quiet) snd('loot.coin'); } else log('Your pack is full. Collect the reward from the mentor when you have room.', '#ffb070'); }
const PIN_AT = { quarry: () => ({ n: 'Quay quarry', x: 75.5, y: 282.5 }), forge: () => ({ n: 'Public forge', x: QUAY_FORGE().x, y: QUAY_FORGE().y }), anvil: () => ({ n: 'Mara\'s anvil', x: QUAY_ANVIL().x, y: QUAY_ANVIL().y }) };
function addPin(k) { P.cx.pins = P.cx.pins || []; if (!P.cx.pins.some(p => p.k === k)) { const o = PIN_AT[k](); P.cx.pins.push({ k, n: o.n, x: o.x, y: o.y }); } }
/* the tracked objective drives the HUD chip, map marker and the guide arrow */
function guildObjective() {
  const id = P.cx && P.cx.track; if (!id || !GQD[id]) return null; const d = GQD[id], q = gq(id);
  if (q.s === 'none') { const n = npcBy(d.npc); return { t: `Speak to ${n ? n.name.split(',')[0] : 'the mentor'}`, at: n, id }; }
  if (q.s !== 'active') return null;
  const i = gqStep(id); if (i >= d.steps.length) { const n = npcBy(d.npc); return { t: `Return to ${n.name.split(',')[0]}`, at: n, id }; }
  const s = d.steps[i]; return { t: s.short + (s.need ? ` · ${Math.min(q.p[i] || 0, s.need)}/${s.need}` : ''), at: s.at(), id };
}
function guildPanel() {
  const n = P.talkTo; if (!n || dist(n, P) > 4) return null; const G = GUILDS.find(g => g.npc === n.role); let h = `<p class="note">${esc(G.buys)}</p>`;
  for (const id of G.q) { const d = GQD[id], q = gq(id);
    h += `<div class="sec">${esc(d.n)} <span class="note">· ${SF.SKILL[d.skill].n} ${d.min}</span></div>`;
    if (q.s === 'none') { h += `<p>${d.say}</p>`; h += sv(d.skill) >= d.min ? `<div class="row">${btn('gqacc', 'Accept: ' + d.n, { q: id }, 'ac')}</div>` : `<p class="note">Come back at ${SF.SKILL[d.skill].n} ${d.min}.</p>`; }
    else if (q.s === 'active') { h += stepList(id); h += gqReady(id) ? `<div class="row">${btn('gqclaim', d.steps.some(s => s.deliver) ? 'Hand over and claim' : 'Show and claim', { q: id }, 'ac')}</div>` : `<p class="note">${esc(npcTip(id))}</p>`; }
    else { h += `<p>${d.done}</p>`; if (q.pending) h += `<div class="row">${btn('gqpay', 'Collect ' + q.pending + ' gold', { q: id }, 'ac')}</div>`; h += `<p class="note">${esc(d.next)}</p>`; } }
  if (n.role === 'qsmith' && P.cx.ledger) h += ledgerHtml();
  return [n.name, h];
}
function npcTip(id) {
  if (id === 'M1') return findTool('pickaxe') ? 'The marked faces are just west of here.' : 'No pick? Use mine at the marked faces just west of here.';
  if (id === 'S1') { const i = gqStep(id); return i === 0 ? '“Harl sells bars for 16 gold, or Dena will show you the quarry.”' : i === 1 ? '“Stand between the forge and my anvil. Mind your bar — a bad strike wastes it.”' : '“Four, and the rest are yours.”'; }
  return '';
}
function stepList(id) {
  const d = GQD[id], q = gq(id), cur = gqStep(id);
  return '<ol class="steps">' + d.steps.map((s, i) => { const ok = stepDone(d, q, i); const prog = s.need ? ` <span class="note">${Math.min(q.p[i] || 0, s.need)}/${s.need}</span>` : s.deliver ? ` <span class="note">${SF.countMat(P.pack, s.deliver.id, s.deliver.mat)} in pack</span>` : ''; return `<li class="${ok ? 'ok' : i === cur ? 'cur' : ''}">${esc(s.t)}${prog}</li>`; }).join('') + '</ol>';
}
function ledgerHtml() {
  return `<div class="sec">Supply ledger</div><div class="kv"><span>Iron bar</span><span>Harl, smith · ${SF.PRICES.ironbar} g</span><span>Leather strap</span><span>Pell, bowyer · ${SF.PRICES.strap} g</span><span>Pickaxe</span><span>Gus, provisioner · ${SF.PRICES.pickaxe} g</span><span>Smith tongs</span><span>Gus, provisioner · ${SF.PRICES.tongs} g</span><span>Repair kit</span><span>Gus or Pell · ${SF.PRICES.repairkit} g</span><span>Coloured ore</span><span>Miners only. No shop sells it.</span></div>`;
}
function guildJournal() {
  let h = '<p class="note">Four guilds work within a short walk of the Quay bank. Paths run in order; start any of them at any time.</p>';
  for (const G of GUILDS) {
    h += `<div class="sec">${G.n} <span class="note">· ${esc(G.who)}</span></div>`;
    if (G.later) { h += '<p class="note">This guild opens in a later build.</p>'; continue; }
    for (const id of G.q) { const d = GQD[id], q = gq(id), tr = P.cx.track === id;
      const tb = q.s !== 'done' ? btn('gqtrack', tr ? 'Tracking' : 'Track', { q: id }, tr ? 'ac' : '') : '';
      if (q.s === 'none') h += `<div class="row"><span class="nm"><b>${esc(d.n)}</b> <span class="note">${SF.SKILL[d.skill].n} ${d.min} · speak to ${esc(G.who.split(',')[0])}</span></span>${tb}</div>`;
      else if (q.s === 'active') h += `<div class="row"><span class="nm"><b>${esc(d.n)}</b>${gqReady(id) ? ' <span class="note">ready to hand in</span>' : ''}</span>${tb}</div>` + stepList(id);
      else h += `<div class="row"><span class="nm" style="opacity:.6"><b>${esc(d.n)}</b> · complete</span></div><p class="note">${esc(d.next)}</p>`; } }
  if (P.cx.ledger) h += ledgerHtml();
  return h;
}

/* ---------- crafting: category → recipe → detail with the full preview (§4.1, §10 compact mobile) ---------- */
let CUI = null;
const FAMILY = { forge: ['forge', 'anvil'], anvil: ['forge', 'anvil'], bench: ['bench'], still: ['still'], fire: ['fire'], map: ['any'], scribe: ['any'] };
const FAMILY_SKILL = { map: 'cartography', scribe: 'inscription' };
const STATION_N = { forge: 'Public forge and anvil', anvil: 'Public forge and anvil', bench: 'Workbench', still: 'Alchemy still', fire: 'Cooking fire' };
const recipeCat = r => r.cat || SF.SKILL[r.skill].n;
const recipeName = r => r.name || SF.ITEMS[r.out].n;
function openCraft(k) { CUI = { st: k, cat: null, rid: null, mat: null, n: 10, x0: P.x, y0: P.y }; openPanel('craft'); }
function craftList() { return SF.RECIPES.filter(r => FAMILY[CUI.st].includes(r.station) && (!FAMILY_SKILL[CUI.st] || r.skill === FAMILY_SKILL[CUI.st])); }
function toolState(r, stn) {
  if (!r.tool) return { ok: true, t: '' };
  const it = findTool(r.tool); if (it) return { ok: true, it, t: `${SF.ITEMS[r.tool].n} · ${SF.toolUses(it)} uses left` };
  if (r.tool === 'tongs' && gq('S1').s === 'active') return { ok: !!tongsLoan(stn), loan: true, t: tongsLoan(stn) ? 'Mara lends her tongs at this anvil' : 'Mara lends tongs only at her anvil' };
  return { ok: false, t: `Needs ${SF.ITEMS[r.tool].n.toLowerCase()} (Gus sells them)` };
}
function rowStatus(r) {
  const p = SF.craftPlan(P, P.pack, r, CUI.mat && r.prim ? CUI.mat : null);
  if (p.sk < p.effMin) return ['needs ' + SF.SKILL[r.skill].n + ' ' + p.effMin, 'na'];
  if (p.missing.length) return ['missing inputs', 'miss'];
  const stn = craftStation(r); if (!stn.st) return [r.station === 'anvil' ? 'at the anvil' : 'at the ' + r.station, 'miss'];
  if (!toolState(r, stn.st).ok) return ['need ' + SF.ITEMS[r.tool].n.toLowerCase(), 'miss'];
  return [Math.round(p.chance * 100) + '%', 'ok'];
}
function craftPanel() {
  if (!CUI) return null; const list = craftList();
  if (CUI.rid) return craftDetail(SF.RECIPE[CUI.rid]);
  const cats = [...new Set(list.map(recipeCat))]; if (!CUI.cat || !cats.includes(CUI.cat)) CUI.cat = CUI.st === 'forge' ? 'Smelt' : CUI.st === 'anvil' ? 'Fittings' : cats[0];
  let h = `<div class="tabs">${cats.map(c => btn('ccat', c, { c }, c === CUI.cat ? 'ac' : '')).join('')}</div>`;
  for (const r of list.filter(r => recipeCat(r) === CUI.cat)) { const [st, cls] = rowStatus(r); const q = r.qty > 1 ? ` ×${r.qty}` : '';
    h += `<button class="crow ${cls}" data-a="crec" data-r="${r.id}">${rowIcon({ id: r.out })}<span class="nm">${esc(recipeName(r))}${q}<br><span class="note">${SF.SKILL[r.skill].n} ${r.min}${r.prim ? '+ · any metal' : ''}${r.fixedMat && r.fixedMat !== 'iron' ? ' · ' + SF.METAL[r.fixedMat].n : ''}</span></span><span class="v">${esc(st)}</span><span class="chev">›</span></button>`; }
  return [STATION_N[CUI.st], h + `<p class="note">Failed attempts lose a quarter of each input, rounded up. Skill minimums are hard limits.</p>`];
}
function craftDetail(r) {
  const stn = craftStation(r), tool = toolState(r, stn.st), mats = r.prim === 'metal' ? SF.METALS.map(a => a[0]) : null;
  if (mats && !CUI.mat) CUI.mat = r.defMat;
  const p = SF.craftPlan(P, P.pack, r, mats ? CUI.mat : null), pct = v => (v * 100).toFixed(v * 100 % 1 ? 2 : 0).replace(/\.?0+$/, '') + '%';
  const why = p.reason || (!stn.st ? stn.why : !tool.ok ? tool.t : ''), can = !why;
  let h = `<div class="tabs">${btn('cback', '‹ Back')}<b class="dt">${esc(recipeName(r))}</b><span class="note" style="margin-left:auto">${p.sk < p.effMin ? 'too hard' : pct(p.chance) + ' success' + (p.quality ? ' · ' + pct(p.perExc) + ' exceptional' : '')}</span></div>`;
  if (mats) h += `<div class="note">Metal</div><div class="mats">${mats.map(m => { const M = SF.METAL[m], have = SF.count(P.pack, SF.ingotId(m)), lock = sv(r.skill) < Math.max(r.min, M.smith); return `<button class="mat ${m === CUI.mat ? 'on' : ''} ${lock ? 'lk' : ''}" data-a="cmat" data-m="${m}"><i style="background:${M.col}"></i>${M.n}<small>${lock ? 'Smith ' + Math.max(r.min, M.smith) : have + ' ingot' + (have === 1 ? '' : 's')}</small></button>`; }).join('')}</div>`;
  h += `<div class="mk">${can ? '' : `<p class="warn" style="margin:2px 0">${esc(cap1(why))}</p>`}<div class="row">${btn('cmake', 'Make 1', { n: 1 }, can ? 'ac' : '')}${btn('cmake', 'Make 5', { n: 5 })}<span class="step">${btn('cn', '−', { d: -1 })}<b>${CUI.n}</b>${btn('cn', '+', { d: 1 })}</span>${btn('cmake', 'Make ' + CUI.n, { n: CUI.n })}</div></div>`;
  h += '<div class="sec">Inputs per attempt</div>';
  for (const l of p.lines) { const nm = (l.mat ? SF.matName(l.mat) + ' ' : '') + SF.ITEMS[l.id].n.toLowerCase(); h += `<div class="row">${rowIcon({ id: l.id })}<span class="nm">${l.qty} × ${esc(nm)}</span><span class="v ${l.have < l.qty ? 'warn' : ''}">have ${l.have}${l.have < l.qty ? ' · need ' + (l.qty - l.have) : ''}</span></div>`; }
  if (r.tool) h += `<div class="row"><span class="nm">Tool</span><span class="v ${tool.ok ? '' : 'warn'}">${esc(tool.t)}${tool.it ? ' · 1 use per attempt' : ''}</span></div>`;
  h += `<div class="row"><span class="nm">Station</span><span class="v ${stn.st ? '' : 'warn'}">${stn.st ? (r.station === 'anvil' ? 'anvil, forge alongside ✓' : r.station + ' ✓') : esc(stn.why)}</span></div>`;
  const gateTxt = p.gate > r.min ? ` · ${SF.matName(p.mat)} needs ${p.gate}` : '';
  h += `<div class="sec">Odds</div><div class="kv"><span>Skill</span><span class="${p.sk < p.effMin ? 'warn' : ''}">${SF.SKILL[r.skill].n} ${p.sk.toFixed(1)} · minimum ${r.min}${gateTxt}</span><span>Difficulty</span><span>${p.diff}</span><span>Success</span><span>${p.sk < p.effMin ? '—' : pct(p.chance)}</span>`;
  if (p.quality) h += `<span>Exceptional</span><span>${p.sk < p.effMin ? '—' : pct(p.perExc) + ' per attempt (' + pct(p.exc) + ' of successes)'}</span>`;
  h += `<span>On failure</span><span>lose ${p.lines.map(l => l.fail + ' ' + SF.ITEMS[l.id].n.toLowerCase()).join(', ')}${r.tool && tool.it ? ', 1 tool use' : ''}</span>`;
  const outs = SF.craftOutputs(P, p, false, {}, true), o = outs[0], kg = SF.itemKg(o);
  let ot = `${o.qty > 1 ? o.qty + ' × ' : ''}${SF.itemName(o)} · ${kg.toFixed(2)} kg`; if (p.quality) ot += ` · condition ${o.omax}${p.exc > 0 ? ' (' + SF.craftOutputs(P, p, true, {}, true)[0].omax + ' if exceptional)' : ''}`;
  h += `<span>You make</span><span>${esc(ot)}</span><span>Time</span><span>${SF.craftTime(r)} s each</span></div>`;
  if (p.quality && p.sk >= 100) h += `<div class="row"><span class="nm">Maker's mark on exceptional pieces</span>${btn('cmark', P.cx.mark ? 'On' : 'Off', {}, P.cx.mark ? 'ac' : '')}</div>`;
  h += '<p class="note">A batch stops if you move, take damage, cancel or run short. Up to 20 attempts.</p>';
  return ['Crafting', h];
}
/* batch: one cancel token per batch, re-checked at the start and end of every attempt */
function startCraft(id, n, mat, sec) {
  const r = SF.RECIPE[id]; if (!r || P.ghost) return; mat = r.prim ? (mat || r.defMat) : null; sec = r.sec ? (sec || r.defSec) : null;
  if (inCombat()) return log('Not while you are in combat.', '#ffb070');
  if (P.task && P.task.kind !== 'craft') return log('Finish ' + P.task.label.toLowerCase() + ' first.', '#ffb070');
  if (P.task) P.task = null;   // a new batch replaces the old one; the unresolved attempt costs nothing
  const stn = craftStation(r); if (!stn.st) return log(stn.why, '#ffb070');
  const tool = toolState(r, stn.st); if (!tool.ok) return log(tool.t + '.', '#ffb070');
  const p = SF.craftPlan(P, P.pack, r, mat, sec); if (!p.ok) return log(cap1(p.reason) + '.', '#ffb070');
  P.batch = { token: (P.batch && P.batch.token || 0) + 1, rid: id, mat, sec, left: Math.max(1, Math.min(20, n || 1)), made: 0, x0: P.x, y0: P.y };
  nextAttempt();
}
function nextAttempt() {
  const b = P.batch; if (!b || P.task) return; const r = SF.RECIPE[b.rid];
  P.task = { kind: 'craft', r: b.rid, mat: b.mat, sec: b.sec, token: b.token, label: `${recipeName(r)}${b.left > 1 ? ' · ' + b.left + ' left' : ''}`, t0: GT, t1: GT + SF.craftTime(r), still: true, x0: P.x, y0: P.y };
}
function finishCraft(t) {
  const b = P.batch; if (!b || b.token !== t.token) return;
  const r = SF.RECIPE[t.r], stn = craftStation(r), tool = toolState(r, stn.st);
  if (!stn.st) { P.batch = null; return log(stn.why, '#ffb070'); }
  if (!tool.ok) { P.batch = null; return log(tool.t + '.', '#ffb070'); }
  if (r.insc) { const sp = SF.MAGERY.SPELL[r.insc]; if (P.mana < sp.mp) { P.batch = null; return log(`You need ${sp.mp} mana to scribe ${sp.n}.`, '#ffb070'); } P.mana -= sp.mp; }   // Inscription spends the spell's mana on every attempt
  const p = SF.craftPlan(P, P.pack, r, t.mat, t.sec), res = SF.craftAttempt(P, P.pack, p, R, cap(), { mark: !!P.cx.mark });
  if (!res.ok) { P.batch = null; log('Stopped: ' + res.reason + '.', '#ffb070'); renderPanel(); return; }
  craftSound(r, res.success);
  skillUse(r.skill, p.chance, res.success, null, SF.SK.CRAFT_WINDOW(p.diff));   // every attempt teaches while the recipe is still a challenge
  if (tool.it && spendTool(tool.it)) log('Your ' + SF.ITEMS[r.tool].n.toLowerCase() + ' wear out and break.', '#ff6a5a');
  if (res.success) { const it = res.items[0]; b.made++; if (it.id === 'lockbox') Object.assign(it, { lockLvl: Math.max(1, Math.round(sv('tinkering'))), locked: true }); if (it.id === 'trapbox') Object.assign(it, { power: Math.max(1, Math.round(sv('tinkering'))), armed: true });   // a tinker's box is as hard as its maker was skilled
    log(`You make ${it.qty > 1 ? it.qty + ' × ' : ''}${SF.itemName(it).toLowerCase()}${res.exceptional ? ' — exceptional work!' : ''}.`, res.exceptional ? '#ffe08a' : '#e8e2d2');
    questEvent({ type: recipeCat(r) === 'Smelt' ? 'smelt' : 'make', rid: r.id, out: r.out, mat: SF.matOf(it), qty: it.qty, exceptional: res.exceptional });
    simEmit('ItemCrafted', { actor: aidOf(P), recipe: r.id, item: it.id, qty: it.qty, uid: it.uid, exceptional: !!res.exceptional }); }
  else log('You fail and lose ' + res.lost.map(l => l.n + ' ' + SF.ITEMS[l.id].n.toLowerCase()).join(', ') + '.', '#ffb070');
  b.left--; renderPanel();
  if (b.left > 0) at(.25, () => { if (P.batch && P.batch.token === b.token && !P.ghost) { const p2 = SF.craftPlan(P, P.pack, r, t.mat, t.sec); if (!p2.ok) { log('Batch stopped: ' + p2.reason + '.', '#ffb070'); P.batch = null; return; } nextAttempt(); } });
  else P.batch = null;
}
function stopBatch(why) { if (P.batch) { P.batch = null; if (why) log(why, '#ffb070'); } if (PANEL === 'craft' && CUI && CUI.rid) closePanel(); }
Object.assign(ACT, {
  ccat: d => { CUI.cat = d.c; renderPanel(true); snd('ui.page'); }, crec: d => { CUI.rid = d.r; renderPanel(true); snd('ui.page'); }, cback: () => { CUI.rid = null; renderPanel(true); snd('ui.page'); },
  cmat: d => { CUI.mat = d.m; renderPanel(); }, cn: d => { CUI.n = cl(CUI.n + +d.d, 1, 20); renderPanel(); }, cmark: () => { P.cx.mark = !P.cx.mark; renderPanel(); },
  cmake: d => { startCraft(CUI.rid, +d.n, CUI.mat, CUI.sec); renderPanel(); },
  survey: () => startSurvey(P.sel),
  gqacc: d => gqAccept(d.q), gqclaim: d => gqClaim(d.q), gqpay: d => { payPending(d.q); save(); renderPanel(true); },
  gqtrack: d => { P.cx.track = P.cx.track === d.q ? null : d.q; renderPanel(true); },
  jtab: d => { PTAB = d.t; renderPanel(true); snd('ui.page'); } });
PANELS.craft = craftPanel; PANELS.guild = guildPanel;

/* ---------- save migration v1 → v2 (§10): additive, backed up once ---------- */
function migrateSave(s, raw) {
  if (!s) return s;
  if (s.v < 2) migrateV2(s, raw);
  if (s.v < 3) {   // combat reform (issue #3): skill keys, displaced points, a pre-migration snapshot — once
    try { if (raw && !localStorage.getItem(SAVEKEY + '.precombat')) localStorage.setItem(SAVEKEY + '.precombat', raw); } catch (e) { }
    const r = SF.migrateCombatSkills(s.char); s.char.hotbar = s.char.hotbar || [];
    if (!s.char.hotbar.some(h => h && h.k === 'act' && h.id === 'bandother')) { const i = s.char.hotbar.findIndex((h, k) => !h && k > 0); if (i >= 0) s.char.hotbar[i] = { k: 'act', id: 'bandother' }; else if (s.char.hotbar.length < 9) s.char.hotbar.push({ k: 'act', id: 'bandother' }); }
    s.combatReform = r; s.v = 3;
  }
  if (s.v < 4) {   // v0.20 Anniabreen: the grid widened from 600 to W tiles; tile-keyed node and survey records move with it
    const re = k => { k = +k; return Math.floor(k / 600) * 2100 + k % 600; };   // the v0.20 grid width; v6 moves these on to the current one
    s.nodes = (s.nodes || []).map(n => [re(n[0])].concat(n.slice(1)));
    const sv = s.char.cx && s.char.cx.survey; if (sv) { const o = {}; for (const k in sv) o[re(k)] = sv[k]; s.char.cx.survey = o; }
    s.v = 4;
  }
  if (s.v < 5) {   // v0.21 Living World Phase 1: additive. `sim` (world seed, actor-id counter) starts fresh; nothing existing changes, so no snapshot is needed
    s.sim = s.sim || null; s.v = 5;
  }
  if (s.v < 6) migrateV6(s, raw);
  if (s.v < 7) migrateV7(s, raw);
  if (s.v < 8) migrateV8(s, raw);
  if (s.v < 9) migrateV9(s, raw);
  return s;
}
/* v0.30 Second Age skills: 41 Shardfall skills become the 49 classic ones (src/skills.js SF.SK.migrateSkills). Values move in tenths with
   their locks; Skinning and Foraging points (and any collision) wait in the recoverable skill pool; hotbar actions follow. Once, with a snapshot. */
function migrateV8(s, raw) {
  try { if (raw && !localStorage.getItem(SAVEKEY + '.pret2a')) localStorage.setItem(SAVEKEY + '.pret2a', raw); } catch (e) { }
  const r = SF.SK.migrateSkills(s.char);
  if (s.ally && s.ally.skills) SF.SK.migrateSkills(s.ally, { pool: false });   // a companion has no pool; her removed points simply lapse (she had none)
  s.t2aReform = r; s.v = 8;
}
/* v0.33 character creation v2 (save v9): additive and idempotent. The appearance gains its new fields (a v1 cloak colour becomes its cloak
   id; unknown fields are kept), attributes gain locks and the gain state (src/stats.js), the character a stable id. Saved
   attributes, skills, locks, items, position, quests and world are untouched: creation limits never apply to an existing
   character, and nothing is granted. A snapshot of the old save is kept once. */
function migrateV9(s, raw) {
  try { if (raw && !localStorage.getItem(SAVEKEY + '.prev8')) localStorage.setItem(SAVEKEY + '.prev8', raw); } catch (e) { }
  const c = s.char; c.look = SF.CREATION.normalizeLook(c.look);
  const fixes = SF.STATS.migrateChar(c); if (fixes.some(f => !/^(locks|lock )/.test(f))) s.statRepair = fixes;
  if (!c.charId) c.charId = newCharId(); s.v = 9;
}
const newCharId = () => 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36);
/* v0.23 world expansion: the grid grew from 2100 × 900 to W × H and Anniabreen was stretched (annStretch). Everything saved at
   an Anniabreen position follows it: towns move by whole tiles, so town records stay exact; wilderness resource and survey
   records are dropped (that ground was redrawn). A snapshot of the old save is kept once. */
function migrateV6(s, raw) {
  try { if (raw && !localStorage.getItem(SAVEKEY + '.prev5')) localStorage.setItem(SAVEKEY + '.prev5', raw); } catch (e) { }
  const OW = 2100, ann = x => x >= AO;
  const pos = o => { if (o && Number.isFinite(o.x) && ann(o.x)) { const [x, y] = annWarp(o.x - AO, o.y); o.x = x; o.y = y; } };
  const key = k => { k = +k; const x = k % OW, y = Math.floor(k / OW); if (!ann(x)) return y * W + x; if (!annRigidAt(x - AO, y)) return null; const [nx, ny] = annWarp(x - AO, y); return Math.round(ny) * W + Math.round(nx); };
  const c = s.char; pos(c);
  s.nodes = (s.nodes || []).map(n => { const k = key(n[0]); return k === null ? null : [k].concat(n.slice(1)); }).filter(Boolean);
  if (c.cx && c.cx.survey) { const o = {}; for (const k in c.cx.survey) { const nk = key(k); if (nk !== null) o[nk] = c.cx.survey[k]; } c.cx.survey = o; }
  if (c.cx && c.cx.doors) { const o = {}; for (const k in c.cx.doors) { const [x, y] = k.split(',').map(Number); if (ann(x)) { const [nx, ny] = annWarp(x - AO, y); o[Math.round(nx) + ',' + Math.round(ny)] = c.cx.doors[k]; } else o[k] = c.cx.doors[k]; } c.cx.doors = o; }
  for (const pn of (c.cx && c.cx.pins) || []) pos(pn);
  for (const co of s.corpses || []) pos(co);
  if (s.ally) { pos(s.ally); if (s.ally.body) pos(s.ally.body); }
  const rune = it => { if (it && it.mark) pos(it.mark); };
  for (const k of ['pack', 'bank']) if (c[k]) c[k].items.forEach(rune); for (const k in c.equip || {}) rune(c.equip[k]); for (const co of s.corpses || []) (co.items || []).forEach(rune);
  if (s.ally) (s.ally.pack || []).forEach(rune);
  s.worldMoved = true; s.v = 6;
}
/* v0.25 equipment: the single armor slot becomes individual pieces (head … feet, clothing layers, accessories). A worn suit
   becomes its pieces, worn; suits in the pack, bank, ally and corpses become pieces too. Material, quality, crafter and the worn
   fraction carry over. Idempotent (eqMig); a snapshot of the old save is kept once. */
function migrateV7(s, raw) {
  try { if (raw && !localStorage.getItem(SAVEKEY + '.prev6')) localStorage.setItem(SAVEKEY + '.prev6', raw); } catch (e) { }
  let mx = s.uid || 1; const scan = it => { if (it && it.uid >= mx) mx = it.uid + 1; if (it && it.items) it.items.forEach(scan); };   // new pieces must not reuse an id already in the save
  const c = s.char; for (const k of ['pack', 'bank']) if (c[k]) c[k].items.forEach(scan); Object.values(c.equip || {}).forEach(scan); for (const co of s.corpses || []) (co.items || []).forEach(scan);
  if (s.ally) { Object.values(s.ally.equip || {}).forEach(scan); (s.ally.pack || []).forEach(scan); if (s.ally.body) s.ally.body.items.forEach(scan); }
  SF.setUidBase(mx);
  s.equipReform = SF.EQ.migrateActor(s.char);
  if (s.ally) { SF.EQ.migrateActor(s.ally); if (s.ally.body) SF.EQ.expandList(s.ally.body.items); }
  for (const co of s.corpses || []) SF.EQ.expandList(co.items);
  s.uid = 0; s.v = 7;   // boot takes the id counter from SF (setUidBase keeps the larger value)
}
function migrateV2(s, raw) {
  const walk = fn => { const c = s.char; for (const k of ['pack', 'bank']) if (c[k]) c[k].items.forEach(fn); for (const k in c.equip || {}) if (c.equip[k]) fn(c.equip[k]); for (const co of s.corpses || []) co.items.forEach(fn); };
  walk(it => {
    const d = SF.ITEMS[it.id]; if (!d) return;
    if (SF.WEARABLE(it.id) && it.cond !== undefined && it.omax === undefined) { it.omax = Math.max(100, it.maxc || 100); if (it.maxc === undefined) it.maxc = 100; if (!it.origin) it.origin = 'unknown'; }
    if (SF.WORK_TOOLS[it.id] && !d.stack && it.uses === undefined) it.uses = SF.TOOL_USES;
  });
  s.char.quest = s.char.quest || { beacon: 0 }; s.char.quest.guild = s.char.quest.guild || {};
  s.char.cx = s.char.cx || {}; s.v = 2;
  try { if (raw && !localStorage.getItem(SAVEKEY + '.backup')) localStorage.setItem(SAVEKEY + '.backup', raw); } catch (e) { }
}

function petLoyaltyTick() {
  for (const p of tamedPets()) {
    if (p.loyal === undefined) { p.loyal = SF.SK.LOYALTY.max; p.fedAt = GT; }
    const want = SF.SK.LOYALTY.max - Math.floor((GT - (p.fedAt || GT)) / SF.SK.LOYALTY.step);
    if (want < p.loyal) { p.loyal = Math.max(0, want); if (p.loyal === 3) log(`${cap1(p.name)} looks hungry. (Feed pet)`, '#ffb070'); }
    if (p.loyal <= 0) { log(`${cap1(p.name)} seems to have decided that it is better off without a master!`, '#ff8a6a'); p.kind = 'mon'; p.name = undefined; p.order = null; p.loyal = undefined; p.home = { x: p.x, y: p.y }; p.state = 'return'; if (P.sel === p) P.sel = null; simAdopt(p); }
  }
}
function petCommand(c) {
  const pets = ents.filter(e => e.kind === 'pet' && !e.gone); if (!pets.length) return;
  if (c === 'dismiss') { const p = P.sel && P.sel.kind === 'pet' ? P.sel : pets[0]; rmEnt(p); P.sel = null; log(p.name + ' is released into the wild.'); return; }
  const tgt = c === 'attack' ? P.sel : null; if (c === 'attack' && (!tgt || tgt.kind !== 'mon')) return log('Select a creature for your pets to attack.');
  for (const p of (P.sel && P.sel.kind === 'pet' ? [P.sel] : pets)) { if (!los(P, p)) { log(p.name + ' cannot see you.'); continue; }
    const min = p.type ? tameMin(p.type) : null, ch = min === null ? 1 : SF.SK.controlChance(sv('animaltaming'), sv('animallore'), min, p.loyal);   // 80% Taming + 20% Animal Lore against the creature (src/skills.js)
    if (R() > ch) { log(`${cap1(p.name)} looks at you and winces.`); continue; } p.order = c; p.tgt = tgt; }
  say(P, c === 'attack' ? 'Attack!' : c === 'follow' ? 'Heel.' : 'Stay.'); }
function unequipTo(s) { const r = SF.EQ.unequipItem(P, { slot: s }); if (!r.ok) return false; snd('item.equip'); if (s === 'weapon') weaponChanged(); eqChanged(); return true; }
/* the one equip path for every control (button, double-click, drag, context menu): a validated, atomic command */
function equipUid(u, slot) {
  if (P.ghost) return log('Ghosts cannot handle equipment.', '#ffb070');
  const r = SF.EQ.equipItem(P, { uid: u, slot: slot || undefined });
  if (!r.ok) { log(cap1(r.reason) + '.', '#ffb070'); return false; }
  snd('item.equip'); if (r.slot === 'weapon' || r.displaced.some(x => x.slot === 'weapon')) weaponChanged(); eqChanged(); return true;
}
document.addEventListener('click', ev => { const b = ev.target.closest('[data-a]'); if (!b) return; const f = ACT[b.dataset.a]; if (f && P) { ev.preventDefault(); try { f(b.dataset, b); } catch (e) { console.error(e); } refreshHud(); } });

/* ---------- touch / mouse input ---------- */
function screenToWorld(sx, sy) { const wx = sx * CAM.f + CAM.x, wy = sy * CAM.f + CAM.y; return { x: (wx / HW + wy / HH) / 2, y: (wy / HH - wx / HW) / 2, wx, wy }; }
function hitEnts(wx, wy) { const out = []; for (const e of ents) { if (e === P || e.gone || e.hidden) continue; const X = SX(e.x, e.y), Y = SY(e.x, e.y); const h = e.kind === 'corpse' ? 0 : e.type && MON[e.type] ? MON[e.type].h : 66; const cy = Y - h * .5, r = e.kind === 'corpse' ? 16 : Math.max(18, h * .55); const d = Math.hypot(wx - X, wy - cy); if (d < r) out.push({ e, d: d + (e.kind === 'corpse' ? 12 : 0) }); } return out.sort((a, b) => a.d - b.d).map(o => o.e); }
function tallAt(wx, wy) { const fx = (wx / HW + wy / HH) / 2, fy = (wy / HH - wx / HW) / 2; for (let k = 3; k >= 0; k--) { const x0 = Math.floor(fx) + k, y0 = Math.floor(fy) + k; for (const [ax, ay] of [[x0, y0], [x0 + 1, y0], [x0, y0 + 1]]) { const t = tAt(ax, ay); const hh = { [T.TR]: 80, [T.RK]: 46, [T.RB]: 30 }[t]; if (!hh) continue; const cx = SX(ax + .5, ay + .5), cy = SY(ax + .5, ay + .5); if (Math.abs(wx - cx) < HW * .8 && wy > cy - hh && wy < cy + HH * .7) return { x: ax, y: ay }; } } return null; }
function tapWorld(sx, sy) {
  if (ONW) { if (P) owTap(sx, sy); return; }   // online: selection only (src/online.js)
  if (!P) return; const w = screenToWorld(sx, sy);
  if (AIM) { const pt = { x: w.x, y: w.y }; if (Math.hypot(pt.x - P.x, pt.y - P.y) > AIM.range) return log('Out of range.', '#ffb070'); return AIM.fn(pt); }
  if (P.ghost) return;
  const hits = hitEnts(w.wx, w.wy);
  if (P.held && heldTap(hits, w)) return;
  if (PICKT && hits.length && pickTap(hits)) return;   // a skill waiting for its target
  if (hits.length > 1 && hits[0].kind !== hits[1].kind && Math.abs(dist(hits[0], hits[1])) < .8) { PICK = hits.slice(0, 5); return openPanel('picker'); }
  if (hits.length) { if (hits[0].kind === 'corpse') { P.sel = hits[0]; if (dist(hits[0], P) <= 2.2) return interact(); return log('Walk next to the remains to loot them.'); } P.sel = hits[0]; if (P.sel.kind === 'mon') P.sel.nameUntil = GT + 3; return; }
  const dr = doorAtScreen(w.wx, w.wy); if (dr) { if (doorDist(dr) <= 2.2) return useDoor(dr); return log('Walk up to the door.'); }
  const tl = tallAt(w.wx, w.wy); const tx = tl ? tl.x : Math.floor(w.x), ty = tl ? tl.y : Math.floor(w.y);
  const n = nodeAt(tx, ty); if (n) { P.sel = n; return; }
  if (tAt(tx, ty) === T.WA && SF.count(P.pack, 'rod')) { P.sel = { kind: 'node', x: tx, y: ty, t: T.WA, skill: 'fishing', name: 'fishing water' }; return; }
}
let PT = null;
cv.addEventListener('pointerdown', e => {
  if (!P || PT) return; const leftZone = SETTINGS.mirror ? e.clientX > VW * .55 : e.clientX < VW * .45;
  PT = { id: e.pointerId, x: e.clientX, y: e.clientY, joy: leftZone, moved: false }; if (leftZone) { JOY.x0 = e.clientX; JOY.y0 = e.clientY; JOY.x = e.clientX; JOY.y = e.clientY; }
  try { cv.setPointerCapture(e.pointerId); } catch (_) { } e.preventDefault();
});
cv.addEventListener('pointermove', e => { if (!PT || e.pointerId !== PT.id) return; if (PT.joy) { JOY.x = e.clientX; JOY.y = e.clientY; if (!PT.moved && Math.hypot(e.clientX - PT.x, e.clientY - PT.y) > 10) { PT.moved = true; JOY.on = true; } } else if (AIM) { const w = screenToWorld(e.clientX, e.clientY); AIM.pt = { x: w.x, y: w.y }; } });
const pend = e => { if (!PT || e.pointerId !== PT.id) return; if (!PT.moved) tapWorld(PT.x, PT.y); PT = null; JOY.on = false; JOY.sprint = false; refreshHud(); };
cv.addEventListener('pointerup', pend); cv.addEventListener('pointercancel', () => { PT = null; JOY.on = false; });
cv.addEventListener('mousemove', e => { if (AIM && !PT) { const w = screenToWorld(e.clientX, e.clientY); AIM.pt = { x: w.x, y: w.y }; } });
const KM = { ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd', ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r' };
addEventListener('keydown', e => { if (!P || e.target.matches('input,select,textarea')) return;
  if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey && !SCREEN) { e.preventDefault(); toggleEqWin(); refreshHud(); return; }
  if (SCREEN || PANEL) {
    if (e.key === 'Escape') { e.preventDefault(); if (SCREEN) closeScreen(); else closePanel(); snd('ui.close'); refreshHud(); }
    return;
  } if (KM[e.key]) { KEYS[KM[e.key]] = 1; KEYS.any = 1; e.preventDefault(); } if (e.key === 'Shift') KEYS.shift = 1; if (e.key === ' ') { toggleArm(); e.preventDefault(); } if (e.key === 'e' || e.key === 'E') interact(); if (e.key === 'b' || e.key === 'B') firstAid(P); if (/^[1-3]$/.test(e.key)) ACT.slot({ i: +e.key - 1 }); if (e.key === 'Tab') { ACT.cycle(); e.preventDefault(); } if (e.key === 'Escape') { escapeWorld(); closePanel(); } refreshHud(); });   // v0.29: cancel first, then clear the target (src/hud-ui.js)
addEventListener('keyup', e => { if (KM[e.key]) KEYS[KM[e.key]] = 0; if (e.key === 'Shift') KEYS.shift = 0; KEYS.any = KEYS.u || KEYS.d || KEYS.l || KEYS.r; });
addEventListener('resize', () => { resize(); if (SCREEN === 'map') { sizeMap(); mapFit(); drawMap(); } if (P && VH > VW && !ROTOK) $('#rot').hidden = false; else $('#rot').hidden = true; });

/* ---------- persistence: one atomic write per save ---------- */
/* What persists (v0.28.2): the character (pack, bank, equipment), your body, your dropped piles (with their time left), chests
   you opened (their remaining contents and the time until they relock and refill), your pets, Wren, resource nodes, the world
   clock, camps and town life. A spell being prepared counts as interrupted by the reload (reagents back, half the mana spent,
   exactly as Cancel); a held spell fades (its cost was already paid). Poison resumes where it was. Creature remains and other
   statuses (boons, hexes, wards, fields, summons) are not saved: see docs/magery/STATUS.md. */
let deletingSave = false, saveLocked = false, saveFailShown = false;
const SAVEKEY = 'shardfall.save.v1', SAVE_VERSION = 9, TAB_ID = Math.random().toString(36).slice(2);
/* v0.33.1: SAVE.expect is the stored save this tab last read or wrote (undefined until the game runs). Before each write the stored
   value is compared with it: if another tab replaced or deleted the save meanwhile, this tab stops saving instead of bringing back a
   character that was deleted or replaced. SAVE.unsaved: the last write failed (storage full or blocked), shown by #unsaved. */
const SAVE = { expect: undefined, unsaved: false };
function save() {
  if (!P || deletingSave || saveLocked || ONW) return false; try {
    let cur; try { cur = localStorage.getItem(SAVEKEY); } catch (x) { cur = undefined; }   // storage unreadable: the write below fails and says so
    if (cur !== undefined && SAVE.expect !== undefined && cur !== SAVE.expect) { saveLock(cur === null ? 'deleted' : 'replaced'); return false; }
    const raw = JSON.stringify(saveData()); localStorage.setItem(SAVEKEY, raw); SAVE.expect = raw;
    DEV.lastSave = { ok: true, at: GT }; if (SAVE.unsaved && typeof log === 'function') log('Your game is saved again.', '#7ee08a'); saveFailShown = false; saveState(false); return true;
  } catch (e) { DEV.lastSave = { ok: false, at: GT, err: String(e && e.name || e) }; saveState(true); if (!saveFailShown) { saveFailShown = true; console.warn('save failed', e); if (typeof log === 'function') log('Your game could not be saved (browser storage is full or blocked). Free some space or export your save.', '#ff6a5a'); } return false; }
}
/* the unsaved notice: shown while the last write failed, with Export (the current game as a file) and Retry */
function saveState(failed) { SAVE.unsaved = failed; const el = typeof document !== 'undefined' && document.getElementById('unsaved'); if (el) el.hidden = !failed || saveLocked; }
function saveLock(why) {
  if (saveLocked) return; saveLocked = true; saveState(SAVE.unsaved);
  log(why === 'deleted' ? 'This character was deleted in another tab. This tab has stopped saving so it cannot bring it back; reload to continue.'
    : why === 'replaced' ? 'The saved game was replaced in another tab. This tab has stopped saving so it cannot overwrite it; reload to continue.'
    : 'Shardfall was opened in another tab. This tab has stopped saving; close it or reload it to continue here.', '#ff6a5a');
}
function saveExportNow() { if (!P) return; try { exportSave(JSON.stringify(saveData()), 'Shardfall_' + String(P.name || 'character').replace(/[^\p{L}\p{N}_-]+/gu, '_') + '_unsaved.json'); } catch (e) { console.warn(e); } }
function saveData() {
  {
    const c = {}; for (const k of ['name', 'x', 'y', 'str', 'dex', 'int', 'hp', 'stam', 'mana', 'skills', 'pack', 'bank', 'equip', 'look', 'bound', 'quest', 'freeLessons', 'hotbar', 'ghost', 'ghostAt', 'gainLog', 'recipeN', 'cx', 'skillPool', 'combatMig', 't2aMig', 'camp', 'eqMig', 'bandSeq', 'bandDone', 'lowerRank', 'statLocks', 'charId', 'created', 'report']) c[k] = P[k];
    c.bandage = bandageSave();
    c.prepEscrow = P.prep ? { id: P.prep.sp.id, items: P.prep.escrow.items.slice(), mana: P.prep.escrow.mana } : null;
    c.poisonState = P.poison ? { tier: P.poison.tier, ticks: P.poison.ticks, in: Math.max(0, Math.round((P.poison.next - GT) * 10) / 10) } : null;
    if (P.base) Object.assign(c, P.base); c.magery = { mig: (P.mg && P.mg.mig) || 0 };
    const corpses = ents.filter(e => e.mine && !e.gone).map(e => ({ x: e.x, y: e.y, items: e.cont.items, left: e.expires - GT, diedAgo: GT - e.cont.diedAt, ...(e.gear ? { gear: e.gear, sect: e.sect || 0 } : {}) }));
    const piles = ents.filter(e => e.kind === 'corpse' && e.pile && !e.gone && e.cont.items.length && e.expires > GT).map(e => ({ x: e.x, y: e.y, items: e.cont.items, left: Math.round((e.expires - GT) * 10) / 10 }));
    const chests = []; for (const [k, ch] of CHESTS) if (ch.open && ch.refill > GT) chests.push([k, Math.round((ch.refill - GT) * 10) / 10, ch.cont ? ch.cont.items : []]);
    let maxUid = 0; const scan = it => { if (it && it.uid > maxUid) maxUid = it.uid; if (it && Array.isArray(it.items)) it.items.forEach(scan); }; P.pack.items.forEach(scan); P.bank.items.forEach(scan); Object.values(P.equip).forEach(scan); corpses.forEach(c2 => c2.items.forEach(scan)); piles.forEach(c2 => c2.items.forEach(scan)); chests.forEach(c2 => c2[2].forEach(scan));
    const pets = ents.filter(e => e.kind === 'pet' && e.type && !e.summon && !e.gone && e.hp > 0).map(e => ({ type: e.type, hp: e.hp, order: e.order === 'stay' ? 'stay' : 'follow', slots: e.slots, name: e.name, dx: e.x - P.x, dy: e.y - P.y, x: e.x, y: e.y, aid: e.actorId || null, owner: e.owner || P.charId || null, loyal: e.loyal, fedAgo: GT - (e.fedAt || GT) }));   // v0.33.1: x/y (where a staying pet waits), aid (its actor id) and owner; dx/dy stay for older builds
    const nodes = []; for (const [k, o] of RES) nodes.push([k, o.gen || 1, o.spec || 0, o.n, o.max || 0, Math.round(o.t * 10) / 10]);
    const ally = allySave(); if (ally) { Object.values(ally.equip || {}).forEach(scan); ally.pack.forEach(scan); if (ally.body) ally.body.items.forEach(scan); }
    npcdScanItems(scan);   // townsfolk bodies (v0.39): their items carry real uids
    const adv = advSave(); advScanItems(adv, scan);   // NPC adventurers (v0.36): their items carry real uids
    return { v: SAVE_VERSION, char: c, corpses, piles, chests, pets, nodes, ally, sim: WS ? WS.save() : null, eco: ecoSave(), life: lifeSave(), adv, uid: maxUid + 1, gt: GT, savedAt: Date.now(), tab: TAB_ID };
  }
}
/* another tab of the same game wrote the save: stop saving here so the two never overwrite each other's progress */
/* v0.33.1: also when another tab deletes the save or clears storage (key null), so a stale tab never recreates a deleted character */
addEventListener('storage', e => { if ((e.key !== SAVEKEY && e.key !== null) || !P || saveLocked || deletingSave) return;
  if (e.key === null || e.newValue === null) return saveLock('deleted');
  let o = null; try { o = JSON.parse(e.newValue); } catch (x) { }
  if (!o || !o.tab || o.tab !== TAB_ID) saveLock('tab'); });
/* validateSave: '' when the parsed save is safe to boot, else a plain reason. post: after migration, the full current shape */
function validateSave(s, post) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return 'it is not a Shardfall save';
  if (!Number.isFinite(s.v) || s.v < 1) return 'it has no save version';
  if (s.v > SAVE_VERSION) return `it was made by a newer version of Shardfall (save format ${s.v}, this build reads up to ${SAVE_VERSION})`;
  const c = s.char; if (!c || typeof c !== 'object' || Array.isArray(c)) return 'the character is missing';
  if (typeof c.name !== 'string' || !c.name.trim()) return 'the character has no name';
  for (const k of ['x', 'y', 'str', 'dex', 'int']) if (!Number.isFinite(c[k])) return `the character's ${k} is not a number`;
  for (const k of ['pack', 'bank']) if (!c[k] || typeof c[k] !== 'object' || !Array.isArray(c[k].items)) return `the ${k} is missing`;
  if (s.gt !== undefined && s.gt !== null && !Number.isFinite(s.gt)) return 'the world time is not a number';
  if (post) { if (!c.equip || typeof c.equip !== 'object' || Array.isArray(c.equip)) return 'the equipment is missing'; if (!c.skills || typeof c.skills !== 'object') return 'the skills are missing'; }
  return '';
}
/* readSave: { raw, save, problem }. save is set only when it parses and passes the pre-migration check */
function readSave(key) {
  let raw = null; try { raw = localStorage.getItem(key || SAVEKEY); } catch (e) { return { raw: null, save: null, problem: 'browser storage is not available' }; }
  if (!raw) return { raw: null, save: null, problem: '' };
  let s; try { s = JSON.parse(raw); } catch (e) { return { raw, save: null, problem: 'the save is damaged (it does not read as data)' }; }
  const problem = validateSave(s); return { raw, save: problem ? null : s, problem };
}
function loadSave() { return readSave().save; }
function backupRaw(suffix, raw) { try { if (raw) localStorage.setItem(SAVEKEY + suffix, raw); return true; } catch (e) { return false; } }
function exportSave(raw, name) { try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' })); a.download = name || 'shardfall-save.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0); } catch (e) { console.warn(e); } }
/* the world-side containers of a save (piles and opened chests) and in-flight spell preparation and poison */
function worldItemsLoad(saved) {
  for (const pl of saved.piles || []) { if (!pl || !Array.isArray(pl.items) || !pl.items.length || !(pl.left > 0) || !Number.isFinite(pl.x) || !Number.isFinite(pl.y)) continue;
    const cont = SF.newContainer('pile'); cont.items = pl.items; addEnt({ kind: 'corpse', pile: true, name: 'dropped items', x: pl.x, y: pl.y, cont, expires: GT + pl.left }); }
  for (const row of saved.chests || []) { if (!Array.isArray(row)) continue; const [k, left, items] = row; const ch = CHESTS.get(+k); if (!ch || !(left > 0)) continue;
    ch.open = true; ch.refill = GT + left; ch.cont = SF.newContainer('chest'); ch.cont.items = Array.isArray(items) ? items : []; }
}
function statusLoad(c) {
  const pe = c.prepEscrow; delete P.prepEscrow;
  if (pe && Array.isArray(pe.items) && Number.isFinite(pe.mana)) {                  // the reload interrupts the preparation, once
    for (const r of pe.items) if (SF.ITEMS[r]) give(r, 1);
    const cost = SF.MAGERY.interruptCost(pe.mana); P.mana = Math.min(SF.maxMana(P), Math.max(0, P.mana) + pe.mana - cost);
    P.spellReadyAt = GT + SF.MAGERY.RECOVERY; log(`The spell you were preparing was interrupted (−${cost} mana; reagents back).`, '#ffb070'); }
  const ps = c.poisonState; delete P.poisonState; P.poison = null;
  if (ps && SF.POISON[ps.tier] !== undefined && Number.isSafeInteger(ps.ticks) && ps.ticks > 0) P.poison = { tier: ps.tier, ticks: ps.ticks, next: GT + Math.max(0, Math.min(SF.POISON_GAP, +ps.in || 0)) };
}
/* numeric repair after a load: a damaged value never crashes the game */
function sanitizeChar() {
  const fin = (v, d) => Number.isFinite(v) ? v : d;
  P.hp = Math.min(SF.maxHp(P), Math.max(0, fin(P.hp, SF.maxHp(P)))); P.stam = Math.min(SF.maxStam(P), Math.max(0, fin(P.stam, SF.maxStam(P)))); P.mana = Math.min(SF.maxMana(P), Math.max(0, fin(P.mana, SF.maxMana(P))));
  if (!Array.isArray(P.hotbar)) P.hotbar = []; P.freeLessons = fin(P.freeLessons, 0); P.skillPool = fin(P.skillPool, 0);
}

/* ---------- boot ---------- (the character creator and the title screen are src/creation-ui.js) */
const CC = { bootErr: '' };   // why the saved game could not be loaded, shown on the title screen
/* bootSaved: migrate a copy, validate the result, keep the raw save as the last good one, then boot. Any failure leaves the stored
   save untouched and returns to the start screen with the reason, instead of booting into half-migrated data. */
function bootSaved(rs) {
  let s;
  try { s = migrateSave(JSON.parse(rs.raw), rs.raw); const bad = validateSave(s, true); if (bad) throw new Error(bad); }
  catch (e) { console.error('save could not be loaded', e); try { if (localStorage.getItem(SAVEKEY) !== rs.raw) localStorage.setItem(SAVEKEY, rs.raw); } catch (x) { } CC.bootErr = String(e && e.message || e); showRecovery(); return false; }
  backupRaw('.lastgood', rs.raw); CC.bootErr = ''; SAVE.expect = rs.raw; boot(s); return true;
}
function showRecovery() { CCD.screen = 'home'; ccRender(); }
/* where a saved pet appears (v0.33.1). A pet told to stay waits where it was left: the saved x/y, or for saves from before v0.33.1
   the character's saved position plus the saved offset (the same point). It is checked to be on the map and on standable ground;
   otherwise, and for a following pet, it appears beside you as before (offset kept when it was near, else one step east). */
function petLoadPos(pt, c) {
  const fin = Number.isFinite, near = Math.hypot(pt.dx || 0, pt.dy || 0) < 12, beside = { x: P.x + (near && fin(pt.dx) ? pt.dx : 1), y: P.y + (near && fin(pt.dy) ? pt.dy : 0) };
  if (pt.order !== 'stay') return beside;
  const x = fin(pt.x) ? pt.x : c && fin(c.x) && fin(pt.dx) ? c.x + pt.dx : NaN, y = fin(pt.y) ? pt.y : c && fin(c.y) && fin(pt.dy) ? c.y + pt.dy : NaN;
  if (fin(x) && fin(y) && x >= 0 && y >= 0 && x < W && y < H && canStand({ kind: 'pet', type: pt.type }, x, y)) return { x, y };
  return beside;
}
/* ---------- boot ---------- (the character creator is src/creation-ui.js) */
/* boot(saved) continues a saved character; boot(null, payload) creates one from a creation payload, which is validated here
   again with the same SF.CREATION.validate the creator uses. Returns true once the game runs. A failed creation leaves the
   existing save untouched: nothing is written until the new character is complete. */
function boot(saved, fresh) {
  if (P) return false;                                                       // the game is already running (a double submit)
  let cv0 = null; if (!saved) { cv0 = SF.CREATION.validate(fresh); if (!cv0.ok) { console.warn('creation rejected', cv0.errors); return false; } cv0 = cv0.value; }
  genWorld(); buildTiles(); buildMini(); resize();
  if (saved) { for (const row of saved.nodes || []) { if (!Array.isArray(row)) continue; const [k, gen, spec, n, max, t] = row; RES.set(k, { gen, spec: spec || undefined, n, max, t }); }
    const c = saved.char; P = newChar({ name: c.name, str: c.str, dex: c.dex, int: c.int, skills: {}, look: c.look }); Object.assign(P, c); P.equip = Object.assign(emptyEquip(), P.equip); delete P.equip.armor; SF.setUidBase(saved.uid || 1); GT = saved.gt || 0;
    for (const k of Object.keys(SF.newSkills())) if (!P.skills[k]) P.skills[k] = { v: 0, lock: 'raise' };
    for (const co of saved.corpses || []) { if (!co || !Array.isArray(co.items)) continue; const cont = SF.newContainer('corpse', 'p1'); cont.items = co.items; cont.diedAt = GT - (co.diedAgo ?? 999); cont.expires = GT + co.left; addEnt({ kind: 'corpse', mine: true, name: 'your body', x: co.x, y: co.y, cont, expires: GT + co.left, gear: SF.GEAR.restore(co.gear), sect: co.sect || 0 }); }
    if (P.ghost && !Number.isFinite(c.ghostAt)) P.ghostAt = GT - 12;
    worldItemsLoad(saved); sanitizeChar();
    { const extra = ents.filter(e => e.kind === 'corpse' && e.cont && (e.mine || e.pile)).map(e => e.cont).concat([...CHESTS.values()].filter(ch => ch.cont).map(ch => ch.cont));
      const nr = SF.EQ.normalize(P, extra); if (nr.reassigned + nr.fixedQty + nr.removed) console.warn('inventory repaired on load', nr); } }
  else {
    P = newChar(cv0); P.look = Object.assign({}, cv0.look); P.charId = newCharId(); P.created = { v: SF.CREATION.VERSION, template: cv0.template, town: cv0.town };
    const tr = SF.CREATION.townReady(cv0.town, { shrines: SHRINES, npcs: ANN.npcs, stand: (x, y) => canStand(P, x, y) });
    if (tr.ok) { P.x = tr.spawn.x; P.y = tr.spawn.y; P.bound = tr.bound; } else { P.created.town = 'quay'; log(`${SF.CREATION.TOWN[cv0.town].n} is not ready (${tr.reason}); you start at Saltmarsh Quay.`, '#ffb070'); }
    starterKit(cv0);
  }
  P.cx = Object.assign({ survey: {}, pins: [], track: null, mark: false, doors: {} }, P.cx || {}); P.batch = null; applyDoorState();
  { const t = P.cx.tchest; if (t && !t.opened) { tSet(t.x, t.y, T.CH); CHESTS.set(t.y * W + t.x, { x: t.x, y: t.y, tier: t.tier, open: false, refill: 0, treasure: t.lvl, under: t.under, trap: 0, trapSeen: false }); } }   // a dug-up treasure chest waits through a reload
  if (saved && !canStand(P, P.x, P.y)) { find: for (let r = 1; r <= 12; r++) for (let a = 0; a < 16; a++) { const x = P.x + Math.cos(a / 8 * Math.PI) * r, y = P.y + Math.sin(a / 8 * Math.PI) * r; if (canStand(P, x, y)) { P.x = x; P.y = y; break find; } } }   // never load into a wall or a tree
  WS = SIM.create({ clock: () => GT, saved: saved && saved.sim, onError: e => console.error(e) }); simAdopt(P);   // actor ids continue from the save
  if (!saved) simEmit('CharacterCreated', { actor: aidOf(P), charId: P.charId, template: P.created.template, town: P.created.town, body: P.look.body });
  if (saved && !(saved.sim && saved.sim.clock)) WS.clock.setHour(GT, (GT / 60 + 9) % 24);   // older saves keep the hour they were at; from now on a day lasts 120 minutes
  NAV.walk = null; NAV.edge = null; NAV.graph = null; devInit();
  ents.unshift(P); P.sect = P.sect || 0; P.drawn = false; P.sw = SF.newSwing(); P.movedAt = -99; while (P.hotbar.length < 9) P.hotbar.push(null); Q(); ecoLoad(saved && saved.eco); populate(); lifeLoad(saved && saved.life); advLoad(saved && saved.adv); seedTraps();
  { const al = makeAlly(saved && saved.ally); const bd = saved && saved.ally && saved.ally.body; if (bd && bd.left > 0) { const cont = SF.newContainer('corpse', al.aid); cont.items = bd.items; cont.diedAt = GT - (bd.diedAgo ?? 999); cont.expires = GT + bd.left; addEnt({ kind: 'corpse', allyBody: al.aid, name: al.name + "'s body", x: bd.x, y: bd.y, cont, expires: GT + bd.left }); } }
  P.bandage = null; if (saved) bandageLoad(saved.char.bandage); P.prep = null; P.held = null; if (saved) statusLoad(saved.char);          // an application in flight resumes once, never twice
  if (saved) for (const pt of saved.pets || []) { if (!pt) continue; const d = MON[pt.type]; if (!d) continue; const at = petLoadPos(pt, saved.char);
    addEnt({ kind: 'pet', type: pt.type, name: pt.name || 'your ' + d.n, x: at.x, y: at.y, hp: Math.min(pt.hp, d.hp), max: d.hp, state: '', home: { x: at.x, y: at.y }, sect: 0, ward: 0, order: pt.order === 'stay' ? 'stay' : 'follow', slots: pt.slots || 1, target: null, loyal: pt.loyal === undefined ? SF.SK.LOYALTY.max : pt.loyal, fedAt: GT - (pt.fedAgo || 0), savedAid: typeof pt.aid === 'string' ? pt.aid : null, owner: pt.owner || P.charId || null }); }
  mageryBoot(saved);
  $('#cc').hidden = true; document.body.classList.toggle('mirror', SETTINGS.mirror);
  const startTown = !saved && P.created && P.created.town !== 'quay' ? SF.CREATION.TOWN[P.created.town].n : null;
  log('Welcome to ' + (startTown || 'Saltmarsh Quay') + ', ' + P.name + '. Bank what you cannot afford to lose.', '#ffe08a');
  log('Left stick moves; the Sprint button runs. Tap to target. Attack arms your swings. Interact gathers, loots and talks.', '#b6a68a');
  if (P.ghost) log('You are a ghost. Follow the golden arrow to a shrine or healer.', '#ff6a5a');
  if (saved && saved.t2aReform && saved.t2aReform.changed) { log('Your skills now follow the Second Age: 49 classic skills under their own names. Every trained point moved with them.', '#ffe08a'); if (saved.t2aReform.displaced) log(`Skinning and Foraging are activities now, not skills: their ${f1(saved.t2aReform.displaced)} points wait on your Skills page to be placed.`, '#ffe08a'); }
  if (saved && saved.combatReform && saved.combatReform.changed) { log('The combat skills now follow the Second Age: Swordsmanship, Mace Fighting, Fencing, Archery, Wrestling, Parrying and Healing. Your trained points moved with them.', '#ffe08a'); if (P.skillPool > 0) log(`${f1(P.skillPool)} points from merged skills wait on your Skills page.`, '#ffe08a'); }
  if (saved && P.camp) log('You wake at your camp, rested.', '#9fd0ff');
  if (!saved && !startTown) log('Wren, a quay sellsword, nurses a wound by the plaza. Tap her to bandage her or ask her to follow you.', '#b6a68a');
  if (!saved) log('Your attributes and skills grow as you use them. No trainer sells attributes.', '#b6a68a');
  if (saved && saved.statRepair) log('Some saved attribute values were out of range and have been repaired: ' + saved.statRepair.join(', ') + '.', '#ffb070');
  if (VH > VW) $('#rot').hidden = false; const stored = save(); refreshHud();
  if (!saved && !stored && !saveLocked) log(P.name + ' has not been saved: browser storage is full or blocked. Your previous save, if any, is unchanged. Use Export to keep this character, or Retry once there is space.', '#ff6a5a');   // v0.33.1: a new character is never shown as saved when it is not
  return true;
}
let last = performance.now(), hudT = 0;
/* frame errors: each stage (simulation, drawing, HUD) is isolated so one failing stage does not stop the others; each distinct
   error is logged a bounded number of times, and a stage that keeps failing tells the player once. Counts: __SF.FRAME_ERR */
const FRAME_ERR = { n: 0, by: {}, msgs: new Map(), shown: false };
function frameErr(stage, e) {
  const m = stage + ': ' + String(e && e.message || e); FRAME_ERR.n++; const b = FRAME_ERR.by[stage] = FRAME_ERR.by[stage] || { n: 0, streak: 0 }; b.n++; b.streak++;
  const seen = FRAME_ERR.msgs.get(m) || 0; FRAME_ERR.msgs.set(m, seen + 1); if (FRAME_ERR.msgs.size > 50) FRAME_ERR.msgs.delete(FRAME_ERR.msgs.keys().next().value);
  if (seen < 3) console.error('[' + stage + ']', e); else if (seen === 3) console.error('[' + stage + '] repeating, further copies not logged:', m);
  if (b.streak === 120 && !FRAME_ERR.shown && P) { FRAME_ERR.shown = true; try { log('The game keeps hitting an error (' + m + '). Your last save is safe; reloading the page usually clears it.', '#ff6a5a'); } catch (x) { } }
}
const frameOk = stage => { const b = FRAME_ERR.by[stage]; if (b) b.streak = 0; };
function loop(t) { const dt = Math.min(.5, (t - last) / 1000); last = t;
  try { if (!SIMPAUSE) { const r = STEPPER.advance(dt, s => { simStep(s); DEV.steps++; }); ALPHA = r.alpha; } frameOk('sim'); } catch (e) { frameErr('sim', e); }
  try { if (DEV.on) devFrame(dt); renderInterp(); if (DEV.open && t - (DEV.panelT || 0) > 300) { DEV.panelT = t; devRender(); } frameOk('draw'); } catch (e) { frameErr('draw', e); }
  try { if (P && t - hudT > 120) { hudT = t; refreshHud(); drawMini(); if (PANEL === 'loot' || PANEL === 'shop') renderPanel(); renderLog(); } frameOk('hud'); } catch (e) { frameErr('hud', e); }
  requestAnimationFrame(loop); }
addEventListener('visibilitychange', () => { if (document.hidden) { resetInput(); save(); } else { last = performance.now(); STEPPER.reset(); resetInput(); } });   // the world pauses while the game is hidden; held keys and the stick are released (their key-up never arrives)
addEventListener('blur', () => resetInput());
/* dev/test hook: put a creature beside the player, e.g. __SF.spawnMon('lich_lord'). Not used by normal play. */
function spawnMon(type, dx = 3, dy = 0) { const d = MON[type]; if (!d) return null; let x = P.x + dx, y = P.y + dy;
  for (let r = 0; r < 6 && BLK[tAt(Math.floor(x), Math.floor(y))]; r += .5) for (let a = 0; a < 8; a++) { const nx = P.x + dx + Math.cos(a * Math.PI / 4) * r, ny = P.y + dy + Math.sin(a * Math.PI / 4) * r; if (!BLK[tAt(Math.floor(nx), Math.floor(ny))]) { x = nx; y = ny; break; } }
  return addEnt({ kind: 'mon', type, name: d.n, x, y, hp: d.hp, max: d.hp, state: 'idle', home: { x, y }, sect: 0, ward: 0 }); }
/* __SF is a development and test hook (the browser suites drive the game through it). It is not a security boundary: anything
   here is reachable from the console in an offline single-player game, and a multiplayer server must not trust the client. */
window.__SF = { SAVE, saveData, get saveLocked() { return saveLocked; }, NPCD, CRIM, npcDies, npcdReturn, npcdTick, npcdLooted, npcdById, npcdSave, npcdLoad, crimPreyFor, crimBodyFor, lawOutlawSeen, advGeo, ADV, npcUp, advTick, advThink, advDamaged, advDies, advResurrect, advCast, advSave, advLoad, advInspect, advDev, advPickGround, advTalk, advLooted, advById, advChoice: advSpellChoice, get LAW() { return LAW; }, LAWF, LAW_WITNESS, lawAggress, lawCrime, lawWitness, lawDowned, lawReport, lawRefuses, lawGuardTarget, lawRegion, notoOf, notoColor, lawSave, lawLoad, toggleArm, attackTick, FRAME_ERR, SHRINES, los, NPCF, NPC_FIGHT, NPC_DOWN_TIME, npcArm, damageNpc, npcEngage, npcCombatant, npcUp, npcSave, ecoTargetable, readSave, validateSave, get WS() { return WS; }, dist, closePanel, lifeSave, LIFE, LIFE_SCHED, lifeTick, lifeResume, lifeInspect, lifeTownGeo, lifeTalk, talk, ECO, ECOS, ECO_FACTIONS, factionOf, ecoThink, ecoInspect, ecoRegionCounts, ecoSave, ecoEnemy, ecoSeesPlayer, spawnTick, ecoTick, rmEnt, ecoP, ecoActivity, ecoSenseOf, ecoSenseCtx, get CRE() { return CRE; }, sndAt, beastSprite, FRONT, annWarp, annUnwarp, ANN_RIGID, get ANN_BOUNDS() { return ANN_BOUNDS; }, STAIRS, KBUILD, insideBuild, NAV, navTo, navStep, navStatic, navRequest, navTick, navGraph, navPlaces, devTraveller, lightNow, hourOfDay, STEPPER, simStep, get ALPHA() { return ALPHA; }, DEV, setDoor, SIM, simAdopt, archetypeOf, damageActor, aidOf, CONTROL, inspect: e => SIM.inspect(e, e ? Object.assign({ tick: e === P || !!CONTROL[e.ctrl] }, e === P ? { hp: [Math.round(P.hp), SF.maxHp(P)] } : null) : null), LOG, spawnMon, ANN, annTravel, annGateTo, get miniImg() { return miniImg; }, canStand, drawMap, openScreen, closeScreen, get SCREEN() { return SCREEN; }, get PANEL_K() { return PANEL; }, GW: W, GH: H, BESTIARY, bestiaryPose, get BSI() { return BSI; }, aiMon, setRng: f => { R = f || Math.random; }, RES, gq, GQD, questEvent, startCraft, startSurvey, finishStroke, migrateSave, save, get CUI() { return CUI; }, isQuayNode, QUAY_ROCKS, QUAY_TREES, guildObjective, moveBy, BUILD, LM, protAt, zoneAt, BLK, levelAt, get Q() { return Q(); }, get P() { return P; }, ents, update, render, tapWorld, interact, useSlot, castSlot, toggleArm, ACT, MON, SF, get GT() { return GT; }, get CAM() { return CAM; }, startGather, nodeAt, CHESTS, TRAPS, openPanel, get PANEL() { return PANEL; }, get AIM() { return AIM; }, releaseHeld, tAt, T, finishGather, nodeStock, SHRINES, STATIONS, damagePlayer, DOORS, useDoor, surfaceStep, damageMon, killMon, addEnt, openCorpse, JOY, firstAid, firstAidOther, finishFirstAid, swingAt, strikeOne, applyBlow, fighter, allyOf, allyDies, damageAlly, allyCommand, anatomyCheck, weaponChanged, findTool, makeAlly, FX, EFX, tSet, refreshHud, SPAWNS, screenOf: e => ({ x: (SX(e.x, e.y) - CAM.x) / CAM.f, y: (SY(e.x, e.y) - CAM.y) / CAM.f }), get W() { return wDef(); } };
Object.assign(window.__SF, { TIER, tierStep, tierBusy, tierInspect, tierMeasure, ECO_POP, ecoRestore, ecoSpawnKeys, ecoLoad });   // Living World phase 6 (src/tiers.js, src/ecology.js)
Object.defineProperties(window.__SF, { PICKT: { get: () => PICKT }, TRACKS: { get: () => TRACKS }, TRACKUI: { get: () => TRACKUI } });   // live views (Object.assign would copy a getter's value)
Object.assign(window.__SF, { skillCheck, skillUse, noteLearn, SKUI, SKLOG, useAbility, ABIL, TASKS, pickTap, tameStart, loreUse, vetStart, feedPet, peaceUse, enticeUse, provokeStart, provokeUse, stealStart, npcPack, poisonApply, lockUse, untrapUse, stealthUse, hide, finishHide, reveal, trackStart, trackFollow, magicStrike, petLoyaltyTick, petCommand, evalUse, meditate, playMusic, tamedPets, chestTrapRoll, itemSkill, eat, CHESTS, cdLeft, onPlayerMoved, begUse, campUse, lightKindling, makeCamp, forensicUse, herdPick, herdUse, snoopUse, spiritUse, digUse, treasureUp, newTreasureMap, magicLoot, CAMPS, ITEM_SKILL, ghostSpeech, killMon, MG: SF.MAGERY });
