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

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
