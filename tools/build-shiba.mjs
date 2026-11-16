import fs from 'node:fs/promises';
import {buildShibaCells,buildShibaSurface,writeShibaGlb,SHIBA_PALETTE} from '../preview/color-clear/shiba.js';
import {makeLevelFromCells} from '../assets/scripts/color-clear/ColorClearLevels.ts';
import {encodeLevel,decodeLevel} from '../assets/scripts/color-clear/ColorClearLevelData.ts';
export async function buildShibaPreset(){const level=makeLevelFromCells(buildShibaCells(400),{id:1002,name:'柴犬团子',difficulty:'normal'}),data={...JSON.parse(encodeLevel(level)),palette:SHIBA_PALETTE};decodeLevel(data);await fs.writeFile(new URL('../preview/color-clear/ready/level.json',import.meta.url),JSON.stringify(data)+'\n');return level.cells.length;}
if(process.argv[1]?.endsWith('/build-shiba.mjs')){console.log('Generated verified shiba pieces:',await buildShibaPreset());if(process.argv[2]){await fs.writeFile(process.argv[2],writeShibaGlb(buildShibaSurface()),{flag:'wx'});console.log('Wrote closed GLB:',process.argv[2]);}}
