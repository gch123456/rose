import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export function makePieceGeometries(){
 const upper=new THREE.SphereGeometry(.5,14,8,0,Math.PI*2,0,Math.PI/2);
 const cap=new THREE.CircleGeometry(.5,14);cap.rotateX(Math.PI/2);
 const verts=[[-.5,-.5,-.5],[.5,-.5,-.5],[.3,-.5,.5],[-.3,-.5,.5],[-.5,.5,-.5],[.5,.5,-.5],[.3,.5,.5],[-.3,.5,.5]];
 const faces=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
 const wedge=new THREE.BufferGeometry();wedge.setAttribute('position',new THREE.Float32BufferAttribute(faces.flatMap(([a,b,c])=>[a,c,b].flatMap(i=>verts[i])),3));wedge.computeVertexNormals();
 return {box:new RoundedBoxGeometry(.985,.985,.985,2,.035),sphere:new THREE.SphereGeometry(.5,14,10),cylinder:new THREE.CylinderGeometry(.5,.5,1,14),hemisphere:mergeGeometries([upper,cap]),wedge};
}
