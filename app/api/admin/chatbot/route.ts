// app/api/admin/chatbot/route.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// ---------------------------------------------
// Helpers
// ---------------------------------------------
function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

// ---------------------------------------------
// Admin Guard (SAFE, consistent)
// ---------------------------------------------
async function requireAdmin(
  supabase: ReturnType<typeof createSupabaseServerClient>
) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userRes.user) {
    return { ok: false as const, status: 401, error: "UNAUTHENTICATED" as const };
  }

  const { data: adminRow } = await supabase
    .from("admins")
    .select("id")
    .eq("id", userRes.user.id)
    .maybeSingle();

  if (!adminRow) {
    return { ok: false as const, status: 403, error: "FORBIDDEN" as const };
  }

  return { ok: true as const };
}

// =============================================
// GET → Chatbot admin status
// =============================================
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error });
    }

    /**
     * NOTE:
     * We intentionally DO NOT fetch config yet.
     * This endpoint guarantees:
     * - Admin auth works
     * - Admin UI can safely connect
     */

    return json(200, {
      ok: true,
      status: "READY",
      chatbot: {
        enabled: true,
        mode: "placeholder",
      },
      message:
        "Admin chatbot API ready. Attach prompts, RAG, model config here.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: msg });
  }
}

// =============================================
// POST → Reserved (future config update)
// =============================================
export async function POST() {
  return json(405, {
    ok: false,
    error: "METHOD_NOT_ALLOWED",
    hint: "Chatbot configuration endpoint coming next",
  });
}

// =============================================
// PATCH / DELETE Guards
// =============================================
export async function PATCH() {
  return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}

export async function DELETE() {
  return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}
