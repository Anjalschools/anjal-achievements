"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { trainingApplicationStatusLabel } from "@/lib/partnerships/partnerships-application-status-ui";
import { Loader2 } from "lucide-react";

type Row = {
  applicationId: string;
  status: string;
  studentName: string;
  opportunityTitle: string;
  organizationName: string;
  aiVerificationScore: number | null;
  aiClassification: string | null;
  supervisorReviewStatus: string;
};

const AdminFinalEvaluationsPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Row[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/partnerships/final-evaluations", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setItems(Array.isArray(json.items) ? json.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "مراجعة التقييمات النهائية" : "Final evaluation review"}
        subtitle={isAr ? "اعتماد أو رفض تقييمات التدريب النهائية." : "Approve or reject final training evaluations."}
      />

      <SectionCard>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-text-light">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          </div>
        ) : error ? (
          <p className="py-8 text-center text-red-600">{error}</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-text-light">{isAr ? "لا توجد تقييمات." : "No evaluations."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 text-start">
                  <th className="px-3 py-2 font-bold">{isAr ? "الطالب" : "Student"}</th>
                  <th className="px-3 py-2 font-bold">{isAr ? "الفرصة" : "Opportunity"}</th>
                  <th className="px-3 py-2 font-bold">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-3 py-2 font-bold">{isAr ? "التحقق الآلي" : "AI score"}</th>
                  <th className="px-3 py-2 font-bold">{isAr ? "إجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.applicationId} className="border-b border-border/50">
                    <td className="px-3 py-3 font-semibold">{row.studentName}</td>
                    <td className="px-3 py-3">
                      <div>{row.opportunityTitle}</div>
                      <div className="text-xs text-text-light">{row.organizationName}</div>
                    </td>
                    <td className="px-3 py-3">{trainingApplicationStatusLabel(row.status, isAr)}</td>
                    <td className="px-3 py-3">
                      {row.aiVerificationScore != null ? `${row.aiVerificationScore}%` : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/partnerships/final-evaluations/${row.applicationId}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {isAr ? "مراجعة" : "Review"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PageContainer>
  );
};

export default AdminFinalEvaluationsPage;
