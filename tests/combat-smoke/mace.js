(async () => {
  // mace against Wren in leather (AR 13): a hit drains 3–5 stamina and wears the armor by half what it absorbed; a miss does neither
  wren.x = P.x + 1; wren.y = P.y; wren.hp = wren.max = 1e6; wren.order = 'wait'; wren.home = { x: wren.x, y: wren.y }; wren.equip.shield = null; wren.stam = 55;
  const arm = wren.equip.armor; arm.cond = 100; equip('mace');
  S.setRng(() => .99); P.sw.ready = true; S.swingAt(P, wren); out.miss = { stam: wren.stam, cond: arm.cond };
  S.setRng(() => .01); P.sw.ready = true; S.swingAt(P, wren); out.hit = { stamLost: 55 - wren.stam, cond: arm.cond, blow: null };
  // the same against a creature: stamina drain only (creatures wear no armor pieces)
  S.MON.boar.dmg = [0, 0]; const m = add('boar', -1, 0, 100000); m.stam = 60; P.sw.ready = true; S.swingAt(P, m); out.creatureStamLost = 60 - m.stam;
  // a sword wears armor by the ordinary 0.2 per blow and drains nothing
  wren.stam = 55; arm.cond = 100; equip('sword'); P.sw.ready = true; S.swingAt(P, wren); out.sword = { stamLost: 55 - wren.stam, cond: arm.cond };
  // a creature blow against the player: absorbed by armor, then halved
  P.equip.armor = SF.newItem('plate', 1, { cond: 100, maxc: 100 }); P.equip.shield = null; S.MON.boar.dmg = [60, 60]; const hp0 = P.hp = SF.maxHp(P); S.setRng(() => .01); S.strikeOne(m, P, null, false);
  out.toPlayer = { lost: hp0 - P.hp, expect: Math.floor((60 - 20) / 2 + .5) };
  S.setRng(null); return out;
})()
