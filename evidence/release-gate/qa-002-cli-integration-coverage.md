# QA-002 CLI integration coverage

Status: **complete**

The CLI integration layer uses disposable roots and real Git repositories and covers every required failure and recovery facet. Test fixtures never point repository-mutating commands at the product repository.

| Required facet | Focused integration coverage |
|---|---|
| Temporary roots and real Git | The shell fixtures create roots with `mktemp -d`; Node fixtures use `mkdtemp`. `tests/slice2-clerk-*-cli.test.sh`, `tests/slice3-project-init.test.sh`, `tests/slice3-local-landing.test.sh`, and `tests/slice4-human-report.test.sh` invoke production CLI entry points against repositories created with real `git init`, commits, branches, indexes, and worktrees. |
| Lock | `tests/gate0-lock.test.sh` covers live-owner exclusion, stale-lock recovery, corrupt ownership, and compare-before-remove behavior. `tests/slice2-clerk-lifecycle-lock.test.sh` covers Clerk lifecycle contention and stale recovery in an isolated state root. |
| Kill/restart | `tests/slice2-clerk-kill-recovery.test.sh` kills a lifecycle writer and verifies restart reconciliation. `tests/slice3-process-exit-boundaries.test.mjs` covers Primary/Web exit ownership, and `tests/slice5-learning-proposal.test.mjs` covers extraction reconciliation without inventing a decision. |
| Atomic publish | `tests/slice2-clerk-registry.test.mjs`, `tests/slice3-project-init.test.sh`, `tests/slice4-human-report.test.sh`, `tests/slice5-learning-source.test.mjs`, and `tests/slice5-learning-proposal.test.mjs` inject or exercise publication failures and verify that authoritative registry, Project, Source, report, and Proposal state is either complete or absent rather than partial. |
| Dirty tree | `tests/slice2-clerk-commit-cli.test.sh` and `tests/slice2-clerk-review-cli.test.sh` exercise reviewed Clerk changes; `tests/slice3-local-landing.test.sh` refuses dirty or changed delivery state; `tests/slice5-learning-proposal.test.mjs` validates candidate modifications and rejects post-review tree changes. |
| CAS race | `tests/slice3-local-landing.test.sh` refuses branch/base movement before landing. `tests/slice5-learning-proposal.test.mjs` advances only an exact reviewed tree when canonical HEAD still equals the pinned base and marks a raced target stale. |
| Invalid path | `tests/init.test.sh`, `tests/slice2-clerk-repository.test.mjs`, `tests/slice2-clerk-*-cli.test.sh`, `tests/slice3-project-init.test.sh`, `tests/slice4-human-report.test.sh`, and the Slice 5 Source/Proposal suites reject traversal, symlinks, aliases, escaping paths, non-files, nested repositories, or unmanaged repositories as applicable. |
| Fail-closed behavior | Each suite asserts refusal before authoritative mutation. Representative checks preserve lock owners, registry bytes, Git HEAD/tree, reports, Sources, Proposal manifests, or external symlink targets across invalid input and injected failures. |

## Reproduce coverage inventory

From the clean repository root:

```sh
python3 - <<'PY'
from pathlib import Path

facets = {
    'temporary roots and real Git': ['tests/slice2-clerk-create-cli.test.sh', 'tests/slice3-project-init.test.sh'],
    'lock': ['tests/gate0-lock.test.sh', 'tests/slice2-clerk-lifecycle-lock.test.sh'],
    'kill/restart': ['tests/slice2-clerk-kill-recovery.test.sh', 'tests/slice3-process-exit-boundaries.test.mjs'],
    'atomic publish': ['tests/slice2-clerk-registry.test.mjs', 'tests/slice5-learning-source.test.mjs'],
    'dirty tree': ['tests/slice2-clerk-commit-cli.test.sh', 'tests/slice3-local-landing.test.sh'],
    'CAS race': ['tests/slice3-local-landing.test.sh', 'tests/slice5-learning-proposal.test.mjs'],
    'invalid path': ['tests/init.test.sh', 'tests/slice2-clerk-repository.test.mjs', 'tests/slice3-project-init.test.sh'],
    'fail-closed': ['tests/gate0-lock.test.sh', 'tests/slice5-learning-proposal.test.mjs'],
}
for facet, paths in facets.items():
    for path in paths:
        assert Path(path).is_file(), (facet, path)

shell = ''.join(Path(path).read_text() for path in [
    'tests/slice2-clerk-create-cli.test.sh',
    'tests/slice3-project-init.test.sh',
    'tests/slice3-local-landing.test.sh',
])
assert 'mktemp -d' in shell
assert 'git init' in shell
package = Path('package.json').read_text()
for command in ['test:gate0-lock', 'test:slice2-clerk-repository', 'test:slice3-project-catalog', 'test:slice4-human', 'test:slice5-learning']:
    assert f'"{command}"' in package, command
print('QA-002 coverage inventory: PASS')
PY
```

This coverage inventory does not claim the Release Gate clean-root aggregate run; that remains Release Gate item 3.
