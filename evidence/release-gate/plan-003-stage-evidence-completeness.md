# PLAN-003 stage evidence completeness

Status: **complete**

Each completed engineering stage has all five required outputs: requirement coverage, automated results, genuine-scenario evidence, known risks, and replay commands. The linked stage artifacts retain the detailed assertions and machine evidence; this inventory makes omissions visible without treating the existence of code as acceptance.

| Stage | Requirement coverage | Automated result and replay | Genuine scenario and replay | Known risk / boundary |
|---|---|---|---|---|
| Gate 0 | `docs/requirement-evidence.md` (`G0-001`–`G0-005`) | `corepack pnpm run test:gate0-layout && corepack pnpm run test:gate0-tracking && corepack pnpm run test:gate0-lock && corepack pnpm run test:gate0-primary-launch && corepack pnpm run test:gate0-no-forge && corepack pnpm run test:firstmate` | `corepack pnpm run cert:gate0-primary-lock`; `evidence/gate-0/g0-003-execution-dependency.md` | Only macOS 15+ arm64 and the pinned toolchain are supported; same-user processes are not a hard isolation boundary. |
| Slice 1 | `docs/slice-1-requirement-matrix.md`; `docs/requirement-evidence.md` (`S1-001`–`S1-006`, `CONV-*`) | `corepack pnpm run test:slice1-schema` | `corepack pnpm run cert:slice1-history-browse && corepack pnpm run cert:slice1-concurrent-first-send && corepack pnpm run cert:slice1-stream-extension-ui && corepack pnpm run cert:slice1-reconnect-idempotency && corepack pnpm run cert:slice1-refresh-restart && corepack pnpm run cert:slice1-shutdown-offline`; `evidence/slice-1/` | Diagnostic projection is opt-in and bounded; Pi Session JSONL remains conversation authority. |
| Slice 2 | `docs/requirement-evidence.md` (`S2-001`–`S2-007`, `CLERK-*`, `EXEC-*`) | `corepack pnpm run test:slice2-clerk-repository` | `corepack pnpm run cert:slice2-primary-selection && corepack pnpm run cert:slice2-worker-capability && corepack pnpm run cert:slice2-worker-continuity && corepack pnpm run cert:slice2-task-detail && corepack pnpm run cert:slice2-clarification-escalation`; `evidence/slice-2/` | Workers use ordinary Firstmate supervision and are not hard-isolated from other processes owned by the same OS user. |
| Slice 3 | `docs/requirement-evidence.md` (`S3-001`–`S3-007`, `PROJ-*`) | `corepack pnpm run test:slice3-project-catalog` | Local replay: `corepack pnpm run cert:slice3-local-delivery && corepack pnpm run cert:slice3-yolo-escalation && corepack pnpm run cert:slice3-projections && corepack pnpm run cert:slice3-web-polling && corepack pnpm run cert:slice3-exit-recovery && corepack pnpm run cert:slice3-clerk-recovery`; remote evidence: `evidence/slice-3/s3-007-remote-certification-blocker.md` | Destructive remote replay is allowed only against `S3_007_REMOTE_REPOSITORY`, never this product repository; it requires external forge credentials and explicit fixture authorization. |
| Slice 4 | `docs/requirement-evidence.md` (`S4-001`–`S4-005`, `HUMAN-*`) | `corepack pnpm run test:slice4-human` | `corepack pnpm run cert:slice4-human-execution && S4_003_LIVE=1 corepack pnpm run cert:slice4-human-agent-handoff`; `evidence/slice-4/` | Engineering acceptance uses an isolated test Captain; final Captain UAT remains intentionally pending. |
| Slice 5 | `docs/requirement-evidence.md` (`S5-001`–`S5-007`, `LEARN-*`) | `corepack pnpm run test:slice5-learning` | `S5_002_LIVE=1 node tests/cert/s5-002-real-learning-extraction.mjs && corepack pnpm run cert:slice5-restart-reconciliation && corepack pnpm run cert:slice5-test-captain-decisions`; `evidence/slice-5/` | Extraction depends on a running Herdr session; engineering decisions use an isolated test Captain and final Captain UAT remains pending. |

## Reproduce the inventory

From a clean repository root:

```sh
python3 - <<'PY'
from pathlib import Path

text = Path('evidence/release-gate/plan-003-stage-evidence-completeness.md').read_text()
for stage in ['Gate 0', 'Slice 1', 'Slice 2', 'Slice 3', 'Slice 4', 'Slice 5']:
    row = next((line for line in text.splitlines() if line.startswith(f'| {stage} |')), None)
    assert row is not None, stage
    assert row.count('|') == 6, (stage, row)

index = Path('docs/requirement-evidence.md').read_text()
for requirement in ['G0-001', 'S1-003', 'S2-001']:
    assert f'| {requirement} | complete |' in index, requirement
for marker in [
    '- Gate 0: **complete**', '- Slice 1: **complete**',
    '- Slice 2: **complete**', '- Slice 3: **complete**',
    '- Slice 4: **awaiting-final-captain-uat**',
    '- Slice 5: **awaiting-final-captain-uat**',
]:
    assert marker in index, marker

package = Path('package.json').read_text()
for command in [
    'test:gate0-layout', 'cert:gate0-primary-lock',
    'test:slice1-schema', 'cert:slice1-history-browse',
    'test:slice2-clerk-repository', 'cert:slice2-primary-selection',
    'test:slice3-project-catalog', 'cert:slice3-local-delivery',
    'test:slice4-human', 'cert:slice4-human-execution',
    'test:slice5-learning', 'cert:slice5-restart-reconciliation',
]:
    assert f'"{command}"' in package, command
print('PLAN-003 stage evidence completeness: PASS')
PY
```

The genuine commands may invoke Pi, Herdr, Treehouse, or the authorized remote fixture. Their tracked artifacts are the reproducible stage output; callers must honor each fixture's prerequisites and destructive-safety boundary before replacing them.
