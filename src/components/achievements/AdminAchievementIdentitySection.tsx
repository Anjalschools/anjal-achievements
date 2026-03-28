"use client";

import { GRADE_OPTIONS } from "@/constants/grades";
import { getGradeLabel } from "@/lib/achievement-display-labels";
import SectionCard from "@/components/layout/SectionCard";

export type AdminIdentitySearchHit = {
  id: string;
  fullName: string;
  grade: string;
  studentId: string;
};

export type AdminAchievementIdentityState = {
  inputMode: "linked" | "external";
  q: string;
  hits: AdminIdentitySearchHit[];
  linkedUserId: string;
  linkedLabel: string;
  snapshotFullNameAr: string;
  snapshotFullNameEn: string;
  snapshotGender: "male" | "female";
  snapshotGrade: string;
  snapshotSection: "arabic" | "international";
  externalStudentKind: "external_student" | "alumni_student";
  snapshotStudentStatus: "current" | "external" | "alumni";
  adminStatus: "pending_review" | "approved" | "featured" | "needs_revision" | "rejected";
  /** Default on: included in public portfolio when approved unless admin opts out. */
  showInPublicPortfolio: boolean;
  showInHallOfFame: boolean;
};

type Props = {
  isAr: boolean;
  state: AdminAchievementIdentityState;
  setState: React.Dispatch<React.SetStateAction<AdminAchievementIdentityState>>;
};

const AdminAchievementIdentitySection = ({ isAr, state, setState }: Props) => {
  const patch = (p: Partial<AdminAchievementIdentityState>) =>
    setState((s) => ({ ...s, ...p }));

  return (
    <SectionCard>
      <div className="mb-4 border-b border-gray-100 pb-4">
        <h2 className="text-lg font-bold text-text">{isAr ? "بيانات الطالب" : "Student"}</h2>
        <p className="mt-1 text-sm text-text-light">
          {isAr
            ? "ربط بطالب مسجّل في المنصة، أو إدخال بيانات طالب غير مسجّل (خارجي / خريج)."
            : "Link a registered student or enter an unregistered / external / alumni student."}
        </p>
      </div>
      <div className="flex flex-wrap gap-4 border-b border-gray-100 pb-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-text">
          <input
            type="radio"
            name="admin-ach-input-mode"
            checked={state.inputMode === "linked"}
            onChange={() => patch({ inputMode: "linked" })}
          />
          {isAr ? "طالب مسجّل" : "Registered student"}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-text">
          <input
            type="radio"
            name="admin-ach-input-mode"
            checked={state.inputMode === "external"}
            onChange={() => patch({ inputMode: "external" })}
          />
          {isAr ? "غير مسجّل (خارجي / خريج)" : "Unregistered (external / alumni)"}
        </label>
      </div>

      {state.inputMode === "linked" ? (
        <div className="mt-4 space-y-2">
          <label className="block text-xs font-bold text-text-light">
            {isAr ? "بحث عن الطالب" : "Search student"}
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
              value={state.q}
              onChange={(e) => patch({ q: e.target.value })}
              placeholder={isAr ? "اسم، بريد، رقم تسجيل…" : "Name, email, student ID…"}
              autoComplete="off"
            />
          </label>
          <ul className="max-h-44 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/80">
            {state.hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2.5 text-start text-sm transition hover:bg-primary/10"
                  onClick={() =>
                    patch({
                      linkedUserId: h.id,
                      linkedLabel: `${h.fullName} — ${h.studentId}`,
                      q: h.fullName,
                      hits: [],
                    })
                  }
                >
                  <span className="font-semibold text-text">{h.fullName}</span>
                  <span className="mt-0.5 block text-xs text-text-light">
                    {h.studentId} · {getGradeLabel(h.grade, isAr ? "ar" : "en")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {state.linkedUserId ? (
            <p className="rounded-lg bg-primary/5 px-3 py-2 text-xs font-semibold text-primary">
              {isAr ? "المحدد: " : "Selected: "}
              {state.linkedLabel || state.linkedUserId}
            </p>
          ) : (
            <p className="text-xs text-amber-800">
              {isAr ? "اختر طالباً من نتائج البحث." : "Pick a student from search results."}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-text-light sm:col-span-2">
            {isAr ? "الاسم بالعربية" : "Name (Arabic)"} *
            <input
              required
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              value={state.snapshotFullNameAr}
              onChange={(e) => patch({ snapshotFullNameAr: e.target.value })}
            />
          </label>
          <label className="block text-xs font-bold text-text-light sm:col-span-2">
            {isAr ? "الاسم بالإنجليزية" : "Name (English)"}
            <input
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              value={state.snapshotFullNameEn}
              onChange={(e) => patch({ snapshotFullNameEn: e.target.value })}
            />
          </label>
          <label className="block text-xs font-bold text-text-light">
            {isAr ? "الجنس" : "Gender"}
            <select
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              value={state.snapshotGender}
              onChange={(e) =>
                patch({ snapshotGender: e.target.value === "female" ? "female" : "male" })
              }
            >
              <option value="male">{isAr ? "ذكر" : "Male"}</option>
              <option value="female">{isAr ? "أنثى" : "Female"}</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-text-light">
            {isAr ? "الصف" : "Grade"}
            <select
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              value={state.snapshotGrade}
              onChange={(e) => patch({ snapshotGrade: e.target.value })}
            >
              {GRADE_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {isAr ? g.ar : g.en}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-bold text-text-light">
            {isAr ? "المسار / القسم" : "Track / section"}
            <select
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              value={state.snapshotSection}
              onChange={(e) =>
                patch({
                  snapshotSection: e.target.value === "international" ? "international" : "arabic",
                })
              }
            >
              <option value="arabic">{isAr ? "عربي" : "Arabic"}</option>
              <option value="international">{isAr ? "دولي" : "International"}</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-text-light">
            {isAr ? "نوع السجل" : "Record type"}
            <select
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              value={state.externalStudentKind}
              onChange={(e) =>
                patch({
                  externalStudentKind:
                    e.target.value === "alumni_student" ? "alumni_student" : "external_student",
                })
              }
            >
              <option value="external_student">{isAr ? "طالب خارجي" : "External student"}</option>
              <option value="alumni_student">{isAr ? "خريج" : "Alumni"}</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-text-light">
            {isAr ? "حالة الطالب في السجل" : "Student status in record"}
            <select
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              value={state.snapshotStudentStatus}
              onChange={(e) => {
                const v = e.target.value;
                patch({
                  snapshotStudentStatus:
                    v === "alumni" ? "alumni" : v === "external" ? "external" : "current",
                });
              }}
            >
              <option value="current">{isAr ? "طالب حالي (تعريف إداري)" : "Current (admin label)"}</option>
              <option value="external">{isAr ? "خارجي" : "External"}</option>
              <option value="alumni">{isAr ? "خريج" : "Alumni"}</option>
            </select>
          </label>
        </div>
      )}

      <div className="mt-6 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2">
        <label className="block text-xs font-bold text-text-light">
          {isAr ? "حالة الإنجاز عند الحفظ" : "Initial workflow status"}
          <select
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            value={state.adminStatus}
            onChange={(e) =>
              patch({
                adminStatus: e.target.value as AdminAchievementIdentityState["adminStatus"],
              })
            }
          >
            <option value="pending_review">{isAr ? "قيد المراجعة" : "Pending review"}</option>
            <option value="approved">{isAr ? "معتمد" : "Approved"}</option>
            <option value="featured">{isAr ? "معتمد ومميز" : "Approved & featured"}</option>
            <option value="needs_revision">{isAr ? "يحتاج تعديل" : "Needs revision"}</option>
            <option value="rejected">{isAr ? "مرفوض" : "Rejected"}</option>
          </select>
        </label>
        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-start gap-2 text-sm font-semibold text-text">
            <input
              type="checkbox"
              className="mt-1"
              checked={state.showInPublicPortfolio}
              onChange={(e) => patch({ showInPublicPortfolio: e.target.checked })}
            />
            <span>
              {isAr ? "يظهر في ملف الإنجاز العام" : "Show in public achievement portfolio"}
              <span className="mt-1 block text-[11px] font-normal text-text-light">
                {isAr
                  ? "الإنجازات المعتمدة تُنشر افتراضيًا في ملف إنجاز الطالب، ويمكن استثناء هذا الإنجاز يدويًا."
                  : "Approved achievements are published by default to the student’s public portfolio; you can exclude this one."}
              </span>
            </span>
          </label>
        </div>
        <label className="flex cursor-pointer items-center gap-2 pt-2 text-sm font-semibold text-text sm:col-span-2">
          <input
            type="checkbox"
            checked={state.showInHallOfFame}
            onChange={(e) => patch({ showInHallOfFame: e.target.checked })}
          />
          {isAr ? "إظهار في لوحة التميز (عند الاعتماد)" : "Show in Hall of Fame (when approved)"}
        </label>
      </div>
    </SectionCard>
  );
};

export default AdminAchievementIdentitySection;
