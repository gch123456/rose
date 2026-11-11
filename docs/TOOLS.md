# 工具接入与跨设备 TODO

记录日期：2026-11-11（北京时间）。用户最新决定：本机暂不安装/接入 PixelLab，回另一台电脑再完成；本文件保留接续步骤。

## PixelLab：本机不接入，另一台电脑待配置

- PixelLab 是在线服务，网页编辑器无需安装桌面软件。
- 官方 MCP 地址：`https://api.pixellab.ai/mcp`。
- 此前本机临时注册并验证过服务握手和目录；用户改为另一台电脑操作后，已移除刚添加的 `pixellab` MCP 条目，保留其他 Codex 配置。
- 已关闭为接入创建的登录页，不再等待用户在本机登录；未存储 Token、生成素材、购买或订阅。
- 历史验证记录见 [接入会话](archive/2026-11-11-pixellab-setup-approved-direction-session.md)，不代表另一台电脑已接通。

### 在另一台电脑完成接入 TODO

- [ ] 拉取 `main` 最新文档，检查目标电脑现有工具和配置，不直接复制本机 Codex 配置。
- [ ] 用 `codex --version`、`codex mcp add --help` 核对目标客户端支持；支持原生 HTTP 时执行下方命令，无须 npm 桥接。
- [ ] 在 [PixelLab](https://www.pixellab.ai/signin) 登录，确认账号的 MCP/API 权限、订阅和余额。
- [ ] 从 [官方 MCP 页面](https://www.pixellab.ai/mcp) / 账户页面取得账户 Token，在目标电脑完成认证配置；不要发到聊天、写入项目文档或提交 Git。
- [ ] 为目标电脑的 HTTP MCP 配置 `Authorization` Bearer 头，或使用 `bearer_token_env_var` 引用该电脑的环境变量。环境变量必须在启动 Codex 的进程中可见，单独终端 export 不代表已运行的桌面应用能读取。
- [ ] 重新加载 MCP 或重启客户端，确认目标设备上的聊天可以发现 PixelLab 工具。
- [ ] 用 `get_balance` 做只读认证检查，之后按最新自救/全鸭主题先生成一只职业鸭的小样，验证风格和帧间一致性，再扩展素材。

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

本机目前没有 PixelLab MCP 条目；以上仅供目标电脑接续使用。

## Cocos：本机尚未安装，按用户要求列为 TODO

- [ ] 安装 Cocos Dashboard，再安装与项目匹配的 **Cocos Creator 3.8.8**。
- [ ] 使用 Creator 打开本仓库，等待导入完成，生成 `library/`、`temp/` 等本机文件；这些不提交。
- [ ] 打开 `assets/Home.scene`，切换 2D 并核对编辑器预览。
- [ ] 确认子模块 `extensions/funplay-cocos-mcp` 已初始化，使用仓库固定版本；从本机插件面板取得项目地址并配置客户端。
- [ ] 连接前核对项目名称、路径、身份与场景，不沿用另一台设备的端口或项目 URL。
- [ ] 执行引擎 TypeScript 诊断与网页预览，检查触屏拖动、角色菜单、升级及完整一局。
- [ ] 在目标 iPhone 上验证输入、界面、怪潮性能与音效；网页或规则测试不能替代实际目标平台验证。

当前缺少 Creator 不影响继续维护普通 TypeScript 规则与文档，但场景、资源导入和运行效果只能在相应环境中验证。

## 像素和音频工具

- 第一阶段可直接使用 PixelLab 网页/Pixelorama；不以购买 Aseprite 为前置条件。
- Aseprite 是后续可选精修工具，本机未安装；PixelLab 官方扩展要求正式 Aseprite 1.3+，试用版不支持扩展。
- Piskel 可作免费像素编辑备选；jsfxr 制作基础合成短音效，Audacity 需要时处理剪辑/响度/循环。
- 用户已同意按上一轮建议推进首套像素音画；这不构成任何未指定金额的购买或订阅授权。

## 官方参考

- [PixelLab 使用方式与集成条件](https://www.pixellab.ai/docs/ways-to-use-pixellab)
- [PixelLab 官方 MCP](https://www.pixellab.ai/mcp)
- [Codex MCP 命令](https://learn.chatgpt.com/docs/developer-commands#codex-mcp)
