# CERT-005 — genuine Learning continuity and restart reconciliation

Status: **complete**

CERT-005 requires genuine Learning extraction to continue across the Primary process boundary and to reconcile correctly after restart. The two independently reproducible genuine Pi/Herdr certifications below cover both facets against isolated temporary Clerk repositories and Learning state.

## Evidence matrix

| Required facet | Genuine-runtime proof |
|---|---|
| Extraction continues after the launching Primary returns | `tests/cert/s5-002-real-learning-extraction.mjs` launches two genuine Pi 0.82.0 extraction Agents through the production Herdr launcher, returns from the launch owner, then reconstructs their candidate locations from persisted Proposal authority and observes both independently finish validated Markdown output. |
| Extraction survives an abrupt Primary-owner exit | `tests/cert/s5-005-real-restart-reconciliation.mjs` synchronizes on persisted production endpoints, sends `SIGKILL` to the separate launch-owner process, and observes both genuine extraction Agents subsequently publish application-owned completion markers. |
| A restarted Primary reconciles from durable authority | After the owner is confirmed dead, the S5-005 orchestrator invokes the production reconciliation command in a separate process using only the persisted Proposal, Source, and endpoint records; both targets become independently `review-ready`. |
| Reconciliation does not invent work or decisions | The S5-005 certification verifies no Agent is relaunched and no approval or rejection is created. Focused integration coverage additionally verifies `live`, `complete`, and `interrupted` classifications and fail-closed runtime uncertainty. |
| Fixture isolation | Both genuine runners use temporary Source, Proposal, candidate, and canonical Clerk repositories, close only their dedicated Herdr workspace, and remove fixture state on exit. |

## Reproduce

Prerequisite: genuine `pi` and a running Herdr session named `default`, or select an existing session with the corresponding environment variable.

```sh
S5_002_LIVE=1 node tests/cert/s5-002-real-learning-extraction.mjs
S5_005_LIVE=1 corepack pnpm cert:slice5-restart-reconciliation
corepack pnpm test:slice5-learning
```

Tracked genuine run identities and outcomes are recorded in:

- `evidence/slice-5/s5-002-real-learning-extraction.md`
- `evidence/slice-5/s5-005-restart-reconciliation.md`

Together these prove genuine extraction continuity across both normal and abrupt Primary ownership loss, followed by production restart reconciliation without automatic restart or Captain decision. Result: **pass**.
