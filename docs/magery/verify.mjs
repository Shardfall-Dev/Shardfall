import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { impactPreview, previewableIds, resistChance, splitShare } from './magery-math.mjs';
const { spells } = JSON.parse(readFileSync(new URL('./spells.json', import.meta.url)));
assert.equal(spells.length, 64);
assert.equal(new Set(spells.map(s => s.id)).size, 64);
const base = {magery:100,focus:100,resistance:100,casterInt:100,targetInt:76,currentHP:91,recipients:1};
function result(id, changes = {}) {
  return impactPreview(spells.find(s => s.id === 'magery.' + id), {...base,...changes});
}
assert.equal(resistChance(6,100,100),.54);
assert.deepEqual(result('04').normal,[11,16]);
assert.deepEqual(result('29').normal,[41,50]);
assert.deepEqual(result('18').raw,[13,18]);
assert.deepEqual(result('18',{magery:40}).raw,[6,11]);
assert.deepEqual(result('42').normal,[5,42]);
assert.deepEqual(result('42').resisted,[2,21]);
assert.deepEqual(result('43'),result('42'));
assert.deepEqual(result('37').normal,[6,6]);
assert.deepEqual(result('37').resisted,[3,3]);
assert.equal(result('37',{targetInt:110}).recipient,'caster');
assert.equal(result('37',{targetInt:100}).mean,0);
assert.deepEqual(result('57').normal,[45,45]);
assert.equal(result('57',{currentHP:1}).mean,0);
assert.deepEqual([0,1,2].map(rank=>splitShare(41,3,rank)),[14,14,13]);
for(let pool=0;pool<=50;pool++)for(let n=1;n<=10;n++){
  assert.equal(Array.from({length:n},(_,rank)=>splitShare(pool,n,rank)).reduce((a,b)=>a+b,0),pool);
}
for(const id of previewableIds) {
  const spell=spells.find(s=>s.id===id);
  for(const resistance of [0,50,100]){
    const r=impactPreview(spell,{...base,resistance});
    assert.ok(r.mean >= Math.min(...r.resisted)-1e-8 && r.mean <= Math.max(...r.normal)+1e-8);
  }
}
console.log('Verified 64 spell identities, damage envelopes, healing, resistance, backfire, earthquake and area pool conservation.');
