# COMP-003 — V1 schema compatibility

Status: **complete**

## Contract

All published V1 Web models remain under their existing `*.v1` schema identifiers. A breaking shape change requires a new versioned schema and generated type; the V1 file and identifier must remain available. The production `GET /api/capabilities` response is itself runtime-validated as `clerkmesh.api-capabilities.v1` and lists every model version a caller may select, so a future version can be advertised alongside V1 rather than silently replacing it.

## Reproduction

```sh
node tests/api-capabilities.test.mjs
corepack pnpm --filter @clerkmesh/shared check:generated
git diff --check
```

The focused check validates the production route, response schema identifier, unique supported-model list, and representative Conversation, Work, and Learning versions. Generated-type checking keeps the capability contract and all advertised model schemas reproducible.

## Release rule

Review must reject destructive edits to a published V1 schema. Additive or replacement contracts that are not V1-compatible must use a new version identifier, generated type, runtime validator, and an additional capability entry; they must not remove the V1 entry while V1 remains supported.
