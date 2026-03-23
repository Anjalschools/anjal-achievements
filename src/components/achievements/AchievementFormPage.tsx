"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import AchievementForm from "@/components/achievements/AchievementForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { getTranslation } from "@/locales";

const AchievementFormPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get("edit");
  const isEdit = Boolean(editId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEditData, setIsLoadingEditData] = useState(false);
  const [initialData, setInitialData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const locale = getLocale();
  getTranslation(locale);

  useEffect(() => {
    const fetchForEdit = async () => {
      if (!editId) return;
      try {
        setIsLoadingEditData(true);
        setError(null);
        const response = await fetch(`/api/achievements/${editId}`, { cache: "no-store" });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.error || "Failed to load achievement for edit");
        }
        const data = await response.json();
        setInitialData(data);
      } catch (err: any) {
        setError(err?.message || (locale === "ar" ? "تعذر تحميل بيانات الإنجاز للتعديل" : "Failed to load achievement for editing"));
      } finally {
        setIsLoadingEditData(false);
      }
    };
    fetchForEdit();
  }, [editId, locale]);

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      let imageBase64: string | undefined = undefined;
      if (data.image instanceof File) {
        imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === "string") {
              resolve(reader.result);
            } else {
              reject(new Error("Failed to convert image to base64"));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(data.image);
        });
      } else if (typeof data.image === "string") {
        imageBase64 = data.image;
      }

      const attachmentsBase64: string[] = [];
      if (data.attachments && Array.isArray(data.attachments)) {
        for (const file of data.attachments) {
          if (file instanceof File) {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                if (typeof reader.result === "string") {
                  resolve(reader.result);
                } else {
                  reject(new Error("Failed to convert attachment to base64"));
                }
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            attachmentsBase64.push(base64);
          } else if (typeof file === "string") {
            attachmentsBase64.push(file);
          }
        }
      }

      let actualAchievementName: string | undefined = undefined;
      if (data.achievementName && data.achievementName !== "other") {
        actualAchievementName = data.achievementName;
      } else if (data.customAchievementName) {
        actualAchievementName = data.customAchievementName;
      } else if (data.nameAr || data.nameEn) {
        actualAchievementName = data.nameAr || data.nameEn;
      } else if (data.achievementType === "gifted_discovery") {
        actualAchievementName = "exceptional_gifted";
      }

      const payload: any = {
        achievementType: data.achievementType,
        achievementCategory: data.achievementCategory || data.achievementType || "competition",
        achievementClassification: data.achievementClassification,
        achievementLevel: data.achievementLevel,
        participationType: data.participationType,
        resultType: data.resultType,
        resultValue: data.resultValue,
        nameAr: data.nameAr || actualAchievementName || "",
        nameEn: data.nameEn || actualAchievementName || "",
        achievementYear: data.achievementYear || new Date().getFullYear(),
        achievementDate: data.achievementDate,
        featured: data.featured || false,
        evidenceRequiredMode: data.evidenceRequiredMode || "provided",
      };

      if (data.inferredField && String(data.inferredField).trim()) {
        payload.inferredField = String(data.inferredField).trim();
      }

      if (actualAchievementName) {
        if (data.achievementName && data.achievementName !== "other") {
          payload.achievementName = data.achievementName;
        } else if (data.customAchievementName) {
          payload.customAchievementName = data.customAchievementName;
        }
      }

      if (data.medalType) payload.medalType = data.medalType;
      if (data.rank) payload.rank = data.rank;
      if (data.nominationText) payload.nominationText = data.nominationText;
      if (data.specialAwardText) payload.specialAwardText = data.specialAwardText;
      if (data.recognitionText) payload.recognitionText = data.recognitionText;
      if (data.otherResultText) payload.otherResultText = data.otherResultText;

      if (data.participationType === "team" && data.teamRole) {
        payload.teamRole = data.teamRole;
      }

      if (data.achievementType === "program") {
        if (data.programName && data.programName !== "other") {
          payload.programName = data.programName;
        } else if (data.customProgramName) {
          payload.customProgramName = data.customProgramName;
        }
      }

      if (data.achievementType === "competition") {
        if (data.competitionName && data.competitionName !== "other") {
          payload.competitionName = data.competitionName;
        } else if (data.customCompetitionName) {
          payload.customCompetitionName = data.customCompetitionName;
        }
      }

      if (data.achievementType === "exhibition") {
        if (data.exhibitionName && data.exhibitionName !== "other") {
          payload.exhibitionName = data.exhibitionName;
        } else if (data.customExhibitionName) {
          payload.customExhibitionName = data.customExhibitionName;
        }
      }

      if (data.achievementType === "olympiad") {
        if (data.olympiadMeeting) payload.olympiadMeeting = data.olympiadMeeting;
        if (data.olympiadField) payload.olympiadField = data.olympiadField;
      }

      if (data.achievementType === "excellence_program") {
        if (data.excellenceProgramName && data.excellenceProgramName !== "other") {
          payload.excellenceProgramName = data.excellenceProgramName;
        } else if (data.customExcellenceProgramName) {
          payload.customExcellenceProgramName = data.customExcellenceProgramName;
        }
      }

      if (data.achievementType === "qudrat" && data.qudratScore) {
        payload.qudratScore = data.qudratScore;
      }

      if (data.achievementType === "mawhiba_annual") {
        if (data.mawhibaAnnualRank) payload.mawhibaAnnualRank = data.mawhibaAnnualRank;
        if (data.mawhibaAnnualSubject) payload.mawhibaAnnualSubject = data.mawhibaAnnualSubject;
      }

      if (data.achievementType === "gifted_discovery" && data.giftedDiscoveryScore) {
        payload.giftedDiscoveryScore = data.giftedDiscoveryScore;
      }

      if (data.description) payload.description = data.description;
      if (imageBase64) payload.image = imageBase64;
      if (attachmentsBase64.length > 0) payload.attachments = attachmentsBase64;
      if (data.evidenceUrl) payload.evidenceUrl = data.evidenceUrl;
      if (data.evidenceFileName) payload.evidenceFileName = data.evidenceFileName;

      const endpoint = isEdit && editId ? `/api/achievements/${editId}` : "/api/achievements";
      const method = isEdit ? "PUT" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (!response.ok) {
        if (response.status === 409 && responseData.code === "DUPLICATE_ACHIEVEMENT") {
          const primary =
            locale === "ar"
              ? String(responseData.messageAr || "").trim()
              : String(responseData.messageEn || "").trim();
          const hint =
            locale === "ar"
              ? String(responseData.hintAr || "").trim()
              : String(responseData.hintEn || "").trim();
          const msg = [primary || responseData.error, hint].filter(Boolean).join("\n\n");
          throw new Error(msg || (locale === "ar" ? "تعارض مع إنجاز مسجل مسبقاً" : "Duplicate achievement"));
        }
        if (responseData.errors) {
          const errorMessages = Array.isArray(responseData.errors)
            ? responseData.errors.join(", ")
            : Object.values(responseData.errors).join(", ");
          throw new Error(errorMessages);
        }
        throw new Error(responseData.error || "Failed to save achievement");
      }

      setSuccess(true);

      setTimeout(() => {
        router.refresh();
        router.push("/achievements");
      }, 1500);
    } catch (error: any) {
      console.error("Error saving achievement:", error);
      setError(error.message || (locale === "ar" ? "حدث خطأ أثناء حفظ الإنجاز" : "Error saving achievement"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={
          isEdit
            ? locale === "ar"
              ? "تعديل إنجاز"
              : "Edit Achievement"
            : locale === "ar"
              ? "إضافة إنجاز جديد"
              : "Add New Achievement"
        }
        subtitle={
          locale === "ar"
            ? "شارك إنجازك مع المجتمع التعليمي"
            : "Share your achievement with the educational community"
        }
        actions={
          <Link
            href="/achievements"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{locale === "ar" ? "إلغاء" : "Cancel"}</span>
          </Link>
        }
      />

      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
          <p className="font-medium">
            {isEdit
              ? locale === "ar"
                ? "تم تحديث الإنجاز بنجاح!"
                : "Achievement updated successfully!"
              : locale === "ar"
                ? "تم إنشاء الإنجاز بنجاح!"
                : "Achievement created successfully!"}
          </p>
          <p className="mt-1 text-sm">
            {locale === "ar" ? "جاري إعادة التوجيه..." : "Redirecting..."}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-medium">
            {locale === "ar" ? "حدث خطأ" : "Error"}
          </p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      )}

      {isLoadingEditData ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-text-light">
          {locale === "ar" ? "جاري تحميل بيانات الإنجاز..." : "Loading achievement data..."}
        </div>
      ) : (
        <AchievementForm
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          initialData={initialData || undefined}
          userRole="student"
        />
      )}
    </PageContainer>
  );
};

export default AchievementFormPage;
