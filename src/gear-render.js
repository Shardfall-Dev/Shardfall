/* ================= GEAR RENDER (v0.32): the layered equipment renderer =================
   One appearance (SF.GEAR.resolve: the actual equipment, its materials and the occlusion rules) drives four views:
   - the paper doll: a fitted male or female body with the painted Medieval Equipment Art v1 pieces on it, each recoloured per
     material channel through its mask (luminance-preserving ramps; never a filter over the whole figure);
   - the world sprite: the layered human rig (src/human-rig.js), every piece drawn on its own moving segment in every frame of
     every animation and direction, so gear follows walking, combat, casting and death;
   - NPCs: the same rig with their real equipment, or a cosmetic preset of real item ids when they carry none;
   - corpses: a frozen snapshot taken at death, drawn in the death and corpse poses.
   Caches: recoloured pieces (bounded), composed paper dolls (by appearance key) and world strips (one canvas per appearance ×
   animation × direction, bounded by pixel count, least recently used out). A frame spends at most ~4 ms building strips; everything
   else is drawn from the cache. While a strip is not ready, the previous renderer draws the actor (the fallback).
   The previous renderer stays the default until the new art passes review: turn this on with the paper doll's "New art"
   button or ?gear=new (and force it off with ?gear=old). */
const GEARV = { q: null };
try { const v = new URLSearchParams(location.search).get('gear'); if (v === 'new' || v === 'old') GEARV.q = v; } catch (_) { }
function gearOn() { return GEARV.q ? GEARV.q === 'new' : !!SETTINGS.gearArt; }
function setGearArt(on) { GEARV.q = null; SETTINGS.gearArt = !!on; saveSettings(); GR.strips.clear(); GR.px = 0; DOLLG.key = ''; if (typeof renderEqWin === 'function') renderEqWin(true); if (PANEL === 'bag' || PANEL === 'gear') renderPanel(); }
const GEAR = SF.GEAR, RIG = globalThis.HUMAN_RIG;

/* ---------------- painted pieces: the atlas, its masks and per-channel recolouring ---------------- */
const GA = { ready: false, art: null, mask: null, ref: new Map(), out: new Map(), url: new Map() };
{ let n = 0; const load = (src, k) => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); GA[k] = g.getImageData(0, 0, c.width, c.height); if (++n === 2) { GA.ready = true; DOLLG.key = ''; if (SETTINGS.eqOpen && gearOn() && typeof renderEqWin === 'function') renderEqWin(true); } }; im.onerror = () => console.warn('equipment art failed to load:', k); im.src = src; };
  load(GEAR_ART.art, 'art'); load(GEAR_ART.mask, 'mask'); }
const hexRgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/* the mean brightness of a piece's primary and secondary pixels: a material colour lands on that mean, and the painted light and
   shade around it are kept (so a valorite plate still shows its rivets, edges and highlights) */
function gaRef(id) {
  let r = GA.ref.get(id); if (r) return r; const [x0, y0, w, h] = GEAR_ART.rect[id], W = GEAR_ART.w, A = GA.art.data, M = GA.mask.data;
  let p = 0, pw = 0, s = 0, sw = 0, a = 0, an = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = ((y0 + y) * W + x0 + x) * 4; if (!A[i + 3]) continue; const L = .299 * A[i] + .587 * A[i + 1] + .114 * A[i + 2], wp = M[i] / 255, ws = M[i + 1] / 255; p += L * wp; pw += wp; s += L * ws; sw += ws; a += L; an++; }
  r = { p: pw ? p / pw : 128, s: sw ? s / sw : 128, a: an ? a / an : 128 }; GA.ref.set(id, r); return r;
}
const tone = (c, t) => t > 1 ? c + (255 - c) * Math.min(1, (t - 1) * .55) : c * t;
/* gaPaint(id, ph, sh) → the piece with its primary channel in ph and secondary in sh (null keeps the painted colour);
   gaPaint(id, null, null, fill) → the piece's silhouette in one colour, softly shaded (the paper doll body) */
function gaPaint(id, ph, sh, fill, open) {
  const key = id + '|' + (ph || '') + '|' + (sh || '') + '|' + (fill || '') + (open ? '|o' : ''); let c = GA.out.get(key); if (c) return c;
  if (!GA.ready || !GEAR_ART.rect[id]) return null;
  const [x0, y0, w, h] = GEAR_ART.rect[id], W = GEAR_ART.w, A = GA.art.data, M = GA.mask.data, ref = gaRef(id);
  c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), d = g.createImageData(w, h), o = d.data;
  const P = ph && hexRgb(ph), S = sh && hexRgb(sh), F = fill && hexRgb(fill);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((y0 + y) * W + x0 + x) * 4, j = (y * w + x) * 4, al = A[i + 3]; if (!al) continue;
    const R = A[i], G = A[i + 1], B = A[i + 2], L = .299 * R + .587 * G + .114 * B; o[j + 3] = al;
    // open-faced helmets and caps: the painted dark interior is cut away so the wearer's face shows through
    if (open && L < 58 && ((x / w - .5) / .3) ** 2 + ((y / h - .64) / .3) ** 2 < 1) { o[j + 3] = 0; continue; }
    if (F) { const k = .62 + .38 * L / ref.a; o[j] = tone(F[0], k); o[j + 1] = tone(F[1], k); o[j + 2] = tone(F[2], k); continue; }
    let wp = P ? M[i] / 255 : 0, ws = S ? M[i + 1] / 255 : 0; const sum = wp + ws; if (sum > 1) { wp /= sum; ws /= sum; } const wf = 1 - wp - ws;
    const tp = L / ref.p, ts = L / ref.s;
    o[j] = R * wf + (P ? tone(P[0], tp) * wp : 0) + (S ? tone(S[0], ts) * ws : 0);
    o[j + 1] = G * wf + (P ? tone(P[1], tp) * wp : 0) + (S ? tone(S[1], ts) * ws : 0);
    o[j + 2] = B * wf + (P ? tone(P[2], tp) * wp : 0) + (S ? tone(S[2], ts) * ws : 0);
  }
  g.putImageData(d, 0, 0); if (GA.out.size > 360) GA.out.delete(GA.out.keys().next().value); GA.out.set(key, c); return c;
}
/* the colour a painted channel takes for an equipped piece: null where the art already shows that material (iron, regular
   leather, pine) so the approved painting is kept exactly; cloth always takes the wearer's clothing or cloak colour */
function artHex(kind, pc) {
  if (!kind || kind === 'fixed' || !pc) return null; if (kind === 'cloth') return pc.hex.cloth || null;
  const m = pc.mats[kind]; if (!m || m === GEAR.DEFAULT[kind]) return null; return pc.hex[kind] || null;
}
function pieceCanvas(pc, artId, open) { const a = artId || pc.art, it = a && GEAR_ART.item[a]; if (!it) return null; return gaPaint(a, artHex(it.prim, pc), artHex(it.sec, pc), null, open); }
/* backpack and slot icons: an item with no painted icon of its own shows its piece of the new art (when the new art is on) */
function gearIconUrl(it) {
  if (!GA.ready || !gearOn()) return null; const d = SF.ITEMS[it.id]; if (!d) return null; const pc = GEAR.piece(d.slot || 'weapon', it, P && P.look); if (!pc || !pc.art) return null;
  const c = pieceCanvas(pc); if (!c) return null; const key = pc.art + '|' + ['metal', 'wood', 'hide', 'cloth'].map(k => pc.hex[k] || '').join(','); let u = GA.url.get(key); if (u) return u;
  const s = 64, o = document.createElement('canvas'); o.width = s; o.height = s; const g = o.getContext('2d'), k = Math.min((s - 4) / c.width, (s - 4) / c.height); g.imageSmoothingQuality = 'high';
  g.drawImage(c, Math.round((s - c.width * k) / 2), Math.round((s - c.height * k) / 2), Math.round(c.width * k), Math.round(c.height * k)); u = o.toDataURL(); if (GA.url.size > 200) GA.url.clear(); GA.url.set(key, u); return u;
}

/* ---------------- the paper doll ----------------
   Layout in the art's own units (the master sheet's pixels; the embedded atlas is GEAR_ART.scale of that). Origin: centre line,
   top of the head. The body's arms, hands, legs, feet and shirt are the silhouettes of the leather pieces, so every armor piece
   lands on the body it was painted for. Female bodies are narrower in the shoulders and arms and keep the same anchors. */
const DOLL_FIT = {
  male:   { sx: { chest: 1, arms: 1, hands: 1, legs: 1, feet: 1, robe: 1, cloak: 1, belt: 1, head: 1 }, head: { cy: 48, rx: 31, ry: 39 } },
  female: { sx: { chest: .9, arms: .9, hands: .88, legs: .95, feet: .92, robe: .93, cloak: .92, belt: .88, head: .94 }, head: { cy: 50, rx: 28.5, ry: 37 } } };
const DOLLG = { key: '', url: '', canvas: null, W: 210, H: 292, K: GEAR_ART.scale };
const DOLL_PLACE = { // anchor (cx, and top / bottom / cy) and height in art units; width follows the piece's aspect × the body's sx
  cloak: { top: 82, h: 362 }, legs: { top: 236 }, feet: { bottom: 470 }, chest: { top: 93 }, arms: { top: 104 }, hands: { top: 216 },
  belt: { cy: 233 }, robe: { top: 88, h: 352 }, helm: { bottom: 98 }, coif: { bottom: 110 } };
function dollPut(g, c, slot, sx, o) {
  if (!c) return; const K = DOLLG.K, aw = c.width / K, ah = c.height / K, pl = Object.assign({}, DOLL_PLACE[slot] || {}, o || {});
  const h = pl.h || ah, w = aw * (h / ah) * (sx || 1), cx = pl.cx || 0;
  const top = pl.top !== undefined ? pl.top : pl.bottom !== undefined ? pl.bottom - h : (pl.cy || 0) - h / 2;
  const X = DOLLG.W / 2 + (cx - w / 2) * K, Y = 4 + top * K;
  g.save(); if (pl.flip) { g.translate(X + w * K, Y); g.scale(-1, 1); g.drawImage(c, 0, 0, w * K, h * K); } else g.drawImage(c, X, Y, w * K, h * K); g.restore();
}
function lookHexes(look) {
  const C = SF.CREATION, L = look || {}, f = (list, id, d) => ((C[list] || []).find(x => x.id === id) || {}).hex || d;
  return { skin: f('SKIN', L.skinTone, '#d0a080'), hair: f('HAIR_COLORS', L.hairColor, '#3b2618'), beard: f('HAIR_COLORS', L.facialHairColor, '#3b2618'), cloth: GEAR.clothHex(L), style: L.hairStyle || 'short', fh: L.facialHairStyle || 'none' };
}
function dollHead(g, R, look, back) {
  const fit = DOLL_FIT[R.body].head, H = lookHexes(look), K = DOLLG.K, cx = DOLLG.W / 2, cy = 4 + fit.cy * K, rx = fit.rx * K, ry = fit.ry * K, occ = R.occ, hairMode = occ.hair;
  const shade = (hx, k) => { const c = hexRgb(hx); return `rgb(${c.map(v => Math.max(0, Math.min(255, Math.round(v * k)))).join(',')})`; };
  const ell = (x, y, a, b, col, rot) => { g.beginPath(); g.ellipse(x, y, a, b, rot || 0, 0, Math.PI * 2); g.fillStyle = col; g.fill(); };
  const style = R.body === 'female' && ['receding', 'mohawk'].includes(H.style) ? 'short' : H.style;
  if (back) {   // long hair, ponytails and pigtails hang behind the shoulders
    if (hairMode !== 'all' || style === 'bald') return;
    if (style === 'long' || style === 'pageboy') { g.fillStyle = shade(H.hair, .8); g.beginPath(); g.ellipse(cx, cy + ry * .55, rx * 1.12, ry * (style === 'long' ? 1.3 : .95), 0, 0, Math.PI * 2); g.fill(); }
    if (style === 'ponytail') { ell(cx + rx * .7, cy + ry * .5, rx * .28, ry * .75, shade(H.hair, .8), -.25); }
    if (style === 'pigtails') { ell(cx - rx * 1.05, cy + ry * .75, rx * .26, ry * .7, H.hair); ell(cx + rx * 1.05, cy + ry * .75, rx * .26, ry * .7, H.hair); }
    return;
  }
  // neck and head (a soft painted look to sit with the art)
  g.fillStyle = shade(H.skin, .86); g.fillRect(cx - 13 * K, cy + ry * .55, 26 * K, 28 * K);
  const gr = g.createRadialGradient(cx - rx * .3, cy - ry * .25, rx * .2, cx, cy, ry * 1.1); gr.addColorStop(0, shade(H.skin, 1.12)); gr.addColorStop(1, shade(H.skin, .78));
  ell(cx, cy, rx, ry, gr); ell(cx - rx * .98, cy + 2, rx * .16, ry * .2, shade(H.skin, .85)); ell(cx + rx * .98, cy + 2, rx * .16, ry * .2, shade(H.skin, .85));
  if (occ.face !== false) {
    for (const s of [-1, 1]) { ell(cx + s * rx * .38, cy + ry * .02, rx * .14, ry * .07, '#f4efe6'); ell(cx + s * rx * .38, cy + ry * .02, rx * .08, ry * .07, '#2a1c14'); g.fillStyle = shade(H.hair, .9); g.fillRect(cx + s * rx * .38 - rx * .2, cy - ry * .17, rx * .4, ry * .06); }
    g.fillStyle = shade(H.skin, .72); g.fillRect(cx - rx * .06, cy + ry * .1, rx * .12, ry * .22); g.fillStyle = shade(H.skin, .55); g.fillRect(cx - rx * .25, cy + ry * .5, rx * .5, ry * .05);
    if (R.body === 'male' && H.fh !== 'none') { const bd = H.beard;
      if (H.fh === 'mustache' || H.fh === 'vandyke') { g.fillStyle = bd; g.fillRect(cx - rx * .35, cy + ry * .4, rx * .7, ry * .08); }
      if (H.fh === 'goatee' || H.fh === 'vandyke') ell(cx, cy + ry * .78, rx * .2, ry * .2, bd);
      if (H.fh === 'short') { g.beginPath(); g.ellipse(cx, cy + ry * .45, rx * .9, ry * .55, 0, 0, Math.PI); g.fillStyle = bd; g.fill(); g.fillStyle = shade(H.skin, .55); g.fillRect(cx - rx * .25, cy + ry * .5, rx * .5, ry * .05); }
      if (H.fh === 'long') { g.beginPath(); g.ellipse(cx, cy + ry * .45, rx * .9, ry * .95, 0, 0, Math.PI); g.fillStyle = bd; g.fill(); } }
  }
  if (hairMode === 'none' || style === 'bald') return;
  const hc = H.hair, top = () => { g.beginPath(); g.ellipse(cx, cy - ry * .32, rx * 1.04, ry * .72, 0, Math.PI, Math.PI * 2); g.fillStyle = hc; g.fill(); g.fillRect(cx - rx * 1.04, cy - ry * .34, rx * .22, ry * .45); g.fillRect(cx + rx * .82, cy - ry * .34, rx * .22, ry * .45); };
  if (style === 'receding') { g.fillStyle = hc; g.fillRect(cx - rx * 1.02, cy - ry * .45, rx * .25, ry * .55); g.fillRect(cx + rx * .77, cy - ry * .45, rx * .25, ry * .55); return; }
  if (style === 'mohawk') { g.fillStyle = hc; g.fillRect(cx - rx * .18, cy - ry * 1.18, rx * .36, ry * .8); return; }
  top();
  if (hairMode !== 'all') return;
  if (style === 'long' || style === 'pageboy') { g.fillStyle = hc; g.fillRect(cx - rx * 1.06, cy - ry * .35, rx * .26, ry * (style === 'long' ? 1.2 : .9)); g.fillRect(cx + rx * .8, cy - ry * .35, rx * .26, ry * (style === 'long' ? 1.2 : .9)); }
  if (style === 'buns') { ell(cx - rx * .85, cy - ry * .85, rx * .3, rx * .3, hc); ell(cx + rx * .85, cy - ry * .85, rx * .3, rx * .3, hc); }
}
/* the doll for a character: body, then each slot back to front, with the same occlusion as the world sprite */
function gearDoll(ch) {
  if (!GA.ready || !ch || ch.ghost) return null;
  const R = GEAR.ofChar(ch), key = R.key; if (key === DOLLG.key && DOLLG.canvas) return DOLLG;
  const c = document.createElement('canvas'); c.width = DOLLG.W; c.height = DOLLG.H; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
  const F = DOLL_FIT[R.body].sx, S = R.slots, H = lookHexes(ch.look), skinOf = id => gaPaint(id, null, null, H.skin), occ = R.occ;
  if (S.cloak) dollPut(g, pieceCanvas(S.cloak), 'cloak', F.cloak);
  dollHead(g, R, ch.look, true);
  // the body: shoes, trousers, bare arms and hands, an undyed shirt in the chosen clothing colour
  dollPut(g, gaPaint('leather_leggings', null, null, S.trousers ? S.trousers.color : '#4a3a2b'), 'legs', F.legs);
  dollPut(g, gaPaint('boots', null, null, '#4a3524'), 'feet', F.feet);
  dollPut(g, skinOf('leather_sleeves'), 'arms', F.arms);
  dollPut(g, gaPaint('leather_tunic', null, null, S.shirt ? S.shirt.color : H.cloth), 'chest', F.chest);
  dollPut(g, skinOf('leather_gloves'), 'hands', F.hands);
  dollHead(g, R, ch.look, false);
  // equipment
  if (S.legs) dollPut(g, pieceCanvas(S.legs), 'legs', F.legs);
  if (S.feet) dollPut(g, pieceCanvas(S.feet), 'feet', F.feet);
  if (S.chest) dollPut(g, pieceCanvas(S.chest), 'chest', F.chest);
  if (S.arms) dollPut(g, pieceCanvas(S.arms), 'arms', F.arms);
  if (S.robe) dollPut(g, pieceCanvas(S.robe), 'robe', F.robe);
  if (S.hands) dollPut(g, pieceCanvas(S.hands), 'hands', F.hands);
  if (S.belt) dollPut(g, pieceCanvas(S.belt), 'belt', F.belt);
  if (S.head && S.head.art) dollPut(g, pieceCanvas(S.head, null, occ.face !== false), S.head.id === 'chain_coif' ? 'coif' : 'helm', F.head);
  // weapon in the right hand (the viewer's left), shield on the left arm; a two-handed weapon leaves no off hand
  const W = S.weapon; if (W && W.art) { const wc = pieceCanvas(W); if (wc) { const ah = wc.height / DOLLG.K, h = W.art === 'crossbow' ? 120 : Math.min(250, ah * 1.35); dollPut(g, wc, 'weapon', 1, W.art === 'crossbow' ? { cx: -78, cy: 262, h } : { cx: -96, top: 262 - h * .62, h, flip: true }); } }
  if (S.shield && S.shield.art && occ.offhand) dollPut(g, pieceCanvas(S.shield), 'shield', 1, { cx: 96, cy: 248, h: S.shield.art === 'heater_shield' || S.shield.art === 'kite_shield' ? 172 : 140 });
  Object.assign(DOLLG, { key, canvas: c, url: '' }); return DOLLG;
}
function gearDollSrc(ch) { const d = gearDoll(ch); if (!d) return null; if (!d.url) d.url = d.canvas.toDataURL(); return d.url; }

/* ---------------- world sprites: the layered rig ---------------- */
const GR = { strips: new Map(), px: 0, MAX_PX: 12e6, frame: -1, budget: 0, stats: { built: 0, hits: 0, waits: 0, evicted: 0, ms: 0 }, S: 1.22 };
const WEAPON_RIG = GEAR.WEAPON_RIG;
function rigLook(look) { const H = lookHexes(look); return { skin: H.skin, hair: H.hair, beardHex: H.beard, cloth: H.cloth, style: H.style, beard: H.fh }; }
/* a cached strip: one animation in one direction for one appearance. Builds within the frame's budget (the player is never kept
   waiting); returns null while waiting so the caller can draw something already cached. */
function grStrip(A, action, dir, ghost, urgent) {
  const key = A.R.key + '#' + action + '#' + dir + (ghost ? '#g' : ''); let s = GR.strips.get(key);
  if (s) { GR.strips.delete(key); GR.strips.set(key, s); GR.stats.hits++; return s; }
  // a frame spends at most ~4 ms building (about three strips); the player and corpses are never kept waiting
  if (GR.frame !== GT) { GR.frame = GT; GR.budget = 4; }
  if (GR.budget <= 0 && !urgent) { GR.stats.waits++; return null; }
  const t0 = performance.now(), n = RIG.ANIMATIONS[action], W = RIG.CELL.width, Hh = RIG.CELL.height;
  s = document.createElement('canvas'); s.width = n * W; s.height = Hh; const g = s.getContext('2d');
  const o = Object.assign({ gear: A.R, dir, action, weaponRig: WEAPON_RIG }, A.rl);
  for (let f = 0; f < n; f++) RIG.drawOps(g, RIG.frameOps(Object.assign(o, { frame: f })), f * W, 0);
  if (ghost) { const d = g.getImageData(0, 0, s.width, s.height), a = d.data; for (let i = 0; i < a.length; i += 4) { if (!a[i + 3]) continue; const l = (a[i] + a[i + 1] + a[i + 2]) / 3; a[i] = l * .7 + 60; a[i + 1] = l * .8 + 80; a[i + 2] = l + 110; a[i + 3] = 150; } g.putImageData(d, 0, 0); }
  const dt = performance.now() - t0; GR.budget -= Math.max(.5, dt);
  GR.strips.set(key, s); GR.px += s.width * s.height; GR.stats.built++; GR.stats.ms += dt;
  while (GR.px > GR.MAX_PX && GR.strips.size > 1) { const [k0, c0] = GR.strips.entries().next().value; GR.strips.delete(k0); GR.px -= c0.width * c0.height; GR.stats.evicted++; }
  return s;
}
/* what an actor wears: the player and Wren their real equipment; townsfolk, guards and human enemies a cosmetic preset */
const NPC_PRESET_OF = { traveller: 'villager', assay: 'banker', qsmith: 'qsmith', banker: 'banker', smith: 'smith', trainer: 'trainer', workshop: 'smith', apothecary: 'apothecary', provisioner: 'villager',
  guard: 'guard', healer: 'healer', outlaw: 'outlaw', student: 'student', fisher: 'villager', dockhand: 'villager', townsfolk: 'villager', miner: 'miner', woodcutter: 'woodcutter', trader: 'banker', weaver: 'villager',
  smuggler: 'smuggler', captain: 'captain' };
/* NPC wardrobe & faction appearance (#39, src/wardrobe.js SF.WARDROBE) on the layered renderer: the wardrobe decides what a
   townsperson, guard or human enemy wears (regional guard uniforms by rank, role recipes with palettes, activity states, hostile
   variants); SF.GEAR draws it. Cosmetic only: nothing here is an item anyone owns, drops or can loot. */
const WD = { roster: null };
const WD_SKIN = { fair: 'porcelain', tan: 'tan', olive: 'olive', brown: 'brown', deep: 'deep', drowned: 'olive' };
const WD_STYLE = { male: { cropped: 'short', parted: 'pageboy', bun: 'short', braid: 'ponytail' }, female: { cropped: 'short', parted: 'pageboy', bun: 'buns', braid: 'pigtails' } };
const WD_BEARD = { stubble: 'mustache', full: 'long' };
function wdRoster() {   // guard rank by placement order within a region (population is deterministic, so this is stable across loads)
  if (WD.roster) return WD.roster; const R = new Map(), n = {};
  for (const e of ents) if (e.kind === 'npc' && e.role === 'guard') { const reg = SF.WARDROBE.regionOf(e, zoneAt(Math.floor(e.x), Math.floor(e.y))) || '-'; R.set(e, n[reg] = (n[reg] ?? -1) + 1); }
  return WD.roster = R;
}
function wdCtx(e) { const L = e.life; return { zone: zoneAt(Math.floor(e.home ? e.home.x : e.x), Math.floor(e.home ? e.home.y : e.y)), rosterIndex: wdRoster().get(e) || 0, night: typeof lifeNight === 'function' && lifeNight(), watch: !!(L && L.goal && L.goal.act === 'watch') }; }
function wdLook(D) {
  const body = D.body === 'female' ? 'female' : 'male', hc = D.hair === 'darkBrown' ? 'darkbrown' : D.hair;
  return { body, skinTone: WD_SKIN[D.skin] || 'light', hairStyle: (WD_STYLE[body][D.style]) || D.style || 'short', hairColor: hc || 'brown', facialHairStyle: body === 'male' ? (WD_BEARD[D.beard] || D.beard || 'none') : 'none',
    facialHairColor: hc || 'brown', clothingColor: 'oatmeal', cloak: 'none', clothHex: D.palette && D.palette.p, cloakHex: D.palette && (D.palette.a || D.palette.p) };
}
function wdEquip(D) {
  const eq = {};
  for (const s in D.pieces) { const p = D.pieces[s]; if (!EQ.SLOT[s] || !SF.ITEMS[p.id]) continue; eq[s] = { id: p.id, uid: 'npc', material: p.material && p.material !== 'cloth' && !SF.ITEMS[p.id].fixedMat ? p.material : undefined, sec: p.sec || undefined, dye: p.dye || undefined }; }
  if (D.weapon && SF.ITEMS[D.weapon.id]) eq.weapon = { id: D.weapon.id, uid: 'npc', material: D.weapon.material || undefined };
  if (D.shield && SF.ITEMS[D.shield.id] && !(eq.weapon && GEAR.twoHanded(eq.weapon))) eq.shield = { id: D.shield.id, uid: 'npc', material: D.shield.material || undefined };
  return eq;
}
/* the wardrobe's choice for a non-equipment actor, re-checked twice a second (activity changes slowly); null → the GEAR preset */
function wdAppearance(e) {
  if (!SF.WARDROBE || !e.actorId) return null;
  if (e._wdA !== undefined && GT - (e._wdT || 0) < .5) return e._wdA; e._wdT = GT;
  const c = wdCtx(e), sig = SF.WARDROBE.outfitState(e, c) + '|' + (c.night && c.watch ? 'w' : '');
  if (e._wdA !== undefined && e._wdSig === sig) return e._wdA;
  const D = SF.WARDROBE.resolve(e, c); e._wdSig = sig; e._wdD = D;
  if (!D || D.source === 'equip') return e._wdA = null;
  const look = wdLook(D), equip = wdEquip(D); return e._wdA = { R: GEAR.resolve(equip, look), rl: rigLook(look), preset: true, equip, look, wardrobe: D.role + (D.rank ? '/' + D.rank : '') + (D.region ? '@' + D.region : '') };
}
function gearOfActor(e) {
  const ghost = !!((e === P && P.ghost) || (e.kind === 'ally' && e.ghost));
  if (e.kind === 'player' || e.kind === 'remote' || (e.kind === 'ally' && e.equip)) {
    if (e.kind === 'ally' && !e._gLook) e._gLook = GEAR.npcLook(e.aid || e.name, { body: 'female', cloth: 'forest' });
    const look = e.kind === 'player' || e.kind === 'remote' ? e.look : e._gLook, sig = EQ.signature(e) + '|' + (SF.CREATION ? SF.CREATION.lookKey(look) : '');
    if (e._gSig !== sig) { e._gSig = sig; e._gA = { R: GEAR.resolve(e.equip, look), rl: rigLook(look) }; }
    return Object.assign(e._gA, { ghost });
  }
  const wd = e.kind === 'npc' || e.kind === 'mon' ? wdAppearance(e) : null; if (wd) return Object.assign(wd, { ghost });
  if (!e._gA) { const role = e.kind === 'mon' ? e.type : (e.role || (e.life && e.life.prof) || 'villager'), pre = GEAR.PRESETS[NPC_PRESET_OF[role] || 'villager'] || GEAR.PRESETS.villager;
    const look = GEAR.npcLook(e.aid || e.sid || e.name || e.id, role === 'guard' ? { cloth: 'navy' } : null), equip = pre(); e._gA = { R: GEAR.resolve(equip, look), rl: rigLook(look), preset: true, equip, look }; }
  return Object.assign(e._gA, { ghost });
}
/* the simulation's state → rig animation and frame (visual only: timings stay with combat, casting and gathering) */
function gearPose(e, A) {
  const wid = GEAR.wpnId(A.R.slots.weapon ? { id: A.R.slots.weapon.id } : null) || 'unarmed', atk = GEAR.attackAnim(wid), seed = (e.id || 0) * .37;
  if (e === P) {
    if (P.ghost) return [P.speed > .3 ? 'walk' : 'idle', P.speed > .3 ? Math.floor(GT * 12) % 8 : 0];
    if (P.bandage) return ['bandage', Math.floor(GT * 8) % 8];
    if (P.task && P.task.kind === 'gather' && P.task.node) { const sk = P.task.node.skill, a = sk === 'mining' ? 'mine' : sk === 'fishing' ? 'fish' : /wood|lumber/.test(sk) ? 'chopwood' : null; if (a) return [a, Math.floor(GT * 9) % 8]; }
    const [k, f] = playerClip(); return GEAR.fromClip(k, f, wid, P.speed);
  }
  if (e.kind === 'mon') { if (e.state === 'tele') return [atk, 2]; if (e.state === 'strike' || (e.state === 'rec' && GT - (e.st || 0) < .25)) return [atk, 5]; if (e.hitT && GT - e.hitT < .16) return ['hit', 1]; }
  if (e.lunge) return [atk, Math.min(7, Math.floor(e.lunge * 8))];
  if (e.speed > .3) { const a = e.speed > 5.6 ? 'run' : 'walk'; return [a, Math.floor(GT * 12 + seed * 8) % 8]; }
  if (e.foe || (e.kind === 'mon' && e.target)) return ['ready', 0];
  return ['idle', Math.floor(GT * 2 + seed) % 4];
}
function grDraw(g, strip, f, x, y, ox, oy) { const S = GR.S, W = RIG.CELL.width, H = RIG.CELL.height; g.imageSmoothingEnabled = false; g.drawImage(strip, f * W, 0, W, H, Math.round(x - RIG.CELL.anchorX * S + (ox || 0)), Math.round(y - RIG.CELL.anchorY * S + (oy || 0)), Math.round(W * S), Math.round(H * S)); }
/* draw a human actor with the layered renderer; false → the caller draws the previous sprite (flag off, or the strip is not ready) */
function drawGearActor(g, e, x, y) {
  if (!gearOn() || !RIG) return false;
  if (!(e.kind === 'player' || e.kind === 'remote' || e.kind === 'ally' || e.kind === 'npc' || (e.kind === 'mon' && MON[e.type] && MON[e.type].scout))) return false;
  const A = gearOfActor(e), [act, f] = gearPose(e, A), dir = e.sect || 0;
  let strip = grStrip(A, act, dir, A.ghost, e === P), fr = f;
  if (!strip) { strip = GR.strips.get(A.R.key + '#idle#' + dir + (A.ghost ? '#g' : '')); fr = 0; }
  if (!strip) return false;
  if (e.kind === 'ally' && e.ghost) g.globalAlpha = .75;
  grDraw(g, strip, fr, x, y); return true;
}
/* corpses keep their owner's look: the snapshot taken at death, falling in the death animation, then lying still */
function gearSnapOf(e) {
  if (e === P || e.kind === 'ally') return GEAR.snapshot(e.kind === 'ally' ? { equip: e.equip, look: e._gLook || GEAR.npcLook(e.aid || e.name, { body: 'female', cloth: 'forest' }) } : e);
  if (e.kind === 'npc' || (e.kind === 'mon' && MON[e.type] && MON[e.type].scout)) { const A = gearOfActor(e); return GEAR.snapshot({ equip: A.equip, look: A.look }); }
  return null;
}
function drawGearCorpse(e) {
  if (!gearOn() || !e.gear || !RIG) return false; const g = ctx, x = SX(e.x, e.y), y = SY(e.x, e.y);
  if (!e._gA || e._gA.R !== e.gear) e._gA = { R: e.gear, rl: rigLook(e.gear.look) };
  const age = GT - (e.t0 || -9), dying = age >= 0 && age < .6, act = dying ? 'death' : 'corpse', f = dying ? Math.min(7, Math.floor(age / .6 * 8)) : 0;
  const strip = grStrip(e._gA, act, e.sect || 0, false, true); if (!strip) return false;
  g.fillStyle = 'rgba(120,0,0,.3)'; g.beginPath(); g.ellipse(x + 2, y + 2, 16, 6, 0, 0, 7); g.fill(); grDraw(g, strip, f, x, y);
  if (e.cont && e.cont.items.length && !e.mine) { const tw = (Math.sin(GT * 5 + e.x) + 1) / 2; g.fillStyle = `rgba(255,224,120,${.4 + .6 * tw})`; g.fillRect(Math.round(x + 9), Math.round(y - 12), 2, 2); }
  return true;
}
/* test and developer access */
globalThis.__GEAR = { on: gearOn, set: setGearArt, doll: gearDoll, dollSrc: gearDollSrc, of: gearOfActor, pose: gearPose, strips: GR, art: GA, iconUrl: gearIconUrl, snap: gearSnapOf };
