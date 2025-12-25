// ============================================
// Types
// ============================================

import type { RagChunk, RagRetrievedChunk, RagSource } from "./types";


// ============================================
// General Helpers
// ============================================

export const clamp = (
  value: number,
  min: number,
  max: number
) => {
  return Math.max(min, Math.min(max, value));
};

export const safeTrim = (
  value?: string | null
) => {
  return (value ?? "").trim();
};

export const isNonEmptyString = (
  value: unknown
): value is string => {

  if (typeof value !== "string") return false;

  return value.trim().length > 0;
};


// ============================================
// Text Normalization
// ============================================

export const normalizeWhitespace = (
  input: string
) => {

  return input
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const truncateText = (
  input: string,
  maxChars: number
) => {

  const safeMax = clamp(maxChars, 10, 200000);

  if (input.length <= safeMax) return input;

  return input.slice(0, safeMax).trimEnd() + "…";
};


// ============================================
// Chunk ID Helpers
// ============================================

export const makeChunkId = (
  documentId: string,
  index: number
) => {
  return `${documentId}::chunk::${index}`;
};

export const parseChunkId = (
  chunkId: string
) => {

  const parts = chunkId.split("::chunk::");

  if (parts.length !== 2) {
    return {
      documentId: "",
      chunkIndex: -1,
    };
  }

  const documentId = parts[0];

  const chunkIndex = Number(parts[1]);

  return {
    documentId,
    chunkIndex: Number.isFinite(chunkIndex) ? chunkIndex : -1,
  };
};


// ============================================
// Context Formatting (Prompt-ready)
// ============================================

export type BuildContextOptions = {
  maxContextChars?: number;
  includeScores?: boolean;
};

export const buildContextFromRetrievedChunks = (
  chunks: RagRetrievedChunk[],
  options?: BuildContextOptions
) => {

  const maxContextChars =
    clamp(options?.maxContextChars ?? 5000, 500, 20000);

  const includeScores =
    options?.includeScores ?? true;

  if (!Array.isArray(chunks) || chunks.length === 0) {
    return {
      context: "",
      usedChunks: [],
    };
  }

  const sorted = [...chunks].sort((a, b) => {
    const sa = a.score ?? 0;
    const sb = b.score ?? 0;
    return sb - sa;
  });

  const used: RagRetrievedChunk[] = [];
  const parts: string[] = [];

  let total = 0;

  for (const ch of sorted) {

    const header: string[] = [];

    header.push(`Title: ${ch.title}`);

    if (ch.sourceType) header.push(`Type: ${ch.sourceType}`);

    if (ch.sourceUrl) header.push(`URL: ${ch.sourceUrl}`);

    header.push(`Chunk: ${ch.chunkIndex}`);

    if (includeScores && typeof ch.score === "number") {
      header.push(`Score: ${ch.score.toFixed(4)}`);
    }

    const block =
      `---\n${header.join(" | ")}\n\n${ch.content}\n`;

    if (total + block.length > maxContextChars) {
      break;
    }

    parts.push(block);
    used.push(ch);
    total += block.length;
  }

  return {
    context: parts.join("\n"),
    usedChunks: used,
  };
};


// ============================================
// Source Mapping (Chunks -> RAG Sources)
// ============================================

export const chunksToSources = (
  chunks: RagRetrievedChunk[]
): RagSource[] => {

  return (chunks ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    url: c.sourceUrl,
    type: c.sourceType,
    chunkIndex: c.chunkIndex,
    score: c.score,
    contentPreview: truncateText(c.content, 220),
  }));
};


// ============================================
// Deduplicate Helpers
// ============================================

export const dedupeChunksById = (
  chunks: RagChunk[]
) => {

  const map = new Map<string, RagChunk>();

  for (const ch of chunks) {
    if (!map.has(ch.id)) {
      map.set(ch.id, ch);
    }
  }

  return Array.from(map.values());
};

export const dedupeRetrievedChunksByBestScore = (
  chunks: RagRetrievedChunk[]
) => {

  const map = new Map<string, RagRetrievedChunk>();

  for (const ch of chunks) {

    const existing = map.get(ch.id);

    if (!existing) {
      map.set(ch.id, ch);
      continue;
    }

    const a = existing.score ?? 0;
    const b = ch.score ?? 0;

    if (b > a) {
      map.set(ch.id, ch);
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const sa = a.score ?? 0;
    const sb = b.score ?? 0;
    return sb - sa;
  });
};
