/* ---------- character creation v2.0 (docs/design/character-creation-v2.md) ----------
   The title screen and the four-step creator: Identity & Appearance → Starting Profession → Stats & Skills → Starting Town &
   Review. The draft (CCD) is transient and separate from the game: nothing in the world is generated or ticks behind the
   wizard, and nothing is saved until boot() succeeds with a payload that SF.CREATION.validate accepts (the same validator boot
   runs again). The rules live in src/creation.js; this file is only the screen. It also starts the game loop (last line). */
const CR = SF.CREATION;
const CC_STEPS = ['Identity', 'Profession', 'Stats & Skills', 'Town & Review'];
const CC_GROUPS = [['combat', 'Combat'], ['support', 'Healing'], ['magic', 'Magic'], ['stealth', 'Thieving'], ['wild', 'Wilderness'], ['bard', 'Bardic'], ['gather', 'Gathering'], ['craft', 'Crafting']];
const CCD = { screen: 'home', step: 0, name: '', look: CR.defaultLook('male'), tpl: 'swordsman', edited: false, pending: null, stats: [35, 20, 10], skills: [], town: 'quay', replace: false, facing: 0, guide: '', creating: false, err: '', tried: false };
function ccSetTemplate(id) { const a = CR.template(id); if (!a) return; CCD.tpl = id; CCD.stats = a.stats; CCD.skills = a.skills; CCD.edited = false; CCD.pending = null; }
ccSetTemplate('swordsman');
const ccSkillName = k => (SF.SKILL[k] || SF.SKILL[SF.skillKey(k)] || { n: String(k) }).n;   // drafts may hold any spelling (tests, old links)
const ccSum = a => a.reduce((x, y) => x + y, 0);
const ccSkillTotal = () => CCD.skills.reduce((x, r) => x + (r[0] ? r[1] : 0), 0);
function ccPayload() { return { name: CCD.name, look: Object.assign({}, CCD.look), str: CCD.stats[0], dex: CCD.stats[1], int: CCD.stats[2], skills: CCD.skills.map(r => [r[0], r[0] ? r[1] : 0]), town: CCD.town }; }
function ccValidate() { return CR.validate(ccPayload()); }
function ccMarkEdited() { const m = CR.matchTemplate(CCD.stats, CCD.skills); CCD.edited = !m || m !== CCD.tpl; if (m) CCD.tpl = m; }
const ccTplName = () => CCD.edited ? 'Custom' : CR.TEMPLATE[CCD.tpl].n;

/* the portrait is the paperdoll itself (src/paperdoll.js): the same SF.LOOK descriptor and compositor as the equipment window,
   wearing the starter kit this draft would receive. The preview items are plain { id } records built here and thrown away:
   nothing is made, numbered or saved until boot() succeeds. */
function ccPreviewEquip() {
  const skills = {}; for (const [k, v] of CCD.skills) if (k && v > 0) skills[k] = v;
  let wear; try { wear = CR.kit({ skills, str: CCD.stats[0] }).wear; } catch (_) { wear = { shirt: 'shirt', trousers: 'trousers', feet: 'shoes' }; }
  const eq = {}; for (const s in wear) if (SF.ITEMS[wear[s]]) eq[s] = { id: wear[s] }; return eq;
}
function drawDoll(cv, look) { PDOLL.drawTo(cv, SF.LOOK.resolve({ look }, { preview: ccPreviewEquip() })); }
/* ---- the world sprite: the same sheets and recolouring the game draws (tinted, src/game.js) ---- */
function ccSpriteFrame(cv, t) {
  const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.imageSmoothingEnabled = false;
  const im = ANIM.img.Walk ? tinted(ANIM.img.Walk, CCD.look, 'Walk') : null;
  if (im) { const f = Math.floor(t * 9) % 8; g.drawImage(im, f * 128 + 24, CCD.facing * 128 + 14, 80, 104, 0, 0, cv.width, cv.height); return; }   // the figure, cropped from its 128 px cell
  const sh = scoutSheet(CCD.look); if (!sh) return; const s = CCD.facing, cx = (s % 4) * 96, cy = Math.floor(s / 4) * 96; g.drawImage(sh, cx + 18, cy + 6, 60, 82, 0, 0, cv.width, cv.height);
}
let CC_RAF = 0;
function ccAnimate(ts) { CC_RAF = 0; if ($('#cc').hidden || CCD.screen !== 'wiz') return; const cv = $('#ccsprite'); if (cv) ccSpriteFrame(cv, ts / 1000); CC_RAF = requestAnimationFrame(ccAnimate); }
function ccStartAnim() { if (!CC_RAF) CC_RAF = requestAnimationFrame(ccAnimate); }
function ccPreview() {
  const d = $('#ccdoll'); if (d) drawDoll(d, CCD.look);
  const n = $('#ccpname'); if (n) n.textContent = CR.cleanName(CCD.name) || 'Unnamed';
  const t = $('#ccptpl'); if (t) t.textContent = ccTplName() + ' · ' + (CCD.look.body === 'female' ? 'Female' : 'Male');
  const p = CR.preview(CCD.stats), dv = $('#ccderived'); if (dv) dv.innerHTML = `<span>Health</span><b>${p.hp}</b><span>Stamina</span><b>${p.stam}</b><span>Mana</span><b>${p.mana}</b><span>Carry</span><b>${Math.round(p.carry)}</b>`;
  const ws = $('#ccwnote'); if (ws) ws.textContent = CCD.look.cloak === 'none' ? 'In the world your traveller keeps a cloak: cloakless sprites are not drawn yet.' : 'The portrait is your paper doll. In the world: skin tone and cloak colour; hair, beards and clothing colour show on the portrait until their sprite layers are drawn.';
}

/* ---- markup helpers ---- */
const ccBtn = (c, label, data, cls, extra) => `<button type="button" class="ccb ${cls || ''}" data-c="${c}"${Object.entries(data || {}).map(([k, v]) => ` data-${k}="${esc(String(v))}"`).join('')}${extra || ''}>${label}</button>`;
function ccSwatches(key, list, label) {
  return `<div class="ccfield"><div class="cclab" id="lab-${key}">${label}</div><div class="ccsw" role="radiogroup" aria-labelledby="lab-${key}" data-group="${key}">${list.map(x => {
    const on = CCD.look[key] === x.id; const sw = x.hex !== undefined ? `<i style="background:${x.hex || (key === 'cloak' ? (x.id === 'none' ? 'transparent' : '#2f6766') : '#888')}"${x.id === 'none' ? ' class="none"' : ''}></i>` : '';
    return `<button type="button" role="radio" aria-checked="${on}" class="${on ? 'on' : ''} ${x.hex !== undefined ? 'col' : 'txt'}" data-c="look" data-k="${key}" data-v="${x.id}" aria-label="${esc(x.n)}" title="${esc(x.n)}">${sw}${x.hex !== undefined ? '' : esc(x.n)}</button>`; }).join('')}</div></div>`;
}
function ccStepHtml() {
  const L = CCD.look, step = CCD.step;
  if (step === 0) return `<h2>Identity &amp; appearance</h2>
    <div class="ccfield"><label class="cclab" for="ccn">Name</label><input id="ccn" maxlength="24" value="${esc(CCD.name)}" placeholder="2–16 letters" autocomplete="off" autocapitalize="words" spellcheck="false" aria-describedby="ccn-err"><div id="ccn-err" class="ccerr" role="alert"></div></div>
    <div class="ccfield"><div class="cclab" id="lab-body">Body</div><div class="ccseg" role="radiogroup" aria-labelledby="lab-body">${CR.BODIES.map(b => `<button type="button" role="radio" aria-checked="${L.body === b.id}" class="${L.body === b.id ? 'on' : ''}" data-c="body" data-v="${b.id}">${b.n}</button>`).join('')}</div><p class="ccnote">Human only for now. Body never changes stats, skills or gear.</p></div>
    ${ccSwatches('skinTone', CR.SKIN, 'Skin tone')}${ccSwatches('hairStyle', CR.hairFor(L.body), 'Hairstyle')}${ccSwatches('hairColor', CR.HAIR_COLORS, 'Hair colour')}
    ${L.body === 'male' ? ccSwatches('facialHairStyle', CR.FACIAL, 'Facial hair') + (L.facialHairStyle !== 'none' ? ccSwatches('facialHairColor', CR.HAIR_COLORS, 'Facial hair colour') : '') : ''}
    ${ccSwatches('clothingColor', CR.CLOTHING, 'Shirt colour')}${ccSwatches('cloak', CR.CLOAKS, 'Cloak')}`;
  if (step === 1) return `<h2>Starting profession</h2><p class="ccnote">A template only fills in the numbers on the next page. There are no classes: you can change everything, and your title comes from the skills you actually raise.</p>
    ${CCD.pending ? `<div class="ccwarn" role="alertdialog" aria-labelledby="ccpendt"><b id="ccpendt">Replace your edited numbers with ${esc(CR.TEMPLATE[CCD.pending].n)}?</b> Your name and appearance stay.<div class="ccrow">${ccBtn('tplok', 'Replace', { t: CCD.pending }, 'pri')}${ccBtn('tplno', 'Keep mine')}</div></div>` : ''}
    <div class="cctpls" role="radiogroup" aria-label="Templates">${CR.TEMPLATES.map(t => { const on = !CCD.edited && CCD.tpl === t.id, iss = CR.templateIssues(t.id);
      return `<button type="button" role="radio" aria-checked="${on}" class="cctpl ${on ? 'on' : ''}" data-c="tpl" data-t="${t.id}"${iss.length ? ' disabled' : ''}><b>${esc(t.n)}</b><span class="ccts">${t.s.join(' / ')}</span><span class="cctk">${t.advanced ? 'Pick your own skills' : t.k.map(([n, v]) => esc(n) + ' ' + v).join(' · ')}</span><span class="ccnote">${esc(t.d)}${iss.length ? ' — ' + esc(iss.join(', ')) : ''}</span></button>`; }).join('')}</div>
    ${CCD.edited ? '<p class="ccnote">Current numbers: <b>Custom</b>.</p>' : ''}`;
  if (step === 2) {
    const left = SF.CREATE_STATS - ccSum(CCD.stats), sl = SF.CREATE_SKILLS - ccSkillTotal();
    const statRow = (i, n) => `<div class="ccstat"><label for="st${i}">${n}</label>${ccBtn('st', '−', { i, d: -1 }, 'pm', ` aria-label="Lower ${n}"`)}<input type="range" id="st${i}" min="${SF.CREATE_STAT_MIN}" max="${SF.CREATE_STAT_MAX}" value="${CCD.stats[i]}" data-c="stv" data-i="${i}"><input type="number" class="ccnum" min="${SF.CREATE_STAT_MIN}" max="${SF.CREATE_STAT_MAX}" value="${CCD.stats[i]}" data-c="stn" data-i="${i}" aria-label="${n} value" inputmode="numeric">${ccBtn('st', '+', { i, d: 1 }, 'pm', ` aria-label="Raise ${n}"`)}</div>`;
    const opts = (cur, i) => `<option value="">— none —</option>` + CC_GROUPS.map(([g, gn]) => { const ks = CR.CREATABLE.filter(k => SF.SKILL[k].g === g); if (!ks.length) return ''; return `<optgroup label="${gn}">${ks.map(k => { const used = CCD.skills.some((r, j) => j !== i && r[0] === k); return `<option value="${k}"${k === cur ? ' selected' : ''}${used ? ' disabled' : ''}>${esc(SF.SKILL[k].n)}${used ? ' (chosen)' : ''}</option>`; }).join('')}</optgroup>`; }).join('');
    const skRow = (r, i) => `<div class="ccsk"><select data-c="sk" data-i="${i}" aria-label="Skill ${i + 1}">${opts(r[0], i)}</select><div class="ccstat sm">${ccBtn('kv', '−', { i, d: -1 }, 'pm', ` aria-label="Lower skill ${i + 1}"${r[0] ? '' : ' disabled'}`)}<input type="range" min="0" max="${SF.CREATE_SKILL_MAX}" value="${r[0] ? r[1] : 0}" data-c="kvv" data-i="${i}" aria-label="Skill ${i + 1} points"${r[0] ? '' : ' disabled'}><input type="number" class="ccnum" min="0" max="${SF.CREATE_SKILL_MAX}" value="${r[0] ? r[1] : 0}" data-c="kvn" data-i="${i}" aria-label="Skill ${i + 1} points value" inputmode="numeric"${r[0] ? '' : ' disabled'}>${ccBtn('kv', '+', { i, d: 1 }, 'pm', ` aria-label="Raise skill ${i + 1}"${r[0] ? '' : ' disabled'}`)}</div><div class="ccnote" id="skd${i}">${r[0] ? esc(CR.SKILL_INFO[SF.skillKey(r[0])] || '') : 'Empty row: leave at 0 or pick a skill.'}</div></div>`;
    return `<h2>Stats &amp; skills <span class="ccbadge">${esc(ccTplName())}</span></h2>
    <div class="ccsec"><div class="cchd"><span>Attributes</span><span id="ccstleft" class="${left ? 'bad' : 'good'}">${left} of ${SF.CREATE_STATS} left</span></div>
    ${statRow(0, 'Strength')}${statRow(1, 'Dexterity')}${statRow(2, 'Intelligence')}
    <p class="ccnote">Each ${SF.CREATE_STAT_MIN}–${SF.CREATE_STAT_MAX} now. They grow as you use skills, to 100 each and ${SF.STAT_CAP} together.</p></div>
    <div class="ccsec"><div class="cchd"><span>Skills</span><span id="ccskleft" class="${sl ? 'bad' : 'good'}">${sl} of ${SF.CREATE_SKILLS} left</span></div>
    ${CCD.skills.map(skRow).join('')}
    <p class="ccnote">Two or three different skills, at most ${SF.CREATE_SKILL_MAX} each. All other skills start at 0.0, every skill set to ▲ Raise. Skills grow to 100.0 each, ${SF.SKILL_CAP / 10} together.</p>
    <details class="ccguide"${CCD.guide ? ' open' : ''}><summary>Skill guide</summary><input id="ccgq" type="search" placeholder="Search skills" value="${esc(CCD.guide)}" aria-label="Search skills" autocomplete="off"><div id="ccglist">${ccGuideHtml()}</div></details></div>
    <div class="ccrow">${ccBtn('reset', 'Reset to ' + esc(CR.TEMPLATE[CCD.tpl].n))}</div>`;
  }
  // step 3: town and review
  const v = ccValidate(); const val = v.ok ? v.value : null; const kit = val ? CR.kit(val) : null; const sv0 = ccSaved();
  return `<h2>Starting town &amp; review</h2>
    <div class="cctowns" role="radiogroup" aria-label="Starting town">${CR.TOWNS.map(t => { const on = CCD.town === t.id, rec = CR.TEMPLATES.filter(x => x.town === t.id && !x.advanced).map(x => x.n);
      return `<button type="button" role="radio" aria-checked="${on}" class="cctown ${on ? 'on' : ''}" data-c="town" data-t="${t.id}"><b>${esc(t.n)}</b>${t.tutorial ? '<span class="ccbadge">Tutorial · recommended</span>' : ''}<span class="ccnote">${esc(t.d)}</span><span class="cctk">${t.services.map(esc).join(' · ')}</span>${rec.length ? `<span class="ccnote">Suits: ${esc(rec.join(', '))}</span>` : ''}</button>`; }).join('')}</div>
    ${CCD.town !== 'quay' ? '<p class="ccnote">The Quay\'s tutorial (Wren and the Shore Beacon) stays at Saltmarsh Quay; you can sail there from Vespar.</p>' : ''}
    <div class="ccsec ccrev"><div class="cchd"><span>Review</span></div>
    <div class="cckv"><span>Name</span><b>${esc(CR.cleanName(CCD.name) || '—')}</b><span>Body</span><b>${CCD.look.body === 'female' ? 'Female' : 'Male'}</b><span>Template</span><b>${esc(ccTplName())}</b>
    <span>Attributes</span><b>STR ${CCD.stats[0]} · DEX ${CCD.stats[1]} · INT ${CCD.stats[2]}</b><span>Skills</span><b>${CCD.skills.filter(r => r[0] && r[1] > 0).map(r => esc(ccSkillName(r[0])) + ' ' + r[1]).join(' · ') || '—'}</b><span>Town</span><b>${esc(CR.TOWN[CCD.town].n)}</b>
    ${kit ? `<span>Starting kit</span><b>${ccKitText(kit)}</b>` : ''}</div>
    ${kit && kit.notes.length ? `<p class="ccwarnline">${kit.notes.map(esc).join(' ')}</p>` : ''}</div>
    ${v.ok ? '' : `<div class="ccerrs" role="alert" tabindex="-1" id="ccerrs"><b>Before you can begin:</b><ul>${Object.entries(v.field).filter(([, e]) => e.length).map(([f, e]) => `<li>${e.map(esc).join(' ')} ${ccBtn('fix', 'Fix', { f }, 'sm')}</li>`).join('')}</ul></div>`}
    ${sv0 ? `<div class="ccwarn"><label class="ccchk"><input type="checkbox" data-c="replace"${CCD.replace ? ' checked' : ''}> Replace <b>${esc(sv0.char.name)}</b>. Only one character fits in this browser; the old one is gone once the new one starts.</label><div class="ccrow">${ccBtn('export', 'Download ' + esc(sv0.char.name) + '\'s save first')}</div></div>` : ''}
    <div id="ccerr" class="ccerr" role="alert">${esc(CCD.err)}</div>`;
}
function ccKitText(k) {
  const L = Object.values(k.wear).map(id => SF.ITEMS[id] ? SF.itemName({ id }) : id);
  for (const [id, q] of k.pack) L.push((SF.ITEMS[id].stack && q > 1 ? q + ' ' : '') + SF.itemName({ id, qty: q }) + (id === 'spellbook' ? ` (${k.spells.length} spells)` : ''));
  return L.map(esc).join(', ');
}
function ccGuideHtml() {
  const q = CCD.guide.trim().toLowerCase();
  return SF.SKILLS.filter(([k, n]) => !q || n.toLowerCase().includes(q) || (CR.SKILL_INFO[k] || '').toLowerCase().includes(q)).map(([k, n, g]) => {
    const ok = CR.creatable(k), used = CCD.skills.some(r => r[0] === k), free = CCD.skills.findIndex(r => !r[0]);
    return `<div class="ccgi${ok ? '' : ' na'}"><b>${esc(n)}</b> <span class="ccnote">${esc((CC_GROUPS.find(x => x[0] === g) || [, ''])[1])}</span><br><span class="ccnote">${esc(ok ? CR.SKILL_INFO[k] : (SF.SKILL_NOCREATE[k] || 'Not available yet.'))}</span>${ok && !used && free >= 0 ? ' ' + ccBtn('gadd', 'Add', { k }, 'sm') : ''}${used ? ' <span class="ccbadge">chosen</span>' : ''}</div>`; }).join('') || '<p class="ccnote">No skill matches.</p>';
}
function ccSaved() { const s = loadSave(); return s && s.char && typeof s.char.name === 'string' ? s : null; }

/* ---- screens ---- */
function ccHomeHtml() {
  const sv0 = ccSaved();
  return `<div class="cchome"><div class="ccbrand"><h1>Shardfall</h1><div class="ccsub">A Second Age sandbox · Anniabreen</div></div>
    <div class="ccmenu">${sv0 ? ccBtn('cont', `Continue as ${esc(sv0.char.name)}${sv0.char.ghost ? ' (ghost)' : ''}`, {}, 'pri big') : ''}${ccBtn('new', 'New character', {}, (sv0 ? '' : 'pri ') + 'big')}</div>
    ${sv0 ? '<p class="ccnote">Your character saves in this browser. Starting a new one asks before it replaces the old one.</p>' : '<p class="ccnote">Your character saves in this browser.</p>'}</div>`;
}
function ccWizHtml() {
  const v = ccValidate();
  return `<div class="ccwiz"><header class="cctop"><b class="ccmark">Shardfall</b><nav class="ccsteps" aria-label="Creation steps">${CC_STEPS.map((n, i) => `<button type="button" class="${i === CCD.step ? 'on' : ''}${i < CCD.step ? ' done' : ''}" data-c="step" data-s="${i}" aria-current="${i === CCD.step ? 'step' : 'false'}"><i>${i + 1}</i><span>${n}</span></button>`).join('')}</nav></header>
    <div class="ccbody"><aside class="ccprev" aria-label="Preview"><div class="ccfig"><canvas id="ccdoll" width="192" height="256" role="img" aria-label="Portrait of your character"></canvas><div class="ccws"><canvas id="ccsprite" width="80" height="104" role="img" aria-label="Your character as seen in the world"></canvas><div class="ccrot">${ccBtn('face', '⟲', { d: 1 }, 'pm', ' aria-label="Turn left"')}${ccBtn('face', '⟳', { d: -1 }, 'pm', ' aria-label="Turn right"')}</div></div></div>
      <div class="ccpinfo"><b id="ccpname"></b><span id="ccptpl" class="ccnote"></span><div id="ccderived" class="ccderived"></div><p id="ccwnote" class="ccnote"></p></div></aside>
      <main class="ccmain" id="ccmain">${ccStepHtml()}</main></div>
    <footer class="ccnav">${ccBtn('back', CCD.step ? '← Back' : '← Title', {}, '')}<span class="ccnote ccwhy" id="ccwhy">${CCD.step === 3 && !v.ok ? esc(v.errors[0]) : ''}</span>${CCD.step < 3 ? ccBtn('next', 'Next →', {}, 'pri') : ccBtn('go', 'Begin your journey', {}, 'pri', ccGoBlocked(v) ? ' disabled aria-disabled="true"' : '')}</footer></div>`;
}
const ccGoBlocked = v => !v.ok || CCD.creating || (ccSaved() && !CCD.replace);
function ccRender(focusSel) {
  const el = $('#ccin'); el.innerHTML = CCD.screen === 'home' ? ccHomeHtml() : ccWizHtml(); el.className = CCD.screen;
  if (CCD.screen === 'wiz') { ccPreview(); ccStartAnim(); ccNameErr(); }
  const f = focusSel && el.querySelector(focusSel); if (f) f.focus();
}
function ccRenderStep(focusSel) { const m = $('#ccmain'); if (!m) return ccRender(focusSel); const st = m.scrollTop; m.innerHTML = ccStepHtml(); m.scrollTop = st; ccRefreshNav(); ccPreview(); ccNameErr(); const f = focusSel && m.querySelector(focusSel); if (f) f.focus(); }
function ccRefreshNav() {
  const v = ccValidate(), go = $('#ccin [data-c=go]'); if (go) { const b = ccGoBlocked(v); go.disabled = b; go.setAttribute('aria-disabled', String(b)); }
  const w = $('#ccwhy'); if (w) w.textContent = CCD.step === 3 ? (!v.ok ? v.errors[0] : ccSaved() && !CCD.replace ? 'Tick “Replace” to start a new character.' : '') : '';
  document.querySelectorAll('#ccin .ccsteps button').forEach((b, i) => { b.classList.toggle('on', i === CCD.step); b.classList.toggle('done', i < CCD.step); b.setAttribute('aria-current', i === CCD.step ? 'step' : 'false'); });
}
function ccNameErr() { const e = $('#ccn-err'); if (!e) return; const m = CR.checkName(CCD.name); e.textContent = CCD.tried || CCD.name ? (m || '') : ''; }
// live numbers on the stats page without re-rendering it (sliders keep focus and the drag)
function ccLiveNumbers() {
  const left = SF.CREATE_STATS - ccSum(CCD.stats), sl = SF.CREATE_SKILLS - ccSkillTotal();
  const a = $('#ccstleft'); if (a) { a.textContent = `${left} of ${SF.CREATE_STATS} left`; a.className = left ? 'bad' : 'good'; }
  const b = $('#ccskleft'); if (b) { b.textContent = `${sl} of ${SF.CREATE_SKILLS} left`; b.className = sl ? 'bad' : 'good'; }
  CCD.stats.forEach((v, i) => { for (const sel of [`[data-c=stv][data-i="${i}"]`, `[data-c=stn][data-i="${i}"]`]) { const el = $('#ccin ' + sel); if (el && document.activeElement !== el) el.value = v; } });
  CCD.skills.forEach((r, i) => { for (const sel of [`[data-c=kvv][data-i="${i}"]`, `[data-c=kvn][data-i="${i}"]`]) { const el = $('#ccin ' + sel); if (el && document.activeElement !== el) el.value = r[0] ? r[1] : 0; } });
  const bd = $('#ccin h2 .ccbadge'); if (bd) bd.textContent = ccTplName(); ccPreview(); ccRefreshNav();
}
/* the budget rules: a value moves only as far as the remaining points allow, so the total never goes over */
function ccSetStat(i, v) { if (!Number.isFinite(v)) return; v = Math.round(v); const room = SF.CREATE_STATS - (ccSum(CCD.stats) - CCD.stats[i]); CCD.stats[i] = cl(v, SF.CREATE_STAT_MIN, Math.min(SF.CREATE_STAT_MAX, Math.max(SF.CREATE_STAT_MIN, room))); ccMarkEdited(); }
function ccSetSkill(i, v) { const r = CCD.skills[i]; if (!r || !r[0] || !Number.isFinite(v)) return; v = Math.round(v); const room = SF.CREATE_SKILLS - (ccSkillTotal() - r[1]); r[1] = cl(v, 0, Math.min(SF.CREATE_SKILL_MAX, Math.max(0, room))); ccMarkEdited(); }
function ccGoStep(s) { CCD.step = cl(s, 0, 3); CCD.err = ''; ccRender(); const m = $('#ccmain'); if (m) { m.scrollTop = 0; const h = m.querySelector('h2'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } } }
function ccExport() {
  const raw = localStorage.getItem(SAVEKEY); if (!raw) return; const s = ccSaved(); const name = (s && s.char.name || 'character').replace(/[^\p{L}\p{N}_-]+/gu, '_');
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' })); a.download = `Shardfall_${name}_save.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); } catch (e) { console.error(e); }
}
/* commit: the one path from the creator into the game (also __CC.quick for tests). Validates, keeps a copy of a replaced save,
   then boots; boot validates again. A second press while it runs does nothing. */
function ccCommit() {
  if (CCD.creating || P) return false; CCD.tried = true; const v = ccValidate();
  if (!v.ok) { CCD.err = ''; if (CCD.step !== 3) ccGoStep(3); else ccRenderStep(); const e = $('#ccerrs'); if (e) e.focus(); return false; }
  const old = localStorage.getItem(SAVEKEY); if (old && ccSaved() && !CCD.replace) { CCD.err = 'Tick “Replace” to start a new character.'; ccRenderStep(); return false; }
  CCD.creating = true; ccRefreshNav();
  let ok = false; try { if (old) { try { localStorage.setItem(SAVEKEY + '.replaced', old); } catch (e) { } } ok = boot(null, ccPayload()); } catch (e) { console.error(e); ok = false; }
  if (!ok) { CCD.creating = false; if (!P) { CCD.err = 'The character could not be created. Nothing was changed.'; ccRender(); } return false; }
  cancelAnimationFrame(CC_RAF); CC_RAF = 0; return true;
}
function ccContinue() { const s = loadSave(); if (s && !P) boot(s); }

/* ---- events: one delegated listener per kind; typing and dragging never re-render the page ---- */
$('#cc').addEventListener('click', ev => {
  const b = ev.target.closest('[data-c]'); if (!b || b.disabled || b.tagName === 'SELECT' || b.tagName === 'INPUT') return; const c = b.dataset.c; const d = b.dataset;
  if (c === 'cont') return ccContinue();
  if (c === 'new') { CCD.screen = 'wiz'; CCD.step = 0; CCD.replace = false; CCD.err = ''; ccRender('#ccn'); snd('ui.page'); return; }
  if (c === 'back') { if (CCD.step) ccGoStep(CCD.step - 1); else { CCD.screen = 'home'; ccRender('[data-c=new]'); } return; }
  if (c === 'next') { if (CCD.step === 0) { CCD.tried = true; ccNameErr(); if (CR.checkName(CCD.name) || CR.checkLook(CCD.look).length) { const n = $('#ccn'); if (n) n.focus(); return; } } ccGoStep(CCD.step + 1); snd('ui.page'); return; }
  if (c === 'step') { ccGoStep(+d.s); return; }
  if (c === 'go') { ccCommit(); return; }
  if (c === 'look') { CCD.look[d.k] = d.v; if (d.k === 'facialHairStyle') return ccRenderStep(`[data-c=look][data-k="${d.k}"][data-v="${d.v}"]`);
    b.parentElement.querySelectorAll('button').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); }); ccPreview(); return; }
  if (c === 'body') { const L = CCD.look; L.body = d.v; if (!CR.hairFor(L.body).some(h => h.id === L.hairStyle)) L.hairStyle = CR.defaultLook(L.body).hairStyle; if (L.body === 'female') L.facialHairStyle = 'none'; ccRenderStep(`[data-c=body][data-v="${d.v}"]`); return; }
  if (c === 'face') { CCD.facing = (CCD.facing + 8 + (+d.d)) % 8; return; }
  // a template overwrites edited numbers only after a warning; the town is never changed for you (the town cards show what suits)
  if (c === 'tpl') { if (CCD.edited) { CCD.pending = d.t; ccRenderStep('[data-c=tplok]'); return; } ccSetTemplate(d.t); ccRenderStep(`[data-c=tpl][data-t="${d.t}"]`); return; }
  if (c === 'tplok') { ccSetTemplate(d.t); ccRenderStep(`[data-c=tpl][data-t="${d.t}"]`); return; }
  if (c === 'tplno') { CCD.pending = null; ccRenderStep(); return; }
  if (c === 'st') { ccSetStat(+d.i, CCD.stats[+d.i] + (+d.d)); ccLiveNumbers(); return; }
  if (c === 'kv') { const r = CCD.skills[+d.i]; if (r && r[0]) { ccSetSkill(+d.i, r[1] + (+d.d)); ccLiveNumbers(); } return; }
  if (c === 'reset') { ccSetTemplate(CCD.tpl); ccRenderStep(); return; }
  if (c === 'gadd') { const i = CCD.skills.findIndex(r => !r[0]); if (i >= 0 && CR.creatable(d.k) && !CCD.skills.some(r => r[0] === d.k)) { CCD.skills[i] = [d.k, 0]; ccMarkEdited(); ccRenderStep(`select[data-i="${i}"]`); } return; }
  if (c === 'town') { CCD.town = d.t; ccRenderStep(`[data-c=town][data-t="${d.t}"]`); return; }
  if (c === 'fix') { ccGoStep({ name: 0, look: 0, stats: 2, skills: 2, town: 3 }[d.f] || 0); return; }
  if (c === 'export') { ccExport(); return; }
});
$('#cc').addEventListener('input', ev => {
  const t = ev.target, c = t.dataset && t.dataset.c;
  if (t.id === 'ccn') { CCD.name = t.value; ccNameErr(); ccPreview(); ccRefreshNav(); return; }
  if (t.id === 'ccgq') { CCD.guide = t.value; const L = $('#ccglist'); if (L) L.innerHTML = ccGuideHtml(); return; }
  if (c === 'stv') { ccSetStat(+t.dataset.i, +t.value); t.value = CCD.stats[+t.dataset.i]; ccLiveNumbers(); return; }
  if (c === 'kvv') { ccSetSkill(+t.dataset.i, +t.value); t.value = CCD.skills[+t.dataset.i][1]; ccLiveNumbers(); return; }
});
$('#cc').addEventListener('change', ev => {
  const t = ev.target, c = t.dataset && t.dataset.c;
  if (c === 'stn') { const v = parseInt(t.value, 10); if (Number.isFinite(v)) ccSetStat(+t.dataset.i, v); t.value = CCD.stats[+t.dataset.i]; ccLiveNumbers(); return; }
  if (c === 'kvn') { const v = parseInt(t.value, 10); if (Number.isFinite(v)) ccSetSkill(+t.dataset.i, v); t.value = CCD.skills[+t.dataset.i][1]; ccLiveNumbers(); return; }
  if (c === 'sk') { const i = +t.dataset.i, k = t.value || null; if (k && (!CR.creatable(k) || CCD.skills.some((r, j) => j !== i && r[0] === k))) { t.value = CCD.skills[i][0] || ''; return; }   // atomic: a duplicate is refused, nothing changes
    const keep = CCD.skills[i][0] ? CCD.skills[i][1] : 0; CCD.skills[i] = [k, k ? keep : 0]; if (k) ccSetSkill(i, keep); ccMarkEdited(); ccRenderStep(`select[data-i="${i}"]`); return; }
  if (c === 'replace') { CCD.replace = t.checked; CCD.err = ''; ccRefreshNav(); const e = $('#ccerr'); if (e) e.textContent = ''; return; }
});
$('#cc').addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && ev.target.id === 'ccn') { ev.preventDefault(); const n = $('#ccin [data-c=next]'); if (n) n.click(); }
  if (ev.key === 'Enter' && ev.target.classList && ev.target.classList.contains('ccnum')) ev.target.blur();
});

/* test and tooling hook: the real creator state and commit path (no shortcut around validation) */
window.__CC = {
  get draft() { return JSON.parse(JSON.stringify(CCD)); }, validate: () => ccValidate(), render: ccRender, step: ccGoStep, CR,
  // quick({ name, template, town, look, stats, skills, replace }) → true when the game started
  quick(o) { o = o || {}; CCD.screen = 'wiz'; ccSetTemplate(o.template || 'swordsman'); CCD.name = o.name || 'Tess'; CCD.look = Object.assign(CR.defaultLook((o.look && o.look.body) || 'male'), o.look || {});
    if (o.stats) CCD.stats = o.stats.slice(); if (o.skills) { CCD.skills = o.skills.map(r => r.slice()); while (CCD.skills.length < SF.CREATE_SKILL_SLOTS) CCD.skills.push([null, 0]); ccMarkEdited(); }
    CCD.town = o.town || 'quay'; CCD.replace = o.replace !== false; CCD.step = 3; ccRender(); return ccCommit(); } };

loadScout(SCOUT_SRC); ccRender(); resize(); requestAnimationFrame(loop);
