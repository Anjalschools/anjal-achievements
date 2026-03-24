"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import AchievementForm from "@/components/achievements/AchievementForm";
import AdminAchievementIdentitySection, {
  type AdminAchievementIdentityState,
  type AdminIdentitySearchHit,
} from "@/components/achievements/AdminAchievementIdentitySection";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { getTranslation } from "@/locales";
import { buildAchievementFormSubmitPayload } from "@/lib/achievement-form-submit-payload";

export type AchievementFormPageVariant = "student" | "admin";

type AchievementFormPageProps = {
  variant?: AchievementFormPageVariant;
};

const defaultAdminIdentity = (): AdminAchievementIdentityState => ({
  inputMode: "linked",
  q: "",
  hits: [] as AdminIdentitySearchHit[],
  linkedUserId: "",
  linkedLabel: "",
  snapshotFullNameAr: "",
  snapshotFullNameEn: "",
  snapshotGender: "male",
  snapshotGrade: "g12",
  snapshotSection: "arabic",
  externalStudentKind: "external_student",
  snapshotStudentStatus: "current",
  adminStatus: "pending_review",
  showInPublicPortfolio: true,
  showInHallOfFame: true,
});

const AchievementFormPage = ({ variant = "student" }: AchievementFormPageProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = variant === "admin" ? null : searchParams?.get("edit");
  const isEdit = Boolean(editId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingEditData, setIsLoadingEditData] = useState(false);
  const [initialData, setInitialData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const saveErrorRef = useRef<HTMLDivElement | null>(null);
  const locale = getLocale();
  const isAr = locale === "ar";
  getTranslation(locale);

  const [adminIdentity, setAdminIdentity] = useState<AdminAchievementIdentityState>(defaultAdminIdentity);

  const runStudentSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setAdminIdentity((s) => ({ ...s, hits: [] }));
      return;
    }
    const res = await fetch(`/api/admin/students/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
    const data = (await res.json()) as { items?: AdminIdentitySearchHit[] };
    setAdminIdentity((s) => ({ ...s, hits: data.items || [] }));
  }, []);

  useEffect(() => {
    if (variant !== "admin") return;
    const q = adminIdentity.q;
    const t = window.setTimeout(() => void runStudentSearch(q), 300);
    return () => window.clearTimeout(t);
  }, [variant, adminIdentity.q, runStudentSearch]);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => {
      saveErrorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      saveErrorRef.current?.focus({ preventScroll: true });
    }, 120);
    return () => window.clearTimeout(t);
  }, [error]);

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
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "";
        setError(
          msg ||
            (locale === "ar" ? "تعذر تحميل بيانات الإنجاز للتعديل" : "Failed to load achievement for editing")
        );
      } finally {
        setIsLoadingEditData(false);
      }
    };
    void fetchForEdit();
  }, [editId, locale]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const payload = await buildAchievementFormSubmitPayload(data);

      if (variant === "admin") {
        if (adminIdentity.inputMode === "linked" && !adminIdentity.linkedUserId.trim()) {
          throw new Error(
            isAr ? "يجب اختيار الطالب المسجل قبل الحفظ." : "Select a registered student before saving."
          );
        }
        if (adminIdentity.inputMode === "external") {
          const ar = adminIdentity.snapshotFullNameAr.trim();
          const en = adminIdentity.snapshotFullNameEn.trim();
          if (!ar && !en) {
            throw new Error(isAr ? "أدخل اسم الطالب بالعربية أو الإنجليزية." : "Enter student name in Arabic or English.");
          }
        }

        const basePayload = { ...payload } as Record<string, unknown>;
        delete basePayload.userId;
        delete basePayload.linkedUserId;

        const manualBody: Record<string, unknown> = {
          ...basePayload,
          inputMode: adminIdentity.inputMode,
          externalStudentKind: adminIdentity.externalStudentKind,
          snapshotFullNameAr: adminIdentity.snapshotFullNameAr.trim(),
          snapshotFullNameEn: adminIdentity.snapshotFullNameEn.trim(),
          snapshotGender: adminIdentity.snapshotGender,
          snapshotGrade: adminIdentity.snapshotGrade,
          snapshotSection: adminIdentity.snapshotSection,
          snapshotStudentStatus: adminIdentity.snapshotStudentStatus,
          adminStatus: adminIdentity.adminStatus,
          showInHallOfFame: adminIdentity.showInHallOfFame,
          showInPublicPortfolio: adminIdentity.showInPublicPortfolio,
          requiresCommitteeReview: payload.evidenceRequiredMode === "skipped",
        };

        if (adminIdentity.inputMode === "linked") {
          manualBody.linkedUserId = adminIdentity.linkedUserId.trim();
        }

        const response = await fetch("/api/admin/achievements/manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(manualBody),
        });
        const responseData = (await response.json()) as Record<string, unknown>;

        if (!response.ok) {
          if (responseData.errors) {
            const errorMessages = Array.isArray(responseData.errors)
              ? responseData.errors.join(", ")
              : Object.values(responseData.errors as Record<string, string>).join(", ");
            throw new Error(errorMessages);
          }
          throw new Error(String(responseData.error || "Failed to save achievement"));
        }

        setSuccess(true);
        setTimeout(() => {
          router.refresh();
          router.push("/admin/achievements/review");
        }, 1500);
        return;
      }

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
    } catch (err: unknown) {
      console.error("Error saving achievement:", err);
      setError(
        err instanceof Error
          ? err.message
          : locale === "ar"
            ? "حدث خطأ أثناء حفظ الإنجاز"
            : "Error saving achievement"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelHref = variant === "admin" ? "/admin/dashboard" : "/achievements";
  const isAdmin = variant === "admin";

  return (
    <PageContainer>
      <PageHeader
        title={
          isAdmin
            ? isAr
              ? "إضافة إنجاز (إداري)"
              : "Add achievement (admin)"
            : isEdit
              ? isAr
                ? "تعديل إنجاز"
                : "Edit Achievement"
              : isAr
                ? "إضافة إنجاز جديد"
                : "Add New Achievement"
        }
        subtitle={
          isAdmin
            ? isAr
              ? "نفس نموذج الطالب مع بيانات تعريف الطالب أعلاه."
              : "Same form as students, with student identity at the top."
            : isAr
              ? "شارك إنجازك مع المجتمع التعليمي"
              : "Share your achievement with the educational community"
        }
        actions={
          <Link
            href={cancelHref}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{isAr ? "إلغاء" : "Cancel"}</span>
          </Link>
        }
      />

      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
          <p className="font-medium">
            {isAdmin
              ? isAr
                ? "تم حفظ الإنجاز الإداري بنجاح!"
                : "Admin achievement saved successfully!"
              : isEdit
                ? isAr
                  ? "تم تحديث الإنجاز بنجاح!"
                  : "Achievement updated successfully!"
                : isAr
                  ? "تم إنشاء الإنجاز بنجاح!"
                  : "Achievement created successfully!"}
          </p>
          <p className="mt-1 text-sm">
            {isAr ? "جاري إعادة التوجيه..." : "Redirecting..."}
          </p>
        </div>
      )}

      {error && (
        <div
          ref={saveErrorRef}
          id="achievement-save-error"
          role="alert"
          aria-live="assertive"
          tabIndex={-1}
          className="mb-4 rounded-xl border-2 border-red-500 bg-red-50 p-4 text-red-900 shadow-sm outline-none ring-2 ring-red-200"
        >
          <p className="font-bold">
            {isAr ? "تعذّر حفظ الإنجاز" : "Could not save the achievement"}
          </p>
          <p className="mt-2 whitespace-pre-line text-sm font-medium">{error}</p>
        </div>
      )}

      {isLoadingEditData ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-text-light">
          {isAr ? "جاري تحميل بيانات الإنجاز..." : "Loading achievement data..."}
        </div>
      ) : (
        <div className="space-y-6">
          {isAdmin ? (
            <AdminAchievementIdentitySection isAr={isAr} state={adminIdentity} setState={setAdminIdentity} />
          ) : null}
          <AchievementForm
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            initialData={initialData || undefined}
            userRole="student"
          />
        </div>
      )}
    </PageContainer>
  );
};

export default AchievementFormPage;
