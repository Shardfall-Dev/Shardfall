/* ================= LAYERED HUMANS (layered armor v1.0): one renderer for the player, the ally, townsfolk, guards, merchants and human
   enemies. The rig (SF.HRIG, src/human-rig.js) draws every piece of worn equipment on its own moving limb, in its own material colour,
   ordered by depth for the facing and the pose. Appearance only: it reads equipment and never touches combat, inventory or saves.
   Strips (one direction × one animation) are built off the render loop by a small job queue, cached in a bounded LRU shared by
   every actor with the same look, and drawn with nearest-neighbour. Until a strip is ready the actor keeps its previous strip,
   or the legacy sprite. Legacy renderer: ?renderer=legacy (remembered); ?renderer=layered switches back. ================= */
const HRIG = SF.HRIG;
const HR = { on: true, scale: 1.08, variants: 4, frame: 0, cache: new Map(), px: 0, maxPx: 14e6, queue: [], pending: new Map(), live: 0, timer: 0,
  stats: { built: 0, evicted: 0, buildMs: 0, maxBuildMs: 0, hits: 0, misses: 0, unsupported: new Set() }, dolls: new Map() };
(function hrFlag() {
  try { const lowMem = (navigator.deviceMemory && navigator.deviceMemory <= 4) || matchMedia('(pointer:coarse)').matches; if (lowMem) HR.maxPx = 8e6; } catch (e) { }   // phones: ~32 MB of strips
  let v = null; try { const q = new URLSearchParams(location.search).get('renderer'); if (q === 'legacy' || q === 'layered') localStorage.setItem('shardfall.renderer', q); v = localStorage.getItem('shardfall.renderer'); } catch (e) { }
  HR.on = v !== 'legacy' && !!HRIG;
})();
const hrHash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const HR_FEMALE = /\b(odile|sela|rhea|wenna|fenna|ewe|maud|moira|maeve|mags|ysolde|adda|mara|dena|brega|merrin|iska|kessa|lise|mabry|mira|nell|wren|sorrel)\b|sister|woman|mistress/i;
const HR_SKINS = ['#ca9a72', '#ac7854', '#937450', '#815338', '#684333', '#d2a682'], HR_HAIRS = ['#302a25', '#65452e', '#493327', '#b69a58', '#914a32', '#8b8981', '#c5c1b6'];
const HR_STYLES_M = ['cropped', 'short', 'parted', 'short', 'bald', 'long'], HR_STYLES_F = ['long', 'ponytail', 'bun', 'braid', 'parted'], HR_BEARDS = ['none', 'none', 'stubble', 'goatee', 'short', 'full'];
/* cosmetic presets for humans without an inventory (townsfolk and human enemies). Appearance only, never added to any pack;
   anyone who carries real equipment (the player, the ally) is drawn from it instead. */
const HR_PRESET = {
  guard: { head: 'closed_helm', neck: 'plate_gorget', chest: 'plate_chest', arms: 'plate_arms', hands: 'plate_gauntlets', legs: 'plate_leggings', feet: 'boots', cloak: 'cloak', weapon: 'glaive' },
  quaywarden: { chest: 'chain_tunic', legs: 'chain_leggings', feet: 'boots', belt: 'belt', cloak: 'cloak', weapon: 'sword' },
  ranger: { head: 'leather_cap', chest: 'studded_tunic', arms: 'leather_sleeves', legs: 'leather_leggings', feet: 'boots', cloak: 'cloak', weapon: 'shortbow' },
  trainer: { chest: 'studded_tunic', arms: 'studded_sleeves', legs: 'leather_leggings', feet: 'boots', weapon: 'sword' },
  smith: { hands: 'leather_gloves', feet: 'boots', belt: 'belt', chest: 'leather_tunic' }, qsmith: { hands: 'leather_gloves', feet: 'boots', belt: 'belt', chest: 'leather_tunic' },
  workshop: { chest: 'leather_tunic', feet: 'boots', weapon: 'shortbow' }, fletcher: { chest: 'leather_tunic', feet: 'boots' },
  healer: { robe: 'robe', feet: 'shoes' }, apothecary: { robe: 'robe', feet: 'shoes' }, mage: { robe: 'robe', feet: 'shoes', necklace: 'necklace' }, scholar: { robe: 'robe', feet: 'shoes' }, reagents: { robe: 'robe', feet: 'shoes' },
  banker: { tunic: 'tabard', feet: 'shoes', belt: 'belt', ring: 'ring' }, assay: { tunic: 'tabard', feet: 'shoes', belt: 'belt' }, provisioner: { tunic: 'tabard', feet: 'shoes', belt: 'belt' }, trader: { tunic: 'tabard', feet: 'boots', belt: 'belt', cloak: 'cloak' },
  innkeeper: { tunic: 'tabard', feet: 'shoes', belt: 'belt' }, tailor: { tunic: 'tabard', feet: 'shoes' }, tinker: { feet: 'shoes', belt: 'belt' }, fishmonger: { feet: 'boots', belt: 'belt' },
  ferry: { feet: 'boots', belt: 'belt' }, boat: { feet: 'boots', belt: 'belt', cloak: 'cloak' }, packet: { feet: 'boots', belt: 'belt', cloak: 'cloak' }, stable: { feet: 'boots' }, miner: { feet: 'boots', hands: 'leather_gloves', weapon: 'pickaxe' },
  outlaw: { head: 'leather_cap', chest: 'leather_tunic', legs: 'leather_leggings', feet: 'boots', weapon: 'dagger' }, campbank: { chest: 'leather_tunic', feet: 'boots' }, traveller: { feet: 'boots', cloak: 'cloak' },
  student: { robe: 'robe', feet: 'shoes' }, fisher: { feet: 'boots', belt: 'belt' }, dockhand: { feet: 'boots', belt: 'belt' }, townsfolk: { feet: 'shoes' }, woodcutter: { feet: 'boots', weapon: 'hatchet' }, weaver: { robe: 'robe', feet: 'shoes' },
  // human enemies
  smuggler: { head: 'leather_cap', chest: 'studded_tunic', arms: 'studded_sleeves', legs: 'studded_leggings', feet: 'boots', weapon: 'sword', sec: 'dull_copper' },
  bandit: { chest: 'leather_tunic', legs: 'leather_leggings', feet: 'boots', weapon: 'dagger' },
  captain: { head: 'bascinet', chest: 'chain_tunic', arms: 'ringmail_sleeves', legs: 'chain_leggings', feet: 'boots', cloak: 'cloak', weapon: 'sword', metal: 'shadow_iron' } };
const HR_HIDES = ['regular', 'regular', 'thick', 'wolf'];
function hrPresetEquip(key, seed) {
  const P0 = HR_PRESET[key] || { feet: 'shoes' }, eq = {};
  for (const s in P0) { if (s === 'sec' || s === 'metal') continue; const id = P0[s], d = SF.ITEMS[id]; if (!d) continue; const it = { id };
    if (d.prim === 'hide') it.material = HR_HIDES[seed % HR_HIDES.length]; else if (d.prim === 'metal') it.material = P0.metal || 'iron'; else if (d.prim === 'wood') it.material = 'pine';
    if (d.sec) it.sec = P0.sec || 'iron'; eq[s] = it; }
  return eq;
}
const hrHumanKind = e => !!e && (e.kind === 'player' || e.kind === 'ally' || e.kind === 'npc' || (e.kind === 'mon' && MON[e.type] && !!MON[e.type].scout)), hrIsHuman = e => hrHumanKind(e) && !e.gone;
const hrNpcKey = e => e.kind === 'mon' ? e.type : (e.life && e.life.prof === 'guard') || e.role === 'guard' ? 'guard' : (HR_PRESET[e.role] ? e.role : (e.life && e.life.prof) || e.role || 'townsfolk');
/* the creator's appearance ids (Character Creation v2, when present) → colours; anything else keeps the rig defaults */
function hrLookOf(look, seedName, female) {
  const CRm = SF.CREATION, h = hrHash(seedName || ''), hex = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : null;
  const from = (tab, id) => { const r = CRm && CRm[tab] && CRm[tab][id]; return r && hex(r.hex); };
  const lk = look || {}, body = lk.body === 'female' || lk.body === 'male' ? lk.body : (female ? 'female' : 'male');
  const styleMap = { buns: 'bun', pigtails: 'braid', mohawk: 'cropped', receding: 'cropped', shaved: 'bald' };
  let style = lk.hairStyle ? (styleMap[lk.hairStyle] || (HRIG.HAIRSTYLES.includes(lk.hairStyle) ? lk.hairStyle : 'short')) : (body === 'female' ? HR_STYLES_F[h % HR_STYLES_F.length] : HR_STYLES_M[h % HR_STYLES_M.length]);
  const beardMap = { none: 'none', stubble: 'stubble', goatee: 'goatee', short: 'short', full: 'full', long: 'full', moustache: 'stubble' };
  const beard = body === 'female' ? 'none' : lk.facialHairStyle ? (beardMap[lk.facialHairStyle] || 'short') : (look ? 'none' : HR_BEARDS[(h >>> 5) % HR_BEARDS.length]);
  return { body, style, beard,
    skin: from('SKIN_ID', lk.skinTone) || (lk.skinTone === 'light' ? '#d2a682' : null) || hex(lk.skin) || (look ? '#d2a682' : HR_SKINS[(h >>> 3) % HR_SKINS.length]),
    hair: from('HCOL_ID', lk.hairColor) || hex(lk.hair) || HR_HAIRS[(h >>> 7) % HR_HAIRS.length],
    cloth: from('CLOTH_ID', lk.clothingColor) || (CRm && CRm.cloakHex ? CRm.cloakHex(lk) : null) || hex(lk.cloak) || null };
}
/* the drawable description of an actor, recomputed only when its equipment signature or look changes */
function hrDesc(e) {
  const c = e._hr || (e._hr = {}); let sig;
  if (e.kind === 'player' || (e.kind === 'ally' && e.equip)) sig = SF.EQ.signature(e) + '|' + (e.look ? JSON.stringify(e.look) : '');
  else sig = 'preset:' + hrNpcKey(e);
  if (c.sig === sig && c.d) return c.d;
  let equip, lk;
  if (e.kind === 'player') { equip = e.equip; lk = hrLookOf(e.look, e.name, false); }
  else if (e.kind === 'ally') { equip = e.equip || {}; lk = hrLookOf(null, e.name || 'ally', HR_FEMALE.test(e.name || '')); lk.cloth = lk.cloth || '#2f7a46'; }
  else { const key = hrNpcKey(e), seed = hrHash(e.name || e.type || key), fem = HR_FEMALE.test(e.name || ''); equip = hrPresetEquip(key, seed); lk = hrLookOf(null, key + ':' + (seed % HR.variants), fem);   // one of a few faces per role and body: crowds share strips
    lk.cloth = e.kind === 'mon' ? MON[e.type].scout : (NPC_COL[e.role] || (e.life && LIFE_COL[e.life.prof]) || HRIG.CLOTH.linen); }
  const R = HRIG.resolveGear(equip), w = HRIG.weaponOf(equip && equip.weapon && !(equip.weapon.cond === 0) ? equip.weapon : null);
  for (const u of R.unsupported) HR.stats.unsupported.add(u); if (w.unsupported) HR.stats.unsupported.add(w.id);
  const d = Object.assign({ gear: R.gear, weapon: w }, lk); d.key = [HRIG.VERSION, d.body, d.skin, d.hair, d.cloth, d.style, d.beard, HRIG.gearKey(d.gear), w.id + (w.two ? '2' : '')].join('|');
  c.sig = sig; c.d = d; return d;
}
/* which animation and frame the actor shows now. Visual only: every time comes from the simulation's own timestamps */
const HR_ATK = .45, hrIdn = e => typeof e.id === 'number' ? e.id : 0;
function hrState(e, d) {
  const n8 = (t0, dur) => Math.max(0, Math.min(7, Math.floor(8 * (GT - t0) / dur)));
  if (e.lunge && e.lunge < .5 && (!e._hrAtk || GT - e._hrAtk > HR_ATK)) e._hrAtk = GT - e.lunge * .2;   // a swing started (the combat resolver sets lunge)
  if (e === P) {
    if (P.prep && GT >= P.prep.t0) { const sp = P.prep.sp, k = d.weapon.shape === 'staff' ? 'caststaff' : (sp && sp.circle >= 5 ? 'cast2h' : 'cast1h'); return { action: k, frame: Math.min(3, Math.floor(4 * (GT - P.prep.t0) / Math.max(.05, P.prep.t1 - P.prep.t0))) }; }
    if (P.held) return { action: d.weapon.shape === 'staff' ? 'caststaff' : 'cast1h', frame: 3 + Math.floor(GT * 6) % 2 };
    if (P.once && /Cast/.test(P.once.clip || '') && GT - P.once.t0 < .5) return { action: 'cast1h', frame: 4 + n8(P.once.t0, .5) / 2 | 0 };
  }
  if (e._hrAtk && GT - e._hrAtk < HR_ATK) return { action: d.weapon.attack, frame: n8(e._hrAtk, HR_ATK) };
  if (e.hitT && GT - e.hitT < .22) return { action: 'hit', frame: Math.min(3, Math.floor((GT - e.hitT) / .055)) };
  if (e === P && P.bandage) return { action: 'bandage', frame: Math.floor(GT * 6) % 8 };
  if (e === P && P.task && P.task.still) {
    const t = P.task, loop = Math.floor(GT * 8) % 8;
    if (t.kind === 'gather' && t.node) { const sk = t.node.skill; if (sk === 'mining') return { action: 'mine', frame: loop, shape: 'pickaxe' }; if (sk === 'woodcutting' || sk === 'lumberjacking') return { action: 'chopwood', frame: loop, shape: 'hatchet' }; if (sk === 'fishing') return { action: 'fish', frame: loop, shape: 'fishingpole' }; return { action: 'bandage', frame: loop }; }
    if (t.kind === 'craft') { const r = SF.RECIPE[t.r]; return r && r.skill === 'smithing' ? { action: 'smith', frame: loop, shape: 'smithhammer' } : { action: 'bandage', frame: loop }; }
    if (t.kind === 'skin') return { action: 'chop1h', frame: loop, shape: 'dagger' };
  }
  if (e.speed > .3) { const run = e === P ? !!(P.sprintOn && e.speed > 5) : e.speed > 5.2; return { action: run ? 'run' : 'walk', frame: Math.floor(GT * (run ? 13 : 11) * Math.min(1.4, Math.max(.7, e.speed / 5)) + hrIdn(e)) % 8 }; }
  if (e.kind === 'mon' && (e.state === 'tele' || e.state === 'rec')) return { action: 'ready', frame: Math.floor(GT * 4) % 4 };
  if (e === P && (P.drawn || P.armed)) return { action: d.weapon.id === 'unarmed' ? 'ready' : 'ready', frame: Math.floor(GT * 4) % 4 };
  return { action: 'idle', frame: Math.floor(GT * 2.2 + hrIdn(e) * .37) % 4 };
}
/* ---------- strip cache and the off-loop builder ---------- */
function hrKey(d, action, shape, dir) { return d.key + '|' + action + '|' + (shape || '') + '|' + dir; }
function hrGet(d, action, shape, dir, prio) {
  const k = hrKey(d, action, shape, dir), hit = HR.cache.get(k);
  if (hit) { HR.cache.delete(k); HR.cache.set(k, hit); HR.stats.hits++; return hit; }      // LRU touch
  HR.stats.misses++; const pj = HR.pending.get(k); if (pj) { pj.seen = HR.frame; return null; }
  { const job = { k, seen: HR.frame, o: { body: d.body, dir, action, gear: d.gear, weapon: d.weapon, shape, skin: d.skin, hair: d.hair, cloth: d.cloth, style: d.style, beard: d.beard } }; HR.pending.set(k, job); if (prio) HR.queue.unshift(job); else HR.queue.push(job); hrKick(); }
  return null;
}
function hrKick() { if (!HR.timer && HR.queue.length) HR.timer = setTimeout(hrPump, 0); }
function hrPump() {
  HR.timer = 0; const t0 = performance.now();
  let started = 0; while (HR.queue.length && HR.live < 2 && started < 12 && performance.now() - t0 < 4) { const job = HR.queue.shift();
    if (HR.frame - job.seen > 20) { HR.pending.delete(job.k); continue; }                       // nobody draws it any more (walked off, turned away)
    HR.live++; started++; hrBuild(job).catch(err => { console.warn('layered sprite failed', job.k, err); }).finally(() => { HR.live--; HR.pending.delete(job.k); hrKick(); }); }
  if (HR.queue.length) HR.timer = setTimeout(hrPump, 16);
}
async function hrBuild(job) {
  const a = performance.now(), n = HRIG.ANIMATIONS[job.o.action] || 1, C = HRIG.CELL;
  const cv = document.createElement('canvas'); cv.width = n * C.width; cv.height = C.height; const g = cv.getContext('2d', { willReadFrequently: true });
  HRIG.drawStrip(g, job.o);
  const id = g.getImageData(0, 0, cv.width, cv.height), px = id.data; for (let i = 3; i < px.length; i += 4) px[i] = px[i] < 96 ? 0 : 255;   // hard pixel edges
  g.putImageData(id, 0, 0);
  const ms = performance.now() - a; HR.stats.built++; HR.stats.buildMs += ms; HR.stats.maxBuildMs = Math.max(HR.stats.maxBuildMs, ms);
  HR.cache.set(job.k, { cv, n }); HR.px += cv.width * cv.height;
  for (const [k, v] of HR.cache) { if (HR.px <= HR.maxPx) break; HR.cache.delete(k); HR.px -= v.cv.width * v.cv.height; HR.stats.evicted++; }
}
/* warm the common strips of the player after an equipment change, so the new look appears in every direction at once */
function hrWarm(e) { if (!HR.on || !hrIsHuman(e)) return; const d = hrDesc(e); for (const ac of ['idle', 'walk']) for (let dir = 0; dir < 8; dir++) hrGet(d, ac, undefined, ((e.sect || 0) + dir) % 8, dir < 1); }
/* draw a living human; false → the caller draws the legacy sprite */
function hrDraw(g, e, x, y) {
  if (!HR.on || !hrIsHuman(e)) return false; if (HR.lastGT !== GT) { HR.lastGT = GT; HR.frame++; }
  const d = hrDesc(e), st = hrState(e, d), dir = e.sect || 0, C = HRIG.CELL, S = HR.scale;
  let s = hrGet(d, st.action, st.shape, dir, e === P), f = st.frame;
  if (s) e._hrLast = { s, f, k: d.key }; else if (e._hrLast) { s = e._hrLast.s; f = Math.min(e._hrLast.f, s.n - 1); } else return false;
  g.imageSmoothingEnabled = false;
  g.drawImage(s.cv, Math.min(f, s.n - 1) * C.width, 0, C.width, C.height, Math.round(x - C.anchorX * S), Math.round(y - C.anchorY * S), Math.round(C.width * S), Math.round(C.height * S));
  return true;
}
/* ---------- corpses keep the look they died in (visual only: the loot container is untouched; the actor may already be removed) ---------- */
function hrSnapshot(e) { if (!hrHumanKind(e)) return null; const d = hrDesc(e); return { d, dir: e.sect || 0, t0: GT }; }
/* a body restored from a save: the look comes from what lies in it (the first wearable per slot) */
function hrSnapshotFromItems(items, look, name) {
  const equip = {}; for (const it of items || []) { const dd = it && SF.ITEMS[it.id]; if (dd && dd.slot && !equip[dd.slot]) equip[dd.slot] = it; }
  const R = HRIG.resolveGear(equip), w = HRIG.weaponOf(equip.weapon), lk = hrLookOf(look, name, false), d = Object.assign({ gear: R.gear, weapon: w }, lk);
  d.key = [HRIG.VERSION, d.body, d.skin, d.hair, d.cloth, d.style, d.beard, HRIG.gearKey(d.gear), w.id + (w.two ? '2' : '')].join('|'); return { d, dir: 0, t0: -99 };
}
function hrDrawCorpse(g, e, x, y) {
  if (!HR.on || !e.hr) return false; const h = e.hr, C = HRIG.CELL, S = HR.scale, dying = GT - h.t0 < .6;
  const s = hrGet(h.d, dying ? 'death' : 'corpse', undefined, h.dir) || (dying ? hrGet(h.d, 'corpse', undefined, h.dir) : null); if (!s) return false;
  const f = dying && s.n > 1 ? Math.min(7, Math.floor((GT - h.t0) / .6 * 8)) : 0;
  g.imageSmoothingEnabled = false; g.drawImage(s.cv, f * C.width, 0, C.width, C.height, Math.round(x - C.anchorX * S), Math.round(y - C.anchorY * S), Math.round(C.width * S), Math.round(C.height * S));
  return true;
}
/* ---------- paper doll: the same resolved equipment and materials as the world, facing the viewer ---------- */
function hrDollURL() {
  if (!HR.on || !P || P.ghost) return null; const d = hrDesc(P), k = d.key; const u = HR.dolls.get(k); if (u) return u;
  const s = hrGet(d, 'idle', undefined, 0, true); if (!s) { if (!HR.dollWait) HR.dollWait = setTimeout(() => { HR.dollWait = 0; if (SETTINGS.eqOpen) renderEqWin(); }, 60); return null; }
  const c = document.createElement('canvas'), C = HRIG.CELL; c.width = C.width; c.height = C.height; c.getContext('2d').drawImage(s.cv, 0, 0, C.width, C.height, 0, 0, C.width, C.height);
  const url = c.toDataURL('image/png'); if (HR.dolls.size > 24) HR.dolls.delete(HR.dolls.keys().next().value); HR.dolls.set(k, url); return url;
}
/* developer/test hooks */
window.__HR = { HR, equipUid, unequipTo, playerDies, hrDesc, hrState, hrDraw, hrSnapshot, hrPresetEquip, hrWarm, coverage: () => HRIG.coverage(), info: () => ({ on: HR.on, strips: HR.cache.size, mpx: +(HR.px / 1e6).toFixed(2), queue: HR.queue.length, built: HR.stats.built, evicted: HR.stats.evicted, hits: HR.stats.hits, misses: HR.stats.misses, avgBuildMs: +(HR.stats.buildMs / Math.max(1, HR.stats.built)).toFixed(2), maxBuildMs: +HR.stats.maxBuildMs.toFixed(2), unsupported: [...HR.stats.unsupported] }) };
