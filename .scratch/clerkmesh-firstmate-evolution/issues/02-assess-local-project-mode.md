# 评估无远端依赖的本地 Project 模式

Type: research
Status: resolved
Research branch: `research/local-project-mode`
Report: `.scratch/clerkmesh-firstmate-evolution/research/local-project-mode.md` at commit `d742229`

## Question

当前 Firstmate 哪些启动、项目注册、worker 隔离、验证、交付与清理路径硬性依赖 GitHub/GitLab、remote 或认证？要让 Project 只要求本地 Git 仓库且 remote 可选，哪些现有路径可以直接复用，哪些契约需要调整？

## Answer

完整证据报告位于研究分支，可用以下命令读取：

```bash
git show research/local-project-mode:.scratch/clerkmesh-firstmate-evolution/research/local-project-mode.md
```

结论是：Firstmate 已有可复用的本地核心，`local-only` 能继续使用 backlog、brief、worktree 隔离、运行监督、本地 diff、受控 fast-forward 落地和安全清理。阻碍主要来自全局 GitHub 认证政策，以及把 validation、publication 与 landing 捆在一个 mode 中。目标契约应让 Project 只要求可 worktree 化、有基线 commit 与默认分支的本地 Git 仓库；remote、forge、认证、验证和交付改为按能力选择与检查。Secondmate 的本地 Project 支持需另行设计，首阶段可保持 main-home-only。

## Latest baseline follow-up

2026-07-24 将独立 Firstmate checkout 从本报告使用的 `68ed7ed2355619749c6ee2bb91b7298dee420df8` 同步到当时 upstream `main` 最新的 `f017572eab2930cc4c03e830d44620935ba77035` 后重新复核。11 个新增 commit 没有消除 local-only 的全局 GitHub auth gate、bootstrap 通用 forge 检查或 brief 通用 GitHub tooling 规则。最新证据与 Ticket 13 的最小修改边界见：

```text
.scratch/clerkmesh-firstmate-evolution/research/firstmate-latest-local-project-delta.md
```

Ticket 02 原报告提出的 validation/landing 全面正交重构不再是 ClerkMesh V1 范围。根据 Ticket 12，Project 仍由内嵌 Firstmate 拥有；Ticket 13 只完成无 remote、无 forge auth 的 local-only 最小闭环。
