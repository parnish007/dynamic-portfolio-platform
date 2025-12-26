// app/(admin)/content/page.tsx

import type { Metadata } from "next";

import ContentTree from "@/components/admin/ContentTree";

export const metadata: Metadata = {
  title: "Content",
  robots: { index: false, follow: false },
};

export default function AdminContentPage() {
  return (
    <section style={{ maxWidth: 1200 }}>
      <header style={{ marginBottom: "var(--space-4)" }}>
        <h1 className="heading-3" style={{ margin: 0 }}>
          Content
        </h1>

        <p
          className="text-sm"
          style={{ marginTop: "var(--space-2)", color: "var(--color-muted)" }}
        >
          Manage your folder tree (unlimited nesting). Projects & blogs live inside folders.
        </p>
      </header>

      <ContentTree />
    </section>
  );
}
