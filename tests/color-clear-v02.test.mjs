import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ColorClearGame,canSeeCell,reachableColors} from '../assets/scripts/color-clear/ColorClearGame.ts';
const c=(id,x,y,z,color,shape='box',core=false)=>({id,x,y,z,color,shape,core,alive:true});
const cap=(id,color,ammo=3)=>({id,color,ammo});
const l=(cells,supply)=>({id:1,name:'test',cells,supply,solution:[]});
const advance=g=>{for(let i=0;i<10;i++)g.tick(.1);};
function deadlocked(){const cells=[c(0,0,0,0,1),c(1,-1,0,0,0),c(2,1,0,0,0),c(3,0,0,-1,0),c(4,0,0,1,0)];const g=new ColorClearGame(l(cells,Array.from({length:4},(_,i)=>[cap(i,1),...(i===0?[cap(5,0,10)]:[])])));for(let i=0;i<4;i++)g.select(i);advance(g);assert.equal(g.phase,'lost');return g;}
test('fire reserves a target; impact clears later and keeps its slot until arrival',()=>{
 const g=new ColorClearGame(l([c(0,0,0,0,0)],[[cap(0,0,1)],[],[],[]]));g.select(0);g.tick(.01);
 assert.equal(g.remaining,1);assert.equal(g.flights.length,1);assert.ok(g.slots[0]);assert.equal(g.phase,'playing');
 assert.ok(g.drainEvents().some(e=>e.type==='fire'));advance(g);assert.equal(g.phase,'won');assert.equal(g.slots[0],null);
});
test('two same-colour slots cannot reserve the same target; pause freezes flight time',()=>{
 const g=new ColorClearGame(l([c(0,0,0,0,0)],[[cap(0,0)],[cap(1,0)],[],[]]));g.select(0);g.select(1);g.tick(.01);assert.equal(g.flights.length,1);assert.equal(g.shots,1);
 const snapshot=JSON.stringify(g.flights);g.pause();g.tick(5);assert.equal(JSON.stringify(g.flights),snapshot);g.resume();advance(g);assert.equal(g.remaining,0);
});
test('slot rewards cancel cleanly, grant once, cap at six, and reset per run',()=>{
 const g=new ColorClearGame(l([c(0,0,0,0,0)],[[cap(0,0)],[],[],[]]));let t=g.beginReward('slot');assert.equal(g.phase,'paused');assert.equal(g.beginReward('slot'),null);assert.equal(g.resolveReward(t,false),false);assert.equal(g.phase,'playing');assert.equal(g.slots.length,4);
 t=g.beginReward('slot');assert.equal(g.resolveReward(t,true),true);assert.equal(g.slots.length,5);assert.equal(g.resolveReward(t,true),false);
 const t2=g.beginReward('slot');g.resolveReward(t2,true);assert.equal(g.slots.length,6);assert.equal(g.beginReward('slot'),null);g.restart();assert.equal(g.slots.length,4);
});
test('old reward callbacks cannot mutate restarted or newly constructed games',()=>{
 const level=l([c(0,0,0,0,0)],[[cap(0,0)],[],[],[]]);const a=new ColorClearGame(level),ticket=a.beginReward('slot');a.restart();const fresh=a.beginReward('slot');assert.equal(a.resolveReward(ticket,true),false);assert.equal(a.slots.length,4);assert.equal(a.resolveReward(fresh,true),true);
 const b=new ColorClearGame(level),current=b.beginReward('slot');assert.equal(b.resolveReward(ticket,true),false);assert.equal(b.resolveReward(current,true),true);
});
test('continue preserves exact ammo/model/queue/yaw and exposes new supply plus reserve reload',()=>{
 const g=deadlocked();const cells=JSON.stringify(g.cells),queue=JSON.stringify(g.supply),ids=g.slots.map(x=>({...x}));g.yaw=.7;
 const cancel=g.beginReward('continue');assert.equal(g.resolveReward(cancel,false),false);assert.equal(g.phase,'lost');
 const ticket=g.beginReward('continue');assert.equal(g.resolveReward(ticket,true),true);assert.equal(g.phase,'playing');assert.equal(g.yaw,.7);assert.equal(JSON.stringify(g.cells),cells);assert.equal(JSON.stringify(g.supply),queue);assert.deepEqual(g.reserve,ids);assert.ok(g.slots.every(x=>!x));assert.equal(g.takeReserve(0),true);assert.deepEqual(g.slots[0],ids[0]);assert.equal(g.select(0),true);assert.equal(g.slots[1].color,0);
 assert.equal(g.resolveReward(ticket,true),false);assert.equal(g.canContinue,false);
});
test('continuation retains unlocked capacity and is unavailable after genuine ammo exhaustion',()=>{
 const g=new ColorClearGame(l([c(0,0,0,0,1)],[[cap(0,0,1)],[],[],[]]));advance(g);assert.equal(g.phase,'playing');g.select(0);advance(g);assert.equal(g.phase,'lost');
 const t=g.beginReward('slot');assert.equal(t,null);
 const empty=new ColorClearGame(l([c(0,0,0,0,0)],[[],[],[],[]]));advance(empty);assert.equal(empty.canContinue,false);assert.equal(empty.beginReward('continue'),null);
});
test('curved pieces do not falsely block rays through the corners of their bounding boxes',()=>{
 const target=c(0,0,0,0,0),box=c(1,1,0,1,1,'box'),sphere={...box,shape:'sphere'};
 // A centre ray near a box corner intersects the box but misses the inscribed circle.
 const yaw=-Math.atan2(.51,1.49);
 assert.equal(canSeeCell(target,[target,box],yaw),false);
 assert.equal(canSeeCell(target,[target,sphere],yaw),true);
 assert.ok(reachableColors([target,sphere]).has(0));
});
test('six-slot rescue retains unlocked capacity and previously cleared cells',()=>{
 const cells=[c(0,0,0,0,1),c(1,-1,0,0,0),c(2,1,0,0,0),c(3,0,0,-1,0),c(4,0,0,1,0),c(5,3,0,0,2)];
 const supply=[[cap(9,2,1),cap(0,1),cap(4,1),cap(10,0,5)],[cap(1,1),cap(5,1)],[cap(2,1)],[cap(3,1)]];
 const g=new ColorClearGame(l(cells,supply));for(let i=0;i<2;i++){const t=g.beginReward('slot');assert.equal(g.resolveReward(t,true),true);}
 g.select(0);advance(g);assert.equal(g.cells[5].alive,false);
 for(const col of [0,1,2,3,0,1])g.select(col);advance(g);assert.equal(g.phase,'lost');const shots=g.shots;
 const t=g.beginReward('continue');assert.equal(g.resolveReward(t,true),true);assert.equal(g.slots.length,6);assert.equal(g.reserve.length,6);assert.equal(g.cells[5].alive,false);assert.equal(g.shots,shots);
});
