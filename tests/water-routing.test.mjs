import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WaterRoutingGame, DIR, rotatePipe} from '../assets/scripts/color-clear/WaterRoutingGame.ts';

const solutions = [
    [3,0,0,2,1,3,2,3,2,1,1,0],
    [1,3,2,1,0,1,1,0,0,3,3,0],
];

test('a pipe click turns ports clockwise and changes which tiles actually receive water', () => {
    assert.equal(rotatePipe(DIR.north | DIR.west), DIR.north | DIR.east);
    const game = new WaterRoutingGame(0);
    assert.equal(game.solved, false);
    assert.equal(game.turn(-1), false);
    assert.equal(game.turn(12), false);
    assert.equal(game.moves, 0);
    const before = game.tiles[0];
    game.turn(0);
    assert.equal(game.tiles[0], rotatePipe(before));
    assert.equal(game.moves, 1);
});

test('outlet stays locked when only one source has a continuous path', () => {
    const game = new WaterRoutingGame(0);
    const leftPath = [0, 4, 8, 9, 5, 6, 10];
    for (const tile of leftPath) {
        for (let i = 0; i < solutions[0][tile]; i++) game.turn(tile);
    }
    assert.equal(game.feeds[game.exit], 1);
    assert.equal(game.solved, false);
});

test('each layout has a complete solution, freezes after confluence, and reopens cleanly', () => {
    solutions.forEach((solution, variant) => {
        const game = new WaterRoutingGame(variant);
        for (const [tile, turns] of solution.entries()) {
            for (let i = 0; i < turns; i++) game.turn(tile);
        }
        assert.equal(game.feeds[game.exit], 3);
        assert.equal(game.solved, true);
        assert.equal(game.turn(0), false);
        assert.equal(new WaterRoutingGame(variant).moves, 0);
    });
});
