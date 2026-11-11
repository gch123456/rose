# 本机工具与接入清单

记录日期：2026-11-11（北京时间）。这是当前设备的接续说明，不是所有设备均已具备的环境。

## PixelLab：MCP 已注册，账户认证待完成

- PixelLab 是在线服务，网页编辑器无需安装桌面软件。
- 官方 MCP 地址：`https://api.pixellab.ai/mcp`。
- 本机 Codex CLI 0.146.0 支持原生 Streamable HTTP，因此直接连接，不需要 npm 桥接包。
- 已执行 `codex mcp add pixellab --url https://api.pixellab.ai/mcp`，写入本机 `~/.codex/config.toml`；原有配置已保留，修改前备份在同目录，未入 Git。
- 已核对 `codex mcp get pixellab --json`：条目启用、HTTP URL 正确。
- 已实际验证初始化握手成功，服务版本 0.2.0，工具目录可读取（本次返回 137 个工具）。
- 未携带账户 Token 调用只读 `get_balance`，明确返回缺少 Authorization；**不等同于已认证或可生成素材**。
- 本机未发现已有 PixelLab Token，浏览器尚未登录，已打开官方登录页供用户接续。未生成、购买或订阅。

### 完成接入 TODO

- [ ] 在 [PixelLab](https://www.pixellab.ai/signin) 登录，确认账号的 MCP/API 权限、订阅和余额。
- [ ] 从 [官方 MCP 页面](https://www.pixellab.ai/mcp) / 账户页面取得账户 Token，在本机完成认证配置；不要发到聊天、写入项目文档或提交 Git。
- [ ] 可为本机 HTTP MCP 配置 `Authorization` Bearer 头；也可使用 Codex 的 `bearer_token_env_var` 引用本机环境变量。环境变量必须在启动 Codex 的进程中可见，单独终端 export 不代表已运行的桌面应用能读取。
- [ ] 重新加载 MCP 或重启客户端，确认本次聊天可以发现 PixelLab 工具。
- [ ] 用 `get_balance` 做只读认证检查，之后先生成一只鸡的小样，验证风格和帧间一致性，再扩展素材。

本机配置可保护为仅本人可读；不得把真实认证头复制进下面的示例或仓库。

无密钥的配置结构示例（不是已配置认证的证明）：

```toml
[mcp_servers.pixellab]
url = "https://api.pixellab.ai/mcp"
bearer_token_env_var = "PIXELLAB_API_KEY"
```

当前条目只注册 URL，尚未加入这个环境变量引用，因为本机还没有相应 Token。

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
