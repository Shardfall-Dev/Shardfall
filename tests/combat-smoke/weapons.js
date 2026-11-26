(async () => {
  // every family from the real entry points: the bag's Equip action and the Attack button, against a sturdy boar
  S.MON.boar.dmg = [0, 0]; S.MON.boar.aggro = 0; S.MON.boar.speed = 0; S.MON.boar.ar = 0; delete S.MON.boar._t2a;   // an unarmored dummy so every family shows damage
  const res = {};
  for (const id of ['sword', 'battleaxe', 'mace', 'dagger', 'fists', 'shortbow', 'crossbow']) {
    equip(id); if (id === 'shortbow') give('arrow', 20); if (id === 'crossbow') give('bolt', 20);
    const ranged = id === 'shortbow' || id === 'crossbow'; const m = add('boar', ranged ? 6 : 1, 0, 100000); m.stam = 60;
    P.sel = m; P.armed = false; P.sw.ready = true; P.movedAt = -99; P.stam = 100; P.skills[S.W.skill].v = 1000; S.setRng(() => .3);
    document.querySelector('#b-atk').click();                                          // the HUD Attack button
    const swings = [], hp0 = m.hp, gains = P.skills[S.W.skill].v; let last = P.sw.t, stam0 = m.stam, minStam = m.stam;
    for (let i = 0; i < 400 && swings.length < 3; i++) { S.update(.05); P.stam = 100; minStam = Math.min(minStam, m.stam); if (P.sw.t !== last) { swings.push(S.GT); last = P.sw.t; } }
    step(1.2); S.refreshHud();
    const w = S.W; res[id] = { skill: w.skill, label: document.querySelector('#b-atk small').textContent.split(' · ')[0], swings: swings.length, interval: Math.round((swings[2] - swings[1]) * 100) / 100, expect: SF.swingDelay(100, w.speed),
      damaged: m.hp < hp0, ammoLeft: w.ammo ? SF.count(P.pack, w.ammo) : null, maceDrain: w.mace ? stam0 - minStam >= 3 : null };
    S.setRng(null); P.armed = false; m.gone = true; S.ents.splice(S.ents.indexOf(m), 1); step(.2);
  }
  out.weapons = res;
  out.intervalsMatch = Object.values(res).every(r => near(r.interval, r.expect));
  out.skills = Object.fromEntries(Object.entries(res).map(([k, r]) => [k, r.skill]));
  out.allDamaged = Object.values(res).every(r => r.swings === 3 && r.damaged);
  out.ammo = [res.shortbow.ammoLeft, res.crossbow.ammoLeft];
  // hit chance in play: the player against Wren (a local player fixture), seeded, 3000 swings per case
  const vs = (atk, def, ana) => { P.skills.swordsmanship.v = atk * 10; wren.skills.swordsmanship.v = def * 10; P.skills.anatomy.v = ana * 10; wren.ghost = false; wren.hp = wren.max = 1e9; wren.x = P.x + 1; wren.y = P.y; wren.order = 'wait'; wren.home = { x: wren.x, y: wren.y };
    S.setRng(lcg(atk * 7 + def * 13 + ana)); let hits = 0, dmg = 0, legal = 0; const n = 3000; S.FX.length = 0;
    for (let i = 0; i < n; i++) { P.sw.ready = true; P.equip.weapon.cond = 100;   // keep the sword from wearing out over 3000 blows
      const h0 = wren.hp; const fx = S.FX.length; const ok = S.swingAt(P, wren); const f = S.FX.slice(fx); if (ok) { legal++; if (!f.some(x => x.t === 'miss')) hits++; } dmg += h0 - wren.hp; S.FX.length = 0; }
    S.setRng(null); return { legal, rate: Math.round(hits / legal * 1000) / 1000, avg: Math.round(dmg / Math.max(1, hits) * 10) / 10 }; };
  for (const k of ['swordsmanship', 'anatomy', 'tactics']) P.skills[k].lock = 'hold'; P.skills.tactics.v = 1000;
  equip('sword'); wren.equip.armor = null; wren.equip.shield = null;
  out.pvp = { equal: vs(100, 100, 0), high: vs(100, 50, 0), low: vs(50, 100, 0), equalAna100: vs(100, 100, 100) };
  out.pvpOk = out.pvp.equal.legal === 3000 && out.pvp.low.legal === 3000 && near(out.pvp.equal.rate, .5, .03) && near(out.pvp.high.rate, .75, .03) && near(out.pvp.low.rate, 1 / 3, .03) && near(out.pvp.equalAna100.rate, .5, .03) && out.pvp.equalAna100.avg > out.pvp.equal.avg;
  return out;
})()
