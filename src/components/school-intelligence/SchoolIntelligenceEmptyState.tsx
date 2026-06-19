import { BarChart3 } from "lucide-react";
import EmptyState from "@/components/layout/EmptyState";

type SchoolIntelligenceEmptyStateProps = {
  isAr: boolean;
  title?: string;
  description?: string;
};

const SchoolIntelligenceEmptyState = ({
  isAr,
  title,
  description,
}: SchoolIntelligenceEmptyStateProps) => (
  <EmptyState
    icon={BarChart3}
    title={title ?? (isAr ? "لا توجد بيانات كافية لهذا المؤشر حالياً" : "Not enough data for this indicator")}
    description={
      description ??
      (isAr
        ? "سيتم عرض النتائج بعد توفر بيانات كافية"
        : "Results will appear once sufficient data is available")
    }
    className="py-8"
  />
);

export default SchoolIntelligenceEmptyState;
