/**
 * Arabic UI labels for /admin/scoring — paths must stay identical to ScoringConfig / DB keys.
 */

export type ScoringSectionId = "levelMultipliers" | "participation" | "results" | "rank" | "extra";

const LEVEL_AR: Record<string, string> = {
  school: "مستوى المدرسة",
  province: "مستوى المحافظة",
  national: "على مستوى المملكة",
  international: "على مستوى دولي",
};

const RANK_AR: Record<string, string> = {
  first: "المركز الأول",
  second: "المركز الثاني",
  third: "المركز الثالث",
  fourth: "المركز الرابع",
  fifth: "المركز الخامس",
  sixth: "المركز السادس",
  seventh: "المركز السابع",
  eighth: "المركز الثامن",
  ninth: "المركز التاسع",
  tenth: "المركز العاشر",
};

const MEDAL_AR: Record<string, string> = {
  gold: "ميدالية ذهبية",
  silver: "ميدالية فضية",
  bronze: "ميدالية برونزية",
};

export const SCORING_SECTIONS: Array<{
  id: ScoringSectionId;
  title: string;
  hint: string;
}> = [
  {
    id: "levelMultipliers",
    title: "مضاعفات المستوى",
    hint: "تُضرب في النقاط الأساسية بعد تحديد مستوى الإنجاز (مدرسة، محافظة، المملكة، دولي). القيمة 1 تعني عدم تغيير النقاط الأساسية.",
  },
  {
    id: "participation",
    title: "نقاط المشاركة",
    hint: "نقاط أساسية عندما تكون نتيجة الإنجاز «مشاركة فقط» دون ترتيب أو ميدالية، حسب مستوى المسابقة أو الفعالية.",
  },
  {
    id: "results",
    title: "نقاط النتائج",
    hint: "نقاط لأنواع النتائج: شهادة تقدير، ترشيح، جائزة مميزة، نتيجة أخرى، وميداليات (ذهب / فضة / برونز) لكل مستوى.",
  },
  {
    id: "rank",
    title: "نقاط المراكز",
    hint: "نقاط عند تسجيل ترتيب محدد (من الأول إلى العاشر) حسب مستوى الإنجاز.",
  },
  {
    id: "extra",
    title: "إعدادات إضافية",
    hint: "معامل نصيب العضو في المشاركات الجماعية، ومكافأة اختيارية حسب نوع النشاط إن وُجدت في منطق المنصة.",
  },
];

export const scoringSectionForPath = (path: string): ScoringSectionId => {
  if (path.startsWith("levelMultipliers.")) return "levelMultipliers";
  if (path.startsWith("participation.")) return "participation";
  if (
    path.startsWith("recognition.") ||
    path.startsWith("other.") ||
    path.startsWith("nomination.") ||
    path.startsWith("specialAward.") ||
    path.startsWith("medal.")
  ) {
    return "results";
  }
  if (path.startsWith("rank.")) return "rank";
  return "extra";
};

/** Readable Arabic label — never show raw path keys to users. */
export const scoringFieldLabelAr = (path: string): string => {
  if (path === "teamResultMultiplier") {
    return "معامل نتيجة الفريق (المشاركة الجماعية)";
  }
  if (path === "typeBonus") {
    return "مكافأة إضافية حسب نوع الإنجاز";
  }

  const parts = path.split(".");

  if (parts[0] === "levelMultipliers" && parts[1] && LEVEL_AR[parts[1]]) {
    return `مضاعف النقاط — ${LEVEL_AR[parts[1]]}`;
  }

  if (parts[0] === "participation" && parts[1] && LEVEL_AR[parts[1]]) {
    return `مشاركة فقط — ${LEVEL_AR[parts[1]]}`;
  }

  if (parts[0] === "recognition" && parts[1] && LEVEL_AR[parts[1]]) {
    return `شهادة تقدير — ${LEVEL_AR[parts[1]]}`;
  }

  if (parts[0] === "other" && parts[1] && LEVEL_AR[parts[1]]) {
    return `نتيجة أخرى — ${LEVEL_AR[parts[1]]}`;
  }

  if (parts[0] === "nomination" && parts[1] && LEVEL_AR[parts[1]]) {
    return `ترشيح / تأهل — ${LEVEL_AR[parts[1]]}`;
  }

  if (parts[0] === "specialAward" && parts[1] && LEVEL_AR[parts[1]]) {
    return `جائزة أو تكريم خاص — ${LEVEL_AR[parts[1]]}`;
  }

  if (parts[0] === "medal" && parts[1] && parts[2] && MEDAL_AR[parts[1]] && LEVEL_AR[parts[2]]) {
    return `${MEDAL_AR[parts[1]]} — ${LEVEL_AR[parts[2]]}`;
  }

  if (parts[0] === "rank" && parts[1] && parts[2] && RANK_AR[parts[1]] && LEVEL_AR[parts[2]]) {
    return `${RANK_AR[parts[1]]} — ${LEVEL_AR[parts[2]]}`;
  }

  return "عنصر إعدادات (يتطلب تحديث التسميات)";
};

const LEVEL_SORT = ["school", "province", "national", "international"];
const RANK_SORT = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
];
const MEDAL_SORT = ["gold", "silver", "bronze"];

/** Order of result categories in the «نقاط النتائج» section */
const RESULT_CATEGORY_ORDER = ["recognition", "other", "nomination", "specialAward", "medal"];

export const sortPathsInSection = (paths: string[], section: ScoringSectionId): string[] => {
  const copy = [...paths];
  const levelIdx = (p: string) => {
    const seg = p.split(".").pop() || "";
    const i = LEVEL_SORT.indexOf(seg);
    return i === -1 ? 99 : i;
  };

  if (section === "levelMultipliers" || section === "participation") {
    return copy.sort((a, b) => levelIdx(a) - levelIdx(b));
  }

  if (section === "results") {
    return copy.sort((a, b) => {
      const ca = a.split(".")[0] || "";
      const cb = b.split(".")[0] || "";
      const ia = RESULT_CATEGORY_ORDER.indexOf(ca);
      const ib = RESULT_CATEGORY_ORDER.indexOf(cb);
      const fa = ia === -1 ? 99 : ia;
      const fb = ib === -1 ? 99 : ib;
      if (fa !== fb) return fa - fb;
      if (ca === "medal") {
        const ma = MEDAL_SORT.indexOf(a.split(".")[1] || "");
        const mb = MEDAL_SORT.indexOf(b.split(".")[1] || "");
        if (ma !== mb) return ma - mb;
      }
      return levelIdx(a) - levelIdx(b);
    });
  }

  if (section === "rank") {
    return copy.sort((a, b) => {
      const ra = RANK_SORT.indexOf(a.split(".")[1] || "");
      const rb = RANK_SORT.indexOf(b.split(".")[1] || "");
      if (ra !== rb) return ra - rb;
      return levelIdx(a) - levelIdx(b);
    });
  }

  return copy.sort((a, b) => a.localeCompare(b, "en"));
};
