export type AlbumEntry={levelId:number;unlockedAt:string};
export type AlbumStorage={getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void;removeItem:(key:string)=>void};
type BookData={entries:AlbumEntry[];pending:number[]};
type Disk={version:1;guest:BookData;accounts:Record<string,BookData>};
export type AlbumResponse={ok:boolean;status:number;json?:()=>Promise<unknown>};
export type AlbumTransport=(path:string,init:{method:string;headers:Record<string,string>;body?:string})=>Promise<AlbumResponse>;
const KEY='color-clear.album.v1',AUTH_KEY='color-clear.auth';
const validId=(n:unknown):n is number=>Number.isInteger(n)&&Number(n)>=1&&Number(n)<=10;
const empty=():BookData=>({entries:[],pending:[]});
function entries(raw:unknown):AlbumEntry[]{
 if(!Array.isArray(raw))return[];const result=new Map<number,AlbumEntry>();
 for(const e of raw){if(!e||!validId(e.levelId)||typeof e.unlockedAt!=='string'||!Number.isFinite(Date.parse(e.unlockedAt)))continue;if(!result.has(e.levelId))result.set(e.levelId,{levelId:e.levelId,unlockedAt:e.unlockedAt});}
 return [...result.values()].sort((a,b)=>a.levelId-b.levelId);
}
function data(raw:unknown):BookData{const value=raw as Partial<BookData>|null;return{entries:entries(value?.entries),pending:Array.isArray(value?.pending)?[...new Set(value!.pending.filter(validId))].sort((a,b)=>a-b):[]};}
export class AlbumBook{
 private storage:AlbumStorage;private clock:()=>string;private disk:Disk;accountId:string|null=null;
 constructor(storage:AlbumStorage,clock=()=>new Date().toISOString()){
  this.storage=storage;this.clock=clock;this.disk={version:1,guest:empty(),accounts:Object.create(null)};
  try{const raw=JSON.parse(storage.getItem(KEY)||'null');if(raw?.version===1){this.disk.guest=data(raw.guest);if(raw.accounts&&typeof raw.accounts==='object')for(const [id,value]of Object.entries(raw.accounts))if(id.length<=200)this.disk.accounts[id]=data(value);}}catch{/* Invalid local state is discarded, never treated as an unlock. */}
 }
 private get current():BookData{if(this.accountId===null)return this.disk.guest;return this.disk.accounts[this.accountId]??(this.disk.accounts[this.accountId]=empty());}
 get entries():AlbumEntry[]{return this.current.entries.map(e=>({...e}));}
 get pending():number[]{return [...this.current.pending];}
 useGuest():void{this.accountId=null;}
 useAccount(id:string):void{if(typeof id!=='string'||!id||id.length>200)throw new Error('Invalid account');this.accountId=id;}
 private persist():void{try{this.storage.setItem(KEY,JSON.stringify(this.disk));}catch{/* Memory remains usable in private mode or full storage. */}}
 unlock(levelId:number):boolean{if(!validId(levelId))throw new Error('Invalid model');if(this.current.entries.some(e=>e.levelId===levelId))return false;this.current.entries.push({levelId,unlockedAt:this.clock()});this.current.entries.sort((a,b)=>a.levelId-b.levelId);if(this.accountId!==null)this.current.pending.push(levelId);this.persist();return true;}
 importGuest():void{if(this.accountId===null)return;for(const e of this.disk.guest.entries)if(!this.current.entries.some(v=>v.levelId===e.levelId)){this.current.entries.push({...e});this.current.pending.push(e.levelId);}this.current.entries.sort((a,b)=>a.levelId-b.levelId);this.current.pending=[...new Set(this.current.pending)];this.persist();}
 mergeCloud(raw:unknown):void{if(this.accountId===null)return;const cloud=entries(raw),merged=new Map(this.current.entries.map(e=>[e.levelId,e]));for(const e of cloud)merged.set(e.levelId,e);this.current.entries=[...merged.values()].sort((a,b)=>a.levelId-b.levelId);const acknowledged=new Set(cloud.map(e=>e.levelId));this.current.pending=this.current.pending.filter(id=>!acknowledged.has(id));this.persist();}
}
type Session={token:string;expiresAt:string;user:{id:string}};
export class AlbumService{
 book:AlbumBook;transport:AlbumTransport;private storage:AlbumStorage;private session:Session|null=null;private clock:()=>string;private authGeneration=0;
 constructor(storage:AlbumStorage,transport:AlbumTransport,clock=()=>new Date().toISOString()){
  this.storage=storage;this.transport=transport;this.clock=clock;this.book=new AlbumBook(storage,clock);
  try{const value=JSON.parse(storage.getItem(AUTH_KEY)||'null');if(value?.token&&typeof value.token==='string'&&typeof value.user?.id==='string'&&Date.parse(value.expiresAt)>Date.parse(clock())){this.session=value;this.book.useAccount(value.user.id);}}catch{/* Never restore malformed credentials. */}
 }
 get authenticated():boolean{return !!this.session;}
 private async request(path:string,method='GET',body?:unknown,token=this.session?.token):Promise<unknown>{
  const response=await this.transport(path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  if(!response.ok)throw new Error(response.status===401?'登录已过期，请重新微信登录':response.status===503?'登录服务尚未配置或暂时不可用':'图册同步失败，请稍后重试');
  return response.status===204?null:await response.json?.();
 }
 loginWithCode(code:string):Promise<void>{return this.exchange(code,++this.authGeneration);}
 async login(provider:()=>Promise<string>):Promise<void>{const generation=++this.authGeneration;const code=await provider();if(generation===this.authGeneration)await this.exchange(code,generation);}
 private async exchange(code:string,generation:number):Promise<void>{
  if(!code||typeof code!=='string')throw new Error('没有取得微信登录凭证');
  const raw=await this.request('/api/auth/wechat','POST',{code},undefined) as Session;
  if(generation!==this.authGeneration){if(raw&&typeof raw.token==='string'&&raw.token&&raw.token!==this.session?.token)void this.request('/api/auth/logout','POST',undefined,raw.token).catch(()=>{});return;}
  if(!raw||typeof raw.token!=='string'||!raw.token||typeof raw.user?.id!=='string'||!raw.user.id||!Number.isFinite(Date.parse(raw.expiresAt))||Date.parse(raw.expiresAt)<=Date.parse(this.clock()))throw new Error('登录响应无效');
  this.session={token:raw.token,expiresAt:raw.expiresAt,user:{id:raw.user.id}};this.book.useAccount(raw.user.id);this.book.importGuest();try{this.storage.setItem(AUTH_KEY,JSON.stringify(this.session));}catch{/* session remains in memory */}await this.synchronize();
 }
 async synchronize():Promise<void>{
  const session=this.session,owner=this.book.accountId;if(!session||owner===null)return;
  const pending=this.book.pending;
  const raw=await this.request(pending.length?'/api/album/merge':'/api/album',pending.length?'POST':'GET',pending.length?{levelIds:pending}:undefined,session.token) as {version:number;entries:unknown};
  if(this.session?.token!==session.token||this.book.accountId!==owner)return;
  if(raw?.version!==1||!Array.isArray(raw.entries))throw new Error('图册响应无效');this.book.mergeCloud(raw.entries);
 }
 async logout():Promise<void>{this.authGeneration++;const session=this.session;this.session=null;this.book.useGuest();try{this.storage.removeItem(AUTH_KEY);}catch{/* memory cleared */}if(session)await this.request('/api/auth/logout','POST',undefined,session.token);}
}
