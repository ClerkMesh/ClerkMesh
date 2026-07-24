# Gate 0 Zellij baseline fixture repair

Requirement: **G0-005** (partial; complete baseline rerun still required).

## Reproduce

From the repository root:

```sh
cd firstmate
bash tests/fm-backend-zellij.test.sh
```

## Result

The focused suite passes all 51 assertions, including teardown of a completed scout whose worktree is already absent.

The prior failure was test-fixture drift: production teardown validates the unresolved-decision gate by probing the `tasks-axi` CLI contract, while the isolated Zellij fake-bin exposed only `zellij`. The fixture now supplies a deterministic compatible `tasks-axi` fake (version and required help surfaces), matching the existing Orca fixture and avoiding dependence on host installation. Production behavior is unchanged.

This removes the recorded Zellij failure but does not by itself satisfy G0-005; the complete 96-script baseline must be rerun after the remaining failures are repaired.
