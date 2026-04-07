"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, X, FileText, Info } from "lucide-react";
import Image from "next/image";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import {
  ACHIEVEMENT_LEVELS,
  ACHIEVEMENT_RESULT_TYPES,
  MAWHIBA_ANNUAL_SUBJECTS,
  OLYMPIAD_FIELDS,
  PARTICIPATION_TYPES,
  QUDRAT_TIER_ALLOWED_VALUES,
  getAchievementNamesByType,
} from "@/constants/achievement-options";
import {
  UI_CATEGORY_OPTIONS,
  getEventOptionsForUiCategory,
  mapUiCategoryToDbAchievementType,
  mapDbAchievementTypeToUiCategory,
  OLYMPIAD_EVENT_OTHER_VALUE,
  getAutoLevelForOlympiadNesmoEvent,
  getAutoLockedLevelByCategory,
  getMawhibaAnnualSubjectOptionsForCategory,
  STANDARDIZED_TEST_TYPE_OPTIONS,
  resolveAchievementFormUiCategory,
} from "@/constants/achievement-ui-categories";
import { inferAchievementField } from "@/lib/achievement-field-inference";
import { calculateAchievementScore } from "@/lib/achievement-scoring";
import { useScoringConfig } from "@/hooks/useScoringConfig";
import {
  absorbResultValueIntoSubtypes,
  achievementDateIsoFromRecord,
  inferAchievementCategoryFromLegacyType,
  normalizeAchievementNames,
  normalizeLegacyQudratAchievementName,
} from "@/lib/achievementNormalize";
import {
  labelInferredField,
  labelVerificationStatus,
} from "@/lib/achievementDisplay";
import {
  clampInferredFieldToAllowlist,
} from "@/lib/achievement-inferred-field-allowlist";
import {
  buildFieldInferenceInput,
  isAiFieldInferenceEligibleShape,
  shouldUseAiFieldInference,
  type AiFieldInferenceContext,
} from "@/lib/achievement-ai-field-eligibility";

type AchievementFormProps = {
  onSubmit: (data: Record<string, unknown>) => void;
  isSubmitting?: boolean;
  initialData?: Partial<Record<string, unknown>>;
  userRole?: string;
};

type AutoLocks = {
  levelLocked: boolean;
  participationLocked: boolean;
  resultLocked: boolean;
};

const AUTO_RULE_COMPETITIONS = ["bebras", "kangaroo", "kaust_math", "arabic_reading"];
const AUTO_LEVEL_COMPETITIONS = ["bebras", "kangaroo"];

const AchievementForm = ({
  onSubmit,
  isSubmitting = false,
  initialData,
  userRole = "student",
}: AchievementFormProps) => {
  const locale = getLocale();
  const isArabic = locale === "ar";
  const scoringCfg = useScoringConfig();

  const [formData, setFormData] = useState<Record<string, unknown>>({
    achievementType: String(initialData?.achievementType || ""),
    achievementCategory: String(
      resolveAchievementFormUiCategory(
        String(initialData?.achievementType || ""),
        String(initialData?.achievementCategory || "").trim() || undefined
      ) || "competition"
    ),
    achievementName: String(initialData?.achievementName || ""),
    customAchievementName: String(initialData?.customAchievementName || ""),
    achievementLevel: String(initialData?.achievementLevel || ""),
    participationType: String(initialData?.participationType || "individual"),
    teamRole: String(initialData?.teamRole || ""),
    resultType: String(initialData?.resultType || ""),
    medalType: String(initialData?.medalType || ""),
    rank: String(initialData?.rank || ""),
    nominationText: String(initialData?.nominationText || ""),
    specialAwardText: String(initialData?.specialAwardText || ""),
    recognitionText: String(initialData?.recognitionText || ""),
    otherResultText: String(initialData?.otherResultText || ""),
    resultValue: String(
      (initialData as Record<string, unknown> | undefined)?.resultValue ?? ""
    ),
    olympiadField: String(initialData?.olympiadField || ""),
    mawhibaAnnualSubject: String(initialData?.mawhibaAnnualSubject || ""),
    giftedDiscoveryScore:
      typeof initialData?.giftedDiscoveryScore === "number"
        ? initialData.giftedDiscoveryScore
        : undefined,
    achievementYear:
      typeof initialData?.achievementYear === "number"
        ? initialData.achievementYear
        : new Date().getFullYear(),
    achievementDate: achievementDateIsoFromRecord(
      (initialData || {}) as Record<string, unknown>
    ),
    achievementClassification: String(
      initialData?.achievementClassification || "other"
    ),
    description: String(initialData?.description || ""),
    image: initialData?.image || null,
    attachments: Array.isArray(initialData?.attachments)
      ? initialData.attachments
      : [],
    evidenceUrl: String(initialData?.evidenceUrl || ""),
    evidenceFileName: String(initialData?.evidenceFileName || ""),
    evidenceRequiredMode: String(initialData?.evidenceRequiredMode || "provided"),
    featured: initialData?.featured === true,
    inferredFieldStudentOverride: String(
      (initialData as Record<string, unknown> | undefined)?.inferredField ||
        (initialData as Record<string, unknown> | undefined)?.domain ||
        ""
    ),
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [inferredField, setInferredField] = useState<{
    field: string;
    category: string;
  } | null>(null);
  const [scorePreview, setScorePreview] = useState<number>(0);
  const [autoLocks, setAutoLocks] = useState<AutoLocks>({
    levelLocked: false,
    participationLocked: false,
    resultLocked: false,
  });

  const imageInputRef = useRef<HTMLInputElement>(null);
  const attachmentsInputRef = useRef<HTMLInputElement>(null);
  const isHydratingFromInitialDataRef = useRef(false);
  /** Built inference text at load — failed AI must not wipe stored field if user did not change sources. */
  const initialFieldInferenceSnapshotRef = useRef("");
  const prevAiInferenceShapeRef = useRef(false);
  const otherFieldSuggestGenerationRef = useRef(0);
  const latestAiFieldInferenceCtxRef = useRef<AiFieldInferenceContext | null>(null);

  const canSetFeatured = ["admin", "supervisor", "judge", "schoolAdmin"].includes(
    userRole
  );

  useEffect(() => {
    if (!initialData) {
      initialFieldInferenceSnapshotRef.current = "";
    }
  }, [initialData]);

  useEffect(() => {
    if (!initialData) return;

    isHydratingFromInitialDataRef.current = true;
    const raw = initialData as Record<string, unknown>;
    const names = normalizeAchievementNames(raw);
    const absorbed = absorbResultValueIntoSubtypes(
      String(initialData.resultType || ""),
      String(initialData.resultValue || ""),
      String(initialData.medalType || ""),
      String(initialData.rank || "")
    );

    const dbType = String(initialData.achievementType || "");
    const mappedUi =
      mapDbAchievementTypeToUiCategory(dbType) ||
      inferAchievementCategoryFromLegacyType(dbType) ||
      "competition";
    const cat = resolveAchievementFormUiCategory(
      dbType,
      String(initialData.achievementCategory || "").trim() || undefined
    );

    let hydratedAchievementName = String(initialData.achievementName || "");
    if (dbType === "qudrat") {
      hydratedAchievementName = normalizeLegacyQudratAchievementName(hydratedAchievementName);
    }

    setFormData((prev) => ({
      ...prev,
      achievementType: dbType,
      achievementCategory: cat,
      achievementClassification: String(
        initialData.achievementClassification || "other"
      ),
      achievementName: hydratedAchievementName,
      nameAr:
        names.normalizedNameAr ||
        String(
          initialData.nameAr ||
            initialData.achievementName ||
            initialData.title ||
            ""
        ),
      nameEn:
        names.normalizedNameEn ||
        String(
          initialData.nameEn ||
            initialData.achievementName ||
            initialData.title ||
            ""
        ),
      customAchievementName: String(initialData.customAchievementName || ""),
      achievementLevel: String(initialData.achievementLevel || initialData.level || ""),
      participationType: String(initialData.participationType || "individual"),
      teamRole: String(initialData.teamRole || ""),
      resultType: String(initialData.resultType || ""),
      medalType: String(absorbed.medalType || initialData.medalType || ""),
      rank: String(absorbed.rank || initialData.rank || ""),
      nominationText: String(initialData.nominationText || ""),
      specialAwardText: String(initialData.specialAwardText || ""),
      recognitionText: String(initialData.recognitionText || ""),
      otherResultText: String(initialData.otherResultText || ""),
      resultValue: String(
        (initialData as Record<string, unknown>).resultValue ?? ""
      ),
      olympiadField: String(initialData.olympiadField || ""),
      mawhibaAnnualSubject: String(initialData.mawhibaAnnualSubject || ""),
      giftedDiscoveryScore:
        typeof initialData.giftedDiscoveryScore === "number"
          ? initialData.giftedDiscoveryScore
          : undefined,
      achievementYear:
        typeof initialData.achievementYear === "number"
          ? initialData.achievementYear
          : new Date().getFullYear(),
      achievementDate: achievementDateIsoFromRecord(raw),
      description: String(initialData.description || ""),
      image: initialData.image || null,
      attachments: Array.isArray(initialData.attachments)
        ? initialData.attachments
        : [],
      evidenceUrl: String(initialData.evidenceUrl || ""),
      evidenceFileName: String(initialData.evidenceFileName || ""),
      evidenceRequiredMode: String(initialData.evidenceRequiredMode || "provided"),
      featured: initialData.featured === true,
      inferredFieldStudentOverride: String(
        (initialData as Record<string, unknown>).inferredField ||
          (initialData as Record<string, unknown>).domain ||
          ""
      ),
    }));

    if (typeof initialData.image === "string" && initialData.image.trim()) {
      setImagePreview(initialData.image);
    }

    const lockedByCategory = getAutoLockedLevelByCategory(cat);
    const lockedByOlympiad = getAutoLevelForOlympiadNesmoEvent(hydratedAchievementName);

    setAutoLocks((prev) => ({
      ...prev,
      levelLocked: Boolean(lockedByCategory || lockedByOlympiad),
    }));

    const initAchName = hydratedAchievementName;
    const initCustom = String(initialData.customAchievementName || "");
    const snapFinal =
      initAchName === OLYMPIAD_EVENT_OTHER_VALUE || initAchName === "other"
        ? initCustom.trim() || initAchName
        : initAchName || initCustom.trim();
    const snapCtx: AiFieldInferenceContext = {
      userRole: "student",
      uiCategory: cat,
      achievementType: dbType,
      achievementName: initAchName,
      customAchievementName: initCustom,
      olympiadField: String(initialData.olympiadField || ""),
      mawhibaAnnualSubject: String(initialData.mawhibaAnnualSubject || ""),
      description: String(initialData.description || ""),
      finalAchievementName: snapFinal,
      locale: locale === "en" ? "en" : "ar",
    };
    initialFieldInferenceSnapshotRef.current = buildFieldInferenceInput(snapCtx);

    setTimeout(() => {
      isHydratingFromInitialDataRef.current = false;
    }, 0);
  }, [initialData, locale]);

  const achievementType = String(formData.achievementType || "");
  const achievementName = String(formData.achievementName || "");
  const customAchievementName = String(formData.customAchievementName || "");
  const resultType = String(formData.resultType || "");
  const participationType = String(formData.participationType || "individual");
  const evidenceRequiredMode = String(formData.evidenceRequiredMode || "provided");
  const uiCategory = String(formData.achievementCategory || "");
  const olympiadNesmoLocked =
    achievementType === "olympiad" &&
    getAutoLevelForOlympiadNesmoEvent(achievementName) !== null;

  const standardizedLevelLocked =
    achievementType === "qudrat" ||
    achievementType === "mawhiba_annual" ||
    achievementType === "gifted_discovery" ||
    achievementType === "sat" ||
    achievementType === "ielts" ||
    achievementType === "toefl";

  const levelSelectDisabled =
    autoLocks.levelLocked ||
    olympiadNesmoLocked ||
    standardizedLevelLocked ||
    (uiCategory === "standardized_tests" && !achievementType);

  const availableNames = useMemo(() => {
    if (!uiCategory) return [];
    if (uiCategory === "standardized_tests") {
      if (!achievementType) return [];
      if (achievementType === "qudrat") {
        const base = getAchievementNamesByType("qudrat").map((item) => ({
          value: item.value,
          label: isArabic ? item.ar : item.en,
        }));
        const current = String(formData.achievementName || "");
        if (!current || base.some((o) => o.value === current)) return base;
        return [...base, { value: current, label: current }];
      }
      if (achievementType === "mawhiba_annual") {
        const base = getAchievementNamesByType("mawhiba_annual").map((item) => ({
          value: item.value,
          label: isArabic ? item.ar : item.en,
        }));
        const current = String(formData.achievementName || "");
        if (!current || base.some((o) => o.value === current)) return base;
        return [...base, { value: current, label: current }];
      }
      return [];
    }
    const base = getEventOptionsForUiCategory(uiCategory, isArabic ? "ar" : "en");
    const current = String(formData.achievementName || "");
    if (!current || base.some((o) => o.value === current)) return base;
    return [...base, { value: current, label: current }];
  }, [uiCategory, isArabic, formData.achievementName, achievementType]);

  const clearError = (field: string) => {
    if (!errors[field]) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    clearError(field);
  };

  useEffect(() => {
    if (isHydratingFromInitialDataRef.current) return;

    setFormData((prev) => {
      const next: Record<string, unknown> = { ...prev };

      next.achievementName = "";
      next.customAchievementName = "";
      next.olympiadField = "";
      next.mawhibaAnnualSubject = "";
      next.resultValue = "";
      next.giftedDiscoveryScore = undefined;
      next.teamRole = "";
      next.medalType = "";
      next.rank = "";
      next.nominationText = "";
      next.specialAwardText = "";
      next.recognitionText = "";
      next.otherResultText = "";
      next.resultType = "";
      next.achievementLevel = "";
      next.participationType = "individual";
      next.inferredFieldStudentOverride = "";

      if (achievementType === "mawhiba_annual") {
        next.achievementLevel = "kingdom";
        next.resultType = "rank";
      }

      if (achievementType === "gifted_discovery") {
        next.achievementName = "exceptional_gifted";
        next.participationType = "individual";
        next.resultType = "participation";
        next.achievementLevel = "kingdom";
      }

      if (achievementType === "qudrat") {
        next.participationType = "individual";
        next.resultType = "participation";
        next.achievementLevel = "kingdom";
      }

      if (
        achievementType === "sat" ||
        achievementType === "ielts" ||
        achievementType === "toefl"
      ) {
        next.achievementName = achievementType;
        next.participationType = "individual";
        next.resultType = "score";
        next.achievementLevel = "international";
      }

      return next;
    });

    setAutoLocks({
      levelLocked: false,
      participationLocked: false,
      resultLocked: false,
    });
  }, [achievementType]);

  useEffect(() => {
    if (achievementType !== "competition") return;

    if (AUTO_RULE_COMPETITIONS.includes(achievementName)) {
      setFormData((prev) => {
        const next: Record<string, unknown> = {
          ...prev,
          participationType: "individual",
        };
        if (AUTO_LEVEL_COMPETITIONS.includes(achievementName)) {
          next.achievementLevel = "kingdom";
        }
        return next;
      });

      setAutoLocks({
        levelLocked: AUTO_LEVEL_COMPETITIONS.includes(achievementName),
        participationLocked: true,
        resultLocked: false,
      });
    } else {
      setAutoLocks((prev) => ({
        ...prev,
        levelLocked: false,
        participationLocked: false,
      }));
    }
  }, [achievementType, achievementName]);

  useEffect(() => {
    if (achievementType !== "program") return;

    if (achievementName === "social_volunteer_programs") {
      setFormData((prev) => ({
        ...prev,
        achievementLevel: "province",
      }));
      setAutoLocks((prev) => ({ ...prev, levelLocked: true }));
    } else {
      setAutoLocks((prev) => ({ ...prev, levelLocked: false }));
    }
  }, [achievementType, achievementName]);

  useEffect(() => {
    if (resultType !== "medal") {
      setFormData((prev) => ({ ...prev, medalType: "" }));
    }
    if (resultType !== "rank") {
      setFormData((prev) => ({ ...prev, rank: "" }));
    }
    if (resultType !== "nomination") {
      setFormData((prev) => ({ ...prev, nominationText: "" }));
    }
    if (resultType !== "special_award") {
      setFormData((prev) => ({ ...prev, specialAwardText: "" }));
    }
    if (resultType !== "recognition") {
      setFormData((prev) => ({ ...prev, recognitionText: "" }));
    }
    if (resultType !== "other") {
      setFormData((prev) => ({ ...prev, otherResultText: "" }));
    }
  }, [resultType]);

  const finalAchievementName = useMemo(() => {
    if (achievementType === "gifted_discovery") return "exceptional_gifted";
    if (achievementType === "mawhiba_annual" && String(formData.achievementName || "")) {
      return String(formData.achievementName || "");
    }
    if (achievementName === OLYMPIAD_EVENT_OTHER_VALUE) {
      return customAchievementName.trim();
    }
    if (achievementName === "other") {
      return customAchievementName.trim();
    }
    if (achievementName) return achievementName;

    const localNameAr = String(formData.nameAr || "").trim();
    const localNameEn = String(formData.nameEn || "").trim();
    return localNameAr || localNameEn;
  }, [
    achievementType,
    achievementName,
    customAchievementName,
    formData.achievementName,
    formData.nameAr,
    formData.nameEn,
  ]);

  useEffect(() => {
    if (!achievementType) {
      setInferredField(null);
      return;
    }

    const inference = inferAchievementField(
      achievementType,
      finalAchievementName || achievementName,
      String(formData.olympiadField || ""),
      String(formData.mawhibaAnnualSubject || ""),
      `${customAchievementName} ${String(formData.description || "")}`
    );

    setInferredField({
      field: inference.field,
      category: inference.normalizedCategory,
    });
  }, [
    achievementType,
    achievementName,
    finalAchievementName,
    formData.olympiadField,
    formData.mawhibaAnnualSubject,
    customAchievementName,
    formData.description,
  ]);

  const effectiveInferredFieldSlug = useMemo(() => {
    const override = clampInferredFieldToAllowlist(formData.inferredFieldStudentOverride);
    const ruleField = inferredField?.field;
    if (override && override !== "other") return override;
    if (ruleField && ruleField !== "other") return ruleField;
    return "";
  }, [formData.inferredFieldStudentOverride, inferredField?.field]);

  useEffect(() => {
    if (userRole !== "student") return;
    const aiCtx: AiFieldInferenceContext = {
      userRole,
      uiCategory,
      achievementType,
      achievementName,
      customAchievementName,
      olympiadField: String(formData.olympiadField || ""),
      mawhibaAnnualSubject: String(formData.mawhibaAnnualSubject || ""),
      description: String(formData.description || ""),
      finalAchievementName: finalAchievementName || achievementName,
      locale: isArabic ? "ar" : "en",
    };
    const inShape = isAiFieldInferenceEligibleShape(aiCtx);
    const prev = prevAiInferenceShapeRef.current;
    prevAiInferenceShapeRef.current = inShape;
    if (prev && !inShape) {
      setFormData((p) => {
        const o = String(p.inferredFieldStudentOverride || "").trim();
        if (!o) return p;
        return { ...p, inferredFieldStudentOverride: "" };
      });
    }
  }, [
    userRole,
    uiCategory,
    achievementName,
    achievementType,
    customAchievementName,
    formData.olympiadField,
    formData.mawhibaAnnualSubject,
    formData.description,
    finalAchievementName,
    isArabic,
  ]);

  useEffect(() => {
    if (userRole !== "student") return;

    const aiCtx: AiFieldInferenceContext = {
      userRole,
      uiCategory,
      achievementType,
      achievementName,
      customAchievementName,
      olympiadField: String(formData.olympiadField || ""),
      mawhibaAnnualSubject: String(formData.mawhibaAnnualSubject || ""),
      description: String(formData.description || ""),
      finalAchievementName: finalAchievementName || achievementName,
      locale: isArabic ? "ar" : "en",
    };

    if (!isAiFieldInferenceEligibleShape(aiCtx)) return;

    const otherNeedsCustom =
      uiCategory === "other" ||
      achievementName === "other" ||
      achievementName === OLYMPIAD_EVENT_OTHER_VALUE;
    if (otherNeedsCustom && !String(customAchievementName || "").trim()) {
      setFormData((prev) => {
        const o = String(prev.inferredFieldStudentOverride || "").trim();
        if (!o) return prev;
        return { ...prev, inferredFieldStudentOverride: "" };
      });
      return;
    }

    if (!shouldUseAiFieldInference(aiCtx)) return;

    latestAiFieldInferenceCtxRef.current = aiCtx;

    const gen = ++otherFieldSuggestGenerationRef.current;
    const controller = new AbortController();
    const delayMs = 650;
    const timerId = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/ai/assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            action: "other_field_suggest",
            locale: isArabic ? "ar" : "en",
            achievementCategory: uiCategory,
            achievementType,
            achievementName,
            customAchievementName,
            olympiadField: String(formData.olympiadField || ""),
            mawhibaAnnualSubject: String(formData.mawhibaAnnualSubject || ""),
            description: String(formData.description || ""),
            finalAchievementName: finalAchievementName || achievementName,
          }),
        });
        const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        if (gen !== otherFieldSuggestGenerationRef.current) return;

        if (!res.ok || !j.ok) return;

        const clamped = clampInferredFieldToAllowlist(j.suggestedField);
        const ctxForCompare =
          latestAiFieldInferenceCtxRef.current ?? aiCtx;
        const inferenceInput = buildFieldInferenceInput(ctxForCompare);
        const inferenceDiffersFromInitial =
          inferenceInput !== initialFieldInferenceSnapshotRef.current;

        if (clamped && clamped !== "other") {
          setFormData((prev) => ({
            ...prev,
            inferredFieldStudentOverride: clamped,
          }));
          return;
        }

        if (!inferenceDiffersFromInitial) return;

        setFormData((prev) => {
          const cur = String(prev.inferredFieldStudentOverride || "").trim();
          if (!cur) return prev;
          return { ...prev, inferredFieldStudentOverride: "" };
        });
      } catch {
        /* aborted or network — leave field unchanged */
      }
    }, delayMs);

    return () => {
      window.clearTimeout(timerId);
      controller.abort();
    };
  }, [
    userRole,
    achievementType,
    customAchievementName,
    formData.olympiadField,
    formData.mawhibaAnnualSubject,
    formData.description,
    uiCategory,
    achievementName,
    finalAchievementName,
    isArabic,
  ]);

  useEffect(() => {
    const level = String(formData.achievementLevel || "");
    const type = String(formData.resultType || "");
    if (!level || !type || !achievementType) {
      setScorePreview(0);
      return;
    }

    const requiresCommitteeReview = evidenceRequiredMode === "skipped";
    const scoreResult = calculateAchievementScore({
      achievementType,
      achievementLevel: level,
      resultType: type,
      achievementName: finalAchievementName || achievementName,
      medalType: String(formData.medalType || "") || undefined,
      rank: String(formData.rank || "") || undefined,
      participationType,
      requiresCommitteeReview,
      scoringConfig: scoringCfg ?? undefined,
    });

    setScorePreview(scoreResult.score);
  }, [
    achievementType,
    formData.achievementLevel,
    formData.resultType,
    formData.medalType,
    formData.rank,
    participationType,
    evidenceRequiredMode,
    finalAchievementName,
    achievementName,
    scoringCfg,
  ]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        image: isArabic
          ? "حجم الصورة يجب أن يكون أقل من 5 ميجابايت"
          : "Image size must be less than 5MB",
      }));
      return;
    }

    handleChange("image", file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    handleChange("image", null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const valid = files.filter((f) => f.size <= 10 * 1024 * 1024);
    if (valid.length !== files.length) {
      setErrors((prev) => ({
        ...prev,
        attachments: isArabic
          ? "بعض الملفات تتجاوز 10 ميجابايت"
          : "Some files exceed 10MB",
      }));
    }

    const current = Array.isArray(formData.attachments)
      ? (formData.attachments as File[])
      : [];
    handleChange("attachments", [...current, ...valid]);
  };

  const removeAttachment = (index: number) => {
    const current = Array.isArray(formData.attachments)
      ? (formData.attachments as File[])
      : [];
    const next = current.filter((_, i) => i !== index);
    handleChange("attachments", next);
  };

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};
    const localCategory = String(formData.achievementCategory || "").trim();

    if (!achievementType) {
      nextErrors.achievementType = isArabic
        ? "نوع الإنجاز مطلوب"
        : "Achievement type is required";
    }

    if (!localCategory) {
      nextErrors.achievementCategory = isArabic
        ? "تصنيف الإنجاز مطلوب"
        : "Achievement category is required";
    }

    if (!finalAchievementName) {
      nextErrors.achievementName = isArabic
        ? "اسم الفعالية مطلوب"
        : "Event name is required";
    }

    if (
      achievementType === "olympiad" &&
      achievementName === OLYMPIAD_EVENT_OTHER_VALUE &&
      !customAchievementName.trim()
    ) {
      nextErrors.customAchievementName = isArabic
        ? "اسم الأولمبياد مطلوب"
        : "Olympiad name is required";
    }

    if (
      achievementName === "other" &&
      uiCategory !== "other" &&
      !customAchievementName.trim()
    ) {
      nextErrors.customAchievementName = isArabic
        ? "اسم الفعالية مطلوب"
        : "Custom event name is required";
    }

    if (achievementType === "olympiad" && !String(formData.olympiadField || "").trim()) {
      nextErrors.olympiadField = isArabic
        ? "مجال الأولمبياد مطلوب"
        : "Olympiad field is required";
    }

    const level = String(formData.achievementLevel || "");
    const resolvedResult = String(formData.resultType || "");

    if (!level) {
      nextErrors.achievementLevel = isArabic ? "المستوى مطلوب" : "Level is required";
    }

    if (
      achievementType !== "gifted_discovery" &&
      achievementType !== "qudrat" &&
      achievementType !== "sat" &&
      achievementType !== "ielts" &&
      achievementType !== "toefl"
    ) {
      if (!resolvedResult) {
        nextErrors.resultType = isArabic
          ? "نتيجة المشاركة مطلوبة"
          : "Result type is required";
      }
    }

    if (participationType === "team" && !String(formData.teamRole || "").trim()) {
      nextErrors.teamRole = isArabic ? "دور الطالب مطلوب" : "Team role is required";
    }

    if (resolvedResult === "medal" && !String(formData.medalType || "")) {
      nextErrors.medalType = isArabic
        ? "نوع الميدالية مطلوب"
        : "Medal type is required";
    }

    if (
      resolvedResult === "rank" &&
      achievementType !== "mawhiba_annual" &&
      !String(formData.rank || "")
    ) {
      nextErrors.rank = isArabic ? "المركز مطلوب" : "Rank is required";
    }

    if (resolvedResult === "nomination" && !String(formData.nominationText || "").trim()) {
      nextErrors.nominationText = isArabic
        ? "نص الترشيح مطلوب"
        : "Nomination text is required";
    }

    if (
      resolvedResult === "special_award" &&
      !String(formData.specialAwardText || "").trim()
    ) {
      nextErrors.specialAwardText = isArabic
        ? "نص الجائزة الخاصة مطلوب"
        : "Special award text is required";
    }

    if (
      resolvedResult === "recognition" &&
      !String(formData.recognitionText || "").trim()
    ) {
      nextErrors.recognitionText = isArabic
        ? "نص التكريم مطلوب"
        : "Recognition text is required";
    }

    if (resolvedResult === "other" && !String(formData.otherResultText || "").trim()) {
      nextErrors.otherResultText = isArabic
        ? "وصف النتيجة مطلوب"
        : "Other result text is required";
    }

    if (
      achievementType === "mawhiba_annual" &&
      !String(formData.mawhibaAnnualSubject || "")
    ) {
      nextErrors.mawhibaAnnualSubject = isArabic
        ? "المادة مطلوبة"
        : "Subject is required";
    }

    if (achievementType === "gifted_discovery") {
      const score = Number(formData.giftedDiscoveryScore || 0);
      if (!score || score <= 1600) {
        nextErrors.giftedDiscoveryScore = isArabic
          ? "الدرجة يجب أن تكون أعلى من 1600"
          : "Score must be greater than 1600";
      }
    }

    if (achievementType === "qudrat") {
      if (!(QUDRAT_TIER_ALLOWED_VALUES as readonly string[]).includes(achievementName)) {
        nextErrors.achievementName = isArabic
          ? "اختر نسبة واحدة من القائمة (٩٥٪–١٠٠٪)"
          : "Select one percentage from the list (95%–100%)";
      }
    }

    if (
      achievementType === "sat" ||
      achievementType === "ielts" ||
      achievementType === "toefl"
    ) {
      if (!String(formData.resultValue || "").trim()) {
        nextErrors.resultValue = isArabic
          ? "درجة الاختبار مطلوبة"
          : "Test score is required";
      }
    }

    const hasEvidence = Boolean(
      String(formData.evidenceUrl || "").trim() ||
        String(formData.evidenceFileName || "").trim() ||
        formData.image ||
        (Array.isArray(formData.attachments) && formData.attachments.length > 0)
    );

    if (evidenceRequiredMode !== "skipped" && !hasEvidence) {
      nextErrors.evidenceRequiredMode = isArabic
        ? "يجب رفع إثبات أو إدخال رابط أو اختيار الإحالة للجنة"
        : "Provide evidence file/link or choose committee review";
    }

    setErrors(nextErrors);
    const errKeys = Object.keys(nextErrors);
    if (errKeys.length === 0) return true;

    setTimeout(() => {
      const el = document.getElementById("achievement-form-validation-alert");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el instanceof HTMLElement) el.focus({ preventScroll: true });
    }, 120);

    return false;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validate()) return;

    const resolvedResultType =
      achievementType === "gifted_discovery" || achievementType === "qudrat"
        ? "participation"
        : achievementType === "mawhiba_annual"
          ? "rank"
          : achievementType === "sat" ||
              achievementType === "ielts" ||
              achievementType === "toefl"
            ? "score"
            : String(formData.resultType || "");

    const payload: Record<string, unknown> = {
      ...formData,
      achievementName: finalAchievementName,
      achievementCategory: String(
        uiCategory === "standardized_tests"
          ? "standardized_tests"
          : formData.achievementCategory || achievementType || "competition"
      ),
      achievementClassification: String(
        formData.achievementClassification || "other"
      ),
      achievementDate: String(formData.achievementDate || "").slice(0, 10),
      achievementLevel: String(formData.achievementLevel || ""),
      participationType: String(formData.participationType || "individual"),
      resultType: resolvedResultType,
      inferredField:
        String(formData.inferredFieldStudentOverride || "").trim() ||
        inferredField?.field ||
        "",
      evidenceRequiredMode,
      requiresCommitteeReview: evidenceRequiredMode === "skipped",
      nominationText: String(formData.nominationText || "").trim(),
      specialAwardText: String(formData.specialAwardText || "").trim(),
      recognitionText: String(formData.recognitionText || "").trim(),
      otherResultText: String(formData.otherResultText || "").trim(),
    };

    if (
      achievementType === "sat" ||
      achievementType === "ielts" ||
      achievementType === "toefl"
    ) {
      payload.resultValue = String(formData.resultValue || "").trim();
    } else {
      delete payload.resultValue;
    }

    if (achievementType === "mawhiba_annual") {
      payload.rank =
        String(formData.achievementName || "") || String(formData.rank || "");
    }

    onSubmit(payload);
  };

  const showResultSection =
    achievementType !== "gifted_discovery" &&
    achievementType !== "qudrat" &&
    achievementType !== "sat" &&
    achievementType !== "ielts" &&
    achievementType !== "toefl";
  const hasAutoLockInfo =
    autoLocks.levelLocked || autoLocks.participationLocked || autoLocks.resultLocked;

  const validationErrorEntries = Object.entries(errors);

  return (
    <form onSubmit={handleSubmit} className="space-y-6" dir={isArabic ? "rtl" : "ltr"}>
      {validationErrorEntries.length > 0 && (
        <div
          id="achievement-form-validation-alert"
          role="alert"
          aria-live="assertive"
          tabIndex={-1}
          className="rounded-xl border-2 border-red-500 bg-red-50 p-4 text-red-900 shadow-sm outline-none ring-2 ring-red-200"
        >
          <p className="text-sm font-bold">
            {isArabic
              ? "تعذّر الحفظ — يرجى تصحيح ما يلي:"
              : "Could not save — please fix the following:"}
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm font-medium">
            {validationErrorEntries.map(([fieldKey, message]) => (
              <li key={fieldKey}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <SectionCard>
        <h3 className="mb-4 text-lg font-bold text-text">
          {isArabic ? "معلومات الإنجاز الأساسية" : "Basic Achievement Information"}
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-text">
              {isArabic ? "تصنيف الإنجاز" : "Achievement category"} *
            </label>
            <select
              value={String(formData.achievementCategory || "competition")}
              onChange={(e) => {
                const v = e.target.value;
                handleChange("achievementCategory", v);
                handleChange("achievementName", "");
                handleChange("customAchievementName", "");
                handleChange("olympiadField", "");
                handleChange("mawhibaAnnualSubject", "");
                handleChange("resultValue", "");

                if (v === "standardized_tests") {
                  handleChange("achievementType", "");
                  setAutoLocks((p) => ({ ...p, levelLocked: false }));
                  return;
                }

                handleChange("achievementType", mapUiCategoryToDbAchievementType(v));

                const locked = getAutoLockedLevelByCategory(v);
                if (locked) {
                  handleChange("achievementLevel", locked);
                  setAutoLocks((p) => ({ ...p, levelLocked: true }));
                } else {
                  setAutoLocks((p) => ({ ...p, levelLocked: false }));
                }
              }}
              className={`w-full rounded-xl border ${
                errors.achievementCategory ? "border-red-300" : "border-gray-300"
              } bg-white px-4 py-3 text-sm`}
            >
              {UI_CATEGORY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {isArabic ? item.ar : item.en}
                </option>
              ))}
            </select>
            {errors.achievementCategory && (
              <p className="mt-1 text-xs text-red-600">
                {errors.achievementCategory}
              </p>
            )}
          </div>

          <div>
            {uiCategory === "standardized_tests" ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-text">
                    {isArabic ? "نوع الاختبار المعياري" : "Standardized test"} *
                  </label>
                  <select
                    value={achievementType}
                    onChange={(e) => handleChange("achievementType", e.target.value)}
                    className={`w-full rounded-xl border ${
                      errors.achievementType ? "border-red-300" : "border-gray-300"
                    } bg-white px-4 py-3 text-sm`}
                  >
                    <option value="">
                      {isArabic ? "اختر الاختبار" : "Select test"}
                    </option>
                    {STANDARDIZED_TEST_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {isArabic ? o.ar : o.en}
                      </option>
                    ))}
                  </select>
                  {errors.achievementType && (
                    <p className="mt-1 text-xs text-red-600">{errors.achievementType}</p>
                  )}
                </div>

                {(achievementType === "qudrat" || achievementType === "mawhiba_annual") && (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-text">
                      {achievementType === "qudrat"
                        ? isArabic
                          ? "نتيجة الاختبار (%) *"
                          : "Test score (%) *"
                        : isArabic
                          ? "المركز *"
                          : "Rank *"}
                    </label>
                    <select
                      value={achievementName}
                      onChange={(e) => {
                        const value = e.target.value;
                        handleChange("achievementName", value);
                        if (achievementType === "mawhiba_annual") {
                          handleChange("rank", value);
                        }
                      }}
                      className={`w-full rounded-xl border ${
                        errors.achievementName ? "border-red-300" : "border-gray-300"
                      } bg-white px-4 py-3 text-sm`}
                    >
                      <option value="">
                        {isArabic ? "اختر القيمة" : "Select value"}
                      </option>
                      {availableNames.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    {errors.achievementName && (
                      <p className="mt-1 text-xs text-red-600">{errors.achievementName}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                <label className="mb-2 block text-sm font-semibold text-text">
                  {isArabic ? "اسم الفعالية من القائمة" : "Event name from list"} *
                </label>

                {uiCategory === "other" ? (
                  <input
                    type="text"
                    value={customAchievementName || achievementName}
                    onChange={(e) => {
                      handleChange("customAchievementName", e.target.value);
                      handleChange("achievementName", e.target.value);
                    }}
                    className={`w-full rounded-xl border ${
                      errors.achievementName ? "border-red-300" : "border-gray-300"
                    } bg-white px-4 py-3 text-sm`}
                    placeholder={isArabic ? "اسم الفعالية (يدوي)" : "Event name (manual)"}
                  />
                ) : (
                  <select
                    value={achievementName}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleChange("achievementName", value);

                      if (achievementType === "olympiad") {
                        const lvl = getAutoLevelForOlympiadNesmoEvent(value);

                        if (lvl) {
                          handleChange("achievementLevel", lvl);
                          setAutoLocks((p) => ({ ...p, levelLocked: true }));
                        }

                        if (value === OLYMPIAD_EVENT_OTHER_VALUE) {
                          setAutoLocks((p) => ({ ...p, levelLocked: false }));
                        } else {
                          handleChange("customAchievementName", "");
                        }
                      } else if (value !== "other") {
                        handleChange("customAchievementName", "");
                      }

                      if (achievementType === "mawhiba_annual") {
                        handleChange("rank", value);
                      }
                    }}
                    disabled={achievementType === "gifted_discovery"}
                    className={`w-full rounded-xl border ${
                      errors.achievementName ? "border-red-300" : "border-gray-300"
                    } bg-white px-4 py-3 text-sm ${
                      achievementType === "gifted_discovery"
                        ? "cursor-not-allowed opacity-60"
                        : ""
                    }`}
                  >
                    <option value="">
                      {isArabic ? "اختر الاسم" : "Select name"}
                    </option>
                    {availableNames.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}

            {achievementName === OLYMPIAD_EVENT_OTHER_VALUE && (
              <input
                type="text"
                value={customAchievementName}
                onChange={(e) => handleChange("customAchievementName", e.target.value)}
                className={`mt-2 w-full rounded-xl border ${
                  errors.customAchievementName ? "border-red-300" : "border-gray-300"
                } bg-white px-4 py-3 text-sm`}
                placeholder={isArabic ? "اسم الأولمبياد" : "Olympiad name"}
              />
            )}

            {achievementName === "other" && uiCategory !== "other" && (
              <input
                type="text"
                value={customAchievementName}
                onChange={(e) => handleChange("customAchievementName", e.target.value)}
                className={`mt-2 w-full rounded-xl border ${
                  errors.customAchievementName ? "border-red-300" : "border-gray-300"
                } bg-white px-4 py-3 text-sm`}
                placeholder={isArabic ? "اسم الفعالية (يدوي)" : "Event name (manual)"}
              />
            )}

            {uiCategory !== "standardized_tests" && errors.achievementName && (
              <p className="mt-1 text-xs text-red-600">{errors.achievementName}</p>
            )}
            {errors.customAchievementName && (
              <p className="mt-1 text-xs text-red-600">
                {errors.customAchievementName}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-text">
              {isArabic ? "المستوى" : "Level"} *
            </label>
            <select
              value={String(formData.achievementLevel || "")}
              onChange={(e) => handleChange("achievementLevel", e.target.value)}
              disabled={levelSelectDisabled}
              className={`w-full rounded-xl border ${
                errors.achievementLevel ? "border-red-300" : "border-gray-300"
              } bg-white px-4 py-3 text-sm ${
                levelSelectDisabled ? "cursor-not-allowed opacity-60" : ""
              }`}
            >
              <option value="">
                {isArabic ? "اختر المستوى" : "Select level"}
              </option>
              {ACHIEVEMENT_LEVELS.map((item) => (
                <option key={item.value} value={item.value}>
                  {isArabic ? item.ar : item.en}
                </option>
              ))}
            </select>
            {levelSelectDisabled && (
              <p className="mt-1 text-xs text-text-light">
                {isArabic
                  ? "تم تحديد هذه القيمة تلقائيًا حسب نوع/اسم الإنجاز"
                  : "This value is auto-set by achievement rules"}
              </p>
            )}
            {errors.achievementLevel && (
              <p className="mt-1 text-xs text-red-600">{errors.achievementLevel}</p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-text">
              {isArabic ? "تاريخ الإنجاز" : "Achievement date"} *
            </label>
            <input
              type="date"
              value={String(formData.achievementDate || "").slice(0, 10)}
              onChange={(e) => {
                const v = e.target.value;
                handleChange("achievementDate", v);
                const y = v ? Number(v.slice(0, 4)) : new Date().getFullYear();
                if (!Number.isNaN(y)) handleChange("achievementYear", y);
              }}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm"
            />
            <p className="mt-1 text-xs text-text-light">
              {isArabic
                ? "للبيانات القديمة التي تحتوي سنة فقط، يُستخدم أول اليوم من السنة"
                : "Legacy year-only records default to Jan 1 of that year"}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="mb-1 text-xs font-semibold text-text-light">
            {isArabic ? "مجال النشاط" : "Activity field"}
          </p>
          <p className="font-bold text-text">
            {labelInferredField(effectiveInferredFieldSlug, isArabic ? "ar" : "en")}
          </p>
        </div>
      </SectionCard>

      <SectionCard>
        <h3 className="mb-4 text-lg font-bold text-text">
          {isArabic ? "تفاصيل خاصة حسب النوع" : "Type-specific Details"}
        </h3>

        {achievementType === "olympiad" && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-text">
              {isArabic ? "المجال الأولمبياد" : "Olympiad Field"} *
            </label>
            <select
              value={String(formData.olympiadField || "")}
              onChange={(e) => handleChange("olympiadField", e.target.value)}
              className={`w-full rounded-xl border ${
                errors.olympiadField ? "border-red-300" : "border-gray-300"
              } bg-white px-4 py-3 text-sm`}
            >
              <option value="">
                {isArabic ? "اختر المجال" : "Select field"}
              </option>
              {OLYMPIAD_FIELDS.map((item) => (
                <option key={item.value} value={item.value}>
                  {isArabic ? item.ar : item.en}
                </option>
              ))}
            </select>
            {errors.olympiadField && (
              <p className="mt-1 text-xs text-red-600">{errors.olympiadField}</p>
            )}
          </div>
        )}

        {achievementType === "mawhiba_annual" && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-text">
              {isArabic ? "المادة" : "Subject"} *
            </label>
            <select
              value={String(formData.mawhibaAnnualSubject || "")}
              onChange={(e) => handleChange("mawhibaAnnualSubject", e.target.value)}
              className={`w-full rounded-xl border ${
                errors.mawhibaAnnualSubject ? "border-red-300" : "border-gray-300"
              } bg-white px-4 py-3 text-sm`}
            >
              <option value="">
                {isArabic ? "اختر المادة" : "Select subject"}
              </option>
              {getMawhibaAnnualSubjectOptionsForCategory(
                uiCategory,
                MAWHIBA_ANNUAL_SUBJECTS
              ).map((item) => (
                <option key={item.value} value={item.value}>
                  {isArabic ? item.ar : item.en}
                </option>
              ))}
            </select>
            {errors.mawhibaAnnualSubject && (
              <p className="mt-1 text-xs text-red-600">
                {errors.mawhibaAnnualSubject}
              </p>
            )}
          </div>
        )}

        {achievementType === "gifted_discovery" && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-text">
              {isArabic ? "الدرجة" : "Score"} *
            </label>
            <input
              type="number"
              value={Number(formData.giftedDiscoveryScore || "") || ""}
              onChange={(e) =>
                handleChange(
                  "giftedDiscoveryScore",
                  Number(e.target.value) || undefined
                )
              }
              className={`w-full rounded-xl border ${
                Number(formData.giftedDiscoveryScore || 0) > 0 &&
                Number(formData.giftedDiscoveryScore || 0) <= 1600
                  ? "border-red-500 ring-2 ring-red-200"
                  : errors.giftedDiscoveryScore
                    ? "border-red-300"
                    : "border-gray-300"
              } bg-white px-4 py-3 text-sm`}
              placeholder={isArabic ? "أدخل الدرجة (أكبر من 1600)" : "Enter score (>1600)"}
            />
            {errors.giftedDiscoveryScore && (
              <p className="mt-1 text-xs text-red-600">
                {errors.giftedDiscoveryScore}
              </p>
            )}
          </div>
        )}

        {achievementType === "qudrat" && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
            <p className="text-text-light">
              {isArabic ? "الدرجة المختارة" : "Selected score"}
            </p>
            <p className="font-semibold text-text">{finalAchievementName || "-"}</p>
          </div>
        )}

        {(achievementType === "sat" ||
          achievementType === "ielts" ||
          achievementType === "toefl") && (
          <div>
            <label className="mb-2 block text-sm font-semibold text-text">
              {isArabic ? "درجة الاختبار" : "Test score"} *
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={String(formData.resultValue || "")}
              onChange={(e) => handleChange("resultValue", e.target.value)}
              className={`w-full rounded-xl border ${
                errors.resultValue ? "border-red-300" : "border-gray-300"
              } bg-white px-4 py-3 text-sm`}
              placeholder={
                isArabic ? "أدخل الدرجة (مثال: 1500 أو 7.5)" : "Enter score (e.g. 1500 or 7.5)"
              }
              aria-invalid={Boolean(errors.resultValue)}
            />
            {errors.resultValue && (
              <p className="mt-1 text-xs text-red-600">{errors.resultValue}</p>
            )}
          </div>
        )}

        {!achievementType && (
          <p className="text-sm text-text-light">
            {isArabic ? "اختر نوع الإنجاز أولاً" : "Select achievement type first"}
          </p>
        )}
      </SectionCard>

      <SectionCard>
        <h3 className="mb-4 text-lg font-bold text-text">
          {isArabic ? "المشاركة" : "Participation"}
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-text">
              {isArabic ? "نوع المشاركة" : "Participation Type"}
            </label>
            <select
              value={participationType}
              onChange={(e) => handleChange("participationType", e.target.value)}
              disabled={
                autoLocks.participationLocked ||
                achievementType === "gifted_discovery" ||
                achievementType === "qudrat" ||
                achievementType === "sat" ||
                achievementType === "ielts" ||
                achievementType === "toefl"
              }
              className={`w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm ${
                autoLocks.participationLocked ||
                achievementType === "gifted_discovery" ||
                achievementType === "qudrat" ||
                achievementType === "sat" ||
                achievementType === "ielts" ||
                achievementType === "toefl"
                  ? "cursor-not-allowed opacity-60"
                  : ""
              }`}
            >
              {PARTICIPATION_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {isArabic ? item.ar : item.en}
                </option>
              ))}
            </select>
            {(autoLocks.participationLocked ||
              achievementType === "gifted_discovery" ||
              achievementType === "qudrat" ||
              achievementType === "sat" ||
              achievementType === "ielts" ||
              achievementType === "toefl") && (
              <p className="mt-1 text-xs text-text-light">
                {isArabic
                  ? "تم تحديد هذه القيمة تلقائيًا حسب نوع الإنجاز"
                  : "This value is auto-set by achievement rules"}
              </p>
            )}
          </div>

          {participationType === "team" && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-text">
                {isArabic ? "دور الطالب في الفريق" : "Student Team Role"} *
              </label>
              <input
                type="text"
                value={String(formData.teamRole || "")}
                onChange={(e) => handleChange("teamRole", e.target.value)}
                className={`w-full rounded-xl border ${
                  errors.teamRole ? "border-red-300" : "border-gray-300"
                } bg-white px-4 py-3 text-sm`}
              />
              {errors.teamRole && (
                <p className="mt-1 text-xs text-red-600">{errors.teamRole}</p>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {showResultSection && (
        <SectionCard>
          <h3 className="mb-4 text-lg font-bold text-text">
            {isArabic ? "النتيجة" : "Result"}
          </h3>

          <div>
            <label className="mb-2 block text-sm font-semibold text-text">
              {isArabic ? "نتيجة المشاركة" : "Participation Result"} *
            </label>
            <select
              value={resultType}
              onChange={(e) => handleChange("resultType", e.target.value)}
              disabled={autoLocks.resultLocked || achievementType === "mawhiba_annual"}
              className={`w-full rounded-xl border ${
                errors.resultType ? "border-red-300" : "border-gray-300"
              } bg-white px-4 py-3 text-sm ${
                autoLocks.resultLocked || achievementType === "mawhiba_annual"
                  ? "cursor-not-allowed opacity-60"
                  : ""
              }`}
            >
              <option value="">
                {isArabic ? "اختر النتيجة" : "Select result"}
              </option>
              {ACHIEVEMENT_RESULT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {isArabic ? item.ar : item.en}
                </option>
              ))}
            </select>
            {achievementType === "mawhiba_annual" && (
              <p className="mt-1 text-xs text-text-light">
                {isArabic
                  ? "تم تحديد النتيجة تلقائيًا حسب نوع الإنجاز"
                  : "Result is auto-set by achievement rules"}
              </p>
            )}
            {errors.resultType && (
              <p className="mt-1 text-xs text-red-600">{errors.resultType}</p>
            )}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {resultType === "medal" && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-text">
                  {isArabic ? "نوع الميدالية" : "Medal Type"} *
                </label>
                <select
                  value={String(formData.medalType || "")}
                  onChange={(e) => handleChange("medalType", e.target.value)}
                  className={`w-full rounded-xl border ${
                    errors.medalType ? "border-red-300" : "border-gray-300"
                  } bg-white px-4 py-3 text-sm`}
                >
                  <option value="">{isArabic ? "اختر" : "Select"}</option>
                  <option value="gold">{isArabic ? "ذهبية" : "Gold"}</option>
                  <option value="silver">{isArabic ? "فضية" : "Silver"}</option>
                  <option value="bronze">{isArabic ? "برونزية" : "Bronze"}</option>
                </select>
                {errors.medalType && (
                  <p className="mt-1 text-xs text-red-600">{errors.medalType}</p>
                )}
              </div>
            )}

            {resultType === "rank" && achievementType !== "mawhiba_annual" && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-text">
                  {isArabic ? "المركز" : "Rank"} *
                </label>
                <select
                  value={String(formData.rank || "")}
                  onChange={(e) => handleChange("rank", e.target.value)}
                  className={`w-full rounded-xl border ${
                    errors.rank ? "border-red-300" : "border-gray-300"
                  } bg-white px-4 py-3 text-sm`}
                >
                  <option value="">
                    {isArabic ? "اختر المركز" : "Select rank"}
                  </option>
                  {[
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
                  ].map((rk) => (
                    <option key={rk} value={rk}>
                      {rk === "first"
                        ? isArabic
                          ? "المركز الأول"
                          : "First"
                        : rk === "second"
                          ? isArabic
                            ? "المركز الثاني"
                            : "Second"
                          : rk === "third"
                            ? isArabic
                              ? "المركز الثالث"
                              : "Third"
                            : rk}
                    </option>
                  ))}
                </select>
                {errors.rank && (
                  <p className="mt-1 text-xs text-red-600">{errors.rank}</p>
                )}
              </div>
            )}

            {resultType === "nomination" && (
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-text">
                  {isArabic ? "نص الترشيح" : "Nomination Text"} *
                </label>
                <input
                  type="text"
                  value={String(formData.nominationText || "")}
                  onChange={(e) => handleChange("nominationText", e.target.value)}
                  className={`w-full rounded-xl border ${
                    errors.nominationText ? "border-red-300" : "border-gray-300"
                  } bg-white px-4 py-3 text-sm`}
                  placeholder={
                    isArabic ? "مثال: مرشح للتصفيات النهائية" : "e.g. Nominated for final stage"
                  }
                />
                {errors.nominationText && (
                  <p className="mt-1 text-xs text-red-600">{errors.nominationText}</p>
                )}
              </div>
            )}

            {resultType === "special_award" && (
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-text">
                  {isArabic ? "نص الجائزة الخاصة" : "Special Award Text"} *
                </label>
                <input
                  type="text"
                  value={String(formData.specialAwardText || "")}
                  onChange={(e) => handleChange("specialAwardText", e.target.value)}
                  className={`w-full rounded-xl border ${
                    errors.specialAwardText ? "border-red-300" : "border-gray-300"
                  } bg-white px-4 py-3 text-sm`}
                  placeholder={
                    isArabic ? "مثال: جائزة التميز الخاصة" : "e.g. Special Excellence Award"
                  }
                />
                {errors.specialAwardText && (
                  <p className="mt-1 text-xs text-red-600">{errors.specialAwardText}</p>
                )}
              </div>
            )}

            {resultType === "recognition" && (
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-text">
                  {isArabic ? "نص التكريم" : "Recognition Text"} *
                </label>
                <input
                  type="text"
                  value={String(formData.recognitionText || "")}
                  onChange={(e) => handleChange("recognitionText", e.target.value)}
                  className={`w-full rounded-xl border ${
                    errors.recognitionText ? "border-red-300" : "border-gray-300"
                  } bg-white px-4 py-3 text-sm`}
                  placeholder={
                    isArabic ? "مثال: شهادة تكريم" : "e.g. Recognition certificate"
                  }
                />
                {errors.recognitionText && (
                  <p className="mt-1 text-xs text-red-600">{errors.recognitionText}</p>
                )}
              </div>
            )}

            {resultType === "other" && (
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-text">
                  {isArabic ? "وصف النتيجة" : "Other Result Description"} *
                </label>
                <input
                  type="text"
                  value={String(formData.otherResultText || "")}
                  onChange={(e) => handleChange("otherResultText", e.target.value)}
                  className={`w-full rounded-xl border ${
                    errors.otherResultText ? "border-red-300" : "border-gray-300"
                  } bg-white px-4 py-3 text-sm`}
                  placeholder={
                    isArabic ? "اكتب وصف النتيجة" : "Describe the result"
                  }
                />
                {errors.otherResultText && (
                  <p className="mt-1 text-xs text-red-600">{errors.otherResultText}</p>
                )}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      <SectionCard>
        <h3 className="mb-4 text-lg font-bold text-text">
          {isArabic ? "الوصف والإثبات" : "Description & Evidence"}
        </h3>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-semibold text-text">
            {isArabic ? "وصف مختصر" : "Brief Description"}
          </label>
          <textarea
            rows={4}
            value={String(formData.description || "")}
            onChange={(e) => handleChange("description", e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm"
          />
        </div>

        <div className="mb-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-text">
              {isArabic ? "رابط الإثبات" : "Evidence URL"}
            </label>
            <input
              type="url"
              value={String(formData.evidenceUrl || "")}
              onChange={(e) => handleChange("evidenceUrl", e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-text">
              {isArabic ? "اسم ملف الإثبات" : "Evidence File Name"}
            </label>
            <input
              type="text"
              value={String(formData.evidenceFileName || "")}
              onChange={(e) => handleChange("evidenceFileName", e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm"
            />
          </div>
        </div>

        <div className="mb-4 space-y-3">
          {imagePreview ? (
            <div className="relative">
              <div className="relative h-44 w-full overflow-hidden rounded-xl border border-gray-300">
                <Image
                  src={imagePreview}
                  alt="preview"
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
              <button
                type="button"
                onClick={removeImage}
                className="absolute left-2 top-2 rounded-full bg-red-500 p-1 text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm"
            >
              <Upload className="h-4 w-4" />
              <span>{isArabic ? "رفع صورة إثبات" : "Upload evidence image"}</span>
            </button>
          )}

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
          {errors.image && <p className="text-xs text-red-600">{errors.image}</p>}
        </div>

        <div className="mb-4">
          <button
            type="button"
            onClick={() => attachmentsInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm"
          >
            <FileText className="h-4 w-4" />
            <span>{isArabic ? "إضافة مرفق إثبات" : "Add evidence attachment"}</span>
          </button>

          <input
            ref={attachmentsInputRef}
            type="file"
            multiple
            onChange={handleAttachmentChange}
            className="hidden"
          />

          {Array.isArray(formData.attachments) && formData.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {(formData.attachments as File[]).map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-2 text-sm"
                >
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {errors.attachments && (
            <p className="mt-1 text-xs text-red-600">{errors.attachments}</p>
          )}
        </div>

        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="mb-2 text-sm font-semibold text-amber-800">
            {isArabic ? "وضع الإثبات" : "Evidence Mode"}
          </p>
          <label className="mb-2 flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={evidenceRequiredMode === "provided"}
              onChange={() => handleChange("evidenceRequiredMode", "provided")}
            />
            <span>{isArabic ? "تم تقديم إثبات" : "Evidence provided"}</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={evidenceRequiredMode === "skipped"}
              onChange={() => handleChange("evidenceRequiredMode", "skipped")}
            />
            <span>
              {isArabic
                ? "تجاوز وسيحال للجنة التحكيم"
                : "Skip and send to committee review"}
            </span>
          </label>
          {errors.evidenceRequiredMode && (
            <p className="mt-2 text-xs text-red-600">{errors.evidenceRequiredMode}</p>
          )}
        </div>
      </SectionCard>

      <SectionCard className="bg-gradient-to-br from-slate-50 to-white">
        <h3 className="mb-4 text-lg font-bold text-text">
          {isArabic ? "ملخص الفحص والاعتماد" : "Verification & Review Summary"}
        </h3>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-text-light">
              {isArabic ? "المجال المستنتج" : "Inferred Field"}
            </p>
            <p className="font-semibold">
              {labelInferredField(effectiveInferredFieldSlug, isArabic ? "ar" : "en")}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-text-light">
              {isArabic ? "حالة الإثبات" : "Evidence State"}
            </p>
            <p className="font-semibold">
              {evidenceRequiredMode === "skipped"
                ? labelVerificationStatus(
                    "pending_committee_review",
                    isArabic ? "ar" : "en"
                  )
                : isArabic
                  ? "تم رفع/إدخال إثبات"
                  : "Evidence provided"}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-text-light">
              {isArabic ? "حالة الاعتماد" : "Verification Status"}
            </p>
            <p className="font-semibold">
              {evidenceRequiredMode === "skipped"
                ? labelVerificationStatus(
                    "pending_committee_review",
                    isArabic ? "ar" : "en"
                  )
                : labelVerificationStatus("unverified", isArabic ? "ar" : "en")}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-text-light">
              {isArabic ? "النقاط المحتسبة مبدئيًا" : "Provisional Score"}
            </p>
            <p className="font-semibold">
              {evidenceRequiredMode === "skipped" ? 0 : scorePreview}
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 text-sm text-text-light">
          <div className="mb-1 flex items-center gap-2">
            <Info className="h-4 w-4" />
            <span>{isArabic ? "ملخص فحص الإثبات" : "Evidence check summary"}</span>
          </div>
          <p>
            {evidenceRequiredMode === "skipped"
              ? isArabic
                ? "تم اختيار تجاوز الإثبات، سيحال الإنجاز إلى اللجنة ولن يتم منح نقاط نهائية الآن."
                : "Evidence was skipped. Item is sent to committee and will not receive final score now."
              : isArabic
                ? "تعذر إجراء مطابقة كاملة، سيحتاج الإنجاز إلى مراجعة."
                : "Full matching could not be completed; achievement may require review."}
          </p>
        </div>
      </SectionCard>

      <div>
        {hasAutoLockInfo && (
          <div className="mb-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary">
            {isArabic
              ? "تم تحديد بعض القيم تلقائيًا حسب نوع/اسم الإنجاز"
              : "Some values were auto-set based on achievement type/name"}
          </div>
        )}

        {canSetFeatured && (
          <div className="mb-3 rounded-lg border border-gray-200 bg-white p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-text">
              <input
                type="checkbox"
                checked={Boolean(formData.featured)}
                onChange={(e) => handleChange("featured", e.target.checked)}
              />
              <span>{isArabic ? "إنجاز مميز" : "Featured achievement"}</span>
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? isArabic
              ? "جاري الحفظ..."
              : "Saving..."
            : isArabic
              ? "حفظ الإنجاز"
              : "Save Achievement"}
        </button>
      </div>
    </form>
  );
};

export default AchievementForm;