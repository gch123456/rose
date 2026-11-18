import type {Voxel} from './ColorClearGame.ts';

type Point = readonly [number, number, number];
type Position = Pick<Voxel, 'x' | 'y' | 'z'>;
type ChunkGeometry = {positions: number[]; colors: number[]; indices: number[]};
type CellRecord = {
    voxel: Voxel;
    chunk: string;
    neighbors: (CellRecord | undefined)[];
    faceColors: readonly Point[];
};

const CHUNK_WIDTH = 8;
const HALF_BLOCK = .485;
const FACE_DELTAS: Point[] = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];
// Counterclockwise from outside each cube. Faces of the same cell stay slightly
// inside its logical grid bounds so that adjacent exposed cells retain a seam.
const FACE_CORNERS: readonly Point[][] = [
    [[1,-1,1], [1,-1,-1], [1,1,-1], [1,1,1]],
    [[-1,-1,-1], [-1,-1,1], [-1,1,1], [-1,1,-1]],
    [[-1,1,1], [1,1,1], [1,1,-1], [-1,1,-1]],
    [[-1,-1,-1], [1,-1,-1], [1,-1,1], [-1,-1,1]],
    [[-1,-1,1], [1,-1,1], [1,1,1], [-1,1,1]],
    [[1,-1,-1], [-1,-1,-1], [-1,1,-1], [1,1,-1]],
];
const FACE_SHADE = [.83, .83, 1, .71, .94, .83];

const gridKey = (x: number, y: number, z: number): string => x + ',' + y + ',' + z;
const chunkKey = ({x, y, z}: Position): string =>
    gridKey(Math.floor(x / CHUNK_WIDTH), Math.floor(y / CHUNK_WIDTH), Math.floor(z / CHUNK_WIDTH));

function toLinear(channel: number): number {
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
}
function toSRGB(channel: number): number {
    return channel <= .0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - .055;
}

function faceColors(tint: string): Point[] {
    const r = toLinear(parseInt(tint.slice(1, 3), 16) / 255);
    const g = toLinear(parseInt(tint.slice(3, 5), 16) / 255);
    const b = toLinear(parseInt(tint.slice(5, 7), 16) / 255);
    // Cocos builtin-unlit reads vertex RGB as sRGB. Bake the former material
    // tint × face-light product in linear space, then encode it for the shader.
    return FACE_SHADE.map(value => {
        const shade = toLinear(value);
        return [toSRGB(r * shade), toSRGB(g * shade), toSRGB(b * shade)];
    });
}

/** Native catalog blocks are unit grid boxes. Rotation transforms the whole
 * scene node; only elimination needs to rebuild affected chunk surfaces. */
export class BlockMeshIndex {
    readonly chunkKeys: readonly string[];
    private readonly cells = new Map<string, CellRecord>();
    private readonly chunks = new Map<string, CellRecord[]>();

    constructor(cells: readonly Voxel[], palette: readonly string[]) {
        const byTint = new Map<string, readonly Point[]>();
        for (const voxel of cells) {
            const chunk = chunkKey(voxel);
            const tint = voxel.visualTint ?? palette[voxel.color];
            let shades = byTint.get(tint);
            if (!shades) {
                shades = faceColors(tint);
                byTint.set(tint, shades);
            }
            const entry: CellRecord = {voxel, chunk, neighbors: [], faceColors: shades};
            this.cells.set(gridKey(voxel.x, voxel.y, voxel.z), entry);
            let entries = this.chunks.get(chunk);
            if (!entries) {
                entries = [];
                this.chunks.set(chunk, entries);
            }
            entries.push(entry);
        }
        for (const entry of this.cells.values()) {
            const {x, y, z} = entry.voxel;
            entry.neighbors = FACE_DELTAS.map(([dx, dy, dz]) => this.cells.get(gridKey(x + dx, y + dy, z + dz)));
        }
        // Creator 3.8.8 lowers spread into concat even for Map iterators.
        this.chunkKeys = Array.from(this.chunks.keys());
    }

    cellCount(key: string): number {
        return this.chunks.get(key)?.length ?? 0;
    }

    dirtyChunks({x, y, z}: Position): string[] {
        const entry = this.cells.get(gridKey(x, y, z));
        if (!entry) return [];
        const affected = new Set([entry.chunk]);
        for (const neighbor of entry.neighbors) {
            if (neighbor?.voxel.alive) affected.add(neighbor.chunk);
        }
        return Array.from(affected);
    }

    makeChunk(key: string): ChunkGeometry {
        const geometry: ChunkGeometry = {positions: [], colors: [], indices: []};
        const entries = this.chunks.get(key);
        if (!entries) return geometry;
        const {positions, colors, indices} = geometry;
        for (const entry of entries) {
            const {alive, x, y, z} = entry.voxel;
            if (!alive) continue;
            for (let face = 0; face < FACE_DELTAS.length; face++) {
                if (entry.neighbors[face]?.voxel.alive) continue;
                const vertex = positions.length / 3;
                const [r, g, b] = entry.faceColors[face];
                for (const [dx, dy, dz] of FACE_CORNERS[face]) {
                    positions.push(x + dx * HALF_BLOCK, y + dy * HALF_BLOCK, z + dz * HALF_BLOCK);
                    colors.push(r, g, b, 1);
                }
                indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3);
            }
        }
        return geometry;
    }
}
