import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4">
      <div className="mx-auto w-full max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Page not found
        </h1>

        <p className="mt-3 text-sm text-zinc-400">
          The page you’re looking for doesn’t exist or may have been moved.
        </p>

        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm font-medium hover:bg-zinc-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
          >
            Go back home
          </Link>
        </div>
      </div>
    </main>
  );
}
