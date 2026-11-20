import test from 'node:test';
import assert from 'node:assert/strict';
import { RescueFeedback, hitFountain, launcherRecoil } from '../assets/scripts/color-clear/ColorClearRescueFeedback.ts';

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

test('one shot gives a quick damped kick and the launcher returns exactly to rest', () => {
    assert.ok(launcherRecoil(0).y < 0);
    assert.ok(launcherRecoil(.026).x > 0);
    assert.ok(launcherRecoil(.066).x < 0);
    assert.deepEqual(launcherRecoil(.2), {x: 0, y: 0});
    assert.deepEqual(launcherRecoil(Infinity), {x: 0, y: 0});
});

test('hit fountain fans out upward, grows with a combo and respects the particle budget', () => {
    const regular = hitFountain(false, 6, () => .5);
    const streak = hitFountain(true, 10, () => .5);
    assert.ok(regular.length < streak.length);
    assert.ok(streak.some(chip => chip.vx < 0) && streak.some(chip => chip.vx > 0));
    assert.ok(Math.max(...streak.map(chip => chip.vy)) > Math.max(...regular.map(chip => chip.vy)));
    assert.ok(streak.every(chip => chip.vy > 0 && chip.life < .65));
    assert.equal(hitFountain(true, 2).length, 2);
    assert.deepEqual(hitFountain(true, 0), []);
});
