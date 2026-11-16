import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js';
import {MeshStandardMaterial,Color} from 'three';
export const SHIBA_PALETTE=['#d59545','#fff0d2','#303932','#d68a80'];
const ellipsoid=(x,y,z,cx,cy,cz,rx,ry,rz)=>(Math.hypot((x-cx)/rx,(y-cy)/ry,(z-cz)/rz)-1)*Math.min(rx,ry,rz);
const smooth=(a,b,k=.18)=>{const h=Math.max(0,Math.min(1,.5+.5*(b-a)/k));return b*(1-h)+a*h-k*h*(1-h);};
const tail=[[-1.85,.45,0],[-2.25,.8,0],[-2.45,1.3,0],[-2.2,1.72,0],[-1.7,1.72,0],[-1.4,1.3,0],[-1.65,1.0,0]];
function capsule(x,y,z,a,b,r){const p=[x-a[0],y-a[1],z-a[2]],v=b.map((n,i)=>n-a[i]),t=Math.max(0,Math.min(1,p.reduce((n,q,i)=>n+q*v[i],0)/v.reduce((n,q)=>n+q*q,0)));return Math.hypot(...p.map((n,i)=>n-v[i]*t))-r;}
export function shibaDistance(x,y,z){
 let d=ellipsoid(x,y,z,-.55,-.1,0,1.75,1.15,.95);
 d=smooth(d,ellipsoid(x,y,z,.65,.4,0,.85,1.05,.88));
 d=smooth(d,ellipsoid(x,y,z,1.18,1.18,0,1.08,1.03,.98));
 d=smooth(d,ellipsoid(x,y,z,2,.87,0,.72,.46,.68));
 d=smooth(d,ellipsoid(x,y,z,2.58,.99,0,.22,.20,.31),.1);
 for(const side of [-1,1]){
  const q=(y-1.58)/(2.78-1.58),radius=.49*(1-Math.max(0,Math.min(1,q)));
  const ear=Math.max(Math.hypot(x-(1.02+.14*q),(z-side*.62)/.78)-radius,1.58-y,y-2.78);
  d=smooth(d,ear,.1);
  for(const lx of [-1.55,.65]){d=smooth(d,ellipsoid(x,y,z,lx,-1.05,side*.62,.42,.86,.39));d=smooth(d,ellipsoid(x,y,z,lx+.12,-1.73,side*.62,.51,.31,.44),.12);}
 }
 for(let i=1;i<tail.length;i++)d=smooth(d,capsule(x,y,z,tail[i-1],tail[i],.28),.08);
 return d;
}
export function shibaColor(x,y,z){
 if(ellipsoid(x,y,z,2.61,1.01,0,.26,.25,.37)<0)return 2;
 if(ellipsoid(x,y,Math.abs(z),1.97,1.45,.66,.17,.17,.18)<0)return 2;
 if(y>2.05&&Math.abs(z)>.48&&Math.abs(x-1.05)<.2)return 3;
 if(x>1.55&&y<1.23||x>.25&&y<.05||y<-1.5||y<-.67&&x<.5||x< -1.35&&x> -1.8&&y>1.3)return 1;
 return 0;
}
/** Same implicit solid feeds both the smooth mesh and solid game pieces. */
export function buildShibaCells(target=400){
 if(!Number.isInteger(target)||target<200||target>800)throw Error('积木目标应为200–800');let best=[];
 for(let r=7;r<=22;r++){
  const step=5.6/r,cells=[];
  for(let y=-Math.ceil(2.2/step);y<=Math.ceil(3/step);y++)for(let x=-Math.ceil(3/step);x<=Math.ceil(3/step);x++)for(let z=-Math.ceil(1.4/step);z<=Math.ceil(1.4/step);z++)if(shibaDistance(x*step,y*step,z*step)<=0)cells.push({id:cells.length,x,y,z,color:shibaColor(x*step,y*step,z*step),shape:'box',core:false,alive:true});
  if(cells.length<=800&&(!best.length||Math.abs(cells.length-target)<Math.abs(best.length-target)))best=cells;
 }
 return best;
}
export function buildShibaSurface(resolution=48){
 if(!Number.isInteger(resolution)||resolution<24||resolution>64)throw Error('表面分辨率超限');
 const material=new MeshStandardMaterial(),mc=new MarchingCubes(resolution,material,false,false,50000);mc.isolation=0;
 for(let z=0;z<resolution;z++)for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++)mc.field[z*resolution*resolution+y*resolution+x]=-shibaDistance((x/resolution-.5)*8,(y/resolution-.5)*8,(z/resolution-.5)*8);
 mc.update();const count=mc.geometry.drawRange.count,positions=new Float32Array(count*3),normals=new Float32Array(count*3),colors=new Float32Array(count*3),p=mc.geometry.attributes.position.array,n=mc.geometry.attributes.normal.array;
 const palette=SHIBA_PALETTE.map(c=>new Color(c));
 for(let i=0;i<count*3;i+=3){positions[i]=p[i]*4;positions[i+1]=p[i+1]*4;positions[i+2]=p[i+2]*4;const length=Math.hypot(n[i],n[i+1],n[i+2])||1;normals[i]=n[i]/length;normals[i+1]=n[i+1]/length;normals[i+2]=n[i+2]/length;const c=palette[shibaColor(positions[i],positions[i+1],positions[i+2])];colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}
 mc.geometry.dispose();material.dispose();return {positions,normals,colors};
}
/** Minimal static glTF2: one closed mesh, vertex colors, no textures or external data. */
export function writeShibaGlb({positions,normals,colors}){
 const count=positions.length/3,min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];positions.forEach((n,i)=>{min[i%3]=Math.min(min[i%3],n);max[i%3]=Math.max(max[i%3],n);});
 const bytes=positions.byteLength,json={asset:{version:'2.0',generator:'Rose original procedural toy'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{name:'柴犬团子',primitives:[{attributes:{POSITION:0,NORMAL:1,COLOR_0:2},material:0}]}],materials:[{name:'Toy',pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.55}}],buffers:[{byteLength:bytes*3}],bufferViews:[0,1,2].map(i=>({buffer:0,byteOffset:i*bytes,byteLength:bytes})),accessors:[0,1,2].map(i=>({bufferView:i,componentType:5126,count,type:'VEC3',...(i===0?{min,max}:{})}))};
 const raw=new TextEncoder().encode(JSON.stringify(json)),jsonLength=Math.ceil(raw.length/4)*4,total=28+jsonLength+bytes*3,out=new Uint8Array(total),v=new DataView(out.buffer);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,total,true);v.setUint32(12,jsonLength,true);v.setUint32(16,0x4e4f534a,true);out.fill(32,20,20+jsonLength);out.set(raw,20);const start=20+jsonLength;v.setUint32(start,bytes*3,true);v.setUint32(start+4,0x004e4942,true);[positions,normals,colors].forEach((a,i)=>out.set(new Uint8Array(a.buffer,a.byteOffset,a.byteLength),start+8+i*bytes));return out;
}
