# PLAN-004 — internal milestone boundary

Status: complete

Slice 1 through Slice 5 are engineering milestones, not independently released products or a claim that ClerkMesh V1 is complete. The authoritative stage status keeps Slice 4 and Slice 5 at `awaiting-final-captain-uat` while the Release Gate remains in progress. Their acceptance artifacts explicitly preserve the remaining Release Gate and Captain UAT boundaries.

The implementation specification permits only a Release Candidate after REL-001. A V1 release remains prohibited until Captain-only REL-002/REL-003 passes; fixture approvals and internal Slice completion cannot satisfy that boundary.

## Reproduce

From the clean repository root:

```sh
python3 - <<'PY'
from pathlib import Path

index = Path('docs/requirement-evidence.md').read_text()
s4 = Path('evidence/slice-4/s4-005-awaiting-final-captain-uat.md').read_text()
s5 = Path('evidence/slice-5/s5-007-awaiting-final-captain-uat.md').read_text()
spec = Path('IMPLEMENTATION_SPEC.md').read_text()

for marker in (
    '- Slice 4: **awaiting-final-captain-uat**',
    '- Slice 5: **awaiting-final-captain-uat**',
    '- Release Gate: **in progress**',
):
    assert marker in index
assert 'Final Captain UAT has not occurred' in s4
assert 'Release remains prohibited' in s5
assert '**PLAN-004**' in spec
assert '**REL-001**' in spec and '**REL-002**' in spec and '**REL-003**' in spec
assert 'Target: Release Candidate → Captain UAT → V1' in spec
print('PLAN-004 internal milestone boundary: PASS')
PY
```

Result: `PLAN-004 internal milestone boundary: PASS`.

Known boundary: this evidence establishes milestone labeling only. It does not satisfy any remaining Release Gate item, build a Release Candidate, perform Captain UAT, or authorize a V1 release.
