import type {AlbumTransport} from './ColorClearAlbum';
type WechatPlatform={login:(options:{success:(r:{code?:string})=>void;fail:()=>void})=>void;request:(options:{url:string;method:string;header:Record<string,string>;data?:string;timeout:number;success:(r:{statusCode:number;data:unknown})=>void;fail:()=>void})=>void};
const platform=()=> (globalThis as typeof globalThis & {wx?:WechatPlatform}).wx;
export function wechatLoginCode():Promise<string>{return new Promise((resolve,reject)=>{const wx=platform();if(!wx?.login){reject(new Error('请在微信小游戏中登录'));return;}wx.login({success:r=>r.code?resolve(r.code):reject(new Error('微信没有返回登录凭证')),fail:()=>reject(new Error('微信登录暂时不可用'))});});}
export function wechatAlbumTransport(apiOrigin:string):AlbumTransport{
 return(path,init)=>new Promise((resolve,reject)=>{
  const origin=apiOrigin.replace(/\/+$/,'');if(!/^https:\/\/[^/?#]+$/.test(origin)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)){reject(new Error('请先配置图册服务器HTTPS地址'));return;}
  const wx=platform();if(!wx?.request){reject(new Error('当前环境没有微信网络接口'));return;}
  wx.request({url:origin+path,method:init.method,header:init.headers,...(init.body!==undefined?{data:init.body}:{}),timeout:10000,success:r=>resolve({ok:r.statusCode>=200&&r.statusCode<300,status:r.statusCode,json:async()=>r.data}),fail:()=>reject(new Error('图册服务器暂时无法连接'))});
 });
}
