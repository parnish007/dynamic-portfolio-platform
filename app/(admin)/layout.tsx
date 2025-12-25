// app/(admin)/admin/layout.tsx

import type { Metadata } from "next";
import type { ReactNode } from "react";

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

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="admin-shell" data-scope="admin">
      <aside className="admin-shell__sidebar" aria-label="Admin navigation">
        <div className="admin-shell__brand">Admin Panel</div>

        <nav className="admin-shell__nav">
          <a className="admin-shell__nav-item" href="/admin/dashboard">
            Dashboard
          </a>
          <a className="admin-shell__nav-item" href="/admin/content">
            Content
          </a>
          <a className="admin-shell__nav-item" href="/admin/projects">
            Projects
          </a>
          <a className="admin-shell__nav-item" href="/admin/blogs">
            Blogs
          </a>
          <a className="admin-shell__nav-item" href="/admin/media">
            Media
          </a>
          <a className="admin-shell__nav-item" href="/admin/seo">
            SEO
          </a>
          <a className="admin-shell__nav-item" href="/admin/settings">
            Settings
          </a>
          <a className="admin-shell__nav-item" href="/admin/chat">
            Chat
          </a>
          <a className="admin-shell__nav-item" href="/admin/chatbot">
            Chatbot
          </a>
        </nav>
      </aside>

      <main className="admin-shell__main">{children}</main>
    </div>
  );
}
