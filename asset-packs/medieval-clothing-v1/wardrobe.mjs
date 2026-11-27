// Shardfall Medieval Clothing v1.0.0. Original procedural art, cosmetic only.
export const VERSION='1.0.0';
export const GARMENTS=['shirt','trousers','waistcoat','tunic','dress','skirt','apron_short','apron_long','hood_up','hood_down','wool_cap','straw_hat','headscarf','sash','robe','cloak','pouch','tabard','heraldry','patch'];
export const FACTIONS={
 mynoc:['#bd913d','#514033','#e0c58b','hammers'],
 vespar:['#284663','#d6d1bd','#e0d6bc','bridge'],
 skara:['#3e573a','#786746','#c2b891','leaf'],
 moonglen:['#514269','#c8c5d0','#d9d3dc','crescent'],
 saltmarsh:['#783d37','#655443','#d8cbb1','anchor']
};
const recipe=(garments,primary,secondary,accent='#b49a67')=>({garments:garments.split(' '),primary,secondary,accent});
export const PRESETS={
 villager:recipe('shirt trousers tunic pouch','#a99778','#64513c'),
 laborer:recipe('shirt trousers tunic wool_cap patch','#847763','#57493b'),
 blacksmith:recipe('shirt trousers apron_long pouch','#a79a83','#62432c'),
 miner:recipe('shirt trousers waistcoat wool_cap patch pouch','#827a69','#6b4c32'),
 carpenter:recipe('shirt trousers apron_short pouch','#9a9978','#715038'),
 lumberjack:recipe('shirt trousers waistcoat wool_cap','#65734c','#6a4731'),
 fletcher:recipe('shirt trousers waistcoat pouch','#65734c','#9e8059'),
 tinker:recipe('shirt trousers apron_short wool_cap pouch','#94705a','#5e5044'),
 tailor:recipe('shirt trousers waistcoat apron_long','#795b72','#baa98b'),
 tanner:recipe('shirt trousers apron_long patch','#ad9872','#50372b'),
 fisher:recipe('shirt trousers wool_cap waistcoat','#536e70','#877453'),
 fishmonger:recipe('shirt trousers apron_short headscarf','#536e70','#a69c83'),
 sailor:recipe('shirt trousers waistcoat headscarf sash','#596b7c','#ad9673'),
 dockworker:recipe('shirt trousers waistcoat patch','#827763','#5e5044'),
 farmer:recipe('shirt trousers tunic straw_hat','#a8986e','#666743'),
 baker:recipe('shirt trousers apron_long wool_cap','#a89979','#d5c9ad'),
 cook:recipe('shirt trousers apron_short headscarf','#9c8464','#c7bca4'),
 innkeeper:recipe('shirt trousers waistcoat apron_short','#773d3b','#c4b49b'),
 tavern_staff:recipe('shirt trousers skirt apron_short','#8d655b','#c3b59b'),
 merchant:recipe('shirt trousers waistcoat sash pouch','#536679','#a17d51'),
 banker:recipe('shirt trousers robe sash pouch','#343f57','#9b6b49'),
 healer:recipe('shirt trousers robe pouch','#b5b69d','#6d826f'),
 herbalist:recipe('shirt trousers tunic cloak pouch','#6e8062','#9a8868'),
 alchemist:recipe('shirt trousers robe apron_short pouch','#657b77','#9e886e'),
 reagents:recipe('shirt trousers robe pouch','#77765b','#6d5040'),
 mage:recipe('shirt trousers robe hood_down sash','#635478','#a2968a'),
 scholar:recipe('shirt trousers robe waistcoat pouch','#56677b','#a89b81'),
 scribe:recipe('shirt trousers robe pouch','#557775','#c2b298'),
 priest:recipe('shirt trousers robe sash','#c0b49a','#977946'),
 ranger:recipe('shirt trousers waistcoat cloak pouch','#526743','#806544'),
 traveler:recipe('shirt trousers tunic cloak hood_down pouch','#777266','#73553b'),
 noble:recipe('shirt trousers robe sash cloak','#713f4d','#b69a62'),
 beggar:recipe('shirt trousers tunic cloak patch','#84796a','#534c42'),
 prisoner:recipe('shirt trousers tunic patch','#a39b88','#797166'),
 bandit:recipe('shirt trousers waistcoat sash patch','#77604e','#8d4737'),
 bandit_archer:recipe('shirt trousers waistcoat cloak patch','#596449','#6a503a'),
 highwayman:recipe('shirt trousers cloak hood_up sash','#514f4c','#72513f'),
 brigand:recipe('shirt trousers tabard patch sash','#6c5347','#893f39'),
 bandit_chief:recipe('shirt trousers cloak tabard sash','#743a40','#a68a60'),
 pirate:recipe('shirt trousers waistcoat headscarf sash','#526470','#8f4439'),
 deserter:recipe('shirt trousers tabard patch','#77766a','#695448'),
 cultist:recipe('shirt trousers robe hood_up sash','#48434e','#a29682'),
 rogue_mage:recipe('shirt trousers robe hood_down patch','#666d81','#84736a'),
 guard:recipe('shirt trousers tabard heraldry','#284663','#d6d1bd')
};
const aliases={smith:'blacksmith',armorer:'blacksmith',weaponsmith:'blacksmith',bowyer:'fletcher',weaver:'tailor',leatherworker:'tanner',ferryman:'sailor',dockhand:'dockworker',provisioner:'merchant',trader:'merchant',supplier:'merchant',mine_stores:'miner',reagent_vendor:'reagents',forester:'ranger',hunter:'ranger',archivist:'scholar',astronomer:'scholar',student:'scholar',monk:'priest',traveller:'traveler',refugee:'beggar',marauder:'brigand',smuggler:'pirate',mercenary:'deserter',necromancer:'cultist'};
const hex=(x,f)=>/^#[0-9a-f]{6}$/i.test(x||'')?x:f;
export function resolveWardrobe(input={}){
 const role=aliases[input.role]||input.role||'villager',missing=!Object.hasOwn(PRESETS,role),p=PRESETS[missing?'villager':role],f=role==='guard'&&Object.hasOwn(FACTIONS,input.faction)?FACTIONS[input.faction]:null;
 const source=input.garments??p.garments;
 if(!Array.isArray(source)||source.some(x=>!GARMENTS.includes(x)))throw Error('Unknown wardrobe garment');
 const garments=[...new Set(source)]; if(garments.includes('hood_up')){const i=garments.indexOf('hood_down');if(i>=0)garments.splice(i,1)}
 return {role,missing,missingFaction:role==='guard'&&!f,garments,primary:f?f[0]:hex(input.primary,p.primary),secondary:f?f[1]:hex(input.secondary,p.secondary),accent:f?f[2]:hex(input.accent,p.accent),heraldry:f?f[3]:null};
}
// Pose-local independent pieces; output grouped by phase, never changes equipment.
export function paintWardrobe(W,{line,ell,poly,add,v,shade,front,p,w,gear,action,skin}){
 const result={back:'',under:'',outer:'',head:''},g=new Set(W.garments),c=W.primary,b=W.secondary,a=W.accent;
 const H=(x,y,z)=>add(p.hip,v(x,y,z)),T=(x,y,z)=>add(p.sh,v(x,y,z)),Q=(x,y,z)=>add(p.head,v(x,y,z)),y=front?3.7:-3.7;
 const fold=(x1,z1,x2,z2,col)=>line(H(x1,y,z1),H(x2,y,z2),.65,col);
 const panel=(top,bottom,length,col)=>poly([H(-top,y,2),H(top,y,2),H(bottom,y,-length),H(-bottom,y,-length)],col);
 const torso=(width,col)=>poly([T(-width,y,-1),T(width,y,-1),H(width*.78,y,1),H(-width*.78,y,1)],col);
 const hem=(width,len,col)=>fold(-width,-len,width,-len,col);
 const longAllowed=!gear.robe&&!gear.tunic;
 if(g.has('cloak')&&!gear.cloak){
 const cy=front?-3.8:-4.1, cloth=poly([T(-w,cy,-1),T(w,cy,-1),H(w+2,cy,-20),H(-w-2,cy,-20)],shade(b,.83))+line(T(-w+1,cy,-2),H(-w,cy,-18),.8,shade(b,1.22));
 if(front)result.back+=cloth;else result.outer+=cloth;
 }
 if(g.has('waistcoat')&&!gear.chest){result.under+=torso(w-.4,b);if(front)result.under+=line(T(0,y,-2),H(0,y,1),1.2,c)+[0,4,8].map(z=>ell(H(.8,y,z+3),.55,.55,a)).join('')}
 if(g.has('tunic')&&longAllowed&&!gear.chest)result.under+=panel(w*.7,w,7,c)+hem(w-.5,6,shade(c,1.25));
 if(longAllowed&&!gear.chest){
 if(g.has('robe')||g.has('dress')){let k=g.has('dress')?w+3:w+1.5;result.outer+=torso(w,c)+panel(w*.68,k,22,c)+fold(-w*.3,0,-k*.5,-21,shade(c,.65))+fold(w*.22,0,k*.46,-21,shade(c,1.23))+hem(k-.5,21,b)}
 else if(g.has('skirt'))result.outer+=panel(w*.72,w+3,19,c)+fold(-1,0,-3,-18,shade(c,.65))+fold(1,0,4,-18,shade(c,1.22));
 if(front&&(g.has('apron_short')||g.has('apron_long'))){let len=g.has('apron_long')?20:11;result.outer+=poly([T(-3.2,y,-5),T(3.2,y,-5),H(5,y,-len),H(-5,y,-len)],b)+line(T(-3,y,-5),T(-w+1,y,0),.9,b)+line(T(3,y,-5),T(w-1,y,0),.9,b)+fold(-3,0,-3,-len+1,shade(b,1.25))}
 }
 if(g.has('tabard')&&longAllowed){result.outer+=torso(w*.56,c)+panel(w*.54,w*.63,12,c)+hem(w*.6,11,b)}
 if(g.has('hood_down')&&!gear.neck&&!gear.head)result.outer+=line(T(-w*.7,y,-1),T(w*.7,y,-1),3,b);
 if(g.has('sash')&&!gear.belt)result.outer+=line(H(-w*.73,y,3),H(w*.73,y,1),2.6,b);
 if(g.has('pouch')&&front)result.outer+=ell(H(w*.66,y,-1),2.3,3.0,'#61452f')+line(H(w*.66-1,y,0),H(w*.66+1,y,0),.8,'#b49561');
 if(g.has('patch')&&front&&!gear.chest)result.outer+=poly([H(-3,y,7),H(0,y,7),H(0,y,3),H(-3,y,3)],shade(b,.83));
 if(g.has('heraldry')&&front&&g.has('tabard')&&longAllowed){
 let z=9,L=(x,z,X,Z)=>line(H(x,y,z),H(X,y,Z),.75,a);
 const symbols={hammers:()=>L(-2,z-2,2,z+2)+L(2,z-2,-2,z+2)+L(-3,z+1,-1,z+3)+L(1,z+3,3,z+1),bridge:()=>L(-3,z-1,3,z-1)+L(-3,z-1,-3,z+2)+L(-3,z+2,3,z+2)+L(3,z+2,3,z-1)+L(0,z-1,0,z+2),leaf:()=>poly([H(0,y,z+3),H(2,y,z),H(0,y,z-3),H(-2,y,z)],a)+L(0,z-3,0,z+2),crescent:()=>ell(H(0,y,z),2.4,2.4,a)+ell(H(1,y,z+1),1.7,1.8,c),anchor:()=>L(0,z+3,0,z-3)+L(-2,z+1,2,z+1)+L(-3,z-1,-2,z-3)+L(-2,z-3,2,z-3)+L(2,z-3,3,z-1)};
 if(symbols[W.heraldry])result.outer+=symbols[W.heraldry]();
 }
 if(!gear.head){
 if(g.has('hood_up'))result.head+=ell(Q(0,0,1.8),6.1,7.3,b)+(front?ell(Q(0,3,-.6),3.7,4.2,skin):'');
 else if(g.has('straw_hat'))result.head+=ell(Q(0,0,3),8,2.3,'#a88a53')+ell(Q(0,0,5),4.8,3.1,'#bba16c')+line(Q(-4,1,3),Q(4,1,3),1.1,'#73573a');
 else if(g.has('wool_cap'))result.head+=ell(Q(0,0,3.2),5.5,3.5,b)+line(Q(-4,1,1.5),Q(4,1,1.5),1.1,shade(b,1.3));
 else if(g.has('headscarf'))result.head+=ell(Q(0,0,3.5),5.5,2.8,b)+poly([Q(3,-2,3),Q(6,-2,0),Q(3,-2,-4)],b);
 }
 return result;
}
