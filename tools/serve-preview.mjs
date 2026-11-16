import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{
 let name;try{name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 if(name==='/')name='/preview/color-clear.html';
 // Serve preview files only, never repository config or credentials.
 if(!name.startsWith('/preview/')){res.writeHead(404);res.end();return;}
 const file=path.resolve(root,'.'+name);
 if(!file.startsWith(path.join(root,'preview')+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
});
const port=Number(process.env.COLOR_CLEAR_PORT)||4179;
server.listen(port,'127.0.0.1',()=>console.log(`Preview: http://127.0.0.1:${port}/preview/color-clear.html`));
