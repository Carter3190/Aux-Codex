"use client";

import Link from "next/link";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <section className="w-full max-w-2xl rounded-[2rem] border border-border bg-white p-8 text-center shadow-[0_24px_70px_rgba(27,62,48,0.12)] sm:p-12">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">
          Something went wrong
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-brand-dark">
          We couldn’t load this page.
        </h1>
        <p className="mx-auto mt-4 max-w-lg leading-7 text-muted">
          Your information is still safe. Try the request again, or return to
          the Auxilium homepage.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-full bg-brand px-6 py-3 font-semibold text-white transition hover:bg-brand-dark"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full border border-border px-6 py-3 font-semibold text-brand-dark transition hover:border-brand hover:bg-[#eef6f1]"
          >
            Return home
          </Link>
        </div>
      </section>
    </main>
  );
}
