import assert from 'node:assert/strict';
import test from 'node:test';
import {ColorClearGame} from '../assets/scripts/color-clear/ColorClearGame.ts';

function makeLevel(ammoByColumn = [90]) {
    let id = 0;
    const cells = ammoByColumn.flatMap((ammo, color) => Array.from({length: ammo}, (_, i) => ({
        id: id++, x: i % 10 + color * 11, y: Math.floor(i / 10), z: 0, color, alive: true, core: false,
    })));
    return {
        id: 123, name: '弹仓节奏', cells, pacing: 'fast', solution: [],
        supply: ammoByColumn.map((ammo, color) => [{id: color, color, ammo}]),
    };
}

function play(ammoByColumn, ammoRhythm, step = 1 / 60) {
    const level = makeLevel(ammoByColumn);
    const game = new ColorClearGame(level, 'warmup', () => .5, {ammoRhythm});
    for (let column = 0; column < ammoByColumn.length; column++) assert.equal(game.select(column), true);
    const durations = ammoByColumn.map(() => []);
    const targets = new Set();
    let elapsed = 0;
    while (game.phase === 'playing' && elapsed < 24) {
        game.tick(step);
        elapsed += step;
        assert.equal(new Set(game.flights.map(flight => flight.capsuleId)).size, game.flights.length);
        for (const event of game.drainEvents()) {
            if (event.type !== 'fire') continue;
            const flight = game.flights.find(flight => flight.id === event.flightId);
            assert.ok(flight);
            durations[event.slot].push(flight.duration);
            assert.equal(targets.has(flight.target), false);
            targets.add(flight.target);
        }
        const ammo = game.slots.reduce((sum, capsule) => sum + (capsule?.ammo ?? 0), 0);
        assert.equal(ammo + game.flights.length, game.remaining);
    }
    assert.equal(game.phase, 'won');
    assert.equal(game.shots, level.cells.length);
    assert.equal(targets.size, level.cells.length);
    return {durations, elapsed};
}

test('a ninety-round capsule opens at the familiar pace, speeds up, then eases out from the last ten rounds', () => {
    for (const step of [1 / 60, 1 / 30]) {
        const normal = play([90], false, step);
        const fast = play([90], true, step);
        const [duration] = fast.durations;
        assert.deepEqual(duration.slice(0, 3), [.1, .1, .1]);
        assert.ok(duration[5] < duration[3]);
        assert.ok(duration[40] < .065);
        assert.ok(duration[80] > duration[79]);
        assert.ok(duration[89] > duration[80] && duration[89] <= .10);
        assert.ok(fast.elapsed < normal.elapsed * .87, `${step}: ${fast.elapsed} vs ${normal.elapsed}`);
    }
});

test('small capsules keep the old timing even while a large one accelerates in another slot', () => {
    assert.deepEqual(play([12], true), play([12], false));
    const result = play([90, 12], true);
    assert.deepEqual(result.durations[1], Array(12).fill(.1));
    assert.ok(result.durations[0][40] < .065);
});
