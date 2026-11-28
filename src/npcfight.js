/* ================= NPC COMBAT (Living World phase 5, step 1, v0.30; master spec §18) =================
   Townsfolk, the travelling merchant and the town guards become real combatants:
     · Creatures may pick a townsperson as a target outside protected ground, by the same faction rules they use for the player
       (predators, vermin, undead … are hostile to citizens, merchants and guards). Inside protected ground nobody is targetable, as before.
     · Every blow goes through the one shared resolver (swingAt / strikeOne → applyBlow → damageActor). NPCs fight with
       weapons, skills and armor like Wren, so the numbers are the existing Second Age rules, unchanged.
     · Guards of the four Anniabreen towns fight back: a creature attacking a person (townsfolk, the merchant, you or Wren)
       within a guard's sight and the town's jurisdiction draws the nearest guards, who leave their patrol, fight it with
       their halberds, give up when it leaves the jurisdiction, and go back to patrolling. They also answer a cry for help.
     · Everyone else runs: a hit townsperson drops what they are doing and shelters (phase 4's danger response), shouting for
       the guards; the merchant hurries on.
     · At 0 health an NPC is knocked down, not killed: creatures lose interest, and after NPC_DOWN_TIME they get up with a
       third of their health and go home to recover. Real NPC death, corpses and looting are phase 5 step 4.
     · Since v0.34 (phase 5 step 2, src/law.js) you can attack townsfolk: it is a crime unless they are grey or red or you have
       a right over them, witnesses call the guards, and the guards fight you inside their jurisdiction like any creature.
   Pure numbers live here as data; the game's existing functions call in through npcFighter / damageNpc / npcCombatTick. */

const NPC_DOWN_TIME = 60;          // seconds lying wounded before getting up
const NPC_GUARD_SIGHT = 16;        // a guard notices a fight this far away (and in line of sight)
const NPC_JURISDICTION = 60;       // guards defend this far from their town's centre; a creature beyond JUR + 12 is let go
const NPC_CALL_RANGE = 30;         // a cry for help reaches guards this far away
/* fighting profiles by profession; skills are UO values (0–100) */
const NPC_FIGHT = {
  guard:      { str: 85, dex: 70, int: 40, hp: 1.6, weapon: 'glaive', skills: { swordsmanship: 90, tactics: 90, anatomy: 70, parrying: 60, wrestling: 60 }, wear: ['chain_coif', 'chain_tunic', 'chain_leggings', 'boots'], fights: true },
  trader:     { str: 50, dex: 50, int: 40, hp: 1, weapon: 'dagger', skills: { fencing: 35, tactics: 30, wrestling: 30 }, wear: ['shirt', 'trousers', 'boots'] },
  miner:      { str: 60, dex: 40, int: 30, hp: 1, weapon: 'pickaxe', skills: { swordsmanship: 30, tactics: 20, wrestling: 25 }, wear: ['shirt', 'trousers', 'boots'] },
  woodcutter: { str: 60, dex: 45, int: 30, hp: 1, weapon: 'hatchet', skills: { swordsmanship: 30, tactics: 20, wrestling: 25 }, wear: ['shirt', 'trousers', 'boots'] },
  civilian:   { str: 35, dex: 40, int: 40, hp: 1, weapon: null, skills: { wrestling: 20 }, wear: ['shirt', 'trousers'] } };
const NPCF = { downs: 0, rises: 0, guardFights: 0, guardKills: 0, calls: 0, hitsTaken: 0 };
let NPC_UID = 0;
/* gear for an NPC: never saved, never in a player container, so it takes negative uids and leaves the player's uid counter alone */
function npcItem(id) {
  const d = SF.ITEMS[id]; if (!d) return null;
  const f = d.fam ? SF.EQ.fields(id, { origin: 'npc' }) : {};
  return Object.assign({ uid: -(++NPC_UID), id, qty: 1 }, f, SF.WEARABLE(id) || d.wpn ? { cond: 100, maxc: 100, omax: 100, origin: 'npc' } : {});
}
/* make a townsperson a combatant (lifePopulate calls this for everyone with a life) */
function npcArm(e) {
  const prof = e.life && e.life.prof, F = NPC_FIGHT[prof] || NPC_FIGHT.civilian;
  e.npcFight = F; e.str = F.str; e.dex = F.dex; e.int = F.int; e.skills = SF.newSkills();
  for (const k in F.skills) if (e.skills[k]) e.skills[k].v = F.skills[k] * 10;
  e.equip = emptyEquip(); if (F.weapon) e.equip.weapon = npcItem(F.weapon);
  for (const id of F.wear) { const it = npcItem(id); if (it && SF.ITEMS[id].slot && e.equip[SF.ITEMS[id].slot] === null) e.equip[SF.ITEMS[id].slot] = it; }
  e.eqMig = SF.EQ.MIGRATION; e.max = Math.round(SF.maxHp(e) * F.hp); e.hp = e.max; e.stam = e.dex; e.sw = SF.newSwing(); e.downed = false; e.downAt = 0; e.foe = null;
}
const npcCombatant = e => !!e && e.kind === 'npc' && !!e.npcFight;
const npcUp = e => npcCombatant(e) && !e.gone && !e.downed;

/* ---------- taking a blow (damageActor routes every NPC here) ---------- */
function damageNpc(e, amt, kind, src, hx) {
  if (!npcUp(e) || !(amt > 0)) return;
  if (src && lawSide(src)) lawAggress(src, e);   // the law (src/law.js): the swing already recorded it; this catches every other path
  e.hp -= amt; e.lastHit = GT; e.lastCombat = GT; NPCF.hitsTaken++;
  simEmit('ActorDamaged', { actor: aidOf(e), source: aidOf(src), amount: amt, kind: kind || 'phys', x: e.x, y: e.y });
  floater(e.x, e.y, '-' + Math.round(amt), kind === 'poison' ? '#7be07b' : '#ff8a6a'); hitSound(e, kind, src, hx, e.hp <= 0);
  if (src && src.kind === 'mon' && alive(src)) {
    if (e.npcFight.fights) { if (!e.foe || !fighterAlive(e.foe)) npcEngage(e, src, 'attacked by ' + src.name); }
    else npcFlee(e, src);
    npcCallGuards(e, src);
  } else if (src && lawResponsible(src) && lawResponsible(src) !== e) {   // a person attacked them: a guard fights back when the law allows, everyone else runs and shouts
    const who = lawResponsible(src);
    if (e.npcFight.fights) { if ((!e.foe || !fighterAlive(e.foe)) && lawGuardTarget(e, who)) npcEngage(e, who, 'attacked by ' + (who === P ? 'you' : who.name)); }
    else npcFlee(e, who);
    npcCallGuards(e, who);
  }
  if (e.hp <= 0) npcDown(e, src);
}
/* a townsperson under attack runs for shelter at once and remembers why */
function npcFlee(e, src, what) {
  const L = e.life; if (!L) return; SIM.frighten(L.needs, 1); L.needs.safety = 1; const who = src === P ? P.name : 'a ' + src.name;
  if (L.prof === 'trader') { L.hurry = true; L.mind.why = (what === 'theft' ? 'robbed by ' : 'attacked by ') + who + ' on the road'; }
  else { L.mind.act = null; L.thinkAt = 0; L.goal = null; }
  if (what !== 'theft' && !L.mem.knows('attacked by', aidOf(src))) L.mem.note(GT, 'attacked by', aidOf(src), { x: Math.round(e.x), y: Math.round(e.y) }, 300);
  if (GT > (e.helpAt || 0)) { e.helpAt = GT + 6; say(e, pick(src.kind === 'mon' ? ['Help! Guards!', 'Guards! Guards!', 'Get it off me!'] : what === 'theft' ? ['Thief!', 'Guards! A thief!', 'Stop, thief!'] : ['Help! Murder!', 'Guards! Guards!', 'Stop! Help!'])); }
}
/* guards near the victim (and of the victim's town) hear the cry */
function npcCallGuards(victim, foe) {
  if (!foe || (foe.kind === 'mon' ? !alive(foe) : !lawGuardTarget(null, foe))) return; let n = 0;   // a creature, or you when the law makes you a target
  const near = LIFE.npcs.filter(g => npcUp(g) && g.npcFight.fights && g !== victim).sort((a, b) => dist(a, victim) - dist(b, victim));   // the nearest answer first
  for (const g of near) {
    if (g.foe && fighterAlive(g.foe) && dist(g, g.foe) < 8) continue;   // already busy close by
    const d = dist(g, victim); if (d > NPC_CALL_RANGE && !(victim.life && victim.life.town === g.life.town && d < NPC_CALL_RANGE * 1.6)) continue;
    if (!npcInJurisdiction(g, foe, 0)) continue;
    if (npcEngage(g, foe, 'answered ' + (victim === P ? 'your' : (victim.name || 'a').split(',')[0] + '\'s') + ' cry for help')) n++; if (n >= 2) break; }
  if (n) { NPCF.calls++; if (foe === P) LAWF.guardCalls++; }
}
/* knocked down: out of the fight, lying where they fell, until NPC_DOWN_TIME has passed */
function npcDown(e, src) {
  if (e.downed) return; e.downed = true; e.downAt = GT; e.hp = 0; e.poison = null; e.nav = null; e.speed = 0; e.foe = null; NPCF.downs++;
  if (e.life) { e.life.goal = null; e.life.mind.act = null; e.life.mind.why = 'knocked down'; e.life.hurry = false; if (src) e.life.mem.note(GT, 'knocked down by', aidOf(src), { x: Math.round(e.x), y: Math.round(e.y) }, 600); }
  simEmit('CombatEnded', { actor: aidOf(e), source: aidOf(src), x: e.x, y: e.y, detail: { outcome: 'downed' } });
  lawDowned(e, src);   // an innocent knocked down unlawfully reports a murder (src/law.js)
  for (const o of ents) if (o.target === e) { o.target = null; if (o.kind === 'mon' && o.state !== 'flee') o.state = 'return'; if (o.mind) o.mind.act = null; }
  for (const g of LIFE.npcs) if (g.foe === e) g.foe = null;
  if (P && dist(e, P) < 24) log(`${(e.name || 'A townsperson').split(',')[0]} is knocked down${src === P ? ' by you' : src && src.kind === 'npc' ? ' by ' + src.name.split(',')[0] : src && src.name ? ' by a ' + src.name : ''}!`, '#ff8a6a');
  sndAt('player.death', e, { gain: .5 });
}
function npcRise(e) {
  e.downed = false; e.downAt = 0; e.hp = Math.max(1, Math.round(e.max / 3)); e.stam = e.dex; NPCF.rises++;
  const L = e.life; if (L) { L.needs.safety = Math.max(L.needs.safety, .6); L.mind.act = null; L.thinkAt = 0; L.wd = null; L.retryAt = 0;
    if (L.prof === 'trader' && L.phase === 'travel') lifeGo(e, L.goal, { maxNodes: 400000, speed: SF.WALK * .6 }); else L.goal = null; }
  say(e, pick(['Ugh… I\'m still alive.', 'Oof. Home, I think.', 'That was too close.']));
}

/* ---------- each step, before the routine (lifeTick calls this; true = this step is spoken for) ---------- */
function npcCombatTick(e, dt) {
  if (!npcCombatant(e)) return false;
  if (e.lunge) { e.lunge += dt / .2; if (e.lunge >= 1) e.lunge = 0; }
  if (e.downed) { e.speed = 0; e.nav = null; if (GT - e.downAt >= NPC_DOWN_TIME) npcRise(e); return true; }
  const fight = GT - (e.lastCombat || -99) < 6;
  if (GT - (e.lastHit || -99) > .75) e.stam = Math.min(e.dex, e.stam + (fight ? SF.STAM_REGEN_COMBAT : SF.STAM_REGEN) * dt);
  if (!fight && e.hp < e.max) e.hp = Math.min(e.max, e.hp + e.max * .004 * dt);   // about four minutes from a third back to full
  if (e.poison && GT >= e.poison.next) { e.poison.next = GT + SF.POISON_GAP; damageNpc(e, SF.POISON[e.poison.tier], null, 'poison'); if (e.poison && --e.poison.ticks <= 0) e.poison = null; if (e.downed) return true; }
  SF.swingTick(e.sw, GT, e.stam, weaponOfActor(e));
  if (!e.npcFight.fights) return false;
  return guardFightTick(e, dt);
}
/* is the creature inside the guard's town's jurisdiction? (slack: extra metres before letting it go) */
function npcInJurisdiction(g, c, slack) { const G = lifeTownGeo(g.life.town); return Math.hypot(c.x - G.center.x, c.y - G.center.y) < NPC_JURISDICTION + (slack || 0); }
/* a creature is a threat a guard acts on when it is fighting a person, or when it is hostile to townsfolk and right beside the guard */
function npcThreat(g, c) {
  if (c.kind !== 'mon' || !alive(c) || c.hidden || c.pacified > GT) return false;
  const t = c.target; if (t && (t === P || isAlly(t) || npcCombatant(t)) && (c.state === 'chase' || c.state === 'tele' || c.state === 'strike' || c.state === 'rec')) return true;
  return dist(g, c) < 5 && (ecoEnemy(c, g) || c.target === g);
}
function npcEngage(g, c, why) {
  if (!npcUp(g) || !g.npcFight.fights || !c || !fighterAlive(c)) return false;
  if (c.kind !== 'mon' && !lawGuardTarget(g, c)) return false;   // people only when the law allows it
  if (g.foe !== c) { NPCF.guardFights++; simEmit('CombatStarted', { actor: aidOf(g), target: aidOf(c), x: g.x, y: g.y, detail: { why } }); if (P && dist(g, P) < 22) say(g, pick(c === P ? (notoOf(P) === 'murderer' ? ['Murderer! You will hang!', 'There is the killer!'] : ['Halt, criminal!', 'Stop in the name of the law!', 'You there! Halt!']) : ['Halt, beast!', 'For the town!', 'Stand back, I have it!'])); }
  g.foe = c; g.foeSeen = GT; g.nav = null; if (g.life) { g.life.mind.why = why; g.life.doing = 'fight'; }
  return true;
}
function guardFightTick(g, dt) {
  const L = g.life;
  if (!g.foe && GT > (g.scanAt || 0)) {   // look for a fight to step into, twice a second
    g.scanAt = GT + .5; let best = null, bd = NPC_GUARD_SIGHT;
    ECOS.grid.query(g.x, g.y, NPC_GUARD_SIGHT, c => { if (!npcThreat(g, c)) return; const d = dist(g, c); if (d < bd && npcInJurisdiction(g, c, 0) && los(g, c)) { bd = d; best = c; } });
    if (best) npcEngage(g, best, 'defending ' + (best.target === P ? 'you' : best.target && best.target.name ? best.target.name.split(',')[0] : 'the town') + ' from a ' + best.name);
    else if (lawGuardTarget(g, P) && !P.hidden && dist(g, P) < NPC_GUARD_SIGHT && npcInJurisdiction(g, P, 0) && los(g, P)) npcEngage(g, P, notoOf(P) === 'murderer' ? 'a murderer in town' : notoOf(P) === 'criminal' ? 'a criminal in town' : 'you attacked him');
  }
  const c = g.foe; if (!c) return false;
  const pardoned = c.kind !== 'mon' && fighterAlive(c) && !lawGuardTarget(g, c);   // you stopped being a lawful target (the flag ran out)
  const lost = !fighterAlive(c) || c.hidden || pardoned || (c.kind === 'mon' && c.pacified > GT) || !npcInJurisdiction(g, c, 12) || dist(g, c) > NPC_GUARD_SIGHT * 1.5;
  if (!lost && los(g, c)) g.foeSeen = GT;
  if (lost || GT - g.foeSeen > 6 || g.hp < g.max * .2) {   // won, lost it, or too hurt: back to the patrol
    if (c && c.kind === 'mon' && !alive(c)) NPCF.guardKills++;
    simEmit('CombatEnded', { actor: aidOf(g), target: aidOf(c), x: g.x, y: g.y, detail: { outcome: !fighterAlive(c) ? 'won' : pardoned ? 'pardoned' : g.hp < g.max * .2 ? 'withdrew' : 'lost sight' } });
    g.foe = null; g.nav = null; if (L) { L.goal = null; L.mind.why = 'back to the patrol'; L.thinkAt = 0; } return false; }
  const w = weaponOfActor(g), d = dist(g, c);
  if (d > w.reach * .9 || !los(g, c)) { allyStep(g, c.x, c.y, dt); return true; }
  g.speed = 0; faceToward(g, c.x, c.y); swingAt(g, c);
  if (c.kind === 'mon' && alive(c) && c.target !== g && dist(c, g) < 3 && GT - (c.hitT ?? -99) < 1 && R() < .5) { c.target = g; c.chaseKind = 'attack'; if (c.state === 'idle' || c.state === 'return') c.state = 'chase'; }   // a creature struck by a guard often turns on him
  return true;
}

/* ---------- save: health and the knock-down timer by actor id (life save carries it) ---------- */
function npcSave(e) { if (!npcCombatant(e)) return null; if (e.hp >= e.max && !e.downed) return null; return { hp: Math.round(e.hp), down: e.downed ? Math.max(1e-3, NPC_DOWN_TIME - (GT - e.downAt)) : 0 }; }
function npcLoad(e, r) { if (!npcCombatant(e) || !r) return; e.hp = cl(Math.round(r.hp) || 0, 0, e.max); if (r.down > 0) { e.downed = true; e.downAt = GT - (NPC_DOWN_TIME - r.down); e.hp = 0; e.nav = null; } else if (e.hp <= 0) e.hp = 1; }
function npcFightDev() { const up = LIFE.npcs.filter(npcUp), dn = LIFE.npcs.filter(e => e.downed).length, fighting = LIFE.npcs.filter(e => e.foe && fighterAlive(e.foe)).length, hurt = up.filter(e => e.hp < e.max).length;
  return `npc combat: ${fighting} guards fighting · ${dn} knocked down · ${hurt} hurt · hits taken ${NPCF.hitsTaken}, downs ${NPCF.downs}, rises ${NPCF.rises}, guard fights ${NPCF.guardFights}, guard kills ${NPCF.guardKills}, calls ${NPCF.calls}`; }
