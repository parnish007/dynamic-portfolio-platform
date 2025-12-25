// app/error.tsx
"use client";

import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // 🔒 Centralized error logging hook (safe + future-proof)
    if (process.env.NODE_ENV !== "development") {
      // Example future hooks:
      // logErrorToService(error);
      // sendErrorEvent({ message: error.message, digest: error.digest });
    }

    console.error(error);
  }, [error]);

  return (
    <main
      role="alert"
      className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4"
    >
      <div className="mx-auto w-full max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Something went wrong
        </h1>

        <p className="mt-3 text-sm text-zinc-400">
          An unexpected error occurred while rendering this page.
        </p>

        {/* Optional digest for internal debugging (safe, opaque) */}
        {error.digest && (
          <p className="mt-2 text-xs text-zinc-600">
            Error reference: {error.digest}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm font-medium hover:bg-zinc-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
          >
            Try again
          </button>

          <span className="text-xs text-zinc-500">
            If this keeps happening, please refresh or come back later.
          </span>
        </div>
      </div>
    </main>
  );
}
