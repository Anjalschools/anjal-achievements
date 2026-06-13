import type { StudentCareerProfilePayload } from "@/lib/career/student-career-profile-service";

export type CareerPdfKind = "resume" | "career_portfolio" | "university_portfolio";

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const buildCareerProfilePdfHtml = (
  payload: StudentCareerProfilePayload,
  kind: CareerPdfKind,
  locale: "ar" | "en"
): string => {
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";
  const name = isAr ? payload.profile.fullName : payload.profile.fullNameEn || payload.profile.fullName;
  const bio = isAr ? payload.editable.professionalBio : payload.editable.professionalBioEn || payload.editable.professionalBio;
  const grade = isAr ? payload.profile.gradeLabelAr : payload.profile.gradeLabelEn;

  const titleMap: Record<CareerPdfKind, { ar: string; en: string }> = {
    resume: { ar: "السيرة الذاتية", en: "Resume" },
    career_portfolio: { ar: "الملف المهني", en: "Career Portfolio" },
    university_portfolio: { ar: "الملف الجامعي", en: "University Portfolio" },
  };

  const title = isAr ? titleMap[kind].ar : titleMap[kind].en;

  const skillsHtml = payload.skills
    .slice(0, 20)
    .map((s) => `<span class="tag">${escapeHtml(s)}</span>`)
    .join("");

  const achievementsHtml = payload.achievements.items
    .slice(0, 12)
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.outcome)}</td><td>${escapeHtml(item.year)}</td></tr>`
    )
    .join("");

  const trainingHtml =
    kind !== "resume"
      ? payload.training
          .slice(0, 8)
          .map(
            (t) =>
              `<tr><td>${escapeHtml(t.organizationName)}</td><td>${t.volunteerHours}</td><td>${escapeHtml(t.status)}</td></tr>`
          )
          .join("")
      : "";

  const volunteerHtml =
    kind !== "resume"
      ? payload.volunteer
          .slice(0, 8)
          .map(
            (v) =>
              `<tr><td>${escapeHtml(v.title)}</td><td>${escapeHtml(v.organization)}</td><td>${v.hours}</td></tr>`
          )
          .join("")
      : "";

  const scoresBlock =
    kind === "university_portfolio"
      ? `<div class="scores">
          <div><strong>${isAr ? "الجاهزية الجامعية" : "University readiness"}:</strong> ${payload.scores.universityReadinessScore}/100</div>
          <div><strong>${isAr ? "الإنجازات" : "Achievements"}:</strong> ${payload.scores.achievementsScore}/100</div>
          <div><strong>${isAr ? "القيادة" : "Leadership"}:</strong> ${payload.scores.leadershipScore}/100</div>
        </div>`
      : kind === "career_portfolio"
        ? `<div class="scores">
          <div><strong>${isAr ? "الجاهزية المهنية" : "Career readiness"}:</strong> ${payload.scores.careerReadinessScore}/100</div>
          <div><strong>${isAr ? "ساعات التدريب" : "Training hours"}:</strong> ${payload.scores.trainingHours}</div>
          <div><strong>${isAr ? "ساعات التطوع" : "Volunteer hours"}:</strong> ${payload.scores.volunteerHours}</div>
        </div>`
        : "";

  const recommendationsHtml =
    kind !== "resume"
      ? payload.recommendations
          .slice(0, 6)
          .map(
            (r) =>
              `<li>${escapeHtml(isAr ? r.titleAr : r.titleEn)} — ${escapeHtml(isAr ? r.reasonAr : r.reasonEn)}</li>`
          )
          .join("")
      : "";

  return `<!DOCTYPE html><html dir="${dir}" lang="${locale}"><head><meta charset="utf-8"/>
<title>${escapeHtml(title)} — ${escapeHtml(name)}</title>
<style>
body{font-family:Arial,sans-serif;padding:32px;color:#0f172a;line-height:1.5}
h1{font-size:24px;margin:0 0 4px}
.sub{color:#64748b;margin-bottom:20px}
.section{margin-top:24px}
.tag{display:inline-block;background:#e2e8f0;border-radius:6px;padding:4px 8px;margin:4px;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
th,td{border:1px solid #cbd5e1;padding:6px;text-align:${isAr ? "right" : "left"}}
th{background:#f1f5f9}
.scores{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
</style></head><body>
<h1>${escapeHtml(name)}</h1>
<p class="sub">${escapeHtml(grade)} · ${escapeHtml(title)} · ${new Date().toLocaleDateString(isAr ? "ar-SA" : "en-US")}</p>
${bio ? `<div class="section"><h2>${isAr ? "نبذة" : "Summary"}</h2><p>${escapeHtml(bio)}</p></div>` : ""}
${scoresBlock}
<div class="section"><h2>${isAr ? "المهارات" : "Skills"}</h2>${skillsHtml || "—"}</div>
<div class="section"><h2>${isAr ? "الإنجازات" : "Achievements"}</h2>
<table><thead><tr><th>${isAr ? "العنوان" : "Title"}</th><th>${isAr ? "النتيجة" : "Outcome"}</th><th>${isAr ? "السنة" : "Year"}</th></tr></thead>
<tbody>${achievementsHtml || `<tr><td colspan="3">—</td></tr>`}</tbody></table></div>
${trainingHtml ? `<div class="section"><h2>${isAr ? "التدريب" : "Training"}</h2><table><thead><tr><th>${isAr ? "المؤسسة" : "Organization"}</th><th>${isAr ? "الساعات" : "Hours"}</th><th>${isAr ? "الحالة" : "Status"}</th></tr></thead><tbody>${trainingHtml}</tbody></table></div>` : ""}
${volunteerHtml ? `<div class="section"><h2>${isAr ? "التطوع" : "Volunteering"}</h2><table><thead><tr><th>${isAr ? "النشاط" : "Activity"}</th><th>${isAr ? "الجهة" : "Organization"}</th><th>${isAr ? "الساعات" : "Hours"}</th></tr></thead><tbody>${volunteerHtml}</tbody></table></div>` : ""}
${recommendationsHtml ? `<div class="section"><h2>${isAr ? "التوصيات" : "Recommendations"}</h2><ul>${recommendationsHtml}</ul></div>` : ""}
<p class="sub" style="margin-top:32px">${isAr ? "مدارس الأنجال الأهلية — منصة تميز الأنجال" : "Anjal Schools — Tamayoz Platform"}</p>
</body></html>`;
};
