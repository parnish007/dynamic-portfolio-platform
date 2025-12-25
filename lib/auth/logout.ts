// ============================================
// Imports
// ============================================

import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";


// ============================================
// Types
// ============================================

export type LogoutResult =
  | { ok: true }
  | { ok: false; error: string };


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
// Logout (Server-side)
// ============================================

export const logout = async (): Promise<LogoutResult> => {

  try {

    const supabase = createSupabaseServerClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };

  } catch (err) {

    const message =
      err instanceof Error
        ? err.message
        : "Unknown error during logout.";

    return { ok: false, error: message };
  }
};
