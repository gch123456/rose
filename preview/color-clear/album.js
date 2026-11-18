import {AlbumService} from '../../assets/scripts/color-clear/ColorClearAlbum.ts';
import {RESCUES, RESCUE_COUNT} from './campaign.js';
export function albumMarkup(){return `<div id="album-overlay" class="overlay album-overlay" hidden><section class="album-dialog" role="dialog" aria-modal="true" aria-labelledby="album-title"><div class="album-heading"><div><h2 id="album-title">救援图鉴</h2></div><button id="album-close" aria-label="关闭救援图鉴">×</button></div><p id="album-mode"></p><div class="album-account"><button id="album-login">微信登录</button><button id="album-logout" hidden>退出登录</button><span id="album-count"></span></div><p id="album-sync"></p><div id="album-grid"></div></section></div>`;}
export function createAlbumUI({pause=()=>()=>{},thumbnail,toast=()=>{},fixtureMode=false,inspect}){
 const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)};
 const $=id=>document.getElementById(id),service=new AlbumService(storage,(path,init)=>fetch(path,init));let restore=null,busy=false;
 function status(){const logged=service.authenticated;$('album-mode').textContent=logged?'微信用户 · 云端图册':'访客 · 仅保存在这台设备';$('album-sync').textContent=logged?(service.book.pending.length?`${service.book.pending.length} 个成就待同步`:'已同步'):'微信登录后可合并并跨设备同步';$('album-login').hidden=logged;$('album-logout').hidden=!logged;const count=service.book.entries.filter(entry=>RESCUES.some(rescue=>rescue.id===entry.levelId)).length;$('album-count').textContent=`已救援 ${count} / ${RESCUE_COUNT}`;if($('album-button'))$('album-button').textContent=`图鉴 ${count}/${RESCUE_COUNT}`;}
 function render(){
  status();const owned=new Map(service.book.entries.map(e=>[e.levelId,e]));
  const cards=RESCUES.map(({id,name},index)=>{
   const entry=owned.get(id);
   const card=document.createElement(entry&&inspect?'button':'article');
   if(card.tagName==='BUTTON')card.type='button';
   card.className='album-card'+(entry?' collected':' locked');
   card.dataset.model=String(id);
   const image=document.createElement('div');
   image.className='album-picture';
   if(entry){
    const img=document.createElement('img');
    img.alt=name;
    image.append(img);
    requestAnimationFrame(()=>{
     if(!img.isConnected)return;
     try{img.src=thumbnail(id);}catch{img.replaceWith(document.createTextNode('✧'));}
    });
    if(inspect){
     card.setAttribute('aria-label','查看'+name+'立体模型');
     card.onclick=()=>inspect(id);
    }
   }else{
    const mark=document.createElement('span');
    mark.className='locked-mark';
    mark.textContent='?';
    image.append(mark);
   }
   const number=document.createElement('span');
   number.className='manual-number';
   number.textContent=String(index+1).padStart(2,'0');
   const title=document.createElement('strong');
   title.textContent=name;
   const note=document.createElement('small');
   note.textContent=entry?'已救援':'完成第 '+(index+1)+' 关解锁';
   card.append(number,image,title,note);
   return card;
  });
  $('album-grid').replaceChildren(...cards);
 }
 async function synchronize(){if(!service.authenticated)return;try{await service.synchronize();}catch(error){$('album-sync').textContent=error.message+'；本机记录已保留';return;}render();}
 function refresh(){service.refresh();if(restore)render();else status();}
 function open(){service.refresh();if(restore){render();return;}restore=pause()||(()=>{});$('album-overlay').hidden=false;render();void synchronize();}
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
 return {service,open,close,refresh,get isOpen(){return !!restore;},record(levelId){if(fixtureMode)return;service.refresh();const fresh=service.book.unlock(levelId);status();if(fresh)toast('安全抵达：'+(RESCUES.find(rescue=>rescue.id===levelId)?.name??'鸭鸭'));void synchronize();}};
}
