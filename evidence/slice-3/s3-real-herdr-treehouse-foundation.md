# Slice 3 real Herdr + Treehouse foundation

Date: 2026-08-02

This focused genuine-runtime run establishes the real worktree/session foundation for S3-001 and CERT-003. It does not yet claim either condition complete.

## Reproduce

```sh
mkdir -p cache/bin
bash firstmate/bin/fm-install-treehouse.sh cache/bin
PATH="$PWD/cache/bin:$PATH" \
  bash firstmate/tests/fm-backend-herdr-workspace-per-home-e2e.test.sh
```

The installer downloads the pinned official Treehouse v2.0.1 arm64 archive, verifies its tracked SHA-256, and installs it only into ignored disposable `cache/bin`.

## Genuine run

Environment:

- macOS arm64
- Herdr 0.7.4
- Treehouse v2.0.1
- real Git repositories and linked worktrees
- isolated Herdr session and disposable Firstmate homes

Result: pass. The real `fm-spawn.sh` path acquired isolated Treehouse worktrees and created Herdr panes for a Primary-owned Worker, a secondmate, and a secondmate-owned Worker. Runtime discovery remained home-scoped. The production `fm-herdr-agents.v1` command projected the genuine live endpoints without private endpoint or terminal fields, and adding the second endpoint changed the observation-independent semantic projection hash. Real `fm-teardown.sh` closed only each selected Worker pane, returned its Treehouse worktree, and preserved the neighboring secondmate process.

The fixture now satisfies production's registered, managed, local-only Project preflight rather than bypassing it. Cleanup is idempotent so an early refusal cannot perform a second unverified destructive Herdr cleanup.

## Remaining boundary

This run uses harmless raw shell launch commands. S3-001's genuine Pi Worker lifecycle is recorded separately. CERT-003 still requires status, wake, follow-up, completion, and exit-recovery evidence. S3-004 still requires a genuine timed Web polling run; this artifact now covers its real Herdr/Treehouse projection and semantic-change boundary.
