// app/api/auth/me/route.ts

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";

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

function json(status: number, body: MeOk | MeNoAuth | MeErr) {
  return NextResponse.json(body, { status });
}

export async function GET() {
  try {
    const result = await getSession();

    if (!result.ok || !result.data.session || !result.data.user) {
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
        email: result.data.user.email ?? "",
        role: "admin", // ⬅️ static for now (upgrade later via claims/DB)
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
  const payload: MeErr = {
    ok: false,
    authenticated: false,
    error: "INTERNAL_ERROR",
    details: "Method not allowed. Use GET.",
  };

  return NextResponse.json(payload, { status: 405 });
}
