// types/media.ts

export type MediaProvider = "cloudinary" | "supabase";

export type MediaKind = "image" | "video" | "raw";

export type MediaMeta = {
  alt?: string;
  caption?: string;

  // Optional: link media usage to content
  usedBy?: {
    type: "section" | "project" | "blog" | "settings";
    id: string;
    field?: string;
  };

  // Optional extra metadata from admin UI
  [key: string]: unknown;
};

export type MediaItem = {
  id: string;

  provider: MediaProvider;

  kind: MediaKind;

  // Human friendly name shown in admin
  name: string;

  // Original file details
  originalName: string | null;
  mime: string | null;
  size: number | null;

  // Dimensions (images/videos)
  width: number | null;
  height: number | null;

  // Public URLs (prefer secureUrl)
  url: string | null;
  secureUrl: string | null;

  // Provider-specific identifiers
  publicId: string | null;

  // For Supabase storage fallback
  bucket: string | null;
  path: string | null;

  // Optional transformations / variants
  variants?: Array<{
    label: string;
    url: string;
    secureUrl?: string;
    width?: number;
    height?: number;
    format?: string;
  }> | null;

  // Timestamps
  createdAt: string | null;
  updatedAt: string | null;

  // Extra flexible metadata
  meta: MediaMeta | null;
};

export type MediaListResponse = {
  ok: true;
  provider: MediaProvider;
  page: { limit: number; offset: number; count: number; nextOffset?: number | null };
  items: MediaItem[];
};

export type MediaUploadResponse = {
  ok: true;
  provider: MediaProvider;
  file: MediaItem;
};

export type MediaDeleteResponse = {
  ok: true;
  provider: MediaProvider;
  deleted: { id?: string; publicId?: string; path?: string } | Array<string>;
};

export type MediaApiError = {
  ok: false;
  error: string;
  details?: string;
};
