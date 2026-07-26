import type { ConversationEvent } from "./conversation-types";

export interface ConversationTimelineItem {
  sequence: number;
  kind: "message" | "notification" | "error" | "extension-ui";
  role?: "user" | "assistant";
  text: string;
  streaming?: boolean;
}

function text(event: ConversationEvent): string {
  const value = event.payload.content ?? event.payload.text ?? event.payload.message ?? event.payload.title;
  return typeof value === "string" ? value : "";
}

/** Fold Pi's transport events into stable chat messages while preserving live streaming. */
export function buildConversationTimeline(events: ConversationEvent[]): ConversationTimelineItem[] {
  const items: ConversationTimelineItem[] = [];
  const seenSequences = new Set<number>();
  let streamingIndex: number | null = null;

  for (const event of events) {
    if (seenSequences.has(event.sequence)) continue;
    seenSequences.add(event.sequence);
    if (event.kind === "stream-fragment") {
      const fragment = text(event);
      if (!fragment) continue;
      if (streamingIndex === null) {
        streamingIndex = items.length;
        items.push({ sequence: event.sequence, kind: "message", role: "assistant", text: fragment, streaming: true });
      } else {
        items[streamingIndex] = { ...items[streamingIndex], text: items[streamingIndex].text + fragment };
      }
      continue;
    }

    if (event.kind === "visible-message") {
      const content = text(event);
      const role = event.payload.role === "assistant" ? "assistant" : "user";
      if (!content) continue;
      if (role === "assistant" && streamingIndex !== null) {
        items[streamingIndex] = { sequence: event.sequence, kind: "message", role, text: content };
        streamingIndex = null;
      } else {
        items.push({ sequence: event.sequence, kind: "message", role, text: content });
      }
      continue;
    }

    if (event.kind === "error" || event.kind === "notification" || event.kind === "extension-ui") {
      streamingIndex = null;
      items.push({ sequence: event.sequence, kind: event.kind, text: text(event) || (event.kind === "extension-ui" ? "Primary needs your attention." : "Update received.") });
    }
  }

  return items;
}
