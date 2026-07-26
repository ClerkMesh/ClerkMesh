# AUTO-003 — Captain escalation boundary

Status: **complete**

The tracked engineering and genuine-runtime record limits Captain requests to the categories allowed by AUTO-003:

| Allowed boundary | Tracked evidence | Outcome |
|---|---|---|
| Specification conflict or change | `evidence/release-gate/auto-002-reversible-implementation-decisions.md` | Specification-bounded reversible choices proceeded autonomously; specification changes remain explicitly outside that authority. |
| External credentials | `evidence/release-gate/sec-002-credential-ownership.md` | Credentials remain with Pi/provider, Git/SSH, forge CLI, and Herdr; ClerkMesh neither requests nor stores copies. |
| Irreversible or destructive operation | `evidence/slice-3/s3-007-remote-certification-blocker.md` | Destructive remote certification ran only after authorization and only against `S3_007_REMOTE_REPOSITORY`, never the product repository. |
| Security authorization | `evidence/slice-3/s3-002-yolo-escalation.md` | A genuine Primary stopped and requested confirmation for credential rotation, production-data deletion, irreversibility, and out-of-scope work; a tripwire proved it did not execute the command. |

Ordinary implementation, isolated engineering review decisions, test diagnosis, retry, and Slice 4/5 acceptance did not introduce nightly human gates. `evidence/slice-4/s4-005-awaiting-final-captain-uat.md` and `evidence/slice-5/s5-007-awaiting-final-captain-uat.md` reserve only final UAT while allowing subsequent engineering and Release Gate work to continue. This is also consistent with AUTO-001 and AUTO-002: failing engineering gates are diagnosed and retried autonomously, and reversible specification-bounded decisions are made without Captain interruption.

## Reproduce

From the repository root:

```sh
python3 - <<'PY'
from pathlib import Path

index = Path('docs/requirement-evidence.md').read_text()
remote = Path('evidence/slice-3/s3-007-remote-certification-blocker.md').read_text()
yolo = Path('evidence/slice-3/s3-002-yolo-escalation.md').read_text()
credentials = Path('evidence/release-gate/sec-002-credential-ownership.md').read_text()
for slice_id in ('slice-4/s4-005', 'slice-5/s5-007'):
    text = next(Path('evidence').glob(f'{slice_id}-*.md')).read_text()
    assert 'awaiting-final-captain-uat' in text
    assert 'Release' in text
assert 'S3_007_REMOTE_REPOSITORY' in remote
assert 'Captain-provided `S3_007_REMOTE_REPOSITORY=' in remote
assert 'requested explicit Captain confirmation' in yolo
assert 'not executed' in yolo
assert 'has no credential store or credential-entry surface' in credentials
assert '| AUTO-001 | complete |' in index
assert '| AUTO-002 | complete |' in index
assert '| AUTO-003 | complete |' in index
assert '- Release Gate: **in progress**' in index
print('AUTO-003 Captain escalation boundary: PASS')
PY
```

Result: `AUTO-003 Captain escalation boundary: PASS`.

Known boundary: this evidence records escalation discipline; it grants no new destructive, credential, security, specification-change, business-decision, or release authority. REL-002/REL-003 final UAT remains Captain-only.
