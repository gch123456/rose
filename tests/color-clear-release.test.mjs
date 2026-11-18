import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {chooseReleaseQueue, makeReleaseLevel, RELEASE_LEVELS, WIZARD_QUEUE_COUNT} from '../assets/scripts/color-clear/ColorClearRelease.ts';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

test('the native catalog matches the two published stages and all shipped wizard layouts', () => {
    const native = read('../assets/resources/color-clear-release/wizard.json');
    const source = read('../preview/color-clear/ready/wizard-level.json');
    const shuffled = read('../preview/color-clear/ready/wizard-shuffles.json');
    assert.deepEqual(RELEASE_LEVELS.map(({id, name}) => [id, name]), [[11, '雨衣鸭'], [12, '法师鸭']]);
    assert.equal(makeReleaseLevel(11).cells.length, 343);
    assert.equal(RELEASE_LEVELS[1].palette.length, source.palette.length);
    assert.equal(WIZARD_QUEUE_COUNT, shuffled.variants.length);

    for (const [index, layout] of [source.level, ...shuffled.variants].entries()) {
        const level = makeReleaseLevel(12, native, index - 1);
        assert.deepEqual(level.cells, source.level.cells);
        assert.deepEqual(level.supply, layout.supply);
        assert.equal(level.pacing, 'fast');
    }
    assert.throws(() => makeReleaseLevel(12, null));
    assert.throws(() => makeReleaseLevel(12, native, 4));
});

test('fresh wizard queues exclude the previous shuffle', () => {
    assert.equal(chooseReleaseQueue(-1, () => .999), 3);
    assert.equal(chooseReleaseQueue(0, () => 0), 1);
    assert.equal(chooseReleaseQueue(3, () => .999), 2);
});
