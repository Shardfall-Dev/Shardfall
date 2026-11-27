// Each skill's action in the live game (v0.30). Evaluated in the page by tests/skills-smoke/run.py; returns { name: { ok, ... } }.
(() => {
  const S = window.__SF, P = S.P, SF = S.SF, SK = SF.SK, out = {};
  const step = (sec) => { for (let i = 0; i < Math.round(sec / .05); i++) { S.update(.05); for (const e of S.ents.slice()) if (e.kind === 'mon' && !e.test && Math.hypot(e.x - P.x, e.y - P.y) < 30) S.rmEnt(e); } };   // only the scenario's own creatures
  const set = (k, v) => { P.skills[k].v = Math.round(v * 10); };
  const lastLog = n => S.LOG.slice(-(n || 3)).map(l => l.t);
  const clearCd = () => { P.cdA = {}; P.bardReady = 0; };
  const rng0 = () => S.setRng(() => 0), rngOff = () => S.setRng(null);
  const near = (type, dx, dy) => { const m = S.spawnMon(type, dx || 2, dy || 0); m.state = 'idle'; m.target = null; m.test = true; return m; };
  const clear = () => { for (const e of S.ents.slice()) if (e.kind === 'mon' && Math.hypot(e.x - P.x, e.y - P.y) < 40) S.rmEnt(e); };
  const zero = () => { for (const k in P.skills) P.skills[k].v = 0; };       // each scenario starts from nothing, well under the 700 cap
  const run = (name, fn) => { try { clearCd(); clear(); zero(); rngOff(); out[name] = fn(); } catch (e) { out[name] = { ok: false, err: String(e && e.stack || e).slice(0, 300) }; } rngOff(); };
  P.hp = 999; S.SF.addItem(P.pack, SF.newItem('gold', 2000)); P.x = 215.5; P.y = 300.5;   // open ground west of the boar meadows: creatures may walk here (not in town)

  run('hiding: hidden, but a step reveals you', () => {
    set('hiding', 60); P.lastHit = -99; rng0(); S.hide(); step(.8); const hidden = P.hidden, steps = P.stepBudget; S.moveBy(P, .9, 0); S.onPlayerMoved(.9);
    return { ok: hidden && steps === 0 && !P.hidden, hidden, steps, after: P.hidden, log: lastLog(2) }; });
  run('stealth: needs 80 real Hiding, then steps per 10 skill', () => {
    set('hiding', 70); set('stealth', 50); rng0(); S.hide(); step(.8); S.stealthUse(); const refused = /80 real Hiding/.test(lastLog(1)[0]);
    clearCd(); set('hiding', 85); S.reveal(); rng0(); S.hide(); step(.8); S.stealthUse(); const steps = P.stepBudget; const x0 = P.x; for (let i = 0; i < 6; i++) { S.moveBy(P, .5, 0); S.onPlayerMoved(.5); }
    return { ok: refused && steps === 5 && P.hidden, refused, steps, moved: +(P.x - x0).toFixed(2), hidden: P.hidden }; });
  run('detecting hidden: finds a hidden smuggler and a chest trap in range', () => {
    S.reveal(); set('detectinghidden', 80); const m = near('smuggler', 5, 0); m.pacified = S.GT + 99; rng0(); S.useAbility('detect'); for (let i = 0; i < 15; i++) { m.hidden = true; S.update(.05); } m.hidden = true; step(.5);
    return { ok: !m.hidden && /uncover 1 hidden/.test(lastLog(3).join(' ')), hidden: m.hidden, log: lastLog(2) }; });
  run('meditation: blocked in hand, doubles regeneration otherwise', () => {
    const w = P.equip.weapon; P.mana = 2; S.meditate(); const blocked = !P.meditating && /hands/.test(lastLog(1)[0]);
    P.equip.weapon = null; const sh = P.equip.shield; P.equip.shield = null; clearCd(); set('meditation', 60); rng0(); P.mana = Math.round(SF.maxMana(P) * .5); P.lastHit = -99; S.meditate(); const med = !!P.meditating;   // at 60 the trance takes from 30% mana up
    const passive = SK.manaRegen(P.int, S.SF.SK.value(P, 'meditation'), SF.EQ.effective(P).med, false), active = SK.manaRegen(P.int, S.SF.SK.value(P, 'meditation'), SF.EQ.effective(P).med, true);
    P.equip.weapon = w; P.equip.shield = sh; P.meditating = null;
    return { ok: blocked && med && Math.abs(active - 2 * passive) < 1e-9 && active <= 2 && passive >= 1 / 7, blocked, med, passive, active }; });
  run('animal taming: a creature-specific minimum, a window, a loyal pet', () => {
    set('animaltaming', 30); const w = near('dire_wolf', 2, 0); P.sel = w; S.tameStart(w); const noChance = /no chance/.test(lastLog(1)[0]); S.rmEnt(w);
    clearCd(); const h = near('hare', 1.5, 0); P.sel = h; rng0(); S.tameStart(h); step(SF.TAME.time + .3);
    return { ok: noChance && h.kind === 'pet' && h.loyal === 10, noChance, kind: h.kind, loyal: h.loyal, log: lastLog(2) }; });
  run('control: a hard pet ignores a weak master; loyalty fails without food', () => {
    const pets = S.tamedPets(); const h = pets[pets.length - 1]; const ch1 = SK.controlChance(30, 0, 0, 10), ch2 = SK.controlChance(50, 20, 83.1, 10), ch3 = SK.controlChance(100, 100, 83.1, 10);
    h.fedAt = S.GT - SK.LOYALTY.step * 4; S.petLoyaltyTick(); const lo = h.loyal; S.SF.addItem(P.pack, SF.newItem('marshroot', 2)); S.feedPet(h); const fed = h.loyal;
    h.fedAt = S.GT - SK.LOYALTY.step * 11; S.petLoyaltyTick(); const wild = h.kind;
    return { ok: ch1 === 1 && ch2 < .3 && ch3 > .9 && lo === 6 && fed === 10 && wild === 'mon', ch1, ch2, ch3, lo, fed, wild }; });
  run('veterinary: bandages heal a pet with Veterinary and Animal Lore', () => {
    set('animaltaming', 100); const b = near('boar', 1.2, 0); P.sel = b; rng0(); S.tameStart(b); step(SF.TAME.time + .3); set('veterinary', 70); set('animallore', 60);
    b.hp = 10; S.vetStart(b); step(SF.VET.time + .2); return { ok: b.kind === 'pet' && b.hp > 10, kind: b.kind, hp: b.hp, log: lastLog(2) }; });
  run('peacemaking: an area song stops every fight around you', () => {
    set('musicianship', 100); set('peacemaking', 100); if (!SF.count(P.pack, 'lute')) SF.addItem(P.pack, SF.newItem('lute', 1));
    const a = near('hound', 2, 0), b = near('hound', -2, 1); a.target = P; a.state = 'chase'; b.target = P; b.state = 'chase'; rng0(); S.peaceUse();
    return { ok: !a.target && !b.target && a.pacified > S.GT && b.pacified > S.GT, a: [a.state, a.pacified - S.GT], log: lastLog(1) }; });
  run('provocation: two chosen creatures fight each other', () => {
    set('musicianship', 100); set('provocation', 80); const a = near('rat', 2, 0), b = near('boar', 3, 2); P.sel = null; S.provokeStart(); const ask1 = !!S.PICKT; S.pickTap([a]); const ask2 = !!S.PICKT; rng0(); S.pickTap([b]);
    return { ok: ask1 && ask2 && a.target === b && b.target === a, ask1, ask2, a: a.target && a.target.type, b: b.target && b.target.type, log: lastLog(1) }; });
  run('enticement: the creature walks to the bard', () => {
    set('musicianship', 100); set('enticement', 100); const m = near('boar', 6, 0); const d0 = Math.hypot(m.x - P.x, m.y - P.y); rng0(); S.enticeUse(m); rngOff(); for (let i = 0; i < 60; i++) S.update(.05);
    return { ok: !!m.lured && Math.hypot(m.x - P.x, m.y - P.y) < d0 - 1, d0, d1: Math.hypot(m.x - P.x, m.y - P.y), lured: !!m.lured }; });
  run('stealing: an item leaves their pack and never comes back as loot', () => {
    set('stealing', 100); const m = near('smuggler', 1.2, 0); m.state = 'idle'; m.pacified = S.GT + 99; const pack = S.npcPack(m); const n0 = pack.items.reduce((a, i) => a + i.qty, 0); const mine0 = P.pack.items.reduce((a, i) => a + i.qty, 0);
    rng0(); S.stealStart(m, pack.items[0]); step(1.2); const n1 = pack.items.reduce((a, i) => a + i.qty, 0);
    const stolen = n0 - n1; S.killMon(m, P); const body = S.ents.find(e => e.kind === 'corpse' && e.mon === 'smuggler' && Math.hypot(e.x - m.x, e.y - m.y) < .1); const inBody = body ? body.cont.items.reduce((a, i) => a + i.qty, 0) : -1;
    return { ok: stolen > 0 && inBody === n1, stolen, n1, inBody, log: lastLog(2) }; });
  run('poisoning: a blade takes charges by strength; the potion is used', () => {
    set('poisoning', 60); P.equip.weapon = SF.newItem('dagger', 1, { cond: 100 }); S.weaponChanged && S.weaponChanged(); SF.addItem(P.pack, SF.newItem('venom', 1)); const pot = P.pack.items.find(i => i.id === 'venom');
    rng0(); S.poisonApply(pot.uid, 'weapon'); step(2.2); const w = P.equip.weapon;
    return { ok: !!w.venom && w.venom.tier === 2 && w.venom.charges === 16 && !SF.count(P.pack, 'venom'), venom: w.venom, log: lastLog(1) }; });
  run('lockpicking: a tinker\'s lockbox at its maker\'s level', () => {
    set('lockpicking', 40); SF.addItem(P.pack, SF.newItem('lockpick', 5)); const box = SF.newItem('lockbox', 1, { locked: true, lockLvl: 45 }); SF.addItem(P.pack, box); rng0(); S.lockUse(box); step(SF.LOCK_TIME + .2);
    return { ok: !box.locked, locked: box.locked, log: lastLog(1) }; });
  run('remove trap: needs 50/50, then disarms a practice box', () => {
    set('lockpicking', 40); set('detectinghidden', 60); const box = SF.newItem('trapbox', 1, { armed: true, power: 40 }); SF.addItem(P.pack, box); S.untrapUse(box); const refused = /needs 50/.test(lastLog(1)[0]);
    clearCd(); set('lockpicking', 60); set('removetrap', 50); rng0(); S.untrapUse(box); step(2.2);
    return { ok: refused && !box.armed, refused, armed: box.armed, log: lastLog(1) }; });
  run('resisting spells: a creature\'s spell can be resisted and teaches', () => {
    set('resistingspells', 40); const w = near('wisp', 4, 0); const r0 = P.skills.resistingspells.v; const hp0 = P.hp; rng0(); S.magicStrike(w, P, [20, 20], 4);
    return { ok: P.hp === hp0 - 5 && P.skills.resistingspells.v > r0, lost: hp0 - P.hp, gained: P.skills.resistingspells.v - r0, log: lastLog(2) }; });
  run('tracking: choose a kind, then follow one trail', () => {
    set('tracking', 50); const h = near('hare', 8, 0); rng0(); S.trackStart('animals'); const listed = S.TRACKUI && S.TRACKUI.list.includes(h); S.trackFollow(h); S.update(.05);
    return { ok: listed && S.TRACKS && S.TRACKS.follow && /hare/.test(S.TRACKS.list[0].label), listed, label: S.TRACKS && S.TRACKS.list[0].label }; });
  run('braced guard is an extension, off in parity mode', () => { P.hotbar[8] = { k: 'act', id: 'brace' }; S.useSlot(8); return { ok: /extension/.test(lastLog(1)[0]), log: lastLog(1) }; });
  return out;
})();
