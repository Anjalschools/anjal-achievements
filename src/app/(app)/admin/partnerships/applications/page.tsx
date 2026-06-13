"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { GRADE_OPTIONS } from "@/constants/grades";
import { getLocale } from "@/lib/i18n";
import {
  trainingApplicationStatusBadgeClass,
  trainingApplicationStatusLabel,
} from "@/lib/partnerships/partnerships-application-status-ui";
import { STUDENT_TRAINING_APPLICATION_STATUSES } from "@/lib/partnerships/partnerships-constants";
import { ArrowLeft, Loader2 } from "lucide-react";

type ApplicationRow = {
  id: string;
  status: string;
  academicYear: string;
  submittedAt: string | null;
  opportunityTitle: string;
  organizationName: string;
  studentSnapshot: {
    fullName: string;
    grade: string;
    stage: string;
    gender: string;
    school?: string;
    schoolType?: string;
  };
};

type Dashboard = {
  total: number;
  underReview: number;
  institutionReview: number;
  accepted: number;
  rejected: number;
};

type FilterOptions = {
  organizations: Array<{ id: string; name: string }>;
  opportunities: Array<{ id: string; title: string; organizationId: string }>;
  academicYears: string[];
};

const stageLabel = (stage: string, isAr: boolean) => {
  const map: Record<string, { ar: string; en: string }> = {
    elementary: { ar: "ابتدائي", en: "Elementary" },
    middle: { ar: "متوسط", en: "Middle" },
    high: { ar: "ثانوي", en: "High" },
  };
  return map[stage]?.[isAr ? "ar" : "en"] || stage;
};

const PartnershipsApplicationsAdminPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ApplicationRow[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard>({
    total: 0,
    underReview: 0,
    institutionReview: 0,
    accepted: 0,
    rejected: 0,
  });
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    organizations: [],
    opportunities: [],
    academicYears: [],
  });
  const [status, setStatus] = useState("all");
  const [organizationId, setOrganizationId] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [grade, setGrade] = useState("");
  const [gender, setGender] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("accepted");
  const [bulkNote, setBulkNote] = useState("");
  const [bulkRejectionReason, setBulkRejectionReason] = useState("");
  const [bulkRunning, setBulkRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (organizationId) params.set("organizationId", organizationId);
      if (opportunityId) params.set("opportunityId", opportunityId);
      if (grade) params.set("grade", grade);
      if (gender) params.set("gender", gender);
      if (academicYear) params.set("academicYear", academicYear);

      const res = await fetch(`/api/admin/partnerships/applications?${params.toString()}`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");

      setItems(Array.isArray(json.items) ? json.items : []);
      setDashboard(
        json.dashboard || {
          total: 0,
          underReview: 0,
          institutionReview: 0,
          accepted: 0,
          rejected: 0,
        }
      );
      setFilterOptions(
        json.filterOptions || { organizations: [], opportunities: [], academicYears: [] }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, organizationId, opportunityId, grade, gender, academicYear]);

  useEffect(() => {
    load();
  }, [load]);

  const opportunityOptions = useMemo(() => {
    if (!organizationId) return filterOptions.opportunities;
    return filterOptions.opportunities.filter((row) => row.organizationId === organizationId);
  }, [filterOptions.opportunities, organizationId]);

  const formatDate = (value: string | null) => {
    if (!value) return isAr ? "—" : "—";
    try {
      return new Date(value).toLocaleString(isAr ? "ar-SA" : "en-US");
    } catch {
      return value;
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(items.map((row) => row.id));
  };

  const handleBulkRun = async () => {
    if (!selectedIds.length) return;
    setBulkRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/partnerships/applications/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationIds: selectedIds,
          action: bulkAction,
          note: bulkNote || undefined,
          rejectionReason: bulkRejectionReason || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setSelectedIds([]);
      setBulkNote("");
      setBulkRejectionReason("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBulkRunning(false);
    }
  };

  const dashboardCards = [
    { key: "total", label: isAr ? "إجمالي الطلبات" : "Total applications", value: dashboard.total, tone: "bg-slate-50 text-slate-900" },
    { key: "underReview", label: isAr ? "قيد المراجعة" : "Under review", value: dashboard.underReview, tone: "bg-amber-50 text-amber-950" },
    { key: "institutionReview", label: isAr ? "بانتظار المؤسسة" : "Awaiting institution", value: dashboard.institutionReview, tone: "bg-indigo-50 text-indigo-950" },
    { key: "accepted", label: isAr ? "المعتمدون" : "Accepted", value: dashboard.accepted, tone: "bg-emerald-50 text-emerald-950" },
    { key: "rejected", label: isAr ? "المرفوضون" : "Rejected", value: dashboard.rejected, tone: "bg-red-50 text-red-950" },
  ];

  return (
    <PageContainer>
      <div className="mb-4">
        <Link
          href="/admin/partnerships"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {isAr ? "العودة إلى إدارة الشراكات" : "Back to partnerships admin"}
        </Link>
      </div>

      <PageHeader
        title={isAr ? "طلبات التدريب الصيفي" : "Summer training applications"}
        subtitle={
          isAr
            ? "مراجعة واعتماد الطلاب مع فلاتر ولوحة إحصائية."
            : "Review and select students with filters and dashboard metrics."
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {dashboardCards.map((card) => (
          <div key={card.key} className={`rounded-2xl border border-border/70 p-4 shadow-sm ${card.tone}`}>
            <p className="text-xs font-semibold opacity-80">{card.label}</p>
            <p className="mt-1 text-2xl font-black">{card.value}</p>
          </div>
        ))}
      </div>

      <SectionCard className="mb-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-xl border border-border px-3 py-2 text-sm"
            aria-label={isAr ? "الحالة" : "Status"}
          >
            <option value="all">{isAr ? "كل الحالات" : "All statuses"}</option>
            {STUDENT_TRAINING_APPLICATION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {trainingApplicationStatusLabel(value, isAr)}
              </option>
            ))}
          </select>
          <select
            value={organizationId}
            onChange={(e) => {
              setOrganizationId(e.target.value);
              setOpportunityId("");
            }}
            className="rounded-xl border border-border px-3 py-2 text-sm"
            aria-label={isAr ? "المؤسسة" : "Organization"}
          >
            <option value="">{isAr ? "كل المؤسسات" : "All organizations"}</option>
            {filterOptions.organizations.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <select
            value={opportunityId}
            onChange={(e) => setOpportunityId(e.target.value)}
            className="rounded-xl border border-border px-3 py-2 text-sm"
            aria-label={isAr ? "الفرصة" : "Opportunity"}
          >
            <option value="">{isAr ? "كل الفرص" : "All opportunities"}</option>
            {opportunityOptions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.title}
              </option>
            ))}
          </select>
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="rounded-xl border border-border px-3 py-2 text-sm"
            aria-label={isAr ? "الصف" : "Grade"}
          >
            <option value="">{isAr ? "كل الصفوف" : "All grades"}</option>
            {GRADE_OPTIONS.map((row) => (
              <option key={row.value} value={row.value}>
                {isAr ? row.ar : row.en}
              </option>
            ))}
          </select>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="rounded-xl border border-border px-3 py-2 text-sm"
            aria-label={isAr ? "الجنس" : "Gender"}
          >
            <option value="">{isAr ? "الجميع" : "All"}</option>
            <option value="male">{isAr ? "بنين" : "Male"}</option>
            <option value="female">{isAr ? "بنات" : "Female"}</option>
          </select>
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="rounded-xl border border-border px-3 py-2 text-sm"
            aria-label={isAr ? "العام الدراسي" : "Academic year"}
          >
            <option value="">{isAr ? "كل الأعوام" : "All years"}</option>
            {filterOptions.academicYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </SectionCard>

      <SectionCard className="mb-4">
        <h2 className="mb-3 text-sm font-bold">{isAr ? "عمليات جماعية" : "Bulk operations"}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value)}
            className="rounded-xl border border-border px-3 py-2 text-sm"
            aria-label={isAr ? "الإجراء الجماعي" : "Bulk action"}
          >
            <option value="accepted">{isAr ? "اعتماد جماعي" : "Bulk accept"}</option>
            <option value="rejected">{isAr ? "رفض جماعي" : "Bulk reject"}</option>
            <option value="institution_review">{isAr ? "إرسال للمؤسسة" : "Send to institution"}</option>
            <option value="under_review">{isAr ? "نقل للمراجعة" : "Move to review"}</option>
            <option value="interview_requested">{isAr ? "طلب مقابلة" : "Request interview"}</option>
          </select>
          <input
            value={bulkNote}
            onChange={(e) => setBulkNote(e.target.value)}
            placeholder={isAr ? "ملاحظة (اختياري)" : "Note (optional)"}
            className="min-w-[180px] rounded-xl border border-border px-3 py-2 text-sm"
            aria-label={isAr ? "ملاحظة" : "Note"}
          />
          {bulkAction === "rejected" ? (
            <input
              value={bulkRejectionReason}
              onChange={(e) => setBulkRejectionReason(e.target.value)}
              placeholder={isAr ? "سبب الرفض" : "Rejection reason"}
              className="min-w-[180px] rounded-xl border border-border px-3 py-2 text-sm"
              aria-label={isAr ? "سبب الرفض" : "Rejection reason"}
            />
          ) : null}
          <button
            type="button"
            onClick={handleBulkRun}
            disabled={bulkRunning || selectedIds.length === 0}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {bulkRunning
              ? isAr
                ? "جاري التنفيذ…"
                : "Running…"
              : isAr
                ? `تنفيذ (${selectedIds.length})`
                : `Run (${selectedIds.length})`}
          </button>
        </div>
      </SectionCard>

      <SectionCard>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-text-light">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
          </div>
        ) : error ? (
          <p className="py-8 text-center text-red-600">{error}</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-text-light">{isAr ? "لا توجد طلبات." : "No applications."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border/70 text-start">
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selectedIds.length === items.length}
                      onChange={handleToggleSelectAll}
                      aria-label={isAr ? "تحديد الكل" : "Select all"}
                    />
                  </th>
                  <th className="px-3 py-2 font-bold">{isAr ? "الطالب" : "Student"}</th>
                  <th className="px-3 py-2 font-bold">{isAr ? "الصف" : "Grade"}</th>
                  <th className="px-3 py-2 font-bold">{isAr ? "المرحلة" : "Stage"}</th>
                  <th className="px-3 py-2 font-bold">{isAr ? "المؤسسة" : "Organization"}</th>
                  <th className="px-3 py-2 font-bold">{isAr ? "الفرصة" : "Opportunity"}</th>
                  <th className="px-3 py-2 font-bold">{isAr ? "العام الدراسي" : "Academic year"}</th>
                  <th className="px-3 py-2 font-bold">{isAr ? "التقديم" : "Submitted"}</th>
                  <th className="px-3 py-2 font-bold">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-3 py-2 font-bold">{isAr ? "إجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-b border-border/50">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => handleToggleSelect(row.id)}
                        aria-label={isAr ? "تحديد الطلب" : "Select application"}
                      />
                    </td>
                    <td className="px-3 py-3 font-semibold">{row.studentSnapshot.fullName}</td>
                    <td className="px-3 py-3">
                      {GRADE_OPTIONS.find((g) => g.value === row.studentSnapshot.grade)?.[isAr ? "ar" : "en"] ||
                        row.studentSnapshot.grade}
                    </td>
                    <td className="px-3 py-3">{stageLabel(row.studentSnapshot.stage, isAr)}</td>
                    <td className="px-3 py-3">{row.organizationName || "—"}</td>
                    <td className="px-3 py-3">{row.opportunityTitle || "—"}</td>
                    <td className="px-3 py-3">{row.academicYear || "—"}</td>
                    <td className="px-3 py-3">{formatDate(row.submittedAt)}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${trainingApplicationStatusBadgeClass(row.status)}`}
                      >
                        {trainingApplicationStatusLabel(row.status, isAr)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/partnerships/applications/${row.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        {isAr ? "فتح" : "Open"}
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

export default PartnershipsApplicationsAdminPage;
