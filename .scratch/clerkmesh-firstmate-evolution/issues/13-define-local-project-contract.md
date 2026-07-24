# 完成 Firstmate local-only 最小适配

Type: grilling
Status: resolved
Blocked by: 02, 12

## Question

在保持 Firstmate 对 Project registry、brief、Worker、validation、landing、landed proof 与 teardown 的所有权，并直接修改 ClerkMesh 根仓库跟踪的 `firstmate/` 源码的前提下，V1 如何让无 remote 的 local-only Project 不依赖 GitHub/GitLab 工具或认证，同时保留显式选择的 `direct-PR`、`no-mistakes` 和现有本地安全交付能力？

## Answer

### 所有权与修改边界

Project 继续由内嵌 Firstmate 控制面管理。ClerkMesh 不建立第二套 Project registry，不重新定义 Project identity，不接管 Task、brief、Worker、validation、landing、landed proof 或 teardown。

V1 直接修改根仓库跟踪的 `firstmate/` 源码，不使用嵌套 checkout、patch stack 或运行时 clone。修改只完善 Firstmate 通用的 Project/local-only 能力，不引入 Clerk registry、选择、学习或真人流程等 ClerkMesh 产品语义。

V1 保留：

- `projects/<name>` 平铺 Project 布局；
- `data/projects.md` 私有 registry；
- `fm-project-mode.sh` 的 `local-only | direct-PR | no-mistakes` mode；
- `+yolo` 独立授权；
- 现有 Worker worktree、Task branch、review diff、本地 fast-forward landing、landed proof 和 fail-closed teardown。

V1 不支持把任意外部绝对路径直接注册为 Project。已有外部仓库由用户先自行移动或 clone 到 `firstmate/projects/<name>`，不增加 canonical external path 或新的 registry schema。

### 最新 Firstmate 证据

2026-07-24 将独立 Firstmate checkout 从 Ticket 02 使用的 `68ed7ed2355619749c6ee2bb91b7298dee420df8` 同步到当时 upstream `main` 最新的：

```text
f017572eab2930cc4c03e830d44620935ba77035
```

最新版本已经支持 local-only 的无 remote registry、Worker worktree、本地 branch、受保护 fast-forward landing 和 landed proof，但仍存在：

1. `AGENTS.md` 全局要求 GitHub authentication good 后才能 dispatch；
2. bootstrap 无条件把 `gh`、`gh-axi`、No Mistakes 和 `gh auth` 作为通用前置；
3. local-only Ship brief 仍收到通用 GitHub tooling 规则；
4. Firstmate 创建全新 local-only repository 的自然语言流程没有确定性初始化脚本，也没有明确建立 baseline commit。

完整复核见：

```text
../research/firstmate-latest-local-project-delta.md
```

实现开始时必须在最终复制进 `firstmate/` 的 provenance commit 上重新确认这些事实；研究 SHA 不是永久版本假设。

### 默认 delivery mode

新建或添加 Project 时，只要 Captain 没有明确授权远端交付，就默认：

```text
local-only
```

该规则不根据是否碰巧存在 `origin` 推断发布意图。只有 Captain 明确要求通过 PR 或 No Mistakes 交付时，才选择：

- `direct-PR`；或
- `no-mistakes`。

因此 GitHub repository 在工具和认证完整时仍可正常使用 No Mistakes；Ticket 13 不禁止或移除任何远端 mode，只是不让远端能力成为所有 Firstmate 工作的全局前置。

### 按 Task dispatch 检查能力

普通 session startup 只检查 Firstmate 通用本地控制面，不再无条件运行或显示 forge-specific 的：

- `gh auth status`；
- `NEEDS_GH_AUTH`；
- `gh-axi` readiness；
- No Mistakes readiness。

这些检查移动到：

1. 添加远端 Project；
2. 切换 Project delivery mode；
3. dispatch 使用远端 delivery mode 的 Task。

缺失能力只阻塞对应 Project/Task，不阻塞 Firstmate session 或其他 local-only Task。Task 保留在 Firstmate backlog，并由 Primary 记录明确原因，例如：

```text
blocked: GitHub delivery requires gh authentication
```

Firstmate 不自动登录、创建 token、修改 remote 或降级 delivery mode。Captain 修复环境后，Primary 重新检查并 dispatch。

### 确定性 dispatch preflight

新增一个窄的 Firstmate Project dispatch preflight，并由两层调用同一实现：

1. Primary 在 dispatch 前调用，用于解释缺失能力并更新 backlog；
2. `fm-spawn.sh` 在创建 Worker/worktree/endpoint/`.meta` 前再次调用，作为模型遗忘时的机械兜底。

通用检查至少包括：

- registry 中 Project 和 mode 可解析；
- Project 位于 `firstmate/projects/<name>`；
- 是受支持的 non-bare Git working tree；
- default branch 与 baseline commit 可解析；
- 具备 Firstmate 创建隔离 worktree 所需的本地条件。

Mode-specific 检查：

```text
local-only
→ 不要求 gh、gh auth、gh-axi 或 No Mistakes

direct-PR
→ origin + GitHub CLI/helper + GitHub auth/readiness

no-mistakes
→ origin + GitHub CLI/helper + GitHub auth/readiness
→ No Mistakes 安装、Project 初始化和 doctor/readiness
```

Preflight 只读取并验证环境，不通过 push 测试 branch、创建临时 PR、修改 remote、自动登录或切换 mode 来探测能力。任何失败必须发生在 Worker endpoint、worktree 和执行 metadata 创建之前，不留下半启动 Worker。

当前 Firstmate 对 GitLab 只具备 MR URL 识别和 watcher observation，尚无与 GitHub 相同的创建/合并端到端 parity；Ticket 13 不补齐 GitLab provider。

### 新建 local-only Project 的确定性脚本

新增窄 Bash 初始化脚本，代替 Primary 临时拼接 `mkdir`、`git init` 和 registry 编辑。脚本只创建全新的 local-only Project：

```text
验证输入
→ 创建 firstmate/projects/<name>
→ git init -b main
→ 生成 README.md
→ 创建 initial commit
→ 最后写入 data/projects.md，mode=local-only
```

README 内容：

```markdown
# <project-name>

This project was created with ClerkMesh.
```

初始提交信息：

```text
Initialize project with ClerkMesh
```

这里使用 ClerkMesh，而不是 Clerk：Clerk 是可选择的持久工作身份，不拥有 Project；Project 创建由 Captain 请求并由 Firstmate 控制面执行。

脚本开始前必须确定性检查：

1. 当前 session 持有 Firstmate 可写锁；
2. Project name 非空，只含 `A-Z a-z 0-9 . _ -`，并拒绝 `.`、`..`、斜杠和路径穿越；
3. `projects/<name>` 不存在，包括 file、directory 和 symlink；
4. registry 中不存在同名 entry；
5. `projects/` 与 `data/` 可写；
6. `git` 可用；
7. Git author name/email 已配置，可创建 initial commit；
8. Project name 可安全写入固定 README template；
9. 初始 default branch 明确为 `main`；
10. mode 固定为 `local-only`，不创建 remote。

任一 preflight 失败时不得创建目录或修改 registry。执行阶段使用 `set -euo pipefail`，先完成 repository、README 和 commit，最后才写 registry。

V1 不实现完整事务、自动 rollback 或 recovery journal。执行阶段失败时立即停止、非零退出、报告遗留路径，不自动删除任何目录；Captain处理少见的半成品。脚本绝不覆盖或删除预先存在的目录、repository 或 registry entry。

### Project mode 切换

从 `local-only` 切换到 `direct-PR` 或 `no-mistakes` 时：

1. Captain 明确要求切换；
2. Firstmate 运行对应 preflight；
3. `no-mistakes` 还需完成初始化和 doctor；
4. 全部通过后才原子更新 `data/projects.md`；
5. 任一步失败都保留原 mode；
6. 已运行 Task 继续使用 spawn 时写入 metadata 的原交付契约，新 Task 使用新 mode。

反向切换同样只影响新 Task，不重写运行中 Worker 的交付语义。

### Mode-specific brief、local-only validation 与 landing

Ship brief 必须按 Project mode 生成规则：local-only brief 不注入 GitHub、PR、`gh-axi` 或 No Mistakes 要求；`direct-PR` 与 `no-mistakes` 继续获得各自现有远端交付规则。通用 Worker 安全、状态、worktree 和监督规则保持共享。

local-only 不运行 No Mistakes pipeline，也不新增 validation 状态机。Worker 必须运行 Project 已有且与任务相关的测试、lint、typecheck，并报告执行命令和结果。

合并前 Firstmate 展示 authoritative diff 和验证结果，并保持现有安全门禁：

- 测试失败则不合并；
- primary checkout 或 Worker worktree 不干净则不合并；
- branch 不能 fast-forward 到当前本地 default branch 则拒绝，rebase 后必须重新验证；
- `yolo=off` 时必须由 Captain 明确批准；
- `yolo=on` 时，只有 diff 符合原请求、验证通过、工作区干净且可 fast-forward，Firstmate 才可自动合并；
- 破坏性、安全敏感或超出原请求契约的决定，即使 `yolo=on` 仍升级给 Captain；
- 自动合并后向 Captain 报告本地 default branch 的结果。

Captain 对 local-only Task 明确要求 No Mistakes 时，Primary 必须说明当前 mode 冲突，并请 Captain选择：

1. 保持 local-only，使用 Project 自身测试；或
2. 配置 remote 并把 Project 切换为 `no-mistakes`，走完整 PR/CI pipeline。

V1 不把 No Mistakes 拆成可叠加到 local-only 的本地 validation adapter。

### 用户自行配置 origin 的边界

Ticket 13 只保证**没有 remote 的 local-only Project**不需要 GitHub/GitLab。若用户自行给 local-only repository 配置 `origin`，现有 Firstmate review 或 Git 路径可能访问该 remote；网络、Git credential 和 remote 可用性由用户负责。

V1 不增加“有 origin 但强制离线”的特殊模式，不删除 remote，不在失败时静默改用陈旧远端基线。相关 Git 操作失败时保持 fail closed，并向 Captain 报告环境问题。

### V1 验收

至少覆盖：

1. 没有 `gh`、没有 GitHub认证时，Firstmate仍能启动；
2. 新建 local-only Project 生成 `README.md`、`main` 和 initial commit；
3. Captain 未授权远端交付时默认注册为 `local-only`；
4. local-only Task 完成 spawn、项目测试、review、fast-forward merge 和 teardown；
5. `yolo=off` 未经 Captain 批准不能本地合并；
6. `yolo=on` 在全部安全条件满足后可以自动本地合并；
7. GitHub/No Mistakes 能力缺失只阻塞对应远端 Task；
8. 配置正确的 `direct-PR` 和 `no-mistakes` 流程不回归；
9. Project mode 切换 preflight 失败时保留原 mode；
10. `fm-spawn.sh` 机械拒绝未通过 preflight 的远端 Task，且不留下 Worker/worktree/endpoint/`.meta`；
11. 初始化脚本拒绝非法 name、已存在 path、symlink、重复 registry entry 和缺失 Git author；
12. 外部绝对路径不能绕过 `projects/<name>` 布局直接注册。

## Out of scope

- ClerkMesh 自己的 Project registry；
- 任意 external-path Project identity；
- 全面重构 Project schema；
- 将 validation、publication 和 landing 重写为新的正交配置系统；
- 把 No Mistakes 拆成 local-only validation adapter；
- 第二套 brief、Task 状态或 landed proof；
- local-only + configured origin 的强制离线语义；
- Secondmate 的本地 Project materialization；
- GitLab 创建/合并 parity；
- Firstmate upstream 同步、升级、多版本或 rollback。
