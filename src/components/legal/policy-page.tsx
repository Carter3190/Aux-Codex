import Link from "next/link";

export function PolicyPage({
  eyebrow,
  title,
  summary,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="bg-background">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-5 px-6 py-5 lg:px-10">
          <Link
            href="/"
            className="text-lg font-bold tracking-[0.18em] text-brand-dark"
          >
            AUXILIUM
          </Link>
          <Link
            href="/providers"
            className="text-sm font-semibold text-brand transition hover:text-brand-dark"
          >
            Browse providers
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-6 py-14 lg:px-10 lg:py-20">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-brand-dark sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">{summary}</p>
        <p className="mt-5 text-sm font-semibold text-muted">
          Last updated {updated}
        </p>

        <div className="policy-content mt-12 space-y-10 rounded-[2rem] border border-border bg-white p-7 sm:p-10">
          {children}
        </div>
      </article>
    </main>
  );
}

export function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-2xl font-semibold tracking-tight text-brand-dark">
        {title}
      </h2>
      <div className="mt-4 space-y-4 leading-7 text-muted">{children}</div>
    </section>
  );
}
