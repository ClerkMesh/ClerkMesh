# 定义可实施的系统架构

Type: grilling
Status: resolved
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 11, 12, 13, 14, 15, 16

## Question

综合已确定的 Pi RPC Conversation Bridge、Firstmate Web 只读投影、Project、Clerk、动态执行期选择、检索、学习与 Web 交互契约，首版应如何由独立 Primary Pi Extension 注入 `CLERK.md` 作为 Clerk 编排的主要行为代码、把 brief 作为当次执行上下文，并保持 Firstmate Task/Worker runtime 与 `.meta` 不感知 Clerk，由 Web 进程只读组合 Firstmate 与 Clerk 投影？在此前提下应采用什么组件边界、进程拓扑、本地目录、API/CLI 分工、事件与状态所有权、恢复机制和未来账号权限预留？

## Answer

### 总体原则

ClerkMesh V1 是本地、自托管、单 Captain 的完整下游产品。Firstmate 源码内嵌在 ClerkMesh 根仓库，但领域所有权不因此混合：Firstmate 继续拥有 Project、Task、Worker、supervision、validation 和 delivery；ClerkMesh 拥有 Clerk、Learning、Web 与 Conversation Bridge。

核心执行链保持：

```text
Captain request
→ unique Pi Primary
→ Primary Extension injects CLERK.md
→ Primary uses Clerk CLI to inspect active Clerks
→ Primary selects one Clerk for a new execution
→ Clerk context compiler writes the execution snapshot into Firstmate brief
→ Firstmate spawns an ordinary Pi Worker through Herdr + Treehouse
→ Worker progressively reads only the brief-bound Clerk snapshot
→ Firstmate supervises, validates and delivers normally
```

Task 不永久绑定 Clerk。Firstmate `.meta`、backlog 和 Worker runtime 不增加 Clerk 字段；当前或最近一次执行的 Clerk 只存在于 ClerkMesh 编译的标准 brief 机器块，并由 Web server 通过 Clerk CLI 即时增强 Firstmate Task 投影。

### 技术栈与 monorepo

V1 使用 `pnpm` workspaces，不引入 Nx、Turborepo、数据库、消息队列、GraphQL 或微服务编排：

```text
clerkmesh/
├── apps/
│   └── web/
│       ├── client/                    # React + TypeScript + Vite
│       └── server/                    # Node.js + TypeScript + Fastify + ws
├── packages/
│   ├── shared/                        # JSON Schema、生成的 TS types、公共协议
│   ├── pi-primary-extension/          # Primary Extension + CLERK.md
│   └── clerk-cli/                     # Clerk lifecycle/context/learning Bash 控制面
├── firstmate/                         # 根 Git 跟踪的 vendored Firstmate + FM_HOME
├── firstmate.provenance.json          # upstream URL/SHA/time，仅 provenance
├── clerks/                            # 独立 Clerk Git repos；根 Git 忽略
├── clerkmesh-data/                    # ClerkMesh 持久数据；根 Git 忽略
├── clerkmesh-state/                   # ClerkMesh 可恢复运行状态；根 Git 忽略
├── cache/                             # 可删除缓存；根 Git 忽略
└── bin/clerkmesh                      # init/web/primary launcher
```

Web UI 采用已选定的 Calm object workspace：Conversations、Work、Company、Reviews 四个顶层领域。prototype 中的 vanilla HTML/JS 只保留为交互证据，不作为产品实现基础。

### Firstmate code root 与 operational home

V1 取消独立根层 `home/`。`firstmate/` 同时是：

- 根仓库直接跟踪的 Firstmate code root；
- Primary cwd；
- Primary `FM_HOME`。

Firstmate 自己的 ignore 契约保护运行目录：

```text
firstmate/
├── AGENTS.md、bin/、skills/           # ClerkMesh 根 Git 跟踪
├── data/                              # Firstmate backlog/registry/task data；忽略
├── state/                             # Firstmate runtime state；忽略
├── config/                            # Firstmate本地配置；按既有规则忽略
└── projects/<name>/                   # Firstmate Projects；忽略
```

这使 Ticket 13 的 `firstmate/projects/<name>` 成为真实 Project 路径，并保持 Firstmate 默认 `FM_HOME` 解析行为。V1 不直接注册任意 external absolute path Project。

### ClerkMesh 本地状态

Clerk 与 Learning 状态不进入 `firstmate/data/`：

```text
clerks/<name>/                         # 每个 Clerk 的独立 Git 权威

clerkmesh-data/
├── clerks.md                          # Clerk registry
├── learning/                          # Source/Proposal/target review/decision
└── audit/                             # Clerk受支持接口使用记录

clerkmesh-state/
├── clerk-lifecycle.lock
├── clerk-lifecycle.transaction
├── capabilities/                     # brief-bound Worker capabilities
└── learning-runs/                    # Herdr extraction run endpoints/reconciliation

cache/                                 # 任意可重建 projection/cache
```

`clerkmesh-data/` 是持久产品数据；`clerkmesh-state/` 中的 lock、journal、capability 和 run metadata 可通过各自权威恢复；`cache/` 可直接删除。Learning candidate staging 必须位于 canonical Clerk working tree 外，置于对应 Proposal 的持久目录中。

### Canonical path 注入

`bin/clerkmesh` 先解析并 canonicalize root，再向所有子进程注入绝对路径：

```text
CLERKMESH_ROOT=<repo-root>
CLERKMESH_DATA=<repo-root>/clerkmesh-data
CLERKMESH_STATE=<repo-root>/clerkmesh-state
CLERKMESH_CLERKS=<repo-root>/clerks
CLERKMESH_CACHE=<repo-root>/cache
FM_ROOT_OVERRIDE=<repo-root>/firstmate
FM_HOME=<repo-root>/firstmate
```

Primary cwd 固定为 `firstmate/`；Web 不把自己的 cwd 当契约；Worker cwd 始终是 Project worktree。Bash 脚本使用 launcher 注入的绝对路径，生产运行不得靠 `../../` 或调用时 cwd 猜位置。所有外部输入路径 canonicalize 后还需验证位于对应允许根目录中。

### 进程拓扑

V1 采用一个前台 Web 进程，不运行 daemon：

```text
Browser
  ↕ HTTP + WebSocket
Node Web process
  ├── Fastify HTTP API
  ├── ws event/lease channel
  ├── in-memory projection cache
  ├── Primary Supervisor
  └── Conversation Bridge
          ↕ stdin/stdout JSONL
      Pi RPC Primary child
          ├── ClerkMesh Primary Extension → CLERK.md
          └── Firstmate Primary
                └── Firstmate Bash control plane
                      └── Herdr workspace + Treehouse worktrees
```

`bin/clerkmesh web` 在前台运行。关闭浏览器不停止 Web；`Ctrl-C` 或 Web 退出时终止它创建的 Pi RPC Primary，但不关闭 Firstmate Workers 或 Learning extraction Agents。V1 不实现 systemd、launchd、PID daemon、开机启动或 Web/Primary 自动重启。

终端入口为：

```text
bin/clerkmesh primary --tui
→ cwd=firstmate/
→ pi -e <absolute-primary-extension>
```

Web 与 TUI 复用 Firstmate 单写锁；第二个 Primary按 Firstmate契约进入只读，不由 Web 预探测、接管或终止。

### Pi Session 与 Conversation Bridge

Pi Session JSONL 是聊天历史唯一权威。Web 只列出 session metadata 中 cwd canonicalize 后等于当前 `firstmate/` 的 Pi Session；其他仓库、metadata 缺失或路径不兼容的 session 默认隐藏。V1 不提供浏览所有全局 Pi Session 的开关。

Web 只读浏览历史时不启动 Pi。Captain 首次发送消息时，Supervisor 通过共享 startup promise 懒启动唯一 Pi RPC Primary并转发消息。Primary 运行期间不允许热切换或新建 session；Primary 退出后不自动恢复，Captain重启 ClerkMesh 后重新选择 session。

HTTP 承载查询和修改请求；WebSocket 承载回复流、状态更新、扩展 UI、心跳和浏览器写租约。`(client token, requestId)` 只提供 Web 进程生命周期内的幂等；3 秒重连窗口与显式 `claim-write` 沿用 Ticket 04。client token 不是身份凭证。

普通模式只显示可见对话、简单状态、通知、错误与 extension UI；诊断模式可显示 reasoning、tool/RPC 事件并警告敏感内容。Bridge 不解析 ANSI 终端。

### Primary Extension 与 Clerk 执行上下文

`packages/pi-primary-extension/CLERK.md` 是 Clerk 编排行为规则。Extension 在每次 `before_agent_start` 中完整且只追加一次，并注册 `/clerkmesh-status` 供 launcher/Web 验证加载成功。

Extension 不选择 Clerk、不修改输入、不拦截 spawn、不写 Task/brief/`.meta`、不维护 assignment。Primary 通过 Clerk CLI 完成：

```text
clerk-candidates.sh
→ clerk-shortlist.sh
→ semantic selection by Primary
→ clerk-brief-compile.sh
```

当前 Worker/follow-up 使用同一 brief、Clerk commit 和 capability；新的 Worker execution 可重新选择。Worker 只通过 `clerk-context.sh list|search|read` 读取 brief allowlist 中固定 commit/blob 的资料。同 OS 用户的 Bash 边界不宣称是恶意进程安全沙箱。

### CLI 与 Web API 分工

所有修改意图必须成为当前 Primary 对话中的可见 Captain 消息：创建 Project、暂停 Task、批准 local merge、创建/归档 Clerk、Learning approve/reject 等都不得由浏览器直接写私有状态。Primary 作出语义判断后调用确定性 Bash。

Agent-facing Bash 命令保留各自的 token-efficient 契约：tab、Markdown、diff、简短 stdout、stderr 诊断和零/非零 exit；不强制统一 JSON envelope。包括：

```text
Firstmate: fm-project-init-local.sh, fm-project-preflight.sh,
           fm-project-set-mode.sh, fm-spawn.sh, fm-review-diff.sh,
           fm-merge-local.sh, fm-teardown.sh

Clerk lifecycle: clerk-create.sh, clerk-register.sh, clerk-validate.sh,
                 clerk-inspect.sh, clerk-review.sh, clerk-commit.sh,
                 clerk-archive.sh, clerk-restore.sh

Clerk context: clerk-candidates.sh, clerk-shortlist.sh,
               clerk-brief-compile.sh, clerk-brief-inspect.sh,
               clerk-context.sh list|search|read

Learning: learning-capture.sh, learning-target.sh, learning-extract.sh,
          learning-review.sh, learning-revise.sh, learning-approve.sh,
          learning-reject.sh, learning-inspect.sh
```

Web 只能直接调用公开的只读投影。它不得解析 registry Markdown、brief prose、`.meta`、status log 或 terminal text。

### 版本化只读投影

跨 Web 边界的只读模型、HTTP 和 WebSocket payload 使用版本化 JSON Schema；schemas 位于 `packages/shared/schemas/`，TypeScript types 从 schema 生成，Fastify/Ajv 做运行时校验。Breaking change 新增 schema version，不原地改变 v1。

Firstmate V1 release 必须提供：

```text
fm-project-catalog.v1
fm-task-graph.v1
fm-herdr-agents.v1
fm-task-activity.v1
```

并保留现有 `fm-fleet-snapshot.sh --json` 和 `fm-bearings-snapshot.sh --json` 用于兼容与摘要。ClerkMesh 提供：

```text
clerk-catalog.v1
clerkmesh.execution-context.v1         # clerk-brief-inspect
learning-list.v1
learning-proposal.v1
```

每份投影声明 schema、provenance、freshness、unknown、omitted/errors。Web server 按 Task ID 把 Firstmate Task 与可空 `execution_clerk` 即时组合；组合结果只是页面 read model，不写回 Firstmate。

### 刷新与 WebSocket 推送

页面首次进入时立即查询相关投影。有 Web client 连接时，server 每 2 秒刷新 Task graph 与 Herdr Agent 投影，schema 校验后计算内容 hash；未变化不推送，变化后通过 WebSocket 发布新的 projection revision。

Project、Clerk 和 Learning 等低频投影在页面进入、显式 refresh 及相关 Primary 操作完成后刷新，不高频轮询。CLI 失败时可保留最后成功快照，但必须同时标记 stale/error 和观测时间，不能伪装成当前事实。Web 不建立任务数据库、事件总线或第二权威。

### Task activity

Firstmate 在：

```text
firstmate/data/<task-id>/activity.jsonl
```

维护 append-only、带时间的结构化 Task activity。只有 Firstmate 确定性控制面写入 spawn、accepted status、blocked、decision、validation、landed、teardown 等关键事实。

Worker status 被 Firstmate 接受时记录的是“Firstmate 观察到该状态”的时间，不伪造 Worker 真实发生时间。Activity 不记录 reasoning、终端内容或完整聊天；Pi Session 继续拥有对话。`fm-task-activity.v1` 按 cursor 输出该日志。

### Learning extraction runtime

Learning extraction 不伪装成 Firstmate Task，也不写 backlog、Task `.meta` 或 Work graph。`learning-extract.sh` 使用独立 Pi extraction Agent，并将所有 runs 放入一个专用 Herdr workspace：

```text
clerkmesh-learning-<canonical-root-short-hash>/
├── learning-<proposal>-<target-clerk-a>
└── learning-<proposal>-<target-clerk-b>
```

每个 `(proposal, target Clerk)` 使用独立 tab；V1 由 Primary 顺序启动各目标，未来可在不改变 Proposal 状态模型的前提下增加并发。Agent 只得到不可变 Source、目标固定 base commit 和目标 staging，不能写 canonical Clerk repository。

Learning Proposal manifest 是流程权威，Herdr 只是执行承载和可观察 endpoint。run metadata 位于 `clerkmesh-state/learning-runs/`。Primary/Web 退出不终止 extraction Agent；下次 launcher 启动只 reconcile：

- tab alive → `extracting`；
- 完整 candidate tree 存在 → 校验后 `review-ready`；
- tab 消失且无完整结果 → `interrupted/failed`。

系统不自动 relaunch、approve 或 commit。Captain可明确要求重新提取。成功结果和状态先持久化，再清理 tab；workspace 长期复用。测试使用独立 root hash/workspace，不触碰真实 Firstmate fleet。

### 状态所有权

| 事实 | 唯一权威 |
|---|---|
| 对话历史 | Pi Session JSONL |
| Project、Task、依赖、brief、runtime、delivery | Firstmate |
| Worker实时状态 | Firstmate + Herdr adapter 语义投影 |
| Clerk identity、knowledge、approved version | Clerk Git repository |
| Clerk active/archive registry | `clerkmesh-data/clerks.md` |
| 当前执行 Clerk | 当前 brief 的标准 Clerk snapshot |
| Learning流程 | Proposal manifest 与每目标 review/decision |
| 已学习内容 | 批准后的 Clerk Git commit |
| 浏览器当前页面 | 可丢弃 Web 内存投影 |
| 浏览器写资格 | Web 进程内 client lease |

Web 不旁路修改任何领域权威。

### 初始化

V1 提供显式、幂等的：

```text
bin/clerkmesh init
```

它验证 provenance、`firstmate/` 无嵌套 `.git`、目录可写和版本基线；创建 Firstmate `data/state/projects`、ClerkMesh data/state/cache；初始化 `clerkmesh-data/clerks.md`；创建并验证不可删除的 `clerks/escalation/` Git repository；检查 Pi、Node、pnpm、Git、Herdr、Treehouse 与兼容能力。

`init` 不启动 Web、Primary、Worker 或 Learning Agent；重复执行只补缺失项，不覆盖已有数据，也不清理已有 Learning runs。`web` 和 `primary --tui` 在未初始化时明确失败并提示 init，不做懒初始化。

### 恢复语义

- Web refresh/reconnect：使用最多 10,000 个规范化事件的内存快照；进程退出后丢弃并从 Pi Session/只读投影重建。
- Pi RPC Primary exit：标记 offline，不自动重启；Web 创建的 Primary 随 Web 退出。
- Firstmate Workers：Web/Primary 停止后继续在 Herdr运行；下次由 Captain 手动恢复 Primary并让 Firstmate reconcile。
- Learning Agents：继续在专用 Herdr workspace运行；下次启动 reconcile，不自动重启失败 run。
- Clerk lifecycle：短锁、transaction journal 与 Git compare-and-swap 按 Ticket 11 恢复。
- Learning：Proposal manifest 和 candidate tree 跨进程持久；未完整候选不可审核或批准。
- Read projection failure：展示 stale/error，不写 fallback 状态。

### 网络、Actor 与凭据

Web 默认只监听 `127.0.0.1`；非 loopback 显示风险警告但 V1 不提供 TLS、登录、SaaS 或公网安全保证。始终校验 Host、Origin 和 Content-Type。

V1 不实现 User、Role、Tenant 或 authorization，但 ClerkMesh 自己的持久决定记录最小 Actor provenance：

```json
{"actor":{"type":"captain","id":"local"}}
```

它用于 Learning capture/review/decision、Clerk lifecycle 与 Project mode 变更审计，不进入 Firstmate Task owner，不把 Web client token 当 Actor，也不执行权限判断。未来多用户可替换真实 Actor ID 并在外层增加 tenant/authorization。

ClerkMesh 不保存模型或 forge credentials。Pi/provider、`gh`/`glab`、Git credential/SSH 和 Herdr 继续拥有各自凭据。Web 不提供密钥录入；diagnostics 对环境变量、Authorization header 和已知 token 字段脱敏；preflight 只报告 readiness，不回显 secret。

### V1 release gates

除各前置 Ticket 的回归外，系统架构至少证明：

1. clean init 和重复 init；
2. Web/TUI canonical path 与同一 `FM_HOME`；
3. Pi Session 过滤和懒启动；
4. Web/TUI 双 Primary 单写；
5. Extension 注入完整且只一次；
6. Clerk selection → brief compile → Worker progressive context；
7. 四个 Firstmate read projection 通过 schema 和 freshness 测试；
8. 2 秒 polling 只在内容变化时推送；
9. local-only 与现有远端 delivery 均不回归；
10. Learning Agent 在专用 Herdr workspace完成、跨 Primary退出继续、重启 reconcile；
11. Web/Primary/Worker/Learning各自退出边界不产生错误状态所有权；
12. diagnostics 与 Web 普通模式不泄漏 credentials、reasoning 或 terminal content。
