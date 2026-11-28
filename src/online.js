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
    if (m.type === 'welcome' || m.type === 'snapshot') { L.character = m.p.character; L.tick = m.p.tick; L.presence = new Map((m.p.presence || []).map(x => [x.characterId, x])); L.status = 'connected'; L.tries = 0; L.note = m.p.notice || L.note; if (m.type === 'welcome') L.joinedAt = Date.now(); }
    else if (m.type === 'presence.join') L.presence.set(m.p.character.characterId, Object.assign({ connected: true }, m.p.character));
    else if (m.type === 'presence.leave') L.presence.delete(m.p.characterId);
    else if (m.type === 'pong') { if (typeof m.p.t === 'number') L.rtt = Math.round(performance.now() - m.p.t); L.tick = m.p.tick; }
    else if (m.type === 'kicked') { L.stop = true; L.status = 'ended'; L.note = ({ taken_over: 'This character was opened in another window or device.', another_character: 'Another of your characters joined this realm.', session_ended: 'You were signed out.', character_deleted: 'This character was deleted.', account_closed: 'This account was closed.', server_restart: 'The server is restarting. Try again in a moment.' })[m.p.reason] || 'Disconnected by the server.'; if (m.p.reason === 'server_restart') L.stop = false; }
    else if (m.type === 'error' && m.id === 'hello') { L.stop = true; L.status = 'ended'; L.note = m.p.message; }
    onLobbyPaint();
  };
  ws.onclose = ev => {
    if (ON.lobby !== L) return; L.ws = null;
    if (ev.code === ONP.CLOSE.UNAUTHORIZED || ev.code === 1006 && !L.character && L.tries > 2) { L.stop = true; L.status = 'ended'; L.note = L.note || 'Could not connect. Your session may have ended.'; }
    if ([ONP.CLOSE.FORBIDDEN, ONP.CLOSE.TAKEN_OVER, ONP.CLOSE.SESSION_ENDED, ONP.CLOSE.PROTOCOL].includes(ev.code)) L.stop = true;
    if (L.stop) { L.status = 'ended'; onLobbyPaint(); return; }
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
        : `<div class="ccrow">${ccBtn('on-play', 'Enter lobby', { id: c.id }, 'pri')}${ccBtn('on-del', 'Delete…', { id: c.id }, 'sm')}</div>`}</div></article>`; }).join('');
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
const ONLINE = { open: onOpen, html: onHtml, click: onClick, submit: onSubmit, bootFromUrl: onBootFromUrl, create: onCreateFromWizard, leaveWizard: onLeaveWizard, paintLobby: onLobbyPaint, drawPortraits: onDrawPortraits,
  realm: id => { ON.realm = id; onLoadRoster(); }, get state() { return ON; } };
window.__ONLINE = ONLINE;   // test hook (the browser flow suite); not a security boundary — the server checks everything
