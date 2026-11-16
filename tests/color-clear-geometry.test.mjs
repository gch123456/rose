import {test} from 'node:test';import assert from 'node:assert/strict';
import {specialPieceGeometry} from '../assets/scripts/color-clear/ColorClearGeometry.ts';
test('native half sphere is closed below, bounded above and has finite outward normals',()=>{
 const g=specialPieceGeometry('hemisphere');assert.ok(g.indices.length>100);assert.equal(g.normals.length,g.positions.length);
 for(let i=0;i<g.positions.length;i+=3){assert.ok(g.positions[i+1]>=-1e-9&&g.positions[i+1]<=.500001);assert.ok(g.positions.slice(i,i+3).every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...g.normals.slice(i,i+3))-1)<1e-6);}
 assert.ok(g.normals.some((n,i)=>i%3===1&&n<-.99),'closed bottom cap');
});
test('native wedge matches the narrowed positive-Z footprint used by the ray tests',()=>{
 const g=specialPieceGeometry('wedge');for(let i=0;i<g.positions.length;i+=3)if(g.positions[i+2]===.5)assert.ok(Math.abs(g.positions[i])<=.300001);
});
test('wedge faces point outward so front-face culling does not show the inside',()=>{
 const g=specialPieceGeometry('wedge');let foundFront=false;
 for(let i=0;i<g.positions.length;i+=9){const z=[g.positions[i+2],g.positions[i+5],g.positions[i+8]];if(z.every(v=>v===-.5)){foundFront=true;assert.ok(g.normals[i+2]<-.99);}}
 assert.ok(foundFront);
});
