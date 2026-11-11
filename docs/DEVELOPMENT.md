# 修改与协作指引

## 文件职责

| 文件 | 用途 / 常见修改 |
| --- | --- |
| `assets/scripts/Game.ts` | 不依赖 Cocos 的战斗规则；装备、经验、刷怪、伤害、进化、Boss |
| `assets/scripts/GoDuck.ts` | Cocos 绘制、角色菜单、升级菜单、键盘 / 触摸输入、HUD |
| `assets/scripts/EditorHomePreview.ts` | 在编辑模式绘制静态场景；游戏运行时由 GoDuck 隐藏 |
| `assets/Home.scene` | 已保存 Canvas / UI Camera / GoDuck / EditorPreview 及组件绑定 |
| `tests/game.test.mjs` | 规则回归检查；用 npm test 运行 |
| `settings/` | Creator 项目设置 |
| `.agents/skills/` | 已有 Cocos 操作指引，供后续 AI 协作参考 |

## 常见需求改哪里

- 调怪物数量、出场节奏、首领时间：`Game.tick`、`Game.spawn`。
- 调装备 / 进化：`ITEMS`、`Game.options`、`Game.openChest`、攻击循环。
- 加武器：同步修改类型 / 配置、攻击逻辑、表现、菜单说明及测试。
- 改 UI / 图形：`GoDuck.menus`、`GoDuck.draw`；家园编辑器预览另见 `EditorHomePreview`。
- 改为真正守护鸡舍：先明确鸡舍生命、敌人目标、失败条件，随后同步实现与设计，不仅替换背景图。
- 扩至 6＋6：槽位判断目前硬编码 3，需要一并修改升级选项和界面，再验证三分钟成长。

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
