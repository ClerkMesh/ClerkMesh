# 原型化 Web 聊天与任务系统体验

Type: prototype
Status: resolved
Prototype branch: `prototype/web-task-experience`
Prototype commits: `4b67bfd`, decision `1f2a9e9`
Blocked by: 04, 05, 07, 15, 16

## Question

管理系统外壳中的 Pi 历史 session 选择、未启动 Primary 的历史浏览、当前 Primary 聊天、Project 与 Clerk 管理、学习审核、任务规划依赖图、运行任务列表和任务详情应如何组织，才能清晰展示当前或最近一次执行所选 Clerk、可选的计划与选择依据、投影阶段、最近活动、等待原因、结果与后续任务，同时不暗示 Task 永久归属 Clerk，也不形成第二个权威状态源？

## Answer

三个可切换的 throwaway Web 方案及 Captain 的选择证据保存在原型分支：

```bash
git show prototype/web-task-experience:prototypes/web-task-experience/EVIDENCE.md
git show prototype/web-task-experience:prototypes/web-task-experience/VARIANTS.md
```

Captain 选择 **C — Calm object workspace**。首版采用低密度、一次聚焦一个持久对象的管理系统外壳，不采用始终以聊天为中心的三栏布局，也不把 graph、fleet、chat 和 detail 全部塞进默认驾驶舱。顶层固定为四个领域入口：

1. **Conversations**：Pi Session 列表、选中历史和当前 Primary 对话；
2. **Work**：Task 计划、运行列表和 Task 详情；
3. **Company**：全局 Clerk directory 与 Project 管理；
4. **Reviews**：Learning Proposal 队列及逐目标 Clerk exact-diff 审核。

页面顶部保持轻量全局导航，breadcrumb 指明当前对象和层级。Conversations 采用 session 列表加单一对话阅读区：选择历史只读、零 Token，醒目标示“Primary 未启动”；第一条新消息的 composer 明确说明会懒启动唯一 Pi RPC Primary。Primary 运行后禁用 session 切换；普通模式只呈现可见消息、简单状态、通知和扩展 UI，诊断模式单独开启并警告敏感信息。

Work 首页以 Task graph/plan 和运行列表作为同一领域的两种视图，而非另一套状态。选择 Task 进入专注详情页，展示稳定 Task ID、依赖、Firstmate 投影阶段、等待原因、最近活动、结果/链接、Herdr 原生状态及 freshness/unknown/omitted。Clerk 字段只能标为“当前/最近一次执行所选 Clerk”；尚未执行时显示“执行前选择”，不能写 owner、assignee 或暗示永久归属。选择依据和计划只在 brief 标准投影确有数据时显示。创建、暂停、恢复、取消、批准等 Task 操作生成可编辑的当前 Firstmate 对话消息，不由页面旁路修改权威状态。

Company 将 Project 与 Clerk 放在同一组织领域但保持不同对象页：Project 明示本地 Git、remote 可选、validation/landing 能力；Clerk directory 展示 active/archived、human/agent、批准版本和待审核改动，不展示 Task ownership。Reviews 使用独立 Proposal 页：先展示 Learning Source provenance，再以目标 Clerk tab 分别展示 source preview、changed paths、完整 Markdown diff、base/tree identities、校验和敏感来源警告；批准、拒绝和要求修改只影响当前目标，并明确修改后必须重新审核。

Web 只消费 Pi Session JSONL、Firstmate 版本化只读投影、Herdr adapter 与 Clerk CLI brief/learning projection，并在服务端即时组合；浏览器不解析任意 Markdown、`.meta`、status log 或终端文本。页面缓存仅用于刷新恢复，不成为对话、Task、fleet、Clerk 或 learning 的第二权威。A 的对话主轴和 B 的运营驾驶舱只保留为比较证据，不进入实施规格。
