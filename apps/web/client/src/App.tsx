import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { ConversationEvent, ConversationEventSnapshot, ConversationSessionCatalog, ConversationSessionSummary } from "./conversation-types";
import type { ClerkmeshTaskDetailV1, FmHerdrAgentsV1, FmTaskGraphV1 } from "./work-types";
import type { ClerkCatalogV1 } from "../../../../packages/shared/src/generated/clerk-catalog.v1";
import "./styles.css";

const SESSION_PARAM = "session";
const WORKSPACE_PARAM = "workspace";
const TOKEN_KEY = "clerkmesh.conversation-client-token.v1";
type Workspace = "conversations" | "work" | "company";
type WorkError = { message: string; observedAt: string; lastSuccess: unknown };

function currentUrl() { return new URL(window.location.href); }
function selectedSessionId(): string | null { return currentUrl().searchParams.get(SESSION_PARAM); }
function selectedWorkspace(): Workspace { const value = currentUrl().searchParams.get(WORKSPACE_PARAM); return value === "work" || value === "company" ? value : "conversations"; }
function navigate(workspace: Workspace, session?: string): void { const url = currentUrl(); workspace === "conversations" ? url.searchParams.delete(WORKSPACE_PARAM) : url.searchParams.set(WORKSPACE_PARAM, workspace); if (session) url.searchParams.set(SESSION_PARAM, session); window.history.pushState({}, "", url); window.dispatchEvent(new PopStateEvent("popstate")); }
function clientToken(): string { let token = localStorage.getItem(TOKEN_KEY); if (!token) { token = crypto.randomUUID(); localStorage.setItem(TOKEN_KEY, token); } return token; }
async function loadSessions(signal: AbortSignal): Promise<ConversationSessionCatalog> { const response = await fetch("/api/conversations/sessions", { signal, headers: { Accept: "application/json" } }); if (!response.ok) throw new Error("Session history is unavailable."); return response.json() as Promise<ConversationSessionCatalog>; }

function SessionRow({ session, selected }: { session: ConversationSessionSummary; selected: boolean }) {
  return <button className="session" aria-current={selected ? "page" : undefined} onClick={() => navigate("conversations", session.id)}><strong>{session.name ?? "Untitled conversation"}</strong><span>{session.messageCount} messages · {new Date(session.modifiedAt).toLocaleString()}</span></button>;
}
function eventText(event: ConversationEvent): string { const value = event.payload.content ?? event.payload.text ?? event.payload.message ?? event.payload.title ?? event.payload.status; return typeof value === "string" ? value : event.kind === "extension-ui" ? "Primary needs your attention." : "Update received."; }
function observed(value: string | null | undefined): string { return value ? new Date(value).toLocaleString() : "observation time unavailable"; }

function WorkWorkspace({ tasks, agents, errors }: { tasks: FmTaskGraphV1 | null; agents: FmHerdrAgentsV1 | null; errors: Partial<Record<"tasks" | "agents", WorkError>> }) {
  const agentsByTask = new Map(agents?.agents.map((agent) => [agent.taskId, agent]));
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClerkmeshTaskDetailV1 | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  useEffect(() => { if (!selectedTask) { setDetail(null); setDetailError(null); return; } const controller = new AbortController(); fetch(`/api/work/tasks/${encodeURIComponent(selectedTask)}`, { signal: controller.signal, headers: { Accept: "application/json" } }).then(async (response) => { if (!response.ok) throw new Error("Task detail is unavailable."); setDetail(await response.json() as ClerkmeshTaskDetailV1); setDetailError(null); }, (reason: unknown) => { if (!controller.signal.aborted) setDetailError(reason instanceof Error ? reason.message : "Task detail is unavailable."); }); return () => controller.abort(); }, [selectedTask]);
  return <div className="work-layout"><aside aria-label="Work"><h1>Work</h1><p>Firstmate Task graph and Herdr runtime observations.</p></aside><section aria-live="polite"><p className="crumb">Work / {detail?.task.title ?? "Task graph"}</p><h2>{detail?.task.title ?? "Task graph"}</h2>{detailError && <p role="alert">{detailError}</p>}{detail && <div className="task-detail"><p>{detail.task.phase.replaceAll("_", " ")}</p>{detail.execution_clerk ? <p><strong>Current or most recent execution Clerk:</strong> {detail.execution_clerk.name} · {detail.execution_clerk.execution === "human" ? "Human Clerk — no Worker is created" : "Agent Clerk"}</p> : <p>No execution Clerk is present in the current brief.</p>}<button type="button" onClick={() => setSelectedTask(null)}>Back to Task graph</button></div>}{!detail && <>{errors.tasks && <p role="alert">Task graph is stale: {errors.tasks.message} Last checked {observed(errors.tasks.observedAt)}.</p>}{errors.agents && <p role="alert">Agent status is stale: {errors.agents.message} Last checked {observed(errors.agents.observedAt)}.</p>}{!tasks && !errors.tasks && <p>Loading Tasks…</p>}{tasks && <><p className="projection-meta">{tasks.freshness} · observed {observed(tasks.observedAt)}</p><div className="task-list">{tasks.tasks.map((task) => { const agent = agentsByTask.get(task.id); return <article className="task-card" key={task.id}><div><small>{task.projectId}</small><h3>{task.title}</h3><p>{task.phase.replaceAll("_", " ")}{task.wait ? ` · waiting: ${task.wait.reason}` : ""}</p><button type="button" onClick={() => setSelectedTask(task.id)}>View Task</button></div><div className="runtime"><strong>{agent?.agent.status ?? task.runtime.state}</strong><span>{agent ? `Herdr · ${observed(agent.agent.observedAt)}` : `${task.runtime.source} · ${observed(task.runtime.observedAt)}`}</span></div></article>; })}{tasks.tasks.length === 0 && <p>No Tasks are currently projected.</p>}</div></>}</>}</section></div>;
}

function CompanyWorkspace() {
  const [catalog, setCatalog] = useState<ClerkCatalogV1 | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const controller = new AbortController(); fetch("/api/clerks", { signal: controller.signal, headers: { Accept: "application/json" } }).then(async (response) => { if (!response.ok) throw new Error("Clerk catalog is unavailable."); setCatalog(await response.json() as ClerkCatalogV1); }, (reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Clerk catalog is unavailable."); }); return () => controller.abort(); }, []);
  return <div className="work-layout"><aside aria-label="Company"><h1>Company</h1><p>Approved Clerks available to the control plane.</p></aside><section aria-live="polite"><p className="crumb">Company / Clerk catalog</p><h2>Clerk catalog</h2>{error && <p role="alert">{error}</p>}{!catalog && !error && <p>Loading Clerks…</p>}{catalog && <><p className="projection-meta">{catalog.freshness} · observed {observed(catalog.observedAt)}</p>{catalog.errors.map((message) => <p role="alert" key={message}>{message}</p>)}<div className="task-list">{catalog.clerks.map((clerk) => <article className="task-card" key={clerk.name}><div><small>{clerk.execution === "human" ? "Human Clerk" : "Agent Clerk"}{clerk.builtIn ? " · built in" : ""}</small><h3>{clerk.name}</h3><p>{clerk.description}</p></div><div className="runtime"><strong>{clerk.status}</strong><span>{clerk.approvedCommit.slice(0, 12)}</span></div></article>)}</div>{catalog.omitted.length > 0 && <p>{catalog.omitted.length} invalid registry {catalog.omitted.length === 1 ? "entry was" : "entries were"} omitted.</p>}</>}</section></div>;
}

export function App() {
  const [catalog, setCatalog] = useState<ConversationSessionCatalog | null>(null);
  const [selected, setSelected] = useState(selectedSessionId);
  const [workspace, setWorkspace] = useState(selectedWorkspace);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ConversationEvent[]>([]);
  const [writable, setWritable] = useState(false);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [diagnostics, setDiagnostics] = useState(false);
  const [tasks, setTasks] = useState<FmTaskGraphV1 | null>(null);
  const [agents, setAgents] = useState<FmHerdrAgentsV1 | null>(null);
  const [workErrors, setWorkErrors] = useState<Partial<Record<"tasks" | "agents", WorkError>>>({});
  const token = useMemo(clientToken, []);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => { const controller = new AbortController(); loadSessions(controller.signal).then(setCatalog, (reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Session history is unavailable."); }); return () => controller.abort(); }, []);
  useEffect(() => { const update = () => { setSelected(selectedSessionId()); setWorkspace(selectedWorkspace()); }; window.addEventListener("popstate", update); return () => window.removeEventListener("popstate", update); }, []);
  useEffect(() => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const parameters = new URLSearchParams({ clientToken: token });
    if (diagnostics) parameters.set("diagnostics", "true");
    if (workspace === "work") parameters.set("work", "true");
    const ws = new WebSocket(`${protocol}//${location.host}/api/conversations/events?${parameters}`);
    setSocket(ws); ws.onopen = () => setConnected(true); ws.onclose = () => { setConnected(false); setWritable(false); };
    ws.onmessage = ({ data }) => { try {
      const frame = JSON.parse(String(data)) as { type?: string; writable?: boolean; snapshot?: ConversationEventSnapshot; projection?: "tasks" | "agents"; kind?: "snapshot" | "error"; message?: string; observedAt?: string; lastSuccess?: unknown };
      if (frame.type === "lease-state") setWritable(frame.writable === true);
      if (frame.type === "event-snapshot" && frame.snapshot) setEvents((current) => { const bySequence = new Map(current.map((event) => [event.sequence, event])); for (const event of frame.snapshot!.events) bySequence.set(event.sequence, event); return [...bySequence.values()].sort((a, b) => a.sequence - b.sequence).slice(-10_000); });
      if (frame.type === "work-projection" && frame.projection && frame.kind === "snapshot" && frame.snapshot) { frame.projection === "tasks" ? setTasks(frame.snapshot as unknown as FmTaskGraphV1) : setAgents(frame.snapshot as unknown as FmHerdrAgentsV1); setWorkErrors((current) => { const next = { ...current }; delete next[frame.projection!]; return next; }); }
      if (frame.type === "work-projection" && frame.projection && frame.kind === "error") setWorkErrors((current) => ({ ...current, [frame.projection!]: { message: frame.message ?? "Projection query unavailable", observedAt: frame.observedAt ?? "", lastSuccess: frame.lastSuccess } }));
    } catch { setError("An update could not be read."); } };
    return () => ws.close();
  }, [token, diagnostics, workspace]);

  const active = catalog?.sessions.find((session) => session.id === selected) ?? null;
  async function send(event: FormEvent) { event.preventDefault(); const text = message.trim(); if (!text || !writable || sending) return; setSending(true); setError(null); try { const response = await fetch("/api/conversations/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientToken: token, requestId: crypto.randomUUID(), sessionId: active?.id ?? null, message: text }) }); if (!response.ok) throw new Error(response.status === 409 ? "This browser is read-only because another client holds the write lease." : "The Primary could not accept the message."); setMessage(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "The Primary could not accept the message."); } finally { setSending(false); } }

  return <main><header><span className="product">ClerkMesh</span><nav aria-label="Workspace"><button aria-current={workspace === "conversations" ? "page" : undefined} onClick={() => navigate("conversations")}>Conversations</button><button aria-current={workspace === "work" ? "page" : undefined} onClick={() => navigate("work")}>Work</button><button aria-current={workspace === "company" ? "page" : undefined} onClick={() => navigate("company")}>Company</button></nav></header>{workspace === "work" ? <WorkWorkspace tasks={tasks} agents={agents} errors={workErrors}/> : workspace === "company" ? <CompanyWorkspace/> : <div className="workspace"><aside aria-label="Conversations"><h1>Conversations</h1>{error && <p role="alert">{error}</p>}{!catalog && !error && <p>Loading history…</p>}{catalog?.sessions.map((session) => <SessionRow key={session.id} session={session} selected={session.id === selected} />)}{catalog?.sessions.length === 0 && <p>No conversations yet.</p>}</aside><section aria-live="polite">{active ? <><p className="crumb">Conversations / {active.name ?? "Untitled conversation"}</p><h2>{active.name ?? "Untitled conversation"}</h2><div className="diagnostic-controls"><label><input type="checkbox" checked={diagnostics} onChange={(event) => setDiagnostics(event.target.checked)}/> Show diagnostics</label>{diagnostics && <p role="status" className="diagnostic-warning"><strong>Diagnostic mode is on.</strong> Reasoning, tool, and RPC details may contain sensitive operational information. Values are redacted, but review before sharing.</p>}</div><div className="timeline">{events.map((item) => <article key={item.sequence} className={`event ${item.kind}`}><small>{item.kind.replaceAll("-", " ")}</small>{item.kind === "diagnostic" ? <pre>{JSON.stringify(item.payload, null, 2)}</pre> : <p>{eventText(item)}</p>}</article>)}{events.length === 0 && <p>Send a message to start or resume this conversation.</p>}</div><form onSubmit={send}><textarea aria-label="Message to Primary" value={message} onChange={(event) => setMessage(event.target.value)} disabled={!writable || sending} placeholder={writable ? "Message the Primary…" : "Read-only while another browser is writing"}/><div className="composer-row"><span title="This local browser write lease is not authentication or identity.">Local write lease: {connected ? writable ? "writable" : "read-only" : "reconnecting…"}</span>{connected && !writable && <button type="button" onClick={() => socket?.send(JSON.stringify({ type: "claim-write" }))}>Claim local write lease</button>}<button type="submit" disabled={!writable || sending || !message.trim()}>{sending ? "Sending…" : "Send"}</button></div></form></> : <div className="empty"><h2>Select a conversation</h2><p>Browsing history does not start the Primary or call a model.</p></div>}</section></div>}</main>;
}
