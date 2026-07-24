# Requirement evidence index

A requirement is marked complete only when the linked commands and artifacts are reproducible. Stage status remains incomplete until every exit condition for that stage passes.

| Requirement | Status | Automated check | Runtime evidence |
|---|---|---|---|
| PLAT-003 | partial | — | `evidence/gate-0/provenance.md` freezes Firstmate; dependency certification remains |
| BASE-001 | complete | `tests/gate0-layout.test.sh` asks pnpm to discover the plain workspace package set | `evidence/gate-0/workspace.md` |
| BASE-002 | partial | `tests/gate0-layout.test.sh` verifies every required source boundary | `evidence/gate-0/workspace.md`; schema and launcher functionality within the skeleton remain |
| BASE-003 | complete | `tests/gate0-layout.test.sh` rejects nested `.git` and `.gitmodules` paths | `evidence/gate-0/provenance.md`, `evidence/gate-0/workspace.md` |
| BASE-004 | complete | Firstmate and root `.gitignore` ignore operational directories; launcher fixes `FM_HOME` and `FM_ROOT_OVERRIDE` to canonical `firstmate/` | `evidence/gate-0/init.md` |
| PATH-001 | partial | `bin/clerkmesh` canonicalizes the root and exports all required absolute paths | External-input containment checks remain |
| PATH-002 | complete | Launcher resolves product paths from its canonical location, independent of caller cwd | `evidence/gate-0/init.md` |
| INIT-001 | complete | Provenance verification commands in evidence | `firstmate.provenance.json`, `firstmate/LICENSE`, `evidence/gate-0/provenance.md` |
| INIT-002 | complete | Provenance source commit differs from and supersedes research SHA | `evidence/gate-0/provenance.md` |
| INIT-003 | partial | `tests/init.test.sh` covers explicit/repeated init, core directories, registry, and built-in Escalation Clerk | Full dependency and layout validation remain |
| INIT-005 | partial | `tests/init.test.sh` proves unmarked non-empty state is refused before product writes | Conflict cases and current-version repair coverage remain |
| G0-001 | partial | `tests/init.test.sh` passes clean init, repeated init, and one unknown-state refusal case | Broader unknown/conflict matrix remains |
| G0-002 | partial | Nested Git and ignore checks in evidence pass | Full Gate 0 completion awaits root tracking verification after orchestrator commit |
| G0-003 | partial | `tests/gate0-lock.test.sh` proves a live Pi holder is not overwritten; upstream `fm-session-start.test.sh` proves lock refusal suppresses mutations | `evidence/gate-0/lock-liveness.md`; real Web/TUI Pi competition remains |
| G0-005 | failed | `corepack pnpm run test:firstmate` executes the complete 96-script upstream suite; recorded run has 7 failures and no failures are waived | `evidence/gate-0/firstmate-baseline.md`, `evidence/gate-0/artifacts/firstmate-baseline.json` |

## Stage status

- Gate 0: **incomplete**
- Slice 1–5: **not started**
- Release Gate: **not started**
