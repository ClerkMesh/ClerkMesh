# S5-001 Learning Source capture boundary

Status: passed

Observed UTC: 2026-07-25T14:08:01Z

## Reproduce

```sh
corepack pnpm run test:slice5-learning
corepack pnpm run test:slice4-human
S4_003_LIVE=1 corepack pnpm run cert:slice4-human-agent-handoff
```

## Result

The production capture boundary and an isolated genuine-Pi Human-to-Agent fixture established that:

- an explicit Captain CLI import creates an immutable, content-addressed Learning Source;
- an explicitly re-imported agent-generated file is retained only with an agent-generated warning;
- an accepted Human Task report creates exactly one Learning Source before report publication;
- the Source bytes exactly equal the provenance-bearing accepted report;
- the manifest binds the Human Task ID, accepted outcome, report SHA-256, Source SHA-256, Captain-local actor, and non-agent-generated provenance;
- rejected and incomplete Human outcomes do not create Sources; and
- Agent completion, report, wake, and extraction-result origins are refused at the capture boundary.

The genuine Pi fixture continued from the accepted Human result into an authoritative dependent Agent Task, while its isolated `CLERKMESH_STATE` contained the certified Source and no business or real Clerk data.

Observed certification output:

```text
ok - S4-003 real Primary created the dependent Agent Task and freshly selected its Agent Clerk
human_task: human-design-result; learning_source: 4c3bcaa3496c565aa0d1e6c96192ac718f6cbce8a76eb2b0e1b50794239d635e; source_sha256: 6bf0dd44691c85d0e9143cfafe97be17529292a02f1a88bd21670e9e6f87dfb4; agent_task: agent-apply-result; agent_clerk_commit: ad5be4a6577d7baff586dfee0788af2e1d804a6d
```

The fixture was removed after the run.
