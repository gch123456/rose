import * as THREE from 'three';
/** Appearance never participates in targeting, supply, or conservation. */
export function cellDisplayColor(cell,palette){
 return new THREE.Color(typeof cell.visualTint==='string'&&/^#[0-9a-f]{6}$/i.test(cell.visualTint)?cell.visualTint:palette[cell.color]);
}
/** Source-authored facial accents in lattice space. Every mesh disappears with its owner. */
export function createModelDetails(cells,appearance=true){
 if(!appearance)return [];
 const marks=[];
 const add=(c,radius,color,x,y,z,sx=1,sy=1,sz=1)=>{
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,16,12),new THREE.MeshStandardMaterial({color,roughness:.48}));
  mesh.position.set(c.x+x,c.y+y,c.z+z);mesh.scale.set(sx,sy,sz);mesh.userData.id=c.id;marks.push(mesh);
 };
 for(const c of cells){
  if(c.alive===false)continue;
  if(c.visualDetail==='eye'){
   add(c,.39,0xfff9e9,0,0,.47,.92,1.15,.36);
   add(c,.255,0x253532,0,.015,.59,.78,1.12,.44);
   add(c,.085,0xffffff,-.065,.11,.69,1,1,.4);
  }else if(c.visualDetail==='bill'){
   // A narrow seam on the existing bill block, not an extra unbreakable beak.
   add(c,.40,0x9c692e,0,-.10,.50,1,.13,.15);
  }
 }
 return marks;
}
