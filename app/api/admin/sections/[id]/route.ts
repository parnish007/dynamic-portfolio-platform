// app/api/admin/sections/[id]/route.ts

import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ApiErr = {
  ok: false;
  error: string;
  details?: string;
};

type ApiOkGet = {
  ok: true;
  item: Record<string, unknown> | null;
};

type ApiOkPatch = {
  ok: true;
  item: Record<string, unknown>;
  node: Record<string, unknown>;
};

type ApiOkDelete = {
  ok: true;
};

function isProdEnv(): boolean {
  return (process.env.NODE_ENV ?? "").toLowerCase() === "production";
}

function json(
  status: number,
  body: ApiErr | ApiOkGet | ApiOkPatch | ApiOkDelete
) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readString(v: unknown, maxLen: number): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function readNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function readBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return null;
}

async function assertAdmin(
  supabase: ReturnType<typeof createSupabaseServerClient>
): Promise<{ ok: true } | { ok: false; status: number; body: ApiErr }> {
  const { data, error } = await supabase.auth.getUser();

  const user = data?.user;

  if (error || !user) {
    return {
      ok: false,
      status: 401,
      body: { ok: false, error: "UNAUTHENTICATED" },
    };
  }

  const { data: adminRow, error: adminErr } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminErr) {
    return {
      ok: false,
      status: 500,
      body: {
        ok: false,
        error: "INTERNAL_ERROR",
        details: isProdEnv() ? undefined : adminErr.message,
      },
    };
  }

  if (!adminRow?.user_id) {
    return {
      ok: false,
      status: 401,
      body: { ok: false, error: "UNAUTHENTICATED" },
    };
  }

  return { ok: true };
}

function getIdParam(params: { id?: string }) {
  const id = typeof params.id === "string" ? params.id.trim() : "";
  return id;
}

export async function GET(
  _req: Request,
  ctx: { params: { id: string } }
) {
  try {
    const id = getIdParam(ctx.params);
    if (!id) return json(400, { ok: false, error: "Missing id." });

    const supabase = createSupabaseServerClient();

    const admin = await assertAdmin(supabase);
    if (!admin.ok) return json(admin.status, admin.body);

    const { data, error } = await supabase
      .from("sections")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return json(500, {
        ok: false,
        error: "INTERNAL_ERROR",
        details: isProdEnv() ? undefined : error.message,
      });
    }

    return json(200, {
      ok: true,
      item: (data ?? null) as Record<string, unknown> | null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return json(500, {
      ok: false,
      error: "INTERNAL_ERROR",
      details: isProdEnv() ? undefined : msg,
    });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: { id: string } }
) {
  try {
    const id = getIdParam(ctx.params);
    if (!id) return json(400, { ok: false, error: "Missing id." });

    const supabase = createSupabaseServerClient();

    const admin = await assertAdmin(supabase);
    if (!admin.ok) return json(admin.status, admin.body);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = null;
    }

    if (!isPlainObject(body)) {
      return json(400, { ok: false, error: "Invalid JSON body." });
    }

    /**
     * Allowed patch fields (minimal + safe)
     * Accept BOTH:
     * - snake_case (new UI)
     * - camelCase (older callers)
     */
    const patch: Record<string, unknown> = {};

    const parentIdSnake = readString(body.parent_id, 80);
    const parentIdCamel = readString(body.parentId, 80);

    if (parentIdSnake) patch.parent_id = parentIdSnake;
    if (parentIdCamel) patch.parent_id = parentIdCamel;

    if (body.parent_id === null || body.parentId === null) {
      patch.parent_id = null;
    }

    const slug = readString(body.slug, 160);
    if (slug) patch.slug = slug;

    const title = readString(body.title, 200);
    if (title) patch.title = title;

    const kind = readString(body.kind, 80);
    if (kind) patch.kind = kind;

    const nodeType = readString(body.node_type, 40);
    if (nodeType) patch.node_type = nodeType;

    const orderIndexSnake = readNumber(body.order_index);
    const orderIndexCamel = readNumber(body.orderIndex);
    const orderIndexRaw =
      orderIndexSnake !== null ? orderIndexSnake : orderIndexCamel;

    if (orderIndexRaw !== null) patch.order_index = Math.floor(orderIndexRaw);

    const isPublishedSnake = readBool(body.is_published);
    const isPublishedCamel = readBool(body.isPublished);
    const isPublished =
      isPublishedSnake !== null ? isPublishedSnake : isPublishedCamel;

    if (isPublished !== null) patch.is_published = isPublished;

    if (isPlainObject(body.data)) {
      patch.data = body.data;
    }

    patch.updated_at = new Date().toISOString();

    if (Object.keys(patch).length === 1) {
      return json(400, {
        ok: false,
        error: "No valid fields provided to update.",
      });
    }

    const { data, error } = await supabase
      .from("sections")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return json(500, {
        ok: false,
        error: "INTERNAL_ERROR",
        details: isProdEnv() ? undefined : error.message,
      });
    }

    const item = (data ?? {}) as Record<string, unknown>;

    return json(200, {
      ok: true,
      item,
      node: item,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return json(500, {
      ok: false,
      error: "INTERNAL_ERROR",
      details: isProdEnv() ? undefined : msg,
    });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: { id: string } }
) {
  try {
    const id = getIdParam(ctx.params);
    if (!id) return json(400, { ok: false, error: "Missing id." });

    const supabase = createSupabaseServerClient();

    const admin = await assertAdmin(supabase);
    if (!admin.ok) return json(admin.status, admin.body);

    /**
     * Prevent deleting a node that still has children.
     */
    const { count, error: childErr } = await supabase
      .from("sections")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", id);

    if (childErr) {
      return json(500, {
        ok: false,
        error: "INTERNAL_ERROR",
        details: isProdEnv() ? undefined : childErr.message,
      });
    }

    if ((count ?? 0) > 0) {
      return json(409, {
        ok: false,
        error: "HAS_CHILDREN",
        details: "Cannot delete a section that still has children.",
      });
    }

    const { error } = await supabase.from("sections").delete().eq("id", id);

    if (error) {
      return json(500, {
        ok: false,
        error: "INTERNAL_ERROR",
        details: isProdEnv() ? undefined : error.message,
      });
    }

    return json(200, { ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return json(500, {
      ok: false,
      error: "INTERNAL_ERROR",
      details: isProdEnv() ? undefined : msg,
    });
  }
}

/**
 * Method guards
 */
export async function POST() {
  return json(405, {
    ok: false,
    error: "METHOD_NOT_ALLOWED",
    details: "Use GET, PATCH, or DELETE.",
  });
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
