"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { getLocale } from "@/lib/i18n";
import { GRADE_OPTIONS } from "@/constants/grades";
import { ROLE_OPTIONS_FOR_FORM } from "@/lib/admin-users-ui-labels";
import { roleNeedsAcademicFields } from "@/lib/role-academic-fields";
import { roleSupportsStaffScopeStorage } from "@/lib/admin-staff-scope-normalize";
import AdminStaffScopeFields, {
  type AdminStaffScopeFormValue,
} from "@/components/admin/users/AdminStaffScopeFields";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

const emptyStaffScopeForm = (): AdminStaffScopeFormValue => ({
  genders: [],
  sections: [],
  grades: [],
});

const AdminUsersNewPage = () => {
  const router = useRouter();
  const locale = getLocale();
  const isAr = locale === "ar";
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullNameAr, setFullNameAr] = useState("");
  const [fullNameEn, setFullNameEn] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [studentId, setStudentId] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [role, setRole] = useState("student");
  const [status, setStatus] = useState<"active" | "inactive" | "suspended">("active");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [section, setSection] = useState<"arabic" | "international">("arabic");
  const [grade, setGrade] = useState("g12");
  const [isMawhibaStudent, setIsMawhibaStudent] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState<"ar" | "en">("ar");
  const [staffScopeForm, setStaffScopeForm] = useState<AdminStaffScopeFormValue>(emptyStaffScopeForm);

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
        setAllowed(r === "admin");
      } catch {
        setAllowed(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (roleNeedsAcademicFields(role)) return;
    setSection("arabic");
    setGrade("g12");
  }, [role]);

  useEffect(() => {
    if (!roleSupportsStaffScopeStorage(role)) setStaffScopeForm(emptyStaffScopeForm());
  }, [role]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setBusy(true);
      try {
        const academic = roleNeedsAcademicFields(role);
        const staffPayload =
          roleSupportsStaffScopeStorage(role) &&
          (staffScopeForm.genders.length > 0 ||
            staffScopeForm.sections.length > 0 ||
            staffScopeForm.grades.length > 0)
            ? {
                genders: staffScopeForm.genders,
                sections: staffScopeForm.sections,
                grades: staffScopeForm.grades,
              }
            : undefined;
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullNameAr,
            fullNameEn: fullNameEn.trim() || undefined,
            email,
            username,
            studentId,
            nationalId: nationalId.trim() || undefined,
            phone: phone.trim() || undefined,
            password,
            passwordConfirm,
            role,
            status,
            gender,
            ...(academic ? { section, grade, isMawhibaStudent } : {}),
            preferredLanguage,
            ...(staffPayload ? { staffScope: staffPayload } : {}),
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
        const id = (j.user as { id?: string })?.id;
        if (id) router.push(`/admin/users/${id}`);
        else router.push("/admin/users");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      } finally {
        setBusy(false);
      }
    },
    [
      fullNameAr,
      fullNameEn,
      email,
      username,
      studentId,
      nationalId,
      phone,
      password,
      passwordConfirm,
      role,
      status,
      gender,
      section,
      grade,
      isMawhibaStudent,
      preferredLanguage,
      staffScopeForm,
      router,
    ]
  );

  if (allowed === false) {
    return (
      <PageContainer>
        <p className="p-6 text-sm text-red-700">{isAr ? "غير مصرح." : "Forbidden."}</p>
      </PageContainer>
    );
  }

  if (allowed === null) {
    return (
      <PageContainer>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </PageContainer>
    );
  }

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
          {isAr ? "العودة لقائمة المستخدمين" : "Back to users"}
        </Link>
        <PageHeader
          title={isAr ? "إنشاء مستخدم" : "Create user"}
          subtitle={isAr ? "إضافة حساب جديد مع الصلاحية المناسبة" : "Add a new account with the correct role"}
        />

        {error ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "الاسم (عربي) *" : "Name (Arabic) *"}
              <input required className={inputCls} value={fullNameAr} onChange={(e) => setFullNameAr(e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "الاسم (إنجليزي)" : "Name (English)"}
              <input className={inputCls} value={fullNameEn} onChange={(e) => setFullNameEn(e.target.value)} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "البريد الإلكتروني *" : "Email *"}
              <input required type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "اسم المستخدم *" : "Username *"}
              <input required className={inputCls} value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "الرقم التعريفي (١٠ أرقام) *" : "ID (10 digits) *"}
              <input
                required
                inputMode="numeric"
                pattern="\d{10}"
                className={inputCls}
                value={studentId}
                onChange={(e) => setStudentId(e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
            </label>
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "رقم الهوية (١٠ أرقام)" : "National ID (10 digits)"}
              <input
                inputMode="numeric"
                className={inputCls}
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 10))}
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-text-light">
            {isAr ? "رقم الجوال (05xxxxxxxx)" : "Mobile (05xxxxxxxx)"}
            <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "الدور *" : "Role *"}
              <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLE_OPTIONS_FOR_FORM.map((o) => (
                  <option key={o.value} value={o.value}>
                    {isAr ? o.ar : o.en}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "الحالة *" : "Status *"}
              <select
                className={inputCls}
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                <option value="active">{isAr ? "نشط" : "Active"}</option>
                <option value="inactive">{isAr ? "غير نشط" : "Inactive"}</option>
                <option value="suspended">{isAr ? "موقوف" : "Suspended"}</option>
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "الجنس *" : "Gender *"}
              <select className={inputCls} value={gender} onChange={(e) => setGender(e.target.value as typeof gender)}>
                <option value="male">{isAr ? "ذكر" : "Male"}</option>
                <option value="female">{isAr ? "أنثى" : "Female"}</option>
              </select>
            </label>
            {roleNeedsAcademicFields(role) ? (
              <label className="text-xs font-semibold text-text-light">
                {isAr ? "القسم *" : "Section *"}
                <select
                  required
                  className={inputCls}
                  value={section}
                  onChange={(e) => setSection(e.target.value as typeof section)}
                >
                  <option value="arabic">{isAr ? "عربي" : "Arabic"}</option>
                  <option value="international">{isAr ? "دولي" : "International"}</option>
                </select>
              </label>
            ) : null}
          </div>
          {roleNeedsAcademicFields(role) ? (
            <label className="block text-xs font-semibold text-text-light">
              {isAr ? "الصف / المستوى *" : "Grade *"}
              <select required className={inputCls} value={grade} onChange={(e) => setGrade(e.target.value)}>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {isAr ? g.ar : g.en}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {roleNeedsAcademicFields(role) ? (
            <label className="block text-xs font-semibold text-text-light">
              {isAr ? "هل الطالب من فصول موهبة؟" : "Mawhiba (gifted) class student?"}
              <select
                className={inputCls}
                value={isMawhibaStudent ? "yes" : "no"}
                onChange={(e) => setIsMawhibaStudent(e.target.value === "yes")}
              >
                <option value="no">{isAr ? "لا" : "No"}</option>
                <option value="yes">{isAr ? "نعم" : "Yes"}</option>
              </select>
            </label>
          ) : null}
          {roleSupportsStaffScopeStorage(role) ? (
            <AdminStaffScopeFields
              isAr={isAr}
              value={staffScopeForm}
              onChange={setStaffScopeForm}
              disabled={busy}
            />
          ) : null}
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "كلمة المرور *" : "Password *"}
              <input
                required
                type="password"
                autoComplete="new-password"
                className={inputCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="text-xs font-semibold text-text-light">
              {isAr ? "تأكيد كلمة المرور *" : "Confirm password *"}
              <input
                required
                type="password"
                autoComplete="new-password"
                className={inputCls}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Link
              href="/admin/users"
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-text hover:bg-gray-50"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </Link>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isAr ? "إنشاء" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
};

export default AdminUsersNewPage;
