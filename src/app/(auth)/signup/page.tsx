import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create account",
};

type SignupPageProps = {
  searchParams: Promise<{ role?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { role } = await searchParams;
  const defaultRole = role === "provider" ? "provider" : "customer";

  return (
    <section className="mt-10 rounded-3xl border border-border bg-white p-7 shadow-[0_24px_70px_rgba(27,62,48,0.1)] sm:p-9">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">
        Join the community
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-brand-dark">
        Create your account
      </h1>
      <p className="mt-3 leading-7 text-muted">
        Start as a customer or apply to offer your services locally.
      </p>
      <div className="mt-8">
        <SignupForm defaultRole={defaultRole} />
      </div>
      <p className="mt-7 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand hover:text-brand-dark">
          Sign in
        </Link>
      </p>
    </section>
  );
}
