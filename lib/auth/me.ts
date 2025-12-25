// ============================================
// Imports
// ============================================

import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import type { User, Session } from "@supabase/supabase-js";


// ============================================
// Types
// ============================================

export type MeResult =
  | { ok: true; user: User }
  | { ok: false; user: null; error: string };

export type SessionResult =
  | { ok: true; session: Session }
  | { ok: true; session: null }
  | { ok: false; session: null; error: string };


// ============================================
// Helper: Create Supabase Server Client
// ============================================

const createSupabaseServerClient = () => {

  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name, options) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
};


// ============================================
// Get Current User
// ============================================

export const getMe = async (): Promise<User | null> => {

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.auth.getUser();

  if (error) return null;

  return data.user ?? null;
};


// ============================================
// Get Current Session
// ============================================

export const getSession = async (): Promise<SessionResult> => {

  try {

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return { ok: false, session: null, error: "Supabase env vars missing." };
    }

    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      return { ok: false, session: null, error: error.message };
    }

    return { ok: true, session: data.session ?? null };

  } catch (err) {

    const message =
      err instanceof Error
        ? err.message
        : "Unknown error while fetching session.";

    return { ok: false, session: null, error: message };
  }
};


// ============================================
// Require Admin (Guard Helper)
// ============================================

export type RequireAdminResult =
  | { ok: true; user: User }
  | { ok: false; user: null; error: string };

export const requireAdmin = async (): Promise<RequireAdminResult> => {

  const user = await getMe();

  if (!user) {
    return { ok: false, user: null, error: "Unauthorized." };
  }

  // Optional: strict admin check (if you store roles in user metadata)
  // Comment
  // If you later add roles, update this logic to match your DB/claims.

  // Example role logic (disabled by default)
  // const role = (user.user_metadata as any)?.role;
  // if (role !== "admin") {
  //   return { ok: false, user: null, error: "Forbidden." };
  // }

  return { ok: true, user };
};
