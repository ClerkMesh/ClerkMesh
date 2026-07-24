# Requirement evidence index

A requirement is marked complete only when the linked commands and artifacts are reproducible. Stage status remains incomplete until every exit condition for that stage passes.

| Requirement | Status | Automated check | Runtime evidence |
|---|---|---|---|
| PLAT-003 | partial | — | `evidence/gate-0/provenance.md` freezes Firstmate; dependency certification remains |
| BASE-002 | partial | — | Vendored `firstmate/` layout exists; remaining monorepo layout remains |
| BASE-003 | complete | `find firstmate -name .git -o -name .gitmodules` produces no output | `evidence/gate-0/provenance.md` |
| BASE-004 | complete | Firstmate and root `.gitignore` ignore operational directories; launcher fixes `FM_HOME` and `FM_ROOT_OVERRIDE` to canonical `firstmate/` | `evidence/gate-0/init.md` |
| PATH-001 | partial | `bin/clerkmesh` canonicalizes the root and exports all required absolute paths | External-input containment checks remain |
| PATH-002 | complete | Launcher resolves product paths from its canonical location, independent of caller cwd | `evidence/gate-0/init.md` |
| INIT-001 | complete | Provenance verification commands in evidence | `firstmate.provenance.json`, `firstmate/LICENSE`, `evidence/gate-0/provenance.md` |
| INIT-002 | complete | Provenance source commit differs from and supersedes research SHA | `evidence/gate-0/provenance.md` |
| INIT-003 | partial | `tests/init.test.sh` covers explicit/repeated init, core directories, registry, and built-in Escalation Clerk | Full dependency and layout validation remain |
| INIT-005 | partial | `tests/init.test.sh` proves unmarked non-empty state is refused before product writes | Conflict cases and current-version repair coverage remain |
| G0-001 | partial | `tests/init.test.sh` passes clean init, repeated init, and one unknown-state refusal case | Broader unknown/conflict matrix remains |
| G0-002 | partial | Nested Git and ignore checks in evidence pass | Full Gate 0 completion awaits root tracking verification after orchestrator commit |

## Stage status

- Gate 0: **incomplete**
- Slice 1–5: **not started**
- Release Gate: **not started**
