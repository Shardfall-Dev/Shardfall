// Fixture for the combat suites: the pre-v0.30 "Glaive hybrid" starting profile these scenarios were written against
// (55 / 45 / 50, Swordsmanship 50, Magery 30, Tactics 20, a halberd, a spellbook with every reagent). v0.30 characters are
// made with the new creator (80 points, see tests/creation-smoke); this only restores the numbers the timings assume.
(() => { const S = __SF, P = S.P, SF = S.SF, MG = SF.MAGERY;
  Object.assign(P.base, { str: 55, dex: 45, int: 50 }); P.str = 55; P.dex = 45; P.int = 50;
  for (const k in P.skills) P.skills[k].v = 0; P.skills.swordsmanship.v = 500; P.skills.magery.v = 300; P.skills.tactics.v = 200;
  P.pack.items = P.pack.items.filter(i => i.id !== 'sword'); P.equip.weapon = SF.newItem('glaive', 1); S.weaponChanged();
  if (!SF.count(P.pack, 'spellbook')) P.pack.items.push(SF.newItem('spellbook', 1, { spells: MG.STARTER.slice() }));
  for (const r of Object.keys(MG.REAGENTS)) SF.addItem(P.pack, SF.newItem(r, 12)); SF.addItem(P.pack, SF.newItem('rune', 1)); P.pack.ver = (P.pack.ver || 0) + 1;
  P.hotbar = [{ k: 'item', id: 'bandage' }, { k: 'spell', id: 'magery.04' }, { k: 'spell', id: 'magery.05' }, { k: 'act', id: 'meditate' }, { k: 'act', id: 'bandother' }, null, null, null, null];
  P.hp = SF.maxHp(P); P.stam = SF.maxStam(P); P.mana = SF.maxMana(P); S.refreshHud(); S.save(); return true; })()
