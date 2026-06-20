import { AlertTriangle, BarChart3, History } from "lucide-react";
import EmptyState from "@/components/layout/EmptyState";
import type { SectionEmptyKind } from "@/lib/school-intelligence/school-intelligence-transparency-utils";

type SchoolIntelligenceEmptyStateProps = {
  isAr: boolean;
  kind?: SectionEmptyKind | null;
  title?: string;
  description?: string;
};

const EMPTY_COPY: Record<
  SectionEmptyKind,
  { titleAr: string; titleEn: string; descAr: string; descEn: string; icon: typeof BarChart3 }
> = {
  no_data: {
    titleAr: "لا توجد بيانات كافية لهذا المؤشر",
    titleEn: "Not enough data for this indicator",
    descAr: "سيتم عرض النتائج بعد توفر بيانات كافية",
    descEn: "Results will appear once sufficient data is available",
    icon: BarChart3,
  },
  failure: {
    titleAr: "فشل تحميل المؤشر",
    titleEn: "Indicator failed to load",
    descAr: "تحقق من سبب المشكلة الرئيسي أو أعد المحاولة",
    descEn: "Review the root cause panel or retry loading",
    icon: AlertTriangle,
  },
  snapshot: {
    titleAr: "تم عرض آخر نسخة ناجحة من البيانات",
    titleEn: "Showing last successful snapshot",
    descAr: "البيانات الحية غير متاحة حالياً — تم استخدام نسخة محفوظة",
    descEn: "Live data is unavailable — a saved snapshot is shown",
    icon: History,
  },
};

const SchoolIntelligenceEmptyState = ({
  isAr,
  kind = "no_data",
  title,
  description,
}: SchoolIntelligenceEmptyStateProps) => {
  const copy = EMPTY_COPY[kind ?? "no_data"];

  return (
    <EmptyState
      icon={copy.icon}
      title={title ?? (isAr ? copy.titleAr : copy.titleEn)}
      description={description ?? (isAr ? copy.descAr : copy.descEn)}
      className="py-8"
    />
  );
};

export default SchoolIntelligenceEmptyState;
