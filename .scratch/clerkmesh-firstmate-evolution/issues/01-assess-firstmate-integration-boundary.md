# 评估 ClerkMesh 与 Firstmate 的集成边界

Type: research
Status: resolved
Research branch: `research/firstmate-integration-boundary`
Report: `.scratch/clerkmesh-firstmate-evolution/research/firstmate-integration-boundary.md` at commit `1a4eca8`

## Question

基于当前 Firstmate 的源码、X mode、Primary 会话、watcher、backlog 与脚本契约，Web Channel、Clerk 选择和真人等待流程能否通过非侵入适配层实现？分别评估纯外部适配、少量上游扩展点和独立 Fork 三条路线的可行性、改动面、升级成本、可靠性风险与推荐边界。

## Answer

完整证据报告位于研究分支，可用以下命令读取：

```bash
git show research/firstmate-integration-boundary:.scratch/clerkmesh-firstmate-evolution/research/firstmate-integration-boundary.md
```

结论是：纯外部适配足以验证独立 Web Channel 的持久收发、幂等和唤醒，但无法可靠保证所有入口统一的 Clerk 归属与可恢复真人任务状态。该结论保留为对“独立 Channel”方案的事实评估；后续 [定义 Web–Firstmate 集成边界](14-define-web-firstmate-integration-boundary.md) 已取消独立 Channel，改为 Pi RPC 对当前 Primary session 的直接 UI 桥接。因此 Web transport 不再预设需要 Firstmate Channel 扩展；任务 owner、dispatch 和真人等待是否需要扩展，必须由后续 Connector、只读模型与任务生命周期证据重新决定。
