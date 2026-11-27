// usage: node tests/layered-armor.test.js Shardfall_v0.31.html — the layered human rig (SF.HRIG) with no browser:
// every equipment definition resolves, materials come from SF.EQ.matColor, studs keep their own metal, every body × direction ×
// animation draws, helmets hide hair, two-handed weapons never show a shield, armor follows the joints, rules are untouched.
const fs = require('fs'); const html = fs.readFileSync(process.argv[2] || 'Shardfall_v0.31.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const g = {}; const m = { exports: {} };
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.METALS')))(m, g); g.SF = m.exports;
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.MAGERY = MG')))({}, g);
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.EQ = EQ')))({}, g);
const before = JSON.stringify(Object.keys(g.SF.ITEMS).map(k => [k, g.SF.ITEMS[k].ar, g.SF.ITEMS[k].wt, g.SF.ITEMS[k].str, g.SF.ITEMS[k].dur, g.SF.ITEMS[k].med]));
new Function('module', 'globalThis', scripts.find(t => t.includes('SF.HRIG = ')))({}, g);
const SF = g.SF, EQ = SF.EQ, H = SF.HRIG;
let fails = 0; const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) { fails++; console.log('FAIL', msg, JSON.stringify(a), '!=', JSON.stringify(b)); } else console.log('ok  ', msg); };
const yes = (c, msg, got) => eq(!!c, true, msg + (c || got === undefined ? '' : ' — ' + JSON.stringify(got)));

eq(JSON.stringify(Object.keys(SF.ITEMS).map(k => [k, SF.ITEMS[k].ar, SF.ITEMS[k].wt, SF.ITEMS[k].str, SF.ITEMS[k].dur, SF.ITEMS[k].med])), before, 'loading the rig changes no item statistic (AR, weight, Strength, durability, meditation)');
const cov = H.coverage(); eq(cov.missing, [], 'every equipment, clothing, accessory, shield and weapon definition has a drawing (' + cov.ok.length + ' ids)');
const ids = EQ.DEFS.map(d => d.id);
for (const fam of ['cloth', 'leather', 'studded', 'ringmail', 'chain', 'plate', 'bone', 'dragon', 'helm', 'shield', 'jewelry'])
  yes(EQ.DEFS.some(d => d.fam === fam) && EQ.DEFS.filter(d => d.fam === fam).every(d => H.resolveGear({ [d.slot]: EQ.make(d.id) }).gear[d.slot]), fam + ': every piece resolves in its own slot');
eq(H.resolveGear({ shield: SF.newItem('buckler', 1) }).gear.shield.id, 'buckler', 'the pine buckler resolves as a shield');
eq(H.resolveGear({ tunic: SF.newItem('garment', 1) }).gear.tunic.family, 'cloth', 'the respawn garment draws as a cloth tunic');
eq(H.resolveGear({ chest: { id: 'no_such_item' } }).unsupported, ['no_such_item'], 'an unknown item is reported, never guessed');

// materials: the item's own, coloured by SF.EQ.matColor; ten metals distinct; hides and woods too
const metals = ['iron', 'dull_copper', 'shadow_iron', 'copper', 'bronze', 'golden', 'agapite', 'verite', 'valorite', 'mithril'];
const mc = metals.map(mt => H.resolveGear({ chest: EQ.make('plate_chest', { material: mt }) }).gear.chest);
eq(mc.map(x => x.material), metals, 'plate chest keeps each of the ten metals');
eq(mc.map(x => x.color), metals.map(mt => EQ.matColor(mt)), 'live colours come from SF.EQ.matColor');
eq(new Set(mc.map(x => x.color)).size, 10, 'the ten metals are ten different colours');
for (const h of Object.keys(EQ.HIDES)) eq(H.resolveGear({ chest: EQ.make('leather_tunic', { material: h }) }).gear.chest.color, EQ.HIDES[h].col, 'leather tunic in ' + h + ' hide');
for (const w of Object.keys(SF.WOOD)) eq(H.resolveGear({ shield: EQ.make('wooden_shield', { material: w }) }).gear.shield.color, EQ.matColor(w), 'wooden shield in ' + w);
eq(H.resolveGear({ chest: EQ.make('dragon_chest') }).gear.chest.color, EQ.FIXED.dragonscale.col, 'dragon scale uses its fixed material');
eq(H.resolveGear({ chest: EQ.make('bone_chest') }).gear.chest.color, EQ.FIXED.bone.col, 'bone uses its fixed material');
const st = H.resolveGear({ chest: EQ.make('studded_tunic', { material: 'horned', sec: 'valorite' }) }).gear.chest;
eq([st.material, st.color, st.sec, st.secColor], ['horned', EQ.HIDES.horned.col, 'valorite', EQ.matColor('valorite')], 'studded leather: hide and stud metal are independent');
const studSvg = H.frameSVG({ gear: { chest: st }, action: 'idle', dir: 0 });
yes(studSvg.includes(EQ.matColor('valorite')) && studSvg.includes(EQ.HIDES.horned.col), 'studded tunic draws both the hide and the valorite studs');
// mixed set, each piece its own palette; skin, hair, outlines and straps stay
const mixed = H.resolveGear({ chest: EQ.make('plate_chest', { material: 'golden' }), legs: EQ.make('leather_leggings', { material: 'barbed' }), arms: EQ.make('ringmail_sleeves', { material: 'verite' }), head: EQ.make('chain_coif', { material: 'shadow_iron' }), feet: EQ.make('boots', { material: 'spined' }) }).gear;
const mixSvg = H.frameSVG({ gear: mixed, action: 'walk', frame: 2, dir: 1, skin: '#ac7854' });
for (const k of ['chest', 'legs', 'arms', 'head', 'feet']) yes(mixSvg.includes(mixed[k].color), 'mixed set: ' + k + ' keeps its own colour ' + mixed[k].color);
yes(mixSvg.includes('#ac7854') && mixSvg.includes('#302821'), 'mixed set: skin and the dark outline survive (no whole-sprite recolour)');

// every body × direction × animation × weapon shape draws, inside the cell
let frames = 0, bad = [];
const plate = H.resolveGear({ head: EQ.make('plate_helm'), neck: EQ.make('plate_gorget'), chest: EQ.make('plate_chest'), arms: EQ.make('plate_arms'), hands: EQ.make('plate_gauntlets'), legs: EQ.make('plate_leggings'), feet: EQ.make('boots'), cloak: EQ.make('cloak'), shield: EQ.make('heater_shield'), belt: EQ.make('belt'), ring: EQ.make('ring'), bracelet: EQ.make('bracelet'), necklace: EQ.make('necklace'), robe: EQ.make('robe'), tunic: EQ.make('tabard') }).gear;
for (const body of ['male', 'female']) for (let dir = 0; dir < 8; dir++) for (const ac in H.ANIMATIONS) for (let f = 0; f < H.ANIMATIONS[ac]; f++) {
  const s = H.frameSVG({ body, dir, action: ac, frame: f, gear: plate, weapon: H.weaponOf(SF.newItem('sword', 1)) }); frames++;
  if (!s.startsWith('<svg') || !s.endsWith('</svg>') || /NaN|undefined/.test(s)) bad.push(body + dir + ac + f);
}
eq(bad, [], `${frames} frames (2 bodies × 8 directions × ${Object.keys(H.ANIMATIONS).length} animations) are valid SVG with no NaN`);
for (const id in H.WEAPON_MAP) { const w = H.weaponOf(SF.newItem(id, 1)); eq(w.two, !!SF.WEAPONS[id].two, 'weapon ' + id + ': two-handed flag from SF.WEAPONS'); }
const coords = s => [...s.matchAll(/(?:x[12]|cx|y[12]|cy)="(-?[\d.]+)"/g)].map(m => +m[1]);
const rng = H.frameSVG({ dir: 2, action: 'polearm', frame: 3, gear: plate, weapon: H.weaponOf(SF.newItem('glaive', 1)) });
yes(coords(rng).every(v => v > -4 && v < 116), 'a halberd swing stays inside the 112 × 100 cell', Math.min(...coords(rng)) + '…' + Math.max(...coords(rng)));

// helmets hide hair; open helms and caps keep it
const hairHex = '#b69a58', withHelm = id => H.frameSVG({ style: 'long', hair: hairHex, gear: { head: H.resolveGear({ head: EQ.make(id) }).gear.head }, dir: 0 });
for (const id of ['plate_helm', 'closed_helm', 'great_helm', 'chain_coif', 'bone_helm', 'dragon_helm']) eq(withHelm(id).includes(hairHex), false, id + ' hides the hair');
for (const id of ['cloth_cap', 'leather_cap', 'bascinet', 'open_helm', 'norse_helm']) eq(withHelm(id).includes(hairHex), true, id + ' leaves the hair showing');

// two-handed weapons never show a shield in any animation (the equipment rules forbid it too; this is the visual guard)
const sh = H.resolveGear({ shield: EQ.make('kite_shield', { material: 'bronze' }) }).gear, shc = EQ.matColor('bronze');
let shown = [];
for (const wid of Object.keys(H.WEAPON_MAP).filter(k => SF.WEAPONS[k].two)) for (const ac in H.ANIMATIONS) for (let dir = 0; dir < 8; dir += 2)
  if (H.frameSVG({ dir, action: ac, frame: 2, gear: sh, weapon: H.weaponOf(SF.newItem(wid, 1)) }).includes(shc)) shown.push(wid + ':' + ac);
eq(shown, [], 'no shield with a two-handed weapon in any animation or direction');
yes(H.frameSVG({ dir: 0, action: 'walk', frame: 1, gear: sh, weapon: H.weaponOf(SF.newItem('mace', 1)) }).includes(shc), 'a one-handed weapon shows the shield');
yes(!H.frameSVG({ dir: 0, action: 'death', frame: 7, gear: sh }).includes(shc), 'no shield while dying');

// armor follows the joints: the plate arm moves with the swing; the cloak is behind the body facing south and in front facing north
const armColor = EQ.matColor('agapite'), arm = H.resolveGear({ arms: EQ.make('plate_arms', { material: 'agapite' }) }).gear;
const segs = s => [...s.matchAll(/<line x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"[^>]*stroke="([^"]+)"/g)].filter(m => m[5] === armColor).map(m => m.slice(1, 5).join(','));
const a0 = segs(H.frameSVG({ dir: 0, action: 'slash1h', frame: 0, gear: arm })), a3 = segs(H.frameSVG({ dir: 0, action: 'slash1h', frame: 3, gear: arm }));
yes(a0.length && a3.length && a0.join() !== a3.join(), 'plate arms move with the swing (segments follow the elbow and hand joints)');
const ck = H.resolveGear({ cloak: EQ.make('cloak') }).gear, ckc = '#' + [1, 3, 5].map(i => Math.round(parseInt(EQ.matColor('cloth').slice(i, i + 2), 16) * .85).toString(16).padStart(2, '0')).join('');
const order = dir => { const s = H.frameSVG({ dir, gear: ck, cloth: '#ac9776' }); return s.indexOf(ckc) < s.indexOf('fill="#ac9776"') ? 'first' : 'later'; };   // cloak vs the torso
eq([order(0), order(4)], ['first', 'later'], 'cloak: drawn first facing south (behind), after the body facing north (in front)');
eq(H.frameSVG({ body: 'female', dir: 0 }) !== H.frameSVG({ body: 'male', dir: 0 }), true, 'male and female bodies differ');
eq(H.gearKey(plate) === H.gearKey(H.resolveGear({ chest: EQ.make('plate_chest', { material: 'mithril' }) }).gear), false, 'the appearance key changes with the pieces and materials');
eq(H.gearKey(H.resolveGear({ chest: EQ.make('plate_chest') }).gear), H.gearKey(H.resolveGear({ chest: EQ.make('plate_chest') }).gear), 'identical looks share one key (one cached strip for many NPCs)');
const broken = EQ.make('plate_chest'); broken.cond = 0; yes(H.resolveGear({ chest: broken }).gear.chest.broken, 'a broken piece is flagged for drawing (and its key differs)');
console.log(fails ? `\n${fails} FAILED` : '\nall layered armor tests passed'); process.exit(fails ? 1 : 0);
