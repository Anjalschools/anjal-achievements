"use client";

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { Download, GraduationCap, Loader2, Shield } from "lucide-react";
import type { SchoolIntelligencePayload } from "@/lib/school-intelligence/school-intelligence-types";

const SchoolIntelligencePage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"success" | "degraded" | "unavailable">("success");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [data, setData] = useState<SchoolIntelligencePayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/school-intelligence", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));

      if (res.status === 401 || res.status === 403) {
        throw new Error(typeof json.error === "string" ? json.error : "Forbidden");
      }

      const responseStatus =
        json.status === "degraded" || json.status === "unavailable" ? json.status : "success";
      const friendlyMessage =
        locale === "ar"
          ? json.messageAr || json.diagnostics?.messageAr || null
          : json.messageEn || json.diagnostics?.messageEn || null;

      setData(json.intelligence || null);
      setStatus(responseStatus);
      setStatusMessage(friendlyMessage);
      setError(null);

      if (json.diagnostics?.runtimeVersion || json.diagnostics?.buildTimestamp) {
        console.log(
          "[SchoolIntelligence Runtime]",
          json.diagnostics.runtimeVersion,
          json.diagnostics.buildTimestamp
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
      setStatus("unavailable");
      setStatusMessage(
        isAr ? "تعذر تحميل شبكة الذكاء المدرسي حالياً" : "School intelligence network is unavailable right now"
      );
    } finally {
      setLoading(false);
    }
  }, [isAr, locale]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const shouldClearCaches =
      process.env.NODE_ENV === "development" ||
      new URLSearchParams(window.location.search).get("runtimeVerify") === "1";
    if (!shouldClearCaches) return;

    void (async () => {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      console.log("[SchoolIntelligence Runtime] service worker unregistered and caches cleared");
    })();
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = (report: string) => {
    const params = new URLSearchParams({
      format: "html",
      report,
      lang: isAr ? "ar" : "en",
    });
    window.open(`/api/admin/school-intelligence/export?${params.toString()}`, "_blank");
  };

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "شبكة الذكاء المدرسي" : "School intelligence network"}
        subtitle={
          isAr
            ? "طبقة موحدة للقراءة فقط — مؤشرات نجاح الطالب وتميز المدرسة"
            : "Unified read-only layer — student success and school excellence indices"
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
          <Shield className="h-3 w-3" aria-hidden />
          {isAr ? "قراءة فقط — بلا تعديل للبيانات" : "Read-only — no data mutation"}
        </span>
        {(["school", "board", "strategic_planning"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => handleExport(kind)}
            className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold"
          >
            <Download className="h-3 w-3" aria-hidden />
            {kind === "school"
              ? isAr
                ? "تقرير مدرسي"
                : "School report"
              : kind === "board"
                ? isAr
                  ? "تقرير المجلس"
                  : "Board report"
                : isAr
                  ? "التخطيط الاستراتيجي"
                  : "Strategic planning"}
          </button>
        ))}
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {status === "degraded" && statusMessage ? (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          <p className="font-semibold">{statusMessage}</p>
        </div>
      ) : null}

      {status === "unavailable" && statusMessage && !loading ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">{statusMessage}</p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري بناء شبكة الذكاء…" : "Building intelligence network…"}</span>
        </div>
      ) : !data ? (
        <p className="py-12 text-center text-text-light">{isAr ? "لا بيانات." : "No data."}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border/70 p-4">
              <p className="text-xs text-text-light">{isAr ? "تميز المدرسة" : "School excellence"}</p>
              <p className="text-3xl font-black text-emerald-700">{data.schoolExcellence.excellenceIndex}</p>
            </div>
            {[
              { label: isAr ? "مؤشر نجاح الطلاب" : "Avg student success", value: data.studentSuccessGraph.avgSuccessIndex },
              { label: isAr ? "معدل المشاركة" : "Participation rate", value: `${data.schoolExcellence.participationRatePct}%` },
              { label: isAr ? "تدخلات" : "Interventions", value: data.interventions.length },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl border border-border/70 p-4">
                <p className="text-xs text-text-light">{card.label}</p>
                <p className="text-2xl font-black">{card.value}</p>
              </div>
            ))}
          </div>

          <SectionCard>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
              <GraduationCap className="h-4 w-4" aria-hidden />
              {isAr ? "رؤى استراتيجية" : "Strategic insights"}
            </h2>
            <ul className="space-y-2 text-sm">
              {data.strategicInsights.map((ins) => (
                <li key={ins.id} className="rounded-xl bg-muted/50 px-3 py-2">
                  <p className="font-semibold">{isAr ? ins.titleAr : ins.titleEn}</p>
                  <p className="text-text-light">{isAr ? ins.bodyAr : ins.bodyEn}</p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "نجاح الطلاب (SSI)" : "Student success (SSI)"}</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/70">
                      <th className="px-2 py-2 text-start">{isAr ? "الطالب" : "Student"}</th>
                      <th className="px-2 py-2">{isAr ? "الصف" : "Grade"}</th>
                      <th className="px-2 py-2">SSI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.studentSuccessGraph.topStudents.slice(0, 12).map((row) => (
                      <tr key={row.studentId} className="border-b border-border/40">
                        <td className="px-2 py-2">{row.fullNameAr || row.fullNameEn}</td>
                        <td className="px-2 py-2 text-center">{row.grade}</td>
                        <td className="px-2 py-2 text-center font-bold">{row.successIndex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "تميز الأقسام والمسارات" : "Department excellence"}</h2>
              <ul className="divide-y divide-border/60 text-sm">
                {data.departmentExcellence.map((row) => (
                  <li key={row.key} className="flex justify-between py-2">
                    <span>{isAr ? row.labelAr : row.labelEn}</span>
                    <span className="font-bold text-emerald-700">{row.excellenceIndex}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "اكتشاف المواهب" : "Talent discovery"}</h2>
              <ul className="divide-y divide-border/60 text-sm">
                {data.talentDiscovery.slice(0, 10).map((row) => (
                  <li key={`${row.studentId}-${row.talentType}`} className="py-2">
                    <p className="font-semibold">{row.fullName}</p>
                    <p className="text-text-light">{isAr ? row.detailAr : row.detailEn}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "محرك التدخل" : "Intervention engine"}</h2>
              <ul className="divide-y divide-border/60 text-sm">
                {data.interventions.slice(0, 10).map((row) => (
                  <li key={`${row.studentId}-${row.interventionType}`} className="py-2">
                    <p className="font-semibold">{row.fullName}</p>
                    <p className="text-text-light">{isAr ? row.detailAr : row.detailEn}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "خريطة الفرص" : "Opportunity mapping"}</h2>
              <ul className="divide-y divide-border/60 text-sm">
                {data.opportunityMapping.slice(0, 10).map((row) => (
                  <li key={row.key} className="flex justify-between gap-2 py-2">
                    <span>{isAr ? row.labelAr : row.labelEn}</span>
                    <span className="font-bold text-amber-700">{row.gapPct}%</span>
                  </li>
                ))}
              </ul>
            </SectionCard>

            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "النمو الطولي" : "Growth tracking"}</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/70">
                      <th className="px-2 py-2">{isAr ? "السنة" : "Year"}</th>
                      <th className="px-2 py-2">{isAr ? "المشاركات" : "Participations"}</th>
                      <th className="px-2 py-2">{isAr ? "النمو" : "Growth"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.longitudinalGrowth.map((row) => (
                      <tr key={row.year} className="border-b border-border/40">
                        <td className="px-2 py-2 text-center">{row.year}</td>
                        <td className="px-2 py-2 text-center">{row.participations}</td>
                        <td className="px-2 py-2 text-center">{row.growthRatePct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default SchoolIntelligencePage;
