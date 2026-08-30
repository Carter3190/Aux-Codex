import Link from "next/link";

const benefits = [
  {
    number: "01",
    title: "Find the right person",
    description:
      "Search local professionals by service, availability, credentials, and reputation.",
  },
  {
    number: "02",
    title: "Book with confidence",
    description:
      "Keep requests, communication, payments, and reviews together in one clear experience.",
  },
  {
    number: "03",
    title: "Build local momentum",
    description:
      "Independent providers get a professional home for their work and a new path to repeat clients.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-background">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <header className="flex items-center justify-between border-b border-border py-6">
          <Link
            href="/"
            className="text-xl font-bold tracking-[0.16em] text-brand-dark"
          >
            AUXILIUM
          </Link>
          <nav className="flex items-center gap-3" aria-label="Account navigation">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-semibold text-brand-dark transition hover:bg-white"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
            >
              Join Auxilium
            </Link>
          </nav>
        </header>

        <section className="grid min-h-[640px] items-center gap-14 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:py-28">
          <div>
            <p className="mb-6 text-sm font-bold uppercase tracking-[0.22em] text-brand">
              Local help, made human
            </p>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-[-0.045em] text-brand-dark sm:text-6xl lg:text-7xl">
              Good work should be easier to find.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-muted sm:text-xl">
              Auxilium connects people who need a hand with skilled local
              professionals ready to help—without losing the trust that makes
              local service personal.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup?role=customer"
                className="rounded-full bg-brand px-7 py-3.5 text-center font-semibold text-white shadow-[0_12px_30px_rgba(22,91,69,0.18)] transition hover:-translate-y-0.5 hover:bg-brand-dark"
              >
                Find a professional
              </Link>
              <Link
                href="/signup?role=provider"
                className="rounded-full border border-brand/25 bg-white px-7 py-3.5 text-center font-semibold text-brand-dark transition hover:border-brand hover:bg-[#f1f7f3]"
              >
                Offer your services
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-[#d9ebdf] blur-2xl" />
            <div className="absolute -bottom-20 -right-16 h-56 w-56 rounded-full bg-[#f5dfb9] blur-3xl" />
            <div className="relative rounded-[2rem] border border-white/80 bg-white/90 p-7 shadow-[0_30px_80px_rgba(27,62,48,0.14)] backdrop-blur sm:p-9">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-muted">Near Grand Rapids</p>
                  <h2 className="mt-1 text-2xl font-semibold text-brand-dark">
                    Help for the life you live
                  </h2>
                </div>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#edf5f0] text-xl text-brand">
                  A
                </span>
              </div>
              <div className="mt-8 space-y-3">
                {["Home services", "Personal care", "Tutoring & coaching"].map(
                  (service, index) => (
                    <div
                      key={service}
                      className="flex items-center gap-4 rounded-2xl border border-border bg-[#fbfcfa] p-4"
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-sm font-bold text-white">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{service}</p>
                        <p className="mt-0.5 text-sm text-muted">Verified local providers</p>
                      </div>
                      <span aria-hidden="true" className="text-xl text-brand">
                        →
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border py-20">
          <div className="mb-10 max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">
              Built for both sides of the work
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-brand-dark sm:text-4xl">
              A clearer way to ask for help—and a better way to offer it.
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {benefits.map((benefit) => (
              <article
                key={benefit.number}
                className="rounded-3xl border border-border bg-white p-7"
              >
                <span className="text-sm font-bold tracking-widest text-accent">
                  {benefit.number}
                </span>
                <h3 className="mt-8 text-xl font-semibold text-brand-dark">
                  {benefit.title}
                </h3>
                <p className="mt-3 leading-7 text-muted">{benefit.description}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-border py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Auxilium. Built for stronger local communities.</p>
          <div className="flex gap-5">
            <Link href="/login" className="hover:text-brand-dark">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-brand-dark">
              Create account
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
