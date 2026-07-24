# Gate 0 Orca baseline fixture repair

Gate status: **partial** (one G0-005 baseline failure repaired; the complete baseline still requires a rerun after all focused repairs).

## Reproduce

From the repository root:

```sh
cd firstmate
bash tests/fm-backend-orca.test.sh
```

## Recorded result

The focused suite passes all 51 assertions, including successful report-present scout teardown and fail-closed teardown variants.

The Orca fake-bin fixture now supplies the compatible `tasks-axi` command contract required by the production unresolved-decision completion gate (`--version`, `update --help`, `mv --help`, and `hold --help`). This keeps the test isolated from host-global tools while exercising the real decision gate. Previously the fixture omitted `tasks-axi`, so teardown refused before reaching the Orca behavior under test.
