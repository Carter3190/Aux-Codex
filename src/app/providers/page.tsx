import { permanentRedirect } from "next/navigation";
import { getProviderHomeDestination, type ProviderSearchQuery } from "@/lib/marketplace/provider-search";

export default async function ProvidersPage({ searchParams }: {
  searchParams: Promise<ProviderSearchQuery>;
}) {
  permanentRedirect(getProviderHomeDestination(await searchParams));
}
