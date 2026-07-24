# Firstmate 架构与实现细节

> 本文汇总这些天对 Firstmate 的学习结果，目标是用一个文件保存完整、可继续扩展的架构心智模型。它是解释性笔记，不替代 Firstmate 当前版本的 `AGENTS.md`、Skills、脚本头部和正式文档。

## 1. Firstmate 是什么

Firstmate 是一个由 LLM 驱动、以 Bash 为确定性控制平面的持久软件工作协调系统。

```text
Captain（人类）
  ↓
Primary Firstmate（LLM 协调者）
  ↓
持久 backlog + task brief
  ↓
Bash control plane
  ↓
隔离的 Ship / Scout worker
  ↓
状态、监督、验证与交付
  ↓
Primary Firstmate 判断、推进或向 Captain 提问
```

核心分工：

- **LLM**：理解目标、拆分工作、选择 worker 形态、判断证据、处理不确定性。
- **`AGENTS.md` 与 Skills**：定义角色、权限、工作流和安全边界。
- **Bash 脚本**：验证输入并执行可重复的机械操作。
- **Git worktree**：隔离不同任务的工作目录、index、branch 和未提交状态。
- **runtime backend**：提供 worker 的终端 endpoint 和发送、捕获、探活、关闭能力。
- **磁盘状态**：让 backlog、任务、上下文、监督事件和交付证据跨会话恢复。
- **watcher**：低成本观察 fleet，只在需要判断时唤醒 Primary LLM。

最短总结：

> Firstmate 是 LLM manager；Bash 是控制系统；worktree 隔离执行；磁盘保存可恢复事实；watcher 只在需要判断时唤醒 LLM。

## 2. 它与普通 Coding Agent 的区别

普通 Coding Agent 也能创建 subagent。Firstmate 的价值不在于发明新的智能能力，而在于把委派组织成长期、可恢复、可审计的软件交付制度。

```text
普通 Coding Agent
→ 一次会话中的临时委派

Firstmate
→ 跨项目、跨 harness、跨 primary 会话的持久协调系统
```

它增加了：

- Captain 的统一协调入口；
- Ship、Scout、Secondmate 等明确角色；
- durable backlog、brief、report、metadata 与 status history；
- 每任务独立 worktree、branch、Agent session 和 backend endpoint；
- 事件驱动监督和崩溃恢复；
- validation、delivery、landed proof 和 fail-closed teardown；
- Pi、Claude Code、Codex、OpenCode、Grok 等 harness 适配；
- tmux、Herdr、Zellij、Orca、cmux 等 runtime backend 抽象。

## 3. 三层架构

### 3.1 推理层

Primary Firstmate 使用 LLM 决定：

- 请求属于哪个注册项目；
- 目标和 acceptance criteria 是否足够明确；
- 使用 Ship、Scout，还是拆成依赖任务；
- 哪些任务可以安全并行；
- 使用哪个 harness、model、effort、backend 和 delivery mode；
- worker 的结果是否真正满足目标；
- 是继续、追问、重构任务，还是请求 Captain 决策。

LLM 决定“应该发生什么”，但不应自行猜测 Git、进程、endpoint 或交付状态。

### 3.2 契约层

`AGENTS.md` 和 Skills 规定：

- Firstmate 的身份与职责；
- backlog 与项目知识的所有权；
- Ship、Scout、Secondmate 的工作边界；
- 状态报告、决策升级、验证和 teardown 条件；
- 破坏性操作的确认边界；
- harness 与 backend 的操作协议。

### 3.3 机械控制层

Bash control plane 负责：

- lock、bootstrap 和配置验证；
- backlog 的结构化查询或更新；
- brief、worktree、branch 和 endpoint 创建；
- worker 启动、消息路由、状态读取和 teardown；
- watcher、wake queue 和 supervision continuity；
- PR、CI、No Mistakes 和 landed-work 检查；
- 安全 fast-forward、fleet sync 和恢复。

Bash 非常适合这一层，因为底层对象本来就是 `git`、`tmux`、`gh`、Treehouse、No Mistakes 和各种 Agent CLI。

## 4. 持久目录与状态模型

概念上的 Firstmate home：

```text
data/
├── backlog.md
├── projects.md
├── secondmates.md
├── captain.md
├── captain-shared.md
├── learnings.md
└── <task-id>/
    ├── brief.md
    └── report.md          # Scout 的典型输出

state/
├── <task-id>.meta
├── <task-id>.status
├── .wake-queue
├── .lock
├── .watch.lock
├── .last-watcher-beat
├── .watch-cycle-exits.log
└── .watch-triage.log
```

关键区别：

```text
backlog item
→ 持久工作意图、依赖和稳定任务身份

<task-id>.meta
→ 项目、branch、backend、endpoint、任务类型等连接信息

<task-id>.status
→ 仅追加的任务状态事件历史

.wake-queue
→ 尚待 Primary Firstmate 处理的 actionable 通知
```

`status` 不是可变 current-status 字段。`.wake-queue` 也不是 worker 状态来源；它只是待处理注意力队列。

## 5. Pi 启动链

Pi 中有两个主要 extension：

```text
fm-primary-turnend-guard.ts
├── session-start nudge
├── PreToolUse 安全检查
└── agent_settled 时的无监督兜底

fm-primary-pi-watch.ts
├── 注册 fm_watch_arm_pi
├── 启动和跟踪 watcher arm process
├── 维护 watcher continuity
├── 投递 actionable follow-up
└── Pi 退出时清理其拥有的监督进程
```

完整启动链：

```text
Pi 启动并加载 extensions
→ session_start
→ fm-sessionstart-nudge.sh
→ 隐藏消息要求 Primary LLM 运行 fm-session-start.sh
→ lock
→ bootstrap
→ wake drain
→ supervision instructions
→ durable context digest
→ fleet-state digest
→ Primary LLM 调用 fm_watch_arm_pi
→ extension 启动 fm-watch-arm.sh
→ fm-watch.sh 开始监督
```

Extension 不直接运行完整 startup，是因为 startup 可能修改共享运行状态，并且其输出需要 LLM 解释。通过正常工具路径运行，可以保留可见性、权限边界和责任归属。

## 6. `fm-session-start.sh`

它是启动 orchestrator，正常顺序为：

1. **Lock**：一个 operational home 最多一个可写 Primary session。
2. **Bootstrap**：检查工具、认证、配置、checkout 和可恢复状态。
3. **Wake drain**：处理上次 session 未处理的 actionable events。
4. **Supervision instructions**：输出当前 harness 对应的监督协议。
5. **Context digest**：恢复 projects、secondmates、Captain 偏好和 learnings。
6. **Fleet-state digest**：恢复 backlog、metadata、status tail 与 endpoint presence。
7. **Next step**：指示进入正常监督、恢复或只读模式。

若另一个 live session 已持有 lock，新 session 不夺权，而进入只读诊断路径。

Bootstrap 会检查或维护：

- 必需工具和版本；
- GitHub CLI 认证；
- primary checkout tangle；
- harness、dispatch profile 与 backlog backend；
- 安全 fleet sync；
- secondmate 同步和 liveness；
- legacy PR check 迁移；
- 可选 X mode 本地制品。

## 7. 从 Captain 请求到 worker

完整任务生命周期：

```text
Captain request
→ Firstmate intake judgment
→ durable backlog item
→ task brief
→ fm-spawn.sh
→ isolated worktree
→ backend endpoint
→ worker Agent
→ status and supervision
→ validation and delivery
→ landed proof
→ safe teardown
```

### 7.1 Backlog 必须先于 spawn

先创建 backlog item，可以确保：

- spawn 失败后任务意图仍存在；
- Primary session 重启后任务不会丢失；
- 依赖、hold、目标和 acceptance criteria 有稳定身份；
- worker runtime 与工作意图分离。

### 7.2 Brief 是选择后的上下文

Worker 不会获得 Primary conversation 的完整副本。Firstmate 将相关理解编码到：

```text
data/<task-id>/brief.md
```

Worker 初始上下文近似为：

```text
Harness/global instructions
+ target project AGENTS.md
+ relevant Skills
+ task brief
```

Brief 包含两部分：

- 共享契约：worktree safety、status reporting、blocker、delivery 和完成条件；
- 任务内容：目标、项目、acceptance criteria、约束、相关证据和预期输出。

“bounded context”不代表 `brief.md` 是唯一上下文；它代表 Primary 对话和无关 fleet context 不会被整体复制。

## 8. Ship、Scout 与 Secondmate

### 8.1 Ship

Ship 修改项目并完成交付。它需要实现、测试、验证、提交和按项目 mode 交付。

### 8.2 Scout

Scout 调查、复现、审计或规划，通常输出：

```text
data/<task-id>/report.md
```

Scout report 的存在不等于调查完成。Primary Firstmate 必须判断：

- objective 是否被回答；
- 结论是否有证据；
- 关键不确定性是否消除；
- dependent Ship 是否可以安全开始。

典型模式：

```text
Scout：诊断问题
  ↓ Firstmate 评估报告
Ship：在独立 session/worktree 中实施
```

这样把证据发现和实现分开，避免实现 Agent 继承调查过程中的全部偏见。

### 8.3 Secondmate

Secondmate 是持久的下级协调者，不是一次性 worker：

```text
Captain
→ Primary Firstmate
  → Secondmate
    → Ships / Scouts
```

Secondmate 拥有独立 Firstmate home、backlog、项目注册、状态、session lock、监督和 charter。Primary 通过 `data/secondmates.md` 路由，Secondmate 的边界写在 `data/charter.md`。

它默认 idle，不会因为 queue 为空就自行发起工作。只有当一个长期 domain 有重复路由、多项子任务和真实协调负担时，才值得增加 Secondmate。

## 9. Worker 隔离

每个普通 worker 通常拥有：

```text
Worker
├── 独立 Agent session
├── 独立 Git worktree
├── 独立 branch
├── 独立 backend endpoint
├── 独立 brief
└── 独立 metadata/status
```

这是任务、会话和 Git 层面的隔离，不一定是完整 OS security sandbox。

Worktree 能保证执行隔离，但不能保证集成兼容：

```text
执行隔离
→ worker 运行时不共享 index 和未提交状态

集成兼容
→ 多个 branch 的 API、schema、迁移和架构假设可以正确组合
```

Firstmate 仍需判断任务是否真正可并行，并在主线变化后安排 rebase 和重新验证。

## 10. Runtime backend 与 worktree provider

Runtime backend 负责：

- 创建和关闭 endpoint；
- 有界 capture；
- 发送文字或按键；
- liveness 或 busy/idle probe；
- 在需要时读取当前路径；
- endpoint teardown。

主要关系：

```text
tmux / Herdr / Zellij / cmux
→ session provider
→ Treehouse 通常提供 worktree

Orca
→ 同时提供 session 和 worktree
```

Backend 选择顺序概念上来自显式 flag、环境变量、本地配置、运行时检测，最后默认为 tmux。Herdr 可提供较强的原生 semantic activity；tmux 等 backend 更多依赖有界 terminal evidence 和已知活动模式。

## 11. `fm-spawn.sh`

Primary LLM 决定任务设计；`fm-spawn.sh` 验证并执行 mechanics：

- task identity 和 task kind；
- harness、model、effort；
- backend；
- registered project；
- worktree 位置；
- metadata；
- endpoint 和 Agent launch。

核心边界：

```text
LLM：应该发生什么？
Bash：输入是否合法，如何安全、确定地执行？
```

对于 Ship 和 Scout，脚本应拒绝在项目 primary checkout 中直接启动 worker。任务路径必须是真实且独立的 worktree root。

## 12. 状态读取与 `fm-crew-state.sh`

调用方式：

```bash
bin/fm-crew-state.sh <task-id>
```

它不是按任务名搜索 OS process，而是沿稳定身份查找：

```text
task ID
→ state/<task-id>.meta
→ branch + backend endpoint
→ matching No Mistakes run
→ backend activity evidence
→ status history fallback
→ current classification
```

大致证据优先级：

1. 与该任务 branch 匹配的 No Mistakes run；
2. backend busy/idle evidence；
3. 可映射的 status event；
4. 否则为 `unknown`。

关键原则：

```text
working: ... status
≠ worker 当前仍健康

endpoint exists
≠ Agent 当前仍健康

done: ...
≠ 任务已被接受
≠ Agent 一定还活着
≠ 可以安全 teardown
```

若 pane 已死且没有权威 matching run，系统倾向于报告 `unknown`，而不是相信陈旧 status。

## 13. Event-driven supervision

`fm-watch.sh` 在 Bash 中低成本监控 fleet：

```text
routine/healthy event
→ 静默吸收并继续监控

actionable event
→ persist 到 state/.wake-queue
→ 通知 Primary Firstmate
```

Actionable event 包括：

- `done`、`failed`、`blocked`、`needs-decision`；
- 无法证明仍在工作的 idle/stale endpoint；
- 持续过久的疑似 wedge；
- PR、CI 或 validation 结果；
- fleet state 不一致；
- heartbeat 兜底；
- 可选 X mode 请求。

“零 token supervision”仅指 Bash 的轮询和分类。LLM 被唤醒后仍消耗 token。

### Persist before notify

```text
检测 actionable event
→ 写入 .wake-queue
→ 再触发 LLM follow-up
```

如果进程在写入后、处理前崩溃，新 session 可由 `fm-wake-drain.sh` 恢复。因此 durability 不依赖一次脆弱的内存通知。

### Queue 本身不会唤醒 LLM

在 Pi 中：

```text
fm-watch.sh 发现事件并写 queue
→ watcher cycle 结束
→ fm-primary-pi-watch.ts 观察 child close
→ extension 建立 successor watcher
→ extension 注入 follow-up
→ Primary LLM 获得新回合
→ drain queue 并处理
```

若 Primary Pi 不存在，queue 不会自行启动 Pi。事件等待下次 startup drain。

## 14. Watcher continuity

Watcher 有意是 one-shot：一个 actionable reason 会结束一个 cycle。连续性由上层 harness adapter 负责。

Pi 和 OpenCode 的顺序是：

```text
watcher 因 actionable event 结束
→ 先启动并验证唯一 successor
→ 再把原始 wake 投递给 LLM
```

这保证 LLM 处理事件时 fleet 已重新受到监督。若 successor 恢复失败，系统仍会投递原始 wake，并附带明确的 continuity failure，而不是静默失联。

`fm-watch-arm.sh`：

- 启动、附着或验证 watcher；
- 不允许“空输出但成功”的模糊结果；
- 无健康 successor 时返回 typed failure；
- 将 cycle 结果记录到 `.watch-cycle-exits.log`。

`.watch-triage.log` 只记录被吸收事件，不代表 watcher lifecycle。

## 15. Turn-end guard

Watcher continuity 是常规机制；turn-end guard 是最后安全带。

问题场景：

```text
Primary LLM 处理完 wake
→ 忘记恢复监督
→ 回合结束
→ worker 在盲区运行
```

`fm-turnend-guard.sh` 检查：

- 当前是否是真正的 Primary 或标记的 Secondmate home；
- 是否存在 in-flight work；
- 是否存在 identity-matching、live、beacon 新鲜的 watcher。

如果有工作但监督不健康，返回 code `2`。

Pi 中：

```text
agent_settled
→ fm-primary-turnend-guard.ts
→ fm-turnend-guard.sh
→ code 2
→ 注入一次 TURN WOULD END BLIND follow-up
→ LLM 获得恢复监督的机会
→ loop latch 防止无限递归
```

它不直接修复 watcher，而是强制一个有界恢复回合。Claude/Codex 可通过 Stop hook 阻止结束；Pi/OpenCode/Grok 使用被动 lifecycle callback 加 follow-up，并在 adapter 失败时开放失败，之后依靠 `fm-guard.sh` 在下一条 fleet command 发出警告。

## 16. 向 worker 发送 follow-up

`fm-send.sh` 读取任务 metadata 中的 backend 和 endpoint，再通过对应 adapter 发送消息。

对于 tmux，底层概念近似：

```bash
tmux send-keys -t <target> "message" Enter
```

但 Firstmate 增加目标验证、backend routing、composer safety、submit 和 settle 行为。

重要区别：

```text
发送文字成功
≠ Agent 确认收到
≠ 新 Agent turn 已开始
```

因此发送后仍需通过当前状态、endpoint activity 或后续 status evidence 验证。

## 17. No Mistakes

No Mistakes 是可选的 Agent-assisted validation and delivery pipeline。典型流程：

```text
准备 branch/commits
→ rebase 到最新 remote main
→ fresh-context adversarial review
→ 修复明确问题
→ 升级模糊决策
→ 按原始意图测试
→ 保存 evidence
→ docs/lint
→ push branch
→ 创建 PR
→ 监控 CI 和 conflict
```

它比“coding Agent 说测试通过了”提供更强、结构化的交付证据。

### 三种不同状态

```text
Git branch
→ 代码与 commits

No Mistakes run
→ review/test/evidence/CI/delivery pipeline 状态

GitHub
→ remote PR、checks、conflict 和 merge readiness
```

`fm-crew-state.sh` 通过 task metadata 和 branch attribution 找 matching run，不按 task-name 搜索进程。Branch matching 防止一个任务错误继承另一个任务的 validation state。

No Mistakes run 可以比 pane 活得更久：worker pane 承载交互 Agent，而 pipeline 可能正在等待远端 CI。此时 pane 关闭不代表任务完成或失败。

## 18. Delivery mode

项目在 `data/projects.md` 中显式选择：

| Mode | Delivery path |
| --- | --- |
| `no-mistakes` | 完整结构化 validation pipeline |
| `direct-PR` | 不运行 No Mistakes，直接 push 和开 PR |
| `local-only` | 保持本地，等待获批 fast-forward merge |

Firstmate 不应从项目名称或临时情况猜 delivery mode。

## 19. Authoritative diff、PR base 与 head

PR 比较：

```text
base = 将被修改的目标历史
head = PR 当前准确提出的 commit
```

```text
base main:      A──B──C
PR head:        A──B──C──D──E
```

本地 branch 可能落后于远端 PR head，因此审查优先使用真实远端 PR head，例如：

```text
refs/pull/<pr-number>/head
```

`fm-review-diff.sh` 刷新权威 base，并在存在 PR metadata 时优先比较实际 PR head，避免遗漏远端新增 commit。

## 20. Safe teardown

`fm-teardown.sh` 采用 fail-closed：

Ship teardown 应拒绝：

- dirty worktree；
- 有价值的未提交改动；
- commit 尚未被证明 landed；
- delivery state 模糊。

Scout teardown 要求预期调查 deliverable，通常是 `report.md`。

```text
worker says done
≠ 可删除 worktree

work clean + validated + landed
→ 才可安全 teardown
```

## 21. 并行协调

并行不是“启动尽可能多的 Agent”，而是同时运行可以独立判断的工作。

```text
Scout A：诊断 login flakiness
  ↓
Ship A：实现修复

Ship B：独立 dark-mode feature
Scout C：调查 search latency
```

Scout A、Ship B、Scout C 可并行；Ship A 必须等待 Scout A 的证据被 Primary Firstmate 接受。

需要考虑：

- shared files/subsystems；
- schema、migration 和 API 变更；
- generated files；
- 架构假设；
- merge/rebase 顺序；
- 主线变化后的重新验证。

## 22. Primary session recovery

Primary conversation 与 fleet 生命周期不同：

```text
Primary conversation
→ 临时推理上下文

Fleet
→ backlog、files、branches、worktrees、backends、runs、PR/CI
```

关闭 Primary Pi 后：

- tmux worker 可能继续运行；
- worktree、branch、brief、report、status 和 queue 仍在；
- remote CI 可能继续；
- Pi-owned watcher 通常随 Primary session 停止。

新 session 通过 startup chain 重建当前世界。

机器重启会结束进程，但磁盘上的 backlog、metadata、Git 和报告仍可恢复。系统宁愿报告 `unknown` 并要求调查，也不从陈旧证据猜测成功。

## 23. Memory 与 context 管理

Persistent Firstmate home 不意味着永久使用同一 LLM conversation。

```text
Persistent home
├── project registry
├── backlog
├── briefs/reports
├── captain preferences
├── operational learnings
└── runtime state

Replaceable conversation
└── 临时推理上下文
```

`/stow` 在 reset 前把仅存在于对话中的 durable knowledge 路由到：

- `data/captain.md`：home-domain Captain 偏好；
- `data/captain-shared.md`：跨 domain 偏好；
- `data/learnings.md`：fleet-local 运行经验；
- project `AGENTS.md`：项目内在知识；
- backlog body：task-scoped next step 或注记。

项目知识属于项目并随正常 delivery 提交；fleet 私有配置不应泄漏到项目仓库。

## 24. 安全边界

Firstmate 的几个重要安全设计：

- 一个 home 只有一个可写 Primary session；
- task worktree 中的 Primary-only extension 静默 no-op；
- No Mistakes gate agent 不允许获得 fleet authority；
- Ship/Scout 不在项目 primary checkout 中执行；
- dirty、unlanded 或 ambiguous work 拒绝 teardown；
- local-only merge 需要明确批准；
- destructive/system-sensitive 操作必须先检查、展示目标、说明影响并获批；
- 不把 Firstmate 变成拥有整台电脑无限权限的通用管理员；
- metadata、branch、run 和 endpoint 必须通过稳定 identity 关联，不能按模糊名称猜测。

## 25. 值得借鉴的架构设计

### 25.1 智能判断与机械执行分离

LLM 负责语义与不确定性；脚本负责验证和可重复执行。两者各自做擅长的工作。

### 25.2 Persist before notify

先把 actionable event 持久化，再唤醒协调者。通知可以丢，事实不能丢。

### 25.3 Event history 与 current-state projection 分离

Status 保留历史；current state 通过更强的 run、backend 和 status evidence 组合判断，不把最后一行日志误当现实。

### 25.4 Stable identity 优于名字和进程猜测

Task ID → metadata → branch → run → endpoint。每一步都有明确归属，避免串任务。

### 25.5 Fail closed at irreversible boundaries

当 landed proof、worktree cleanliness、ownership 或 delivery state 不明确时，拒绝 cleanup 或 merge。

### 25.6 Bounded context

Primary 不复制完整对话给 worker，也不持续吸收所有 worker transcript。Brief、status、report 和 PR 是有界接口。

### 25.7 Replaceable runtime layers

Firstmate 把 harness、runtime backend、worktree provider 和 delivery pipeline 分开，使 Pi/tmux/Treehouse/No Mistakes 都可以按契约替换或省略。

### 25.8 Supervision 不依赖模型记忆

Watcher continuity 由 extension/plugin 维护；turn-end guard 提供最后兜底。系统不把“记得重新 arm”当可靠性机制。

### 25.9 Execution isolation 不冒充 integration safety

Worktree 解决并行执行污染，却不声称自动解决 API、schema、merge 和架构冲突。

### 25.10 Recovery-first

Primary conversation 可替换。真正需要恢复的事实都落在 backlog、Git、metadata、status、report、run 和 queue 中。

## 26. 局限与代价

Firstmate 的优势来自额外结构，也带来代价：

- 配置、脚本、状态文件和监督协议较复杂；
- 多 backend/harness 的行为并不完全对称；
- tmux 等 backend 的 Agent activity 只能通过有限证据推断；
- watcher 降低 token 使用，但不能保证零延迟；
- `unknown` 状态需要人工或 LLM 进一步调查；
- 并行越多，集成协调成本越高；
- No Mistakes、Secondmate、X mode 都是可选层，不应默认全部启用；
- 它适合多步骤软件交付，不适合每个简单命令或一次性问题。

## 27. 建议的采用方式

不要一次安装并采用所有组件。更稳妥的顺序：

1. 先理解 core contracts：backlog、brief、Ship/Scout、worktree 和 status。
2. 用一个 disposable task 走完整生命周期。
3. 验证 watcher、wake queue 和 primary recovery。
4. 比较 manual worktree 与 Treehouse。
5. 单独评估 No Mistakes 的额外质量是否值得复杂度。
6. 只有在存在长期 domain delegation 时才引入 Secondmate。
7. 为每个可选组件做 `adopt`、`skip` 或 `park` 决策。

## 28. 一次完整运行的最终图

```text
Captain 提出目标
  ↓
Primary Firstmate 澄清并判断
  ↓
建立 durable backlog item
  ↓
选择 Ship / Scout / dependency graph
  ↓
构造 bounded brief
  ↓
fm-spawn.sh 验证配置和安全边界
  ↓
创建独立 worktree、branch、endpoint、Agent session
  ↓
worker 执行并追加 status events
  ↓
fm-watch.sh 低成本监督
  ├── routine → 静默吸收
  └── actionable → persist wake queue → 唤醒 Primary
  ↓
Primary 读取当前证据并判断
  ├── follow-up worker
  ├── 接受 Scout report 并释放 Ship
  ├── 调整任务结构
  └── 请求 Captain 决策
  ↓
Ship 实现、测试和提交
  ↓
按 no-mistakes / direct-PR / local-only 交付
  ↓
审查 authoritative base/head diff
  ↓
验证 work landed
  ↓
fm-teardown.sh 安全清理
```

## 29. 当前仍值得亲手验证的部分

- 从 Captain request 到 teardown 的一次真实、完整 trace；
- 当前版本 `fm-crew-state.sh` 的逐分支源码行为；
- No Mistakes 的实际 run state、evidence 和 CI 交互；
- 不同 backend 对 busy、idle、composer 和 liveness 的真实差异；
- Firstmate 带来的协调收益是否大于个人工作流中的操作复杂度。

这些应通过当前 Firstmate 源码和 hands-on exercise 验证，不把本文的解释性伪代码当作永久实现契约。
