import type {Voxel} from './ColorClearGame.ts';
import {mixRescueColors, rescueBlockTint} from './ColorClearNativeStyle.ts';

type Point = readonly [number, number, number];
type Position = Pick<Voxel, 'x' | 'y' | 'z'>;
type ChunkGeometry = {positions: number[]; colors: number[]; indices: number[]};
type CellRecord = {
    voxel: Voxel;
    chunk: string;
    neighbors: (CellRecord | undefined)[];
    faces: readonly {rgb: Point; edgeRgb: Point}[];
};

const CHUNK_WIDTH = 8;
const HALF_BLOCK = .5;
// Diffuse light is baked into the model's axes to preserve the color identity
// during rotation. Only brightness varies across the faces.
const FACE_LIGHT = [.91, .82, 1, .75, .96, .87];
export const BLOCK_VERTEX_CAPACITY = 48;
export const BLOCK_INDEX_CAPACITY = 72;
const FACE_DELTAS: Point[] = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];
// Counterclockwise from outside each cube. Adjacent faces meet at their
// grid edges so there are no gaps when seen from steep angles.
const FACE_CORNERS: readonly Point[][] = [
    [[1,-1,1], [1,-1,-1], [1,1,-1], [1,1,1]],
    [[-1,-1,-1], [-1,-1,1], [-1,1,1], [-1,1,-1]],
    [[-1,1,1], [1,1,1], [1,1,-1], [-1,1,-1]],
    [[-1,-1,-1], [1,-1,-1], [1,-1,1], [-1,-1,1]],
    [[-1,-1,1], [1,-1,1], [1,1,1], [-1,1,1]],
    [[1,-1,-1], [-1,-1,-1], [-1,1,-1], [1,1,-1]],
];

const gridKey = (x: number, y: number, z: number): string => x + ',' + y + ',' + z;
const chunkKey = ({x, y, z}: Position): string =>
    gridKey(Math.floor(x / CHUNK_WIDTH), Math.floor(y / CHUNK_WIDTH), Math.floor(z / CHUNK_WIDTH));

function vertexColor(hex: string, light: number): Point {
    // The Cocos unlit shader reads vertex RGB as sRGB.
    const read = (index: number): number => parseInt(hex.slice(index, index + 2), 16) / 255 * light;
    return [read(1), read(3), read(5)];
}

/** Native catalog blocks are unit grid boxes. Rotation transforms the whole
 * scene node; only elimination needs to rebuild affected chunk surfaces. */
export class BlockMeshIndex {
    readonly chunkKeys: readonly string[];
    private readonly cells = new Map<string, CellRecord>();
    private readonly chunks = new Map<string, CellRecord[]>();

    constructor(cells: readonly Voxel[], palette: readonly string[]) {
        const byTint = new Map<string, CellRecord['faces']>();
        for (const voxel of cells) {
            const chunk = chunkKey(voxel);
            const tint = rescueBlockTint(voxel, palette);
            let faces = byTint.get(tint);
            if (!faces) {
                const rim = mixRescueColors(tint, '#243a40', .28);
                faces = FACE_LIGHT.map(light => ({rgb: vertexColor(tint, light), edgeRgb: vertexColor(rim, light)}));
                byTint.set(tint, faces);
            }
            const entry: CellRecord = {voxel, chunk, neighbors: [], faces};
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
        for (const entry of entries) {
            const {alive, x, y, z} = entry.voxel;
            if (!alive) continue;
            for (let face = 0; face < FACE_DELTAS.length; face++) {
                if (entry.neighbors[face]?.voxel.alive) continue;
                this.addFace(geometry, entry, face);
            }
        }
        return geometry;
    }
    private addFace({positions, colors, indices}: ChunkGeometry, entry: CellRecord, face: number): void {
        const {x, y, z} = entry.voxel;
        const [nx, ny, nz] = FACE_DELTAS[face];
        // A narrow rim on every face gives the cells a visible boundary without
        // opening gaps between adjacent blocks.
        for (let layer = 0; layer < 2; layer++) {
            const edge = layer ? HALF_BLOCK - .038 : HALF_BLOCK;
            const offset = layer ? .039 : 0;
            const [r, g, b] = layer ? entry.faces[face].rgb : entry.faces[face].edgeRgb;
            const vertex = positions.length / 3;
            for (const [dx, dy, dz] of FACE_CORNERS[face]) {
                positions.push(
                    x + dx * edge + nx * offset,
                    y + dy * edge + ny * offset,
                    z + dz * edge + nz * offset,
                );
                colors.push(r, g, b, 1);
            }
            indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3);
        }
    }
}
