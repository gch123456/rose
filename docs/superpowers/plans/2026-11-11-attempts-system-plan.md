# 实施计划：开局次数系统（2026-11-11）

设计依据：STATUS「有限开局次数＋广告/分享补充为已确认方向」；参数「上限 5 次、每 10 分钟恢复 1 次、广告补 2 次」为用户本轮选定起点。既有次数可离线开局；广告补次为占位（未接 SDK，联网校验留给正式版）。已有存档为 v1，需版本迁移。

## 规则（全部落在 SaveData.ts 纯函数，Node 可测）

- 存档升到 **v2**：新增 `attempts`（当前次数）、`attemptUpdatedAt`（恢复计时基准，ms）。
- 常量：`MAX_ATTEMPTS = 5`、`REGEN_MS = 10 分钟`、`AD_BONUS = 2`。
- `regenAttempts(save, now)`：
  - 次数 < 上限时，每满 10 分钟恢复 1 次，`attemptUpdatedAt` 按整周期推进（保留零头，不重置进度）；
  - 次数 ≥ 上限时，`attemptUpdatedAt` 归位为 now（为下次扣次后计时）；
  - 恢复按真实时间差计算 → **离线也会恢复**。
- `spendAttempt(save, now)`：先 regen；次数 > 0 才扣 1 并返回 `{ ok: true, save }`，否则 `{ ok: false, save }`。开局按钮在 ok 时才进入游戏。
- `grantAdBonus(save, now)`：占位广告完成回调；先 regen 再 +2，可超过上限（恢复仍封顶）。
- 迁移：合法 v1 → v2 满次数（老玩家不吃亏）；坏档/异版本 → v2 默认满次数。
- 失败/胜利都**不返还、不额外扣**次数（一局一次，符合 PERSISTENCE-NOTES「不惩罚性扣次」）。

## UI（GoDuck.ts）

- 主菜单：显示开局次数（♥ 计数 / 5）；未满时显示下一恢复倒计时 `mm:ss`。
- 「开始逃跑」按下时扣 1 次；次数为 0 时按钮变为禁用的「开局次数不足」，并出现占位按钮「看广告补 2 次」直接发奖。
- 局内不再显示次数；结算不涉及次数。

## 步骤

1. TDD 先红：`tests/attempts.test.mjs`（默认满、扣次、0 次拒绝、整周期恢复+零头保留、封顶、广告超上限、v1 迁移）。
2. 实现 SaveData.ts：`SAVE_VERSION = 2`、新字段、三个纯函数、迁移分支（既有测试对 v1 坏档的断言随新规则改写）。
3. GoDuck.ts：菜单次数行 + 倒计时 + 扣次接入 + 占位广告按钮。
4. 验证：`npm test` 全绿、Creator TS 诊断 0 错误、预览 bundle 编译确认（全库 refresh + 等待）。
5. 归档 `docs/archive/2026-11-11-attempts-system-session.md`，更新 STATUS / ROADMAP / CHANGELOG，SSH 提交推送。

## 明确不做（留待正式版）

- 不接广告 SDK / 分享路径（联网校验、防重发、服务端对账）。
- 不做次数账本与回拨检测（本地存档可被改时间，PERSISTENCE-NOTES 已声明不承诺防作弊）。
- 不做跨设备次数同步。
