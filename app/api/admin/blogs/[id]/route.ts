// app/api/admin/blogs/[id]/route.ts

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

// ---------------------------------------------
// Admin Guard (safe, minimal, non-breaking)
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
      .single();

    if (error) {
      return json(404, { ok: false, error: error.message });
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

    const body = (await req.json()) as Partial<{
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

    if (typeof body.title === "string") {
      const title = body.title.trim();
      if (!title) {
        return json(400, { ok: false, error: "TITLE_EMPTY" });
      }
      update.title = title;
    }

    if ("slug" in body) {
      update.slug = body.slug ?? null;
    }

    if ("summary" in body) {
      update.summary = body.summary ?? null;
    }

    if ("content" in body) {
      update.content = body.content ?? null;
    }

    if ("cover_image" in body) {
      update.cover_image = body.cover_image ?? null;
    }

    if ("tags" in body) {
      update.tags = Array.isArray(body.tags) ? body.tags : null;
    }

    if (typeof body.is_published === "boolean") {
      update.is_published = body.is_published;
    }

    if (typeof body.order_index === "number" && Number.isFinite(body.order_index)) {
      update.order_index = body.order_index;
    }

    if (Object.keys(update).length === 0) {
      return json(400, { ok: false, error: "NO_FIELDS_TO_UPDATE" });
    }

    const { data, error } = await supabase
      .from("blogs")
      .update(update)
      .eq("id", blogId)
      .select("*")
      .single();

    if (error) {
      return json(500, { ok: false, error: error.message });
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

    const { error } = await supabase
      .from("blogs")
      .delete()
      .eq("id", blogId);

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
