import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <section className="mt-10 rounded-[1.25rem] border border-border bg-white p-7 shadow-[0_18px_55px_rgba(0,0,0,0.07)] sm:p-10">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-foreground">
        Welcome back
      </p>
      <h1 className="mt-4 text-4xl font-normal tracking-[-0.04em] text-foreground">
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
        <Link href="/signup" className="font-semibold text-foreground underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </section>
  );
}
