// app/(admin)/login/page.tsx

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/client";

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

  // Safety: only allow internal redirects
  if (!next) return "/admin/dashboard";
  if (!next.startsWith("/")) return "/admin/dashboard";
  if (next.startsWith("//")) return "/admin/dashboard";

  return next;
}

// ============================================
// Server Action: Login
// ============================================

async function loginAction(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const next = String(formData.get("next") ?? "").trim();

  if (!email || !password) {
    // Keep it simple: redirect back with error query
    redirect(`/admin/login?error=${encodeURIComponent("Email and password are required.")}`);
  }

  const supabase = createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/admin/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next || "/admin/dashboard")}`);
  }

  // cookies are written by the Supabase server client
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    redirect(next);
  }

  redirect("/admin/dashboard");
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
        <p className="adminCard__desc">
          Authorized administrators only.
        </p>

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
