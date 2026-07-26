# REL-001 clean-root init evidence

Status: **passing Release Gate increment**

This is the first clean-root Release Gate rerun required by `IMPLEMENTATION_SPEC.md` §16. It was executed from tracked commit `26394c6ba2bdef178d0ea68578d28e854355c914` with an empty `git status --porcelain=v1` before any evidence edits.

## Reproduce

From a clean ClerkMesh root:

```sh
test -z "$(git status --porcelain=v1)"
bash -n bin/clerkmesh tests/init.test.sh
tests/init.test.sh
corepack pnpm test:gate0-primary-launch
git diff --check
```

Expected terminal results:

```text
ok - init state/conflict matrix (18 isolated cases)
ok - TUI and Web traverse one canonical Primary argv/environment owner
```

## Assertions

The init matrix exercises the public `clerkmesh init` boundary in isolated roots and proves:

- clean initialization succeeds;
- repeated initialization is byte-identical;
- unknown/unmarked content in every supported operational root is refused without mutation;
- unsupported or malformed versions, conflicting authoritative bytes, and symlinked roots fail closed;
- known current-version missing outputs are repaired without altering existing runtime bytes.

The Primary launch matrix additionally proves uninitialized TUI and Web launches explicitly refuse rather than lazily creating product state, and current-version conflicts fail closed.

This evidence satisfies Release Gate item 1 only. It does not claim the remaining clean-root checks or REL-001 complete.
