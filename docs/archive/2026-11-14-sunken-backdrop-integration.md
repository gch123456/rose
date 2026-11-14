# 2026-11-14 · 沉没地牢像素背景接入

## 背景与触发

用户在试玩编译产物时问：「不对啊，我改的像素风的背景和那些像素插件的呢？」

核实结论（全部属实、无丢失）：
- 沉没地牢概念图 ×8（DungeonTileset II + 水下风，`concept-art/01–08`）**只是概念稿**，从未进入 `rose/` 仓库与微信包；
- pixelfx 按用户指示停在「备选方案」；pixel-search 只做了来源/授权登记。

经确认，用户选择「接入沉没地牢背景（推荐）」：菜单/结算用标题图，割草局内用水下遗迹图。

## 实施

### 贴图
- `concept-art/01-sunken-ruins-arena.png`（640×1120, 22K）→ `assets/resources/bg/sunken.png`（局内）
- `concept-art/03-title-keyart.png`（640×1120, 15K）→ `assets/resources/bg/title.png`（菜单）
- 02 深穴图与 04 tileset 本轮未入包（留作后续场景/单位 sprite 素材）。

### GoDuck.ts
- 字段：`bgSprite / bgFrames(Map) / bgKey`。
- `loadBackdrops()`：`PixelBackdrop` 节点 `setSiblingIndex(0)` 压到最底层（Backdrop 程序绘制之下），Sprite CUSTOM+SIMPLE，异步 `resources.load('bg/sunken'|'bg/title', Texture2D)`，NEAREST；加载失败 `console.warn` 并保持程序天空回退。
- **加载时序坑**：`resize()` 首次绘制程序天空在贴图加载完成之前，若不处理，`bgPen`（层级高于贴图）会永久盖住贴图。解法：贴图回调里 `bgKey = ''` 强制重切 + `mode==='mow'` 时重调 `drawBackdropMow()`。
- `syncBackdrop()`（每帧调用）：割草 menu → `title`、其余 → `sunken`、经典 → 关闭贴图；cover 缩放 `Math.max(w/640, h/1120)` 防像素变形。
- `drawBackdropMow()`：贴图就绪时只叠暗角（抽出 `vignette()` 复用）；未就绪走原程序天空。
- `drawGroundMow()`：草地 → 浅水石板棋盘（`Q.floorA #C6DADE / floorB #B0C2CC / floorLine #7A94B2 / floorShade #566E8E / glowSpot #B2FAF4`，与 `make_tileset.py` 调色板一致），白花 → 青光斑；alpha 235→225 让贴图微透。
- 经典模式（`drawBackdrop` / PAL）完全未动。

### 预览端
- `tools/build-preview.mjs`：两张贴图 base64 内联（`window.__GODUCK_BG`），mow.html 保持单文件自包含（86→110KB）。
- `preview/renderer.js`：`backdrop()` 贴图优先（menu→title，局内→sunken）+ 暗角；`C.grassA/B/Line` 改沉没配色、花改 `glowSpot`。
- 既有调试入口 `?auto=1&fast=N` 复用于截图验收。

## 验证

- `npm test` 102/102。
- 无头 Chrome 截图：菜单（title 图 + 卡片可读）、局内 30 秒（石板地面 + 遗迹边缘 + 实体清晰）均正常。
- 微信竖屏产物重建（AppID `wx050b09f415a8fc43`、portrait、63 张 png、0 wasm）。

## 未做 / 后续

- 结算页仍用 sunken 图（未单独配图）；02 深穴、04 tileset sheet、PVZ 概念图未接入。
- 真机帧率与 Profiler 三场景数据仍待用户回填（决策合图 vs 图集顺序）。
- 若后续把 tileset 切成单位 sprite，应按 Cocos 调研结论直接打 SpriteAtlas。
