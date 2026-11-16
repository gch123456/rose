import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = await build({entryPoints:[path.join(root,'preview/color-clear/main.js')],bundle:true,tsconfigRaw:{compilerOptions:{target:'ES2022'}},write:false,minify:true,format:'iife',target:'es2020'});
const license=fs.readFileSync(path.join(root,'node_modules/three/LICENSE'),'utf8');
const css=fs.readFileSync(path.join(root,'preview/color-clear/style.css'),'utf8');
// Normalize whitespace in embedded shader template strings for clean generated diffs.
const js=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script').replace(/[ \t]+$/gm,'').replace(/^ +(?=\t)/gm,'');
const html=fs.readFileSync(path.join(root,'preview/color-clear/index.html'),'utf8').replace('<head>',()=>'<head>\n<!-- Bundled Three.js license\n'+license+'\n-->').replace('<link rel="stylesheet" href="./style.css">',()=>`<style>${css}</style>`).replace('<script type="module" src="./main.js"></script>',()=>`<script>${js}</script>`);
fs.writeFileSync(path.join(root,'preview/color-clear.html'),html);
console.log(`Built offline preview/color-clear.html (${Math.round(Buffer.byteLength(html)/1024)} KiB)`);
