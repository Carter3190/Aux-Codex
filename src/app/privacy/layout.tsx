import { Suspense, type ReactNode } from "react";
import { LegalDocumentReviewLayout } from "@/components/legal/legal-document-review-layout";

export default function PrivacyLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <LegalDocumentReviewLayout
        documentKey="privacy"
        affirmation="I have read the Privacy Policy and agree to follow it."
      >
        {children}
      </LegalDocumentReviewLayout>
    </Suspense>
  );
}
