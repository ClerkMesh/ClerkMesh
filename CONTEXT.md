# ClerkMesh

ClerkMesh extends Firstmate with persistent work identities that can be selected when coordinating and executing work.

## Language

**Captain**:
The sole operator of a first-version local ClerkMesh instance, with no login required. The Captain records actions and outcomes on behalf of human-executed Clerks; accounts and permissions belong to a future multi-user boundary.
_Avoid_: Admin, Human Clerk

**Project**:
A local Git repository in which ClerkMesh organizes and delivers work. A Project may have no remote and does not require GitHub or GitLab authentication.
_Avoid_: Workspace, Remote Repository

**Clerk**:
A global persistent work identity with defined responsibilities, capability boundaries, behavior, knowledge, and memory. A Clerk may be human- or Agent-executed, persists independently of Projects and tasks, and does not imply a ClerkMesh login account.
_Avoid_: Employee, Worker, Crewmate, Clone

**Escalation Clerk**:
The built-in, non-removable, human-executed Clerk selected for an execution only when the Captain explicitly chooses to handle work no specialist Clerk can fully cover. An unmatched or ambiguous request otherwise remains in the Primary conversation for clarification.
_Avoid_: Unknown Clerk, Duty Clerk, Generalist

**Research Clerk**:
The built-in, non-removable, Agent-executed Clerk for bounded source discovery, verification, comparison, and cited reporting when no more specialized Clerk completely matches. It gathers evidence but does not implement work, make product decisions, or act as a generalist.
_Avoid_: Search Slot, Default Clerk, Generalist

**Clerk Bootstrap**:
A Captain-reviewed Primary control-plane operation that creates the first or a later Clerk through the canonical validation, Git approval, and registry lifecycle without selecting a Clerk or creating a Task, Brief, or Worker. Bootstrap establishes an execution identity; it does not perform the professional work that identity may later undertake.
_Avoid_: Admin Clerk, Bootstrap Clerk, Clerk Task

**Task**:
A durable, independently acceptable unit of work in the Firstmate backlog. A Task does not permanently own a Clerk; Primary selects the best current Clerk when preparing each execution.
_Avoid_: Node, Worker, Ticket

**Brief**:
The task-scoped execution context prepared by Primary. It captures the Clerk selected for the current execution and is reused for follow-up; a later Worker execution may use a newly selected Clerk and regenerated Brief.
_Avoid_: Clerk Assignment, Full Conversation, Task

**Worker**:
An ephemeral Agent execution instance created for one Task and constrained by the Agent-executed Clerk context compiled into its current Brief.
_Avoid_: Clerk, Employee, Clone

**Learning Source**:
Immutable evidence explicitly admitted by the Captain, or finalized from a human-executed Task, from which changes to one or more Agent Clerks may be proposed. An Agent execution outcome does not itself become a Learning Source or trigger learning.
_Avoid_: Agent Output, Learned Knowledge

**Learning Proposal**:
A review process that binds one Learning Source to independently proposed changes for one or more Agent Clerks. A target Clerk learns nothing until the Captain approves that Clerk's proposed changes.
_Avoid_: Training Job, Automatic Learning, Multi-Clerk Commit

**Pi Session**:
A conversation history persisted by Pi. Browsing a Pi Session does not start Firstmate or make it the current Primary.
_Avoid_: Browser Session, Login Session, Task
