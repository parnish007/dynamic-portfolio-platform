// ============================================
// Core Result Types
// ============================================

export type Ok<T> = {
  ok: true;
  data: T;
};

export type Fail = {
  ok: false;
  error: string;
  details?: string;
};

export type Result<T> =
  | Ok<T>
  | Fail;


// ============================================
// Common DB Row Helpers
// ============================================

export type RowId = string;

export type Timestamp = string;

export type BaseRow = {
  id?: RowId;
  created_at?: Timestamp;
  updated_at?: Timestamp;
};


// ============================================
// Generic Query Options
// ============================================

export type QueryListOptions = {
  limit?: number;
  offset?: number;
  orderBy?: string;
  ascending?: boolean;
};

export type QueryById = {
  id: string;
};


// ============================================
// Realtime Types
// ============================================

export type RealtimeEventType =
  | "INSERT"
  | "UPDATE"
  | "DELETE";

export type RealtimePayload<T> = {
  eventType: RealtimeEventType;
  schema: string;
  table: string;

  new: T;
  old: T;

  commit_timestamp: string;
};


// ============================================
// Storage Types
// ============================================

export type StorageUploadResult = Result<{
  path: string;
}>;

export type StoragePublicUrlResult = Result<{
  url: string;
}>;

export type StorageRemoveResult = Result<{
  removed: number;
}>;


// ============================================
// Optional Domain Table Shapes (Future-friendly)
// Comment
// These are safe placeholders for later.
// You can replace them with generated Database types from Supabase.
// ============================================

export type AnalyticsEventRow = BaseRow & {
  event: string;
  path?: string | null;
  referrer?: string | null;

  section?: string | null;
  project_slug?: string | null;
  blog_slug?: string | null;

  device?: string | null;

  metadata?: Record<string, any> | null;
};

export type ContentNodeRow = BaseRow & {
  parent_id?: string | null;
  type: "folder" | "page" | "project" | "blog";
  slug: string;
  title: string;
  content?: Record<string, any> | null;
  order_index?: number | null;
  is_published?: boolean | null;
};

export type ChatMessageRow = BaseRow & {
  conversation_id: string;
  role: "user" | "assistant" | "admin";
  message: string;
  metadata?: Record<string, any> | null;
};
