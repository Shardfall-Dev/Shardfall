/* ================= MAGIC: the Eight Circles in the world (prepare → hold → release) =================
   Rules and data live in src/magery.js (SF.MAGERY). This file adapts them to the game: casting state, targets,
   effects, fields, runes, summons, the spellbook panel and the hotbar signs. Brief: docs/magery/Magery_Brief.txt.
   Runs inside the game block: everything here is called at run time, after src/game.js has defined its state. */
const MG = SF.MAGERY;
const TIMERS = []; function at(d, fn) { TIMERS.push({ t: GT + d, fn }); }
const FIELDS = [], GATES = [], RESOLVED = new Set();
let CASTID = 0;

/* ---------- actors: one view of the player, pets, summons and creatures ---------- */
const isLiving = a => a && (a === P ? !P.ghost : alive(a) && (a.kind === 'mon' || a.kind === 'pet' || (a.kind === 'ally' && !a.ghost)));
const isPlayerGhost = e => (e.kind === 'player' || e.kind === 'ally') && e.ghost;
const mgOf = a => a.mg || (a.mg = {});
const MON_R = m => { const d = MON[m.type]; return d && d.resist !== undefined ? d.resist : cl(Math.round((d ? d.diff : 30) - 15), 0, 100); };   // tuning: creature Wardcraft
const rOf = a => a === P ? sv('resistingspells') : a.summon ? 30 : MON_R(a);
const intOf = a => a === P ? P.int : a.summon ? (a.summon.int || 40) : (MON[a.type] && MON[a.type].int) || 20 + Math.round(((MON[a.type] || {}).diff || 30) * .6);   // tuning
const tacticsOf = a => a === P ? sv('tactics') : (MON[a.type] || {}).atk || 40;
const nameOf = a => a === P ? 'you' : a.name || (MON[a.type] || {}).n || 'it';
const mval = () => sv('magery'), eval_ = () => sv('evaluatingintelligence');
function knownSpells() { return MG.bookSpells(P.pack); }
function hurt(a, amt, src, kind) { if (amt <= 0) { floater(a.x, a.y, '0', '#c8c8c8'); return; } damageActor(a, amt, kind, src); }   // the shared damage entry (src/game.js)
function aggro(a, src) { if (a !== P && a.kind === 'mon' && alive(a) && !a.target) { a.target = src || P; a.state = 'chase'; } }
function healActor(a, amt) { const max = a === P ? SF.maxHp(P) : a.max; const b = a.hp; a.hp = Math.min(max, a.hp + amt); FX.push({ k: 'heal', x: a.x, y: a.y, t0: GT, dur: .8 }); floater(a.x, a.y, '+' + Math.round(a.hp - b), '#7ee08a'); return a.hp - b; }
function livingNear(x, y, r, pred) { const out = []; for (const e of ents) if (isLiving(e) && Math.hypot(e.x - x, e.y - y) <= r + 1e-6 && (!pred || pred(e))) out.push(e); return out; }
function standable(x, y) { const tx = Math.floor(x), ty = Math.floor(y); if (x < 0 || y < 0 || BLK[tAt(tx, ty)] || [T.WA, T.BR].includes(tAt(tx, ty))) return false; return canStand(P, x, y) && !fieldBlocks(x, y); }
function occupied(x, y, except) { return ents.some(e => e !== except && !e.gone && (e.kind === 'mon' || e.kind === 'pet' || e.kind === 'npc' || e.kind === 'ally' || e === P) && !e.dead && Math.hypot(e.x - x, e.y - y) < .55); }

/* ---------- prepare ---------- */
function castSlot(id, opt) {
  id = MG.translate(id); const sp = SF.SPELL[id]; if (!sp) return log('That spell is not in any book.', '#ffb070');
  if (P.ghost) return log('Ghosts cannot cast.');
  if (P.held && P.held.sp.id === id) return releaseSelected();
  if (P.prep) return log('You are already preparing a spell.');
  if (GT < (P.spellReadyAt || 0)) return log('Your hands are still recovering.');
  const M = mval(); let scroll = !!(opt && opt.scroll);
  if (!sp.legacy) {
    if (!scroll && !knownSpells().has(id)) { if (!SF.count(P.pack, 'spellbook')) return log('You need your spellbook to cast ' + sp.n + '.', '#ffb070'); return log(sp.n + ' is not in your spellbook' + (SF.count(P.pack, sp.scroll) ? ' — read the scroll from your pack, or learn it.' : '.'), '#ffb070'); }
    if (scroll && !SF.count(P.pack, sp.scroll)) return log('You have no scroll of ' + sp.n + '.', '#ffb070');
    if (!scroll && M < sp.min) return log(`${sp.n} needs Magery ${sp.min}.`, '#ffb070');
    if (scroll && MG.scrollChance(sp, M) <= 0) return log(`The scroll's words slip away from you (Magery above ${MG.scrollGate(sp)} needed).`, '#ffb070');
  } else if (M < sp.min) return log(`${sp.n} needs Magery ${sp.min}.`, '#ffb070');
  const items = scroll ? [sp.scroll] : sp.regs;
  const miss = items.filter(r => !SF.count(P.pack, r)); if (miss.length) return log('Missing reagents: ' + miss.map(r => SF.ITEMS[r].n).join(', ') + '.', '#ffb070');
  if (P.mana < sp.mp) return log('Not enough mana.', '#ffb070');
  if (P.held) { log('You let ' + P.held.sp.n + ' go.'); P.held = null; AIM = null; closeMagicPanel(); }
  // reserve: mana and one of each reagent (or the scroll) move into escrow until the prep resolves
  for (const r of items) SF.removeQty(P.pack, r, 1); P.mana -= sp.mp;
  const delay = stowWeapon(); P.meditating = null;
  P.prep = { sp, t0: GT + delay, t1: GT + delay + sp.prep, x0: P.x, y0: P.y, scroll, escrow: { mana: sp.mp, items }, rid: ++CASTID };
  if (delay) log('You stow your weapon.');
  say(P, sp.chant); FX.push({ k: 'msign', e: P, id: sp.id, t0: GT, dur: delay + sp.prep + .2 });   // preparing is quiet; magic.prepare plays when it holds
}
function interruptPrep(msg) {
  if (!P.prep) return; const pr = P.prep, c = MG.interruptCost(pr.sp.mp); P.prep = null;
  for (const r of pr.escrow.items) give(r, 1);                                   // reagents (or scroll) come back
  P.mana = Math.min(SF.maxMana(P), P.mana + pr.escrow.mana - c);                   // half the mana, rounded up, is spent
  log(msg + ` (−${c} mana)`, '#ffb070'); P.spellReadyAt = GT + MG.RECOVERY; snd('magic.fizzle', { key: 'P' });
}
function prepTick() {
  if (P.prep && GT >= P.prep.t1) {
    const pr = P.prep, sp = pr.sp; P.prep = null; const M = mval();
    const ch = sp.legacy ? SF.spellSuccess(M, sp.min) : MG.chance(sp, M, pr.scroll);
    const ok = R() < ch; skillUse('magery', ch, ok, null, sp.legacy ? [sp.min - 20, sp.min + 30] : SF.SK.magCircleWindow(pr.scroll ? Math.max(1, sp.circle - 2) : sp.circle));   // circle window: a circle stops teaching 20 points above its centre
    if (!ok) { log((pr.scroll ? 'The scroll crumbles and the spell fizzles.' : 'The spell fizzles.'), '#a8a8a8'); P.spellReadyAt = GT + MG.RECOVERY; snd('magic.fizzle', { key: 'P' }); FX.push({ k: 'puff', x: P.x, y: P.y, t0: GT, dur: .6 }); return; }
    P.held = { sp, t0: GT, until: GT + MG.HOLD, scroll: pr.scroll, rid: pr.rid }; snd('magic.prepare', { key: 'P' });
    if (sp.tgt === 'self' && (sp.legacy || !['magery.56'].includes(sp.id))) { if (releaseHeld(P)) return; }
    armHeld();
  }
  if (P.held && GT >= P.held.until) { log(P.held.sp.n + ' fades unreleased.', '#a8a8a8'); snd('magic.fizzle', { key: 'P', gain: .6 }); P.held = null; AIM = null; P.spellReadyAt = GT + MG.RECOVERY; closeMagicPanel(); }
}
const TGT_TEXT = { living: 'a living creature', friend: 'yourself, a pet or a creature', ground: 'visible ground', anchor: 'ground or a creature', adjacent: 'free ground next to you', container: 'a chest', object: 'a chest latch', rune: 'one of your runes', field: 'a field segment or gate mouth', summon: 'a summoned creature', ghost: 'a ghost within 2 m', self: 'yourself' };
function armHeld() {
  const sp = P.held.sp; AIM = null;
  if (['ground', 'anchor', 'adjacent', 'container', 'object', 'field'].includes(sp.tgt)) AIM = { kind: 'spell', r: sp.radius || (sp.segments ? .5 : .6), range: sp.range || SF.SPELL_RANGE, fn: pt => releaseHeld(pt) };
  if (sp.tgt === 'rune') openPanel('mrunes');
  if (sp.id === 'magery.56') openPanel('mform');
  log(`${sp.n} is held for ${MG.HOLD} s. Tap ${TGT_TEXT[sp.tgt] || 'a target'} to release.`, '#ffe08a');
}
// the dedicated Cancel-cast button (and Esc): during prep it is an interruption (half mana, reagents back);
// a held spell is let go unused — its charge was spent at a successful prep — with the normal recovery
function cancelCast() {
  if (P.prep) return interruptPrep('You stop preparing ' + P.prep.sp.n + '.');
  if (!P.held) return; const sp = P.held.sp; P.held = null; AIM = null; P.spellReadyAt = GT + MG.RECOVERY; closeMagicPanel(); snd('magic.fizzle', { key: 'P' });
  log('You let ' + sp.n + ' go unreleased.', '#a8a8a8');
}
function castCancelButton() {
  const b = $('#b-mcancel'); if (!b) return; const on = !!(P.prep || P.held) && !P.ghost; b.hidden = !on; if (!on) return;
  const sp = (P.prep || P.held).sp, left = P.prep ? Math.max(0, P.prep.t1 - GT) : Math.max(0, P.held.until - GT);
  b.querySelector('small').textContent = (P.prep ? 'prep ' : 'held ') + left.toFixed(1) + ' s'; b.title = 'Cancel ' + sp.n; b.classList.toggle('held', !!P.held);
}
function closeMagicPanel() { if (['mrunes', 'mform', 'mmark'].includes(PANEL)) closePanel(); }
// second tap on the slot: release at the explicit selection (never an automatic pick)
function releaseSelected() {
  const sp = P.held.sp; if (AIM) return log(`Tap ${TGT_TEXT[sp.tgt]} for ${sp.n}.`, '#ffb070');
  if (sp.tgt === 'friend' || sp.tgt === 'self') return releaseHeld(P.sel && isLiving(P.sel) ? P.sel : P);
  if (P.sel && isLiving(P.sel)) return releaseHeld(P.sel);
  log(`Select ${TGT_TEXT[sp.tgt]} for ${sp.n}.`, '#ffb070');
}
// a tap on the world while a spell is held. Returns true when the tap was used.
function heldTap(hits, w) {
  if (!P.held) return false; const sp = P.held.sp;
  const nearSelf = Math.hypot(w.x - P.x, w.y - P.y) < .7;
  if (sp.tgt === 'living' || sp.tgt === 'friend' || sp.tgt === 'summon' || sp.tgt === 'ghost') {
    const t = hits.find(e => sp.tgt === 'summon' ? e.summon : sp.tgt === 'ghost' ? isPlayerGhost(e) : isLiving(e)) || ((sp.tgt === 'friend' || sp.tgt === 'living') && nearSelf ? P : null);
    if (t) { releaseHeld(t); return true; }
    log(`${sp.n} needs ${TGT_TEXT[sp.tgt]}. The spell is still held.`, '#ffb070'); return true;
  }
  if (sp.tgt === 'rune') { openPanel('mrunes'); return true; }
  return false;
}

/* ---------- release: validate the target, then commit ---------- */
function releaseHeld(t, extra) {
  const sp = P.held && P.held.sp; if (!sp || !t) return false;
  const rej = m => { log(m + ' The spell is still held.', '#ffb070'); return false; };
  const rng = sp.range || SF.SPELL_RANGE; let target = t;
  const isPt = t.kind === undefined && t !== P && !t.id;
  switch (sp.tgt) {
    case 'self': target = P; break;
    case 'living': if (!isLiving(t)) return rej(`${sp.n} needs ${TGT_TEXT.living}.`); break;
    case 'friend': if (!isLiving(t)) return rej(`${sp.n} needs ${TGT_TEXT.friend}.`); break;
    case 'summon': if (!t.summon || !alive(t)) return rej('Only a summoned creature can be banished.'); break;
    case 'ghost': if (!isPlayerGhost(t)) return rej('No ghost is offering to return.'); break;
    case 'anchor': { if (isPt) { const e = livingNear(t.x, t.y, .7).sort((a, b) => Math.hypot(a.x - t.x, a.y - t.y) - Math.hypot(b.x - t.x, b.y - t.y))[0]; target = e ? { x: e.x, y: e.y, anchor: e } : { x: t.x, y: t.y }; } else target = { x: t.x, y: t.y, anchor: t }; break; }
    case 'rune': if (!t.rune) return rej('Choose one of your runes.'); break;
    default: break;
  }
  const pos = target.anchor || target;
  if (target !== P && sp.tgt !== 'rune') {
    const d = Math.hypot(pos.x - P.x, pos.y - P.y); if (d > rng + .01) return rej(`Out of range (${rng} m).`);
    if (!los(P, pos)) return rej('No line of sight.');
  }
  const res = sp.legacy ? (applyLegacy(sp, target), true) : effectOn(sp, target, extra || {});
  if (res === false) return false;                                                // effect refused the target: the hold timer keeps running
  playOnce('CastRelease', 0); P.held = null; AIM = null; P.spellReadyAt = GT + MG.RECOVERY; closeMagicPanel();
  if (!sp.legacy) { if (sp.delay) snd('magic.release', { key: 'P' }); if (!DELIVERED[sp.effect]) spellSnd(sp, target === P ? P : pos); }   // launch, then the effect where it lands
  if (P.hidden && !(sp.effect === 'concealment' && target === P)) reveal(P.mg && P.mg.invis > GT ? 'Casting ends your invisibility.' : 'Your spell reveals you.');
  if (target !== P && pos.x !== undefined) faceToward(P, pos.x, pos.y);
  return true;
}

/* ---------- impacts ---------- */
// one damaging impact on one recipient. src = acting effect source (after any reflection).
function spellHit(sp, a, base, ctx) {
  const eid = ctx.cid + ':' + (a === P ? 'P' : a.id) + (ctx.tag || ''); if (RESOLVED.has(eid)) return null; RESOLVED.add(eid);
  if (!isLiving(a)) return null;
  const r = MG.resolveHit({ mode: ctx.mode || sp.resist, base, circle: ctx.circle || sp.circle, M: ctx.M, E: ctx.E, R: rOf(a) }, R);
  if (a === P && r.roll !== null && r.chance > 0 && svReal('resistingspells') < SF.SK.resistMaxFor(ctx.circle || sp.circle || 1)) skillCheck('resistingspells', 0, 120);   // any resistible spell that reaches you teaches, up to a ceiling set by its circle (RunUO CheckResisted)
  if (r.applied > 0) hurt(a, r.applied, ctx.src, 'spell'); else floater(a.x, a.y, '0', '#c8c8c8');
  if (a !== P) aggro(a, ctx.src);
  log(`${sp.n}${ctx.reflected ? ' (reflected)' : ''} → ${nameOf(a)}: ${r.applied}${r.resisted ? ' (resisted)' : ''}${ctx.note || ''}`, a === P ? '#ff9a8a' : '#c8a0ff', 'combat');
  if (a === P && P.mg && P.mg.invis > GT && r.applied > 0) reveal('The blow breaks your invisibility.');
  return r;
}
// committed single-target delivery: follows the recipient; death or a level change cancels it
function deliver(sp, a, ctx, fn) {
  const lvl = levelAt(Math.floor(a.x), Math.floor(a.y)) || null;
  const go = () => { if (!isLiving(a)) return; if ((levelAt(Math.floor(a.x), Math.floor(a.y)) || null) !== lvl) return; spellSnd(sp, a); fn(); };
  if (!sp.delay) return go();
  if (sp.id === 'magery.43') EFX.push({ k: 'mark', e: a, col: '#ff6a20', until: GT + sp.delay });
  else if (sp.id === 'magery.51') EFX.push({ k: 'mring', e: a, col: '#ffb040', until: GT + sp.delay });
  else EFX.push({ k: 'mproj', from: ctx.src === P ? P : ctx.src, e: a, x: P.x, y: P.y, t0: GT, t1: GT + sp.delay, col: { 'magery.05': '#ffd27a', 'magery.18': '#ff7a30', 'magery.42': '#5fe0d0', 'magery.30': '#e0f0ff', 'magery.37': '#c080ff' }[sp.id] || '#c8a0ff', until: GT + sp.delay + .05 });
  at(sp.delay, go);
}
// reflection: checked on release for reflectable single-target spells; one bounce
function reflectFor(sp, a) {
  if (!sp.reflect || a === P && !P.mg) return null; const g = a.mg; if (!g || !g.mirror) return null;
  g.mirror = false; floater(a.x, a.y, 'mirrored', '#d0f0ff'); FX.push({ k: 'ring', x: a.x, y: a.y, c: '#d0f0ff', t0: GT, dur: .6 });
  return { recipient: P, src: a };
}

function effectOn(sp, t, x) {
  const M = mval(), E = eval_(); const cid = 'c' + P.held.rid; const ctx = { cid, M, E, src: P, circle: sp.circle };
  const A = MG.A(M); let a = t;
  // single-target hostile spells may meet a mirror
  if (sp.tgt === 'living' && a !== P) { const rf = reflectFor(sp, a); if (rf) { a = rf.recipient; ctx.src = rf.src; ctx.reflected = true; } }
  if (sp.tgt === 'living' && a !== P && sp.effect !== 'heal') aggro(a, P);
  switch (sp.effect) {
    case 'direct': case 'delayed_hit': deliver(sp, a, ctx, () => { const base = MG.rollBase(sp.id, M, R); spellHit(sp, a, base, ctx); if (sp.id === 'magery.51') FX.push({ k: 'boom', x: a.x, y: a.y, r: .9, t0: GT, dur: .6 }); if (sp.id === 'magery.30') FX.push({ k: 'bolt', x: a.x, y: a.y, t0: GT, dur: .3 }); if (sp.id === 'magery.43') FX.push({ k: 'boom', x: a.x, y: a.y, r: 1, t0: GT, dur: .5 }); }); skillCheck('evaluatingintelligence', 0, 100); return true;
    case 'conditional_hit': { const ci = P.int, ti = intOf(a); const mb = MG.mindburst(ci, ti); const victim = mb.victim === 'caster' ? P : mb.victim === 'target' ? a : null;
      deliver(sp, a, ctx, () => { if (!victim || !mb.amount) { floater(a.x, a.y, 'no effect', '#c8c8c8'); log('Mindburst: equal minds, no effect.', '#c8a0ff'); return; } spellHit(sp, victim, mb.amount, Object.assign({}, ctx, { mode: 'half_only', tag: victim === P ? ':back' : '', note: victim === P ? ' — backfire' : '' })); });
      skillCheck('evaluatingintelligence', 0, 100); return true; }
    case 'heal': { const amt = MG.rollBase(sp.id, M, R); healActor(a, amt); return true; }
    case 'stat_bonus': { applyStats(a, sp.stats, A, GT + MG.boonDuration(M)); floater(a.x, a.y, sp.stats.map(s => '+' + A + ' ' + s.toUpperCase()).join(' '), '#9fe8ff'); return true; }
    case 'stat_penalty': { const until = GT + MG.ceilTick(MG.hexDuration(M, rOf(a))); applyStats(a, sp.stats, -A, until); floater(a.x, a.y, sp.stats.map(s => '−' + A + ' ' + s.toUpperCase()).join(' '), '#c97bff'); log(`${sp.n} → ${nameOf(a)}${ctx.reflected ? ' (reflected)' : ''}: −${A} ${sp.stats.join('/').toUpperCase()} for ${Math.round(until - GT)} s.`, '#c8a0ff'); return true; }
    case 'stat_penalty_area': { for (const v of livingNear(t.x, t.y, sp.radius, e => e !== P && los({ x: t.x, y: t.y }, e))) { const until = GT + MG.ceilTick(MG.hexDuration(M, rOf(v))); applyStats(v, sp.stats, -A, until); aggro(v, P); floater(v.x, v.y, 'cursed', '#c97bff'); } FX.push({ k: 'ring', x: t.x, y: t.y, c: '#c97bff', t0: GT, dur: .9 }); return true; }
    case 'poison': { deliver(sp, a, ctx, () => poisonHit(sp, a, MG.poisonTier(M), ctx)); return true; }
    case 'cleanse': cureActor(a, M, 0); return true;
    case 'area_cleanse': { for (const v of livingNear(t.x, t.y, sp.radius, e => los({ x: t.x, y: t.y }, e))) cureActor(v, M, .20, true); FX.push({ k: 'ring', x: t.x, y: t.y, c: '#7be07b', t0: GT, dur: .9 }); return true; }
    case 'armor_boon': armorBoon(a, M); return true;
    case 'area_armor_boon': { for (const v of livingNear(t.x, t.y, sp.radius, e => e.kind !== 'mon' && los({ x: t.x, y: t.y }, e))) armorBoon(v, M); FX.push({ k: 'ring', x: t.x, y: t.y, c: '#e8d090', t0: GT, dur: .9 }); return true; }
    case 'melee_ward': { const g = mgOf(P); g.reactive = { pool: MG.reactivePool(M), until: GT + MG.REACTIVE_LIFE }; g.mirror = false; floater(P.x, P.y, 'rebounding armor ' + g.reactive.pool, '#e8c070'); return true; }
    case 'spell_ward': { const g = mgOf(P); g.mirror = true; g.reactive = null; floater(P.x, P.y, 'mirror ward', '#d0f0ff'); return true; }
    case 'vision': { if (a !== P) { floater(a.x, a.y, 'night sight', '#fff0a0'); return true; } mgOf(P).night = GT + MG.nightSight(M); floater(P.x, P.y, 'night sight', '#fff0a0'); return true; }
    case 'provision': { const food = pick(['travelloaf', 'cookedfish', 'softcheese']); const r = SF.addItem(P.pack, SF.newItem(food, 1), cap()); if (!r.ok) { log('Your pack is full; Conjure Rations waits for room.', '#ffb070'); return false; } log('You conjure ' + SF.ITEMS[food].n.toLowerCase() + '.', '#7ee08a'); return true; }
    case 'mana_attack': case 'mana_transfer': return manaSpell(sp, a, ctx);
    case 'control': return bindActor(a, M, ctx, sp);
    case 'concealment': { if (a !== P) { floater(a.x, a.y, 'shimmers', '#c8e0ff'); a.invisUntil = GT + MG.invisibility(M); return true; } const g = mgOf(P); g.invis = GT + MG.invisibility(M); g.invisAt = { x: P.x, y: P.y, hit: P.lastHit || -1 }; P.hidden = true; P.stepBudget = 0; for (const e of ents) if (e.target === P) { e.target = null; if (e.state !== 'idle') e.state = 'return'; } log('You fade from sight. Moving, attacking or casting ends the veil.', '#c8e0ff'); return true; }
    case 'disguise': { const g = mgOf(P); g.disguise = { name: pick(['Hooded traveller', 'Grey wanderer', 'Marsh pilgrim', 'Salt-stained sailor']), until: GT + MG.incognito(M) }; log('You now appear as a ' + g.disguise.name.toLowerCase() + '.', '#c8e0ff'); return true; }
    case 'transformation': { const form = x.form || (mgOf(P).lastForm) || 'hound'; const g = mgOf(P); g.form = { type: form, until: GT + MG.polymorph(M) }; g.lastForm = form; FX.push({ k: 'puff', x: P.x, y: P.y, t0: GT, dur: .6 }); log('You take the form of a ' + MON[form].n + '.', '#c8e0ff'); return true; }
    case 'movement': { if (!standable(t.x, t.y) || occupied(t.x, t.y, P)) { log('Blink Step needs open, legal ground.', '#ffb070'); return false; } FX.push({ k: 'puff', x: P.x, y: P.y, t0: GT, dur: .4 }); P.x = t.x; P.y = t.y; FX.push({ k: 'puff', x: P.x, y: P.y, t0: GT, dur: .4 }); return true; }
    case 'shared_damage': { const c = { x: t.x, y: t.y }; EFX.push({ k: 'groundwarn', x: c.x, y: c.y, r: sp.radius, t0: GT, at: GT + sp.delay, fn: () => areaPool(sp, c, ctx) }); skillCheck('evaluatingintelligence', 0, 100); return true; }
    case 'area_percent_hit': { const c = { x: P.x, y: P.y }; EFX.push({ k: 'groundwarn', x: c.x, y: c.y, r: sp.radius, t0: GT, at: GT + sp.delay, fn: () => { for (const v of livingNear(c.x, c.y, sp.radius, e => e !== P && los(c, e))) { const n = MG.earthshaker(v.hp); hurt(v, n, P, 'spell'); aggro(v, P); log(`Earthshaker → ${nameOf(v)}: ${n}`, '#c8a0ff', 'combat'); } FX.push({ k: 'boom', x: c.x, y: c.y, r: 3, t0: GT, dur: .7 }); sndAt('combat.blast', c); } }); return true; }
    case 'barrier': case 'damage_field': case 'poison_field': case 'control_field': return placeField(sp, t, M, E, ctx);
    case 'field_removal': return dispelField(t);
    case 'summon': return summonAt(sp, t, M);
    case 'dispel': { const ok = R() < MG.banishChance(M, a.summon.banish, false); if (ok) banish(a); else { floater(a.x, a.y, 'holds on', '#c8c8c8'); log(`${a.name} resists banishment.`); } return true; }
    case 'area_dispel': { for (const v of livingNear(t.x, t.y, sp.radius, e => e.summon)) { if (R() < MG.banishChance(M, v.summon.banish, true)) banish(v); else floater(v.x, v.y, 'holds on', '#c8c8c8'); } FX.push({ k: 'ring', x: t.x, y: t.y, c: '#e0e0ff', t0: GT, dur: .9 }); return true; }
    case 'detection': return unveil(sp, t, M);
    case 'trap': case 'disarm': case 'lock': case 'unlock': case 'object_use': return chestSpell(sp, t, M, E);
    case 'travel': case 'travel_preparation': return runeSpell(sp, x.rune, M, x);
    case 'resurrection': { if (!a.ghost) return true; a.reviveOffer = { from: P, until: GT + 10 }; log('You offer ' + a.name + ' a return to life.'); return true; }
  }
  log(sp.n + ' has no effect here yet.', '#a8a8a8'); return true;
}

/* ---------- effect helpers ---------- */
function applyStats(a, stats, amount, until) {
  const g = mgOf(a); g.mods = g.mods || {}; let any = false;
  for (const s of stats) any = MG.applyStatMod(g.mods, s, amount, until) || any;
  if (!any) floater(a.x, a.y, 'no stronger', '#c8c8c8');
  if (a === P) recomputeStats();
}
function armorBoon(a, M) { const g = mgOf(a); g.armor = { v: MG.armorBonus(M), until: GT + MG.boonDuration(M) }; floater(a.x, a.y, '+' + g.armor.v + ' armor', '#e8d090'); }
function cureActor(a, M, bonus, quiet) {
  if (!a.poison) { if (!quiet) log(nameOf(a) === 'you' ? 'You are not poisoned.' : 'Nothing to cure.'); return; }
  if (R() < MG.cureChance(M, a.poison.tier, bonus)) { a.poison = null; if (a === P) P.poisonImmune = GT + 1; floater(a.x, a.y, 'cured', '#7ee08a'); if (sndOnce('cure', .4)) sndAt('magic.heal', a); }
  else { floater(a.x, a.y, 'cure fails', '#c8c8c8'); log('The poison holds.', '#ffb070'); }
}
function applyPoison(a, tier) {
  if (tier <= 0) return false; if (a === P && P.poisonImmune > GT) return false;
  const cur = a.poison;
  if (!cur) { a.poison = { tier, ticks: SF.POISON_TICKS, next: GT + SF.POISON_GAP }; }
  else if (tier > cur.tier) { a.poison = { tier, ticks: SF.POISON_TICKS, next: cur.next }; }   // stronger replaces, keeps the pending tick
  else return false;                                                                                // equal or weaker: unchanged
  floater(a.x, a.y, 'poisoned', '#5bd65b'); if (a === P) log('You are poisoned!', '#7be07b'); return true;
}
function poisonHit(sp, a, tier, ctx) {
  const ch = MG.resistChance(sp.circle, ctx.M, rOf(a)); const res = R() < ch; const t2 = res ? MG.poisonOnResist(tier) : tier;
  if (a !== P) aggro(a, ctx.src);
  if (!t2) { floater(a.x, a.y, 'resists', '#c8c8c8'); return; }
  applyPoison(a, t2); log(`${sp.n} → ${nameOf(a)}: tier ${t2}${res ? ' (resisted from ' + tier + ')' : ''}`, '#7be07b', 'combat');
}
function manaSpell(sp, a, ctx) {
  const res = R() < MG.resistChance(sp.circle, ctx.M, rOf(a));
  if (a !== P) aggro(a, ctx.src);
  if (res) { floater(a.x, a.y, 'resists', '#c8c8c8'); log(`${nameOf(a)} resists ${sp.n}.`); return true; }
  const has = a === P ? P.mana : a.mana; if (has === undefined) { floater(a.x, a.y, 'no mana', '#c8c8c8'); log(`${cap1(nameOf(a))} has no mana to draw.`); return true; }
  if (sp.effect === 'mana_attack') { const n = Math.min(has, MG.drainAmount(ctx.M)); if (a === P) P.mana -= n; else a.mana -= n; floater(a.x, a.y, '−' + Math.floor(n) + ' mana', '#8ab0ff'); return true; }
  const dst = ctx.reflected ? a : P, srcA = ctx.reflected ? P : a;           // a mirror reverses the direction
  const room = dst === P ? SF.maxMana(P) - P.mana : (a.maxMana || 0) - (a.mana || 0); const n = Math.max(0, Math.min(srcA === P ? P.mana : srcA.mana, room, MG.vampAmount(ctx.M)));
  if (srcA === P) P.mana -= n; else srcA.mana -= n; if (dst === P) P.mana += n; else dst.mana += n; floater(dst.x, dst.y, '+' + Math.floor(n) + ' mana', '#8ab0ff'); return true;
}
function bindActor(a, M, ctx, sp) {
  if (a !== P && a.kind === 'mon' && MON[a.type].boss) { floater(a.x, a.y, 'immune', '#c8c8c8'); log('The ' + MON[a.type].n + ' cannot be bound.'); return true; }
  const g = mgOf(a); if (g.ctlImmune > GT) { floater(a.x, a.y, 'immune', '#c8c8c8'); return true; }
  const dur = MG.ceilTick(MG.bindDuration(a === P, M, rOf(a))); a.rooted = GT + dur; g.bound = true; floater(a.x, a.y, 'bound', '#5fe0d0'); if (a !== P) aggro(a, ctx && ctx.src); return true;
}
function banish(v) { if (v.gone) return; FX.push({ k: 'ring', x: v.x, y: v.y, c: '#e0e0ff', t0: GT, dur: .7 }); log(v.name + ' is banished.', '#e0e0ff'); rmEnt(v); if (P.sel === v) P.sel = null; }
function areaPool(sp, c, ctx) {
  spellSnd(sp, c);   // one cue at detonation, not one per victim
  const victims = livingNear(c.x, c.y, sp.radius, e => e !== P && los(c, e));
  if (!victims.length) { log(sp.n + ' strikes empty ground.', '#a8a8a8'); return; }          // no eligible victims: the pool is discarded
  const pool = MG.rollBase(sp.id, ctx.M, R); const shares = MG.splitPool(pool, victims.map(v => ({ id: v.id, dist: Math.hypot(v.x - c.x, v.y - c.y), v })));
  for (const s of shares) { const v = victims.find(e => e.id === s.id); spellHit(sp, v, s.share, Object.assign({}, ctx, { note: ` (share of ${pool})` })); if (sp.id === 'magery.49') FX.push({ k: 'bolt', x: v.x, y: v.y, t0: GT, dur: .3 }); else FX.push({ k: 'boom', x: v.x, y: v.y, r: .7, t0: GT, dur: .5 }); }
}
function unveil(sp, t, M) {
  FX.push({ k: 'ring', x: t.x, y: t.y, c: '#fff0a0', t0: GT, dur: 1 }); let n = 0;
  for (const m of ents) if (m.kind === 'mon' && alive(m) && Math.hypot(m.x - t.x, m.y - t.y) <= sp.radius) {
    if (m.invisUntil > GT) { m.invisUntil = 0; n++; floater(m.x, m.y, 'revealed', '#fff0a0'); }
    if (m.hidden && R() < MG.revealChance(M, sv('detectinghidden'), (MON[m.type] || {}).diff || 40, 0)) { m.hidden = false; n++; floater(m.x, m.y, 'revealed', '#fff0a0'); } }
  for (const tr of TRAPS) if (tr.hidden && Math.hypot(tr.x - t.x, tr.y - t.y) <= sp.radius && R() < MG.revealChance(M, sv('detectinghidden'), tr.diff, 0)) { tr.hidden = false; n++; }
  log(n ? `Unveil exposes ${n} hidden thing${n > 1 ? 's' : ''}.` : 'Unveil finds nothing hidden.', n ? '#ffe08a' : undefined); return true;
}

/* ---------- containers: Rune Trap, Unravel Trap, Arcane Lock, Open Seal, Far Hand ---------- */
const MLOCK_REQ = [20, 40, 70];                 // tuning for tier 0; tiers 1 and 2 follow the book (40, 70)
function chestAt(pt) { let best = null, bd = 1.4; for (const c of CHESTS.values()) { const d = Math.hypot(c.x + .5 - pt.x, c.y + .5 - pt.y); if (d < bd) { bd = d; best = c; } } return best; }
function chestSpell(sp, pt, M, E) {
  const c = chestAt(pt); if (!c) { log(`${sp.n} needs ${TGT_TEXT[sp.tgt]}.`, '#ffb070'); return false; }
  const cpos = { x: c.x + .5, y: c.y + .5 };
  if (sp.effect === 'lock') { log('Arcane Lock seals only a container you own. This chest is not yours.', '#ffb070'); return false; }
  if (sp.effect === 'trap') { if (c.rtrap) { log('That latch already carries a rune trap.'); return true; } c.rtrap = { M, E, by: P.name }; FX.push({ k: 'ring', x: cpos.x, y: cpos.y, c: '#ff8a40', t0: GT, dur: .6 }); log('A spark settles into the latch.', '#ffb070'); return true; }
  if (sp.effect === 'disarm') { if (!c.rtrap) { log('There is no rune trap on that latch.'); return true; } c.rtrap = null; FX.push({ k: 'ring', x: cpos.x, y: cpos.y, c: '#c8c8c8', t0: GT, dur: .6 }); log('You pull the spark from the latch.', '#7ee08a'); return true; }
  if (sp.effect === 'unlock') { if (c.open && GT <= c.refill) { log('That chest is already open.'); return true; } const need = c.mlock || MLOCK_REQ[c.tier] || 70; if (M < need) { log(`The seal is too strong (Magery ${need}).`, '#ffb070'); return true; } c.open = true; c.refill = GT + 600; c.cont = chestLoot(c.tier); c.mlock = 0; log('The lock gives way. Any trap on it is still armed.', '#ffe08a'); return true; }
  if (sp.effect === 'object_use') { FX.push({ k: 'ring', x: cpos.x, y: cpos.y, c: '#c8e0ff', t0: GT, dur: .6 }); if (c.rtrap) springRuneTrap(c, true); else log('The far hand touches the latch. Nothing happens.'); return true; }
  return true;
}
// one charge; opener only if within one tile of the latch. Uses the trapping mage's M/E and the opener's R.
function springRuneTrap(c, remote) {
  const tr = c && c.rtrap; if (!tr) return; c.rtrap = null; const cpos = { x: c.x + .5, y: c.y + .5 };
  FX.push({ k: 'boom', x: cpos.x, y: cpos.y, r: .8, t0: GT, dur: .5 }); sndAt('combat.blast', cpos);
  const who = !P.ghost && Math.hypot(P.x - cpos.x, P.y - cpos.y) <= (remote ? 1 : 2.2) ? P : null;
  if (!who) { log('The rune trap bursts at the latch, harming no one.', '#ffb070'); return; }
  const r = MG.resolveHit({ mode: 'half_then_focus', base: MG.rollBase('magery.13', tr.M, R), circle: 2, M: tr.M, E: tr.E, R: rOf(who) }, R);
  log(`A rune trap bursts in your face: ${r.applied}${r.resisted ? ' (resisted)' : ''}.`, '#ff8a6a', 'combat'); if (r.applied > 0) damagePlayer(r.applied, null, 'spell');
}

/* ---------- fields ---------- */
function fieldAt(x, y) { const tx = Math.floor(x), ty = Math.floor(y); return FIELDS.find(f => f.x === tx && f.y === ty && f.until > GT); }
function fieldBlocks(x, y) { const f = fieldAt(x, y); return !!f && (f.kind === 'stone' || f.kind === 'aether'); }
function fieldBlocksSight(x, y) { const f = fieldAt(x, y); return !!f && f.kind === 'stone'; }
function placeField(sp, t, M, E, ctx) {
  const kind = MG.FIELD_KIND[sp.id], solid = kind === 'stone' || kind === 'aether';
  const tiles = MG.fieldTiles(P, t, sp.segments);
  const bad = c => { const tt = tAt(c.x, c.y); if (BLK[tt] || tt === T.SD || tt === T.SU || tt === T.WA) return true; if (solid && (occupied(c.x + .5, c.y + .5) || SHRINES.some(s => Math.abs(s.x - c.x) <= 1 && Math.abs(s.y - c.y) <= 1))) return true; return false; };
  // clip at walls: keep the unbroken run through the centre tile (index 0)
  const ok = tiles.map(c => !bad(c)); let lo = tiles.findIndex(c => c.i === 0), hi = lo; if (!ok[lo]) { log(sp.n + ' needs open ground at the target.', '#ffb070'); return false; }
  while (lo > 0 && ok[lo - 1]) lo--; while (hi < tiles.length - 1 && ok[hi + 1]) hi++;
  const life = MG.fieldLife(sp.id, M), cid = ctx.cid;
  for (let k = lo; k <= hi; k++) FIELDS.push({ cid, sid: sp.id, kind, x: tiles[k].x, y: tiles[k].y, i: tiles[k].i, until: GT + life, M, E, src: P, occ: new Map() });
  log(`${sp.n}: ${hi - lo + 1} segment${hi > lo ? 's' : ''} for ${life} s.`, '#c8a0ff'); return true;
}
function dispelField(pt) {
  const g = GATES.find(G => G.until > GT && ['a', 'b'].some(k => !G[k].closed && Math.hypot(G[k].x - pt.x, G[k].y - pt.y) < 1.2));
  if (g) { const k = Math.hypot(g.a.x - pt.x, g.a.y - pt.y) < 1.2 && !g.a.closed ? 'a' : 'b'; g[k].closed = true; log('That gate mouth closes to new arrivals.', '#e0e0ff'); return true; }
  const f = fieldAt(pt.x, pt.y); if (!f) { log('Dispel Field needs a field segment or a gate mouth.', '#ffb070'); return false; }
  FIELDS.splice(FIELDS.indexOf(f), 1); FX.push({ k: 'puff', x: f.x + .5, y: f.y + .5, t0: GT, dur: .5 }); log('One segment of the field unravels.', '#e0e0ff'); return true;
}
function fieldTick() {
  for (let i = FIELDS.length - 1; i >= 0; i--) if (FIELDS[i].until <= GT) FIELDS.splice(i, 1);
  // per cast, per actor: entry pulses, 1 s pulse spacing (fire), one poison attempt per entry plus one 2 s retry, one bind per entry
  const casts = new Map(); for (const f of FIELDS) if (!['stone', 'aether'].includes(f.kind)) { if (!casts.has(f.cid)) casts.set(f.cid, []); casts.get(f.cid).push(f); }
  for (const [, segs] of casts) {
    const f0 = segs[0], occ = f0.occ;
    for (const a of [P, ...ents.filter(e => e !== P)]) { if (!isLiving(a)) { occ.delete(a === P ? 'P' : a.id); continue; }
      const key = a === P ? 'P' : a.id; const on = segs.some(s => s.x === Math.floor(a.x) && s.y === Math.floor(a.y)); let st = occ.get(key);
      if (!on) { if (st) st.inside = false; continue; }
      if (!st) { st = { inside: false, lastPulse: -99, enteredAt: GT, retried: false }; occ.set(key, st); }
      const fresh = !st.inside; if (fresh) { st.inside = true; st.enteredAt = GT; st.retried = false; }
      if (f0.kind === 'fire' && GT - st.lastPulse >= 1) { st.lastPulse = GT; const r = MG.resolveHit({ mode: 'half_only', base: 2, circle: 4, M: f0.M, E: f0.E, R: rOf(a) }, R); hurt(a, r.applied, f0.src, 'spell'); aggro(a, f0.src); }
      if (f0.kind === 'venom' && (fresh || (!st.retried && GT - st.enteredAt >= 2 && !a.poison))) { if (!fresh) st.retried = true; const tier = MG.poisonTier(f0.M); const res = R() < MG.resistChance(5, f0.M, rOf(a)); applyPoison(a, res ? MG.poisonOnResist(tier) : tier); aggro(a, f0.src); }
      if (f0.kind === 'bind' && fresh) { const g = mgOf(a); if (!(g.ctlImmune > GT) && !(a.kind === 'mon' && MON[a.type].boss)) { a.rooted = GT + MG.ceilTick(MG.bindDuration(a === P, f0.M, rOf(a))); g.bound = true; floater(a.x, a.y, 'bound', '#5fe0d0'); aggro(a, f0.src); } }
    }
  }
}

/* ---------- runes: Mark, Recall, Gate ---------- */
const runes = () => P.pack.items.filter(it => it.id === 'rune');
function travelCheck(dest) {
  if (P.ghost) return 'Ghosts cannot travel this way.'; if (overweight()) return 'You are carrying too much to travel.'; if (P.rooted > GT) return 'You are rooted in place.';
  if (P.mg && P.mg.travelLock > GT) return `You are locked in combat (${Math.ceil(P.mg.travelLock - GT)} s).`;
  if (dest && !standable(dest.x, dest.y)) return 'The destination is blocked.'; return null;
}
function moveWithFollowers(dest) {
  const fol = ents.filter(e => e.kind === 'pet' && !e.gone && dist(e, P) <= 3 && los(P, e) && !(e.rooted > GT));
  FX.push({ k: 'ring', x: P.x, y: P.y, c: '#ffe08a', t0: GT, dur: .8 }); P.x = dest.x; P.y = dest.y; for (const p of fol) { p.x = P.x - .6; p.y = P.y + .6; }
  P.armed = false; P.sel = null; FX.push({ k: 'ring', x: P.x, y: P.y, c: '#ffe08a', t0: GT, dur: .8 });
}
function runeSpell(sp, uid, M, x) {
  const it = P.pack.items.find(i => i.uid === +uid && i.id === 'rune'); if (!it) { log('Choose one of your runes.', '#ffb070'); return false; }
  if (sp.effect === 'travel_preparation') {
    if (levelAt(Math.floor(P.x), Math.floor(P.y)) || [T.SD, T.SU].includes(tAt(Math.floor(P.x), Math.floor(P.y)))) { log('This place will not hold a mark.', '#ffb070'); return false; }
    if (it.mark && !x.confirm) { PANEL_MARK = { uid: it.uid }; openPanel('mmark'); return false; }
    it.mark = { x: P.x, y: P.y, name: ZONE_NAME[zoneAt(Math.floor(P.x), Math.floor(P.y))] || 'the open marsh' }; P.pack.ver++; log('The rune now holds ' + it.mark.name + '.', '#ffe08a'); return true; }
  if (!it.mark) { log('That rune is blank. Mark it first.', '#ffb070'); return false; }
  const why = travelCheck(it.mark); if (why) { log(why, '#ffb070'); return false; }
  if (sp.id === 'magery.32') { moveWithFollowers(it.mark); log('The rune pulls you to ' + it.mark.name + '.', '#ffe08a'); return true; }
  GATES.push({ id: 'g' + P.held.rid, a: { x: P.x, y: P.y }, b: { x: it.mark.x, y: it.mark.y }, until: GT + MG.GATE_LIFE }); log('A gate opens to ' + it.mark.name + ' for 30 s. Step in and confirm to travel.', '#ffe08a'); return true;
}
let PANEL_MARK = null, GATE_PROMPT = null;
function gateTick() {
  for (let i = GATES.length - 1; i >= 0; i--) if (GATES[i].until <= GT) GATES.splice(i, 1);
  if (P.ghost) return; let inMouth = null;
  for (const g of GATES) for (const k of ['a', 'b']) if (Math.hypot(g[k].x - P.x, g[k].y - P.y) < .6) inMouth = { g, k };
  const st = P.gateDeb || (P.gateDeb = { until: 0, out: true });
  if (!inMouth) { st.out = true; if (PANEL === 'mgate') closePanel(); return; }
  if (!st.out || GT < st.until || PANEL === 'mgate' || inMouth.g[inMouth.k].closed) return;
  GATE_PROMPT = inMouth; openPanel('mgate');
}
function stepGate() {
  const p = GATE_PROMPT; if (!p) return; GATE_PROMPT = null; closePanel(); const g = p.g, from = g[p.k], to = g[p.k === 'a' ? 'b' : 'a'];
  if (!GATES.includes(g) || g.until <= GT || from.closed || Math.hypot(from.x - P.x, from.y - P.y) > .8) return log('The gate is no longer there.', '#ffb070');
  const why = travelCheck(to); if (why) return log(why, '#ffb070');
  moveWithFollowers({ x: to.x + .7, y: to.y + .7 }); P.gateDeb = { until: GT + MG.GATE_DEBOUNCE, out: false }; log('You step through the gate.', '#ffe08a');
}

/* ---------- summons ---------- */
const SUMMON_LOOK = { 'magery.33': { n: 'spirit blades', col: '#c8d8ff' }, 'magery.40': null, 'magery.58': { n: 'aether vortex', col: '#5fe0d0' }, 'magery.60': { n: 'air elemental', col: '#d0e8ff' }, 'magery.61': { n: 'abyssal daemon', col: '#a02818' }, 'magery.62': { n: 'earth elemental', col: '#8a7a5a' }, 'magery.63': { n: 'fire elemental', col: '#ff7a30' }, 'magery.64': { n: 'water elemental', col: '#4aa0e0' } };
function summonAt(sp, pt, M) {
  const s = sp.summon, wild = MG.wild(sp); if (petSlotsUsed() + s.slots > SF.TAME.slots) { log(`${sp.n} needs ${s.slots} free control slot${s.slots > 1 ? 's' : ''}.`, '#ffb070'); return false; }
  if (!standable(pt.x, pt.y) || occupied(pt.x, pt.y)) { log('Choose free ground to summon on.', '#ffb070'); return false; }
  const look = SUMMON_LOOK[sp.id], type = sp.id === 'magery.40' ? pick(['boar', 'hound']) : null;
  const e = addEnt({ kind: 'pet', type, name: type ? 'conjured ' + MON[type].n : look.n, x: pt.x, y: pt.y, hp: s.hp, max: s.hp, state: '', home: { x: pt.x, y: pt.y }, sect: 0, ward: 0, order: 'follow', slots: s.slots, target: null,
    summon: { id: sp.id, wild, banish: s.banishDifficulty, prio: s.targetPriority, M, circle: sp.circle, melee: [s.meleeMin, s.meleeMax, s.meleeIntervalS], ranged: s.rangedMax ? [s.rangedMin, s.rangedMax, s.rangedIntervalS, s.rangeTiles] : null, col: look && look.col, int: sp.id === 'magery.58' ? 10 : 40 }, until: GT + MG.summonLife(sp, M) });
  FX.push({ k: 'ring', x: e.x, y: e.y, c: (look && look.col) || '#e0e0ff', t0: GT, dur: .9 });
  log(wild ? `${cap1(e.name)} answer${sp.id === 'magery.33' ? '' : 's'}. They choose their own victims — keep clear.` : `${cap1(e.name)} answers. Select a creature and order your pets to attack.`, '#ffe08a'); return true;
}
function summonTarget(p) {
  const L = [P, ...ents].filter(e => e !== p && isLiving(e) && Math.hypot(e.x - p.x, e.y - p.y) <= 6 && !(e === P && P.hidden) && !(e.invisUntil > GT));
  const score = p.summon.prio === 'intellect' ? intOf : tacticsOf;
  L.sort((a, b) => (score(b) - score(a)) || (dist(a, p) - dist(b, p)) || (String(a === P ? 'P' : a.id) < String(b === P ? 'P' : b.id) ? -1 : 1));
  return L[0] || null;
}
function summonTick(p, dt) {
  if (p.gone) return; if (p.until && GT > p.until) { log(cap1(p.name) + ' fades away.'); rmEnt(p); return; }
  const s = p.summon; let t = null;
  if (s.wild) { if (!isLiving(p.tgt) || GT > (p.retarget || 0)) { p.tgt = summonTarget(p); p.retarget = GT + 2; } t = p.tgt; }
  else { t = p.order === 'attack' && isLiving(p.tgt) && p.tgt.kind === 'mon' ? p.tgt : null; if (p.order === 'attack' && !t) p.order = 'follow'; }
  const reach = 1.1, rng = s.ranged ? s.ranged[3] : 0, dd = t ? dist(p, t) : 0;
  const goal = t ? (dd <= reach || (rng && dd <= rng && los(p, t)) ? null : t) : (s.wild || p.order === 'stay' ? null : { x: P.x - .8, y: P.y + .8 });
  if (goal && !(p.rooted > GT)) { const gd = Math.hypot(goal.x - p.x, goal.y - p.y); if (gd > (t ? reach * .9 : .8)) { const st = Math.min(gd, 4.6 * MOVE_SCALE * dt); moveBy(p, (goal.x - p.x) / gd * st, (goal.y - p.y) / gd * st); p.speed = st / dt; updateFacing(p, goal.x - p.x, goal.y - p.y); } else p.speed = 0; } else p.speed = 0;
  if (!t || GT < (p.ready || 0)) return;
  if (dd <= reach + .2) { p.ready = GT + s.melee[2]; p.state = 'strike'; at(.15, () => p.state = ''); summonMelee(p, t); }
  else if (s.ranged && dd <= rng && los(p, t)) { p.ready = GT + s.ranged[2]; const from = { x: p.x, y: p.y }; EFX.push({ k: 'proj', x: from.x, y: from.y, tx: t.x, ty: t.y, t0: GT, t1: GT + .3, col: s.col || '#c8e0ff', big: 1, at: GT + .3, fn: () => summonRanged(p, t) }); }
}
const ACC = 60;                                                                     // tuning: summon attack skill for the NPC hit roll
function summonMelee(p, t) {                                                          // a physical blow: the shared resolver (src/game.js)
  const s = p.summon; if (!fighterAlive(t)) return; const A = fighter(p), D = fighter(t);
  if (R() >= SF.hitChance(A.atk, D.def)) { missFx(t, p); return; }
  const m = applyBlow(A, t); if (m && m.final > 0 && s.id === 'magery.58' && R() < .25) applyPoison(t, 2);
}
function summonRanged(p, t) {
  if (!isLiving(t)) return; const s = p.summon; if (R() >= SF.hitChance(ACC, fighter(t).def)) { floater(t.x, t.y, 'miss', '#c8c8c8'); return; }   // the hit roll; the bolt itself is spell damage
  const r = MG.resolveHit({ mode: 'half_only', base: rnd(s.ranged[0], s.ranged[1]), circle: s.circle, M: s.M, E: 0, R: rOf(t) }, R); hurt(t, r.applied, p, 'spell');
}

/* ---------- statuses, stats and per-frame upkeep ---------- */
function magicArmor(a) { const g = a.mg; return g && g.armor && g.armor.until > GT ? g.armor.v : 0; }
function recomputeStats() {
  if (!P.base) P.base = { str: P.str, dex: P.dex, int: P.int };
  const g = P.mg || {}; const eff = P._eff || {};
  for (const s of ['str', 'dex', 'int']) { if (eff[s] !== undefined && P[s] !== eff[s]) P.base[s] += P[s] - eff[s];   // trained outside magic: keep the change on the base
    P[s] = MG.effectiveStat(P.base[s], g.mods, s, GT); eff[s] = P[s]; }
  P._eff = eff;
  // pools never fill on a cap increase; they clamp down on a decrease. A living character keeps at least 1 HP.
  P.hp = Math.min(P.hp, SF.maxHp(P)); if (!P.ghost) P.hp = Math.max(1, P.hp); P.stam = Math.min(P.stam, SF.maxStam(P)); P.mana = Math.min(P.mana, SF.maxMana(P));
}
// a strength hex weakens a creature's blows; a dexterity hex its aim (tuning)
function monRaw(m, raw) { return raw * (1 + MG.statDelta(m.mg && m.mg.mods, 'str', GT) / 100); }
function monAcc(m) { return MG.statDelta(m.mg && m.mg.mods, 'dex', GT); }
// Rebounding Armor: absorb a landed melee hit, return a fifth to the attacker
function meleeWard(m, raw) {
  const g = P.mg; if (!g || !g.reactive || g.reactive.until <= GT || g.reactive.pool <= 0) return raw;
  const h = MG.reactiveHit(g.reactive.pool, Math.round(raw)); g.reactive.pool = h.left; floater(P.x, P.y, 'absorbed ' + h.absorbed, '#e8c070');
  if (h.recoil > 0 && alive(m)) damageMon(m, h.recoil, 'phys', P);            // retaliation cannot trigger another ward
  if (h.left <= 0) { g.reactive = null; log('Your rebounding armor is spent.'); }
  return h.through;
}
function magicTick(dt) {
  fieldTick(); gateTick(); if (RESOLVED.size > 4000) RESOLVED.clear();
  if (!P) return; const g = mgOf(P);
  if (P.ghost) { if (g.mods || g.invis || g.form || g.disguise || g.armor || g.reactive || g.mirror || g.night) { P.mg = { mig: g.mig, travelLock: g.travelLock }; recomputeStats(); } return; }
  if (g.invis && (g.invis <= GT || !P.hidden || Math.hypot(P.x - g.invisAt.x, P.y - g.invisAt.y) > .05 || P.armed || (P.lastHit || -1) > g.invisAt.hit)) { if (P.hidden && g.invis > GT) reveal('Your invisibility ends.'); g.invis = 0; }
  if (g.form && g.form.until <= GT) { g.form = null; log('You return to your own shape.'); }
  if (g.disguise && g.disguise.until <= GT) { g.disguise = null; log('Your borrowed face fades.'); }
  if (g.mods) for (const s in g.mods) for (const k of ['pos', 'neg']) if (g.mods[s][k] && g.mods[s][k].until <= GT) g.mods[s][k] = null;
  // control immunity starts when a bind is removed (expiry or damage)
  for (const a of [P, ...ents]) { const m = a.mg; if (m && m.bound && !(a.rooted > GT)) { m.bound = false; m.ctlImmune = GT + MG.CONTROL_IMMUNE; } }
  recomputeStats();
}
function magicChips() { const g = P.mg || {}, c = []; if (g.armor && g.armor.until > GT) c.push('ward +' + g.armor.v); if (g.reactive && g.reactive.until > GT) c.push('rebound ' + g.reactive.pool); if (g.mirror) c.push('mirror'); if (g.night > GT) c.push('night sight'); if (g.invis > GT) c.push('invisible'); if (g.form) c.push(MON[g.form.type].n); if (g.disguise) c.push('as ' + g.disguise.name); if (P.held) c.push(P.held.sp.n + ' held ' + Math.max(0, P.held.until - GT).toFixed(1) + 's'); const ms = g.mods || {}; for (const s of ['str', 'dex', 'int']) { const v = MG.statDelta(ms, s, GT); if (v) c.push(s.toUpperCase() + (v > 0 ? '+' : '') + v); } return c; }
function nightSight() { return P && P.mg && P.mg.night > GT; }

/* ---------- drawing: the sign over the caster, fields, gates, summons, forms ---------- */
const MSIGN = { img: null, url: {} }; { const im = new Image(); im.onload = () => { MSIGN.img = im; }; im.src = MAGERY_ATLAS_SRC; }
function signRect(id) { const sp = MG.SPELL[id]; if (!sp || !MSIGN.img) return null; const k = MSIGN.img.width / 1024; return sp.atlas.map(v => v * k); }
function signURL(id) { if (MSIGN.url[id]) return MSIGN.url[id]; const r = signRect(id); if (!r) return ''; const c = document.createElement('canvas'); c.width = c.height = 64; c.getContext('2d').drawImage(MSIGN.img, r[0], r[1], r[2], r[3], 0, 0, 64, 64); return (MSIGN.url[id] = c.toDataURL('image/jpeg', .9)); }
const FIELD_COL = { stone: ['#8a8378', '#5c564c'], fire: ['rgba(255,120,40,.75)', 'rgba(255,200,80,.9)'], venom: ['rgba(90,210,90,.55)', 'rgba(150,240,120,.8)'], bind: ['rgba(80,220,210,.45)', 'rgba(140,255,240,.9)'], aether: ['rgba(120,200,255,.45)', 'rgba(200,240,255,.95)'] };
function drawMagicFx(g) {
  for (const f of FIELDS) { const X = SX(f.x + .5, f.y + .5), Y = SY(f.x + .5, f.y + .5), c = FIELD_COL[f.kind]; const h = f.kind === 'stone' ? 26 : f.kind === 'aether' ? 40 : 14 + Math.sin(GT * 8 + f.i) * 4;
    g.fillStyle = c[0]; g.beginPath(); g.moveTo(X, Y - HH); g.lineTo(X + HW * .9, Y); g.lineTo(X, Y + HH); g.lineTo(X - HW * .9, Y); g.closePath(); g.fill();
    g.fillStyle = c[0]; g.fillRect(X - HW * .55, Y - h, HW * 1.1, h); g.strokeStyle = c[1]; g.lineWidth = 1.5; g.strokeRect(X - HW * .55, Y - h, HW * 1.1, h); }
  for (const G of GATES) for (const k of ['a', 'b']) { const m = G[k], X = SX(m.x, m.y), Y = SY(m.x, m.y); g.strokeStyle = m.closed ? 'rgba(140,140,160,.6)' : `rgba(120,${180 + Math.sin(GT * 4) * 40 | 0},255,.9)`; g.lineWidth = 3; g.beginPath(); g.ellipse(X, Y - 26, 14, 26, 0, 0, 7); g.stroke(); if (!m.closed) { g.fillStyle = 'rgba(90,140,255,.25)'; g.fill(); } }
  for (const f of EFX) {
    if (f.k === 'mproj' && f.e) { const p = cl((GT - f.t0) / (f.t1 - f.t0), 0, 1); const ax = SX(f.x, f.y), ay = SY(f.x, f.y) - 30, bx = SX(f.e.x, f.e.y), by = SY(f.e.x, f.e.y) - 30; g.fillStyle = f.col; g.beginPath(); g.arc(ax + (bx - ax) * p, ay + (by - ay) * p, 4, 0, 7); g.fill(); }
    if (f.k === 'mring' && f.e && !f.e.gone) { const X = SX(f.e.x, f.e.y), Y = SY(f.e.x, f.e.y); g.strokeStyle = f.col; g.lineWidth = 2; g.beginPath(); g.ellipse(X, Y, 20, 10, 0, 0, 7); g.stroke(); }
  }
  for (const f of FX) if (f.k === 'msign' && MSIGN.img && f.e && !f.e.gone) { const r = signRect(f.id); if (!r) continue; const p = (GT - f.t0) / f.dur, X = SX(f.e.x, f.e.y), Y = SY(f.e.x, f.e.y) - 96 - p * 6; g.globalAlpha = Math.min(1, (1 - p) * 3); g.drawImage(MSIGN.img, r[0], r[1], r[2], r[3], X - 16, Y - 16, 32, 32); g.globalAlpha = 1; }
}
function drawSummon(g, e, x, y) {
  const c = e.summon.col || '#e0e0ff', t = GT * 3 + e.id; g.globalAlpha = .9;
  if (e.summon.id === 'magery.33') { g.strokeStyle = c; g.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = t + i * 2.1; g.beginPath(); g.moveTo(x + Math.cos(a) * 6, y - 20 + Math.sin(a) * 3); g.lineTo(x + Math.cos(a) * 16, y - 26 + Math.sin(a) * 8); g.stroke(); } }
  else if (e.summon.id === 'magery.58') { g.strokeStyle = c; g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(x, y - 10 - i * 8, 14 - i * 2, 5, t + i, 0, 5); g.stroke(); } }
  else { g.fillStyle = c; g.beginPath(); g.ellipse(x, y - 22, 11, 20, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(x - 5, y - 32, 3, 3); g.fillRect(x + 2, y - 32, 3, 3); }
  g.globalAlpha = 1;
}
function drawForm(g, e, x, y) { const f = e === P && P.mg && P.mg.form; if (!f) return false; if (BSI[f.type] && drawBestiary(g, { type: f.type, sect: P.sect, speed: P.speed, state: '', id: 0 }, x, y)) return true; if (MSI[f.type]) return drawSheet(g, f.type, P.sect, P.speed > .3 ? Math.floor(GT * 9) % 4 : 0, x, y); const s = beastSprite({ type: f.type, speed: P.speed, sect: P.sect, state: '' }); g.imageSmoothingEnabled = false; g.drawImage(s, Math.round(x - s.ox), Math.round(y - s.oy)); return true; }

/* ---------- hotbar signs: drag on desktop, "Assign to slot" or long-press on touch ---------- */
function magicSlots() {
  castCancelButton();
  document.querySelectorAll('.slot').forEach((b, i0) => { const s = P.hotbar[i0 + P.hbPage * 3]; const id = s && s.k === 'spell' && MG.SPELL[s.id] ? s.id : ''; const url = id ? signURL(id) : ''; if (b._ic === url) return; b._ic = url;
    b.style.backgroundImage = url ? `linear-gradient(rgba(8,12,24,.05),rgba(8,12,24,.55)),url(${url})` : ''; b.style.backgroundSize = url ? 'cover' : ''; b.classList.toggle('msl', !!url); });
}
let LP = null;
function bindMagicInput() {
  if (bindMagicInput.done) return; bindMagicInput.done = true; const pan = $('#panel');
  const css = document.createElement('style'); css.textContent = '.slot.msl b,.slot.msl small{text-shadow:0 0 3px #000,0 0 6px #000}.slot.drop{border-color:#ffd060}.msig{width:34px;height:34px;border-radius:6px;margin-right:6px;flex:none;cursor:grab;touch-action:none;-webkit-touch-callout:none;user-select:none}.row.na .msig{filter:grayscale(.85) brightness(.6)}.mdet{margin:2px 0 8px 40px;line-height:1.35}#b-mcancel{flex-direction:column;gap:1px;border-color:#c05a4a}#b-mcancel[hidden]{display:none}#b-mcancel b{font:600 11px var(--px);color:#ffb0a0}#b-mcancel small{font:9px var(--px);color:var(--dim);max-width:62px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}#b-mcancel.held{box-shadow:0 0 10px rgba(255,208,96,.6)}'; document.head.appendChild(css);
  { const act = $('#act'), b = document.createElement('button'); b.className = 'round'; b.id = 'b-mcancel'; b.dataset.a = 'mcancel'; b.hidden = true; b.setAttribute('aria-label', 'Cancel cast'); b.style.cssText = '--x:72px;--y:146px;width:66px'; b.innerHTML = '<b>✕ Cancel</b><small></small>'; if (act) act.appendChild(b); }
  pan.addEventListener('dragstart', e => { const s = e.target.closest && e.target.closest('[data-msp]'); if (!s) return; e.dataTransfer.setData('text/x-shardfall-spell', s.dataset.msp); e.dataTransfer.effectAllowed = 'copy'; });
  pan.addEventListener('pointerdown', e => { const s = e.target.closest && e.target.closest('[data-msp]'); if (!s || e.pointerType === 'mouse') return; LP = setTimeout(() => { LP = null; ACT.assign({ k: 'spell', id: s.dataset.msp }); }, 520); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) pan.addEventListener(ev, () => { if (LP) { clearTimeout(LP); LP = null; } });
  document.querySelectorAll('.slot').forEach((b, i0) => { b.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('text/x-shardfall-spell')) { e.preventDefault(); b.classList.add('drop'); } }); b.addEventListener('dragleave', () => b.classList.remove('drop'));
    b.addEventListener('drop', e => { b.classList.remove('drop'); const id = e.dataTransfer.getData('text/x-shardfall-spell'); if (!id || !MG.SPELL[id]) return; e.preventDefault(); P.hotbar[i0 + (P.hbPage || 0) * 3] = { k: 'spell', id }; log(MG.SPELL[id].n + ' bound to the bar.'); save(); refreshHud(); }); });
}

/* ---------- panels: spellbook, runes, forms, gates ---------- */
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
let MDET = null;
function spellbookPanel() {
  const M = mval(), known = knownSpells(), hasBook = SF.count(P.pack, 'spellbook') > 0; const c = +(PTAB || 1) || 1;
  let h = `<div class="note">Magery ${f1(P.skills.magery.v)} · Evaluating Intelligence ${f1(P.skills.evaluatingintelligence.v)} · ${hasBook ? known.size + ' / 64 spells in your book' : '<b class="warn">no spellbook in your pack</b>'}. Tap a slot to prepare, then tap a target to release (3 s hold). Drag a sign to the bar, or long-press it.</div>`;
  h += `<div class="chips">${[1, 2, 3, 4, 5, 6, 7, 8].map(i => btn('mtab', ROMAN[i], { c: i }, i === c ? 'ac' : '')).join('')}</div>`;
  for (const sp of MG.SPELLS.filter(s => s.circle === c)) {
    const k = known.has(sp.id), sc = SF.count(P.pack, sp.scroll), ch = MG.bookChance(sp, M), rg = sp.regs.map(r => `${SF.ITEMS[r].n}${SF.count(P.pack, r) ? '' : ' ✗'}`).join(', ');
    const url = signURL(sp.id); const img = url ? `<img class="msig" src="${url}" alt="" draggable="${k}" data-msp="${sp.id}">` : '';
    let a = ''; if (k) a += btn('mcast', 'Cast', { s: sp.id }, 'ac') + btn('assign', 'Assign to slot', { k: 'spell', id: sp.id });
    if (sc) { a += btn('mread', 'Read scroll', { s: sp.id }); if (!k && hasBook) a += btn('mlearn', 'Learn', { s: sp.id }); }
    h += `<div class="row ${k ? '' : 'na'}">${img}<span class="nm" data-a="mdet" data-s="${sp.id}">${esc(sp.n)} <span class="note">${sp.mp} mp · ${sp.prep.toFixed(2)} s · ${k ? Math.round(ch * 100) + '%' : sc ? 'scroll ×' + sc + ' · ' + Math.round(MG.scrollChance(sp, M) * 100) + '%' : 'not learned'}</span></span>${a}</div>`;
    if (MDET === sp.id) h += `<div class="note mdet"><b>“${esc(sp.chant)}”</b> · classic ${esc(sp.classic)} (<i>${esc(sp.words)}</i>) · ${esc(sp.target)}${sp.range ? ', ' + sp.range + ' m' : ''} · min ${sp.min}<br>${esc(sp.potency)}. ${esc(sp.desc)}<br>Reagents: ${esc(rg)}</div>`;
  }
  return ['Spellbook · Circle ' + ROMAN[c], h];
}
function runePanel() {
  if (!P.held) return null; const sp = P.held.sp, L = runes();
  let h = `<p class="note">${esc(sp.n)}: choose a rune (${Math.max(0, P.held.until - GT).toFixed(1)} s left).</p>`;
  if (!L.length) h += '<p class="warn">You carry no runes. Buy blank runes from the apothecary.</p>';
  for (const it of L) h += `<div class="row"><span class="nm">Rune · ${it.mark ? esc(it.mark.name) : '<span class="note">blank</span>'}</span>${btn('mrune', sp.effect === 'travel_preparation' ? (it.mark ? 'Overwrite' : 'Mark') : 'Use', { u: it.uid }, 'ac')}</div>`;
  return ['Runes', h];
}
function markPanel() { const it = PANEL_MARK && P.pack.items.find(i => i.uid === PANEL_MARK.uid); if (!it || !P.held) return null; const nm = ZONE_NAME[zoneAt(Math.floor(P.x), Math.floor(P.y))] || 'the open marsh';
  return ['Overwrite mark?', `<p>This rune holds <b>${esc(it.mark.name)}</b>. Replace it with <b>${esc(nm)}</b>?</p>${btn('mmarkok', 'Overwrite', { u: it.uid }, 'ac')} ${btn('close', 'Keep the old mark')}`]; }
function formPanel() { if (!P.held) return null; return ['Borrowed Form', '<p class="note">Choose a shape. Your gear, stats and footprint stay your own.</p>' + MG.FORMS.map(f => btn('mform', cap1(MON[f].n), { f }, 'ac')).join(' ')]; }
function gatePanel() { if (!GATE_PROMPT) return null; return ['Rune Gate', `<p>Step through to the other side?</p>${btn('mgate', 'Step through', {}, 'ac')} ${btn('close', 'Stay')}`]; }
function magicItemActions(it) {
  const d = SF.ITEMS[it.id]; let a = '';
  if (d.spell) { a += btn('mread', 'Read', { s: d.spell }); if (SF.count(P.pack, 'spellbook') && !knownSpells().has(d.spell)) a += btn('mlearn', 'Learn', { s: d.spell }); }
  if (it.id === 'spellbook') a += btn('open', 'Open', { p: 'spells' });
  return a;
}
function mageryStarter(add) {
  if (P.skills.magery.v < 100) P.skills.magery.v = 100;            // magic starters begin with at least 10.0 Magery
  P.pack.items.push(SF.newItem('spellbook', 1, { spells: MG.STARTER.slice() }));
  for (const r of Object.keys(MG.REAGENTS)) add(r, 12); add('rune', 1);
}

/* ---------- boot: shops, loot, migration, panels, actions ---------- */
function mageryBoot(saved) {
  const c = P; if (!saved) P.magery = { mig: MG.MIGRATION };
  const mig = MG.migrateChar(c, MG.LEGACY_SPELL);
  if (mig.changed) {
    try { const raw = localStorage.getItem(SAVEKEY); if (raw && !localStorage.getItem(SAVEKEY + '.premagery')) localStorage.setItem(SAVEKEY + '.premagery', raw); } catch (e) { }   // snapshot once
    if (mig.book.length && !P.pack.items.some(it => it.id === 'spellbook')) { P.pack.items.push(SF.newItem('spellbook', 1, { spells: mig.book })); P.pack.ver++; log('Your spells are copied into a classic spellbook (' + mig.book.length + ' pages). The apothecary sells the new reagents.', '#ffe08a'); }
  }
  P.mg = Object.assign({ mig: MG.MIGRATION }, P.magery || {}); P.magery = P.mg;
  P.base = P.base || { str: P.str, dex: P.dex, int: P.int }; P._eff = null; recomputeStats();
  if (!SHOPS.apothecary.includes('black_pearl')) { SHOPS.apothecary.push(...Object.keys(MG.REAGENTS), 'spellbook', 'rune', ...MG.SPELLS.filter(s => s.circle <= 3).map(s => s.scroll)); SHOPS.outlaw.push('nightshade', 'black_pearl', ...MG.SPELLS.filter(s => s.circle === 4 || s.circle === 5).map(s => s.scroll)); }
  const L = (k, o) => { if (MON[k] && !MON[k].loot.__mg) Object.assign(MON[k].loot, o, { __mg: 0 }); };
  L('spider', { spider_silk: [1, 3] }); L('wisp', { sulfurous_ash: [1, 3] }); L('smuggler', { black_pearl: [0, 2], nightshade: [0, 2] }); L('boar', { mandrake_root: [0, 1] }); L('captain', { black_pearl: [2, 4], blood_moss: [1, 3] }); L('bellkeeper', { [MG.SPELLS[50].scroll]: [1, 1] });
  Object.assign(PANELS, { spells: spellbookPanel, mrunes: runePanel, mmark: markPanel, mform: formPanel, mgate: gatePanel });
  Object.assign(ACT, {
    mtab: d => { PTAB = d.c; MDET = null; renderPanel(true); }, mdet: d => { MDET = MDET === d.s ? null : d.s; renderPanel(); },
    mcast: d => { closePanel(); castSlot(d.s); }, mread: d => { closePanel(); castSlot(d.s, { scroll: true }); },
    mlearn: d => { const r = MG.learn(P.pack, MG.SPELL[d.s].scroll); log(r.ok ? `${r.spell.n} is written into your spellbook.` : cap1(r.reason) + '.', r.ok ? '#7ee08a' : '#ffb070'); renderPanel(); save(); },
    mrune: d => { if (P.held) releaseHeld({ rune: true }, { rune: d.u }); }, mmarkok: d => { closePanel(); if (P.held) releaseHeld({ rune: true }, { rune: d.u, confirm: true }); },
    mform: d => { if (P.held) releaseHeld(P, { form: d.f }); }, mgate: stepGate, mcancel: cancelCast });
  bindMagicInput();
}

/* ---------- launch-book spells: kept castable for old hotbars that still name them ---------- */
function spellDmg(base) { return SF.spellDamage(base, sv('evaluatingintelligence'), 0); }
function applyLegacy(sp, t) {
  const sc = sv('magery');
  if (sp.heal) { const amt = Math.round(sp.heal[0] + sp.heal[1] * sc); const tgt = t.kind ? t : P; const b = tgt.hp; tgt.hp = Math.min(tgt === P ? SF.maxHp(P) : tgt.max, tgt.hp + amt); FX.push({ k: 'heal', x: tgt.x, y: tgt.y, t0: GT, dur: .8 }); floater(tgt.x, tgt.y, '+' + Math.round(tgt.hp - b), '#7ee08a'); spellSnd(sp, tgt); return; }
  if (sp.absorb) { P.veil = { left: sp.absorb, until: GT + sp.dur }; floater(P.x, P.y, 'stoneveil', '#c8b890'); spellSnd(sp, P); return; }
  if (sp.recall) { const s = SHRINES.find(z => z.id === P.bound); P.x = s.x + .5; P.y = s.y + 1.7; FX.push({ k: 'ring', x: P.x, y: P.y, c: '#ffe08a', t0: GT, dur: .8 }); log('You return to the ' + s.n + '.'); SFXA.cancelPending(); spellSnd(sp, P); return; }
  if (sp.summon) { if (petSlotsUsed() > 0) return log('The Reedling needs both control slots. Dismiss your pets first.'); addEnt({ kind: 'pet', type: null, name: 'Reedling', x: P.x + 1, y: P.y, hp: 40, max: 40, until: GT + sp.summon, order: 'follow', slots: 2 }); log('A Reedling rises from the reeds.', '#ffe08a'); spellSnd(sp, { x: P.x + 1, y: P.y }); return; }
  if (sp.cloud) { EFX.push({ k: 'cloud', x: t.x, y: t.y, r: sp.radius, until: GT + sp.cloud }); spellSnd(sp, t); for (const m of ents) if (m.kind === 'mon' && m.target === P && !los(m, P)) { m.state = 'return'; m.target = null; } return; }
  if (sp.root) { EFX.push({ k: 'root', x: t.x, y: t.y, r: sp.radius, until: GT + sp.root }); spellSnd(sp, t); for (const m of ents) if (m.kind === 'mon' && alive(m) && Math.hypot(m.x - t.x, m.y - t.y) <= sp.radius) { m.rooted = GT + sp.root; floater(m.x, m.y, 'rooted', '#c8a070'); if (!m.target) { m.target = P; m.state = 'chase'; } } return; }
  if (sp.id === 'saltstorm') { EFX.push({ k: 'groundwarn', x: t.x, y: t.y, r: sp.radius, t0: GT, at: GT + sp.warn, fn: () => { FX.push({ k: 'bolt', x: t.x, y: t.y, t0: GT, dur: .3 }); spellSnd(sp, t); for (const m of ents.slice()) if (m.kind === 'mon' && alive(m) && Math.hypot(m.x - t.x, m.y - t.y) <= sp.radius) damageMon(m, spellDmg(sp.dmg), 'spell'); skillCheck('evaluatingintelligence', 0, 100); } }); return; }
  const m = t; if (m === P || m.kind !== 'mon') return; if (!m.target) { m.target = P; m.state = 'chase'; }
  if (sp.unweave) { if (m.ward > 0) { m.ward = 0; floater(m.x, m.y, 'unwoven', '#c8a0ff'); spellSnd(sp, m); } else log('There is no ward on that creature to unweave.'); return; }
  if (sp.hex) { m.hexUntil = GT + sp.hex; floater(m.x, m.y, 'hexed', '#c97bff'); spellSnd(sp, m); return; }
}
