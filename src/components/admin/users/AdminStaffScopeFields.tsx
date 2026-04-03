"use client";

import { GRADE_OPTIONS } from "@/constants/grades";

export type AdminStaffScopeFormValue = {
  genders: ("male" | "female")[];
  sections: ("arabic" | "international")[];
  grades: string[];
};

type Props = {
  isAr: boolean;
  value: AdminStaffScopeFormValue;
  onChange: (next: AdminStaffScopeFormValue) => void;
  disabled?: boolean;
};

const toggleIn = <T extends string>(list: T[], v: T): T[] =>
  list.includes(v) ? (list.filter((x) => x !== v) as T[]) : ([...list, v] as T[]);

const chk =
  "h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50";

const AdminStaffScopeFields = ({ isAr, value, onChange, disabled }: Props) => {
  const patch = (p: Partial<AdminStaffScopeFormValue>) => onChange({ ...value, ...p });

  return (
    <div className="space-y-4 rounded-xl border border-dashed border-primary/25 bg-primary/[0.04] p-4">
      <div>
        <p className="text-xs font-bold text-slate-800">
          {isAr ? "النطاق التنظيمي (اختياري)" : "Organizational scope (optional)"}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
          {isAr
            ? "اترك كل الخيارات فارغة لمنح وصول كامل للمنصة (للمدير/المشرف). عند التحديد، يقتصر عرض الطلاب والإنجازات على الاتحاد (بنين وبنات، أقسام، صفوف)."
            : "Leave all unchecked for full platform access (admin/supervisor). When set, students and achievements are limited to the union of selected genders, divisions, and grades."}
        </p>
      </div>

      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-xs font-semibold text-slate-700">
          {isAr ? "النوع المسموح" : "Allowed gender"}
        </legend>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className={chk}
              checked={value.genders.includes("male")}
              onChange={() => patch({ genders: toggleIn(value.genders, "male") })}
            />
            {isAr ? "بنين" : "Boys (male)"}
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className={chk}
              checked={value.genders.includes("female")}
              onChange={() => patch({ genders: toggleIn(value.genders, "female") })}
            />
            {isAr ? "بنات" : "Girls (female)"}
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-xs font-semibold text-slate-700">
          {isAr ? "القسم المسموح" : "Allowed division"}
        </legend>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className={chk}
              checked={value.sections.includes("arabic")}
              onChange={() => patch({ sections: toggleIn(value.sections, "arabic") })}
            />
            {isAr ? "عربي" : "Arabic"}
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className={chk}
              checked={value.sections.includes("international")}
              onChange={() => patch({ sections: toggleIn(value.sections, "international") })}
            />
            {isAr ? "دولي" : "International"}
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-2" disabled={disabled}>
        <legend className="text-xs font-semibold text-slate-700">
          {isAr ? "الصفوف المسموحة" : "Allowed grades"}
        </legend>
        <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
          {GRADE_OPTIONS.map((g) => (
            <label
              key={g.value}
              className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-800"
            >
              <input
                type="checkbox"
                className={chk}
                checked={value.grades.includes(g.value)}
                onChange={() => patch({ grades: toggleIn(value.grades, g.value) })}
              />
              {isAr ? g.ar : g.en}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
};

export default AdminStaffScopeFields;
