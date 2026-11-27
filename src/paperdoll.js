/* ---------- Shardfall classic paperdoll v1.0 — the layered compositor (docs/equipment/PAPERDOLL.md) ----------
   Draws the front-view figure from SF.LOOK.resolve(actor): body, face, hair, beard, clothing, every worn piece and the held
   weapon, each on its own layer, in the order SF.LOOK.ORDER gives. Each layer is painted as grey shading into one or more
   material CHANNELS (primary, secondary studs, and fixed parts such as wooden hafts, leather grips, strings, iron fittings);
   each channel is then mapped onto that material's colour ramp (SF.LOOK.ramp), so iron, valorite and mithril plate share one
   drawing and differ only in metal, and studded leather tints its hide and its studs independently. No full-sprite hue filter.
   These layers are ORIGINAL PROCEDURAL ART, drawn in code at 192×256 logical pixels and shown at ×2 (384×512, feet at 496).
   They are not the painted production overlays: assets/character/paperdoll-v1/manifest.json lists every layer as
   "procedural" and assets/character/missing-character-art.json keeps the painted set as missing. Results are cached by the
   descriptor key (bounded), so nothing is drawn in a render loop. */
const PDOLL = (() => {
  const LK = SF.LOOK, W = 192, H = 256, SC = LK.CANVAS.scale;
  const CACHE = new Map(), CACHE_MAX = 32, URLS = new Map();
  const stats = { renders: 0, hits: 0, ms: 0 };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w || W; c.height = h || H; return c; };
  const gv = (v, a) => a === undefined ? `rgb(${v},${v},${v})` : `rgba(${v},${v},${v},${a})`;
  const noise = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) & 255) / 255; };
  const FIX = {   // fixed (non-tint) parts: their own ramps, never the item's material
    wood: LK.ramp('#7a5434', 'wood'), leather: LK.ramp('#4e3322', 'hide'), string: LK.ramp('#d8ceb0', 'cloth'), iron: LK.ramp(SF.EQ.matColor('iron'), 'metal'),
    brass: LK.ramp('#b08d4a', 'metal'), gem: LK.ramp('#9a2030', 'gem'), linen: LK.ramp('#b9aa88', 'cloth'), eye: ['#140e0c', '#2a1e18', '#4a3a30', '#e8e2d8', '#f4f0e8', '#ffffff'],
    lip: LK.ramp('#9a5448', 'skin') };

  /* ---------------- anchors (logical pixels; feet on y 248) ---------------- */
  const A = LK.ANCHORS;     // shared with the manifest (assets/character/paperdoll-v1/manifest.json)
  const mirror = (a, p) => [2 * a.cx - p[0], p[1]];
  const armPts = (a, side) => { const m = a.arm; return side < 0 ? m : { sh: mirror(a, m.sh), el: mirror(a, m.el), wr: mirror(a, m.wr), hd: mirror(a, m.hd) }; };
  const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  // side −1 = the character's right (viewer's left, the main hand); +1 = the character's left (the off hand)

  /* ---------------- shapes ----------------
     A Shape is a list of separate paths filled one by one, so overlapping parts never cancel (Path2D.addPath merges subpaths,
     and the nonzero rule punches holes where two of opposite winding overlap). Texture and light go through paint(), which
     masks with source-atop on a scratch canvas instead of clip(). */
  class Shape { constructor(...ps) { this.p = []; for (const x of ps) this.add(x); } add(x) { if (x instanceof Shape) this.p.push(...x.p); else if (x) this.p.push(x); return this; } }
  const fillS = (g, S) => { if (S instanceof Shape) for (const p of S.p) g.fill(p); else g.fill(S); };
  const SCR = mk(), SG = SCR.getContext('2d', { willReadFrequently: true });
  /* paint(g, shape, base grey, fn): fill the shape, then fn(ctx) draws texture and light that only land inside it */
  function paint(g, S, base, fn) {
    SG.setTransform(1, 0, 0, 1, 0, 0); SG.globalCompositeOperation = 'source-over'; SG.clearRect(0, 0, W, H); SG.fillStyle = gv(base); fillS(SG, S);
    SG.globalCompositeOperation = 'source-atop'; if (fn) { SG.save(); fn(SG); SG.restore(); } SG.globalCompositeOperation = 'source-over';
    const m = g.getTransform(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(SCR, 0, 0); g.setTransform(m);
  }
  /* lighting from the top left: a stepped shadow toward the right, a rim light on the left edge */
  const lit = (g, x0, x1, k) => { k = k === undefined ? 1 : k; const w = x1 - x0;
    g.fillStyle = gv(0, .2 * k); g.fillRect(x0 + w * .58, 0, w, H); g.fillStyle = gv(0, .2 * k); g.fillRect(x0 + w * .84, 0, w, H);
    g.fillStyle = gv(255, .17 * k); g.fillRect(x0, 0, Math.max(1.5, w * .13), H); };

  /* ---------------- paths ---------------- */
  function capsule(p0, p1, r0, r1) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, a = Math.atan2(dy, dx), P = new Path2D();
    P.moveTo(p0[0] + nx * r0, p0[1] + ny * r0); P.lineTo(p1[0] + nx * r1, p1[1] + ny * r1); P.arc(p1[0], p1[1], r1, a + Math.PI / 2, a - Math.PI / 2, true);
    P.lineTo(p0[0] - nx * r0, p0[1] - ny * r0); P.arc(p0[0], p0[1], r0, a - Math.PI / 2, a + Math.PI / 2, true); P.closePath(); return P;
  }
  const ellipse = (x, y, rx, ry, rot) => { const P = new Path2D(); P.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); return P; };
  const rect = (x, y, w, h) => { const P = new Path2D(); P.rect(x, y, w, h); return P; };
  const poly = (pts) => { const P = new Path2D(); P.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) P.lineTo(q[0], q[1]); P.closePath(); return P; };
  function torsoPath(a, e, top, bot) {
    e = e || 0; const c = a.cx, P = new Path2D(), y0 = top === undefined ? a.shY - 3 : top, y1 = bot === undefined ? a.hipY + 4 : bot;
    const xAt = y => y <= a.armpitY ? a.shX + e - Math.max(0, y - a.shY) * .2 : y <= a.waistY ? a.chestX + e - (a.chestX - a.waistX) * (y - a.armpitY) / (a.waistY - a.armpitY) : a.waistX + e + (a.hipX - a.waistX) * Math.min(1, (y - a.waistY) / (a.hipY - a.waistY));
    P.moveTo(c - a.neckW - 2 - e * .5, y0); P.quadraticCurveTo(c - xAt(y0) + 3, y0, c - xAt(y0 + 6), y0 + 8);
    for (let y = y0 + 10; y <= y1; y += 3) P.lineTo(c - xAt(y), y);
    P.lineTo(c - xAt(y1) + 2, y1 + 1); P.lineTo(c + xAt(y1) - 2, y1 + 1);
    for (let y = y1; y >= y0 + 10; y -= 3) P.lineTo(c + xAt(y), y);
    P.lineTo(c + xAt(y0 + 6), y0 + 8); P.quadraticCurveTo(c + xAt(y0) - 3, y0, c + a.neckW + 2 + e * .5, y0); P.closePath(); return P;
  }
  function legPath(a, side, e, y0, y1) {
    e = e || 0; const c = a.cx, s = side, P = new Path2D();
    const o = y => y <= a.hipY ? a.hipX : y <= a.knee ? a.hipX + (a.kneeO - a.hipX) * (y - a.hipY) / (a.knee - a.hipY) : a.kneeO + (a.ankleO - a.kneeO) * (y - a.knee) / (a.ankle - a.knee);
    const i = y => y <= a.crotch + 10 ? 0 : y <= a.knee ? a.kneeI * (y - a.crotch - 10) / (a.knee - a.crotch - 10) : a.kneeI + (a.ankleI - a.kneeI) * (y - a.knee) / (a.ankle - a.knee);
    const calf = y => y > a.knee + 6 && y < a.ankle - 12 ? Math.sin(Math.PI * (y - a.knee - 6) / (a.ankle - a.knee - 18)) * 2.4 : 0;
    const top = Math.max(y0, a.hipY - 16); P.moveTo(c, top);
    for (let y = top; y <= y1; y += 3) P.lineTo(c + s * (o(y) + e + calf(y)), y);
    P.lineTo(c + s * (o(y1) + e), y1); P.lineTo(c + s * (i(y1) - e * .6), y1);
    for (let y = y1; y >= top; y -= 3) P.lineTo(c + s * Math.max(0, i(y) - e * .6), y);
    P.closePath(); return P;
  }
  function crotchPath(a, e, y0, y1) { return poly([[a.cx - a.waistX - e, y0], [a.cx + a.waistX + e, y0], [a.cx + a.hipX + e, a.hipY], [a.cx + 7, y1], [a.cx - 7, y1], [a.cx - a.hipX - e, a.hipY]]); }
  function armShape(a, side, e, upto) { const m = armPts(a, side), S = new Shape(capsule(m.sh, m.el, a.upR + e, a.foreR + 1 + e));
    if (upto !== 'elbow') S.add(capsule(m.el, upto === 'mid' ? lerp(m.el, m.wr, .45) : m.wr, a.foreR + 1 + e, a.wristR + e)); return S; }
  const handPath = (a, side, e) => { const m = armPts(a, side); return capsule(m.wr, m.hd, a.wristR + e, a.handR + e); };
  function footPath(a, side, e, top) {
    const c = a.cx, s = side, y = top || a.ankle - 2;
    return poly([[c + s * (a.ankleI - e * .5), y], [c + s * (a.ankleO + e + (y < a.ankle - 20 ? 2 : 0)), y], [c + s * (a.ankleO + e), a.ankle + 3], [c + s * (a.ankleO + 6 + e), a.foot - 5],
      [c + s * (a.ankleO + 7 + e), a.foot], [c + s * (a.ankleI - 2), a.foot], [c + s * (a.ankleI - 1 - e * .5), a.ankle + 4]]);
  }
  function headPath(a, e) { const P = new Path2D(), c = a.cx, w = a.headW + (e || 0), t = a.headTop - (e || 0), b = a.chin + (e || 0) * .4;
    P.moveTo(c, t); P.bezierCurveTo(c + w * 1.15, t, c + w + 1, a.brow, c + w, a.eyeY + 3); P.bezierCurveTo(c + w - 1, b - 6, c + 5, b, c, b);
    P.bezierCurveTo(c - 5, b, c - w + 1, b - 6, c - w, a.eyeY + 3); P.bezierCurveTo(c - w - 1, a.brow, c - w * 1.15, t, c, t); P.closePath(); return P; }

  /* ---------------- layers and channels ---------------- */
  // a layer holds one grey canvas per channel; bake() maps each onto its ramp and outlines the layer
  function Layer() { this.ch = new Map(); this.T = null; }
  Layer.prototype.g = function (chan, ramp) {
    let c = this.ch.get(chan); if (!c) { const cv = mk(); c = { cv, g: cv.getContext('2d', { willReadFrequently: true }), ramp }; this.ch.set(chan, c); } else if (ramp) c.ramp = ramp;
    const g = c.g; if (this.T) g.setTransform(this.T[0], this.T[1], this.T[2], this.T[3], this.T[4], this.T[5]); else g.setTransform(1, 0, 0, 1, 0, 0); return g;
  };
  Layer.prototype.at = function (x, y, rot) { const c = Math.cos(rot || 0), s = Math.sin(rot || 0); this.T = [c, s, -s, c, x, y]; return this; };
  Layer.prototype.reset = function () { this.T = null; return this; };
  const RGB = new Map(); const rgbOf = R => { let v = RGB.get(R); if (!v) { v = R.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]); RGB.set(R, v); } return v; };
  function bake(layer) {
    const out = mk(), og = out.getContext('2d'), od = og.createImageData(W, H), o = od.data, solid = new Uint8Array(W * H);
    for (const [, c] of layer.ch) {
      const d = c.g.getImageData(0, 0, W, H).data, rgb = rgbOf(c.ramp), n = rgb.length;
      for (let i = 0, p = 0; i < W * H; i++, p += 4) {
        if (d[p + 3] < 110) continue; const x = i % W, y = (i / W) | 0;
        const l = d[p] / 255 + (noise(x, y) - .5) * .1, k = Math.max(0, Math.min(n - 1, Math.floor(l * n)));
        o[p] = rgb[k][0]; o[p + 1] = rgb[k][1]; o[p + 2] = rgb[k][2]; o[p + 3] = 255; solid[i] = 1;
      }
    }
    // a 1 px inner outline in each pixel's own darkened tone keeps every layer crisp against the one below
    const copy = new Uint8ClampedArray(o);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!solid[i]) continue;
      if (x && y && x < W - 1 && y < H - 1 && solid[i - 1] && solid[i + 1] && solid[i - W] && solid[i + W]) continue;
      const p = i * 4; o[p] = copy[p] * .5; o[p + 1] = copy[p + 1] * .46; o[p + 2] = copy[p + 2] * .5; }
    og.putImageData(od, 0, 0); return out;
  }

  /* ---------------- surface textures by family (grey values; primary channel p, studs on s) ---------------- */
  const BASE = { cloth: 150, leather: 136, studded: 132, bone: 176, ringmail: 120, chain: 112, plate: 156, helm: 156, dragon: 130, jewelry: 170 };
  function surface(L, fam, S, x0, x1, y0, y1, o) {
    o = o || {}; const k = fam === 'plate' || fam === 'helm' ? 1.3 : fam === 'cloth' ? .8 : 1;
    paint(L.g('p'), S, BASE[fam] || 140, g => {
      if (fam === 'cloth') { g.strokeStyle = gv(0, .22); g.lineWidth = 1; for (let x = x0 + 5; x < x1 - 3; x += 9) { g.beginPath(); g.moveTo(x + 1, y0 + 4); g.quadraticCurveTo(x - 1, (y0 + y1) / 2, x + 2, y1); g.stroke(); } }
      if (fam === 'leather' || fam === 'studded') { g.strokeStyle = gv(0, .28); g.lineWidth = 1.4; for (const yy of o.panels || []) { g.beginPath(); g.moveTo(x0, yy); g.lineTo(x1, yy); g.stroke(); }
        g.fillStyle = gv(215, .5); for (const yy of o.panels || []) for (let x = x0; x < x1; x += 3) g.fillRect(x, yy + 2, 1.4, 1); }
      if (fam === 'bone') { for (let y = y0 + 3; y < y1; y += 8) { g.fillStyle = gv(40); g.fillRect(x0, y, x1 - x0, 1.5); g.fillStyle = gv(235); g.fillRect(x0, y + 1.5, x1 - x0, 1.5); } }
      if (fam === 'ringmail') { g.strokeStyle = gv(218); g.lineWidth = .9; for (let y = y0, r = 0; y < y1 + 3; y += 3.2, r++) for (let x = x0 + (r % 2) * 1.8; x < x1 + 3; x += 3.6) { g.beginPath(); g.arc(x, y, 1.25, 0, 7); g.stroke(); } }
      if (fam === 'chain') { for (let y = Math.floor(y0), r = 0; y < y1 + 2; y += 2, r++) for (let x = Math.floor(x0) + (r % 2); x < x1 + 2; x += 2) { g.fillStyle = gv((x + y) % 4 < 2 ? 210 : 50); g.fillRect(x, y, 1, 1); } }
      if (fam === 'dragon') { for (let y = y0, r = 0; y < y1 + 5; y += 4.5, r++) for (let x = x0 + (r % 2) * 3; x < x1 + 6; x += 6) { g.fillStyle = gv(58); g.beginPath(); g.arc(x, y + 1, 3.4, 0, Math.PI); g.fill(); g.fillStyle = gv(200); g.beginPath(); g.arc(x, y, 2.6, Math.PI * 1.1, Math.PI * 1.9); g.fill(); } }
      if (fam === 'plate' || fam === 'helm') { g.fillStyle = gv(238, .6); g.fillRect(x0 + (x1 - x0) * .2, y0, Math.max(2, (x1 - x0) * .1), y1 - y0); for (const yy of o.lames || []) { g.fillStyle = gv(46); g.fillRect(x0, yy, x1 - x0, 1.4); g.fillStyle = gv(230); g.fillRect(x0, yy + 1.4, x1 - x0, 1); } }
      lit(g, x0, x1, k);
      if (o.extra) o.extra(g);
      if (o.broken) { g.strokeStyle = gv(10); g.lineWidth = 1; g.beginPath(); const mx = (x0 + x1) / 2, my = (y0 + y1) / 2; g.moveTo(mx - 6, my - 8); g.lineTo(mx - 1, my - 2); g.lineTo(mx - 4, my + 3); g.lineTo(mx + 3, my + 9); g.moveTo(mx - 1, my - 2); g.lineTo(mx + 5, my - 4); g.stroke(); }
    });
    if (fam === 'studded') { const sg = L.g('s'), m = SG.getImageData(0, 0, W, H).data;   // studs only where this piece's leather is (the scratch still holds it)
      for (let y = y0 + 4, r = 0; y < y1 - 2; y += 6.5, r++) for (let x = x0 + 3 + (r % 2) * 3.2; x < x1 - 1; x += 6.4) { const i = ((y | 0) * W + (x | 0)) * 4; if (m[i + 3] < 200) continue;
        sg.fillStyle = gv(95); sg.fillRect(x - .8, y - .6, 2, 2); sg.fillStyle = gv(235); sg.fillRect(x - .8, y - .8, 1.1, 1.1); } }
  }
  const rivet = (L, x, y, chan) => { const g = L.g(chan || 'p'); g.fillStyle = gv(40); g.fillRect(x - 1, y, 2.2, 1.6); g.fillStyle = gv(245); g.fillRect(x - 1, y - 1, 1.4, 1.2); };

  /* ---------------- body, face, hair, beard ---------------- */
  function drawBody(L, a, d) {
    const g = L.g('skin', LK.ramp(d.skin.hex, 'skin')), c = a.cx, S = new Shape(), fem = d.body === 'female';
    S.add(headPath(a)).add(capsule([c, a.chin - 6], [c, a.neckBot + 2], a.neckW, a.neckW + 1.5)).add(torsoPath(a, 0, a.shY - 2, a.hipY + 4)).add(crotchPath(a, 0, a.waistY, a.crotch + 4));
    for (const s of [-1, 1]) { S.add(armShape(a, s, 0)).add(handPath(a, s, 0)).add(legPath(a, s, 0, a.hipY - 10, a.ankle + 2)).add(footPath(a, s, -1)); }
    paint(g, S, 160, g => {
      g.fillStyle = gv(0, .2); g.fillRect(c - 7, a.chin - 1, 14, 5);                                                      // under the jaw
      g.fillStyle = gv(0, .15);
      if (!fem) { g.beginPath(); g.ellipse(c - 9, a.chestY, 8.5, 3.6, .12, 0, Math.PI); g.ellipse(c + 9, a.chestY, 8.5, 3.6, -.12, 0, Math.PI); g.fill();
        for (let y = a.chestY + 10; y < a.waistY; y += 8) { g.fillRect(c - 7, y, 5, 1); g.fillRect(c + 2, y, 5, 1); } g.fillRect(c - .5, a.chestY + 4, 1, a.waistY - a.chestY - 4); }
      else { g.beginPath(); g.ellipse(c - 8, a.chestY + 4, 7, 4, 0, 0, Math.PI); g.ellipse(c + 8, a.chestY + 4, 7, 4, 0, 0, Math.PI); g.fill(); g.fillStyle = gv(255, .14); g.fillRect(c - 13, a.chestY - 3, 6, 3); }
      g.fillStyle = gv(0, .16); for (const s of [-1, 1]) { g.beginPath(); g.ellipse(c + s * (a.kneeO - 6), a.knee, 4.5, 2.6, 0, 0, 7); g.fill(); }
      g.fillStyle = gv(0, .14); g.fillRect(c - a.shX, a.armpitY - 2, a.shX * 2, 1);
      lit(g, c - 42, c + 42, .9);
    });
    // modest underwear: linen braies, and a chest band on the female body
    const u = L.g('linen', FIX.linen), U = new Shape(crotchPath(a, .8, a.waistY + 8, a.crotch + 5)); for (const s of [-1, 1]) U.add(legPath(a, s, .8, a.hipY - 8, a.crotch + 13));
    if (fem) U.add(torsoPath(a, .8, a.chestY - 7, a.chestY + 8));
    paint(u, U, 150, g => { g.fillStyle = gv(0, .28); g.fillRect(0, a.waistY + 9, W, 1); g.fillRect(c - .5, a.crotch - 8, 1, 12); lit(g, c - 30, c + 30, .8); });
  }
  function drawFace(L, a, d) {
    const c = a.cx, fem = d.body === 'female', y = a.eyeY, sk = L.g('skin', LK.ramp(d.skin.hex, 'skin'));
    sk.fillStyle = gv(95); sk.fillRect(c + .5, y + 1, 1.2, 5); sk.fillRect(c - 2, y + 6, 4, 1.2);                                    // nose shadow
    sk.fillStyle = gv(105); sk.fillRect(c - a.headW - .6, y - 1, 2, 6); sk.fillRect(c + a.headW - 1.4, y - 1, 2, 6);                  // ears
    const e = L.g('eye', FIX.eye); for (const s of [-1, 1]) { const x = c + s * 4.4; e.fillStyle = gv(200); e.fillRect(x - 2, y, 4, 2); e.fillStyle = gv(20); e.fillRect(x - .7, y, 1.8, 2); }
    const lp = L.g('lip', FIX.lip); lp.fillStyle = gv(fem ? 150 : 110); lp.fillRect(c - (fem ? 2.6 : 3), y + 9, fem ? 5.2 : 6, fem ? 1.6 : 1.2);
    const brow = d.hair.style === 'bald' || d.hide.hair === 'all' ? d.beard.hex : d.hair.hex, hr = L.g('brow', LK.ramp(brow, 'hair'));
    hr.fillStyle = gv(80); for (const s of [-1, 1]) hr.fillRect(c + s * 4.4 - 2.6, y - 2.6, 5.2, fem ? 1 : 1.4);
  }
  const HAIR_TOPCUT = a => a.eyeY + 3;     // with an open helmet only hair below this line shows
  function hairCap(a) { const c = a.cx, w = a.headW + 1.2, t = a.headTop - 1.6, P = new Path2D();
    P.moveTo(c - w, a.eyeY + 1); P.bezierCurveTo(c - w - 1.5, t + 4, c - w * .6, t - 1, c, t); P.bezierCurveTo(c + w * .6, t - 1, c + w + 1.5, t + 4, c + w, a.eyeY + 1);
    P.lineTo(c + w - 2.2, a.brow); P.quadraticCurveTo(c + 3, a.brow - 6, c - 2, a.brow - 3); P.quadraticCurveTo(c - w + 3, a.brow - 4, c - w + 2.2, a.brow + 1); P.closePath(); return P; }
  const strands = (g, x0, x1) => { g.strokeStyle = gv(0, .32); g.lineWidth = 1; for (let x = x0; x < x1; x += 2.6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (x - (x0 + x1) / 2) * .08, H); g.stroke(); } };
  function drawHair(L, a, d, part) {
    const st = d.hair.style, c = a.cx, fem = d.body === 'female'; if (st === 'bald' || d.hide.hair === 'all') return;
    const g = L.g('hair', LK.ramp(d.hair.hex, 'hair')), S = new Shape(), cut = d.hide.hair === 'top';
    if (part === 'back') {
      if (st === 'long') { const P = new Path2D(); P.moveTo(c - a.headW - 2, a.brow); P.quadraticCurveTo(c - a.headW - 6, a.shY + 10, c - a.headW - 3, a.shY + (fem ? 34 : 24)); P.lineTo(c + a.headW + 3, a.shY + (fem ? 34 : 24)); P.quadraticCurveTo(c + a.headW + 6, a.shY + 10, c + a.headW + 2, a.brow); P.closePath(); S.add(P); }
      else if (st === 'ponytail') S.add(capsule([c + a.headW - 2, a.eyeY + 2], [c + a.headW + 3, a.shY + 20], 3.4, 2.2));
      else return;
      paint(g, S, 100, g => { strands(g, c - 20, c + 20); lit(g, c - 18, c + 18, .6); }); return;
    }
    if (st !== 'receding' && st !== 'mohawk') S.add(hairCap(a));
    if (st === 'receding') { for (const s of [-1, 1]) S.add(capsule([c + s * (a.headW - .2), a.brow - 2], [c + s * (a.headW - .2), a.eyeY + 4], 2.2, 2)); S.add(capsule([c - 6, a.headTop + 2.5], [c + 6, a.headTop + 2.5], 1.1, 1.1)); }
    if (st === 'mohawk') { S.add(poly([[c - 3, a.brow - 1], [c - 2.5, a.headTop - 9], [c + 2.5, a.headTop - 9], [c + 3, a.brow - 1]])); for (const s of [-1, 1]) S.add(capsule([c + s * (a.headW - .2), a.brow + 1], [c + s * (a.headW - .2), a.eyeY + 3], 1.5, 1.3)); }
    if (st === 'long') for (const s of [-1, 1]) S.add(capsule([c + s * (a.headW + .5), a.brow], [c + s * (a.headW + 2.5), a.shY + (fem ? 20 : 12)], 3.2, 2.6));
    if (st === 'pageboy') { for (const s of [-1, 1]) S.add(capsule([c + s * (a.headW + .6), a.brow - 2], [c + s * (a.headW + .6), a.chin - 5], 3.4, 3.4)); S.add(capsule([c - a.headW + 2.5, a.brow - 1.5], [c + a.headW - 2.5, a.brow - 1.5], 2.2, 2.2)); }
    if (st === 'pigtails') for (const s of [-1, 1]) { S.add(capsule([c + s * (a.headW + 1), a.eyeY], [c + s * (a.headW + 5), a.shY + 24], 2.6, 2.2)); S.add(capsule([c + s * (a.headW + 5), a.shY + 25], [c + s * (a.headW + 5), a.shY + 29], 1.2, 1.8)); }
    if (st === 'buns') for (const s of [-1, 1]) S.add(ellipse(c + s * (a.headW - 1), a.headTop + 1, 4.6, 4.6));
    if (st === 'ponytail') S.add(ellipse(c + a.headW - 1, a.eyeY + 1, 2.4, 2.4));
    paint(g, S, 125, g => { if (cut) { g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.fillRect(0, 0, W, HAIR_TOPCUT(a)); g.globalCompositeOperation = 'source-atop'; }
      strands(g, c - 22, c + 22); g.fillStyle = gv(232, .5); g.fillRect(c - 7, a.headTop - 1, 6, 2); lit(g, c - 16, c + 16, .8); });
    if (st === 'pigtails') { const t = L.g('leather', FIX.leather); t.fillStyle = gv(140); for (const s of [-1, 1]) t.fillRect(c + s * (a.headW + 5) - 2, a.shY + 22, 4, 2); }
  }
  function drawBeard(L, a, d) {
    const st = d.beard.style, vis = d.hide.beard; if (st === 'none' || vis === 'none' || d.body === 'female') return;
    const g = L.g('hair', LK.ramp(d.beard.hex, 'hair')), c = a.cx, y = a.eyeY, S = new Shape();
    const M = new Path2D(); M.moveTo(c - 4.6, y + 8.6); M.quadraticCurveTo(c, y + 6.6, c + 4.6, y + 8.6); M.lineTo(c + 5, y + 10.4); M.quadraticCurveTo(c, y + 8.6, c - 5, y + 10.4); M.closePath();
    if (st === 'mustache' || st === 'vandyke' || st === 'short' || st === 'long') S.add(M);
    if (vis === 'all') {
      if (st === 'goatee') S.add(capsule([c, y + 11.5], [c, a.chin + 1], 2.8, 2.2));
      if (st === 'vandyke') S.add(poly([[c - 2.6, y + 11.4], [c + 2.6, y + 11.4], [c, a.chin + 4]]));
      if (st === 'short' || st === 'long') { const bot = st === 'long' ? a.chin + 18 : a.chin + 2, P = new Path2D(); P.moveTo(c - a.headW + .4, y + 1); P.quadraticCurveTo(c - a.headW, bot - 4, c - 4, bot); P.lineTo(c + 4, bot); P.quadraticCurveTo(c + a.headW, bot - 4, c + a.headW - .4, y + 1);
        P.lineTo(c + a.headW - 2.4, y + 2); P.quadraticCurveTo(c + 6, y + 14.5, c, y + 13.4); P.quadraticCurveTo(c - 6, y + 14.5, c - a.headW + 2.4, y + 2); P.closePath(); S.add(P); }
    }
    if (!S.p.length) return;
    paint(g, S, 112, g => { strands(g, c - 14, c + 14); lit(g, c - 12, c + 12, .7); });
  }

  /* ---------------- gear by slot ---------------- */
  const famTex = it => it.fam === 'helm' ? 'plate' : it.fam || 'cloth';
  const gearRamp = (it, d) => it.id === 'shirt' ? LK.ramp(d.cloth.hex, 'cloth') : LK.rampFor(it.mat || 'cloth');   // the creator's shirt colour is the shirt's dye
  function gearLayer(L, it, d) { L.g('p', gearRamp(it, d)); if (it.sec) L.g('s', LK.ramp(it.secHex, 'metal')); }
  function drawChest(L, a, it, d) {
    gearLayer(L, it, d); const fam = famTex(it), c = a.cx, e = { leather: 1, studded: 1.4, bone: 2.2, ringmail: 1.5, chain: 1.5, plate: 2.6, dragon: 2.4 }[fam] || 1;
    const bot = { leather: a.hipY + 6, studded: a.hipY + 6, bone: a.hipY + 2, ringmail: a.hipY + 12, chain: a.hipY + 16, plate: a.hipY + 8, dragon: a.hipY + 10 }[fam] || a.hipY + 4;
    const S = new Shape(torsoPath(a, e, a.shY - 3, bot)); if (fam === 'ringmail' || fam === 'chain') for (const s of [-1, 1]) S.add(armShape(a, s, e * .8, 'elbow'));
    surface(L, fam, S, c - a.shX - 10, c + a.shX + 10, a.shY - 4, bot, { broken: it.broken, lames: fam === 'plate' ? [a.waistY + 4, a.waistY + 11, a.hipY + 1] : null, panels: fam === 'leather' || fam === 'studded' ? [a.waistY] : null,
      extra: g => {
        if (fam === 'plate') { g.fillStyle = gv(244); g.fillRect(c - 1, a.shY + 4, 2, a.waistY - a.shY - 2); g.fillStyle = gv(56); g.fillRect(c + 1, a.shY + 4, 1.2, a.waistY - a.shY - 2); g.fillStyle = gv(0, .18); g.beginPath(); g.ellipse(c, a.chestY + 8, a.chestX - 2, 4, 0, 0, Math.PI); g.fill(); }
        if (fam === 'leather' || fam === 'studded') { g.strokeStyle = gv(40); g.lineWidth = 1; for (let y = a.shY + 2; y < a.chestY + 2; y += 4) { g.beginPath(); g.moveTo(c - 2, y); g.lineTo(c + 2, y + 2); g.moveTo(c + 2, y); g.lineTo(c - 2, y + 2); g.stroke(); } }
        if (fam === 'bone') { g.fillStyle = gv(238); g.fillRect(c - 2, a.shY + 2, 4, a.waistY - a.shY); g.fillStyle = gv(40); g.fillRect(c + 2, a.shY + 2, 1, a.waistY - a.shY); }
        if (fam === 'dragon') { g.fillStyle = gv(205); g.beginPath(); g.moveTo(c - 14, a.shY + 4); g.quadraticCurveTo(c, a.shY + 24, c + 14, a.shY + 4); g.lineTo(c + 10, a.shY + 2); g.quadraticCurveTo(c, a.shY + 15, c - 10, a.shY + 2); g.fill(); }
      } });
    if (fam === 'plate') for (const s of [-1, 1]) for (const yy of [a.shY + 6, a.waistY + 7]) rivet(L, c + s * (a.chestX - 2), yy);
  }
  function drawArms(L, a, it, d) {
    gearLayer(L, it, d); const fam = famTex(it), e = { plate: 1.8, bone: 1.6, dragon: 1.6 }[fam] || 1.1;
    for (const s of [-1, 1]) {
      const m = armPts(a, s); surface(L, fam, armShape(a, s, e), Math.min(m.sh[0], m.wr[0]) - 9, Math.max(m.sh[0], m.wr[0]) + 9, m.sh[1] - 8, m.wr[1], { lames: fam === 'plate' ? [m.sh[1] + 14, m.el[1] - 7, m.el[1] + 6, m.wr[1] - 12] : null, broken: it.broken });
      if (fam === 'plate' || fam === 'dragon' || fam === 'bone') {
        const g = L.g('p'), pd = new Path2D(); pd.ellipse(m.sh[0], m.sh[1] + 1, a.upR + 5, a.upR + 2.5, s * .3, Math.PI, 0); pd.lineTo(m.sh[0] + a.upR + 4, m.sh[1] + 10); pd.lineTo(m.sh[0] - a.upR - 4, m.sh[1] + 10); pd.closePath();
        paint(g, pd, fam === 'bone' ? 190 : 168, g => { g.fillStyle = gv(242, .7); g.fillRect(m.sh[0] - 7, m.sh[1] - 8, 3, 18); g.fillStyle = gv(40); g.fillRect(m.sh[0] - 12, m.sh[1] + 4, 24, 1.2); lit(g, m.sh[0] - 12, m.sh[0] + 12, 1.2); });
        if (fam === 'dragon') { g.fillStyle = gv(215); g.beginPath(); g.moveTo(m.sh[0] - 2.5, m.sh[1] - 5); g.lineTo(m.sh[0] + s * 2, m.sh[1] - 13); g.lineTo(m.sh[0] + 2.5, m.sh[1] - 5); g.fill(); }
        paint(g, ellipse(m.el[0], m.el[1], a.foreR + 3, 3.4), 186, g => { g.fillStyle = gv(45); g.fillRect(m.el[0] - 1, m.el[1] - 1, 2, 2); lit(g, m.el[0] - 8, m.el[0] + 8, 1); });
      }
    }
  }
  function drawHands(L, a, it, d, sides, fist) {
    gearLayer(L, it, d); const fam = famTex(it);
    for (const s of sides || [-1, 1]) {
      const m = armPts(a, s), e = fam === 'plate' ? 1.2 : fam === 'dragon' || fam === 'bone' ? 1 : .6, S = new Shape();
      if (fist) S.add(rect(m.hd[0] - a.handR - e - .5, m.hd[1] - 4, (a.handR + e) * 2 + 1, 7));
      else { S.add(handPath(a, s, e)); const top = lerp(m.wr, m.el, .24), fl = fam === 'plate' ? 2.2 : fam === 'cloth' ? .6 : 1.2; S.add(capsule(top, m.wr, a.wristR + e + fl, a.wristR + e + fl)); }
      surface(L, fam, S, m.hd[0] - 9, m.hd[0] + 9, m.wr[1] - 10, m.hd[1] + 6, { lames: fam === 'plate' ? [m.wr[1] + 2, m.hd[1] - 4] : null, extra: fist ? g => { g.fillStyle = gv(40); for (let k = -1; k <= 1; k++) g.fillRect(m.hd[0] + k * 2.4 - .5, m.hd[1] - 3, 1, 4); } : null });
    }
  }
  function drawBareFist(L, a, d, s) { const m = armPts(a, s), g = L.g('skin', LK.ramp(d.skin.hex, 'skin'));
    paint(g, rect(m.hd[0] - a.handR - .5, m.hd[1] - 4, a.handR * 2 + 1, 7), 160, g => { g.fillStyle = gv(0, .38); for (let k = -1; k <= 1; k++) g.fillRect(m.hd[0] + k * 2.3 - .5, m.hd[1] - 3, 1, 4); lit(g, m.hd[0] - 6, m.hd[0] + 6); }); }
  function drawLegs(L, a, it, d) {
    gearLayer(L, it, d); const fam = famTex(it), e = { plate: 2, bone: 1.6, dragon: 1.6 }[fam] || 1, c = a.cx, S = new Shape(crotchPath(a, e, a.waistY + 2, a.crotch + 4));
    for (const s of [-1, 1]) S.add(legPath(a, s, e, a.waistY + 2, a.ankle - 2));
    surface(L, fam, S, c - a.hipX - 6, c + a.hipX + 6, a.waistY, a.ankle, { lames: fam === 'plate' ? [a.knee - 12, a.knee + 7, a.ankle - 14] : null, panels: fam === 'leather' || fam === 'studded' ? [a.waistY + 6] : null, broken: it.broken,
      extra: g => { g.fillStyle = gv(0, .25); g.fillRect(c - .6, a.crotch - 2, 1.2, a.ankle); } });
    if (fam === 'plate' || fam === 'bone' || fam === 'dragon') { const g = L.g('p'); for (const s of [-1, 1]) { const kx = c + s * (a.kneeO - 6);
      paint(g, ellipse(kx, a.knee - 1, 6, 4.8), 196, g => { g.fillStyle = gv(244); g.fillRect(kx - 3, a.knee - 4, 3, 2); g.fillStyle = gv(45); g.fillRect(kx - 1, a.knee, 2, 2); lit(g, kx - 6, kx + 6, 1.2); }); } }
  }
  function drawFeet(L, a, it, d) {
    gearLayer(L, it, d); const boots = it.id === 'boots', c = a.cx;
    for (const s of [-1, 1]) { const top = boots ? a.knee + 14 : a.ankle - 4, S = new Shape(footPath(a, s, 1, top)); if (boots) S.add(legPath(a, s, 1.5, top, a.ankle + 1));
      const x0 = s < 0 ? c - a.ankleO - 10 : c + a.ankleI - 2, x1 = s < 0 ? c - a.ankleI + 2 : c + a.ankleO + 10;
      surface(L, 'leather', S, x0, x1, top, a.foot, { broken: it.broken, extra: g => { g.fillStyle = gv(28); g.fillRect(0, a.foot - 2, W, 2); if (boots) { g.fillStyle = gv(196); g.fillRect(0, top, W, 4); g.fillStyle = gv(40); g.fillRect(0, top + 4, W, 1); } } }); }
  }
  function drawNeck(L, a, it, d) {
    gearLayer(L, it, d); const fam = famTex(it), c = a.cx, P = new Path2D();
    P.moveTo(c - a.neckW - 2, a.chin - 2); P.lineTo(c + a.neckW + 2, a.chin - 2); P.lineTo(c + a.neckW + 3, a.neckBot - 2); P.quadraticCurveTo(c + a.shX - 4, a.shY - 1, c + a.shX - 6, a.shY + 6);
    P.quadraticCurveTo(c, a.shY + 14, c - a.shX + 6, a.shY + 6); P.quadraticCurveTo(c - a.shX + 4, a.shY - 1, c - a.neckW - 3, a.neckBot - 2); P.closePath();
    surface(L, fam, P, c - a.shX, c + a.shX, a.chin - 2, a.shY + 12, { lames: fam === 'plate' ? [a.neckBot - 3, a.shY + 2] : null, broken: it.broken });
    if (fam === 'plate') { rivet(L, c - 9, a.shY + 4); rivet(L, c + 9, a.shY + 4); }
  }
  function drawUnder(L, a, it, d) {
    gearLayer(L, it, d); const c = a.cx, S = new Shape();
    if (it.slot === 'shirt') { S.add(torsoPath(a, .8, a.shY - 3, a.hipY - 2)); for (const s of [-1, 1]) S.add(armShape(a, s, .9, 'wrist'));
      surface(L, 'cloth', S, c - a.shX - 10, c + a.shX + 10, a.shY - 4, a.hipY, { broken: it.broken, extra: g => { g.fillStyle = gv(60); g.beginPath(); g.moveTo(c - 4, a.shY - 3); g.lineTo(c, a.shY + 7); g.lineTo(c + 4, a.shY - 3); g.fill();
        for (const s of [-1, 1]) { const m = armPts(a, s); g.fillStyle = gv(200); g.fillRect(m.wr[0] - a.wristR - 2, m.wr[1] - 4, a.wristR * 2 + 4, 2); } } }); }
    else { S.add(crotchPath(a, 1, a.waistY - 1, a.crotch + 4)); for (const s of [-1, 1]) S.add(legPath(a, s, 1.2, a.waistY - 1, a.ankle - 1));
      surface(L, 'cloth', S, c - a.hipX - 6, c + a.hipX + 6, a.waistY - 2, a.ankle, { broken: it.broken, extra: g => { g.fillStyle = gv(70); g.fillRect(c - a.waistX - 1, a.waistY, a.waistX * 2 + 2, 2); g.fillStyle = gv(0, .25); g.fillRect(c - .6, a.crotch - 2, 1.2, a.ankle); } }); }
  }
  function drawOuter(L, a, it, d) {
    gearLayer(L, it, d); const c = a.cx, robe = it.id === 'robe', tab = it.id === 'tabard', len = robe ? a.ankle + 4 : tab ? a.knee - 16 : a.knee - 6, flare = robe ? 16 : tab ? 1 : 7;
    const S = new Shape(poly([[c - a.neckW - 2, a.shY - 4], [c - a.shX - (robe ? 2 : tab ? -6 : 0), a.shY + 1], [c - a.chestX - (tab ? -5 : 1), a.armpitY + 2], [c - a.waistX - (tab ? -2 : 2), a.waistY],
      [c - a.hipX - flare, len], [c + a.hipX + flare, len], [c + a.waistX + (tab ? -2 : 2), a.waistY], [c + a.chestX + (tab ? -5 : 1), a.armpitY + 2], [c + a.shX + (robe ? 2 : tab ? -6 : 0), a.shY + 1], [c + a.neckW + 2, a.shY - 4]]));
    if (robe) for (const s of [-1, 1]) { const m = armPts(a, s); S.add(capsule(m.sh, m.el, a.upR + 2, a.foreR + 3)).add(capsule(m.el, [m.wr[0] + s, m.wr[1] - 1], a.foreR + 3, a.wristR + 4.5)); }
    if (it.id === 'garment') for (const s of [-1, 1]) { const m = armPts(a, s); S.add(capsule(m.sh, lerp(m.sh, m.el, .55), a.upR + 1.6, a.upR + 1.2)); }
    surface(L, 'cloth', S, c - a.hipX - flare, c + a.hipX + flare, a.shY - 4, len, { broken: it.broken, extra: g => {
      g.fillStyle = gv(55); g.beginPath(); g.moveTo(c - 5, a.shY - 4); g.lineTo(c, a.shY + 6); g.lineTo(c + 5, a.shY - 4); g.fill();
      if (tab) { g.fillStyle = gv(210); g.fillRect(c - 1.5, a.shY + 12, 3, len - a.shY - 16); g.fillRect(c - 8, a.chestY + 4, 16, 3); g.fillStyle = gv(40); g.fillRect(0, len - 3, W, 1.5); }
      if (robe) { g.fillStyle = gv(0, .3); for (const x of [c - 12, c - 4, c + 6, c + 14]) g.fillRect(x, a.hipY, 1, len - a.hipY - 2); } } });
  }
  function drawBelt(L, a, it, d) {
    gearLayer(L, it, d); const c = a.cx, y = a.waistY + 3; surface(L, 'leather', rect(c - a.waistX - 2.4, y, a.waistX * 2 + 4.8, 5), c - a.waistX - 3, c + a.waistX + 3, y, y + 5);
    const b = L.g('brass', FIX.brass); b.fillStyle = gv(170); b.fillRect(c - 3.5, y - .5, 7, 6); b.fillStyle = gv(30); b.fillRect(c - 1.5, y + 1.5, 3, 2); b.fillStyle = gv(250); b.fillRect(c - 3, y, 2, 1);
  }
  function drawJewelry(L, a, it, d) {
    const g = L.g('p', LK.rampFor(it.mat)), gem = L.g('gem', FIX.gem), c = a.cx;
    if (it.slot === 'necklace') { g.strokeStyle = gv(200); g.lineWidth = 1.2; g.beginPath(); g.moveTo(c - a.neckW - 1, a.neckBot - 4); g.quadraticCurveTo(c, a.shY + 18, c + a.neckW + 1, a.neckBot - 4); g.stroke(); g.fillStyle = gv(190); g.beginPath(); g.arc(c, a.shY + 12, 3, 0, 7); g.fill(); gem.fillStyle = gv(150); gem.beginPath(); gem.arc(c, a.shY + 12, 1.8, 0, 7); gem.fill(); }
    if (it.slot === 'bracelet') { const m = armPts(a, 1); g.fillStyle = gv(185); g.fillRect(m.wr[0] - a.wristR - 1.6, m.wr[1] - 4, a.wristR * 2 + 3.2, 3); g.fillStyle = gv(250); g.fillRect(m.wr[0] - a.wristR - 1, m.wr[1] - 4, 2, 1); }
    if (it.slot === 'ring') { const m = armPts(a, -1); g.fillStyle = gv(205); g.fillRect(m.hd[0] + 1, m.hd[1] + 1.5, 2.6, 2.4); gem.fillStyle = gv(170); gem.fillRect(m.hd[0] + 1.6, m.hd[1] + 1, 1.4, 1.4); }
  }
  function drawHelm(L, a, it, d) {
    gearLayer(L, it, d); const id = it.id, c = a.cx, w = a.headW, t = a.headTop, g = L.g('p');
    const dome = (e, bot) => { const Q = new Path2D(); Q.moveTo(c - w - e, bot); Q.bezierCurveTo(c - w - e - 1, t - e + 2, c - w * .5, t - e - 1, c, t - e - 1); Q.bezierCurveTo(c + w * .5, t - e - 1, c + w + e + 1, t - e + 2, c + w + e, bot); Q.closePath(); return Q; };
    if (id === 'cloth_cap') { surface(L, 'cloth', new Shape(dome(1.5, a.brow + 1), ellipse(c + 6, t + 1, 9, 5, .4)), c - w - 4, c + w + 14, t - 6, a.brow + 2, { extra: g => { g.fillStyle = gv(70); g.fillRect(0, a.brow - 1, W, 2); } }); return; }
    if (id === 'leather_cap') { const S = new Shape(dome(1.4, a.brow + 1)); for (const s of [-1, 1]) S.add(capsule([c + s * (w + .4), a.brow], [c + s * (w + .4), a.eyeY + 6], 2.6, 2.2));
      surface(L, 'leather', S, c - w - 4, c + w + 4, t - 4, a.eyeY + 8, { extra: g => { g.fillStyle = gv(45); g.fillRect(c - .5, t - 2, 1, a.brow - t + 1); g.fillStyle = gv(215, .5); for (let x = c - w; x < c + w; x += 3) g.fillRect(x, a.brow - 1.5, 1.4, 1); } }); return; }
    if (id === 'chain_coif') { const P = new Path2D(); P.moveTo(c - w - 2.2, a.eyeY); P.lineTo(c - w - 3.5, a.shY + 4); P.quadraticCurveTo(c, a.shY + 12, c + w + 3.5, a.shY + 4); P.lineTo(c + w + 2.2, a.eyeY); P.closePath();
      surface(L, 'chain', new Shape(dome(2.2, a.chin + 2), P), c - w - 5, c + w + 5, t - 4, a.shY + 12, { extra: g => { g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.fill(ellipse(c, a.eyeY + 4, w - 3.6, 9.6)); } });
      const s = L.g('rim', LK.rampFor(it.mat)); s.strokeStyle = gv(175); s.lineWidth = 1.3; s.beginPath(); s.ellipse(c, a.eyeY + 4, w - 3.1, 10.1, 0, 0, 7); s.stroke(); return; }
    if (id === 'bascinet') { const P = new Path2D(); P.moveTo(c - w - 1.6, a.eyeY + 4); P.bezierCurveTo(c - w - 2, t + 2, c - 4, t - 4, c + 1, t - 9); P.bezierCurveTo(c + 4, t - 4, c + w + 2, t + 2, c + w + 1.6, a.eyeY + 4); P.lineTo(c + w - 1, a.eyeY + 5); P.lineTo(c + w - 2, a.brow + 1); P.lineTo(c - w + 2, a.brow + 1); P.lineTo(c - w + 1, a.eyeY + 5); P.closePath();
      surface(L, 'helm', P, c - w - 3, c + w + 3, t - 10, a.eyeY + 6, { extra: g => { g.fillStyle = gv(45); g.fillRect(0, a.brow, W, 1.2); } }); rivet(L, c - w + 1, a.eyeY); rivet(L, c + w - 1, a.eyeY); return; }
    if (id === 'open_helm' || id === 'norse_helm') { const S = new Shape(dome(1.8, a.brow + 2), rect(c - w - 2.4, a.brow - 1, w * 2 + 4.8, 3.4));
      if (id === 'open_helm') for (const s of [-1, 1]) S.add(poly([[c + s * (w + 2), a.brow], [c + s * (w + 1.5), a.eyeY + 9], [c + s * (w - 3), a.eyeY + 11], [c + s * (w - 3.5), a.brow + 2]]));
      else S.add(capsule([c, a.brow], [c, a.eyeY + 6], 1.8, 1.4));
      surface(L, 'helm', S, c - w - 3, c + w + 3, t - 4, a.eyeY + 10, { lames: [a.brow - 1], extra: id === 'norse_helm' ? g => { g.fillStyle = gv(232); g.fillRect(c - .6, t - 3, 1.4, a.brow - t + 2); g.fillStyle = gv(45); for (const s of [-1, 1]) g.fillRect(c + s * 6 - .5, t, 1, a.brow - t); } : null });
      for (let k = -2; k <= 2; k++) rivet(L, c + k * 4.6, a.brow + .6); return; }
    // full helms: closed, plate, great, bone and dragon hide all hair and the beard
    if (id === 'great_helm') { surface(L, 'helm', poly([[c - w - 3, t + 1], [c + w + 3, t + 1], [c + w + 3.5, a.chin + 4], [c - w - 3.5, a.chin + 4]]), c - w - 4, c + w + 4, t, a.chin + 4, { lames: [t + 4], extra: g => {
        g.fillStyle = gv(12); g.fillRect(c - w + .5, a.eyeY - 1, w - 2, 2.4); g.fillRect(c + 1.5, a.eyeY - 1, w - 2, 2.4); g.fillStyle = gv(238); g.fillRect(c - 1, t + 4, 2, a.chin - t); g.fillStyle = gv(25); for (let i = 0; i < 6; i++) g.fillRect(c + 3 + (i % 3) * 2.6, a.eyeY + 7 + Math.floor(i / 3) * 3, 1.2, 1.2); } }); return; }
    if (id === 'bone_helm') { surface(L, 'bone', dome(2.4, a.chin + 1), c - w - 4, c + w + 4, t - 3, a.chin + 2, { extra: g => { g.fillStyle = gv(15); for (const s of [-1, 1]) { g.beginPath(); g.ellipse(c + s * 4.6, a.eyeY + .5, 3, 2.4, 0, 0, 7); g.fill(); }
        g.fillRect(c - 1, a.eyeY + 4, 2, 3); g.fillStyle = gv(240); for (let k = -2; k <= 2; k++) g.fillRect(c + k * 2.2 - .6, a.chin - 5, 1.6, 3); } });
      const hn = L.g('horn', LK.ramp('#c8bca0', 'bone')); for (const s of [-1, 1]) { hn.fillStyle = gv(170); hn.beginPath(); hn.moveTo(c + s * (w - 1), a.brow - 3); hn.quadraticCurveTo(c + s * (w + 9), a.brow - 8, c + s * (w + 7), t - 7); hn.lineTo(c + s * (w + 2), a.brow - 5); hn.fill(); } return; }
    const S = new Shape(dome(2.3, a.chin + 3)); if (id === 'plate_helm') S.add(poly([[c - w - 3, a.chin], [c - w - 5, a.neckBot + 1], [c + w + 5, a.neckBot + 1], [c + w + 3, a.chin]]));
    surface(L, id === 'dragon_helm' ? 'dragon' : 'helm', S, c - w - 5, c + w + 5, t - 4, a.neckBot + 2, { lames: id === 'dragon_helm' ? null : [a.eyeY - 3, a.chin - 1], extra: g => {
      g.fillStyle = gv(12); g.fillRect(c - w + 1.5, a.eyeY - .6, w * 2 - 3, 2);
      if (id !== 'closed_helm') { g.fillStyle = gv(234); g.beginPath(); g.moveTo(c - w, a.eyeY + 3); g.lineTo(c, a.eyeY + 10); g.lineTo(c + w, a.eyeY + 3); g.lineTo(c + w, a.eyeY + 4.6); g.lineTo(c, a.eyeY + 11.6); g.lineTo(c - w, a.eyeY + 4.6); g.fill(); }
      if (id === 'closed_helm') { g.fillStyle = gv(25); for (let i = 0; i < 8; i++) g.fillRect(c - 5 + (i % 4) * 3.2, a.eyeY + 6 + Math.floor(i / 4) * 3, 1.2, 1.4); } } });
    if (id === 'closed_helm') { rivet(L, c - w, a.eyeY + 1); rivet(L, c + w, a.eyeY + 1); }
    if (id === 'dragon_helm') { for (const s of [-1, 1]) { g.fillStyle = gv(215); g.beginPath(); g.moveTo(c + s * (w - 2), t + 2); g.quadraticCurveTo(c + s * (w + 10), t - 2, c + s * (w + 12), t - 12); g.quadraticCurveTo(c + s * (w + 5), t - 3, c + s * (w + 2), t + 6); g.fill(); }
      g.fillStyle = gv(205); g.beginPath(); g.moveTo(c - 1.5, t - 2); g.lineTo(c, t - 8); g.lineTo(c + 1.5, t - 2); g.fill(); }
  }
  function drawCloak(L, a, d, part) {
    const ck = d.cloak; if (!ck) return; const g = L.g('p', LK.ramp(ck.hex, 'cloth')), c = a.cx;
    if (part === 'back') { const P = new Path2D(); P.moveTo(c - a.shX + 1, a.shY - 3); P.quadraticCurveTo(c - a.shX - 12, a.hipY, c - a.shX - 15, a.ankle + 2); P.lineTo(c + a.shX + 15, a.ankle + 2); P.quadraticCurveTo(c + a.shX + 12, a.hipY, c + a.shX - 1, a.shY - 3); P.closePath();
      paint(g, P, 92, g => { g.fillStyle = gv(0, .22); for (const x of [-30, -18, 18, 30]) { g.beginPath(); g.moveTo(c + x * .5, a.shY + 10); g.lineTo(c + x, a.ankle + 2); g.lineTo(c + x + 3, a.ankle + 2); g.fill(); } lit(g, c - a.shX - 15, c + a.shX + 15, .6); }); return; }
    // the front: the cloak lies over both shoulders and falls behind the arms; only the shoulder drape and the clasp are in front
    const S = new Shape(); for (const s of [-1, 1]) { const Q = new Path2D(); Q.moveTo(c + s * (a.neckW + 1), a.shY - 4); Q.quadraticCurveTo(c + s * (a.shX + 3), a.shY - 6, c + s * (a.shX + 7), a.shY + 5);
      Q.quadraticCurveTo(c + s * (a.shX + 8), a.shY + 11, c + s * (a.shX + 4), a.shY + 12); Q.quadraticCurveTo(c + s * (a.shX - 6), a.shY + 4, c + s * (a.neckW + 3), a.shY + 2); Q.closePath(); S.add(Q); }
    paint(g, S, 140, g => { lit(g, c - a.shX - 8, c + a.shX + 8, .8); g.fillStyle = gv(0, .25); g.fillRect(0, a.shY + 6, W, 1); });
    const b = L.g('brass', FIX.brass); for (const s of [-1, 1]) { b.fillStyle = gv(180); b.beginPath(); b.arc(c + s * (a.neckW + 3), a.shY - 1, 2.2, 0, 7); b.fill(); } b.fillStyle = gv(110); b.fillRect(c - a.neckW - 2, a.shY - 1.5, (a.neckW + 2) * 2, 1);
  }

  /* ---------------- shields (off hand) ---------------- */
  function drawShield(L, a, it, d) {
    const m = armPts(a, 1), x = m.hd[0] + 6, y = m.hd[1] - 16, id = it.id, wood = it.matKind === 'wood';
    const g = L.g('p', LK.rampFor(it.mat)); let P = new Path2D();
    if (id === 'buckler') P = ellipse(x, y + 6, 15, 15);
    else if (id === 'wooden_shield' || id === 'metal_shield') P = ellipse(x, y + 4, 22, 22);
    else if (id === 'kite_shield') { P.moveTo(x - 17, y - 22); P.quadraticCurveTo(x, y - 30, x + 17, y - 22); P.lineTo(x + 16, y + 6); P.quadraticCurveTo(x + 8, y + 28, x, y + 40); P.quadraticCurveTo(x - 8, y + 28, x - 16, y + 6); P.closePath(); }
    else { P.moveTo(x - 18, y - 20); P.lineTo(x + 18, y - 20); P.lineTo(x + 18, y + 2); P.quadraticCurveTo(x + 15, y + 22, x, y + 30); P.quadraticCurveTo(x - 15, y + 22, x - 18, y + 2); P.closePath(); }
    paint(g, P, wood ? 140 : 160, g => {
      if (wood) { g.fillStyle = gv(0, .3); for (let k = -21; k <= 22; k += 7) g.fillRect(x + k, y - 30, 1, 72); g.strokeStyle = gv(0, .18); g.lineWidth = 1; for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(x - 22 + k * 5, y - 20); g.quadraticCurveTo(x - 20 + k * 5, y + 4, x - 22 + k * 5, y + 30); g.stroke(); } }
      else { g.fillStyle = gv(238, .6); g.fillRect(x - 12, y - 30, 4, 72); }
      if (id === 'heater_shield' || id === 'kite_shield') { g.fillStyle = gv(40); g.fillRect(x - 1, y - 18, 2, 54); g.fillRect(x - 14, y - 6, 28, 2); g.fillStyle = gv(232); g.fillRect(x - 3, y - 18, 1.4, 54); }
      lit(g, x - 22, x + 22, wood ? .9 : 1.3);
      if (it.broken) { g.strokeStyle = gv(10); g.lineWidth = 1; g.beginPath(); g.moveTo(x - 8, y - 12); g.lineTo(x - 2, y); g.lineTo(x - 6, y + 10); g.stroke(); }
    });
    const fit = wood ? L.g('iron', FIX.iron) : g; fit.strokeStyle = gv(wood ? 175 : 205); fit.lineWidth = 2; fit.stroke(P);
    if (id !== 'kite_shield' && id !== 'heater_shield') { const by = y + (id === 'buckler' ? 6 : 4); fit.fillStyle = gv(150); fit.beginPath(); fit.arc(x, by, id === 'buckler' ? 5 : 6, 0, 7); fit.fill(); fit.fillStyle = gv(245); fit.fillRect(x - 3, by - 3, 2.2, 2); }
  }

  /* ---------------- weapons (main hand). Local coordinates: the grip at 0,0, the weapon's head toward −y ---------------- */
  function drawWeapon(L, a, it, d) {
    const m = armPts(a, -1), w = SF.ITEMS[it.id] && SF.ITEMS[it.id].wpn, long = ['glaive', 'spear', 'hammer', 'battleaxe'].includes(w), bow = w === 'shortbow', xb = w === 'crossbow' || w === 'heavycrossbow';
    L.at(m.hd[0], m.hd[1] - 1, bow ? -.06 : xb ? -.05 : long ? -.13 : -.42);
    const P = L.g('p', LK.rampFor(it.mat)), WD = L.g('wood', it.matKind === 'wood' ? LK.rampFor(it.mat) : FIX.wood), LE = L.g('leather', FIX.leather);
    const box = (g, x, y, ww, hh, v) => { g.fillStyle = gv(v); g.fillRect(x, y, ww, hh); };
    const shaft = (g, y0, y1, r) => { box(g, -r, y0, r * 2, y1 - y0, 140); box(g, -r, y0, r * .7, y1 - y0, 205); box(g, r * .3, y0, r * .7, y1 - y0, 85); };
    const grip = (y0, y1, r) => { box(LE, -r, y0, r * 2, y1 - y0, 140); LE.fillStyle = gv(40); for (let y = y0 + 1; y < y1; y += 2.2) LE.fillRect(-r, y, r * 2, .8); };
    const blade = (len, wd, tip) => { P.beginPath(); P.moveTo(-wd, -6); P.lineTo(-wd * .85, -len + tip); P.lineTo(0, -len); P.lineTo(wd * .85, -len + tip); P.lineTo(wd, -6); P.closePath(); P.fillStyle = gv(170); P.fill(); P.fillStyle = gv(246); P.fillRect(-wd * .85, -len + tip, wd * .55, len - tip - 6); P.fillStyle = gv(70); P.fillRect(wd * .2, -len + tip + 2, wd * .6, len - tip - 8); P.fillStyle = gv(110); P.fillRect(-.4, -len + tip, .8, len - tip - 8); };
    if (w === 'sword') { blade(84, 2.8, 8); box(P, -9, -7, 18, 2.6, 185); box(P, -9, -7, 18, 1, 245); grip(-4, 8, 1.6); P.fillStyle = gv(190); P.beginPath(); P.arc(0, 10.5, 2.6, 0, 7); P.fill(); }
    else if (w === 'dagger') { blade(30, 2.4, 6); box(P, -5.5, -7, 11, 2.2, 190); grip(-4, 6, 1.4); P.fillStyle = gv(190); P.beginPath(); P.arc(0, 8, 2, 0, 7); P.fill(); }
    else if (w === 'knife') { P.beginPath(); P.moveTo(-1.6, -5); P.quadraticCurveTo(-3.4, -16, 1, -24); P.quadraticCurveTo(3, -14, 1.8, -5); P.closePath(); P.fillStyle = gv(175); P.fill(); P.fillStyle = gv(240); P.fillRect(-1.6, -16, 1, 10); shaft(WD, -5, 7, 1.7); }
    else if (w === 'kryss') { P.beginPath(); P.moveTo(-1.6, -6); for (let k = 0; k < 11; k++) P.lineTo(k % 2 ? -2.6 : -1, -10 - k * 4); P.lineTo(0, -58); for (let k = 10; k >= 0; k--) P.lineTo(k % 2 ? 2.6 : 1, -10 - k * 4); P.lineTo(1.6, -6); P.closePath(); P.fillStyle = gv(182); P.fill(); P.fillStyle = gv(242); P.fillRect(-1, -50, .9, 42);
      P.strokeStyle = gv(190); P.lineWidth = 1.6; P.beginPath(); P.moveTo(-6, -3); P.quadraticCurveTo(0, -9, 6, -3); P.stroke(); grip(-4, 7, 1.4); P.fillStyle = gv(190); P.beginPath(); P.arc(0, 9, 2, 0, 7); P.fill(); }
    else if (w === 'mace') { shaft(WD, -38, 10, 1.6); grip(-3, 9, 1.9); P.fillStyle = gv(150); P.beginPath(); P.ellipse(0, -44, 5.2, 7, 0, 0, 7); P.fill(); for (let k = -1; k <= 1; k++) box(P, k * 4 - 1.2, -53, 2.4, 18, k ? 200 : 236); box(P, -2, -56, 4, 3, 220); box(P, -1.2, -36, 2.4, 3, 180); }
    else if (w === 'waraxe' || w === 'hatchet') { const len = w === 'hatchet' ? 40 : 54, s = w === 'hatchet' ? .78 : 1; shaft(WD, -len, 10, 1.7); grip(-3, 9, 2);
      P.beginPath(); P.moveTo(-1.5, -len + 2); P.lineTo(-10 * s, -len - 3 * s); P.quadraticCurveTo(-16 * s, -len + 7 * s, -11 * s, -len + 16 * s); P.lineTo(-1.5, -len + 10); P.closePath(); P.fillStyle = gv(165); P.fill(); P.fillStyle = gv(242); P.fillRect(-15 * s, -len + 1, 2.2, 13 * s);
      if (w === 'waraxe') { P.beginPath(); P.moveTo(1.5, -len + 3); P.lineTo(9, -len + 6); P.lineTo(1.5, -len + 9); P.closePath(); P.fillStyle = gv(140); P.fill(); } box(P, -2.2, -len - 2, 4.4, 4, 200); }
    else if (w === 'pickaxe') { shaft(WD, -46, 10, 1.8); grip(-3, 9, 2); P.beginPath(); P.moveTo(-20, -40); P.quadraticCurveTo(-8, -52, 0, -50); P.quadraticCurveTo(8, -52, 20, -40); P.quadraticCurveTo(8, -47, 0, -45); P.quadraticCurveTo(-8, -47, -20, -40); P.closePath(); P.fillStyle = gv(160); P.fill(); P.fillStyle = gv(240); P.fillRect(-12, -48, 9, 1.2); box(P, -2.6, -51, 5.2, 7, 190); }
    else if (w === 'hammer') { shaft(WD, -96, 62, 2); grip(-6, 14, 2.4); box(P, -10, -104, 20, 12, 160); box(P, -10, -104, 20, 2, 240); box(P, -10, -94, 20, 2, 70); P.beginPath(); P.moveTo(10, -101); P.lineTo(19, -98); P.lineTo(10, -95); P.closePath(); P.fillStyle = gv(150); P.fill(); box(P, -2.4, -92, 4.8, 6, 185); box(P, -2, 58, 4, 6, 150); }
    else if (w === 'battleaxe') { shaft(WD, -92, 62, 2); grip(-6, 14, 2.4); for (const s of [-1, 1]) { P.beginPath(); P.moveTo(s * 1.5, -92); P.lineTo(s * 12, -100); P.quadraticCurveTo(s * 22, -84, s * 12, -66); P.lineTo(s * 1.5, -76); P.closePath(); P.fillStyle = gv(s < 0 ? 175 : 140); P.fill(); P.fillStyle = gv(242); P.fillRect(s < 0 ? -20 : 17, -96, 2.2, 26); } box(P, -2, -102, 4, 8, 210); }
    else if (w === 'glaive') { shaft(WD, -104, 66, 1.8); grip(-6, 12, 2.2); P.beginPath(); P.moveTo(-1.5, -104); P.lineTo(-14, -112); P.quadraticCurveTo(-18, -98, -12, -86); P.lineTo(-1.5, -92); P.closePath(); P.fillStyle = gv(170); P.fill(); P.fillStyle = gv(242); P.fillRect(-17, -108, 2, 18);
      P.beginPath(); P.moveTo(-1.6, -104); P.lineTo(0, -128); P.lineTo(1.6, -104); P.closePath(); P.fillStyle = gv(200); P.fill(); P.beginPath(); P.moveTo(1.5, -102); P.lineTo(9, -96); P.lineTo(1.5, -96); P.closePath(); P.fillStyle = gv(130); P.fill(); box(P, -2.2, -92, 4.4, 5, 185); }
    else if (w === 'spear') { shaft(WD, -104, 70, 1.6); grip(-6, 12, 2); P.beginPath(); P.moveTo(0, -132); P.quadraticCurveTo(5, -118, 2, -106); P.lineTo(-2, -106); P.quadraticCurveTo(-5, -118, 0, -132); P.fillStyle = gv(175); P.fill(); P.fillStyle = gv(240); P.fillRect(-2.2, -124, 1.4, 16); P.fillStyle = gv(80); P.fillRect(.6, -122, 1, 14); box(P, -2.6, -106, 5.2, 5, 150); box(P, -5, -104, 10, 1.6, 190); }
    else if (bow) { // limbs in the bow's own wood, a leather grip, a linen string; no arrow is drawn (there is no quiver inventory)
      WD.strokeStyle = gv(150); WD.lineWidth = 3.6; WD.lineCap = 'round'; WD.beginPath(); WD.moveTo(0, -4); WD.quadraticCurveTo(-13, -34, -5, -62); WD.moveTo(0, 6); WD.quadraticCurveTo(-13, 36, -5, 64); WD.stroke();
      WD.strokeStyle = gv(232); WD.lineWidth = 1; WD.beginPath(); WD.moveTo(-1.8, -6); WD.quadraticCurveTo(-14, -34, -6.6, -60); WD.moveTo(-1.8, 8); WD.quadraticCurveTo(-14, 36, -6.6, 62); WD.stroke();
      const S = L.g('string', FIX.string); S.strokeStyle = gv(195); S.lineWidth = 1; S.beginPath(); S.moveTo(-5, -62); S.lineTo(4, 0); S.lineTo(-5, 64); S.stroke(); grip(-6, 7, 2.4); }
    else if (xb) { const hv = w === 'heavycrossbow', len = hv ? 60 : 50, pw = hv ? 28 : 22; shaft(WD, -len, 14, hv ? 3.2 : 2.6); box(WD, -3.6, 6, 7.2, 10, 120);
      const I = L.g('iron', FIX.iron); I.strokeStyle = gv(170); I.lineWidth = 2.6; I.beginPath(); I.moveTo(-pw, -len + 12); I.quadraticCurveTo(0, -len - 4, pw, -len + 12); I.stroke(); I.strokeStyle = gv(240); I.lineWidth = .9; I.beginPath(); I.moveTo(-pw + 1, -len + 10); I.quadraticCurveTo(0, -len - 5, pw - 1, -len + 10); I.stroke();
      const S = L.g('string', FIX.string); S.strokeStyle = gv(195); S.lineWidth = 1; S.beginPath(); S.moveTo(-pw, -len + 12); S.lineTo(0, -len + 22); S.lineTo(pw, -len + 12); S.stroke(); box(I, -1.6, -len + 20, 3.2, 3, 200);
      if (hv) { I.fillStyle = gv(150); I.beginPath(); I.arc(0, 18, 4.5, 0, 7); I.fill(); I.fillStyle = gv(230); I.fillRect(3, 14, 7, 2); } grip(-2, 6, 2.6); }
    if (it.broken) { P.strokeStyle = gv(10); P.lineWidth = 1; P.beginPath(); P.moveTo(-2, -30); P.lineTo(1, -34); P.lineTo(-1, -38); P.stroke(); }
    L.reset();
  }

  /* ---------------- compose ---------------- */
  const DRAW = { torso: drawChest, arms: drawArms, legs: drawLegs, feet: drawFeet, neck: drawNeck, under: drawUnder, outer: drawOuter, belt: drawBelt, jewelry: drawJewelry, head: drawHelm, off: drawShield, main: drawWeapon, hands: drawHands };
  // weapons the painter has a drawing for (every SF.WEAPONS id that an item can carry; 'unarmed' has no item)
  const WPN_DRAWN = new Set(['sword', 'dagger', 'knife', 'kryss', 'mace', 'waraxe', 'hatchet', 'pickaxe', 'hammer', 'battleaxe', 'glaive', 'spear', 'shortbow', 'crossbow', 'heavycrossbow']);
  const supports = id => { const v = LK.visualOf(id); if (!v) return false; if (v.kind === 'weapon') return WPN_DRAWN.has(v.wpn); return v.layer === 'cloak_back' || !!DRAW[v.layer]; };
  function layersOf(d) {   // the ordered drawing plan for a descriptor (what the tests inspect)
    const out = [], by = s => d.items.find(x => x.slot === s && !x.hidden);
    for (const ln of LK.ORDER) {
      if (ln === 'cloak_back' || ln === 'cloak_front') { if (d.cloak) out.push({ layer: ln, what: 'cloak.' + d.cloak.source }); continue; }
      if (ln === 'hair_back' || ln === 'hair_front') { if (d.hair.style !== 'bald' && d.hide.hair !== 'all') out.push({ layer: ln, what: 'hair.' + d.body + '.' + d.hair.style + (d.hide.hair === 'top' ? '.cut' : '') }); continue; }
      if (ln === 'body' || ln === 'face') { out.push({ layer: ln, what: ln + '.' + d.body }); continue; }
      if (ln === 'beard') { if (d.body === 'male' && d.beard.style !== 'none' && d.hide.beard !== 'none') out.push({ layer: ln, what: 'beard.male.' + d.beard.style + (d.hide.beard === 'mustache' ? '.mustache' : '') }); continue; }
      for (const it of d.items) if (!it.hidden && it.slot !== 'cloak' && LK.SLOT_LAYER[it.slot] === ln) out.push({ layer: ln, what: it.visual, slot: it.slot, drawn: supports(it.id) });
    }
    if (by('weapon')) out.push({ layer: 'fist', what: by('hands') ? 'fist.' + by('hands').id : 'fist.bare' });
    return out;
  }
  const unsupported = d => d.missing.map(x => x.id).concat(d.items.filter(x => !x.hidden && !supports(x.id)).map(x => x.id));
  function compose(d) {
    const t0 = performance.now(), a = A[d.body] || A.male, fig = mk(), fg = fig.getContext('2d'), by = s => d.items.find(x => x.slot === s && !x.hidden);
    const put = fn => { const L = new Layer(); fn(L); if (L.ch.size) fg.drawImage(bake(L), 0, 0); };
    for (const ln of LK.ORDER) {
      if (ln === 'cloak_back') put(L => drawCloak(L, a, d, 'back'));
      else if (ln === 'cloak_front') put(L => drawCloak(L, a, d, 'front'));
      else if (ln === 'hair_back') put(L => drawHair(L, a, d, 'back'));
      else if (ln === 'hair_front') put(L => drawHair(L, a, d, 'front'));
      else if (ln === 'body') put(L => drawBody(L, a, d));
      else if (ln === 'face') put(L => drawFace(L, a, d));
      else if (ln === 'beard') put(L => drawBeard(L, a, d));
      else for (const it of d.items) if (!it.hidden && it.slot !== 'cloak' && LK.SLOT_LAYER[it.slot] === ln && supports(it.id)) put(L => DRAW[ln](L, a, it, d));
    }
    // the fist closes over the grip: the fingers are drawn again after the weapon
    const wpn = by('weapon'); if (wpn && supports(wpn.id)) { const gl = by('hands'); put(L => gl ? drawHands(L, a, gl, d, [-1], true) : drawBareFist(L, a, d, -1)); }
    // the outer silhouette line
    const out = mk(), og = out.getContext('2d'), sil = mk(), sg = sil.getContext('2d'); sg.drawImage(fig, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#0e090b'; sg.fillRect(0, 0, W, H);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) og.drawImage(sil, dx, dy); og.drawImage(fig, 0, 0);
    if (d.ghost) { const id = og.getImageData(0, 0, W, H), p = id.data; for (let i = 0; i < p.length; i += 4) { if (!p[i + 3]) continue; const l = (p[i] + p[i + 1] + p[i + 2]) / 3; p[i] = l * .6 + 70; p[i + 1] = l * .75 + 90; p[i + 2] = l * .8 + 120; p[i + 3] = 165; } og.putImageData(id, 0, 0); }
    const big = mk(LK.CANVAS.w, LK.CANVAS.h), bg = big.getContext('2d'); bg.imageSmoothingEnabled = false; bg.drawImage(out, 0, 0, W * SC, H * SC);
    stats.renders++; stats.ms = Math.round((performance.now() - t0) * 10) / 10; return big;
  }
  /* render(descriptor) → a 384×512 canvas, cached by the descriptor key (bounded, least recently used out first) */
  function render(d) {
    let c = CACHE.get(d.key); if (c) { stats.hits++; CACHE.delete(d.key); CACHE.set(d.key, c); return c; }
    c = compose(d); CACHE.set(d.key, c); while (CACHE.size > CACHE_MAX) { const k = CACHE.keys().next().value; CACHE.delete(k); URLS.delete(k); } return c;
  }
  function dataURL(d) { const u = URLS.get(d.key); if (u && CACHE.has(d.key)) return u; const v = render(d).toDataURL(); URLS.set(d.key, v); return v; }
  /* drawTo(canvas, descriptor): the whole figure, scaled to fit, feet on the bottom edge, hard pixels */
  function drawTo(cv, d) { const src = render(d), g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false;
    const k = Math.min(cv.width / src.width, cv.height / src.height), w = Math.round(src.width * k), h = Math.round(src.height * k); g.drawImage(src, Math.round((cv.width - w) / 2), cv.height - h, w, h); }
  return { render, dataURL, drawTo, layersOf, supports, unsupported, stats, cacheSize: () => CACHE.size, ANCHORS: A, WPN_DRAWN };
})();
if (window.__SF) Object.assign(window.__SF, { PDOLL });
