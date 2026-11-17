import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLevelCells,makeLongBatchLevel} from '../assets/scripts/color-clear/ColorClearLevels.ts';
import {decodeLevel,encodeLevel} from '../assets/scripts/color-clear/ColorClearLevelData.ts';
const cell={id:7,x:0,y:0,z:0,color:2,core:false,alive:true,shape:'box'};
test('appearance survives validated interchange without changing logical ammo or legacy data',()=>{
 const tinted={...cell,visualTint:'#69b8d2',visualDetail:'eye'};
 const level=makeLongBatchLevel([tinted],{pacing:'fast'}),decoded=decodeLevel(encodeLevel(level));
 assert.equal(decoded.cells[0].visualTint,tinted.visualTint);
 assert.equal(decoded.cells[0].visualDetail,'eye');
 assert.equal(decoded.cells[0].color,2);assert.equal(decoded.supply.flat()[0].color,2);assert.equal(decoded.supply.flat()[0].ammo,1);
 assert.deepEqual(validateLevelCells([cell]),[cell]);
});
test('malformed visual tint or detail is rejected before model rendering',()=>{
 for(const visualTint of ['red','#fff','#12345678',null,4])assert.throws(()=>validateLevelCells([{...cell,visualTint}]),/外观/);
 assert.throws(()=>validateLevelCells([{...cell,visualDetail:'script'}]),/外观/);
});

test('display shades fall back to logical colors and removable marks use sparse owner IDs',async()=>{
 const {cellDisplayColor,createModelDetails}=await import('../preview/color-clear/model-appearance.js');
 assert.equal(cellDisplayColor(cell,['#000000','#ffffff','#123456']).getHexString(),'123456');
 assert.equal(cellDisplayColor({...cell,visualTint:'#abcdef'},[]).getHexString(),'abcdef');
 const cells=[{...cell,visualDetail:'eye'},{...cell,id:89,x:2,visualDetail:'bill'}];
 const marks=createModelDetails(cells);assert.ok(marks.length>=4);
 assert.deepEqual(new Set(marks.map(m=>m.userData.id)),new Set([7,89]));
 assert.equal(createModelDetails(cells,false).length,0);
 assert.equal(createModelDetails(cells.map(c=>({...c,alive:false}))).length,0);
});

test('wizard appearance keeps six bounded color families and attached face landmarks at both densities',async()=>{
 const fs=await import('node:fs/promises');
 for(const density of ['ultra','fine']){
  const data=JSON.parse(await fs.readFile(new URL(`../preview/color-clear/ready/wizard-${density}-cells.json`,import.meta.url),'utf8'));
  assert.ok(data.cells.length>=4000&&data.cells.length<=6000);
  assert.equal(data.palette.length,6);
  assert.equal(data.cells.filter(c=>c.visualDetail==='eye').length,2);
  assert.equal(data.cells.filter(c=>c.visualDetail==='bill').length,1);
  for(let color=0;color<6;color++){
   const tones=new Set(data.cells.filter(c=>c.color===color).map(c=>c.visualTint));
   assert.ok(tones.size>=2&&tones.size<=4);
   for(const tint of tones)assert.match(tint,/^#[0-9a-f]{6}$/);
  }
  const occupied=new Set(data.cells.map(c=>`${c.x},${c.y},${c.z}`));
  for(const c of data.cells.filter(c=>c.visualDetail))assert.ok(!occupied.has(`${c.x},${c.y},${c.z+1}`),'face accents own a front surface cell');
 }
});

test('cosmetic changes preserve the verified gameplay shuffle fingerprint',async()=>{
 const {wizardFingerprint}=await import('../tools/build-wizard.mjs');
 const level={cells:[cell],supply:[[{id:1,color:2,ammo:1}],[],[],[]],pacing:'fast'};
 assert.equal(wizardFingerprint(level),wizardFingerprint({...level,cells:[{...cell,visualTint:'#123456',visualDetail:'eye'}]}));
});

test('5950 comparison preset conserves six ammo colors and wins its four-slot replay',async()=>{
 const fs=await import('node:fs/promises');
 const data=JSON.parse(await fs.readFile(new URL('../preview/color-clear/ready/wizard-fine-level.json',import.meta.url),'utf8'));
 assert.equal(data.level.cells.length,5950);assert.equal(data.level.pacing,'fast');
 const level=decodeLevel(data);assert.equal(level.cells.length,5950);
 for(let color=0;color<6;color++)assert.equal(level.cells.filter(c=>c.color===color).length,level.supply.flat().filter(c=>c.color===color).reduce((n,c)=>n+c.ammo,0));
});
