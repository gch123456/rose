# 修改与协作指引

## 文件职责

| 文件 | 用途 / 常见修改 |
| --- | --- |
| `assets/scripts/EscapeGame.ts` | 当前阶段 B 的独立规则：弹道、刷怪、夹子状态机、生命、掉落、经验/装备/群伤/进化、150 秒结束 |
| `assets/scripts/Game.ts` | 保留的旧原型规则；装备、经验、进化、Boss，不再用于默认入口 |
| `assets/scripts/GoDuck.ts` | 当前战斗绘制、实验菜单、键盘 / 浮动摇杆输入、暂停、声音与 HUD |
| `assets/scripts/EditorHomePreview.ts` | 在编辑模式绘制静态场景；游戏运行时由 GoDuck 隐藏 |
| `assets/Home.scene` | 已保存 Canvas / UI Camera / GoDuck / EditorPreview 及组件绑定 |
| `tests/growth.test.mjs` / `tests/escape.test.mjs` / `tests/game.test.mjs` | 当前阶段 B 与旧规则回归检查；用 npm test 一并运行 |
| `settings/` | Creator 项目设置 |
| `.agents/skills/` | 已有 Cocos 操作指引，供后续 AI 协作参考 |

## 常见需求改哪里

- 调阶段 B 敌人、刷怪节奏与 150 秒时长：`EscapeGame.wave`、`EscapeGame.tick`；同步实验卡与回归测试。
- 调基础谷粒弹、穿透、生命及掉落：`EscapeGame.tick`、`EscapeGame.hit`。
- 改 UI、轮廓、预警、合成音：`GoDuck.menus`、`GoDuck.draw`、`GoDuck.sound`；编辑器静态预览另见 `EditorHomePreview`。
- 成长见 `EscapeGame.experience`、装备见 `updateChoice` / `resolveChoice`、群伤见 `attacks`；Boss 与职业解锁按 C/D 逐步接入当前模型，不直接把旧 Game 的 3＋3 和配方视为新规则。
- 当前程序图形与声音为反馈占位；正式像素资产、鸭货结算动画尚未接入。

## Cocos 编辑注意

场景 / Prefab / meta 通过 Creator 或已核对项目身份的 MCP 修改，保留 UUID；不要手工复制 meta。
运行时 UI 在脚本中创建，当前并非可逐个拖动编辑的完整 UI Prefab。若后续要求可视化编辑完整界面，需要迁移为保存的节点 / Prefab。
修改脚本后等待导入，运行 TypeScript 检查，再预览验证；规则测试通过不代表触控、性能或完整一局体验通过。

## 本机 MCP 与跨终端

本次使用 Funplay Cocos MCP 0.7.2，插件锁定为子模块提交 `ada05622344e2a296becbe29eeb8653db216a70b`。
保持 Creator 和 MCP 服务开启，从插件面板获取当前项目地址并配置客户端。地址包含项目身份，不可假设跨电脑相同。
`funplay-cocos-mcp.config.json` 包含本机路径与端口，已忽略；插件可重新生成。外部 Codex 配置不属于游戏仓库。

Git 同步：换电脑前提交 / 推送；另一台先拉取，执行 `git submodule update --init --recursive`，再打开 Creator。
不要同时在两个终端修改同一个场景后直接覆盖，先合并代码并在编辑器中检查引用。

完整的交替/并行分支流程见 [SYNC.md](SYNC.md)。每次接手先读 [STATUS.md](STATUS.md) 与根目录 [AGENTS.md](../AGENTS.md)，每次有新决定或改动时新增会话归档并更新状态，验证后提交同步。
Superpowers 在每台机器分别安装/启用；设计和实施计划保存到仓库 `docs/superpowers/` 对应目录，实际创建任务时再新增。Git 不会同步本机的技能安装或聊天上下文。

## 敌人像素资源

assets/resources/enemies保存glove/clip/lid三张原始PNG及Creator meta。GoDuck.loadEnemies/updateEnemies负责最近邻纹理与最多160个复用Sprite；draw保留危险提示与缺图回退。修改敌人素材不应顺带改规则/存档，静态资源方向偏移要与预警方向一起验证。
