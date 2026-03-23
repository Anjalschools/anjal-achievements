"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import { Loader2, Sparkles } from "lucide-react";

type Narrative = {
  summaryAr: string;
  summaryEn: string;
  recommendationsAr: unknown[];
  recommendationsEn: unknown[];
};

const AdminAchievementReportsPage = () => {
  const router = useRouter();
  const locale = getLocale();
  const isAr = locale === "ar";
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [reportType, setReportType] = useState<"all" | "student" | "field" | "competition" | "urgent">("all");
  const [studentId, setStudentId] = useState("");
  const [fieldSlug, setFieldSlug] = useState("");
  const [competitionKey, setCompetitionKey] = useState("");
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<Narrative | null>(null);
  const [narrativeBusy, setNarrativeBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/profile", { cache: "no-store" });
        if (!res.ok) {
          setAllowed(false);
          return;
        }
        const data = await res.json();
        const role = String(data.role || "");
        setAllowed(
          ["admin", "supervisor", "schoolAdmin", "teacher", "judge"].includes(role)
        );
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNarrative(null);
    try {
      const params = new URLSearchParams({ type: reportType });
      if (reportType === "student" && studentId.trim()) params.set("studentId", studentId.trim());
      if (reportType === "field" && fieldSlug.trim()) params.set("field", fieldSlug.trim());
      if (reportType === "competition" && competitionKey.trim()) params.set("key", competitionKey.trim());

      const res = await fetch(`/api/admin/achievements/reports?${params}`, { cache: "no-store" });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (res.status === 403) {
        setAllowed(false);
        return;
      }
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "Request failed");
      }
      setStats((j.stats as Record<string, unknown>) || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [reportType, studentId, fieldSlug, competitionKey, router]);

  useEffect(() => {
    if (allowed !== true) return;
    if (reportType === "student" && !studentId.trim()) {
      setStats(null);
      return;
    }
    if (reportType === "field" && !fieldSlug.trim()) {
      setStats(null);
      return;
    }
    if (reportType === "competition" && !competitionKey.trim()) {
      setStats(null);
      return;
    }
    void fetchReport();
  }, [allowed, fetchReport, reportType, studentId, fieldSlug, competitionKey]);

  const handleAiNarrative = async () => {
    if (!stats) return;
    setNarrativeBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/achievements/reports/ai-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType, stats }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof j.error === "string" ? j.error : "AI failed");
      }
      setNarrative(j.narrative as Narrative);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setNarrativeBusy(false);
    }
  };

  if (allowed === false) {
    return (
      <PageContainer>
        <p className="p-6 text-sm text-red-700">
          {isAr ? "غير مصرح لك بعرض هذه الصفحة." : "You are not allowed to view this page."}
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div dir={isAr ? "rtl" : "ltr"}>
        <PageHeader
          title={isAr ? "تقارير الإنجازات" : "Achievement reports"}
          subtitle={
            isAr
              ? "إحصاءات مجمّعة وملخصات ذكية اختيارية للإدارة"
              : "Aggregated statistics with optional AI narrative"
          }
        />
        <Link
          href="/admin/achievements/review"
          className="mb-4 inline-block text-sm font-semibold text-primary hover:underline"
        >
          {isAr ? "← العودة لمراجعة الإنجازات" : "← Back to achievement review"}
        </Link>

        <div className="mb-6 flex flex-wrap gap-3 rounded-2xl border border-gray-200 bg-white p-4">
          <label className="flex flex-col text-xs font-semibold text-text-light">
            {isAr ? "نوع التقرير" : "Report type"}
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as typeof reportType)}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-text"
            >
              <option value="all">{isAr ? "جميع الإنجازات" : "All achievements"}</option>
              <option value="urgent">{isAr ? "مؤشرات مراجعة عاجلة" : "Urgent review signals"}</option>
              <option value="student">{isAr ? "طالب محدد" : "Single student"}</option>
              <option value="field">{isAr ? "حسب المجال" : "By field"}</option>
              <option value="competition">{isAr ? "مسابقة/معرّف إنجاز" : "By achievement key"}</option>
            </select>
          </label>
          {reportType === "student" ? (
            <label className="flex min-w-[220px] flex-col text-xs font-semibold text-text-light">
              studentId
              <input
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="MongoDB ObjectId"
                className="mt-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
              />
            </label>
          ) : null}
          {reportType === "field" ? (
            <label className="flex min-w-[200px] flex-col text-xs font-semibold text-text-light">
              {isAr ? "slug المجال" : "Field slug"}
              <input
                value={fieldSlug}
                onChange={(e) => setFieldSlug(e.target.value)}
                placeholder="e.g. mathematics"
                className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          ) : null}
          {reportType === "competition" ? (
            <label className="flex min-w-[200px] flex-col text-xs font-semibold text-text-light">
              {isAr ? "معرّف الإنجاز" : "Achievement name key"}
              <input
                value={competitionKey}
                onChange={(e) => setCompetitionKey(e.target.value)}
                placeholder="e.g. bebras"
                className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => void fetchReport()}
            className="self-end rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-sm font-semibold hover:bg-gray-100"
          >
            {isAr ? "تحديث" : "Refresh"}
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {loading || allowed === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          </div>
        ) : stats ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={narrativeBusy}
                onClick={() => void handleAiNarrative()}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-950 hover:bg-violet-100 disabled:opacity-50"
              >
                {narrativeBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden />
                )}
                {isAr ? "توليد ملخص ذكي (اختياري)" : "Generate AI summary (optional)"}
              </button>
              <span className="text-xs text-text-light">
                {isAr ? "يستدعي النموذج عند الطلب فقط." : "Calls the model on demand only."}
              </span>
            </div>

            {narrative ? (
              <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 text-sm">
                <h3 className="mb-2 font-bold text-violet-950">
                  {isAr ? "ملخص إداري" : "Executive summary"}
                </h3>
                <p className="whitespace-pre-wrap text-text">{isAr ? narrative.summaryAr : narrative.summaryEn}</p>
                <h4 className="mt-3 font-semibold text-violet-900">
                  {isAr ? "توصيات" : "Recommendations"}
                </h4>
                <ul className="mt-1 list-inside list-disc text-text-light">
                  {(isAr ? narrative.recommendationsAr : narrative.recommendationsEn).map((x, i) => (
                    <li key={i}>{String(x)}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="rounded-2xl border border-gray-200 bg-white p-4">
              <h3 className="mb-2 text-sm font-bold text-text">
                {isAr ? "البيانات التفصيلية (JSON)" : "Detailed data (JSON)"}
              </h3>
              <pre className="max-h-[480px] overflow-auto rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-text">
                {JSON.stringify(stats, null, 2)}
              </pre>
            </section>
          </div>
        ) : (
          <p className="text-sm text-text-light">
            {isAr ? "أدخل المعاملات المطلوبة ثم يُحمّل التقرير." : "Enter required parameters to load the report."}
          </p>
        )}
      </div>
    </PageContainer>
  );
};

export default AdminAchievementReportsPage;
