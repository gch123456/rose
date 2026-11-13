# 会话归档：Cocos 官方资源库调研与工程优化候选

日期：2026-11-14（北京时间）。工作区：`/Users/roygu/WorkBuddy/2026-11-12-14-03-29/`。起始提交：`6a89508`。

## 用户原话与范围

> 「你也可以去找cocos官方的素材库，找到有没有可以优化的地方」

按协作规则解读为**调研 + 找出可优化点**，不是授权改动玩法或引入素材。本轮**不改代码、不下载素材、不改构建配置、不重建微信产物**；只做核查、量化与登记。继上一轮 `docs/archive/2026-11-13-pixel-search-resource.md` 之后，把第三方素材线索扩展为「官方渠道能补什么」。

## 一、先澄清「官方素材库」是什么

| 渠道 | 性质 | 关键事实 |
|---|---|---|
| [Cocos Store](https://store.cocos.com) | **Cocos 官方运营的资源商城** | 商品由第三方开发者上传（插件 / 源码 / 美术 / 音效 / 模板），免费与付费并存；页面标 Creator 版本；下载走 Dashboard / 编辑器内置 Store |
| [官方示例与教程](https://docs.cocos.com/creator/3.8/manual/zh/cases-and-tutorials/) | Cocos 官方维护的开源工程 | `cocos/cocos-test-projects`（模块展示集合，v3.8.7 分支）、`cocos/cocos-example-ui`、`cocos/cocos-awesome-tech-solutions`（技术支持团队方案）、`cocos/cocos-example-projects` |
| [官方文档](https://docs.cocos.com/creator/3.8/manual/zh/) | 引擎能力与平台约束 | 动态合图、Label CacheMode、功能裁剪、微信小游戏发布、对象池 API |

**结论**：Store 不是「Cocos 官方原创美术库」。搜索到的免费 2D 素材包基本都是第三方 CC0 作品经上传者整理并适配 Creator（如 Kenney、CamTatz、Kenny），Cocos 提供的是平台与适配，不是版权来源。授权必须以**每个商品页的版权声明**为准，不能因为「在官方商城」就当成无限制商用。

## 二、项目现状量化（本轮实测）

| 项 | 实测值 | 出处 |
|---|---|---|
| 素材 | 59 张 png，`assets/resources` 488K；构建产物 61 张 | `find` / `du` |
| 微信包 | 未压缩 **5.0M**，tar.gz 约 1.32M | `du -sh build/wechatgame` |
| 引擎代码 | `cocos-js/` **3.6M**，其中 `_virtual_cc-*.js` 2.8M | `du` |
| **冗余模块** | `bullet.release.wasm.wasm` 458K、`spine-*.wasm` 200K、bullet asm/wasm js 约 26K，**合计约 700K** | `ls -lh build/wechatgame/cocos-js/` |
| 渲染 | `GoDuck.ts` 有 **8 处 `p.clear()`** 每帧重绘；`Graphics` 组件不参与合批 | 源码 |
| 敌人节点 | `enemySprites` 固定数组复用、上限 190，多余的 `active=false`，**已手写对象池语义，没有逐帧 `instantiate/destroy`** | `updateMowEnemies()` |
| 文本 | HUD / 飘字 / 技能栏约 30 个 `Label`，**未设置 `cacheMode`**（默认 NONE，每个 Label 单独 DrawCall） | 源码 |
| 合图 | **无** `CLEANUP_IMAGE_CACHE` / `DynamicAtlasManager` 设置；微信小游戏平台**默认禁用动态合图** | [官方动态合图文档](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/dynamic-atlas.html) |
| 音效 | `AudioContext` 运行时程序合成，未用 `AudioSource` / 音频资源 | `GoDuck.ts:467` |
| 构建配置 | `settings/v2/packages/engine.json` 与 `builder.json` 均只有 `__version__`，**功能裁剪用默认值（全开）** | 读文件 |
| 微信配置 | `game.json` 仅 `deviceOrientation` 与 `networkTimeout`；产物有 `assets/{internal,main,resources}`，无 `start-scene` 分包 | 读文件 |

## 三、优化清单（按收益 / 成本排序）

### P0 · 零美术风险、收益可量化，建议优先

1. **功能裁剪：剔除 3D 物理与 Spine**
   官方[物理选项文档](https://docs.cocos.com/creator/3.0/manual/zh/physics/physics-item.html)明确：项目不用物理组件时，可在「项目 → 项目设置 → 功能裁剪」取消物理系统勾选以缩小包体；`ammo.js` 模块约 1.5MB。本项目是纯 2D、碰撞全在 `SurvivorGame` 里手写，却把 Bullet + Spine 的 wasm 一起打进微信包，约 **700K 未压缩体积（占 5.0M 主包约 14%）**，且是启动时一次性加载。改法：编辑器里取消 3D 物理 / 3D 模块 / Spine，再用现有 `.tools/build-wechatgame.sh` 重建并对比体积。
   ⚠️ 未验证：命令行构建时功能裁剪的确切配置字段（当前 `engine.json` 无裁剪项），需在编辑器里改一次后观察落盘差异；裁剪后必须把两个模式都跑一遍，防止运行时报「模块不存在」。

2. **强制开启动态合图**
   官方给出可直接用的最外层代码（**不能写在 `onLoad`/`start` 里**）：
   ```ts
   macro.CLEANUP_IMAGE_CACHE = false;
   DynamicAtlasManager.instance.enabled = true;
   ```
   官方注明小游戏与原生平台默认禁用、内存有富余时建议开启；可参与合图的贴图默认宽高 < 512（本项目 48px 精灵全部满足）。59 张独立 `Texture2D` 是当前 DrawCall 的主要来源，这一条是**改动最小、最可能直接提升真机帧率**的动作。代价是额外内存，需真机验证。

3. **给 `Label` 设置 `CacheMode`**
   官方三种模式：`NONE`（默认，一个 Label 一个 DrawCall）、`BITMAP`（整段文本进动态图集，可与相邻 Sprite 合批，仅适合不常变的文本）、`CHAR`（按字符进 2048² 共享图集，适合频繁改文本，性能/内存最友好）。当前 HUD 数值与伤害飘字每帧变，适合 `CHAR`；固定标题/技能栏适合 `BITMAP`。注意 3.8 文档与 2.4 文档描述略有差异，且 `CHAR` 不能参与动态图集，落地时按 3.8.8 API 实测。

4. **把 56 帧鸭子行走图打成图集**
   目前 `resources.load('duck/manifest')` 后逐张 `resources.load(path + '/texture', Texture2D)`，56 次加载 + 56 张纹理。改为 `SpriteAtlas` / 自动图集（Auto Atlas），一次加载一张纹理并从帧取 `SpriteFrame`，既降 DrawCall 又减小 `settings` 映射。官方[性能建议](https://forum.cocos.org/t/topic/100971/3)还提醒：不需要动态加载的图别放 `resources/`，否则资源映射会撑大 `settings.js`。

5. **先用 Profiler 量一次再优化**
   `GoDuck.ts` 已 `import { profiler }` 并 `hideStats()`。先在真机/微信开发者工具里打开统计，记录 190 敌人时的 DrawCall 与帧率，再决定 P0 各项的取舍；没有基线不要凭感觉调。

### P1 · 中期工程优化（有改造成本）

| 方向 | 官方依据 | 对本项目的作用 |
|---|---|---|
| 四叉树碰撞 | `cocos-awesome-tech-solutions` → `Creator3.6.0_2D_QuadtreeCollision` | 190 敌人 × 数十飞剑 / 领域判定目前是双重循环，空间划分可显著降 CPU；方案是 3.6.0 工程，需自行移植到 3.8.8 的纯规则层 `SurvivorGame.ts` |
| Graphics 分层 | 官方 UI 合批说明：`Graphics` / `Mask` / `UIMeshRenderer` **无法与其他组件合批**并会打断合批 | 8 个 `Graphics` 每帧 `clear()` 重绘；把静态背景/地砖/HUD 边框改为「只在状态变化时重绘」或改成 Sprite/图集，能同时省 CPU 与 DrawCall |
| 官方 2D 光照 | `Creator3.6.0_2D_Light`（素材来自 CodeAndWeb） | 若采纳上一轮「沉没地牢」概念图里的水母发光/水下光柱，可参考其法线贴图光照做法；但 3.6 工程、需验证 3.8.8 与微信小游戏性能 |
| 缓动 / hit-stop | `Creator3.6.0_GameTimeScale`（tween 贝塞尔与变速）、官方 tween 系统 | 与已登记的 `pixelfx act` 时序、`animista` 缓动曲线是同一件事：给飘条/伤害数字/命中加弹性与顿帧，不改素材不改包体 |
| 音频 | `AudioSource` 组件 + 预加载（官方音频文档） | 当前 `AudioContext` 合成音效在微信小游戏里的兼容性与首次用户手势限制需真机确认；若要换，可配合下面的免费音效包 |
| 分包 / 首包 | 官方[微信小游戏发布文档](https://docs.cocos.com/creator/3.7/manual/zh/editor/publish/publish-wechatgame.html)：主包 ≤ 4MB、包内资源一次性加载、**初始场景分包** `startSceneAssetBundle`、分离引擎、WebGL2 默认强制关闭以缩包 | 当前 5.0M 未压缩、tar.gz 1.32M 未超限，但 P0 裁剪后仍有余量才谈分包；若后续加入沉没地牢背景大图，必须先规划 Asset Bundle |
| 纹理压缩 | 官方支持 PNG/JPG/WebP（减下载体积）与 ASTC/ETC（减运行时显存） | **像素风要慎用有损压缩**：48px 精灵与 1px 描边在低质量 ASTC 下容易出现边缘伪影，优先图集而非压缩 |

### P2 · 免费素材（补美术，非性能）

| 资源 | 内容 | 授权 |
|---|---|---|
| [免费通用 UI 素材](https://store.cocos.com/app/detail/4354) | Kenney UI Pack 精简版，146 张 PNG，五种配色按钮 / 面板 / 滑条 / 勾选框 | 原作者 Kenney **CC0**，可免费商用，无需署名；适配 Creator 3.6.2 |
| [免费 2D 卡通 UI 素材包](https://store.cocos.com/app/detail/4301) | 188 张 PNG（按钮 118 / 通用 31 / 符号 37 / 光标 2） | 原作者 CamTatz **CC0**；适配 3.6.0 |
| [平台游戏素材包](https://store.cocos.com/dashboard/detail/4285) | 数百个 2D 精灵、含敌人与角色**序列帧动画**、支持瓦片地图；角色/建筑/糖果/雪地/蘑菇/机关等分类 | 原作 Kenny **CC0**；适配 3.6 系列 |
| [极简移动 UI 音效包](https://store.cocos.com/app/detail/9490) | 20 个单声道 WAV，Creator 3.8.8+，程序化合成 | 免费、永久非独占免版税、可商用无需署名；**禁止把音效原样或改动后作为独立音效包/素材库转售分发**，同一成品项目内团队/客户可共用，跨项目需另行取得许可 |
| [UI 展示 Demo](https://github.com/cocos/cocos-example-ui) / [Store 2799](https://store.cocos.com/app/detail/2799) | 官方 UI 组件组合范例 | 可作当前手写 HUD / 摇杆 / 血条的替代实现参考 |

**与「沉没地牢」概念图的关系**：Store 里**没有**找到与 0x72 DungeonTileset II 规格一致的 16×16 地牢 tileset；上面这些是卡通/平台风格，直接混进当前 48px 像素鸭会串味。若以后真要替换成地牢像素，更对口的 CC0 资源在 OpenGameArt（`16x16 Puny Dungeon Tileset`、`Ever Rogue Tileset`，均 CC0 含墙/水/陷阱/传送门/动画火炬），但**不属于 Cocos 官方渠道**，须按第三方来源单独核对。上一轮 `concept-art/` 里那套自绘「沉没地牢」仍是零授权风险、可直接切图的方案。

### 架构参考（不引入，仅记录）

- 官方教程「Cocos Creator 零基础教程：**3D 俯视角 RPG 割草游戏**」（B 站合集），以及官方论坛四期「3.x 技术方案分享」。
- Store 付费源码 [《少女无双》](https://store.cocos.com/app/detail/9908)（Creator 3.8.0，竖屏割草完整工程：自动攻击、升级选宝、法宝搭配、本地存档、微信小游戏适配），适合读架构，不适合直接并入。
- 开源 [Slash-The-Hordes](https://github.com/xiaobc1234/Slash-The-Hordes)（Cocos 3.8.6，含 **Object pool / Modal / Event System** 示例，非官方）——其对象池写法可作 P1 参考，但本项目 `enemySprites` 已是固定数组复用，收益不如 P0。
- Store 付费 [98K 多纹理合批 3.x](https://store.cocos.com/app/detail/6587) 宣称对割草/弹幕类 2D 合批有效；**不建议现阶段引入**：第三方付费、需改材质与打包配置，先用官方动态合图 + 图集验证即可。

### 明确不适用

Spine / DragonBones（项目无骨骼动画）、3D 光照与后处理渲染管线（2D 割草）、[VideoTexture](https://github.com/cocos/cocos-awesome-tech-solutions)（官方明确**不支持微信小游戏**）、Marionette 动画状态机、TiledMap 寻路（当前没有 tilemap 关卡）。

## 四、授权边界（接入前必读）

- [Cocos Store 内容提交协议](https://store-my.cocos.com/cocos-store-submission-agreement.html)：上传者**保留作品所有权**并全权负责内容合法性，Cocos 获得可再许可的使用权，购买者可复制、改编、随成品游戏传播；[资源提交规范](https://store.cocos.com/document/zh/developer/cocos-store-resource-standard.html)要求实名与创作证明，侵权内容会被下架。
- 因此「免费」≠「无限制」，也≠「Cocos 背书版权」。每个商品页的版权声明、包内 LICENSE、以及 Cocos [用户协议](https://download.cocos.com/CocosUdc/agreement/Cocos_User_Service_Agreement_en_20220901.html) 与商城规则共同约束；官方[3D 模型资源模板](https://store.cocos.com/document/en/cocos-store-template-3d-model.html)示例里就包含「不得用于 UGC 平台 / Metaverse / NFT」这类额外限制。
- CC0 包（Kenney / CamTatz / Kenny）可商用、可修改、无需署名；音效包 9490 的限制见上表。
- 官方 GitHub 示例工程多为开源代码，但**工程内素材来源各异**（如 2D 光照 demo 素材来自 CodeAndWeb，FPS demo 素材来自 Unity AssetStore），不能直接当作可商用素材复制进包。

## 五、验证与未验证

**本轮已做**：读取 `AGENTS.md` / `README.md` / `STATUS.md` / `DESIGN.md` / `ROADMAP.md` / 最新归档；`git fetch origin`（工作区干净，`main` 与 `origin/main` 同为 `6a89508`）；核查官方文档、Store 商品页、官方 GitHub 仓库；实测源码与构建产物体积。纯文档变更，按协作规则不跑 `npm test`、不重建微信包。

**未验证 / 不要写成已完成**：未登录 Cocos 账号、未下载任何 Store 资源；未在 Creator 编辑器里实际执行功能裁剪，也未确认命令行构建对应的裁剪配置字段；未用 Profiler 采过真机 DrawCall / 帧率；动态合图、`Label.CacheMode`、图集改造均**未实施、未验证收益与内存代价**；官方技术方案 demo 多为 3.6.x 工程，未验证在 3.8.8 + 微信小游戏下可直接运行。

## 六、下一步建议

优先做 **P0-1（功能裁剪）** 与 **P0-5（真机 Profiler 基线）**，两者互不依赖且可量化；拿到基线后再决定 P0-2 / P0-3 / P0-4 的顺序。美术侧维持现状，除非用户明确要换皮到「沉没地牢」。任何一项落地都属于渲染 / 构建层改动，需重新跑 `npm test`、命令行重建微信竖屏产物并按 `AGENTS.md` 归档。

登记位置：[ROADMAP 工程优化候选](../ROADMAP.md)、[STATUS 本轮](../STATUS.md)、[CHANGELOG](../../CHANGELOG.md)。
