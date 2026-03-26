"use client";

import { useAppSession } from "@/contexts/AppSessionContext";
import PageContainer from "@/components/layout/PageContainer";
import StudentSettings from "@/components/settings/StudentSettings";
import AdminSettings from "@/components/settings/AdminSettings";
import { getLocale } from "@/lib/i18n";

export default function SettingsPage() {
  const { profile: user, loading } = useAppSession();
  const locale = getLocale();
  const isAr = locale === "ar";

  if (loading) {
    return (
      <PageContainer className="flex min-h-[40vh] items-center justify-center py-12">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent"
          role="status"
          aria-label={isAr ? "جاري التحميل" : "Loading"}
        />
      </PageContainer>
    );
  }

  if (!user?.role) {
    return (
      <PageContainer className="py-12 text-center text-sm text-text-light">
        {isAr ? "تعذر تحميل الجلسة. سجّل الدخول مجدداً." : "Session unavailable. Please sign in again."}
      </PageContainer>
    );
  }

  if (user.role === "student") {
    return <StudentSettings />;
  }

  /* admin, supervisor, schoolAdmin, judge, teacher, … — not the student form */
  return <AdminSettings />;
}
