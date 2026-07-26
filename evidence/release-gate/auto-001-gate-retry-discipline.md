# AUTO-001 — gate failure diagnosis and retry discipline

Status: **complete**

ClerkMesh's tracked Gate 0 lock certification retains the complete failure-to-pass record rather than only its final green result. The record identifies each failed attempt, its concrete diagnosis, the corrective change, and the subsequent rerun. It includes fixture synchronization failures, incomplete cleanup proof, a strict Pi compatibility failure, and an intermittent behavioral-test failure. The final evidence records repeated passing genuine-runtime runs and three sequential passing focused reruns after the last intermittent failure.

This establishes the required autonomous gate discipline:

1. a failed gate is not waived or represented as passing;
2. the failure is diagnosed before changing the implementation or fixture;
3. the correction is rerun at the failed boundary;
4. the final tracked evidence retains both failures and the passing result.

The stage evidence inventory applies the same rule to every stage: each Gate 0 and Slice 1–5 exit links a replayable automated result, genuine scenario, known-risk boundary, and replay command. A stage with a final unmet prerequisite remains incomplete under PLAN-001/PLAN-002 rather than being bypassed.

## Reproduce

From the repository root:

```sh
python3 - <<'PY'
from pathlib import Path

retry = Path('evidence/gate-0/lock-liveness.md').read_text()
stages = Path('evidence/release-gate/plan-003-stage-evidence-completeness.md').read_text()
index = Path('docs/requirement-evidence.md').read_text()

for marker in (
    '## AUTO-001 retry record',
    '| Attempt | Result | Diagnosis and correction |',
    '| `3017707` | failed |',
    '| `395127b` | passed |',
    '| post-cert validation | failed, then passed |',
    '| final focused validation | failed intermittently, then passed 3/3 |',
):
    assert marker in retry
for stage in ('Gate 0', 'Slice 1', 'Slice 2', 'Slice 3', 'Slice 4', 'Slice 5'):
    assert stage in stages
assert '| AUTO-001 | complete |' in index
assert '- Release Gate: **in progress**' in index
print('AUTO-001 gate retry discipline: PASS')
PY
```

Result: `AUTO-001 gate retry discipline: PASS`.

Known boundary: this records engineering-agent retry behavior and does not waive a failing check, satisfy the pending clean-root aggregate Release Gate run, authorize destructive remote work, or substitute for Captain UAT.
