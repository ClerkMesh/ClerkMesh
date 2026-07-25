import { useEffect, useState } from "react";
import type { ConversationSessionCatalog, ConversationSessionSummary } from "./conversation-types";
import "./styles.css";

const SESSION_PARAM = "session";

function selectedSessionId(): string | null {
  return new URL(window.location.href).searchParams.get(SESSION_PARAM);
}

function selectSession(id: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set(SESSION_PARAM, id);
  window.history.pushState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

async function loadSessions(signal: AbortSignal): Promise<ConversationSessionCatalog> {
  const response = await fetch("/api/conversations/sessions", { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Session history is unavailable.");
  return response.json() as Promise<ConversationSessionCatalog>;
}

function SessionRow({ session, selected }: { session: ConversationSessionSummary; selected: boolean }) {
  return (
    <button className="session" aria-current={selected ? "page" : undefined} onClick={() => selectSession(session.id)}>
      <strong>{session.name ?? "Untitled conversation"}</strong>
      <span>{session.messageCount} messages · {new Date(session.modifiedAt).toLocaleString()}</span>
    </button>
  );
}

export function App() {
  const [catalog, setCatalog] = useState<ConversationSessionCatalog | null>(null);
  const [selected, setSelected] = useState(selectedSessionId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadSessions(controller.signal).then(setCatalog, (reason: unknown) => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Session history is unavailable.");
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const update = () => setSelected(selectedSessionId());
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

  const active = catalog?.sessions.find((session) => session.id === selected) ?? null;
  return (
    <main>
      <header><span className="product">ClerkMesh</span><nav aria-label="Workspace"><strong>Conversations</strong></nav></header>
      <div className="workspace">
        <aside aria-label="Conversations">
          <h1>Conversations</h1>
          {error && <p role="alert">{error}</p>}
          {!catalog && !error && <p>Loading history…</p>}
          {catalog?.sessions.map((session) => <SessionRow key={session.id} session={session} selected={session.id === selected} />)}
          {catalog?.sessions.length === 0 && <p>No conversations yet.</p>}
        </aside>
        <section aria-live="polite">
          {active ? <><p className="crumb">Conversations / {active.name ?? "Untitled conversation"}</p><h2>{active.name ?? "Untitled conversation"}</h2><p>Conversation history will appear here.</p></> :
            <div className="empty"><h2>Select a conversation</h2><p>Browsing history does not start the Primary or call a model.</p></div>}
        </section>
      </div>
    </main>
  );
}
