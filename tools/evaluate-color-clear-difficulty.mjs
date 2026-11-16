import {writeFile, mkdir} from 'node:fs/promises';
import {makeLevel} from '../assets/scripts/color-clear/ColorClearLevels.ts';
import {getDifficultyProfile,measureLevel,simulatePolicy} from '../assets/scripts/color-clear/ColorClearDifficulty.ts';

const levels=Array.from({length:10},(_,i)=>{
 const level=makeLevel(i+1);
 return {id:level.id,name:level.name,profile:getDifficultyProfile(level.id),metrics:measureLevel(level),
  policies:['front-first','visible-first','seeded'].map(policy=>simulatePolicy(level,policy,20261116,1800))};
});
const report={version:1,notes:[
 'Profiles are design hypotheses; these measurements are not human win rates, completion times, or retention predictions.',
 'Witness replay loads one capsule at a time, uses at most four slots, and invokes no reward/continue API.',
 'witnessViewChanges counts chosen reference-view changes, not a proof that rotation is necessary.',
 'Policies rotate 0.035 radians and tick 0.2 seconds per step; max1800 ticks, seed20261116; timeout is not proof of unsolvability.',
 'meanQueueOptions counts distinct colors among available lane heads before each witness action. Color boundaries count adjacent lattice pairs.',
 'All colors/cores/queues are fixed at generation. No runtime adaptation, paid advantage, or forced ad is part of the witness.',
],levels};
const target=process.argv[2];
if(target){await mkdir(new URL('../docs/baselines/',import.meta.url),{recursive:true});await writeFile(target,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
