import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const asset = JSON.parse(fs.readFileSync(new URL('../preview/color-clear/ready/wizard-cells.json', import.meta.url)));
const report = JSON.parse(fs.readFileSync(new URL('../preview/color-clear/ready/wizard-report.json', import.meta.url)));
const key = (x,y,z) => `${x},${y},${z}`;
const directions = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const occupied = new Set(asset.cells.map(c => key(c.x,c.y,c.z)));

test('wizard has 600–700 uniquely identified palette-colored solid cells', () => {
  assert.ok(asset.cells.length >= 600 && asset.cells.length <= 700);
  assert.equal(asset.cells.length, 650);
  assert.equal(occupied.size, asset.cells.length);
  assert.ok(asset.palette.length >= 4 && asset.palette.length <= 6);
  assert.equal(new Set(asset.cells.map(c => c.color)).size, asset.palette.length);
  for (const [index, c] of asset.cells.entries()) {
    assert.equal(c.id, index);
    assert.ok([c.x,c.y,c.z,c.color].every(Number.isInteger));
    assert.ok(c.color >= 0 && c.color < asset.palette.length);
    assert.equal(c.shape, 'box');
    assert.equal(c.alive, true);
    assert.equal(c.core, false);
  }
  assert.equal(report.solidCellCount, asset.cells.length);
  assert.equal(report.shellCellCount + report.filledInteriorCellCount, asset.cells.length);
  assert.ok(report.filledInteriorCellCount > 0);
  assert.equal(report.randomDeletionApplied, false);
  assert.equal(report.manualBridgesAdded, 0);
});

test('wizard is one face-connected volume with all fifteen occupied levels', () => {
  const first = asset.cells[0];
  const visited = new Set([key(first.x,first.y,first.z)]);
  const queue = [[first.x,first.y,first.z]];
  for (let i=0; i<queue.length; i++) {
    const [x,y,z] = queue[i];
    for (const [dx,dy,dz] of directions) {
      const p=[x+dx,y+dy,z+dz], k=key(...p);
      if (occupied.has(k) && !visited.has(k)) { visited.add(k); queue.push(p); }
    }
  }
  assert.equal(visited.size, asset.cells.length);
  assert.deepEqual([...new Set(asset.cells.map(c=>c.y))].sort((a,b)=>a-b), Array.from({length:15},(_,i)=>i-7));
  const fullySurrounded = asset.cells.filter(c=>directions.every(([dx,dy,dz])=>occupied.has(key(c.x+dx,c.y+dy,c.z+dz))));
  assert.ok(fullySurrounded.length > 40, `Expected filled body, found ${fullySurrounded.length} interior cells`);
});

test('wizard has no enclosed empty voxels inside its rasterized shell', () => {
  const bounds = ['x','y','z'].map(axis=>[Math.min(...asset.cells.map(c=>c[axis]))-1,Math.max(...asset.cells.map(c=>c[axis]))+1]);
  const start = bounds.map(b=>b[0]);
  const exterior = new Set([key(...start)]), queue=[start];
  for(let i=0;i<queue.length;i++) for(const d of directions) {
    const p=queue[i].map((v,j)=>v+d[j]), k=key(...p);
    if(p.every((v,j)=>v>=bounds[j][0] && v<=bounds[j][1]) && !occupied.has(k) && !exterior.has(k)) {exterior.add(k);queue.push(p);}
  }
  const boxVolume = bounds.reduce((n,[lo,hi])=>n*(hi-lo+1),1);
  assert.equal(exterior.size + occupied.size, boxVolume);
});
