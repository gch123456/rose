import test from 'node:test';
import assert from 'node:assert/strict';
import * as levels from '../assets/scripts/color-clear/ColorClearLevels.ts';
import {ColorClearGame,canSeeCell} from '../assets/scripts/color-clear/ColorClearGame.ts';
import {decodeLevel,encodeLevel} from '../assets/scripts/color-clear/ColorClearLevelData.ts';
const cell=(id,x,y,z,color)=>({id,x,y,z,color,core:false,alive:true,shape:'box'});
test('long capsules conserve six colors and win through bounded real four-slot replay',()=>{
 assert.equal(typeof levels.makeLongBatchLevel,'function');
 const cells=Array.from({length:3072},(_,id)=>cell(id,id%16,Math.floor(id/16)%16,Math.floor(id/256),Math.floor(id/512)));
 const l=levels.makeLongBatchLevel(cells,{name:'dense'});
 const caps=l.supply.flat();assert.ok(caps.filter(c=>c.ammo>=60&&c.ammo<=90).length/caps.length>.8);
 for(let color=0;color<6;color++)assert.equal(caps.filter(c=>c.color===color).reduce((n,c)=>n+c.ammo,0),512);
 const g=new ColorClearGame(l);let maxLoaded=0,lingered=false;
 for(const a of l.replay){const before=g.slots.filter(Boolean).map(c=>c.id);g.rotate(a.yaw-g.yaw,a.pitch-g.pitch);if(a.column!==undefined)assert.ok(g.select(a.column));for(let t=0;t<a.ticks;t++)g.tick(.1);maxLoaded=Math.max(maxLoaded,g.slots.filter(Boolean).length);if(before.some(id=>g.slots.some(c=>c?.id===id)))lingered=true;}
 assert.equal(g.phase,'won');assert.equal(g.shots,cells.length);assert.ok(maxLoaded<=4);assert.deepEqual(decodeLevel(encodeLevel(l)),l);
 const bad=structuredClone(l);bad.replay[0].ticks=200001;assert.throws(()=>decodeLevel({version:1,level:bad}));
 assert.throws(()=>levels.validateLevelCells(Array.from({length:6001},(_,id)=>cell(id,id%100,Math.floor(id/100),0,0))));
 assert.throws(()=>decodeLevel(' '.repeat(2000001)));
});
test('lattice acceleration matches closed-box oracle at ray boundaries and holes',()=>{
 let seed=13;const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
 const cells=[];for(let z=-3;z<=3;z++)for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++)if(random()>.3)cells.push(cell(cells.length*7,x,y,z,0));
 const g=new ColorClearGame({id:1,name:'rays',cells,supply:[[],[],[],[]],solution:[]});
 for(const yaw of [0,Math.PI/4,Math.PI/2,Math.PI,1.234,Math.PI/4+1e-11])for(const pitch of [0,Math.PI/4,-Math.PI/4,Math.PI/2,.321]){
 g.yaw=yaw;g.pitch=pitch;assert.deepEqual(g.visibleTargets().map(c=>c.id),g.cells.filter(c=>canSeeCell(c,g.cells,yaw,pitch)).map(c=>c.id));
 }
});

test('long batches stay loaded across camera changes and intervening colors',()=>{
 const l=levels.makeLongBatchLevel(Array.from({length:343},(_,i)=>{const x=i%7-3,y=Math.floor(i/7)%7-3,z=Math.floor(i/49)-3;return cell(i,x,y,z,Math.max(Math.abs(x),Math.abs(y),Math.abs(z))===3||(!x&&!y&&!z)?0:1);}));
 const g=new ColorClearGame(l);let held=false;
 for(const a of l.replay){const ids=g.slots.filter(Boolean).map(c=>c.id);held ||= ids.length>0&&(a.column!==undefined||Math.abs(a.yaw-g.yaw)>1e-6||Math.abs(a.pitch-g.pitch)>1e-6);g.rotate(a.yaw-g.yaw,a.pitch-g.pitch);if(a.column!==undefined)assert.ok(g.select(a.column));for(let t=0;t<a.ticks;t++)g.tick(.1);held ||= ids.some(id=>g.slots.some(c=>c?.id===id));}
 assert.ok(held);assert.equal(g.phase,'won');
});
test('long partition keeps all capsules in range when each color permits it',()=>{
 const l=levels.makeLongBatchLevel(Array.from({length:175},(_,i)=>cell(i,i%7,Math.floor(i/7),0,0)));
 assert.ok(l.supply.flat().every(c=>c.ammo>=60&&c.ammo<=90));
});
test('sparse wide lattices avoid empty-space traversal while compact solids retain acceleration',()=>{
 const sparse=Array.from({length:800},(_,i)=>cell(i,-1000+i*2,(i*37)%2001-1000,(i*91)%2001-1000,0));
 const compact=Array.from({length:1000},(_,i)=>cell(i,i%10,Math.floor(i/10)%10,Math.floor(i/100),0));
 const original=Map.prototype.get;
 for(const [cells,accelerated] of [[sparse,false],[compact,true]]){
  const g=new ColorClearGame({id:1,name:'cost',cells,supply:[[],[],[],[]],solution:[],initialYaw:.55,initialPitch:.24});
  let coordinateProbes=0;
  try{Map.prototype.get=function(key){if(typeof key==='string'&&/^-?\d+,-?\d+,-?\d+$/.test(key))coordinateProbes++;return original.call(this,key);};
   assert.deepEqual(g.visibleTargets().map(c=>c.id),g.cells.filter(c=>canSeeCell(c,g.cells,g.yaw,g.pitch)).map(c=>c.id));
  }finally{Map.prototype.get=original;}
  if(accelerated)assert.ok(coordinateProbes>0&&coordinateProbes<cells.length*cells.length);
  else assert.equal(coordinateProbes,0,'sparse bounds must not scan unoccupied slabs');
 }
});
