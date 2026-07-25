# S3-006 Clerk lifecycle recovery evidence

## Result

S3-006 passed at the Slice 3 boundary on 2026-07-25 using isolated temporary roots, real Git 2.54.0 operations, and a real forcibly killed Node 24.16.0 lifecycle process.

## Reproduce

```sh
corepack pnpm run cert:slice3-clerk-recovery
```

The tracked certification repeats the required lifecycle boundaries together:

- a live lifecycle-lock owner cannot be displaced, while ownership-checked release and stale-owner recovery remain fail closed;
- archive and restore publish registry transitions atomically and preserve the built-in Escalation Clerk;
- Clerk commit advances only the reviewed candidate tree with Git compare-and-swap, refusing raced HEAD and candidate-tree mismatch;
- a real archive process is stopped and killed after durable journal publication, then the next invocation recovers the requested transition, stale lock, and journal without a production test hook.

The passing terminal result was:

```text
ok - S3-006 Clerk lifecycle lock, archive/restore, CAS, and kill/restart recovery certification passed
```

All fixtures are temporary and do not touch product Clerk repositories or registry state.
