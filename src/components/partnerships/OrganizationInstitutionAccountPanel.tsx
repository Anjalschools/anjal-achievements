"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, RefreshCw, Shield, UserPlus } from "lucide-react";

type InstitutionAccount = {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  username: string;
  status: string;
  lastLoginAt: string | null;
};

type OrganizationInstitutionAccountPanelProps = {
  organizationId: string;
  organizationName: string;
  isAr: boolean;
};

const OrganizationInstitutionAccountPanel = ({
  organizationId,
  organizationName,
  isAr,
}: OrganizationInstitutionAccountPanelProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<InstitutionAccount | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    fullName: organizationName,
    email: "",
    phone: "",
    tempPassword: "",
  });

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/partnerships/organizations/${encodeURIComponent(organizationId)}/institution-account`, {
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      setAccount((json.account as InstitutionAccount | null) || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const postAction = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    setTempPassword(null);
    try {
      const res = await fetch(`/api/admin/partnerships/organizations/${encodeURIComponent(organizationId)}/institution-account`, {
        method: payload.action === "create" || payload.action === "reset_password" || payload.action === "resend_credentials" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Failed");
      if (typeof json.tempPassword === "string") setTempPassword(json.tempPassword);
      setAccount((json.account as InstitutionAccount | null) || account);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  if (!organizationId) return null;

  return (
    <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50/40 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
        <Shield className="h-4 w-4 text-orange-700" aria-hidden />
        {isAr ? "إدارة حساب المؤسسة" : "Institution account management"}
      </h3>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-text-light">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {isAr ? "جاري التحميل…" : "Loading…"}
        </div>
      ) : (
        <>
          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
          {tempPassword ? (
            <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {isAr ? "كلمة المرور المؤقتة:" : "Temporary password:"} <strong>{tempPassword}</strong>
            </p>
          ) : null}

          {!account ? (
            <div className="space-y-3">
              <p className="text-sm text-text-light">
                {isAr ? "لا يوجد حساب مؤسسة لهذه الجهة." : "No institution account exists for this organization."}
              </p>
              <input
                value={createForm.fullName}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, fullName: e.target.value }))}
                placeholder={isAr ? "الاسم" : "Name"}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
              />
              <input
                value={createForm.email}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder={isAr ? "البريد الإلكتروني" : "Email"}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
              />
              <input
                value={createForm.phone}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder={isAr ? "رقم الجوال (05xxxxxxxx)" : "Mobile"}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
              />
              <input
                value={createForm.tempPassword}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, tempPassword: e.target.value }))}
                placeholder={isAr ? "كلمة مرور مؤقتة" : "Temporary password"}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={saving || !createForm.fullName.trim() || !createForm.email.trim() || createForm.tempPassword.length < 8}
                onClick={() =>
                  void postAction({
                    action: "create",
                    fullName: createForm.fullName.trim(),
                    email: createForm.email.trim(),
                    phone: createForm.phone.trim(),
                    tempPassword: createForm.tempPassword,
                  })
                }
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                <UserPlus className="h-4 w-4" aria-hidden />
                {isAr ? "إنشاء حساب المؤسسة" : "Create institution account"}
              </button>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-semibold">{account.fullName}</span> — {account.email}
              </p>
              <p className="text-text-light">
                {isAr ? "اسم المستخدم:" : "Username:"} {account.username}
                {account.phone ? ` · ${account.phone}` : ""}
              </p>
              <p className="text-text-light">
                {isAr ? "الحالة:" : "Status:"} {account.status}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void postAction({ status: account.status === "active" ? "suspended" : "active" })}
                  className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold"
                >
                  {account.status === "active" ? (isAr ? "إيقاف الحساب" : "Suspend") : isAr ? "تفعيل الحساب" : "Activate"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    const pwd = prompt(isAr ? "كلمة المرور المؤقتة الجديدة (8+)" : "New temporary password (8+)") || "";
                    if (pwd.length >= 8) void postAction({ action: "reset_password", tempPassword: pwd });
                  }}
                  className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold"
                >
                  <RefreshCw className="me-1 inline h-3.5 w-3.5" aria-hidden />
                  {isAr ? "إعادة تعيين كلمة المرور" : "Reset password"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    const pwd = prompt(isAr ? "كلمة مرور مؤقتة لإعادة الإرسال" : "Temporary password to resend") || "";
                    if (pwd.length >= 8) void postAction({ action: "resend_credentials", tempPassword: pwd });
                  }}
                  className="rounded-xl border border-border bg-white px-3 py-2 text-xs font-bold"
                >
                  <Mail className="me-1 inline h-3.5 w-3.5" aria-hidden />
                  {isAr ? "إعادة إرسال بيانات الدخول" : "Resend login details"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default OrganizationInstitutionAccountPanel;
