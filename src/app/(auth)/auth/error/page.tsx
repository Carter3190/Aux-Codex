import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Confirmation problem",
};

export default function AuthErrorPage() {
  return (
    <section className="mt-10 rounded-3xl border border-border bg-white p-8 text-center shadow-[0_24px_70px_rgba(27,62,48,0.1)]">
      <h1 className="text-3xl font-semibold tracking-tight text-brand-dark">
        That confirmation link did not work
      </h1>
      <p className="mt-4 leading-7 text-muted">
        The link may have expired or already been used. Try signing in, or create
        your account again to receive a new email.
      </p>
      <div className="mt-7 flex justify-center gap-3">
        <Link
          href="/login"
          className="rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-full border border-brand/25 px-6 py-3 font-semibold text-brand hover:bg-[#eef6f1]"
        >
          Sign up
        </Link>
      </div>
    </section>
  );
}
