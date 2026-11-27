/* ================= PAINTED RENDER (v0.32 dev): Painted Human Candidates v0.1 behind the developer flag =================
   Off unless the page has ?dev AND ?painted=strict (or ?painted=1) or ?painted=bodies, or the PAINTED developer button sets a mode
   (not saved). Every human goes through drawPaintedActor first: the same appearance (gearOfActor → SF.GEAR.resolve) and the same pose
   (gearPose: the player's clip or the NPC's state) that the layered renderer uses; SF.PAINTED decides whether an accepted painted
   frame exists. When it does not (equipment worn in strict mode, ghost, run, weapon attacks, death, tools, or a direction whose
   candidates were all rejected), the call returns false and the existing renderer draws the actor exactly as before.
   Sheets: 128 px cells drawn 1:1 with the feet at (64,106), as the Saltmarsh Scout sheets. Nothing here touches saves, items,
   stats, combat timing or the paper doll. Atlas preview: PAINTED button → Atlas (rejected cells crossed out with their reason). */
const PNT = { mode: 'off', img: {}, ready: 0, stats: { drawn: 0, fallback: {} }, panel: null };
{
  let q = null; try { q = new URLSearchParams(location.search).get('painted'); } catch (_) { }
  if (DEV.on && q) PNT.mode = q === 'bodies' ? 'bodies' : (q === '1' || q === 'strict') ? 'strict' : 'off';
  const A = globalThis.PAINTED_ART;
  if (A && DEV.on) for (const k in A.sheets) { const im = new Image(); im.onload = () => { PNT.img[k] = im; PNT.ready++; }; im.src = A.sheets[k]; }
}
function paintedFallback(why) { PNT.stats.fallback[why] = (PNT.stats.fallback[why] || 0) + 1; return false; }
/* why an actor is or is not drawn with the painted art (the inspector and tests use this) */
function paintedWhy(e) {
  const PT = SF.PAINTED; if (!PT || !PT.ART) return { ok: false, reasons: ['painted art not in this build'] };
  if (!(e.kind === 'player' || e.kind === 'ally' || e.kind === 'npc' || (e.kind === 'mon' && MON[e.type] && MON[e.type].scout))) return { ok: false, reasons: ['not a human'] };
  const A = gearOfActor(e), el = PT.eligible(A.R, { mode: PNT.mode, ghost: A.ghost }); if (!el.ok) return el;
  const [act, f] = gearPose(e, A), fr = PT.frame(A.R.body, act, f, e.sect || 0);
  if (!fr) return { ok: false, reasons: [PT.ACTION_OF[act] ? `no accepted ${A.R.body} ${PT.ACTION_OF[act]} frame facing ${PT.ROWS[e.sect || 0]}` : `no painted art for '${act}'`], act, f };
  return { ok: true, reasons: [], act, f, fr, body: A.R.body };
}
function drawPaintedActor(g, e, x, y) {
  if (PNT.mode === 'off') return false;
  const w = paintedWhy(e); if (!w.ok) return paintedFallback(w.reasons[0].replace(/:.*$/, '').replace(/ facing \w+$/, ''));
  const im = PNT.img[w.body + '/' + w.fr.action]; if (!im) return paintedFallback('sheet loading');
  const C = PAINTED_ART.cell, [ax, ay] = PAINTED_ART.anchor;
  if (e.kind === 'ally' && e.ghost) g.globalAlpha = .75;
  g.imageSmoothingEnabled = false; g.drawImage(im, w.fr.col * C, w.fr.row * C, C, C, Math.round(x - ax), Math.round(y - ay), C, C);
  PNT.stats.drawn++; return true;
}
function setPaintedMode(m) { PNT.mode = SF.PAINTED.MODES.includes(m) ? m : 'off'; PNT.stats = { drawn: 0, fallback: {} }; paintedPanel(); }

/* ---------------- developer button, inspector and atlas preview (only with ?dev) ---------------- */
function paintedPanel() {
  if (!DEV.on || !globalThis.PAINTED_ART) return;
  let p = document.getElementById('pntp');
  if (!p) {
    const b = document.createElement('button'); b.id = 'pntb'; b.textContent = 'PAINTED';
    b.style.cssText = 'position:fixed;left:48px;bottom:4px;z-index:60;font:10px monospace;padding:3px 6px;background:#20304a;color:#cfe0ff;border:1px solid #6080b0;border-radius:4px;opacity:.8';
    p = document.createElement('div'); p.id = 'pntp'; p.hidden = true;
    p.style.cssText = 'position:fixed;left:4px;bottom:28px;z-index:61;max-height:80vh;overflow:auto;font:11px monospace;background:rgba(14,18,28,.94);color:#dfe6f2;border:1px solid #6080b0;border-radius:6px;padding:8px;max-width:min(96vw,460px)';
    b.addEventListener('click', () => { p.hidden = !p.hidden; paintedPanel(); });
    p.addEventListener('click', ev => { const t = ev.target.closest('[data-pm],[data-pa]'); if (!t) return; if (t.dataset.pm) setPaintedMode(t.dataset.pm); else paintedAtlas(t.dataset.pa); });
    p.innerHTML = '<div id="pnts"></div><div id="pnta"></div>';
    document.body.appendChild(b); document.body.appendChild(p);
    setInterval(() => { if (!p.hidden) paintedPanel(); }, 500);
  }
  if (p.hidden) return;
  const A = PAINTED_ART, w = P ? paintedWhy(P) : null, fb = Object.entries(PNT.stats.fallback).sort((a, b) => b[1] - a[1]).slice(0, 6);
  document.getElementById('pnts').innerHTML = `<b>Painted Human Candidates v${A.version}</b> <span style="color:#f0b060">experimental</span><br>` +
    `accepted ${A.counts.accepted} / ${A.counts.accepted + A.counts.rejected} frames<br>mode: ` +
    SF.PAINTED.MODES.map(m => `<button data-pm="${m}" style="font:inherit;${m === PNT.mode ? 'background:#6080b0;color:#fff' : ''}">${m}</button>`).join(' ') +
    `<div style="color:#a8b4c8;margin:4px 0">strict: only actors wearing nothing (no overlays exist). bodies: QA view, gear is NOT drawn.</div>` +
    `<b>you</b>: ${w ? (w.ok ? `painted ${w.body} ${w.fr.action} ${SF.PAINTED.ROWS[w.fr.row]} pose ${w.fr.col} (${w.fr.of} accepted)` : 'existing renderer — ' + w.reasons.slice(0, 3).join('; ')) : '-'}<br>` +
    `drawn ${PNT.stats.drawn}; fallbacks: ${fb.map(([k, v]) => k + ' ×' + v).join(', ') || '-'}<br>` +
    `<div style="color:#a8b4c8;margin-top:4px">not shown by these bodies: ${SF.PAINTED.LIMITS.join('; ')}</div>` +
    `<div style="margin-top:6px">atlas: ${Object.keys(A.sheets).map(k => `<button data-pa="${k}" style="font:inherit">${k}</button>`).join(' ')}</div>`;
}
/* one sheet at 1:1 with every rejected cell crossed out; hover a cell for its QA verdict */
function paintedAtlas(k) {
  const host = document.getElementById('pnta'), im = PNT.img[k]; if (!host) return; if (!im) { host.textContent = 'loading…'; return; }
  const A = PAINTED_ART, C = A.cell, [body, action] = k.split('/'), c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.id = 'pntcanvas';
  c.style.cssText = 'image-rendering:pixelated;background:#556455;display:block;margin-top:4px;max-width:100%';
  const g = c.getContext('2d'); g.drawImage(im, 0, 0); g.strokeStyle = 'rgba(255,255,255,.18)';
  for (let r = 0; r < 8; r++) for (let f = 0; f < A.frames; f++) {
    const x = f * C, y = r * C, key = `${k}/${A.rows[r]}/${String(f).padStart(2, '0')}`; g.strokeRect(x + .5, y + .5, C - 1, C - 1);
    if (A.rejected[key]) { g.strokeStyle = 'rgba(220,40,40,.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 8, y + 8); g.lineTo(x + C - 8, y + C - 8); g.moveTo(x + C - 8, y + 8); g.lineTo(x + 8, y + C - 8); g.stroke(); g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.18)'; }
    g.fillStyle = '#ffe080'; g.font = '10px monospace'; g.fillText(`${A.rows[r]} ${f}`, x + 3, y + 11);
    g.fillStyle = 'rgba(255,0,0,.9)'; g.fillRect(x + A.anchor[0] - 3, y + A.anchor[1], 7, 1);
  }
  const tip = document.createElement('div'); tip.style.cssText = 'min-height:2.6em;color:#ffd0a0';
  c.addEventListener('mousemove', ev => { const b = c.getBoundingClientRect(), s = c.width / b.width, f = Math.floor((ev.clientX - b.left) * s / C), r = Math.floor((ev.clientY - b.top) * s / C); const key = `${k}/${A.rows[r]}/${String(f).padStart(2, '0')}`; tip.textContent = key + ': ' + (A.rejected[key] ? 'REJECTED — ' + A.rejected[key].join('; ') : 'accepted'); });
  host.replaceChildren(tip, c);
}
if (DEV.on) { const t = setInterval(() => { if (document.body) { paintedPanel(); clearInterval(t); } }, 200); }
globalThis.__PAINTED = { state: PNT, why: paintedWhy, set: setPaintedMode, atlas: paintedAtlas, panel: paintedPanel };
