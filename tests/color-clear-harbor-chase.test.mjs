import assert from 'node:assert/strict';
import test from 'node:test';

import { HarborChase } from '../assets/scripts/color-clear/ColorClearHarborChase.ts';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `expected ${a} to be close to ${b}`);

test('the bridge has a quiet opening, and inactivity gives time to recover before capture', () => {
    const chase = new HarborChase('bridge');
    assert.ok(chase.separation > .55 && chase.separation < .7);
    const start = chase.separation;

    chase.tick(20);
    near(chase.separation, start);
    chase.tick(8);
    assert.ok(chase.separation > .3 && chase.separation < start);
    chase.tick(30);
    assert.equal(chase.separation, 0);
    assert.equal(chase.caught, true);
    chase.hit(100);
    chase.freeze();
    assert.equal(chase.caught, true);
    assert.equal(chase.frozen, 0);
});

test('the tutorial allows a chase but is safe indefinitely, and long mode has extra time', () => {
    const tutorial = new HarborChase('tutorial');
    const start = tutorial.separation;
    tutorial.tick(300);
    assert.ok(tutorial.separation > 0 && tutorial.separation < start);
    assert.equal(tutorial.caught, false);
    tutorial.hit();
    assert.ok(tutorial.separation > .2);

    const bridge = new HarborChase('bridge');
    const long = new HarborChase('long');
    bridge.tick(50);
    long.tick(50);
    assert.equal(bridge.caught, true);
    assert.equal(long.caught, false);
});

test('successful hits gain distance and create a short protected window', () => {
    const chase = new HarborChase('bridge');
    chase.tick(30);
    const low = chase.separation;
    chase.hit(10);
    assert.ok(chase.separation > low);
    const afterHit = chase.separation;
    chase.tick(.5);
    near(chase.separation, afterHit);
    chase.tick(3);
    assert.ok(chase.separation > low && chase.separation < afterHit);
    for (let hit = 0; hit < 80; hit++) {
        chase.hit();
        chase.tick(.3);
    }
    assert.equal(chase.separation, 1);
});

test('freezing stops approach, can be refreshed without stacking, and expires inside a long tick', () => {
    const chase = new HarborChase('bridge');
    chase.tick(22);
    const start = chase.separation;
    chase.freeze();
    assert.equal(chase.frozen, 5);
    chase.tick(3);
    near(chase.separation, start);
    assert.equal(chase.frozen, 2);
    chase.freeze(1);
    assert.equal(chase.frozen, 2);
    chase.tick(3);
    assert.equal(chase.frozen, 0);
    assert.ok(chase.separation < start);
});

test('invalid operations do not change distance or time, and protection overlaps consistently across frame sizes', () => {
    const largeFrame = new HarborChase('bridge');
    const smallFrames = new HarborChase('bridge');
    for (const chase of [largeFrame, smallFrames]) {
        chase.tick(19);
        chase.hit();
        chase.freeze();
    }
    const start = largeFrame.separation;
    for (const invalid of [NaN, Infinity, -1, 0]) {
        largeFrame.tick(invalid);
        largeFrame.hit(invalid);
        largeFrame.freeze(invalid);
    }
    near(largeFrame.separation, start);
    assert.equal(largeFrame.frozen, 5);
    largeFrame.tick(6);
    for (let frame = 0; frame < 60; frame++) smallFrames.tick(.1);
    near(largeFrame.separation, smallFrames.separation);
});
