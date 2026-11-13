# 会话归档：取消局内升级选择 · pixelfx 列入备选

日期：2026-11-13（北京时间）。工作区：`/Users/roygu/WorkBuddy/2026-11-12-14-03-29/`。

## 用户原话与决定

1. 「你特效用的什么，pixelfx 你听过吗」
2. 「**把pixelfx放入备选方案，然后不要打一半停下让玩家选效果**」

按协作规则，第二句拆成两件事：pixelfx **只登记为备选、本轮不实施**；局内升级选择**彻底移除**，战斗不再停顿。这一偏好其实早已记录在 `docs/STATUS.md` 的「已确认」区（「减少停顿选择 Buff，追求简单易懂、不停顿、更早割草」），本轮是第一次真正落地到割草模式。

## 一、特效现状核查（回答第一个问题）

| 层 | 文件 | 实际做法 |
|---|---|---|
| 逻辑 | `assets/scripts/SurvivorGame.ts` | 自己维护 `swords / particles / floats / effects` 四个数组与 `shake` 标量；`burst()` 就是往数组塞带速度/寿命的小方块 |
| 渲染 | `assets/scripts/GoDuck.ts` | 每帧 `Graphics.clear()` 后重画；`moveTo/lineTo` 画剑气、`circle/rect` 画光晕、`glow()` 用 7 层半透明圆叠辉光 |
| 预览 | `preview/renderer.js` | Canvas 2D 手画同一套状态 |
| 贴图 | `assets/resources/*.png` | 只有鸭子与敌人立绘（`SpriteFrame`）；**特效零贴图** |

结论：**code-drawn，但是临时搭的土办法** —— 没有调色板系统、没有种子化随机、没有帧动画、没有 hit-stop。未使用 Cocos `ParticleSystem` / `Animation` / `Tween`，未引入任何第三方特效库。

## 二、pixelfx 调研与「只登记、不实施」

`patch-gg/pixelfx`（2026-10-30 开源，MIT，代码与特效可商用；`gallery/fonts` 的 Patch Pixel 字体不在授权内，部分代码改编自 Hugo Duprez / Hollow Crown 的 MIT 项目，须保留 NOTICE）：

- 244 个 JavaScript 写出的像素特效，21 类；核心 API `createFrame / createFx / composite`，无第三方运行时依赖。
- 渲染模型：`color` + 加法 `light` 双缓冲、全种子化随机、局部坐标系、传 `palette`（暗到亮色阶）换色、可镜像旋转。
- 61 个带角色特效与 12 套招式带 `act` 时序数据：`hits: [{ t: 0.06, stop: 0.14, shake: 0.18, push: 2.8 }]`，即起手 → 命中冻结 0.14 秒 → 目标后仰 → 收招。**这才是「打击重量感」的关键，比多加粒子有效**。
- 可 `node tools/render.mjs <id> --sheet` 导出透明 PNG + Aseprite JSON 给 Godot / Unity / GameMaker 等。

**接入约束（不实施的理由）**：Cocos Creator 3.8.8 的微信小游戏运行时没有 DOM `ImageData` / `putImageData`，JS 运行时不能 import 后直接跑。网页预览页能跑，但会与微信产物分叉，不作主方案。若未来启用，推荐顺序是先把 `act` 时序当纯数据搬进规则层（零素材零包体），再离线烘焙关键特效为 sprite sheet 由 `Sprite` 播帧动画；不推荐每帧把 `composite` 输出上传 `Texture2D`（190 敌人同屏时纹理上传开销与帧率风险高）。

已写入 [`docs/ROADMAP.md` 备选方案节](../ROADMAP.md)，含触发条件：**真机帧率达标后、且用户明确要求提升打击感或替换手绘特效时再评审**。

## 三、升级流程改造（本轮唯一的功能改动）

### 规则层 `SurvivorGame.ts`

- 删除 `MowChoice` 接口、`pendingChoice` 字段、`openChoice()`、`chooseUpgrade()`，以及 `tick()` 开头「三选一期间世界完全冻结 / 15 秒自动拿第一张」的整个分支。
- `experience()` 现在只累加 `levelQueue`（以及升级粒子/特效），**不再发牌**。
- `tick()` 正常推进 `time` 之后：
  ```ts
  if (this.levelQueue > 0 && this.time >= this.upgradeReadyAt) {
      this.levelQueue--;
      if (this.autoUpgrade()) this.upgradeReadyAt = this.time + .42;
  }
  this.upgradeToasts = this.upgradeToasts.filter(t => (t.life -= dt) > 0);
  ```
  跨多级时每 0.42 秒发一项，飘条错开、音效不叠爆、绝不暂停。
- `autoUpgrade()`：只从 `lv < max` 的池子里按 `weight = 1 / (1 + lv * 0.9)` 加权随机 —— 等级越低越容易被选中，六格技能栏均匀成长，也不会一口气点满单项。
- `applyUpgrade(id)` 改为公开：立即生效、尊重 max、写 `MowUpgradeToast`（最多 3 条，life 2.2s）、发音效事件、放升级粒子。`spirit` 的 `experience(25)` 只累加 `levelQueue`，下几次 tick 消费，**不递归**。升级不再调用 `announce()`，中央播报条让回波次/救鸭信息。
- 无敌时间从原来的 0.5s 降到 0.18s（自动成长不该让玩家常驻免伤）。

### 表现层 `GoDuck.ts` / `preview/renderer.js`

- 删掉 `cardIcon / cardTitle / cardDesc / cardLevel / cardHint`、`mowCardY / mowCardAt`、键盘 1/2/3 选卡、触屏点卡拦截、全屏遮罩与 `drawMowChoiceCards()`。
- 新增 `upgradeLabels`（3 个 Label 池）与 `drawMowUpgradeToasts()`：右上角滑入式小胶囊，纯展示，**不铺遮罩、不拦输入、不冻结世界**。
- 技能栏、摇杆、中央播报条不再因「有选择」而隐藏；底部提示改为「捡绿色魂珠自动成长 · 每 N 次击退多救 1 只鸭」。
- 网页试玩加 `?upgrade=1` 调试参数强制显示一组飘条用于画面验收。

## 四、验证

- `npm test` **95/95**（割草 19 项重写 + 经典 76 项零回归）；新增/改写覆盖：升级不冻结时钟、怪潮继续刷新、一次多级不吞、不超 max、飘条池上限与过期、`spirit` 不递归、`applyUpgrade` 公开可复用。
- `tsc --strict`（规则层）与带 `cc` 桩的渲染层检查均 0 错误。
- `node tools/build-preview.mjs` 生成自包含 `preview/mow.html`（58.7 KB），内联 JS `node --check` 通过。
- 无头 Chrome 目视验收多轮：修掉了「升级信息被中央播报条重复显示」与「调试飘条停在滑入途中被右侧裁切」两个问题；最终截图确认无全屏遮罩、无三选一弹窗、战斗持续、怪潮与剑气正常、右上角飘条完整。
- Cocos 3.8.8 命令行重建微信竖屏产物：真实 AppID、`compileType=game`、`portrait`，61 张素材。

## 五、遗留与边界

- 真机（iPhone 17 Pro Max）完整 90 秒、190 只敌人帧率、双模式切换、自动成长的数值手感仍未验收。
- 自动成长是**加权随机构筑**，玩家局内不再有任何选择；如果想保留构筑决策，只能放到局前配置（`applyUpgrade()` 已为此公开），本轮未做。
- 经典模式 `EscapeGame.ts` 的历史选择流程一行未动，仍保持原样。
- pixelfx 未成为依赖，未改动渲染模型，未引入任何素材。
