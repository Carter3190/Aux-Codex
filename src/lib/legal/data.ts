import "server-only";

import type { CurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import {
  type LegalAgreement,
  type LegalAgreementKey,
} from "./agreements";

type AcceptanceRow = {
  document_key: string;
  document_version: string;
};

type VersionRow = {
  document_key: string;
  document_version: string;
  title: string;
  document_path: string;
  audience: "all" | "provider";
  effective_at: string;
  created_at: string;
};

export type LegalAcceptanceStatus = {
  migrationReady: boolean;
  missing: LegalAgreement[];
};

function migrationMissing(code?: string) {
  return code === "42P01" || code === "PGRST204" || code === "PGRST205";
}

function isLegalAgreementKey(value: string): value is LegalAgreementKey {
  return [
    "terms",
    "privacy",
    "provider_agreement",
    "provider_standards",
  ].includes(value);
}

export async function getLegalAcceptanceStatus(
  profile: CurrentProfile,
): Promise<LegalAcceptanceStatus> {
  const supabase = await createClient();
  const { data: versionData, error: versionError } = await supabase
    .from("legal_document_versions")
    .select(
      "document_key, document_version, title, document_path, audience, effective_at, created_at",
    )
    .lte("effective_at", new Date().toISOString())
    .order("effective_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (versionError) {
    if (migrationMissing(versionError.code)) {
      return { migrationReady: false, missing: [] };
    }
    throw new Error("Unable to load the current legal agreements.");
  }

  const requiredByKey = new Map<LegalAgreementKey, LegalAgreement>();
  for (const row of (versionData ?? []) as VersionRow[]) {
    if (
      !isLegalAgreementKey(row.document_key) ||
      requiredByKey.has(row.document_key) ||
      (row.audience === "provider" && profile.role !== "provider")
    ) {
      continue;
    }
    requiredByKey.set(row.document_key, {
      key: row.document_key,
      title: row.title,
      version: row.document_version,
      href: row.document_path,
      audience: row.audience,
    });
  }
  const required = [...requiredByKey.values()];
  if (required.length === 0) {
    throw new Error("No current legal agreements are configured.");
  }

  const { data, error } = await supabase
    .from("legal_acceptances")
    .select("document_key, document_version")
    .eq("user_id", profile.id);

  if (error) {
    if (migrationMissing(error.code)) {
      return { migrationReady: false, missing: [] };
    }
    throw new Error("Unable to verify the current legal agreements.");
  }

  const accepted = new Set(
    ((data ?? []) as AcceptanceRow[]).map(
      (row) => `${row.document_key}:${row.document_version}`,
    ),
  );

  return {
    migrationReady: true,
    missing: required.filter(
      (agreement) => !accepted.has(`${agreement.key}:${agreement.version}`),
    ),
  };
}
