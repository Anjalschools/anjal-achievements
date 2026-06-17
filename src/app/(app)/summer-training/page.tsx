"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import TrainingApplicationStatusBadge from "@/components/partnerships/TrainingApplicationStatusBadge";
import ApprovedPlacementBadge, { approvedPlacementCardClass } from "@/components/partnerships/ApprovedPlacementBadge";
import { isApprovedTrainingPlacement } from "@/lib/partnerships/training-final-evaluation-ui-constants";
import TrainingCertificateActions, {
  type TrainingCertificateSummary,
} from "@/components/partnerships/TrainingCertificateActions";
import type { StudentTrainingApplicationSummary } from "@/lib/partnerships/partnerships-student-dashboard-context";
import { getLocale } from "@/lib/i18n";
import { Briefcase, Building2, CalendarDays, HelpCircle, Loader2, MessageSquarePlus, Send, Users } from "lucide-react";

type OpportunityRow = {
  id: string;
  title: string;
  description: string;
  seats: number;
  registrationEnd: string | null;
  registrationStatus?: string;
  canApply?: boolean;
  seatsFull?: boolean;
  quota?: {
    seats: number;
    remainingSeats: number;
    candidateCount: number;
    isFull: boolean;
  } | null;
  existingApplicationStatus?: string | null;
  studentApplication?: StudentTrainingApplicationSummary | null;
  organization?: {
    name: string;
    city?: string;
    sector?: string;
  };
};

const SummerTrainingListPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<OpportunityRow[]>([]);
  const [certificates, setCertificates] = useState<TrainingCertificateSummary[]>([]);
  const [historyItems, setHistoryItems] = useState<
    Array<{
      id: string;
      status: string;
      opportunityTitle: string;
      organizationName: string;
      submittedAt: string | null;
    }>
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [oppRes, ctxRes, historyRes] = await Promise.all([
        fetch("/api/partnerships/student-opportunities", { cache: "no-store" }),
        fetch("/api/partnerships/student-training-context", { cache: "no-store" }),
        fetch("/api/partnerships/applications/history", { cache: "no-store" }),
      ]);
      const json = await oppRes.json().catch(() => ({}));
      const ctxJson = await ctxRes.json().catch(() => ({}));
      const historyJson = await historyRes.json().catch(() => ({}));
      if (!oppRes.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Failed");
      }
      setItems(Array.isArray(json.items) ? json.items : []);
      setCertificates(
        ctxRes.ok && ctxJson.context?.certificates ? ctxJson.context.certificates : []
      );
      setHistoryItems(historyRes.ok && Array.isArray(historyJson.items) ? historyJson.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItems([]);
      setCertificates([]);
      setHistoryItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const formatDate = (value: string | null) => {
    if (!value) return isAr ? "غير محدد" : "Not set";
    try {
      return new Date(value).toLocaleDateString(isAr ? "ar-SA" : "en-US");
    } catch {
      return value;
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "التدريب الصيفي والشراكات" : "Summer training & partnerships"}
        subtitle={
          isAr
            ? "استعرض فرص التدريب المتاحة وقدّم على الفرصة المناسبة لك."
            : "Browse available training opportunities and apply to a suitable placement."
        }
        actions={
          <Link
            href="/summer-training/messages"
            className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-white px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label={isAr ? "رسائل التدريب" : "Training messages"}
          >
            <MessageSquarePlus className="h-4 w-4" aria-hidden />
            {isAr ? "الرسائل" : "Messages"}
          </Link>
        }
      />

      {certificates.length > 0 ? (
        <SectionCard className="mb-6">
          <h2 className="mb-3 text-lg font-bold text-foreground">
            {isAr ? "شهادات التدريب المعتمدة" : "Approved training certificates"}
          </h2>
          <div className="space-y-3">
            {certificates.map((cert) => (
              <TrainingCertificateActions key={cert.recordId} certificate={cert} isAr={isAr} compact />
            ))}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard>
        {loading ? (
          <p className="py-8 text-center text-text-light" aria-live="polite">
            {isAr ? "جاري التحميل…" : "Loading…"}
          </p>
        ) : error ? (
          <p className="py-4 text-center text-red-600" role="alert">
            {error}
          </p>
        ) : items.length === 0 ? (
          <div className="py-10 text-center">
            <p className="mb-4 text-text-light">
              {isAr ? "لا توجد فرص تدريبية متاحة حالياً." : "No training opportunities are available right now."}
            </p>
            <Link
              href="/summer-training/messages"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <MessageSquarePlus className="h-4 w-4" aria-hidden />
              {isAr ? "إرسال استفسار جديد" : "Send a new inquiry"}
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border/60" aria-label={isAr ? "قائمة فرص التدريب" : "Training opportunities list"}>
            {[...items]
              .sort((a, b) => {
                const aApproved = isApprovedTrainingPlacement(
                  a.studentApplication?.status || a.existingApplicationStatus
                );
                const bApproved = isApprovedTrainingPlacement(
                  b.studentApplication?.status || b.existingApplicationStatus
                );
                if (aApproved === bApproved) return 0;
                return aApproved ? -1 : 1;
              })
              .map((item) => {
                const placementStatus = item.studentApplication?.status || item.existingApplicationStatus;
                const isApprovedPlacement = isApprovedTrainingPlacement(placementStatus);
                return (
              <li key={item.id} className="py-4">
                <article
                  className={`rounded-xl border p-4 shadow-sm ${
                    isApprovedPlacement ? approvedPlacementCardClass : "border-border/70 bg-white"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/summer-training/${item.id}`}
                          className="text-lg font-bold text-foreground transition hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          {item.title}
                        </Link>
                        {isApprovedPlacement ? <ApprovedPlacementBadge isAr={isAr} /> : null}
                        {placementStatus ? (
                          <TrainingApplicationStatusBadge
                            status={String(placementStatus)}
                            isAr={isAr}
                            size="sm"
                          />
                        ) : null}
                      </div>
                      {item.organization?.name ? (
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-text-light">
                          <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                          <span>{item.organization.name}</span>
                          {item.organization.city ? <span>· {item.organization.city}</span> : null}
                        </p>
                      ) : null}
                      {item.description ? (
                        <p className="mt-2 line-clamp-2 text-sm text-text-light">{item.description}</p>
                      ) : null}
                    </div>
                    <Briefcase className="hidden h-5 w-5 shrink-0 text-primary sm:block" aria-hidden />
                  </div>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-text-light">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" aria-hidden />
                        {isAr ? `المقاعد: ${item.quota?.seats ?? item.seats}` : `Seats: ${item.quota?.seats ?? item.seats}`}
                      </span>
                      {item.quota ? (
                        <span>
                          {isAr
                            ? `المتبقي: ${item.quota.remainingSeats} · المتقدمون: ${item.quota.candidateCount}`
                            : `Remaining: ${item.quota.remainingSeats} · Applicants: ${item.quota.candidateCount}`}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                        {isAr ? "آخر موعد:" : "Deadline:"} {formatDate(item.registrationEnd)}
                      </span>
                    </div>
                    {item.studentApplication?.blocksReapply ? (
                      <Link
                        href={`/summer-training/${item.id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {isAr ? "متابعة الطلب" : "View application"}
                      </Link>
                    ) : item.seatsFull ? (
                      <span className="inline-flex items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-900">
                        {isAr ? "المقاعد مكتملة" : "Seats full"}
                      </span>
                    ) : (
                      <Link
                        href={`/summer-training/${item.id}#apply`}
                        className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                          item.canApply
                            ? "bg-primary text-white hover:opacity-95"
                            : "border border-border bg-muted text-foreground hover:bg-muted/80"
                        }`}
                        aria-label={isAr ? `تقديم على ${item.title}` : `Apply to ${item.title}`}
                      >
                        <Send className="h-4 w-4" aria-hidden />
                        {isAr ? "تقديم على الفرصة" : "Apply"}
                      </Link>
                    )}
                  </div>
                </article>
              </li>
                );
              })}
          </ul>
        )}
      </SectionCard>

      {historyItems.length > 0 ? (
        <SectionCard className="mt-6">
          <h2 className="mb-3 text-lg font-bold text-foreground">
            {isAr ? "السجل التاريخي للطلبات" : "Application history"}
          </h2>
          <ul className="divide-y divide-border/60">
            {historyItems.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold text-foreground">{row.opportunityTitle}</p>
                  <p className="text-xs text-text-light">{row.organizationName}</p>
                  <p className="text-xs text-text-light">
                    {isAr ? "تاريخ التقديم:" : "Submitted:"} {formatDate(row.submittedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <TrainingApplicationStatusBadge status={row.status} isAr={isAr} />
                  <Link
                    href={`/summer-training/history/${row.id}`}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    {isAr ? "عرض" : "View"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard className="mt-6">
        <div className="flex items-start gap-3">
          <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <h2 className="font-bold text-foreground">{isAr ? "مساعدة الاستخدام" : "How it works"}</h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-text-light">
              <li>{isAr ? "استعرض الفرص وقدّم على المناسبة لك." : "Browse opportunities and apply to a suitable placement."}</li>
              <li>{isAr ? "تابع حالة طلبك من لوحة التحكم أو صفحة الفرصة." : "Track your application from the dashboard or opportunity page."}</li>
              <li>{isAr ? "تواصل مع المشرف عبر مركز الرسائل." : "Contact the supervisor through the messages center."}</li>
              <li>{isAr ? "بعد القبول، ارفع التقرير النهائي لاستكمال التدريب." : "After acceptance, submit your final report to complete training."}</li>
            </ul>
          </div>
        </div>
      </SectionCard>
    </PageContainer>
  );
};

export default SummerTrainingListPage;
