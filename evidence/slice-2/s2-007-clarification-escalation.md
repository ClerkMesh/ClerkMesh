# S2-007 — clarification and explicit Escalation takeover

Date: 2026-08-01

## Reproduce

This certification uses a genuine Pi Primary and configured provider:

```sh
S2_007_LIVE=1 corepack pnpm run cert:slice2-clarification-escalation
```

## Passing evidence

The isolated three-turn certification passed against the integrated root. It proved that:

- the Primary inspected active immutable Clerk candidates for an unsafe, underspecified request;
- no Agent context was compiled and the brief remained byte-identical while the request stayed in conversation for clarification;
- an explicitly requested handling/Clerk/reason/boundary preview waited for the Captain's response without mutating the brief;
- Escalation was selected only after the Captain explicitly chose personal takeover; and
- explicit human takeover neither spawned an Agent nor compiled an Agent execution context.

Final output:

```text
ok - S2-007 real Primary clarified an unmatched request, waited for Captain review, and selected Escalation only after explicit takeover
escalation_commit: b2e8883aa2b13be274eada9e08c7bb81cf4a9f6f; unmatched_agent_candidate: review-clerk@d950b6784202e84be97a988bf31862cda39c37f3
```

The commits identify isolated certification fixtures only; no real Clerk repository or business data was used or changed.
