# Requirement evidence index

A requirement is marked complete only when the linked commands and artifacts are reproducible. Stage status remains incomplete until every exit condition for that stage passes.

| Requirement | Status | Automated check | Runtime evidence |
|---|---|---|---|
| PLAT-003 | partial | Pi 0.82.0 passes Firstmate's real tmux-backed Calm E2Es and complete baseline | `evidence/gate-0/provenance.md` freezes Firstmate; Node, pnpm, Git, Herdr, and Treehouse certification remains |
| BASE-001 | complete | `tests/gate0-layout.test.sh` asks pnpm to discover the plain workspace package set | `evidence/gate-0/workspace.md` |
| BASE-002 | partial | `tests/gate0-layout.test.sh` verifies every required source boundary | `evidence/gate-0/workspace.md`; schema and launcher functionality within the skeleton remain |
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
| G0-003 | partial | `tests/gate0-lock.test.sh` proves a live Pi holder is not overwritten; upstream `fm-session-start.test.sh` proves lock refusal suppresses mutations | `evidence/gate-0/lock-liveness.md`; real Web/TUI Pi competition remains |
| G0-005 | complete | `corepack pnpm run test:firstmate` passes all 96 upstream scripts with 0 failures and 15 declared gate skips; no failure was waived | `evidence/gate-0/firstmate-baseline.md`, focused fixture evidence, and the historical diagnostic artifact at `evidence/gate-0/artifacts/firstmate-baseline.json` |

## Stage status

- Gate 0: **incomplete**
- Slice 1–5: **not started**
- Release Gate: **not started**
