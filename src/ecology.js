/* ================= THE MONSTER ECOSYSTEM (Living World phase 3, v0.25, integrated in v0.26; master spec §9–13, §15–16, §23) =================
   Creatures stop being fixed enemies waiting for the player. Each species has a profile (data, below): faction, habitat,
   activity hours, temperament, senses, territory, pursuit limit, prey, social behaviour and group size, retreat rule,
   respawn pace, art and sound. The pure parts live in src/world.js (SIM: factions, perception, activity, decisions with
   commitment, the spatial index, camp bookkeeping); this file drives the creatures with them:
     · ecoThink: every ~0.5 s a creature looks and listens (spatial index + line of sight + night + sleep), scores what it
       could do (attack an enemy, hunt prey, flee a threat, carry on) and commits to one choice for a while.
     · ecoIdle: roaming inside the territory by activity hours, resting, sleeping, feeding on a kill, packs following their
       leader, camp sorties (orc patrols, bandit road watches, wolf hunting trips) on the phase 2 navigator.
     · populations: wilderness regions laid out by habitat, persistent camps that stay cleared and recover slowly,
       graveyards that rise at night, spawning out of sight only, every spawned creature a real actor.
     · sound: alert / attack / death on every species that has a take or a documented stand-in, rare idle calls, night howls.
   The combat states (chase → telegraph → strike → recover) stay in aiMon (src/game.js) and work against any actor. */

/* ---------- new wildlife (procedural art in the kit's style: beastArt in src/game.js; no sheets exist yet) ---------- */
function ecoSpecies() {
  if (MON.deer) return;
  const x2 = d => { if (!d._x2) { d._x2 = 1; d.dmg = d.dmg.map(v => v * 2); } return d; };   // the same creature-damage doubling every MON entry gets
  MON.deer = x2({ n: 'red deer', col: '#8a5a36', size: 1.1, h: 54, hp: 34, atk: 30, def: 45, dmg: [3, 5], reach: 1.2, tele: .6, rec: 1.4, speed: 5.4, aggro: 12, leash: 34, armor: 6, diff: 30, tame: 40, loot: {}, skin: { hide: [2, 3], meat: [3, 4], sinew: [1, 1] } });
  MON.hare = x2({ n: 'brown hare', col: '#8a7458', size: .55, h: 22, hp: 8, atk: 20, def: 50, dmg: [1, 2], reach: 1, tele: .5, rec: 1.2, speed: 5.8, aggro: 9, leash: 24, armor: 0, diff: 15, tame: 15, loot: {}, skin: { hide: [1, 1], meat: [1, 1] } });
  MON.bear = x2({ n: 'brown bear', col: '#5a3e2a', size: 1.45, h: 64, hp: 120, atk: 62, def: 55, dmg: [10, 15], reach: 1.5, tele: .8, rec: 1.7, speed: 4.3, aggro: 6, leash: 22, armor: 18, diff: 68, tame: 75, strong: 1, bite: .5, loot: { gold: [0, 4] }, skin: { hide: [4, 5], meat: [3, 4], sinew: [2, 2] } });
  Object.assign(SPECIES_CLASS, { deer: 'animal', hare: 'animal', bear: 'animal' });
  Object.assign(CRE, { dire_wolf: 'hound', bear: 'boar', giant_spider: 'spider' });   // creature sounds: a documented stand-in where a species has no take of its own
}

/* ---------- species profiles (§9–10). Fields:
   f faction · hab habitats · hours activity (day | night | dusk | always) · temper: hostile (attacks its enemies on sight),
   territorial (attacks anything not friendly that comes within its aggro radius), timid (never starts a fight, flees),
   passive (ignores, defends only) · agg aggression · cour courage · int intelligence · nv night vision · hear hearing (m) ·
   terr territory radius (m) · pur pursuit limit from home (m; default the creature's leash) · prey species or factions it
   hunts · social solo | pack | herd | camp | swarm · grp group size · flee health fraction at which it retreats (0: never) ·
   flight distance at which a timid creature bolts · call radius in which it calls its kind for help · sated seconds a meal
   lasts · resp respawn seconds · art which art draws it · snd sound set, `sndNote` when it is a stand-in. Sight is the
   creature's existing aggro radius, so how far it notices the player is unchanged by day. */
const ECO = {
  rat:         { f: 'vermin', hab: ['coast', 'town edge', 'ruins'], hours: 'night', temper: 'hostile', agg: .55, cour: .3, int: .2, nv: .8, hear: 5, terr: 8, social: 'swarm', grp: [1, 3], call: 6, resp: 40, art: 'procedural', snd: 'rat' },
  hare:        { f: 'wildlife', hab: ['plains', 'forest'], hours: 'day', temper: 'timid', agg: 0, cour: .02, int: .2, nv: .3, hear: 9, terr: 14, social: 'solo', grp: [1, 2], flight: 7, resp: 50, art: 'procedural (new)', snd: null, sndNote: 'no take; silent' },
  deer:        { f: 'wildlife', hab: ['forest', 'plains'], hours: 'day', temper: 'timid', agg: 0, cour: .08, int: .3, nv: .4, hear: 12, terr: 26, social: 'herd', grp: [2, 4], flight: 10, call: 14, resp: 90, art: 'procedural (new)', snd: null, sndNote: 'no take; silent' },
  boar:        { f: 'wildlife', hab: ['forest'], hours: 'day', temper: 'territorial', agg: .6, cour: .75, int: .3, nv: .3, hear: 6, terr: 16, social: 'solo', grp: [1, 1], resp: 60, art: 'procedural', snd: 'boar' },
  bear:        { f: 'wildlife', hab: ['forest', 'mountain'], hours: 'day', temper: 'territorial', agg: .7, cour: .85, int: .35, nv: .5, hear: 8, terr: 30, prey: ['deer', 'hare'], social: 'solo', grp: [1, 1], flee: .15, sated: 420, resp: 300, art: 'procedural (new)', snd: 'boar', sndNote: 'boar takes as a stand-in' },
  hound:       { f: 'predators', hab: ['marsh', 'plains'], hours: 'dusk', temper: 'hostile', agg: .7, cour: .6, int: .4, nv: .85, hear: 12, terr: 24, prey: ['hare', 'rat', 'deer'], social: 'pack', grp: [2, 3], call: 14, flee: .2, sated: 300, resp: 70, art: 'procedural', snd: 'hound' },
  dire_wolf:   { f: 'predators', hab: ['forest', 'mountain'], hours: 'dusk', temper: 'hostile', agg: .75, cour: .65, int: .45, nv: .9, hear: 14, terr: 40, prey: ['deer', 'hare', 'boar'], social: 'pack', grp: [2, 3], call: 18, flee: .2, sated: 360, resp: 180, art: 'bestiary v1', snd: 'hound', sndNote: 'marsh hound takes as a stand-in' },
  snapper:     { f: 'wildlife', hab: ['marsh'], hours: 'always', temper: 'territorial', agg: .5, cour: .8, int: .1, nv: .5, hear: 4, terr: 10, social: 'solo', grp: [1, 1], resp: 70, art: 'procedural', snd: 'crab', sndNote: 'crab takes (shell)' },
  wreckcrab:   { f: 'wildlife', hab: ['coast'], hours: 'always', temper: 'territorial', agg: .5, cour: .7, int: .1, nv: .5, hear: 4, terr: 6, social: 'solo', grp: [1, 1], resp: 60, art: 'procedural', snd: 'crab' },
  spider:      { f: 'arachnids', hab: ['marsh', 'caves'], hours: 'night', temper: 'hostile', agg: .65, cour: .6, int: .2, nv: 1, hear: 6, terr: 14, prey: ['hare', 'rat'], social: 'solo', grp: [1, 2], sated: 300, resp: 70, art: 'procedural', snd: 'spider' },
  giant_spider:{ f: 'arachnids', hab: ['forest', 'caves'], hours: 'night', temper: 'hostile', agg: .7, cour: .7, int: .25, nv: 1, hear: 8, terr: 22, prey: ['deer', 'hare'], social: 'camp', grp: [1, 2], call: 12, sated: 360, resp: 150, art: 'bestiary v1', snd: 'spider', sndNote: 'mire spider takes' },
  wisp:        { f: 'elementals', hab: ['ashfen'], hours: 'night', temper: 'hostile', agg: .6, cour: .9, int: .3, nv: 1, hear: 6, terr: 14, social: 'solo', grp: [1, 1], resp: 80, art: 'procedural', snd: 'wisp' },
  slime:       { f: 'oozes', hab: ['swamp'], hours: 'always', temper: 'hostile', agg: .4, cour: 1, int: 0, nv: 1, hear: 3, terr: 10, social: 'solo', grp: [1, 2], resp: 90, art: 'bestiary v1', snd: null, sndNote: 'no take; silent' },
  skeleton:    { f: 'undead', hab: ['graveyard', 'ruins'], hours: 'night', temper: 'hostile', agg: .8, cour: 1, int: .1, nv: 1, hear: 6, terr: 14, social: 'swarm', grp: [1, 2], call: 10, resp: 90, art: 'sheet', snd: 'skeleton', night: true },
  smuggler:    { f: 'criminals', hab: ['camp', 'road'], hours: 'always', temper: 'hostile', agg: .6, cour: .6, int: .6, nv: .3, hear: 8, terr: 12, social: 'camp', grp: [1, 2], call: 12, resp: 120, art: 'scout tint', snd: null, sndNote: 'no humanoid take; weapon sounds only' },
  bandit:      { f: 'criminals', hab: ['camp', 'road'], hours: 'always', temper: 'hostile', agg: .6, cour: .5, int: .6, nv: .3, hear: 8, terr: 14, social: 'camp', grp: [2, 2], call: 14, flee: .3, resp: 120, art: 'scout tint', snd: null, sndNote: 'no humanoid take; weapon sounds only', sortie: { kind: 'scout', every: [140, 240], size: 2, wait: 45 } },
  orc:         { f: 'orcs', hab: ['camp', 'hills'], hours: 'always', temper: 'hostile', agg: .7, cour: .75, int: .5, nv: .6, hear: 10, terr: 18, prey: ['deer', 'boar', 'hare'], social: 'camp', grp: [2, 2], call: 16, sated: 600, resp: 150, art: 'bestiary v1', snd: null, sndNote: 'no orc take yet (backlog)', sortie: { kind: 'patrol', every: [160, 280], size: 2 } },
  lizardman:   { f: 'lizardfolk', hab: ['swamp', 'camp'], hours: 'always', temper: 'hostile', agg: .65, cour: .7, int: .45, nv: .7, hear: 9, terr: 18, prey: ['hare'], social: 'camp', grp: [2, 2], call: 14, sated: 600, resp: 150, art: 'bestiary v1', snd: null, sndNote: 'no take yet (backlog)' },
  harpy:       { f: 'harpies', hab: ['cliffs'], hours: 'day', temper: 'hostile', agg: .65, cour: .6, int: .3, nv: .4, hear: 10, terr: 22, prey: ['hare', 'deer'], social: 'camp', grp: [2, 2], call: 16, sated: 400, resp: 150, art: 'bestiary v1', snd: null, sndNote: 'no take yet (backlog)' },
  troll:       { f: 'giants', hab: ['forest', 'mountain pass'], hours: 'always', temper: 'territorial', agg: .7, cour: .9, int: .25, nv: .6, hear: 8, terr: 18, prey: ['deer', 'boar'], social: 'solo', grp: [1, 1], call: 12, sated: 600, resp: 300, art: 'bestiary v1', snd: null, sndNote: 'no take yet (backlog)' },
  ettin:       { f: 'giants', hab: ['forest', 'mountain pass'], hours: 'always', temper: 'territorial', agg: .7, cour: .95, int: .2, nv: .6, hear: 8, terr: 18, social: 'solo', grp: [1, 1], call: 12, resp: 360, art: 'bestiary v1', snd: null, sndNote: 'no take yet (backlog)' },
  gargoyle:    { f: 'constructs', hab: ['dungeon mouth'], hours: 'always', temper: 'hostile', agg: .7, cour: 1, int: .4, nv: 1, hear: 8, terr: 10, social: 'camp', grp: [1, 1], call: 10, resp: 300, art: 'bestiary v1', snd: null, sndNote: 'no take yet (backlog)' },
  earth_elemental: { f: 'elementals', hab: ['caves', 'mines'], hours: 'always', temper: 'hostile', agg: .6, cour: 1, int: .2, nv: 1, hear: 6, terr: 10, social: 'solo', grp: [1, 1], resp: 360, art: 'bestiary v1', snd: null, sndNote: 'no take yet (backlog)' },
  sentinel:    { f: 'constructs', hab: ['dungeon'], hours: 'always', temper: 'hostile', agg: .7, cour: 1, int: .2, nv: 1, hear: 6, terr: 10, social: 'solo', grp: [1, 2], resp: 120, art: 'procedural', snd: null },
  captain:     { f: 'undead', hab: ['dungeon'], hours: 'always', temper: 'hostile', agg: .8, cour: 1, int: .6, nv: 1, hear: 8, terr: 12, social: 'solo', grp: [1, 1], resp: 180, art: 'scout tint', snd: null },
  bellkeeper:  { f: 'constructs', hab: ['dungeon'], hours: 'always', temper: 'hostile', agg: 1, cour: 1, int: .5, nv: 1, hear: 10, terr: 8, social: 'solo', grp: [1, 1], resp: 600, art: 'procedural (boss)', snd: null, boss: true },
  lich_lord:   { f: 'undead', hab: ['crypt'], hours: 'always', temper: 'hostile', agg: 1, cour: 1, int: .9, nv: 1, hear: 12, terr: 10, social: 'solo', grp: [1, 1], resp: 900, art: 'bestiary v1 (boss)', snd: null, boss: true } };
const ECO_DEFAULT = { f: 'wildlife', hab: [], hours: 'always', temper: 'hostile', agg: .5, cour: .7, int: .3, nv: .5, hear: 6, terr: 12, social: 'solo', grp: [1, 1], resp: 90, art: '?', snd: null };
const ecoP = t => ECO[t] || ECO_DEFAULT;
const ECO_FACTIONS = SIM.newFactions(SIM.FACTION_RULES);

/* ---------- state ---------- */
const ECOS = { grid: SIM.newGrid(8), camps: new Map(), packs: new Map(), regions: new Map(), dark: 0, period: 'day', stepN: 0, idleAt: 0, howlAt: 0, packN: 0, rng: null, kills: 0, mvm: 0, hunts: 0, flees: 0, cleared: 0, replenished: 0, sunk: 0, sorties: 0, thinkMs: 0 };
const ECO_SPAWN_GAP = 22, ECO_FAR = 80;   // no spawning within 22 m of the player (out of view, no pop-in); creatures beyond 80 m that are idle think at a quarter rate

function factionOf(e) {
  if (!e) return null; if (e === P || e.kind === 'ally' || e.kind === 'pet') return 'adventurers';
  if (e.kind === 'npc') return e.role === 'guard' ? 'guards' : MERCHANT_ROLES[e.role] || SHOPS[e.role] ? 'merchants' : e.role === 'outlaw' ? 'criminals' : 'citizens';
  if (e.kind === 'mon') return ecoP(e.type).f; return null;
}
/* rough fighting strength, for courage: health times damage per second */
function ecoPower(e) {
  if (e === P) return Math.max(1, P.hp) * 9; if (isAlly(e)) return Math.max(1, e.hp) * 8;
  const d = e.type && MON[e.type]; if (!d) return 100; return Math.max(1, e.hp) * (d.dmg[0] + d.dmg[1]) / 2 / Math.max(.8, d.tele + d.rec);
}
function ecoActivity(m) { const pr = ecoP(m.type); return SIM.activityOf(pr.hours, ECOS.period); }
const ecoHungry = m => GT > (m.fedAt ?? -1e9) + (ecoP(m.type).sated || 300);
const ecoPreys = (pr, c) => !!pr.prey && c.kind === 'mon' && (pr.prey.includes(c.type) || pr.prey.includes(ecoP(c.type).f));
function ecoSenseOf(m) { const d = MON[m.type], pr = ecoP(m.type); return { sight: d.aggro, hear: pr.hear || d.aggro * .6, nightVision: pr.nv || 0 }; }
function ecoSenseCtx(m) { return { dark: ECOS.dark, activity: ecoActivity(m), alert: GT - (m.hitT ?? -99) < 8 || (m.alertUntil || 0) > GT }; }
/* would this creature start a fight with c? (faction hostility, or a territorial creature defending its ground) */
function ecoEnemy(m, c) {
  const pr = ecoP(m.type), fc = factionOf(c); if (!fc || pr.temper === 'timid' || pr.temper === 'passive') return false;
  if (c.kind === 'mon' && c.sp && m.sp && c.sp === m.sp) return false;
  if (pr.temper === 'territorial') return !ECO_FACTIONS.friendly(pr.f, fc) && pr.f !== fc;
  return ECO_FACTIONS.hostile(pr.f, fc);
}
/* the player check aiMon makes every step while idle: perception rules, not omniscience (night, sleep, Hiding) */
function ecoSeesPlayer(m) {
  if (P.ghost || P.hidden || m.pacified > GT || (protAt(P.x, P.y) && !m.quest)) return false;
  if (!ecoEnemy(m, P)) return false; const dd = dist(m, P); const r = SIM.senseRange(ecoSenseOf(m), ecoSenseCtx(m));
  return dd < r.sight && los(m, P);
}
const ecoTargetable = (m, c) => c && c !== m && !c.gone && !c.dead && !c.ghost && c.kind !== 'corpse' && c.kind !== 'npc' && !(c === P && (P.ghost || P.hidden)) && !(protAt(c.x, c.y) && !m.quest) && (c.kind !== 'mon' || c.hp > 0);

/* ---------- think: look, listen, score, commit (§12, §13) ---------- */
function ecoThink(m) {
  if (m.kind !== 'mon' || !m.home || GT < (m.thinkAt || 0)) return; const t0 = DEV.on ? performance.now() : 0;
  m.thinkAt = GT + .45 + (m.id % 10) * .01;
  const pr = ecoP(m.type), d = MON[m.type], mind = m.mind || (m.mind = {}), sense = ecoSenseOf(m), ctx = ecoSenseCtx(m), rng = SIM.senseRange(sense, ctx);
  const reach = Math.max(rng.sight, rng.hear, pr.flight || 0) + .5, myPow = ecoPower(m), hpF = m.hp / m.max, opts = [{ act: 'carry on', score: .2, why: ctx.activity === 'active' ? 'nothing in sight' : ctx.activity }];
  let seen = 0, kin = 1; const calm = m.pacified > GT, anchor = m.anchor || m.home;
  ECOS.grid.query(m.x, m.y, reach, c => {
    if (!ecoTargetable(m, c)) return; const dd = dist(m, c); if (c.kind === 'mon' && c.type === m.type) { kin++; return; }
    const sensed = SIM.detect(sense, ctx, dd, { los: dd <= rng.sight && los(m, c), moving: c.speed > 1.2, noisy: GT - (c.lastCombat ?? c.hitT ?? -99) < 3 || (ecoPreys(pr, c) && ecoHungry(m)), hidden: c === P ? P.hidden : c.hidden });
    if (!sensed) return; seen++;
    const cp = c.kind === 'mon' ? ecoP(c.type) : null, near = 1 - Math.min(1, dd / (rng.sight + 1)), ratio = ecoPower(c) / myPow;
    const hunted = cp && ecoPreys(cp, m) && c.hp > 0, enemy = ecoEnemy(m, c);
    // a threat to run from: a predator that eats me, or (timid) anything not of my kind that comes too close or is hostile
    if (hunted || (pr.temper === 'timid' && dd < (pr.flight || 6) && (ECO_FACTIONS.hostile(pr.f, factionOf(c)) || factionOf(c) !== pr.f)))
      opts.push({ act: 'flee:' + aidOf(c), c, kind: 'flee', score: (1 - pr.cour) * (.7 + .4 * (1 - dd / ((pr.flight || 6) + rng.sight))), why: (hunted ? 'hunted by ' : 'startled by ') + (c.name || aidOf(c)) });
    if (calm) return;
    if (enemy && !(pr.temper === 'territorial' && dd > d.aggro * (ctx.activity === 'sleep' ? .5 : 1))) {
      const brave = !pr.flee || ratio / kin * (1 - pr.cour) < 1.2 || pr.cour >= .95;   // a creature with a retreat rule does not pick a fight it cannot win; the rest stand their ground as before
      if (brave) opts.push({ act: 'attack:' + aidOf(c), c, kind: 'attack', score: .35 + pr.agg * (.5 + .5 * near) + (c === P ? .05 : 0), why: (pr.temper === 'territorial' ? 'defends its ground against ' : 'enemy: ') + (c.name || aidOf(c)) });
      else opts.push({ act: 'flee:' + aidOf(c), c, kind: 'flee', score: .5 + (1 - pr.cour) * .5, why: 'outmatched by ' + (c.name || aidOf(c)) });
    }
    if (ecoPreys(pr, c) && ecoHungry(m) && ctx.activity !== 'sleep' && !m.sortie && !(m.leader && m.leader.sortie) && Math.hypot(c.x - anchor.x, c.y - anchor.y) < (pr.pur || d.leash) * 1.2)
      opts.push({ act: 'hunt:' + aidOf(c), c, kind: 'hunt', score: .3 + .45 * near * (ctx.activity === 'active' ? 1 : .6), why: 'hunting ' + (c.name || aidOf(c)) });
  });
  // keep chasing what it already fights (last known position) while that is still possible
  if (m.target && ecoTargetable(m, m.target) && (m.state === 'chase' || m.state === 'tele' || m.state === 'strike' || m.state === 'rec')) {
    const key = (m.chaseKind === 'hunt' ? 'hunt:' : 'attack:') + aidOf(m.target); const cur = opts.find(o => o.act === key);
    if (!cur) opts.push({ act: key, c: m.target, kind: m.chaseKind || 'attack', score: .55, why: 'still after ' + (m.target.name || aidOf(m.target)) }); else cur.score += .1; }
  // badly hurt: a creature with a retreat rule runs from whatever is hurting it
  if (pr.flee && hpF < pr.flee && m.target && !m.fleeDone) opts.push({ act: 'flee:' + aidOf(m.target), c: m.target, kind: 'flee', score: 2, force: true, why: 'badly wounded (' + Math.round(hpF * 100) + '%)' });
  m.seen = seen; const pick = SIM.decide(mind, opts, GT, { commit: 1.8, margin: .15 }); mind.kind = pick && pick.kind;
  if (pick && pick.c) ecoApply(m, pick);
  if (DEV.on) ECOS.thinkMs += performance.now() - t0;
}
function ecoApply(m, pick) {
  const c = pick.c;
  if (pick.kind === 'flee') { if (m.state === 'tele' || m.state === 'strike') return; if (m.state !== 'flee') ECOS.flees++; m.state = 'flee'; m.threat = c; m.fleeUntil = GT + 5 + R() * 3; m.target = null; if (pick.force) m.fleeDone = true; ecoCall(m, c, true); return; }
  if (m.target === c && m.state !== 'idle' && m.state !== 'return') return;
  if (m.state === 'tele' || m.state === 'strike' || m.state === 'rec') return;
  const fresh = m.target !== c; m.target = c; m.chaseKind = pick.kind; m.provoked = 0; m.state = 'chase'; if (m.nav) m.nav = null; m.feed = null; m.anchor = m.anchor || { x: m.x, y: m.y };
  if (fresh) { if (pick.kind === 'hunt') ECOS.hunts++; else if (c.kind === 'mon') ECOS.mvm++; simEmit('CombatStarted', { actor: aidOf(m), target: aidOf(c), reason: pick.kind, x: m.x, y: m.y }); ecoAlertSound(m, c); ecoCall(m, c, false, pick.kind); }
}
/* creature journeys use the navigator in legs of at most 50 m (a local search each): never a continent-wide path, never the travel graph */
function ecoNav(m, gx, gy, o) { const dd = Math.hypot(gx - m.x, gy - m.y); if (dd > 50) { const k = 50 / dd, sp = navSnap(Math.floor(m.x + (gx - m.x) * k), Math.floor(m.y + (gy - m.y) * k), 4); gx = sp[0] + .5; gy = sp[1] + .5; } return navTo(m, gx, gy, o); }
/* call for help (§13): its own kind (or camp) within the call radius join in; a herd bolts together */
function ecoCall(m, c, flee, kind) {
  const pr = ecoP(m.type); if (!pr.call) return;
  ECOS.grid.query(m.x, m.y, pr.call, o => {
    if (o === m || o.kind !== 'mon' || o.gone || o.dead || o.pacified > GT) return; if (!(o.type === m.type || (o.sp && m.sp && o.sp.camp && o.sp.camp === m.sp.camp))) return;
    if (o.state !== 'idle' && o.state !== 'return') return;
    if (flee) { if (ecoP(o.type).temper === 'timid') { o.state = 'flee'; o.threat = c; o.fleeUntil = GT + 5 + R() * 3; } return; }
    if (!ecoTargetable(o, c)) return; o.target = c; o.state = 'chase'; o.alertUntil = GT + 10; o.nav = null; o.mind = o.mind || {}; kind = kind || 'attack'; o.mind.act = kind + ':' + aidOf(c); o.mind.at = GT; o.mind.kind = kind; o.chaseKind = kind; o.mind.why = 'answered ' + (m.name || 'a call');
  });
}
/* a creature leaves the world without dying (sunk into its grave, cleared away): its spawner and camp count it gone, no clearance */
function ecoLeft(m) { const s = m.sp; if (!s) return; s.n = Math.max(0, s.n - 1); if (s.camp) s.camp.removed(); m.sp = null; if (m.sortie) ecoSortieEnd(m); }
/* hooks from the shared damage entry and death (src/game.js) */
function ecoHurt(m, src) {
  if (m.kind !== 'mon' || !src || src === m) return; const pr = ecoP(m.type); m.alertUntil = GT + 10;
  if (pr.temper === 'timid' && m.hp > 0) { m.state = 'flee'; m.threat = src; m.fleeUntil = GT + 6 + R() * 3; m.target = null; ECOS.flees++; ecoCall(m, src, true); return; }
  if (m.target === src) ecoCall(m, src);
}
function ecoDied(m, src) {
  if (m.sortie) ecoSortieEnd(m);   // a patrol leader killed on the road ends the patrol (the camp may send another)
  if (m.sp) { const s = m.sp; if (s.camp) { const ev = s.camp.died(GT); if (ev === 'cleared') ecoCampCleared(s.camp); } }
  if (m.packId) { const g = ECOS.packs.get(m.packId); if (g) { g.splice(g.indexOf(m), 1); if (!g.length) ECOS.packs.delete(m.packId); else if (m.leader === m || !m.leader) for (const o of g) o.leader = g[0]; } }
  ECOS.kills++;
  if (src && src.kind === 'mon' && !src.gone) { const sp = ecoP(src.type); if (ecoPreys(sp, m)) { src.fedAt = GT; src.feed = { x: m.x, y: m.y, until: GT + 12 + R() * 8 }; } if (src.mind) src.mind.act = null; }
}
function ecoCampCleared(c) {
  ECOS.cleared++; simEmit('CampCleared', { camp: c.id, x: c.x, y: c.y, detail: { clears: c.clears, recoverIn: c.recover } });
  if (P && c.x !== undefined && Math.hypot(P.x - c.x, P.y - c.y) < 40) log((c.name || 'The camp') + ' falls silent. Nothing will stir here for a good while.', '#ffe08a');
}

/* ---------- idle behaviour: roam, rest, sleep, feed, follow, sorties ---------- */
function ecoIdle(m, dt, step) {
  const d = MON[m.type], pr = ecoP(m.type), act = ecoActivity(m); m.act = act;
  if (m.feed) { if (GT > m.feed.until) m.feed = null; else { if (Math.hypot(m.feed.x - m.x, m.feed.y - m.y) > .9) step(m.feed.x, m.feed.y, d.speed * .4); m.act = 'feeding'; return; } }
  if (m.sortie) return ecoSortieStep(m, dt);
  const L = m.leader; if (L && L !== m && !L.gone && !L.dead && L.kind === 'mon') {                          // packs and herds keep together behind their leader
    const ox = ((m.id % 3) - 1) * 1.6, oy = 1.4 + (m.id % 2) * .8, gx = L.x + ox, gy = L.y + oy, dd = Math.hypot(gx - m.x, gy - m.y);
    if (L.state === 'chase' && L.target && ecoTargetable(m, L.target) && (ecoEnemy(m, L.target) || ecoPreys(pr, L.target))) { m.target = L.target; m.state = 'chase'; m.mind = m.mind || {}; m.mind.kind = m.chaseKind = L.chaseKind || 'attack'; m.mind.act = m.mind.kind + ':' + aidOf(L.target); m.mind.at = GT; m.mind.why = 'with its leader'; return; }
    if (dd > 12) { m.nav = null; if (!m.navFollow || GT > m.navFollow) { m.navFollow = GT + 4; ecoNav(m, gx, gy, { doors: false, avoidProt: true, speed: d.speed * .8, name: 'pack' }); } if (m.nav && m.nav.state === 'moving') return navStep(m, dt); }
    if (dd > 1.2) step(gx, gy, d.speed * (dd > 5 ? .75 : .4)); m.act = 'following'; return; }
  if (act === 'sleep') { m.act = 'asleep'; return; }
  const rad = (pr.terr || 12) * (act === 'active' ? 1 : .3) * (pr.night && act === 'active' ? 1.6 : 1);
  if (!m.wt || GT > m.wt || (m.wStuck || 0) > 2) {
    m.wt = GT + (act === 'active' ? 4 + R() * 8 : 9 + R() * 12); m.wStuck = 0;
    let ok = false; for (let k = 0; k < 6 && !ok; k++) { const x = m.home.x + (R() - .5) * 2 * rad, y = m.home.y + (R() - .5) * 2 * rad; if (canStand(m, x, y) && levelAt(Math.floor(x), Math.floor(y)) === levelAt(Math.floor(m.home.x), Math.floor(m.home.y))) { m.wx = x; m.wy = y; ok = true; } }
    if (!ok) { m.wx = m.x; m.wy = m.y; } }
  const dd = Math.hypot(m.wx - m.x, m.wy - m.y);
  if (dd > .4) { const x0 = m.x, y0 = m.y; step(m.wx, m.wy, d.speed * (act === 'active' ? .35 : .22)); if (Math.hypot(m.x - x0, m.y - y0) < .002) m.wStuck = (m.wStuck || 0) + dt; m.act = act === 'active' ? 'roaming' : 'resting'; }
  else m.act = act === 'active' ? 'idle' : 'resting';
}
/* a sortie leader walks out to its goal on the navigator, waits there a while (bandits lie in ambush), and walks home; the rest follow it */
function ecoSortieStep(m, dt) {
  const s = m.sortie, d = MON[m.type];
  if (s.t0 === undefined || s.tp !== s.phase) { s.t0 = GT; s.tp = s.phase; }
  if ((s.phase === 'out' && GT - s.t0 > 150) || (s.phase === 'back' && GT - s.t0 > 200)) { if (s.phase === 'out') { s.phase = 'wait'; s.until = GT + (s.wait || 8); m.nav = null; return; } ecoSortieEnd(m); m.state = 'return'; return; }   // a leg that cannot be finished never strands the patrol
  if (s.phase === 'out' || s.phase === 'back') {
    if (!m.nav || m.nav.goal.name !== s.phase) ecoNav(m, s.phase === 'out' ? s.gx : m.home.x, s.phase === 'out' ? s.gy : m.home.y, { doors: false, avoidProt: true, speed: d.speed * .55, name: s.phase });
    if (m.nav.state === 'moving') { navStep(m, dt); m.act = s.kind + (s.phase === 'out' ? ' (out)' : ' (home)'); m.anchor = { x: m.x, y: m.y }; return; }
    if (s.phase === 'back' && Math.hypot(m.x - m.home.x, m.y - m.home.y) > 3 && m.nav.state === 'done') { m.nav = null; return; }   // a long way home: the next leg
    if (s.phase === 'out' && Math.hypot(m.x - s.gx, m.y - s.gy) > 3 && m.nav.state === 'done') { m.nav = null; return; }
    if (s.phase === 'out') { s.phase = 'wait'; s.until = GT + (s.wait || 8); m.nav = null; if (s.kind === 'scout' && MON[m.type].hideChance) for (const o of ecoFollowers(m).concat([m])) o.hidden = true; return; }
    return ecoSortieEnd(m);
  }
  if (s.phase === 'wait') { m.act = s.kind === 'scout' ? 'watching the road' : 'looking around'; if (GT > s.until) { s.phase = 'back'; m.nav = null; for (const o of ecoFollowers(m).concat([m])) o.hidden = false; } }
}
const ecoFollowers = L => ents.filter(o => o.kind === 'mon' && o.leader === L && o !== L && !o.gone);
function ecoSortieEnd(m) { const s = m.sortie; if (!s) return; m.sortie = null; m.nav = null; m.anchor = null; for (const o of ecoFollowers(m)) { o.leader = o.ownLeader || null; o.hidden = false; } if (s.camp) s.camp.sortie = null; }

/* ---------- populations (§15–16) ----------
   Regions: every spawner belongs to one, by habitat cell, camp, graveyard or dungeon level. Camps (src/frontier.js sites) are
   persistent: SIM.newCamp records clearance, which is saved. Wilderness cells get wildlife by habitat from their own seeded
   stream, so the map itself is unchanged. */
const ECO_CELL = 150;
const ECO_BIOME = {
  forest:   { cap: 6, mix: g => [['deer', 3, 3], ['hare', 1, 1]].concat(g.wild ? (g.h % 3 === 0 ? [['dire_wolf', 3, 3]] : g.h % 4 === 1 ? [['bear', 1, 1]] : []) : []) },
  plains:   { cap: 4, mix: g => [['hare', 2, 1]].concat(g.h % 2 ? [] : [['deer', 2, 2]]) },
  swamp:    { cap: 3, mix: g => g.wild ? [['slime', 2, 1], ['hare', 1, 1]] : [['hare', 1, 1]] },
  mountain: { cap: 4, mix: g => g.wild ? [['bear', 1, 1], g.h % 2 ? ['dire_wolf', 2, 2] : ['hare', 2, 1]] : [['hare', 2, 1]] } };
function ecoGenerate() {
  ecoSpecies(); ECOS.regions.clear(); ECOS.camps.clear();
  const rng = SIM.stream(1999, 'population'), C = ECO_CELL, nx = Math.ceil(W / C), ny = Math.ceil(H / C);
  for (let cy = 0; cy < ny; cy++) for (let cx = 0; cx < nx; cx++) {
    const x0 = cx * C, y0 = cy * C; let land = 0, tree = 0, grass = 0, swamp = 0, rock = 0, prot = 0, site = 0, tot = 0; const spots = { forest: [], plains: [], swamp: [], mountain: [] };
    for (let y = y0 + 1; y < Math.min(H, y0 + C); y += 3) for (let x = x0 + 1; x < Math.min(W, x0 + C); x += 3) {
      tot++; if (levelAt(x, y) || VOID[y * W + x]) continue; const t = tAt(x, y); if (t === T.WA) continue; land++;
      if (protAt(x, y)) { prot++; continue; } const z = zoneAt(x, y); if (z && (z.startsWith('site_') || z === 'camp' || z === 'causeway')) { site++; continue; }
      if (t === T.TR) tree++; else if (t === T.G) { grass++; if (hash(x, y) % 7 === 0) (tAt(x + 3, y) === T.TR || tAt(x - 3, y) === T.TR || tAt(x, y + 3) === T.TR ? spots.forest : spots.plains).push([x, y]); }
      else if (t === T.SH || t === T.MR) { swamp++; } else if (t === T.RK || t === T.CL) rock++;
      if ((t === T.MR || t === T.SH) && hash(x, y) % 5 === 0) for (const [ox, oy] of [[2, 0], [-2, 0], [0, 2]]) if (tAt(x + ox, y + oy) === T.G) { spots.swamp.push([x + ox, y + oy]); break; }
      if ((t === T.RK || t === T.CL) && hash(x, y) % 5 === 0) for (const [ox, oy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) if (tAt(x + ox, y + oy) === T.G || tAt(x + ox, y + oy) === T.DI) { spots.mountain.push([x + ox, y + oy]); break; }
    }
    if (land < tot * .3) continue; const open = land - prot - site; if (open < tot * .2) continue;
    const biome = swamp / open > .12 ? 'swamp' : rock / open > .08 ? 'mountain' : tree / open > .045 ? 'forest' : grass / open > .5 ? 'plains' : null; if (!biome) continue;
    const starter = x0 < SW && y0 < SW, g = { wild: !starter && prot === 0, h: (cx * 7 + cy * 13 + (rng() * 1000 | 0)) };
    const pool = spots[biome].length ? spots[biome] : spots.plains.length ? spots.plains : spots.forest; if (!pool.length) continue;
    const id = 'wild:' + cx + ',' + cy; ECOS.regions.set(id, { id, kind: biome, name: biome + ' ' + cx + ',' + cy, x: x0 + C / 2, y: y0 + C / 2 });
    for (const [type, max, pack] of ECO_BIOME[biome].mix(g)) {
      const [sx, sy] = pool[Math.floor(rng() * pool.length)];
      SPAWNS.push({ type, x: sx + .5, y: sy + .5, r: 26, max, pack, n: 0, next: 0, region: id, eco: 1, biome });
    }
  }
  // regions for the spawners that already existed: camps, graveyards, dungeon levels, the old wilderness points
  for (const s of FRONT.sites) if (s.k === 'camp' || s.k === 'dungeon') {
    const sps = SPAWNS.filter(p => p.site === s.id); if (!sps.length) continue;
    const graves = s.camp === 'graves', cap = sps.reduce((a, p) => a + p.max, 0);
    const camp = SIM.newCamp({ id: s.id, cap: cap + (graves ? Math.ceil(cap / 2) : 0), recover: s.k === 'dungeon' ? 900 : 1500, trickle: 75 });
    Object.assign(camp, { name: s.n, x: s.x, y: s.y, site: s, kind: s.camp || 'guard', sortieAt: 60 + rng() * 120 });
    ECOS.camps.set(s.id, camp); ECOS.regions.set('camp:' + s.id, { id: 'camp:' + s.id, kind: graves ? 'graveyard' : s.k === 'dungeon' ? 'dungeon mouth' : 'camp', name: s.n, x: s.x, y: s.y });
    for (const p of sps) { p.camp = camp; p.region = 'camp:' + s.id; if (graves) p.nightMax = p.max + Math.ceil(p.max / 2); }
  }
  for (const p of SPAWNS) {
    if (p.region) continue; const lv = levelAt(Math.floor(p.x), Math.floor(p.y));
    if (lv) { p.region = 'dungeon:bell' + lv; if (!ECOS.regions.has(p.region)) ECOS.regions.set(p.region, { id: p.region, kind: 'dungeon level', name: 'Sunken Bell ' + lv, x: p.x, y: p.y }); continue; }
    if (p.type === 'skeleton') { p.region = 'graves:' + Math.round(p.x) + ',' + Math.round(p.y); p.nightMax = p.max + Math.ceil(p.max / 2); ECOS.regions.set(p.region, { id: p.region, kind: 'graveyard', name: 'graves', x: p.x, y: p.y }); continue; }
    const cx = Math.floor(p.x / C), cy = Math.floor(p.y / C); p.region = 'wild:' + cx + ',' + cy;
    if (!ECOS.regions.has(p.region)) ECOS.regions.set(p.region, { id: p.region, kind: 'wilderness', name: 'wilds ' + cx + ',' + cy, x: cx * C + C / 2, y: cy * C + C / 2 });
  }
}
const ecoRegionCounts = () => { const o = {}; for (const r of ECOS.regions.values()) o[r.id] = { kind: r.kind, n: 0, cap: 0 }; for (const s of SPAWNS) { const r = o[s.region]; if (r) { r.n += s.n; r.cap += Math.max(s.max, s.nightMax || 0); } } return o; };
const ecoNight = () => ECOS.period === 'night' || ECOS.period === 'deepnight' || ECOS.period === 'sunset';
/* a spawner's place for one creature: inside its radius, on open, walkable ground of the right level, nobody standing there,
   out of the player's sight. Returns [x, y] or null. */
function ecoSpot(s, boot) {
  for (let k = 0; k < 14; k++) {
    const x = s.x + (R() - .5) * 2 * s.r, y = s.y + (R() - .5) * 2 * s.r, tx = Math.floor(x), ty = Math.floor(y), t = tAt(tx, ty);
    if (BLK[t] || t === T.WA || t === T.BR || t === T.SD || t === T.SU || t === T.SH || protAt(tx, ty) || zoneAt(tx, ty) === 'camp') continue;
    if (levelAt(tx, ty) !== levelAt(Math.floor(s.x), Math.floor(s.y))) continue;
    if (!canStand({ kind: 'mon' }, x, y)) continue;
    if (P && Math.hypot(x - P.x, y - P.y) < (s.boss ? 4 : boot ? 12 : ECO_SPAWN_GAP)) continue;
    let crowd = false; ECOS.grid.query(x, y, 1.2, () => { crowd = true; }); if (crowd) continue;
    return [x, y];
  }
  return null;
}
function spawnTick(boot) {
  const night = ecoNight();
  for (const s of SPAWNS) {
    const cap = night && s.nightMax ? s.nightMax : s.max;
    if (s.n >= cap || GT < s.next) continue;
    if (s.camp && !s.camp.canSpawn(GT)) continue;
    s.next = GT + (s.delay || (s.eco || s.camp ? ecoP(s.type).resp * (.6 + R() * .8) : 6 + R() * 6));
    const at = ecoSpot(s, boot); if (!at) continue; const [x, y] = at;
    const n = Math.min(s.pack || 1, cap - s.n), pk = n > 1 ? ++ECOS.packN : 0, grp = [];
    for (let i = 0; i < n; i++) {
      const d = MON[s.type], px = x + i * .8, py = y + i * .5, ok = canStand({ kind: 'mon' }, px, py);
      const m = addEnt({ kind: 'mon', type: s.type, name: d.n, x: ok ? px : x, y: ok ? py : y, hp: d.hp, max: d.hp, state: 'idle', home: { x, y }, sp: s, sect: rnd(0, 7), ward: d.ward && !d.wardEvery ? d.ward : 0, hidden: d.hideChance && R() < d.hideChance, purse: d.purse ? rnd(d.purse[0], d.purse[1]) : 0 });
      m.fedAt = GT - R() * (ecoP(s.type).sated || 300); s.n++; grp.push(m); ECOS.grid.add(m);
      if (s.camp) { const ev = s.camp.spawned(GT); if (ev) { ECOS.replenished++; simEmit('PopulationReplenished', { camp: s.camp.id, species: s.type, x, y, detail: { alive: s.camp.alive, cap: s.camp.cap, state: ev } }); } }
    }
    if (pk) { ECOS.packs.set(pk, grp); for (const m of grp) { m.packId = pk; m.leader = grp[0]; m.ownLeader = grp[0]; } }
  }
}
/* at dawn the extra dead that rose for the night walk back to their graves and sink out of sight (never in view) */
function ecoSinkTick() {
  if (ecoNight()) return;
  for (const s of SPAWNS) { if (!s.nightMax || s.n <= s.max) continue;
    const m = ents.find(e => e.kind === 'mon' && e.sp === s && e.state === 'idle' && !e.target && !e.gone && (!P || dist(e, P) > 18)); if (!m) continue;
    m.sinkT = m.sinkT || GT; if (Math.hypot(m.x - m.home.x, m.y - m.home.y) > 2.5 && GT - m.sinkT < 45) { m.wx = m.home.x; m.wy = m.home.y; m.wt = GT + 20; continue; }   // walks back to its grave; one that cannot get there within 45 s sinks where it stands (still out of sight)
    rmEnt(m); ECOS.sunk++; }   // rmEnt settles the spawner and camp counts (ecoLeft)
}
/* camps send members out: orc patrols down the trail to the road, bandits to watch the road, wolf packs on hunting trips */
function ecoCampTick() {
  for (const c of ECOS.camps.values()) {
    if (c.sortie && (c.sortie.gone || c.sortie.dead || !c.sortie.sortie)) c.sortie = null;   // a leader that died, sank or was tamed
    if (c.sortie || GT < c.sortieAt) continue; const s = c.site; c.sortieAt = GT + 200;
    const mem = ents.filter(e => e.kind === 'mon' && e.sp && e.sp.camp === c && e.state === 'idle' && !e.sortie && !e.gone && !(e.pacified > GT));
    if (!mem.length) { c.sortieAt = GT + 30; continue; } const pr = ecoP(mem[0].type), so = pr.sortie || (pr.social === 'pack' ? { kind: 'hunt', every: [240, 420], size: 3 } : null); if (!so) continue;
    c.sortieAt = GT + so.every[0] + R() * (so.every[1] - so.every[0]);
    if (so.kind === 'hunt' && ecoActivity(mem[0]) !== 'active') continue;
    let gx, gy; if (so.kind === 'hunt') { let ok = false; for (let k = 0; k < 8 && !ok; k++) { const a = R() * 6.283, r = 30 + R() * 30; gx = s.x + Math.cos(a) * r; gy = s.y + Math.sin(a) * r; ok = canStand({ kind: 'mon' }, gx, gy) && !protAt(gx, gy); } if (!ok) continue; }
    else { if (!s.join) continue; let jx = s.join[0] + .5, jy = s.join[1] + .5, dj = Math.hypot(jx - s.x, jy - s.y); if (dj < 1) { const a = R() * 6.283; jx = s.x + Math.cos(a); jy = s.y + Math.sin(a); dj = 1; }
      let ok = false; for (let want = so.kind === 'scout' ? Math.min(dj, 50) : 45; want >= 15 && !ok; want -= 5) {   // down the trail toward the road (patrols carry on past it); the nearest valid point if the first is not; short trips only
        const k = want / dj, sp = navSnap(Math.floor(s.x + (jx - s.x) * k), Math.floor(s.y + (jy - s.y) * k), 5); gx = sp[0] + .5; gy = sp[1] + .5; ok = !protAt(gx, gy) && canStand({ kind: 'mon' }, gx, gy); }
      if (!ok) { c.sortieAt = GT + 30; continue; } }
    const L = mem[0], grp = mem.slice(0, so.size); L.sortie = { kind: so.kind, gx, gy, phase: 'out', wait: so.wait || 10, camp: c }; c.sortie = L; ECOS.sorties++;
    for (const o of grp) if (o !== L) o.leader = L;
  }
}

/* ---------- per-step upkeep: index, light, think tiers, population and sound ---------- */
function ecoTick() {
  ECOS.stepN++; const G = ECOS.grid;
  if (ECOS.stepN % 200 === 0) { G.clear(); }
  for (const e of ents) { if (e.gone || e.kind === 'corpse') { if (e._gk !== undefined) G.remove(e); continue; } G.move(e); }
  if (ECOS.stepN % 10 === 1) { const L = lightNow(); ECOS.dark = levelAt(Math.floor(P.x), Math.floor(P.y)) ? .8 : L.dark; ECOS.period = WS ? WS.clock.periodAt(GT) : 'day'; }
  if (ECOS.stepN % 20 === 7) { ecoCampTick(); ecoSinkTick(); }
}
/* distant idle creatures think and move at a quarter rate (a first simulation tier; phase 6 formalises tiers A/B/C) */
function ecoSkip(e, dt) {
  if (e.state !== 'idle' || e.target || e.sortie || (e.leader && e.leader.sortie) || !P) { if (e._acc) { const a = e._acc; e._acc = 0; return a + dt; } return dt; }
  const far = Math.abs(e.x - P.x) + Math.abs(e.y - P.y) > ECO_FAR; if (!far) { const a = (e._acc || 0) + dt; e._acc = 0; return a; }
  e._acc = (e._acc || 0) + dt; if ((ECOS.stepN + e.id) % 4) return 0; const a = e._acc; e._acc = 0; return a;
}
/* push-apart through the index (was every entity against every other) */
function ecoSeparate(m) { ECOS.grid.query(m.x, m.y, .7, o => { if (o === m || (o.kind !== 'mon' && o.kind !== 'pet') || o.gone) return; const dx = m.x - o.x, dy = m.y - o.y, l = Math.hypot(dx, dy); if (l > 0 && l < .7) moveBy(m, dx / l * .02, dy / l * .02); }); }
/* sound (§23): detection on the first sight of a target, rare idle calls nearby, night howls in the distance. Audio randomness
   only (its own stream), so sound never changes the simulation. */
function ecoAlertSound(m, c) { if (c === P) return; const sp = CRE[m.type];   // the player's own alert plays in monSound
  if (!sp || !SFXA.has(sp + '.alert') || !P || dist(m, P) > 26) return; if (!sndOnce('alert' + m.id, 4)) return; sndAt(sp + '.alert', m, { gain: c === P ? 1 : .7 }); }
function ecoSoundTick(m) {
  if (!P || m.state !== 'idle' || GT < ECOS.idleAt) return; const sp = CRE[m.type]; if (!sp) return;
  const rng = ECOS.rng || (ECOS.rng = SIM.stream((Date.now() >>> 0), 'creature-audio')); const dd = dist(m, P);
  if (GT < (m.idleAt ?? (m.idleAt = GT + 8 + rng() * 25))) return;
  m.idleAt = GT + 18 + rng() * 30;
  const howl = (m.type === 'dire_wolf' || m.type === 'hound') && ecoNight() && dd < 55 && GT > ECOS.howlAt;
  if (howl) { ECOS.howlAt = GT + 25; ECOS.idleAt = GT + 3; if (SFXA.has(sp + '.alert')) sndAt(sp + '.alert', m, { gain: .55, prio: 1 }); return; }
  if (dd < 18 && m.act !== 'asleep' && SFXA.has(sp + '.alert')) { ECOS.idleAt = GT + 4; sndAt(sp + '.alert', m, { gain: .3, prio: 1 }); }
}

/* ---------- save: camp clearance (creatures themselves respawn on load until world-state persistence, phase 6) ---------- */
function ecoSave() { const camps = {}; for (const [k, c] of ECOS.camps) camps[k] = c.save(); return { v: 1, camps }; }
function ecoLoad(saved) {
  const camps = saved && saved.camps; if (!camps) return;
  for (const [k, c] of ECOS.camps) if (camps[k]) { const nc = SIM.newCamp({ id: c.id, cap: c.cap, recover: c.recover, trickle: c.trickle }, camps[k]); for (const f of ['name', 'x', 'y', 'site', 'kind', 'sortieAt']) nc[f] = c[f]; ECOS.camps.set(k, nc); for (const s of SPAWNS) if (s.camp === c) s.camp = nc; }
}
function ecoInspect(e) {
  if (!e || e.kind !== 'mon') return {}; const pr = ecoP(e.type), r = SIM.senseRange(ecoSenseOf(e), ecoSenseCtx(e));
  return { faction: pr.f, temper: pr.temper, activity: (e.act || ecoActivity(e)) + ' (' + pr.hours + ')', decision: e.mind && e.mind.why ? e.mind.why + (e.mind.act ? ' [' + e.mind.act + ']' : '') : '—',
    senses: 'sight ' + r.sight.toFixed(1) + ' m, hearing ' + r.hear.toFixed(1) + ' m, perceived ' + (e.seen || 0), hungry: pr.prey ? ecoHungry(e) : null,
    pack: e.packId ? (e.leader === e ? 'leader of ' : 'follows ' + aidOf(e.leader) + ' in ') + 'pack ' + e.packId : null, camp: e.sp && e.sp.camp ? e.sp.camp.name + (e.sortie ? ' · on ' + e.sortie.kind : '') : null,
    region: e.sp ? e.sp.region : null, art: pr.art, sound: (CRE[e.type] || 'none') + (pr.sndNote ? ' — ' + pr.sndNote : '') };
}
