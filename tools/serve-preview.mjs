import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json'};
export function createPreviewServer({apiOrigin=process.env.COLOR_CLEAR_API_ORIGIN||'http://127.0.0.1:8080'}={}){
 const origin=new URL(apiOrigin);if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('API origin must be a plain HTTP(S) origin');
 const server=http.createServer(async(req,res)=>{
  let parsed,name;try{parsed=new URL(req.url,'http://localhost');name=decodeURIComponent(parsed.pathname);}catch{res.writeHead(400);res.end();return;}
  if(name.startsWith('/api/')){
   if(!['GET','POST'].includes(req.method)){res.writeHead(405);res.end();return;}
   try{
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size<=16384)chunks.push(chunk);}if(size>16384){res.writeHead(413);res.end();return;}
    const response=await fetch(new URL(parsed.pathname+parsed.search,origin),{method:req.method,headers:{'Content-Type':'application/json',...(req.headers.authorization?{Authorization:req.headers.authorization}:{})},...(req.method==='POST'?{body:Buffer.concat(chunks)}:{}),signal:AbortSignal.timeout(10000)});
    res.writeHead(response.status,{'Content-Type':response.headers.get('content-type')||'application/json','Cache-Control':'no-store'});res.end(Buffer.from(await response.arrayBuffer()));
   }catch{res.writeHead(503,{'Content-Type':'application/json'});res.end('{"error":"backend_unavailable"}');}return;
  }
  if(name==='/')name='/preview/color-clear.html';
  if(!name.startsWith('/preview/')){res.writeHead(404);res.end();return;}
  const file=path.resolve(root,'.'+name);if(!file.startsWith(path.join(root,'preview')+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
 });server.requestTimeout=15000;return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const port=Number(process.env.COLOR_CLEAR_PORT)||4179;createPreviewServer().listen(port,'127.0.0.1',()=>console.log(`Preview: http://127.0.0.1:${port}/preview/color-clear.html`));}
