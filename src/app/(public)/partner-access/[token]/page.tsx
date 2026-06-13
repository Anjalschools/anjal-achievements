"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Building2, ExternalLink, Loader2, Users } from "lucide-react";
import { INSTITUTION_DECISION_LABELS } from "@/lib/partnerships/partnerships-messaging-constants";

type CandidateRow = {
  applicationId: string;
  institutionStatus: string;
  student: {
    fullName: string;
    grade: string;
    stage: string;
    school: string;
  };
  excellenceScore: number;
  achievementSummary: Array<{ title: string; outcome: string; year: string }>;
  portfolioUrl: string | null;
};

type OpportunityGroup = {
  opportunityId: string;
  opportunityTitle: string;
  candidateCount: number;
  candidates: CandidateRow[];
};

type AccessPayload = {
  organization: { id: string; name: string; city: string; sector: string };
  expiresAt: string | null;
  opportunities: OpportunityGroup[];
  totalCandidates: number;
};

const DECISION_OPTIONS = [
  "institution_pending",
  "institution_interview",
  "institution_accepted",
  "institution_rejected",
] as const;

const PartnerAccessPage = () => {
  const params = useParams();
  const token = String(params.token || "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AccessPayload | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notesByApp, setNotesByApp] = useState<Record<string, string>>({});
  const [decisionByApp, setDecisionByApp] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/partner-access/${encodeURIComponent(token)}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "رابط غير صالح أو منتهي");
      }
      setData(json as AccessPayload);
      const initial: Record<string, string> = {};
      for (const opp of (json.opportunities || []) as OpportunityGroup[]) {
        for (const c of opp.candidates) {
          initial[c.applicationId] = c.institutionStatus;
        }
      }
      setDecisionByApp(initial);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmitDecision = async (applicationId: string) => {
    const decision = decisionByApp[applicationId];
    if (!decision) return;
    setSavingId(applicationId);
    setError(null);
    try {
      const res = await fetch(`/api/partner-access/${encodeURIComponent(token)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          decision,
          notes: notesByApp[applicationId] || "",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "فشل الحفظ");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-bold text-red-600">{error}</p>
        <Link href="/" className="mt-4 inline-block text-sm text-primary underline">
          العودة للرئيسية
        </Link>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8" dir="rtl">
      <header className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <Building2 className="mt-1 h-8 w-8 text-primary" aria-hidden />
          <div>
            <p className="text-sm text-slate-500">بوابة المؤسسة الشريكة</p>
            <h1 className="text-2xl font-black text-slate-900">{data.organization.name}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {[data.organization.city, data.organization.sector].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-slate-700">
              <Users className="h-4 w-4" aria-hidden />
              {data.totalCandidates} مرشح
            </p>
            {data.expiresAt ? (
              <p className="mt-1 text-xs text-amber-700">
                صلاحية الرابط حتى: {new Date(data.expiresAt).toLocaleDateString("ar-SA")}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {error ? <p className="mb-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

      {data.opportunities.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-slate-600">
          لا يوجد مرشحون حالياً بانتظار مراجعة المؤسسة.
        </p>
      ) : (
        data.opportunities.map((opp) => (
          <section key={opp.opportunityId} className="mb-8">
            <h2 className="mb-4 text-xl font-black text-slate-900">{opp.opportunityTitle}</h2>
            <p className="mb-4 text-sm text-slate-600">{opp.candidateCount} مرشح</p>
            <div className="space-y-4">
              {opp.candidates.map((candidate) => (
                <article
                  key={candidate.applicationId}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">{candidate.student.fullName}</h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {candidate.student.grade} · {candidate.student.stage} · {candidate.student.school}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-primary">
                        مؤشر التميز: {candidate.excellenceScore}/100
                      </p>
                    </div>
                    {candidate.portfolioUrl ? (
                      <a
                        href={candidate.portfolioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-200"
                      >
                        ملف الإنجاز
                        <ExternalLink className="h-4 w-4" aria-hidden />
                      </a>
                    ) : null}
                  </div>

                  {candidate.achievementSummary.length > 0 ? (
                    <div className="mt-4 rounded-xl bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-bold text-slate-500">ملخص الإنجازات</p>
                      <ul className="space-y-1 text-sm text-slate-700">
                        {candidate.achievementSummary.slice(0, 5).map((item, idx) => (
                          <li key={idx}>
                            {item.title}
                            {item.outcome ? ` — ${item.outcome}` : ""}
                            {item.year ? ` (${item.year})` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">لا توجد إنجازات معتمدة مسجلة.</p>
                  )}

                  <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-bold text-slate-700">قرار المؤسسة</span>
                      <select
                        value={decisionByApp[candidate.applicationId] || candidate.institutionStatus}
                        onChange={(e) =>
                          setDecisionByApp((prev) => ({
                            ...prev,
                            [candidate.applicationId]: e.target.value,
                          }))
                        }
                        className="rounded-xl border border-slate-200 px-3 py-2"
                        aria-label={`قرار ${candidate.student.fullName}`}
                      >
                        {DECISION_OPTIONS.map((value) => (
                          <option key={value} value={value}>
                            {INSTITUTION_DECISION_LABELS[value].ar}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="min-w-[200px] flex-1 text-sm">
                      <span className="font-bold text-slate-700">ملاحظات</span>
                      <input
                        type="text"
                        value={notesByApp[candidate.applicationId] || ""}
                        onChange={(e) =>
                          setNotesByApp((prev) => ({
                            ...prev,
                            [candidate.applicationId]: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                        placeholder="ملاحظات اختيارية"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleSubmitDecision(candidate.applicationId)}
                      disabled={savingId === candidate.applicationId}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                    >
                      {savingId === candidate.applicationId ? "جاري الحفظ..." : "حفظ القرار"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
};

export default PartnerAccessPage;
