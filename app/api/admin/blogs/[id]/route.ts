// app/api/admin/blogs/[id]/route.ts

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
    return { ok: true as const };
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

  return { ok: true as const };
}

// =============================================
// GET → Fetch blog by id
// =============================================
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const blogId = params.id;

    if (!blogId) {
      return json(400, { ok: false, error: "ID_REQUIRED" });
    }

    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error });
    }

    const { data, error } = await supabase
      .from("blogs")
      .select("*")
      .eq("id", blogId)
      .maybeSingle();

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    if (!data) {
      return json(404, { ok: false, error: "NOT_FOUND" });
    }

    return json(200, { ok: true, blog: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: msg });
  }
}

// =============================================
// PATCH → Update blog
// =============================================
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const blogId = params.id;

    if (!blogId) {
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

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return json(400, { ok: false, error: "INVALID_JSON_BODY" });
    }

    const b = body as Partial<{
      title: string;
      slug: string | null;
      summary: string | null;
      content: string | null;
      cover_image: string | null;
      tags: string[] | null;
      is_published: boolean;
      order_index: number;
    }>;

    const update: Record<string, unknown> = {};

    if (typeof b.title === "string") {
      const title = b.title.trim();
      if (!title) {
        return json(400, { ok: false, error: "TITLE_EMPTY" });
      }
      update.title = title;
    }

    if ("slug" in b) update.slug = b.slug ?? null;
    if ("summary" in b) update.summary = b.summary ?? null;
    if ("content" in b) update.content = b.content ?? null;
    if ("cover_image" in b) update.cover_image = b.cover_image ?? null;

    if ("tags" in b) {
      update.tags = Array.isArray(b.tags) ? b.tags : null;
    }

    if (typeof b.is_published === "boolean") {
      update.is_published = b.is_published;
    }

    if (typeof b.order_index === "number" && Number.isFinite(b.order_index)) {
      update.order_index = b.order_index;
    }

    if (Object.keys(update).length === 0) {
      return json(400, { ok: false, error: "NO_FIELDS_TO_UPDATE" });
    }

    update.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("blogs")
      .update(update)
      .eq("id", blogId)
      .select("*")
      .maybeSingle();

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    if (!data) {
      return json(404, { ok: false, error: "NOT_FOUND" });
    }

    return json(200, { ok: true, blog: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: msg });
  }
}

// =============================================
// DELETE → Delete blog
// =============================================
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const blogId = params.id;

    if (!blogId) {
      return json(400, { ok: false, error: "ID_REQUIRED" });
    }

    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error });
    }

    const { error } = await supabase.from("blogs").delete().eq("id", blogId);

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
  return POST();
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
