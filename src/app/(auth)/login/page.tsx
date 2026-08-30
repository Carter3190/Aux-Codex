import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <section className="mt-10 rounded-3xl border border-border bg-white p-7 shadow-[0_24px_70px_rgba(27,62,48,0.1)] sm:p-9">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">
        Welcome back
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-brand-dark">
        Sign in to Auxilium
      </h1>
      <p className="mt-3 leading-7 text-muted">
        Access your bookings, profile, and conversations.
      </p>
      <div className="mt-8">
        <LoginForm />
      </div>
      <p className="mt-7 text-center text-sm text-muted">
        New to Auxilium?{" "}
        <Link href="/signup" className="font-semibold text-brand hover:text-brand-dark">
          Create an account
        </Link>
      </p>
    </section>
  );
}
