import test from 'node:test';
import assert from 'node:assert/strict';
import {capsuleInk, contrastRatio} from '../preview/color-clear/capsule-color.js';

test('ammo text on all shipped duck colors and custom dark or light colors meets 4.5:1', () => {
    for (const color of ['#5fb79f','#ffca54','#eb684a','#e8ebe4','#174d8b','#69b8d2','#e7b74c','#795536','#273438','#777777','#000000','#FFFFFF']) {
        assert.ok(contrastRatio(color, capsuleInk(color)) >= 4.5, color);
    }
});
