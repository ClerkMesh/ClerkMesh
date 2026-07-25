import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { ConversationEvent, ConversationEventSnapshot, ConversationSessionCatalog, ConversationSessionSummary } from "./conversation-types";
import "./styles.css";

const SESSION_PARAM = "session";
const TOKEN_KEY = "clerkmesh.conversation-client-token.v1";

function selectedSessionId(): string | null { return new URL(window.location.href).searchParams.get(SESSION_PARAM); }
function selectSession(id: string): void { const url = new URL(window.location.href); url.searchParams.set(SESSION_PARAM, id); window.history.pushState({}, "", url); window.dispatchEvent(new PopStateEvent("popstate")); }
function clientToken(): string { let token = localStorage.getItem(TOKEN_KEY); if (!token) { token = crypto.randomUUID(); localStorage.setItem(TOKEN_KEY, token); } return token; }
async function loadSessions(signal: AbortSignal): Promise<ConversationSessionCatalog> { const response = await fetch("/api/conversations/sessions", { signal, headers: { Accept: "application/json" } }); if (!response.ok) throw new Error("Session history is unavailable."); return response.json() as Promise<ConversationSessionCatalog>; }

function SessionRow({ session, selected }: { session: ConversationSessionSummary; selected: boolean }) {
  return <button className="session" aria-current={selected ? "page" : undefined} onClick={() => selectSession(session.id)}><strong>{session.name ?? "Untitled conversation"}</strong><span>{session.messageCount} messages · {new Date(session.modifiedAt).toLocaleString()}</span></button>;
}

function eventText(event: ConversationEvent): string {
  const value = event.payload.content ?? event.payload.text ?? event.payload.message ?? event.payload.title ?? event.payload.status;
  return typeof value === "string" ? value : event.kind === "extension-ui" ? "Primary needs your attention." : "Update received.";
}

export function App() {
  const [catalog, setCatalog] = useState<ConversationSessionCatalog | null>(null);
  const [selected, setSelected] = useState(selectedSessionId);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ConversationEvent[]>([]);
  const [writable, setWritable] = useState(false);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [diagnostics, setDiagnostics] = useState(false);
  const token = useMemo(clientToken, []);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => { const controller = new AbortController(); loadSessions(controller.signal).then(setCatalog, (reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Session history is unavailable."); }); return () => controller.abort(); }, []);
  useEffect(() => { const update = () => setSelected(selectedSessionId()); window.addEventListener("popstate", update); return () => window.removeEventListener("popstate", update); }, []);
  useEffect(() => {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const parameters = new URLSearchParams({ clientToken: token });
    if (diagnostics) parameters.set("diagnostics", "true");
    const ws = new WebSocket(`${protocol}//${location.host}/api/conversations/events?${parameters}`);
    setSocket(ws);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => { setConnected(false); setWritable(false); };
    ws.onmessage = ({ data }) => {
      try {
        const frame = JSON.parse(String(data)) as { type?: string; writable?: boolean; snapshot?: ConversationEventSnapshot };
        if (frame.type === "lease-state") setWritable(frame.writable === true);
        if (frame.type === "event-snapshot" && frame.snapshot) setEvents((current) => {
          const bySequence = new Map(current.map((event) => [event.sequence, event]));
          for (const event of frame.snapshot!.events) bySequence.set(event.sequence, event);
          return [...bySequence.values()].sort((a, b) => a.sequence - b.sequence).slice(-10_000);
        });
      } catch { setError("A conversation update could not be read."); }
    };
    return () => ws.close();
  }, [token, diagnostics]);

  const active = catalog?.sessions.find((session) => session.id === selected) ?? null;
  async function send(event: FormEvent) {
    event.preventDefault(); const text = message.trim(); if (!text || !writable || sending) return;
    setSending(true); setError(null);
    try {
      const response = await fetch("/api/conversations/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientToken: token, requestId: crypto.randomUUID(), sessionId: active?.id ?? null, message: text }) });
      if (!response.ok) throw new Error(response.status === 409 ? "This browser is read-only because another client holds the write lease." : "The Primary could not accept the message.");
      setMessage("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The Primary could not accept the message."); } finally { setSending(false); }
  }

  return <main><header><span className="product">ClerkMesh</span><nav aria-label="Workspace"><strong>Conversations</strong></nav></header><div className="workspace"><aside aria-label="Conversations"><h1>Conversations</h1>{error && <p role="alert">{error}</p>}{!catalog && !error && <p>Loading history…</p>}{catalog?.sessions.map((session) => <SessionRow key={session.id} session={session} selected={session.id === selected} />)}{catalog?.sessions.length === 0 && <p>No conversations yet.</p>}</aside><section aria-live="polite">{active ? <><p className="crumb">Conversations / {active.name ?? "Untitled conversation"}</p><h2>{active.name ?? "Untitled conversation"}</h2><div className="diagnostic-controls"><label><input type="checkbox" checked={diagnostics} onChange={(event) => setDiagnostics(event.target.checked)}/> Show diagnostics</label>{diagnostics && <p role="status" className="diagnostic-warning"><strong>Diagnostic mode is on.</strong> Reasoning, tool, and RPC details may contain sensitive operational information. Values are redacted, but review before sharing.</p>}</div><div className="timeline">{events.map((item) => <article key={item.sequence} className={`event ${item.kind}`}><small>{item.kind.replaceAll("-", " ")}</small>{item.kind === "diagnostic" ? <pre>{JSON.stringify(item.payload, null, 2)}</pre> : <p>{eventText(item)}</p>}</article>)}{events.length === 0 && <p>Send a message to start or resume this conversation.</p>}</div><form onSubmit={send}><textarea aria-label="Message to Primary" value={message} onChange={(event) => setMessage(event.target.value)} disabled={!writable || sending} placeholder={writable ? "Message the Primary…" : "Read-only while another browser is writing"}/><div className="composer-row"><span>{connected ? writable ? "Writable" : "Read-only" : "Reconnecting…"}</span>{connected && !writable && <button type="button" onClick={() => socket?.send(JSON.stringify({ type: "claim-write" }))}>Claim write access</button>}<button type="submit" disabled={!writable || sending || !message.trim()}>{sending ? "Sending…" : "Send"}</button></div></form></> : <div className="empty"><h2>Select a conversation</h2><p>Browsing history does not start the Primary or call a model.</p></div>}</section></div></main>;
}
