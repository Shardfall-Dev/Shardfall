(async () => {
  const S = window.__SF, P = S.P, SF = S.SF, MG = SF.MAGERY; const out = {};
  const step = (sec) => { for (let i = 0; i < Math.round(sec / .05); i++) S.update(.05); };
  for (let k = 0; k < 400; k++) { const x = 120 + (k % 20) * 3, y = 270 + Math.floor(k / 20) * 3; let ok = true; for (let dx = -6; dx <= 6; dx++) for (let dy = -6; dy <= 6; dy++) if (S.BLK[S.tAt(x + dx, y + dy)] || S.tAt(x + dx, y + dy) === S.T.WA) ok = false; if (ok && !S.protAt(x, y)) { P.x = x + .5; P.y = y + .5; break; } }
  out.pos = [P.x, P.y];
  S.MON.boar.dmg = [0, 0]; S.MON.boar.aggro = 0; S.MON.hound.dmg = [10, 10];
  let nid = 91000; const add = (type, dx, dy, hp) => { const d = S.MON[type]; const e = { kind: 'mon', type, name: d.n, x: P.x + dx, y: P.y + dy, hp: hp || d.hp, max: hp || d.hp, state: 'idle', home: { x: P.x + dx, y: P.y + dy }, sect: 0, ward: 0, id: nid++, speed: 0 }; S.ents.push(e); return e; };
  for (const e of S.ents.slice()) if (e.kind === 'mon') e.gone = true, S.ents.splice(S.ents.indexOf(e), 1);
  P.skills.magery.v = 1000; P.skills.evaluatingintelligence.v = 1000; P.skills.resistingspells.v = 1000; P.base.int = 100;
  const book = P.pack.items.find(i => i.id === 'spellbook'); book.spells = MG.SPELLS.map(s => s.id);
  for (const r of Object.keys(MG.REAGENTS)) SF.addItem(P.pack, SF.newItem(r, 30));
  const cast = (id, t, extra) => { P.mana = 200; P.spellReadyAt = 0; P.held = null; S.castSlot(id); const sp = MG.SPELL[id]; step(sp.prep + .1); if (!P.held) return 'self-released'; return S.releaseHeld(t, extra); };
  S.setRng(() => .5); step(.2);
  // Mindburst 100 vs 76
  const b1 = add('boar', 3, 0, 300); P.base.int = 100; step(.1);
  const intOf = 20 + Math.round(40 * .6); out.boarInt = intOf;
  let h0 = b1.hp; cast('magery.37', b1); step(1.1); out.mind = h0 - b1.hp;
  // Earthshaker
  const b2 = add('boar', 2, 2, 91); h0 = P.hp; cast('magery.57', P); step(1.1); out.quake = { b2: b2.hp, b1: b1.hp, self: P.hp === h0 };
  b1.hp = 300; b2.gone = true; S.ents.splice(S.ents.indexOf(b2), 1);
  // Meteor shower split among three
  const v = [add('boar', 5, 0, 200), add('boar', 5, 1, 200), add('boar', 5, -1, 200)]; v.forEach(e => e.hp = 200);
  cast('magery.55', { x: P.x + 5, y: P.y }); step(1.2); out.meteor = v.map(e => 200 - e.hp);
  for (const e of v) { e.gone = true; S.ents.splice(S.ents.indexOf(e), 1); }
  // Mirror ward + reactive armor
  cast('magery.36', P); out.mirror = !!(P.mg && P.mg.mirror);
  cast('magery.07', P); out.reactive = P.mg.reactive && P.mg.reactive.pool; out.mirrorAfterReactive = P.mg.mirror;
  const hd = add('hound', 1, 0, 100); hd.target = P; hd.state = 'chase'; S.setRng(() => .01); P.equip.shield = null; const hp1 = P.hp, hh = hd.hp;
  for (let i = 0; i < 40 && P.mg.reactive && P.mg.reactive.pool === 25; i++) S.update(.05);
  out.reactiveAfter = { pool: P.mg.reactive && P.mg.reactive.pool, houndLost: hh - hd.hp, playerLost: hp1 - P.hp };
  hd.gone = true; S.ents.splice(S.ents.indexOf(hd), 1); S.setRng(() => .5);
  // fire field: walk across adjacent tiles within a second → one pulse
  const fx = Math.floor(P.x) + 4; cast('magery.28', { x: fx + .5, y: P.y }); out.fields = S.ents.length;
  const fb = add('boar', 4, -3, 300); fb.hp = 300; fb.update = 0; S.MON.boar.speed = 0; step(.05); const fh0 = fb.hp;
  // move boar along the wall (x fixed, y varies)
  const segs = []; for (let y = Math.floor(P.y) - 1; y <= Math.floor(P.y) + 2; y++) segs.push(y);
  fb.x = fx + .5; fb.y = segs[0] + .5; step(.05); fb.y = segs[1] + .5; step(.05); fb.y = segs[2] + .5; step(.05); fb.y = segs[3] + .5; step(.3);
  out.firePulsesWithinSecond = fh0 - fb.hp; step(1.0); out.fireAfter2 = fh0 - fb.hp;
  fb.gone = true; S.ents.splice(S.ents.indexOf(fb), 1);
  // stone wall at a bridge: five-segment Wall of Aether; dispel the middle one
  step(15); P.held = null;
  const wx = Math.floor(P.x) + 3; cast('magery.50', { x: wx + .5, y: P.y }); const midBlocked = !S.moveBy({ kind: 'mon', x: wx - .5, y: Math.floor(P.y) + .5 }, 1, 0);
  cast('magery.34', { x: wx + .5, y: Math.floor(P.y) + .5 }); const probe = { kind: 'mon', x: wx - .5, y: Math.floor(P.y) + .5 }; const moved = S.moveBy(probe, 1, 0);
  out.dispel = { midBlocked, passAfterDispel: moved > 0 };
  // bind & immunity
  const bb = add('boar', 3, 0, 300); bb.hp = 300; cast('magery.38', bb); out.bound = bb.rooted > S.GT; const dur = bb.rooted - S.GT; step(dur + .1); out.bindDur = Math.round(dur * 100) / 100; out.immune = bb.mg && bb.mg.ctlImmune > S.GT; cast('magery.38', bb); out.rebindWhileImmune = bb.rooted > S.GT;
  bb.gone = true; S.ents.splice(S.ents.indexOf(bb), 1);
  // summon + banish + slots
  step(1); const before = S.ents.filter(e => e.kind === 'pet').length; cast('magery.62', { x: P.x + 1.5, y: P.y }); const el = S.ents.find(e => e.summon); out.summon = el && { name: el.name, hp: el.hp, life: Math.round(el.until - S.GT) };
  cast('magery.41', el); out.banished = el.gone; S.setRng(() => .5);
  cast('magery.40', { x: P.x + 1.5, y: P.y }); const cr = S.ents.find(e => e.summon && !e.gone); cr.until = S.GT + .05; step(.2); out.creatureExpired = cr.gone;
  // runes: mark here, walk away, recall, gate
  const rune = P.pack.items.find(i => i.id === 'rune'); const home = { x: P.x, y: P.y };
  P.spellReadyAt = 0; S.castSlot('magery.45'); step(1.9); S.ACT.mrune({ u: rune.uid }); out.mark = rune.mark;
  P.x += 6; P.spellReadyAt = 0; S.castSlot('magery.32'); P.mana = 200; step(1.4); S.ACT.mrune({ u: rune.uid }); out.recall = Math.hypot(P.x - home.x, P.y - home.y) < .01;
  // overweight rejection
  P.x += 6; P.spellReadyAt = 0; const heavy = SF.newItem('ironbar', 400); P.pack.items.push(heavy); S.castSlot('magery.32'); step(1.4); S.ACT.mrune({ u: rune.uid }); out.overweightRejected = !!P.held; P.pack.items.splice(P.pack.items.indexOf(heavy), 1); S.ACT.cancel();
  step(.5); P.mana = 200; P.spellReadyAt = 0; S.castSlot('magery.52'); step(2.1); S.ACT.mrune({ u: rune.uid }); out.gate = S.LOG.slice(-1)[0].t; const G = P.x; P.x -= .0; step(.2); out.gatePanel = S.PANEL; if (S.PANEL === 'mgate') { S.ACT.mgate(); } out.afterGate = Math.hypot(P.x - home.x, P.y - home.y).toFixed(2);
  // invisibility
  step(.5); cast('magery.44', P); out.invis = P.hidden; P.x += .2; step(.1); out.invisAfterMove = P.hidden;
  // night sight & polymorph & incognito
  cast('magery.06', P); out.night = P.mg.night > S.GT;
  P.spellReadyAt = 0; P.mana = 200; S.castSlot('magery.56'); step(2.1); out.formPanel = S.PANEL; S.ACT.mform({ f: 'boar' }); out.form = P.mg.form && P.mg.form.type;
  // Open Seal on a chest; rune trap remote activation
  const chest = [...S.CHESTS.values()][0]; out.chest = chest && { tier: chest.tier, open: chest.open };
  if (chest) { P.x = chest.x + .5 + 7; P.y = chest.y + .5; let ok = false; for (let d = 2; d < 9 && !ok; d++) for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) { const x = chest.x + .5 + dx, y = chest.y + .5 + dy; if (!S.BLK[S.tAt(Math.floor(x), Math.floor(y))]) { P.x = x; P.y = y; ok = true; break; } }
    out.chestDist = Math.hypot(P.x - chest.x - .5, P.y - chest.y - .5);
    out.trap = cast('magery.13', { x: chest.x + .5, y: chest.y + .5 }); out.armed = !!chest.rtrap;
    const hpT = P.hp; out.farhand = cast('magery.21', { x: chest.x + .5, y: chest.y + .5 }); out.remoteSpent = !chest.rtrap && P.hp === hpT;
    out.unlock = cast('magery.23', { x: chest.x + .5, y: chest.y + .5 }); out.opened = chest.open; }
  // Hotbar binding round-trip through save/load
  P.hotbar[4] = { k: 'spell', id: 'magery.42' }; S.save(); const saved = JSON.parse(localStorage.getItem('shardfall.save.v1')); out.savedHot = saved.char.hotbar[4]; out.savedInt = saved.char.int; out.savedMig = saved.char.magery;
  out.log = S.LOG.slice(-30).map(l => l.t);
  return out;
})()
