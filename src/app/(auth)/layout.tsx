import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f4f4f4] px-6 py-10 sm:py-14">
      <div className="mx-auto max-w-lg">
        <Link
          href="/"
          className="block text-center text-2xl font-medium tracking-[-0.025em] text-foreground"
        >
          Auxilium
        </Link>
        {children}
      </div>
    </main>
  );
}
