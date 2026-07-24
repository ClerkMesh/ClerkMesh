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
| CONV-002 | not started | Gate-0 uses only a fixed RPC bash operation and makes no model call | First-message lazy startup is explicitly deferred to Slice 1 |
| CONV-003 | partial | The fixed Web seam is single-start and never auto-restarts Pi | Product session-selection/offline behavior remains Slice 1 |
| CONV-011 | partial | Real competition proves the Web seam leaves lock authority to Firstmate and the loser reports read-only | Full Conversation Bridge remains Slice 1 |
| CERT-001 | complete | Opt-in real runner uses Pi 0.82.0, real tmux/TUI, and real Pi RPC through the ClerkMesh Web process path | `evidence/gate-0/artifacts/g0-003-real-web-tui.txt` |

## Stage status

- Gate 0: **complete**
- Slice 1–5: **not started**
- Release Gate: **not started**
