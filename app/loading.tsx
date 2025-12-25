// app/loading.tsx

export default function Loading() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-100" />
        <p className="text-sm text-zinc-400">
          Loading…
        </p>
      </div>
    </main>
  );
}
