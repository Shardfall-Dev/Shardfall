(async () => {
  S.MON.boar.dmg = [0, 0]; S.MON.boar.aggro = 0; S.MON.boar.speed = 0;   // targets that stay put (an idle boar wanders)
  const m = add('boar', 1, 0, 100000); P.sel = m; P.stam = 100;
  const until = (cond, max) => { for (let i = 0; i < (max || 200); i++) { if (cond()) return S.GT; S.update(.05); P.stam = 100; } return null; };
  // swap during recovery: sword blow, dagger on 0.5 s later → no swing until the dagger's full 1.25 s from the equip
  equip('sword'); P.sw.ready = true; S.ACT.atk(); S.update(.05); const t0 = P.sw.t; step(.5); equip('dagger'); const tEq = S.GT, rdy = P.sw.ready, t1 = P.sw.t; const tNext = until(() => P.sw.t !== t1);
  out.swapDuring = { readyAfterEquip: rdy, wait: Math.round((tNext - tEq) * 100) / 100 };
  // weapon cycling: glaive blow, unequip (fists timer 1.5 s), re-equip when the fists are ready → the glaive swings at once
  P.armed = false; equip('glaive'); P.sw.ready = true; S.ACT.atk(); S.update(.05); const g0 = P.sw.t; S.ACT.uneq({ s: 'weapon' }); P.armed = false;
  const tReady = until(() => P.sw.ready); const it = P.pack.items.find(i => i.id === 'glaive'); S.ACT.equip({ u: it.uid }); S.ACT.atk(); S.update(.05);
  out.cycle = { fistsReadyAfter: Math.round((tReady - g0) * 100) / 100, glaiveSwungAt: Math.round((P.sw.t - g0) * 100) / 100, plainGlaive: SF.swingDelay(100, 25) };
  // one readiness state through a new target and a held spell
  P.armed = false; step(4); const readyBefore = P.sw.ready; const m2 = add('boar', -1, 0, 100000); P.sel = m2; S.update(.05); const keptOnRetarget = P.sw.ready;
  SF.addItem(P.pack, SF.newItem('black_pearl', 3)); SF.addItem(P.pack, SF.newItem('nightshade', 3)); P.skills.magery.v = 1000; P.mana = 50; const book = P.pack.items.find(i => i.id === 'spellbook'); if (book) book.spells = SF.MAGERY.SPELLS.map(s => s.id);
  S.castSlot('magery.05'); step(.8); const held = !!P.held, keptWhileHeld = P.sw.ready; S.ACT.atk(); S.update(.05); const swungWhileHeld = !P.sw.ready && !!P.held;
  out.readiness = { readyBefore, keptOnRetarget, held, keptWhileHeld, swungWhileHeld };
  // a prepared (not yet held) spell holds the swing
  P.armed = false; step(4); P.mana = 50; P.held = null; P.spellReadyAt = 0; S.castSlot('magery.05'); S.update(.05); S.ACT.atk(); S.update(.05); out.prepBlocks = P.sw.ready && !!P.prep;
  return out;
})()
