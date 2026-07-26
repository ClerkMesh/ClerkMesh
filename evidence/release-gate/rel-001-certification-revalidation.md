# REL-001 Release Gate item 4 — genuine certification revalidation

Status: **passed**

Release Gate item 4 requires fresh revalidation of CERT-001 through CERT-006 from the repository root. A prior certification artifact is not by itself treated as this Release Gate rerun.

| Certification | Release Gate rerun | Command | Tracked result |
|---|---|---|---|
| CERT-001 | pass (2026-07-26) | `G0_003_LIVE=1 corepack pnpm run cert:gate0-primary-lock` | `evidence/gate-0/artifacts/g0-003-real-web-tui.txt` |
| CERT-002 | pass (2026-07-26) | `S1_003_LIVE=1 corepack pnpm run cert:slice1-stream-extension-ui` | `evidence/slice-1/s1-003-pi-stream-extension-ui.md` |
| CERT-003 | pass (2026-07-26) | `PATH="$PWD/cache/bin:$PATH" CERT_003_LIVE=1 corepack pnpm run cert:worker-wake` | `evidence/certifications/cert-003-worker-runtime.md` |
| CERT-004 | pass (2026-07-26) | `PATH="$PWD/cache/bin:$PATH" S3_001_LIVE=1 corepack pnpm run cert:slice3-local-delivery` | `evidence/slice-3/s3-001-local-delivery.md` |
| CERT-005 | pass (2026-07-26) | `S5_005_LIVE=1 corepack pnpm cert:slice5-restart-reconciliation` | `evidence/slice-5/s5-005-restart-reconciliation.md` |
| CERT-006 | pass (2026-07-26) | `S3_007_LIVE=1 corepack pnpm run cert:slice3-direct-pr` then `S3_007_LIVE=1 corepack pnpm run cert:slice3-no-mistakes` | `evidence/slice-3/artifacts/s3-007-real-direct-pr.txt`; `evidence/slice-3/artifacts/s3-007-real-no-mistakes.txt` |

## CERT-001 observed result

The opt-in production fixture passed both real launch orders on the certified arm64 macOS toolchain: Web acquired the Firstmate Primary lock while TUI remained read-only, then TUI acquired it while Web remained read-only. In both cases the losing Primary left the lock, wake queue, and operational manifest unchanged; the winner reacquired writable authority and remained live until controlled shutdown. The fixture reported removal of both private tmux servers, both Web processes, all four real Pi 0.82.0 processes, and its disposable repositories.

The tracked artifact records source commit and exact Pi, Node, pnpm, Git, tmux, Herdr, OS, and architecture versions. The two loser-output artifacts preserve the expected lock-holder diagnostics.

## CERT-002 observed result

The production fixture started a genuine Pi 0.82.0 RPC Primary with the canonical ClerkMesh extension, discovered and invoked `/clerkmesh-status`, and observed its real extension UI. A subsequent configured-provider run emitted visible stream fragments, executed Bash, produced a durable assistant response, and reached a new `agent_settled` state. Opt-in diagnostics retained the tool lifecycle while the ordinary projection excluded it; the planted environment secret, Authorization value, and real `HOME` were absent and the Bearer redaction marker was present. Controlled application shutdown terminated the owned Pi process and removed the disposable session fixture.

The fixture now synchronizes on protocol facts rather than exact model wording: it requires a new assistant message and a new settled event after the prompt, plus genuine tool diagnostics. This avoids treating provider phrasing variability as a certification failure while retaining all CERT-002 assertions.

## CERT-003 observed result

The isolated genuine-runtime fixture spawned a real Pi 0.82.0 Worker through Firstmate into a dedicated, test-root-bound Herdr workspace. The Worker invoked the production Task status command with the exact Captain-relevant `needs-decision` summary. Firstmate's production watcher discovered the status, durably queued its status key, and the production wake drain returned the exact Worker-authored summary and consumed the queue. Controlled cleanup removed the Worker worktree, dedicated Herdr session, and disposable Firstmate and Project authority.

## CERT-004 observed result

The isolated production fixture initialized a disposable local-only Project, spawned a genuine Pi 0.82.0 Worker through Herdr into a Treehouse worktree, and ran the Project-owned validation command with real Git. Firstmate disclosed the authoritative full diff, refused yolo-off landing before explicit fixture-Captain approval, fast-forwarded `main` to the exact reviewed commit after approval, proved the result landed, and removed volatile Task and worktree state. The run used no remote or forge credentials and cleaned up its dedicated Herdr session and temporary authority.

Observed terminal result:

```text
ok - S3-001 genuine Pi/Herdr/Treehouse local-only delivery passed (f7cb055937c997af6ab2f6e83275b6cd90d78ed6 -> 3fe5ac365b8f1b3bb3043ae9b5873e8ac0838bd4)
```

Both commit identities belong only to the disposable certification repository.

## CERT-005 observed result

The genuine Learning fixture launched two real Pi extraction Agents through production Herdr endpoints, synchronized on their durable endpoint records, and then killed the separate launch-owner process with `SIGKILL`. Both Agents subsequently published successful application-owned completion markers. A fresh production reconciliation process recovered both independently as `review-ready` from persisted Proposal, Source, endpoint, and candidate authority without relaunching an Agent or inventing a Captain decision. Controlled cleanup removed the dedicated workspace and all disposable Clerk repositories, candidates, Sources, and Learning state.

Observed Proposal `046080c4a7d8e94d7fd1144aa3936b9b18b353c489ad8f99e453200751507e0a` and Source `e7dc9507d8f164dd82576ec4900f74100dc2ba8e34ee2986860e78d17909aafc` existed only in the disposable certification fixture.

## CERT-006 observed result

Using only the Captain-authorized private `ClerkMesh/clerkmesh-cert-fixture` repository, the guarded production fixtures created, completely diff-reviewed, and squash-merged direct-PR PR #3 and no-mistakes PR #4. The direct-PR head was `1f0e2c7f2fb1795660530b023dea1fa6bf4fc5a4`. The genuine no-mistakes v1.41.2 pipeline completed intent, rebase, review, test, document, lint, push, PR, and CI gates with no findings; its reviewed head `1664829f1f80dd8db804d96d3f532e9e2078324d` retained the certified input commit. Both branch-specific PRs reached `MERGED`, and no product repository was used.

## Boundary

All six genuine certifications have now been freshly revalidated, completing Release Gate item 4. This does not by itself complete REL-001 or the Release Candidate, and it does not alter the `awaiting-final-captain-uat` status of Slice 4 or Slice 5.
