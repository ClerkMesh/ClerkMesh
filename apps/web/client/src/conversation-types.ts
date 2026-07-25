export interface ConversationSessionSummary {
  id: string;
  name: string | null;
  createdAt: string;
  modifiedAt: string;
  messageCount: number;
}

export interface ConversationSessionCatalog {
  schema: "clerkmesh.conversation-sessions.v1";
  observedAt: string;
  sessions: ConversationSessionSummary[];
  errors: string[];
}

export type ConversationEventKind = "visible-message" | "stream-fragment" | "notification" | "error" | "primary-status" | "extension-ui" | "diagnostic";

export interface ConversationEvent {
  sequence: number;
  kind: ConversationEventKind;
  payload: Record<string, unknown>;
}

export interface ConversationEventSnapshot {
  schema: "clerkmesh.conversation-events.v1";
  observedAt: string;
  cursor: number;
  events: ConversationEvent[];
}
