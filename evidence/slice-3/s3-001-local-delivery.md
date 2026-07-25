# S3-001 genuine local-only delivery

Status: **PASS**

Requirements: S3-001, CERT-004, PROJ-001, PROJ-002, PROJ-005–007, EXEC-012, COMP-005

## Reproduction

```sh
PATH="$PWD/cache/bin:$PATH" S3_001_LIVE=1 corepack pnpm run cert:slice3-local-delivery
```

The isolated run passed with Pi 0.82.0, Herdr 0.7.4, Treehouse v2.0.1, and real Git. The fixture had no remote and made no `gh` or forge-auth dependency. A genuine Pi Worker invoked the Project-owned deterministic validation/delivery command in a Treehouse worktree, producing a clean commit. Firstmate then disclosed the authoritative full diff, refused yolo-off landing without Captain approval, accepted explicit approval, fast-forwarded local `main` to the exact reviewed tip, proved the result landed, and returned the worktree through Treehouse while removing volatile Task metadata.

Observed terminal result:

```text
ok - S3-001 genuine Pi/Herdr/Treehouse local-only delivery passed (0ee09f49d08cdcfa1feeb66792e110bc1e6dc665 -> dfadc92166d7bc6d761cdd76d94d9e10e2bbce03)
```

The commit IDs belong to the disposable isolated fixture. The runner deletes its temporary Firstmate home and Herdr workspace after verification. Firstmate emitted expected development-worktree and absent-watcher warnings; neither warning changed the isolated Task authority or the guarded lifecycle result.
