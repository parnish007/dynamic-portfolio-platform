import Link from "next/link";

export default function ProjectNotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
      <p className="text-xs uppercase tracking-wider text-zinc-500">
        Project not found
      </p>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">
        This project doesn’t exist
      </h1>

      <p className="mt-4 max-w-md text-sm text-zinc-400">
        The project you’re looking for may have been removed, renamed,
        unpublished, or the link is incorrect.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-2.5 text-sm text-zinc-200 hover:bg-zinc-900/60"
        >
          Go home
        </Link>

        <Link
          href="/projects"
          className="rounded-xl border border-zinc-800 px-5 py-2.5 text-sm text-zinc-300 hover:bg-zinc-900/40"
        >
          View all projects
        </Link>
      </div>
    </main>
  );
}
