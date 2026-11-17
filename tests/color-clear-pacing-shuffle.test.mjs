import test from 'node:test';
import assert from 'node:assert/strict';
import * as rules from '../assets/scripts/color-clear/ColorClearGame.ts';
import * as levels from '../assets/scripts/color-clear/ColorClearLevels.ts';
import {decodeLevel,encodeLevel} from '../assets/scripts/color-clear/ColorClearLevelData.ts';
const cell=(id,color=0)=>({id,x:id%12,y:Math.floor(id/12),z:0,color,core:false,alive:true});
const flat=()=>({id:1,name:'pace',initialYaw:0,initialPitch:0,pacing:'remaining',cells:Array.from({length:120},(_,id)=>cell(id)),supply:[[{id:0,color:0,ammo:120}],[],[],[]],solution:[]});
test('remaining pace smoothly slows interval and flight from full to last piece',()=>{
 assert.equal(typeof rules.eliminationPace,'function');
 let previous={interval:0,flightSeconds:0};
 for(let remaining=120;remaining>=0;remaining--){const p=rules.eliminationPace(remaining,120);assert.ok(p.interval>=previous.interval&&p.flightSeconds>=previous.flightSeconds);previous=p;}
 const fast=rules.eliminationPace(120,120),slow=rules.eliminationPace(1,120);
 assert.ok(fast.interval<.07&&fast.flightSeconds<.15);assert.ok(slow.interval>.16&&slow.flightSeconds>.32);
});
test('actual remaining count controls hit intervals; launched duration stays fixed and pause freezes conservation',()=>{
 const run=(low,dt)=>{const g=new rules.ColorClearGame(flat());if(low)g.cells.slice(0,115).forEach(c=>c.alive=false);g.select(0);g.tick(.01);const first=g.flights[0];assert.equal(first.duration,first.time);const duration=first.duration;const snapshot=JSON.stringify(g.flights);g.pause();g.tick(.25);assert.equal(JSON.stringify(g.flights),snapshot);g.resume();let seconds=0;while(g.shots<3&&seconds<3){g.tick(dt);seconds+=dt;assert.equal(first.duration,duration);assert.equal(new Set(g.flights.map(f=>f.target)).size,g.flights.length);assert.ok(g.flights.length<=1);}return seconds;};
 for(const dt of [.01,1/60,1/30,.1])assert.ok(run(false,dt)<run(true,dt)/2,`frame ${dt}`);
 const legacy=flat();delete legacy.pacing;const g=new rules.ColorClearGame(legacy);g.select(0);g.tick(.01);assert.equal(g.flights[0].duration,rules.FLIGHT_SECONDS);
});
test('adaptive long batch replay is decoded under its actual pace and rejects unknown pace',()=>{
 const l=levels.makeLongBatchLevel(Array.from({length:360},(_,id)=>cell(id,id%6)),{pacing:'remaining'});
 assert.equal(l.pacing,'remaining');assert.deepEqual(decodeLevel(encodeLevel(l)),l);
 assert.throws(()=>decodeLevel({version:1,level:{...l,pacing:'fast'}}));
});
test('seeded complete capsule shuffle mixes columns while preserving cells, ids, ammunition and a real four-slot win',()=>{
 assert.equal(typeof levels.planShuffledLevel,'function');
 const base={...flat(),cells:Array.from({length:240},(_,id)=>cell(id,Math.floor(id/6)%6)),supply:Array.from({length:4},(_,column)=>Array.from({length:10},(_,row)=>{const id=row*4+column;return {id,color:id%6,ammo:6};}))},before=structuredClone(base);
 const shuffled=levels.planShuffledLevel(base,71),again=levels.planShuffledLevel(base,71),other=levels.planShuffledLevel(base,93);
 assert.deepEqual(base,before);assert.deepEqual(shuffled,again);assert.notDeepEqual(shuffled.supply,base.supply);assert.notDeepEqual(shuffled.supply,other.supply);
 assert.deepEqual(shuffled.cells,base.cells);assert.equal(shuffled.pacing,'remaining');assert.deepEqual(shuffled.supply.flat().sort((a,b)=>a.id-b.id),base.supply.flat().sort((a,b)=>a.id-b.id));
 assert.ok(shuffled.supply.some(q=>q.some(c=>!base.supply.find(b=>b.some(x=>x.id===q[0].id))?.some(x=>x.id===c.id))));
 assert.deepEqual(decodeLevel(encodeLevel(shuffled)),shuffled);
 const g=new rules.ColorClearGame(shuffled);for(const a of shuffled.replay){g.rotate(a.yaw-g.yaw,a.pitch-g.pitch);if(a.column!==undefined)assert.ok(g.select(a.column));for(let t=0;t<a.ticks;t++){g.tick(.1);for(let color=0;color<6;color++){const ammo=[...g.supply.flat(),...g.slots.filter(Boolean)].filter(c=>c.color===color).reduce((n,c)=>n+c.ammo,0)+g.flights.filter(f=>f.color===color).length;assert.equal(ammo,g.cells.filter(c=>c.alive&&c.color===color).length);}}}assert.equal(g.phase,'won');assert.equal(g.shots,240);assert.equal(g.slots.length,4);
});

test('decoder validates witness ticks against adaptive flight time rather than legacy time',()=>{
 const level={id:1,name:'clock',cells:[cell(0),cell(1,1)],supply:[[{id:0,color:0,ammo:1}],[{id:1,color:1,ammo:1}],[],[]],solution:[],replay:[{yaw:0,pitch:0,column:0,ticks:4},{yaw:0,pitch:0,column:1,ticks:3}]};
 assert.throws(()=>decodeLevel({version:1,level}),/参考通路/);
 assert.equal(decodeLevel({version:1,level:{...level,pacing:'remaining'}}).pacing,'remaining');
 const shortened={...level,pacing:'remaining',replay:[level.replay[0],{...level.replay[1],ticks:1}]};
 assert.throws(()=>decodeLevel({version:1,level:shortened}),/参考通路/);
});
