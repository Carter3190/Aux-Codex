import "server-only";

import type { CurrentProfile } from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import {
  getRequiredLegalAgreements,
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
  content_sha256: string;
  audience: "all" | "provider";
  effective_at: string;
  created_at: string;
};

type ReviewRow = {
  document_key: string;
  document_version: string;
  content_sha256: string;
};

export type MissingLegalDocument = LegalAgreement & {
  contentSha256: string;
  reviewed: boolean;
};

export type LegalAcceptanceStatus = {
  migrationReady: boolean;
  missing: LegalAgreement[];
  documents: MissingLegalDocument[];
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
      "document_key, document_version, title, document_path, content_sha256, audience, effective_at, created_at",
    )
    .lte("effective_at", new Date().toISOString())
    .order("effective_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (versionError) {
    if (migrationMissing(versionError.code)) {
      return { migrationReady: false, missing: [], documents: [] };
    }
    throw new Error("Unable to load the current legal agreements.");
  }

  const requiredByKey = new Map<
    LegalAgreementKey,
    { agreement: LegalAgreement; contentSha256: string }
  >();
  const expectedByKey = new Map(
    getRequiredLegalAgreements(profile.role).map((agreement) => [
      agreement.key,
      agreement,
    ]),
  );
  const expectedKeys = new Set(expectedByKey.keys());
  for (const row of (versionData ?? []) as VersionRow[]) {
    if (
      !isLegalAgreementKey(row.document_key) ||
      requiredByKey.has(row.document_key) ||
      !expectedKeys.has(row.document_key) ||
      row.audience !== expectedByKey.get(row.document_key)?.audience
    ) {
      continue;
    }
    requiredByKey.set(row.document_key, {
      agreement: {
        key: row.document_key,
        title: row.title,
        version: row.document_version,
        href: row.document_path,
        audience: row.audience,
      },
      contentSha256: row.content_sha256,
    });
  }
  const required = [...requiredByKey.values()];
  if (
    required.length !== expectedKeys.size ||
    [...expectedKeys].some((key) => !requiredByKey.has(key))
  ) {
    return { migrationReady: false, missing: [], documents: [] };
  }

  const { data, error } = await supabase
    .from("legal_acceptances")
    .select("document_key, document_version")
    .eq("user_id", profile.id);

  if (error) {
    if (migrationMissing(error.code)) {
      return { migrationReady: false, missing: [], documents: [] };
    }
    throw new Error("Unable to verify the current legal agreements.");
  }

  const accepted = new Set(
    ((data ?? []) as AcceptanceRow[]).map(
      (row) => `${row.document_key}:${row.document_version}`,
    ),
  );

  const missingRequired = required.filter(
    ({ agreement }) =>
      !accepted.has(`${agreement.key}:${agreement.version}`),
  );

  // Previously accepted accounts remain accepted. They do not need review
  // rows manufactured after the fact.
  if (missingRequired.length === 0) {
    return { migrationReady: true, missing: [], documents: [] };
  }

  const { data: reviewData, error: reviewError } = await supabase
    .from("legal_document_review_completions")
    .select("document_key, document_version, content_sha256")
    .eq("user_id", profile.id);

  if (reviewError) {
    if (migrationMissing(reviewError.code)) {
      return {
        migrationReady: false,
        missing: missingRequired.map(({ agreement }) => agreement),
        documents: missingRequired.map(({ agreement, contentSha256 }) => ({
          ...agreement,
          contentSha256,
          reviewed: false,
        })),
      };
    }
    throw new Error("Unable to verify completed legal-document reviews.");
  }

  const reviewed = new Set(
    ((reviewData ?? []) as ReviewRow[]).map(
      (row) =>
        `${row.document_key}:${row.document_version}:${row.content_sha256}`,
    ),
  );
  const documents = missingRequired.map(({ agreement, contentSha256 }) => ({
    ...agreement,
    contentSha256,
    reviewed: reviewed.has(
      `${agreement.key}:${agreement.version}:${contentSha256}`,
    ),
  }));

  return {
    migrationReady: true,
    missing: documents.map((document) => ({
      key: document.key,
      title: document.title,
      version: document.version,
      href: document.href,
      audience: document.audience,
    })),
    documents,
  };
}
