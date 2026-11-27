// stats-smoke scenario: real gameplay paths through the stat contract (one roll per resolved action, aux skills never roll,
// no gain from trainers, ghosts or fast-forwarded time, the transfer at 225, the Strength policy, no free healing).
// The chance and cooldown are forced through SF.STATS.CFG (configuration, never a callsite) so every eligible action gains.
(async () => {
  const S = window.__SF, P = S.P, SF = S.SF, ST = SF.STATS; const out = {};
  const step = sec => { for (let i = 0; i < Math.round(sec / .05); i++) S.update(.05); };
  // an open spot with no creatures around (same search as the combat scenarios)
  let spot = null; for (let k = 0; k < 2000 && !spot; k++) { const x = 120 + (k % 40) * 4, y = 230 + Math.floor(k / 40) * 2; let ok = true; for (let dx = -6; dx <= 6 && ok; dx++) for (let dy = -6; dy <= 6; dy++) if (S.BLK[S.tAt(x + dx, y + dy)] || S.tAt(x + dx, y + dy) === S.T.WA || S.protAt(x + dx, y + dy)) { ok = false; break; } if (ok) spot = [x, y]; }
  const home = () => { P.x = spot[0] + .5; P.y = spot[1] + .5; };
  home(); for (const e of S.ents.slice()) if (e.kind === 'mon' || e.kind === 'ally') { e.gone = true; S.ents.splice(S.ents.indexOf(e), 1); }
  for (const sp of S.SPAWNS || []) sp.next = 1e9;
  let nid = 93000; const add = (type, dx, dy, hp) => { const d = S.MON[type]; const e = { kind: 'mon', type, name: d.n, x: P.x + dx, y: P.y + dy, hp: hp || d.hp, max: hp || d.hp, state: 'idle', home: { x: P.x + dx, y: P.y + dy }, sect: 0, ward: 0, id: nid++, speed: 0, aggro: 0 }; S.ents.push(e); return e; };
  const give = (id, n) => { const it = SF.newItem(id, n || 1, SF.ITEMS[id].stack ? null : { cond: 100, maxc: 100, omax: 100 }); SF.addItem(P.pack, it); return it; };
  const L = () => S.STATLOG.length, since = n => S.STATLOG.slice(n);
  const tot = () => ST.total(P);
  Object.assign(ST.CFG, { base: 1, min: 1, max: 1, trivial: 1, cooldown: 0, repeatFreeSkill: 1e9, repeatFreeTarget: 1e9 });
  const idle = () => { P.task = null; P.batch = null; P.prep = null; P.held = null; P.bandage = null; P.meditating = null; P.hidden = false; P.spellReadyAt = 0; P.consumeGap = 0; };
  const reset = (b) => { P.base = Object.assign({}, b || { str: 35, dex: 20, int: 25 }); P.statState.locks = { str: 'raise', dex: 'raise', int: 'raise' }; S.recomputeStats(); };
  reset();

  // melee: a miss and a hit are both one roll on the weapon skill; Tactics and Anatomy (aux) add none
  const rat = add('rat', 1, 0, 9999); P.sel = rat; P.hp = 5;
  let n0 = L(), t0 = tot(); S.setRng(() => .99); P.sw = SF.newSwing(); S.swingAt(P, rat); S.setRng(null);
  out.miss = { rolls: since(n0).map(l => l.k), total: tot() - t0 };
  n0 = L(); t0 = tot(); S.setRng(() => 0); P.sw = SF.newSwing(); S.swingAt(P, rat); S.setRng(null);
  out.hit = { rolls: since(n0).map(l => l.k), total: tot() - t0, ratHurt: rat.hp < 9999 };
  out.noRefill = P.hp === 5;
  out.journal = S.LOG.filter(l => /^Your (Strength|Dexterity|Intelligence) has increased to \d+\.$/.test(l.t)).length;
  // the same action id never rolls twice
  n0 = L(); S.gain('tactics', 50, { act: 'smoke-dup' }); S.gain('anatomy', 50, { act: 'smoke-dup' }); out.sharedAction = L() - n0;
  // archery: the release is the action
  P.equip.weapon = SF.newItem('shortbow', 1, { cond: 100, maxc: 100, omax: 100 }); S.weaponChanged(); give('arrow', 20); P.movedAt = -99; rat.x = P.x + 5;
  n0 = L(); P.sw = SF.newSwing(); const fired = S.swingAt(P, rat); out.archery = { fired, rolls: since(n0).map(l => l.k) }; step(1.2);
  P.equip.weapon = null; S.weaponChanged(); rat.x = P.x + 1;
  // mining at a Quay face: a resolved stroke at a finite node
  const [rx, ry] = S.QUAY_ROCKS[0]; const node = S.nodeAt(rx, ry); P.x = rx + 1.5; P.y = ry + .5; give('pickaxe');
  idle(); n0 = L(); t0 = tot(); S.finishStroke(node); idle(); out.mining = { rolls: since(n0).map(l => l.k), total: tot() - t0 };
  // smithing at the Quay anvil: rivets from one iron bar
  const an = S.STATIONS.find(s => s.k === 'anvil'); P.x = an.x + 1.5; P.y = an.y + .5; give('tongs'); give('ironbar', 2);
  idle(); P.lastCombat = -99; P.lastHit = -99; rat.x = P.x + 30; n0 = L(); S.startCraft('rivets', 1); out.craftLog = S.LOG.slice(-2).map(l => l.t); step(SF.craftTime(SF.RECIPE.rivets) + .3); out.smithing = { rolls: since(n0).map(l => l.k) };
  idle(); home();
  // First Aid on yourself: a completed treatment is one roll on Healing; Anatomy is auxiliary
  P.hp = Math.max(1, P.str - 20); give('bandage', 5); n0 = L(); S.firstAid(P); step(16); out.healing = { rolls: since(n0).map(l => l.k), hpRose: P.hp > Math.max(1, P.str - 20) - 1 };
  // Magery: one roll per cast (on Spellcraft); Spell Focus on the damage is auxiliary
  give('spellbook'); const bk = P.pack.items.find(i => i.id === 'spellbook'); bk.spells = Array.from(new Set((bk.spells || []).concat(['magery.04', 'magery.05'])));
  for (const r of ['garlic', 'ginseng', 'spider_silk', 'black_pearl', 'nightshade']) give(r, 5);
  P.skills.spellcraft.v = 600; P.mana = SF.maxMana(P); P.hp = Math.max(1, P.hp - 3); P.spellReadyAt = 0;
  idle(); n0 = L(); S.castSlot('magery.04'); step(2.5); out.castSelf = { rolls: since(n0).map(l => l.k) };
  idle(); P.mana = SF.maxMana(P); rat.x = P.x + 3; n0 = L(); S.castSlot('magery.05'); step(1); const held = !!P.held; if (P.held) S.releaseHeld(rat); step(1.5);
  out.castFoe = { held, rolls: since(n0).map(l => l.k) };
  // meditation: a completed interval that restored missing mana is one roll; idle meditation at full mana is none
  const calm = d => { rat.x = P.x + d; rat.y = P.y; rat.target = null; rat.state = 'idle'; rat.home = { x: rat.x, y: rat.y }; P.lastHit = -99; P.lastCombat = -99; };   // the arrow angered it
  calm(40); idle(); P.mana = 1; P.skills.meditation.v = 500; n0 = L(); S.meditate(); step(SF.STATS.CFG.meditateEvery + .6); out.meditation = { rolls: since(n0).map(l => l.k), meditating: !!P.meditating };
  P.meditating = null; P.mana = SF.maxMana(P); n0 = L(); S.meditate(); step(SF.STATS.CFG.meditateEvery + .6); out.meditateFull = L() - n0;
  // hiding with a creature about; a bard song (Musicianship auxiliary, the bard skill rolls once, even when the playing falters)
  idle(); calm(8); n0 = L(); S.hide(); step(1); out.hiding = { rolls: since(n0).map(l => l.k) }; P.hidden = false;
  S.setRng(() => .99); n0 = L(); S.TASKS.bard({ m: rat, skill: 'provocation' }); S.setRng(null); out.bardFail = since(n0).map(l => l.k);
  S.setRng(() => 0); n0 = L(); S.TASKS.bard({ m: rat, skill: 'provocation' }); S.setRng(null); out.bardOk = since(n0).map(l => l.k);
  // a trainer lesson raises a skill and never an attribute, and there is no attribute purchase left
  const gold0 = SF.count(P.pack, 'gold'); P.freeLessons = 1; P.skills.tracking.v = 0; const b0 = JSON.stringify(P.base); n0 = L();
  S.ACT.train({ k: 'tracking' }); out.trainer = { skill: P.skills.tracking.v, base: JSON.stringify(P.base) === b0, rolls: L() - n0, gold: SF.count(P.pack, 'gold') === gold0, noStatAction: S.ACT.stat === undefined };
  S.openPanel('trainer'); S.ACT.tab({ t: 'stats' }); out.trainerTab = { buttons: document.querySelectorAll('#panel [data-a=stat]').length, text: /grow while you use your skills/.test(document.querySelector('#panel').textContent) }; S.closePanel();
  // fast-forwarded time (developer panel) never trains
  S.DEV.advance = 30; n0 = L(); S.gain('mining', 50); out.devAdvance = L() - n0; S.DEV.advance = 0;
  // the transfer at 225, then the Strength policy when the lowered stat is Strength
  idle(); reset({ str: 100, dex: 100, int: 25 }); P.statState.locks.str = 'lower'; n0 = L(); S.gain('spellcraft', 60); out.transferWhy = since(n0).map(l => l.r);
  out.transfer = { base: P.base, total: tot(), log: S.LOG.slice(-3).map(l => l.t).filter(t => /increased|decreased/.test(t)) };
  const plate = SF.EQ.make('plate_chest', { origin: 'npc' }); const need = SF.EQ.strReq(plate); reset({ str: need, dex: 100, int: 225 - 100 - need }); P.statState.locks.str = 'lower'; P.statState.locks.dex = 'hold';
  P.pack.items.push(plate); const eqr = SF.EQ.equipItem(P, { uid: plate.uid }); n0 = L(); S.gain('spellcraft', 60);
  out.strPolicy = { equipped: eqr.ok, str: P.base.str, need, worn: P.equip.chest === plate, inPack: P.pack.items.includes(plate), msg: S.LOG.slice(-4).some(l => /no longer strong enough/.test(l.t)) };
  // a buff during a gain: the natural point is kept, the boon is not
  reset({ str: 40, dex: 20, int: 30 }); P.mg = P.mg || {}; P.mg.mods = {}; SF.MAGERY.applyStatMod(P.mg.mods, 'str', 10, S.GT + 5); S.recomputeStats(); const effB = P.str; S.gain('mining', 60);
  const afterGain = [P.base.str, P.str]; step(6); out.buff = { effB, afterGain, expired: [P.base.str, P.str] };
  // a ghost does not train
  S.damagePlayer(9999, null, 'phys'); n0 = L(); const bb = JSON.stringify(P.base); S.gain('mining', 60); out.ghost = { ghost: !!P.ghost, rolls: L() - n0, base: JSON.stringify(P.base) === bb, hp: P.hp };
  return out;
})()
