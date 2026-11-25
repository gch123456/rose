import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WaterRescueGame} from '../assets/scripts/color-clear/WaterRescueGame.ts';

test('left and right open independently, each arrives once, and a single stream cannot open the flood valve', () => {
    const game = new WaterRescueGame();
    assert.equal(game.open('left'), true);
    assert.equal(game.open('left'), false);
    assert.deepEqual(game.advance(2), ['left']);
    assert.deepEqual(game.advance(60), []);
    assert.equal(game.available('drain'), false);
    assert.equal(game.open('drain'), false);
    assert.equal(game.won, false);
});

test('rapid opening in either order yields one confluence after both streams arrive', () => {
    for (const first of ['left', 'right']) {
        const game = new WaterRescueGame();
        assert.equal(game.open(first), true);
        assert.equal(game.open(first === 'left' ? 'right' : 'left'), true);
        assert.deepEqual(game.advance(.2), []);
        assert.equal(game.available('drain'), false);
        const arrivals = game.advance(3);
        assert.deepEqual(arrivals.slice(0, 2).sort(), ['left', 'right']);
        assert.deepEqual(arrivals.slice(2), ['merge']);
        assert.equal(game.available('drain'), true);
        assert.deepEqual(game.advance(2), []);
    }
});

test('drain wins on impact and a replay starts with all valves reset', () => {
    const game = new WaterRescueGame();
    game.open('left');
    game.open('right');
    game.advance(3);
    assert.equal(game.open('drain'), true);
    assert.equal(game.open('drain'), false);
    assert.deepEqual(game.advance(.1), []);
    assert.equal(game.won, false);
    assert.deepEqual(game.advance(2), ['drain']);
    assert.equal(game.won, true);
    assert.deepEqual(game.advance(4), []);
    const replay = new WaterRescueGame();
    assert.equal(replay.available('left'), true);
    assert.equal(replay.available('drain'), false);
});
