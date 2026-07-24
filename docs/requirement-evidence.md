# Requirement evidence index

A requirement is marked complete only when the linked commands and artifacts are reproducible. Stage status remains incomplete until every exit condition for that stage passes.

| Requirement | Status | Automated check | Runtime evidence |
|---|---|---|---|
| PLAT-003 | partial | Pi 0.82.0 passes the installed strict extension typecheck, Firstmate's real tmux-backed Calm E2Es, complete baseline, and G0-003 Web/TUI competition; the G0-003 artifact records Node v24.16.0, pnpm 11.17.0, Git 2.54.0, and Herdr 0.7.4 | `evidence/gate-0/provenance.md` freezes Firstmate; Treehouse was unavailable and its later runtime certification remains |
| BASE-001 | complete | `tests/gate0-layout.test.sh` asks pnpm to discover the plain workspace package set | `evidence/gate-0/workspace.md` |
| BASE-002 | partial | `tests/gate0-layout.test.sh` verifies every required source boundary; `tests/gate0-primary-launch.test.sh` exercises the bounded launcher/server paths | `evidence/gate-0/workspace.md`; full product schemas and later-slice package functionality remain |
| BASE-003 | complete | `tests/gate0-tracking.test.sh` verifies an ordinary root tree, direct tracking, and rejects nested Git, gitlink, subtree metadata, and patch-stack mechanisms; the layout test retains a focused worktree scan | `evidence/gate-0/provenance.md`, `evidence/gate-0/workspace.md` |
| BASE-004 | complete | `tests/gate0-tracking.test.sh` verifies operational paths are ignored and absent from root HEAD/index; launcher fixes `FM_HOME` and `FM_ROOT_OVERRIDE` to canonical `firstmate/` | `evidence/gate-0/provenance.md`, `evidence/gate-0/init.md` |
| PATH-001 | partial | `bin/clerkmesh` canonicalizes the root and exports all required absolute paths | External-input containment checks remain |
| PATH-002 | complete | Launcher resolves product paths from its canonical location, independent of caller cwd | `evidence/gate-0/init.md` |
| INIT-001 | complete | `tests/gate0-tracking.test.sh` validates the frozen repository/branch/commit/tree, import method/time, license digest, and attribution without network access | `firstmate.provenance.json`, `firstmate/LICENSE`, `evidence/gate-0/provenance.md` |
| INIT-002 | complete | Provenance source commit differs from and supersedes research SHA | `evidence/gate-0/provenance.md` |
| INIT-003 | partial | `tests/init.test.sh` covers explicit/repeated init, core directories, registry, built-in Escalation Clerk, and init-owned repair validation | Full dependency and layout validation remain |
| INIT-005 | complete | `tests/init.test.sh` covers all seven unmarked operational roots, unsupported versions, conflicting init-owned state, nonconforming path types, and current-version repairs; every refusal snapshots paths and bytes before and after | `evidence/gate-0/init.md` |
| G0-001 | complete | `tests/init.test.sh` passes clean and byte-idempotent repeated init plus the isolated 18-case unknown/conflict/repair matrix | `evidence/gate-0/init.md` |
| G0-002 | complete | `tests/gate0-tracking.test.sh` validates root tracking, nested-Git/submodule/subtree/patch-stack rejection, provenance invariants, and runtime exclusion | `evidence/gate-0/provenance.md` |
| G0-003 | complete | `tests/gate0-primary-launch.test.sh` catches TUI/Web argv, environment, cwd, and extension divergence; focused Firstmate lock/session-start regressions remain green | `G0_003_LIVE=1 bash tests/cert/g0-003-real-web-tui.sh` passed both real Pi 0.82.0 winner orders; `evidence/gate-0/lock-liveness.md`, `evidence/gate-0/artifacts/g0-003-*` |
| G0-004 | complete | `tests/gate0-no-forge.test.sh` isolates `HOME`/Git config, restricts `PATH`, uses forge executables only as failing invocation tripwires, and drives real session-start, Project preflight, local Git, and spawn-refusal paths | `evidence/gate-0/no-forge.md` |
| PROJ-003 | partial | The G0-004 test proves ordinary startup makes no forge readiness probe and dispatch preflight is mode-specific | Add/switch mode entrypoints remain Slice 3 work |
| PROJ-004 | partial | `fm-spawn.sh` calls `fm-project-preflight.sh`; G0-004 proves auth refusal occurs before worktree/endpoint/meta creation | Primary-side preflight invocation remains |
| COMP-005 | partial | G0-004 proves startup and local-only preflight need no forge account/auth while explicit remote modes fail closed | Full real local-only lifecycle remains CERT-004/Slice 3 |
| G0-005 | complete | `corepack pnpm run test:firstmate` passes all 96 upstream scripts with 0 failures and 15 declared gate skips; no failure was waived | `evidence/gate-0/firstmate-baseline.md`, focused fixture evidence, and the historical diagnostic artifact at `evidence/gate-0/artifacts/firstmate-baseline.json` |
| PROC-001 | partial | The Gate-0 Web certification server is one foreground process and has no daemon/restart behavior | `evidence/gate-0/lock-liveness.md`; the Slice 1 product server remains |
| PROC-002 | partial | Real certification proves each Web process terminates only its owned Pi child | Worker/Learning lifecycle coverage remains later-slice work |
| PROC-003 | partial | Fast contract and real certification prove Web/TUI use one canonical home and the same explicit Firstmate extensions | The eventual ClerkMesh Primary Extension remains Slice 1/2 work |
| CONV-001 | partial | `test:slice1-schema` freezes the opaque, path-free session catalog boundary and verifies server discovery uses the pinned Pi 0.82.0 `SessionManager.listAll` metadata API, canonicalizes cwd/symlink aliases, omits foreign/invalid sessions, fails closed on duplicate IDs, and serves the Ajv-validated projection over Fastify without a Primary launch dependency; `docs/slice-1-requirement-matrix.md` records coverage | A real persisted Captain history and provider-call tripwire remain for stage certification |
| CONV-002 | partial | `test:slice1-schema` proves concurrent HTTP first sends share one startup promise, resolve opaque session IDs server-side, reject path-bearing mutation input, lock selection once startup begins, and never prompt before startup succeeds | A real Pi first-message run remains |
| CONV-003 | partial | The fixed Web seam is single-start and never auto-restarts Pi; the product coordinator locks selection after startup begins | Offline behavior and process integration remain Slice 1 |
| CONV-006 | partial | `test:slice1-schema` proves process-local `(client token, requestId)` HTTP replay returns the original result without a duplicate prompt, while conflicting reuse returns 409 | Restart-boundary proof remains |
| CONV-007 | partial | `test:slice1-schema` uses fake-clock unit and real loopback WebSocket/HTTP integration to prove first-token acquisition, multiple same-token connections, a strict three-second reconnect reservation, second-token HTTP 409 refusal, explicit claim after expiry, and vacant new-connection acquisition | Browser-driven reconnect proof remains |
| CONV-008 | partial | The WebSocket lease accepts opaque local client tokens only and exposes no actor/authentication semantics; HTTP mutation uses the token solely to check writability | UI wording remains |
| CONV-009 | partial | `test:slice1-schema` proves a versioned, schema-valid process-local projection retains at most 10,000 normalized events, assigns monotonic sequence cursors, retains pending extension UI, and sends an initial runtime-validated WebSocket snapshot followed by live monotonic continuations without exposing diagnostics by default | Pi-history restart reconstruction and real refresh remain |
| CONV-010 | partial | `test:slice1-schema` proves ordinary snapshots exclude diagnostic events while explicit diagnostic snapshots include them, with defensive payload copies | RPC normalization, redaction, UI warning, and real diagnostic rendering remain |
| CONV-011 | partial | Real competition proves the Web seam leaves lock authority to Firstmate and the loser reports read-only | Full Conversation Bridge remains Slice 1 |
| READ-003 | partial | `conversation-sessions.v1` and `conversation-events.v1` have versioned JSON Schemas and reproducibly generated TypeScript types; the catalog endpoint and event projection tests perform Ajv runtime validation | Remaining v1 projections and the event HTTP/WebSocket binding remain |
| CERT-001 | complete | Opt-in real runner uses Pi 0.82.0, real tmux/TUI, and real Pi RPC through the ClerkMesh Web process path | `evidence/gate-0/artifacts/g0-003-real-web-tui.txt` |

## Stage status

- Gate 0: **complete**
- Slice 1: **in progress** (session catalog interface frozen; no exit condition complete)
- Slice 2–5: **not started**
- Release Gate: **not started**
