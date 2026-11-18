import {test} from 'node:test';import assert from 'node:assert/strict';
import {AlbumBook,AlbumService} from '../assets/scripts/color-clear/ColorClearAlbum.ts';
const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const time=()=> '2026-11-16T08:00:00.000Z';
test('guest unlocks persist uniquely and malformed storage never grants unknown models',()=>{
 const s=storage(),book=new AlbumBook(s,time);assert.equal(book.unlock(1),true);assert.equal(book.unlock(1),false);assert.equal(new AlbumBook(s,time).entries.length,1);assert.throws(()=>book.unlock(13));
 s.setItem('color-clear.album.v1','bad json');assert.equal(new AlbumBook(s,time).entries.length,0);
});
test('guest/account books and pending uploads stay isolated; cloud union never discards local unlocks',()=>{
 const book=new AlbumBook(storage(),time);book.unlock(1);book.useAccount('A');book.importGuest();book.unlock(2);assert.deepEqual(book.pending,[1,2]);book.mergeCloud([{levelId:1,unlockedAt:time()},{levelId:3,unlockedAt:time()}]);assert.deepEqual(book.entries.map(e=>e.levelId),[1,2,3]);assert.deepEqual(book.pending,[2]);
 book.useAccount('B');assert.equal(book.entries.length,0);book.useGuest();assert.deepEqual(book.entries.map(e=>e.levelId),[1]);book.useAccount('A');assert.equal(book.entries.length,3);
});
test('WeChat login merges guest IDs with authenticated album, sends bearer and revokes on logout',async()=>{
 const calls=[],store=storage();const service=new AlbumService(store,async(path,init)=>{calls.push([path,init]);if(path==='/api/auth/wechat')return{ok:true,status:200,json:async()=>({token:'test-token-A',expiresAt:'2030-01-01T00:00:00Z',user:{id:'A'}})};if(path==='/api/auth/logout')return{ok:true,status:204};return{ok:true,status:200,json:async()=>({version:1,entries:[{levelId:1,unlockedAt:time()},{levelId:3,unlockedAt:time()}]})};},time);
 service.book.unlock(1);await service.loginWithCode('fresh-code');assert.equal(service.book.accountId,'A');assert.deepEqual(service.book.entries.map(e=>e.levelId),[1,3]);assert.equal(calls[1][1].headers.Authorization,'Bearer test-token-A');assert.deepEqual(JSON.parse(calls[1][1].body),{levelIds:[1]});await service.logout();assert.equal(service.book.accountId,null);assert.equal(store.getItem('color-clear.auth'),null);
});
test('network failure preserves pending unlocks for retry and an old account response cannot leak into another',async()=>{
 let resolveOld;const bookStore=storage();const service=new AlbumService(bookStore,async(path)=>{
  if(path==='/api/auth/wechat')return{ok:true,status:200,json:async()=>({token:'A',expiresAt:'2030-01-01T00:00:00Z',user:{id:'A'}})};
  return{ok:true,status:200,json:async()=>({version:1,entries:[]})};},time);await service.loginWithCode('code');service.book.unlock(2);
 service.transport=async()=>{throw new Error('offline');};await assert.rejects(()=>service.synchronize());assert.deepEqual(service.book.pending,[2]);
 service.transport=()=>new Promise(resolve=>resolveOld=resolve);const request=service.synchronize();service.book.useAccount('B');resolveOld({ok:true,status:200,json:async()=>({version:1,entries:[{levelId:2,unlockedAt:time()}]})});await request;assert.equal(service.book.entries.length,0);
});
test('logout invalidates delayed code exchange and delayed native wx.login callbacks',async()=>{
 const s=storage();let finish,finishWx;const service=new AlbumService(s,async path=>path==='/api/auth/wechat'?new Promise(resolve=>finish=resolve):{ok:true,status:204},time);
 const login=service.loginWithCode('old');await service.logout();finish({ok:true,status:200,json:async()=>({token:'stale',expiresAt:'2030-01-01T00:00:00Z',user:{id:'A'}})});await login;assert.equal(service.authenticated,false);assert.equal(service.book.accountId,null);assert.equal(s.getItem('color-clear.auth'),null);
 const nativeLogin=service.login(()=>new Promise(resolve=>finishWx=resolve));await service.logout();finishWx('late-code');await nativeLogin;assert.equal(service.authenticated,false);
});
test('newer login wins when responses arrive out of order',async()=>{
 const resolvers=[];const service=new AlbumService(storage(),async path=>path==='/api/auth/wechat'?new Promise(resolve=>resolvers.push(resolve)):{ok:true,status:200,json:async()=>({version:1,entries:[]})},time);
 const older=service.loginWithCode('old'),newer=service.loginWithCode('new');resolvers[1]({ok:true,status:200,json:async()=>({token:'new',expiresAt:'2030-01-01T00:00:00Z',user:{id:'B'}})});await newer;resolvers[0]({ok:true,status:200,json:async()=>({token:'old',expiresAt:'2030-01-01T00:00:00Z',user:{id:'A'}})});await older;assert.equal(service.book.accountId,'B');
});
test('separate album services refresh child rescues and preserve guest unlocks through parent login',async()=>{
 const s=storage(),transport=async path=>path==='/api/auth/wechat'?{ok:true,status:200,json:async()=>({token:'A',expiresAt:'2030-01-01T00:00:00Z',user:{id:'A'}})}:{ok:true,status:200,json:async()=>({version:1,entries:[]})};
 const parent=new AlbumService(s,transport,time),child=new AlbumService(s,transport,time);child.book.unlock(2);parent.refresh();assert.deepEqual(parent.book.entries.map(e=>e.levelId),[2]);child.book.unlock(3);await parent.loginWithCode('code');assert.deepEqual(parent.book.entries.map(e=>e.levelId),[2,3]);child.refresh();assert.equal(child.book.accountId,'A');child.book.unlock(4);await parent.logout();assert.deepEqual(parent.book.entries.map(e=>e.levelId),[2,3]);child.refresh();assert.equal(child.book.accountId,null);child.book.useAccount('A');assert.deepEqual(child.book.entries.map(e=>e.levelId),[2,3,4]);
});
test('stale book mutations preserve newer entries and acknowledged pending stays acknowledged',()=>{
 const s=storage(),a=new AlbumBook(s,time),b=new AlbumBook(s,time);a.unlock(1);b.unlock(2);assert.deepEqual(new AlbumBook(s,time).entries.map(e=>e.levelId),[1,2]);a.useAccount('A');a.importGuest();b.useAccount('A');b.mergeCloud([{levelId:1,unlockedAt:time()}]);a.unlock(3);assert.deepEqual(a.pending,[2,3]);assert.deepEqual(a.entries.map(e=>e.levelId),[1,2,3]);
});
test('external auth switching isolates accounts without implicitly importing guest entries',()=>{
 const s=storage(),service=new AlbumService(s,async()=>({ok:true,status:204}),time);service.book.unlock(1);s.setItem('color-clear.auth',JSON.stringify({token:'B',expiresAt:'2030-01-01T00:00:00Z',user:{id:'B'}}));service.refresh();assert.equal(service.book.accountId,'B');assert.deepEqual(service.book.entries,[]);service.book.unlock(2);s.removeItem('color-clear.auth');service.refresh();assert.equal(service.book.accountId,null);assert.deepEqual(service.book.entries.map(e=>e.levelId),[1]);
});
test('album refresh preserves session rescues after a write is denied',()=>{
 const s=storage(),book=new AlbumBook(s,time);book.unlock(1);s.setItem=()=>{throw Error('quota');};book.unlock(2);book.refreshFromStorage();book.unlock(3);assert.deepEqual(book.entries.map(e=>e.levelId),[1,2,3]);
});
