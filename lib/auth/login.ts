// ============================================
// Imports
// ============================================

import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";


// ============================================
// Types
// ============================================

export type LoginResult =
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
// Login (Server-side)
// ============================================

export const loginWithEmailPassword = async (
  email: string,
  password: string
): Promise<LoginResult> => {

  try {

    if (!email || !password) {
      return { ok: false, error: "Email and password are required." };
    }

    const supabase = createSupabaseServerClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };

  } catch (err) {

    const message =
      err instanceof Error
        ? err.message
        : "Unknown error during login.";

    return { ok: false, error: message };
  }
};
