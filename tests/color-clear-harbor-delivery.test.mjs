import test from 'node:test';
import assert from 'node:assert/strict';
import {HarborDelivery} from '../assets/scripts/color-clear/ColorClearHarborDelivery.ts';

test('a delivery moves the duck only after its block reaches the dock', () => {
    const motion = new HarborDelivery();
    const start = motion.duckX;
    motion.queue(10, -11, 1);
    assert.equal(motion.step(.15), 0);
    assert.equal(motion.duckX, start);
    assert.ok(motion.stride > 0, 'the duck still runs in place');
    assert.equal(motion.step(.17), 1);
    assert.ok(motion.duckX > start);
    motion.step(.4);
    const stopped = motion.duckX;
    const deck = motion.scroll;
    motion.step(.5);
    assert.equal(motion.duckX, stopped);
    assert.equal(motion.scroll, deck);
});

test('closely delivered blocks boost stride speed and batches count every block', () => {
    const single = new HarborDelivery(), combo = new HarborDelivery();
    single.queue(12, -10, 1);
    for (let i = 0; i < 26; i++) combo.queue(i, -10, 1);
    assert.ok(combo.flights.length <= 12);
    assert.equal(single.step(.32), 1);
    assert.equal(combo.step(.32), 26);
    assert.ok(combo.speed > single.speed);
    assert.ok(combo.scroll > single.scroll);
    combo.step(.5);
    assert.equal(combo.speed, 0);
});
