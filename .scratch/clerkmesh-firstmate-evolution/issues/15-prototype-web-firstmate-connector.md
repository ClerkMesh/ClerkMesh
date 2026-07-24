# 原型验证 Web–Firstmate Connector

Type: prototype
Status: resolved
Prototype branch: `prototype/web-firstmate-connector`
Prototype commit: `911f8da`
Blocked by: 04, 14, 16

## Question

用一个可丢弃的本地原型验证浏览器输入如何进入当前 Firstmate Primary 会话、可见回复与历史如何回传、页面刷新如何恢复、现有单写锁如何覆盖 Web 与终端、Primary 停止如何呈现，以及任务状态如何通过 Firstmate 只读结构化投影获取时，最小 Conversation Bridge 应如何工作？

## Answer

原型及完整实测证据保存在独立 throwaway 分支：

```bash
git show prototype/web-firstmate-connector:prototypes/web-firstmate-connector/EVIDENCE.md
git show prototype/web-firstmate-connector:prototypes/web-firstmate-connector/README.md
```

结论是 **直接 Web → Pi RPC Connector 可行，但当前 Firstmate 尚不能满足 Web 与终端统一单写保证**。

已通过的边界：

- Web 可直接只读解析 Pi session JSONL；实测列出 35 个历史 Pi Session，未启动 Primary、未调用模型；
- 首次 HTTP prompt 通过共享 startup promise 懒启动唯一 `pi --mode rpc` 子进程；`(client token, requestId)` 在进程内幂等；
- Pi 的 LF JSONL、可见文本流、`agent_settled` 与 extension UI 均可规范化后经 WebSocket 推送；
- 内存快照可在刷新后恢复 pending dialog；同 token 在 3 秒内重连保留写租约，第二 token 的写请求返回 409；
- Primary 退出后明确变为 offline，实测不自动重启；
- 任务接口只调用 `fm-fleet-snapshot.sh --json`，返回 `fm-fleet-snapshot.v1`；
- 真实 Pi 0.80.10 + 隔离 Firstmate checkout 完成 `/ahoy` 全链路，`get_state` 与 `get_messages` 足够做启动 capability check。Connector 自身的实测最低版本是 0.80.10；若把 Firstmate Calm mode 纳入整体兼容基线，可采用其已验证的 0.81.1。

单写验收发现了 Firstmate 的既有缺陷：`bin/fm-lock.sh` 的 `holder_alive` 把 basename 和完整 args 拼成一行后用包含 `^pi$` 的表达式匹配。真实 Pi holder 形成 `pi pi`，因此被错误判为 stale；第二个仍存活的 Pi Primary 实测覆盖了第一个 PID 并取得写锁。将 basename 单独匹配的隔离反事实随后正确拒绝第二个 holder。

因此 Bridge 仍应遵守既定边界：不预探测、不影子实现、不接管 Firstmate 锁；但产品落地前必须先在 Firstmate 通用锁 helper 中修复 Pi holder liveness 并增加双 Primary 回归。除该上游 blocker 外，不需要新增 Firstmate transport、聊天数据库或 Pi SDK 嵌入层。
