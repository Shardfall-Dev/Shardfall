
/* ================= HUD UI (v0.29): item tooltips and popup, popup manager, the compact target frame =================
   UI state only. Nothing here changes item statistics or the save; every item change still goes through the existing ACT
   handlers and the validated SF.EQ commands. The five ideas the code keeps apart:
     selected inventory item   bagUid (game.js)       the highlighted backpack tile
     inspected inventory item  IPOP.key               the item whose information popup is open
     selected world entity     P.sel                  what the target frame shows
     active combat target      combatTarget()         P.sel while the attack is armed (the armed swing never acquires)
     active interaction target interactTarget()       what Interact (E) would act on: the selection when it is in reach */

/* ---------- popup manager: one stack, Escape closes the top entry, outside taps close without reaching the world ---------- */
const UIPOP = { stack: [] };
function popOpen(id, close) { popDrop(id); UIPOP.stack.push({ id, close }); }
function popDrop(id) { const i = UIPOP.stack.findIndex(p => p.id === id); if (i >= 0) UIPOP.stack.splice(i, 1); }
function popClose(id) { const p = UIPOP.stack.find(q => q.id === id); if (p) { popDrop(id); p.close(); } }
const popTop = () => UIPOP.stack[UIPOP.stack.length - 1] || null;
/* Escape: the newest popup first; the game's own handler (panels, screens, cancel, clear target) only sees it when none is open */
addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !P) return; const top = popTop(); if (!top) return;
  e.preventDefault(); e.stopImmediatePropagation(); popDrop(top.id); top.close(); snd('ui.close');
}, true);
/* a press outside an open popup closes it; on the game world it does nothing else (no walk, no target, no attack) */
document.addEventListener('pointerdown', e => {
  if (!UIPOP.stack.length) return;
  const keep = e.target.closest('#ipop,#ctxm,#itip');
  if (keep) return;
  const onTile = e.target.closest('[data-a=baginspect]');            // another backpack tile switches the popup on its click
  if (!onTile) for (const p of UIPOP.stack.slice()) if (p.id === 'ipop') popClose('ipop');
  if (e.target === cv || e.target.closest('#c')) { e.stopPropagation(); e.preventDefault(); CLICK_SWALLOW = performance.now() + 400; }
}, true);
let CLICK_SWALLOW = 0;
document.addEventListener('click', e => { if (performance.now() < CLICK_SWALLOW && (e.target === cv)) { e.stopPropagation(); e.preventDefault(); } }, true);

/* ---------- item tooltip (desktop hover, about 300 ms) ---------- */
const TIP_DELAY = 300;
const HOV = { t: 0, key: null, x: 0, y: 0 };
function tipCancel() { clearTimeout(HOV.t); HOV.t = 0; HOV.key = null; }
/* replaces the instant hover handlers of v0.25: one delayed tooltip for every [data-tip], backpack tiles included */
document.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse' || DRAG.on) return; const t = e.target.closest('[data-tip]'); if (!t) return;
  if (t.contains(e.relatedTarget)) return;
  const key = t.dataset.tip; if (IPOP.key === key) return;
  if (ITIP.key === key && !ITIP.pin) return;
  tipCancel(); if (ITIP.key && !ITIP.pin) hideTip();
  HOV.key = key; HOV.x = e.clientX; HOV.y = e.clientY;
  HOV.t = setTimeout(() => { if (HOV.key === key && !DRAG.on && IPOP.key !== key && document.querySelector('[data-tip="' + CSS.escape(key) + '"]:hover')) showTip(key, HOV.x, HOV.y); HOV.t = 0; }, TIP_DELAY);
}, true);
document.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && HOV.t) { HOV.x = e.clientX; HOV.y = e.clientY; } }, true);
document.addEventListener('pointerout', e => {
  if (e.pointerType !== 'mouse') return; const t = e.target.closest('[data-tip]'); if (!t || t.contains(e.relatedTarget)) return;
  if (HOV.key === t.dataset.tip) tipCancel(); if (!ITIP.pin && ITIP.key === t.dataset.tip) hideTip();
}, true);
{ const pin = showTip; showTip = function (key, x, y, pinned) { pin(key, x, y, pinned); const el = $('#itip'); el.classList.remove('pop-in'); void el.offsetWidth; el.classList.add('pop-in');
    if (pinned) popOpen('itip', () => hideTip()); }; }
{ const base = hideTip; hideTip = function () { base(); popDrop('itip'); }; }
addEventListener('blur', () => { tipCancel(); hideTip(); });

/* ---------- item information popup (click or tap a backpack tile) ---------- */
const IPOP = { key: null, cmp: false, confirm: null, sig: '', html: '', at: null };
const FINE = matchMedia('(hover: hover) and (pointer: fine)');
const DROP_CONFIRM_GOLD = 25;   // an item (or stack) worth this much, or anything exceptional, rare, magical or marked, asks before it drops
function ipopItem(key) { if (!key || !P) return null; const i = key.indexOf(':'), k = key.slice(0, i), v = key.slice(i + 1); return k === 'pack' ? findU(P.pack, v) : k === 'eq' ? P.equip[v] : null; }
function itemWorth(it) { const d = SF.ITEMS[it.id]; if (!d) return 0; if (it.id === 'gold') return it.qty || 1; return d.fam ? EQ.value(it) : (SF.PRICES[it.id] || 0) * (it.qty || 1); }
function isValuable(it, q) {
  const d = SF.ITEMS[it.id]; if (!d) return false; const part = q && it.qty > 1 ? Math.min(1, q / it.qty) : 1;   // dropping part of a stack: that part's worth
  return itemWorth(it) * part >= DROP_CONFIRM_GOLD || it.quality === 'exceptional' || !!d.rare || !!d.spell || it.id === 'spellbook' || !!(it.mark) || !!it.creatorName || !!it.venom;
}
/* short, factual descriptions from the item's own data; nothing for items whose data says nothing */
function itemDesc(it) {
  const d = SF.ITEMS[it.id], c = SF.CONSUMABLES[it.id]; if (!d) return '';
  if (c) return c.heal ? `Restores ${c.heal} hit points.` : c.stam ? `Restores ${c.stam} stamina.` : c.mana ? `Restores ${c.mana} mana.` : c.cure ? 'Cures poison.' : c.blast ? `Bursts for ${c.blast} damage in ${c.radius} m after ${c.fuse} s.` : '';
  if (d.spell && SF.SPELL[d.spell]) return `A scroll of ${SF.SPELL[d.spell].n}.`;
  if (it.id === 'spellbook') return (it.spells || []).length + ' spells inscribed.';
  if (it.id === 'rune') return it.mark ? 'Marked: ' + it.mark.name + '.' : 'Unmarked.';
  if (d.use === 'eat') return 'Food.'; if (d.use === 'bandage') return 'Binds wounds; with Healing it cures and resurrects.';
  return '';
}
/* magical properties from the item itself (venom charges, enchanted spells); none for plain goods */
function itemMagic(it) { const L = []; if (it.venom) L.push('Venom · ' + it.venom.charges + ' charge' + (it.venom.charges === 1 ? '' : 's')); if (it.magic) for (const [k, v] of Object.entries(it.magic)) L.push(cap1(k) + ' ' + v); return L; }
function ipopActions(it, key) {
  const d = SF.ITEMS[it.id], [k, v] = key.split(':'); let a = '';
  if (k === 'eq') { if (d.trade || it.id === 'garment') a += btn('uneq', 'Unequip', { s: v }); if (SF.WEARABLE(it.id) && it.cond !== undefined && it.cond < (it.maxc || 100)) a += btn('repair', 'Repair', { u: it.uid }); if (d.trade) a += btn('drop', 'Drop', { u: it.uid }); return a; }
  a = bagActions2(it);
  if (d.stack && it.qty > 1) a = a.replace(/(<button[^>]*data-a="split"[^>]*>Split half<\/button>)/, '$1' + btn('split', 'Split 1', { u: it.uid, q: 1 }));
  if (d.slot && EQ.SLOT[d.slot]) a += btn('ipcmp', IPOP.cmp ? 'Hide compare' : 'Inspect', {}, IPOP.cmp ? 'on' : '');
  return a;
}
function ipopHtml(it, key) {
  const d = SF.ITEMS[it.id];
  let h = `<button class="x ipx" data-a="ipclose" aria-label="Close item information">×</button>` + itemTip(it, { compare: false, icon: 44 });
  const desc = itemDesc(it), mg = itemMagic(it);
  if (mg.length) h += `<div class="ipmag">${mg.map(esc).join('<br>')}</div>`;
  if (desc) h += `<p class="ipdesc">${esc(desc)}</p>`;
  if (IPOP.cmp && d.slot && EQ.SLOT[d.slot]) { const cur = P.equip[d.slot]; h += compareLines(it) || `<div class="cmp"><span class="note">${cur === it ? 'This is what you wear.' : cur ? 'Same as ' + esc(SF.itemName(cur)) + '.' : 'Nothing worn there.'}</span></div>`;
    if (cur && cur !== it) h += `<details class="ipcur"><summary>Worn: ${esc(SF.itemName(cur))}</summary>${itemTip(cur, { compare: false, icon: 28 })}</details>`; }
  if (IPOP.confirm) { const c = IPOP.confirm; h += `<div class="ipconfirm" role="alertdialog"><b>Drop ${esc((it.qty > 1 ? it.qty + ' × ' : '') + SF.itemName(it))}?</b><span class="note">Worth about ${itemWorth(it)} gold. Anyone can pick it up.</span><div class="acts">${btn('drop', 'Drop it', { u: c.u, q: c.q || '', ok: 1 }, 'on')}${btn('ipnodrop', 'Keep', {}, 'ac')}</div></div>`; }
  else h += `<div class="acts ipacts">${ipopActions(it, key)}</div>`;
  return h;
}
function placeIpop() {
  const el = $('#ipop'); if (el.hidden) return; const w = el.offsetWidth, h = el.offsetHeight;
  const cell = IPOP.key && IPOP.key.startsWith('pack:') ? document.querySelector(`#panel .bagcell[data-u="${IPOP.key.slice(5)}"]`) : null;
  const r = cell ? cell.getBoundingClientRect() : IPOP.at; if (cell) IPOP.at = { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  let L, T;
  if (r) { L = r.right + 8; if (L + w > VW - 6) L = r.left - w - 8; if (L < 6) L = cl((r.left + r.right) / 2 - w / 2, 6, Math.max(6, VW - w - 6)); T = cl(r.top, 6, Math.max(6, VH - h - 6)); }
  else { L = (VW - w) / 2; T = (VH - h) / 2; }
  el.style.left = Math.round(L) + 'px'; el.style.top = Math.round(T) + 'px';
}
function openItemPop(key) {
  const it = ipopItem(key); if (!it) return closeItemPop();
  tipCancel(); hideTip(); hideCtx(); popClose('ctxm');
  const fresh = IPOP.key !== key; IPOP.key = key; if (fresh) { IPOP.cmp = false; IPOP.confirm = null; IPOP.at = null; }
  IPOP.sig = ''; refreshItemPop(true); const el = $('#ipop'); if (fresh) { el.classList.remove('pop-in'); void el.offsetWidth; el.classList.add('pop-in'); }
  popOpen('ipop', () => closeItemPop(true));
}
function closeItemPop(fromStack) {
  const el = $('#ipop'); if (!IPOP.key && el.hidden) return; IPOP.key = null; IPOP.cmp = false; IPOP.confirm = null; IPOP.sig = ''; IPOP.html = ''; el.hidden = true; el.innerHTML = '';
  if (!fromStack) popDrop('ipop');
  if (bagUid !== null && PANEL === 'bag') { bagUid = null; renderPanel(); }
}
/* cheap signature first: the popup is rebuilt only when the item (or what it is compared with) actually changed */
function refreshItemPop(force) {
  if (!IPOP.key) return; const it = ipopItem(IPOP.key);
  if (!it || !P || P.ghost || (IPOP.key.startsWith('pack:') && PANEL !== 'bag')) return closeItemPop();
  const d = SF.ITEMS[it.id], cur = d.slot ? P.equip[d.slot] : null;
  const sig = [it.uid, it.qty, it.cond, it.uses, it.quality, cur && cur.uid, cur && cur.cond, IPOP.cmp, IPOP.confirm && IPOP.confirm.u, Math.round(P.str), Math.round(P.stam / 10)].join('|');
  if (!force && sig === IPOP.sig) return; IPOP.sig = sig;
  const el = $('#ipop'), html = ipopHtml(it, IPOP.key); if (html !== IPOP.html) { el.innerHTML = html; IPOP.html = html; } el.hidden = false; el.classList.toggle('touch', !FINE.matches); placeIpop();
}
/* every way an item can be dropped (popup, context menu, paper doll) asks first when it is valuable */
{ const baseDrop = ACT.drop; ACT.drop = (d, b) => {
    const it = findU(P.pack, d.u) || Object.values(P.equip).find(x => x && x.uid === +d.u);
    if (it && !d.ok && isValuable(it, +d.q || 0)) { hideCtx(); popClose('ctxm'); const key = findU(P.pack, d.u) ? 'pack:' + it.uid : 'eq:' + Object.keys(P.equip).find(s => P.equip[s] === it);
      if (IPOP.key !== key) openItemPop(key); IPOP.confirm = { u: it.uid, q: d.q }; refreshItemPop(true); return; }
    IPOP.confirm = null; baseDrop(d, b); refreshItemPop(true); }; }
Object.assign(ACT, {
  baginspect: d => { const key = 'pack:' + d.u; if (IPOP.key === key) { closeItemPop(); return; } bagUid = +d.u; renderPanel(); openItemPop(key); },
  ipclose: () => { closeItemPop(); snd('ui.close'); },
  ipcmp: () => { IPOP.cmp = !IPOP.cmp; refreshItemPop(true); },
  ipnodrop: () => { IPOP.confirm = null; refreshItemPop(true); } });
{ const base = openCtx; openCtx = function (src, x, y) { closeItemPop(); base(src, x, y); if (!$('#ctxm').hidden) popOpen('ctxm', () => hideCtx()); }; }
{ const base = hideCtx; hideCtx = function () { base(); popDrop('ctxm'); }; }
{ const base = closePanel; closePanel = function () { base(); if (IPOP.key) closeItemPop(); }; }
{ const base = renderPanel; renderPanel = function (top) { base(top); if (IPOP.key) refreshItemPop(); }; }
{ const base = refreshHud; refreshHud = function () { base(); if (IPOP.key) refreshItemPop(); }; }   // a hotbar draught changes the open stack too
addEventListener('resize', () => { if (IPOP.key) placeIpop(); });
/* ---------- the target frame: hidden until you pick something, compact, cleared when it no longer makes sense ---------- */
/* retention distances in world tiles (1 tile = 1 m). These only decide how long the frame keeps a target; attack, spell and
   interaction ranges are separate rules and are not read or changed here. */
const TARGET_RETAIN = { creature: 12, object: 5, slack: 1, grace: .75, jump: 6 };
const TGT = { ref: null, lim: 0, far: 0, lv: 0, px: 0, py: 0, more: false, h: '', reason: '' };
const isCreature = t => t && (t.kind === 'mon' || t.kind === 'npc' || t.kind === 'ally' || t.kind === 'pet' || t.kind === 'player');
const tgtDist = t => t.kind === 'node' ? Math.hypot(t.x + .5 - P.x, t.y + .5 - P.y) : dist(t, P);
const combatTarget = () => P && P.armed && P.sel && P.sel.kind === 'mon' ? P.sel : null;
function interactTarget() { const s = P && P.sel; if (!s || s === P) return null; const d = tgtDist(s); return (s.kind === 'npc' && d <= 2.5) || (s.kind === 'corpse' && d <= 2) || (s.kind === 'node' && d <= 2.2) ? s : null; }
/* why a target stops being valid: gone from the world, dead without a corpse hand-over, hidden, a node whose ground changed */
function tgtInvalid(t) {
  if (t === P) return P.ghost ? 'ghost' : '';
  if (t.gone) return 'gone';
  if (t.kind === 'node') { if (t.skill === 'fishing') return tAt(t.x, t.y) === T.WA ? '' : 'gone'; return NODE[tAt(t.x, t.y)] === t.skill ? '' : 'depleted'; }
  if (!ents.includes(t)) return 'gone';
  if (t.kind === 'mon' && (t.dead || t.hp <= 0)) return 'dead';
  if (t.hidden) return 'hidden';
  return '';
}
/* clearing the selection always ends the armed attack on it: the swing only ever hits the selected creature, so a
   cleared frame never keeps attacking something you can no longer see (same as the × button since v0.18c) */
function tgtClear(reason) {
  if (!P || !P.sel) return; if (P.armed) P.armed = false;
  P.sel = null; TGT.ref = null; TGT.more = false; TGT.reason = reason || 'manual';
  const el = $('#tgt'); el.hidden = true; el._h = ''; TGT.h = '';
}
function tgtTrack() {
  const t = P.sel; if (!t) { TGT.ref = null; return false; }
  const lv = levelAt(Math.floor(P.x), Math.floor(P.y));
  if (t !== TGT.ref) { TGT.ref = t; TGT.more = false; TGT.far = 0; TGT.lv = lv; TGT.px = P.x; TGT.py = P.y; TGT.reason = '';
    const R = isCreature(t) ? TARGET_RETAIN.creature : TARGET_RETAIN.object; TGT.lim = t === P ? Infinity : Math.max(R, tgtDist(t)) + TARGET_RETAIN.slack; return true; }
  const why = tgtInvalid(t); if (why) { tgtClear(why); return false; }
  const jumped = Math.hypot(P.x - TGT.px, P.y - TGT.py) > TARGET_RETAIN.jump; TGT.px = P.x; TGT.py = P.y;
  if (t !== P && (lv !== TGT.lv || jumped)) { tgtClear(lv !== TGT.lv ? 'area' : 'travel'); return false; }
  if (t === P || (DEV.on && DEV.open)) return true;   // the developer panel's inspector follows its actor anywhere
  const R = isCreature(t) ? TARGET_RETAIN.creature : TARGET_RETAIN.object, d = tgtDist(t);
  TGT.lim = Math.max(R + TARGET_RETAIN.slack, Math.min(TGT.lim, d + TARGET_RETAIN.slack));   // picked from afar: the limit closes in as you approach, never below R + slack
  if (d > TGT.lim) { if (!TGT.far) TGT.far = GT; else if (GT - TGT.far >= TARGET_RETAIN.grace) { tgtClear('distance'); return false; } }
  else TGT.far = 0;                                                     // back inside: the grace timer resets (no flicker at the edge)
  return true;
}
const ROLE_N = { banker: 'Banker', campbank: 'Camp banker', smith: 'Smith', qsmith: 'Quay smith', trainer: 'Trainer', workshop: 'Workshop', apothecary: 'Apothecary', provisioner: 'Provisioner', guard: 'Guard', healer: 'Healer', assay: 'Assayer', quaywarden: 'Quaywarden', traveller: 'Traveller', trader: 'Travelling merchant', boat: 'Boatman', ferry: 'Ferryman', outlaw: 'Outlaw' };
function npcLabel(t) { const nm = String(t.name || ''), i = nm.indexOf(', '); const prof = t.life && t.life.prof; const role = i > 0 ? nm.slice(i + 2) : ROLE_N[t.role] || ROLE_N[prof] || (t.role ? cap1(String(t.role)) : prof ? cap1(String(prof)) : 'Townsperson'); return [i > 0 ? nm.slice(0, i) : nm, cap1(role)]; }
function npcAction(t) { if (t.role === 'banker' || t.role === 'campbank') return 'Bank'; if (SHOPS[t.role]) return 'Trade'; return 'Talk'; }
const hpBar = (f, col) => `<div class="bar sm tf-hp"><i style="width:${Math.round(cl(f, 0, 1) * 100)}%;background:${col || (f > .5 ? '#5fd068' : f > .25 ? '#f0c040' : '#f04848')}"></i></div>`;
function tfModel(t) {
  const m = { dot: 'neu', name: '', sub: [], bar: '', chips: [], acts: '', more: '' }; const dm = Math.round(tgtDist(t)) + ' m';
  if (t === P) { m.dot = 'self'; m.name = P.name; m.sub.push('You'); m.bar = hpBar(P.hp / SF.maxHp(P)); m.acts = btn('useitem', 'Bandage', { id: 'bandage' }); m.more = btn('abil', 'Anatomy', { id: 'anatomy' }); }
  else if (t.kind === 'player') { const n = t.noto || 'innocent'; m.dot = n === 'murderer' ? 'red' : n === 'criminal' ? 'grey' : 'blue'; m.name = t.name; m.sub.push(cap1(n)); m.sub.push(dm); m.bar = t.ghost ? '' : hpBar(t.hp / t.max); }
  else if (t.kind === 'ally') { m.dot = 'blue'; m.name = t.name; m.sub.push(t.ghost ? 'Ghost' : 'Ally · ' + (t.order === 'follow' ? 'following' : 'holding')); m.sub.push(dm); if (t.poison) m.chips.push(['Poisoned', 'warn']); if (!t.ghost) m.bar = hpBar(t.hp / t.max);
    m.acts = btn('bandother', t.ghost ? 'Resurrect' : t.poison ? 'Cure' : 'Bandage', {}, 'ac') + (t.ghost ? '' : btn('allycmd', t.order === 'follow' ? 'Hold' : 'Follow', { c: t.order === 'follow' ? 'wait' : 'follow' })); m.more = t.ghost ? '' : btn('abil', 'Anatomy', { id: 'anatomy' }); }
  else if (t.kind === 'pet') { m.dot = 'blue'; m.name = t.name; m.sub.push('Pet · ' + (t.order || 'follow')); m.sub.push(dm); m.bar = hpBar(t.hp / t.max, '#5fd068');
    m.acts = btn('petcmd', 'Follow', { c: 'follow' }) + btn('petcmd', 'Stay', { c: 'stay' }); m.more = (t.type ? btn('abil', 'Treat', { id: 'vet' }) : '') + btn('petcmd', 'Dismiss', { c: 'dismiss' }); }
  else if (t.kind === 'mon') { const d = MON[t.type] || {}, pr = ecoP(t.type), hostile = ecoEnemy(t, P) || t.target === P;
    m.dot = d.boss ? 'boss' : hostile ? 'red' : 'grey'; m.name = t.name; m.sub.push(d.boss ? 'Boss' : hostile ? 'Hostile' : pr.temper === 'timid' ? 'Timid' : 'Wild');
    const st = { idle: '', chase: t.target === P ? 'after you' : 'hunting', tele: 'winding up!', strike: 'striking', rec: 'recovering', return: 'leashing back', flee: 'fleeing' }[t.state]; if (st) m.sub.push(st); m.sub.push(dm);
    m.bar = hpBar(t.hp / t.max);
    if (combatTarget() === t) m.chips.push(['⚔ Attacking', 'atk']); if (t.poison) m.chips.push(['Poisoned', 'warn']); if (t.rooted > GT) m.chips.push(['Rooted', '']); if (t.pacified > GT) m.chips.push(['Lulled', '']); if (t.ward > 0) m.chips.push(['Ward', '']);
    if (ents.some(e => e.kind === 'pet' && !e.gone)) m.acts += btn('petcmd', 'Pets attack', { c: 'attack' }, 'on');
    if (d.tame && !d.boss) m.more += btn('abil', 'Tame', { id: 'tame' }); if (SF.count(P.pack, 'lute') && !d.boss) m.more += btn('abil', 'Lullaby', { id: 'lullaby' }) + btn('abil', 'Discord', { id: 'discord' }) + btn('abil', 'Provoke', { id: 'provoke' });
    if (d.purse && t.target !== P) m.more += btn('abil', 'Pickpocket', { id: 'pick' }); m.more += btn('abil', 'Anatomy', { id: 'anatomy' }); }
  else if (t.kind === 'npc') { const [nm, role] = npcLabel(t), q = questObjective(); m.dot = t.role === 'outlaw' ? 'red' : 'blue'; m.name = nm; m.sub.push(role); m.sub.push(dm); if (q && q.at === t) m.chips.push(['! Quest', 'quest']); if (t.downed) m.chips.push(['Knocked down', 'warn']); else if (t.npcFight && t.hp < t.max) m.bar = hpBar(t.hp / t.max); if (t.foe && alive(t.foe)) m.chips.push(['⚔ Fighting', 'atk']);
    m.acts = `<button class="btn sm ac" data-a="interact">${npcAction(t)}</button>`; }
  else if (t.kind === 'corpse') { m.dot = 'item'; m.name = t.name; const ls = t.cont && Number.isFinite(t.cont.diedAt) ? SF.lootStatus(t.cont, P.id, GT) : null;   // loot rights exist only on bodies that carry them (player bodies today) if (t.cont) m.sub.push(t.cont.items.length ? t.cont.items.length + ' stack' + (t.cont.items.length === 1 ? '' : 's') : 'empty'); m.sub.push(dm);
    if (ls && (t.mine || !ls.lawful)) m.chips.push([cap1(ls.label), ls.lawful ? '' : 'warn']);
    m.acts = `<button class="btn sm ac" data-a="interact">Loot</button>${t.mon && !t.skinned ? '<button class="btn sm" data-a="skin">Skin</button>' : ''}`; }
  else if (t.kind === 'node') { const fish = t.skill === 'fishing', rw = t.skill === 'mining' || t.skill === 'lumberjacking', tier = fish ? 0 : nodeTier(t.x, t.y), need = SF.NODE_TIER_MIN[tier];
    m.dot = 'res'; m.name = cap1(rw ? nodeLabel(t) : t.name); if (t.skill === 'mining' && m.name === 'Rock face') m.name = 'Mining deposit';
    m.sub.push(SF.SKILL[t.skill].n + (need ? ' ' + need : '')); if (!fish) m.sub.push(rw ? nodeNote(t) : nodeStock(t.x, t.y).n + ' left'); if (!fish && isQuayNode(t.x, t.y)) m.sub.push('training'); m.sub.push(dm);
    if (need && sv(t.skill) < need) m.chips.push([`Needs ${SF.SKILL[t.skill].n} ${need}`, 'warn']);
    m.acts = `<button class="btn sm ac" data-a="interact">${t.skill === 'mining' ? 'Mine' : t.skill === 'lumberjacking' ? 'Chop' : fish ? 'Fish' : 'Gather'}</button>` + (rw ? `<button class="btn sm" data-a="survey">${t.skill === 'mining' ? 'Survey' : 'Read grain'}</button>` : ''); }
  return m;
}
renderTarget = function () {
  const el = $('#tgt');
  if (!P || P.ghost || !P.sel || !tgtTrack()) { if (!el.hidden) { el.hidden = true; el._h = ''; TGT.h = ''; } return; }
  const m = tfModel(P.sel);
  const moreBtn = m.more ? `<button class="tf-more${TGT.more ? ' on' : ''}" data-a="tfmore" aria-expanded="${TGT.more}" aria-label="More actions" title="More actions">⋯</button>` : '';
  let h = `<div class="tf-h"><i class="tf-dot ${m.dot}" aria-hidden="true"></i><b class="tf-n">${esc(m.name)}</b>${moreBtn}<button class="x tf-x" data-a="desel" aria-label="Clear target" title="Clear target (Esc)">×</button></div>`;
  h += `<div class="tf-sub">${m.sub.map(esc).join(' · ')}</div>` + m.bar;
  if (m.chips.length) h += `<div class="tf-chips">${m.chips.map(([c, k]) => `<span class="tf-chip ${k}">${esc(c)}</span>`).join('')}</div>`;
  if (m.acts || TGT.more) h += `<div class="acts tf-acts">${m.acts}${TGT.more ? m.more : ''}</div>`;
  if (h === TGT.h && !el.hidden) return;
  const appear = el.hidden; TGT.h = h; el.innerHTML = h; el._h = h; el.hidden = false; if (appear) { el.classList.remove('pop-in'); void el.offsetWidth; el.classList.add('pop-in'); }
};
Object.assign(ACT, { desel: () => tgtClear('manual'), tfmore: () => { TGT.more = !TGT.more; } });
/* Escape with nothing open: cancel what you are doing first (cast, aim, task, armed attack), then clear the target */
function escapeWorld() {
  if (AIM || P.prep || P.held || P.task || P.batch || P.armed || P.meditating) { ACT.cancel(); return 'cancel'; }
  if (P.sel) { tgtClear('escape'); return 'target'; }
  ACT.cancel(); return 'none';
}

/* test hook additions (see tests/ui-smoke) */
if (window.__SF) Object.assign(window.__SF, { UIPOP, IPOP, TGT, TARGET_RETAIN, openItemPop, closeItemPop, refreshItemPop, tgtClear, tgtTrack, combatTarget, interactTarget, isValuable, escapeWorld, renderTarget: () => renderTarget(), closePanel: () => closePanel(), refreshHud: () => refreshHud(), get bagUid() { return bagUid; } });   // the wrapped versions
