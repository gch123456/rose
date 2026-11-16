import {buildAnimalCells} from './ColorClearAnimals.ts';
import {getDifficultyProfile, applyDifficulty} from './ColorClearDifficulty.ts';
import { ColorClearGame } from './ColorClearGame.ts';
import type { Capsule, Level, Voxel } from './ColorClearGame.ts';
export const LEVEL_COUNT = 10;
const NAMES = ['柠檬小鸭', '薄荷小兔', '奶油小猫', '海盐小鸭', '草莓小兔', '天空小猫', '连锁小鸭', '花园小兔', '彩虹小猫', '晚安小鸭'];
/** Original animal silhouettes assembled from solid primitives, with deterministic solutions. */
export function makeLevel(number: number): Level {
    const id = Math.max(1, Math.min(LEVEL_COUNT, Math.floor(number) || 1));
    const profile = getDifficultyProfile(id);
    const cells = applyDifficulty(buildAnimalCells(id), profile);
    return generateLevel(cells, {id, name:NAMES[id-1], batchSize:profile.shotBudget}, profile.viewStride);
}
export type LevelOptions = {id?:number; name?:string; difficulty?:'easy'|'normal'|'hard'; batchSize?:number};
/** Validate bounded lattice data before geometry or witness work. */
export function validateLevelCells(cells: Voxel[]): Voxel[] {
    if (!Array.isArray(cells) || !cells.length || cells.length > 800) throw new Error('积木数量必须为1–800');
    const ids = new Set<number>(), positions = new Set<string>();
    const shapes = new Set(['box','sphere','cylinder','hemisphere','wedge']);
    return cells.map(c => {
        if (!c || !Number.isSafeInteger(c.id) || c.id < 0 || ids.has(c.id)) throw new Error('积木ID必须唯一');
        if (![c.x,c.y,c.z].every(n=>Number.isInteger(n)&&Math.abs(n)<=1000)) throw new Error('积木坐标必须为有限整数且不超1000');
        const key = `${c.x},${c.y},${c.z}`;
        if (positions.has(key)) throw new Error('积木坐标重复');
        if (!Number.isInteger(c.color) || c.color<0 || c.color>5 || typeof c.core!=='boolean' || c.alive!==true || (c.shape!==undefined&&!shapes.has(c.shape))) throw new Error('积木颜色或形状无效');
        ids.add(c.id); positions.add(key);
        return {id:c.id,x:c.x,y:c.y,z:c.z,color:c.color,core:c.core,alive:true,...(c.shape?{shape:c.shape}:{})};
    });
}
export function makeLevelFromCells(cells: Voxel[], options: LevelOptions = {}): Level {
    const stride = options.difficulty === 'easy' ? 0 : options.difficulty === 'hard' ? 1 : 2;
    return generateLevel(cells, options, stride);
}
function generateLevel(input: Voxel[], options: LevelOptions, viewStride: number): Level {
    const cells = validateLevelCells(input), id = options.id ?? 1, name = options.name ?? '自制关卡';
    const budget = options.batchSize ?? (options.difficulty==='easy'?14:options.difficulty==='hard'?4:8);
    if (!Number.isSafeInteger(id)||id<1||typeof name!=='string'||!name.trim()||name.length>80) throw new Error('关卡ID或名称无效');
    if (!Number.isInteger(budget)||budget<1||budget>800) throw new Error('每筒弹量必须为1–800');
    if(options.difficulty!==undefined&&!['easy','normal','hard'].includes(options.difficulty)) throw new Error('难度无效');
    const result: Level = { id, name, cells, initialYaw: .55, initialPitch: .24, supply: [[], [], [], []], solution: [] };
    const sim = new ColorClearGame(result);
    let serial = 0;
    while (sim.remaining) {
        let yaw = .55 + (viewStride ? Math.floor(serial / viewStride) % 4 * Math.PI / 2 : 0);
        sim.yaw = yaw;
        const visible = sim.visibleTargets();
        const target = visible.sort((a,b)=>Number(b.core)-Number(a.core)||b.y-a.y||a.id-b.id)[0];
        if (!target) throw new Error('模型没有可剥离的目标');
        const color = target.color;
        const capsule: Capsule = { id: serial, color, ammo: budget };
        sim.slots = [{ ...capsule }, null, null, null];
        const before = sim.shots;
        // A sentinel prevents an intermediate empty batch from ending the construction simulation.
        sim.supply = [[{ id: -1, color, ammo: 1 }], [], [], []];
        for (let step=0;step<budget*8+16;step++) {
            if (!sim.flights.length && (!sim.slots[0] || !sim.visibleTargets().some(c=>c.color===color))) break;
            sim.tick(.12);
            if(sim.phase==='won') break;
        }
        capsule.ammo = sim.shots-before;
        if (!capsule.ammo || sim.flights.length) throw new Error('无法构造参考通路');
        const column = serial%4;
        result.supply[column].push(capsule); result.solution.push({column,yaw});
        if (++serial>400) throw new Error('参考通路超过400筒上限，请增加连续批次弹量或简化配色');
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
