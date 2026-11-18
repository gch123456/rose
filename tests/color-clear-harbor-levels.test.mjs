import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {ColorClearGame} from '../assets/scripts/color-clear/ColorClearGame.ts';
import {HARBOR_STAGES, makeHarborStage} from '../assets/scripts/color-clear/ColorClearHarborLevels.ts';

test('generated harbor stages enclose a clear center and introduce a middle difficulty', () => {
    assert.deepEqual(HARBOR_STAGES.map(({id}) => id), [11, 13, 12]);
    for (const [stage, min, max, space] of [
        [HARBOR_STAGES[0], 260, 380, 3],
        [HARBOR_STAGES[1], 650, 1050, 4],
    ]) {
        const {level, exitIds} = makeHarborStage(stage.id);
        assert.ok(level.cells.length >= min && level.cells.length <= max);
        assert.ok(level.cells.every(({x,y,z}) => Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) > space));
        assert.equal(new Set(level.cells.map(({x,y,z}) => `${x},${y},${z}`)).size, level.cells.length);
        assert.ok(exitIds.size > 20);
        const gateColor = stage.palette.length - 1;
        assert.ok(level.cells.every(cell => exitIds.has(cell.id) === (cell.color === gateColor)));
        const supply = level.supply.flat();
        for (let color = 0; color < stage.palette.length; color++) {
            const count = level.cells.filter(cell => cell.color === color).length;
            assert.ok(count > 0);
            assert.equal(supply.filter(capsule => capsule.color === color).reduce((sum, capsule) => sum + capsule.ammo, 0), count);
        }
    }
});

test('harbor routes have shootable opening heads, open before all-clear, and use four slots without aid', () => {
    for (const stage of HARBOR_STAGES.slice(0, 2)) {
        const {level, exitIds} = makeHarborStage(stage.id);
        const game = new ColorClearGame(level, stage.tier, () => .2);
        const startYaw = game.yaw;
        const colors = new Set(game.visibleTargets().map(cell => cell.color));
        assert.ok(game.supply.every(queue => colors.has(queue[0].color)));
        assert.equal(new Set(game.supply.map(queue => queue[0].color)).size, stage.palette.length);
        let openedAt;
        let turned = false;
        for (const step of level.replay) {
            game.rotate(step.yaw - game.yaw, step.pitch - game.pitch);
            if (!openedAt && Math.abs(Math.sin(game.yaw - startYaw)) > .7) turned = true;
            assert.equal(game.select(step.column), true);
            for (let tick = 0; tick < step.ticks; tick++) {
                game.tick(.1);
                if (!openedAt && !game.cells.some(cell => cell.alive && exitIds.has(cell.id))) openedAt = game.shots;
            }
        }
        assert.ok(openedAt >= 60 && openedAt < level.cells.length * .6);
        if (stage.id === 13) assert.equal(turned, true, 'bridge route requires finding the side lock');
        assert.equal(game.phase, 'won');
        assert.equal(game.shots, level.cells.length);
        assert.equal(game.slots.length, 4);
        assert.equal(game.continued, false);
    }
});

test('wizard remains a 4500-cell all-clear challenge', () => {
    const payload = JSON.parse(readFileSync(new URL('../assets/resources/color-clear-release/wizard.json', import.meta.url), 'utf8'));
    const {level, exitIds} = makeHarborStage(12, payload, 1);
    assert.equal(level.cells.length, 4500);
    assert.equal(exitIds.size, 0);
    assert.throws(() => makeHarborStage(999));
});

test('campaign shell victory stops the lane route as soon as the golden exit opens', () => {
    for (const stage of HARBOR_STAGES.slice(0, 2)) {
        const {level, exitIds} = makeHarborStage(stage.id);
        const game = new ColorClearGame(level, stage.tier, () => .2, {exitIds});
        assert.equal(game.exitRemaining, exitIds.size);

        for (const step of level.replay) {
            game.rotate(step.yaw - game.yaw, step.pitch - game.pitch);
            assert.equal(game.select(step.column), true);
            for (let tick = 0; tick < step.ticks; tick++) game.tick(.1);
            if (game.phase === 'won') break;
        }
        assert.equal(game.phase, 'won');
        assert.equal(game.exitRemaining, 0);
        assert.ok(game.remaining > level.cells.length * .4, 'the body is saved without stripping all side panels');
        assert.equal(game.drainEvents().filter(event => event.type === 'won').length, 1);
    }
});
