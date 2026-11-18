import test from 'node:test';
import assert from 'node:assert/strict';
import { fitRescueScreen, rescueBlockTint, RESCUE_STAGE } from '../assets/scripts/color-clear/ColorClearNativeStyle.ts';

test('short, tall and inset screens fit the same touch layout with balanced margins', () => {
    for (const rect of [
        {x: 0, y: 0, width: 640, height: 1120},
        {x: 0, y: -133, width: 640, height: 1386},
        {x: 0, y: 72, width: 640, height: 962},
        {x: 52, y: 56, width: 540, height: 1002},
    ]) {
        const {x, y, scale} = fitRescueScreen(rect);
        const left = x + 320 - 309 * scale;
        const right = x + 320 + 309 * scale;
        const bottom = y + 560 - 552 * scale;
        const top = y + 560 + 541 * scale;
        assert.ok(left >= rect.x && right <= rect.x + rect.width);
        assert.ok(bottom >= rect.y && top <= rect.y + rect.height);
        assert.ok(scale >= .81 && scale <= 1);
    }
    assert.ok(RESCUE_STAGE.bottom < RESCUE_STAGE.modelY && RESCUE_STAGE.modelY < RESCUE_STAGE.top);
});

test('a legacy tint only contributes brightness, never its original hue', () => {
    const colors = ['#789BFA', '#F48C78'];
    const a = rescueBlockTint({ color: 0, visualTint: '#174d8b' }, colors);
    const b = rescueBlockTint({ color: 1, visualTint: '#174d8b' }, colors);
    assert.match(a, /^#[0-9a-f]{6}$/);
    assert.ok(parseInt(a.slice(5), 16) > parseInt(a.slice(1, 3), 16));
    assert.ok(parseInt(b.slice(1, 3), 16) > parseInt(b.slice(5), 16));
    assert.equal(rescueBlockTint({ color: 1 }, colors), colors[1]);
});
