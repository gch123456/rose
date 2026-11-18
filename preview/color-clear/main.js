import {CampState,AudioPreferences} from './camp-state.js';
import {CampAudio} from './camp-audio.js';
import {reorderRemainingSupply} from './camp-reorder.js';
import {cellDisplayColor,createModelDetails} from './model-appearance.js';
import {openModelInspector} from './model-inspector.js';
import * as THREE from 'three';
import {chooseVariant,variantData} from './supply-variants.js';
import {makePieceGeometries} from './shapes.js';
import {decodeLevel} from '../../assets/scripts/color-clear/ColorClearLevelData.ts';
import {ModelOrbit} from '../../assets/scripts/color-clear/ColorClearOrbit.ts';
import {createAlbumUI} from './album.js';
import {normalizePresentation} from './presentation.js';
import { ColorClearGame, FLIGHT_SECONDS, aimY, levelEliminationPace } from '../../assets/scripts/color-clear/ColorClearGame.ts';
import { makeRescueFixture } from '../../assets/scripts/color-clear/ColorClearLevels.ts';

import {RESCUES, RESCUE_COUNT, CAMPAIGN_PROGRESS_KEY, WIZARD_QUEUE_COUNT, makeCampaignLevel, campaignModel, normalizeRescueOrder} from './campaign.js';

const $=id=>document.getElementById(id);
const COLORS=['#ec8068','#e9b842','#64aaca','#68ad89','#ae8fc9','#db9c63'];
const SYMBOLS=['●','▲','◆','■','✦','⬟'];
const NAMES=['珊瑚红','奶油黄','天空蓝','薄荷绿','丁香紫','焦糖棕'];
const pref=(key,fallback)=>{try{return JSON.parse(localStorage.getItem('color-clear.'+key))??fallback;}catch{return fallback;}};
const save=(key,value)=>{try{localStorage.setItem('color-clear.'+key,JSON.stringify(value));}catch{/* Private mode may disable storage; play stays available. */}};
let unlocked=normalizeRescueOrder(pref(CAMPAIGN_PROGRESS_KEY,1));
const localStorageAdapter={getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)},audioPrefs=new AudioPreferences(localStorageAdapter),campState=new CampState(localStorageAdapter),campAudio=new CampAudio(audioPrefs);
let muted=!audioPrefs.effects,haptic=pref('haptic',false);
let studioLevel=null,studioError='',shuffleBase=null,shuffleVariants=[],shuffleIndex=-1;
if(new URLSearchParams(location.search).get('studio')==='1'){
 try{
  const rawText=sessionStorage.getItem('color-clear.studio-level')||'null';if(rawText.length>3000000)throw Error('试玩数据超限');const raw=JSON.parse(rawText);if(!raw)throw Error('找不到制作工具传入的关卡');
  const pool=Array.isArray(raw.shuffleVariants)&&raw.shuffleVariants.length>=2&&raw.shuffleVariants.length<=8?raw.shuffleVariants:[];
  const last=Number(sessionStorage.getItem('color-clear.last-shuffle')??raw.shuffleIndex??-1),index=pool.length?chooseVariant(pool.length,last):-1;
  const next=decodeLevel(pool.length?variantData(raw.data,pool[index]):raw.data);
  if(!Array.isArray(raw.palette)||raw.palette.length>6||!raw.palette.length||!raw.palette.every(c=>/^#[0-9a-f]{6}$/i.test(c))||next.cells.some(c=>!raw.palette[c.color]))throw Error('试玩调色板无效');
  studioLevel=next;shuffleBase=pool.length?raw.data:null;shuffleVariants=pool;shuffleIndex=index;
  raw.palette.forEach((c,i)=>{COLORS[i]=c;NAMES[i]=`颜色${i+1}`;});if(pool.length)try{sessionStorage.setItem('color-clear.last-shuffle',String(index));}catch{/* optional recent-index memory */}
 }catch(error){studioError='制作关卡未加载：'+error.message;studioLevel=null;shuffleBase=null;shuffleVariants=[];shuffleIndex=-1;}
}
const fixtureMode=!!studioLevel||new URLSearchParams(location.search).get('fixture')==='rescue';
function levelFor(order) {
 if (studioLevel) return studioLevel;
 if (fixtureMode) return makeRescueFixture();
 if (order === 2) {
  shuffleIndex = chooseVariant(WIZARD_QUEUE_COUNT, shuffleIndex);
  return makeCampaignLevel(order, shuffleIndex);
 }
 return makeCampaignLevel(order);
}
let settings=normalizePresentation(pref('presentation',{})),rewardSession=null,reserveOpen=false;
let rescueOrder=Math.min(unlocked,normalizeRescueOrder(new URLSearchParams(location.search).get('level')));
const requestedTier = new URLSearchParams(location.search).get('difficulty');
function newRun(number) {
 const tier = studioLevel && ['warmup','planning','challenge'].includes(requestedTier)
  ? requestedTier : studioLevel ? 'warmup' : RESCUES[number-1].tier;
 return new ColorClearGame(levelFor(number), fixtureMode && !studioLevel ? undefined : tier);
}
let model=newRun(rescueOrder);
const orbit=new ModelOrbit(),openingSpin=new URLSearchParams(location.search).get('autospin')!=='0';orbit.reset(openingSpin);
let renderer,meshes=[],pieces=[],coreMarks=[],viewScale=9,frameId,drag=null,lastTime=performance.now(),uiStamp='',shownPhase='',comboUntil=0,bonusUntil=0,lastTone=0,audio,rotationVelocity=0,lastDragTime=0,rangeStamp='';
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

function buildModel(){
 if(!fixtureMode){
  const rescue=RESCUES[rescueOrder-1];
  rescue.palette.forEach((color,index)=>{COLORS[index]=color;NAMES[index]=rescue.colors[index];});
  domColors=COLORS.map(color=>new THREE.Color(color));
 }
 for(const m of meshes){root.remove(m);m.dispose();}meshes=[];pieces=[];
 for(const m of coreMarks){root.remove(m);m.geometry.dispose();m.material.dispose();}coreMarks=[];
 for(const shape of new Set(model.cells.map(c=>c.shape||'box'))){const cells=model.cells.filter(c=>(c.shape||'box')===shape),m=new THREE.InstancedMesh(shapeGeometries[shape],material,cells.length);m.frustumCulled=false;root.add(m);meshes.push(m);cells.forEach((c,index)=>pieces[c.id]={mesh:m,index});}
 for(const c of model.cells){
  pieces[c.id].mesh.setColorAt(pieces[c.id].index,cellDisplayColor(c,COLORS));
  if(c.core){const mark=new THREE.Mesh(new THREE.TorusGeometry(.20,.032,5,12),new THREE.MeshBasicMaterial({color:0xfff8d7}));mark.position.set(c.x,c.y,c.z+.49);mark.userData.id=c.id;root.add(mark);coreMarks.push(mark);}
 }
 // Every detail belongs to a removable cell, including in the collection thumbnail.
 for(const mark of createModelDetails(model.cells)){root.add(mark);coreMarks.push(mark);}
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
 campAudio.unlock();
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
function paintCapsule(node,color){const hex=COLORS[color];node.style.setProperty('--color',hex);const n=parseInt(hex.slice(1),16),luminance=((n>>16)*299+((n>>8)&255)*587+(n&255)*114)/1000;node.style.setProperty('--capsule-ink',luminance>175?'#354139':'#fff');}
function capsuleMarkup(c,hidden=false){return `<span class="symbol">${SYMBOLS[c.color]}</span><strong>${hidden?'?':c.ammo}</strong>`;}
function syncUI(force=false){
 const signature=JSON.stringify([model.slots,model.supply.map(c=>c.slice(0,4)),model.phase,model.remaining,muted,model.reserve,settings,orbit.automatic,...(model.slots.some(Boolean)?[model.yaw.toFixed(2),model.pitch.toFixed(2)]:[])]);
 if(!force&&signature===uiStamp)return;uiStamp=signature;
 applyPresentation();
 $('level-name').textContent=`第 ${String(rescueOrder).padStart(2,'0')} 关 · ${model.level.name}`;
 $('level-dots').textContent=Array.from({length:5},(_,i)=>i<(model.level.id-1)%5+1?'●':'○').join(' ');
 $('remaining').textContent=`剩余 ${model.remaining} 块`;$('percent').textContent=`${Math.round(model.progress*100)}%`;$('progress').style.width=model.progress*100+'%';
 const visibleColors=new Set(model.visibleTargets().map(c=>c.color));
 $('slot-count').textContent=`${model.slots.filter(Boolean).length} / ${model.slots.length}`;
 $('reserve-toggle').hidden=!model.reserve.length;$('reserve-toggle').textContent=`暂存 ${model.reserve.length}`;
 $('reserve-tray').hidden=!reserveOpen||!model.reserve.length;
 for(let i=0;i<model.reserve.length;i++){const c=model.reserve[i];let b=$('reserve-tray').children[i];if(!b){b=document.createElement('button');$('reserve-tray').append(b);}b.className='capsule';b.dataset.reserve=String(i);paintCapsule(b,c.color);if(b.dataset.content!==`${c.id}:${c.ammo}`){b.innerHTML=capsuleMarkup(c);b.dataset.content=`${c.id}:${c.ammo}`;}b.setAttribute('aria-label',`取回${NAMES[c.color]}，${c.ammo}发`);b.onclick=()=>{ensureAudio();if(model.takeReserve(i)){syncUI(true);processEvents();}};}
 while($('reserve-tray').children.length>model.reserve.length)$('reserve-tray').lastElementChild.remove();
 for(let i=0;i<6;i++){
  const c=model.slots[i];let slot=$('slots').children[i];
  if(!slot){slot=document.createElement('div');slot.dataset.slot=String(i);$('slots').append(slot);}
  if(i>=model.slots.length){slot.className='slot locked';let b=slot.querySelector('.unlock-slot');if(!b){b=document.createElement('button');b.className='unlock-slot';b.dataset.unlock=String(i);b.innerHTML='▣<small>视频解锁</small>';b.setAttribute('aria-label',`模拟广告解锁第${i+1}槽`);b.onclick=()=>requestReward('slot');slot.replaceChildren(b);}b.disabled=i!==model.slots.length;continue;}
  slot.className='slot'+(c?' occupied':'');
  if(c){let item=slot.querySelector('.capsule');if(!item||item.dataset.id!==String(c.id)){item=document.createElement('div');item.dataset.id=String(c.id);slot.replaceChildren(item);}item.className='capsule'+(!visibleColors.has(c.color)?' waiting':'');paintCapsule(item,c.color);item.innerHTML=capsuleMarkup(c);item.setAttribute('aria-label',`${NAMES[c.color]}剩余${c.ammo}发`);}else slot.replaceChildren();
 }
 for(let row=0;row<4;row++)for(let col=0;col<4;col++){
  const c=model.supply[col][row];
  const previous=$('supply').children[row*4+col];
  if(!c){if(!previous?.classList.contains('empty-supply')){const blank=document.createElement('div');blank.className='empty-supply'+(row?' preview-card':'');blank.textContent='·';if(previous)previous.replaceWith(blank);else $('supply').append(blank);}continue;}
  let b=previous;if(!b||b.tagName!=='BUTTON'){b=document.createElement('button');if(previous)previous.replaceWith(b);else $('supply').append(b);}
  const hidden = model.isAmmoHidden(col, row);
  b.className='capsule'+(row?' preview-card':'')+(hidden?' mystery-card':'');
  paintCapsule(b,c.color);
  const content = c.id+':'+(hidden?'?':c.ammo);
  if(b.dataset.content!==content){b.innerHTML=capsuleMarkup(c,hidden);b.dataset.content=content;}
  b.disabled=row>0;
  b.setAttribute('aria-label',(row?'预览':'选择')+NAMES[c.color]+'，'+(hidden?'弹量升到第二行揭晓':c.ammo+'发'));
  if(!row){b.dataset.column=String(col);b.onclick=()=>{
   ensureAudio();const origin=b.getBoundingClientRect(),slotIndex=model.slots.indexOf(null);
   if(!model.select(col)){toast('发射槽已满，先转动模型消除一些');return;}
   syncUI(true);const arrival=$('slots').children[slotIndex]?.querySelector('.capsule');
   if(arrival&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const target=arrival.getBoundingClientRect();arrival.style.zIndex='4';arrival.animate([{transform:`translate(${origin.x+origin.width/2-target.x-target.width/2}px,${origin.y+origin.height/2-target.y-target.height/2}px) scale(1.1)`},{transform:'translate(0,0) scale(1)'}],{duration:190,easing:'cubic-bezier(.2,.7,.25,1)'});}
   processEvents();
  };}
 }
 const active=model.slots.filter(Boolean),waiting=active.length&&!active.some(c=>visibleColors.has(c.color));
 $('status').textContent=waiting?'↔ 转一转，寻找同色积木':active.length?'同色消除中…':'选一颗，让颜色动起来';
 $('core-tip').textContent='● 一发一块，同色弹药与积木对应';
 $('sound').textContent=muted?'♪̸':'♫';$('dialog-music').textContent='音乐：'+(audioPrefs.music?'开':'关');$('use-reorder').textContent='⇄ '+campState.reorderTokens;$('dialog-sound').textContent=`音效：${muted?'关':'开'}`;$('dialog-haptic').textContent=`振动：${haptic?'开':'关'}`;
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
  if(e.type==='bonus'){
   bonusUntil=performance.now()+1150;
   burst(e.cell,true);
   tone(785,.14,.05);
   tone(1047,.17,.045,.08);
   if(model.rescueTier==='challenge'&&model.bonusCount===1)toast('已获得一次应急暂存，满槽卡住时可用');
  }
  if(e.type==='chain'){ $('combo').textContent='漂亮命中 ✧'; $('world').dataset.chainEvents=String(Number($('world').dataset.chainEvents||0)+1); }
  if(e.type==='won'){campAudio.setActive(false);}
  if(e.type==='won'&&!fixtureMode){albumUI.record(model.level.id);unlocked=Math.max(unlocked,Math.min(RESCUE_COUNT,rescueOrder+1));save(CAMPAIGN_PROGRESS_KEY,unlocked);}
 }
 if(changed)syncBlocks();
}
function openDialog(mode='phase'){
 $('overlay').hidden=false;
 const won=model.phase==='won',lost=model.phase==='lost';
 $('emergency-reserve').hidden=!model.canUseEmergencyReserve;
 $('dialog-symbol').classList.toggle('rescued-duck',won);
 $('dialog-symbol').textContent=won?'🦆':lost?'↻':'Ⅱ';$('dialog-kicker').textContent=won?'RESCUE COMPLETE':lost?'TRY A DIFFERENT ORDER':'TAKE YOUR TIME';
 $('dialog-title').textContent=mode==='help'?'两种操作，就会玩':won?'安全抵达！':lost?'差一点，换个顺序':'休息一下';
 $('dialog-text').textContent=mode==='help'?`${model.rescueTier==='challenge'?'多面挑战':'轻松上手'}：点前排胶囊进入发射槽，自动消除同色积木。上下左右拖动寻找目标。${model.rescueTier!=='challenge'?'同色弹药与积木数相等，每发清除一块。':'每发清除一块；注意留槽位给能打开外层的颜色。'}`:won?`清除了 ${model.cells.length} 块积木，用了 ${model.shots} 发。${!fixtureMode&&rescueOrder===RESCUE_COUNT?'两次救援完成，可以在图鉴查看鸭鸭。':'封印解开了，伙伴已安全抵达营地。'}`:lost?model.reason:'颜色不会偷偷溜走，准备好了再继续。';
 if(mode==='help'&&model.rescueTier){
  $('dialog-text').textContent += ' 同色连续消掉 5 块触发奖励。';
  if(model.rescueTier!=='warmup')$('dialog-text').textContent += ' 问号胶囊升到第二行才揭晓弹量。';
  if(model.rescueTier==='challenge')$('dialog-text').textContent += ' 攒到一次奖励后，符合条件的满槽死局可暂存最左一颗胶囊，每局一次。';
 }
 if(won&&model.bonusCount)$('dialog-text').textContent+=' 同色奖励 × '+model.bonusCount+'。';
 $('primary').textContent=studioLevel&&won?'再玩这关':lost&&model.canContinue?'模拟广告 · 暂存续关':won?(fixtureMode||rescueOrder===RESCUE_COUNT?'再玩这关':'下一关 →'):lost?'换个顺序再试':'继续游戏';
 $('primary').onclick=()=>{ensureAudio();if(won)loadLevel(fixtureMode?rescueOrder:Math.min(RESCUE_COUNT,rescueOrder+1));else if(lost){if(model.canContinue)requestReward('continue');else loadLevel(rescueOrder);}else{model.resume();campAudio.setActive(true);$('overlay').hidden=true;shownPhase='playing';lastTime=performance.now();}};
}
function pause(){campAudio.setActive(false);if(drag)orbit.release(true,0);drag=null;rotationVelocity=0;if(model.phase==='playing'){model.pause();shownPhase='paused';openDialog();syncUI(true);}}
function loadLevel(n){campAudio.setActive(true);if(shuffleVariants.length){try{const index=chooseVariant(shuffleVariants.length,shuffleIndex);const next=decodeLevel(variantData(shuffleBase,shuffleVariants[index]));studioLevel=next;shuffleIndex=index;try{sessionStorage.setItem('color-clear.last-shuffle',String(index));}catch{/* optional recent-index memory */}}catch{toast('随机队列未通过校验，保留当前排列');}}if(rewardSession){rewardSession.owner.resolveReward(rewardSession.ticket,false);rewardSession=null;}$('reward-overlay').hidden=true;reserveOpen=false;drag=null;rotationVelocity=0;rescueOrder=normalizeRescueOrder(n);model=newRun(rescueOrder);orbit.reset(openingSpin);shownPhase='playing';uiStamp='';comboUntil=0;bonusUntil=0;$('combo').classList.remove('show');$('overlay').hidden=true;buildModel();syncUI(true);lastTime=performance.now();}
$('emergency-reserve').onclick=()=>{
 ensureAudio();
 if(!model.useEmergencyReserve())return;
 reserveOpen=true;
 $('overlay').hidden=true;
 shownPhase='playing';
 lastTime=performance.now();
 syncUI(true);
 toast('已腾出一槽，剩余弹药保存在暂存区');
};
$('pause').onclick=()=>{ensureAudio();pause();};$('restart').onclick=()=>{ensureAudio();loadLevel(rescueOrder);};
function toggleSound(){muted=!muted;audioPrefs.setEffects(!muted);campAudio.sync();if(!muted){ensureAudio();tone();}syncUI(true);}
$('dialog-music').onclick=()=>{audioPrefs.setMusic(!audioPrefs.music);ensureAudio();campAudio.sync();syncUI(true);};
$('sound').onclick=toggleSound;$('dialog-sound').onclick=toggleSound;
$('dialog-haptic').onclick=()=>{haptic=!haptic;save('haptic',haptic);syncUI(true);vibrate();};
$('help').onclick=()=>{pause();openDialog('help');};
$('level-select').onclick=()=>{
 $('dialog-title').textContent='选择一份颜色';$('dialog-text').textContent=`已解锁 ${unlocked} / ${RESCUE_COUNT} 关`;
 const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin:14px 0';
 for(let i=1;i<=RESCUE_COUNT;i++){const b=document.createElement('button');b.textContent=RESCUES[i-1].name;b.disabled=i>unlocked;b.style.cssText=`padding:10px 0;background:${i<=unlocked?'#deedda':'#eff0e9'};opacity:${i<=unlocked?1:.4}`;b.onclick=()=>loadLevel(i);grid.append(b);}
 $('dialog-text').append(grid);
};
$('stage').addEventListener('pointerdown',e=>{if(model.phase!=='playing'||drag)return;ensureAudio();drag={id:e.pointerId,x:e.clientX,y:e.clientY};rotationVelocity=0;orbit.beginDrag();lastDragTime=performance.now();$('stage').setPointerCapture(e.pointerId);});
$('stage').addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const now=performance.now();orbit.drag(model,e.clientX-drag.x,e.clientY-drag.y,(now-lastDragTime)/1000);lastDragTime=now;drag.x=e.clientX;drag.y=e.clientY;root.rotation.set(model.pitch,model.yaw,0,'XYZ');syncUI(true);});
function endDrag(e){if(drag?.id===e.pointerId){orbit.release(e.type!=='pointerup',(performance.now()-lastDragTime)/1000);drag=null;if($('stage').hasPointerCapture(e.pointerId))$('stage').releasePointerCapture(e.pointerId);}}
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('stage').addEventListener(event,endDrag);
window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('keydown',e=>{if(document.querySelector('.model-inspector'))return;if(e.key==='Escape'){if(albumUI.isOpen){albumUI.close();return;}if(rewardSession){finishReward(false);return;}if(model.phase==='paused')$('primary').click();else pause();}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){orbit.beginDrag();model.rotate(e.key==='ArrowLeft'?-.15:e.key==='ArrowRight'?.15:0,e.key==='ArrowUp'?.15:e.key==='ArrowDown'?-.15:0);orbit.release(true,0);syncUI(true);}});
$('world').addEventListener('webglcontextlost',e=>{e.preventDefault();pause();toast('3D画面暂时中断，请刷新页面恢复');});
function frame(time){
 const elapsed=Math.max(0,(time-lastTime)/1000),dt=Math.min(.04,elapsed);lastTime=time;
 orbit.step(model,elapsed,!!drag);
 model.tick(dt);root.rotation.set(model.pitch,model.yaw,0,'XYZ');processEvents();syncUI();
 if(model.phase!==shownPhase){shownPhase=model.phase;if(!rewardSession&&(model.phase==='won'||model.phase==='lost'))openDialog();}
 const shell=document.querySelector('.game-shell').getBoundingClientRect(),stageRect=$('stage').getBoundingClientRect();$('projectiles').setAttribute('viewBox',`0 0 ${shell.width} ${shell.height}`);
 for(let i=bullets.length-1;i>=0;i--){const b=bullets[i],flight=model.flights.find(f=>f.id===b.id);if(!flight){b.path.remove();b.ball.remove();bullets.splice(i,1);continue;}const point=positionOf(b.cell).project(camera),end={x:stageRect.x-shell.x+(point.x+1)*stageRect.width/2,y:stageRect.y-shell.y+(1-point.y)*stageRect.height/2};const t=Math.max(0,Math.min(1,1-flight.time/(flight.duration??FLIGHT_SECONDS))),control={x:(b.start.x+end.x)/2,y:Math.min(b.start.y,end.y)-24};
  b.path.setAttribute('d',`M${b.start.x},${b.start.y} Q${control.x},${control.y} ${end.x},${end.y}`);b.ball.setAttribute('cx',String((1-t)**2*b.start.x+2*(1-t)*t*control.x+t*t*end.x));b.ball.setAttribute('cy',String((1-t)**2*b.start.y+2*(1-t)*t*control.y+t*t*end.y));
 }
 particles=particles.filter(p=>p.age<p.life);
 for(let i=0;i<particles.length;i++){const p=particles[i];p.age+=dt;p.v.y-=14*dt;p.p.addScaledVector(p.v,dt);dummy.position.copy(p.p);dummy.rotation.set(p.age*6,p.spin+p.age*5,p.age*3);dummy.scale.setScalar(Math.max(0,1-p.age/p.life)*1.6);dummy.updateMatrix();particleMesh.setMatrixAt(i,dummy.matrix);particleMesh.setColorAt(i,domColors[p.color]);}
 particleMesh.count=particles.length;particleMesh.instanceMatrix.needsUpdate=true;if(particleMesh.instanceColor)particleMesh.instanceColor.needsUpdate=true;
 if(time<bonusUntil){
  $('combo').textContent='✦ 同色 5 连消！';
  $('combo').classList.add('show','bonus');
 }else{
 $('combo').classList.remove('bonus');
 if(time<comboUntil&&model.combo>=3){if(!$('combo').textContent.startsWith('连锁')||model.combo%7===0)$('combo').textContent=`消除 × ${model.combo}`;$('combo').classList.add('show');}else{$('combo').classList.remove('show');$('combo').textContent='';}}
 const stamp=model.remaining+':'+model.yaw.toFixed(3)+':'+model.pitch.toFixed(3);
 if(stamp!==rangeStamp){
  rangeStamp=stamp;const affected=new Set();
  for(const core of model.visibleTargets().filter(c=>c.core))for(const c of model.chainPreview(core.id))affected.add(c.id);
  const positions=[];for(const id of affected){const c=model.cells.find(cell=>cell.id===id);if(!c)continue;for(let i=0;i<edgePositions.count;i++)positions.push(edgePositions.getX(i)+c.x,edgePositions.getY(i)+c.y,edgePositions.getZ(i)+c.z);}
  rangeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));rangeGeometry.computeBoundingSphere();rangeLines.visible=positions.length>0; $('world').dataset.maxChainRange=String(Math.max(Number($('world').dataset.maxChainRange||0),affected.size));
 }
 renderer.render(scene,camera);frameId=requestAnimationFrame(frame);
}
window.__colorClear={snapshot:()=>({rescueTier:model.rescueTier,bonusCount:model.bonusCount,visibleColors:[...new Set(model.visibleTargets().map(c=>c.color))],frontColors:model.supply.map(q=>q[0]?.color??null),pacing:model.level.pacing??'legacy',pace:levelEliminationPace(model.level,model.remaining,model.cells.length),shuffleIndex,flightClocks:model.flights.map(f=>({time:f.time,duration:f.duration})),level:model.level.id,rescueOrder,phase:model.phase,remaining:model.remaining,shots:model.shots,yaw:model.yaw,pitch:model.pitch,automatic:orbit.automatic,autoEnabled:orbit.enabled,slots:model.slots.map(s=>s?{...s}:null),supply:model.supply.map(c=>c.length),reason:model.reason,reserve:model.reserve.map(c=>({...c})),flights:model.flights.length,shapes:[...new Set(model.cells.map(c=>c.shape||'box'))]})};
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frameId);audio?.suspend();campAudio.setActive(false);});
window.addEventListener('pageshow',e=>{if(e.persisted){lastTime=performance.now();frameId=requestAnimationFrame(frame);}});

function applyPresentation(){
 if($('auto-rotate'))$('auto-rotate').textContent=`自动旋转：${orbit.enabled?'开':'关'}`;
 document.querySelector('.game-shell').classList.toggle('minimal-copy',!settings.labels);
 document.querySelector('.progress-track').hidden=!settings.progress;$('remaining').hidden=!settings.remaining;$('percent').hidden=!settings.progress;document.querySelector('.background-art').hidden=!settings.background;
 document.querySelector('.heading h1').textContent=studioLevel?`制作试玩 · ${model.level.name}`:settings.labels?'鸭鸭脱困':`第 ${String(rescueOrder).padStart(2,'0')} 关 · ${model.level.name}`;
 for(const b of document.querySelectorAll('[data-display]')){const key=b.dataset.display,names={progress:'进度条',remaining:'剩余块数',labels:'说明文字',background:'背景'};b.textContent=`${names[key]}：${settings[key]?'开':'关'}`;b.setAttribute('aria-pressed',String(settings[key]));}
}
$('auto-rotate').onclick=()=>{orbit.reset(!orbit.enabled);syncUI(true);};
for(const b of document.querySelectorAll('[data-display]'))b.onclick=()=>{settings[b.dataset.display]=!settings[b.dataset.display];save('presentation',settings);syncUI(true);};
$('reserve-toggle').onclick=()=>{reserveOpen=!reserveOpen;syncUI(true);};
function requestReward(kind){
 ensureAudio();const owner=model,ticket=owner.beginReward(kind);if(!ticket){toast(kind==='slot'?'本局槽位已全部解锁':'本局无法再次续关');return;}
 rotationVelocity=0;if(drag)orbit.release(true,0);drag=null;rewardSession={owner,ticket};$('reward-title').textContent=kind==='slot'?`解锁第 ${model.slots.length+1} 个槽位`:'暂存胶囊，继续这一局';$('reward-overlay').hidden=false;syncUI(true);
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
 const miniature=new THREE.Scene(),group=new THREE.Group(),{level,palette}=campaignModel(id);miniature.add(group);group.rotation.set(.28,.55,0);
 miniature.add(new THREE.HemisphereLight(0xfffff5,0x697f78,1.25));const lamp=new THREE.DirectionalLight(0xfff5df,2.5);lamp.position.set(-6,11,10);miniature.add(lamp);
 const parts=[];for(const shape of new Set(level.cells.map(c=>c.shape||'box'))){const cells=level.cells.filter(c=>(c.shape||'box')===shape),m=new THREE.InstancedMesh(shapeGeometries[shape],material,cells.length);m.frustumCulled=false;cells.forEach((c,i)=>{dummy.position.set(c.x,c.y,c.z);dummy.scale.setScalar(1);dummy.rotation.set(0,0,0);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);m.setColorAt(i,cellDisplayColor(c,palette));});parts.push(m);group.add(m);}
 const details=createModelDetails(level.cells);details.forEach(p=>group.add(p));
 const extent=new THREE.Box3().setFromObject(group),centre=extent.getCenter(new THREE.Vector3()),size=extent.getSize(new THREE.Vector3());group.position.sub(centre);const half=Math.max(size.x,size.y)*.6,cam=new THREE.OrthographicCamera(-half,half,half,-half,.1,100);cam.position.set(0,0,25);cam.lookAt(0,0,0);thumbnailRenderer.render(miniature,cam);const image=thumbnailRenderer.domElement.toDataURL('image/png');parts.forEach(p=>p.dispose());details.forEach(p=>{p.geometry.dispose();p.material.dispose();});thumbnailCache.set(id,image);return image;
}
const albumUI=createAlbumUI({fixtureMode,thumbnail:modelThumbnail,toast,inspect:id=>{const {level,palette}=campaignModel(id);openModelInspector(level,palette);},pause(){
 campAudio.setActive(false);
 const playing=model.phase==='playing',overlayWasHidden=$('overlay').hidden;if(playing)model.pause();if(drag)orbit.release(true,0);drag=null;rotationVelocity=0;$('overlay').hidden=true;
 return()=>{if(playing&&model.phase==='paused'){model.resume();shownPhase='playing';}else $('overlay').hidden=overlayWasHidden;campAudio.setActive(model.phase==='playing');lastTime=performance.now();};
}});
buildModel();syncUI(true);shownPhase='playing';if(studioError)toast(studioError);if(studioLevel){$('level-select').hidden=true;$('album-button').hidden=true;}frameId=requestAnimationFrame(frame);

$('use-reorder').onclick=()=>{ensureAudio();const result=campState.useReorder(()=>reorderRemainingSupply(model));toast(result.ok?'剩余队列已重排，消除进度保留':campState.reorderTokens?'暂时没有可重排的队列':'先回营地领取每日补给');syncUI(true);};
let campPaused=false;
$('camp-home').onclick=$('dialog-camp-home').onclick=()=>{if(window.parent!==window){window.parent.postMessage({type:'camp:return'},location.origin);}else location.href='./duck-camp.html';};
window.addEventListener('message',e=>{if(e.source!==window.parent||e.origin!==location.origin)return;if(e.data?.type==='camp:hide'){campPaused=model.phase==='playing';pause();}if(e.data?.type==='camp:show'){if(campPaused&&model.phase==='paused'){model.resume();$('overlay').hidden=true;shownPhase='playing';}campPaused=false;audioPrefs.refresh();albumUI.refresh();muted=!audioPrefs.effects;campAudio.setActive(model.phase==='playing');syncUI(true);lastTime=performance.now();}});
window.addEventListener('storage',()=>{albumUI.refresh();audioPrefs.refresh();muted=!audioPrefs.effects;campAudio.sync();syncUI(true);});
