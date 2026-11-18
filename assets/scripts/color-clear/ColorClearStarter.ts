import type { Voxel } from './ColorClearGame.ts';
import { makeLevelFromCells } from './ColorClearLevels.ts';

export const RAINCOAT_DUCK_ID = 11;
export const WIZARD_RESCUE_ID = 12;
export const RAINCOAT_PALETTE = ['#5fb79f', '#ffca54', '#eb684a'];

type Shape = [number, number, number, number, number, number];
function inside(x: number, y: number, z: number, [cx, cy, cz, rx, ry, rz]: Shape) {
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1;
}

export function makeRaincoatDuck() {
    const cells: Voxel[] = [];
    for (let y = -5; y <= 6; y++) for (let z = -5; z <= 6; z++) for (let x = -4; x <= 4; x++) {
        const is = (shape: Shape) => inside(x, y, z, shape);
        const head = is([0, 2.4, 1.15, 3.2, 3.15, 3.15]);
        const hood = is([0, 3.1, .25, 3.48, 3, 3.08]);
        const bill = is([0, 1.3, 4.45, 1.9, .99, 1.7]);
        const body = is([0, -1.8, -.7, 3.65, 2.55, 3.78]);
        const wing = is([2.7, -1.2, -.75, 1.13, 1.4, 2.22]) || is([-2.7, -1.2, -.75, 1.13, 1.4, 2.22]);
        const tail = is([0, -.65, -3.6, 1.5, 1.37, 1.58]);
        const boots = is([1.85, -4, 1.2, 1.1, .92, 1.8]) || is([-1.85, -4, 1.2, 1.1, .92, 1.8]);
        if (!(head || hood || bill || body || wing || tail || boots)) continue;
        const color = bill || boots ? 2 : head && z >= 2 && y < 5 ? 1 : 0;
        const shades = [
            ['#85cdb0', '#5fb79f', '#48a88c'],
            ['#ffdd75', '#ffcc56', '#efb947'],
            ['#fa8a61', '#eb684a', '#d75642'],
        ];
        const accent = color === 0 && (wing || y >= 4) ? 0 : y < -2 ? 2 : 1;
        const detail = color === 1 && Math.abs(x) === 2 && y === 3 && z === 3 ? 'eye'
            : bill && x === 0 && y === 1 && z === 6 ? 'bill' : undefined;
        cells.push({ id: cells.length, x, y, z, color, alive: true, core: false, shape: 'box',
            visualTint: shades[color][accent], ...(detail ? { visualDetail: detail } : {}) });
    }
    return makeLevelFromCells(cells, { id: RAINCOAT_DUCK_ID, name: '雨衣鸭', difficulty: 'easy', batchSize: 22, pacing: 'fast' });
}
