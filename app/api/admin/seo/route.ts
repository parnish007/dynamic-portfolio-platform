// app/api/admin/seo/route.ts

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// ---------------------------------------------
// Helpers
// ---------------------------------------------
function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

// ---------------------------------------------
// Admin Guard (SAFE, CONSISTENT)
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
// GET → SEO system status (READ ONLY)
// =============================================
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const admin = await requireAdmin(supabase);
    if (!admin.ok) {
      return json(admin.status, { ok: false, error: admin.error });
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.SITE_URL ??
      "http://localhost:3000";

    return json(200, {
      ok: true,
      seo: {
        siteUrl,
        sitemap: {
          endpoint: "/api/seo/sitemap",
          status: "AVAILABLE",
        },
        robots: {
          enforcedAtLayout: true,
          adminNoIndex: true,
        },
        metadata: {
          appRouter: true,
          dynamicMetadata: true,
          openGraph: true,
          twitterCards: true,
        },
        indexingPolicy: {
          publicPages: "index, follow",
          adminPages: "noindex, nofollow",
        },
      },
      notes: [
        "This endpoint is READ-ONLY.",
        "SEO settings editing will be added later via settings + feature flags.",
      ],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { ok: false, error: msg });
  }
}

// =============================================
// METHOD GUARDS
// =============================================
export async function POST() {
  return json(405, {
    ok: false,
    error: "METHOD_NOT_ALLOWED",
    hint: "SEO editing will be enabled later via admin settings.",
  });
}

export async function PATCH() {
  return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}

export async function DELETE() {
  return json(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
}
