"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getLocale } from "@/lib/i18n";
import { useAppSession } from "@/contexts/AppSessionContext";

type Prefill = {
  universityName: string;
  major: string;
  universityAdmissionYear: number | null;
  studyCountry: string;
  industry: string;
  interests: string[];
  linkedinUrl: string;
  futureSkillsNotes: string;
};

const emptyPrefill = (): Prefill => ({
  universityName: "",
  major: "",
  universityAdmissionYear: null,
  studyCountry: "",
  industry: "",
  interests: [],
  linkedinUrl: "",
  futureSkillsNotes: "",
});

export default function AlumniPostGradOnboardingPage() {
  const locale = getLocale();
  const isAr = locale === "ar";
  const router = useRouter();
  const { refresh } = useAppSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Prefill>(() => emptyPrefill());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/user/profile", { cache: "no-store", credentials: "include" });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) throw new Error(String(data.error || "load"));
      if (data.needsAlumniOnboarding !== true) {
        router.replace("/alumni/dashboard");
        return;
      }
      const p = (data.alumniOnboardingPrefill || {}) as Record<string, unknown>;
      setForm({
        universityName: String(p.universityName || ""),
        major: String(p.major || ""),
        universityAdmissionYear:
          typeof p.universityAdmissionYear === "number" ? p.universityAdmissionYear : null,
        studyCountry: String(p.studyCountry || ""),
        industry: String(p.industry || ""),
        interests: Array.isArray(p.interests) ? (p.interests as string[]).map(String) : [],
        linkedinUrl: String(p.linkedinUrl || ""),
        futureSkillsNotes: String(p.futureSkillsNotes || ""),
      });
    } catch {
      setError(isAr ? "تعذر تحميل الملف." : "Could not load profile.");
    } finally {
      setLoading(false);
    }
  }, [isAr, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = <K extends keyof Prefill>(key: K, value: Prefill[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/alumni/post-grad-onboarding", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universityName: form.universityName,
          major: form.major,
          universityAdmissionYear: form.universityAdmissionYear,
          studyCountry: form.studyCountry,
          industry: form.industry,
          interests: form.interests,
          linkedinUrl: form.linkedinUrl || undefined,
          futureSkillsNotes: form.futureSkillsNotes || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "save");
      await refresh();
      router.replace("/alumni/dashboard");
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      if (code === "INTERESTS_REQUIRED") {
        setError(isAr ? "أضف اهتمامًا واحدًا على الأقل." : "Add at least one interest.");
      } else if (code === "MISSING_REQUIRED_FIELDS") {
        setError(isAr ? "أكمل الحقول المطلوبة." : "Complete required fields.");
      } else if (code === "INVALID_ADMISSION_YEAR") {
        setError(isAr ? "سنة القبول غير صالحة." : "Invalid admission year.");
      } else if (code === "INVALID_LINKEDIN_URL") {
        setError(isAr ? "رابط لينكدإن يجب أن يبدأ بـ http(s)." : "LinkedIn URL must start with http(s).");
      } else {
        setError(isAr ? "تعذر الحفظ." : "Could not save.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" dir={isAr ? "rtl" : "ltr"}>
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  const interestsLine = form.interests.join(isAr ? "، " : ", ");

  return (
    <div className="mx-auto max-w-2xl pb-10" dir={isAr ? "rtl" : "ltr"}>
      <h1 className="text-2xl font-black text-slate-900">
        {isAr ? "استكمال بيانات الخريج" : "Complete alumni profile"}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        {isAr
          ? "ساعدنا على تحديث مسارك الجامعي والمهني. يمكنك تعديل هذه البيانات لاحقًا من الملف الشخصي حيث يسمح النظام بذلك."
          : "Tell us about your university path and career focus. You can update later in your profile where the platform allows."}
      </p>

      <form onSubmit={(ev) => void handleSubmit(ev)} className="mt-8 space-y-5">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-800">
            {isAr ? "الجامعة / المؤسسة" : "University / institution"} *
          </label>
          <input
            required
            value={form.universityName}
            onChange={(e) => setField("universityName", e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-800">
            {isAr ? "التخصص" : "Major / program"} *
          </label>
          <input
            required
            value={form.major}
            onChange={(e) => setField("major", e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-800">
            {isAr ? "سنة القبول الجامعي" : "University admission year"} *
          </label>
          <input
            required
            type="number"
            min={1985}
            max={new Date().getFullYear() + 2}
            value={form.universityAdmissionYear ?? ""}
            onChange={(e) =>
              setField("universityAdmissionYear", e.target.value ? Number(e.target.value) : null)
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-800">
            {isAr ? "دولة الدراسة" : "Study country"} *
          </label>
          <input
            required
            value={form.studyCountry}
            onChange={(e) => setField("studyCountry", e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-800">
            {isAr ? "المسار المهني / القطاع" : "Career track / industry"} *
          </label>
          <input
            required
            value={form.industry}
            onChange={(e) => setField("industry", e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-800">
            {isAr ? "الاهتمامات (مفصولة بفواصل)" : "Interests (comma-separated)"} *
          </label>
          <input
            required
            value={interestsLine}
            onChange={(e) =>
              setField(
                "interests",
                e.target.value
                  .split(/[,،;]+/)
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            placeholder={isAr ? "ذكاء اصطناعي، ريادة أعمال، …" : "AI, entrepreneurship, …"}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-800">LinkedIn</label>
          <input
            type="url"
            value={form.linkedinUrl}
            onChange={(e) => setField("linkedinUrl", e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            placeholder="https://"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-800">
            {isAr ? "مهارات واهتمامات مستقبلية (اختياري)" : "Future skills & interests (optional)"}
          </label>
          <textarea
            value={form.futureSkillsNotes}
            onChange={(e) => setField("futureSkillsNotes", e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
        </div>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {isAr ? "حفظ ومتابعة" : "Save and continue"}
          </button>
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            {isAr ? "العودة للوحة التحكم" : "Back to dashboard"}
          </Link>
        </div>
      </form>
    </div>
  );
}
