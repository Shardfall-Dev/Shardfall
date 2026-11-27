// usage: node tests/painted.test.js Shardfall_v0.32.1.html — Painted Human Candidates v0.1 (SF.PAINTED), no browser
const fs = require('fs'); const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.32.1.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const g = {}; const m = { exports: {} };
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.METALS')))(m, g); g.SF = m.exports;
for (const mark of ['SF.MAGERY = MG', 'SF.EQ = EQ', 'SF.STATS = ST', 'SF.CREATION = CR', 'SF.GEAR = GEAR', 'root.HUMAN_RIG = RIG', 'root.PAINTED_ART = ', 'SF.PAINTED = PT']) new Function('module', 'globalThis', scripts.find(t => t.includes(mark)))({}, g);
const SF = g.SF, EQ = SF.EQ, GEAR = SF.GEAR, PT = SF.PAINTED, ART = g.PAINTED_ART, CR = SF.CREATION;
const qa = JSON.parse(fs.readFileSync(__dirname + '/../assets/humans/painted-candidates-v0.1/qa.json', 'utf8'));
const missing = JSON.parse(fs.readFileSync(__dirname + '/../assets/humans/painted-candidates-v0.1/missing.json', 'utf8'));
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', msg); };

// ---- the embedded data is the QA result, nothing more
eq(ART.archiveSha256, '17b1b497dd80dbb87f6c1ea0b5a679d13aa1f6dcd0984f9fccc54a1a0d95c7b1', 'embedded art comes from the handed-off archive');
eq([ART.cell, ART.anchor, ART.rows], [128, [64, 106], ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE']], 'atlas contract: 128 px cells, feet (64,106), Scout row order');
eq(ART.accepted, qa.accepted, 'embedded accepted map equals qa.json');
eq(ART.counts.accepted + ART.counts.rejected, 192, 'all 192 candidates were judged');
eq(ART.counts.accepted, Object.values(qa.frames).filter(f => f.status === 'accepted').length, 'accepted count matches the per-frame verdicts');
eq(Object.keys(ART.rejected).every(k => qa.frames[k].status === 'rejected' && qa.frames[k].reasons.length), true, 'every rejected frame carries at least one reason');
let dup = 0; for (const b in ART.accepted) for (const a in ART.accepted[b]) for (const d in ART.accepted[b][a]) { const v = ART.accepted[b][a][d]; if (new Set(v).size !== v.length || v.some(i => i < 0 || i > 2)) dup++; }
eq(dup, 0, 'accepted lists hold distinct original pose indices only (no duplicated frames)');
eq(PT.accepted('male', 'Idle', 4), [], 'a direction whose candidates were rejected has no frames');
eq(['NE'].every(d => ['male', 'female'].every(b => ['Idle', 'Walk', 'Cast', 'Unarmed_Attack'].every(a => !ART.accepted[b][a][d].length))), true, 'NE rows (wrong facing) are not embedded');

// ---- frame selection: no borrowing, mirroring or invented frames
eq(PT.frame('male', 'run', 0, 1), null, 'run has no painted art → existing renderer');
eq(PT.frame('male', 'slash1h', 3, 1), null, 'weapon attacks have no painted art');
eq(PT.frame('male', 'death', 3, 1), null, 'death has no painted art');
eq(PT.frame('male', 'walk', 0, 0), null, 'male walk facing S was rejected, so S is not filled from another direction');
const sw = [...Array(8)].map((_, f) => PT.frame('male', 'walk', f, 1).col);
eq(sw, [0, 0, 0, 1, 1, 1, 2, 2], 'walk SW: eight rig frames step through the three accepted poses in order');
const one = ART.accepted.male.Walk.W;
eq([...Array(8)].map((_, f) => PT.frame('male', 'walk', f, 2).col).every(c => one.includes(c)), true, 'walk W uses only its accepted poses (' + one.join(',') + ')');
eq(PT.frame('female', 'cast2h', 5, 6).action, 'Cast', 'casting gestures map to the unsplit Cast set');
eq(PT.frame('female', 'unarmed', 7, 7).action, 'Unarmed_Attack', 'unarmed swings map to Unarmed_Attack');
eq(PT.frame('female', 'walk', 0, 9), PT.frame('female', 'walk', 0, 1), 'direction indices wrap');

// ---- eligibility follows the real equipment and the flag
const mk = body => { const c = { id: 'p1', name: 'Tess', str: 100, dex: 60, int: 40, skills: SF.newSkills(), pack: SF.newContainer('pack'), bank: SF.newContainer('bank'), equip: {}, look: CR.defaultLook(body) }; for (const s of EQ.SLOT_IDS) c.equip[s] = null; return c; };
const bare = mk('female'), R0 = GEAR.ofChar(bare);
eq(R0.body, 'female', 'body type comes from the character-creation look');
eq(PT.eligible(R0, { mode: 'off' }).ok, false, 'flag off → never painted');
eq(PT.eligible(R0, { mode: 'strict' }).ok, true, 'strict: an actor wearing nothing is eligible');
eq(PT.eligible(R0, { mode: 'strict', ghost: true }).ok, false, 'ghosts keep the existing art');
const it = EQ.make('leather_tunic', { material: 'horned' }); SF.addItem(bare.pack, it); eq(EQ.equipItem(bare, { uid: it.uid }).ok, true, 'equip a tunic through the real command');
const R1 = GEAR.ofChar(bare), e1 = PT.eligible(R1, { mode: 'strict' });
eq([e1.ok, e1.reasons.some(r => /overlay missing for chest/.test(r))], [false, true], 'strict: a worn tunic has no painted overlay → existing renderer, with the reason');
eq(PT.eligible(R1, { mode: 'bodies' }).ok, true, 'bodies (QA) mode ignores gear on purpose');
const npc = GEAR.resolve(GEAR.PRESETS.guard(), GEAR.npcLook('guard-7', { cloth: 'navy' }));
eq(PT.eligible(npc, { mode: 'strict' }).ok, false, 'NPC presets go through the same rule (a guard in kit keeps the existing renderer)');

// ---- missing-art list is honest
eq(missing.complete, [], 'missing.json marks nothing complete');
eq(missing.directionGaps.length, qa.summary.directionsWithNoAcceptedFrame.length, 'every empty direction is listed as a gap');
eq(['hair', 'armour', 'weapon', 'shield'].every(w => missing.missingLayers.some(l => l.includes(w))), true, 'hair, armour, weapon and shield layers are listed as missing');

// ---- backlog.json (tools/painted_backlog.py): the painted-art backlog, measured against the game data
const bl = JSON.parse(fs.readFileSync(__dirname + '/../assets/humans/painted-candidates-v0.1/backlog.json', 'utf8'));
const item = id => bl.backlog.find(i => i.id === id);
const STAT = ['exists', 'partial', 'mirrored', 'missing'];
eq(bl.backlog.every(i => STAT.includes(i.status)), true, 'every backlog item has one of exists / partial / mirrored / missing');
eq(bl.backlog.filter(i => i.status === 'exists').map(i => i.id), [], 'no backlog item is marked as existing');
eq([bl.summary.itemsExist, bl.summary.itemsPartial, bl.summary.itemsMirrored, bl.summary.itemsMissing], STAT.map(s => bl.backlog.filter(i => i.status === s).length), 'summary counts match the items');
eq([bl.summary.accepted, bl.summary.rejected], [ART.counts.accepted, ART.counts.rejected], 'backlog uses the same verdicts as the embedded art');
eq(Object.keys(item('equipment').detail), EQ.DEFS.map(d => d.id).concat(['buckler']), 'equipment backlog lists exactly the 56 SF.EQ.DEFS ids plus the buckler');
eq([EQ.DEFS.length, SF.ITEMS.buckler.slot], [56, 'shield'], 'there are 56 equipment definitions and the buckler is a shield');
eq(Object.keys(item('weapons').detail).sort(), Object.keys(SF.ITEMS).filter(k => SF.ITEMS[k].slot === 'weapon').sort(), 'weapon backlog lists every weapon item (15)');
eq(Object.keys(item('hair').detail), CR.HAIR_STYLES.map(h => h.id).filter(h => h !== 'bald'), 'hair backlog lists the 8 creation hairstyles (bald needs no layer)');
eq(Object.keys(item('beards').detail), [...new Set(Object.values(g.HUMAN_RIG.BEARD))].filter(b => b !== 'none'), 'beard backlog lists the 4 rig beard shapes');
eq(Object.keys(item('weapon-attacks').detail).length, 13, 'all 13 weapon attack animations are listed');
eq(item('weapon-attacks').detail.unarmed.status, 'partial', 'unarmed is partial (candidate poses), the other 12 attacks are missing');
eq(Object.entries(item('weapon-attacks').detail).filter(([k]) => k !== 'unarmed').every(([, v]) => v.status === 'missing'), true, 'no weapon attack other than unarmed has art');
eq(bl.mirrorCheck.found, [], 'no v0.1 frame is a mirror or copy of another v0.1 frame');
eq(Object.values(item('true-sw').detail).map(d => [d.mirror, d.status]), Array(4).fill([false, 'partial']), 'v0.1 SW walk/cast are painted, not mirrored, but still partial (no full cycle)');
for (const [k, dirs] of Object.entries(item('walk-cast-other-directions').detail)) {
  const [body, act] = k.split(' '), A = act === 'walk' ? 'Walk' : 'Cast';
  eq(Object.entries(dirs).map(([d, v]) => v.acceptedCandidatePoses), Object.keys(dirs).map(d => ART.accepted[body][A][d].length), `${k}: other-direction counts equal the accepted frames`);
}
eq(bl.crossPack && [bl.crossPack.v2SWisMirrorOfSE.minIoU, bl.crossPack.v2SWisMirrorOfSE.maxDiff], [1, 0], 'the v2 SW rows are recorded as exact mirrors of SE (the mirror test catches a real mirror)');
eq(bl.crossPack.v01CopiedFromV2.bestIoU < 0.95, true, 'no v0.1 frame is copied or mirrored from v2 art');
eq(item('one-style').status, 'missing', 'one matching style is not achieved');
eq(['hair', 'skinMasks'].map(k => item('base-bodies').detail[k].status), ['missing', 'missing'], 'base bodies: hair and skin masks still missing');
eq(PT.TEMP_FALLBACKS.cast2h === 'Cast' && PT.TEMP_FALLBACKS.caststaff === 'Cast', true, 'cast2h / caststaff → one-handed Cast is a declared temporary fallback');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
