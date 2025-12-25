// app/(admin)/login/page.tsx

import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";


export const metadata: Metadata = {
  title: "Admin Login",
  robots: { index: false, follow: false },
};

// ============================================
// Server Action: Login (FINAL)
// ============================================

async function loginAction(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  const supabase = createSupabaseServerClient();


  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  // ✅ cookies are written correctly here
  redirect("/dashboard");
}

export default function AdminLoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0b0e14",
        color: "#e6e6eb",
      }}
    >
      <form
        action={loginAction}
        style={{
          width: 360,
          padding: 24,
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          Admin Login
        </h1>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            style={inputStyle}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 13, opacity: 0.8 }}>Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            style={inputStyle}
          />
        </label>

        <button
          type="submit"
          style={{
            marginTop: 6,
            padding: "10px 14px",
            borderRadius: 8,
            border: "none",
            background: "#4f7cff",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Sign in
        </button>

        <p style={{ margin: 0, fontSize: 12, opacity: 0.65 }}>
          Authorized administrators only.
        </p>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.35)",
  color: "#e6e6eb",
};
