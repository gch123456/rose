import type {Voxel} from './ColorClearGame';

/** Shared original model catalogue; logical pieces and rendered geometry stay aligned. */
export function buildAnimalCells(id: number): Voxel[] {
    const cells: Voxel[] = [];
    const animal = (id - 1) % 3;
    const ellipsoid = (x: number, y: number, z: number, cx: number, cy: number, rx: number, ry: number, rz: number) => ((x-cx)/rx)**2 + ((y-cy)/ry)**2 + (z/rz)**2 <= 1;
    for (let y = -3; y <= 5; y++) for (let x = -4; x <= 4; x++) for (let z = -2; z <= 2; z++) {
        let inside = false, color = 1, shape: Voxel['shape'] = 'sphere';
        if (animal === 0) {
            const body = ellipsoid(x,y,z,-1,-.3,3,2.2,2.2), head = ellipsoid(x,y,z,1.7,2,1.6,1.55,1.55);
            const beak = x >= 3 && x <= 4 && y === 2 && Math.abs(z) <= (x === 4 ? 0 : 1);
            const feet = y === -3 && (x === -2 || x === 0) && Math.abs(z) <= 1;
            const tail = x === -4 && y === 0 && z === 0;
            inside = body || head || beak || feet || tail;
            color = beak || feet ? 0 : body && Math.abs(z) === 2 ? 2 : 1;
            shape = beak || tail ? 'wedge' : feet ? 'hemisphere' : body && y < 0 ? 'box' : 'sphere';
        } else {
            const body = ellipsoid(x,y,z,0,-.7,2.3,2.1,1.8), head = ellipsoid(x,y,z,0,1.8,2.0,1.6,1.5);
            const ears = animal === 1 ? Math.abs(x) === 1 && y >= 3 && y <= 5 && z === 0 : Math.abs(x) === 1 && y === 4 && Math.abs(z) <= 1;
            const feet = y === -3 && Math.abs(x) === 1 && Math.abs(z) <= 1;
            const tail = animal === 2 && x === -3 && y >= -1 && y <= 1 && z === 0;
            inside = body || head || ears || feet || tail;
            color = ears ? 0 : feet ? 1 : (Math.abs(z) === 1 && body ? 2 : animal === 1 ? 3 : 1);
            shape = ears ? (animal === 1 ? 'cylinder' : 'wedge') : feet ? 'hemisphere' : 'sphere';
        }
        if (!inside) continue;
        const core = id >= 3 && z === 1 && (x * 7 + y * 11 + id * 3) % 13 === 0;
        cells.push({ id: cells.length, x, y, z, color, core, shape, alive: true });
    }
    return cells;
}
