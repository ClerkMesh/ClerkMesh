# SEC-002 credential ownership evidence

Status: **complete**

ClerkMesh has no credential store or credential-entry surface. Authentication remains owned by the external runtime that consumes it:

- Pi and its configured provider own model/provider credentials.
- Git/SSH own repository transport credentials.
- Forge CLIs own forge credentials and authentication state.
- Herdr owns its runtime/session access.

ClerkMesh selects commands and passes ordinary process context to those tools; it does not ask the Captain for secrets, translate secrets into ClerkMesh state, or publish an authentication API or Web form. The production Web mutation surface is conversation text and a local write lease, explicitly not authentication or identity. Remote readiness is checked only when a remote delivery mode requires it, using the owning Git/forge tools; local-only startup and delivery require no forge account.

## Reproduction

From the clean repository root:

```sh
corepack pnpm run test:gate0-no-forge
corepack pnpm run test:slice1-schema
corepack pnpm run test:slice3-project-catalog
rg -n -i 'password|api[_ -]?key|access[_ -]?token|client[_ -]?secret|credential' \
  packages/*/src packages/*/bin bin --glob '!**/dist/**'
```

Expected results:

1. Gate 0 proves ordinary startup and local-only work do not probe a forge or require forge authentication, while remote preflight delegates readiness to the mode-specific external tool.
2. Slice 1 proves the local browser token is only a process-local write lease and that the Web boundary has no authentication or credential-entry semantics.
3. Slice 3 proves Git/SSH and forge CLI preflights remain external-tool boundaries and that no credential material is added to Project, Task, brief, or delivery authority.
4. The static inventory contains policy, redaction, and external-tool diagnostic references only; it exposes no secret input, credential persistence, token exchange, or ClerkMesh authentication facility.

Genuine remote evidence in `evidence/slice-3/s3-007-remote-certification-blocker.md` used only the Captain-authorized isolated fixture and the pre-authenticated owning tools. Genuine Pi and Herdr evidence likewise uses their existing runtime configuration rather than copying credentials into ClerkMesh.
