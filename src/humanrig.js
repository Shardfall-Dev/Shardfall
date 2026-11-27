<script>
/* Shardfall human rig (SF.RIG) — the classic-humans-v2 articulated procedural rig with the layered-armor-v1 painter, ported from
   asset-packs/classic-humans-v2 and asset-packs/layered-armor-v1 (versions 2.0.0 / 1.0.0) into the fragment build. PROCEDURAL PROTOTYPE
   ART, not the painted production atlas: every shape here is drawn in code. 112×100 cells, ground anchor (56,86), 8 screen
   directions S SW W NW N NE E SE, 29 animations, male and female bodies. Pure: returns SVG strings; no DOM, no randomness.
   Shardfall additions (v1.1, docs/wardrobe/STATUS.md): hex cloth/hair/skin, cloth dye per piece, the drowned skin, the buckler and
   respawn garment, cosmetic overlays (aprons, vest, skirt, dress, hats, hood, scarf, sash, pouch, mantle, trim, crest, heraldry,
   bracer, wear) and a few props (tongs, tankard, book, basket, lantern). */
(function (root) {
'use strict';
const DEFINITIONS={
  "cloth_cap": {
    "family": "cloth",
    "slot": "head",
    "primary": "fixed",
    "fixed": "cloth",
    "secondary": null
  },
  "shirt": {
    "family": "cloth",
    "slot": "shirt",
    "primary": "fixed",
    "fixed": "cloth",
    "secondary": null
  },
  "trousers": {
    "family": "cloth",
    "slot": "trousers",
    "primary": "fixed",
    "fixed": "cloth",
    "secondary": null
  },
  "robe": {
    "family": "cloth",
    "slot": "robe",
    "primary": "fixed",
    "fixed": "cloth",
    "secondary": null
  },
  "cloak": {
    "family": "cloth",
    "slot": "cloak",
    "primary": "fixed",
    "fixed": "cloth",
    "secondary": null
  },
  "cloth_gloves": {
    "family": "cloth",
    "slot": "hands",
    "primary": "fixed",
    "fixed": "cloth",
    "secondary": null
  },
  "tabard": {
    "family": "cloth",
    "slot": "tunic",
    "primary": "fixed",
    "fixed": "cloth",
    "secondary": null
  },
  "leather_cap": {
    "family": "leather",
    "slot": "head",
    "primary": "hide",
    "fixed": null,
    "secondary": null
  },
  "leather_gorget": {
    "family": "leather",
    "slot": "neck",
    "primary": "hide",
    "fixed": null,
    "secondary": null
  },
  "leather_tunic": {
    "family": "leather",
    "slot": "chest",
    "primary": "hide",
    "fixed": null,
    "secondary": null
  },
  "leather_sleeves": {
    "family": "leather",
    "slot": "arms",
    "primary": "hide",
    "fixed": null,
    "secondary": null
  },
  "leather_gloves": {
    "family": "leather",
    "slot": "hands",
    "primary": "hide",
    "fixed": null,
    "secondary": null
  },
  "leather_leggings": {
    "family": "leather",
    "slot": "legs",
    "primary": "hide",
    "fixed": null,
    "secondary": null
  },
  "boots": {
    "family": "leather",
    "slot": "feet",
    "primary": "hide",
    "fixed": null,
    "secondary": null
  },
  "shoes": {
    "family": "leather",
    "slot": "feet",
    "primary": "hide",
    "fixed": null,
    "secondary": null
  },
  "belt": {
    "family": "leather",
    "slot": "belt",
    "primary": "hide",
    "fixed": null,
    "secondary": null
  },
  "studded_gorget": {
    "family": "studded",
    "slot": "neck",
    "primary": "hide",
    "fixed": null,
    "secondary": "metal"
  },
  "studded_tunic": {
    "family": "studded",
    "slot": "chest",
    "primary": "hide",
    "fixed": null,
    "secondary": "metal"
  },
  "studded_sleeves": {
    "family": "studded",
    "slot": "arms",
    "primary": "hide",
    "fixed": null,
    "secondary": "metal"
  },
  "studded_gloves": {
    "family": "studded",
    "slot": "hands",
    "primary": "hide",
    "fixed": null,
    "secondary": "metal"
  },
  "studded_leggings": {
    "family": "studded",
    "slot": "legs",
    "primary": "hide",
    "fixed": null,
    "secondary": "metal"
  },
  "bone_helm": {
    "family": "bone",
    "slot": "head",
    "primary": "fixed",
    "fixed": "bone",
    "secondary": null
  },
  "bone_chest": {
    "family": "bone",
    "slot": "chest",
    "primary": "fixed",
    "fixed": "bone",
    "secondary": null
  },
  "bone_arms": {
    "family": "bone",
    "slot": "arms",
    "primary": "fixed",
    "fixed": "bone",
    "secondary": null
  },
  "bone_gloves": {
    "family": "bone",
    "slot": "hands",
    "primary": "fixed",
    "fixed": "bone",
    "secondary": null
  },
  "bone_legs": {
    "family": "bone",
    "slot": "legs",
    "primary": "fixed",
    "fixed": "bone",
    "secondary": null
  },
  "ringmail_tunic": {
    "family": "ringmail",
    "slot": "chest",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "ringmail_sleeves": {
    "family": "ringmail",
    "slot": "arms",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "ringmail_gloves": {
    "family": "ringmail",
    "slot": "hands",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "ringmail_leggings": {
    "family": "ringmail",
    "slot": "legs",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "chain_coif": {
    "family": "chain",
    "slot": "head",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "chain_tunic": {
    "family": "chain",
    "slot": "chest",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "chain_leggings": {
    "family": "chain",
    "slot": "legs",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "plate_gorget": {
    "family": "plate",
    "slot": "neck",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "plate_chest": {
    "family": "plate",
    "slot": "chest",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "plate_arms": {
    "family": "plate",
    "slot": "arms",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "plate_gauntlets": {
    "family": "plate",
    "slot": "hands",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "plate_leggings": {
    "family": "plate",
    "slot": "legs",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "bascinet": {
    "family": "helm",
    "slot": "head",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "open_helm": {
    "family": "helm",
    "slot": "head",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "norse_helm": {
    "family": "helm",
    "slot": "head",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "closed_helm": {
    "family": "helm",
    "slot": "head",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "plate_helm": {
    "family": "helm",
    "slot": "head",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "great_helm": {
    "family": "helm",
    "slot": "head",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "dragon_helm": {
    "family": "dragon",
    "slot": "head",
    "primary": "fixed",
    "fixed": "dragonscale",
    "secondary": null
  },
  "dragon_chest": {
    "family": "dragon",
    "slot": "chest",
    "primary": "fixed",
    "fixed": "dragonscale",
    "secondary": null
  },
  "dragon_arms": {
    "family": "dragon",
    "slot": "arms",
    "primary": "fixed",
    "fixed": "dragonscale",
    "secondary": null
  },
  "dragon_gloves": {
    "family": "dragon",
    "slot": "hands",
    "primary": "fixed",
    "fixed": "dragonscale",
    "secondary": null
  },
  "dragon_legs": {
    "family": "dragon",
    "slot": "legs",
    "primary": "fixed",
    "fixed": "dragonscale",
    "secondary": null
  },
  "wooden_shield": {
    "family": "shield",
    "slot": "shield",
    "primary": "wood",
    "fixed": null,
    "secondary": null
  },
  "metal_shield": {
    "family": "shield",
    "slot": "shield",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "kite_shield": {
    "family": "shield",
    "slot": "shield",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "heater_shield": {
    "family": "shield",
    "slot": "shield",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "buckler": { "family": "shield", "slot": "shield", "primary": "wood", "fixed": null, "secondary": null },
  "garment": { "family": "cloth", "slot": "tunic", "primary": "fixed", "fixed": "cloth", "secondary": null },
  "ring": {
    "family": "jewelry",
    "slot": "ring",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "bracelet": {
    "family": "jewelry",
    "slot": "bracelet",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "necklace": {
    "family": "jewelry",
    "slot": "necklace",
    "primary": "metal",
    "fixed": null,
    "secondary": null
  },
  "buckler": {
    "family": "shield",
    "slot": "shield",
    "primary": "wood"
  },
  "garment": {
    "family": "cloth",
    "slot": "tunic",
    "fixed": "cloth"
  }
};
const COLORS={
  "iron": "#8e8f8a",
  "dull_copper": "#8a6646",
  "shadow_iron": "#45454c",
  "copper": "#c0603e",
  "bronze": "#c8963e",
  "golden": "#f2cc3a",
  "agapite": "#d09090",
  "verite": "#4aac62",
  "valorite": "#5a80d8",
  "mithril": "#c4d6ee",
  "pine": "#e2c486",
  "oak": "#8c5c32",
  "ash": "#bcb69c",
  "yew": "#9c4c2c",
  "heartwood": "#8c5cbc",
  "bloodwood": "#7c2024",
  "frostwood": "#9cd2f2",
  "regular": "#9a6a40",
  "thick": "#6e4a2c",
  "wolf": "#8c8a80",
  "spined": "#5a7a4a",
  "horned": "#a0603a",
  "troll": "#5e6e52",
  "barbed": "#6a3a5a",
  "dragon": "#8a2a22",
  "cloth": "#c8bca0",
  "bone": "#e0d6bc",
  "dragonscale": "#9a2c24"
};
const SLOTS=['head','neck','chest','arms','hands','legs','feet','shield','cloak','shirt','trousers','robe','tunic','belt','ring','bracelet','necklace'];
const METALS=['iron','dull_copper','shadow_iron','copper','bronze','golden','agapite','verite','valorite','mithril'];
function resolveGear(equip={},SF=null){
 const out={};for(const slot of SLOTS){const it=equip[slot];if(!it)continue;const id=typeof it==='string'?it:it.id, d=DEFINITIONS[id];if(!d||d.slot!==slot)continue;
 const primary=d.fixed||(SF?.matOf?.(it))||it.material||(d.primary==='metal'?'iron':d.primary==='hide'?'regular':d.primary==='wood'?'pine':'cloth');
 const secondary=it.sec||'iron';const color=m=>SF?.EQ?.matColor?.(m)||COLORS[m]||'#9aa0a8';
 const dyed=d.family==='cloth'&&typeof it.dye==='string'&&/^#[0-9a-f]{6}$/i.test(it.dye);
 out[slot]={id,family:d.family,material:primary,color:dyed?it.dye:color(primary),secondary,secColor:color(secondary),broken:it.cond===0||it.broken===true};
 }return out;
}
function appearanceKey(equip,SF=null){const g=resolveGear(equip,SF);return JSON.stringify(SLOTS.map(s=>g[s]?[g[s].id,g[s].material,g[s].secondary,g[s].color,g[s].secColor,g[s].broken]:null))}
function preset(family,material='iron'){const out={};for(const [id,d] of Object.entries(DEFINITIONS)){if(d.family===family&&['head','neck','chest','arms','hands','legs','feet'].includes(d.slot)&&!out[d.slot])out[d.slot]={id,material:d.primary==='hide'?(COLORS[material]&& !METALS.includes(material)?material:'regular'):material,sec:METALS.includes(material)?material:'iron'};}if(family==='plate')out.head={id:'plate_helm',material};return out;}
function armorPainter({line,ell,poly,add,v,mix,shade,depth,front,p,w}){
 const at=(a,x,y,z)=>add(a,v(x,y,z)), between=(a,b,t)=>mix(a,b,t), trim='#49382d', dark='#302821', bright='#d8d6ca';
 const details=(a,b,g,width)=>{let c=g.color,f=g.family,s='';const metal=['plate','helm','ringmail','chain','dragon','bone'].includes(f);
 if(f==='plate'||f==='helm'){for(const t of [.22,.52,.78]){const k=between(a,b,t);s+=ell(k,width*.49,1.05,shade(c,.7))+ell(at(k,-.35,0,.4),width*.43,.48,shade(c,1.35));}}
 else if(f==='chain'||f==='ringmail'){for(let i=1;i<=5;i++){let k=between(a,b,i/6);for(const x of [-.9,.9])s+=ell(at(k,x,0,0),.78,.65,shade(c,i%2?1.32:.58));}}
 else if(f==='studded'){for(let i=1;i<=4;i++)s+=ell(between(a,b,i/5),.67,.67,g.secColor);}
 else if(f==='bone'){for(const t of [.23,.52,.8])s+=ell(between(a,b,t),width*.42,1.35,shade(c,1.08));}
 else if(f==='dragon'){for(let i=1;i<=4;i++)s+=ell(between(a,b,i/5),width*.38,1.4,shade(c,i%2?1.28:.67));}
 else {s+=line(between(a,b,.12),between(a,b,.88),.65,shade(c,.65));}
 return s;};
 const limb=(a,b,g,width)=>g?line(a,b,width,g.color)+details(a,b,g,width):'';
 function torso(g){if(!g)return '';let c=g.color,f=g.family,top=(x,y)=>at(p.sh,x,y,0),bottom=(x,y)=>at(p.hip,x,y,0),y=front?3.5:-3.5;
 const W=w+(f==='plate'?1.0:.15), planes=[[[top(-W,-3.3),top(W,-3.3),bottom(W*.72,-3),bottom(-W*.72,-3)],.66,v(0,-3.3,0)],[[top(-W,3.3),top(W,3.3),bottom(W*.72,3),bottom(-W*.72,3)],1,v(0,3.3,0)],[[top(-W,-3.3),top(-W,3.3),bottom(-W*.72,3),bottom(-W*.72,-3)],1.13,v(-W,0,0)],[[top(W,-3.3),top(W,3.3),bottom(W*.72,3),bottom(W*.72,-3)],.82,v(W,0,0)]];
 let s=planes.sort((a,b)=>depth(a[2])-depth(b[2])).map(([q,k])=>poly(q,shade(c,k))).join('');
 const a=at(p.sh,0,y,-2),b=at(p.hip,0,y,1);
 if(f==='plate'){s+=poly([at(a,-W*.77,0,-1),at(a,0,.4,-5),at(a,W*.77,0,-1),at(b,W*.57,0,4),at(b,0,.4,1),at(b,-W*.57,0,4)],shade(c,1.16))+line(at(a,0,.5,-5),at(b,0,.5,4),.8,shade(c,1.5));for(let i=0;i<3;i++){const k=at(b,0,0,i*2);s+=line(at(k,-W*.64,0,0),at(k,W*.64,0,0),.85,shade(c,.63));}}
 else if(['ringmail','chain','studded','dragon','bone'].includes(f)){for(let i=0;i<5;i++)for(let j=-2;j<=2;j++){let k=at(between(a,b,(i+.5)/5),j*W/3,0,0);if(f==='bone')s+=line(at(k,-.8,0,0),at(k,.8,0,0),1.25,shade(c,1.14));else s+=ell(k,f==='ringmail'?1.05:.75,f==='dragon'?1.2:.68,f==='studded'?g.secColor:shade(c,(i+j)%2?1.32:.63));}}
 else{s+=line(at(a,-W*.7,0,0),at(b,W*.55,0,0),1.05,shade(c,.62));}
 return s+line(at(b,-W*.7,0,0),at(b,W*.7,0,0),1.9,trim);
 }
 function head(g,h){if(!g)return '';let c=g.color,id=g.id,y=front?3.9:-3.9,s='';
 if(g.family==='cloth'||g.family==='leather'){return ell(at(h,0,0,3),5.5,3.9,c)+line(at(h,-4,y,2),at(h,4,y,2),1.1,shade(c,.65));}
 if(id==='chain_coif'){s=ell(h,5.75,6.6,c);for(let z=-4;z<=5;z+=2)for(let x=-3;x<=3;x+=2)s+=ell(at(h,x,y,z),.65,.66,shade(c,(x+z)%4?1.28:.66));if(front)s+=ell(at(h,0,4,-.7),2.65,2.7,'#aa7853');return s;}
 const full=['closed_helm','plate_helm','great_helm','bone_helm','dragon_helm'].includes(id);
 s=ell(at(h,0,0,1.8),id==='great_helm'?6.4:5.7,full?6.6:4.7,c);
 s+=line(at(h,-4,y,4.2),at(h,4,y,4.2),1.1,shade(c,1.38));
 if(full){s+=poly([at(h,-4.7,y,2),at(h,4.7,y,2),at(h,4.0,y,-4.6),at(h,-4.0,y,-4.6)],shade(c,.91));if(front){s+=line(at(h,-3.4,y+.2,.6),at(h,3.4,y+.2,.6),1.35,dark);for(let i=-1;i<=1;i++)s+=ell(at(h,i*1.35,y+.3,-2.4),.38,.68,dark);}}
 else if(front){s+=line(at(h,-4.7,y,0),at(h,-4.2,y,-3),1.8,c)+line(at(h,4.7,y,0),at(h,4.2,y,-3),1.8,c);if(id==='norse_helm'||id==='bascinet')s+=line(at(h,0,y,3),at(h,0,y,-1.7),1.65,c);}
 if(id==='norse_helm'||id==='dragon_helm')s+=line(at(h,0,0,5),at(h,0,0,7),1.2,shade(c,1.22));
 return s;
 }
 function shield(g,h){if(!g)return '';const c=g.color,id=g.id, y=front?1:-1;let q=(x,z)=>at(h,x,y,z),s='';
 if(id==='kite_shield'||id==='heater_shield'){const pts=id==='kite_shield'?[q(-5,7),q(5,7),q(5,1),q(0,-12),q(-5,1)]:[q(-6,7),q(6,7),q(5,-3),q(0,-9),q(-5,-3)];s=poly(pts,shade(c,.77))+poly(pts.map(k=>between(h,k,.78)),c);}
 else{s=ell(h,id==='buckler'?4.5:6.5,id==='buckler'?4.5:7,c)+ell(h,id==='buckler'?3.5:5.1,id==='buckler'?3.5:5.7,shade(c,.81));}
 return s+ell(h,1.5,1.6,shade(c,1.45));
 }
 function outer(g){if(!g)return '';let c=g.color,y=front?4:-4;return poly([at(p.sh,-w*.75,y,-1),at(p.sh,w*.75,y,-1),at(p.hip,w*.65,y,-2),at(p.hip,-w*.65,y,-2)],c)+(g.id==='robe'?poly([at(p.hip,-w*.65,y,0),at(p.hip,w*.65,y,0),at(p.hip,w+2,y,-21),at(p.hip,-w-2,y,-21)],shade(c,.87)):'');}
 function cloak(g){if(!g)return '';let c=g.color,y=-4;return poly([at(p.sh,-w,y,0),at(p.sh,w,y,0),at(p.hip,w+3,y-3,-22),at(p.hip,-w-3,y-3,-22)],shade(c,.85))+line(at(p.sh,-w*.6,y,0),at(p.hip,-w*.55,y-2,-20),1,shade(c,1.22));}
 return {limb,torso,head,shield,outer,cloak,details};
}

function createRig(){
const DIRECTIONS=["S","SW","W","NW","N","NE","E","SE"],CELL={width:112,height:100,anchorX:56,anchorY:86};
const CLOTH={linen:"#ac9776",brown:"#78513a",charcoal:"#50504b",navy:"#3b5676",forest:"#4d6845",burgundy:"#823e38",purple:"#6d5279",ochre:"#a17b39",cream:"#c6bda5",black:"#393a39",teal:"#436b69",rust:"#95573c"};
const HAIR={black:"#302a25",brown:"#65452e",darkBrown:"#493327",blond:"#b69a58",auburn:"#914a32",grey:"#8b8981",white:"#c5c1b6"},SKIN={fair:"#ca9a72",tan:"#ac7854",olive:"#937450",brown:"#815338",deep:"#684333",drowned:"#7f8c7a"},HAIRSTYLES=["bald","cropped","short","parted","long","ponytail","bun","braid"],BEARDS=["none","stubble","goatee","short","full"];
const WEAPON_MAP={unarmed:["unarmed","fist"],sword:["slash1h","sword"],glaive:["polearm","halberd"],battleaxe:["chop2h","battleaxe"],hatchet:["chop2h","hatchet"],knife:["slash1h","dagger"],pickaxe:["chop1h","pickaxe"],hammer:["blunt2h","warhammer"],mace:["blunt1h","mace"],waraxe:["chop1h","axe"],dagger:["thrust1h","dagger"],kryss:["thrust1h","kryss"],spear:["thrust2h","spear"],shortbow:["bow","bow"],crossbow:["crossbow","crossbow"],heavycrossbow:["crossbow","heavycrossbow"],broadsword:["slash1h","broadsword"],katana:["slash1h","katana"],rapier:["thrust1h","rapier"],greatsword:["slash2h","greatsword"],axe:["chop1h","axe"],doubleaxe:["chop2h","doubleaxe"],warhammer:["blunt2h","warhammer"],maul:["blunt2h","maul"],club:["blunt1h","club"],shortspear:["thrust1h","shortspear"],halberd:["polearm","halberd"],bardiche:["polearm","bardiche"],staff:["staff","staff"],quarterstaff:["staff","quarterstaff"],bow:["bow","bow"],longbow:["bow","longbow"],wand:["cast1h","wand"],smithhammer:["smith","smithhammer"],fishingpole:["fish","fishingpole"],tongs:["smith","tongs"],tankard:["idle","tankard"],book:["idle","book"],basket:["idle","basket"],lantern:["idle","lantern"]};
const WEAPONS=Object.keys(WEAPON_MAP),ANIMATIONS={idle:4,walk:8,run:8,ready:4,unarmed:8,slash1h:8,slash2h:8,chop1h:8,chop2h:8,blunt1h:8,blunt2h:8,thrust1h:8,thrust2h:8,polearm:8,staff:8,bow:8,crossbow:8,cast1h:8,cast2h:8,caststaff:8,block:6,hit:4,death:8,corpse:1,mine:8,chopwood:8,smith:8,bandage:8,fish:8};
const NPC_PRESETS={guard:{cloth:"navy",outfit:"guard",weapon:"glaive"},blacksmith:{cloth:"brown",outfit:"apron",weapon:"smithhammer"},miner:{cloth:"charcoal",outfit:"apron",weapon:"pickaxe"},lumberjack:{cloth:"forest",weapon:"hatchet"},merchant:{cloth:"burgundy",style:"parted"},mage:{cloth:"purple",outfit:"robe",weapon:"staff"},healer:{cloth:"cream",outfit:"robe"},sailor:{cloth:"linen"},farmer:{cloth:"ochre"},villager:{cloth:"linen"},bandit:{cloth:"charcoal",outfit:"leather",weapon:"dagger"},ranger:{cloth:"forest",outfit:"leather",weapon:"shortbow"},innkeeper:{cloth:"brown",outfit:"apron"},priest:{cloth:"cream",outfit:"robe"},scribe:{cloth:"teal",outfit:"robe"}};
const attackForWeapon=w=>WEAPON_MAP[w]?.[0]||null;
const v=(x,y,z)=>[x,y,z],add=(a,b)=>a.map((x,i)=>x+b[i]),scale=(a,k)=>a.map(x=>x*k),mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t),unit=a=>scale(a,1/(Math.hypot(...a)||1)),seq=(a,t)=>{let u=Math.max(0,Math.min(a.length-1,t*(a.length-1))),i=Math.floor(u);return mix(a[i],a[Math.min(i+1,a.length-1)],u-i)};
const shade=(c,k)=>"#"+[1,3,5].map(i=>Math.max(0,Math.min(255,Math.round(parseInt(c.slice(i,i+2),16)*k))).toString(16).padStart(2,"0")).join(""),dark="#302821",steel="#a6aeb0",edge="#e0e0d3",wood="#775036";
function pose(ac,t){
 let hip=v(0,0,29),sh=v(0,0,48),head=v(0,0,56),feet=[v(-4,1,1),v(4,-1,1)],hands=[v(-10,1,28),v(10,1,28)],el=[v(-9,0,38),v(9,0,38)],axis=v(0,0,-1),q=Math.sin(t*Math.PI),p=Math.sin(t*2*Math.PI);
 if(ac==="idle"){sh[2]+=.35*p;head[2]+=.35*p}
 else if(ac==="walk"||ac==="run"){let stride=ac==="run"?12:7;feet=feet.map((f,i)=>v(f[0],p*stride*(i?1:-1),1+Math.max(0,p*(i?1:-1))*4));hands=hands.map((h,i)=>v(h[0],p*stride*(i?-1:1),29));sh[2]+=Math.abs(p);hip[2]+=Math.abs(p);head[2]+=Math.abs(p);if(ac==="run"){sh[1]=4;head[1]=6;el=[v(-9,-5,40),v(9,5,39)]}}
 else if(ac==="death"||ac==="corpse"){let f=ac==="corpse"?1:Math.min(1,t*1.35);hip=v(0,-5*f,29*(1-f)+3*f);sh=v(0,-19*f,48*(1-f)+5*f);head=v(0,-27*f,56*(1-f)+5*f);hands=[v(-11,-17*f,28*(1-f)+2*f),v(11,-15*f,28*(1-f)+2*f)];el=[v(-10,-13*f,38*(1-f)+3*f),v(10,-12*f,38*(1-f)+3*f)];feet=[v(-4,10*f,1),v(4,8*f,1)]}
 else{
 feet=[v(-5,5,1),v(5,-5,1)];let r=v(9,8,37),l=v(-8,7,35),a=v(0,.5,1);
 if(ac==="ready"||ac==="block"||ac==="hit"){l=v(-8,8,36);r=v(8,7,37);if(ac==="block")l=v(-3,13,44);if(ac==="hit"){sh[1]=-5*q;head[1]=-7*q}}
 else if(ac==="unarmed"){r=seq([v(9,8,38),v(8,3,43),v(2,20,43),v(8,7,38)],t);l=v(-7,9,40)}
 else if(["slash1h","slash2h","polearm","staff"].includes(ac)){r=seq([v(9,8,37),v(13,-6,51),v(8,0,49),v(-8,19,37),v(-12,10,32),v(9,8,37)],t);a=seq([v(0,1,1),v(.7,-.3,1),v(1,0,.4),v(-.8,1,-.2),v(-1,.3,-.4),v(0,1,1)],t)}
 else if(["chop1h","chop2h","blunt1h","blunt2h","mine","chopwood","smith"].includes(ac)){r=seq([v(9,7,36),v(8,-5,54),v(5,-4,57),v(5,20,29),v(7,14,24),v(9,7,36)],t);a=seq([v(0,.5,1),v(0,-.8,1),v(0,0,1),v(0,1,-.6),v(0,1,-.9),v(0,.5,1)],t)}
 else if(ac.startsWith("thrust")){r=seq([v(9,7,36),v(8,-3,38),v(4,24,39),v(9,7,36)],t);a=v(0,1,.08);sh[1]=3*q;head[1]=3*q}
 else if(ac==="bow"||ac==="crossbow"){l=v(-3,18,42);r=v(3,18-13*q,43);a=v(0,1,0)}
 else if(ac.startsWith("cast")){r=seq([v(9,3,32),v(8,9,43),v(12,6,56),v(4,19,47),v(9,3,32)],t);l=ac==="cast1h"?v(-8,3,30):seq([v(-9,3,32),v(-8,9,43),v(-12,6,56),v(-4,19,47),v(-9,3,32)],t);a=v(0,.2,1)}
 else if(ac==="bandage"){r=v(-1,11,34+4*q);l=v(-4,11,36)}
 else if(ac==="fish"){r=v(6,10,37+8*q);a=v(0,1,.8+q)}
 if(["slash2h","chop2h","blunt2h","thrust2h","polearm","staff","mine","chopwood","caststaff"].includes(ac)){l=add(r,scale(unit(a),-8));l[0]-=3}
 hands=[l,r];axis=unit(a);el=[mix(v(-11,1,39),l,.30),mix(v(11,1,39),r,.30)]
 }
 return {hip,sh,head,feet,hands,el,axis}
}
function frameSVG(o={}){
 const ac=ANIMATIONS[o.action]?o.action:"idle",n=ANIMATIONS[ac],f=Math.max(0,Math.min(n-1,Math.floor(o.frame||0))),t=n>1?f/(n-1):1,di=DIRECTIONS.includes(o.direction)?DIRECTIONS.indexOf(o.direction):7,angle=di*Math.PI/4,d=[-Math.sin(angle),Math.cos(angle)],s=[d[1],-d[0]],female=o.body==="female",w=female?5.8:7.2,p=pose(ac,t),hx=c=>typeof c==="string"&&/^#[0-9a-f]{6}$/i.test(c)?c:null,cloth=CLOTH[o.cloth]||hx(o.cloth)||CLOTH.linen,hair=HAIR[o.hair]||hx(o.hair)||HAIR.brown,skin=SKIN[o.skin]||hx(o.skin)||SKIN.fair,OV={},style=HAIRSTYLES.includes(o.style)?o.style:"short",outfit=o.equip?"tunic":(o.outfit||"tunic"),wp=WEAPON_MAP[o.weapon]?.[1]||"fist";for(const x of (o.overlays||[]))OV[x.id]=x.color||cloth;
 const proj=a=>[CELL.anchorX+a[0]*s[0]+a[1]*d[0],CELL.anchorY-a[2]+.45*(a[0]*s[1]+a[1]*d[1])],depth=a=>.45*(a[0]*s[1]+a[1]*d[1]),r=x=>Math.round(x*10)/10,pt=a=>proj(a).map(r).join(",");
 const line=(a,b,w,c)=>{let [x,y]=proj(a).map(r),[X,Y]=proj(b).map(r),g='<line x1="'+x+'" y1="'+y+'" x2="'+X+'" y2="'+Y+'" stroke-linecap="round" stroke="';return g+dark+'" stroke-width="'+(w+1.5)+'"/>'+g+c+'" stroke-width="'+w+'"/>'+g+shade(c,1.22)+'" stroke-width="'+Math.max(.5,w*.23)+'" transform="translate(-.45 -.45)"/>'};
 const poly=(ps,c)=>'<polygon points="'+ps.map(pt).join(" ")+'" fill="'+c+'" stroke="'+dark+'" stroke-width=".8" stroke-linejoin="round"/>',ell=(a,x,y,c)=>{let [X,Y]=proj(a).map(r);return '<ellipse cx="'+X+'" cy="'+Y+'" rx="'+x+'" ry="'+y+'" fill="'+c+'" stroke="'+dark+'" stroke-width=".7"/>'};
 const gear=resolveGear(o.equip||{},o.SF),front=d[1]>=0,faceY=front?3:-3,A=armorPainter({line,ell,poly,add,v,mix,shade,depth,front,p,w});
 let shapes=[],put=(z,a)=>shapes.push([z,a]);if(gear.cloak)put(front?-24:24,A.cloak(gear.cloak));for(let i=0;i<2;i++){let k=i?1:-1,h=add(p.hip,v(k*3.2,0,0)),f=p.feet[i],knee=mix(h,f,.53);knee[1]+=2;let pants=gear.trousers?.color||shade(cloth,.53),boot=gear.feet?.color||"#49382a",sh=add(p.sh,v(k*(w+.5),0,-1)),el=p.el[i],hand=p.hands[i];put(-12+depth(h),line(h,knee,female?5:5.8,pants)+line(knee,add(f,v(0,0,4)),4.8,shade(pants,.88))+line(add(f,v(0,0,4)),f,4.7,boot)+line(f,add(f,v(0,3,0)),5,boot)+A.limb(h,knee,gear.legs,6.5)+A.limb(knee,add(f,v(0,0,4)),gear.legs,5.6)+(gear.feet?A.limb(add(f,v(0,0,5)),f,gear.feet,5.4)+line(f,add(f,v(0,3,0)),5.4,gear.feet.color):""));put(depth(sh)*1.5+depth(hand)*.6+(k*s[1]>.05?2:-2),line(sh,el,4.7,gear.shirt?.color||(outfit==="guard"?"#81888a":shade(cloth,.91)))+line(el,hand,3.8,skin)+ell(hand,2,2.2,skin)+A.limb(sh,el,gear.arms,6.0)+A.limb(el,mix(el,hand,.85),gear.arms,5.1)+(gear.hands?A.limb(mix(el,hand,.77),hand,gear.hands,4.7)+ell(hand,2.2,2.35,gear.hands.color):"")+(OV.bracer&&!gear.hands?line(mix(el,hand,.42),mix(el,hand,.74),4.5,"#5e4330")+line(mix(el,hand,.5),mix(el,hand,.66),.6,"#8a6a48"):"")+(gear.bracelet?ell(mix(el,hand,.75),2.2,.7,gear.bracelet.color):"")+(gear.ring?ell(hand,.75,.75,gear.ring.color):""))}
 let top=(x,y)=>add(p.sh,v(x,y,0)),bottom=(x,y)=>add(p.hip,v(x,y,0)),planes=[[[top(-w,-2.8),top(w,-2.8),bottom(w*.72,-2.5),bottom(-w*.72,-2.5)],.74,v(0,-2.8,0)],[[top(-w,2.8),top(w,2.8),bottom(w*.72,2.5),bottom(-w*.72,2.5)],1,v(0,2.8,0)],[[top(-w,-2.8),top(-w,2.8),bottom(-w*.72,2.5),bottom(-w*.72,-2.5)],1.14,v(-w,0,0)],[[top(w,-2.8),top(w,2.8),bottom(w*.72,2.5),bottom(w*.72,-2.5)],.83,v(w,0,0)]];
 let tor=planes.sort((a,b)=>depth(a[2])-depth(b[2])).map(([ps,k])=>poly(ps,shade(outfit==="guard"?"#899092":gear.shirt?.color||cloth,k))).join("");tor+=line(add(p.hip,v(-w*.7,faceY,2)),add(p.hip,v(w*.7,faceY,2)),2.3,"#60442d");if(front)tor+=line(add(p.sh,v(-2,3,-1)),add(p.sh,v(0,3,-7)),1,shade(cloth,.57))+line(add(p.sh,v(2,3,-1)),add(p.sh,v(0,3,-7)),1,shade(cloth,1.23))+ell(add(p.hip,v(0,3,2)),1.5,1.1,"#b19b69");if(outfit==="robe")tor+=poly([add(p.hip,v(-w*.7,faceY,1)),add(p.hip,v(w*.7,faceY,1)),add(p.hip,v(w+2,faceY,-18)),add(p.hip,v(-w-2,faceY,-18))],shade(cloth,.91));if(outfit==="apron"&&front)tor+=poly([add(p.sh,v(-3,3.2,-4)),add(p.sh,v(3,3.2,-4)),add(p.hip,v(5,3.4,-12)),add(p.hip,v(-5,3.4,-12))],"#6b4a32");if(outfit==="leather"&&front)tor+=line(add(p.sh,v(-w+1,3,-1)),add(p.hip,v(w*.6,3,3)),3,"#583e2c");const fy=front?3.15:-3.15,hp=(x,z)=>add(p.hip,v(x,fy,z)),sp=(x,z)=>add(p.sh,v(x,fy,z));if(OV.dress)tor+=poly([hp(-w*.72,2),hp(w*.72,2),hp(w+2.6,-25),hp(-w-2.6,-25)],shade(OV.dress,.9))+line(hp(-w-2.4,-24.5),hp(w+2.4,-24.5),.8,shade(OV.dress,.6));else if(OV.skirt)tor+=poly([hp(-w*.72,2),hp(w*.72,2),hp(w+2,-17),hp(-w-2,-17)],shade(OV.skirt,.9))+line(hp(-w-1.8,-16.6),hp(w+1.8,-16.6),.8,shade(OV.skirt,.62));if(OV.vest)tor+=front?poly([sp(-w*.92,-.5),sp(-1.2,-.5),hp(-1.2,1.5),hp(-w*.7,1.5)],OV.vest)+poly([sp(1.2,-.5),sp(w*.92,-.5),hp(w*.7,1.5),hp(1.2,1.5)],OV.vest):poly([sp(-w*.92,-.5),sp(w*.92,-.5),hp(w*.7,1.5),hp(-w*.7,1.5)],OV.vest);tor+=A.torso(gear.chest)+A.outer(gear.robe)+A.outer(gear.tunic);const ty=front?4.2:-4.2,tp=(x,z)=>add(p.sh,v(x,ty,z)),th=(x,z)=>add(p.hip,v(x,ty,z));if(OV.trim&&(gear.tunic||gear.robe))tor+=line(th(-w*.6,-1.6),th(w*.6,-1.6),1.1,OV.trim)+line(tp(-w*.62,-1.2),tp(w*.62,-1.2),.9,OV.trim)+(gear.robe&&!gear.tunic?line(th(-w-1.2,-20),th(w+1.2,-20),1,OV.trim):"");if(OV.heraldry&&front)tor+=gear.tunic?poly([tp(-1.7,-4),tp(1.7,-4),tp(1.7,-8),tp(0,-9.6),tp(-1.7,-8)],OV.heraldry)+line(tp(0,-4.6),tp(0,-8.6),.7,shade(OV.heraldry,.55)):ell(tp(w*.45,-2.2),1.25,1.25,OV.heraldry);if(OV.apron_long&&front)tor+=poly([sp(-3.6,-3),sp(3.6,-3),hp(5.6,-15),hp(-5.6,-15)].map(q=>add(q,v(0,front?.7:-.7,0))),OV.apron_long)+line(hp(-w*.7,1.6),hp(w*.7,1.6),1,shade(OV.apron_long,.6));else if(OV.apron_short&&front)tor+=poly([hp(-5,1.5),hp(5,1.5),hp(5.6,-9),hp(-5.6,-9)].map(q=>add(q,v(0,.8,0))),OV.apron_short)+line(hp(-w*.7,1.8),hp(w*.7,1.8),1,shade(OV.apron_short,.6));else if((OV.apron_long||OV.apron_short)&&!front)tor+=line(hp(-w*.72,1.6),hp(w*.72,1.6),1,shade(OV.apron_long||OV.apron_short,.6))+line(hp(0,1.6),hp(-1.2,-3),.8,shade(OV.apron_long||OV.apron_short,.6));if(OV.sash)tor+=line(sp(-w*.75,-1),hp(w*.62,1),2.2,OV.sash)+(front?line(hp(w*.62,1),hp(w*.7,-5),1.6,OV.sash):"");if(OV.mantle)tor+=poly([sp(-w-1.3,1),sp(w+1.3,1),sp(w*.95,-7),sp(0,-8.5),sp(-w*.95,-7)],OV.mantle)+line(sp(-w*.95,-7),sp(w*.95,-7),.7,shade(OV.mantle,.6));if(OV.pouch)tor+=ell(add(p.hip,v(w*.68,front?2.4:-2.4,-1.2)),1.6,1.9,"#6a4a30");if(OV.wear)tor+=ell(sp(-w*.35,-6),1.1,.8,"rgba(48,36,26,.38)")+ell(hp(w*.3,-.5),1.4,.9,"rgba(48,36,26,.32)")+(front?poly([sp(w*.15,-9),sp(w*.45,-9),sp(w*.45,-11),sp(w*.15,-11)],shade(cloth,.72)):"");if(gear.neck)tor+=line(add(p.sh,v(-w*.5,faceY,0)),add(p.sh,v(w*.5,faceY,0)),3.1,gear.neck.color);if(gear.necklace&&front)tor+=line(add(p.sh,v(-2,3,-1)),add(p.sh,v(0,3,-5)),.8,gear.necklace.color)+line(add(p.sh,v(2,3,-1)),add(p.sh,v(0,3,-5)),.8,gear.necklace.color);if(gear.belt)tor+=line(add(p.hip,v(-w*.7,faceY,2)),add(p.hip,v(w*.7,faceY,2)),2.3,gear.belt.color);put(.3,tor);
 let h=p.head,ha=line(add(h,v(0,0,-7)),add(h,v(0,0,-3)),3.8,skin)+ell(h,female?4.7:5.1,6.1,skin);if(style!=="bald"&&!OV.hood&&(!gear.head||["cloth_cap","leather_cap","bascinet","open_helm","norse_helm"].includes(gear.head.id))){if(["long","braid","ponytail"].includes(style))ha=ell(add(h,v(0,-2,-4)),4.5,8,hair)+ha;if(["bun","ponytail"].includes(style))ha=ell(add(h,v(0,-4,1)),2.8,3.2,hair)+ha;ha+=ell(add(h,v(0,-.8,2.8)),5,style==="cropped"?2:3.3,hair)+line(add(h,v(-3,-.5,3)),add(h,v(2,-.5,4.6)),.9,shade(hair,1.35));if(!front)ha+=ell(add(h,v(0,-1,-.8)),4.7,4.6,hair);if(style==="parted"&&front)ha+=line(add(h,v(-2,2,4)),add(h,v(0,2,1)),1.6,hair);if(style==="braid")ha+=line(add(h,v(2,-3,-1)),add(h,v(2,-4,-12)),2.6,hair)}
 if(front){ha+=ell(add(h,v(-1.6,3,.1)),.5,.5,dark)+ell(add(h,v(1.6,3,.1)),.5,.5,dark)+line(add(h,v(0,3,-1)),add(h,v(0,4,-2)),.8,shade(skin,1.15));if(BEARDS.includes(o.beard)&&o.beard!=="none")ha+=ell(add(h,v(0,3,-3)),o.beard==="goatee"?1.5:3.1,o.beard==="full"?3:1.6,shade(hair,.82))}
 if(outfit==="guard")ha+=ell(add(h,v(0,0,3)),5.6,3.5,"#828b8d")+line(add(h,v(0,2,4)),add(h,v(0,3,-1)),1.4,edge);ha+=A.head(gear.head,h);if(OV.hood&&!gear.head){let hc=OV.hood,hd=ell(add(h,v(0,-1.2,.6)),6.2,7.6,shade(hc,.85));ha=front?hd+ha+ell(add(h,v(0,.6,4.6)),5.6,2.6,hc)+line(add(h,v(-4.6,1.8,1)),add(h,v(-4.2,1.6,-4)),1.6,hc)+line(add(h,v(4.6,1.8,1)),add(h,v(4.2,1.6,-4)),1.6,hc):ha+hd+line(add(h,v(0,-4.5,1)),add(h,v(0,-5.6,-6)),2.4,shade(hc,.7));}if(OV.headscarf&&!gear.head&&!OV.hood)ha+=ell(add(h,v(0,-.6,3)),5.5,3.4,OV.headscarf)+line(add(h,v(-4.2,front?2.4:-2.4,2)),add(h,v(4.2,front?2.4:-2.4,2)),.8,shade(OV.headscarf,.6))+(front?"":line(add(h,v(0,-4.4,1.5)),add(h,v(1.4,-5.4,-3)),1.5,OV.headscarf));if(OV.straw_hat&&!gear.head&&!OV.hood)ha+=ell(add(h,v(0,0,4.2)),9.4,3.3,"#b59b5a")+ell(add(h,v(0,0,6.2)),4.6,3,"#c6ad6a")+line(add(h,v(-4.4,0,4.6)),add(h,v(4.4,0,4.6)),.8,"#7a6232");if(OV.crest&&gear.head&&["helm","chain","plate","bone","dragon"].includes(gear.head.family))ha+=line(add(h,v(0,0,6.4)),add(h,v(0,-2.6,10.4)),2.1,OV.crest)+line(add(h,v(0,-2.6,10.4)),add(h,v(0,-4.6,8.4)),1.5,OV.crest);put(30+depth(h),ha);
 if(wp!=="fist"&&!["death","corpse","bandage"].includes(ac)){let g=ac==="bow"?p.hands[0]:p.hands[1],a=unit(p.axis),at=n=>add(g,scale(a,n)),c=unit(v(-a[2],.1,a[0]||.3)),art="";
 if(["bow","longbow"].includes(wp)){let L=wp==="longbow"?18:14,top=add(g,v(0,-2,L)),bot=add(g,v(0,-2,-L)),mid=add(g,v(0,3,0)),draw=ac==="bow"?p.hands[1]:g;art=line(top,mid,1.7,wood)+line(mid,bot,1.7,wood)+line(top,draw,.65,"#d1c5a5")+line(draw,bot,.65,"#d1c5a5");if(ac==="bow"&&t<.65)art+=line(draw,add(g,v(0,12,0)),.8,edge)}
 else if(wp==="book")art=poly([add(g,v(-2.2,1.2,2.6)),add(g,v(2.2,1.2,2.6)),add(g,v(2.2,1.2,-2.6)),add(g,v(-2.2,1.2,-2.6))],"#5a3826")+line(add(g,v(-2.1,1.6,2.4)),add(g,v(-2.1,1.6,-2.4)),.7,"#d8cba8");else if(wp==="tankard")art=ell(add(g,v(0,1,1)),2.1,2.6,"#7a5a38")+ell(add(g,v(0,1,3.2)),2,1,"#e6dcc2")+line(add(g,v(2,1,2)),add(g,v(2.8,1,0)),.8,"#5a4028");else if(wp==="basket")art=ell(add(g,v(0,1.5,-3)),4.2,2.8,"#9e7844")+line(add(g,v(-3.8,1.5,-1.6)),add(g,v(3.8,1.5,-1.6)),.9,"#6e5230")+ell(add(g,v(1,1.6,-1.2)),1.6,.8,"#9aa6a6");else if(wp==="tongs"){let c2=unit(v(-a[2],.1,a[0]||.3));art=line(at(-2),at(12),.9,steel)+line(add(at(-2),scale(c2,1.1)),add(at(12),scale(c2,1.6)),.9,shade(steel,.8))}else if(["crossbow","heavycrossbow"].includes(wp)){let L=wp==="heavycrossbow"?12:8;art=line(at(-6),at(13),3.2,wood)+line(add(at(7),v(-L,0,0)),at(10),1.9,steel)+line(at(10),add(at(7),v(L,0,0)),1.9,steel)+line(add(at(7),v(-L,0,0)),at(0),.7,edge)+line(at(0),add(at(7),v(L,0,0)),.7,edge)}
 else if(["dagger","kryss","sword","broadsword","katana","rapier","greatsword"].includes(wp)){let L={dagger:9,kryss:15,sword:20,broadsword:21,katana:23,rapier:22,greatsword:29}[wp],b=wp==="rapier"?1:wp==="broadsword"?2.5:1.7;art=line(at(-5),at(3),2.1,wood)+line(add(at(3),scale(c,-4)),add(at(3),scale(c,4)),1.7,steel)+poly([add(at(4),scale(c,-b)),at(L),add(at(4),scale(c,b))],steel)+line(at(5),at(L-1),.7,edge)}
 else{let L={axe:17,battleaxe:24,doubleaxe:24,mace:16,warhammer:24,maul:24,club:18,spear:33,shortspear:23,halberd:31,bardiche:30,staff:30,quarterstaff:28,wand:13,pickaxe:20,hatchet:15,smithhammer:13,fishingpole:36}[wp]||18;art=line(at(-Math.min(12,L*.38)),at(L),wp==="wand"?1.3:2.2,wood);
 if(["axe","battleaxe","doubleaxe","halberd","bardiche","hatchet","pickaxe"].includes(wp)){let tip=at(L-2),wing=wp==="pickaxe"?8:["battleaxe","doubleaxe"].includes(wp)?7:5;art+=poly([at(L-7),add(tip,scale(c,wing)),add(at(L+1),scale(c,wing)),at(L+1)],steel);if(["doubleaxe","pickaxe"].includes(wp))art+=poly([at(L-7),add(tip,scale(c,-wing)),add(at(L+1),scale(c,-wing)),at(L+1)],steel)}
 if(["spear","shortspear","halberd","bardiche"].includes(wp))art+=poly([add(at(L-6),scale(c,-2.3)),at(L+4),add(at(L-6),scale(c,2.3))],edge);
 if(["mace","club","maul","warhammer","smithhammer"].includes(wp))art+=line(add(at(L-2),scale(c,-3.3)),add(at(L-2),scale(c,3.3)),wp==="maul"?6:4.7,wp==="club"?wood:steel);
 if(["staff","wand"].includes(wp))art+=ell(at(L),1.8,2.1,"#b9a16c");if(wp==="fishingpole")art+=line(at(L),add(at(L),v(0,4,-14)),.6,"#b7b2a1")}
 put(depth(g)+7,art)}
 if((gear.shield||o.shield)&&!["death","corpse","bow","crossbow","slash2h","chop2h","blunt2h","thrust2h","polearm","staff","caststaff"].includes(ac)){let g=p.hands[0];put(depth(g)+8,gear.shield?A.shield(gear.shield,g):ell(g,5.6,7.4,"#68777a")+ell(g,4.3,6.1,"#7f6845")+ell(g,1.7,1.9,steel))}
 if(ac==="bandage")put(20,ell(p.hands[0],2.7,2.1,"#d8cbb1"));if(o.offProp==="lantern"&&!gear.shield&&!o.shield&&!["death","corpse"].includes(ac)){let g=p.hands[0];put(depth(g)+8,line(g,add(g,v(0,0,-3)),.7,"#3a3028")+poly([add(g,v(-1.6,0,-3)),add(g,v(1.6,0,-3)),add(g,v(1.6,0,-7.4)),add(g,v(-1.6,0,-7.4))],"#e0b860")+line(add(g,v(-1.7,0,-3)),add(g,v(1.7,0,-3)),.8,"#3a3028"))}
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+CELL.width+'" height="'+CELL.height+'" viewBox="0 0 '+CELL.width+' '+CELL.height+'">'+shapes.sort((a,b)=>a[0]-b[0]).map(x=>x[1]).join("")+'</svg>';
}
function atlasSVG(o={}){let ac=ANIMATIONS[o.action]?o.action:"idle",n=ANIMATIONS[ac],pieces=[];for(let row=0;row<16;row++)for(let f=0;f<n;f++){let svg=frameSVG({...o,body:row<8?"male":"female",direction:DIRECTIONS[row%8],action:ac,frame:f});pieces.push('<g transform="translate('+f*CELL.width+' '+row*CELL.height+')">'+svg.slice(svg.indexOf(">")+1,svg.lastIndexOf("</svg>"))+'</g>')}return '<svg xmlns="http://www.w3.org/2000/svg" width="'+n*CELL.width+'" height="'+16*CELL.height+'" viewBox="0 0 '+n*CELL.width+' '+16*CELL.height+'">'+pieces.join("")+'</svg>'}
async function svgToPNG(svg){let url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));try{let i=new Image();i.src=url;await i.decode();let c=document.createElement("canvas");c.width=i.naturalWidth;c.height=i.naturalHeight;c.getContext("2d").drawImage(i,0,0);return await new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(Error("PNG encode failed")),"image/png"))}finally{URL.revokeObjectURL(url)}}
const PROP_SHAPE={smith_hammer:"smithhammer",pickaxe:"pickaxe",hatchet:"hatchet",fishing_rod:"fishingpole",tankard:"tankard",book:"book",staff:"staff",basket:"basket",bow:"bow",knife:"dagger",tongs:"tongs"};
function fromDescriptor(D,extra={}){const equip={};for(const s in D.pieces)equip[s]=D.pieces[s];if(D.shield)equip.shield={id:D.shield.id,material:D.shield.material};
 let weapon=D.weapon?(WEAPON_MAP[D.weapon.id]?D.weapon.id:null):null;if(!weapon&&D.prop&&PROP_SHAPE[D.prop])weapon=PROP_SHAPE[D.prop];
 return Object.assign({equip,body:D.body,skin:D.skin,hair:D.hair,style:D.style,beard:D.beard,cloth:D.palette&&D.palette.p,weapon:weapon||"unarmed",overlays:D.overlays,offProp:D.offProp},extra)}
return {VERSION:"2.1.0-shardfall-1.1",PROP_SHAPE,fromDescriptor,DIRECTIONS,CELL,CLOTH,HAIR,SKIN,HAIRSTYLES,BEARDS,WEAPONS,WEAPON_MAP,ANIMATIONS,NPC_PRESETS,attackForWeapon,frameSVG,atlasSVG,svgToPNG};
}

const RIG = createRig(); RIG.DEFINITIONS = DEFINITIONS; RIG.COLORS = COLORS; RIG.SLOTS = SLOTS; RIG.resolveGear = resolveGear; RIG.appearanceKey = appearanceKey;
(root.SF || (root.SF = {})).RIG = RIG;
if (typeof module !== 'undefined' && module.exports) module.exports = RIG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
</script>
