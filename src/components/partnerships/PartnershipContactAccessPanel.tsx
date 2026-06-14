"use client";

import { useCallback, useEffect, useState } from "react";
import SectionCard from "@/components/layout/SectionCard";
import { Mail, Phone, Share2, Shield, User, XCircle } from "lucide-react";

type ContactAccessPayload = {
  studentContact: {
    studentPhone: string;
    parentPhone: string;
    studentEmail: string;
  };
  institutionContact: {
    contactName: string;
    contactPhone: string;
    contactEmail: string;
  };
  access: {
    id: string;
    isActive: boolean;
    shareStudentPhone: boolean;
    shareParentPhone: boolean;
    shareStudentEmail: boolean;
    shareInstitutionContact: boolean;
    grantedAt: string | null;
    notes: string;
  } | null;
};

type PartnershipContactAccessPanelProps = {
  applicationId: string;
  isAr: boolean;
};

const PartnershipContactAccessPanel = ({ applicationId, isAr }: PartnershipContactAccessPanelProps) => {
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [data, setData] = useState<ContactAccessPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareStudentPhone, setShareStudentPhone] = useState(true);
  const [shareParentPhone, setShareParentPhone] = useState(true);
  const [shareStudentEmail, setShareStudentEmail] = useState(true);
  const [shareInstitutionContact, setShareInstitutionContact] = useState(false);
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/partnerships/applications/${encodeURIComponent(applicationId)}/contact-access`,
        { cache: "no-store" }
      );
      if (res.status === 403) {
        setForbidden(true);
        setData(null);
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setForbidden(false);
      setData(json as ContactAccessPayload);
      if (json.access) {
        setShareStudentPhone(json.access.shareStudentPhone === true);
        setShareParentPhone(json.access.shareParentPhone === true);
        setShareStudentEmail(json.access.shareStudentEmail === true);
        setShareInstitutionContact(json.access.shareInstitutionContact === true);
        setNotes(json.access.notes || "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleShare = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/partnerships/applications/${encodeURIComponent(applicationId)}/contact-access`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: data?.access?.isActive ? "update" : "grant",
            shareStudentPhone,
            shareParentPhone,
            shareStudentEmail,
            shareInstitutionContact,
            notes: notes.trim() || undefined,
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setDialogOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async () => {
    if (!window.confirm(isAr ? "إلغاء مشاركة بيانات التواصل؟" : "Revoke contact sharing?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/partnerships/applications/${encodeURIComponent(applicationId)}/contact-access`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "revoke" }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  if (loading || forbidden || !data) return null;

  return (
    <SectionCard>
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-foreground">
        <Shield className="h-4 w-4 text-primary" aria-hidden />
        {isAr ? "بيانات التواصل" : "Contact information"}
      </h2>

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <dl className="mb-4 grid gap-3 sm:grid-cols-3 text-sm">
        <div className="flex items-start gap-2 rounded-xl border border-border bg-gray-50 px-3 py-2">
          <Phone className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
          <div>
            <dt className="text-xs font-bold text-text-light">{isAr ? "جوال الطالب" : "Student phone"}</dt>
            <dd className="font-semibold text-foreground">{data.studentContact.studentPhone || "—"}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-border bg-gray-50 px-3 py-2">
          <Phone className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
          <div>
            <dt className="text-xs font-bold text-text-light">{isAr ? "جوال ولي الأمر" : "Parent phone"}</dt>
            <dd className="font-semibold text-foreground">{data.studentContact.parentPhone || "—"}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-border bg-gray-50 px-3 py-2">
          <Mail className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
          <div>
            <dt className="text-xs font-bold text-text-light">{isAr ? "البريد الإلكتروني" : "Email"}</dt>
            <dd className="font-semibold text-foreground">{data.studentContact.studentEmail || "—"}</dd>
          </div>
        </div>
      </dl>

      {data.access?.isActive ? (
        <p className="mb-3 text-xs text-emerald-800">
          {isAr ? "مشاركة نشطة منذ" : "Active sharing since"}{" "}
          {data.access.grantedAt
            ? new Date(data.access.grantedAt).toLocaleString(isAr ? "ar-SA" : "en-US")
            : "—"}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-primary bg-primary px-4 py-2 text-sm font-bold text-white"
        >
          <Share2 className="h-4 w-4" aria-hidden />
          {isAr ? "مشاركة بيانات التواصل مع المؤسسة" : "Share contact with institution"}
        </button>
        {data.access?.isActive ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleRevoke()}
            className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-900 disabled:opacity-60"
          >
            <XCircle className="h-4 w-4" aria-hidden />
            {isAr ? "إلغاء المشاركة" : "Revoke sharing"}
          </button>
        ) : null}
      </div>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={isAr ? "مشاركة بيانات التواصل" : "Share contact data"}
            className="w-full max-w-md rounded-2xl border border-border bg-white p-5 shadow-xl"
          >
            <h3 className="mb-4 text-base font-bold text-foreground">
              {isAr ? "مشاركة بيانات التواصل" : "Share contact data"}
            </h3>
            <ul className="mb-4 space-y-2 text-sm">
              {[
                { key: "student", checked: shareStudentPhone, onChange: setShareStudentPhone, ar: "جوال الطالب", en: "Student phone" },
                { key: "parent", checked: shareParentPhone, onChange: setShareParentPhone, ar: "جوال ولي الأمر", en: "Parent phone" },
                { key: "email", checked: shareStudentEmail, onChange: setShareStudentEmail, ar: "البريد الإلكتروني", en: "Email" },
                { key: "inst", checked: shareInstitutionContact, onChange: setShareInstitutionContact, ar: "بيانات المؤسسة (للطالب)", en: "Institution contact (for student)" },
              ].map((row) => (
                <li key={row.key}>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={row.checked}
                      onChange={(e) => row.onChange(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary"
                    />
                    <span>{isAr ? row.ar : row.en}</span>
                  </label>
                </li>
              ))}
            </ul>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isAr ? "سبب المشاركة (اختياري)" : "Sharing reason (optional)"}
              className="mb-4 min-h-16 w-full rounded-xl border border-border px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-sm font-bold"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleShare()}
                className="rounded-xl border border-primary bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? (isAr ? "جاري الحفظ…" : "Saving…") : isAr ? "تأكيد المشاركة" : "Confirm share"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
};

export default PartnershipContactAccessPanel;
