# Gate 0 init evidence

Verified on 2026-07-24 against the tracked launcher and isolated temporary product roots.

## Reproduce

```sh
bash -n bin/clerkmesh tests/init.test.sh
tests/init.test.sh
shellcheck bin/clerkmesh tests/init.test.sh
corepack pnpm run test:gate0-layout
```

Expected init-matrix terminal line:

```text
ok - init state/conflict matrix (18 isolated cases)
```

The integration check invokes the public `bin/clerkmesh init` seam. It proves clean init and a byte-identical repeated init; refuses unmarked content in each of the seven supported operational roots; and refuses unsupported or malformed markers, conflicting registry or Escalation Clerk bytes, and symlinked state roots. Every refusal compares a complete path-and-file-content snapshot before and after init, including the modified Clerk Git repository case.

Current-version fixtures prove that init can restore a missing registry, a missing built-in Escalation Clerk, and all missing init-owned output from a marker-only state while preserving existing runtime bytes. Validation of all known conflicts occurs before product directory or repair writes.

## Remaining Gate 0 work

Dependency matrix certification, monorepo/shared schema setup, startup chains, Firstmate lock certification, local-only checks, and the upstream regression suite remain unmet.
