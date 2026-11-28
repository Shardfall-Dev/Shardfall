/* Server Economy v1 — banks and shops online, on the server.
   The counters are the offline game's own bankers and shopkeepers, at the posts they keep (server/data/economy.json, exported
   from the build by tools/export-world.py): each is a body in the interest grid (actor.enter kind 'npc'), standing still. A
   character within reach (game.js atCounter: 4 tiles) asks the server to open one; every purchase, sale, deposit and
   withdrawal is then the game's own counter rule (game.js ACT.buy / sell / dep / depgold / depeq / wd) run on the server with
   the shared rules (src/rules.js SF.addItem, SF.removeQty, SF.transfer, SF.count; src/equipment.js SF.EQ.make, unequipItem,
   capFor) and the build's price list:
     · buy: only what this kind of shop sells (SHOPS), a whole quantity (SF.validQty), one at a time for anything that does not
       stack; the price is SF.PRICES × quantity, paid from the gold in the backpack; the goods must fit the carrying capacity;
     · sell: anything tradeable in the backpack except gold and starter gear, at 40 % of its price (a worn work tool by its uses
       left), at least 1 gold each; any shop buys;
     · bank: one account at every bank (game.js "one account at every bank"): deposit a backpack item, all gold or a worn piece;
       withdraw within the carrying capacity. The bank is kept and saved by the server (Server Items v1).
   Gold is an item like any other (id 'gold', a server id, saved rows): buying removes units, selling adds a new stack. Nothing
   here trusts the client for a price, a quantity it does not hold, a keeper it is not beside or an item it does not own.
   Pure: no I/O, no timers. */
import fs = require('node:fs');
import path = require('node:path');

export interface Post { key: string; role: string; kind: 'bank' | 'shop'; name: string; x: number; y: number; town: string | null }
export interface EconomyData { world: string; posts: Post[]; shops: Record<string, string[]>; prices: Record<string, number>; reach: number }
export interface Keeper { kind: 'npc'; nid: number; realmId: string; s: { x: number; y: number; sect: number }; speed: number; changed: boolean; cell: number; post: Post }

export const ECONOMY = { sellRate: .4, maxBuy: 100 };

export function loadEconomy(repoRoot: string, worldHash?: string): EconomyData {
  const m = JSON.parse(fs.readFileSync(path.join(repoRoot, 'server', 'data', 'economy.json'), 'utf8'));
  if (worldHash && m.world !== worldHash) throw new Error(`economy.json was exported for world ${m.world}, the terrain is ${worldHash} — run python3 tools/export-world.py`);
  if (!Array.isArray(m.posts) || !m.shops || !m.prices) throw new Error('server/data/economy.json is malformed — run python3 tools/export-world.py');
  return { world: m.world, posts: m.posts, shops: m.shops, prices: m.prices, reach: m.reach || 4 };
}

const cap1 = (r: any) => { const m = String(r && r.reason || 'not possible'); return m.charAt(0).toUpperCase() + m.slice(1) + (/[.!?]$/.test(m) ? '' : '.'); };
const isGearLike = (SF: any, id: string) => SF.EQ.isGear(id) || (SF.WEARABLE(id) && !SF.ITEMS[id].stack);

/* what a keeper offers: a shop's stock with prices (and whether it stacks), or nothing for a bank */
export function stockOf(SF: any, eco: EconomyData, post: Post) {
  if (post.kind !== 'shop') return [];
  return (eco.shops[post.role] || []).filter(id => SF.ITEMS[id] && eco.prices[id] !== undefined).map(id => ({ itemDef: id, price: eco.prices[id], stack: !!SF.ITEMS[id].stack }));
}
/* what a shop pays for one unit of an item, or null if it buys none (game.js ACT.sell) */
export function sellPrice(SF: any, eco: EconomyData, it: any): number | null {
  const d = SF.ITEMS[it.id]; if (!d || !d.trade || it.id === 'gold' || it.starter) return null;
  const tool = SF.WORK_TOOLS[it.id] && !d.stack ? SF.toolUses(it) / SF.TOOL_USES : 1;
  return Math.max(1, Math.floor((eco.prices[it.id] || 1) * ECONOMY.sellRate * tool));
}
/* the sale prices of everything in the backpack a shop would buy, by server id */
export function offersFor(SF: any, eco: EconomyData, ch: any): Record<string, number> {
  const o: Record<string, number> = {}; for (const it of ch.pack.items) { const p = sellPrice(SF, eco, it); if (p !== null && typeof it.sid === 'string') o[it.sid] = p; } return o;
}

export type Result = { ok: true; note?: string; gold?: number } | { ok: false; reason: string };

/* buy n of an item from this shop (game.js ACT.buy, with the counter checks of atCounter / COUNTER_ACT) */
export function buy(SF: any, eco: EconomyData, ch: any, post: Post, id: string, n: number): Result {
  if (post.kind !== 'shop') return { ok: false, reason: 'This keeper sells nothing.' };
  if (!(eco.shops[post.role] || []).includes(id) || !SF.ITEMS[id] || eco.prices[id] === undefined) return { ok: false, reason: 'That is not for sale here.' };
  if (!SF.validQty(n) || n > ECONOMY.maxBuy) return { ok: false, reason: 'That is not for sale here.' };
  const gear = isGearLike(SF, id); if ((gear || !SF.ITEMS[id].stack) && n !== 1) return { ok: false, reason: 'Buy that one at a time.' };
  const price = eco.prices[id] * n; if (SF.count(ch.pack, 'gold') < price) return { ok: false, reason: 'Not enough gold.' };
  const it = gear ? SF.EQ.make(id, { origin: 'npc' }) : SF.newItem(id, n, SF.ITEMS[id].stack ? null : { cond: 100 });
  const r = SF.addItem(ch.pack, it, SF.EQ.capFor(ch)); if (!r.ok) return { ok: false, reason: cap1(r) };
  if (!SF.removeQty(ch.pack, 'gold', price)) { SF.removeQty(ch.pack, id, n); return { ok: false, reason: 'Not enough gold.' }; }   // cannot happen after the count; never leaves goods unpaid
  return { ok: true, gold: -price };
}
/* sell qty of one backpack item to any shop (game.js ACT.sell) */
export function sell(SF: any, eco: EconomyData, ch: any, post: Post, it: any, qty?: number): Result {
  if (post.kind !== 'shop') return { ok: false, reason: 'This keeper buys nothing.' };
  if (!it || !ch.pack.items.includes(it)) return { ok: false, reason: 'That item is not in your backpack.' };
  if (it.starter) return { ok: false, reason: 'Merchants do not buy back starter gear.' };
  const each = sellPrice(SF, eco, it); if (each === null) return { ok: false, reason: 'Merchants will not buy that.' };
  const n = qty === undefined ? 1 : qty; if (!SF.validQty(n) || n > it.qty) return { ok: false, reason: 'You do not have that many.' };
  const g = each * n;
  it.qty -= n; if (it.qty <= 0) ch.pack.items.splice(ch.pack.items.indexOf(it), 1); ch.pack.ver++;
  SF.addItem(ch.pack, SF.newItem('gold', g));
  return { ok: true, gold: g };
}
/* the bank (game.js ACT.dep / depgold / depeq / wd) */
export function deposit(SF: any, ch: any, it: any): Result {
  if (!it || !ch.pack.items.includes(it)) return { ok: false, reason: 'That item is not in your backpack.' };
  const r = SF.transfer(ch.pack, ch.bank, it.uid, it.qty); return r.ok ? { ok: true } : { ok: false, reason: cap1(r) };
}
export function depositGold(SF: any, ch: any): Result {
  let g = 0, n = 0; for (const it of ch.pack.items.filter((i: any) => i.id === 'gold')) { const q = it.qty; if (SF.transfer(ch.pack, ch.bank, it.uid, it.qty).ok) { g += q; n++; } }
  return n ? { ok: true, gold: g } : { ok: false, reason: 'You carry no gold.' };
}
export function depositWorn(SF: any, ch: any, slot: string): Result {
  if (!SF.EQ.SLOT[slot]) return { ok: false, reason: 'No such slot.' };
  if (!ch.equip[slot]) return { ok: false, reason: 'Nothing is worn there.' };
  const r = SF.EQ.unequipItem(ch, { slot }); if (!r.ok) return { ok: false, reason: cap1(r) };
  const t = SF.transfer(ch.pack, ch.bank, r.uid); return t.ok ? { ok: true } : { ok: false, reason: cap1(t) };
}
export function withdraw(SF: any, ch: any, it: any): Result {
  if (!it || !ch.bank.items.includes(it)) return { ok: false, reason: 'That item is not in your bank.' };
  const r = SF.transfer(ch.bank, ch.pack, it.uid, it.qty, { cap: SF.EQ.capFor(ch) }); return r.ok ? { ok: true } : { ok: false, reason: cap1(r) };
}
