# ClerkMesh：把 Firstmate 扩展为公司式工作编排系统

Type: map
Status: resolved

## Destination

产出一份可交给开发团队执行并持续迭代的“Web Firstmate + Clerk 系统”产品与架构规格，明确领域模型、用户流程、系统边界、存储与 CLI 契约、学习机制、任务派发协议和分阶段实施路线；本地图不执行产品实现。

## Notes

- 每次会话应使用 `grilling` 与 `domain-modeling`；界面问题使用 `prototype`；Firstmate 源码事实使用 `research`。
- 首版是本地、自托管、单 Captain、无登录系统；未来多用户与权限只做边界预留。
- Web 是当前唯一 Firstmate Primary 会话的浏览器 UI，不建立独立 Channel、聊天数据库或第二套会话；普通模式不显示推理或交互终端，可选诊断模式显示 Pi/RPC 完整细节。
- 首页先列出并只读浏览 Pi 历史 session；选定后呈现该对话，首次发送才成为当前 Primary。Firstmate home 的单写锁覆盖 Web 与终端输入。
- 首版固定 Pi Primary、Pi Workers、Herdr backend 与 Treehouse；Web 通过 HTTP + WebSocket 提供 UI，并通过 Pi RPC 桥接当前会话。
- ClerkMesh 在开始 V1 实现时复制 Firstmate upstream 默认分支当时最新的源码到 `firstmate/`，删除其嵌套 `.git` 并由 ClerkMesh 根仓库直接跟踪；准确 upstream URL、完整 commit SHA 和复制时间只作为 provenance 记录。`firstmate/` 同时是 Primary cwd/FM_HOME，承载被忽略的 `data/state/projects`；ClerkMesh 自己的持久数据与状态进入根层 `clerkmesh-data/`、`clerkmesh-state/`。V1 直接修改内嵌源码，不使用运行时 clone、lock file 或 patch stack，也不设计后续同步、更新或多版本管理。
- Web 先零 Token 展示 Pi 历史 session，用户选定后仍不启动 Primary；首次发送消息时才懒启动，运行期间不允许热切换 session，也不自动恢复退出的 Primary。
- Project 是本地 Git 仓库，remote 可选；GitHub/GitLab 登录不得成为首版要求。
- Clerk 是全局持久工作身份，独立于 Project；每个 Clerk 是 `clerks/<id>/` 下的独立本地 Git 仓库，以 Skill 风格的 `CLERK.md` 为入口。
- Clerk 使用统一模型，通过少量字段区分真人或 Agent 执行；首版不做 Clerk 与 Project 权限。
- ClerkMesh 把 Primary LLM 的思考与判断视为核心编排资产：独立 Primary Pi Extension 在每个 agent run 注入简洁英文 `CLERK.md`，作为 Clerk 选择的主要行为代码，不修改 Firstmate `AGENTS.md`。Task 不永久绑定 Clerk；Primary 在每次执行前根据当前任务、依赖结果和 active Clerks 动态选择最佳身份，并把当次 Clerk 上下文编译进 brief。默认自动执行；Captain 可在对话中要求先展示计划、选择依据与边界。
- 无法完整匹配或安全拆分的请求先留在 Primary 对话中澄清；只有 Captain 明确接手时，本次真人执行才选择内置、不可删除的 Escalation Clerk。真人 Clerk 不派生 Worker，Captain 在 Web 代为记录过程并提交 Markdown 结果；需要落地到 Project 时，Firstmate 创建新的 Agent Task 并在执行前重新选择 Clerk。
- 当前 Worker 与 follow-up 复用同一 brief；后续新 Worker 可由 Primary 重新选择 Clerk 并重新生成 brief。Agent Clerk 的大型记忆不整体拼入 brief；Worker 使用当次 brief 指定版本、任务限定、只读的 Bash/CLI 检索接口渐进读取。
- Agent 执行结果不自动学习。导入资料与真人任务过程会生成学习候选，经 Captain 选择一个或多个 Agent Clerk、逐个审阅 diff 后提交；真人与 Agent Clerk 不建立绑定。
- Clerk 可携带经 Captain 明确批准的 Skills、脚本与工具；导入资料默认只是数据。
- Web 提供只读为主的任务规划图与运行任务系统视图；Web 进程把 Firstmate 现有 fleet snapshot 与 Clerk CLI 对标准 brief 的只读检查按 task ID 即时组合，展示当前执行所选 Clerk，不修改 Firstmate `.meta` 或建立第二份状态。操作仍通过 Firstmate 校验。
- 领域语言记录在 [`CONTEXT.md`](../../CONTEXT.md)。

## Decisions so far

<!-- Closed tickets are indexed here; decision detail remains in each ticket. -->

- [评估 ClerkMesh 与 Firstmate 的集成边界](issues/01-assess-firstmate-integration-boundary.md) — 研究排除了“独立 Web Channel 同时旁路承载 Clerk 语义”的方案；后续改用 Pi RPC 直接桥接 Primary。Clerk 编排通过 Primary Extension 注入的 `CLERK.md`、Clerk CLI 与执行期 brief 完成；即使 Firstmate 改为内嵌源码，其控制面仍不拥有 Clerk 产品语义。
- [评估无远端依赖的本地 Project 模式](issues/02-assess-local-project-mode.md) — Firstmate 的 local-only 核心可复用；最新复核确认 V1 只需移除全局 forge 认证/tooling 耦合，不采纳研究报告曾建议的 validation、publication 与 landing 全面正交重构。
- [定义 Clerk 仓库与 CLERK.md 契约](issues/03-define-clerk-repository-contract.md) — Clerk 采用统一严格的 Skill 风格仓库契约、分层渐进披露、执行期 Git commit 快照及归档式生命周期。
- [定义 Web–Firstmate 集成边界](issues/14-define-web-firstmate-integration-boundary.md) — Web 内置 Supervisor 与 Conversation Bridge，懒启动独立 Pi RPC Primary，任务只读投影而所有修改仍经过当前 Firstmate 对话。
- [定义 Primary Conversation Bridge 契约](issues/04-define-primary-conversation-bridge.md) — Pi 会话保持唯一历史权威；HTTP + WebSocket Bridge 使用进程内临时投影、单主写租约、3 秒重连窗口与请求幂等来支持快速恢复，并直接透传 Firstmate 的锁与只读行为。
- [定义 Clerk 选择与任务生命周期](issues/05-define-clerk-task-lifecycle.md) — Task 不持久绑定 Clerk；Primary 按 Extension 注入的 `CLERK.md` 在每次执行前动态选择 Clerk并编译 brief，当前 Worker/follow-up 复用该上下文而后续新 Worker可重新选择。Agent 完全复用现有 runtime，真人由 Captain 代录 Markdown 结果，不增加 assignment 或第二套 Task 状态机。
- [设计 Clerk 上下文快照与检索 CLI](issues/06-design-clerk-context-cli.md) — 五类窄 Bash 命令可完成候选/短名单渐进披露、固定 commit 的标准 brief 机器块、Web 稳定检查和 capability 绑定的 allowlist/blob 读取；资料正文不复制，dirty 内容不泄漏，审计不成为 Task 权威。同 OS 用户通用 shell 下该边界不等于安全沙箱，硬隔离必须另用 UID、ACL 或进程沙箱。
- [设计 Clerk 学习与审核流水线](issues/07-design-clerk-learning-pipeline.md) — 只有 Captain 明确导入或真人 Task 完成可产生 Learning Source；每个 Learning Proposal 对一个或多个 active Agent Clerk 建立独立的 base/tree 审阅，修改后复审、HEAD 竞争后 stale，逐目标批准或拒绝。Agent Task 与提取结果不触发递归学习，批准才把 Source 与 Markdown 候选提交进对应 Clerk 仓库。
- [原型化 Web 聊天与任务系统体验](issues/08-prototype-web-task-experience.md) — Captain 选择低密度 Calm object workspace：Conversations、Work、Company、Reviews 四个顶层领域，一次聚焦一个持久对象并用 breadcrumb 定位；Task Clerk 只表达当前/最近执行，所有权威读取即时组合，Task 修改仍进入可见 Firstmate 对话。
- [评估 Firstmate 的 Web 只读模型](issues/16-assess-firstmate-web-read-model.md) — 现有 fleet/bearings JSON 可作零 Token 基底；Firstmate 只补通用 Project、task graph/activity 和 Herdr Agent 投影，执行期 Clerk 由 Web 进程通过 Clerk CLI 检查标准 brief 后即时增强，不写 `.meta`、不解析任意私有 Markdown。
- [原型验证 Web–Firstmate Connector](issues/15-prototype-web-firstmate-connector.md) — 直接 Web → Pi RPC 的懒启动、流式回传、extension UI、刷新投影、写租约、离线呈现和 fleet JSON 查询均可行；实测同时发现 Firstmate `fm-lock.sh` 会把活 Pi holder 误判为 stale，修复并回归该通用锁是产品落地前 blocker。
- [原型化 Clerk 生命周期 CLI](issues/11-prototype-clerk-lifecycle-cli.md) — Agent-first Bash 控制面可用八个窄命令覆盖创建、导入、验证、渐进读取、Git tree 绑定审阅提交和归档恢复；Clerk 使用 `clerkmesh-state/` 中的独立短写锁与分阶段 journal，registry 位于 `clerkmesh-data/`，Clerk Git repositories 位于根层 `clerks/`。
- [定义 Firstmate 内嵌与最小扩展策略](issues/12-define-firstmate-evolution-strategy.md) — Firstmate 作为 `firstmate/` 内嵌源码由 ClerkMesh 根仓库直接跟踪，来源 commit 只作 provenance；V1 可直接修改 Firstmate 通用能力，但 Clerk 产品语义仍由独立 Primary Extension、`CLERK.md` 与 ClerkMesh packages 承载，首版不设计上游同步或更新。
- [完成 Firstmate local-only 最小适配](issues/13-define-local-project-contract.md) — Project 继续由内嵌 Firstmate 管理；未明确授权远端交付时默认 local-only，普通 startup 不检查 forge，远端能力由 Primary 与 `fm-spawn` 共用的只读 preflight 按 Task 检查。新建本地 Project 由 Bash 脚本生成 ClerkMesh `README.md` baseline commit；现有 fast-forward landing、`yolo` 与 fail-closed teardown 保持不变。
- [定义可实施的系统架构](issues/09-define-system-architecture.md) — `pnpm` monorepo 使用 React/Vite 前端与单一 Node/Fastify/ws Web 进程，按需桥接 Pi RPC Primary；launcher 注入 canonical paths，Web 只消费版本化 JSON read models并以 2 秒轮询推送运行态变化。四个 Firstmate 投影均为 V1 gate；Task activity 使用持久结构事件；Learning extraction 由专用 Herdr workspace 承载并跨 Primary 退出继续，重启只 reconcile。V1 只记录本地 Captain Actor provenance，不实现账号权限或保存 credentials。
- [汇总可实施规格与分阶段路线](issues/10-synthesize-implementation-ready-spec.md) — 根目录 `IMPLEMENTATION_SPEC.md` 以稳定 requirement ID 成为唯一实施入口；Gate 0 与五个严格顺序垂直切片最终生成 Release Candidate，真实运行时认证不可由 mocks 替代。Slice 4/5 由实施 Agent 隔离自检，Captain只在最终 UAT 集中验收；V1 仅支持 macOS 15+ Apple Silicon。

## Implementation blocker

- 内嵌 Firstmate `fm-lock.sh` 的 Pi holder liveness 已纳入 [`IMPLEMENTATION_SPEC.md`](../../IMPLEMENTATION_SPEC.md) Gate 0；必须在最终 provenance commit 上复核、修复并通过真实 Web/终端双 Primary 回归，失败时不得进入 Slice 1。

## Out of scope

- 本地图不实现 ClerkMesh 产品代码。
- 首版不实现登录、多用户、角色权限或多租户 SaaS。
- 首版不实现邮件、Webhook、企业微信、飞书、Slack 等真人外部通知。
- 首版不优化大型附件、对象存储或 Git LFS；所有 Clerk 资料先进入其本地 Git 仓库。
- 首版不嵌入或控制 Worker 实时终端。
- 首版不支持 Pi 以外的 harness，也不支持 Herdr 以外的 runtime backend。
- 首版每次执行只选择一个 Clerk，不把多个 Clerk 的身份上下文混合进同一份 brief。
- 首版不要求 GitHub、GitLab 或其他远端托管平台。
- 首版不实现内嵌 Firstmate 与 upstream 的同步、更新、多版本共存、自动切换或 rollback 管理。
