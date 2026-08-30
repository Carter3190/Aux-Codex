import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Check your email",
};

export default function CheckEmailPage() {
  return (
    <section className="mt-10 rounded-3xl border border-border bg-white p-8 text-center shadow-[0_24px_70px_rgba(27,62,48,0.1)]">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#edf5f0] text-2xl text-brand">
        ✓
      </span>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-brand-dark">
        Check your email
      </h1>
      <p className="mt-4 leading-7 text-muted">
        We sent you a confirmation link. Open it to verify your email and finish
        creating your Auxilium account.
      </p>
      <Link
        href="/login"
        className="mt-7 inline-flex rounded-full border border-brand/25 px-6 py-3 font-semibold text-brand transition hover:bg-[#eef6f1]"
      >
        Return to sign in
      </Link>
    </section>
  );
}
