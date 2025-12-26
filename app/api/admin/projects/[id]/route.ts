// app/api/admin/projects/[id]/route.ts

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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

// ---------------------------------------------
// Admin Guard (SAFE, consistent)
// - Supports BOTH schemas:
//   A) admins.user_id = auth.users.id   (recommended)
//   B) admins.id      = auth.users.id   (legacy)
// ---------------------------------------------
async function requireAdmin(
  supabase: ReturnType<typeof createSupabaseServerClient>
) {
  const { data: userRes, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userRes.user) {
    return { ok: false as const, status: 401, error: "UNAUTHENTICATED" as const };
  }

  const userId = userRes.user.id;

  const { data: byUserId, error: e1 } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!e1 && byUserId) {
    return { ok: true as const };
  }

  const { data: byId, error: e2 } = await supabase
    .from("admins")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (e2) {
    return { ok: false as const, status: 500, error: "INTERNAL_ERROR" as const };
  }

  if (!byId) {
    return { ok: false as const, status: 403, error: "FORBIDDEN" as const };
  }

  return { ok: true as const };
}

// =============================================
// GET → Fetch single project
// =============================================
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    if (!projectId) {
      return json(400, { ok: false, error: "ID_REQUIRED" });
    }

    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error });
    }

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (error || !data) {
      return json(404, { ok: false, error: "NOT_FOUND" });
    }

    return json(200, { ok: true, project: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: msg });
  }
}

// =============================================
// PATCH → Update project (schema-flexible)
// =============================================
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    if (!projectId) {
      return json(400, { ok: false, error: "ID_REQUIRED" });
    }

    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    if (!isPlainObject(body)) {
      return json(400, { ok: false, error: "INVALID_JSON_BODY" });
    }

    const update: Record<string, unknown> = {};

    if ("title" in body) {
      const t = asString(body.title).trim();
      if (!t) return json(400, { ok: false, error: "TITLE_EMPTY" });
      update.title = t;
    }

    if ("slug" in body) update.slug = asNullableString(body.slug);
    if ("summary" in body) update.summary = asNullableString(body.summary);
    if ("description" in body) update.description = asNullableString(body.description);
    if ("cover_image" in body) update.cover_image = asNullableString(body.cover_image);
    if ("live_url" in body) update.live_url = asNullableString(body.live_url);
    if ("repo_url" in body) update.repo_url = asNullableString(body.repo_url);
    if ("status" in body) update.status = asNullableString(body.status);

    if ("tags" in body) update.tags = Array.isArray(body.tags) ? body.tags : null;
    if ("tech_stack" in body) update.tech_stack = Array.isArray(body.tech_stack) ? body.tech_stack : null;

    if ("is_featured" in body) update.is_featured = asBoolean(body.is_featured, false);
    if ("is_published" in body) update.is_published = asBoolean(body.is_published, false);

    if ("order_index" in body) update.order_index = asNumber(body.order_index, 0);

    // Optional relationship (ONLY keep if your DB actually has this column)
    if ("content_node_id" in body) {
      update.content_node_id = asNullableString(body.content_node_id);
    }

    if (Object.keys(update).length === 0) {
      return json(400, { ok: false, error: "NO_FIELDS_TO_UPDATE" });
    }

    // IMPORTANT: do NOT force updated_at unless you are 100% sure column exists.
    // If your schema has updated_at, you should add a DB trigger or default, not client-side writes.

    const { data, error } = await supabase
      .from("projects")
      .update(update)
      .eq("id", projectId)
      .select("*")
      .single();

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    return json(200, { ok: true, project: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: msg });
  }
}

// =============================================
// DELETE → Remove project
// =============================================
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = params.id;
    if (!projectId) {
      return json(400, { ok: false, error: "ID_REQUIRED" });
    }

    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error });
    }

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    return json(200, { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: msg });
  }
}

// ---------------------------------------------
// Method Guards
// ---------------------------------------------
export async function POST() {
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
      "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    },
  });
}
