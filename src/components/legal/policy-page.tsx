import { SiteHeader } from "@/components/site-header";

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
      <SiteHeader />

      <article className="mx-auto max-w-4xl px-6 py-14 lg:px-10 lg:py-20">
        <p className="text-sm font-medium uppercase tracking-[0.17em] text-foreground">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-5xl font-normal leading-tight tracking-[-0.045em] text-foreground sm:text-6xl">
          {title}
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted">{summary}</p>
        <p className="mt-5 text-sm font-semibold text-muted">
          Last updated {updated}
        </p>

        <div className="policy-content mt-12 space-y-10 rounded-[1.25rem] border border-border bg-white p-7 sm:p-10">
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
