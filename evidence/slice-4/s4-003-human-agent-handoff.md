# S4-003 Human result to dependent Agent Task handoff

Status: passed

Observed UTC: 2026-07-25T13:55:46Z

## Reproduce

```sh
S4_003_LIVE=1 corepack pnpm run cert:slice4-human-agent-handoff
```

## Result

A genuine Pi 0.82.0 Primary handled a Project modification required by an accepted Human result without letting the Human Clerk modify the Project. In an isolated fixture it:

- created a separate ordinary Firstmate Agent Task blocked by the completed Human Task;
- exposed that dependency through the authoritative `fm-task-graph.v1` projection;
- restarted candidate inspection and semantic selection rather than reusing the Human Clerk;
- selected the matching `project-editor` Agent Clerk instead of the competing Agent Clerk;
- ran the shared local-only Project preflight and compiled a fresh canonical Agent execution context;
- retained an empty material allowlist and did not spawn a Worker during this bounded certification.

Independent assertions parsed the resulting brief and verified the new Task ID, Agent execution type, selected Clerk name and immutable commit, empty allowlist, and authoritative `blocks` edge from `human-design-result` to `agent-apply-result`.

Observed output:

```text
ok - S4-003 real Primary created the dependent Agent Task and freshly selected its Agent Clerk
human_task: human-design-result; agent_task: agent-apply-result; agent_clerk_commit: 26dbe62ceacc944cebd489a77250d2598b14c654
```

The fixture pinned `TASKS_AXI_FILE` to its temporary backlog, was removed after the run, and changed no real Clerk repository, Firstmate fleet, Project, or business Task.
