import type { Metadata } from "next";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Project setup",
};

export default function SetupPage() {
  const configured = isSupabaseConfigured();

  return (
    <main className="min-h-screen bg-background px-6 py-16">
      <section className="mx-auto max-w-2xl rounded-3xl border border-border bg-white p-8 shadow-[0_24px_70px_rgba(27,62,48,0.1)] sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">
          Developer setup
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-brand-dark">
          {configured
            ? "Supabase credentials are connected."
            : "Connect the Supabase project to continue."}
        </h1>
        <p className="mt-4 leading-7 text-muted">
          Add the project URL and publishable key to <code>.env.local</code>, then
          run the profiles, provider-onboarding, and customer-marketplace migrations in the Supabase SQL
          Editor. Full instructions are included in the repository README.
        </p>
        <div className="mt-7 rounded-2xl bg-[#f4f7f4] p-5 font-mono text-sm leading-7 text-brand-dark">
          <p>NEXT_PUBLIC_SUPABASE_URL=</p>
          <p>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=</p>
        </div>
        <p className="mt-5 text-sm leading-6 text-muted">
          Never place a Supabase secret key or service-role key in a variable that
          begins with <code>NEXT_PUBLIC_</code>.
        </p>
        <p className="mt-3 text-sm leading-6 text-muted">
          If authentication is already working, you only need to run the newer
          <code> 20260901000000_customer_marketplace.sql</code> migration.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex rounded-full bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark"
        >
          Return home
        </Link>
      </section>
    </main>
  );
}
