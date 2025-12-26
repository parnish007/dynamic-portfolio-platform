// app/api/auth/logout/route.ts

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/client";

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
    const supabase = createSupabaseServerClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      return jsonError(500, error.message);
    }

    const payload: LogoutOk = { ok: true };

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const isProd =
      (process.env.NODE_ENV ?? "").toLowerCase() === "production";

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
