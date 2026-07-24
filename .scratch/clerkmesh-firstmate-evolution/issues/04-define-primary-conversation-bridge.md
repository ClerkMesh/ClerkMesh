# 定义 Primary Conversation Bridge 契约

Type: grilling
Status: resolved
Blocked by: 01, 14

## Question

Web 如何只读列出并呈现 Pi 历史 session，在用户选定 session 后保持 Primary 未启动，并于第一条新消息发送时懒启动唯一 Pi RPC Firstmate Primary；随后应如何转发输入、渲染普通与诊断事件、处理扩展 UI、刷新和断线，并复用 Firstmate home 单写锁，而不建立第二套聊天历史或支持运行中 session 切换？

## Answer

### Pi 会话与 Primary

- **Pi Session（Pi 会话）**是 Pi 持久化的一段对话，不是浏览器登录 session、Project 或任务。
- Web 启动后直接只读解析 Pi session JSONL，零模型调用地列出和呈现历史；Pi session 文件始终是聊天历史唯一权威。
- Primary 尚未启动时，选中的 Pi 会话 ID 只存在于页面 URL/浏览器状态，不写入服务端全局状态。只读浏览不会启动 Firstmate。
- Captain 首次发送消息时，Supervisor 才以选中的会话启动唯一 Pi RPC Primary，并显式加载 ClerkMesh Primary Extension；同一时刻到达的启动请求必须收敛到同一个启动过程。
- Primary 启动后禁止切换或新建 Pi 会话。停止与恢复边界沿用 Ticket 14：Web 不自动重启或恢复 Primary。

### 消息与 Firstmate 单写锁

- Web 在 Pi RPC Primary 启动后直接转发首条及后续消息，不把取得 Firstmate home 单写锁作为发送前提。
- 若另一个终端 Primary 已持锁，Firstmate 按既有逻辑进入只读模式、接收消息并解释不能执行的操作。Bridge 只中转状态与回复，不预探测锁、不保存未发送草稿、不自动重试，也不接管或终止终端进程。
- 所有修改请求携带 `requestId`。Web 临时缓存以 `(client token, requestId)` 记录处理结果；本次 Web 进程生命周期内的重复请求只返回原结果，不重复调用 Pi RPC。重启后不延续幂等记录。

### 浏览器连接与写租约

- HTTP 承载页面查询与修改请求；一条轻量 WebSocket 统一承载 Firstmate 回复流、状态事件、心跳和客户端写租约，不同时维护 SSE。
- Client 首次连接 WebSocket 后调用 `init`。Web 进程发放随机、不透明的 client token；client 将其保存在 `sessionStorage`，并在所有 HTTP 与 WebSocket 请求中携带。
- 第一个 token 在写租约空缺时成为主 token；后续 token 均为只读。非主 token 可以读取，但修改请求必须以结构化错误拒绝。
- 主 WebSocket 断开后保留 3 秒重连窗口；同一 token 在窗口内重连仍是主 token。超时后写租约变为空缺，不自动提升任何只读页面。
- 只读 client 可由 Captain 显式执行 `claim-write`；仅当租约仍为空缺时，其现有 token 才成为主 token。租约空缺时，新 client 的 `init` 也可直接取得写权限。
- WebSocket 心跳用于识别失活连接。Web 进程重启时所有 token、租约和临时状态自然失效。
- Client token 只是本地单 Captain Web UI 的写租约标识，不是登录凭证或网络安全边界。

### 临时页面投影

- Web 进程维护只跟随本次启动存在的内存投影缓存，以便刷新、短暂断线或后续获准进入的页面快速恢复。
- 缓存包括规范化的可见消息、流式片段、通知、错误、Primary 状态、待处理扩展 UI，以及单调递增的事件序号；上限为最近 10,000 个事件。
- Client 连接后先取得当前快照，再从快照序号继续接收 WebSocket 事件。进程退出后缓存全部丢弃；重启时从 Pi session 文件恢复持久化消息，不承诺恢复诊断事件或未持久化片段。
- 该缓存是可丢弃的页面投影，不是第二套聊天历史、任务状态或 fleet 权威。

### RPC 事件与扩展 UI

- Bridge 将 HTTP 输入转换为 Pi RPC 请求，并把 RPC 消息与事件规范化后写入临时投影并通过 WebSocket推送；不得解析 ANSI 终端文本。
- 普通模式只呈现用户消息、Firstmate 可见文本、简单工作状态、通知、错误及确认/选择/输入/编辑等扩展 UI；诊断模式可额外呈现 reasoning、工具调用与结果、生命周期事件和原始 RPC 事件，并警告敏感信息风险。
- 尚未回答的扩展 UI 请求保留在临时投影中，刷新或重连后重新展示；回答它们属于修改请求，必须验证主 token 与 `requestId`。
- Web 对 Firstmate、任务和 Clerk 状态的读写边界继续遵循 Ticket 14：查询使用只读结构化投影，修改全部作为当前对话中的可见输入交给 Firstmate 判断与执行。
