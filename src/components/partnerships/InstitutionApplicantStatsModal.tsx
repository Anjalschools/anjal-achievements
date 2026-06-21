"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Loader2, X } from "lucide-react";

type InstitutionApplicantDashboard = {
  totalApplicants: number;
  approved: number;
  rejected: number;
  pending: number;
  acceptanceRatePct: number;
  schoolsRepresented: number;
  gradesDistribution: Array<{ grade: string; count: number }>;
};

type InstitutionApplicantStatsModalProps = {
  organizationId: string;
  organizationName: string;
  academicYear?: string;
  isAr: boolean;
  open: boolean;
  onClose: () => void;
};

const InstitutionApplicantStatsModal = ({
  organizationId,
  organizationName,
  academicYear,
  isAr,
  open,
  onClose,
}: InstitutionApplicantStatsModalProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<InstitutionApplicantDashboard | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (academicYear) params.set("academicYear", academicYear);
      const res = await fetch(
        `/api/admin/partnerships/organizations/${encodeURIComponent(organizationId)}/applicant-dashboard?${params.toString()}`,
        { cache: "no-store" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setStats(json.stats as InstitutionApplicantDashboard);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [organizationId, academicYear]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!open) return null;

  const cards = stats
    ? [
        { label: isAr ? "إجمالي المتقدمين" : "Total applicants", value: stats.totalApplicants },
        { label: isAr ? "المعتمدون" : "Approved", value: stats.approved },
        { label: isAr ? "المرفوضون" : "Rejected", value: stats.rejected },
        { label: isAr ? "قيد المعالجة" : "Pending", value: stats.pending },
        { label: isAr ? "نسبة القبول" : "Acceptance rate", value: `${stats.acceptanceRatePct}%` },
        { label: isAr ? "المدارس الممثلة" : "Schools represented", value: stats.schoolsRepresented },
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isAr ? "إحصائيات المؤسسة" : "Institution statistics"}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-lg font-black text-slate-900">
              <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
              {isAr ? "إحصائيات المؤسسة" : "Institution statistics"}
            </p>
            <p className="text-sm text-slate-500">{organizationName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-slate-100"
            aria-label={isAr ? "إغلاق" : "Close"}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-red-600">{error}</p>
        ) : stats ? (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {cards.map((card) => (
                <div key={card.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">{card.label}</p>
                  <p className="mt-1 text-xl font-black text-slate-900">{card.value}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm font-bold text-slate-800">
                {isAr ? "توزيع الصفوف" : "Grades distribution"}
              </p>
              {stats.gradesDistribution.length === 0 ? (
                <p className="text-sm text-slate-500">{isAr ? "لا توجد بيانات." : "No data available."}</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {stats.gradesDistribution.map((row) => (
                    <li
                      key={row.grade}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                    >
                      <span>{row.grade}</span>
                      <span className="font-bold">{row.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default InstitutionApplicantStatsModal;
