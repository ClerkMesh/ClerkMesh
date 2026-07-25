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
