/* ---------- online play (Server Foundation v1): accounts, the online roster and the alpha presence lobby ----------
   The title screen offers Play Offline (the single-player game, saved in this browser, exactly as before) and Play Online.
   Online talks to the Shardfall server on the same origin (server/; docs/server/). It never reads or writes the offline save
   (localStorage) and never uploads offline progress: online characters are created by the server from the creator's choices.
   Honesty rule: online play is an alpha foundation. The lobby shows who is connected; the world itself is not simulated on
   the server yet, and this screen says so. On a static host (GitHub Pages) there is no server: Play Online explains that. */
const ONP = typeof SF_PROTOCOL !== 'undefined' ? SF_PROTOCOL : null;
const ON = { view: 'loading', cfg: null, session: null, realm: 'anniabreen', realms: [], roster: null, account: null, busy: false, msg: '', err: '', confirmDel: null, del: '',
  lobby: null, returnTo: 'roster' };
const onEsc = s => esc(s == null ? '' : s);

/* ---- HTTP: same-origin cookie session; mutations carry the CSRF token and the client header ---- */
async function onApi(method, path, body, extra) {
  const h = { 'x-shardfall': '1', accept: 'application/json' };
  if (body !== undefined) h['content-type'] = 'application/json';
  if (ON.session && ON.session.csrfToken && method !== 'GET') h['x-csrf-token'] = ON.session.csrfToken;
  Object.assign(h, extra || {});
  let res; try { res = await fetch(path, { method, headers: h, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' }); }
  catch (e) { throw { status: 0, code: 'offline', message: 'Cannot reach the Shardfall server. Check your connection.' }; }
  let j = null; try { j = await res.json(); } catch (e) { j = null; }
  if (!res.ok) throw { status: res.status, code: j && j.error && j.error.code || 'http_' + res.status, message: j && j.error && j.error.message || 'The server answered ' + res.status + '.', details: j && j.error && j.error.details };
  if (j && j.csrfToken && ON.session) ON.session.csrfToken = j.csrfToken;
  return j;
}

const ON_AUTH_MSG = { cancelled: 'Sign-in was cancelled.', link_expired: 'That link has expired or was already used. Ask for a new one.', failed: 'Sign-in did not complete. Try again.',
  unavailable: 'The sign-in service is unreachable. Try again shortly.', account_unavailable: 'This account cannot sign in.', different_account: 'That sign-in belongs to a different account; nothing was linked.',
  open_in_same_browser: 'If you were confirming your email, it is confirmed — sign in below. Password reset links must be opened in the browser where you asked for them.', link_invalid: 'That link is not valid any more.' };

/* ---- entering online play ---- */
async function onOpen(view, note) {
  CCD.screen = 'online'; ON.view = 'loading'; ON.err = ''; ON.msg = note || ''; ccRender();
  try { ON.cfg = await onApi('GET', '/api/config'); }
  catch (e) { ON.view = 'unavailable'; ON.err = e.status === 404 || e.status === 0 || e.status === 405 ? '' : e.message; return ccRender(); }
  await onRefreshSession();
  if (view && (view !== 'roster' && view !== 'account' || ON.session)) ON.view = view;
  else ON.view = ON.session ? (ON.session.kind === 'recovery' ? 'reset' : 'roster') : 'signin';
  if (ON.view === 'roster') return onLoadRoster();
  if (ON.view === 'account') return onLoadAccount();
  ccRender(onFocusFor());
}
async function onRefreshSession() { try { const s = await onApi('GET', '/api/session'); ON.session = s.authenticated ? s : null; } catch (e) { ON.session = null; } }
const onFocusFor = () => ({ signin: '#on-email', register: '#on-email', forgot: '#on-email', reset: '#on-pw' })[ON.view] || null;
/* links back from email and provider sign-in land on /?online=… — open the matching screen, then clean the address bar */
function onBootFromUrl() {
  let q; try { q = new URLSearchParams(location.search); } catch (e) { return false; }
  const st = q.get('online'); if (!st) return false;
  const err = q.get('auth_error'), notice = q.get('auth_notice'), linked = q.get('linked');
  try { const u = new URL(location.href); ['online', 'auth_error', 'auth_notice', 'linked', 'reauth'].forEach(k => u.searchParams.delete(k)); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (e) { }
  const note = err ? '' : notice ? ON_AUTH_MSG[notice] || '' : st === 'verified' ? 'Your email address is confirmed. Welcome to Shardfall.' : linked ? 'Sign-in method linked.' : '';
  onOpen({ verified: 'roster', roster: 'roster', reset: 'reset', account: 'account', signin: 'signin' }[st] || 'signin', note).then(() => { if (err) { ON.err = ON_AUTH_MSG[err] || ON_AUTH_MSG.failed; ccRender(); } });
  return true;
}

async function onLoadRoster() {
  ON.view = 'roster'; ON.busy = true; ccRender();
  try { const r = await onApi('GET', '/api/realms'); ON.realms = r.realms; if (!ON.realms.some(x => x.id === ON.realm) && ON.realms[0]) ON.realm = ON.realms[0].id;
    ON.roster = await onApi('GET', `/api/realms/${encodeURIComponent(ON.realm)}/characters`); }
  catch (e) { if (e.status === 401) { ON.session = null; ON.view = 'signin'; ON.err = 'Your session ended. Please sign in again.'; } else ON.err = e.message; }
  ON.busy = false; ccRender(); onDrawPortraits();
}
async function onLoadAccount() {
  ON.view = 'account'; ON.busy = true; ccRender();
  try { ON.account = await onApi('GET', '/api/account'); } catch (e) { if (e.status === 401) { ON.session = null; ON.view = 'signin'; } ON.err = e.message; }
  ON.busy = false; ccRender();
}

/* ---- the creator, reused: same wizard, same validator; the server makes the character ---- */
function onNewCharacter() {
  CCD.online = true; CCD.screen = 'wiz'; CCD.step = 0; CCD.name = ''; CCD.look = CR.defaultLook('male'); CCD.town = 'quay'; CCD.err = ''; CCD.tried = false; CCD.replace = false; CCD.creating = false;
  ccSetTemplate('swordsman'); ccRender('#ccn'); snd('ui.page');
}
async function onCreateFromWizard(payload) {
  if (CCD.creating) return false; CCD.creating = true; CCD.err = ''; ccRefreshNav();
  const key = (crypto.randomUUID && crypto.randomUUID()) || null;
  try {
    const r = await onApi('POST', `/api/realms/${encodeURIComponent(ON.realm)}/characters`, payload, key ? { 'idempotency-key': key } : {});
    CCD.creating = false; CCD.online = false; CCD.screen = 'online';
    ON.msg = `${r.character.name} has been created on ${ON.roster && ON.roster.realm ? ON.roster.realm.name : 'the realm'}.` + (r.notes && r.notes.length ? ' ' + r.notes.join(' ') : '');
    await onLoadRoster(); return true;
  } catch (e) {
    CCD.creating = false;
    if (e.status === 401) { CCD.online = false; CCD.screen = 'online'; ON.session = null; ON.view = 'signin'; ON.err = 'Your session ended. Sign in again; your choices were not saved.'; ccRender(); return false; }
    CCD.err = e.message; if (e.code === 'name_taken') { CCD.step = 0; ccRender('#ccn'); const n = $('#ccn-err'); if (n) n.textContent = e.message; } else ccRenderStep(); return false;
  }
}
function onLeaveWizard() { CCD.online = false; CCD.screen = 'online'; onLoadRoster(); }

/* ---- the lobby: one authenticated WebSocket, the server's snapshot, who else is here ---- */
function onPlay(id) {
  const ch = ON.roster && ON.roster.characters.find(c => c.id === id); if (!ch || !ONP) return;
  onLobbyClose(true);
  ON.lobby = { id, ch, character: null, presence: new Map(), status: 'connecting', note: '', rtt: null, tick: null, seq: 0, tries: 0, ws: null, timer: 0, pingT: 0, stop: false, joinedAt: 0 };
  ON.view = 'lobby'; ON.msg = ''; ON.err = ''; ccRender(); onConnect();
}
function onConnect() {
  const L = ON.lobby; if (!L || L.stop) return;
  L.status = L.tries ? 'reconnecting' : 'connecting'; onLobbyPaint();
  let ws; try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch (e) { return onRetry(); }
  L.ws = ws; L.seq = 0;
  ws.onopen = () => { ws.send(JSON.stringify({ v: ONP.PROTOCOL_VERSION, type: 'hello', id: 'hello', p: { characterId: L.id } })); };
  ws.onmessage = ev => {
    if (ON.lobby !== L) return; const r = ONP.parseServer(ev.data); if (!r.ok) return; const m = r.msg;
    if (typeof m.seq === 'number') { if (L.seq && m.seq !== L.seq + 1 && L.character) ws.send(JSON.stringify({ v: ONP.PROTOCOL_VERSION, type: 'resync', p: {} })); L.seq = m.seq; }
    if (m.type === 'welcome' || m.type === 'snapshot') { L.character = m.p.character; L.tick = m.p.tick; L.presence = new Map((m.p.presence || []).map(x => [x.characterId, x])); L.status = 'connected'; L.tries = 0; L.note = m.p.notice || L.note; if (m.type === 'welcome') { L.joinedAt = Date.now(); if (ONW) owResume(m.p); else if (m.p.world && !owEnter(L, m.p)) { L.stop = true; L.status = 'ended'; try { ws.close(1000, 'world mismatch'); } catch (e) { } } } }
    else if (m.type === 'state' || m.type === 'actor.enter' || m.type === 'actor.leave' || m.type === 'combat' || m.type === 'gain' || m.type === 'inv' || m.type === 'remains' || m.type === 'counter') { if (ONW) owMessage(m); return; }
    else if (m.type === 'presence.join') L.presence.set(m.p.character.characterId, Object.assign({ connected: true }, m.p.character));
    else if (m.type === 'presence.leave') L.presence.delete(m.p.characterId);
    else if (m.type === 'pong') { if (typeof m.p.t === 'number') L.rtt = Math.round(performance.now() - m.p.t); L.tick = m.p.tick; }
    else if (m.type === 'kicked') { L.stop = true; L.status = 'ended'; L.note = ({ taken_over: 'This character was opened in another window or device.', another_character: 'Another of your characters joined this realm.', session_ended: 'You were signed out.', character_deleted: 'This character was deleted.', account_closed: 'This account was closed.', server_restart: 'The server is restarting. Try again in a moment.' })[m.p.reason] || 'Disconnected by the server.'; if (m.p.reason === 'server_restart') L.stop = false; }
    else if (m.type === 'error' && m.id === 'hello') { L.stop = true; L.status = 'ended'; L.note = m.p.message; }
    if (ONW) { if (L.status === 'ended') owEnded(L.note); else owBar(); return; }
    onLobbyPaint();
  };
  ws.onclose = ev => {
    if (ON.lobby !== L) return; L.ws = null;
    if (ev.code === ONP.CLOSE.UNAUTHORIZED || ev.code === 1006 && !L.character && L.tries > 2) { L.stop = true; L.status = 'ended'; L.note = L.note || 'Could not connect. Your session may have ended.'; }
    if ([ONP.CLOSE.FORBIDDEN, ONP.CLOSE.TAKEN_OVER, ONP.CLOSE.SESSION_ENDED, ONP.CLOSE.PROTOCOL].includes(ev.code)) L.stop = true;
    if (L.stop) { L.status = 'ended'; if (ONW) owEnded(L.note || 'Disconnected.'); else onLobbyPaint(); return; }
    if (ONW) { ONW.pending = []; ONW.batch = []; owBar(); }
    onRetry();
  };
  clearInterval(L.pingT); L.pingT = setInterval(() => { if (L.ws && L.ws.readyState === 1 && L.character) L.ws.send(JSON.stringify({ v: ONP.PROTOCOL_VERSION, type: 'ping', p: { t: performance.now() } })); }, 5000);
}
function onRetry() { const L = ON.lobby; if (!L || L.stop) return; L.tries++; L.status = 'reconnecting'; onLobbyPaint(); clearTimeout(L.timer); L.timer = setTimeout(onConnect, Math.min(15000, 500 * 2 ** Math.min(5, L.tries)) + Math.random() * 300); }
function onLobbyClose(quiet) { const L = ON.lobby; if (!L) return; L.stop = true; clearTimeout(L.timer); clearInterval(L.pingT); try { if (L.ws) L.ws.close(1000, 'leave'); } catch (e) { } ON.lobby = null; if (!quiet) onLoadRoster(); }

/* ---- markup ---- */
const onField = (id, label, type, extra) => `<div class="ccfield"><label class="cclab" for="${id}">${label}</label><input id="${id}" name="${id}" type="${type}" ${extra || ''}></div>`;
function onProvidersHtml() {
  const p = ON.cfg && ON.cfg.providers || {}; const b = [];
  if (p.google) b.push(`<a class="ccb onprov" href="/api/auth/oauth/google" data-c="on-prov">Continue with Google</a>`);
  if (p.apple) b.push(`<a class="ccb onprov onapple" href="/api/auth/oauth/apple" data-c="on-prov">Sign in with Apple</a>`);
  return b.length ? `<div class="onor"><span>or</span></div><div class="ccmenu">${b.join('')}</div>` : '';
}
const onBanner = () => `${ON.msg ? `<p class="onmsg" role="status">${onEsc(ON.msg)}</p>` : ''}${ON.err ? `<p class="onerr" role="alert">${onEsc(ON.err)}</p>` : ''}`;
const onAlpha = () => `<p class="onalpha"><b>Alpha.</b> ${onEsc((ON.cfg && ON.cfg.notice) || 'Online play is an early test.')}</p>`;
function onFrame(title, body, wide) {
  return `<div class="onwrap${wide ? ' wide' : ''}"><header class="ontop"><button type="button" class="ccb sm" data-c="on-home">← Title</button><b class="ccmark">Shardfall</b><span class="onmode">Online</span>
    ${ON.session && ON.view !== 'reset' ? `<span class="onsp"></span>${ON.view !== 'account' ? ccBtn('on-account', 'Account', {}, 'sm') : ccBtn('on-roster', 'Characters', {}, 'sm')}${ccBtn('on-logout', 'Sign out', {}, 'sm')}` : ''}</header>
    <main class="onpage" id="onpage"><h2>${title}</h2>${onBanner()}${body}</main></div>`;
}
function onHtml() {
  const v = ON.view, busy = ON.busy ? ' disabled' : '';
  if (v === 'loading') return onFrame('Connecting…', '<p class="ccnote">Reaching the Shardfall server.</p>');
  if (v === 'unavailable') return onFrame('Online play is not available here', `<p>${ON.err ? onEsc(ON.err) : 'This copy of the game is not connected to a Shardfall server (for example the GitHub Pages build). Online play needs the server.'}</p>
    <p class="ccnote">Offline play works exactly as before and your saved character is untouched.</p><div class="ccmenu">${ccBtn('on-home', 'Back to the title', {}, 'pri big')}</div>`);
  if (v === 'signin') return onFrame('Sign in', `${onAlpha()}<form class="onform" data-f="signin" novalidate>${onField('on-email', 'Email', 'email', 'autocomplete="username" inputmode="email" required maxlength="254"')}
    ${onField('on-pw', 'Password', 'password', 'autocomplete="current-password" required maxlength="72"')}<div class="ccmenu"><button class="ccb pri big" type="submit"${busy}>Sign in</button></div></form>
    ${onProvidersHtml()}<div class="onlinks">${ccBtn('on-view', 'Create an account', { v: 'register' }, 'sm')}${ccBtn('on-view', 'Forgot your password?', { v: 'forgot' }, 'sm')}</div>
    <p class="ccnote">Your offline character stays in this browser and is never uploaded. Online characters are made new, on the server.</p>`);
  if (v === 'register') return onFrame('Create an account', `${onAlpha()}<form class="onform" data-f="register" novalidate>${onField('on-name', 'Display name <span class="ccnote">(optional)</span>', 'text', 'autocomplete="nickname" maxlength="32"')}
    ${onField('on-email', 'Email', 'email', 'autocomplete="email" inputmode="email" required maxlength="254"')}${onField('on-pw', 'Password <span class="ccnote">(at least 10 characters)</span>', 'password', 'autocomplete="new-password" required minlength="10" maxlength="72"')}
    ${onField('on-pw2', 'Repeat the password', 'password', 'autocomplete="new-password" required minlength="10" maxlength="72"')}<div class="ccmenu"><button class="ccb pri big" type="submit"${busy}>Create account</button></div></form>
    ${onProvidersHtml()}<div class="onlinks">${ccBtn('on-view', 'I already have an account', { v: 'signin' }, 'sm')}</div>`);
  if (v === 'sent') return onFrame('Check your email', `<p>We sent a link to confirm your address. Open it <b>in this browser</b> to finish; it signs you in.</p><p class="ccnote">No email after a few minutes? Check the spam folder, or try again.</p><div class="onlinks">${ccBtn('on-view', 'Back to sign in', { v: 'signin' }, 'sm')}</div>`);
  if (v === 'forgot') return onFrame('Reset your password', `<form class="onform" data-f="forgot" novalidate>${onField('on-email', 'Email', 'email', 'autocomplete="email" inputmode="email" required maxlength="254"')}<div class="ccmenu"><button class="ccb pri big" type="submit"${busy}>Send a reset link</button></div></form><div class="onlinks">${ccBtn('on-view', 'Back to sign in', { v: 'signin' }, 'sm')}</div>`);
  if (v === 'reset') return onFrame('Choose a new password', `<form class="onform" data-f="reset" novalidate>${onField('on-pw', 'New password <span class="ccnote">(at least 10 characters)</span>', 'password', 'autocomplete="new-password" required minlength="10" maxlength="72"')}${onField('on-pw2', 'Repeat it', 'password', 'autocomplete="new-password" required minlength="10" maxlength="72"')}<div class="ccmenu"><button class="ccb pri big" type="submit"${busy}>Save the new password</button></div></form>`);
  if (v === 'roster') return onFrame('Your characters', onRosterHtml(), true);
  if (v === 'account') return onFrame('Account', onAccountHtml(), true);
  if (v === 'lobby') return onFrame('Test lobby', '<div id="onlobby"></div>', true);
  return '';
}
function onRosterHtml() {
  const R = ON.roster; if (!R) return ON.busy ? '<p class="ccnote">Loading your characters…</p>' : '';
  const realmSel = `<div class="onrealm"><label class="cclab" for="on-realm">Realm</label><select id="on-realm" data-c="on-realm">${ON.realms.map(r => `<option value="${onEsc(r.id)}"${r.id === ON.realm ? ' selected' : ''}>${onEsc(r.name)}${r.status !== 'open' ? ' (' + onEsc(r.status) + ')' : ''} — ${r.slots.used}/${r.slots.max}</option>`).join('')}</select></div>`;
  const cards = R.characters.map(c => {
    const del = ON.confirmDel === c.id;
    return `<article class="oncard"><canvas class="onport" width="60" height="120" data-look="${onEsc(JSON.stringify(c.appearance))}" role="img" aria-label="Portrait of ${onEsc(c.name)}"></canvas>
      <div class="oninfo"><b>${onEsc(c.name)}</b><span class="ccnote">${onEsc(c.title)} · ${onEsc(c.startingTownName)}</span><span class="cctk">STR ${c.stats.str} · DEX ${c.stats.dex} · INT ${c.stats.int}</span>
      ${del ? `<form class="ondel" data-f="delete" data-id="${c.id}"><label class="cclab" for="on-delname">Type <b>${onEsc(c.name)}</b> to delete. It can be restored for ${ON_PURGE} days.</label><input id="on-delname" autocomplete="off" maxlength="40"><div class="ccrow"><button class="ccb sm" type="submit">Delete</button>${ccBtn('on-delno', 'Keep', {}, 'sm')}</div></form>`
        : `<div class="ccrow">${ccBtn('on-play', 'Play', { id: c.id }, 'pri')}${ccBtn('on-del', 'Delete…', { id: c.id }, 'sm')}</div>`}</div></article>`; }).join('');
  const free = R.slots.max - R.slots.used;
  const empty = free > 0 ? `<button type="button" class="oncard onnew" data-c="on-new"${R.realm.status !== 'open' ? ' disabled' : ''}><b>+ New character</b><span class="ccnote">${free} of ${R.slots.max} slots free</span></button>` : `<p class="ccnote">All ${R.slots.max} slots are in use.</p>`;
  const gone = R.deleted.length ? `<details class="ccguide"><summary>Recently deleted (${R.deleted.length})</summary>${R.deleted.map(c => `<div class="ccgi"><b>${onEsc(c.name)}</b> <span class="ccnote">restorable until ${onEsc(new Date(c.purgeAfter).toLocaleDateString())}</span> ${ccBtn('on-restore', 'Restore', { id: c.id }, 'sm')}</div>`).join('')}</details>` : '';
  return `${onAlpha()}${realmSel}<div class="oncards">${cards}${empty}</div>${gone}`;
}
const ON_PURGE = 7;
function onAccountHtml() {
  const A = ON.account; if (!A) return ON.busy ? '<p class="ccnote">Loading…</p>' : '';
  const prov = A.providers || {}; const linked = new Set(A.identities.map(i => i.provider));
  const reauth = A.recentAuth ? '<p class="ccnote">You signed in recently: sensitive changes are unlocked for a few minutes.</p>'
    : `<form class="onform onreauth" data-f="reauth">${linked.has('email') ? onField('on-repw', 'Confirm it is you: current password', 'password', 'autocomplete="current-password" maxlength="72"') + '<button class="ccb sm" type="submit">Confirm</button>' : ''}${[...linked].filter(p => p !== 'email' && prov[p]).map(p => ccBtn('on-reauthp', 'Confirm with ' + (p === 'google' ? 'Google' : 'Apple'), { p }, 'sm')).join('')}</form>`;
  const pv = ['google', 'apple'].filter(p => prov[p] || linked.has(p)).map(p => `<div class="ccgi"><b>${p === 'google' ? 'Google' : 'Apple'}</b> ${linked.has(p) ? `<span class="ccbadge">linked</span> ${A.canUnlink ? ccBtn('on-unlink', 'Unlink', { p }, 'sm', A.recentAuth ? '' : ' disabled') : ''}` : ccBtn('on-link', 'Link', { p }, 'sm', A.recentAuth ? '' : ' disabled')}</div>`).join('');
  return `<div class="ccsec"><div class="cchd"><span>Profile</span></div><form class="onform" data-f="profile">${onField('on-dname', 'Display name', 'text', `maxlength="32" value="${onEsc(A.displayName || '')}"`)}<button class="ccb sm" type="submit">Save</button></form>
      <div class="cckv"><span>Email</span><b>${onEsc(A.email || '—')} ${A.emailVerified ? '<span class="ccbadge">verified</span>' : '<span class="ccbadge">not verified</span>'}</b>${A.emailIsRelay ? '<span></span><b class="ccnote">An Apple private relay address: mail reaches you through Apple.</b>' : ''}<span>Character slots</span><b>${A.characterSlots} per realm</b></div></div>
    <div class="ccsec"><div class="cchd"><span>Security</span></div>${reauth}
      <div class="ccgi"><b>Email and password</b> ${linked.has('email') ? '<span class="ccbadge">linked</span>' : '<span class="ccnote">not set</span>'}</div>${pv}
      ${linked.has('email') ? `<form class="onform" data-f="password">${onField('on-npw', 'New password', 'password', 'autocomplete="new-password" minlength="10" maxlength="72"')}<button class="ccb sm" type="submit"${A.recentAuth ? '' : ' disabled'}>Change password</button></form>` : ''}
      <div class="ccrow">${ccBtn('on-logoutall', 'Sign out on every device', {}, 'sm')}<a class="ccb sm" href="/api/account/export" download>Download my data</a></div></div>
    <div class="ccsec ondanger"><div class="cchd"><span>Delete account</span></div><p class="ccnote">Deletes your online characters, their items and your sign-in for good. Offline saves in this browser are not affected.</p>
      ${A.canDelete ? `<form class="onform" data-f="delacct">${onField('on-delphrase', 'Type DELETE MY ACCOUNT', 'text', 'autocomplete="off" maxlength="40"')}<button class="ccb sm" type="submit"${A.recentAuth ? '' : ' disabled'}>Delete my account</button></form>` : '<p class="ccnote">Account deletion is not configured on this server yet.</p>'}</div>`;
}
function onLobbyPaint() {
  const el = $('#onlobby'); const L = ON.lobby; if (!el || !L) return;
  const me = L.character, others = [...L.presence.values()].sort((a, b) => a.name.localeCompare(b.name));
  const st = { connecting: 'Connecting…', reconnecting: 'Reconnecting…', connected: 'Connected', ended: 'Disconnected' }[L.status];
  el.innerHTML = `<p class="onalpha"><b>Alpha test lobby.</b> ${onEsc(L.note || 'You can see who else is online. The world is not simulated on the server yet: no movement, combat or trading here.')}</p>
    <div class="onstat"><span class="ondot ${L.status}"></span><b>${st}</b>${L.rtt != null ? `<span class="ccnote">${L.rtt} ms</span>` : ''}${L.tick != null ? `<span class="ccnote">tick ${L.tick}</span>` : ''}${ccBtn('on-leave', 'Leave lobby', {}, 'sm')}${L.status === 'ended' && !L.stop ? '' : L.status === 'ended' ? ccBtn('on-play', 'Reconnect', { id: L.id }, 'sm') : ''}</div>
    <div class="onlobby"><section><h3>You</h3>${me ? onPresenceCard({ name: me.name, appearance: me.appearance, town: me.startingTown, title: me.title }, true) + `<p class="ccnote">${me.items ? me.items.length : 0} items held by the server · ${onEsc(me.startingTownName || '')}</p>` : '<p class="ccnote">…</p>'}</section>
      <section><h3>Also here (${others.length})</h3><div class="onpeople" id="onpeople">${others.length ? others.map(p => onPresenceCard(p, false)).join('') : '<p class="ccnote">Nobody else is in the lobby right now.</p>'}</div></section></div>`;
  onDrawPortraits();
}
const onPresenceCard = (p, me) => `<div class="onperson${me ? ' me' : ''}" data-name="${onEsc(p.name)}"><canvas class="onport" width="48" height="96" data-look="${onEsc(JSON.stringify(p.appearance || {}))}" role="img" aria-label="${onEsc(p.name)}"></canvas><div><b>${onEsc(p.name)}</b><span class="ccnote">${onEsc(p.title || '')}${p.town && CR.TOWN[p.town] ? ' · ' + onEsc(CR.TOWN[p.town].n) : ''}</span>${p.connected === false ? '<span class="ccnote">reconnecting…</span>' : ''}</div></div>`;
function onDrawPortraits() { document.querySelectorAll('#ccin canvas.onport').forEach(cv => { try { const look = CR.normalizeLook(JSON.parse(cv.dataset.look || '{}')); drawDoll(cv, look); } catch (e) { } }); }

/* ---- events (delegated from the title screen's listeners in src/creation-ui.js) ---- */
async function onClick(c, d) {
  if (c === 'on-prov') return;   // a plain link to the provider start: the browser navigates
  if (c === 'on-home') { onLobbyClose(true); CCD.screen = 'home'; ccRender('[data-c=online]'); return; }
  if (c === 'on-view') { ON.view = d.v; ON.err = ''; ON.msg = ''; ccRender(onFocusFor()); return; }
  if (c === 'on-roster') { ON.err = ''; ON.msg = ''; return onLoadRoster(); }
  if (c === 'on-account') { ON.err = ''; ON.msg = ''; return onLoadAccount(); }
  if (c === 'on-new') return onNewCharacter();
  if (c === 'on-play') return onPlay(d.id);
  if (c === 'on-leave') return onLobbyClose(false);
  if (c === 'on-del') { ON.confirmDel = d.id; ccRender('#on-delname'); onDrawPortraits(); return; }
  if (c === 'on-delno') { ON.confirmDel = null; ccRender(); onDrawPortraits(); return; }
  return onAct(async () => {
    if (c === 'on-logout') { onLobbyClose(true); await onApi('POST', '/api/auth/logout', {}); ON.session = null; ON.view = 'signin'; ON.msg = 'Signed out.'; ON.roster = null; ON.account = null; return; }
    if (c === 'on-logoutall') { await onApi('POST', '/api/auth/logout-all', {}); ON.session = null; ON.view = 'signin'; ON.msg = 'Signed out on every device.'; return; }
    if (c === 'on-restore') { await onApi('POST', `/api/characters/${d.id}/restore`, {}); ON.msg = 'Character restored.'; return onLoadRoster(); }
    if (c === 'on-link' || c === 'on-reauthp') { const r = await onApi('POST', `/api/auth/oauth/${d.p}/${c === 'on-link' ? 'link' : 'reauth'}`, {}); location.assign(r.url); return; }
    if (c === 'on-unlink') { await onApi('POST', `/api/account/unlink/${d.p}`, {}); ON.msg = 'Sign-in method removed.'; return onLoadAccount(); }
  });
}
async function onAct(fn) {
  if (ON.busy) return; ON.busy = true; ON.err = ''; const keepMsg = ON.msg;
  try { await fn(); } catch (e) { ON.msg = ''; ON.err = e.message || 'Something went wrong.'; if (e.status === 401 && ON.view !== 'signin') { ON.session = null; ON.view = 'signin'; } }
  ON.busy = false; if (ON.msg === keepMsg && ON.err) ON.msg = ''; if (CCD.screen === 'online') { ccRender(); onDrawPortraits(); if (ON.view === 'lobby') onLobbyPaint(); }
}
async function onSubmit(form) {
  const f = form.dataset.f, v = id => { const el = form.querySelector('#' + id); return el ? el.value : ''; };
  await onAct(async () => {
    ON.msg = '';
    if (f === 'signin') { if (!v('on-email') || !v('on-pw')) throw { message: 'Enter your email and password.' }; const r = await onApi('POST', '/api/auth/login', { email: v('on-email'), password: v('on-pw') }); await onRefreshSession(); if (r.csrfToken && ON.session) ON.session.csrfToken = r.csrfToken; return onLoadRoster(); }
    if (f === 'register') {
      if (v('on-pw').length < 10) throw { message: 'The password needs at least 10 characters.' }; if (v('on-pw') !== v('on-pw2')) throw { message: 'The two passwords differ.' };
      const body = { email: v('on-email'), password: v('on-pw') }; if (v('on-name').trim()) body.displayName = v('on-name').trim();
      await onApi('POST', '/api/auth/register', body); ON.view = 'sent'; return;
    }
    if (f === 'forgot') { const r = await onApi('POST', '/api/auth/recover', { email: v('on-email') }); ON.msg = r.message; ON.view = 'signin'; return; }
    if (f === 'reset' || f === 'password') {
      const pw = v(f === 'reset' ? 'on-pw' : 'on-npw'); if (pw.length < 10) throw { message: 'The password needs at least 10 characters.' }; if (f === 'reset' && pw !== v('on-pw2')) throw { message: 'The two passwords differ.' };
      await onApi('POST', '/api/auth/password', { password: pw }); await onRefreshSession(); ON.msg = 'Your password has been changed.'; return f === 'reset' ? onLoadRoster() : onLoadAccount();
    }
    if (f === 'reauth') { await onApi('POST', '/api/auth/reauth', { password: v('on-repw') }); return onLoadAccount(); }
    if (f === 'profile') { const n = v('on-dname').trim(); await onApi('PATCH', '/api/account', { displayName: n || null }); ON.msg = 'Saved.'; return onLoadAccount(); }
    if (f === 'delete') { await onApi('POST', `/api/characters/${form.dataset.id}/delete`, { confirmName: v('on-delname') }); ON.confirmDel = null; ON.msg = 'Character deleted. You can restore it for ' + ON_PURGE + ' days.'; return onLoadRoster(); }
    if (f === 'delacct') { await onApi('DELETE', '/api/account', { confirm: v('on-delphrase') }); ON.session = null; ON.account = null; ON.roster = null; ON.view = 'signin'; ON.msg = 'Your account has been deleted.'; return; }
  });
}
/* the live world, for the online client's collision (shared/collision.js) and for tools/export-world.py, which exports it for
   the server. Doors are opened first: online (v1) every door stands open, on the server and in the client alike. */
function onWorldSource() {
  for (const d of DOORS) if (!d.open) setDoor(d, true);
  const rects = []; const seen = new Set(); for (const a of ECOL.values()) for (const r of a) if (!seen.has(r)) { seen.add(r); rects.push(r); }
  return { W, H, tiles: map, blk: BLK, soft: SOFT, rects, ecol: ECOL, shrines: SHRINES.map(s => ({ id: s.id, x: s.x, y: s.y })),
    gameStand: (x, y) => canStand({ kind: 'player' }, x, y),
    monStand: (x, y) => canStand({ kind: 'mon' }, x, y),
    population: onPopulationSource,
    economy: onEconomySource,
    townSpawns: () => Object.fromEntries(CR.TOWNS.map(t => [t.id, CR.townReady(t.id, { shrines: SHRINES, npcs: ANN.npcs, stand: (x, y) => canStand({ kind: 'player' }, x, y) })])) };
}
/* the counters for the server (Server Economy v1), exported by tools/export-world.py: every banker and shopkeeper the offline
   game places (game.js populate, anniabreen.js, frontier.js) at the post they keep (their home; the travelling merchant, who
   has none, is left out), what each kind of shop sells (game.js SHOPS after every addition) and the price list (SF.PRICES of
   the build, the very table the offline counters use). Keepers in the Sunken Bell levels are left out (not reachable online). */
function onEconomySource() {
  const posts = [], seen = new Set();
  for (const e of ents) {
    if (e.kind !== 'npc' || !(MERCHANT_ROLES[e.role] || SHOPS[e.role]) || e.role === 'trader' || e.adv || e.dev) continue;
    const h = e.home || e; const x = Math.round(h.x * 100) / 100, y = Math.round(h.y * 100) / 100;
    if (!(x >= 0 && y >= 0 && x < W && y < H)) continue;
    const key = e.role + '|' + e.name; if (seen.has(key)) continue; seen.add(key);
    posts.push({ key, role: e.role, kind: MERCHANT_ROLES[e.role] ? 'bank' : 'shop', name: e.name, x, y, town: e.town || null });
  }
  posts.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  const shops = {}; for (const r of Object.keys(SHOPS).sort()) shops[r] = SHOPS[r].filter(id => SF.ITEMS[id] && SF.PRICES[id] !== undefined);
  const prices = {}; for (const id of Object.keys(SF.PRICES).sort()) if (SF.ITEMS[id] && Number.isFinite(SF.PRICES[id])) prices[id] = SF.PRICES[id];
  return { posts, shops, prices, reach: 4 };
}
/* the creature population for the server (Server Creatures v1), exported by tools/export-world.py: the species' movement and
   temperament (MON + the ecosystem profiles, src/ecology.js), every spawner the offline game builds (Anniabreen, the stretch,
   frontier camps, the ecosystem's habitat regions) except those inside the Sunken Bell levels (not reachable online yet) and
   quest spawners, and a per-tile ground mask (one byte per tile): bit 1 protected ground (creatures never step on it, game.js canStand),
   bit 2 no spawning (ecology.js ecoSpot: blocking tiles, water, bridges, stairs, shallows, camp zones). */
function onPopulationSource() {
  ecoSpecies(); ecoSpawnKeys();
  const SPEC_MON = ['n', 'size', 'hp', 'speed', 'aggro', 'leash', 'reach', 'atk', 'def', 'dmg', 'tele', 'rec', 'armor', 'ar', 'str', 'dex', 'diff', 'ward', 'ranged', 'keep', 'aoe', 'loot', 'purse'], SPEC_ECO = ['f', 'hours', 'temper', 'hear', 'terr', 'pur', 'flight', 'social', 'grp', 'resp', 'cour', 'nv', 'night', 'flee'];
  const spawners = [], types = new Set();
  for (const s of SPAWNS) {
    if (s.quest || !MON[s.type] || levelAt(Math.floor(s.x), Math.floor(s.y))) continue;
    const o = { key: s.key, type: s.type, x: +s.x.toFixed(3), y: +s.y.toFixed(3), r: s.r, max: s.max };
    if (s.nightMax) o.nightMax = s.nightMax; if (s.pack > 1) o.pack = s.pack; if (s.region) o.region = s.region; if (s.camp) o.camp = s.camp.id; if (s.boss) o.boss = true; if (s.delay) o.delay = s.delay;
    spawners.push(o); types.add(s.type);
  }
  const species = {};
  for (const t of [...types].sort()) {
    const d = MON[t], pr = ecoP(t), o = {};
    for (const k of SPEC_MON) if (d[k] !== undefined) o[k] = d[k];
    for (const k of SPEC_ECO) if (pr[k] !== undefined) o[k] = pr[k];
    if (d.boss) o.boss = true; species[t] = o;
  }
  const noSpawn = new Set([T.WA, T.BR, T.SD, T.SU, T.SH]), mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, t = map[i]; let v = PROT[i] === 1 ? 1 : 0;
    if (BLK[t] || noSpawn.has(t) || zoneAt(x, y) === 'camp') v |= 2;
    mask[i] = v;
  }
  let b64 = ''; for (let i = 0; i < mask.length; i += 0x8000) b64 += String.fromCharCode.apply(null, mask.subarray(i, i + 0x8000));
  const sightBlock = []; for (let t = 0; t < LOSB.length; t++) if (LOSB[t]) sightBlock.push(t);   // tiles that block a creature's line of sight (game.js los)
  return { species, spawners, sightBlock, ground: { W, H, mask: btoa(b64) } };   // mask: one byte per tile, row by row
}
/* ---------- the online world (Server Movement v1) ----------
   "Play" connects, and on the server's welcome the game's own world and renderer start with the server's character. Walking
   is server-authoritative: each 50 ms step the stick or keys become an intent, the client predicts its result with the very
   rules the server uses (shared/movement.js on shared/collision.js) and sends the intents; the server's state messages carry
   the authoritative position and the last intent applied, and the client replays the intents not yet applied on top of it
   (reconciliation). Other players arrive with actor.enter, move with state, leave with actor.leave, and are drawn 120 ms in the
   past between two server positions (interpolation). Nothing else from the offline game runs: no creatures, NPCs, combat,
   gathering, crafting or trading, and no local save.
   Server Economy v1: the bankers and shopkeepers keep their posts (actor.enter kind 'npc'); tapping one beside you opens the
   game's own bank or shop panel with what the server sent (counter), and every button there becomes a counter command. */
const OW_INTERP_MS = 120, OW_MAX_PENDING = 40;
const OW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'Shift', 'Escape']);
const OW_ACTIONS = new Set(['sprint', 'map', 'mapfit', 'mapall', 'scrclose', 'rotok']);
const OW_KEYS_FIGHT = new Set([' ', 'Escape']);
const OW_KEYS_ITEMS = new Set(['c', 'C', 'b', 'B', 'i', 'I']);   // C the paper doll, B / I the backpack
/* online item UI (Server Items v1): panels and views that only draw are allowed; item changes are sent to the server */
const OW_UI = new Set(['bag', 'gear', 'eqwin', 'eqclose', 'eqsel', 'bagfilter', 'bagsort', 'baginspect', 'close', 'tab', 'gearart']);
const OW_ITEM_ACTS = new Set(['equip', 'uneq', 'drop', 'take', 'takeall', 'split', 'mergekind', 'bagmerge']);
const OW_COUNTER_ACTS = new Set(['depgold', 'dep', 'depeq', 'wd', 'buy', 'sell']);   // the game's bank and shop buttons (Server Economy v1)
const OW_COUNTER_REACH = 4;   // game.js atCounter; the server allows half a tile more for latency   // Space arms on a creature (or stands down); Escape clears the selection
function owEnter(L, w) {
  if (P) { L.note = 'An offline game is open in this tab. Reload the page to play online.'; return false; }
  genWorld(); buildTiles(); buildMini(); resize();
  const world = SF_COLLISION.makeWorld(onWorldSource());
  if (SF_COLLISION.hash(world) !== w.world.hash) { L.note = 'This copy of the game is out of date for the server (the world differs). Reload the page to update.'; return false; }
  const ch = w.character, you = w.you;
  P = newChar({ name: ch.name, str: ch.stats.str, dex: ch.stats.dex, int: ch.stats.int, skills: {}, look: ch.appearance });
  P.skills = JSON.parse(JSON.stringify(ch.skills)); P.statLocks = Object.assign({}, ch.statLocks); P.look = Object.assign({}, ch.appearance);
  P.equip = emptyEquip(); P.pack = SF.newContainer('pack', 'p1'); P.bank = SF.newContainer('bank', 'p1');
  for (const it of ch.items || []) { const o = Object.assign(SF.newItem(it.itemDef, it.qty), it.props || {}, { sid: it.id }); if (it.container === 'equip' && it.slot) P.equip[it.slot] = o; else if (it.container === 'bank') P.bank.items.push(o); else P.pack.items.push(o); }
  P.hp = ch.vitals.hp; P.mana = ch.vitals.mana; P.stam = you.stam; P.x = you.x; P.y = you.y; P.sect = you.sect || 0;
  P.charId = ch.id; P.online = true; P.created = { v: SF.CREATION.VERSION, template: ch.template, town: ch.startingTown }; P.bound = ch.boundShrine;
  P.cx = { survey: {}, pins: [], track: null, mark: false, doors: {} }; P.batch = null; while (P.hotbar.length < 9) P.hotbar.push(null);
  WS = SIM.create({ clock: () => GT, onError: e => console.error(e) }); simAdopt(P);
  if (w.clock && Number.isFinite(w.clock.hour)) { WS.clock.setDayMinutes(GT, w.clock.dayMinutes || SIM.CLOCK.dayMinutes); WS.clock.setHour(GT, w.clock.hour); }   // the server's time of day (Server Creatures v1)
  ecoSpecies();   // the wildlife species the server may send (deer, hare, bear) have their art data
  ents.unshift(P); P.sw = SF.newSwing(); P.movedAt = -99; P.drawn = false;
  P.hp = you.hp ?? P.hp; P.ghost = !!you.ghost; P.armed = false;
  ONW = { L, nid: you.nid, combat: !!(w.authoritative && w.authoritative.combat), items: !!(w.authoritative && w.authoritative.items), economy: !!(w.authoritative && w.authoritative.economy), counter: null, uidOf: new Map(), charId: ch.id, world, ctx: Object.assign(SF_MOVEMENT.ctxFor(SF, P), { ghost: !!you.ghost }), ps: { x: you.x, y: you.y, stam: you.stam, sect: you.sect || 0, t: you.t || 0, lastDrain: you.ld ?? -99 }, seq: 0, pending: [], batch: [], wasMoving: false,
    remotes: new Map(), corrections: 0, lastErr: 0, acked: you.ack, notice: w.notice, viewRadius: w.world.viewRadius };
  $('#cc').hidden = true; document.body.classList.add('online'); owBar(); STEPPER.reset();
  log(w.authoritative && w.authoritative.economy ? 'Welcome to Anniabreen, online. The server decides where everyone walks, what the wildlife does, every blow, every item and every coin. Trading between players and crafting are not online yet.' : w.authoritative && w.authoritative.items ? 'Welcome to Anniabreen, online. The server decides where everyone walks, what the wildlife does, every blow and every item. Banks, shops and trading are not online yet.' : w.authoritative && w.authoritative.combat ? 'Welcome to Anniabreen, online. The server decides where everyone walks, what the wildlife does and every blow. Items, loot and trading are not online yet.' : w.authoritative && w.authoritative.creatures ? 'Welcome to Anniabreen, online. The server decides where everyone walks and what the wildlife does. Combat, items and trading are not online yet: creatures may stalk you, but cannot attack.' : 'Welcome to Anniabreen, online. Walking is decided by the server; creatures, combat, items and trading are not online yet.', '#ffe08a');
  log(ONW.combat ? 'Left stick or WASD moves; Sprint runs. Tap a creature, then Attack (or Space). Leave from the online bar.' : 'Left stick or WASD moves; Sprint runs. Leave from the online bar.', '#b6a68a');
  if (ONW.combat) document.body.classList.add('online-fight');
  if (ONW.items) { for (const it of [...P.pack.items, ...P.bank.items, ...Object.values(P.equip)]) if (it && it.sid) ONW.uidOf.set(it.sid, it.uid); log('Your backpack and equipment are kept by the server: B opens the backpack, C the paper doll. Tap remains beside you to loot them.', '#b6a68a'); }
  if (ONW.economy) log('Bankers and shopkeepers keep their posts: tap one beside you to bank, buy or sell. The server keeps every coin.', '#b6a68a');
  if (P.ghost) log('You are a ghost. Walk to a shrine to be restored, or use Return to shrine.', '#ffe08a');
  refreshHud(); return true;
}
function owResume(w) {   // a reconnect: the server's position replaces the prediction; others are re-announced
  const W = ONW; for (const e of W.remotes.values()) rmEnt(e); W.remotes.clear(); W.creatures = 0; W.pending = []; W.batch = []; W.wasMoving = false;
  const y = w.you; W.ps = { x: y.x, y: y.y, stam: y.stam, sect: y.sect || 0, t: y.t || 0, lastDrain: y.ld ?? -99 }; P.x = y.x; P.y = y.y; P.stam = y.stam; W.acked = y.ack;
  owBar();
}
function owSend(type, p) { const L = ONW && ONW.L; if (L && L.ws && L.ws.readyState === 1) { L.ws.send(JSON.stringify({ v: ONP.PROTOCOL_VERSION, type, p })); return true; } return false; }
/* one 50 ms step of the online world (called by the game's fixed-step loop instead of the offline update) */
function onlineStep(dt) {
  GT += dt;
  for (let i = TIMERS.length - 1; i >= 0; i--) if (GT >= TIMERS[i].t) { const t = TIMERS.splice(i, 1)[0]; try { t.fn(); } catch (e) { console.error(e); } }
  for (let i = FX.length - 1; i >= 0; i--) if (GT - FX[i].t0 > FX[i].dur) FX.splice(i, 1);
  if (!P || !ONW) return; const W = ONW;
  const live = W.L && W.L.ws && W.L.ws.readyState === 1 && W.L.status === 'connected';
  const mi = moveIntent(); let moving = live && mi.want > 0 && (mi.vx || mi.vy) && W.pending.length < OW_MAX_PENDING;
  if (P.stam <= 0 && P.sprintOn) { P.sprintOn = false; log('Out of stamina. Sprint off.', '#ffb070'); }
  let r;
  if (moving || (live && W.wasMoving)) {
    const inp = moving ? { s: W.seq++, x: mi.vx, y: mi.vy, w: mi.want, r: !!mi.sprint } : { s: W.seq++, x: 0, y: 0, w: 0, r: false };
    W.pending.push(inp); W.batch.push(inp);
    r = SF_MOVEMENT.step(W.world, W.ps, { x: inp.x, y: inp.y, want: inp.w, sprint: inp.r }, W.ctx, SF_COLLISION);
  } else r = SF_MOVEMENT.step(W.world, W.ps, { x: 0, y: 0, want: 0 }, W.ctx, SF_COLLISION);
  W.wasMoving = !!moving;
  if (W.batch.length >= 2 || (W.batch.length && !moving)) { owSend('move', { inputs: W.batch }); W.batch = []; }
  P.x = W.ps.x; P.y = W.ps.y; P.sect = W.ps.sect; P.stam = W.ps.stam; P.speed = r.speed;
  if (r.moved > 0) { P.movedAt = GT; try { stepSound(r.moved); } catch (e) { } }
  const rt = performance.now() - OW_INTERP_MS; for (const e of W.remotes.values()) { owInterp(e, rt); if (e.recUntil && GT > e.recUntil) { e.state = 'idle'; e.recUntil = 0; e.impactT = null; } }
  if (P.armed || P.sw) try { SF.swingTick(P.sw, GT, P.stam, wDef()); } catch (e) { }
  if (W.counter && P.talkTo && (PANEL === 'bank' || PANEL === 'shop') && dist(P.talkTo, P) > OW_COUNTER_REACH + .5) { closePanel(); W.counter = null; P.talkTo = null; log('You walk away from the counter.'); }
  if (P.ghost && Math.floor(GT * 2) !== Math.floor((GT - dt) * 2)) { const n = owNearShrine(); if (n !== W.nearShrine) { W.nearShrine = n; owBar(); } }
}
function owInterp(e, rt) {
  const b = e.buf; while (b.length > 2 && b[1][0] <= rt) b.shift();
  let a = b[0], c = b[1] || b[0]; if (rt <= a[0] || a === c) c = a;
  const k = c === a ? 1 : Math.min(1, Math.max(0, (rt - a[0]) / (c[0] - a[0])));
  e.x = a[1] + (c[1] - a[1]) * k; e.y = a[2] + (c[2] - a[2]) * k; e.sect = c[3]; e.speed = rt - b[b.length - 1][0] > 150 ? 0 : c[4];
}
function owMessage(m) {
  const W = ONW, p = m.p, now = performance.now();
  if (m.type === 'state') {
    const y = p.you; W.acked = y.ack;
    W.pending = W.pending.filter(i => i.s > y.ack);
    const ps = { x: y.x, y: y.y, stam: y.stam, sect: y.sect, t: y.t, lastDrain: y.ld };
    for (const i of W.pending) SF_MOVEMENT.step(W.world, ps, { x: i.x, y: i.y, want: i.w, sprint: i.r }, W.ctx, SF_COLLISION);
    const err = Math.hypot(ps.x - W.ps.x, ps.y - W.ps.y); if (err > 1e-6) { W.corrections++; W.lastErr = err; }
    W.ps = ps; P.x = ps.x; P.y = ps.y; P.stam = ps.stam;
    if (y.hp !== undefined) owVitals(y);
    for (const mv of p.moves) { const e = W.remotes.get(mv[0]); if (e) e.buf.push([now, mv[1], mv[2], mv[3], mv[4]]); }
  } else if (m.type === 'actor.enter') {
    if (W.remotes.has(p.nid)) return;
    if (p.kind === 'remains') { owRemainsEnter(p, now); return; }
    if (p.kind === 'npc') {   // a banker or shopkeeper at their post (Server Economy v1), drawn like the offline townsfolk
      const e = { kind: 'npc', online: true, keeper: true, id: 3e6 + p.nid, nid: p.nid, role: p.role, name: p.name, counter: p.counter, town: p.town || null, x: p.x, y: p.y, sect: p.sect || 0, speed: 0, hp: 1, max: 1, buf: [[now, p.x, p.y, p.sect || 0, 0]] };
      W.remotes.set(p.nid, e); ents.push(e); return;
    }
    if (p.kind === 'creature') {   // a server creature, drawn by the game's own creature art (bestiary sheet, legacy sheet or procedural)
      if (!MON[p.type]) return;
      const e = { kind: 'mon', online: true, id: 1e6 + p.nid, nid: p.nid, type: p.type, name: p.name || MON[p.type].n, x: p.x, y: p.y, sect: p.sect, speed: p.speed, hp: p.hp, max: p.max, state: 'idle', buf: [[now, p.x, p.y, p.sect, p.speed]] };
      W.remotes.set(p.nid, e); ents.push(e); W.creatures = (W.creatures || 0) + 1; owBar(); return;
    }
    const e = { kind: 'remote', id: 'r' + p.nid, nid: p.nid, characterId: p.characterId, name: p.name, title: p.title, look: CR.normalizeLook(p.appearance || {}), equip: Object.assign(emptyEquip(), p.equip || {}),
      x: p.x, y: p.y, sect: p.sect, speed: p.speed, hp: 1, max: 1, buf: [[now, p.x, p.y, p.sect, p.speed]] };
    W.remotes.set(p.nid, e); ents.push(e); owBar();
  } else if (m.type === 'combat') owCombat(p);
  else if (m.type === 'inv') owInventory(p);
  else if (m.type === 'remains') owRemainsItems(p);
  else if (m.type === 'counter') owCounter(p);
  else if (m.type === 'gain') owGain(p);
  else if (m.type === 'actor.leave') { const e = W.remotes.get(p.nid); if (e) { W.remotes.delete(p.nid); if (e.kind === 'mon') W.creatures--; if (P.lootOpen === e) { closePanel(); P.lootOpen = null; } if (P.talkTo === e) { closePanel(); P.talkTo = null; W.counter = null; } if (P.sel === e) P.sel = null; rmEnt(e); owBar(); } }
}
/* ---------- online combat (Server Combat v1): the server swings and strikes; the client shows what it was told ---------- */
const owEnt = nid => nid === (ONW && ONW.nid) ? P : ONW && ONW.remotes.get(nid);
function owVitals(y) {
  const W = ONW, was = P.ghost; P.hp = y.hp; if (y.hpMax) P.max = y.hpMax; P.ghost = !!y.ghost; P.armed = !!y.armed;
  if (P.armed && (!P.sel || P.sel.nid !== y.armed)) { const e = W.remotes.get(y.armed); if (e) P.sel = e; }
  if (P.ghost !== was) { W.ctx = Object.assign(SF_MOVEMENT.ctxFor(SF, P), { ghost: P.ghost }); if (!P.ghost) { P.ghostAt = 0; log('You are restored to life at 25% health.', '#ffe08a'); try { snd('player.revive'); } catch (e) { } } else P.ghostAt = GT; owBar(); refreshHud(); }
}
function owCombat(p) {
  const W = ONW, a = owEnt(p.a), t = owEnt(p.t), me = t === P, mine = a === P;
  if (p.k === 'refused') { log(p.reason || 'Not now.', '#ffb070'); return; }
  if (p.k === 'tele' && a && a.kind === 'mon') { a.state = 'tele'; a.st = GT; a.atkSt = GT; a.atkRow = a.sect || 0; a.mode = 'melee'; a.recUntil = GT + (p.dur || .6) + 2; return; }
  if (p.k === 'hit' || p.k === 'miss' || p.k === 'parry' || p.k === 'whiff') {
    if (a && a.kind === 'mon') { a.state = 'rec'; a.st = GT; a.impactT = GT; a.recUntil = GT + ((MON[a.type] && MON[a.type].rec) || 1); }
    else if (mine) { try { playOnce((p.w || 'Unarmed') + '_Attack', 0); P.lunge = .001; P.drawn = true; P.lastCombat = GT; SF.swingSpend(P.sw, GT); snd('swing.' + String(p.w || 'Unarmed').toLowerCase(), { key: 'P' }); } catch (e) { } }
    else if (a) a.lunge = .001;
    if (p.k === 'whiff' || !t) return;
    if (t.kind === 'mon') { if (p.hp !== undefined) t.hp = p.hp; if (p.max) t.max = p.max; if (p.k === 'hit') { t.hitT = GT; floater(t.x, t.y, String(p.dmg), '#ffd27a'); } else floater(t.x, t.y, 'miss', '#c8c8c8'); if (mine) t.nameUntil = GT + 3; }
    else if (me) { P.lastCombat = GT; if (p.k === 'hit' && p.dmg > 0) { P.hp = p.hp; floater(P.x, P.y, '-' + p.dmg, '#ff6a5a'); try { hurtVoice(.8); } catch (e) { } } else floater(P.x, P.y, p.k === 'parry' ? 'parry' : 'dodge', p.k === 'parry' ? '#cfe8ff' : '#c8c8c8'); refreshHud(); }
    else if (p.k === 'hit') floater(t.x, t.y, '-' + p.dmg, '#ff9a8a');
    return;
  }
  if (p.k === 'death') {
    if (me) { P.hp = 0; P.ghost = true; P.armed = false; P.sel = null; P.ghostAt = GT; W.ctx = Object.assign(SF_MOVEMENT.ctxFor(SF, P), { ghost: true }); log(`You have died${p.by ? ' to a ' + p.by : ''}. Online your belongings stay with you. Walk to a shrine to be restored, or use Return to shrine.`, '#ff6a5a'); try { snd('player.death'); } catch (e) { } owBar(); refreshHud(); }
    else if (t && t.kind === 'mon') { t.hp = 0; if (p.by === W.nid) { log('You have slain the ' + (p.name || t.name) + '.', '#ffe08a'); if (P.sel === t) P.sel = null; P.armed = false; } }
    else if (t) log(`${p.name || t.name} has died${p.by ? ' to a ' + p.by : ''}.`, '#ffb070');
    return;
  }
  if (p.k === 'look' && t && t !== P && t.kind === 'remote') { t.equip = Object.assign(emptyEquip(), p.equip || {}); return; }
  if (p.k === 'broke' && me) { log((SF.ITEMS[p.itemDef] ? SF.ITEMS[p.itemDef].n : 'An item') + ' breaks!', '#ff6a5a'); return; }
  if (p.k === 'shot' && a) { if (mine) { try { playOnce('Bow_Attack', 0); P.drawn = true; P.lastCombat = GT; SF.swingSpend(P.sw, GT); snd('bow.release', { key: 'P' }); } catch (e) { } } if (t) EFX.push({ k: 'proj', x: a.x, y: a.y, tx: t.x, ty: t.y, t0: GT, t1: GT + (p.flight || 1), col: '#e8dcc0', at: GT + 99, fn: () => { } }); return; }
  if ((p.k === 'wide' || p.k === 'blocked') && t) { floater(t.x, t.y, p.k, '#c8c8c8'); return; }
  if (p.k === 'res' && t && t !== P) log(`${p.name || t.name} is restored to life.`, '#ffe08a');
}
function owGain(p) {
  const k = p.skill; if (P.skills[k] && Number.isFinite(p.value) && !p.stat) { const d = p.value - P.skills[k].v; P.skills[k].v = p.value; if (d > 0) { log(`${SF.SKILL[k].n} +${f1(d)} (${f1(p.value)})`, '#7fd4ff', 'skill'); if (GT - SND.gainAt > 1.5) { SND.gainAt = GT; try { snd('skill.gain'); } catch (e) { } } } }
  if (p.stat && Number.isFinite(p.statValue)) { P[p.stat] = p.statValue; log(`Your ${STAT_NAME[p.stat]} rises to ${p.statValue}.`, '#ffe08a', 'skill'); ONW.ctx = Object.assign(SF_MOVEMENT.ctxFor(SF, P), { ghost: P.ghost }); refreshHud(); }
}
/* ---------- online items (Server Items v1): the server holds the items; the client shows them and asks ---------- */
const owPlayersNear = () => { let n = 0; for (const e of ONW.remotes.values()) if (e.kind === 'remote') n++; return n; };
/* an item from the server's public form, keeping the same client uid for the same server id (the panels track items by uid) */
function owItem(o) {
  const W = ONW; const uid = W.uidOf.get(o.id); const it = Object.assign(SF.newItem(o.itemDef, o.qty), o.props || {}, { sid: o.id });
  if (uid) it.uid = uid; else W.uidOf.set(o.id, it.uid); return it;
}
function owInventory(inv) {
  const wasWeapon = P.equip.weapon && P.equip.weapon.sid;
  P.pack.items = (inv.pack || []).map(owItem); P.pack.ver = (P.pack.ver || 0) + 1;
  const eq = emptyEquip(); for (const s in inv.equip || {}) eq[s] = inv.equip[s] ? owItem(inv.equip[s]) : null; P.equip = eq;
  ONW.ctx = Object.assign(SF_MOVEMENT.ctxFor(SF, P), { ghost: P.ghost });
  if ((P.equip.weapon && P.equip.weapon.sid) !== wasWeapon) { try { SF.swingEquip(P.sw, GT, P.stam, wDef()); P.drawn = false; } catch (e) { } }
  try { renderEqWin(true); } catch (e) { } if (PANEL === 'bag' || PANEL === 'gear' || PANEL === 'loot') renderPanel(); refreshHud();
}
function owRemainsEnter(p, now) {
  const W = ONW, cont = SF.newContainer(p.pile ? 'pile' : 'corpse'); cont.items = (p.items || []).map(owItem);
  const e = { kind: 'corpse', online: true, nid: p.nid, id: 2e6 + p.nid, x: p.x, y: p.y, sect: p.sect || 0, name: p.ownerName ? p.ownerName + "'s body" : p.name, mon: p.mon || null, pile: !!p.pile,
    mine: !!(p.owner && p.owner === W.charId), owner: p.owner || null, cont, expires: GT + (p.left || 600), t0: GT - 1, skinned: true, speed: 0, buf: [[now, p.x, p.y, p.sect || 0, 0]] };
  W.remotes.set(p.nid, e); ents.unshift(e);
}
function owRemainsItems(p) { const e = ONW.remotes.get(p.nid); if (!e || e.kind !== 'corpse') return; e.cont.items = (p.items || []).map(owItem); e.cont.ver = (e.cont.ver || 0) + 1; if (P.lootOpen === e) renderPanel(); }
function owItemCmd(op, a) { if (!ONW || !ONW.items) return false; owSend('item', Object.assign({ op }, a)); return true; }
const owSidOf = u => { const it = [...P.pack.items, ...Object.values(P.equip), ...P.bank.items].find(i => i && i.uid === +u); return it && it.sid; };
/* the game's equip paths (button, double-click, drag, context menu) end here online */
function owEquip(u, slot) { if (P.ghost) { log('Ghosts cannot handle equipment.', '#ffb070'); return false; } const sid = owSidOf(u); if (!sid) return false; owItemCmd('equip', slot ? { item: sid, slot } : { item: sid }); try { snd('item.equip'); } catch (e) { } return true; }
function owUnequip(s) { if (P.ghost) return false; owItemCmd('unequip', { slot: s }); try { snd('item.equip'); } catch (e) { } return true; }
function owMerge(fromU, intoU) { const f = owSidOf(fromU), t = owSidOf(intoU); if (f && t) owItemCmd('merge', { item: f, into: t }); }
/* routed panel actions: the dataset of the clicked control names the item by its client uid */
function owItemAct(a, d) {
  if (a === 'equip') return owEquip(d.u, d.slot);
  if (a === 'uneq') return owUnequip(d.s);
  if (a === 'drop') { const sid = owSidOf(d.u); if (sid) { owItemCmd('drop', d.q ? { item: sid, qty: +d.q } : { item: sid }); try { snd('loot.rummage'); } catch (e) { } } return; }
  if (a === 'split') { const sid = owSidOf(d.u); if (sid && +d.q >= 1) owItemCmd('split', { item: sid, qty: Math.floor(+d.q) }); return; }
  if (a === 'mergekind' || a === 'bagmerge') return owItemCmd('mergeall', {});
  const c = P.lootOpen; if (!c || !c.online) return;
  if (a === 'takeall') { owItemCmd('takeall', { from: c.nid }); try { snd('loot.rummage'); } catch (e) { } return; }
  if (a === 'take') { const it = c.cont.items.find(i => i.uid === +d.u); if (!it) return; owItemCmd('take', d.half ? { from: c.nid, item: it.sid, qty: Math.ceil(it.qty / 2) } : { from: c.nid, item: it.sid }); try { snd(it.id === 'gold' ? 'loot.coin' : 'loot.rummage'); } catch (e) { } }
}
/* tapping remains beside you opens them (the server checks the distance and ownership again when you take) */
function owOpenRemains(e) {
  if (P.ghost) return log('Ghosts cannot handle items.', '#ffb070');
  if (dist(e, P) > 2.2) return log('Walk next to the remains to loot them.');
  if (e.owner && !e.mine) return log(`That is ${e.name}; only its owner can take from it.`, '#ffb070');
  P.lootOpen = e; openPanel('loot'); try { sndAt('loot.rummage', e); } catch (x) { }
}
/* ---------- online counters (Server Economy v1): the server keeps the bank and the shops; the panels are the game's own ---------- */
function owOpenCounter(e) {
  if (!ONW || !ONW.economy) return log('Banks and shops are not online on this server.', '#ffb070');
  if (P.ghost) return log('The keeper cannot see you.', '#ffb070');
  if (dist(e, P) > OW_COUNTER_REACH) return log(`Walk up to ${e.name.split(',')[0]} to ${e.counter === 'bank' ? 'bank' : 'trade'}.`);
  P.talkTo = e; PTAB = 'buy'; owSend('counter', { op: 'open', at: e.nid });
}
/* what the server shows at the counter: the bank's contents (into P.bank, which the game's bank panel draws), or a shop's prices */
function owCounter(p) {
  const W = ONW, e = W.remotes.get(p.nid); if (!e || e.kind !== 'npc') return;
  W.counter = { nid: p.nid, kind: p.kind, stock: p.stock || null, offers: p.offers || null, gold: p.gold };
  if (p.kind === 'bank') { P.bank.items = (p.bank || []).map(owItem); P.bank.ver = (P.bank.ver || 0) + 1; }
  P.talkTo = e; const want = p.kind === 'bank' ? 'bank' : 'shop';
  if (PANEL !== want) { openPanel(want); try { snd('ui.open'); } catch (x) { } } else renderPanel();
}
/* the bank and shop buttons: the dataset names an item by its client uid (or a slot, or what to buy); the server checks the rest */
function owCounterAct(a, d) {
  const W = ONW, c = W.counter, e = P.talkTo; if (!c || !e || e.nid !== c.nid) { log('You are no longer at the counter.', '#ffb070'); closePanel(); return; }
  const at = c.nid, send = p => owSend('counter', Object.assign({ at }, p));
  if (a === 'depgold') { send({ op: 'depositgold' }); try { snd('loot.coin'); } catch (x) { } return; }
  if (a === 'depeq') { send({ op: 'depositworn', slot: d.s }); return; }
  if (a === 'dep' || a === 'wd' || a === 'sell') {
    const sid = owSidOf(d.u); if (!sid) return;
    if (a === 'sell') { const it = P.pack.items.find(i => i.sid === sid); if (!it) return; send({ op: 'sell', item: sid, qty: d.all ? it.qty : 1 }); try { snd('loot.coin'); } catch (x) { } return; }
    send({ op: a === 'dep' ? 'deposit' : 'withdraw', item: sid }); return;
  }
  if (a === 'buy') { const n = Math.floor(+d.n || 1); send(n > 1 ? { op: 'buy', itemDef: d.id, qty: n } : { op: 'buy', itemDef: d.id }); try { snd('loot.coin'); } catch (x) { } }
}
/* Attack (or Space): arm on the selected creature, else the nearest one in sight; again to stand down. The server decides the rest. */
function owToggleArm() {
  if (!ONW || !ONW.combat) return; if (P.ghost) return log('You cannot fight now.', '#ffb070');
  if (P.armed) { P.armed = false; owSend('target', { nid: null }); log('Attack disarmed.'); refreshHud(); return; }
  let t = P.sel && P.sel.kind === 'mon' && P.sel.online && ONW.remotes.get(P.sel.nid) === P.sel ? P.sel : null;
  if (!t) { let bd = 15; for (const e of ONW.remotes.values()) { if (e.kind !== 'mon' || !(e.hp > 0)) continue; const d = dist(e, P); if (d < bd && los(P, e)) { bd = d; t = e; } } }
  if (!t) return log('No creature in sight to attack.', '#ffb070');
  P.sel = t; t.nameUntil = GT + 3; P.armed = true; owSend('target', { nid: t.nid }); log('Attack armed on ' + t.name + '.'); refreshHud();
}
/* a tap online: select a creature or person under the finger (the offline tap does much more; online only selection exists) */
const owNearShrine = () => SHRINES.some(z => Math.hypot(z.x + .5 - P.x, z.y + .5 - P.y) <= 2.5);   // the server's reach (world.ts COMBAT.shrineReach)
function owTap(sx, sy) { const w = screenToWorld(sx, sy), hits = hitEnts(w.wx, w.wy).filter(e => e.kind === 'mon' || e.kind === 'remote' || (e.kind === 'corpse' && e.online) || (e.kind === 'npc' && e.keeper)); if (!hits.length) return false; P.sel = hits[0]; if (hits[0].kind === 'corpse') { if (ONW.items) owOpenRemains(hits[0]); return true; } if (hits[0].kind === 'npc') { P.sel.nameUntil = GT + 3; owOpenCounter(hits[0]); return true; } P.sel.nameUntil = GT + 3; return true; }
function drawRemote(g, e, x, y) {
  const mv = e.speed > .3, k = mv ? 'Walk' : 'Idle', im = tinted(animSheet(k), e.look, k);
  if (!im) { drawScout(g, e, x, y, e.look); return true; }
  const f = mv ? Math.floor(GT * 12 * Math.min(1.4, Math.max(.7, e.speed / 5))) % 8 : 0;
  g.imageSmoothingEnabled = false; g.drawImage(im, f * 128, (e.sect || 0) * 128, 128, 128, Math.round(x - 64), Math.round(y - 106), 128, 128); return true;
}
/* the online bar: where you are, who is near, the connection, and the way out */
function owBar() {
  if (!ONW) return; let el = $('#owbar');
  if (!el) { el = document.createElement('div'); el.id = 'owbar'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  const L = ONW.L, st = L.status === 'connected' ? 'Online' : L.status === 'ended' ? 'Disconnected' : 'Reconnecting…';
  el.innerHTML = `<span class="ondot ${onEsc(L.status)}"></span><b>${st}</b><span class="owalpha">Alpha</span><span>${owPlayersNear()} nearby</span>${ONW.items ? '<button type="button" class="ccb sm" data-a="bag">Bag</button><button type="button" class="ccb sm" data-a="eqwin">Gear</button>' : ''}${L.rtt != null ? `<span>${L.rtt} ms</span>` : ''}${P && P.ghost ? `<span class="owghost">Ghost</span>${owNearShrine() ? '<button type="button" class="ccb sm pri" data-ow="res-shrine">Restore at shrine</button>' : ''}` : ''}<button type="button" class="ccb sm" data-ow="leave">Leave world</button>`;
}
function owEnded(note) {
  if (!ONW) return; owBar(); let el = $('#owend');
  if (!el) { el = document.createElement('div'); el.id = 'owend'; document.body.appendChild(el); }
  el.innerHTML = `<div class="owendbox"><h2>Disconnected</h2><p>${onEsc(note || 'The connection to the server ended.')}</p><button type="button" class="ccb pri big" data-ow="leave">Back to your characters</button></div>`;
}
function owLeave() { const L = ONW && ONW.L; if (L) { L.stop = true; try { if (L.ws) L.ws.close(1000, 'leave'); } catch (e) { } } location.assign('/?online=roster'); }
/* online, only walking is live: other keys and HUD actions are held back here, before the offline handlers see them */
addEventListener('keydown', e => { if (!ONW || e.target.matches('input,select,textarea')) return; if (ONW.items && OW_KEYS_ITEMS.has(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) { e.stopImmediatePropagation(); e.preventDefault(); if (e.key === 'c' || e.key === 'C') { try { toggleEqWin(); } catch (x) { } } else uiOpen('bag'); refreshHud(); return; }
  if (ONW.combat && OW_KEYS_FIGHT.has(e.key)) { e.stopImmediatePropagation(); e.preventDefault(); if (e.key === ' ' && !e.repeat) owToggleArm(); else if (e.key === 'Escape') { P.sel = null; } return; } if (!OW_KEYS.has(e.key)) { e.stopImmediatePropagation(); } }, true);
document.addEventListener('click', e => {
  if (!ONW) return; const ow = e.target.closest('[data-ow]'); if (ow) { e.preventDefault(); e.stopImmediatePropagation(); if (ow.dataset.ow === 'leave') owLeave(); else if (ow.dataset.ow === 'res-shrine') owSend('resurrect', { at: 'shrine' }); else if (ow.dataset.ow === 'res-bound') owSend('resurrect', { at: 'bound' }); return; }
  const fb = e.target.closest('[data-a]'); if (fb && fb.dataset.a === 'atk' && ONW.combat) { e.preventDefault(); e.stopImmediatePropagation(); owToggleArm(); return; }
  if (fb && ONW.items && OW_ITEM_ACTS.has(fb.dataset.a)) { e.preventDefault(); e.stopImmediatePropagation(); try { owItemAct(fb.dataset.a, fb.dataset); } catch (x) { console.error(x); } return; }
  if (fb && ONW.economy && OW_COUNTER_ACTS.has(fb.dataset.a)) { e.preventDefault(); e.stopImmediatePropagation(); try { owCounterAct(fb.dataset.a, fb.dataset); } catch (x) { console.error(x); } return; }
  if (fb && ONW.items && OW_UI.has(fb.dataset.a)) return;   // drawing only: the game's own handler runs
  if (fb && fb.dataset.a === 'desel' && ONW.combat) { e.preventDefault(); e.stopImmediatePropagation(); if (P.armed) owSend('target', { nid: null }); P.sel = null; P.armed = false; refreshHud(); return; }
  if (fb && fb.dataset.a === 'ghostret' && ONW.combat) { e.preventDefault(); e.stopImmediatePropagation(); owSend('resurrect', { at: 'bound' }); return; }   // the game's ghost panel: the server decides
  const b = e.target.closest('[data-a]'); if (b && !OW_ACTIONS.has(b.dataset.a)) { e.preventDefault(); e.stopImmediatePropagation(); if (GT - (ONW.heldMsg || -99) > 3) { ONW.heldMsg = GT; log(ONW.economy ? 'Not available online yet: walking, fighting, items, banks and shops are live on the server.' : ONW.combat ? 'Not available online yet: walking and fighting are live on the server.' : 'Not available online yet: only walking is live on the server.', '#ffb070'); } }
}, true);

const ONLINE = { worldSource: onWorldSource, tap: owTap, arm: owToggleArm, itemAct: owItemAct, openRemains: owOpenRemains, openCounter: owOpenCounter, counterAct: owCounterAct, open: onOpen, html: onHtml, click: onClick, submit: onSubmit, bootFromUrl: onBootFromUrl, create: onCreateFromWizard, leaveWizard: onLeaveWizard, paintLobby: onLobbyPaint, drawPortraits: onDrawPortraits,
  realm: id => { ON.realm = id; onLoadRoster(); }, get state() { return ON; }, get world() { return ONW; }, get player() { return ONW ? P : null; } };
window.__ONLINE = ONLINE;   // test hook (the browser flow suite); not a security boundary — the server checks everything
