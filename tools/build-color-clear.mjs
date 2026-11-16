import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {buildWizardPreset} from './build-wizard.mjs';
await buildWizardPreset();
import {buildShibaPreset} from './build-shiba.mjs';
await buildShibaPreset();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({entryPoints:[path.join(root,'preview/color-clear/main.js')],bundle:true,tsconfigRaw:{compilerOptions:{target:'ES2022'}},write:false,minify:true,format:'iife',target:'es2020'});
const license=fs.readFileSync(path.join(root,'node_modules/three/LICENSE'),'utf8');
const css=fs.readFileSync(path.join(root,'preview/color-clear/style.css'),'utf8');
// Normalize whitespace in embedded shader template strings for clean generated diffs.
const js=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script').replace(/[ \t]+$/gm,'').replace(/^ +(?=\t)/gm,'');
const html=fs.readFileSync(path.join(root,'preview/color-clear/index.html'),'utf8').replace('<head>',()=>'<head>\n<!-- Bundled Three.js license\n'+license+'\n-->').replace('<link rel="stylesheet" href="./style.css">',()=>`<style>${css}</style>`).replace('<script type="module" src="./main.js"></script>',()=>`<script>${js}</script>`);
fs.writeFileSync(path.join(root,'preview/color-clear.html'),html);
console.log(`Built offline preview/color-clear.html (${Math.round(Buffer.byteLength(html)/1024)} KiB)`);

const worker=await build({entryPoints:[path.join(root,'preview/color-clear/studio/generation-worker.js')],bundle:true,tsconfigRaw:{compilerOptions:{target:'ES2022'}},write:false,minify:true,format:'iife',target:'es2020'});
const studio=await build({define:{__STUDIO_WORKER_SOURCE__:JSON.stringify(worker.outputFiles[0].text)},entryPoints:[path.join(root,'preview/color-clear/studio/main.js')],bundle:true,tsconfigRaw:{compilerOptions:{target:'ES2022'}},write:false,minify:true,format:'iife',target:'es2020'});
const studioJs=studio.outputFiles[0].text.replace(/<\/script/gi,'<\\/script').replace(/[ \t]+$/gm,'').replace(/^ +(?=\t)/gm,'');
const studioCss=fs.readFileSync(path.join(root,'preview/color-clear/studio/style.css'),'utf8');
const studioHtml=fs.readFileSync(path.join(root,'preview/color-clear/studio/index.html'),'utf8').replace('<head>',()=>'<head>\n<!-- Bundled Three.js license\n'+license+'\n-->').replace('<link rel="stylesheet" href="./style.css">',()=>`<style>${studioCss}</style>`).replace('<script type="module" src="./main.js"></script>',()=>`<script>${studioJs}</script>`);
fs.writeFileSync(path.join(root,'preview/level-studio.html'),studioHtml);
console.log(`Built private preview/level-studio.html (${Math.round(Buffer.byteLength(studioHtml)/1024)} KiB)`);

async function buildReady(output,config){
 const ready=await build({define:{__READY_PRESET__:JSON.stringify(config)},entryPoints:[path.join(root,'preview/color-clear/ready/main.js')],bundle:true,tsconfigRaw:{compilerOptions:{target:'ES2022'}},write:false,minify:true,format:'esm',target:'es2022'});
 const readyJs=ready.outputFiles[0].text.replace(/<\/script/gi,'<\\/script').replace(/[ \t]+$/gm,'').replace(/^ +(?=\t)/gm,'');
 const readyHtml=fs.readFileSync(path.join(root,'preview/color-clear/ready/index.html'),'utf8').replaceAll('__MODEL_TITLE__',config.title).replaceAll('__MODEL_KICKER__',config.kicker).replaceAll('__MODEL_DESCRIPTION__',config.description).replace('<head>',()=>'<head>\n<!-- Bundled Three.js license\n'+license+'\n-->').replace('<link rel="stylesheet" href="./style.css">',()=>`<style>${fs.readFileSync(path.join(root,'preview/color-clear/ready/style.css'),'utf8')}</style>`).replace('<script type="module" src="./main.js"></script>',()=>`<script type="module">${readyJs}</script>`);
 fs.writeFileSync(path.join(root,'preview',output),readyHtml);
}
await buildReady('shiba.html',{kind:'shiba',title:'柴犬团子',kicker:'YOUR LITTLE SHIBA · 原创程序造型',description:'尖耳朵、奶油肚皮和卷尾巴。',data:JSON.parse(fs.readFileSync(path.join(root,'preview/color-clear/ready/level.json'),'utf8'))});
const wizard=path.join(root,'preview/color-clear/ready/wizard-level.json');
if(fs.existsSync(wizard))await buildReady('wizard-duck.html',{kind:'wizard',title:'法师鸭',kicker:'YOUR LITTLE WIZARD · 已为你做好',description:'蓝色巫师帽、魔法球和法杖。',asset:'./models/wizard-duck.glb',triangles:31050,data:JSON.parse(fs.readFileSync(wizard,'utf8'))});
console.log('Built ready-to-play models.');
