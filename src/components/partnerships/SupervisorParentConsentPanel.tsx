"use client";

import { useCallback, useEffect, useState } from "react";
import InstitutionParentConsentPanel from "@/components/partnerships/InstitutionParentConsentPanel";

type RequirementRow = {
  id: string;
  requirementType: string;
  title: string;
  description: string;
  status: string;
  submittedAt: string | null;
  generatedTemplate?: import("@/lib/partnerships/parent-consent-template-constants").ParentConsentGeneratedTemplate | null;
  uploadedAttachment?: { fileName: string; storageKey: string } | null;
  aiVerification?: import("@/lib/partnerships/parent-consent-verification-constants").ParentConsentAiVerification | null;
};

type SupervisorParentConsentPanelProps = {
  applicationId: string;
  isAr: boolean;
};

const SupervisorParentConsentPanel = ({ applicationId, isAr }: SupervisorParentConsentPanelProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requirements, setRequirements] = useState<RequirementRow[]>([]);
  const [templateStaleForOpportunity, setTemplateStaleForOpportunity] = useState(false);

  const load = useCallback(async () => {
    if (!applicationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/partnerships/applications/${encodeURIComponent(applicationId)}/parent-consent`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRequirements([]);
        return;
      }
      const row = json.requirement as RequirementRow | null;
      setRequirements(row ? [row] : []);
      setTemplateStaleForOpportunity(Boolean(json.templateStaleForOpportunity));
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const postAction = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const action =
        body.action === "create_parent_consent"
          ? "create"
          : body.action === "regenerate_template"
            ? "regenerate_template"
            : "review";
      const payload =
        action === "create"
          ? { action: "create" }
          : action === "regenerate_template"
            ? { action: "regenerate_template" }
            : {
                action: "review",
                requirementId: body.requirementId,
                decision: body.decision,
                note: body.note,
              };
      const res = await fetch(`/api/admin/partnerships/applications/${encodeURIComponent(applicationId)}/parent-consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <InstitutionParentConsentPanel
      applicationId={applicationId}
      requirements={requirements}
      isAr={isAr}
      onUpdated={load}
      postAction={postAction}
      saving={saving}
      viewMode="supervisor"
      templateStaleForOpportunity={templateStaleForOpportunity}
    />
  );
};

export default SupervisorParentConsentPanel;
