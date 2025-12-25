// services/livechat.service.ts

import type { ChatMessage } from "@/types/chat";

/**
 * ⚠️ STAGE 7 NOTE
 * Placeholder Live Chat service (DEV ONLY).
 *
 * Purpose:
 * - Handle real-time human ↔ human chat (visitor ↔ admin)
 * - Act as a thin adapter for future Supabase Realtime / WebSocket backend
 *
 * ❗ No realtime logic here yet
 * ❗ No persistence here yet
 */

/* -------------------------------------------------------------------------- */
/* In-memory storage (DEV ONLY)                                               */
/* -------------------------------------------------------------------------- */

type StoredLiveMessage = ChatMessage & {
  timestamp: string;
  resolved?: boolean;
};

const MESSAGES: StoredLiveMessage[] = [];

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

function normalizeContent(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Send a message from a visitor or admin.
 */
export async function sendMessage(
  message: ChatMessage
): Promise<ChatMessage> {
  const sessionId = normalizeSessionId(message.sessionId ?? "");

  if (!sessionId) {
    throw new Error("sessionId is required.");
  }

  const content = normalizeContent(message.content);

  if (!content) {
    throw new Error("Message content is required.");
  }

  const stored: StoredLiveMessage = {
    ...message,
    id: message.id?.trim() ? message.id : makeId(),
    sessionId,
    content,
    timestamp: nowIso(),
    resolved: Boolean(message.resolved),
  };

  MESSAGES.push(stored);

  return deepClone(stored);
}

/**
 * Get all messages for a session.
 * Messages are returned in chronological order.
 */
export async function getMessages(
  sessionId: string
): Promise<ChatMessage[]> {
  const sid = normalizeSessionId(sessionId);

  const list = MESSAGES
    .filter((m) => m.sessionId === sid)
    .slice()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  return deepClone(list);
}

/**
 * Mark a message as resolved/handled.
 * Typically used by admin operators.
 */
export async function markMessageResolved(
  messageId: string
): Promise<void> {
  const msg = MESSAGES.find((m) => m.id === messageId);

  if (!msg) {
    return;
  }

  msg.resolved = true;
}

/**
 * Clear all messages for a session (DEV ONLY).
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
 * DEV helper: clear all live chat messages.
 */
export async function clearAllMessages(): Promise<void> {
  MESSAGES.length = 0;
}
