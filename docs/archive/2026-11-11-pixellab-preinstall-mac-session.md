# PixelLab 与 MCP 本机预装

日期：2026-11-11（北京时间）。设备：原型开发Mac。
起始提交：`e197893574697020ed40d9a5e550e01ff0284e82`，分支main；接手时工作区干净，fetch后无新增远程提交。

## 最新请求

用户要求“先预装一下PixelLab和mcp”，据此在当前Mac执行预装，取代此前延后本机接入的决定。没有要求本轮生成素材、购买订阅或完成账户登录。

## 操作

1. 查阅PixelLab官方MCP页面与OpenAI官方MCP配置说明；插件目录搜索未返回PixelLab，采用官方原生HTTP服务。
2. 本机配置仅输出服务名称、认证是否存在等脱敏状态，确认未注册PixelLab、无PixelLab环境Token。
3. 全局codex启动器因底层可执行文件缺失而失败；定位已安装桌面应用内置CLI，版本0.167.0-alpha.3.2，核对mcp add原生HTTP支持。未扩大任务去修复全局安装。
4. 在项目仓库外备份本机配置，备份与配置均保持0600；添加pixellab，URL为https://api.pixellab.ai/mcp。
5. 前后解析配置比较，必要时保留原文仅追加该服务，确保其他MCP与设置不变；没有添加占位Token或记录凭据。
6. 使用正常TLS校验访问官方服务，只调用initialize、tools/list、get_balance；未调用任何素材生成工具。

## 验证与结果

- 配置解析通过，pixellab URL正确，其他设置与预装前一致，文件权限0600。
- initialize成功：PixelLab MCP Server 0.2.0，协议2024-11-05。
- tools/list成功：138项，包含get_balance。
- get_balance返回401缺少Authorization：远程服务可达，但账户尚未认证；不能据此称素材已可生成。
- 当前聊天没有重新加载PixelLab工具。本机配置和工具可调用状态分开记录。
- 没有开启登录交接、购买/订阅、存储Token、生成素材、改游戏代码或修改其他工具安装。

## 后续

用户在官方账户中取得Token，安全填写本机MCP的Bearer认证；不要把密钥发送到聊天或提交Git。配置完成后重新加载客户端，再用余额只读检查；之后才按已确认的全鸭像素主题制作小样。其他电脑需独立接入，不能复制本机凭据/端口配置。

TOOLS、STATUS、ROADMAP、AGENTS与CHANGELOG更新，文档差异/链接检查后按既有授权提交同步main。纯文档与本机连接配置变更，未运行游戏测试或真机，不将前轮27项测试当作本轮新增验证。

官方来源：
- https://www.pixellab.ai/mcp
- https://learn.chatgpt.com/docs/extend/mcp?surface=cli
