/* Shardfall world collision — the walkable-ground rules of src/game.js canStand / moveBy as a pure module, so the game server
   and the online client (prediction) move characters by exactly the same rules. UMD: CommonJS in node, SF_COLLISION in the
   browser (build.sh puts it into the game). No DOM, no timers, no randomness.
   The world it works on is the game's own: the server loads it from server/data/world-*.bin, which tools/export-world.py
   exports from the built game; the online client builds it from the live map. tools/export-world.py also checks, on many
   thousands of points, that canStand here answers exactly as the game's canStand does (with every door open).
   Rules (game.js v0.36, players): a 0.26-tile body; blocked by wall / prop rectangles (ECOL) the body overlaps; by a blocking
   tile (BLK) under any body corner unless the tile is "soft" (trees, rock faces, reeds: only their trunk or boulder blocks);
   and by a soft tile's trunk square (half-size SOFT[t]) within reach. Doors are open and magic fields absent online (v1). */
(function (root, factory) {
  const C = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = C; else root.SF_COLLISION = C;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const C = {};
  C.FORMAT = 1;
  C.BODY = 0.26;     // the game's player radius (canStand)
  C.WATER = 2;       // T.WA: outside the map is water (tAt)

  /* makeWorld({ W, H, tiles, blk, soft, rects }) → a world. rects: [[x0, y0, x1, y1], …] bucketed per tile exactly as addCol does */
  C.makeWorld = function (o) {
    if (!(o.tiles instanceof Uint8Array) || o.tiles.length !== o.W * o.H) throw new Error('tiles must be a Uint8Array of W×H');
    const blk = new Uint8Array(64), soft = new Float32Array(64);
    for (let i = 0; i < 64; i++) { blk[i] = o.blk[i] ? 1 : 0; soft[i] = o.soft[i] || 0; }
    const ecol = new Map(), W = o.W;
    for (const r of o.rects) {
      for (let y = Math.floor(r[1] - .5); y <= Math.floor(r[3] + .5); y++) for (let x = Math.floor(r[0] - .5); x <= Math.floor(r[2] + .5); x++) {
        const k = y * W + x; let a = ecol.get(k); if (!a) ecol.set(k, a = []); a.push(r);
      }
    }
    return { W: o.W, H: o.H, tiles: o.tiles, blk, soft, rects: o.rects, ecol, meta: o.meta || {} };
  };

  C.tileAt = (w, x, y) => (x < 0 || y < 0 || x >= w.W || y >= w.H) ? C.WATER : w.tiles[y * w.W + x];

  function colBlocked(w, x, y, r) {
    const a = w.ecol.get(Math.floor(y) * w.W + Math.floor(x));
    if (a) for (const c of a) if (x + r > c[0] && x - r < c[2] && y + r > c[1] && y - r < c[3]) return true;
    return false;
  }
  /* canStand(world, x, y) — may a player's body stand here? (game.js canStand for kind 'player', doors open, no fields) */
  C.canStand = function (w, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const r = C.BODY; if (colBlocked(w, x, y, r)) return false;
    for (let i = 0; i < 4; i++) { const ox = i & 1 ? r : -r, oy = i & 2 ? r : -r; const t = C.tileAt(w, Math.floor(x + ox), Math.floor(y + oy)); if (w.blk[t] && !w.soft[t]) return false; }
    const fx = Math.floor(x), fy = Math.floor(y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const h = w.soft[C.tileAt(w, fx + dx, fy + dy)]; if (h && Math.abs(x - fx - dx - .5) < h + r && Math.abs(y - fy - dy - .5) < h + r) return false; }
    return true;
  };
  /* moveBy(world, pos, dx, dy) — the game's axis-separated slide: x first, then y. Mutates pos {x, y}; returns the distance moved. */
  C.moveBy = function (w, pos, dx, dy) {
    let moved = 0;
    if (dx && C.canStand(w, pos.x + dx, pos.y)) { pos.x += dx; moved += Math.abs(dx); }
    if (dy && C.canStand(w, pos.x, pos.y + dy)) { pos.y += dy; moved += Math.abs(dy); }
    return moved;
  };
  /* nearestStand(world, x, y) — the closest standable point on a spiral (the game's own recovery search on load) */
  C.nearestStand = function (w, x, y, maxR) {
    if (C.canStand(w, x, y)) return { x, y };
    for (let r = 1; r <= (maxR || 12); r++) for (let a = 0; a < 16; a++) { const px = x + Math.cos(a / 8 * Math.PI) * r, py = y + Math.sin(a / 8 * Math.PI) * r; if (C.canStand(w, px, py)) return { x: px, y: py }; }
    return null;
  };

  /* hash(world) — FNV-1a 32 over the tiles, the soft/blocking tables and the rectangles: the client and server compare it */
  C.hash = function (w) {
    let h = 0x811c9dc5 >>> 0;
    const mix = b => { h ^= b; h = Math.imul(h, 0x01000193) >>> 0; };
    mix(w.W & 255); mix(w.W >>> 8); mix(w.H & 255); mix(w.H >>> 8);
    for (let i = 0; i < w.tiles.length; i++) mix(w.tiles[i]);
    for (let i = 0; i < 64; i++) { mix(w.blk[i]); mix(Math.round(w.soft[i] * 1000) & 255); }
    const f = new Float64Array(1), b = new Uint8Array(f.buffer);
    for (const r of w.rects) for (let j = 0; j < 4; j++) { f[0] = r[j]; for (let k = 0; k < 8; k++) mix(b[k]); }
    return ('0000000' + h.toString(16)).slice(-8);
  };

  /* binary format (before compression): "SFW1" | u32 header length | header JSON | tiles W×H | f64 rects ×4.
     header: { format, W, H, blk[64], soft[64], rects: count, meta } */
  C.encode = function (w) {
    const header = JSON.stringify({ format: C.FORMAT, W: w.W, H: w.H, blk: Array.from(w.blk), soft: Array.from(w.soft, v => Math.round(v * 1e6) / 1e6), rects: w.rects.length, meta: w.meta || {} });
    const hb = new TextEncoder().encode(header);
    const out = new Uint8Array(8 + hb.length + w.tiles.length + w.rects.length * 32);
    out.set([83, 70, 87, 49]); new DataView(out.buffer).setUint32(4, hb.length, true); out.set(hb, 8); out.set(w.tiles, 8 + hb.length);
    const rv = new DataView(out.buffer, 8 + hb.length + w.tiles.length);
    w.rects.forEach((r, i) => { for (let j = 0; j < 4; j++) rv.setFloat64((i * 4 + j) * 8, r[j], true); });
    return out;
  };
  C.decode = function (buf) {
    const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    if (u[0] !== 83 || u[1] !== 70 || u[2] !== 87 || u[3] !== 49) throw new Error('not a Shardfall world file');
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength); const hl = dv.getUint32(4, true);
    const h = JSON.parse(new TextDecoder().decode(u.subarray(8, 8 + hl)));
    if (h.format !== C.FORMAT) throw new Error('world file format ' + h.format + ' is not supported');
    const tiles = new Uint8Array(u.subarray(8 + hl, 8 + hl + h.W * h.H));
    const rects = []; const ro = 8 + hl + h.W * h.H;
    for (let i = 0; i < h.rects; i++) { const r = []; for (let j = 0; j < 4; j++) r.push(dv.getFloat64(ro + (i * 4 + j) * 8, true)); rects.push(r); }
    return C.makeWorld({ W: h.W, H: h.H, tiles, blk: h.blk, soft: h.soft, rects, meta: h.meta });
  };
  return C;
});
