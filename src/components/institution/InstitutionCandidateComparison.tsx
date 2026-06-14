"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { CANDIDATE_TAG_LABELS, type PredefinedCandidateTag } from "@/lib/partnerships/institution-candidate-pipeline-constants";

type CompareCandidate = {
  applicationId: string;
  studentName: string;
  studentGrade: string;
  scorecard: { overallScore: number; achievementCount: number; careerReadiness: number } | null;
  achievements: { totalCount: number; certificateCount: number };
  documents: Array<{ titleAr: string; titleEn: string; status: string }>;
  interviews: Array<{ scheduledAt: string; status: string }>;
  assessments: Array<{ title: string; status: string }>;
  tags: string[];
};

type InstitutionCandidateComparisonProps = {
  selectedIds: string[];
  isAr: boolean;
  onClose: () => void;
};

const tagLabel = (tag: string, isAr: boolean) => {
  const predefined = CANDIDATE_TAG_LABELS[tag as PredefinedCandidateTag];
  if (predefined) return isAr ? predefined.ar : predefined.en;
  return tag;
};

const InstitutionCandidateComparison = ({ selectedIds, isAr, onClose }: InstitutionCandidateComparisonProps) => {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<CompareCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/institution/candidates/compare?ids=${selectedIds.map(encodeURIComponent).join(",")}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
        setCandidates(Array.isArray(json.candidates) ? json.candidates : []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedIds]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">{isAr ? "مقارنة المرشحين" : "Compare candidates"}</h3>
          <button type="button" onClick={onClose} aria-label={isAr ? "إغلاق" : "Close"}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-text-light">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          </div>
        ) : error ? (
          <p className="text-red-600">{error}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-start">
                  <th className="px-3 py-2">{isAr ? "المعيار" : "Metric"}</th>
                  {candidates.map((c) => (
                    <th key={c.applicationId} className="px-3 py-2 font-bold">
                      {c.studentName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { key: "score", label: isAr ? "الدرجة" : "Score", get: (c: CompareCandidate) => c.scorecard?.overallScore ?? "—" },
                  { key: "ach", label: isAr ? "الإنجازات" : "Achievements", get: (c: CompareCandidate) => c.achievements.totalCount },
                  { key: "cert", label: isAr ? "الشهادات" : "Certificates", get: (c: CompareCandidate) => c.achievements.certificateCount },
                  { key: "ready", label: isAr ? "الجاهزية" : "Readiness", get: (c: CompareCandidate) => `${c.scorecard?.careerReadiness ?? 0}%` },
                  { key: "docs", label: isAr ? "المستندات" : "Documents", get: (c: CompareCandidate) => c.documents.filter((d) => d.status !== "required").length },
                  { key: "int", label: isAr ? "المقابلات" : "Interviews", get: (c: CompareCandidate) => c.interviews.length },
                  { key: "tags", label: isAr ? "الوسوم" : "Tags", get: (c: CompareCandidate) => c.tags.map((t) => tagLabel(t, isAr)).join(", ") || "—" },
                ].map((row) => (
                  <tr key={row.key} className="border-b border-border/50">
                    <td className="px-3 py-2 font-semibold text-text-light">{row.label}</td>
                    {candidates.map((c) => (
                      <td key={`${row.key}-${c.applicationId}`} className="px-3 py-2">
                        {row.get(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstitutionCandidateComparison;
