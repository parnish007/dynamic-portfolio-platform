// app/api/admin/blogs/route.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type AdminGuardOk = { ok: true; userId: string };
type AdminGuardErr = { ok: false; status: number; error: "UNAUTHENTICATED" | "FORBIDDEN" | "INTERNAL_ERROR" };

function json(status: number, body: unknown) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

// ---------------------------------------------
// Helpers
// ---------------------------------------------
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableTrimmedString(value: unknown): string | null {
  const s = asTrimmedString(value);
  return s.length > 0 ? s : null;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

// ---------------------------------------------
// Admin Guard (robust, consistent)
// 1) Prefer RPC public.is_admin() if available
// 2) Fallback to admins table checks (both schemas)
// ---------------------------------------------
async function requireAdmin(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<AdminGuardOk | AdminGuardErr> {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userRes.user) {
    return { ok: false, status: 401, error: "UNAUTHENTICATED" };
  }

  const userId = userRes.user.id;

  // 1) RPC check (best)
  try {
    const { data: isAdmin, error: rpcErr } = await supabase.rpc("is_admin");
    if (!rpcErr && typeof isAdmin === "boolean") {
      if (isAdmin) return { ok: true, userId };
      return { ok: false, status: 403, error: "FORBIDDEN" };
    }
  } catch {
    // ignore and fallback
  }

  // 2) Fallback: admins.user_id == auth.users.id
  const { data: byUserId, error: e1 } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!e1 && byUserId) {
    return { ok: true, userId };
  }

  // 3) Legacy fallback: admins.id == auth.users.id
  const { data: byId, error: e2 } = await supabase
    .from("admins")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (e2) {
    return { ok: false, status: 500, error: "INTERNAL_ERROR" };
  }

  if (!byId) {
    return { ok: false, status: 403, error: "FORBIDDEN" };
  }

  return { ok: true, userId };
}

// =============================================
// GET → List blogs (admin)
// =============================================
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) return json(admin.status, { ok: false, error: admin.error });

    // Prefer updated_at ordering, fallback to created_at if schema differs.
    const primary = await supabase.from("blogs").select("*").order("updated_at", { ascending: false });

    if (!primary.error) {
      return json(200, { ok: true, blogs: primary.data ?? [] });
    }

    const fallback = await supabase.from("blogs").select("*").order("created_at", { ascending: false });

    if (fallback.error) {
      return json(500, { ok: false, error: fallback.error.message });
    }

    return json(200, { ok: true, blogs: fallback.data ?? [], warning: "Ordered by created_at (updated_at missing)" });
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

    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    if (!isPlainObject(body)) {
      return json(400, { ok: false, error: "INVALID_JSON_BODY" });
    }

    const title = asTrimmedString(body.title);
    if (!title) {
      return json(400, { ok: false, error: "TITLE_REQUIRED" });
    }

    const insert = {
      title,
      slug: asNullableTrimmedString(body.slug),
      summary: asNullableTrimmedString(body.summary),
      content: asNullableTrimmedString(body.content),

      // keep your existing DB field naming
      cover_image: asNullableTrimmedString(body.cover_image ?? body.coverImage),

      tags: Array.isArray(body.tags) ? body.tags : null,

      is_published: asBoolean(body.is_published ?? body.isPublished, false),
      order_index: asNumber(body.order_index ?? body.orderIndex, 0),

      // Optional, if you later add it in schema:
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
