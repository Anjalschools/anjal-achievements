/**
 * Achievement Field Inference Engine
 * Rule-based local inference (no external APIs)
 */

import type { AchievementFieldInference } from "@/types/achievement";
import {
  COMPETITION_OPTIONS,
} from "@/constants/achievement-options";

const FREE_TEXT_RULES: Array<{ keywords: string[]; field: string; category: string }> = [
  { keywords: ["رياضيات", "math", "mathematics"], field: "mathematics", category: "الرياضيات" },
  { keywords: ["فيزياء", "physics"], field: "physics", category: "الفيزياء" },
  { keywords: ["كيمياء", "chemistry"], field: "chemistry", category: "الكيمياء" },
  { keywords: ["أحياء", "احياء", "biology"], field: "biology", category: "الأحياء" },
  { keywords: ["علوم", "science"], field: "science", category: "العلوم" },
  { keywords: ["برمجة", "coding", "informatics", "informatic"], field: "informatics", category: "المعلوماتية" },
  { keywords: ["robot", "روبوت", "robotics"], field: "robotics", category: "الروبوتات" },
  { keywords: ["stem", "engineering", "هندسة"], field: "stem", category: "STEM" },
  { keywords: ["قراءة", "لغة عربية", "reading", "arabic"], field: "arabic_language", category: "اللغة العربية" },
  { keywords: ["سباحة", "كرة", "كاراتيه", "padel", "رياضة", "sports"], field: "sports", category: "الرياضة" },
  { keywords: ["بحث", "research"], field: "scientific_research", category: "البحث العلمي" },
  { keywords: ["فضاء", "space"], field: "space", category: "الفضاء" },
];

export function inferAchievementFieldFromFreeText(text: string): AchievementFieldInference {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return {
      field: "other",
      normalizedCategory: "أخرى",
      sourceType: "other",
    };
  }

  for (const rule of FREE_TEXT_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return {
        field: rule.field,
        normalizedCategory: rule.category,
        sourceType: "other",
      };
    }
  }

  return {
    field: "other",
    normalizedCategory: "أخرى",
    sourceType: "other",
  };
}

/**
 * Infer achievement field based on type and name
 */
export function inferAchievementField(
  achievementType: string,
  achievementName?: string,
  olympiadField?: string,
  mawhibaSubject?: string,
  freeText?: string
): AchievementFieldInference {
  // Default fallback
  const defaultInference: AchievementFieldInference = {
    field: "other",
    normalizedCategory: "أخرى",
    sourceType: "other",
  };

  if (!achievementType) {
    return defaultInference;
  }

  // OLYMPIAD: Field comes from olympiadField selection, not name
  if (achievementType === "olympiad" && olympiadField) {
    const fieldMap: Record<string, { field: string; category: string }> = {
      mathematics: { field: "mathematics", category: "الرياضيات" },
      physics: { field: "physics", category: "الفيزياء" },
      chemistry: { field: "chemistry", category: "الكيمياء" },
      biology: { field: "biology", category: "الأحياء" },
      science: { field: "science", category: "العلوم" },
      informatics: { field: "informatics", category: "المعلوماتية" },
    };

    const mapped = fieldMap[olympiadField];
    if (mapped) {
      return {
        field: mapped.field,
        normalizedCategory: mapped.category,
        sourceType: "olympiad",
      };
    }
  }

  // MAWHIBA ANNUAL: Field comes from subject selection
  if (achievementType === "mawhiba_annual" && mawhibaSubject) {
    const subjectMap: Record<string, { field: string; category: string }> = {
      full_test: { field: "general_talent", category: "الموهبة العامة" },
      science: { field: "science", category: "العلوم" },
      mathematics: { field: "mathematics", category: "الرياضيات" },
      physics: { field: "physics", category: "الفيزياء" },
      chemistry: { field: "chemistry", category: "الكيمياء" },
    };

    const mapped = subjectMap[mawhibaSubject];
    if (mapped) {
      return {
        field: mapped.field,
        normalizedCategory: mapped.category,
        sourceType: "mawhiba",
      };
    }
  }

  // GIFTED DISCOVERY: Always general talent
  if (achievementType === "gifted_discovery") {
    return {
      field: "general_talent",
      normalizedCategory: "الموهبة العامة",
      sourceType: "gifted_discovery",
    };
  }

  if (achievementType === "sat" || achievementType === "ielts" || achievementType === "toefl") {
    return {
      field: "academic_development",
      normalizedCategory: "التطوير الأكاديمي واللغوي",
      sourceType: "other",
    };
  }

  // COMPETITIONS: Map by competition name
  if (achievementType === "competition" && achievementName) {
    const competitionMap: Record<string, { field: string; category: string }> = {
      bebras: { field: "informatics", category: "المعلوماتية" },
      kangaroo: { field: "mathematics", category: "الرياضيات" },
      kaust_math: { field: "mathematics", category: "الرياضيات" },
      smart_city_hackathon: { field: "technology_innovation", category: "التقنية والابتكار" },
      cyber_pioneers_hackathon: { field: "cybersecurity", category: "الأمن السيبراني" },
      wro: { field: "robotics", category: "الروبوتات" },
      arabic_reading: { field: "arabic_language", category: "اللغة العربية" },
      f1_schools: { field: "stem", category: "STEM" },
      swimming: { field: "sports", category: "الرياضة" },
      karate: { field: "sports", category: "الرياضة" },
      football: { field: "sports", category: "الرياضة" },
      volleyball: { field: "sports", category: "الرياضة" },
      badminton: { field: "sports", category: "الرياضة" },
    };

    const mapped = competitionMap[achievementName];
    if (mapped) {
      return {
        field: mapped.field,
        normalizedCategory: mapped.category,
        sourceType: "competition",
      };
    }
  }

  // "Other" name (or custom text) fallback to local free-text heuristic inference
  if (achievementName === "other" || freeText) {
    return inferAchievementFieldFromFreeText(freeText || achievementName || "");
  }

  // PROGRAMS: Map by program name
  if (achievementType === "program" && achievementName) {
    const programMap: Record<string, { field: string; category: string }> = {
      misk_university_prep: { field: "academic_development", category: "التطور الأكاديمي" },
      steps: { field: "academic_development", category: "التطور الأكاديمي" },
      srsi: { field: "scientific_research", category: "البحث العلمي" },
      space_2101: { field: "space", category: "الفضاء" },
      research_pathway: { field: "scientific_research", category: "البحث العلمي" },
      olympiad_specs: { field: "specifications_quality", category: "المواصفات والجودة" },
      social_volunteer_programs: {
        field: "social_work_excellence",
        category: "الخدمة الاجتماعية والتطوع",
      },
    };

    const mapped = programMap[achievementName];
    if (mapped) {
      return {
        field: mapped.field,
        normalizedCategory: mapped.category,
        sourceType: "program",
      };
    }
  }

  // EXHIBITIONS: Map by exhibition name
  if (achievementType === "exhibition" && achievementName) {
    const exhibitionMap: Record<string, { field: string; category: string }> = {
      taiwan_tisef: { field: "innovation_inventions", category: "الابتكار والاختراعات" },
      croatia_anova: { field: "innovation_inventions", category: "الابتكار والاختراعات" },
      malaysia_itex: { field: "innovation_inventions", category: "الابتكار والاختراعات" },
      us_isef: { field: "science_engineering", category: "العلوم والهندسة" },
      ibdaa: { field: "science_engineering", category: "العلوم والهندسة" },
      central_exhibition: { field: "science_engineering", category: "العلوم والهندسة" },
    };

    const mapped = exhibitionMap[achievementName];
    if (mapped) {
      return {
        field: mapped.field,
        normalizedCategory: mapped.category,
        sourceType: "exhibition",
      };
    }
  }

  // EXCELLENCE PROGRAMS: Map by program name
  if (achievementType === "excellence_program" && achievementName) {
    const excellenceMap: Record<string, { field: string; category: string }> = {
      sheikh_abdulwahab_mousa: { field: "excellence", category: "التميز" },
      hamdan_bin_rashid: { field: "excellence", category: "التميز" },
      princess_seeta: { field: "social_work_excellence", category: "العمل الاجتماعي والتميز" },
    };

    const mapped = excellenceMap[achievementName];
    if (mapped) {
      return {
        field: mapped.field,
        normalizedCategory: mapped.category,
        sourceType: "excellence_program",
      };
    }
  }

  return defaultInference;
}
