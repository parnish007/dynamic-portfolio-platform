// ============================================
// Imports
// ============================================

import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";


// ============================================
// Result Types
// ============================================

export type DbOk<T> = {
  ok: true;
  data: T;
};

export type DbFail = {
  ok: false;
  error: string;
  details?: string;
};

export type DbResult<T> =
  | DbOk<T>
  | DbFail;


// ============================================
// Error Helpers
// ============================================

const formatPostgrestError = (
  error: PostgrestError | null
) => {

  if (!error) {
    return {
      message: "Unknown database error.",
      details: undefined,
    };
  }

  const message = error.message || "Database error.";

  const details =
    error.details ||
    error.hint ||
    `code=${error.code ?? "unknown"}`;

  return { message, details };
};

const unknownErrorMessage = (
  err: unknown
) => {

  if (err instanceof Error) return err.message;

  return "Unknown database error.";
};


// ============================================
// Core Helpers
// ============================================

export const selectOne = async <T>(
  query: Promise<{ data: T | null; error: PostgrestError | null }>
): Promise<DbResult<T | null>> => {

  try {

    const { data, error } = await query;

    if (error) {
      const formatted = formatPostgrestError(error);
      return {
        ok: false,
        error: formatted.message,
        details: formatted.details,
      };
    }

    return { ok: true, data: data ?? null };

  } catch (err) {

    return { ok: false, error: unknownErrorMessage(err) };
  }
};

export const selectMany = async <T>(
  query: Promise<{ data: T[] | null; error: PostgrestError | null }>
): Promise<DbResult<T[]>> => {

  try {

    const { data, error } = await query;

    if (error) {
      const formatted = formatPostgrestError(error);
      return {
        ok: false,
        error: formatted.message,
        details: formatted.details,
      };
    }

    return { ok: true, data: data ?? [] };

  } catch (err) {

    return { ok: false, error: unknownErrorMessage(err) };
  }
};

export const insertOne = async <T>(
  query: Promise<{ data: T | null; error: PostgrestError | null }>
): Promise<DbResult<T>> => {

  try {

    const { data, error } = await query;

    if (error) {
      const formatted = formatPostgrestError(error);
      return {
        ok: false,
        error: formatted.message,
        details: formatted.details,
      };
    }

    if (!data) {
      return {
        ok: false,
        error: "Insert succeeded but returned no data.",
      };
    }

    return { ok: true, data };

  } catch (err) {

    return { ok: false, error: unknownErrorMessage(err) };
  }
};

export const upsertMany = async <T>(
  query: Promise<{ data: T[] | null; error: PostgrestError | null }>
): Promise<DbResult<T[]>> => {

  try {

    const { data, error } = await query;

    if (error) {
      const formatted = formatPostgrestError(error);
      return {
        ok: false,
        error: formatted.message,
        details: formatted.details,
      };
    }

    return { ok: true, data: data ?? [] };

  } catch (err) {

    return { ok: false, error: unknownErrorMessage(err) };
  }
};


// ============================================
// Convenience: Run a Query Function
// ============================================

export const runDb = async <T>(
  fn: (client: SupabaseClient) => Promise<DbResult<T>>,
  client: SupabaseClient
): Promise<DbResult<T>> => {

  try {

    return await fn(client);

  } catch (err) {

    return { ok: false, error: unknownErrorMessage(err) };
  }
};
