# QA-001 unit and contract coverage

Status: **complete**

The automated layer covers every QA-001 facet with focused, deterministic checks. These checks do not substitute for the separately tracked genuine-runtime certifications.

| Required facet | Focused coverage |
|---|---|
| Schemas | `tests/slice1-conversation-schema.test.mjs`, `tests/slice2-execution-context-schema.test.mjs`, `tests/slice2-fm-task-graph-schema.test.mjs`, `tests/slice3-fm-project-catalog-schema.test.mjs`, `tests/slice3-fm-task-activity-schema.test.mjs`, and the Learning catalog schema assertions in `tests/slice5-learning-review-catalog.test.mjs`; generated interfaces are checked by `@clerkmesh/shared check:generated` |
| Reducers | `tests/slice1-pi-rpc-event-normalizer.test.mjs`, `tests/slice1-conversation-event-projection.test.mjs`, and `tests/slice1-conversation-application.test.mjs` cover normalization and deterministic conversation projection/application transitions; Slice 3 projection tests cover Project, fleet, activity, and poller reductions |
| Canonicalization | `tests/gate0-primary-launch.test.sh`, `tests/slice1-pi-session-discovery.test.mjs`, `tests/slice2-clerk-repository.test.mjs`, and `tests/slice3-project-init.test.sh` cover canonical homes, session identities, repository roots, aliases, traversal, and symlink refusal |
| Selection inputs | `tests/slice2-execution-context-compiler.test.mjs`, `tests/slice2-execution-context-continuity.test.mjs`, and `tests/slice4-human-agent-handoff.test.mjs` cover bounded candidates, exact selected Clerk identity/commit, fresh handoff selection, and fail-closed invalid input |
| Brief encoding | `tests/slice2-execution-context-encoding.test.mjs`, `tests/slice2-execution-context-brief.test.mjs`, `tests/slice3-local-brief.test.sh`, and `firstmate/tests/fm-brief.test.sh` cover deterministic context blocks, hostile content, immutable dispatch fields, and decode/validation refusal |
| Learning state transitions | `tests/slice5-learning-proposal.test.mjs` covers pending/extracting/review-ready/stale/resolved transitions, review invalidation, independent decisions, CAS approval, and terminal-state refusal |
| Recovery decisions | `tests/gate0-lock.test.sh`, `tests/slice2-clerk-kill-recovery.test.sh`, `tests/slice3-process-exit-boundaries.test.mjs`, `tests/slice4-human-lifecycle.test.mjs`, and `tests/slice5-learning-proposal.test.mjs` cover stale ownership, lifecycle recovery, process exits, Human projection recovery, and Learning reconciliation without invented decisions |

## Reproduce coverage inventory

From the clean repository root:

```sh
python3 - <<'PY'
from pathlib import Path

facets = {
    'Schemas': ['tests/slice1-conversation-schema.test.mjs', 'packages/shared/scripts/generate-types.mjs'],
    'Reducers': ['tests/slice1-pi-rpc-event-normalizer.test.mjs', 'tests/slice1-conversation-application.test.mjs'],
    'Canonicalization': ['tests/gate0-primary-launch.test.sh', 'tests/slice2-clerk-repository.test.mjs'],
    'Selection inputs': ['tests/slice2-execution-context-compiler.test.mjs', 'tests/slice4-human-agent-handoff.test.mjs'],
    'Brief encoding': ['tests/slice2-execution-context-encoding.test.mjs', 'firstmate/tests/fm-brief.test.sh'],
    'Learning state transitions': ['tests/slice5-learning-proposal.test.mjs'],
    'Recovery decisions': ['tests/gate0-lock.test.sh', 'tests/slice3-process-exit-boundaries.test.mjs', 'tests/slice5-learning-proposal.test.mjs'],
}
for facet, paths in facets.items():
    for path in paths:
        assert Path(path).is_file(), (facet, path)

package = Path('package.json').read_text()
for command in ['test:slice1-schema', 'test:slice2-clerk-repository', 'test:slice3-project-catalog', 'test:slice4-human', 'test:slice5-learning']:
    assert f'"{command}"' in package, command
print('QA-001 coverage inventory: PASS')
PY
```

The complete automated replay is the five focused Slice suites plus Gate 0 and Firstmate regression commands listed in `evidence/release-gate/plan-003-stage-evidence-completeness.md`; Release Gate item 3 will rerun them together from a clean root.
