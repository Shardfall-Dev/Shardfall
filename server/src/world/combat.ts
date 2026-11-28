/* Server Combat v1 — one swing or one creature blow, resolved by the game's own rules (src/rules.js, src/skills.js, src/equipment.js).
   This is src/game.js fighter / swingAt / strikeOne / applyBlow for the actors that exist online (characters and creatures):
     · hit chance: SF.hitChance(attack, defence) — a character attacks and defends with its weapon skill (SF.SK.value, which
       includes the small stat lift), a creature with its species' atk / def;
     · stage 1, SF.rawDamage: a character rolls its weapon's dice (magic damage, quality, condition) scaled by Tactics, Anatomy
       and Strength; a creature rolls its species' damage range at scale 1;
     · a creature's ward soaks a blow first (the bell sentinel);
     · stage 2, SF.mitigate: a struck character's shield may parry (Parrying), then the armour on one body region picked by
       SF.EQ.pickRegion absorbs, then the blow is halved for a player recipient; a struck creature's natural armour (monT2A) absorbs;
     · learning: the weapon skill from the hit chance (SF.SK.use), Tactics and Anatomy on a hit (SF.SK.check 0–100), Parrying
       from the parry chance — the same calls the offline game makes, with the server's random stream; stats rise with them.
   Wear (Server Items v1, game.js applyBlow → wear): a weapon that hits loses 25 / its durability, the armour piece that took a
   blow 0.2, a shield that parried 0.3; at 0 a piece is broken. Not online yet: venom and magic effects. Pure: no I/O, no timers; the caller owns time and randomness. */
import type { Species } from './creatures';
import { wear } from './items';

export interface Learned { skill: string; value: number; stat?: string }
export interface SwingResult { hit: boolean; chance: number; dmg: number; ward: number; learned: Learned[]; worn: boolean; broke: any[] }
export interface BlowResult { hit: boolean; chance: number; dmg: number; parried: boolean; region: string | null; learned: Learned[]; worn: boolean; broke: any[] }

const clamp = (lo: number, hi: number, v: number) => Math.max(lo, Math.min(hi, v));
/* creature numbers the T2A rules need: natural armour rating, strength and dexterity (game.js monT2A) */
export function monT2A(d: Species) { return { ar: d.ar !== undefined ? d.ar : Math.round((d.armor || 0) * .4), str: d.str || clamp(10, 100, d.hp), dex: d.dex || clamp(10, 100, Math.round((d.speed || 3) * 20)) }; }
/* the weapon in hand (game.js weaponOfActor): nothing or a broken weapon fights as fists */
export function weaponOf(SF: any, ch: any) {
  const it = ch.equip && ch.equip.weapon; if (!it) return { w: SF.WEAPONS.unarmed, it: null };
  if (it.cond !== undefined && it.cond <= 0) return { w: SF.WEAPONS.unarmed, it: null };
  const w = SF.weaponOf(it); return w ? { w, it } : { w: SF.WEAPONS.unarmed, it: null };
}
/* a character's side of a fight (game.js fighter for the player) */
export function playerFighter(SF: any, ch: any) {
  const { w, it } = weaponOf(SF, ch), sh = ch.equip && ch.equip.shield, K = SF.SK;
  return { w, it, atk: K.value(ch, w.skill) + K.magicAcc(it), def: K.value(ch, w.skill), tactics: K.value(ch, 'tactics'), anatomy: K.value(ch, 'anatomy'), str: ch.str,
    shieldAR: sh && SF.ITEMS[sh.id] && SF.ITEMS[sh.id].slot === 'shield' ? Math.round(SF.EQ.shieldAR(sh)) : 0, parry: K.value(ch, 'parrying') };
}
/* the swing timer's delay for a character now (SF.swingDelay at its stamina with the weapon in hand) */
export const swingDelay = (SF: any, ch: any, stam: number) => SF.swingDelay(stam, weaponOf(SF, ch).w.speed);

function note(SF: any, ch: any, before: { str: number; dex: number; int: number }, key: string, r: any, out: Learned[]) {
  if (r && r.gained) out.push({ skill: key, value: ch.skills[key].v });
  for (const s of ['str', 'dex', 'int'] as const) if (ch[s] !== before[s] && !out.some(l => l.stat === s)) out.push({ skill: key, value: ch.skills[key] ? ch.skills[key].v : 0, stat: s });
}

/* a character swings at a creature. ch is mutated only by learning (skills and stats). */
export function playerSwing(SF: any, ch: any, d: Species, ward: number, rng: () => number, now: number, target: string): SwingResult {
  const A = playerFighter(SF, ch), learned: Learned[] = [], ctx = { rng, now, target, locks: ch.statLocks };
  const chance = SF.hitChance(A.atk, d.def || 30), hit = rng() < chance;
  let b = { str: ch.str, dex: ch.dex, int: ch.int }; note(SF, ch, b, A.w.skill, SF.SK.use(ch, A.w.skill, chance, hit, ctx), learned);
  if (!hit) return { hit, chance, dmg: 0, ward: 0, learned, worn: false, broke: [] };
  const raw = SF.rawDamage({ dice: A.w.dice, bonus: SF.SK.magicDmg(A.it), quality: A.it && A.it.quality, cond: A.it && A.it.cond, maxc: A.it && A.it.maxc, tactics: A.tactics, anatomy: A.anatomy, str: A.str }, rng);
  let v = raw.value, soaked = 0;
  if (ward > 0) { soaked = Math.min(ward, v); v -= soaked; }
  const m = SF.mitigate(v, { parry: 0, braced: false, shieldAR: 0, armorAR: monT2A(d).ar, player: false, mace: !!A.w.mace }, rng);
  for (const k of ['tactics', 'anatomy']) { b = { str: ch.str, dex: ch.dex, int: ch.int }; note(SF, ch, b, k, SF.SK.check(ch, k, 0, 100, ctx).learn, learned); }
  const wr = A.it && A.w.hp ? wear(SF, A.it, 25 / A.w.hp) : { worn: false, broke: false };
  return { hit, chance, dmg: v <= 0 ? 0 : m.final, ward: Math.round(soaked), learned, worn: wr.worn, broke: wr.broke ? [A.it] : [] };
}

/* a creature's blow at a character (game.js strikeOne → applyBlow). ch is mutated only by learning (Parrying). */
export function creatureBlow(SF: any, d: Species, ch: any, rng: () => number, now: number, target: string): BlowResult {
  const D = playerFighter(SF, ch), learned: Learned[] = [];
  const chance = SF.hitChance(d.atk || 40, D.def), hit = rng() < chance;
  if (!hit) return { hit, chance, dmg: 0, parried: false, region: null, learned, worn: false, broke: [] };
  const raw = SF.rawDamage({ range: d.dmg || [4, 7], scale: 1 }, rng);
  const rg = SF.EQ.regionArmor(ch, SF.EQ.pickRegion(rng));
  const m = SF.mitigate(raw.value, { parry: D.parry, braced: false, shieldAR: D.shieldAR, armorAR: rg.ar, player: true, mace: false }, rng);
  if (D.shieldAR > 0) { const b = { str: ch.str, dex: ch.dex, int: ch.int }; note(SF, ch, b, 'parrying', SF.SK.use(ch, 'parrying', m.parryChance, m.parried, { rng, now, target, locks: ch.statLocks }), learned); }
  let worn = false; const broke: any[] = [];
  const W = (it: any, amt: number) => { const r = wear(SF, it, amt); if (r.worn) worn = true; if (r.broke) broke.push(it); };
  if (D.shieldAR > 0 && m.parried) W(ch.equip.shield, .3);
  if (rg.item) W(rg.item, .2);
  return { hit, chance, dmg: m.final, parried: !!m.parried, region: rg.region || null, learned, worn, broke };
}
