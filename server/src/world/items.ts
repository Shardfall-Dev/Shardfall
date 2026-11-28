/* Server Items v1 — the items of the online world are the server's.
   Every character's backpack, worn equipment and bank live on the server (from game.items), and every change goes through the
   game's own validated item commands (src/equipment.js SF.EQ: equipItem, unequipItem, dropItem, pickupItem, splitStack,
   mergeStacks; src/rules.js SF.transfer with the carrying-capacity check). The client only names what it wants by the item's
   server id (a UUID) and the server answers with the new inventory.
   Remains are world bodies like creatures (they share the interest grid):
     · a creature's remains hold its species' loot, rolled by the server (game.js killMon / lootItem: each loot entry's range,
       gear made with a wear state, a purse of gold), for 4 minutes (bosses 10);
     · a character who dies away from protected ground leaves a body with its tradeable belongings (SF.deathTransaction: the
       garment and the journal stay), for 12 minutes; online only its owner may take from it (there is no criminal system
       online yet, so looting someone else's body is not possible rather than a crime);
     · dropped items make a pile at the character's feet (game.js dropPile: one pile per spot), for 10 minutes.
   Remains, piles and their contents are not saved: a server restart clears the ground (as creatures repopulate). Everything a
   character holds is saved at once after every change (server/src/characters/service.ts saveInventory). */
import crypto = require('node:crypto');

export const ITEMS = { reach: 2.2, openReach: 3, corpseLife: 240, bossCorpseLife: 600, pileLife: 600, pileJoin: 1, maxStack: 1_000_000_000 };

export interface Remains {
  kind: 'remains'; nid: number; realmId: string; s: { x: number; y: number; sect: number }; speed: number; changed: boolean; cell: number;
  cont: { cid: string; kind: string; items: any[]; ver: number }; name: string; mon: string | null; owner: string | null; ownerName: string | null;
  expires: number; pile: boolean; killer: string | null;
}

/* the public face of an item: its server id, definition, quantity and its other fields (condition, material, quality, magic …) */
const DENY = new Set(['uid', 'sid', 'id', 'qty']);
export function publicItem(it: any) { const props: Record<string, unknown> = {}; for (const k of Object.keys(it)) if (!DENY.has(k)) props[k] = it[k]; return { id: it.sid as string, itemDef: it.id as string, qty: it.qty as number, props }; }
export function inventoryOf(ch: any) {
  const equip: Record<string, any> = {}; for (const s of Object.keys(ch.equip || {})) equip[s] = ch.equip[s] ? publicItem(ch.equip[s]) : null;
  return { pack: ch.pack.items.map(publicItem), equip, bank: ch.bank.items.length };
}
/* worn pieces as the appearance code wants them (gateway wornOf, for other players' look) */
export function wornOf(ch: any) { const o: Record<string, any> = {}; for (const s of Object.keys(ch.equip || {})) { const it = ch.equip[s]; if (it) o[s] = Object.assign(publicItem(it).props, { id: it.id }); } return o; }

/* every item of a character, with where it is (for saving) */
export function rowsOf(ch: any) {
  const out: { id: string; container: 'pack' | 'bank' | 'equip'; slot: string | null; position: number; item_def: string; qty: number; props: Record<string, unknown> }[] = [];
  ch.pack.items.forEach((it: any, i: number) => out.push({ id: it.sid, container: 'pack', slot: null, position: i, item_def: it.id, qty: it.qty, props: publicItem(it).props }));
  ch.bank.items.forEach((it: any, i: number) => out.push({ id: it.sid, container: 'bank', slot: null, position: i, item_def: it.id, qty: it.qty, props: publicItem(it).props }));
  for (const s of Object.keys(ch.equip || {})) { const it = ch.equip[s]; if (it) out.push({ id: it.sid, container: 'equip', slot: s, position: 0, item_def: it.id, qty: it.qty, props: publicItem(it).props }); }
  return out;
}

/* identity: the rules number items by a session uid (SF.newItem); the server adds a persistent sid (UUID). A split or a new
   item (death garment, loot) has no sid yet, and a split copies its source's fields — so after every change each item gets a
   uid if it has none, and any item without a sid, or whose sid is already taken, gets a fresh one. */
export function stamp(SF: any, items: Iterable<any>, seen = new Set<string>()) {
  for (const it of items) {
    if (!Number.isSafeInteger(it.uid) || it.uid <= 0) it.uid = SF.newItem('gold', 1).uid;
    if (typeof it.sid !== 'string' || seen.has(it.sid)) it.sid = crypto.randomUUID();
    seen.add(it.sid);
  }
  return seen;
}
export function allItems(ch: any) { const a: any[] = [...ch.pack.items, ...ch.bank.items]; for (const s of Object.keys(ch.equip || {})) if (ch.equip[s]) a.push(ch.equip[s]); return a; }
export const findSid = (items: any[], sid: string) => items.find(it => it.sid === sid) || null;

/* a creature's loot (game.js killMon + lootItem): each entry of its loot table in its range, gear with a wear state, its purse */
export function rollLoot(SF: any, d: { loot?: Record<string, number[]>; purse?: number[]; boss?: boolean }, rng: () => number) {
  const items: any[] = [], rnd = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
  const lootItem = (id: string, q: number, pct: number) => {
    if (SF.EQ.isGear(id)) { const it = SF.EQ.make(id, { origin: 'loot' }); if (it.omax) it.cond = Math.max(1, Math.round(it.omax * pct / 100)); return it; }
    return SF.newItem(id, q, SF.WEARABLE(id) ? { cond: pct, maxc: 100 } : null);
  };
  for (const k of Object.keys(d.loot || {})) { if (!SF.ITEMS[k]) continue; const [a, b] = d.loot![k]; const q = rnd(a, b); if (q > 0) items.push(lootItem(k, q, 100)); }
  if (d.purse) { const q = rnd(d.purse[0], d.purse[1]); if (q > 0) items.push(SF.newItem('gold', q)); }
  return items;
}

/* wear (game.js wear): a wearable item loses condition; at 0 it is broken (a broken weapon fights as fists, broken armour protects nothing) */
export function wear(SF: any, it: any, amt: number): { worn: boolean; broke: boolean } {
  if (!it || !SF.WEARABLE(it.id) || !(amt > 0)) return { worn: false, broke: false };
  if (it.cond === undefined) { it.cond = 100; it.maxc = 100; }
  const before = it.cond; it.cond = Math.max(0, it.cond - amt);
  return { worn: it.cond !== before, broke: before > 0 && it.cond <= 0 };
}
