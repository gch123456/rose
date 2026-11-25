export const DIR = {north: 1, east: 2, south: 4, west: 8} as const;
export const PIPE_COLUMNS = 4;
export const PIPE_ROWS = 3;

const PORTS = [
    {tile: 0, side: DIR.west, feed: 1},
    {tile: PIPE_COLUMNS - 1, side: DIR.east, feed: 2},
] as const;

const DIRECTIONS = [
    {side: DIR.north, opposite: DIR.south, x: 0, y: -1},
    {side: DIR.east, opposite: DIR.west, x: 1, y: 0},
    {side: DIR.south, opposite: DIR.north, x: 0, y: 1},
    {side: DIR.west, opposite: DIR.east, x: -1, y: 0},
] as const;

/** Each number is a bitmask of open pipe ends. Arrays are row-major. */
const LAYOUTS = [
    {exit: 10, tiles: [9, 3, 6, 9, 10, 12, 11, 3, 12, 12, 10, 6]},
    {exit: 9, tiles: [5, 9, 9, 5, 3, 10, 10, 9, 6, 14, 3, 12]},
] as const;
export const PIPE_LAYOUTS = LAYOUTS.length;

export function rotatePipe(mask: number): number {
    return ((mask << 1) & 15) | (mask >> 3);
}

export class WaterRoutingGame {
    readonly exit: number;
    private readonly masks: number[];
    private readonly wet: number[];
    private turns = 0;

    constructor(variant: number) {
        const layout = LAYOUTS[variant];
        if (!layout) throw new RangeError('Unknown water routing layout');
        this.exit = layout.exit;
        this.masks = Array.from(layout.tiles);
        this.wet = this.masks.map(() => 0);
        this.updateFlow();
    }

    get tiles(): readonly number[] { return this.masks; }
    get feeds(): readonly number[] { return this.wet; }
    get moves(): number { return this.turns; }
    get outletFeed(): number { return (this.masks[this.exit] & DIR.south) ? this.wet[this.exit] : 0; }
    get solved(): boolean { return this.outletFeed === 3; }

    turn(tile: number): boolean {
        if (this.solved || !Number.isInteger(tile) || tile < 0 || tile >= this.masks.length) return false;
        this.masks[tile] = rotatePipe(this.masks[tile]);
        this.turns++;
        this.updateFlow();
        return true;
    }

    private updateFlow(): void {
        this.wet.fill(0);
        for (const {tile, side, feed} of PORTS) {
            if (!(this.masks[tile] & side)) continue;
            const queue = [tile];
            this.wet[tile] |= feed;
            for (let cursor = 0; cursor < queue.length; cursor++) {
                const current = queue[cursor];
                const column = current % PIPE_COLUMNS;
                const row = Math.floor(current / PIPE_COLUMNS);
                for (const direction of DIRECTIONS) {
                    const x = column + direction.x, y = row + direction.y;
                    if (x < 0 || x >= PIPE_COLUMNS || y < 0 || y >= PIPE_ROWS
                        || !(this.masks[current] & direction.side)) continue;
                    const next = y * PIPE_COLUMNS + x;
                    if ((this.wet[next] & feed) || !(this.masks[next] & direction.opposite)) continue;
                    this.wet[next] |= feed;
                    queue.push(next);
                }
            }
        }
    }
}
