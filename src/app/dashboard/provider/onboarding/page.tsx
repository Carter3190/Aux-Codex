import type { Metadata } from "next";
import { ProviderProfileWorkspace } from "@/components/provider/provider-profile-workspace";
import { getProviderWorkspace } from "@/lib/providers/data";

export const metadata: Metadata = { title: "Your provider profile" };

export default async function ProviderOnboardingPage({ searchParams }: {
  searchParams: Promise<{ section?: string }>;
}) {
  const [workspace, query] = await Promise.all([getProviderWorkspace(), searchParams]);
  return <ProviderProfileWorkspace workspace={workspace} section={query.section} />;
}
