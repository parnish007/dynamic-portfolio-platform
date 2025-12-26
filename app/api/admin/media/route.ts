// app/api/admin/media/route.ts
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

  const { data: isAdmin, error: rpcErr } = await supabase.rpc("is_admin");

  if (rpcErr) {
    return {
      ok: false as const,
      status: 500,
      error: "ADMIN_CHECK_FAILED" as const,
      details: rpcErr.message,
    };
  }

  if (!isAdmin) {
    return { ok: false as const, status: 403, error: "FORBIDDEN" as const };
  }

  return { ok: true as const, userId: userRes.user.id };
}

// =============================================
// GET → List media records (admin)
// Also returns storage bucket configuration (diagnostic)
// =============================================
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error, details: (admin as any).details });
    }

    const bucketName = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "media";

    // Media table list (authoritative list for the admin UI)
    // Assumes table exists: public.media
    const { data, error } = await supabase
      .from("media")
      .select("*")
      .order("created_at", { ascending: false });

    // If table doesn't exist yet, fail clearly (so we know migration is missing)
    if (error) {
      return json(500, { ok: false, error: "DB_ERROR", details: error.message });
    }

    // Optional diagnostic probe: bucket existence (best-effort, may fail under anon policies)
    let storageProbe: { ok: boolean; bucket: string; error?: string } = { ok: true, bucket: bucketName };

    try {
      const { data: buckets, error: be } = await supabase.storage.listBuckets();
      if (be) {
        storageProbe = { ok: false, bucket: bucketName, error: be.message };
      } else {
        const exists = (buckets ?? []).some((b) => b.name === bucketName);
        if (!exists) {
          storageProbe = { ok: false, bucket: bucketName, error: `Bucket "${bucketName}" not found.` };
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      storageProbe = { ok: false, bucket: bucketName, error: msg };
    }

    return json(200, {
      ok: true,
      media: data ?? [],
      bucket: bucketName,
      storageProbe,
      next: {
        upload: "POST /api/admin/media/upload (to be implemented)",
        delete: "DELETE /api/admin/media/[id] (to be implemented)",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: "INTERNAL_ERROR", details: msg });
  }
}

// =============================================
// POST → Reserved (we'll implement upload route separately)
// =============================================
export async function POST() {
  return json(405, {
    ok: false,
    error: "METHOD_NOT_ALLOWED",
    hint: "Upload will be implemented as POST /api/admin/media/upload for admin-only media manager.",
  });
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
