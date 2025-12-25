// app/api/ai/readme/route.ts

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
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeTone(v: unknown): "neutral" | "professional" | "technical" {
  if (v === "neutral" || v === "professional" || v === "technical") return v;
  return "professional";
}

function isProbablyUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function buildPrompt(body: ReadmeDraftRequest) {
  const title = body.title;
  const desc = body.description ?? "";
  const audience = body.audience ?? "general";
  const tone = body.tone ?? "professional";
  const tech = (body.techStack ?? []).join(", ") || "Not specified";
  const maxLength = body.maxLength ?? 1500;

  const links =
    body.links && body.links.length > 0
      ? body.links.map((l) => `- ${l.label}: ${l.url}`).join("\n")
      : "None provided";

  const cs = body.caseStudy ?? {};

  const badgesLine = body.badges === true
    ? "Include a small badges row at the top (build/status/license/tech). If unknown, use generic placeholders."
    : "Do NOT include badges.";

  return `
You are an expert open-source maintainer and technical writer.

TASK:
Generate a high-quality README.md draft in Markdown for the following project.

PROJECT:
Title: ${title}
Description: ${desc || "Not provided"}
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
- Max length ~${maxLength} words (approximate)
- Use clean Markdown
- Include clear section headings
- ${badgesLine}
- No secrets, no private keys
- Do NOT publish; draft only

REQUIRED SECTIONS (in this order):
1) Title (+ optional badges)
2) Short description
3) Table of Contents
4) Overview
5) Features
6) Tech Stack
7) Getting Started
8) Usage
9) Project Structure (high level)
10) Case Study (if provided)
11) Links
12) Roadmap
13) License
14) Contact / Author

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
    throw new Error("AI is not configured (missing AI_API_KEY and/or AI_API_BASE_URL)");
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

function buildDeterministicFallback(normalized: ReadmeDraftRequest): string {
  const title = normalized.title;
  const description = normalized.description ?? "README draft unavailable (AI not configured).";
  const tech = normalized.techStack && normalized.techStack.length > 0 ? normalized.techStack : [];
  const links = normalized.links && normalized.links.length > 0 ? normalized.links : [];

  const badges = normalized.badges
    ? `![status](https://img.shields.io/badge/status-draft-zinc)
![license](https://img.shields.io/badge/license-MIT-zinc)
![stack](https://img.shields.io/badge/stack-${encodeURIComponent((tech.slice(0, 3).join("-") || "web"))}-zinc)`
    : "";

  const cs = normalized.caseStudy ?? {};

  return `
# ${title}
${badges ? `\n${badges}\n` : ""}

${description}

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Case Study](#case-study)
- [Links](#links)
- [Roadmap](#roadmap)
- [License](#license)
- [Contact / Author](#contact--author)

## Overview
This README is a **draft**. AI generation is currently unavailable because the AI environment variables are not configured.

## Features
- Draft placeholder (enable AI for richer output)
- Clean structure and sections ready for expansion

## Tech Stack
${tech.length ? tech.map((t) => `- ${t}`).join("\n") : "- Not specified"}

## Getting Started
1. Clone the repository
2. Install dependencies
3. Run the app locally

## Usage
Describe how to run / test / deploy this project here.

## Project Structure
- \`app/\` — Next.js App Router pages/routes
- \`components/\` — UI components
- \`lib/\` — core utilities and services
- \`services/\` — domain services (data fetching, business logic)

## Case Study
${cs.problem ? `**Problem:** ${cs.problem}\n` : "**Problem:** Not provided\n"}
${cs.constraints ? `**Constraints:** ${cs.constraints}\n` : ""}
${cs.data ? `**Data:** ${cs.data}\n` : ""}
${cs.experiments ? `**Experiments:** ${cs.experiments}\n` : ""}
${cs.results ? `**Results:** ${cs.results}\n` : ""}
${cs.learnings ? `**Learnings:** ${cs.learnings}\n` : ""}

## Links
${links.length ? links.map((l) => `- ${l.label}: ${l.url}`).join("\n") : "- None"}

## Roadmap
- [ ] Replace fallback with AI-generated README by setting env vars
- [ ] Add screenshots / demo GIFs
- [ ] Add setup + deployment instructions

## License
MIT (or update to your preferred license)

## Contact / Author
Add your name + contact links here.
`.trim();
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
    slug: toSlug(safeTrim(body?.slug, 200) || title),
    description: safeTrim(body?.description, 600) || undefined,
    techStack: asStringArray(body?.techStack, 40, 60),
    links: Array.isArray(body?.links)
      ? body.links
          .map((l) => ({
            label: safeTrim(l?.label, 60),
            url: safeTrim(l?.url, 800),
          }))
          .filter((l) => l.label && l.url && isProbablyUrl(l.url))
      : [],
    caseStudy: {
      problem: safeTrim(body?.caseStudy?.problem, 900) || undefined,
      constraints: safeTrim(body?.caseStudy?.constraints, 900) || undefined,
      data: safeTrim(body?.caseStudy?.data, 900) || undefined,
      experiments: safeTrim(body?.caseStudy?.experiments, 1400) || undefined,
      results: safeTrim(body?.caseStudy?.results, 900) || undefined,
      learnings: safeTrim(body?.caseStudy?.learnings, 900) || undefined,
    },
    audience: safeTrim(body?.audience, 120) || "general",
    tone: normalizeTone(body?.tone),
    badges: body?.badges === true,
    maxLength:
      typeof body?.maxLength === "number"
        ? Math.max(300, Math.min(4000, Math.floor(body.maxLength)))
        : 1500,
  };

  const warnings: string[] = [];
  const hasAI = Boolean(process.env.AI_API_KEY && process.env.AI_API_BASE_URL);

  if (!hasAI) {
    warnings.push("AI is not configured (missing AI_API_KEY and/or AI_API_BASE_URL). Returned deterministic fallback.");
    const response: ReadmeDraftResponse = {
      title: normalized.title,
      slug: normalized.slug || toSlug(normalized.title) || "draft",
      content: buildDeterministicFallback(normalized),
      warnings,
    };
    return NextResponse.json(response, { status: 200 });
  }

  const prompt = buildPrompt(normalized);

  try {
    const text = await callLLM(prompt);
    const parsed = tryParseJson(text);

    if (!parsed?.content || typeof parsed.content !== "string") {
      warnings.push("AI returned non-JSON or missing content. Wrapped raw output into markdown.");
      const response: ReadmeDraftResponse = {
        title: normalized.title,
        slug: normalized.slug || toSlug(normalized.title) || "draft",
        content: `# ${normalized.title}\n\n${text}`,
        warnings,
      };
      return NextResponse.json(response, { status: 200 });
    }

    const response: ReadmeDraftResponse = {
      title: normalized.title,
      slug: normalized.slug || toSlug(normalized.title) || "draft",
      content: safeTrim(parsed.content, 200_000) || `# ${normalized.title}`,
      warnings,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "README generation failed";
    return jsonError(500, message);
  }
}

export async function GET() {
  return jsonError(405, "Method not allowed. Use POST.");
}
