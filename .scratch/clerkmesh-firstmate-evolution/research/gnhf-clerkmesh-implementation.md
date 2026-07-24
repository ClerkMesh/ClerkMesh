# 用 GNHF 推进 ClerkMesh V1 的建议

Research baseline: `kunchenguid/gnhf@1d0673920f3ee6427bc75805faccd02a6d614e84`（2026-07-24 获取）

Published npm version checked: `0.1.41`

## 结论

ClerkMesh 已有明确、严格排序且可验证的 `IMPLEMENTATION_SPEC.md`，适合 GNHF **Hands-Off** 模式。GNHF 本身就是循环 orchestrator：每轮启动一个非交互 coding agent，让它完成一个可验证增量；成功则自动提交并把摘要追加到本地 `notes.md`，失败则回滚；满足自然语言 stop condition、达到 iteration/token cap、连续失败或永久错误时停止。[README: How It Works](https://github.com/kunchenguid/gnhf/blob/1d0673920f3ee6427bc75805faccd02a6d614e84/README.md#how-it-works) [iteration prompt](https://github.com/kunchenguid/gnhf/blob/1d0673920f3ee6427bc75805faccd02a6d614e84/src/templates/iteration-prompt.ts)

它不是独立质量裁判：GNHF 根据 worker 的 structured result 决定提交与 `should_fully_stop`，不会另启 reviewer 验证成功声明。因此夜间目标应是 **Release Candidate**，早晨仍需独立检查 diff、重新运行验证并完成 Captain UAT。[GNHF skill: Companion Review](https://github.com/kunchenguid/gnhf/blob/1d0673920f3ee6427bc75805faccd02a6d614e84/skills/gnhf/SKILL.md#companion-review)

## 为什么使用一个 run

推荐一个长 run，而不是每个 Slice 单独启动：

- ClerkMesh 要求 `Gate 0 → Slice 1 → … → Slice 5 → Release Gate` 严格顺序；一个 worker loop 可从仓库状态选择“最早未完成 Gate”。
- 每个新 run 都需要重新理解仓库、目标和 branch；单 run 用自动维护的 `notes.md` 传递增量记忆。[README: Shared memory](https://github.com/kunchenguid/gnhf/blob/1d0673920f3ee6427bc75805faccd02a6d614e84/README.md#how-it-works)
- Pi adapter 每轮使用 `--mode json --no-session`，所以必须依赖仓库事实与 notes，不应依赖隐式会话记忆。[Pi adapter](https://github.com/kunchenguid/gnhf/blob/1d0673920f3ee6427bc75805faccd02a6d614e84/src/core/agents/pi.ts)

代价是 notes 会随迭代增长并在每轮注入。为控制 token，worker 输出必须保持简短，只记录 material outcomes 和真正的新 learning；详细证据应写入仓库中的 coverage/evidence 文件，而不是 notes。[run.ts: appendNotes](https://github.com/kunchenguid/gnhf/blob/1d0673920f3ee6427bc75805faccd02a6d614e84/src/core/run.ts#L364-L377)

## 安全运行形态

使用 `--worktree --push`：

- `--worktree` 在 sibling worktree 和独立 branch 中执行，不改变 main checkout；有 commit 的 worktree 在退出后保留供审查。
- `--push` 在每次成功提交后推送当前 candidate branch，降低整夜本地故障导致丢失的风险。
- 不使用 `--current-branch --push`，避免未经晨间审查的增量直接进入 main。

来源：[README: Worktree Mode](https://github.com/kunchenguid/gnhf/blob/1d0673920f3ee6427bc75805faccd02a6d614e84/README.md#worktree-mode)、[README: Live Branch Mode](https://github.com/kunchenguid/gnhf/blob/1d0673920f3ee6427bc75805faccd02a6d614e84/README.md#live-branch-mode)。

## 运行前检查

1. main clean 且已 push。
2. 安装 GNHF：`npm install -g gnhf@0.1.41`。
3. `gnhf --help` 与 `gnhf --version`。
4. Pi 已认证且能完成一次无 session JSON run。
5. Pi、Herdr、Treehouse、Git、Node/pnpm 和隔离远端测试仓库所需凭据已准备；GNHF 无法绕过 Captain-only prerequisite。
6. 禁用可选 telemetry：`export GNHF_TELEMETRY=0`。
7. 保留默认 `maxConsecutiveFailures: 3` 和 sleep prevention；macOS 上 GNHF 使用 `caffeinate`。[README: Configuration](https://github.com/kunchenguid/gnhf/blob/1d0673920f3ee6427bc75805faccd02a6d614e84/README.md#configuration)

当前环境事实：Pi `0.80.10`，默认 `openai-codex/gpt-5.6-sol`、thinking `medium`；GNHF 尚未安装。ClerkMesh 最终运行时版本仍须按 `IMPLEMENTATION_SPEC.md` Gate 0 重新认证。

## 推荐 prompt

不要把 23KB 规格复制进 prompt。让 prompt 指向仓库内唯一规范，可减少每轮固定输入并防止 prompt 与规格分叉：

```text
Objective: implement the complete ClerkMesh V1 Release Candidate defined by IMPLEMENTATION_SPEC.md.

Treat IMPLEMENTATION_SPEC.md as normative and CONTEXT.md as the domain language. Work only in this repository. Before changing code, inspect the current branch, recent commits, the implementation spec, and existing progress/evidence.

Strict order: Gate 0, Slice 1, Slice 2, Slice 3, Slice 4, Slice 5, then Release Gate. At the start of every iteration, identify the earliest unmet gate or exit condition. Never implement, enable, or claim a later stage before that stage passes. Group closely coupled requirements into one bounded, independently verifiable work package; do not perform unrelated refactors.

Create and maintain a concise tracked requirement-to-test/evidence index. Mark a requirement complete only from reproducible evidence. Run the narrowest relevant checks during an iteration and the full required gate checks at each stage boundary. Use real Pi, Herdr, Treehouse, and Git wherever IMPLEMENTATION_SPEC.md requires real certification; never replace those gates with mocks or fabricated evidence.

Follow AUTO-001 through AUTO-006. Diagnose and repair reversible failures autonomously. Never ask for routine implementation choices. If blocked only by a Captain decision, unavailable credential, destructive authorization, or an impossible external prerequisite, document the exact blocker, commands, and evidence without claiming the dependent gate passed.

Slice 4 and Slice 5 engineering checks must use isolated fixtures with the agent acting as test Captain. Never put simulated approvals into real business data. The final result is a Release Candidate, not Captain acceptance. Do not merge to main.

Keep each iteration's final summary and key learnings terse and non-redundant to control future notes/context size. Put detailed evidence in tracked files. Stop background processes before ending an iteration. Do not commit manually; GNHF owns commits.
```

## 推荐 stop condition

```text
Stop only when either: (A) every Gate 0, Slice 1-5, CERT-001 through CERT-006, and Release Gate requirement through REL-001 has reproducible recorded evidence, all required checks pass from a clean root, a Release Candidate is built, and only REL-002/REL-003 Captain UAT remains; or (B) a genuine Captain-only decision, credential, destructive authorization, or external prerequisite blocks the earliest unmet gate and a concise blocker report with reproducible evidence has been committed. Never stop merely because code was written or unit tests pass.
```

允许 (B) 很重要：否则无人值守时，worker 可能在无法取得凭据或授权的 Gate 上重复消耗 token。连续三次失败本来也会触发 GNHF abort，但明确 blocker stop 能留下更清晰的状态。[orchestrator failure/stop handling](https://github.com/kunchenguid/gnhf/blob/1d0673920f3ee6427bc75805faccd02a6d614e84/src/core/orchestrator.ts)

## 推荐命令

将上面的 prompt 保存到 `/tmp/clerkmesh-gnhf-prompt.md`，stop condition 保存到 shell 变量，然后从 clean `main` 运行：

```bash
export GNHF_TELEMETRY=0

STOP_WHEN='Stop only when either: (A) every Gate 0, Slice 1-5, CERT-001 through CERT-006, and Release Gate requirement through REL-001 has reproducible recorded evidence, all required checks pass from a clean root, a Release Candidate is built, and only REL-002/REL-003 Captain UAT remains; or (B) a genuine Captain-only decision, credential, destructive authorization, or external prerequisite blocks the earliest unmet gate and a concise blocker report with reproducible evidence has been committed. Never stop merely because code was written or unit tests pass.'

cat /tmp/clerkmesh-gnhf-prompt.md | gnhf \
  --agent pi \
  --worktree \
  --push \
  --prevent-sleep on \
  --max-iterations 40 \
  --max-tokens 4000000 \
  --stop-when "$STOP_WHEN"
```

`40` iterations 和 `4,000,000` input+output tokens 是首次夜间运行的成本上限，不是目标消耗或完成保证；stop condition 满足后会提前退出。完整绿地 V1 同时包含 vendoring、Web、CLI、Firstmate 改造、真实 runtime 和 Learning，该预算更适合先完成最大量的严格顺序进展，不保证一次覆盖整个 RC。达到上限后应在保留的 branch/worktree 上 resume，不得跳过未完成 Gate。`--max-iterations` 在轮次之间停止；`--max-tokens` 可以在轮次中达到上限时 abort，因此当前迭代可能被回滚。[README: Runtime caps](https://github.com/kunchenguid/gnhf/blob/1d0673920f3ee6427bc75805faccd02a6d614e84/README.md#how-it-works) [orchestrator token abort](https://github.com/kunchenguid/gnhf/blob/1d0673920f3ee6427bc75805faccd02a6d614e84/src/core/orchestrator.ts)

若希望降低预算，优先把 `--max-tokens` 调到可接受的总成本，而不是降低验证要求或允许跨 Gate。达到上限后可在保留的 GNHF branch/worktree 上 resume；GNHF 保存 prompt、stop condition、base commit、notes 和 iteration logs 到本地 `.gnhf/runs/`，并通过 `.git/info/exclude` 排除这些 metadata。[README: Resume](https://github.com/kunchenguid/gnhf/blob/1d0673920f3ee6427bc75805faccd02a6d614e84/README.md#how-it-works) [run metadata](https://github.com/kunchenguid/gnhf/blob/1d0673920f3ee6427bc75805faccd02a6d614e84/src/core/run.ts)

## Token 与效率原则

1. **一条短 objective，引用规范**：不把全部 ticket 或 spec 粘贴进每轮 prompt。
2. **一个 run、一条 candidate branch**：避免每 Slice 重建上下文和手工合并。
3. **严格做最早未完成 Gate**：避免后续工作因底层接口变化返工。
4. **相关 requirements 成组**：每轮保持可验证，但不要细到“一文件一轮”。GNHF 每轮都要重新启动 Pi 和读取上下文。
5. **窄测试在轮内，全测试在 Gate 边界**：不要每个小改动都重复完整真实认证。
6. **简短 notes，详细 evidence 入库**：notes 每轮都会再次注入。
7. **保持 thinking=medium**：当前默认适合混合架构/实现任务；除非出现明确高难 blocker，不要整夜统一升到 high。
8. **设置总 token cap 和 blocker stop**：防止凭据、外部服务或错误 stop judgment 导致无限消耗。
9. **不要并行多个 Slice run**：规格要求严格顺序，且并行 worktrees 会重复构建底座并增加集成成本。
10. **晨间独立 review**：不要为了省 review token 而直接把 candidate branch 合并 main。

## 晨间检查

1. 检查 GNHF 是否仍运行及最终 exit summary。
2. 读取 candidate worktree 的 `.gnhf/runs/<runId>/notes.md` 与 `gnhf.log`；notes 是声明，不是验收证据。
3. 查看 commits、diff、requirement coverage 和 blocker report。
4. 独立重跑 Release Gate 的自动化检查与关键真实认证。
5. 判断 `Mergeable | Needs follow-up GNHF run | Do not merge`。
6. 只有工程证据成立后，Captain 执行 REL-002/REL-003 集中 UAT，再决定是否合并。

来源：[GNHF skill: Morning Review](https://github.com/kunchenguid/gnhf/blob/1d0673920f3ee6427bc75805faccd02a6d614e84/skills/gnhf/SKILL.md#morning-review)。
