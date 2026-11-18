import test from 'node:test';
import assert from 'node:assert/strict';
import {ColorClearGame, canSeeCell} from '../assets/scripts/color-clear/ColorClearGame.ts';

const makeCell = (id, x, y, z, color, core = false, shape = 'box') =>
    ({id, x, y, z, color, core, shape, alive: true});
const level = cells => ({id: 1, name: 'test', cells, supply: [[], [], [], []], solution: [], pacing: 'fast'});
const rank = (a, b) => Number(b.core) - Number(a.core) || b.y - a.y || a.id - b.id;

test('firing needs no full model snapshot or per-target chain traversal', () => {
    const game = new ColorClearGame(level([
        makeCell(10, 0, 4, 0, 0), makeCell(80, 4, 3, 0, 0, true),
        makeCell(30, 8, 3, 0, 0, true), makeCell(50, 12, 1, 0, 1),
    ]));
    game.visibleTargets = () => { throw new Error('full model snapshot in firing path'); };
    game.chainPreview = () => { throw new Error('linear chain lookup in firing path'); };
    game.slots[0] = {id:1, color:0, ammo:1};
    game.slots[1] = {id:2, color:0, ammo:1};
    game.tick(.01);
    assert.deepEqual(game.flights.map(flight => [flight.target, flight.claimed]), [[30,[30]],[80,[80]]]);
});

test('target priority and occlusion match the geometry oracle with multiple in-flight slots', () => {
    const cells = [];
    for (let y = -4; y <= 4; y++) for (let z = -4; z <= 4; z++) for (let x = -4; x <= 4; x++) {
        const id = cells.length * 3 + 7;
        cells.push(makeCell(id, x, y, z, (id % 13) % 4, id % 7 === 0));
    }
    const dense = cells.map(cell => ({...cell}));
    const mixed = [makeCell(50, 1, 1, 0, 0), makeCell(8, 0, 1, 0, 0, true),
        makeCell(11, 0, 1, 1, 1, false, 'sphere'), makeCell(20, 1, 2, 2, 2, true, 'wedge'),
        makeCell(41, 2, 2, 2, 0, false, 'hemisphere'), makeCell(21, 3, 0, 1, 1, false, 'cylinder')];
    for (const source of [dense,mixed]) for (const [yaw,pitch] of [[0,0],[.4,-.32],[Math.PI/4,0],[2.8,Math.PI/2],[5.61,-Math.PI/2],[1.7,.78]]) {
        const game = new ColorClearGame(level(source));
        game.yaw=yaw; game.pitch=pitch;
        for (const [slot,color] of [0,0,1,2].entries()) game.slots[slot]={id:slot,color,ammo:2};
        game.supply[0].push({id:5,color:3,ammo:1});
        const visible = game.cells.filter(cell => canSeeCell(cell, game.cells, yaw, pitch)).sort(rank);
        const claimed = new Set();
        const expected = [0,0,1,2].map(color => {
            const cell = visible.find(cell => cell.color === color && !claimed.has(cell.id));
            if (cell) claimed.add(cell.id);
            return cell?.id;
        }).filter(id => id !== undefined);
        game.tick(.01);
        assert.deepEqual(game.flights.map(flight => flight.target), expected, JSON.stringify({yaw,pitch,kind:source.length}));
    }
});
