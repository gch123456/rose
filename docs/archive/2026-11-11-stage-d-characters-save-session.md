# 阶段 D 实施记录：三职业解锁 + 版本化存档

日期：2026-11-11（北京时间）。执行：WorkBuddy Agent（Superpowers 流程：计划 → TDD → 实现 → 验证 → 归档推送）。

## 决定

- 用户在阶段 C 推送完成后要求「继续开发下一阶段」，即设计稿中的 D：职业解锁与存档。沿用已评审的 `2026-11-11-core-gameplay-v02-design.md`，不再重开头脑风暴。
- 上一轮遗留的 GitHub 推送问题已在本轮开头解决：GitHub 连接器按需安装被平台「私有网络下载限制」拒绝（`refusing private-network download url`），改走 SSH——生成 ed25519 密钥入钥匙串、用户在 GitHub 添加公钥、origin 切换为 `git@github.com:gch123456/rose.git`，阶段 C 的 3 个提交（含归档状态更新 `101c4d8`）全部推送成功。此后推送一律走 SSH。
- 存档为独立纯模块 `assets/scripts/SaveData.ts`，通过注入的写函数落盘（Cocos 侧 `sys.localStorage`），Node 可直接测试。

## 实现

### 存档（SaveData.ts，新文件）

- 版本化格式 `{ version: 1, wins: {shooter,warrior,mage}, unlocked: [Character], current }`，`SAVE_KEY = 'goduck-save'`。
- `loadSave`：空/坏 JSON/版本不符/缺字段 → 回退默认档；合法档信任其 unlocked 列表，但 `current` 必须在 unlocked 内，否则钳回 `shooter`——篡改存档不能解锁职业。
- `recordResult(save, character, won)`：仅首次胜利记 wins 并沿固定链解锁（射手胜→战士，战士胜→法师）；失败不动；重复结算不重复发奖。返回新增解锁列表供 UI 提示。
- `recordStart`：只能切到已解锁职业，同时保存 current。
- `persist`：整个载荷单次 write 调用（原子保存）。

### 职业规则（EscapeGame.ts）

- 新增 `Character`（shooter/warrior/mage）与 `BranchKey`（line/spread/wide/heavy/blast/chain）；`character` 由 UI 在 `start()` 前注入。
- 基础数值：射手 12/0.55s/280 射程；战士 18/0.75s/斩击 100 射程 120° 正面；法师 12/0.9s/260 射程水泡爆裂 65。等级缩放沿用（+8% 伤害/级、偶数级 +4% 攻速）。
- 战士分支：宽斩 220°、重斩 125 射程/90°/1.6D/间隔 ×1.3；进化：宽斩两层全周弧（每敌合计 1.6D）、重斩 1.6D 斩 + 0.96D 延伸震波（半径 165，同一次攻击不重复命中同一目标）。
- 法师分支：爆裂进化半径 105 两段合计 1.6D；连锁爆裂半径 50，向 100 内未命中过的敌人跳 2 次（进化 4 次）各 0.8D，按距离排序保证确定性。
- 进化后单目标每轮上限 = 进化前 1.6 倍（宽斩 1.6D、重斩 2.56D=1.6×1.6D、连锁首目标 1.6D），单目标可实际打满。
- 分支二选一按职业生成选项（line/spread、wide/heavy、blast/chain），15 秒超时默认长线/宽斩/爆裂；辅助（泡泡圈/飞羽）三职业通用，泡泡伤害随职业 D 缩放。
- 效果新增 `slash`（带 half 角，宽斩进化为全周双层）与 `burst`（目标点水花）两类，`GameEffect.angle?` 可选字段。

### 表现层（GoDuck.ts）

- 主菜单选角：三职业按钮，未解锁显示「🔒 未解锁」；点选即 `recordStart` + 落盘；开始按钮注入 `game.character`。
- 胜利结算时调用 `recordResult`，新解锁在结算副标题显示「新解锁：战士鸭！」等；存档在选角与胜利两处落盘。
- 武器名、进度条超时默认提示、装备标签按职业区分；斩击扇形/全周弧光与爆裂水花特效绘制。
- 职业区分暂沿用现有像素鸭贴图，无新美术（按计划）。

## 验证

- TDD：先写 `tests/save.test.mjs`（8 项：默认档/解锁链/防重复/坏档回退/钳制/原子写/键名）与 `tests/character.test.mjs`（14 项：战士弧形/射程/分支/双形态进化、法师爆裂/连锁/预算、等级缩放、辅助兼容、按职业二选一），确认 14 红。
- 实现后 `npm test` **58/58 通过 0 失败**（旧 35 项 + 新 23 项）。测试期间修了两处实现缺口：宽斩分支漏配 220° 半角（曾用 120°），以及测试帮手 `close` 参数顺序问题（属于测试脚本自身）。
- Creator TypeScript 诊断 **0 错误**（修复 3 处：`GameEffect` 接口抽取、`Graphics.arc` 第 6 参）。
- Cocos MCP `asset-db refresh-asset` 后确认 localhost:7456 三个 bundle（EscapeGame/SaveData/GoDuck）均编译进 D 阶段代码。
- 未做：完整真人试玩（解锁链需要两次 180 秒通关）、iPhone 真机验证；近战 100 射程在现刷怪节奏下的强度数值为调参起点。

## 归档与同步

本记录与 STATUS / ROADMAP / DESIGN / CHANGELOG 同步更新；只暂存本任务明确修改的文件；提交前检查 `git diff --cached` 并保持快进推送 `main`（SSH 已通）。
