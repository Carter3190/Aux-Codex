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
    <section className="mt-10 rounded-[1.25rem] border border-border bg-white p-7 shadow-[0_18px_55px_rgba(0,0,0,0.07)] sm:p-10">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-foreground">
        Join the community
      </p>
      <h1 className="mt-4 text-4xl font-normal tracking-[-0.04em] text-foreground">
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
        <Link href="/login" className="font-semibold text-foreground underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </section>
  );
}
