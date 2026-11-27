(async () => {
  const band = () => SF.count(P.pack, 'bandage'); give('bandage', 20);
  const setSk = (h, a) => { P.skills.healing.v = h * 10; P.skills.anatomy.v = a * 10; P.skills.healing.lock = P.skills.anatomy.lock = 'hold'; };
  const place = () => { wren.ghost = false; wren.x = P.x + 1; wren.y = P.y; wren.order = 'wait'; wren.home = { x: wren.x, y: wren.y }; wren.poison = null; };
  const lastLog = () => S.LOG.slice(-1)[0].t;
  setSk(100, 100); S.setRng(() => 0);
  // full HP: refused before a bandage is spent
  P.hp = SF.maxHp(P); const b0 = band(); S.useSlot(0); out.fullHp = { spent: b0 - band(), log: lastLog() };
  // self, undisturbed, from the hotbar: 15 s, GM roll 43 at the lowest draw
  P.hp = 10; S.useSlot(0); const b = P.bandage; out.self = { spent: b0 - band(), dur: b.t1 - b.t0, kind: b.kind };
  step(14.9); out.self.doneEarly = !P.bandage; let h = P.hp; step(.2); out.self.healed = Math.round(P.hp - h); out.self.log = lastLog();
  // slips: two blows during a self bandage take 4 HP each off the roll
  P.hp = 10; S.useSlot(0); step(3); S.damagePlayer(1, null, 'phys'); step(1); S.damagePlayer(1, null, 'phys'); step(10.9); h = P.hp; step(.2); out.slips = { healed: Math.round(P.hp - h), log: lastLog() };
  // timer stays up while fighting and moving, and completes
  P.hp = 10; const px0 = P.x, py0 = P.y; S.useSlot(0); key('d', true); step(2); key('d', false); out.movedWhileBandaging = Math.hypot(P.x - px0, P.y - py0) > 3;
  const mon = add('rat', 1.2, 0, 999); S.MON.rat.dmg = [0, 0]; P.sel = mon; S.ACT.atk(); step(4); out.whileActive = { stillBandaging: !!P.bandage, swung: P.sw.t > 0 }; P.armed = false; mon.gone = true; S.ents.splice(S.ents.indexOf(mon), 1); step(10); out.whileActive.done = !P.bandage && P.hp > 10;
  // another patient: tap Wren, press the target frame's Bandage button: 5 s; the patient stays Wren even if you select something else
  place(); wren.hp = 20; P.sel = wren; S.update(.05); S.refreshHud(); const btn = document.querySelector('#tgt [data-a=bandother]'); out.other = { button: btn && btn.textContent }; btn.click();
  const ob = P.bandage; out.other.dur = ob && ob.t1 - ob.t0; P.sel = P; step(4.9); h = wren.hp; step(.2); out.other.healed = Math.round(wren.hp - h); out.other.log = lastLog();
  // out of reach at completion: wasted, nothing healed
  place(); wren.hp = 20; P.sel = wren; S.firstAidOther(); step(2); wren.x = P.x + 5; wren.home = { x: wren.x, y: wren.y }; step(3.2); out.outOfReach = { healed: wren.hp - 20 > .6, log: lastLog() };
  // state change mid-treatment: poisoned while being bandaged for wounds → no heal paid
  place(); wren.hp = 20; P.sel = wren; S.firstAidOther(); step(2); wren.poison = { tier: 1, ticks: 99, next: S.GT + 99 }; step(3.2); out.changed = { healed: wren.hp >= 20 && wren.hp < 21, log: lastLog() };
  // poison: 6 s on another; at 60/60 the 80% line; one skill at 59.9 cannot cure
  place(); wren.hp = 30; wren.poison = { tier: 1, ticks: 99, next: S.GT + 99 }; setSk(60, 59.9); S.firstAidOther(); out.cure = { dur: P.bandage.t1 - P.bandage.t0 }; step(6.1); out.cure.low = { cured: !wren.poison, log: lastLog() };
  setSk(60, 60); S.setRng(() => .79); S.firstAidOther(); step(6.1); out.cure.at60 = { cured: !wren.poison, hpSame: Math.round(wren.hp) === 30, log: lastLog() };
  wren.poison = { tier: 1, ticks: 99, next: S.GT + 99 }; S.setRng(() => .81); S.firstAidOther(); step(6.1); out.cure.fail60 = !wren.poison ? 'cured' : lastLog();
  wren.poison = null;
  // self poison takes 18 s
  S.setRng(() => .5); P.poison = { tier: 1, ticks: 99, next: S.GT + 99 }; P.hp = SF.maxHp(P); S.useSlot(0); out.cure.selfDur = P.bandage.t1 - P.bandage.t0; step(18.1); out.cure.selfCured = !P.poison; P.poison = null;
  // ghost: Wren falls; at 79.9/100 the attempt fails; at 80/80 under 25% she returns at 25% HP and takes her gear back
  place(); wren.hp = 5; S.damageAlly(wren, 50, null, 'phys'); out.ghost = { ghost: wren.ghost, body: S.ents.some(e => e.allyBody === 'wren'), armorOnBody: (S.ents.find(e => e.allyBody === 'wren') || { cont: { items: [] } }).cont.items.some(i => i.id === 'leather_tunic') };
  P.sel = wren; S.update(.05); S.refreshHud(); out.ghost.button = (document.querySelector('#tgt [data-a=bandother]') || {}).textContent;
  setSk(79.9, 100); S.setRng(() => 0); S.firstAidOther(); out.ghost.dur = P.bandage.t1 - P.bandage.t0; step(10.1); out.ghost.low = { still: wren.ghost, log: lastLog() };
  setSk(80, 80); S.setRng(() => .3); S.firstAidOther(); step(10.1); out.ghost.fail80 = wren.ghost;
  S.setRng(() => .2); S.firstAidOther(); step(10.1); out.ghost.res = { alive: !wren.ghost, hp: Math.round(wren.hp), max: wren.max, armor: wren.equip.chest && wren.equip.chest.id, weapon: wren.equip.weapon && wren.equip.weapon.id, bodyGone: !S.ents.some(e => e.allyBody === 'wren' && !e.gone) };
  // self-resurrection is impossible: a ghost player cannot bandage
  // pets go through Veterinary
  out.bandagesLeft = band();
  S.setRng(null); return out;
})()
