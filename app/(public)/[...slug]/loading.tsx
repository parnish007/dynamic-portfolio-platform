export default function Loading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-100" />
          <p className="text-sm text-zinc-300">
            Loading section…
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <div className="h-4 w-2/3 rounded bg-zinc-800/70" />
          <div className="h-4 w-1/2 rounded bg-zinc-800/60" />
          <div className="h-4 w-5/6 rounded bg-zinc-800/50" />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="h-28 rounded-2xl border border-zinc-800 bg-zinc-900/30" />
          <div className="h-28 rounded-2xl border border-zinc-800 bg-zinc-900/30" />
          <div className="h-28 rounded-2xl border border-zinc-800 bg-zinc-900/30" />
        </div>
      </div>
    </main>
  );
}
