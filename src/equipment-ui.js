
/* ================= EQUIPMENT UI (v0.25): paper doll window, backpack, item tooltips, drag and drop, armor crafting =================
   Every change to items goes through the validated commands in SF.EQ (equipItem, unequipItem, dropItem, pickupItem, splitStack,
   mergeStacks, craftItem, repairItem); this file only draws and routes input. */
const EQ = SF.EQ;

/* ---------- silhouettes: empty-slot hints and stand-in icons for pieces that have no painted art yet ---------- */
const EQ_PATHS = {
  head: 'M4 14C4 7 8 4 12 4s8 3 8 10v5h-5v-5H9v5H4z', neck: 'M5 8q7 5 14 0l-1 7q-6 5-12 0z',
  chest: 'M6 4l3-1q3 3 6 0l3 1 3 5-3 2v10H6V11L3 9z', arms: 'M3 6l6-2 2 4-4 3 1 9H4zM21 6l-6-2-2 4 4 3-1 9h4z',
  hands: 'M7 21V11l1-6h2v5l1-6h2v6l1-5h2v6l2-2 1 1-3 6v5z', legs: 'M6 3h12v7l-2 11h-3l-1-11-1 11H8L6 10z',
  feet: 'M7 4h5v11l8 2v4H6z', weapon: 'M17 3h4v4L10 17l2 2-2 2-2-2-3 3-3-3 3-3-2-2 2-2 2 2z',
  shield: 'M12 2l8 3v6q0 7-8 11-8-4-8-11V5z', cloak: 'M8 3h8l1 3 4 15H3L7 6z',
  ring: 'M12 6a6 6 0 1 0 .01 0zM12 9a3 3 0 1 1-.01 0z', bracelet: 'M12 6a8 6 0 1 0 .01 0zM12 9a5 3 0 1 1-.01 0z',
  necklace: 'M5 4q7 12 14 0h-2q-5 9-10 0zM10 14h4l-2 5z', belt: 'M2 9h20v6H2zM10 8h4v8h-4z',
  shirt: 'M7 3h3q2 2 4 0h3l5 5-3 3-2-2v12H7V9l-2 2-3-3z', trousers: 'M6 3h12l1 18h-5l-2-12-2 12H5z',
  robe: 'M9 2h6l2 4 4 16H3L7 6z', tunic: 'M7 3h3l2 4 2-4h3l1 19H6z' };
function eqSvg(slot, col, size, op) { const d = EQ_PATHS[slot] || EQ_PATHS.chest; return `<svg class="eqsvg" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" style="opacity:${op === undefined ? 1 : op}"><path d="${d}" fill="${col}" fill-rule="evenodd" stroke="rgba(0,0,0,.65)" stroke-width=".8"/></svg>`; }
const isDefaultMat = (d, m) => !m || m === 'iron' || m === 'regular' || m === 'pine' || d.fixedMat;
/* backpack icons: the item's own painted tile, else a matching existing tile (e.g. the old plate armor for the plate chest),
   else the slot silhouette in the material colour; a small corner chip marks a non-default material */
const baseBagIcon = bagIcon;
bagIcon = function (it, size) {
  const d = SF.ITEMS[it.id]; if (!d) return baseBagIcon(it, size);
  if (!d.fam) return baseBagIcon(it, size);
  const m = SF.matOf(it), col = EQ.matColor(d.fixedMat || m), chip = isDefaultMat(d, m) ? '' : `<b class="matchip" style="background:${col}"></b>`;
  const r = BAG_ICONS.rect[it.id] || (d.icon && BAG_ICONS.rect[d.icon]);
  if (r) { const k = size / r[2]; return `<i class="bagico" aria-hidden="true" data-icon="${esc(it.id)}" style="width:${size}px;height:${size}px;background-size:${BAG_ICONS.w * k}px ${BAG_ICONS.h * k}px;background-position:${-r[0] * k}px ${-r[1] * k}px">${chip}</i>`; }
  return `<i class="bagglyph eqglyph" aria-hidden="true" data-icon="${esc(it.id)}" style="width:${size}px;height:${size}px">${eqSvg(d.slot, col, Math.round(size * .86))}${chip}</i>`;
};

/* ---------- item tooltips: one builder for the backpack, paper doll, crafting, vendor and loot windows ---------- */
const f1w = v => (Math.round(v * 10) / 10).toFixed(1);
const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + f1w(Math.abs(v)).replace(/\.0$/, '');
const dmgRange = (w, sc) => { const lo = w.dice[0] + (w.dice[2] || 0), hi = w.dice[0] * w.dice[1] + (w.dice[2] || 0); return sc ? [Math.floor(lo * sc), Math.floor(hi * sc)] : [lo, hi]; };
function tipLines(it) {
  const d = SF.ITEMS[it.id]; if (!d) return [['', '']]; const L = [];
  const w = SF.weaponOf(it), m = SF.matOf(it);
  if (d.fam && d.slot) {
    if (d.cat === 'armor' || d.cat === 'clothing') L.push(['Armor family', EQ.FAMILIES[d.fam].n]);
    L.push(['Slot', EQ.SLOT[d.slot].n]);
    if (d.fixedMat || m) L.push(['Material', EQ.matLabel(d.fixedMat || m) + (it.sec ? ' · studs ' + EQ.matLabel(it.sec) : '')]);
    if (d.cat === 'shield') L.push(['Shield AR', f1w(EQ.shieldAR(it)) + ' · parry with Parrying']);
    else if (d.cat !== 'jewelry') L.push(['Armor protection', f1w(EQ.protection(it)) + (d.slot && EQ.SLOT[d.slot].regions.length ? ' · ' + EQ.SLOT[d.slot].regions.map(g => EQ.REGION_N[g]).join(', ') + ' ' + Math.round(EQ.coverage(d.slot) * 100) + '%' : '')]);
  } else if (w) { L.push(['Weapon', `${SF.SKILL[w.skill].n} · ${w.two ? 'two-handed' : 'one-handed'}`]); const [a, b] = dmgRange(w); L.push(['Damage', a + '–' + b + (it.quality === 'exceptional' ? ' (+4)' : '')]); L.push(['Speed', w.speed + ' · ' + SF.swingDelay(P ? P.stam : 100, w.speed).toFixed(2) + ' s']); if (w.ammo) L.push(['Ammunition', w.ammo + 's']); }
  else if (d.legacy) L.push(['Old suit', 'Converted to pieces when your save loads']);
  else L.push(['Type', cap1(d.cat || 'item') + (it.qty > 1 ? ' · ' + it.qty : '')]);
  L.push(['Weight', f1w(SF.itemWt(it)) + (it.qty > 1 ? ' (' + f1w(SF.itemWt(it) / it.qty) + ' each)' : '')]);
  const req = EQ.strReq(it); if (req) L.push(['Required Strength', String(req), P && P.str < req ? 'bad' : '']);
  if (d.dex) L.push(['Dexterity modifier', String(d.dex)]);
  if (d.med) L.push(['Meditation', '−' + Math.round(d.med * 100) + '% mana regeneration']);
  if (it.cond !== undefined && SF.WEARABLE(it.id)) L.push(['Durability', Math.max(0, Math.round(it.cond)) + ' / ' + (it.maxc || 100) + (it.cond <= 0 ? ' · broken' : it.cond < .2 * (it.maxc || 100) ? ' · badly worn' : ''), it.cond <= 0 ? 'bad' : it.cond < .2 * (it.maxc || 100) ? 'warn' : '']);
  if (d.fam || w) L.push(['Quality', (EQ.QUALITY[it.quality] || EQ.QUALITY.normal).n]);
  if (it.creatorName && (it.quality === 'exceptional' || it.maker)) L.push(['Crafted by', it.creatorName]);
  if (SF.WORK_TOOLS[it.id] && !d.stack) L.push(['Uses', String(SF.toolUses(it))]);
  if (it.venom) L.push(['Venom', '×' + it.venom.charges]);
  const v = d.fam ? EQ.value(it) : (SF.PRICES[it.id] || 0) * (it.qty || 1); if (v) L.push(['Estimated value', v + ' gold']);
  if (!d.trade) L.push(['Protected', 'stays with you when you die']);
  return L;
}
/* comparison with what is worn in the same slot: green better, red worse; less weight counts as better */
function compareLines(it) {
  const d = SF.ITEMS[it.id]; if (!P || !d || !d.slot || !EQ.SLOT[d.slot]) return '';
  const cur = P.equip[d.slot]; if (cur === it) return '';
  const row = (k, dv, goodUp) => { if (Math.abs(dv) < .05) return ''; const good = goodUp ? dv > 0 : dv < 0; return `<span class="${good ? 'up' : 'dn'}">${k} ${sgn(dv)}</span>`; };
  let h = '';
  if (d.slot === 'weapon') { const a = SF.weaponOf(it), b = cur ? SF.weaponOf(cur) : SF.WEAPONS.unarmed; if (a && b) { const av = x => { const r = dmgRange(x); return (r[0] + r[1]) / 2; }; h += row('avg damage', av(a) - av(b), true) + row('speed', a.speed - b.speed, true); } }
  else if (d.cat === 'shield') h += row('shield AR', EQ.shieldAR(it) - (cur ? EQ.shieldAR(cur) : 0), true);
  else if (d.cat !== 'jewelry') h += row('protection', EQ.protection(it) - (cur ? EQ.protection(cur) : 0), true);
  h += row('weight', SF.itemWt(it) - (cur ? SF.itemWt(cur) : 0), false);
  const dx = (d.dex || 0) - (cur ? SF.ITEMS[cur.id].dex || 0 : 0); if (dx) h += row('Dexterity', dx, true);
  const md = ((d.med || 0) - (cur ? SF.ITEMS[cur.id].med || 0 : 0)) * 100; if (Math.abs(md) >= 1) h += row('meditation penalty %', md, false);
  if (d.slot === 'weapon' && EQ.twoHanded(it) && P.equip.shield) h += `<span class="dn">frees the off hand (${esc(SF.itemName(P.equip.shield))})</span>`;
  return h ? `<div class="cmp"><span class="note">vs ${cur ? esc(SF.itemName(cur)) : 'empty ' + EQ.SLOT[d.slot].n.toLowerCase()}:</span>${h}</div>` : '';
}
function itemTip(it, o) {
  o = o || {}; const d = SF.ITEMS[it.id]; const title = (it.qty > 1 ? it.qty + ' × ' : '') + (d && d.fam ? EQ.fullName(it) : SF.itemName(it));
  const cls = it.quality === 'exceptional' ? 'q-exc' : d && d.rare ? 'q-rare' : '';
  let h = `<div class="baghead">${bagIcon(it, o.icon || 48)}<span class="tiptitle ${cls}">${esc(title)}</span></div><div class="tipkv">`;
  for (const [k, v, c] of tipLines(it)) h += `<span>${esc(k)}</span><span class="${c || ''}">${esc(v)}</span>`;
  h += '</div>'; if (o.compare !== false) h += compareLines(it);
  return h;
}
/* the backpack's hover tooltip and selected card keep their old structure (.baghead + spans) with the richer content */
bagStats = it => itemTip(it, { icon: 56 });
/* a preview of an item that does not exist yet (vendor stock, a recipe's result) without spending an item id */
const previewItem = (id, o) => { const d = SF.ITEMS[id]; if (!d) return null; if (d.fam) return Object.assign({ uid: 0, id, qty: 1 }, EQ.fields(id, o || { origin: 'npc' })); return Object.assign({ uid: 0, id, qty: (o && o.qty) || 1 }, SF.WEARABLE(id) && !d.stack ? { cond: 100, maxc: 100 } : {}); };
function tipItem(key) {
  const i = key.indexOf(':'), k = key.slice(0, i), v = key.slice(i + 1); if (!P) return null;
  if (k === 'pack') return findU(P.pack, v); if (k === 'bank') return findU(P.bank, v); if (k === 'eq') return P.equip[v];
  if (k === 'loot') return P.lootOpen && P.lootOpen.cont ? findU(P.lootOpen.cont, v) : null;
  if (k === 'shop') return previewItem(v);
  if (k === 'craft') { const [rid, mat, sec] = v.split('|'); const r = SF.RECIPE[rid]; if (!r) return null; const pl = SF.craftPlan(P, P.pack, r, mat || undefined, sec || undefined); return SF.craftOutputs(P, pl, false, {}, true)[0]; }
  return null;
}
const ITIP = { key: null, pin: false };
function showTip(key, x, y, pin) {
  const it = tipItem(key), el = $('#itip'); if (!it) return hideTip(); ITIP.key = key; ITIP.pin = !!pin;
  el.innerHTML = itemTip(it) + (pin ? '<div class="note" style="margin-top:4px">Tap elsewhere to close</div>' : ''); el.hidden = false;
  const w = el.offsetWidth, h = el.offsetHeight; let L = x + 16, T = y + 12; if (L + w > VW - 6) L = Math.max(6, x - w - 12); if (T + h > VH - 6) T = Math.max(6, VH - h - 6);
  el.style.left = L + 'px'; el.style.top = T + 'px';
}
function hideTip() { ITIP.key = null; ITIP.pin = false; const el = $('#itip'); if (el) el.hidden = true; }
document.addEventListener('pointerover', e => { if (e.pointerType !== 'mouse' || DRAG.on) return; const t = e.target.closest('[data-tip]'); if (!t || t.closest('.bagcell')) return; showTip(t.dataset.tip, e.clientX, e.clientY); });
document.addEventListener('pointerout', e => { if (e.pointerType !== 'mouse' || ITIP.pin) return; const t = e.target.closest('[data-tip]'); if (t && !t.contains(e.relatedTarget)) hideTip(); });
document.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && ITIP.key && !ITIP.pin) { const el = $('#itip'); const w = el.offsetWidth, h = el.offsetHeight; let L = e.clientX + 16, T = e.clientY + 12; if (L + w > VW - 6) L = Math.max(6, e.clientX - w - 12); if (T + h > VH - 6) T = Math.max(6, VH - h - 6); el.style.left = L + 'px'; el.style.top = T + 'px'; } });
// touch: tapping an item name (data-tip without an action) pins its tooltip; the next tap anywhere closes it
document.addEventListener('click', e => { const t = e.target.closest('[data-tip]'); if (t && !t.closest('[data-a]') && !t.closest('.bagcell')) { const r = t.getBoundingClientRect(); if (ITIP.key === t.dataset.tip && ITIP.pin) hideTip(); else showTip(t.dataset.tip, r.left, r.bottom, true); return; } if (ITIP.pin && !e.target.closest('#itip')) hideTip(); }, true);

/* ---------- paper doll window ---------- */
const EQW = { sel: null, sig: '', html: '' };
const EQ_LEFT = ['head', 'neck', 'chest', 'arms', 'hands', 'legs', 'feet'], EQ_RIGHT = ['weapon', 'shield', 'cloak', 'robe', 'tunic', 'shirt', 'trousers'], EQ_BOTTOM = ['ring', 'bracelet', 'necklace', 'belt'];
function toggleEqWin(force) { SETTINGS.eqOpen = force === undefined ? !SETTINGS.eqOpen : !!force; saveSettings(); if (!SETTINGS.eqOpen) { EQW.sel = null; hideTip(); } snd(SETTINGS.eqOpen ? 'ui.open' : 'ui.close'); renderEqWin(true); }
function eqSlotHtml(s) {
  const it = P.equip[s], S = EQ.SLOT[s]; let inner, cls = 'eqs', tip = '';
  const twoGhost = s === 'shield' && !it && EQ.twoHanded(P.equip.weapon);
  if (it) {
    inner = bagIcon(it, 36); tip = ` data-tip="eq:${s}"`;
    if (it.cond !== undefined && SF.WEARABLE(it.id)) { const f = cl(it.cond / (it.maxc || 100), 0, 1); inner += `<em class="dur" style="width:${Math.round(f * 100)}%;background:${f <= 0 ? '#e04838' : f < .2 ? '#f0a040' : '#6fc070'}"></em>`; if (f <= 0) cls += ' broken'; else if (f < .2) cls += ' worn'; }
  } else if (twoGhost) { inner = `<span class="two">${bagIcon(P.equip.weapon, 30)}<small>2H</small></span>`; cls += ' twohand'; }
  else inner = eqSvg(s, '#c8b48a', 26, .28);
  if (EQW.sel === s) cls += ' on';
  return `<button class="${cls}" data-a="eqsel" data-s="${s}" data-drop="eq:${s}"${it ? ` data-drag="eq:${s}"` : ''}${tip} aria-label="${esc(S.n + (it ? ': ' + SF.itemName(it) : ': empty'))}" title="${esc(S.n)}">${inner}</button>`;
}
function eqStatsHtml() {
  const e = EQ.effective(P), en = encumb(), w = wDef(), sc = SF.damageScale({ tactics: sv('tactics'), anatomy: sv('anatomy'), str: P.str }), [lo, hi] = dmgRange(w, sc);
  const kv = (k, v, c) => `<span>${k}</span><span class="${c || ''}">${v}</span>`;
  return `<div class="eqstat">${kv('Armor rating', `<b>${f1w(e.ar)}</b>${magicArmor(P) ? ' +' + magicArmor(P) + ' magic' : ''}`)}${kv('Weapon', esc(weaponLabel(P)) + ` · ${lo}–${hi} dmg`)}${kv('Attack speed', SF.swingDelay(P.stam, w.speed).toFixed(2) + ' s per swing')}`
    + kv('Equipment weight', f1w(e.eqWt)) + kv('Carried', `${f1w(en.wt)} / ${f1w(en.cap)}`, en.stage >= 2 ? 'bad' : en.stage === 1 ? 'warn' : '') + kv('Encumbrance', `${en.n} (${Math.round(en.ratio * 100)}%)`, en.stage >= 2 ? 'bad' : en.stage === 1 ? 'warn' : '')
    + kv('Strength', `${e.str}`) + kv('Dexterity', `${e.dex}${e.dexMod ? ` <span class="note">(${P.dex} ${e.dexMod})</span>` : ''}`, e.dexMod ? 'warn' : '') + kv('Intelligence', `${e.int}`)
    + kv('Dexterity penalty', e.dexMod ? String(e.dexMod) : 'none') + kv('Meditation', e.med ? `−${Math.round(e.med * 100)}% mana regeneration` : 'unhindered', e.med ? 'warn' : '')
    + (e.broken.length ? kv('Broken', e.broken.map(s => EQ.SLOT[s].n).join(', ') + ' · repair them', 'bad') : '') + '</div>';
}
function renderEqWin(force) {
  const el = $('#eqwin'); if (!el) return;
  const open = !!(P && SETTINGS.eqOpen && !SCREEN); document.body.classList.toggle('eqopen', open);
  if (!open) { if (!el.hidden) { el.hidden = true; EQW.html = ''; } return; }
  const e = EQ.effective(P);
  let h = `<div class="eqh" data-eqmove><b>${esc(P.name)}</b><span class="note">AR ${f1w(e.ar)} · ${f1w(encumb().wt)}/${f1w(SF.carryCap(P))}</span><button class="x" data-a="eqclose" aria-label="Close equipment">×</button></div><div class="eqb">`;
  h += `<div class="eqdoll"><div class="eqcol">${EQ_LEFT.map(eqSlotHtml).join('')}</div><div class="eqfig" data-drop="eq:auto"><i class="doll" style="background-image:url(${SCOUT_SRC})"></i>${P.ghost ? '<span class="note">ghost</span>' : ''}</div><div class="eqcol">${EQ_RIGHT.map(eqSlotHtml).join('')}</div></div>`;
  h += `<div class="eqrow">${EQ_BOTTOM.map(eqSlotHtml).join('')}</div>`;
  const sel = EQW.sel && P.equip[EQW.sel];
  if (EQW.sel) h += `<div class="eqcard">${sel ? itemTip(sel, { compare: false, icon: 40 }) + `<div class="acts">${SF.ITEMS[sel.id].trade || sel.id === 'garment' ? btn('uneq', 'Remove', { s: EQW.sel }) : ''}${SF.WEARABLE(sel.id) && sel.cond !== undefined && sel.cond < (sel.maxc || 100) ? btn('repair', 'Repair', { u: sel.uid }) : ''}${SF.ITEMS[sel.id].trade ? btn('drop', 'Drop', { u: sel.uid }) : ''}</div>` : `<p class="note">${EQ.SLOT[EQW.sel].n}: empty. Drag an item here, or double-click it in the backpack.</p>`}</div>`;
  h += eqStatsHtml() + '<p class="note eqhint">Drag between the backpack and the slots · double-click to equip or remove · right-click for more</p></div>';
  if (!force && h === EQW.html && !el.hidden) return; EQW.html = h;
  const b = el.querySelector('.eqb'), st = b ? b.scrollTop : 0; el.innerHTML = h; el.hidden = false; const nb = el.querySelector('.eqb'); if (nb) nb.scrollTop = st;
  placeEqWin();
}
function placeEqWin() { const el = $('#eqwin'); const p = SETTINGS.eqPos || { x: 8, y: 118 }; const w = el.offsetWidth || 300, h = el.offsetHeight || 300; const x = cl(p.x, 0, Math.max(0, VW - w)), y = cl(p.y, 0, Math.max(0, VH - h)); el.style.left = x + 'px'; el.style.top = y + 'px'; }
/* the window moves by its title bar and remembers where it was put */
{ let mv = null;
  document.addEventListener('pointerdown', e => { const hd = e.target.closest('[data-eqmove]'); if (!hd || e.target.closest('button')) return; const el = $('#eqwin'); const r = el.getBoundingClientRect(); mv = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top }; try { hd.setPointerCapture(e.pointerId); } catch (_) { } e.preventDefault(); });
  document.addEventListener('pointermove', e => { if (!mv || e.pointerId !== mv.id) return; SETTINGS.eqPos = { x: Math.round(e.clientX - mv.dx), y: Math.round(e.clientY - mv.dy) }; placeEqWin(); });
  document.addEventListener('pointerup', e => { if (mv && e.pointerId === mv.id) { mv = null; saveSettings(); } }); }
addEventListener('resize', () => { if (SETTINGS.eqOpen) placeEqWin(); });
/* called after every equipment change and from the HUD refresh: transient effective stats, the appearance-change hook, the window */
function eqChanged() { renderEqWin(true); if (PANEL === 'bag' || PANEL === 'gear') renderPanel(); }
function eqTick() {
  EQ.refresh(P); const sig = EQ.signature(P);
  if (sig !== EQW.sig) { const first = !EQW.sig; EQW.sig = sig; if (!first) { const look = EQ.appearance(P); simEmit('AppearanceChanged', { actor: aidOf(P), layers: look.map(l => l.asset) }); try { dispatchEvent(new CustomEvent('sf:appearance', { detail: { actor: aidOf(P), layers: look } })); } catch (_) { } } }
  renderEqWin();
}

/* ---------- drag and drop (mouse: press and move; touch: hold, then move), double-click, right-click / long-press menu ---------- */
const DRAG = { on: false, src: null, ghost: null, x0: 0, y0: 0, id: null, hold: null, armed: false, kill: 0, touch: false };
function dragItemOf(src) { const [k, v] = src.split(':'); return k === 'eq' ? P.equip[v] : k === 'pack' ? findU(P.pack, v) : null; }
document.addEventListener('pointerdown', e => {
  if (!P || e.button > 0) return; const t = e.target.closest('[data-drag]'); if (!t) return;
  DRAG.src = t.dataset.drag; DRAG.x0 = e.clientX; DRAG.y0 = e.clientY; DRAG.id = e.pointerId; DRAG.touch = e.pointerType !== 'mouse'; DRAG.armed = !DRAG.touch; DRAG.on = false; DRAG.el = t;
  clearTimeout(DRAG.hold); if (DRAG.touch) DRAG.hold = setTimeout(() => { DRAG.armed = true; DRAG.longpress = true; t.classList.add('lift'); }, 380);
});
document.addEventListener('pointermove', e => {
  if (!DRAG.src || e.pointerId !== DRAG.id) return; const d = Math.hypot(e.clientX - DRAG.x0, e.clientY - DRAG.y0);
  if (!DRAG.on) { if (!DRAG.armed) { if (d > 10) { clearTimeout(DRAG.hold); DRAG.src = null; } return; } if (d < 8) return;
    const it = dragItemOf(DRAG.src); if (!it) { DRAG.src = null; return; } DRAG.on = true; DRAG.longpress = false; hideTip(); hideCtx();
    const g = document.createElement('div'); g.className = 'dragghost'; g.innerHTML = bagIcon(it, 44); document.body.appendChild(g); DRAG.ghost = g; document.body.classList.add('dragging'); }
  DRAG.ghost.style.left = e.clientX - 22 + 'px'; DRAG.ghost.style.top = e.clientY - 22 + 'px';
  document.querySelectorAll('.dropok').forEach(x => x.classList.remove('dropok')); const tg = dropTarget(e.clientX, e.clientY); if (tg) tg.el.classList.add('dropok');
  e.preventDefault();
}, { passive: false });
function dropTarget(x, y) {
  const el = document.elementFromPoint(x, y); if (!el) return null; const t = el.closest('[data-drop]'); if (t) return { el: t, key: t.dataset.drop };
  const pn = el.closest('#panel'); if (pn && PANEL === 'bag') return { el: pn, key: 'pack' }; return null;
}
function endDrag(e) {
  clearTimeout(DRAG.hold); if (DRAG.el) DRAG.el.classList.remove('lift');
  if (DRAG.on) { const tg = dropTarget(e.clientX, e.clientY); performDrop(DRAG.src, tg && tg.key); DRAG.kill = performance.now() + 250; }
  else if (DRAG.longpress && e.type === 'pointerup') { openCtx(DRAG.src, e.clientX, e.clientY); DRAG.kill = performance.now() + 350; }
  if (DRAG.ghost) DRAG.ghost.remove(); DRAG.ghost = null; document.body.classList.remove('dragging'); document.querySelectorAll('.dropok').forEach(x => x.classList.remove('dropok'));
  DRAG.on = false; DRAG.src = null; DRAG.longpress = false;
}
document.addEventListener('pointerup', e => { if (DRAG.src && e.pointerId === DRAG.id) endDrag(e); });
document.addEventListener('pointercancel', e => { if (DRAG.src && e.pointerId === DRAG.id) { DRAG.on = false; endDrag(e); } });
// a completed drag or long-press swallows the click that follows it
document.addEventListener('click', e => { if (performance.now() < DRAG.kill) { e.stopPropagation(); e.preventDefault(); } }, true);
function performDrop(src, dst) {
  if (!dst || !P) return; const [sk, sv0] = src.split(':'), [dk, dv] = dst.split(':');
  if (sk === 'pack' && dk === 'eq') { const it = findU(P.pack, sv0); if (!it) return; equipUid(it.uid, dv === 'auto' ? undefined : dv); }
  else if (sk === 'eq' && dk === 'pack') { unequipTo(sv0); }
  else if (sk === 'eq' && dk === 'eq' && dv !== sv0 && dv !== 'auto') log('That piece belongs in its own slot.', '#ffb070');
  else if (sk === 'pack' && dk === 'pack' && dv && dv !== sv0) { const a = findU(P.pack, sv0), b = findU(P.pack, dv); if (a && b && SF.canStack(a, b)) { const r = EQ.mergeStacks(P.pack, { from: a.uid, into: b.uid }); if (r.ok) snd('ui.page'); } }
  renderPanel(); renderEqWin(true);
}
/* double-click (or double-tap): tracked by the item key, because a single click re-renders the cell under the pointer */
const DBL = { key: null, t: 0 };
document.addEventListener('click', e => {
  if (!P || performance.now() < DRAG.kill) return; const t = e.target.closest('[data-drag]'), now = performance.now();
  // the first click may open a card that shifts the grid, so the second click counts by place and time, not by element
  const again = DBL.key && now - DBL.t < 420 && Math.hypot(e.clientX - DBL.x, e.clientY - DBL.y) < 12 && (!t || t.dataset.drag === DBL.key || !e.target.closest('[data-a]') || e.target.closest('.bagcard,.eqcard'));
  if (again) { const key = DBL.key; DBL.key = null; e.stopPropagation(); e.preventDefault(); itemDouble(key); return; }
  const it = t && dragItemOf(t.dataset.drag);   // only worn pieces and wearable items answer a double-click; a second click on anything else closes its card as before
  if (!t || !it || (t.dataset.drag.startsWith('pack:') && !SF.ITEMS[it.id].slot)) { DBL.key = null; return; } DBL.key = t.dataset.drag; DBL.t = now; DBL.x = e.clientX; DBL.y = e.clientY;
}, true);
function itemDouble(key) {
  const [k, v] = key.split(':');
  if (k === 'pack') { const it = findU(P.pack, v); if (it && SF.ITEMS[it.id].slot) { equipUid(it.uid); bagUid = null; renderPanel(); } }
  else if (k === 'eq') { unequipTo(v); EQW.sel = null; renderEqWin(true); }
  refreshHud();
}
document.addEventListener('contextmenu', e => { const t = e.target.closest('[data-drag]'); if (!t || !P) return; e.preventDefault(); openCtx(t.dataset.drag, e.clientX, e.clientY); });
function openCtx(src, x, y) {
  const [k, v] = src.split(':'); const it = dragItemOf(src); if (!it) return; const d = SF.ITEMS[it.id]; let b = '';
  if (k === 'pack') { if (d.slot) b += btn('equip', 'Equip', { u: it.uid }); if (d.use === 'consume' || d.use === 'eat') b += btn('useitem', d.use === 'eat' ? 'Eat' : 'Use', { id: it.id });
    if (d.stack && it.qty > 1) b += btn('split', 'Split half', { u: it.uid, q: Math.floor(it.qty / 2) }) + btn('split', 'Split off 1', { u: it.uid, q: 1 });
    if (d.stack && P.pack.items.some(o => o !== it && SF.canStack(o, it))) b += btn('mergekind', 'Merge stacks', { u: it.uid }); }
  else b += btn('uneq', 'Remove', { s: v });
  if (SF.WEARABLE(it.id) && it.cond !== undefined && it.cond < (it.maxc || 100)) b += btn('repair', 'Repair', { u: it.uid });
  if (d.trade) b += btn('drop', it.qty > 1 ? 'Drop all' : 'Drop', { u: it.uid });
  const el = $('#ctxm'); el.innerHTML = `<div class="ctxh">${esc(SF.itemName(it))}</div>${b}`; el.hidden = false;
  el.style.left = Math.min(x, VW - el.offsetWidth - 6) + 'px'; el.style.top = Math.min(y, VH - el.offsetHeight - 6) + 'px';
}
function hideCtx() { const el = $('#ctxm'); if (el) el.hidden = true; }
document.addEventListener('click', e => { if (!e.target.closest('#ctxm') || e.target.closest('[data-a]')) setTimeout(hideCtx, 0); });

/* ---------- backpack: no slot limit, search, sort, filters, split and merge, a virtualized grid ---------- */
const BAG = { q: '', filter: 'All', rows: [0, 18], cols: 6, gridTop: 140 };
const BAG_FILTERS = { All: () => true, Weapons: d => d.cat === 'weapon' || !!d.wpn, Armor: d => d.cat === 'armor' || d.cat === 'shield' || !!d.legacy, Clothing: d => d.cat === 'clothing' || d.cat === 'jewelry',
  Resources: d => ['ore', 'metal', 'timber', 'hide', 'cloth', 'reagent', 'fitting', 'alch'].includes(d.cat), Consumables: d => ['potion', 'food', 'medic', 'ammo'].includes(d.cat), Tools: d => d.cat === 'tool', Other: d => !['weapon', 'armor', 'shield', 'clothing', 'jewelry', 'ore', 'metal', 'timber', 'hide', 'cloth', 'reagent', 'fitting', 'alch', 'potion', 'food', 'medic', 'ammo', 'tool'].includes(d.cat) };
const QUAL_RANK = { exceptional: 3, normal: 2, low: 1 };
const matKey = it => { const m = SF.matOf(it); return m ? EQ.matLabel(m) : '~'; };
const BAG_SORTS = { Category: null, Name: null, Quantity: (a, b) => b.qty - a.qty, Weight: (a, b) => SF.itemWt(b) - SF.itemWt(a), Material: (a, b) => matKey(a).localeCompare(matKey(b)),
  Quality: (a, b) => (QUAL_RANK[b.quality] || 0) - (QUAL_RANK[a.quality] || 0), Value: (a, b) => EQ.value(b) - EQ.value(a) };
const CELL_H = 71, HEAD_H = 30, BAG_VIRT_MIN = 240;   // above this many stacks only the rows near the scroll position are drawn
function bagItems() {
  const q = BAG.q.trim().toLowerCase(), f = BAG_FILTERS[BAG.filter] || BAG_FILTERS.All;
  const items = P.pack.items.filter(it => { const d = SF.ITEMS[it.id]; if (!d || !f(d)) return false; if (!q) return true; return (SF.itemName(it) + ' ' + (d.cat || '') + ' ' + (d.fam ? EQ.FAMILIES[d.fam].n + ' ' + matKey(it) : '')).toLowerCase().includes(q); });
  const cat = it => SF.ITEMS[it.id].cat || 'other', by = BAG_SORTS[bagSort];
  items.sort((a, b) => { if (bagSort === 'Category') { const c = cat(a).localeCompare(cat(b)); if (c) return c; } if (by) { const v = by(a, b); if (v) return v; } return SF.itemName(a).localeCompare(SF.itemName(b)) || a.uid - b.uid; });
  return items;
}
/* rows of the grid: group headers (category sort) and rows of up to BAG.cols cells, each with a known height */
function bagRows(items) {
  const rows = []; let y = 0, cur = null, group;
  for (const it of items) { const c = SF.ITEMS[it.id].cat || 'other';
    if (bagSort === 'Category' && c !== group) { group = c; rows.push({ head: c, y, h: HEAD_H }); y += HEAD_H; cur = null; }
    if (!cur || cur.items.length >= BAG.cols) { cur = { items: [], y, h: CELL_H }; rows.push(cur); y += CELL_H; }
    cur.items.push(it); }
  return { rows, h: y };
}
function bagCell(it, selected) {
  return `<button class="bagcell" data-a="baginspect" data-u="${it.uid}" data-drag="pack:${it.uid}" data-drop="pack:${it.uid}" aria-pressed="${selected === it}">${bagIcon(it, 40)}<small>${esc(SF.itemName(it))}</small>${it.qty > 1 ? '<strong>' + it.qty + '</strong>' : ''}${it.cond !== undefined && SF.WEARABLE(it.id) && it.cond < .2 * (it.maxc || 100) ? `<em class="wornmark">${it.cond <= 0 ? 'broken' : 'worn'}</em>` : ''}<span class="bagtip" role="tooltip">${bagStats(it)}</span></button>`;
}
function bagPanel2() {
  const all = P.pack.items, items = bagItems(), en = encumb(), gold = SF.count(P.pack, 'gold');
  let h = `<div class="note">${all.length} stack${all.length === 1 ? '' : 's'} · ${carriedText()} · ${gold} gold${en.stage ? ' · <span class="' + (en.stage >= 2 ? 'warn' : '') + '">' + en.n.toLowerCase() + (en.stage >= 3 ? ': drop something to move' : en.stage === 2 ? ': no running' : '') + '</span>' : ''}</div>`;
  h += `<div class="encbar s${en.stage}" title="${en.n}"><i style="width:${Math.min(100, en.ratio / 1.25 * 100)}%"></i><b style="left:${.75 / 1.25 * 100}%"></b><b style="left:${100 / 1.25}%"></b></div>`;
  h += `<div class="bagtools"><input id="bagq" type="search" placeholder="Search the backpack" value="${esc(BAG.q)}" autocomplete="off" aria-label="Search the backpack">${btn('bagmerge', 'Merge stacks')}${btn('eqwin', 'Paper doll')}</div>`;
  h += '<div class="bagsorts">Sort ' + Object.keys(BAG_SORTS).map(s => btn('bagsort', s, { s }, s === bagSort ? 'on' : '')).join('') + '</div>';
  h += '<div class="bagsorts bagfilters">' + Object.keys(BAG_FILTERS).map(f => btn('bagfilter', f, { f }, f === BAG.filter ? 'ac' : '')).join('') + '</div>';
  const selected = findU(P.pack, bagUid);
  if (selected) h += '<div class="bagcard">' + bagStats(selected) + '<div>' + bagActions2(selected) + '</div></div>';
  const { rows, h: total } = bagRows(items), [a, b] = items.length > BAG_VIRT_MIN ? BAG.rows : [0, 1e9];   // small packs draw every row
  let out = '', top = null, bottom = 0;
  for (const r of rows) { if (r.y + r.h < a * CELL_H || r.y > b * CELL_H) continue; if (top === null) top = r.y; bottom = r.y + r.h;
    out += r.head ? `<b class="baggroup">${esc(cap1(r.head))}</b>` : `<div class="bagrow" style="grid-template-columns:repeat(${BAG.cols},minmax(0,1fr))">${r.items.map(it => bagCell(it, selected)).join('')}</div>`; }
  h += `<div class="bagv" data-drop="pack" style="height:${total}px"><div class="bagwin" style="top:${top || 0}px">${out}</div></div>`;
  if (!items.length) h += `<p class="note">${all.length ? 'Nothing matches.' : 'Your backpack is empty.'}</p>`;
  return ['Backpack', h];
}
function bagActions2(it) {
  const d = SF.ITEMS[it.id]; let a = bagActions(it);
  if (d.stack && it.qty > 1) a = btn('split', 'Split half', { u: it.uid, q: Math.floor(it.qty / 2) }) + a;
  return a;
}
PANELS.bag = bagPanel2;
/* only the rows near the scroll position are in the page: re-render when the visible window moves */
function bagMeasure() {
  if (PANEL !== 'bag') return false; const pb = $('#panel .pb'), g = pb && pb.querySelector('.bagv'); if (!g) return false;
  const cols = Math.max(3, Math.floor((g.clientWidth + 5) / (67 + 5))); const gt = g.getBoundingClientRect().top - pb.getBoundingClientRect().top + pb.scrollTop;
  const a = Math.max(0, Math.floor((pb.scrollTop - gt) / CELL_H) - 8), b = Math.ceil((pb.scrollTop - gt + pb.clientHeight) / CELL_H) + 8;   // 8 rows of slack each way
  const changed = cols !== BAG.cols || a !== BAG.rows[0] || b !== BAG.rows[1]; BAG.cols = cols; BAG.rows = [a, b]; return changed;
}
document.addEventListener('scroll', e => { if (PANEL === 'bag' && e.target && e.target.matches && e.target.matches('#panel .pb') && bagMeasure()) renderPanel(); }, true);
addEventListener('resize', () => { if (PANEL === 'bag' && bagMeasure()) renderPanel(); });
const baseRender = renderPanel;
renderPanel = function (top) {
  const ae = document.activeElement, id = ae && ae.id, pos = ae && ae.selectionStart;
  baseRender(top);
  if (PANEL === 'bag' && bagMeasure()) baseRender();                       // first open: measure, then draw the right window
  if (id) { const el = document.getElementById(id); if (el && el !== document.activeElement) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (_) { } } }
};
document.addEventListener('input', e => { if (e.target && e.target.id === 'bagq') { BAG.q = e.target.value; BAG.rows = [0, BAG.rows[1] - BAG.rows[0]]; renderPanel(); } });

/* ---------- vendor, loot, bank and crafting rows: hover (or tap) an item name for the full tooltip ---------- */
// the row builders stay in game.js; tooltips attach to their item names after each render
const tipRows = () => {
  const pn = $('#panel'); if (!pn || pn.hidden || !P) return;
  const map = { loot: 'loot', bank: null, shop: 'shop' }; if (!(PANEL in map)) return;
  pn.querySelectorAll('.row').forEach(row => { const b = row.querySelector('[data-a]'); const nm = row.querySelector('.nm'); if (!b || !nm || nm.dataset.tip) return; const u = b.dataset.u, id = b.dataset.id;
    if (PANEL === 'loot' && u) nm.dataset.tip = 'loot:' + u; else if (PANEL === 'shop' && id) nm.dataset.tip = 'shop:' + id; else if (PANEL === 'shop' && u) nm.dataset.tip = 'pack:' + u;
    else if (PANEL === 'bank' && u) nm.dataset.tip = (b.dataset.a === 'wd' ? 'bank:' : 'pack:') + u; });
};
const baseRender2 = renderPanel; renderPanel = function (top) { baseRender2(top); try { tipRows(); } catch (_) { } };

/* ---------- crafting: the Armor category, its sub-families and material pickers ---------- */
const CRAFT_SUB = {};
const recMats = r => EQ.recipeMats(r) || (r.prim === 'metal' ? SF.METALS.map(a => a[0]) : null);
const matFor = r => { const ms = recMats(r); return ms ? (ms.includes(CUI.mat) ? CUI.mat : r.defMat) : null; };
const secFor = r => { const ss = EQ.recipeSecs(r); return ss ? (ss.includes(CUI.sec) ? CUI.sec : r.defSec) : null; };
rowStatus = function (r) {
  const p = SF.craftPlan(P, P.pack, r, matFor(r), secFor(r));
  if (p.sk < p.effMin) return ['needs ' + SF.SKILL[r.skill].n + ' ' + p.effMin, 'na'];
  if (p.missing.length) return ['missing inputs', 'miss'];
  const stn = craftStation(r); if (!stn.st) return [r.station === 'anvil' ? 'at the anvil' : 'at the ' + r.station, 'miss'];
  if (!toolState(r, stn.st).ok) return ['need ' + SF.ITEMS[r.tool].n.toLowerCase(), 'miss'];
  return [Math.round(p.chance * 100) + '%', 'ok'];
};
const matNote = r => r.prim === 'metal' ? '+ · any metal' : r.prim === 'hide' ? '+ · any hide' + (r.sec ? ', any stud metal' : '') : r.prim === 'wood' ? '+ · any wood' : r.fixedMat && r.fixedMat !== 'iron' ? ' · ' + EQ.matLabel(r.fixedMat) : '';
function craftPanel2() {
  if (!CUI) return null; const list = craftList();
  if (CUI.rid) return craftDetail2(SF.RECIPE[CUI.rid]);
  const cats = [...new Set(list.map(recipeCat))]; if (!CUI.cat || !cats.includes(CUI.cat)) CUI.cat = CUI.st === 'forge' ? 'Smelt' : CUI.st === 'anvil' ? 'Fittings' : cats[0];
  let h = `<div class="tabs">${cats.map(c => btn('ccat', c, { c }, c === CUI.cat ? 'ac' : '')).join('')}</div>`;
  let rows = list.filter(r => recipeCat(r) === CUI.cat);
  if (CUI.cat === 'Armor') { const subs = EQ.ARMOR_SUBS.filter(s => rows.some(r => r.sub === s)); if (!subs.includes(CRAFT_SUB[CUI.st])) CRAFT_SUB[CUI.st] = subs[0];
    h += `<div class="tabs subtabs">${subs.map(s => btn('csub', s, { s }, s === CRAFT_SUB[CUI.st] ? 'ac' : '')).join('')}</div>`; rows = rows.filter(r => r.sub === CRAFT_SUB[CUI.st]).sort((a, b) => a.min - b.min); }
  for (const r of rows) { const [st, cls] = rowStatus(r); const q = r.qty > 1 ? ` ×${r.qty}` : '';
    h += `<button class="crow ${cls}" data-a="crec" data-r="${r.id}">${rowIcon({ id: r.out, material: matFor(r) || undefined })}<span class="nm">${esc(recipeName(r))}${q}<br><span class="note">${SF.SKILL[r.skill].n} ${r.min}${matNote(r)}</span></span><span class="v">${esc(st)}</span><span class="chev">›</span></button>`; }
  return [STATION_N[CUI.st], h + `<p class="note">Failed attempts lose a quarter of each input, rounded up. Skill minimums are hard limits.</p>`];
}
function matButtons(r, list, cur, act, label) {
  return `<div class="note">${label}</div><div class="mats">${list.map(m => {
    const H = EQ.HIDES[m], M = SF.METAL[m], Wd = SF.WOOD && SF.WOOD[m];
    const resId = r.prim === 'hide' && act === 'cmat' ? EQ.hideItem(m) : M ? (act === 'csec' ? 'rivet' : SF.ingotId(m)) : Wd ? SF.logId(m) : null;
    const have = resId ? (act === 'csec' ? SF.countMat(P.pack, 'rivet', m) : SF.count(P.pack, resId)) : 0;
    const gate = act === 'csec' ? 0 : H ? H.gate : M ? M.smith : Wd ? Wd.work : 0, need = Math.max(r.min, gate), lock = act !== 'csec' && sv(r.skill) < need;
    const nm = H ? H.n : M ? M.n : Wd ? Wd.short : m, unit = act === 'csec' ? 'rivet' : H ? 'hide' : M ? 'ingot' : 'log';
    return `<button class="mat ${m === cur ? 'on' : ''} ${lock ? 'lk' : ''}" data-a="${act}" data-m="${m}"><i style="background:${EQ.matColor(m)}"></i>${esc(nm)}<small>${lock ? SF.SKILL[r.skill].n + ' ' + need : have + ' ' + unit + (have === 1 ? '' : 's')}</small></button>`; }).join('')}</div>`;
}
function craftDetail2(r) {
  const stn = craftStation(r), tool = toolState(r, stn.st), mats = recMats(r), secs = EQ.recipeSecs(r);
  CUI.mat = matFor(r) || CUI.mat; CUI.sec = secFor(r) || CUI.sec;
  const p = SF.craftPlan(P, P.pack, r, mats ? matFor(r) : null, secs ? secFor(r) : null), pct = v => (v * 100).toFixed(v * 100 % 1 ? 2 : 0).replace(/\.?0+$/, '') + '%';
  const why = p.reason || (!stn.st ? stn.why : !tool.ok ? tool.t : ''), can = !why;
  let h = `<div class="tabs">${btn('cback', '‹ Back')}<b class="dt">${esc(recipeName(r))}</b><span class="note" style="margin-left:auto">${p.sk < p.effMin ? 'too hard' : pct(p.chance) + ' success' + (p.quality ? ' · ' + pct(p.perExc) + ' exceptional' : '')}</span></div>`;
  if (mats) h += matButtons(r, mats, matFor(r), 'cmat', r.prim === 'hide' ? 'Leather' : r.prim === 'wood' ? 'Wood' : 'Metal');
  if (secs) h += matButtons(r, secs, secFor(r), 'csec', 'Stud metal (rivets)');
  h += `<div class="mk">${can ? '' : `<p class="warn" style="margin:2px 0">${esc(cap1(why))}</p>`}<div class="row">${btn('cmake', 'Make 1', { n: 1 }, can ? 'ac' : '')}${btn('cmake', 'Make 5', { n: 5 })}<span class="step">${btn('cn', '−', { d: -1 })}<b>${CUI.n}</b>${btn('cn', '+', { d: 1 })}</span>${btn('cmake', 'Make ' + CUI.n, { n: CUI.n })}</div></div>`;
  h += '<div class="sec">Inputs per attempt</div>';
  for (const l of p.lines) { const nm = (l.mat ? SF.matName(l.mat) + ' ' : '') + SF.ITEMS[l.id].n.toLowerCase(); h += `<div class="row">${rowIcon({ id: l.id })}<span class="nm">${l.qty} × ${esc(nm)}</span><span class="v ${l.have < l.qty ? 'warn' : ''}">have ${l.have}${l.have < l.qty ? ' · need ' + (l.qty - l.have) : ''}</span></div>`; }
  if (r.tool) h += `<div class="row"><span class="nm">Tool</span><span class="v ${tool.ok ? '' : 'warn'}">${esc(tool.t)}${tool.it ? ' · 1 use per attempt' : ''}</span></div>`;
  h += `<div class="row"><span class="nm">Station</span><span class="v ${stn.st ? '' : 'warn'}">${stn.st ? (r.station === 'anvil' ? 'anvil, forge alongside ✓' : r.station + ' ✓') : esc(stn.why)}</span></div>`;
  const gateTxt = p.gate > r.min ? ` · ${EQ.matLabel(p.mat)} needs ${p.gate}` : '';
  h += `<div class="sec">Odds</div><div class="kv"><span>Skill</span><span class="${p.sk < p.effMin ? 'warn' : ''}">${SF.SKILL[r.skill].n} ${p.sk.toFixed(1)} · minimum ${r.min}${gateTxt}</span><span>Difficulty</span><span>${p.diff}</span><span>Success</span><span>${p.sk < p.effMin ? '—' : pct(p.chance)}</span>`;
  if (p.quality) h += `<span>Exceptional</span><span>${p.sk < p.effMin ? '—' : pct(p.perExc) + ' per attempt (' + pct(p.exc) + ' of successes)'}</span>`;
  h += `<span>On failure</span><span>lose ${p.lines.map(l => l.fail + ' ' + SF.ITEMS[l.id].n.toLowerCase()).join(', ')}${r.tool && tool.it ? ', 1 tool use' : ''}</span>`;
  const o = SF.craftOutputs(P, p, false, {}, true)[0], ox = p.quality ? SF.craftOutputs(P, p, true, {}, true)[0] : null, d = SF.ITEMS[r.out];
  let ot = `${o.qty > 1 ? o.qty + ' × ' : ''}${SF.itemName(o)}`;
  h += `<span>You make</span><span data-tip="craft:${r.id}|${p.mat || ''}|${p.sec || ''}">${esc(ot)}</span><span>Resulting weight</span><span>${f1w(SF.itemWt(o))}</span>`;
  if (d.fam && d.cat !== 'jewelry') h += `<span>${d.cat === 'shield' ? 'Shield AR' : 'Expected protection'}</span><span>${d.cat === 'shield' ? f1w(EQ.shieldAR(o)) : f1w(EQ.protection(o))}${ox ? ' (' + (d.cat === 'shield' ? f1w(EQ.shieldAR(ox)) : f1w(EQ.protection(ox))) + ' exceptional)' : ''}</span>`;
  if (o.omax) h += `<span>Durability</span><span>${o.omax}${ox && ox.omax !== o.omax ? ' (' + ox.omax + ' exceptional)' : ''}</span>`;
  if (d.str) h += `<span>Required Strength</span><span>${d.str}</span>`; if (d.dex) h += `<span>Dexterity</span><span>${d.dex}</span>`; if (d.med) h += `<span>Meditation</span><span>−${Math.round(d.med * 100)}%</span>`;
  h += `<span>Time</span><span>${SF.craftTime(r)} s each</span></div>`;
  if (p.quality && p.sk >= 100) h += `<div class="row"><span class="nm">Maker's mark on exceptional pieces</span>${btn('cmark', P.cx.mark ? 'On' : 'Off', {}, P.cx.mark ? 'ac' : '')}</div>`;
  h += '<p class="note">A batch stops if you move, take damage, cancel or run short. Up to 20 attempts.</p>';
  return ['Crafting', h];
}
craftDetail = craftDetail2; PANELS.craft = craftPanel2;

/* ---------- actions ---------- */
Object.assign(ACT, {
  eqwin: () => toggleEqWin(), eqclose: () => toggleEqWin(false),
  eqsel: d => { EQW.sel = EQW.sel === d.s ? null : d.s; renderEqWin(true); },
  bagfilter: d => { BAG.filter = d.f; BAG.rows = [0, 18]; renderPanel(); },
  bagsort: d => { bagSort = d.s; BAG.rows = [0, 18]; renderPanel(); },
  split: d => { const r = EQ.splitStack(P.pack, { uid: d.u, qty: +d.q }); if (!r.ok) log(cap1(r.reason) + '.', '#ffb070'); renderPanel(); },
  mergekind: d => { const it = findU(P.pack, d.u); if (!it) return; for (const o of P.pack.items.slice()) if (o !== it && SF.canStack(o, it)) EQ.mergeStacks(P.pack, { from: o.uid, into: it.uid }); renderPanel(); },
  bagmerge: () => { const n = EQ.mergeAll(P.pack); log(n ? `Merged ${n} stack${n === 1 ? '' : 's'}.` : 'Nothing to merge.'); renderPanel(); },
  csub: d => { CRAFT_SUB[CUI.st] = d.s; renderPanel(true); snd('ui.page'); },
  csec: d => { CUI.sec = d.m; renderPanel(); } });
/* test hook additions (see tests/equipment-smoke) */
if (window.__SF) Object.assign(window.__SF, { EQ, toggleEqWin, renderEqWin, equipUid, unequipTo, EQW, BAG, openCraft, performDrop, eqTick, encumb, itemTip, tipItem, playerMove, SHOPS, get CRAFT_SUB() { return CRAFT_SUB; } });
