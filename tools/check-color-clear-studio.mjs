import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {BoxGeometry} from 'three';
function cubeGlb(external=false,huge=false,duplicate=false){
 const geo=new BoxGeometry(2,2,2),positions=new Float32Array(geo.attributes.position.array),indices=new Uint16Array(geo.index.array),bin=Buffer.concat([Buffer.from(positions.buffer),Buffer.from(indices.buffer)]);
 const json={asset:{version:'2.0'},buffers:[{byteLength:bin.length,...(external?{uri:'https://example.com/remote.bin'}:{})}],bufferViews:[{buffer:0,byteOffset:0,byteLength:positions.byteLength},{buffer:0,byteOffset:positions.byteLength,byteLength:indices.byteLength}],accessors:[{bufferView:0,componentType:5126,count:positions.length/3,type:'VEC3',min:[-1,-1,-1],max:[1,1,1]},{bufferView:1,componentType:5123,count:indices.length,type:'SCALAR'}],materials:[{pbrMetallicRoughness:{baseColorFactor:[.9,.65,.2,1]}}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1,material:0}]}],nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0};
 if(duplicate)json.scenes[0].nodes=[0,0];if(huge){json.accessors[0].count=100000000;delete json.accessors[0].bufferView;}let data=Buffer.from(JSON.stringify(json));data=Buffer.concat([data,Buffer.alloc((4-data.length%4)%4,32)]);const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+data.length+bin.length,8);header.writeUInt32LE(data.length,12);header.writeUInt32LE(0x4e4f534a,16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length,0);bh.writeUInt32LE(0x004e4942,4);return Buffer.concat([header,data,bh,bin]);
}
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4179/preview/level-studio.html');
 await page.waitForFunction(()=>window.__levelStudio?.snapshot().ready);
 assert.equal(await page.locator('#ai-generate').isDisabled(),true);
 await page.locator('#reference-file').setInputFiles({name:'reference.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('PNG'));
 await page.locator('#generate').click();await page.waitForFunction(()=>window.__levelStudio.snapshot().valid,{},{timeout:60000});
 const s=await page.evaluate(()=>window.__levelStudio.snapshot());assert.ok(s.cells>=150&&s.cells<=800);assert.ok(s.ledger.every(r=>r.cells===r.ammo));
 const png=await page.screenshot({clip:{x:0,y:0,width:2,height:2}});await page.locator('#reference-file').setInputFiles({name:'reference.png',mimeType:'image/png',buffer:png});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('参考图已保存'));assert.equal((await page.evaluate(()=>window.__levelStudio.snapshot())).cells,s.cells);
 await page.locator('#count').fill('600');await page.locator('#count').dispatchEvent('input');await page.locator('#generate').click();await page.waitForFunction(()=>window.__levelStudio.snapshot().valid,{},{timeout:60000});assert.ok((await page.evaluate(()=>window.__levelStudio.snapshot())).cells>s.cells,'more target blocks increase actual density');
 await page.locator('#count').fill('400');await page.locator('#count').dispatchEvent('input');await page.locator('#generate').click();await page.waitForFunction(()=>window.__levelStudio.snapshot().valid,{},{timeout:60000});
 const download=page.waitForEvent('download');await page.locator('#export-level').click();const exported=await download;assert.match(exported.suggestedFilename(),/\.json$/);const exportedData=await fs.readFile(await exported.path());
 await page.locator('#level-file').setInputFiles({name:'level.json',mimeType:'application/json',buffer:exportedData});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('关卡校验通过'));
 await page.locator('#sample').selectOption('bunny');
 const projectDownload=page.waitForEvent('download');await page.locator('#save-project').click();const projectData=await fs.readFile(await (await projectDownload).path());
 await page.locator('#load-sample').click();
 await page.locator('#project-file').setInputFiles({name:'project.json',mimeType:'application/json',buffer:projectData});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('工程已恢复'));
 const againDownload=page.waitForEvent('download');await page.locator('#save-project').click();assert.equal(JSON.parse(await fs.readFile(await (await againDownload).path(),'utf8')).sample,null,'restored external project remains external');
 assert.equal(JSON.parse(projectData).sample,null,'level-only import must not claim unrelated sample provenance');
 const oldCells=(await page.evaluate(()=>window.__levelStudio.snapshot())).cells;
 await page.locator('#model-file').setInputFiles({name:'bad.glb',mimeType:'model/gltf-binary',buffer:cubeGlb(true)});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('自包含'));assert.equal((await page.evaluate(()=>window.__levelStudio.snapshot())).cells,oldCells);
 await page.locator('#model-file').setInputFiles({name:'huge.glb',mimeType:'model/gltf-binary',buffer:cubeGlb(false,true)});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('访问器'));assert.equal((await page.evaluate(()=>window.__levelStudio.snapshot())).cells,oldCells);
 await page.locator('#model-file').setInputFiles({name:'duplicate.glb',mimeType:'model/gltf-binary',buffer:cubeGlb(false,false,true)});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('根节点'));assert.equal((await page.evaluate(()=>window.__levelStudio.snapshot())).cells,oldCells);
 await page.locator('#model-file').setInputFiles({name:'cube.glb',mimeType:'model/gltf-binary',buffer:cubeGlb()});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('模型已导入'));
 await page.locator('#generate').click();await page.waitForFunction(()=>window.__levelStudio.snapshot().valid,{},{timeout:60000});
 const cube=await page.evaluate(()=>window.__levelStudio.snapshot());assert.ok(cube.cells>200);assert.equal(cube.ledger.length,1);assert.equal(cube.ledger[0].ammo,cube.cells);
 await page.locator('#level-file').setInputFiles({name:'level.json',mimeType:'application/json',buffer:exportedData});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('关卡校验通过'));
 await page.screenshot({path:'/tmp/rose-level-studio-desktop.png'});
 await page.locator('#play').click();await page.waitForURL(/color-clear.html.*studio=1/);await page.waitForFunction(()=>window.__colorClear?.snapshot().remaining>0);
 assert.equal((await page.evaluate(()=>window.__colorClear.snapshot())).remaining,s.cells);
 assert.ok((await page.locator('h1').innerText()).includes('试玩'));
 await page.goBack();await page.waitForFunction(()=>window.__levelStudio?.snapshot().ready);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'/tmp/rose-level-studio.png',fullPage:true});assert.deepEqual(errors,[]);
 const sparse=await browser.newPage({viewport:{width:430,height:932}});sparse.on('pageerror',e=>errors.push(e.message));await sparse.addInitScript(()=>sessionStorage.setItem('color-clear.studio-level',JSON.stringify({data:{version:1,level:{id:1001,name:'非连续ID测试',cells:[{id:100,x:0,y:0,z:0,color:0,core:true,alive:true,shape:'box'}],supply:[[{id:0,color:0,ammo:1}],[],[],[]],initialYaw:0,initialPitch:0,solution:[{column:0,yaw:0}]}},palette:['#ec8068','#e9b842']})));
 await sparse.goto('http://127.0.0.1:4179/preview/color-clear.html?studio=1&autospin=0');await sparse.waitForFunction(()=>window.__colorClear?.snapshot().remaining===1);await sparse.locator('[data-column="0"]').click();await sparse.waitForFunction(()=>window.__colorClear.snapshot().phase==='won');assert.deepEqual(errors,[],'valid sparse IDs do not crash renderer');await sparse.close();
 console.log('PASS: private studio, honest AI boundary, bad input, sample voxelization, ammo ledger, export and isolated playable level; narrow layout.');
}finally{await browser.close();}
