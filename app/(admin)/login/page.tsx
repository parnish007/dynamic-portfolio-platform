// app/(admin)/login/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Login",
  robots: { index: false, follow: false },
};

type ApiErr = { ok: false; error: string; details?: string };

type LoginOk = {
  ok: true;
  user: {
    id: string;
    email?: string;
  };
};

async function login(formData: FormData): Promise<LoginOk | ApiErr> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      body: formData,
      cache: "no-store",
    });

    const data = (await res.json()) as LoginOk | ApiErr;
    return data;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error.";
    return { ok: false, error: "Login failed.", details: msg };
  }
}

/**
 * Admin Login Page
 * -----------------------------
 * - Uses /api/auth/login
 * - Server Action based form
 * - No hardcoded credentials
 * - Middleware will redirect authenticated users away
 */
export default function AdminLoginPage() {
  async function action(formData: FormData) {
    "use server";
    const result = await login(formData);
    if (result.ok) {
      // middleware will redirect after auth cookie is set
      return;
    }
    throw new Error(result.error);
  }

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
        action={action}
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
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Admin Login</h1>

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
