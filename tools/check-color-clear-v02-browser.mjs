import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const url=process.env.COLOR_CLEAR_URL||'http://127.0.0.1:4179/preview/color-clear.html';
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:390,height:667},isMobile:true,hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.waitForFunction(()=>window.__colorClear?.snapshot().remaining>0);
 assert.equal(await page.locator('#slots .slot').count(),6);assert.equal(await page.locator('#slots .slot').first().innerText(),'');
 assert.equal(await page.locator('.progress-track').isVisible(),false);assert.equal(await page.locator('#remaining').isVisible(),false);
 assert.equal(await page.locator('.background-art').isVisible(),true);
 assert.ok(await page.evaluate(()=>window.__colorClear.snapshot().shapes.some(s=>s!=='box')));
 await page.locator('[data-unlock="4"]').tap();assert.match(await page.locator('#reward-overlay').innerText(),/模拟广告/);
 const paused=await page.evaluate(()=>window.__colorClear.snapshot());await page.waitForTimeout(100);assert.deepEqual(await page.evaluate(()=>window.__colorClear.snapshot()),paused);
 await page.locator('#reward-cancel').tap();assert.equal((await page.evaluate(()=>window.__colorClear.snapshot())).slots.length,4);
 for(const slot of [4,5]){await page.locator(`[data-unlock="${slot}"]`).tap();await page.locator('#reward-complete').tap();}
 assert.equal((await page.evaluate(()=>window.__colorClear.snapshot())).slots.length,6);
 const before=(await page.evaluate(()=>window.__colorClear.snapshot())).remaining;await page.locator('[data-column="0"]').tap();
 await page.waitForFunction(()=>window.__colorClear.snapshot().flights>0);
 assert.ok(await page.locator('#projectiles circle').count()>0,'visible projectile travels from launcher');
 assert.equal((await page.evaluate(()=>window.__colorClear.snapshot())).remaining,before,'target waits for impact');
 const missing=await page.evaluate(()=>new Promise(resolve=>{let frames=0;const bad=[];function sample(){const n=window.__colorClear.snapshot().flights,drawn=document.querySelectorAll('#projectiles circle').length;if(n!==drawn)bad.push([n,drawn]);if(++frames<65)requestAnimationFrame(sample);else resolve(bad);}requestAnimationFrame(sample);}));
 assert.deepEqual(missing,[],'each pending shot stays visible until its actual impact');
 await page.locator('#pause').tap();await page.locator('[data-display="progress"]').tap();await page.locator('[data-display="remaining"]').tap();await page.locator('#primary').tap();
 assert.equal(await page.locator('.progress-track').isVisible(),true);assert.equal(await page.locator('#remaining').isVisible(),true);
 await page.screenshot({path:'/tmp/rose-v02-animal.png'});
 // A deterministic developer fixture exercises an actual deadlock and reward rescue through UI.
 await page.goto(url+'?fixture=rescue');await page.waitForFunction(()=>window.__colorClear?.snapshot().remaining>0);
 for(let i=0;i<4;i++)await page.locator(`[data-column="${i}"]`).tap();await page.waitForFunction(()=>window.__colorClear.snapshot().phase==='lost');
 const lost=await page.evaluate(()=>window.__colorClear.snapshot());await page.locator('#primary').tap();await page.locator('#reward-complete').tap();
 let revived=await page.evaluate(()=>window.__colorClear.snapshot());assert.equal(revived.phase,'playing');assert.equal(revived.remaining,lost.remaining);assert.equal(revived.reserve.length,4);assert.ok(revived.slots.every(s=>!s));
 assert.equal(await page.locator('[data-reserve]').count(),4);
 await page.locator('#pause').tap();await page.locator('[data-display="labels"]').tap();await page.locator('#primary').tap();await page.setViewportSize({width:320,height:568});await page.waitForTimeout(100);
 const supplyBounds=await page.locator('#supply').boundingBox(),footerBounds=await page.locator('footer').boundingBox();
 assert.ok(supplyBounds.y+supplyBounds.height<=568,'full supply remains onscreen with reserve and all HUD options');assert.ok(footerBounds.y+footerBounds.height<=568,'footer remains onscreen');
 await page.screenshot({path:'/tmp/rose-v02-small-reserve.png'});
 await page.locator('[data-column="0"]').tap();await page.waitForFunction(()=>window.__colorClear.snapshot().remaining<=2);
 for(let i=0;i<21;i++)await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>window.__colorClear.snapshot().remaining===1);
 await page.locator('[data-reserve="0"]').tap();await page.waitForFunction(()=>window.__colorClear.snapshot().phase==='won');
 await page.screenshot({path:'/tmp/rose-v02-rescue-win.png'});
 assert.deepEqual(errors,[]);console.log('PASS: minimal HUD, non-box animal, 4→5→6, simulated cancel/reward, projectile before impact, settings, deadlock, ammo-preserving rescue and victory.');
}finally{await browser.close();}
