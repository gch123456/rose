import test from 'node:test';
import assert from 'node:assert/strict';
import { RescueFeedback } from '../assets/scripts/color-clear/ColorClearRescueFeedback.ts';

test('real hits grow the combo at 5, 12 and 20, and silence resets the pace', () => {
    const pace = new RescueFeedback();
    const bursts = [];
    for (let i = 1; i <= 41; i++) {
        const tier = pace.hit(i * .12);
        if (tier) bursts.push([i,tier]);
    }
    assert.deepEqual(bursts, [[5,1],[12,2],[20,3],[40,3]]);
    assert.equal(pace.hit(6), 0);
    assert.equal(pace.count, 1);
    assert.equal(pace.level, 0);
    pace.reset();
    assert.equal(pace.count, 0);
});

test('simultaneous hits may grow the counter without producing repeated milestone effects', () => {
    const pace = new RescueFeedback();
    for (let i = 0; i < 5; i++) pace.hit(0);
    assert.equal(pace.count, 5);
    assert.equal(pace.level, 1);
    assert.equal(pace.hit(0), 0);
});
