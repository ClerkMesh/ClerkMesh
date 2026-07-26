# S3-001 genuine local-only delivery

Status: **PASS**

Requirements: S3-001, CERT-004, PROJ-001, PROJ-002, PROJ-005–007, EXEC-012, COMP-005

## Reproduction

```sh
PATH="$PWD/cache/bin:$PATH" S3_001_LIVE=1 corepack pnpm run cert:slice3-local-delivery
```

The isolated run passed with Pi 0.82.0, Herdr 0.7.4, Treehouse v2.0.1, and real Git. The fixture used the production deterministic Project-init command and asserted its `main` branch, fixed README and baseline commit, absent remote, and registry-last publication before adding the fixture validation command. It made no `gh` or forge-auth dependency. A genuine Pi Worker invoked the Project-owned deterministic validation/delivery command in a Treehouse worktree, verified the expected result and a clean Git state, and produced the commit. Together with `tests/slice3-local-brief.test.sh`, which checks the production-generated local-only brief excludes GitHub, PR, `gh-axi`, and No Mistakes instructions while retaining validation and local landing rules, this run provides PROJ-006's genuine execution and validation evidence. Firstmate then disclosed the authoritative full diff, refused yolo-off landing without Captain approval, accepted explicit approval, fast-forwarded local `main` to the exact reviewed tip, proved the result landed, and returned the worktree through Treehouse while removing volatile Task metadata.

Observed terminal result:

```text
ok - S3-001 genuine Pi/Herdr/Treehouse local-only delivery passed (5f4e6f40d5a68707ffaca1a00a6940fa466c5b70 -> d0e49a6d8b33ef72b82f68d2fef18f4f14f94707)
```

The commit IDs belong to the disposable isolated fixture. The runner deletes its temporary Firstmate home and Herdr workspace after verification. Firstmate emitted expected development-worktree and absent-watcher warnings; neither warning changed the isolated Task authority or the guarded lifecycle result.
