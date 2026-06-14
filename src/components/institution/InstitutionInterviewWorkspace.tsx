"use client";

import { useState } from "react";

type InterviewRow = {
  id: string;
  scheduledAt: string;
  status: string;
  location: string;
  meetingUrl: string;
  notes: string;
  recordingUrl?: string;
  attendance?: string;
  resultNotes?: string;
};

type InstitutionInterviewWorkspaceProps = {
  applicationId: string;
  interviews: InterviewRow[];
  isAr: boolean;
  onUpdated: () => void;
};

const InstitutionInterviewWorkspace = ({
  applicationId,
  interviews,
  isAr,
  onUpdated,
}: InstitutionInterviewWorkspaceProps) => {
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleUpdate = async (interviewId: string, payload: Record<string, unknown>) => {
    setSavingId(interviewId);
    try {
      const res = await fetch(`/api/institution/training/applications/${encodeURIComponent(applicationId)}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_interview_workspace", interviewId, ...payload }),
      });
      if (!res.ok) throw new Error("Failed");
      onUpdated();
    } finally {
      setSavingId(null);
    }
  };

  if (interviews.length === 0) {
    return <p className="text-xs text-text-light">{isAr ? "لا توجد مقابلات مجدولة." : "No scheduled interviews."}</p>;
  }

  return (
    <ul className="space-y-4">
      {interviews.map((row) => (
        <li key={row.id} className="rounded-xl border border-border/70 p-3 text-sm">
          <p className="font-bold text-foreground">
            {new Date(row.scheduledAt).toLocaleString(isAr ? "ar-SA" : "en-US")} — {row.status}
          </p>
          {row.meetingUrl ? (
            <a href={row.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
              {row.meetingUrl}
            </a>
          ) : null}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="text-xs">
              {isAr ? "الحضور" : "Attendance"}
              <select
                defaultValue={row.attendance || "pending"}
                onChange={(e) => void handleUpdate(row.id, { attendance: e.target.value })}
                disabled={savingId === row.id}
                className="mt-1 w-full rounded-lg border border-border px-2 py-1"
              >
                <option value="pending">{isAr ? "بانتظار" : "Pending"}</option>
                <option value="attended">{isAr ? "حضر" : "Attended"}</option>
                <option value="no_show">{isAr ? "لم يحضر" : "No show"}</option>
              </select>
            </label>
            <label className="text-xs">
              {isAr ? "رابط التسجيل" : "Recording URL"}
              <input
                defaultValue={row.recordingUrl || ""}
                onBlur={(e) => {
                  if (e.target.value !== (row.recordingUrl || "")) {
                    void handleUpdate(row.id, { recordingUrl: e.target.value });
                  }
                }}
                className="mt-1 w-full rounded-lg border border-border px-2 py-1"
              />
            </label>
          </div>
          <textarea
            defaultValue={row.resultNotes || row.notes || ""}
            placeholder={isAr ? "ملاحظات المقابلة ونتائجها" : "Interview notes and results"}
            onBlur={(e) => {
              const val = e.target.value;
              if (val !== (row.resultNotes || row.notes || "")) {
                void handleUpdate(row.id, { resultNotes: val, status: "completed" });
              }
            }}
            className="mt-2 min-h-16 w-full rounded-lg border border-border px-2 py-1 text-xs"
          />
        </li>
      ))}
    </ul>
  );
};

export default InstitutionInterviewWorkspace;
