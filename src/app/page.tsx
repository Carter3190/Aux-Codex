import type { Metadata } from "next";
import { MarketplaceShell } from "@/components/marketplace/marketplace-shell";
import { ProviderDirectory } from "@/components/marketplace/provider-directory";
import type { ProviderSearchQuery } from "@/lib/marketplace/provider-search";

export const metadata: Metadata = {
  title: "Home Page",
  description:
    "Find local providers, explore their profiles, and request your next service through Auxillium.",
  alternates: { canonical: "/" },
};

export default function HomePage({ searchParams }: {
  searchParams: Promise<ProviderSearchQuery>;
}) {
  return (
    <MarketplaceShell>
      <ProviderDirectory searchParams={searchParams} />
    </MarketplaceShell>
  );
}
