import { History } from "lucide-react";

type SchoolIntelligenceSnapshotIndicatorProps = {
  isAr: boolean;
  snapshotUsed: boolean;
  snapshotTimestamp: string | null;
};

const formatTimestamp = (value: string | null, isAr: boolean) => {
  if (!value) return isAr ? "غير معروف" : "Unknown";
  try {
    return new Date(value).toLocaleString(isAr ? "ar-SA" : "en-US");
  } catch {
    return value;
  }
};

const SchoolIntelligenceSnapshotIndicator = ({
  isAr,
  snapshotUsed,
  snapshotTimestamp,
}: SchoolIntelligenceSnapshotIndicatorProps) => {
  if (!snapshotUsed) return null;

  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-950">
      <History className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">تم عرض آخر نسخة ناجحة من البيانات</p>
        <p className="mt-1 text-xs opacity-80">
          {isAr ? "وقت النسخة المحفوظة:" : "Snapshot captured at:"}{" "}
          {formatTimestamp(snapshotTimestamp, isAr)}
        </p>
      </div>
    </div>
  );
};

export default SchoolIntelligenceSnapshotIndicator;
