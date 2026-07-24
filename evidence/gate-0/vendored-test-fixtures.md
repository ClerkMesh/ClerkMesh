# Gate 0 vendored Firstmate test fixtures

Gate status: **partial** (repairs two G0-005 baseline failures).

Directly tracked `firstmate/` intentionally has no nested `.git` (BASE-003). Clone-oriented upstream tests now materialize the exact vendored tree as a temporary independent Git repository instead of asking Git to clone the enclosing ClerkMesh repository.

## Reproduce

From the clean repository root:

```sh
bash firstmate/tests/fm-secondmate-lifecycle-e2e.test.sh
bash firstmate/tests/fm-secondmate-safety.test.sh
```

Both scripts pass. The lifecycle script reports one existing conditional `tasks-axi` gate skip when that optional command is unavailable; this was present in the upstream test and is unrelated to fixture materialization. No product runtime directories or nested repository are created in the source tree.

This resolves the two recorded clone-assumption failures. G0-005 remains incomplete until the remaining baseline failures are repaired and the complete 96-script suite is rerun.
