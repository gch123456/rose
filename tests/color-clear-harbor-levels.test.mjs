import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {ColorClearGame} from '../assets/scripts/color-clear/ColorClearGame.ts';
import {harborDuckParts, harborDuckScale} from '../assets/scripts/color-clear/ColorClearHarborDuckGeometry.ts';
import {HARBOR_STAGES, makeHarborStage} from '../assets/scripts/color-clear/ColorClearHarborLevels.ts';

test('the wearable shell protects a recognizable duck without filling its interior', () => {
    assert.deepEqual(HARBOR_STAGES.map(({id}) => id), [11, 13, 12]);
    const rain = makeHarborStage(11);
    const bridge = makeHarborStage(13);
    assert.ok(rain.level.cells.length >= 290 && rain.level.cells.length <= 510);
    assert.ok(bridge.level.cells.length >= 600 && bridge.level.cells.length <= 950);
    for (const stage of HARBOR_STAGES.slice(0, 2)) {
        const {level, exitIds} = makeHarborStage(stage.id);
        const cells = level.cells;
        const bounds = key => [
            Math.min(...cells.map(cell => cell[key])),
            Math.max(...cells.map(cell => cell[key])),
        ];
        assert.equal(new Set(cells.map(({x,y,z}) => `${x},${y},${z}`)).size, cells.length);
        assert.ok(cells.every(cell => exitIds.has(cell.id)), 'every exposed block is required');
        assert.equal(exitIds.size, cells.length);
        assert.equal(cells.filter(cell => cell.visualDetail === 'eye').length, 2);
        assert.ok(!cells.some(cell => cell.x === 0 && cell.y === -1 && cell.z === 0), 'the interior remains hollow');
        const [lowX,highX] = bounds('x'), [lowY,highY] = bounds('y'), [lowZ,highZ] = bounds('z');
        assert.ok(!cells.some(cell => Math.abs(cell.x) === Math.max(-lowX, highX)
            && [lowY, highY].includes(cell.y) && [lowZ,highZ].includes(cell.z)));
        const supply = level.supply.flat();
        for (let color = 0; color < stage.palette.length; color++) {
            const count = cells.filter(cell => cell.color === color).length;
            assert.ok(count > 0);
            assert.equal(supply.filter(capsule => capsule.color === color).reduce((sum, capsule) => sum + capsule.ammo, 0), count);
        }
    }
});

test('sampled outer surfaces of the smooth duck have a corresponding nearby block', () => {
    for (const id of [11,13]) {
        const parts = harborDuckParts(id);
        const scale = harborDuckScale(id);
        const {level} = makeHarborStage(id);
        let checked = 0;
        for (const part of parts) {
            const radians = part.roll * Math.PI / 180;
            const cos = Math.cos(radians), sin = Math.sin(radians);
            for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
                const length = Math.hypot(a,b,c);
                if (!length) continue;
                const [u,v,w] = [a,b,c].map((n,i) => n * part.size[i] / (2 * length));
                const [x,y,z] = [u*cos-v*sin, u*sin+v*cos, w].map((n,i) => n + part.position[i]);
                const coveredByOtherPart = parts.some(other => {
                    if (other === part) return false;
                    const angle = other.roll * Math.PI / 180;
                    const [dx,dy,dz] = [x,y,z].map((n,i) => n - other.position[i]);
                    return Math.hypot(
                        2 * (dx*Math.cos(angle)+dy*Math.sin(angle)) / other.size[0],
                        2 * (dy*Math.cos(angle)-dx*Math.sin(angle)) / other.size[1],
                        2 * dz / other.size[2],
                    ) < .99;
                });
                if (coveredByOtherPart) continue;
                checked++;
                assert.ok(level.cells.some(cell => Math.hypot(cell.x-x*scale,cell.y-y*scale,cell.z-z*scale) < 2),
                    `${id} ${part.name} surface at ${x}, ${y}, ${z}`);
            }
        }
        assert.ok(checked > 130);
    }
});

test('all beginning capsules are shootable and a four-slot run must remove the full surface', () => {
    for (const stage of HARBOR_STAGES.slice(0, 2)) {
        const {level, exitIds} = makeHarborStage(stage.id);
        const game = new ColorClearGame(level, stage.tier, () => .2, {exitIds});
        const colors = new Set(game.visibleTargets().map(cell => cell.color));
        assert.ok(game.supply.every(queue => colors.has(queue[0].color)));
        assert.equal(new Set(game.supply.map(queue => queue[0].color)).size, stage.palette.length);
        let turned = false;
        const initialYaw = game.yaw;
        for (const step of level.replay) {
            game.rotate(step.yaw - game.yaw, step.pitch - game.pitch);
            if (Math.abs(Math.sin(game.yaw - initialYaw)) > .7) turned = true;
            assert.equal(game.phase, 'playing');
            assert.equal(game.select(step.column), true);
            for (let tick = 0; tick < step.ticks; tick++) {
                game.tick(.1);
                if (game.remaining > 0) assert.notEqual(game.phase, 'won');
            }
        }
        if (stage.id === 13) assert.equal(turned, true, 'bridge encourages turning the duck');
        assert.equal(game.phase, 'won');
        assert.equal(game.remaining, 0);
        assert.equal(game.exitRemaining, 0);
        assert.equal(game.shots, level.cells.length);
        assert.equal(game.drainEvents().filter(event => event.type === 'won').length, 1);
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
