import {buildAnimalCells} from './ColorClearAnimals.ts';
import {getDifficultyProfile, applyDifficulty} from './ColorClearDifficulty.ts';
import { ColorClearGame } from './ColorClearGame.ts';
import type { Capsule, Level } from './ColorClearGame.ts';
export const LEVEL_COUNT = 10;
const NAMES = ['柠檬小鸭', '薄荷小兔', '奶油小猫', '海盐小鸭', '草莓小兔', '天空小猫', '连锁小鸭', '花园小兔', '彩虹小猫', '晚安小鸭'];
/** Original animal silhouettes assembled from solid primitives, with deterministic solutions. */
export function makeLevel(number: number): Level {
    const id = Math.max(1, Math.min(LEVEL_COUNT, Math.floor(number) || 1));
    const profile = getDifficultyProfile(id);
    const cells = applyDifficulty(buildAnimalCells(id), profile);
    const result: Level = { id, name: NAMES[id - 1], cells, initialYaw: .55, initialPitch: .24, supply: [[], [], [], []], solution: [] };
    const sim = new ColorClearGame({ ...result, supply: [[], [], [], []] });
    let serial = 0;
    while (sim.remaining) {
        // Alternate viewpoints so the witness teaches rotation as well as selection.
        let yaw = .55 + (profile.viewStride ? Math.floor(serial / profile.viewStride) % 4 * Math.PI / 2 : 0);
        sim.yaw = yaw;
        let visible = sim.visibleTargets();
        // Catalogue geometry may evolve; only choose viewpoints with a real target.
        for (let turn = 1; !visible.length && turn <= 4; turn++) {
            yaw += Math.PI / 2; sim.yaw = yaw; visible = sim.visibleTargets();
        }
        const target = visible.sort((a, b) => Number(b.core) - Number(a.core) || b.z - a.z || b.y - a.y)[0];
        if (!target) throw new Error('Level has unreachable geometry');
        const color = target.color;
        const capsule: Capsule = { id: serial, color, ammo: profile.shotBudget };
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
        const column = (serial * (profile.lanes - 1)) % profile.lanes;
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
