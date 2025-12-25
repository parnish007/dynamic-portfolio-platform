import { NextResponse } from "next/server";

/**
 * README Draft Generator (Admin-triggered)
 * - Generates a Markdown README draft for a project
 * - Never publishes; returns draft only
 * - Safe-by-default when AI is not configured
 */

type ReadmeDraftRequest = {
  title: string;
  slug?: string;
  description?: string;
  techStack?: string[];
  links?: {
    label: string;
    url: string;
  }[];
  caseStudy?: {
    problem?: string;
    constraints?: string;
    data?: string;
    experiments?: string;
    results?: string;
    learnings?: string;
  };
  audience?: string;
  tone?: "neutral" | "professional" | "technical";
  badges?: boolean;
  maxLength?: number;
};

type ReadmeDraftResponse = {
  title: string;
  slug: string;
  content: string;
  warnings: string[];
};

function jsonError(status: number, message: string) {
  return NextResponse.json({ message }, { status });
}

function safeTrim(v: unknown, maxLen: number): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function asStringArray(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (out.length >= maxItems) break;
    const s = safeTrim(item, maxLen);
    if (s) out.push(s);
  }
  return out;
}

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeTone(v: unknown): "neutral" | "professional" | "technical" {
  if (v === "neutral" || v === "professional" || v === "technical") return v;
  return "professional";
}

function buildPrompt(body: ReadmeDraftRequest) {
  const title = body.title;
  const desc = body.description ?? "";
  const audience = body.audience ?? "general";
  const tone = body.tone ?? "professional";
  const tech = body.techStack?.join(", ") || "Not specified";
  const maxLength = body.maxLength ?? 1500;

  const links =
    body.links && body.links.length > 0
      ? body.links.map((l) => `- ${l.label}: ${l.url}`).join("\n")
      : "None provided";

  const cs = body.caseStudy ?? {};

  return `
You are an expert open-source maintainer and technical writer.

TASK:
Generate a high-quality README.md draft in Markdown for the following project.

PROJECT:
Title: ${title}
Description: ${desc}
Audience: ${audience}
Tone: ${tone}

TECH STACK:
${tech}

LINKS:
${links}

CASE STUDY:
Problem: ${cs.problem || "Not provided"}
Constraints: ${cs.constraints || "Not provided"}
Data: ${cs.data || "Not provided"}
Experiments: ${cs.experiments || "Not provided"}
Results: ${cs.results || "Not provided"}
Learnings: ${cs.learnings || "Not provided"}

CONSTRAINTS:
- Max length ~${maxLength} words
- Use clean Markdown
- Include clear section headings
- No secrets, no private keys
- Do NOT publish; draft only

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "content": "string (markdown)"
}
`.trim();
}

async function callLLM(prompt: string): Promise<string> {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = process.env.AI_API_BASE_URL?.trim();

  if (!apiKey || !baseUrl) {
    const fallback = {
      content: `# ${prompt.includes("Title:") ? "" : ""}

> README draft unavailable.

AI generation is not configured for this environment.

## What to do
- Set \`AI_API_KEY\`
- Set \`AI_API_BASE_URL\`
- Restart the server and retry

This endpoint only generates drafts and never publishes.`,
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

  if (!text) throw new Error("AI provider returned empty response");
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

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return jsonError(415, "Use application/json");
  }

  let body: ReadmeDraftRequest;
  try {
    body = (await req.json()) as ReadmeDraftRequest;
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const title = safeTrim(body?.title, 160);
  if (!title) return jsonError(400, "Missing required field: title");

  const normalized: ReadmeDraftRequest = {
    title,
    slug: toSlug(body.slug || title),
    description: safeTrim(body.description, 500) || undefined,
    techStack: asStringArray(body.techStack, 30, 60),
    links: Array.isArray(body.links)
      ? body.links
          .map((l) => ({
            label: safeTrim(l?.label, 60),
            url: safeTrim(l?.url, 500),
          }))
          .filter((l) => l.label && l.url)
      : [],
    caseStudy: {
      problem: safeTrim(body.caseStudy?.problem, 800) || undefined,
      constraints: safeTrim(body.caseStudy?.constraints, 800) || undefined,
      data: safeTrim(body.caseStudy?.data, 800) || undefined,
      experiments: safeTrim(body.caseStudy?.experiments, 1200) || undefined,
      results: safeTrim(body.caseStudy?.results, 800) || undefined,
      learnings: safeTrim(body.caseStudy?.learnings, 800) || undefined,
    },
    audience: safeTrim(body.audience, 120) || "general",
    tone: normalizeTone(body.tone),
    badges: body.badges === true,
    maxLength:
      typeof body.maxLength === "number"
        ? Math.max(300, Math.min(4000, Math.floor(body.maxLength)))
        : 1500,
  };

  const prompt = buildPrompt(normalized);
  const warnings: string[] = [];

  try {
    const text = await callLLM(prompt);
    const parsed = tryParseJson(text);

    if (!parsed?.content) {
      warnings.push("AI returned non-JSON or missing content. Wrapped raw output.");
      const response: ReadmeDraftResponse = {
        title: normalized.title,
        slug: normalized.slug!,
        content: `# ${normalized.title}\n\n${text}`,
        warnings,
      };
      return NextResponse.json(response, { status: 200 });
    }

    const response: ReadmeDraftResponse = {
      title: normalized.title,
      slug: normalized.slug!,
      content: safeTrim(parsed.content, 200_000) || `# ${normalized.title}`,
      warnings,
    };

    if (!process.env.AI_API_KEY || !process.env.AI_API_BASE_URL) {
      warnings.push("AI is not fully configured; returned fallback content.");
    }

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "README generation failed";
    return jsonError(500, message);
  }
}

export async function GET() {
  return jsonError(405, "Method not allowed. Use POST.");
}
