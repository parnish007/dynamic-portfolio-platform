// lib/auth/session.ts

// ============================================
// Imports
// ============================================

import type { Session, User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ============================================
// Types
// ============================================

export type AuthSession = {
  session: Session | null;
  user: User | null;
};

export type GetAuthSessionResult =
  | { ok: true; data: AuthSession }
  | { ok: false; data: AuthSession; error: string };

// ============================================
// Get Session + User (Server-side)
// ============================================

export const getAuthSession = async (): Promise<GetAuthSessionResult> => {
  const empty: AuthSession = { session: null, user: null };

  try {
    const supabase = createSupabaseServerClient();

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      return {
        ok: false,
        data: empty,
        error: sessionError.message,
      };
    }

    const session = sessionData.session ?? null;

    if (!session) {
      return {
        ok: true,
        data: empty,
      };
    }

    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError) {
      return {
        ok: false,
        data: { session, user: null },
        error: userError.message,
      };
    }

    return {
      ok: true,
      data: {
        session,
        user: userData.user ?? null,
      },
    };
  } catch (err) {
    return {
      ok: false,
      data: empty,
      error:
        err instanceof Error
          ? err.message
          : "Unknown error while reading auth session.",
    };
  }
};

// ============================================
// Backward Compatibility (used by /api/auth/me)
// ============================================

export const getSession = getAuthSession;

// ============================================
// Convenience Helpers
// ============================================

export const isSignedIn = async () => {
  const result = await getAuthSession();
  return Boolean(result.ok && result.data.session);
};

export const requireSession = async () => {
  const result = await getAuthSession();

  if (!result.ok || !result.data.session) {
    return {
      ok: false as const,
      session: null,
      user: null,
      error: "Unauthorized.",
    };
  }

  return {
    ok: true as const,
    session: result.data.session,
    user: result.data.user,
  };
};
