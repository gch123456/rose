import {ColorClearGame} from './ColorClearGame.ts';
import type {Level, Voxel} from './ColorClearGame.ts';

export type DifficultyProfile = {
    tier: 'warmup' | 'planning' | 'challenge'; label: string;
    shotBudget: number; lanes: number; accentRegions: number; coreStride: number; viewStride: number;
};
/** Design parameters, not measured human win rates. Return a fresh value to isolate runs. */
export function getDifficultyProfile(number: number): DifficultyProfile {
    const id = Math.max(1, Math.min(10, Math.floor(number) || 1));
    return {
        tier: id <= 3 ? 'warmup' : id <= 6 ? 'planning' : 'challenge',
        label: id <= 3 ? '轻松上手' : id <= 6 ? '顺序规划' : '多面挑战',
        shotBudget: [14, 12, 10, 8, 7, 6, 5, 4, 3, 3][id - 1],
        lanes: 4,
        accentRegions: id <= 3 ? 0 : id <= 6 ? 1 : 2,
        coreStride: id <= 3 ? 0 : id <= 6 ? 19 : 31,
        viewStride: id === 1 ? 0 : id <= 3 ? 4 : id <= 6 ? 2 : 1,
    };
}
/** Preserve anatomy palette; added colors form solid back/underside regions, never noise. */
export function applyDifficulty(cells: Voxel[], profile: DifficultyProfile): Voxel[] {
    return cells.map(c => ({...c,
        color: profile.accentRegions >= 2 && c.y <= -1 && c.x < 0 ? 5
            : profile.accentRegions >= 1 && c.z < 0 && c.y <= 1 ? (profile.accentRegions >= 2 ? 4 : 3) : c.color,
        core: profile.coreStride > 0 && c.z >= 0 && (c.id + 3) % profile.coreStride === 0,
    }));
}

export function measureLevel(level: Level) {
    const g = new ColorClearGame(level), options = [];
    let previousColor = -1, colorTransitions = 0, previousYaw = g.yaw, witnessViewChanges = 0;
    for (const action of level.solution) {
        options.push(new Set(g.supply.filter(q => q.length).map(q => q[0].color)).size);
        const capsule = g.supply[action.column]?.[0];
        if (!capsule) throw new Error('Witness queue is missing a capsule');
        if (previousColor !== -1 && previousColor !== capsule.color) colorTransitions++;
        previousColor = capsule.color;
        if (Math.abs(action.yaw - previousYaw) > 1e-8) witnessViewChanges++;
        previousYaw = action.yaw; g.rotate(action.yaw - g.yaw);
        if (!g.select(action.column)) throw new Error('Witness cannot load a capsule');
        for (let tick = 0; tick < 600 && g.phase === 'playing' && g.slots.some(Boolean); tick++) g.tick(.1);
        if (g.phase === 'won') break;
        if (g.phase !== 'playing' || g.slots.some(Boolean)) throw new Error('Witness stalled');
    }
    if (g.phase !== 'won') throw new Error('Witness failed to finish');
    const capsules = level.supply.flat();
    let neighborPairs = 0, colorBoundaries = 0;
    for (const a of level.cells) for (const b of level.cells) {
        if (a.id >= b.id || Math.abs(a.x-b.x)+Math.abs(a.y-b.y)+Math.abs(a.z-b.z) !== 1) continue;
        neighborPairs++; if (a.color !== b.color) colorBoundaries++;
    }
    return {cells: level.cells.length, colors: new Set(level.cells.map(c=>c.color)).size,
        cores: level.cells.filter(c=>c.core).length, capsules: capsules.length,
        totalAmmo: capsules.reduce((n,c)=>n+c.ammo,0), colorTransitions,
        colorBoundaries, neighborPairs,
        meanQueueOptions: Number((options.reduce((a,b)=>a+b,0)/options.length).toFixed(3)),
        witnessViewChanges, witnessShots: g.shots, witnessOutcome: g.phase,
        witnessPeakSlots: 1, rewardUses: 0,
    };
}

export type Policy = 'front-first' | 'visible-first' | 'seeded';
/** Bounded reproducible heuristics with no solution access. Timeout is not an impossibility proof. */
export function simulatePolicy(level: Level, policy: Policy, seed = 1, maxTicks = 1800) {
    const g = new ColorClearGame(level); let ticks = 0, peakSlots = 0, state = seed >>> 0;
    const random = () => {state = (Math.imul(state,1664525)+1013904223)>>>0; return state/4294967296;};
    while (ticks < maxTicks && g.phase === 'playing') {
        if (ticks % 6 === 0) {
            const visible = g.visibleTargets(), columns = g.supply.map((q,i)=>q.length ? i : -1).filter(i=>i>=0);
            if (policy === 'visible-first') columns.sort((a,b)=>visible.filter(c=>c.color===g.supply[b][0].color).length-visible.filter(c=>c.color===g.supply[a][0].color).length || a-b);
            if (policy === 'seeded') for(let i=columns.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[columns[i],columns[j]]=[columns[j],columns[i]];}
            for (const column of columns) {
                if (policy === 'visible-first' && !visible.some(c=>c.color===g.supply[column][0].color)) continue;
                g.select(column);
            }
        }
        peakSlots = Math.max(peakSlots,g.slots.filter(Boolean).length);
        g.rotate(.035); g.tick(.2); ticks++;
    }
    return {policy, seed, maxTicks, outcome: g.phase === 'playing' ? 'timeout' : g.phase,
        ticks, shots: g.shots, remaining: g.remaining, peakSlots, rewardUses: 0};
}
