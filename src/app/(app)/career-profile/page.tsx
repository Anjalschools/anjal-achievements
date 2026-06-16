"use client";

import { useCallback, useEffect, useState } from "react";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import { Briefcase, Download, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import GraduateReadinessWidget from "@/components/career/GraduateReadinessWidget";

type CareerPayload = {
  profile: { fullName: string; gradeLabelAr: string; gradeLabelEn: string };
  editable: {
    professionalBio: string;
    professionalBioEn: string;
    careerInterests: string[];
    targetMajors: string[];
    manualSkills: string[];
    publicVisibility: {
      showAchievements: boolean;
      showTraining: boolean;
      showVolunteer: boolean;
      showResume: boolean;
    };
  };
  scores: {
    careerReadinessScore: number;
    universityReadinessScore: number;
    volunteerHours: number;
    trainingHours: number;
    achievementsScore: number;
    leadershipScore: number;
    skillsScore: number;
  };
  skills: string[];
  achievements: { items: Array<{ title: string; outcome: string; year: string }>; excellenceScore: number };
  training: Array<{ id: string; organizationName: string; volunteerHours: number; status: string }>;
  volunteer: Array<{ id: string; title: string; organization: string; hours: number; status: string }>;
  certificates: Array<{ id: string; title: string; verificationPath: string | null }>;
  recommendations: Array<{ type: string; titleAr: string; titleEn: string; reasonAr: string; reasonEn: string }>;
  insights: { career: string; university: string; skillGap: string };
  publicPortfolioUrl: string | null;
};

type VolunteerForm = { title: string; organization: string; hours: number; description: string };

const emptyVolunteer = (): VolunteerForm => ({ title: "", organization: "", hours: 0, description: "" });

const CareerProfilePage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CareerPayload | null>(null);
  const [bio, setBio] = useState("");
  const [bioEn, setBioEn] = useState("");
  const [interests, setInterests] = useState("");
  const [majors, setMajors] = useState("");
  const [visibility, setVisibility] = useState({
    showAchievements: true,
    showTraining: false,
    showVolunteer: false,
    showResume: false,
  });
  const [volunteerForm, setVolunteerForm] = useState<VolunteerForm>(emptyVolunteer);
  const [volunteerSaving, setVolunteerSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/user/career-profile?lang=${isAr ? "ar" : "en"}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      const item = json.item as CareerPayload;
      setData(item);
      setBio(item.editable.professionalBio || "");
      setBioEn(item.editable.professionalBioEn || "");
      setInterests((item.editable.careerInterests || []).join(", "));
      setMajors((item.editable.targetMajors || []).join(", "));
      setVisibility(item.editable.publicVisibility);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isAr]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/career-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalBio: bio,
          professionalBioEn: bioEn,
          careerInterests: interests.split(",").map((s) => s.trim()).filter(Boolean),
          targetMajors: majors.split(",").map((s) => s.trim()).filter(Boolean),
          publicVisibility: visibility,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = (kind: string) => {
    window.open(
      `/api/user/career-profile/export?kind=${encodeURIComponent(kind)}&lang=${isAr ? "ar" : "en"}`,
      "_blank"
    );
  };

  const handleAddVolunteer = async () => {
    if (!volunteerForm.title.trim() || !volunteerForm.organization.trim()) return;
    setVolunteerSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/volunteer-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...volunteerForm, submit: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setVolunteerForm(emptyVolunteer());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setVolunteerSaving(false);
    }
  };

  const handleDeleteVolunteer = async (id: string) => {
    if (!window.confirm(isAr ? "حذف هذا السجل؟" : "Delete this record?")) return;
    try {
      const res = await fetch(`/api/user/volunteer-records/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  };

  const scoreCards = data
    ? [
        { label: isAr ? "الجاهزية المهنية" : "Career readiness", value: data.scores.careerReadinessScore },
        { label: isAr ? "الجاهزية الجامعية" : "University readiness", value: data.scores.universityReadinessScore },
        { label: isAr ? "ساعات التدريب" : "Training hours", value: data.scores.trainingHours },
        { label: isAr ? "ساعات التطوع" : "Volunteer hours", value: data.scores.volunteerHours },
      ]
    : [];

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "الملف المهني والجامعي" : "Career & university profile"}
        subtitle={
          isAr
            ? "ملف موحد يجمع إنجازاتك وتدريبك وتطوعك ومهاراتك."
            : "A unified profile combining achievements, training, volunteering, and skills."
        }
      />

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-text-light">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          <span>{isAr ? "جاري التحميل…" : "Loading…"}</span>
        </div>
      ) : !data ? (
        <p className="py-12 text-center text-text-light">{isAr ? "تعذر تحميل الملف." : "Could not load profile."}</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {scoreCards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold text-text-light">{card.label}</p>
                <p className="mt-1 text-2xl font-black text-primary">{card.value}</p>
              </div>
            ))}
          </div>

          <GraduateReadinessWidget />

          <SectionCard>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              {isAr ? "رؤى ذكية" : "AI insights"}
            </h2>
            <div className="space-y-2 text-sm text-foreground">
              <p><strong>{isAr ? "مهني:" : "Career:"}</strong> {data.insights.career}</p>
              <p><strong>{isAr ? "جامعي:" : "University:"}</strong> {data.insights.university}</p>
              <p><strong>{isAr ? "فجوات المهارات:" : "Skill gaps:"}</strong> {data.insights.skillGap}</p>
            </div>
          </SectionCard>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "نبذة احترافية" : "Professional summary"}</h2>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="mb-2 min-h-24 w-full rounded-xl border border-border px-3 py-2 text-sm"
                placeholder={isAr ? "نبذة بالعربية" : "Summary in Arabic"}
                aria-label={isAr ? "نبذة عربية" : "Arabic summary"}
              />
              <textarea
                value={bioEn}
                onChange={(e) => setBioEn(e.target.value)}
                className="mb-3 min-h-24 w-full rounded-xl border border-border px-3 py-2 text-sm"
                placeholder={isAr ? "نبذة بالإنجليزية" : "Summary in English"}
                aria-label={isAr ? "نبذة إنجليزية" : "English summary"}
              />
              <input
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                className="mb-2 w-full rounded-xl border border-border px-3 py-2 text-sm"
                placeholder={isAr ? "الاهتمامات (مفصولة بفاصلة)" : "Interests (comma-separated)"}
                aria-label={isAr ? "الاهتمامات" : "Interests"}
              />
              <input
                value={majors}
                onChange={(e) => setMajors(e.target.value)}
                className="mb-3 w-full rounded-xl border border-border px-3 py-2 text-sm"
                placeholder={isAr ? "التخصصات المستهدفة" : "Target majors"}
                aria-label={isAr ? "التخصصات" : "Target majors"}
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? (isAr ? "جاري الحفظ…" : "Saving…") : isAr ? "حفظ" : "Save"}
              </button>
            </SectionCard>

            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "المهارات المستخرجة" : "Extracted skills"}</h2>
              <div className="flex flex-wrap gap-2">
                {data.skills.length === 0 ? (
                  <p className="text-sm text-text-light">{isAr ? "لا مهارات بعد." : "No skills yet."}</p>
                ) : (
                  data.skills.map((skill) => (
                    <span key={skill} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                      {skill}
                    </span>
                  ))
                )}
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "التدريب" : "Training"}</h2>
              {data.training.length === 0 ? (
                <p className="text-sm text-text-light">{isAr ? "لا سجلات تدريب." : "No training records."}</p>
              ) : (
                <ul className="divide-y divide-border/60 text-sm">
                  {data.training.map((row) => (
                    <li key={row.id} className="py-2">
                      <p className="font-semibold">{row.organizationName}</p>
                      <p className="text-text-light">
                        {row.volunteerHours} {isAr ? "ساعة" : "hrs"} · {row.status}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard>
              <h2 className="mb-3 text-base font-bold">{isAr ? "مركز التطوع" : "Volunteer center"}</h2>
              <div className="mb-3 space-y-2">
                <input
                  value={volunteerForm.title}
                  onChange={(e) => setVolunteerForm((p) => ({ ...p, title: e.target.value }))}
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  placeholder={isAr ? "عنوان النشاط" : "Activity title"}
                  aria-label={isAr ? "عنوان النشاط" : "Activity title"}
                />
                <input
                  value={volunteerForm.organization}
                  onChange={(e) => setVolunteerForm((p) => ({ ...p, organization: e.target.value }))}
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  placeholder={isAr ? "الجهة" : "Organization"}
                  aria-label={isAr ? "الجهة" : "Organization"}
                />
                <input
                  type="number"
                  min={0}
                  value={volunteerForm.hours}
                  onChange={(e) => setVolunteerForm((p) => ({ ...p, hours: Number(e.target.value) || 0 }))}
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                  placeholder={isAr ? "الساعات" : "Hours"}
                  aria-label={isAr ? "الساعات" : "Hours"}
                />
                <button
                  type="button"
                  onClick={handleAddVolunteer}
                  disabled={volunteerSaving}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-semibold"
                >
                  {volunteerSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                  {isAr ? "إضافة تطوع" : "Add volunteer record"}
                </button>
              </div>
              <ul className="divide-y divide-border/60 text-sm">
                {data.volunteer.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-2 py-2">
                    <div>
                      <p className="font-semibold">{row.title}</p>
                      <p className="text-text-light">
                        {row.organization} · {row.hours} {isAr ? "ساعة" : "hrs"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDeleteVolunteer(row.id)}
                      className="rounded-lg border border-red-200 p-1 text-red-600"
                      aria-label={isAr ? "حذف" : "Delete"}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <SectionCard>
            <h2 className="mb-3 text-base font-bold">{isAr ? "التوصيات" : "Recommendations"}</h2>
            <ul className="space-y-2 text-sm">
              {data.recommendations.map((rec, idx) => (
                <li key={`${rec.type}-${idx}`} className="rounded-xl bg-muted/60 px-3 py-2">
                  <p className="font-semibold">{isAr ? rec.titleAr : rec.titleEn}</p>
                  <p className="text-text-light">{isAr ? rec.reasonAr : rec.reasonEn}</p>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
              <Download className="h-4 w-4" aria-hidden />
              {isAr ? "التصدير" : "Export"}
            </h2>
            <div className="flex flex-wrap gap-2">
              {(["resume", "career_portfolio", "university_portfolio"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => handleExport(kind)}
                  className="rounded-xl border border-border px-3 py-2 text-xs font-semibold"
                >
                  {kind === "resume"
                    ? isAr
                      ? "سيرة ذاتية PDF"
                      : "Resume PDF"
                    : kind === "career_portfolio"
                      ? isAr
                        ? "ملف مهني PDF"
                        : "Career portfolio PDF"
                      : isAr
                        ? "ملف جامعي PDF"
                        : "University portfolio PDF"}
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard>
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
              <Briefcase className="h-4 w-4" aria-hidden />
              {isAr ? "الملف العام" : "Public portfolio"}
            </h2>
            <div className="mb-3 space-y-2 text-sm">
              {[
                ["showAchievements", isAr ? "إظهار الإنجازات" : "Show achievements"],
                ["showTraining", isAr ? "إظهار التدريب" : "Show training"],
                ["showVolunteer", isAr ? "إظهار التطوع" : "Show volunteering"],
                ["showResume", isAr ? "إظهار السيرة الذاتية" : "Show resume"],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={visibility[key as keyof typeof visibility]}
                    onChange={(e) =>
                      setVisibility((p) => ({ ...p, [key]: e.target.checked }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            {data.publicPortfolioUrl ? (
              <a href={data.publicPortfolioUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary underline">
                {isAr ? "فتح الملف العام" : "Open public portfolio"}
              </a>
            ) : null}
          </SectionCard>
        </div>
      )}
    </PageContainer>
  );
};

export default CareerProfilePage;
