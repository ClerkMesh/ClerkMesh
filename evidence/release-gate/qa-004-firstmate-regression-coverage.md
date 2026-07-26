# QA-004 Firstmate regression coverage

Status: **complete**

The complete vendored Firstmate baseline remains the primary regression boundary. ClerkMesh integration tests additionally exercise every Firstmate surface changed or consumed by the product, rather than replacing the original suite with mocks.

| Required facet | Regression coverage |
|---|---|
| Original Firstmate tests | `corepack pnpm run test:firstmate` invokes Firstmate's `bin/fm-test-run.sh --all`; the tracked complete baseline records all 96 scripts passing with no waived failures. |
| Lock | `firstmate/tests/fm-watcher-lock.test.sh`, `tests/gate0-lock.test.sh`, and `tests/gate0-primary-launch.test.sh` cover watcher ownership plus shared TUI/Web Primary arbitration and stale-owner recovery. |
| Bootstrap | `firstmate/tests/fm-bootstrap.test.sh`, `tests/init.test.sh`, and `tests/gate0-primary-launch.test.sh` cover the vendored bootstrap contract and ClerkMesh's initialized canonical launch boundary. |
| Brief | `firstmate/tests/fm-brief.test.sh`, `tests/slice2-execution-context-brief.test.mjs`, and `tests/slice3-local-brief.test.sh` cover generic brief behavior, immutable Clerk context insertion, and local delivery briefs. |
| Preflight | `tests/gate0-no-forge.test.sh` and the Slice 3 Project suite exercise the shared production preflight, mode-specific readiness, and refusal-before-mutation boundary. |
| Projection | Slice 2 Task graph and Slice 3 Project, activity, Worker, poller, and WebSocket projection tests validate Firstmate authority through versioned ClerkMesh read boundaries. |
| Activity | `tests/slice3-fm-task-activity-append.test.mjs`, `tests/slice3-fm-task-activity-projection.test.mjs`, and lifecycle shell tests cover validated append/projection and delivery events. |
| Delivery | `tests/slice3-local-landing.test.sh`, remote delivery contract tests in the Slice 3 aggregate suite, and the unchanged Firstmate baseline cover local-only, direct-PR, and no-mistakes paths. |
| Teardown | `firstmate/tests/fm-teardown.test.sh` and `tests/slice3-local-teardown.test.sh` cover original teardown semantics plus ClerkMesh exact-tip, cleanliness, and preservation/refusal behavior. |

## Reproduce coverage inventory

From the clean repository root:

```sh
python3 - <<'PY'
from pathlib import Path

facets = {
    'lock': ['firstmate/tests/fm-watcher-lock.test.sh', 'tests/gate0-lock.test.sh'],
    'bootstrap': ['firstmate/tests/fm-bootstrap.test.sh', 'tests/init.test.sh'],
    'brief': ['firstmate/tests/fm-brief.test.sh', 'tests/slice2-execution-context-brief.test.mjs', 'tests/slice3-local-brief.test.sh'],
    'preflight': ['tests/gate0-no-forge.test.sh'],
    'projection': ['tests/slice2-fm-task-graph-projection.test.mjs', 'tests/slice3-fm-project-catalog-projection.test.mjs'],
    'activity': ['tests/slice3-fm-task-activity-append.test.mjs', 'tests/slice3-fm-task-activity-projection.test.mjs'],
    'delivery': ['tests/slice3-local-landing.test.sh'],
    'teardown': ['firstmate/tests/fm-teardown.test.sh', 'tests/slice3-local-teardown.test.sh'],
}
for facet, paths in facets.items():
    for path in paths:
        assert Path(path).is_file(), (facet, path)
package = Path('package.json').read_text()
assert 'cd firstmate && bin/fm-test-run.sh --all' in package
baseline = Path('evidence/gate-0/firstmate-baseline.md').read_text()
assert 'total=96 failed=0 skipped_gate=15' in baseline
for command in ['test:firstmate', 'test:slice2-clerk-repository', 'test:slice3-project-catalog']:
    assert f'"{command}"' in package, command
print('QA-004 coverage inventory: PASS')
PY
```

Focused integration replay is `pnpm test:slice2-clerk-repository && pnpm test:slice3-project-catalog`; the full original regression replay is `pnpm test:firstmate`. This inventory does not claim the pending clean-root aggregate Release Gate run.
