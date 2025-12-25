// ============================================
// Types
// ============================================

export type ApiOk<T> = {
  ok: true;
  data: T;
};

export type ApiFail = {
  ok: false;
  error: string;
};

export type ApiResult<T> =
  | ApiOk<T>
  | ApiFail;


// ============================================
// RAG Types
// ============================================

export type RagSource = {
  id: string;
  title: string;
  url?: string;
  type?: "blog" | "project" | "page" | "custom";
  chunkIndex?: number;
  score?: number;
  contentPreview?: string;
};

export type RagQueryRequest = {
  query: string;
  topK?: number;
  minScore?: number;
  filters?: Record<string, any>;
};

export type RagQueryResponse = {
  answer: string;
  sources: RagSource[];
};

export type RagIngestDocument = {
  id?: string;
  title: string;
  sourceType?: "blog" | "project" | "page" | "custom";
  sourceUrl?: string;
  content: string;
  metadata?: Record<string, any>;
};

export type RagIngestRequest = {
  documents: RagIngestDocument[];
  chunkSize?: number;
  chunkOverlap?: number;
};

export type RagIngestResponse = {
  ingested: number;
};


// ============================================
// Fetch Helpers
// ============================================

const safeJson = async (res: Response) => {

  try {
    return await res.json();
  } catch {
    return null;
  }
};

const postJson = async <T>(
  url: string,
  body: any
): Promise<ApiResult<T>> => {

  try {

    const res = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(body),
    });

    const json = await safeJson(res);

    if (!res.ok) {
      const message =
        (json && (json.error || json.message)) ||
        `Request failed (${res.status})`;

      return { ok: false, error: String(message) };
    }

    // Comment
    // Support either { ok: true, data: ... } or raw JSON payload.

    if (json && typeof json === "object" && "data" in json) {
      return { ok: true, data: (json as any).data as T };
    }

    return { ok: true, data: json as T };

  } catch (err) {

    const message =
      err instanceof Error
        ? err.message
        : "Network error";

    return { ok: false, error: message };
  }
};


// ============================================
// Embeddings (Uses existing endpoint)
// ============================================

export type EmbedTextResponse = {
  embedding: number[];
};

export const embedText = async (
  text: string
): Promise<ApiResult<EmbedTextResponse>> => {

  if (!text || !text.trim()) {
    return { ok: false, error: "Text is required for embeddings." };
  }

  // Comment
  // This uses your already-created route:
  // POST /api/ai/embeddings
  // Expected response: { embedding: number[] } OR { ok:true, data:{ embedding: [...] } }

  return await postJson<EmbedTextResponse>(
    "/api/ai/embeddings",
    { text }
  );
};


// ============================================
// RAG Query (Planned endpoint)
// ============================================

export const ragQuery = async (
  req: RagQueryRequest
): Promise<ApiResult<RagQueryResponse>> => {

  if (!req?.query || !req.query.trim()) {
    return { ok: false, error: "Query is required." };
  }

  // Comment
  // Planned route:
  // POST /api/rag/query
  // The server should return:
  // { answer: string, sources: RagSource[] }

  return await postJson<RagQueryResponse>(
    "/api/rag/query",
    req
  );
};


// ============================================
// RAG Ingest (Planned endpoint)
// ============================================

export const ragIngest = async (
  req: RagIngestRequest
): Promise<ApiResult<RagIngestResponse>> => {

  const docs = req?.documents ?? [];

  if (!Array.isArray(docs) || docs.length === 0) {
    return { ok: false, error: "At least one document is required to ingest." };
  }

  // Comment
  // Planned route:
  // POST /api/rag/ingest
  // The server should chunk + embed + upsert to vector store.

  return await postJson<RagIngestResponse>(
    "/api/rag/ingest",
    req
  );
};
