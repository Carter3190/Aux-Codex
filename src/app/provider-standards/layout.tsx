import { Suspense, type ReactNode } from "react";
import { LegalDocumentReviewLayout } from "@/components/legal/legal-document-review-layout";

export default function ProviderStandardsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={children}>
      <LegalDocumentReviewLayout
        documentKey="provider_standards"
        affirmation="I have read the Provider Standards and agree to follow them."
      >
        {children}
      </LegalDocumentReviewLayout>
    </Suspense>
  );
}
