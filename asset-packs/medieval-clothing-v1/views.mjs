import * as R from './world-rig.mjs';
import {resolveWardrobe,PRESETS,FACTIONS} from './wardrobe.mjs';
export {R,PRESETS,FACTIONS,resolveWardrobe};
// Same resolved appearance, resting SE pose. Scalable SVG prototype, not painted 384x512 art.
export function paperdollSVG(options={}){
 const svg=R.frameSVG({...options,direction:'SE',action:'idle',frame:0});
 return '<svg xmlns="http://www.w3.org/2000/svg" width="384" height="512" viewBox="0 0 384 512"><g transform="translate(-116 -20) scale(5.5)">'+svg.slice(svg.indexOf('>')+1,svg.lastIndexOf('</svg>'))+'</g></svg>';
}
export function frameSVG(options={}){return R.frameSVG(options)}
export function atlasSVG(options={}){return R.atlasSVG(options)}
export function appearanceKey(options={}){return JSON.stringify([options.body,options.skin,options.style,options.hair,options.beard,options.cloth,options.weapon,!!options.shield,options.wardrobe?resolveWardrobe(options.wardrobe):null,Object.entries(options.equip||{}).sort(([a],[b])=>a.localeCompare(b)).map(([slot,it])=>[slot,it.id,it.material,it.sec,it.cond===0])])}

// Transparent cosmetic-only frame or atlas. Export each depth phase separately for a layered compositor.
// Baseline shirt/trousers are inherited and cannot be exported as isolated cosmetic overlays yet.
export function garmentFrameSVG(garment,options={}){return R.frameSVG({...options,wardrobe:{...(options.wardrobe||{}),garments:[garment]},wardrobeOnly:true})}
export function garmentAtlasSVG(garment,options={}){return R.atlasSVG({...options,wardrobe:{...(options.wardrobe||{}),garments:[garment]},wardrobeOnly:true})}
