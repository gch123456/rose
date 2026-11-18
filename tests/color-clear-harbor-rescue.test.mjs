import test from 'node:test';
import assert from 'node:assert/strict';
import {ColorClearGame} from '../assets/scripts/color-clear/ColorClearGame.ts';
import {makeHarborStage} from '../assets/scripts/color-clear/ColorClearHarborLevels.ts';

const level = () => ({id:99, name:'Rescue fixture', pacing:'fast', solution:[],
    cells:Array.from({length: 4}, (_, id) => ({id, x:id * 2, y:0, z:0, color:id % 2, alive:true, core:false})),
    supply:[[{id:0,color:0,ammo:2}],[{id:1,color:1,ammo:2}],[],[]]});
function balanced(game) {
    for (let color = 0; color < 4; color++) {
        const ammo = [...game.supply.flat(), ...game.slots.filter(Boolean), ...game.reserve]
            .filter(c => c.color === color).reduce((sum, c) => sum + c.ammo, 0);
        assert.equal(ammo + game.flights.filter(f => f.color === color).length,
            game.cells.filter(c => c.alive && c.color === color).length);
    }
}

test('opening the gate ends the rescue with other shell blocks still on the stage', () => {
    const game = new ColorClearGame(level(), 'warmup', Math.random, {exitIds: new Set([0])});
    assert.ok(game.select(0));
    game.tick(.01);
    game.tick(.1);
    assert.equal(game.phase, 'won');
    assert.equal(game.remaining, 3);
    assert.equal(game.exitRemaining, 0);
    balanced(game);
    game.restart();
    assert.equal(game.exitRemaining, 1);
});

test('water spends exactly matching ammo and leaves claimed shot targets alone', () => {
    const {level: rain, exitIds} = makeHarborStage(11);
    const game = new ColorClearGame(rain, 'warmup', Math.random, {exitIds});
    assert.ok(game.select(0));
    game.tick(.01);
    const shot = game.flights[0];
    assert.ok(shot);
    assert.equal(game.openShellWithWater(10), 10);
    assert.ok(game.cells.find(cell => cell.id === shot.target).alive);
    assert.equal(game.shots, 1);
    balanced(game);
    game.tick(.1);
    balanced(game);
});

test('being caught does not become an optional ad or emergency rescue', () => {
    const game = new ColorClearGame(level(), 'challenge', Math.random, {freeStallRescue:true, exitIds: new Set([0])});
    assert.ok(game.select(1));
    game.caughtByCook();
    assert.equal(game.phase, 'lost');
    assert.equal(game.openShellWithWater(10), 0);
    assert.equal(game.canUseEmergencyReserve, false);
    assert.equal(game.canContinue, false);
    assert.equal(game.beginReward('continue'), null);
});
