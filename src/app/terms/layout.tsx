import { Suspense, type ReactNode } from "react";
import { LegalDocumentReviewLayout } from "@/components/legal/legal-document-review-layout";

export default function TermsLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <LegalDocumentReviewLayout
        documentKey="terms"
        affirmation="I have read the Terms of Service and agree to follow them."
      >
        {children}
      </LegalDocumentReviewLayout>
    </Suspense>
  );
}
