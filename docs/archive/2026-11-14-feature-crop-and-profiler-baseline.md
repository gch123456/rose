# 会话归档：功能裁剪 + Profiler 基线（2026-11-14）

日期：2026-11-14（北京时间）。工作区：`/Users/roygu/WorkBuddy/2026-11-12-14-03-29/`。起始提交：`201251a`（`main` = `origin/main`，工作区干净）。

## 用户原话与范围

> 「下一步先做「功能裁剪 + Profiler 基线」这两件互不依赖、可量化对比的事，拿到数字再决定合图和图集的顺序。你说一声我就开工，会照旧把测试、竖屏产物和远程一起同步。开工」

按协作规则解读为**明确授权实施**：两件事都做，产出可量化数字，同步测试、竖屏产物与远程；**不实施**动态合图 / Label CacheMode / SpriteAtlas（顺序要等数字）。

## 一、功能裁剪：先查证字段，不猜配置

上一轮归档里「未验证命令行构建时功能裁剪的确切配置字段」是本轮第一个要解决的未知项。证据来自本机免安装 Cocos Creator 3.8.8，不靠记忆：

| 证据 | 结论 |
|---|---|
| `CocosCreator.app/Contents/Resources/templates/empty-2d/settings/v2/packages/engine.json`（`__version__ 1.0.11`） | 功能裁剪落在 `settings/v2/packages/engine.json` 的 `modules.configs.defaultConfig`，含 `cache`（每个模块 `{_value: bool}`，可带 `_option`）、`includeModules`（真正打包的 feature id）、`noDeprecatedFeatures`、`flags`；外层 `modules.globalConfigKey = "defaultConfig"` |
| `templates/hello-3d-world/settings/1.2.0/packages/engine.json`（旧 1.0.1） | 旧版是 `modules.cache` + `modules.includeModules` 平铺结构，本项目 1.0.12 应使用 `configs` 结构 |
| `resources/3d/engine/cc.config.json` 的 `features` | 3.8.8 共 **55 个**可选 feature id，含 `physics-ammo` / `physics-2d-box2d` / `spine-3.8` / `spine-4.2` / `custom-pipeline` 等；`spine-3.8` 的 `modules: ["spine"]` 和 `physics-ammo` 是那两个 wasm 的来源 |
| `engine/bin/.declarations/cc.d.ts:51691 / 72215` | `Profiler.showStats()` / `hideStats()` / `isShowingStats()` 存在；`profiler.stats` 提供 `frame / fps / draws / instances / tricount / logic / physics / render / present / textureMemory / bufferMemory`，每项有 `counter.value` |
| 项目 `GoDuck.ts` 的 import 行 | 运行时真正用到 `Graphics / Label / Sprite / UITransform / Canvas / resources / Texture2D / SpriteFrame / JsonAsset / view / ResolutionPolicy / input / sys / game / profiler`，且 `onLoad` 调用 `profiler.hideStats()` |

因此写入 `settings/v2/packages/engine.json`：显式 14 个 `includeModules`（`base / gfx-webgl / gfx-webgl2 / 2d / ui / graphics / affine-transform / animation / audio / intersection-2d / particle-2d / profiler / tween / custom-pipeline`），`cache` 里把 3D、3D 物理、2D 物理、Spine / DragonBones、骨骼动画、Marionette、粒子(3D)、地形、光照探针、XR、遮挡查询、几何/调试渲染、TiledMap、Video、WebView、RichText、Mask、WebSocket、primitive 等全部置 `false`；`render-pipeline` 保持 `custom-pipeline`。

**构建后 Creator 自动把配置规范化**：`includeModules` 被排序，并自动补入 `ui-skew`（3.8.8 的 UI 依赖），最终 **15 个**。这不是手工添加，是编辑器自身修正，且构建成功。

## 二、Profiler 基线：可复现的本地数字 + 真机采集入口

用户要的是「拿到数字」，不是只装一个统计面板。因此分两层：

1. **本地可复现基线**：新增 `tools/profile-baseline.mjs`（零依赖、Node 22+ 直接 import `.ts`），`--label/--out` 采一份 JSON，`--compare A B --md` 出对比 Markdown。采集四类数字：
   - `build`：主包总字节、tar.gz、cocos-js 分文件、wasm 清单、文件数、png 数；
   - `engine`：显式模块清单与开关状态（无配置时标为 `defaultAll: true`，**不能记成 0 个模块**）；
   - `source`：静态计数 `layerCalls / labelCalls / clearCalls / resourcesLoads / cacheModeSets / dynamicAtlasRefs / sourceTextures`，作为合图 / 图集改造的工作量上界，**不是实测 DrawCall**；
   - `cpu`：把战场每帧钉回 190 敌 + 48 飞剑 + 120 魂珠的稳态，固定 RNG 与 480 帧，测 `SurvivorGame.tick` 单帧 mean / p50 / p95 / p99 / max，另跑空场对照。
2. **真机采集入口**：`GoDuck.ts` 的 `onLoad` 从 `sys.localStorage` 读 `goduck.profiler`，默认 `profiler.hideStats()`，为 `'1'` 时 `profiler.showStats()` 并在 `update` 里每 2 秒把 `fps / frameMs / draws / instances / logic / render / textureMB / bufferMB` 打成一行 `tag: 'goduck.profile'` 的 JSON，便于从微信开发者工具控制台直接复制。关闭时零额外开销；`profiler.stats` 为 null 时安全返回，不会崩。

采集方法、三场景记录表、以及「看哪些数字决定合图 vs 图集」的决策规则写在 [docs/baselines/README.md](../baselines/README.md)。**本轮没有真机实采数据**，不把本地 CPU 数字冒充帧率。

## 三、数字（裁剪前 → 裁剪后，同一采集器逐项对比）

| 指标 | 前 | 后 | 差值 | 变化 |
|---|---:|---:|---:|---:|
| 主包总字节 | 4.56 MB | **2.03 MB** | -2.54 MB | **-55.6%** |
| 主包 tar.gz | 1.24 MB | **620.0 KB** | -650.0 KB | -51.2% |
| cocos-js 字节 | 3.54 MB | **1.50 MB** | -2.04 MB | -57.6% |
| wasm 字节 | 706.9 KB | **0** | -706.9 KB | -100% |
| wasm 文件数 | 5 | **0** | -5 | -100% |
| 主包文件数 | 155 | 146 | -9 | -5.8% |
| png 数 | 61 | **61** | 0 | 素材一张没少 |
| 规则层 CPU p95（190 敌） | 0.5868 ms | 0.5605 ms | ±噪声 | 不计为收益 |

消失的 5 个 wasm 相关文件：`bullet.release.wasm-*.wasm` 458.5K、`spine-*.wasm` 200.4K、`bullet.release.wasm-*.js` 26.3K、`spine.wasm-*.js` 21.6K、`bullet.release.wasm-*.js` 0.1K。引擎 JS 从 2.8M `_virtual_cc-*.js` + 多个 wasm 胶水文件，收敛为单个 1.5M `cc.309d2.js`。

**CPU 行的波动是 Node 测量噪声**：功能裁剪只改引擎与构建配置，规则层一行代码未动，两次采集的 ±10% 差异不能算优化收益。它的用途是给后续合图 / 图集改造留同口径参照。

原始数据：[before](../baselines/2026-11-14-before-crop.json) / [after](../baselines/2026-11-14-after-crop.json)；逐项对比：[compare.md](../baselines/2026-11-14-compare.md)。`before` 的 `engine` 字段按采集器最终口径修正过（原值把「默认全量」记成了 0），`build / source / cpu` 是裁剪前实采原值。

## 四、验证

- `npm test` **102/102 通过**（原 95 项 + 新增 `tests/baseline.test.mjs` 7 项）。新增测试守住：裁剪配置必须保留 `base / gfx-webgl / 2d / ui / graphics / profiler / custom-pipeline`，必须不含 3D 物理 / Spine / DragonBones 等 16 个重模块，`cache` 开关与 `includeModules` 一致，渲染层保留 profiler 开关，采集器静态计数与分位数函数可用。
- Cocos Creator 3.8.8 命令行重建微信小游戏：`WECHAT_APPID=wx050b09f415a8fc43 ORIENTATION=portrait ./build-wechatgame.sh`，日志 `build Task (wechatgame) Finished in (1 min 5 s)`；`game.json deviceOrientation=portrait`、`project.config.json appid/compileType` 正确、61 张 png 在包内。
- **引擎 API 完整性**（防止裁掉运行时用到的模块）：新 `cc.309d2.js` 中 `hideStats 5 / showStats 5 / Graphics 16 / Label 124 / SpriteFrame 84 / UITransform 138 / resources 14 / ResolutionPolicy 8 / Profiler 7 / Canvas 36` 处引用全在；新代码 `goduck.profile`、`goduck.profiler`、`sampleProfiler` 已进包。
- 构建日志里 `window.json: Unexpected end of JSON input` / `Recovery window failed` 是 Creator 退出时编辑器窗口状态缓存的已知噪声，`debug ("false")`、`md5Cache ("true")` 的参数类型校验回退到预期默认值，均不影响产物（历次构建同样存在）。

## 五、未验证 / 不要写成已完成

- **真机 DrawCall、帧率、textureMemory 未采**；需要用户在微信开发者工具按 README 开启开关、跑满 90 秒并回填三场景数字。
- 双模式（割草 / 经典）在裁剪后的包里**未做完整一局试玩**，只验证了构建产物含两套逻辑且引擎 API 齐全。
- `profiler.stats` 在微信小游戏运行时能否稳定返回全部字段未实测（代码有 null 保护，最坏情况是只显示面板、不打 JSON）。
- 动态合图、Label CacheMode、SpriteAtlas **均未实施**，顺序仍等真机数字。
- `build/` 被 `.gitignore` 忽略，重建的竖屏产物只在本地 `rose/build/wechatgame`，不随 git 同步；远程同步的是配置、源码、基线数据与文档。

## 六、下一步

1. 用户按 [baselines/README.md](../baselines/README.md) 在微信开发者工具打开 `goduck.profiler`，采 A 入口 / B 割草满潮 / C 经典三个场景，各 ≥30 秒，把 `goduck.profile` 行回填。
2. 按 README 的决策规则，用 `draws`、`render` 占比、`textureMB` 决定 **P0-2 动态合图 → P0-3 Label CacheMode → P0-4 图集化** 的实际顺序；每做一项都用同一采集器再采一份 JSON 对比。
3. 数值调参、iPhone 真机 90 秒帧率、双模式切换仍为既有遗留项；沉没地牢与 PVZ 塔防方案未接入代码。

登记位置：[STATUS 本轮](../STATUS.md)、[ROADMAP 工程优化候选](../ROADMAP.md)、[CHANGELOG](../../CHANGELOG.md)。
