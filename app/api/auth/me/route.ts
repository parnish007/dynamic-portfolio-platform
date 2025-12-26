// app/api/auth/me/route.ts

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/client";

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

function json(
  status: number,
  body: MeOk | MeNoAuth | MeErr | MeMethod
) {
  return NextResponse.json(body, { status });
}

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      const payload: MeNoAuth = {
        ok: false,
        authenticated: false,
        error: "UNAUTHENTICATED",
      };

      return json(401, payload);
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
    const isProd =
      (process.env.NODE_ENV ?? "").toLowerCase() === "production";

    const payload: MeErr = {
      ok: false,
      authenticated: false,
      error: "INTERNAL_ERROR",
      details: isProd
        ? undefined
        : error instanceof Error
        ? error.message
        : "Unknown error.",
    };

    return json(500, payload);
  }
}

/**
 * Method guard
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
