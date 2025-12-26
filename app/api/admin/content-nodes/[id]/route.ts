// app/api/admin/content-nodes/[id]/route.ts

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type NodeType = "folder" | "section" | "project" | "blog";

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

function isValidNodeType(value: unknown): value is NodeType {
  return value === "folder" || value === "section" || value === "project" || value === "blog";
}

function cleanNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s ? s : null;
}

function asNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }

  return fallback;
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
    return { ok: false as const, status: 401, error: "UNAUTHENTICATED" as const };
  }

  const userId = userRes.user.id;

  const { data: byUserId, error: e1 } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!e1 && byUserId) return { ok: true as const };

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

async function isDescendant(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  nodeId: string,
  maybeParentId: string
) {
  // Returns true if maybeParentId is inside nodeId subtree
  let current: string | null = maybeParentId;
  let guard = 0;

  while (current) {
    guard += 1;
    if (guard > 200) {
      // cycle/insane depth guard
      return true;
    }

    if (current === nodeId) return true;

    const { data, error } = await supabase
      .from("content_nodes")
      .select("parent_id")
      .eq("id", current)
      .maybeSingle();

    if (error) return true;
    current = (data?.parent_id as string | null) ?? null;
  }

  return false;
}

// =============================================
// PATCH → Update node (rename / move / reorder / link)
// Accept both snake_case and camelCase payloads.
// =============================================
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const nodeId = params.id;
    if (!nodeId) return json(400, { ok: false, error: "ID_REQUIRED" });

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

    const b = body;
    const update: Record<string, unknown> = {};

    // Title
    if (typeof b.title === "string") {
      const title = b.title.trim();
      if (!title) return json(400, { ok: false, error: "TITLE_EMPTY" });
      update.title = title;
    }

    // Parent (move): accept parent_id OR parentId
    let nextParentId: string | null | undefined = undefined;
    if ("parent_id" in b || "parentId" in b) {
      const raw = (b as any).parent_id ?? (b as any).parentId ?? null;

      if (raw === null) nextParentId = null;
      else nextParentId = cleanNullableString(raw);

      // prevent parent === self
      if (nextParentId && nextParentId === nodeId) {
        return json(400, { ok: false, error: "PARENT_CANNOT_BE_SELF" });
      }

      // prevent cycles (moving under a descendant)
      if (nextParentId) {
        const bad = await isDescendant(supabase, nodeId, nextParentId);
        if (bad) {
          return json(400, { ok: false, error: "PARENT_CANNOT_BE_DESCENDANT" });
        }
      }

      update.parent_id = nextParentId;
    }

    // Slug
    if ("slug" in b) {
      update.slug = cleanNullableString((b as any).slug);
    }

    // Order (reorder): accept order_index OR orderIndex (number or numeric string)
    if ("order_index" in b || "orderIndex" in b) {
      const raw = (b as any).order_index ?? (b as any).orderIndex;

      if (raw === null || raw === undefined) {
        // ignore
      } else {
        const n = asNumber(raw, Number.NaN);
        if (!Number.isFinite(n)) {
          return json(400, { ok: false, error: "ORDER_INDEX_INVALID" });
        }
        update.order_index = n;
      }
    }

    // Icon
    if ("icon" in b) {
      update.icon = cleanNullableString((b as any).icon);
    }

    // Description
    if ("description" in b) {
      update.description = cleanNullableString((b as any).description);
    }

    // Ref link (node -> real record): accept ref_id OR refId
    if ("ref_id" in b || "refId" in b) {
      const raw = (b as any).ref_id ?? (b as any).refId ?? null;
      update.ref_id = raw === null ? null : cleanNullableString(raw);
    }

    // Node type (folder/section/project/blog): accept node_type OR nodeType
    if ("node_type" in b || "nodeType" in b) {
      const raw = (b as any).node_type ?? (b as any).nodeType;

      if (raw === null || raw === undefined) {
        // ignore
      } else if (!isValidNodeType(raw)) {
        return json(400, { ok: false, error: "NODE_TYPE_INVALID" });
      } else {
        update.node_type = raw;
      }
    }

    if (Object.keys(update).length === 0) {
      return json(400, { ok: false, error: "NO_FIELDS_TO_UPDATE" });
    }

    update.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("content_nodes")
      .update(update)
      .eq("id", nodeId)
      .select("*")
      .maybeSingle();

    if (error) return json(500, { ok: false, error: error.message });

    if (!data) {
      return json(404, { ok: false, error: "NOT_FOUND" });
    }

    return json(200, { ok: true, node: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: msg });
  }
}

// =============================================
// DELETE → Remove node (only if no children)
// =============================================
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const nodeId = params.id;
    if (!nodeId) return json(400, { ok: false, error: "ID_REQUIRED" });

    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) return json(admin.status, { ok: false, error: admin.error });

    const { count, error: childErr } = await supabase
      .from("content_nodes")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", nodeId);

    if (childErr) return json(500, { ok: false, error: childErr.message });

    if ((count ?? 0) > 0) {
      return json(409, {
        ok: false,
        error: "HAS_CHILDREN",
        details: "Cannot delete a node that still has children.",
      });
    }

    const { error } = await supabase.from("content_nodes").delete().eq("id", nodeId);

    if (error) return json(500, { ok: false, error: error.message });

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

export async function PUT() {
  return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "Access-Control-Allow-Methods": "PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
    },
  });
}
