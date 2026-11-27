<script>
/* Shardfall character creation rules (SF.CREATION) — Character Creation v2.0 (docs/design/character-creation-v2.md).
   Pure, renderer-free, network-free: runs in the browser after the rules, Magery, equipment and stats modules, and in node
   for tests (tests/creation.test.js). One validator for the creator UI, the boot path and a future server: the payload is
   treated as untrusted input. No classes, levels, XP, talents or body bonuses: a template only fills in the numbers.
   Early Second Age start: 65 attribute points (each 10–45); 100 skill points, whole numbers, over two or three different
   skills, each 0–50. Progression caps stay 225 / 100 (attributes) and 700.0 / 100.0 (skills). */
(function (root) {
'use strict';
const SF = root.SF; if (!SF || !SF.EQ || !SF.MAGERY || !SF.STATS) throw new Error('creation.js needs SF, SF.MAGERY, SF.EQ and SF.STATS first');
const CR = {}; const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
CR.VERSION = 2;
CR.NAME_MIN = 2; CR.NAME_MAX = 16;

/* ---------------- appearance (cosmetic only: never touches stats, gear, weight, movement or combat) ---------------- */
CR.BODIES = [{ id: 'male', n: 'Male' }, { id: 'female', n: 'Female' }];
// skin: 'light' is the colour the traveller sprite was drawn with, so it needs no recolouring
CR.SKIN = [{ id: 'porcelain', n: 'Porcelain', hex: '#efcfb6' }, { id: 'light', n: 'Light', hex: '#d0a080' }, { id: 'tan', n: 'Tan', hex: '#b9875c' },
  { id: 'olive', n: 'Olive', hex: '#a07a50' }, { id: 'bronze', n: 'Bronze', hex: '#8c5a36' }, { id: 'brown', n: 'Brown', hex: '#6a4128' }, { id: 'deep', n: 'Deep', hex: '#46291a' }];
CR.HAIR_STYLES = [{ id: 'short', n: 'Short' }, { id: 'long', n: 'Long' }, { id: 'ponytail', n: 'Ponytail' }, { id: 'pageboy', n: 'Pageboy' },
  { id: 'receding', n: 'Receding', body: 'male' }, { id: 'mohawk', n: 'Mohawk', body: 'male' }, { id: 'buns', n: 'Buns', body: 'female' },
  { id: 'pigtails', n: 'Pigtails', body: 'female' }, { id: 'bald', n: 'Bald' }];
CR.HAIR_COLORS = [{ id: 'black', n: 'Black', hex: '#1d1712' }, { id: 'darkbrown', n: 'Dark brown', hex: '#3b2618' }, { id: 'brown', n: 'Brown', hex: '#5f3b20' },
  { id: 'chestnut', n: 'Chestnut', hex: '#7c401e' }, { id: 'auburn', n: 'Auburn', hex: '#8f2f1a' }, { id: 'red', n: 'Red', hex: '#b5461d' },
  { id: 'blond', n: 'Blond', hex: '#c9a253' }, { id: 'flaxen', n: 'Flaxen', hex: '#e2cf96' }, { id: 'grey', n: 'Grey', hex: '#8c8b88' }, { id: 'white', n: 'White', hex: '#e9e7e1' }];
CR.FACIAL = [{ id: 'none', n: 'None' }, { id: 'mustache', n: 'Mustache' }, { id: 'goatee', n: 'Goatee' }, { id: 'short', n: 'Short beard' },
  { id: 'long', n: 'Long beard' }, { id: 'vandyke', n: 'Vandyke' }];
CR.CLOTHING = [{ id: 'oatmeal', n: 'Undyed', hex: '#a89878' }, { id: 'slate', n: 'Slate', hex: '#4b5765' }, { id: 'forest', n: 'Forest', hex: '#3d5b35' },
  { id: 'wine', n: 'Wine', hex: '#6b2531' }, { id: 'navy', n: 'Navy', hex: '#2b3b6b' }, { id: 'ochre', n: 'Ochre', hex: '#9b7529' },
  { id: 'plum', n: 'Plum', hex: '#5b2f5f' }, { id: 'charcoal', n: 'Charcoal', hex: '#343439' }];
// cloak: 'teal' is the sprite's own cloak (no recolour). 'none' hides it on the paper doll only: the world sprite has no cloakless art yet.
CR.CLOAKS = [{ id: 'teal', n: 'Sea teal', hex: null }, { id: 'crimson', n: 'Crimson', hex: '#8a2a2a' }, { id: 'royal', n: 'Royal blue', hex: '#2a3a8a' },
  { id: 'violet', n: 'Violet', hex: '#5a2a6a' }, { id: 'ash', n: 'Ash', hex: '#3a3a3a' }, { id: 'mustard', n: 'Mustard', hex: '#8a6a2a' }, { id: 'none', n: 'No cloak', hex: null }];
const byId = L => { const o = {}; for (const x of L) o[x.id] = x; return o; };
CR.SKIN_ID = byId(CR.SKIN); CR.HAIR_ID = byId(CR.HAIR_STYLES); CR.HCOL_ID = byId(CR.HAIR_COLORS); CR.FACE_ID = byId(CR.FACIAL); CR.CLOTH_ID = byId(CR.CLOTHING); CR.CLOAK_ID = byId(CR.CLOAKS);
CR.LOOK_KEYS = ['body', 'skinTone', 'hairStyle', 'hairColor', 'facialHairStyle', 'facialHairColor', 'clothingColor', 'cloak'];
CR.hairFor = body => CR.HAIR_STYLES.filter(h => !h.body || h.body === body);
CR.defaultLook = body => body === 'female'
  ? { body: 'female', skinTone: 'light', hairStyle: 'long', hairColor: 'chestnut', facialHairStyle: 'none', facialHairColor: 'chestnut', clothingColor: 'oatmeal', cloak: 'teal' }
  : { body: 'male', skinTone: 'light', hairStyle: 'short', hairColor: 'darkbrown', facialHairStyle: 'none', facialHairColor: 'darkbrown', clothingColor: 'oatmeal', cloak: 'teal' };
/* checkLook(look) → error strings. Every field must be an allowlisted id; female characters have no facial hair. */
CR.checkLook = look => {
  const e = []; if (!look || typeof look !== 'object' || Array.isArray(look)) return ['Appearance is missing.'];
  if (!CR.BODIES.some(b => b.id === look.body)) e.push('Choose male or female.');
  if (!has(CR.SKIN_ID, look.skinTone)) e.push('Choose a skin tone.');
  if (!has(CR.HAIR_ID, look.hairStyle) || (CR.HAIR_ID[look.hairStyle].body && CR.HAIR_ID[look.hairStyle].body !== look.body)) e.push('Choose a hairstyle for this body.');
  if (!has(CR.HCOL_ID, look.hairColor)) e.push('Choose a hair colour.');
  if (!has(CR.FACE_ID, look.facialHairStyle) || (look.body === 'female' && look.facialHairStyle !== 'none')) e.push('Choose a valid facial hair style.');
  if (!has(CR.HCOL_ID, look.facialHairColor)) e.push('Choose a facial hair colour.');
  if (!has(CR.CLOTH_ID, look.clothingColor)) e.push('Choose a clothing colour.');
  if (!has(CR.CLOAK_ID, look.cloak)) e.push('Choose a cloak.');
  return e;
};
/* normalizeLook(old) → a valid look for an existing character (save migration). Keeps every valid field and any unknown
   extra field; a legacy cloak colour (v1 saves stored a hex) maps to its cloak id. Idempotent. */
CR.normalizeLook = old => {
  const o = old && typeof old === 'object' && !Array.isArray(old) ? old : {};
  const body = CR.BODIES.some(b => b.id === o.body) ? o.body : 'male';
  const d = CR.defaultLook(body), out = Object.assign({}, o, { body });
  if (typeof o.cloak === 'string' && o.cloak[0] === '#') { const c = CR.CLOAKS.find(x => x.hex && x.hex.toLowerCase() === o.cloak.toLowerCase()); out.cloak = c ? c.id : 'teal'; }
  else if (o.cloak === null || o.cloak === undefined || o.cloak === '') out.cloak = 'teal';
  for (const k of CR.LOOK_KEYS) if (k !== 'body' && CR.checkLook(Object.assign({}, d, { [k]: out[k] })).length) out[k] = d[k];   // each field on its own
  if (body === 'female') out.facialHairStyle = 'none';
  return out;
};
CR.hex = (list, id) => { const x = byId(list)[id]; return x ? x.hex : null; };
CR.cloakHex = look => { if (!look) return null; if (typeof look.cloak === 'string' && look.cloak[0] === '#') return look.cloak; const c = CR.CLOAK_ID[look.cloak]; return c ? c.hex : null; };
CR.skinHex = look => { const s = look && CR.SKIN_ID[look.skinTone]; return s && s.id !== 'light' ? s.hex : null; };
CR.lookKey = look => CR.LOOK_KEYS.map(k => look ? look[k] : '').join('|');

/* ---------------- skills that can be chosen ---------------- */
// one-line descriptions of what each skill does in this build (shown in the creator's skill picker)
CR.SKILL_INFO = {
  swordsmanship: 'Hit chance and defence with swords, axes and the halberd.', macefighting: 'Hit chance with maces, hammers and the war axe; blows drain stamina and wear armour.',
  fencing: 'Hit chance and defence with daggers, kryss and spears.', archery: 'Hit chance with bows and crossbows. Stand still to aim.',
  wrestling: 'Unarmed attack and defence.', tactics: 'Weapon damage: half at 0, one and a half times at 100.',
  anatomy: 'More weapon damage and better bandages; judge a creature’s strength.', parrying: 'Block part of a hit with a shield.',
  healing: 'Bandage wounds; cure poison at 60 (with 60 Anatomy).', spellcraft: 'Cast spells from a spellbook with reagents and mana.',
  focus: 'Raises spell damage and helps against resistance.', wardcraft: 'Resist harmful spells.',
  meditation: 'Faster mana regeneration; meditate to recover mana.', alchemy: 'Brew potions from reagents.',
  venomcraft: 'Coat a weapon with poison.', concealment: 'Hide from creatures and people.', search: 'Find hidden traps, chests and people.',
  tracking: 'Point the way to nearby creatures.', pickpocketing: 'Steal coin from smugglers and other fair targets.',
  lockwork: 'Pick the locks of chests with lockpicks.', taming: 'Tame wild animals as pets.', beasthandling: 'Command pets and judge animals.',
  veterinary: 'Heal your pets.', musicianship: 'Play an instrument; every bard skill needs it.', lullaby: 'Calm a hostile creature with music.',
  provocation: 'Turn a creature against another with music.', woodcutting: 'Fell trees for logs.', mining: 'Dig ore with a pickaxe.',
  fishing: 'Fish from shore with a rod.', smithing: 'Smelt ore, forge weapons and armour, repair metal.', carpentry: 'Work wood into furniture, shields and staves.',
  tailoring: 'Sew cloth and leather gear.', fletching: 'Make bows, arrows and bolts.', engineering: 'Make tools, hinges, locks and traps.',
  cooking: 'Cook meat and fish.', appraisal: 'Learn an item’s worth and properties.' };
// a skill can be chosen when it is implemented, not barred by SF.SKILL_NOCREATE, and the creator has a description for it
CR.creatable = k => !!(SF.SKILL[k] && SF.SKILL[k].live && !has(SF.SKILL_NOCREATE, k) && CR.SKILL_INFO[k]);
CR.CREATABLE = SF.SKILLS.map(s => s[0]).filter(CR.creatable);

/* ---------------- starting templates: editable suggestions, never classes ---------------- */
// stats [STR, DEX, INT] (sum 65); skills by canonical name, resolved through SF.skillKey (sum 100)
CR.TEMPLATES = [
  { id: 'swordsman', n: 'Swordsman', s: [35, 20, 10], k: [['Swordsmanship', 50], ['Tactics', 30], ['Healing', 20]], town: 'quay', d: 'A blade, a steady arm and bandages.' },
  { id: 'maceman', n: 'Maceman', s: [35, 20, 10], k: [['Mace Fighting', 50], ['Tactics', 30], ['Healing', 20]], town: 'quay', d: 'Crushing blows that tire the foe and dent their armour.' },
  { id: 'fencer', n: 'Fencer', s: [25, 30, 10], k: [['Fencing', 50], ['Tactics', 30], ['Healing', 20]], town: 'quay', d: 'Quick thrusts with a light blade.' },
  { id: 'archer', n: 'Archer', s: [25, 30, 10], k: [['Archery', 50], ['Tactics', 30], ['Anatomy', 20]], town: 'skara', d: 'Bow and arrows from range.' },
  { id: 'mage', n: 'Mage', s: [15, 10, 40], k: [['Magery', 50], ['Evaluating Intelligence', 30], ['Meditation', 20]], town: 'moonglen', d: 'Spells from a spellbook, fuelled by reagents and mana.' },
  { id: 'blacksmith', n: 'Blacksmith', s: [40, 15, 10], k: [['Blacksmithy', 50], ['Mining', 50]], town: 'mynoc', d: 'Mine ore, smelt it and forge.' },
  { id: 'carpenter', n: 'Carpenter', s: [35, 20, 10], k: [['Carpentry', 50], ['Lumberjacking', 50]], town: 'vespar', d: 'Fell trees and work the wood.' },
  { id: 'rogue', n: 'Rogue', s: [20, 35, 10], k: [['Hiding', 50], ['Lockpicking', 30], ['Stealing', 20]], town: 'vespar', d: 'Unseen, light-fingered, good with locks.' },
  { id: 'healer', n: 'Healer', s: [20, 20, 25], k: [['Healing', 50], ['Anatomy', 30], ['Magery', 20]], town: 'quay', d: 'Bandages first, a little magic after.' },
  { id: 'bard', n: 'Bard', s: [15, 25, 25], k: [['Musicianship', 50], ['Provocation', 30], ['Peacemaking', 20]], town: 'vespar', d: 'Music that calms or sets creatures on each other.' },
  { id: 'tamer', n: 'Animal Tamer', s: [25, 15, 25], k: [['Animal Taming', 50], ['Animal Lore', 30], ['Veterinary', 20]], town: 'skara', d: 'Wild animals as companions.' },
  { id: 'advanced', n: 'Advanced', s: [25, 20, 20], k: [], town: 'quay', d: 'Choose every number yourself.', advanced: true }];
CR.TEMPLATE = byId(CR.TEMPLATES);
/* template(id) → a fresh draft allocation { stats: [s,d,i], skills: [[key, pts] ×3] } (runtime keys), or null */
CR.template = id => { const t = CR.TEMPLATE[id]; if (!t) return null; const sk = t.k.map(([n, v]) => [SF.skillKey(n), v]); while (sk.length < SF.CREATE_SKILL_SLOTS) sk.push([null, 0]); return { stats: t.s.slice(), skills: sk }; };
/* templateIssues(id): why a template cannot be used as is (an unbuilt skill), so the UI marks it rather than substituting */
CR.templateIssues = id => { const t = CR.TEMPLATE[id]; if (!t) return ['unknown template']; return t.k.filter(([n]) => !CR.creatable(SF.skillKey(n))).map(([n]) => n + ' is not available yet'); };
/* matchTemplate(stats, skills): the template these exact numbers are, else null (anything edited reads as Custom) */
CR.matchTemplate = (stats, skills) => { const norm = L => L.filter(([k, v]) => k && v > 0).map(([k, v]) => k + ':' + v).sort().join(','); const sk = norm(skills);
  for (const t of CR.TEMPLATES) { if (t.advanced) continue; const a = CR.template(t.id); if (a.stats.join() === stats.join() && norm(a.skills) === sk) return t.id; } return null; };

/* ---------------- starting towns ---------------- */
// shrine: the SHRINES id the soul is bound to (and the spawn is taken beside). Every town listed is walkable, protected, and
// has a bank, a healer, merchants and a route on (checked again at boot: CR.townReady; a failed check falls back to the Quay).
CR.TOWNS = [
  { id: 'quay', n: 'Saltmarsh Quay', shrine: 'quay', tutorial: true, d: 'A small harbour on the starter isle. Wren the sellsword, the Shore Beacon quest, gentle wildlife, a packet boat to Vespar.', services: ['bank', 'healer', 'trainer', 'shops', 'boat to Vespar'] },
  { id: 'vespar', n: 'Vespar', shrine: 'vespar', d: 'The river-trade town: tailor, tinker, provisioner, fish hall. Boats to Moonglen and the Quay.', services: ['bank', 'healer', 'shops', 'boats'] },
  { id: 'mynoc', n: 'Mynoc', shrine: 'mynoc', d: 'The mining town beside Mynoc Mine, with the forge and the mine stores.', services: ['bank', 'healer', 'forge', 'mine'] },
  { id: 'skara', n: 'Skara Bryn', shrine: 'skara', d: 'Rangers, the bowyer and the fletcher, on the forest coast. Ferry across the strait.', services: ['bank', 'healer', 'bowyer', 'ferry'] },
  { id: 'moonglen', n: 'Moonglen', shrine: 'moonglen', d: 'The college town of mages: reagents, the library, the observatory. Boat to Vespar.', services: ['bank', 'healer', 'reagents', 'boat to Vespar'] }];
CR.TOWN = byId(CR.TOWNS);
/* townReady(id, world) → { ok, reason }. world: { shrines: [{id,x,y}], npcs: [{role,town}], stand(x,y) } from the game after genWorld */
CR.TOWN_NEEDS = { quay: null, vespar: ['banker', 'healer'], mynoc: ['banker', 'healer'], skara: ['banker', 'healer'], moonglen: ['banker', 'healer'] };
CR.spawnOf = sh => ({ x: sh.x + .5, y: sh.y + 1.7 });
CR.townReady = (id, world) => {
  const t = CR.TOWN[id]; if (!t) return { ok: false, reason: 'unknown town' };
  if (id === 'quay') return { ok: true, spawn: { x: 92.5, y: 304.5 }, bound: 'quay' };       // the verified starter spawn on the plaza
  const sh = (world.shrines || []).find(s => s.id === t.shrine); if (!sh) return { ok: false, reason: 'no shrine' };
  for (const r of CR.TOWN_NEEDS[id] || []) if (!(world.npcs || []).some(n => n.role === r && n.town === id)) return { ok: false, reason: 'no ' + r };
  const sp = CR.spawnOf(sh); if (world.stand && !world.stand(sp.x, sp.y)) return { ok: false, reason: 'spawn blocked' };
  return { ok: true, spawn: sp, bound: t.shrine };
};

/* ---------------- validation (shared by the UI, boot and a future server) ---------------- */
// name policy: letters (any script), numbers, spaces, apostrophes and hyphens; trimmed, inner runs of spaces collapsed; 2–16
CR.cleanName = n => typeof n === 'string' ? n.replace(/\s+/g, ' ').trim() : '';
CR.checkName = n => { const c = CR.cleanName(n); if (typeof n !== 'string' || !c) return 'Enter a name.';
  if (/[\u0000-\u001f\u007f-\u009f]/.test(n)) return 'The name has invisible control characters.';
  if (!/^[\p{L}\p{N}' \-]+$/u.test(c)) return 'Use letters, numbers, spaces, apostrophes and hyphens only.';
  if (!/\p{L}/u.test(c)) return 'The name needs at least one letter.';
  const len = [...c].length; if (len < CR.NAME_MIN) return 'The name needs at least 2 characters.'; if (len > CR.NAME_MAX) return 'The name can have at most 16 characters.';
  return null; };
/* validate(payload) → { ok, errors: [string], field: { name, look, stats, skills, town }, value }
   payload: { name, look: {…}, str, dex, int, skills: [[id, points], …] or { id: points }, town, template? }
   Skill ids may be runtime keys or canonical ids; duplicates are found after resolving aliases and before any merge.
   value (only when ok) is the normalized creation: { name, look, str, dex, int, skills: { key: points }, town, template }. */
CR.validate = o => {
  const F = { name: [], look: [], stats: [], skills: [], town: [] }; const out = { ok: false, errors: [], field: F, value: null };
  const done = () => { for (const k in F) out.errors.push(...F[k]); out.ok = !out.errors.length; return out; };
  if (!o || typeof o !== 'object' || Array.isArray(o)) { F.name.push('Nothing to create.'); return done(); }
  const ne = CR.checkName(o.name); if (ne) F.name.push(ne);
  F.look.push(...CR.checkLook(o.look));
  const st = [o.str, o.dex, o.int];
  if (st.some(v => typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v))) F.stats.push('Attributes must be whole numbers.');
  else {
    if (st.some(v => v < SF.CREATE_STAT_MIN || v > SF.CREATE_STAT_MAX)) F.stats.push(`Each attribute must be between ${SF.CREATE_STAT_MIN} and ${SF.CREATE_STAT_MAX}.`);
    const t = st[0] + st[1] + st[2]; if (t !== SF.CREATE_STATS) F.stats.push(`Spend exactly ${SF.CREATE_STATS} attribute points (now ${t}).`);
  }
  let rows = o.skills;
  if (rows && typeof rows === 'object' && !Array.isArray(rows)) rows = Object.keys(rows).map(k => [k, rows[k]]);
  const skills = {};
  if (!Array.isArray(rows)) F.skills.push('Choose your starting skills.');
  else {
    const seen = new Set(); let tot = 0, n = 0, bad = false;
    for (const r of rows) {
      if (!Array.isArray(r) || r.length !== 2) { bad = true; continue; }
      const [id, v] = r;
      if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v) || v < 0 || v > SF.CREATE_SKILL_MAX) { F.skills.push(`Skill points must be whole numbers from 0 to ${SF.CREATE_SKILL_MAX}.`); bad = true; continue; }
      if (v === 0 && (id === null || id === undefined || id === '')) continue;    // an empty row
      const k = SF.skillKey(id);
      if (!k) { F.skills.push('Unknown skill: ' + String(id).slice(0, 24) + '.'); bad = true; continue; }
      if (!CR.creatable(k)) { F.skills.push((SF.SKILL_NOCREATE[k] || SF.SKILL[k].n + ' cannot be chosen yet.')); bad = true; continue; }
      if (seen.has(k)) { F.skills.push(SF.SKILL[k].n + ' is chosen twice.'); bad = true; continue; }
      seen.add(k); if (v > 0) { skills[k] = v; tot += v; n++; }
    }
    if (rows.length > SF.CREATE_SKILL_SLOTS) F.skills.push(`At most ${SF.CREATE_SKILL_SLOTS} skill rows.`);
    if (!bad) {
      if (n < 2) F.skills.push('Choose two or three skills.');
      if (tot !== SF.CREATE_SKILLS) F.skills.push(`Spend exactly ${SF.CREATE_SKILLS} skill points (now ${tot}).`);
    }
  }
  if (!has(CR.TOWN, o.town)) F.town.push('Choose a starting town.');
  done();
  if (out.ok) out.value = { name: CR.cleanName(o.name), look: CR.LOOK_KEYS.reduce((a, k) => (a[k] = o.look[k], a), {}), str: o.str, dex: o.dex, int: o.int, skills, town: o.town,
    template: CR.matchTemplate([o.str, o.dex, o.int], Object.keys(skills).map(k => [k, skills[k]])) || 'custom' };
  return out;
};

/* ---------------- character and starter kit ---------------- */
/* progression(v) → the starting progression block: skills in tenths (points × 10 once), every other skill 0.0, all locks Raise;
   attribute locks Raise; a fresh attribute-gain state. */
CR.progression = (v, seed) => {
  const skills = SF.newSkills(); for (const k in v.skills) skills[k].v = v.skills[k] * 10;
  return { str: v.str, dex: v.dex, int: v.int, skills, statLocks: SF.STATS.newLocks(), statGain: SF.STATS.newState(seed) };
};
/* kit(v) → the starter kit manifest for a validated creation (data only; applyKit makes the items).
   Common: plain clothes, journal, food, 100 gold, 10 bandages. Then one weapon or tool for each positive skill that uses one.
   No grants for zero skills, no expensive materials, no weapon the character cannot use, a shield only beside a one-handed weapon. */
CR.STARTER = { gold: 100, bandages: 10, food: 3, arrows: 50, reagents: 10, lockpicks: 5, vials: 4 };
// weapon per fighting skill, best first; the first whose Strength requirement is met is worn
CR.WEAPON_PREF = { swordsmanship: ['sword', 'knife'], macefighting: ['mace'], fencing: ['dagger'], archery: ['shortbow'] };
CR.TOOL_FOR = [['mining', 'pickaxe'], ['woodcutting', 'hatchet'], ['smithing', 'tongs'], ['engineering', 'tongs'], ['tailoring', 'sewkit'],
  ['carpentry', 'knife'], ['fletching', 'knife'], ['fishing', 'rod'], ['skinning', 'knife']];
CR.kit = v => {
  const k = v.skills, pos = s => (k[s] || 0) > 0, notes = [];
  const m = { wear: { shirt: 'shirt', trousers: 'trousers', feet: 'shoes' }, pack: [['journal', 1], ['gold', CR.STARTER.gold], ['bandage', CR.STARTER.bandages], ['cookedmeat', CR.STARTER.food]], spells: [], hotbar: [], notes };
  const fight = ['swordsmanship', 'macefighting', 'fencing', 'archery'].filter(pos).sort((a, b) => k[b] - k[a]);
  if (fight.length) {
    const s = fight[0], w = CR.WEAPON_PREF[s].find(id => SF.EQ.strReq({ id }) <= v.str);
    if (w) { m.wear.weapon = w; if (w === 'shortbow') m.pack.push(['arrow', CR.STARTER.arrows]); }
    else notes.push(`No ${SF.SKILL[s].n} weapon is light enough for ${v.str} Strength; buy one when you are stronger.`);
  }
  if (pos('parrying') && m.wear.weapon && !SF.WEAPONS[SF.ITEMS[m.wear.weapon].wpn].two) m.wear.shield = 'buckler';
  const tools = new Set(); for (const [s, t] of CR.TOOL_FOR) if (pos(s) && m.wear.weapon !== t) tools.add(t);
  for (const t of tools) m.pack.push([t, 1]);
  if (pos('spellcraft')) { m.pack.push(['spellbook', 1]); m.spells = SF.MAGERY.STARTER.slice();
    const regs = new Set(); for (const id of m.spells) for (const r of (SF.MAGERY.SPELLS.find(x => x.id === id) || {}).regs || []) regs.add(r);
    for (const r of regs) m.pack.push([r, CR.STARTER.reagents]); }
  if (pos('lockwork')) m.pack.push(['lockpick', CR.STARTER.lockpicks]);
  if (pos('musicianship') || pos('lullaby') || pos('provocation')) m.pack.push(['lute', 1]);
  if (pos('alchemy')) m.pack.push(['vial', CR.STARTER.vials]);
  // hotbar: only things this character has or can do
  const hb = [{ k: 'item', id: 'bandage' }];
  if (pos('spellcraft')) for (const id of m.spells) hb.push({ k: 'spell', id });
  if (pos('concealment')) hb.push({ k: 'act', id: 'hide' });
  if (pos('tracking')) hb.push({ k: 'act', id: 'track' });
  if (pos('spellcraft') || pos('meditation')) hb.push({ k: 'act', id: 'meditate' });
  hb.push({ k: 'act', id: 'bandother' });
  m.hotbar = hb.slice(0, 5); while (m.hotbar.length < 4) m.hotbar.push(null);
  return m;
};
/* applyKit(ch, manifest) — once, on a committed new character. Worn pieces are equipped directly (the character is empty);
   non-stacking starter items carry starter: true (no vendor resale). Returns { ok, weight, cap, stage }; never overloads:
   optional supplies are trimmed if the total would pass the first encumbrance stage. */
CR.applyKit = (ch, m) => {
  const make = id => { const it = SF.EQ.isGear(id) || (SF.WEARABLE(id) && !SF.ITEMS[id].stack) ? SF.EQ.make(id, { origin: 'npc' }) : SF.newItem(id, 1); if (!SF.ITEMS[id].stack) it.starter = true; return it; };
  for (const s in m.wear) { const it = make(m.wear[s]); const c = SF.EQ.canEquip ? SF.EQ.canEquip(ch, it, s) : { ok: true }; if (c && c.ok === false) { SF.addItem(ch.pack, it); continue; } ch.equip[s] = it; }
  for (const [id, q] of m.pack) { if (id === 'spellbook') { const b = SF.newItem('spellbook', 1, { spells: m.spells.slice() }); b.starter = true; ch.pack.items.push(b); ch.pack.ver = (ch.pack.ver || 0) + 1; continue; }
    if (SF.ITEMS[id].stack) SF.addItem(ch.pack, SF.newItem(id, q)); else for (let i = 0; i < q; i++) SF.addItem(ch.pack, make(id)); }
  const trim = ['cookedmeat', 'arrow', 'bandage'];
  let en = SF.EQ.encumbrance(ch);
  while (en.stage > 0 && trim.length) { const id = trim.shift(); const it = ch.pack.items.find(x => x.id === id); if (it) { ch.pack.items.splice(ch.pack.items.indexOf(it), 1); ch.pack.ver = (ch.pack.ver || 0) + 1; } en = SF.EQ.encumbrance(ch); }
  ch.hotbar = m.hotbar.slice();
  return { ok: en.stage === 0, weight: en.wt, cap: en.cap, stage: en.stage };
};

/* title(ch): the character's title from what they have actually raised (never from the template): the classic rank of the highest
   skill and its profession, e.g. "Journeyman Swordsman". Below 30.0 in everything: "Neophyte". */
CR.RANKS = [[100, 'Grandmaster'], [90, 'Master'], [80, 'Adept'], [70, 'Expert'], [60, 'Journeyman'], [50, 'Apprentice'], [40, 'Novice'], [30, 'Neophyte']];
CR.TITLE_NOUN = { swordsmanship: 'Swordsman', macefighting: 'Armsman', fencing: 'Fencer', archery: 'Archer', wrestling: 'Wrestler', tactics: 'Tactician',
  anatomy: 'Healer', parrying: 'Duelist', healing: 'Healer', spellcraft: 'Mage', focus: 'Scholar', wardcraft: 'Warder', meditation: 'Stoic', alchemy: 'Alchemist',
  venomcraft: 'Assassin', concealment: 'Rogue', shadowstep: 'Rogue', search: 'Scout', tracking: 'Ranger', pickpocketing: 'Pickpocket', lockwork: 'Infiltrator',
  trapcraft: 'Trap Specialist', taming: 'Tamer', beasthandling: 'Naturalist', veterinary: 'Veterinarian', musicianship: 'Bard', lullaby: 'Pacifier',
  discord: 'Demoralizer', provocation: 'Rouser', woodcutting: 'Lumberjack', mining: 'Miner', foraging: 'Forager', skinning: 'Skinner', fishing: 'Fisherman',
  smithing: 'Blacksmith', carpentry: 'Carpenter', tailoring: 'Tailor', fletching: 'Bowyer', engineering: 'Tinker', cooking: 'Chef', appraisal: 'Merchant' };
CR.title = ch => { let best = null; for (const k in ch.skills || {}) if (!best || ch.skills[k].v > ch.skills[best].v) best = k; const v = best ? ch.skills[best].v / 10 : 0;
  const r = CR.RANKS.find(([min]) => v >= min); return r ? r[1] + ' ' + (CR.TITLE_NOUN[best] || SF.SKILL[best].n) : 'Neophyte'; };

/* preview(v): derived numbers for the creator, from the shared rules (no formula of its own) */
CR.preview = s => { const c = { str: s[0], dex: s[1], int: s[2], equip: {} }; return { hp: SF.maxHp(c), stam: SF.maxStam(c), mana: SF.maxMana(c), carry: SF.carryCap(c) }; };

SF.CREATION = CR;
})(typeof globalThis !== 'undefined' ? globalThis : this);
</script>
