# Firstmate Web 只读模型调研：现有零 Token CLI 与投影缺口

## 结论摘要

本报告检查 Firstmate 源码提交 `68ed7ed2355619749c6ee2bb91b7298dee420df8`。这里的“无 Token”指查询不启动 Pi/LLM、不要求 forge 登录且默认不访问网络；它不等于“不执行本机命令”。首版范围只采用已确定的 Pi Primary/Workers、Herdr backend、Treehouse、Web 只读任务视图以及 Firstmate 单写权威，不扩展到其他 harness/backend，也不把 Web 变成第二份任务状态库（ClerkMesh `.scratch/clerkmesh-firstmate-evolution/map.md:15-31`；`.scratch/clerkmesh-firstmate-evolution/issues/14-define-web-firstmate-integration-boundary.md:17-35,57-75`）。

**最可用的现成机器接口是 `bin/fm-fleet-snapshot.sh --json`，其次是它的紧凑投影 `bin/fm-bearings-snapshot.sh --json`。** `fm-fleet-view.sh --json` 只是前者的透传；不带 `--json` 的 fleet view、`fm-crew-state.sh`、`tasks-axi list/show` 都不是适合 Web 的 JSON 契约。现有快照可以零 Token 提供任务所属 Project（仅任务引用，不是完整 Project 清单）、`blocked-by` 依赖边、粗粒度 backlog/runtime 状态、若干等待线索、最后一条 wake event、endpoint 存在性、部分 Agent 存活性，以及 PR/report 指针。它**不能**完整提供当前或最近一次执行所选 Clerk、规范化投影阶段、统一等待原因、带时间的最近活动、每个 Herdr Agent 的原生状态和统一结果链接。

因此浏览器不应解析 `data/*.md`、`state/*.meta`、`state/*.status`、brief/report Markdown 或终端输出。Firstmate 应增加四个窄、只读、版本化通用 JSON 投影：`fm-project-catalog.v1`、`fm-task-graph.v1`、`fm-task-activity.v1`、`fm-herdr-agents.v1`；报告/PR 等统一放进 task graph 的 `results[]`，无需再建第五份领域状态。投影应由拥有语义的 Firstmate/Herdr adapter 读取现有权威源并显式标注 provenance、freshness、unknown/omitted，而不是让 Web 重建语义。

## 1. 当前可直接使用的结构化 CLI

### 1.1 `fm-fleet-snapshot.sh --json`：主读模型

脚本明确声明 `fm-fleet-snapshot.v1`、只读、不会拿 session lock、drain wake、arm watcher、改 backlog 或写 report；其顶层契约包括 backlog、tasks、scout reports、跨 secondmate 汇总及完整性披露（Firstmate `bin/fm-fleet-snapshot.sh:1-44`）。最终 JSON 固定写出 `schema/generated/fm_home/roots/backlog/tasks/main_inventory/scout_reports/secondmate_current/secondmate_landed`（`bin/fm-fleet-snapshot.sh:1305-1341`）。

它目前能给 Web：

- **任务与 Project 引用（部分）**：每个 live task 从 meta 投影 `project`，并带 backlog 的 `repo`；secondmate 还带 `secondmate_projects[]`（`bin/fm-fleet-snapshot.sh:390-530`）。这只能回答“某任务记录了哪个项目”，不能列出没有任务的 Project。
- **任务依赖图（大部分）**：结构化 backlog row 含 `id/state/title/repo/kind/priority`、`blocked_by_ids[]`、`unresolved_blocker_ids[]`、`blocked_reason`、`hold_reason/hold_kind`、`captain_actionable`、结果指针等；Done 节点也保留，因此可以组成 blocked-by DAG/一般有向图（`bin/fm-fleet-snapshot.sh:252-382`）。缺失 blocker 会保持 unresolved，而不是被当作已完成。
- **当前运行状态**：每个 meta task 调用 `fm-crew-state.sh`，把一行结果拆成 `current_state.{state,source,detail,raw}`，同时明确 status log 的 last event 只是历史事件（`bin/fm-fleet-snapshot.sh:201-238`）。task JSON 还加 `observed_at/freshness`（`bin/fm-fleet-snapshot.sh:462-530`）。
- **等待线索**：backlog 的 hold/dependency 字段、`hints.open_decisions[]`，以及 `parked|blocked|paused` 的 current-state detail 均已结构化；open decision 是对整个 status stream 的 keyed fold，不是简单 `tail -1`（`bin/fm-fleet-snapshot.sh:428-461`；`bin/fm-classify-lib.sh:145-241`）。
- **结果指针**：task 有 `pr.{url,source}` 与 report path/presence；backlog row 有 `links[]/pr_url/report_path/local_note/completion`（`bin/fm-fleet-snapshot.sh:321-350,493-518`）。
- **runtime endpoint**：每个 task 有 backend、target、endpoint existence；但 `agent_alive` 只对 `kind=secondmate` 实查，其他任务固定为 `not_checked`（`bin/fm-fleet-snapshot.sh:463-489`）。
- **跨 secondmate 当前汇总**：注册 home 的结构化库存优先，输出 current、active children、decisions、holds、queued、landed、endpoints、counts、omitted、provenance/freshness；父 status 和 terminal capture 只是补充证据（`bin/fm-fleet-snapshot.sh:1148-1249`）。

代价与边界：它会在本机读取 Git/no-mistakes 状态并探测 backend，不调用模型；跨 home 有超时、字节数和数量上限（`bin/fm-fleet-snapshot.sh:72-141`）。terminal capture 只用于 secondmate 矛盾诊断，源码明确把它标为 untrusted supplement，不能当当前状态（`bin/fm-fleet-snapshot.sh:913-969`）。Web 应忽略该诊断证据，而非尝试还原终端文字。

### 1.2 `fm-fleet-view.sh [--json]`：JSON 可复用，人类 Markdown 不可解析

`fm-fleet-view.sh --json` 原样执行 snapshot；普通模式则用 jq 渲染 Markdown 表格，脚本明确不重新解析 fleet state（`bin/fm-fleet-view.sh:1-23`）。普通输出把 current state/source、project、backend、endpoint、artifact 和 action 拼成显示文本（`bin/fm-fleet-view.sh:28-100`），适合人读，不是 Web 数据源。Web 可调用其 `--json`，但直接调用 `fm-fleet-snapshot.sh --json` 更清楚，也少一层无语义透传。

### 1.3 `fm-bearings-snapshot.sh --json`：适合首页摘要，不适合完整任务页

Bearings 是 snapshot 上的只读、有界 `fm-bearings.v1` 投影；默认 local-only、零 GitHub/network/auth，只有显式 `--include-prs` 才访问网络（`bin/fm-bearings-snapshot.sh:1-25,50-66`）。它输出 in-flight、secondmates、decisions、landed、gates、reports、recorded PRs 和 omission disclosure（`bin/fm-bearings-snapshot.sh:97-121,423-477`），很适合首页“运行中/等待/最近落地”摘要。

但其 `owner` 是 `"(main)"` 或 secondmate id，表示**home/路由归属**，不是 Clerk；源码在 decisions、gates、landed 映射中直接这样赋值（`bin/fm-bearings-snapshot.sh:363-417,429-434`）。它也有默认截断，因此不能作为完整图唯一来源。

### 1.4 `fm-crew-state.sh <id>`：权威派生逻辑可复用，文本接口不可直接给 Web

该命令的输出是一行固定文本：`state: ... · source: ... · detail`，状态集合为 `working|parked|done|blocked|paused|failed|unknown`；它明确区分 append-only status event 与当前状态（`bin/fm-crew-state.sh:1-21`）。优先级是匹配当前 branch/code identity 的 no-mistakes run-step，其次 pane busy，再其次可映射的 status event；没有匹配 run 且 endpoint 已死时返回 unknown，而不是相信旧日志（`bin/fm-crew-state.sh:22-50,541-592`）。

所以应继续由 fleet snapshot 内部调用它；Web 不应解析那条带分隔符的文本。它提供的是**执行状态**，不是产品业务阶段。

### 1.5 `tasks-axi` 与 Project mode：有结构语义，但没有合适的只读 JSON 契约

Firstmate 的兼容探针只保证 tasks-axi 版本、`update --archive-body` 和 multi-ID `mv`，没有保证 `list/show --json`（`bin/fm-tasks-axi-lib.sh:1-57`）。Firstmate 当前 startup digest 调用 `tasks-axi list --fields blocked_by,hold_kind,hold_reason` 后直接打印文本，失败则退回 Markdown title-line 渲染（`bin/fm-session-start.sh:65-81,173-190`）。因此 Web 不应依赖 tasks-axi dashboard/list/show 的终端格式；snapshot 对规范 backlog 行的 JSON 投影才是现有公共机器面。

Project registry 也只有 `fm-project-mode.sh <name>` 的两词输出 `<mode> <yolo>`；它直接 awk 解析私有 `data/projects.md`，且未知/缺失项目会警告后降级为 `no-mistakes off`（`bin/fm-project-mode.sh:1-24,31-69`）。这不够列 Project，也无法区分“真实默认值”和“未注册降级”。

## 2. 八项 Web 信息的覆盖矩阵

| Web 所需信息 | 当前零 Token 结构化覆盖 | 判断 |
|---|---|---|
| Project | snapshot task `project`、backlog `repo`、secondmate projects；无全量 catalog | **部分** |
| 任务依赖图 | backlog `blocked_by_ids[]`、`unresolved_blocker_ids[]`，含 Done 节点 | **基本可用**，但只覆盖规范 tasks-axi 行，且没有统一 node/edge 投影 |
| 执行所选 Clerk | 无执行期 Clerk 信息；bearings `owner` 只是 main/secondmate home | **缺失** |
| 投影阶段 | backlog state/current_role + crew execution state/detail + delivery mode | **仅原料**，无稳定 Web `phase` |
| 等待原因 | hold、blocker、open decision、paused/blocked detail 分散存在 | **部分**，无统一 kind/reason/since/owner |
| 最近活动 | last wake event raw/note；completion date；secondmate 有有限 parent-event evidence | **不足**，无通用 typed timeline 和事件时间 |
| Herdr Agent 状态 | endpoint exists；secondmate agent_alive；crew state 间接使用 busy | **不足**，普通 worker 无 raw native status |
| 结果链接 | PR URL、任意 backlog links、report filesystem pointer | **部分**，无统一 typed result/link，也没有安全 Web report URL |

另一个重要限制是库存一致性：live worker 以 `state/<id>.meta` 为准，snapshot 只用 `main_inventory` 披露“in-flight backlog 无 meta”和非结构化 current row，不会凭 backlog 发明 live task（`bin/fm-fleet-snapshot.sh:532-565`）。Web 必须展示 invalid/omitted，而不能把空数组解释成“没有工作”。

## 3. 为什么不能让 Web 读私有文件或终端

1. **metadata 是 volatile runtime routing，不是业务读模型。** `fm-spawn.sh` 写入 window/worktree/project/harness/kind/mode/yolo 以及 backend 私有 id；Herdr 还写 session/workspace/tab/pane id（`bin/fm-spawn.sh:1214-1254`）。AGENTS 同时规定 meta 由 spawn 写，PR/X 等命令后续追加，status 是 crew append 的 wake-event log（`AGENTS.md:82-90`）。Web 自行读写会绑定内部布局、竞争增量更新，并泄露无 UI 意义的 endpoint 标识。
2. **status 的最后一行不是当前状态。** keyed decisions 必须 fold 整个 stream；无关的后续 done/paused/working 不能掩盖尚未关闭的 decision（`bin/fm-classify-lib.sh:145-241`）。`fm-crew-state` 还要用 run-step/pane 判断旧 event 是否已被执行事实 supersede。Web 复刻会产生第二个分类器。
3. **终端文本不是证据权威。** snapshot 自己只在 secondmate 矛盾诊断中做有界 terminal capture，并把 provenance 标为 `untrusted-supplement`（`bin/fm-fleet-snapshot.sh:913-969`）。普通 Web 更不应解析 ANSI、prompt 或 agent prose。
4. **Markdown 是存储/人类界面，不是 Web 契约。** snapshot 已经为 canonical tasks-axi 行集中实现复杂解析和 inconsistency disclosure（`bin/fm-fleet-snapshot.sh:252-382`）；再在 TypeScript 中复制 regex 会让语义漂移。report Markdown 内容也只应通过受控 artifact 读取端点展示，不应反向推断任务状态或 Clerk。

## 4. Herdr 状态的具体缺口

Herdr 的权威本机读取是 `agent get <pane>` 的 `.result.agent.agent_status`。adapter 可识别 `working|idle|done|blocked` 为已注册 live agent（`bin/backends/herdr.sh:856-925`），但面向 watcher 的 busy classifier 把 `working -> busy`，把 `idle|done|blocked -> idle`，其他值变 unknown（`bin/backends/herdr.sh:1723-1771`）。这意味着现有 `fm-crew-state`/snapshot 路径会有意丢掉 “blocked 与 idle/done 的区别”。通用 backend API 也说明 target existence 只是 pane presence，而 `agent_alive` 是进程级 `alive|dead|unknown`，二者都不是 Agent 工作状态（`bin/fm-backend.sh:646-726`）。

因此 Web 不能把 `endpoint.status` 当 Herdr Agent 状态：snapshot 的 endpoint status 只综合 absent/alive/dead/unknown，且普通 ship/scout 的 agent_alive 根本不查。应由 Herdr adapter 新增公开、无副作用的结构化读取，并由版本化投影按 task id 返回；不能让 Web 使用 meta 中的 pane id 后自行调用 Herdr。

## 5. 建议补齐的四个窄投影

这些投影是 Firstmate 的**公共只读 API**，不是新数据库。每次查询从各自权威源生成；共同要求顶层含 `schema`、`generated`、`capabilities`（可选）、`records`、`omitted[]`/`errors[]`，每项动态事实含 `observed_at`、`freshness`、`source`。unknown 必须是显式值，不得用缺字段冒充 false。

### A. `fm-project-catalog.v1`

用途：Project 列表与项目筛选。建议最小字段：

```json
{"schema":"fm-project-catalog.v1","projects":[{"id":"firstmate","name":"firstmate","repo_root":"…","present":true,"git":true,"remote":null,"delivery":{"mode":"local-only","yolo":false},"registration":"registered"}]}
```

由 Firstmate 集中读取 project registry、clone/git 事实和 project mode；必须把 `registered|discovered|missing` 与 fallback 分开。不要输出 registry Markdown 原文。首版 local Git remote 可空，符合 settled scope。

### B. `fm-task-graph.v1`

用途：完整规划图和任务详情；可由 snapshot 演进/再投影，但不要让 Web join 多种私有格式。建议：

- task：`id,title,project_id,kind,backlog_state,phase`；
- edge：`{type:"blocks",from:<blocker>,to:<dependent>,resolved}`；
- wait：`null | {kind:"dependency|captain_decision|external|runtime_blocked|paused|unknown",reason,blocker_ids[],since,actionable_by}`；
- runtime 摘要：`state,source,observed_at`；
- `results[]`：`{kind:"pr|report|commit|external",href,label,status}`；report 用稳定 artifact id/受控 Web route，不把任意 filesystem path 当浏览器链接；
- consistency：`valid,reason,omitted`。

`execution_clerk` 不进入 Firstmate Task schema，也不写 runtime `.meta`。Web 进程调用 Clerk CLI 检查由 ClerkMesh 编译的标准 brief Clerk 块，再按 task ID 与 `fm-task-graph.v1` 即时组合；Task 尚未执行或旧 brief 没有标准块时返回 `null`。该字段只描述当前或最近一次执行，不是 Task owner。浏览器不解析 brief，Clerk CLI 也不得把 worker harness、secondmate 或 bearings owner 猜成 Clerk。未匹配请求留在 Primary 对话中澄清；只有 Captain 明确接手时，本次真人执行才选择 Escalation Clerk。

`phase` 应是稳定枚举（例如 `planned|ready|dispatched|executing|validating|awaiting_decision|awaiting_dependency|completed|failed|cancelled|unknown`），由 backlog + current-state + delivery pipeline 的唯一 Firstmate 分类器产生；保留底层 `backlog_state/runtime.state` 便于诊断，但 Web 不自行组合。

### C. `fm-task-activity.v1`

用途：最近活动列表与 WebSocket 增量。最小字段：`cursor,events[{id,task_id,at,type,summary,actor_kind,actor_id,source}]`，支持 `--since <cursor> --limit N`。只收录 Firstmate 已认可的结构事件：任务创建、执行期 Clerk 选择、依赖变化、dispatch、状态 transition、decision open/resolve、result recorded、done/failed；不要发送 status raw line、terminal text、report prose或 Pi reasoning。

现有 status 行没有内嵌时间，filesystem mtime 也不能还原每行时间，所以不能“投影”出可信历史时间线。Firstmate 后续写事件时应同时产生带时间、可排序的公共 activity record；旧数据只返回 `at:null`/`historical:true`，不能伪造时间。该日志是操作事实的只读审计投影，不是聊天库或第二份 task authority。

### D. `fm-herdr-agents.v1`

用途：运行任务系统视图。每个 Herdr task 返回：

```json
{"task_id":"t1","backend":"herdr","agent":{"present":"yes","status":"working","observed_at":"…","source":"herdr.agent.get"},"endpoint":{"exists":true}}
```

`status` 保留 Herdr 原生稳定集合 `working|idle|done|blocked|unknown`，`present` 使用 `yes|no|unknown`；读失败返回 reason/freshness。默认不暴露 session/workspace/tab/pane id，不返回 terminal capture。该投影必须调用 adapter 已有 session-scoped CLI 封装，因为裸环境变量可能查询错 session，通用 existence 实现也特意使用显式 session 路由（`bin/fm-backend.sh:658-683`）。

## 6. 版本与 schema 建议

当前 repo 没有独立 JSON Schema 文件；`fm-fleet-snapshot.v1`、`fm-secondmate-home-summary.v1`、`fm-bearings.v1` 的契约主要写在脚本 header、jq object literal 和运行时 jq validation 中（`bin/fm-fleet-snapshot.sh:1-44,562-675,1192-1205,1322-1341`；`bin/fm-bearings-snapshot.sh:50-66,423-445`）。这已经有 schema id，但还不是可供 Web build/CI 校验的 JSON Schema。

建议每个新投影同时提交 Draft 2020-12 schema（例如 `schemas/fm-task-graph.v1.schema.json`），CLI 支持 `--json` 和 `--schema-version v1`，并提供一个只读 capability 查询。兼容规则：v1 可追加 optional 字段/enum 的 unknown fallback；删除、改类型、改语义必须升 v2。Web 只依赖公开 schema，不依赖 shell 脚本实现细节。

## 7. 首版落地顺序（仅规格，不实现）

1. **立即可用**：首页摘要调用 `fm-bearings-snapshot.sh --json`（绝不加 `--include-prs`）；完整任务页调用 `fm-fleet-snapshot.sh --json`，诚实展示 unknown/invalid/omitted。
2. **第一个必补**：`fm-task-graph.v1` + `fm-project-catalog.v1`，尤其是 Project 全量与规范 phase/wait/results；`execution_clerk` 由 Web 进程通过 Clerk CLI 只读增强，不要求修改 Firstmate schema。
3. **第二个必补**：`fm-herdr-agents.v1`，避免把 endpoint/pane presence 误标成 Agent 状态。
4. **需要新增可追溯事实后再补**：`fm-task-activity.v1`；不要用 status mtime 或 Markdown 猜历史时间。
5. Web 的所有修改操作仍转换成当前 Pi RPC 对话中的可见用户消息；只读投影不获得写 backlog/meta/status 的能力。这与 settled 的“Pi session 是聊天权威、Firstmate/Herdr 是任务权威、Web 不建第二份权威”边界一致（`.scratch/clerkmesh-firstmate-evolution/issues/14-define-web-firstmate-integration-boundary.md:57-75`）。

最终判断：**Firstmate 已有一个质量较高的 fleet JSON 基底，依赖、执行状态、等待线索和结果指针不必重做；真正缺的是通用的 Web 归一化边界。** Firstmate 拥有的通用语义以四个小型 v1 投影发布；ClerkMesh 执行语义由 Web 进程通过 Clerk CLI 检查标准 brief 后即时增强。浏览器不对私有 Markdown、metadata、status event 或终端文本形成永久耦合。
