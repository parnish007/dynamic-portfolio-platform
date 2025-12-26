// app/api/admin/projects/route.ts
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// ---------------------------------------------
// Helpers
// ---------------------------------------------
function json(status: number, body: unknown) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
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

function asStringArrayOrNull(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out = value
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((x) => x.length > 0);
  return out.length > 0 ? out : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// ---------------------------------------------
// Admin Guard (authoritative)
// - Supabase SSR cookies
// - RPC public.is_admin() SECURITY DEFINER
// ---------------------------------------------
async function requireAdmin(supabase: ReturnType<typeof createSupabaseServerClient>) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userRes.user) {
    return { ok: false as const, status: 401, error: "UNAUTHENTICATED" as const };
  }

  const { data: isAdmin, error: adminErr } = await supabase.rpc("is_admin");

  if (adminErr) {
    return {
      ok: false as const,
      status: 500,
      error: "ADMIN_CHECK_FAILED" as const,
      details: adminErr.message,
    };
  }

  if (!isAdmin) {
    return { ok: false as const, status: 403, error: "FORBIDDEN" as const };
  }

  return { ok: true as const, userId: userRes.user.id };
}

// =============================================
// GET → List projects (admin)
// =============================================
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error, details: (admin as any).details });
    }

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      return json(500, { ok: false, error: "DB_ERROR", details: error.message });
    }

    return json(200, { ok: true, projects: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: "INTERNAL_ERROR", details: msg });
  }
}

// =============================================
// POST → Create project (draft)
// =============================================
export async function POST(req: Request) {
  try {
    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error, details: (admin as any).details });
    }

    let bodyUnknown: unknown = null;

    try {
      bodyUnknown = await req.json();
    } catch {
      return json(400, { ok: false, error: "INVALID_JSON" });
    }

    const body = isPlainObject(bodyUnknown) ? bodyUnknown : {};

    const title = asString(body.title).trim();
    if (!title) {
      return json(400, { ok: false, error: "TITLE_REQUIRED" });
    }

    // Optional: link project into folder tree (only if schema supports)
    const content_node_id =
      typeof body.content_node_id === "string" && body.content_node_id.trim().length > 0
        ? body.content_node_id.trim()
        : null;

    const insert = {
      title,
      slug: asNullableString(body.slug),
      summary: asNullableString(body.summary),
      description: asNullableString(body.description),
      cover_image: asNullableString(body.cover_image),
      tags: asStringArrayOrNull(body.tags),
      tech_stack: asStringArrayOrNull(body.tech_stack),
      live_url: asNullableString(body.live_url),
      repo_url: asNullableString(body.repo_url),
      status: asNullableString(body.status),

      is_featured: asBoolean(body.is_featured, false),
      is_published: asBoolean(body.is_published, false),

      order_index: asNumber(body.order_index, 0),

      content_node_id,

      // Keep updated_at write (safe) — remove later ONLY if you confirm DB trigger covers it
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("projects").insert(insert).select("*").single();

    if (error) {
      return json(500, { ok: false, error: "DB_ERROR", details: error.message });
    }

    return json(201, { ok: true, project: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: "INTERNAL_ERROR", details: msg });
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
