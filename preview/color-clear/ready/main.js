import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {buildShibaSurface,writeShibaGlb} from '../shiba.js';
import {cellDisplayColor,createModelDetails} from '../model-appearance.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const config=__READY_PRESET__;let data=config.data,palette=data.palette;
const $=id=>document.getElementById(id),surface=config.kind==='shiba'?buildShibaSurface():null,scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
const renderer=new THREE.WebGLRenderer({canvas:$('canvas'),alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const camera=new THREE.PerspectiveCamera(34,1,.1,100);camera.position.set(7.8,4.3,8.2);camera.lookAt(0,.2,0);
const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.2,0);controls.enableDamping=true;controls.enablePan=false;controls.enableZoom=false;controls.minPolarAngle=.25;controls.maxPolarAngle=Math.PI-.25;controls.autoRotate=true;controls.autoRotateSpeed=.35;let dragHeld=false,resumeAt=0;controls.addEventListener('start',()=>{dragHeld=true;controls.autoRotate=false;});controls.addEventListener('end',()=>{dragHeld=false;resumeAt=performance.now()+1000;});
scene.add(new THREE.HemisphereLight(0xfff8df,0x7b957f,1.5));const key=new THREE.DirectionalLight(0xfff3db,2.8);key.position.set(-3,8,7);scene.add(key);const fill=new THREE.DirectionalLight(0xcbe6eb,.8);fill.position.set(7,2,-5);scene.add(fill);
let solid;
if(surface){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(surface.positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(surface.normals,3));geometry.setAttribute('color',new THREE.BufferAttribute(surface.colors,3));geometry.computeBoundingSphere();solid=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.5,metalness:0}));}
else{try{solid=(await new GLTFLoader().loadAsync(config.asset)).scene;const box=new THREE.Box3().setFromObject(solid),size=box.getSize(new THREE.Vector3()),centre=box.getCenter(new THREE.Vector3()),scale=5.4/Math.max(size.x,size.y,size.z);solid.position.sub(centre).multiplyScalar(scale);solid.position.y+=.3;solid.scale.multiplyScalar(scale);}catch(error){$('status').textContent='实体预览加载失败，请刷新重试。';throw error;}}
root.add(solid);
let cells=data.level.cells,blocks,details=[],appearance=true;
const blockRoot=new THREE.Group();blockRoot.visible=false;root.add(blockRoot);
function setBlocks(nextData,showAppearance=true){
 data=nextData;palette=data.palette;cells=data.level.cells;appearance=showAppearance;
 if(blocks){blockRoot.remove(blocks);blocks.geometry.dispose();blocks.material.dispose();}
 for(const m of details){blockRoot.remove(m);m.geometry.dispose();m.material.dispose();}details=[];
 blocks=new THREE.InstancedMesh(new RoundedBoxGeometry(.985,.985,.985,2,.035),new THREE.MeshStandardMaterial({roughness:.48}),cells.length);
 const dummy=new THREE.Object3D();cells.forEach((c,i)=>{dummy.position.set(c.x,c.y,c.z);dummy.updateMatrix();blocks.setMatrixAt(i,dummy.matrix);blocks.setColorAt(i,appearance?cellDisplayColor(c,palette):new THREE.Color(palette[c.color]));});
 blockRoot.position.set(0,0,0);blockRoot.scale.setScalar(1);blockRoot.add(blocks);blockRoot.updateWorldMatrix(true,true);
 const box=new THREE.Box3().setFromObject(blocks),size=box.getSize(new THREE.Vector3()),centre=box.getCenter(new THREE.Vector3()),scale=5.4/Math.max(size.x,size.y,size.z);
 details=createModelDetails(cells,appearance);for(const mark of details)blockRoot.add(mark);
 blockRoot.scale.setScalar(scale);blockRoot.position.copy(centre).multiplyScalar(-scale);blockRoot.position.y+=.3;
 $('count').textContent=`✓ ${cells.length} 块积木`;
 for(const id of ['plain','detail','fine'])$(id).setAttribute('aria-pressed',String(id===(data===config.comparisonData?'fine':appearance?'detail':'plain')));
 if(window.__readyModel)Object.assign(window.__readyModel,{cells:cells.length,appearance});
}
setBlocks(config.data);
const ground=new THREE.Mesh(new THREE.CircleGeometry(3.2,64),new THREE.MeshBasicMaterial({color:0x798b69,transparent:true,opacity:.12}));ground.rotation.x=-Math.PI/2;ground.position.y=new THREE.Box3().setFromObject(solid).min.y-.06;ground.material.depthWrite=false;scene.add(ground);
new ResizeObserver(()=>{const r=$('canvas').parentElement.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}).observe($('canvas').parentElement);
let frame;function animate(){if(!dragHeld&&resumeAt&&performance.now()>=resumeAt){controls.autoRotate=true;resumeAt=0;}controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(animate);}animate();window.addEventListener('pagehide',()=>cancelAnimationFrame(frame));window.addEventListener('pageshow',e=>{if(e.persisted)animate();});
function mode(showSolid){solid.visible=showSolid;blockRoot.visible=!showSolid;ground.position.y=new THREE.Box3().setFromObject(showSolid?solid:blockRoot).min.y-.06;$('solid').setAttribute('aria-pressed',String(showSolid));$('blocks').setAttribute('aria-pressed',String(!showSolid));}
$('comparison').hidden=config.kind!=='wizard';$('fine').hidden=!config.comparisonData;
$('plain').onclick=()=>{setBlocks(config.data,false);mode(false);};$('detail').onclick=()=>{setBlocks(config.data,true);mode(false);};$('fine').onclick=()=>{setBlocks(config.comparisonData,true);mode(false);};
$('solid').onclick=()=>mode(true);$('blocks').onclick=()=>mode(false);$('count').textContent=`✓ ${cells.length} 块积木`;
$('play').onclick=()=>{try{const variants=data===config.data?(config.shuffles?.variants||[]):[],index=Number(sessionStorage.getItem('color-clear.last-shuffle')??-1);sessionStorage.setItem('color-clear.studio-level',JSON.stringify({data,palette,shuffleVariants:variants,shuffleIndex:index}));location.href='./color-clear.html?studio=1';}catch{$('status').textContent='请允许浏览器本地存储后再试玩。';}};
function download(name,bytes,type){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download').onclick=()=>{if(surface)download('shiba-solid.glb',writeShibaGlb(surface),'model/gltf-binary');else{const a=document.createElement('a');a.href=config.asset;a.download='wizard-duck.glb';a.click();}};$('level-download').onclick=()=>download(config.kind+'-level.json',JSON.stringify(data),'application/json');
window.__readyModel={ready:true,kind:config.kind,cells:cells.length,triangles:surface?surface.positions.length/9:config.triangles};window.__readyShiba=window.__readyModel;
