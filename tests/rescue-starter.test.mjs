import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRaincoatDuck} from '../assets/scripts/color-clear/ColorClearStarter.ts';
import {measureLevel} from '../assets/scripts/color-clear/ColorClearDifficulty.ts';

test('the raincoat duck is a short three-color rescue with a winning four-slot route', () => {
    const level = makeRaincoatDuck();
    const result = measureLevel(level);
    assert.equal(level.id, 11);
    assert.equal(result.colors, 3);
    assert.ok(result.cells >= 180 && result.cells <= 420);
    assert.equal(result.witnessOutcome, 'won');
    assert.equal(result.witnessShots, result.cells);
    assert.equal(level.cells.filter(cell => cell.visualDetail === 'eye').length, 2);
});
