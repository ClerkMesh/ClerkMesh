# CERT-003 genuine Worker runtime certification

Status: **IN PROGRESS**

CERT-003 requires genuine Herdr + Treehouse Worker evidence for spawn, status, wake, follow-up, completion, and exit recovery. The following tracked, isolated certifications already cover every facet except a genuine Worker-generated wake traversing Firstmate's wake path.

| Facet | Reproduction | Tracked evidence |
|---|---|---|
| spawn | `PATH="$PWD/cache/bin:$PATH" S3_001_LIVE=1 corepack pnpm run cert:slice3-local-delivery` | `evidence/slice-3/s3-001-local-delivery.md` |
| status | `corepack pnpm run cert:slice3-web-polling` | `evidence/slice-3/s3-004-real-web-polling.md` |
| follow-up | `S2_005_LIVE=1 corepack pnpm run cert:slice2-worker-continuity` | `evidence/slice-2/s2-005-worker-continuity.md` |
| completion | `PATH="$PWD/cache/bin:$PATH" S3_001_LIVE=1 corepack pnpm run cert:slice3-local-delivery` | `evidence/slice-3/s3-001-local-delivery.md` |
| exit recovery | `corepack pnpm run cert:slice3-exit-recovery` | `evidence/slice-3/s3-005-exit-recovery.md` |

The status proof is the production path-free `fm-herdr-agents.v1` projection observed through the guarded WebSocket poller, not a caller-supplied status. The exit proof closes and recreates the Web application while genuine external Herdr Workers remain alive, then recovers the same endpoint facts without inventing completion or launching a Primary.

## Earliest remaining certification gap

A new isolated genuine-runtime fixture must make a genuine Pi Worker emit a Captain-relevant status through the production Firstmate status command and prove that the resulting wake is durably observable/drainable. Automated wake tests alone are not sufficient for this real-runtime requirement. CERT-003 must remain incomplete until that evidence is tracked; evidence from the product repository or a simulated Worker must not be substituted.
