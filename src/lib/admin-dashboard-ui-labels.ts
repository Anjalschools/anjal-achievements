export const statusBucketLabel = (key: string, isAr: boolean): string => {
  const m: Record<string, [string, string]> = {
    pending: ["قيد المراجعة", "Pending review"],
    needs_revision: ["يحتاج تعديل", "Needs revision"],
    pending_re_review: ["تم التعديل / إعادة مراجعة", "Resubmitted / re-review"],
    approved: ["معتمد", "Approved"],
    featured: ["مميز", "Featured"],
    rejected: ["مرفوض", "Rejected"],
  };
  const pair = m[key];
  if (pair) return isAr ? pair[0] : pair[1];
  return key;
};

export const statusBucketColor = (key: string): string => {
  const colors: Record<string, string> = {
    pending: "#f59e0b",
    needs_revision: "#ea580c",
    pending_re_review: "#2563eb",
    approved: "#10b981",
    featured: "#7c3aed",
    rejected: "#ef4444",
  };
  return colors[key] || "#94a3b8";
};

export const levelKeyLabel = (key: string, isAr: boolean): string => {
  const k = key.toLowerCase();
  const map: Record<string, [string, string]> = {
    school: ["المدرسة", "School"],
    province: ["المحافظة", "Province"],
    kingdom: ["المملكة", "Kingdom"],
    international: ["العالم", "International / World"],
  };
  const pair = map[k];
  if (pair) return isAr ? pair[0] : pair[1];
  return key;
};

export const domainKeyLabel = (key: string, isAr: boolean): string => {
  const map: Record<string, [string, string]> = {
    scientific: ["علمي", "Scientific"],
    technical: ["تقني", "Technical"],
    cultural: ["ثقافي", "Cultural"],
    sports: ["رياضي", "Sports"],
    quran: ["قرآني", "Quranic"],
    arts: ["فني", "Arts"],
    other: ["أخرى", "Other"],
  };
  const pair = map[key];
  if (pair) return isAr ? pair[0] : pair[1];
  return key;
};

export const roleLabel = (role: string, isAr: boolean): string => {
  const map: Record<string, [string, string]> = {
    student: ["الطلاب", "Students"],
    judge: ["المحكمون", "Judges"],
    teacher: ["رواد النشاط", "Activity leaders"],
    schoolAdmin: ["مديرو المدارس", "School admins"],
    admin: ["الأدمن", "Admins"],
    supervisor: ["المشرفون", "Supervisors"],
  };
  const pair = map[role];
  if (pair) return isAr ? pair[0] : pair[1];
  return role;
};

export const roleAccentClass = (role: string): string => {
  const c: Record<string, string> = {
    student: "border-sky-200 bg-sky-50 text-sky-950",
    judge: "border-violet-200 bg-violet-50 text-violet-950",
    teacher: "border-amber-200 bg-amber-50 text-amber-950",
    schoolAdmin: "border-emerald-200 bg-emerald-50 text-emerald-950",
    admin: "border-rose-200 bg-rose-50 text-rose-950",
    supervisor: "border-indigo-200 bg-indigo-50 text-indigo-950",
  };
  return c[role] || "border-gray-200 bg-gray-50 text-gray-900";
};
