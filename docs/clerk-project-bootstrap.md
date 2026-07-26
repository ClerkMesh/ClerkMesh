# Clerk and Project bootstrap

ClerkMesh can establish its execution environment before any specialist Agent Clerk exists.

## Clerk bootstrap

Ask Primary to create a Clerk and describe its purpose, capabilities, and boundaries. Primary drafts and validates the exact Clerk source, reports its SHA-256 inventory, and waits for explicit Captain approval. Approval applies only to those exact bytes. After approval, Primary invokes the canonical Clerk lifecycle command, which creates an independent Git repository, records the approved commit, and atomically adds the active Clerk to the registry.

Bootstrap does not select Escalation, create a Task or Brief, or start a Worker. It creates an execution identity only. Research, implementation, and other professional work requested from the new Clerk must subsequently use the ordinary Task → selection → Brief → Worker lifecycle.

Executable skill scripts require separate explicit review and approval. Primary never edits the registry or published Clerk repository directly.

## Local Project bootstrap

Primary may use Firstmate's guarded Project initialization command after confirming the local target and description. This does not require a Clerk or bootstrap Task. Existing or ambiguous targets are refused. Remote repository creation, credentials, destructive repair, and Project content changes remain outside bootstrap and retain their normal authorization and Clerk execution boundaries.

## Runtime tools

ClerkMesh launches Primary with the product's frozen `node_modules/.bin` first on `PATH`. `tasks-axi` is a product runtime dependency; users should not install it globally. If runtime dependencies are unavailable, reinstall them from the product root with:

```sh
corepack pnpm install --frozen-lockfile
```
