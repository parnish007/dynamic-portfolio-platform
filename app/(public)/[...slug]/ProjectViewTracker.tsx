// app/(public)/project/[slug]/ProjectViewTracker.tsx

"use client";

import { useEffect, useRef } from "react";

type Props = {
  projectId: string;
  slug: string;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export default function ProjectViewTracker({ projectId, slug }: Props) {
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const pid = isNonEmptyString(projectId) ? projectId.trim() : "";
    const s = isNonEmptyString(slug) ? slug.trim() : "";

    if (!pid || !s) return;

    // Best-effort fire-and-forget: should NEVER break UI.
    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        name: "project_view",
        data: { projectId: pid, slug: s },
      }),
    }).catch(() => {});
  }, [projectId, slug]);

  return null;
}
