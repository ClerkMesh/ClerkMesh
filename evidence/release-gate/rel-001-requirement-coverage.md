# Release Gate item 2 — complete requirement coverage

Status: **complete**

Every implementation requirement that precedes the Release Gate has a dedicated `complete` row in `docs/requirement-evidence.md`. Each row names an automated check and runtime or tracked evidence; none is waived or marked skipped. The four `REL-*` requirements are release transitions rather than prerequisite implementation coverage: REL-001 remains pending the rest of the clean-root gate, and REL-002/REL-003 remain Captain-only.

This inventory covers 119 requirements across PLAN, AUTO, QA, PLAT, BASE, PATH, OWN, INIT, Gate 0, COMP, conversation, read-model, UI, security, Clerk, execution, Project, process, Human, Learning, and Slice exit requirements. Focused and genuine checks linked by those rows establish traceability; executing the aggregate suites again from a clean root remains Release Gate item 3 and is not inferred from this inventory.

## Reproduce

From the repository root:

```sh
python3 - <<'PY'
import re
from pathlib import Path

spec = Path('IMPLEMENTATION_SPEC.md').read_text()
index = Path('docs/requirement-evidence.md').read_text()

# SHA-256 is an algorithm name, and REL-* entries are release transitions.
spec_ids = {
    value for value in re.findall(r'\b[A-Z]+-\d{3}\b', spec)
    if value != 'SHA-256' and not value.startswith('REL-')
}
rows = []
for line in index.splitlines():
    if re.match(r'^\| [A-Z]+-\d{3} \|', line):
        cells = line[2:-2].split(' | ')
        assert len(cells) == 4, (cells[0], 'malformed evidence row')
        rows.append(cells)
row_ids = {requirement for requirement, *_ in rows}

assert len(spec_ids) == 119, len(spec_ids)
assert row_ids == spec_ids, (
    f'missing={sorted(spec_ids - row_ids)} extra={sorted(row_ids - spec_ids)}'
)
assert len(rows) == len(row_ids), 'duplicate requirement rows'
for requirement, status, automated, runtime in rows:
    assert status.strip() == 'complete', (requirement, status)
    assert automated.strip(), f'{requirement}: missing automated check'
    assert runtime.strip(), f'{requirement}: missing runtime/tracked evidence'
assert not re.search(r'^\| [A-Z]+-\d{3} \| (?:partial|skipped|in progress) \|', index, re.MULTILINE)
print('Release Gate requirement coverage: PASS (119/119 complete)')
PY
```

Result: `Release Gate requirement coverage: PASS (119/119 complete)`.

Known boundary: this is the exhaustive requirement-to-test/evidence traceability gate, not a substitute for the pending clean-root aggregate execution, production build, smoke test, or final Captain UAT.
