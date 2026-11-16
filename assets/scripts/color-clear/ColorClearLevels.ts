import { ColorClearGame } from './ColorClearGame.ts';
import type { Voxel, Capsule, Level } from './ColorClearGame.ts';
export const LEVEL_COUNT = 10;
const NAMES = ['初见方糖', '转个方向', '薄荷小岛', '彩虹拱门', '心动积木', '连锁花园', '糖果火箭', '云端礼物', '旋转工坊', '最后一颗'];
/** Original deterministic silhouettes; a simulated witness authors ammunition, never changes it mid-run. */
export function makeLevel(number: number): Level {
    const id = Math.max(1, Math.min(LEVEL_COUNT, Math.floor(number) || 1));
    const cells: Voxel[] = [];
    const radius = id === 1 ? 2 : id < 5 ? 3 : 4;
    for (let y = -radius; y <= radius; y++) for (let x = -radius; x <= radius; x++) for (let z = -2; z <= 2; z++) {
        const nx = x / (radius + .35), ny = y / (radius + .35);
        let inside = nx * nx + ny * ny < 1.05;
        if (id === 4 || id === 8) inside = Math.abs(x) >= radius - 1 || y >= radius - 1 || y <= -radius + 1;
        if (id === 5 || id === 10) inside = Math.pow(nx * nx + ny * ny - .65, 3) - nx * nx * ny * ny * ny < 0;
        if (id === 7) inside = Math.abs(x) <= Math.max(1, radius - Math.floor((y + radius) / 2));
        if (!inside || (Math.abs(z) === 2 && Math.abs(x) === radius)) continue;
        const color = id === 1 ? (z >= 1 ? 0 : z === 0 ? 2 : 1) : (Math.floor((x + radius) / 2) + Math.floor((y + radius) / 3) + z + 8 + id) % Math.min(4, id + 1);
        const core = id >= 3 && z === 1 && ((x * 7 + y * 11 + id * 3) % 13 === 0);
        cells.push({ id: cells.length, x, y, z, color, core, alive: true });
    }
    const result: Level = { id, name: NAMES[id - 1], cells, initialYaw: .55, supply: [[], [], [], []], solution: [] };
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
        for (let step = 0; step < 80 && sim.slots[0] && sim.visibleTargets().some(c => c.color === color); step++) sim.tick(.12);
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
