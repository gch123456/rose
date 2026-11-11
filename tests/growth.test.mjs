import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EscapeGame} from '../assets/scripts/EscapeGame.ts';
const step=(g,seconds)=>{for(let i=0;i<Math.round(seconds*100);i++)g.tick(.01,0,0);};
const fresh=()=>{const g=new EscapeGame(()=>.5);g.start();return g;};
const pickup=(g,value)=>{g.drops.push({x:g.x,y:g.y,value});g.tick(.01,0,0);};
const enemy=(g,kind,x,y)=>{const e=g.spawn(kind,x,y);e.hp=10000;e.visibleFor=1;return e;};

test('grain pickup grants consecutive automatic levels with linear stats and a cap',()=>{
 const g=fresh();pickup(g,24);assert.equal(g.level,3);assert.equal(g.xp,0);assert.equal(g.score,24);
 assert.equal(g.damage,12*1.16);assert.equal(g.attackInterval,.55/1.04);assert.equal(g.phase,'playing');
 pickup(g,10000);assert.equal(g.level,12);assert.equal(g.xp,0);assert.equal(g.score,10024);assert.equal(g.damage,12*1.88);assert.equal(g.attackInterval,.55/1.24);
 g.start();assert.equal(g.level,1);assert.equal(g.xp,0);assert.equal(g.branch,'base');assert.equal(g.auxiliary,'none');assert.equal(g.evolved,false);
});
test('branch gear appears at 25 seconds in safe visible reachable positions and arms after .8 seconds',()=>{
 const g=fresh();g.time=24.99;g.tick(.01,0,0);assert.equal(g.choice.kind,'branch');assert.equal(g.choice.options.length,2);
 const [a,b]=g.choice.options;assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=90);for(const o of [a,b]){assert.ok(Math.hypot(o.x,o.y)>=90);assert.ok(Math.abs(o.x)<=830&&Math.abs(o.y)<=830);assert.ok(o.y<g.viewHeight/2-180);}
 g.x=a.x;g.y=a.y;g.tick(.01,0,0);assert.equal(g.branch,'base');step(g,.81);assert.equal(g.branch,a.key);assert.equal(g.choice,null);assert.equal(g.choiceHistory.length,1);assert.equal(g.phase,'playing');
});
test('unsafe choice retries without blocking combat and defaults at its scheduled deadline',()=>{
 const g=fresh();g.setViewport(100,100);g.time=25;g.tick(.01,0,0);assert.equal(g.choice.options.length,0);step(g,1);assert.ok(g.choiceRetries>=2);
 g.phase='paused';const t=g.time;step(g,2);assert.equal(g.time,t);g.phase='playing';g.time=39.99;g.tick(.02,0,0);assert.equal(g.branch,'line');assert.equal(g.choice,null);assert.equal(g.choiceHistory[0].reason,'timeout');
});
test('choice spawn avoids locked dangers, enemies and map edges',()=>{
 const g=fresh();g.x=845;g.y=845;g.time=25;const clip=enemy(g,'clip',760,750);clip.state='windup';clip.dx=1;clip.dy=0;clip.timer=.8;g.tick(.01,0,0);
 for(const o of g.choice.options){assert.ok(Math.abs(o.x)<=830&&Math.abs(o.y)<=830);assert.ok(Math.hypot(o.x-clip.x,o.y-clip.y)>=60);assert.ok(Math.hypot(o.x-g.x,o.y-g.y)>=70);}
});
test('auxiliary choice drops once and timeout gives bubble; 120 seconds evolves once without pausing',()=>{
 const g=fresh();g.branch='line';g.time=69.99;g.tick(.01,0,0);assert.equal(g.choice.kind,'auxiliary');g.time=85;g.tick(.01,0,0);assert.equal(g.auxiliary,'bubble');
 g.time=119.99;g.tick(.02,0,0);assert.equal(g.evolved,true);assert.equal(g.phase,'playing');assert.equal(g.events.filter(e=>e==='evolve').length,1);g.tick(.01,0,0);assert.equal(g.events.filter(e=>e==='evolve').length,1);
});
test('line branch pierces five distinct enemies',()=>{
 const g=fresh();g.branch='line';const es=[40,70,100,130,160,190].map(x=>enemy(g,'glove',x,0));step(g,.49);
 assert.deepEqual(es.map(e=>10000-e.hp),[12,12,12,12,12,0]);
});
test('scatter covers three lanes and caps each volley at two hits per enemy',()=>{
 const g=fresh();g.branch='spread';const es=[-18,0,18].map(a=>enemy(g,'glove',(a===0?130:140)*Math.cos(a*Math.PI/180),(a===0?130:140)*Math.sin(a*Math.PI/180)));step(g,.45);assert.ok(es.every(e=>e.hp<10000));
 const h=fresh();h.branch='spread';const e=enemy(h,'glove',25,0);step(h,.2);assert.ok(Math.abs(10000-e.hp-19.2)<.001);
});
test('evolved line and scatter each deliver exactly 1.6 times their single target volley budget',()=>{
 for(const [branch,before] of [['line',12],['spread',19.2]]){const g=fresh();g.branch=branch;g.evolved=true;const e=enemy(g,'glove',25,0);step(g,.2);assert.ok(Math.abs(10000-e.hp-before*1.6)<.001);}
});
test('bubble damages a group inside its radius and slow expires; feather ignores main branch multipliers',()=>{
 const g=fresh();g.auxiliary='bubble';const a=enemy(g,'glove',0,60),b=enemy(g,'glove',0,-60),far=enemy(g,'glove',0,180);g.tick(.01,0,0);assert.ok(a.hp<10000&&b.hp<10000);assert.equal(far.hp,10000);assert.ok(a.slowFor>0);g.auxiliary='none';step(g,1.1);assert.ok(a.slowFor<=0);
 const h=fresh();h.branch='spread';h.evolved=true;h.auxiliary='feather';h.tick(.01,0,0);enemy(h,'glove',250,0);h.tick(.01,0,0);const shot=h.shots.find(s=>s.kind==='feather');assert.ok(shot);assert.equal(shot.damage,h.damage*.6);assert.equal(shot.pierce,2);
});
test('health food drops only once after each threshold and remains separate from capped grains',()=>{
 const g=fresh();g.time=45;g.hit(g.spawn('glove',1000,1000),100);assert.equal(g.foods.length,1);for(let i=0;i<300;i++)g.hit(g.spawn('glove',1000,1000),100);assert.equal(g.foods.length,1);assert.ok(g.drops.length<=260);
 const f=g.foods[0];assert.ok(f.x<=830&&f.y<=830);g.hp=3;g.x=f.x;g.y=f.y;g.tick(.01,0,0);assert.equal(g.hp,4);assert.equal(g.foods.length,0);
 g.time=100;g.hit(g.spawn('glove',g.x,g.y),100);g.hp=5;const before=g.score;g.tick(.01,0,0);assert.equal(g.hp,5);assert.ok(g.score>=before+3);assert.equal(g.foods.length,0);
});
test('lid locks a ground point, attacks once and new windups wait for a pending choice',()=>{
 const g=fresh();const e=enemy(g,'lid',140,0);e.cooldown=0;g.tick(.01,0,0);assert.equal(e.state,'windup');const {aimX,aimY}=e;g.x=100;g.y=100;step(g,.91);assert.equal(e.state,'recover');assert.equal(e.aimX,aimX);assert.equal(e.aimY,aimY);assert.equal(g.hp,5);
 const h=fresh();h.time=25;const c=enemy(h,'clip',140,0);c.cooldown=0;h.tick(.01,0,0);assert.equal(c.state,'chase');assert.ok(h.choice);
});
test('150 seconds hands over to the boss and death still wins the judgement over the transition',()=>{
 const g=fresh();g.time=149.99;g.tick(.02,0,0);assert.ok(g.boss);assert.equal(g.phase,'playing');assert.ok(g.time>=150);
 const h=fresh();h.time=149.99;h.hp=1;enemy(h,'lid',0,0);h.tick(.02,0,0);assert.equal(h.phase,'lost');
});
test('corner with a legal ninety-unit pair still offers both gear choices',()=>{
 const g=fresh();g.x=845;g.y=845;g.time=25;g.spawn('glove',817,704);g.tick(.01,0,0);
 assert.equal(g.choice.options.length,2);const [a,b]=g.choice.options;assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=90);
});
test('evolved line pulses are separated in time as well as sharing the damage budget',()=>{
 const g=fresh();g.branch='line';g.evolved=true;enemy(g,'glove',200,0);g.tick(.01,0,0);
 assert.equal(g.shots.length,2);assert.notEqual(g.shots[0].x,g.shots[1].x);
});
