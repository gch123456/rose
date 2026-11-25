import type {Level, RescueTier, Voxel} from './ColorClearGame.ts';
import {ColorClearGame} from './ColorClearGame.ts';
import {makeReleaseLevel, RELEASE_LEVELS} from './ColorClearRelease.ts';
import {harborDuckParts, harborDuckScale} from './ColorClearHarborDuckGeometry.ts';
import type {HarborDuckRegion} from './ColorClearHarborDuckGeometry.ts';

type HarborStage = {id: number; name: string; palette: readonly string[]; tier: RescueTier};
type HarborStageData = {level: Level; exitIds: ReadonlySet<number>};

export const HARBOR_STAGES: readonly HarborStage[] = [
    {id: 11, name: '雨衣鸭', palette: ['#57BFA7', '#FFDE93', '#F69B66'], tier: 'warmup'},
    {id: 13, name: '渡船鸭', palette: ['#68B5D4', '#FFE29D', '#F29968', '#9AADDF'], tier: 'planning'},
    RELEASE_LEVELS[1],
];

const shellStages = new Map<number, HarborStageData>();

const neighbors = [[1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]];
const gridKey = (x: number, y: number, z: number): string => `${x},${y},${z}`;
const regionColor: Record<HarborDuckRegion, number> = {coat: 0, face: 1, beak: 2, cap: 3};

function makeSurface(stage: HarborStage): Voxel[] {
    const scale = harborDuckScale(stage.id);
    const parts = harborDuckParts(stage.id).map(part => {
        const angle = part.roll * Math.PI / 180;
        const [x, y, z] = part.position.map(value => value * scale);
        const [rx, ry, rz] = part.size.map(value => value * scale / 2);
        const cos = Math.cos(angle), sin = Math.sin(angle);
        return {x, y, z, rx, ry, rz, cos, sin, region: part.region};
    });
    const enclosing = new Map<string, Voxel>();
    const bound = Math.ceil(3.1 * scale);
    for (let y = -bound; y <= bound; y++) {
        for (let z = -bound; z <= bound; z++) {
            for (let x = -bound; x <= bound; x++) {
                let region: HarborDuckRegion | undefined;
                let closest = Infinity;
                for (const part of parts) {
                    const dx = x - part.x, dy = y - part.y, dz = Math.abs(z - part.z);
                    const u = Math.abs(dx * part.cos + dy * part.sin);
                    const v = Math.abs(dy * part.cos - dx * part.sin);
                    // Compare the voxel's projected extent against the same
                    // ellipsoid as the intact 3D duck, then peel inside voxels.
                    const margin = .5 * (Math.abs(part.cos) + Math.abs(part.sin));
                    const nearX = Math.max(0, u - margin) / part.rx;
                    const nearY = Math.max(0, v - margin) / part.ry;
                    const nearZ = Math.max(0, dz - .5) / part.rz;
                    if (nearX * nearX + nearY * nearY + nearZ * nearZ > 1) continue;
                    const radius = Math.hypot(u / part.rx, v / part.ry, dz / part.rz);
                    const distance = (radius - 1) * Math.min(part.rx, part.ry, part.rz);
                    if (distance >= closest) continue;
                    closest = distance;
                    region = part.region;
                }
                if (region !== undefined) {
                    enclosing.set(gridKey(x, y, z), {id: -1, x, y, z, color: regionColor[region], core: false, alive: true});
                }
            }
        }
    }

    const shell = Array.from(enclosing.values()).filter(({x, y, z}) =>
        neighbors.some(([dx, dy, dz]) => !enclosing.has(gridKey(x + dx, y + dy, z + dz))));
    shell.forEach((cell, id) => { cell.id = id; });
    // Anchor eye highlights on the two front blocks nearest the actual eyes.
    const face = shell.filter(cell => cell.color === regionColor.face
        && cell.z > 0 && !enclosing.has(gridKey(cell.x, cell.y, cell.z + 1)));
    for (const sign of [-1, 1]) {
        const x = sign * scale * .57, y = scale * 1.60, z = scale * 2.03;
        const best = face.reduce<Voxel | undefined>((answer, cell) => {
            if (cell.x * sign <= 0) return answer;
            const distance = (cell.x - x) ** 2 + (cell.y - y) ** 2 + .35 * (cell.z - z) ** 2;
            if (!answer || distance < (answer.x - x) ** 2 + (answer.y - y) ** 2 + .35 * (answer.z - z) ** 2) return cell;
            return answer;
        }, undefined);
        if (best) best.visualDetail = 'eye';
    }
    return shell;
}

export function makeRaincoatSurface(): Voxel[] {
    return makeSurface(HARBOR_STAGES[0]);
}

function makeShell(stage: HarborStage, bridge: boolean): HarborStageData {
    const cells = makeSurface(stage);
    return {level: planShell(stage, cells, bridge ? 26 : 12), exitIds: new Set(cells.map(cell => cell.id))};
}

/** Deal a color-varied queue while recording a supply-only route. Each
 * capsule carries just the shots it can actually fire from its planned view. */
function planShell(stage: HarborStage, cells: Voxel[], budget: number): Level {
    const level: Level = {
        id: stage.id, name: stage.name, cells, pacing: 'fast', initialYaw: .42, initialPitch: .20,
        supply: [[], [], [], []], solution: [], replay: [],
    };
    const game = new ColorClearGame(level);
    const order = stage.palette.length === 3 ? [1, 0, 2] : [3, 0, 1, 2, 3, 0, 3, 1, 3, 2];
    let next = 0;
    // Let the reference route turn when the current surface runs out of a color.
    const turns = [.42, -.75, 1.2, -.5 * Math.PI, .5 * Math.PI, Math.PI];
    const replay = level.replay!;
    while (game.phase === 'playing') {
        if (replay.length >= cells.length) throw new Error('码头关卡参考通路过长');
        let selected = -1;
        const poses = [game.yaw, ...turns];
        for (let offset = 0; offset < order.length && selected === -1; offset++) {
            const index = (next + offset) % order.length;
            for (const yaw of poses) {
                game.rotate(yaw - game.yaw, 0);
                if (!game.visibleTargets().some(cell => cell.color === order[index])) continue;
                selected = order[index];
                next = (index + 1) % order.length;
                break;
            }
        }
        if (selected === -1) throw new Error('码头积木没有可见目标');
        const capsule = {id: replay.length, color: selected, ammo: budget};
        // Keep a placeholder capsule available during planning so running out
        // of the current color does not mark this partially built level lost.
        game.supply = [[{...capsule}, {id: -1, color: selected, ammo: 1}], [], [], []];
        if (!game.select(0)) throw new Error('码头关卡无法装填参考弹药');
        const start = game.shots;
        let ticks = 0;
        while (game.phase === 'playing'
            && (game.flights.length || (game.slots[0] && game.visibleTargets().some(cell => cell.color === selected)))) {
            if (++ticks > budget * 5) throw new Error('码头弹药没有完成消除');
            game.tick(.1);
        }
        const ammo = game.shots - start;
        if (!ammo) throw new Error('码头参考弹药无法命中');
        const column = replay.length % 4;
        level.supply[column].push({...capsule, ammo});
        replay.push({column, yaw: game.yaw, pitch: game.pitch, ticks});
        game.slots[0] = null;
    }
    if (game.phase !== 'won') throw new Error('码头关卡参考通路未完成');
    return level;
}

export function makeHarborStage(id: number, wizardPayload?: unknown, queueIndex = -1): HarborStageData {
    if (id === HARBOR_STAGES[2].id) return {level: makeReleaseLevel(id, wizardPayload, queueIndex), exitIds: new Set()};
    const cached = shellStages.get(id);
    if (cached) return cached;
    const stage = HARBOR_STAGES.find(entry => entry.id === id);
    if (!stage) throw new Error('未发布的码头救援关卡');
    const result = makeShell(stage, id === HARBOR_STAGES[1].id);
    shellStages.set(id, result);
    return result;
}
