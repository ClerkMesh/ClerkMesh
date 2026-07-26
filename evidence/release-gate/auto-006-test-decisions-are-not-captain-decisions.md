# AUTO-006 — automated decisions remain test facts

Status: **complete**

ClerkMesh never treats an implementation Agent's fixture review, approval, or rejection as a real Captain business decision:

| Boundary | Automated scenario | Isolation and authority result |
|---|---|---|
| Human Clerk | `evidence/slice-4/s4-004-test-captain-paths.md` exercises success, refusal, and recovery as an explicitly isolated implementation-Agent-as-test-Captain fixture | The conversations, Tasks, reports, and Project state are disposable. The artifact explicitly disclaims Captain approval and real business data, while Slice 4 remains `awaiting-final-captain-uat`. |
| Learning | `evidence/slice-5/s5-006-test-captain-decisions.md` reviews exact diffs, approves one target, and rejects another in disposable Clerk repositories | The decisions certify mechanics only. The fixture refuses configured real ClerkMesh authority, never advances a real Clerk, and is explicitly not Captain acceptance; Slice 5 remains `awaiting-final-captain-uat`. |
| Durable production decisions | OWN-003 coverage requires completed real Learning decisions and explicit yolo-off local landing approval to carry fixed `captain/local` provenance | Automated yolo-on landing has no Captain actor, so automation cannot manufacture Captain attribution. Fixture-local `captain/local` records remain facts inside disposable authority, not evidence that the real Captain made a business decision. |
| Release authority | `evidence/release-gate/plan-004-internal-milestones.md` preserves the distinction between engineering milestones, a Release Candidate, and V1 | REL-002/REL-003 still require the Captain's concentrated real Human Clerk flow, Learning exact-diff decision, and release confirmation. No automated result can satisfy them. |

Thus automated reviews and decisions are reproducible acceptance inputs only within their isolated fixtures. They do not cross into canonical business authority, do not change either Slice's UAT marker, and do not authorize release.

## Reproduce

From the repository root:

```sh
python3 - <<'PY'
from pathlib import Path

index = Path('docs/requirement-evidence.md').read_text()
human = Path('evidence/slice-4/s4-004-test-captain-paths.md').read_text()
learning = Path('evidence/slice-5/s5-006-test-captain-decisions.md').read_text()
plan = Path('evidence/release-gate/plan-004-internal-milestones.md').read_text()
assert '| AUTO-006 | complete |' in index
assert 'test-Captain' in human
assert 'not Captain UAT or business approval' in human
assert 'test-Captain' in learning
assert 'not Captain UAT or a real business approval' in learning
assert 'real Clerk repositories' in learning
assert 'REL-002' in plan and 'REL-003' in plan
assert '- Slice 4: **awaiting-final-captain-uat**' in index
assert '- Slice 5: **awaiting-final-captain-uat**' in index
assert 'AUTO-001 through AUTO-006 complete' in index
print('AUTO-006 test-decision boundary: PASS')
PY
```

Result: `AUTO-006 test-decision boundary: PASS`.

Known boundary: `captain/local` identifies the fixed local actor at a production decision boundary; it is not an authentication mechanism. Final Captain UAT is intentionally outstanding until REL-002/REL-003.
