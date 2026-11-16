import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { makeLevel } from '../assets/scripts/color-clear/ColorClearLevels.ts';
const url=process.env.COLOR_CLEAR_URL || 'http://127.0.0.1:4179/preview/color-clear.html';
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:430,height:932},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('color-clear.unlocked','3'));
 await page.goto(url+(url.includes('?')?'&':'?')+'autospin=0');await page.waitForFunction(()=>window.__colorClear?.snapshot().remaining>0);
 assert.equal(await page.locator('#world').evaluate(c=>!!c.getContext('webgl2')),true,'real WebGL2 context');
 await page.locator('[data-column="0"]').tap();
 assert.ok(await page.locator('#slots .capsule').first().evaluate(n=>n.getAnimations().length)>0,'capsule visibly travels into its reserved slot');
 await page.waitForFunction(()=>window.__colorClear.snapshot().shots>0);
 await page.locator('#pause').tap();const before=await page.evaluate(()=>window.__colorClear.snapshot());
 await page.waitForTimeout(350);assert.deepEqual(await page.evaluate(()=>window.__colorClear.snapshot()),before);
 await page.locator('#primary').tap();
 const stage=await page.locator('#stage').boundingBox();
 const yawBeforeDrag=(await page.evaluate(()=>window.__colorClear.snapshot())).yaw;
 await page.mouse.move(stage.x+stage.width*.4,stage.y+stage.height*.5);await page.mouse.down();await page.mouse.move(stage.x+stage.width*.75,stage.y+stage.height*.5,{steps:10});await page.mouse.up();
 const yawAtRelease=(await page.evaluate(()=>window.__colorClear.snapshot())).yaw;
 assert.notEqual(yawAtRelease,yawBeforeDrag,'drag changes real model orientation');
 await page.waitForTimeout(70);
 assert.notEqual((await page.evaluate(()=>window.__colorClear.snapshot())).yaw,yawAtRelease,'bounded release inertia continues briefly');
 await page.mouse.move(stage.x+stage.width*.4,stage.y+stage.height*.5);await page.mouse.down();await page.mouse.move(stage.x+stage.width*.5,stage.y+stage.height*.5,{steps:4});
 await page.dispatchEvent('#stage','pointercancel',{pointerId:1});await page.mouse.up();
 const cancelledYaw=(await page.evaluate(()=>window.__colorClear.snapshot())).yaw;await page.waitForTimeout(80);
 assert.equal((await page.evaluate(()=>window.__colorClear.snapshot())).yaw,cancelledYaw,'cancelled drag stops inertia');
 await page.locator('#pause').tap();await page.locator('#restart').tap();
 assert.equal((await page.evaluate(()=>window.__colorClear.snapshot())).shots,0);
 await page.screenshot({path:'/tmp/rose-color-clear-mobile.png'});
 // Play the first authored solution via actual UI, waiting for automatic fire.
 for(const action of makeLevel(1).solution){
  if((await page.evaluate(()=>window.__colorClear.snapshot())).phase==='won')break;
  await page.locator(`[data-column="${action.column}"]`).tap();
  await page.waitForFunction(()=>{const s=window.__colorClear.snapshot();return s.phase!=='playing'||s.slots.every(x=>x===null);},{},{timeout:15000});
 }
 assert.equal((await page.evaluate(()=>window.__colorClear.snapshot())).phase,'won');
 assert.equal(await page.locator('#dialog-title').innerText(),'清得漂亮！');
 await page.screenshot({path:'/tmp/rose-color-clear-win.png'});
 await page.locator('#primary').tap();assert.equal((await page.evaluate(()=>window.__colorClear.snapshot())).level,2);
 await page.locator('#album-button').tap();assert.ok(await page.locator('.album-card.collected[data-model="1"]').count()===1,'winning a real level records its model');await page.locator('#album-close').tap();
 await page.setViewportSize({width:390,height:667});await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.locator('[data-column="0"]').isVisible(),true);
 await page.screenshot({path:'/tmp/rose-color-clear-small.png'});
 await page.setViewportSize({width:1280,height:900});await page.waitForTimeout(150);
 await page.screenshot({path:'/tmp/rose-color-clear-desktop.png'});
 await page.locator('#pause').click();await page.locator('#level-select').click();await page.locator('#dialog-text button').nth(2).click();
 const box=await page.locator('#stage').boundingBox();
 for(const action of makeLevel(3).solution){
  const current=(await page.evaluate(()=>window.__colorClear.snapshot())).yaw;
  let delta=((action.yaw-current+Math.PI*3)%(Math.PI*2))-Math.PI;
  while(Math.abs(delta)>.00001){const step=Math.max(-.9,Math.min(.9,delta));const x=box.x+box.width/2,y=box.y+box.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+step/.012,y,{steps:3});await page.waitForTimeout(110);await page.mouse.up();delta-=step;}
  await page.locator(`[data-column="${action.column}"]`).click();
  await page.waitForFunction(()=>{const s=window.__colorClear.snapshot();return s.phase!=='playing'||s.slots.every(x=>x===null);},{},{timeout:15000});
  if(Number(await page.locator('#world').getAttribute('data-chain-events'))>0)break;
 }
 assert.ok(Number(await page.locator('#world').getAttribute('data-chain-events'))>0,'actual UI triggers chain clear');
 assert.ok(Number(await page.locator('#world').getAttribute('data-max-chain-range'))>0,'affected range was visible before trigger');
 await page.screenshot({path:'/tmp/rose-color-clear-chain.png'});
 assert.deepEqual(errors,[],'no runtime errors');
 console.log('PASS: WebGL2, capsule flight, tap/fire, drag rotation/inertia, pause/resume, restart, first-level victory, next level, chain/range preview, pointer cancellation and 3 viewport sizes.');
} finally {await browser.close();}
