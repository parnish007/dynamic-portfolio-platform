// C:\Users\AB\Desktop\portfolio-website\app\(admin)\layout.tsx

import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "Admin · %s",
  },
  robots: {
    index: false,
    follow: false,
  },
};

type AdminLayoutProps = {
  children: ReactNode;
};

/**
 * Admin Layout
 * - Wraps all admin pages
 * - NO auth logic here (middleware handles auth)
 * - IMPORTANT: No <html> or <body> in nested layouts
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="admin-shell" data-scope="admin">
      <aside className="admin-shell__sidebar" aria-label="Admin navigation">
        <div className="admin-shell__brand">Admin Panel</div>

        <nav className="admin-shell__nav">
          <span className="admin-shell__nav-item">Dashboard</span>
          <span className="admin-shell__nav-item">Content</span>
          <span className="admin-shell__nav-item">Projects</span>
          <span className="admin-shell__nav-item">Blogs</span>
          <span className="admin-shell__nav-item">Media</span>
          <span className="admin-shell__nav-item">SEO</span>
          <span className="admin-shell__nav-item">Settings</span>
        </nav>
      </aside>

      <main className="admin-shell__main">{children}</main>
    </div>
  );
}
