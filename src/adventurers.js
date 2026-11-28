/* ================= NPC ADVENTURERS (Living World phase 5, step 3, v0.36; master spec §8, §18, §20) =================
   Simulated players. Six named adventurers (src/world.js SIM.ADV_ROSTER) live in the four Anniabreen towns and go out hunting
   like a player would, with the same rules you play by:
     · Skills, stats, weapons and armour on the existing registry (SIM.ADV_STYLES maps each archetype onto it): every swing and
       shot goes through the shared resolver (swingAt → applyBlow → damageActor), and they learn from use (SF.SK.use / check).
     · First Aid with the player's rules (SF.firstAidCheck / firstAidResolve: delays, slips when hit, cure at 60/60), healing
       draughts with their cooldown.
     · Magery (mage, healer): the book chance, mana, one of each reagent from their pack, the cast time, interruption by damage
       (reagents back, half the mana spent), the circle's resist and Evaluating Intelligence focus (SF.MAGERY.resolveHit), the
       delivery delay. Spells: Magic Arrow, Fireball, Lightning, Energy Bolt, Heal, Greater Heal, Cure, Protection.
     · A strategic layer (SIM.advChoose, about once a second): hunt → fight → loot → return → rest, sell, bank, repair and restock
       in town → hunt again; flee for town when badly hurt or outmatched (courage decides how early); wait for daylight if cautious;
       now and then move on to another town. Targets are chosen by threat, distance, vulnerability and faction (SIM.advTarget).
     · They loot only their own kills (lawful), keep pocket gold in their pack and the rest in the bank.
     · Death is the player's death (§8, §20): SF.deathTransaction moves everything tradeable onto a body, the ghost walks to the
       nearest healer and comes back at 25 %, then walks back to the body and takes its things back. If the body is gone (decayed
       or looted) the gear is lost and they buy a new kit from the bank. Nothing is ever duplicated: items only move.
       ADV.cfg.res picks the policy: 'healer' (default), 'replace' (a successor arrives in town), 'none' (death is final).
     · The law treats them as people: they are innocent (blue); attacking one is a crime, killing one a murder; they fight back
       in self-defence and the guards help them. Looting an adventurer's body inside its loot-rights window is a crime.
     · Persistent: each has a stable id from its name (npc:aldric-sellsword) and is saved whole (position, vitals, skills, items,
       bank, record, body) in the save's `adv` block (additive; the save version is unchanged). Never respawned as a fresh copy.
   ?adv=off leaves them out (for comparison). Tiers: never below B, like the guards (src/tiers.js). */

const ADV = { on: !/[?&#]adv=off\b/.test(location.search + location.hash), list: [], next: 0, gone: [], waiting: [], cfg: SIM.ADV_CFG,
  stats: { kills: 0, deaths: 0, rises: 0, casts: 0, fizzles: 0, interrupts: 0, bandages: 0, potions: 0, loots: 0, trips: 0, sold: 0, bought: 0, repaired: 0, reclaimed: 0, lost: 0, flees: 0, moves: 0, replaced: 0, gains: 0 } };
const ADV_REAGENTS = Object.keys(SF.MAGERY.REAGENTS);
const ADV_KEEP = { gold: 1, bandage: 1, draught: 1, arrow: 1, spellbook: 1, garment: 1, journal: 1 };   // never sold
for (const r of ADV_REAGENTS) ADV_KEEP[r] = 1;
const ADV_SPELL_COL = { 'magery.05': '#ffd27a', 'magery.18': '#ff7a30', 'magery.42': '#5fe0d0', 'magery.30': '#e0f0ff', 'magery.12': '#c8a0ff' };
const ADV_TOWN_N = { vespar: 'Vespar', mynoc: 'Mynoc', skara: 'Skara Bryn', moonglen: 'Moonglen', camp: 'the Ashfen camp' };
/* where an adventurer calls home: one of the four towns, or (the outlaws, v0.39) the Ashfen outlaw camp, laid out like a small town */
let ADV_CAMP = null;
function advGeo(town) {
  if (town !== 'camp') return lifeTownGeo(town); if (ADV_CAMP) return ADV_CAMP; const c = ZONES.camp;
  return ADV_CAMP = { id: 'camp', blds: [], homes: [], center: { x: c.cx, y: c.cy }, hall: { x: c.cx - 1, y: c.cy + 2, r: 2.5 }, market: { x: c.cx, y: c.cy, r: 6 }, guards: [], patrol: [] };
}
const advById = id => ADV.list.find(e => e.actorId === id && !e.gone) || null;
const advFirst = e => String(e.name || '').split(',')[0];
const advNear = e => P && dist(e, P) < 24;

/* ---------- items: real items with real uids (they can end up on a body and in your pack) ---------- */
function advItem(id, qty) {
  const d = SF.ITEMS[id]; if (!d) return null; const f = d.fam && SF.EQ.fields ? SF.EQ.fields(id, { origin: 'npc' }) : {};
  return SF.newItem(id, qty || 1, Object.assign({}, f, SF.WEARABLE(id) || d.wpn ? { cond: 100, maxc: 100, omax: 100, origin: 'npc' } : {}));
}
function advGive(e, id, qty) { if (!(qty > 0) || !SF.ITEMS[id]) return; const ex = e.pack.items.find(o => o.id === id && SF.ITEMS[id].stack); if (ex) ex.qty += qty; else e.pack.items.push(advItem(id, qty)); e.pack.ver++; }
const advCount = (e, id) => SF.count(e.pack, id);
function advRegsOf(e) { const sp = e.adv.D.spells || []; const need = new Set(); for (const id of sp) for (const r of SF.MAGERY.SPELL[id].regs) need.add(r); return [...need]; }
const advRegMin = e => { const r = advRegsOf(e); return r.length ? Math.min(...r.map(k => advCount(e, k))) : 0; };
const advPurse = e => advCount(e, 'gold');
function advPay(e, n) { const p = Math.min(n, advPurse(e)); if (p) SF.removeQty(e.pack, 'gold', p); e.adv.bank = Math.max(0, e.adv.bank - (n - p)); }
/* the value of what it carries beyond its kit (shop prices), and its most worn piece (fraction of durability) */
function advLootValue(e) { let v = 0; for (const it of e.pack.items) if (it.id === 'gold') v += it.qty; else if (!ADV_KEEP[it.id]) v += (SF.PRICES[it.id] || 0) * it.qty; return v - Math.min(advPurse(e), 80); }
function advWorst(e) { let w = 1; for (const s in e.equip) { const it = e.equip[s]; if (it && it.maxc && it.cond !== undefined) w = Math.min(w, it.cond / it.maxc); } return w; }
const advCaster = e => e.adv.style === 'mage' || e.adv.style === 'healer';
const advPower = e => Math.max(skOf(e, weaponOfActor(e).skill), advCaster(e) ? skOf(e, 'magery') : 0);

/* ---------- learning: the shared skill engine, with the NPC as the character ---------- */
function advLearn(e, key, chance, ok, win) { const r = SF.SK.use(e, key, chance, ok, { rng: R, now: GT }, win); if (r && r.gained) { ADV.stats.gains++; if (r.stat) e.max = SF.maxHp(e); } return r; }
function advCheck(e, key) { const r = SF.SK.check(e, key, 0, 100, { rng: R, now: GT }); if (r.learn && r.learn.gained) ADV.stats.gains++; return r; }

/* ---------- population ---------- */
function advMake(npc, row, at) {
  const [name, style, town, courage, body] = row, D = SIM.ADV_STYLES[style]; if (!D || !(LIFE_TOWNS[town] || town === 'camp')) return null; const G = advGeo(town);
  const p = at || lifeSpot({ id: 31 + ADV.list.length * 17 }, G.market, 7, ADV.list.length);
  const e = npc('adventurer', name, p.x, p.y); e.town = town;
  e.str = D.str; e.dex = D.dex; e.int = D.int; e.skills = SF.newSkills(); for (const k in D.skills) if (e.skills[k]) e.skills[k].v = D.skills[k] * 10;
  e.equip = emptyEquip(); if (D.weapon) e.equip.weapon = advItem(D.weapon); if (D.shield) e.equip.shield = advItem(D.shield);
  for (const id of D.wear) { const s = SF.ITEMS[id] && SF.ITEMS[id].slot; if (s && !e.equip[s]) e.equip[s] = advItem(id); }
  e.eqMig = SF.EQ.MIGRATION; e.pack = SF.newContainer('pack', e.actorId);
  for (const k in D.kit) if (k === 'reagent') { for (const r of ADV_REAGENTS) advGive(e, r, D.kit[k]); } else advGive(e, k, D.kit[k]);
  advGive(e, 'gold', 40);
  e.npcFight = { fights: true, adv: true, hp: 1 }; e.max = SF.maxHp(e); e.hp = e.max; e.stam = SF.maxStam(e); e.mana = e.int; e.sw = SF.newSwing();
  e.downed = false; e.foe = null; e.ghost = false;
  e.adv = { style: D.style, key: style, D, town, courage, body, crim: D.crim || null, mode: 'town', why: ['arrived in town'], bank: 150, ground: null, grounds: 0, groundAt: 0, spot: null,
    thinkAt: 0, castReady: 0, potAt: 0, tend: null, prep: null, lootQ: null, busyUntil: 0, failN: 0, row: row.slice(),
    rec: { kills: 0, deaths: 0, trips: 0, loots: 0, earned: 0, casts: 0, bandages: 0 } };
  e.home = { x: p.x, y: p.y }; e._gLook = GEAR.npcLook(e.actorId || name, { body, cloth: D.cloth });
  ADV.list.push(e); return e;
}
function advPopulate(npc) {
  ADV.list.length = 0; ADV.gone = []; ADV.waiting = []; ADV.next = 0; if (!ADV.on) return;
  for (const row of SIM.ADV_ROSTER) advMake(npc, row);
  if (CRIM.on) for (const row of SIM.CRIM_ROSTER) advMake(npc, row);   // the outlaws (v0.39, src/npcdeath.js)
}

/* ---------- each step (the AdventurerAI controller) ---------- */
function advTick(e, dt) {
  const A = e.adv; if (!A) return;
  if (e.lunge) { e.lunge += dt / .2; if (e.lunge >= 1) e.lunge = 0; }
  if (e.ghost) return advGhostTick(e, dt);
  const fight = GT - (e.lastCombat ?? -99) < 6, rest = A.mode === 'town' && !fight;
  if (GT - (e.lastHit ?? -99) > .75) e.stam = Math.min(SF.maxStam(e), e.stam + (fight ? SF.STAM_REGEN_COMBAT : SF.STAM_REGEN) * dt);
  if (!fight && !e.poison) e.hp = Math.min(e.max, e.hp + (rest ? e.max * .012 : .1) * dt);   // a night's rest in town; slow on the road, like you
  e.mana = Math.min(e.int, e.mana + SF.SK.manaRegen(e.int, skOf(e, 'meditation'), 0, rest) * dt);
  if (e.poison && GT >= e.poison.next) { e.poison.next = GT + SF.POISON_GAP; advDamaged(e, SF.POISON[e.poison.tier], 'poison', null); if (e.poison && --e.poison.ticks <= 0) e.poison = null; if (e.ghost) return; }
  SF.swingTick(e.sw, GT, e.stam, weaponOfActor(e));
  advTendTick(e); advPrepTick(e); if (e.ghost) return;
  advReflex(e);
  if (GT >= A.thinkAt) { A.thinkAt = GT + .8 + (e.id % 10) * .02; advThink(e); }
  switch (A.mode) {
    case 'fight': advFight(e, dt); break;
    case 'flee': advFlee(e, dt); break;
    case 'town': advTown(e, dt); break;
    case 'loot': advLoot(e, dt); break;
    case 'reclaim': advReclaim(e, dt); break;
    default: advTravel(e, dt);
  }
  lifeSeparate(e);
}
/* the town it calls home: inside its jurisdiction counts as in town */
const advTownGeo = e => advGeo(e.adv.town);
const advInTown = e => { const G = advTownGeo(e); return Math.hypot(e.x - G.center.x, e.y - G.center.y) < Math.min(NPC_JURISDICTION, 40); };
const advNight = () => { const h = hourOfDay(); return h >= ADV.cfg.nightAt || h < ADV.cfg.dayStart; };
function advSay(e, lines, gap) { if (!advNear(e) || GT < (e.adv.sayAt || 0)) return; e.adv.sayAt = GT + (gap || 8); say(e, typeof lines === 'string' ? lines : pick(lines)); }

/* ---------- think: who to fight, what to do (SIM.advChoose) ---------- */
function advFoes(e) {
  const A = e.adv, C = ADV.cfg, out = [], mine = ecoPower(e), seek = A.mode === 'hunt' || (A.mode === 'fight' && A.was === 'hunt');
  ECOS.grid.query(e.x, e.y, C.sight, c => {
    if (c.kind !== 'mon' || !alive(c) || c.hidden || c.quest || c.pacified > GT || (A.ignore && A.ignore[c.id] > GT)) return;
    const onMe = c.target === e && c.state !== 'idle' && c.state !== 'return' && c.state !== 'flee';
    const onFriend = !onMe && !!c.target && ((c.target === P && P.hp < SF.maxHp(P) * .6) || (c.target.adv && !c.target.ghost) || (npcCombatant(c.target) && !c.target.adv)) && (c.state === 'chase' || c.state === 'tele' || c.state === 'strike' || c.state === 'rec');   // it helps you only when you are in trouble: your fights are yours
    const hostile = ecoEnemy(c, e);
    if (!onMe && !onFriend && !(seek && ecoP(c.type).temper !== 'passive')) return;
    if (!onMe && (protAt(c.x, c.y) || !los(e, c))) return;
    out.push({ id: aidOf(c), c, dist: dist(e, c), hpF: c.hp / Math.max(1, c.max), ratio: ecoPower(c) / Math.max(1, mine), onMe, onFriend, hostile });
  });
  return out;
}
function advThink(e) {
  const A = e.adv, C = ADV.cfg;
  // self-defence against you: the law gives it the right while your aggression stands
  // a person it is fighting: you or an NPC (v0.39). Lawful adventurers only while the law gives them the right; outlaws regardless
  let foe = null; const hf = e.foe && e.foe.kind !== 'mon' ? e.foe : null;
  if (hf && fighterAlive(hf) && !hf.hidden && dist(e, hf) < C.leash && (A.crim || LAW.rights(aidOf(e), aidOf(hf), GT))) foe = { c: hf, ratio: ecoPower(hf) / Math.max(1, ecoPower(e)) };
  if (!foe && A.crim) foe = crimPreyFor(e);   // a cutthroat picks its prey (src/npcdeath.js)
  if (!foe) { const pick_ = SIM.advTarget(advFoes(e), A.courage, C.sight); if (pick_) foe = pick_; }
  if (!foe && e.foe && e.foe.kind === 'mon' && fighterAlive(e.foe) && dist(e, e.foe) < C.leash && e.foe.target === e) foe = { c: e.foe, ratio: ecoPower(e.foe) / Math.max(1, ecoPower(e)) };
  const s = { hpF: e.hp / e.max, manaF: advCaster(e) ? e.mana / Math.max(1, e.int) : null, style: A.style, courage: A.courage, inTown: advInTown(e), night: advNight(),
    bandages: advCount(e, 'bandage'), draughts: advCount(e, 'draught'), arrows: advCount(e, 'arrow'), reagents: advRegMin(e), value: advLootValue(e), worst: advWorst(e),
    foe: foe ? { ratio: foe.ratio } : null, cur: A.mode, skip: { shop: GT - (A.noShop ?? -1e9) < 120, repair: GT - (A.noRepair ?? -1e9) < 120 } };
  // hysteresis: once running, keep running until nothing has been after it for 6 s
  if (A.mode === 'flee') { const chased = ents.some(c => c.kind === 'mon' && alive(c) && c.target === e && dist(c, e) < 18) || (e.foe === P && LAW.rights(aidOf(e), aidOf(P), GT) && dist(e, P) < 14);
    if (chased) A.safeAt = GT; if (GT - (A.safeAt || 0) < 6 && !(s.inTown && !chased)) return; }
  let d = SIM.advChoose(s, C);
  if (d.act !== 'fight' && d.act !== 'flee' && advBodyOf(e)) { if (A.mode !== 'reclaim') { e.nav = null; advSet(e, 'reclaim', ['going back for my body']); } return; }   // first, its own body (also after running from a fight)
  if (A.crim && d.act !== 'fight' && d.act !== 'flee' && A.mode !== 'town') {   // an outlaw robs the dead it has no right to (src/npcdeath.js)
    const b = crimBodyFor(e); if (b) { advSet(e, 'loot', ['robbing ' + b.name]); A.lootQ = b; return; } }
  if (d.act !== 'fight' && d.act !== 'flee' && A.mode !== 'town') {          // its own kills to loot, before moving on
    const c = advLootable(e); if (c) { advSet(e, 'loot', ['looting the ' + c.name.replace(/ remains$/, '')]); A.lootQ = c; return; } }
  if (d.act === 'fight') { if (e.foe !== foe.c) { e.foe = foe.c; e.nav = null; A.foeAt = GT; if (A.mode !== 'fight') A.was = A.mode; simEmit('CombatStarted', { actor: aidOf(e), target: aidOf(foe.c), x: e.x, y: e.y, detail: { why: foe.prey ? 'preying' : foe.c.kind !== 'mon' ? 'self-defence' : foe.onMe ? 'attacked' : foe.onFriend ? 'helping' : 'hunting' } });
      if (foe.prey) advSay(e, ['Your purse or your life. Both, then.', 'Nobody will hear you out here.', 'Should have stayed in town.'], 4);
      else if (foe.onFriend && foe.c.target === P) advSay(e, ['I have it!', 'Hold on, friend!', 'Over here, beast!']); else if (foe.c === P) advSay(e, ['You will regret that!', 'Thief! Murderer!', 'Guards! Guards!'], 4); }
    advSet(e, 'fight', d.why); return; }
  if (e.foe && (!fighterAlive(e.foe) || e.foe.kind !== 'mon')) { const w = e.foe; e.foe = null; simEmit('CombatEnded', { actor: aidOf(e), target: aidOf(w), x: e.x, y: e.y, detail: { outcome: !fighterAlive(w) ? 'won' : 'disengaged' } }); }
  if (d.act === 'flee') { if (A.mode !== 'flee') { ADV.stats.flees++; A.safeAt = GT; e.nav = null; advSay(e, ['Fall back!', 'Too many of them!', 'I need to get out of here!'], 4); } e.foe = null; advSet(e, 'flee', d.why); return; }
  if (d.act === 'town') { if (A.mode !== 'town') { if (A.mode === 'return' || A.mode === 'flee') { A.rec.trips++; ADV.stats.trips++; } A.spot = null; e.nav = null; } advSet(e, 'town', d.why); return; }
  if (d.act === 'return') { if (A.mode !== 'return') { e.nav = null; A.ground = null; } advSet(e, 'return', d.why); return; }
  // hunt: leaving town now and then means moving on to another town (§8: travelling between cities)
  if (!A.crim && A.mode === 'town' && A.rec.trips > 0 && A.rec.trips % 3 === 0 && A.movedTrip !== A.rec.trips && R() < .5) {
    A.movedTrip = A.rec.trips; const others = Object.keys(LIFE_TOWNS).filter(k => k !== A.town && !(A.dry && A.dry[k] > GT)); const to = others[Math.floor(R() * others.length)];
    A.town = to; e.town = to; A.spot = null; e.nav = null; ADV.stats.moves++; advSay(e, 'On to ' + ADV_TOWN_N[to] + '!'); advSet(e, 'return', ['moving on to ' + ADV_TOWN_N[to]]); return; }
  if (A.mode !== 'hunt') { e.nav = null; A.grounds = 0; A.ground = null; if (A.mode === 'town') advSay(e, ['Back to the hunt.', 'Time to earn my keep.', 'Off I go.']); }
  advSet(e, 'hunt', d.why);
}
function advSet(e, mode, why) { const A = e.adv; if (A.mode !== mode) { A.modeAt = GT; A.mode = mode; } A.why = why; }

/* ---------- reflexes: potions, bandages, healing and attack spells (any mode) ---------- */
function advReflex(e) {
  const A = e.adv, C = ADV.cfg, hpF = e.hp / e.max;
  if (A.prep) return;
  if (hpF < C.potionAt && GT > A.potAt && advCount(e, 'draught')) { const P0 = SF.CONSUMABLES.draught; SF.removeQty(e.pack, 'draught', 1); A.potAt = GT + P0.cd; const got = healActor(e, P0.heal); ADV.stats.potions++;
    simEmit('ActorHealed', { actor: aidOf(e), amount: got, x: e.x, y: e.y, detail: { how: 'draught' } }); sndAt('item.drink', e, { gain: .6 }); }
  if (advCaster(e) && GT > A.castReady) { const sp = advSpellChoice(e); if (sp) { advCast(e, sp.id, sp.self ? e : e.foe); return; } }
  if (!A.tend && skOf(e, 'healing') > 0 && (hpF < C.bandageAt || (e.poison && skOf(e, 'healing') >= 60 && skOf(e, 'anatomy') >= 60)) && advCount(e, 'bandage')) {
    const st = { ghost: false, poisoned: !!e.poison, hp: e.hp, max: e.max, isPlayer: true }, c = SF.firstAidCheck(st, { self: true, dist: 0, bandages: advCount(e, 'bandage'), busy: false });
    if (c.ok) { SF.removeQty(e.pack, 'bandage', 1); A.tend = { kind: c.kind, t1: GT + c.time, slips: 0 }; sndAt('item.bandage', e, { gain: .5 }); }
  }
}
function advTendTick(e) {
  const A = e.adv, b = A.tend; if (!b || GT < b.t1) return; A.tend = null;
  const now = SF.firstAidKind({ ghost: false, poisoned: !!e.poison, hp: e.hp, max: e.max, isPlayer: true }); if (now !== b.kind) return;   // the need changed: wasted, as for you
  const r = SF.firstAidResolve({ kind: b.kind, heal: skOf(e, 'healing'), ana: skOf(e, 'anatomy'), slips: b.slips, missing: e.max - e.hp }, R);
  if (r.chance > 0) { advLearn(e, 'healing', r.chance, r.success); advLearn(e, 'anatomy', r.chance, r.success); }
  ADV.stats.bandages++; A.rec.bandages++;
  if (!r.success) { floater(e.x, e.y, 'no effect', '#c8c8c8'); return; }
  if (b.kind === 'heal') { const got = healActor(e, r.amount); simEmit('ActorHealed', { actor: aidOf(e), amount: got, x: e.x, y: e.y, detail: { how: 'bandage' } }); }
  else if (b.kind === 'cure') { e.poison = null; floater(e.x, e.y, 'cured', '#7ee08a'); }
}

/* ---------- Magery: the player's rules with the adventurer's skills, mana and reagents ---------- */
function advSpellChoice(e) {
  const A = e.adv, M = skOf(e, 'magery'), foe = A.mode === 'fight' && e.foe && fighterAlive(e.foe) && e.foe !== e ? e.foe : null;
  const g = e.mg, warded = !!(g && g.armor && g.armor.until > GT);
  return SIM.advSpell({ style: A.style, M, mana: e.mana, hpF: e.hp / e.max, poisoned: !!e.poison, warded, foe: foe && los(e, foe) ? { dist: dist(e, foe) } : null,
    has: id => SF.MAGERY.SPELL[id].regs.every(r => advCount(e, r) > 0), chance: id => SF.MAGERY.bookChance(SF.MAGERY.SPELL[id], M) }, A.D.spells || [], id => SF.MAGERY.SPELL[id]);
}
function advCast(e, id, t) {
  const A = e.adv, sp = SF.MAGERY.SPELL[id]; if (!sp || !t || e.mana < sp.mp || !sp.regs.every(r => advCount(e, r) > 0)) return false;
  for (const r of sp.regs) SF.removeQty(e.pack, r, 1); e.mana -= sp.mp;   // reserved; an interruption gives the reagents back and keeps half the mana
  A.prep = { sp, t1: GT + sp.prep, t, regs: sp.regs.slice(), mp: sp.mp }; e.speed = 0; e.nav = null;
  say(e, sp.chant); FX.push({ k: 'msign', e, id: sp.id, t0: GT, dur: sp.prep + .2 }); ADV.stats.casts++; A.rec.casts++;
  if (t !== e) faceToward(e, t.x, t.y); return true;
}
function advInterrupt(e) {
  const A = e.adv, pr = A.prep; if (!pr) return; A.prep = null; const c = SF.MAGERY.interruptCost(pr.mp);
  for (const r of pr.regs) advGive(e, r, 1); e.mana = Math.min(e.int, e.mana + pr.mp - c); A.castReady = GT + SF.MAGERY.RECOVERY + .3; ADV.stats.interrupts++;
  sndAt('magic.fizzle', e, { gain: .6 }); floater(e.x, e.y, 'interrupted', '#c8c8c8');
}
function advPrepTick(e) {
  const A = e.adv, pr = A.prep; if (!pr || GT < pr.t1) return; A.prep = null; A.castReady = GT + SF.MAGERY.RECOVERY + .4;
  const sp = pr.sp, M = skOf(e, 'magery'), E = skOf(e, 'evaluatingintelligence'), ch = SF.MAGERY.bookChance(sp, M), ok = R() < ch;
  advLearn(e, 'magery', ch, ok, SF.SK.magCircleWindow(sp.circle));
  if (!ok) { ADV.stats.fizzles++; floater(e.x, e.y, 'fizzle', '#a8a8a8'); FX.push({ k: 'puff', x: e.x, y: e.y, t0: GT, dur: .6 }); sndAt('magic.fizzle', e, { gain: .7 }); return; }
  const t = pr.t; if (t !== e && (!fighterAlive(t) || dist(e, t) > (sp.range || 9) + .5 || !los(e, t))) { floater(e.x, e.y, 'no target', '#a8a8a8'); return; }
  simEmit('SpellCast', { actor: aidOf(e), target: aidOf(t), spell: sp.id, x: e.x, y: e.y, detail: { circle: sp.circle, chance: Math.round(ch * 100) / 100 } });
  e.lunge = .001;
  switch (sp.effect) {
    case 'direct': {
      if (t !== e) faceToward(e, t.x, t.y); e.lastCombat = GT;
      const land = () => advSpellHit(e, sp, t, M, E);
      if (sp.delay) { sndAt('magic.release', e, { gain: .7 }); EFX.push({ k: 'mproj', from: e, e: t, x: e.x, y: e.y, t0: GT, t1: GT + sp.delay, col: ADV_SPELL_COL[sp.id] || '#c8a0ff', until: GT + sp.delay + .05 }); at(sp.delay, land); }
      else land();
      advCheck(e, 'evaluatingintelligence'); return; }
    case 'heal': { const got = healActor(t, SF.MAGERY.rollBase(sp.id, M, R)); spellSnd(sp, t); simEmit('ActorHealed', { actor: aidOf(t), source: aidOf(e), amount: got, x: t.x, y: t.y, detail: { how: sp.id } }); return; }
    case 'cleanse': { if (t.poison && R() < SF.MAGERY.cureChance(M, t.poison.tier, 0)) { t.poison = null; floater(t.x, t.y, 'cured', '#7ee08a'); } else floater(t.x, t.y, 'cure fails', '#c8c8c8'); spellSnd(sp, t); return; }
    case 'armor_boon': armorBoon(t, M); spellSnd(sp, t); return;
  }
}
/* one landed spell: the circle's resistance roll against the recipient's Resisting Spells, Evaluating Intelligence focus */
function advSpellHit(e, sp, t, M, E) {
  if (!fighterAlive(t)) return;
  const Rv = t === P ? sv('resistingspells') : t.skills ? skOf(t, 'resistingspells') : rOf(t);
  const r = SF.MAGERY.resolveHit({ mode: sp.resist, base: SF.MAGERY.rollBase(sp.id, M, R), circle: sp.circle, M, E, R: Rv }, R);
  if (t === P && r.roll !== null && r.chance > 0 && svReal('resistingspells') < SF.SK.resistMaxFor(sp.circle)) skillCheck('resistingspells', 0, 120);
  else if (t !== P && t.adv && r.roll !== null && r.chance > 0) advLearn(t, 'resistingspells', r.chance, r.resisted);
  spellSnd(sp, t); if (sp.id === 'magery.18') FX.push({ k: 'boom', x: t.x, y: t.y, r: .7, t0: GT, dur: .5 }); if (sp.id === 'magery.30') FX.push({ k: 'bolt', x: t.x, y: t.y, t0: GT, dur: .3 });
  if (t === P) log(`${advFirst(e)}'s ${sp.n} strikes you: ${r.applied}${r.resisted ? ' (resisted)' : ''}.`, '#ff9a8a', 'combat');
  if (r.applied > 0) damageActor(t, r.applied, 'spell', e); else floater(t.x, t.y, '0', '#c8c8c8');
}

/* ---------- fighting ---------- */
function advFight(e, dt) {
  const A = e.adv, C = ADV.cfg, t = e.foe;
  if (!fighterAlive(t) || (t !== P && t.hidden) || (t === P && P.hidden) || dist(e, t) > C.leash) { if (t && !fighterAlive(t) && t.kind === 'mon') advSay(e, ['Got it.', 'That is done.', 'Next!'], 10); e.foe = null; advSet(e, A.was && A.was !== 'fight' ? A.was : 'hunt', ['fight over']); A.thinkAt = 0; return; }
  if (A.prep) { e.speed = 0; return; }
  if (GT - Math.max(e.lastCombat ?? -99, A.modeAt || 0, A.foeAt || 0) > 10) {   // ten seconds without a blow either way: out of reach (water, a wall, it fled). Leave it for a minute
    (A.ignore || (A.ignore = {}))[t.id] = GT + 60; e.foe = null; advSet(e, A.was && A.was !== 'fight' ? A.was : 'hunt', ['could not reach it']); A.thinkAt = 0; return; }
  e.nav = null; const w = weaponOfActor(e), d = dist(e, t), ranged = !!w.ammo, sees = los(e, t);
  if (A.style === 'mage') {                                         // a mage keeps its distance and wrestles only when cornered
    if (d < 2.2 && t.kind === 'mon') { if (d <= w.reach * .9 && sees) { e.speed = 0; faceToward(e, t.x, t.y); swingAt(e, t); } else allyStep(e, e.x - (t.x - e.x), e.y - (t.y - e.y), dt); return; }
    if (d > 8 || !sees) { allyStep(e, t.x, t.y, dt); return; }
    e.speed = 0; faceToward(e, t.x, t.y); return; }
  if (ranged && t.kind === 'mon' && d < 3.2 && t.target === e) { allyStep(e, e.x - (t.x - e.x), e.y - (t.y - e.y), dt); return; }   // an archer gives ground
  if (d > w.reach * .9 || !sees) { allyStep(e, t.x, t.y, dt); return; }
  e.speed = 0; faceToward(e, t.x, t.y); swingAt(e, t);
}
function advFlee(e, dt) {
  const A = e.adv, G = advTownGeo(e);
  if (!e.nav || e.nav.state === 'failed' || e.nav.state === 'done') { if (GT > (A.retryAt || 0)) { A.retryAt = GT + 3; advGo(e, G.center.x, G.center.y + 2, 'safety', true); } }
  if (e.nav && e.nav.state === 'moving') navStep(e, dt);
  else { const th = ents.find(c => c.kind === 'mon' && alive(c) && c.target === e); if (th) allyStep(e, e.x - (th.x - e.x), e.y - (th.y - e.y), dt); }
}

/* ---------- travelling: to a hunting ground, around it, and home ---------- */
/* one local search, sliced over steps like the travelling merchant's (direct): never the continent travel graph, whose first build is a
   multi-second stall on a phone (src/living.js builds it only for developer travellers) */
const ADV_NAV = { direct: true, doors: true, maxNodes: 400000, low: true };   // low: the background search lane (src/living.js navTick)
function advGo(e, x, y, name, run, nodes) { navTo(e, x, y, Object.assign({}, ADV_NAV, { speed: SF.WALK * (run ? .95 : .6), name }, nodes ? { maxNodes: nodes } : null)); }
function advPickGround(e) {
  const A = e.adv, C = ADV.cfg, G = advTownGeo(e), cap = advPower(e), cands = [];
  for (const m of ents) {
    if (m.kind !== 'mon' || !alive(m) || m.quest || m.hidden) continue; const d = MON[m.type]; if (!d || d.boss || ecoP(m.type).temper === 'passive') continue;
    if (levelAt(Math.floor(m.x), Math.floor(m.y)) || protAt(m.x, m.y)) continue;
    if (P && !P.ghost && Math.hypot(m.x - P.x, m.y - P.y) < 50) continue;   // the game around you is yours (§17: off-screen adventurers must not strip the world)
    const dd = Math.hypot(m.x - G.center.x, m.y - G.center.y); if (dd < C.hunt.min || dd > C.hunt.max) continue;
    const diff = d.diff || 30; if (diff > cap + 5) continue;
    if (ADV.list.some(o => o !== e && o.adv && o.adv.ground && Math.hypot(o.adv.ground.x - m.x, o.adv.ground.y - m.y) < 25)) continue;   // leave a ground another adventurer works
    if (A.bad && A.bad.some(b => GT < b.until && Math.hypot(b.x - m.x, b.y - m.y) < 30)) continue;   // a place it could not find a way to (across water, walled in)
    cands.push({ m, s: 1 - Math.abs(cap - 10 - diff) / 100 - dd / 400 - (ecoP(m.type).temper === 'timid' ? .3 : 0) });   // game that fights back is worth more than game that runs
  }
  if (!cands.length) return null; cands.sort((a, b) => b.s - a.s || a.m.id - b.m.id);
  const c = cands[Math.floor(R() * Math.min(5, cands.length))].m, sn = navSnap(Math.floor(c.x), Math.floor(c.y), 4);
  return sn ? { x: sn[0] + .5, y: sn[1] + .5, near: c.type } : null;
}
function advTravel(e, dt) {
  const A = e.adv, C = ADV.cfg;
  if (e.nav && e.nav.state === 'moving') { navStep(e, dt); return; }
  if (e.nav && e.nav.state === 'failed') { const g = e.nav.goal; e.nav = null; A.failN++; A.retryAt = GT + 2;
    if (A.mode === 'hunt') { if (A.ground && !A.groundAt) { A.bad = (A.bad || []).filter(b => GT < b.until).slice(-15); A.bad.push({ x: A.ground.x, y: A.ground.y, until: GT + 1800 }); } A.ground = null; A.grounds++; } }
  if (GT < (A.retryAt || 0)) { e.speed = 0; return; }
  if (A.mode === 'return') {
    if (advInTown(e)) { A.failN = 0; A.thinkAt = 0; advSet(e, 'town', ['home']); return; }
    if (e.nav && e.nav.state === 'done') { e.nav = null; A.failN++; }
    if (A.failN > 6) { const G = advTownGeo(e), p = lifeSpot(e, G.market, 6), seen = q => P && Math.hypot(q.x - P.x, q.y - P.y) < TIER.radii.a + 10;
      if (!seen(e) && !seen(p)) { lifeTeleport(e, p); A.failN = 0; return; }   // stuck for good: it finds its own way home, but only where nobody sees it happen
      if (A.failN > 12) { A.failN = 0; A.retryAt = GT + 20; } }
    const G = advTownGeo(e); advGo(e, G.center.x, G.center.y + 2, 'home to ' + ADV_TOWN_N[A.town]); return; }
  // hunt
  if (!A.ground) { if (A.grounds >= C.grounds) { advSet(e, 'return', ['no luck hunting']); return; } A.ground = advPickGround(e); A.groundAt = 0;
    if (!A.ground && A.crim) { A.grounds = C.grounds; advSet(e, 'return', ['no game near the camp']); return; }   // outlaws stay by their camp
    if (!A.ground) { const was = A.town; A.grounds = C.grounds;
      if (A.noGameAt === undefined || GT - A.noGameAt > 600) { A.noGameAt = GT; advSet(e, 'return', ['no game near ' + ADV_TOWN_N[was]]); return; }
      (A.dry || (A.dry = {}))[was] = GT + 3600; const others = Object.keys(LIFE_TOWNS).filter(k => k !== was && !(A.dry[k] > GT)), to = others.length ? others[Math.floor(R() * others.length)] : Object.keys(LIFE_TOWNS).find(k => k !== was); A.town = to; e.town = to; A.spot = null; e.nav = null; A.noGameAt = undefined; ADV.stats.moves++;   // twice in ten minutes: move on (§8: travelling between cities)
      advSay(e, 'Nothing to hunt here. On to ' + ADV_TOWN_N[to] + '.'); advSet(e, 'return', ['no game near ' + ADV_TOWN_N[was] + ': moving on to ' + ADV_TOWN_N[to]]); return; } }
  const gd = Math.hypot(A.ground.x - e.x, A.ground.y - e.y);
  if (gd > 5 && !A.groundAt && !(e.nav && e.nav.state === 'done')) { advGo(e, A.ground.x, A.ground.y, 'hunting ground', false, 60000); return; }   // a smaller search: an unreachable ground fails fast
  if (!A.groundAt) A.groundAt = GT;
  if (GT - A.groundAt > C.searchFor) { A.ground = null; A.grounds++; return; }   // nothing here: try another ground
  if (GT > (A.wanderAt || 0)) { A.wanderAt = GT + 6 + R() * 6; const a = R() * Math.PI * 2, r = 3 + R() * 7, sn = navSnap(Math.floor(A.ground.x + Math.cos(a) * r), Math.floor(A.ground.y + Math.sin(a) * r), 3); if (sn) navTo(e, sn[0] + .5, sn[1] + .5, { direct: true, doors: false, speed: SF.WALK * .5, name: 'searching', low: true }); }
  e.speed = 0;
}

/* ---------- looting its own kills (lawful), then on with the hunt ---------- */
function advLootable(e) {
  const A = e.adv; let best = null, bd = ADV.cfg.sight;
  for (const c of ents) { if (c.kind !== 'corpse' || c.gone || c.advKill !== e.actorId || c.advDone || !c.cont || !c.cont.items.some(advWants)) continue; const d = dist(e, c); if (d < bd) { bd = d; best = c; } }
  return best;
}
const advWants = it => it.id === 'gold' || ADV_KEEP[it.id] || ((SF.PRICES[it.id] || 0) >= 2 && (SF.ITEMS[it.id].kg || 0) <= 4);
function advLoot(e, dt) {
  const A = e.adv, c = A.lootQ;
  if (!c || c.gone) { A.lootQ = null; A.thinkAt = 0; advSet(e, 'hunt', ['looted']); return; }
  const d = dist(e, c), late = GT - (A.modeAt || GT) > 25;
  if (d > 1.3 && !(d <= 2 && (!e.nav || e.nav.state !== 'moving'))) {   // within 2 m, like you, once it has stopped walking
    if (late || (e.nav && e.nav.state === 'failed') || (e.nav && e.nav.state === 'done' && d > 2)) { c.advDone = true; (A.robbed || (A.robbed = {}))[c.id] = 1; A.lootQ = null; e.nav = null; return; }   // out of reach: leave it
    if (d < 6 && (!e.nav || e.nav.state !== 'moving') && los(e, c)) { e.nav = null; allyStep(e, c.x, c.y, dt); return; }   // the last few metres straight in, without waiting for a search (v0.39)
    if (!e.nav) navTo(e, c.x, c.y, { direct: true, doors: true, speed: SF.WALK * .6, name: 'loot', low: true }); if (e.nav && e.nav.state === 'moving') navStep(e, dt); return; }
  e.nav = null; e.speed = 0; if (!A.lootAt) { A.lootAt = GT + .6; sndAt('loot.rummage', c, { gain: .5 }); return; } if (GT < A.lootAt) return; A.lootAt = 0;
  const human = npcdHumanBody(c), illegal = human && npcdLooted(c, e);   // a person's body: inside its loot-rights window, robbing an innocent is a crime (v0.39)
  if (human) { (A.robbed || (A.robbed = {}))[c.id] = 1; if (A.crim) CRIM.stats.loots++; }
  let n = 0, val = 0; for (const it of c.cont.items.slice()) { if (!advWants(it)) continue; if (SF.containerKg(e.pack) + SF.itemKg(it) > 60) break; c.cont.items.splice(c.cont.items.indexOf(it), 1); c.cont.ver = (c.cont.ver || 0) + 1;
    const ex = SF.ITEMS[it.id].stack && e.pack.items.find(o => o.id === it.id); if (ex) ex.qty += it.qty; else e.pack.items.push(it); e.pack.ver++; n++; val += it.id === 'gold' ? it.qty : (SF.PRICES[it.id] || 0) * it.qty; }
  c.advDone = true; A.lootQ = null; A.rec.loots++; A.rec.earned += val; ADV.stats.loots++;
  if (n) simEmit('CorpseLooted', { actor: aidOf(e), x: c.x, y: c.y, detail: { items: n, value: val, lawful: !illegal } });
  if (n && c.mine && P) log(`${advFirst(e)} took ${n} item${n > 1 ? 's' : ''} from your body!`, '#ff6a5a');
  A.thinkAt = 0; advSet(e, A.was && A.was !== 'loot' && A.was !== 'fight' ? A.was : 'hunt', ['looted']);
}

/* ---------- in town: sell, repair, re-kit, restock, bank, rest ---------- */
function advTown(e, dt) {
  const A = e.adv, G = advTownGeo(e), night = advNight() && A.courage < .8;
  const want = night ? 'hall' : 'market'; if (!A.spot || A.spotKind !== want) { A.spot = want === 'hall' ? lifeSpot(e, G.hall, G.hall.r, e.id) : lifeSpot(e, G.market, 7, e.id); A.spotKind = want; e.nav = null; }
  if (e.nav && e.nav.state === 'done') { e.nav = null; A.spot = { x: e.x, y: e.y }; }
  if (Math.hypot(A.spot.x - e.x, A.spot.y - e.y) > 1.5) { if (!e.nav || (e.nav.state === 'failed' && GT > (A.retryAt || 0))) { A.retryAt = GT + 4; advGo(e, A.spot.x, A.spot.y, want === 'hall' ? 'the inn' : 'the market'); } if (e.nav && e.nav.state === 'moving') navStep(e, dt); else if (e.nav && e.nav.state === 'failed') A.spot = { x: e.x, y: e.y }; return; }
  e.nav = null; e.speed = 0; if (GT < A.busyUntil) return;
  if (advSell(e) || advRepair(e) || advRekit(e) || advShop(e) || advBank(e)) { A.busyUntil = GT + 2.5; return; }
  if (advWorst(e) < .95) A.noRepair = GT;   // nothing it could pay for: decided on (SIM.advChoose skip)
  const have = { bandage: advCount(e, 'bandage'), arrow: advCount(e, 'arrow'), reg: advRegMin(e) }, St = ADV.cfg.stock;
  if ((A.style !== 'mage' && have.bandage < St.bandage * .75) || (A.style === 'archer' && have.arrow < St.arrow * .75) || (advCaster(e) && have.reg < St.reagent * .75)) A.noShop = GT;
  if (e.max !== SF.maxHp(e)) e.max = SF.maxHp(e);
}
function advSell(e) {
  let g = 0; for (const it of e.pack.items.slice()) { if (ADV_KEEP[it.id] || it.id === 'gold') continue; g += Math.floor((SF.PRICES[it.id] || 0) * it.qty * .5); e.pack.items.splice(e.pack.items.indexOf(it), 1); }
  if (!g) return false; e.pack.ver++; advGive(e, 'gold', g); ADV.stats.sold++; simEmit('ItemTransferred', { actor: aidOf(e), x: e.x, y: e.y, detail: { what: 'sold loot', gold: g } }); return true;
}
function advRepair(e) {
  let cost = 0, n = 0; const funds = advPurse(e) + e.adv.bank;
  for (const s in e.equip) { const it = e.equip[s]; if (!it || !it.maxc || it.cond === undefined || it.cond >= it.maxc * .95) continue; const c = Math.ceil((it.maxc - it.cond) / it.maxc * (SF.PRICES[it.id] || 20) * .4); if (cost + c > funds) continue; cost += c; it.cond = it.maxc; n++; }
  if (!n) return false; advPay(e, cost); ADV.stats.repaired++; return true;
}
/* buy back missing pieces of its kit (after losing its body), most important first, as far as the bank allows */
function advRekit(e) {
  if (advBodyOf(e)) return false;   // its things are still out there: it goes back for them first
  const D = e.adv.D, want = []; if (D.weapon && !e.equip.weapon) want.push(D.weapon); if (D.shield && !e.equip.shield) want.push(D.shield);
  for (const id of D.wear) { const s = SF.ITEMS[id].slot; if (s && (!e.equip[s] || e.equip[s].id === 'garment')) want.push(id); }
  if (D.kit.spellbook && !advCount(e, 'spellbook')) want.push('spellbook');
  for (const id of want) { const p = SF.PRICES[id] || 20; if (advPurse(e) + e.adv.bank < p) continue; advPay(e, p);
    if (id === 'spellbook') advGive(e, id, 1); else { const s = SF.ITEMS[id].slot, it = advItem(id); if (e.equip[s]) { if (e.equip[s].id === 'garment') e.equip[s] = null; else e.pack.items.push(e.equip[s]); } e.equip[s] = it; }
    ADV.stats.bought++; return true; }
  return false;
}
function advShop(e) {
  const A = e.adv, have = {}; for (const it of e.pack.items) have[it.id] = (have[it.id] || 0) + it.qty;
  const r = SIM.advShopping(A.style, have, advPurse(e) + A.bank - 20, SF.PRICES, advRegsOf(e), ADV.cfg); if (!r.buys.length) return false;
  for (const b of r.buys) { advPay(e, b.cost); advGive(e, b.id, b.qty); } ADV.stats.bought++;
  simEmit('ItemTransferred', { actor: aidOf(e), x: e.x, y: e.y, detail: { what: 'bought supplies', items: r.buys.map(b => b.qty + ' ' + b.id).join(', ') } }); return true;
}
function advBank(e) { const p = advPurse(e); if (p <= 80) return false; SF.removeQty(e.pack, 'gold', p - 60); e.adv.bank += p - 60; return true; }

/* ---------- taking a blow (damageNpc routes adventurers here) ---------- */
function advDamaged(e, amt, kind, src, hx) {
  if (!npcUp(e) || !(amt > 0)) return; const A = e.adv;
  if (src && lawSide(src)) lawAggress(src, e);   // the swing already recorded it; this catches spells and pets
  e.hp -= amt; e.lastHit = GT; e.lastCombat = GT;
  simEmit('ActorDamaged', { actor: aidOf(e), source: aidOf(src), amount: amt, kind: kind || 'phys', x: e.x, y: e.y });
  floater(e.x, e.y, '-' + Math.round(amt), kind === 'poison' ? '#7be07b' : '#ff8a6a'); hitSound(e, kind, src, hx, e.hp <= 0);
  if (A.tend && kind !== 'poison') A.tend.slips++;   // fingers slip, as yours do
  if (A.prep) advInterrupt(e);
  advProvoked(e, src);
  if (e.hp <= 0) advDies(e, src);
}

/* attacked (a blow, or a swing at it that missed: swingAt calls this too): it fights back, and against you only while the law gives it the right */
function advProvoked(e, src) {
  const A = e.adv; if (!A || !npcUp(e)) return; const who = !src ? null : src.kind === 'mon' ? src : lawResponsible(src);
  if (!who || who === e || !fighterAlive(who)) return;
  if (who.kind === 'mon') { if (!e.foe || !fighterAlive(e.foe)) { e.foe = who; A.foeAt = GT; if (A.mode !== 'fight' && A.mode !== 'flee') { A.was = A.mode; advSet(e, 'fight', ['attacked by a ' + who.name]); } } return; }
  if (who !== P) {   // another person (v0.39): an adventurer fights back while the law gives it the right; an outlaw always does
    if (who.kind !== 'npc' || who === e) return;
    if ((A.crim || LAW.rights(aidOf(e), aidOf(who), GT)) && (!e.foe || e.foe.kind === 'mon') && A.mode !== 'flee') { e.foe = who; A.foeAt = GT; if (A.mode !== 'fight') A.was = A.mode === 'loot' ? 'hunt' : A.mode; advSet(e, 'fight', ['attacked by ' + advFirst(who)]); }
    if (!A.crim) npcCallGuards(e, who); return; }
  if (LAW.rights(aidOf(e), aidOf(P), GT) && (!e.foe || e.foe.kind !== 'mon' || dist(e, e.foe) > 3) && A.mode !== 'flee') {
    if (e.foe !== P) advSay(e, ['You will regret that!', 'Guards! Help!', 'So that is how it is.'], 4);
    e.foe = P; A.foeAt = GT; if (A.mode !== 'fight') A.was = A.mode === 'loot' ? 'hunt' : A.mode; advSet(e, 'fight', ['attacked by you']); }
  npcCallGuards(e, P);
}

/* ---------- death, the ghost, resurrection, reclaiming the body (the player's rules) ---------- */
function advDies(e, src) {
  if (e.ghost) return; const A = e.adv;
  simEmit('ActorKilled', { actor: aidOf(e), killer: aidOf(src), x: e.x, y: e.y });
  lawDowned(e, src);   // an innocent killed by someone with no right over them reports a murder (src/law.js)
  const look = gearSnapOf(e);   // taken before the items move
  e.hp = 0; e.ghost = true; e.foe = null; e.nav = null; e.poison = null; e.speed = 0; A.ghostAt = GT; A.tend = null; A.prep = null; A.lootQ = null; A.healer = null; e.mg = null;
  const body = SF.deathTransaction(e, GT, { x: e.x, y: e.y }); body.owner = e.actorId;
  addEnt({ kind: 'corpse', advBody: e.actorId, name: advFirst(e) + "'s body", x: e.x, y: e.y, cont: body, expires: body.expires, gear: look, t0: GT, sect: e.sect || 0 });
  for (const o of ents) if (o.target === e) { o.target = null; if (o.kind === 'mon' && o.state !== 'flee') o.state = 'return'; if (o.mind) o.mind.act = null; }
  for (const g of LIFE.npcs) if (g.foe === e) g.foe = null; for (const o of ADV.list) if (o.foe === e) o.foe = null;
  A.rec.deaths++; ADV.stats.deaths++; advSet(e, 'ghost', ['dead: ' + (SIM.advAfterDeath(ADV.cfg) === 'healer' ? 'looking for a healer' : 'gone')]);
  if (P.sel === e && P.armed) P.armed = false;
  if (advNear(e)) log(`${e.name} has fallen${src === P ? ' by your hand' : src && src.kind === 'mon' ? ' to a ' + src.name : src && src.name ? ' to ' + advFirst(src) : ''}. The body holds everything they carried.`, '#ff8a6a');
  sndAt('player.death', e, { gain: .7 });
}
const advBodyOf = e => ents.find(c => c.advBody === e.actorId && !c.gone && !c.abandoned) || null;   // abandoned: it gave up on reaching it
function advHealer(e) { let best = null, bd = 1e9; const lv = levelAt(Math.floor(e.x), Math.floor(e.y)) || null; for (const h of ents) if (h.kind === 'npc' && h.role === 'healer' && !h.gone && (levelAt(Math.floor(h.x), Math.floor(h.y)) || null) === lv) { const d = dist(h, e); if (d < bd) { bd = d; best = h; } } return best; }
function advGhostTick(e, dt) {
  const A = e.adv, pol = SIM.advAfterDeath(ADV.cfg); e.speed = 0;
  if (pol !== 'healer') { if (GT - A.ghostAt > 20) advRetire(e, pol); return; }
  if (!A.healer || A.healer.gone) A.healer = advHealer(e); const h = A.healer;
  if (h && dist(e, h) < 2.4) return advResurrect(e, 'by ' + h.name);
  if (GT - A.ghostAt > ADV.cfg.ghostWait) { const p = h ? (canStand(e, h.x + .9, h.y + .9) ? { x: h.x + .9, y: h.y + .9 } : { x: h.x, y: h.y + 1 }) : null; if (p) lifeTeleport(e, p); return advResurrect(e, h ? 'by ' + h.name : 'by a wandering healer'); }
  if (h && (!e.nav || ((e.nav.state === 'failed' || e.nav.state === 'done') && GT > (A.retryAt || 0)))) { A.retryAt = GT + 5; navTo(e, h.x + .8, h.y + .8, Object.assign({}, ADV_NAV, { speed: SF.WALK * .7, name: 'a healer' })); }
  if (e.nav && e.nav.state === 'moving') navStep(e, dt);
}
function advResurrect(e, how) {
  const A = e.adv; e.ghost = false; e.hp = Math.ceil(e.max * .25); e.mana = Math.ceil(e.int * .2); e.stam = Math.ceil(SF.maxStam(e) * .2); e.nav = null; ADV.stats.rises++;
  FX.push({ k: 'ring', x: e.x, y: e.y, c: '#fff2b0', t0: GT, dur: .8 }); sndAt('player.revive', e, { gain: .7 });
  simEmit('ActorResurrected', { actor: aidOf(e), x: e.x, y: e.y, detail: { how } });
  if (advNear(e)) log(`${e.name} returns to life (${how}).`, '#ffe08a');
  const body = advBodyOf(e);
  if (body) advSet(e, 'reclaim', ['going back for my body']); else { ADV.stats.lost++; A.spot = null; advSet(e, 'return', ['my body is gone; buying new gear']); }
  A.thinkAt = GT + 1;
}
function advReclaim(e, dt) {
  const A = e.adv, body = advBodyOf(e);
  if (!body) { ADV.stats.lost++; A.spot = null; advSet(e, 'return', ['my body is gone; buying new gear']); return; }
  const bd = dist(e, body);
  if (bd > 2 && GT - (A.modeAt || GT) > 150) { body.abandoned = true; ADV.stats.lost++; A.spot = null; e.nav = null; advSet(e, 'return', ['could not reach my body; buying new gear']); return; }   // the body stays where it fell, for anyone, until it decays
  if (bd > 2) {   // within 2 m, like you
    if (bd < 6 && (!e.nav || e.nav.state !== 'moving')) { e.nav = null; allyStep(e, body.x, body.y, dt); return; }   // the last few metres straight in
    if (!e.nav || ((e.nav.state === 'failed' || e.nav.state === 'done') && GT > (A.retryAt || 0))) { A.retryAt = GT + 4; navTo(e, body.x, body.y, Object.assign({}, ADV_NAV, { speed: SF.WALK * .6, name: 'my body' })); }
    if (e.nav && e.nav.state === 'moving') navStep(e, dt); return; }
  e.nav = null; e.speed = 0; let n = 0;
  for (const it of body.cont.items.slice()) { const s = SF.ITEMS[it.id].slot;
    if (s && e.equip[s] !== undefined && (!e.equip[s] || e.equip[s].id === 'garment')) { if (e.equip[s] && e.equip[s].id === 'garment') e.pack.items.push(e.equip[s]); e.equip[s] = it; }
    else { const ex = SF.ITEMS[it.id].stack && e.pack.items.find(o => o.id === it.id); if (ex) ex.qty += it.qty; else e.pack.items.push(it); }
    n++; }
  e.pack.items = e.pack.items.filter(it => it.id !== 'garment' && it.id !== 'journal'); e.pack.ver++;   // the respawn tunic and journal stay behind with the body
  body.cont.items = []; rmEnt(body); if (P.lootOpen === body) { closePanel(); P.lootOpen = null; }
  ADV.stats.reclaimed++; simEmit('CorpseLooted', { actor: aidOf(e), x: e.x, y: e.y, detail: { items: n, own: true } }); advSay(e, 'Got my gear back.');
  A.spot = null; advSet(e, 'return', ['back to town to recover']); A.thinkAt = GT + 1;
}
/* 'replace' and 'none': the ghost leaves the world; with 'replace' a successor of the same calling arrives in town later */
function advRetire(e, pol) {
  const A = e.adv; ADV.gone.push(e.actorId); rmEnt(e); ADV.list.splice(ADV.list.indexOf(e), 1);
  if (pol === 'replace') { const nm = SIM.ADV_SUCCESSORS[ADV.next++ % SIM.ADV_SUCCESSORS.length] + (ADV.next > SIM.ADV_SUCCESSORS.length ? ' ' + (Math.floor(ADV.next / SIM.ADV_SUCCESSORS.length) + 1) : ''), row = A.row.slice();
    row[0] = nm + ', ' + String(A.row[0]).split(', ').slice(1).join(', '); row[2] = A.town; ADV.waiting.push({ row, at: GT + ADV.cfg.replaceAfter }); }
}
function advSuccessors() {
  for (const w of ADV.waiting.slice()) if (GT >= w.at) { ADV.waiting.splice(ADV.waiting.indexOf(w), 1); const e = advMake((role, name, x, y) => addEnt({ kind: 'npc', role, name, x, y, sect: 0 }), w.row); if (e) { ADV.stats.replaced++; if (advNear(e)) log(`${e.name} arrives in ${ADV_TOWN_N[e.adv.town]}.`, '#ffe08a'); } }
}

/* ---------- you and adventurers: talking, looting their bodies ---------- */
function advTalk(n) {
  const A = n.adv; if (!A) return false; if (A.crim) return crimTalk(n);
  if (n.ghost) { say(n, pick(['Oooo… (a ghost, looking for a healer)', 'Wooo… my body… my things…'])); return true; }
  const no = notoOf(P); if (no === 'murderer' || no === 'criminal') { say(n, no === 'murderer' ? 'Stay back, murderer!' : 'I do not talk to criminals.'); return true; }
  const first = (P.name || 'friend').split(' ')[0], town = ADV_TOWN_N[A.town];
  const line = { fight: 'Not now!', flee: 'Run!', loot: 'Mine, I killed it.', reclaim: 'I died out there. Going back for my things.',
    hunt: A.ground ? 'Hunting ' + (MON[A.ground.near] ? MON[A.ground.near].n + 's' : 'out here') + '. Good coin in it.' : 'Looking for something to hunt.',
    return: 'Heading back to ' + town + (A.why.includes('pack full of loot') ? ' with a heavy pack.' : A.why.includes('night is falling') ? ' before dark.' : '.'),
    town: advNight() && A.courage < .8 ? 'Not going out there at night. Morning, then.' : A.rec.kills ? `${A.rec.kills} kills since I came to ${town}. Back out soon, ${first}.` : 'Resting up, then back out there.' }[A.mode] || 'Well met.';
  say(n, line); return true;
}
/* the take button on a body (src/game.js) calls this: inside its loot-rights window, looting an innocent's body is a crime */
function advLooted(c) { return npcdLooted(c, P); }   // since v0.39 one rule for every person's body (src/npcdeath.js)

/* ---------- save: everything an adventurer is, by actor id (the save's `adv` block, additive) ---------- */
function advSave() {
  if (!ADV.on) return null;
  const list = ADV.list.filter(e => !e.gone).map(e => { const A = e.adv, b = ents.find(c => c.advBody === e.actorId && !c.gone);
    return { id: e.actorId, row: A.row, town: A.town, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, hp: Math.round(e.hp), mana: Math.round(e.mana), stam: Math.round(e.stam), str: e.str, dex: e.dex, int: e.int,
      skills: e.skills, equip: e.equip, pack: e.pack.items, bank: A.bank, rec: A.rec, poison: e.poison ? { tier: e.poison.tier, ticks: e.poison.ticks } : null,
      ghost: !!e.ghost, ghostAgo: e.ghost ? Math.round(GT - A.ghostAt) : 0, mode: A.mode, movedTrip: A.movedTrip || 0,
      body: b ? { x: b.x, y: b.y, items: b.cont.items, left: Math.round(b.expires - GT), diedAgo: Math.round(GT - b.cont.diedAt), gear: b.gear || null, sect: b.sect || 0 } : null }; });
  return { v: SIM.ADV_VERSION, next: ADV.next, gone: ADV.gone.slice(), waiting: ADV.waiting.map(w => ({ row: w.row, left: Math.max(0, Math.round(w.at - GT)) })), list };
}
function advLoad(s) {
  if (!ADV.on || !s || s.v !== SIM.ADV_VERSION || !Array.isArray(s.list)) return;
  ADV.next = s.next | 0; ADV.gone = Array.isArray(s.gone) ? s.gone.slice() : []; ADV.waiting = (s.waiting || []).filter(w => w && Array.isArray(w.row)).map(w => ({ row: w.row, at: GT + (w.left || 0) }));
  const npc = (role, name, x, y) => addEnt({ kind: 'npc', role, name, x, y, sect: 0 }), seen = new Set();
  for (const r of s.list) {
    if (!r || typeof r.id !== 'string' || seen.has(r.id) || !Array.isArray(r.row) || !SIM.ADV_STYLES[r.row[1]]) continue;
    let e = advById(r.id); if (!e) { e = advMake(npc, r.row); if (!e || e.actorId !== r.id) { if (e) { rmEnt(e); ADV.list.splice(ADV.list.indexOf(e), 1); } continue; } }
    seen.add(r.id); const A = e.adv;
    if (LIFE_TOWNS[r.town]) { A.town = r.town; e.town = r.town; }
    for (const k of ['str', 'dex', 'int']) if (Number.isFinite(r[k])) e[k] = cl(r[k], 10, 125);
    if (r.skills && typeof r.skills === 'object') for (const k in e.skills) if (r.skills[k] && Number.isFinite(r.skills[k].v)) e.skills[k] = Object.assign({}, e.skills[k], { v: cl(r.skills[k].v, 0, SF.SKILL_MAX) });
    if (r.equip && typeof r.equip === 'object') { e.equip = emptyEquip(); for (const sl in e.equip) { const it = r.equip[sl]; if (it && SF.ITEMS[it.id]) e.equip[sl] = it; } }
    if (Array.isArray(r.pack)) { e.pack.items = r.pack.filter(it => it && SF.ITEMS[it.id] && it.qty > 0); e.pack.ver++; }
    e.max = SF.maxHp(e); A.bank = Math.max(0, r.bank | 0); if (r.rec) Object.assign(A.rec, r.rec); A.movedTrip = r.movedTrip || 0;
    if (Number.isFinite(r.x) && Number.isFinite(r.y) && canStand(e, r.x, r.y)) { e.x = r.x; e.y = r.y; e._px = e.x; e._py = e.y; } else { const p = lifeSpot(e, advTownGeo(e).market, 7); lifeTeleport(e, p); }
    e.hp = cl(Number.isFinite(r.hp) ? r.hp : e.max, 0, e.max); e.mana = cl(Number.isFinite(r.mana) ? r.mana : e.int, 0, e.int); e.stam = cl(Number.isFinite(r.stam) ? r.stam : SF.maxStam(e), 0, SF.maxStam(e));
    e.poison = r.poison && SF.POISON[r.poison.tier] ? { tier: r.poison.tier, ticks: Math.max(1, r.poison.ticks | 0), next: GT + SF.POISON_GAP } : null;
    if (r.ghost) { e.ghost = true; e.hp = 0; A.ghostAt = GT - Math.max(0, r.ghostAgo || 0); advSet(e, 'ghost', ['dead: looking for a healer']); }
    else { if (e.hp <= 0) e.hp = 1; advSet(e, advInTown(e) ? 'town' : r.mode === 'reclaim' ? 'reclaim' : 'return', ['resumed']); }
    if (r.body && r.body.left > 0 && Array.isArray(r.body.items)) { const cont = SF.newContainer('corpse', e.actorId); cont.items = r.body.items.filter(it => it && SF.ITEMS[it.id]); cont.owner = e.actorId; cont.diedAt = GT - (r.body.diedAgo ?? 999); cont.expires = GT + r.body.left;
      addEnt({ kind: 'corpse', advBody: e.actorId, name: advFirst(e) + "'s body", x: r.body.x, y: r.body.y, cont, expires: cont.expires, gear: r.body.gear || null, t0: GT - 9, sect: r.body.sect || 0 }); }
  }
  for (const e of ADV.list.slice()) if (!seen.has(e.actorId)) { if (ADV.gone.includes(e.actorId)) { rmEnt(e); ADV.list.splice(ADV.list.indexOf(e), 1); } }   // retired for good in that world
}
/* item uids the save must count (the save's uid counter, src/game.js save) */
function advScanItems(s, scan) { if (!s) return; for (const a of s.list) { Object.values(a.equip || {}).forEach(scan); (a.pack || []).forEach(scan); if (a.body) a.body.items.forEach(scan); } }

/* ---------- developer panel, inspector, target frame ---------- */
function advStatus(e) { const A = e.adv; if (!A) return ''; if (e.ghost) return 'ghost'; return { hunt: 'hunting', fight: 'fighting', flee: 'fleeing', return: 'heading home', town: advNight() && A.courage < .8 ? 'resting for the night' : 'in town', loot: 'looting', reclaim: 'going back for the body' }[A.mode] || A.mode; }
function advInspect(e) {
  const A = e && e.adv; if (!A) return {};
  const top = Object.entries(e.skills).filter(([, s]) => s.v > 0).sort((a, b) => b[1].v - a[1].v).slice(0, 4).map(([k, s]) => k + ' ' + (s.v / 10).toFixed(1)).join(', ');
  return { adventurer: A.key + ' · ' + ADV_TOWN_N[A.town] + ' · courage ' + A.courage, doing: advStatus(e), decision: A.why.join('; '), ground: A.ground ? Math.round(A.ground.x) + ',' + Math.round(A.ground.y) + (A.ground.near ? ' (' + A.ground.near + ')' : '') : null,
    vitals: { hp: [Math.round(e.hp), e.max], mana: [Math.round(e.mana), e.int], stam: Math.round(e.stam) }, skills: top, purse: advPurse(e), bank: A.bank,
    supplies: { bandages: advCount(e, 'bandage'), draughts: advCount(e, 'draught'), arrows: advCount(e, 'arrow'), reagents: advRegMin(e) }, record: A.rec, casting: A.prep ? A.prep.sp.n : null, tending: A.tend ? A.tend.kind : null };
}
function advDev() {
  if (!ADV.on) return 'adventurers: off (?adv=off)'; const by = {}; for (const e of ADV.list) { const k = advStatus(e); by[k] = (by[k] || 0) + 1; } const s = ADV.stats;
  return `adventurers: ${ADV.list.length} · ${Object.entries(by).map(([k, v]) => k + ' ' + v).join(', ')} · kills ${s.kills}, deaths ${s.deaths}, rises ${s.rises}, flights ${s.flees}, trips ${s.trips}, moves ${s.moves} · casts ${s.casts} (fizzles ${s.fizzles}, interrupted ${s.interrupts}) · bandages ${s.bandages}, draughts ${s.potions} · loots ${s.loots}, sold ${s.sold}, bought ${s.bought}, repaired ${s.repaired} · bodies reclaimed ${s.reclaimed}, lost ${s.lost} · skill gains ${s.gains} · policy ${SIM.advAfterDeath(ADV.cfg)}`;
}
/* each step, once (game update): successors that are due */
function advWorldTick() { if (ADV.waiting.length) advSuccessors(); }
