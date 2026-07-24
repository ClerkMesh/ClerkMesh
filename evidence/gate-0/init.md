# Gate 0 init evidence

Verified on 2026-07-24 against the tracked launcher and isolated temporary product roots.

## Reproduce

```sh
bash -n bin/clerkmesh tests/init.test.sh
tests/init.test.sh
```

Expected terminal line:

```text
ok - clean init, repeated init, and unknown-state refusal
```

The integration check invokes the public `bin/clerkmesh init` seam twice, verifies the built-in Escalation Clerk is a clean independent Git repository and registry entry, and proves an unmarked non-empty data root is refused before product state is written.
The launcher canonicalizes its repository root and exports absolute ClerkMesh and Firstmate paths before invoking dependencies.

## Remaining Gate 0 work

Dependency matrix certification, stricter conflict validation, monorepo/shared schema setup, startup chains, Firstmate lock certification, local-only checks, and the upstream regression suite remain unmet.
