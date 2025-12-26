// app/api/admin/projects/route.ts

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// ---------------------------------------------
// Helpers
// ---------------------------------------------
function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
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
      return json(admin.status, { ok: false, error: admin.error });
    }

    // Flexible read: select "*"
    // Prefer ordering by updated_at desc if exists.
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    return json(200, { ok: true, projects: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: msg });
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
      return json(admin.status, { ok: false, error: admin.error });
    }

    const body = (await req.json()) as Partial<{
      title: string;
      slug: string | null;
      summary: string | null;
      description: string | null;
      cover_image: string | null;
      tags: string[] | null;
      tech_stack: string[] | null;
      live_url: string | null;
      repo_url: string | null;
      status: string | null;
      is_featured: boolean;
      is_published: boolean;
      order_index: number;

      // Optional: link project into folder tree
      content_node_id: string | null;
    }>;

    const title = asString(body.title).trim();
    if (!title) {
      return json(400, { ok: false, error: "TITLE_REQUIRED" });
    }

    const insert = {
      title,
      slug: asNullableString(body.slug),
      summary: asNullableString(body.summary),
      description: asNullableString(body.description),
      cover_image: asNullableString(body.cover_image),
      tags: Array.isArray(body.tags) ? body.tags : null,
      tech_stack: Array.isArray(body.tech_stack) ? body.tech_stack : null,
      live_url: asNullableString(body.live_url),
      repo_url: asNullableString(body.repo_url),
      status: asNullableString(body.status),

      is_featured: asBoolean(body.is_featured, false),
      is_published: asBoolean(body.is_published, false),

      order_index: asNumber(body.order_index, 0),

      // Optional relationship (only if your schema supports it)
      content_node_id: body.content_node_id ?? null,

      // Optional ownership if schema supports it:
      // owner_id: admin.userId,
    };

    const { data, error } = await supabase
      .from("projects")
      .insert(insert)
      .select("*")
      .single();

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    return json(201, { ok: true, project: data });
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
