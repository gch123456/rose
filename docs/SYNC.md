# 跨设备记录与 Git 同步

项目仓库：`https://github.com/gch123456/rose.git`。
当前协作基线：`main`。远程默认分支仍是 `master`，所以首次克隆显式选择 `main`。

Git 保存代码、素材、项目设置、文档与提交历史；聊天窗口、未保存文件、编辑器进程和本机配置需要另行接续。
Superpowers 帮助执行设计、计划和验证流程，实际接续依据是已提交的项目文件。

## 另一台设备首次开始

在你选定的项目父目录执行（若 `rose-game` 已存在，先检查它，不要覆盖）：

```bash
git clone --branch main --recurse-submodules https://github.com/gch123456/rose.git rose-game
cd rose-game
git status --short --branch
npm test
```

安装 Cocos Creator 3.8.8，并使用支持直接执行 TypeScript 的 Node.js；本次在 22.21.1 上通过规则测试。
打开项目后 Creator 会生成本机缓存与 TypeScript 配置。
如需 Superpowers，在对应设备的 AI 工具中安装/启用；如需 Cocos MCP，按本机插件面板重新连接，参阅 [DEVELOPMENT.md](DEVELOPMENT.md)。

## 两台设备交替使用

开始修改前，先确认工作区干净，再拉取：

```bash
git status --short --branch
git fetch origin
git switch main
git pull --ff-only origin main
git submodule update --init --recursive
```

有未提交工作或快进失败时，先保留并检查本地/远程差异，再合并或整理自己的未推送提交；不要通过强推、硬重置或复制整个目录解决。

完成一项任务时：

1. 更新相关文档与独立的会话记录。
2. 运行与改动相符的检查，记录命令、结果及未验证范围。
3. `git add <本次明确修改的路径>`，再检查 `git diff --cached`。
4. `git commit -m "描述本次改动"`。
5. 再次 `git fetch origin`，检查 `git log --oneline HEAD..origin/main`；有新提交先整合、必要时重新验证。
6. `git push origin main`；若远程再次变化导致拒绝，重新检查并整合，不能强推。
7. 再次 fetch 后核对 HEAD、远程提交与 `git status`，然后换设备。

只讨论但产生新决定时，也应记录该决定后提交；无需为了没有变化的消息制造空提交。
若本次工作未完成，用交接记录说明进度；需要跨设备接续时可在任务分支保存明确标记的阶段提交。

## 两台设备同时开发

不同任务使用不同分支，不要同时直接修改 `main`：

```bash
git fetch origin
git switch -c work/mac-movement origin/main
# 另一台设备可使用 work/windows-audio 等不同任务名
git push -u origin work/mac-movement
```

每个分支分别记录与提交，完成验证后通过 PR 或明确的本地合并整合到 `main`。
不要在多个设备上同时改同一个场景、Prefab 或 meta；这类资源除文本冲突外还需要在 Creator 中检查引用。
并行任务尽量新增各自的归档文件；`STATUS.md` 等共同文件仍可能需要正常合并。
Git 能检测和合并提交，不能保证任意并行编辑都不冲突。

## 记录放在哪里

| 文件/目录 | 职责 |
| --- | --- |
| `AGENTS.md` | 后续 AI 接手时读取的工作规则与已授权同步方式 |
| `docs/STATUS.md` | 最新状态、实际验证、下一步、工具与同步限制 |
| `docs/DESIGN.md` | 当前游戏规则、实现边界与已确认决定 |
| `docs/ROADMAP.md` | 待办、已知问题和待确认提案 |
| `docs/archive/*-session.md` | 每次任务的需求、决定、改动和证据摘要 |
| `docs/superpowers/specs/` | 使用 Superpowers 时的设计文档，随实际任务创建 |
| `docs/superpowers/plans/` | 对应实施计划，随实际任务创建 |
| `CHANGELOG.md` | 项目变更摘要 |

会话记录不能把上一次方案中的建议自动当作用户批准；引用事实时注明来源。
无需逐字上传每次聊天，保留足够让下一台设备理解决定、依据和剩余工作的信息。

## 认证与安全边界

每台设备分别配置 GitHub 的 Git 认证；克隆公开仓库成功不代表有推送凭据。
AI 可在已授权范围内使用有写权限的 GitHub 连接器提交文件；发布前校验远程旧提交，使用快进更新，再拉取并核对本地。
同步失败时记录原因，保留本地工作，明确告知远程尚未更新。
`.env`、证书、密钥、账号口令、本机 MCP 地址配置以及 Creator 缓存不入库，继续遵循 `.gitignore`。
