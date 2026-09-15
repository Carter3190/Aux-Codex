import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <section className="w-full max-w-2xl rounded-[2rem] border border-border bg-white p-8 text-center sm:p-12">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">
          Page not found
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-brand-dark">
          This page isn’t available.
        </h1>
        <p className="mx-auto mt-4 max-w-lg leading-7 text-muted">
          The address may have changed, or the page may no longer exist.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-full bg-brand px-6 py-3 font-semibold text-white transition hover:bg-brand-dark"
        >
          Return home
        </Link>
      </section>
    </main>
  );
}
