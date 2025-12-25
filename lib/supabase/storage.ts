// ============================================
// Imports
// ============================================

import { supabaseClient } from "@/lib/supabase/client";


// ============================================
// Types
// ============================================

export type StorageOk<T> = {
  ok: true;
  data: T;
};

export type StorageFail = {
  ok: false;
  error: string;
};

export type StorageResult<T> =
  | StorageOk<T>
  | StorageFail;

export type UploadFileInput = {
  bucket: string;
  path: string;

  file: File;

  cacheControl?: string;
  upsert?: boolean;
  contentType?: string;
};

export type UploadBase64Input = {
  bucket: string;
  path: string;

  base64: string;

  contentType?: string;

  cacheControl?: string;
  upsert?: boolean;
};


// ============================================
// Helpers
// ============================================

const normalizeError = (
  error: any
) => {

  if (!error) return "Unknown storage error.";

  if (typeof error === "string") return error;

  if (typeof error?.message === "string") return error.message;

  return "Storage error.";
};

const base64ToBlob = (
  base64: string,
  contentType: string
) => {

  const cleaned = base64.includes(",")
    ? base64.split(",")[1]
    : base64;

  const binary = atob(cleaned);

  const len = binary.length;

  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: contentType });
};


// ============================================
// Upload File (Browser)
// ============================================

export const uploadFile = async (
  input: UploadFileInput
): Promise<StorageResult<{ path: string }>> => {

  try {

    const supabase = supabaseClient();

    const { error } = await supabase.storage
      .from(input.bucket)
      .upload(input.path, input.file, {
        cacheControl: input.cacheControl ?? "3600",
        upsert: input.upsert ?? true,
        contentType: input.contentType ?? input.file.type,
      });

    if (error) {
      return { ok: false, error: normalizeError(error) };
    }

    return { ok: true, data: { path: input.path } };

  } catch (err) {

    return { ok: false, error: normalizeError(err) };
  }
};


// ============================================
// Upload Base64 (Browser)
// ============================================

export const uploadBase64 = async (
  input: UploadBase64Input
): Promise<StorageResult<{ path: string }>> => {

  try {

    const supabase = supabaseClient();

    const contentType = input.contentType ?? "application/octet-stream";

    const blob = base64ToBlob(input.base64, contentType);

    const { error } = await supabase.storage
      .from(input.bucket)
      .upload(input.path, blob, {
        cacheControl: input.cacheControl ?? "3600",
        upsert: input.upsert ?? true,
        contentType,
      });

    if (error) {
      return { ok: false, error: normalizeError(error) };
    }

    return { ok: true, data: { path: input.path } };

  } catch (err) {

    return { ok: false, error: normalizeError(err) };
  }
};


// ============================================
// Get Public URL
// ============================================

export const getPublicUrl = (
  bucket: string,
  path: string
): StorageResult<{ url: string }> => {

  try {

    const supabase = supabaseClient();

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    const url = data?.publicUrl;

    if (!url) {
      return { ok: false, error: "Unable to generate public URL." };
    }

    return { ok: true, data: { url } };

  } catch (err) {

    return { ok: false, error: normalizeError(err) };
  }
};


// ============================================
// Remove File(s)
// ============================================

export const removeFiles = async (
  bucket: string,
  paths: string[]
): Promise<StorageResult<{ removed: number }>> => {

  try {

    if (!Array.isArray(paths) || paths.length === 0) {
      return { ok: true, data: { removed: 0 } };
    }

    const supabase = supabaseClient();

    const { error } = await supabase.storage
      .from(bucket)
      .remove(paths);

    if (error) {
      return { ok: false, error: normalizeError(error) };
    }

    return { ok: true, data: { removed: paths.length } };

  } catch (err) {

    return { ok: false, error: normalizeError(err) };
  }
};
