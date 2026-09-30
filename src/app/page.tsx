import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Auxilium",
    title: "Auxilium | Local help, made human",
    description:
      "Find trusted local professionals or grow your independent service business with Auxilium.",
    url: "/",
  },
};

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
    <main className="min-h-screen overflow-hidden bg-white">
      <SiteHeader
        secondaryAccountHref="/signup?role=customer"
        secondaryAccountLabel="Join Auxilium"
      />

      <div className="mx-auto max-w-[1600px] px-6 sm:px-8 lg:px-12 xl:px-16">
        <section className="grid min-h-[680px] items-center gap-14 py-16 lg:grid-cols-[0.92fr_1.08fr] lg:py-20 xl:min-h-[760px]">
          <div className="max-w-3xl">
            <p className="mb-7 text-sm font-medium uppercase tracking-[0.18em] text-foreground">
              Local help, made human
            </p>
            <h1 className="text-5xl font-normal leading-[1.02] tracking-[-0.05em] text-foreground sm:text-6xl xl:text-[5.75rem]">
              Good work should be easier to find.
            </h1>
            <p className="mt-9 max-w-2xl text-xl leading-[1.45] text-foreground sm:text-2xl">
              Auxilium connects people who need a hand with skilled local
              professionals ready to help—without losing the trust that makes
              local service personal.
            </p>
            <div className="mt-11 grid max-w-2xl gap-4 sm:grid-cols-2">
              <Link
                href="/providers"
                className="rounded-[1.05rem] border-2 border-foreground bg-foreground px-7 py-4 text-center text-lg text-white transition-colors hover:bg-white hover:text-foreground"
              >
                Find a professional
              </Link>
              <Link
                href="/signup?role=provider"
                className="rounded-[1.05rem] border-2 border-foreground bg-white px-7 py-4 text-center text-lg text-foreground transition-colors hover:bg-foreground hover:text-white"
              >
                Offer your services
              </Link>
            </div>
          </div>

          <div className="relative hidden min-h-[560px] overflow-hidden bg-[#e8dfd2] lg:block">
            <div className="absolute inset-y-0 left-[12%] w-px bg-white/60" />
            <div className="absolute inset-y-0 left-[42%] w-[18%] bg-white/25" />
            <div className="absolute -right-[8%] top-[14%] h-[72%] w-[38%] bg-[#d5c3aa]/70" />
            <div className="absolute bottom-10 left-10 right-10 border border-black/10 bg-white/95 p-8 shadow-[0_24px_70px_rgba(0,0,0,0.14)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-muted">Near Grand Rapids</p>
                  <h2 className="mt-1 text-2xl font-medium text-foreground">
                    Help for the life you live
                  </h2>
                </div>
                <span className="flex h-12 w-12 items-center justify-center border border-foreground bg-white text-xl text-foreground">
                  A
                </span>
              </div>
              <div className="mt-8 space-y-3">
                {["Home services", "Personal care", "Tutoring & coaching"].map(
                  (service, index) => (
                    <div
                      key={service}
                      className="flex items-center gap-4 border-t border-border py-4 first:border-t-0"
                    >
                      <span className="flex h-10 w-10 items-center justify-center bg-foreground text-sm font-bold text-white">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-semibold text-foreground">{service}</p>
                        <p className="mt-0.5 text-sm text-muted">Verified local providers</p>
                      </div>
                      <span aria-hidden="true" className="text-xl text-foreground">
                        →
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="scroll-mt-28 border-t border-border py-20 sm:py-28">
          <div className="mb-14 max-w-5xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-foreground">
              Built for both sides of the work
            </p>
            <h2 className="mt-5 text-4xl font-normal leading-tight tracking-[-0.045em] text-foreground sm:text-5xl lg:text-6xl">
              A clearer way to ask for help—and a better way to offer it.
            </h2>
          </div>
          <div className="grid gap-12 md:grid-cols-3 md:gap-8 xl:gap-16">
            {benefits.map((benefit) => (
              <article
                key={benefit.number}
                className="border-t border-foreground pt-6"
              >
                <span className="text-sm font-medium tracking-widest text-foreground">
                  {benefit.number}
                </span>
                <h3 className="mt-8 text-2xl font-semibold text-foreground">
                  {benefit.title}
                </h3>
                <p className="mt-5 text-lg leading-8 text-foreground">
                  {benefit.description}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
