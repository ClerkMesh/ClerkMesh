# 设计 Clerk 学习与审核流水线

Type: prototype
Status: resolved
Prototype branch: `prototype/clerk-learning-pipeline`
Prototype commit: `62a4061`
Blocked by: 03, 06

## Question

聊天记录、文档、历史任务和真人任务全过程应如何进入来源区、被提取为工作流/规则/知识/案例候选，由 Captain 选择一个或多个 Agent Clerk、逐目标审阅 Markdown diff、批准提交或拒绝，并确保 Agent 自身执行结果不会触发学习？

## Answer

原型、状态契约和实测证据保存在独立 throwaway 分支：

```bash
git show prototype/clerk-learning-pipeline:prototypes/clerk-learning-pipeline/EVIDENCE.md
git show prototype/clerk-learning-pipeline:prototypes/clerk-learning-pipeline/CONTRACT.md
```

采用 **Learning Source → Learning Proposal → 每目标独立审阅** 的模型。Learning Source 只能由两类事件产生：Captain 明确导入选定的 Pi 对话范围、文档或历史 Task 证据；或者真人 Task 的过程与结果被 Captain 记录并由 Primary 接受。Worker `done`、Agent Task report/delivery、watcher wake 和提取 Agent 完成事件一律不创建 Proposal。若 Captain 明确把 Agent 产物作为文档或历史证据重新导入，必须保留 `agent_generated` 来源声明并在 Web 警告；这是新的 Captain 行为，不是 Agent 结果自动学习。

每个 Source 以不可变 manifest 和内容摘要进入持久 proposal staging，记录种类、原始 locator/message ID/Task ID、Captain request、媒体类型、文件名及 SHA-256。Captain 随后选择一个或多个不同的 `active + execution=agent` Clerk；真人、归档、Escalation 或不存在的 Clerk 都不能成为学习目标。每个目标固定自己的批准 base commit，并拥有独立 candidate tree、审阅身份和最终决定，多 Clerk 学习不是跨仓库原子提交。

提取 Agent 只读取该目标固定版本与 Source，为每个目标生成候选：原始证据进入 `sources/<source-id>/`；工作流进入 `workflows/`；事实或参考规则进入 `knowledge/`；代表经验进入 `cases/`；真正改变强制行为的规则才窄幅修改 `CLERK.md` 的 Boundaries、Working Style、Instructions 或 Context 等既有段落，不新增 `rules/`。学习流水线只允许 Markdown 内容，不能生成 Skills、脚本、symlink、submodule、binary 或可执行能力。提取结果只是候选，不是新的 Learning Source，也不能递归触发流水线。

Captain 对每个目标分别查看 source manifest/预览、changed paths、相对该 Clerk base 的完整 Markdown diff、校验结果与敏感来源警告。审阅固定原生 `(base commit, complete candidate tree)`；要求修改会产生新 tree 并清空旧审阅，不能按旧 diff 批准。批准前若 Clerk HEAD 已变化，该目标单独进入 stale，必须基于新 HEAD 重新提取并完整复审，不能静默 rebase。目标可独立批准或拒绝；一目标批准、另一目标拒绝是正常完成。批准把 Source 与候选作为同一个 Clerk commit 落地，拒绝不改变该 Clerk 仓库。

草稿必须位于 canonical Clerk 工作区之外，避免与普通 dirty review candidate 冲突。批准时才取得 Ticket 11 的短持有 Clerk lifecycle lock，把已审阅 tree 通过同一校验、transaction 和 compare-and-swap commit 语义落地；拒绝只清理该目标 staging。Proposal manifest 与每目标审阅/决定是学习流程权威，Clerk Git commit 是已学来源和知识的唯一权威，Pi 和 Firstmate 仍分别拥有对话与 Task。紧凑 provenance、diff identities、决定、原因和结果 commit 长期保留，草稿 payload 可按保留策略清理。

纯 reducer 原型实测了 Agent completion 不创建 Proposal、真人目标拒绝、双 Agent Clerk 独立提取与审阅、并发 HEAD 变化导致单目标 stale、重新提取/复审、最终一目标批准和另一目标拒绝后正常 resolved。

### 系统架构落点

Ticket 09 后续确定：Learning 的持久 manifest、target staging、review 与 decision 位于 `clerkmesh-data/learning/`，run endpoint/reconciliation 位于 `clerkmesh-state/learning-runs/`。提取不伪装成 Firstmate Task；`learning-extract.sh` 启动独立 Pi extraction Agent，并把所有 `(proposal, target Clerk)` runs 放进按 canonical ClerkMesh root hash 隔离的单一 Herdr workspace。Primary/Web 退出后 run 继续；下次启动只按 Herdr endpoint 和完整 candidate tree reconcile 为 `extracting | review-ready | interrupted/failed`，不自动 relaunch、approve 或 commit。
