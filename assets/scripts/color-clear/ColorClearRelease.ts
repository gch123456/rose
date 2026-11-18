import type { Capsule, Level, RescueTier, Voxel } from './ColorClearGame.ts';
import { validateLevelCells } from './ColorClearLevels.ts';
import { makeRaincoatDuck, RAINCOAT_DUCK_ID, RAINCOAT_PALETTE, WIZARD_RESCUE_ID } from './ColorClearStarter.ts';

export const WIZARD_QUEUE_COUNT = 4;
type ReleaseStage = { id: number; name: string; palette: readonly string[]; tier: RescueTier };

export const RELEASE_LEVELS: readonly ReleaseStage[] = [
    { id: RAINCOAT_DUCK_ID, name: '雨衣鸭', palette: RAINCOAT_PALETTE, tier: 'warmup' },
    { id: WIZARD_RESCUE_ID, name: '法师鸭', palette: ['#e8ebe4', '#174d8b', '#69b8d2', '#e7b74c', '#795536', '#273438'], tier: 'challenge' },
];

export function chooseReleaseQueue(previous: number, random = Math.random): number {
    const choices = Array.from({ length: WIZARD_QUEUE_COUNT }, (_, index) => index).filter(index => index !== previous);
    const draw = random();
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('随机数无效');
    return choices[Math.floor(draw * choices.length)];
}

type WizardData = { cells: Voxel[]; queues: Capsule[][][]; yaw: number; pitch: number };
const wizardCache = new WeakMap<object, WizardData>();
let raincoat: Level | undefined;

function boundedInteger(value: unknown, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
        throw new Error('法师鸭资源整数超出范围');
    }
    return value;
}

function decodeWizard(payload: unknown): WizardData {
    if (!payload || typeof payload !== 'object') throw new Error('缺少法师鸭资源');
    const cached = wizardCache.get(payload);
    if (cached) return cached;
    const { version, pose, tints, cells: packedCells, queues: packedQueues } = payload as Record<string, unknown>;
    if (version !== 1 || !Array.isArray(pose) || pose.length !== 2 || !pose.every(Number.isFinite)
        || Math.abs(pose[0]) > Math.PI * 16 || Math.abs(pose[1]) > Math.PI / 2
        || !Array.isArray(tints) || tints.length > 256 || !tints.every(tint => typeof tint === 'string' && /^#[0-9a-f]{6}$/i.test(tint))
        || !Array.isArray(packedCells) || packedCells.length !== 4500
        || !Array.isArray(packedQueues) || packedQueues.length !== WIZARD_QUEUE_COUNT + 1) {
        throw new Error('法师鸭资源结构无效');
    }
    const colorCount = RELEASE_LEVELS[1].palette.length;
    const counts = Array<number>(colorCount).fill(0);
    const cells = validateLevelCells(packedCells.map((cell, id) => {
        if (!Array.isArray(cell) || cell.length !== 6) throw new Error('积木资源无效');
        const [x, y, z, color, tint, detail] = cell;
        const logicalColor = boundedInteger(color, 0, colorCount - 1);
        counts[logicalColor]++;
        return {
            id, x, y, z, color: logicalColor, core: false, alive: true, shape: 'box',
            visualTint: tints[boundedInteger(tint, 0, tints.length - 1)],
            visualDetail: [undefined, 'eye', 'bill'][boundedInteger(detail, 0, 2)] as Voxel['visualDetail'],
        };
    }));
    const queues = packedQueues.map(layout => {
        if (!Array.isArray(layout) || layout.length !== 4) throw new Error('法师鸭供应需要四列');
        const ids = new Set<number>();
        const totals = Array<number>(colorCount).fill(0);
        const supply: Capsule[][] = layout.map(lane => {
            if (!Array.isArray(lane) || lane.length > 400) throw new Error('法师鸭供应列无效');
            return lane.map(tube => {
                if (!Array.isArray(tube) || tube.length !== 3) throw new Error('弹筒资源无效');
                const id = boundedInteger(tube[0], 0, 399);
                if (ids.has(id)) throw new Error('弹筒编号重复');
                ids.add(id);
                const color = boundedInteger(tube[1], 0, colorCount - 1);
                const ammo = boundedInteger(tube[2], 1, 6000);
                totals[color] += ammo;
                return { id, color, ammo };
            });
        });
        if (!counts.every((count, color) => count === totals[color])) throw new Error('法师鸭弹药和积木不匹配');
        return supply;
    });
    const decoded = { cells, queues, yaw: pose[0] as number, pitch: pose[1] as number };
    wizardCache.set(payload, decoded);
    return decoded;
}

/** The build validates solution replays. Native boot only checks the compact shipped resource. */
export function makeReleaseLevel(id: number, wizardPayload?: unknown, queueIndex = -1): Level {
    if (id === RAINCOAT_DUCK_ID) return raincoat ??= makeRaincoatDuck();
    if (id !== WIZARD_RESCUE_ID) throw new Error('未发布的救援关卡');
    if (!Number.isInteger(queueIndex) || queueIndex < -1 || queueIndex >= WIZARD_QUEUE_COUNT) {
        throw new Error('法师鸭供应索引无效');
    }
    const data = decodeWizard(wizardPayload);
    return {
        id, name: RELEASE_LEVELS[1].name, pacing: 'fast', cells: data.cells,
        supply: data.queues[queueIndex + 1], solution: [], initialYaw: data.yaw, initialPitch: data.pitch,
    };
}
