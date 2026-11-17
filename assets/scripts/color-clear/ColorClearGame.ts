/** Shared real-3D gameplay; visibility uses the inverse model XYZ rotation. */
export type PieceShape = 'box' | 'sphere' | 'cylinder' | 'hemisphere' | 'wedge';
export type Voxel = { id: number; x: number; y: number; z: number; color: number; core: boolean; alive: boolean; shape?: PieceShape };
export type Capsule = { id: number; color: number; ammo: number };
export type ReplayStep = { yaw:number; pitch:number; column?:number; ticks:number };
export type Level = { id: number; name: string; cells: Voxel[]; supply: Capsule[][]; initialYaw?: number; initialPitch?: number; solution: { column: number; yaw: number }[]; replay?: ReplayStep[]; pacing?: 'remaining' };
export type ClearEvent = { type: 'load' | 'fire' | 'hit' | 'clear' | 'chain' | 'empty' | 'won' | 'lost'; cell?: Voxel; slot?: number; color?: number; core?: boolean; flightId?: number };
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
const TAU = Math.PI * 2;
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
    private visibility: {yaw:number; pitch:number; remaining:number; cells:Voxel[]} | null = null;
    private lattice: Map<string,Voxel> | null = null;
    private bounds: number[][] = [];
    private run = 0; private rewardSerial = 0; private flightSerial = 0;
    private reward: { ticket: RewardTicket; phase: 'playing' | 'paused' | 'lost' } | null = null;
    constructor(level: Level) { this.level = level; this.restart(); }
    get remaining(): number { return this.cells.reduce((n, c) => n + Number(c.alive), 0); }
    get progress(): number { return 1 - this.remaining / Math.max(1, this.cells.length); }
    get canContinue(): boolean { return this.phase === 'lost' && !this.continued && !this.reward && this.slots.some(s => !!s && s.ammo > 0); }
    restart(): void {
        this.cells = this.level.cells.map(c => ({ ...c, alive: true })); this.supply = this.level.supply.map(q => q.map(c => ({ ...c })));
        this.slots = [null, null, null, null]; this.reserve = []; this.flights = []; this.yaw = this.level.initialYaw ?? 0; this.pitch = clampPitch(this.level.initialPitch ?? 0); this.phase = 'playing';
        this.lattice = this.cells.every(c=>(!c.shape||c.shape==='box')&&[c.x,c.y,c.z].every(Number.isInteger)) ? new Map(this.cells.map(c=>[`${c.x},${c.y},${c.z}`,c])) : null;
        if(this.lattice&&this.lattice.size!==this.cells.length)this.lattice=null;
        this.bounds = ['x','y','z'].map(k=>{const values=this.cells.map(c=>c[k as 'x'|'y'|'z']);return [Math.min(...values),Math.max(...values)];});
        // Each dominant-axis slab can probe up to nine integer boxes. Leave
        // extra headroom for map/allocation cost: sparse wide lattices are
        // cheaper with the bounded cell scan than with empty-space traversal.
        if(this.lattice&&Math.max(...this.bounds.map(([min,max])=>max-min+1))*16>this.cells.length)this.lattice=null;
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
    visibleTargets(): Voxel[] {
        const n = this.remaining, cache = this.visibility;
        if (!cache || cache.yaw !== this.yaw || cache.pitch !== this.pitch || cache.remaining !== n)
            this.visibility = {yaw:this.yaw, pitch:this.pitch, remaining:n, cells:this.cells.filter(c => this.lattice ? this.latticeVisible(c) : canSeeCell(c, this.cells, this.yaw, this.pitch))};
        return this.visibility!.cells.slice();
    }
    /** Visit the integer boxes crossed by each dominant-axis ray slab. Closed
     * ranges include edge/corner ties; the original intersection is the oracle. */
    private latticeVisible(cell: Voxel): boolean {
        if (!cell.alive) return false;
        const direction=viewDirection(this.yaw,this.pitch), origin=[cell.x,cell.y,cell.z];
        let axis=0;for(let i=1;i<3;i++)if(Math.abs(direction[i])>Math.abs(direction[axis]))axis=i;
        const sign=direction[axis]>0?1:-1, other=[0,1,2].filter(i=>i!==axis);
        for(let v=origin[axis];v>=this.bounds[axis][0]&&v<=this.bounds[axis][1];v+=sign){
            const t0=Math.max(0,(v-origin[axis]-.5*sign)/direction[axis]), t1=(v-origin[axis]+.5*sign)/direction[axis];
            const ranges=other.map(i=>{const a=origin[i]+direction[i]*t0,b=origin[i]+direction[i]*t1;return [Math.ceil(Math.min(a,b)-.5-1e-9),Math.floor(Math.max(a,b)+.5+1e-9)];});
            for(let a=ranges[0][0];a<=ranges[0][1];a++)for(let b=ranges[1][0];b<=ranges[1][1];b++){
                const xyz=[0,0,0];xyz[axis]=v;xyz[other[0]]=a;xyz[other[1]]=b;
                const blocker=this.lattice!.get(xyz.join(','));
                if(blocker?.alive&&blocker.id!==cell.id&&blocks(cell,blocker,direction))return false;
            }
        }
        return true;
    }
    chainPreview(id: number): Voxel[] {
        const first = this.cells.find(c => c.id === id && c.alive); if (!first) return [];
        return [first];
    }
    drainEvents(): ClearEvent[] { const out = this.events; this.events = []; return out; }
    private clear(cell: Voxel): void {
        if (!cell.alive) return; cell.alive = false; this.combo++; this.reach = null;
        this.events.push({ type: 'clear', cell: { ...cell }, color: cell.color, core: cell.core });
        if (cell.core) this.events.push({ type: 'chain', cell: { ...cell }, color: cell.color });
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
            const pace = this.level.pacing === 'remaining' ? eliminationPace(this.remaining, this.cells.length) : {interval:.14, flightSeconds:FLIGHT_SECONDS};
            this.cooldown += pace.interval;
            for (let i = 0; i < this.slots.length; i++) {
                const s = this.slots[i]; if (!s || s.ammo <= 0 || this.flights.some(f=>f.capsuleId===s.id)) continue;
                const reserved = new Set(this.flights.flatMap(f => f.claimed));
                const target = this.visibleTargets().filter(c => c.color === s.color && this.chainPreview(c.id).every(b => !reserved.has(b.id))).sort((a, b) => Number(b.core) - Number(a.core) || b.y - a.y || a.id - b.id)[0];
                if (!target) continue;
                s.ammo--; this.shots++; const id = ++this.flightSerial;
                this.flights.push({ id, target: target.id, capsuleId: s.id, slot: i, color: s.color, time: pace.flightSeconds, duration: pace.flightSeconds, claimed: this.chainPreview(target.id).map(c => c.id) });
                this.events.push({ type: 'fire', cell: { ...target }, slot: i, color: s.color, flightId: id });
            }
        }
        this.settle();
    }
}
