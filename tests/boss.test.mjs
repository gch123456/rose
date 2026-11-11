import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EscapeGame} from '../assets/scripts/EscapeGame.ts';
const step=(g,seconds)=>{for(let i=0;i<Math.round(seconds*100);i++)g.tick(.01,0,0);};
const fresh=()=>{const g=new EscapeGame(()=>.5);g.start();return g;};

test('at 150 seconds spawning stops, survivors retire without rewards and the boss arrives above the player',()=>{
 const g=fresh();g.spawn('glove',60,0);g.drops.push({x:150,y:0,value:4});g.foods.push({x:-150,y:0});
 const {level,hp,kills}=g;
 g.time=149.99;g.tick(.02,0,0);
 assert.ok(g.boss,'boss should appear');
 assert.equal(g.boss.state,'arrive');
 assert.equal(g.enemies.length,0,'survivors retire');
 assert.equal(g.kills,kills,'retiring is not a kill');
 assert.equal(g.level,level);assert.equal(g.hp,hp);assert.equal(g.phase,'playing');
 assert.ok(g.boss.y>g.y,'prefer above the player');
 assert.ok(Math.abs(g.boss.x)<=780&&Math.abs(g.boss.y)<=780,'center within +-780');
 assert.equal(g.drops.length,1);assert.equal(g.foods.length,1,'grains and food remain');
 g.x=g.drops[0].x;g.y=g.drops[0].y;g.tick(.01,0,0);assert.equal(g.score,4,'grounded grains are still collected');
 assert.equal(g.foods.length,1,'food untouched at its own spot'); const enemiesBefore=g.enemies.length;step(g,3);assert.equal(g.enemies.length,enemiesBefore,'no more regular spawning');
});

test('the boss cannot be hurt and does not attack during the one second arrival',()=>{
 const g=fresh();g.time=149.99;g.tick(.02,0,0);const b=g.boss;
 g.x=b.x-100;g.y=b.y;step(g,.6);
 assert.equal(b.hp,900,'invulnerable while arriving');
 g.x=b.x;g.y=b.y;step(g,.4);
 assert.equal(g.hp,5,'no contact damage during arrival');
 assert.equal(b.state,'windup','first move starts after arrival');
});

test('boss dash locks direction, charges 0.9s, rushes at 420 for 0.45s and then recovers',()=>{
 const g=fresh();g.time=149.99;g.tick(.02,0,0);const b=g.boss;
 step(g,1.01);assert.equal(b.state,'windup');
 const dir={x:b.dx,y:b.dy};
 g.x=b.x+dir.x*150;g.y=b.y+dir.y*150;
 step(g,.9);assert.equal(b.state,'dash');
 // Measure from the current position; float drift may already have started the dash a few ticks earlier.
 const cx=b.x,cy=b.y,php=g.hp;
 while(b.state==='dash')g.tick(.01,0,0);
 assert.equal(b.state,'recover');
 const moved=Math.hypot(b.x-cx,b.y-cy);
 assert.ok(Math.abs(moved-420*.45)<15,'dash distance '+moved);
 assert.equal(g.hp,php-2,'dash costs two hearts');
 step(g,1.25);assert.equal(b.state,'fanwind','alternates to the fan after a dash');
});

test('fan shot telegraphs 0.8s, fires -25/0/25 shells at 150 speed and clears leftovers after 2.2s',()=>{
 const g=fresh();g.time=149.99;g.tick(.02,0,0);const b=g.boss;g.bossNext='fan';
 step(g,1.0);assert.equal(b.state,'fanwind');
 const base=Math.atan2(b.dy,b.dx);
 g.x=b.x+b.dx*200;g.y=b.y+b.dy*200;
 const bx=b.x,by=b.y;
 step(g,.8);assert.equal(b.state,'fan');
 assert.equal(b.shots.length,3);
 const angs=b.shots.map(s=>Math.round((Math.atan2(s.dy,s.dx)-base)*180/Math.PI)).sort((a,b)=>a-b);
 assert.deepEqual(angs,[-25,0,25]);
 // Shell flight to the player takes about 1.2s, well inside the fixed 2.2s phase.
 step(g,1.3);assert.equal(b.state,'fan','boss stays through the fixed 2.2s phase');
 assert.ok(Math.abs(b.x-bx)<.01&&Math.abs(b.y-by)<.01,'boss is stationary while firing');
 assert.equal(g.hp,4,'a shell costs one heart');
 step(g,.95);assert.equal(b.state,'recover');
 assert.equal(b.shots.length,0,'leftover shells are removed');
 step(g,1.25);assert.equal(b.state,'windup','alternates back to the dash');
});

test('the recovery window keeps the boss hittable and moves strictly alternate',()=>{
 const g=fresh();g.time=149.99;g.tick(.02,0,0);const b=g.boss;
 step(g,1.01);
 g.x=b.x-250;g.y=b.y;step(g,.3); // stand in range during windup
 const volley=()=>{const before=b.hp;step(g,.6);return before-b.hp;};
 assert.ok(volley()>0,'boss can be hurt outside arrival');
});

test('defeating the boss wins exactly once and drops nothing',()=>{
 const g=fresh();g.time=149.99;g.tick(.02,0,0);const b=g.boss;
 const {kills}=g;const drops=g.drops.length;
 step(g,1.01);
 g.hit(b,900);assert.equal(b.hp,0);
 step(g,.02);
 assert.equal(g.phase,'won');
 assert.equal(g.events.filter(e=>e==='end').length,1);
 assert.equal(g.kills,kills,'the boss itself is not counted as a pursuer kill');
 assert.equal(g.drops.length,drops,'no grain reward for the boss');
 step(g,1);assert.equal(g.phase,'won','the result is submitted only once');
});

test('surviving 180 seconds with the boss alive loses as the exit is sealed',()=>{
 const g=fresh();g.time=149.99;g.tick(.02,0,0);const b=g.boss;
 g.x=-400;g.y=-400; // far outside every boss reach
 g.time=179.99;g.tick(.02,0,0);
 assert.equal(g.phase,'lost');
 assert.equal(g.deathCause,'出口被封锁');
 assert.ok(g.hp>0);
});

test('a lethal player hit in the same step the boss dies still loses',()=>{
 const g=fresh();g.time=149.99;g.tick(.02,0,0);const b=g.boss;
 step(g,1.01);
 const dir={x:b.dx,y:b.dy};
 g.x=b.x+dir.x*150;g.y=b.y+dir.y*150;g.hp=1;
 step(g,.9);assert.equal(b.state,'dash');
 // Advance until the dash is one tick from contact, kill the boss, then take the hit.
 for(let i=0;i<60&&Math.hypot(b.x-g.x,b.y-g.y)>46;i++)g.tick(.01,0,0);
 b.hp=1;g.hit(b,999);assert.ok(b.hp<=0,'boss is dying too');
 g.tick(.01,0,0);
 assert.equal(g.phase,'lost','player death is judged first');
 assert.equal(g.deathCause,'Boss冲撞');
});
