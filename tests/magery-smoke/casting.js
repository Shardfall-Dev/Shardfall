(async () => {
  const S = window.__SF, P = S.P, SF = S.SF, MG = SF.MAGERY; const out = {};
  const step = (sec) => { for (let i = 0; i < Math.round(sec / .05); i++) S.update(.05); };
  out.start = { sc: P.skills.spellcraft.v, book: [...MG.bookSpells(P.pack)], hot: P.hotbar.slice(0, 4).map(h => h && h.id), regs: SF.count(P.pack, 'black_pearl'), mana: P.mana, int: P.int };
  // spawn a dummy creature near the player
  const m = S.ents.find(e => e.kind === 'mon') ;
  const add = (type, dx, dy) => { const d = S.MON[type]; const e = { kind: 'mon', type, name: d.n, x: P.x + dx, y: P.y + dy, hp: d.hp, max: d.hp, state: 'idle', home: { x: P.x + dx, y: P.y + dy }, sect: 0, ward: 0, id: 90000 + Math.floor(Math.random() * 1000), speed: 0 }; S.ents.push(e); return e; };
  P.x = 140; P.y = 300; // open ground? find a standable spot
  for (let k = 0; k < 200; k++) { const x = 120 + (k % 20) * 2, y = 280 + Math.floor(k / 20) * 2; if (!S.BLK[S.tAt(Math.floor(x), Math.floor(y))] && !S.protAt(x, y)) { P.x = x + .5; P.y = y + .5; break; } }
  const rat = add('boar', 3, 0); rat.hp = rat.max = 500;
  S.setRng(() => .5); S.MON.boar.dmg = [0, 0]; S.MON.boar.aggro = 0;
  // cast Arcane Arrow: tap slot → prep → hold → release on target
  S.castSlot('magery.05'); out.prep = !!P.prep; out.manaAfterReserve = P.mana; out.pearlsAfterReserve = SF.count(P.pack, 'black_pearl');
  step(.6); out.held = P.held && P.held.sp.id;
  const ok = S.releaseHeld(rat); out.release = ok; const hp0 = rat.hp; step(1.1); out.arrowDamage = hp0 - rat.hp;
  // interruption refunds reagents, half mana
  step(.5); const mana0 = P.mana, pearls0 = SF.count(P.pack, 'black_pearl'); S.castSlot('magery.05'); S.damagePlayer(1, null, 'phys'); out.interrupt = { manaLost: Math.round((mana0 - P.mana) * 100) / 100, pearlsBack: SF.count(P.pack, 'black_pearl') === pearls0, prep: !!P.prep };
  // learn Cinderball via scroll & cast; check hold expiry
  SF.addItem(P.pack, SF.newItem('scroll.18', 2)); const r = MG.learn(P.pack, 'scroll.18'); out.learn = r.ok;
  P.skills.spellcraft.v = 1000; P.skills.focus.v = 1000; P.base.int = 100; S.recomputeStats(); P.mana = 100;
  step(.5); S.castSlot('magery.18'); step(1.05); out.held2 = P.held && P.held.sp.id; step(3.1); out.expired = !P.held;
  // Delayed Explosion + Aether Bolt timing
  SF.addItem(P.pack, SF.newItem('scroll.43', 1)); SF.addItem(P.pack, SF.newItem('scroll.42', 1)); MG.learn(P.pack, 'scroll.43'); MG.learn(P.pack, 'scroll.42');
  step(.5); P.mana = 100; const hits = []; const dm = S.ents.indexOf(rat); const origHp = rat.hp;
  S.castSlot('magery.43'); step(1.8); const t0 = S.GT; const mana1 = P.mana; S.releaseHeld(rat);
  const watch = () => { let last = rat.hp; return (t) => { if (rat.hp !== last) { hits.push(Math.round((S.GT - t0) * 100) / 100); last = rat.hp; } }; }; const w = watch();
  for (let i = 0; i < 7; i++) { S.update(.05); w(); }
  S.castSlot('magery.42'); for (let i = 0; i < 60; i++) { S.update(.05); w(); if (P.held && Math.abs(S.GT - t0 - 2.10) < .026) { S.releaseHeld(rat); } }
  out.burst = { hits, manaSpent: 100 - P.mana > 0 ? Math.round(mana1 + 20 - P.mana) : null };
  // walls
  SF.addItem(P.pack, SF.newItem('scroll.24', 1)); MG.learn(P.pack, 'scroll.24'); step(.5); S.castSlot('magery.24'); step(1.05); const ok2 = S.releaseHeld({ x: P.x + 4, y: P.y }); step(.1);
  out.wall = { ok: ok2, why: S.LOG.slice(-3).map(l=>l.t), tile: S.tAt(Math.floor(P.x+4), Math.floor(P.y)), blocked: !window.__SF.update ? 0 : 0 };
  // stats
  SF.addItem(P.pack, SF.newItem('scroll.16', 1)); MG.learn(P.pack, 'scroll.16'); step(.5); const s0 = P.str; S.castSlot('magery.16'); step(.8); S.releaseHeld(P); step(.1); out.str = [s0, P.str, P.base.str];
  // book panel renders
  S.openPanel('spells'); out.panel = document.querySelector('#panel').innerText.slice(0, 200); out.slotIcon = getComputedStyle(document.querySelectorAll('.slot')[1]).backgroundImage.slice(0, 40);
  out.log = S.LOG.slice(-14).map(l => l.t);
  return out;
})()
