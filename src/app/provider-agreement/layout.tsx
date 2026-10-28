import { Suspense, type ReactNode } from "react";
import { LegalDocumentReviewLayout } from "@/components/legal/legal-document-review-layout";

export default function ProviderAgreementLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={children}>
      <LegalDocumentReviewLayout
        documentKey="provider_agreement"
        affirmation="I have read the Provider Agreement and agree to follow it."
      >
        {children}
      </LegalDocumentReviewLayout>
    </Suspense>
  );
}
