export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <header className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-100" />
          <p className="text-sm text-zinc-300">
            Loading blog…
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <div className="h-6 w-3/4 rounded bg-zinc-800/70" />
          <div className="h-4 w-1/2 rounded bg-zinc-800/55" />
          <div className="h-4 w-2/3 rounded bg-zinc-800/45" />
        </div>
      </header>

      <section className="mt-8 space-y-4">
        <div className="h-4 w-11/12 rounded bg-zinc-800/45" />
        <div className="h-4 w-10/12 rounded bg-zinc-800/40" />
        <div className="h-4 w-9/12 rounded bg-zinc-800/35" />
        <div className="h-4 w-11/12 rounded bg-zinc-800/30" />
        <div className="h-4 w-8/12 rounded bg-zinc-800/25" />
      </section>

      <aside className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/10 p-6">
        <div className="h-4 w-32 rounded bg-zinc-800/60" />
        <div className="mt-4 space-y-2">
          <div className="h-3 w-2/3 rounded bg-zinc-800/40" />
          <div className="h-3 w-1/2 rounded bg-zinc-800/35" />
          <div className="h-3 w-3/5 rounded bg-zinc-800/30" />
        </div>
      </aside>
    </main>
  );
}
