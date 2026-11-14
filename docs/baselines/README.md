# Profiler 与包体基线

本目录保存**可复现、可逐项对比**的量化基线，用于决定后续「动态合图 / Label CacheMode / SpriteAtlas」的先后顺序。所有数字都由 `tools/profile-baseline.mjs` 采集，不手写、不估算。

## 一、采集什么

| 分组 | 指标 | 回答的问题 |
|---|---|---|
| `build` | 主包总字节、`tar.gz`、cocos-js、wasm 分文件、文件数、png 数 | 功能裁剪到底省了多少体积；首包还有多少余量 |
| `engine` | `includeModules` 清单与数量 | 配置是否真的落盘生效、下次有没有被误改回去 |
| `source` | `layerCalls` / `labelCalls` / `clearCalls` / `cacheModeSets` / `dynamicAtlasRefs` / `sourceTextures` | 合图、图集、Label 缓存各自要动多少处；是**静态计数，不是实测 DrawCall** |
| `cpu` | 190 敌 + 48 飞剑 + 120 魂珠稳态单帧 tick 的 mean / p50 / p95 / p99 / max | 规则层 CPU 是不是瓶颈；空场对照可算每敌边际成本 |

CPU 场景把战场每帧钉回同一组敌人 / 飞剑 / 魂珠，固定 RNG 种子、固定 480 帧，只测 `SurvivorGame.tick` 本身。它是**Node 上的规则层耗时，不是真机帧率**，用于两次构建之间横向对比，不能替代微信开发者工具 Profiler。

## 二、怎么跑

```bash
# 采一份基线（默认写 docs/baselines/<label>.json）
node tools/profile-baseline.mjs --label <label> --out docs/baselines/<label>.json

# 对比两份，输出 Markdown
node tools/profile-baseline.mjs --compare docs/baselines/a.json docs/baselines/b.json \
  --md docs/baselines/compare.md
```

要求 Node 22+（直接 import `.ts`，靠内建 type stripping）；无需安装依赖。回归测试：`npm test`（`tests/baseline.test.mjs` 会守住裁剪配置与采集器）。

## 三、真机 Profiler 采集（本轮未实采，留给用户）

默认统计是关的，正式包没有额外开销。打开方式：

1. 微信开发者工具导入 `build/wechatgame`（AppID `wx050b09f415a8fc43`，`compileType=game`，`deviceOrientation=portrait`）。
2. 控制台执行一次：`wx.setStorageSync('goduck.profiler', '1')`，然后**重启小游戏**（开关在 `onLoad` 读取）。
3. 屏幕上出现引擎统计面板，控制台每 2 秒输出一行：
   ```json
   {"tag":"goduck.profile","mode":"mow","phase":"playing","enemies":187,"fps":58.2,"frameMs":17.1,"draws":96,"instances":...,"logic":...,"render":...,"textureMB":...,"bufferMB":...}
   ```
4. 分别采三个场景，每个至少 30 秒，复制 `goduck.profile` 行到下表：

| 场景 | 目标 | 记录 fps / frameMs / draws / textureMB |
|---|---|---|
| A 入口菜单 | 静态 UI 基线 | |
| B 割草 60–75 秒（190 怪满潮） | 最坏 DrawCall 与帧率 | |
| C 经典模式 60 秒 | 第二套渲染路径对照 | |

采完把开关关掉：`wx.removeStorageSync('goduck.profiler')` 并重启。

## 四、拿到数字后怎么定顺序（决策规则，不是结论）

- 若 B 场景 `draws` 明显高于「Graphics 图层数 + Label 数 + 同屏 Sprite 数」的合理量级，且 `textureMB` 有富余 → **先动态合图**（改动最小，一行开关级）。
- 若 `draws` 主要来自 59 张独立纹理、`frameMs` 里 `render` 占比高 → **先做 SpriteAtlas**（把 56 帧鸭子行走图合成一张）。
- 若 `logic` 高而 `draws` 不高 → **瓶颈在规则层 / Graphics 重绘**，合图和图集都不是第一优先级，参考 `cpu.horde.p95Ms` 与 `clearCalls`。
- 若 `frameMs` 已远低于 16.7ms、真机稳定 60fps，且 `textureMB` 紧张 → 两项都先不动，避免为不存在的瓶颈增加内存。

以上判断需要真机数字，**本轮只用本地基线确认「功能裁剪生效且没有破坏运行时」**，不代替上述决策。

## 五、文件

| 文件 | 说明 |
|---|---|
| `2026-11-14-before-crop.json` | 功能裁剪 / Profiler 开关之前 |
| `2026-11-14-after-crop.json` | 功能裁剪 + 竖屏重建之后 |
| `2026-11-14-compare.md` | 两次数采的逐项对比 |
