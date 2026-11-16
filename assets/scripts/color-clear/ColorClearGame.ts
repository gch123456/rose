/** Engine-independent rules. All geometry is model-local; shooting is horizontal. */
export type Voxel = { id: number; x: number; y: number; z: number; color: number; core: boolean; alive: boolean };
export type Capsule = { id: number; color: number; ammo: number };
export type Level = { id: number; name: string; cells: Voxel[]; supply: Capsule[][]; initialYaw?: number; solution: { column: number; yaw: number }[] };
export type ClearEvent = { type: 'load' | 'hit' | 'clear' | 'chain' | 'empty' | 'won' | 'lost'; cell?: Voxel; slot?: number; color?: number; core?: boolean };
const TAU = Math.PI * 2;
export function canSeeCell(cell: Voxel, cells: Voxel[], yaw: number): boolean {
    if (!cell.alive) return false;
    // Inverse of the model's positive Y rotation: world +Z becomes local (-sin, 0, cos).
    const dx = -Math.sin(yaw), dz = Math.cos(yaw);
    for (const b of cells) {
        if (!b.alive || b.id === cell.id || b.y !== cell.y) continue;
        let near = 0, far = Infinity;
        for (const [o, d, c] of [[cell.x, dx, b.x], [cell.z, dz, b.z]]) {
            if (Math.abs(d) < 1e-9) { if (o < c - .5 || o > c + .5) { far = -1; break; } }
            else { const a = (c - .5 - o) / d, q = (c + .5 - o) / d; near = Math.max(near, Math.min(a, q)); far = Math.min(far, Math.max(a, q)); }
        }
        if (far > 1e-7 && far >= near - 1e-9) return false;
    }
    return true;
}
/** Exact angular partition for horizontal centre rays, including diagonal openings. */
export function reachableColors(cells: Voxel[]): Set<number> {
    const result = new Set<number>();
    for (const cell of cells) {
        if (!cell.alive || result.has(cell.color)) continue;
        if ([0, Math.PI / 2, Math.PI, Math.PI * 1.5].some(a => canSeeCell(cell, cells, a))) { result.add(cell.color); continue; }
        const angles = [0, TAU];
        for (const b of cells) if (b.alive && b.y === cell.y && b.id !== cell.id)
            for (const x of [-.5, .5]) for (const z of [-.5, .5]) angles.push((-Math.atan2(b.x + x - cell.x, b.z + z - cell.z) + TAU) % TAU);
        angles.sort((a, b) => a - b);
        for (let i = 1; i < angles.length; i++) if (canSeeCell(cell, cells, (angles[i - 1] + angles[i]) / 2)) { result.add(cell.color); break; }
    }
    return result;
}
export class ColorClearGame {
    level: Level;
    cells: Voxel[] = [];
    supply: Capsule[][] = [];
    slots: (Capsule | null)[] = [null, null, null, null];
    phase: 'playing' | 'paused' | 'won' | 'lost' = 'playing';
    yaw = 0;
    reason = '';
    combo = 0;
    shots = 0;
    private cooldown = 0;
    private events: ClearEvent[] = [];
    private reach: Set<number> | null = null;
    constructor(level: Level) { this.level = level; this.restart(); }
    get remaining(): number { return this.cells.reduce((n, c) => n + Number(c.alive), 0); }
    get progress(): number { return 1 - this.remaining / Math.max(1, this.cells.length); }
    restart(): void {
        this.cells = this.level.cells.map(c => ({ ...c, alive: true }));
        this.supply = this.level.supply.map(column => column.map(c => ({ ...c })));
        this.slots = [null, null, null, null]; this.yaw = this.level.initialYaw ?? 0; this.phase = 'playing';
        this.cooldown = 0; this.reason = ''; this.combo = 0; this.shots = 0; this.events = []; this.reach = null;
    }
    pause(): void { if (this.phase === 'playing') this.phase = 'paused'; }
    resume(): void { if (this.phase === 'paused') this.phase = 'playing'; }
    rotate(delta: number): void { if (this.phase === 'playing' && Number.isFinite(delta)) this.yaw = ((this.yaw + delta) % TAU + TAU) % TAU; }
    select(column: number): boolean {
        if (this.phase !== 'playing' || !Number.isInteger(column)) return false;
        const slot = this.slots.indexOf(null), next = this.supply[column]?.[0];
        if (slot < 0 || !next) return false;
        this.slots[slot] = this.supply[column].shift()!;
        this.events.push({ type: 'load', slot, color: next.color }); return true;
    }
    visibleTargets(): Voxel[] { return this.cells.filter(c => canSeeCell(c, this.cells, this.yaw)); }
    chainPreview(id: number): Voxel[] {
        const first = this.cells.find(c => c.id === id && c.alive);
        if (!first) return [];
        const seen = new Set<number>(); const queue = [first]; const result: Voxel[] = [];
        while (queue.length) {
            const c = queue.shift()!; if (seen.has(c.id)) continue;
            seen.add(c.id); result.push(c);
            if (c.core) for (const b of this.cells) if (b.alive && !seen.has(b.id) && Math.abs(b.x - c.x) + Math.abs(b.y - c.y) + Math.abs(b.z - c.z) <= 1) queue.push(b);
        }
        return result;
    }
    drainEvents(): ClearEvent[] { const out = this.events; this.events = []; return out; }
    private clear(cell: Voxel): void {
        if (!cell.alive) return;
        cell.alive = false; this.combo++; this.reach = null;
        this.events.push({ type: 'clear', cell: { ...cell }, color: cell.color, core: cell.core });
        if (cell.core) {
            this.events.push({ type: 'chain', cell: { ...cell }, color: cell.color });
            for (const b of this.cells) if (b.alive && Math.abs(b.x - cell.x) + Math.abs(b.y - cell.y) + Math.abs(b.z - cell.z) <= 1) this.clear(b);
        }
    }
    private settle(): void {
        if (!this.remaining) { this.phase = 'won'; this.events.push({ type: 'won' }); return; }
        const active = this.slots.filter((s): s is Capsule => !!s);
        const supplied = this.supply.some(c => c.length);
        if (!active.length && !supplied) this.reason = '弹药已用完，还有积木没有清除';
        else if (active.length === 4 || !supplied) {
            this.reach ??= reachableColors(this.cells);
            if (!active.some(s => this.reach!.has(s.color))) this.reason = active.length === 4 ? '发射槽已满，当前颜色在所有方向都被挡住了' : '剩余弹药无法打开外层，试试另一种顺序';
        }
        if (this.reason) { this.phase = 'lost'; this.events.push({ type: 'lost' }); }
    }
    tick(dt: number): void {
        if (this.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
        this.cooldown -= Math.min(.25, dt);
        while (this.cooldown <= 0 && this.phase === 'playing') {
            this.cooldown += .12;
            for (let i = 0; i < this.slots.length; i++) {
                const s = this.slots[i]; if (!s) continue;
                const target = this.visibleTargets().filter(c => c.color === s.color).sort((a, b) => Number(b.core) - Number(a.core) || b.y - a.y || a.id - b.id)[0];
                if (!target) continue;
                s.ammo--; this.shots++;
                this.events.push({ type: 'hit', cell: { ...target }, slot: i, color: s.color }); this.clear(target);
                if (s.ammo <= 0) { this.slots[i] = null; this.events.push({ type: 'empty', slot: i, color: s.color }); }
            }
            this.settle();
        }
    }
}
