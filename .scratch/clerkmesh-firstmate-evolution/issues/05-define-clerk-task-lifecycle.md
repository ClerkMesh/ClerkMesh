# 定义 Clerk 选择与任务生命周期

Type: grilling
Status: resolved
Blocked by: 01, 03

## Question

在不新增 ClerkMesh Task 系统、Task 级 Clerk assignment 或固定状态机的前提下，Firstmate Primary 应如何利用 LLM 在每次执行前拆分工作、动态选择当前最合适的 Clerk、可选地向 Captain 展示计划与依据，并通过 brief 驱动现有 Agent Worker 或真人结果流程？

## Answer

### 核心原则：Extension 注入的 CLERK.md 是 Clerk 编排的行为代码

ClerkMesh 是 AI 编排系统，不把 Primary 的语义判断改写成传统负责人表、匹配评分器或硬编码状态机。Firstmate Primary 的 LLM 继续决定“应该发生什么”；ClerkMesh Primary Pi Extension 在每个 agent run 注入的 `CLERK.md` 规定其 Clerk 选择和执行协议；CLI/Bash 只提供可靠的 Clerk 读取、校验、brief 编译与渐进检索机制。

ClerkMesh 不建立独立 Task 存储。**Task**就是 Firstmate 已有的 durable backlog item，以及由稳定 `task-id` 关联的 brief、runtime metadata、status、report、依赖和交付证据。Task 不永久归属于 Clerk。

```text
Task ready for execution
→ Primary 根据当前任务、依赖结果与当前 active Clerks 动态判断
→ 选择本次执行最合适的 Clerk
→ 编译当前 brief
→ Agent：沿用普通 Firstmate Worker
  Human：由 Captain 代录过程与结果
```

### Task 与执行方式

Task 是可独立验收并产生明确结果的持久工作单元；里程碑、分组标题和依赖连线不是 Task。首版不按产品、运营、美术或程序开发等职业硬编码 Task 类型。

Scout 和 Ship 只是 Agent 执行方式：Scout 调查、分析并通常形成 report；Ship 创建或修改可交付成果，不限于代码。一个 Task 是否需要先 Scout 再 Ship 由 Primary 根据实际工作判断，不强制所有职业工作套用两阶段流程。

### 动态 Clerk 选择

`CLERK.md` 要求 Primary 在每次新的执行开始前：

1. 读取所有 active Clerk 的 `name`、`description`、`execution` 和当前批准 commit，形成短名单。
2. 只对短名单读取 `Role`、`Capabilities` 和 `Boundaries`。
3. 根据当前 Task、已完成依赖的结果、Project 约束和可用工具，选择当时最合适的 Clerk；不得故意越过明确 Boundary。
4. 可独立验收的跨专业工作优先拆成多个 Firstmate Tasks，再分别执行。
5. 请求模糊、无法安全拆分或没有合适 Clerk 时，暂不执行，直接在当前 Primary 对话说明原因并请 Captain 补充。
6. 只有 Captain 明确选择亲自处理时，本次真人执行才选择内置 Escalation Clerk。

默认自动完成规划与 Clerk 选择，不增加每次执行都必须确认的人机门槛。Captain 在对话中要求“先展示计划”“说明为什么选择该 Clerk”或同等意思时，Primary 必须在执行前展示任务拆分、所选 Clerk、主要依据和关键边界，等待 Captain 回应。

匹配由 LLM 作语义判断，不引入能力标签、相似度分数、自动路由状态机或持久 Task owner。

### Brief 是当次执行的 Clerk 上下文

Primary 为每次新的执行生成或更新 Firstmate 现有 `data/<task-id>/brief.md`。Brief 除原有 objective、acceptance criteria、Project 和交付约束外，还包含：

- 本次所选 Clerk 名称与 commit；
- 身份摘要、Working Style 与强制 Instructions；
- 与 Task 相关的 Clerk 上下文索引和渐进检索入口；
- 必要的匹配理由与触发的 Boundary 说明。

这份 brief 是当前执行的有界上下文，不是永久 Clerk assignment。当前 Worker 收到 follow-up 时继续使用同一 brief，Firstmate 的 `fm-send`、watcher、wake queue 和 runtime 路由不需要理解 Clerk。

如果当前 Worker 已结束，而 Primary 按 Firstmate 既有逻辑决定启动新的 Worker，Primary 可以根据最新任务证据、Clerk 内容和能力重新选择 Clerk并重新生成 brief；新 Worker 不必继承上一次执行所选 Clerk。旧执行的 Pi 会话、status、report、Git 和交付证据继续承担既有审计作用，不增加单独 assignment history。

### Agent Clerk 路径

Agent 执行完全复用 Firstmate：

```text
backlog item
→ Primary 选择 Clerk并编译 brief
→ fm-spawn
→ ordinary Worker
→ status / watcher / wake queue
→ Primary 判断与 follow-up
→ validation / delivery / landed proof
```

Worker 的 `done`、`failed`、`blocked`、`needs-decision` 及 runtime 异常仍按原逻辑唤醒 Primary。Worker 自报 `done` 不代表 Task 已验收；Primary 继续使用 LLM 检查 brief、report、Git、validation 与 landed proof，并决定 follow-up、重新执行、收尾或请求 Captain 决策。ClerkMesh 不新增 Worker 重试策略。

Firstmate runtime 把它当普通 Worker：不增加 Clerk 专用 endpoint、Worker 状态、watcher 分支、wake event 或 follow-up API。Clerk 身份通过 brief 和受限检索工具影响 Worker 的思考与行为。

### 真人 Clerk 与 Escalation Clerk

Primary 选择 `execution=human` 的 Clerk 时不调用 `fm-spawn`，也不伪造 Worker 或 backend endpoint。Captain 通过当前对话代为记录真人 Clerk 的开始、过程、问题、证据和结果，但不因此成为该 Clerk 的账号或绑定对象。

最终结果写入 Firstmate 现有 `data/<task-id>/report.md`，可包含结论、Markdown 内容、附件路径和外部成果链接；Primary 按 acceptance criteria 验收。若真人成果需要修改 Project、提交 Git 或执行工具，Primary 创建依赖该结果的新 Agent Task，并在该 Task 真正执行前重新选择最合适的 Agent Clerk、生成新的 brief。

Escalation Clerk 不是无匹配请求的自动后台 owner。请求先留在对话中澄清；Captain 明确选择“由我处理”后，Primary 才为这次真人处理选择 Escalation Clerk。

### 依赖、状态与兼容边界

依赖图和调度完全复用 Firstmate。上游未验收前不开始依赖它的下游执行；上游完成后，Primary 将相关 report、交付证据和结论纳入执行判断与 brief。由于 Clerk 在执行前晚绑定，上游结果改变所需能力时无需改派 Task，只需由 Primary 选择新的最佳 Clerk。

ClerkMesh 不增加 Task 级 `clerk_name`、`clerk_commit`、assignment 文件、reassign API、successor schema、可变 `current_phase` 或第二套 Task 状态机。Firstmate backlog、brief、status history、runtime evidence、report 和 landed proof 继续是权威。Web 若展示 Clerk，只能表述为“当前/最近一次执行所选 Clerk”，不能暗示永久 Task owner。Web 进程通过 Clerk CLI 检查标准 brief，并按 task ID 与 Firstmate 只读 task/fleet 投影即时组合；不修改 `.meta`，也不让浏览器解析 Markdown。阶段仍由 Firstmate 的窄、只读结构化投影计算。

因此 Clerk–Firstmate 的首选集成面是：

```text
Primary Extension + CLERK.md selection rules
+ Clerk CLI and repository reads
+ execution-scoped brief compilation
+ existing Firstmate runtime unchanged
```
