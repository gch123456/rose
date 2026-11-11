# GoDuck · 鸭命要紧（暂定名）

竖屏单手生存割草游戏，使用 Cocos Creator 3.8.8 + TypeScript。最新剧情方向：不同职业的鸭子自救，逃离被怪物变成鸭货的命运；通关解锁新角色，失败变成熟食。
已确认可爱像素与荒诞逃生喜剧的表现方向；项目代号仍为 GoDuck。
当前代码仍是鸡/鸭/鹅与农场占位场景的旧原型，尚未迁移剧情、全鸭职业或失败动画。玩家只负责移动，武器自动攻击；当前仍有暂停三选一，连续成长方案待实现。

## 开始试玩

1. 克隆仓库并初始化插件：`git submodule update --init --recursive`。
2. 使用 **Cocos Creator 3.8.8** 打开仓库，等待资源导入完成。
3. 在资源面板双击 `assets/Home.scene`；场景编辑器切换 **2D**，双击层级中的 `EditorPreview` 居中。
4. 点击顶部 ▶，在浏览器选择鸡、鸭或鹅。
5. WASD / 方向键移动；触屏按住拖动；Esc 暂停；升级点击或按 1/2/3。

无需攻击键。接近敌人自动攻击，走近绿色谷物拾取经验。编辑器中的画面是静态预览，游戏行为以运行后的预览为准。

规则测试使用支持直接执行 TypeScript 的 Node.js（本次验证版本 25.2.1）：`npm test`。
首次打开项目后，Creator 会生成 `library/`、`temp/` 等缓存，不需要上传。

## 文档入口

- [当前状态与下一步](docs/STATUS.md)
- [AI 与开发者协作规则](AGENTS.md)
- [跨设备同步与会话记录](docs/SYNC.md)
- [本机工具与 Cocos 安装 TODO](docs/TOOLS.md)
- [当前设计、数值与边界](docs/DESIGN.md)
- [最新鸭子自救主题](docs/superpowers/specs/2026-11-11-duck-escape-theme-design.md)
- [实现结构与修改指引](docs/DEVELOPMENT.md)
- [最新接续与同步约定](docs/archive/2026-11-11-repository-sync-session.md)
- [聊天、操作与验证归档](docs/archive/2026-11-10-session.md)
- [用户提供的前序聊天原文](docs/archive/2026-11-10-imported-chat.txt)
- [后续需求与已知问题](docs/ROADMAP.md)
- [更新记录](CHANGELOG.md)

## 开发协作

每次有新决定或改动，更新状态、相关设计/待办与独立会话记录，写明验证结果，再提交同步。用户已授权普通任务完成后的提交与推送。
本项目以 `main` 为协作基线；首次显式使用 `git clone --branch main --recurse-submodules https://github.com/gch123456/rose.git`，因为远程默认分支仍是 `master`。
其他电脑先在干净工作区拉取最新提交、初始化子模块，再用 Creator 打开项目；同时开发使用不同分支，详见 [同步指引](docs/SYNC.md)。编辑器需要在本机运行；Git 同步文件，不连接远程编辑器。

Funplay Cocos MCP 以 Git 子模块固定版本，遵循其 MIT 许可。本机 MCP 客户端配置不入库，请在插件面板重新配置；不要直接沿用另一台电脑的项目 URL。
