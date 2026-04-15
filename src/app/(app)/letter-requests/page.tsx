"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AuthGuardLink from "@/components/auth/AuthGuardLink";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCard from "@/components/layout/SectionCard";
import { getLocale } from "@/lib/i18n";
import {
  letterRequestStatusDescriptionAr,
  letterRequestStatusDescriptionEn,
  letterRequestStatusLabelAr,
  letterRequestStatusLabelEn,
} from "@/lib/letter-request-status-ui";
import type { LetterRequestStatus } from "@/lib/letter-request-types";
import { PlusCircle } from "lucide-react";

type Row = {
  _id: string;
  requestType: string;
  language: string;
  targetOrganization: string;
  status: LetterRequestStatus;
  createdAt: string;
  verificationPath?: string;
};

const LetterRequestsListPage = () => {
  const locale = getLocale();
  const isAr = locale === "ar";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Row[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/letter-requests/mine", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : "Failed");
      setItems(Array.isArray(j.items) ? j.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageContainer>
      <PageHeader
        title={isAr ? "الإفادة وخطاب التوصية" : "Testimonials & recommendation letters"}
        subtitle={
          isAr
            ? "تقديم طلب جديد أو متابعة حالة الطلبات السابقة."
            : "Submit a new request or track previous requests."
        }
      />
      <div className="mb-4 flex justify-end">
        <AuthGuardLink
          href="/letter-requests/new"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-95"
        >
          <PlusCircle className="h-4 w-4" aria-hidden />
          {isAr ? "طلب جديد" : "New request"}
        </AuthGuardLink>
      </div>

      <SectionCard>
        {loading ? (
          <p className="py-8 text-center text-text-light">{isAr ? "جاري التحميل…" : "Loading…"}</p>
        ) : error ? (
          <p className="py-4 text-center text-red-600">{error}</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-text-light">
            {isAr ? "لا توجد طلبات بعد." : "No requests yet."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((row) => (
              <li key={row._id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className={`min-w-0 flex-1 ${isAr ? "text-right" : "text-left"}`}>
                  <p className="font-bold text-slate-900">{row.targetOrganization}</p>
                  <p className="text-xs text-slate-500">
                    {row.requestType === "testimonial"
                      ? isAr
                        ? "إفادة"
                        : "Testimonial"
                      : isAr
                        ? "خطاب توصية"
                        : "Recommendation"}
                    {" · "}
                    {row.language === "ar" ? (isAr ? "العربية" : "Arabic") : isAr ? "الإنجليزية" : "English"}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {isAr ? letterRequestStatusDescriptionAr(row.status) : letterRequestStatusDescriptionEn(row.status)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800">
                    {isAr ? letterRequestStatusLabelAr(row.status) : letterRequestStatusLabelEn(row.status)}
                  </span>
                  <Link
                    href={`/letter-requests/${row._id}`}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-slate-50"
                  >
                    {isAr ? "التفاصيل" : "Details"}
                  </Link>
                  {row.status === "approved" && row.verificationPath ? (
                    <Link
                      href={`/letter-requests/${row._id}/document`}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      {isAr ? "عرض الخطاب" : "View letter"}
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageContainer>
  );
};

export default LetterRequestsListPage;
