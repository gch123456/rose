// Local guest prototype only: device dates/storage are not server validation.
export const CAMP_STORAGE_KEY='color-clear.camp.v1';
export const AUDIO_STORAGE_KEY='color-clear.audio.v1';
const localDay=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&localDay(new Date(Number(value.slice(0,4)),Number(value.slice(5,7))-1,Number(value.slice(8,10))))===value;
const fresh=()=>({version:1,seenDay:null,lastClaimDay:null,reorderTokens:0});
function decode(raw){
 if(!raw||raw.version!==1||!Number.isSafeInteger(raw.reorderTokens)||raw.reorderTokens<0||raw.reorderTokens>10000)return fresh();
 if((raw.seenDay!=null&&!validDay(raw.seenDay))||(raw.lastClaimDay!=null&&!validDay(raw.lastClaimDay)))return fresh();
 return {version:1,seenDay:raw.seenDay??null,lastClaimDay:raw.lastClaimDay??null,reorderTokens:raw.reorderTokens};
}
export class CampState{
 constructor(storage,now=()=>new Date()){this.storage=storage;this.now=now;this.state=fresh();this.persistent=true;this.refresh();}
 refresh(){if(!this.persistent)return;let value;try{value=this.storage.getItem(CAMP_STORAGE_KEY);}catch{this.persistent=false;return;}try{this.state=decode(JSON.parse(value||'null'));}catch{this.state=fresh();}}
 save(){try{this.storage.setItem(CAMP_STORAGE_KEY,JSON.stringify(this.state));}catch{this.persistent=false;}}
 daily(){this.refresh();const day=localDay(new Date(this.now())),claimed=!!this.state.lastClaimDay&&day<=this.state.lastClaimDay;return {day,seen:!!this.state.seenDay&&day<=this.state.seenDay,claimed,canClaim:!claimed,reorderTokens:this.state.reorderTokens,localOnly:true,persistent:this.persistent};}
 get reorderTokens(){this.refresh();return this.state.reorderTokens;}
 markDailySeen(){const daily=this.daily();if(daily.seen)return false;this.state.seenDay=daily.day;this.save();return true;}
 claimDaily(){const daily=this.daily();if(!daily.canClaim)return {ok:false,reason:'already-claimed',reorderTokens:this.state.reorderTokens};this.state.lastClaimDay=daily.day;this.state.seenDay=daily.day;this.state.reorderTokens++;this.save();return {ok:true,reorderTokens:this.state.reorderTokens};}
 useReorder(perform){this.refresh();if(this.state.reorderTokens<1)return {ok:false,reason:'empty',reorderTokens:0};if(perform()!==true)return {ok:false,reason:'not-reordered',reorderTokens:this.state.reorderTokens};this.state.reorderTokens--;this.save();return {ok:true,reorderTokens:this.state.reorderTokens};}
}
export class AudioPreferences{
 constructor(storage){this.storage=storage;this.values={music:true,effects:true};this.persistent=true;this.refresh();}
 refresh(){
  if(!this.persistent)return this.snapshot();
  let saved;try{saved=this.storage.getItem(AUDIO_STORAGE_KEY);}catch{this.persistent=false;return this.snapshot();}
  this.values={music:true,effects:true};
  try{const raw=JSON.parse(saved||'null');if(raw?.version===1)for(const key of ['music','effects'])if(typeof raw[key]==='boolean')this.values[key]=raw[key];}catch{}
  return this.snapshot();
 }
 get music(){return this.values.music;}
 get effects(){return this.values.effects;}
 snapshot(){return {...this.values};}
 setMusic(value){return this.set('music',value);}
 setEffects(value){return this.set('effects',value);}
 set(key,value){this.refresh();this.values[key]=Boolean(value);try{this.storage.setItem(AUDIO_STORAGE_KEY,JSON.stringify({version:1,...this.values}));}catch{this.persistent=false;}return this.values[key];}
}
