# 定义 Web–Firstmate 集成边界

Type: grilling
Status: resolved
Blocked by: 01

## Question

Web 服务与 Firstmate 应采用什么进程和状态所有权边界，谁负责启动、保活与恢复 Primary，会话在线与离线如何呈现，Web 如何触发 Firstmate、接收回复和任务事件，以及哪些能力必须通过 Firstmate 通用扩展点而不是旁路修改其私有状态？

## Answer

首版采用一个 Web 进程加一个按需启动的 Pi RPC Primary 子进程。Supervisor 与 Conversation Bridge 都是 Web 进程内部模块，RPC 是两者之间的 JSONL 协议，不增加第三个长期服务。

```text
Browser
  ↕ HTTP + WebSocket
Web process
  ├── Web UI / API
  ├── Primary Supervisor
  └── Conversation Bridge
          ↕ stdin/stdout JSONL
      pi --mode rpc -e <clerkmesh-primary-extension>
          ├── ClerkMesh Primary Extension → CLERK.md
          └── Firstmate Primary
                └── Firstmate Bash control plane
                      └── Herdr fleet + Treehouse worktrees
```

### 首版固定技术边界

- Primary harness 只支持 Pi。
- Worker harness 只支持 Pi。
- runtime backend 只支持 Herdr，并使用 Herdr 原生 Agent 状态作为实时运行证据。
- worktree provider 使用 Treehouse。
- 使用用户电脑 `PATH` 中安装的 Pi，不捆绑另一份 Pi 或 SDK。
- Web 与终端 Primary 都由 ClerkMesh launcher 显式加载同一 Primary Extension；Firstmate `AGENTS.md` 不承载 ClerkMesh 规则，Worker 不加载该 Extension。
- ClerkMesh 检查最低 Pi 版本；真正启动后再检查所需 RPC capability。具体最低版本由 Connector 原型实测确定。
- 历史会话列表由 Web 只读解析 Pi session JSONL；不为聊天建立数据库，也不启动第二个 AgentSession。

### 会话与懒启动

Web 先启动，但不立即启动 Pi：

1. Web 零 Token 列出 Pi 历史 session。
2. 用户选择恢复某个历史 session 或新建 session。
3. Web 可只读展示选中历史。
4. 只有用户输入第一条新消息并点击发送时，Supervisor 才启动 Pi RPC Primary。
5. Web 在 Pi RPC Primary 启动后直接转发首条消息，不以获得 home 单写锁作为发送前提。
6. 若其他终端进程已持有 home 单写锁，Firstmate 自行进入只读模式、接收消息并解释无法执行的操作；Web 只呈现该状态与回复，不另存未发送草稿、不自动重试，也不实现额外的锁接管流程。真正启动失败时，Web 直接呈现失败。

首版不支持运行中的 session 热切换或新建。Primary 运行时相关按钮禁用；用户必须停止并重新启动 ClerkMesh，重新选择 session，然后在首次发送时启动新的 Primary。Pi session 文件是唯一聊天历史来源。

### 进程与恢复

- Web 负责启动、健康检查和停止自己创建的 Pi RPC 子进程，但不自动重启或自动恢复它。
- Web 正常退出或崩溃时终止 Pi Primary，避免留下占锁且 stdin/stdout 无法重连的孤儿；关闭浏览器标签页不停止服务。
- 停止 ClerkMesh 不阻止，也不关闭 Herdr Workers。Workers 和 Firstmate 磁盘状态继续存在；下次由用户手动启动并恢复 session。
- 运行任务存在时停止 Primary 是允许的，Web 只需诚实显示其暂时无人监督。
- Firstmate 现有 per-home 单写锁继续是唯一写权威。Web 不另建或预探测锁；由 Web 启动的 Pi 进程尝试获取锁，未获取时按 Firstmate 既有逻辑保持只读。

### 聊天与页面通信

- 浏览器发送消息、回答确认和执行 UI 操作使用 HTTP 请求。
- Firstmate 回复流、运行状态、任务更新、客户端租约与心跳统一使用 WebSocket；首版不同时维护 SSE。
- Conversation Bridge 把 Web 输入转换为 Pi RPC `prompt`，把 Pi 消息和事件转换为 Web 展示；不解析 ANSI 终端文本。
- 普通模式显示用户消息、Firstmate 可见文本、简单工作状态、扩展确认/选择/输入/编辑对话框、通知与错误；隐藏 reasoning、工具详情、内部 control messages 和 Worker 终端。
- 可配置诊断模式展示 reasoning、工具调用和结果、扩展消息、生命周期事件与原始 RPC 事件，并警告可能暴露敏感内容。

### 状态所有权

- Pi session JSONL 是聊天历史权威。
- Firstmate backlog、task state、runtime state 与 Herdr 证据是任务图和运行列表权威。
- Clerk 仓库与 Clerk registry 是 Clerk 权威。
- Web 不建立聊天、任务或 fleet 的第二份权威状态。
- Web 通过 Firstmate 的只读结构化 CLI 查询任务与 fleet；Web 进程可再通过 Clerk CLI 读取由 ClerkMesh 编译的标准 brief Clerk 块，并按 task ID 即时增强展示。浏览器不解析 Markdown，Web 不读取任意 prose，也不修改 backlog、metadata、brief 或状态文件。
- 创建、暂停、恢复、取消和批准等修改操作一律变成当前对话中的可见用户消息，经 Pi RPC 交给 Firstmate Primary 判断和执行。首版不提供 Task 改派操作；Primary 在每次执行前动态选择 Clerk。

### 网络边界

- 默认监听 `127.0.0.1`。
- 用户可显式配置其他监听地址；首版不要求身份认证 token。Web 客户端写租约 token 只用于区分当前可写页面，不构成身份认证或网络安全边界。
- 非 loopback 启动时显示醒目风险警告但不阻止。
- 始终校验 Host、Origin 与 Content-Type；首版不提供公网部署、TLS、多用户或权限保证。

### Firstmate 扩展边界

首选直接使用 Pi RPC 的 prompt、事件、session 与 extension UI 协议。只有 readiness、RPC 模式下现有 Firstmate extensions、通用锁行为或任务结构化只读输出经原型证明不足时，才为 Firstmate 增加窄、通用、默认关闭且可做 capability negotiation 的扩展点。Web 不通过旁路写私有 Firstmate 状态来弥补接口缺口。
