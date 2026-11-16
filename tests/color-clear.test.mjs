import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ColorClearGame, canSeeCell, reachableColors } from '../assets/scripts/color-clear/ColorClearGame.ts';
import { makeLevel, LEVEL_COUNT } from '../assets/scripts/color-clear/ColorClearLevels.ts';
const cell=(id,x,y,z,color,core=false)=>({id,x,y,z,color,core,alive:true});
const cap=(id,color,ammo=1)=>({id,color,ammo});
const level=(cells,supply)=>({id:1,name:'test',cells,supply,solution:[]});
const advance=g=>{for(let i=0;i<10;i++)g.tick(.1);};
test('front occlusion changes with rotation and prevents spending shots on hidden colours',()=>{
 const g=new ColorClearGame(level([cell(0,0,0,0,1),cell(1,0,0,1,0)],[[cap(0,1)],[],[],[]]));
 assert.equal(g.select(0),true);advance(g);assert.equal(g.slots[0].ammo,1);assert.equal(g.remaining,2);
 g.rotate(Math.PI);advance(g);assert.equal(g.remaining,1);assert.equal(g.slots[0],null);
});
test('four slots admit once and full slots never consume supply',()=>{
 const g=new ColorClearGame(level([cell(0,0,0,0,0)],Array.from({length:4},(_,i)=>[cap(i,0,3),cap(i+4,0,3)])));
 for(let i=0;i<4;i++)assert.equal(g.select(i),true);
 assert.equal(g.select(0),false);assert.equal(g.supply[0].length,1);assert.equal(new Set(g.slots.map(s=>s.id)).size,4);
});
test('empty slot can be refilled while another still fires; multiple slots never double-hit',()=>{
 const g=new ColorClearGame(level([cell(0,-1,0,0,0),cell(1,1,0,0,1)],[[cap(0,0)],[cap(1,1)],[],[]]));
 g.select(0);g.select(1);advance(g);assert.equal(g.remaining,0);assert.equal(g.phase,'won');
 assert.equal(g.drainEvents().filter(e=>e.type==='hit').length,2);
});
test('chain core removes marked neighbours once and triggers adjacent core',()=>{
 const g=new ColorClearGame(level([cell(0,0,0,0,0,true),cell(1,1,0,0,1,true),cell(2,2,0,0,2)],[[cap(0,0)],[],[],[]]));
 g.select(0);advance(g);assert.equal(g.remaining,0);assert.equal(g.phase,'won');
 assert.equal(g.drainEvents().filter(e=>e.type==='clear').length,3);
});
test('full slots with a target on the back remain playable',()=>{
 const cells=[cell(0,0,0,0,1),cell(1,0,0,1,0)];
 const g=new ColorClearGame(level(cells,Array.from({length:4},(_,i)=>[cap(i,1,2)])));
 for(let i=0;i<4;i++)g.select(i);advance(g);assert.equal(g.phase,'playing');
 g.rotate(Math.PI);advance(g);assert.equal(g.remaining,1);
});
test('all-angle enclosed colour with full slots is a genuine deadlock',()=>{
 const cells=[cell(0,0,0,0,1),cell(1,-1,0,0,0),cell(2,1,0,0,0),cell(3,0,0,-1,0),cell(4,0,0,1,0)];
 const g=new ColorClearGame(level(cells,Array.from({length:4},(_,i)=>[cap(i,1,2)])));
 for(let i=0;i<4;i++)g.select(i);advance(g);assert.equal(g.phase,'lost');assert.match(g.reason,/槽/);
});
test('diagonal openings count as reachable instead of sampling only cardinal directions',()=>{
 const cells=[cell(0,0,0,0,1),cell(1,-2,0,0,0),cell(2,2,0,0,0),cell(3,0,0,-2,0),cell(4,0,0,2,0)];
 assert.ok(reachableColors(cells).has(1));
 assert.equal(canSeeCell(cells[0],cells,Math.PI/4),true);
});
test('paused game rejects input and time; resume, restart and events stay isolated',()=>{
 const l=level([cell(0,0,0,0,0)],[[cap(0,0)],[],[],[]]);const g=new ColorClearGame(l);
 g.pause();assert.equal(g.select(0),false);g.rotate(1);g.tick(100);assert.equal(g.yaw,0);assert.equal(g.remaining,1);
 g.resume();g.select(0);advance(g);assert.equal(g.phase,'won');g.restart();assert.equal(g.phase,'playing');assert.equal(g.remaining,1);assert.equal(g.supply[0].length,1);assert.equal(g.slots.filter(Boolean).length,0);
});
test('invalid and huge delta times cannot create unlimited catch-up fire',()=>{
 const g=new ColorClearGame(makeLevel(1));g.select(0);const before=g.remaining;g.tick(NaN);g.tick(-1);assert.equal(g.remaining,before);
 g.tick(100);assert.ok(before-g.remaining<=12);
});
test('supply exhaustion loses with explanation and victory takes priority',()=>{
 const g=new ColorClearGame(level([cell(0,0,0,0,1)],[[cap(0,0)],[],[],[]]));
 g.select(0);advance(g);assert.equal(g.phase,'lost');assert.ok(g.reason.length>0);
});
test('ten deterministic levels have real depth, accessible targets and a winning solution',()=>{
 assert.equal(LEVEL_COUNT,10);
 for(let n=1;n<=LEVEL_COUNT;n++){
  const l=makeLevel(n),g=new ColorClearGame(l);assert.deepEqual(l,makeLevel(n));
  assert.ok(new Set(l.cells.map(c=>c.z)).size>1);assert.ok(l.cells.length>=30);
  for(const action of l.solution){g.rotate(action.yaw-g.yaw);assert.equal(g.select(action.column),true,`level ${n} select`);for(let k=0;k<600&&g.phase==='playing'&&g.slots.some(Boolean);k++)g.tick(.1);if(g.phase==='won')break;}
  assert.equal(g.phase,'won',`level ${n}: ${g.reason}; left ${g.remaining}`);
 }
});
test('positive model Y rotation matches camera at world +Z: model-local left is in front',()=>{
 const cells=[cell(0,0,0,0,0),cell(1,-1,0,0,1)];
 assert.equal(canSeeCell(cells[0],cells,Math.PI/2),false,'left cube moves toward +Z and occludes centre');
 assert.equal(canSeeCell(cells[0],cells,-Math.PI/2),true,'left cube moves behind centre');
});
test('chain preview includes recursive affected neighbours without changing model state',()=>{
 const cells=[cell(0,0,0,0,0,true),cell(1,1,0,0,1,true),cell(2,2,0,0,2),cell(3,4,0,0,2)];
 const g=new ColorClearGame(level(cells,[[],[],[],[]]));
 assert.deepEqual(g.chainPreview(0).map(c=>c.id).sort(),[0,1,2]);assert.equal(g.remaining,4);
 assert.deepEqual(g.chainPreview(3).map(c=>c.id),[3]);
});
