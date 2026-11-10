import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Game, ITEMS} from '../assets/scripts/Game.ts';
test('upgrade pauses combat and consumes one choice',()=>{const g=new Game(()=>0.3);g.start('duck');g.gainXP(100);const t=g.time;g.tick(1,1,0);assert.equal(g.time,t);assert.equal(g.choices.length,3);g.choose(0);assert.equal(g.level,2);});
test('full slots do not offer new equipment; max items excluded',()=>{const g=new Game();g.start('chicken');g.equipment={peck:5,wave:5,honk:5,pepper:3,boots:3,magnet:3};assert.equal(g.options().length,0);});
test('evolution requires max weapon and matching passive',()=>{const g=new Game();g.start('chicken');g.equipment.peck=5;assert.equal(g.openChest(),false);g.equipment.pepper=1;assert.equal(g.openChest(),true);assert.ok(g.evolved.includes('peck'));});
test('boss arrives after 180 seconds and defeat wins',()=>{const g=new Game(()=>0.5);g.start('goose');g.time=179.99;g.tick(.02,0,0);assert.equal(g.phase,'boss');const b=g.enemies.find(e=>e.kind==='boss');assert.ok(b);g.hit(b,100000);assert.equal(g.phase,'won');});
test('enemy population remains bounded and restart clears run',()=>{const g=new Game();g.start('duck');for(let i=0;i<1000;i++)g.spawn('bug');assert.ok(g.enemies.length<=160);g.start('goose');assert.equal(g.enemies.length,0);assert.equal(g.time,0);assert.equal(Object.keys(g.equipment)[0],'honk');});
test('all characters demonstrate an automatic kill in the opening second',()=>{for(const kind of ['chicken','duck','goose']){const g=new Game(()=>.5);g.start(kind);for(let i=0;i<60;i++)g.tick(1/60,0,0);assert.ok(g.kills>0,kind+' should show an early kill');}});
