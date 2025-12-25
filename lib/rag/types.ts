// ============================================
// Shared API Result
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
// Embeddings
// ============================================

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
// RAG Document / Chunk Types
// ============================================

export type RagSourceType =
  | "blog"
  | "project"
  | "page"
  | "custom";

export type RagIngestDocument = {
  id: string;
  title: string;
  sourceType?: RagSourceType;
  sourceUrl?: string;
  content: string;
  metadata?: Record<string, any>;
};

export type RagChunk = {
  id: string;
  documentId: string;
  title: string;
  sourceType?: RagSourceType;
  sourceUrl?: string;
  chunkIndex: number;
  content: string;
  metadata?: Record<string, any>;
};

export type RagChunkWithEmbedding = RagChunk & {
  embedding: EmbeddingVector;
};

export type RagRetrievedChunk = RagChunk & {
  score?: number;
};


// ============================================
// Retrieval / Vector Store
// ============================================

export type RetrievalOptions = {
  topK?: number;
  minScore?: number;
};

export type VectorStoreItem = {
  chunk: RagChunk;
  embedding: EmbeddingVector;
};

export type VectorQueryRequest = {
  embedding: EmbeddingVector;
  topK: number;
  minScore?: number;
  filters?: Record<string, any>;
};

export type VectorQueryResult = {
  matches: RagRetrievedChunk[];
};


// ============================================
// Query and Context Building
// ============================================

export type RagQueryRequest = {
  query: string;
  topK?: number;
  minScore?: number;
  maxContextChars?: number;
  filters?: Record<string, any>;
};

export type RagSource = {
  id: string;
  title: string;
  url?: string;
  type?: RagSourceType;
  chunkIndex?: number;
  score?: number;
  contentPreview?: string;
};

export type RagQueryResponse = {
  answer: string;
  sources: RagSource[];
};

export type RagIngestRequest = {
  documents: RagIngestDocument[];
  chunkSize?: number;
  chunkOverlap?: number;
};

export type RagIngestResponse = {
  ingested: number;
};

export type RagContextBuildOptions = {
  maxContextChars?: number;
};
