// The v1.0 playthrough: starter Quay → packet to Vespar → walk to Mynoc → mine, smelt, bank → fork → Skara ferry →
// orchard moongate → Moonglen → boat to Vespar → packet home, with timings on the measured legs.
const R = S.ANN.roads, A = road;
const FORGE = L(556.5, 291.9), MARKET = L(905.5, 597.5), FORK = L(481.5, 681.5);
const MYNOC_IN = [L(566, 300), L(560, 297), FORGE];
const VESPAR_IN = [L(867.5, 591), L(880, 590.8), L(893, 591), L(900, 595), MARKET];
out.start = { zone: S.zoneAt(Math.floor(P.x), Math.floor(P.y)), quaywarden: !!npcNamed('Quaywarden Brann'), beacon: S.Q.beacon };
// 1. Quay packet → Vespar Customs pier
tp(47.5, 289.5); talkTo('Captain Bram'); out.packetOut = { at: pos(), zone: S.zoneAt(Math.floor(P.x), Math.floor(P.y)) };
// 2. harbour → bank by route 1 (Customs Bridge) and route 2 (Workshop Island quay)
out.route1 = walk([L(1016, 597), L(990, 597), L(960, 597), L(949.5, 590), L(949, 586), L(940, 585.6), L(930, 585.5), L(915, 586), L(904, 582), L(903.5, 578.3), L(903.5, 576.2)]);
out.inVesparBank = S.zoneAt(Math.floor(P.x), Math.floor(P.y)) === 'vespar' && S.annUnwarp(P.x, P.y)[1] < 577;
out.route2 = walk([L(903.5, 580), L(920, 584), L(930.9, 579), L(931, 568), L(931, 558), L(940, 557.6), L(970, 557.6), L(1000.5, 557.6), L(1001, 568), L(1001, 580), L(1004, 596), L(1016, 597)]);
out.eastBank = walk([L(1001, 580), L(1001, 557), L(980, 546), L(930, 546), L(913, 545), L(913, 532), L(913, 512), L(913, 507), L(925, 507)]);
// 3. market → Mynoc forge by the cart road (reverse), then the measured forward leg
tp(MARKET[0], MARKET[1]);
const cartBack = A([[866, 590], [858, 578], [846, 556], [826, 526], [781, 491], [731, 441], [681, 386], [631, 336], [592, 322], [566, 303]]);
out.marketToForge = walk([L(900, 595), L(893, 591), L(880, 590.8), L(867.5, 591)].concat(cartBack, MYNOC_IN));
tp(FORGE[0], FORGE[1]); out.forgeToMarket = walk([L(560, 297), L(566, 300)].concat(A([[566, 303], [592, 322], [631, 336], [681, 386], [731, 441], [781, 491], [826, 526], [846, 556], [858, 578], [866, 590]]), VESPAR_IN));
// 4. the mining loop: forge → first ore face, mine, back to the forge, smelt, deposit at the Mynoc bank
tp(FORGE[0], FORGE[1]); const oreBefore = SF.count(P.pack, 'ore');
const adit = [[589, 284], [589, 262], [598, 255], [609, 242], [614, 226], [615, 218]].map(([x, y]) => L(x, y));
const toMouth = [L(567, 301), L(579, 291), L(589, 285.6)];
const w1 = walk(toMouth.concat(adit), { reach: .8 }); let face = null, fd = 1e9;
for (let y = S.ANN.mine.y0 - 1; y <= S.ANN.mine.y1 + 1; y++) for (let x = S.ANN.mine.x0 - 1; x <= S.ANN.mine.x1 + 1; x++) if (S.tAt(x, y) === S.T.RK) { const d = Math.hypot(x + .5 - P.x, y + .5 - P.y); if (d < fd) { fd = d; face = { x, y }; } }
const dx = face.x + .5 - P.x, dy = face.y + .5 - P.y, dl = Math.hypot(dx, dy);
const w2 = walk([[face.x + .5 - dx / dl * 1.3, face.y + .5 - dy / dl * 1.3]], { reach: .3 });
out.forgeToOre = { ok: w1.ok && w2.ok, t: +(w1.t + w2.t).toFixed(1), face: S.annUnwarp(face.x, face.y).map(v => Math.round(v)), tier: S.zoneAt(face.x, face.y), stuck: w1.stuck || w2.stuck };
const node = { kind: 'node', x: face.x, y: face.y, t: S.T.RK, skill: 'mining', name: 'rock face' }; P.sel = node;
for (let k = 0; k < 40 && SF.count(P.pack, 'ore') - oreBefore < 3; k++) { if (!P.task) S.startGather(node); step(2.2); }
out.mined = SF.count(P.pack, 'ore') - oreBefore;
out.oreToForge = walk(adit.slice().reverse().concat([L(589, 285.6), L(579, 291), L(567, 301), FORGE]));
const barsBefore = SF.count(P.pack, 'ironbar'); for (let k = 0; k < 6 && SF.count(P.pack, 'ironbar') === barsBefore; k++) { S.startCraft('ironbar', 1); step(4); }
out.smelted = SF.count(P.pack, 'ironbar') - barsBefore;
out.forgeToBank = walk([L(559, 288), L(558.5, 282), L(558.5, 279.2)]);
talkTo('Hobb'); out.bankPanel = S.PANEL_K; const bar = P.pack.items.find(i => i.id === 'ironbar'); if (bar) S.ACT.dep({ u: bar.uid }); out.deposited = SF.count(P.bank, 'ironbar'); S.ACT.close();
// 5. Mynoc → fork → Skara landing; the reverse legs are the measured fork → Mynoc and landing → fork
tp(FORGE[0], FORGE[1]); out.forgeToFork = walk([L(560, 297), L(556, 304)].concat(A([[554, 306], [536, 360], [512, 430], [488, 520], [474, 610], [480, 680]])));
out.forkToForge = walk(A([[480, 680], [474, 610], [488, 520], [512, 430], [536, 360], [554, 306]]).concat(MYNOC_IN));
tp(FORK[0], FORK[1]); out.forkToVespar = walk(A([[482, 682], [580, 652], [680, 602], [760, 560], [812, 548], [846, 556], [858, 578], [866, 590]]).concat(VESPAR_IN));
tp(FORK[0], FORK[1]); out.forkToLanding = walk(A([[480, 680], [420, 677], [360, 672], [292, 660], [232, 646], [194, 640]]).concat([L(190.5, 641)]));
tp(...L(190.5, 640.5)); out.landingToFork = walk(A([[194, 640], [232, 646], [292, 660], [360, 672], [420, 677], [480, 680]]));
// 6. ferry across and back, then the island to the orchard gate
tp(...L(188.6, 640.5)); talkTo('Wenna'); out.ferryOut = pos(); talkTo('Tam'); out.ferryBack = pos(); talkTo('Wenna'); out.ferryOut2 = pos();
out.pierToTree = walk([L(170, 640.5), L(150, 640.5), L(146, 643)]);
out.toOrchardGate = walk([L(140, 633), L(140, 620), L(132, 613), L(124, 608), L(122.5, 604.7)], { reach: .3 });
step(.3); out.pickerOpens = S.PANEL_K;
S.ACT.mgcancel(); out.cancelled = { panel: S.PANEL_K, at: pos() };
walk([L(122.5, 609.5)]); walk([L(122.5, 604.8)], { reach: .4 }); step(.3); out.reopens = S.PANEL_K;
const mi = S.ANN.gates.findIndex(g => g.id === 'moonglen'); S.ACT.mgto({ i: mi });
out.gateArrive = { at: pos(), zone: S.zoneAt(Math.floor(P.x), Math.floor(P.y)), distFromGate: +Math.hypot(P.x - nearGate('moonglen').x, P.y - nearGate('moonglen').y).toFixed(2) };
step(3); out.noReopen = S.PANEL_K !== 'mgpick';
// 7. Moonglen: gate → courtyard → harbour; the measured harbour → courtyard leg
out.gateToCourt = walk([L(1210, 612), L(1226, 641.5), L(1250, 655), L(1264.5, 658), L(1264.5, 640), L(1264.5, 628)]);
tp(...L(1263.5, 777.5)); out.harborToCourt = walk([L(1264.5, 772), L(1264.5, 741), L(1263.5, 701), L(1265.5, 661), L(1265.5, 628)]);
out.courtToObservatory = walk([L(1265.5, 600), L(1265.5, 571), L(1265.5, 541), L(1267, 471), L(1265, 447), L(1264.5, 442), L(1264.5, 438.8)]);
out.loopToHarbor = walk([L(1265.5, 452), L(1267, 457), L(1301, 471), L(1325, 521), L(1329, 601), L(1311, 661), L(1267, 703), L(1264.5, 741), L(1264.5, 772), L(1264, 777.6)]);
talkTo('Captain Hollis'); out.boatBack = { at: pos(), zone: S.zoneAt(Math.floor(P.x), Math.floor(P.y)) };
talkTo('Captain Ysolde'); out.packetHome = { at: posG(), zone: S.zoneAt(Math.floor(P.x), Math.floor(P.y)) };
talkTo('Captain Bram'); out.packetAgain = pos(); talkTo('Captain Rhea'); out.boatOut = pos();
// 8. the other moongates: Moonglen → Miner's Cross → Skara Bryn
walk([L(1264.5, 772), L(1264.5, 741), L(1263.5, 701), L(1265.5, 661), L(1250, 655), L(1226, 641.5), L(1210, 612), L(1205.5, 605.6), L(1205.5, 603.6)], { reach: .5 }); step(.3); out.mgPicker = S.PANEL_K;
S.ACT.mgto({ i: S.ANN.gates.findIndex(g => g.id === 'cross') }); out.atCross = { at: pos(), zone: S.zoneAt(Math.floor(P.x), Math.floor(P.y)) }; step(2); out.crossNoReopen = S.PANEL_K !== 'mgpick';
const sg = S.ANN.signs.find(s => s.lines[0].includes('Mynoc Mine')); out.crossSign = sg && sg.lines;
S.interact(); out.crossPicker = S.PANEL_K; S.ACT.mgto({ i: S.ANN.gates.findIndex(g => g.id === 'skara') }); out.atSkara = { at: pos(), zone: S.zoneAt(Math.floor(P.x), Math.floor(P.y)) };
out.log = S.LOG.slice(-6).map(l => l.t);
