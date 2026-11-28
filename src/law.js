/* ================= LAW (Living World phase 5, step 2, v0.34; master spec §19) =================
   Criminality and murder in single-player, on top of the pure law core in src/world.js (SIM.newLaw):
     · Notoriety for every human that has one: you and the townsfolk with a life (blue innocent, grey criminal, red murderer).
       The camp fence and other outlaws stay red as before. Creatures have no notoriety; fighting them is never a crime.
     · Every swing at a human is an aggression record (attacker, victim, time, region, lawful or not, self-defence, expiry).
       Swinging at an innocent you have no right over is a crime: you are grey for LAW.cfg.criminal seconds (120).
       A townsperson or guard who attacked you, or anyone grey or red, may be fought back lawfully.
     · Theft (Stealing caught in the act) is a crime through the same flag.
     · Witnesses: townsfolk who see a crime (in sight, within LAW_WITNESS m) remember the offender, flee, shout for the guards
       and will not deal with you for a while. Guards who see it or hear the cry come for you inside their jurisdiction.
     · Guards fight criminals and murderers inside their town's jurisdiction with the same guardFightTick they use on creatures,
       and give up when you leave it, hide, die or stop being a lawful target (the flag runs out and you are not red).
     · Murder counts: an innocent knocked down by someone with no right over them reports a murder (until phase 5 step 4
       gives townsfolk real death, a knock-down is the death). Short-term counts last 8 active hours, long-term 40; five
       long-term counts make you red. Townsfolk refuse to talk or trade with a murderer; guards attack one on sight.
     · If an NPC kills you unlawfully, the ghost window offers to report the murder (no NPC can do that yet; the path is ready).
   Saved in the life block (additive): the law core's records, flags, counts and handled deaths, by actor id. */

const LAW_WITNESS = 14;          // a townsperson sees a crime this far away, in sight
const LAW_GRUDGE = 600;          // seconds a witness or victim refuses to deal with you
const NOTO_COLOR = { innocent: '#5aa8ff', criminal: '#b8b8b8', murderer: '#ff5a48' };
const NOTO_DOT = { innocent: 'blue', criminal: 'grey', murderer: 'red' };
let LAW = SIM.newLaw();
const LAWF = { witnessed: 0, guardCalls: 0, refusals: 0, pardons: 0 };
let LAW_P = { noto: 'innocent', at: 0, pruneAt: 0 };

/* who answers for an actor's attack: your pets, summons and hireling are yours */
const lawSide = e => !!e && (e === P || e.kind === 'pet' || e.kind === 'ally' || !!e.summon || e.owner === P);
const lawResponsible = e => !e ? null : lawSide(e) ? P : (e.kind === 'npc' ? e : null);
/* humans with notoriety: you, and townsfolk who can fight or be hurt */
const lawHuman = e => !!e && (e === P || npcCombatant(e));
function notoOf(e) {
  if (!e) return null; if (e.kind === 'npc' && e.role === 'outlaw') return 'murderer';
  if (!lawHuman(e)) return null; return LAW.notoriety(aidOf(e), GT);
}
const notoColor = e => NOTO_COLOR[notoOf(e) || 'innocent'];
/* the town whose jurisdiction holds this point, or 'wild' */
function lawRegion(x, y) {
  for (const k in LIFE.towns) { const G = lifeTownGeo(k); if (G && Math.hypot(x - G.center.x, y - G.center.y) < NPC_JURISDICTION) return k; }
  return 'wild';
}
/* may this guard fight t now? creatures by the creature rules; you when grey or red, or when you attacked him */
function lawGuardTarget(g, t) {
  if (!t || t !== P || P.ghost) return false; const n = notoOf(P);
  return n === 'criminal' || n === 'murderer' || (!!g && LAW.rights(aidOf(g), aidOf(P), GT));
}

/* ---------- an attack on a human (swingAt calls this before the blow; damageNpc again for anything else) ---------- */
function lawAggress(a, v) {
  if (!a || !v || a === v || !lawHuman(v)) return null; const who = lawResponsible(a); if (!who || who === v) return null;
  const owner = who !== a ? aidOf(who) : null, before = notoOf(who);
  const r = LAW.aggress(aidOf(a), aidOf(v), GT, { owner, region: lawRegion(v.x, v.y) }); if (!r) return null;
  if (r.fresh) simEmit('AggressionRecorded', { actor: aidOf(a), target: aidOf(v), x: v.x, y: v.y, detail: { lawful: r.rec.lawful, selfDefence: r.rec.selfDefence, owner, region: r.rec.region } });
  if (r.crime && r.fresh) lawCrimeDone(who, v, 'assault', before);
  return r;
}
/* any other crime (theft today; illegal looting in step 4) */
function lawCrime(off, victim, what) {
  const who = lawResponsible(off) || off, before = notoOf(who); LAW.crime(aidOf(who), GT, what); lawCrimeDone(who, victim, what, before);
}
function lawCrimeDone(off, victim, what, before) {
  simEmit('CrimeCommitted', { actor: aidOf(off), victim: aidOf(victim), crime: what, x: off.x, y: off.y, detail: { region: lawRegion(off.x, off.y) } });
  if (off === P) {
    const nm = victim && victim.name ? victim.name.split(',')[0] : 'someone';
    if (before === 'innocent') log(what === 'theft' ? `You are caught stealing from ${nm}. You are a criminal for two minutes.` : what === 'looting' ? `You loot ${nm}'s body. You are a criminal for two minutes.` : `You attack ${nm}, an innocent. You are a criminal for two minutes.`, '#ff8a6a');
    else if (before === 'criminal') log('Your criminal flag is renewed.', '#ff8a6a');
  }
  lawWitness(off, victim, what); lawNotoCheck();
}
/* everyone who sees it reacts; the victim always knows */
function lawWitness(off, victim, what) {
  const id = aidOf(off), seen = [];
  for (const w of LIFE.npcs) {
    if (!npcUp(w) || w === off) continue; const d = dist(w, off);
    if (w !== victim && (d > LAW_WITNESS || !los(w, off))) continue;
    seen.push(w); const L = w.life;
    if (L && !L.mem.knows('saw a crime by', id)) { LAWF.witnessed++; simEmit('CrimeWitnessed', { actor: aidOf(w), target: id, victim: aidOf(victim), crime: what, x: w.x, y: w.y }); }
    if (L) L.mem.note(GT, 'saw a crime by', id, { x: Math.round(off.x), y: Math.round(off.y) }, 120);
    if (w.npcFight.fights) { if ((!w.foe || !fighterAlive(w.foe)) && lawGuardTarget(w, off) && npcInJurisdiction(w, off, 0)) npcEngage(w, off, 'saw ' + (off === P ? 'you' : off.name) + (what === 'theft' ? ' steal' : what === 'looting' ? ' loot a body' : ' attack ' + (w === victim ? 'him' : (victim.name || 'someone').split(',')[0]))); }
    else if (w === victim || d < LAW_WITNESS * .7) npcFlee(w, off, what);
  }
  for (const w of seen) if (!w.npcFight.fights) { npcCallGuards(w, off); break; }   // one cry is enough to bring the nearest guards
  return seen.length;
}

/* ---------- a knock-down by someone with no right over the victim is a murder, reported by the victim ---------- */
function lawDowned(e, src) {
  const who = lawResponsible(src); if (!who || who === e || !lawHuman(e)) return null;
  const before = notoOf(who), key = aidOf(e) + '@' + GT.toFixed(2);
  const r = LAW.murder(aidOf(src), aidOf(e), GT, key, who !== src ? aidOf(who) : null); if (!r.counted) return r;
  LAW.reported(); simEmit('MurderReported', { actor: aidOf(e), target: aidOf(who), x: e.x, y: e.y, detail: { reporter: aidOf(e), short: r.short, long: r.long } });
  if (e.life) e.life.mem.note(GT, 'murdered by', aidOf(who), { x: Math.round(e.x), y: Math.round(e.y) }, 0);
  if (who === P) { log(`${e.name.split(',')[0]} reports you for murder. Murder counts: ${r.short} short-term, ${r.long} long-term.`, '#ff6a5a');
    if (r.red) log('You are now known as a murderer. Guards attack you on sight and townsfolk will not deal with you.', '#ff4848'); }
  lawNotoCheck(before); return r;
}
/* you died: if an NPC killed you with no right over you, the ghost window offers a report */
function lawPlayerDied(src) {
  P.report = null; const k = src && src.kind === 'npc' && lawHuman(src) ? src : null; if (!k) return;
  if (LAW.isMurder(aidOf(k), aidOf(P), GT)) P.report = { killer: aidOf(k), name: (k.name || 'someone').split(',')[0], t: GT, key: aidOf(P) + '@' + GT.toFixed(2) };
}
function lawReport() {
  const r = P.report; if (!r) return false; P.report = null;
  const res = LAW.count(r.killer, r.t, r.key);   // judged a murder when you died; counted once
  LAW.reported(); simEmit('MurderReported', { actor: aidOf(P), target: r.killer, x: P.x, y: P.y, detail: { reporter: aidOf(P), long: res.long || 0 } });
  log(`You report ${r.name} for murder.`, '#ffe08a'); return true;
}

/* ---------- townsfolk who will not deal with you (talk calls this first) ---------- */
function lawRefuses(n) {
  if (!n || !n.life || P.ghost || n.role === 'outlaw') return false; const id = aidOf(P), L = n.life;
  let line = null;
  if (notoOf(P) === 'murderer') line = n.life.prof === 'guard' ? 'You will hang for what you have done!' : pick(['I will not deal with a murderer!', 'Stay away from me, killer!', 'Murderer! Guards!']);
  else if (L.mem.recent().some(r => (r.what === 'saw a crime by' || r.what === 'murdered by') && r.who === id && GT - r.t < LAW_GRUDGE)) line = pick(['I saw what you did. Keep away from me.', 'Not you. Go away.', 'I have nothing to say to a criminal.']);
  if (!line) return false; LAWF.refusals++; say(n, line); return true;
}

/* ---------- each step: your notoriety changes are announced; records are pruned now and then ---------- */
function lawNotoCheck(before) {
  const n = notoOf(P); if (n === LAW_P.noto) return;
  const was = before && before !== n ? before : LAW_P.noto; LAW_P.noto = n; LAW_P.at = GT;
  simEmit('NotorietyChanged', { actor: aidOf(P), x: P.x, y: P.y, detail: { from: was, to: n } });
  if (n === 'innocent' && was === 'criminal') { LAWF.pardons++; log('You are no longer a criminal.', '#7ee08a'); }
  if (n === 'innocent' && was === 'murderer') log('Your long-term murder counts have faded: you are no longer a murderer.', '#7ee08a');
}
function lawTick() {
  if (!P) return; if (GT > LAW_P.pruneAt) { LAW_P.pruneAt = GT + 10; LAW.prune(GT); }
  lawNotoCheck();
}
function lawSave() { return LAW.save(GT); }
function lawLoad(s) { LAW = SIM.newLaw(s && s.v ? s : null); LAW_P = { noto: notoOf(P) || 'innocent', at: GT, pruneAt: 0 }; }
function lawNameTag() { const n = notoOf(P); if (n === 'criminal') return ' · criminal ' + Math.ceil(LAW.flagLeft(aidOf(P), GT)) + ' s'; if (n === 'murderer') return ' · murderer'; return ''; }
function lawDev() {
  const id = aidOf(P), c = LAW.counts(id, GT), s = LAW.stats;
  return `law: you are ${notoOf(P)}${LAW.flagged(id, GT) ? ' (' + Math.ceil(LAW.flagLeft(id, GT)) + ' s)' : ''} · murder counts ${c.short} short / ${c.long} long (red at ${LAW.cfg.red}) · records ${LAW.records().length} · aggressions ${s.aggressions}, unlawful ${s.unlawful}, crimes ${s.crimes}, murders ${s.murders}, reports ${s.reports} · witnessed ${LAWF.witnessed}, refusals ${LAWF.refusals}, pardons ${LAWF.pardons}`;
}
