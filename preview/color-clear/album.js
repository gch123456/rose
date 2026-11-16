import {AlbumService} from '../../assets/scripts/color-clear/ColorClearAlbum.ts';
import {makeLevel,LEVEL_COUNT} from '../../assets/scripts/color-clear/ColorClearLevels.ts';
export function createAlbumUI({pause,thumbnail,toast,fixtureMode}){
 const storage={getItem:key=>{try{return localStorage.getItem(key);}catch{return null;}},setItem:(key,value)=>{try{localStorage.setItem(key,value);}catch{}},removeItem:key=>{try{localStorage.removeItem(key);}catch{}}};
 const $=id=>document.getElementById(id),service=new AlbumService(storage,(path,init)=>fetch(path,init));let restore=null,busy=false;
 const names=Array.from({length:LEVEL_COUNT},(_,i)=>makeLevel(i+1).name);
 function status(){const logged=service.authenticated;$('album-mode').textContent=logged?'微信用户 · 云端图册':'访客 · 仅保存在这台设备';$('album-sync').textContent=logged?(service.book.pending.length?`${service.book.pending.length} 个成就待同步`:'已同步'):'微信登录后可合并并跨设备同步';$('album-login').hidden=logged;$('album-logout').hidden=!logged;$('album-count').textContent=`已收集 ${service.book.entries.length} / ${LEVEL_COUNT}`;$('album-button').textContent=`图册 ${service.book.entries.length}/${LEVEL_COUNT}`;}
 function render(){
  status();const owned=new Map(service.book.entries.map(e=>[e.levelId,e]));
  $('album-grid').replaceChildren(...names.map((name,i)=>{const entry=owned.get(i+1),card=document.createElement('div');card.className='album-card'+(entry?' collected':'');card.dataset.model=String(i+1);const image=document.createElement('div');image.className='album-picture';
   if(entry){const img=document.createElement('img');img.alt=name;image.append(img);requestAnimationFrame(()=>{if(!img.isConnected)return;try{img.src=thumbnail(i+1);}catch{image.textContent='✧';}});}else image.textContent='◇';
   const title=document.createElement('strong');title.textContent=entry?name:`第 ${i+1} 份收藏`;const note=document.createElement('small');note.textContent=entry?new Date(entry.unlockedAt).toLocaleDateString('zh-CN')+' 已收集':'通关后点亮';card.append(image,title,note);return card;}));
 }
 async function synchronize(){if(!service.authenticated)return;try{await service.synchronize();}catch(error){$('album-sync').textContent=error.message+'；本机记录已保留';return;}render();}
 function open(){if(restore)return;restore=pause();$('album-overlay').hidden=false;render();void synchronize();}
 function close(){$('album-overlay').hidden=true;if(restore){const resume=restore;restore=null;resume();}}
 for(const b of document.querySelectorAll('[data-open-album]'))b.onclick=open;$('album-close').onclick=close;
 $('album-login').onclick=async()=>{
  if(busy)return;if(!globalThis.wx?.login){toast('请在微信小游戏中登录，浏览器可先使用访客图册');return;}
  busy=true;$('album-login').disabled=true;$('album-sync').textContent='正在微信登录…';
  try{await service.login(()=>new Promise((resolve,reject)=>globalThis.wx.login({success:r=>r.code?resolve(r.code):reject(new Error('未取得微信登录凭证')),fail:()=>reject(new Error('微信登录暂时不可用'))})));render();}
  catch(error){status();$('album-sync').textContent=error.message;toast(error.message);}finally{busy=false;$('album-login').disabled=false;}
 };
 $('album-logout').onclick=async()=>{if(busy)return;busy=true;try{await service.logout();}catch{toast('本机已退出，服务器会话将在到期后失效');}finally{busy=false;render();}};
 status();
 return {service,open,close,get isOpen(){return !!restore;},record(levelId){if(fixtureMode)return;const fresh=service.book.unlock(levelId);status();if(fresh)toast('图册新增：'+names[levelId-1]);void synchronize();}};
}
