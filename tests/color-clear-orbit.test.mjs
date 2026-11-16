import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as rules from '../assets/scripts/color-clear/ColorClearGame.ts';
import {makeLevel,makeRescueFixture} from '../assets/scripts/color-clear/ColorClearLevels.ts';
const c=(id,x,y,z,shape='box',color=0)=>({id,x,y,z,shape,color,core:false,alive:true});
const level=cells=>({id:1,name:'orbit',cells,supply:[[],[],[],[]],solution:[],initialYaw:.4,initialPitch:.24});
test('vertical orbit reveals horizontal enclosure and matches positive XYZ pitch',()=>{
 const target=c(0,0,0,0),cells=[target,c(1,-1,0,0),c(2,1,0,0),c(3,0,0,-1),c(4,0,0,1)];
 assert.equal(rules.canSeeCell(target,cells,0),false);
 assert.equal(rules.canSeeCell(target,cells,0,Math.PI/2),true);
 const above=c(5,0,1,0);
 assert.equal(rules.canSeeCell(target,[target,above],0,Math.PI/2),false);
 assert.equal(rules.canSeeCell(target,[target,above],0,-Math.PI/2),true);
 assert.deepEqual(rules.viewDirection(Math.PI/2,Math.PI/6).map(v=>Math.round(v*1e8)/1e8),[-.8660254,.5,0]);
});
test('orbit clamps pitch, freezes when paused and restores level initial view',()=>{
 const g=new rules.ColorClearGame(level([c(0,0,0,0)]));assert.equal(g.pitch,.24);
 g.rotate(.5,10);assert.equal(g.pitch,Math.PI/2);const yaw=g.yaw;
 g.pause();g.rotate(1,-10);g.tick(1);assert.equal(g.pitch,Math.PI/2);assert.equal(g.yaw,yaw);
 g.resume();g.rotate(0,-10);assert.equal(g.pitch,-Math.PI/2);g.restart();assert.equal(g.pitch,.24);assert.equal(g.yaw,.4);
 g.tick(.1);assert.equal(g.yaw,.4);assert.equal(g.pitch,.24);
});
test('all solid shapes block vertical rays at their true extent',()=>{
 const target=c(0,0,0,0);
 for(const shape of ['box','sphere','cylinder','hemisphere','wedge']) {
  const blocker=c(1,0,1,0,shape);assert.equal(rules.canSeeCell(target,[target,blocker],0,Math.PI/2),false,shape);
 }
 // Vertical diagonal misses the sphere/cylinder radius but passes through box/wedge extent.
 const yaw=-Math.PI/4,pitch=Math.atan(.51/Math.hypot(.49,1.49));
 const b=c(1,1,1,1);
 assert.equal(rules.canSeeCell(target,[target,b],yaw,pitch),false);
 assert.equal(rules.canSeeCell(target,[target,{...b,shape:'sphere'}],yaw,pitch),true);
});
test('reachability preserves top openings and proves sealed box shells',()=>{
 const target=c(0,0,0,0,'box',1),ring=[c(1,-1,0,0),c(2,1,0,0),c(3,0,0,-1),c(4,0,0,1)];
 assert.ok(rules.reachableColors([target,...ring]).has(1));
 assert.equal(rules.reachableColors([target,...ring,c(5,0,1,0),c(6,0,-1,0)]).has(1),false);
 // A tiny slit between almost touching blockers must never be declared sealed.
 assert.ok(rules.reachableColors([target,...ring,c(5,0,1.000001,0),c(6,0,-1,0)]).has(1));
});
test('levels start tilted and rescue remains a genuine full-orbit deadlock',()=>{
 assert.equal(makeLevel(1).initialPitch,.24);const l=makeRescueFixture(),g=new rules.ColorClearGame(l);
 for(let i=0;i<4;i++)g.select(i);g.tick(.1);assert.equal(g.phase,'lost');
 assert.equal(g.supply[0][0].ammo,l.cells.length-1);
});
test('rescue supply clears the entire six-face shell before reserve finishes the centre',()=>{
 const g=new rules.ColorClearGame(makeRescueFixture());
 for(let i=0;i<4;i++)g.select(i);g.tick(.1);
 const ticket=g.beginReward('continue');assert.ok(ticket);assert.equal(g.resolveReward(ticket,true),true);
 assert.equal(g.select(0),true);
 for(const [yaw,pitch] of [[0,0],[Math.PI/2,0],[Math.PI,0],[Math.PI*1.5,0],[0,Math.PI/2],[0,-Math.PI/2]]){
  g.rotate(yaw-g.yaw,pitch-g.pitch);for(let i=0;i<10;i++)g.tick(.1);
 }
 assert.equal(g.remaining,1);assert.equal(g.cells[0].alive,true);assert.equal(g.phase,'playing');
 assert.equal(g.takeReserve(0),true);for(let i=0;i<10;i++)g.tick(.1);assert.equal(g.phase,'won');
});
