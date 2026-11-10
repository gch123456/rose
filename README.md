# GoDuck · 家园保卫战

鸡鸭鹅主角的三分钟生存游戏原型，使用 Cocos Creator 3.8.8 + TypeScript。
玩家只负责移动，武器自动攻击；拾取谷物升级，搭配装备、开箱进化，最终击败首领。

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

- [当前设计、数值与边界](docs/DESIGN.md)
- [实现结构与修改指引](docs/DEVELOPMENT.md)
- [聊天、操作与验证归档](docs/archive/2026-11-10-session.md)
- [用户提供的前序聊天原文](docs/archive/2026-11-10-imported-chat.txt)
- [后续需求与已知问题](docs/ROADMAP.md)
- [更新记录](CHANGELOG.md)

## 开发协作

每次改动同步更新设计或后续清单，在更新记录写清改了什么及如何验证，再提交推送。
其他电脑先拉取最新提交、初始化子模块，再用 Creator 打开项目。编辑器需要在本机运行；Git 同步文件，不连接远程编辑器。

Funplay Cocos MCP 以 Git 子模块固定版本，遵循其 MIT 许可。本机 MCP 客户端配置不入库，请在插件面板重新配置；不要直接沿用另一台电脑的项目 URL。
