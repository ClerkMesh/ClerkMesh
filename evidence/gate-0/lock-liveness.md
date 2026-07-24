# Gate 0 — Firstmate Pi holder liveness

Requirements: G0-003, COMP-002 (partial; deterministic lock contract only)

## Reproduction

From the clean repository root:

```sh
bash tests/gate0-lock.test.sh
bash firstmate/tests/fm-session-start.test.sh
```

Observed result:

```text
ok - Firstmate lock refuses a live Pi holder and reclaims only a dead holder
ok - a lock refusal prints a loud read-only banner, skips every mutating step, and still completes the digest
# ... all remaining fm-session-start tests pass
```

The focused check uses a real live PID with deterministic `ps` output identifying it as Pi. It proves `fm-lock.sh` refuses acquisition without changing `.lock`, then proves a dead holder can be replaced. The upstream session-start suite proves refusal leaves the second session read-only and suppresses its mutating startup steps.

## Repair

The vendored `holder_alive` implementation previously tested the concatenated string `"pi pi --mode rpc"` against the anchored expression `^pi$`. A live executable named exactly `pi` therefore could be classified stale and overwritten. It now recognizes Pi from the executable basename before considering argv-based interpreter harnesses.

## Remaining real certification

This is not CERT-001 or full G0-003 evidence. Gate 0 still requires two real Pi Primaries entering through Web and TUI against this same home; the Web entry chain does not exist yet.
