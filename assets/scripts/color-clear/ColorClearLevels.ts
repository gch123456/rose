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
export type LevelOptions = {id?:number; name?:string; difficulty?:'easy'|'normal'|'hard'; batchSize?:number; pacing?:'remaining'|'fast'};
/** Validate bounded lattice data before geometry or witness work. */
export function validateLevelCells(cells: Voxel[]): Voxel[] {
    if (!Array.isArray(cells) || !cells.length || cells.length > 6000) throw new Error('积木数量必须为1–6000');
    const ids = new Set<number>(), positions = new Set<string>();
    const shapes = new Set(['box','sphere','cylinder','hemisphere','wedge']);
    return cells.map(c => {
        if (!c || !Number.isSafeInteger(c.id) || c.id < 0 || ids.has(c.id)) throw new Error('积木ID必须唯一');
        if (![c.x,c.y,c.z].every(n=>Number.isInteger(n)&&Math.abs(n)<=1000)) throw new Error('积木坐标必须为有限整数且不超1000');
        const key = `${c.x},${c.y},${c.z}`;
        if (positions.has(key)) throw new Error('积木坐标重复');
        if (!Number.isInteger(c.color) || c.color<0 || c.color>5 || typeof c.core!=='boolean' || c.alive!==true || (c.shape!==undefined&&!shapes.has(c.shape))) throw new Error('积木颜色或形状无效');
        if ((c.visualTint!==undefined&&(typeof c.visualTint!=='string'||!/^#[0-9a-fA-F]{6}$/.test(c.visualTint))) || (c.visualDetail!==undefined&&!['eye','bill'].includes(c.visualDetail))) throw new Error('积木外观无效');
        ids.add(c.id); positions.add(key);
        return {id:c.id,x:c.x,y:c.y,z:c.z,color:c.color,core:c.core,alive:true,...(c.shape?{shape:c.shape}:{}),...(c.visualTint?{visualTint:c.visualTint}:{}),...(c.visualDetail?{visualDetail:c.visualDetail}:{})};
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
    if(options.pacing!==undefined&&options.pacing!=='remaining'&&options.pacing!=='fast')throw new Error('清除节奏无效');
    const result: Level = { ...(options.pacing?{pacing:options.pacing}:{}), id, name, cells, initialYaw: .55, initialPitch: .24, supply: [[], [], [], []], solution: [] };
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

/** Long, conserved capsules with a real four-slot witness. Loaded capsules may
 * survive many camera changes. An impossible bounded plan is rejected. */
export function makeLongBatchLevel(input: Voxel[], options: LevelOptions = {}): Level {
    const cells=validateLevelCells(input), id=options.id??1, name=options.name??'精细模型';
    const budget=options.batchSize??75;
    if(!Number.isSafeInteger(id)||id<1||typeof name!=='string'||!name.trim()||name.length>80)throw new Error('关卡ID或名称无效');
    if(!Number.isInteger(budget)||budget<60||budget>90)throw new Error('长弹筒目标必须为60–90');
    const pending:Capsule[]=[];
    for(let color=0;color<6;color++){
        const count=cells.filter(c=>c.color===color).length;
        const low=Math.ceil(count/90),high=Math.floor(count/60);
        const batches=low<=high?Math.max(low,Math.min(high,Math.round(count/budget))):Math.ceil(count/budget);
        for(let i=0;i<batches;i++)pending.push({id:pending.length,color,ammo:low<=high?Math.floor(count/batches)+(i<count%batches?1:0):Math.min(budget,count-i*budget)});
    }
    if(options.pacing!==undefined&&options.pacing!=='remaining'&&options.pacing!=='fast')throw new Error('清除节奏无效');
    const result:Level={...(options.pacing?{pacing:options.pacing}:{}),id,name,cells,supply:[[],[],[],[]],initialYaw:.55,initialPitch:.24,solution:[],replay:[]};
    const sim=new ColorClearGame({...result,supply:[pending.map(c=>({...c})),[],[],[]]});
    const views=[{yaw:.55,pitch:.24},...[0,Math.PI/2,Math.PI,Math.PI*1.5].flatMap(yaw=>[0,Math.PI/4,-Math.PI/4].map(pitch=>({yaw,pitch}))),{yaw:0,pitch:Math.PI/2},{yaw:0,pitch:-Math.PI/2}];
    let loads=0,totalTicks=0;
    while(sim.phase==='playing'&&sim.remaining){
        const active=new Set(sim.slots.filter((s):s is Capsule=>!!s&&s.ammo>0).map(s=>s.color));
        let best:{yaw:number;pitch:number;color:number;score:number}|undefined;
        // Prefer spending already loaded ammunition before occupying another slot.
        for(const allowLoad of [false,true]){
            if(allowLoad&&!sim.slots.includes(null))break;
            for(const view of views){
                sim.rotate(view.yaw-sim.yaw,view.pitch-sim.pitch);
                const counts=new Map<number,number>();for(const c of sim.visibleTargets())counts.set(c.color,(counts.get(c.color)??0)+1);
                for(const [color,score]of counts){
                    if(allowLoad?active.has(color)||!sim.supply[0].some(c=>c.color===color):!active.has(color))continue;
                    if(!best||score>best.score)best={...view,color,score};
                }
            }
            if(best)break;
        }
        if(!best)throw new Error('长弹筒四槽规划受阻，请调整色区或模型');
        sim.rotate(best.yaw-sim.yaw,best.pitch-sim.pitch);
        const action={yaw:sim.yaw,pitch:sim.pitch,ticks:0} as {yaw:number;pitch:number;ticks:number;column?:number};
        if(!active.has(best.color)){
            const index=sim.supply[0].findIndex(c=>c.color===best!.color), capsule=sim.supply[0].splice(index,1)[0];
            sim.supply[0].unshift(capsule);
            if(!sim.select(0))throw new Error('长弹筒规划无法装填');
            action.column=loads++%4;result.supply[action.column].push({...capsule});
        }
        let idle=0;
        while(sim.phase==='playing'&&idle<5){
            const before=sim.shots;sim.tick(.1);sim.drainEvents();action.ticks++;totalTicks++;
            idle=sim.shots===before&&!sim.flights.length?idle+1:0;
            if(totalTicks>60000)throw new Error('长弹筒参考通路超过时长上限');
        }
        result.replay!.push(action);
        if(result.replay!.length>20000)throw new Error('长弹筒参考通路步骤超限');
    }
    if(sim.phase!=='won'||sim.shots!==cells.length||sim.supply[0].length||sim.slots.some(Boolean)||sim.flights.length)throw new Error('长弹筒参考通路未通关');
    return result;
}

/** Offline seeded permutation of every capsule, followed by a real four-slot
 * head-only planning run. Blocked seeds are rejected rather than changing the
 * queue, granting slots, or rewriting ammunition to manufacture a witness. */
export function planShuffledLevel(baseLevel: Level, seed: number): Level {
    if(!Number.isSafeInteger(seed))throw new Error('随机种子必须为安全整数');
    const cells=validateLevelCells(baseLevel.cells), capsules=baseLevel.supply.flat().map(c=>({...c}));
    if(baseLevel.supply.length!==4||!capsules.length||capsules.length>400)throw new Error('随机供应需要四列且不超过400筒');
    const ids=new Set<number>();
    for(const c of capsules){
        if(!Number.isSafeInteger(c.id)||c.id<0||ids.has(c.id)||!Number.isInteger(c.color)||c.color<0||c.color>5||!Number.isInteger(c.ammo)||c.ammo<1||c.ammo>6000)throw new Error('随机供应弹筒无效');
        ids.add(c.id);
    }
    for(let color=0;color<6;color++)if(cells.filter(c=>c.color===color).length!==capsules.filter(c=>c.color===color).reduce((n,c)=>n+c.ammo,0))throw new Error('随机供应必须逐色守恒');
    let state=seed>>>0;
    const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    for(let i=capsules.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[capsules[i],capsules[j]]=[capsules[j],capsules[i]];}
    const result:Level={...baseLevel,cells,supply:[[],[],[],[]],solution:[],replay:[]};
    capsules.forEach((c,i)=>result.supply[i%4].push(c));
    const sim=new ColorClearGame(result);
    const views=[{yaw:baseLevel.initialYaw??.55,pitch:baseLevel.initialPitch??.24},...[0,Math.PI/2,Math.PI,Math.PI*1.5].flatMap(yaw=>[0,Math.PI/4,-Math.PI/4].map(pitch=>({yaw,pitch}))),{yaw:0,pitch:Math.PI/2},{yaw:0,pitch:-Math.PI/2}];
    let totalTicks=0;
    while(sim.phase==='playing'&&sim.remaining){
        const active=new Set(sim.slots.filter((s):s is Capsule=>!!s&&s.ammo>0).map(s=>s.color));
        let best:{yaw:number;pitch:number;score:number;column?:number}|undefined;
        for(const allowLoad of [false,true]){
            if(allowLoad&&!sim.slots.includes(null))break;
            for(const view of views){
                sim.rotate(view.yaw-sim.yaw,view.pitch-sim.pitch);
                const counts=new Map<number,number>();for(const c of sim.visibleTargets())counts.set(c.color,(counts.get(c.color)??0)+1);
                if(!allowLoad){
                    const score=[...counts].reduce((n,[color,count])=>n+(active.has(color)?count:0),0);
                    if(score&&(!best||score>best.score))best={...view,score};
                }else{
                    for(let column=0;column<4;column++){
                        const head=sim.supply[column][0];
                        if(!head||active.has(head.color))continue;
                        const score=counts.get(head.color)??0;
                        if(score&&(!best||score>best.score))best={...view,score,column};
                    }
                }
            }
            if(best)break;
        }
        if(!best)throw new Error('随机供应四槽规划受阻，请尝试其他种子');
        sim.rotate(best.yaw-sim.yaw,best.pitch-sim.pitch);
        const action={yaw:sim.yaw,pitch:sim.pitch,ticks:0,...(best.column===undefined?{}:{column:best.column})};
        if(best.column!==undefined&&!sim.select(best.column))throw new Error('随机供应无法装填队首');
        let idle=0;
        while(sim.phase==='playing'&&idle<5){
            const before=sim.shots;sim.tick(.1);sim.drainEvents();action.ticks++;totalTicks++;
            idle=sim.shots===before&&!sim.flights.length?idle+1:0;
            if(totalTicks>60000)throw new Error('随机供应参考通路超过时长上限');
        }
        result.replay!.push(action);
        if(result.replay!.length>20000)throw new Error('随机供应参考通路步骤超限');
    }
    if(sim.phase!=='won'||sim.shots!==cells.length||sim.supply.some(q=>q.length)||sim.slots.some(Boolean)||sim.flights.length)throw new Error('随机供应参考通路未通关');
    return result;
}
