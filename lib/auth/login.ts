// lib/auth/login.ts

// ============================================
// Imports
// ============================================

import { createSupabaseServerClient } from "@/lib/supabase/server";

// ============================================
// Types
// ============================================

export type LoginResult =
  | { ok: true }
  | { ok: false; error: string };

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
