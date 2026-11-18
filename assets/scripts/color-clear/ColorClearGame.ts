/** Shared real-3D gameplay; visibility uses the inverse model XYZ rotation. */
export type PieceShape = 'box' | 'sphere' | 'cylinder' | 'hemisphere' | 'wedge';
export type Voxel = { id: number; x: number; y: number; z: number; color: number; core: boolean; alive: boolean; shape?: PieceShape; visualTint?: string; visualDetail?: 'eye' | 'bill' };
export type Capsule = { id: number; color: number; ammo: number };
export type ReplayStep = { yaw:number; pitch:number; column?:number; ticks:number };
export type Level = { id: number; name: string; cells: Voxel[]; supply: Capsule[][]; initialYaw?: number; initialPitch?: number; solution: { column: number; yaw: number }[]; replay?: ReplayStep[]; pacing?: 'remaining' | 'fast' };
export type RescueTier = 'warmup' | 'planning' | 'challenge';
export const SAME_COLOR_BONUS = 5;
export type ClearEvent = { type: 'load' | 'fire' | 'hit' | 'clear' | 'chain' | 'bonus' | 'empty' | 'won' | 'lost'; cell?: Voxel; slot?: number; color?: number; core?: boolean; flightId?: number };
export type RewardTicket = { id: number; run: number; kind: 'slot' | 'continue' };
export type Flight = { id: number; target: number; capsuleId: number; slot: number; color: number; time: number; readonly duration: number; claimed: number[] };
export const FLIGHT_SECONDS = .28;
/** Slow smoothly as actual living pieces run out. Existing unmarked levels
 * retain their historical clock so their recorded witnesses still replay. */
export function eliminationPace(remaining: number, total: number): {interval:number; flightSeconds:number} {
    const ratio = Math.max(0, Math.min(1, remaining / Math.max(1, total)));
    const slow = (1 - ratio) ** 2;
    return {interval: .045 + .135 * slow, flightSeconds: .10 + .26 * slow};
}
/** Shared by the simulation and presentation diagnostics. */
export function levelEliminationPace(level: Pick<Level, 'pacing'>, remaining: number, total: number): {interval:number; flightSeconds:number} {
    if (level.pacing === 'fast') return {interval:.045, flightSeconds:.10};
    if (level.pacing === 'remaining') return eliminationPace(remaining, total);
    return {interval:.14, flightSeconds:FLIGHT_SECONDS};
}
const TAU = Math.PI * 2;
const compareTargets = (a: Voxel, b: Voxel) => Number(b.core) - Number(a.core) || b.y - a.y || a.id - b.id;
type ViewRay = {
    direction: [number, number, number];
    axis: 0 | 1 | 2;
    u: 0 | 1 | 2;
    w: 0 | 1 | 2;
    sign: number;
};
type Visibility = {
    yaw: number;
    pitch: number;
    remaining: number;
    ray: ViewRay;
    byCell: Map<Voxel, boolean>;
    all?: Voxel[];
};
type CapsuleRhythm = { fired: number };
const WARMUP_ROUNDS = 3;
const LARGE_CAPSULE_ROUNDS = 35;

function capsuleFlightSeconds(fired: number, remaining: number, original: number): number {
    if (fired < WARMUP_ROUNDS) return original;
    const acceleration = Math.min(1, (fired - WARMUP_ROUNDS + 1) / 12);
    const slowdown = Math.min(1, Math.max(0, (11 - remaining) / 10));
    return original - .044 * acceleration * (1 - .8 * slowdown);
}
let nextRun = 0;
export const aimY = (c: Voxel): number => c.y + (c.shape === 'hemisphere' ? .23 : 0);
const normalize = (a: number) => (a % TAU + TAU) % TAU;
const clampPitch = (a: number) => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, a));
/** Model-local direction toward a world +Z camera for R = Rx(pitch) * Ry(yaw). */
export function viewDirection(yaw: number, pitch = 0): [number, number, number] {
    return [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
}
function blocks(cell: Voxel, b: Voxel, direction: [number, number, number]): boolean {
    const origin = [cell.x - b.x, aimY(cell) - b.y, cell.z - b.z];
    // A bounding sphere cheaply rejects most distant, off-ray pieces.
    const along = -(origin[0]*direction[0]+origin[1]*direction[1]+origin[2]*direction[2]);
    if (along < -.87 || origin[0]**2+origin[1]**2+origin[2]**2-along**2 > .750001) return false;
    let near = 0, far = Infinity;
    // Intersect the ray with a closed half-space n.p <= limit.
    const plane = (nx: number, ny: number, nz: number, limit: number): boolean => {
        const at = nx * origin[0] + ny * origin[1] + nz * origin[2] - limit;
        const slope = nx * direction[0] + ny * direction[1] + nz * direction[2];
        if (Math.abs(slope) < 1e-12) return at <= 1e-10;
        if (slope > 0) far = Math.min(far, -at / slope); else near = Math.max(near, -at / slope);
        return far >= near - 1e-10;
    };
    const shape = b.shape ?? 'box';
    if (shape === 'sphere' || shape === 'hemisphere' || shape === 'cylinder') {
        const axes = shape === 'cylinder' ? [0, 2] : [0, 1, 2];
        const aa = axes.reduce((v, i) => v + direction[i] ** 2, 0);
        const bb = axes.reduce((v, i) => v + origin[i] * direction[i], 0);
        const cc = axes.reduce((v, i) => v + origin[i] ** 2, -.25);
        if (aa < 1e-24) { if (cc > 1e-10) return false; }
        else {
            const disc = bb * bb - aa * cc;
            if (disc < -1e-10) return false;
            const root = Math.sqrt(Math.max(0, disc));
            near = Math.max(near, (-bb - root) / aa); far = Math.min(far, (-bb + root) / aa);
        }
        if (shape === 'cylinder' && (!plane(0, 1, 0, .5) || !plane(0, -1, 0, .5))) return false;
        if (shape === 'hemisphere' && !plane(0, -1, 0, 0)) return false;
    } else {
        if (!plane(0, 1, 0, .5) || !plane(0, -1, 0, .5) || !plane(0, 0, 1, .5) || !plane(0, 0, -1, .5)) return false;
        // Wedge prism has x half-width .4 - .2*z.
        const slope = shape === 'wedge' ? .2 : 0, width = shape === 'wedge' ? .4 : .5;
        if (!plane(1, 0, slope, width) || !plane(-1, 0, slope, width)) return false;
    }
    return far > 1e-7 && far >= near - 1e-10;
}
export function canSeeCell(cell: Voxel, cells: Voxel[], yaw: number, pitch = 0): boolean {
    const direction = viewDirection(yaw, pitch);
    return cell.alive && !cells.some(b => b.alive && b.id !== cell.id && blocks(cell, b, direction));
}
/** Prove enclosure by opaque unit boxes on the target's lattice. Ignoring all
 * other solids enlarges free space, so failure to escape is a sound proof.
 * Flooding tests continuous escape (a superset of straight rays), and includes
 * face boundaries: six touching boxes seal every face of the starting cube.
 */
function enclosedByBoxes(cell: Voxel, cells: Voxel[]): boolean {
    const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
    const occupied = new Set<string>(); let extent = 1;
    for (const b of cells) {
        if (!b.alive || b.id === cell.id || (b.shape && b.shape !== 'box')) continue;
        const xyz = [b.x - cell.x, b.y - cell.y, b.z - cell.z];
        if (!xyz.every(Number.isInteger)) continue;
        occupied.add(key(xyz[0], xyz[1], xyz[2])); extent = Math.max(extent, ...xyz.map(Math.abs));
    }
    if (occupied.has('0,0,0')) return true;
    const queue = [[0, 0, 0]], seen = new Set(['0,0,0']);
    for (let i = 0; i < queue.length; i++) {
        const [x, y, z] = queue[i];
        if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) > extent) return false;
        // Bound work conservatively: an unproved enclosure remains playable.
        if (seen.size > 20000) return false;
        for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
            const next = [x + dx, y + dy, z + dz], k = key(...next as [number, number, number]);
            if (!occupied.has(k) && !seen.has(k)) { seen.add(k); queue.push(next); }
        }
    }
    return true;
}
/** No false deadlocks: direct rays establish reachability; only a closed-box
 * proof can exclude a remaining colour. Curved/mixed enclosures may therefore
 * stay playable until ammunition is exhausted rather than lose on a sample.
 */
export function reachableColors(cells: Voxel[]): Set<number> {
    const result = new Set<number>();
    for (const cell of cells) {
        if (!cell.alive || result.has(cell.color)) continue;
        let visible = false;
        for (const pitch of [-Math.PI / 2, -Math.PI / 4, 0, Math.PI / 4, Math.PI / 2]) {
            for (let i = 0; i < 8 && !visible; i++) visible = canSeeCell(cell, cells, i * Math.PI / 4, pitch);
            if (visible) break;
        }
        if (visible || !enclosedByBoxes(cell, cells)) result.add(cell.color);
    }
    return result;
}
export class ColorClearGame {
    level: Level; cells: Voxel[] = []; supply: Capsule[][] = [];
    slots: (Capsule | null)[] = [null, null, null, null]; reserve: Capsule[] = []; flights: Flight[] = [];
    phase: 'playing' | 'paused' | 'won' | 'lost' = 'playing'; yaw = 0; pitch = 0; reason = ''; combo = 0; shots = 0; continued = false;
    private cooldown = 0; private events: ClearEvent[] = []; private reach: Set<number> | null = null;
    private visibility: Visibility | null = null;
    private lattice: Map<number, Voxel> | null = null;
    private latticeMin = [0, 0, 0];
    private latticeMax = [0, 0, 0];
    private latticeStride = [1, 1, 1];
    private targetsByColor = new Map<number, Voxel[]>();
    private cellsById = new Map<number, Voxel>();
    private run = 0; private rewardSerial = 0; private flightSerial = 0;
    private reward: { ticket: RewardTicket; phase: 'playing' | 'paused' | 'lost' } | null = null;
    bonusCount = 0;
    private streakColor: number | null = null;
    private streak = 0;
    private emergencyUsed = false;
    private mysteryPositions = new Set<number>();

    readonly rescueTier?: RescueTier;
    private readonly random: () => number;
    private readonly freeStallRescue: boolean;
    private readonly ammoRhythm: boolean;
    private capsuleRhythm = new WeakMap<Capsule, CapsuleRhythm>();
    private readonly exitIds: ReadonlySet<number>;
    private exitLeft = 0;
    private reachedOven = false;

    constructor(level: Level, rescueTier?: RescueTier, random = Math.random, options: {
        freeStallRescue?: boolean; exitIds?: ReadonlySet<number>; ammoRhythm?: boolean;
    } = {}) {
        this.level = level;
        this.rescueTier = rescueTier;
        this.random = random;
        this.freeStallRescue = options.freeStallRescue === true;
        this.ammoRhythm = options.ammoRhythm === true;
        this.exitIds = new Set(options.exitIds);
        this.restart();
    }

    isAmmoHidden(column: number, row: number): boolean {
        return (row === 2 || row === 3) && !!this.supply[column]?.[row]
            && this.mysteryPositions.has(column * 4 + row);
    }

    private rollMysteryPositions(): void {
        this.mysteryPositions.clear();
        if (!this.rescueTier || this.rescueTier === 'warmup') return;
        const positions = this.supply.flatMap((queue, column) =>
            [2, 3].filter(row => queue[row]).map(row => column * 4 + row));
        const challenge = this.rescueTier === 'challenge';
        const limit = Math.min(positions.length, (challenge ? 2 : 1) + Math.floor(this.random() * (challenge ? 3 : 2)));
        for (let i = 0; i < limit; i++) {
            const index = Math.floor(this.random() * positions.length);
            this.mysteryPositions.add(positions.splice(index, 1)[0]);
        }
    }

    get canUseEmergencyReserve(): boolean {
        if (this.rescueTier !== 'challenge' || (!this.freeStallRescue && this.bonusCount === 0) || this.emergencyUsed
            || this.phase !== 'lost' || this.reachedOven || this.reward || this.flights.length
            || this.slots.some(slot => !slot) || this.reserve.length >= 6) return false;
        const reachable = this.reach ??= reachableColors(this.cells);
        return [...this.supply.map(queue => queue[0]), ...this.reserve]
            .some(capsule => capsule && capsule.ammo > 0 && reachable.has(capsule.color));
    }

    useEmergencyReserve(): boolean {
        if (!this.canUseEmergencyReserve) return false;
        const index = this.slots.findIndex(slot => slot && slot.ammo > 0);
        if (index < 0) return false;
        this.reserve.push(this.slots[index]!);
        this.slots[index] = null;
        this.emergencyUsed = true;
        this.reason = '';
        this.phase = 'playing';
        return true;
    }
    get exitRemaining(): number { return this.exitLeft; }
    get hasExit(): boolean { return this.exitIds.size > 0; }
    get remaining(): number { return this.cells.reduce((n, c) => n + Number(c.alive), 0); }
    get progress(): number { return 1 - this.remaining / Math.max(1, this.cells.length); }
    get canContinue(): boolean { return this.phase === 'lost' && !this.reachedOven && !this.continued && !this.reward && this.slots.some(s => !!s && s.ammo > 0); }
    restart(): void {
        this.cells = this.level.cells.map(c => ({ ...c, alive: true })); this.supply = this.level.supply.map(q => q.map(c => ({ ...c })));
        this.capsuleRhythm = new WeakMap();
        this.bonusCount = 0;
        this.exitLeft = this.exitIds.size;
        this.reachedOven = false;
        this.streakColor = null;
        this.streak = 0;
        this.emergencyUsed = false;
        this.rollMysteryPositions();
        this.slots = [null, null, null, null]; this.reserve = []; this.flights = []; this.yaw = this.level.initialYaw ?? 0; this.pitch = clampPitch(this.level.initialPitch ?? 0); this.phase = 'playing';
        this.targetsByColor.clear();
        this.cellsById.clear();
        for (const cell of this.cells) {
            if (!this.cellsById.has(cell.id)) this.cellsById.set(cell.id, cell);
            let bucket = this.targetsByColor.get(cell.color);
            if (!bucket) { bucket = []; this.targetsByColor.set(cell.color, bucket); }
            bucket.push(cell);
        }
        for (const bucket of this.targetsByColor.values()) bucket.sort(compareTargets);
        this.prepareLattice();
        this.visibility = null; this.cooldown = 0; this.reason = ''; this.combo = 0; this.shots = 0; this.continued = false; this.events = []; this.reach = null; this.reward = null; this.run = ++nextRun;
    }
    pause(): void { if (this.phase === 'playing') this.phase = 'paused'; }
    resume(): void { if (this.phase === 'paused' && !this.reward) this.phase = 'playing'; }
    rotate(deltaYaw: number, deltaPitch = 0): void {
        if (this.phase !== 'playing' || !Number.isFinite(deltaYaw) || !Number.isFinite(deltaPitch)) return;
        this.yaw = normalize(this.yaw + deltaYaw); this.pitch = clampPitch(this.pitch + deltaPitch);
    }
    select(column: number): boolean {
        if (this.phase !== 'playing' || !Number.isInteger(column)) return false;
        const slot = this.slots.indexOf(null), next = this.supply[column]?.[0]; if (slot < 0 || !next) return false;
        this.loadCapsule(slot, this.supply[column].shift()!);
        return true;
    }
    takeReserve(index: number): boolean {
        const slot = this.slots.indexOf(null); if (this.phase !== 'playing' || slot < 0 || !Number.isInteger(index) || !this.reserve[index]) return false;
        this.loadCapsule(slot, this.reserve.splice(index, 1)[0]);
        return true;
    }
    private loadCapsule(slot: number, capsule: Capsule): void {
        this.slots[slot] = capsule;
        if (this.ammoRhythm && this.level.pacing === 'fast' && capsule.ammo >= LARGE_CAPSULE_ROUNDS
            && !this.capsuleRhythm.has(capsule)) {
            this.capsuleRhythm.set(capsule, {fired: 0});
        }
        this.events.push({type: 'load', slot, color: capsule.color});
    }
    beginReward(kind: 'slot' | 'continue'): RewardTicket | null {
        if (this.reward || (kind !== 'slot' && kind !== 'continue')) return null;
        if (kind === 'slot' ? this.phase !== 'playing' || this.slots.length >= 6 : !this.canContinue) return null;
        const ticket = { id: ++this.rewardSerial, run: this.run, kind };
        this.reward = { ticket: { ...ticket }, phase: this.phase as 'playing' | 'lost' }; if (this.phase === 'playing') this.phase = 'paused'; return ticket;
    }
    resolveReward(ticket: RewardTicket, completed: boolean): boolean {
        const pending = this.reward;
        if (!pending || !ticket || ticket.run !== this.run || ticket.id !== pending.ticket.id || ticket.kind !== pending.ticket.kind) return false;
        this.reward = null; this.phase = pending.phase;
        if (!completed) return false;
        if (ticket.kind === 'slot') this.slots.push(null);
        else {
            this.reserve.push(...this.slots.filter((s): s is Capsule => !!s && s.ammo > 0)); this.slots = this.slots.map(() => null);
            this.reason = ''; this.phase = 'playing'; this.continued = true;
        }
        return true;
    }
    private prepareLattice(): void {
        this.lattice = null;
        if (!this.cells.length || !this.cells.every(c =>
            (!c.shape || c.shape === 'box') && [c.x, c.y, c.z].every(Number.isSafeInteger))) return;
        this.latticeMin = ['x', 'y', 'z'].map(key => Math.min(...this.cells.map(c => c[key as 'x' | 'y' | 'z'])));
        this.latticeMax = ['x', 'y', 'z'].map(key => Math.max(...this.cells.map(c => c[key as 'x' | 'y' | 'z'])));
        const spans = this.latticeMax.map((max, axis) => max - this.latticeMin[axis] + 1);
        // The bounded cell scan is cheaper than crossing a wide, sparse lattice.
        if (Math.max(...spans) * 16 > this.cells.length) return;
        this.latticeStride = [1, spans[0], spans[0] * spans[1]];
        const lattice = new Map<number, Voxel>();
        for (const cell of this.cells) {
            const index = (cell.x - this.latticeMin[0]) + (cell.y - this.latticeMin[1]) * this.latticeStride[1]
                + (cell.z - this.latticeMin[2]) * this.latticeStride[2];
            lattice.set(index, cell);
        }
        if (lattice.size === this.cells.length) this.lattice = lattice;
    }
    private visibilityAtPose(remaining: number): Visibility {
        const cached = this.visibility;
        if (cached && cached.yaw === this.yaw && cached.pitch === this.pitch && cached.remaining === remaining) return cached;
        const direction = viewDirection(this.yaw, this.pitch);
        let axis: 0 | 1 | 2 = 0;
        if (Math.abs(direction[1]) > Math.abs(direction[axis])) axis = 1;
        if (Math.abs(direction[2]) > Math.abs(direction[axis])) axis = 2;
        const ray: ViewRay = {direction, axis, u: axis === 0 ? 1 : 0, w: axis === 2 ? 1 : 2, sign: direction[axis] > 0 ? 1 : -1};
        return this.visibility = {yaw:this.yaw, pitch:this.pitch, remaining, ray, byCell:new Map()};
    }
    private isVisible(cell: Voxel, visibility: Visibility): boolean {
        return cell.alive && this.hasClearSight(cell, visibility);
    }
    private hasClearSight(cell: Voxel, visibility: Visibility): boolean {
        const cached = visibility.byCell.get(cell);
        if (cached !== undefined) return cached;
        const visible = this.lattice ? this.latticeVisible(cell, visibility.ray) : !this.cells.some(blocker =>
            blocker.alive && blocker.id !== cell.id && blocks(cell, blocker, visibility.ray.direction));
        visibility.byCell.set(cell, visible);
        return visible;
    }
    visibleTargets(): Voxel[] {
        const visibility = this.visibilityAtPose(this.remaining);
        visibility.all ??= this.cells.filter(cell => this.isVisible(cell, visibility));
        return visibility.all.slice();
    }
    /** A hit may still be shown at the removed position until the effect fades. */
    visibleVoxelPositions(ids: Iterable<number>): Set<number> {
        const visibility = this.visibilityAtPose(this.remaining);
        const visible = new Set<number>();
        for (const id of ids) {
            const cell = this.cellsById.get(id);
            if (cell && this.hasClearSight(cell, visibility)) visible.add(id);
        }
        return visible;
    }
    /** Visit the boxes crossed by the dominant-axis ray slabs. Closed ranges
     * preserve edge/corner ties. The geometry test remains the final oracle. */
    private latticeVisible(cell: Voxel, ray: ViewRay): boolean {
        const {direction, axis, u, w, sign} = ray;
        const start = [cell.x, cell.y, cell.z], min = this.latticeMin, max = this.latticeMax;
        const stride = this.latticeStride, lattice = this.lattice!;
        for (let value = start[axis]; value >= min[axis] && value <= max[axis]; value += sign) {
            const t0 = Math.max(0, (value - start[axis] - .5 * sign) / direction[axis]);
            const t1 = (value - start[axis] + .5 * sign) / direction[axis];
            const u0 = start[u] + direction[u] * t0, u1 = start[u] + direction[u] * t1;
            const w0 = start[w] + direction[w] * t0, w1 = start[w] + direction[w] * t1;
            const firstU = Math.max(min[u], Math.ceil(Math.min(u0, u1) - .5 - 1e-9));
            const lastU = Math.min(max[u], Math.floor(Math.max(u0, u1) + .5 + 1e-9));
            const firstW = Math.max(min[w], Math.ceil(Math.min(w0, w1) - .5 - 1e-9));
            const lastW = Math.min(max[w], Math.floor(Math.max(w0, w1) + .5 + 1e-9));
            const base = (value - min[axis]) * stride[axis];
            for (let a = firstU; a <= lastU; a++) for (let b = firstW; b <= lastW; b++) {
                const blocker = lattice.get(base + (a - min[u]) * stride[u] + (b - min[w]) * stride[w]);
                if (blocker?.alive && blocker.id !== cell.id && blocks(cell, blocker, direction)) return false;
            }
        }
        return true;
    }
    chainPreview(id: number): Voxel[] {
        const cell = this.cellsById.get(id);
        return cell?.alive ? [cell] : [];
    }
    drainEvents(): ClearEvent[] { const out = this.events; this.events = []; return out; }
    private clear(cell: Voxel): void {
        if (!cell.alive) return; cell.alive = false; this.combo++; this.reach = null;
        if (this.exitIds.has(cell.id)) this.exitLeft--;
        this.events.push({ type: 'clear', cell: { ...cell }, color: cell.color, core: cell.core });
        if (this.rescueTier) {
            this.streak = cell.color === this.streakColor ? this.streak + 1 : 1;
            this.streakColor = cell.color;
            if (this.streak === SAME_COLOR_BONUS) {
                this.streak = 0;
                this.bonusCount++;
                this.events.push({ type: 'bonus', cell: { ...cell }, color: cell.color });
            }
        }
        if (cell.core) this.events.push({ type: 'chain', cell: { ...cell }, color: cell.color });
    }
    get escapeReady(): boolean { return this.hasExit && this.exitLeft === 0; }

    failAtOven(): void {
        if (this.phase !== 'playing' || this.escapeReady) return;
        this.reachedOven = true;
        this.reason = '鸭鸭被送进烤鸭炉了';
        this.phase = 'lost';
        this.events.push({type:'lost'});
    }

    /** Use matching unspent ammo for each skill clear; never take an in-flight target. */
    openShellWithWater(limit: number): number {
        if (this.phase !== 'playing' || !this.hasExit || !Number.isSafeInteger(limit) || limit <= 0) return 0;
        const claimed = new Set(this.flights.flatMap(flight => flight.claimed));
        const visible = this.visibleTargets().filter(cell => !claimed.has(cell.id));
        visible.sort((left, right) => Number(this.exitIds.has(right.id)) - Number(this.exitIds.has(left.id)));
        let cleared = 0;
        for (const cell of visible) {
            if (cleared >= limit || this.escapeReady) break;
            if (!this.spendWaterAmmo(cell.color)) continue;
            this.clear(cell);
            cleared++;
        }
        this.releaseEmptySlots();
        this.settle(this.remaining);
        return cleared;
    }

    private spendWaterAmmo(color: number): boolean {
        // Back of supply first so the four choices already on screen stay stable.
        const lanes = this.supply;
        for (let depth = Math.max(...lanes.map(lane => lane.length)) - 1; depth >= 0; depth--) {
            for (const lane of lanes) {
                const capsule = lane[depth];
                if (!capsule || capsule.color !== color || capsule.ammo <= 0) continue;
                if (--capsule.ammo === 0) lane.splice(depth, 1);
                return true;
            }
        }
        const reserve = this.reserve.findIndex(capsule => capsule.color === color && capsule.ammo > 0);
        if (reserve >= 0) {
            if (--this.reserve[reserve].ammo === 0) this.reserve.splice(reserve, 1);
            return true;
        }
        const slot = this.slots.find(capsule => capsule && capsule.color === color && capsule.ammo > 0);
        if (!slot) return false;
        slot.ammo--;
        return true;
    }
    private releaseEmptySlots(): void {
        for (const [index, capsule] of this.slots.entries()) {
            if (!capsule || capsule.ammo > 0 || this.flights.some(flight => flight.capsuleId === capsule.id)) continue;
            this.slots[index] = null;
            this.events.push({type:'empty', slot:index, color:capsule.color});
        }
    }
    private settle(remaining: number): void {
        if (this.flights.length) return;
        if (!remaining || this.escapeReady) { this.phase = 'won'; this.events.push({ type: 'won' }); return; }
        const active = this.slots.filter((s): s is Capsule => !!s), supplied = this.supply.some(c => c.length) || this.reserve.length > 0;
        if (!active.length && !supplied) this.reason = '弹药已用完，还有积木没有清除';
        else if (active.length === this.slots.length || !supplied) {
            this.reach ??= reachableColors(this.cells);
            if (!active.some(s => s.ammo > 0 && this.reach!.has(s.color))) this.reason = active.length === this.slots.length ? '发射槽已满，所有方向都没有可攻击的同色目标' : '剩余弹药无法打开外层，试试另一种顺序';
        }
        if (this.reason) { this.phase = 'lost'; this.events.push({ type: 'lost' }); }
    }
    tick(dt: number): void {
        if (this.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
        const step = Math.min(.25, dt);
        for (const f of [...this.flights]) {
            f.time -= step; if (f.time > 1e-9) continue;
            this.flights.splice(this.flights.indexOf(f), 1); const target = this.cellsById.get(f.target);
            if (target?.alive) { this.events.push({ type: 'hit', cell: { ...target }, slot: f.slot, color: f.color, flightId: f.id }); this.clear(target); }
        }
        this.releaseEmptySlots();
        this.cooldown -= step;
        const remaining = this.remaining;
        if (this.escapeReady) { this.settle(remaining); return; }
        const launchWindow = this.cooldown <= 0;
        if (remaining && (launchWindow || this.ammoRhythm)) {
            const pace = levelEliminationPace(this.level, remaining, this.cells.length);
            while (this.cooldown <= 0) this.cooldown += pace.interval;
            this.launchReadyCapsules(remaining, pace.flightSeconds, launchWindow);
        }
        this.settle(remaining);
    }
    private launchReadyCapsules(remaining: number, originalFlightSeconds: number, launchWindow: boolean): void {
        let reserved: Set<number> | undefined;
        for (let slot = 0; slot < this.slots.length; slot++) {
            const capsule = this.slots[slot];
            if (!capsule || capsule.ammo <= 0) continue;
            const rhythm = this.capsuleRhythm.get(capsule);
            const accelerated = rhythm && rhythm.fired >= WARMUP_ROUNDS;
            // Large capsules keep their warm-up on the original launch clock,
            // then dispatch when their own last round lands. Small capsules stay synchronized.
            if (!launchWindow && !accelerated) continue;
            if (this.flights.some(f => f.capsuleId === capsule.id)) continue;
            reserved ??= new Set(this.flights.flatMap(f => f.claimed));
            const visibility = this.visibilityAtPose(remaining);
            const target = this.targetsByColor.get(capsule.color)?.find(cell =>
                !reserved!.has(cell.id) && this.isVisible(cell, visibility));
            if (!target) continue;
            const duration = rhythm ? capsuleFlightSeconds(rhythm.fired++, capsule.ammo, originalFlightSeconds) : originalFlightSeconds;
            reserved.add(target.id);
            capsule.ammo--;
            this.shots++;
            const id = ++this.flightSerial;
            this.flights.push({id, target:target.id, capsuleId:capsule.id, slot, color:capsule.color,
                time:duration, duration, claimed:[target.id]});
            this.events.push({type:'fire', cell:{...target}, slot, color:capsule.color, flightId:id});
        }
    }
}
