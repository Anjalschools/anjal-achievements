import { Suspense } from "react";
import CertificatePageClient from "./CertificatePageClient";
import CertificateErrorBoundary from "@/components/certificates/CertificateErrorBoundary";

export const dynamic = "force-dynamic";

const CertificateLoading = () => (
  <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-slate-600" role="status">
    Loading certificate…
  </div>
);

const AchievementCertificatePage = () => (
  <Suspense fallback={<CertificateLoading />}>
    <CertificateErrorBoundary>
      <CertificatePageClient />
    </CertificateErrorBoundary>
  </Suspense>
);

export default AchievementCertificatePage;
