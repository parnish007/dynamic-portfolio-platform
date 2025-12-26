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

// =============================================
// PATCH → Update node (rename / move / reorder)
// =============================================
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const nodeId = params.id;
    if (!nodeId) {
      return json(400, { ok: false, error: "ID_REQUIRED" });
    }

    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error });
    }

    const body = (await req.json()) as Partial<{
      title: string;
      parentId: string | null;
      slug: string | null;
      orderIndex: number;
      icon: string | null;
      description: string | null;
    }>;

    const update: Record<string, unknown> = {};

    if (typeof body.title === "string") {
      const title = body.title.trim();
      if (!title) {
        return json(400, { ok: false, error: "TITLE_EMPTY" });
      }
      update.title = title;
    }

    if ("parentId" in body) {
      update.parent_id = body.parentId ?? null;
    }

    if ("slug" in body) {
      update.slug = body.slug ?? null;
    }

    if (typeof body.orderIndex === "number") {
      update.order_index = body.orderIndex;
    }

    if ("icon" in body) {
      update.icon = body.icon ?? null;
    }

    if ("description" in body) {
      update.description = body.description ?? null;
    }

    if (Object.keys(update).length === 0) {
      return json(400, { ok: false, error: "NO_FIELDS_TO_UPDATE" });
    }

    const { data, error } = await supabase
      .from("content_nodes")
      .update(update)
      .eq("id", nodeId)
      .select("*")
      .single();

    if (error) {
      return json(500, { ok: false, error: error.message });
    }

    return json(200, { ok: true, node: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: msg });
  }
}

// =============================================
// DELETE → Remove node
// =============================================
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const nodeId = params.id;
    if (!nodeId) {
      return json(400, { ok: false, error: "ID_REQUIRED" });
    }

    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error });
    }

    const { error } = await supabase
      .from("content_nodes")
      .delete()
      .eq("id", nodeId);

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
export async function GET() {
  return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}
export async function POST() {
  return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}
