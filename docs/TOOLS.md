# 工具接入与跨设备 TODO

记录日期：2026-11-11（北京时间）。每台设备分别核实工具、路径和认证，不能复制另一台电脑的本机配置。

## PixelLab：本机 MCP 可调用，首张小样已生成

用户最新要求“先预装一下PixelLab和mcp”，取代此前延后本机接入的决定。

- PixelLab 使用官方远程 MCP，地址 `https://api.pixellab.ai/mcp`；本轮没有安装额外桌面图像软件或 npm 桥接。
- 原型 Mac 已在本机 Codex 配置注册 `pixellab`，备份配置并确认原有设置全部保留、配置/备份仅本人可读。
- 实际验证：服务初始化成功，PixelLab MCP Server 0.2.0，工具目录138项；预装时只读 `get_balance` 返回401；用户随后提供密钥，现已安全写入本机私有配置并通过只读余额认证。
- Token仅在本机私有配置，未进入仓库；重启后当前聊天已实际调用MCP并生成首张射手鸭小样（1次生成），没有购买或订阅。
- 当前工具链已跑通，样例见 [射手鸭小样](art-samples/2026-11-11-shooter-duck/README.md)；后续先确认造型，再做方向/动画与批量素材。
- 本机全局 `codex` 启动器缺少其可执行文件，本轮用桌面应用内置CLI 0.167.0-alpha.3.2完成注册；没有顺带更改全局CLI安装。
- 操作与验证见 [本机预装记录](archive/2026-11-11-pixellab-preinstall-mac-session.md)。以前移除配置的记录保留为历史，不再代表当前Mac状态。

### 认证与其他电脑的接续 TODO

- [x] 原型Mac已注册官方HTTP MCP并验证服务可达。
- [ ] 其他电脑拉取 `main` 最新文档，检查目标电脑现有工具和配置，不直接复制本机Codex配置。
- [ ] 用 `codex --version`、`codex mcp add --help` 核对目标客户端支持；支持原生 HTTP 时执行下方命令，无须 npm 桥接。
- [x] 原型Mac：用户提供密钥后已完成Bearer认证与只读余额验证。
- [ ] 其他电脑：在 [PixelLab](https://www.pixellab.ai/signin) 登录，确认账号MCP权限与额度。
- [ ] 从 [官方 MCP 页面](https://www.pixellab.ai/mcp) / 账户页面取得账户 Token，在目标电脑完成认证配置；不要发到聊天、写入项目文档或提交 Git。
- [ ] 为目标电脑的 HTTP MCP 配置 `Authorization` Bearer 头，或使用 `bearer_token_env_var` 引用该电脑的环境变量。环境变量必须在启动 Codex 的进程中可见，单独终端 export 不代表已运行的桌面应用能读取。
- [x] 原型Mac重启后当前聊天已发现PixelLab工具并实际调用。
- [ ] 其他设备分别重新加载并验证自己的工具连接。
- [x] 原型Mac通过MCP只读余额验证并生成首张全鸭主题静态小样。
- [ ] 确认造型、方向与动画连续性，再扩展素材。

```bash
codex mcp add pixellab --url https://api.pixellab.ai/mcp
```

该命令只注册服务器，不包含账户认证。配置可保护为仅本人可读；不得把真实认证头复制进下面的示例或仓库。

无密钥的配置结构示例（不是已配置认证的证明）：

```toml
[mcp_servers.pixellab]
url = "https://api.pixellab.ai/mcp"
bearer_token_env_var = "PIXELLAB_API_KEY"
```

原型Mac已配置URL及私有Bearer认证；上例只说明可选环境变量结构，不含真实Token，也不代表本机采用该环境变量方式。

## Cocos：原型 Mac 已可用，其他设备分别配置

- [x] 原型Mac已核实Creator **3.8.8**、MCP和Home场景，完成A/B网页及类型检查。
- [ ] 其他设备安装与项目匹配的Creator **3.8.8**。
- [ ] 使用 Creator 打开本仓库，等待导入完成，生成 `library/`、`temp/` 等本机文件；这些不提交。
- [ ] 打开 `assets/Home.scene`，切换 2D 并核对编辑器预览。
- [ ] 确认子模块 `extensions/funplay-cocos-mcp` 已初始化，使用仓库固定版本；从本机插件面板取得项目地址并配置客户端。
- [ ] 连接前核对项目名称、路径、身份与场景，不沿用另一台设备的端口或项目 URL。
- [ ] 执行引擎 TypeScript 诊断与网页预览，检查触屏拖动、角色菜单、升级及完整一局。
- [ ] 在目标 iPhone 上验证输入、界面、怪潮性能与音效；网页或规则测试不能替代实际目标平台验证。

其他设备若缺少Creator，可维护普通TypeScript规则与文档；场景、资源导入和运行效果须在对应环境验证。

## 像素和音频工具

- 第一阶段可直接使用 PixelLab 网页/Pixelorama；不以购买 Aseprite 为前置条件。
- Aseprite 是后续可选精修工具，本机未安装；PixelLab 官方扩展要求正式 Aseprite 1.3+，试用版不支持扩展。
- Piskel 可作免费像素编辑备选；jsfxr 制作基础合成短音效，Audacity 需要时处理剪辑/响度/循环。
- 用户已同意按上一轮建议推进首套像素音画；这不构成任何未指定金额的购买或订阅授权。

## 官方参考

- [PixelLab 使用方式与集成条件](https://www.pixellab.ai/docs/ways-to-use-pixellab)
- [PixelLab 官方 MCP](https://www.pixellab.ai/mcp)
- [Codex MCP 配置](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
