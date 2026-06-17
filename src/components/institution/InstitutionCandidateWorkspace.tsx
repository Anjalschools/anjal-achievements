"use client";

import { useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import {
  ClipboardList,
  FileText,
  MessageSquare,
  StickyNote,
  Tag,
  Users,
} from "lucide-react";

type WorkspaceTab = "documents" | "interviews" | "messages" | "tags" | "notes" | "evaluation" | "final";

type InstitutionCandidateWorkspaceProps = {
  isAr: boolean;
  documents: React.ReactNode;
  interviews: React.ReactNode;
  messagesLink: React.ReactNode;
  tags: React.ReactNode;
  notes: React.ReactNode;
  evaluation: React.ReactNode;
  finalReport?: React.ReactNode;
};

const InstitutionCandidateWorkspace = ({
  isAr,
  documents,
  interviews,
  messagesLink,
  tags,
  notes,
  evaluation,
  finalReport,
}: InstitutionCandidateWorkspaceProps) => {
  const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof FileText; content: React.ReactNode }> = [
    { id: "documents", label: isAr ? "المستندات" : "Documents", icon: FileText, content: documents },
    { id: "interviews", label: isAr ? "المقابلات" : "Interviews", icon: Users, content: interviews },
    { id: "messages", label: isAr ? "الرسائل" : "Messages", icon: MessageSquare, content: messagesLink },
    { id: "tags", label: isAr ? "الوسوم" : "Tags", icon: Tag, content: tags },
    { id: "notes", label: isAr ? "ملاحظات خاصة" : "Private notes", icon: StickyNote, content: notes },
    { id: "evaluation", label: isAr ? "التقييمات" : "Evaluations", icon: ClipboardList, content: evaluation },
    {
      id: "final",
      label: isAr ? "التقرير النهائي" : "Final report",
      icon: FileText,
      content:
        finalReport ||
        (isAr ? (
          <p className="text-sm text-text-light">التقرير النهائي غير متاح بعد.</p>
        ) : (
          <p className="text-sm text-text-light">Final report is not available yet.</p>
        )),
    },
  ];

  const [active, setActive] = useState<WorkspaceTab>("documents");
  const current = tabs.find((t) => t.id === active) || tabs[0];

  return (
    <SectionCard>
      <div className="mb-4 flex flex-wrap gap-2 border-b border-border/60 pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                selected ? "bg-primary text-white shadow-sm" : "bg-muted/50 text-text-light hover:bg-muted"
              }`}
              aria-current={selected ? "page" : undefined}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {tab.label}
            </button>
          );
        })}
      </div>
      <div>{current.content}</div>
    </SectionCard>
  );
};

export default InstitutionCandidateWorkspace;
