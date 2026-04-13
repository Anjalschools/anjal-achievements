"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import type { LetterRequestStatus } from "@/lib/letter-request-types";

type Row = {
  _id: string;
  studentSnapshot?: { fullName?: string; studentId?: string };
  studentUser?: { fullName?: string; studentId?: string } | null;
  requestType: string;
  language: string;
  targetOrganization: string;
  requestedAuthorRole: string;
  status: LetterRequestStatus;
  createdAt: string;
};

const LetterRequestsAdminListPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [requestType, setRequestType] = useState<string>("all");
  const [language, setLanguage] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (status !== "all") sp.set("status", status);
      if (requestType !== "all") sp.set("requestType", requestType);
      if (language !== "all") sp.set("language", language);
      if (roleFilter !== "all") sp.set("requestedAuthorRole", roleFilter);
      if (q.trim()) sp.set("q", q.trim());
      const res = await fetch(`/api/admin/letter-requests?${sp.toString()}`, { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, requestType, language, roleFilter, q]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "طلبات الخطابات" : "Letter requests"}
        subtitle={isAr ? "إفادات وخطابات توصية" : "Testimonials and recommendations"}
      />

      <SectionCard className="mb-4">
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-5 ${isAr ? "text-right" : "text-left"}`}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">{isAr ? "الحالة" : "Status"}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            >
              <option value="all">{isAr ? "الكل" : "All"}</option>
              <option value="pending">{isAr ? "قيد الانتظار" : "Pending"}</option>
              <option value="in_review">{isAr ? "قيد المراجعة" : "In review"}</option>
              <option value="needs_revision">{isAr ? "يحتاج تعديلاً" : "Needs revision"}</option>
              <option value="approved">{isAr ? "معتمد" : "Approved"}</option>
              <option value="rejected">{isAr ? "مرفوض" : "Rejected"}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">{isAr ? "النوع" : "Type"}</label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            >
              <option value="all">{isAr ? "الكل" : "All"}</option>
              <option value="testimonial">{isAr ? "إفادة" : "Testimonial"}</option>
              <option value="recommendation">{isAr ? "توصية" : "Recommendation"}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">{isAr ? "اللغة" : "Language"}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            >
              <option value="all">{isAr ? "الكل" : "All"}</option>
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">{isAr ? "المُوقِّع" : "Signatory"}</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            >
              <option value="all">{isAr ? "الكل" : "All"}</option>
              <option value="teacher">{isAr ? "معلم" : "Teacher"}</option>
              <option value="supervisor">{isAr ? "مشرف" : "Supervisor"}</option>
              <option value="school_administration">{isAr ? "إدارة" : "Administration"}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">{isAr ? "بحث" : "Search"}</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={isAr ? "اسم، جهة، نص…" : "Name, org, text…"}
              className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white"
        >
          {isAr ? "تطبيق الفلاتر" : "Apply filters"}
        </button>
      </SectionCard>

      <SectionCard>
        {loading ? (
          <p className="py-8 text-center text-text-light">{isAr ? "جاري التحميل…" : "Loading…"}</p>
        ) : error ? (
          <p className="text-center text-red-600">{error}</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-text-light">{isAr ? "لا نتائج" : "No results"}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-2 pe-2">{isAr ? "الطالب" : "Student"}</th>
                  <th className="py-2 pe-2">{isAr ? "الجهة" : "Organization"}</th>
                  <th className="py-2 pe-2">{isAr ? "النوع" : "Type"}</th>
                  <th className="py-2 pe-2">{isAr ? "الحالة" : "Status"}</th>
                  <th className="py-2">{isAr ? "إجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => {
                  const name =
                    row.studentUser?.fullName || row.studentSnapshot?.fullName || (isAr ? "—" : "—");
                  return (
                    <tr key={row._id} className="border-b border-slate-100">
                      <td className="py-2 pe-2 font-medium text-slate-900">{name}</td>
                      <td className="max-w-[200px] truncate py-2 pe-2 text-slate-700">{row.targetOrganization}</td>
                      <td className="py-2 pe-2 text-slate-600">{row.requestType}</td>
                      <td className="py-2 pe-2 text-slate-600">{row.status}</td>
                      <td className="py-2">
                        <Link href={`/admin/letter-requests/${row._id}`} className="font-semibold text-primary hover:underline">
                          {isAr ? "مراجعة" : "Review"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </PageContainer>
  );
};

export default LetterRequestsAdminListPage;
