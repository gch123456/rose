import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    collectEngine, collectSource, percentile, compareReports, formatCompare,
} from '../tools/profile-baseline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

// 功能裁剪是构建层改动，必须有一道回归测试守住「不能裁掉运行时真正用到的模块」。
const REQUIRED = ['base', 'gfx-webgl', '2d', 'ui', 'graphics', 'profiler', 'custom-pipeline'];
const FORBIDDEN = ['3d', 'physics-ammo', 'physics-cannon', 'physics-physx', 'physics-builtin',
    'physics-2d-box2d', 'spine-3.8', 'spine-4.2', 'dragon-bones', 'skeletal-animation',
    'particle', 'terrain', 'tiled-map', 'video', 'webview', 'marionette'];

test('功能裁剪配置显式存在，且使用 defaultConfig', () => {
    const e = collectEngine();
    assert.equal(e.explicit, true);
    assert.equal(e.globalConfigKey, 'defaultConfig');
    assert.ok(e.includeCount > 0, '裁剪前配置为空会让基线退化成 0 个模块');
});

test('保留 GoDuck 运行时必需的引擎模块，裁掉未使用的重模块', () => {
    const e = collectEngine();
    for (const m of REQUIRED)
        assert.ok(e.includeModules.includes(m), `${m} 是运行时必需，不能裁`);
    for (const m of FORBIDDEN)
        assert.ok(!e.includeModules.includes(m), `${m} 未被项目使用，应裁掉`);
});

test('cache 开关与 includeModules 保持一致', () => {
    const cfg = JSON.parse(read('settings/v2/packages/engine.json'));
    const c = cfg.modules.configs.defaultConfig.cache;
    for (const k of ['base', '2d', 'ui', 'graphics', 'profiler', 'audio', 'tween'])
        assert.equal(c[k]._value, true, `${k} 开关应为开`);
    for (const k of ['3d', 'spine', 'dragon-bones', 'physics', 'physics-ammo', 'physics-2d', 'video', 'webview', 'tiled-map', 'rich-text', 'mask'])
        assert.equal(c[k]._value, false, `${k} 开关应为关`);
    assert.equal(c['render-pipeline']._option, 'custom-pipeline');
});

test('渲染层仍保留 profiler 模块引用与可开关的采样入口', () => {
    const src = read('assets/scripts/GoDuck.ts');
    assert.match(src, /profiler\.hideStats\(\)/);
    assert.match(src, /profiler\.showStats\(\)/);
    assert.match(src, /goduck\.profiler/);
    assert.match(src, /tag: 'goduck\.profile'/);
    assert.match(src, /if \(this\.profiling\) this\.sampleProfiler\(dt\)/);
});

test('基线采集器的静态计数反映当前源码，而非硬编码常量', () => {
    const s = collectSource();
    assert.ok(s.scriptFiles >= 6);
    assert.ok(s.layerCalls > 0, 'Graphics 图层应有创建点');
    assert.ok(s.labelCalls > 0, 'Label 应有创建点');
    assert.ok(s.clearCalls > 0, '应统计到每帧重绘的 clear()');
    assert.ok(s.sourceTextures > 50, '素材未被删除');
    assert.equal(s.cacheModeSets, 0, '本轮不改 Label CacheMode，留给后续决策');
    assert.equal(s.dynamicAtlasRefs, 0, '本轮不开启动态合图，留给后续决策');
    assert.equal(s.enemySpriteCap, 190);
});

test('percentile 边界与分位取值', () => {
    assert.equal(percentile([], .5), 0);
    assert.equal(percentile([5], .99), 5);
    const a = Array.from({ length: 100 }, (_, i) => i + 1);
    assert.equal(percentile(a, .5), 51);
    assert.equal(percentile(a, .95), 96);
});

test('两份基线可逐项算出差值与百分比', () => {
    const base = {
        label: 'a', capturedAt: 'x', git: 'x', node: 'x',
        build: { totalBytes: 1000, gzipBytes: 100, cocosJsBytes: 500, wasmBytes: 200,
            wasmFiles: [{ file: 'w', bytes: 200 }], fileCount: 10, pngCount: 61 },
        engine: { explicit: true, includeCount: 22, includeModules: ['3d', '2d'] },
        source: { layerCalls: 4, labelCalls: 30, clearCalls: 10, cacheModeSets: 0, dynamicAtlasRefs: 0, sourceTextures: 59 },
        cpu: { idle: { p50Ms: 1, p95Ms: 1, p99Ms: 1, maxMs: 1, meanMs: 1 },
               horde: { p50Ms: 2, p95Ms: 2, p99Ms: 2, maxMs: 2, meanMs: 2 } },
    };
    const after = structuredClone(base);
    after.label = 'b';
    after.build.totalBytes = 800;
    after.build.wasmBytes = 0;
    after.build.wasmFiles = [];
    after.engine.includeModules = ['2d'];
    const rows = compareReports(base, after);
    const total = rows.find(r => r.metric === '主包总字节');
    assert.equal(total.delta, -200);
    assert.equal(total.pct, -20);
    const wasm = rows.find(r => r.metric === 'wasm 字节');
    assert.equal(wasm.delta, -200);
    const md = formatCompare(base, after);
    assert.match(md, /裁掉（1）/);
    assert.match(md, /移除 `w`/);
    assert.match(md, /主包总字节/);
});
