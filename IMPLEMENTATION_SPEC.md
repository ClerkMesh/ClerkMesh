# ClerkMesh V1 实施规格

Status: implementation-ready

Target: Release Candidate → Captain UAT → V1
Supported platform: macOS 15+ / Apple Silicon (`arm64`)

## 1. 文档职责

本文是 ClerkMesh V1 的唯一实施入口。它规定必须交付的产品边界、组件契约、实施顺序和验收门禁，但不重复各决策的推导过程。

规范词语 **必须**、**不得**、**应**、**可以** 分别表示 mandatory、prohibited、recommended、optional。Requirement ID 在 V1 内保持稳定；实现、测试和验收证据必须引用对应 ID。若本文与被链接的决策详情冲突，应停止实施并修正规格，不得自行选择其一。

领域语言以 [`CONTEXT.md`](CONTEXT.md) 为准。尤其：Task 不永久归属 Clerk；Worker 不是 Clerk；Captain 不是账号；Pi Session 不是浏览器 session。

## 2. V1 成功场景

V1 发布时必须同时完成以下场景：

1. Captain 在 Web 中零 Token 浏览当前 ClerkMesh home 的 Pi Session，首次发送时懒启动唯一 Primary，并获得流式回复。
2. Primary 按当前 Task 动态选择一个 active Clerk，把固定 Clerk commit 编译进 brief，再通过普通 Firstmate Worker 完成执行。
3. Captain 创建无 remote 的本地 Project，观察 Task graph、运行状态和 activity，批准安全 fast-forward landing，并完成 fail-closed teardown。
4. 真人 Clerk 不派生 Worker；Captain 代录过程和 Markdown 结果。若成果需要修改 Project，Primary 创建新的 Agent Task并重新选择 Clerk。
5. Captain 从明确导入或真人 Task 建立 Learning Source，对一个或多个 Agent Clerks 分别审阅完整 diff，并独立批准或拒绝。
6. Web、Primary、Worker 和 Learning Agent 在各自退出边界内不争夺其他领域的状态所有权，重启后能按权威事实恢复或诚实报告 unknown/stale。

## 3. 固定范围

### 3.1 支持基线

- **PLAT-001**：V1 仅正式支持 macOS 15+、Apple Silicon `arm64`。
- **PLAT-002**：Intel macOS、Linux 和 Windows 可以保持源码可移植性，但不得标记为 supported。
- **PLAT-003**：实现开始时必须记录并冻结 Firstmate provenance；随后记录实际认证的 Pi、Node、pnpm、Git、Herdr 和 Treehouse 版本。不得把开发机偶然版本当作未记录的契约。
- **PLAT-004**：Primary harness 与 Worker harness 只支持 Pi，runtime backend 只支持 Herdr，worktree provider 只支持 Treehouse。

### 3.2 明确排除

V1 不实现登录、多用户、权限、tenant、TLS 或公网安全保证；不实现 Pi/Herdr 之外的 harness/runtime；不实现 Secondmate local Project materialization；不实现 GitLab 创建/合并 parity；不实现 Firstmate upstream 同步、更新、patch replay、多版本、rollback 或既有 Home 自动迁移；不嵌入 Worker 终端；不提供同 OS 用户下的恶意进程安全沙箱；不把多个 Clerks 混入同一次执行。

## 4. 系统边界与目录

### 4.1 Monorepo

- **BASE-001**：使用 `pnpm` workspaces，不引入 Nx、Turborepo、数据库、消息队列、GraphQL 或微服务。
- **BASE-002**：目标布局必须为：

```text
clerkmesh/
├── apps/web/client/                  # React + TypeScript + Vite
├── apps/web/server/                  # Node + TypeScript + Fastify + ws
├── packages/shared/                  # JSON Schema + generated TS types
├── packages/pi-primary-extension/    # Extension + CLERK.md
├── packages/clerk-cli/               # lifecycle/context/learning Bash control plane
├── firstmate/                         # vendored source + Primary cwd/FM_HOME
├── firstmate.provenance.json
├── clerks/                            # ignored; independent Clerk Git repos
├── clerkmesh-data/                    # ignored; persistent product data
├── clerkmesh-state/                   # ignored; recoverable runtime state
├── cache/                             # ignored; disposable
└── bin/clerkmesh
```

- **BASE-003**：`firstmate/` 必须由根 Git 直接跟踪，不得包含嵌套 `.git`，也不得是 submodule、subtree、运行时 clone 或 patch stack。
- **BASE-004**：`firstmate/` 同时是 Primary canonical cwd、`FM_HOME` 和 `FM_ROOT_OVERRIDE`；Firstmate 的 `data/`、`state/`、`projects/` 必须被根 Git 排除。
- **BASE-005**：Clerk 产品语义不得下沉到 Firstmate `.meta`、backlog、runtime 或 watcher。直接修改 `firstmate/` 只用于锁、local-only、read projection、activity 等通用能力。

### 4.2 Provenance 与初始化

- **INIT-001**：开始实现时从 Firstmate upstream 默认分支当时最新 HEAD 复制源码，验证默认分支 HEAD，并记录 repository URL、完整 SHA、UTC 复制时间、许可证和 attribution。
- **INIT-002**：研究 SHA 只作证据，不得替代最终 `firstmate.provenance.json`。
- **INIT-003**：`bin/clerkmesh init` 必须显式、幂等地验证 provenance、目录布局、写权限和依赖，创建受支持的数据目录、registry 及不可归档的内置 Escalation Clerk 与 Research Clerk；不得启动任何进程。
- **INIT-004**：`web` 和 `primary --tui` 在未初始化时必须明确失败，不得懒初始化。
- **INIT-005**：V1 不迁移任意既有 Firstmate Home。发现未知、冲突或不符合当前契约的状态时必须拒绝并报告，不得猜测迁移；符合当前版本的数据可由幂等 `init` 补齐缺失项。

### 4.3 Canonical paths

- **PATH-001**：launcher 必须 canonicalize root，并向子进程注入 `CLERKMESH_ROOT`、`CLERKMESH_DATA`、`CLERKMESH_STATE`、`CLERKMESH_CLERKS`、`CLERKMESH_CACHE`、`FM_ROOT_OVERRIDE` 和 `FM_HOME` 的绝对路径。
- **PATH-002**：生产脚本不得依赖调用方 cwd 或 `../../` 推导产品路径。
- **PATH-003**：任何外部输入路径 canonicalize 后必须验证仍位于对应允许根目录内；symlink、submodule 和 traversal 必须 fail closed。

## 5. 权威状态与进程拓扑

### 5.1 唯一权威

| 事实 | 唯一权威 |
|---|---|
| 对话历史 | Pi Session JSONL |
| Project、Task、依赖、brief、Worker、delivery | Firstmate |
| Worker实时状态 | Firstmate + Herdr adapter projection |
| Clerk identity、approved knowledge/version | Clerk Git repository |
| active/archive Clerk | `clerkmesh-data/clerks.md` |
| 当前执行所选 Clerk | 当前 brief 的标准 execution-context 块 |
| Learning 流程 | Proposal manifest 与逐目标 review/decision |
| 已批准学习内容 | Clerk Git commit |
| 页面缓存和写租约 | Web 进程内存；可丢弃 |

- **OWN-001**：不得建立第二套聊天、Task、fleet、Project、assignment 或 Learning 权威。
- **OWN-002**：Web 修改意图必须成为当前 Primary 对话中的可见 Captain 消息，再由 Primary 判断并调用确定性 Bash。
- **OWN-003**：V1 持久决定必须记录 `{"actor":{"type":"captain","id":"local"}}` provenance，但不得据此实现账号或权限。

### 5.2 进程

```text
Browser
  ↕ HTTP + WebSocket
Foreground Node Web process
  ├── Fastify API
  ├── ws event/write-lease channel
  ├── disposable projection cache
  ├── Primary Supervisor
  └── Conversation Bridge
        ↕ stdin/stdout JSONL
      Pi RPC Primary child
        ├── ClerkMesh Primary Extension
        └── Firstmate control plane
              └── Herdr Workers + Treehouse worktrees
```

- **PROC-001**：V1 使用一个前台 Web 进程，不实现 daemon、自动启动或 Web/Primary 自动重启。
- **PROC-002**：Web 退出时必须终止自己创建的 Pi Primary，但不得终止 Workers 或 Learning Agents；关闭浏览器标签不得停止 Web。
- **PROC-003**：`bin/clerkmesh primary --tui` 和 Web 必须加载同一 Extension、使用同一 canonical `FM_HOME` 和 Firstmate 单写锁。

## 6. Conversation Bridge

- **CONV-001**：Web 只列出 session metadata cwd canonicalize 后等于 `firstmate/` 的 Pi Sessions；只读浏览不得启动 Pi 或调用模型。
- **CONV-002**：选中历史在首次发送前只属于 URL/browser state。首条消息必须通过共享 startup promise 懒启动唯一 Pi RPC Primary。
- **CONV-003**：Primary 运行期间必须禁用 session 切换和新建；Primary 退出后标记 offline，不自动重启。重新选择必须重启 ClerkMesh 流程。
- **CONV-004**：Bridge 必须使用 Pi RPC 消息和事件，不得解析 ANSI 终端。
- **CONV-005**：HTTP 承载查询和修改请求；一条 WebSocket 承载回复流、投影事件、extension UI、心跳和写租约，不同时维护 SSE。
- **CONV-006**：所有修改请求携带 `requestId`；仅在当前 Web 进程内以 `(client token, requestId)` 幂等，重启后不承诺延续。
- **CONV-007**：首个 token 可取得写租约；其他 token 只读。主连接断开后保留 3 秒重连窗口，超时后只允许显式 `claim-write` 或新连接在空缺时取得写资格。
- **CONV-008**：client token 只用于本地写租约，不得称为认证凭据或 Actor identity。
- **CONV-009**：内存投影最多保留 10,000 个规范化事件；刷新先取 snapshot 再按单调序号继续。Web 重启后从 Pi Session 重建持久消息，不伪造未持久化事件。
- **CONV-010**：普通模式只显示可见消息、简单状态、通知、错误和 extension UI；诊断模式才可显示 reasoning/tool/RPC 细节，并必须警告和脱敏。
- **CONV-011**：Bridge 不预探测、接管或影子实现 Firstmate lock。第二 Primary 必须由 Firstmate 自身进入只读。

## 7. Clerk 与执行上下文

### 7.1 Clerk repository

- **CLERK-001**：每个 Clerk 是 `clerks/<name>/` 下的独立 Git repository，`CLERK.md` 是严格入口；完整 schema、固定六节、目录、大小和禁止对象按 [Ticket 03](.scratch/clerkmesh-firstmate-evolution/issues/03-define-clerk-repository-contract.md) 实现。
- **CLERK-002**：Git commit SHA 是唯一批准版本。dirty 内容不得参与选择、编译或检索；历史对象缺失必须失败，不得回退到 HEAD。
- **CLERK-003**：registry 只保存 name、canonical path、`active|archived` 与 built-in；普通 Clerk 只归档，同名不得复用。
- **CLERK-004**：Escalation Clerk 必须是内置、human、不可删除、不可归档，且不得被当作普通能力匹配成功。
- **CLERK-005**：只有经 Captain 审阅并提交、且由 `skills/*/SKILL.md` 明确引用的脚本是批准能力；其他代码块只是内容。Clerk 内容不得扩大 Worker 原权限。
- **CLERK-006**：Research Clerk 必须是内置、Agent-executed、不可删除、不可归档，且不得被创建或注册为普通 Clerk。与 Escalation Clerk 不同，Research Clerk 参与普通语义匹配：仅在没有更专精 Clerk 完全匹配当前执行时，才作为有界的来源发现、核实、比较与引用报告后备被选中；不得承担实现、产品决策或泛化通才职责。

### 7.2 Lifecycle CLI

- **LIFE-001**：实现 `create/register/validate/inspect/review/commit/archive/restore` 八个窄 Agent-facing Bash 命令，不做总 dispatcher 或传统交互 CLI。
- **LIFE-002**：stdout 只输出请求的紧凑 tab、Markdown 或 diff；诊断写 stderr；只约定零成功/非零失败，不建立全局业务码或统一 JSON envelope。
- **LIFE-003**：写操作共用 `clerkmesh-state/clerk-lifecycle.lock` 短锁；live PID 不得被夺锁。
- **LIFE-004**：transaction journal、atomic registry rename、staged repository publish 和 Git `update-ref` compare-and-swap 必须支持 crash recovery，不得重写历史或删除导入源。
- **LIFE-005**：Web 只消费单独的版本化 `clerk-catalog.v1`，不得解析 registry Markdown。
- **LIFE-006**：Clerk bootstrap 是 Captain 审阅下的 Primary 控制面操作，不要求先选择 Clerk、Escalation、Task、Brief 或 Worker。Primary 必须先验证并展示绑定名称、完整内容和 SHA-256 inventory 的草案；Captain 明确批准同一草案后只能通过 canonical lifecycle CLI 创建、Git 批准并原子注册。任何内容变化必须重新批准，bootstrap 不得执行该 Clerk 的专业工作。

### 7.3 Primary selection 与 brief

- **EXEC-001**：Extension 必须在每次 `before_agent_start` 完整且只追加一次简洁英文 `CLERK.md`，并注册 `/clerkmesh-status`。
- **EXEC-002**：launcher 在 writable Primary 可用前必须通过 `get_commands` 验证 `/clerkmesh-status`；Extension 缺失不得降级运行。
- **EXEC-003**：Extension 只注入行为规则，不得选择 Clerk、修改输入、拦截 spawn、写 brief/`.meta` 或维护 assignment。
- **EXEC-004**：每次新执行前，Primary 必须按 candidates → shortlist → semantic selection → brief compile 渐进选择；匹配不得变成标签评分器、向量路由或持久 owner。
- **EXEC-005**：无法理解、安全拆分或完整匹配的请求必须留在 Primary 对话澄清。只有 Captain 明确选择亲自处理时才能选 Escalation Clerk。Clerk 与受保护的本地 Project bootstrap 是建立执行环境的 Primary 控制面操作，不得因缺少可选 Clerk 路由到 Escalation 或制造递归 Task。
- **EXEC-006**：默认自动规划和选择；Captain 明确要求时，执行前必须展示拆分、所选 Clerk、理由和边界并等待回应。
- **EXEC-007**：标准 `clerkmesh.execution-context.v1` 使用 canonical JSON 的 base64 与 SHA-256，固定 Task ID、Clerk name/execution/commit、身份、选择信息及 allowlist path/blob OID。
- **EXEC-008**：compile 时 Clerk commit 必须仍等于批准 HEAD，并原子写入现有 Firstmate brief；不得复制资料正文或建立 assignment 文件。
- **EXEC-009**：当前 Worker 和 follow-up 复用同一 brief、commit 与 capability；新的 Worker execution 可以重新选择并轮换 capability。
- **EXEC-010**：Worker 的 `list/search/read` 只接受 brief allowlist 中固定 commit/blob 的 `workflows/*.md`、`knowledge/*.md`、`cases/*.md`、`skills/*/SKILL.md`；必须拒绝 sources、脚本、任意路径和 traversal。
- **EXEC-011**：capability 位于 `clerkmesh-state/capabilities/` 且不写入 brief；受支持接口的读取和拒绝写入 audit。该 wrapper 是行为边界，不宣称同用户恶意隔离。
- **EXEC-012**：Agent Clerk 完全复用普通 Firstmate spawn/status/wake/follow-up/validation/delivery；不得增加 Clerk runtime、endpoint、watcher 分支或 retry policy。

## 8. Project、Task 与 Web read models

### 8.1 Local Project

- **PROJ-001**：Project 继续由 Firstmate `data/projects.md` 和 `firstmate/projects/<name>` 拥有；不得建立 ClerkMesh Project registry 或支持任意 external path。
- **PROJ-002**：Captain 未明确授权远端交付时默认 `local-only`，不得根据存在 `origin` 推断发布意图。
- **PROJ-003**：普通 startup 不检查 forge readiness。添加、切换或 dispatch `direct-PR|no-mistakes` 时才运行 mode-specific、只读 preflight。
- **PROJ-004**：Primary 和 `fm-spawn.sh` 必须调用同一 preflight；失败发生在 worktree、endpoint、Worker 和 `.meta` 创建前，并只阻塞对应 Task。
- **PROJ-005**：确定性 local Project init 必须创建 `main`、固定 README、baseline commit，最后登记 registry；preflight 失败零写入，执行失败保留并报告遗留路径，不自动删除。
- **PROJ-006**：local-only brief 不得注入 GitHub、PR、`gh-axi` 或 No Mistakes 规则；仍必须执行 Project 相关测试并报告证据。
- **PROJ-007**：保留 authoritative diff、cleanliness、validation、fast-forward、`yolo` authority、landed proof 和 fail-closed teardown；不得新增 landing 状态机。
- **PROJ-008**：mode 切换只影响新 Task；preflight 失败保留旧 mode，运行中 Task 保留 spawn 时契约。

### 8.2 版本化投影

- **READ-001**：Firstmate 必须提供 `fm-project-catalog.v1`、`fm-task-graph.v1`、`fm-herdr-agents.v1`、`fm-task-activity.v1`，并保留现有 fleet/bearings JSON。
- **READ-002**：ClerkMesh 必须提供 `clerk-catalog.v1`、`clerkmesh.execution-context.v1`、`learning-list.v1`、`learning-proposal.v1`。
- **READ-003**：所有跨 Web 边界模型必须有 `packages/shared/schemas/` 中的版本化 JSON Schema、生成 TS types 和 Fastify/Ajv runtime validation；breaking change 新增版本，不原地改变 v1。
- **READ-004**：每份投影必须声明 schema、provenance、freshness、unknown 和 omitted/errors。Web 不得解析 backlog、brief prose、report、`.meta`、status log 或 terminal text。
- **READ-005**：Web server 按 Task ID 即时组合 Firstmate Task 与可空 `execution_clerk`，仅称“当前/最近一次执行所选 Clerk”，不得写回或暗示 owner。
- **READ-006**：Firstmate 确定性控制面必须向 `data/<task-id>/activity.jsonl` 追加关键结构事件；接受 Worker status 时记录 Firstmate observed-at，不伪造发生时间，不记录 reasoning/chat/terminal。
- **READ-007**：有 Web client 时每 2 秒刷新 Task graph 与 Herdr Agents；schema 合法且内容 hash 变化时才推送。低频投影只在进入页面、显式 refresh 或相关操作后刷新。
- **READ-008**：查询失败可以保留最后成功快照，但必须同时显示 stale/error 与观测时间，不得伪装当前事实。

### 8.3 Web information architecture

- **UI-001**：采用 Calm object workspace，顶层固定为 Conversations、Work、Company、Reviews，一次聚焦一个持久对象并使用 breadcrumb。
- **UI-002**：未完成 Slice 对应的入口必须隐藏，不展示空壳、假数据或不可用按钮；不建设通用 feature-flag 平台。
- **UI-003**：Work 的 graph、running list 和 Task detail 必须来自同一投影；修改操作生成可编辑的当前对话消息。
- **UI-004**：Company 中 Project 与 Clerk 是不同对象页；Reviews 按 Proposal 和 target Clerk 展示 source、changed paths、完整 diff、base/tree identity 和警告。

## 9. 真人 Clerk

- **HUMAN-001**：选择 `execution=human` 时不得调用 `fm-spawn`，不得伪造 Worker、endpoint 或 Agent status。
- **HUMAN-002**：Captain 通过当前对话代录开始、过程、问题、证据和结果；最终 Markdown 进入 Firstmate `report.md` 并由 Primary按 acceptance criteria 验收。
- **HUMAN-003**：真人成果需要修改 Project、Git 或调用工具时，Primary 必须创建依赖该结果的新 Agent Task，并在执行前重新选择 Agent Clerk。
- **HUMAN-004**：真人 Clerk 不与 Captain 账号绑定；V1 不引入 User、owner 或权限。

## 10. Learning

- **LEARN-001**：只有 Captain 明确导入的证据或已接受的真人 Task 过程/结果可以创建 immutable Learning Source。Agent completion、report、wake 或 extraction output 不得自动学习。
- **LEARN-002**：Captain 明确重新导入 Agent 产物时必须保存 `agent_generated` provenance 并显示警告；这是新的 Captain 行为。
- **LEARN-003**：一个 Proposal 可选择多个不同的 active Agent Clerks；每个 target 固定独立 base commit、candidate tree、review 和 decision，不做跨仓库原子提交。
- **LEARN-004**：extraction 只生成 Markdown；不得生成 Skill、脚本、symlink、submodule、binary 或 executable。Source、candidate 和 canonical Clerk working tree 必须隔离。
- **LEARN-005**：每个 target 必须审阅 source preview、changed paths、完整 diff、validation、base/tree identity 和敏感警告。修改产生新 tree 并清除旧审阅；HEAD 变化令该 target stale，必须重新提取和完整复审。
- **LEARN-006**：approve/reject 按 target 独立；批准才以 compare-and-swap 提交 Source 与候选，拒绝不得改变 Clerk。提取结果不得递归成为 Source。
- **LEARN-007**：Learning extraction 不得伪装成 Firstmate Task。每个 target 使用专用 Herdr workspace 中的独立 tab，Proposal manifest 是权威，endpoint metadata 位于 `clerkmesh-state/learning-runs/`。
- **LEARN-008**：Primary/Web 退出不得终止 extraction。重启只 reconcile 为 extracting、review-ready 或 interrupted/failed；不得自动 relaunch、approve 或 commit。成功结果必须 persist before cleanup。

## 11. 网络、安全与凭据

- **SEC-001**：默认只监听 `127.0.0.1`；非 loopback 必须醒目警告。所有请求始终校验 Host、Origin 和 Content-Type。
- **SEC-002**：ClerkMesh 不保存模型或 forge credentials，不提供密钥录入。Pi/provider、Git/SSH、forge CLI 和 Herdr 各自拥有凭据。
- **SEC-003**：普通模式和 diagnostics 必须对环境变量、Authorization header 和已知 token 字段脱敏；preflight 只报告 readiness。
- **SEC-004**：同 OS 用户的通用 shell 不是保密、防篡改 sandbox；产品文档和 UI 不得声称硬隔离。
- **SEC-005**：破坏性、安全敏感或超出原请求的决定即使 `yolo=on` 也必须升级给 Captain。

## 12. 兼容策略

- **COMP-001**：兼容承诺限定为最终 vendored provenance commit 上的行为兼容，不承诺迁移或适配其他 upstream commit。
- **COMP-002**：必须回归 TUI Primary、Firstmate session lock、Worker supervision、fleet/bearings、local-only、direct-PR、no-mistakes、landing 和 fail-closed teardown。
- **COMP-003**：v1 JSON schema 一经发布不得破坏性修改；新增版本必须允许调用方 capability negotiation。
- **COMP-004**：V1 不兼容任意旧 Firstmate Home、预发布 ClerkMesh 数据格式或手工目录布局；未知状态 fail closed。
- **COMP-005**：普通 local-only 使用不得要求 GitHub/GitLab 账号、remote 或 forge authentication；远端能力缺失只阻塞明确选择的远端 Task。

## 13. 严格实施顺序

阶段验收顺序必须是：

```text
Gate 0 → Slice 1 → Slice 2 → Slice 3 → Slice 4 → Slice 5 → Release Gate
```

- **PLAN-001**：后续阶段不得在前置阶段未通过时被集成、启用或标记完成。
- **PLAN-002**：接口冻结后可以并行准备独立代码和测试，但不得绕过前置 Gate。
- **PLAN-003**：每阶段必须产出 requirement coverage、自动化结果、真实场景证据、已知风险和可重放命令。
- **PLAN-004**：Slice 1–5 是内部可合并里程碑，不单独承诺为完整 V1。

### Gate 0 — 可依赖基线（非产品切片）

实施：

1. 固定 Firstmate provenance、许可证和目录 ignore；建立 monorepo、shared schemas、launcher 与 `init` 骨架。
2. 在最终 provenance 上复核 `fm-lock.sh` Pi holder liveness；修复通用 helper，不在 Web 影子实现锁。
3. 建立 canonical path、local-only startup 和 Web/TUI 最小启动链。
4. 记录认证依赖版本和 arm64 环境。

退出条件：

- **G0-001**：clean init 与重复 init 通过，未知已有状态被拒绝。
- **G0-002**：`firstmate/` 无嵌套 `.git`，provenance 完整，运行数据不进入根 Git。
- **G0-003**：真实两个 Pi Primary 分别经 Web/TUI 竞争同一 home，第二个不能覆盖 live holder，只能只读。
- **G0-004**：无 `gh`/forge auth 的 ordinary startup 和 local-only preflight 通过。
- **G0-005**：Firstmate 原测试基线通过；若 lock blocker 未解决不得进入 Slice 1。

### Slice 1 — Web Conversation vertical

用户路径：浏览 Session → 选择 → 首次发送懒启动 → 流式回复 → extension UI → 刷新/重连 → offline。

实施范围：CONV 全部要求、单 Web 进程、React shell、Conversations、write lease、诊断边界、Primary Extension 加载验证。

退出条件：

- **S1-001**：历史浏览零模型调用，cwd 过滤正确。
- **S1-002**：并发首发只创建一个 Pi RPC child；首条消息不丢失或重复。
- **S1-003**：真实 Pi 完成 startup、可见流式回复、extension UI 和 `agent_settled`。
- **S1-004**：3 秒同-token 重连、第二 token 409、显式 claim-write 和进程内 request 幂等均通过。
- **S1-005**：刷新恢复 pending UI；Web 重启后只从 Pi 权威恢复，不伪造诊断片段。
- **S1-006**：Web 退出清理 Primary而不终止已有 Worker；Primary 不自动重启。

### Slice 2 — Agent Clerk execution vertical

用户路径：对话创建 Agent Clerk → Company 可见 → Primary 动态选择 → compile brief → ordinary Worker 渐进读取 → Work 显示 execution Clerk → follow-up/new execution。

实施范围：CLERK、LIFE、EXEC 的 happy path，最小 catalog、Task detail 即时组合和 Extension 行为规则。

退出条件：

- **S2-001**：create/validate/register 产生合法独立 Git repo；dirty 内容不泄漏。
- **S2-002**：Extension 每 run 完整只注入一次，Worker 不加载 Primary Extension。
- **S2-003**：真实 Primary 执行 candidates/shortlist/selection/compile，机器块 hash/schema/commit 可验证。
- **S2-004**：真实 Worker 只通过 capability 读取 allowlist 固定 blob；非法 path、sources、script 和 traversal 被拒绝并审计。
- **S2-005**：follow-up 保持旧 snapshot；新 Worker 可重新选择并轮换 capability。
- **S2-006**：Web 仅通过 inspect projection 显示“当前/最近一次执行所选 Clerk”，Firstmate `.meta` 无 Clerk 字段。
- **S2-007**：无法匹配时停留对话澄清，Escalation 不被自动选择。

### Slice 3 — Local Project delivery vertical

用户路径：创建无 remote Project → 建 Task/依赖 → Agent Clerk 执行 → 观察 graph/agents/activity → review/approve → fast-forward landing → teardown。

实施范围：PROJ、READ、完整 Work/Company Project 页、完整 lifecycle/recovery、远端 mode 非回归。

退出条件：

- **S3-001**：无 `gh` 和 auth 时完成 local Project baseline、spawn、测试、diff、批准、merge、landed proof 与 teardown。
- **S3-002**：`yolo=off` 无明确批准不能 merge；`yolo=on` 仍受安全条件约束。
- **S3-003**：四个 Firstmate projections 通过 schema、freshness、unknown、errors 和 cursor 测试。
- **S3-004**：真实 Herdr + Treehouse 状态正确投影；2 秒 polling 只在 hash 变化时推送。
- **S3-005**：Web/Primary/Worker 分别退出后按各自权威恢复，不产生假完成或假监督。
- **S3-006**：archive/restore、live lock、journal crash recovery 和 compare-and-swap 通过 kill/restart 测试。
- **S3-007**：隔离远端测试仓库中的 direct-PR/no-mistakes 回归通过；能力缺失不影响 local-only。

### Slice 4 — Human Clerk vertical

用户路径：选择真人 Clerk → 不派 Worker → Captain 代录 → Primary 验收 report → 需要 Project 修改时建立新的 Agent Task。

实施范围：HUMAN 全部要求、Escalation 明确选择、Company/Work 对应展示。

退出条件：

- **S4-001**：human execution 从开始到接受结果均无 endpoint、Worker、capability 或伪 Agent status。
- **S4-002**：普通真人 Clerk 与明确 Captain takeover 的 Escalation 路径均符合选择规则。
- **S4-003**：Project 修改被分离为依赖 Agent Task，并重新选择 Agent Clerk。
- **S4-004**：实施 Agent 必须在隔离 fixture 中充当测试 Captain，检查成功、拒绝和恢复路径，保存对话、report、投影及无 Worker 证据。
- **S4-005**：工程验收后标记 `awaiting-final-captain-uat`，但不得因此阻塞 Slice 5。

### Slice 5 — Learning review vertical

用户路径：capture Source → 选择多个 targets → extraction → 独立 diff review → revise/stale → approve/reject → Clerk commits。

实施范围：LEARN 全部要求、Reviews UI、Learning projections、专用 Herdr workspace 与 reconciliation。

退出条件：

- **S5-001**：明确导入和真人 Task 能创建 Source；Agent completion 与 extraction result 不能自动创建 Source。
- **S5-002**：真实 extraction Agent 对两个 targets 生成隔离、Markdown-only candidate；Primary/Web 退出后继续。
- **S5-003**：完整 diff review、修改后 review invalidation、HEAD race stale 和重新提取均通过。
- **S5-004**：一 target approve、另一 target reject 正常结束；只有批准目标产生 compare-and-swap Clerk commit。
- **S5-005**：重启 reconcile 正确分类 live、complete 和 interrupted run，不自动重启或决定。
- **S5-006**：实施 Agent 必须在隔离 fixture 中充当测试 Captain，执行 review/approve/reject，保存 source hash、base/tree、diff、decision 和 result commit 证据。
- **S5-007**：工程验收后标记 `awaiting-final-captain-uat`；模拟批准不得进入真实 Clerk 或业务数据。

## 14. 验证策略

### 14.1 自动化层

- **QA-001**：unit/contract tests 覆盖 schema、reducers、canonicalization、selection inputs、brief encoding、Learning state transitions 和 recovery decisions。
- **QA-002**：CLI integration tests 必须使用临时 roots 与真实 Git，覆盖 lock、kill/restart、atomic publish、dirty tree、CAS race、invalid path 和 fail-closed。
- **QA-003**：server integration tests 覆盖 HTTP/WebSocket、request idempotency、lease、projection hash、stale/error 和 Pi RPC fixtures。
- **QA-004**：Firstmate regression 必须覆盖其原测试及 ClerkMesh 修改的 lock、bootstrap、brief、preflight、projection、activity、delivery 和 teardown。
- **QA-005**：测试不得触碰真实 Clerk repositories、Firstmate fleet 或 Learning workspace；workspace 名必须包含 canonical test-root hash。

### 14.2 真实运行时认证

Mocks 不能替代以下认证：

- **CERT-001**：macOS 15+ arm64 上真实 Pi Web/TUI lock competition。
- **CERT-002**：真实 Pi RPC session、stream、extension UI、command discovery 和 Primary Extension 注入。
- **CERT-003**：真实 Herdr + Treehouse Worker 的 spawn、status、wake、follow-up、completion 和退出恢复。
- **CERT-004**：真实 Git local-only Project 的 init、worktree、validation、review、landing 和 teardown。
- **CERT-005**：真实 Learning extraction 的跨 Primary 继续和重启 reconcile。
- **CERT-006**：隔离远端 repository 中的 direct-PR/no-mistakes 行为回归；普通 local-only 测试不得依赖这些凭据。

Captain 只需在工具/凭据不可用、需要破坏性授权或最终 UAT 时参与。凭据仍由原工具持有，不得复制进 ClerkMesh 或验收证据。

## 15. 自主夜间执行协议

- **AUTO-001**：实施 Agent 在每个 Gate 失败时必须先自动诊断、修复、重跑，并记录每次失败与最终证据。
- **AUTO-002**：符合本规格、可逆且不涉及新产品决策的实现选择由 Agent自行完成。
- **AUTO-003**：只有规格冲突/变更、外部凭据、不可逆或破坏性操作、安全授权才请求 Captain。
- **AUTO-004**：前置 Gate 最终未通过时不得越过、集成或宣称后续 Slice 完成；可以准备独立工作，但交付物只能是 incomplete RC 与 blocker evidence。
- **AUTO-005**：Slice 4/5 由 Agent在隔离数据中完成工程检查，不设置夜间人工阻塞。
- **AUTO-006**：Agent不得替 Captain 作真实业务决定；自动场景的 review/approve/reject 仅是测试事实。

## 16. Release Gate

所有 Slice 通过后，必须重新从 clean root 执行而不是只汇总阶段绿灯：

1. clean init、重复 init、unknown-state refusal；
2. 全 requirement-to-test coverage，无未解释 skip；
3. 全自动测试与 Firstmate regression；
4. CERT-001 至 CERT-006 的真实认证；
5. 四种进程退出边界与 crash recovery；
6. normal/diagnostic 信息泄漏检查；
7. local-only 无 forge 依赖和远端 mode 非回归；
8. production build、launcher 和 arm64 clean-machine smoke test；
9. provenance、依赖认证版本、许可证、风险与操作文档完整。

- **REL-001**：上述通过后只能生成 Release Candidate；Slice 4/5 保持 `awaiting-final-captain-uat`。
- **REL-002**：Captain 次日只需集中执行一次真人 Clerk 流程、一次 Learning exact-diff review，并确认或拒绝发布。
- **REL-003**：Captain UAT 通过且无 release-blocking defect 后才能标记 V1；不得把 Agent 模拟批准当作该确认。
- **REL-004**：任何 requirement 未覆盖、真实认证失败、锁失效、状态双写、credential/reasoning 泄漏或 fail-open landing 均是 release blocker。

## 17. 风险与停止条件

| 风险 | 控制 | 停止条件 |
|---|---|---|
| Pi holder 被误判 stale | Gate 0 修复通用 lock + 真实双入口竞争 | 第二 Primary可覆盖 live PID |
| 最终 upstream 与研究基线不同 | 实现开始重新取 HEAD、冻结 provenance、重跑基线 | 来源/许可证不明确或原测试失败 |
| Pi RPC/extension capability 漂移 | 启动 capability check + 记录认证版本 | command、stream 或 UI 语义不满足 |
| Web 形成第二权威 | 只读 schemas、即时组合、可丢缓存 | Web 直接写私有 Firstmate/Clerk 状态 |
| 同用户 shell 被误认为 sandbox | 明示限制、allowlist wrapper、audit | 产品声称恶意隔离或处理需保密内容 |
| Git/registry crash 产生分叉 | journal、atomic rename、CAS、kill tests | 无法确定恢复方向或历史被改写 |
| Learning 污染真实 Clerk | staging 隔离、exact tree review、CAS | 未批准内容进入 canonical HEAD |
| remote 能力重新成为全局 gate | mode-specific preflight | 无 remote/auth 时 local-only 不可用 |
| 夜间 blocker 被绕过 | 严格阶段 gate + incomplete RC | 后续阶段依赖失败前置仍标绿 |
| 模拟 Captain 被当作真实批准 | fixture 隔离 + final UAT | 测试决定进入真实业务数据 |

## 18. 交接产物

实现团队最终必须交付：

1. 根仓库跟踪的产品源码和 vendored Firstmate；
2. `firstmate.provenance.json`、许可证和已认证依赖矩阵；
3. 所有 v1 schemas、生成 types 和兼容说明；
4. requirement → test → evidence 索引；
5. clean install、运行、诊断、备份和恢复说明；
6. 已知限制与风险清单；
7. Release Candidate build；
8. 一份不含 secret/reasoning/terminal content 的 Captain UAT checklist。

## 19. 决策追溯

| 主题 | 决策来源 |
|---|---|
| Firstmate integration 与 local-only事实 | [01](.scratch/clerkmesh-firstmate-evolution/issues/01-assess-firstmate-integration-boundary.md)、[02](.scratch/clerkmesh-firstmate-evolution/issues/02-assess-local-project-mode.md) |
| Clerk repository 与 context CLI | [03](.scratch/clerkmesh-firstmate-evolution/issues/03-define-clerk-repository-contract.md)、[06](.scratch/clerkmesh-firstmate-evolution/issues/06-design-clerk-context-cli.md)、[11](.scratch/clerkmesh-firstmate-evolution/issues/11-prototype-clerk-lifecycle-cli.md) |
| Conversation 与 Web boundary | [04](.scratch/clerkmesh-firstmate-evolution/issues/04-define-primary-conversation-bridge.md)、[14](.scratch/clerkmesh-firstmate-evolution/issues/14-define-web-firstmate-integration-boundary.md)、[15](.scratch/clerkmesh-firstmate-evolution/issues/15-prototype-web-firstmate-connector.md) |
| Clerk execution 与真人流程 | [05](.scratch/clerkmesh-firstmate-evolution/issues/05-define-clerk-task-lifecycle.md) |
| Learning | [07](.scratch/clerkmesh-firstmate-evolution/issues/07-design-clerk-learning-pipeline.md) |
| Web UX 与 read models | [08](.scratch/clerkmesh-firstmate-evolution/issues/08-prototype-web-task-experience.md)、[16](.scratch/clerkmesh-firstmate-evolution/issues/16-assess-firstmate-web-read-model.md) |
| Vendoring、Project 与系统架构 | [09](.scratch/clerkmesh-firstmate-evolution/issues/09-define-system-architecture.md)、[12](.scratch/clerkmesh-firstmate-evolution/issues/12-define-firstmate-evolution-strategy.md)、[13](.scratch/clerkmesh-firstmate-evolution/issues/13-define-local-project-contract.md) |
