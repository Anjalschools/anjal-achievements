"use client";

import type { LucideIcon } from "lucide-react";
import { Brain, Calendar, Globe, Medal, Star, Tag, Trophy, Users } from "lucide-react";

export const studentAchievementLevelBadgeClass = (levelKey: string): string => {
  const k = String(levelKey || "").trim().toLowerCase();
  if (k === "international" || k === "world") {
    return "bg-emerald-600 text-white ring-2 ring-emerald-800/35";
  }
  if (k === "kingdom") {
    return "bg-emerald-500 text-white ring-2 ring-emerald-600/40";
  }
  if (k === "school") {
    return "bg-slate-300 text-slate-900 ring-2 ring-slate-400/70";
  }
  if (k === "province" || k === "region") {
    return "bg-emerald-100 text-emerald-950 ring-2 ring-emerald-200/90";
  }
  return "bg-slate-100 text-slate-800 ring-1 ring-slate-200/90";
};

export const studentAchievementMedalBadgeClass = (medalType: string, resultType: string): string => {
  const m = `${medalType} ${resultType}`.toLowerCase();
  if (m.includes("gold") || m.includes("ذهب")) {
    return "bg-amber-200 text-amber-950 ring-2 ring-amber-400/80";
  }
  if (m.includes("silver") || m.includes("فض")) {
    return "bg-slate-200 text-slate-900 ring-2 ring-slate-300/90";
  }
  if (m.includes("bronze") || m.includes("برونز")) {
    return "bg-orange-100 text-orange-950 ring-2 ring-orange-300/85";
  }
  return "";
};

export type StudentAchievementSummaryContent = {
  typeLabel: string;
  fieldLabel: string;
  resultTypeLabel: string;
  resultLine: string;
  levelLabel: string;
  participationLabel: string;
  yearLabel: string;
  scoreLabel: string;
};

type DataRowProps = { icon: LucideIcon; label: string; value: string; compact?: boolean };

const DataRow = ({ icon: Icon, label, value, compact }: DataRowProps) => {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div
      className={`flex items-start gap-2 text-text ${compact ? "text-[11px] leading-snug" : "text-xs leading-snug"}`}
    >
      <Icon
        className={`mt-0.5 shrink-0 text-primary/80 ${compact ? "h-3 w-3" : "h-3.5 w-3.5"}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <span className="font-semibold text-text-muted">{label}</span>
        <span className="mx-0.5 font-normal text-text-muted">:</span>
        <span className="font-medium text-text">{value}</span>
      </div>
    </div>
  );
};

export type StudentAchievementDataRowsLabels = Partial<{
  type: string;
  field: string;
  resultType: string;
  outcome: string;
  level: string;
  participation: string;
  year: string;
  points: string;
}>;

export type StudentAchievementDataRowsProps = {
  locale: "ar" | "en";
  content: StudentAchievementSummaryContent;
  levelKey: string;
  medalType: string;
  resultType: string;
  compact?: boolean;
  showLevelMedalBadges?: boolean;
  /** Override default row labels (e.g. hall profile wording) */
  rowLabels?: StudentAchievementDataRowsLabels;
};

const StudentAchievementDataRows = ({
  locale,
  content,
  levelKey,
  medalType,
  resultType,
  compact = false,
  showLevelMedalBadges = true,
  rowLabels,
}: StudentAchievementDataRowsProps) => {
  const isAr = locale === "ar";
  const rl = rowLabels ?? {};
  const medalClass = studentAchievementMedalBadgeClass(medalType, resultType);
  const showMedalBadge =
    Boolean(medalClass) && (String(resultType || "").toLowerCase() === "medal" || Boolean(medalType?.trim()));

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      {showLevelMedalBadges ? (
        <div className="flex flex-wrap gap-1.5">
          {levelKey ? (
            <span
              className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-bold ${studentAchievementLevelBadgeClass(levelKey)}`}
            >
              {content.levelLabel}
            </span>
          ) : null}
          {showMedalBadge ? (
            <span
              className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-bold ${medalClass}`}
            >
              {content.resultLine || (isAr ? "النتيجة" : "Result")}
            </span>
          ) : null}
        </div>
      ) : null}

      <DataRow
        icon={Tag}
        label={rl.type ?? (isAr ? "التصنيف" : "Type")}
        value={content.typeLabel}
        compact={compact}
      />
      <DataRow
        icon={Brain}
        label={rl.field ?? (isAr ? "المجال" : "Field")}
        value={content.fieldLabel}
        compact={compact}
      />
      <DataRow
        icon={Trophy}
        label={rl.resultType ?? (isAr ? "نوع النتيجة" : "Result type")}
        value={content.resultTypeLabel}
        compact={compact}
      />
      <DataRow
        icon={Medal}
        label={rl.outcome ?? (isAr ? "النتيجة" : "Outcome")}
        value={content.resultLine}
        compact={compact}
      />
      <DataRow
        icon={Globe}
        label={rl.level ?? (isAr ? "المستوى" : "Level")}
        value={content.levelLabel}
        compact={compact}
      />
      <DataRow
        icon={Users}
        label={rl.participation ?? (isAr ? "المشاركة" : "Participation")}
        value={content.participationLabel}
        compact={compact}
      />
      <DataRow
        icon={Calendar}
        label={rl.year ?? (isAr ? "السنة" : "Year")}
        value={content.yearLabel}
        compact={compact}
      />
      <DataRow
        icon={Star}
        label={rl.points ?? (isAr ? "النقاط" : "Points")}
        value={content.scoreLabel}
        compact={compact}
      />
    </div>
  );
};

export default StudentAchievementDataRows;
