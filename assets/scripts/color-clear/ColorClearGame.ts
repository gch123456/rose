/** Shared real-3D gameplay. Horizontal rays match positive model-Y rotation. */
export type PieceShape = 'box' | 'sphere' | 'cylinder' | 'hemisphere' | 'wedge';
export type Voxel = { id: number; x: number; y: number; z: number; color: number; core: boolean; alive: boolean; shape?: PieceShape };
export type Capsule = { id: number; color: number; ammo: number };
export type Level = { id: number; name: string; cells: Voxel[]; supply: Capsule[][]; initialYaw?: number; solution: { column: number; yaw: number }[] };
export type ClearEvent = { type: 'load' | 'fire' | 'hit' | 'clear' | 'chain' | 'empty' | 'won' | 'lost'; cell?: Voxel; slot?: number; color?: number; core?: boolean; flightId?: number };
export type RewardTicket = { id: number; run: number; kind: 'slot' | 'continue' };
export type Flight = { id: number; target: number; capsuleId: number; slot: number; color: number; time: number; claimed: number[] };
export const FLIGHT_SECONDS = .28;
const TAU = Math.PI * 2;
let nextRun = 0;
export const aimY = (c: Voxel): number => c.y + (c.shape === 'hemisphere' ? .23 : 0);
const normalize = (a: number) => (a % TAU + TAU) % TAU;
function polygon(b: Voxel): number[][] {
    return (b.shape === 'wedge' ? [[-.5, -.5], [.5, -.5], [.3, .5], [-.3, .5]] : [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]]).map(([x, z]) => [b.x + x, b.z + z]);
}
function circleRadius(b: Voxel, y: number): number | null {
    const dy = y - b.y;
    if (Math.abs(dy) > .5 || (b.shape === 'hemisphere' && dy < 0)) return 0;
    if (b.shape === 'sphere' || b.shape === 'hemisphere') return Math.sqrt(Math.max(0, .25 - dy * dy));
    if (b.shape === 'cylinder') return .5;
    return null;
}
function blocks(cell: Voxel, b: Voxel, yaw: number): boolean {
    const y = aimY(cell); if (Math.abs(y - b.y) > .5) return false;
    const dx = -Math.sin(yaw), dz = Math.cos(yaw), radius = circleRadius(b, y);
    if (radius !== null) {
        if (radius <= 1e-8) return false;
        const x = cell.x - b.x, z = cell.z - b.z, along = x * dx + z * dz;
        const disc = along * along - (x * x + z * z - radius * radius);
        return disc >= -1e-10 && -along + Math.sqrt(Math.max(0, disc)) > 1e-7;
    }
    const points = polygon(b); let near = 0, far = Infinity;
    for (let i = 0; i < points.length; i++) {
        const a = points[i], q = points[(i + 1) % points.length], ex = q[0] - a[0], ez = q[1] - a[1];
        const cross = ex * (cell.z - a[1]) - ez * (cell.x - a[0]), slope = ex * dz - ez * dx;
        if (Math.abs(slope) < 1e-9) { if (cross < -1e-9) return false; }
        else if (slope > 0) near = Math.max(near, -cross / slope);
        else far = Math.min(far, -cross / slope);
    }
    return far > 1e-7 && far >= near - 1e-9;
}
export function canSeeCell(cell: Voxel, cells: Voxel[], yaw: number): boolean {
    return cell.alive && !cells.some(b => b.alive && b.id !== cell.id && blocks(cell, b, yaw));
}
/** Exact angular partition: polygon vertices and circle tangents, not sampled timeouts. */
export function reachableColors(cells: Voxel[]): Set<number> {
    const result = new Set<number>();
    for (const cell of cells) {
        if (!cell.alive || result.has(cell.color)) continue;
        if ([0, Math.PI / 2, Math.PI, Math.PI * 1.5].some(a => canSeeCell(cell, cells, a))) { result.add(cell.color); continue; }
        const angles = [0, TAU];
        for (const b of cells) if (b.alive && b.id !== cell.id && Math.abs(aimY(cell) - b.y) <= .5) {
            const radius = circleRadius(b, aimY(cell));
            if (radius !== null) {
                if (radius <= 1e-8) continue;
                const distance = Math.hypot(b.x - cell.x, b.z - cell.z);
                const centre = Math.atan2(-(b.x - cell.x), b.z - cell.z), half = Math.asin(Math.min(1, radius / distance));
                angles.push(normalize(centre - half), normalize(centre + half));
            } else for (const [x, z] of polygon(b)) angles.push(normalize(Math.atan2(-(x - cell.x), z - cell.z)));
        }
        angles.sort((a, b) => a - b);
        for (let i = 1; i < angles.length; i++) if (canSeeCell(cell, cells, (angles[i - 1] + angles[i]) / 2)) { result.add(cell.color); break; }
    }
    return result;
}
export class ColorClearGame {
    level: Level; cells: Voxel[] = []; supply: Capsule[][] = [];
    slots: (Capsule | null)[] = [null, null, null, null]; reserve: Capsule[] = []; flights: Flight[] = [];
    phase: 'playing' | 'paused' | 'won' | 'lost' = 'playing'; yaw = 0; reason = ''; combo = 0; shots = 0; continued = false;
    private cooldown = 0; private events: ClearEvent[] = []; private reach: Set<number> | null = null;
    private run = 0; private rewardSerial = 0; private flightSerial = 0;
    private reward: { ticket: RewardTicket; phase: 'playing' | 'paused' | 'lost' } | null = null;
    constructor(level: Level) { this.level = level; this.restart(); }
    get remaining(): number { return this.cells.reduce((n, c) => n + Number(c.alive), 0); }
    get progress(): number { return 1 - this.remaining / Math.max(1, this.cells.length); }
    get canContinue(): boolean { return this.phase === 'lost' && !this.continued && !this.reward && this.slots.some(s => !!s && s.ammo > 0); }
    restart(): void {
        this.cells = this.level.cells.map(c => ({ ...c, alive: true })); this.supply = this.level.supply.map(q => q.map(c => ({ ...c })));
        this.slots = [null, null, null, null]; this.reserve = []; this.flights = []; this.yaw = this.level.initialYaw ?? 0; this.phase = 'playing';
        this.cooldown = 0; this.reason = ''; this.combo = 0; this.shots = 0; this.continued = false; this.events = []; this.reach = null; this.reward = null; this.run = ++nextRun;
    }
    pause(): void { if (this.phase === 'playing') this.phase = 'paused'; }
    resume(): void { if (this.phase === 'paused' && !this.reward) this.phase = 'playing'; }
    rotate(delta: number): void { if (this.phase === 'playing' && Number.isFinite(delta)) this.yaw = normalize(this.yaw + delta); }
    select(column: number): boolean {
        if (this.phase !== 'playing' || !Number.isInteger(column)) return false;
        const slot = this.slots.indexOf(null), next = this.supply[column]?.[0]; if (slot < 0 || !next) return false;
        this.slots[slot] = this.supply[column].shift()!; this.events.push({ type: 'load', slot, color: next.color }); return true;
    }
    takeReserve(index: number): boolean {
        const slot = this.slots.indexOf(null); if (this.phase !== 'playing' || slot < 0 || !Number.isInteger(index) || !this.reserve[index]) return false;
        const capsule = this.reserve.splice(index, 1)[0]; this.slots[slot] = capsule; this.events.push({ type: 'load', slot, color: capsule.color }); return true;
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
    visibleTargets(): Voxel[] { return this.cells.filter(c => canSeeCell(c, this.cells, this.yaw)); }
    chainPreview(id: number): Voxel[] {
        const first = this.cells.find(c => c.id === id && c.alive); if (!first) return [];
        const seen = new Set<number>(), queue = [first], result: Voxel[] = [];
        while (queue.length) { const c = queue.shift()!; if (seen.has(c.id)) continue; seen.add(c.id); result.push(c);
            if (c.core) for (const b of this.cells) if (b.alive && !seen.has(b.id) && Math.abs(b.x - c.x) + Math.abs(b.y - c.y) + Math.abs(b.z - c.z) <= 1) queue.push(b);
        } return result;
    }
    drainEvents(): ClearEvent[] { const out = this.events; this.events = []; return out; }
    private clear(cell: Voxel): void {
        if (!cell.alive) return; cell.alive = false; this.combo++; this.reach = null;
        this.events.push({ type: 'clear', cell: { ...cell }, color: cell.color, core: cell.core });
        if (cell.core) { this.events.push({ type: 'chain', cell: { ...cell }, color: cell.color }); for (const b of this.cells) if (b.alive && Math.abs(b.x - cell.x) + Math.abs(b.y - cell.y) + Math.abs(b.z - cell.z) <= 1) this.clear(b); }
    }
    private settle(): void {
        if (this.flights.length) return;
        if (!this.remaining) { this.phase = 'won'; this.events.push({ type: 'won' }); return; }
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
            this.flights.splice(this.flights.indexOf(f), 1); const target = this.cells.find(c => c.id === f.target);
            if (target?.alive) { this.events.push({ type: 'hit', cell: { ...target }, slot: f.slot, color: f.color, flightId: f.id }); this.clear(target); }
        }
        this.slots.forEach((s, i) => { if (s && s.ammo <= 0 && !this.flights.some(f => f.capsuleId === s.id)) { this.slots[i] = null; this.events.push({ type: 'empty', slot: i, color: s.color }); } });
        this.cooldown -= step;
        while (this.cooldown <= 0 && this.remaining) {
            this.cooldown += .14;
            for (let i = 0; i < this.slots.length; i++) {
                const s = this.slots[i]; if (!s || s.ammo <= 0) continue;
                const reserved = new Set(this.flights.flatMap(f => f.claimed));
                const target = this.visibleTargets().filter(c => c.color === s.color && this.chainPreview(c.id).every(b => !reserved.has(b.id))).sort((a, b) => Number(b.core) - Number(a.core) || b.y - a.y || a.id - b.id)[0];
                if (!target) continue;
                s.ammo--; this.shots++; const id = ++this.flightSerial;
                this.flights.push({ id, target: target.id, capsuleId: s.id, slot: i, color: s.color, time: FLIGHT_SECONDS, claimed: this.chainPreview(target.id).map(c => c.id) });
                this.events.push({ type: 'fire', cell: { ...target }, slot: i, color: s.color, flightId: id });
            }
        }
        this.settle();
    }
}
