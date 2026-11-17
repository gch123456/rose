import fs from 'node:fs/promises';
import {buildWizardPreset,wizardFingerprint} from './build-wizard.mjs';
import {planShuffledLevel} from '../assets/scripts/color-clear/ColorClearLevels.ts';
import {decodeLevel,encodeLevel} from '../assets/scripts/color-clear/ColorClearLevelData.ts';
const base=await buildWizardPreset(),variants=[];
for(let seed=20261117;variants.length<4&&seed<20261149;seed++){
 try{const level=planShuffledLevel(base.level,seed);const heads=level.supply.map(q=>q[0]?.color),visible=level.supply.flatMap(q=>q.slice(0,4));if(new Set(heads).size<2||new Set(visible.map(c=>c.color)).size<4)continue;decodeLevel(encodeLevel(level));variants.push({seed,supply:level.supply,replay:level.replay});console.log('Verified random queue',seed);}
 catch(error){console.log('Rejected candidate',seed,error.message);}
}
if(variants.length!==4)throw Error('无法生成足够的可通关随机队列');
await fs.writeFile(new URL('../preview/color-clear/ready/wizard-shuffles.json',import.meta.url),JSON.stringify({version:1,fingerprint:wizardFingerprint(base.level),variants})+'\n');
