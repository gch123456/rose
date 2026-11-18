import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {BLOCK_INDEX_CAPACITY, BLOCK_VERTEX_CAPACITY, BlockMeshIndex} from '../assets/scripts/color-clear/ColorClearBlockMesh.ts';
import {makeReleaseLevel, RELEASE_LEVELS} from '../assets/scripts/color-clear/ColorClearRelease.ts';

const voxel = (id, x, y, z, color = 0, tint) => ({
    id, x, y, z, color, alive: true, core: false, visualTint: tint,
});
const palette = ['#ffffff', '#7397f0'];

test('adjacent blocks in different chunks hide their shared faces until one clears', () => {
    const a = voxel(0, 7, 0, 0), b = voxel(1, 8, 0, 0);
    const index = new BlockMeshIndex([a, b], palette);
    const [left, right] = index.chunkKeys;
    assert.equal(index.chunkKeys.length, 2);
    assert.equal(index.cellCount(left), 1);
    assert.equal(index.cellCount(right), 1);
    assert.equal(index.makeChunk(left).indices.length, 60);
    assert.equal(index.makeChunk(right).indices.length, 60);

    a.alive = false;
    assert.deepEqual(new Set(index.dirtyChunks(a)), new Set([left, right]));
    assert.equal(index.makeChunk(left).indices.length, 0);
    assert.equal(index.makeChunk(right).indices.length, 72);
    assert.equal(index.cellCount(left), 1, 'capacity counts the originally assigned cells');
});

test('an isolated block has no gaps, holds the same color on every face, and keeps outward winding', () => {
    const index = new BlockMeshIndex([voxel(0, 0, 0, 0, 1, '#db2e10')], palette);
    const mesh = index.makeChunk(index.chunkKeys[0]);
    assert.equal(mesh.positions.length, BLOCK_VERTEX_CAPACITY * 3);
    assert.equal(mesh.colors.length, BLOCK_VERTEX_CAPACITY * 4);
    assert.equal(mesh.indices.length, 72);
    assert.ok(Math.abs(Math.max(...mesh.positions) - .501) < 1e-6);

    for (let i = 0; i < mesh.indices.length; i += 3) {
        const [a,b,c] = mesh.indices.slice(i, i + 3).map(k => mesh.positions.slice(k * 3, k * 3 + 3));
        const u = b.map((v,k) => v-a[k]), v = c.map((q,k) => q-a[k]);
        const normal = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]];
        assert.ok(normal.reduce((dot,n,k) => dot+n*a[k],0) > 0, 'each triangle faces away from the cube center');
    }
    assert.notDeepEqual(mesh.colors.slice(0, 4), mesh.colors.slice(16, 20), 'rim and center stay distinct');
    for (let face = 0; face < 6; face++) {
        assert.deepEqual(mesh.colors.slice(face * 32, face * 32 + 32), mesh.colors.slice(0, 32));
    }
});

test('the shipped 4500-cell wizard fits the chunk and uint16 index budgets', () => {
    const native = JSON.parse(readFileSync(new URL('../assets/resources/color-clear-release/wizard.json', import.meta.url), 'utf8'));
    const level = makeReleaseLevel(12, native);
    const mesh = new BlockMeshIndex(level.cells, RELEASE_LEVELS[1].palette);
    let faces = 0;
    for (const key of mesh.chunkKeys) {
        const geometry = mesh.makeChunk(key);
        const count = mesh.cellCount(key);
        assert.ok(count <= 8 ** 3);
        assert.ok(geometry.positions.length <= count * BLOCK_VERTEX_CAPACITY * 3);
        assert.ok(geometry.indices.length <= count * BLOCK_INDEX_CAPACITY);
        assert.ok(geometry.indices.every(i => i < 65536));
        faces += geometry.indices.length / 12;
    }
    assert.ok(mesh.chunkKeys.length < 75);
    assert.ok(faces > 0 && faces < level.cells.length * 3, 'culling removes more than half the original cube faces');
});
