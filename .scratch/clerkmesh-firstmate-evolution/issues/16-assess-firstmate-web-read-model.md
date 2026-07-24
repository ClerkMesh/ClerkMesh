# 评估 Firstmate 的 Web 只读模型

Type: research
Status: resolved
Research branch: `research/firstmate-web-read-model`
Report: `.scratch/clerkmesh-firstmate-evolution/research/firstmate-web-read-model.md` at commit `07e1520`

## Question

在首版固定 Pi、Herdr 与 Treehouse 的条件下，Firstmate 当前哪些结构化 CLI 可以无 Token 地提供 Project、任务依赖图、投影阶段、等待原因、最近活动、Herdr Agent 状态和结果链接？Web 进程应如何把这些投影与 Clerk CLI 从标准 brief 读取的当前执行 Clerk 即时组合，而不要求 Firstmate runtime 感知 Clerk，也不解析任意私有 Markdown、metadata 或终端文本？

## Answer

完整源码证据见 [研究报告](../research/firstmate-web-read-model.md)。报告完成后，Ticket 05 将“Task 永久主责 Clerk”修正为“每次执行由 Primary 动态选择 Clerk”；以下投影建议已按该后续决策对齐。当前最可靠的零 Token 机器接口是 `fm-fleet-snapshot.sh --json`，首页摘要可用 `fm-bearings-snapshot.sh --json`；它们已有 Project 引用、依赖边、粗粒度执行状态、部分等待线索和结果指针，但没有完整 Project 清单、规范投影阶段、统一等待原因、可信活动时间线或普通 Herdr Worker 的原生 Agent 状态。Firstmate 本身也没有执行期 Clerk 字段；该信息属于 ClerkMesh 编译的当前 brief。

Web 不得解析 `data/*.md`、`state/*.meta`、status log、brief/report Markdown 或终端文本，也不得把 bearings 的 `owner`、runtime endpoint 或 pane 存在性误当 Clerk 或 Herdr Agent 状态。Firstmate 应在语义所有者一侧补四个窄、只读、版本化 JSON 投影：

- `fm-project-catalog.v1`：完整 Project catalog，区分 registered、discovered 与 missing；
- `fm-task-graph.v1`：统一 Task/edge、phase、wait、runtime 摘要与 `results[]`；
- `fm-task-activity.v1`：从新增的带时间结构事件生成可游标活动流，旧 status 不伪造时间；
- `fm-herdr-agents.v1`：通过 Herdr adapter 保留 `working|idle|done|blocked|unknown` 原生状态，不暴露 pane id 或终端内容。

每个投影必须声明 schema、provenance、freshness、unknown 与 omitted/errors，并配套 v1 JSON Schema；Web 只消费公开 schema。Web 进程另调用 Clerk CLI 检查由 ClerkMesh 编译的标准 brief Clerk 块，按 task ID 增强为可空的 `execution_clerk`；这不是 Firstmate 字段，不写 `.meta`，浏览器也不解析 brief。投影是对现有权威源的即时读模型，不是新的任务数据库。落地顺序是 task graph 与 Project catalog、Herdr Agents、最后 activity；补齐前 Web 可使用现有 snapshot，但必须诚实展示 unknown、invalid 和 omitted。
