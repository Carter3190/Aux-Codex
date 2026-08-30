import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background px-6 py-8 sm:py-12">
      <div className="mx-auto max-w-md">
        <Link
          href="/"
          className="block text-center text-lg font-bold tracking-[0.18em] text-brand-dark"
        >
          AUXILIUM
        </Link>
        {children}
      </div>
    </main>
  );
}
