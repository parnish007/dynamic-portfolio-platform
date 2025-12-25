// ============================================
// Imports
// ============================================

import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import type { Session, User } from "@supabase/supabase-js";


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
// Get Session + User (Server-side)
// ============================================

export const getAuthSession = async (): Promise<GetAuthSessionResult> => {

  const empty: AuthSession = {
    session: null,
    user: null,
  };

  try {

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return {
        ok: false,
        data: empty,
        error: "Supabase env vars missing.",
      };
    }

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

    const message =
      err instanceof Error
        ? err.message
        : "Unknown error while reading auth session.";

    return {
      ok: false,
      data: empty,
      error: message,
    };
  }
};


// ============================================
// Convenience Helpers
// ============================================

export const isSignedIn = async () => {

  const result = await getAuthSession();

  return Boolean(result.ok && result.data.session);
};

export const requireSession = async () => {

  const result = await getAuthSession();

  if (!result.ok) {
    return {
      ok: false as const,
      session: null,
      user: null,
      error: result.error,
    };
  }

  if (!result.data.session) {
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
