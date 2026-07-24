# Firstmate 最新版本的 local-only 能力复核

## 结论

截至 2026-07-24，本地 Firstmate `main` 已从研究 Ticket 02 使用的 `68ed7ed2355619749c6ee2bb91b7298dee420df8` fast-forward 到当时 `origin/main` 的最新 commit：

```text
f017572eab2930cc4c03e830d44620935ba77035
fix: relaunch missing second mates at session start (#950)
```

两者之间有 11 个 commit。最新版本仍有可工作的 `local-only` 主流程，但**仍未完全满足“无 remote、无 GitHub/GitLab 认证也能 dispatch”**：Project 管理技能允许 local-only 无 remote，实际 branch/worktree/local fast-forward 路径也保留；然而全局启动契约仍要求 GitHub authentication，bootstrap 仍无条件探测 `gh auth`，通用 Ship brief 仍注入 GitHub 工具规则。

因此 ClerkMesh V1 不需要重做 Firstmate Project 系统，只需在内嵌 Firstmate 源码中完成窄的 capability 隔离，并补一个能生成 `README.md` baseline commit 的确定性 local-only Project 初始化脚本。

## 同步记录

检查的源码目录：

```text
/Users/jianbaoshuang/data/github/kunchenguid/firstmate
```

同步命令：

```bash
git pull --ff-only
```

同步结果：

```text
68ed7ed..f017572  main -> main
11 commits
working tree clean
main == origin/main
```

“最新”只表示上述检查时刻的 upstream 默认分支 HEAD。ClerkMesh 真正开始 V1 实现时，应再次获取当时 upstream 默认分支 HEAD，将其复制为根仓库跟踪的 `firstmate/` 源码，并单独记录准确 URL、完整 commit SHA 与复制时间。

## 最新版本已经支持的 local-only 能力

### Project 权威仍在 Firstmate

`.agents/skills/project-management/SKILL.md` 继续规定：

- Project 位于 `projects/`；
- `data/projects.md` 是私有 fleet registry；
- `local-only` 不要求 remote 或 PR；
- local-only Project 可以直接创建为本地 Git repository；
- 不进行 GitHub 调用；
- 不运行 No Mistakes 初始化。

相关当前源码位置：

```text
.agents/skills/project-management/SKILL.md:20-69
```

### Worker 与本地交付路径已经存在

`bin/fm-project-mode.sh` 仍将 `local-only` 定义为：

```text
local branch, no remote/PR -> captain approve -> guarded local merge
```

`bin/fm-brief.sh` 的 local-only Definition of Done 仍要求：

- 不 push；
- 不创建 PR；
- 不运行 pipeline；
- 在 `fm/<task-id>` branch 提交；
- 保持可以 fast-forward 到本地 default branch；
- Firstmate 通过受保护的本地 fast-forward 路径合并。

`AGENTS.md` 仍要求 local-only 使用 `bin/fm-merge-local.sh`，并把 local-only 工作留在 main home。

因此 Ticket 02 关于 worktree、branch、本地 diff、fast-forward landing 与 landed proof 可复用的核心判断没有失效。

## 最新版本仍然存在的三个缺口

### 1. 全局 GitHub authentication dispatch gate

当前 `AGENTS.md:150` 仍写明：

```text
Do not dispatch until the required tools are present and GitHub authentication is good.
```

这条规则没有按 Project delivery mode 区分。即使 Project 是 `local-only`，Primary 仍被行为契约禁止在 GitHub 未认证时 dispatch。

### 2. Bootstrap 仍把远端工具和认证视为全局前置

当前 `bin/fm-bootstrap.sh`：

- 在 `COMMON_TOOLS` 中无条件包含 `gh`、`no-mistakes`、`gh-axi` 等工具（约 `:518`）；
- 无条件执行 `gh auth status`，失败时输出 `NEEDS_GH_AUTH`（约 `:849`）。

这说明工具诊断仍未根据 registered Project 的实际 delivery capability 分离。

### 3. local-only Ship brief 仍收到 GitHub 工具规则

`bin/fm-brief.sh` 正确生成 local-only 专属完成条件，但随后所有 Ship 共用的 Rules 仍包含：

```text
Use gh-axi for GitHub operations and chrome-devtools-axi for browser operations.
```

当前位置约为 `bin/fm-brief.sh:356`。这不是 local-only 的直接交付步骤，却仍把 GitHub tooling 表达成通用 Worker 规则。

## 从旧基线到最新基线的相关变化

`68ed7ed..f017572` 的 11 个 commit 主要涉及：

- Pi Calm 呈现与持久化；
- ask-user authority；
- scout intake 与并行 dispatch；
- PR poll retirement；
- Secondmate liveness；
- Herdr/backend 与 lint 改进。

与 Project/local-only 相关文件虽有少量文字变化，但没有移除上述三个缺口：

- `.agents/skills/project-management/SKILL.md` 只调整了 `yolo` authority 的说明；
- `bin/fm-project-mode.sh` 只调整了 `yolo` authority 注释；
- `bin/fm-brief.sh` 的变化主要围绕 ask-user authority；
- `AGENTS.md` 的全局 GitHub auth dispatch gate 保持存在；
- `bin/fm-bootstrap.sh` 的通用工具和 `gh auth` 检查保持存在。

## 对 ClerkMesh V1 的建议边界

Firstmate 已作为 ClerkMesh 根仓库直接跟踪的 `firstmate/` 内嵌源码后，Ticket 13 应只处理以下最小改动：

1. local-only dispatch 不以 GitHub/GitLab authentication 为前提；
2. 普通 startup 不检查 forge readiness，添加/切换/dispatch 远端 mode 时才运行无远端写副作用的确定性 preflight；
3. local-only brief 不注入不适用的 GitHub、PR 或 No Mistakes 要求；
4. Captain 未明确授权远端交付时，Project 默认 `local-only`；
5. 新建 local-only Project 时由 Bash 脚本生成 `README.md` 和可供 worktree 使用的 initial commit；
6. 添加无 remote、无 forge auth 的 local-only 回归测试，同时证明既有 direct-PR/no-mistakes 不回归。

以下内容不应进入 Ticket 13：

- ClerkMesh 自己的 Project registry；
- 新的 Project identity/schema；
- validation/landing 的全面正交重构；
- 第二套 landed proof；
- Secondmate local Project materialization；
- Firstmate 上游同步或升级机制；
- 用户自行给 local-only Project 配置 `origin` 后的强制离线保证。

Project registry、Worker runtime、本地 fast-forward landing、landed proof 和 teardown 继续由 Firstmate 拥有。
