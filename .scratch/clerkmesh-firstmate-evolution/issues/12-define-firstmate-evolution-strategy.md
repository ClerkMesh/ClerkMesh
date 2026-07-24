# 定义 Firstmate 内嵌与最小扩展策略

Type: grilling
Status: resolved
Blocked by: 05, 15, 16

## Question

ClerkMesh V1 如何把 Firstmate 作为根仓库直接跟踪的内嵌源码基线，并通过独立 Primary Pi Extension 与 `CLERK.md` 承载 Clerk 编排知识，同时保持 Firstmate 对 Project、Task、brief、Worker、watcher、validation、delivery 和 landed proof 的所有权？V1 应如何记录上游来源、允许哪些直接修改，以及明确排除哪些同步升级问题？

## Answer

### 产品与源码关系

ClerkMesh 是基于 Firstmate 二次开发的完整下游产品，不存在“先安装 vanilla Firstmate，再可选安装 ClerkMesh”的运行模式。V1 直接把一个 Firstmate 上游源码快照内嵌到 ClerkMesh 根仓库，并由 ClerkMesh Git 直接跟踪。

```text
clerkmesh/
├── .git/                              # 唯一 Git repository
├── apps/
│   └── web/                           # Web、HTTP、WebSocket、Supervisor
├── packages/
│   ├── pi-primary-extension/
│   │   ├── src/index.ts               # Primary prompt 注入
│   │   └── CLERK.md                   # 简洁英文 Clerk 编排规则
│   ├── clerk-cli/                     # Clerk 管理、上下文与 brief inspect
│   └── shared/                        # 公共 schema/types
├── firstmate/                         # 根仓库跟踪的源码，同时是 Primary FM_HOME
│   ├── data/                          # Firstmate 持久运行数据；忽略
│   ├── state/                         # Firstmate runtime state；忽略
│   └── projects/                      # Firstmate Projects；忽略
├── firstmate.provenance.json          # 仅记录来源，不驱动 clone/update
├── clerks/                            # 每个 Clerk 是独立 Git repo；根仓库忽略
├── clerkmesh-data/                    # Clerk registry/Learning/audit；根仓库忽略
├── clerkmesh-state/                   # Clerk lock/capability/run state；根仓库忽略
├── cache/                             # 可丢弃；根仓库忽略
└── bin/clerkmesh                      # init/Web/TUI 统一 launcher
```

导入时删除 Firstmate 自己的 `.git`；`firstmate/` 不是 submodule、subtree、嵌套 checkout 或运行时下载目录。V1 不再建立独立根层 `home/`：`firstmate/` 同时作为 code root、Primary cwd 与 `FM_HOME`，其既有 ignore 规则保护 `data/`、`state/`、`projects/` 等运行数据。根仓库不得忽略 `/firstmate/` 本身，但必须忽略 `/clerks/`、`/clerkmesh-data/`、`/clerkmesh-state/` 和 `/cache/`。

### V1 基线与来源追溯

开始 V1 实现时，从 Firstmate upstream 默认分支当时的最新 HEAD 复制源码。复制后不再动态追踪“最新”，而是把该快照作为 ClerkMesh V1 的普通源码。

仍需记录准确来源，例如：

```json
{
  "repository": "https://github.com/<upstream>/firstmate.git",
  "sourceCommit": "<full-sha>",
  "vendoredAt": "<timestamp>"
}
```

该文件只用于 provenance、审计、许可证与故障定位，不用于初始化 clone、版本选择、patch 重放或自动更新。实现开始前应验证记录的 commit 确实是当时获取的 upstream 默认分支 HEAD，并保留上游许可证和必要 attribution。

2026-07-24 的预实现复核已将独立研究 checkout 同步到当时 upstream `main` 的 `f017572eab2930cc4c03e830d44620935ba77035`。这只是当前研究证据，不提前替代实现开始时的最终来源记录。最新 local-only 复核见 `../research/firstmate-latest-local-project-delta.md`。

### 直接修改，而不是 patch stack

V1 允许直接修改 `firstmate/` 中的源码，并与其他 ClerkMesh 文件一起作为普通 commit 提交。无需：

- `firstmate.lock.json`；
- 嵌套 Firstmate Git repository；
- `git format-patch` / `git am` patch stack；
- 初始化时 clone Firstmate；
- managed local branch 或 dirty-checkout 修复协议。

每次修改仍应保持边界清晰、测试充分、commit 可审计。若一个 commit 同时修改 ClerkMesh 产品层与 Firstmate 内核，应让变更说明清楚指出两侧契约；能合理拆分时应拆分，以便未来理解下游差异，但 V1 不要求维护可自动重放的 patch series。

### Firstmate 与 ClerkMesh 的职责边界

源码内嵌不改变领域所有权。

Firstmate 继续拥有：

- Project registry 与 Project 操作；
- backlog、Task、依赖和 brief 路径；
- spawn、Worker runtime、follow-up、watcher 与 wake；
- validation、delivery、landing、landed proof 与 teardown；
- fleet/bearings 等 Firstmate 只读事实；
- session lock 与 operational home。

ClerkMesh 产品层继续拥有：

- Clerk registry、生命周期、上下文和学习；
- Clerk 动态选择与 brief 中的执行期 Clerk 上下文；
- Primary Pi Extension 与 `CLERK.md`；
- Web UI、Conversation Bridge 和只读组合投影；
- 真人 Clerk 与 Captain 代录流程。

可以直接修改 `firstmate/` 中的通用能力，例如 Project 本地模式、provider/auth capability、锁、validation、landing 或通用只读接口；但 Clerk registry、选择、学习、真人流程等 ClerkMesh 产品语义不得因此下沉到 Firstmate 控制面。

### Clerk 编排作为独立 Primary Pi Extension

Firstmate `AGENTS.md` 和 `.pi/APPEND_SYSTEM.md` 不承载 ClerkMesh 规则。ClerkMesh 自己维护 `packages/pi-primary-extension/CLERK.md`，并由极薄的 Pi Extension 在 `before_agent_start` 中追加到当前 system prompt。

`CLERK.md` 使用简洁英文，只表达 Primary 必须知道的规则：

1. Before each new Worker execution, inspect active Clerks, select the best current Clerk, and compile its context into the brief.
2. Plan and select automatically by default; when the Captain explicitly asks, show the plan, selected Clerk, rationale, and key boundaries before execution.
3. Reuse the current brief for follow-up to an existing Worker; reassess and allow a different Clerk when starting a new Worker.
4. If the work cannot be understood, safely decomposed, or matched, explain why and ask the Captain to clarify instead of forcing execution.
5. A human Clerk does not spawn a Worker; the Captain records its process and Markdown result. Select the Escalation Clerk only when the Captain explicitly chooses to handle the work.

Extension 只负责读取同一 ClerkMesh release 中的 `CLERK.md` 并注入 prompt；不得选择 Clerk、修改用户输入、拦截 spawn、写 Task/brief/`.meta`、维护 assignment 或实现第二套状态机。具体选择仍由 Primary LLM 判断；Clerk CLI 提供确定性候选读取、校验、brief 编译与检索。

### 统一 launcher 与 Extension 验证

Web 与终端 Primary 都必须由 ClerkMesh launcher 启动，不能依赖用户运行裸 `pi`：

```text
clerkmesh web
→ pi --mode rpc -e <absolute-clerkmesh-extension-path>

clerkmesh primary --tui
→ pi -e <absolute-clerkmesh-extension-path>
```

Launcher 固定 Primary cwd、`FM_ROOT_OVERRIDE` 与 `FM_HOME` 为内嵌 `firstmate/` 的 canonical absolute path，使 Firstmate `AGENTS.md` 与控制面生效。Worker spawn 不继承 ClerkMesh Primary Extension，所以 Worker 只接收 brief 中编译的 Clerk 上下文。

Extension 注册轻量 `/clerkmesh-status` command。Web 在 RPC startup 后调用 `get_commands` 并确认该 command 存在。Extension、`CLERK.md` 或 status command 缺失时，Primary 启动失败，不能降级成没有 Clerk 规则的可写模式。

### V1 验证门禁

V1 制品至少验证：

1. `firstmate.provenance.json` 包含准确 URL、完整 SHA 和复制时间；
2. `firstmate/` 被根仓库直接跟踪且不含嵌套 `.git`；
3. `firstmate/` 同时作为 canonical Primary cwd/FM_HOME，运行目录不会进入根 Git；
4. Firstmate 原测试通过；
5. Web/终端双 Primary 锁回归证明第二个 Pi 只能只读；
6. 真实 Pi RPC 能 startup、处理 `/ahoy`、流式回复和 extension UI；
7. `get_commands` 能发现 `/clerkmesh-status`；
8. Extension 测试证明 `CLERK.md` 在每个 agent run 完整且只追加一次；
9. 普通 Worker 的 spawn → status → wake → follow-up → completion smoke test 通过；
10. Web 能把 Firstmate snapshot 与标准 brief Clerk 块按 task ID 即时组合；
11. Ticket 13 定义的无 remote、无 forge auth local-only 回归通过。

任一失败都不得宣称 V1 可发布。

### V1 不设计 Firstmate 更新

V1 不实现：

- upstream fetch/sync；
- 自动或手动 Firstmate update command；
- patch replay；
- 多版本共存；
- 原子版本切换；
- rollback manager；
- 对后续 upstream commit 的兼容承诺。

未来若决定重新同步 Firstmate，必须另开架构决策，重新评估 vendored 源码与上游的差异、测试门禁和迁移方式；本 Ticket 不预先规定 merge、rebase、patch stack 或正式 Fork 路线。
