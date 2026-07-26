# ClerkMesh V1 security boundary

ClerkMesh V1 is a local orchestration product for a single operating-system user. Its path checks, immutable Git identities, review gates, redaction, and process boundaries reduce mistakes and make changes reviewable; they are not a confidentiality or tamper-resistance sandbox.

Primary processes, Workers, Learning Agents, Pi tools, and general shell commands run with the permissions of the user who launched ClerkMesh. Any process or shell command running as that same OS user may be able to read or modify ClerkMesh operational state, Project worktrees, Clerk repositories, process environment, or other user-accessible data. Filesystem separation, candidate clones, worktrees, bounded commands, and UI write leases must not be treated as hard isolation from same-user processes.

Use a separate OS account, virtual machine, or other externally managed sandbox when work requires a confidentiality or tamper-resistance boundary. Continue to review commands and diffs, keep credentials in their owning tools, and grant the launching OS user only the access needed for the work.

For the supported network boundary, ClerkMesh defaults to loopback and validates browser requests; a non-loopback bind does not change the same-user process boundary described above.
