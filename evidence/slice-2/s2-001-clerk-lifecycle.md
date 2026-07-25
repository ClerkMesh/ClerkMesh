# S2-001 Clerk lifecycle evidence

## Result

S2-001 passed on 2026-07-25 in an isolated temporary root using real Git repositories and a real forcibly interrupted lifecycle process.

## Reproduce

```sh
corepack pnpm run test:slice2-clerk-repository
```

The suite proves that `create`, `validate`, and `register` produce contract-valid independent Clerk repositories; registration excludes dirty and untracked source content; approved-commit inspection excludes dirty working-tree content; names cannot be reused; and registry publication is atomic.

The final kill/restart case launches the real locked archive command against a large valid registry, observes its durable journal, sends `SIGSTOP` followed by `SIGKILL` to the real Node mutation process, and invokes the command again. The restart completes the journaled transition, clears the journal and stale process lock, and publishes the requested archived state. No production test hook is used.

## Scope

This closes S2-001. Broader S3-006 recovery certification, including restore and other process boundaries, remains required in Slice 3.
