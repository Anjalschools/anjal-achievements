"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import type { AdminUserListRow } from "@/lib/admin-users-serialize";
import { GRADE_OPTIONS } from "@/constants/grades";
import { ROLE_OPTIONS_FOR_FORM } from "@/lib/admin-users-ui-labels";
import { AdminUserPasswordDialog } from "@/components/admin/users/AdminUserPasswordDialog";
import {
  adminRoleBadgeClass,
  adminRoleLabel,
  adminStatusBadgeClass,
  adminStatusLabel,
} from "@/lib/admin-users-ui-labels";
import { ArrowLeft, ArrowRight, Loader2, Trash2 } from "lucide-react";

const fmtDateTime = (iso: string | null, isAr: boolean) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(isAr ? "ar-SA" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
};

const AdminUserEditPage = () => {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const router = useRouter();
  const locale = getLocale();
  const isAr = locale === "ar";
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [meId, setMeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUserListRow | null>(null);

  const [fullNameAr, setFullNameAr] = useState("");
  const [fullNameEn, setFullNameEn] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("student");
  const [status, setStatus] = useState<"active" | "inactive" | "suspended">("active");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [section, setSection] = useState<"arabic" | "international">("arabic");
  const [grade, setGrade] = useState("g12");
  const [preferredLanguage, setPreferredLanguage] = useState<"ar" | "en">("ar");
  const [profilePhoto, setProfilePhoto] = useState("");

  const [pwOpen, setPwOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user/profile", { cache: "no-store" });
        if (!res.ok) {
          setAllowed(false);
          return;
        }
        const j = await res.json();
        const r = String(j.role || "");
        setAllowed(r === "admin" || r === "supervisor");
        setMeId(String(j.id || j._id || ""));
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { cache: "no-store" });
      if (res.status === 403) {
        setAllowed(false);
        return;
      }
      if (res.status === 404) {
        setUser(null);
        setError(isAr ? "المستخدم غير موجود" : "User not found");
        return;
      }
      const j = (await res.json()) as { user?: AdminUserListRow; error?: string };
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      const u = j.user!;
      setUser(u);
      setFullNameAr(u.fullNameAr || u.fullName || "");
      setFullNameEn(u.fullNameEn || "");
      setEmail(u.email);
      setUsername(u.username);
      setNationalId(u.nationalId || "");
      setPhone(u.phone || "");
      setRole(u.role);
      setStatus(u.status);
      setGender(u.gender);
      setSection(u.section);
      setGrade(u.grade);
      setProfilePhoto(u.profilePhoto || "");
      setPreferredLanguage(u.preferredLanguage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [id, isAr]);

  useEffect(() => {
    if (allowed !== true || !id) return;
    void load();
  }, [allowed, id, load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullNameAr,
          fullNameEn,
          email,
          username,
          nationalId: nationalId.trim() || null,
          phone: phone.trim() || null,
          role,
          status,
          gender,
          section,
          grade,
          preferredLanguage,
          profilePhoto: profilePhoto.trim() || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      setUser(j.user as AdminUserListRow);
      setToast(isAr ? "تم الحفظ" : "Saved");
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!id) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      router.push("/admin/users");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setDeleteBusy(false);
      setDeleteOpen(false);
    }
  };

  const isSelf = Boolean(meId && id === meId);

  if (allowed === false) {
    return (
      <PageContainer>
        <p className="p-6 text-sm text-red-700">{isAr ? "غير مصرح." : "Forbidden."}</p>
      </PageContainer>
    );
  }

  if (allowed === null || loading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-text-light" />
        </div>
      </PageContainer>
    );
  }

  if (!user && error) {
    return (
      <PageContainer>
        <p className="p-6 text-sm text-red-700">{error}</p>
        <Link href="/admin/users" className="text-primary hover:underline">
          {isAr ? "العودة" : "Back"}
        </Link>
      </PageContainer>
    );
  }

  if (!user) return null;

  const inputCls =
    "mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <PageContainer>
      <div className="mx-auto max-w-2xl space-y-6" dir={isAr ? "rtl" : "ltr"}>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          <BackIcon className="h-4 w-4" aria-hidden />
          {isAr ? "قائمة المستخدمين" : "Users list"}
        </Link>

        {toast ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
            {toast}
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
            {error}
          </div>
        ) : null}

        <PageHeader
          title={isAr ? "تعديل مستخدم" : "Edit user"}
          subtitle={username}
          actions={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPwOpen(true)}
                className="rounded-xl border border-primary/30 bg-white px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5"
              >
                {isAr ? "تغيير كلمة المرور" : "Change password"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                disabled={isSelf}
                className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                {isAr ? "حذف" : "Delete"}
              </button>
            </div>
          }
        />

        <section className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <p>
              <span className="font-semibold text-text-muted">{isAr ? "المعرّف: " : "ID: "}</span>
              <span className="font-mono text-xs">{user.id}</span>
            </p>
            <p>
              <span className="font-semibold text-text-muted">{isAr ? "رقم التسجيل: " : "Student ID: "}</span>
              {user.studentId}
            </p>
            <p>
              <span className="font-semibold text-text-muted">{isAr ? "تاريخ الإنشاء: " : "Created: "}</span>
              {fmtDateTime(user.createdAt, isAr)}
            </p>
            <p>
              <span className="font-semibold text-text-muted">{isAr ? "آخر دخول: " : "Last login: "}</span>
              {fmtDateTime(user.lastLoginAt, isAr)}
            </p>
            <p>
              <span className="font-semibold text-text-muted">{isAr ? "آخر تحديث: " : "Last update: "}</span>
              {fmtDateTime(user.updatedAt, isAr)}
            </p>
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-text-muted">{isAr ? "الدور الحالي: " : "Role: "}</span>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${adminRoleBadgeClass(user.role)}`}
              >
                {adminRoleLabel(user.role, isAr)}
              </span>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${adminStatusBadgeClass(user.status)}`}
              >
                {adminStatusLabel(user.status, isAr)}
              </span>
            </p>
          </div>
          {isSelf ? (
            <p className="mt-3 text-xs text-amber-800">
              {isAr ? "هذا حسابك — لا يمكنك حذفه أو إيقافه من هنا." : "This is your account — you cannot delete or suspend it here."}
            </p>
          ) : null}
        </section>

        <form onSubmit={handleSave} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "الاسم (عربي)" : "Name (Arabic)"}
              <input className={inputCls} value={fullNameAr} onChange={(e) => setFullNameAr(e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "الاسم (إنجليزي)" : "Name (English)"}
              <input className={inputCls} value={fullNameEn} onChange={(e) => setFullNameEn(e.target.value)} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "البريد" : "Email"}
              <input required type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "اسم المستخدم" : "Username"}
              <input required className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "رقم الهوية" : "National ID"}
              <input
                className={inputCls}
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
            </label>
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "الجوال" : "Phone"}
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
          </div>
          <label className="block text-xs font-semibold text-text-light">
            {isAr ? "رابط الصورة الشخصية (URL)" : "Profile photo URL"}
            <input className={inputCls} value={profilePhoto} onChange={(e) => setProfilePhoto(e.target.value)} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "الدور" : "Role"}
              <select
                className={inputCls}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={isSelf}
              >
                {ROLE_OPTIONS_FOR_FORM.map((o) => (
                  <option key={o.value} value={o.value}>
                    {isAr ? o.ar : o.en}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "الحالة" : "Status"}
              <select
                className={inputCls}
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                disabled={isSelf}
              >
                <option value="active">{isAr ? "نشط" : "Active"}</option>
                <option value="inactive">{isAr ? "غير نشط" : "Inactive"}</option>
                <option value="suspended">{isAr ? "موقوف" : "Suspended"}</option>
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "الجنس" : "Gender"}
              <select className={inputCls} value={gender} onChange={(e) => setGender(e.target.value as typeof gender)}>
                <option value="male">{isAr ? "ذكر" : "Male"}</option>
                <option value="female">{isAr ? "أنثى" : "Female"}</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "القسم" : "Section"}
              <select
                className={inputCls}
                value={section}
                onChange={(e) => setSection(e.target.value as typeof section)}
              >
                <option value="arabic">{isAr ? "عربي" : "Arabic"}</option>
                <option value="international">{isAr ? "دولي" : "International"}</option>
              </select>
            </label>
          </div>
          <label className="block text-xs font-semibold text-text-light">
            {isAr ? "الصف" : "Grade"}
            <select className={inputCls} value={grade} onChange={(e) => setGrade(e.target.value)}>
              {GRADE_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {isAr ? g.ar : g.en}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-text-light">
            {isAr ? "لغة الواجهة" : "UI language"}
            <select
              className={inputCls}
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value as typeof preferredLanguage)}
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </label>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isAr ? "حفظ التغييرات" : "Save changes"}
            </button>
          </div>
        </form>

        <AdminUserPasswordDialog
          open={pwOpen}
          userId={id}
          userLabel={`${username} — ${email}`}
          isAr={isAr}
          onClose={() => setPwOpen(false)}
          onSuccess={() => void load()}
        />

        {deleteOpen ? (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
            onClick={() => !deleteBusy && setDeleteOpen(false)}
          >
            <div
              className="max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold">{isAr ? "حذف المستخدم؟" : "Delete user?"}</h3>
              <p className="mt-2 text-sm text-text-light">{email}</p>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className="rounded-xl border px-4 py-2 text-sm" onClick={() => setDeleteOpen(false)}>
                  {isAr ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => void confirmDelete()}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {deleteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : isAr ? "حذف" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </PageContainer>
  );
};

export default AdminUserEditPage;
