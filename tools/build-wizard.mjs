import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeLongBatchLevel} from '../assets/scripts/color-clear/ColorClearLevels.ts';
import {encodeLevel,decodeLevel} from '../assets/scripts/color-clear/ColorClearLevelData.ts';
/** Keep the same reference load order while making four lane heads informative. */
function spreadSupplyHeads(level){
 const queues=level.supply.map(q=>q.slice()),loads=[];
 for(const step of level.replay)if(step.column!==undefined){const capsule=queues[step.column].shift();if(!capsule)throw Error('Missing reference capsule');loads.push({step,capsule});}
 const colors=[...new Set(loads.map(x=>x.capsule.color))].slice(0,4),supply=[[],[],[],[]];
 for(const {step,capsule}of loads){let column=colors.indexOf(capsule.color);if(column<0)column=supply.reduce((best,q,i)=>q.length<supply[best].length?i:best,0);step.column=column;supply[column].push(capsule);}
 level.supply=supply;
}
export async function buildWizardPreset(){
 const source=JSON.parse(await fs.readFile(new URL('../preview/color-clear/ready/wizard-hd-cells.json',import.meta.url),'utf8'));
 if(source.cells.length<2800||source.cells.length>3500)throw Error('高清法师鸭应为约3000块');
 const level=makeLongBatchLevel(source.cells,{id:1003,name:'法师鸭',difficulty:'normal',batchSize:75,pacing:'remaining'});
 spreadSupplyHeads(level);level.initialYaw=.1;level.initialPitch=.12;
 const data={...JSON.parse(encodeLevel(level)),palette:source.palette};decodeLevel(data);
 await fs.writeFile(new URL('../preview/color-clear/ready/wizard-level.json',import.meta.url),JSON.stringify(data)+'\n');return data;
}
if(process.argv[1]?.endsWith('/build-wizard.mjs'))console.log('Verified wizard pieces:',(await buildWizardPreset()).level.cells.length);

export function wizardFingerprint(level){return createHash('sha256').update(JSON.stringify({cells:level.cells,caps:level.supply.flat().slice().sort((a,b)=>a.id-b.id),pacing:level.pacing})).digest('hex');}
