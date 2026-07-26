# AUTO-002 — reversible implementation decisions

Status: **complete**

The engineering record shows that specification-conforming, reversible choices were made without introducing Captain-only product decisions or artificial approval gates. Representative choices span implementation, fixtures, and evidence:

1. Learning candidates use no-hardlink clones rather than linked worktrees so candidate Git metadata cannot mutate canonical Clerk repositories (`S5-002`).
2. Learning reviews derive candidate trees with a temporary Git index and invalidate prior acknowledgement whenever that tree changes (`S5-003`).
3. Restart reconciliation uses persisted endpoint and Proposal authority and completion markers instead of inventing runtime or decision facts (`S5-005`).
4. Genuine-runtime fixture workspace labels derive from canonical disposable-root hashes while production workspace naming remains unchanged (`QA-005`).
5. Web read models gained additive versioned metadata and generated types while authoritative state remained in Pi, Firstmate, Clerk Git, and Learning manifests (`READ-002` through `READ-004`).

Each choice is bounded by an existing requirement, covered by a focused test or reproducible evidence check, and reversible through an ordinary source change. None required a specification change, external credential, destructive authorization, security exception, or real business approval. Those boundaries remain reserved to the Captain under AUTO-003, AUTO-006, and REL-002/REL-003.

## Reproduce

From the repository root:

```sh
python3 - <<'PY'
from pathlib import Path

index = Path('docs/requirement-evidence.md').read_text()
notes = Path('evidence/release-gate/auto-002-reversible-implementation-decisions.md').read_text()

for marker in (
    'no-hardlink clones',
    'temporary Git index',
    'completion markers',
    'canonical disposable-root hashes',
    'additive versioned metadata',
    'None required a specification change',
):
    assert marker in notes
for requirement in ('QA-005', 'READ-002', 'READ-003', 'READ-004'):
    assert f'| {requirement} | complete |' in index
for exit_id in ('S5-002', 'S5-003', 'S5-005'):
    row = next(line for line in index.splitlines() if line.startswith(f'| {exit_id} |'))
    assert '**Complete:**' in row
assert '| AUTO-002 | complete |' in index
assert '- Release Gate: **in progress**' in index
print('AUTO-002 reversible implementation decisions: PASS')
PY
```

Result: `AUTO-002 reversible implementation decisions: PASS`.

Known boundary: this evidence covers autonomous reversible engineering choices only. It does not authorize remote destruction, credentials, security exceptions, specification changes, Captain business decisions, final UAT, or a Release Candidate.
