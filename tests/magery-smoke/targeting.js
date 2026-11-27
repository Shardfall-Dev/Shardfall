(async () => {
  const S = window.__SF, P = S.P, SF = S.SF, MG = SF.MAGERY; const out = {};
  const step = (sec) => { for (let i = 0; i < Math.round(sec / .05); i++) S.update(.05); };
  for (let k = 0; k < 400; k++) { const x = 120 + (k % 20) * 3, y = 270 + Math.floor(k / 20) * 3; let ok = true; for (let dx = -6; dx <= 6; dx++) for (let dy = -6; dy <= 6; dy++) if (S.BLK[S.tAt(x + dx, y + dy)] || S.tAt(x + dx, y + dy) === S.T.WA) ok = false; if (ok && !S.protAt(x, y)) { P.x = x + .5; P.y = y + .5; break; } }
  for (const e of S.ents.slice()) if (e.kind === 'mon') S.ents.splice(S.ents.indexOf(e), 1);
  S.MON.boar.dmg = [0, 0]; S.MON.boar.aggro = 0; S.MON.boar.speed = 0;
  const d = S.MON.boar; const b = { kind: 'mon', type: 'boar', name: d.n, x: P.x + 3, y: P.y + 1, hp: 300, max: 300, state: 'idle', home: { x: P.x + 3, y: P.y + 1 }, sect: 0, ward: 0, id: 95000, speed: 0 }; S.ents.push(b);
  S.update(.05); S.render();
  const scr = (x, y, h) => { const SX = (x - y) * 32, SY = (x + y) * 16 - h * .5; return [(SX - S.CAM.x) / S.CAM.f, (SY - S.CAM.y) / S.CAM.f]; };
  S.setRng(() => .5); S.castSlot('magery.05'); step(.6);
  // mistaken tap on empty ground keeps the hold
  const [gx, gy] = scr(P.x - 3, P.y + 2, 0); S.tapWorld(gx, gy); out.keptAfterMiss = !!P.held; out.missMsg = S.LOG.slice(-1)[0].t;
  const [mx, my] = scr(b.x, b.y, d.h); S.tapWorld(mx, my); out.releasedOnTap = !P.held; step(1.1); out.boarHp = b.hp;
  // scroll: learn none; read a scroll, interrupt, check ledger, retry
  step(.5); SF.addItem(P.pack, SF.newItem('scroll.12', 1)); const m0 = P.mana; S.castSlot('magery.12', { scroll: true }); const during = { scroll: SF.count(P.pack, 'scroll.12'), mana: P.mana };
  S.damagePlayer(1, null, 'phys'); out.scrollInterrupt = { during, after: { scroll: SF.count(P.pack, 'scroll.12'), manaLost: Math.round((m0 - P.mana) * 100) / 100 } };
  step(.5); P.skills.magery.v = 400; S.castSlot('magery.12', { scroll: true }); step(.8); out.scrollHeld = P.held && P.held.sp.id; out.scrollLeft = SF.count(P.pack, 'scroll.12');
  out.unknownCast = (S.castSlot('magery.30'), S.LOG.slice(-1)[0].t);
  return out;
})()
