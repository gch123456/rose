import test from 'node:test';
import assert from 'node:assert/strict';
import {ColorClearGame} from '../assets/scripts/color-clear/ColorClearGame.ts';
import {makeLevel, makeRescueFixture} from '../assets/scripts/color-clear/ColorClearLevels.ts';
import {buildAnimalCells} from '../assets/scripts/color-clear/ColorClearAnimals.ts';
import {getDifficultyProfile, applyDifficulty, measureLevel, simulatePolicy} from '../assets/scripts/color-clear/ColorClearDifficulty.ts';

test('profiles change actual coherent layout and capsule/lane constraints without mutating catalogue',()=>{
 const cells=buildAnimalCells(1), before=structuredClone(cells);
 const easy=getDifficultyProfile(1), hard=getDifficultyProfile(10);
 assert.equal(easy.tier,'warmup');assert.equal(getDifficultyProfile(4).tier,'planning');assert.equal(hard.tier,'challenge');
 assert.ok(easy.shotBudget>hard.shotBudget);assert.equal(easy.lanes,4);assert.equal(hard.lanes,4);
 assert.notDeepEqual(applyDifficulty(cells,easy),applyDifficulty(cells,hard));assert.deepEqual(cells,before);
 for(let id=1;id<=10;id++){const p=getDifficultyProfile(id),l=makeLevel(id);assert.ok(l.cells.every(c=>c.color>=0&&c.color<4));assert.ok(l.supply.flat().every(c=>c.ammo>0&&c.ammo<=p.shotBudget));assert.equal(l.supply.filter(q=>q.length).length,p.lanes);}
 const p=getDifficultyProfile(1);p.shotBudget=999;assert.notEqual(getDifficultyProfile(1).shotBudget,999);
});

test('every deterministic queue has an actual no-reward four-slot witness and preserves input',()=>{
 for(let id=1;id<=10;id++){
  const l=makeLevel(id),snapshot=structuredClone(l),g=new ColorClearGame(l);assert.deepEqual(l,makeLevel(id));
  let peak=0;
  for(const a of l.solution){assert.equal(g.phase,'playing');g.rotate(a.yaw-g.yaw);assert.equal(g.select(a.column),true);for(let tick=0;tick<600&&g.phase==='playing'&&g.slots.some(Boolean);tick++){peak=Math.max(peak,g.slots.filter(Boolean).length);g.tick(.1);}assert.ok(g.phase==='won'||g.slots.every(s=>!s),`level ${id} capsule clears`);if(g.phase==='won')break;}
  assert.equal(g.phase,'won',`level ${id}`);assert.equal(g.slots.length,4);assert.equal(g.continued,false);assert.ok(peak<=4);assert.deepEqual(l,snapshot);
  if(id===1)assert.ok(l.solution.every(a=>a.yaw===l.initialYaw));
 }
});

test('structural measurements and bounded policies are deterministic and honest about budgets',()=>{
 const l=makeLevel(7),snapshot=structuredClone(l),m=measureLevel(l);
 assert.equal(m.capsules,l.supply.flat().length);assert.ok(m.colorBoundaries>0);assert.ok(m.witnessViewChanges>0);assert.ok(m.meanQueueOptions>=1&&m.meanQueueOptions<=4);
 assert.deepEqual(m,measureLevel(l));
 const a=simulatePolicy(l,'visible-first',17,60);assert.deepEqual(a,simulatePolicy(l,'visible-first',17,60));assert.ok(['won','lost','timeout'].includes(a.outcome));assert.ok(a.ticks<=60);assert.ok(a.peakSlots<=4);assert.equal(a.rewardUses,0);assert.deepEqual(l,snapshot);
 assert.equal(simulatePolicy(l,'front-first',1,0).outcome,'timeout');
});

test('rescue fixture retains its enclosed seven-cell UI contract',()=>{const l=makeRescueFixture();assert.equal(l.cells.length,7);assert.equal(l.cells.filter(c=>c.color===0).length,6);assert.equal(l.supply.flat().length,5);});

test('warmup queues tolerate casual multi-load policies without rewards or chain-order ammo traps',()=>{
 for(let id=1;id<=3;id++){const l=makeLevel(id);assert.equal(l.cells.filter(c=>c.core).length,0);assert.equal(l.supply.flat().reduce((n,c)=>n+c.ammo,0),l.cells.length);for(const policy of ['front-first','visible-first','seeded']){const r=simulatePolicy(l,policy,20261116,1800);assert.equal(r.outcome,'won',`level ${id}, ${policy}: ${r.outcome}`);assert.equal(r.rewardUses,0);}}
});
