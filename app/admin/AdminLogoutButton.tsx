"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;

    try {
      setLoading(true);

      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });

      // Even if API fails, force redirect to login
      router.replace("/admin/login");
    } catch {
      router.replace("/admin/login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="btn btn--danger"
      aria-busy={loading}
    >
      {loading ? "Signing out…" : "Logout"}
    </button>
  );
}
