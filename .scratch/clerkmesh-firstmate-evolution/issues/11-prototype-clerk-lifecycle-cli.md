# 原型化 Clerk 生命周期 CLI

Type: prototype
Status: resolved
Prototype branch: `prototype/clerk-lifecycle-cli`
Prototype commit: `9a6e628`
Blocked by: 03

## Question

面向 Web、Firstmate 和高级本地用户的 `clerk` CLI 应提供哪些 create、register、validate、inspect、review、commit、archive 与 restore 命令，并采用什么锁、事务、失败恢复和输出契约，才能覆盖底层 Git 与注册表操作、避免用户理解 Git，同时落实 Clerk 仓库契约？

## Answer

原型与实测证据保存在独立 throwaway 分支：

```bash
git show prototype/clerk-lifecycle-cli:prototypes/clerk-lifecycle-cli/EVIDENCE.md
git show prototype/clerk-lifecycle-cli:prototypes/clerk-lifecycle-cli/docs/clerk-cli.md
git show prototype/clerk-lifecycle-cli:prototypes/clerk-lifecycle-cli/README.md
```

结论是 **Agent-first 的 Bash 生命周期控制面可行**。系统不应做传统人类 CLI 或让 Web 旁路 Agent 直接承担语义判断；Agent 决定创建、内容、批准和生命周期意图，脚本只执行已确定的校验、Git、注册表、锁、事务与投影工作。

原型用同一 root 下的 `bin/` 与 `clerk/bin/` 验证了物理分离且不做总 `clerk` dispatcher 的命令边界；其具体路径随后由 [Ticket 09](09-define-system-architecture.md) 与 [Ticket 12](12-define-firstmate-evolution-strategy.md) 的产品源码布局取代。正式 V1 在单一 ClerkMesh 产品 root 中使用内嵌 `firstmate/bin/` 与独立 `packages/clerk-cli/`；Firstmate 运行数据留在 `firstmate/data|state|projects/`，ClerkMesh 数据进入根层 `clerkmesh-data/` 与 `clerkmesh-state/`，Clerk 仓库进入根层 `clerks/`。以下 Agent-facing 命令语义保持不变：

- `clerk-create.sh`：从非 Git 源目录原子创建、首提、注册并启用；
- `clerk-register.sh`：把已有 Git 仓库和历史导入标准位置，移除 remotes，原源不变；
- `clerk-validate.sh`：按 source、candidate 或固定 commit 一次报告全部确定性违规；写命令仍自动复用同一验证库；
- `clerk-inspect.sh`：只提供 index、shortlist、context 三层渐进披露，并从批准 HEAD 或任务固定 commit 读取；
- `clerk-review.sh`：先输出紧凑 summary，再按需输出全量或单路径 diff；
- `clerk-commit.sh`：同时绑定审阅时的 base commit 与完整 candidate Git tree，任一变化都拒绝提交；
- `clerk-archive.sh` / `clerk-restore.sh`：幂等切换新 Task 候选资格，不影响固定历史版本，且 Escalation Clerk 不可归档。

所有写操作共用 `clerkmesh-state/clerk-lifecycle.lock` 这把短持有锁，与 Firstmate 长持有的 Primary session lock 分离；活 PID 永不被夺锁。单一 transaction journal 位于 `clerkmesh-state/` 并记录阶段，`clerkmesh-data/clerks.md` 注册表以临时文件加 rename 发布，根层 `clerks/` 中的仓库先在临时位置完成再发布、最后登记。崩溃恢复按证据回滚本操作创建的未登记仓库或向前完成已发布状态；导入源永不删除，commit 使用 `git update-ref` compare-and-swap，历史永不 reset 或改写。实测覆盖了 live lock 拒绝、canonical rename 后被 `kill -9` 的自动恢复、导入历史与 remote 隔离、归档/恢复幂等及 Escalation 拒绝。

输出首先服务 Agent 与 Token 成本：`stdout` 只含请求的紧凑 tab 结果、Markdown 或 diff，诊断进入 `stderr`；只约定 shell 的零成功/非零失败，不建立全局业务退出码或统一 JSON envelope。未来若 Web 确需直接消费聚合只读模型，再单独增加版本化结构投影，不污染每个机械命令。Git commit/tree OID 是版本与审阅绑定，无需额外版本号或有状态 review token。
