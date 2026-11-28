/* ---------- character creation v2.0 (docs/design/character-creation-v2.md) ----------
   The title screen and the four-step creator: Identity & Appearance → Starting Profession → Stats & Skills → Starting Town &
   Review. The draft (CCD) is transient and separate from the game: nothing in the world is generated or ticks behind the
   wizard, and nothing is saved until boot() succeeds with a payload that SF.CREATION.validate accepts (the same validator boot
   runs again). The rules live in src/creation.js; this file is only the screen. It also starts the game loop (last line). */
const CR = SF.CREATION;
const CC_STEPS = ['Identity', 'Profession', 'Stats & Skills', 'Town & Review'];
const CC_GROUPS = SF.SKILL_GROUPS;   // the classic skill-window groups (src/rules.js)
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

/* ---- the portrait: an original procedural paper-doll figure that shows every appearance choice (front view) ---- */
function ccShade(hex, k) { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v + k * (k < 0 ? v : 255 - v) / 100))); return '#' + ((1 << 24) | (f(n >> 16) << 16) | (f(n >> 8 & 255) << 8) | f(n & 255)).toString(16).slice(1); }
function drawDoll(cv, look) {
  const o = document.createElement('canvas'); o.width = 48; o.height = 96; const g = o.getContext('2d');
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const fem = look.body === 'female', skin = (CR.SKIN_ID[look.skinTone] || CR.SKIN[1]).hex, hair = (CR.HCOL_ID[look.hairColor] || CR.HAIR_COLORS[1]).hex;
  const beard = (CR.HCOL_ID[look.facialHairColor] || CR.HAIR_COLORS[1]).hex, shirt = (CR.CLOTH_ID[look.clothingColor] || CR.CLOTHING[0]).hex;
  const cloak = look.cloak === 'none' ? null : (CR.cloakHex(look) || '#2f6766'), trou = '#4a3a2b', boot = '#5b3b1f', belt = '#3a2616';
  const hs = look.hairStyle, hd = ccShade(hair, -30);
  // back layer: cloak and long hair behind the body
  if (cloak) { for (let y = 25; y < 82; y++) { const t = (y - 25) / 57, half = Math.round(10 + t * 4); R(24 - half, y, half * 2, 1, y % 9 === 0 ? ccShade(cloak, -18) : cloak); } R(9, 80, 30, 2, ccShade(cloak, -35)); }
  if (hs === 'long') { R(14, 12, 4, fem ? 24 : 20, hd); R(30, 12, 4, fem ? 24 : 20, hd); }
  if (hs === 'pigtails') { R(11, 14, 4, 22, hair); R(33, 14, 4, 22, hair); R(11, 34, 4, 2, hd); R(33, 34, 4, 2, hd); }
  if (hs === 'ponytail') { R(31, 10, 3, 4, hair); R(32, 14, 3, 18, hd); }
  // legs and boots
  const lx = fem ? [18, 25] : [17, 26]; for (const x of lx) { R(x, 57, 5, 27, trou); R(x + 4, 57, 1, 27, ccShade(trou, -25)); R(x - 1, 84, 7, 7, boot); R(x - 1, 90, 7, 1, ccShade(boot, -40)); }
  // torso and arms
  if (fem) { R(16, 25, 16, 6, shirt); R(16, 31, 16, 12, shirt); R(18, 43, 12, 7, shirt); R(16, 50, 16, 8, ccShade(shirt, -8)); R(19, 33, 4, 2, ccShade(shirt, -15)); R(25, 33, 4, 2, ccShade(shirt, -15)); }
  else { R(14, 25, 20, 6, shirt); R(15, 31, 18, 15, shirt); R(16, 46, 16, 12, shirt); }
  R(fem ? 30 : 31, 27, 2, 29, ccShade(shirt, -22));
  const ax = fem ? [12, 32] : [10, 34]; for (const x of ax) { R(x, 26, 4, 20, ccShade(shirt, -6)); R(x, 46, 4, 5, skin); R(x, 50, 4, 1, ccShade(skin, -25)); }
  R(fem ? 18 : 16, 49, fem ? 12 : 16, 3, belt); R(23, 49, 3, 3, '#b08d4a');
  R(17, 24, 14, 2, ccShade(shirt, -18));                                   // collar line
  // neck and head
  R(21, 20, 6, 6, ccShade(skin, -12));
  R(18, 7, 12, 15, skin); R(17, 9, 14, 10, skin); R(19, 21, 10, 1, skin); R(29, 9, 2, 10, ccShade(skin, -10));
  R(20, 14, 2, 2, '#241812'); R(26, 14, 2, 2, '#241812'); R(20, 14, 1, 1, '#f4efe6'); R(26, 14, 1, 1, '#f4efe6');
  R(23, 16, 2, 2, ccShade(skin, -18)); R(22, 19, 4, 1, ccShade(skin, -35));
  if (fem) { R(19, 13, 3, 1, hd); R(26, 13, 3, 1, hd); R(21, 19, 6, 1, ccShade(skin, -45)); } else { R(19, 12, 4, 1, hd); R(25, 12, 4, 1, hd); }
  // hair on top
  const cap = () => { R(17, 4, 14, 4, hair); R(16, 6, 16, 4, hair); R(16, 10, 2, 5, hair); R(30, 10, 2, 5, hair); R(18, 4, 12, 1, ccShade(hair, 25)); };
  if (hs === 'short' || hs === 'ponytail') cap();
  if (hs === 'long') { cap(); R(15, 10, 3, 12, hair); R(30, 10, 3, 12, hair); }
  if (hs === 'pigtails') { cap(); R(15, 10, 3, 6, hair); R(30, 10, 3, 6, hair); }
  if (hs === 'pageboy') { cap(); R(15, 9, 3, 13, hair); R(30, 9, 3, 13, hair); R(18, 8, 12, 3, hair); R(15, 21, 3, 1, hd); R(30, 21, 3, 1, hd); }
  if (hs === 'receding') { R(16, 8, 3, 7, hair); R(29, 8, 3, 7, hair); R(19, 5, 10, 1, hd); }
  if (hs === 'mohawk') { R(22, 0, 4, 9, hair); R(22, 0, 4, 1, ccShade(hair, 25)); R(16, 10, 2, 4, hd); R(30, 10, 2, 4, hd); }
  if (hs === 'buns') { cap(); R(13, 3, 5, 5, hair); R(30, 3, 5, 5, hair); R(14, 4, 3, 1, ccShade(hair, 25)); R(31, 4, 3, 1, ccShade(hair, 25)); }
  if (hs === 'bald') R(20, 7, 6, 1, ccShade(skin, 20));
  // facial hair (male only; the validator clears it for female characters)
  const fh = fem ? 'none' : look.facialHairStyle, bd = ccShade(beard, -25);
  if (fh === 'mustache' || fh === 'vandyke') { R(20, 18, 8, 1, beard); R(20, 19, 1, 1, bd); R(27, 19, 1, 1, bd); }
  if (fh === 'goatee' || fh === 'vandyke') { R(22, 20, 4, 3, beard); R(23, 23, 2, fh === 'vandyke' ? 2 : 1, bd); }
  if (fh === 'short') { R(17, 15, 2, 6, beard); R(29, 15, 2, 6, beard); R(18, 18, 12, 1, beard); R(18, 20, 12, 3, beard); R(20, 23, 8, 1, bd); R(22, 19, 4, 1, ccShade(skin, -35)); }
  if (fh === 'long') { R(17, 15, 2, 7, beard); R(29, 15, 2, 7, beard); R(18, 18, 12, 1, beard); R(18, 20, 12, 6, beard); R(19, 26, 10, 3, beard); R(21, 29, 6, 3, bd); R(22, 19, 4, 1, ccShade(skin, -35)); }
  const out = outlined(o); const g2 = cv.getContext('2d'); g2.clearRect(0, 0, cv.width, cv.height); g2.imageSmoothingEnabled = false;
  const k = Math.max(1, Math.floor(Math.min(cv.width / out.width, cv.height / out.height))); g2.drawImage(out, Math.round((cv.width - out.width * k) / 2), Math.round(cv.height - out.height * k), out.width * k, out.height * k);
}
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
  const ws = $('#ccwnote'); if (ws) ws.textContent = CCD.look.cloak === 'none' ? 'In the world your traveller keeps a cloak: cloakless sprites are not drawn yet.' : 'In the world: skin tone and cloak colour. Hair, beards and clothing colour show on the portrait until their sprite layers are drawn.';
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
  return SF.SKILLS.filter(([k, n]) => !q || n.toLowerCase().includes(q) || (CR.info(k) || '').toLowerCase().includes(q)).map(([k, n, g]) => {
    const ok = CR.creatable(k), used = CCD.skills.some(r => r[0] === k), free = CCD.skills.findIndex(r => !r[0]);
    return `<div class="ccgi${ok ? '' : ' na'}"><b>${esc(n)}</b> <span class="ccnote">${esc((CC_GROUPS.find(x => x[0] === g) || [, ''])[1])}</span><br><span class="ccnote">${esc(ok ? CR.info(k) : (SF.SKILL_NOCREATE[k] || 'Not available yet.'))}</span>${ok && !used && free >= 0 ? ' ' + ccBtn('gadd', 'Add', { k }, 'sm') : ''}${used ? ' <span class="ccbadge">chosen</span>' : ''}</div>`; }).join('') || '<p class="ccnote">No skill matches.</p>';
}
function ccSaved() { const s = loadSave(); return s && s.char && typeof s.char.name === 'string' ? s : null; }

/* ---- screens ---- */
/* recovery (v0.28.2 stabilization): a save that does not read, or failed to load, is never deleted silently */
function ccRecoverHtml() {
  const rs = readSave(); if (!rs.problem && !CC.bootErr) return ''; const good = readSave(SAVEKEY + '.lastgood');
  return `<div class="warn" id="ccrecover" role="alert"><b>Your saved game could not be loaded:</b> ${esc(rs.problem || CC.bootErr)}${rs.problem && CC.bootErr ? ' (' + esc(CC.bootErr) + ')' : ''}. Nothing has been deleted.
    <div class="ccmenu" style="margin-top:6px">${good && good.save ? ccBtn('restore', `Restore the last good save (${esc(good.save.char.name)})`, {}, 'sm') : ''}${rs.raw ? ccBtn('export', 'Export the save', {}, 'sm') + ccBtn('savedel', 'Delete the saved game…', {}, 'sm') : ''}</div>
    <p class="ccnote">Creating a new character keeps a copy of the damaged save.</p></div>`;
}
function ccHomeHtml() {
  const sv0 = CC.bootErr ? null : ccSaved();
  return `<div class="cchome"><div class="ccbrand"><h1>Shardfall</h1><div class="ccsub">A Second Age sandbox · Anniabreen</div></div>${ccRecoverHtml()}
    <div class="ccmenu">${sv0 ? ccBtn('cont', `Continue as ${esc(sv0.char.name)}${sv0.char.ghost ? ' (ghost)' : ''}`, {}, 'pri big') : ''}${ccBtn('new', 'New character', {}, (sv0 ? '' : 'pri ') + 'big')}</div>
    ${sv0 ? '<p class="ccnote">Your character saves in this browser. Starting a new one asks before it replaces the old one.</p>' : '<p class="ccnote">Your character saves in this browser.</p>'}</div>`;
}
function ccWizHtml() {
  const v = ccValidate();
  return `<div class="ccwiz"><header class="cctop"><b class="ccmark">Shardfall</b><nav class="ccsteps" aria-label="Creation steps">${CC_STEPS.map((n, i) => `<button type="button" class="${i === CCD.step ? 'on' : ''}${i < CCD.step ? ' done' : ''}" data-c="step" data-s="${i}" aria-current="${i === CCD.step ? 'step' : 'false'}"><i>${i + 1}</i><span>${n}</span></button>`).join('')}</nav></header>
    <div class="ccbody"><aside class="ccprev" aria-label="Preview"><div class="ccfig"><canvas id="ccdoll" width="150" height="300" role="img" aria-label="Portrait of your character"></canvas><div class="ccws"><canvas id="ccsprite" width="80" height="104" role="img" aria-label="Your character as seen in the world"></canvas><div class="ccrot">${ccBtn('face', '⟲', { d: 1 }, 'pm', ' aria-label="Turn left"')}${ccBtn('face', '⟳', { d: -1 }, 'pm', ' aria-label="Turn right"')}</div></div></div>
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
  let raw = null; try { raw = localStorage.getItem(SAVEKEY); } catch (e) { } if (!raw) return; const s = ccSaved(); const name = (s && s.char.name || 'character').replace(/[^\p{L}\p{N}_-]+/gu, '_');
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' })); a.download = `Shardfall_${name}_save.json`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); } catch (e) { console.error(e); }
}
/* commit: the one path from the creator into the game (also __CC.quick for tests). Validates, keeps a copy of a replaced save,
   then boots; boot validates again. A second press while it runs does nothing. */
function ccCommit() {
  if (CCD.creating || P) return false; CCD.tried = true; const v = ccValidate();
  if (!v.ok) { CCD.err = ''; if (CCD.step !== 3) ccGoStep(3); else ccRenderStep(); const e = $('#ccerrs'); if (e) e.focus(); return false; }
  let old = null; try { old = localStorage.getItem(SAVEKEY); } catch (e) { } if (old && ccSaved() && !CCD.replace) { CCD.err = 'Tick “Replace” to start a new character.'; ccRenderStep(); return false; }
  CCD.creating = true; ccRefreshNav();
  // v0.33.1: the save being replaced is copied aside first; if that copy cannot be written (storage full or blocked) nothing changes
  if (old && !backupRaw(readSave().problem ? '.damaged' : '.replaced', old)) { CCD.creating = false; CCD.err = 'Your current save could not be copied aside (browser storage is full or blocked), so nothing was changed. Export it first or free some space, then try again.'; ccRender(); return false; }
  let ok = false; try { ok = boot(null, ccPayload()); } catch (e) { console.error(e); ok = false; }
  if (!ok) { CCD.creating = false; if (!P) { CCD.err = 'The character could not be created. Nothing was changed.'; ccRender(); } return false; }
  cancelAnimationFrame(CC_RAF); CC_RAF = 0; return true;
}
function ccContinue() { const rs = readSave(); if (P) return; if (rs.save) bootSaved(rs); else ccRender(); }

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
  if (c === 'restore') { const g = readSave(SAVEKEY + '.lastgood'); if (g.save) { const cur = readSave(); backupRaw('.damaged', cur.raw); try { localStorage.setItem(SAVEKEY, g.raw); } catch (e) { } CC.bootErr = ''; } ccRender(); return; }
  if (c === 'savedel') { if (!confirm('Delete the saved game for good? Export it first if you might want it back.')) return; try { localStorage.removeItem(SAVEKEY); } catch (e) { } CC.bootErr = ''; ccRender(); return; }
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
