// app/admin/login/page.tsx

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Admin Login",
  robots: { index: false, follow: false },
};

type AdminLoginPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function getNextPath(searchParams?: AdminLoginPageProps["searchParams"]): string {
  const raw = searchParams?.next;

  const next =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw)
      ? raw[0]
      : undefined;

  if (!next) return "/admin/dashboard";
  if (!next.startsWith("/")) return "/admin/dashboard";
  if (next.startsWith("//")) return "/admin/dashboard";

  return next;
}

/**
 * DB schema confirmed:
 * public.admins(id uuid, email text, created_at timestamptz)
 *
 * ✅ Primary: admins.id = auth.user.id
 * ✅ Fallback: admins.user_id (older schema)
 */
async function isAdminUser(args: {
  supabase: ReturnType<typeof createSupabaseServerClient>;
  userId: string;
}): Promise<boolean> {
  const byId = await args.supabase
    .from("admins")
    .select("id")
    .eq("id", args.userId)
    .maybeSingle();

  if (!byId.error && byId.data?.id) return true;

  const byUserId = await args.supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", args.userId)
    .maybeSingle();

  if (!byUserId.error && (byUserId.data as any)?.user_id) return true;

  return false;
}

async function loginAction(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "").trim();

  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//")
      ? next
      : "/admin/dashboard";

  if (!email || !password) {
    redirect(
      `/admin/login?error=${encodeURIComponent(
        "Email and password are required."
      )}&next=${encodeURIComponent(safeNext)}`
    );
  }

  const supabase = createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(
      `/admin/login?error=${encodeURIComponent(
        "Invalid credentials."
      )}&next=${encodeURIComponent(safeNext)}`
    );
  }

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;

  if (!user) {
    await supabase.auth.signOut();
    redirect(
      `/admin/login?error=${encodeURIComponent(
        "Authentication failed. Please try again."
      )}&next=${encodeURIComponent(safeNext)}`
    );
  }

  const okAdmin = await isAdminUser({ supabase, userId: user.id });

  if (!okAdmin) {
    await supabase.auth.signOut();
    redirect(
      `/admin/login?error=${encodeURIComponent(
        "Access denied. Admins only."
      )}&next=${encodeURIComponent(safeNext)}`
    );
  }

  redirect(safeNext);
}

export default function AdminLoginPage(props: AdminLoginPageProps) {
  const next = getNextPath(props.searchParams);

  const errorParam = props.searchParams?.error;
  const error =
    typeof errorParam === "string"
      ? errorParam
      : Array.isArray(errorParam)
      ? errorParam[0]
      : undefined;

  return (
    <main
      className="admin"
      data-scope="admin"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
      }}
    >
      <div className="adminCard" style={{ width: "100%", maxWidth: 420 }}>
        <h1 className="adminCard__title">Admin Login</h1>
        <p className="adminCard__desc">Authorized administrators only.</p>

        {error ? (
          <div
            className="card"
            style={{
              marginTop: "1rem",
              padding: "0.75rem",
              borderColor: "rgba(239, 68, 68, 0.35)",
              background: "rgba(239, 68, 68, 0.08)",
            }}
            role="alert"
          >
            <p style={{ margin: 0, color: "var(--color-text)" }}>{error}</p>
          </div>
        ) : null}

        <form
          action={loginAction}
          style={{
            marginTop: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <input type="hidden" name="next" value={next} />

          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <span className="text-sm" style={{ color: "var(--color-muted)" }}>
              Email
            </span>
            <input
              className="input"
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="you@example.com"
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <span className="text-sm" style={{ color: "var(--color-muted)" }}>
              Password
            </span>
            <input
              className="input"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>

          <button className="btn btn--primary" type="submit" style={{ marginTop: "0.25rem" }}>
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
