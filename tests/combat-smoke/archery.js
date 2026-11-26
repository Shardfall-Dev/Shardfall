(async () => {
  S.MON.boar.dmg = [0, 0]; S.MON.boar.aggro = 0; S.MON.boar.speed = 0;   // a target that stays where it is put
  equip('shortbow'); give('arrow', 10); const arrows = () => SF.count(P.pack, 'arrow');
  const m = add('boar', 6, 0, 100000); const at6 = () => { m.x = P.x + 6; m.y = P.y; m.home = { x: m.x, y: m.y }; };
  P.sel = m; P.movedAt = -99; P.sw.ready = true;
  // a stationary archer releases at once from the Attack button; one arrow; damage lands one second later
  S.setRng(() => .01); S.ACT.atk(); S.update(.05);
  out.release = { arrows: arrows(), inFlight: S.EFX.filter(f => f.k === 'proj').length, hpBefore: m.hp === 100000 };
  step(.9); out.release.hpAt09 = m.hp === 100000; step(.2); out.release.hpAt11 = m.hp < 100000;
  // pursuit: the reload runs while moving (target kept in range), but no shot until the archer stands still for the aim time
  const a0 = arrows(); let moved = 0; for (let i = 0; i < 90; i++) { if (i % 10 === 0) { key(i % 20 ? 'a' : 'd', false); key(i % 20 ? 'd' : 'a', true); } const x0 = P.x, y0 = P.y; S.update(.05); moved += Math.hypot(P.x - x0, P.y - y0); at6(); } key('a', false);   // pace back and forth
  out.pursuit = { moved: moved > 10, readyWhileMoving: P.sw.ready, arrowsWhileMoving: arrows() === a0 }; key('d', false);
  let tShot = null; for (let i = 0; i < 40 && tShot === null; i++) { S.update(.05); if (arrows() < a0) tShot = S.GT; }
  out.pursuit.aimDelay = Math.round((tShot - P.movedAt) * 100) / 100; out.pursuit.oneArrow = arrows() === a0 - 1;
  P.armed = false; step(1.2);
  // moving while the arrow is in the air spoils it: no damage, exactly one arrow
  at6(); P.sw.ready = true; P.movedAt = -99; const a1 = arrows(), h1 = m.hp; S.FX.length = 0; S.swingAt(P, m); key('d', true); step(.3); key('d', false); step(1);
  out.moveInFlight = { arrows: a1 - arrows(), noDamage: !S.FX.some(f => /^\d+$/.test(f.t)), wide: S.FX.some(f => f.t === 'wide') };
  // repeated taps cannot spend extra ammunition
  at6(); P.sw.ready = true; P.movedAt = -99; const a2 = arrows(); for (let i = 0; i < 6; i++) { S.ACT.atk(); S.swingAt(P, m); } S.update(.05); for (let i = 0; i < 6; i++) S.swingAt(P, m);
  out.repeatTaps = a2 - arrows(); P.armed = false; step(1.2);
  // line of sight blocked at release: nothing spent, the swing stays ready
  at6(); const mid = { x: Math.floor(P.x + 3), y: Math.floor(P.y) }; const t0 = S.tAt(mid.x, mid.y);
  P.sw.ready = true; P.movedAt = -99; S.tSet(mid.x, mid.y, S.T.WL); const a3 = arrows(); out.losRelease = { fired: S.swingAt(P, m), arrows: a3 - arrows(), ready: P.sw.ready }; S.tSet(mid.x, mid.y, t0);
  // out of range at release: nothing spent
  m.x = P.x + 11; out.rangeRelease = { fired: S.swingAt(P, m), arrows: a3 - arrows() }; at6();
  // a shot blocked after release (a wall rises in flight) vs a plain miss
  S.FX.length = 0; P.sw.ready = true; const h2 = m.hp; S.setRng(() => .01); S.swingAt(P, m); S.tSet(mid.x, mid.y, S.T.WL); step(1.1); S.tSet(mid.x, mid.y, t0);
  out.blocked = { label: S.FX.some(f => f.t === 'blocked'), noDamage: !S.FX.some(f => /^\d+$/.test(f.t)) };   // damage numbers are the only all-digit floaters
  S.FX.length = 0; P.sw.ready = true; S.setRng(() => .999); S.swingAt(P, m); step(1.1); out.miss = { label: S.FX.some(f => f.t === 'miss'), blocked: S.FX.some(f => f.t === 'blocked') };
  // the target dies before impact: nothing lands, the arrow is spent once
  S.setRng(() => .01); P.sw.ready = true; const a4 = arrows(); S.swingAt(P, m); m.hp = 1; S.killMon(m, P); step(1.1);
  out.deadBefore = { arrows: a4 - arrows(), log: S.LOG.slice(-1)[0].t };
  // depleted ammunition: warned, nothing spent, swing stays ready
  const m2 = add('boar', 6, 0, 100000); P.sel = m2; SF.removeQty(P.pack, 'arrow', arrows()); P.sw.ready = true; P.armed = false; S.ACT.atk(); step(.3);
  out.empty = { ready: P.sw.ready, warned: S.LOG.some(l => l.t === 'You have no arrows.') }; P.armed = false;
  // crossbows take bolts only; the heavy crossbow reloads in 7.5 s at stamina 100
  equip('crossbow'); give('arrow', 5); P.sw.ready = true; out.xbowArrows = S.swingAt(P, m2); give('bolt', 3); out.xbowBolt = [S.swingAt(P, m2), SF.count(P.pack, 'bolt'), SF.count(P.pack, 'arrow')];
  equip('heavycrossbow'); give('bolt', 3); P.sw.ready = true; P.movedAt = -99; P.stam = 100; S.swingAt(P, m2); const ts = S.GT; let tn = null; for (let i = 0; i < 300 && tn === null; i++) { S.update(.05); P.stam = 100; if (S.swingAt(P, m2)) tn = S.GT; }
  out.hxbowInterval = Math.round((tn - ts) * 100) / 100;
  S.setRng(null); return out;
})()
