// components/admin/AdminLogoutButton.tsx

"use client";

import React, { useState } from "react";

type LogoutOk = { ok: true };
type LogoutErr = { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default function AdminLogoutButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLogout() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });

      const data: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          isPlainObject(data) && typeof (data as LogoutErr).error === "string"
            ? (data as LogoutErr).error
            : `Logout failed (${res.status})`;

        setError(msg);
        setLoading(false);
        return;
      }

      const ok = data as LogoutOk;

      if (!ok || ok.ok !== true) {
        setError("Logout failed.");
        setLoading(false);
        return;
      }

      // Hard redirect ensures cookies are cleared and middleware re-checks.
      window.location.href = "/admin/login";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "flex-end",
      }}
    >
      <button
        className="btn btn--danger"
        type="button"
        onClick={() => void onLogout()}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? "Logging out…" : "Logout"}
      </button>

      {error ? (
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-xs)",
            color: "var(--color-danger)",
          }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
