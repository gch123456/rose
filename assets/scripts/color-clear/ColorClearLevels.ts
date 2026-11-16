import { ColorClearGame } from './ColorClearGame.ts';
import type { Voxel, Capsule, Level } from './ColorClearGame.ts';
export const LEVEL_COUNT = 10;
const NAMES = ['柠檬小鸭', '薄荷小兔', '奶油小猫', '海盐小鸭', '草莓小兔', '天空小猫', '连锁小鸭', '花园小兔', '彩虹小猫', '晚安小鸭'];
/** Original animal silhouettes assembled from solid primitives, with deterministic solutions. */
export function makeLevel(number: number): Level {
    const id = Math.max(1, Math.min(LEVEL_COUNT, Math.floor(number) || 1));
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
            shape = beak || tail ? 'wedge' : feet ? 'hemisphere' : body && y < 0 ? 'cylinder' : 'sphere';
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
        if (id >= 4 && (x + y + z + id + 30) % 7 === 0) color = (color + 1) % 4;
        const core = id >= 3 && z === 1 && (x * 7 + y * 11 + id * 3) % 13 === 0;
        cells.push({ id: cells.length, x, y, z, color, core, shape, alive: true });
    }
    const result: Level = { id, name: NAMES[id - 1], cells, initialYaw: .55, initialPitch: .24, supply: [[], [], [], []], solution: [] };
    const sim = new ColorClearGame({ ...result, supply: [[], [], [], []] });
    let serial = 0;
    while (sim.remaining) {
        // Alternate viewpoints so the witness teaches rotation as well as selection.
        const yaw = .55 + (id === 1 ? 0 : (serial % 4) * Math.PI / 2);
        sim.yaw = yaw;
        const visible = sim.visibleTargets();
        const target = visible.sort((a, b) => Number(b.core) - Number(a.core) || b.z - a.z || b.y - a.y)[0];
        if (!target) throw new Error('Level has unreachable geometry');
        const color = target.color;
        const capsule: Capsule = { id: serial, color, ammo: id === 1 ? 12 : 9 + id };
        sim.slots = [{ ...capsule }, null, null, null];
        const before = sim.shots;
        // Supply sentinel keeps witness simulation from declaring exhaustion between batches.
        sim.supply = [[{ id: -1, color, ammo: 999 }], [], [], []];
        for (let step = 0; step < 160; step++) {
            if (!sim.flights.length && (!sim.slots[0] || !sim.visibleTargets().some(c => c.color === color))) break;
            sim.tick(.12);
        }
        const spent = sim.shots - before;
        if (!spent) throw new Error('Invalid solution witness');
        capsule.ammo = spent;
        const column = serial % 4;
        result.supply[column].push(capsule); result.solution.push({ column, yaw });
        serial++;
        if (serial > 200) throw new Error('Level witness exceeded budget');
    }
    return result;
}
/** Explicit QA-only URL fixture: actual reward/continue UI can be exercised without cheating a normal level. */
export function makeRescueFixture(): Level {
    return { id: 1, name: '续关测试', initialYaw: 0, solution: [], cells: [
        {id:0,x:0,y:0,z:0,color:1,core:false,alive:true},
        ...[[-1,0,0],[1,0,0],[0,0,-1],[0,0,1],[0,-1,0],[0,1,0]].map(([x,y,z],i)=>({id:i+1,x,y,z,color:0,core:false,alive:true})),
    ], supply: Array.from({length:4},(_,i)=>[{id:i,color:1,ammo:3},...(i===0?[{id:4,color:0,ammo:6}]:[])]) };
}
