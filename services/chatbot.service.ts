// services/chatbot.service.ts

import type { ChatMessage } from "@/types/chat";

/**
 * ⚠️ STAGE 7 NOTE
 * Placeholder AI chatbot service (DEV ONLY).
 *
 * Goals:
 * - Keep this file as a THIN adapter for UI / routes
 * - Use in-memory storage for now
 * - Prepare clean seams for later:
 *   - /api/chat/* routes
 *   - lib/rag pipeline + vector store
 *   - LLM provider integration
 *
 * ❗ No RAG / LLM logic here yet (that belongs in lib/rag + api routes)
 */

/* -------------------------------------------------------------------------- */
/* In-memory storage (DEV ONLY)                                               */
/* -------------------------------------------------------------------------- */

type StoredMessage = ChatMessage & {
  timestamp: string;
  from: "user" | "ai";
};

const MESSAGES: StoredMessage[] = [];

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeSessionId(value: string): string {
  return value.trim();
}

function ensureContent(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function buildAiReply(userMessage: ChatMessage): StoredMessage {
  const content = ensureContent(userMessage.content);

  const safeEcho = content ? content : "(empty message)";

  return {
    id: makeId(),
    sessionId: userMessage.sessionId,
    from: "ai",
    content: `Echo: ${safeEcho}`,
    timestamp: nowIso(),
  };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Send a user message to the AI chatbot (placeholder).
 *
 * Stores:
 * - user message
 * - ai reply
 *
 * Later:
 * - route this to /api/chat/send
 * - in that route, call lib/rag pipeline + LLM
 */
export async function sendMessage(message: ChatMessage): Promise<ChatMessage> {
  const sessionId = normalizeSessionId(message.sessionId ?? "");

  if (!sessionId) {
    throw new Error("sessionId is required.");
  }

  const userContent = ensureContent(message.content);

  if (!userContent) {
    throw new Error("Message content is required.");
  }

  const userStored: StoredMessage = {
    ...message,
    id: message.id?.trim() ? message.id : makeId(),
    sessionId,
    from: "user",
    content: userContent,
    timestamp: nowIso(),
  };

  MESSAGES.push(userStored);

  const aiReply = buildAiReply(userStored);

  MESSAGES.push(aiReply);

  return deepClone(aiReply);
}

/**
 * Get all messages for a session (ordered by timestamp ascending).
 */
export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  const sid = normalizeSessionId(sessionId);

  const list = MESSAGES
    .filter((m) => m.sessionId === sid)
    .slice()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return deepClone(list);
}

/**
 * Clear messages for a session.
 * Useful for testing and admin controls in DEV.
 */
export async function clearMessages(sessionId: string): Promise<void> {
  const sid = normalizeSessionId(sessionId);

  for (let i = MESSAGES.length - 1; i >= 0; i -= 1) {
    if (MESSAGES[i].sessionId === sid) {
      MESSAGES.splice(i, 1);
    }
  }
}

/**
 * DEV helper: clear all sessions/messages.
 */
export async function clearAllMessages(): Promise<void> {
  MESSAGES.length = 0;
}
