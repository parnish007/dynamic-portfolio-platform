// app/(admin)/layout.tsx

import type { Metadata } from "next";
import type { ReactNode } from "react";

import Link from "next/link";

import "@/styles/admin.css";

import AdminLogoutButton from "@/components/admin/AdminLogoutButton";

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

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/projects", label: "Projects" },
  { href: "/admin/blogs", label: "Blogs" },
  { href: "/admin/media", label: "Media" },
  { href: "/admin/seo", label: "SEO" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/chat", label: "Chat" },
  { href: "/admin/chatbot", label: "Chatbot" },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="admin" data-scope="admin">
      <div className="admin__shell">
        <aside className="admin__sidebar" aria-label="Admin navigation">
          <div className="admin__brand">
            <div className="admin__brandMark" />
            <div>
              <p className="admin__brandTitle">Admin Panel</p>
              <p
                style={{
                  margin: 0,
                  color: "var(--color-muted)",
                  fontSize: "var(--text-sm)",
                }}
              >
                Portfolio CMS
              </p>
            </div>
          </div>

          <nav className="admin__nav">
            {navItems.map((item) => (
              <Link key={item.href} className="admin__link" href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="admin__content">
          <div className="admin__topbar">
            <h1 className="admin__title">Admin</h1>

            <div
              style={{
                display: "flex",
                gap: "var(--space-3)",
                alignItems: "center",
              }}
            >
              <Link className="btn" href="/">
                View Site
              </Link>

              <AdminLogoutButton />
            </div>
          </div>

          <main className="admin__main">{children}</main>
        </div>
      </div>
    </div>
  );
}
