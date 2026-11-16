import * as THREE from 'three';
import {makePieceGeometries} from './shapes.js';
import {decodeLevel} from '../../assets/scripts/color-clear/ColorClearLevelData.ts';
import {getDifficultyProfile} from '../../assets/scripts/color-clear/ColorClearDifficulty.ts';
import {ModelOrbit} from '../../assets/scripts/color-clear/ColorClearOrbit.ts';
import {createAlbumUI} from './album.js';
import {normalizePresentation} from './presentation.js';
import { ColorClearGame, FLIGHT_SECONDS, aimY } from '../../assets/scripts/color-clear/ColorClearGame.ts';
import { makeLevel, makeRescueFixture, LEVEL_COUNT } from '../../assets/scripts/color-clear/ColorClearLevels.ts';

const $=id=>document.getElementById(id);
const COLORS=['#ec8068','#e9b842','#64aaca','#68ad89','#ae8fc9','#db9c63'];
const SYMBOLS=['●','▲','◆','■','✦','⬟'];
const NAMES=['珊瑚红','奶油黄','天空蓝','薄荷绿','丁香紫','焦糖棕'];
const pref=(key,fallback)=>{try{return JSON.parse(localStorage.getItem('color-clear.'+key))??fallback;}catch{return fallback;}};
const save=(key,value)=>{try{localStorage.setItem('color-clear.'+key,JSON.stringify(value));}catch{/* Private mode may disable storage; play stays available. */}};
let unlocked=Math.max(1,Math.min(LEVEL_COUNT,Number(pref('unlocked',1))||1));
let muted=pref('muted',false),haptic=pref('haptic',false);
let studioLevel=null,studioError='';
if(new URLSearchParams(location.search).get('studio')==='1'){
 try{const raw=JSON.parse(sessionStorage.getItem('color-clear.studio-level')||'null');if(!raw)throw Error('找不到制作工具传入的关卡');studioLevel=decodeLevel(raw.data);if(!Array.isArray(raw.palette)||raw.palette.length>6||!raw.palette.length||!raw.palette.every(c=>/^#[0-9a-f]{6}$/i.test(c))||studioLevel.cells.some(c=>!raw.palette[c.color]))throw Error('试玩调色板无效');raw.palette.forEach((c,i)=>{COLORS[i]=c;NAMES[i]=`颜色${i+1}`;});}
 catch(error){studioError='制作关卡未加载：'+error.message;studioLevel=null;}
}
const fixtureMode=!!studioLevel||new URLSearchParams(location.search).get('fixture')==='rescue';
const levelFor=n=>studioLevel?structuredClone(studioLevel):fixtureMode?makeRescueFixture():makeLevel(n);
let settings=normalizePresentation(pref('presentation',{})),rewardSession=null,reserveOpen=false;
let model=new ColorClearGame(levelFor(1));
const orbit=new ModelOrbit(),openingSpin=new URLSearchParams(location.search).get('autospin')!=='0';orbit.reset(openingSpin);
let renderer,meshes=[],pieces=[],coreMarks=[],viewScale=9,frameId,drag=null,lastTime=performance.now(),uiStamp='',shownPhase='',comboUntil=0,lastTone=0,audio,rotationVelocity=0,lastDragTime=0,rangeStamp='';
let particles=[],bullets=[];
const scene=new THREE.Scene();
const root=new THREE.Group();root.position.y=-.65;scene.add(root);
const rangeGeometry=new THREE.BufferGeometry();
const rangeLines=new THREE.LineSegments(rangeGeometry,new THREE.LineBasicMaterial({color:0xffeab1,transparent:true,opacity:.8,depthTest:true}));root.add(rangeLines);
const edgePositions=new THREE.EdgesGeometry(new THREE.BoxGeometry(1.015,1.015,1.015)).getAttribute('position');
const camera=new THREE.OrthographicCamera(-8,8,10,-10,.1,100);
// Model Euler XYZ = Rx(pitch) Ry(yaw), matching shared viewDirection exactly.
camera.position.set(0,0,25);camera.lookAt(0,0,0);
scene.add(new THREE.HemisphereLight(0xfffff5,0x697f78,1.25));
const key=new THREE.DirectionalLight(0xfff5df,2.5);key.position.set(-6,11,10);scene.add(key);
const fill=new THREE.DirectionalLight(0xb9dfed,.85);fill.position.set(7,0,3);scene.add(fill);
const shapeGeometries=makePieceGeometries();
const material=new THREE.MeshPhysicalMaterial({roughness:.34,metalness:0,clearcoat:.45,clearcoatRoughness:.3});
const particleMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.18,.18,.18),material,120);particleMesh.count=0;particleMesh.frustumCulled=false;scene.add(particleMesh);
const dummy=new THREE.Object3D();
let domColors=COLORS.map(c=>new THREE.Color(c));
try{renderer=new THREE.WebGLRenderer({canvas:$('world'),alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;}
catch(error){$('webgl-error').hidden=false;throw error;}

function animalDetails(cells,id){
 if(studioLevel)return [];
 const details=[],duck=(id-1)%3===0;
 for(const c of cells){
  const eye=duck?c.x===3&&c.y===3&&Math.abs(c.z)===2:Math.abs(c.x)===1&&c.y===3&&Math.abs(c.z)===2;
  if(!eye)continue;const side=Math.sign(c.z);
  for(const [radius,color,dx,dy,depth] of [[.22,0xfff9e6,.03,.13,.40],[.135,0x263d37,.07,.14,.55],[.047,0xffffff,.04,.19,.665],[.12,0xed997b,-.17,-.2,.47]]){
   const mark=new THREE.Mesh(new THREE.SphereGeometry(radius,12,10),new THREE.MeshBasicMaterial({color}));
   mark.position.set(c.x+dx,c.y+dy,c.z+depth*side);mark.userData.id=c.id;details.push(mark);
  }
 }
 return details;
}
function buildModel(){
 for(const m of meshes){root.remove(m);m.dispose();}meshes=[];pieces=[];
 for(const m of coreMarks){root.remove(m);m.geometry.dispose();m.material.dispose();}coreMarks=[];
 for(const shape of new Set(model.cells.map(c=>c.shape||'box'))){const cells=model.cells.filter(c=>(c.shape||'box')===shape),m=new THREE.InstancedMesh(shapeGeometries[shape],material,cells.length);m.frustumCulled=false;root.add(m);meshes.push(m);cells.forEach((c,index)=>pieces[c.id]={mesh:m,index});}
 for(const c of model.cells){
  pieces[c.id].mesh.setColorAt(pieces[c.id].index,domColors[c.color]);
  if(c.core){const mark=new THREE.Mesh(new THREE.TorusGeometry(.20,.032,5,12),new THREE.MeshBasicMaterial({color:0xfff8d7}));mark.position.set(c.x,c.y,c.z+.49);mark.userData.id=c.id;root.add(mark);coreMarks.push(mark);}
 }
 // Every detail belongs to a removable cell, including in the collection thumbnail.
 for(const mark of animalDetails(model.cells,model.level.id)){root.add(mark);coreMarks.push(mark);}
 const maxY=Math.max(...model.cells.map(c=>Math.abs(c.y))),maxX=Math.max(...model.cells.map(c=>Math.hypot(c.x,c.z)));
 viewScale=Math.max(maxY*2+4.8,maxX*2+2.6);
 $('projectiles').replaceChildren();bullets=[];particles=[];
 rangeStamp='';$('world').dataset.chainEvents='0';$('world').dataset.maxChainRange='0';resize();syncBlocks();
}
function resize(){
 const r=$('stage').getBoundingClientRect();
 if(!r.width||!r.height)return;
 renderer.setSize(r.width,r.height,false);
 const aspect=r.width/r.height;
 const width=Math.max(viewScale,viewScale*aspect*.9);
 const height=width/aspect;
 camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe($('stage'));
function syncBlocks(){
 for(const c of model.cells){dummy.position.set(c.x,c.y,c.z);dummy.scale.setScalar(c.alive?1:0);dummy.rotation.set(0,0,0);dummy.updateMatrix();pieces[c.id].mesh.setMatrixAt(pieces[c.id].index,dummy.matrix);}
 for(const m of meshes)m.instanceMatrix.needsUpdate=true;
 for(const mark of coreMarks)mark.visible=model.cells.find(c=>c.id===mark.userData.id)?.alive??false;
}
function positionOf(c){return new THREE.Vector3(c.x,aimY(c),c.z).applyEuler(new THREE.Euler(model.pitch,model.yaw,0,'XYZ')).add(root.position);}
function burst(c,core){
 const p=positionOf(c),count=core?10:3;
 for(let i=0;i<count&&particles.length<110;i++)particles.push({p:p.clone(),v:new THREE.Vector3((Math.random()-.5)*8,2+Math.random()*4,(Math.random()-.5)*6),age:0,life:.4+Math.random()*.3,color:c.color,spin:Math.random()*6});
}
function ensureAudio(){
 if(muted)return;
 try{const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)return;if(!audio)audio=new C();if(audio.state==='suspended')audio.resume().catch(()=>{});}catch{/* Audio is optional. */}
}
function tone(freq=600,duration=.055,volume=.035,delay=0){
 if(muted||!audio||audio.state!=='running')return;
 const t=audio.currentTime+delay,o=audio.createOscillator(),gain=audio.createGain();o.type='sine';o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(freq*.68,t+duration);
 gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(gain);gain.connect(audio.destination);o.start(t);o.stop(t+duration+.01);o.onended=()=>{o.disconnect();gain.disconnect();};
}
function vibrate(){if(haptic&&navigator.vibrate)navigator.vibrate(9);}
function soundEvent(e){
 const now=performance.now();
 if(e.type==='load'){tone(480+e.color*70,.06,.05);vibrate();}
 else if(e.type==='chain'){tone(1100,.16,.04);vibrate();}
 else if(e.type==='hit'&&now-lastTone>45){tone(540+Math.min(12,model.combo%16)*42,.035,.023);lastTone=now;}
 else if(e.type==='empty')tone(1000,.09,.018);
 else if(e.type==='won'){[660,830,990,1320].forEach((f,i)=>tone(f,.19,.045,i*.10));}
 else if(e.type==='lost')tone(250,.22,.04);
}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),1600);}
function capsuleMarkup(c,preview=false,waiting=false){return `<span class="symbol">${SYMBOLS[c.color]}</span><strong>${c.ammo}</strong>`;}
function syncUI(force=false){
 const signature=JSON.stringify([model.slots,model.supply.map(c=>c.slice(0,2)),model.phase,model.remaining,muted,model.reserve,settings,orbit.automatic,...(model.slots.some(Boolean)?[model.yaw.toFixed(2),model.pitch.toFixed(2)]:[])]);
 if(!force&&signature===uiStamp)return;uiStamp=signature;
 applyPresentation();
 $('level-name').textContent=`第 ${String(model.level.id).padStart(2,'0')} 关 · ${model.level.name}`;
 $('level-dots').textContent=Array.from({length:5},(_,i)=>i<(model.level.id-1)%5+1?'●':'○').join(' ');
 $('remaining').textContent=`剩余 ${model.remaining} 块`;$('percent').textContent=`${Math.round(model.progress*100)}%`;$('progress').style.width=model.progress*100+'%';
 const visibleColors=new Set(model.visibleTargets().map(c=>c.color));
 $('slot-count').textContent=`${model.slots.filter(Boolean).length} / ${model.slots.length}`;
 $('reserve-toggle').hidden=!model.reserve.length;$('reserve-toggle').textContent=`暂存 ${model.reserve.length}`;
 $('reserve-tray').hidden=!reserveOpen||!model.reserve.length;
 for(let i=0;i<model.reserve.length;i++){const c=model.reserve[i];let b=$('reserve-tray').children[i];if(!b){b=document.createElement('button');$('reserve-tray').append(b);}b.className='capsule';b.dataset.reserve=String(i);b.style.setProperty('--color',COLORS[c.color]);if(b.dataset.content!==`${c.id}:${c.ammo}`){b.innerHTML=capsuleMarkup(c);b.dataset.content=`${c.id}:${c.ammo}`;}b.setAttribute('aria-label',`取回${NAMES[c.color]}，${c.ammo}发`);b.onclick=()=>{ensureAudio();orbit.stop();if(model.takeReserve(i)){syncUI(true);processEvents();}};}
 while($('reserve-tray').children.length>model.reserve.length)$('reserve-tray').lastElementChild.remove();
 for(let i=0;i<6;i++){
  const c=model.slots[i];let slot=$('slots').children[i];
  if(!slot){slot=document.createElement('div');slot.dataset.slot=String(i);$('slots').append(slot);}
  if(i>=model.slots.length){slot.className='slot locked';let b=slot.querySelector('.unlock-slot');if(!b){b=document.createElement('button');b.className='unlock-slot';b.dataset.unlock=String(i);b.innerHTML='▣<small>视频解锁</small>';b.setAttribute('aria-label',`模拟广告解锁第${i+1}槽`);b.onclick=()=>requestReward('slot');slot.replaceChildren(b);}b.disabled=i!==model.slots.length;continue;}
  slot.className='slot'+(c?' occupied':'');
  if(c){let item=slot.querySelector('.capsule');if(!item||item.dataset.id!==String(c.id)){item=document.createElement('div');item.dataset.id=String(c.id);slot.replaceChildren(item);}item.className='capsule'+(!visibleColors.has(c.color)?' waiting':'');item.style.setProperty('--color',COLORS[c.color]);item.innerHTML=capsuleMarkup(c);item.setAttribute('aria-label',`${NAMES[c.color]}剩余${c.ammo}发`);}else slot.replaceChildren();
 }
 for(let row=0;row<2;row++)for(let col=0;col<4;col++){
  const c=model.supply[col][row];
  const previous=$('supply').children[row*4+col];
  if(!c){if(!previous?.classList.contains('empty-supply')){const blank=document.createElement('div');blank.className='empty-supply'+(row?' preview-card':'');blank.textContent='·';if(previous)previous.replaceWith(blank);else $('supply').append(blank);}continue;}
  let b=previous;if(!b||b.tagName!=='BUTTON'){b=document.createElement('button');if(previous)previous.replaceWith(b);else $('supply').append(b);}
  b.className='capsule'+(row?' preview-card':'');b.style.setProperty('--color',COLORS[c.color]);if(b.dataset.content!==`${c.id}:${c.ammo}`){b.innerHTML=capsuleMarkup(c);b.dataset.content=`${c.id}:${c.ammo}`;}b.disabled=row>0;b.setAttribute('aria-label',`${row?'下一颗':'选择'}${NAMES[c.color]}，${c.ammo}发`);
  if(!row){b.dataset.column=String(col);b.onclick=()=>{
   ensureAudio();orbit.stop();const origin=b.getBoundingClientRect(),slotIndex=model.slots.indexOf(null);
   if(!model.select(col)){toast('发射槽已满，先转动模型消除一些');return;}
   syncUI(true);const arrival=$('slots').children[slotIndex]?.querySelector('.capsule');
   if(arrival&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const target=arrival.getBoundingClientRect();arrival.style.zIndex='4';arrival.animate([{transform:`translate(${origin.x+origin.width/2-target.x-target.width/2}px,${origin.y+origin.height/2-target.y-target.height/2}px) scale(1.1)`},{transform:'translate(0,0) scale(1)'}],{duration:190,easing:'cubic-bezier(.2,.7,.25,1)'});}
   processEvents();
  };}
 }
 const active=model.slots.filter(Boolean),waiting=active.length&&!active.some(c=>visibleColors.has(c.color));
 $('status').textContent=waiting?'↔ 转一转，寻找同色积木':active.length?'同色消除中…':'选一颗，让颜色动起来';
 $('core-tip').textContent='● 一发一块，同色弹药与积木对应';
 $('sound').textContent=muted?'♪̸':'♫';$('dialog-sound').textContent=`声音：${muted?'关':'开'}`;$('dialog-haptic').textContent=`振动：${haptic?'开':'关'}`;
}
function processEvents(){
 let changed=false;
 for(const e of model.drainEvents()){
  soundEvent(e);
  if(e.type==='clear'){burst(e.cell,e.core);changed=true;comboUntil=performance.now()+1000;}
  if(e.type==='fire'){
   const source=$('slots').children[e.slot].getBoundingClientRect(),shell=document.querySelector('.game-shell').getBoundingClientRect();
   const path=document.createElementNS('http://www.w3.org/2000/svg','path'),ball=document.createElementNS('http://www.w3.org/2000/svg','circle');
   path.setAttribute('fill','none');path.setAttribute('stroke',COLORS[e.color]);path.setAttribute('stroke-width','2.5');path.setAttribute('opacity','.3');ball.setAttribute('r','4.3');ball.setAttribute('fill','#fffef4');ball.setAttribute('stroke',COLORS[e.color]);ball.setAttribute('stroke-width','2');
   $('projectiles').append(path,ball);bullets.push({path,ball,start:{x:source.x+source.width/2-shell.x,y:source.y-shell.y+4},cell:e.cell,age:0,id:e.flightId});
   const slot=$('slots').children[e.slot];slot.classList.remove('firing');void slot.offsetWidth;slot.classList.add('firing');
  }
  if(e.type==='load'){const slot=$('slots').children[e.slot];slot?.classList.add('pop');}
  if(e.type==='chain'){ $('combo').textContent='漂亮命中 ✧'; $('world').dataset.chainEvents=String(Number($('world').dataset.chainEvents||0)+1); }
  if(e.type==='won'&&!fixtureMode){albumUI.record(model.level.id);unlocked=Math.max(unlocked,Math.min(LEVEL_COUNT,model.level.id+1));save('unlocked',unlocked);}
 }
 if(changed)syncBlocks();
}
function openDialog(mode='phase'){
 $('overlay').hidden=false;
 const won=model.phase==='won',lost=model.phase==='lost';
 $('dialog-symbol').textContent=won?'✧':lost?'↻':'Ⅱ';$('dialog-kicker').textContent=won?'A LITTLE WELL DONE':lost?'TRY A DIFFERENT ORDER':'TAKE YOUR TIME';
 $('dialog-title').textContent=mode==='help'?'两种操作，就会玩':won?'清得漂亮！':lost?'差一点，换个顺序':'休息一下';
 $('dialog-text').textContent=mode==='help'?`${getDifficultyProfile(model.level.id).label}：点前排胶囊进入发射槽，自动消除同色积木。上下左右拖动寻找目标。${model.level.id<4?'同色弹药与积木数相等，每发清除一块。':'每发清除一块；注意留槽位给能打开外层的颜色。'}`:won?`清除了 ${model.cells.length} 块积木，用了 ${model.shots} 发。${model.level.id===LEVEL_COUNT?'十关体验完成，也可以回头试试另一种顺序。':'下一份颜色，已经准备好了。'}`:lost?model.reason:'颜色不会偷偷溜走，准备好了再继续。';
 $('primary').textContent=studioLevel&&won?'再玩这关':lost&&model.canContinue?'模拟广告 · 暂存续关':won?(model.level.id===LEVEL_COUNT?'从第一关再来':'下一关 →'):lost?'换个顺序再试':'继续游戏';
 $('primary').onclick=()=>{ensureAudio();if(won)loadLevel(model.level.id===LEVEL_COUNT?1:model.level.id+1);else if(lost){if(model.canContinue)requestReward('continue');else loadLevel(model.level.id);}else{model.resume();$('overlay').hidden=true;shownPhase='playing';lastTime=performance.now();}};
}
function pause(){drag=null;rotationVelocity=0;orbit.release(true,0);if(model.phase==='playing'){model.pause();shownPhase='paused';openDialog();syncUI(true);}}
function loadLevel(n){if(rewardSession){rewardSession.owner.resolveReward(rewardSession.ticket,false);rewardSession=null;}$('reward-overlay').hidden=true;reserveOpen=false;drag=null;rotationVelocity=0;model=new ColorClearGame(levelFor(n));orbit.reset(openingSpin);shownPhase='playing';uiStamp='';comboUntil=0;$('combo').classList.remove('show');$('overlay').hidden=true;buildModel();syncUI(true);lastTime=performance.now();}
$('pause').onclick=()=>{ensureAudio();pause();};$('restart').onclick=()=>{ensureAudio();loadLevel(model.level.id);};
function toggleSound(){muted=!muted;save('muted',muted);if(!muted){ensureAudio();tone();}syncUI(true);}
$('sound').onclick=toggleSound;$('dialog-sound').onclick=toggleSound;
$('dialog-haptic').onclick=()=>{haptic=!haptic;save('haptic',haptic);syncUI(true);vibrate();};
$('help').onclick=()=>{pause();openDialog('help');};
$('level-select').onclick=()=>{
 $('dialog-title').textContent='选择一份颜色';$('dialog-text').textContent=`已解锁 ${unlocked} / ${LEVEL_COUNT} 关`;
 const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:14px 0';
 for(let i=1;i<=LEVEL_COUNT;i++){const b=document.createElement('button');b.textContent=String(i);b.disabled=i>unlocked;b.style.cssText=`padding:10px 0;background:${i<=unlocked?'#deedda':'#eff0e9'};opacity:${i<=unlocked?1:.4}`;b.onclick=()=>loadLevel(i);grid.append(b);}
 $('dialog-text').append(grid);
};
$('stage').addEventListener('pointerdown',e=>{if(model.phase!=='playing'||drag)return;ensureAudio();drag={id:e.pointerId,x:e.clientX,y:e.clientY};rotationVelocity=0;orbit.stop();lastDragTime=performance.now();$('stage').setPointerCapture(e.pointerId);});
$('stage').addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const now=performance.now();orbit.drag(model,e.clientX-drag.x,e.clientY-drag.y,(now-lastDragTime)/1000);lastDragTime=now;drag.x=e.clientX;drag.y=e.clientY;root.rotation.set(model.pitch,model.yaw,0,'XYZ');syncUI(true);});
function endDrag(e){if(drag?.id===e.pointerId){orbit.release(e.type!=='pointerup',(performance.now()-lastDragTime)/1000);drag=null;if($('stage').hasPointerCapture(e.pointerId))$('stage').releasePointerCapture(e.pointerId);}}
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('stage').addEventListener(event,endDrag);
window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(albumUI.isOpen){albumUI.close();return;}if(rewardSession){finishReward(false);return;}if(model.phase==='paused')$('primary').click();else pause();}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){orbit.stop();model.rotate(e.key==='ArrowLeft'?-.15:e.key==='ArrowRight'?.15:0,e.key==='ArrowUp'?.15:e.key==='ArrowDown'?-.15:0);syncUI(true);}});
$('world').addEventListener('webglcontextlost',e=>{e.preventDefault();pause();toast('3D画面暂时中断，请刷新页面恢复');});
function frame(time){
 const dt=Math.min(.04,Math.max(0,(time-lastTime)/1000));lastTime=time;
 orbit.step(model,dt,!!drag);
 model.tick(dt);root.rotation.set(model.pitch,model.yaw,0,'XYZ');processEvents();syncUI();
 if(model.phase!==shownPhase){shownPhase=model.phase;if(!rewardSession&&(model.phase==='won'||model.phase==='lost'))openDialog();}
 const shell=document.querySelector('.game-shell').getBoundingClientRect(),stageRect=$('stage').getBoundingClientRect();$('projectiles').setAttribute('viewBox',`0 0 ${shell.width} ${shell.height}`);
 for(let i=bullets.length-1;i>=0;i--){const b=bullets[i],flight=model.flights.find(f=>f.id===b.id);if(!flight){b.path.remove();b.ball.remove();bullets.splice(i,1);continue;}const point=positionOf(b.cell).project(camera),end={x:stageRect.x-shell.x+(point.x+1)*stageRect.width/2,y:stageRect.y-shell.y+(1-point.y)*stageRect.height/2};const t=Math.max(0,Math.min(1,1-flight.time/FLIGHT_SECONDS)),control={x:(b.start.x+end.x)/2,y:Math.min(b.start.y,end.y)-24};
  b.path.setAttribute('d',`M${b.start.x},${b.start.y} Q${control.x},${control.y} ${end.x},${end.y}`);b.ball.setAttribute('cx',String((1-t)**2*b.start.x+2*(1-t)*t*control.x+t*t*end.x));b.ball.setAttribute('cy',String((1-t)**2*b.start.y+2*(1-t)*t*control.y+t*t*end.y));
 }
 particles=particles.filter(p=>p.age<p.life);
 for(let i=0;i<particles.length;i++){const p=particles[i];p.age+=dt;p.v.y-=14*dt;p.p.addScaledVector(p.v,dt);dummy.position.copy(p.p);dummy.rotation.set(p.age*6,p.spin+p.age*5,p.age*3);dummy.scale.setScalar(Math.max(0,1-p.age/p.life)*1.6);dummy.updateMatrix();particleMesh.setMatrixAt(i,dummy.matrix);particleMesh.setColorAt(i,domColors[p.color]);}
 particleMesh.count=particles.length;particleMesh.instanceMatrix.needsUpdate=true;if(particleMesh.instanceColor)particleMesh.instanceColor.needsUpdate=true;
 if(time<comboUntil&&model.combo>=3){if(!$('combo').textContent.startsWith('连锁')||model.combo%7===0)$('combo').textContent=`消除 × ${model.combo}`;$('combo').classList.add('show');}else{$('combo').classList.remove('show');$('combo').textContent='';}
 const stamp=model.remaining+':'+model.yaw.toFixed(3)+':'+model.pitch.toFixed(3);
 if(stamp!==rangeStamp){
  rangeStamp=stamp;const affected=new Set();
  for(const core of model.visibleTargets().filter(c=>c.core))for(const c of model.chainPreview(core.id))affected.add(c.id);
  const positions=[];for(const id of affected){const c=model.cells.find(cell=>cell.id===id);if(!c)continue;for(let i=0;i<edgePositions.count;i++)positions.push(edgePositions.getX(i)+c.x,edgePositions.getY(i)+c.y,edgePositions.getZ(i)+c.z);}
  rangeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));rangeGeometry.computeBoundingSphere();rangeLines.visible=positions.length>0; $('world').dataset.maxChainRange=String(Math.max(Number($('world').dataset.maxChainRange||0),affected.size));
 }
 renderer.render(scene,camera);frameId=requestAnimationFrame(frame);
}
window.__colorClear={snapshot:()=>({level:model.level.id,phase:model.phase,remaining:model.remaining,shots:model.shots,yaw:model.yaw,pitch:model.pitch,automatic:orbit.automatic,slots:model.slots.map(s=>s?{...s}:null),supply:model.supply.map(c=>c.length),reason:model.reason,reserve:model.reserve.map(c=>({...c})),flights:model.flights.length,shapes:[...new Set(model.cells.map(c=>c.shape||'box'))]})};
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frameId);audio?.suspend();});
window.addEventListener('pageshow',e=>{if(e.persisted){lastTime=performance.now();frameId=requestAnimationFrame(frame);}});

function applyPresentation(){
 if($('auto-rotate'))$('auto-rotate').textContent=`自动旋转：${orbit.automatic?'开':'关'}`;
 document.querySelector('.game-shell').classList.toggle('minimal-copy',!settings.labels);
 document.querySelector('.progress-track').hidden=!settings.progress;$('remaining').hidden=!settings.remaining;$('percent').hidden=!settings.progress;document.querySelector('.background-art').hidden=!settings.background;
 document.querySelector('.heading h1').textContent=studioLevel?`制作试玩 · ${model.level.name}`:settings.labels?'转转积木':`第 ${String(model.level.id).padStart(2,'0')} 关 · ${model.level.name}`;
 for(const b of document.querySelectorAll('[data-display]')){const key=b.dataset.display,names={progress:'进度条',remaining:'剩余块数',labels:'说明文字',background:'背景'};b.textContent=`${names[key]}：${settings[key]?'开':'关'}`;b.setAttribute('aria-pressed',String(settings[key]));}
}
$('auto-rotate').onclick=()=>{orbit.reset(!orbit.automatic);syncUI(true);};
for(const b of document.querySelectorAll('[data-display]'))b.onclick=()=>{settings[b.dataset.display]=!settings[b.dataset.display];save('presentation',settings);syncUI(true);};
$('reserve-toggle').onclick=()=>{reserveOpen=!reserveOpen;syncUI(true);};
function requestReward(kind){
 ensureAudio();const owner=model,ticket=owner.beginReward(kind);if(!ticket){toast(kind==='slot'?'本局槽位已全部解锁':'本局无法再次续关');return;}
 rotationVelocity=0;drag=null;orbit.release(true,0);rewardSession={owner,ticket};$('reward-title').textContent=kind==='slot'?`解锁第 ${model.slots.length+1} 个槽位`:'暂存胶囊，继续这一局';$('reward-overlay').hidden=false;syncUI(true);
}
function finishReward(completed){
 const session=rewardSession;if(!session)return;rewardSession=null;$('reward-overlay').hidden=true;
 const granted=session.owner.resolveReward(session.ticket,completed);if(session.owner!==model)return;
 if(granted){$('overlay').hidden=true;if(session.ticket.kind==='continue'){reserveOpen=true;toast('胶囊已暂存，可先选择新颜色');}else toast(`已解锁 ${model.slots.length} 个槽位`);}
 shownPhase=model.phase;syncUI(true);lastTime=performance.now();
}
$('reward-complete').onclick=()=>finishReward(true);$('reward-cancel').onclick=()=>finishReward(false);
const thumbnailCache=new Map();let thumbnailRenderer;
function modelThumbnail(id){
 if(thumbnailCache.has(id))return thumbnailCache.get(id);
 if(!thumbnailRenderer){thumbnailRenderer=new THREE.WebGLRenderer({alpha:true,antialias:true});thumbnailRenderer.setSize(160,160);thumbnailRenderer.outputColorSpace=THREE.SRGBColorSpace;thumbnailRenderer.toneMapping=THREE.ACESFilmicToneMapping;}
 const miniature=new THREE.Scene(),group=new THREE.Group(),level=makeLevel(id);miniature.add(group);group.rotation.set(.28,.55,0);
 miniature.add(new THREE.HemisphereLight(0xfffff5,0x697f78,1.25));const lamp=new THREE.DirectionalLight(0xfff5df,2.5);lamp.position.set(-6,11,10);miniature.add(lamp);
 const parts=[];for(const shape of new Set(level.cells.map(c=>c.shape||'box'))){const cells=level.cells.filter(c=>(c.shape||'box')===shape),m=new THREE.InstancedMesh(shapeGeometries[shape],material,cells.length);m.frustumCulled=false;cells.forEach((c,i)=>{dummy.position.set(c.x,c.y,c.z);dummy.scale.setScalar(1);dummy.rotation.set(0,0,0);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);m.setColorAt(i,domColors[c.color]);});parts.push(m);group.add(m);}
 const details=animalDetails(level.cells,id);details.forEach(p=>group.add(p));
 const extent=new THREE.Box3().setFromObject(group),centre=extent.getCenter(new THREE.Vector3()),size=extent.getSize(new THREE.Vector3());group.position.sub(centre);const half=Math.max(size.x,size.y)*.6,cam=new THREE.OrthographicCamera(-half,half,half,-half,.1,100);cam.position.set(0,0,25);cam.lookAt(0,0,0);thumbnailRenderer.render(miniature,cam);const image=thumbnailRenderer.domElement.toDataURL('image/png');parts.forEach(p=>p.dispose());details.forEach(p=>{p.geometry.dispose();p.material.dispose();});thumbnailCache.set(id,image);return image;
}
const albumUI=createAlbumUI({fixtureMode,thumbnail:modelThumbnail,toast,pause(){
 const playing=model.phase==='playing',overlayWasHidden=$('overlay').hidden;if(playing)model.pause();drag=null;rotationVelocity=0;orbit.release(true,0);$('overlay').hidden=true;
 return()=>{if(playing&&model.phase==='paused'){model.resume();shownPhase='playing';}else $('overlay').hidden=overlayWasHidden;lastTime=performance.now();};
}});
buildModel();syncUI(true);shownPhase='playing';if(studioError)toast(studioError);if(studioLevel){$('level-select').hidden=true;$('album-button').hidden=true;}frameId=requestAnimationFrame(frame);
