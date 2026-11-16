import fs from 'node:fs/promises';
import {makeLevelFromCells} from '../assets/scripts/color-clear/ColorClearLevels.ts';
import {encodeLevel,decodeLevel} from '../assets/scripts/color-clear/ColorClearLevelData.ts';
export async function buildWizardPreset(){const source=JSON.parse(await fs.readFile(new URL('../preview/color-clear/ready/wizard-cells.json',import.meta.url),'utf8'));if(source.cells.length<600||source.cells.length>700)throw Error('法师鸭必须保持600–700块');const level=makeLevelFromCells(source.cells,{id:1003,name:'法师鸭',difficulty:'normal'}),data={...JSON.parse(encodeLevel(level)),palette:source.palette};decodeLevel(data);await fs.writeFile(new URL('../preview/color-clear/ready/wizard-level.json',import.meta.url),JSON.stringify(data)+'\n');return data;}
if(process.argv[1]?.endsWith('/build-wizard.mjs'))console.log('Verified wizard pieces:',(await buildWizardPreset()).level.cells.length);
