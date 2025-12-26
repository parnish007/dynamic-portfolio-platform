// app/api/auth/me/route.ts

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type MeOk = {
  ok: true;
  authenticated: true;
  user: {
    email: string;
    role: string;
  };
};

type MeNoAuth = {
  ok: false;
  authenticated: false;
  error: "UNAUTHENTICATED";
};

type MeErr = {
  ok: false;
  authenticated: false;
  error: "INTERNAL_ERROR";
  details?: string;
};

type MeMethod = {
  ok: false;
  authenticated: false;
  error: "METHOD_NOT_ALLOWED";
  details?: string;
};

function json(status: number, body: MeOk | MeNoAuth | MeErr | MeMethod) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isProdEnv(): boolean {
  return (process.env.NODE_ENV ?? "").toLowerCase() === "production";
}

async function assertAdminUser(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string
): Promise<
  | { ok: true }
  | { ok: false; kind: "NOT_ADMIN" | "DB_ERROR"; details?: string }
> {
  // Primary: admins.user_id = <auth user id>
  const primary = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (primary.error) {
    // If the column doesn't exist, Supabase returns an error.
    // Fallback: some schemas use `id` instead of `user_id`.
    const fallback = await supabase
      .from("admins")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (fallback.error) {
      return {
        ok: false,
        kind: "DB_ERROR",
        details: fallback.error.message,
      };
    }

    if (!(fallback.data as { id?: string | null } | null)?.id) {
      return { ok: false, kind: "NOT_ADMIN" };
    }

    return { ok: true };
  }

  if (!(primary.data as { user_id?: string | null } | null)?.user_id) {
    return { ok: false, kind: "NOT_ADMIN" };
  }

  return { ok: true };
}

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase.auth.getUser();
    const user = data?.user;

    if (error || !user) {
      const payload: MeNoAuth = {
        ok: false,
        authenticated: false,
        error: "UNAUTHENTICATED",
      };

      return json(401, payload);
    }

    const adminCheck = await assertAdminUser(supabase, user.id);

    if (!adminCheck.ok && adminCheck.kind === "NOT_ADMIN") {
      const payload: MeNoAuth = {
        ok: false,
        authenticated: false,
        error: "UNAUTHENTICATED",
      };

      return json(401, payload);
    }

    if (!adminCheck.ok && adminCheck.kind === "DB_ERROR") {
      const payload: MeErr = {
        ok: false,
        authenticated: false,
        error: "INTERNAL_ERROR",
        details: isProdEnv() ? undefined : adminCheck.details ?? "DB error",
      };

      return json(500, payload);
    }

    const payload: MeOk = {
      ok: true,
      authenticated: true,
      user: {
        email: user.email ?? "",
        role: "admin",
      },
    };

    return json(200, payload);
  } catch (error) {
    const payload: MeErr = {
      ok: false,
      authenticated: false,
      error: "INTERNAL_ERROR",
      details: isProdEnv()
        ? undefined
        : error instanceof Error
        ? error.message
        : "Unknown error.",
    };

    return json(500, payload);
  }
}

/**
 * Method guards
 */
export async function POST() {
  const payload: MeMethod = {
    ok: false,
    authenticated: false,
    error: "METHOD_NOT_ALLOWED",
    details: "Method not allowed. Use GET.",
  };

  return json(405, payload);
}

export async function PUT() {
  return POST();
}

export async function PATCH() {
  return POST();
}

export async function DELETE() {
  return POST();
}
