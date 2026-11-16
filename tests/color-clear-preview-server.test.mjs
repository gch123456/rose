import {test} from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import {createPreviewServer} from '../tools/serve-preview.mjs';
const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+s.address().port)));
const close=s=>new Promise(resolve=>s.close(resolve));
test('local preview forwards only API routes, preserves bearer/status, and does not expose repository files',async()=>{
 const backend=http.createServer(async(req,res)=>{let body='';for await(const part of req)body+=part;res.writeHead(req.headers.authorization?200:401,{'Content-Type':'application/json'});res.end(JSON.stringify({path:req.url,method:req.method,body,auth:req.headers.authorization}));});const origin=await listen(backend),preview=createPreviewServer({apiOrigin:origin});const url=await listen(preview);
 try{assert.equal((await fetch(url+'/package.json')).status,404);assert.equal((await fetch(url+'/preview/color-clear.html')).status,200);assert.equal((await fetch(url+'/api/album')).status,401);const response=await fetch(url+'/api/album/merge',{method:'POST',headers:{Authorization:'Bearer test-only','Content-Type':'application/json'},body:JSON.stringify({levelIds:[1]})});assert.equal(response.status,200);assert.deepEqual(await response.json(),{path:'/api/album/merge',method:'POST',body:'{"levelIds":[1]}',auth:'Bearer test-only'});assert.equal((await fetch(url+'/api/album/merge',{method:'POST',body:'x'.repeat(17000)})).status,413);}finally{await close(preview);await close(backend);}
});
