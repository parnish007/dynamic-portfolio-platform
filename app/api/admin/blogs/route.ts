// app/api/admin/blogs/route.ts

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function json(status: number, body: unknown) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

// ---------------------------------------------
// Admin Guard (safe, minimal, non-breaking)
// - Supports BOTH schemas:
//   A) admins.user_id = auth.users.id   (recommended)
//   B) admins.id      = auth.users.id   (legacy)
// ---------------------------------------------
async function requireAdmin(
  supabase: ReturnType<typeof createSupabaseServerClient>
) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userRes.user) {
    return {
      ok: false as const,
      status: 401,
      error: "UNAUTHENTICATED" as const,
    };
  }

  const userId = userRes.user.id;

  const { data: byUserId, error: e1 } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!e1 && byUserId) {
    return { ok: true as const, userId };
  }

  const { data: byId, error: e2 } = await supabase
    .from("admins")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (e2) {
    return {
      ok: false as const,
      status: 500,
      error: "INTERNAL_ERROR" as const,
    };
  }

  if (!byId) {
    return {
      ok: false as const,
      status: 403,
      error: "FORBIDDEN" as const,
    };
  }

  return { ok: true as const, userId };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  const s = asString(value).trim();
  return s ? s : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// =============================================
// GET → List blogs (admin)
// =============================================
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) return json(admin.status, { ok: false, error: admin.error });

    // Keep flexible: select "*"
    // Note: if "updated_at" doesn't exist, Supabase will error.
    // If that happens, switch to order("created_at") or remove ordering.
    const { data, error } = await supabase
      .from("blogs")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    return json(200, { ok: true, blogs: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: msg });
  }
}

// =============================================
// POST → Create blog (draft)
// =============================================
export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) return json(admin.status, { ok: false, error: admin.error });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    if (!isPlainObject(body)) {
      return json(400, { ok: false, error: "INVALID_JSON_BODY" });
    }

    const title = asString(body.title).trim();
    if (!title) {
      return json(400, { ok: false, error: "TITLE_REQUIRED" });
    }

    const insert = {
      title,
      slug: asNullableString(body.slug),
      summary: asNullableString(body.summary),
      content: asNullableString(body.content),
      cover_image: asNullableString(body.cover_image),
      tags: Array.isArray(body.tags) ? body.tags : null,
      is_published: asBoolean(body.is_published, false),
      order_index: asNumber(body.order_index, 0),
      // If your schema has this:
      // author_id: admin.userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("blogs").insert(insert).select("*").single();

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    return json(201, { ok: true, blog: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: msg });
  }
}

// ---------------------------------------------
// Method Guards
// ---------------------------------------------
export async function PATCH() {
  return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}

export async function DELETE() {
  return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}

export async function PUT() {
  return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    },
  });
}
