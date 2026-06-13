"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { GRADE_OPTIONS } from "@/constants/grades";
import { getLocale } from "@/lib/i18n";
import { Building2, Briefcase, BarChart3, Link2, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import OrganizationInstitutionAccountPanel from "@/components/partnerships/OrganizationInstitutionAccountPanel";
import {
  PARTNER_ORGANIZATION_CATEGORIES,
  PARTNER_ORGANIZATION_CATEGORY_LABELS,
} from "@/lib/partnerships/institution-analytics-constants";

type OrganizationRow = {
  id: string;
  name: string;
  logo: string;
  sector: string;
  city: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  category: string;
  subCategory: string;
  averageRating: number;
  ratingCount: number;
  institutionUserEmails: string;
  active: boolean;
};

type OpportunityRow = {
  id: string;
  title: string;
  description: string;
  organizationId: string;
  targetGender: string;
  targetStages: string[];
  targetGrades: string[];
  seats: number;
  registrationStart: string | null;
  registrationEnd: string | null;
  trainingStart: string | null;
  trainingEnd: string | null;
  visible: boolean;
  active: boolean;
  organization?: { name: string };
};

type TabId = "organizations" | "opportunities";

const emptyOrganization = (): OrganizationRow => ({
  id: "",
  name: "",
  logo: "",
  sector: "",
  city: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  notes: "",
  category: "",
  subCategory: "",
  averageRating: 0,
  ratingCount: 0,
  institutionUserEmails: "",
  active: true,
});

const emptyOpportunity = (): OpportunityRow => ({
  id: "",
  title: "",
  description: "",
  organizationId: "",
  targetGender: "both",
  targetStages: [],
  targetGrades: [],
  seats: 0,
  registrationStart: null,
  registrationEnd: null,
  trainingStart: null,
  trainingEnd: null,
  visible: false,
  active: true,
});

const toInputDate = (value: string | null) => (value ? value.slice(0, 10) : "");

const PartnershipsAdminPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [activeTab, setActiveTab] = useState<TabId>("organizations");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [orgForm, setOrgForm] = useState<OrganizationRow>(emptyOrganization);
  const [oppForm, setOppForm] = useState<OpportunityRow>(emptyOpportunity);
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [editingOppId, setEditingOppId] = useState<string | null>(null);
  const [accessLinkByOrg, setAccessLinkByOrg] = useState<Record<string, string>>({});
  const [generatingAccessFor, setGeneratingAccessFor] = useState<string | null>(null);

  const stageOptions = useMemo(
    () => [
      { value: "elementary", label: isAr ? "ابتدائي" : "Elementary" },
      { value: "middle", label: isAr ? "متوسط" : "Middle" },
      { value: "high", label: isAr ? "ثانوي" : "High" },
    ],
    [isAr]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [orgRes, oppRes] = await Promise.all([
        fetch("/api/partnerships/organizations", { cache: "no-store" }),
        fetch("/api/partnerships/opportunities", { cache: "no-store" }),
      ]);
      const orgJson = await orgRes.json().catch(() => ({}));
      const oppJson = await oppRes.json().catch(() => ({}));
      if (!orgRes.ok || !oppRes.ok) {
        throw new Error(
          typeof orgJson.error === "string"
            ? orgJson.error
            : typeof oppJson.error === "string"
              ? oppJson.error
              : "Failed"
        );
      }
      setOrganizations(Array.isArray(orgJson.items) ? orgJson.items : []);
      setOpportunities(Array.isArray(oppJson.items) ? oppJson.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setOrganizations([]);
      setOpportunities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResetOrgForm = () => {
    setOrgForm(emptyOrganization());
    setEditingOrgId(null);
  };

  const handleResetOppForm = () => {
    setOppForm(emptyOpportunity());
    setEditingOppId(null);
  };

  const handleSaveOrganization = async () => {
    if (!orgForm.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const method = editingOrgId ? "PATCH" : "POST";
      const res = await fetch("/api/partnerships/organizations", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingOrgId
            ? { ...orgForm, id: editingOrgId, institutionUserEmails: orgForm.institutionUserEmails }
            : { ...orgForm, institutionUserEmails: orgForm.institutionUserEmails }
        ),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      handleResetOrgForm();
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePartnerAccess = async (organizationId: string) => {
    setGeneratingAccessFor(organizationId);
    setError(null);
    try {
      const res = await fetch("/api/admin/partnerships/partner-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, expiresInDays: 30 }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      const path = typeof json.item?.accessPath === "string" ? json.item.accessPath : "";
      if (path) {
        const fullUrl = `${window.location.origin}${path}`;
        setAccessLinkByOrg((prev) => ({ ...prev, [organizationId]: fullUrl }));
        try {
          await navigator.clipboard.writeText(fullUrl);
        } catch {
          /* clipboard optional */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setGeneratingAccessFor(null);
    }
  };

  const handleDeleteOrganization = async (id: string) => {
    if (!window.confirm(isAr ? "حذف هذه المؤسسة؟" : "Delete this organization?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/partnerships/organizations?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      if (editingOrgId === id) handleResetOrgForm();
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOpportunity = async () => {
    if (!oppForm.title.trim() || !oppForm.organizationId) return;
    setSaving(true);
    setError(null);
    try {
      const method = editingOppId ? "PATCH" : "POST";
      const res = await fetch("/api/partnerships/opportunities", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingOppId ? { ...oppForm, id: editingOppId } : oppForm),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      handleResetOppForm();
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOpportunity = async (id: string) => {
    if (!window.confirm(isAr ? "حذف هذه الفرصة؟" : "Delete this opportunity?")) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/partnerships/opportunities?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      if (editingOppId === id) handleResetOppForm();
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const toggleArrayValue = (values: string[], value: string) =>
    values.includes(value) ? values.filter((v) => v !== value) : [...values, value];

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "التدريب الصيفي والشراكات" : "Summer training & partnerships"}
        subtitle={
          isAr
            ? "إدارة المؤسسات الشريكة وفرص التدريب الصيفي."
            : "Manage partner organizations and summer training opportunities."
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/admin/partnerships/applications"
          className="inline-flex rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-muted"
        >
          {isAr ? "عرض طلبات التدريب" : "View training applications"}
        </Link>
        <Link
          href="/admin/partnerships/messages"
          className="inline-flex rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-muted"
        >
          {isAr ? "مركز الرسائل" : "Message center"}
        </Link>
        <Link
          href="/admin/partnerships/final-reports"
          className="inline-flex rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-muted"
        >
          {isAr ? "تقارير التدريب" : "Training reports"}
        </Link>
        <Link
          href="/admin/partnerships/training-achievements"
          className="inline-flex rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-muted"
        >
          {isAr ? "إنجازات التدريب" : "Training achievements"}
        </Link>
        <Link
          href="/admin/partnerships/settings"
          className="inline-flex rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-muted"
        >
          {isAr ? "إعدادات البرنامج" : "Program settings"}
        </Link>
        <Link
          href="/admin/partnerships/audit"
          className="inline-flex rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-primary transition hover:bg-muted"
        >
          {isAr ? "مستكشف التدقيق" : "Audit explorer"}
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("organizations")}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "organizations" ? "bg-primary text-white" : "bg-muted text-foreground"
          }`}
          aria-pressed={activeTab === "organizations"}
        >
          <span className="inline-flex items-center gap-2">
            <Building2 className="h-4 w-4" aria-hidden />
            {isAr ? "المؤسسات" : "Organizations"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("opportunities")}
          className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "opportunities" ? "bg-primary text-white" : "bg-muted text-foreground"
          }`}
          aria-pressed={activeTab === "opportunities"}
        >
          <span className="inline-flex items-center gap-2">
            <Briefcase className="h-4 w-4" aria-hidden />
            {isAr ? "الفرص التدريبية" : "Opportunities"}
          </span>
        </button>
      </div>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {activeTab === "organizations" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard>
            <h2 className="mb-4 text-base font-bold text-foreground">
              {editingOrgId
                ? isAr
                  ? "تعديل مؤسسة"
                  : "Edit organization"
                : isAr
                  ? "إضافة مؤسسة"
                  : "Add organization"}
            </h2>
            <div className="space-y-3">
              <input
                value={orgForm.name}
                onChange={(e) => setOrgForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={isAr ? "اسم المؤسسة" : "Organization name"}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                aria-label={isAr ? "اسم المؤسسة" : "Organization name"}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={orgForm.sector}
                  onChange={(e) => setOrgForm((prev) => ({ ...prev, sector: e.target.value }))}
                  placeholder={isAr ? "القطاع" : "Sector"}
                  className="rounded-xl border border-border px-3 py-2 text-sm"
                  aria-label={isAr ? "القطاع" : "Sector"}
                />
                <input
                  value={orgForm.city}
                  onChange={(e) => setOrgForm((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder={isAr ? "المدينة" : "City"}
                  className="rounded-xl border border-border px-3 py-2 text-sm"
                  aria-label={isAr ? "المدينة" : "City"}
                />
              </div>
              <input
                value={orgForm.contactName}
                onChange={(e) => setOrgForm((prev) => ({ ...prev, contactName: e.target.value }))}
                placeholder={isAr ? "اسم جهة الاتصال" : "Contact name"}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                aria-label={isAr ? "اسم جهة الاتصال" : "Contact name"}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={orgForm.contactEmail}
                  onChange={(e) => setOrgForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
                  placeholder={isAr ? "البريد الإلكتروني" : "Email"}
                  className="rounded-xl border border-border px-3 py-2 text-sm"
                  aria-label={isAr ? "البريد الإلكتروني" : "Email"}
                />
                <input
                  value={orgForm.contactPhone}
                  onChange={(e) => setOrgForm((prev) => ({ ...prev, contactPhone: e.target.value }))}
                  placeholder={isAr ? "الهاتف" : "Phone"}
                  className="rounded-xl border border-border px-3 py-2 text-sm"
                  aria-label={isAr ? "الهاتف" : "Phone"}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={orgForm.category}
                  onChange={(e) => setOrgForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="rounded-xl border border-border px-3 py-2 text-sm"
                  aria-label={isAr ? "فئة المؤسسة" : "Organization category"}
                >
                  <option value="">{isAr ? "فئة المؤسسة (اختياري)" : "Category (optional)"}</option>
                  {PARTNER_ORGANIZATION_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {PARTNER_ORGANIZATION_CATEGORY_LABELS[cat][isAr ? "ar" : "en"]}
                    </option>
                  ))}
                </select>
                <input
                  value={orgForm.subCategory}
                  onChange={(e) => setOrgForm((prev) => ({ ...prev, subCategory: e.target.value }))}
                  placeholder={isAr ? "التصنيف الفرعي (اختياري)" : "Sub-category (optional)"}
                  className="rounded-xl border border-border px-3 py-2 text-sm"
                  aria-label={isAr ? "التصنيف الفرعي" : "Sub-category"}
                />
              </div>
              <textarea
                value={orgForm.notes}
                onChange={(e) => setOrgForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder={isAr ? "ملاحظات" : "Notes"}
                className="min-h-24 w-full rounded-xl border border-border px-3 py-2 text-sm"
                aria-label={isAr ? "ملاحظات" : "Notes"}
              />
              {editingOrgId ? (
                <OrganizationInstitutionAccountPanel
                  organizationId={editingOrgId}
                  organizationName={orgForm.name}
                  isAr={isAr}
                />
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={orgForm.active}
                  onChange={(e) => setOrgForm((prev) => ({ ...prev, active: e.target.checked }))}
                />
                {isAr ? "نشطة" : "Active"}
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveOrganization}
                  disabled={saving || !orgForm.name.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                  {editingOrgId ? (isAr ? "حفظ التعديل" : "Save changes") : isAr ? "إضافة" : "Add"}
                </button>
                {editingOrgId ? (
                  <button
                    type="button"
                    onClick={handleResetOrgForm}
                    className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
                  >
                    {isAr ? "إلغاء" : "Cancel"}
                  </button>
                ) : null}
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <h2 className="mb-4 text-base font-bold text-foreground">
              {isAr ? "قائمة المؤسسات" : "Organizations list"}
            </h2>
            {loading ? (
              <p className="py-8 text-center text-text-light">{isAr ? "جاري التحميل…" : "Loading…"}</p>
            ) : organizations.length === 0 ? (
              <p className="py-8 text-center text-text-light">{isAr ? "لا توجد مؤسسات." : "No organizations yet."}</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {organizations.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-3 py-3">
                    <div>
                      <p className="font-bold text-foreground">{row.name}</p>
                      <p className="text-sm text-text-light">
                        {[row.sector, row.city].filter(Boolean).join(" · ") || (isAr ? "—" : "—")}
                      </p>
                      {row.category ? (
                        <p className="text-xs text-text-light">
                          {PARTNER_ORGANIZATION_CATEGORY_LABELS[
                            row.category as keyof typeof PARTNER_ORGANIZATION_CATEGORY_LABELS
                          ]?.[isAr ? "ar" : "en"] || row.category}
                          {row.subCategory ? ` · ${row.subCategory}` : ""}
                        </p>
                      ) : null}
                      {row.ratingCount > 0 ? (
                        <p className="text-xs text-amber-700">
                          {isAr ? "التقييم:" : "Rating:"} {row.averageRating}/5 ({row.ratingCount})
                        </p>
                      ) : null}
                      <p className="text-xs text-text-light">
                        {row.active ? (isAr ? "نشطة" : "Active") : isAr ? "غير نشطة" : "Inactive"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/partnerships/organizations/${row.id}`}
                        className="rounded-lg border border-primary/30 p-2 text-primary"
                        aria-label={isAr ? "إحصائيات المؤسسة" : "Organization analytics"}
                        title={isAr ? "إحصائيات المؤسسة" : "Organization analytics"}
                      >
                        <BarChart3 className="h-4 w-4" aria-hidden />
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleGeneratePartnerAccess(row.id)}
                        disabled={generatingAccessFor === row.id}
                        className="rounded-lg border border-primary/30 p-2 text-primary disabled:opacity-60"
                        aria-label={isAr ? "رابط بوابة المؤسسة" : "Partner access link"}
                        title={isAr ? "إنشاء رابط بوابة المؤسسة" : "Create partner access link"}
                      >
                        {generatingAccessFor === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Link2 className="h-4 w-4" aria-hidden />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOrgForm(row);
                          setEditingOrgId(row.id);
                        }}
                        className="rounded-lg border border-border p-2"
                        aria-label={isAr ? "تعديل" : "Edit"}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteOrganization(row.id)}
                        className="rounded-lg border border-red-200 p-2 text-red-600"
                        aria-label={isAr ? "حذف" : "Delete"}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    {accessLinkByOrg[row.id] ? (
                      <a
                        href={accessLinkByOrg[row.id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-[220px] truncate text-[10px] text-primary underline"
                      >
                        {accessLinkByOrg[row.id]}
                      </a>
                    ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard>
            <h2 className="mb-4 text-base font-bold text-foreground">
              {editingOppId ? (isAr ? "تعديل فرصة" : "Edit opportunity") : isAr ? "إضافة فرصة" : "Add opportunity"}
            </h2>
            <div className="space-y-3">
              <input
                value={oppForm.title}
                onChange={(e) => setOppForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder={isAr ? "عنوان الفرصة" : "Opportunity title"}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                aria-label={isAr ? "عنوان الفرصة" : "Opportunity title"}
              />
              <select
                value={oppForm.organizationId}
                onChange={(e) => setOppForm((prev) => ({ ...prev, organizationId: e.target.value }))}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                aria-label={isAr ? "المؤسسة" : "Organization"}
              >
                <option value="">{isAr ? "اختر المؤسسة" : "Select organization"}</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              <textarea
                value={oppForm.description}
                onChange={(e) => setOppForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={isAr ? "الوصف" : "Description"}
                className="min-h-24 w-full rounded-xl border border-border px-3 py-2 text-sm"
                aria-label={isAr ? "الوصف" : "Description"}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={oppForm.targetGender}
                  onChange={(e) => setOppForm((prev) => ({ ...prev, targetGender: e.target.value }))}
                  className="rounded-xl border border-border px-3 py-2 text-sm"
                  aria-label={isAr ? "الجنس المستهدف" : "Target gender"}
                >
                  <option value="both">{isAr ? "الجميع" : "All"}</option>
                  <option value="male">{isAr ? "بنين" : "Male"}</option>
                  <option value="female">{isAr ? "بنات" : "Female"}</option>
                </select>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-text-light">
                    {isAr ? "عدد الطلاب المطلوب" : "Required students count"}
                  </label>
                <input
                  type="number"
                  min={0}
                  value={oppForm.seats || ""}
                  onChange={(e) => setOppForm((prev) => ({ ...prev, seats: Number(e.target.value) || 0 }))}
                  placeholder={isAr ? "مثال: 20" : "e.g. 20"}
                  className="rounded-xl border border-border px-3 py-2 text-sm"
                  aria-label={isAr ? "عدد الطلاب المطلوب" : "Required students count"}
                />
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">{isAr ? "المراحل المستهدفة" : "Target stages"}</p>
                <div className="flex flex-wrap gap-2">
                  {stageOptions.map((stage) => (
                    <label key={stage.value} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs">
                      <input
                        type="checkbox"
                        checked={oppForm.targetStages.includes(stage.value)}
                        onChange={() =>
                          setOppForm((prev) => ({
                            ...prev,
                            targetStages: toggleArrayValue(prev.targetStages, stage.value),
                          }))
                        }
                      />
                      {stage.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">{isAr ? "الصفوف المستهدفة" : "Target grades"}</p>
                <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                  {GRADE_OPTIONS.map((grade) => (
                    <label key={grade.value} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs">
                      <input
                        type="checkbox"
                        checked={oppForm.targetGrades.includes(grade.value)}
                        onChange={() =>
                          setOppForm((prev) => ({
                            ...prev,
                            targetGrades: toggleArrayValue(prev.targetGrades, grade.value),
                          }))
                        }
                      />
                      {isAr ? grade.ar : grade.en}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-bold text-foreground">
                  {isAr ? "فترة التسجيل" : "Registration period"}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-text-light">
                      {isAr ? "تاريخ بدء التسجيل" : "Registration start"}
                    </label>
                    <input
                      type="date"
                      value={toInputDate(oppForm.registrationStart)}
                      onChange={(e) =>
                        setOppForm((prev) => ({
                          ...prev,
                          registrationStart: e.target.value ? new Date(e.target.value).toISOString() : null,
                        }))
                      }
                      className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                      aria-label={isAr ? "تاريخ بدء التسجيل" : "Registration start"}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-text-light">
                      {isAr ? "تاريخ انتهاء التسجيل" : "Registration end"}
                    </label>
                    <input
                      type="date"
                      value={toInputDate(oppForm.registrationEnd)}
                      onChange={(e) =>
                        setOppForm((prev) => ({
                          ...prev,
                          registrationEnd: e.target.value ? new Date(e.target.value).toISOString() : null,
                        }))
                      }
                      className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                      aria-label={isAr ? "تاريخ انتهاء التسجيل" : "Registration end"}
                    />
                  </div>
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-bold text-foreground">
                  {isAr ? "فترة البرنامج التدريبي" : "Training program period"}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-text-light">
                      {isAr ? "تاريخ بدء التدريب" : "Training start"}
                    </label>
                    <input
                      type="date"
                      value={toInputDate(oppForm.trainingStart)}
                      onChange={(e) =>
                        setOppForm((prev) => ({
                          ...prev,
                          trainingStart: e.target.value ? new Date(e.target.value).toISOString() : null,
                        }))
                      }
                      className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                      aria-label={isAr ? "تاريخ بدء التدريب" : "Training start"}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-text-light">
                      {isAr ? "تاريخ انتهاء التدريب" : "Training end"}
                    </label>
                    <input
                      type="date"
                      value={toInputDate(oppForm.trainingEnd)}
                      onChange={(e) =>
                        setOppForm((prev) => ({
                          ...prev,
                          trainingEnd: e.target.value ? new Date(e.target.value).toISOString() : null,
                        }))
                      }
                      className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                      aria-label={isAr ? "تاريخ انتهاء التدريب" : "Training end"}
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={oppForm.visible}
                    onChange={(e) => setOppForm((prev) => ({ ...prev, visible: e.target.checked }))}
                  />
                  {isAr ? "ظاهرة للطلاب" : "Visible to students"}
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={oppForm.active}
                    onChange={(e) => setOppForm((prev) => ({ ...prev, active: e.target.checked }))}
                  />
                  {isAr ? "نشطة" : "Active"}
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveOpportunity}
                  disabled={saving || !oppForm.title.trim() || !oppForm.organizationId}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                  {editingOppId ? (isAr ? "حفظ التعديل" : "Save changes") : isAr ? "إضافة" : "Add"}
                </button>
                {editingOppId ? (
                  <button
                    type="button"
                    onClick={handleResetOppForm}
                    className="rounded-xl border border-border px-4 py-2 text-sm font-semibold"
                  >
                    {isAr ? "إلغاء" : "Cancel"}
                  </button>
                ) : null}
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <h2 className="mb-4 text-base font-bold text-foreground">
              {isAr ? "قائمة الفرص" : "Opportunities list"}
            </h2>
            {loading ? (
              <p className="py-8 text-center text-text-light">{isAr ? "جاري التحميل…" : "Loading…"}</p>
            ) : opportunities.length === 0 ? (
              <p className="py-8 text-center text-text-light">{isAr ? "لا توجد فرص." : "No opportunities yet."}</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {opportunities.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-3 py-3">
                    <div>
                      <p className="font-bold text-foreground">{row.title}</p>
                      <p className="text-sm text-text-light">{row.organization?.name || "—"}</p>
                      <p className="text-xs text-text-light">
                        {row.visible ? (isAr ? "ظاهرة" : "Visible") : isAr ? "مخفية" : "Hidden"} ·{" "}
                        {row.active ? (isAr ? "نشطة" : "Active") : isAr ? "غير نشطة" : "Inactive"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setOppForm(row);
                          setEditingOppId(row.id);
                        }}
                        className="rounded-lg border border-border p-2"
                        aria-label={isAr ? "تعديل" : "Edit"}
                      >
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteOpportunity(row.id)}
                        className="rounded-lg border border-red-200 p-2 text-red-600"
                        aria-label={isAr ? "حذف" : "Delete"}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      )}
    </PageContainer>
  );
};

export default PartnershipsAdminPage;
