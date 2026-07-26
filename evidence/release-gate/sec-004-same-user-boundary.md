# SEC-004 — same-OS-user security boundary

Status: complete

ClerkMesh does not represent its process, filesystem, repository, candidate, worktree, or browser-lease boundaries as a confidentiality or tamper-resistant sandbox.

## Reproducible evidence

From the tracked repository root:

```sh
corepack pnpm --filter @clerkmesh/web-client build
node tests/slice1-conversation-client-semantics.test.mjs
```

The client semantics check requires both source and the production bundle to disclose that general shell tools run as the launching OS user and that ClerkMesh is not a confidentiality or tamper-resistant sandbox. The disclosure is rendered globally beneath every product workspace rather than only in an optional diagnostic view.

`SECURITY.md` defines the corresponding product-documentation boundary: same-user processes may access or modify user-accessible operational state, repositories, worktrees, environment, or data; ClerkMesh containment and review controls are mistake-reduction mechanisms, not hard isolation. It directs operators who need that boundary to an externally managed OS account, VM, or sandbox.
