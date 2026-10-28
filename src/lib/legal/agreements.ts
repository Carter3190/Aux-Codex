export type LegalAgreementKey =
  | "terms"
  | "privacy"
  | "provider_agreement"
  | "provider_standards";

export type LegalAudience = "all" | "provider";

export type LegalAgreement = {
  key: LegalAgreementKey;
  title: string;
  version: string;
  href: string;
  audience: LegalAudience;
};

export const LEGAL_AGREEMENTS = {
  terms: {
    key: "terms",
    title: "Terms of Service",
    version: "2026-10-26",
    href: "/terms",
    audience: "all",
  },
  privacy: {
    key: "privacy",
    title: "Privacy Policy",
    version: "2026-10-26",
    href: "/privacy",
    audience: "all",
  },
  providerAgreement: {
    key: "provider_agreement",
    title: "Provider Agreement",
    version: "2026-10-26",
    href: "/provider-agreement",
    audience: "provider",
  },
  providerStandards: {
    key: "provider_standards",
    title: "Provider Standards",
    version: "2026-10-26",
    href: "/provider-standards",
    audience: "provider",
  },
} as const satisfies Record<string, LegalAgreement>;

export const CURRENT_TERMS_VERSION = LEGAL_AGREEMENTS.terms.version;

const allAgreements = Object.values(LEGAL_AGREEMENTS);

export function getRequiredLegalAgreements(role: string): LegalAgreement[] {
  return allAgreements.filter(
    (agreement) =>
      agreement.audience === "all" ||
      (agreement.audience === "provider" && role === "provider"),
  );
}

export function getProviderApplicationAgreements(): LegalAgreement[] {
  return [
    LEGAL_AGREEMENTS.providerAgreement,
    LEGAL_AGREEMENTS.providerStandards,
  ];
}
