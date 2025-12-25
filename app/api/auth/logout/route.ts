// app/api/auth/logout/route.ts

import { NextResponse } from "next/server";

import { clearSession } from "@/lib/auth/session";

type LogoutOk = {
  ok: true;
};

type LogoutErr = {
  ok: false;
  error: string;
};

function jsonError(status: number, error: string) {
  const payload: LogoutErr = { ok: false, error };
  return NextResponse.json(payload, { status });
}

export async function POST() {
  try {
    const response = NextResponse.json({ ok: true } satisfies LogoutOk, { status: 200 });

    await clearSession(response);

    return response;
  } catch (error) {
    /**
     * Avoid leaking internals in production.
     * You can hook analytics/error logging later.
     */
    const isProd = (process.env.NODE_ENV ?? "").toLowerCase() === "production";

    if (!isProd) {
      const msg = error instanceof Error ? error.message : "Unknown error.";
      return jsonError(500, `Internal server error: ${msg}`);
    }

    return jsonError(500, "Internal server error.");
  }
}

/**
 * Method guard
 */
export async function GET() {
  return jsonError(405, "Method not allowed. Use POST.");
}
