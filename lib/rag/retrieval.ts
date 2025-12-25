// ============================================
// Imports
// ============================================

import type { EmbeddingVector } from "./embeddings";

import type { RagChunk, RagRetrievedChunk } from "./pipeline";


// ============================================
// Types
// ============================================

export type RetrievalOptions = {
  topK?: number;
  minScore?: number;
};

export type VectorStoreItem = {
  chunk: RagChunk;
  embedding: EmbeddingVector;
};

export type RetrievalResult = RagRetrievedChunk[];


// ============================================
// Math Utilities
// ============================================

export const dot = (
  a: EmbeddingVector,
  b: EmbeddingVector
) => {

  const n = Math.min(a.length, b.length);

  let sum = 0;

  for (let i = 0; i < n; i++) {
    sum += a[i] * b[i];
  }

  return sum;
};

export const norm = (
  v: EmbeddingVector
) => {

  let sum = 0;

  for (let i = 0; i < v.length; i++) {
    sum += v[i] * v[i];
  }

  return Math.sqrt(sum);
};

export const cosineSimilarity = (
  a: EmbeddingVector,
  b: EmbeddingVector
) => {

  const denom = norm(a) * norm(b);

  if (denom === 0) return 0;

  return dot(a, b) / denom;
};


// ============================================
// In-memory Retrieval (Rank + Filter)
// ============================================

export const retrieveTopKFromMemory = (
  queryEmbedding: EmbeddingVector,
  items: VectorStoreItem[],
  options?: RetrievalOptions
): RetrievalResult => {

  const topK = Math.max(1, Math.min(options?.topK ?? 6, 50));

  const minScore = Math.max(0, Math.min(options?.minScore ?? 0, 1));

  const scored: RagRetrievedChunk[] = items.map((item) => {

    const score = cosineSimilarity(queryEmbedding, item.embedding);

    return {
      ...item.chunk,
      score,
    };
  });

  const filtered = scored.filter((c) => (c.score ?? 0) >= minScore);

  filtered.sort((a, b) => {
    const sa = a.score ?? 0;
    const sb = b.score ?? 0;
    return sb - sa;
  });

  return filtered.slice(0, topK);
};


// ============================================
// Utility: Merge Results (Deduplicate by Chunk ID)
// ============================================

export const mergeRetrievalResults = (
  lists: RetrievalResult[]
): RetrievalResult => {

  const map = new Map<string, RagRetrievedChunk>();

  for (const list of lists) {

    for (const item of list) {

      const existing = map.get(item.id);

      if (!existing) {
        map.set(item.id, item);
        continue;
      }

      const existingScore = existing.score ?? 0;
      const newScore = item.score ?? 0;

      if (newScore > existingScore) {
        map.set(item.id, item);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const sa = a.score ?? 0;
    const sb = b.score ?? 0;
    return sb - sa;
  });
};
