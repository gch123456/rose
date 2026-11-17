import {ColorClearGame} from './ColorClearGame.ts';
import type {Level, Capsule, Voxel} from './ColorClearGame.ts';
import {validateLevelCells} from './ColorClearLevels.ts';

const MAX_JSON_BYTES = 2_000_000;
function record(value: unknown, keys: string[]): Record<string, unknown> {
    if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error('关卡数据必须为对象');
    const r = value as Record<string,unknown>;
    if (Object.keys(r).some(k=>!keys.includes(k))) throw new Error('关卡包含未支持的字段');
    return r;
}
function integer(value:unknown, min:number, max:number):number {
    if(typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max) throw new Error('关卡整数超出范围');
    return value;
}
function angle(value:unknown, fallback:number, max:number):number {
    if(value===undefined)return fallback;
    if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>max) throw new Error('关卡视角无效');
    return value;
}
/** Strict data-only interchange; replay is mandatory, not just an ammunition checksum. */
export function decodeLevel(input: unknown): Level {
    if (typeof input==='string') {
        if(input.length>MAX_JSON_BYTES||new TextEncoder().encode(input).length>MAX_JSON_BYTES) throw new Error('关卡JSON超过2MB');
        try { input=JSON.parse(input); } catch { throw new Error('关卡JSON格式无效'); }
    }
    const envelope=record(input,['version','level','palette']);
    if(envelope.version!==1) throw new Error('不支持的关卡版本');
    const raw=record(envelope.level,['id','name','cells','supply','initialYaw','initialPitch','solution','replay','pacing']);
    if(raw.pacing!==undefined&&raw.pacing!=='remaining')throw new Error('清除节奏无效');
    const id=integer(raw.id,1,Number.MAX_SAFE_INTEGER);
    if(typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>80) throw new Error('关卡名称无效');
    if(!Array.isArray(raw.cells)||raw.cells.length>6000) throw new Error('积木数量超限');
    for(const c of raw.cells) record(c,['id','x','y','z','color','core','alive','shape']);
    const cells=validateLevelCells(raw.cells as Voxel[]);
    if(envelope.palette!==undefined){
        const p=envelope.palette;
        if(!Array.isArray(p)||p.length<2||p.length>6||!p.every(c=>typeof c==='string'&&/^#[0-9a-fA-F]{6}$/.test(c))||cells.some(c=>c.color>=p.length))throw new Error('调色板必须包含2–6个十六进制颜色并覆盖全部积木');
    }
    if(!Array.isArray(raw.supply)||raw.supply.length!==4) throw new Error('关卡需要四条供应队列');
    const capsuleIds=new Set<number>();
    const supply:Capsule[][]=raw.supply.map(q=>{
        if(!Array.isArray(q)||q.length>400)throw new Error('供应队列无效');
        return q.map(v=>{
            const c=record(v,['id','color','ammo']),id=integer(c.id,0,Number.MAX_SAFE_INTEGER);
            if(capsuleIds.has(id))throw new Error('弹筒ID重复');
            capsuleIds.add(id);
            return {id,color:integer(c.color,0,5),ammo:integer(c.ammo,1,6000)};
        });
    });
    if(capsuleIds.size>400)throw new Error('弹筒超过400上限');
    for(let color=0;color<6;color++)if(cells.filter(c=>c.color===color).length!==supply.flat().filter(c=>c.color===color).reduce((n,c)=>n+c.ammo,0))throw new Error('每色弹量必须等于积木数量');
    if(!Array.isArray(raw.solution)||raw.solution.length>400||(raw.replay===undefined&&raw.solution.length!==capsuleIds.size))throw new Error('参考通路长度无效');
    const solution=raw.solution.map(v=>{const a=record(v,['column','yaw']);if(typeof a.yaw!=='number')throw new Error('参考通路缺少视角');return {column:integer(a.column,0,3),yaw:angle(a.yaw,0,Math.PI*16)};});
    const level:Level={...(raw.pacing?{pacing:raw.pacing}:{}),id,name:raw.name,cells,supply,solution,initialYaw:angle(raw.initialYaw,0,Math.PI*16),initialPitch:angle(raw.initialPitch,0,Math.PI/2)};
    if(raw.replay!==undefined){
        if(!Array.isArray(raw.replay)||!raw.replay.length||raw.replay.length>20000||solution.length)throw new Error('长弹筒通路长度无效');
        let total=0;
        level.replay=raw.replay.map(v=>{
            const a=record(v,['yaw','pitch','column','ticks']);
            if(typeof a.yaw!=='number'||typeof a.pitch!=='number')throw new Error('参考通路缺少视角');
            const ticks=integer(a.ticks,0,60000);total+=ticks;if(total>60000)throw new Error('参考通路时长超限');
            return {yaw:angle(a.yaw,0,Math.PI*16),pitch:angle(a.pitch,0,Math.PI/2),...(a.column===undefined?{}:{column:integer(a.column,0,3)}),ticks};
        });
    }
    // Object callers receive the same byte limit, after structural bounds have
    // made serialization allocation safe.
    const canonical=JSON.stringify({version:1,level});
    if(canonical.length>MAX_JSON_BYTES||new TextEncoder().encode(canonical).length>MAX_JSON_BYTES)throw new Error('关卡JSON超过2MB');
    const g=new ColorClearGame(level);
    for(const action of level.replay??[]){
        if(g.phase!=='playing')throw new Error('参考通路包含多余步骤');
        g.rotate(action.yaw-g.yaw,action.pitch-g.pitch);
        if(action.column!==undefined&&!g.select(action.column))throw new Error('参考通路无法装填');
        for(let tick=0;tick<action.ticks;tick++)g.tick(.1);
        g.drainEvents();
    }
    for(const action of solution){
        if(g.phase!=='playing')throw new Error('参考通路包含多余步骤');
        g.rotate(action.yaw-g.yaw);
        if(!g.select(action.column))throw new Error('参考通路无法装填');
        for(let tick=0;tick<6500&&g.phase==='playing'&&(g.slots.some(Boolean)||g.flights.length);tick++)g.tick(.1);
        if(g.slots.some(Boolean)||g.flights.length)throw new Error('参考通路在当前视角无法清空弹筒');
    }
    if(g.phase!=='won'||g.shots!==cells.length||g.supply.some(q=>q.length)||g.slots.length!==4)throw new Error('参考通路未能在四槽无奖励条件下通关');
    return level;
}
export function encodeLevel(level:Level):string {
    return JSON.stringify({version:1,level:decodeLevel({version:1,level})},null,2);
}
