// In-page bestiary checks against the built game (evaluated by run.py after a character is created).
(async () => {
  const S = window.__SF, P = S.P, B = S.BESTIARY, out = { loaded: {}, pixelExact: {}, facing: {}, combat: {} };
  const ids = B.mobs.map(m => m.id), F = B.frame;
  const step = (sec, keep) => { for (let i = 0; i < Math.round(sec / .02); i++) { S.update(.02); if (keep) keep(); } };
  // wait for the embedded sheets to decode
  for (let i = 0; i < 100 && ids.some(id => !S.BSI[id]); i++) await new Promise(r => setTimeout(r, 50));
  for (const id of ids) { const im = S.BSI[id]; out.loaded[id] = im ? [im.naturalWidth, im.naturalHeight] : null; }

  // 1) every cell, drawn through the game's own draw path, matches the source pixels exactly (no outline, tint or alpha threshold)
  const src = document.createElement('canvas'), dst = document.createElement('canvas'); src.width = dst.width = F.width; src.height = dst.height = F.height;
  const sg = src.getContext('2d', { willReadFrequently: true }), dg = dst.getContext('2d', { willReadFrequently: true });
  const drawVia = (id, row, col) => { // reproduce drawBestiary's maths into a cell-sized canvas
    const s = S.MON[id].artScale || 1; dg.clearRect(0, 0, F.width, F.height); dg.imageSmoothingEnabled = false;
    dg.drawImage(S.BSI[id], col * F.width, row * F.height, F.width, F.height, Math.round(F.pivot[0] - F.pivot[0] * s), Math.round(F.pivot[1] - F.pivot[1] * s), F.width * s, F.height * s); };
  for (const id of ids) { let diff = 0, cells = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 5; c++) { sg.clearRect(0, 0, F.width, F.height); sg.drawImage(S.BSI[id], c * F.width, r * F.height, F.width, F.height, 0, 0, F.width, F.height); drawVia(id, r, c);
      const a = sg.getImageData(0, 0, F.width, F.height).data, b = dg.getImageData(0, 0, F.width, F.height).data; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { diff++; } cells++; }
    out.pixelExact[id] = { cells, diffBytes: diff }; }
  // Lich Lord rim: count turquoise-ish and semi-transparent rim pixels in its S neutral cell
  { sg.clearRect(0, 0, F.width, F.height); sg.drawImage(S.BSI.lich_lord, F.width, 0, F.width, F.height, 0, 0, F.width, F.height); const a = sg.getImageData(0, 0, F.width, F.height).data; let teal = 0, semi = 0;
    for (let i = 0; i < a.length; i += 4) { if (a[i + 3] && a[i + 2] > 150 && a[i + 1] > 150 && a[i] < 120) teal++; if (a[i + 3] > 0 && a[i + 3] < 255) semi++; } out.lichRim = { teal, semi }; }

  // find open, unprotected ground with room around it
  P.x = 140; P.y = 300;
  for (let k = 0; k < 400; k++) { const x = 110 + (k % 20) * 3, y = 270 + Math.floor(k / 20) * 3; let ok = true;
    for (let dx = -6; dx <= 6 && ok; dx++) for (let dy = -6; dy <= 6 && ok; dy++) if (S.BLK[S.tAt(Math.floor(x + dx), Math.floor(y + dy))] || S.protAt(x + dx, y + dy)) ok = false;
    if (ok) { P.x = x + .5; P.y = y + .5; break; } }
  out.spot = [P.x, P.y];
  for (const e of S.ents) if (e.kind === 'mon' && e.state !== undefined) { e.gone = true; }   // clear the area of wildlife
  const BIG = 1e6, preTick = () => { P.hp = BIG; }, keepAlive = () => { P.hp = S.SF.maxHp(P); };   // the test player cannot die mid-tick (a death resets creature AI)

  // 2) eight facings: approach the player from each screen direction; the latched attack row must be that sector
  const SECT = [90, 135, 180, 225, 270, 315, 0, 45];
  for (const id of ids) { const rows = [];
    for (let s = 0; s < 8; s++) {
      const a = SECT[s] * Math.PI / 180, cx = Math.cos(a), cy = Math.sin(a), vx = (cx + 2 * cy) / 2, vy = (2 * cy - cx) / 2, l = Math.hypot(vx, vy), dist = S.MON[id].reach * .6;
      const m = S.spawnMon(id, -vx / l * dist, -vy / l * dist); m.sect = (s + 4) % 8; m.target = P; m.state = 'chase';
      let row = null; for (let i = 0; i < 40 && row === null; i++) { preTick(); S.update(.02); keepAlive(); if (m.state === 'tele') row = S.bestiaryPose(m).row; }
      rows.push(row); m.gone = true; }
    out.facing[id] = rows; }

  // 3) walk → wind-up → impact → recover in live play, plus the in-game draw call
  for (const id of ids) { const d = S.MON[id], seen = { walkCols: new Set(), windupCol: null, impactCol: null, recoverCol: null, idleCol: null, rowLocked: true, hits: 0, drawn: false };
    const m = S.spawnMon(id, 5, 0); m.sect = 0;
    // idle pose while standing
    preTick(); S.update(.02); keepAlive(); m.speed = 0; m.state = 'idle'; seen.idleCol = S.bestiaryPose(m).col;
    m.target = P; m.state = 'chase'; const hp0 = P.hp; let dmgSeen = 0;
    const orig = S.damagePlayer; let atkRow = null, prevPh = null;
    for (let i = 0; i < 1500; i++) {
      const lh = P.lastHit, it = m.impactT; preTick(); S.update(.02); if (P.lastHit !== lh) dmgSeen++; if (m.impactT !== it) seen.strikes = (seen.strikes || 0) + 1; seen.died = seen.died || !!P.ghost; keepAlive();
      const p = S.bestiaryPose(m);
      if (p.ph === 'walk') seen.walkCols.add(p.col);
      const inAtk = ph => ph === 'windup' || ph === 'impact' || ph === 'recover';
      if (p.ph === 'windup' && !inAtk(prevPh)) atkRow = p.row;   // a new attack latches its own row
      if (p.ph === 'windup') { seen.windupCol = p.col; P.x += .01; }   // player shuffles mid-telegraph; the pose must not turn   // player shuffles mid-telegraph; the pose must not turn
      if (p.ph === 'windup' || p.ph === 'impact' || p.ph === 'recover') { if (atkRow !== null && p.row !== atkRow) { seen.rowLocked = false; seen.lockFail = seen.lockFail || { i, state: m.state, ph: p.ph, row: p.row, latched: atkRow, prevPh, sect: m.sect, atkRow: m.atkRow, st: m.st, atkSt: m.atkSt, impactT: m.impactT, GT: S.GT, mode: m.mode }; } }
      if (p.ph === 'impact') seen.impactCol = p.col;
      if (p.ph === 'recover') seen.recoverCol = p.col;
      prevPh = p.ph;
      if (i % 25 === 0) { S.render(); seen.drawn = seen.drawn || !!m.pose; }
      if (seen.recoverCol !== null && seen.walkCols.size >= 3 && dmgSeen > 0) break;
    }
    seen.walkCols = [...seen.walkCols].sort(); seen.struck = m.impactT != null; seen.hpEvents = dmgSeen;
    out.combat[id] = seen; m.gone = true; void orig; void hp0; void d; }
  return out;
})()
