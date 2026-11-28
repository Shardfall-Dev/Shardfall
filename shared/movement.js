/* Shardfall movement step — what one 50 ms step of a walking player does, as a pure function shared by the game server
   (authoritative) and the online client (prediction). It is src/game.js playerMove for the online subset: walk and sprint
   speeds from the rules (SF.WALK, SF.SPRINT × the game's MOVE_SCALE), the slower pace below a quarter stick, armour speed
   and encumbrance (SF.EQ), shallows slowing to 80 %, the axis-separated slide on shared/collision.js, sprint stamina drain and
   regeneration, and the game's 8-way facing with its hysteresis. UMD: CommonJS in node, SF_MOVEMENT in the browser.
   What the client may send is only an intent — a direction, how far the stick is pushed, sprint on or off. Where the character
   ends up, how fast it went and what it cost is computed here, on the server, from the server's own state. */
(function (root, factory) {
  const M = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = M; else root.SF_MOVEMENT = M;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  const M = {};
  M.STEP = 0.05;              // seconds: the game's fixed simulation step (src/living.js STEPPER) and the server tick
  M.MOVE_SCALE = 1.5;         // src/game.js MOVE_SCALE: rules speeds (m/s) onto the tile scale
  M.SHALLOWS = 9;             // T.SH
  M.SECT_ANG = [90, 135, 180, 225, 270, 315, 0, 45];   // atlas order S, SW, W, NW, N, NE, E, SE (game.js)
  const angDiff = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

  /* input normalisation: anything a client sends becomes a legal intent (a unit direction or none, want 0–1, a boolean) */
  M.cleanInput = function (i) {
    const num = v => v === undefined || v === null ? 0 : typeof v === 'number' ? v : NaN;
    let x = num(i && i.x), y = num(i && i.y), want = num(i && i.want);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(want)) return { x: 0, y: 0, want: 0, sprint: false };
    const l = Math.hypot(x, y); if (l < 1e-6 || want <= 0) return { x: 0, y: 0, want: 0, sprint: false };
    return { x: x / l, y: y / l, want: Math.min(1, want), sprint: !!(i && i.sprint) };
  };

  /* facing (game.js updateFacing): the 8-way sector for a velocity, kept while within 27.5° of the current one */
  M.facing = function (sect, vx, vy) {
    if (Math.hypot(vx, vy) < .35) return sect;
    const sx = vx - vy, sy = (vx + vy) * .5; let ang = Math.atan2(sy, sx) * 180 / Math.PI; if (ang < 0) ang += 360;
    if (sect !== undefined && sect !== null && angDiff(ang, M.SECT_ANG[sect]) <= 27.5) return sect;
    return ((Math.round((ang - 90) / 45) % 8) + 8) % 8;
  };

  /* step(world, s, input, ctx, COL) → { moved, speed, sprinting }. Mutates s = { x, y, stam, lastDrain, sect, t }.
     ctx (from the rules, computed by the caller from the character): { walk, sprint, drain, regen, delay, stamMax, armourSpd, enc: { speed, stam, run }, ghost }
     COL: shared/collision.js. dt is always M.STEP. */
  M.step = function (world, s, input, ctx, COL) {
    const dt = M.STEP; s.t = (s.t || 0) + dt;
    const i = M.cleanInput(input);
    let sprint = i.sprint && i.want > 0 && !ctx.ghost && s.stam > 0 && ctx.enc.run;
    let sp = (sprint ? ctx.sprint : ctx.walk) * (i.want > .25 ? 1 : .6) * M.MOVE_SCALE;
    sp *= (1 - (ctx.armourSpd || 0)) * ctx.enc.speed;
    if (COL.tileAt(world, Math.floor(s.x), Math.floor(s.y)) === M.SHALLOWS) sp *= .8;
    const dx = i.x * sp * dt, dy = i.y * sp * dt;
    const moved = (dx || dy) ? COL.moveBy(world, s, dx, dy) : 0;
    s.sect = M.facing(s.sect, i.x * i.want, i.y * i.want);
    if (sprint && moved > 0) { s.stam = Math.max(0, s.stam - ctx.drain * ctx.enc.stam * dt); s.lastDrain = s.t; }
    else if (s.t - (s.lastDrain ?? -99) > ctx.delay) s.stam = Math.min(ctx.stamMax, s.stam + ctx.regen * dt);
    return { moved, speed: moved / dt, sprinting: sprint && moved > 0 };
  };

  /* ctxFor(SF, ch) — the movement context for a character from the shared rules (src/rules.js, src/equipment.js) */
  M.ctxFor = function (SF, ch) {
    return { walk: SF.WALK, sprint: SF.SPRINT, drain: SF.SPRINT_DRAIN, regen: SF.STAM_REGEN, delay: SF.STAM_DELAY, stamMax: SF.maxStam(ch),
      armourSpd: SF.EQ.effective(ch).spd || 0, enc: SF.EQ.encumbrance(ch), ghost: !!ch.ghost };
  };
  return M;
});
