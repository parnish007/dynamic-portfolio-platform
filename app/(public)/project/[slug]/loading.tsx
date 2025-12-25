export default function ProjectLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16">
      {/* Title skeleton */}
      <div className="h-8 w-2/3 rounded-md bg-zinc-800/60" />

      {/* Meta / tags skeleton */}
      <div className="mt-4 flex gap-2">
        <div className="h-6 w-20 rounded-full bg-zinc-800/60" />
        <div className="h-6 w-16 rounded-full bg-zinc-800/60" />
        <div className="h-6 w-24 rounded-full bg-zinc-800/60" />
      </div>

      {/* Hero image skeleton */}
      <div className="mt-10 aspect-video w-full rounded-xl bg-zinc-800/50" />

      {/* Content skeleton */}
      <div className="mt-10 space-y-4">
        <div className="h-4 w-full rounded bg-zinc-800/60" />
        <div className="h-4 w-11/12 rounded bg-zinc-800/60" />
        <div className="h-4 w-10/12 rounded bg-zinc-800/60" />
        <div className="h-4 w-9/12 rounded bg-zinc-800/60" />
      </div>
    </main>
  );
}
