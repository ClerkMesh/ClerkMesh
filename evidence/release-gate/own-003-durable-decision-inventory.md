# OWN-003 durable Captain-decision inventory

Requirement: every durable V1 decision records the fixed provenance object
`{"actor":{"type":"captain","id":"local"}}` without creating account or permission semantics.

## Reproduce the inventory

```sh
rg -n 'captain/local|"captain","id":"local"|captain-approved|decision =|clerkmesh-provenance' \
  packages firstmate/bin evidence/slice-{3,4,5}
corepack pnpm run test:slice3-project-catalog
corepack pnpm run test:slice4-human
corepack pnpm run test:slice5-learning
```

## Persisted decision boundaries

| Boundary | Durable authority | Actor result | Evidence |
|---|---|---|---|
| Human Clerk result acceptance, rejection, or incompleteness | Firstmate Task `report.md` | Complete: report contains `{"actor":{"type":"captain","id":"local"}}` | `packages/clerk-cli/bin/clerk-human-report.sh`; `evidence/slice-4/s4-001-human-execution.md` |
| Learning target approval | Learning Proposal target decision | Complete: decision object contains `actor:{type:"captain",id:"local"}` | `packages/learning-core/src/learning-proposal-store.mjs`; `evidence/slice-5/s5-006-test-captain-decisions.md` |
| Learning target rejection | Learning Proposal target decision | Complete: decision object contains the same fixed actor | same as approval |
| Explicit local-only delivery approval (`yolo=off`) | Firstmate Task delivery/activity authority plus landed Git commit | Complete: `--captain-approved` produces a `landed` event containing `actor:{type:"captain",id:"local"}`, while `yolo=on` automated landing omits `actor` and therefore cannot falsely claim a Captain decision | `firstmate/bin/fm-merge-local.sh`; `tests/slice3-local-landing.test.sh`; `evidence/slice-3/s3-001-local-delivery.md` |

## Exclusions

The following durable mutations are not decisions about an already prepared V1
outcome: initialization, Project/Clerk registration and archive state, Project
delivery-mode configuration, Learning Source import, Task creation, dispatch,
status publication, and extraction/reconciliation lifecycle transitions. They
remain attributable to their existing authorities but are not approval,
rejection, acceptance, or refusal records.

Open decision requests/holds are also not completed Captain decisions. If a
hold is resolved through a V1 product path in future, its resolution record must
carry the same fixed actor object.

## Result

OWN-003 is complete. Every currently persisted V1 Captain decision carries the
same fixed local actor object, while automated local landing remains explicitly
non-Captain by omitting that actor. This inventory must be updated if another
durable V1 decision boundary is introduced.
