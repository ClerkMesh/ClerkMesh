# REL-001 process-exit and crash-recovery revalidation

Release Gate item 5 requires fresh clean-root evidence for the independent Web,
Primary, Worker, and Learning Agent exit boundaries plus durable crash recovery.
A prior Slice or certification pass is not, by itself, this revalidation.

## Current fresh results

| Boundary | Status | Evidence |
|---|---|---|
| Web exit/restart | passed | `corepack pnpm run cert:slice3-exit-recovery` closed and recreated the production Web composition; the restarted process recovered the exact same semantic Worker projection hash and endpoint count without creating a Primary. |
| Worker independence across Web exit | passed | The same genuine Herdr/Treehouse run retained two live endpoint facts across Web shutdown and restart; `evidence/slice-3/artifacts/s3-005-real-exit-recovery.json`. |
| Primary exit/offline and owned-child cleanup | pending fresh item-5 run | Re-run the genuine S1-006 shutdown/offline fixture. |
| Learning Agent owner exit and reconciliation | passed | The fresh CERT-005 Release Gate run SIGKILLed the extraction launch owner, retained both genuine Agents, and reconciled both targets from durable authority; `evidence/release-gate/rel-001-certification-revalidation.md`. |
| Durable Clerk lifecycle crash recovery | pending fresh item-5 run | Re-run the isolated real-SIGKILL S3-006 lifecycle fixture. |

The genuine Web/Worker revalidation ran in a disposable canonical test root and
used root-hash-bound Herdr workspace names. No product repository, default fleet,
or remote repository was used.

## Reproduction

```sh
S3_005_EVIDENCE_DIR="$PWD/evidence/slice-3/artifacts/s3-005-run" \
  corepack pnpm run cert:slice3-exit-recovery
```

The run must report genuine Worker survival and recovery, then produce a result
whose before/after hashes and endpoint counts are equal and whose
`webOwnedPrimaryStarted` value is `false`.
