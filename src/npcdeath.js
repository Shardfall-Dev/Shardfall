/* ================= NPC DEATH AND NPC CRIME (Living World phase 5, step 4, v0.39; master spec §19, §20) =================
   Townsfolk, shopkeepers, guards and the travelling merchant die at 0 health instead of being knocked down:
     · One death transaction (npcDies, exactly once): movement, combat and errands stop; ActorKilled; whoever killed them is
       judged by the law (lawDowned: an innocent killed unlawfully reports a murder, once per death); everything they wore and a
       purse of gold become real items on a body, under the player's loot rules (SF.deathTransaction, 90 s loot rights, 12 min
       decay). Looting an innocent's body inside its loot-rights window is a crime, for you and for NPCs alike.
     · Then, as UO's vendors did, they come back: the same person (same id, name, home, shop and quests) is back at home after
       NPCD.cfg.back seconds (10 min), where nobody watches it happen if that can be helped. Policy 'none' keeps ordinary residents
       dead for good; shops, guards and the merchant always come back, so the game never loses a service.
     · Saved: who is dead and for how long, and every body with its contents and time left (the life block's `npcd`, additive).
   And the first NPC criminals (§19 "criminal NPCs may loot illegally and receive consequences"), two outlaws living at the Ashfen
   camp on the adventurer controller (src/adventurers.js), with the same rules as everyone:
     · Vesk, a cutthroat, attacks lone people in the wild who look weaker than him (townsfolk at work, the merchant on the road,
       adventurers, and you), never where a guard would see it, at most once every few minutes. Each kill of an innocent is a
       murder count: five make him red.
     · Mott, a cutpurse, loots bodies he has no right to (a crime: grey for two minutes), never under a guard's eyes.
     · Witnesses and guards react to NPC crime as they do to yours (src/law.js): guards fight grey and red outlaws inside their
       jurisdiction, adventurers fight back, and you may attack a grey or red outlaw lawfully. Dead outlaws go to the camp healer.
   ?crim=off leaves the outlaws out (?adv=off leaves out every adventurer, outlaws included). */

const NPCD = { cfg: SIM.NPCD_CFG, dead: [], checkAt: 0, stats: { deaths: 0, returns: 0, bodies: 0, illegal: 0 } };
const CRIM = { on: !/[?&#]crim=off\b/.test(location.search + location.hash), cfg: SIM.CRIM_CFG, stats: { preys: 0, murders: 0, loots: 0, crimes: 0 } };
const npcdFirst = e => String((e && e.name) || 'someone').split(',')[0];
const npcdNear = (e, r) => P && e && dist(e, P) < (r || 24);
/* everyone with a life, the dead included (they are out of `ents` while dead) */
const npcdById = id => LIFE.npcs.find(e => e.actorId === id) || null;

/* ---------- the death transaction ---------- */
/* the outfit an NPC wears has negative uids (src/npcfight.js npcItem: never saved, never in a player container); on a body it can
   reach your pack, so each piece becomes a real item with a real uid at the moment of death */
function npcdRealItem(it) { if (!it || it.uid > 0) return it; const n = SF.newItem(it.id, it.qty || 1); return Object.assign({}, it, { uid: n.uid }); }
function npcDies(e, src) {
  if (e.gone || e.npcDead) return; const L = e.life, look = gearSnapOf(e);   // the look is taken before the items move
  e.hp = 0; e.foe = null; e.nav = null; e.poison = null; e.speed = 0; e.downed = false;
  simEmit('ActorKilled', { actor: aidOf(e), killer: aidOf(src), x: e.x, y: e.y });
  const who = lawResponsible(src), murder = lawDowned(e, src);   // an innocent killed by someone with no right over them reports a murder (src/law.js)
  if (murder && murder.counted && who && who !== P && who.adv) CRIM.stats.murders++;
  // what they wore and carried, and their purse, on a body under the player's rules
  e.pack = SF.newContainer('pack', e.actorId);
  for (const s in e.equip) e.equip[s] = npcdRealItem(e.equip[s]);
  const gold = SIM.npcdPurse(L && L.prof, L && L.gold, R(), NPCD.cfg); if (gold > 0) e.pack.items.push(SF.newItem('gold', gold)); if (L && Number.isFinite(L.gold)) L.gold = 0;
  const body = SF.deathTransaction(e, GT, { x: e.x, y: e.y }); body.owner = e.actorId; body.key = e.actorId + '@' + GT.toFixed(2);
  addEnt({ kind: 'corpse', npcBody: e.actorId, name: npcdFirst(e) + "'s body", x: e.x, y: e.y, cont: body, expires: body.expires, gear: look, t0: GT, sect: e.sect || 0 });
  NPCD.stats.bodies++;
  // nobody keeps fighting or targeting the dead
  for (const o of ents) if (o.target === e) { o.target = null; if (o.kind === 'mon' && o.state !== 'flee') o.state = 'return'; if (o.mind) o.mind.act = null; }
  for (const g of LIFE.npcs) if (g.foe === e) g.foe = null; for (const o of ADV.list) if (o.foe === e) o.foe = null;
  if (P.sel === e) { P.sel = null; P.armed = false; } if (P.talkTo === e) P.talkTo = null;
  if (L) { L.goal = null; L.mind.act = null; L.mind.why = 'dead'; L.hurry = false; if (src) L.mem.note(GT, 'killed by', aidOf(src), { x: Math.round(e.x), y: Math.round(e.y) }, 0); }
  e.npcDead = { at: GT, back: SIM.npcdReturns(L && L.prof, NPCD.cfg) }; e.dead = true; NPCD.dead.push(e); NPCD.stats.deaths++;
  rmEnt(e);
  if (npcdNear(e)) log(`${npcdFirst(e)} has been killed${src === P ? ' by you' : who && who !== P && who.kind === 'npc' ? ' by ' + npcdFirst(who) : src && src.kind === 'mon' ? ' by a ' + src.name : ''}. The body holds everything they carried.`, '#ff8a6a');
  sndAt('player.death', e, { gain: .5 });
}

/* ---------- coming back ---------- */
function npcdHome(e) { const L = e.life; if (L && L.prof === 'guard') return L.post || e.home; return e.home || { x: e.x, y: e.y }; }
function npcdSeen(p) { if (!P || !p) return false; const r = (typeof TIER !== 'undefined' && TIER.radii && TIER.radii.a) || 40; return Math.hypot(p.x - P.x, p.y - P.y) < r + 6; }
function npcdTick() {
  if (!NPCD.dead.length || GT < NPCD.checkAt) return; NPCD.checkAt = GT + 1;
  for (const e of NPCD.dead.slice()) { const D = e.npcDead; if (!D || !D.back) continue; const home = npcdHome(e);
    if (SIM.npcdReady(GT - D.at, npcdSeen(home), NPCD.cfg)) npcdReturn(e, home); }
}
function npcdReturn(e, p) {
  const i = NPCD.dead.indexOf(e); if (i >= 0) NPCD.dead.splice(i, 1); const diedAt = e.npcDead ? e.npcDead.at : GT; delete e.npcDead; e.dead = false; e.gone = false; delete e.pack;
  npcArm(e);   // a fresh outfit, full health (src/npcfight.js)
  const L = e.life; if (L) { L.needs = SIM.newNeeds(); L.mind = {}; L.goal = null; L.thinkAt = 0; L.hurry = false; L.wd = null; L.retryAt = 0;
    if (Number.isFinite(L.gold) || L.gold === 0) L.gold = L.prof === 'trader' ? 120 : 20 + (e.id % 7) * 5;
    if (L.prof === 'trader') { L.town = e.town = 'mynoc'; L.phase = 'selling'; L.until = 0; L.legs = 0; } }
  e.x = p.x; e.y = p.y; if (!canStand(e, e.x, e.y)) { const q = lifeSpot(e, p, 3); if (q) { e.x = q.x; e.y = q.y; } } e._px = e.x; e._py = e.y; e.speed = 0;
  ents.push(e); if (WS && e.archetype) WS.adopt(e, e.archetype);
  NPCD.stats.returns++; simEmit('ActorReturned', { actor: aidOf(e), x: e.x, y: e.y, detail: { after: Math.round(GT - diedAt) } });
  if (npcdNear(e, 30)) log(`${npcdFirst(e)} is back${L && LIFE.towns[L.town] ? ' in ' + (ADV_TOWN_N[L.town] || 'town') : ''}.`, '#ffe08a');
}

/* ---------- bodies: whose, and looting them (you and NPCs alike) ---------- */
function npcdBodyOwner(c) { return !c ? null : c.advBody ? advById(c.advBody) : c.npcBody ? npcdById(c.npcBody) : c.mine ? P : null; }
const npcdHumanBody = c => !!c && c.kind === 'corpse' && !c.gone && !!c.cont && !!(c.npcBody || c.advBody || c.mine);
/* `by` took something from body `c`: inside the loot-rights window, an innocent's body is a crime (at most one per 10 s per looter) */
function npcdLooted(c, by) {
  by = by || P; if (!npcdHumanBody(c)) return false; const owner = npcdBodyOwner(c); if (!owner || owner === by) return false;
  const ls = SF.lootStatus(c.cont, aidOf(by), GT); if (ls.lawful || notoOf(owner) !== 'innocent') return false;
  const k = aidOf(by); c.crimeBy = c.crimeBy || {}; if (c.crimeBy[k] !== undefined && GT - c.crimeBy[k] < 10) return false;
  c.crimeBy[k] = GT; NPCD.stats.illegal++; if (by !== P) CRIM.stats.crimes++;
  lawCrime(by, owner, 'looting'); return true;
}

/* ---------- the outlaws' choices (the adventurer controller asks these; src/adventurers.js advThink) ---------- */
const crimOf = e => e && e.adv && e.adv.crim;
/* is a guard watching this spot? */
function crimGuarded(p) { const r = CRIM.cfg.guardWary; for (const g of LIFE.npcs) if (npcUp(g) && g.npcFight.fights && Math.hypot(g.x - p.x, g.y - p.y) < r && los(g, p)) return true; return lawRegion(p.x, p.y) !== 'wild'; }
/* a cutthroat looks for prey: someone alone in the wild it expects to beat (SIM.crimPrey) */
function crimPreyFor(e) {
  const A = e.adv; if (A.crim !== 'murderer' || GT < (A.nextCrime || 0) || A.mode === 'town' || e.hp < e.max * .7) return null;
  const C = CRIM.cfg, mine = ecoPower(e), out = [];
  const add = v => {
    if (!v || v === e || !fighterAlive(v) || v.hidden || (v.adv && v.adv.crim)) return;
    if (v.kind === 'npc' && !v.adv && v.npcFight && v.npcFight.fights) return;   // never a guard
    const d = dist(e, v); if (d > C.sight || protAt(v.x, v.y) || !los(e, v)) return;
    const max = v === P ? SF.maxHp(P) : (v.max || 1);
    out.push({ id: aidOf(v), v, dist: d, ratio: ecoPower(v) / Math.max(1, mine), guarded: crimGuarded(v), hpF: v.hp / Math.max(1, max) });
  };
  for (const v of LIFE.npcs) add(v); for (const v of ADV.list) add(v); if (C.preyOnPlayer && P && !P.ghost) add(P);
  const pick_ = SIM.crimPrey(out, C); if (!pick_) return null;
  A.nextCrime = GT + C.crimeGap; CRIM.stats.preys++; return { c: pick_.v, ratio: pick_.ratio, prey: true };
}
/* any outlaw looks for a body worth robbing that it has not robbed yet (SIM.crimBody) */
function crimBodyFor(e) {
  const A = e.adv; if (!A.crim) return null; const out = [], done = A.robbed || (A.robbed = {});
  for (const c of ents) {
    if (!npcdHumanBody(c) || c.advBody === e.actorId || done[c.id]) continue; const d = dist(e, c); if (d > CRIM.cfg.bodySight) continue;
    const n = c.cont.items.filter(advWants).length; if (!n) continue;
    out.push({ key: c.id, c, dist: d, items: n, lawful: SF.lootStatus(c.cont, aidOf(e), GT).lawful, guarded: crimGuarded(c) });
  }
  const b = SIM.crimBody(out, CRIM.cfg); return b ? b.c : null;
}
function crimTalk(n) {
  const A = n.adv; if (!A || !A.crim) return false; if (n.ghost) { say(n, 'Oooo… (a ghost, cursing)'); return true; }
  const no = notoOf(n);
  say(n, A.crim === 'murderer' ? pick(no === 'murderer' ? ['Walk away while you still can.', 'You did not see me. Understood?'] : ['What are you looking at?', 'Lonely road, this. Mind yourself.'])
    : pick(no === 'criminal' ? ['I found it. Finders keepers.', 'Not a word to the guards, friend.'] : ['Nice boots. Be a shame to lose them.', 'Dead folk do not need their coin.']));
  return true;
}

/* ---------- save: who is dead and for how long, and every body (the life block's `npcd`, additive) ---------- */
function npcdSave() {
  const dead = NPCD.dead.map(e => ({ id: e.actorId, ago: Math.round(GT - e.npcDead.at), back: !!e.npcDead.back }));
  const bodies = ents.filter(c => c.kind === 'corpse' && c.npcBody && !c.gone && c.expires > GT && c.cont).map(c => ({ owner: c.npcBody, key: c.cont.key || c.npcBody + '@' + (c.cont.diedAt || 0).toFixed(2),
    x: Math.round(c.x * 10) / 10, y: Math.round(c.y * 10) / 10, left: Math.round(c.expires - GT), diedAgo: Math.round(GT - (c.cont.diedAt ?? GT)), items: c.cont.items, gear: c.gear || null, sect: c.sect || 0 }));
  return { v: SIM.NPCD_VERSION, dead, bodies };
}
function npcdLoad(s) {
  NPCD.dead.length = 0; if (!s || s.v !== SIM.NPCD_VERSION) return;
  for (const r of Array.isArray(s.dead) ? s.dead : []) {
    const e = r && typeof r.id === 'string' ? npcdById(r.id) : null; if (!e || e.gone || e.npcDead) continue;
    if (P && P.sel === e) P.sel = null; e.hp = 0; e.foe = null; e.nav = null; e.npcDead = { at: GT - Math.max(0, +r.ago || 0), back: r.back !== false && SIM.npcdReturns(e.life && e.life.prof, NPCD.cfg) }; e.dead = true; NPCD.dead.push(e); rmEnt(e);
  }
  const res = SIM.npcdBodyRows(s.bodies, { validOwner: id => !!npcdById(id), validItem: it => !!SF.ITEMS[it.id] && it.qty > 0 && Number.isFinite(it.uid) });
  for (const r of res.rows) { const cont = SF.newContainer('corpse', r.owner); cont.items = r.items; cont.owner = r.owner; cont.key = r.key; cont.diedAt = GT - Math.max(0, r.diedAgo ?? 999); cont.expires = GT + r.left;
    addEnt({ kind: 'corpse', npcBody: r.owner, name: npcdFirst(npcdById(r.owner)) + "'s body", x: r.x, y: r.y, cont, expires: cont.expires, gear: r.gear || null, t0: GT - 9, sect: r.sect || 0 }); }
  NPCD.loadDropped = res.dropped;
}
/* item uids the save must count (the save's uid counter, src/game.js saveData) */
function npcdScanItems(scan) { for (const c of ents) if (c.kind === 'corpse' && c.npcBody && !c.gone && c.cont) c.cont.items.forEach(scan); }

/* ---------- developer panel ---------- */
function npcdDev() {
  const S = NPCD.stats, C = CRIM.stats, outl = ADV.list.filter(crimOf).map(e => npcdFirst(e) + ' ' + (e.ghost ? 'ghost' : notoOf(e))).join(', ') || 'none';
  return `npc death: ${NPCD.dead.length} dead now (${NPCD.dead.map(npcdFirst).slice(0, 6).join(', ') || '—'}) · deaths ${S.deaths}, back ${S.returns}, bodies ${S.bodies}, illegal loots ${S.illegal} · back after ${NPCD.cfg.back} s (${NPCD.cfg.policy})<br>
  outlaws: ${outl} · preyed ${C.preys}, murders ${C.murders}, crimes ${C.crimes}`;
}
