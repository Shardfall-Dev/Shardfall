# Visual QA contact sheets for the layered human rig (no game loop): every armor family on both bodies in all 8 directions,
# the ten metals, helmets, mixed sets and every animation state. usage: python3 tests/layered-smoke/sheets.py Shardfall_v0.31.html [outdir]
import sys, os, re
from playwright.sync_api import sync_playwright
f = sys.argv[1] if len(sys.argv) > 1 else 'Shardfall_v0.31.html'; out = sys.argv[2] if len(sys.argv) > 2 else '/tmp/layered-sheets'
os.makedirs(out, exist_ok=True)
html = open(f, encoding='utf8').read(); scripts = re.findall(r'<script>([\s\S]*?)</script>', html)
need = [next(s for s in scripts if k in s) for k in ['SF.METALS', 'SF.MAGERY = MG', 'SF.EQ = EQ', 'SF.HRIG = ']]
SHEETS = r"""(() => {
const SF = globalThis.SF, EQ = SF.EQ, H = SF.HRIG, mk = (id, o) => EQ.make(id, o || {});
const set = (fam, mat, sec) => { const g = {}; for (const d of EQ.DEFS) if (d.fam === fam && !g[d.slot] && d.slot !== 'shield') g[d.slot] = mk(d.id, d.prim === 'metal' || d.prim === 'hide' ? { material: mat, sec } : {}); return g; };
const R = eq => H.resolveGear(eq).gear;
function grid(title, rows, cols, cell) { let h = '<h3>' + title + '</h3><table>'; h += '<tr><td></td>' + cols.map(c => '<th>' + c + '</th>').join('') + '</tr>';
  for (const r of rows) { h += '<tr><th>' + r.label + '</th>'; for (const c of cols) h += '<td><img src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(cell(r, c)) + '"></td>'; h += '</tr>'; } return h + '</table>'; }
window.SHEETS = {
 families: () => { const fams = [['cloth', 'cloth'], ['leather', 'regular'], ['leather', 'barbed'], ['studded', 'horned', 'valorite'], ['ringmail', 'copper'], ['chain', 'shadow_iron'], ['plate', 'iron'], ['plate', 'mithril'], ['bone', 'bone'], ['dragon', 'dragon']];
   const rows = []; for (const [fm, mt, sec] of fams) for (const body of ['male', 'female']) rows.push({ label: fm + ' ' + mt + (sec ? '/' + sec : '') + ' ' + body[0], body, gear: Object.assign(R(set(fm, mt, sec)), fm === 'cloth' ? {} : R({ feet: mk('boots', { material: 'thick' }) })) });
   return grid('Armor families × bodies × 8 directions (idle)', rows, H.DIRECTIONS, (r, c) => H.frameSVG({ body: r.body, dir: c, gear: r.gear, style: r.body === 'female' ? 'long' : 'short' })); },
 metals: () => grid('Plate in the ten metals (S, SE, E, N)', ['iron', 'dull_copper', 'shadow_iron', 'copper', 'bronze', 'golden', 'agapite', 'verite', 'valorite', 'mithril'].map(m => ({ label: m, gear: Object.assign(R(set('plate', m)), R({ head: mk('plate_helm', { material: m }), shield: mk('heater_shield', { material: m }) })) })), ['S', 'SE', 'E', 'N'], (r, c) => H.frameSVG({ dir: c, gear: r.gear, weapon: H.weaponOf(SF.newItem('sword', 1)) })),
 helmets: () => grid('Helmets and hair', ['cloth_cap', 'leather_cap', 'chain_coif', 'bascinet', 'open_helm', 'norse_helm', 'closed_helm', 'plate_helm', 'great_helm', 'bone_helm', 'dragon_helm'].map(id => ({ label: id, gear: R({ head: mk(id, { material: 'bronze' }) }) })), ['S', 'SW', 'W', 'N', 'female S'], (r, c) => H.frameSVG({ dir: c === 'female S' ? 'S' : c, body: c === 'female S' ? 'female' : 'male', style: 'long', hair: '#b69a58', gear: r.gear })),
 mixed: () => { const sets = [
   ['plate chest + leather legs', R({ chest: mk('plate_chest', { material: 'golden' }), legs: mk('leather_leggings', { material: 'spined' }), arms: mk('ringmail_sleeves', { material: 'verite' }), head: mk('chain_coif'), feet: mk('boots'), shield: mk('kite_shield', { material: 'valorite' }) }), 'mace'],
   ['robe over chain', R({ chest: mk('chain_tunic'), robe: mk('robe'), feet: mk('shoes') }), 'unarmed'],
   ['tabard + belt + cloak', R({ chest: mk('ringmail_tunic', { material: 'bronze' }), tunic: mk('tabard'), belt: mk('belt', { material: 'horned' }), cloak: mk('cloak'), legs: mk('chain_leggings'), feet: mk('boots') }), 'glaive'],
   ['studded thick + agapite studs', R(set('studded', 'thick', 'agapite')), 'kryss'],
   ['jewelry + shirt', R({ shirt: mk('shirt'), trousers: mk('trousers'), ring: mk('ring', { material: 'golden' }), bracelet: mk('bracelet', { material: 'golden' }), necklace: mk('necklace', { material: 'golden' }), feet: mk('shoes') }), 'dagger'],
   ['bone + wooden shield (yew)', Object.assign(R(set('bone', 'bone')), R({ shield: mk('wooden_shield', { material: 'yew' }) })), 'waraxe'] ];
   return grid('Mixed sets (S, SW, W, NW, N, E)', sets.map(([l, g, w]) => ({ label: l + ' · ' + w, gear: g, w })), ['S', 'SW', 'W', 'NW', 'N', 'E'], (r, c) => H.frameSVG({ dir: c, gear: r.gear, weapon: H.weaponOf(SF.newItem(r.w, 1)) })); },
 actions: () => { const g = Object.assign(R(set('plate', 'iron')), R({ head: mk('norse_helm'), shield: mk('kite_shield', { material: 'bronze' }), cloak: mk('cloak') }));
   const acts = Object.keys(H.ANIMATIONS); const rows = []; for (const w of ['sword', 'glaive', 'shortbow', 'heavycrossbow']) for (const dir of ['SE', 'NW']) rows.push({ label: w + ' ' + dir, w, dir });
   return grid('Every animation (frame at ~40%), plate + kite shield; two-handers must hide the shield', rows, acts, (r, c) => H.frameSVG({ dir: r.dir, action: c, frame: Math.floor(H.ANIMATIONS[c] * .4), gear: g, weapon: H.weaponOf(SF.newItem(r.w, 1)) })); },
 cycle: () => { const g = Object.assign(R(set('chain', 'iron')), R({ head: mk('closed_helm', { material: 'verite' }), shield: mk('metal_shield', { material: 'copper' }) })); const rows = [];
   for (const ac of ['walk', 'run', 'slash1h', 'chop1h', 'cast2h', 'death']) for (const body of ['male', 'female']) rows.push({ label: ac + ' ' + body[0], ac, body });
   return grid('Frame-by-frame (SW): armor follows the joints', rows, [0, 1, 2, 3, 4, 5, 6, 7], (r, c) => H.frameSVG({ body: r.body, dir: 'SW', action: r.ac, frame: c, gear: g, weapon: H.weaponOf(SF.newItem('mace', 1)) })); } };
})();
"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1400, 'height': 900}); pg.on('pageerror', lambda e: print('pageerror', e))
    pg.set_content('<html><body style="background:#4a5a48;color:#eee;font:11px monospace"><style>img{width:224px;height:200px;image-rendering:pixelated}td,th{padding:0;text-align:center}table{border-collapse:collapse}</style><div id=o></div></body></html>')
    for s in need: pg.add_script_tag(content=s)
    pg.add_script_tag(content=SHEETS)
    for k in ['families', 'metals', 'helmets', 'mixed', 'actions', 'cycle']:
        pg.evaluate(f"document.getElementById('o').innerHTML = SHEETS.{k}()"); pg.wait_for_timeout(400)
        pg.screenshot(path=f'{out}/{k}.png', full_page=True); print('wrote', f'{out}/{k}.png')
    b.close()
