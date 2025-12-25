"use client";

import { useEffect } from "react";
import Link from "next/link";

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ProjectError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Project page error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
      <p className="text-xs uppercase tracking-wider text-red-500">
        Something went wrong
      </p>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">
        Failed to load project
      </h1>

      <p className="mt-4 max-w-md text-sm text-zinc-400">
        An unexpected error occurred while loading this project.  
        You can try again or return to a safe page.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <button
          onClick={reset}
          className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-2.5 text-sm text-zinc-200 hover:bg-zinc-900/60"
        >
          Retry
        </button>

        <Link
          href="/"
          className="rounded-xl border border-zinc-800 px-5 py-2.5 text-sm text-zinc-300 hover:bg-zinc-900/40"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
