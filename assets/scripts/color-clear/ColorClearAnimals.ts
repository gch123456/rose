import type {Voxel} from './ColorClearGame';

/** Shared original model catalogue; logical pieces and rendered geometry stay aligned. */
export function buildAnimalCells(id: number): Voxel[] {
    const cells: Voxel[] = [];
    const animal = (id - 1) % 3;
    const ellipsoid = (x: number, y: number, z: number, cx: number, cy: number, rx: number, ry: number, rz: number) => ((x-cx)/rx)**2 + ((y-cy)/ry)**2 + (z/rz)**2 <= 1;
    // Resample the solid anatomy, rather than duplicating/overlapping old cells.
    const scale = 1.6;
    for (let iy = -5; iy <= 8; iy++) for (let ix = -7; ix <= 7; ix++) for (let iz = -4; iz <= 4; iz++) {
        const x = ix/scale, y = iy/scale, z = iz/scale;
        let inside = false, color = 1;
        if (animal === 0) {
            const body = ellipsoid(x,y,z,-1,-.3,3,2.2,2.2), head = ellipsoid(x,y,z,1.7,2,1.6,1.55,1.55);
            const beak = x >= 3 && x <= 4 && Math.abs(y-2)<.4 && Math.abs(z) <= (x > 3.6 ? .4 : 1);
            const feet = y < -2.5 && (Math.abs(x+2)<.4 || Math.abs(x)<.4) && Math.abs(z) <= 1;
            const tail = x < -3.5 && Math.abs(y)<.4 && Math.abs(z)<.4;
            inside = body || head || beak || feet || tail;
            color = beak || feet ? 0 : body && Math.abs(z) >= 1.5 ? 2 : 1;
        } else {
            const body = ellipsoid(x,y,z,0,-.7,2.3,2.1,1.8), head = ellipsoid(x,y,z,0,1.8,2.0,1.6,1.5);
            const ears = animal === 1 ? Math.abs(Math.abs(x)-1)<.4 && y >= 3 && y <= 5 && Math.abs(z)<.4 : Math.abs(Math.abs(x)-1)<.4 && y > 3.5 && y <= 4 && Math.abs(z) <= 1;
            const feet = y < -2.5 && Math.abs(Math.abs(x)-1)<.4 && Math.abs(z) <= 1;
            const tail = animal === 2 && x < -2.5 && y >= -1 && y <= 1 && Math.abs(z)<.4;
            inside = body || head || ears || feet || tail;
            color = ears ? 0 : feet ? 1 : (Math.abs(z) >= 1 && body ? 2 : animal === 1 ? 3 : 1);
        }
        if (!inside) continue;
        const core = id >= 4 && iz >= 0 && (ix * 7 + iy * 11 + id * 3) % 31 === 0;
        cells.push({ id: cells.length, x:ix, y:iy, z:iz, color, core, shape: 'box', alive: true });
    }
    return cells;
}
