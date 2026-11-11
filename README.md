# GoDuck · 鸭命要紧（暂定名）

竖屏单手生存割草游戏，使用 Cocos Creator 3.8.8 + TypeScript。最新剧情方向：不同职业的鸭子自救，逃离被怪物变成鸭货的命运；通关解锁新角色，失败变成熟食。
已确认可爱像素与荒诞逃生喜剧的表现方向；项目代号仍为 GoDuck。
**当前可试玩：V0.2 阶段 B，150 秒射手鸭成长小样。** 捡谷粒自动升级；25 秒掉落长线/散射分支，70 秒掉落泡泡圈/飞羽辅助，走近二选一，超时自动装备；120 秒主武器进化。新增范围群伤、锅盖地面预警和两次治疗补给。Boss、职业解锁和正式次数尚待 C/D；实验结束不代表正式通关。旧 Game.ts 保留作历史测试。

## 开始试玩

1. 克隆仓库并初始化插件：`git submodule update --init --recursive`。
2. 使用 **Cocos Creator 3.8.8** 打开仓库，等待资源导入完成。
3. 在资源面板双击 `assets/Home.scene`；场景编辑器切换 **2D**，双击层级中的 `EditorPreview` 居中。
4. 点击顶部 ▶，在浏览器点击“开始成长试玩”。
5. WASD / 方向键移动；触屏按住拖动；Esc 暂停；点击左上声音开关控制音效。

无需攻击键。接近敌人自动攻击，走近金色谷粒获得经验、自动升级；走近装备标记选择分支或辅助（战斗不停顿）。编辑器中的画面是静态预览，游戏行为以运行后的预览为准。

规则测试使用支持直接执行 TypeScript 的 Node.js（本次验证版本 25.2.1）：`npm test`。
首次打开项目后，Creator 会生成 `library/`、`temp/` 等缓存，不需要上传。

## 文档入口

- [当前状态与下一步](docs/STATUS.md)
- [AI 与开发者协作规则](AGENTS.md)
- [跨设备同步与会话记录](docs/SYNC.md)
- [本机工具与 Cocos 安装 TODO](docs/TOOLS.md)
- [当前设计、数值与边界](docs/DESIGN.md)
- [V0.2 第一关玩法重设计评审稿](docs/superpowers/specs/2026-11-11-core-gameplay-v02-design.md)
- [V0.2 试玩实验卡](docs/playtests/2026-11-11-v02-experiments.md)
- [最新鸭子自救主题](docs/superpowers/specs/2026-11-11-duck-escape-theme-design.md)
- [实现结构与修改指引](docs/DEVELOPMENT.md)
- [最新实施与验证记录](docs/archive/2026-11-11-growth-b-implementation-session.md)
- [聊天、操作与验证归档](docs/archive/2026-11-10-session.md)
- [用户提供的前序聊天原文](docs/archive/2026-11-10-imported-chat.txt)
- [后续需求与已知问题](docs/ROADMAP.md)
- [更新记录](CHANGELOG.md)

## 开发协作

每次有新决定或改动，更新状态、相关设计/待办与独立会话记录，写明验证结果，再提交同步。用户已授权普通任务完成后的提交与推送。
本项目以 `main` 为协作基线；首次显式使用 `git clone --branch main --recurse-submodules https://github.com/gch123456/rose.git`，因为远程默认分支仍是 `master`。
其他电脑先在干净工作区拉取最新提交、初始化子模块，再用 Creator 打开项目；同时开发使用不同分支，详见 [同步指引](docs/SYNC.md)。编辑器需要在本机运行；Git 同步文件，不连接远程编辑器。

Funplay Cocos MCP 以 Git 子模块固定版本，遵循其 MIT 许可。本机 MCP 客户端配置不入库，请在插件面板重新配置；不要直接沿用另一台电脑的项目 URL。
