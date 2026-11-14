#!/usr/bin/env node
// 可复现的「包体 / 引擎模块 / 源码渲染负载 / 规则层 CPU」基线采集器。
// 零依赖，Node 22+（直接 import .ts，靠内建 type stripping）。
//
//   node tools/profile-baseline.mjs --label before --out docs/baselines/2026-11-14-before.json
//   node tools/profile-baseline.mjs --compare docs/baselines/a.json docs/baselines/b.json --md docs/baselines/compare.md
//
// 采集的每一类数字都用于后续决策，不掺杂主观判断：
//   build.*    → 功能裁剪省了多少包体（功能裁剪的验收数字）
//   engine.*   → 到底裁掉了哪些模块（可复现的配置核对）
//   source.*   → 合图 / 图集 / Label CacheMode 的改造工作量上界（静态计数，非实测 DrawCall）
//   cpu.*      → 190 敌人满负载单帧规则层耗时分位数（真机帧率的 CPU 侧参照）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { SurvivorGame, MOW_UPGRADES, MOW_ENEMY_CAP } from '../assets/scripts/SurvivorGame.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(ROOT, 'build/wechatgame');
const ENGINE_CFG = path.join(ROOT, 'settings/v2/packages/engine.json');
const SCRIPTS = path.join(ROOT, 'assets/scripts');
const RESOURCES = path.join(ROOT, 'assets/resources');

const read = p => fs.readFileSync(p, 'utf8');
const exists = p => fs.existsSync(p);

function walk(dir) {
    if (!exists(dir)) return [];
    const out = [];
    for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) out.push(...walk(p));
        else out.push({ path: p, size: st.size });
    }
    return out;
}
const sum = a => a.reduce((n, x) => n + x, 0);
const rel = p => path.relative(BUILD, p).split(path.sep).join('/');

export function percentile(arr, p) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

// ── 1. 构建产物：体积分桶、模块清单、素材数、tar.gz ──────────────────
export function collectBuild() {
    if (!exists(BUILD)) return { present: false };
    const files = walk(BUILD);
    const byTop = {};
    const byExt = {};
    for (const f of files) {
        const parts = rel(f.path).split('/');
        const top = parts.length > 1 ? parts[0] : '(root files)';
        byTop[top] = (byTop[top] || 0) + f.size;
        const ext = path.extname(f.path) || '(none)';
        byExt[ext] = (byExt[ext] || 0) + f.size;
    }
    const wasm = files.filter(f => f.path.includes('.wasm'));
    const pngs = files.filter(f => f.path.toLowerCase().endsWith('.png'));
    const cocosJs = files
        .filter(f => f.path.includes('/cocos-js/'))
        .map(f => ({ file: rel(f.path), bytes: f.size }))
        .sort((a, b) => b.bytes - a.bytes);
    let gzipBytes = null;
    try {
        const buf = execFileSync('tar', ['--no-xattrs', '-czf', '-', '-C', path.dirname(BUILD), path.basename(BUILD)], {
            maxBuffer: 1 << 28,
            env: { ...process.env, COPYFILE_DISABLE: '1' },
        });
        gzipBytes = buf.length;
    } catch { /* 无 tar 时留空，不影响其余数字 */ }
    return {
        present: true,
        totalBytes: sum(files.map(f => f.size)),
        fileCount: files.length,
        gzipBytes,
        byTop,
        byExt,
        wasmBytes: sum(wasm.map(f => f.size)),
        wasmFiles: wasm.map(f => ({ file: rel(f.path), bytes: f.size })).sort((a, b) => b.bytes - a.bytes),
        pngCount: pngs.length,
        pngBytes: sum(pngs.map(f => f.size)),
        cocosJsBytes: sum(cocosJs.map(f => f.bytes)),
        cocosJsTop: cocosJs.slice(0, 12),
    };
}

// ── 2. 功能裁剪配置 ───────────────────────────────────────────────
export function collectEngine() {
    const cfg = JSON.parse(read(ENGINE_CFG));
    const cfgList = cfg?.modules?.configs || {};
    const key = cfg?.modules?.globalConfigKey || Object.keys(cfgList)[0];
    const conf = cfgList[key] || null;
    const include = conf?.includeModules || [];
    const cache = conf?.cache || {};
    const enabled = Object.entries(cache).filter(([, v]) => v && v._value === true).map(([k]) => k);
    return {
        schemaVersion: cfg?.__version__ || null,
        explicit: !!conf,
        // 没有 modules 配置时引擎按「全量模块」打包，不能当成 0 个模块来对比。
        defaultAll: !conf,
        globalConfigKey: key || null,
        includeModules: conf ? [...include].sort() : [],
        includeCount: conf ? include.length : null,
        enabledSwitches: enabled.sort(),
        enabledSwitchCount: enabled.length,
    };
}

// ── 3. 源码静态渲染负载（计数，不是实测 DrawCall） ───────────────────
export function collectSource() {
    const tsFiles = fs.readdirSync(SCRIPTS).filter(f => f.endsWith('.ts')).map(f => path.join(SCRIPTS, f));
    const all = tsFiles.map(read).join('\n');
    const count = re => (all.match(re) || []).length;
    const pngs = walk(RESOURCES).filter(f => f.path.toLowerCase().endsWith('.png'));
    return {
        scriptFiles: tsFiles.length,
        scriptLines: all.split('\n').length,
        layerCalls: count(/this\.layer\(/g),            // Graphics 图层创建点
        labelCalls: count(/this\.label\(/g),            // Label 创建点
        graphicsAdds: count(/addComponent\(Graphics\)/g),
        labelAdds: count(/addComponent\(Label\)/g),
        spriteAdds: count(/addComponent\(Sprite\)/g),
        clearCalls: count(/\.clear\(\)/g),             // 每帧重绘点
        resourcesLoads: count(/resources\.load/g),
        cacheModeSets: count(/cacheMode/g),
        dynamicAtlasRefs: count(/DynamicAtlasManager|CLEANUP_IMAGE_CACHE/g),
        sourceTextures: pngs.length,
        sourceTextureBytes: sum(pngs.map(f => f.size)),
        enemySpriteCap: MOW_ENEMY_CAP,
    };
}

// ── 4. 规则层 CPU 基线：满负载单帧 tick ──────────────────────────────
function makeHorde(n) {
    return Array.from({ length: n }, (_, i) => ({
        id: 100000 + i,
        kind: i % 9 === 0 ? 'brute' : i % 3 === 0 ? 'runner' : 'grunt',
        x: Math.cos(i * 2.399) * (120 + i % 260),
        y: Math.sin(i * 2.399) * (120 + i % 260),
        hp: 24 + i % 40, maxHp: 24 + i % 40,
        radius: 15, speed: 30 + i % 40,
        flash: 0, wobble: 0, dead: false,
    }));
}
const makeSwords = n => Array.from({ length: n }, (_, i) => {
    const a = i * 2.399;
    return {
        x: Math.cos(a) * 90, y: Math.sin(a) * 90,
        dx: Math.cos(a), dy: Math.sin(a),
        left: 1, speed: 520, damage: 18, pierce: 2,
        hit: [], crit: i % 5 === 0,
    };
});
const makeGems = n => Array.from({ length: n }, (_, i) => ({
    x: Math.cos(i * 2.399) * (30 + i % 180),
    y: Math.sin(i * 2.399) * (30 + i % 180),
    value: 1 + i % 3, bob: 0,
}));

// 稳定的「满负载单帧」：每帧把战场钉回同一组敌人 / 飞剑 / 魂珠，
// 只测 tick 自身的成本；固定 RNG 与固定负载保证两次采集可以逐项对比。
const LOAD = { swords: 48, gems: 120 };

function runScenario(enemyCount, frames = 480) {
    let seed = 20261114;
    const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const g = new SurvivorGame(rnd);
    g.start('shooter');
    for (const u of MOW_UPGRADES) g.upgrades[u.id] = u.max;
    const horde = makeHorde(enemyCount);
    const swords = makeSwords(LOAD.swords);
    const gems = makeGems(LOAD.gems);
    const reset = () => {
        g.enemies = horde.slice();
        g.swords = swords.map(s => ({ ...s, hit: [] }));
        g.gems = gems.map(v => ({ ...v }));
        g.floats = []; g.particles = []; g.effects = [];
        g.events = []; g.upgradeToasts = [];
        g.phase = 'playing'; g.time = 60; g.hp = g.maxHp; g.boss = null;
    };
    const samples = [];
    for (let i = 0; i < 30; i++) { reset(); g.tick(1 / 60, 0, 0); }  // 预热，避开 JIT 冷启动
    for (let i = 0; i < frames; i++) {
        reset();                                  // 重置放在计时外
        const t0 = process.hrtime.bigint();
        g.tick(1 / 60, 0, 0);
        samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
    }
    return {
        enemyCount,
        swordCount: LOAD.swords,
        gemCount: LOAD.gems,
        frames,
        meanMs: +(sum(samples) / samples.length).toFixed(4),
        p50Ms: +percentile(samples, .5).toFixed(4),
        p95Ms: +percentile(samples, .95).toFixed(4),
        p99Ms: +percentile(samples, .99).toFixed(4),
        maxMs: +Math.max(...samples).toFixed(4),
    };
}

export function collectCpu() {
    return { idle: runScenario(0), horde: runScenario(MOW_ENEMY_CAP) };
}

export function collectAll(label = 'unnamed') {
    let git = null;
    try {
        git = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim();
    } catch { /* 非 git 环境 */ }
    return {
        schema: 'goduck.baseline.v1',
        label,
        capturedAt: new Date().toISOString(),
        node: process.version,
        platform: `${process.platform}/${process.arch}`,
        git,
        build: collectBuild(),
        engine: collectEngine(),
        source: collectSource(),
        cpu: collectCpu(),
    };
}

// ── 5. 两份基线的量化对比 ──────────────────────────────────────────
const fmtBytes = n => n == null ? '—' : n >= 1048576 ? `${(n / 1048576).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`;
const delta = (a, b) => (a == null || b == null) ? null : b - a;
const pctDelta = (a, b) => (a == null || b == null || !a) ? null : ((b - a) / a * 100);

export function compareReports(before, after) {
    const rows = [];
    const push = (metric, a, b, unit = '') => {
        const d = delta(a, b);
        const p = pctDelta(a, b);
        rows.push({ metric, before: a, after: b, delta: d, pct: p, unit });
    };
    push('主包总字节', before.build.totalBytes, after.build.totalBytes, 'B');
    push('主包 tar.gz', before.build.gzipBytes, after.build.gzipBytes, 'B');
    push('cocos-js 字节', before.build.cocosJsBytes, after.build.cocosJsBytes, 'B');
    push('wasm 字节', before.build.wasmBytes, after.build.wasmBytes, 'B');
    push('wasm 文件数', before.build.wasmFiles?.length ?? null, after.build.wasmFiles?.length ?? null, '');
    push('主包文件数', before.build.fileCount, after.build.fileCount, '');
    push('png 数', before.build.pngCount, after.build.pngCount, '');
    push('引擎 includeModules 数（仅显式配置可比）',
        before.engine.explicit ? before.engine.includeCount : null,
        after.engine.explicit ? after.engine.includeCount : null, '');
    for (const k of ['p50Ms', 'p95Ms', 'p99Ms', 'maxMs', 'meanMs']) {
        push(`规则层 CPU ${k}（190 敌）`, before.cpu.horde[k], after.cpu.horde[k], 'ms');
        push(`规则层 CPU ${k}（空场）`, before.cpu.idle[k], after.cpu.idle[k], 'ms');
    }
    for (const k of ['layerCalls', 'labelCalls', 'clearCalls', 'cacheModeSets', 'dynamicAtlasRefs', 'sourceTextures']) {
        push(`源码静态 ${k}`, before.source[k], after.source[k], '');
    }
    return rows;
}

export function formatCompare(before, after) {
    const rows = compareReports(before, after);
    const cell = (v, unit) => v == null ? '—' : (unit === 'B' ? fmtBytes(v) : (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(4)) : String(v)));
    const lines = [
        `# 基线对比：${before.label} → ${after.label}`,
        '',
        `采集时间：${before.capturedAt} → ${after.capturedAt}；Node ${before.node} → ${after.node}；git ${before.git} → ${after.git}`,
        '',
        '| 指标 | 前 | 后 | 差值 | 变化 |',
        '|---|---:|---:|---:|---:|',
    ];
    for (const r of rows) {
        const d = r.delta;
        const dText = d == null ? '—' : (r.unit === 'B'
            ? `${d < 0 ? '-' : '+'}${fmtBytes(Math.abs(d))}`
            : `${d > 0 ? '+' : ''}${Number.isInteger(d) ? d : d.toFixed(4)}`);
        const pText = r.pct == null ? '—' : `${r.pct > 0 ? '+' : ''}${r.pct.toFixed(1)}%`;
        lines.push(`| ${r.metric} | ${cell(r.before, r.unit)} | ${cell(r.after, r.unit)} | ${dText} | ${pText} |`);
    }
    lines.push('', '## 引擎模块差异', '');
    if (!before.engine.explicit) {
        lines.push('- 裁剪前：`engine.json` 没有 `modules` 配置，引擎按**默认全量模块**打包，无法逐项列出，不能当作 0 个模块。');
        lines.push(`- 裁剪后：显式列出 **${after.engine.includeCount} 个** → ${after.engine.includeModules.join(', ')}`);
        lines.push('- 其中 `ui-skew` 是 Creator 3.8.8 构建时自动补入的依赖模块，非人工添加；配置已被编辑器规范化并排序。');
    } else {
        const removed = before.engine.includeModules.filter(m => !after.engine.includeModules.includes(m));
        const added = after.engine.includeModules.filter(m => !before.engine.includeModules.includes(m));
        lines.push(`- 裁掉（${removed.length}）：${removed.join(', ') || '无'}`);
        lines.push(`- 新增（${added.length}）：${added.join(', ') || '无'}`);
    }
    const wasmGone = before.build.wasmFiles?.filter(w => !after.build.wasmFiles?.some(x => x.file === w.file)) || [];
    lines.push('', '## wasm 变化', '', ...(wasmGone.length ? wasmGone.map(w => `- 移除 \`${w.file}\`（${fmtBytes(w.bytes)}）`) : ['- 无']));
    lines.push('',
        '> 说明一：功能裁剪只改引擎与构建配置，**规则层代码一行未动**，因此 CPU 行在两次采集间的 ±10% 波动属于 Node 测量噪声，不计为优化收益；CPU 数字的作用是给后续合图 / 图集改造留一个同口径参照。',
        '> 说明二：CPU 是 Node 上纯规则层 tick 的耗时，不是真机帧率；DrawCall / 帧率须用微信开发者工具 Profiler 实采。源码静态计数是改造工作量上界，不是实测 DrawCall。',
        '');
    return lines.join('\n');
}

function arg(name) {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

function main() {
    const cmp = arg('--compare');
    if (cmp) {
        const b = JSON.parse(read(path.resolve(cmp)));
        const a = JSON.parse(read(path.resolve(process.argv[process.argv.indexOf('--compare') + 2])));
        const md = formatCompare(b, a);
        const out = arg('--md');
        if (out) { fs.writeFileSync(path.resolve(out), md); console.log(`已写入 ${out}`); }
        console.log(md);
        return;
    }
    const label = arg('--label') || 'unnamed';
    const report = collectAll(label);
    const out = path.resolve(arg('--out') || path.join(ROOT, 'docs/baselines', `${label}.json`));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
    const b = report.build;
    console.log(`[${label}] 主包 ${fmtBytes(b.totalBytes)} / gzip ${fmtBytes(b.gzipBytes)} / wasm ${fmtBytes(b.wasmBytes)} / ${b.fileCount} 文件 / ${b.pngCount} png`);
    console.log(`[${label}] 引擎模块 ${report.engine.includeCount} 个 / 规则层 p95 ${report.cpu.horde.p95Ms} ms（190 敌）`);
    console.log(`已写入 ${out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
