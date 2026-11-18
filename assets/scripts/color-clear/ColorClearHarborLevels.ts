import type {Level, RescueTier, Voxel} from './ColorClearGame.ts';
import {ColorClearGame} from './ColorClearGame.ts';
import {makeReleaseLevel, RELEASE_LEVELS} from './ColorClearRelease.ts';

type HarborStage = {id: number; name: string; palette: readonly string[]; tier: RescueTier};
type HarborStageData = {level: Level; exitIds: ReadonlySet<number>};

export const HARBOR_STAGES: readonly HarborStage[] = [
    {id: 11, name: '雨衣鸭', palette: ['#65AF9B', '#DFAC76', '#F3C95D'], tier: 'warmup'},
    {id: 13, name: '渡船鸭', palette: ['#69A7CC', '#78BCAE', '#E2C49D', '#F3C054'], tier: 'planning'},
    RELEASE_LEVELS[1],
];

const shellStages = new Map<number, HarborStageData>();

function makeShell(stage: HarborStage, bridge: boolean): HarborStageData {
    const [hx, hy, hz] = bridge ? [6, 5, 6] : [4, 4, 4];
    const doorColor = stage.palette.length - 1;
    const width = bridge ? 3 : 2;
    const cells: Voxel[] = [];
    const exitIds = new Set<number>();

    for (let y = -hy; y <= hy; y++) {
        for (let z = -hz; z <= hz; z++) {
            for (let x = -hx; x <= hx; x++) {
                const boundary = Number(Math.abs(x) === hx) + Number(Math.abs(y) === hy) + Number(Math.abs(z) === hz);
                const door = Math.abs(x) <= width && y >= -hy + 1 && y <= width
                    && (z === hz || (bridge && z === hz - 1));
                // Chamfer the eight solid corners without exposing the hollow center.
                if ((!boundary && !door) || boundary === 3) continue;

                const rail = Math.abs(y) === hy || (bridge && Math.abs(x) === hx && Math.abs(z) > hz - 3);
                const inset = (y + hy) % 4 === 0 || (Math.abs(x) === hx && Math.abs(z) < 2);
                const sideBolt = bridge && Math.abs(x) === hx && z >= 3 && y >= -2 && y <= 1;
                const color = door || sideBolt ? doorColor : rail || inset ? 1 : bridge && y < -1 ? 2 : 0;
                const id = cells.length;
                cells.push({id, x, y, z, color, core: false, alive: true});
                if (door || sideBolt) exitIds.add(id);
            }
        }
    }

    return {level: planShell(stage, cells, bridge ? 26 : 12), exitIds};
}

/** Deal a color-varied queue while recording a supply-only route. Each
 * capsule carries just the shots it can actually fire from its planned view. */
function planShell(stage: HarborStage, cells: Voxel[], budget: number): Level {
    const level: Level = {
        id: stage.id, name: stage.name, cells, pacing: 'fast', initialYaw: .42, initialPitch: .20,
        supply: [[], [], [], []], solution: [], replay: [],
    };
    const game = new ColorClearGame(level);
    const order = stage.palette.length === 3 ? [2, 0, 1] : [3, 0, 1, 2, 3, 0, 3, 1, 3, 2];
    let next = 0;
    // Keep the reference route straightforward. The other cardinal directions
    // let a player uncover side locks and clear the remaining crate if desired.
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
