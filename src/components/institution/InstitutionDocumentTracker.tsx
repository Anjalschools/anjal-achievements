"use client";

type DocumentRow = {
  id: string;
  titleAr: string;
  titleEn: string;
  status: string;
};

const statusLabel = (status: string, isAr: boolean) => {
  const map: Record<string, { ar: string; en: string }> = {
    required: { ar: "مطلوب", en: "Required" },
    uploaded: { ar: "تم الرفع", en: "Uploaded" },
    under_review: { ar: "قيد المراجعة", en: "Under review" },
    accepted: { ar: "مقبول", en: "Accepted" },
    rejected: { ar: "مرفوض", en: "Rejected" },
  };
  return map[status]?.[isAr ? "ar" : "en"] || status;
};

const statusClass = (status: string) => {
  if (status === "accepted" || status === "uploaded") return "bg-emerald-50 text-emerald-900 border-emerald-200";
  if (status === "rejected") return "bg-red-50 text-red-900 border-red-200";
  if (status === "under_review") return "bg-amber-50 text-amber-900 border-amber-200";
  return "bg-gray-50 text-text border-border";
};

type InstitutionDocumentTrackerProps = {
  documents: DocumentRow[];
  isAr: boolean;
};

const InstitutionDocumentTracker = ({ documents, isAr }: InstitutionDocumentTrackerProps) => (
  <div className="space-y-2">
    {documents.length === 0 ? (
      <p className="text-xs text-text-light">{isAr ? "لا توجد مستندات." : "No documents tracked."}</p>
    ) : (
      documents.map((row) => (
        <div key={row.id} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm">
          <span className="font-semibold">{isAr ? row.titleAr : row.titleEn}</span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClass(row.status)}`}>
            {statusLabel(row.status, isAr)}
          </span>
        </div>
      ))
    )}
  </div>
);

export default InstitutionDocumentTracker;
