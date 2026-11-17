/** Randomize only between rounds; candidates are independently validated at build. */
export function chooseVariant(count,last=-1,random=Math.random){
 if(!Number.isInteger(count)||count<1||count>8)throw Error('随机队列数量无效');
 const choices=Array.from({length:count},(_,i)=>i).filter(i=>count===1||i!==last),r=random();
 if(!Number.isFinite(r)||r<0||r>=1)throw Error('随机数无效');return choices[Math.floor(r*choices.length)];
}
export function variantData(base,variant){
 if(!base?.level||!variant||!Array.isArray(variant.supply)||variant.supply.length!==4||!Array.isArray(variant.replay))throw Error('随机队列格式无效');
 return {...base,level:{...base.level,supply:structuredClone(variant.supply),replay:structuredClone(variant.replay),solution:[]}};
}
