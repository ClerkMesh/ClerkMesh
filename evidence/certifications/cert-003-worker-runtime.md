# CERT-003 genuine Worker runtime certification

Status: **COMPLETE**

CERT-003 requires genuine Herdr + Treehouse Worker evidence for spawn, status, wake, follow-up, completion, and exit recovery. The following tracked, isolated certifications cover every facet.

| Facet | Reproduction | Tracked evidence |
|---|---|---|
| spawn | `PATH="$PWD/cache/bin:$PATH" S3_001_LIVE=1 corepack pnpm run cert:slice3-local-delivery` | `evidence/slice-3/s3-001-local-delivery.md` |
| status | `corepack pnpm run cert:slice3-web-polling` | `evidence/slice-3/s3-004-real-web-polling.md` |
| durable wake | `PATH="$PWD/cache/bin:$PATH" CERT_003_LIVE=1 corepack pnpm run cert:worker-wake` | A genuine Pi Worker invokes `fm-task-status.sh` with `needs-decision`; the production watcher discovers that status, appends its status key to `.wake-queue`, and `fm-wake-drain.sh` returns the exact Worker summary and consumes the queue. The fixture uses a temporary Firstmate home and dedicated Herdr lab session and fails if any stage is absent. |
| follow-up | `S2_005_LIVE=1 corepack pnpm run cert:slice2-worker-continuity` | `evidence/slice-2/s2-005-worker-continuity.md` |
| completion | `PATH="$PWD/cache/bin:$PATH" S3_001_LIVE=1 corepack pnpm run cert:slice3-local-delivery` | `evidence/slice-3/s3-001-local-delivery.md` |
| exit recovery | `corepack pnpm run cert:slice3-exit-recovery` | `evidence/slice-3/s3-005-exit-recovery.md` |

The status proof is the production path-free `fm-herdr-agents.v1` projection observed through the guarded WebSocket poller, not a caller-supplied status. The exit proof closes and recreates the Web application while genuine external Herdr Workers remain alive, then recovers the same endpoint facts without inventing completion or launching a Primary.

## Certification result

The genuine wake fixture passed on 2026-07-24. It used an isolated temporary Project repository (never the product repository), genuine Pi 0.82.0, Herdr, and Treehouse. The Worker-created authoritative status was exactly `needs-decision: Captain must choose the certified option`; the fixture verified durable queue presence before draining and an empty queue afterward. CERT-003 is complete; CERT-004 is the next certification in strict order.
