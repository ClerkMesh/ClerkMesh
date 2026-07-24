# Requirement evidence index

A requirement is marked complete only when the linked commands and artifacts are reproducible. Stage status remains incomplete until every exit condition for that stage passes.

| Requirement | Status | Automated check | Runtime evidence |
|---|---|---|---|
| PLAT-003 | partial | — | `evidence/gate-0/provenance.md` freezes Firstmate; dependency certification remains |
| BASE-002 | partial | — | Vendored `firstmate/` layout exists; remaining monorepo layout remains |
| BASE-003 | complete | `find firstmate -name .git -o -name .gitmodules` produces no output | `evidence/gate-0/provenance.md` |
| BASE-004 | partial | Firstmate and root `.gitignore` ignore operational directories | Launcher path injection remains |
| INIT-001 | complete | Provenance verification commands in evidence | `firstmate.provenance.json`, `firstmate/LICENSE`, `evidence/gate-0/provenance.md` |
| INIT-002 | complete | Provenance source commit differs from and supersedes research SHA | `evidence/gate-0/provenance.md` |
| G0-002 | partial | Nested Git and ignore checks in evidence pass | Full Gate 0 completion awaits root tracking verification after orchestrator commit |

## Stage status

- Gate 0: **incomplete**
- Slice 1–5: **not started**
- Release Gate: **not started**
