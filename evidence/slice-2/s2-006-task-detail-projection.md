# S2-006 — Clerk catalog and transient Task-detail projection

Date: 2026-08-01

## Reproduce

```sh
corepack pnpm run cert:slice2-task-detail
```

## Passing evidence

The focused certification passed against the integrated root. It verifies:

- `clerk-catalog.v1` is projected from the canonical registry and approved Git commits, remains path-free, and is runtime validated at HTTP;
- Firstmate's `fm-task-graph.v1` projection is schema-valid and contains no Clerk ownership, private metadata paths, endpoint details, or terminal text;
- `/api/work/tasks/:taskId` composes by Task ID from that graph and the integrity-checked current standard brief;
- the disclosed `execution_clerk` is nullable, immutable-commit identified, and explicitly described only as the current or most recent execution selection;
- missing, malformed, mismatched, and symlinked briefs fail closed without path disclosure; and
- Firstmate production control-plane sources contain no Clerk ownership or assignment field.

Final output:

```text
ok - S2-006 path-free Clerk catalog and transient Task-detail projection passed
```

This evidence does not claim Task ownership for a Clerk and does not write Clerk data into Firstmate `.meta`.
