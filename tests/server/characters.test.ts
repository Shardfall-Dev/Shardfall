/* The online roster: server-validated creation, server-generated starter state, ownership, quotas and names under concurrency. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto = require('node:crypto');
import { startServer, signUp, creation, Client, type TestServer } from './helpers';

let srv: TestServer;
before(async () => { srv = await startServer(); });
after(async () => { await srv?.close(); });
const R = '/api/realms/anniabreen/characters';
const uniq = (p: string) => p + crypto.randomBytes(3).toString('hex').replace(/\d/g, d => 'abcdefghij'[+d]);

test('realms and an empty roster with five slots', async () => {
  const { c } = await signUp(srv);
  const r = await c.get('/api/realms'); assert.equal(r.status, 200); assert.deepEqual(r.json.realms, [{ id: 'anniabreen', name: 'Anniabreen', status: 'open', slots: { used: 0, max: 5 } }]);
  const ro = await c.get(R); assert.equal(ro.json.characters.length, 0); assert.deepEqual(ro.json.slots, { used: 0, max: 5 });
  assert.equal((await c.get('/api/realms/nowhere/characters')).status, 404);
});

test('create: the server validates the choices and generates stats, skills, starter kit and item ids; reload returns the same', async () => {
  const { c } = await signUp(srv);
  const name = uniq('Tess');
  const r = await c.post(R, creation(name, { str: 20, dex: 10, int: 50, skills: [['magery', 50], ['evaluatingintelligence', 30], ['meditation', 20]], town: 'moonglen', look: { body: 'female', skinTone: 'tan', hairStyle: 'buns', hairColor: 'red', facialHairStyle: 'none', facialHairColor: 'red', clothingColor: 'plum', cloak: 'violet' } }));
  assert.equal(r.status, 201, r.text);
  const ch = r.json.character;
  assert.equal(ch.name, name); assert.deepEqual(ch.stats, { str: 20, dex: 10, int: 50 }); assert.equal(ch.skills.magery.v, 500); assert.equal(ch.skills.swordsmanship.v, 0);
  assert.equal(ch.startingTown, 'moonglen'); assert.equal(ch.template, 'mage'); assert.equal(ch.appearance.hairStyle, 'buns');
  const gold = ch.items.filter((i: any) => i.itemDef === 'gold'); assert.equal(gold.length, 1); assert.equal(gold[0].qty, 100);
  assert.ok(ch.items.some((i: any) => i.itemDef === 'spellbook')); assert.ok(ch.items.every((i: any) => /^[0-9a-f-]{36}$/.test(i.id)), 'server-owned item UUIDs');
  assert.ok(ch.items.some((i: any) => i.container === 'equip' && i.slot === 'shirt'));
  const again = await c.get('/api/characters/' + ch.id); assert.equal(again.status, 200); assert.deepEqual(again.json.character, ch, 'persisted exactly');
  const roster = await c.get(R); assert.equal(roster.json.characters.length, 1); assert.equal(roster.json.characters[0].items, undefined, 'roster is light');
});

test('forged values are refused: stats, skills, extra fields (gold, items) and non-integers', async () => {
  const { c } = await signUp(srv);
  const n = uniq('Forge');
  for (const [why, body] of [
    ['stats over 80', creation(n, { str: 60, dex: 60, int: 60 })], ['stat over 60', creation(n, { str: 70, dex: 5, int: 5 })],
    ['skills over 100', creation(n, { skills: [['swordsmanship', 50], ['tactics', 50], ['healing', 50]] })], ['skill over 50', creation(n, { skills: [['swordsmanship', 100]] })],
    ['uncreatable skill', creation(n, { skills: [['stealth', 50], ['tactics', 50]] })], ['unknown town', creation(n, { town: 'britain' })],
    ['gold field', Object.assign(creation(n), { gold: 1000000 })], ['items field', Object.assign(creation(n), { items: [{ id: 'dragon_plate' }] })],
    ['skill values', Object.assign(creation(n), { skillValues: { magery: 1000 } })], ['string stats', creation(n, { str: '45' })],
    ['fractional', creation(n, { str: 45.5, dex: 24.5 })], ['bad look', creation(n, { look: { body: 'dragon' } })], ['html name', creation('<b>x</b>')],
  ] as [string, any][]) {
    const r = await c.post(R, body); assert.equal(r.status, 400, why + ': ' + r.text);
  }
  assert.equal((await c.get(R)).json.characters.length, 0, 'nothing was created');
});

test('names are unique per realm, case- and space-insensitively, including under a race', async () => {
  const a = await signUp(srv), b = await signUp(srv);
  const name = uniq('Rowan');
  assert.equal((await a.c.post(R, creation(name))).status, 201);
  const dup = await b.c.post(R, creation('  ' + name.toUpperCase() + ' ')); assert.equal(dup.status, 409); assert.equal(dup.json.error.code, 'name_taken');
  const race = uniq('Ash'); const rs = await Promise.all([a.c.post(R, creation(race)), b.c.post(R, creation(race)), a.c.post(R, creation(race.toLowerCase()))]);
  assert.deepEqual(rs.map(r => r.status).sort(), [201, 409, 409]);
});

test('five slots, enforced atomically under parallel creation', async () => {
  const { c } = await signUp(srv);
  const rs = await Promise.all(Array.from({ length: 8 }, (_, i) => c.post(R, creation(uniq('Slot' + 'abcdefgh'[i])))));
  assert.equal(rs.filter(r => r.status === 201).length, 5); assert.equal(rs.filter(r => r.status === 409 && r.json.error.code === 'no_free_slot').length, 3);
  assert.deepEqual((await c.get(R)).json.slots, { used: 5, max: 5 });
});

test('idempotent creation: a retry with the same Idempotency-Key returns the same character', async () => {
  const { c } = await signUp(srv); const key = crypto.randomUUID(); const body = creation(uniq('Idem'));
  const [x, y] = await Promise.all([c.post(R, body, { headers: { 'idempotency-key': key } }), c.post(R, body, { headers: { 'idempotency-key': key } })]);
  assert.deepEqual([x.status, y.status].sort(), [200, 201]); assert.equal(x.json.character.id, y.json.character.id);
  assert.equal((await c.get(R)).json.characters.length, 1);
});

test('another account cannot read, delete or restore your character — not even by guessing its UUID', async () => {
  const a = await signUp(srv), b = await signUp(srv);
  const ch = (await a.c.post(R, creation(uniq('Mine')))).json.character;
  assert.equal((await b.c.get('/api/characters/' + ch.id)).status, 404);
  assert.equal((await b.c.post(`/api/characters/${ch.id}/delete`, { confirmName: ch.name })).status, 404);
  assert.equal((await b.c.post(`/api/characters/${ch.id}/restore`)).status, 404);
  assert.equal((await b.c.get(R)).json.characters.length, 0);
  assert.equal((await new Client(srv.base).get('/api/characters/' + ch.id)).status, 401);
  assert.equal((await a.c.get('/api/characters/not-a-uuid')).status, 400);
});

test('delete needs the name; the slot frees, the name stays reserved during recovery; restore and purge', async () => {
  const { c } = await signUp(srv); const name = uniq('Gone');
  const ch = (await c.post(R, creation(name))).json.character;
  assert.equal((await c.post(`/api/characters/${ch.id}/delete`, { confirmName: 'wrong' })).json.error.code, 'confirm_name');
  assert.equal((await c.post(`/api/characters/${ch.id}/delete`, { confirmName: name.toLowerCase() })).status, 200);
  const ro = (await c.get(R)).json; assert.equal(ro.characters.length, 0); assert.equal(ro.deleted.length, 1); assert.equal(ro.slots.used, 0);
  assert.equal((await c.get('/api/characters/' + ch.id)).status, 404);
  const other = await signUp(srv); assert.equal((await other.c.post(R, creation(name))).json.error.code, 'name_taken', 'reserved during recovery');
  assert.equal((await c.post(`/api/characters/${ch.id}/restore`)).status, 200);
  assert.equal((await c.get('/api/characters/' + ch.id)).status, 200);
  await c.post(`/api/characters/${ch.id}/delete`, { confirmName: name });
  await srv.db.query('update game.characters set purge_after = now() - interval \'1 second\' where id = $1', [ch.id]);
  assert.equal(await srv.app.chars.purge(), 1);
  assert.equal((await srv.db.query('select count(*)::int as n from game.items where character_id = $1', [ch.id])).rows[0].n, 0, 'items purged with it');
  assert.equal((await other.c.post(R, creation(name))).status, 201, 'name free after purge');
});

test('creation options come from the shared rules', async () => {
  const o = (await new Client(srv.base).get('/api/creation-options')).json;
  assert.equal(o.statPoints, 80); assert.equal(o.skillPoints, 100); assert.equal(o.skillMax, 50); assert.equal(o.towns.length, 5); assert.equal(o.creatable.includes('stealth'), false);
});
