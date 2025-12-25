"use client";

import { useState } from "react";

type FormState = "idle" | "submitting" | "success" | "error";

export default function ContactPage() {
  const [state, setState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("submitting");
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Failed to send message");
      }

      form.reset();
      setState("success");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          Contact
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Have a question, idea, or opportunity? Send a message and I’ll get back to you.
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6">
        {state === "success" ? (
          <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/10 p-4 text-sm text-emerald-300">
            Your message has been sent successfully. Thank you!
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-zinc-300"
              >
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-600"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-300"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-600"
              />
            </div>

            <div>
              <label
                htmlFor="message"
                className="block text-sm font-medium text-zinc-300"
              >
                Message
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                required
                className="mt-2 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-600"
              />
            </div>

            {state === "error" && error ? (
              <p className="text-sm text-red-400">
                {error}
              </p>
            ) : null}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={state === "submitting"}
                className="inline-flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm font-medium hover:bg-zinc-900/60 disabled:opacity-60"
              >
                {state === "submitting" ? "Sending…" : "Send message"}
              </button>

              <span className="text-xs text-zinc-500">
                This form is protected and spam-filtered.
              </span>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
