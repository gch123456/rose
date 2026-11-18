import test from 'node:test';
import assert from 'node:assert/strict';
import {ColorClearGame} from '../assets/scripts/color-clear/ColorClearGame.ts';

function level(colors, supply) {
    return {id: 1, name: '测试', pacing: 'fast', solution: [], supply,
        cells: colors.map((color, id) => ({id, x: id, y: 0, z: 0, alive: true, core: false, color}))};
}
const tube = (id, color, ammo = 1) => ({id, color, ammo});
const advance = (game) => { for (let i = 0; i < 120; i++) game.tick(.05); };

test('five consecutive same-color hits earn a bonus without spending extra ammo or changing targets', () => {
    const game = new ColorClearGame(level([0,0,0,0,1,...Array(9).fill(0)], [[tube(0,0,4),tube(1,1),tube(2,0,9)],[],[],[]]), 'warmup');
    for (let i = 0; i < 3; i++) { assert.ok(game.select(0)); advance(game); }
    assert.equal(game.phase, 'won');
    assert.equal(game.shots, 14);
    assert.equal(game.bonusCount, 1);
    assert.equal(game.drainEvents().filter(event => event.type === 'bonus').length, 1);
    game.restart();
    assert.equal(game.bonusCount, 0);
});

test('mystery counts stay fixed within a run and always reveal the first two rows', () => {
    const supply = Array.from({length:4}, (_, column) => Array.from({length:4}, (_, row) => tube(column*4+row,0)));
    for (const [tier, min, max] of [['warmup',0,0], ['planning',1,2], ['challenge',2,4]]) {
        const game = new ColorClearGame(level([0], supply), tier, () => .3);
        const hidden = () => supply.flatMap((queue, column) => queue.map((_, row) => game.isAmmoHidden(column,row)));
        assert.deepEqual(hidden(), hidden());
        const count = hidden().filter(Boolean).length;
        assert.ok(count >= min && count <= max);
        for (let column = 0; column < 4; column++) for (let row = 0; row < 2; row++) assert.equal(game.isAmmoHidden(column,row), false);
        assert.deepEqual(game.supply, supply);
    }
});

test('earned emergency reserve rescues one full-slot stall exactly once and preserves ammunition', () => {
    const game = new ColorClearGame(level([0,0,0,0,0,1], [
        [tube(0,0,5),tube(1,1)],[],[],[]
    ]), 'challenge');
    assert.ok(game.select(0)); advance(game);
    game.slots = [tube(2,2), tube(3,2), tube(4,2), tube(5,2)];
    game.tick(.05);
    assert.equal(game.phase, 'lost');
    assert.ok(game.canUseEmergencyReserve);
    assert.ok(game.useEmergencyReserve());
    assert.equal(game.phase, 'playing');
    assert.deepEqual(game.reserve, [tube(2,2)]);
    assert.equal(game.slots.filter(Boolean).length, 3);
    assert.equal(game.useEmergencyReserve(), false);
    assert.equal(game.shots, 5);
    assert.ok(game.select(0)); advance(game);
    assert.equal(game.phase, 'won');
});

test('the four-slot rescue can save a true early stall with no ad or prior bonus', () => {
    const game = new ColorClearGame(level([0], [[tube(0,0)],[],[],[]]), 'challenge', () => .1, {freeStallRescue:true});
    game.slots = [tube(1,1,4), tube(2,1), tube(3,1), tube(4,1)];
    game.tick(.05);
    assert.equal(game.bonusCount, 0);
    assert.equal(game.phase, 'lost');
    assert.equal(game.useEmergencyReserve(), true);
    assert.equal(game.slots.length, 4);
    assert.deepEqual(game.reserve, [tube(1,1,4)]);
    assert.equal(game.useEmergencyReserve(), false);
    assert.ok(game.select(0));
    advance(game);
    assert.equal(game.phase, 'won');
});
