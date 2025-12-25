// app/api/chatbot/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ChatRole = "system" | "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type ChatbotRequestBody = {
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;

  // Optional, caller-provided context (RAG can be plugged in later without changing route shape).
  context?: string;
  knowledge?: Array<{
    id?: string;
    title?: string;
    content: string;
    url?: string;
  }>;

  // Optional metadata (e.g., page path, session id) for logging/analytics on your side.
  meta?: Record<string, unknown>;
};

type OpenAIChatCompletionResponse = {
  id?: string;
  choices?: Array<{
    index?: number;
    message?: { role?: string; content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function safeNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (isNonEmptyString(xff)) {
    const first = xff.split(",")[0]?.trim();
    if (isNonEmptyString(first)) {
      return first;
    }
  }
  const xRealIp = request.headers.get("x-real-ip");
  if (isNonEmptyString(xRealIp)) {
    return xRealIp.trim();
  }
  return "unknown";
}

/**
 * Minimal in-memory rate limiter (best-effort).
 * Works well for a single Node process; may be less effective on serverless multi-instance deployments.
 */
type RateEntry = { tokens: number; lastRefillMs: number };
const RATE_LIMIT_GLOBAL_KEY = "__portfolio_chatbot_rate_limit__";

function getRateStore(): Map<string, RateEntry> {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!(g[RATE_LIMIT_GLOBAL_KEY] instanceof Map)) {
    g[RATE_LIMIT_GLOBAL_KEY] = new Map<string, RateEntry>();
  }
  return g[RATE_LIMIT_GLOBAL_KEY] as Map<string, RateEntry>;
}

function allowRequest(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const store = getRateStore();

  // Token bucket settings: 20 requests / 60 seconds per IP.
  const capacity = 20;
  const refillPerSecond = capacity / 60;

  const now = Date.now();
  const existing = store.get(ip);

  if (!existing) {
    store.set(ip, { tokens: capacity - 1, lastRefillMs: now });
    return { allowed: true };
  }

  const elapsedSeconds = Math.max(0, (now - existing.lastRefillMs) / 1000);
  const refilled = Math.min(capacity, existing.tokens + elapsedSeconds * refillPerSecond);

  if (refilled < 1) {
    const deficit = 1 - refilled;
    const secondsToWait = Math.ceil(deficit / refillPerSecond);
    store.set(ip, { tokens: refilled, lastRefillMs: now });
    return { allowed: false, retryAfterSeconds: secondsToWait };
  }

  store.set(ip, { tokens: refilled - 1, lastRefillMs: now });
  return { allowed: true };
}

function buildContextBlock(body: ChatbotRequestBody): string | null {
  const parts: string[] = [];

  if (isNonEmptyString(body.context)) {
    parts.push(body.context.trim());
  }

  if (Array.isArray(body.knowledge) && body.knowledge.length > 0) {
    const cleaned = body.knowledge
      .filter((k) => k && isNonEmptyString(k.content))
      .slice(0, 20)
      .map((k, idx) => {
        const title = isNonEmptyString(k.title) ? k.title.trim() : `Item ${idx + 1}`;
        const url = isNonEmptyString(k.url) ? k.url.trim() : "";
        const id = isNonEmptyString(k.id) ? k.id.trim() : "";
        const headerBits = [title, id ? `id: ${id}` : "", url ? `url: ${url}` : ""].filter(Boolean);
        return `- ${headerBits.join(" | ")}\n${k.content.trim()}`;
      });

    if (cleaned.length > 0) {
      parts.push(`Knowledge Base Snippets:\n${cleaned.join("\n\n")}`);
    }
  }

  if (parts.length === 0) {
    return null;
  }

  return parts.join("\n\n");
}

function validateBody(body: unknown): { ok: true; value: ChatbotRequestBody } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid JSON body." };
  }

  const b = body as Partial<ChatbotRequestBody>;

  if (!Array.isArray(b.messages) || b.messages.length === 0) {
    return { ok: false, error: "Field 'messages' must be a non-empty array." };
  }

  const normalizedMessages: ChatMessage[] = [];
  for (const m of b.messages) {
    if (typeof m !== "object" || m === null) {
      return { ok: false, error: "Each message must be an object with role and content." };
    }
    const mm = m as Partial<ChatMessage>;
    if (mm.role !== "system" && mm.role !== "user" && mm.role !== "assistant") {
      return { ok: false, error: "Message role must be 'system', 'user', or 'assistant'." };
    }
    if (!isNonEmptyString(mm.content)) {
      return { ok: false, error: "Message content must be a non-empty string." };
    }
    normalizedMessages.push({ role: mm.role, content: mm.content });
  }

  const value: ChatbotRequestBody = {
    messages: normalizedMessages,
    systemPrompt: isNonEmptyString(b.systemPrompt) ? b.systemPrompt : undefined,
    temperature: typeof b.temperature === "number" ? b.temperature : undefined,
    maxTokens: typeof b.maxTokens === "number" ? b.maxTokens : undefined,
    model: isNonEmptyString(b.model) ? b.model : undefined,
    context: isNonEmptyString(b.context) ? b.context : undefined,
    knowledge: Array.isArray(b.knowledge) ? b.knowledge : undefined,
    meta: typeof b.meta === "object" && b.meta !== null ? b.meta : undefined,
  };

  return { ok: true, value };
}

async function callOpenAIChatCompletion(args: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
}): Promise<{ assistantText: string; usage?: OpenAIChatCompletionResponse["usage"]; rawId?: string }> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      temperature: args.temperature,
      max_tokens: args.maxTokens,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    const status = response.status;
    const message = `Upstream model error (${status}). ${text}`.slice(0, 2000);
    throw new Error(message);
  }

  const data = (await response.json()) as OpenAIChatCompletionResponse;

  const assistantText = data.choices?.[0]?.message?.content;
  if (!isNonEmptyString(assistantText)) {
    throw new Error("Upstream model returned an empty response.");
  }

  return {
    assistantText,
    usage: data.usage,
    rawId: data.id,
  };
}

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rate = allowRequest(ip);

  if (!rate.allowed) {
    const retryAfter = rate.retryAfterSeconds ?? 60;
    return new NextResponse(
      JSON.stringify({
        ok: false,
        error: "Too many requests. Please slow down.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  let jsonBody: unknown;
  try {
    jsonBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const validated = validateBody(jsonBody);
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
  }

  const body = validated.value;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!isNonEmptyString(apiKey)) {
    return NextResponse.json(
      { ok: false, error: "Server is missing OPENAI_API_KEY." },
      { status: 500 },
    );
  }

  const model =
    body.model ??
    (isNonEmptyString(process.env.OPENAI_MODEL) ? String(process.env.OPENAI_MODEL) : "gpt-4o-mini");

  const temperature = safeNumber(body.temperature, 0.2, 0, 2);
  const maxTokens = safeNumber(body.maxTokens, 700, 50, 2000);

  const contextBlock = buildContextBlock(body);

  const systemParts: string[] = [];
  systemParts.push(
    [
      "You are the AI assistant for a personal portfolio platform.",
      "Be accurate, helpful, and concise.",
      "If you are unsure, say so and ask a single focused question.",
      "Do not invent personal details, achievements, or links.",
      "If user requests sensitive data or admin actions, refuse and suggest using the admin UI.",
    ].join(" "),
  );

  if (isNonEmptyString(body.systemPrompt)) {
    systemParts.push(body.systemPrompt.trim());
  }

  if (isNonEmptyString(contextBlock)) {
    systemParts.push(
      [
        "Use the following context as the ONLY source of truth when it is relevant.",
        "If it does not contain the answer, say you don't have that information.",
        "",
        contextBlock,
      ].join("\n"),
    );
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemParts.join("\n\n") },
    ...body.messages,
  ];

  try {
    const result = await callOpenAIChatCompletion({
      apiKey,
      model,
      messages,
      temperature,
      maxTokens,
    });

    return NextResponse.json(
      {
        ok: true,
        message: {
          role: "assistant",
          content: result.assistantText,
        },
        meta: {
          model,
          usage: result.usage ?? null,
          upstreamId: result.rawId ?? null,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json(
      {
        ok: false,
        error: "Chatbot request failed.",
        details: msg.slice(0, 2000),
      },
      { status: 502 },
    );
  }
}

export async function GET(): Promise<Response> {
  return NextResponse.json(
    {
      ok: false,
      error: "Method not allowed. Use POST.",
    },
    { status: 405 },
  );
}
