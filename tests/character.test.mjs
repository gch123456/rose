import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EscapeGame} from '../assets/scripts/EscapeGame.ts';
const step=(g,seconds)=>{for(let i=0;i<Math.round(seconds*100);i++)g.tick(.01,0,0);};
const fresh=(character='shooter')=>{const g=new EscapeGame(()=>.5);g.character=character;g.start();return g;};
const enemy=(g,kind,x,y)=>g.spawn(kind,x,y);
const close=(a,b,label,eps=.01)=>assert.ok(Math.abs(a-b)<=eps,`${label||'value'}: ${a} ~ ${b}`);
const dead=(hp,label)=>assert.ok(hp<=0,`${label}: hp=${hp}`);

test('the warrior slashes at 18 damage in a 120 degree frontal arc within 100 every .75s',()=>{
 const g=fresh('warrior');
 close(g.damage,18,'warrior base damage');
 close(g.attackInterval,.75,'warrior interval');
 const front=enemy(g,'glove',80,0),behind=enemy(g,'glove',-80,0);
 step(g,.01);
 dead(front.hp,'front glove dies to one slash');
 close(behind.hp,12,'rear glove is outside the 120 degree arc');
 assert.equal(g.kills,1);
});

test('the warrior cannot slash beyond 100 range',()=>{
 const g=fresh('warrior');
 const far=enemy(g,'glove',120,0);
 step(g,.2);
 close(far.hp,12,'out-of-range glove is untouched');
 assert.equal(g.shots.length,0,'the warrior fires no projectiles');
});

test('the heavy branch reaches 125 at a 90 degree arc for 1.6D with a 1.3x interval',()=>{
 const g=fresh('warrior');
 g.branch='heavy';
 close(g.attackInterval,.975,'heavy interval .75*1.3');
 close(g.damage*1.6,28.8,'heavy slash damage');
 const inArc=enemy(g,'glove',110,40),outArc=enemy(g,'glove',40,115),tooFar=enemy(g,'glove',135,0);
 step(g,.01);
 dead(inArc.hp,'110,40 is inside the heavy arc');
 close(outArc.hp,12,'40,115 is outside the 90 degree arc');
 close(tooFar.hp,12,'135,0 is beyond 125 range');
});

test('the wide branch clears a 220 degree arc at base damage',()=>{
 const g=fresh('warrior');
 g.branch='wide';
 const left=enemy(g,'glove',-80,0),edge=enemy(g,'glove',-40,80),behind=enemy(g,'glove',80,0);
 step(g,.01);
 dead(left.hp,'left target dies');
 dead(edge.hp,'-40,80 is inside the 220 degree arc');
 close(behind.hp,12,'directly opposite the aim stays outside 220 degrees');
});

test('the evolved wide slash hits the full circle twice for 1.6D per enemy',()=>{
 const g=fresh('warrior');
 g.branch='wide';g.time=119.99;g.tick(.01,0,0);assert.equal(g.evolved,true);
 const any=enemy(g,'glove',0,-90),other=enemy(g,'glove',90,0);
 step(g,.01);
 dead(any.hp,'the rear is covered after evolution');
 dead(other.hp,'the front dies');
 assert.equal(g.kills,2);
});

test('the evolved heavy slash adds a .96D shockwave without double-counting slashed enemies',()=>{
 const g=fresh('warrior');
 g.branch='heavy';g.time=119.99;g.tick(.01,0,0);
 const slashed=enemy(g,'glove',100,0),behind=enemy(g,'lid',0,-100);
 step(g,.01);
 dead(slashed.hp,'the slashed target takes exactly 1.6D, never plus the shockwave');
 close(behind.hp,140-18*.96,'the rear lid takes only the .96D shockwave');
});

test('the mage bursts water at the target point within 65 for 12 damage each',()=>{
 const g=fresh('mage');
 close(g.attackInterval,.9,'mage interval');
 const e1=enemy(g,'glove',200,0),e2=enemy(g,'glove',240,0),far=enemy(g,'glove',0,350);
 step(g,.01);
 dead(e1.hp,'the burst target dies');
 dead(e2.hp,'240,0 is within 65 of the burst point');
 close(far.hp,12,'350,0 is outside both the range and the burst');
});

test('the evolved blast widens to radius 105 and deals two segments totaling 1.6D',()=>{
 const g=fresh('mage');
 g.branch='blast';g.time=119.99;g.tick(.01,0,0);
 const target=enemy(g,'lid',100,0),inside=enemy(g,'glove',195,0);
 step(g,.01);
 close(target.hp,140-12*1.6,'lid takes the full two-segment 1.6D');
 dead(inside.hp,'195,0 is inside the 105 radius but would miss the 65 radius');
});

test('the chain branch bursts at 50 and jumps to two unhit enemies within 100 at .8D each',()=>{
 const g=fresh('mage');
 g.branch='chain';
 const e1=enemy(g,'glove',200,0),e2=enemy(g,'glove',280,0),e3=enemy(g,'glove',300,50),e4=enemy(g,'glove',250,60);
 step(g,.01);
 dead(e1.hp,'the chain target dies');
 close(e4.hp,12-9.6,'250,60 takes a .8D jump');
 close(e2.hp,12-9.6,'280,0 takes a .8D jump');
 close(e3.hp,12,'300,50 is beyond the 100 jump range');
});

test('the evolved chain deals 1.6D first and jumps four times',()=>{
 const g=fresh('mage');
 g.branch='chain';g.time=119.99;g.tick(.01,0,0);
 const e1=enemy(g,'glove',200,0),e2=enemy(g,'glove',280,0),e3=enemy(g,'glove',300,50),e4=enemy(g,'glove',250,60),e5=enemy(g,'glove',290,-35),e6=enemy(g,'glove',200,95);
 step(g,.01);
 dead(e1.hp,'the popped target takes the 1.6D first hit');
 for (const [e,label] of [[e2,'280,0'],[e4,'250,60'],[e5,'290,-35'],[e6,'200,95']])
  close(e.hp,12-9.6,`${label} takes one of the four .8D jumps`);
 close(e3.hp,12,'300,50 stays outside the jump range');
 assert.equal(g.kills,1,'only the popped glove dies; jumps leave survivors at 2.4');
});

test('level 12 scaling matches the shared growth rule for every character',()=>{
 for (const [c,base] of [['shooter',12],['warrior',18],['mage',12]]) {
  const g=fresh(c);g.level=12;
  close(g.damage,base*1.88,`${c} damage at level 12`);
 }
});

test('the auxiliaries still work for the warrior and the mage',()=>{
 const g=fresh('warrior');
 g.auxiliary='bubble';g.auxiliaryFire=0;
 const lid=enemy(g,'lid',80,0);
 step(g,.01);
 close(lid.hp,140-18-18*.35,'the lid takes slash plus the bubble hit at warrior damage');
});

test('the branch choice offers per-character options with the right timeout default',()=>{
 const s=fresh('shooter');s.time=24.99;s.tick(.02,0,0);
 assert.deepEqual(s.choice?.options.map(o=>o.key).sort(),['line','spread']);
 s.resolveChoice(s.choice.options[0].key,'timeout');
 assert.equal(s.branch,'line');
 const w=fresh('warrior');w.time=24.99;w.tick(.02,0,0);
 assert.deepEqual(w.choice?.options.map(o=>o.key).sort(),['heavy','wide']);
 const m=fresh('mage');m.time=24.99;m.tick(.02,0,0);
 assert.deepEqual(m.choice?.options.map(o=>o.key).sort(),['blast','chain']);
});
