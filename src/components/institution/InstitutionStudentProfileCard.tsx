"use client";

import type { InstitutionStudentProfileSummary } from "@/lib/partnerships/institution-student-profile-service";
import { Award, Briefcase, HeartHandshake, Star, Trophy } from "lucide-react";

type InstitutionStudentProfileCardProps = {
  profile: InstitutionStudentProfileSummary;
  isAr: boolean;
};

const InstitutionStudentProfileCard = ({ profile, isAr }: InstitutionStudentProfileCardProps) => {
  const { basic, achievements, volunteer, priorTraining, careerReadiness, interests } = profile;

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-lg font-bold text-foreground">{basic.fullName}</h3>
        <p className="mt-1 text-sm text-text-light">
          {isAr ? basic.gradeLabelAr : basic.gradeLabelEn}
          {basic.stage ? ` · ${basic.stage}` : ""}
          {basic.school ? ` · ${basic.school}` : ""}
        </p>
        <p className="mt-1 text-xs text-text-light">
          {isAr ? "العام الدراسي:" : "Academic year:"} {basic.academicYearLabel}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-amber-900">
            <Trophy className="h-4 w-4" aria-hidden />
            <span className="text-xs font-bold">{isAr ? "الإنجازات" : "Achievements"}</span>
          </div>
          <p className="mt-2 text-2xl font-black text-amber-950">{achievements.totalCount}</p>
          <p className="text-xs text-amber-800">
            {isAr ? "شهادات:" : "Certificates:"} {achievements.certificateCount}
          </p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
          <div className="flex items-center gap-2 text-sky-900">
            <HeartHandshake className="h-4 w-4" aria-hidden />
            <span className="text-xs font-bold">{isAr ? "التطوع" : "Volunteer"}</span>
          </div>
          <p className="mt-2 text-2xl font-black text-sky-950">{volunteer.totalHours}</p>
          <p className="text-xs text-sky-800">
            {isAr ? "مشاركات:" : "Activities:"} {volunteer.participationCount}
          </p>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
          <div className="flex items-center gap-2 text-violet-900">
            <Briefcase className="h-4 w-4" aria-hidden />
            <span className="text-xs font-bold">{isAr ? "الجاهزية المهنية" : "Career readiness"}</span>
          </div>
          <p className="mt-2 text-2xl font-black text-violet-950">{careerReadiness.careerReadinessScore}%</p>
          <p className="text-xs text-violet-800">
            {isAr ? "الجامعي:" : "University:"} {careerReadiness.universityReadinessScore}%
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center gap-2 text-emerald-900">
            <Award className="h-4 w-4" aria-hidden />
            <span className="text-xs font-bold">{isAr ? "ساعات التدريب" : "Training hours"}</span>
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-950">{careerReadiness.trainingHours}</p>
        </div>
      </div>

      {achievements.recent.length > 0 ? (
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
            <Star className="h-4 w-4 text-amber-500" aria-hidden />
            {isAr ? "أحدث الإنجازات" : "Recent achievements"}
          </p>
          <ul className="space-y-2 text-sm text-text">
            {achievements.recent.map((row, idx) => (
              <li key={`recent-${idx}`} className="rounded-lg border border-border/60 px-3 py-2">
                <span className="font-semibold">{row.title}</span>
                {row.outcome ? <span className="text-text-light"> — {row.outcome}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {achievements.highlights.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-bold text-foreground">
            {isAr ? "أبرز الإنجازات" : "Highlights"}
          </p>
          <ul className="space-y-2 text-sm text-text">
            {achievements.highlights.map((row, idx) => (
              <li key={`highlight-${idx}`} className="rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2">
                {row.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {priorTraining.length > 0 ? (
        <div>
          <p className="mb-2 text-sm font-bold text-foreground">
            {isAr ? "التدريب السابق" : "Prior training"}
          </p>
          <ul className="space-y-2 text-sm">
            {priorTraining.map((row, idx) => (
              <li key={`training-${idx}`} className="rounded-lg border border-border/60 px-3 py-2">
                <span className="font-semibold">{row.organizationName}</span>
                <span className="text-text-light"> · {row.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(interests.careerInterests.length > 0 ||
        interests.professionalInterests.length > 0 ||
        interests.specializations.length > 0) ? (
        <div className="space-y-2">
          <p className="text-sm font-bold text-foreground">{isAr ? "مجالات الاهتمام" : "Interests"}</p>
          {interests.careerInterests.length > 0 ? (
            <p className="text-sm text-text">
              <span className="font-semibold">{isAr ? "المهنية:" : "Career:"}</span>{" "}
              {interests.careerInterests.join(isAr ? "، " : ", ")}
            </p>
          ) : null}
          {interests.professionalInterests.length > 0 ? (
            <p className="text-sm text-text">
              <span className="font-semibold">{isAr ? "المهارات:" : "Professional:"}</span>{" "}
              {interests.professionalInterests.slice(0, 8).join(isAr ? "، " : ", ")}
            </p>
          ) : null}
          {interests.specializations.length > 0 ? (
            <p className="text-sm text-text">
              <span className="font-semibold">{isAr ? "التخصصات:" : "Specializations:"}</span>{" "}
              {interests.specializations.join(isAr ? "، " : ", ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default InstitutionStudentProfileCard;
