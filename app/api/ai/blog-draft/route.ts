import { NextResponse } from "next/server";

type BlogDraftRequest = {
  topic: string;
  goal?: string;
  audience?: string;
  tone?: "neutral" | "casual" | "professional" | "technical";
  language?: string;
  seo?: {
    titleHint?: string;
    descriptionHint?: string;
    keywords?: string[];
  };
  outline?: string[];
  constraints?: {
    maxWords?: number;
    includeToc?: boolean;
    markdownOnly?: boolean;
  };
};

type BlogDraftResponse = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
  warnings: string[];
};

function jsonError(status: number, message: string) {
  return NextResponse.json(
    { ok: false, error: message, message },
    { status }
  );
}

function safeTrim(v: unknown, maxLen: number): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return "";
  if (s.length > maxLen) return s.slice(0, maxLen);
  return s;
}

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function asStringArray(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];

  const out: string[] = [];

  for (const item of value) {
    if (out.length >= maxItems) break;

    const s = safeTrim(item, maxLen);
    if (s) out.push(s);
  }

  return out;
}

function normalizeTone(v: unknown): BlogDraftRequest["tone"] {
  if (v === "neutral" || v === "casual" || v === "professional" || v === "technical") {
    return v;
  }

  return "professional";
}

function buildDraftPrompt(body: BlogDraftRequest) {
  const topic = body.topic;
  const goal = body.goal ?? "";
  const audience = body.audience ?? "";
  const tone = body.tone ?? "professional";
  const language = body.language ?? "English";

  const keywords = body.seo?.keywords ?? [];
  const titleHint = body.seo?.titleHint ?? "";
  const descriptionHint = body.seo?.descriptionHint ?? "";

  const outline = body.outline ?? [];
  const maxWords = body.constraints?.maxWords ?? 1200;
  const includeToc = body.constraints?.includeToc ?? true;

  const sectionsText =
    outline.length > 0
      ? outline.map((s, i) => `${i + 1}. ${s}`).join("\n")
      : "Use a logical structure with headings and subheadings.";

  const keywordLine =
    keywords.length > 0
      ? `SEO keywords to naturally include (no stuffing): ${keywords.join(", ")}`
      : "SEO keywords: None provided.";

  const tocLine = includeToc
    ? "Include a short Table of Contents (markdown links) near the top."
    : "Do not include a Table of Contents.";

  const prompt = `
You are an expert technical writer and SEO editor.

TASK:
Generate a high-quality blog draft in ${language} about: "${topic}"

CONTEXT:
Goal: ${goal || "Not specified"}
Audience: ${audience || "General"}
Tone: ${tone}

SEO:
Title hint: ${titleHint || "None"}
Description hint: ${descriptionHint || "None"}
${keywordLine}

STRUCTURE:
${sectionsText}

CONSTRAINTS:
- Target max words: ${maxWords}
- ${tocLine}
- Use Markdown formatting.
- Use semantic headings (#, ##, ###).
- Avoid clickbait. Be accurate and practical.
- Do NOT include private keys, secrets, or unsafe instructions.

OUTPUT FORMAT:
Return ONLY valid JSON with this exact schema:
{
  "title": "string",
  "excerpt": "string (1-2 lines)",
  "seo": {
    "title": "string",
    "description": "string",
    "keywords": ["string", ...]
  },
  "content": "string (full markdown)"
}
`.trim();

  return prompt;
}

async function callLLM(prompt: string): Promise<string> {
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    const fallback = {
      title: "Draft unavailable (AI not configured)",
      excerpt: "AI generation is currently unavailable. Configure AI_API_KEY to enable drafts.",
      seo: {
        title: "AI Draft Unavailable",
        description: "AI generation is not configured for this environment.",
        keywords: [],
      },
      content: `# Draft unavailable

AI generation is currently unavailable because **AI_API_KEY** is not configured.

## What you can do
- Add \`AI_API_KEY\` to your environment variables
- Restart the dev server
- Try again

> Note: This endpoint is designed to generate drafts only. It never publishes automatically.`,
    };

    return JSON.stringify(fallback);
  }

  const baseUrl = process.env.AI_API_BASE_URL?.trim();

  if (!baseUrl) {
    const fallback = {
      title: "Draft unavailable (AI provider not set)",
      excerpt: "Set AI_API_BASE_URL to your provider endpoint to enable drafts.",
      seo: {
        title: "AI Provider Not Set",
        description: "AI provider endpoint is not configured.",
        keywords: [],
      },
      content: `# Draft unavailable

AI generation cannot run because **AI_API_BASE_URL** is not configured.

## Required env
- \`AI_API_KEY\`
- \`AI_API_BASE_URL\`

> This endpoint returns a draft only, never publishes.`,
    };

    return JSON.stringify(fallback);
  }

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI provider error: ${res.status} ${body}`);
  }

  const data = await res.json().catch(() => null);
  const text = typeof data?.text === "string" ? data.text : "";

  if (!text) {
    throw new Error("AI provider returned empty response");
  }

  return text;
}

function tryParseJson(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeResponse(raw: any, topic: string): BlogDraftResponse {
  const warnings: string[] = [];

  const title = safeTrim(raw?.title, 140) || safeTrim(topic, 140) || "Untitled Draft";
  const excerpt = safeTrim(raw?.excerpt, 240) || "";
  const seoTitle = safeTrim(raw?.seo?.title, 140) || title;
  const seoDescription = safeTrim(raw?.seo?.description, 240) || excerpt || `Blog post about ${title}.`;
  const seoKeywords = asStringArray(raw?.seo?.keywords, 20, 60);

  const content = safeTrim(raw?.content, 100_000);

  if (!content) warnings.push("AI returned empty content. Using minimal fallback.");

  const slug = toSlug(title) || toSlug(topic) || "draft";

  return {
    title,
    slug,
    excerpt: excerpt || "Draft generated from provided inputs.",
    content: content || `# ${title}\n\nDraft content was not returned by the AI provider.`,
    seo: {
      title: seoTitle,
      description: seoDescription,
      keywords: seoKeywords,
    },
    warnings,
  };
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return jsonError(415, "Unsupported content type. Use application/json.");
  }

  let body: BlogDraftRequest | null = null;

  try {
    body = (await req.json()) as BlogDraftRequest;
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }

  const topic = safeTrim(body?.topic, 200);

  if (!topic) {
    return jsonError(400, "Missing required field: topic");
  }

  const normalized: BlogDraftRequest = {
    topic,
    goal: safeTrim(body?.goal, 240) || undefined,
    audience: safeTrim(body?.audience, 120) || undefined,
    tone: normalizeTone(body?.tone),
    language: safeTrim(body?.language, 40) || "English",
    seo: {
      titleHint: safeTrim(body?.seo?.titleHint, 140) || undefined,
      descriptionHint: safeTrim(body?.seo?.descriptionHint, 240) || undefined,
      keywords: asStringArray(body?.seo?.keywords, 20, 60),
    },
    outline: asStringArray(body?.outline, 24, 120),
    constraints: {
      maxWords:
        typeof body?.constraints?.maxWords === "number"
          ? Math.max(200, Math.min(4000, Math.floor(body.constraints.maxWords)))
          : 1200,
      includeToc: body?.constraints?.includeToc !== false,
      markdownOnly: body?.constraints?.markdownOnly !== false,
    },
  };

  const prompt = buildDraftPrompt(normalized);

  try {
    const text = await callLLM(prompt);
    const parsed = tryParseJson(text);

    if (!parsed) {
      const response: BlogDraftResponse = {
        title: "Draft generated (unparsed output)",
        slug: toSlug(topic) || "draft",
        excerpt: "AI returned output that could not be parsed as JSON.",
        content: `# ${topic}\n\n${text}`,
        seo: {
          title: topic,
          description: "AI-generated draft.",
          keywords: normalized.seo?.keywords ?? [],
        },
        warnings: ["Provider returned non-JSON output. Wrapped raw text into markdown."],
      };

      return NextResponse.json({ ok: true, ...response }, { status: 200 });
    }

    const response = normalizeResponse(parsed, topic);

    return NextResponse.json({ ok: true, ...response }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI draft generation failed";
    return jsonError(500, message);
  }
}

export async function GET() {
  return jsonError(405, "Method not allowed. Use POST.");
}
