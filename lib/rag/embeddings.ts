// ============================================
// Types
// ============================================

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type EmbeddingVector = number[];

export type EmbedTextRequest = {
  text: string;
};

export type EmbedTextResponse = {
  embedding: EmbeddingVector;
};

export type EmbedManyRequest = {
  texts: string[];
  batchSize?: number;
};

export type EmbedManyResponse = {
  embeddings: EmbeddingVector[];
};


// ============================================
// Helpers
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
    // Support either { embedding: [...] } OR { ok:true, data:{ embedding: [...] } }

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
// Embed One Text
// ============================================

export const embedText = async (
  text: string
): Promise<ApiResult<EmbedTextResponse>> => {

  if (!text || !text.trim()) {
    return { ok: false, error: "Text is required for embeddings." };
  }

  // Comment
  // Uses your existing route:
  // POST /api/ai/embeddings

  return await postJson<EmbedTextResponse>(
    "/api/ai/embeddings",
    { text } satisfies EmbedTextRequest
  );
};


// ============================================
// Embed Many (Batching)
// ============================================

export const embedMany = async (
  req: EmbedManyRequest
): Promise<ApiResult<EmbedManyResponse>> => {

  const texts = req.texts ?? [];

  if (!Array.isArray(texts) || texts.length === 0) {
    return { ok: false, error: "texts[] is required." };
  }

  const batchSize = Math.max(1, Math.min(req.batchSize ?? 10, 50));

  const embeddings: EmbeddingVector[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {

    const batch = texts.slice(i, i + batchSize);

    // Comment
    // If your /api/ai/embeddings only supports single text,
    // we call it multiple times.
    // Later you can add /api/ai/embeddings/batch for speed.

    for (const t of batch) {

      const one = await embedText(t);

      if (!one.ok) {
        return { ok: false, error: one.error };
      }

      embeddings.push(one.data.embedding);
    }
  }

  return { ok: true, data: { embeddings } };
};
