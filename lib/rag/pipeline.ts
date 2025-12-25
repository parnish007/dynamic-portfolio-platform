// ============================================
// Imports
// ============================================

import type { EmbeddingVector } from "./embeddings";

import { embedMany, embedText } from "./embeddings";


// ============================================
// Types
// ============================================

export type RagChunk = {
  id: string;
  documentId: string;
  title: string;
  sourceType?: "blog" | "project" | "page" | "custom";
  sourceUrl?: string;
  chunkIndex: number;
  content: string;
  metadata?: Record<string, any>;
};

export type RagChunkWithEmbedding = RagChunk & {
  embedding: EmbeddingVector;
};

export type RagIngestDocument = {
  id: string;
  title: string;
  sourceType?: "blog" | "project" | "page" | "custom";
  sourceUrl?: string;
  content: string;
  metadata?: Record<string, any>;
};

export type RagChunkingOptions = {
  chunkSize?: number;
  chunkOverlap?: number;
};

export type RagIngestOptions = RagChunkingOptions & {
  batchSize?: number;
};

export type RagIngestResult =
  | {
      ok: true;
      data: {
        chunks: RagChunkWithEmbedding[];
      };
    }
  | {
      ok: false;
      error: string;
    };

export type RagQueryOptions = {
  topK?: number;
  minScore?: number;
  maxContextChars?: number;
};

export type RagQueryPrepResult =
  | {
      ok: true;
      data: {
        queryEmbedding: EmbeddingVector;
        topK: number;
        minScore: number;
        maxContextChars: number;
      };
    }
  | {
      ok: false;
      error: string;
    };

export type RagRetrievedChunk = RagChunk & {
  score?: number;
};

export type RagContextBuildResult =
  | {
      ok: true;
      data: {
        context: string;
        usedChunks: RagRetrievedChunk[];
      };
    }
  | {
      ok: false;
      error: string;
    };


// ============================================
// Internal Helpers
// ============================================

const clamp = (
  value: number,
  min: number,
  max: number
) => {
  return Math.max(min, Math.min(max, value));
};

const makeChunkId = (
  documentId: string,
  index: number
) => {
  return `${documentId}::chunk::${index}`;
};

const normalizeWhitespace = (
  input: string
) => {
  return input
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};


// ============================================
// Simple Chunker (No external deps)
// ============================================

export const chunkText = (
  text: string,
  options?: RagChunkingOptions
) => {

  const chunkSize = clamp(options?.chunkSize ?? 900, 200, 4000);
  const chunkOverlap = clamp(options?.chunkOverlap ?? 150, 0, chunkSize - 1);

  const cleaned = normalizeWhitespace(text);

  if (!cleaned) return [];

  const chunks: string[] = [];

  let start = 0;

  while (start < cleaned.length) {

    const end = Math.min(start + chunkSize, cleaned.length);

    const slice = cleaned.slice(start, end);

    chunks.push(slice);

    if (end >= cleaned.length) break;

    start = end - chunkOverlap;
  }

  return chunks;
};


// ============================================
// Build Chunks from Documents
// ============================================

export const buildChunksFromDocuments = (
  docs: RagIngestDocument[],
  options?: RagChunkingOptions
): RagChunk[] => {

  const all: RagChunk[] = [];

  for (const doc of docs) {

    const pieces = chunkText(doc.content, options);

    pieces.forEach((content, idx) => {

      all.push({
        id: makeChunkId(doc.id, idx),
        documentId: doc.id,
        title: doc.title,

        sourceType: doc.sourceType,
        sourceUrl: doc.sourceUrl,

        chunkIndex: idx,

        content,

        metadata: doc.metadata,
      });
    });
  }

  return all;
};


// ============================================
// Ingest Pipeline (Chunk -> Embed -> Return)
// ============================================

export const ingestDocuments = async (
  docs: RagIngestDocument[],
  options?: RagIngestOptions
): Promise<RagIngestResult> => {

  if (!Array.isArray(docs) || docs.length === 0) {
    return { ok: false, error: "No documents provided for ingestion." };
  }

  const chunks = buildChunksFromDocuments(docs, options);

  if (chunks.length === 0) {
    return { ok: false, error: "No chunks generated from documents." };
  }

  const texts = chunks.map((c) => c.content);

  const embedRes = await embedMany({
    texts,
    batchSize: options?.batchSize ?? 10,
  });

  if (!embedRes.ok) {
    return { ok: false, error: embedRes.error };
  }

  const embeddings = embedRes.data.embeddings;

  if (embeddings.length !== chunks.length) {
    return { ok: false, error: "Embedding count mismatch." };
  }

  const merged: RagChunkWithEmbedding[] = chunks.map((c, i) => ({
    ...c,
    embedding: embeddings[i],
  }));

  return { ok: true, data: { chunks: merged } };
};


// ============================================
// Query Pipeline (Embed query -> Return retrieval params)
// ============================================

export const prepareQuery = async (
  query: string,
  options?: RagQueryOptions
): Promise<RagQueryPrepResult> => {

  if (!query || !query.trim()) {
    return { ok: false, error: "Query is required." };
  }

  const embedded = await embedText(query);

  if (!embedded.ok) {
    return { ok: false, error: embedded.error };
  }

  return {
    ok: true,
    data: {
      queryEmbedding: embedded.data.embedding,

      topK: clamp(options?.topK ?? 6, 1, 20),

      minScore: clamp(options?.minScore ?? 0.0, 0.0, 1.0),

      maxContextChars: clamp(options?.maxContextChars ?? 5000, 500, 20000),
    },
  };
};


// ============================================
// Build Context String (From Retrieved Chunks)
// ============================================

export const buildContextFromChunks = (
  retrieved: RagRetrievedChunk[],
  options?: RagQueryOptions
): RagContextBuildResult => {

  const maxContextChars =
    clamp(options?.maxContextChars ?? 5000, 500, 20000);

  if (!Array.isArray(retrieved) || retrieved.length === 0) {
    return { ok: true, data: { context: "", usedChunks: [] } };
  }

  // Comment
  // Sort high-score first when score exists.

  const sorted = [...retrieved].sort((a, b) => {
    const sa = a.score ?? 0;
    const sb = b.score ?? 0;
    return sb - sa;
  });

  const used: RagRetrievedChunk[] = [];
  const parts: string[] = [];

  let total = 0;

  for (const ch of sorted) {

    const headerParts: string[] = [];

    headerParts.push(`Title: ${ch.title}`);

    if (ch.sourceType) headerParts.push(`Type: ${ch.sourceType}`);

    if (ch.sourceUrl) headerParts.push(`URL: ${ch.sourceUrl}`);

    if (typeof ch.score === "number") headerParts.push(`Score: ${ch.score.toFixed(4)}`);

    headerParts.push(`Chunk: ${ch.chunkIndex}`);

    const block =
      `---\n${headerParts.join(" | ")}\n\n${ch.content}\n`;

    if (total + block.length > maxContextChars) {
      break;
    }

    parts.push(block);
    used.push(ch);
    total += block.length;
  }

  return {
    ok: true,
    data: {
      context: parts.join("\n"),
      usedChunks: used,
    },
  };
};
