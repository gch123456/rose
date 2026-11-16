import test from 'node:test';
import assert from 'node:assert/strict';
import { voxelizeTriangles } from '../preview/color-clear/studio-voxelizer.js';

function cube() {
  const v = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  return [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[3,7,6],[3,6,2],[0,4,7],[0,7,3],[1,2,6],[1,6,5]].map((f,i)=>({a:v[f[0]],b:v[f[1]],c:v[f[2]],color:i<6?[1,0,0]:[0,0,1]}));
}
function octahedron() {
  const v = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  return [[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]].map(f=>({a:v[f[0]],b:v[f[1]],c:v[f[2]],color:[0.2,0.7,0.3]}));
}

test('closed cube fills its interior and uses the standard cell contract',()=>{
  const {cells,diagnostics} = voxelizeTriangles(cube(),{targetCount:400,colorCount:2});
  assert.equal(cells.length,343);
  assert.equal(diagnostics.actualCount,343);
  assert.equal(diagnostics.targetCount,400);
  assert.ok(cells.some(c=>c.x===0&&c.y===0&&c.z===0));
  assert.equal(new Set(cells.map(c=>`${c.x},${c.y},${c.z}`)).size,cells.length);
  assert.ok(cells.every(c=>Number.isInteger(c.id)&&Number.isInteger(c.x)&&Number.isInteger(c.color)&&c.core===false&&c.alive===true&&c.shape==='box'));
});
test('octahedron keeps tapered geometry instead of filling its bounding box',()=>{
  const {cells}=voxelizeTriangles(octahedron(),{targetCount:400,colorCount:4});
  assert.ok(cells.length>=250&&cells.length<=550);
  const width=Math.max(...cells.map(c=>c.x))-Math.min(...cells.map(c=>c.x))+1;
  assert.ok(cells.length<width**3*0.6);
  assert.ok(cells.some(c=>c.x===0&&c.y===0&&c.z===0));
});
test('material colors stay coherent and deterministic across scale and translation',()=>{
  const triangles=cube();
  const a=voxelizeTriangles(triangles,{targetCount:600,colorCount:2});
  const b=voxelizeTriangles(triangles.map(t=>({...t,...Object.fromEntries(['a','b','c'].map(k=>[k,t[k].map(n=>n*7-30)]))})),{targetCount:600,colorCount:2});
  assert.deepEqual(a,b);
  assert.deepEqual(new Set(a.diagnostics.palette),new Set(['#ff0000','#0000ff']));
  assert.equal(new Set(a.cells.map(c=>c.color)).size,2);
  assert.deepEqual(a,voxelizeTriangles(triangles,{targetCount:600,colorCount:2}));
});
test('target changes density without deleting arbitrary cells and never exceeds 800',()=>{
  const counts=[200,400,800].map(targetCount=>voxelizeTriangles(cube(),{targetCount,colorCount:2}).cells.length);
  assert.ok(counts[0]<counts[1]&&counts[1]<counts[2]);
  assert.ok(counts.every(n=>n<=800));
  assert.equal(counts[2],729);
});
test('invalid, open, sheet and oversized input is rejected before sampling',()=>{
  for(const value of [[],cube().slice(1),[{a:[0,0,0],b:[1,0,0],c:[0,1,0],color:[1,0,0]}],cube().map((t,i)=>i? t:{...t,a:[NaN,0,0]}),Array(50001).fill(cube()[0])]) assert.throws(()=>voxelizeTriangles(value),Error);
  assert.throws(()=>voxelizeTriangles(cube(),{targetCount:801}),/target/i);
  assert.throws(()=>voxelizeTriangles(cube(),{colorCount:7}),/color/i);
});
test('separately closed overlapping solids form a union without carving their overlap',()=>{
  const triangles=[...cube().map(t=>({...t,solid:0})),...cube().map(t=>({...t,solid:1,...Object.fromEntries(['a','b','c'].map(k=>[k,[t[k][0]+0.5,t[k][1],t[k][2]+1]]))}))];
  const {cells}=voxelizeTriangles(triangles,{targetCount:400,colorCount:2});
  assert.ok(cells.some(c=>c.x===0&&c.y===0&&c.z===0));
});
test('material quantization limits a colorful mesh to requested palette size',()=>{
  const triangles=cube().map((t,i)=>({...t,color:[(i%3)/2,(Math.floor(i/3)%3)/2,(i%2)]}));
  const {cells,diagnostics}=voxelizeTriangles(triangles,{targetCount:400,colorCount:3});
  assert.equal(diagnostics.palette.length,3);
  assert.ok(cells.every(c=>c.color>=0&&c.color<3));
});
