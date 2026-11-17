/** Reorders only unspent supply. Slots, active flights and cleared cells stay untouched. */
export function reorderRemainingSupply(game,random=Math.random){
 if(!['playing','paused'].includes(game.phase))return false;
 const items=game.supply.flat();if(items.length<2||new Set(items.map(c=>c.color)).size<2)return false;
 const shuffled=items.slice();for(let i=shuffled.length-1;i>0;i--){const r=random(),j=Math.floor(Math.max(0,Math.min(.999999,Number.isFinite(r)?r:0))* (i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 if(shuffled.every((c,i)=>c===items[i]))shuffled.push(shuffled.shift());
 const columns=game.supply.length;game.supply=Array.from({length:columns},(_,i)=>shuffled.filter((_,n)=>n%columns===i));return true;
}
