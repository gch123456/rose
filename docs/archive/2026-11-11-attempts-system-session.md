# 会话归档：开局次数系统（2026-11-11）

## 背景与授权

阶段 D 与结算演出完成后，用户从 ROADMAP 剩余方向中选定「开局次数系统」。参数沿用 STATUS 已记录的候选起点：**上限 5 次、每 10 分钟恢复 1 次、广告补 2 次**。既有方向约束（PERSISTENCE-NOTES / STATUS）：已有次数可离线开局；广告补次需联网——本轮广告为占位按钮，未接 SDK；不承诺防作弊与服务端对账。

## 实施（Superpowers：计划 → TDD → 实现 → 验证 → 归档）

计划：`docs/superpowers/plans/2026-11-11-attempts-system-plan.md`。

**存档升级 v1 → v2**（`SaveData.ts`）：
- 新字段 `attempts` / `attemptUpdatedAt`（恢复计时基准，ms）；常量 `MAX_ATTEMPTS=5`、`REGEN_MS=10 分钟`、`AD_BONUS=2`。
- `regenAttempts(save, now)`：按真实时间差整周期恢复，**离线也恢复**；零头保留（部分进度不丢）；满仓或恢复途中到达上限时基准滚到 now。
- `spendAttempt(save, now)`：先 regen 再扣 1；0 次拒绝、不出现负数。一局只在开局扣一次，暂停续局不重复扣。
- `grantAdBonus(save, now)`：占位广告发奖，先 regen 再 +2，**可超上限**（恢复仍封顶 5）。
- 迁移：合法 v1 → v2 满次数（老玩家不吃亏）；坏档/异版本 → v2 默认满次数。v1 的 unlocked 列表按原样信任迁移（真实老玩家进度不丢；本地存档本就不承诺防篡改）。

**UI**（`GoDuck.ts`）：
- 开始/再来一局按钮显示余次并在按下时扣次写入存档；暂停续跑不扣。
- 次数为 0：按钮换为「开局次数不足」禁用提示 + 占位按钮「看广告补 2 次」。
- 菜单底部每帧刷新 `开局次数 n/5 · 下 1 次 mm:ss`；挂在结算面板时同样显示。
- 次数从 0 恢复到可用时自动重建菜单（更新检测 `menuSig`），按钮状态不滞留。

## TDD 记录

`tests/attempts.test.mjs` 新增 9 项：默认满次数与常量、扣次与计时基准、0 次拒绝、整周期恢复+零头保留、多周期连恢复、长时间恢复封顶+时钟滚位、广告超上限、v1 迁移满次数、坏档回退、存取往返。先红（模块缺导出）后绿。

过程中修复两处：
- 实现：regen **中途**到达上限时未把 `attemptUpdatedAt` 滚到 now（与满仓分支不一致，会导致扣次后瞬间恢复）——已修。
- 旧测试：`save.test.mjs` 坏档回退断言 version 由 1 改 2（v1 现在是合法迁移输入而非坏档）。

## 验证

- `npm test`：**68/68 通过**（59 + 新增 9）。
- Creator TypeScript 诊断：**0 错误**。
- 预览 `localhost:7456`：全库 refresh 后确认 SaveData/GoDuck chunk 均编译进新代码（`regenAttempts` ×4、`attemptLine` ×2）。
- 未验证：真人试玩（扣除/恢复/占位广告的实际手感与倒计时显示）。

## 明确不做（留待正式版）

- 广告 SDK / 分享路径 / 联网校验与防重发（需服务端对账）。
- 次数账本与回拨检测（本地存档可改时间，不承诺防作弊）。
- 跨设备次数同步与账号体系。

## 同步状态

本地提交后经 SSH 快进推送 `origin/main`（通道为 2026-11-11 早前配置的 ed25519 密钥）。STATUS / ROADMAP / CHANGELOG 同步更新。
