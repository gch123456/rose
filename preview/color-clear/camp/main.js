import {CampState,AudioPreferences} from '../camp-state.js';
import {CampAudio} from '../camp-audio.js';
import {createAlbumUI,albumMarkup} from '../album.js';
import {makeLevel,LEVEL_COUNT} from '../../../assets/scripts/color-clear/ColorClearLevels.ts';
import {openModelInspector,renderModelThumbnail} from '../model-inspector.js';
const $=id=>document.getElementById(id),storage={getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)},camp=new CampState(storage),preferences=new AudioPreferences(storage),audio=new CampAudio(preferences);
$('manual-root').innerHTML=albumMarkup();
let playing=false,loaded=false,visible=true,toastTimer,settingsFocus,dailyFocus;
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2200);}
const album=createAlbumUI({fixtureMode:false,toast,thumbnail:id=>thumbnail(id),inspect:id=>openModelInspector(makeLevel(id)),pause(){return()=>{};}});
const thumbCache=new Map();function thumbnail(id){if(!thumbCache.has(id))thumbCache.set(id,renderModelThumbnail(makeLevel(id)));return thumbCache.get(id);}
function sync(){const daily=camp.daily();$('daily-dot').hidden=!daily.canClaim;$('claim-daily').disabled=!daily.canClaim;$('claim-daily').textContent=daily.claimed?'今日补给已领取':'收下补给';$('daily-status').textContent='重排库存 '+daily.reorderTokens+' · '+(daily.persistent?'仅此设备保存':'当前浏览会话保存');$('music-toggle').setAttribute('aria-checked',String(preferences.music));$('effects-toggle').setAttribute('aria-checked',String(preferences.effects));let unlocked=1;try{unlocked=Math.min(LEVEL_COUNT,Math.max(1,Number(JSON.parse(localStorage.getItem('color-clear.unlocked')))||1));}catch{}$('mission-title').textContent='第 '+String(unlocked).padStart(2,'0')+' 次 · '+makeLevel(unlocked).name;return unlocked;}
function daily(){dailyFocus=document.activeElement;sync();$('daily-overlay').hidden=false;$('daily-close').focus();}
function closeDaily(){$('daily-overlay').hidden=true;dailyFocus?.focus();}
$('daily-open').onclick=daily;$('daily-close').onclick=closeDaily;
$('claim-daily').onclick=()=>{audio.unlock();const result=camp.claimDaily();sync();if(result.ok){audio.play(660,.15);toast('补给已装入：随机重排 ×1');}else toast('今日补给已经领取');};
$('camp-settings').onclick=()=>{settingsFocus=document.activeElement;sync();$('settings-overlay').hidden=false;$('settings-close').focus();};
$('settings-close').onclick=()=>{$('settings-overlay').hidden=true;settingsFocus?.focus();};
$('music-toggle').onclick=()=>{preferences.setMusic(!preferences.music);audio.unlock();audio.sync();sync();};
$('effects-toggle').onclick=()=>{preferences.setEffects(!preferences.effects);audio.unlock();audio.sync();audio.play(660);sync();};
function send(type){$('game-frame').contentWindow?.postMessage({type},location.origin);}
function showGame(url){audio.unlock();audio.setActive(false);$('camp-view').hidden=true;$('game-view').hidden=false;visible=false;if(url){$('game-frame').src=url;loaded=true;}else send('camp:show');$('loading-back').hidden=true;playing=true;}
function home(){preferences.refresh();album.refresh();send('camp:hide');$('game-view').hidden=true;$('camp-view').hidden=false;visible=true;$('resume-rescue').hidden=!loaded;$('start-rescue').textContent=loaded?'继续救援 →':'出发救鸭 →';audio.setActive(!document.hidden);sync();}
$('start-rescue').onclick=()=>{if(loaded)showGame();else showGame('./color-clear.html?camp=1&level='+sync());};
$('resume-rescue').onclick=()=>showGame();$('camp-tab').onclick=home;$('loading-back').onclick=home;

window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==$('game-frame').contentWindow)return;if(e.data?.type==='camp:return')home();});
window.addEventListener('storage',()=>{album.refresh();preferences.refresh();sync();audio.sync();});
document.addEventListener('visibilitychange',()=>audio.setActive(visible&&!document.hidden));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('.model-inspector')){if(!$('daily-overlay').hidden)closeDaily();else if(!$('settings-overlay').hidden)$('settings-close').click();else if(album.isOpen)album.close();}});
window.addEventListener('pagehide',()=>audio.setActive(false));
sync();if(camp.markDailySeen())daily();
window.__rescueCamp={snapshot:()=>({daily:camp.daily(),audio:preferences.snapshot(),loaded,playing,visible})};
