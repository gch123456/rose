// 把纯规则层 SurvivorGame.ts 剥离类型后内联进自包含 HTML，生成可直接试玩的网页版。
// 规则和 Cocos / 微信小游戏共用同一份源码，避免预览与正式版数值漂移。
// 用法: node tools/build-preview.mjs
import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const source = fs.readFileSync(path.join(root, 'assets/scripts/SurvivorGame.ts'), 'utf8');
const logic = stripTypeScriptTypes(source, { mode: 'strip' }).replace(/^export /gm, '');
const renderer = fs.readFileSync(path.join(root, 'preview/renderer.js'), 'utf8');

// 沉没地牢背景贴图以 base64 内联，保证 mow.html 单文件自包含。
const bgData = Object.fromEntries(['sunken', 'title'].map(name => {
    const file = path.join(root, 'assets/resources/bg/' + name + '.png');
    return [name, 'data:image/png;base64,' + fs.readFileSync(file).toString('base64')];
}));
const bgJson = JSON.stringify(bgData);

const shell = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>鸭命要紧 · 万剑救鸭（割草试玩）</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; overflow: hidden;
    background: radial-gradient(circle at 30% 20%, #F3FBE9 0%, #DCEFE6 55%, #C9E5DC 100%);
    font-family: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif; }
  .wrap { height: 100%; display: flex; align-items: center; justify-content: center; padding: 10px; }
  canvas { height: min(96vh, 1120px); aspect-ratio: 640 / 1120; max-width: 100vw;
    border-radius: 22px; border: 3px solid #E7C88A;
    box-shadow: 0 18px 60px rgba(51, 68, 92, .28), inset 0 0 0 1px rgba(255,255,255,.6);
    touch-action: none; cursor: crosshair; background: #FFF3D6; }
</style>
</head>
<body>
<div class="wrap"><canvas id="game"></canvas></div>
<script>
window.__GODUCK_BG = /*__BGDATA__*/;
/*__LOGIC__*/
/*__RENDERER__*/
</script>
</body>
</html>
`;

const html = shell.replace('/*__BGDATA__*/', () => bgJson)
    .replace('/*__LOGIC__*/', () => logic).replace('/*__RENDERER__*/', () => renderer);
const out = path.join(root, 'preview/mow.html');
fs.writeFileSync(out, html, 'utf8');
console.log('generated: ' + out + '  (' + (html.length / 1024).toFixed(1) + ' KB)');
