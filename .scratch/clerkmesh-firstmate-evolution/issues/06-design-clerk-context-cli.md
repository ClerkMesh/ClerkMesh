# 设计 Clerk 上下文快照与检索 CLI

Type: prototype
Status: resolved
Prototype branch: `prototype/clerk-context-cli`
Prototype commit: `4717755`
Blocked by: 03

## Question

如何用适合 Agent 使用和迭代的 Bash/CLI，让 Primary 在每次执行前动态选择 Clerk，把当次所选 Clerk 名称、版本、身份摘要、强制规则与索引编译进 brief（含供 Clerk CLI 稳定检查、由 Web 进程只读组合的标准机器块），并让当前 Worker 受限、只读、可审计地渐进检索该版本的 Clerk 仓库，而不建立 Task 级 assignment、复制全部资料或直接浏览权威目录？

## Answer

原型、完整命令契约与实测证据保存在独立 throwaway 分支：

```bash
git show prototype/clerk-context-cli:prototypes/clerk-context-cli/EVIDENCE.md
git show prototype/clerk-context-cli:prototypes/clerk-context-cli/docs/context-cli.md
```

验证可行的最小界面由五类窄命令组成：候选索引只返回 active Clerk 的 `name`、`description`、`execution` 与批准 commit；短名单读取固定版本的 Role、Capabilities 与 Boundaries；编译器要求完整 commit 仍等于当前批准 HEAD，把选定 Clerk 的身份、Working Style、Instructions、选择依据、边界说明及 Primary 明确挑选的资料索引原子写入现有 brief；检查器只验证并返回标准 `clerkmesh.execution-context.v1` 机器块；Worker 使用 `list|search|read` 渐进读取。

机器块采用 canonical JSON 的 base64 表示并附 SHA-256，包含 Task ID、Clerk 全 commit、执行方式、身份上下文、选择信息，以及每个允许资料的固定路径、名称、描述和 blob OID。Web 进程只能调用检查器取得结构化投影，再与 Firstmate Task 投影组合；浏览器不解析 Markdown。brief 同时保留供 Worker 直接阅读的生成段落，但不复制资料正文。

Primary 必须显式给出本次执行允许的资料路径。读取面只接受 `workflows/*.md`、`knowledge/*.md`、`cases/*.md` 与 `skills/*/SKILL.md`，拒绝 `sources/`、脚本、任意路径、未入索引的合法资料和目录遍历；搜索只针对索引元数据，读取时再次核对 brief 固定的 commit 与 blob，历史对象缺失即失败，绝不回退到 HEAD 或工作区。实测 dirty Clerk 工作区不会泄漏到 Worker。

Agent Worker 启动时获得一个不写入 brief 的短期 capability；正常调用不能自行传 Task、Clerk、commit、仓库或 brief 路径。新执行重新编译 brief 时轮换 capability，follow-up 沿用当前 snapshot；真人 Clerk 不生成 Worker capability。正式 V1 的 capability state 位于 `clerkmesh-state/capabilities/`。每次 list/search/read 及路径拒绝都向 `clerkmesh-data/audit/` 追加 Task、Clerk、commit、动作与结果审计，其中搜索词只记录 hash。该记录是派生运行证据，不是 Task assignment 或新的权威状态。

必须诚实保留一个限制：同一 OS 用户下拥有通用 shell 的 Worker 仍可能自行发现可读的 Clerk 仓库、capability 状态或篡改审计；Bash wrapper 只能提供受限的 Agent 工具/行为边界，不能充当保密或防篡改沙箱。若未来要求硬隔离，必须增加不同 UID 的 broker、ACL 或进程沙箱。首版因此承诺“不通过受支持接口直接浏览权威目录”和可审计的正常使用，不宣称对恶意同用户进程实现安全隔离。
