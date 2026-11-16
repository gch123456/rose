import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const url=process.env.COLOR_CLEAR_URL||'http://127.0.0.1:4179/preview/color-clear.html';
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try{
 for(const touch of [true,false]){
  const context=await browser.newContext({viewport:{width:430,height:932},isMobile:touch,hasTouch:touch});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>window.__colorClear?.snapshot().remaining>0);
  if(touch)await page.locator('[data-column="1"]').tap({force:true});else await page.locator('[data-column="1"]').click();await page.waitForFunction(()=>window.__colorClear.snapshot().shots>0);
  const target=await page.locator('[data-column="2"]').boundingBox(),before=await page.evaluate(()=>{window.__pressedCapsule=document.querySelector('[data-column="2"]');return window.__colorClear.snapshot();});
  const cdp=await context.newCDPSession(page),x=target.x+target.width/2,y=target.y+target.height/2;
  if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});else{await page.mouse.move(x,y);await page.mouse.down();}
  // A real firing update occurs between physical press and release.
  await page.waitForFunction(shots=>window.__colorClear.snapshot().shots>shots,before.shots);
  const keptTarget=await page.evaluate(()=>window.__pressedCapsule.isConnected);
  if(touch)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();
  await page.waitForTimeout(30);
  const after=await page.evaluate(()=>window.__colorClear.snapshot());
  assert.equal(after.supply[2],before.supply[2]-1,`${touch?'touch':'mouse'} release must load capsule during firing; pressed target remained connected=${keptTarget}`);
  assert.equal(keptTarget,true,'ammo updates must not replace the pressed supply button');
  await context.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:667},isMobile:true,hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'?fixture=rescue');await page.waitForFunction(()=>window.__colorClear?.snapshot().remaining>0);
 await page.locator('[data-column="0"]').tap();
 // Hold the purely decorative flight over its starting point: it must not block the next real tap.
 await page.locator('#slots .capsule').first().evaluate(n=>{for(const a of n.getAnimations()){a.pause();a.currentTime=0;}});
 const before=(await page.evaluate(()=>window.__colorClear.snapshot())).supply[0];
 const rect=await page.locator('[data-column="0"]').boundingBox();await page.touchscreen.tap(rect.x+rect.width/2,rect.y+rect.height/2);
 assert.equal((await page.evaluate(()=>window.__colorClear.snapshot())).supply[0],before-1,'decorative flying capsule must not intercept the next capsule tap');
 await page.goto(url+'?fixture=rescue');await page.waitForFunction(()=>window.__colorClear?.snapshot().remaining>0);
 for(const col of [0,1,2,3])await page.locator(`[data-column="${col}"]`).tap();
 const filled=await page.evaluate(()=>window.__colorClear.snapshot());assert.equal(filled.slots.filter(Boolean).length,4);assert.equal(new Set(filled.slots.filter(Boolean).map(s=>s.id)).size,4);
 assert.deepEqual(errors,[]);console.log('PASS: touch/mouse press-release across live firing updates, animation pass-through, and four consecutive unique loads.');
}finally{await browser.close();}
