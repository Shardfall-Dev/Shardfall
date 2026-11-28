/* shared/game-rules-adapter.js — the server uses the game's own creation rules; nothing from a browser save is trusted */
import test from 'node:test';
import assert from 'node:assert/strict';
import adapter = require('../../../shared/game-rules-adapter');

const R = adapter.load(); const CR = R.SF.CREATION;
const base = (o: object = {}) => Object.assign({ name: 'Tess', look: CR.defaultLook('male'), str: 45, dex: 25, int: 10, skills: [['swordsmanship', 50], ['tactics', 30], ['healing', 20]], town: 'quay' }, o);

test('every non-advanced template validates and builds a legal starting character', () => {
  for (const t of CR.TEMPLATES) {
    if (t.advanced) continue; const a = CR.template(t.id);
    const v = R.validateCreation(base({ str: a.stats[0], dex: a.stats[1], int: a.stats[2], skills: a.skills, town: t.town }));
    assert.equal(v.ok, true, t.id + ' ' + v.errors.join(';'));
    const c = R.buildCharacter(v.value);
    assert.equal(c.str + c.dex + c.int, 80);
    const total = Object.values(c.skills).reduce((s, k) => s + k.v, 0); assert.equal(total, 1000, 'skills are tenths: 100.0 total');
    assert.ok(Object.keys(c.skills).length >= 49);
    for (const it of c.items) assert.equal(R.checkStoredItem(it), null, t.id + ' ' + it.item_def);
    assert.equal(c.items.filter(i => i.item_def === 'gold').reduce((s, i) => s + i.qty, 0), 100, 'exactly the starter gold');
    assert.equal(c.kit.stage, 0, 'starter kit within the light load');
  }
});

test('the creation rules hold: 80 points 10–60, 100 skill points, max 50, five towns, appearance allowlist', () => {
  const bad = [ { str: 61, dex: 9, int: 10 }, { str: 50, dex: 25, int: 10 }, { str: 45.5, dex: 24.5, int: 10 }, { str: '45' },
    { skills: [['swordsmanship', 51], ['tactics', 49]] }, { skills: [['swordsmanship', 50], ['tactics', 49]] }, { skills: [['swordsmanship', 50], ['swordsmanship', 50]] },
    { skills: [['stealth', 50], ['tactics', 50]] }, { town: 'britain' }, { look: Object.assign(CR.defaultLook('female'), { facialHairStyle: 'long' }) },
    { look: Object.assign(CR.defaultLook('male'), { skinTone: '#ff00ff' }) }, { name: '<script>' }, { name: 'X' } ];
  for (const b of bad) assert.equal(R.validateCreation(base(b)).ok, false, JSON.stringify(b));
});

test('forged extras are never read: gold, items, skill values, stat totals beyond the payload', () => {
  const v = R.validateCreation(base({ gold: 1e9, items: [{ id: 'dragon_plate', qty: 9 }], skillValues: { magery: 1000 }, hp: 999, str: 45 }));
  assert.equal(v.ok, true); const c = R.buildCharacter(v.value);
  assert.equal(c.items.some(i => i.item_def === 'dragon_plate'), false); assert.equal(c.skills.magery.v, 0);
  assert.equal(c.items.find(i => i.item_def === 'gold')!.qty, 100);
});

test('names are unique by a canonical key', () => {
  assert.equal(R.nameKey('  Ser   TESS '), 'ser tess'); assert.equal(R.nameKey('Łucja'), R.nameKey('łucja'));
});

test('stored items are re-checked against the rules', () => {
  assert.equal(R.checkStoredItem({ item_def: 'gold', qty: 5, container: 'pack', slot: null }), null);
  assert.equal(R.checkStoredItem({ item_def: 'nope', qty: 1, container: 'pack', slot: null }), 'unknown item');
  assert.equal(R.checkStoredItem({ item_def: 'sword', qty: 2, container: 'pack', slot: null }), 'stacked non-stackable');
  assert.equal(R.checkStoredItem({ item_def: 'gold', qty: 0, container: 'pack', slot: null }), 'bad quantity');
  assert.equal(R.checkStoredItem({ item_def: 'sword', qty: 1, container: 'equip', slot: 'tail' }), 'bad slot');
});

test('Saltmarsh Quay spawns at the verified starter spawn; other towns keep their shrine', () => {
  const q = R.buildCharacter(R.validateCreation(base()).value); assert.deepEqual(q.position, { map: 'anniabreen', town: 'quay', x: 92.5, y: 304.5 });
  const m = R.buildCharacter(R.validateCreation(base({ town: 'mynoc' })).value); assert.equal(m.position.town, 'mynoc'); assert.equal(m.boundShrine, 'mynoc');
});
