import { NextResponse } from "next/server";

type IngestSource = "sections" | "projects" | "blogs" | "resume" | "all";

type EmbeddingsIngestRequest = {
  source: IngestSource;
  fullReindex?: boolean;
  /**
   * Optional filters for partial ingestion:
   * - ids: re-embed only specific items
   * - slugs: re-embed only specific items
   */
  ids?: string[];
  slugs?: string[];
  /**
   * Chunking guidance (server validates bounds)
   */
  chunk?: {
    maxChars?: number;
    overlapChars?: number;
  };
};

type EmbeddingsIngestResponse = {
  ok: true;
  source: IngestSource;
  fullReindex: boolean;
  processed: number;
  embedded: number;
  skipped: number;
  warnings: string[];
  timingsMs: {
    total: number;
    fetch: number;
    chunk: number;
    embed: number;
  };
};

function jsonError(status: number, message: string) {
  return NextResponse.json(
    { message },
    { status }
  );
}

function safeTrim(v: unknown, maxLen: number): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) {
    return "";
  }
  if (s.length > maxLen) {
    return s.slice(0, maxLen);
  }

  return s;
}

function asStringArray(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const out: string[] = [];
  for (const item of value) {
    if (out.length >= maxItems) {
      break;
    }
    const s = safeTrim(item, maxLen);
    if (s) {
      out.push(s);
    }
  }

  return out;
}

function normalizeSource(v: unknown): IngestSource | null {
  if (
    v === "sections" ||
    v === "projects" ||
    v === "blogs" ||
    v === "resume" ||
    v === "all"
  ) {
    return v;
  }
  return null;
}

type RawDoc = {
  id: string;
  slug?: string;
  title: string;
  body: string;
  type: "section" | "project" | "blog" | "resume";
  updatedAt?: string;
};

type ChunkDoc = {
  docId: string;
  chunkId: string;
  type: RawDoc["type"];
  title: string;
  text: string;
  slug?: string;
  updatedAt?: string;
};

function chunkText(
  text: string,
  maxChars: number,
  overlapChars: number
): string[] {
  const t = text.trim();
  if (!t) {
    return [];
  }

  if (t.length <= maxChars) {
    return [t];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < t.length) {
    const end = Math.min(start + maxChars, t.length);
    const slice = t.slice(start, end).trim();

    if (slice) {
      chunks.push(slice);
    }

    if (end >= t.length) {
      break;
    }

    start = Math.max(0, end - overlapChars);
  }

  return chunks;
}

async function fetchDocsForIngestion(
  source: IngestSource,
  ids: string[],
  slugs: string[]
): Promise<RawDoc[]> {
  /**
   * Placeholder data source.
   * Replace later with:
   * - Supabase queries
   * - services that return published/visible content only
   *
   * MUST remain data-driven and admin-controlled.
   */
  void source;
  void ids;
  void slugs;

  return [];
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  /**
   * Provider-agnostic embedding adapter.
   * Requires:
   * - AI_API_KEY
   * - AI_EMBEDDINGS_BASE_URL
   *
   * Expected request:
   * POST { input: string[] }
   * -> { embeddings: number[][] }
   */
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) {
    /**
     * Safe-by-default: return deterministic zero vectors.
     * This keeps the endpoint functional without secrets.
     */
    return texts.map(() => [0]);
  }

  const baseUrl = process.env.AI_EMBEDDINGS_BASE_URL?.trim();

  if (!baseUrl) {
    return texts.map(() => [0]);
  }

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input: texts }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Embeddings provider error: ${res.status} ${body}`);
  }

  const data = await res.json().catch(() => null);
  const embeddings = Array.isArray(data?.embeddings) ? data.embeddings : null;

  if (!embeddings) {
    throw new Error("Embeddings provider returned invalid response");
  }

  return embeddings as number[][];
}

async function persistEmbeddings(chunks: ChunkDoc[], vectors: number[][]) {
  /**
   * Placeholder persistence layer.
   * Later you will store:
   * - chunk text
   * - vector
   * - metadata (docId, type, slug, updatedAt, etc.)
   * in Supabase Postgres / pgvector or your chosen vector store.
   */
  void chunks;
  void vectors;

  return;
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    return jsonError(
      415,
      "Unsupported content type. Use application/json."
    );
  }

  let body: EmbeddingsIngestRequest | null = null;

  try {
    body = (await req.json()) as EmbeddingsIngestRequest;
  } catch {
    return jsonError(
      400,
      "Invalid JSON body."
    );
  }

  const source = normalizeSource(body?.source);

  if (!source) {
    return jsonError(
      400,
      "Invalid or missing field: source (sections|projects|blogs|resume|all)"
    );
  }

  const ids = asStringArray(body?.ids, 200, 120);
  const slugs = asStringArray(body?.slugs, 200, 160);

  const fullReindex = body?.fullReindex === true;

  const maxCharsRaw = body?.chunk?.maxChars;
  const overlapCharsRaw = body?.chunk?.overlapChars;

  const maxChars = typeof maxCharsRaw === "number"
    ? Math.max(400, Math.min(5000, Math.floor(maxCharsRaw)))
    : 1200;

  const overlapChars = typeof overlapCharsRaw === "number"
    ? Math.max(0, Math.min(800, Math.floor(overlapCharsRaw)))
    : 120;

  const warnings: string[] = [];

  const t0 = Date.now();

  const tFetch0 = Date.now();
  const docs = await fetchDocsForIngestion(source, ids, slugs);
  const tFetch1 = Date.now();

  const tChunk0 = Date.now();

  const chunks: ChunkDoc[] = [];
  for (const doc of docs) {
    const rawText = `${doc.title}\n\n${doc.body}`.trim();
    const pieces = chunkText(rawText, maxChars, overlapChars);

    if (pieces.length === 0) {
      continue;
    }

    for (let i = 0; i < pieces.length; i += 1) {
      const piece = pieces[i] ?? "";
      const chunkId = `${doc.id}:${i}`;

      chunks.push({
        docId: doc.id,
        chunkId,
        type: doc.type,
        title: doc.title,
        text: piece,
        slug: doc.slug,
        updatedAt: doc.updatedAt,
      });
    }
  }

  const tChunk1 = Date.now();

  const processed = docs.length;

  if (processed === 0) {
    warnings.push("No documents found for ingestion (placeholder data source returned empty).");
  }

  if (chunks.length === 0) {
    warnings.push("No chunks produced. Check input data or chunking settings.");
  }

  const tEmbed0 = Date.now();

  let embedded = 0;
  let skipped = 0;

  /**
   * Embed in small batches to avoid provider limits.
   */
  const BATCH_SIZE = 32;

  try {
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);

      if (batch.length === 0) {
        continue;
      }

      const texts = batch.map((c) => c.text);

      if (texts.length === 0) {
        skipped += batch.length;
        continue;
      }

      const vectors = await embedBatch(texts);

      if (!Array.isArray(vectors) || vectors.length !== texts.length) {
        throw new Error("Embedding provider returned mismatched vector count");
      }

      await persistEmbeddings(batch, vectors);

      embedded += batch.length;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Embeddings ingestion failed";
    return jsonError(
      500,
      message
    );
  }

  const tEmbed1 = Date.now();

  if (!process.env.AI_API_KEY) {
    warnings.push("AI_API_KEY is not set. Returned zero-vector embeddings as fallback.");
  }

  if (!process.env.AI_EMBEDDINGS_BASE_URL) {
    warnings.push("AI_EMBEDDINGS_BASE_URL is not set. Returned zero-vector embeddings as fallback.");
  }

  if (fullReindex) {
    warnings.push("fullReindex=true requested. Real deletion/rebuild will be implemented when DB storage is wired.");
  }

  const t1 = Date.now();

  const response: EmbeddingsIngestResponse = {
    ok: true,
    source,
    fullReindex,
    processed,
    embedded,
    skipped,
    warnings,
    timingsMs: {
      total: t1 - t0,
      fetch: tFetch1 - tFetch0,
      chunk: tChunk1 - tChunk0,
      embed: tEmbed1 - tEmbed0,
    },
  };

  return NextResponse.json(response, { status: 200 });
}

export async function GET() {
  return jsonError(
    405,
    "Method not allowed. Use POST."
  );
}
