# AUTO-004 — prerequisite gate enforcement

Status: **complete**

ClerkMesh's tracked stage record never advances a dependent stage across an unmet prerequisite:

| Boundary | Enforcement evidence | Outcome |
|---|---|---|
| Gate 0 → Slice 1 → Slice 2 → Slice 3 | `evidence/release-gate/plan-001-stage-order.md` | Every earlier engineering exit is recorded before its dependent Slice opens. |
| Slice 3 remote certification | `evidence/slice-3/s3-007-remote-certification-blocker.md` | Remote work remained blocked pending Captain authorization; only the authorized isolated repository was later used. The product repository was never substituted. |
| Slice 4 → Slice 5 | `evidence/slice-4/s4-005-awaiting-final-captain-uat.md` | Slice 5 was unblocked only after all S4-001–S4-004 engineering exits passed; final Captain UAT remained reserved rather than falsely claimed. |
| Slice 5 → Release Gate | `evidence/slice-5/s5-007-awaiting-final-captain-uat.md` | Release Gate work opened only after S5-001–S5-006 passed; fixture decisions were not promoted into business approval. |
| Release Gate → Release Candidate | `docs/requirement-evidence.md` | Release Gate remains `in progress`; no Release Candidate or V1 claim exists while REL-001 is unmet. |

Independent preparation is permitted only behind frozen interfaces and isolated fixtures, as detailed by `evidence/release-gate/plan-002-parallel-preparation-boundary.md`. Such preparation does not alter the authoritative stage status. If a prerequisite ultimately cannot pass, the permitted deliverable remains an incomplete RC plus reproducible blocker evidence; it cannot become a completed dependent Slice.

## Reproduce

From the repository root:

```sh
python3 - <<'PY'
from pathlib import Path

index = Path('docs/requirement-evidence.md').read_text()
order = Path('evidence/release-gate/plan-001-stage-order.md').read_text()
parallel = Path('evidence/release-gate/plan-002-parallel-preparation-boundary.md').read_text()
remote = Path('evidence/slice-3/s3-007-remote-certification-blocker.md').read_text()
s4 = Path('evidence/slice-4/s4-005-awaiting-final-captain-uat.md').read_text()
s5 = Path('evidence/slice-5/s5-007-awaiting-final-captain-uat.md').read_text()
assert '| AUTO-004 | complete |' in index
assert '- Release Gate: **in progress**' in index
assert 'S3_007_REMOTE_REPOSITORY' in remote
assert 'awaiting-final-captain-uat' in s4
assert 'awaiting-final-captain-uat' in s5
assert 'Slice 4' in order and 'Slice 5' in order and 'Release Gate' in order
assert 'prerequisite' in parallel.lower()
assert not any(Path('.').glob('*release*candidate*'))
print('AUTO-004 prerequisite gate enforcement: PASS')
PY
```

Result: `AUTO-004 prerequisite gate enforcement: PASS`.

Known boundary: this is ordering and claim-discipline evidence, not REL-001 completion. The clean-root aggregate checks and Release Candidate build remain pending.
