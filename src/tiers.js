/* ================= SIMULATION TIERS (Living World phase 6, v0.34; master spec §25) =================
   Replaces the phase 3 stopgap (idle creatures beyond 80 m thought at a quarter rate) with the spec's three tiers. The pure
   rules are in src/world.js (SIM.tierOf, SIM.tierRadii, SIM.tierDue); this file decides each actor's tier every step, just
   before its controller runs (the dispatch in update(), src/game.js), and hands the controller the time it should simulate:
     · A (local, within the screen plus a margin, never less than 40 m): every step, as before.
     · B (regional, out to 120 m or A + 60 m): one step in four, staggered by id, with the skipped time handed over. Off screen,
       so the coarser movement is never seen.
     · C (distant): not stepped. A creature holds where it is (its spawner, camp and region bookkeeping carry on, and it is
       saved like any other). A townsperson's day goes on abstractly: when it comes back into range its needs catch up on the
       hours it missed and it stands where its schedule has taken it (lifeResume, the same rule as after a load), unless that
       spot is near the player, in which case it walks there.
   Always tier A, whatever the distance: the player, pets, summons and the hireling (they follow the player), quest creatures,
   developer travellers, and anyone busy: a creature that is fighting, chasing, fleeing, hurt, poisoned, on a camp sortie or
   following one; an NPC that is knocked down, fighting, hurt or poisoned. So a fight never runs at a reduced rate.
   Never below B: the guards (they must answer a fight in their town) and the travelling merchant (his journey is the content).
   An actor's id, state and position never change on a tier change except by that schedule rule, so nothing is duplicated:
   the tests move the player across the world and check the registry, the spawner counts and the actor list.
   Disable with ?tiers=off (every actor every step, for comparison). */
const TIER = { on: !/[?&#]tiers=off\b/.test(location.search + location.hash), radii: { a: SIM.TIER.A, b: SIM.TIER.B }, view: 0,
  counts: { A: 0, B: 0, C: 0, busy: 0 }, last: { A: 0, B: 0, C: 0, busy: 0 }, seen: -1, woke: 0, placed: 0, walked: 0 };
const TIER_FIXED = { player: 1, pet: 1, summon: 1, hireling: 1 };
/* radius A follows the camera: the farthest visible corner (with the same margins the renderer culls by) plus SIM.TIER.margin */
function tierMeasure() {
  if (typeof cv === 'undefined' || !cv.width) return;
  const vw = cv.width / DP, vh = cv.height / DP; TIER.view = SIM.viewRadius(vw / 2 + 100, vh / 2 + 120, HW, HH); TIER.radii = SIM.tierRadii(TIER.view);
}
function tierBusy(e) {
  if (e.kind === 'mon') return e.state !== 'idle' || !!e.target || !!e.sortie || !!(e.leader && e.leader.sortie) || e.hp < e.max || !!e.poison;
  if (e.kind === 'npc') return !!e.downed || !!e.foe || GT - (e.lastCombat ?? -99) < 6 || !!e.poison || (e.max > 0 && e.hp < e.max);
  return false;
}
/* the time the actor's controller should simulate this step: dt (A), the gathered time on its B turn, or 0 */
function tierStep(e, dt) {
  if (TIER.seen !== ECOS.stepN) { TIER.seen = ECOS.stepN; TIER.last = TIER.counts; TIER.counts = { A: 0, B: 0, C: 0, busy: 0 }; if (ECOS.stepN % 20 === 1 || !TIER.view) tierMeasure(); }
  if (!TIER.on || !P || e === P) return dt;
  let t;
  if (TIER_FIXED[e.archetype] || e.dev || e.quest) t = 'A';
  else if (tierBusy(e)) { t = 'A'; TIER.counts.busy++; }
  else {
    t = SIM.tierOf(Math.hypot(e.x - P.x, e.y - P.y), e.tier, TIER.radii);
    if (t === 'C' && (e.archetype === 'guard' || e.archetype === 'adventurer' || (typeof LIFE !== 'undefined' && LIFE.trader === e))) t = 'B';
  }
  const prev = e.tier; e.tier = t; TIER.counts[t]++;
  if (prev === 'C' && t !== 'C') tierWake(e);
  if (t === 'C') { if (prev !== 'C') e.tierAt = GT; e._acc = 0; return 0; }
  if (t === 'A') { const a = (e._acc || 0) + dt; e._acc = 0; return a; }
  e._acc = (e._acc || 0) + dt; if (!SIM.tierDue('B', ECOS.stepN, e.id)) return 0;
  const a = Math.min(e._acc, .5); e._acc = 0; return a;   // a long gap (just left A or C) is not replayed as one big step
}
/* back from tier C. Creatures simply carry on. A townsperson catches up on its day. */
function tierWake(e) {
  TIER.woke++; const L = e.life; if (!L || e.dev || L.prof === 'trader' || typeof lifeResume !== 'function') return;
  const away = Math.max(0, GT - (e.tierAt ?? GT)); if (away > 0 && WS) L.needs = SIM.needsTick(L.needs, away / WS.clock.secondsPerHour(), L.doing);
  const x = e.x, y = e.y; lifeResume(e);
  if (Math.hypot(e.x - P.x, e.y - P.y) <= TIER.radii.a + SIM.TIER.hyst) { e.x = x; e.y = y; e._px = x; e._py = y; L.goal = null; L.thinkAt = 0; e.nav = null; TIER.walked++; }   // never appear in view: walk there instead
  else if (e.x !== x || e.y !== y) TIER.placed++;
}
function tierInspect(e) { return e && e !== P ? { tier: e.tier || '—', tierWhy: TIER_FIXED[e.archetype] || e.dev || e.quest ? 'always local' : tierBusy(e) ? 'busy: local' : 'distance ' + (P ? Math.hypot(e.x - P.x, e.y - P.y).toFixed(0) : '?') + ' m' } : {}; }
