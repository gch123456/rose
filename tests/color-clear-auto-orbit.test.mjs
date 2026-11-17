import {test} from 'node:test';import assert from 'node:assert/strict';
import {ColorClearGame} from '../assets/scripts/color-clear/ColorClearGame.ts';import {makeLevel} from '../assets/scripts/color-clear/ColorClearLevels.ts';
import {ModelOrbit} from '../assets/scripts/color-clear/ColorClearOrbit.ts';
test('opening yaw rotates8degrees/sec and stops after manual interaction',()=>{const g=new ColorClearGame(makeLevel(1)),orbit=new ModelOrbit(),yaw=g.yaw;for(let i=0;i<60;i++)orbit.step(g,1/60);assert.ok(Math.abs(g.yaw-yaw-Math.PI*8/180)<1e-8);orbit.stop();const still=g.yaw;orbit.step(g,.1);assert.equal(g.yaw,still);});
test('vertical drag changes pitch; paused/reward state freezes both auto and inertia',()=>{const g=new ColorClearGame(makeLevel(1)),orbit=new ModelOrbit(),pitch=g.pitch;orbit.drag(g,10,-20,.02);assert.notEqual(g.pitch,pitch);g.pause();const state=[g.yaw,g.pitch];orbit.step(g,.2);assert.deepEqual([g.yaw,g.pitch],state);orbit.reset(false);g.resume();const still=[g.yaw,g.pitch];orbit.step(g,.1);assert.deepEqual([g.yaw,g.pitch],still);});

const setup=()=>({g:new ColorClearGame(makeLevel(1)),orbit:new ModelOrbit()});
const samePose=(g,pose)=>assert.deepEqual([g.yaw,g.pitch],pose);
test('enabled automatic orbit holds through drag then resumes after one full idle second',()=>{
 const {g,orbit}=setup();orbit.beginDrag();assert.equal(orbit.enabled,true);assert.equal(orbit.automatic,false);
 orbit.drag(g,10,-20,.02);const pose=[g.yaw,g.pitch];orbit.step(g,10,true);samePose(g,pose);
 orbit.release(false,0);orbit.step(g,.6);orbit.step(g,.39);samePose(g,pose);assert.equal(orbit.automatic,false);
 orbit.step(g,.01);samePose(g,pose);assert.equal(orbit.automatic,true);orbit.step(g,.1);assert.ok(g.yaw>pose[0]);assert.equal(g.pitch,pose[1]);
});
test('holding or redragging restarts the full one-second delay, including cancelled drags',()=>{
 const {g,orbit}=setup();orbit.beginDrag();orbit.step(g,8);assert.equal(orbit.automatic,false);
 orbit.release(false,0);orbit.step(g,.8);orbit.beginDrag();orbit.drag(g,1,1,.02);const pose=[g.yaw,g.pitch];orbit.release(true,0);
 orbit.step(g,.9);samePose(g,pose);assert.equal(orbit.automatic,false);orbit.step(g,.1);samePose(g,pose);assert.equal(orbit.automatic,true);
});
test('pause and reward phases freeze resume timer and long frames cap movement but consume real idle time',()=>{
 const {g,orbit}=setup();orbit.beginDrag();orbit.release(false,0);orbit.step(g,.4);const pose=[g.yaw,g.pitch];g.pause();orbit.step(g,10);samePose(g,pose);g.resume();
 orbit.step(g,.5);samePose(g,pose);assert.equal(orbit.automatic,false);g.phase='reward';orbit.step(g,10);samePose(g,pose);g.phase='playing';orbit.step(g,.1);samePose(g,pose);assert.equal(orbit.automatic,true);
 orbit.beginDrag();orbit.release(false,0);orbit.step(g,5);assert.equal(orbit.automatic,true);assert.ok(Math.abs(g.yaw-pose[0]-8*Math.PI/180*.25)<1e-8);
});
test('explicitly disabled auto preserves manual inertia and never resumes itself',()=>{
 const {g,orbit}=setup();orbit.stop();assert.equal(orbit.enabled,false);orbit.beginDrag();orbit.drag(g,10,5,.02);const pose=[g.yaw,g.pitch];orbit.step(g,.1,true);samePose(g,pose);orbit.release(false,0);orbit.step(g,.1);assert.notEqual(g.yaw,pose[0]);assert.equal(orbit.automatic,false);
 orbit.step(g,20);assert.equal(orbit.enabled,false);orbit.reset();assert.equal(orbit.enabled,true);assert.equal(orbit.automatic,true);orbit.reset(false);assert.equal(orbit.enabled,false);
});
