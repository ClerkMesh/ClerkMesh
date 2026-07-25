# S4-004 isolated test-Captain success, refusal, and recovery

Status: passed

Observed UTC: 2026-07-25

## Reproduce

```sh
corepack pnpm run test:slice4-human
S4_001_LIVE=1 corepack pnpm run cert:slice4-human-execution
S2_007_LIVE=1 corepack pnpm run cert:slice2-clarification-escalation
```

The focused suite was rerun from the repository root and produced:

```text
ok - Primary Extension injects complete behavior rules once per run and exposes capability status
ok - Human Clerk report publication is atomic, provenance-bearing, and fail closed
ok - isolated Human lifecycle persists Captain report and creates no Worker runtime facts
ok - accepted Human work creates an authoritative projected dependency edge for a separate Agent Task
ok - Work Task detail presents Human Clerk execution without Worker or ownership claims
```

## Retained test-Captain evidence

The implementation Agent acted only as a test Captain over temporary fixture data. The successful genuine-Pi conversation relayed start, progress, evidence, and exact final Markdown; the Primary selected `document-reviewer`, evaluated both criteria, and published the provenance-bearing `report.md`. Its retained transcript facts, report facts, selected execution-context projection, and negative runtime assertions are recorded in [`s4-001-human-execution.md`](s4-001-human-execution.md).

The refusal conversation first left unmatched work in clarification and later waited at the selection preview rather than mutating the brief or inventing execution. Only an explicit test-Captain takeover selected Escalation. The genuine-Pi transcript facts and negative runtime assertions are recorded in [`s4-002-human-escalation-selection.md`](s4-002-human-escalation-selection.md). The focused report contract additionally proves invalid outcomes, empty relayed results, mismatched contexts, and unsafe report targets fail closed without replacing an authoritative report.

For recovery, the isolated lifecycle fixture published an accepted report, discarded its in-memory Task detail, and freshly recomposed the Task detail from the authoritative brief/report plus task-graph projection. The recovered `execution_clerk` exactly matched the pre-restart projection, remained explicitly `human`, and contained no Worker or Agent fact. A subsequent refused empty result left the accepted report byte-for-byte unchanged.

Across the success, refusal, and recovery checks, Human Task directories contain only `brief.md` and, after acceptance, `report.md`; no endpoint, Worker, capability, worktree, status, or wake was created. The fixtures are removed after each run and cannot modify a real Clerk repository, Firstmate fleet, Project, or business Task. These are engineering decisions in isolated data only, not Captain UAT or business approval.
